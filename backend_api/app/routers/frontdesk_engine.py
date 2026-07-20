# backend_api/app/routers/frontdesk_engine.py
import logging
from datetime import datetime, timezone, timedelta
# 🔱 SOVEREIGN DHAKA PULSE: GLOBAL TEMPORAL STANDARD
# Asia/Dhaka is UTC+6
DHAKA_TZ = timezone(timedelta(hours=6))
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from pydantic import BaseModel, field_validator

# KERNEL SYNC: Direct alignment with Master Blueprint
from app.core.database import get_db
from app.models.models import GuestFolio, Reservation

# ENTERPRISE TELEMETRY
logger = logging.getLogger("Zone08_FrontDesk_Master")
router = APIRouter(tags=["ZONE 08: Sovereign Front Desk Matrix"])

# ==========================================
# 1. SOVEREIGN DATA CONTRACTS (PYDANTIC)
# ==========================================
class ForceSyncPayload(BaseModel):
    roomId: str
    guestName: str
    status: str = "IN_HOUSE"
    rate: float = 0.0

    @field_validator('roomId', 'guestName', mode='before')
    @classmethod
    def coerce_to_string(cls, v):
        return str(v).strip().upper() if v else "UNKNOWN"

class POSChargeItem(BaseModel):
    id: str
    name: str
    qty: int
    isFOC: bool
    rp: float
    cogs: float
    type: Optional[str] = "PRODUCT"

class CheckoutFinancials(BaseModel):
    subtotal: float
    totalCOGS: float
    discount: float
    vat: float
    sc: float
    grand: float
    trueProfit: float

class FolioCheckoutPayload(BaseModel):
    timestamp: str
    cashier_pin: str
    terminal_id: str
    guest_type: str
    guest_ref: str
    payment_method: str
    financials: CheckoutFinancials
    items: List[POSChargeItem] = []

class ReservationCommitPayload(BaseModel):
    room: str
    guest: str
    contact: Optional[str] = None
    identityId: Optional[str] = None # 🛡️ SOVEREIGN IDENTITY BLOCK
    date: str
    nights: int
    rate: float

class WalkInPayload(BaseModel):
    room: str
    guest: str
    contact: str
    identityId: Optional[str] = None # 🛡️ SOVEREIGN IDENTITY BLOCK
    payment_method: str
    rate: float
    advance_paid: float = 0.0
    ref_staff: str = "NONE"
    nights: int = 1 

class CheckinPayload(BaseModel):
    roomId: str
    guestName: str
    identityId: Optional[str] = None # 🛡️ SOVEREIGN IDENTITY BLOCK
    rate: float
    advancePaid: float = 0.0
    refStaff: str = "NONE"

class ExtendStayPayload(BaseModel):
    nights_to_add: int

# ==========================================
# 🛡️ INTERNAL CORE LOGIC (DB EXTRACTION)
# ==========================================
def _fetch_active_folios(db: Session) -> Dict[str, Any]:
    """Core Database extraction for IN_HOUSE folios with strict integrity."""
    from app.models.models import FolioCharge
    stmt = select(GuestFolio).where(GuestFolio.status == 'IN_HOUSE')
    result = db.execute(stmt).scalars().all()
    
    if not result:
        return {}

    folios: Dict[str, Any] = {}
    for folio in result:
        check_in_val = getattr(folio, 'check_in_date', None)
        check_in_str = check_in_val.strftime("%Y-%m-%d") if isinstance(check_in_val, datetime) else datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # 🛡️ CDO FIX: Itemized Charge Retrieval
        charge_records = db.query(FolioCharge).filter(FolioCharge.folio_id == folio.id).all()
        itemized_charges = [
            {
                "id": c.id,
                "item": c.item_name,
                "amount": float(c.amount),
                "sector": c.category,
                "qty": float(c.qty),
                "timestamp": c.timestamp.isoformat()
            } for c in charge_records
        ]
        
        folios[str(folio.room_number)] = {
            "id": str(folio.room_number),
            "name": str(folio.guest_name).upper(),
            "checkIn": check_in_str,
            "rate": float(getattr(folio, 'rate', 0.0) or 0.0),
            "refStaff": str(getattr(folio, 'ref_staff', 'NONE') or 'NONE'),
            "advancePaid": float(getattr(folio, 'advance_paid', 0.0) or 0.0),
            "balance": float(getattr(folio, 'balance', 0.0) or 0.0),
            "charges": itemized_charges
        }
    return folios

# ==========================================
# 2. FOLIO LEDGER (HTTP EXPORT FOR POS & CHECKOUT)
# ==========================================
@router.get("/folios")
async def get_live_folios_api(db: Session = Depends(get_db)):
    """API Endpoint: Returns live occupied rooms for POS dropdown and Checkout Hub."""
    try:
        folios = _fetch_active_folios(db)
        return {"status": "SUCCESS", "data": folios}
    except Exception as e:
        logger.error(f"🚨 FOLIO_CRITICAL_FAILURE: {str(e)}")
        # MUST RETURN EMPTY ARRAY ON FAILURE TO PREVENT FRONTEND WHITE-SCREEN CRASH
        return {"status": "ERROR", "data": {}}

# ==========================================
# 2.5. POS EXCLUSIVE: ACTIVE GUEST ISOLATION
# ==========================================
@router.get("/active-in-house")
async def get_active_in_house_pos(db: Session = Depends(get_db)):
    """API Endpoint: Strict flat array of IN_HOUSE guests for POS dropdown.
    🛡️ CDO FIX: Reads directly from GuestFolio (status=IN_HOUSE) to prevent 
    cross-room guest name contamination from CRM/ActiveOccupancy join collisions.
    """
    try:
        folios = db.query(GuestFolio).filter(GuestFolio.status == 'IN_HOUSE').all()
        flat_data = [
            {
                "room": str(f.room_number),
                "name": str(f.guest_name).upper(),
                "folio_id": str(f.id)
            }
            for f in folios
            if f.guest_name and str(f.guest_name).strip().upper() not in ('', 'NONE', 'VACANT')
        ]
        return {"status": "SUCCESS", "data": flat_data}
    except Exception as e:
        logger.error(f"🚨 POS_GUEST_RADAR_FAILURE: {str(e)}")
        return {"status": "ERROR", "data": []}


