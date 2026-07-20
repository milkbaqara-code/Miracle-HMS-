import random
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.core.database import get_db
from app.models.models import (
    SystemConfig, AssetGrid, PolicySOP, SolveMission,
    Inventory, GuestCRM, Reservation
)

logger = logging.getLogger(__name__)

# ============================================================
# SOVEREIGN CATEGORY RATE CONFIG — SINGLE SOURCE OF TRUTH
# All asset creation, locking, and web display reads from here.
# To change a room category's nightly rate, edit this dict ONLY.
# ============================================================
SOVEREIGN_CATEGORY_RATES: Dict[str, float] = {
    "LUXURY RESIDENCE":    950.00,
    "OVERWATER BUNGALOW":  2800.00,
    "PRESIDENTIAL SUITE":  7500.00,
    "SOVEREIGN SUITE":     5500.00,
    "VILLA":               4200.00,
    "PENTHOUSE":           3500.00,
    "SUITE":               1200.00,
    "APARTMENT":            650.00,
    "STANDARD":             420.00,
    "CRUISE":              1400.00,
    "DEFAULT":              750.00,
}

# Placeholder rates that were never intentionally set — always override these
_PLACEHOLDER_RATES = {100000.0, 200000.0, 250000.0, 999999.0, 0.0}


def _resolve_rate(category: str, proposed: float) -> float:
    """
    Returns the correct nightly base rate for a given category.
    If the proposed value is a known placeholder or zero, the
    SOVEREIGN_CATEGORY_RATES dict is used as the authoritative fallback.
    This guarantees every asset — new or updated — has a realistic rate.
    """
    if proposed in _PLACEHOLDER_RATES or proposed is None:
        cat_upper = (category or "").upper()
        for key, rate in SOVEREIGN_CATEGORY_RATES.items():
            if key.upper() in cat_upper or cat_upper in key.upper():
                return rate
        return SOVEREIGN_CATEGORY_RATES["DEFAULT"]
    return proposed


# Shield: CDO FIX: Removed prefix="/api/policy" because main.py already handles it.
router = APIRouter(tags=["ZONE 19: Master Policy Engine"])

# ==========================================
# Shield: STRICT PYDANTIC SCHEMAS (THE DATA LAW)
# ==========================================
class UnitSchema(BaseModel):
    id: str
    category: str
    capacity: int
    baseRate: float
    status: str

class GlobalLawSchema(BaseModel):
    noShowPenaltyHours: int
    noShowChargeNights: int
    serviceChargePct: int
    vatPct: int
    checkInTime: str
    checkOutTime: str
    hotelName: Optional[str] = "Miracle Hospital"
    yieldRules: List[Dict[str, Any]] = []
    payrollRules: Dict[str, Any] = {}
    inventoryRules: Dict[str, Any] = {}

class ArchitectureLockPayload(BaseModel):
    unitInventory: List[UnitSchema]
    globalLaws: GlobalLawSchema
    sopMatrix: Dict[str, List[str]]
    timestamp: str

class BulkRoomBlueprint(BaseModel):
    start_number: int  
    end_number: int    
    category: str      
    baseRate: float    

class BulkSeedPayload(BaseModel):
    blueprints: List[BulkRoomBlueprint]

class MaintenancePayload(BaseModel):
    room_id: str
    start_date: str
    end_date: str
    reason: str

class SpawnTicketPayload(BaseModel):
    dept: str
    room_id: str
    task: str
    priority: str = "NORMAL"

class YieldRulesPayload(BaseModel):
    yield_rules: List[Dict[str, Any]]

class OfferSchema(BaseModel):
    id: Optional[int] = None
    category: str # BUFFET, SHOW, CONFERENCE, SERVICE
    title: str
    description: str
    image_url: Optional[str] = None
    price_tag: Optional[str] = None
    is_active: bool = True
    is_featured: bool = False

# ==========================================
# Shield: THE SOVEREIGN COMMANDS
# ==========================================

