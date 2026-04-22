import os
from dotenv import load_dotenv
import requests
import pandas as pd
import zipfile
import io
from sqlalchemy import create_engine, text
from datetime import datetime

# --- Configuration ---
load_dotenv()
GDELT_LAST_UPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
DATABASE_URI =os.getenv("DATABASE_URI")

if not DATABASE_URI:
    raise ValueError("No DATABASE_URI set for the application. Check your .env file.")

def generate_gdelt_headers():
    """Returns the 61 column names for GDELT 2.0 export files."""
    return [
        'GLOBALEVENTID', 'SQLDATE', 'MonthYear', 'Year', 'FractionDate',
        'Actor1Code', 'Actor1Name', 'Actor1CountryCode', 'Actor1KnownGroupCode', 'Actor1EthnicCode',
        'Actor1Religion1Code', 'Actor1Religion2Code', 'Actor1Type1Code', 'Actor1Type2Code', 'Actor1Type3Code',
        'Actor2Code', 'Actor2Name', 'Actor2CountryCode', 'Actor2KnownGroupCode', 'Actor2EthnicCode',
        'Actor2Religion1Code', 'Actor2Religion2Code', 'Actor2Type1Code', 'Actor2Type2Code', 'Actor2Type3Code',
        'IsRootEvent', 'EventCode', 'EventBaseCode', 'EventRootCode', 'QuadClass',
        'GoldsteinScale', 'NumMentions', 'NumSources', 'NumArticles', 'AvgTone',
        'Actor1Geo_Type', 'Actor1Geo_FullName', 'Actor1Geo_CountryCode', 'Actor1Geo_ADM1Code', 'Actor1Geo_ADM2Code',
        'Actor1Geo_Lat', 'Actor1Geo_Long', 'Actor1Geo_FeatureID',
        'Actor2Geo_Type', 'Actor2Geo_FullName', 'Actor2Geo_CountryCode', 'Actor2Geo_ADM1Code', 'Actor2Geo_ADM2Code',
        'Actor2Geo_Lat', 'Actor2Geo_Long', 'Actor2Geo_FeatureID',
        'ActionGeo_Type', 'ActionGeo_FullName', 'ActionGeo_CountryCode', 'ActionGeo_ADM1Code', 'ActionGeo_ADM2Code',
        'ActionGeo_Lat', 'ActionGeo_Long', 'ActionGeo_FeatureID',
        'DATEADDED', 'SOURCEURL'
    ]

def map_cameo_to_category(event_code):
    """Maps raw CAMEO codes to high-level dashboard categories."""
    # Ensure it's a string and pad with a leading zero if necessary (e.g., '14' or '04')
    code_str = str(event_code).zfill(2)
    
    # The first two digits of a CAMEO code represent the root event category
    root_code = code_str[:2] 

    if root_code == '14':
        return 'Protest / Unrest'
    elif root_code in ['18', '19', '20']:
        return 'Armed Conflict / Violence'
    elif root_code in ['17', '15', '16']:
        return 'Coercion / Force Posture'
    elif root_code in ['10', '11', '12', '13']:
        return 'Diplomatic Tension'
    else:
        return 'Other'

def get_latest_gdelt_url():
    """Fetches the URL of the most recent 15-minute GDELT export."""
    response = requests.get(GDELT_LAST_UPDATE_URL)
    response.raise_for_status()
    # The first line contains the main export zip
    first_line = response.text.split('\n')[0]
    zip_url = first_line.split(' ')[2]
    return zip_url

def extract_and_load(zip_url):
    """Downloads the zip into memory and loads it into a Pandas DataFrame."""
    response = requests.get(zip_url)
    response.raise_for_status()
    
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        # GDELT zips contain a single CSV
        csv_filename = z.namelist()[0]
        with z.open(csv_filename) as f:
            # GDELT has 60+ columns; we only need a subset
            columns_to_keep = [
                'SQLDATE', 'EventCode', 'GoldsteinScale', 
                'ActionGeo_Lat', 'ActionGeo_Long', 'ActionGeo_CountryCode',
                'SOURCEURL'
            ]
            # Use pandas to read the raw tab-separated values
            df = pd.read_csv(f, sep='\t', header=None, names=generate_gdelt_headers(), usecols=columns_to_keep)
            return df

from sqlalchemy import text


def transform_data(df):
    """Cleans the data and maps CAMEO codes to our custom taxonomy."""
    # Drop rows without geographic coordinates
    df = df.dropna(subset=['ActionGeo_Lat', 'ActionGeo_Long'])
    
    # Map CAMEO EventCodes
    df['event_category'] = df['EventCode'].apply(map_cameo_to_category)
    
    # Filter out noise
    df = df[df['GoldsteinScale'] < -2.0]
    
    # Format date
    df['event_date'] = pd.to_datetime(df['SQLDATE'], format='%Y%m%d').dt.date
    
    # Rename columns to match PostgreSQL schema exactly
    df = df.rename(columns={
        'EventCode': 'event_code',
        'ActionGeo_CountryCode': 'country_code',
        'GoldsteinScale': 'goldstein_scale',
        'SOURCEURL': 'source_url',
        'ActionGeo_Lat': 'lat',
        'ActionGeo_Long': 'lon'
    })
    
    return df

def push_to_postgis(df, engine):
    """Inserts data explicitly into the instability_events spatial table."""
    if df.empty:
        print(f"[{datetime.now()}] No severe events found in this batch.")
        return
        
    with engine.begin() as conn:
        for _, row in df.iterrows():
            # ST_MakePoint translates the lat/lon into the PostGIS geo column
            query = text("""
                INSERT INTO instability_events 
                (event_date, event_code, event_category, country_code, goldstein_scale, source_url, geom)
                VALUES 
                (:date, :code, :category, :country, :goldstein, :url, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
            """)
            conn.execute(query, {
                'date': row['event_date'],
                'code': row['event_code'],
                'category': row['event_category'],
                'country': row['country_code'],
                'goldstein': row['goldstein_scale'],
                'url': row['source_url'],
                'lon': row['lon'],
                'lat': row['lat']
            })
            
    print(f"[{datetime.now()}] Successfully inserted {len(df)} records into instability_events.")

def main():
    engine = create_engine(DATABASE_URI)
    try:
        latest_url = get_latest_gdelt_url()
        raw_df = extract_and_load(latest_url)
        clean_df = transform_data(raw_df)
        push_to_postgis(clean_df, engine)
    except Exception as e:
        print(f"Ingestion failed: {e}")
        # Here you would integrate a logging/alerting system

if __name__ == "__main__":
    main()