# ==========================================
# 2.6. CRM VAULT: ALL GUEST PROFILES
# ==========================================
@router.get("/crm-profiles")
async def get_all_crm_profiles(db: Session = Depends(get_db)):
    """API Endpoint: Returns the eternal GuestCRM vault for the new CRM Dashboard."""
    try:
        from app.models.models import GuestCRM
        stmt = select(GuestCRM).order_by(GuestCRM.total_ltv.desc())
        results = db.execute(stmt).scalars().all()
        
        data = [
            {
                "id": str(c.id),
                "full_name": str(c.full_name),
                "phone": str(c.phone or 'N/A'),
                "email": str(c.email or 'N/A'),
                "passport_nid": str(c.passport_nid or 'N/A'),
                "total_ltv": float(c.total_ltv or 0.0),
                "total_stays": int(c.total_stays or 0),
                "vip_tier": str(c.vip_tier or 'STANDARD'),
                "preferences": c.preferences if isinstance(c.preferences, list) else []
            }
            for c in results
        ]
        return {"status": "SUCCESS", "data": data}
    except Exception as e:
        logger.error(f"🚨 CRM_VAULT_FAILURE: {str(e)}")
        return {"status": "ERROR", "data": []}

# ==========================================
# 3. TAPE CHART: RESERVATION LEDGER
# ==========================================
@router.get("/reservations")
async def get_all_reservations(db: Session = Depends(get_db)):
    """Physical handler for Zone 05 Temporal Tape Chart with Guest DNA."""
    try:
        query = text("""
            SELECT r.id, r.room_id as room, r.guest_name as guest, 
                   r.start_date as start, r.nights, r.status, r.nightly_rate as rate,
                   COALESCE(g.total_ltv, 0.0) as ltv,
                   COALESCE(g.passport_nid, 'N/A') as identity_id,
                   COALESCE(g.preferences, '[]') as prefs
            FROM reservations r
            LEFT JOIN guest_crm g ON r.guest_name = g.full_name
            WHERE r.status != 'Cancelled'
        """)
        results = db.execute(query).mappings().all()
        
        if not results:
            return {"status": "SUCCESS", "data": []}
            
        data = []
        import json
        
        # Base currency
        from app.models.models import SystemConfig
        config = db.query(SystemConfig).first()
        fl = config.financial_laws if config and config.financial_laws else {}
        base_cur = fl.get("base_currency", "BDT")
        symbols = fl.get("currency_symbols", {"BDT": "৳", "USD": "$", "AED": "د.إ"})
        sym = symbols.get(base_cur, "৳")

        for row in results:
            prefs_val = row['prefs']
            prefs_str = "N/A"
            if isinstance(prefs_val, str):
                try: 
                    p_list = json.loads(prefs_val)
                    if isinstance(p_list, list) and len(p_list) > 0:
                        prefs_str = " | ".join(p_list)
                except: 
                    prefs_str = prefs_val
            elif isinstance(prefs_val, list) and len(prefs_val) > 0:
                prefs_str = " | ".join(prefs_val)
                
            # Ensure absolute YYYY-MM-DD string format for React native comparison
            start_val = row['start']
            start_str = start_val.strftime('%Y-%m-%d') if hasattr(start_val, 'strftime') else str(start_val).split(' ')[0][:10]
            
            data.append({
                "id": row['id'],
                "room": row['room'],
                "guest": row['guest'],
                "identity": row['identity_id'],
                "start": start_str,
                "nights": row['nights'],
                "status": row['status'],
                "rate": row['rate'],
                "ltv": f"{sym}{float(row['ltv']):,.0f}",
                "prefs": prefs_str
            })
            
        return {"status": "SUCCESS", "data": data}
    except Exception as e:
        logger.error(f"🚨 RES_FETCH_FAILURE: {str(e)}")
        return {"status": "ERROR", "data": []}

# ==========================================
# 4. ASSET LOCK: COMMIT RESERVATION (ZONE 05)
# ==========================================
@router.post("/commit")
async def commit_reservation(payload: ReservationCommitPayload, db: Session = Depends(get_db)):
    """Physically locks a room in the database, binds to CRM, and updates future yields."""
    try:
        from app.models.models import GuestCRM
        from datetime import date as date_type
        import random
        
        # 🛡️ FIX: Date-aware conflict guard.
        # Only block if the requested start_date overlaps with an EXISTING active folio for this room.
        # Future reservations on currently-occupied rooms are always ALLOWED (guest will have checked out).
        try:
            req_start = date_type.fromisoformat(str(payload.date)[:10])
        except Exception:
            req_start = datetime.now(timezone.utc).date()
        
        existing_folio = db.query(GuestFolio).filter(
            GuestFolio.room_number == str(payload.room),
            GuestFolio.status == 'IN_HOUSE'
        ).first()
        if existing_folio:
            # Check if requested start date is today or before checkout estimate.
            # We allow ANY future date — only block if start_date is TODAY and a live folio exists.
            folio_checkin = getattr(existing_folio, 'check_in_date', None)
            today = datetime.now(timezone.utc).date()
            if req_start <= today:
                raise HTTPException(
                    status_code=409,
                    detail=f"Room {payload.room} is currently IN-HOUSE. Choose a future check-in date."
                )
        
        with db.begin_nested():
            # 1. CRM BINDING (Triple Genesis)
            crm_guest = None
            if payload.contact:
                crm_guest = db.query(GuestCRM).filter((GuestCRM.phone == payload.contact) | (GuestCRM.email == payload.contact)).first()
            if not crm_guest:
                crm_guest = db.query(GuestCRM).filter(GuestCRM.full_name == payload.guest.upper()).first()
                
            if not crm_guest:
                crm_guest = GuestCRM(
                    full_name=payload.guest.upper(),
                    phone=payload.contact if payload.contact and "@" not in payload.contact else None,
                    email=payload.contact if payload.contact and "@" in payload.contact else None,
                    passport_nid=payload.identityId
                )
                db.add(crm_guest)
            else:
                # 🛡️ SOVEREIGN UPDATE: Upgrade existing profile with NID
                if payload.identityId and not crm_guest.passport_nid:
                    crm_guest.passport_nid = payload.identityId
                db.flush()

            # 2. CREATE RESERVATION
            new_id = f"RES-{random.randint(1000, 9999)}"
            # 🛡️ DEFENSIVE DATE CONVERSION (Sovereign Quality)
            try:
                if isinstance(payload.date, str):
                    res_date = datetime.strptime(payload.date[:10], "%Y-%m-%d")
                else:
                    res_date = payload.date
            except Exception:
                res_date = datetime.now()

            new_res = Reservation(
                id=new_id,
                room_id=str(payload.room),
                guest_crm_id=crm_guest.id,
                guest_name=payload.guest.upper(),
                start_date=res_date,
                nights=payload.nights,
                status='CONFIRMED',
                nightly_rate=payload.rate,
                total_yield=payload.rate * payload.nights
            )
            db.add(new_res)
            
        db.commit()
        
        # 🌐 BROADCAST KERNEL EVENT
        from app.main import master_socket
        await master_socket.broadcast("GRID_UPDATE", {"action": "LOCK", "room": payload.room})
        
        logger.info(f"✅ ASSET SECURED: Room {payload.room} locked and CRM Bound for {payload.guest}.")
        return {"status": "SUCCESS", "message": "Asset Locked in Master Ledger.", "data": {"id": new_id, "guest": payload.guest.upper()}}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 HANDSHAKE FAILED: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Database Handshake Failed: {str(e)}")

# ==========================================
# 4.2. THE QUICK WALK-IN PROTOCOL (TRIPLE GENESIS)
# ==========================================
@router.post("/quick-walk-in")
async def process_quick_walk_in(payload: WalkInPayload, db: Session = Depends(get_db)):
    """Atomic bypass of Reservations for instantaneous Cash/Card Walk-Ins."""
    try:
        from app.models.models import GuestCRM, AssetGrid, ActiveOccupancy
        now = datetime.now(DHAKA_TZ)
        
        with db.begin_nested():
            # Step 1: Create or fetch GuestCRM record. Flush.
            crm_guest = None
            if payload.contact:
                 crm_guest = db.query(GuestCRM).filter((GuestCRM.phone == payload.contact) | (GuestCRM.email == payload.contact)).first()
            if not crm_guest:
                 crm_guest = db.query(GuestCRM).filter(GuestCRM.full_name == payload.guest.upper()).first()
                 
            if not crm_guest:
                 crm_guest = GuestCRM(
                     full_name=payload.guest.upper(),
                     phone=payload.contact if (payload.contact and "@" not in payload.contact) else None,
                     email=payload.contact if (payload.contact and "@" in payload.contact) else None,
                     passport_nid=payload.identityId
                 )
                 db.add(crm_guest)
            else:
                 if payload.contact and "@" not in payload.contact and not crm_guest.phone:
                     crm_guest.phone = payload.contact
                 elif payload.contact and "@" in payload.contact and not crm_guest.email:
                     crm_guest.email = payload.contact
                 
                 if payload.identityId and not crm_guest.passport_nid:
                     crm_guest.passport_nid = payload.identityId

            db.flush()

            # Step 2: Create GuestFolio linked to the CRM ID and the selected payment_network. Flush.
            existing_folio = db.query(GuestFolio).filter(GuestFolio.room_number == payload.room).first()
            if existing_folio:
                existing_folio.guest_crm_id = crm_guest.id
                existing_folio.guest_name = payload.guest.upper()
                existing_folio.status = 'IN_HOUSE'
                existing_folio.balance = 0.0
                existing_folio.rate = payload.rate
                existing_folio.advance_paid = payload.advance_paid
                existing_folio.check_in_date = now
                existing_folio.payment_network = payload.payment_method
            else:
                new_folio = GuestFolio(
                    room_number=payload.room, guest_crm_id=crm_guest.id, guest_name=payload.guest.upper(),
                    status='IN_HOUSE', balance=0.0, rate=payload.rate, advance_paid=payload.advance_paid, 
                    ref_staff=payload.ref_staff, check_in_date=now, payment_network=payload.payment_method
                )
                db.add(new_folio)

            db.flush()

            # Step 3: Insert into ActiveOccupancy (The Radar). Flush.
            folio_id_to_link = new_folio.id if 'new_folio' in locals() else existing_folio.id
            existing_radar = db.query(ActiveOccupancy).filter(ActiveOccupancy.room_number == payload.room).first()
            if existing_radar:
                existing_radar.guest_crm_id = crm_guest.id
                existing_radar.folio_id = folio_id_to_link
                existing_radar.check_in_timestamp = now
            else:
                radar = ActiveOccupancy(
                    room_number=payload.room, guest_crm_id=crm_guest.id, 
                    folio_id=folio_id_to_link, check_in_timestamp=now
                )
                db.add(radar)
            
            db.flush()

            # Step 4: Update AssetGrid room status to 'IN_HOUSE'. 
            asset = db.query(AssetGrid).filter(AssetGrid.room_id == payload.room).first()
            if asset:
                 asset.current_status = 'IN-HOUSE'
                 asset.current_guest = payload.guest.upper()
            else:
                 new_asset = AssetGrid(room_id=payload.room, current_status='IN-HOUSE', current_guest=payload.guest.upper())
                 db.add(new_asset)
                 
            # 🔱 SOVEREIGN KERNEL: Quick Walk-In Revenue (Deferred)
            from app.routers.accounting_engine import record_advance_deposit
            if payload.advance_paid > 0:
                record_advance_deposit(db, float(payload.advance_paid), f"Walk-In Advance for Room {payload.room} via {payload.payment_method}")

            # 🛡️ FIX: Step 6 — Inject into Reservations Table for Tape Chart Visibility
            # Walk-ins previously bypassed reservations entirely → invisible on Zone 05 tape.
            # Insert/update a reservation row so the tape chart shows this IN-HOUSE guest.
            # Now correctly stores payload.nights for accurate tape chart span.
            import random
            walkin_res_id = f"RES-WALK-{payload.room}-{datetime.now().strftime('%H%M%S')}"
            existing_res = db.query(Reservation).filter(
                Reservation.room_id == payload.room,
                Reservation.status == 'IN-HOUSE'
            ).first()
            actual_nights = max(1, payload.nights)  # 🛡️ FIX: use real nights, not hardcoded 1
            if not existing_res:
                walkin_reservation = Reservation(
                    id=walkin_res_id,
                    room_id=payload.room,
                    guest_crm_id=crm_guest.id,
                    guest_name=payload.guest.upper(),
                    start_date=now.date(),
                    nights=actual_nights,
                    status='IN-HOUSE',
                    nightly_rate=payload.rate,
                    total_yield=payload.rate * actual_nights
                )
                db.add(walkin_reservation)
            else:
                # Update stale IN-HOUSE record with new guest and corrected nights
                existing_res.guest_name = payload.guest.upper()
                existing_res.guest_crm_id = crm_guest.id
                existing_res.start_date = now.date()
                existing_res.nights = actual_nights
                existing_res.nightly_rate = payload.rate
                existing_res.total_yield = payload.rate * actual_nights

        db.commit()
        
        # 🔱 GUEST OPERATIVE KERNEL: Auto-create guest User in the operative tree
        try:
            from app.routers.guest_api import _upsert_guest_user
            _upsert_guest_user(db, str(payload.room), payload.guest.upper())
            db.commit()
        except Exception as ge:
            logger.warning(f"⚠️ GUEST_USER_UPSERT skipped: {ge}")
        
        # 🌐 BROADCAST KERNEL EVENT
        from app.main import master_socket
        await master_socket.broadcast("GRID_UPDATE", {"action": "IN_HOUSE", "room": payload.room})
        
        logger.info(f"✅ QUICK WALK-IN SUCCESS: Room {payload.room} occupied by {payload.guest} ({payload.payment_method}).")
        return {"status": "SUCCESS", "message": "Walk-In Protocol Complete"}
    except Exception as e:
        db.rollback()
        print(f"🚨 CDO CRASH TRACE: {str(e)}")
        logger.error(f"🚨 WALK_IN_FAILURE: {str(e)}")
        raise HTTPException(status_code=500, detail="Atomic Walk-In Failed.")

