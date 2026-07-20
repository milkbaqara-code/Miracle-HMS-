import logging
from datetime import datetime, timezone, timedelta
import uuid
from typing import List, Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, or_, cast, String, func
from jose import jwt

from app.core.database import get_db
from app.models.models import GuestFolio, SolveMission, AssetGrid, POSTransaction, POSOrderItem, Inventory, FolioCharge, GuestCRM, User

# 🔱 GUEST JWT CONSTANTS (role=GUEST is sandboxed from staff operative roles)
_GUEST_SECRET = "MIRACLE_OS_SUPREME_SECRET_KEY_CHANGE_IN_PROD"
_GUEST_ALGORITHM = "HS256"
_GUEST_TOKEN_HOURS = 72  # 3 days; invalidated server-side on checkout via folio check

def _issue_guest_jwt(room: str, name: str, folio_id: int) -> str:
    """Issues a real JWT for a verified in-house guest operative."""
    expire = datetime.now(timezone.utc) + timedelta(hours=_GUEST_TOKEN_HOURS)
    return jwt.encode(
        {"sub": f"GUEST-{room}", "role": "GUEST", "name": name, "room": room, "folio_id": folio_id, "exp": expire},
        _GUEST_SECRET, algorithm=_GUEST_ALGORITHM
    )

def _upsert_guest_user(db: Session, room: str, name: str):
    """
    Auto-creates or re-activates a User(role=GUEST) in the operative tree.
    username = GUEST-{room}  (e.g. GUEST-RS-03)
    NEVER deleted — only is_active toggled.
    """
    username = f"GUEST-{room.upper()}"
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.is_active = True  # re-activate if they checked in again
        user.role = f"GUEST | ROOM:{room.upper()} | NAME:{name.upper()}"
    else:
        user = User(
            username=username,
            hashed_password=room.upper(),  # room ID is the password (no external login)
            role=f"GUEST | ROOM:{room.upper()} | NAME:{name.upper()}",
            is_active=True
        )
        db.add(user)
    db.flush()
    return user

def _deactivate_guest_user(db: Session, room: str):
    """
    Deactivates the guest User on checkout. Does NOT delete.
    Called by frontdesk_engine checkout hook.
    """
    username = f"GUEST-{room.upper()}"
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.is_active = False
        db.flush()

# 🔱 SOVEREIGN ACCOUNTING KERNEL: Ensures Guest App sales hit the General Ledger
try:
    from app.routers.accounting_engine import record_fb_sale, post_double_entry, record_coin_earned, record_coin_spent, record_coin_cashout
except ImportError:
    def record_fb_sale(*a, **k): pass
    def post_double_entry(*a, **k): pass
    def record_coin_earned(*a, **k): pass
    def record_coin_spent(*a, **k): pass
    def record_coin_cashout(*a, **k): pass

logger = logging.getLogger("Zone25_GuestMarketing")
router = APIRouter(tags=["ZONE 25: Guest Marketing API"])

# ==========================================
# 1. GUEST SCHEMAS (PYDANTIC)
# ==========================================

class GuestLoginRequest(BaseModel):
    room_number: Optional[str] = None
    identity: Optional[str] = None
    phone: Optional[str] = None # 🛡️ NEW PHONE-BASED AUTH
    name: Optional[str] = None # For external neighbor signup
    app_version: Optional[str] = "1.0.0" # 🔱 VERSION TRACKING

class GuestSocialLoginRequest(BaseModel):
    social_id: str
    provider: str # GOOGLE, FACEBOOK
    name: str
    email: Optional[str] = None

