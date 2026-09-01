"""
Weekly Tracker Data Transformation Module

This module handles the complete data processing pipeline:
1. Clean CSV data
2. Fetch Zoho forecast timeline data (with MongoDB caching)
3. Merge and transform data
4. Calculate metrics
5. Aggregate and prepare for database storage
"""

import os
import json
import requests
from pathlib import Path
from dotenv import load_dotenv
import pandas as pd
from datetime import datetime, timedelta
import warnings
import numpy as np
import asyncio

# Load environment variables
load_dotenv()

# Zoho API credentials
ZOHO_CLIENT_ID = os.getenv('ZOHO_CLIENT_ID')
ZOHO_CLIENT_SECRET = os.getenv('ZOHO_CLIENT_SECRET')
ZOHO_REFRESH_TOKEN = os.getenv('ZOHO_REFRESH_TOKEN')

warnings.filterwarnings("ignore")


def normalize_record_id(rid):
    """Normalize record ID by removing 'zcrm_' prefix if present."""
    if pd.isna(rid):
        return None
    rid_str = str(rid).strip()
    if rid_str.startswith('zcrm_'):
        return rid_str.replace('zcrm_', '')
    return rid_str


def get_access_token(logger=None):
    """Get fresh access token from Zoho."""
    msg1 = "  → Requesting fresh access token from Zoho OAuth..."
    if logger: logger(msg1)
    else: print(msg1)
    url = "https://accounts.zoho.com/oauth/v2/token"
    params = {
        'refresh_token': ZOHO_REFRESH_TOKEN,
        'client_id': ZOHO_CLIENT_ID,
        'client_secret': ZOHO_CLIENT_SECRET,
        'grant_type': 'refresh_token'
    }
    response = requests.post(url, params=params)
    response.raise_for_status()
    msg2 = "  ✓ Access token obtained successfully"
    if logger: logger(msg2)
    else: print(msg2)
    return response.json()


def fetch_timeline_paginated(record_id, access_token):
    """Fetch all pages for a single record's timeline. Returns aggregated body and last status code."""
    per_page = 200
    page = 1
    aggregated = []
    last_status = 200

    while True:
        url = f"https://www.zohoapis.com/crm/v8/Deals/{record_id}/__timeline"
        headers = {"Authorization": f"Zoho-oauthtoken {access_token}", "Accept": "application/json"}
        params = {"page": page, "per_page": per_page}
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        last_status = resp.status_code

        if resp.status_code == 401:
            return None, 401

        try:
            body = resp.json()
        except ValueError:
            return resp.text, resp.status_code

        if isinstance(body, dict) and "data" in body and isinstance(body["data"], list):
            aggregated.extend(body["data"])
            info = body.get("info") or {}
            more = info.get("more_records")
            if more:
                page += 1
                continue
            if len(body["data"]) < per_page:
                break
            page += 1
            continue

        if isinstance(body, list):
            aggregated.extend(body)
            if len(body) < per_page:
                break
            page += 1
            continue

        aggregated.append(body)
        break

    return aggregated, last_status


def parse_timeline_for_newest_forecast_change(record_id, timeline_data):
    """
    Parse timeline data to find the NEWEST (most recent) Forecast_Category__s change.
    
    Parameters:
    - record_id: The record ID being processed
    - timeline_data: The timeline data from API response
    
    Returns:
    - dict with record_id and audited_time (or None if no matching records found)
    """
    matching_records = []
    
    # Handle both direct list and nested structure
    if isinstance(timeline_data, list):
        items_to_process = timeline_data
    else:
        items_to_process = [timeline_data]
    
    for item in items_to_process:
        timeline_entries = item.get('__timeline', [])
        
        for timeline_entry in timeline_entries:
            # Check if action is "closed" and source is "crm_ui"
            if timeline_entry.get('action') == 'closed' and timeline_entry.get('source') == 'crm_ui':
                audited_time = timeline_entry.get('audited_time')
                field_history = timeline_entry.get('field_history', [])
                
                # Check if field_history is not None before iterating
                if field_history is not None:
                    # Look for Forecast_Category__s in field_history
                    for field in field_history:
                        if field.get('api_name') == 'Forecast_Category__s':
                            matching_records.append({
                                'Record Id': record_id,
                                'audited_time': audited_time
                            })
    
    # If no matching records found, return record with null audited_time
    if not matching_records:
        return {
            'Record Id': record_id,
            'audited_time': None
        }
    
    # Convert to DataFrame for easier sorting
    df_temp = pd.DataFrame(matching_records)
    df_temp['audited_time'] = pd.to_datetime(df_temp['audited_time'])
    
    # Sort by audited_time in DESCENDING order and take the NEWEST (first) record
    df_temp = df_temp.sort_values('audited_time', ascending=False)
    newest_record = df_temp.iloc[0].to_dict()
    
    return newest_record


async def load_cache_from_db(db):
    """Load cache from MongoDB collection."""
    print("  → Loading cache from MongoDB (collection: weekly_tracker_data_cache)...")
    coll = db["weekly_tracker_data_cache"]
    cursor = coll.find({})
    records = []
    async for doc in cursor:
        records.append({
            'Record Id': doc.get('Record Id'),
            'audited_date': doc.get('audited_date'),
            'logged_date': doc.get('logged_date')
        })
    
    if records:
        print(f"  ✓ Cache loaded: {len(records)} cached records found")
        df = pd.DataFrame(records)
        df['Record Id'] = df['Record Id'].astype(str)
        df['audited_date'] = pd.to_datetime(df['audited_date'], errors='coerce')
        if not df['audited_date'].isna().all():
            df['audited_date'] = df['audited_date'].dt.date
        df['logged_date'] = pd.to_datetime(df['logged_date']).dt.date
        return df
    
    print("  ℹ Cache is empty - all records will be fetched from Zoho API")
    return pd.DataFrame(columns=['Record Id', 'audited_date', 'logged_date'])


async def save_cache_to_db(db, records):
    """Save cache records to MongoDB."""
    print(f"  → Updating MongoDB cache with {len(records)} new records...")
    coll = db["weekly_tracker_data_cache"]
    
    # Remove old entries for updated records
    record_ids_updated = [r['Record Id'] for r in records]
    if record_ids_updated:
        delete_result = await coll.delete_many({'Record Id': {'$in': record_ids_updated}})
        if delete_result.deleted_count > 0:
            print(f"  → Removed {delete_result.deleted_count} old cache entries")
    
    # Insert new records
    if records:
        # Convert dates to datetime for MongoDB
        for record in records:
            if isinstance(record.get('audited_date'), pd.Timestamp):
                record['audited_date'] = record['audited_date'].to_pydatetime()
            elif not pd.isna(record.get('audited_date')):
                record['audited_date'] = pd.to_datetime(record['audited_date']).to_pydatetime()
            else:
                record['audited_date'] = None
                
            if isinstance(record.get('logged_date'), pd.Timestamp):
                record['logged_date'] = record['logged_date'].to_pydatetime()
            else:
                record['logged_date'] = pd.to_datetime(record['logged_date']).to_pydatetime()
        
        await coll.insert_many(records)
    
    print(f"  ✓ Cache updated: {len(records)} records saved to MongoDB")