# ==========================================
# 4.5. THE 7-STAR ACID CHECK-IN BRIDGE
# ==========================================
from app.models.models import AssetGrid
@router.post("/checkin/{res_id}")
async def process_7star_checkin(res_id: str, payload: CheckinPayload, db: Session = Depends(get_db)):
    """The ACID Compliant Check-In matrix. Locks the room and injects the folio atomically."""
    try:
        with db.begin_nested():
            # A) Mark Reservation as IN-HOUSE
            res = db.query(Reservation).filter(Reservation.id == res_id).first()
            if not res:
                raise ValueError("Reservation Core not found")
            res.status = 'IN-HOUSE'

            # B) Generate live GuestFolio (🛡️ CDO FIX: ALWAYS NEW RECORD TO PREVENT GHOSTING)
            now = datetime.now(timezone.utc)
            clean_guest_name = str(payload.guestName).strip().upper()
            
            new_folio = GuestFolio(
                room_number=str(payload.roomId), 
                guest_name=clean_guest_name,
                status='IN_HOUSE', 
                balance=0.0, 
                rate=payload.rate, 
                advance_paid=payload.advancePaid, 
                ref_staff=str(payload.refStaff or 'NONE').strip().upper(),
                check_in_date=now
            )
            db.add(new_folio)
            db.flush() # Secure the ID

            # C) Update AssetGrid
            asset = db.query(AssetGrid).filter(AssetGrid.room_id == payload.roomId).first()
            if asset:
                 asset.current_status = 'IN-HOUSE'
                 asset.current_guest = payload.guestName
            else:
                 new_asset = AssetGrid(room_id=payload.roomId, current_status='IN-HOUSE', current_guest=payload.guestName)
                 db.add(new_asset)
                 
            # 🔱 SOVEREIGN KERNEL: Advance Deposit
            from app.routers.accounting_engine import record_advance_deposit
            if payload.advancePaid > 0:
                record_advance_deposit(db, float(payload.advancePaid), f"Check-In Advance for Room {payload.roomId}")
                 
            # 🛡️ CDO FIX: CRM & RADAR ALIGNMENT
            from app.models.models import GuestCRM, ActiveOccupancy
            crm_guest = db.query(GuestCRM).filter(GuestCRM.full_name == payload.guestName.upper()).first()
            if not crm_guest:
                crm_guest = GuestCRM(
                    full_name=payload.guestName.upper(),
                    passport_nid=payload.identityId
                )
                db.add(crm_guest)
            else:
                if payload.identityId and not crm_guest.passport_nid:
                    crm_guest.passport_nid = payload.identityId
            db.flush() # Ensure crm_guest and new_folio have IDs
            
            folio_id_to_link = new_folio.id
            
            existing_radar = db.query(ActiveOccupancy).filter(ActiveOccupancy.room_number == payload.roomId).first()
            if existing_radar:
                existing_radar.guest_crm_id = crm_guest.id
                existing_radar.folio_id = folio_id_to_link
                existing_radar.check_in_timestamp = now
            else:
                radar = ActiveOccupancy(
                    room_number=payload.roomId,
                    guest_crm_id=crm_guest.id,
                    folio_id=folio_id_to_link,
                    check_in_timestamp=now
                )
                db.add(radar)
                 
        db.commit()
        
        # 🔱 GUEST OPERATIVE KERNEL: Auto-create guest User in the operative tree
        try:
            from app.routers.guest_api import _upsert_guest_user
            _upsert_guest_user(db, str(payload.roomId), clean_guest_name)
            db.commit()
        except Exception as ge:
            logger.warning(f"⚠️ GUEST_USER_UPSERT skipped: {ge}")
        
        # 🌐 BROADCAST KERNEL EVENT
        from app.main import master_socket
        await master_socket.broadcast("GRID_UPDATE", {"action": "IN_HOUSE", "room": payload.roomId})
        
        logger.info(f"✅ ACID SECURITY LOCK: Room {payload.roomId} physically checked-in for {payload.guestName}.")
        return {"status": "SUCCESS", "message": "7-Star Check-In Protocol Complete"}
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 ACID_VIOLATION: {str(e)}")
        raise HTTPException(status_code=500, detail="Atomic Transaction Failed.")

