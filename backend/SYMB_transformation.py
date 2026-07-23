"""
SYMB Tracker Transformation & Automated Pipeline Module

This module handles:
1. Merging uploaded daily SYMB orders with reference collections (SO Numbers and Jabil Production List Price).
2. Calculating April-March Fiscal Years (CRD FY and CDD FY).
3. Fetching Zoho CRM timeline events for Sales_Orders via API.
4. Flattening timeline events and tracking product stage history.
5. Computing week difference, assigning flag colors (green/yellow/red/blue), and recovery stage.
6. Persisting results into MongoDB collections `symb_tracker_data` and `symb_flag_mapping`.
"""

import os
import json
import requests
import asyncio
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from dotenv import load_dotenv

load_dotenv()

# Zoho API environment variables
ZOHO_CLIENT_ID = os.getenv('ZOHO_CLIENT_ID')
ZOHO_CLIENT_SECRET = os.getenv('ZOHO_CLIENT_SECRET')
ZOHO_REFRESH_TOKEN = os.getenv('ZOHO_REFRESH_TOKEN')
ZOHO_REGION = os.getenv('ZOHO_REGION', 'com').strip()

ACCOUNTS_HOST = f"accounts.zoho.{ZOHO_REGION}"
API_HOST = f"www.zohoapis.{ZOHO_REGION}"


def normalize_record_id(raw):
    """Normalize record id values to plain string form."""
    if pd.isna(raw) or raw is None:
        return None
    s = str(raw).strip()
    if s == "" or s.lower() in ("nan", "none", "null"):
        return None
    if s.startswith('zcrm_'):
        s = s.replace('zcrm_', '')
    lower = s.lower()
    if "e" in lower or "." in s:
        try:
            v = float(s)
            iv = int(v)
            return str(iv)
        except Exception:
            return s
    return s


def get_access_token(logger=None):
    """Get fresh access token from Zoho OAuth."""
    msg1 = "  → Requesting fresh access token from Zoho OAuth..."
    if logger:
        logger(msg1)
    else:
        print(msg1)

    token_url = f"https://{ACCOUNTS_HOST}/oauth/v2/token"
    params = {
        "refresh_token": ZOHO_REFRESH_TOKEN,
        "client_id": ZOHO_CLIENT_ID,
        "client_secret": ZOHO_CLIENT_SECRET,
        "grant_type": "refresh_token",
    }
    response = requests.post(token_url, params=params, timeout=20)
    response.raise_for_status()

    msg2 = "  ✓ Access token obtained successfully"
    if logger:
        logger(msg2)
    else:
        print(msg2)

    return response.json()


def fetch_timeline_paginated(record_id: str, access_token: str, module: str = "Sales_Orders"):
    """Fetch all pages for a single record's timeline from Zoho CRM v6 / v8."""
    per_page = 100
    aggregated = []
    last_status = 200
    page_token = None

    while True:
        url = f"https://{API_HOST}/crm/v6/{module}/{record_id}/__timeline"
        headers = {"Authorization": f"Zoho-oauthtoken {access_token}", "Accept": "application/json"}
        params = {"per_page": per_page}
        if page_token:
            params["page_token"] = page_token

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            last_status = resp.status_code

            if resp.status_code == 401:
                return None, 401

            try:
                body = resp.json()
            except ValueError:
                return resp.text, resp.status_code

            if resp.status_code != 200:
                return body, last_status

            if isinstance(body, dict) and "data" in body and isinstance(body["data"], list):
                aggregated.extend(body["data"])
                info = body.get("info") or {}
                more = info.get("more_records", False)
                next_token = info.get("next_page_token") or info.get("page_token")
                if more and next_token and next_token != page_token:
                    page_token = next_token
                    continue
                break

            if isinstance(body, list):
                aggregated.extend(body)
                if len(body) < per_page:
                    break
                break

            aggregated.append(body)
            break
        except Exception as e:
            print(f"  ⚠️ Request error fetching timeline for {record_id}: {e}")
            return str(e), 500

    return aggregated, last_status


