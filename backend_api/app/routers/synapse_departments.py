from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List
from datetime import datetime, timezone
import json

from app.core.database import get_db
from app.models.models import CorporateDepartment, DirectiveNode, StrategicDirective, Employee

router = APIRouter(prefix="/synapse/grid", tags=["Synapse Command Grid"])

# ============================================================
# PHASE 26: THE SYNAPSE COMMAND GRID (Virtual Departments)
# Iron Law 45: Neon Signals mapping Corporate Structure
# ============================================================

@router.post("/departments")
def create_department(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Creates a new Virtual Grid Tile (Department/Area)"""

    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Department Code is required")

    existing = db.query(CorporateDepartment).filter(CorporateDepartment.code == code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Grid tile {code} already exists")

    new_dept = CorporateDepartment(
        code=code.upper(),
        name=payload.get("name", code),
        category=payload.get("category", "DEPARTMENT"),
        icon_code=payload.get("icon_code", "🏢"),
        signal_color=payload.get("signal_color", "cyan"),
        description=payload.get("description", ""),
        sort_order=payload.get("sort_order", 100)
    )
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    return {"message": "Corporate Matrix Extended", "data": new_dept}


@router.put("/departments/{code}")
def update_department(code: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Updates an existing Virtual Grid Tile"""
    dept = db.query(CorporateDepartment).filter(CorporateDepartment.code == code).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    dept.name = payload.get("name", dept.name)
    dept.category = payload.get("category", dept.category)
    dept.icon_code = payload.get("icon_code", dept.icon_code)
    dept.signal_color = payload.get("signal_color", dept.signal_color)
    dept.description = payload.get("description", dept.description)
    dept.sort_order = payload.get("sort_order", dept.sort_order)
    
    db.commit()
    db.refresh(dept)
    return {"message": "Corporate Matrix Updated", "data": dept}


@router.delete("/departments/{code}")
def delete_department(code: str, db: Session = Depends(get_db)):
    """Deletes a Virtual Grid Tile"""
    dept = db.query(CorporateDepartment).filter(CorporateDepartment.code == code).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    db.delete(dept)
    db.commit()
    return {"message": "Corporate Matrix Tile Purged"}


@router.get("/departments")
def get_departments(db: Session = Depends(get_db)):
    """Returns all available Corporate Grid tiles"""
    depts = db.query(CorporateDepartment).order_by(CorporateDepartment.sort_order.asc(), CorporateDepartment.name.asc()).all()
    return {"status": "SUCCESS", "departments": depts, "data": depts}


@router.get("/live-matrix")
def get_live_matrix_signals(db: Session = Depends(get_db)):
    """
    CORE PULSE ENGINE (Phase 26):
    Calculates exactly how many active (uncompleted) Action Nodes 
    are assigned to each Department to trigger UI neon glow pulses.
    """
    depts = db.query(CorporateDepartment).filter(CorporateDepartment.is_active == True).order_by(CorporateDepartment.sort_order.asc()).all()
    
    # Get all active (not completed) directive nodes that are tied to a department
    active_nodes = db.query(
        DirectiveNode.target_dept,
        func.count(DirectiveNode.id).label("pending_count")
    ).filter(
        DirectiveNode.is_completed == False,
        DirectiveNode.target_dept != None
    ).group_by(
        DirectiveNode.target_dept
    ).all()

    # Create map of department_code -> pending_nodes_count
    node_map = {row.target_dept: row.pending_count for row in active_nodes}

    # Build the final grid array
    matrix_grid = []
    for dept in depts:
        pending_count = node_map.get(dept.code, 0)
        
        # Determine the Pulse State (Iron Law 45 Logic)
        pulse_state = "NORMAL"
        if pending_count > 0:
            pulse_state = "ACTION_REQUIRED"
        if pending_count > 5:  # Arbitrary threshold for critical — can be adjusted later
            pulse_state = "CRITICAL"

        matrix_grid.append({
            "id": dept.id,
            "code": dept.code,
            "name": dept.name,
            "category": dept.category,
            "icon_code": dept.icon_code,
            "signal_color": dept.signal_color,
            "pending_nodes": pending_count,
            "pulse_state": pulse_state,
            "head_employee_id": dept.head_employee_id
        })

    return {"data": matrix_grid, "pulse_timestamp": datetime.now(timezone.utc).isoformat()}
