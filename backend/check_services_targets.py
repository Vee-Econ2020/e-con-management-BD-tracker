"""
Quick diagnostic script to check Services target categories in the database.
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def check_targets():
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DB_NAME = os.getenv("DB_NAME", "DB_tracker")
    
    print(f"Connecting to: {MONGODB_URL}")
    print(f"Database: {DB_NAME}\n")
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    collection = db["target_settings"]
    
    print("\n" + "=" * 80)
    print("ALL WEEKLY TRACKER FY2027 TARGETS IN DATABASE")
    print("=" * 80)
    
    # Find ALL Weekly Tracker FY2027 targets to see what's actually there
    query = {
        "ppt_type": "Weekly Tracker",
        "financial_year": "FY2027"
    }
    
    print(f"\nQuery: {query}\n")
    
    found_categories = set()
    print("Filtering for US West and Services targets:\n")
    async for doc in collection.find(query).sort([("category_type", 1), ("financial_qtr", 1)]):
        cat_type = doc.get("category_type", "")
        found_categories.add(cat_type)
        
        # Only show US West or Services entries
        if "West" in cat_type or "Services" in cat_type or "Serivces" in cat_type:
            print(f"Category: '{cat_type}'")
            print(f"  Quarter: {doc.get('financial_qtr', 'N/A')}")
            print(f"  Type: {doc.get('category_value', 'N/A')}")
            print(f"  Value: {doc.get('target_value', 0)}")
            print()
    
    print("=" * 80)
    print("UNIQUE CATEGORY_TYPE VALUES FOUND:")
    print("=" * 80)
    for cat in sorted(found_categories):
        print(f"  - '{cat}' (length: {len(cat)} chars)")
        # Show character codes to detect hidden characters
        print(f"    Bytes: {[ord(c) for c in cat]}")        # Show repr to see escape characters
        print(f"    Repr: {repr(cat)}")    
    print("\n" + "=" * 80)
    print("EXPECTED VALUES IN CODE:")
    print("=" * 80)
    expected = [
        "Overall - Serivces",
        "US West - Services",
        "Europe - Services",
        "US East - Services"
    ]
    for exp in expected:
        print(f"  - '{exp}' (length: {len(exp)} chars)")
        print(f"    Bytes: {[ord(c) for c in exp]}")
        print(f"    Repr: {repr(exp)}")
    
    # Check which expected values were found
    print("\n" + "=" * 80)
    print("MATCHING CHECK:")
    print("=" * 80)
    for exp in expected:
        found = exp in found_categories
        print(f"  '{exp}': {'FOUND ✓' if found else 'NOT FOUND ✗'}")
        # Check for similar strings
        similar = [cat for cat in found_categories if exp.replace(' ', '').lower() in cat.replace(' ', '').lower()]
        if similar and not found:
            print(f"    Similar: {similar}")
    
    # Check exact match for US West
    print("\n" + "=" * 80)
    print("TESTING EXACT QUERY FOR 'US West - Services':")
    print("=" * 80)
    test_query = {
        "ppt_type": "Weekly Tracker",
        "financial_year": "FY2027",
        "category_type": "US West - Services"
    }
    count = await collection.count_documents(test_query)
    print(f"Documents found with exact match: {count}")
    
    if count > 0:
        print("\nDocuments:")
        async for doc in collection.find(test_query):
            print(f"  Q{doc.get('financial_qtr')}: {doc.get('category_value')} = {doc.get('target_value')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_targets())
