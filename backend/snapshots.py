"""
Daily snapshot storage for the Weekly Tracker (ZCRM-live-PRJ).

Problem this solves: transform_weekly_data() output is written into
weekly_tracker_data keyed by {week, type}, and every transform run for
that week overwrites the previous one in place. Before autosync, the team
transformed manually once a week (Wednesday), so that overwrite was
harmless -- one value per week. Now that transform can run multiple times
within the same week (previously up to 3x/day via sync, now once/day at
5pm), the value seen mid-week (e.g. last Wednesday's $68M) is silently
lost once a later run in the same week replaces it (e.g. Sunday's
$70.06M) -- so "current vs last week" comparisons go stale/wrong.

save_daily_snapshot() writes an additional, immutable copy of each
transform's aggregated output into weekly_tracker_daily_snapshots, keyed
by the calendar date (IST) the transform ran on. weekly_tracker_data
itself is untouched and keeps overwriting in place -- it's still what the
live dashboard/slides read for "current" figures. The snapshot collection
exists purely so any specific day's numbers can be recalled later for the
user-chosen "compare date X to date Y" feature.
"""

from datetime import datetime, timedelta, timezone

import pandas as pd

IST = timezone(timedelta(hours=5, minutes=30))

SNAPSHOT_COLLECTION = "weekly_tracker_daily_snapshots"


async def save_daily_snapshot(
    db,
    dataset_agg: pd.DataFrame,
    backlog_df,
    week: int,
    triggered_by: str,
    source: str,
    transformed_at: datetime = None,
) -> dict:
    """Persist one day's transformed dataset as its own snapshot document.

    triggered_by: "scheduled_5pm" | "manual" | "csv_upload"
    source: "zoho_sync" | "csv_upload"
    """
    transformed_at = transformed_at or datetime.now(IST)
    snapshot_date = transformed_at.strftime("%d-%m-%Y")

    data_records = dataset_agg.to_dict("records") if dataset_agg is not None and len(dataset_agg) > 0 else []
    backlog_records = backlog_df.to_dict("records") if backlog_df is not None and len(backlog_df) > 0 else []

    fy_list = sorted({r.get("closing date Fy") for r in data_records if r.get("closing date Fy")})

    doc = {
        "snapshot_date": snapshot_date,
        "snapshot_time": transformed_at.strftime("%H:%M"),
        "week": week,
        "fy_list": fy_list,
        "transformed_at": transformed_at,
        "triggered_by": triggered_by,
        "source": source,
        "record_count": len(data_records),
        "data": data_records,
        "backlog": backlog_records,
    }

    coll = db[SNAPSHOT_COLLECTION]

    if triggered_by in ("scheduled_5pm", "csv_upload"):
        # Idempotent per (calendar date, trigger): a re-fire of the 5pm job,
        # or re-uploading a CSV for a date already captured (e.g. correcting
        # last week's file), replaces that snapshot instead of duplicating
        # it -- the date is the identity, not the moment it was written.
        await coll.update_one(
            {"snapshot_date": snapshot_date, "triggered_by": triggered_by},
            {"$set": doc},
            upsert=True,
        )
    else:
        # Ad-hoc "Transform" button clicks are additive: each is its own
        # timestamped record, so re-running it mid-day never erases the
        # day's automatic 5pm snapshot.
        await coll.insert_one(doc)

    return {"snapshot_date": snapshot_date, "snapshot_time": doc["snapshot_time"], "record_count": doc["record_count"]}


async def list_snapshot_dates(db, fy: str = None, limit: int = 400) -> list:
    """One row per calendar date (its latest run that day), newest first --
    feeds the two 'compare from / to' date pickers."""
    coll = db[SNAPSHOT_COLLECTION]
    query = {"fy_list": fy} if fy else {}
    cursor = coll.find(
        query,
        {"snapshot_date": 1, "snapshot_time": 1, "week": 1, "triggered_by": 1, "transformed_at": 1, "record_count": 1},
    ).sort("transformed_at", -1)

    docs = await cursor.to_list(length=5000)

    by_date = {}
    for d in docs:
        key = d["snapshot_date"]
        if key not in by_date:  # first hit per date wins (already sorted newest-first)
            by_date[key] = d

    results = list(by_date.values())
    results.sort(key=lambda d: datetime.strptime(d["snapshot_date"], "%d-%m-%Y"), reverse=True)
    return results[:limit]


