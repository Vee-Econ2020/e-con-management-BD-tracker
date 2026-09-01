import os
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import secrets
import string

from routers.auth import get_current_user, _get_db, _hash_password

router = APIRouter()

class AccessRequest(BaseModel):
    email: str
    department: str

class ApproveRequest(BaseModel):
    role: str
    sub_role: str
    tracker_access: List[str]
    symb_permissions: List[str]
    ai_agent_access: Optional[bool] = False

@router.post("/request-access")
async def request_access(payload: AccessRequest):
    if not payload.email.endswith("@e-consystems.com"):
        raise HTTPException(status_code=400, detail="username is invalid please enter valid one or request new acess")
        
    db = _get_db()
    existing_user = await db["users"].find_one({"email": payload.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
        
    await db["users"].insert_one({
        "email": payload.email,
        "department": payload.department,
        "status": "Access Pending",
        "role": None,
        "sub_role": None,
        "tracker_access": [],
        "symb_permissions": [],
        "created_at": datetime.utcnow()
    })
    return {"status": "ok", "message": "Access requested successfully"}

@router.get("/pending-requests")
async def get_pending_requests(current_user: dict = Depends(get_current_user)):
    db = _get_db()
    cursor = db["users"].find({
        "$or": [
            {"status": "Access Pending"},
            {"has_pending_page_request": True}
        ]
    })
    requests = await cursor.to_list(length=5000)
    for req in requests:
        req["_id"] = str(req["_id"])
    return requests

class PageAccessRequest(BaseModel):
    page: str

@router.post("/request-page-access")
async def request_page_access(payload: PageAccessRequest, current_user: dict = Depends(get_current_user)):
    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="User email required")
        
    db = _get_db()
    user = await db["users"].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    requested_pages = list(set(user.get("requested_pages", []) + [payload.page]))

    await db["users"].update_one(
        {"email": email},
        {"$set": {
            "has_pending_page_request": True,
            "requested_pages": requested_pages,
            "last_page_request_at": datetime.utcnow()
        }}
    )
    return {"status": "ok", "message": f"Access request for {payload.page} submitted successfully"}

@router.get("/active-users")
async def get_active_users(current_user: dict = Depends(get_current_user)):
    from datetime import datetime, timedelta
    db = _get_db()
    cursor = db["users"].find({"status": "Active"})
    users = await cursor.to_list(length=5000)
    admin_seed_pwd = os.getenv("ADMIN_SEED_PASSWORD", "@Ec255kif5f")
    now = datetime.utcnow()

    for u in users:
        u["_id"] = str(u["_id"])
        u["password_changed"] = u.get("password_changed", False)
        
        curr_pwd = u.get("current_password") or u.get("default_password") or u.get("initial_password")
        if not curr_pwd or curr_pwd == "Initial Password":
            if u["email"] == "admin@e-consystems.com":
                curr_pwd = admin_seed_pwd
            else:
                curr_pwd = u.get("initial_password") or "Not Set"

        init_pwd = u.get("initial_password") or u.get("default_password")
        if not init_pwd or init_pwd == "Initial Password":
            if u["email"] == "admin@e-consystems.com":
                init_pwd = admin_seed_pwd
            else:
                init_pwd = curr_pwd

        u["current_password"] = curr_pwd
        u["initial_password"] = init_pwd
        u["default_password"] = curr_pwd
        
        # Activity computation (live within 45 seconds AND is_online)
        last_active = u.get("last_active_at")
        is_online_flag = u.get("is_online", True)
        is_live = False
        last_active_iso = None
        if last_active:
            if isinstance(last_active, str):
                try:
                    clean_str = last_active.rstrip("Z")
                    last_active_dt = datetime.fromisoformat(clean_str)
                except Exception:
                    last_active_dt = None
            else:
                last_active_dt = last_active

            if last_active_dt:
                last_active_iso = last_active_dt.isoformat() + "Z"
                if is_online_flag and (now - last_active_dt) < timedelta(seconds=45):
                    is_live = True

        u["is_live"] = is_live
        u["last_active_at"] = last_active_iso
        u["last_active_page"] = u.get("last_active_page", "Home")

        # Don't return password hashes or salts
        u.pop("password_hash", None)
        u.pop("salt", None)
    return users

class UpdateUserRequest(BaseModel):
    role: str
    sub_role: str
    tracker_access: List[str]
    symb_permissions: List[str]
    ai_agent_access: Optional[bool] = False

@router.put("/update-user/{email}")
async def update_user_access(email: str, payload: UpdateUserRequest, current_user: dict = Depends(get_current_user)):
    db = _get_db()
    user = await db["users"].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    has_ai = payload.ai_agent_access or ("AI Agent" in payload.tracker_access)

    await db["users"].update_one(
        {"email": email},
        {"$set": {
            "role": payload.role,
            "sub_role": payload.sub_role,
            "tracker_access": payload.tracker_access,
            "symb_permissions": payload.symb_permissions,
            "ai_agent_access": has_ai,
            "has_pending_page_request": False,
            "requested_pages": [],
            "updated_at": datetime.utcnow(),
            "updated_by": current_user.get("email") or current_user.get("username")
        }}
    )
    await db["admin_sessions"].update_many(
        {"email": email},
        {"$set": {
            "role": payload.role,
            "sub_role": payload.sub_role,
            "tracker_access": payload.tracker_access,
            "symb_permissions": payload.symb_permissions,
            "ai_agent_access": has_ai
        }}
    )
    return {"status": "ok", "message": "User access updated successfully"}

@router.put("/approve-request/{email}")
async def approve_request(email: str, payload: ApproveRequest, current_user: dict = Depends(get_current_user)):
    db = _get_db()
    user = await db["users"].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    has_ai = payload.ai_agent_access or ("AI Agent" in payload.tracker_access)

    # If active user requesting a new page
    if user.get("status") == "Active":
        await db["users"].update_one(
            {"email": email},
            {"$set": {
                "role": payload.role,
                "sub_role": payload.sub_role,
                "tracker_access": payload.tracker_access,
                "symb_permissions": payload.symb_permissions,
                "ai_agent_access": has_ai,
                "has_pending_page_request": False,
                "requested_pages": [],
                "updated_at": datetime.utcnow(),
                "updated_by": current_user.get("username") or current_user.get("email")
            }}
        )
        await db["admin_sessions"].update_many(
            {"email": email},
            {"$set": {
                "role": payload.role,
                "sub_role": payload.sub_role,
                "tracker_access": payload.tracker_access,
                "symb_permissions": payload.symb_permissions,
                "ai_agent_access": has_ai
            }}
        )
        return {"status": "ok", "message": "User page request approved successfully"}

    # Generate random password for fresh user
    alphabet = string.ascii_letters + string.digits
    password = ''.join(secrets.choice(alphabet) for i in range(12))
    
    salt = secrets.token_bytes(16)
    password_hash = _hash_password(password, salt)

    await db["users"].update_one(
        {"email": email},
        {"$set": {
            "status": "Active",
            "role": payload.role,
            "sub_role": payload.sub_role,
            "tracker_access": payload.tracker_access,
            "symb_permissions": payload.symb_permissions,
            "ai_agent_access": has_ai,
            "salt": salt.hex(),
            "password_hash": password_hash,
            "initial_password": password,
            "current_password": password,
            "default_password": password,
            "password_changed": False,
            "has_pending_page_request": False,
            "requested_pages": [],
            "approved_at": datetime.utcnow(),
            "approved_by": current_user.get("username") or current_user.get("email")
        }}
    )
    
    return {
        "status": "ok", 
        "message": "User approved successfully",
        "generated_password": password
    }

@router.put("/decline-request/{email}")
async def decline_request(email: str, current_user: dict = Depends(get_current_user)):
    db = _get_db()
    user = await db["users"].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.get("status") == "Access Pending":
        await db["users"].update_one(
            {"email": email},
            {"$set": {"status": "Declined", "declined_at": datetime.utcnow()}}
        )
        await db["admin_sessions"].delete_many({"email": email})
    else:
        await db["users"].update_one(
            {"email": email},
            {"$set": {"has_pending_page_request": False, "requested_pages": []}}
        )
        
    return {"status": "ok", "message": "Request declined"}

class DeleteUsersRequest(BaseModel):
    emails: List[str]

@router.post("/delete-users")
async def delete_users(payload: DeleteUsersRequest, current_user: dict = Depends(get_current_user)):
    db = _get_db()
    if not payload.emails:
        return {"status": "ok", "deleted_count": 0}
        
    res = await db["users"].delete_many({"email": {"$in": payload.emails}})
    await db["admin_sessions"].delete_many({"email": {"$in": payload.emails}})
    
    return {"status": "ok", "deleted_count": res.deleted_count, "message": f"Successfully deleted {res.deleted_count} user(s)"}

from datetime import timedelta
import re

class UpdateLockWindowPayload(BaseModel):
    start_time: str
    end_time: str

def parse_time_to_sec(time_str: Optional[str], default_str: str, is_end: bool = False) -> tuple[str, int]:
    val = (time_str or default_str).strip()
    if not re.match(r"^([01]\d|2[0-3]):([0-5]\d)$", val):
        val = default_str
    h, m = map(int, val.split(":"))
    sec = h * 3600 + m * 60 + (59 if is_end else 0)
    return val, sec

@router.get("/data-lock-status")
async def get_data_lock_status(authorization: Optional[str] = Header(None)):
    db = _get_db()
    is_admin = False
    if authorization:
        try:
            from routers.auth import get_optional_current_user
            user_sess = await get_optional_current_user(authorization)
            if user_sess and user_sess.get("role") == "Admin":
                is_admin = True
        except Exception:
            pass

    doc = await db["system_settings"].find_one({"_id": "data_update_lock"})
    
    now_utc = datetime.utcnow()
    temp_unlocked_until = doc.get("unlocked_until") if doc else None
    unlocked_by = doc.get("unlocked_by") if doc else None
    
    is_temp_unlocked = False
    temp_remaining_seconds = 0
    temp_unlocked_until_iso = None
    
    if temp_unlocked_until:
        temp_unlocked_until_dt = None
        if isinstance(temp_unlocked_until, str):
            try:
                temp_unlocked_until_dt = datetime.fromisoformat(temp_unlocked_until.rstrip("Z"))
            except Exception:
                temp_unlocked_until_dt = None
        elif isinstance(temp_unlocked_until, datetime):
            temp_unlocked_until_dt = temp_unlocked_until
            
        if temp_unlocked_until_dt:
            temp_unlocked_until_dt = temp_unlocked_until_dt.replace(tzinfo=None)
            if now_utc < temp_unlocked_until_dt:
                is_temp_unlocked = True
                temp_remaining_seconds = max(0, int((temp_unlocked_until_dt - now_utc).total_seconds()))
                temp_unlocked_until_iso = temp_unlocked_until_dt.isoformat() + "Z"

    start_time_str, start_sec = parse_time_to_sec(doc.get("start_time") if doc else None, "00:00", is_end=False)
    end_time_str, end_sec = parse_time_to_sec(doc.get("end_time") if doc else None, "14:00", is_end=True)

    now_local = datetime.now()
    current_sec = now_local.hour * 3600 + now_local.minute * 60 + now_local.second
    
    if start_sec <= end_sec:
        standard_allowed = (start_sec <= current_sec <= end_sec)
    else:
        standard_allowed = (current_sec >= start_sec or current_sec <= end_sec)

    is_edit_allowed = standard_allowed or is_temp_unlocked or is_admin
    is_locked = not (standard_allowed or is_temp_unlocked)

    return {
        "is_locked": is_locked,
        "is_edit_allowed": is_edit_allowed,
        "is_temp_unlocked": is_temp_unlocked,
        "temp_remaining_seconds": temp_remaining_seconds,
        "temp_unlocked_until": temp_unlocked_until_iso,
        "standard_allowed": standard_allowed,
        "unlocked_by": unlocked_by if is_temp_unlocked else None,
        "is_admin": is_admin,
        "start_time": start_time_str,
        "end_time": end_time_str
    }

@router.post("/unlock-data-lock")
async def unlock_data_lock(current_user: dict = Depends(get_current_user)):
    db = _get_db()
    admin_email = current_user.get("email") or current_user.get("username", "Admin")
    now_utc = datetime.utcnow()
    unlocked_until = now_utc + timedelta(minutes=10)
    
    await db["system_settings"].update_one(
        {"_id": "data_update_lock"},
        {"$set": {
            "unlocked_until": unlocked_until,
            "unlocked_by": admin_email,
            "unlocked_at": now_utc
        }},
        upsert=True
    )
    
    return {
        "status": "ok",
        "message": "Data update lock temporarily unlocked for 10 minutes",
        "temp_remaining_seconds": 600,
        "temp_unlocked_until": unlocked_until.isoformat() + "Z",
        "unlocked_by": admin_email
    }

@router.post("/update-lock-window")
async def update_lock_window(payload: UpdateLockWindowPayload, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Only Admins can change lock hours")
    
    start_time = payload.start_time.strip()
    end_time = payload.end_time.strip()
    
    if not re.match(r"^([01]\d|2[0-3]):([0-5]\d)$", start_time) or not re.match(r"^([01]\d|2[0-3]):([0-5]\d)$", end_time):
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:mm format between 00:00 and 23:59")
    
    db = _get_db()
    admin_email = current_user.get("email") or current_user.get("username", "Admin")
    now_utc = datetime.utcnow()
    
    await db["system_settings"].update_one(
        {"_id": "data_update_lock"},
        {"$set": {
            "start_time": start_time,
            "end_time": end_time,
            "updated_by": admin_email,
            "updated_at": now_utc
        }},
        upsert=True
    )
    
    return {
        "status": "ok",
        "message": f"Lock window updated successfully to {start_time} - {end_time}",
        "start_time": start_time,
        "end_time": end_time
    }

