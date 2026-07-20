from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.models import (
    PatientVitals, PatientConsultation, Prescription, LabOrder, GuestCRM, Inventory, ActiveOccupancy,
    InsuranceClaim, OPDAppointment, GuestFolio, DoctorRoster, WalkInTicket
)
from app.models.models import Employee
from datetime import date, timedelta
import math

router = APIRouter(prefix="/hms", tags=["Healthcare Management"])

# --- PYDANTIC SCHEMAS ---
class VitalsCreate(BaseModel):
    patient_id: str  # Can be guest_crm_id, patient name, or bed room_number
    heart_rate: Optional[int] = None
    blood_pressure: Optional[str] = None
    temperature: Optional[float] = None
    spo2: Optional[int] = None
    weight_kg: Optional[float] = None

class PrescriptionItem(BaseModel):
    product_id: str
    dosage: str
    frequency: str
    duration_days: int

class ConsultationCreate(BaseModel):
    patient_id: str  # Can be guest_crm_id, patient name, or bed room_number
    doctor_id: str
    symptoms: Optional[str] = None
    examination: Optional[str] = None
    diagnosis_icd10: Optional[str] = None
    treatment_plan: Optional[str] = None
    prescriptions: List[PrescriptionItem] = []

class LabOrderCreate(BaseModel):
    patient_id: str
    test_name: str

class LabResultSubmit(BaseModel):
    result_text: str

class AppointmentCreate(BaseModel):
    patient_id: str
    doctor_id: str
    appointment_time: datetime
    notes: Optional[str] = None

class RosterCreate(BaseModel):
    doctor_id: str
    department_code: str
    day_of_week: int  # 0=Mon, 6=Sun
    start_time: str   # e.g. "09:00"
    end_time: str     # e.g. "14:00"
    max_patients: int = 20

class RosterUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    max_patients: Optional[int] = None
    is_active: Optional[bool] = None

class WalkInTicketCreate(BaseModel):
    patient_name: str
    department_code: str
    assigned_doctor_id: Optional[str] = None

class ADTTransferRequest(BaseModel):
    patient_id: str
    target_bed_id: str

class SplitSettlementRequest(BaseModel):
    folio_id: str
    provider_name: str
    policy_number: str

# Helper to resolve patient from ID, Name, or active occupancy Bed Number
def resolve_patient(patient_ref: str, db: Session) -> GuestCRM:
    # 1. Try by Guest CRM ID
    patient = db.query(GuestCRM).filter(GuestCRM.id == patient_ref).first()
    if patient:
        return patient
        
    # 2. Try by Active Occupancy Bed Number (e.g. "CABIN-02")
    occ = db.query(ActiveOccupancy).filter(ActiveOccupancy.room_number == patient_ref).first()
    if occ:
        patient = db.query(GuestCRM).filter(GuestCRM.id == occ.guest_crm_id).first()
        if patient:
            return patient
            
    # 3. Try by Name
    patient = db.query(GuestCRM).filter(GuestCRM.full_name == patient_ref).first()
    if patient:
        return patient
        
    raise HTTPException(status_code=404, detail=f"Patient not found for reference: {patient_ref}")

# --- ENDPOINTS ---

# 1. Nurse Triage: Log Patient Vitals
@router.post("/vitals", status_code=status.HTTP_201_CREATED)
def log_vitals(data: VitalsCreate, db: Session = Depends(get_db)):
    patient = resolve_patient(data.patient_id, db)
    
    vitals = PatientVitals(
        patient_id=patient.id,
        heart_rate=data.heart_rate,
        blood_pressure=data.blood_pressure,
        temperature=data.temperature,
        spo2=data.spo2,
        weight_kg=data.weight_kg
    )
    db.add(vitals)
    db.commit()
    db.refresh(vitals)
    return {"status": "SUCCESS", "message": "Vitals logged successfully", "data": vitals}

# 2. Get Patient Vitals History
@router.get("/vitals/{patient_id}")
def get_vitals_history(patient_id: str, db: Session = Depends(get_db)):
    patient = resolve_patient(patient_id, db)
    vitals = db.query(PatientVitals).filter(PatientVitals.patient_id == patient.id).order_by(PatientVitals.taken_at.desc()).all()
    return {"status": "SUCCESS", "data": vitals}

