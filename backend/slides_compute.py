"""
Slides Computation Module

This module contains functions to compute data for presentation slides.
Each slide has its own computation function that queries MongoDB and returns formatted data.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
import pandas as pd

# Motor creates `AsyncIOMotorDatabase` dynamically via `create_class_with_framework`,
# so static type checkers (Pylance) flag it as "variable not allowed in type
# expression". We alias to `Any` for annotations; runtime behaviour is unchanged.
AsyncIOMotorDatabase = Any

# Global switch for slide chart animations
# Set to True to enable animations, or False to just show the chart statically
ENABLE_CHART_ANIMATION = False

# ============================================================================
# REGION PLACEHOLDER DATA CONFIG
# ============================================================================

REGION_PLACEHOLDERS = {
    "US West": {
        "trend": {
            "weeks": ['Week 50', 'Week 51', 'Week 52', 'Week 02', 'Week 03', 'Week 04', 'Week 05'],
            "po": [1894000, 2314000, 3204000, 3346000, 3815000, 3880000, 4103000],
            "total": [9275000, 9593000, 9958000, 10065000, 10555000, 10685000, 10871000]
        },
        "pipeline": {
            "weeks": ['Week 50', 'Week 51', 'Week 52', 'Week 02', 'Week 03', 'Week 04', 'Week 05'],
            "actual": [15341000, 15376000, 14512000, 14512000, 14531000, 14760000, 14636000],
            "weighted": [7381000, 7278000, 6209000, 6719000, 6736000, 6805000, 6768000]
        }
    },
    "Europe": {
        "trend": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "po": [6258000, 6920000, 7086000, 7045000, 7501000, 7566000, 7927000],
            "total": [9461000, 10114000, 10249000, 10208000, 10743000, 11172000, 11869000]
        },
        "pipeline": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "actual": [9136000, 8944000, 8915000, 8915000, 8984000, 8915000, 8567000],
            "weighted": [3203000, 3194000, 3163000, 3163000, 3242000, 3606000, 3942000]
        }
    },
    "US East": {
        "trend": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "po": [3019000, 3349000, 3495000, 3795000, 3815000, 3861000, 5497000],
            "total": [9259000, 9602000, 9643000, 9758000, 9763000, 10602000, 11045000]
        },
        "pipeline": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "actual": [14079000, 13824000, 13674000, 13468000, 13418000, 14520000, 13540000],
            "weighted": [6240000, 6253000, 6148000, 5963000, 5948000, 6740000, 5548000]
        }
    },
    "Japan": {
        "trend": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "po": [78000, 78000, 78000, 78000, 78000, 78000, 133000],
            "total": [956000, 1012000, 1012000, 1012000, 1012000, 1054000, 1505000]
        },
        "pipeline": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "actual": [2894000, 3081000, 3081000, 3081000, 3081000, 3221000, 3104000],
            "weighted": [877000, 934000, 934000, 934000, 934000, 976000, 1372000]
        }
    },
    "Asean": {
        "trend": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "po": [1844000, 1844000, 1994000, 1994000, 1994000, 2048000, 2048000],
            "total": [1992000, 1993000, 2143000, 2368000, 2368000, 2452000, 2452000]
        },
        "pipeline": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "actual": [218000, 218000, 218000, 218000, 968000, 1068000, 1068000],
            "weighted": [148000, 149000, 149000, 374000, 374000, 404000, 404000]
        }
    },
    "KANZ": {
        "trend": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "po": [0, 0, 0, 0, 138000, 137000, 137000],
            "total": [299000, 299000, 299000, 299000, 437000, 436000, 460000]
        },
        "pipeline": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "actual": [995000, 995000, 995000, 995000, 995000, 995000, 1075000],
            "weighted": [299000, 299000, 299000, 299000, 299000, 299000, 323000]
        }
    },
    "Legacy": {
        "trend": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "po": [2047000, 2216000, 2186000, 2224000, 2224000, 2224000, 2224000],
            "total": [2747000, 2916000, 2886000, 2924000, 2924000, 2924000, 2924000]
        },
        "pipeline": {
            "weeks": ["Week 50", "Week 51", "Week 52", "Week 02", "Week 03", "Week 04", "Week 05"],
            "actual": [1000000, 1000000, 1000000, 1000000, 1000000, 1000000, 1000000],
            "weighted": [700000, 700000, 700000, 700000, 700000, 700000, 700000]
        }
    },
    "Overall - region": {
         "trend": {
            "weeks": ['Week 49', 'Week 50', 'Week 51', 'Week 52', 'Week 02', 'Week 03', 'Week 04', 'Week 05'],
            "po": [12223000, 15139000, 16721000, 18044000, 18483000, 19569000, 19795000, 22069000],
            "total": [32120000, 33988000, 35528000, 36189000, 36633000, 37801000, 39324000, 41125000]
        },
        "pipeline": {
            "weeks": ['Week 49', 'Week 50', 'Week 51', 'Week 52', 'Week 02', 'Week 03', 'Week 04', 'Week 05'],
            "actual": [44621000, 43664000, 43439000, 42396000, 43690000, 42978000, 44480000, 43152000],
            "weighted": [19897000, 18848000, 18806000, 17601000, 18151000, 18232000, 19529000, 19056000]
        }
    }
}


def format_number(num: float) -> str:
    """
    Format number in B/M/K format with 2 decimal points.
    
    Args:
        num: Number to format
        
    Returns:
        Formatted string (e.g., "63.20M", "1.50B", "250.00K", "-181.64K")
    """
    abs_num = abs(num)
    sign = "-" if num < 0 else ""
    
    if abs_num >= 1_000_000_000:
        return f"{sign}{abs_num / 1_000_000_000:.2f}B"
    elif abs_num >= 1_000_000:
        return f"{sign}{abs_num / 1_000_000:.2f}M"
    elif abs_num >= 1_000:
        return f"{sign}{abs_num / 1_000:.2f}K"
    else:
        return f"{num:.2f}"


async def get_current_or_closest_week_data(db: AsyncIOMotorDatabase) -> Optional[pd.DataFrame]:
    """
    Get current week data from weekly_tracker_data collection.
    If current week not found, get the closest week.
    
    Args:
        db: MongoDB database instance
        
    Returns:
        DataFrame with week data, or None if no data found
    """
    # Get current week number
    current_week = datetime.now().isocalendar()[1]
    
    # Try to find current week data
    collection = db["weekly_tracker_data"]
    
    # First, try exact current week
    cursor = collection.find({"week": current_week})
    data = await cursor.to_list(length=None)
    
    if data:
        print(f"✓ Found data for current week {current_week}")
        return pd.DataFrame(data)
    
    # If not found, get the closest week
    print(f"⚠ No data for current week {current_week}, finding closest week...")
    
    # Get all unique weeks
    pipeline = [
        {"$group": {"_id": "$week"}},
        {"$sort": {"_id": -1}}
    ]
    weeks = await collection.aggregate(pipeline).to_list(length=None)
    
    if not weeks:
        print("✗ No weekly data found in database")
        return None
    
    # Find closest week
    available_weeks = [w["_id"] for w in weeks]
    closest_week = min(available_weeks, key=lambda x: abs(x - current_week))
    
    print(f"✓ Using closest week: {closest_week}")
    
    # Fetch data for closest week
    cursor = collection.find({"week": closest_week})
    data = await cursor.to_list(length=None)
    
    return pd.DataFrame(data) if data else None


async def get_target_settings(
    db: AsyncIOMotorDatabase,
    ppt_type: str = "Weekly Tracker",
    fy: str = "FY2027",
    fy_qtr: str = "overall",
    category_type: str = "Overall - region"
) -> Dict[str, float]:
    """
    Get target settings from database.
    
    Args:
        db: MongoDB database instance
        ppt_type: PPT type filter
        fy: Fiscal year filter
        fy_qtr: Fiscal year quarter filter
        category_type: Category type filter
        
    Returns:
        Dictionary with 'stretch_target' and 'base_target' values
    """
    collection = db["target_settings"]
    
    # Query for Stretch Target
    stretch_doc = await collection.find_one({
        "ppt_type": ppt_type,
        "financial_year": fy,  # DB uses 'financial_year' not 'fy'
        "financial_qtr": fy_qtr,  # DB uses 'financial_qtr' not 'fy_qtr'
        "category_type": category_type,
        "category_value": "Stretch Target"
    })
    
    # Query for Base Target (lowercase 'b' in database)
    base_doc = await collection.find_one({
        "ppt_type": ppt_type,
        "financial_year": fy,
        "financial_qtr": fy_qtr,
        "category_type": category_type,
        "category_value": "base target"  # lowercase 'b' in DB
    })
    
    stretch_value = stretch_doc.get("target_value", 0) if stretch_doc else 0
    base_value = base_doc.get("target_value", 0) if base_doc else 0
    
    print(f"✓ Stretch Target: {format_number(stretch_value)}")
    print(f"✓ Base Target: {format_number(base_value)}")
    
    return {
        "stretch_target": stretch_value,
        "base_target": base_value
    }


# ============================================================================
# GENERIC COMPUTE FUNCTIONS
# ============================================================================

async def _compute_cumulative_generic(
    db: AsyncIOMotorDatabase,
    region_name: str,
    target_category: str,
    filter_query: dict = None
) -> Dict:
    """
    Generic function to compute Cumulative Performance vs Targets (Slide 3/7 logic).
    
    Args:
        db: Database
        region_name: Name of region (e.g., 'US West', 'Overall')
        target_category: Category in target_settings ('US West', 'Overall - region')
        filter_query: MongoDB match query for weekly_tracker_data (e.g. {'mRegion': 'US West'})
        
    Returns:
        Dict with slide data
    """
    print("\\n" + "=" * 70)
    print(f"COMPUTING CUMULATIVE DATA FOR {region_name}")
    print("=" * 70)

    # 1. Define quarter order
    quarter_order = ['QP2', 'QP3', 'QP4', 'Q1', 'Q2', 'Q3', 'Q4']
    
    # 2. Fetch targets
    print("\\n[1/4] Fetching quarterly targets...")
    collection_targets = db["target_settings"]
    
    stretch_targets = {q: 0.0 for q in quarter_order}
    base_targets = {q: 0.0 for q in quarter_order}
    
    query = {
        "ppt_type": "Weekly Tracker",
        "financial_year": "FY2027",
        "category_type": target_category,
        "financial_qtr": {"$in": quarter_order}
    }
    print(f"  → Target Query: {query}")
    
    found_count = 0
    async for doc in collection_targets.find(query):
        found_count += 1
        qtr = doc["financial_qtr"]
        val = doc.get("target_value", 0.0)
        cat = doc["category_value"].lower()
        
        print(f"  → Found target: qtr={qtr}, category_value={doc['category_value']}, target_value={val}")
        
        if "stretch" in cat:
            stretch_targets[qtr] = val
        elif "base" in cat:
            base_targets[qtr] = val
    
    print(f"  → Total targets found: {found_count}")
    print(f"  → Base targets: {base_targets}")
    print(f"  → Stretch targets: {stretch_targets}")
            
    # 3. Fetch weekly tracker data
    print("\\n[2/4] Fetching weekly tracker data...")
    dataset_agg = await get_current_or_closest_week_data(db)
    
    if dataset_agg is None or dataset_agg.empty:
        return {"error": "No data available"}
    
    # Apply Region Filter
    if filter_query:
        print(f"  → Filtering by: {filter_query}")
        for key, val in filter_query.items():
            if key in dataset_agg.columns:
                dataset_agg = dataset_agg[dataset_agg[key] == val].copy()
            else:
                print(f"  ⚠ Column {key} not found in dataset")
        
        if dataset_agg.empty:
            return {"error": f"No data available for {region_name}"}

    week_number = int(dataset_agg['week'].iloc[0])
    print(f"✓ Using data from Week {week_number}")

    # 4. Aggregating data
    print("\\n[3/4] Aggregating data...")
    dataset_agg['granular_QTR'] = dataset_agg['granular_QTR'].fillna('Unknown')
    summary = dataset_agg.groupby(['granular_QTR', 'projection - category'])['Weighted Amount'].sum().unstack(fill_value=0)

    # 5. Calculate cumulative sums
    print("\\n[4/4] Applying cumulative logic...")
    closed_won_data = {}
    total_data = {}
    
    today = datetime.now()
    is_before_april1 = today.month < 4 or (today.month == 4 and today.day < 1)
    
    if today.month in [4, 5, 6]: current_cal_qtr = 'Q1'
    elif today.month in [7, 8, 9]: current_cal_qtr = 'Q2'
    elif today.month in [10, 11, 12]: current_cal_qtr = 'Q3'
    else: current_cal_qtr = 'Q4'

    if is_before_april1:
        qtr_map = {'Q1': 'QP2', 'Q2': 'QP3', 'Q3': 'QP4', 'Q4': 'QP4'}
        current_display_qtr = qtr_map.get(current_cal_qtr, 'QP4')
    else:
        current_display_qtr = current_cal_qtr
        
    try:
        current_qtr_idx = quarter_order.index(current_display_qtr)
    except ValueError:
        current_qtr_idx = 2

    # Logic for Closed Won
    if is_before_april1:
        total_closed_won = summary.loc['QP1', 'Closed Won'] if 'QP1' in summary.index and 'Closed Won' in summary.columns else 0
        for qtr in quarter_order:
            val = summary.loc[qtr, 'Closed Won'] if qtr in summary.index and 'Closed Won' in summary.columns else 0
            total_closed_won += val
        
        for i, qtr in enumerate(quarter_order):
            if i < current_qtr_idx:
                closed_won_data[qtr] = 0
            else:
                closed_won_data[qtr] = total_closed_won
    else:
        cum_won = summary.loc['QP1', 'Closed Won'] if 'QP1' in summary.index and 'Closed Won' in summary.columns else 0
        for qtr in quarter_order:
            val = summary.loc[qtr, 'Closed Won'] if qtr in summary.index and 'Closed Won' in summary.columns else 0
            cum_won += val
            closed_won_data[qtr] = cum_won

    # Logic for Total data (Cumulative PO Achieved + Cumulative Pipeline)
    cum_pipe = summary.loc['QP1', 'Pipeline'] if 'QP1' in summary.index and 'Pipeline' in summary.columns else 0
    for qtr in quarter_order:
        pipe = summary.loc[qtr, 'Pipeline'] if qtr in summary.index and 'Pipeline' in summary.columns else 0
        cum_pipe += pipe
        total_data[qtr] = closed_won_data.get(qtr, 0) + cum_pipe

    # Package results
    y_stretch = [stretch_targets.get(q, 0) for q in quarter_order]
    y_base = [base_targets.get(q, 0) for q in quarter_order]
    y_won = [closed_won_data.get(q, 0) for q in quarter_order]
    y_total = [total_data.get(q, 0) for q in quarter_order]

    # Annotations
    all_static_annotations = []
    color_map = {
        'Stretch': "#9d45eb",
        'Base': "#466cd3",
        'Won': "#787878",
        'Total': '#f59e0b'
    }

    for idx, qtr in enumerate(quarter_order):
        values_rank = [
            ('Stretch', y_stretch[idx]),
            ('Base', y_base[idx]),
            ('Total', y_total[idx]),
            ('Won', y_won[idx])
        ]
        values_rank.sort(key=lambda x: x[1], reverse=True)
        
        for rank, (key, val) in enumerate(values_rank):
            ax, ay = 0, 0
            if rank == 0: ax, ay = 0, -40
            elif rank == 1: ax, ay = 30, -25
            elif rank == 2: ax, ay = 30, 25
            else: ax, ay = 0, 40

            if rank > 0:
                prev_val = values_rank[rank-1][1]
                if abs(prev_val - val) < 1_000_000:
                    ax += 20
                    ay += 10 if ay > 0 else -10
            if val > 0:
                ann = {
                    "x": idx, "y": val,
                    "text": f"<b>${val/1e6:.1f}M</b>",
                    "showarrow": True,
                    "arrowhead": 0, "arrowsize": 1, "arrowwidth": 0.5,
                    "arrowcolor": color_map[key],
                    "font": {"size": 12, "color": color_map[key], "family": "Arial"},
                    "bgcolor": "rgba(255,255,255,0.75)",
                    "borderpad": 2,
                    "ax": ax, "ay": ay
                }
                all_static_annotations.append(ann)

    # Calculate proportional progress line based on actual date within the fiscal year
    current_progress_x = current_qtr_idx
    fy_year = today.year if today.month >= 4 else today.year - 1

    if not is_before_april1:
        # We're past April 1 — position within FY quarters (Q1-Q4)
        # Line should be between previous quarter and current quarter during the current quarter
        # and only reach the current quarter tick when that quarter ends
        quarter_date_ranges = [
            (2, datetime(fy_year, 4, 2), datetime(fy_year, 7, 1)),          # Q1: x=2→3 (between QP4 and Q1)
            (3, datetime(fy_year, 7, 1), datetime(fy_year, 10, 1)),         # Q2: x=3→4 (between Q1 and Q2)
            (4, datetime(fy_year, 10, 1), datetime(fy_year + 1, 1, 1)),     # Q3: x=4→5 (between Q2 and Q3)
            (5, datetime(fy_year + 1, 1, 1), datetime(fy_year + 1, 4, 2)),  # Q4: x=5→6 (between Q3 and Q4)
        ]
        for base_x, q_start, q_end in quarter_date_ranges:
            if q_start <= today < q_end:
                days_total = (q_end - q_start).days
                days_elapsed = (today - q_start).days
                current_progress_x = base_x + (days_elapsed / days_total if days_total > 0 else 0)
                break
        else:
            # Before Q1 start (April 1 itself) — place at QP4 tick
            current_progress_x = 2.0
    else:
        # Before April 1 — position within QP range
        qp_date_ranges = [
            (0, datetime(fy_year, 4, 1), datetime(fy_year, 7, 1)),          # QP2: x=0→1
            (1, datetime(fy_year, 7, 1), datetime(fy_year, 10, 1)),         # QP3: x=1→2
            (2, datetime(fy_year, 10, 1), datetime(fy_year + 1, 4, 1)),     # QP4: x=2→3
        ]
        for base_x, q_start, q_end in qp_date_ranges:
            if q_start <= today < q_end:
                days_total = (q_end - q_start).days
                days_elapsed = (today - q_start).days
                current_progress_x = base_x + (days_elapsed / days_total if days_total > 0 else 0)
                break

    return {
        "week": week_number,
        "quarter_order": quarter_order,
        "y_stretch": y_stretch,
        "y_base": y_base,
        "y_won": y_won,
        "y_total": y_total,
        "annotations": all_static_annotations,
        "is_before_april1": is_before_april1,
        "current_display_qtr": current_display_qtr,
        "current_progress_x": current_progress_x,
        "region": region_name,
        "enable_animation": ENABLE_CHART_ANIMATION
    }


async def _compute_trend_generic(
    db: AsyncIOMotorDatabase,
    region_name: str,
    target_category: str,
    filter_query: dict = None
) -> Dict:
    """
    Generic function to compute 8-Week Historical Trend (Slide 4/8 logic).
    Values come from REGION_PLACEHOLDERS + Real Data.
    """
    print("\\n" + "=" * 70)
    print(f"COMPUTING TREND DATA FOR {region_name}")
    print("=" * 70)

    # 1. Fetch Targets
    print("\\n[1/3] Fetching targets...")
    collection_targets = db["target_settings"]
    fy27_base = 0.0
    fy27_stretch = 0.0
    
    max_stretch = 0.0
    max_base = 0.0
    q4_stretch = None
    q4_base = None
    async for doc in collection_targets.find({
        "ppt_type": "Weekly Tracker",
        "financial_year": "FY2027",
        "category_type": target_category
    }):
        val = doc.get("target_value", 0.0)
        cat = doc["category_value"].lower()
        qtr = str(doc.get("financial_qtr", ""))
        if "stretch" in cat:
            max_stretch = max(max_stretch, val)
            if qtr == "Q4":
                q4_stretch = val
        elif "base" in cat:
            max_base = max(max_base, val)
            if qtr == "Q4":
                q4_base = val

    fy27_stretch = q4_stretch if q4_stretch is not None else max_stretch
    fy27_base = q4_base if q4_base is not None else max_base
            
    # 2. Fetch Real Data
    print("\\n[2/3] Fetching available database data...")
    collection_data = db["weekly_tracker_data"]
    
    match_stage = filter_query if filter_query else {}
    if not match_stage and region_name == "Overall":
         match_stage = {} # empty match for all 

    pipeline = []
    if match_stage:
        pipeline.append({"$match": match_stage})
        
    pipeline.extend([
        {"$group": {
            "_id": "$week",
            "po_sum": {
                "$sum": {
                    "$cond": [{"$eq": ["$projection - category", "Closed Won"]}, "$Weighted Amount", 0]
                }
            },
            "pipe_sum": {
                "$sum": {
                    "$cond": [{"$eq": ["$projection - category", "Pipeline"]}, "$Weighted Amount", 0]
                }
            }
        }},
        {"$sort": {"_id": 1}}
    ])
    
    db_weeks = []
    db_po = []
    db_total = []
    
    cursor = collection_data.aggregate(pipeline)
    async for doc in cursor:
        db_weeks.append(doc["_id"])
        po = doc["po_sum"]
        total = po + doc["pipe_sum"]
        db_po.append(po)
        db_total.append(total)

    # 3. Merge with Placeholders
    print("\\n[3/3] Merging placeholder and real data...")

    # Skip placeholders for OPP_Type-filtered (e.g. Services-only) views — the
    # hardcoded placeholders represent total-region values, not type slices.
    is_opp_type_filtered = bool(filter_query and "OPP_Type" in filter_query)

    if is_opp_type_filtered:
        ph_weeks, ph_po, ph_total = [], [], []
    else:
        # Get placeholders
        ph_data = REGION_PLACEHOLDERS.get(region_name, REGION_PLACEHOLDERS.get("Overall - region"))
        # Fallback if specific region name differs from key (e.g. legacy)
        if not ph_data:
            # try find match
            for k in REGION_PLACEHOLDERS:
                if k in region_name or region_name in k:
                    ph_data = REGION_PLACEHOLDERS[k]
                    break

        if ph_data and "trend" in ph_data:
            ph_weeks = ph_data["trend"]["weeks"]
            ph_po = ph_data["trend"]["po"]
            ph_total = ph_data["trend"]["total"]
        else:
            # default to empty if not found
            ph_weeks, ph_po, ph_total = [], [], []

    # Use DB data for weeks > 5 (assuming placeholders cover up to Week 05)
    db_indices = [i for i, w in enumerate(db_weeks) if w > 5]
    filt_db_weeks = [f"Week {str(db_weeks[i]).zfill(2)}" for i in db_indices]
    filt_db_po = [db_po[i] for i in db_indices]
    filt_db_total = [db_total[i] for i in db_indices]
    
    combined_weeks = ph_weeks + filt_db_weeks
    combined_po = ph_po + filt_db_po
    combined_total = ph_total + filt_db_total
    
    final_weeks = combined_weeks[-8:] if len(combined_weeks) >= 8 else combined_weeks
    final_po = combined_po[-8:] if len(combined_po) >= 8 else combined_po
    final_total = combined_total[-8:] if len(combined_total) >= 8 else combined_total

    # 4. Generate Annotations
    styles = {
        'Stretch': {'color': '#9d45eb', 'name': 'Stretch Target'},
        'Base': {'color': '#466cd3', 'name': 'Base Target'},
        'PO': {'color': '#787878', 'name': 'PO Achieved'},
        'Total': {'color': '#f59e0b', 'name': 'PO Achieved+Pipeline'}
    }
    
    all_static_annotations = []
    
    # Targets
    for name, val, style_key in [("Stretch", fy27_stretch, "Stretch")]:
        all_static_annotations.append({
            "x": len(final_weeks) - 1, "y": val,
            "text": f"<b>${val/1e6:.1f}M</b>",
            "showarrow": False,
            "font": {"size": 14, "color": styles[style_key]['color'], "family": "Arial"},
            "bgcolor": "rgba(255,255,255,0.85)",
            "xanchor": 'left', "xshift": 10
        })

    # Dynamic Points
    for idx in range(len(final_weeks)):
        values = [('PO', final_po[idx]), ('Total', final_total[idx])]
        values.sort(key=lambda x: x[1], reverse=True)
        for rank, (key, val) in enumerate(values):
            style = styles[key]
            ay = -35 if rank == 0 else 35
            if rank > 0 and abs(values[rank-1][1] - val) < 2_000_000:
                ay += 15 if ay > 0 else -15
            
            all_static_annotations.append({
                "x": idx, "y": val,
                "text": f"<b>${val/1e6:.2f}M</b>",
                "showarrow": True,
                "arrowhead": 2, "arrowsize": 1, "arrowwidth": 0.5,
                "arrowcolor": style['color'],
                "font": {"size": 12, "color": style['color'], "family": "Arial"},
                "bgcolor": "rgba(255,255,255,0.85)",
                "borderpad": 2,
                "ax": 0, "ay": ay,
                "week_idx": idx,
                "type": "dynamic"
            })

    return {
        "weeks": final_weeks,
        "po_achieved": final_po,
        "po_pipeline": final_total,
        "stretch_target": fy27_stretch,
        "base_target": fy27_base,
        "styles": styles,
        "annotations": all_static_annotations,
        "region": region_name,
        "enable_animation": ENABLE_CHART_ANIMATION
    }


async def _compute_pipeline_generic(
    db: AsyncIOMotorDatabase,
    region_name: str,
    target_category: str,
    filter_query: dict = None
) -> Dict:
    """
    Generic function to compute Actual vs Weighted Pipeline (Slide 5/9 logic).
    """
    print("\\n" + "=" * 70)
    print(f"COMPUTING PIPELINE DATA FOR {region_name}")
    print("=" * 70)

    # 1. Fetch Targets
    collection_targets = db["target_settings"]
    fy27_base = 0.0
    fy27_stretch = 0.0
    
    async for doc in collection_targets.find({
        "ppt_type": "Weekly Tracker",
        "financial_year": "FY2027",
        "category_type": target_category
    }):
        val = doc.get("target_value", 0.0)
        cat = doc["category_value"].lower()
        if "stretch" in cat:
            fy27_stretch = max(fy27_stretch, val)
        elif "base" in cat:
            fy27_base = max(fy27_base, val)

    # 2. Fetch Real Data
    print("\\n[2/3] Fetching available database data...")
    collection_data = db["weekly_tracker_data"]
    
    match_stage = filter_query.copy() if filter_query else {}
    match_stage["projection - category"] = "Pipeline"
    
    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$week",
            "actual_sum": {"$sum": "$Amount"},
            "weighted_sum": {"$sum": "$Weighted Amount"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    db_weeks = []
    db_actual = []
    db_weighted = []
    
    cursor = collection_data.aggregate(pipeline)
    async for doc in cursor:
        db_weeks.append(doc["_id"])
        db_actual.append(doc["actual_sum"])
        db_weighted.append(doc["weighted_sum"])

    # 3. Merge with Placeholders
    print("\\n[3/3] Merging placeholder and real data...")

    # Skip placeholders for OPP_Type-filtered (e.g. Services-only) views.
    is_opp_type_filtered = bool(filter_query and "OPP_Type" in filter_query)

    if is_opp_type_filtered:
        ph_weeks, ph_actual, ph_weighted = [], [], []
    else:
        ph_data = REGION_PLACEHOLDERS.get(region_name, REGION_PLACEHOLDERS.get("Overall - region"))
        # Fallback
        if not ph_data:
            for k in REGION_PLACEHOLDERS:
                if k in region_name or region_name in k:
                    ph_data = REGION_PLACEHOLDERS[k]
                    break

        if ph_data and "pipeline" in ph_data:
            ph_weeks = ph_data["pipeline"]["weeks"]
            ph_actual = ph_data["pipeline"]["actual"]
            ph_weighted = ph_data["pipeline"]["weighted"]
        else:
            ph_weeks, ph_actual, ph_weighted = [], [], []
        
    db_indices = [i for i, w in enumerate(db_weeks) if w > 5]
    filt_db_weeks = [f"Week {str(db_weeks[i]).zfill(2)}" for i in db_indices]
    filt_db_actual = [db_actual[i] for i in db_indices]
    filt_db_weighted = [db_weighted[i] for i in db_indices]
    
    combined_weeks = ph_weeks + filt_db_weeks
    combined_actual = ph_actual + filt_db_actual
    combined_weighted = ph_weighted + filt_db_weighted
    
    final_weeks = combined_weeks[-8:] if len(combined_weeks) >= 8 else combined_weeks
    final_actual = combined_actual[-8:] if len(combined_actual) >= 8 else combined_actual
    final_weighted = combined_weighted[-8:] if len(combined_weighted) >= 8 else combined_weighted

    # 4. Generate Annotations & Styles
    styles = {
        'Actual': {'color': 'rgb(0, 102, 153)', 'name': 'Actuals Pipeline'},
        'Weighted': {'color': 'rgb(255, 127, 39)', 'name': 'W Pipeline'},
        'Stretch': {'color': 'rgb(75, 0, 130)', 'name': 'Stretch Target'},
        'Base': {'color': 'rgb(0, 128, 0)', 'name': 'Base Target'}
    }
    
    annotations = []
    # Static annotations for targets
    for name, val, style_key in [("Stretch", fy27_stretch, "Stretch")]:
        annotations.append({
            "x": len(final_weeks) - 0.5, "y": val,
            "text": f"<b>${val/1e6:.1f}M</b>",
            "showarrow": False,
            "font": {"size": 14, "color": styles[style_key]['color'], "family": "Arial"},
            "bgcolor": "rgba(255,255,255,0.85)",
            "xanchor": 'left', "xshift": 10
        })

    # Extract current week number from the last item in final_weeks
    current_data_week = None
    if final_weeks:
        last_week_str = final_weeks[-1] # e.g. "Week 05"
        try:
            current_data_week = int(last_week_str.replace("Week", "").strip())
        except ValueError:
            current_data_week = None

    return {
        "weeks": final_weeks,
        "actual_pipeline": final_actual,
        "weighted_pipeline": final_weighted,
        "stretch_target": fy27_stretch,
        "base_target": fy27_base,
        "styles": styles,
        "annotations": annotations,
        "region": region_name,
        "current_week": current_data_week,
        "enable_animation": ENABLE_CHART_ANIMATION
    }



async def compute_slide1_data(db: AsyncIOMotorDatabase) -> Dict[str, str]:
    """
    Compute data for Slide 1.
    
    Slide 1 shows:
    - Stretch Target
    - Base Target
    - Total PO (Closed Won weighted amount)
    - Total W.Forecast (Pipeline weighted amount)
    
    Args:
        db: MongoDB database instance
        
    Returns:
        Dictionary with formatted values for display
    """
    print("\n" + "=" * 70)
    print("COMPUTING SLIDE 1 DATA")
    print("=" * 70)
    
    # Step 1: Get current/closest week data
    print("\n[1/3] Fetching weekly tracker data...")
    dataset_agg = await get_current_or_closest_week_data(db)
    
    if dataset_agg is None or dataset_agg.empty:
        print("✗ No data available for computation")
        return {
            "stretch_target": "0.00",
            "base_target": "0.00",
            "total_po": "0.00",
            "total_w_forecast": "0.00",
            "error": "No data available"
        }
    
    print(f"✓ Loaded {len(dataset_agg)} records")
    
    # Extract week number from the data
    week_number = None
    try:
        if 'week' in dataset_agg.columns and len(dataset_agg) > 0:
            week_number = int(dataset_agg['week'].iloc[0])
            print(f"  → Week: {week_number}")
    except Exception as e:
        print(f"  ⚠ Could not extract week number: {e}")
    
    # Step 2: Get target settings
    print("\n[2/3] Fetching target settings...")
    targets = await get_target_settings(db)
    
    # Step 3: Compute metrics
    print("\n[3/3] Computing metrics...")
    
    # Total weighted amount (PO + Pipeline)
    total_weighted_amount_PO_pipeline = dataset_agg['Weighted Amount'].sum()
    print(f"  → Total Weighted Amount: {format_number(total_weighted_amount_PO_pipeline)}")
    
    # Closed Won (PO Achieved)
    dataset_PO_ach = dataset_agg[dataset_agg["projection - category"] == "Closed Won"]
    dataset_PO_ach_sum = dataset_PO_ach['Weighted Amount'].sum()
    print(f"  → Total PO (Closed Won): {format_number(dataset_PO_ach_sum)}")
    
    # Pipeline
    dataset_pipeline = dataset_agg[dataset_agg["projection - category"] == "Pipeline"]
    dataset_pipeline_sum = dataset_pipeline['Weighted Amount'].sum()
    dataset_pipeline_sum_full = dataset_pipeline['Amount'].sum()
    print(f"  → Total W.Forecast (Pipeline): {format_number(dataset_pipeline_sum)}")
    print(f"  → Total Pipeline (Full Amount): {format_number(dataset_pipeline_sum_full)}")
    
    # Prepare final output
    result = {
        "week": week_number,
        "stretch_target": format_number(targets["stretch_target"]),
        "base_target": format_number(targets["base_target"]),
        "total_po": format_number(dataset_PO_ach_sum),
        "total_w_forecast": format_number(dataset_pipeline_sum),
        "enable_animation": ENABLE_CHART_ANIMATION
    }
    
    print("\n" + "=" * 70)
    print("SLIDE 1 DATA COMPUTED")
    print("=" * 70)
    print(f"Week              -- {result['week']}")
    print(f"Stretch Target    -- {result['stretch_target']}")
    print(f"Base Target       -- {result['base_target']}")
    print(f"Total PO          -- {result['total_po']}")
    print(f"Total W.Forecast  -- {result['total_w_forecast']}")
    print("=" * 70)
    
    return result


async def get_week_data(db: AsyncIOMotorDatabase, week_number: int) -> Optional[pd.DataFrame]:
    """
    Get data for a specific week from weekly_tracker_data collection.
    
    Args:
        db: MongoDB database instance
        week_number: Week number to fetch
        
    Returns:
        DataFrame with week data, or None if not found
    """
    collection = db["weekly_tracker_data"]
    cursor = collection.find({"week": week_number})
    data = await cursor.to_list(length=None)
    
    if data:
        print(f"✓ Found data for week {week_number}")
        return pd.DataFrame(data)
    else:
        print(f"⚠ No data found for week {week_number}")
        return None


async def get_previous_week_data(db: AsyncIOMotorDatabase, current_week: int) -> Optional[pd.DataFrame]:
    """
    Get data for the week before the specified week.
    
    Args:
        db: MongoDB database instance
        current_week: Current week number
        
    Returns:
        DataFrame with previous week data, or None if not found
    """
    collection = db["weekly_tracker_data"]
    
    # Get all unique weeks less than current week
    pipeline = [
        {"$match": {"week": {"$lt": current_week}}},
        {"$group": {"_id": "$week"}},
        {"$sort": {"_id": -1}},
        {"$limit": 1}
    ]
    weeks = await collection.aggregate(pipeline).to_list(length=None)
    
    if not weeks:
        print(f"⚠ No previous week data found before week {current_week}")
        return None
    
    previous_week = weeks[0]["_id"]
    print(f"✓ Previous week is: {previous_week}")
    
    # Fetch data for previous week
    cursor = collection.find({"week": previous_week})
    data = await cursor.to_list(length=None)
    return pd.DataFrame(data) if data else None


async def compute_slide2_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 2.
    
    Slide 2 shows three pie charts:
    - Previous week Base Target (smaller)
    - Current week Base Target
    - Current week Stretch Target
    
    Args:
        db: MongoDB database instance
        
    Returns:
        Dictionary with data for all three pie charts
    """
    print("\n" + "=" * 70)
    print("COMPUTING SLIDE 2 DATA")
    print("=" * 70)
    
    # Step 1: Get current/closest week data
    print("\n[1/3] Fetching current week data...")
    current_data = await get_current_or_closest_week_data(db)
    
    if current_data is None or current_data.empty:
        print("✗ No current week data available")
        return {"error": "No data available"}
    
    # Extract current week number
    current_week = None
    try:
        if 'week' in current_data.columns and len(current_data) > 0:
            current_week = int(current_data['week'].iloc[0])
            print(f"  → Current week: {current_week}")
    except Exception as e:
        print(f"  ✗ Could not extract week number: {e}")
        return {"error": "Could not determine week number"}
    
    # Step 2: Get previous week data
    print("\n[2/3] Fetching previous week data...")
    previous_data = await get_previous_week_data(db, current_week)
    
    if previous_data is None or previous_data.empty:
        print("✗ No previous week data available")
        return {"error": "No previous week data available"}
    
    previous_week = int(previous_data['week'].iloc[0])
    
    # Step 3: Get target settings
    print("\n[3/3] Fetching target settings and computing metrics...")
    targets = await get_target_settings(db)
    
    base_target = targets["base_target"]
    stretch_target = targets["stretch_target"]
    
    # Compute CURRENT week metrics
    current_po_ach = current_data[current_data["projection - category"] == "Closed Won"]
    current_po_sum = current_po_ach['Weighted Amount'].sum()
    
    current_pipeline = current_data[current_data["projection - category"] == "Pipeline"]
    current_pipeline_sum = current_pipeline['Weighted Amount'].sum()
    
    current_total = current_po_sum + current_pipeline_sum
    
    current_base_deficit = base_target - current_total
    current_stretch_deficit = base_target - current_total  # Will be recalculated below for stretch
    current_stretch_deficit = stretch_target - current_total
    
    # Compute PREVIOUS week metrics
    prev_po_ach = previous_data[previous_data["projection - category"] == "Closed Won"]
    prev_po_sum = prev_po_ach['Weighted Amount'].sum()
    
    prev_pipeline = previous_data[previous_data["projection - category"] == "Pipeline"]
    prev_pipeline_sum = prev_pipeline['Weighted Amount'].sum()
    
    prev_total = prev_po_sum + prev_pipeline_sum
    prev_base_deficit = base_target - prev_total
    
    # Prepare result with all three pie charts
    result = {
        "current_week": current_week,
        "previous_week": previous_week,
        "base_target": base_target,
        "stretch_target": stretch_target,
        
        # Previous Week Base Target Pie Chart
        "prev_week_base": {
            "week": previous_week,
            "target": base_target,
            "deficit": prev_base_deficit,
            "po": prev_po_sum,
            "pipeline": prev_pipeline_sum,
            "total": prev_total,
            "achievement_pct": (prev_total / base_target * 100) if base_target > 0 else 0
        },
        
        # Current Week Base Target Pie Chart
        "current_week_base": {
            "week": current_week,
            "target": base_target,
            "deficit": current_base_deficit,
            "po": current_po_sum,
            "pipeline": current_pipeline_sum,
            "total": current_total,
            "achievement_pct": (current_total / base_target * 100) if base_target > 0 else 0
        },
        
        # Current Week Stretch Target Pie Chart
        "current_week_stretch": {
            "week": current_week,
            "target": stretch_target,
            "deficit": current_stretch_deficit,
            "po": current_po_sum,
            "pipeline": current_pipeline_sum,
            "total": current_total,
            "achievement_pct": (current_total / stretch_target * 100) if stretch_target > 0 else 0
        },
        "enable_animation": ENABLE_CHART_ANIMATION
    }
    
    print("\n" + "=" * 70)
    print("SLIDE 2 DATA COMPUTED")
    print("=" * 70)
    print(f"Previous Week: {previous_week} | Current Week: {current_week}")
    print(f"Base Target: ${base_target:,.2f} | Stretch Target: ${stretch_target:,.2f}")
    print(f"\nPrevious Week Base: PO=${prev_po_sum:,.2f}, Pipeline=${prev_pipeline_sum:,.2f}, Deficit=${prev_base_deficit:,.2f}")
    print(f"Current Week Base: PO=${current_po_sum:,.2f}, Pipeline=${current_pipeline_sum:,.2f}, Deficit=${current_base_deficit:,.2f}")
    print(f"Current Week Stretch: PO=${current_po_sum:,.2f}, Pipeline=${current_pipeline_sum:,.2f}, Deficit=${current_stretch_deficit:,.2f}")
    print("=" * 70)
    
    return result

