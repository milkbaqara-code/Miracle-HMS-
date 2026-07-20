# ============================================================
# MIRACLE OS WEB BUILDER — Stripe Payment Router (Phase 2D)
#
# Endpoints:
#   POST /create-checkout   → Creates a Stripe Checkout Session
#   POST /webhook           → Handles Stripe events (plan upgrades, renewals)
#   GET  /portal            → Stripe Customer Portal (manage billing)
#   GET  /status            → Returns current user billing status
# ============================================================
import os
import logging
from datetime import datetime, timedelta, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.models.wb_models import WbUser, WbPlan, WbPaymentLog
from app.routers.wb_auth import get_current_wb_user

logger = logging.getLogger(__name__)

# ─── Stripe Config ────────────────────────────────────────────────────────────

STRIPE_SECRET_KEY       = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET   = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL            = os.getenv("FRONTEND_URL", "http://localhost:3000")

stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(tags=["WB: Payments"])


# ─── Stripe Price IDs (set in .env after creating products in Stripe Dashboard)
# Each price ID maps to a plan name + credit reset
PRICE_TO_PLAN: dict[str, dict] = {
    os.getenv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_monthly"):         {"plan": "pro",        "credits": 150, "cycle": "monthly"},
    os.getenv("STRIPE_PRICE_PRO_6MONTH",  "price_pro_6month"):          {"plan": "pro",        "credits": 150, "cycle": "6month"},
    os.getenv("STRIPE_PRICE_PRO_YEARLY",  "price_pro_yearly"):          {"plan": "pro",        "credits": 150, "cycle": "yearly"},
    os.getenv("STRIPE_PRICE_ENT_MONTHLY", "price_enterprise_monthly"):  {"plan": "enterprise", "credits": 400, "cycle": "monthly"},
    os.getenv("STRIPE_PRICE_ENT_6MONTH",  "price_enterprise_6month"):   {"plan": "enterprise", "credits": 400, "cycle": "6month"},
    os.getenv("STRIPE_PRICE_ENT_YEARLY",  "price_enterprise_yearly"):   {"plan": "enterprise", "credits": 400, "cycle": "yearly"},
    # Credit top-up packs (one-time payments)
    os.getenv("STRIPE_PRICE_TOPUP_150",   "price_topup_150"):           {"plan": None, "credits": 150, "cycle": None},
    os.getenv("STRIPE_PRICE_TOPUP_500",   "price_topup_500"):           {"plan": None, "credits": 500, "cycle": None},
}


# ─── Helper: Upgrade user plan in DB ─────────────────────────────────────────

def _upgrade_user_plan(
    db: Session,
    email: str,
    plan_name: str,
    credits_to_add: int,
    billing_cycle: str | None,
    stripe_customer_id: str | None = None,
    stripe_subscription_id: str | None = None,
    amount_usd: float = 0.0,
    gateway_event: str = "",
    raw_payload: str = "",
) -> WbUser | None:
    """Atomically upgrades a user's plan and resets/adds credits."""
    user = db.query(WbUser).filter(WbUser.email == email).first()
    if not user:
        logger.error(f"STRIPE WEBHOOK: User not found for email {email}")
        return None

    # Fetch the plan
    plan = db.query(WbPlan).filter(WbPlan.name == plan_name).first()
    if plan:
        user.plan_id = plan.id

    # Reset billing cycle
    if billing_cycle:
        user.billing_cycle = billing_cycle
        user.next_reset_date = datetime.now(timezone.utc) + timedelta(days=30)

    # Add / set credits
    if plan_name:
        user.ai_credits_remaining = credits_to_add  # Full reset on new subscription
    else:
        # Top-up pack: add on top
        db.execute(
            text("UPDATE wb_users SET ai_credits_remaining = ai_credits_remaining + :c WHERE id = :uid"),
            {"c": credits_to_add, "uid": user.id}
        )

    # Store Stripe IDs
    if stripe_customer_id:
        user.stripe_customer_id = stripe_customer_id
    if stripe_subscription_id:
        user.stripe_subscription_id = stripe_subscription_id

    # Write immutable payment log
    log = WbPaymentLog(
        user_id=user.id,
        gateway="stripe",
        gateway_event=gateway_event,
        amount_usd=amount_usd,
        plan_purchased=plan_name,
        credits_added=credits_to_add,
        status="SUCCESS",
        raw_payload=raw_payload[:4000] if raw_payload else None,
    )
    db.add(log)
    db.commit()
    db.refresh(user)

    logger.info(
        f"✅ STRIPE: User {email} upgraded → plan={plan_name}, "
        f"credits={credits_to_add}, cycle={billing_cycle}"
    )
    return user


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    price_id: str
    success_url: str | None = None
    cancel_url: str | None = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/create-checkout")
