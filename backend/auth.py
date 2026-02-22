import os
import random
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field

if __package__:
    from .db import get_admins_collection
else:
    from db import get_admins_collection

router = APIRouter(prefix="/auth", tags=["Admin Auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "SECRET_KEY_CHANGE_LATER")
ALGORITHM = "HS256"
EXPIRE_MIN = 60

security = HTTPBearer()


class AdminRegister(BaseModel):
    first_name: str
    last_name: str
    profession: str
    email: EmailStr
    password: str = Field(min_length=6)
    confirm_password: str


class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPassword(BaseModel):
    email: EmailStr


class VerifyOTP(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class ResetPassword(BaseModel):
    email: EmailStr
    new_password: str = Field(min_length=6)


class AdminOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    profession: str
    email: EmailStr


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_token(data: dict):
    payload = data.copy()
    payload["exp"] = utc_now() + timedelta(minutes=EXPIRE_MIN)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_admin(cred: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(cred.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        admin_id = payload.get("admin_id")
        if not admin_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        admin = get_admins_collection().find_one({"_id": ObjectId(admin_id)})
        if not admin:
            raise HTTPException(status_code=401, detail="Invalid token")
        return admin
    except (JWTError, Exception):
        raise HTTPException(status_code=401, detail="Invalid token")


def admin_to_out(admin_doc: dict) -> AdminOut:
    return AdminOut(
        id=str(admin_doc["_id"]),
        first_name=admin_doc["first_name"],
        last_name=admin_doc["last_name"],
        profession=admin_doc["profession"],
        email=admin_doc["email"],
    )


@router.post("/admin/register")
def register(data: AdminRegister):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    admins = get_admins_collection()
    if admins.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Admin exists")

    admins.insert_one(
        {
            "first_name": data.first_name,
            "last_name": data.last_name,
            "profession": data.profession,
            "email": data.email,
            "password": data.password,
            "created_at": utc_now(),
            "otp": None,
            "otp_expires": None,
            "reset_allowed_until": None,
        }
    )
    return {"message": "Admin registered"}


@router.post("/admin/login")
def login(data: AdminLogin):
    admins = get_admins_collection()
    admin = admins.find_one({"email": data.email})
    if not admin or admin.get("password") != data.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token({"admin_id": str(admin["_id"]), "role": "admin"})
    return {"token": token}


@router.get("/admin/protected")
def protected(admin: dict = Depends(get_current_admin)):
    return {"message": f"Hello {admin.get('first_name', 'Admin')}"}


@router.post("/admin/forgot-password")
def admin_forgot_password(data: ForgotPassword):
    admins = get_admins_collection()
    admin = admins.find_one({"email": data.email})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    otp = str(random.randint(100000, 999999))
    admins.update_one(
        {"_id": admin["_id"]},
        {
            "$set": {
                "otp": otp,
                "otp_expires": utc_now() + timedelta(minutes=10),
                "reset_allowed_until": None,
            }
        },
    )

    # Integrate real email/SMS provider here. Returning OTP helps local testing.
    return {"message": "OTP generated", "otp": otp}


@router.post("/admin/verify-otp")
def admin_verify_otp(data: VerifyOTP):
    admins = get_admins_collection()
    admin = admins.find_one({"email": data.email, "otp": data.otp})
    if not admin:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    otp_expires = admin.get("otp_expires")
    if not otp_expires or otp_expires < utc_now():
        raise HTTPException(status_code=400, detail="OTP expired")

    admins.update_one(
        {"_id": admin["_id"]},
        {
            "$set": {"reset_allowed_until": utc_now() + timedelta(minutes=10)},
            "$unset": {"otp": "", "otp_expires": ""},
        },
    )
    return {"message": "OTP verified"}


@router.post("/admin/reset-password")
def admin_reset_password(data: ResetPassword):
    admins = get_admins_collection()
    admin = admins.find_one({"email": data.email})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    reset_allowed_until = admin.get("reset_allowed_until")
    if not reset_allowed_until or reset_allowed_until < utc_now():
        raise HTTPException(status_code=400, detail="OTP verification required")

    admins.update_one(
        {"_id": admin["_id"]},
        {
            "$set": {
                "password": data.new_password,
                "updated_at": utc_now(),
            },
            "$unset": {"reset_allowed_until": ""},
        },
    )

    return {"message": "Password reset successful"}


@router.get("/admin/details", response_model=AdminOut)
def get_admin_details(admin: dict = Depends(get_current_admin)):
    return admin_to_out(admin)