async def compute_slide3_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 3 (Cumulative Performance vs Targets).
    
    Args:
        db: MongoDB database instance
        
    Returns:
        Dictionary with data points, targets, and annotations for Slide 3
    """
    return await _compute_cumulative_generic(
        db,
        region_name="Overall",
        target_category="Overall - region",
        filter_query=None
    )


async def compute_slide4_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 4 (8-Week Historical Trend).
    
    Args:
        db: MongoDB database instance
        
    Returns:
        Dictionary with historical data points, targets, and annotations for Slide 4
    """
    return await _compute_trend_generic(
        db,
        region_name="Overall",
        target_category="Overall - region",
        filter_query=None
    )


async def compute_slide5_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 5 (Pipeline Comparison).
    """
    return await _compute_pipeline_generic(
        db,
        region_name="Overall",
        target_category="Overall - region",
        filter_query=None
    )

async def compute_slide6_data(db):
    """
    Compute data for Slide 6 of the presentation.
    Region-wise PO breakdown with Q4 and Current QTR targets.
    """
    print("\n" + "=" * 70)
    print("COMPUTING SLIDE 6 DATA (Region-wise PO Breakdown)")
    print("=" * 70)

    # 1. Get current week or closest week
    current_week = datetime.now().isocalendar()[1]
    collection_data = db["weekly_tracker_data"]
    
    # Check if current week exists
    doc_count = await collection_data.count_documents({"week": current_week})
    
    if doc_count > 0:
        target_week = current_week
    else:
        # Find closest week
        all_weeks_cursor = collection_data.aggregate([
            {"$group": {"_id": "$week"}},
            {"$sort": {"_id": -1}},
            {"$limit": 1}
        ])
        latest_week_doc = await all_weeks_cursor.to_list(length=1)
        target_week = latest_week_doc[0]["_id"] if latest_week_doc else current_week
    
    print(f"✓ Using Week {target_week} data")

    # 2. Define region display order
    # Database regions: 'US West', 'Europe', 'US East', 'Asean', 'Japan', 'KANZ', 'Legacy'
    # Display order: West, Europe, East, Asean, Japan, KANZ, Legacy
    region_order = ['US West', 'Europe', 'US East', 'Asean', 'Japan', 'KANZ', 'Legacy']
    region_display_names = {
        'US West': 'US-West',
        'Europe': 'Europe + Israel',
        'US East': 'US-East',
        'Asean': 'ASEAN',
        'Japan': 'Japan',
        'KANZ': 'KANZ',
        'Legacy': 'Management'
    }

    # 3. Get current quarter (FY2027 quarters: QP2, QP3, QP4, Q1, Q2, Q3, Q4)
    # FY2027 starts in April 2026 (approximately)
    # Current date is Feb 2026, which is QP4 of FY2027
    # Week 1-13: QP4, 14-26: Q1, 27-39: Q2, 40-52: Q3 (approximate for FY2027)
    if target_week <= 13:
        current_qtr = "QP4"
    elif target_week <= 26:
        current_qtr = "Q1"
    elif target_week <= 39:
        current_qtr = "Q2"
    else:
        current_qtr = "Q3"
    
    print(f"✓ Current Quarter: {current_qtr}")

    # 4. Fetch targets for all quarters
    collection_targets = db["target_settings"]
    all_quarters = ['QP2', 'QP3', 'QP4', 'Q1', 'Q2', 'Q3', 'Q4']
    
    # Structure: region -> { q4_target, current_qtr_target, base_targets: {}, stretch_targets: {} }
    region_targets = {r: {'q4_target': 0, 'current_qtr_target': 0, 'base_targets': {}, 'stretch_targets': {}} for r in region_order}
    
    # Fetch all relevant targets in one query
    async for doc in collection_targets.find({
        "ppt_type": "Weekly Tracker",
        "financial_year": "FY2027",
        "financial_qtr": {"$in": all_quarters},
        "category_type": {"$in": region_order}
    }):
        region = doc.get("category_type")
        qtr = doc.get("financial_qtr")
        val = doc.get("target_value", 0.0)
        cat = doc.get("category_value", "").lower()
        
        if region in region_targets:
            if "stretch" in cat:
                region_targets[region]['stretch_targets'][qtr] = val
                # Update specific metrics based on stretch targets
                if qtr == "Q4":
                    region_targets[region]['q4_target'] = max(region_targets[region]['q4_target'], val)
                if qtr == current_qtr:
                    region_targets[region]['current_qtr_target'] = max(region_targets[region]['current_qtr_target'], val)
            elif "base" in cat:
                region_targets[region]['base_targets'][qtr] = val

    # 5. Aggregate PO Achieved by region from weekly_tracker_data (historical + current)
    # First get PO achieved per week for each region up to target_week
    pipeline_all_weeks = [
        {
            "$match": {
                "week": {"$lte": target_week},
                "projection - category": "Closed Won"
            }
        },
        {
            "$group": {
                "_id": {"region": "$mRegion", "week": "$week"},
                "po_sum": {"$sum": "$Weighted Amount"}
            }
        }
    ]
    
    # Initialize with all regions from region_order, but also track ALL regions from DB
    region_week_po = {r: {} for r in region_order}
    all_db_regions = set()
    
    async for doc in collection_data.aggregate(pipeline_all_weeks):
        r = doc["_id"]["region"]
        w = doc["_id"]["week"]
        all_db_regions.add(r)
        
        # Include ALL regions, not just those in region_order
        if r not in region_week_po:
            region_week_po[r] = {}
        region_week_po[r][w] = doc["po_sum"]

    # Fill in missing weeks with previous week's value (cumulative)
    # Do this for ALL regions found in database
    for r in region_week_po.keys():
        current_po = 0
        for w in range(1, target_week + 1):
            if w in region_week_po[r]:
                current_po = region_week_po[r][w]
            else:
                region_week_po[r][w] = current_po

    # Current PO per region is just the PO at target_week
    # Include ALL regions from database
    region_po = {r: region_week_po[r].get(target_week, 0) for r in region_week_po.keys()}
    
    # Identify regions not in region_order (these were previously excluded)
    unlisted_regions = set(region_po.keys()) - set(region_order)
    if unlisted_regions:
        print(f"  ⚠ Found {len(unlisted_regions)} region(s) not in region_order: {list(unlisted_regions)}")
        unlisted_po = sum(region_po[r] for r in unlisted_regions)
        print(f"    → These regions contribute ${unlisted_po:,.2f} to the total")
    
    print(f"✓ Aggregated PO for {len(region_po)} regions: {list(region_po.keys())}")
    print(f"  → Total PO across all regions: ${sum(region_po.values()):,.2f}")

    # Define quarter end weeks for marker logic
    qtr_end_weeks = {
        'QP2': 0,
        'QP3': 0,
        'QP4': 13,
        'Q1': 26,
        'Q2': 39,
        'Q3': 52,
        'Q4': 65
    }

    # Generate milestones with status logic
    for r in region_order:
        milestones = {}
        po_current = region_po.get(r, 0)
        
        # Base targets
        for qtr, val in region_targets[r]['base_targets'].items():
            if val <= 0: continue
            
            # Historical quarters (QP2, QP3) are assumed automatically achieved
            # on time since they are from preceding years
            if qtr in ['QP2', 'QP3']:
                status = "green"
            else:
                # end_week = qtr_end_weeks.get(qtr, 52)
                # eval_week = min(end_week, target_week)
                # po_at_qtr_end = region_week_po[r].get(eval_week, 0)
                
                # if po_at_qtr_end >= val:
                #     status = "green"
                # elif po_current >= val:
                #     status = "red"
                # else:
                #     status = "none"
                if po_current >= val:
                    status = "green"
                else:
                    status = "none"
            milestones[qtr] = {"value": val, "status": status}
            
        # Stretch targets
        for qtr, val in region_targets[r]['stretch_targets'].items():
            if val <= 0: continue
            
            if qtr in ['QP2', 'QP3']:
                # status = "purple"
                status = "green"  # Using green universally for all achieved
            else:
                # end_week = qtr_end_weeks.get(qtr, 52)
                # eval_week = min(end_week, target_week)
                # po_at_qtr_end = region_week_po[r].get(eval_week, 0)
                
                # if po_at_qtr_end >= val:
                #     status = "purple"
                # elif po_current >= val:
                #     status = "red"
                # else:
                #     status = "none"
                if po_current >= val:
                    status = "green"
                else:
                    status = "none"
            milestones["S" + qtr] = {"value": val, "status": status}
            
        region_targets[r]['milestones'] = milestones

    # 6. Build result rows
    rows = []
    total_q4 = 0
    total_current_qtr = 0
    total_po = 0
    total_prev_po = 0
    
    # First, calculate the TRUE total across ALL regions (including ones not in region_order)
    for region_db in region_po.keys():
        po_achieved = region_po.get(region_db, 0)
        prev_po_achieved = region_week_po[region_db].get(target_week - 1, 0) if region_db in region_week_po else 0
        
        total_po += po_achieved
        total_prev_po += prev_po_achieved
        
        # Add targets only for regions in region_order
        if region_db in region_targets:
            total_q4 += region_targets[region_db]['q4_target']
            total_current_qtr += region_targets[region_db]['current_qtr_target']
    
    # Now build the display rows for regions in region_order only
    for region_db in region_order:
        display_name = region_display_names.get(region_db, region_db)
        q4_target = region_targets[region_db]['q4_target']
        current_qtr_target = region_targets[region_db]['current_qtr_target']
        po_achieved = region_po.get(region_db, 0)
        prev_po_achieved = region_week_po[region_db].get(target_week - 1, 0)
        
        percentage = (po_achieved / q4_target * 100) if q4_target > 0 else 0
        
        rows.append({
            "region": display_name,
            "q4_stretch_target": q4_target,
            "current_qtr_stretch_target": current_qtr_target,
            "milestones": region_targets[region_db]['milestones'],
            "po_achieved": po_achieved,
            "prev_po_achieved": prev_po_achieved,
            "percentage": round(percentage)
        })
    
    # Total row
    total_percentage = (total_po / total_q4 * 100) if total_q4 > 0 else 0
    
    # Sum milestones for total based on values only
    # Calculate global milestones properly with total values and evaluating total POs
    total_milestones = {}
    
    # First, calculate total target values for each quarter
    total_base_targets = {}
    total_stretch_targets = {}
    for q in all_quarters:
        total_base_targets[q] = sum(region_targets[r]['base_targets'].get(q, 0) for r in region_order)
        total_stretch_targets[q] = sum(region_targets[r]['stretch_targets'].get(q, 0) for r in region_order)
        
    # Also we need total PO sum per week for global total markers
    # Include ALL regions, not just region_order
    total_week_po = {}
    for w in range(1, target_week + 1):
        total_week_po[w] = sum(region_week_po[r].get(w, 0) for r in region_week_po.keys())
        
    for qtr, val in total_base_targets.items():
        if val <= 0: continue
        
        if qtr in ['QP2', 'QP3']:
             status = "green"
        else:
            # end_week = qtr_end_weeks.get(qtr, 52)
            # eval_week = min(end_week, target_week)
            # po_at_qtr_end = total_week_po.get(eval_week, 0)
            
            # if po_at_qtr_end >= val:
            #     status = "green"
            # elif total_po >= val:
            #     status = "red"
            # else:
            #     status = "none"
            if total_po >= val:
                status = "green"
            else:
                status = "none"
        total_milestones[qtr] = {"value": val, "status": status}
        
    for qtr, val in total_stretch_targets.items():
        if val <= 0: continue
        
        if qtr in ['QP2', 'QP3']:
            # status = "purple"
            status = "green" # Using green universally for all achieved
        else:
            # end_week = qtr_end_weeks.get(qtr, 52)
            # eval_week = min(end_week, target_week)
            # po_at_qtr_end = total_week_po.get(eval_week, 0)
            
            # if po_at_qtr_end >= val:
            #     status = "purple"
            # elif total_po >= val:
            #     status = "red"
            # else:
            #     status = "none"
            if total_po >= val:
                status = "green"
            else:
                status = "none"
        total_milestones["S" + qtr] = {"value": val, "status": status}

    total_row = {
        "region": "Total",
        "q4_stretch_target": total_q4,
        "current_qtr_stretch_target": total_current_qtr,
        "milestones": total_milestones,
        "po_achieved": total_po,
        "prev_po_achieved": total_prev_po,
        "percentage": round(total_percentage)
    }

    result = {
        "week": target_week,
        "current_quarter": current_qtr,
        "rows": rows,
        "total": total_row,
        "enable_animation": ENABLE_CHART_ANIMATION
    }
    
    print("=" * 70)
    return result


# ============================================================================
# SLIDE 7, 8, 9: US WEST REGION-SPECIFIC SLIDES
# ============================================================================

async def compute_slide7_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 7 (US West Cumulative Performance vs Targets).
    """
    return await _compute_cumulative_generic(
        db,
        region_name="US West",
        target_category="US West",
        filter_query={"mRegion": "US West"}
    )



