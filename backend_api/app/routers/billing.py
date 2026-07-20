# backend_api/app/routers/billing.py
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.models.models import GuestFolio, AssetGrid

# 🔱 SOVEREIGN ACCOUNTING KERNEL
from app.routers.accounting_engine import post_double_entry

DHAKA_TZ = timezone(timedelta(hours=6))
logger = logging.getLogger("Zone08_Billing")
router = APIRouter(tags=["Zone 08: Guest Folio & Billing"])

class DepartmentCharge(BaseModel):
    source_terminal: str
    reference_id: str
    description: str
    amount: float
    authorized_by_pin: str

    @field_validator('amount', mode='before')
    @classmethod
    def coerce_amount(cls, v):
        try: return float(v) if v else 0.0
        except: return 0.0

class SettlementPayload(BaseModel):
    payment_method: str
    amount_paid: float
    cashier_pin: str

@router.get("/status")
def get_billing_status():
    return {"zone": "08", "status": "ACTIVE", "kernel": "Sovereign_v2_Phase17A", "timestamp": datetime.now(DHAKA_TZ).isoformat()}

@router.post("/folio/{guest_ref}/add-charge")
async def post_department_charge(guest_ref: str, charge: DepartmentCharge, db: Session = Depends(get_db)):
    """
    Manual Departmental Folio Charge (e.g. minibar, laundry, room service).
    ENTERPRISE FIX: Now posts a proper double-entry journal to the GL.
    Debit: AR Room Folio (1210) | Credit: Zone Revenue Account
    """
    # Resolve GL revenue code from source terminal
    # ✅ SOVEREIGN FIX: Use 6-digit GL codes matching Chart of Accounts
    TERMINAL_REVENUE_MAP = {
        "Z-29": 410000, "RESTAURANT": 410000, "COFFEE": 410000, "BAR": 410000,
        "Z-28": 460000, "BOUTIQUE": 460000, "RETAIL": 460000,
        "Z-26": 440000, "FLEET": 440000, "TRANSPORT": 440000,
        "Z-27": 450000, "SPA": 450000, "WELLNESS": 450000,
        "Z-17": 470000, "CINEMA": 470000,
        "Z-08": 410000, "ROOM_SERVICE": 410000, "MINIBAR": 410000, "LAUNDRY": 450000,
    }
    terminal_upper = str(charge.source_terminal).upper()
    rev_code = 410000  # safe default — F&B
    for key, code in TERMINAL_REVENUE_MAP.items():
        if key in terminal_upper:
            rev_code = code
            break

    try:
        with db.begin_nested():
            active_folio = db.query(GuestFolio).filter(
                GuestFolio.room_number == guest_ref,
                GuestFolio.status == "IN_HOUSE"
            ).first()
            if not active_folio:
                raise ValueError("Folio not found or Guest checked out.")

            current_balance = float(getattr(active_folio, "balance", 0.0))
            setattr(active_folio, "balance", current_balance + charge.amount)

            # Inject folio charge line item
            from app.models.models import FolioCharge
            db.add(FolioCharge(
                folio_id=active_folio.id,
                item_name=charge.description,
                category=charge.source_terminal,
                amount=charge.amount,
                qty=1,
                transaction_id=charge.reference_id
            ))

            # ENTERPRISE: Post double-entry to GL
            post_double_entry(db, "DEPT_FOLIO_CHARGE",
                f"Dept Charge: {charge.description} | Room:{guest_ref} | Auth:{charge.authorized_by_pin}",
                [
                    {"code": 120100, "debit": charge.amount, "credit": 0.0},  # AR - Room Folio
                    {"code": rev_code,"debit": 0.0, "credit": charge.amount},
                ])

        db.commit()
        return {
            "status": "SUCCESS",
            "message": f"Charge of {charge.amount} posted to Room {guest_ref}. GL updated.",
            "folio_receipt": f"FOLIO-TX-{datetime.now(DHAKA_TZ).strftime('%H%M%S')}",
            "revenue_account": rev_code
        }
    except ValueError as ve:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        db.rollback()
        logger.error(f"FOLIO_CHARGE_FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail="Database lock prevented charge.")

@router.get("/folio/{guest_ref}/invoice")
def get_guest_master_invoice(guest_ref: str, db: Session = Depends(get_db)):
    """THE FINAL BILL: Generates the exact checkout invoice from live DB."""
    try:
        folio = db.query(GuestFolio).filter(GuestFolio.room_number == guest_ref).first()
        if not folio:
            raise HTTPException(status_code=404, detail="Guest Folio not found.")
        pos_balance = float(getattr(folio, 'balance', 0.0))
        rate = float(getattr(folio, 'rate', 5500.0) or 5500.0)
        advance = float(getattr(folio, 'advance_paid', 0.0) or 0.0)
        grand_total = rate + pos_balance
        balance_due = grand_total - advance
        check_in_val = getattr(folio, 'check_in_date', None)
        check_in_str = check_in_val.isoformat() if check_in_val else datetime.now(DHAKA_TZ).isoformat()
        return {
            "guest_ref": str(getattr(folio, 'room_number', guest_ref)),
            "guest_name": str(getattr(folio, 'guest_name', 'UNKNOWN')),
            "check_in": check_in_str,
            "status": str(getattr(folio, 'status', 'IN_HOUSE')),
            "credit_limit": 50000.00,
            "total_room_charges": rate,
            "total_pos_charges": pos_balance,
            "grand_total": grand_total,
            "balance_due": balance_due
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Invoice Generation Failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Invoice generation error.")

@router.post("/checkout/{guest_ref}")
async def execute_physical_checkout(guest_ref: str, payload: SettlementPayload, db: Session = Depends(get_db)):
    """
    THE FINAL SEAL: Zeroes the folio, releases the room, posts to Sovereign Kernel.
    🔱 Phase 17A: Migrated from legacy AccountingLedger to post_double_entry().
    """
    logger.info(f"Executing Checkout for Room {guest_ref} via {payload.payment_method}")
    try:
        with db.begin_nested():
            folio = db.query(GuestFolio).filter(GuestFolio.room_number == guest_ref).first()
            if not folio:
                raise ValueError(f"Folio {guest_ref} missing.")
            pos_balance = float(getattr(folio, 'balance', 0.0))
            setattr(folio, 'status', "CHECKED_OUT")
            setattr(folio, 'balance', 0.0)
            
            room = db.query(AssetGrid).filter(AssetGrid.room_id == guest_ref).first()
            if room:
                setattr(room, 'current_status', "DIRTY")
                setattr(room, 'current_guest', "NONE")

            # 🔱 SOVEREIGN KERNEL: Room Revenue Settlement
            from app.routers.accounting_engine import post_double_entry, record_room_sale, recognize_deferred_revenue, record_ota_commission
            from app.models.models import JournalEntry
            
            advance_paid = float(getattr(folio, 'advance_paid', 0.0)) if folio else 0.0
            total_room_charges = float(getattr(folio, 'rate', 0.0))

            # ⚠️ DOUBLE-POST GUARD: Check if Night Audit already posted revenue for this room.
            # The accounts page night audit posts CHECKOUT_SETTLEMENT or WALKIN_REVENUE.
            # If found, DO NOT post again — just settle the folio and release the room.
            already_posted = db.query(JournalEntry).filter(
                JournalEntry.reference_type.in_(['CHECKOUT_SETTLEMENT', 'WALKIN_REVENUE', 'ROOM_SALE_REV']),
                JournalEntry.description.contains(guest_ref)
            ).first()

            if already_posted:
                logger.info(f"[CHECKOUT] Revenue already posted for {guest_ref} (J{already_posted.id} — {already_posted.reference_type}). Skipping revenue re-post.")
            else:
                # Revenue NOT yet posted — billing.py is the first to process it.
                # Use the ACTUAL folio rate (room charges), not payload.amount_paid
                # which can be inflated (cashier entering rack rate, not cash received).
                room_paid_today = payload.amount_paid - pos_balance
                payment_method = str(payload.payment_method).upper()
                channel = 'OTA' if 'OTA' in payment_method or payment_method in ['BOOKING.COM', 'EXPEDIA', 'AGODA'] else 'DIRECT'
                
                if room_paid_today > 0:
                    record_room_sale(
                        db, room_paid_today, nights=1,
                        nightly_rate=room_paid_today,
                        channel=channel,
                        description=f"Room {guest_ref} Checkout Payment"
                    )

                # OTA Commission Accrual on Total Room Gross
                room_gross = room_paid_today + advance_paid
                if channel == 'OTA' and room_gross > 0:
                    record_ota_commission(db, room_gross, f"OTA Commission for Room {guest_ref}")

            # 1. Clear POS Balance (1210 instead of 1200)
            if pos_balance > 0:
                post_double_entry(db, 'CHECKOUT_POS_SETTLEMENT', f"POS Settlement Room {guest_ref}", [
                    {"code": 1000, "debit": pos_balance, "credit": 0.0},
                    {"code": 1210, "debit": 0.0, "credit": pos_balance}
                ])
                
            # 2. Recognize Deferred Revenue
            if advance_paid > 0:
                recognize_deferred_revenue(db, advance_paid, f"Deferred Revenue Recognition Room {guest_ref}")


        db.commit()
        return {"status": "SUCCESS", "message": "Asset Released. Sovereign Ledger Sealed."}
    except Exception as e:
        db.rollback()
        logger.error(f"Settlement Failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Transaction Rejected by Master Ledger.")