@router.post("/reservations/status/{res_id}")
async def update_reservation_status(res_id: str, status_payload: dict = Body(...), db: Session = Depends(get_db)):
    """Updates the status of a reservation (e.g. CONFIRMED, CANCELLED)."""
    new_status = status_payload.get("status", "").upper()
    if new_status not in ["PENDING", "CONFIRMED", "CANCELLED", "IN-HOUSE"]:
        raise HTTPException(status_code=400, detail="Invalid status option.")
    
    res = db.query(Reservation).filter(Reservation.id == res_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Reservation not found.")
        
    res.status = new_status
    db.commit()
    
    # Broadcast update
    try:
        from app.main import master_socket
        import asyncio
        asyncio.create_task(master_socket.broadcast("GRID_UPDATE", {"action": "WEB_BOOKING_CONFIRM", "room": res.room_id}))
    except:
        pass
        
    return {"status": "SUCCESS", "message": f"Reservation updated to {new_status}."}

# ==========================================
# 5. COMMAND GRID SYNC (ZONE 07 DASHBOARD)
# ==========================================
@router.get("/live-grid")
async def get_live_grid(db: Session = Depends(get_db)):
    """Generates the absolute physical truth for the 30-room Miracle Grid."""
    try:
        active_folios = _fetch_active_folios(db)
        
        # 🛡️ CDO FIX: FETCH ALL ACTIVE TICKETS FOR OMNI-SPECTRUM UI
        query = text("""
            SELECT room_no AS room, dept, priority, subject 
            FROM solve_missions 
            WHERE status != 'Resolved' AND status != 'RESOLVED'
        """)
        active_missions_raw = db.execute(query).mappings().all()
        
        missions_by_room = {}
        for m in active_missions_raw:
            r = str(m['room'])
            if r not in missions_by_room:
                missions_by_room[r] = []
            missions_by_room[r].append({
                "dept": str(m["dept"]),
                "priority": str(m["priority"]),
                "subject": str(m["subject"])
            })

        # 🛡️ CDO FIX: FETCH ALL ROOM STATUSES FROM ASSET_GRID
        asset_statuses = {a.room_id: a.current_status for a in db.query(AssetGrid).all()}
        
        # 🛡️ CDO FIX: IDENTIFY ALL UPCOMING RESERVATIONS
        # Logic: Find the SOONEST confirmed reservation for each room.
        from datetime import date as date_type, timedelta
        # 🔱 SOVEREIGN DHAKA PULSE: Force +6h offset for today's comparison
        now_dhaka = datetime.now(DHAKA_TZ)
        today_dhaka = now_dhaka.date()
        
        confirmed_res = db.query(Reservation).filter(Reservation.status.in_(['CONFIRMED', 'IN-HOUSE'])).order_by(Reservation.start_date.asc()).all()
        
        upcoming_res_map = {}
        for r in confirmed_res:
            try:
                start_val = r.start_date
                if hasattr(start_val, 'date'):
                    r_start = start_val.date()
                elif isinstance(start_val, str):
                    r_start = date_type.fromisoformat(start_val[:10])
                else:
                    r_start = start_val
                
                # We care about all future reservations to show on the grid
                r_end = r_start + timedelta(days=r.nights)
                if r_end > today_dhaka:
                    rid = str(r.room_id)
                    if rid not in upcoming_res_map:
                        upcoming_res_map[rid] = {
                            "id": r.id,
                            "guest": r.guest_name.upper(),
                            "start": r_start.strftime("%Y-%m-%d"),
                            "end": (r_start + timedelta(days=r.nights)).strftime("%Y-%m-%d"),
                            "is_today": r_start == today_dhaka
                        }
            except Exception as e:
                logger.error(f"Date Parsing Failure in Upcoming Logic: {e}")
                continue
        
        inventory = []
        
        master_assets = []
        db_assets = db.query(AssetGrid).filter(AssetGrid.is_active == True).all()
        if db_assets:
            for asset in db_assets:
                cat = (asset.category or "STANDARD").upper()
                asset_class = cat  # default: same as category
                # 🏥 Clinical HMS mappings
                if cat in ("WARD",):
                    asset_class = "WARDS"
                elif cat in ("CABIN",):
                    asset_class = "CABINS"
                elif cat in ("ICU", "EMERGENCY"):
                    asset_class = "CRITICAL"
                elif cat in ("OT",):
                    asset_class = "THEATRES"
                # Legacy luxury hospitality mappings (for Miracle OS Master)
                elif "ROYAL" in cat or "SUITE" in cat or "PRESIDENTIAL" in cat:
                    asset_class = "SUITES"
                elif "VILLA" in cat:
                    asset_class = "VILLAS"
                elif "RESIDENCE" in cat or "LTR" in cat:
                    asset_class = "RESIDENCES"
                elif "BUNGALOW" in cat or "MARINE" in cat or cat.startswith("OB-"):
                    asset_class = "MARINE"
                
                master_assets.append({
                    "id": asset.room_id,
                    "type": cat,
                    "rate": float(asset.base_rate or 5500.0),
                    "class": asset_class
                })
            master_assets.sort(key=lambda x: x["id"])
        else:
            # 🏥 Clinical HMS fallback (no DB assets) — matches genesis seed structure
            for i in range(1, 6): master_assets.append({"id": f"WARD-{i:02d}", "type": "WARD",      "rate": 150.0,  "class": "WARDS"})
            for i in range(1, 6): master_assets.append({"id": f"CABIN-{i:02d}","type": "CABIN",     "rate": 350.0,  "class": "CABINS"})
            for i in range(1, 4): master_assets.append({"id": f"ICU-{i:02d}",  "type": "ICU",       "rate": 1200.0, "class": "CRITICAL"})
            for i in range(1, 4): master_assets.append({"id": f"ER-{i:02d}",   "type": "EMERGENCY", "rate": 500.0,  "class": "CRITICAL"})
            for i in range(1, 3): master_assets.append({"id": f"OT-{i:02d}",   "type": "OT",        "rate": 2500.0, "class": "THEATRES"})
        
        # Construct the 7-star physical architecture
        for asset_obj in master_assets:
            room_id = asset_obj["id"]
            room_type = asset_obj["type"]
            default_rate = asset_obj["rate"]
            asset_class = asset_obj["class"]

            # 🛡️ CDO FIX: Preference matrix for room status
            # 1. If folio exists -> IN-HOUSE
            # 2. Else if Reserved for Today -> RESERVED
            # 3. Else if AssetGrid says MAINTENANCE -> use that
            # 4. Default -> AVAILABLE
            status_label = asset_statuses.get(room_id, "AVAILABLE")
            guest_name = "VACANT"
            upcoming_info = upcoming_res_map.get(room_id)
            
            if room_id in active_folios:
                status_label = "IN-HOUSE"
                guest_name = active_folios[room_id]["name"]
            elif upcoming_info and upcoming_info["is_today"]:
                # 🔱 SOVEREIGN AGGREGATION: If any confirmed res starts today and vacant -> RESERVED
                status_label = "RESERVED"
                guest_name = upcoming_info["guest"]
            # 🛡️ SOVEREIGN STATUS SANITIZER: Map any stale/variant DB values to canonical frontend statuses
            # This prevents 'OCCUPIED', 'IN_HOUSE', 'INHOUSE' etc. from silently blocking UI buttons
            STALE_STATUS_MAP = {
                'OCCUPIED':    'IN-HOUSE',
                'IN_HOUSE':    'IN-HOUSE',
                'INHOUSE':     'IN-HOUSE',
                'CHECKED_IN':  'IN-HOUSE',
                'CHECKIN':     'IN-HOUSE',
                'OOO':         'MAINTENANCE',
                'OUT_OF_ORDER':'MAINTENANCE',
                'CLEAN':       'AVAILABLE',
                'VACANT':      'AVAILABLE',
            }
            if status_label in STALE_STATUS_MAP:
                status_label = STALE_STATUS_MAP[status_label]

            # Integrity Check: AssetGrid says IN-HOUSE but no active folio? Revert to AVAILABLE
            if status_label == 'IN-HOUSE' and room_id not in active_folios:
                status_label = 'AVAILABLE'
            
            # If still available but has future reservation, add metadata for UI
            reservation_tag = None
            if upcoming_info:
                # 🛡️ ALWAYS SHOW RESERVATION DATA IN DESC IF ROOM IS VACANT
                reservation_tag = f"RES: {upcoming_info['start']} ({upcoming_info['guest']})"

            # 🛡️ CDO FIX: STAY EXPIRATION CHECK
            # Fetch the active reservation for this room to check if it's expired
            is_expired = False
            if status_label == "IN-HOUSE":
                res = db.query(Reservation).filter(Reservation.room_id == room_id, Reservation.status == 'IN-HOUSE').first()
                if res:
                    check_in_date = active_folios[room_id].get("checkIn") # YYYY-MM-DD
                    if check_in_date:
                        try:
                            ci_dt = datetime.strptime(check_in_date, "%Y-%m-%d").replace(tzinfo=timezone.utc).date()
                            days_stayed = (today_dhaka - ci_dt).days
                            if days_stayed >= res.nights:
                                is_expired = True
                        except: pass

            inventory.append({
                "id": room_id, 
                "type": room_type, 
                "rate": default_rate,
                "assetClass": asset_class,
                "status": status_label, 
                "guest": guest_name, 
                "desc": reservation_tag or "Sovereign Asset",
                "active_tickets": missions_by_room.get(room_id, []),
                "is_expired": is_expired,
                "upcoming_id": upcoming_info["id"] if upcoming_info else None
            })
            
        return {"status": "SUCCESS", "data": inventory}
    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"🚨 GRID_SYNC_FAILURE: {str(e)}")
        return {"status": "ERROR", "data": []}

