from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from routers import admin
from routers import auth as auth_router
from routers import access_management
from routers import export as export_router
from context import target_week_var

app = FastAPI(title="e-con Business Development Tracker API")

app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(auth_router.router, prefix="/api/admin/auth", tags=["auth"])
app.include_router(access_management.router, prefix="/api/access", tags=["access"])
app.include_router(export_router.router, prefix="/api/admin", tags=["export"])

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Week Context Middleware
@app.middleware("http")
async def add_week_context(request: Request, call_next):
    week_param = request.query_params.get("week")
    token = None
    if week_param and week_param.isdigit():
        token = target_week_var.set(int(week_param))
    response = await call_next(request)
    if token:
        target_week_var.reset(token)
    return response

# MongoDB Configuration
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://Admin_econ:QWERTY%40319113@cluster0.3n9ln1d.mongodb.net/")
DB_NAME = os.getenv("DB_NAME", "econ_tracker")

# MongoDB Client
client = None
db = None


@app.on_event("startup")
async def startup_db_client():
    """Initialize MongoDB connection on startup"""
    global client, db
    try:
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client[DB_NAME]
        # Test the connection
        await client.admin.command('ping')
        print(f"Connected to MongoDB Atlas - Database: {DB_NAME}")
        # Seed default admin credentials (idempotent).
        try:
            await auth_router.seed_default_admin()
        except Exception as seed_err:
            print(f"Admin seed failed: {seed_err}")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown"""
    global client
    if client:
        client.close()
        print("MongoDB connection closed")


def calculate_current_week(year: int = None) -> int:
    """
    Calculate the current ISO week number.
    Weeks run Monday-Sunday. Week 1 is the first week containing a Thursday
    (or equivalently, the week containing January 4th).
    
    Args:
        year: The year to calculate weeks for (defaults to current year)
    
    Returns:
        Current ISO week number (1-53)
    """
    now = datetime.now()
    if year is None:
        year = now.year
    
    # Use ISO calendar to get the ISO week number
    # isocalendar() returns (ISO year, ISO week, ISO weekday)
    iso_year, iso_week, iso_weekday = now.isocalendar()
    
    # If we're in the last few days of December but ISO year is next year,
    # or first few days of January but ISO year is previous year,
    # we still return the ISO week for consistency
    return iso_week


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "e-con Business Development Tracker API",
        "version": "1.0.0"
    }


@app.get("/api/week/current")
async def get_current_week():
    """
    Get the current week number.
    Returns the week number based on Jan 1 - Dec 31 of current year.
    """
    try:
        current_year = datetime.now().year
        
        # If a specific week was requested via ?week= middleware
        requested_week = target_week_var.get()
        if requested_week is not None:
            week_number = requested_week
        else:
            week_number = calculate_current_week(current_year)
        
        return {
            "week": week_number,
            "year": current_year,
            "date": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating week: {str(e)}")


@app.get("/api/health")
async def health_check():
    """Detailed health check including database connection"""
    db_status = "connected" if client else "disconnected"
    
    return {
        "status": "healthy",
        "database": db_status,
        "timestamp": datetime.now().isoformat()
    }
