"""
============================================================
MIRACLE OS — VISITOR OTP ENGINE (Z-LOGIN)
============================================================
Handles:
  - Visitor lead capture (Name, Enterprise, Employee Count, Phone)
  - Phone number validation (basic format)
  - 6-digit OTP generation (auto-destroys after 2 hours)
  - Deduplication: same phone = returning client, no new lead row
  - WhatsApp delivery stub (logs OTP; replace with real API)
  - OTP verification → returns visitor credentials
============================================================
"""
import random
import string
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, Base

logger = logging.getLogger("MasterOS")
router = APIRouter()

# ──────────────────────────────────────────────────────────────
# MODELS
# ──────────────────────────────────────────────────────────────
class VisitorOTPRecord(Base):
    """Auto-managed OTP store. One row per phone. Overwritten on re-request."""
    __tablename__ = "visitor_otp_store"
    __table_args__ = {"extend_existing": True}

    id         = Column(Integer, primary_key=True, autoincrement=True)
    phone      = Column(String(30), unique=True, index=True, nullable=False)
    otp_code   = Column(String(10), nullable=False)
    full_name  = Column(String(128))
    enterprise = Column(String(128))
    emp_count  = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used    = Column(Integer, default=0)  # 0=active, 1=used


class SalesLeadModel(Base):
    """The sales_leads CRM table (Z-LOGIN lead capture)."""
    __tablename__ = "sales_leads"
    __table_args__ = {"extend_existing": True}

    id               = Column(Integer, primary_key=True, autoincrement=True)
    lead_name        = Column(String(128))
    enterprise_name  = Column(String(128))
    enterprise_size  = Column(String(50))
    contact_details  = Column(String(50), unique=True)  # Phone is unique key for dedup
    status           = Column(String(20), default="NEW")
    visit_count      = Column(Integer, default=1)
    last_visited_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at            = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    business_type         = Column(String(64), nullable=True)
    recommended_zones     = Column(Text, nullable=True)       # JSON array string e.g. '["Z-07","Z-05"]'
    conversation_summary  = Column(Text, nullable=True)
    tour_token            = Column(String(128), nullable=True, unique=True)
    appointment_at        = Column(DateTime(timezone=True), nullable=True)
    source                = Column(String(32), default='WEBSITE_BOT')


# ──────────────────────────────────────────────────────────────
# DB DEPENDENCY
# ──────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ──────────────────────────────────────────────────────────────
# SCHEMAS
# ──────────────────────────────────────────────────────────────
class OTPRequestPayload(BaseModel):
    full_name: str
    enterprise_name: str
    emp_count: str
    phone: str          # Full international format e.g. "+8801711477509"
    country_code: str   # e.g. "BD", "US"


class OTPVerifyPayload(BaseModel):
    phone: str
    otp_code: str


class LeadEnrichPayload(BaseModel):
    lead_id: int
    business_type: Optional[str] = None
    recommended_zones: Optional[str] = None
    conversation_summary: Optional[str] = None
    tour_token: Optional[str] = None
    source: Optional[str] = "WEBSITE_BOT"



# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────
def _generate_otp() -> str:
    """6-digit random OTP."""
    return "".join(random.choices(string.digits, k=6))


def _sanitize_phone(raw: str) -> str:
    """Strip spaces and dashes, keep + prefix."""
    cleaned = raw.strip().replace(" ", "").replace("-", "")
    if not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    return cleaned


def _validate_phone_format(phone: str) -> bool:
    """Basic E.164 format check: + followed by 7-15 digits."""
    if not phone.startswith("+"):
        return False
    digits = phone[1:]
    return digits.isdigit() and 7 <= len(digits) <= 15


def _send_otp_whatsapp(phone: str, otp: str, name: str):
    """
    PRODUCTION HOOK: Replace this with your WhatsApp Business API call.
    Currently logs to console. 
    Integration options:
      - Twilio WhatsApp API
      - Meta Cloud API (Direct)
      - Your existing WA gateway at wa.me
    """
    logger.info(f"📱 [OTP DELIVERY] To: {phone} | Name: {name} | OTP: {otp} | Expires: 2hrs")
    # Example Twilio stub (uncomment and configure):
    # from twilio.rest import Client
    # client = Client(TWILIO_SID, TWILIO_TOKEN)
    # client.messages.create(
    #     from_='whatsapp:+14155238886',
    #     to=f'whatsapp:{phone}',
    #     body=f'Your Miracle OS visitor code is: {otp}. Valid for 2 hours.'
    # )