async def fetch_and_process_forecast_changes(record_ids, db, today):
    """
    Fetch timeline data for each record with MongoDB caching support.
    
    Parameters:
    - record_ids: iterable of raw record id values (Series or list)
    - db: MongoDB database instance
    - today: Current date (datetime)
    
    Returns:
    - DataFrame with forecast category changes
    """
    # Normalize and convert to list
    rids = [normalize_record_id(r) for r in list(record_ids)]
    
    # Load existing cache from MongoDB
    df_cache = await load_cache_from_db(db)
    
    # Today's date for logging
    today_date = today.date()
    
    # Separate records into cached and need-to-fetch
    records_to_fetch = []
    cached_records = []
    
    for rid in rids:
        if not rid or rid == "" or rid.lower() == "nan":
            continue
        
        # Ensure rid is string for comparison
        rid_str = str(rid)
            
        # Check if record exists in cache
        cached_row = df_cache[df_cache['Record Id'] == rid_str]
        
        if not cached_row.empty:
            # Use cached data
            cached_records.append(cached_row.iloc[0].to_dict())
            logged_date = cached_row.iloc[0]['logged_date']
            audited_status = cached_row.iloc[0]['audited_date']
            
            if pd.isna(audited_status):
                print(f"Using cached data for: {rid_str} (No forecast changes - logged: {logged_date})")
            else:
                print(f"Using cached data for: {rid_str} (logged: {logged_date})")
        else:
            # Not in cache, need to fetch
            records_to_fetch.append(rid_str)
            print(f"Not in cache: {rid_str}")
    
    # Fetch data for records not in cache
    new_records = []
    if records_to_fetch:
        print(f"\nFetching data for {len(records_to_fetch)} records via API...")
        
        # Get initial access token
        print("  → Authenticating with Zoho API...")
        try:
            token_data = get_access_token()
            access_token = token_data.get("access_token")
            if not access_token:
                raise RuntimeError("no access_token in token response")
            print("  ✓ Authentication successful\n")
        except Exception as e:
            print(f"  ✗ Authentication failed: {e}")
            raise RuntimeError(f"Failed to get access token: {e}")

        all_parsed_records = []
        total = len(records_to_fetch)
        
        for idx, rid in enumerate(records_to_fetch, start=1):
            print(f"\n  [{idx}/{total}] Processing Record ID: {rid}")

            # Fetch timeline with pagination
            aggregated, status = fetch_timeline_paginated(rid, access_token)
            
            # If unauthorized, refresh token and retry once
            if status == 401:
                print("    ⚠ Token expired (401), refreshing...")
                try:
                    token_data = get_access_token()
                    access_token = token_data.get("access_token")
                    print("    ✓ Token refreshed successfully")
                except Exception as e:
                    print(f"    ✗ Failed to refresh token: {e}")
                    # Save as null for failed token refresh
                    all_parsed_records.append({
                        'Record Id': rid,
                        'audited_time': pd.NaT,
                        'audited_date': pd.NaT,
                        'logged_date': today_date
                    })
                    continue
                
                aggregated, status = fetch_timeline_paginated(rid, access_token)
            
            # Check if fetch was successful
            if status != 200:
                print(f"    ✗ API request failed (HTTP {status})")
                # Save as null for API failures
                all_parsed_records.append({
                    'Record Id': rid,
                    'audited_time': pd.NaT,
                    'audited_date': pd.NaT,
                    'logged_date': today_date
                })
                continue
            
            # Parse the timeline for this record - gets NEWEST forecast change or None
            newest_record = parse_timeline_for_newest_forecast_change(rid, aggregated)
            
            if newest_record['audited_time']:
                # Convert audited_time to date only
                audited_datetime = pd.to_datetime(newest_record['audited_time'])
                audited_date_only = audited_datetime.date()
                
                print(f"    ✓ Found newest forecast change on {audited_date_only}")
                # Add to parsed records with date only
                all_parsed_records.append({
                    'Record Id': rid,
                    'audited_time': pd.NaT,
                    'audited_date': audited_date_only,
                    'logged_date': today_date
                })
            else:
                print(f"    ℹ No forecast changes found - caching as null")
                all_parsed_records.append({
                    'Record Id': rid,
                    'audited_time': pd.NaT,
                    'audited_date': pd.NaT,
                    'logged_date': today_date
                })

        # Process newly fetched records
        if all_parsed_records:
            df_new = pd.DataFrame(all_parsed_records)
            
            # Handle records with actual forecast changes
            records_with_changes = df_new[df_new['audited_time'].notna()].copy()
            records_without_changes = df_new[df_new['audited_time'].isna()].copy()
            
            if not records_with_changes.empty:
                records_with_changes['audited_time'] = pd.to_datetime(records_with_changes['audited_time'])
                records_with_changes['audited_date'] = records_with_changes['audited_time'].dt.date
                
                # Keep only the most recent record per Record Id
                records_with_changes = (
                    records_with_changes
                    .sort_values(['Record Id', 'audited_date'], ascending=[True, False])
                    .drop_duplicates(subset='Record Id', keep='first')
                    .reset_index(drop=True)
                )
                
                # Add logged_date
                records_with_changes['logged_date'] = today_date
                
                # Select final columns
                records_with_changes = records_with_changes[['Record Id', 'audited_date', 'logged_date']]
            
            # Combine records with and without changes
            if not records_with_changes.empty and not records_without_changes.empty:
                df_new = pd.concat([records_with_changes, records_without_changes[['Record Id', 'audited_date', 'logged_date']]], ignore_index=True)
            elif not records_with_changes.empty:
                df_new = records_with_changes
            else:
                df_new = records_without_changes[['Record Id', 'audited_date', 'logged_date']]
            
            new_records = df_new.to_dict('records')
            
            # Save to MongoDB cache
            await save_cache_to_db(db, new_records)

    # Combine cached and new records
    all_records = cached_records + new_records
    
    if all_records:
        df_result = pd.DataFrame(all_records)
        
        print(f"\nTotal records processed: {len(df_result)}")
        
        # Count records with forecast changes vs null
        records_with_changes = df_result[df_result['audited_date'].notna()]
        records_without_changes = df_result[df_result['audited_date'].isna()]
        
        print(f"Records with Forecast Category changes: {len(records_with_changes)}")
        print(f"Records with no forecast changes (null): {len(records_without_changes)}")
        print(f"From cache: {len(cached_records)}, Newly fetched: {len(new_records)}")
        
        return df_result    
    else:
        print("\nNo records to process")
        return pd.DataFrame(columns=['Record Id', 'audited_date', 'logged_date'])


# TRANSFORMATION FUNCTIONS

def assign_fy_and_qtr_corrected_vectorized(date):
    """Assign fiscal year and quarter based on date (April-March cycle)."""
    if pd.isna(date):
        return pd.Series([np.nan, np.nan])
    
    # Calculate fiscal year
    if date.month >= 4:
        fy = f"FY{date.year + 1}"
    else:
        fy = f"FY{date.year}"
    
    # Assign quarter based on month
    if 4 <= date.month <= 6:
        qtr = "Q1"
    elif 7 <= date.month <= 9:
        qtr = "Q2"
    elif 10 <= date.month <= 12:
        qtr = "Q3"
    elif 1 <= date.month <= 3:
        qtr = "Q4"
    else:
        qtr = np.nan
    
    return pd.Series([fy, qtr])


def categorize_region_vectorized(value):
    if isinstance(value, str):
        if 'USA East-REC' in value or 'USA EAST-NE' in value:
            return 'USA East'
        elif 'Europe' in value:
            return 'Europe'
        elif 'ROW' in value:
            return 'Asean'
        elif 'Korea' in value:
            return 'KANZ'
    return value  # Return the original value if no condition is met or if it's not a string


def categorize_opp_category(opp_category):
    """Categorize opportunity category."""
    if isinstance(opp_category, str):
        if 'Existing' in opp_category:
            return 'Existing Business'
        elif 'NewBusiness' in opp_category:
            return 'New Business'
        elif 'Service' in opp_category or 'NRE' in opp_category or 'PPV' in opp_category:
            return 'Service'
        elif 'SmallOrder' in opp_category or 'WebOrder' in opp_category:
            return 'Samples'
        elif 'Free' in opp_category:
            return 'Free Sample'
    return 'Others'  # Return 'Others' if no condition is met or if it's not a string


def categorize_stage(row):
    """Categorize opportunity stage based on probability."""
    if row['Probability (%)'] == 100:
        return 'Closed Won'
    elif row['Probability (%)'] == 90:
        return 'Negotiation'
    elif row['Probability (%)'] == 70:
        return 'Quotation'
    elif row['Probability (%)'] == 30:
        return 'Others'
    else:
        return 'Closed Lost'
    
    
def categorize_MarketArea_category(opp_category):
    """Categorize market area."""
    if isinstance(opp_category, str):
        if 'Industrial' in opp_category:
            return 'BU-Industrial'
        elif 'Medical' in opp_category:
            return 'Medical BU'
        elif 'Retail' in opp_category:
            return 'Retail BU'
    return 'Others'  # Return 'Others' if no condition is met or if it's not a string


def compute_granular_QTR(row):
    """Compute granular quarter with special logic for April 1 closings."""
    cd = row.get('Closing Date')
    if pd.isna(cd):
        return row.get('closing date QTR')
    
    # April 1 closings always belong to QP4 (last pre-period quarter)
    if cd.month == 4 and cd.day == 1:
        return 'QP4'
    
    return row.get('closing date QTR')


def fill_audited_date(row):
    """
    Fill audited_date based on hierarchical priority.
    
    CORRECTED PRIORITY HIERARCHY:
    1. Existing audited_date (if available, use it - HIGHEST PRIORITY)
    2. If audited_date is NULL:
       a. If Probability = 100%, use Closing Date
       b. If Probability < 100%, use highest available PO Expected Date (5 > 4 > 3 > 2 > 1)
    3. If no dates available, return NaT
    """
    # LEVEL 1: Check if audited_date already exists
    if pd.notna(row['audited_date']):
        return row['audited_date']  # ✅ Use existing audited_date (no further checks needed)
    
    # LEVEL 2: audited_date is NULL - now check Probability
    # If Probability is 100%, use Closing Date
    if row['Probability (%)'] == 100:
        return row['Closing Date']
    
    # LEVEL 3-7: Probability < 100% - check PO Expected Dates in descending order
    # Priority: 5 > 4 > 3 > 2 > 1
    for date_col in ['PO Expected Date5', 'PO Expected Date4', 'PO Expected Date3', 
                     'PO Expected Date2', 'PO Expected Date1']:
        if pd.notna(row[date_col]):
            # Convert to datetime if it's a string
            if isinstance(row[date_col], str):
                try:
                    return pd.to_datetime(row[date_col])
                except:
                    continue  # Skip if conversion fails, try next date
            else:
                return row[date_col]
    
    # LEVEL 8: No dates available - return NaT
    return pd.NaT


