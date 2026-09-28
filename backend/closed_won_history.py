"""
Resolves the ACTUAL date a deal's Probability was marked 100% (Closed Won),
via Zoho CRM's per-deal Stage History, instead of trusting the `Closing Date`
field -- which the BD team sets to a fixed future placeholder (e.g. FY2028
deals are all closing-dated "01-04-2027") purely to mark which fiscal year
the revenue counts toward, not when the deal was actually won.

Results are cached permanently in the `closed_won_actual_dates` collection,
keyed by raw (unprefixed) Zoho record id, so each deal's Stage History is
only ever fetched once -- transform_weekly_data() calls sync_new_actual_win_dates()
on every run, but it's a no-op for any record id already cached.

Only used for FY2028 today (see slides_compute.py's _compute_cumulative_generic).
"""

import time
from datetime import datetime

import pandas as pd
import requests

from crm_sync import DEALS_MODULE_URL

ACTUAL_DATES_COLLECTION = "closed_won_actual_dates"

COQL_URL = "https://www.zohoapis.com/crm/v8/coql"
STAGE_HISTORY_FIELDS = "Stage,Probability,Amount,Closing_Date,Modified_Time"
MAX_RETRIES = 5


def _sleep_for_retry(resp, attempt):
    retry_after = resp.headers.get("Retry-After") if resp is not None else None
    if retry_after:
        try:
            wait = float(retry_after)
        except ValueError:
            wait = min(60, 2 ** attempt)
    else:
        wait = min(60, 2 ** attempt)
    print(f"    Rate limited (429). Waiting {wait:.0f}s...")
    time.sleep(wait)


def fetch_stage_history_with_retry(record_id, access_token, get_token_func):
    """Fetch a single deal's Stage History, with 401 refresh, 429 backoff,
    and a COQL fallback when the related-list GET fails outright.
    Returns (stage_history_list_or_None, status) where status is
    "ok" | "empty" | "failed"."""
    current_token = access_token
    for attempt in range(1, MAX_RETRIES + 1):
        url = f"{DEALS_MODULE_URL}/{record_id}/Stage_History"
        headers = {"Authorization": f"Zoho-oauthtoken {current_token}", "Accept": "application/json"}
        resp = requests.get(url, headers=headers, params={"fields": STAGE_HISTORY_FIELDS}, timeout=30)

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
        coql_headers = {"Authorization": f"Zoho-oauthtoken {current_token}", "Content-Type": "application/json"}
        coql_payload = {"select_query": f"select {STAGE_HISTORY_FIELDS.replace(',', ', ')} from Stage_History where Deal = {record_id}"}
        coql_resp = requests.post(COQL_URL, headers=coql_headers, json=coql_payload, timeout=30)
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
    """Earliest Stage_History row where Probability hit 100; falls back to
    the deal's own Closing Date if no such row exists."""
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
            ts = pd.to_datetime(earliest["Modified_Time"])
            if ts.tzinfo is not None:
                ts = ts.tz_localize(None)
            return ts.to_pydatetime(), "stage_history"
    return fallback_closing_date, "fallback_closing_date"


def get_quarter_bucket_for_fy2028(date, fy_year=None):
    """Maps a date onto the FY2028 chart's QP2/QP3/QP4/Q1-Q4 x-axis, using
    the same windows as slides_compute.py's _compute_cumulative_generic.
    Dates before the QP2 window (deals actually won earlier than this
    chart's tracked window starts) are clamped to QP2 rather than dropped,
    per business decision -- their revenue still belongs in the FY2028
    total, just at the earliest visible tick. Dates past Q4 are clamped to
    Q4 for the same reason (shouldn't happen for a Closed Won deal)."""
    if fy_year is None:
        today = datetime.now()
        fy_year = today.year if today.month >= 4 else today.year - 1

    windows = [
        ("QP2", datetime(fy_year, 7, 1), datetime(fy_year, 10, 1)),
        ("QP3", datetime(fy_year, 10, 1), datetime(fy_year + 1, 1, 1)),
        ("QP4", datetime(fy_year + 1, 1, 1), datetime(fy_year + 1, 4, 1)),
        ("Q1", datetime(fy_year + 1, 4, 1), datetime(fy_year + 1, 7, 1)),
        ("Q2", datetime(fy_year + 1, 7, 1), datetime(fy_year + 1, 10, 1)),
        ("Q3", datetime(fy_year + 1, 10, 1), datetime(fy_year + 2, 1, 1)),
        ("Q4", datetime(fy_year + 2, 1, 1), datetime(fy_year + 2, 4, 1)),
    ]
    if date < windows[0][1]:
        return "QP2"
    if date >= windows[-1][2]:
        return "Q4"
    for label, start, end in windows:
        if start <= date < end:
            return label
    return "QP2"


async def sync_new_actual_win_dates(db, record_id_to_fallback_date, get_access_token_func):
    """Given {raw_record_id: fallback_closing_date} for the current FY2028
    Closed Won candidate set, returns {raw_record_id: actual_win_date} for
    all of them -- resolving any not yet in `closed_won_actual_dates` via
    Zoho's Stage History, and caching the result permanently. A no-op HTTP-wise
    for record ids already cached from a previous run."""
    coll = db[ACTUAL_DATES_COLLECTION]
    record_ids = list(record_id_to_fallback_date.keys())
    if not record_ids:
        return {}

    cached_docs = await coll.find({"_id": {"$in": record_ids}}).to_list(length=None)
    result = {doc["_id"]: doc["actual_win_date"] for doc in cached_docs}

    missing = [rid for rid in record_ids if rid not in result]
    if not missing:
        return result

    print(f"  → Resolving actual Closed Won dates for {len(missing)} new FY2028 deal(s) via Zoho Stage History...")
    token_data = get_access_token_func()
    access_token = token_data.get("access_token")

    for rid in missing:
        stage_history, status, access_token = fetch_stage_history_with_retry(rid, access_token, get_access_token_func)
        fallback_date = record_id_to_fallback_date[rid]
        actual_date, source = find_actual_win_date(stage_history, fallback_date)

        doc = {
            "_id": rid,
            "record_id": rid,
            "actual_win_date": actual_date,
            "actual_win_date_source": source,
            "stage_history_status": status,
            "fetched_at": datetime.utcnow(),
        }
        await coll.update_one({"_id": rid}, {"$set": doc}, upsert=True)
        result[rid] = actual_date

    print(f"  ✓ Actual win dates resolved for {len(missing)} deal(s)")
    return result
