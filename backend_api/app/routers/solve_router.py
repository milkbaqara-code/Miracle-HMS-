# backend_api/app/routers/solve_router.py
import logging
import asyncio
import os
import uuid
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from PIL import Image
import io

# master_socket imported lazily inside functions to avoid circular import


# Internal Path Alignment
from app.core.database import get_db
from app.services.solve_engine import SystemSentinel 

logger = logging.getLogger("MasterOS.Radar")

# CDO FIX: Removed prefix here because it is already defined in main.py
router = APIRouter(tags=["Zone 16: System Radar"])

# 🛡️ PHYSICAL VAULT FOR VISUAL PROOF
PROOF_DIR = "app/assets/mission_proofs"
os.makedirs(PROOF_DIR, exist_ok=True)

# ==========================================
# 0. LIVE ROOM LIST ENDPOINT (Feeds Z16 dropdown)
# ==========================================
@router.get("/rooms")
async def get_active_rooms(db: Session = Depends(get_db)):
    """Returns all active room IDs from asset_grid for the Z16 TARGET ASSET dropdown."""
    try:
        from app.models.models import AssetGrid
        rooms = (
            db.query(AssetGrid.room_id, AssetGrid.category, AssetGrid.floor, AssetGrid.current_status)
            .filter(AssetGrid.is_active == True)
            .all()
        )
        # Natural sort: numeric room IDs first (101, 102...), then alphanumeric
        import re as _re
        def _nat_key(r):
            parts = _re.split(r'(\d+)', r.room_id or '')
            return [int(p) if p.isdigit() else p.lower() for p in parts]
        rooms_sorted = sorted(rooms, key=_nat_key)
        return {
            "status": "SUCCESS",
            "rooms": [
                {
                    "room_id": r.room_id,
                    "category": r.category or "ROOM",
                    "floor": r.floor,
                    "status": r.current_status or "AVAILABLE",
                }
                for r in rooms_sorted
            ]
        }
    except Exception as e:
        logger.error(f"ROOMS_FETCH_FAIL: {e}")
        return {"status": "ERROR", "rooms": []}



# ==========================================
# 1. SOVEREIGN SCHEMAS (PYDANTIC)
# ==========================================

class MissionRegisterPayload(BaseModel):
    room: str = Field(..., examples=["101"]) 
    dept: str = Field(..., examples=["MAINTENANCE"])
    subject: str = Field(..., min_length=3)
    priority: str = Field(default="NORMAL", pattern="^(CRITICAL|HIGH|NORMAL|LOW)$")
    checks: List[str] = []

# ==========================================
# 2. THE MASTER RADAR PULSE (DIAGNOSTICS)
# ==========================================

@router.get("/pulse", status_code=status.HTTP_200_OK)
async def get_system_pulse(db: Session = Depends(get_db)):
    """Checks inter-departmental sync and database integrity."""
    logger.info("🛰️ RADAR: Manual Pulse Triggered.")
    sentinel = SystemSentinel(db)
    
    try:
        # 🛡️ CDO FIX: run_supreme_audit is an async def, so we await it directly.
        # This resolves the Pylance CoroutineType error.
        audit_report = await asyncio.wait_for(
            sentinel.run_supreme_audit(), 
            timeout=5.0
        )
            
        if audit_report.get("status") == "RED":
            logger.critical(f"🚨 RADAR ALARM: System Desync! {audit_report.get('integrity_alarms')}")
            
        return {"status": "SUCCESS", "audit": audit_report}

    except asyncio.TimeoutError:
        logger.error("🚨 RADAR TIMEOUT: Audit engine failed to respond.")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Radar timed out. One or more zones are unresponsive."
        )
    except Exception as e:
        logger.error(f"🚨 RADAR_FATAL: {str(e)}")
        raise HTTPException(status_code=500, detail="Radar Logic Engine failure.")

# ==========================================
# 3. THE LIVE MISSION FEED (DASHBOARD)
# ==========================================