async def transform_weekly_data(df, week, upload_date, db):
    """
    Main transformation function - processes CSV data through all 10 steps.
    
    Parameters:
    - df: DataFrame loaded from CSV
    - week: Week number
    - upload_date: Upload date string (DD-MM-YYYY)
    - db: MongoDB database instance
    
    Returns:
    - Aggregated DataFrame ready for database insertion
    """
    print("=" * 70)
    print("STARTING DATA TRANSFORMATION PIPELINE")
    print("=" * 70)
    
    # STEP 1: Basic Data Cleaning
    print("\n[STEP 1/9] Basic data cleaning...")
    print(f"  → Initial CSV: {len(df)} rows, {len(df.columns)} columns")
    dataset = df.copy()
    dataset['Closing Date'] = pd.to_datetime(dataset['Closing Date'], errors='coerce', format='%b %d, %Y')
    dataset["Order  Date"] = pd.to_datetime(dataset["Order  Date"], errors='coerce', format='%b %d, %Y')
    dataset = dataset[dataset["Closing Date"] >= "2025-04-01"]
    dataset = dataset[dataset["Stage"] != "Closed Lost"]
    today = pd.to_datetime(datetime.today().strftime('%Y-%m-%d'))
    print(f"  ✓ After filtering: {len(dataset)} records (removed {len(df) - len(dataset)} records)")
    
    # STEP 2: Fetch Zoho Forecast Changes (with MongoDB caching)
    print("\n[STEP 2/9] Fetching Zoho forecast timeline data...")
    # Only fetch for April 1 Closed Won deals (FY2027 & FY2028 as per business logic)
    dataset_test_fys = dataset[dataset['Closing Date'].isin(['2026-04-01', '2027-04-01'])]
    dataset_test_fys = dataset_test_fys[dataset_test_fys["Stage"] == "Closed Won"]
    dataset_records_split = dataset_test_fys["Record Id"].str.split("_").str[1]
    dataset_records_split = dataset_records_split.drop_duplicates()
    
    record_ids = dataset_records_split.dropna().tolist()
    print(f"  → Processing {len(record_ids)} unique Record IDs (April 1 FY2027/FY2028 Closed Won)...")
    df_forecast_changes = await fetch_and_process_forecast_changes(record_ids, db, today)
    df_forecast_changes['Record Id'] = 'zcrm_' + df_forecast_changes['Record Id']
    print(f"  ✓ Forecast data ready: {len(df_forecast_changes)} records")
    
    # STEP 3: Merge Forecast Data
    print("\n[STEP 3/9] Merging forecast data...")
    df_forecast_changes_for_merging = df_forecast_changes[['Record Id', 'audited_date']].copy()
    df_merged = pd.merge(dataset, df_forecast_changes_for_merging, on='Record Id', how='left')
    print(f"  ✓ Merged dataset: {len(df_merged)} records")
    
    # STEP 4: Backfill Audited Date
    print("\n[STEP 4/9] Backfilling audited dates...")
    print(f"  → Applying backfill logic to {len(df_merged)} records...")
    df_merged['audited_date'] = df_merged.apply(fill_audited_date, axis=1)
    df_merged['audited_date'] = pd.to_datetime(df_merged['audited_date'], errors='coerce')
    df_merged = df_merged.rename(columns={'audited_date': 'nClosing Date'})
    dataset = df_merged
    print(f"  ✓ Backfilled {dataset['nClosing Date'].notna().sum()} audited dates")
    
    # STEP 5: Apply Transformation Functions
    print("\n[STEP 5/9] Applying transformation functions...")
    print("  → Assigning fiscal year & quarters...")
    dataset[['closing date Fy', 'closing date QTR']] = dataset['Closing Date'].apply(assign_fy_and_qtr_corrected_vectorized)
    print("  → Categorizing regions...")
    dataset['nRegion'] = dataset['econ-Region'].apply(categorize_region_vectorized)
    print("  → Categorizing opportunity types...")
    dataset['OPP_Type'] = dataset['OPP Category'].apply(categorize_opp_category)
    print("  → Categorizing stages...")
    dataset['n-Stage'] = dataset.apply(categorize_stage, axis=1)
    print("  → Computing granular quarters...")
    dataset['granular_QTR'] = dataset.apply(compute_granular_QTR, axis=1)
    
    current_date = datetime.now()
    current_fy, _ = assign_fy_and_qtr_corrected_vectorized(current_date)
    print(f"  ✓ All transformations applied (Current FY: {current_fy})")
    
    # STEP 6: Calculate Metrics
    print("\n[STEP 6/9] Calculating metrics...")
    print("  → Calculating weighted amounts...")
    dataset['Weighted Amount'] = dataset['Amount'] * (dataset['Probability (%)'] / 100)
    print("  → Calculating stage-specific amounts...")
    dataset['Amount - unInvoiced'] = dataset.apply(lambda row: max(row['Amount'] - row['Total Invoiced'], 0) if row['n-Stage'] == 'Closed Won' else 0, axis=1)
    dataset['Amount - Invoiced'] = dataset['Total Invoiced']
    dataset['Amount - Negotiation'] = dataset.apply(lambda row: max(row['Amount'] - row['Total Invoiced'], 0) if row['n-Stage'] == 'Negotiation' else 0, axis=1)
    dataset['Amount - Quotation'] = dataset.apply(lambda row: max(row['Amount'] - row['Total Invoiced'], 0) if row['n-Stage'] == 'Quotation' else 0, axis=1)
    dataset['Amount - Others'] = dataset.apply(lambda row: max(row['Amount'] - row['Total Invoiced'], 0) if row['n-Stage'] == 'Others' else 0, axis=1)
    
    # Projection calculations
    print("  → Calculating projections...")
    current_fy_year = int(current_fy[2:])
    fiscal_years = [f"FY{year}" for year in range(current_fy_year, 2061)]
    dataset['projection'] = dataset.apply(lambda row: row['Amount'] if row['closing date Fy'] in fiscal_years else 0, axis=1)
    dataset['projection - category'] = dataset.apply(lambda row: 'Closed Won' if row['n-Stage'] == 'Closed Won' else ('Closed Lost' if row['n-Stage'] == 'Closed Lost' else 'Pipeline'), axis=1)
    print(f"  ✓ All metrics calculated")
    
    # STEP 7: Filter Required Columns
    print("\n[STEP 7/9] Filtering required columns...")
    dataset_filtered = dataset[['Record Id', 'Account Name (Account Name)', 'Account Owner', 'Stage', 'Closing Date', 'closing date Fy',
           'closing date QTR', 'PO Expected Date1', 'PO Expected Date2', 'PO Expected Date3',
           'PO Expected Date4', 'PO Expected Date5', 
            'Amount', 'econ-Region', 'Expected Revenue', 'Total Invoiced', 'Invoice Date', 'Opportunities Owner', 'nRegion',
           'OPP_Type', 'n-Stage', 'Weighted Amount', 'Amount - unInvoiced',
           'Amount - Invoiced', 'Amount - Negotiation', 'Amount - Quotation',
           'Amount - Others', 'projection', 'projection - category',
           'granular_QTR']]
    print(f"  ✓ Filtered to {len(dataset_filtered.columns)} columns")
    
    # STEP 7.5: Map Region from Region_mapping_table
    print("\n[STEP 7.5/10] Mapping regions from Region_mapping_table...")
    # Fetch region mappings from MongoDB
    region_mapping_coll = db["Region_mapping_table"]
    region_mappings_cursor = region_mapping_coll.find({})
    region_mappings_list = []
    async for doc in region_mappings_cursor:
        region_mappings_list.append({
            'opportunities_owner': doc.get('opportunities_owner'),
            'region': doc.get('region')
        })
    
    # Create lookup dictionary
    region_lookup = {item['opportunities_owner']: item['region'] for item in region_mappings_list}
    print(f"  → Loaded {len(region_lookup)} region mappings from database")
    
    # Apply mapping logic to create mRegion column
    def map_region(row):
        # Hardcoded condition: Tamil Arasan's specific accounts go to Asean
        account_name = row['Account Name (Account Name)']
        owner = row['Opportunities Owner']
        
        if owner == 'Tamil Arasan' and account_name in ['JPW Industries', 'Adagrad Private Limited', 'Niqo Robotics', 'Drivebuddy']:
            return 'Asean'
        
        # Regular region mapping logic
        mapped_region = region_lookup.get(owner)
        
        # If owner not found OR region is "YET TO BE MAPPED", use nRegion
        if mapped_region is None or mapped_region == "YET TO BE MAPPED":
            return row['nRegion']
        else:
            return mapped_region
    
    dataset_filtered['mRegion'] = dataset_filtered.apply(map_region, axis=1)
    print(f"  ✓ mRegion column created with mapped values")
    
    # Log some statistics
    mapped_count = dataset_filtered['mRegion'].ne(dataset_filtered['nRegion']).sum()
    print(f"  → {mapped_count} records have mapped regions different from nRegion")
    
    # STEP 8: Filter for FY2027 and FY2028 and Aggregate
    print("\n[STEP 8/10] Filtering for target FYs and aggregating...")
    dataset_target_fys = dataset_filtered[dataset_filtered['closing date Fy'].isin(['FY2027', 'FY2028'])]
    print(f"  → Target FY records: {len(dataset_target_fys)}")
    print("  → Grouping by: FY, Quarters, Category, mRegion (mapped region), OPP_Type...")
    dataset_agg = dataset_target_fys.groupby(['closing date Fy', 'granular_QTR', 'closing date QTR', 'projection - category', 'mRegion', 'OPP_Type']).agg({'Weighted Amount': 'sum', 'Amount': 'sum'}).reset_index()
    print(f"  ✓ Aggregated to {len(dataset_agg)} distinct groups")
    
    # STEP 9: Add Metadata
    print("\n[STEP 9/10] Adding metadata...")
    dataset_agg['week'] = week
    dataset_agg['upload_date'] = upload_date
    dataset_agg['type'] = 'weekly'  # Assuming weekly type
    print(f"  ✓ Added metadata: Week {week}, Upload Date: {upload_date}, Type: weekly")
    
    # STEP 10: Compute Order Backlog
    print("\n[STEP 10/10] Computing Order Backlog...")
    # Order backlog is the sum of Amount - unInvoiced for Closed Won deals
    # Group by closing date FY to track which year the backlog originated from
    backlog_df = dataset_filtered[dataset_filtered['n-Stage'] == 'Closed Won'].groupby(['mRegion', 'OPP_Type', 'closing date Fy']).agg({'Amount - unInvoiced': 'sum'}).reset_index()
    backlog_df['week'] = week
    backlog_df['upload_date'] = upload_date
    backlog_df['type'] = 'weekly'
    print(f"  ✓ Computed Order Backlog for {len(backlog_df)} regions (breakdown by FY origin)")

    print("\n" + "=" * 70)
    print("TRANSFORMATION PIPELINE COMPLETE")
    print(f"Final dataset: {len(dataset_agg)} aggregated records ready for database")
    print("=" * 70 + "\n")
    
    return dataset_agg, backlog_df


