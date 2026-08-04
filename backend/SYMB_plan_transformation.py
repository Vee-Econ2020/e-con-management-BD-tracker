import pandas as pd
import numpy as np
import datetime

def process_erp_mech(df_erp):
    if df_erp.empty:
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame()
    
    # Filter and select columns
    ERP_MECH = df_erp[df_erp["SO Owner Name"] != 'Forecast']
    
    # Check if all required columns exist, if not, fill missing with NaN
    required_cols = ["SO Number","Product Code","Ordered Qty","MOA ID","Stage","CTB Status","CRD Date","CDD Date","EBOM Date","EBOM%","CTB Date","CTB%"]
    for col in required_cols:
        if col not in ERP_MECH.columns:
            ERP_MECH[col] = np.nan
            
    ERP_MECH = ERP_MECH[required_cols].copy()
    
    # Convert percentages
    ERP_MECH["EBOM%"] = ERP_MECH["EBOM%"].replace("Nil", 1).replace("0%", 0).replace(np.nan, 0)
    ERP_MECH["CTB%"] = ERP_MECH["CTB%"].replace("Nil", 1).replace("0%", 0).replace(np.nan, 0)
    
    # Force to float
    ERP_MECH["EBOM%"] = pd.to_numeric(ERP_MECH["EBOM%"], errors="coerce").fillna(0)
    ERP_MECH["CTB%"] = pd.to_numeric(ERP_MECH["CTB%"], errors="coerce").fillna(0)
    ERP_MECH["Ordered Qty"] = pd.to_numeric(ERP_MECH["Ordered Qty"], errors="coerce").fillna(0)

    # Calculate covered quantities
    ERP_MECH["EBOM Covered QTY"] = np.ceil(ERP_MECH["Ordered Qty"] * ERP_MECH["EBOM%"])
    ERP_MECH["CTB Covered QTY"] = np.ceil(ERP_MECH["Ordered Qty"] * ERP_MECH["CTB%"])
    
    VARIANT_1_CODES = [
        "NeduCAM25_CHLC_IP67_H08R3",
        "NeduCAM25_CHLC_IP67_H13R3",
        "NeduCAM25_CHLC_IP67_H15R3"
    ]
    
    # Assign Variant
    ERP_MECH["Varient"] = np.where(
        ERP_MECH["Product Code"].isin(VARIANT_1_CODES),
        "Varient 1",
        "Varient 2"
    )
    ERP_MECH["Varient"] = ERP_MECH["Varient"].fillna("unknown")
    
    # Aggregation
    erp_mech_agg = ERP_MECH.groupby(["CDD Date","Varient"]).agg({"Ordered Qty": "sum", "EBOM Covered QTY": "sum", "CTB Covered QTY": "sum"}).reset_index()
    
    erp_mech_agg["Materials Covered"] = np.where(
        (erp_mech_agg["Ordered Qty"] == erp_mech_agg["EBOM Covered QTY"]) & (erp_mech_agg["Ordered Qty"] == erp_mech_agg["CTB Covered QTY"]),
        "Yes",
        "No"
    )
    
    erp_mech_agg["Remaining EBOM QTY"] = erp_mech_agg["Ordered Qty"] - erp_mech_agg["EBOM Covered QTY"]
    erp_mech_agg["Remaining CTB QTY"] = erp_mech_agg["Ordered Qty"] - erp_mech_agg["CTB Covered QTY"]
    
    erp_mech_agg_covered = erp_mech_agg[erp_mech_agg["Materials Covered"]=="Yes"]
    erp_mech_agg_varient = erp_mech_agg_covered.groupby(["Varient"]).agg({"Ordered Qty": "sum", "EBOM Covered QTY": "sum", "CTB Covered QTY": "sum"}).reset_index()
    
    return ERP_MECH, erp_mech_agg, erp_mech_agg_varient


