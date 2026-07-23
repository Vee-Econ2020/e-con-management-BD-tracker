"""
Progress tracking for CSV uploads
Stores progress status in memory that frontend can poll
"""

from dataclasses import dataclass
from typing import Dict, Optional
from datetime import datetime

@dataclass
class ProgressStatus:
    step: int
    total_steps: int
    step_name: str
    message: str
    status: str  # 'processing', 'completed', 'error'
    error: Optional[str] = None
    timestamp: datetime = None
    start_time_str: Optional[str] = None
    est_completion_time_str: Optional[str] = None
    time_remaining_str: Optional[str] = None
    items_processed: Optional[int] = None
    items_total: Optional[int] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

# In-memory storage for progress
# Format: {upload_id: ProgressStatus}
progress_store: Dict[str, ProgressStatus] = {}

def update_progress(
    upload_id: str,
    step: int,
    total_steps: int,
    step_name: str,
    message: str,
    status: str = 'processing',
    start_time_str: Optional[str] = None,
    est_completion_time_str: Optional[str] = None,
    time_remaining_str: Optional[str] = None,
    items_processed: Optional[int] = None,
    items_total: Optional[int] = None
):
    """Update progress for an upload task"""
    progress_store[upload_id] = ProgressStatus(
        step=step,
        total_steps=total_steps,
        step_name=step_name,
        message=message,
        status=status,
        start_time_str=start_time_str,
        est_completion_time_str=est_completion_time_str,
        time_remaining_str=time_remaining_str,
        items_processed=items_processed,
        items_total=items_total
    )

def get_progress(upload_id: str) -> Optional[ProgressStatus]:
    """Get progress for an upload task"""
    return progress_store.get(upload_id)

def clear_progress(upload_id: str):
    """Clear progress after completion"""
    if upload_id in progress_store:
        del progress_store[upload_id]