# ====================================================================
# GROSS MARGIN TRANSFORMATION
# ====================================================================

GROSS_MARGIN_REQUIRED_COLUMNS = [
    "Account Name",
    "Department",
    "Arrived Region",
    "Revenue",
    "Gross Margin",
    "Sheet Type",
]


def _safe_pct(numerator: float, denominator: float) -> float:
    """Compute percentage, returning 0.0 when denominator is zero."""
    if denominator == 0:
        return 0.0
    return round((numerator / denominator) * 100, 2)


def _normalize_numeric_series(series: pd.Series) -> pd.Series:
    """
    Normalize numeric text values before conversion.

    Handles inputs such as:
      - 36,528,022
      - $36,528,022.00
      - (1,250,000)
      - values with stray whitespace
    """
    normalized = (
        series.astype(str)
        .str.strip()
        .replace({"": "0", "nan": "0", "None": "0", "null": "0"})
        .str.replace(",", "", regex=False)
        .str.replace("$", "", regex=False)
        .str.replace("(", "-", regex=False)
        .str.replace(")", "", regex=False)
    )
    return pd.to_numeric(normalized, errors="coerce").fillna(0.0)


def _compute_summary_metrics(df_slice: pd.DataFrame) -> dict:
    """
    Given a pre-filtered DataFrame (already Sheet Type == 'Current_year'),
    compute revenue, gross margin, and department breakdowns with percentages.
    """
    revenue = float(df_slice["Revenue"].sum())
    gross_margin = float(df_slice["Gross Margin"].sum())

    mfg = df_slice[df_slice["Department"] == "Manufacturing"]
    manufacturing_revenue = float(mfg["Revenue"].sum())
    manufacturing_gross_margin = float(mfg["Gross Margin"].sum())

    svc = df_slice[df_slice["Department"] == "Services"]
    services_revenue = float(svc["Revenue"].sum())
    services_gross_margin = float(svc["Gross Margin"].sum())

    return {
        "revenue": revenue,
        "gross_margin": gross_margin,
        "gross_margin_pct": _safe_pct(gross_margin, revenue),
        "manufacturing_revenue": manufacturing_revenue,
        "manufacturing_gross_margin": manufacturing_gross_margin,
        "manufacturing_gross_margin_pct": _safe_pct(manufacturing_gross_margin, manufacturing_revenue),
        "services_revenue": services_revenue,
        "services_gross_margin": services_gross_margin,
        "services_gross_margin_pct": _safe_pct(services_gross_margin, services_revenue),
    }