async def get_latest_snapshot(db, fy: str = None):
    """Most recently transformed snapshot, optionally restricted to one FY."""
    coll = db[SNAPSHOT_COLLECTION]
    query = {"fy_list": fy} if fy else {}
    cursor = coll.find(query).sort("transformed_at", -1).limit(1)
    docs = await cursor.to_list(length=1)
    return docs[0] if docs else None


def last_wednesday_date_str(reference: datetime = None) -> str:
    """DD-MM-YYYY for the most recent Wednesday on/before `reference`
    (today, IST, if omitted) -- the default 'previous' comparison point,
    matching the Weekly Tracker page's Compare picker default."""
    ref = reference or datetime.now(IST)
    days_since_wed = (ref.weekday() - 2) % 7  # Mon=0 ... Wed=2 ... Sun=6
    return (ref - timedelta(days=days_since_wed)).strftime("%d-%m-%Y")


async def get_snapshot_by_date(db, snapshot_date: str):
    """Latest snapshot recorded ON this exact date (DD-MM-YYYY), or None."""
    coll = db[SNAPSHOT_COLLECTION]
    cursor = coll.find({"snapshot_date": snapshot_date}).sort("transformed_at", -1).limit(1)
    docs = await cursor.to_list(length=1)
    return docs[0] if docs else None


async def get_snapshot_on_or_before(db, target_date: str):
    """Nearest available snapshot on or before target_date (DD-MM-YYYY) --
    graceful fallback (mirrors the existing 'Weekly Data Fallback' rule)
    for dates before this feature shipped or with no captured run."""
    try:
        target = datetime.strptime(target_date, "%d-%m-%Y")
    except ValueError:
        return None

    coll = db[SNAPSHOT_COLLECTION]
    cursor = coll.find({}, {"snapshot_date": 1, "transformed_at": 1}).sort("transformed_at", -1)
    candidates = await cursor.to_list(length=5000)

    best_date_str = None
    best_dt = None
    for d in candidates:
        try:
            dt = datetime.strptime(d["snapshot_date"], "%d-%m-%Y")
        except (KeyError, ValueError):
            continue
        if dt <= target and (best_dt is None or dt > best_dt):
            best_dt = dt
            best_date_str = d["snapshot_date"]

    if best_date_str is None:
        return None
    return await get_snapshot_by_date(db, best_date_str)


def compute_kpi_totals(data_records: list, fy: str) -> dict:
    """Sum Weighted Amount by projection category for one FY -- same
    definition Slide 2 uses for Total PO Won / Pipeline Forecast."""
    po_won = 0.0
    pipeline = 0.0
    for r in data_records:
        if r.get("closing date Fy") != fy:
            continue
        amt = float(r.get("Weighted Amount") or 0)
        cat = r.get("projection - category")
        if cat == "Closed Won":
            po_won += amt
        elif cat == "Pipeline":
            pipeline += amt
    return {"po_won": po_won, "pipeline": pipeline, "total": po_won + pipeline}


async def compute_comparison(db, from_date: str, to_date: str, fy: str) -> dict:
    """KPI delta between the snapshots nearest to from_date and to_date."""
    from_snap = await get_snapshot_on_or_before(db, from_date)
    to_snap = await get_snapshot_on_or_before(db, to_date)

    if not from_snap or not to_snap:
        return {"error": "No snapshot data available yet for the selected date(s)."}

    from_totals = compute_kpi_totals(from_snap.get("data", []), fy)
    to_totals = compute_kpi_totals(to_snap.get("data", []), fy)

    delta_total = to_totals["total"] - from_totals["total"]
    delta_pct = (delta_total / from_totals["total"] * 100.0) if from_totals["total"] else 0.0

    return {
        "from": {"snapshot_date": from_snap["snapshot_date"], "requested_date": from_date, **from_totals},
        "to": {"snapshot_date": to_snap["snapshot_date"], "requested_date": to_date, **to_totals},
        "delta": {
            "po_won": to_totals["po_won"] - from_totals["po_won"],
            "pipeline": to_totals["pipeline"] - from_totals["pipeline"],
            "total": delta_total,
            "total_pct": delta_pct,
        },
    }
