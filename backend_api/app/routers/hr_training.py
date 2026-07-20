# backend_api/app/routers/hr_training.py
# ZONE 09: HR AGI — TRAINING & CERTIFICATION ENGINE
# Links to Synapse StrategicDirective for task tracking
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import (
    Employee, TrainingProgram, TrainingEnrollment, StrategicDirective, DirectiveNode, AuditLog
)

logger = logging.getLogger("Zone09_HR_Training")
router = APIRouter(tags=["Zone 09: HR Training & Certifications"])

# Program schemas
class ProgramCreatePayload(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    expiry_months: Optional[int] = 12
    is_mandatory: Optional[bool] = False
    applicable_depts: Optional[List[str]] = []

@router.get("/hr/training/programs")
async def get_all_training_programs(db: Session = Depends(get_db)):
    try:
        programs = db.query(TrainingProgram).all()
        return {
            "status": "SUCCESS",
            "programs": [
                {
                    "id": p.id,
                    "name": p.name,
                    "category": p.category,
                    "description": p.description,
                    "expiry_months": p.expiry_months,
                    "is_mandatory": p.is_mandatory,
                    "applicable_depts": p.applicable_depts or [],
                    "created_at": p.created_at.isoformat() if p.created_at else None
                } for p in programs
            ]
        }
    except Exception as e:
        logger.error(f"TRAINING_PROGRAMS_GET_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/hr/training/programs")
async def create_training_program(payload: ProgramCreatePayload, db: Session = Depends(get_db)):
    try:
        new_prog = TrainingProgram(
            name=payload.name,
            category=payload.category,
            description=payload.description,
            expiry_months=payload.expiry_months,
            is_mandatory=payload.is_mandatory,
            applicable_depts=payload.applicable_depts,
            created_by="HR"
        )
        db.add(new_prog)
        db.commit()
        db.refresh(new_prog)

        db.add(AuditLog(
            action="TRAINING_PROGRAM_CREATED",
            operator="HR",
            target=f"Prog ID: {new_prog.id} | {new_prog.name}"
        ))
        db.commit()

        return {
            "status": "SUCCESS",
            "program_id": new_prog.id,
            "message": f"Training program '{new_prog.name}' created."
        }
    except Exception as e:
        db.rollback()
        logger.error(f"TRAINING_PROGRAM_CREATE_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Enrollment schemas
class EnrollPayload(BaseModel):
    employee_ids: List[str]
    program_id: int
    notes: Optional[str] = None

@router.post("/hr/training/enroll")
async def enroll_employees(payload: EnrollPayload, db: Session = Depends(get_db)):
    """Enroll employees in a training program. Auto-creates Synapse StrategicDirective."""
    try:
        program = db.query(TrainingProgram).filter(TrainingProgram.id == payload.program_id).first()
        if not program:
            raise HTTPException(status_code=404, detail="Training program not found")

        # Create Strategic Directive for the training program in Synapse
        directive = StrategicDirective(
            title=f"TRAINING CERTIFICATION: {program.name}",
            description=f"Mandatory training for certification in: {program.name}. Category: {program.category}.",
            status="ACTIVE",
            priority="STRATEGIC" if program.is_mandatory else "NORMAL",
            issued_by="HR_TRAINING_ENGINE",
            target_dept=program.category,
            tagged_operatives=payload.employee_ids
        )
        db.add(directive)
        db.flush() # Populate directive.id

        enrollments = []
        for emp_id in payload.employee_ids:
            emp = db.query(Employee).filter(Employee.id == emp_id).first()
            if not emp:
                continue
            
            # Create DirectiveNode for the employee
            node = DirectiveNode(
                directive_id=directive.id,
                task_name=f"Complete Certification for {program.name}",
                assigned_to_id=emp_id,
                target_dept=emp.dept,
                is_completed=False
            )
            db.add(node)
            db.flush()

            # Check if already enrolled in this active program
            existing = db.query(TrainingEnrollment).filter(
                TrainingEnrollment.employee_id == emp_id,
                TrainingEnrollment.program_id == payload.program_id,
                TrainingEnrollment.status.in_(["ENROLLED", "IN_PROGRESS"])
            ).first()

            if existing:
                existing.directive_id = directive.id
                existing.notes = payload.notes or existing.notes
            else:
                new_enrollment = TrainingEnrollment(
                    employee_id=emp_id,
                    program_id=payload.program_id,
                    directive_id=directive.id,
                    status="ENROLLED",
                    notes=payload.notes
                )
                db.add(new_enrollment)
            
            enrollments.append(emp_id)

        db.add(AuditLog(
            action="TRAINING_ENROLLMENT_BATCH",
            operator="HR",
            target=f"Prog ID: {program.id} | Staff count: {len(enrollments)} | Directive: {directive.id}"
        ))
        db.commit()

        return {
            "status": "SUCCESS",
            "enrolled_count": len(enrollments),
            "directive_id": directive.id,
            "message": f"Successfully enrolled {len(enrollments)} employees in '{program.name}'."
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"TRAINING_ENROLL_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/hr/training/status/{employee_id}")
async def get_employee_training_status(employee_id: str, db: Session = Depends(get_db)):
    try:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        enrollments = db.query(TrainingEnrollment).filter(
            TrainingEnrollment.employee_id == employee_id
        ).all()

        result = []
        for enroll in enrollments:
            prog = enroll.program
            # Sync status with Synapse DirectiveNode if active
            if enroll.directive_id and enroll.status in ("ENROLLED", "IN_PROGRESS"):
                node = db.query(DirectiveNode).filter(
                    DirectiveNode.directive_id == enroll.directive_id,
                    DirectiveNode.assigned_to_id == employee_id
                ).first()
                if node and node.is_completed:
                    enroll.status = "COMPLETED"
                    enroll.completed_at = node.completed_at or datetime.now(timezone.utc)
                    enroll.cert_expiry_date = enroll.completed_at + timedelta(days=30 * (prog.expiry_months or 12))
                    db.commit()

            # Check if cert is expired
            if enroll.status == "COMPLETED" and enroll.cert_expiry_date:
                now = datetime.now(timezone.utc)
                expiry = enroll.cert_expiry_date.replace(tzinfo=timezone.utc) if enroll.cert_expiry_date.tzinfo is None else enroll.cert_expiry_date
                if now > expiry:
                    enroll.status = "EXPIRED"
                    db.commit()

            result.append({
                "enrollment_id": enroll.id,
                "program_id": prog.id,
                "program_name": prog.name,
                "category": prog.category,
                "is_mandatory": prog.is_mandatory,
                "status": enroll.status,
                "enrolled_at": enroll.enrolled_at.isoformat() if enroll.enrolled_at else None,
                "completed_at": enroll.completed_at.isoformat() if enroll.completed_at else None,
                "cert_expiry_date": enroll.cert_expiry_date.isoformat() if enroll.cert_expiry_date else None,
                "directive_id": enroll.directive_id,
                "notes": enroll.notes
            })

        return {
            "status": "SUCCESS",
            "employee_id": employee_id,
            "employee_name": f"{emp.full_name} {emp.last_name or ''}".strip(),
            "training_records": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TRAINING_STATUS_GET_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/hr/training/alerts")
async def get_training_alerts(db: Session = Depends(get_db)):
    """Get all mandatory training enrollments that are pending or expired."""
    try:
        now = datetime.now(timezone.utc)
        
        # Expired or pending enrollments for mandatory programs
        enrollments = db.query(TrainingEnrollment).join(
            TrainingProgram, TrainingEnrollment.program_id == TrainingProgram.id
        ).filter(
            TrainingProgram.is_mandatory == True,
            TrainingEnrollment.status.in_(["ENROLLED", "IN_PROGRESS", "EXPIRED"])
        ).all()

        alerts = []
        for enroll in enrollments:
            emp = db.query(Employee).filter(Employee.id == enroll.employee_id).first()
            if not emp:
                continue

            alerts.append({
                "enrollment_id": enroll.id,
                "employee_id": enroll.employee_id,
                "employee_name": f"{emp.full_name} {emp.last_name or ''}".strip(),
                "dept": emp.dept,
                "program_name": enroll.program.name,
                "status": enroll.status,
                "cert_expiry_date": enroll.cert_expiry_date.isoformat() if enroll.cert_expiry_date else None,
                "notes": enroll.notes
            })

        return {
            "status": "SUCCESS",
            "alerts_count": len(alerts),
            "alerts": alerts
        }
    except Exception as e:
        logger.error(f"TRAINING_ALERTS_FAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))