def process_tracker_progress(df_tracker):
    if df_tracker.empty:
        return pd.DataFrame(), pd.DataFrame()
        
    def normalize_variant(v):
        s = str(v).strip()
        if s in ["1", "1.0", "V1", "v1", "Variant 1", "Varient 1"]:
            return "Varient 1"
        if s in ["2", "2.0", "V2", "v2", "Variant 2", "Varient 2"]:
            return "Varient 2"
        return s

    df_tracker["variant"] = df_tracker["variant"].apply(normalize_variant)
    
    # Fill defaults
    df_tracker["completed"] = pd.to_numeric(df_tracker["completed"], errors="coerce").fillna(0)
    df_tracker["planned_qty"] = pd.to_numeric(df_tracker["planned_qty"], errors="coerce").fillna(0)
    
    # Calculate Waterfall Pool (Completed sum)
    progress_summary = df_tracker.groupby(["event_type", "variant"]).agg({"completed": "sum"}).reset_index()
    progress_summary = progress_summary.rename(columns={"event_type": "Data category", "variant": "Varient"})
    
    # Calculate Tracker Cumsum for Estimating Completion Dates
    df_tracker["plan_date_dt"] = pd.to_datetime(df_tracker["plan_date"], errors="coerce")
    df_tracker = df_tracker.sort_values(["event_type", "variant", "plan_date_dt"])
    df_tracker["tracker_cum_planned"] = df_tracker.groupby(["event_type", "variant"])["planned_qty"].cumsum()
    
    return progress_summary, df_tracker