# ──────────────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────────────

@router.post("/visitor/request-otp")
async def request_visitor_otp(payload: OTPRequestPayload, db: Session = Depends(get_db)):
    """
    Step 1: Visitor fills the form → system validates phone format,
    generates OTP, logs lead (deduplicates by phone), sends OTP via WhatsApp.
    """
    phone = _sanitize_phone(payload.phone)

    # ── PHONE VALIDATION ────────────────────────────────────
    if not _validate_phone_format(phone):
        raise HTTPException(
            status_code=422,
            detail="INVALID_FORMAT: Please provide a valid international phone number (e.g. +8801711477509)."
        )

    # ══════════════════════════════════════════════════════════
    # MIRACLE OS — GLOBAL SMART PHONE VALIDATOR (FREE, 25 COUNTRIES)
    # Covers: Hospitality & Real Estate Markets
    # Zero API cost. Uses official ITU E.164 rules per country.
    # ══════════════════════════════════════════════════════════
    
    # Each entry: (dial_prefix, min_total_length, max_total_length, valid_mobile_prefixes or None)
    # Length = total digits including country code (no +)
    COUNTRY_RULES = {
        # ── SOUTH ASIA ──────────────────────────────────────
        "BD":  ("+880",  13, 13, ["+88013","+88014","+88015","+88016","+88017","+88018","+88019"]),
        "LK":  ("+94",   11, 11, ["+947"]),          # Sri Lanka: +94 7x-xxxxxxx
        "PK":  ("+92",   12, 12, ["+923"]),           # Pakistan: +92 3xx-xxxxxxx
        "IN":  ("+91",   12, 12, ["+917","+918","+919"]),  # India
        "MV":  ("+960",  11, 12, None),               # Maldives: 7 or 9 digits
        
        # ── MIDDLE EAST / GULF ───────────────────────────────
        "AE":  ("+971",  12, 12, ["+9715"]),          # UAE/Dubai: +971 5x-xxxxxxx
        "SA":  ("+966",  12, 12, ["+9665"]),          # KSA: +966 5x-xxxxxxx
        "QA":  ("+974",  11, 11, ["+9743","+9745","+9746","+9747","+9746","+9747","+9748"]),  # Qatar
        "BH":  ("+973",  11, 11, ["+9733","+9736","+9739"]),   # Bahrain
        "KW":  ("+965",  11, 11, ["+9655","+9656","+9657","+9659","+9650"]),  # Kuwait
        "OM":  ("+968",  11, 11, ["+9689","+9687"]),  # Oman
        
        # ── SOUTH EAST ASIA ──────────────────────────────────
        "SG":  ("+65",   10, 10, ["+658","+659"]),    # Singapore: +65 8/9-xxxxxxx
        "MY":  ("+60",   11, 12, ["+601"]),           # Malaysia: +60 1x-xxxxxxxx
        "TH":  ("+66",   11, 11, ["+668","+669"]),    # Thailand: +66 8/9-xxxxxxxx
        "ID":  ("+62",   11, 13, ["+628"]),           # Indonesia: +62 8xx-xxxxxxx
        
        # ── EAST ASIA ────────────────────────────────────────
        "CN":  ("+86",   13, 13, ["+861"]),           # China: +86 1xx-xxxxxxxx
        "JP":  ("+81",   12, 12, ["+817","+818","+819","+8170","+8180","+8190"]),  # Japan
        "KR":  ("+82",   11, 12, ["+821"]),           # South Korea: +82 10-xxxxxxxx
        
        # ── EUROPE ───────────────────────────────────────────
        "GB":  ("+44",   12, 12, ["+447"]),           # UK/London: +44 7xxx-xxxxxx
        "FR":  ("+33",   11, 11, ["+336","+337"]),    # France: +33 6/7-xxxxxxxx
        "DE":  ("+49",   12, 13, ["+491"]),           # Germany: +49 1xx-xxxxxxx
        "IT":  ("+39",   12, 13, ["+393"]),           # Italy: +39 3xx-xxxxxxx
        "ES":  ("+34",   11, 11, ["+346","+347"]),    # Spain: +34 6/7-xxxxxxxx
        
        # ── AMERICAS / OCEANIA ────────────────────────────────
        "US":  ("+1",    11, 11, None),               # USA/Canada: +1 xxx-xxx-xxxx
        "AU":  ("+61",   11, 11, ["+614"]),           # Australia: +61 4xx-xxx-xxx
    }

    # ── STEP 1: Find matching country rule ──────────────────
    matched_rule = COUNTRY_RULES.get(payload.country_code)
    
    if matched_rule:
        dial_prefix, min_len, max_len, mobile_prefixes = matched_rule
        
        # Check country code prefix matches
        if not phone.startswith(dial_prefix):
            raise HTTPException(
                status_code=422,
                detail=f"COUNTRY_MISMATCH: Phone number doesn't match the selected country ({payload.country_code})."
            )
        
        # Check total length (count digits after + sign)
        total_digits = len(phone.replace("+", ""))
        if not (min_len <= total_digits <= max_len):
            dial_digits = len(dial_prefix.replace("+", ""))
            req_min = min_len - dial_digits
            req_max = max_len - dial_digits
            raise HTTPException(
                status_code=422,
                detail=f"INVALID_LENGTH: The number you entered has {total_digits - dial_digits} digits but {payload.country_code} numbers require {req_min} to {req_max} digits after the country code."
            )
        
        # Check mobile-specific prefix (blocks landlines and VoIP)
        if mobile_prefixes:
            is_mobile = any(phone.startswith(p) for p in mobile_prefixes)
            if not is_mobile:
                raise HTTPException(
                    status_code=422,
                    detail="NOT_MOBILE: This appears to be a landline or invalid number. Please provide a mobile number."
                )
    else:
        # Country not in our supported list — fall back to basic E.164 format check
        logger.info(f"Country {payload.country_code} not in validator list. Using basic format check.")

    # ── STEP 2: Block obvious fake/sequential patterns ───────
    digits_only = phone.replace("+", "").replace("-", "")
    fake_patterns = ["12345678", "11111111", "00000000", "99999999", "98765432", "12341234"]
    if any(p in digits_only for p in fake_patterns):
        logger.warning(f"🚫 SEQUENTIAL FAKE BLOCKED: {phone}")
        raise HTTPException(
            status_code=422,
            detail="FAKE_NUMBER: This number appears to be fake or test data. Please enter your real contact number."
        )

    # ── OTP GENERATION ──────────────────────────────────────
    otp = _generate_otp()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=2)

    # ── UPSERT OTP RECORD ───────────────────────────────────
    existing_otp = db.query(VisitorOTPRecord).filter_by(phone=phone).first()
    if existing_otp:
        existing_otp.otp_code   = otp
        existing_otp.full_name  = payload.full_name
        existing_otp.enterprise = payload.enterprise_name
        existing_otp.emp_count  = payload.emp_count
        existing_otp.created_at = now
        existing_otp.expires_at = expires
        existing_otp.is_used    = 0
    else:
        new_otp = VisitorOTPRecord(
            phone=phone, otp_code=otp,
            full_name=payload.full_name,
            enterprise=payload.enterprise_name,
            emp_count=payload.emp_count,
            expires_at=expires
        )
        db.add(new_otp)

    # ── LEAD CRM: UPSERT (no duplicate by phone) ────────────
    is_returning = False
    existing_lead = db.query(SalesLeadModel).filter_by(contact_details=phone).first()
    if existing_lead:
        # Returning client — update visit count and timestamp, don't duplicate
        existing_lead.visit_count      += 1
        existing_lead.last_visited_at  = now
        existing_lead.lead_name        = payload.full_name  # Update name if changed
        existing_lead.enterprise_name  = payload.enterprise_name
        existing_lead.enterprise_size  = payload.emp_count
        existing_lead.status           = "RETURNING"
        is_returning = True
        logger.info(f"♻️  RETURNING LEAD: {phone} | Visit #{existing_lead.visit_count}")
    else:
        new_lead = SalesLeadModel(
            lead_name       = payload.full_name,
            enterprise_name = payload.enterprise_name,
            enterprise_size = payload.emp_count,
            contact_details = phone,
            status          = "NEW"
        )
        db.add(new_lead)
        logger.info(f"🆕 NEW LEAD CAPTURED: {payload.full_name} | {phone}")

    db.commit()
    lead_id = existing_lead.id if is_returning else new_lead.id

    # ── DELIVER OTP ─────────────────────────────────────────
    _send_otp_whatsapp(phone, otp, payload.full_name)

    return {
        "status": "OTP_SENT",
        "message": f"Verification code sent to {phone}. Valid for 2 hours.",
        "is_returning_client": is_returning,
        "expires_at": expires.isoformat(),
        "lead_id": lead_id,
        # SECURITY: Never return the OTP in the response in production.
        # Only for dev/demo purposes — remove before go-live:
        "_dev_otp": otp if True else None  # Set to False in production
    }


