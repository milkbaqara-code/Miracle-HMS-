# ============================================================
# MIRACLE OS WEB BUILDER — Authentication Router
# Endpoints: /register, /login, /me
# Uses bcrypt for password hashing (NOT plain text like legacy)
# JWT: HS256, 480-minute sessions, WB_JWT_SECRET env var
# ============================================================
import os
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.database import get_db
from app.models.wb_models import WbUser, WbPlan

logger = logging.getLogger(__name__)

# ─── Security Config ──────────────────────────────────────────────────────────

WB_JWT_SECRET = os.getenv("WB_JWT_SECRET", "WB_MIRACLE_SOVEREIGN_SECRET_DEV_CHANGE_IN_PROD")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(tags=["WB: Auth Gate"])


# ─── Plan Seeder (called on startup) ──────────────────────────────────────────

def seed_wb_plans(db: Session):
    """Ensures default subscription plans exist in the database."""
    defaults = [
        {"id": 1, "name": "free",       "max_ai_credits": 0,   "monthly_price": 0.00},
        {"id": 2, "name": "pro",        "max_ai_credits": 150,  "monthly_price": 29.00},
        {"id": 3, "name": "enterprise", "max_ai_credits": 400,  "monthly_price": 59.00},
    ]
    for d in defaults:
        exists = db.query(WbPlan).filter(WbPlan.name == d["name"]).first()
        if not exists:
            db.add(WbPlan(**d))
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"WB Plan seed warning (may already exist): {e}")


# ─── JWT Helpers ──────────────────────────────────────────────────────────────

def create_wb_token(user: WbUser) -> str:
    """Issue a signed JWT containing plan, role, and credit info."""
    plan_name = user.plan.name if user.plan else "free"
    role = f"WB_{plan_name.upper()}"  # WB_FREE | WB_PRO | WB_ENTERPRISE

    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user.email,
        "wb_user_id": user.id,
        "role": role,
        "plan": plan_name,
        "ai_credits": user.ai_credits_remaining,
        "exp": expire,
    }
    return jwt.encode(payload, WB_JWT_SECRET, algorithm=ALGORITHM)


def decode_wb_token(token: str) -> dict:
    """Decode and validate a WB JWT. Raises 401 on failure."""
    try:
        payload = jwt.decode(token, WB_JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
        )


def get_current_wb_user(
    authorization: str = Header(..., description="Bearer <token>"),
    db: Session = Depends(get_db),
) -> WbUser:
    """FastAPI dependency: resolves the authenticated WbUser from the JWT."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must be 'Bearer <token>'")
    token = authorization[7:]
    payload = decode_wb_token(token)
    user_id = payload.get("wb_user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing wb_user_id claim")

    user = db.query(WbUser).filter(WbUser.id == user_id, WbUser.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found or deactivated")
    return user


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    wb_user_id: int
    email: str
    full_name: str
    plan: str
    role: str
    ai_credits: int


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Create a new Web Builder account.
    Automatically assigns the Free plan (plan_id=1).
    """
    # Ensure plans are seeded
    seed_wb_plans(db)

    # Check for duplicate email
    existing = db.query(WbUser).filter(WbUser.email == payload.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Validate password length
    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters.",
        )

    # Hash password with bcrypt
    hashed = pwd_context.hash(payload.password)

    # Get free plan
    free_plan = db.query(WbPlan).filter(WbPlan.name == "free").first()
    if not free_plan:
        raise HTTPException(status_code=500, detail="Plan configuration error. Contact support.")

    new_user = WbUser(
        email=payload.email.lower().strip(),
        hashed_password=hashed,
        full_name=payload.full_name.strip(),
        plan_id=free_plan.id,
        ai_credits_remaining=0,
        next_reset_date=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"✅ WB REGISTER: New user created — {new_user.email}")

    token = create_wb_token(new_user)
    return AuthResponse(
        access_token=token,
        wb_user_id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        plan="free",
        role="WB_FREE",
        ai_credits=0,
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate with email + password.
    Returns a signed JWT with plan and credit info embedded.
    """
    user = db.query(WbUser).filter(
        WbUser.email == payload.email.lower().strip(),
        WbUser.is_active == True
    ).first()

    if not user or not pwd_context.verify(payload.password, user.hashed_password):
        # Generic message: don't reveal which field is wrong
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    logger.info(f"✅ WB LOGIN: {user.email} (plan={user.plan.name if user.plan else 'unknown'})")

    token = create_wb_token(user)
    plan_name = user.plan.name if user.plan else "free"
    return AuthResponse(
        access_token=token,
        wb_user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        plan=plan_name,
        role=f"WB_{plan_name.upper()}",
        ai_credits=user.ai_credits_remaining,
    )


@router.get("/me")
def get_me(current_user: WbUser = Depends(get_current_wb_user)):
    """
    Return the authenticated user's full profile including live credit balance.
    """
    plan_name = current_user.plan.name if current_user.plan else "free"
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "plan": plan_name,
        "plan_price": current_user.plan.monthly_price if current_user.plan else 0.0,
        "max_ai_credits": current_user.plan.max_ai_credits if current_user.plan else 0,
        "ai_credits_remaining": current_user.ai_credits_remaining,
        "next_reset_date": current_user.next_reset_date.isoformat() if current_user.next_reset_date else None,
        "is_active": current_user.is_active,
        "email_verified": current_user.email_verified,
        "billing_cycle": current_user.billing_cycle,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }
