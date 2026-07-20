# ============================================================
# MIRACLE OS WEB BUILDER — AI Credit Guard Middleware
# Protects DALL-E 3 and Vision routes with atomic credit ops
# ============================================================
import logging
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.models.wb_models import WbUser, WbAiUsageLog
from app.routers.wb_auth import decode_wb_token

logger = logging.getLogger(__name__)


async def check_and_deduct_credit(
    authorization: str = Header(..., description="Bearer <token>"),
    db: Session = Depends(get_db),
) -> WbUser:
    """
    FastAPI dependency for all AI generation routes.

    Flow:
    1. Decode JWT → get wb_user_id
    2. Fetch WbUser from DB
    3. Auto-reset monthly credits if billing cycle has expired
    4. Raise 403 INSUFFICIENT_CREDITS if credits <= 0
    5. Return user for downstream atomic deduction

    Usage:
        @router.post("/generate")
        async def generate(user: WbUser = Depends(check_and_deduct_credit)):
            ...
            await deduct_credit(user, prompt="...", action="DALLE3_GENERATE", db=db)
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must be 'Bearer <token>'")

    token = authorization[7:]
    payload = decode_wb_token(token)
    user_id = payload.get("wb_user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing wb_user_id claim")

    user = db.query(WbUser).filter(WbUser.id == user_id, WbUser.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found or deactivated")

    # ── Auto-reset monthly credits ────────────────────────────────────────────
    now_utc = datetime.now(timezone.utc)
    reset_date = user.next_reset_date
    # Make reset_date timezone-aware if stored naive
    if reset_date and reset_date.tzinfo is None:
        reset_date = reset_date.replace(tzinfo=timezone.utc)

    if reset_date and now_utc >= reset_date:
        max_credits = user.plan.max_ai_credits if user.plan else 0
        user.ai_credits_remaining = max_credits
        user.next_reset_date = now_utc + timedelta(days=30)
        db.commit()
        db.refresh(user)
        logger.info(f"🔄 WB CREDITS RESET: user_id={user_id}, credits={max_credits}")

    # ── Credit Guard ──────────────────────────────────────────────────────────
    if user.ai_credits_remaining <= 0:
        plan_name = user.plan.name if user.plan else "free"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "INSUFFICIENT_CREDITS",
                "message": (
                    "You have used all your monthly AI generation credits. "
                    "Upgrade your plan or purchase a top-up pack."
                ),
                "credits_remaining": 0,
                "plan": plan_name,
                "upgrade_url": "/upgrade",
            },
        )

    return user


def deduct_credit(
    user: WbUser,
    prompt: str,
    action: str,
    db: Session,
) -> int:
    """
    Atomically deducts 1 credit from the user and writes an immutable usage log.
    Uses SQL-level atomic decrement to prevent race conditions under concurrency.

    Returns: new credits_remaining integer
    """
    # Atomic decrement — safe even under concurrent requests
    db.execute(
        text("UPDATE wb_users SET ai_credits_remaining = ai_credits_remaining - 1 WHERE id = :uid"),
        {"uid": user.id},
    )

    # Fetch the new balance after decrement
    db.refresh(user)
    new_balance = user.ai_credits_remaining

    # Write immutable usage log
    log_entry = WbAiUsageLog(
        user_id=user.id,
        action=action,
        prompt=prompt[:500] if prompt else None,  # Truncate for safety
        credits_used=1,
        credits_after=new_balance,
    )
    db.add(log_entry)
    db.commit()

    logger.info(
        f"💳 WB CREDIT DEDUCTED: user_id={user.id}, action={action}, "
        f"remaining={new_balance}"
    )
    return new_balance