@router.post("/visitor/verify-otp")
async def verify_visitor_otp(payload: OTPVerifyPayload, db: Session = Depends(get_db)):
    """
    Step 2: Visitor enters OTP → system validates, returns visitor credentials.
    OTP is single-use and expires after 2 hours.
    """
    phone = _sanitize_phone(payload.phone)
    now = datetime.now(timezone.utc)

    record = db.query(VisitorOTPRecord).filter_by(phone=phone).first()

    if not record:
        raise HTTPException(status_code=404, detail="NO_OTP_FOUND: Request a new code first.")

    if record.is_used:
        raise HTTPException(status_code=410, detail="OTP_USED: This code has already been consumed. Request a new one.")

    # Compare expires_at (ensure timezone-aware comparison)
    expires = record.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if now > expires:
        raise HTTPException(
            status_code=410,
            detail="OTP_EXPIRED: This code expired after 2 hours. Please request a new one."
        )

    if record.otp_code != payload.otp_code.strip():
        raise HTTPException(status_code=401, detail="OTP_INVALID: Incorrect code. Please try again.")

    # ── MARK AS USED (destroy OTP) ───────────────────────────
    record.is_used = 1
    db.commit()

    logger.info(f"✅ VISITOR OTP VERIFIED: {phone} | {record.full_name}")

    # ── RETURN VISITOR CREDENTIALS ───────────────────────────
    return {
        "status": "ACCESS_GRANTED",
        "visitor_id": "VISITOR",
        "access_key": "Miracle4U",
        "role": "VISITOR",
        "full_name": record.full_name,
        "enterprise": record.enterprise,
        "message": "Welcome to Miracle HMS. Your session is active."
    }