def transform_gross_margin_data(
    df: pd.DataFrame, week: int, file_date: str
) -> list[dict]:
    """
    Transform a Gross Margin CSV into documents ready for MongoDB insertion.

    Returns a list of dicts:
      - 1 document with category='overall_summary'
      - N documents with category='overall_summary_region' (one per Arrived Region)
    """
    print("\n" + "=" * 70)
    print("GROSS MARGIN TRANSFORMATION PIPELINE")
    print("=" * 70)

    # ── Validate columns ──────────────────────────────────────────────
    missing = [c for c in GROSS_MARGIN_REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # ── Coerce numeric columns ────────────────────────────────────────
    df["Revenue"] = _normalize_numeric_series(df["Revenue"])
    df["Gross Margin"] = _normalize_numeric_series(df["Gross Margin"])

    # ── Filter Current_year rows only ─────────────────────────────────
    cy = df[df["Sheet Type"] == "Current_year"].copy()
    print(f"  → Total rows: {len(df)}, Current_year rows: {len(cy)}")

    if len(cy) == 0:
        raise ValueError("No rows with Sheet Type == 'Current_year' found in CSV.")

    now = datetime.now()
    base_meta = {
        "date": file_date,
        "upload_week": week,
        "type": "gross_margin",
        "created_at": now,
    }

    documents: list[dict] = []

    # ── 1) Overall Summary ────────────────────────────────────────────
    print("\n[STEP 1] Computing overall summary...")
    overall = _compute_summary_metrics(cy)
    overall["category"] = "overall_summary"
    overall.update(base_meta)
    documents.append(overall)
    print(f"  ✓ Overall: Revenue={overall['revenue']}, GM={overall['gross_margin']}, GM%={overall['gross_margin_pct']}")

    # ── 2) Overall Summary by Region ──────────────────────────────────
    print("\n[STEP 2] Computing per-region summaries...")
    regions = cy["Arrived Region"].dropna().unique()
    for region in sorted(regions):
        region_slice = cy[cy["Arrived Region"] == region]
        metrics = _compute_summary_metrics(region_slice)
        metrics["category"] = "overall_summary_region"
        metrics["arrived_region"] = str(region)
        metrics.update(base_meta)
        documents.append(metrics)
        print(f"  ✓ Region '{region}': Revenue={metrics['revenue']}, GM={metrics['gross_margin']}, GM%={metrics['gross_margin_pct']}")

    # ── 3) Per-Account Manufacturing Records ──────────────────────────
    print("\n[STEP 3] Computing per-account manufacturing records...")
    mfg = cy[cy["Department"] == "Manufacturing"].copy()
    if len(mfg) > 0:
        acct_agg = (
            mfg.groupby(["Arrived Region", "Account Name"], as_index=False)
            .agg({"Revenue": "sum", "Gross Margin": "sum"})
        )
        acct_agg["gross_margin_pct"] = acct_agg.apply(
            lambda r: _safe_pct(r["Gross Margin"], r["Revenue"]), axis=1
        )

        def _assign_gm_category(pct: float) -> str:
            if pct < 25:
                return "<25%"
            elif pct < 45:
                return "25 - 45%"
            elif pct < 60:
                return "45 - 60%"
            else:
                return ">60%"

        acct_agg["gm_category"] = acct_agg["gross_margin_pct"].apply(_assign_gm_category)

        acct_count = 0
        for _, row in acct_agg.iterrows():
            doc = {
                "category": "region_manufacturing_account",
                "arrived_region": str(row["Arrived Region"]),
                "account_name": str(row["Account Name"]),
                "revenue": float(row["Revenue"]),
                "gross_margin": float(row["Gross Margin"]),
                "gross_margin_pct": float(row["gross_margin_pct"]),
                "gm_category": row["gm_category"],
            }
            doc.update(base_meta)
            documents.append(doc)
            acct_count += 1
        print(f"  ✓ Generated {acct_count} per-account manufacturing records")

        # ── 4) Per-Category Manufacturing Summaries ───────────────────
        print("\n[STEP 4] Computing per-category manufacturing summaries...")
        cat_agg = (
            acct_agg.groupby(["Arrived Region", "gm_category"], as_index=False)
            .agg(
                revenue=("Revenue", "sum"),
                gross_margin=("Gross Margin", "sum"),
                account_count=("Account Name", "count"),
            )
        )
        cat_agg["gross_margin_pct"] = cat_agg.apply(
            lambda r: _safe_pct(r["gross_margin"], r["revenue"]), axis=1
        )

        cat_count = 0
        for _, row in cat_agg.iterrows():
            doc = {
                "category": "region_manufacturing_category_summary",
                "arrived_region": str(row["Arrived Region"]),
                "gm_category": str(row["gm_category"]),
                "revenue": float(row["revenue"]),
                "gross_margin": float(row["gross_margin"]),
                "gross_margin_pct": float(row["gross_margin_pct"]),
                "account_count": int(row["account_count"]),
            }
            doc.update(base_meta)
            documents.append(doc)
            cat_count += 1
        print(f"  ✓ Generated {cat_count} per-category manufacturing summary records")
    else:
        print("  ⚠ No Manufacturing rows found — skipping Steps 3 & 4")

    # ── 5) Per-Account Services Records ───────────────────────────────
    print("\n[STEP 5] Computing per-account services records...")
    svc = df[df["Sheet Type"] == "Service_from_Start"].copy()
    if len(svc) > 0:
        svc_acct_agg = (
            svc.groupby(["Arrived Region", "Account Name"], as_index=False)
            .agg({"Revenue": "sum", "Gross Margin": "sum"})
        )
        svc_acct_agg["gross_margin_pct"] = svc_acct_agg.apply(
            lambda r: _safe_pct(r["Gross Margin"], r["Revenue"]), axis=1
        )

        def _assign_gm_category_svc(pct: float) -> str:
            if pct < 25:
                return "<25%"
            elif pct < 45:
                return "25 - 45%"
            elif pct < 60:
                return "45 - 60%"
            else:
                return ">60%"

        svc_acct_agg["gm_category"] = svc_acct_agg["gross_margin_pct"].apply(_assign_gm_category_svc)

        svc_acct_count = 0
        for _, row in svc_acct_agg.iterrows():
            doc = {
                "category": "region_services_account",
                "arrived_region": str(row["Arrived Region"]),
                "account_name": str(row["Account Name"]),
                "revenue": float(row["Revenue"]),
                "gross_margin": float(row["Gross Margin"]),
                "gross_margin_pct": float(row["gross_margin_pct"]),
                "gm_category": row["gm_category"],
            }
            doc.update(base_meta)
            documents.append(doc)
            svc_acct_count += 1
        print(f"  ✓ Generated {svc_acct_count} per-account services records")

        # ── 6) Per-Category Services Summaries ────────────────────────
        print("\n[STEP 6] Computing per-category services summaries...")
        svc_cat_agg = (
            svc_acct_agg.groupby(["Arrived Region", "gm_category"], as_index=False)
            .agg(
                revenue=("Revenue", "sum"),
                gross_margin=("Gross Margin", "sum"),
                account_count=("Account Name", "count"),
            )
        )
        svc_cat_agg["gross_margin_pct"] = svc_cat_agg.apply(
            lambda r: _safe_pct(r["gross_margin"], r["revenue"]), axis=1
        )

        svc_cat_count = 0
        for _, row in svc_cat_agg.iterrows():
            doc = {
                "category": "region_services_category_summary",
                "arrived_region": str(row["Arrived Region"]),
                "gm_category": str(row["gm_category"]),
                "revenue": float(row["revenue"]),
                "gross_margin": float(row["gross_margin"]),
                "gross_margin_pct": float(row["gross_margin_pct"]),
                "account_count": int(row["account_count"]),
            }
            doc.update(base_meta)
            documents.append(doc)
            svc_cat_count += 1
        print(f"  ✓ Generated {svc_cat_count} per-category services summary records")
    else:
        print("  ⚠ No Service_from_Start rows found — skipping Steps 5 & 6")

    # ── 7) Per-Account Services Current Year Records ───────────────────
    print("\n[STEP 7] Computing per-account services current year records...")
    svc_cy = cy[cy["Department"] == "Services"].copy()
    if len(svc_cy) > 0:
        svc_cy_acct_agg = (
            svc_cy.groupby(["Arrived Region", "Account Name"], as_index=False)
            .agg({"Revenue": "sum", "Gross Margin": "sum"})
        )
        svc_cy_acct_agg["gross_margin_pct"] = svc_cy_acct_agg.apply(
            lambda r: _safe_pct(r["Gross Margin"], r["Revenue"]), axis=1
        )

        svc_cy_acct_agg["gm_category"] = svc_cy_acct_agg["gross_margin_pct"].apply(_assign_gm_category)

        svc_cy_acct_count = 0
        for _, row in svc_cy_acct_agg.iterrows():
            doc = {
                "category": "region_services_cy_account",
                "arrived_region": str(row["Arrived Region"]),
                "account_name": str(row["Account Name"]),
                "revenue": float(row["Revenue"]),
                "gross_margin": float(row["Gross Margin"]),
                "gross_margin_pct": float(row["gross_margin_pct"]),
                "gm_category": row["gm_category"],
            }
            doc.update(base_meta)
            documents.append(doc)
            svc_cy_acct_count += 1
        print(f"  ✓ Generated {svc_cy_acct_count} per-account services current year records")

        # ── 8) Per-Category Services Current Year Summaries ───────────────
        print("\n[STEP 8] Computing per-category services current year summaries...")
        svc_cy_cat_agg = (
            svc_cy_acct_agg.groupby(["Arrived Region", "gm_category"], as_index=False)
            .agg(
                revenue=("Revenue", "sum"),
                gross_margin=("Gross Margin", "sum"),
                account_count=("Account Name", "count"),
            )
        )
        svc_cy_cat_agg["gross_margin_pct"] = svc_cy_cat_agg.apply(
            lambda r: _safe_pct(r["gross_margin"], r["revenue"]), axis=1
        )

        svc_cy_cat_count = 0
        for _, row in svc_cy_cat_agg.iterrows():
            doc = {
                "category": "region_services_cy_category_summary",
                "arrived_region": str(row["Arrived Region"]),
                "gm_category": str(row["gm_category"]),
                "revenue": float(row["revenue"]),
                "gross_margin": float(row["gross_margin"]),
                "gross_margin_pct": float(row["gross_margin_pct"]),
                "account_count": int(row["account_count"]),
            }
            doc.update(base_meta)
            documents.append(doc)
            svc_cy_cat_count += 1
        print(f"  ✓ Generated {svc_cy_cat_count} per-category services current year summary records")
    else:
        print("  ⚠ No Current_year Services rows found — skipping Steps 7 & 8")

    print(f"\n  → Total documents: {len(documents)}")
    print("=" * 70)
    print("GROSS MARGIN TRANSFORMATION COMPLETE")
    print("=" * 70 + "\n")

    return documents


# ====================================================================
# SERVICES Q1 SNAPSHOT TRANSFORMATION
# ====================================================================

SERVICES_TIMELINE_REQUIRED_COLUMNS = [
    "record_id",
    "audited_time",
    "Forecast_Category__s_old",
    "Forecast_Category__s_new",
    "Expected_Revenue_new",
]

SERVICES_OPP_REQUIRED_COLUMNS = [
    "record_id",
    "closing_date_final",
    "probability_percentage_final",
    "econ-Region",
    "amount_final",
]

SERVICES_ANALYSIS_FY = ["FY2024", "FY2025", "FY2026", "FY2027", "FY2028"]


def get_fiscal_year(date_series: pd.Series) -> pd.Series:
    year = date_series.dt.year
    month = date_series.dt.month
    fy_year = np.where(month >= 4, year + 1, year)
    return pd.Series(
        [f"FY{int(y)}" if not np.isnan(y) else np.nan for y in fy_year],
        index=date_series.index,
    )


def get_fiscal_quarter(date_series: pd.Series) -> pd.Series:
    month = date_series.dt.month
    qtr = pd.Series(pd.NA, index=date_series.index, dtype="string")
    qtr.loc[month.between(4, 6)] = "Q1"
    qtr.loc[month.between(7, 9)] = "Q2"
    qtr.loc[month.between(10, 12)] = "Q3"
    qtr.loc[month.between(1, 3)] = "Q4"
    return qtr


def clean_services_region(region):
    if pd.isna(region):
        return "Unknown"
    region_str = str(region).upper()
    if "EAST" in region_str:
        return "USA East"
    if "WEST" in region_str:
        return "USA West"
    if "CENTRAL" in region_str or "MIDWEST" in region_str:
        return "USA Central"
    if "SOUTH" in region_str:
        return "USA South"
    if "ASEAN" in region_str:
        return "Asean"
    if "EUROPE" in region_str:
        return "Europe"
    if "JAPAN" in region_str:
        return "Japan"
    if "KANZ" in region_str:
        return "KANZ"
    if "LEGACY" in region_str:
        return "Legacy"
    return str(region)


def get_fy_week1_date(fy_string: str) -> pd.Timestamp:
    fy_year = int(str(fy_string).replace("FY", ""))
    april_first = pd.to_datetime(f"{fy_year - 1}-04-01")

    week1_date = april_first
    while week1_date.dayofweek != 2:
        week1_date += pd.Timedelta(days=1)

    return week1_date


def _validate_services_columns(df: pd.DataFrame, required_columns: list[str], label: str) -> None:
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"{label} CSV is missing required columns: {missing}")