def assign_flag(row):
    """Assign flag color based on regular product stage and week difference."""
    if pd.isna(row.get('n-reg_stage')):
        return None

    diff_weeks = row.get('week_diff')
    if pd.isna(diff_weeks) or diff_weeks is None:
        return None

    stage = str(row.get('n-reg_stage', '')).strip()

    if stage == '-None-':
        return 'blue'
    elif stage == 'Order Ack':
        return 'green' if diff_weeks > 20 else 'red'
    elif stage == 'Ordering placed':
        if diff_weeks > 18:
            return 'green'
        elif diff_weeks >= 16:
            return 'yellow'
        else:
            return 'red'
    elif stage == 'Due date committed':
        if diff_weeks > 16:
            return 'green'
        elif diff_weeks >= 14:
            return 'yellow'
        else:
            return 'red'
    elif stage == '50% CTB covered':
        return 'green' if diff_weeks > 13 else 'red'
    elif stage == '75% CTB covered':
        return 'green' if diff_weeks > 12 else 'red'
    elif stage == '100% EBOM Covered':
        return 'green' if diff_weeks > 11 else 'red'
    elif stage in ('Components Secured & IQC passed', 'PCBA & Lens available', 'Mechanical /SMT Completed'):
        if diff_weeks > 9:
            return 'green'
        elif diff_weeks >= 8:
            return 'yellow'
        else:
            return 'red'
    elif stage == 'Gluing /In Production':
        if diff_weeks > 7:
            return 'green'
        elif diff_weeks >= 5:
            return 'yellow'
        else:
            return 'red'
    elif stage in ('Active Alignment Done', 'Testing and HASA completed'):
        return 'green' if diff_weeks > 5 else 'red'
    elif stage == 'Ready For Shipment':
        return 'green' if diff_weeks > 4 else 'red'
    else:
        return None


def get_recovery_stage(diff_weeks):
    """Determine recovery stage based on week difference."""
    if pd.isna(diff_weeks) or diff_weeks is None:
        return None
    if diff_weeks > 20:
        return 'Order Ack'
    elif diff_weeks > 18:
        return 'Ordering placed'
    elif diff_weeks > 16:
        return 'Due date committed'
    elif diff_weeks > 13:
        return '50% CTB covered'
    elif diff_weeks > 12:
        return '75% CTB covered'
    elif diff_weeks > 11:
        return '100% EBOM Covered'
    elif diff_weeks > 9:
        return 'Components Secured & IQC passed'
    elif diff_weeks > 7:
        return 'Gluing /In Production'
    elif diff_weeks > 5:
        return 'Active Alignment Done'
    elif diff_weeks > 4:
        return 'Ready For Shipment'
    else:
        return 'Shipped / Completed'


def generate_flag_mapping_df():
    """Build the static flag mapping rules dataframe."""
    mapping = {
        '-None-':                         {'blue': 'always', 'green': None, 'yellow': None, 'red': None},
        'Order Ack':                      {'blue': None, 'green': 'diff_weeks > 20', 'yellow': None, 'red': 'diff_weeks <= 20'},
        'Ordering placed':                {'blue': None, 'green': 'diff_weeks > 18', 'yellow': '16 <= diff_weeks <= 18', 'red': 'diff_weeks < 16'},
        'Due date committed':             {'blue': None, 'green': 'diff_weeks > 16', 'yellow': '14 <= diff_weeks <= 16', 'red': 'diff_weeks < 14'},
        '50% CTB covered':                {'blue': None, 'green': 'diff_weeks > 13', 'yellow': None, 'red': 'diff_weeks <= 13'},
        '75% CTB covered':                {'blue': None, 'green': 'diff_weeks > 12', 'yellow': None, 'red': 'diff_weeks <= 12'},
        '100% EBOM Covered':              {'blue': None, 'green': 'diff_weeks > 11', 'yellow': None, 'red': 'diff_weeks <= 11'},
        'Components Secured & IQC passed':{'blue': None, 'green': 'diff_weeks > 9', 'yellow': '8 <= diff_weeks <= 9', 'red': 'diff_weeks < 8'},
        'PCBA & Lens available':          {'blue': None, 'green': 'diff_weeks > 9', 'yellow': '8 <= diff_weeks <= 9', 'red': 'diff_weeks < 8'},
        'Mechanical /SMT Completed':      {'blue': None, 'green': 'diff_weeks > 9', 'yellow': '8 <= diff_weeks <= 9', 'red': 'diff_weeks < 8'},
        'Gluing /In Production':          {'blue': None, 'green': 'diff_weeks > 7', 'yellow': '5 <= diff_weeks <= 7', 'red': 'diff_weeks < 5'},
        'Active Alignment Done':          {'blue': None, 'green': 'diff_weeks > 5', 'yellow': None, 'red': 'diff_weeks <= 5'},
        'Testing and HASA completed':     {'blue': None, 'green': 'diff_weeks > 5', 'yellow': None, 'red': 'diff_weeks <= 5'},
        'Ready For Shipment':             {'blue': None, 'green': 'diff_weeks > 4', 'yellow': None, 'red': 'diff_weeks <= 4'},
    }

    df_flags = pd.DataFrame.from_dict(mapping, orient='index').reset_index().rename(columns={'index': 'Regular Stage'})
    return df_flags[['Regular Stage', 'blue', 'green', 'yellow', 'red']]