@router.post("/lock")
def commit_master_architecture(payload: ArchitectureLockPayload, db: Session = Depends(get_db)):
    """
    NUCLEAR WRITE: Uses UPSERT to protect Foreign Keys.
    Audited for heavy load and strict Pylance compliance.
    """
    try:
        all_assets = db.query(AssetGrid).all()
        existing_rooms: Dict[str, AssetGrid] = {str(r.room_id): r for r in all_assets}
        incoming_ids = set()

        for unit in payload.unitInventory:
            incoming_ids.add(str(unit.id))
            # Resolve rate: placeholder values auto-replaced by category config
            resolved_rate = _resolve_rate(str(unit.category), float(unit.baseRate))
            if unit.id in existing_rooms:
                asset = existing_rooms[unit.id]
                setattr(asset, 'category', str(unit.category))
                setattr(asset, 'base_rate', resolved_rate)
                setattr(asset, 'is_active', bool(unit.status == 'ACTIVE'))
            else:
                new_asset = AssetGrid(
                    room_id=str(unit.id),
                    category=str(unit.category),
                    base_rate=resolved_rate,
                    is_active=bool(unit.status == 'ACTIVE'),
                    current_status="AVAILABLE",
                    current_guest="NONE"
                )
                db.add(new_asset)

        # Deactivate rooms missing from inventory (Soft Delete Protocol)
        for room_id, asset in existing_rooms.items():
            if room_id not in incoming_ids:
                setattr(asset, 'is_active', False)

        # 2. OVERWRITE LAWS
        config = db.query(SystemConfig).first()
        if not config:
            config = SystemConfig()
            db.add(config)
        
        setattr(config, 'financial_laws', payload.globalLaws.model_dump())
        
        # CDO IDENTITY FIX: Propagate Hotel Name to Kernel
        if payload.globalLaws.hotelName:
            setattr(config, 'hotel_name', str(payload.globalLaws.hotelName))

        # 3. SOP RESET
        db.query(PolicySOP).delete()
        for dept, tasks in payload.sopMatrix.items():
            new_sop = PolicySOP(dept=str(dept), task_list=list(tasks))
            db.add(new_sop)

        db.commit()
        return {"status": "HARD_LOCK_SUCCESS", "locked": len(payload.unitInventory)}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Sovereign Lock Failed: {str(e)}")

@router.post("/gm-bulk-seed")
def generate_bulk_inventory(payload: BulkSeedPayload, db: Session = Depends(get_db)):
    """GM Bulk Engine for 1-500 room provisioning."""
    try:
        all_assets = db.query(AssetGrid).all()
        existing_rooms: Dict[str, AssetGrid] = {str(r.room_id): r for r in all_assets}
        total_generated = 0

        for bp in payload.blueprints:
            # Resolve rate: placeholder values auto-replaced by category config
            resolved_rate = _resolve_rate(str(bp.category), float(bp.baseRate))
            for room_num in range(bp.start_number, bp.end_number + 1):
                rid = str(room_num)
                if rid in existing_rooms:
                    asset = existing_rooms[rid]
                    setattr(asset, 'category', str(bp.category))
                    setattr(asset, 'base_rate', resolved_rate)
                    setattr(asset, 'is_active', True)
                else:
                    db.add(AssetGrid(
                        room_id=rid, category=str(bp.category),
                        base_rate=resolved_rate, is_active=True,
                        current_status="AVAILABLE", current_guest="NONE"
                    ))
                total_generated += 1
                
        db.commit()
        return {"status": "BULK_SEED_COMPLETE", "count": total_generated}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/category-rates")
def get_sovereign_category_rates():
    """
    Returns the SOVEREIGN_CATEGORY_RATES config — the single source of truth
    for nightly base rates per room category.
    Both Zone 7 and the public web page should reference this.
    """
    return {
        "status": "SUCCESS",
        "data": SOVEREIGN_CATEGORY_RATES,
        "placeholders_guarded": list(_PLACEHOLDER_RATES)
    }