def process_symb_plan(df_plan, progress_summary_agg, erp_mech_agg_varient, df_tracker):
    if df_plan.empty:
        return pd.DataFrame()
        
    SYMB_PLAN = df_plan.copy()
    
    for col in ["Last Batch Date", "Shipment Week", "Variant Type", "Event Type", "planned Value"]:
        if col not in SYMB_PLAN.columns:
            SYMB_PLAN[col] = np.nan
            
    SYMB_PLAN["Last Batch Date"] = pd.to_datetime(SYMB_PLAN["Last Batch Date"], format="%m/%d/%Y", errors="coerce")
    SYMB_PLAN["Shipment Week"] = pd.to_datetime(SYMB_PLAN["Shipment Week"], format="%m/%d/%Y", errors="coerce")
    SYMB_PLAN["Variant Type"] = SYMB_PLAN["Variant Type"].replace("V1", "Varient 1").replace("V2", "Varient 2")
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
        
        # Get Finished goods Last Batch Date for FQC and Production/Assembly
        fg_sub = sub[sub["Event Type"] == "Finished goods"]
        if not fg_sub.empty and pd.notna(fg_sub["Last Batch Date"].iloc[0]):
            fg_batch_date = fg_sub["Last Batch Date"].iloc[0]
        else:
            fg_batch_date = ship_week

        # Row for EBOM covered (11 weeks before Shipment Week)
        new_rows.append({
            "Shipment Week": ship_week,
            "Variant Type": variant,
            "Event Type": "EBOM covered",
            "planned Value": planned_val,
            "Last Batch Date": ship_week - pd.Timedelta(weeks=11)
        })
        
        # Row for PCBA covered (9 weeks before Shipment Week)
        new_rows.append({
            "Shipment Week": ship_week,
            "Variant Type": variant,
            "Event Type": "PCBA covered",
            "planned Value": planned_val,
            "Last Batch Date": ship_week - pd.Timedelta(weeks=9)
        })

        # Row for Production/Assembly (1 week before Finished goods Last Batch Date)
        new_rows.append({
            "Shipment Week": ship_week,
            "Variant Type": variant,
            "Event Type": "Production/Assembly",
            "planned Value": planned_val,
            "Last Batch Date": fg_batch_date - pd.Timedelta(weeks=1)
        })

        # Row for FQC (same as Finished goods Last Batch Date)
        new_rows.append({
            "Shipment Week": ship_week,
            "Variant Type": variant,
            "Event Type": "FQC",
            "planned Value": planned_val,
            "Last Batch Date": fg_batch_date
        })
        
    if new_rows:
        df_new_events = pd.DataFrame(new_rows)
        SYMB_PLAN = pd.concat([SYMB_PLAN, df_new_events], ignore_index=True)

    TRACKED_EVENTS = {
        "EBOM covered", 
        "PCBA covered", 
        "All Material Available", 
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
        "All Material Available": "PCBA Ready",
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
        completed_pool = progress_summary_agg.set_index(["Data category", "Varient"])["completed"].to_dict()
        for (cat, var), qty in list(completed_pool.items()):
            if cat == "PCBA Ready":
                completed_pool[("PCBA covered", var)] = qty

    if not erp_mech_agg_varient.empty and "Varient" in erp_mech_agg_varient.columns:
        ebom_pool = erp_mech_agg_varient.set_index("Varient")["EBOM Covered QTY"].to_dict()
        for variant_name, qty in ebom_pool.items():
            completed_pool[("EBOM covered", variant_name)] = qty
            
        ctb_pool = erp_mech_agg_varient.set_index("Varient")["CTB Covered QTY"].to_dict()
        for variant_name, qty in ctb_pool.items():
            completed_pool[("All Material Available", variant_name)] = qty

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
        tracker_mapped_event = EVENT_MAP.get(event_type)
        
        if not df_tracker.empty and tracker_mapped_event:
            tracker_sub = df_tracker[(df_tracker["event_type"] == tracker_mapped_event) & (df_tracker["variant"] == variant)]
        else:
            tracker_sub = pd.DataFrame()
            
        for dmd in cum_demand:
            if tracker_sub.empty or pd.isna(dmd) or dmd <= 0:
                est_dates.append(np.nan)
                continue
                
            matching = tracker_sub[tracker_sub["tracker_cum_planned"] >= dmd]
            if not matching.empty:
                est_dates.append(matching.iloc[0]["plan_date"])
            else:
                est_dates.append(np.nan)
                
        group["Estimated Completion Date"] = est_dates
        return group

    SYMB_PLAN = SYMB_PLAN.sort_values("Shipment Week")
    
    # Assign default 0 for completed initially
    SYMB_PLAN["completed"] = 0.0
    SYMB_PLAN["Estimated Completion Date"] = np.nan
    
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
    
    def fetch_df(coll_name):
        cursor = db[coll_name].find({})
        import asyncio
        loop = asyncio.get_event_loop()
        # Since db is async motor, we need to await cursor.to_list()
        return cursor

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
    
    print(f"Raw data lengths: Plan={len(df_plan)}, ERP_MECH={len(df_erp)}, Tracker={len(df_tracker)}")
    
    if df_plan.empty:
        print("SYMB PLAN is empty. Skipping pipeline execution.")
        return False
        
    # Process
    try:
        ERP_MECH, erp_mech_agg, erp_mech_agg_varient = process_erp_mech(df_erp)
        Progress_summary_agg, tracker_df = process_tracker_progress(df_tracker)
        SYMB_PLAN = process_symb_plan(df_plan, Progress_summary_agg, erp_mech_agg_varient, tracker_df)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error during SYMB Plan Pandas transformation: {e}")
        return False

    def sanitize_df(df):
        # Convert Timestamp to str and handle NaNs/Infs
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
        # replace np.nan and np.inf
        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.where(pd.notnull(df), None)
        return df.to_dict('records')

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
    if not erp_mech_agg_varient.empty: await save_coll("symb_erp_mech_agg_varient", erp_mech_agg_varient)
    if not erp_mech_agg.empty: await save_coll("symb_erp_mech_agg", erp_mech_agg)
    
    print("--- Completed SYMB Detailed Tracker Pipeline ---\n")
    return True