@router.get("/active")
async def get_active_radar_feed(db: Session = Depends(get_db)):
    """Broadcasts the live list of missions for the GM Dashboard & Staff Portal."""
    try:
        sentinel = SystemSentinel(db)
        missions = sentinel.fetch_active_missions() 
        print(f"🚨 CDO RADAR PAYLOAD: {len(missions)} tickets found.")
        return {
            "status": "SUCCESS",
            "count": len(missions),
            "missions": missions,
            "radar_time": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"🚨 RADAR_ACTIVE_FAIL: {str(e)}")
        # CDO FIX: Return clean success to prevent CORS/500 stripped headers crash on empty tables
        return {
            "status": "SUCCESS",
            "data": [],
            "count": 0,
            "missions": [],
            "radar_time": datetime.now(timezone.utc).isoformat()
        }

# ==========================================
# 4. SECURE MISSION REGISTRATION (BRIDGE)
# ==========================================

@router.post("/register")
async def register_new_mission(payload: MissionRegisterPayload, db: Session = Depends(get_db)):
    """The secure gateway for IoT and Staff signals."""
    sentinel = SystemSentinel(db)
    
    # 🛡️ CDO FIX: Safe dict extraction compatible with both Pydantic v1 and v2
    payload_dict = payload.model_dump() if hasattr(payload, 'model_dump') else payload.dict()
    
    success, result = sentinel.register_mission(payload_dict)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result 
        )
        
    # 🌐 BROADCAST THE KERNEL EVENT
    from app.main import master_socket
    await master_socket.broadcast("GRID_UPDATE", {
        "action": "MISSION_REGISTERED",
        "room": payload.room,
        "priority": payload.priority
    })
        
    return {
        "status": "SUCCESS",
        "message": "✅ MISSION BROADCAST: Staff mobile devices alerted & Dashboard Room Grid Pulse activated.",
        "unit_confirmed": result
    }

# ==========================================
# 5. TACTICAL LIFECYCLE: PICKUP & SECURE (CDO UPGRADE)
# ==========================================

@router.patch("/pickup/{mission_id}")
async def pickup_mission(mission_id: int, operative_name: str = Form(...), db: Session = Depends(get_db)):
    """Locks the mission to a specific staff member and starts the HR response-time clock."""
    try:
        db.execute(text("""
            UPDATE solve_missions 
            SET assigned_to = :op, picked_up_at = :now, status = 'Active'
            WHERE id = :m_id AND status != 'Resolved'
        """), {
            "op": operative_name,
            "now": datetime.now(timezone.utc),
            "m_id": mission_id
        })
        db.commit()
        
        # 🌐 BROADCAST
        from app.main import master_socket
        await master_socket.broadcast("GRID_UPDATE", {
            "action": "MISSION_PICKUP",
            "mission_id": mission_id
        })
        
        return {"status": "SUCCESS", "message": f"Mission {mission_id} locked to {operative_name}."}
    except Exception as e:
        db.rollback()
        logger.error(f"PICKUP_FAULT: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to secure mission lock.")

