"""
Zoho CRM Deals -> MongoDB sync pipeline.

Replaces the manual CSV export/upload with a background job that pulls
changed Deals directly from the Zoho CRM API and feeds the same
transformation logic in transformation.py. See ZCRM-live-PRJ plan for
full architecture notes.

Delta detection uses the `If-Modified-Since` header on Zoho's standard
"Get Records" endpoint (GET /crm/v8/Deals) rather than the COQL Query API,
because the OAuth token currently configured for this project does not
carry the ZohoCRM.coql.READ scope. If that scope is added later, swap
DELTA_STRATEGY to "coql" and implement _fetch_deals_coql() as a drop-in
replacement for _fetch_deals_delta() -- the rest of the pipeline
(upsert / watermark / transform) does not need to change.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

import pandas as pd
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from transformation import get_access_token, normalize_record_id, transform_weekly_data

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "DB_tracker")

IST = timezone(timedelta(hours=5, minutes=30))
WATERMARK_OVERLAP_MINUTES = 5
DEALS_MODULE_URL = "https://www.zohoapis.com/crm/v8/Deals"
DELETED_DEALS_URL = "https://www.zohoapis.com/crm/v8/Deals/deleted"

# CSV column label -> Zoho Deals API field name.
# Only the 25 labels actually consumed by transform_weekly_data() /
# generate_services_trend_from_weekly_df() are synced; the other 6 columns
# from the original CSV (Account Owner, Order Number, Order Date, Invoice
# Date, Billing Country, Market Area-Specialization) are parsed/selected by
# transformation.py but never survive into any aggregated output, so they
# are intentionally left out.
ZOHO_FIELD_MAP = {
    "Record Id": "id",
    "Created Time": "Created_Time",
    "Stage": "Stage",
    "Closing Date": "Closing_Date",
    "PO Expected Date1": "PO_Expected_Date1",
    "PO Expected Date2": "PO_Expected_Date2",
    "PO Expected Date3": "PO_Expected_Date3",
    "PO Expected Date4": "PO_Expected_Date4",
    "PO Expected Date5": "PO_Expected_Date5",
    "Modified Time": "Modified_Time",
    "Modified Date(Specific Fields Only)": "Modified_Date_Specific",
    "Market Area": "Market_Area",
    "Opportunities Name": "Deal_Name",
    "OPP Category": "OPP_Category",
    "Type": "Type",
    "Account Name (Account Name)": "Account_Name",
    "Amount": "Amount",
    "econ-Region": "Region_Reports",
    "Order Value": "Order_Value",
    "Expected Revenue": "Expected_Revenue",
    "Invoiced-Modified Time": "Invoiced_Modified_Time",
    "Total Invoiced": "Total_Invoiced",
    "Probability (%)": "Probability",
    "DesignWinYear": "DesignWinYear",
    "Opportunities Owner": "Owner",
}

# Fields whose Zoho value is a lookup object ({"name": ..., "id": ...})
# rather than a scalar; flattened to the display name on ingest.
LOOKUP_FIELDS = {"Account Name (Account Name)", "Opportunities Owner"}

# Columns transform_weekly_data() reads or selects that are NOT part of the
# synced field set. Injected as empty placeholders so the shared function
# runs unmodified against zoho_deals_raw-sourced data (see GEMINI.md /
# ZCRM-live-PRJ plan: reuse the aggregation logic, only its input changes).
UNUSED_PASSTHROUGH_COLUMNS = {
    "Order  Date": pd.NaT,
    "Account Owner": "",
    "Invoice Date": pd.NaT,
}

DATE_FIELDS = {
    "Created Time", "Closing Date", "Modified Time",
    "Modified Date(Specific Fields Only)", "Invoiced-Modified Time",
    "PO Expected Date1", "PO Expected Date2", "PO Expected Date3",
    "PO Expected Date4", "PO Expected Date5",
}


def _get_db():
    client = AsyncIOMotorClient(MONGODB_URL)
    return client[DB_NAME]


def _api_field_list():
    # "id" is always returned by Zoho regardless of the fields param.
    return ",".join(v for v in ZOHO_FIELD_MAP.values() if v != "id")


def _parse_zoho_datetime(value):
    if not value:
        return None
    try:
        return pd.to_datetime(value)
    except (ValueError, TypeError):
        return None


def _to_naive_ist(ts):
    """Normalize a Timestamp/datetime to a naive value meaning IST
    wall-clock time. Freshly-fetched Zoho API timestamps carry a "+05:30"
    offset; CSV-exported and MongoDB-round-tripped values are naive but
    already mean IST wall-clock time (Mongo drops tz info on read/write,
    and the CSV export has no offset to begin with). Every value that
    participates in the watermark comparison must agree on one
    convention, otherwise comparing a tz-aware API timestamp against a
    naive stored watermark raises "can't compare offset-naive and
    offset-aware datetimes". Stripping the offset (instead of converting
    through UTC) keeps this idempotent -- reapplying it to an
    already-naive value is a no-op, so there's no cumulative drift across
    repeated sync runs or historical data already stored this way."""
    if ts is None:
        return None
    ts = pd.Timestamp(ts)
    if pd.isna(ts):
        return None
    if ts.tzinfo is not None:
        ts = ts.tz_convert(IST).tz_localize(None)
    return ts.to_pydatetime()


def _record_to_raw_doc(record: dict, source: str) -> dict:
    """Convert one Zoho API Deals record into a zoho_deals_raw document
    keyed by CSV-style column labels, matching what transform_weekly_data()
    expects as input column names."""
    rid = normalize_record_id(record.get("id"))
    doc = {"Record Id": f"zcrm_{rid}"}

    for label, api_name in ZOHO_FIELD_MAP.items():
        if label == "Record Id":
            continue
        value = record.get(api_name)
        if label in LOOKUP_FIELDS:
            value = value.get("name") if isinstance(value, dict) else value
        elif label == "Modified Time":
            # The one field the sync watermark compares against -- must be
            # normalized consistently (see _to_naive_ist).
            value = _to_naive_ist(_parse_zoho_datetime(value))
        elif label in DATE_FIELDS:
            value = _parse_zoho_datetime(value)
        doc[label] = value

    doc["_deleted_in_zoho"] = False
    doc["_deleted_detected_at"] = None
    doc["_synced_at"] = datetime.now(IST)
    doc["_source"] = source
    return rid, doc


# Fields diffed for the "Show detail" view when a record is updated.
# Record Id never changes (it's the key) and Modified Time changes on
# every touch trivially, so both are excluded as noise.
DIFF_FIELDS = [label for label in ZOHO_FIELD_MAP if label not in ("Record Id", "Modified Time")]


def _diff_docs(old_doc: dict, new_doc: dict) -> list:
    changes = []
    for field in DIFF_FIELDS:
        old_val = old_doc.get(field)
        new_val = new_doc.get(field)
        if old_val != new_val:
            changes.append({"field": field, "old": old_val, "new": new_val})
    return changes


async def _upsert_raw_docs(db, docs_by_id: dict) -> tuple:
    """Upsert into zoho_deals_raw. Returns (new_count, updated_count, detail)
    where detail = {"new": [...], "updated": [...]} for the Sync History
    "Show detail" view."""
    coll = db["zoho_deals_raw"]
    if not docs_by_id:
        return 0, 0, {"new": [], "updated": []}

    existing_docs = {}
    cursor = coll.find({"_id": {"$in": list(docs_by_id.keys())}})
    async for row in cursor:
        existing_docs[row["_id"]] = row

    new_count = 0
    updated_count = 0
    new_detail = []
    updated_detail = []

    for rid, doc in docs_by_id.items():
        await coll.update_one({"_id": rid}, {"$set": doc}, upsert=True)
        old_doc = existing_docs.get(rid)
        if old_doc is None:
            new_count += 1
            new_detail.append({
                "record_id": rid,
                "deal_name": doc.get("Opportunities Name"),
                "account_name": doc.get("Account Name (Account Name)"),
                "stage": doc.get("Stage"),
                "amount": doc.get("Amount"),
                "region": doc.get("econ-Region"),
                "closing_date": doc.get("Closing Date"),
            })
        else:
            updated_count += 1
            updated_detail.append({
                "record_id": rid,
                "deal_name": doc.get("Opportunities Name"),
                "account_name": doc.get("Account Name (Account Name)"),
                "changes": _diff_docs(old_doc, doc),
            })

    return new_count, updated_count, {"new": new_detail, "updated": updated_detail}


def _fetch_deals_delta(access_token: str, since_iso: str) -> list[dict]:
    """Fetch all Deals modified since `since_iso`, paginated via Zoho's
    cursor-based page_token (required once sort_by is used)."""
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "If-Modified-Since": since_iso,
    }
    base_params = {
        "fields": _api_field_list(),
        "sort_by": "Modified_Time",
        "sort_order": "asc",
        "per_page": 200,
    }

    all_records = []
    page_token = None
    while True:
        params = dict(base_params)
        if page_token:
            params["page_token"] = page_token
        resp = requests.get(DEALS_MODULE_URL, headers=headers, params=params, timeout=60)
        if resp.status_code == 204:
            break
        resp.raise_for_status()
        body = resp.json()
        records = body.get("data", [])
        all_records.extend(records)
        info = body.get("info") or {}
        if not info.get("more_records"):
            break
        page_token = info.get("next_page_token")
        if not page_token:
            break

    return all_records


def _fetch_deleted_deal_ids(access_token: str) -> list[str]:
    headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}
    all_ids = []
    page = 1
    while True:
        resp = requests.get(
            DELETED_DEALS_URL, headers=headers,
            params={"type": "all", "page": page, "per_page": 200}, timeout=60,
        )
        if resp.status_code == 204:
            break
        resp.raise_for_status()
        body = resp.json()
        records = body.get("data", [])
        all_ids.extend(normalize_record_id(r.get("id")) for r in records)
        info = body.get("info") or {}
        if not info.get("more_records"):
            break
        page += 1

    return all_ids


async def _get_watermark(db):
    doc = await db["crm_sync_state"].find_one({"_id": "watermark"})
    return doc.get("last_synced_at") if doc else None


async def _set_watermark(db, dt):
    await db["crm_sync_state"].update_one(
        {"_id": "watermark"},
        {"$set": {"last_synced_at": dt, "updated_at": datetime.now(IST)}},
        upsert=True,
    )


async def _write_sync_log(db, log: dict):
    return await db["crm_sync_logs"].insert_one(log)


async def _write_transform_log(db, log: dict):
    return await db["crm_transform_logs"].insert_one(log)


async def sync_deals(db=None, trigger_type: str = "auto", triggered_by=None, run_transform: bool = True) -> dict:
    """Delta-sync changed Deals from Zoho into zoho_deals_raw, advance the
    watermark, and (by default) trigger a Transform run afterward."""
    own_db = db is None
    if own_db:
        db = _get_db()

    started_at = datetime.now(IST)
    log = {
        "run_type": "delta_sync",
        "trigger_type": trigger_type,
        "triggered_by": triggered_by,
        "started_at": started_at,
        "ended_at": None,
        "status": "running",
        "records_scanned": 0,
        "new_records": 0,
        "updated_records": 0,
        "error_message": None,
    }
    log_result = await _write_sync_log(db, dict(log))
    log_id = log_result.inserted_id

    try:
        watermark = await _get_watermark(db)
        if watermark is not None:
            watermark = _to_naive_ist(watermark)

        if watermark is None:
            since_dt = started_at - timedelta(hours=24)  # started_at is tz-aware IST
        else:
            since_dt = pd.Timestamp(watermark) - timedelta(minutes=WATERMARK_OVERLAP_MINUTES)

        since_iso = since_dt.strftime("%Y-%m-%dT%H:%M:%S+05:30")

        token_data = get_access_token()
        access_token = token_data["access_token"]

        records = _fetch_deals_delta(access_token, since_iso)

        docs_by_id = {}
        max_modified = watermark
        for record in records:
            rid, doc = _record_to_raw_doc(record, source="api_sync")
            docs_by_id[rid] = doc
            modified_time = doc.get("Modified Time")
            if modified_time is not None and (max_modified is None or modified_time > max_modified):
                max_modified = modified_time

        new_count, updated_count, detail = await _upsert_raw_docs(db, docs_by_id)

        if records and max_modified is not None:
            await _set_watermark(db, max_modified)

        ended_at = datetime.now(IST)
        await db["crm_sync_logs"].update_one(
            {"_id": log_id},
            {"$set": {
                "ended_at": ended_at,
                "status": "completed",
                "records_scanned": len(records),
                "new_records": new_count,
                "updated_records": updated_count,
                "new_records_detail": detail["new"],
                "updated_records_detail": detail["updated"],
            }},
        )

        result = {
            "status": "completed",
            "records_scanned": len(records),
            "new_records": new_count,
            "updated_records": updated_count,
        }

        if run_transform:
            transform_result = await run_crm_transform(db, triggered_by="auto")
            result["transform"] = transform_result

        return result

    except Exception as exc:
        ended_at = datetime.now(IST)
        await db["crm_sync_logs"].update_one(
            {"_id": log_id},
            {"$set": {"ended_at": ended_at, "status": "failed", "error_message": str(exc)}},
        )
        raise
    finally:
        if own_db:
            db.client.close()


async def run_deleted_cleanup(db=None, trigger_type: str = "auto", triggered_by=None, run_transform: bool = True) -> dict:
    """Weekly job: mark Deals removed from Zoho as soft-deleted in
    zoho_deals_raw so Transform excludes them going forward."""
    own_db = db is None
    if own_db:
        db = _get_db()

    started_at = datetime.now(IST)
    log = {
        "run_type": "deleted_cleanup",
        "trigger_type": trigger_type,
        "triggered_by": triggered_by,
        "started_at": started_at,
        "ended_at": None,
        "status": "running",
        "records_scanned": 0,
        "new_records": 0,
        "updated_records": 0,
        "error_message": None,
    }
    log_result = await _write_sync_log(db, dict(log))
    log_id = log_result.inserted_id

    try:
        token_data = get_access_token()
        access_token = token_data["access_token"]

        deleted_ids = _fetch_deleted_deal_ids(access_token)

        coll = db["zoho_deals_raw"]
        soft_deleted_count = 0
        if deleted_ids:
            now = datetime.now(IST)
            update_result = await coll.update_many(
                {"_id": {"$in": deleted_ids}, "_deleted_in_zoho": {"$ne": True}},
                {"$set": {"_deleted_in_zoho": True, "_deleted_detected_at": now}},
            )
            soft_deleted_count = update_result.modified_count

        ended_at = datetime.now(IST)
        await db["crm_sync_logs"].update_one(
            {"_id": log_id},
            {"$set": {
                "ended_at": ended_at,
                "status": "completed",
                "records_scanned": len(deleted_ids),
                "updated_records": soft_deleted_count,
            }},
        )

        result = {"status": "completed", "records_scanned": len(deleted_ids), "soft_deleted": soft_deleted_count}

        if run_transform:
            transform_result = await run_crm_transform(db, triggered_by="auto")
            result["transform"] = transform_result

        return result

    except Exception as exc:
        ended_at = datetime.now(IST)
        await db["crm_sync_logs"].update_one(
            {"_id": log_id},
            {"$set": {"ended_at": ended_at, "status": "failed", "error_message": str(exc)}},
        )
        raise
    finally:
        if own_db:
            db.client.close()


def _current_iso_week() -> int:
    return datetime.now(IST).isocalendar()[1]


def build_dataframe_from_zoho_raw(raw_docs: list[dict]) -> pd.DataFrame:
    """Build a DataFrame with exactly the columns transform_weekly_data()
    expects, from zoho_deals_raw documents (already excluding soft-deleted
    deals)."""
    rows = []
    for doc in raw_docs:
        row = {label: doc.get(label) for label in ZOHO_FIELD_MAP if label != "Record Id"}
        row["Record Id"] = doc.get("Record Id")
        row.update(UNUSED_PASSTHROUGH_COLUMNS)
        rows.append(row)

    df = pd.DataFrame(rows)
    for col in ("Closing Date", "Order  Date"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


async def run_crm_transform(db=None, week: int = None, upload_date: str = None, triggered_by: str = "auto") -> dict:
    """Read active (non-deleted) zoho_deals_raw documents, run them through
    the existing transform_weekly_data() pipeline, and overwrite the
    current week's weekly_tracker_data / orderbacklogs, same as a CSV
    upload would."""
    own_db = db is None
    if own_db:
        db = _get_db()

    week = week or _current_iso_week()
    upload_date = upload_date or datetime.now(IST).strftime("%d-%m-%Y")

    log = {
        "transformed_at": datetime.now(IST),
        "status": "running",
        "triggered_by": triggered_by,
        "week": week,
        "error_message": None,
    }
    log_result = await _write_transform_log(db, dict(log))
    log_id = log_result.inserted_id

    try:
        coll_raw = db["zoho_deals_raw"]
        raw_docs = [doc async for doc in coll_raw.find({"_deleted_in_zoho": {"$ne": True}})]

        if not raw_docs:
            await db["crm_transform_logs"].update_one(
                {"_id": log_id},
                {"$set": {"status": "failed", "error_message": "No active records in zoho_deals_raw"}},
            )
            return {"status": "failed", "error_message": "No active records in zoho_deals_raw"}

        df = build_dataframe_from_zoho_raw(raw_docs)
        dataset_agg, backlog_df = await transform_weekly_data(df, week, upload_date, db)

        coll_data = db["weekly_tracker_data"]
        coll_backlog = db["orderbacklogs"]

        if dataset_agg is not None and len(dataset_agg) > 0:
            dataset_agg["week"] = week
            dataset_agg["upload_date"] = upload_date
            dataset_agg["type"] = "weekly"
            records = dataset_agg.to_dict("records")

            await coll_data.delete_many({"week": week, "type": "weekly"})
            await coll_data.insert_many(records, ordered=False)

        if backlog_df is not None and len(backlog_df) > 0:
            backlog_df["week"] = week
            backlog_df["upload_date"] = upload_date
            backlog_df["type"] = "weekly"
            backlog_records = backlog_df.to_dict("records")

            await coll_backlog.delete_many({"week": week, "type": "weekly"})
            await coll_backlog.insert_many(backlog_records, ordered=False)

        await db["crm_transform_logs"].update_one(
            {"_id": log_id},
            {"$set": {"status": "completed"}},
        )

        return {"status": "completed", "week": week, "records": len(dataset_agg) if dataset_agg is not None else 0}

    except Exception as exc:
        await db["crm_transform_logs"].update_one(
            {"_id": log_id},
            {"$set": {"status": "failed", "error_message": str(exc)}},
        )
        raise
    finally:
        if own_db:
            db.client.close()


async def upsert_csv_into_zoho_raw(df: pd.DataFrame, db=None) -> dict:
    """Manual CSV fallback: seed/refresh zoho_deals_raw from an uploaded
    Weekly-tracker CSV so it stays consistent with the automatic sync, and
    advance the watermark to the CSV's own max Modified Time (not the
    upload timestamp) -- see ZCRM-live-PRJ plan, "Manual CSV fallback"."""
    own_db = db is None
    if own_db:
        db = _get_db()

    try:
        required_cols = list(ZOHO_FIELD_MAP.keys())
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"CSV is missing required columns: {missing}")

        csv_df = df[required_cols].copy()
        # Normalized to naive UTC here too -- must match the convention used
        # for API-sourced "Modified Time" values (see _to_naive_ist), since
        # this is the field the sync watermark is compared against.
        csv_df["Modified Time"] = pd.to_datetime(csv_df["Modified Time"], errors="coerce").apply(_to_naive_ist)
        for col in ("Created Time", "Closing Date", "Modified Date(Specific Fields Only)",
                    "Invoiced-Modified Time", "PO Expected Date1", "PO Expected Date2",
                    "PO Expected Date3", "PO Expected Date4", "PO Expected Date5"):
            csv_df[col] = pd.to_datetime(csv_df[col], errors="coerce")

        docs_by_id = {}
        for _, row in csv_df.iterrows():
            rid = normalize_record_id(row["Record Id"])
            if not rid:
                continue
            doc = row.to_dict()
            doc["Record Id"] = f"zcrm_{rid}"
            for key, value in list(doc.items()):
                if isinstance(value, pd.Timestamp):
                    doc[key] = value.to_pydatetime()
                elif pd.isna(value):
                    doc[key] = None
            doc["_deleted_in_zoho"] = False
            doc["_deleted_detected_at"] = None
            doc["_synced_at"] = datetime.now(IST)
            doc["_source"] = "csv_upload"
            docs_by_id[rid] = doc

        new_count, updated_count, _detail = await _upsert_raw_docs(db, docs_by_id)

        # The CSV is a full export of every currently-active deal, so it is
        # authoritative: any zoho_deals_raw record NOT present in this
        # upload no longer exists in Zoho's report and should stop
        # counting -- soft-deleted the same way the weekly deleted-cleanup
        # job does (audit trail kept, not hard-removed). Guarded so a CSV
        # that somehow yields zero valid rows can never wipe the whole
        # collection.
        soft_deleted_count = 0
        current_ids = list(docs_by_id.keys())
        if current_ids:
            now = datetime.now(IST)
            soft_delete_result = await db["zoho_deals_raw"].update_many(
                {"_id": {"$nin": current_ids}, "_deleted_in_zoho": {"$ne": True}},
                {"$set": {"_deleted_in_zoho": True, "_deleted_detected_at": now}},
            )
            soft_deleted_count = soft_delete_result.modified_count

        modified_values = [v for v in csv_df["Modified Time"] if v is not None]
        if modified_values:
            await _set_watermark(db, max(modified_values))

        return {
            "status": "completed",
            "new_records": new_count,
            "updated_records": updated_count,
            "soft_deleted": soft_deleted_count,
        }

    finally:
        if own_db:
            db.client.close()