def sanitize_records_for_mongo(df: pd.DataFrame) -> list[dict]:
    """Convert pandas DataFrame to clean MongoDB record dicts safely handling NaN, Timestamps, and encodings."""
    records = df.to_dict('records')
    for r in records:
        r.pop('_id', None)
        r.pop('_id_x', None)
        r.pop('_id_y', None)
        for k, v in list(r.items()):
            if pd.isna(v):
                r[k] = None
            elif isinstance(v, (pd.Timestamp, datetime)):
                r[k] = v.isoformat()
            elif isinstance(v, bytes):
                try:
                    r[k] = v.decode('utf-8', errors='replace')
                except Exception:
                    r[k] = str(v)
    return records


async def process_symb_tracker_upload(
    crm_so_df: pd.DataFrame,
    week: int,
    file_date: str,
    db,
    progress_callback=None
) -> list[dict]:
    """
    Complete pipeline for SYMB Tracker:
    1. Merge crm_so with SO_numbers and Jabil_production reference tables from MongoDB.
    2. Format dates & compute CRD FY / CDD FY.
    3. Extract record IDs and fetch timeline events from Zoho CRM Sales_Orders API.
    4. Flatten timelines & compute audited product stage history.
    5. Calculate flags and recovery stages.
    6. Save documents into MongoDB collections `symb_tracker_data` and `symb_flag_mapping`.
    """
    setup_logs = []

    def log_setup(msg):
        print(msg)
        setup_logs.append(msg)
        if progress_callback:
            progress_callback("Processing SYMB Orders", "\n".join(setup_logs))

    log_setup("\n" + "=" * 70)
    log_setup("SYMB TRACKER PIPELINE START")
    log_setup("=" * 70)

    # ---------------------------------------------------------
    # 1. Fetch Reference Tables from MongoDB
    # ---------------------------------------------------------
    coll_so_nums = db["symb_so_numbers"]
    so_num_docs = await coll_so_nums.find({}).to_list(length=None)
    if so_num_docs:
        for doc in so_num_docs:
            doc.pop('_id', None)
        so_numbers_df = pd.DataFrame(so_num_docs)
        if "SO NUMBER" not in so_numbers_df.columns and "so_number" in so_numbers_df.columns:
            so_numbers_df.rename(columns={"so_number": "SO NUMBER"}, inplace=True)
        log_setup(f"  ✓ Loaded {len(so_numbers_df)} SYMB SO Numbers reference records from DB")
    else:
        so_numbers_df = pd.DataFrame(columns=["SO NUMBER"])
        log_setup("  ⚠️ No SYMB SO Numbers reference data found in DB")

    coll_jabil = db["symb_jabil_production"]
    jabil_docs = await coll_jabil.find({}).to_list(length=None)
    if jabil_docs:
        for doc in jabil_docs:
            doc.pop('_id', None)
        jabil_df = pd.DataFrame(jabil_docs)
        if "SO Number" not in jabil_df.columns and "so_number" in jabil_df.columns:
            jabil_df.rename(columns={"so_number": "SO Number"}, inplace=True)
        log_setup(f"  ✓ Loaded {len(jabil_df)} Jabil Production List Price reference records from DB")
    else:
        jabil_df = pd.DataFrame(columns=["SO Number"])
        log_setup("  ⚠️ No Jabil Production reference data found in DB")

    # ---------------------------------------------------------
    # CODE 1: Merge crm_so with SO_numbers and Jabil_production
    # ---------------------------------------------------------
    crm_so = crm_so_df.copy()

    # Normalize SO Number column
    so_col = None
    for candidate in ["SO Number", "so_number", "SO_Number", "So Number"]:
        if candidate in crm_so.columns:
            so_col = candidate
            break

    if not so_col:
        raise ValueError("Uploaded CSV must contain 'SO Number' column.")

    crm_so["SO Number"] = 'SO_' + crm_so[so_col].astype(str).str.replace('^SO_', '', regex=True)

    if not so_numbers_df.empty and "SO NUMBER" in so_numbers_df.columns:
        so_numbers_df["SO NUMBER"] = so_numbers_df["SO NUMBER"].dropna().astype(str)
        crm_so_merged = pd.merge(crm_so, so_numbers_df, left_on="SO Number", right_on="SO NUMBER", how="outer", indicator=True)
        crm_so_merged_both = crm_so_merged[crm_so_merged["_merge"] == "both"].copy()
    else:
        crm_so_merged_both = crm_so.copy()

    log_setup(f"  ✓ Merged SO orders: {len(crm_so_merged_both)} matching records found")

    # Date parsing
    cdd_col = [c for c in crm_so_merged_both.columns if "committed due date" in c.lower()]
    crd_col = [c for c in crm_so_merged_both.columns if "customer request date" in c.lower()]

    cdd_name = cdd_col[0] if cdd_col else "Committed Due date"
    crd_name = crd_col[0] if crd_col else "Customer Request date"

    crm_so_merged_both["Committed Due date"] = pd.to_datetime(crm_so_merged_both[cdd_name], errors='coerce')
    crm_so_merged_both["Customer Request date"] = pd.to_datetime(crm_so_merged_both[crd_name], errors='coerce')

    # Fiscal Year (April to March)
    crm_so_merged_both["CRD FY"] = crm_so_merged_both["Customer Request date"].apply(
        lambda x: f"FY{x.year + 1}" if pd.notna(x) and x.month >= 4 else (f"FY{x.year}" if pd.notna(x) else None)
    )
    crm_so_merged_both["CDD FY"] = crm_so_merged_both["Committed Due date"].apply(
        lambda x: f"FY{x.year + 1}" if pd.notna(x) and x.month >= 4 else (f"FY{x.year}" if pd.notna(x) else None)
    )

    crm_so_merged_both_sorted = crm_so_merged_both.sort_values(by="Customer Request date")
    crm_so_merged_both_unique_SO = crm_so_merged_both_sorted.drop_duplicates(subset=["SO Number"]).copy()

    # Merge Jabil Production data if available
    if not jabil_df.empty and "SO Number" in jabil_df.columns:
        jabil_df["SO Number"] = 'SO_' + jabil_df["SO Number"].astype(str).str.replace('^SO_', '', regex=True)
        crm_so_merged_both_unique_SO_merged = pd.merge(crm_so_merged_both_unique_SO, jabil_df, on="SO Number", how="left")
    else:
        crm_so_merged_both_unique_SO_merged = crm_so_merged_both_unique_SO.copy()

    # Grand Total fallback
    if "Grand Total" in crm_so_merged_both_unique_SO_merged.columns and "Total" in crm_so_merged_both_unique_SO_merged.columns:
        crm_so_merged_both_unique_SO_merged["Grand Total"] = crm_so_merged_both_unique_SO_merged.apply(
            lambda row: row["Total"] if (pd.isna(row.get("Grand Total")) or row.get("Grand Total") == 0) else row.get("Grand Total"), axis=1
        )

    # Extract deal / SO record IDs
    rec_id_col = None
    for candidate in ["Record Id", "record_id", "Record_Id", "RecordID"]:
        if candidate in crm_so_merged_both.columns:
            rec_id_col = candidate
            break

    if not rec_id_col:
        raise ValueError("Uploaded CSV must contain 'Record Id' column.")

    split_res = crm_so_merged_both[rec_id_col].astype(str).str.split('_', expand=True)
    if split_res.shape[1] >= 2:
        crm_so_merged_both['NPI'] = split_res[1]
    else:
        crm_so_merged_both['NPI'] = split_res[0]

    so_data = crm_so_merged_both[["NPI", "SO Number"]].copy().rename(columns={"NPI": "Record Id"})
    so_data['Record Id'] = so_data['Record Id'].apply(normalize_record_id)
    so_data = so_data.dropna(subset=['Record Id']).drop_duplicates(subset=['Record Id'], keep='first').reset_index(drop=True)

    clean_record_ids = so_data['Record Id'].tolist()
    log_setup(f"  ✓ Extracted {len(clean_record_ids)} unique Sales Order record IDs")

    if not clean_record_ids:
        log_setup("  ⚠️ No valid Sales Order record IDs found.")
        return []

    # ---------------------------------------------------------
    # CODE 2: Fetch Zoho Sales_Orders Timelines
    # ---------------------------------------------------------
    token_data = await asyncio.to_thread(get_access_token, log_setup)
    access_token = token_data.get("access_token")

    total_recs = len(clean_record_ids)
    est_total_sec = int(total_recs * 1.2)
    start_dt = datetime.now()
    est_completion_dt = start_dt + timedelta(seconds=est_total_sec)
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

    update_cb("Fetching Sales Order Timelines", f"Fetching 0/{total_recs} records (1.2s/rec) | Started: {start_time_str} | Est. Completion: {comp_time_str} ({est_str} remaining)", 0, est_str)

    raw_zoho_results = []
    for idx, rid in enumerate(clean_record_ids, 1):
        if not rid:
            continue
        try:
            timeline_data, status_code = await asyncio.to_thread(fetch_timeline_paginated, rid, access_token, "Sales_Orders")
            if status_code == 401:
                token_data = await asyncio.to_thread(get_access_token)
                access_token = token_data.get("access_token")
                timeline_data, status_code = await asyncio.to_thread(fetch_timeline_paginated, rid, access_token, "Sales_Orders")

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
            print(f"  → Fetched timeline {idx}/{total_recs} Sales Order records ({pct}%) • Est. remaining: {rem_str}")
            update_cb("Fetching Sales Order Timelines", msg, idx, rem_str)

    # ---------------------------------------------------------
    # CODE 3: Flatten Timeline Data & Audit Filter
    # ---------------------------------------------------------
    if progress_callback:
        progress_callback("Flattening Timelines", "Processing product stage history")

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
            timeline_events = result.get('__timeline', []) or result.get('data', [])

            for event in timeline_events:
                if not isinstance(event, dict):
                    continue
                row = {
                    'record_id': rid,
                    'status_code': status_code,
                    'audited_time': event.get('audited_time'),
                    'action': event.get('action'),
                    'source': event.get('source'),
                }
                field_history = event.get('field_history', [])
                if field_history:
                    for field_change in field_history:
                        api_name = field_change.get('api_name', '')
                        field_id = field_change.get('id')
                        val_info = field_change.get('_value', {})
                        old_val = val_info.get('old')
                        new_val = val_info.get('new')
                        if api_name:
                            row[f'{api_name}_id'] = field_id
                            row[f'{api_name}_old'] = old_val
                            row[f'{api_name}_new'] = new_val

                flattened_rows.append(row)

    df_timeline = pd.DataFrame(flattened_rows)
    print(f"  ✓ Created {len(df_timeline)} flattened timeline rows")

    if not df_timeline.empty:
        # Standardize product stage fields
        for col in ["audited_time", "Regular_Product_Stage_old", "Regular_Product_Stage_new", "CurrentProductStage_old", "CurrentProductStage_new", "Flag_Status_old", "Flag_Status_new"]:
            if col not in df_timeline.columns:
                df_timeline[col] = np.nan

        df1 = df_timeline[["record_id", "audited_time", "action", "Regular_Product_Stage_old", "Regular_Product_Stage_new", "CurrentProductStage_old", "CurrentProductStage_new", "Flag_Status_old", "Flag_Status_new"]].copy()
        df1['audited_time'] = pd.to_datetime(df1['audited_time'], errors='coerce')

        df1 = df1[
            df1["Flag_Status_new"].notna() |
            df1["Regular_Product_Stage_new"].notna() |
            df1["CurrentProductStage_new"].notna() |
            df1["CurrentProductStage_old"].notna()
        ].copy()

        df1['Regular_Product_Stage_new'] = df1['Regular_Product_Stage_new'].combine_first(df1['CurrentProductStage_new']).combine_first(df1['CurrentProductStage_old'])
        df1 = df1.sort_values(by=["record_id", "audited_time"], ascending=[True, True])

        df1['n-reg_stage'] = df1.groupby('record_id')['Regular_Product_Stage_new'].ffill()

        test_filtered = (
            df1.dropna(subset=['n-reg_stage'])
            .sort_values('audited_time')
            .groupby(['record_id', 'n-reg_stage'], as_index=False)
            .last()
        )
        recent_audited_time_df = (
            test_filtered.sort_values('audited_time')
            .groupby('record_id')
            .tail(1)
        ).copy()

        recent_audited_time_df['record_id_norm'] = recent_audited_time_df['record_id'].astype(str)
    else:
        recent_audited_time_df = pd.DataFrame(columns=['record_id_norm', 'n-reg_stage', 'audited_time'])

    # ---------------------------------------------------------
    # CODE 4: Merge & Calculate Flags & Recovery Stages
    # ---------------------------------------------------------
    if progress_callback:
        progress_callback("Calculating SYMB Metrics", "Assigning flag colors and recovery stages")

    crm_so_merged_both['record_id_norm'] = crm_so_merged_both['NPI'].astype(str)
    merged_df = pd.merge(crm_so_merged_both, recent_audited_time_df[['record_id_norm', 'n-reg_stage', 'audited_time']], on='record_id_norm', how='left')

    cdd_dt = pd.to_datetime(merged_df['Committed Due date'], errors='coerce').dt.tz_localize(None)
    audit_dt = pd.to_datetime(merged_df['audited_time'], errors='coerce').dt.tz_localize(None)
    merged_df['week_diff'] = ((cdd_dt - audit_dt).dt.days / 7.0).round(2)

    merged_df['new_flag_algo'] = merged_df.apply(assign_flag, axis=1)
    merged_df['new_flag_algo'] = merged_df['new_flag_algo'].fillna("green")

    merged_df['recovery stage'] = merged_df['week_diff'].apply(get_recovery_stage)
    merged_df['upload_week'] = week
    merged_df['file_date'] = file_date
    merged_df['created_at'] = datetime.now()

    # Clean DataFrame for MongoDB insertion
    final_records = sanitize_records_for_mongo(merged_df)

    # Save to MongoDB
    coll_data = db["symb_tracker_data"]
    await coll_data.delete_many({"upload_week": week})
    if final_records:
        await coll_data.insert_many(final_records, ordered=False)
        print(f"  ✓ Successfully saved {len(final_records)} SYMB tracker records to MongoDB for week {week}")

    # Generate and save flag mapping
    df_flags = generate_flag_mapping_df()
    flag_records = sanitize_records_for_mongo(df_flags)
    coll_flags = db["symb_flag_mapping"]
    await coll_flags.delete_many({})
    await coll_flags.insert_many(flag_records, ordered=False)
    print(f"  ✓ Saved static flag mapping rules to MongoDB (`symb_flag_mapping`)")

    print("\n" + "=" * 70)
    print("SYMB TRACKER PIPELINE COMPLETE")
    print("=" * 70 + "\n")

    return final_records