# 3. Doctor Consult: Log SOAP notes and generate prescriptions
@router.post("/consultations", status_code=status.HTTP_201_CREATED)
def create_consultation(data: ConsultationCreate, db: Session = Depends(get_db)):
    patient = resolve_patient(data.patient_id, db)

    # Create Consultation Log
    consultation = PatientConsultation(
        patient_id=patient.id,
        doctor_id=data.doctor_id,
        symptoms=data.symptoms,
        examination=data.examination,
        diagnosis_icd10=data.diagnosis_icd10,
        treatment_plan=data.treatment_plan
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    # Add Prescribed Medications
    prescribed_items = []
    for item in data.prescriptions:
        drug = db.query(Inventory).filter(Inventory.product_id == item.product_id).first()
        if not drug:
            drug = db.query(Inventory).filter(Inventory.name == item.product_id).first()
            if not drug:
                continue

        prescription = Prescription(
            consultation_id=consultation.id,
            product_id=drug.product_id,
            dosage=item.dosage,
            frequency=item.frequency,
            duration_days=item.duration_days,
            dispense_status="PENDING"
        )
        db.add(prescription)
        prescribed_items.append(prescription)

    db.commit()
    return {
        "status": "SUCCESS", 
        "message": "Consultation logged successfully", 
        "consultation_id": consultation.id,
        "prescriptions_count": len(prescribed_items)
    }

# 4. Get Patient Consultation History
@router.get("/consultations/{patient_id}")
def get_consultation_history(patient_id: str, db: Session = Depends(get_db)):
    patient = resolve_patient(patient_id, db)
    consultations = db.query(PatientConsultation).filter(PatientConsultation.patient_id == patient.id).order_by(PatientConsultation.created_at.desc()).all()
    
    result = []
    for c in consultations:
        prescriptions = db.query(Prescription).filter(Prescription.consultation_id == c.id).all()
        drugs_list = []
        for p in prescriptions:
            drug = db.query(Inventory).filter(Inventory.product_id == p.product_id).first()
            drugs_list.append({
                "prescription_id": p.id,
                "drug_id": p.product_id,
                "drug_name": drug.name if drug else "Unknown Medicine",
                "dosage": p.dosage,
                "frequency": p.frequency,
                "duration_days": p.duration_days,
                "status": p.dispense_status
            })
        
        result.append({
            "id": c.id,
            "doctor_id": c.doctor_id,
            "symptoms": c.symptoms,
            "examination": c.examination,
            "diagnosis_icd10": c.diagnosis_icd10,
            "treatment_plan": c.treatment_plan,
            "created_at": c.created_at,
            "prescriptions": drugs_list
        })
        
    return {"status": "SUCCESS", "data": result}

# 5. Pharmacy View: Get all pending prescriptions
@router.get("/prescriptions")
def get_pending_prescriptions(db: Session = Depends(get_db)):
    prescriptions = db.query(Prescription).filter(Prescription.dispense_status == "PENDING").all()
    result = []
    for p in prescriptions:
        consult = db.query(PatientConsultation).filter(PatientConsultation.id == p.consultation_id).first()
        patient = db.query(GuestCRM).filter(GuestCRM.id == consult.patient_id).first() if consult else None
        drug = db.query(Inventory).filter(Inventory.product_id == p.product_id).first()
        
        result.append({
            "id": p.id,
            "patient_name": patient.full_name if patient else "Unknown Patient",
            "drug_name": drug.name if drug else "Unknown Medicine",
            "product_id": p.product_id,
            "dosage": p.dosage,
            "frequency": p.frequency,
            "duration_days": p.duration_days,
            "created_at": p.created_at
        })
    return {"status": "SUCCESS", "data": result}

# 6. Pharmacy: Dispense Medicine
@router.post("/prescriptions/{id}/dispense")
def dispense_prescription(id: int, db: Session = Depends(get_db)):
    prescription = db.query(Prescription).filter(Prescription.id == id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if prescription.dispense_status == "DISPENSED":
        raise HTTPException(status_code=400, detail="Prescription already dispensed")

    # Update Stock
    drug = db.query(Inventory).filter(Inventory.product_id == prescription.product_id).first()
    if drug:
        freq_factor = 1
        freq_upper = prescription.frequency.upper()
        if "BID" in freq_upper or "TWICE" in freq_upper:
            freq_factor = 2
        elif "TID" in freq_upper or "THRICE" in freq_upper:
            freq_factor = 3
        elif "QID" in freq_upper:
            freq_factor = 4
            
        qty_needed = prescription.duration_days * freq_factor
        if drug.stock < qty_needed:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient pharmacy inventory stock. Available: {drug.stock}, Needed: {qty_needed}"
            )
        
        drug.stock -= qty_needed

    prescription.dispense_status = "DISPENSED"
    db.commit()
    return {"status": "SUCCESS", "message": "Medicine dispensed and stock updated successfully"}

# 7. Create Lab Test Order
@router.post("/lab-orders", status_code=status.HTTP_201_CREATED)
def create_lab_order(data: LabOrderCreate, db: Session = Depends(get_db)):
    patient = resolve_patient(data.patient_id, db)

    lab_order = LabOrder(
        patient_id=patient.id,
        test_name=data.test_name,
        status="ORDERED"
    )
    db.add(lab_order)
    db.commit()
    db.refresh(lab_order)
    return {"status": "SUCCESS", "message": "Lab test ordered", "data": lab_order}

# --- NEW PHASES 4-7 ENDPOINTS ---

# 8. Lab LIS: Get all lab orders
@router.get("/lab-orders")
def get_lab_orders(db: Session = Depends(get_db)):
    orders = db.query(LabOrder).order_by(LabOrder.created_at.desc()).all()
    result = []
    for o in orders:
        patient = db.query(GuestCRM).filter(GuestCRM.id == o.patient_id).first()
        result.append({
            "id": o.id,
            "patient_name": patient.full_name if patient else "Unknown Patient",
            "test_name": o.test_name,
            "status": o.status,
            "result_text": o.result_text,
            "created_at": o.created_at
        })
    return {"status": "SUCCESS", "data": result}

# 9. Lab LIS: Submit test results
@router.post("/lab-orders/{id}/results")
def submit_lab_results(id: int, data: LabResultSubmit, db: Session = Depends(get_db)):
    order = db.query(LabOrder).filter(LabOrder.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")
    
    order.result_text = data.result_text
    order.status = "REPORTED"
    db.commit()
    return {"status": "SUCCESS", "message": "Lab results successfully published"}

# 10. OPD Scheduling: Book appointment (with daily cap guard)
@router.post("/appointments", status_code=status.HTTP_201_CREATED)
def book_appointment(data: AppointmentCreate, db: Session = Depends(get_db)):
    patient = resolve_patient(data.patient_id, db)

    # Enforce daily patient cap from DoctorRoster
    appt_date = data.appointment_time.date()
    day_of_week = appt_date.weekday()  # 0=Mon
    roster_entry = db.query(DoctorRoster).filter(
        DoctorRoster.doctor_id == data.doctor_id,
        DoctorRoster.day_of_week == day_of_week,
        DoctorRoster.is_active == True
    ).first()

    # Default cap = 20 if no roster defined
    max_cap = roster_entry.max_patients if roster_entry else 20

    # Count existing appointments for this doctor on this day
    day_start = datetime.combine(appt_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)
    existing_count = db.query(OPDAppointment).filter(
        OPDAppointment.doctor_id == data.doctor_id,
        OPDAppointment.appointment_time >= day_start,
        OPDAppointment.appointment_time < day_end,
        OPDAppointment.status != "CANCELLED"
    ).count()

    if existing_count >= max_cap:
        raise HTTPException(
            status_code=400,
            detail=f"Doctor has reached their daily patient cap of {max_cap} appointments on {appt_date}. Please select a different date."
        )

    appointment = OPDAppointment(
        patient_id=patient.id,
        doctor_id=data.doctor_id,
        appointment_time=data.appointment_time,
        notes=data.notes,
        status="SCHEDULED"
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return {"status": "SUCCESS", "message": "Appointment scheduled successfully", "data": appointment}

# 11. OPD Scheduling: Get doctor appointments
@router.get("/appointments/{doctor_id}")
def get_doctor_appointments(doctor_id: str, db: Session = Depends(get_db)):
    appts = db.query(OPDAppointment).filter(OPDAppointment.doctor_id == doctor_id).order_by(OPDAppointment.appointment_time.asc()).all()
    result = []
    for a in appts:
        patient = db.query(GuestCRM).filter(GuestCRM.id == a.patient_id).first()
        result.append({
            "id": a.id,
            "patient_name": patient.full_name if patient else "Unknown Patient",
            "appointment_time": a.appointment_time,
            "status": a.status,
            "notes": a.notes
        })
    return {"status": "SUCCESS", "data": result}

# 12. Clinical ADT: Bed Transfer
@router.post("/adt/transfer")
def transfer_patient(data: ADTTransferRequest, db: Session = Depends(get_db)):
    patient = resolve_patient(data.patient_id, db)
    
    # Find active occupancy
    occ = db.query(ActiveOccupancy).filter(ActiveOccupancy.guest_crm_id == patient.id).first()
    if not occ:
        raise HTTPException(status_code=400, detail="Patient is not currently admitted in any bed")
        
    old_bed = occ.room_number
    target_bed = data.target_bed_id
    
    # Verify target bed is available
    target_occ = db.query(ActiveOccupancy).filter(ActiveOccupancy.room_number == target_bed).first()
    if target_occ:
        raise HTTPException(status_code=400, detail=f"Target bed {target_bed} is already occupied")
        
    # Update active occupancy room number
    occ.room_number = target_bed
    
    # Update Folio room number
    if occ.folio_id:
        folio = db.query(GuestFolio).filter(GuestFolio.id == occ.folio_id).first()
        if folio:
            folio.room_number = target_bed
            
    db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Patient transferred from {old_bed} to {target_bed} successfully",
        "old_bed": old_bed,
        "new_bed": target_bed
    }

# 13. TPA Billing: split-settlement
@router.post("/billing/split-settlement")
def split_settlement(data: SplitSettlementRequest, db: Session = Depends(get_db)):
    # Resolve real folio ID from bed reference or direct numeric string
    real_folio_id = None
    if isinstance(data.folio_id, int):
        real_folio_id = data.folio_id
    elif isinstance(data.folio_id, str):
        if data.folio_id.isdigit():
            real_folio_id = int(data.folio_id)
        else:
            # Try to resolve room number/bed ID from ActiveOccupancy
            occ = db.query(ActiveOccupancy).filter(ActiveOccupancy.room_number == data.folio_id).first()
            if occ:
                real_folio_id = occ.folio_id
                
    if not real_folio_id:
        raise HTTPException(status_code=404, detail=f"No active folio found for reference: {data.folio_id}")

    folio = db.query(GuestFolio).filter(GuestFolio.id == real_folio_id).first()
    if not folio:
        raise HTTPException(status_code=404, detail="Folio not found")
        
    patient = db.query(GuestCRM).filter(GuestCRM.id == folio.guest_crm_id).first()
    co_pay = patient.co_pay_pct if (patient and patient.co_pay_pct is not None) else 0.20
    
    total = folio.balance
    patient_co_pay = round(total * co_pay, 2)
    insurance_claim_amount = round(total - patient_co_pay, 2)
    
    # Create Insurance Claim
    claim = InsuranceClaim(
        folio_id=folio.id,
        patient_id=folio.guest_crm_id,
        provider_name=data.provider_name,
        policy_number=data.policy_number,
        total_invoice=total,
        patient_co_pay=patient_co_pay,
        insurance_claim_amount=insurance_claim_amount,
        status="PENDING"
    )
    db.add(claim)
    
    # Save policy details to patient record
    if patient:
        patient.insurance_provider = data.provider_name
        patient.policy_number = data.policy_number
        patient.co_pay_pct = co_pay
        
    # Update Folio balance to patient co-pay portion only
    folio.balance = patient_co_pay
    
    db.commit()
    db.refresh(claim)
    return {
        "status": "SUCCESS",
        "message": "Insurance split settlement authorized",
        "patient_co_pay": patient_co_pay,
        "insurance_claim_amount": insurance_claim_amount,
        "claim_id": claim.id
    }

# =====================================================
# ZONE HMS: DOCTOR ROSTER ENGINE
# =====================================================

# 14. Get all active rosters (grouped by doctor)
@router.get("/roster")
def get_all_rosters(db: Session = Depends(get_db)):
    rosters = db.query(DoctorRoster).filter(DoctorRoster.is_active == True).all()
    DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    result = {}
    for r in rosters:
        doc = db.query(Employee).filter(Employee.id == r.doctor_id).first()
        doc_name = doc.full_name if doc else r.doctor_id
        if r.doctor_id not in result:
            result[r.doctor_id] = {
                "doctor_id": r.doctor_id,
                "doctor_name": doc_name,
                "department": r.department_code,
                "shifts": []
            }
        result[r.doctor_id]["shifts"].append({
            "roster_id": r.id,
            "day": DAY_NAMES[r.day_of_week],
            "day_index": r.day_of_week,
            "start_time": r.start_time,
            "end_time": r.end_time,
            "max_patients": r.max_patients
        })
    return {"status": "SUCCESS", "data": list(result.values())}


# 15. AGI: Auto-generate weekly roster for all clinical staff
@router.post("/roster/generate-ai")
def generate_ai_roster(db: Session = Depends(get_db)):
    """AGI auto-generates a 5-day Mon-Fri morning session for all active doctors."""
    doctors = db.query(Employee).filter(
        Employee.department.in_(["OPD", "ICU", "EMR", "WARD", "CL", "PH", "CARDIOLOGY", "ORTHO", "NEURO", "GYNAE"])
    ).all()

    created = 0
    for doc in doctors:
        for day in range(5):  # Mon-Fri
            exists = db.query(DoctorRoster).filter(
                DoctorRoster.doctor_id == doc.id,
                DoctorRoster.day_of_week == day
            ).first()
            if not exists:
                slot = DoctorRoster(
                    doctor_id=doc.id,
                    department_code=doc.department or "OPD",
                    day_of_week=day,
                    start_time="09:00",
                    end_time="14:00",
                    max_patients=20,
                    is_active=True
                )
                db.add(slot)
                created += 1

    db.commit()
    return {"status": "SUCCESS", "message": f"AI Roster generated: {created} new shift blocks created across clinical staff."}


# 16. Doctor override: Update their own shift for a specific day
@router.put("/roster/{roster_id}/override")
def override_roster(roster_id: int, data: RosterUpdate, db: Session = Depends(get_db)):
    roster = db.query(DoctorRoster).filter(DoctorRoster.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    if data.start_time: roster.start_time = data.start_time
    if data.end_time: roster.end_time = data.end_time
    if data.max_patients is not None: roster.max_patients = data.max_patients
    if data.is_active is not None: roster.is_active = data.is_active
    db.commit()
    db.refresh(roster)
    return {"status": "SUCCESS", "message": "Roster updated by doctor override", "data": roster}


# 17. Get available appointment slots for a doctor on a given date
@router.get("/roster/{doctor_id}/available-slots")
def get_available_slots(doctor_id: str, appt_date: str, db: Session = Depends(get_db)):
    """Returns list of available 15-min time slots for a doctor on a given date."""
    try:
        target_date = date.fromisoformat(appt_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    day_of_week = target_date.weekday()
    roster = db.query(DoctorRoster).filter(
        DoctorRoster.doctor_id == doctor_id,
        DoctorRoster.day_of_week == day_of_week,
        DoctorRoster.is_active == True
    ).first()

    if not roster:
        return {"status": "SUCCESS", "available_slots": [], "message": "Doctor is not rostered on this day."}

    # Build 15-min slots between start_time and end_time
    sh, sm = [int(x) for x in roster.start_time.split(':')]
    eh, em = [int(x) for x in roster.end_time.split(':')]
    start_minutes = sh * 60 + sm
    end_minutes = eh * 60 + em
    total_slots = (end_minutes - start_minutes) // 15

    # Fetch booked appointments for this day
    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)
    booked = db.query(OPDAppointment).filter(
        OPDAppointment.doctor_id == doctor_id,
        OPDAppointment.appointment_time >= day_start,
        OPDAppointment.appointment_time < day_end,
        OPDAppointment.status != "CANCELLED"
    ).all()
    booked_times = set(a.appointment_time.strftime("%H:%M") for a in booked)

    available = []
    for i in range(min(total_slots, roster.max_patients)):
        slot_minutes = start_minutes + i * 15
        slot_str = f"{slot_minutes // 60:02d}:{slot_minutes % 60:02d}"
        if slot_str not in booked_times:
            available.append({
                "time": slot_str,
                "datetime": f"{appt_date}T{slot_str}:00"
            })

    return {
        "status": "SUCCESS",
        "doctor_id": doctor_id,
        "date": appt_date,
        "roster": {"start": roster.start_time, "end": roster.end_time, "max_patients": roster.max_patients},
        "available_slots": available,
        "booked_count": len(booked)
    }


# =====================================================
# ZONE HMS: WALK-IN SERIAL TICKET ENGINE
# =====================================================

# 18. Issue a walk-in serial ticket
@router.post("/walk-in/ticket", status_code=status.HTTP_201_CREATED)
def issue_walk_in_ticket(data: WalkInTicketCreate, db: Session = Depends(get_db)):
    """Issues a serial ticket for a walk-in patient and estimates their wait time."""
    # Count active tickets for this department today
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = today_start + timedelta(days=1)
    queue_count = db.query(WalkInTicket).filter(
        WalkInTicket.department_code == data.department_code,
        WalkInTicket.created_at >= today_start,
        WalkInTicket.created_at < today_end,
        WalkInTicket.status.in_(["ACTIVE", "CALLED"])
    ).count()

    serial_num = queue_count + 1
    ticket_serial = f"{data.department_code.upper()}-{serial_num:03d}"

    # Estimate wait: 15 min per person in queue
    estimated_wait_mins = queue_count * 15
    from datetime import datetime as dt_
    estimated_time = dt_.now() + timedelta(minutes=estimated_wait_mins)

    ticket = WalkInTicket(
        ticket_serial=ticket_serial,
        patient_name=data.patient_name,
        department_code=data.department_code,
        assigned_doctor_id=data.assigned_doctor_id,
        scheduled_time=estimated_time,
        status="ACTIVE"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {
        "status": "SUCCESS",
        "ticket_serial": ticket_serial,
        "queue_position": serial_num,
        "estimated_time": estimated_time.strftime("%H:%M"),
        "estimated_wait_mins": estimated_wait_mins,
        "data": ticket
    }


# 19. Get live queue status for a department
@router.get("/walk-in/queue/{department_code}")
def get_walk_in_queue(department_code: str, db: Session = Depends(get_db)):
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = today_start + timedelta(days=1)
    queue = db.query(WalkInTicket).filter(
        WalkInTicket.department_code == department_code.upper(),
        WalkInTicket.created_at >= today_start,
        WalkInTicket.created_at < today_end
    ).order_by(WalkInTicket.id.asc()).all()
    return {
        "status": "SUCCESS",
        "department": department_code.upper(),
        "queue": [{
            "ticket_serial": t.ticket_serial,
            "patient_name": t.patient_name,
            "status": t.status,
            "estimated_time": t.scheduled_time.strftime("%H:%M") if t.scheduled_time else None
        } for t in queue]
    }


# 20. Call next patient (Receptionist action)
@router.post("/walk-in/call-next/{department_code}")
def call_next_patient(department_code: str, db: Session = Depends(get_db)):
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = today_start + timedelta(days=1)
    next_ticket = db.query(WalkInTicket).filter(
        WalkInTicket.department_code == department_code.upper(),
        WalkInTicket.status == "ACTIVE",
        WalkInTicket.created_at >= today_start,
        WalkInTicket.created_at < today_end
    ).order_by(WalkInTicket.id.asc()).first()

    if not next_ticket:
        return {"status": "SUCCESS", "message": "No more patients in queue.", "ticket": None}

    next_ticket.status = "CALLED"
    db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Calling: {next_ticket.patient_name} ({next_ticket.ticket_serial})",
        "ticket": {"serial": next_ticket.ticket_serial, "patient_name": next_ticket.patient_name}
    }


# =====================================================
# ZONE 5: ADT — BED ALLOCATION ENGINE
# =====================================================

class AdmitRequest(BaseModel):
    patient_id: str
    bed_id: str
    assigned_doctor: Optional[str] = None
    rate: float = 1500.0
    advance_paid: float = 500.0

class DischargeRequest(BaseModel):
    bed_id: str


# 21. Get all active bed occupancy
@router.get("/beds")
def get_all_beds(db: Session = Depends(get_db)):
    occupancies = db.query(ActiveOccupancy).all()
    result = []
    for o in occupancies:
        patient = db.query(GuestCRM).filter(GuestCRM.id == o.guest_crm_id).first()
        result.append({
            "room_number": o.room_number,
            "guest_crm_id": o.guest_crm_id,
            "folio_id": o.folio_id,
            "check_in_timestamp": o.check_in_timestamp,
            "patient_name": patient.full_name if patient else f"Patient #{o.guest_crm_id}",
            "insurance_provider": patient.insurance_provider if patient else None,
        })
    return {"status": "SUCCESS", "data": result}


# 22. Admit patient to a bed
@router.post("/admit", status_code=status.HTTP_201_CREATED)
def admit_patient(data: AdmitRequest, db: Session = Depends(get_db)):
    # Resolve patient
    patient = resolve_patient(data.patient_id, db)

    # Check bed is not already occupied
    existing = db.query(ActiveOccupancy).filter(ActiveOccupancy.room_number == data.bed_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Bed {data.bed_id} is already occupied.")

    # Check patient is not already admitted elsewhere
    already_admitted = db.query(ActiveOccupancy).filter(ActiveOccupancy.guest_crm_id == patient.id).first()
    if already_admitted:
        raise HTTPException(status_code=400, detail=f"Patient is already admitted in bed {already_admitted.room_number}.")

    # Create folio
    folio = GuestFolio(
        room_number=data.bed_id,
        guest_crm_id=patient.id,
        guest_name=patient.full_name,
        status="ACTIVE",
        balance=data.advance_paid,
        rate=data.rate,
        advance_paid=data.advance_paid,
        ref_staff=data.assigned_doctor,
        check_in_date=datetime.utcnow(),
        last_updated=datetime.utcnow(),
    )
    db.add(folio)
    db.flush()  # Get folio.id

    # Create occupancy record
    occupancy = ActiveOccupancy(
        room_number=data.bed_id,
        guest_crm_id=patient.id,
        folio_id=folio.id,
        check_in_timestamp=datetime.utcnow(),
    )
    db.add(occupancy)
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"{patient.full_name} admitted to {data.bed_id} successfully.",
        "folio_id": folio.id,
        "bed_id": data.bed_id,
        "patient_name": patient.full_name,
    }


# 23. Discharge patient from a bed
@router.post("/discharge")
def discharge_patient(data: DischargeRequest, db: Session = Depends(get_db)):
    occ = db.query(ActiveOccupancy).filter(ActiveOccupancy.room_number == data.bed_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail=f"No active patient in bed {data.bed_id}.")

    patient = db.query(GuestCRM).filter(GuestCRM.id == occ.guest_crm_id).first()
    patient_name = patient.full_name if patient else f"Patient #{occ.guest_crm_id}"

    # Close the folio
    if occ.folio_id:
        folio = db.query(GuestFolio).filter(GuestFolio.id == occ.folio_id).first()
        if folio:
            folio.status = "CHECKED_OUT"
            folio.last_updated = datetime.utcnow()

    # Remove occupancy
    db.delete(occ)
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"{patient_name} discharged from {data.bed_id}. Bed is now available.",
        "bed_id": data.bed_id,
        "patient_name": patient_name,
    }
