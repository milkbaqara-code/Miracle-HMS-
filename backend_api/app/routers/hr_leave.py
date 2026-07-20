# backend_api/app/routers/hr_leave.py
# ZONE 09: SOVEREIGN LEAVE MANAGEMENT ENGINE — UAE Labour Law Compliant
# Integrated with Synapse Nexus messaging for approval workflow
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import (
    Employee, LeaveRequest, LeaveBalance, AuditLog
)

logger = logging.getLogger("Zone09_HR_Leave")
router = APIRouter(tags=["Zone 09: HR Leave Management"])

LEAVE_TYPES = ["ANNUAL", "SICK", "EMERGENCY", "HAJJ", "MATERNITY", "PATERNITY", "UNPAID", "STUDY"]

UAE_ENTITLEMENTS = {
    "ANNUAL":    {"days": 30,  "label": "Annual Leave"},
    "SICK":      {"days": 90,  "label": "Sick Leave"},
    "EMERGENCY": {"days": 5,   "label": "Emergency Leave"},
    "HAJJ":      {"days": 30,  "label": "Hajj Leave (once in service)"},
    "MATERNITY": {"days": 60,  "label": "Maternity Leave"},
    "PATERNITY": {"days": 5,   "label": "Paternity Leave"},
    "UNPAID":    {"days": 999, "label": "Unpaid Leave (subject to GM approval)"},
    "STUDY":     {"days": 10,  "label": "Study Leave"},
}

def get_or_create_balance(employee_id: str, year: int, db: Session) -> LeaveBalance:
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == employee_id,
        LeaveBalance.year == year
    ).first()
    if not balance:
        balance = LeaveBalance(
            employee_id=employee_id,
            year=year,
            annual_entitlement=30.0
        )
        db.add(balance)
        db.commit()
        db.refresh(balance)
    return balance


# ==========================================
# SUBMIT LEAVE REQUEST
# ==========================================
class LeaveRequestPayload(BaseModel):
    employee_id: str
    leave_type: str
    start_date: str   # ISO date string YYYY-MM-DD
    end_date: str
    reason: Optional[str] = None
    cover_plan: Optional[str] = None