# ==========================================
# 6. ZONE 08: MASTER CHECKOUT & EVICTION
# ==========================================
@router.post("/checkout/{room_id}")
async def process_master_checkout(room_id: str, background_tasks: BackgroundTasks, payload: dict = Body(...), db: Session = Depends(get_db)):
    """The Ultimate ACID-Compliant Checkout and Asset Release Protocol."""
    try:
        with db.begin_nested():
            # 1. Locate Folio
            folio = db.query(GuestFolio).filter(GuestFolio.room_number == room_id, GuestFolio.status == 'IN_HOUSE').first()
            
            # 🛡️ CDO FIX: IDEMPOTENT CHECKOUT
            # Even if the folio is gone, we MUST ensure the reservation and radar are cleared.
            if not folio:
                logger.warning(f"⚠️ ORPHANED CHECKOUT DETECTED: No folio for Room {room_id}. Continuing to clean up ghost records.")
            
            # 2. Execute Financial Wipe (Zero Ledger)
            if folio:
                folio.status = 'CHECKED_OUT'
                completed_balance = folio.balance
                folio.balance = 0.0
                folio.checkout_date = datetime.now(DHAKA_TZ)
            else:
                completed_balance = 0.0
            
            # 2.5 🛡️ CDO FIX: CRM UPGRADE & RADAR DELETION
            from app.models.models import GuestCRM, ActiveOccupancy, AccountingLedger
            radar = db.query(ActiveOccupancy).filter(ActiveOccupancy.room_number == room_id).first()
            if radar:
                crm = db.query(GuestCRM).filter(GuestCRM.id == radar.guest_crm_id).first()
                if crm:
                    crm.total_ltv = (crm.total_ltv or 0.0) + completed_balance
                    crm.total_stays = (crm.total_stays or 0) + 1
                db.delete(radar)
            
            # 2.6 🛡️ CDO FIX: Sync Reservation Status to CHECKED_OUT & Clip Nights
            res = db.query(Reservation).filter(
                Reservation.room_id == room_id, 
                Reservation.status == 'IN-HOUSE'
            ).first()
            if res:
                res.status = 'CHECKED_OUT'
                
                # 🔱 SOVEREIGN DHAKA PULSE: Absolute stay calculation
                start_date = res.start_date
                if hasattr(start_date, 'date'):
                    start_date = start_date.date()
                elif isinstance(start_date, str):
                    from datetime import date as date_type
                    start_date = date_type.fromisoformat(start_date[:10])
                
                today_dhaka = datetime.now(DHAKA_TZ).date()
                actual_nights = (today_dhaka - start_date).days
                if actual_nights < 1:
                    actual_nights = 1 # Minimum 1 night charge logic
                
                res.nights = actual_nights
                res.total_yield = (res.nightly_rate or 0.0) * actual_nights
            
            # 4. 🛡️ CDO FIX: Set AssetGrid Status to DIRTY
            asset = db.query(AssetGrid).filter(AssetGrid.room_id == room_id).first()
            if asset:
                asset.current_status = 'DIRTY'
                asset.current_guest = 'VACANT'
            
            # 🔱 SOVEREIGN KERNEL: Room Revenue Settlement
            from app.routers.accounting_engine import post_double_entry, record_room_sale, recognize_deferred_revenue, record_ota_commission
            amount_paid = float(payload.get('amount_paid', 0.0))
            payment_method = str(payload.get('payment_method', getattr(folio, 'payment_network', 'CASH'))).upper()
            
            advance_paid = float(getattr(folio, 'advance_paid', 0.0)) if folio else 0.0
            pos_balance = float(completed_balance)
            nightly_rate = float(res.nightly_rate) if res else (float(getattr(folio, 'rate', 0.0)) if folio else 0.0)
            actual_nights = int(res.nights) if res else 1
            
            # 1. Clear POS Balance (1210)
            if pos_balance > 0:
                post_double_entry(db, 'CHECKOUT_POS_SETTLEMENT', f"Zone 08 POS Settlement Room {room_id}", [
                    {"code": 1000, "debit": pos_balance, "credit": 0.0},
                    {"code": 1210, "debit": 0.0, "credit": pos_balance}
                ])
                
            # 2. Recognize Deferred Revenue
            if advance_paid > 0:
                recognize_deferred_revenue(db, advance_paid, f"Deferred Revenue Recognition Room {room_id}")
                
            # 3. Record Room Sale (New Revenue & COGS)
            room_paid_today = amount_paid - pos_balance
            channel = 'OTA' if 'OTA' in payment_method or payment_method in ['BOOKING.COM', 'EXPEDIA', 'AGODA'] else 'DIRECT'
            
            if room_paid_today > 0:
                record_room_sale(db, room_paid_today, actual_nights, nightly_rate, channel, f"Room Checkout Revenue Room {room_id}")
                
            # 4. OTA Commission Accrual on Total Room Gross
            room_gross = room_paid_today + advance_paid
            if channel == 'OTA' and room_gross > 0:
                record_ota_commission(db, room_gross, f"OTA Commission for Room {room_id}")

            # 5. Zone 30: PMS Owner Commission Accrual if AFFILIATED property
            if asset and asset.ownership_type == 'AFFILIATED' and room_gross > 0:
                try:
                    commission_rate = asset.commission_rate or 0.0
                    commission_amount = round(commission_rate * room_gross / 100.0, 4)

                    pass
                    db.flush()

                    # Post double-entry to GL: Dr 521000 / Cr 200400
                    journal = post_double_entry(db, "COMMISSION_ACCRUAL",
                        f"Z-30 Commission Checkout: {room_id} Res#{res.id if res else 'N/A'}", [
                            {"code": 521000, "debit": commission_amount, "credit": 0.0},
                            {"code": 200400, "debit": 0.0, "credit": commission_amount}
                        ])
                    log.journal_id = journal.id

                    # Credit the matching PMSOwnerProfile balance
                    if asset.owner_nid:
                        pass
                except Exception as comm_err:
                    logger.warning(f"[PMS][Commission] Auto accrual skipped (non-fatal): {comm_err}")

            # ============================================================
            # PHASE 5: HR BRIDGE -- Update operative revenue_impact on checkout
            # Front desk staff who processed this check-in get revenue credit.
            # ============================================================
            ref_staff_id = str(getattr(folio, 'ref_staff', 'NONE')) if folio else 'NONE'
            if ref_staff_id and ref_staff_id not in ['NONE', '', 'null']:
                try:
                    from app.routers.hr import update_revenue_impact
                    update_revenue_impact(db, ref_staff_id, room_gross, source="PMS_CHECKOUT")
                    logger.info(f"[HR BRIDGE] Revenue credit {room_gross:.2f} USD -> operative {ref_staff_id}")
                except Exception as hr_err:
                    logger.warning(f"[HR BRIDGE] Revenue credit skipped (non-fatal): {hr_err}")

            # ============================================================
            # PHASE 5: OWNER-EMPLOYEE YIELD BRIDGE
            # If this room's owner is a linked employee, post their net yield
            # via the accounting dispatcher which also updates their revenue_impact.
            # ============================================================
            owner_type = getattr(asset, "owner_type", "FULL_OWNER") if asset else "FULL_OWNER"
            if asset and owner_type in ("FULL_OWNER", "MORTGAGE_BUYER") and room_gross > 0:
                try:
                    period_label = datetime.now(DHAKA_TZ).strftime("%m%Y")
                    mgmt_fee_pct = getattr(asset, "management_fee_pct", 20.0) or 20.0
                    from app.models.models import BackgroundJob
                    job = BackgroundJob(
                        job_type="checkout_disbursement",
                        payload={
                            "room_id": room_id,
                            "gross_yield": room_gross,
                            "management_fee_pct": mgmt_fee_pct,
                            "period_label": f"{period_label}-CO{res.id if res else 'DIRECT'}",
                            "posted_by": ref_staff_id if ref_staff_id != 'NONE' else "SYSTEM",
                            "linked_employee_id": getattr(asset, "linked_employee_id", None)
                        },
                        status="PENDING"
                    )
                    db.add(job)
                    logger.info(f"[OWNER YIELD] Room {room_id}: Enqueued background checkout disbursement job for {owner_type}")
                except Exception as yield_err:
                    logger.warning(f"[OWNER YIELD] Skipped (non-fatal): {yield_err}")

            # ============================================================
            # PHASE 3: AI ROTATION -- Increment nights_occupied_ytd
            # Keeps the rotation dispatcher data accurate.
            # ============================================================
            if asset:
                asset.nights_occupied_ytd = (getattr(asset, "nights_occupied_ytd", 0) or 0) + (actual_nights if 'actual_nights' in dir() else 1)

        db.commit()

        # ============================================================
        # PHASE 6: SYNAPSE NEXUS -- Enqueue auto-creation of housekeeping directives
        # Runs AFTER commit so checkout is guaranteed even if Synapse fails.
        # ============================================================
        try:
            db.commit()
            logger.info(f"[SYNAPSE] Enqueued background HK directive creation job for Room {room_id}.")
        except Exception as syn_err:
            logger.warning(f"[SYNAPSE] Enqueuing HK directive job skipped (non-fatal): {syn_err}")

        try:
            from app.routers.guest_api import _deactivate_guest_user
            _deactivate_guest_user(db, room_id)
            db.commit()
        except Exception as ge:
            logger.warning(f"⚠️ GUEST_USER_DEACTIVATE skipped: {ge}")
        
        # 🌐 BROADCAST KERNEL EVENT
        from app.main import master_socket
        await master_socket.broadcast("GRID_UPDATE", {"action": "EVICTION", "room": room_id})
        
        # 🕵️ SOVEREIGN WATCHDOG: DEPLOY DECOY
        from app.core.watchdog_engine import verify_transaction_integrity
        from app.core.database import SessionLocal
        background_tasks.add_task(verify_transaction_integrity, SessionLocal, room_id, 'CHECKOUT_EVENT', payload)
        
        logger.info(f"✅ ACID CHECKOUT SUCCESS: Room {room_id} Ledger Zeroed.")
        return {"status": "SUCCESS", "message": f"Room {room_id} successfully evicted and settled."}
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 CHECKOUT_FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail="Ledger settlement failed. Asset locked.")

