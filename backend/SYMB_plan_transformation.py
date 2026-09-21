import pandas as pd
import numpy as np
import datetime

def get_qty(df, product_keyword, qty_col):
    matched = df[df['Product Code'].astype(str).str.contains(product_keyword, na=False)]
    return matched[qty_col].sum()

def process_erp_mech(df_erp):
    if df_erp.empty:
        return pd.DataFrame([
            {'Variant': 'Variant 1', 'MBOM': 0, 'EBOM': 0},
            {'Variant': 'Variant 2', 'MBOM': 0, 'EBOM': 0}
        ])
    
    required_cols = ['Product Code', 'Ordered Qty', 'Min Build Qty', 'EBOM Min Build Qty']
    for col in required_cols:
        if col not in df_erp.columns:
            df_erp[col] = np.nan
            
    ERP_MECH = df_erp[required_cols].copy()
    ERP_MECH['Min Build Qty'] = pd.to_numeric(ERP_MECH['Min Build Qty'], errors='coerce').fillna(0)
    ERP_MECH['EBOM Min Build Qty'] = pd.to_numeric(ERP_MECH['EBOM Min Build Qty'], errors='coerce').fillna(0)
    
    # 1. Calculate buildable units for Variant 1 & Variant 2 under MBOM ('Min Build Qty')
    mbom_h08 = get_qty(ERP_MECH, 'H08', 'Min Build Qty')
    mbom_h13 = get_qty(ERP_MECH, 'H13', 'Min Build Qty')
    mbom_h15 = get_qty(ERP_MECH, 'H15', 'Min Build Qty')

    mbom_h09 = get_qty(ERP_MECH, 'H09', 'Min Build Qty')
    mbom_h10 = get_qty(ERP_MECH, 'H10', 'Min Build Qty')

    mbom_Variant_1 = min(mbom_h08 // 2, mbom_h13, mbom_h15)
    mbom_Variant_2 = min(mbom_h09, mbom_h10)

    # 2. Calculate buildable units for Variant 1 & Variant 2 under EBOM ('EBOM Min Build Qty')
    ebom_h08 = get_qty(ERP_MECH, 'H08', 'EBOM Min Build Qty')
    ebom_h13 = get_qty(ERP_MECH, 'H13', 'EBOM Min Build Qty')
    ebom_h15 = get_qty(ERP_MECH, 'H15', 'EBOM Min Build Qty')

    ebom_h09 = get_qty(ERP_MECH, 'H09', 'EBOM Min Build Qty')
    ebom_h10 = get_qty(ERP_MECH, 'H10', 'EBOM Min Build Qty')

    ebom_Variant_1 = min(ebom_h08 // 2, ebom_h13, ebom_h15)
    ebom_Variant_2 = min(ebom_h09, ebom_h10)

    # 3. Create ERP_final DataFrame
    ERP_final = pd.DataFrame([
        {
            'Variant': 'Variant 1',
            'MBOM': int(mbom_Variant_1),
            'EBOM': int(ebom_Variant_1)
        },
        {
            'Variant': 'Variant 2',
            'MBOM': int(mbom_Variant_2),
            'EBOM': int(ebom_Variant_2)
        }
    ])
    
    return ERP_final


def process_tracker_progress(df_tracker):
    if df_tracker.empty:
        return pd.DataFrame(), pd.DataFrame()
        
    def normalize_variant(v):
        s = str(v).strip()
        if s in ["1", "1.0", "V1", "v1", "Variant 1", "Variant 1"]:
            return "Variant 1"
        if s in ["2", "2.0", "V2", "v2", "Variant 2", "Variant 2"]:
            return "Variant 2"
        return s

    df_tracker["variant"] = df_tracker["variant"].apply(normalize_variant)
    
    # Fill defaults
    df_tracker["completed"] = pd.to_numeric(df_tracker["completed"], errors="coerce").fillna(0)
    df_tracker["planned_qty"] = pd.to_numeric(df_tracker["planned_qty"], errors="coerce").fillna(0)
    
    # Calculate Waterfall Pool (Completed sum)
    progress_summary = df_tracker.groupby(["event_type", "variant"]).agg({"completed": "sum"}).reset_index()
    progress_summary = progress_summary.rename(columns={"event_type": "Data category", "variant": "Variant"})
    
    # Calculate Tracker Cumsum for Estimating Completion Dates
    df_tracker["plan_date_dt"] = pd.to_datetime(df_tracker["plan_date"], errors="coerce")
    df_tracker = df_tracker.sort_values(["event_type", "variant", "plan_date_dt"])
    df_tracker["tracker_cum_planned"] = df_tracker.groupby(["event_type", "variant"])["planned_qty"].cumsum()
    
    return progress_summary, df_tracker


def format_actual_comp_date(val):
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ['none', 'nan', 'nat', 'null', '-']:
        return None
    try:
        dt = pd.to_datetime(s, errors='coerce')
        if pd.notna(dt):
            return dt.strftime('%d-%b-%Y').upper()
    except Exception:
        pass
    return s


DEFAULT_STAGE_LEAD_TIMES = [
    {"stage": "EBOM covered", "weeks": 11, "days": 0, "order": 0},
    {"stage": "PCBA covered", "weeks": 9, "days": 0, "order": 1},
    {"stage": "All Material Available", "weeks": 7, "days": 0, "order": 2},
    {"stage": "Materials Issued", "weeks": 7, "days": 0, "order": 3},
    {"stage": "Active alignment", "weeks": 5, "days": 0, "order": 4},
    {"stage": "Production/Assembly", "weeks": 5, "days": 0, "order": 5},
    {"stage": "FQC", "weeks": 4, "days": 0, "order": 6},
    {"stage": "Finished goods", "weeks": 4, "days": 0, "order": 7},
    {"stage": "Invoice Date", "weeks": 1, "days": 0, "order": 8},
    {"stage": "Shipment Date", "weeks": 0, "days": 0, "order": 9},
    {"stage": "customer place", "weeks": 0, "days": 7, "order": 10},
]


# Stages where the team enters a manual ETA (via the Tracker Update "EBOM covered" /
# "100% CTB" tabs) instead of the date being derived from daily tracker plan_date batches.
MANUAL_ETA_EVENTS = {"EBOM covered", "All Material Available"}


def _norm_week_key(val):
    try:
        dt = pd.to_datetime(val, errors="coerce")
        if pd.notna(dt):
            return dt.strftime("%Y-%m-%d")
    except Exception:
        pass
    return None


def process_symb_plan(df_plan, progress_summary_agg, erp_final, df_tracker, stage_lead_times=None, stage_eta_records=None):
    if df_plan.empty:
        return pd.DataFrame()

    SYMB_PLAN = df_plan.copy()

    eta_lookup = {}
    if stage_eta_records:
        for rec in stage_eta_records:
            wk = _norm_week_key(rec.get("shipment_week"))
            evt = rec.get("event_type")
            var = rec.get("variant")
            if wk and evt and var:
                eta_lookup[(evt, var, wk)] = rec
    
    # Build lead time lookup dictionary from DB config or defaults
    lead_dict = {}
    if stage_lead_times:
        for item in stage_lead_times:
            st = item.get("stage")
            if st:
                lead_dict[st] = {
                    "weeks": int(item.get("weeks", 0)),
                    "days": int(item.get("days", 0))
                }
    for def_item in DEFAULT_STAGE_LEAD_TIMES:
        if def_item["stage"] not in lead_dict:
            lead_dict[def_item["stage"]] = {
                "weeks": def_item["weeks"],
                "days": def_item["days"]
            }

    def calc_stage_batch_date(ship_week, stage_name):
        cfg = lead_dict.get(stage_name, {"weeks": 0, "days": 0})
        return ship_week - pd.Timedelta(weeks=cfg["weeks"]) + pd.Timedelta(days=cfg["days"])

    for col in ["Last Batch Date", "Shipment Week", "Variant Type", "Event Type", "planned Value"]:
        if col not in SYMB_PLAN.columns:
            SYMB_PLAN[col] = np.nan
            
    SYMB_PLAN["Last Batch Date"] = pd.to_datetime(SYMB_PLAN["Last Batch Date"], errors="coerce")
    SYMB_PLAN["Shipment Week"] = pd.to_datetime(SYMB_PLAN["Shipment Week"], errors="coerce")
    SYMB_PLAN = SYMB_PLAN.dropna(subset=["Shipment Week"])
    SYMB_PLAN["Variant Type"] = SYMB_PLAN["Variant Type"].replace("V1", "Variant 1").replace("V2", "Variant 2")
    SYMB_PLAN["Event Type"] = SYMB_PLAN["Event Type"].replace("AA", "Active alignment").replace("FG Date", "Finished goods")

    # Generate synthetic rows for "EBOM covered", "PCBA covered", "Production/Assembly", "FQC" for each unique Shipment Week & Variant
    new_rows = []
    unique_combos = SYMB_PLAN[["Shipment Week", "Variant Type"]].drop_duplicates()
    
    for _, combo in unique_combos.iterrows():
        ship_week = combo["Shipment Week"]
        variant = combo["Variant Type"]
        if pd.isna(ship_week) or pd.isna(variant):
            continue
            
        sub = SYMB_PLAN[(SYMB_PLAN["Shipment Week"] == ship_week) & (SYMB_PLAN["Variant Type"] == variant)]
        planned_val = sub["planned Value"].iloc[0] if not sub.empty else 0

        # Row for EBOM covered
        new_rows.append({
            "Shipment Week": ship_week,
            "Variant Type": variant,
            "Event Type": "EBOM covered",
            "planned Value": planned_val,
            "Last Batch Date": calc_stage_batch_date(ship_week, "EBOM covered")
        })
        
        # Row for PCBA covered
        new_rows.append({
            "Shipment Week": ship_week,
            "Variant Type": variant,
            "Event Type": "PCBA covered",
            "planned Value": planned_val,
            "Last Batch Date": calc_stage_batch_date(ship_week, "PCBA covered")
        })

        # Row for Materials Issued
        new_rows.append({
            "Shipment Week": ship_week,
            "Variant Type": variant,
            "Event Type": "Materials Issued",
            "planned Value": planned_val,
            "Last Batch Date": calc_stage_batch_date(ship_week, "Materials Issued")
        })

        # Row for Production/Assembly
        new_rows.append({
            "Shipment Week": ship_week,
            "Variant Type": variant,
            "Event Type": "Production/Assembly",
            "planned Value": planned_val,
            "Last Batch Date": calc_stage_batch_date(ship_week, "Production/Assembly")
        })

        # Row for FQC
        new_rows.append({
            "Shipment Week": ship_week,
            "Variant Type": variant,
            "Event Type": "FQC",
            "planned Value": planned_val,
            "Last Batch Date": calc_stage_batch_date(ship_week, "FQC")
        })
        
    if new_rows:
        df_new_events = pd.DataFrame(new_rows)
        SYMB_PLAN = pd.concat([SYMB_PLAN, df_new_events], ignore_index=True)

    # Dynamically apply configurable lead times to ALL stages
    def update_row_batch_date(row):
        st = row.get("Event Type")
        sw = row.get("Shipment Week")
        if pd.isna(sw):
            return row.get("Last Batch Date")
        if st in lead_dict:
            cfg = lead_dict[st]
            return sw - pd.Timedelta(weeks=cfg["weeks"]) + pd.Timedelta(days=cfg["days"])
        return row.get("Last Batch Date")

    SYMB_PLAN["Last Batch Date"] = SYMB_PLAN.apply(update_row_batch_date, axis=1)

    TRACKED_EVENTS = {
        "EBOM covered", 
        "PCBA covered", 
        "All Material Available", 
        "Materials Issued",
        "Active alignment", 
        "Production/Assembly", 
        "FQC", 
        "Finished goods", 
        "Invoice Date", 
        "Shipment Date", 
        "customer place"
    }
    
    EVENT_MAP = {
        "PCBA covered": "PCBA Ready",
        "Materials Issued": "Materials Issued",
        "Active alignment": "Active alignment",
        "Production/Assembly": "Production/Assembly",
        "FQC": "FQC",
        "Finished goods": "Finished goods",
        "Invoice Date": "Invoice Date",
        "Shipment Date": "Shipment Date",
        "customer place": "customer place"
    }
    
    completed_pool = {}
    if not progress_summary_agg.empty and "Data category" in progress_summary_agg.columns:
        completed_pool = progress_summary_agg.set_index(["Data category", "Variant"])["completed"].to_dict()
        for (cat, var), qty in list(completed_pool.items()):
            if cat == "PCBA Ready":
                completed_pool[("PCBA covered", var)] = qty

    if not erp_final.empty and "Variant" in erp_final.columns:
        for _, r in erp_final.iterrows():
            variant_name = r["Variant"]
            mbom_val = r.get("MBOM", 0)
            ebom_val = r.get("EBOM", 0)
            completed_pool[("EBOM covered", variant_name)] = ebom_val
            completed_pool[("All Material Available", variant_name)] = mbom_val

    def waterfall_allocate(group):
        if group.empty:
            return group
        name_tuple = group.name
        if isinstance(name_tuple, tuple) and len(name_tuple) == 2:
            event_type, variant = name_tuple
        else:
            return group
            
        if event_type not in TRACKED_EVENTS:
            return group
            
        pool = completed_pool.get((event_type, variant), 0)
        group["planned Value"] = pd.to_numeric(group["planned Value"], errors="coerce").fillna(0)
        
        cum_demand = group["planned Value"].cumsum()
        prior_demand = cum_demand - group["planned Value"]
        group["completed"] = (pool - prior_demand).clip(lower=0, upper=group["planned Value"])
        
        # Calculate Estimated Completion Date
        est_dates = []
        est_histories = []
        est_given_by = []
        est_created_ats = []
        tracker_mapped_event = EVENT_MAP.get(event_type)
        is_manual_eta_stage = event_type in MANUAL_ETA_EVENTS

        if not df_tracker.empty and tracker_mapped_event:
            tracker_sub = df_tracker[(df_tracker["event_type"] == tracker_mapped_event) & (df_tracker["variant"] == variant)]
        else:
            tracker_sub = pd.DataFrame()

        for row_idx, dmd in cum_demand.items():
            if is_manual_eta_stage:
                wk_key = _norm_week_key(group.loc[row_idx, "Shipment Week"])
                eta_rec = eta_lookup.get((event_type, variant, wk_key)) if wk_key else None
                eta_date_val = eta_rec.get("eta_date") if eta_rec else None
                if eta_rec and eta_date_val:
                    formatted_eta = eta_date_val
                    try:
                        parsed = pd.to_datetime(eta_date_val, errors="coerce")
                        if pd.notna(parsed):
                            formatted_eta = parsed.strftime("%d-%b-%Y").upper()
                    except Exception:
                        pass
                    est_dates.append(formatted_eta)
                    est_given_by.append(str(eta_rec.get("created_by") or "System Baseline"))
                    est_created_ats.append(eta_rec.get("created_at"))
                    hist = eta_rec.get("edit_history")
                    est_histories.append(hist if isinstance(hist, list) else [])
                else:
                    est_dates.append(np.nan)
                    est_histories.append([])
                    est_given_by.append(None)
                    est_created_ats.append(None)
                continue

            if tracker_sub.empty or pd.isna(dmd) or dmd <= 0:
                est_dates.append(np.nan)
                est_histories.append([])
                est_given_by.append(None)
                est_created_ats.append(None)
                continue

            matching = tracker_sub[tracker_sub["tracker_cum_planned"] >= dmd]
            if not matching.empty:
                match_row = matching.iloc[0]
                est_dates.append(match_row["plan_date"])
                
                # Extract plan given by
                given_by = match_row.get("created_by")
                if not given_by or pd.isna(given_by) or str(given_by).strip().lower() in ['none', 'nan', 'nat', 'null', '']:
                    eh = match_row.get("edit_history")
                    if isinstance(eh, dict):
                        for cat in ['planned_qty', 'plan_date', 'completed']:
                            h_list = eh.get(cat, [])
                            if isinstance(h_list, list) and h_list and h_list[0].get('edited_by'):
                                given_by = h_list[0].get('edited_by')
                                break
                if not given_by or pd.isna(given_by) or str(given_by).strip().lower() in ['none', 'nan', 'nat', 'null', '']:
                    given_by = "System Baseline"
                est_given_by.append(str(given_by))

                # Extract plan created at / timestamp
                created_at = match_row.get("created_at")
                if not created_at or pd.isna(created_at) or str(created_at).strip().lower() in ['none', 'nan', 'nat', 'null', '']:
                    eh = match_row.get("edit_history")
                    if isinstance(eh, dict):
                        for cat in ['planned_qty', 'plan_date', 'completed']:
                            h_list = eh.get(cat, [])
                            if isinstance(h_list, list) and h_list and h_list[0].get('timestamp'):
                                created_at = h_list[0].get('timestamp')
                                break
                est_created_ats.append(str(created_at) if created_at and pd.notna(created_at) else None)

                # Date history
                match_hist = match_row.get("edit_history")
                plan_date_hist = []
                if isinstance(match_hist, dict):
                    raw_hist = match_hist.get("plan_date", [])
                    if isinstance(raw_hist, list):
                        plan_date_hist = raw_hist
                est_histories.append(plan_date_hist)
            else:
                est_dates.append(np.nan)
                est_histories.append([])
                est_given_by.append(None)
                est_created_ats.append(None)
                
        group["Estimated Completion Date"] = est_dates
        group["Estimated Completion Date History"] = est_histories
        group["Estimated Completion Date Given By"] = est_given_by
        group["Estimated Completion Date Created At"] = est_created_ats

        # Calculate Actual Completed Date using waterfall batch allocation
        actual_comp_dates = []
        batches = []
        if not tracker_sub.empty:
            comp_rows = tracker_sub[tracker_sub["completed"] > 0]
            for _, cr in comp_rows.iterrows():
                qty = float(cr.get("completed", 0))
                if qty <= 0:
                    continue
                d_val = cr.get("acc_comp_date")
                if not d_val or pd.isna(d_val) or str(d_val).strip().lower() in ['none', 'nan', 'nat', 'null', '-']:
                    d_val = cr.get("plan_date")
                fmt_date = format_actual_comp_date(d_val)
                batches.append({"completed": qty, "date": fmt_date})

        b_idx = 0
        rem_batch_qty = batches[0]["completed"] if batches else 0

        for _, row in group.iterrows():
            row_planned = float(row["planned Value"]) if pd.notna(row["planned Value"]) else 0.0
            row_completed = float(row["completed"]) if pd.notna(row["completed"]) else 0.0
            
            # Must have positive planned value and be 100% completed
            is_row_completed = (row_planned > 0 and row_completed >= row_planned)

            needed = row_planned
            comp_date = None
            while needed > 0 and b_idx < len(batches):
                take = min(needed, rem_batch_qty)
                needed -= take
                rem_batch_qty -= take
                if needed == 0:
                    comp_date = batches[b_idx]["date"]
                if rem_batch_qty == 0:
                    b_idx += 1
                    if b_idx < len(batches):
                        rem_batch_qty = batches[b_idx]["completed"]

            if is_row_completed and comp_date:
                actual_comp_dates.append(comp_date)
            else:
                actual_comp_dates.append(None)

        group["Actual Completed Date"] = actual_comp_dates
        return group

    SYMB_PLAN = SYMB_PLAN.sort_values("Shipment Week")
    
    # Assign default 0 for completed initially
    SYMB_PLAN["completed"] = 0.0
    SYMB_PLAN["Estimated Completion Date"] = np.nan
    SYMB_PLAN["Estimated Completion Date History"] = [[] for _ in range(len(SYMB_PLAN))]
    SYMB_PLAN["Estimated Completion Date Given By"] = None
    SYMB_PLAN["Estimated Completion Date Created At"] = None
    SYMB_PLAN["Actual Completed Date"] = None
    
    if not SYMB_PLAN.empty:
        try:
            SYMB_PLAN = (
                SYMB_PLAN.groupby(["Event Type", "Variant Type"], group_keys=False)
                .apply(waterfall_allocate)
                .sort_index()
            )
        except Exception as e:
            print(f"Waterfall allocate error: {e}")
            pass
            
    SYMB_PLAN["completed"] = SYMB_PLAN.get("completed", pd.Series(dtype=float)).fillna(0)
    
    # Sequential Stage Planned Qty Autofill & Unplanned Qty Warning Pass
    EVENT_ORDER_SEQ = [
        "EBOM covered",
        "PCBA covered",
        "All Material Available",
        "Materials Issued",
        "Active alignment",
        "Production/Assembly",
        "FQC",
        "Finished goods",
        "Invoice Date",
        "Shipment Date",
        "customer place"
    ]

    SYMB_PLAN["original_planned_value"] = SYMB_PLAN["planned Value"]
    SYMB_PLAN["is_autofilled"] = False
    SYMB_PLAN["unplanned_qty"] = 0.0
    SYMB_PLAN["warning_msg"] = ""

    def reupdate_stage_plans_and_warnings(df_sub):
        if df_sub.empty:
            return df_sub
        
        df_sub["_seq_idx"] = df_sub["Event Type"].apply(lambda e: EVENT_ORDER_SEQ.index(e) if e in EVENT_ORDER_SEQ else 999)
        df_sub = df_sub.sort_values("_seq_idx")

        prev_completed = None
        prev_planned = None

        for idx in df_sub.index:
            row = df_sub.loc[idx]
            orig_p = float(row["planned Value"]) if pd.notna(row["planned Value"]) else 0.0
            curr_c = float(row["completed"]) if pd.notna(row["completed"]) else 0.0

            if prev_completed is not None:
                # Rule 1: Autofill from previous stage completed if completed > original planned
                if prev_completed > orig_p:
                    effective_p = prev_completed
                    is_autofill = True
                else:
                    effective_p = orig_p
                    is_autofill = False

                # Rule 2: Warning if previous stage completed units (>0) exceed current stage original planned target
                if prev_completed > 0 and prev_completed > orig_p:
                    unplanned = prev_completed - orig_p
                    warn = f"There is no plan for remaining qty ({int(unplanned):,} units). Please update!"
                else:
                    unplanned = 0.0
                    warn = ""
            else:
                effective_p = orig_p
                is_autofill = False
                unplanned = 0.0
                warn = ""

            df_sub.at[idx, "original_planned_value"] = orig_p
            df_sub.at[idx, "planned Value"] = effective_p
            df_sub.at[idx, "is_autofilled"] = is_autofill
            df_sub.at[idx, "unplanned_qty"] = unplanned
            df_sub.at[idx, "warning_msg"] = warn

            prev_completed = curr_c
            prev_planned = effective_p

        if "_seq_idx" in df_sub.columns:
            df_sub = df_sub.drop(columns=["_seq_idx"])
        return df_sub

    if not SYMB_PLAN.empty:
        try:
            SYMB_PLAN = (
                SYMB_PLAN.groupby(["Shipment Week", "Variant Type"], group_keys=False)
                .apply(reupdate_stage_plans_and_warnings)
            )
        except Exception as e:
            print(f"Stage reupdate error: {e}")
            pass

    SYMB_PLAN["Material Covered"] = np.where(
        SYMB_PLAN["completed"] == SYMB_PLAN["planned Value"],
        "Yes",
        "No"
    )

    today = pd.to_datetime("today").normalize()
    raw_days_diff = (today - SYMB_PLAN["Last Batch Date"]).dt.days

    SYMB_PLAN["Delayed by days"] = np.where(
        SYMB_PLAN["Material Covered"] == "No",
        raw_days_diff,
        np.nan
    )
    SYMB_PLAN["Delayed by days"] = np.where(
        (SYMB_PLAN["Material Covered"] == "Yes") & (SYMB_PLAN["Delayed by days"].isna()),
        0,
        SYMB_PLAN["Delayed by days"]
    )

    SYMB_PLAN["Delayed by weeks"] = np.where(
        SYMB_PLAN["Material Covered"] == "No",
        np.ceil(raw_days_diff / 7.0),
        np.nan
    )
    SYMB_PLAN["Delayed by weeks"] = np.where(
        (SYMB_PLAN["Material Covered"] == "Yes") & (SYMB_PLAN["Delayed by weeks"].isna()),
        0,
        SYMB_PLAN["Delayed by weeks"]
    )

    return SYMB_PLAN

async def run_symb_plan_pipeline(db):
    """
    Executes the SYMB detailed tracker pipeline.
    Pulls raw data from MongoDB, applies Pandas transformations,
    and saves the resulting aggregated datasets.
    """
    import math
    print("\n--- Starting SYMB Detailed Tracker Pipeline ---")

    async def get_df_async(coll_name):
        cursor = db[coll_name].find({})
        docs = await cursor.to_list(length=None)
        if docs:
            for d in docs:
                d.pop("_id", None)
            return pd.DataFrame(docs)
        return pd.DataFrame()

    df_plan = await get_df_async("symb_plan_raw")
    df_erp = await get_df_async("symb_erp_mech_raw")
    df_tracker = await get_df_async("SYMB_Updated_progress_tracker")
    stage_lead_times = await db["symb_stage_lead_times"].find({}).to_list(length=None)
    stage_eta_records = await db["symb_stage_eta"].find({}).to_list(length=None)

    print(f"Raw data lengths: Plan={len(df_plan)}, ERP_MECH={len(df_erp)}, Tracker={len(df_tracker)}, LeadTimes={len(stage_lead_times)}, StageEta={len(stage_eta_records)}")

    if df_plan.empty:
        print("SYMB PLAN is empty. Skipping pipeline execution.")
        return False

    # Process
    try:
        ERP_final = process_erp_mech(df_erp)
        Progress_summary_agg, tracker_df = process_tracker_progress(df_tracker)
        SYMB_PLAN = process_symb_plan(df_plan, Progress_summary_agg, ERP_final, tracker_df, stage_lead_times=stage_lead_times, stage_eta_records=stage_eta_records)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error during SYMB Plan Pandas transformation: {e}")
        return False

    def sanitize_df(df):
        import math
        # Convert Timestamp to str and handle NaNs/Infs
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
        records = df.to_dict('records')
        def clean_val(v):
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return None
            if isinstance(v, dict):
                return {k: clean_val(val) for k, val in v.items()}
            if isinstance(v, list):
                return [clean_val(item) for item in v]
            return v
        return [clean_val(r) for r in records]

    # Save to MongoDB
    async def save_coll(coll_name, df):
        coll = db[coll_name]
        await coll.delete_many({})
        records = sanitize_df(df)
        if records:
            await coll.insert_many(records, ordered=False)
        print(f"Saved {len(records)} records to {coll_name}")

    if not SYMB_PLAN.empty: await save_coll("symb_plan_transformed", SYMB_PLAN)
    if not Progress_summary_agg.empty: await save_coll("symb_progress_summary_agg", Progress_summary_agg)
    if not ERP_final.empty: await save_coll("symb_erp_mech_agg_Variant", ERP_final)
    
    print("--- Completed SYMB Detailed Tracker Pipeline ---\n")
    return True