async def compute_slide8_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 8 (US West Pipeline Tracking Over Time).
    """
    return await _compute_trend_generic(
        db,
        region_name="US West",
        target_category="US West",
        filter_query={"mRegion": "US West"}
    )



async def compute_slide9_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 9 (US West Actuals vs Pipeline Weekly Bars).
    """
    return await _compute_pipeline_generic(
        db,
        region_name="US West",
        target_category="US West",
        filter_query={"mRegion": "US West"}
    )

async def compute_slide10_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 10 (Europe Cumulative Performance vs Targets).
    """
    return await _compute_cumulative_generic(
        db,
        region_name="Europe",
        target_category="Europe",
        filter_query={"mRegion": "Europe"}
    )


async def compute_slide11_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 11 (Europe Pipeline Tracking Over Time).
    """
    return await _compute_trend_generic(
        db,
        region_name="Europe",
        target_category="Europe",
        filter_query={"mRegion": "Europe"}
    )


async def compute_slide12_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 12 (Europe Actuals vs Pipeline Weekly Bars).
    """
    return await _compute_pipeline_generic(
        db,
        region_name="Europe",
        target_category="Europe",
        filter_query={"mRegion": "Europe"}
    )


async def compute_slide13_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 13 (US East Cumulative Performance vs Targets).
    """
    return await _compute_cumulative_generic(
        db,
        region_name="US East",
        target_category="US East",
        filter_query={"mRegion": "US East"}
    )


