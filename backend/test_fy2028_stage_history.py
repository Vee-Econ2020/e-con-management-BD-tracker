"""
Phase 1 test script: resolve the ACTUAL date each FY2028 Closed Won deal was
marked 100% probability (via Zoho's per-deal Stage History), instead of the
placeholder `Closing Date` field, and report how the QP2/QP3/QP4/Q1-Q4
quarter buckets on the FY2028 chart would change.

This is a one-time, standalone diagnostic. It writes to a separate temp
Mongo collection and does NOT touch weekly_tracker_data, slides_compute.py,
or transformation.py. Run with: py backend/test_fy2028_stage_history.py
"""

import asyncio
import json
import os
import time
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from transformation import get_access_token, normalize_record_id
from crm_sync import DEALS_MODULE_URL

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "DB_tracker")

TEMP_COLLECTION = "temp_fy2028_stage_history_actuals"
CACHE_DIR = Path(__file__).parent
CACHE_JSONL_PATH = CACHE_DIR / "_temp_stage_history_cache.jsonl"
PROGRESS_TXT_PATH = CACHE_DIR / "_temp_stage_history_progress.txt"

COQL_URL = "https://www.zohoapis.com/crm/v8/coql"
STAGE_HISTORY_FIELDS = "Stage,Probability,Amount,Closing_Date,Modified_Time"
MAX_RETRIES = 5


def get_db():
    client = AsyncIOMotorClient(MONGODB_URL)
    return client[DB_NAME]


async def get_target_deals(db):
    query = {
        "Probability (%)": 100,
        "Closing Date": {"$gte": datetime(2027, 4, 1), "$lt": datetime(2028, 4, 1)},
        "econ-Region": {"$ne": "TEST"},
    }
    projection = {
        "Record Id": 1, "Amount": 1, "Closing Date": 1,
        "econ-Region": 1, "OPP Category": 1, "Opportunities Name": 1,
    }
    deals = await db["zoho_deals_raw"].find(query, projection).to_list(length=None)
    print(f"  -> Found {len(deals)} FY2028 Closed Won deals (expected ~28)")
    return deals