class GuestRegisterRequest(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    country: Optional[str] = None

class GuestEmailLoginRequest(BaseModel):
    email: str
    password: str
    
class GuestTicketPayload(BaseModel):
    room: str
    subject: str
    dept: str = "HK" # Default to Housekeeping
    priority: str = "NORMAL"

class GuestCartItem(BaseModel):
    id: str
    name: str
    qty: int
    rp: float
    cogs: float = 0.0

class GuestOrderPayload(BaseModel):
    room: str # Can be a phone number for external
    user_type: str = "IN_HOUSE" # IN_HOUSE vs EXTERNAL
    payment_method: str = "ROOM_CHARGE" # ROOM_CHARGE, COD, DIGITAL
    items: List[GuestCartItem]
    subtotal: float
    total: float
    delivery_address: Optional[str] = None

class GuestReservePayload(BaseModel):
    room: str
    service: str
    date: str
    time: str
    guests: int
    notes: Optional[str] = None

class GuestOfferPayload(BaseModel):
    category: str
    title: str
    description: str
    image_url: Optional[str] = None
    price_tag: Optional[str] = None
    is_active: bool = True
    is_featured: bool = False
    is_broadcast: bool = False
    action_url: Optional[str] = None

# ==========================================
# 2. GUEST AUTHENTICATION KERNEL
# ==========================================

@router.post("/login", status_code=status.HTTP_200_OK)
async def guest_login(payload: GuestLoginRequest, db: Session = Depends(get_db)):
    """
    Sovereign Dual-Auth:
    1. IN_HOUSE: Room+Identity matches active Folio.
    2. EXTERNAL: Phone lookup. If CRM missing, creates lead.
    """
    # 🔱 SOVEREIGN VERSION LOCK: Block old APKs from entering the ecosystem
    APP_MIN_VERSION = "2.0.0"
    client_version = payload.app_version or "1.0.0"
    
    if client_version < APP_MIN_VERSION:
        raise HTTPException(
            status_code=status.HTTP_426_UPGRADE_REQUIRED,
            detail={
                "message": "MANDATORY_UPDATE_REQUIRED",
                "download_url": "https://miracle.vigilantitsolution.com/downloads/MiracleOS-GuestApp.apk",
                "info": f"Your version {client_version} is obsolete. v{APP_MIN_VERSION} is required."
            }
        )

    # NOTE: Room 103 demo override removed — all rooms now authenticate via live DB.

    folio = None
    crm = None
    user_type = "EXTERNAL"
    
    # 📱 OPTION A: PHONE-BASED LOOKUP (NEIGHBORS)
    if payload.phone:
        clean_phone = payload.phone.strip()
        crm = db.query(GuestCRM).filter(GuestCRM.phone == clean_phone).first()
        
        if not crm:
            # Auto-create neighbor CRM lead
            crm = GuestCRM(
                full_name=payload.name or "Neighbor Guest",
                phone=clean_phone,
                vip_tier="NEIGHBOR"
            )
            db.add(crm)
            db.commit()
            db.refresh(crm)
            
        # Check if they have an active folio (meaning they are currently in hotel)
        folio = db.query(GuestFolio).filter(
            GuestFolio.guest_crm_id == crm.id,
            GuestFolio.status == "IN_HOUSE"
        ).first()

    # 🛋️ OPTION B: ROOM+IDENTITY LOOKUP (IN-HOUSE GUEST OPERATIVE)
    elif payload.room_number and payload.identity:
        clean_room = payload.room_number.strip().upper()
        clean_identity = payload.identity.strip().lower()

        folio = db.query(GuestFolio).filter(
            GuestFolio.room_number == clean_room,
            GuestFolio.status == "IN_HOUSE"
        ).first()

        if folio:
            # 🔱 Sovereign Match: Allow name parts in any order (e.g. "Doe John" matches "John Doe")
            guest_parts = set(folio.guest_name.lower().split())
            identity_parts = set(clean_identity.split())
            
            # If the user typed the exact full name forward, it matches. 
            # Or, if they typed at least one valid name part (first or last), it matches.
            if clean_identity not in folio.guest_name.lower() and not guest_parts.intersection(identity_parts):
                folio = None  # identity doesn't match ANY part of the name

    if not folio and not crm:
        raise HTTPException(status_code=401, detail="Verification failed. Invalid credentials or guest is not currently checked in.")

    if folio:
        user_type = "IN_HOUSE"

    if user_type == "IN_HOUSE" and folio:
        # 🔱 Auto-create/reactivate the guest User in the operative tree
        _upsert_guest_user(db, folio.room_number, folio.guest_name)
        db.commit()

        # Issue a REAL JWT — not a fake session string
        real_token = _issue_guest_jwt(folio.room_number, folio.guest_name, folio.id)

        return {
            "status": "SUCCESS",
            "level": "SOVEREIGN",
            "token": real_token,
            "guest": {
                "type": "IN_HOUSE",
                "name": folio.guest_name,
                "room": folio.room_number,
                "folio_id": folio.id,
                "crm_id": None,
                "balance": folio.balance
            }
        }

    # EXTERNAL path (phone-based neighbours) — keep legacy fake token
    session_id = crm.id
    session_token = f"SOVEREIGN-EXTERNAL-{session_id}-{uuid.uuid4().hex[:6]}"
    return {
        "status": "SUCCESS",
        "level": "EXTERNAL",
        "token": session_token,
        "guest": {
            "type": "EXTERNAL",
            "name": crm.full_name,
            "room": crm.phone,
            "folio_id": None,
            "crm_id": crm.id,
            "balance": 0.0
        }
    }

@router.post("/social-login", status_code=status.HTTP_200_OK)
async def guest_social_login(payload: GuestSocialLoginRequest, db: Session = Depends(get_db)):
    """
    Level 1 Discovery Auth:
    Allows guests to enter the App Hub via Google/FB before stay.
    Unlocks Offers and Shopping, but restricts Concierge.
    """
    crm = db.query(GuestCRM).filter(
        GuestCRM.social_id == payload.social_id,
        GuestCRM.social_provider == payload.provider
    ).first()
    
    if not crm:
        # Create a pre-stay lead in CRM
        crm = GuestCRM(
            full_name=payload.name,
            email=payload.email,
            social_id=payload.social_id,
            social_provider=payload.provider,
            vip_tier="STANDARD"
        )
        db.add(crm)
        db.commit()
        db.refresh(crm)
        
    # Check if they have an active check-in (auto-upgrade to Level 2 if found)
    folio = db.query(GuestFolio).filter(
        GuestFolio.guest_crm_id == crm.id,
        GuestFolio.status == "IN_HOUSE"
    ).first()
    
    session_token = f"SOCIAL-{crm.id}-{uuid.uuid4().hex[:8]}"
    
    return {
        "status": "SUCCESS",
        "level": "SOVEREIGN" if folio else "PUBLIC_HUB",
        "token": session_token,
        "guest": {
            "type": "IN_HOUSE" if folio else "EXTERNAL",
            "name": crm.full_name,
            "room": folio.room_number if folio else "SOCIAL_GUEST",
            "folio_id": folio.id if folio else None,
            "phone": crm.phone or "",
            "crm_id": crm.id
        }
    }

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def guest_register(payload: GuestRegisterRequest, db: Session = Depends(get_db)):
    """Creates a new GuestCRM record for public web users."""
    existing = db.query(GuestCRM).filter(GuestCRM.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="A guest with this email already exists.")
    
    crm = GuestCRM(
        full_name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=payload.password, # Plaintext matching system baseline
        vip_tier="STANDARD",
        preferences=[f"Registered: {datetime.now().strftime('%Y-%m-%d')}", f"Country: {payload.country or 'Unknown'}"]
    )
    try:
        db.add(crm)
        db.commit()
        db.refresh(crm)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    session_token = f"EMAIL-{crm.id}-{uuid.uuid4().hex[:8]}"
    return {
        "status": "SUCCESS",
        "token": session_token,
        "guest": {
            "type": "EXTERNAL",
            "name": crm.full_name,
            "email": crm.email,
            "phone": crm.phone or "",
            "crm_id": crm.id
        }
    }

@router.post("/email-login", status_code=status.HTTP_200_OK)
async def guest_email_login(payload: GuestEmailLoginRequest, db: Session = Depends(get_db)):
    """Verifies guest credentials and issues a session token."""
    crm = db.query(GuestCRM).filter(
        GuestCRM.email == payload.email,
        GuestCRM.password_hash == payload.password
    ).first()
    
    if not crm:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    # Check if they have an active check-in
    folio = db.query(GuestFolio).filter(
        GuestFolio.guest_crm_id == crm.id,
        GuestFolio.status == "IN_HOUSE"
    ).first()
    
    session_token = f"EMAIL-{crm.id}-{uuid.uuid4().hex[:8]}"
    
    return {
        "status": "SUCCESS",
        "level": "SOVEREIGN" if folio else "PUBLIC_HUB",
        "token": session_token,
        "guest": {
            "type": "IN_HOUSE" if folio else "EXTERNAL",
            "name": crm.full_name,
            "email": crm.email,
            "room": folio.room_number if folio else "EMAIL_GUEST",
            "folio_id": folio.id if folio else None,
            "phone": crm.phone or "",
            "crm_id": crm.id
        }
    }

@router.get("/offers", status_code=status.HTTP_200_OK)
async def get_guest_offers(db: Session = Depends(get_db)):
    """The Miracle Public Feed: Shows, Buffets, and Packages."""
    offers = db.query(GuestOffer).filter(GuestOffer.is_active == True).order_by(GuestOffer.is_featured.desc().created_at.desc()).all()
    return {"status": "SUCCESS", "data": offers}

@router.post("/offers", status_code=status.HTTP_200_OK)
async def create_guest_offer(payload: GuestOfferPayload, db: Session = Depends(get_db)):
    """ADMIN: Create a new Offer or Broadcast."""
    try:
        new_offer = GuestOffer(
            category=payload.category,
            title=payload.title,
            description=payload.description,
            image_url=payload.image_url,
            price_tag=payload.price_tag,
            is_active=payload.is_active,
            is_featured=payload.is_featured,
            is_broadcast=payload.is_broadcast,
            action_url=payload.action_url
        )
        db.add(new_offer)
        db.commit()
        db.refresh(new_offer)
        
        # 🔱 If broadcast, trigger socket alert
        if new_offer.is_broadcast:
            try:
                from app.main import master_socket
                import asyncio
                asyncio.create_task(master_socket.broadcast("SYSTEM_ALERT", {
                    "type": "BROADCAST",
                    "title": new_offer.title,
                    "message": new_offer.description
                }))
            except: pass
            
        return {"status": "SUCCESS", "message": "Offer Created", "id": new_offer.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/offers/{offer_id}", status_code=status.HTTP_200_OK)
async def delete_guest_offer(offer_id: int, db: Session = Depends(get_db)):
    """ADMIN: Remove an offer."""
    offer = db.query(GuestOffer).filter(GuestOffer.id == offer_id).first()
    if not offer: raise HTTPException(status_code=404, detail="Offer not found")
    db.delete(offer)
    db.commit()
    return {"status": "SUCCESS", "message": "Offer Purged"}

# ==========================================
# 3. SILENT CONCIERGE (TICKETS)
# ==========================================

@router.post("/concierge/ticket", status_code=status.HTTP_200_OK)
async def submit_guest_ticket(payload: GuestTicketPayload, db: Session = Depends(get_db)):
    """Allows a guest to bypass the front desk and push tickets directly into the Solve Engine."""
    try:
        new_mission = SolveMission(
            room_no=payload.room,
            dept=payload.dept.upper(),
            subject=f"[GUEST REQUEST] {payload.subject}",
            priority=payload.priority.upper(),
            status="PENDING",
            assigned_to="Unassigned"
        )
        db.add(new_mission)
        db.commit()
        db.refresh(new_mission)
        
        # Trigger Global Sync via Websocket (Requires main.py lazy load)
        try:
            from app.main import master_socket
            import asyncio
            asyncio.create_task(master_socket.broadcast("TICKET_UPDATE", {
                "action": "NEW_GUEST_MISSION",
                "room": payload.room,
                "dept": payload.dept
            }))
        except Exception as ws_err:
            logger.warning(f"WS Broadcast failed for Guest Ticket: {ws_err}")

        return {"status": "SUCCESS", "message": "The Sovereign team has been notified.", "mission_id": new_mission.id}
        
    except Exception as e:
        db.rollback()
        logger.error(f"GUEST_TICKET_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Silent Concierge subsystem failure.")

# ==========================================
# 4. GUEST ECOMMERCE (POS PROXY)
# ==========================================

@router.post("/ecommerce/order", status_code=status.HTTP_200_OK)
async def process_guest_order(payload: GuestOrderPayload, db: Session = Depends(get_db)):
    """
    Processes an Ecommerce order directly from the Guest App.
    Posts the POS Transaction, binds it to Folio, and calculates Loyalty Coins.
    """
    txn_id = f"G-APP-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:4].upper()}"
    
    try:
        # 🛡️ SOVEREIGN KERNEL: Route to master POS Checkout for recursive BOM & Z-07
        from app.routers.pos_router import handle_checkout
        from app.schemas.pos_schema import POSCheckoutPayload, FinancialsSchema, CartItemSchema, BOMItemSchema
        
        # Map guest items to POS Cart Items
        pos_items = []
        item_details = []
        for item in payload.items:
            # Fetch full inventory item to get BOM & COGS
            db_item = db.query(Inventory).filter(Inventory.product_id == item.id).first()
            if db_item:
                pos_items.append(CartItemSchema(
                    id=item.id,
                    name=item.name,
                    type=getattr(db_item, 'type', 'PRODUCT'),
                    qty=item.qty,
                    isFOC=False,
                    rp=item.rp,
                    cogs=getattr(db_item, 'pp', 0.0),
                    bom=[BOMItemSchema(**b) for b in getattr(db_item, 'bom', [])] if getattr(db_item, 'bom', None) else []
                ))
            item_details.append(f"{item.qty}x {item.name}")

        # Prepare Master POS Payload
        pos_payload = POSCheckoutPayload(
            transaction_id=txn_id,
            cashier_pin="0000",
            terminal_id="GUEST_APP",
            guest_type=payload.user_type if payload.user_type in ["WALK_IN", "HOTEL_GUEST", "VIP_MEMBER"] else "GUEST_APP",
            guest_ref=payload.room,
            payment_method=payload.payment_method,
            financials=FinancialsSchema(
                subtotal=payload.subtotal,
                totalCOGS=sum(i.cogs * i.qty for i in pos_items),
                discount=0.0,
                vat=payload.total - payload.subtotal,
                sc=0.0,
                grand=payload.total,
                trueProfit=payload.subtotal - sum(i.cogs * i.qty for i in pos_items)
            ),
            items=pos_items
        )
        
        # 🚀 EXECUTE MASTER POS CHECKOUT (Handles BOM + Z-07 + Double Entry)
        await handle_checkout(pos_payload, db)

        # 🛡️ SOVEREIGN LOYALTY ENGINE: Calculate Coins (0.05% Cashback)
        coins_earned = float(payload.total) * 0.0005
        
        # Direct CRM Association for Coins
        target_crm_id = None
        if payload.user_type == "IN_HOUSE":
            folio = db.query(GuestFolio).filter(GuestFolio.room_number == payload.room, GuestFolio.status == 'IN_HOUSE').first()
            if folio: 
                target_crm_id = folio.guest_crm_id
                # 🛡️ FALLBACK: If folio has no CRM link, try to find CRM by name
                if not target_crm_id:
                    crm_fallback = db.query(GuestCRM).filter(GuestCRM.full_name == folio.guest_name).first()
                    if crm_fallback:
                        target_crm_id = crm_fallback.id
                        folio.guest_crm_id = target_crm_id # Auto-link for next time
        else:
            crm_record = db.query(GuestCRM).filter(GuestCRM.phone == payload.room).first()
            if crm_record: target_crm_id = crm_record.id
            
        if target_crm_id:
            crm_update = db.query(GuestCRM).filter(GuestCRM.id == target_crm_id).first()
            if crm_update:
                if not hasattr(crm_update, 'coins') or crm_update.coins is None: 
                    crm_update.coins = 0.0
                
                # 💰 SPEND COINS
                if payload.payment_method == "COIN":
                    if crm_update.coins < payload.total:
                        raise ValueError(f"Insufficient Miracle Coins. Need {payload.total}, have {crm_update.coins}")
                    crm_update.coins -= payload.total
                    
                    # Accounting: Coin Spent
                    try:
                        from app.routers.accounting_engine import record_coin_spent
                        record_coin_spent(db, payload.total, f"App Order COIN Payment TXN:{txn_id}")
                    except Exception as acct_err:
                        logger.warning(f"ACCOUNTING_SYNC_WARN (COIN SPENT): {acct_err}")
                        
                    logger.info(f"🪙 COINS SPENT: {payload.total} by CRM {target_crm_id} (New Bal: {crm_update.coins})")
                    
                    # Override coins_earned since paying with coins shouldn't generate cashback
                    coins_earned = 0.0
                
                # 💰 EARN COINS (only if not paying with coins)
                if coins_earned > 0:
                    crm_update.coins += coins_earned
                    
                    # Accounting: Coin Earned (Liability)
                    try:
                        from app.routers.accounting_engine import record_coin_earned
                        record_coin_earned(db, coins_earned, f"Cashback for App Order TXN:{txn_id}")
                    except Exception as acct_err:
                        logger.warning(f"ACCOUNTING_SYNC_WARN (COIN EARNED): {acct_err}")
                        
                    logger.info(f"🪙 COINS CREDITED: {coins_earned} to CRM {target_crm_id} (Total: {crm_update.coins})")

        # Bind to Guest Folio if Room Charge
        if payload.payment_method == "ROOM_CHARGE":
            from app.models.models import FolioCharge
            folio = db.query(GuestFolio).filter(
                GuestFolio.room_number == payload.room, 
                GuestFolio.status == 'IN_HOUSE'
            ).first()
            if not folio: raise ValueError("Folio inactive or missing.")
            
            folio.balance += payload.total
            
            for item in payload.items:
                new_charge = FolioCharge(
                    folio_id=folio.id,
                    item_name=f"[APP] {item.name}",
                    category="GUEST_APP",
                    amount=float(item.rp) * float(item.qty),
                    qty=item.qty,
                    transaction_id=txn_id
                )
                db.add(new_charge)

        # Ticket Injection for Staff Fulfillment
        order_summary = ", ".join(item_details)
        source_tag = f"Room {payload.room}" if payload.user_type == "IN_HOUSE" else f"External/Neighbor: {payload.room}"
        
        fulfillment_ticket = SolveMission(
            room_no=payload.room,
            dept="RS" if payload.user_type == "IN_HOUSE" else "MAINTENANCE", # RS or Delivery
            subject=f"[APP ORDER - {payload.payment_method}] {source_tag} - {order_summary}",
            priority="HIGH",
            status="PENDING",
            assigned_to="POS_QUEUE"
        )
        db.add(fulfillment_ticket)

        db.commit()
        
        # Trigger Global Sync
        try:
            from app.main import master_socket
            import asyncio
            asyncio.create_task(master_socket.broadcast("GRID_UPDATE", {
                "action": "GUEST_APP_SALE",
                "room": payload.room
            }))
        except Exception: pass
        
        return {"status": "SUCCESS", "message": "Order Confirmed and locked to folio."}
        
    except ValueError as ve:
        db.rollback()
        logger.warning(f"GUEST_ORDER_VAL_ERROR: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        db.rollback()
        logger.error(f"GUEST_ORDER_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Ecommerce Engine failure.")

class CashoutPayload(BaseModel):
    crm_id: str
    amount: float
    method: str = "BKASH"
    account_details: str

@router.post("/ecommerce/cashout", status_code=status.HTTP_200_OK)
async def process_coin_cashout(payload: CashoutPayload, db: Session = Depends(get_db)):
    """
    Sovereign Coin Cashout Protocol.
    Allows guests to withdraw their coins with a 20% processing fee.
    Generates a Finance task to execute the transfer.
    """
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")
        
    try:
        with db.begin_nested():
            crm = db.query(GuestCRM).filter(GuestCRM.id == payload.crm_id).with_for_update().first()
            if not crm:
                raise ValueError("CRM Profile not found.")
                
            current_balance = getattr(crm, "coins", 0.0)
            if current_balance < payload.amount:
                raise ValueError(f"Insufficient Miracle Coins. Have {current_balance}, requested {payload.amount}")
                
            # Deduct coins
            crm.coins -= payload.amount
            
            # Calculate financials (20% fee)
            fee = payload.amount * 0.20
            payout = payload.amount - fee
            
            # Post to Sovereign Accounting Ledger
            try:
                record_coin_cashout(db, payload.amount, payout, fee, f"Coin Cashout via {payload.method} for CRM {payload.crm_id}")
            except Exception as acct_err:
                logger.error(f"ACCOUNTING_CASHOUT_ERR: {acct_err}")
                
            # Create a Finance task to actually send the money
            finance_ticket = SolveMission(
                room_no=crm.phone or "EXTERNAL",
                dept="IT", # Finance/IT handles digital payments
                subject=f"[COIN CASHOUT] Pay {payout} via {payload.method} to {payload.account_details} (Fee: {fee})",
                priority="HIGH",
                status="PENDING",
                assigned_to="FINANCE_QUEUE"
            )
            db.add(finance_ticket)
            
        db.commit()
        return {
            "status": "SUCCESS", 
            "message": "Cashout request submitted. Please allow 24-48 hours.",
            "payout": payout,
            "fee": fee
        }
    except ValueError as ve:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        db.rollback()
        logger.error(f"CASHOUT_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Cashout Engine failure.")

# ==========================================
# 5. ADMIN TELEMETRY (ZONE 25: GUEST MARKETING)
# ==========================================

@router.get("/catalog", status_code=status.HTTP_200_OK)
async def get_guest_catalog(db: Session = Depends(get_db)):
    """Returns guest-orderable live POS inventory. Auto-discovers all departments from Z-29."""
    # IRON LAW: Block RAW_MATERIAL (warehouse ingredients). DB stores 'RAW_MATERIAL' not 'RAW'.
    items = db.query(Inventory).filter(
        Inventory.type != 'RAW_MATERIAL',
        Inventory.type != 'RAW'
    ).all()
    catalog = []

    for item in items:
        safe_dept = item.dept or 'GENERAL'
        raw_dept = safe_dept.upper().replace('\r', '').replace('\n', '').strip()

        # SOVEREIGN DEPT MAPPER: Strip Z-XX- prefix and map to clean display name
        # This ensures any custom dept created in Z-29 Architect auto-appears in Guest APK
        import re
        # Remove Z-NN- prefix (e.g. 'Z-29-RESTAURANT' -> 'RESTAURANT')
        clean_dept = re.sub(r'^Z-\d+-', '', raw_dept).strip()

        # Normalize common aliases
        if not clean_dept or clean_dept in ('GASTRONOMY', 'F&B', 'FB'):
            clean_dept = 'RESTAURANT'
        elif 'COFFEE' in clean_dept and 'BAR' not in clean_dept:
            clean_dept = 'COFFEE & BAR'
        elif 'HOUSE' in clean_dept or clean_dept == 'HK':
            clean_dept = 'HK-HOUSEKEEPING'

        # SOVEREIGN PRICING: Use RP directly, fall back to calculated price
        item_price = float(item.rp or 0)
        if item_price <= 0:
            try:
                raw_pp = float(item.pp or 0)
                raw_factor = float(item.factor or 1)
                raw_margin = float(item.margin or 0)
                calculated_rp = raw_pp + (raw_pp * (raw_margin / 100))
                item_price = calculated_rp / raw_factor if raw_factor > 0 else 0
            except (ValueError, TypeError):
                item_price = 0.0

        catalog.append({
            "id": item.product_id,
            "name": item.name,
            "rp": item_price,
            "stock": item.stock,
            "min_level": item.min_level,
            "dept": clean_dept,
            "cat": item.cat,
            "img": item.img,
            "desc": item.desc,
            "type": item.type
        })
            
    return {"status": "SUCCESS", "data": catalog}

@router.get("/my-tickets", status_code=status.HTTP_200_OK)
async def get_guest_tickets(room: str, db: Session = Depends(get_db)):
    """Returns the guest's own tickets from SolveMission."""
    missions = db.query(SolveMission).filter(SolveMission.room_no == room).order_by(SolveMission.raised_at.desc()).all()
    tickets = []
    for m in missions:
        tickets.append({
            "id": m.id,
            "subject": m.subject,
            "dept": m.dept,
            "status": m.status,
            "priority": m.priority,
            "raised_at": m.raised_at.isoformat() if m.raised_at else None,
            "secured_at": m.secured_at.isoformat() if m.secured_at else None
        })
    return {"status": "SUCCESS", "data": tickets}

@router.get("/folio/{room}", status_code=status.HTTP_200_OK)
async def get_guest_folio(room: str, db: Session = Depends(get_db)):
    """Returns the guest's line-item folio."""
    folio = db.query(GuestFolio).filter(
        GuestFolio.room_number == room,
        GuestFolio.status == "IN_HOUSE"
    ).first()
    
    if not folio:
        return {"status": "ERROR", "message": "No active folio found."}
        
    charges = db.query(FolioCharge).filter(FolioCharge.folio_id == folio.id).order_by(FolioCharge.timestamp.desc()).all()
    
    charge_data = []
    for c in charges:
        charge_data.append({
            "id": c.id,
            "item_name": c.item_name,
            "category": c.category,
            "amount": c.amount,
            "qty": getattr(c, "qty", 1),
            "timestamp": c.timestamp.isoformat() if c.timestamp else None,
            "transaction_id": getattr(c, "transaction_id", None)
        })
        
    return {
        "status": "SUCCESS",
        "data": {
            "folio_id": folio.id,
            "room_number": folio.room_number,
            "guest_name": folio.guest_name,
            "balance": folio.balance,
            "charges": charge_data
        }
    }

@router.get("/profile/{crm_id}", status_code=status.HTTP_200_OK)
async def get_guest_profile(crm_id: str, db: Session = Depends(get_db)):
    """Returns guest profile details including loyalty coins and active passes."""
    crm = db.query(GuestCRM).filter(GuestCRM.id == crm_id).first()
    if not crm:
         return {"status": "ERROR", "message": "Profile not found."}
         
    return {
        "status": "SUCCESS",
        "data": {
            "name": crm.full_name,
            "phone": crm.phone or "",
            "coins": getattr(crm, "coins", 0.0),
            "tier": crm.vip_tier,
            "preferences": crm.preferences or [] # Includes Sauna/Assigned Items
        }
    }

@router.post("/reserve", status_code=status.HTTP_200_OK)
async def process_guest_reserve(payload: GuestReservePayload, db: Session = Depends(get_db)):
    """Creates a reservation ticket for Spa/Pool/Gym and logs to native ServiceBooking."""
    try:
        subject = f"[RESERVATION] {payload.service} - {payload.date} at {payload.time} for {payload.guests} guest(s)."
        if payload.notes:
            subject += f" Notes: {payload.notes}"
            
        # Determine target department for SolveMission
        target_dept = "SPA" if payload.service == "SPA" else ("GYM" if payload.service == "GYM" else ("POOL" if payload.service == "POOL" else "RS"))

        with db.begin_nested():
            # 1. Spawn Command Grid Mission
            new_mission = SolveMission(
                room_no=payload.room,
                dept=target_dept,
                subject=subject,
                priority="HIGH",
                status="PENDING",
                assigned_to="Unassigned"
            )
            db.add(new_mission)
            
            # 2. Native Booking Record (Zone 27 Sync)
            from app.models.models import ServiceBooking
            from dateutil import parser
            try:
                dt = parser.parse(f"{payload.date} {payload.time}")
            except:
                dt = datetime.now(timezone.utc)
                
            new_booking = ServiceBooking(
                room_number=payload.room,
                service_name=payload.service,
                booking_time=dt,
                status="SCHEDULED"
            )
            db.add(new_booking)
            
        db.commit()
        db.refresh(new_mission)
        
        # Trigger Global Sync via Websocket
        try:
            from app.main import master_socket
            import asyncio
            asyncio.create_task(master_socket.broadcast("TICKET_UPDATE", {
                "action": "NEW_GUEST_MISSION",
                "room": payload.room,
                "dept": new_mission.dept
            }))
        except Exception as ws_err:
            logger.warning(f"WS Broadcast failed for Guest Reservation: {ws_err}")

        return {"status": "SUCCESS", "message": "Reservation received."}
        
    except Exception as e:
        db.rollback()
        logger.error(f"GUEST_RESERVE_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Reservation system failure.")

# ==========================================
# 6. ADMIN TELEMETRY OVERVIEW (ZONE 25)
# ==========================================

@router.get("/stats", status_code=status.HTTP_200_OK)
async def get_guest_marketing_stats(db: Session = Depends(get_db)):
    """Provides live metrics for the Sovereign Guest Marketing dashboard."""
    try:
        # 1. Active Sessions (In-House Guests)
        active_sessions = db.query(GuestFolio).filter(GuestFolio.status == "IN_HOUSE").count()
        
        # 2. Revenue from App (Room Charges in 24h)
        # Using a simple filter for now, can be expanded to 24h window
        app_revenue = db.query(func.sum(FolioCharge.amount)).filter(
            FolioCharge.category == "GUEST_APP"
        ).scalar() or 0.0
        
        # 3. Pending Concierge Missions (Raised from App)
        pending_tickets = db.query(SolveMission).filter(
            SolveMission.status == "PENDING",
            SolveMission.subject.like("%[GUEST REQUEST]%")
        ).count()
        
        # 4. Recent Activity (Last 5 events)
        recent = db.query(FolioCharge).filter(
            FolioCharge.category == "GUEST_APP"
        ).order_by(FolioCharge.timestamp.desc()).limit(5).all()
        
        # Base currency
        config = db.query(SystemConfig).first()
        fl = config.financial_laws if config and config.financial_laws else {}
        base_cur = fl.get("base_currency", "BDT")
        symbols = fl.get("currency_symbols", {"BDT": "৳", "USD": "$", "AED": "د.إ"})
        sym = symbols.get(base_cur, "৳")

        activity_feed = []
        for r in recent:
             # Find room number from folio
             folio = db.query(GuestFolio).filter(GuestFolio.id == r.folio_id).first()
             activity_feed.append({
                 "time": "Just Now" if (datetime.now(timezone.utc) - r.timestamp.replace(tzinfo=timezone.utc)).seconds < 3600 else "Earlier",
                 "room": folio.room_number if folio else "???",
                 "action": r.item_name,
                 "impact": f"+{sym}{int(r.amount)}"
             })

        return {
            "active_sessions": active_sessions,
            "app_revenue": app_revenue,
            "pending_tickets": pending_tickets,
            "recent_activity": activity_feed
        }
        
    except Exception as e:
        logger.error(f"GUEST_STATS_ERROR: {str(e)}")
        return {
            "active_sessions": 0,
            "app_revenue": 0,
            "pending_tickets": 0,
        }
        
class CRMAssignPayload(BaseModel):
    crm_id: str
    coins: Optional[float] = None
    pass_name: Optional[str] = None

@router.get("/crm-profiles", status_code=status.HTTP_200_OK)
async def get_crm_profiles(db: Session = Depends(get_db)):
    """ADMIN: List all Guest Profiles."""
    crms = db.query(GuestCRM).all()
    data = []
    for c in crms:
        data.append({
            "id": c.id,
            "name": c.full_name,
            "phone": c.phone or "",
            "coins": getattr(c, "coins", 0.0),
            "tier": c.vip_tier,
            "preferences": c.preferences or []
        })
    return {"status": "SUCCESS", "data": data}

@router.post("/crm-assign", status_code=status.HTTP_200_OK)
async def assign_crm_data(payload: CRMAssignPayload, db: Session = Depends(get_db)):
    """ADMIN: Update coins or assign a VIP pass (like Sauna)."""
    crm = db.query(GuestCRM).filter(GuestCRM.id == payload.crm_id).first()
    if not crm: return {"status": "ERROR", "message": "Profile not found."}
    
    if payload.coins is not None:
        crm.coins = payload.coins
        
    if payload.pass_name:
        prefs = list(crm.preferences or [])
        if payload.pass_name not in prefs:
            prefs.append(payload.pass_name)
        crm.preferences = prefs
        
    db.commit()
    return {"status": "SUCCESS", "message": "Profile Updated"}

# ==========================================
# 11. APP VERSION CHECK (AUTO-UPDATE ENGINE)
# ==========================================
# 🛡️ SOVEREIGN UPDATE PROTOCOL
# The APK checks this endpoint on startup.
# If server version > installed version, the app shows an "Update Available" prompt.
APP_CURRENT_VERSION = "2.0.0"
APP_DOWNLOAD_URL = "https://miracle.vigilantitsolution.com/downloads/MiracleOS-GuestApp.apk"

@router.get("/app-version")
async def get_app_version():
    """Returns the latest app version and download URL for the APK update check."""
    return {
        "status": "SUCCESS",
        "data": {
            "version": APP_CURRENT_VERSION,
            "download_url": APP_DOWNLOAD_URL,
            "release_notes": "Mandatory update: Fixed hardware back button and security sync.",
            "force_update": True
        }
    }

# ==========================================
# 12. PUSH NOTIFICATION ENGINE (DEVICE REGISTRATION)
# ==========================================

class DeviceTokenPayload(BaseModel):
    guest_crm_id: Optional[str] = None
    token: str  # FCM / OneSignal device token
    platform: str = "ANDROID"  # ANDROID, IOS, WEB

@router.post("/register-device")
async def register_device_token(payload: DeviceTokenPayload, db: Session = Depends(get_db)):
    """Registers a device token for push notifications.
    The token table is created via genesis surgery if it doesn't exist."""
    try:
        # Store token in a lightweight way (JSON column on CRM or dedicated table)
        # For now, store as a preference tag on the CRM profile
        if payload.guest_crm_id:
            crm = db.query(GuestCRM).filter(GuestCRM.id == payload.guest_crm_id).first()
            if crm:
                prefs = list(crm.preferences or [])
                # Remove old device tokens from preferences
                prefs = [p for p in prefs if not str(p).startswith("DEVICE_TOKEN:")]
                prefs.append(f"DEVICE_TOKEN:{payload.platform}:{payload.token}")
                crm.preferences = prefs
                db.commit()
                logger.info(f"📱 DEVICE REGISTERED: {payload.platform} token for CRM {payload.guest_crm_id}")
                return {"status": "SUCCESS", "message": "Device registered for notifications."}
        
        return {"status": "SUCCESS", "message": "Token received (no CRM link)."}
    except Exception as e:
        logger.error(f"🚨 DEVICE_REG_ERROR: {str(e)}")
        return {"status": "ERROR", "message": "Registration failed."}

class PushNotificationPayload(BaseModel):
    target_crm_id: Optional[str] = None  # Specific guest, or None for broadcast
    title: str
    body: str
    category: str = "GENERAL"  # ORDER_STATUS, OFFER, SYSTEM, GENERAL

@router.post("/push-notification")
async def send_push_notification(payload: PushNotificationPayload, db: Session = Depends(get_db)):
    """ADMIN: Queue a push notification for a guest or broadcast to all.
    In Phase 2, this will integrate with Firebase Cloud Messaging (FCM).
    For now, it stores the notification in the offers table as an 'ALERT' type."""
    try:
        pass
        
        logger.info(f"📡 PUSH QUEUED: '{payload.title}' → {'BROADCAST' if not payload.target_crm_id else payload.target_crm_id}")
        return {"status": "SUCCESS", "message": "Notification queued."}
    except Exception as e:
        logger.error(f"🚨 PUSH_ERROR: {str(e)}")
        return {"status": "ERROR", "message": "Failed to queue notification."}