def _normalize_services_record_id(series: pd.Series) -> pd.Series:
    normalized = series.astype(str).str.strip()
    return np.where(normalized.str.startswith("zcrm_"), normalized, "zcrm_" + normalized)


def transform_services_q1_snapshot_data(
    timeline_df: pd.DataFrame,
    opp_df: pd.DataFrame,
    week: int,
    file_date: str,
    timeline_file_name: str,
    opp_file_name: str,
    current_fy_pipeline_map: dict[str, float] | None = None,
    curr_fy_str: str | None = None,
) -> list[dict]:
    """
    Transform the uploaded Services timeline + closed-won opportunity CSVs into
    Q1 cumulative snapshot documents ready for MongoDB.
    """
    print("\n" + "=" * 70)
    print("SERVICES Q1 SNAPSHOT TRANSFORMATION PIPELINE")
    print("=" * 70)

    _validate_services_columns(timeline_df, SERVICES_TIMELINE_REQUIRED_COLUMNS, "Timeline")
    _validate_services_columns(opp_df, SERVICES_OPP_REQUIRED_COLUMNS, "Opportunity")

    opp = opp_df.copy()
    df_audit = timeline_df.copy()

    opp["closing_date_final"] = pd.to_datetime(opp["closing_date_final"], errors="coerce")
    if "First_created_time" in opp.columns:
        opp["First_created_time"] = pd.to_datetime(opp["First_created_time"], format="mixed", errors="coerce")
        if getattr(opp["First_created_time"].dt, "tz", None) is not None:
            opp["First_created_time"] = opp["First_created_time"].dt.tz_localize(None)
    else:
        opp["First_created_time"] = pd.NaT

    df_audit["record_id"] = _normalize_services_record_id(df_audit["record_id"])
    opp["record_id"] = _normalize_services_record_id(opp["record_id"])

    df_audit["audited_time"] = pd.to_datetime(df_audit["audited_time"], format="mixed", errors="coerce")
    if getattr(df_audit["audited_time"].dt, "tz", None) is not None:
        df_audit["audited_time"] = df_audit["audited_time"].dt.tz_localize(None)

    opp["FY"] = get_fiscal_year(opp["closing_date_final"])
    opp["FY_QTR"] = get_fiscal_quarter(opp["closing_date_final"])

    clean_opp_df = opp[opp["FY"].isin(SERVICES_ANALYSIS_FY)].copy()
    clean_opp_df["is_won"] = clean_opp_df["probability_percentage_final"] == 100
    clean_opp_df["is_lost"] = clean_opp_df["probability_percentage_final"] == 0
    clean_opp_df["is_closed"] = clean_opp_df["is_won"] | clean_opp_df["is_lost"]

    clean_audit_df = df_audit[df_audit["record_id"].isin(clean_opp_df["record_id"])].copy()
    clean_audit_df_sorted = clean_audit_df.sort_values(["record_id", "audited_time"]).copy()

    pipeline_to_closed = clean_audit_df_sorted[
        (clean_audit_df_sorted["Forecast_Category__s_old"] == "Pipeline")
        & (clean_audit_df_sorted["Forecast_Category__s_new"] == "Closed")
    ].copy()
    pipeline_to_closed["type"] = "pipe_PO"

    closed_to_empty = clean_audit_df_sorted[
        (clean_audit_df_sorted["Forecast_Category__s_old"] == "Closed")
        & (clean_audit_df_sorted["Forecast_Category__s_new"].isna())
    ].copy()
    closed_to_empty["type"] = "just_closed"

    combined_transitions = pd.concat([pipeline_to_closed, closed_to_empty], ignore_index=True)
    first_transition_per_deal = combined_transitions.groupby("record_id").first().reset_index()

    all_record_ids = pd.DataFrame({"record_id": clean_audit_df_sorted["record_id"].unique()})
    pipeline_closed_tracking = all_record_ids.merge(
        first_transition_per_deal[["record_id", "audited_time", "Expected_Revenue_new", "type"]],
        on="record_id",
        how="left",
    )
    pipeline_closed_tracking["type"] = pipeline_closed_tracking["type"].fillna("NA")

    tracking_merged = pipeline_closed_tracking.merge(clean_opp_df, on="record_id", how="left", indicator=True)
    tracking_merged_both = tracking_merged[tracking_merged["_merge"] == "both"].copy()

    if tracking_merged_both.empty:
        raise ValueError("No matching opportunity records found between timeline and opportunity CSVs.")

    final_df = tracking_merged_both[[
        "record_id",
        "audited_time",
        "Expected_Revenue_new",
        "econ-Region",
        "type",
        "closing_date_final",
        "First_created_time",
        "amount_final",
        "FY",
    ]].copy()

    final_df["clean_audit_time"] = np.where(
        final_df["type"] == "NA",
        final_df["closing_date_final"],
        final_df["audited_time"],
    )
    final_df["Expected_Revenue_new_cleaned"] = pd.to_numeric(
        final_df["Expected_Revenue_new"].astype(str).str.replace(r"[$,\s]", "", regex=True),
        errors="coerce",
    )
    final_df["amount_final"] = _normalize_numeric_series(final_df["amount_final"])
    final_df["clean_amount"] = np.where(
        final_df["type"] == "NA",
        final_df["amount_final"],
        final_df["Expected_Revenue_new_cleaned"],
    )
    final_df["clean_amount"] = pd.to_numeric(final_df["clean_amount"], errors="coerce").fillna(0.0)
    final_df["clean_audit_time"] = pd.to_datetime(final_df["clean_audit_time"], errors="coerce")
    final_df["First_created_time"] = pd.to_datetime(final_df["First_created_time"], errors="coerce")
    final_df = final_df.dropna(subset=["clean_audit_time", "FY"])
    final_df["region_clean"] = final_df["econ-Region"].apply(clean_services_region)

    if final_df.empty:
        raise ValueError("No valid Services Q1 snapshot rows after date and fiscal-year cleanup.")

    start_date = pd.to_datetime("2025-04-01")
    data_end_date = final_df["clean_audit_time"].max()
    if pd.isna(data_end_date) or data_end_date < start_date:
        raise ValueError("Uploaded Services data does not contain snapshot dates from Apr 2025 onward.")

    upload_end_date = pd.to_datetime(file_date, dayfirst=True, errors="coerce")
    today = pd.to_datetime(datetime.now().date())
    end_date_candidates = [data_end_date, today]
    if not pd.isna(upload_end_date):
        end_date_candidates.append(upload_end_date)
    end_date = max(end_date_candidates)

    first_wednesday = start_date
    while first_wednesday.dayofweek != 2:
        first_wednesday += pd.Timedelta(days=1)

    wednesdays = pd.date_range(start=first_wednesday, end=end_date, freq="W-WED")
    fiscal_years_in_data = final_df["FY"].dropna().unique()
    fy_start_dates = {fy: get_fy_week1_date(fy) for fy in fiscal_years_in_data}
    now = datetime.now()
    documents: list[dict] = []

    def append_snapshot_documents(scope: str, region_filter: str | None = None) -> None:
        snapshot_source = final_df if region_filter is None else final_df[final_df["region_clean"] == region_filter]
        if snapshot_source.empty:
            return

        for snapshot_date in wednesdays:
            snapshot_df = snapshot_source[snapshot_source["clean_audit_time"] <= snapshot_date].copy()
            fy_totals = snapshot_df.groupby("FY")["clean_amount"].sum()
            pipeline_df = snapshot_source[
                (snapshot_source["clean_audit_time"] > snapshot_date)
                & (snapshot_source["First_created_time"] <= snapshot_date)
            ].copy()
            fy_pipeline_totals = pipeline_df.groupby("FY")["clean_amount"].sum()

            snapshot_fys = sorted(set(fy_totals.index).union(set(fy_pipeline_totals.index)))
            for fy in snapshot_fys:
                if fy not in fy_start_dates:
                    continue
                total = float(fy_totals.get(fy, 0.0))

                if fy == curr_fy_str and current_fy_pipeline_map is not None:
                    pipeline_total = float(current_fy_pipeline_map.get(region_filter or "Overall", 0.0))
                else:
                    pipeline_total = float(fy_pipeline_totals.get(fy, 0.0))

                weeks_since_start = (snapshot_date - fy_start_dates[fy]).days // 7
                if 0 <= weeks_since_start <= 52 and (total > 0 or pipeline_total > 0):
                    calendar_week_number = int(snapshot_date.isocalendar().week)
                    documents.append({
                        "upload_week": week,
                        "file_date": file_date,
                        "type": "services_trend",
                        "category": "q1_snapshot",
                        "scope": scope,
                        "region": region_filter or "Overall",
                        "fiscal_year": str(fy),
                        "week_number": calendar_week_number,
                        "calendar_week_number": calendar_week_number,
                        "fiscal_week_number": int(weeks_since_start),
                        "total_amount": float(total),
                        "pipeline_amount": float(pipeline_total),
                        "snapshot_date": snapshot_date.to_pydatetime(),
                        "timeline_file_name": timeline_file_name,
                        "opp_file_name": opp_file_name,
                        "created_at": now,
                    })

    append_snapshot_documents("Overall")
    for region in sorted([r for r in final_df["region_clean"].dropna().unique() if r != "Unknown"]):
        append_snapshot_documents(str(region), str(region))

    if not documents:
        raise ValueError("Services Q1 snapshot calculation produced no chart records.")

    print(f"  ✓ Created {len(documents)} Services Q1 snapshot documents")
    return documents


