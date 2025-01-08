# Overview

Welcome to the repository for the **Library Seating Prediction Project**! This repository contains all the pipelines and scripts used for predicting library occupancy and powering the accompanying web application. 

You can explore the live project at:  
[**KTH Seating Website**](https://kthseating.netlify.app/)

# Project Snapshots:
![User Interface Example 1](images_data/UI_1.png)
![User Interface Example 2](images_data/UI_2.png)

## Key UI Features:
- **Interactive Visualization**: The bar chart displays:
  - **Darker Blue Bars**: Historical library occupancy for the current day.
  - **Lighter Gray Bars**: Predicted future occupancy.
  - **Colored Bars**: Current real-time occupancy.  
- **Prediction Accuracy**: A second card on the webpage compares **predicted vs. actual occupancy** for a one-day-ahead forecast.

The front end of this project is a static website built using React. It dynamically integrates data by fetching it from an online CSV hosted on Hugging Face and retrieves real-time occupancy data from a Firebase database, which is updated every 2 minutes.






---
# Workflows and actions 
The workflow includes routines for scraping academic calendar data, retrieving weather information, applying forecasting models (such as Prophet and others), and comparing predicted vs. actual seat occupancy. The central notebook, **OBT_3_inference_3.ipynb**, consolidates the entire process, covering data merging, model training, and inference in a streamlined workflow.

Below is a brief description of each notebook:



---
## 1. Scraper Components

### 1.1 scraper_percentage

This folder contains the most frequently used scraper for retrieving real-time library occupancy data. It includes all the necessary Docker components for deployment on a machine. Currently, the scraper is running 24/7 on a Raspberry Pi, with an automatic daily restart scheduled at 5:00 AM. 
Every 3 minutes, the scraper accesses the following website:  
[**KTH Library Real-Time Occupancy**](https://www.kth.se/en/biblioteket/anvanda-biblioteket/oppettider-kontakt/besokare-i-realtid-1.1078198)  
The scraper captures the page content and parses it to produce a structured dataframe. The parsed data is immediately stored in the Firebase Database, ensuring real-time updates to the main website. Additionally, every 10 data acquisitions, the information is uploaded to the following Hugging Face repository:  
[**Occupancy Percentage Dataset**](https://huggingface.co/datasets/davnas/occupancy_perc)  
A GitHub Action has also been implemented to monitor the last update in the Hugging Face repository. If the update does not occur as expected, an error notification is sent via email, enabling prompt issue resolution.

 
### 1.2 scraper_days/scraper_kth_days.ipynb

This notebook scrapes the opening and closing days and hours from the KTH library website, a crucial feature for determining operational hours and identifying closure days. The notebook is executed automatically via a GitHub Action three times per week. 
It retrieves data from [**KTH Library Opening Hours**](https://www.kth.se/en/biblioteket/anvanda-biblioteket/oppettider-kontakt/oppettider-och-kontakt-1.853039). 
Using Selenium, the scraper captures the page content, navigates through the "Next" button to gather additional data, and organizes the information into a structured dataframe. 
The resulting table is stored at [**Hugging Face: date_kth**](https://huggingface.co/datasets/davnas/date_kth).


### 1.3 scraper_calendar/scraper_calendar_KTH.ipynb
This notebook is executed once per year to dynamically download information about exams and study sessions for the current academic year. The data is scraped from:  
[**KTH Academic Calendar**](https://intra.kth.se/en/utbildning/schema-och-lokalbokning/lasarsindelning/lasaret-2024-2025-1.1212249)  
The scraped data is stored at:  
[**Hugging Face: Academic Scraper Dataset**](https://huggingface.co/datasets/andreitut/kth-academic-scraper)  

### 1.4 weatherData.ipynb
This notebook logs past weather predictions by performing API requests using the OpenMeteo API. The resulting dataframe is available at:  
[**Weather Dataset Project**](https://huggingface.co/datasets/andreitut/weatherDatasetProject)  
the notebook is executed every hour.
---
## 2. Training and Inference

### 2.1 training_inference/OBT_3_inference.ipynb
This notebook is one of the most frequently used scripts, executed via GitHub Actions every 25 minutes between 7:00 and 21:30. Its primary purpose is to perform inference by downloading all necessary data and models, and generating predictions for both the current day and the next day.
The models are stored in the [**davnas/library**](https://huggingface.co/davnas/library) model repository, with a separate model corresponding to each zone. 
The results are stored and uploaded to the following Hugging Face repository links:
- [**forecast_tomorrow.csv**](https://huggingface.co/datasets/davnas/library-occupancy/blob/main/forecast_tomorrow.csv): Contains predictions for the next day.  
- [**data_2.csv**](https://huggingface.co/datasets/davnas/library-occupancy/blob/main/data_2.csv): Includes measurements for the current day and forecasts for the same day.  


### 2.2 training_inference/Training_4_original.ipynb
This notebook is used to train models that are subsequently added to the [davnas/library](https://huggingface.co/davnas/library) repository. It requires manual execution to ensure that the newly trained model performs better than the previous version.

### 2.3 training_inference/EDA.ipynb
This notebook contains the exploratory data analysis (EDA) performed during the model development phase. 
Due to the limited availability of historical data—starting only from December 12, the day the scraper was deployed—the dataset comprises just one month of records. This dataset does not fully reflect typical scenarios. In this notebook, the possibility of implementing Prophet was explored. Although Prophet performed reasonably well, XGBoost showed better results, particularly when using occupancy percentages aligned with the intended purpose of the model.



---
## 3. Comparing and Logging

### 3.1 log_forecast.ipynb
This notebook is designed to log the predictions for the next day. Logging these predictions simplifies the process of comparing them with actual data, as predictions are recalculated every 25 minutes. 
The logged predictions are stored in the following Hugging Face repository:  
[**Library Occupancy Dataset**](https://huggingface.co/datasets/davnas/library-occupancy)

### 3.2 comparison_pred_reality.ipynb
This notebook compares past predictions with the actual data of the day. It serves two main purposes:
1. To generate visualizations for the website's user interface.
2. To log the performance metrics of the prediction models for further analysis.
The outputs help enhance both the user experience on the website and the accuracy of future predictions.