async def compute_slide14_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 14 (US East Pipeline Tracking Over Time).
    """
    return await _compute_trend_generic(
        db,
        region_name="US East",
        target_category="US East",
        filter_query={"mRegion": "US East"}
    )


async def compute_slide15_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 15 (US East Actuals vs Pipeline Weekly Bars).
    """
    return await _compute_pipeline_generic(
        db,
        region_name="US East",
        target_category="US East",
        filter_query={"mRegion": "US East"}
    )


async def compute_slide16_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 16 (Asean Cumulative Performance vs Targets).
    """
    return await _compute_cumulative_generic(
        db,
        region_name="Asean",
        target_category="Asean",
        filter_query={"mRegion": "Asean"}
    )


async def compute_slide17_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 17 (Asean Pipeline Tracking Over Time).
    """
    return await _compute_trend_generic(
        db,
        region_name="Asean",
        target_category="Asean",
        filter_query={"mRegion": "Asean"}
    )


async def compute_slide18_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 18 (Asean Actuals vs Pipeline Weekly Bars).
    """
    return await _compute_pipeline_generic(
        db,
        region_name="Asean",
        target_category="Asean",
        filter_query={"mRegion": "Asean"}
    )


async def compute_slide19_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 19 (Japan Cumulative Performance vs Targets).
    """
    return await _compute_cumulative_generic(
        db,
        region_name="Japan",
        target_category="Japan",
        filter_query={"mRegion": "Japan"}
    )


