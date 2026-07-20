from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date

from app.core.database import get_db
from app.models.models import (
    Employee, 
    OPDAppointment, 
    WalkInTicket, 
    PatientVitals, 
    PatientConsultation, 
    Prescription, 
    LabOrder, 
    DoctorRoster,
    GuestCRM
)

router = APIRouter()

# ==========================================
# MODELS
# ==========================================
class DutyStatusUpdate(BaseModel):
    doctor_id: str
    status: str # "ON-DUTY" or "OFFLINE"

class ClinicalNoteCreate(BaseModel):
    patient_id: str
    doctor_id: str
    symptoms: Optional[str] = None
    examination: Optional[str] = None
    diagnosis_icd10: Optional[str] = None
    treatment_plan: Optional[str] = None

# ==========================================
# ENDPOINTS
# ==========================================

@router.post("/duty")
def update_duty_status(payload: DutyStatusUpdate, db: Session = Depends(get_db)):
    """Toggle doctor duty status (ON-DUTY / OFFLINE)"""
    emp = db.query(Employee).filter(Employee.id == payload.doctor_id).first()
    if not emp:
        # Fallback to checking by full name just in case
        emp = db.query(Employee).filter(Employee.full_name.ilike(f"%{payload.doctor_id}%")).first()
        if not emp:
            # Create a dummy employee if not found for testing purposes as per user
            emp = Employee(
                id=payload.doctor_id,
                full_name=payload.doctor_id,
                dept="CLINICAL",
                status=payload.status,
                position="Physician"
            )
            db.add(emp)
            db.commit()
            return {"status": "SUCCESS", "message": f"Created and logged duty for {payload.doctor_id}", "duty_status": emp.status}
            
    emp.status = payload.status
    db.commit()
    return {"status": "SUCCESS", "message": f"Duty status updated to {emp.status}", "duty_status": emp.status}

@router.get("/appointments")
def get_today_appointments(doctor_id: str, db: Session = Depends(get_db)):
    """Fetch today's aggregated schedule (OPD and Walk-In)"""
    today = date.today()
    
    # 1. Get OPD Appointments
    opd_apts = db.query(OPDAppointment).filter(
        OPDAppointment.doctor_id == doctor_id,
    ).all() # Skipping date filter for testing to ensure data returns
    
    # 2. Get Walk In Tickets
    walk_ins = db.query(WalkInTicket).filter(
        WalkInTicket.assigned_doctor_id == doctor_id,
    ).all()
    
    # Format them into a unified list
    unified_schedule = []
    
    for apt in opd_apts:
        patient = db.query(GuestCRM).filter(GuestCRM.id == apt.patient_id).first()
        patient_name = patient.full_name if patient else "Unknown Patient"
        unified_schedule.append({
            "id": f"OPD-{apt.id}",
            "time": apt.appointment_time.strftime("%I:%M %p") if apt.appointment_time else "TBD",
            "type": "VIDEO" if "VIDEO" in (apt.notes or "").upper() else "WARD",
            "patient": patient_name,
            "patientId": apt.patient_id,
            "reason": apt.notes or "General Consultation",
            "status": apt.status
        })
        
    for w in walk_ins:
        unified_schedule.append({
            "id": f"WI-{w.id}",
            "time": w.scheduled_time.strftime("%I:%M %p") if w.scheduled_time else "TBD",
            "type": "WALK-IN",
            "patient": w.patient_name,
            "patientId": w.patient_name, # Walk in tickets don't strictly link to GuestCRM in schema
            "reason": "Walk-In Token",
            "status": w.status
        })
        
    return {"status": "SUCCESS", "data": unified_schedule}

@router.get("/emr/{patient_id}")
def get_patient_emr(patient_id: str, db: Session = Depends(get_db)):
    """Fetch the Electronic Medical Record history for a patient"""
    # Vitals
    vitals = db.query(PatientVitals).filter(PatientVitals.patient_id == patient_id).order_by(PatientVitals.taken_at.desc()).first()
    
    # Consultations
    consults = db.query(PatientConsultation).filter(PatientConsultation.patient_id == patient_id).order_by(PatientConsultation.created_at.desc()).all()
    
    # Prescriptions
    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient_id).all()
    
    # Labs
    labs = db.query(LabOrder).filter(LabOrder.patient_id == patient_id).all()
    
    # Format
    vitals_str = "N/A"
    if vitals:
        vitals_str = f"BP: {vitals.blood_pressure or '-'}, HR: {vitals.heart_rate or '-'}, Temp: {vitals.temperature or '-'}°C, SpO2: {vitals.spo2 or '-'}%"
        
    history_str = "No prior consultations."
    if consults:
        history_str = "\n".join([f"[{c.created_at.strftime('%Y-%m-%d')}] {c.diagnosis_icd10 or 'No Diagnosis'}: {c.treatment_plan}" for c in consults])
        
    meds_str = "No active prescriptions."
    if prescriptions:
        meds_str = ", ".join([f"{p.medication_name} ({p.dosage})" for p in prescriptions])
        
    return {
        "status": "SUCCESS",
        "data": {
            "vitals": vitals_str,
            "history": history_str,
            "meds": meds_str,
            "labs": len(labs)
        }
    }

@router.post("/consultation")
def add_clinical_note(payload: ClinicalNoteCreate, db: Session = Depends(get_db)):
    """Add a new clinical consultation note (SOAP)"""
    new_note = PatientConsultation(
        patient_id=payload.patient_id,
        doctor_id=payload.doctor_id,
        symptoms=payload.symptoms,
        examination=payload.examination,
        diagnosis_icd10=payload.diagnosis_icd10,
        treatment_plan=payload.treatment_plan
    )
    db.add(new_note)
    db.commit()
    return {"status": "SUCCESS", "message": "Clinical note saved successfully."}

@router.get("/roster")
def get_doctor_roster(doctor_id: str, db: Session = Depends(get_db)):
    """GET ONLY: Fetch read-only roster schedule for a doctor. NO POST/PUT ENDPOINTS PERMITTED."""
    roster = db.query(DoctorRoster).filter(
        DoctorRoster.doctor_id == doctor_id,
        DoctorRoster.is_active == True
    ).order_by(DoctorRoster.day_of_week).all()
    
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    formatted_roster = []
    for r in roster:
        day_name = days[r.day_of_week] if 0 <= r.day_of_week <= 6 else "Unknown"
        formatted_roster.append({
            "id": r.id,
            "day": day_name,
            "shift": f"{r.start_time} - {r.end_time}",
            "department": r.department_code
        })
        
    return {"status": "SUCCESS", "data": formatted_roster}
@router.get("/list")
def get_doctor_list(db: Session = Depends(get_db)):
    from app.models.models import User
    doctors = db.query(Employee).join(User, Employee.user_id == User.id).filter(User.role.ilike("%DOCTOR%")).all()
    
    result = []
    for d in doctors:
        result.append({
            "id": d.id,
            "name": f"Dr. {d.name} {d.lastName}",
            "spec": d.dept_alignments[0] if d.dept_alignments else d.dept,
            "icon": "👨‍⚕️"
        })
    return {"status": "SUCCESS", "data": result}
