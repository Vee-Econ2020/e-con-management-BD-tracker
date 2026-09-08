import asyncio
import os
import re
from datetime import datetime
from dotenv import load_dotenv
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import UpdateOne

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "DB_tracker")

def extract_invoice_fy(doc: dict) -> str:
    """Determine the fiscal year (April-March cycle) of an invoice record."""
    fy = doc.get("fy") or doc.get("closing date Fy")
    if fy and isinstance(fy, str) and fy.strip():
        return fy.strip()
    
    date_val = doc.get("invoice_date") or doc.get("Invoice Date")
    if not date_val:
        return "FY2027"
    
    if isinstance(date_val, datetime):
        month = date_val.month
        year = date_val.year
        return f"FY{year + 1}" if month >= 4 else f"FY{year}"
    
    date_str = str(date_val).strip()
    match = re.match(r"^(\d{4})-(\d{2})", date_str)
    if match:
        year = int(match.group(1))
        month = int(match.group(2))
        return f"FY{year + 1}" if month >= 4 else f"FY{year}"
    
    try:
        dt = pd.to_datetime(date_str)
        if not pd.isna(dt):
            month = dt.month
            year = dt.year
            return f"FY{year + 1}" if month >= 4 else f"FY{year}"
    except Exception:
        pass
    
    return "FY2027"

async def backfill():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    coll = db["invoice_data"]
    
    docs = await coll.find({}).to_list(length=100000)
    print(f"Loaded {len(docs)} invoice documents.")
    
    ops = []
    updated = 0
    for d in docs:
        calc_fy = extract_invoice_fy(d)
        ops.append(UpdateOne({"_id": d["_id"]}, {"$set": {"fy": calc_fy, "closing date Fy": calc_fy}}))
        if len(ops) >= 500:
            res = await coll.bulk_write(ops)
            updated += res.modified_count
            ops = []
            
    if ops:
        res = await coll.bulk_write(ops)
        updated += res.modified_count
        
    print(f"Successfully backfilled {updated} invoice records with fy and closing date Fy.")
    
    # Verification
    fy_counts = {}
    for d in await coll.find({}).to_list(length=100000):
        f = d.get("fy", "None")
        fy_counts[f] = fy_counts.get(f, 0) + 1
    print("Verification FY counts:", fy_counts)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(backfill())
