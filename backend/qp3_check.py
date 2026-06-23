import motor.motor_asyncio
import asyncio

async def main():
    db = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")["DB_tracker"]

    # First, find all distinct weeks
    weeks = await db["weekly_tracker_data"].distinct("week")
    latest_week = max(weeks)
    print(f"Latest week in database: {latest_week}")
    print(f"All weeks: {sorted(weeks)}")

    # Get QP3 Closed Won data ONLY for the latest week
    docs = await db["weekly_tracker_data"].find({
        "week": latest_week,
        "granular_QTR": "QP3",
        "projection - category": "Closed Won"
    }).to_list(None)

    region_po = {}
    for d in docs:
        r = d.get("mRegion", "Unknown")
        region_po[r] = region_po.get(r, 0) + d.get("Weighted Amount", 0)

    print()
    print("=" * 90)
    print(f"QP3 ACTUAL PO (Closed Won) BY REGION - Week {latest_week} only")
    print("=" * 90)
    if not region_po:
        print("  (No QP3 Closed Won data found)")
    for r, v in sorted(region_po.items()):
        print(f"  {r:20s} : ${v:>15,.2f}")
    print(f"  {'TOTAL':20s} : ${sum(region_po.values()):>15,.2f}")

    # Also show FULL PO (all quarters) for latest week per region for context
    all_docs = await db["weekly_tracker_data"].find({
        "week": latest_week,
        "projection - category": "Closed Won"
    }).to_list(None)

    region_full = {}
    region_by_qtr = {}
    for d in all_docs:
        r = d.get("mRegion", "Unknown")
        q = d.get("granular_QTR", "?")
        amt = d.get("Weighted Amount", 0)
        region_full[r] = region_full.get(r, 0) + amt
        region_by_qtr.setdefault(r, {}).setdefault(q, 0)
        region_by_qtr[r][q] += amt

    print()
    print("=" * 90)
    print(f"FULL PO (ALL QUARTERS, Closed Won) BY REGION - Week {latest_week}")
    print("=" * 90)
    for r, v in sorted(region_full.items()):
        print(f"  {r:20s} : ${v:>15,.2f}")
        for q, qv in sorted(region_by_qtr[r].items()):
            print(f"    {q:10s} : ${qv:>15,.2f}")
    print(f"  {'TOTAL':20s} : ${sum(region_full.values()):>15,.2f}")

    # QP3 targets
    targets = await db["target_settings"].find({
        "financial_qtr": "QP3",
        "ppt_type": "Weekly Tracker",
        "financial_year": "FY2027"
    }).to_list(None)

    print()
    print("=" * 90)
    print("QP3 TARGETS vs ACTUAL (Week " + str(latest_week) + ")")
    print("=" * 90)
    for t in targets:
        ct = t.get("category_type", "?")
        cv = t.get("category_value", "?")
        tv = t.get("target_value", 0)
        actual = region_po.get(ct, 0)
        hit = "YES" if actual >= tv else "NO"
        print(f"  {ct:20s} | {cv:20s} | Target: ${tv:>12,.2f} | QP3 Actual: ${actual:>12,.2f} | Hit? {hit}")

asyncio.run(main())