async def create_checkout_session(
    payload: CheckoutRequest,
    current_user: WbUser = Depends(get_current_wb_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Checkout Session.
    Returns a redirect URL for the user to complete payment.
    """
    if not STRIPE_SECRET_KEY or STRIPE_SECRET_KEY.startswith("sk_test_PLACEHOLDER"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway not configured. Please contact support.",
        )

    success_url = payload.success_url or f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url  = payload.cancel_url  or f"{FRONTEND_URL}/payment/cancel"

    # Determine if subscription or one-time
    plan_info = PRICE_TO_PLAN.get(payload.price_id, {})
    is_subscription = plan_info.get("cycle") is not None

    try:
        session_params: dict = {
            "payment_method_types": ["card"],
            "line_items": [{"price": payload.price_id, "quantity": 1}],
            "mode": "subscription" if is_subscription else "payment",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "customer_email": current_user.email,
            "metadata": {
                "wb_user_id": str(current_user.id),
                "wb_user_email": current_user.email,
                "price_id": payload.price_id,
            },
        }

        # Re-use existing Stripe customer if available
        if current_user.stripe_customer_id:
            session_params["customer"] = current_user.stripe_customer_id
            del session_params["customer_email"]

        checkout_session = stripe.checkout.Session.create(**session_params)

        logger.info(
            f"🔗 STRIPE CHECKOUT: Created for {current_user.email} "
            f"→ price={payload.price_id}, mode={'sub' if is_subscription else 'one-time'}"
        )

        return {
            "success": True,
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id,
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe webhook receiver.
    Verifies signature, processes payment events, upgrades user plans.
    IMPORTANT: This endpoint MUST NOT require JWT auth (called by Stripe, not the user).
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    # Verify Stripe webhook signature
    if STRIPE_WEBHOOK_SECRET and not STRIPE_WEBHOOK_SECRET.startswith("whsec_PLACEHOLDER"):
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError as e:
            logger.warning(f"⚠️ STRIPE WEBHOOK: Invalid signature — {e}")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    else:
        # Dev mode: skip signature check
        import json
        event = json.loads(payload)
        logger.warning("⚠️ STRIPE WEBHOOK: Signature verification SKIPPED (dev mode)")

    event_type = event.get("type", "")
    data_object = event.get("data", {}).get("object", {})
    raw_payload_str = str(event)[:4000]

    logger.info(f"📥 STRIPE EVENT: {event_type}")

    # ── checkout.session.completed ────────────────────────────────────────────
    if event_type == "checkout.session.completed":
        email = (
            data_object.get("customer_email")
            or data_object.get("metadata", {}).get("wb_user_email")
        )
        price_id = (
            data_object.get("metadata", {}).get("price_id")
        )
        stripe_customer_id = data_object.get("customer")
        stripe_subscription_id = data_object.get("subscription")
        amount_total = (data_object.get("amount_total") or 0) / 100  # cents → USD

        if not email or not price_id:
            logger.error(f"STRIPE: Missing email or price_id in checkout.session.completed")
            return {"received": True}

        plan_info = PRICE_TO_PLAN.get(price_id, {})
        plan_name = plan_info.get("plan")
        credits   = plan_info.get("credits", 0)
        cycle     = plan_info.get("cycle")

        _upgrade_user_plan(
            db=db,
            email=email,
            plan_name=plan_name or "free",
            credits_to_add=credits,
            billing_cycle=cycle,
            stripe_customer_id=stripe_customer_id,
            stripe_subscription_id=stripe_subscription_id,
            amount_usd=amount_total,
            gateway_event=event_type,
            raw_payload=raw_payload_str,
        )

    # ── invoice.payment_succeeded (monthly renewal) ───────────────────────────
    elif event_type == "invoice.payment_succeeded":
        subscription_id = data_object.get("subscription")
        customer_id     = data_object.get("customer")
        amount_paid     = (data_object.get("amount_paid") or 0) / 100

        if subscription_id and customer_id:
            user = db.query(WbUser).filter(
                WbUser.stripe_subscription_id == subscription_id
            ).first()

            if user and user.plan:
                plan_credits = user.plan.max_ai_credits
                # Reset monthly credits on renewal
                user.ai_credits_remaining = plan_credits
                user.next_reset_date = datetime.now(timezone.utc) + timedelta(days=30)

                log = WbPaymentLog(
                    user_id=user.id,
                    gateway="stripe",
                    gateway_event=event_type,
                    amount_usd=amount_paid,
                    plan_purchased=user.plan.name,
                    credits_added=plan_credits,
                    status="SUCCESS",
                    raw_payload=raw_payload_str[:4000],
                )
                db.add(log)
                db.commit()
                logger.info(f"🔄 STRIPE RENEWAL: {user.email} → credits reset to {plan_credits}")

    # ── customer.subscription.deleted (cancellation) ─────────────────────────
    elif event_type == "customer.subscription.deleted":
        subscription_id = data_object.get("id")
        if subscription_id:
            user = db.query(WbUser).filter(
                WbUser.stripe_subscription_id == subscription_id
            ).first()
            if user:
                free_plan = db.query(WbPlan).filter(WbPlan.name == "free").first()
                if free_plan:
                    user.plan_id = free_plan.id
                user.ai_credits_remaining = 0
                user.stripe_subscription_id = None
                db.commit()
                logger.info(f"❌ STRIPE CANCEL: {user.email} → downgraded to Free")

    return {"received": True}


@router.get("/portal")
async def billing_portal(
    current_user: WbUser = Depends(get_current_wb_user),
):
    """Redirect user to Stripe Customer Portal to manage subscription."""
    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="No billing account found. Please upgrade first.",
        )
    try:
        portal = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/",
        )
        return {"portal_url": portal.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status")
async def billing_status(current_user: WbUser = Depends(get_current_wb_user)):
    """Returns current billing status for the authenticated user."""
    plan_name = current_user.plan.name if current_user.plan else "free"
    return {
        "plan": plan_name,
        "ai_credits_remaining": current_user.ai_credits_remaining,
        "max_ai_credits": current_user.plan.max_ai_credits if current_user.plan else 0,
        "next_reset_date": current_user.next_reset_date.isoformat() if current_user.next_reset_date else None,
        "billing_cycle": current_user.billing_cycle,
        "has_active_subscription": bool(current_user.stripe_subscription_id),
        "stripe_customer_id": current_user.stripe_customer_id,
    }