async def compute_slide20_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 20 (Japan Pipeline Tracking Over Time).
    """
    return await _compute_trend_generic(
        db,
        region_name="Japan",
        target_category="Japan",
        filter_query={"mRegion": "Japan"}
    )


async def compute_slide21_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 21 (Japan Actuals vs Pipeline Weekly Bars).
    """
    return await _compute_pipeline_generic(
        db,
        region_name="Japan",
        target_category="Japan",
        filter_query={"mRegion": "Japan"}
    )


async def compute_slide22_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 22 (KANZ Cumulative Performance vs Targets).
    """
    return await _compute_cumulative_generic(
        db,
        region_name="KANZ",
        target_category="KANZ",
        filter_query={"mRegion": "KANZ"}
    )


async def compute_slide23_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 23 (KANZ Pipeline Tracking Over Time).
    """
    return await _compute_trend_generic(
        db,
        region_name="KANZ",
        target_category="KANZ",
        filter_query={"mRegion": "KANZ"}
    )


async def compute_slide24_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 24 (KANZ Actuals vs Pipeline Weekly Bars).
    """
    return await _compute_pipeline_generic(
        db,
        region_name="KANZ",
        target_category="KANZ",
        filter_query={"mRegion": "KANZ"}
    )


async def compute_slide25_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide 25 (Legacy Cumulative Performance vs Targets).
    """
    return await _compute_cumulative_generic(
        db,
        region_name="Legacy",
        target_category="Legacy",
        filter_query={"mRegion": "Legacy"}
    )


