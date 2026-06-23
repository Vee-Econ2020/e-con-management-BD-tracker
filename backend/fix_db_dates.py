import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://Admin_econ:QWERTY%40319113@cluster0.3n9ln1d.mongodb.net/")
DB_NAME = os.getenv("DB_NAME", "econ_tracker")

async def fix_dates():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    # 1. Fix weekly_tracker_data
    collection_data = db["weekly_tracker_data"]
    
    # Find records where upload_date is exactly 8 characters (e.g., "03-02-20")
    # and ends with "20"
    cursor = collection_data.find({"upload_date": {"$regex": "-20$"}})
    count = 0
    async for doc in cursor:
        old_date = doc["upload_date"]
        if len(old_date) == 8:
            new_date = old_date + "26"
            await collection_data.update_one({"_id": doc["_id"]}, {"$set": {"upload_date": new_date}})
            count += 1
    
    print(f"Fixed {count} records in weekly_tracker_data")

    # 2. Fix upload_logs
    collection_logs = db["upload_logs"]
    cursor = collection_logs.find({"file_date": {"$regex": "-20$"}})
    count_logs = 0
    async for doc in cursor:
        old_date = doc["file_date"]
        if len(old_date) == 8:
            new_date = old_date + "26"
            await collection_logs.update_one({"_id": doc["_id"]}, {"$set": {"file_date": new_date}})
            count_logs += 1
            
    print(f"Fixed {count_logs} records in upload_logs")
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_dates())
