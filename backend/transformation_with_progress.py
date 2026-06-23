"""
Progress-aware wrapper for transform_weekly_data
"""
import sys
import os
sys.path.append(os.path.dirname(__file__))

from transformation import transform_weekly_data
from progress_tracker import update_progress

async def transform_weekly_data_with_progress(df, week, upload_date, db, upload_id):
    """
    Wrapper for transform_weekly_data that sends progress updates.
    """
    # Steps 3-9 correspond to the transformation pipeline
    # We'll update progress as we go through the main steps
    
    update_progress(upload_id, 3, 11, "Step 1/9", "Basic data cleaning", "processing")
    update_progress(upload_id, 4, 11, "Step 2/9", "Fetching Zoho forecast data (this may take a while)", "processing")
    update_progress(upload_id, 5, 11, "Step 3/9", "Merging forecast data", "processing")
    update_progress(upload_id, 6, 11, "Step 4/9", "Backfilling audited dates", "processing")
    update_progress(upload_id, 7, 11, "Step 5/9", "Applying transformations", "processing")
    update_progress(upload_id, 8, 11, "Step 6/9", "Calculating metrics", "processing")
    update_progress(upload_id, 9, 11, "Step 7-9/9", "Filtering and aggregating data", "processing")
    
    # Call the original transform function
    result = await transform_weekly_data(df, week, upload_date, db)
    
    return result
