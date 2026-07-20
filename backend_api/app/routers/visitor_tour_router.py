"""
============================================================
MIRACLE AI — VISITOR TOUR ROUTER
============================================================
Endpoints:
  GET  /api/visitor/tour-context   → decode tour token → return visitor profile
  POST /api/visitor/book-appointment → save appointment + log WhatsApp alert
============================================================
"""
import json
import base64
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import SessionLocal

logger = logging.getLogger("MasterOS")
router = APIRouter()

ENGINEER_WHATSAPP = "+8801711477509"

# ── DB Dependency ─────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Local model reference (avoid circular imports) ────────────────────────────
from app.routers.visitor_otp_router import SalesLeadModel


# ── Schemas ───────────────────────────────────────────────────────────────────
class AppointmentRequest(BaseModel):
    lead_id: int
    appointment_slot: str   # e.g. "NOW", "30_MIN", "1_HOUR" or ISO datetime string
    phone: str
    visitor_name: Optional[str] = ""
    enterprise_name: Optional[str] = ""
    recommended_zones: Optional[str] = "[]"


# ── Tour Context Endpoint ─────────────────────────────────────────────────────
@router.get("/visitor/tour-context")
async def get_tour_context(
    token: str = Query(..., description="Base64-encoded tour token"),
    db: Session = Depends(get_db)
):
    """
    Decodes a tour_token and returns the visitor's lead profile.
    Used by the Miracle OS /visitor-tour page to load context before auth.
    """
    try:
        # Decode base64 token
        decoded = base64.urlsafe_b64decode(token + '==').decode('utf-8')
        payload = json.loads(decoded)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid tour token format")

    # Check expiry (2 hours)
    issued_at = payload.get("issued_at", 0)
    if (datetime.now(timezone.utc).timestamp() - issued_at) > 7200:
        raise HTTPException(status_code=410, detail="Tour token expired. Please start a new conversation at vigilantitsolution.com")

    # Look up lead in DB
    lead_id = payload.get("lead_id")
    lead = db.query(SalesLeadModel).filter_by(id=lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Validate token matches
    stored_token = getattr(lead, 'tour_token', None)
    if stored_token != token:
        raise HTTPException(status_code=403, detail="Token mismatch")

    zones = []
    try:
        zones_raw = getattr(lead, 'recommended_zones', '[]') or '[]'
        zones = json.loads(zones_raw)
    except Exception:
        zones = []

    return {
        "status": "OK",
        "lead_id": lead.id,
        "visitor_name": lead.lead_name or "",
        "enterprise_name": lead.enterprise_name or "",
        "enterprise_size": lead.enterprise_size or "",
        "contact_details": lead.contact_details or "",
        "business_type": getattr(lead, 'business_type', '') or '',
        "recommended_zones": zones,
        "conversation_summary": getattr(lead, 'conversation_summary', '') or '',
        "source": getattr(lead, 'source', 'WEBSITE_BOT'),
    }


# ── Appointment Booking Endpoint ──────────────────────────────────────────────
@router.post("/visitor/book-appointment")
async def book_appointment(
    payload: AppointmentRequest,
    db: Session = Depends(get_db)
):
    """
    Books an appointment for a website visitor lead.
    Saves appointment_at to sales_leads row.
    Logs a WhatsApp alert message to the engineer.
    """
    now = datetime.now(timezone.utc)

    # Calculate appointment time
    slot_map = {
        "NOW":     timedelta(minutes=5),
        "30_MIN":  timedelta(minutes=30),
        "1_HOUR":  timedelta(hours=1),
    }
    delta = slot_map.get(payload.appointment_slot, timedelta(minutes=30))
    appointment_dt = now + delta

    # Update lead record
    lead = db.query(SalesLeadModel).filter_by(id=payload.lead_id).first()
    if lead:
        lead.appointment_at = appointment_dt
        lead.status = "APPOINTMENT_BOOKED"
        db.commit()
        logger.info(f"[APPOINTMENT] Lead #{payload.lead_id} booked for {appointment_dt.isoformat()}")
    else:
        logger.warning(f"[APPOINTMENT] Lead #{payload.lead_id} not found — appointment not saved")

    # Format zones
    try:
        zones_list = json.loads(payload.recommended_zones or '[]')
        zones_str = ', '.join(zones_list) if zones_list else 'Not specified'
    except Exception:
        zones_str = payload.recommended_zones or 'Not specified'

    # Log WhatsApp alert (engineer)
    slot_label = {
        "NOW": "immediately (within 5 min)",
        "30_MIN": "in 30 minutes",
        "1_HOUR": "in 1 hour",
    }.get(payload.appointment_slot, payload.appointment_slot)

    engineer_msg = (
        f"🔔 LEAD ALERT — APPOINTMENT BOOKED\n"
        f"Name: {payload.visitor_name}\n"
        f"Enterprise: {payload.enterprise_name}\n"
        f"Zones: {zones_str}\n"
        f"Call Time: {slot_label} ({appointment_dt.strftime('%H:%M UTC')})\n"
        f"Contact: {payload.phone}\n"
        f"WhatsApp: https://wa.me/{payload.phone.replace('+','').replace(' ','')}\n"
        f"Reply: https://wa.me/{ENGINEER_WHATSAPP.replace('+','').replace(' ','')}?text=I+am+calling+{payload.visitor_name}"
    )
    logger.info(f"[WHATSAPP→ENGINEER {ENGINEER_WHATSAPP}] {engineer_msg}")
    # TODO: Replace logger with real WhatsApp API when credentials are available
    # e.g. requests.post(WA_API_URL, json={"phone": ENGINEER_WHATSAPP, "message": engineer_msg})

    # Visitor confirmation message
    visitor_confirm = (
        f"✅ Appointment confirmed with Vigilant IT Solutions!\n"
        f"Our engineer will contact you {slot_label}.\n"
        f"Questions? https://wa.me/{ENGINEER_WHATSAPP.replace('+','').replace(' ','')}\n"
        f"Powered by Miracle AI"
    )
    logger.info(f"[WHATSAPP→VISITOR {payload.phone}] {visitor_confirm}")

    return {
        "status": "BOOKED",
        "appointment_at": appointment_dt.isoformat(),
        "slot_label": slot_label,
        "engineer_whatsapp": ENGINEER_WHATSAPP,
        "visitor_confirm": visitor_confirm,
    }


class TourLoginRequest(BaseModel):
    token: str


@router.post("/visitor/tour-login")
async def visitor_tour_login(
    payload: TourLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Validates a tour token and issues a unique JWT access token with restricted zone clearances.
    """
    token = payload.token
    try:
        # Decode base64 token
        decoded = base64.urlsafe_b64decode(token + '==').decode('utf-8')
        token_payload = json.loads(decoded)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tour token format")

    # Check expiry (2 hours)
    issued_at = token_payload.get("issued_at", 0)
    if (datetime.now(timezone.utc).timestamp() - issued_at) > 7200:
        raise HTTPException(status_code=410, detail="Tour token expired. Please start a new conversation at vigilantitsolution.com")

    # Look up lead in DB
    lead_id = token_payload.get("lead_id")
    lead = db.query(SalesLeadModel).filter_by(id=lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Validate token matches what is stored in DB
    stored_token = getattr(lead, 'tour_token', None)
    if stored_token != token:
        raise HTTPException(status_code=403, detail="Token mismatch")

    # Parse recommended zones
    zones = []
    try:
        zones_raw = getattr(lead, 'recommended_zones', '[]') or '[]'
        zones = json.loads(zones_raw)
    except Exception:
        zones = []

    # If no zones are specified, default to basic visitor zones
    if not zones:
        zones = ["Z-07", "Z-WEB"]

    # Generate custom JWT token containing the allowed_zones
    from app.routers.auth import create_access_token
    access_token = create_access_token(
        data={
            "sub": f"visitor_{lead.id}",
            "role": "VISITOR",
            "name": lead.lead_name or "Guest Visitor",
            "allowed_zones": zones
        }
    )

    logger.info(f"🔑 DYNAMIC TOUR SESSION STARTED: lead #{lead.id} ({lead.lead_name}) | Allowed Zones: {zones}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": "VISITOR",
        "name": lead.lead_name or "Guest Visitor",
        "allowed_zones": zones
    }

