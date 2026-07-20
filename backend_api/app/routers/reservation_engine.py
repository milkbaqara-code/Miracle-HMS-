import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session

# KERNEL SYNC: Direct alignment with Master Blueprint
from app.core.database import get_db
from app.models.models import Reservation, GuestCRM

# ENTERPRISE TELEMETRY
logger = logging.getLogger("Zone05_Reservation_Engine")
router = APIRouter(tags=["ZONE 05: Sovereign OTA Channels"])

# ==========================================
# 1. THE OTA CHANNEL MANAGER ENGINE
# ==========================================
@router.post("/ota-ingest")
async def process_ota_ingest(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    TRIPLE GENESIS PROTOCOL: OTA INGESTION
    Automatically binds any OTA channel data to the Sovereign GuestCRM Vault.
    Expected dict: source, guest_name, contact, dates, nights, room, rate
    """
    try:
        source = payload.get("source", "DIRECT")
        guest_name = payload.get("guest_name", "UNKNOWN GUEST").upper()
        contact = payload.get("contact", "")
        dates = payload.get("dates", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        nights = payload.get("nights", 1)
        room = payload.get("room_type", payload.get("room", "TBD"))
        rate = payload.get("rate", 0.0)

        with db.begin_nested():
            # 1. CRM OMNI-CHANNEL LOOKUP
            crm_guest = None
            if contact:
                crm_guest = db.query(GuestCRM).filter((GuestCRM.phone == contact) | (GuestCRM.email == contact)).first()
            if not crm_guest:
                crm_guest = db.query(GuestCRM).filter(GuestCRM.full_name == guest_name).first()

            # 2. CREATE IF GHOST
            if not crm_guest:
                crm_guest = GuestCRM(
                    full_name=guest_name,
                    phone=contact if "@" not in contact else None,
                    email=contact if "@" in contact else None,
                    preferences=[f"Source: {source}"]
                )
                db.add(crm_guest)
                db.flush()

            # 3. GENERATE RESERVATION PAYLOAD LINKED TO CRM
            import random
            new_id = f"RES-{source[:3]}-{random.randint(1000, 9999)}"
            
            # 🛡️ SOVEREIGN DATE CONVERSION
            try:
                res_date = datetime.strptime(dates[:10], "%Y-%m-%d")
            except:
                res_date = datetime.now()

            new_res = Reservation(
                id=new_id,
                room_id=room,
                guest_crm_id=crm_guest.id,
                guest_name=guest_name,
                start_date=res_date,
                nights=nights,
                status="CONFIRMED",
                nightly_rate=rate,
                total_yield=rate * nights
            )
            db.add(new_res)
            
        db.commit()
        logger.info(f"✅ TRIPLE GENESIS: OTA Payload [{source}] securely bound to CRM Vault for {guest_name}.")
        return {"status": "SUCCESS", "message": "Omni-Channel Booking Locked."}
        
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 OTA_INGESTION_FAILURE: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to map OTA payload to Sovereign Vault.")
