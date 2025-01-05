import time
import datetime
import re
import pandas as pd
from zoneinfo import ZoneInfo

# Selenium and ChromeDriver
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Hugging Face
from huggingface_hub import login
from datasets import Dataset, load_dataset

# Firebase
import firebase_admin
from firebase_admin import credentials, db

# Replace with your actual token
HUGGINGFACE_TOKEN = "add_your_token_here"
repo_name = "davnas/occupancy_perc"

# Login to Hugging Face
login(token=HUGGINGFACE_TOKEN)

# Firebase initialization
cred = credentials.Certificate("add_your_firebase_creds.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://kthseating-e5b41-default-rtdb.europe-west1.firebasedatabase.app/'
})

# Load Hugging Face dataset
hf_dataset = load_dataset(repo_name)
df = pd.concat(
    [
        split.to_pandas().astype(
            {
                'KTH Library': int,
                'South-East Gallery': int,
                'North Gallery': int,
                'South Gallery': int,
                'Ångdomen': int,
                'Newton': int
            }
        )
        for split in hf_dataset.values()
    ],
    ignore_index=True
)
df.set_index('index', inplace=True)

def parse_values(content):
    """
    Attempt to parse out 6 occupancy percentages from the KTH library page body text.
    Returns a transposed DataFrame row with the occupancy data if successful, else None.
    """
    try:
        # Extract 6 lines with location and percentages
        data = re.findall(r"([a-zA-ZÅäöÅÄÖ\s-]+)\s(\d+)%", content)
        
        if not data or len(data) != 6:
            print(f"Warning: Found {len(data)} locations instead of 6")
            print(f"Content: {content}")
            return None
        
        df_tmp = pd.DataFrame(data, columns=["Location", "Occupancy (%)"])
        
        expected_locations = [
            'KTH Library', 
            'South-East Gallery', 
            'North Gallery',
            'South Gallery', 
            'Ångdomen', 
            'Newton'
        ]
        
        df_transposed = df_tmp.drop("Location", axis=1).T
        df_transposed.index = [
            datetime.datetime.now(ZoneInfo("Europe/Stockholm")).strftime("%Y-%m-%d %H:%M:%S")
        ]
        df_transposed.columns = expected_locations
        
        return df_transposed.astype(int)

    except Exception as e:
        print(f"Parsing error: {e}")
        return None

def web_request():
    """
    Initialize headless Chrome with webdriver_manager, load the page, and return the text from <body>.
    """
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--remote-debugging-port=9222")
    options.add_argument('--disable-blink-features=AutomationControlled')

    # Let webdriver_manager install the correct ChromeDriver version
    service = Service(ChromeDriverManager().install())

    driver = None
    try:
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(30)
        
        url = "https://www.kth.se/en/biblioteket/anvanda-biblioteket/oppettider-kontakt/besokare-i-realtid-1.1078198"
        driver.get(url)
        
        time.sleep(10)
        content = driver.find_element(By.TAG_NAME, "body").text
        return content
    finally:
        if driver:
            driver.quit()

def publish_to_firebase(df_row):
    """
    Publishes the latest occupancy data to Firebase.
    """
    try:
        data = {
            "current-occupancy": {
                "main": int(df_row['KTH Library'].iloc[0]),
                "southEast": int(df_row['South-East Gallery'].iloc[0]),
                "north": int(df_row['North Gallery'].iloc[0]),
                "south": int(df_row['South Gallery'].iloc[0]),
                "angdomen": int(df_row['Ångdomen'].iloc[0]),
                "newton": int(df_row['Newton'].iloc[0])
            }
        }
        ref = db.reference('/')
        ref.set(data)
        print("Data published to Firebase successfully!")
    except Exception as e:
        print(f"Firebase publish error: {e}")

MAX_RETRIES = 3
RETRY_DELAY = 60  # seconds to wait between retries
measurement_count = 0

while True:
    retries = 0
    while retries < MAX_RETRIES:
        try:
            content = web_request()
            df_new = parse_values(content)
            if df_new is not None and len(df_new.columns) == 6:
                df = pd.concat([df, df_new])
                df_new.index.name = 'time'
                print(df_new)

                # Save locally and publish to Firebase
                df.to_csv('out.csv')
                publish_to_firebase(df_new)

                measurement_count += 1

                # Push to Hugging Face every 10 measurements
                if measurement_count >= 10:
                    measurement_count = 0
                    try:
                        df_to_push = df.copy()
                        df_to_push.index = pd.to_datetime(df_to_push.index)
                        df_to_push = df_to_push.reset_index()
                        df_to_push['index'] = df_to_push['index'].astype(str)
                        
                        hf_dataset = Dataset.from_pandas(df_to_push)
                        hf_dataset.push_to_hub(
                            repo_id=repo_name,
                            token=HUGGINGFACE_TOKEN,
                            private=False,
                            commit_message="Update dataset"
                        )
                        print(f"Dataset pushed to Hugging Face repository: {repo_name}")
                    except Exception as e:
                        print(f"HuggingFace push error: {e}")
                
                # Break out of the retry loop
                break
        except Exception as e:
            retries += 1
            print(f"Attempt {retries}/{MAX_RETRIES} failed: {e}")
            if retries < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
            else:
                print("Max retries reached, waiting for next scheduled run")

    # Wait for next scheduled run (3 minutes here)
    time.sleep(180)
