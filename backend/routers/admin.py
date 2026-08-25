from fastapi import APIRouter, HTTPException, Body, File, Form, UploadFile, BackgroundTasks, Header
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import os
import uuid
import asyncio
from dotenv import load_dotenv
from progress_tracker import update_progress, get_progress, clear_progress, progress_store

router = APIRouter()

DEFAULT_CUSTOM_SLIDE_GIF_URL = "https://share.google/LmEClpDJOaUUFkFoW"
DEFAULT_SLIDE_GIF_POSITION = {"x": 68.0, "y": 14.0, "width": 22.0}


def normalize_gif_position(gif_position: Optional[dict] = None):
    gif_position = gif_position or {}
    return {
        "x": float(gif_position.get("x", DEFAULT_SLIDE_GIF_POSITION["x"])),
        "y": float(gif_position.get("y", DEFAULT_SLIDE_GIF_POSITION["y"])),
        "width": float(gif_position.get("width", DEFAULT_SLIDE_GIF_POSITION["width"])),
    }

# Load env to get DB connection details (though main.py handles the connection usually, 
# we might need to access the specific collection. 
# Better pattern: Dependency injection for DB. 
# For simplicity in this script, we'll reuse the pattern or import.
# But main.py defined 'client' and 'db' globally. 
# We should probably pass the db instance or re-instantiate.
# Let's re-instantiate for safety in this router or rely on request state if we had it.
# To keep it simple and robust, I'll create a local helper or rely on the global from main if imported, 
# but circular imports are bad. 
# I will create a dependency or just init the client here for now using get_db pattern if possible.
# Given the simple structure, I'll re-read env variables and connect.

load_dotenv()
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "DB_tracker")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]

