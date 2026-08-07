"""
Admin authentication.

- Stores admin credentials in the `admin_users` MongoDB collection.
- Password is never stored in plaintext. We store a PBKDF2-HMAC-SHA256 hash
  with a per-user random salt.
- Seeding of the default "Admin" user happens at app startup (see main.py)
  using the plaintext password read from the ADMIN_SEED_PASSWORD environment
  variable, so the plaintext never appears in source/frontend.
- Successful login returns an opaque bearer token stored in
  `admin_sessions` with a 12h expiry.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

router = APIRouter()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "DB tracker")

_PBKDF2_ITERATIONS = 200_000
_SESSION_TTL_HOURS = 12


def _get_db():
    return AsyncIOMotorClient(MONGODB_URL)[DB_NAME]


def _hash_password(password: str, salt: bytes) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return dk.hex()


def _verify_password(password: str, salt_hex: str, expected_hash_hex: str) -> bool:
    try:
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    computed = _hash_password(password, salt)
    return hmac.compare_digest(computed, expected_hash_hex)


async def seed_default_admin() -> None:
    """
    Ensure the default Admin user exists in `users`.
    """
    seed_email = os.getenv("ADMIN_SEED_EMAIL")
    seed_password = os.getenv("ADMIN_SEED_PASSWORD")
    if not seed_email or not seed_password:
        print("Admin seed failed: ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD not set.")
        return

    db = _get_db()
    coll = db["users"]
    existing = await coll.find_one({"email": seed_email})
    if existing:
        return

    salt = secrets.token_bytes(16)
    await coll.insert_one({
        "email": seed_email,
        "salt": salt.hex(),
        "password_hash": _hash_password(seed_password, salt),
        "initial_password": seed_password,
        "current_password": seed_password,
        "default_password": seed_password,
        "role": "Admin",
        "status": "Active",
        "department": "Management",
        "tracker_access": ["Weekly", "Revenue", "SYMB", "Admin"],
        "symb_permissions": ["ALL"],
        "created_at": datetime.utcnow(),
    })
    print("Seeded default Admin user in users collection.")


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    expires_at: datetime


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    db = _get_db()
    user = await db["admin_users"].find_one({"username": payload.username})
    if not user or not _verify_password(payload.password, user.get("salt", ""), user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=_SESSION_TTL_HOURS)
    await db["admin_sessions"].insert_one({
        "token": token,
        "username": user["username"],
        "role": "Admin",
        "created_at": datetime.utcnow(),
        "expires_at": expires_at,
    })
    return LoginResponse(token=token, username=user["username"], expires_at=expires_at)

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserLoginResponse(BaseModel):
    token: str
    email: str
    role: str
    sub_role: Optional[str] = "None"
    tracker_access: list
    symb_permissions: list
    expires_at: datetime

@router.post("/user-login", response_model=UserLoginResponse)
async def user_login(payload: UserLoginRequest):
    if not payload.email.endswith("@e-consystems.com"):
        raise HTTPException(status_code=400, detail="username is invalid please enter valid one or request new acess")
        
    db = _get_db()
    user = await db["users"].find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=400, detail="username is invalid please enter valid one or request new acess")
    
    if user.get("status") != "Active":
        raise HTTPException(status_code=403, detail="Your account is not active. Status: " + user.get("status", "Unknown"))
        
    if not _verify_password(payload.password, user.get("salt", ""), user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=_SESSION_TTL_HOURS)
    await db["admin_sessions"].insert_one({
        "token": token,
        "email": user["email"],
        "role": user.get("role", "User"),
        "sub_role": user.get("sub_role", "None"),
        "tracker_access": user.get("tracker_access", []),
        "symb_permissions": user.get("symb_permissions", []),
        "created_at": datetime.utcnow(),
        "expires_at": expires_at,
    })
    return UserLoginResponse(
        token=token, 
        email=user["email"], 
        role=user.get("role", "User"),
        sub_role=user.get("sub_role", "None"),
        tracker_access=user.get("tracker_access", []),
        symb_permissions=user.get("symb_permissions", []),
        expires_at=expires_at
    )


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    token = _extract_bearer(authorization)
    if token:
        await _get_db()["admin_sessions"].delete_one({"token": token})
    return {"status": "ok"}


async def _validate_and_sync_session(session: dict) -> Optional[dict]:
    if not session:
        return None
    db = _get_db()
    if session.get("expires_at") and session["expires_at"] < datetime.utcnow():
        await db["admin_sessions"].delete_one({"token": session["token"]})
        return None

    email = session.get("email")
    if email:
        user = await db["users"].find_one({"email": email})
        if not user or user.get("status") != "Active":
            await db["admin_sessions"].delete_many({"email": email})
            raise HTTPException(status_code=403, detail="Access has been revoked")

        session["role"] = user.get("role", "User")
        session["sub_role"] = user.get("sub_role", "None")
        session["tracker_access"] = user.get("tracker_access", [])
        session["symb_permissions"] = user.get("symb_permissions", [])

    return session

@router.get("/verify")
async def verify(authorization: Optional[str] = Header(None)):
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    db = _get_db()
    session = await db["admin_sessions"].find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    session = await _validate_and_sync_session(session)
    if not session:
        raise HTTPException(status_code=401, detail="Token expired")
    
    return {
        "status": "ok", 
        "username": session.get("username"), 
        "email": session.get("email"),
        "role": session.get("role"),
        "sub_role": session.get("sub_role", "None"),
        "tracker_access": session.get("tracker_access", []),
        "symb_permissions": session.get("symb_permissions", [])
    }

async def get_current_user(authorization: Optional[str] = Header(None)):
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    db = _get_db()
    session = await db["admin_sessions"].find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    session = await _validate_and_sync_session(session)
    if not session:
        raise HTTPException(status_code=401, detail="Token expired")
    return session

async def get_optional_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    token = _extract_bearer(authorization)
    if not token:
        return None
    db = _get_db()
    session = await db["admin_sessions"].find_one({"token": token})
    if not session:
        return None
    try:
        return await _validate_and_sync_session(session)
    except HTTPException:
        return None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
async def change_password(payload: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Only standard users can change passwords this way")
        
    db = _get_db()
    user = await db["users"].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not _verify_password(payload.current_password, user.get("salt", ""), user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid current password")
        
    new_salt = secrets.token_bytes(16)
    new_hash = _hash_password(payload.new_password, new_salt)
    
    await db["users"].update_one(
        {"email": email},
        {"$set": {
            "salt": new_salt.hex(), 
            "password_hash": new_hash,
            "current_password": payload.new_password,
            "password_changed": True,
            "password_changed_at": datetime.utcnow()
        }}
    )
    return {"status": "ok", "message": "Password updated successfully"}


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()
