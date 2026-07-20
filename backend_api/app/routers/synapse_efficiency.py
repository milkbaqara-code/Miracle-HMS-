"""
SYNAPSE EFFICIENCY ENGINE — Zone 20 ↔ Zone 17 Performance Sync
Calculates operative response time from directive_nodes.started_at → completed_at
Syncs avg_response_minutes + stars to Employee table (Zone 17)
Auto-deletes COMPLETED directives after 48 hours.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta, timezone
import logging

from app.core.database import get_db
from ..models.models import DirectiveNode, StrategicDirective, Employee, AuditLog

router = APIRouter(prefix="/api/synapse/efficiency", tags=["Synapse Efficiency"])
logger = logging.getLogger("synapse_efficiency")

# ─── STAR THRESHOLDS (minutes) ──────────────────────────────────────────────
# Based on industry hotel operations standards
STAR_THRESHOLDS = [
    (0,   10,  5),   # 0–10 min avg → 5 stars (Elite)
    (10,  20,  4),   # 10–20 min   → 4 stars (Excellent)
    (20,  40,  3),   # 20–40 min   → 3 stars (Good)
    (40,  60,  2),   # 40–60 min   → 2 stars (Average)
    (60,  9999, 1),  # 60+ min      → 1 star  (Needs Improvement)
]

def minutes_to_stars(avg_minutes: float) -> int:
    for low, high, stars in STAR_THRESHOLDS:
        if low <= avg_minutes < high:
            return stars
    return 1


def recalculate_operative(employee_id: str, db: Session) -> dict:
    """
    Pull all completed directive_nodes for this operative,
    compute avg response minutes, update Employee record.
    Returns summary dict.
    """
    nodes = (
        db.query(DirectiveNode)
        .filter(
            DirectiveNode.assigned_to_id == employee_id,
            DirectiveNode.is_completed == True,
            DirectiveNode.started_at != None,
            DirectiveNode.completed_at != None,
        )
        .all()
    )

    if not nodes:
        return {"employee_id": employee_id, "tasks_completed": 0, "avg_response_minutes": None, "stars": None}

    durations = []
    for n in nodes:
        delta_seconds = (n.completed_at - n.started_at).total_seconds()
        if delta_seconds >= 0:
            durations.append(delta_seconds / 60.0)

    if not durations:
        return {"employee_id": employee_id, "tasks_completed": 0, "avg_response_minutes": None, "stars": None}

    avg_minutes = round(sum(durations) / len(durations), 1)
    stars = minutes_to_stars(avg_minutes)
    tasks_done = len(durations)

    # Sync to Employee table (Zone 17)
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if emp:
        emp.avg_response_minutes = avg_minutes
        emp.performance_stars = stars
        emp.tasks_completed = tasks_done
        db.commit()

    return {
        "employee_id": employee_id,
        "tasks_completed": tasks_done,
        "avg_response_minutes": avg_minutes,
        "stars": stars,
    }


@router.get("/sync-all")
def sync_all_operatives(db: Session = Depends(get_db)):
    """
    Recalculate performance for all operatives who have at least one completed node.
    Called by a scheduler or manually by HR / CDO.
    """
    operative_ids = (
        db.query(DirectiveNode.assigned_to_id)
        .filter(DirectiveNode.assigned_to_id != None, DirectiveNode.is_completed == True)
        .distinct()
        .all()
    )
    results = []
    for (emp_id,) in operative_ids:
        r = recalculate_operative(emp_id, db)
        results.append(r)

    db.add(AuditLog(
        action="EFFICIENCY_SYNC: Global performance recalculated",
        operator="SYSTEM_AGI",
        target="ALL_OPERATIVES"
    ))
    db.commit()

    return {"status": "SUCCESS", "synced": len(results), "results": results}


@router.get("/operative/{employee_id}")
def get_operative_efficiency(employee_id: str, db: Session = Depends(get_db)):
    """Get live efficiency stats for one operative (Zone 17 profile call)."""
    result = recalculate_operative(employee_id, db)
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    return {
        "status": "SUCCESS",
        "efficiency": result,
        "profile": {
            "name": emp.full_name if emp else employee_id,
            "dept": emp.department if emp else None,
            "stars": emp.performance_stars if emp else None,
            "avg_response_minutes": emp.avg_response_minutes if emp else None,
            "tasks_completed": emp.tasks_completed if emp else None,
        }
    }


@router.delete("/purge-completed")
def purge_completed_directives(db: Session = Depends(get_db)):
    """
    Auto-delete COMPLETED directives older than 48 hours.
    Designed to be called by a cron / APScheduler task.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    expired = (
        db.query(StrategicDirective)
        .filter(
            StrategicDirective.status == "COMPLETED",
            StrategicDirective.updated_at <= cutoff,
        )
        .all()
    )

    deleted_ids = [d.id for d in expired]
    for d in expired:
        db.add(AuditLog(
            action=f"AUTO_PURGE: DIR_{d.id} '{d.title}' deleted after 48h completion",
            operator="SYSTEM_AGI",
            target=f"DIR_{d.id}"
        ))
        db.delete(d)

    db.commit()
    logger.info(f"[PURGE] Deleted {len(deleted_ids)} completed directives: {deleted_ids}")
    return {"status": "SUCCESS", "purged": len(deleted_ids), "directive_ids": deleted_ids}
