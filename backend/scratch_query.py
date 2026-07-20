import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = "DB_tracker"

async def main():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    collection_data = db["weekly_tracker_data"]
    
    count = await collection_data.count_documents({})
    print(f"Total documents in weekly_tracker_data: {count}")
    
    pipeline = [
        {"$match": {"OPP_Type": "Service"}},
        {"$group": {
            "_id": "$week",
            "pipe_sum": {
                "$sum": {
                    "$cond": [{"$eq": ["$projection - category", "Pipeline"]}, "$Weighted Amount", 0]
                }
            },
            "po_sum": {
                "$sum": {
                    "$cond": [{"$eq": ["$projection - category", "Closed Won"]}, "$Weighted Amount", 0]
                }
            }
        }},
        {"$sort": {"_id": 1}}
    ]
    
    print(f"Executing aggregation on {DB_NAME}.weekly_tracker_data...")
    cursor = collection_data.aggregate(pipeline)
    
    results = []
    async for doc in cursor:
        results.append(doc)
        
    print(f"Found {len(results)} weeks of data for OPP_Type=Service.")
    for res in results:
        week = res["_id"]
        pipe = res["pipe_sum"]
        po = res["po_sum"]
        print(f"Week {week}: Weighted Pipeline = ${pipe:,.2f} | Closed Won (Audited) = ${po:,.2f}")

if __name__ == "__main__":
    asyncio.run(main())