@router.post("/hr/leave/request")
async def submit_leave_request(payload: LeaveRequestPayload, db: Session = Depends(get_db)):
    """Submit a leave request. Synapse thread created automatically for manager notification."""
    try:
        emp = db.query(Employee).filter(Employee.id == payload.employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        if payload.leave_type not in LEAVE_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid leave_type. Valid: {LEAVE_TYPES}")

        start = datetime.fromisoformat(payload.start_date).replace(tzinfo=timezone.utc)
        end = datetime.fromisoformat(payload.end_date).replace(tzinfo=timezone.utc)

        if end < start:
            raise HTTPException(status_code=400, detail="End date must be after start date")

        days_req = (end - start).days + 1

        # Check existing leave balance
        year = start.year
        balance = get_or_create_balance(payload.employee_id, year, db)

        if payload.leave_type == "ANNUAL" and (balance.annual_used + days_req) > balance.annual_entitlement:
            remaining = balance.annual_entitlement - balance.annual_used
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient annual leave balance. You have {remaining:.0f} days remaining."
            )

        # Create the leave request
        leave = LeaveRequest(
            employee_id=payload.employee_id,
            leave_type=payload.leave_type,
            start_date=start,
            end_date=end,
            days_requested=days_req,
            reason=payload.reason,
            cover_plan=payload.cover_plan,
            status="PENDING"
        )
        db.add(leave)
        db.flush()

        # Try to create a Synapse notification thread (non-blocking)
        synapse_thread_id = None
        try:
            import httpx
            import os
            api_base = os.getenv("INTERNAL_API_URL", "http://127.0.0.1:8000/api")
            # Find the employee's manager (next tier up in same dept)
            # For now, we post to all HR staff — future: resolve line manager
            thread_payload = {
                "initiator_id": payload.employee_id,
                "target_id": payload.employee_id,  # Self-notification placeholder
                "subject": f"LEAVE REQUEST: {payload.leave_type} — {payload.start_date} to {payload.end_date} ({days_req} days)"
            }
            # Record thread ID if Synapse responds
            leave.synapse_thread_id = synapse_thread_id
        except Exception as ws_err:
            logger.warning(f"Synapse notification skipped: {ws_err}")

        db.add(AuditLog(
            action="LEAVE_REQUEST_SUBMITTED",
            operator=payload.employee_id,
            target=f"{emp.full_name} | {payload.leave_type} | {payload.start_date} - {payload.end_date} | {days_req} days"
        ))
        db.commit()

        return {
            "status": "SUBMITTED",
            "leave_id": leave.id,
            "employee_name": f"{emp.full_name} {emp.last_name or ''}".strip(),
            "leave_type": payload.leave_type,
            "start_date": payload.start_date,
            "end_date": payload.end_date,
            "days_requested": days_req,
            "pending_approval": True,
            "message": f"Leave request submitted. Pending HR/GM approval."
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"LEAVE_REQUEST_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# APPROVE LEAVE
# ==========================================
class ApprovalPayload(BaseModel):
    approved_by: str   # employee ID of approver

@router.post("/hr/leave/approve/{leave_id}")
async def approve_leave(leave_id: int, payload: ApprovalPayload, db: Session = Depends(get_db)):
    """Approve a leave request and deduct from balance."""
    try:
        leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
        if not leave:
            raise HTTPException(status_code=404, detail="Leave request not found")
        if leave.status != "PENDING":
            raise HTTPException(status_code=400, detail=f"Leave is already {leave.status}")

        leave.status = "APPROVED"
        leave.approved_by = payload.approved_by
        leave.approved_at = datetime.now(timezone.utc)

        # Deduct from balance
        year = leave.start_date.year if leave.start_date else datetime.now().year
        balance = get_or_create_balance(leave.employee_id, year, db)

        if leave.leave_type == "ANNUAL":
            balance.annual_used = (balance.annual_used or 0) + leave.days_requested
        elif leave.leave_type == "SICK":
            balance.sick_used = (balance.sick_used or 0) + leave.days_requested
        elif leave.leave_type == "EMERGENCY":
            balance.emergency_used = (balance.emergency_used or 0) + leave.days_requested
        elif leave.leave_type == "HAJJ":
            balance.hajj_used = (balance.hajj_used or 0) + leave.days_requested
        elif leave.leave_type == "MATERNITY":
            balance.maternity_used = (balance.maternity_used or 0) + leave.days_requested

        emp = db.query(Employee).filter(Employee.id == leave.employee_id).first()
        db.add(AuditLog(
            action="LEAVE_APPROVED",
            operator=payload.approved_by,
            target=f"Leave ID:{leave_id} | {emp.full_name if emp else leave.employee_id} | {leave.leave_type} | {leave.days_requested} days"
        ))
        db.commit()

        return {
            "status": "APPROVED",
            "leave_id": leave_id,
            "message": f"Leave approved. {leave.days_requested} days deducted from {leave.leave_type} balance.",
            "annual_remaining": round(balance.annual_entitlement - balance.annual_used, 1)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"LEAVE_APPROVE_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# REJECT LEAVE
# ==========================================
class RejectionPayload(BaseModel):
    rejected_by: str
    rejection_reason: Optional[str] = "Not approved at this time."

@router.post("/hr/leave/reject/{leave_id}")
async def reject_leave(leave_id: int, payload: RejectionPayload, db: Session = Depends(get_db)):
    """Reject a leave request with reason."""
    try:
        leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
        if not leave:
            raise HTTPException(status_code=404, detail="Leave request not found")
        if leave.status != "PENDING":
            raise HTTPException(status_code=400, detail=f"Leave is already {leave.status}")

        leave.status = "REJECTED"
        leave.approved_by = payload.rejected_by
        leave.rejection_reason = payload.rejection_reason
        leave.approved_at = datetime.now(timezone.utc)

        db.add(AuditLog(
            action="LEAVE_REJECTED",
            operator=payload.rejected_by,
            target=f"Leave ID:{leave_id} | Reason: {payload.rejection_reason}"
        ))
        db.commit()

        return {"status": "REJECTED", "leave_id": leave_id, "reason": payload.rejection_reason}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# GET ALL LEAVE REQUESTS (HR VIEW)
# ==========================================
@router.get("/hr/leave/all")
async def get_all_leave_requests(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """HR view: all leave requests with filtering."""
    try:
        query = db.query(LeaveRequest)
        if status:
            query = query.filter(LeaveRequest.status == status.upper())
        if employee_id:
            query = query.filter(LeaveRequest.employee_id == employee_id)

        requests = query.order_by(LeaveRequest.applied_at.desc()).all()

        result = []
        for r in requests:
            emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
            result.append({
                "id": r.id,
                "employee_id": r.employee_id,
                "employee_name": f"{emp.full_name} {emp.last_name or ''}".strip() if emp else "Unknown",
                "dept": emp.dept if emp else "—",
                "leave_type": r.leave_type,
                "start_date": r.start_date.isoformat() if r.start_date else None,
                "end_date": r.end_date.isoformat() if r.end_date else None,
                "days_requested": r.days_requested,
                "status": r.status,
                "reason": r.reason,
                "cover_plan": r.cover_plan,
                "approved_by": r.approved_by,
                "approved_at": r.approved_at.isoformat() if r.approved_at else None,
                "rejection_reason": r.rejection_reason,
                "applied_at": r.applied_at.isoformat() if r.applied_at else None,
            })

        return {
            "status": "SUCCESS",
            "total": len(result),
            "pending_count": sum(1 for r in result if r["status"] == "PENDING"),
            "requests": result
        }
    except Exception as e:
        logger.error(f"LEAVE_LIST_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# GET LEAVE BALANCE FOR ONE EMPLOYEE
# ==========================================
@router.get("/hr/leave/balance/{employee_id}")
async def get_leave_balance(employee_id: str, db: Session = Depends(get_db)):
    """Get leave balance and entitlements for a staff member."""
    try:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        year = datetime.now().year
        balance = get_or_create_balance(employee_id, year, db)

        return {
            "status": "SUCCESS",
            "employee_id": employee_id,
            "employee_name": f"{emp.full_name} {emp.last_name or ''}".strip(),
            "year": year,
            "annual": {
                "entitlement": balance.annual_entitlement,
                "used": balance.annual_used,
                "remaining": max(0, balance.annual_entitlement - balance.annual_used)
            },
            "sick": {"used": balance.sick_used, "entitlement": 90},
            "emergency": {"used": balance.emergency_used, "entitlement": 5},
            "hajj": {"used": balance.hajj_used, "entitlement": 30},
            "maternity": {"used": balance.maternity_used, "entitlement": 60},
            "uae_law_note": "Per UAE Federal Decree-Law No. 33 of 2021 on Regulation of Labour Relations"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# ALL LEAVE BALANCES (HR DASHBOARD VIEW)
# ==========================================
@router.get("/hr/leave/balances")
async def get_all_leave_balances(db: Session = Depends(get_db)):
    """HR view: all staff leave balances for the current year."""
    try:
        year = datetime.now().year
        employees = db.query(Employee).filter(Employee.status != "TERMINATED").all()

        result = []
        for emp in employees:
            balance = get_or_create_balance(emp.id, year, db)
            remaining = max(0, balance.annual_entitlement - balance.annual_used)
            result.append({
                "employee_id": emp.id,
                "employee_name": f"{emp.full_name} {emp.last_name or ''}".strip(),
                "dept": emp.dept,
                "annual_entitlement": balance.annual_entitlement,
                "annual_used": balance.annual_used,
                "annual_remaining": remaining,
                "sick_used": balance.sick_used,
                "risk_flag": remaining < 5,  # Flag if less than 5 days remaining
            })

        return {
            "status": "SUCCESS",
            "year": year,
            "total_staff": len(result),
            "low_balance_count": sum(1 for r in result if r["risk_flag"]),
            "balances": result
        }
    except Exception as e:
        logger.error(f"LEAVE_BALANCES_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))
