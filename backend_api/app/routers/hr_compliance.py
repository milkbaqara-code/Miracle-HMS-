# backend_api/app/routers/hr_compliance.py
# ZONE 09: SOVEREIGN COMPLIANCE ENGINE — Document Expiry & UAE Labour Law
# Integrated with Synapse StaffVault (VaultFile infrastructure)
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import (
    Employee, EmployeeDocument, StaffVault, VaultFile, AuditLog
)

logger = logging.getLogger("Zone09_HR_Compliance")
router = APIRouter(tags=["Zone 09: HR Compliance Engine"])

DOC_TYPES = [
    "VISA", "EMIRATES_ID", "PASSPORT", "HEALTH_CARD",
    "WORK_PERMIT", "LABOUR_CONTRACT", "INSURANCE_CARD", "DRIVING_LICENSE"
]

def compute_alert_status(expiry_date: Optional[datetime]) -> str:
    if not expiry_date:
        return "UNKNOWN"
    now = datetime.now(timezone.utc)
    exp = expiry_date.replace(tzinfo=timezone.utc) if expiry_date.tzinfo is None else expiry_date
    delta = (exp - now).days
    if delta < 0:
        return "EXPIRED"
    elif delta <= 7:
        return "CRITICAL"
    elif delta <= 30:
        return "EXPIRING_30"
    elif delta <= 60:
        return "EXPIRING_60"
    return "OK"

def days_remaining(expiry_date: Optional[datetime]) -> Optional[int]:
    if not expiry_date:
        return None
    now = datetime.now(timezone.utc)
    exp = expiry_date.replace(tzinfo=timezone.utc) if expiry_date.tzinfo is None else expiry_date
    return (exp - now).days