async def compute_slide26_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 26 (Legacy Pipeline Tracking Over Time).
    """
    return await _compute_trend_generic(
        db,
        region_name="Legacy",
        target_category="Legacy",
        filter_query={"mRegion": "Legacy"}
    )


async def compute_slide27_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide 27 (Legacy Actuals vs Pipeline Weekly Bars).
    """
    return await _compute_pipeline_generic(
        db,
        region_name="Legacy",
        target_category="Legacy",
        filter_query={"mRegion": "Legacy"}
    )


async def compute_order_backlog_data(
    db: AsyncIOMotorDatabase,
    region_name: str = "Overall",
    opp_type_filter: Optional[str] = None,
) -> Dict:
    """
    Compute data for the Order Backlog Slide.
    
    Queries the 'orderbacklogs' collection to get the sum of unInvoiced amounts for
    the past 8 uploaded weeks.
    
    Args:
        db: MongoDB database instance
        region_name: The region to filter by, or "Overall" for all regions combined.
        opp_type_filter: Optional OPP_Type filter (e.g. 'Service'). When set, hardcoded
            placeholders are skipped because they represent total backlog, not OPP_Type slices.
        
    Returns:
        Dict with weeks, backlog values, formatting styles, etc.
    """
    print(f"\n" + "=" * 70)
    print(f"COMPUTING ORDER BACKLOG DATA FOR {region_name}"
          f"{' (Services only)' if opp_type_filter else ''}")
    print("=" * 70)

    collection_data = db["orderbacklogs"]
    
    # 1. Pipeline to get aggregated data
    match_stage = {}
    if region_name != "Overall":
        match_stage["mRegion"] = region_name
    if opp_type_filter:
        match_stage["OPP_Type"] = opp_type_filter

    pipeline = []
    if match_stage:
        pipeline.append({"$match": match_stage})

    pipeline.extend([
        {"$group": {
            "_id": "$week",
            "backlog_sum": {"$sum": "$Amount - unInvoiced"}
        }},
        {"$sort": {"_id": 1}}
    ])

    db_weeks = []
    db_backlogs = []
    
    cursor = collection_data.aggregate(pipeline)
    async for doc in cursor:
        db_weeks.append(doc["_id"])
        db_backlogs.append(doc["backlog_sum"])

    ph_weeks = ['Week 03', 'Week 04', 'Week 05', 'Week 06', 'Week 07', 'Week 08', 'Week 09', 'Week 10']

    # When filtering by OPP_Type (e.g. Services-only), hardcoded placeholders are not
    # representative of that slice — start with empty placeholders so the chart shows
    # only real data once it begins flowing in.
    if opp_type_filter:
        ph_backlogs = [0, 0, 0, 0, 0, 0, 0, 0]
    elif region_name == "Overall":
        ph_backlogs = [33916000, 33756000, 35131000, 36232000, 36743000, 36932000, 36142000, 35035000]
    elif region_name == "US West":
        ph_backlogs = [7706000, 7669000, 7587000, 8035000, 8151000, 9051000, 8172000, 8099000]
    elif region_name == "Europe":
        ph_backlogs = [11941000, 11846000, 11776000, 12341000, 12186000, 11645000, 11309000, 11259000]
    elif region_name == "US East":
        ph_backlogs = [7678000, 7621000, 9201000, 9310000, 9310000, 9135000, 9520000, 8497000]
    elif region_name == "Japan":
        ph_backlogs = [499000, 475000, 434000, 1090000, 1073000, 1024000, 1125000, 1078000]
    elif region_name == "Asean":
        ph_backlogs = [2496000, 2552000, 2556000, 2463000, 2438000, 2436000, 2430000, 2386000]
    elif region_name == "KANZ":
        ph_backlogs = [447000, 453000, 454000, 451000, 449000, 443000, 435000, 453000]
    elif region_name == "Legacy":
        ph_backlogs = [3148000, 3139000, 3123000, 2543000, 3137000, 3198000, 3151000, 3263000]
    else:
        ph_backlogs = [4916000, 4756000, 5131000, 6232000, 6743000, 6932000, 6142000, 5035000]

    db_indices = [i for i, w in enumerate(db_weeks) if w > 10]
    filt_db_weeks = [f"Week {str(db_weeks[i]).zfill(2)}" for i in db_indices]
    filt_db_backlogs = [db_backlogs[i] for i in db_indices]

    combined_weeks = ph_weeks + filt_db_weeks
    combined_backlogs = ph_backlogs + filt_db_backlogs

    final_weeks = combined_weeks[-8:] if len(combined_weeks) >= 8 else combined_weeks
    final_backlogs = combined_backlogs[-8:] if len(combined_backlogs) >= 8 else combined_backlogs

    styles = {
        'Backlog': {'color': '#1f6e8c', 'name': 'Order Backlog'}
    }
    
    annotations = []
    for idx in range(len(final_weeks)):
        val = final_backlogs[idx]
        
        annotations.append({
            "x": idx, "y": val,
            "text": f"<b>${val/1e6:.3f}M</b>",
            "showarrow": True,
            "arrowhead": 0, "arrowsize": 1, "arrowwidth": 0,
            "arrowcolor": styles['Backlog']['color'],
            "font": {"size": 12, "color": '#000000', "family": "Arial"},
            "ax": 0, "ay": -20,
            "week_idx": idx,
            "type": "dynamic"
        })

    return {
        "weeks": final_weeks,
        "backlog_data": final_backlogs,
        "styles": styles,
        "annotations": annotations,
        "region": region_name,
        "enable_animation": ENABLE_CHART_ANIMATION,
        "is_services": bool(opp_type_filter),
    }


# ============================================================================
# SERVICES-ONLY DISPATCHER (filters weekly_tracker_data + orderbacklogs by OPP_Type)
# ============================================================================

# Maps slide number to (chart_kind, region_name, target_category, region_filter).
# region_filter=None means no mRegion filter (Overall).
_SERVICES_SLIDE_CONFIGS: Dict[int, tuple] = {
    # Overall — uses dedicated services target category from target_settings.
    # NOTE: Category type stored in DB as "Overall - Serivces" (typo preserved).
    3:  ("cumulative", "Overall", "Overall - Serivces", None),
    4:  ("trend",      "Overall", "Overall - Serivces", None),
    5:  ("pipeline",   "Overall", "Overall - Serivces", None),
    # US West
    7:  ("cumulative", "US West", "US West -  Services", {"mRegion": "US West"}),
    8:  ("trend",      "US West", "US West -  Services", {"mRegion": "US West"}),
    9:  ("pipeline",   "US West", "US West -  Services", {"mRegion": "US West"}),
    # Europe
    10: ("cumulative", "Europe",  "Europe - Services",  {"mRegion": "Europe"}),
    11: ("trend",      "Europe",  "Europe - Services",  {"mRegion": "Europe"}),
    12: ("pipeline",   "Europe",  "Europe - Services",  {"mRegion": "Europe"}),
    # US East
    13: ("cumulative", "US East", "US East - Services", {"mRegion": "US East"}),
    14: ("trend",      "US East", "US East - Services", {"mRegion": "US East"}),
    15: ("pipeline",   "US East", "US East - Services", {"mRegion": "US East"}),
    # Asean
    16: ("cumulative", "Asean",   "Asean",   {"mRegion": "Asean"}),
    17: ("trend",      "Asean",   "Asean",   {"mRegion": "Asean"}),
    18: ("pipeline",   "Asean",   "Asean",   {"mRegion": "Asean"}),
    # Japan
    19: ("cumulative", "Japan",   "Japan",   {"mRegion": "Japan"}),
    20: ("trend",      "Japan",   "Japan",   {"mRegion": "Japan"}),
    21: ("pipeline",   "Japan",   "Japan",   {"mRegion": "Japan"}),
    # KANZ
    22: ("cumulative", "KANZ",    "KANZ",    {"mRegion": "KANZ"}),
    23: ("trend",      "KANZ",    "KANZ",    {"mRegion": "KANZ"}),
    24: ("pipeline",   "KANZ",    "KANZ",    {"mRegion": "KANZ"}),
    # Legacy
    25: ("cumulative", "Legacy",  "Legacy",  {"mRegion": "Legacy"}),
    26: ("trend",      "Legacy",  "Legacy",  {"mRegion": "Legacy"}),
    27: ("pipeline",   "Legacy",  "Legacy",  {"mRegion": "Legacy"}),
}


SERVICES_Q1_REGION_ALIASES = {
    "Overall": "Overall",
    "US West": "USA West",
    "USA West": "USA West",
    "US East": "USA East",
    "USA East": "USA East",
    "Europe": "Europe",
    "Europe + Israel": "Europe",
    "Asean": "Asean",
    "ASEAN": "Asean",
    "Japan": "Japan",
    "KANZ": "KANZ",
    "Legacy": "Legacy",
}

SERVICES_Q1_COLORS = {
    "FY2024": "#9b59b6",
    "FY2025": "#3498db",
    "FY2026": "#538FB8",
    "FY2027": "#27b88a",
    "FY2028": "#e74c3c",
}

SERVICES_Q1_PIPELINE_SLIDES = {
    "Overall": 5,
    "US West": 9,
    "USA West": 9,
    "Europe": 12,
    "US East": 15,
    "USA East": 15,
    "Asean": 18,
    "Japan": 21,
    "KANZ": 24,
    "Legacy": 27,
}


