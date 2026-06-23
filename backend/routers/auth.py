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

from fastapi import APIRouter, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

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
    Ensure the default Admin user exists in `admin_users`.

    Reads the plaintext seed password from the ADMIN_SEED_PASSWORD env var.
    If the user already exists, this is a no-op (so rotating the env var
    does not silently overwrite the stored hash). Use `reset-admin` CLI or
    a DB update to change an existing password.
    """
    seed_password = os.getenv("ADMIN_SEED_PASSWORD")
    if not seed_password:
        print("⚠️  ADMIN_SEED_PASSWORD not set — skipping default admin seed.")
        return

    db = _get_db()
    coll = db["admin_users"]
    existing = await coll.find_one({"username": "Admin"})
    if existing:
        return

    salt = secrets.token_bytes(16)
    await coll.insert_one({
        "username": "Admin",
        "salt": salt.hex(),
        "password_hash": _hash_password(seed_password, salt),
        "created_at": datetime.utcnow(),
    })
    print("✅ Seeded default Admin user in admin_users collection.")


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
        # Uniform error to avoid username enumeration.
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=_SESSION_TTL_HOURS)
    await db["admin_sessions"].insert_one({
        "token": token,
        "username": user["username"],
        "created_at": datetime.utcnow(),
        "expires_at": expires_at,
    })
    return LoginResponse(token=token, username=user["username"], expires_at=expires_at)


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    token = _extract_bearer(authorization)
    if token:
        await _get_db()["admin_sessions"].delete_one({"token": token})
    return {"status": "ok"}


@router.get("/verify")
async def verify(authorization: Optional[str] = Header(None)):
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    session = await _get_db()["admin_sessions"].find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    if session.get("expires_at") and session["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Token expired")
    return {"status": "ok", "username": session["username"]}


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()