def load_progress_cache():
    cache = {}
    if CACHE_JSONL_PATH.exists():
        with open(CACHE_JSONL_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                entry = json.loads(line)
                cache[entry["record_id"]] = entry
    return cache


def append_to_cache(record_id, stage_history, status):
    with open(CACHE_JSONL_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps({"record_id": record_id, "stage_history": stage_history, "status": status}) + "\n")
        f.flush()
    with open(PROGRESS_TXT_PATH, "a", encoding="utf-8") as f:
        f.write(record_id + "\n")
        f.flush()


def _sleep_for_retry(resp, attempt):
    retry_after = None
    if resp is not None:
        retry_after = resp.headers.get("Retry-After")
    if retry_after:
        try:
            wait = float(retry_after)
        except ValueError:
            wait = min(60, 2 ** attempt)
    else:
        wait = min(60, 2 ** attempt)
    print(f"    Rate limited (429). Waiting {wait:.0f}s...")
    time.sleep(wait)


def fetch_stage_history_get(record_id, access_token):
    url = f"{DEALS_MODULE_URL}/{record_id}/Stage_History"
    headers = {"Authorization": f"Zoho-oauthtoken {access_token}", "Accept": "application/json"}
    params = {"fields": STAGE_HISTORY_FIELDS}
    resp = requests.get(url, headers=headers, params=params, timeout=30)
    return resp


def fetch_stage_history_coql(record_id, access_token):
    url = COQL_URL
    headers = {"Authorization": f"Zoho-oauthtoken {access_token}", "Content-Type": "application/json"}
    payload = {"select_query": f"select {STAGE_HISTORY_FIELDS.replace(',', ', ')} from Stage_History where Deal = {record_id}"}
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    return resp


def fetch_stage_history_with_retry(record_id, access_token, get_token_func):
    current_token = access_token
    for attempt in range(1, MAX_RETRIES + 1):
        resp = fetch_stage_history_get(record_id, current_token)

        if resp.status_code == 401:
            print(f"    [{record_id}] Token expired, refreshing...")
            token_data = get_token_func()
            current_token = token_data.get("access_token")
            continue

        if resp.status_code == 429:
            _sleep_for_retry(resp, attempt)
            continue

        if resp.status_code == 200:
            return resp.json().get("data", []), "ok", current_token

        if resp.status_code == 204:
            return [], "empty", current_token

        # Any other status: fall back to COQL
        print(f"    [{record_id}] GET returned {resp.status_code}, falling back to COQL...")
        coql_resp = fetch_stage_history_coql(record_id, current_token)
        if coql_resp.status_code == 200:
            return coql_resp.json().get("data", []), "ok", current_token
        if coql_resp.status_code == 204:
            return [], "empty", current_token
        if coql_resp.status_code == 429:
            _sleep_for_retry(coql_resp, attempt)
            continue
        time.sleep(1)

    print(f"    [{record_id}] Giving up after {MAX_RETRIES} attempts")
    return None, "failed", current_token


def find_actual_win_date(stage_history, fallback_closing_date):
    if stage_history:
        won_entries = []
        for entry in stage_history:
            try:
                prob = float(entry.get("Probability"))
            except (TypeError, ValueError):
                continue
            if prob == 100 and entry.get("Modified_Time"):
                won_entries.append(entry)
        if won_entries:
            won_entries.sort(key=lambda e: e["Modified_Time"])
            earliest = won_entries[0]
            return pd_to_datetime(earliest["Modified_Time"]), "stage_history", earliest
    return fallback_closing_date, "fallback_closing_date", None


def pd_to_datetime(value):
    import pandas as pd
    ts = pd.to_datetime(value)
    if ts.tzinfo is not None:
        ts = ts.tz_localize(None)
    return ts.to_pydatetime()


def get_quarter_bucket(date, fy_year):
    windows = [
        ("QP2", datetime(fy_year, 7, 1), datetime(fy_year, 10, 1)),
        ("QP3", datetime(fy_year, 10, 1), datetime(fy_year + 1, 1, 1)),
        ("QP4", datetime(fy_year + 1, 1, 1), datetime(fy_year + 1, 4, 1)),
        ("Q1", datetime(fy_year + 1, 4, 1), datetime(fy_year + 1, 7, 1)),
        ("Q2", datetime(fy_year + 1, 7, 1), datetime(fy_year + 1, 10, 1)),
        ("Q3", datetime(fy_year + 1, 10, 1), datetime(fy_year + 2, 1, 1)),
        ("Q4", datetime(fy_year + 2, 1, 1), datetime(fy_year + 2, 4, 1)),
    ]
    for label, start, end in windows:
        if start <= date < end:
            return label
    return "OUT_OF_RANGE"


async def main():
    db = get_db()
    today = datetime.now()
    fy_year = today.year if today.month >= 4 else today.year - 1

    print("=" * 70)
    print("FY2028 Stage History Test - resolving actual Closed Won dates")
    print("=" * 70)

    print("\n[1/4] Fetching target deals from zoho_deals_raw...")
    deals = await get_target_deals(db)

    print("\n[2/4] Fetching Stage History (resumable, cached to disk)...")
    cache = load_progress_cache()
    print(f"  -> {len(cache)} records already cached from a previous run")

    pending = [d for d in deals if normalize_record_id(d["Record Id"]) not in cache]
    access_token = None
    if pending:
        token_data = get_access_token()
        access_token = token_data.get("access_token")

    for idx, deal in enumerate(pending, start=1):
        raw_id = normalize_record_id(deal["Record Id"])
        print(f"  [{idx}/{len(pending)}] Fetching Stage History for {raw_id}...")
        history, status, access_token = fetch_stage_history_with_retry(raw_id, access_token, get_access_token)
        append_to_cache(raw_id, history, status)
        cache[raw_id] = {"record_id": raw_id, "stage_history": history, "status": status}

    print("\n[3/4] Resolving actual win dates and buckets...")
    docs = []
    for deal in deals:
        raw_id = normalize_record_id(deal["Record Id"])
        cached = cache.get(raw_id, {"stage_history": None, "status": "failed"})
        stage_history = cached.get("stage_history")
        status = cached.get("status", "failed")

        closing_date_placeholder = deal["Closing Date"]
        actual_win_date, source, matched_entry = find_actual_win_date(stage_history, closing_date_placeholder)

        bucket_current_chart = get_quarter_bucket(closing_date_placeholder, fy_year)
        bucket_actual = get_quarter_bucket(actual_win_date, fy_year)

        doc = {
            "_id": raw_id,
            "record_id": raw_id,
            "record_id_zcrm": deal["Record Id"],
            "deal_name": deal.get("Opportunities Name") or raw_id,
            "amount": deal.get("Amount"),
            "region": deal.get("econ-Region"),
            "opp_category": deal.get("OPP Category"),
            "closing_date_placeholder": closing_date_placeholder,
            "actual_win_date": actual_win_date,
            "actual_win_date_source": source,
            "stage_history_status": status,
            "matched_stage_history_entry": matched_entry,
            "bucket_current_chart": bucket_current_chart,
            "bucket_actual": bucket_actual,
            "fetched_at": datetime.utcnow(),
            "script_version": "phase1_v1",
        }
        docs.append(doc)
        await db[TEMP_COLLECTION].update_one({"_id": raw_id}, {"$set": doc}, upsert=True)

    print("\n[4/4] Summary report")
    print_summary_report(docs)


def print_summary_report(docs):
    bucket_order = ["QP2", "QP3", "QP4", "Q1", "Q2", "Q3", "Q4", "OUT_OF_RANGE"]

    def bucket_totals(field):
        totals = {b: {"amount": 0.0, "count": 0} for b in bucket_order}
        for d in docs:
            b = d[field]
            totals[b]["amount"] += float(d["amount"] or 0)
            totals[b]["count"] += 1
        return totals

    current_totals = bucket_totals("bucket_current_chart")
    actual_totals = bucket_totals("bucket_actual")

    print("\n  Bucket     | Current chart (Closing Date)     | Actual (Stage History)")
    print("  " + "-" * 70)
    for b in bucket_order:
        c, a = current_totals[b], actual_totals[b]
        if c["count"] == 0 and a["count"] == 0:
            continue
        print(f"  {b:<10} | ${c['amount']/1e6:>7.2f}M ({c['count']:>2} deals)          | ${a['amount']/1e6:>7.2f}M ({a['count']:>2} deals)")

    print("\n  Deals whose bucket changed:")
    changed = [d for d in docs if d["bucket_current_chart"] != d["bucket_actual"]]
    if not changed:
        print("    (none)")
    for d in changed:
        print(f"    {d['deal_name']:<40} ${float(d['amount'] or 0)/1e6:.2f}M  "
              f"{d['bucket_current_chart']} -> {d['bucket_actual']}  (source: {d['actual_win_date_source']})")

    via_history = sum(1 for d in docs if d["actual_win_date_source"] == "stage_history")
    via_fallback = sum(1 for d in docs if d["actual_win_date_source"] == "fallback_closing_date")
    failed = sum(1 for d in docs if d["stage_history_status"] == "failed")
    total = len(docs)
    print(f"\n  Match rate: {via_history}/{total} resolved via stage history, "
          f"{via_fallback}/{total} fell back to Closing Date, {failed}/{total} failed to fetch.")


if __name__ == "__main__":
    asyncio.run(main())