@router.post("/visitor/send-wa-otp")
async def send_wa_otp(payload: dict):
    """
    Calls the local Node.js WhatsApp Gateway (Method B).
    """
    import httpx
    phone = payload.get("phone")
    otp = payload.get("otp")
    name = payload.get("name")
    
    msg = f"Hello {name}! Your Miracle HMS access code is: {otp}. Valid for 2 hours."
    
    try:
        async with httpx.AsyncClient() as client:
            # Call the local Node.js gateway on port 9001
            await client.post("http://localhost:9001/send-otp", json={
                "phone": phone,
                "message": msg
            })
        return {"status": "SUCCESS"}
    except Exception as e:
        logger.error(f"WhatsApp Gateway error: {e}")
        return {"status": "FAILED", "error": str(e)}


@router.get("/visitor/leads")
async def get_all_leads(db: Session = Depends(get_db)):
    """CDO endpoint: view all captured visitor leads from the CRM."""
    leads = db.query(SalesLeadModel).order_by(SalesLeadModel.created_at.desc()).all()
    return {
        "status": "SUCCESS",
        "total": len(leads),
        "leads": [
            {
                "id": l.id,
                "lead_name": l.lead_name,
                "enterprise_name": l.enterprise_name,
                "enterprise_size": l.enterprise_size,
                "contact_details": l.contact_details,
                "status": l.status,
                "visit_count": l.visit_count,
                "created_at": str(l.created_at),
                "last_visited_at": str(l.last_visited_at),
            }
            for l in leads
        ]
    }


@router.post("/visitor/enrich-lead")
async def enrich_visitor_lead(payload: LeadEnrichPayload, db: Session = Depends(get_db)):
    """
    Enriches a captured sales lead with business type, recommended zones,
    summary, and a signed tour token. Called by vigilantitsolution.com.
    """
    lead = db.query(SalesLeadModel).filter_by(id=payload.lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if payload.business_type is not None:
        lead.business_type = payload.business_type
    if payload.recommended_zones is not None:
        lead.recommended_zones = payload.recommended_zones
    if payload.conversation_summary is not None:
        lead.conversation_summary = payload.conversation_summary
    if payload.tour_token is not None:
        lead.tour_token = payload.tour_token
    if payload.source is not None:
        lead.source = payload.source
        
    db.commit()
    logger.info(f"💾 LEAD ENRICHED: #{lead.id} | Business: {lead.business_type} | Zones: {lead.recommended_zones}")
    return {"status": "SUCCESS", "message": "Lead enriched successfully."}