@router.get("/current-lock")
def get_active_policy(db: Session = Depends(get_db)):
    """Sovereign Fetch for Grid Synchronization."""
    units = db.query(AssetGrid).filter(AssetGrid.is_active == True).all()
    laws = db.query(SystemConfig).first()
    sops = db.query(PolicySOP).all()
    
    # Securely project asset details to exclude owner's personal details
    inventory = []
    for u in units:
        inventory.append({
            "room_id": u.room_id,
            "category": u.category,
            "base_rate": u.base_rate,
            "floor": u.floor,
            "is_active": u.is_active,
            "current_status": u.current_status,
            "current_guest": u.current_guest,
            "ownership_type": u.ownership_type,
            "commission_rate": u.commission_rate,
            "rent_payable": u.rent_payable,
            "fixed_asset_id": u.fixed_asset_id,
            "capitalized_setup_cost": u.capitalized_setup_cost,
            "owner_entity": u.owner_entity,
            "lease_start": u.lease_start.isoformat() if hasattr(u.lease_start, 'isoformat') else (u.lease_start if u.lease_start else None),
            "lease_end": u.lease_end.isoformat() if hasattr(u.lease_end, 'isoformat') else (u.lease_end if u.lease_end else None),
            "size_sqft": u.size_sqft,
            "rooms_detail": u.rooms_detail,
            "facilities_detail": u.facilities_detail,
            "carousel_images": u.carousel_images,
            "video_url": u.video_url,
            "property_location": u.property_location,
        })

    return {
        "inventory": inventory,
        "laws": getattr(laws, 'financial_laws', {}) if laws else {},
        "sops": {str(s.dept): s.task_list for s in sops}
    }

@router.post("/maintenance-lock")
def maintenance_lock(payload: MaintenancePayload, db: Session = Depends(get_db)):
    asset = db.query(AssetGrid).filter(AssetGrid.room_id == payload.room_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Bed/Room not found")
    
    asset.current_status = "MAINTENANCE"
    
    new_ticket = SolveMission(
        room_no=payload.room_id,
        dept="MN",
        subject=f"Maintenance Lock: {payload.reason} ({payload.start_date} to {payload.end_date})",
        priority="CRITICAL",
        status="ACTIVE",
        sop_steps=[{"task": payload.reason, "done": False}]
    )
    db.add(new_ticket)
    db.commit()
    return {"status": "SUCCESS", "message": f"Bed {payload.room_id} locked to DECONTAMINATION / MAINTENANCE"}

@router.post("/spawn-ticket")
def spawn_ticket(payload: SpawnTicketPayload, db: Session = Depends(get_db)):
    if payload.room_id and payload.room_id != "GENERAL":
        asset = db.query(AssetGrid).filter(AssetGrid.room_id == payload.room_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Bed/Room not found")
        
    new_ticket = SolveMission(
        room_no=payload.room_id or "GENERAL",
        dept=payload.dept,
        subject=payload.task,
        priority=payload.priority,
        status="PENDING",
        sop_steps=[{"task": payload.task, "done": False}]
    )
    db.add(new_ticket)
    db.commit()
    return {"status": "SUCCESS", "message": "Ticket Spawned from Policy Matrix"}

@router.get("/yield-rules")
def get_yield_rules(db: Session = Depends(get_db)):
    config = db.query(SystemConfig).first()
    laws = config.financial_laws if config and config.financial_laws else {}
    return {"status": "SUCCESS", "data": laws.get("yieldRules", [])}

@router.post("/yield-rules")
def update_yield_rules(payload: YieldRulesPayload, db: Session = Depends(get_db)):
    config = db.query(SystemConfig).first()
    if not config:
        config = SystemConfig()
        db.add(config)
    
    laws = dict(config.financial_laws) if config.financial_laws else {}
    laws["yieldRules"] = payload.yield_rules
    config.financial_laws = laws
    
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(config, "financial_laws")
    db.commit()
    return {"status": "SUCCESS", "message": "Yield Database Committed"}

# ==========================================
# Shield: SOVEREIGN CMS: GUEST HUB OFFERS
# ==========================================