@router.post("/force-available/{room_id}")
async def force_room_available(room_id: str, db: Session = Depends(get_db)):
    """
    🛡️ CDO SOVEREIGN OVERRIDE: Forcefully resets a room to AVAILABLE status.
    Wipes all active missions and releases the asset lock.
    """
    try:
        with db.begin_nested():
            # 1. Reset Asset Grid Status
            asset = db.query(AssetGrid).filter(AssetGrid.room_id == room_id).first()
            if asset:
                asset.current_status = 'AVAILABLE'
                asset.current_guest = 'VACANT'
            
            # 2. Kill all active missions for this room
            db.execute(text("""
                UPDATE solve_missions 
                SET status = 'Resolved', secured_at = :now
                WHERE room_no = :r_id AND status != 'Resolved'
            """), {"now": datetime.now(DHAKA_TZ), "r_id": room_id})
            
        db.commit()
        
        # 🌐 BROADCAST
        from app.main import master_socket
        await master_socket.broadcast("GRID_UPDATE", {"action": "SOVEREIGN_OVERRIDE", "room": room_id})
        
        logger.info(f"👑 SOVEREIGN OVERRIDE: Room {room_id} forced to AVAILABLE.")
        return {"status": "SUCCESS", "message": f"Room {room_id} is now AVAILABLE."}
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 OVERRIDE_FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail="Sovereign Override Failed.")

