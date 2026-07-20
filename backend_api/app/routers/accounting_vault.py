from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.models.models import FinancialDocument, PayrollLog, Employee, AuditLog

class DummyUser:
    id = "1"
    role = "ADMIN"
    username = "admin"

def get_current_user():
    return DummyUser()

router = APIRouter(prefix="/accounting/vault", tags=["Accounting Vault"])

# ==========================================
# ZONE 18: SOVEREIGN ACCOUNTING VAULT
# All writes use nested savepoints (Iron Law 3: CRYPTOGRAPHIC ACID ISOLATION)
# ==========================================

@router.get("/documents", response_model=Dict[str, Any])
def list_documents(
    doc_type: Optional[str] = None,
    employee_id: Optional[str] = None,
    month: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Fetch financial documents from the Sovereign Vault.
    Operatives: Only their own SALARY_SLIPs.
    Admin/CEO/Accounts: Full unrestricted access with filters.
    """
    query = db.query(FinancialDocument)

    if doc_type:
        query = query.filter(FinancialDocument.doc_type == doc_type.upper())

    if employee_id:
        query = query.filter(FinancialDocument.employee_id == employee_id)

    # Role-based access control
    if current_user.role not in ["CEO", "ADMIN", "ACCOUNTING"]:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            return {"status": "SUCCESS", "documents": [], "total": 0}
        query = query.filter(
            FinancialDocument.doc_type == "SALARY_SLIP",
            FinancialDocument.employee_id == emp.id
        )

    docs = query.order_by(desc(FinancialDocument.created_at)).limit(limit).all()

    return {
        "status": "SUCCESS",
        "total": len(docs),
        "documents": [
            {
                "id": doc.id,
                "doc_type": doc.doc_type,
                "doc_ref": doc.doc_ref,
                "description": doc.description,
                "amount": doc.amount,
                "employee_id": doc.employee_id,
                "file_url": doc.file_url,
                "generated_by": doc.generated_by,
                "created_at": doc.created_at.isoformat()
            } for doc in docs
        ]
    }


@router.post("/documents", response_model=Dict[str, Any])
def register_document(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Register a newly generated PDF document into the Sovereign Vault.
    Requires Admin-level clearance. Uses ACID-isolated savepoint.
    """
    if current_user.role not in ["CEO", "ADMIN", "ACCOUNTING"]:
        raise HTTPException(status_code=403, detail="Sovereign Audit Error: Insufficient clearance.")

    try:
        with db.begin_nested():
            new_doc = FinancialDocument(
                doc_type=data.get("doc_type", "MISC").upper(),
                doc_ref=f"SVD-{uuid.uuid4().hex[:8].upper()}",
                description=data.get("description"),
                amount=float(data.get("amount", 0.0)),
                employee_id=data.get("employee_id"),
                file_url=data.get("file_url", ""),
                generated_by=current_user.username
            )
            db.add(new_doc)

            # Immutable audit trail (Iron Law 8)
            audit = AuditLog(
                action=f"VAULT_DOCUMENT_REGISTERED: {new_doc.doc_type}",
                operator=current_user.username,
                target=new_doc.doc_ref
            )
            db.add(audit)

        db.commit()
        db.refresh(new_doc)

        return {
            "status": "SUCCESS",
            "message": "Document secured in Sovereign Vault.",
            "doc_ref": new_doc.doc_ref,
            "id": new_doc.id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Vault Write Error: {str(e)}")


@router.get("/payroll/calculate", response_model=Dict[str, Any])
def calculate_payroll(
    month_year: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Calculate payroll for all active employees.
    Returns: base salary + commission rate applied to revenue_impact.
    This is READ-ONLY - use /payroll/run to execute the actual payout.
    """
    if current_user.role not in ["CEO", "ADMIN", "ACCOUNTING"]:
        raise HTTPException(status_code=403, detail="Payroll access requires Finance clearance.")

    period = month_year or datetime.now(timezone.utc).strftime("%m-%Y")
    employees = db.query(Employee).filter(Employee.status != "TERMINATED").all()

    calculations = []
    grand_total = 0.0

    for emp in employees:
        base = float(emp.base_salary or 0.0)
        commission = float(emp.commission_rate or 0.0) * float(emp.revenue_impact or 0.0)
        total = base + commission
        grand_total += total

        # Check if already paid this period
        existing_log = db.query(PayrollLog).filter(
            PayrollLog.employee_id == emp.id,
            PayrollLog.month_year == period
        ).first()

        calculations.append({
            "employee_id": emp.id,
            "name": emp.full_name,
            "position": emp.position,
            "dept": emp.dept,
            "base_salary": round(base, 2),
            "commission": round(commission, 2),
            "total": round(total, 2),
            "already_paid": existing_log is not None,
            "pay_status": existing_log.status if existing_log else "PENDING"
        })

    return {
        "status": "SUCCESS",
        "period": period,
        "employee_count": len(calculations),
        "grand_total": round(grand_total, 2),
        "calculations": calculations
    }


@router.post("/payroll/run", response_model=Dict[str, Any])
def run_payroll(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Execute the payroll run for a given month.
    Creates PayrollLog entries and marks them GENERATED.
    Uses ACID-isolated savepoint to prevent partial payroll states.
    Only CEO/Admin can trigger this.
    """
    if current_user.role not in ["CEO", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Payroll execution requires CEO/Admin authority.")

    period = data.get("month_year", datetime.now(timezone.utc).strftime("%m-%Y"))
    employees = db.query(Employee).filter(Employee.status != "TERMINATED").all()

    if not employees:
        raise HTTPException(status_code=404, detail="No active employees found in the registry.")

    logs_created = []
    total_disbursed = 0.0

    try:
        with db.begin_nested():
            for emp in employees:
                # Skip if already processed this period
                existing = db.query(PayrollLog).filter(
                    PayrollLog.employee_id == emp.id,
                    PayrollLog.month_year == period
                ).first()
                if existing:
                    continue

                base = float(emp.base_salary or 0.0)
                commission = float(emp.commission_rate or 0.0) * float(emp.revenue_impact or 0.0)
                total = base + commission

                log = PayrollLog(
                    month_year=period,
                    employee_id=emp.id,
                    base_salary_calculated=round(base, 2),
                    commission_calculated=round(commission, 2),
                    total_paid=round(total, 2),
                    status="GENERATED"
                )
                db.add(log)
                total_disbursed += total
                logs_created.append(emp.full_name)

            # Sovereign Audit Entry
            audit = AuditLog(
                action=f"PAYROLL_RUN_EXECUTED: {period} | {len(logs_created)} operatives | Total: {round(total_disbursed, 2)}",
                operator=current_user.username,
                target=f"PAYROLL_{period}"
            )
            db.add(audit)

        db.commit()

        return {
            "status": "SUCCESS",
            "message": f"Payroll Run Complete. {len(logs_created)} operative(s) processed.",
            "period": period,
            "operatives_processed": len(logs_created),
            "total_disbursed": round(total_disbursed, 2),
            "processed_names": logs_created
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Payroll Run Failed: {str(e)}")


@router.get("/payroll/history", response_model=Dict[str, Any])
def payroll_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Fetch the complete immutable payroll audit history.
    Grouped by period for clean display in the Vault UI.
    """
    if current_user.role not in ["CEO", "ADMIN", "ACCOUNTING"]:
        raise HTTPException(status_code=403, detail="Insufficient clearance for payroll history.")

    logs = db.query(PayrollLog).order_by(desc(PayrollLog.created_at)).limit(limit).all()

    # Group by period
    periods: Dict[str, Any] = {}
    for log in logs:
        period = log.month_year or "UNKNOWN"
        if period not in periods:
            periods[period] = {
                "period": period,
                "total_disbursed": 0.0,
                "count": 0,
                "entries": []
            }
        periods[period]["total_disbursed"] += log.total_paid
        periods[period]["count"] += 1
        periods[period]["entries"].append({
            "id": log.id,
            "employee_id": log.employee_id,
            "base": log.base_salary_calculated,
            "commission": log.commission_calculated,
            "total": log.total_paid,
            "status": log.status,
            "created_at": log.created_at.isoformat()
        })

    # Round totals
    for p in periods.values():
        p["total_disbursed"] = round(p["total_disbursed"], 2)

    return {
        "status": "SUCCESS",
        "total_runs": len(periods),
        "history": list(periods.values())
    }


@router.patch("/payroll/{log_id}/mark-paid", response_model=Dict[str, Any])
def mark_payroll_paid(
    log_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Promote a payroll log from GENERATED to PAID status. CEO-only authority."""
    if current_user.role not in ["CEO", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Mark-paid requires CEO authority.")

    log = db.query(PayrollLog).filter(PayrollLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Payroll log not found.")

    try:
        with db.begin_nested():
            log.status = "PAID"
            audit = AuditLog(
                action=f"PAYROLL_MARKED_PAID: Log #{log_id}",
                operator=current_user.username,
                target=f"PAYROLL_LOG_{log_id}"
            )
            db.add(audit)
        db.commit()
        return {"status": "SUCCESS", "message": "Payroll entry marked as PAID."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