# ==========================================
# GET ALL DOCUMENTS FOR ONE EMPLOYEE
# ==========================================
@router.get("/hr/compliance/documents/{employee_id}")
async def get_employee_documents(employee_id: str, db: Session = Depends(get_db)):
    """Returns all compliance documents for a staff member with live alert status."""
    try:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        docs = db.query(EmployeeDocument).filter(
            EmployeeDocument.employee_id == employee_id
        ).order_by(EmployeeDocument.expiry_date.asc()).all()

        result = []
        for d in docs:
            alert = compute_alert_status(d.expiry_date)
            dr = days_remaining(d.expiry_date)
            result.append({
                "id": d.id,
                "employee_id": d.employee_id,
                "doc_type": d.doc_type,
                "doc_number": d.doc_number,
                "issue_date": d.issue_date.isoformat() if d.issue_date else None,
                "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
                "days_remaining": dr,
                "alert_status": alert,
                "issuing_authority": d.issuing_authority,
                "vault_file_id": d.vault_file_id,
                "notes": d.notes,
                "uploaded_by": d.uploaded_by,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            })

        return {
            "status": "SUCCESS",
            "employee_id": employee_id,
            "employee_name": f"{emp.full_name} {emp.last_name or ''}".strip(),
            "documents": result,
            "critical_count": sum(1 for r in result if r["alert_status"] in ("EXPIRED", "CRITICAL")),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"COMPLIANCE_DOCS_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# REGISTER / UPDATE A DOCUMENT
# ==========================================
class DocumentPayload(BaseModel):
    doc_type: str
    doc_number: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    issuing_authority: Optional[str] = None
    notes: Optional[str] = None
    uploaded_by: Optional[str] = "HR"

@router.post("/hr/compliance/documents/{employee_id}")
async def register_document(
    employee_id: str,
    payload: DocumentPayload,
    db: Session = Depends(get_db)
):
    """Register or update a compliance document for a staff member."""
    try:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        if payload.doc_type not in DOC_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid doc_type. Must be one of: {DOC_TYPES}")

        # Check if this doc_type already exists for this employee
        existing = db.query(EmployeeDocument).filter(
            EmployeeDocument.employee_id == employee_id,
            EmployeeDocument.doc_type == payload.doc_type
        ).first()

        issue_dt = datetime.fromisoformat(payload.issue_date) if payload.issue_date else None
        expiry_dt = datetime.fromisoformat(payload.expiry_date) if payload.expiry_date else None

        if existing:
            existing.doc_number = payload.doc_number or existing.doc_number
            existing.issue_date = issue_dt or existing.issue_date
            existing.expiry_date = expiry_dt or existing.expiry_date
            existing.issuing_authority = payload.issuing_authority or existing.issuing_authority
            existing.notes = payload.notes or existing.notes
            existing.uploaded_by = payload.uploaded_by
            doc_id = existing.id
        else:
            new_doc = EmployeeDocument(
                employee_id=employee_id,
                doc_type=payload.doc_type,
                doc_number=payload.doc_number,
                issue_date=issue_dt,
                expiry_date=expiry_dt,
                issuing_authority=payload.issuing_authority,
                notes=payload.notes,
                uploaded_by=payload.uploaded_by,
            )
            db.add(new_doc)
            db.flush()
            doc_id = new_doc.id

        # Audit
        db.add(AuditLog(
            action="COMPLIANCE_DOC_REGISTERED",
            operator=payload.uploaded_by or "HR",
            target=f"{employee_id} | {payload.doc_type} | expires: {payload.expiry_date}"
        ))
        db.commit()

        alert = compute_alert_status(expiry_dt)
        return {
            "status": "SUCCESS",
            "doc_id": doc_id,
            "alert_status": alert,
            "days_remaining": days_remaining(expiry_dt),
            "message": f"{payload.doc_type} registered for {emp.full_name}."
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"COMPLIANCE_REG_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# GLOBAL COMPLIANCE ALERTS DASHBOARD
# ==========================================
@router.get("/hr/compliance/alerts")
async def get_compliance_alerts(days: int = 60, db: Session = Depends(get_db)):
    """Returns all staff documents expiring within N days (default 60). Critical first."""
    try:
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=days)

        docs = db.query(EmployeeDocument).filter(
            EmployeeDocument.expiry_date <= cutoff
        ).order_by(EmployeeDocument.expiry_date.asc()).all()

        alerts = []
        for d in docs:
            emp = db.query(Employee).filter(Employee.id == d.employee_id).first()
            alert = compute_alert_status(d.expiry_date)
            dr = days_remaining(d.expiry_date)
            alerts.append({
                "id": d.id,
                "employee_id": d.employee_id,
                "employee_name": f"{emp.full_name} {emp.last_name or ''}".strip() if emp else "Unknown",
                "dept": emp.dept if emp else "—",
                "doc_type": d.doc_type,
                "doc_number": d.doc_number,
                "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
                "days_remaining": dr,
                "alert_status": alert,
            })

        # Sort: EXPIRED first, then CRITICAL, then EXPIRING_30, then EXPIRING_60
        priority_order = {"EXPIRED": 0, "CRITICAL": 1, "EXPIRING_30": 2, "EXPIRING_60": 3}
        alerts.sort(key=lambda x: priority_order.get(x["alert_status"], 9))

        return {
            "status": "SUCCESS",
            "total_alerts": len(alerts),
            "expired_count": sum(1 for a in alerts if a["alert_status"] == "EXPIRED"),
            "critical_count": sum(1 for a in alerts if a["alert_status"] == "CRITICAL"),
            "alerts": alerts,
        }
    except Exception as e:
        logger.error(f"COMPLIANCE_ALERTS_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# UAE END-OF-SERVICE GRATUITY CALCULATOR
# UAE Labour Law: Federal Law No. 33 of 2021
# ==========================================
@router.get("/hr/compliance/gratuity/{employee_id}")
async def calculate_gratuity(employee_id: str, db: Session = Depends(get_db)):
    """Calculate UAE End-of-Service gratuity entitlement per Federal Law No. 33 of 2021."""
    try:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        if not emp.joined_date:
            return {"status": "ERROR", "message": "No joining date on record"}

        now = datetime.now(timezone.utc)
        joined = emp.joined_date.replace(tzinfo=timezone.utc) if emp.joined_date.tzinfo is None else emp.joined_date
        total_days = (now - joined).days
        total_years = total_days / 365.25

        base = float(emp.base_salary or 0.0)
        daily_wage = base / 30.0  # UAE: gratuity calculated on 30-day month

        # UAE Gratuity Formula:
        # First 5 years: 21 calendar days per year of service
        # After 5 years: 30 calendar days per year of service
        # Maximum cap: 2 years' total wage
        if total_years <= 0:
            gratuity = 0.0
        elif total_years <= 5:
            gratuity = daily_wage * 21 * total_years
        else:
            gratuity_first_5 = daily_wage * 21 * 5
            gratuity_after_5 = daily_wage * 30 * (total_years - 5)
            gratuity = gratuity_first_5 + gratuity_after_5

        # Cap at 2 years' wage
        max_gratuity = base * 24
        gratuity = min(gratuity, max_gratuity)

        return {
            "status": "SUCCESS",
            "employee_id": employee_id,
            "employee_name": f"{emp.full_name} {emp.last_name or ''}".strip(),
            "joined_date": joined.isoformat(),
            "service_days": total_days,
            "service_years": round(total_years, 2),
            "base_salary": base,
            "daily_wage": round(daily_wage, 2),
            "gratuity_entitlement": round(gratuity, 2),
            "currency": "AED",
            "calculation_note": (
                "First 5 years: 21 days/year × daily wage. "
                "After 5 years: 30 days/year × daily wage. "
                "Capped at 24 months' base salary. (UAE Federal Law No. 33 of 2021)"
            )
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GRATUITY_CALC_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# DELETE A DOCUMENT RECORD
# ==========================================
@router.delete("/hr/compliance/documents/{doc_id}")
async def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(EmployeeDocument).filter(EmployeeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"status": "SUCCESS", "message": "Document record purged."}