def format_services_snapshot_value(value: float) -> str:
    if value == 0:
        return ""
    if abs(value) < 1000:
        return f"${value:,.0f}"
    if abs(value) < 1_000_000:
        return f"${value / 1e3:.1f}K"
    return f"${value / 1e6:.1f}M"


async def compute_services_q1_snapshot_data(db: AsyncIOMotorDatabase, region: str = "Overall") -> Dict:
    """Return latest uploaded Services Q1 snapshot chart data for Overall or a region."""
    collection = db["services_q1_snapshots"]
    normalized_region = SERVICES_Q1_REGION_ALIASES.get(region, region)

    latest_doc = await collection.find_one(
        {"type": "services_trend", "category": "q1_snapshot"},
        sort=[("created_at", -1)],
    )
    if not latest_doc:
        return {"error": "No Services Q1 snapshot data found. Upload the timeline and opportunity CSVs first."}

    query = {
        "type": "services_trend",
        "category": "q1_snapshot",
        "upload_week": latest_doc["upload_week"],
    }
    query["region"] = normalized_region

    docs = await collection.find(query).sort([("fiscal_year", 1), ("snapshot_date", 1)]).to_list(length=None)
    if not docs:
        return {"error": f"No Services Q1 snapshot data found for {region}."}

    today = datetime.now()
    current_calendar_week = int(today.isocalendar().week)
    current_fiscal_year = f"FY{today.year + 1 if today.month >= 4 else today.year}"
    is_current_fy_q1 = today.month in [4, 5, 6]
    fiscal_years = sorted({doc["fiscal_year"] for doc in docs})
    current_fy_weighted_pipeline_by_week = {}
    pipeline_slide_no = SERVICES_Q1_PIPELINE_SLIDES.get(normalized_region)
    if pipeline_slide_no:
        pipeline_slide_data = await compute_slide_services_data(db, pipeline_slide_no)
        if isinstance(pipeline_slide_data, dict) and not pipeline_slide_data.get("error"):
            for week_label, weighted_value in zip(
                pipeline_slide_data.get("weeks", []),
                pipeline_slide_data.get("weighted_pipeline", []),
            ):
                try:
                    week_number = int(str(week_label).replace("Week", "").strip())
                except ValueError:
                    continue
                if 14 <= week_number <= 27:
                    current_fy_weighted_pipeline_by_week[week_number] = float(weighted_value or 0)

    series = []
    for fy in fiscal_years:
        fy_docs = [doc for doc in docs if doc["fiscal_year"] == fy]
        x_values = []
        for doc in fy_docs:
            if doc.get("calendar_week_number") is not None:
                x_values.append(int(doc["calendar_week_number"]))
            elif doc.get("snapshot_date") is not None:
                x_values.append(int(doc["snapshot_date"].isocalendar().week))
            else:
                x_values.append(int(doc["week_number"]))
        y_values = [float(doc.get("total_amount", 0)) for doc in fy_docs]
        pipeline_values = [float(doc.get("pipeline_amount", 0)) for doc in fy_docs]
        labels = [format_services_snapshot_value(value) for value in y_values]
        pipeline_labels = [format_services_snapshot_value(value) for value in pipeline_values]
        snapshot_dates = [doc.get("snapshot_date").strftime("%b %d, %Y") if doc.get("snapshot_date") else "" for doc in fy_docs]

        if is_current_fy_q1 and fy == current_fiscal_year and x_values and max(x_values) < current_calendar_week:
            x_values.append(current_calendar_week)
            y_values.append(y_values[-1])
            pipeline_values.append(pipeline_values[-1] if pipeline_values else 0)
            labels.append(format_services_snapshot_value(y_values[-1]))
            pipeline_labels.append(format_services_snapshot_value(pipeline_values[-1]))
            snapshot_dates.append(today.strftime("%b %d, %Y"))

        if fy == current_fiscal_year and current_fy_weighted_pipeline_by_week:
            totals_by_week = dict(zip(x_values, y_values))
            dates_by_week = dict(zip(x_values, snapshot_dates))
            x_values = sorted(set(x_values).union(current_fy_weighted_pipeline_by_week.keys()))
            y_values = [totals_by_week.get(week, 0.0) for week in x_values]
            pipeline_values = [current_fy_weighted_pipeline_by_week.get(week, 0.0) for week in x_values]
            labels = [format_services_snapshot_value(value) for value in y_values]
            pipeline_labels = [format_services_snapshot_value(value) for value in pipeline_values]
            snapshot_dates = [dates_by_week.get(week, "") for week in x_values]

        series.append({
            "fiscal_year": fy,
            "weeks": x_values,
            "amounts": y_values,
            "pipeline_amounts": pipeline_values,
            "labels": labels,
            "pipeline_labels": pipeline_labels,
            "snapshot_dates": snapshot_dates,
            "color": SERVICES_Q1_COLORS.get(fy, "#95a5a6"),
        })

    all_weeks = [week for item in series for week in item["weeks"]]
    week_start = min(all_weeks) if all_weeks else 14
    week_end = max(all_weeks) if all_weeks else 26

    return {
        "week": latest_doc.get("upload_week"),
        "file_date": latest_doc.get("file_date"),
        "region": region,
        "normalized_region": normalized_region,
        "week_range": list(range(week_start, week_end + 1)),
        "series": series,
        "title": f"Q1 Snapshot: {region} - Cumulative Clean Amount (FY Q1 by Calendar Week)",
        "enable_animation": ENABLE_CHART_ANIMATION,
    }


async def compute_slide_services_data(db: AsyncIOMotorDatabase, slide_no: int) -> Dict:
    """
    Compute Services-only chart data for any region/cumulative/trend/pipeline slide.

    Adds {'OPP_Type': 'Service'} to the underlying generic helper's filter_query so
    only rows produced by `categorize_opp_category()` returning 'Service' are aggregated.

    The returned dict carries `is_services: True` so the frontend can drop target traces.
    """
    if slide_no not in _SERVICES_SLIDE_CONFIGS:
        return {"error": f"Slide {slide_no} does not have a Services-only variant"}

    kind, region_name, target_category, region_filter = _SERVICES_SLIDE_CONFIGS[slide_no]
    filter_query = dict(region_filter) if region_filter else {}
    filter_query["OPP_Type"] = "Service"

    if kind == "cumulative":
        result = await _compute_cumulative_generic(db, region_name, target_category, filter_query)
    elif kind == "trend":
        result = await _compute_trend_generic(db, region_name, target_category, filter_query)
    elif kind == "pipeline":
        result = await _compute_pipeline_generic(db, region_name, target_category, filter_query)
    else:
        return {"error": f"Unknown chart kind '{kind}' for slide {slide_no}"}

    if isinstance(result, dict):
        result["is_services"] = True
        # Only Overall services has a dedicated target category ("Overall - Serivces").
        # Regional services slides reuse the region's general target category, but
        # those targets represent total (manufacturing+services) so we must NOT show
        # them on services-only charts.
        has_services_target_category = "Serivces" in target_category or "Services" in target_category
        result["has_targets"] = kind in ("cumulative", "trend") and has_services_target_category
    return result


async def compute_overall_gross_margin_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for the Overall Gross Margin slide.

    Uses the latest `overall_summary` document from the `gross_margin_data` collection
    and returns pre-formatted card data for Overall, Manufacturing, and Services.
    """
    print("\n" + "=" * 70)
    print("COMPUTING OVERALL GROSS MARGIN DATA")
    print("=" * 70)

    collection = db["gross_margin_data"]

    document = await collection.find_one(
        {"category": "overall_summary", "type": "gross_margin"},
        sort=[("upload_week", -1), ("created_at", -1)],
    )

    if not document:
        return {
            "error": "No overall gross margin data found. Upload a Gross Margin CSV first."
        }

    def build_section(title: str, prefix: str) -> Dict:
        revenue_key = "revenue" if not prefix else f"{prefix}_revenue"
        gross_margin_key = "gross_margin" if not prefix else f"{prefix}_gross_margin"
        gross_margin_pct_key = "gross_margin_pct" if not prefix else f"{prefix}_gross_margin_pct"

        revenue = float(document.get(revenue_key, 0.0) or 0.0)
        gross_margin = float(document.get(gross_margin_key, 0.0) or 0.0)
        gross_margin_pct = float(document.get(gross_margin_pct_key, 0.0) or 0.0)

        return {
            "title": title,
            "cards": [
                {
                    "label": "Revenue",
                    "value": revenue,
                    "formatted": f"${format_number(revenue)}",
                    "accent": "revenue",
                },
                {
                    "label": "Gross Margin",
                    "value": gross_margin,
                    "formatted": f"${format_number(gross_margin)}",
                    "accent": "gross_margin",
                },
                {
                    "label": "Gross Margin %",
                    "value": gross_margin_pct,
                    "formatted": f"{gross_margin_pct:.2f}%",
                    "accent": "gross_margin_pct",
                },
            ],
        }

    result = {
        "title": "Overall Gross Margin",
        "subtitle": "Overall",
        "upload_week": document.get("upload_week"),
        "date": document.get("date"),
        "sections": [
            build_section("Overall", ""),
            build_section("Manufacturing", "manufacturing"),
            build_section("Services", "services"),
        ],
    }

    print(f"✓ Using upload week {result['upload_week']} ({result['date']})")
    return result


async def compute_overall_gross_margin_region_summary_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for the region-wise overall gross margin summary slide.

    Uses the latest `overall_summary_region` documents from `gross_margin_data`
    and returns bar-series data plus a formatted table payload.
    """
    print("\n" + "=" * 70)
    print("COMPUTING OVERALL GROSS MARGIN REGION SUMMARY DATA")
    print("=" * 70)

    collection = db["gross_margin_data"]

    latest_doc = await collection.find_one(
        {"category": "overall_summary_region", "type": "gross_margin"},
        sort=[("upload_week", -1), ("created_at", -1)],
    )

    if not latest_doc:
        return {
            "error": "No region-wise gross margin data found. Upload a Gross Margin CSV first."
        }

    target_week = latest_doc.get("upload_week")
    target_date = latest_doc.get("date")

    cursor = collection.find(
        {
            "category": "overall_summary_region",
            "type": "gross_margin",
            "upload_week": target_week,
        },
        {
            "_id": 0,
            "arrived_region": 1,
            "revenue": 1,
            "gross_margin": 1,
            "gross_margin_pct": 1,
            "manufacturing_revenue": 1,
            "manufacturing_gross_margin": 1,
            "manufacturing_gross_margin_pct": 1,
            "services_revenue": 1,
            "services_gross_margin": 1,
            "services_gross_margin_pct": 1,
        },
    )
    documents = await cursor.to_list(length=None)

    region_order = ["Europe", "US East", "US West", "Management", "Japan", "Korea", "ASEAN"]
    display_name_map = {
        "Europe": "Europe",
        "US East": "US East",
        "US West": "US West",
        "Management": "Management",
        "Japan": "Japan",
        "Korea": "Korea",
        "ASEAN": "ASEAN",
        "Asean": "ASEAN",
        "Legacy": "Management",
        "KANZ": "Korea",
    }

    metric_definitions = [
        ("total_revenue", "Total Revenue", "revenue", "amount", "#0b2c74"),
        ("total_gross_margin", "Total Gross Margin", "gross_margin", "amount", "#08a04b"),
        ("total_gm_pct", "Total GM %", "gross_margin_pct", "percent", "#94b8ff"),
        ("manufacturing_revenue", "Manufacturing Revenue", "manufacturing_revenue", "amount", "#1657b5"),
        ("manufacturing_gross_margin", "Manufacturing Gross Margin", "manufacturing_gross_margin", "amount", "#16b45e"),
        ("manufacturing_gm_pct", "Manufacturing GM%", "manufacturing_gross_margin_pct", "percent", "#6f95f1"),
        ("services_revenue", "Services Revenue", "services_revenue", "amount", "#6f95f1"),
        ("services_gross_margin", "Services Gross Margin", "services_gross_margin", "amount", "#8bd3a6"),
        ("services_gm_pct", "Services GM %", "services_gross_margin_pct", "percent", "#b8c7f8"),
    ]

    docs_by_region: Dict[str, Dict] = {}
    for doc in documents:
        display_region = display_name_map.get(doc.get("arrived_region"), doc.get("arrived_region"))
        docs_by_region[display_region] = doc

    ordered_regions = [region for region in region_order if region in docs_by_region]
    remaining_regions = sorted(region for region in docs_by_region if region not in ordered_regions)
    ordered_regions.extend(remaining_regions)

    chart_series = []
    table_rows = []

    for metric_key, label, source_key, value_type, color in metric_definitions:
        raw_values = []
        display_values = []

        for region in ordered_regions:
            document = docs_by_region[region]
            raw_value = float(document.get(source_key, 0.0) or 0.0)
            raw_values.append(raw_value)

            if value_type == "amount":
                display_values.append(f"{raw_value:,.0f}")
            else:
                display_values.append(f"{raw_value:.2f} %")

        table_rows.append(
            {
                "key": metric_key,
                "label": label,
                "type": value_type,
                "color": color,
                "values": display_values,
            }
        )

        if value_type == "amount":
            chart_series.append(
                {
                    "key": metric_key,
                    "label": label,
                    "color": color,
                    "values": [round(value / 1_000_000, 2) for value in raw_values],
                }
            )

    return {
        "title": "Overall - Gross Margin Summary - Region",
        "upload_week": target_week,
        "date": target_date,
        "regions": ordered_regions,
        "chart_series": chart_series,
        "table_rows": table_rows,
    }