@router.post("/secure/{mission_id}")
async def secure_mission(
    mission_id: int, 
    operative_name: str = Form(...), 
    proof_image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    The final seal. Requires visual proof from the iPad camera. 
    Stops the clock for HR Efficiency Metrics.
    """
    try:
        image_data = await proof_image.read()
        img = Image.open(io.BytesIO(image_data))
        webp_filename = f"PROOF_M{mission_id}_{uuid.uuid4().hex[:6]}.webp"
        webp_path = os.path.join(PROOF_DIR, webp_filename)
        img.save(webp_path, "webp", optimize=True, quality=75)
        image_url = f"/api/assets/mission_proofs/{webp_filename}"
    except Exception as e:
        raise HTTPException(status_code=400, detail="Corrupted Visual Proof.")

    try:
        # 🛡️ CDO FIX: Relaxed constraint — resolves by mission_id regardless
        # of assignment state to prevent "ghost" signals stuck on the room grid.
        result = db.execute(text("""
            UPDATE solve_missions 
            SET status = 'Resolved', secured_at = :now, proof_image_url = :img,
                assigned_to = COALESCE(NULLIF(assigned_to, ''), :op)
            WHERE id = :m_id AND status != 'Resolved'
        """), {
            "now": datetime.now(timezone.utc),
            "img": image_url,
            "m_id": mission_id,
            "op": operative_name
        })
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found or already resolved.")
        
        # 🛡️ CDO FIX: Mission-to-Status Bridge (Strict Logic)
        # Only transition to AVAILABLE if the room is currently DIRTY or MAINTENANCE.
        # This prevents breaking the status of IN-HOUSE rooms during a routine HK refresh.
        mission = db.execute(text("SELECT room_no, dept FROM solve_missions WHERE id = :m_id"), {"m_id": mission_id}).fetchone()
        if mission and str(mission[1]).upper() in ('HK', 'HOUSEKEEPING', 'MN', 'MAINTENANCE'):
            db.execute(text("""
                UPDATE asset_grid 
                SET current_status = 'AVAILABLE' 
                WHERE room_id = :r_id AND current_status IN ('DIRTY', 'MAINTENANCE')
            """), {"r_id": mission[0]})
        
        db.commit()
        
        # 🌐 BROADCAST
        from app.main import master_socket
        await master_socket.broadcast("GRID_UPDATE", {
            "action": "MISSION_SECURED",
            "mission_id": mission_id
        })

        # 🛡️ CDO FIX: DIRTY -> AVAILABLE Lifecycle Trigger
        # If this was a cleaning/maintenance mission for a DIRTY room, mark it AVAILABLE
        try:
            from app.models.models import AssetGrid
            mission_room = db.execute(text("SELECT room_no FROM solve_missions WHERE id = :m_id"), {"m_id": mission_id}).scalar()
            if mission_room:
                asset = db.query(AssetGrid).filter(AssetGrid.room_id == mission_room).first()
                if asset and asset.current_status == 'DIRTY':
                    asset.current_status = 'AVAILABLE'
                    db.commit()
                    from app.main import master_socket as ms
                    await ms.broadcast("GRID_UPDATE", {"action": "AVAILABLE", "room": mission_room})
        except Exception as e:
            logger.error(f"LIFECYCLE_TRIGGER_FAIL: {str(e)}")
        
        return {
            "status": "SECURED", 
            "message": "Mission resolved. ROI metrics updated.",
            "proof_url": image_url
        }
    except Exception as e:
        db.rollback()
        logger.error(f"SECURE_FAULT: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to write resolution to Master Ledger.")

# ==========================================
# 6. FORCE RESOLVE (GHOST SIGNAL CLEANER)
# ==========================================
@router.post("/force-resolve/{mission_id}")
async def force_resolve_mission(mission_id: int, db: Session = Depends(get_db)):
    """
    🛡️ CDO FIX: Emergency signal wipe. Resolves a mission by ID without image proof.
    Used as a guaranteed fallback when the secure endpoint fails or assigns become mismatched.
    """
    try:
        result = db.execute(text("""
            UPDATE solve_missions 
            SET status = 'Resolved', secured_at = :now
            WHERE id = :m_id AND status != 'Resolved'
        """), {
            "now": datetime.now(timezone.utc),
            "m_id": mission_id
        })
        
        if result.rowcount == 0:
            return {"status": "WARNING", "message": f"Mission {mission_id} already resolved or not found."}

        # 🛡️ CDO FIX: Mission-to-Status Bridge (Fallback Strict)
        mission = db.execute(text("SELECT room_no, dept FROM solve_missions WHERE id = :m_id"), {"m_id": mission_id}).fetchone()
        if mission and str(mission[1]).upper() in ('HK', 'HOUSEKEEPING', 'MN', 'MAINTENANCE'):
            db.execute(text("""
                UPDATE asset_grid 
                SET current_status = 'AVAILABLE' 
                WHERE room_id = :r_id AND current_status IN ('DIRTY', 'MAINTENANCE')
            """), {"r_id": mission[0]})
            
        db.commit()
        
        # 🌐 BROADCAST: Clear the Room Grid Signal
        from app.main import master_socket
        await master_socket.broadcast("GRID_UPDATE", {
            "action": "MISSION_SECURED",
            "mission_id": mission_id
        })

        # 🛡️ CDO FIX: DIRTY -> AVAILABLE Lifecycle Trigger (Emergency/Force path)
        try:
            from app.models.models import AssetGrid
            mission_room = db.execute(text("SELECT room_no FROM solve_missions WHERE id = :m_id"), {"m_id": mission_id}).scalar()
            if mission_room:
                asset = db.query(AssetGrid).filter(AssetGrid.room_id == mission_room).first()
                if asset and asset.current_status == 'DIRTY':
                    asset.current_status = 'AVAILABLE'
                    db.commit()
                    from app.main import master_socket as ms
                    await ms.broadcast("GRID_UPDATE", {"action": "AVAILABLE", "room": mission_room})
        except Exception as e:
            logger.error(f"LIFECYCLE_TRIGGER_FAIL_FORCE: {str(e)}")
        
        return {"status": "SUCCESS", "message": f"Mission {mission_id} force-resolved. Grid signal cleared."}
    except Exception as e:
        db.rollback()
        logger.error(f"FORCE_RESOLVE_FAULT: {str(e)}")
        raise HTTPException(status_code=500, detail="Force resolve failed.")

# ==========================================
# 7. REGIONAL HEARTBEAT

# ==========================================

@router.get("/operative-stats/{username}")
async def get_operative_stats(username: str, db: Session = Depends(get_db)):
    """Extracts performance metrics for a specific operative."""
    try:
        sentinel = SystemSentinel(db)
        stats = sentinel.fetch_operative_stats(username)
        return {"status": "SUCCESS", "stats": stats}
    except Exception as e:
        logger.error(f"🚨 RADAR_STATS_FAIL: {str(e)}")
        return {
            "status": "SUCCESS",
            "stats": {
                "monthly_hours": 0.0,
                "avg_response": 0.0,
                "missions_count": 0
            }
        }

@router.get("/operative-load/{dept}")
async def get_operative_load(dept: str, db: Session = Depends(get_db)):
    """Fetches real-time mission load for all ON-DUTY staff in a department."""
    try:
        from app.models.models import Employee
        # 1. Fetch all ON-DUTY staff for this department
        staff = db.query(Employee).filter(
            Employee.dept == dept,
            Employee.status == 'ON-DUTY'
        ).all()
        
        payload = []
        for s in staff:
            # 2. Calculate current active load (Count of 'Active' missions)
            # We filter by assigned_to string name OR employee_id if linked
            load_count = db.execute(text("""
                SELECT COUNT(*) FROM solve_missions 
                WHERE (assigned_to = :name OR operator_id = :id)
                AND status = 'Active'
            """), {"name": f"{s.full_name} {s.last_name or ''}".strip(), "id": s.id}).scalar()

            payload.append({
                "id": s.id,
                "name": f"{s.full_name} {s.last_name or ''}".strip(),
                "status": s.status,
                "load": load_count or 0,
                "dept": s.dept
            })
            
        return {"status": "SUCCESS", "staff": payload}
    except Exception as e:
        logger.error(f"🚨 OPERATIVE_LOAD_FAIL: {str(e)}")
        return {"status": "ERROR", "staff": []}

@router.get("/status")

async def get_zone_status():
    return {"zone": "16/17", "label": "System Radar & Solve", "status": "ACTIVE"}