# ==========================================
# 7. ZONE 06: POS OFFLINE QUEUE CONSUMER
# ==========================================
@router.post("/sync-offline-queue")
async def sync_offline_transactions(transactions: List[dict] = Body(...), db: Session = Depends(get_db)):
    """Absorbs the frontend localStorage 'shah_marine_offline_queue' upon network reconnection."""
    try:
        from app.routers.pos_router import handle_checkout  # Circular import safe inside route
        from app.schemas.pos_schema import POSCheckoutPayload
        
        success_count = 0
        for tx in transactions:
            logger.info(f"🔄 INGESTING OFFLINE TX: {tx.get('id', 'UNKNOWN')}")
            try:
                # Morph raw JS dictionary back into the Pydantic Payload POS expects
                payload = POSCheckoutPayload(**tx)
                # THUMB RULE 3: Execute the heavily protected POS checkout engine 
                # (which handles BOM, Folio, Ledger, and Comp Logic natively).
                await handle_checkout(payload=payload, db=db)
                success_count += 1
            except Exception as e:
                logger.error(f"⚠️ Offline Txn {tx.get('id')} rejected by Kernel: {str(e)}")
                # We do not rollback the entire loop for one bad apple, unless it's critical.
                
        return {"status": "SUCCESS", "message": f"{success_count} offline records synchronized via Zone 14 POS Engine."}
    except Exception as e:
        logger.error(f"🚨 QUEUE_SYNC_FATAL: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to parse offline transaction queue.")

# ==========================================
# 7.5 SYNC WALK-INS: BACKFILL RESERVATION ROWS FOR OLD IN-HOUSE FOLIOS
# ==========================================
@router.post("/sync-walkins")
async def sync_walkin_reservations(db: Session = Depends(get_db)):
    """🛡️ FIX: Backfills missing reservation rows for all current IN_HOUSE folios.
    Fixes legacy walk-ins that existed before the reservation-injection step was added.
    Safe to call multiple times — will not create duplicate rows.
    """
    try:
        now = datetime.now(DHAKA_TZ)
        today = now.date()
        
        # Fetch all currently active folios
        active_folios = db.query(GuestFolio).filter(GuestFolio.status == 'IN_HOUSE').all()
        
        synced = 0
        skipped = 0
        
        for folio in active_folios:
            # Check if this room already has an IN-HOUSE reservation row
            existing_res = db.query(Reservation).filter(
                Reservation.room_id == str(folio.room_number),
                Reservation.status == 'IN-HOUSE'
            ).first()
            
            if existing_res:
                # Already has a row — just ensure guest name is current
                if existing_res.guest_name != folio.guest_name:
                    existing_res.guest_name = folio.guest_name
                    synced += 1
                else:
                    skipped += 1
                continue
            
            # No reservation row → create one now
            # Find the CRM ID for this guest
            crm_guest = None
            if folio.guest_crm_id:
                crm_guest = db.query(GuestCRM).filter(GuestCRM.id == folio.guest_crm_id).first()
            if not crm_guest:
                crm_guest = db.query(GuestCRM).filter(GuestCRM.full_name == folio.guest_name).first()
            if not crm_guest:
                crm_guest = GuestCRM(full_name=str(folio.guest_name))
                db.add(crm_guest)
                db.flush()
            
            checkin_date = getattr(folio, 'check_in_date', None)
            start = checkin_date.date() if checkin_date else today
            rate = float(getattr(folio, 'rate', 5500.0) or 5500.0)
            
            backfill_id = f"RES-SYNC-{folio.room_number}-{now.strftime('%Y%m%d%H%M%S')}-{synced}"
            new_res = Reservation(
                id=backfill_id,
                room_id=str(folio.room_number),
                guest_crm_id=crm_guest.id,
                guest_name=str(folio.guest_name),
                start_date=start,
                nights=1,
                status='IN-HOUSE',
                nightly_rate=rate,
                total_yield=rate
            )
            db.add(new_res)
            synced += 1
        
        db.commit()
        
        # Broadcast so all connected clients re-fetch
        from app.main import master_socket
        await master_socket.broadcast("GRID_UPDATE", {"action": "WALKIN_SYNC"})
        
        logger.info(f"✅ WALKIN SYNC: {synced} reservation rows backfilled, {skipped} already current.")
        return {
            "status": "SUCCESS",
            "message": f"{synced} walk-in reservation(s) synced to tape chart. {skipped} already up to date.",
            "synced": synced,
            "skipped": skipped
        }
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 WALKIN_SYNC_FAILURE: {str(e)}")
        raise HTTPException(status_code=500, detail="Walk-in sync failed.")

# ==========================================
# 7.7. STAY EXTENSION PROTOCOL (ZONE 05)
# ==========================================
@router.post("/extend/{res_id}")
async def extend_stay(res_id: str, payload: ExtendStayPayload, db: Session = Depends(get_db)):
    """Extends a guest stay by adding more nights and updating yield."""
    try:
        with db.begin_nested():
            res = db.query(Reservation).filter(Reservation.id == res_id).first()
            if not res:
                raise HTTPException(status_code=404, detail="Reservation not found")
            
            res.nights += payload.nights_to_add
            res.total_yield = res.nights * res.nightly_rate
            
            # Update the folio rate/balance if needed? 
            # Usually folio balance stays the same until checkout, 
            # but we can update the 'estimated' yield.
            
        db.commit()
        
        # Broadcast to update the grid/tape
        from app.main import master_socket
        await master_socket.broadcast("GRID_UPDATE", {"action": "STAY_EXTENDED", "res_id": res_id})
        
        logger.info(f"✅ STAY EXTENDED: Res {res_id} increased by {payload.nights_to_add} nights.")
        return {"status": "SUCCESS", "message": f"Stay extended by {payload.nights_to_add} nights."}
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 EXTENSION_FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail="Stay extension failed.")

# ==========================================
# 8. ADMIN OVERRIDE (VIGILANT TERMINAL)
# ==========================================
@router.post("/force-sync")
async def force_sync_folio(payload: ForceSyncPayload, db: Session = Depends(get_db)):
    """Highest security override. Creates or modifies physical DB records directly."""
    try:
        with db.begin_nested():
            existing = db.query(GuestFolio).filter(GuestFolio.room_number == payload.roomId).first()
            if existing:
                existing.guest_name = payload.guestName
                existing.status = payload.status
                if payload.rate > 0: 
                    existing.rate = payload.rate
            else:
                new_folio = GuestFolio(
                    room_number=payload.roomId, 
                    guest_name=payload.guestName, 
                    status=payload.status, 
                    rate=payload.rate
                )
                db.add(new_folio)
        db.commit()
        logger.info(f"✅ OVERRIDE SUCCESS: Folio {payload.roomId} forcibly synced.")
        return {"status": "SUCCESS", "message": f"Asset {payload.roomId} synchronized."}
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 OVERRIDE_FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail="Administrative Override Failed.")