@router.get("/weeks/available")
async def get_available_weeks():
    """
    Get a sorted list of all unique weeks that have data in the system.
    """
    try:
        weeks = set()
        
        # Check slide_inputs
        slide_weeks = await db.slide_inputs.distinct("week_recorded")
        weeks.update([int(w) for w in slide_weeks if w])
        
        # Check weekly_tracker_data
        tracker_weeks = await db.weekly_tracker_data.distinct("week")
        weeks.update([int(w) for w in tracker_weeks if w])
        
        # Check whale_accounts
        whale_weeks = await db.whale_accounts.distinct("week_updated")
        weeks.update([int(w) for w in whale_weeks if w])
        
        return sorted(list(weeks), reverse=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Models
class DropdownOption(BaseModel):
    category: str  # e.g., "Financial Year", "Financial QTR", "Category Type", "Category Value"
    value: str     # e.g., "FY2026", "Q1", "Revenue", "Software"

class Target(BaseModel):
    id: Optional[str] = None
    financial_year: str
    financial_qtr: str
    category_type: str
    category_value: str
    target_value: float
    ppt_type: Optional[str] = None
    created_at: Optional[datetime] = None

class UploadLog(BaseModel):
    id: Optional[str] = None
    week: int
    file_date: str # DD-MM-YYYY
    file_name: str
    type: str # "weekly" or "revenue"
    created_at: Optional[datetime] = None

class RegionMapping(BaseModel):
    id: Optional[str] = None
    opportunities_owner: str
    region: str
    created_at: Optional[datetime] = None

# Helper to get DB collection safely per request
def get_collection(name: str):
    # Re-instantiate client to avoid event loop issues with global vars in router
    _client = AsyncIOMotorClient(MONGODB_URL)
    _db = _client[DB_NAME]
    return _db[name]

# Routes for Dropdown Options
@router.get("/options", response_model=List[DropdownOption])
async def get_options(category: Optional[str] = None):
    try:
        coll = get_collection("target_metadata")
        query = {}
        if category:
            query["category"] = category
        cursor = coll.find(query)
        options = await cursor.to_list(length=1000)
        return options
    except Exception as e:
        print(f"Error fetching options: {e}")
        return []

@router.post("/options", response_model=DropdownOption)
async def add_option(option: DropdownOption):
    try:
        coll = get_collection("target_metadata")
        existing = await coll.find_one({
            "category": option.category,
            "value": option.value
        })
        if existing:
            return option 
        
        await coll.insert_one(option.dict())
        return option
    except Exception as e:
        print(f"Error adding option: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/options")
async def delete_option(category: str, value: str):
    try:
        coll = get_collection("target_metadata")
        result = await coll.delete_one({"category": category, "value": value})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Option not found")
        return {"status": "success", "message": "Option deleted"}
    except Exception as e:
        print(f"Error deleting option: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Routes for Targets
@router.get("/targets")
async def get_targets():
    try:
        coll = get_collection("target_settings")
        cursor = coll.find({})
        targets = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            targets.append(doc)
        return targets
    except Exception as e:
        print(f"Error getting targets: {e}")
        return []

@router.post("/targets")
async def add_target(target: Target):
    print(f"Received target: {target}")
    try:
        coll = get_collection("target_settings")
        target_dict = target.dict(exclude={"id"})
        target_dict["created_at"] = datetime.now()
        
        result = await coll.insert_one(target_dict)
        print(f"Inserted target, ID: {result.inserted_id}")
        
        # FIX: Ensure _id is not in the response, as ObjectId is not JSON serializable
        if "_id" in target_dict:
            del target_dict["_id"]
        
        return {**target_dict, "id": str(result.inserted_id)}
    except Exception as e:
        print(f"Error adding target: {e}")
        # Print full stack trace to console
        import traceback
        traceback.print_exc()
        # Return simple string in detail to avoid JSON parse errors on frontend if simplifies
        raise HTTPException(status_code=500, detail=f"DB Error: {str(e)}")

@router.delete("/targets/{target_id}")
async def delete_target(target_id: str):
    from bson import ObjectId
    try:
        coll = get_collection("target_settings")
        result = await coll.delete_one({"_id": ObjectId(target_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Target not found")
        return {"status": "success", "message": "Target deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/targets/{target_id}")
async def update_target(target_id: str, target: Target):
    from bson import ObjectId
    target_dict = target.dict(exclude={"id", "created_at"})
    
    try:
        coll = get_collection("target_settings")
        result = await coll.update_one(
            {"_id": ObjectId(target_id)},
            {"$set": target_dict}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Target not found")
        return {"status": "success", "message": "Target updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Routes for Upload Logs
@router.get("/upload-logs")
async def get_upload_logs(type: Optional[str] = None):
    try:
        coll = get_collection("upload_logs")
        query = {}
        if type == "symb_reference":
            query = {"type": {"$in": ["symb_ref_so", "symb_ref_jabil", "symb_ref_progress", "symb_ref_plan"]}}
        elif type:
            query["type"] = type
        cursor = coll.find(query).sort("created_at", -1)
        logs = []
        found_types = set()
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            logs.append(doc)
            found_types.add(doc.get("type"))

        # Fallback check for SYMB reference collections if logs do not exist yet in upload_logs
        if type in [None, "symb_reference", "symb_ref_so"] and "symb_ref_so" not in found_types:
            count = await get_collection("symb_so_numbers").count_documents({})
            if count > 0:
                logs.append({
                    "id": "ref_so_existing",
                    "week": 0,
                    "file_date": "Active",
                    "file_name": f"symb_so_numbers.csv ({count} records in DB)",
                    "type": "symb_ref_so",
                    "created_at": datetime.now()
                })
        if type in [None, "symb_reference", "symb_ref_jabil"] and "symb_ref_jabil" not in found_types:
            count = await get_collection("symb_jabil_production").count_documents({})
            if count > 0:
                logs.append({
                    "id": "ref_jabil_existing",
                    "week": 0,
                    "file_date": "Active",
                    "file_name": f"jabil_production.csv ({count} records in DB)",
                    "type": "symb_ref_jabil",
                    "created_at": datetime.now()
                })
        if type in [None, "symb_reference", "symb_ref_progress"] and "symb_ref_progress" not in found_types:
            count = await get_collection("symb_production_progress").count_documents({})
            if count > 0:
                logs.append({
                    "id": "ref_progress_existing",
                    "week": 0,
                    "file_date": "Active",
                    "file_name": f"production_progress.csv ({count} records in DB)",
                    "type": "symb_ref_progress",
                    "created_at": datetime.now()
                })
        if type in [None, "symb_reference", "symb_ref_plan"] and "symb_ref_plan" not in found_types:
            count = await get_collection("symb_plan_raw").count_documents({})
            if count > 0:
                logs.append({
                    "id": "ref_plan_existing",
                    "week": 0,
                    "file_date": "Active",
                    "file_name": f"SYMB Plan ({count} records in DB)",
                    "type": "symb_ref_plan",
                    "created_at": datetime.now()
                })
        if type in [None, "symb_reference", "symb_ref_erp"] and "symb_ref_erp" not in found_types:
            count = await get_collection("symb_erp_mech_raw").count_documents({})
            if count > 0:
                logs.append({
                    "id": "ref_erp_existing",
                    "week": 0,
                    "file_date": "Active",
                    "file_name": f"ERP MECH ({count} records in DB)",
                    "type": "symb_ref_erp",
                    "created_at": datetime.now()
                })


        return logs
    except Exception as e:
        print(f"Error getting upload logs: {e}")
        return []

@router.post("/upload-logs")
async def add_upload_log_with_file(
    week: int = Form(...),
    file_date: str = Form(...),
    file_name: str = Form(...),
    type: str = Form(...),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    """
    Start CSV upload and transformation as a background task.
    Returns upload_id for progress tracking.
    """
    import io
    import pandas as pd
    
    try:
        coll_logs = get_collection("upload_logs")
        
        # STEP 1: Check duplicate upload log
        if type in ["symb_tracker", "symb"]:
            existing_log = await coll_logs.find_one({"file_date": file_date, "type": type})
            if existing_log:
                raise HTTPException(status_code=400, detail=f"SYMB Tracker data for date {file_date} already exists. Please delete it first if you wish to re-upload.")
        elif type == "invoice":
            # For invoice uploads, allow replacing previous dataset seamlessly
            pass
        else:
            existing_log = await coll_logs.find_one({"week": week, "type": type})
            if existing_log:
                raise HTTPException(status_code=400, detail=f"Data for week {week} already exists. Please delete it first.")
        
        # STEP 2: Read CSV file into memory
        contents = await file.read()
        
        # Generate unique upload ID
        upload_id = str(uuid.uuid4())
        
        # Initialize progress
        update_progress(upload_id, 0, 9, "Starting", "Upload initiated", "processing")
        
        # STEP 3: Start background task
        background_tasks.add_task(
            process_upload_background,
            upload_id,
            contents,
            week,
            file_date,
            file_name,
            type
        )
        
        return {
            "status": "started",
            "upload_id": upload_id,
            "message": "Upload started. Check progress using the upload_id."
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


async def process_upload_background(upload_id: str, contents: bytes, week: int, file_date: str, file_name: str, type: str):
    """
    Background task to process CSV upload with progress updates.
    """
    import io
    import pandas as pd
    from progress_tracker import update_progress as progress_update
    
    try:
        progress_update(upload_id, 1, 11, "Reading CSV", "Reading and parsing CSV file", "processing")
        try:
            df = pd.read_csv(io.BytesIO(contents))
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(contents), encoding='latin-1')
        print(f"CSV loaded: {len(df)} rows, {len(df.columns)} columns")
        
        progress_update(upload_id, 2, 11, "Validating", "Validating data format", "processing")
        coll_logs = get_collection("upload_logs")

        # ── Invoice branch ───────────────────────────────────────────
        if type == "invoice":
            await _process_invoice_upload(
                upload_id, df, week, file_date, file_name, type, coll_logs, progress_update
            )
            return

        # ── Gross Margin branch ───────────────────────────────────────
        if type == "gross_margin":
            await _process_gross_margin_upload(
                upload_id, df, week, file_date, file_name, type, coll_logs, progress_update
            )
            return

        # ── SYMB Tracker branch ───────────────────────────────────────
        if type == "symb_tracker" or type == "symb":
            progress_update(upload_id, 3, 11, "Saving Upload Log", "Creating upload log entry...", "processing")
            log_dict = {
                "week": week,
                "file_date": file_date,
                "file_name": file_name,
                "type": type,
                "created_at": datetime.now()
            }
            await coll_logs.insert_one(log_dict)

            _client = AsyncIOMotorClient(MONGODB_URL)
            _db = _client[DB_NAME]

            from SYMB_transformation import process_symb_tracker_upload
            try:
                def symb_progress(step_name, msg, **kwargs):
                    progress_update(upload_id, 6, 11, step_name, msg, "processing", **kwargs)

                await process_symb_tracker_upload(df, week, file_date, _db, progress_callback=symb_progress)
                progress_update(upload_id, 11, 11, "Complete", f"Successfully processed SYMB Tracker data for week {week}", "completed")
            except Exception as symb_err:
                import traceback
                traceback.print_exc()
                progress_update(upload_id, 11, 11, "Error", f"SYMB Tracker pipeline error: {symb_err}", "error")

            await asyncio.sleep(10)
            clear_progress(upload_id)
            return

        # ── Weekly / Revenue branch (original pipeline) ───────────────
        from transformation import transform_weekly_data

        coll_data = get_collection("weekly_tracker_data")
        coll_backlog = get_collection("orderbacklogs")
        
        # Get database instance
        _client = AsyncIOMotorClient(MONGODB_URL)
        _db = _client[DB_NAME]
        
        # STEP 3-10: Run transformation pipeline (steps 3-10 in progress bar)
        for step in range(3, 10):
            step_names = {
                3: ("Data Cleaning", "Cleaning and filtering data"),
                4: ("Zoho API", "Fetching forecast data from Zoho CRM"),
                5: ("Merging Data", "Merging forecast with main dataset"),
                6: ("Backfilling", "Backfilling audited dates"),
                7: ("Transforming", "Applying fiscal year and category transforms"),
                8: ("Calculating", "Calculating metrics and projections"),
                9: ("Aggregating", "Aggregating data for FY2027")
            }
            name, msg = step_names.get(step, ("Processing", "Processing data"))
            progress_update(upload_id, step, 11, name, msg, "processing")
            await asyncio.sleep(0.1)  # Small delay for UI update
        
        dataset_agg, backlog_df = await transform_weekly_data(df, week, file_date, _db)
        
        if dataset_agg is None or len(dataset_agg) == 0:
            progress_update(upload_id, 11, 11, "Error", "Transformation resulted in no data", "error")
            return
        
        # STEP 11: Save to database
        progress_update(upload_id, 10, 11, "Saving Log", "Saving upload log", "processing")
        log_dict = {
            "week": week,
            "file_date": file_date,
            "file_name": file_name,
            "type": type,
            "created_at": datetime.now()
        }
        log_result = await coll_logs.insert_one(log_dict)
        
        
        progress_update(upload_id, 11, 11, "Saving Data", f"Saving {len(dataset_agg)} transformed records", "processing")
        
        # DEBUG: Check dataset_agg details
        print(f"\n{'='*70}")
        print(f"DEBUG: Pre-conversion dataset_agg info:")
        print(f"  → DataFrame shape: {dataset_agg.shape}")
        print(f"  → Number of rows: {len(dataset_agg)}")
        print(f"  → Columns: {list(dataset_agg.columns)}")
        print(f"  → NaN count per column:")
        for col in dataset_agg.columns:
            nan_count = dataset_agg[col].isna().sum()
            if nan_count > 0:
                print(f"     - {col}: {nan_count} NaNs")
        print(f"{'='*70}\n")
        
        records = dataset_agg.to_dict('records')
        
        # DEBUG: Check records after conversion
        print(f"\n{'='*70}")
        print(f"DEBUG: Post-conversion records info:")
        print(f"  → Number of records after to_dict: {len(records)}")
        if len(records) != len(dataset_agg):
            print(f"  ⚠️  WARNING: Lost {len(dataset_agg) - len(records)} records during to_dict conversion!")
        print(f"  → Sample record (first): {records[0] if records else 'No records'}")
        print(f"{'='*70}\n")
        
        if records:
            # CRITICAL FIX: Delete any existing records for this week BEFORE insertion
            print(f"Checking for existing records for week {week} and type {type}...")
            existing_count = await coll_data.count_documents({"week": week, "type": type})
            if existing_count > 0:
                print(f"  ⚠️  Found {existing_count} existing records - DELETING first...")
                delete_result = await coll_data.delete_many({"week": week, "type": type})
                print(f"  ✓ Deleted {delete_result.deleted_count} old records")
                
            existing_backlog_count = await coll_backlog.count_documents({"week": week, "type": type})
            if existing_backlog_count > 0:
                print(f"  ⚠️  Found {existing_backlog_count} existing backlog records - DELETING first...")
                await coll_backlog.delete_many({"week": week, "type": type})
                print(f"  ✓ Deleted {existing_backlog_count} old backlog records")
            
            print(f"Inserting {len(records)} records into MongoDB...")
            try:
                # Use ordered=False to attempt all inserts even if some fail
                insert_result = await coll_data.insert_many(records, ordered=False)
                print(f"  ✓ MongoDB insert successful: {len(insert_result.inserted_ids)} records inserted")
                
                if len(insert_result.inserted_ids) != len(records):
                    print(f"  ⚠️  WARNING: Attempted {len(records)} but only {len(insert_result.inserted_ids)} were inserted!")
                    
                # Verify final count
                final_count = await coll_data.count_documents({"week": week, "type": type})
                print(f"  → Final count in DB for week {week}, type {type}: {final_count}")
                
            except Exception as insert_err:
                print(f"  ❌ MongoDB insertion error: {insert_err}")
                # Even with errors, check how many made it
                final_count = await coll_data.count_documents({"week": week, "type": type})
                print(f"  → Records in DB after error: {final_count}")
                raise
                
        if backlog_df is not None and len(backlog_df) > 0:
            backlog_records = backlog_df.to_dict('records')
            print(f"Inserting {len(backlog_records)} backlog records into MongoDB...")
            try:
                insert_result = await coll_backlog.insert_many(backlog_records, ordered=False)
                print(f"  ✓ MongoDB backlog insert successful: {len(insert_result.inserted_ids)} records inserted")
            except Exception as insert_err:
                print(f"  ❌ MongoDB backlog insertion error: {insert_err}")
        else:
            print("  ⚠️  No backlog records to insert!")

        # STEP 12: Automated Services Trend Pipeline / SYMB Tracker Pipeline
        if type == "weekly":
            progress_update(upload_id, 12, 13, "Services Trend", "Executing automated Services Trend pipeline (Zoho API & Snapshots)...", "processing")
            from transformation import generate_services_trend_from_weekly_df
            try:
                def svc_progress(step_name, msg, **kwargs):
                    progress_update(upload_id, 12, 13, step_name, msg, "processing", **kwargs)

                await generate_services_trend_from_weekly_df(df, week, file_date, _db, progress_callback=svc_progress)
            except Exception as svc_err:
                print(f"  ⚠️ Automated Services Trend pipeline failed: {svc_err}")
                import traceback
                traceback.print_exc()

        elif type == "symb_tracker" or type == "symb":
            progress_update(upload_id, 12, 13, "SYMB Tracker Pipeline", "Executing automated SYMB Tracker pipeline (Zoho Sales Orders API)...", "processing")
            from SYMB_transformation import process_symb_tracker_upload
            try:
                def symb_progress(step_name, msg, **kwargs):
                    progress_update(upload_id, 12, 13, step_name, msg, "processing", **kwargs)

                await process_symb_tracker_upload(df, week, file_date, _db, progress_callback=symb_progress)
            except Exception as symb_err:
                print(f"  ⚠️ Automated SYMB Tracker pipeline failed: {symb_err}")
                import traceback
                traceback.print_exc()

        progress_update(upload_id, 13, 13, "Complete", f"Successfully processed {len(records)} records for week {week}", "completed")
        
        # Clear progress after 10 seconds
        await asyncio.sleep(10)
        clear_progress(upload_id)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        progress_update(upload_id, 13, 13, "Error", str(e), "error")


@router.post("/trigger-services-trend-sync")
async def trigger_services_trend_sync(
    week: int = Form(...),
    background_tasks: BackgroundTasks = None
):
    """Trigger automated Services Trend sync for a given week using existing weekly data in DB."""
    import pandas as pd
    from transformation import generate_services_trend_from_weekly_df

    try:
        coll_logs = get_collection("upload_logs")
        log_doc = await coll_logs.find_one({"week": week, "type": "weekly"})
        if not log_doc:
            raise HTTPException(status_code=404, detail=f"No weekly upload found for week {week}")

        coll_data = get_collection("weekly_tracker_data")
        cursor = coll_data.find({"week": week})
        docs = await cursor.to_list(length=100000)
        if not docs:
            raise HTTPException(status_code=404, detail=f"No data records found for week {week}")

        df = pd.DataFrame(docs)
        upload_id = str(uuid.uuid4())
        file_date = log_doc.get("file_date", datetime.now().strftime("%d-%m-%Y"))

        update_progress(upload_id, 0, 5, "Starting", "Services Trend sync initiated", "processing")
        
        _client = AsyncIOMotorClient(MONGODB_URL)
        _db = _client[DB_NAME]

        async def _run_sync():
            try:
                def progress_cb(step_name, msg, **kwargs):
                    update_progress(upload_id, 2, 5, step_name, msg, "processing", **kwargs)
                
                await generate_services_trend_from_weekly_df(df, week, file_date, _db, progress_callback=progress_cb)
                update_progress(upload_id, 5, 5, "Complete", f"Successfully synced Services Trend for week {week}", "completed")
                await asyncio.sleep(10)
                clear_progress(upload_id)
            except Exception as e:
                import traceback
                traceback.print_exc()
                update_progress(upload_id, 5, 5, "Error", str(e), "error")

        background_tasks.add_task(_run_sync)
        return {
            "status": "started",
            "upload_id": upload_id,
            "message": "Services Trend sync started."
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/upload-services-trend")
async def upload_services_trend_files(
    week: int = Form(...),
    file_date: str = Form(...),
    timeline_file_name: str = Form(...),
    opp_file_name: str = Form(...),
    timeline_file: UploadFile = File(...),
    opp_file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
):
    """Upload the paired Services trend timeline/opportunity CSV files."""
    try:
        coll_logs = get_collection("upload_logs")
        existing_log = await coll_logs.find_one({"week": week, "type": "services_trend"})
        if existing_log:
            raise HTTPException(status_code=400, detail=f"Services trend data for week {week} already exists. Please delete it first.")

        timeline_contents = await timeline_file.read()
        opp_contents = await opp_file.read()
        upload_id = str(uuid.uuid4())

        update_progress(upload_id, 0, 6, "Starting", "Services trend upload initiated", "processing")
        background_tasks.add_task(
            process_services_trend_upload_background,
            upload_id,
            timeline_contents,
            opp_contents,
            week,
            file_date,
            timeline_file_name,
            opp_file_name,
        )

        return {
            "status": "started",
            "upload_id": upload_id,
            "message": "Services trend upload started. Check progress using the upload_id.",
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Services trend upload failed: {str(e)}")


async def process_services_trend_upload_background(
    upload_id: str,
    timeline_contents: bytes,
    opp_contents: bytes,
    week: int,
    file_date: str,
    timeline_file_name: str,
    opp_file_name: str,
):
    import io
    import pandas as pd
    from progress_tracker import update_progress as progress_update
    from transformation import transform_services_q1_snapshot_data

    total_steps = 6
    try:
        progress_update(upload_id, 1, total_steps, "Reading CSVs", "Reading timeline and opportunity CSV files", "processing")
        try:
            timeline_df = pd.read_csv(io.BytesIO(timeline_contents))
        except UnicodeDecodeError:
            timeline_df = pd.read_csv(io.BytesIO(timeline_contents), encoding="latin-1")
        try:
            opp_df = pd.read_csv(io.BytesIO(opp_contents))
        except UnicodeDecodeError:
            opp_df = pd.read_csv(io.BytesIO(opp_contents), encoding="latin-1")

        progress_update(upload_id, 2, total_steps, "Validating", "Validating Services trend CSV columns", "processing")
        coll_logs = get_collection("upload_logs")

        progress_update(upload_id, 3, total_steps, "Calculating", "Computing Q1 weekly snapshot analysis", "processing")
        documents = transform_services_q1_snapshot_data(
            timeline_df,
            opp_df,
            week,
            file_date,
            timeline_file_name,
            opp_file_name,
        )

        progress_update(upload_id, 4, total_steps, "Saving Log", "Saving Services trend upload log", "processing")
        await coll_logs.insert_one({
            "week": week,
            "file_date": file_date,
            "file_name": f"{timeline_file_name} + {opp_file_name}",
            "type": "services_trend",
            "created_at": datetime.now(),
        })

        progress_update(upload_id, 5, total_steps, "Replacing Old Data", "Replacing existing Services Q1 snapshot rows", "processing")
        coll_snapshots = get_collection("services_q1_snapshots")
        existing = await coll_snapshots.count_documents({"upload_week": week, "type": "services_trend"})
        if existing > 0:
            await coll_snapshots.delete_many({"upload_week": week, "type": "services_trend"})

        progress_update(upload_id, 6, total_steps, "Saving Data", f"Saving {len(documents)} Services Q1 snapshot records", "processing")
        await coll_snapshots.insert_many(documents, ordered=False)

        progress_update(upload_id, total_steps, total_steps, "Complete", f"Successfully processed {len(documents)} Services Q1 snapshot records for week {week}", "completed")
        await asyncio.sleep(10)
        clear_progress(upload_id)
    except ValueError as ve:
        progress_update(upload_id, total_steps, total_steps, "Error", str(ve), "error")
    except Exception as e:
        import traceback
        traceback.print_exc()
        progress_update(upload_id, total_steps, total_steps, "Error", str(e), "error")


async def _process_invoice_upload(
    upload_id: str,
    df,
    week: int,
    file_date: str,
    file_name: str,
    type_str: str,
    coll_logs,
    progress_update,
):
    """
    Dedicated processing path for Invoice Data CSV uploads.
    """
    import pandas as pd
    import numpy as np
    from transformation import categorize_region_vectorized, normalize_record_id

    total_steps = 5

    try:
        progress_update(upload_id, 2, total_steps, "Validating", "Validating invoice CSV columns...", "processing")

        col_map = {str(c).strip().lower(): c for c in df.columns}
        required_keys = ['record id', 'account name', 'grand total', 'econ-region', 'invoice date']
        missing_keys = [k for k in required_keys if k not in col_map]
        
        if missing_keys:
            missing_labels = [k.title() for k in missing_keys]
            msg = f"Missing required columns in CSV: {', '.join(missing_labels)}. Required columns: Record Id, Account Name, Grand Total, econ-Region, Invoice Date"
            print(f"✗ {msg}")
            progress_update(upload_id, total_steps, total_steps, "Error", msg, "error")
            return

        progress_update(upload_id, 3, total_steps, "Transforming", "Normalizing fields and mapping regions...", "processing")

        rec_col = col_map['record id']
        acct_col = col_map['account name']
        total_col = col_map['grand total']
        region_col = col_map['econ-region']
        date_col = col_map['invoice date']

        df_clean = df.copy()
        df_clean['Record Id'] = df_clean[rec_col].apply(normalize_record_id)
        df_clean['Account Name'] = df_clean[acct_col].astype(str).str.strip()
        df_clean['Grand Total'] = pd.to_numeric(df_clean[total_col], errors='coerce').fillna(0.0)
        df_clean['nRegion'] = df_clean[region_col].apply(categorize_region_vectorized)

        _client = AsyncIOMotorClient(MONGODB_URL)
        _db = _client[DB_NAME]

        region_mapping_coll = _db["Region_mapping_table"]
        region_mappings_cursor = region_mapping_coll.find({})
        region_mappings_list = await region_mappings_cursor.to_list(length=1000)
        region_lookup = {item.get('opportunities_owner'): item.get('region') for item in region_mappings_list if item.get('opportunities_owner')}

        def map_invoice_region(row):
            mapped = region_lookup.get(row.get('Account Name'))
            if mapped and mapped != "YET TO BE MAPPED":
                return mapped
            return row['nRegion']

        df_clean['mRegion'] = df_clean.apply(map_invoice_region, axis=1)

        # Parse Invoice Date
        df_clean['Invoice Date Parsed'] = pd.to_datetime(df_clean[date_col], errors='coerce')

        def extract_week(dt):
            if pd.isna(dt):
                return week if week > 0 else 35
            try:
                return int(dt.isocalendar().week)
            except Exception:
                return week if week > 0 else 35

        df_clean['week'] = df_clean['Invoice Date Parsed'].apply(extract_week)
        df_clean['week_label'] = df_clean['week'].apply(lambda w: f"Week {str(w).zfill(2)}")

        progress_update(upload_id, 4, total_steps, "Saving Data", f"Saving {len(df_clean)} invoice records to database...", "processing")

        invoice_coll = _db["invoice_data"]
        await invoice_coll.delete_many({})

        records_to_insert = []
        for _, row in df_clean.iterrows():
            records_to_insert.append({
                "record_id": row['Record Id'],
                "account_name": row['Account Name'],
                "grand_total": float(row['Grand Total']),
                "econ_region": str(row[region_col]),
                "nRegion": str(row['nRegion']),
                "mRegion": str(row['mRegion']),
                "invoice_date": row['Invoice Date Parsed'].isoformat() if not pd.isna(row['Invoice Date Parsed']) else str(row[date_col]),
                "week": int(row['week']),
                "week_label": str(row['week_label']),
                "upload_id": upload_id,
                "created_at": datetime.now()
            })

        if records_to_insert:
            await invoice_coll.insert_many(records_to_insert)

        log_dict = {
            "week": week,
            "file_date": file_date,
            "file_name": file_name,
            "type": type_str,
            "created_at": datetime.now(),
        }
        await coll_logs.insert_one(log_dict)

        progress_update(upload_id, total_steps, total_steps, "Complete", f"Successfully processed {len(records_to_insert)} invoice records.", "completed")
        await asyncio.sleep(2)
        clear_progress(upload_id)
    except Exception as err:
        import traceback
        traceback.print_exc()
        progress_update(upload_id, total_steps, total_steps, "Error", f"Invoice pipeline error: {err}", "error")


async def _process_gross_margin_upload(
    upload_id: str,
    df,
    week: int,
    file_date: str,
    file_name: str,
    type: str,
    coll_logs,
    progress_update,
):
    """
    Dedicated processing path for Gross Margin CSV uploads.
    Fewer steps than the weekly pipeline (no Zoho API, no region mapping, no backfill).
    """
    from transformation import transform_gross_margin_data

    total_steps = 5

    try:
        # STEP 2 already sent by caller ("Validating")
        progress_update(upload_id, 2, total_steps, "Validating", "Validating gross margin CSV columns", "processing")

        # STEP 3: Transform
        progress_update(upload_id, 3, total_steps, "Transforming", "Computing gross margin summaries", "processing")
        documents = transform_gross_margin_data(df, week, file_date)

        if not documents:
            progress_update(upload_id, total_steps, total_steps, "Error", "Transformation resulted in no data", "error")
            return

        # STEP 4: Save upload log
        progress_update(upload_id, 4, total_steps, "Saving Log", "Saving upload log", "processing")
        log_dict = {
            "week": week,
            "file_date": file_date,
            "file_name": file_name,
            "type": type,
            "created_at": datetime.now(),
        }
        await coll_logs.insert_one(log_dict)

        # STEP 5: Save data to gross_margin_data collection
        coll_gm = get_collection("gross_margin_data")

        # Delete any pre-existing records for this week before insertion
        existing = await coll_gm.count_documents({"upload_week": week, "type": "gross_margin"})
        if existing > 0:
            print(f"  ⚠️  Found {existing} existing gross margin records for week {week} — deleting...")
            await coll_gm.delete_many({"upload_week": week, "type": "gross_margin"})

        progress_update(upload_id, 5, total_steps, "Saving Data", f"Saving {len(documents)} gross margin records", "processing")
        await coll_gm.insert_many(documents, ordered=False)
        print(f"  ✓ Inserted {len(documents)} gross margin documents")

        progress_update(upload_id, total_steps, total_steps, "Complete", f"Successfully processed {len(documents)} gross margin records for week {week}", "completed")

        await asyncio.sleep(10)
        clear_progress(upload_id)

    except ValueError as ve:
        progress_update(upload_id, total_steps, total_steps, "Error", str(ve), "error")
    except Exception as e:
        import traceback
        traceback.print_exc()
        progress_update(upload_id, total_steps, total_steps, "Error", str(e), "error")


@router.get("/active-upload")
async def get_active_upload():
    """
    Check if there is any ongoing upload task currently processing in memory.
    """
    for upload_id, progress in list(progress_store.items()):
        if progress.status == 'processing':
            sub_pct = (progress.items_processed / progress.items_total) if (progress.items_total and progress.items_processed is not None) else None
            if sub_pct is not None:
                calc_pct = int((((progress.step - 1) + sub_pct) / progress.total_steps) * 100)
            else:
                calc_pct = int((progress.step / progress.total_steps) * 100)
            
            return {
                "active": True,
                "upload_id": upload_id,
                "step": progress.step,
                "total_steps": progress.total_steps,
                "step_name": progress.step_name,
                "message": progress.message,
                "status": progress.status,
                "error": progress.error,
                "progress_percent": min(99, max(1, calc_pct)),
                "start_time_str": progress.start_time_str,
                "est_completion_time_str": progress.est_completion_time_str,
                "time_remaining_str": progress.time_remaining_str,
                "items_processed": progress.items_processed,
                "items_total": progress.items_total,
            }
    return {"active": False}


@router.get("/upload-progress/{upload_id}")
async def get_upload_progress(upload_id: str):
    """
    Get progress status for an upload.
    """
    progress = get_progress(upload_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Upload ID not found or progress expired")
    
    sub_pct = (progress.items_processed / progress.items_total) if (progress.items_total and progress.items_processed is not None) else None
    if sub_pct is not None:
        calc_pct = int((((progress.step - 1) + sub_pct) / progress.total_steps) * 100)
    else:
        calc_pct = int((progress.step / progress.total_steps) * 100)

    return {
        "upload_id": upload_id,
        "step": progress.step,
        "total_steps": progress.total_steps,
        "step_name": progress.step_name,
        "message": progress.message,
        "status": progress.status,
        "error": progress.error,
        "progress_percent": min(99, max(1, calc_pct)),
        "start_time_str": progress.start_time_str,
        "est_completion_time_str": progress.est_completion_time_str,
        "time_remaining_str": progress.time_remaining_str,
        "items_processed": progress.items_processed,
        "items_total": progress.items_total,
    }


@router.delete("/upload-logs/{log_id}")
async def delete_upload_log(log_id: str):
    """
    Delete upload log and CASCADE DELETE all associated data records.
    
    Steps:
    1. Find log to get week & type
    2. Delete from upload_logs
    3. CASCADE: Delete all data records for this week+type
    """
    from bson import ObjectId
    try:
        coll_logs = get_collection("upload_logs")
        coll_data = get_collection("weekly_tracker_data")
        
        # STEP 1: Get log details to find week & type
        log = await coll_logs.find_one({"_id": ObjectId(log_id)})
        if not log:
            raise HTTPException(status_code=404, detail="Log not found")
        
        week = log.get("week")
        type_val = log.get("type")
        print(f"Deleting upload log: week={week}, type={type_val}")
        
        # STEP 2: Delete from upload_logs
        await coll_logs.delete_one({"_id": ObjectId(log_id)})
        print(f"Deleted upload log ID: {log_id}")
        
        # STEP 3: CASCADE DELETE — route by type
        if type_val == "gross_margin":
            coll_gm = get_collection("gross_margin_data")
            delete_result = await coll_gm.delete_many({
                "upload_week": week,
                "type": "gross_margin"
            })
            print(f"CASCADE: Deleted {delete_result.deleted_count} gross margin records")
            return {
                "status": "success",
                "message": f"Log deleted. Removed {delete_result.deleted_count} gross margin records.",
                "week": week,
                "type": type_val,
                "data_records_deleted": delete_result.deleted_count
            }

        if type_val == "services_trend":
            coll_snapshots = get_collection("services_q1_snapshots")
            delete_result = await coll_snapshots.delete_many({
                "upload_week": week,
                "type": "services_trend"
            })
            print(f"CASCADE: Deleted {delete_result.deleted_count} services Q1 snapshot records")
            return {
                "status": "success",
                "message": f"Log deleted. Removed {delete_result.deleted_count} Services Q1 snapshot records.",
                "week": week,
                "type": type_val,
                "data_records_deleted": delete_result.deleted_count
            }

        if type_val in ["symb_tracker", "symb"]:
            coll_symb = get_collection("symb_tracker_data")
            file_date_val = log.get("file_date")
            query = {"file_date": file_date_val} if file_date_val else {"upload_week": week}
            delete_result = await coll_symb.delete_many(query)
            print(f"CASCADE: Deleted {delete_result.deleted_count} SYMB tracker records for date {file_date_val or week}")
            return {
                "status": "success",
                "message": f"Log deleted. Removed {delete_result.deleted_count} SYMB tracker records.",
                "week": week,
                "type": type_val,
                "data_records_deleted": delete_result.deleted_count
            }

        if type_val == "symb_ref_so" or log_id == "ref_so_existing":
            coll = get_collection("symb_so_numbers")
            delete_result = await coll.delete_many({})
            return {"status": "success", "message": f"Deleted SYMB SO reference numbers log and {delete_result.deleted_count} records.", "type": "symb_ref_so"}

        if type_val == "symb_ref_jabil" or log_id == "ref_jabil_existing":
            coll = get_collection("symb_jabil_production")
            delete_result = await coll.delete_many({})
            return {"status": "success", "message": f"Deleted Jabil production reference log and {delete_result.deleted_count} records.", "type": "symb_ref_jabil"}

        if type_val == "symb_ref_progress" or log_id == "ref_progress_existing":
            coll = get_collection("symb_production_progress")
            delete_result = await coll.delete_many({})
            return {"status": "success", "message": f"Deleted production progress reference log and {delete_result.deleted_count} records.", "type": "symb_ref_progress"}

        if type_val == "symb_ref_plan" or log_id == "ref_plan_existing":
            coll = get_collection("symb_plan_raw")
            delete_result = await coll.delete_many({})
            return {"status": "success", "message": f"Deleted SYMB plan reference log and {delete_result.deleted_count} records.", "type": "symb_ref_plan"}

        if type_val == "symb_ref_erp" or log_id == "ref_erp_existing":
            coll = get_collection("symb_erp_mech_raw")
            delete_result = await coll.delete_many({})
            return {"status": "success", "message": f"Deleted ERP MECH reference log and {delete_result.deleted_count} records.", "type": "symb_ref_erp"}

        # Default: weekly / revenue cascade
        delete_result = await coll_data.delete_many({
            "week": week,
            "type": type_val
        })
        print(f"CASCADE: Deleted {delete_result.deleted_count} data records")
        
        # STEP 4: CASCADE DELETE: Delete all backlog records for this week+type
        coll_backlog = get_collection("orderbacklogs")
        delete_backlog_result = await coll_backlog.delete_many({
            "week": week,
            "type": type_val
        })
        print(f"CASCADE: Deleted {delete_backlog_result.deleted_count} backlog records")
        
        return {
            "status": "success",
            "message": f"Log deleted. Removed {delete_result.deleted_count} data records.",
            "week": week,
            "type": type_val,
            "data_records_deleted": delete_result.deleted_count
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


# ====================================================================
# REGION MAPPING ENDPOINTS
# ====================================================================

@router.get("/region-mapping")
async def get_region_mappings():
    """
    Get all region mappings.
    """
    try:
        coll = get_collection("Region_mapping_table")
        cursor = coll.find({}).sort("opportunities_owner", 1)
        mappings = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            mappings.append(doc)
        return mappings
    except Exception as e:
        print(f"Error fetching region mappings: {e}")
        return []

@router.post("/region-mapping/upload")
async def upload_region_mapping(
    file: UploadFile = File(...)
):
    """
    Upload CSV file with region mappings and replace all existing data.
    CSV must have exactly two columns: "Opportunities Owner" and "Region"
    """
    import io
    import pandas as pd
    
    try:
        # Validate file extension
        if not file.filename.lower().endswith('.csv'):
            raise HTTPException(status_code=400, detail="Invalid file type. Only .csv files are allowed.")
        
        # Read CSV file
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        # Validate column names
        expected_columns = ["Opportunities Owner", "Region"]
        if list(df.columns) != expected_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid CSV format. Expected columns: {expected_columns}, but got: {list(df.columns)}"
            )
        
        # Check if dataframe is empty
        if len(df) == 0:
            raise HTTPException(status_code=400, detail="CSV file is empty.")
        
        # Get collection
        coll = get_collection("Region_mapping_table")
        
        # Delete all existing records
        delete_result = await coll.delete_many({})
        print(f"Deleted {delete_result.deleted_count} existing region mappings")
        
        # Convert dataframe to records
        records = []
        for _, row in df.iterrows():
            records.append({
                "opportunities_owner": str(row["Opportunities Owner"]).strip(),
                "region": str(row["Region"]).strip(),
                "created_at": datetime.now()
            })
        
        # Insert new records
        if records:
            insert_result = await coll.insert_many(records)
            inserted_count = len(insert_result.inserted_ids)
            print(f"Inserted {inserted_count} new region mappings")
            
            return {
                "status": "success",
                "message": f"Successfully uploaded {inserted_count} region mappings",
                "count": inserted_count
            }
        else:
            raise HTTPException(status_code=400, detail="No valid records found in CSV")
            
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.delete("/region-mapping")
async def delete_all_region_mappings():
    """
    Delete all region mappings.
    """
    try:
        coll = get_collection("Region_mapping_table")
        result = await coll.delete_many({})
        
        return {
            "status": "success",
            "message": f"Deleted {result.deleted_count} region mappings",
            "deleted_count": result.deleted_count
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ====================================================================
# SYMB TRACKER REFERENCE DATA & DASHBOARD ENDPOINTS
# ====================================================================

@router.get("/symb-so-numbers")
async def get_symb_so_numbers():
    """Get all stored SYMB SO Numbers reference data."""
    try:
        coll = get_collection("symb_so_numbers")
        cursor = coll.find({})
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            items.append(doc)
        return items
    except Exception as e:
        print(f"Error fetching SYMB SO numbers: {e}")
        return []

@router.post("/symb-so-numbers/upload")
async def upload_symb_so_numbers(file: UploadFile = File(...)):
    """Upload CSV with SYMB SO numbers and replace existing collection."""
    import io
    import pandas as pd
    try:
        if not file.filename.lower().endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only .csv files allowed.")
        contents = await file.read()
        try:
            df = pd.read_csv(io.BytesIO(contents), dtype=str)
        except (UnicodeDecodeError, Exception):
            df = pd.read_csv(io.BytesIO(contents), dtype=str, encoding='latin-1')

        if len(df) == 0:
            raise HTTPException(status_code=400, detail="CSV file is empty.")
        
        coll = get_collection("symb_so_numbers")
        await coll.delete_many({})
        records = df.to_dict('records')
        for r in records:
            for k, v in list(r.items()):
                if pd.isna(v):
                    r[k] = None
        if records:
            await coll.insert_many(records, ordered=False)
        
        # Log this upload in upload_logs for metadata tracking
        coll_logs = get_collection("upload_logs")
        today_str = datetime.now().strftime("%d-%m-%Y")
        await coll_logs.delete_many({"type": "symb_ref_so"})
        await coll_logs.insert_one({
            "week": 0,
            "file_date": today_str,
            "file_name": file.filename,
            "type": "symb_ref_so",
            "created_at": datetime.now(),
            "records_count": len(records)
        })

        return {"status": "success", "message": f"Successfully stored {len(records)} SYMB SO numbers", "count": len(records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/symb-jabil-production")
async def get_symb_jabil_production():
    """Get all stored Jabil Production List Price reference data."""
    try:
        coll = get_collection("symb_jabil_production")
        cursor = coll.find({})
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            items.append(doc)
        return items
    except Exception as e:
        print(f"Error fetching Jabil production data: {e}")
        return []

@router.post("/symb-jabil-production/upload")
async def upload_symb_jabil_production(file: UploadFile = File(...)):
    """Upload CSV with Jabil Production list prices and replace existing collection."""
    import io
    import pandas as pd
    try:
        if not file.filename.lower().endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only .csv files allowed.")
        contents = await file.read()
        try:
            df = pd.read_csv(io.BytesIO(contents), dtype=str)
        except (UnicodeDecodeError, Exception):
            df = pd.read_csv(io.BytesIO(contents), dtype=str, encoding='latin-1')

        if len(df) == 0:
            raise HTTPException(status_code=400, detail="CSV file is empty.")
        
        coll = get_collection("symb_jabil_production")
        await coll.delete_many({})
        records = df.to_dict('records')
        for r in records:
            for k, v in list(r.items()):
                if pd.isna(v):
                    r[k] = None
        if records:
            await coll.insert_many(records, ordered=False)
        
        # Log this upload in upload_logs for metadata tracking
        coll_logs = get_collection("upload_logs")
        today_str = datetime.now().strftime("%d-%m-%Y")
        await coll_logs.delete_many({"type": "symb_ref_jabil"})
        await coll_logs.insert_one({
            "week": 0,
            "file_date": today_str,
            "file_name": file.filename,
            "type": "symb_ref_jabil",
            "created_at": datetime.now(),
            "records_count": len(records)
        })

        return {"status": "success", "message": f"Successfully stored {len(records)} Jabil Production records", "count": len(records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ====================================================================
# SYMB PRODUCTION PROGRESS ENDPOINTS (V1 & V2)
# ====================================================================

import math

def clean_json_nan(obj):
    """Recursively replace NaN and Inf float values in dicts/lists with None to prevent FastAPI JSON serialization errors."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: clean_json_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_json_nan(v) for v in obj]
    return obj



class UpdateWeeklyPlanPayload(BaseModel):
    shipment_week: str
    v1_planned: int
    v2_planned: int

@router.post("/symb-plan/update-weekly-plan")
async def update_weekly_plan(payload: UpdateWeeklyPlanPayload, authorization: Optional[str] = Header(None)):
    import pandas as pd
    from SYMB_plan_transformation import run_symb_plan_pipeline
    from routers.auth import get_optional_current_user
    user_sess = await get_optional_current_user(authorization)
    await check_symb_time_lock(user_sess)
    try:
        coll = get_collection("symb_plan_raw")
        
        def norm_week(val):
            if not val:
                return ""
            s = str(val).strip()
            try:
                dt = pd.to_datetime(s, errors="coerce")
                if pd.notna(dt):
                    return dt.strftime("%Y-%m-%d")
            except Exception:
                pass
            return s

        target_week_key = norm_week(payload.shipment_week)
        if not target_week_key:
            raise HTTPException(status_code=400, detail="Invalid shipment week date format")

        cursor = coll.find({})
        v1_updated = False
        v2_updated = False

        async for doc in cursor:
            doc_week_key = norm_week(doc.get("Shipment Week"))
            doc_var = str(doc.get("Variant Type", "")).strip()

            if doc_week_key == target_week_key:
                if doc_var in ["V1", "v1", "Variant 1", "Varient 1"]:
                    await coll.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"planned Value": payload.v1_planned}}
                    )
                    v1_updated = True
                elif doc_var in ["V2", "v2", "Variant 2", "Varient 2"]:
                    await coll.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"planned Value": payload.v2_planned}}
                    )
                    v2_updated = True

        if not v1_updated:
            await coll.insert_one({
                "Shipment Week": payload.shipment_week,
                "Variant Type": "Varient 1",
                "Event Type": "Finished goods",
                "planned Value": payload.v1_planned,
                "Last Batch Date": payload.shipment_week
            })

        if not v2_updated:
            await coll.insert_one({
                "Shipment Week": payload.shipment_week,
                "Variant Type": "Varient 2",
                "Event Type": "Finished goods",
                "planned Value": payload.v2_planned,
                "Last Batch Date": payload.shipment_week
            })

        await run_symb_plan_pipeline(db)
        return {"status": "success", "message": f"Successfully updated planned values for week {payload.shipment_week}"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error updating weekly plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/symb-plan/transformed")
async def get_symb_plan_transformed():
    try:
        from SYMB_plan_transformation import run_symb_plan_pipeline
        await run_symb_plan_pipeline(db)
        coll = get_collection("symb_plan_transformed")
        cursor = coll.find({})
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            items.append(doc)
        return clean_json_nan(items)
    except Exception as e:
        print(f"Error fetching SYMB plan transformed data: {e}")
        return []

@router.post("/symb-plan/upload")
async def upload_symb_plan(file: UploadFile = File(...), background_tasks: BackgroundTasks = BackgroundTasks()):
    import io
    import pandas as pd
    from SYMB_plan_transformation import run_symb_plan_pipeline
    try:
        contents = await file.read()
        try:
            df = pd.read_csv(io.BytesIO(contents))
        except:
            df = pd.read_csv(io.BytesIO(contents), encoding='latin-1')
        df.columns = [str(c).strip() for c in df.columns]
        coll = get_collection("symb_plan_raw")
        await coll.delete_many({})
        records = df.to_dict('records')
        for r in records:
            r.pop('_id', None)
            for k, v in list(r.items()):
                if pd.isna(v): r[k] = None
        if records:
            await coll.insert_many(records, ordered=False)
        coll_logs = get_collection("upload_logs")
        today_str = datetime.now().strftime("%d-%m-%Y")
        await coll_logs.delete_many({"type": "symb_ref_plan"})
        await coll_logs.insert_one({
            "week": 0, "file_date": today_str, "file_name": file.filename, "type": "symb_ref_plan", "created_at": datetime.now(), "records_count": len(records)
        })
        background_tasks.add_task(run_symb_plan_pipeline, db)
        return {"status": "success", "message": f"Successfully stored {len(records)} SYMB Plan records", "count": len(records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/symb-erp-mech/upload")
async def upload_symb_erp_mech(file: UploadFile = File(...), background_tasks: BackgroundTasks = BackgroundTasks()):
    import io
    import pandas as pd
    from SYMB_plan_transformation import run_symb_plan_pipeline
    try:
        contents = await file.read()
        try:
            df = pd.read_excel(io.BytesIO(contents), engine='calamine')
        except:
            df = pd.read_excel(io.BytesIO(contents), engine='openpyxl')
        df.columns = [str(c).strip() for c in df.columns]
        coll = get_collection("symb_erp_mech_raw")
        await coll.delete_many({})
        records = df.to_dict('records')
        for r in records:
            r.pop('_id', None)
            for k, v in list(r.items()):
                if pd.isna(v) or str(v).lower() == "nan": r[k] = None
        if records:
            await coll.insert_many(records, ordered=False)
        coll_logs = get_collection("upload_logs")
        today_str = datetime.now().strftime("%d-%m-%Y")
        await coll_logs.delete_many({"type": "symb_ref_erp"})
        await coll_logs.insert_one({
            "week": 0, "file_date": today_str, "file_name": file.filename, "type": "symb_ref_erp", "created_at": datetime.now(), "records_count": len(records)
        })
        background_tasks.add_task(run_symb_plan_pipeline, db)
        return {"status": "success", "message": f"Successfully stored {len(records)} ERP MECH records", "count": len(records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/symb-tracker/data")
async def get_symb_tracker_data(week: Optional[int] = None):
    """Retrieve processed SYMB tracker data and flag mappings."""
    try:
        coll_data = get_collection("symb_tracker_data")
        query = {"upload_week": week} if week else {}
        cursor = coll_data.find(query)
        records = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            records.append(doc)

        coll_flags = get_collection("symb_flag_mapping")
        flag_cursor = coll_flags.find({})
        flags = []
        async for doc in flag_cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            flags.append(doc)

        return clean_json_nan({"records": records, "flags": flags, "count": len(records)})
    except Exception as e:
        print(f"Error fetching SYMB tracker data: {e}")
        return {"records": [], "flags": [], "count": 0}

# ====================================================================
# PRESENTATION SLIDES ENDPOINTS
# ====================================================================

from slides_compute import (
    compute_slide1_data,
    compute_slide2_data,
    compute_slide3_data,
    compute_slide4_data,
    compute_slide5_data,
    compute_slide6_data,
    compute_slide7_data,
    compute_slide8_data,
    compute_slide9_data,
    compute_slide10_data,
    compute_slide11_data,
    compute_slide12_data,
    compute_slide13_data,
    compute_slide14_data,
    compute_slide15_data,
    compute_slide16_data,
    compute_slide17_data,
    compute_slide18_data,
    compute_slide19_data,
    compute_slide20_data,
    compute_slide21_data,
    compute_slide22_data,
    compute_slide23_data,
    compute_slide24_data,
    compute_slide25_data,
    compute_slide26_data,
    compute_slide27_data,
    compute_slide28_data,
    compute_slide29_data,
    compute_slide30_data,
    compute_slide_services_data,
    compute_services_q1_snapshot_data,
    compute_order_backlog_data,
    compute_overall_gross_margin_data,
    compute_overall_gross_margin_region_summary_data,
    compute_region_manufacturing_gm_data,
    compute_region_services_gm_data,
    compute_region_services_cy_gm_data,
    compute_invoice_slide_data,
)

@router.get("/slides/invoice")
async def get_invoice_slide_data(region: str = "Overall"):
    """
    Get computed invoicing trend data for Overall or a specific region.
    """
    try:
        result = await compute_invoice_slide_data(db, region_name=region)
        return clean_json_nan(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to compute invoice slide data: {str(e)}")

@router.get("/slides/slide1")
async def get_slide1_data():
    """
    Get computed data for Slide 1 of the presentation.
    
    Returns:
        - stretch_target: Formatted stretch target value
        - base_target: Formatted base target value
        - total_po: Total PO (Closed Won weighted amount)
        - total_w_forecast: Total weighted forecast (Pipeline weighted amount)
    """
    try:
        result = await compute_slide1_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide data: {str(e)}")


@router.get("/slides/slide2")
async def get_slide2_data():
    """
    Get computed data for Slide 2 of the presentation.
    
    Returns three pie charts data:
        - prev_week_base: Previous week base target pie chart
        - current_week_base: Current week base target pie chart
        - current_week_stretch: Current week stretch target pie chart
    """
    try:
        result = await compute_slide2_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 2 data: {str(e)}")

@router.get("/slides/slide3")
async def get_slide3_data():
    """
    Get computed data for Slide 3 of the presentation.
    
    Returns data for the cumulative performance vs targets chart.
    """
    try:
        result = await compute_slide3_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 3 data: {str(e)}")

@router.get("/slides/slide4")
async def get_slide4_data():
    """
    Get computed data for Slide 4 of the presentation.
    
    Returns data for the 8-week historical trend chart.
    """
    try:
        result = await compute_slide4_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 4 data: {str(e)}")

@router.get("/slides/slide5")
async def get_slide5_data():
    """
    Get computed data for Slide 5 of the presentation.
    
    Returns data for the Actual vs Weighted Pipeline bar chart.
    """
    try:
        result = await compute_slide5_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 5 data: {str(e)}")

@router.get("/slides/slide6")
async def get_slide6_data():
    """
    Get computed data for Slide 6 of the presentation.
    
    Returns data for the Region-wise PO Breakdown table.
    """
    try:
        result = await compute_slide6_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 6 data: {str(e)}")

@router.get("/slides/slide7")
async def get_slide7_data():
    """
    Get computed data for Slide 7 of the presentation.
    
    Returns data for US West cumulative performance vs targets chart.
    """
    try:
        result = await compute_slide7_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 7 data: {str(e)}")

@router.get("/slides/slide8")
async def get_slide8_data():
    """
    Get computed data for Slide 8 of the presentation.
    
    Returns data for US West pipeline tracking over time chart.
    """
    try:
        result = await compute_slide8_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 8 data: {str(e)}")

@router.get("/slides/slide9")
async def get_slide9_data():
    """
    Get computed data for Slide 9 of the presentation.
    
    Returns data for US West actuals vs pipeline weekly bars chart.
    """
    try:
        result = await compute_slide9_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 9 data: {str(e)}")

@router.get("/slides/slide10")
async def get_slide10_data():
    """
    Get computed data for Slide 10 of the presentation.
    Europe Cumulative Performance
    """
    try:
        result = await compute_slide10_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 10 data: {str(e)}")

@router.get("/slides/slide11")
async def get_slide11_data():
    """
    Get computed data for Slide 11 of the presentation.
    Europe Trend
    """
    try:
        result = await compute_slide11_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 11 data: {str(e)}")

@router.get("/slides/slide12")
async def get_slide12_data():
    """
    Get computed data for Slide 12 of the presentation.
    Europe Pipeline
    """
    try:
        result = await compute_slide12_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 12 data: {str(e)}")

@router.get("/slides/slide13")
async def get_slide13_data():
    """
    Get computed data for Slide 13 of the presentation.
    US East Cumulative Performance
    """
    try:
        result = await compute_slide13_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 13 data: {str(e)}")

@router.get("/slides/slide14")
async def get_slide14_data():
    """
    Get computed data for Slide 14 of the presentation.
    US East Trend
    """
    try:
        result = await compute_slide14_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 14 data: {str(e)}")

@router.get("/slides/slide15")
async def get_slide15_data():
    """
    Get computed data for Slide 15 of the presentation.
    US East Pipeline
    """
    try:
        result = await compute_slide15_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 15 data: {str(e)}")

@router.get("/slides/slide16")
async def get_slide16_data():
    """
    Get computed data for Slide 16 of the presentation.
    Asean Cumulative Performance
    """
    try:
        result = await compute_slide16_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 16 data: {str(e)}")

@router.get("/slides/slide17")
async def get_slide17_data():
    """
    Get computed data for Slide 17 of the presentation.
    Asean Trend
    """
    try:
        result = await compute_slide17_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 17 data: {str(e)}")

@router.get("/slides/slide18")
async def get_slide18_data():
    """
    Get computed data for Slide 18 of the presentation.
    Asean Pipeline
    """
    try:
        result = await compute_slide18_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 18 data: {str(e)}")

@router.get("/slides/slide19")
async def get_slide19_data():
    """
    Get computed data for Slide 19 of the presentation.
    Japan Cumulative Performance
    """
    try:
        result = await compute_slide19_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 19 data: {str(e)}")

@router.get("/slides/slide20")
async def get_slide20_data():
    """
    Get computed data for Slide 20 of the presentation.
    Japan Trend
    """
    try:
        result = await compute_slide20_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 20 data: {str(e)}")

@router.get("/slides/slide21")
async def get_slide21_data():
    """
    Get computed data for Slide 21 of the presentation.
    Japan Pipeline
    """
    try:
        result = await compute_slide21_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 21 data: {str(e)}")

@router.get("/slides/slide22")
async def get_slide22_data():
    """
    Get computed data for Slide 22 of the presentation.
    KANZ Cumulative Performance
    """
    try:
        result = await compute_slide22_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 22 data: {str(e)}")

@router.get("/slides/slide23")
async def get_slide23_data():
    """
    Get computed data for Slide 23 of the presentation.
    KANZ Trend
    """
    try:
        result = await compute_slide23_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 23 data: {str(e)}")

@router.get("/slides/slide24")
async def get_slide24_data():
    """
    Get computed data for Slide 24 of the presentation.
    KANZ Pipeline
    """
    try:
        result = await compute_slide24_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 24 data: {str(e)}")

@router.get("/slides/slide25")
async def get_slide25_data():
    """
    Get computed data for Slide 25 of the presentation.
    Legacy Cumulative Performance
    """
    try:
        result = await compute_slide25_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 25 data: {str(e)}")

@router.get("/slides/slide26")
async def get_slide26_data():
    """
    Get computed data for Slide 26 of the presentation.
    Legacy Trend
    """
    try:
        result = await compute_slide26_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 26 data: {str(e)}")

@router.get("/slides/slide27")
async def get_slide27_data():
    """
    Get computed data for Slide 27 of the presentation.
    Legacy Actuals vs Pipeline Weekly Bars
    """
    try:
        result = await compute_slide27_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 27 data: {str(e)}")

@router.get("/slides/slide28")
async def get_slide28_data():
    """
    Get computed data for Slide 28 of the presentation.
    APAC Cumulative Performance
    """
    try:
        result = await compute_slide28_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 28 data: {str(e)}")

@router.get("/slides/slide29")
async def get_slide29_data():
    """
    Get computed data for Slide 29 of the presentation.
    APAC Trend
    """
    try:
        result = await compute_slide29_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 29 data: {str(e)}")

@router.get("/slides/slide30")
async def get_slide30_data():
    """
    Get computed data for Slide 30 of the presentation.
    APAC Pipeline
    """
    try:
        result = await compute_slide30_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide 30 data: {str(e)}")


@router.get("/slides/services/{slide_no}")
async def get_slide_services_data(slide_no: int):
    """
    Get Services-only computed data for any chart slide that has a Services mirror.

    Filters the underlying weekly_tracker_data aggregation by OPP_Type='Service' so the
    same chart shape (cumulative / trend / pipeline) is rendered using only Services
    revenue. Targets are not produced for Services and are omitted on the frontend.
    """
    try:
        result = await compute_slide_services_data(db, slide_no)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute services slide {slide_no} data: {str(e)}")


@router.get("/slides/services-q1-snapshot")
async def get_services_q1_snapshot_data(region: str = "Overall", quarter: str = "Q2"):
    """Get the latest Services weekly snapshot chart data for the selected quarter."""
    try:
        # DEBUG: Log what data is being selected
        collection = db["services_q1_snapshots"]
        latest_doc = await collection.find_one(
            {"type": "services_trend", "category": "q1_snapshot"},
            sort=[("created_at", -1)],
        )
        if latest_doc:
            print(f"[DEBUG] Services Snapshot ({quarter}) - Using upload_week: {latest_doc.get('upload_week')}, created_at: {latest_doc.get('created_at')}")

        result = await compute_services_q1_snapshot_data(db, region, quarter)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute Services snapshot data: {str(e)}")


@router.get("/debug/services-uploads")
async def debug_services_uploads():
    """DEBUG endpoint to check what Services uploads exist in the database."""
    try:
        collection = db["services_q1_snapshots"]
        
        # Get all unique upload weeks with their created_at times
        pipeline = [
            {"$match": {"type": "services_trend", "category": "q1_snapshot"}},
            {
                "$group": {
                    "_id": "$upload_week",
                    "created_at": {"$max": "$created_at"},
                    "count": {"$sum": 1},
                    "fiscal_years": {"$addToSet": "$fiscal_year"},
                    "regions": {"$addToSet": "$region"}
                }
            },
            {"$sort": {"created_at": -1}}
        ]
        
        results = await collection.aggregate(pipeline).to_list(length=None)
        
        return {
            "total_uploads": len(results),
            "uploads": [
                {
                    "upload_week": doc["_id"],
                    "created_at": doc["created_at"],
                    "document_count": doc["count"],
                    "fiscal_years": doc["fiscal_years"],
                    "regions": doc["regions"]
                }
                for doc in results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Debug query failed: {str(e)}")


@router.get("/slides/order-backlog")
async def get_order_backlog_data(region: str = "Overall", services: bool = False):
    """
    Get computed data for the Order Backlog slide.
    Pass ?region=Overall or specific region names to filter.
    Pass ?services=true to filter by OPP_Type='Service' (Services-only backlog).
    """
    try:
        opp_type_filter = "Service" if services else None
        result = await compute_order_backlog_data(db, region, opp_type_filter=opp_type_filter)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute order backlog data: {str(e)}")


@router.get("/slides/overall-gross-margin")
async def get_overall_gross_margin_data():
    """
    Get computed data for the Overall Gross Margin slide.
    """
    try:
        result = await compute_overall_gross_margin_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute overall gross margin data: {str(e)}")


@router.get("/slides/overall-gross-margin-region-summary")
async def get_overall_gross_margin_region_summary_data():
    """
    Get computed data for the Overall - Gross Margin Summary - Region slide.
    """
    try:
        result = await compute_overall_gross_margin_region_summary_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute overall gross margin region summary data: {str(e)}")


@router.get("/slides/region-manufacturing-gross-margin")
async def get_region_manufacturing_gm_data(region: str):
    """
    Get computed data for a region-specific Manufacturing Gross Margin slide.
    """
    try:
        result = await compute_region_manufacturing_gm_data(db, region)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute manufacturing gross margin data for {region}: {str(e)}")


@router.get("/slides/region-services-gross-margin")
async def get_region_services_gm_data(region: str):
    """
    Get computed data for a region-specific Services Gross Margin slide.
    """
    try:
        result = await compute_region_services_gm_data(db, region)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute services gross margin data for {region}: {str(e)}")


@router.get("/slides/region-services-cy-gross-margin")
async def get_region_services_cy_gm_data(region: str):
    """
    Get computed data for a region-specific Services Current Year Gross Margin slide.
    """
    try:
        result = await compute_region_services_cy_gm_data(db, region)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute services current year gross margin data for {region}: {str(e)}")


# ====================================================================
# MANUAL SLIDE INPUTS (Pipeline to PO, Pushout, etc.)
# ====================================================================

class SlideInputEntry(BaseModel):
    slide_id: Optional[str] = None
    slide_no: Optional[int] = None
    table_name: str  # e.g. "pipeline_to_po" or "pushout"
    freeform_text: str
    row_index: Optional[int] = None
    week_recorded: Optional[int] = None # Week when this data was entered
    region: Optional[str] = None
    service_type: Optional[str] = "ALL"

SLIDE_REGION_MAP = {
    5: "Overall",
    9: "US West",
    12: "Europe",
    15: "US East",
    18: "ASEAN",
    21: "Japan",
    24: "KANZ",
    27: "Management",
    30: "APAC",
}

@router.get("/slide-inputs/{slide_identifier}")
async def get_slide_inputs(slide_identifier: str, table_name: Optional[str] = None):
    """
    Get all manual inputs for a specific slide with cross-slide region and service propagation.
    slide_identifier can be an integer (old slide_no) or string (new slide_id).
    Optionally filter by table_name.
    """
    try:
        coll = get_collection("weekly_tracker_user_input")
        
        target_slide_no = None
        target_slide_id = slide_identifier
        target_region = None
        is_services = False

        try:
            s_no = int(slide_identifier)
            target_slide_no = s_no
            if s_no in SLIDE_REGION_MAP:
                target_region = SLIDE_REGION_MAP[s_no]
            elif s_no > 1000:
                parent_no = s_no // 1000
                is_services = True
                if parent_no in SLIDE_REGION_MAP:
                    target_region = SLIDE_REGION_MAP[parent_no]
        except ValueError:
            target_slide_id = slide_identifier
            if "_services" in slide_identifier:
                is_services = True
                try:
                    p_no = int(slide_identifier.split("_")[0])
                    if p_no in SLIDE_REGION_MAP:
                        target_region = SLIDE_REGION_MAP[p_no]
                except ValueError:
                    pass

        or_conditions = []

        # 1. Direct match on slide_no or slide_id
        if target_slide_no is not None:
            or_conditions.append({"slide_no": target_slide_no})
        if target_slide_id:
            or_conditions.append({"slide_id": target_slide_id})

        # 2. Cross-slide propagation logic:
        # If this is a Region slide (e.g. US West slide 9):
        if target_region and target_region != "Overall" and not is_services:
            or_conditions.append({"region": target_region})

        # If this is Overall Services slide (5001 or 5_services):
        if is_services and (target_region == "Overall" or target_slide_no == 5001):
            or_conditions.append({"service_type": "Services"})

        # If this is Region Services slide (e.g. 9001 / US West Services):
        if is_services and target_region and target_region != "Overall":
            or_conditions.append({"region": target_region, "service_type": "Services"})

        query = {"$or": or_conditions} if or_conditions else {}

        if table_name:
            if "$or" in query:
                query = {"$and": [query, {"table_name": table_name}]}
            else:
                query["table_name"] = table_name

        cursor = coll.find(query).sort("row_index", 1)
        entries = []
        seen_ids = set()
        async for doc in cursor:
            doc_id = str(doc["_id"])
            if doc_id not in seen_ids:
                seen_ids.add(doc_id)
                doc["id"] = doc_id
                del doc["_id"]
                entries.append(doc)
        return entries
    except Exception as e:
        print(f"Error fetching slide inputs: {e}")
        return []

@router.post("/slide-inputs")
async def add_slide_input(entry: SlideInputEntry):
    """
    Add a new manual input row for a slide.
    """
    try:
        coll = get_collection("weekly_tracker_user_input")
        entry_dict = entry.dict()
        entry_dict["date_updated"] = datetime.now()
        
        # Calculate current week if not provided
        if entry_dict.get("week_recorded") is None:
            entry_dict["week_recorded"] = datetime.now().isocalendar()[1]
        
        # Auto-assign row_index if not provided
        if entry_dict.get("row_index") is None:
            query = {"table_name": entry.table_name}
            if entry.slide_id:
                query["slide_id"] = entry.slide_id
            elif entry.slide_no is not None:
                query["slide_no"] = entry.slide_no
            else:
                query["slide_id"] = "unknown"

            last = await coll.find_one(
                query,
                sort=[("row_index", -1)]
            )
            if last:
                last_idx = last.get("row_index")
                entry_dict["row_index"] = (last_idx if last_idx is not None else 0) + 1
            else:
                entry_dict["row_index"] = 0
        
        result = await coll.insert_one(entry_dict)
        entry_dict["id"] = str(result.inserted_id)
        if "_id" in entry_dict:
            del entry_dict["_id"]
        return entry_dict
    except Exception as e:
        print(f"Error adding slide input: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/slide-inputs/{input_id}")
async def update_slide_input(input_id: str, entry: SlideInputEntry):
    """
    Update an existing manual input row.
    """
    from bson import ObjectId
    try:
        coll = get_collection("weekly_tracker_user_input")
        update_dict = entry.dict()
        update_dict["date_updated"] = datetime.now()
        
        if update_dict.get("week_recorded") is None:
             update_dict["week_recorded"] = datetime.now().isocalendar()[1]
             
        result = await coll.update_one(
            {"_id": ObjectId(input_id)},
            {"$set": update_dict}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Input not found")
        return {"status": "success", "message": "Input updated"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error updating slide input: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/slide-inputs/{input_id}")
async def delete_slide_input(input_id: str):
    """
    Delete a manual input row.
    """
    from bson import ObjectId
    try:
        coll = get_collection("weekly_tracker_user_input")
        result = await coll.delete_one({"_id": ObjectId(input_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Input not found")
        return {"status": "success", "message": "Input deleted"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error deleting slide input: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Hidden Slides API ---
@router.get("/hidden-slides")
async def get_hidden_slides():
    try:
        coll = get_collection("weekly_tracker_settings")
        doc = await coll.find_one({"type": "hidden_slides"})
        # Return list of strings
        return {"hidden_slides": doc.get("slides", []) if doc else []}
    except Exception as e:
        print(f"Error fetching hidden slides: {e}")
        return {"hidden_slides": []}

@router.post("/hidden-slides/toggle")
async def toggle_hidden_slide(payload: dict = Body(...)):
    # payload: {"slide_id": "9.1"} (string or int)
    slide_id = payload.get("slide_id")
    if slide_id is None:
        raise HTTPException(status_code=400, detail="Missing slide_id")
    
    # Ensure consistency (store as strings)
    s_id_str = str(slide_id)
    
    try:
        coll = get_collection("weekly_tracker_settings")
        doc = await coll.find_one({"type": "hidden_slides"})
        
        if not doc:
            # Create new
            await coll.insert_one({"type": "hidden_slides", "slides": [s_id_str]})
            return {"current_hidden": [s_id_str], "status": "hidden"}
        else:
            current_slides = set(doc.get("slides", []))
            if s_id_str in current_slides:
                current_slides.remove(s_id_str)
                status = "visible"
            else:
                current_slides.add(s_id_str)
                status = "hidden"
                
            await coll.update_one(
                {"type": "hidden_slides"},
                {"$set": {"slides": list(current_slides)}}
            )
            return {"current_hidden": list(current_slides), "status": status}
    except Exception as e:
        print(f"Error toggling hidden slide: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Confetti Slides API ---
@router.get("/confetti-slides")
async def get_confetti_slides():
    try:
        coll = get_collection("weekly_tracker_settings")
        doc = await coll.find_one({"type": "confetti_slides"})
        return {"confetti_slides": doc.get("slides", []) if doc else []}
    except Exception as e:
        print(f"Error fetching confetti slides: {e}")
        return {"confetti_slides": []}

@router.post("/confetti-slides/toggle")
async def toggle_confetti_slide(payload: dict = Body(...)):
    slide_id = payload.get("slide_id")
    if slide_id is None:
        raise HTTPException(status_code=400, detail="Missing slide_id")
    
    s_id_str = str(slide_id)
    
    try:
        coll = get_collection("weekly_tracker_settings")
        doc = await coll.find_one({"type": "confetti_slides"})
        
        if not doc:
            await coll.insert_one({"type": "confetti_slides", "slides": [s_id_str]})
            return {"current_confetti": [s_id_str], "status": "enabled"}
        else:
            current_slides = set(doc.get("slides", []))
            if s_id_str in current_slides:
                current_slides.remove(s_id_str)
                status = "disabled"
            else:
                current_slides.add(s_id_str)
                status = "enabled"
                
            await coll.update_one(
                {"type": "confetti_slides"},
                {"$set": {"slides": list(current_slides)}}
            )
            return {"current_confetti": list(current_slides), "status": status}
    except Exception as e:
        print(f"Error toggling confetti slide: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/slide-gifs")
async def get_slide_gifs():
    try:
        coll = get_collection("weekly_tracker_slide_gifs")
        cursor = coll.find({})
        docs = await cursor.to_list(length=1000)

        slides = {}
        for doc in docs:
            slide_id = str(doc.get("slide_id"))
            if not slide_id:
                continue

            slides[slide_id] = {
                "enabled": bool(doc.get("enabled", False)),
                "url": doc.get("url") or DEFAULT_CUSTOM_SLIDE_GIF_URL,
                "position": normalize_gif_position(doc.get("position")),
            }

        return {"slides": slides}
    except Exception as e:
        print(f"Error fetching slide GIFs: {e}")
        return {"slides": {}}


@router.put("/slide-gifs/{slide_id}")
async def update_slide_gif(slide_id: str, payload: dict = Body(...)):
    try:
        coll = get_collection("weekly_tracker_slide_gifs")
        update_data = {
            "slide_id": slide_id,
            "updated_at": datetime.now(),
        }

        if "enabled" in payload:
            update_data["enabled"] = bool(payload["enabled"])
        if "url" in payload:
            update_data["url"] = payload["url"] or DEFAULT_CUSTOM_SLIDE_GIF_URL
        if "position" in payload and isinstance(payload["position"], dict):
            update_data["position"] = normalize_gif_position(payload["position"])

        if len(update_data) == 2:
            return {"status": "no_change"}

        await coll.update_one(
            {"slide_id": slide_id},
            {"$set": update_data},
            upsert=True,
        )
        return {"status": "success"}
    except Exception as e:
        print(f"Error updating slide GIF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Slide Extras (text + image overlays) API ---

def _normalize_text_overlay(raw: dict) -> dict:
    if not isinstance(raw, dict):
        return None
    oid = str(raw.get("id") or "").strip()
    if not oid:
        return None
    align = raw.get("align", "left")
    if align not in ("left", "center", "right"):
        align = "left"
    return {
        "id": oid,
        "x": float(raw.get("x", 20)),
        "y": float(raw.get("y", 40)),
        "width": float(raw.get("width", 30)),
        "fontSize": float(raw.get("fontSize", 28)),
        "text": str(raw.get("text", "")),
        "fontFamily": str(raw.get("fontFamily", "Inter")),
        "bold": bool(raw.get("bold", False)),
        "italic": bool(raw.get("italic", False)),
        "underline": bool(raw.get("underline", False)),
        "color": str(raw.get("color", "#0f172a")),
        "backgroundColor": str(raw.get("backgroundColor", "")),
        "align": align,
    }


def _normalize_image_overlay(raw: dict) -> dict:
    if not isinstance(raw, dict):
        return None
    oid = str(raw.get("id") or "").strip()
    data_url = str(raw.get("dataUrl") or "")
    if not oid or not data_url:
        return None
    return {
        "id": oid,
        "x": float(raw.get("x", 25)),
        "y": float(raw.get("y", 25)),
        "width": float(raw.get("width", 25)),
        "dataUrl": data_url,
    }


def _normalize_slide_extras(payload: dict) -> dict:
    payload = payload or {}
    text_list = payload.get("textOverlays") or []
    image_list = payload.get("imageOverlays") or []

    texts = []
    if isinstance(text_list, list):
        for item in text_list:
            norm = _normalize_text_overlay(item)
            if norm:
                texts.append(norm)

    images = []
    if isinstance(image_list, list):
        for item in image_list:
            norm = _normalize_image_overlay(item)
            if norm:
                images.append(norm)

    return {"textOverlays": texts, "imageOverlays": images}


@router.get("/slide-extras")
async def get_slide_extras():
    try:
        coll = get_collection("weekly_tracker_slide_extras")
        cursor = coll.find({})
        docs = await cursor.to_list(length=2000)

        slides = {}
        for doc in docs:
            slide_id = str(doc.get("slide_id") or "")
            if not slide_id:
                continue
            slides[slide_id] = _normalize_slide_extras({
                "textOverlays": doc.get("textOverlays", []),
                "imageOverlays": doc.get("imageOverlays", []),
            })
        return {"slides": slides}
    except Exception as e:
        print(f"Error fetching slide extras: {e}")
        return {"slides": {}}


@router.put("/slide-extras/{slide_id}")
async def update_slide_extras(slide_id: str, payload: dict = Body(...)):
    try:
        coll = get_collection("weekly_tracker_slide_extras")
        normalized = _normalize_slide_extras(payload)

        update_data = {
            "slide_id": slide_id,
            "textOverlays": normalized["textOverlays"],
            "imageOverlays": normalized["imageOverlays"],
            "updated_at": datetime.now(),
        }

        await coll.update_one(
            {"slide_id": slide_id},
            {"$set": update_data},
            upsert=True,
        )
        return {"status": "success", "extras": normalized}
    except Exception as e:
        print(f"Error updating slide extras: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/slide-extras/{slide_id}")
async def delete_slide_extras(slide_id: str):
    try:
        coll = get_collection("weekly_tracker_slide_extras")
        await coll.delete_one({"slide_id": slide_id})
        return {"status": "success"}
    except Exception as e:
        print(f"Error deleting slide extras: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Slide Image API ---
from fastapi.responses import Response

@router.post("/slides/upload-image")
async def upload_slide_image(
    slide_id: str = Form(...),
    week: int = Form(...),
    file: UploadFile = File(...)
):
    try:
        content = await file.read()
        # Limit size? 10MB
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(400, "File too large (max 10MB)")
            
        coll = get_collection("weekly_tracker_images")
        
        # Upsert for that slide/week
        await coll.update_one(
            {"slide_id": slide_id, "week": week},
            {"$set": {
                "image_data": content,
                "content_type": file.content_type,
                "filename": file.filename,
                "uploaded_at": datetime.now()
            }},
            upsert=True
        )
        return {"status": "success", "message": "Image uploaded"}
    except Exception as e:
        print(f"Error uploading image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/slides/image/{slide_id}/{week}")
async def get_slide_image(slide_id: str, week: int):
    try:
        coll = get_collection("weekly_tracker_images")
        doc = await coll.find_one({"slide_id": slide_id, "week": week})
        
        if not doc:
            raise HTTPException(status_code=404, detail="Image not found")
            
        return Response(content=doc["image_data"], media_type=doc["content_type"])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Custom Slides API ---
@router.get("/custom-slides")
async def get_custom_slides():
    try:
        coll = get_collection("weekly_tracker_custom_slides")
        images_coll = get_collection("weekly_tracker_images")
        
        # Purge custom slides created prior to current week's Monday 00:00:00 (Sunday 23:59:59 cutoff)
        now = datetime.now()
        monday_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        
        cursor = coll.find({})
        all_slides = await cursor.to_list(length=1000)
        
        expired_ids = []
        valid_slides = []
        for s in all_slides:
            created_at = s.get("created_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at)
                except Exception:
                    created_at = None
            
            if created_at is None or not isinstance(created_at, datetime) or created_at < monday_start:
                expired_ids.append(s["_id"])
            else:
                valid_slides.append(s)

        if expired_ids:
            await coll.delete_many({"_id": {"$in": expired_ids}})
            str_ids = [str(_id) for _id in expired_ids]
            await images_coll.delete_many({"slide_id": {"$in": str_ids}})

        result = []
        for s in valid_slides:
            s["id"] = str(s["_id"])
            del s["_id"]
            if "created_at" in s:
                s["created_at"] = str(s["created_at"])
            s["gifEnabled"] = bool(s.get("gifEnabled", False))
            s["gifUrl"] = s.get("gifUrl") or DEFAULT_CUSTOM_SLIDE_GIF_URL
            s["gifPosition"] = normalize_gif_position(s.get("gifPosition"))
            result.append(s)
        return {"slides": result}
    except Exception as e:
        print(f"Error fetching custom: {e}")
        return {"slides": []}

@router.post("/custom-slides")
async def add_custom_slide(payload: dict = Body(...)):
    try:
        coll = get_collection("weekly_tracker_custom_slides")
        new_slide = {
            "parentId": payload.get("parentId"),
            "type": payload.get("type", "image"),
            "title": payload.get("title", "Custom Image"),
            "gifEnabled": bool(payload.get("gifEnabled", False)),
            "gifUrl": payload.get("gifUrl") or DEFAULT_CUSTOM_SLIDE_GIF_URL,
            "gifPosition": normalize_gif_position(payload.get("gifPosition")),
            "created_at": datetime.now()
        }
        res = await coll.insert_one(new_slide)
        
        # Construct response manually to avoid _id ObjectId issue
        response_slide = {
            "id": str(res.inserted_id),
            "parentId": new_slide["parentId"],
            "type": new_slide["type"],
            "title": new_slide["title"],
            "gifEnabled": new_slide["gifEnabled"],
            "gifUrl": new_slide["gifUrl"],
            "gifPosition": new_slide["gifPosition"],
            "created_at": str(new_slide["created_at"])
        }
        
        return {
            "status": "success", 
            "slide": response_slide
        }
    except Exception as e:
        print(f"Error adding custom slide: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/custom-slides/{slide_id}")
async def delete_custom_slide(slide_id: str):
    try:
        from bson import ObjectId
        coll = get_collection("weekly_tracker_custom_slides")
        res = await coll.delete_one({"_id": ObjectId(slide_id)})
        return {"status": "success"}
    except Exception as e:
        print(f"Error deleting custom slide: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/custom-slides/{slide_id}")
async def update_custom_slide(slide_id: str, payload: dict = Body(...)):
    try:
        from bson import ObjectId
        coll = get_collection("weekly_tracker_custom_slides")
        
        update_data = {}
        if "title" in payload:
            update_data["title"] = payload["title"]
        if "gifEnabled" in payload:
            update_data["gifEnabled"] = bool(payload["gifEnabled"])
        if "gifUrl" in payload:
            update_data["gifUrl"] = payload["gifUrl"] or DEFAULT_CUSTOM_SLIDE_GIF_URL
        if "gifPosition" in payload and isinstance(payload["gifPosition"], dict):
            update_data["gifPosition"] = normalize_gif_position(payload["gifPosition"])
        
        if not update_data:
            return {"status": "no_change"}

        await coll.update_one(
            {"_id": ObjectId(slide_id)}, 
            {"$set": update_data}
        )
        return {"status": "success"}
    except Exception as e:
        print(f"Error updating custom slide: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- WHALE ACCOUNTS API ---
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class WhaleAccountEntry(BaseModel):
    account_name: str
    date_updated: str
    week_updated: int
    text_data: str
    region: Optional[str] = None
    is_old_data: Optional[bool] = False

@router.get("/whale-accounts/names")
async def get_whale_account_names(region: Optional[str] = None):
    try:
        coll = get_collection("whale_accounts")
        query = {}
        if region:
            query["region"] = region
        names = await coll.distinct("account_name", query)
        return [n for n in names if n]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/whale-accounts/{account_name}")
async def get_whale_account_entries(account_name: str):
    try:
        coll = get_collection("whale_accounts")
        cursor = coll.find({"account_name": account_name}).sort("date_updated", -1)
        entries = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "variants" not in doc:
                log_dt = doc.get("updated_at") or doc.get("created_at") or datetime.utcnow()
                log_str = log_dt.isoformat() + "Z" if isinstance(log_dt, datetime) else str(log_dt)
                doc["variants"] = [{
                    "version": "V1",
                    "text_data": doc.get("text_data", ""),
                    "log_date": log_str
                }]
            entries.append(doc)
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/whale-accounts/{account_name}")
async def save_whale_account_entry(account_name: str, payload: WhaleAccountEntry):
    try:
        coll = get_collection("whale_accounts")
        doc = await coll.find_one({
            "account_name": account_name,
            "date_updated": payload.date_updated
        })
        
        now = datetime.utcnow()
        new_variant = {
            "text_data": payload.text_data,
            "log_date": now.isoformat() + "Z"
        }
        
        if doc:
            variants = doc.get("variants", [])
            if not variants:
                log_dt = doc.get("updated_at") or doc.get("created_at") or now
                log_str = log_dt.isoformat() + "Z" if isinstance(log_dt, datetime) else str(log_dt)
                variants = [{
                    "version": "V1",
                    "text_data": doc.get("text_data", ""),
                    "log_date": log_str
                }]
                
            if len(variants) >= 3:
                raise HTTPException(status_code=400, detail="Maximum of 3 variants reached for this date.")
            
            new_version = f"V{len(variants) + 1}"
            new_variant["version"] = new_version
            
            await coll.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "week_updated": payload.week_updated,
                        "updated_at": now,
                        "region": payload.region,
                        "is_old_data": payload.is_old_data
                    },
                    "$push": {
                        "variants": new_variant
                    }
                }
            )
        else:
            new_variant["version"] = "V1"
            await coll.insert_one({
                "account_name": account_name,
                "date_updated": payload.date_updated,
                "week_updated": payload.week_updated,
                "created_at": now,
                "updated_at": now,
                "region": payload.region,
                "is_old_data": payload.is_old_data,
                "variants": [new_variant]
            })
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/whale-accounts/stats/{region}/{week}")
async def get_whale_account_stats(region: str, week: int):
    try:
        coll = get_collection("whale_accounts")
        pipeline = [
            {"$match": {"region": region, "week_updated": week}},
            {"$group": {"_id": "$account_name"}}
        ]
        cursor = coll.aggregate(pipeline)
        names = []
        async for doc in cursor:
            names.append(doc["_id"])
        return {"count": len(names), "names": names}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SymbTrackerBulkCreate(BaseModel):
    variant: str
    event_type: str
    start_date: str
    end_date: str
    upd: int

class SymbTrackerUpdateRow(BaseModel):
    plan_date: Optional[str] = None
    input_qty: Optional[int] = None
    planned_qty: Optional[int] = None
    acc_work_qty: Optional[int] = None
    completed: Optional[int] = None

class SymbTrackerDeletePayload(BaseModel):
    admin_id: str
    admin_password: str
    record_ids: List[str]

@router.get("/symb-updated-tracker")
async def get_symb_updated_tracker():
    try:
        coll = get_collection("SYMB_Updated_progress_tracker")
        # Clean up any legacy soft-deleted documents
        await coll.delete_many({"status": "deleted"})
        cursor = coll.find().sort([("variant", 1), ("event_type", 1), ("plan_date", 1)])
        records = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            records.append(doc)
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/symb-updated-tracker/delete-bulk")
async def delete_bulk_symb_updated_tracker(payload: SymbTrackerDeletePayload):
    from bson.objectid import ObjectId
    from routers.auth import _verify_password
    
    try:
        auth_coll = get_collection("admin_users")
        user = await auth_coll.find_one({"username": payload.admin_id})
        if not user:
            user = await auth_coll.find_one({"username": {"$regex": f"^{payload.admin_id}$", "$options": "i"}})
            
        if not user or not _verify_password(payload.admin_password, user.get("salt", ""), user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Invalid Admin ID or Password")
            
        coll = get_collection("SYMB_Updated_progress_tracker")
        obj_ids = []
        for r_id in payload.record_ids:
            try:
                obj_ids.append(ObjectId(r_id))
            except Exception:
                pass
                
        deleted_count = 0
        if obj_ids:
            res = await coll.delete_many({"_id": {"$in": obj_ids}})
            deleted_count = res.deleted_count
            return {"status": "no_change"}

        await coll.update_one(
            {"_id": ObjectId(slide_id)}, 
            {"$set": update_data}
        )
        return {"status": "success"}
    except Exception as e:
        print(f"Error updating custom slide: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- WHALE ACCOUNTS API ---
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class WhaleAccountEntry(BaseModel):
    account_name: str
    date_updated: str
    week_updated: int
    text_data: str
    region: Optional[str] = None
    is_old_data: Optional[bool] = False

@router.get("/whale-accounts/names")
async def get_whale_account_names(region: Optional[str] = None):
    try:
        coll = get_collection("whale_accounts")
        query = {}
        if region:
            query["region"] = region
        names = await coll.distinct("account_name", query)
        return [n for n in names if n]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/whale-accounts/{account_name}")
async def get_whale_account_entries(account_name: str):
    try:
        coll = get_collection("whale_accounts")
        cursor = coll.find({"account_name": account_name}).sort("date_updated", -1)
        entries = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "variants" not in doc:
                log_dt = doc.get("updated_at") or doc.get("created_at") or datetime.utcnow()
                log_str = log_dt.isoformat() + "Z" if isinstance(log_dt, datetime) else str(log_dt)
                doc["variants"] = [{
                    "version": "V1",
                    "text_data": doc.get("text_data", ""),
                    "log_date": log_str
                }]
            entries.append(doc)
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/whale-accounts/{account_name}")
async def save_whale_account_entry(account_name: str, payload: WhaleAccountEntry):
    try:
        coll = get_collection("whale_accounts")
        doc = await coll.find_one({
            "account_name": account_name,
            "date_updated": payload.date_updated
        })
        
        now = datetime.utcnow()
        new_variant = {
            "text_data": payload.text_data,
            "log_date": now.isoformat() + "Z"
        }
        
        if doc:
            variants = doc.get("variants", [])
            if not variants:
                log_dt = doc.get("updated_at") or doc.get("created_at") or now
                log_str = log_dt.isoformat() + "Z" if isinstance(log_dt, datetime) else str(log_dt)
                variants = [{
                    "version": "V1",
                    "text_data": doc.get("text_data", ""),
                    "log_date": log_str
                }]
                
            if len(variants) >= 3:
                raise HTTPException(status_code=400, detail="Maximum of 3 variants reached for this date.")
            
            new_version = f"V{len(variants) + 1}"
            new_variant["version"] = new_version
            
            await coll.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "week_updated": payload.week_updated,
                        "updated_at": now,
                        "region": payload.region,
                        "is_old_data": payload.is_old_data
                    },
                    "$push": {
                        "variants": new_variant
                    }
                }
            )
        else:
            new_variant["version"] = "V1"
            await coll.insert_one({
                "account_name": account_name,
                "date_updated": payload.date_updated,
                "week_updated": payload.week_updated,
                "created_at": now,
                "updated_at": now,
                "region": payload.region,
                "is_old_data": payload.is_old_data,
                "variants": [new_variant]
            })
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/whale-accounts/stats/{region}/{week}")
async def get_whale_account_stats(region: str, week: int):
    try:
        coll = get_collection("whale_accounts")
        pipeline = [
            {"$match": {"region": region, "week_updated": week}},
            {"$group": {"_id": "$account_name"}}
        ]
        cursor = coll.aggregate(pipeline)
        names = []
        async for doc in cursor:
            names.append(doc["_id"])
        return {"count": len(names), "names": names}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SymbTrackerBulkCreate(BaseModel):
    variant: str
    event_type: str
    start_date: str
    end_date: str
    upd: int
    input_qty: Optional[int] = None

class SymbDataUpdatePayload(BaseModel):
    variant: str
    event_type: str
    update_date: str
    completed_qty: int

class SymbTrackerUpdateRow(BaseModel):
    plan_date: Optional[str] = None
    input_qty: Optional[int] = None
    planned_qty: Optional[int] = None
    acc_work_qty: Optional[int] = None
    completed: Optional[int] = None

class SymbTrackerDeletePayload(BaseModel):
    admin_id: str
    admin_password: str
    record_ids: List[str]

@router.get("/symb-updated-tracker")
async def get_symb_updated_tracker():
    try:
        coll = get_collection("SYMB_Updated_progress_tracker")
        # Clean up any legacy soft-deleted documents
        await coll.delete_many({"status": "deleted"})
        cursor = coll.find().sort([("variant", 1), ("event_type", 1), ("plan_date", 1)])
        records = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            records.append(doc)
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def check_symb_time_lock(user: Optional[dict] = None):
    if user and user.get("role") == "Admin":
        return True

    from datetime import datetime
    import re

    start_time_str = "00:00"
    end_time_str = "14:00"

    try:
        coll = get_collection("system_settings")
        doc = await coll.find_one({"_id": "data_update_lock"})
        if doc:
            if doc.get("unlocked_until"):
                unlocked_until = doc["unlocked_until"]
                unlocked_until_dt = None
                if isinstance(unlocked_until, str):
                    try:
                        unlocked_until_dt = datetime.fromisoformat(unlocked_until.rstrip("Z"))
                    except Exception:
                        unlocked_until_dt = None
                elif isinstance(unlocked_until, datetime):
                    unlocked_until_dt = unlocked_until
                    
                if unlocked_until_dt:
                    unlocked_until_dt = unlocked_until_dt.replace(tzinfo=None)
                    now_utc = datetime.utcnow()
                    if now_utc < unlocked_until_dt:
                        # Temporary 10-minute override is ACTIVE
                        return True
            
            if doc.get("start_time") and re.match(r"^([01]\d|2[0-3]):([0-5]\d)$", str(doc["start_time"]).strip()):
                start_time_str = str(doc["start_time"]).strip()
            if doc.get("end_time") and re.match(r"^([01]\d|2[0-3]):([0-5]\d)$", str(doc["end_time"]).strip()):
                end_time_str = str(doc["end_time"]).strip()
    except Exception as e:
        print(f"Error checking data lock settings: {e}")

    sh, sm = map(int, start_time_str.split(":"))
    eh, em = map(int, end_time_str.split(":"))

    start_sec = sh * 3600 + sm * 60
    end_sec = eh * 3600 + em * 60 + 59

    now = datetime.now()
    current_sec = now.hour * 3600 + now.minute * 60 + now.second

    if start_sec <= end_sec:
        is_allowed = (start_sec <= current_sec <= end_sec)
    else:
        is_allowed = (current_sec >= start_sec or current_sec <= end_sec)

    if not is_allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Data update is locked for today. Editing is permitted between {start_time_str} and {end_time_str} only (or when temporarily unlocked by Admin)."
        )

@router.post("/symb-updated-tracker/delete-bulk")
async def delete_bulk_symb_updated_tracker(payload: SymbTrackerDeletePayload, authorization: Optional[str] = Header(None)):
    from bson.objectid import ObjectId
    from routers.auth import _verify_password, get_optional_current_user
    
    user_sess = await get_optional_current_user(authorization)
    if not user_sess and payload.admin_id:
        user_sess = {"username": payload.admin_id, "role": "Admin"}
    await check_symb_time_lock(user_sess)
    try:
        auth_coll = get_collection("admin_users")
        user = await auth_coll.find_one({"username": payload.admin_id})
        if not user:
            user = await auth_coll.find_one({"username": {"$regex": f"^{payload.admin_id}$", "$options": "i"}})
            
        if not user or not _verify_password(payload.admin_password, user.get("salt", ""), user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Invalid Admin ID or Password")
            
        coll = get_collection("SYMB_Updated_progress_tracker")
        obj_ids = []
        for r_id in payload.record_ids:
            try:
                obj_ids.append(ObjectId(r_id))
            except Exception:
                pass
                
        deleted_count = 0
        if obj_ids:
            res = await coll.delete_many({"_id": {"$in": obj_ids}})
            deleted_count = res.deleted_count
            
        try:
            from SYMB_plan_transformation import run_symb_plan_pipeline
            await run_symb_plan_pipeline(db)
        except Exception as pe:
            print(f"Error running SYMB plan pipeline after delete: {pe}")
            
        return {"status": "success", "deleted_count": deleted_count}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/symb-updated-tracker/bulk")
async def bulk_create_symb_updated_tracker(payload: SymbTrackerBulkCreate, authorization: Optional[str] = Header(None)):
    from datetime import datetime, timedelta
    from routers.auth import get_optional_current_user
    user_sess = await get_optional_current_user(authorization)
    await check_symb_time_lock(user_sess)
    try:
        user_sess = await get_optional_current_user(authorization)
        user_email = user_sess.get("email") if user_sess else "System"
        coll = get_collection("SYMB_Updated_progress_tracker")
        start = datetime.strptime(payload.start_date, "%Y-%m-%d")
        end = datetime.strptime(payload.end_date, "%Y-%m-%d")
        
        current_date = start
        while current_date <= end:
            current_date_str = current_date.strftime("%d-%b-%Y").upper() # like 08-AUG-2026
            
            doc = await coll.find_one({
                "variant": payload.variant,
                "event_type": payload.event_type,
                "plan_date": current_date_str
            })
            
            if doc:
                if doc.get("planned_qty") != payload.upd:
                    edit_history = doc.get("edit_history", {"planned_qty": [], "completed": [], "plan_date": []})
                    pq_hist = edit_history.get("planned_qty", [])
                    pq_hist.append({
                        "old_value": doc.get("planned_qty"),
                        "new_value": payload.upd,
                        "value": doc.get("planned_qty"),
                        "edited_by": user_email,
                        "timestamp": datetime.now().isoformat(),
                        "edit": len(pq_hist) + 1
                    })
                    edit_history["planned_qty"] = pq_hist
                    
                    await coll.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"planned_qty": payload.upd, "edit_history": edit_history}}
                    )
            else:
                await coll.insert_one({
                    "variant": payload.variant,
                    "event_type": payload.event_type,
                    "plan_date": current_date_str,
                    "planned_qty": payload.upd,
                    "completed": 0,
                    "acc_comp_date": None,
                    "created_by": user_email,
                    "created_at": datetime.now().isoformat(),
                    "edit_history": {
                        "planned_qty": [],
                        "completed": [],
                        "plan_date": []
                    }
                })
                
            current_date += timedelta(days=1)
            
        try:
            from SYMB_plan_transformation import run_symb_plan_pipeline
            await run_symb_plan_pipeline(db)
        except Exception as pe:
            print(f"Error running SYMB plan pipeline after bulk create: {pe}")
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def get_stage_target_qty(variant: str, event_type: str) -> int:
    try:
        coll = get_collection("SYMB_Updated_progress_tracker")
        def is_same_v(v_val, target_v):
            vs = str(v_val or "").strip().lower()
            ts = str(target_v or "").strip().lower()
            if ts in ["1", "v1", "variant 1"]:
                return vs in ["1", "1.0", "v1"] or "variant 1" in vs or "varient 1" in vs
            if ts in ["2", "v2", "variant 2"]:
                return vs in ["2", "2.0", "v2"] or "variant 2" in vs or "varient 2" in vs
            return vs == ts

        seq_stages = [
            "PCBA Ready",
            "Materials Issued",
            "Active alignment",
            "Production/Assembly",
            "FQC",
            "Finished goods",
            "Invoice Date",
            "Shipment Date",
            "customer place"
        ]

        norm_evt = event_type
        if norm_evt == "PCBA covered": norm_evt = "PCBA Ready"

        if norm_evt not in seq_stages:
            return 999999999

        idx = seq_stages.index(norm_evt)
        all_records = await coll.find({}).to_list(10000)

        curr_planned = sum(
            r.get("planned_qty", 0) for r in all_records
            if is_same_v(r.get("variant"), variant) and (r.get("event_type") == norm_evt or (norm_evt == "PCBA Ready" and r.get("event_type") == "PCBA covered"))
        )

        if idx == 0:
            return curr_planned if curr_planned > 0 else 999999999

        prev_evt = seq_stages[idx - 1]
        prev_completed = sum(
            r.get("completed", 0) for r in all_records
            if is_same_v(r.get("variant"), variant) and (r.get("event_type") == prev_evt or (prev_evt == "PCBA Ready" and r.get("event_type") == "PCBA covered"))
        )

        target = prev_completed if prev_completed > 0 else curr_planned
        return target if target > 0 else 0
    except Exception as e:
        print(f"Error computing stage target: {e}")
        return 999999999

@router.post("/symb-updated-tracker/data-update")
async def data_update_symb_updated_tracker(payload: SymbDataUpdatePayload, authorization: Optional[str] = Header(None)):
    from datetime import datetime
    from routers.auth import get_optional_current_user
    user_sess = await get_optional_current_user(authorization)
    await check_symb_time_lock(user_sess)
    try:
        user_sess = await get_optional_current_user(authorization)
        user_email = user_sess.get("email") if user_sess else "System"
        user_role = user_sess.get("role", "User") if user_sess else "Admin"
        user_perms = user_sess.get("symb_permissions", []) if user_sess else ["ALL"]

        if user_role != "Admin" and "ALL" not in user_perms and payload.event_type not in user_perms:
            raise HTTPException(status_code=403, detail="you dont have access to it")

        target_qty = await get_stage_target_qty(payload.variant, payload.event_type)
        if target_qty > 0 and payload.completed_qty > target_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot update: Completed quantity ({payload.completed_qty:,}) cannot be higher than the available inventory ({target_qty:,})!"
            )

        coll = get_collection("SYMB_Updated_progress_tracker")
        date_obj = datetime.strptime(payload.update_date, "%Y-%m-%d")
        current_date_str = date_obj.strftime("%d-%b-%Y").upper()

        doc = await coll.find_one({
            "variant": payload.variant,
            "event_type": payload.event_type,
            "plan_date": current_date_str
        })

        if doc:
            edit_history = doc.get("edit_history", {"planned_qty": [], "completed": [], "plan_date": []})
            comp_hist = edit_history.get("completed", [])
            comp_hist.append({
                "old_value": doc.get("completed", 0),
                "new_value": payload.completed_qty,
                "value": doc.get("completed", 0),
                "edited_by": user_email,
                "timestamp": datetime.now().isoformat(),
                "edit": len(comp_hist) + 1
            })
            pq_hist = edit_history.get("planned_qty", [])
            if doc.get("planned_qty") != 0:
                pq_hist.append({
                    "old_value": doc.get("planned_qty", 0),
                    "new_value": 0,
                    "value": doc.get("planned_qty", 0),
                    "edited_by": user_email,
                    "timestamp": datetime.now().isoformat(),
                    "edit": len(pq_hist) + 1
                })
            edit_history["completed"] = comp_hist
            edit_history["planned_qty"] = pq_hist

            await coll.update_one(
                {"_id": doc["_id"]},
                {"$set": {
                    "planned_qty": 0,
                    "completed": payload.completed_qty,
                    "acc_comp_date": current_date_str,
                    "edit_history": edit_history
                }}
            )
        else:
            await coll.insert_one({
                "variant": payload.variant,
                "event_type": payload.event_type,
                "plan_date": current_date_str,
                "planned_qty": 0,
                "completed": payload.completed_qty,
                "acc_comp_date": current_date_str,
                "created_by": user_email,
                "created_at": datetime.now().isoformat(),
                "edit_history": {
                    "planned_qty": [],
                    "completed": [],
                    "plan_date": []
                }
            })

        try:
            from SYMB_plan_transformation import run_symb_plan_pipeline
            await run_symb_plan_pipeline(db)
        except Exception as pe:
            print(f"Error running SYMB plan pipeline after data update: {pe}")

        return {"status": "success", "message": "Data updated successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/symb-updated-tracker/{id}")
async def update_symb_updated_tracker(id: str, payload: SymbTrackerUpdateRow, authorization: Optional[str] = Header(None)):
    from bson.objectid import ObjectId
    from datetime import datetime
    from routers.auth import get_optional_current_user
    user_sess = await get_optional_current_user(authorization)
    await check_symb_time_lock(user_sess)
    try:
        user_sess = await get_optional_current_user(authorization)
        user_email = user_sess.get("email") if user_sess else "System"
        coll = get_collection("SYMB_Updated_progress_tracker")
        doc = await coll.find_one({"_id": ObjectId(id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Record not found")
            
        updates = {}
        edit_history = doc.get("edit_history", {"planned_qty": [], "completed": [], "plan_date": []})
        
        if payload.plan_date is not None and payload.plan_date != doc.get("plan_date"):
            hist = edit_history.get("plan_date", [])
            hist.append({
                "old_value": doc.get("plan_date"),
                "new_value": payload.plan_date,
                "value": doc.get("plan_date"),
                "edited_by": user_email,
                "timestamp": datetime.now().isoformat(),
                "edit": len(hist) + 1
            })
            edit_history["plan_date"] = hist
            updates["plan_date"] = payload.plan_date
            
        if payload.planned_qty is not None and payload.planned_qty != doc.get("planned_qty"):
            hist = edit_history.get("planned_qty", [])
            hist.append({
                "old_value": doc.get("planned_qty"),
                "new_value": payload.planned_qty,
                "value": doc.get("planned_qty"),
                "edited_by": user_email,
                "timestamp": datetime.now().isoformat(),
                "edit": len(hist) + 1
            })
            edit_history["planned_qty"] = hist
            updates["planned_qty"] = payload.planned_qty
            
        if payload.input_qty is not None and payload.input_qty != doc.get("input_qty"):
            target_qty = await get_stage_target_qty(doc.get("variant"), doc.get("event_type"))
            if target_qty > 0 and payload.input_qty > target_qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot update: Input quantity ({payload.input_qty:,}) cannot be higher than the available inventory ({target_qty:,})!"
                )
            updates["input_qty"] = payload.input_qty

        if payload.acc_work_qty is not None and payload.acc_work_qty != doc.get("acc_work_qty"):
            hist = edit_history.get("acc_work_qty", [])
            hist.append({
                "old_value": doc.get("acc_work_qty"),
                "new_value": payload.acc_work_qty,
                "value": doc.get("acc_work_qty"),
                "edited_by": user_email,
                "timestamp": datetime.now().isoformat(),
                "edit": len(hist) + 1
            })
            edit_history["acc_work_qty"] = hist
            updates["acc_work_qty"] = payload.acc_work_qty

        if payload.completed is not None and payload.completed != doc.get("completed"):
            target_qty = await get_stage_target_qty(doc.get("variant"), doc.get("event_type"))
            if target_qty > 0:
                all_records = await coll.find({}).to_list(10000)
                other_completed = sum(
                    r.get("completed", 0) for r in all_records
                    if str(r.get("_id")) != id and r.get("event_type") == doc.get("event_type") and str(r.get("variant")) == str(doc.get("variant"))
                )
                proposed_completed = other_completed + payload.completed
                if proposed_completed > target_qty:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot update: Total completed quantity ({proposed_completed:,}) cannot be higher than the available inventory ({target_qty:,})!"
                    )

            hist = edit_history.get("completed", [])
            hist.append({
                "old_value": doc.get("completed"),
                "new_value": payload.completed,
                "value": doc.get("completed"),
                "edited_by": user_email,
                "timestamp": datetime.now().isoformat(),
                "edit": len(hist) + 1
            })
            edit_history["completed"] = hist
            updates["completed"] = payload.completed
            updates["acc_comp_date"] = datetime.now().isoformat()
            
        if updates:
            updates["edit_history"] = edit_history
            await coll.update_one({"_id": ObjectId(id)}, {"$set": updates})

        try:
            from SYMB_plan_transformation import run_symb_plan_pipeline
            await run_symb_plan_pipeline(db)
        except Exception as pe:
            print(f"Error running SYMB plan pipeline after update: {pe}")
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
