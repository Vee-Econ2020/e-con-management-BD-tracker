import sys
import os
import uuid
import json
import time
import subprocess
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter()

# Directory for storing generated PDF exports and job status files
EXPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "exports")
os.makedirs(EXPORTS_DIR, exist_ok=True)

class ExportRequest(BaseModel):
    week: Optional[int] = None
    start_slide: Optional[int] = None
    end_slide: Optional[int] = None
    regions: Optional[List[str]] = None
    frontend_url: Optional[str] = None
    fy: Optional[str] = "FY2027"


def cleanup_old_exports():
    """Remove PDF and status files older than 1 hour"""
    try:
        now = datetime.now()
        for f in os.listdir(EXPORTS_DIR):
            fp = os.path.join(EXPORTS_DIR, f)
            if os.path.isfile(fp):
                mtime = datetime.fromtimestamp(os.path.getmtime(fp))
                if now - mtime > timedelta(hours=1):
                    os.remove(fp)
    except Exception as e:
        print(f"[PDF Export Cleanup] Error cleaning exports: {e}")


def spawn_pdf_worker(job_id: str, week: Optional[int], start_slide: Optional[int], end_slide: Optional[int], frontend_url: Optional[str], regions: Optional[List[str]] = None, fy: str = "FY2027"):
    """Launch export_worker.py as an independent background process"""
    status_file = os.path.join(EXPORTS_DIR, f"{job_id}.json")
    pdf_filename = f"weekly-tracker-week-{week or 'current'}-{job_id[:8]}.pdf"
    output_pdf = os.path.join(EXPORTS_DIR, pdf_filename)

    worker_script = os.path.join(os.path.dirname(os.path.dirname(__file__)), "export_worker.py")
    python_exe = sys.executable

    regions_str = ",".join(regions) if regions else "None"

    cmd = [
        python_exe,
        worker_script,
        status_file,
        output_pdf,
        str(week) if week is not None else "None",
        str(start_slide) if start_slide is not None else "None",
        str(end_slide) if end_slide is not None else "None",
        frontend_url or "http://localhost:5173",
        regions_str,
        fy
    ]

    try:
        subprocess.Popen(cmd)
        print(f"[PDF Export] Spawned worker process for job {job_id}")
    except Exception as err:
        print(f"[PDF Export Error] Failed to spawn worker process for {job_id}: {err}")


@router.post("/export-pdf-job")
async def start_pdf_export_job(req: ExportRequest, background_tasks: BackgroundTasks):
    """Start a background PDF export job"""
    cleanup_old_exports()
    job_id = str(uuid.uuid4())
    status_file = os.path.join(EXPORTS_DIR, f"{job_id}.json")

    initial_status = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0,
        "message": "Job queued",
        "pdf_filename": None,
        "file_path": None,
        "error": None,
        "created_at": datetime.now().isoformat()
    }

    with open(status_file, "w", encoding="utf-8") as f:
        json.dump(initial_status, f)

    background_tasks.add_task(
        spawn_pdf_worker,
        job_id=job_id,
        week=req.week,
        start_slide=req.start_slide,
        end_slide=req.end_slide,
        frontend_url=req.frontend_url,
        regions=req.regions,
        fy=req.fy
    )

    return {
        "job_id": job_id,
        "status": "pending",
        "message": "PDF export job started in background"
    }


@router.get("/export-pdf-status/{job_id}")
async def get_pdf_export_status(job_id: str):
    """Get progress and status of background PDF export job with retry resilience for Windows file locks"""
    status_file = os.path.join(EXPORTS_DIR, f"{job_id}.json")
    if not os.path.exists(status_file):
        raise HTTPException(status_code=404, detail="Job not found")

    last_err = None
    for attempt in range(5):
        try:
            with open(status_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data
        except Exception as e:
            last_err = e
            time.sleep(0.1)

    print(f"[PDF Export Status Error] Could not read status file {job_id} after 5 attempts: {last_err}")
    raise HTTPException(status_code=500, detail="Error reading job status")


@router.get("/export-pdf-download/{job_id}")
async def download_pdf_export(job_id: str):
    """Download completed PDF export file"""
    status_file = os.path.join(EXPORTS_DIR, f"{job_id}.json")
    if not os.path.exists(status_file):
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        with open(status_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Error reading job status")

    if data.get("status") != "completed" or not data.get("file_path"):
        raise HTTPException(status_code=400, detail="PDF generation is not complete yet")

    file_path = data["file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Export file missing or expired")

    filename = data.get("pdf_filename", "weekly-tracker-export.pdf")
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename
    )
