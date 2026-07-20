with open('d:\\e-con-management-BD-tracker\\backend\\routers\\admin.py', 'a') as f:
    f.write('''

# --- WHALE ACCOUNTS API ---
from datetime import datetime
from pydantic import BaseModel

class WhaleAccountEntry(BaseModel):
    account_name: str
    date_updated: str
    week_updated: int
    text_data: str

@router.get("/whale-accounts/names")
async def get_whale_account_names():
    try:
        coll = get_collection("whale_accounts")
        names = await coll.distinct("account_name")
        return [n for n in names if n]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/whale-accounts/{account_name}")
async def get_whale_account_entries(account_name: str):
    try:
        coll = get_collection("whale_accounts")
        cursor = coll.find({"account_name": account_name}).sort("date_updated", -1)
        entries = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            entries.append(doc)
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/whale-accounts/{account_name}")
async def save_whale_account_entry(account_name: str, payload: WhaleAccountEntry):
    try:
        coll = get_collection("whale_accounts")
        await coll.update_one(
            {
                "account_name": account_name,
                "date_updated": payload.date_updated
            },
            {
                "$set": {
                    "week_updated": payload.week_updated,
                    "text_data": payload.text_data,
                    "updated_at": datetime.utcnow()
                },
                "$setOnInsert": {
                    "created_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
''')
