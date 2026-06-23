import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import pandas as pd

async def test_db():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["DB_tracker"]
    collection = db["weekly_tracker_data"]
    
    # Get latest week
    latest_doc = await collection.find_one({}, sort=[("week", -1)])
    if not latest_doc:
        print("No data")
        return
        
    latest_week = latest_doc["week"]
    print(f"Latest week: {latest_week}")
    
    # Query closed won for latest week
    cursor = collection.find({"week": latest_week, "projection - category": "Closed Won"})
    docs = await cursor.to_list(length=None)
    df = pd.DataFrame(docs)
    
    print("\nTotal PO Won (from sum over all Closed Won):")
    total_po = df['Weighted Amount'].sum()
    print(f"{total_po:,.2f}")
    
    print("\nBreakdown by granular_QTR:")
    print(df.groupby('granular_QTR')['Weighted Amount'].sum())
    
    print("\nBreakdown by closing date QTR:")
    print(df.groupby('closing date QTR')['Weighted Amount'].sum())
    
    print("\nMissing from ['QP2', 'QP3', 'QP4', 'Q1', 'Q2', 'Q3', 'Q4']:")
    valid_qtrs = ['QP2', 'QP3', 'QP4', 'Q1', 'Q2', 'Q3', 'Q4']
    invalid_df = df[~df['granular_QTR'].isin(valid_qtrs)]
    print(f"Total missing: {invalid_df['Weighted Amount'].sum():,.2f}")
    if not invalid_df.empty:
        print(invalid_df[['Opportunity Name', 'granular_QTR', 'closing date QTR', 'Weighted Amount']])

if __name__ == "__main__":
    asyncio.run(test_db())
