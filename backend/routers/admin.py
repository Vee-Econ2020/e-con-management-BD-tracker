from fastapi import APIRouter, HTTPException, Body, File, Form, UploadFile, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import uuid
import asyncio
from dotenv import load_dotenv
from progress_tracker import update_progress, get_progress, clear_progress

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
DB_NAME = os.getenv("DB_NAME", "DB tracker")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]

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
        if type:
            query["type"] = type
        cursor = coll.find(query).sort("created_at", -1)
        logs = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            logs.append(doc)
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

        # ── Gross Margin branch ───────────────────────────────────────
        if type == "gross_margin":
            await _process_gross_margin_upload(
                upload_id, df, week, file_date, file_name, type, coll_logs, progress_update
            )
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
        
        progress_update(upload_id, 11, 11, "Complete", f"Successfully processed {len(records)} records for week {week}", "completed")
        
        # Clear progress after 10 seconds
        await asyncio.sleep(10)
        clear_progress(upload_id)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        progress_update(upload_id, 11, 11, "Error", str(e), "error")


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


@router.get("/upload-progress/{upload_id}")
async def get_upload_progress(upload_id: str):
    """
    Get progress status for an upload.
    """
    progress = get_progress(upload_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Upload ID not found or progress expired")
    
    return {
        "upload_id": upload_id,
        "step": progress.step,
        "total_steps": progress.total_steps,
        "step_name": progress.step_name,
        "message": progress.message,
        "status": progress.status,
        "error": progress.error,
        "progress_percent": int((progress.step / progress.total_steps) * 100)
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
    compute_slide_services_data,
    compute_services_q1_snapshot_data,
    compute_order_backlog_data,
    compute_overall_gross_margin_data,
    compute_overall_gross_margin_region_summary_data,
    compute_region_manufacturing_gm_data,
    compute_region_services_gm_data
)

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
async def get_services_q1_snapshot_data(region: str = "Overall"):
    """Get the latest Services Q1 weekly snapshot chart data."""
    try:
        result = await compute_services_q1_snapshot_data(db, region)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute Services Q1 snapshot data: {str(e)}")


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

@router.get("/slide-inputs/{slide_identifier}")
async def get_slide_inputs(slide_identifier: str, table_name: Optional[str] = None):
    """
    Get all manual inputs for a specific slide.
    slide_identifier can be an integer (old slide_no) or string (new slide_id).
    Optionally filter by table_name.
    """
    try:
        coll = get_collection("weekly_tracker_user_input")
        
        # Try to parse as int for backward compatibility
        try:
            s_no = int(slide_identifier)
            # Check if it's likely a slide number (e.g. < 100) or maybe the user passed "5"
            # But "9.1" will fail int conversion.
            query = {"slide_no": s_no}
        except ValueError:
            query = {"slide_id": slide_identifier}
            
        if table_name:
            query["table_name"] = table_name
            
        cursor = coll.find(query).sort("row_index", 1)
        entries = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
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
            # Simple ISO week calculation
            entry_dict["week_recorded"] = datetime.now().isocalendar()[1]
        
        # Auto-assign row_index if not provided
        if entry_dict.get("row_index") is None:
            # Construct query based on what ID is provided
            query = {"table_name": entry.table_name}
            if entry.slide_id:
                query["slide_id"] = entry.slide_id
            elif entry.slide_no is not None:
                query["slide_no"] = entry.slide_no
            else:
                # Should not happen if validation works, but good to handle
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
        
        # Update week recorded on edit as well
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
        cursor = coll.find({})
        slides = await cursor.to_list(length=1000)
        # Convert ObjectId to string
        result = []
        for s in slides:
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