# ======================================================================
# REGION-SPECIFIC MANUFACTURING GROSS MARGIN
# ======================================================================

GM_CATEGORIES_ORDER = ["<25%", "25 - 45%", "45 - 60%", ">60%"]


async def compute_region_manufacturing_gm_data(
    db: AsyncIOMotorDatabase, region: str
) -> Dict:
    """
    Compute data for a region-specific Manufacturing Gross Margin slide.

    Returns category bar-chart data + per-account detail tables grouped
    by gross-margin category for *Manufacturing* department only.
    """
    print(f"\n{'=' * 70}")
    print(f"COMPUTING REGION MANUFACTURING GM DATA — {region}")
    print("=" * 70)

    collection = db["gross_margin_data"]

    # -- Find the latest upload_week that has category-summary docs for this region
    latest_cat = await collection.find_one(
        {
            "category": "region_manufacturing_category_summary",
            "arrived_region": region,
            "type": "gross_margin",
        },
        sort=[("upload_week", -1), ("created_at", -1)],
    )

    if not latest_cat:
        return {
            "error": f"No manufacturing gross margin data found for region '{region}'. "
            "Upload a Gross Margin CSV first."
        }

    target_week = latest_cat["upload_week"]
    target_date = latest_cat.get("date")

    # -- Fetch category summaries (up to 4) ----------------------------------
    cat_cursor = collection.find(
        {
            "category": "region_manufacturing_category_summary",
            "arrived_region": region,
            "upload_week": target_week,
            "type": "gross_margin",
        }
    )
    cat_docs = await cat_cursor.to_list(length=100)

    cat_map: Dict[str, Dict] = {}
    for doc in cat_docs:
        cat_map[doc["gm_category"]] = {
            "category": doc["gm_category"],
            "revenue": float(doc.get("revenue", 0)),
            "gross_margin": float(doc.get("gross_margin", 0)),
            "gross_margin_pct": float(doc.get("gross_margin_pct", 0)),
            "account_count": int(doc.get("account_count", 0)),
        }

    category_summaries = []
    for cat in GM_CATEGORIES_ORDER:
        category_summaries.append(
            cat_map.get(
                cat,
                {
                    "category": cat,
                    "revenue": 0,
                    "gross_margin": 0,
                    "gross_margin_pct": 0,
                    "account_count": 0,
                },
            )
        )

    # -- Fetch per-account docs -----------------------------------------------
    acct_cursor = collection.find(
        {
            "category": "region_manufacturing_account",
            "arrived_region": region,
            "upload_week": target_week,
            "type": "gross_margin",
        }
    ).sort("revenue", -1)
    acct_docs = await acct_cursor.to_list(length=10000)

    accounts: Dict[str, list] = {cat: [] for cat in GM_CATEGORIES_ORDER}
    for doc in acct_docs:
        cat = doc.get("gm_category", ">60%")
        accounts.setdefault(cat, []).append(
            {
                "account_name": doc.get("account_name", ""),
                "revenue": float(doc.get("revenue", 0)),
                "gross_margin": float(doc.get("gross_margin", 0)),
                "gross_margin_pct": float(doc.get("gross_margin_pct", 0)),
            }
        )

    # -- Region-level manufacturing totals (for top summary row) --------------
    region_doc = await collection.find_one(
        {
            "category": "overall_summary_region",
            "arrived_region": region,
            "upload_week": target_week,
            "type": "gross_margin",
        }
    )

    if region_doc:
        region_summary = {
            "revenue": float(region_doc.get("manufacturing_revenue", 0)),
            "gross_margin": float(region_doc.get("manufacturing_gross_margin", 0)),
            "gross_margin_pct": float(
                region_doc.get("manufacturing_gross_margin_pct", 0)
            ),
        }
    else:
        # Fallback: sum from category summaries
        total_rev = sum(c["revenue"] for c in category_summaries)
        total_gm = sum(c["gross_margin"] for c in category_summaries)
        region_summary = {
            "revenue": total_rev,
            "gross_margin": total_gm,
            "gross_margin_pct": round((total_gm / total_rev) * 100, 2)
            if total_rev
            else 0,
        }

    print(
        f"  ✓ Region summary: Rev={region_summary['revenue']}, "
        f"GM={region_summary['gross_margin']}, GM%={region_summary['gross_margin_pct']}"
    )
    print(f"  ✓ Categories with data: {[c['category'] for c in category_summaries if c['account_count'] > 0]}")
    total_accounts = sum(len(v) for v in accounts.values())
    print(f"  ✓ Total accounts: {total_accounts}")
    print("=" * 70 + "\n")

    return {
        "title": f"Gross Margin Manufacturing - {region}",
        "date": target_date,
        "upload_week": target_week,
        "region": region,
        "region_summary": region_summary,
        "categories": GM_CATEGORIES_ORDER,
        "category_summaries": category_summaries,
        "accounts": accounts,
    }


# ======================================================================
# REGION-SPECIFIC SERVICES GROSS MARGIN
# ======================================================================


async def compute_region_services_gm_data(
    db: AsyncIOMotorDatabase, region: str
) -> Dict:
    """
    Compute data for a region-specific Services Gross Margin slide.

    Uses Service_from_Start sheet-type data (no department filter).
    Returns category bar-chart data + per-account detail tables grouped
    by gross-margin category.
    """
    print(f"\n{'=' * 70}")
    print(f"COMPUTING REGION SERVICES GM DATA — {region}")
    print("=" * 70)

    collection = db["gross_margin_data"]

    # -- Find the latest upload_week that has services category-summary docs
    latest_cat = await collection.find_one(
        {
            "category": "region_services_category_summary",
            "arrived_region": region,
            "type": "gross_margin",
        },
        sort=[("upload_week", -1), ("created_at", -1)],
    )

    if not latest_cat:
        return {
            "error": f"No services gross margin data found for region '{region}'. "
            "Upload a Gross Margin CSV first."
        }

    target_week = latest_cat["upload_week"]
    target_date = latest_cat.get("date")

    # -- Fetch category summaries (up to 4) ----------------------------------
    cat_cursor = collection.find(
        {
            "category": "region_services_category_summary",
            "arrived_region": region,
            "upload_week": target_week,
            "type": "gross_margin",
        }
    )
    cat_docs = await cat_cursor.to_list(length=100)

    cat_map: Dict[str, Dict] = {}
    for doc in cat_docs:
        cat_map[doc["gm_category"]] = {
            "category": doc["gm_category"],
            "revenue": float(doc.get("revenue", 0)),
            "gross_margin": float(doc.get("gross_margin", 0)),
            "gross_margin_pct": float(doc.get("gross_margin_pct", 0)),
            "account_count": int(doc.get("account_count", 0)),
        }

    category_summaries = []
    for cat in GM_CATEGORIES_ORDER:
        category_summaries.append(
            cat_map.get(
                cat,
                {
                    "category": cat,
                    "revenue": 0,
                    "gross_margin": 0,
                    "gross_margin_pct": 0,
                    "account_count": 0,
                },
            )
        )

    # -- Fetch per-account docs -----------------------------------------------
    acct_cursor = collection.find(
        {
            "category": "region_services_account",
            "arrived_region": region,
            "upload_week": target_week,
            "type": "gross_margin",
        }
    ).sort("revenue", -1)
    acct_docs = await acct_cursor.to_list(length=10000)

    accounts: Dict[str, list] = {cat: [] for cat in GM_CATEGORIES_ORDER}
    for doc in acct_docs:
        cat = doc.get("gm_category", ">60%")
        accounts.setdefault(cat, []).append(
            {
                "account_name": doc.get("account_name", ""),
                "revenue": float(doc.get("revenue", 0)),
                "gross_margin": float(doc.get("gross_margin", 0)),
                "gross_margin_pct": float(doc.get("gross_margin_pct", 0)),
            }
        )

    # -- Region-level services totals (sum from all categories) ---------------
    total_rev = sum(c["revenue"] for c in category_summaries)
    total_gm = sum(c["gross_margin"] for c in category_summaries)
    region_summary = {
        "revenue": total_rev,
        "gross_margin": total_gm,
        "gross_margin_pct": round((total_gm / total_rev) * 100, 2) if total_rev else 0,
    }

    print(
        f"  ✓ Region summary: Rev={region_summary['revenue']}, "
        f"GM={region_summary['gross_margin']}, GM%={region_summary['gross_margin_pct']}"
    )
    print(f"  ✓ Categories with data: {[c['category'] for c in category_summaries if c['account_count'] > 0]}")
    total_accounts = sum(len(v) for v in accounts.values())
    print(f"  ✓ Total accounts: {total_accounts}")
    print("=" * 70 + "\n")

    return {
        "title": f"Gross Margin Services - {region}",
        "date": target_date,
        "upload_week": target_week,
        "region": region,
        "region_summary": region_summary,
        "categories": GM_CATEGORIES_ORDER,
        "category_summaries": category_summaries,
        "accounts": accounts,
    }