async def generate_services_trend_from_weekly_df(
    df: pd.DataFrame,
    week: int,
    file_date: str,
    db,
    progress_callback=None
) -> list[dict]:
    """
    Automated Services Trend Pipeline (Code 1 + Code 2 + Code 3 + Snapshot Transformation).
    1. Extract opportunity data (opp_df) and deal record IDs (Code 1).
    2. Fetch timeline events from Zoho API for those record IDs (Code 2).
    3. Flatten and filter timeline events (Code 3).
    4. Pass timeline_df and opp_df to transform_services_q1_snapshot_data.
    5. Save snapshot documents to MongoDB collection `services_q1_snapshots`.
    """
    print("\n" + "=" * 70)
    print("AUTOMATED SERVICES TREND PIPELINE START")
    print("=" * 70)

    setup_logs = []
    def log_setup(msg):
        print(msg)
        setup_logs.append(msg)
        if progress_callback:
            progress_callback("Extracting Service Deals", "\n".join(setup_logs))

    raw_df = df.copy()

    # Find Record Id column
    col_map = {str(col).strip(): col for col in raw_df.columns}
    rec_id_col = None
    for candidate in ["Record Id", "record_id", "RecordId", "id"]:
        if candidate in col_map:
            rec_id_col = col_map[candidate]
            break

    if not rec_id_col:
        print("  ⚠️ No Record Id column found in weekly data — skipping automated Services Trend pipeline.")
        return []

    # Parse Closing Date & Determine Fiscal Year
    closing_date_col = None
    for candidate in ["Closing Date", "closing_date", "ClosingDate"]:
        if candidate in col_map:
            closing_date_col = col_map[candidate]
            break

    if closing_date_col:
        raw_df['Closing Date Parsed'] = pd.to_datetime(raw_df[closing_date_col], errors='coerce')
    else:
        raw_df['Closing Date Parsed'] = pd.NaT

    month = raw_df['Closing Date Parsed'].dt.month
    year = raw_df['Closing Date Parsed'].dt.year
    fy_year = np.where(month >= 4, year + 1, year)
    raw_df['Closing_Date_FY'] = [f"FY{int(y)}" if not np.isnan(y) else None for y in fy_year]

    # Determine Current FY and Previous FY based on file_date or today
    file_dt = pd.to_datetime(file_date, dayfirst=True, errors='coerce')
    ref_date = file_dt if not pd.isna(file_dt) else datetime.now()
    curr_fy_year = ref_date.year + 1 if ref_date.month >= 4 else ref_date.year
    curr_fy = f"FY{curr_fy_year}"
    prev_fy = f"FY{curr_fy_year - 1}"
    target_fys = [prev_fy, curr_fy]
    log_setup(f"  → Target Fiscal Years for Services Trend: {target_fys}")

    # Check if we already have previous FY snapshot data. 
    # If yes, skip the pipeline because current FY uses live weekly_tracker_data.
    coll_snapshots = db["services_q1_snapshots"]
    existing_prev_fy_docs = await coll_snapshots.count_documents({
        "type": "services_trend",
        "fiscal_year": prev_fy
    })

    if existing_prev_fy_docs > 0:
        log_setup(f"  → Found existing snapshot data for {prev_fy} ({existing_prev_fy_docs} records). Skipping Zoho API fetch since Current FY uses live weekly tracker data.")
        print("  ✓ Skipping automated Services Trend pipeline (data already exists).")
        return []

    # Filter for Service opportunities (OPP Category contains Service, NRE, or PPV)
    opp_cat_col = None
    for candidate in ["OPP Category", "opp_category", "OPP_Category", "Opp Category"]:
        if candidate in col_map:
            opp_cat_col = col_map[candidate]
            break

    if opp_cat_col:
        is_service = raw_df[opp_cat_col].astype(str).str.contains("Service|NRE|PPV", case=False, na=False)
    else:
        is_service = pd.Series(True, index=raw_df.index)

    # Filter for Target FYs
    is_target_fy = raw_df['Closing_Date_FY'].isin(target_fys)
    filtered_service_df = raw_df[is_service & is_target_fy].copy()
    log_setup(f"  → Filtered for Service deals in {target_fys}: {len(filtered_service_df)} rows out of {len(raw_df)} total")

    # Stage filter: Strictly Closed Won (excluding Closed Lost)
    stage_col = None
    for candidate in ["Stage", "stage"]:
        if candidate in col_map:
            stage_col = col_map[candidate]
            break

    if stage_col:
        is_closed_won = filtered_service_df[stage_col].astype(str).str.contains('Closed Won', case=False, na=False)
        bd_closed_won = filtered_service_df[is_closed_won].copy()
    else:
        bd_closed_won = filtered_service_df.copy()

    log_setup(f"  → Filtered for Closed Won Service deals in {target_fys}: {len(bd_closed_won)} rows out of {len(filtered_service_df)} service rows")

    # Code 1: Clean & Extract Record IDs ONLY from Closed Won Service deals
    bd_record_id_clean = bd_closed_won[[rec_id_col]].dropna()
    split_ids = bd_record_id_clean[rec_id_col].astype(str).str.split('_', expand=True)
    if split_ids.shape[1] >= 2:
        bd_record_id_clean['record_id'] = split_ids[1]
    else:
        bd_record_id_clean['record_id'] = split_ids[0]

    bd_record_id_clean['record_id'] = bd_record_id_clean['record_id'].apply(normalize_record_id)
    clean_record_ids = bd_record_id_clean['record_id'].dropna().str.strip().unique().tolist()
    clean_record_ids = [r for r in clean_record_ids if r and r.lower() not in ("none", "nan", "null")]
    log_setup(f"  ✓ Extracted {len(clean_record_ids)} unique Closed Won Service deal record IDs for {target_fys}")

    if not clean_record_ids:
        print("  ⚠️ No valid Closed Won Service record IDs found — skipping automated Services Trend pipeline.")
        return []

    # Prepare opp_df matching SERVICES_OPP_REQUIRED_COLUMNS
    opp_df = pd.DataFrame()
    opp_split_ids = bd_closed_won[rec_id_col].astype(str).str.split('_', expand=True)
    if opp_split_ids.shape[1] >= 2:
        opp_df['record_id'] = opp_split_ids[1]
    else:
        opp_df['record_id'] = opp_split_ids[0]

    opp_df['closing_date_final'] = bd_closed_won['Closing Date Parsed']
    opp_df['account_owner_final'] = bd_closed_won[col_map['Account Owner']] if 'Account Owner' in col_map else ''
    opp_df['amount_final'] = bd_closed_won[col_map['Amount']] if 'Amount' in col_map else 0
    opp_df['expected_revenue_final'] = bd_closed_won[col_map['Expected Revenue']] if 'Expected Revenue' in col_map else 0
    opp_df['probability_percentage_final'] = bd_closed_won[col_map['Probability (%)']] if 'Probability (%)' in col_map else 100
    opp_df['opportunities_owner_final'] = bd_closed_won[col_map['Opportunities Owner']] if 'Opportunities Owner' in col_map else ''
    opp_df['First_created_time'] = bd_closed_won[col_map['Created Time']] if 'Created Time' in col_map else bd_closed_won['Closing Date Parsed']
    opp_df['econ-Region'] = bd_closed_won[col_map['econ-Region']] if 'econ-Region' in col_map else 'USA East'

    opp_df = opp_df.dropna(subset=['record_id']).drop_duplicates(subset=['record_id'])
    log_setup(f"  ✓ Prepared {len(opp_df)} closed won/lost opportunity records")

    # Code 2: Fetch Timeline Events from Zoho API
    total_recs = len(clean_record_ids)
    est_total_sec = int(total_recs * 1.2)

    start_dt = datetime.now()
    est_completion_dt = start_dt + timedelta(seconds=est_total_sec)

    # Format computer times in 12-hour AM/PM format
    start_time_str = start_dt.strftime("%I:%M %p").lstrip("0")
    comp_time_str = est_completion_dt.strftime("%I:%M %p").lstrip("0")

    est_m, est_s = divmod(est_total_sec, 60)
    est_str = f"{est_m}m {est_s}s" if est_m > 0 else f"{est_s}s"

    def update_cb(step_name, msg, items_proc=None, rem_time_str=None):
        if progress_callback:
            try:
                progress_callback(
                    step_name,
                    msg,
                    start_time_str=start_time_str,
                    est_completion_time_str=comp_time_str,
                    time_remaining_str=rem_time_str or est_str,
                    items_processed=items_proc,
                    items_total=total_recs
                )
            except TypeError:
                progress_callback(step_name, msg)

    token_data = await asyncio.to_thread(get_access_token, log_setup)
    access_token = token_data.get("access_token")

    update_cb("Fetching Zoho Timelines", f"Fetching 0/{total_recs} records (1.2s/rec) | Started: {start_time_str} | Est. Completion: {comp_time_str} ({est_str} remaining)", 0, est_str)

    raw_zoho_results = []
    for idx, rid in enumerate(clean_record_ids, 1):
        if not rid or rid == "None" or rid == "nan":
            continue
        try:
            timeline_data, status_code = await asyncio.to_thread(fetch_timeline_paginated, rid, access_token)
            if status_code == 401:
                token_data = await asyncio.to_thread(get_access_token)
                access_token = token_data.get("access_token")
                timeline_data, status_code = await asyncio.to_thread(fetch_timeline_paginated, rid, access_token)

            if status_code not in (200, 201):
                print(f"  ⚠️ Timeline fetch for {rid} returned status {status_code}")

            raw_zoho_results.append({
                "record_id": rid,
                "status_code": status_code,
                "result": timeline_data
            })
        except Exception as err:
            print(f"  ⚠️ Error fetching timeline for {rid}: {err}")

        if idx % 25 == 0 or idx == total_recs or idx == 1:
            rem_sec = int((total_recs - idx) * 1.2)
            rem_m, rem_s = divmod(rem_sec, 60)
            rem_str = f"{rem_m}m {rem_s}s" if rem_m > 0 else f"{rem_s}s"
            pct = int((idx / total_recs) * 100)

            msg = f"Fetching {idx}/{total_recs} records ({pct}%) | Started: {start_time_str} | Est. Completion: {comp_time_str} ({rem_str} remaining)"
            print(f"  → Fetched timeline {idx}/{total_recs} records ({pct}%) • Est. remaining: {rem_str}")
            update_cb("Fetching Zoho Timelines", msg, idx, rem_str)

    # Code 3: Flatten Timeline Data
    if progress_callback:
        progress_callback("Flattening Timelines", "Processing and flattening timeline field changes")

    flattened_rows = []
    for record in raw_zoho_results:
        rid = record.get('record_id')
        status_code = record.get('status_code')
        results = record.get('result', [])

        if isinstance(results, dict):
            results = [results]

        for result in (results or []):
            if not isinstance(result, dict):
                continue
            timeline_events = result.get('__timeline', [])
            info = result.get('info', {})

            for event in timeline_events:
                row = {
                    'record_id': rid,
                    'status_code': status_code,
                    'event_id': event.get('id'),
                    'action': event.get('action'),
                    'source': event.get('source'),
                    'audited_time': event.get('audited_time'),
                    'automation_name': event.get('automation_details', {}).get('name') if event.get('automation_details') else None,
                }

                field_history = event.get('field_history', [])
                if field_history:
                    for field_change in field_history:
                        api_name = field_change.get('api_name', 'unknown_field')
                        field_id = field_change.get('id')
                        value_info = field_change.get('_value') or {}
                        old_value = value_info.get('old')
                        new_value = value_info.get('new')

                        row[f'{api_name}_id'] = field_id
                        row[f'{api_name}_old'] = old_value
                        row[f'{api_name}_new'] = new_value

                flattened_rows.append(row)

    if not flattened_rows:
        print("  ⚠️ No timeline events flattened — creating fallback structure.")
        timeline_df = pd.DataFrame(columns=SERVICES_TIMELINE_REQUIRED_COLUMNS)
    else:
        timeline_df = pd.DataFrame(flattened_rows)
        print(f"  ✓ Created {len(timeline_df)} flattened timeline rows")

    # Ensure required columns for transform_services_q1_snapshot_data exist
    for col in SERVICES_TIMELINE_REQUIRED_COLUMNS:
        if col not in timeline_df.columns:
            timeline_df[col] = np.nan

    # Calculate Current FY Open Weighted Pipeline from uploaded weekly tracker data
    is_curr_fy_deal = filtered_service_df['Closing_Date_FY'] == curr_fy
    prob_col = col_map.get('Probability (%)') or col_map.get('Probability')
    if prob_col:
        prob = pd.to_numeric(filtered_service_df[prob_col].astype(str).str.replace('%', ''), errors='coerce').fillna(0)
        is_open = (prob > 0) & (prob < 100)
    else:
        is_open = pd.Series(True, index=filtered_service_df.index)

    open_service_df = filtered_service_df[is_curr_fy_deal & is_open].copy()

    exp_rev_col = col_map.get('Expected Revenue') or col_map.get('expected_revenue')
    amount_col = col_map.get('Amount') or col_map.get('amount')

    if exp_rev_col:
        exp_rev = pd.to_numeric(open_service_df[exp_rev_col].astype(str).str.replace(r'[$,\s]', '', regex=True), errors='coerce').fillna(0.0)
    elif amount_col and prob_col:
        amt = pd.to_numeric(open_service_df[amount_col].astype(str).str.replace(r'[$,\s]', '', regex=True), errors='coerce').fillna(0.0)
        exp_rev = amt * (prob / 100.0)
    else:
        exp_rev = pd.Series(0.0, index=open_service_df.index)

    open_service_df['weighted_pipeline'] = exp_rev
    region_col = col_map.get('econ-Region') or col_map.get('Region')
    if region_col:
        open_service_df['region_clean'] = open_service_df[region_col].apply(clean_services_region)
    else:
        open_service_df['region_clean'] = 'USA East'

    pipeline_map = open_service_df.groupby('region_clean')['weighted_pipeline'].sum().to_dict()
    pipeline_map['Overall'] = float(open_service_df['weighted_pipeline'].sum())
    print(f"  ✓ Computed Current FY ({curr_fy}) Open Weighted Pipeline from weekly tracker: {pipeline_map}")

    # Transform to snapshot documents
    if progress_callback:
        progress_callback("Calculating Snapshots", "Computing Services Q1 cumulative snapshot analysis")

    documents = transform_services_q1_snapshot_data(
        timeline_df,
        opp_df,
        week,
        file_date,
        f"auto_timeline_w{week}.csv",
        f"auto_opp_w{week}.csv",
        current_fy_pipeline_map=pipeline_map,
        curr_fy_str=curr_fy,
    )

    # Save to MongoDB
    if documents:
        if progress_callback:
            progress_callback("Saving Snapshots", f"Saving {len(documents)} snapshot documents to MongoDB")

        coll_snapshots = db["services_q1_snapshots"]
        existing = await coll_snapshots.count_documents({"upload_week": week, "type": "services_trend"})
        if existing > 0:
            await coll_snapshots.delete_many({"upload_week": week, "type": "services_trend"})

        await coll_snapshots.insert_many(documents, ordered=False)
        print(f"  ✓ Successfully saved {len(documents)} Services Q1 snapshot records to MongoDB for week {week}")

    print("=" * 70)
    print("AUTOMATED SERVICES TREND PIPELINE COMPLETE")
    print("=" * 70 + "\n")

    return documents

