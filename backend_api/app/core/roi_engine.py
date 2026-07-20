from sqlalchemy.orm import Session
from app.models.models import Employee, SolveMission
from datetime import datetime
from typing import cast, Any

def calculate_staff_roi(db: Session, employee_id: str) -> float:
    """
    Sovereign ROI Logic: Final Hard-Lock v4.0
    Formula: (Completed Missions / Total Time) * Priority Weight
    """
    
    # 1. ATOMIC FETCH
    missions = db.query(SolveMission).filter(
        SolveMission.operator_id == employee_id,
        SolveMission.status == "Resolved",
        SolveMission.picked_up_at.isnot(None),
        SolveMission.secured_at.isnot(None)
    ).all()

    if not missions:
        return 100.0

    total_weighted_score = 0.0
    total_count = len(missions)

    for m in missions:
        # 🛡️ CDO FIX: Use cast to tell Pylance these are literal values, not Columns
        # We access the data via the instance to get the actual datetime object
        start_time = cast(datetime, m.picked_up_at)
        end_time = cast(datetime, m.secured_at)
        priority_val = str(m.priority)
        
        # Temporal Delta Calculation (Sub-second precision)
        delta_minutes = (end_time - start_time).total_seconds() / 60
        
        # 7-STAR PRIORITY WEIGHTING
        weight = 1.5 if priority_val == "CRITICAL" else 1.0
        
        # Performance Index (15-minute standard benchmark)
        # max(x, 1) prevents division by zero for instant secures
        performance = (15 / max(delta_minutes, 1)) * weight
        total_weighted_score += performance

    # Final ROI % calculation
    avg_rating = min((total_weighted_score / total_count) * 100, 150.0)
    
    # 🛡️ SOVEREIGN DATABASE WRITEBACK
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if employee:
        # setattr is the gold standard for dynamic attribute updates in strict IDEs
        setattr(employee, 'missions_secured', total_count)
        setattr(employee, 'efficiency_rating', round(float(avg_rating), 2))
        db.commit()

    return float(avg_rating)