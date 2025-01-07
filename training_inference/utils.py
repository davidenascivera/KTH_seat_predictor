import pandas as pd
import numpy as np
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import matplotlib.pyplot as plt

# ----------------------
# Data Preprocessing
# ----------------------

def preprocess_raw_data(df):
    """
    Preprocess raw data with all necessary transformations.

    Args:
        df: Raw DataFrame with occupancy data
    Returns:
        Preprocessed DataFrame
    """
    df = df.copy()

    # Ensure index is datetime
    if not isinstance(df.index, pd.DatetimeIndex):
        if 'index' in df.columns:
            df.set_index('index', inplace=True)
        df.index = pd.to_datetime(df.index)

    # Map event types
    event_mapping = {
        'Normal': 0,
        'Holyday': 1,
        'Re-exam': 2,
        'Self-study': 3
    }
    if 'Event' in df.columns:
        df['Event'] = df['Event'].map(event_mapping)

    # Add time-based features
    df = add_time_features(df)

    return df

def add_time_features(df):
    """
    Add all time-related features to the dataset.
    """
    df = df.copy()

    # Calculate opening/closing times
    df['opening_time'] = df.index.normalize() + pd.to_timedelta(df['opening_hour'], unit='h')
    df['closing_time'] = df.index.normalize() + pd.to_timedelta(df['closing_hour'], unit='h')

    # Calculate minutes until open/close
    df['time_until_open'] = (df['opening_time'] - df.index).dt.total_seconds() / 60
    df['time_until_close'] = (df['closing_time'] - df.index).dt.total_seconds() / 60

    # Ensure non-negative values
    df['time_until_open'] = df['time_until_open'].apply(lambda x: max(x, 0))
    df['time_until_close'] = df['time_until_close'].apply(lambda x: max(x, 0))

    # Add hour and calculate if location is open
    df['hour'] = df.index.hour
    df['is_open'] = ((df['hour'] >= df['opening_hour']) &
                     (df['hour'] < df['closing_hour'])).astype(int)

    # Add minute
    df['minute'] = df.index.minute

    # Clean up temporary columns
    df = df.drop(['opening_time', 'closing_time'], axis=1)

    return df

