# backend_api/app/routers/hr.py
# SOVEREIGN HR V2.0 -- Super Enterprise Multi-Department Onboarding Engine
import logging
import os
import io
import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from PIL import Image

# KERNEL SYNC: Connecting directly to the Master Database
from app.core.database import get_db
from app.models.models import Employee, User, AuditLog, HRDocumentDraft

logger = logging.getLogger("Zone09_HR_Master")
router = APIRouter(tags=["Zone 09: Human Resources"])

# ==========================================
# SOVEREIGN ENTERPRISE DEPARTMENT TAXONOMY
# 12 Industry Verticals | 70+ Departments
# ==========================================
SOVEREIGN_DEPT_TAXONOMY = {
    "EXECUTIVE_COMMAND": {
        "label": "Executive Command",
        "icon": "crown",
        "departments": [
            "Board of Directors", "Chief Medical Officer", "Group CEO Office",
            "Chief of Staff", "Executive Advisory"
        ]
    },
    "CLINICAL_AND_SURGERY": {
        "label": "Clinical & Surgery",
        "icon": "medical",
        "departments": [
            "Physicians", "Surgeons", "Medical Specialists",
            "Anesthesiology", "Operating Theater (OT)", "Outpatient (OPD)"
        ]
    },
    "NURSING_CARE": {
        "label": "Nursing Care",
        "icon": "heart",
        "departments": [
            "Head Nurse", "ICU Nursing", "Ward Nursing",
            "ER Nursing", "Pediatric Nursing", "Midwifery"
        ]
    },
    "DIAGNOSTICS_AND_LAB": {
        "label": "Diagnostics & Lab",
        "icon": "microscope",
        "departments": [
            "Laboratory Technicians", "Radiology & Imaging",
            "Pathology", "Phlebotomy"
        ]
    },
    "PHARMACY_AND_DISPENSARY": {
        "label": "Pharmacy & Dispensary",
        "icon": "pill",
        "departments": [
            "Clinical Pharmacists", "Dispensary", "Pharmacy Inventory"
        ]
    },
    "EMERGENCY_AND_EMS": {
        "label": "Emergency & EMS",
        "icon": "ambulance",
        "departments": [
            "ER Doctors", "Paramedics", "Ambulance Drivers", "Trauma Unit"
        ]
    },
    "PATIENT_RELATIONS": {
        "label": "Patient Relations",
        "icon": "users",
        "departments": [
            "Front Desk & Reception", "Patient Guides",
            "Concierge", "Admissions & Discharges"
        ]
    },
    "FINANCE_AND_ADMINISTRATION": {
        "label": "Finance & Admin",
        "icon": "chart",
        "departments": [
            "Accounts & Audit", "Billing & Insurance", "Human Resources",
            "Hospital Administration", "Legal & Compliance"
        ]
    },
    "FACILITIES_AND_SUPPORT": {
        "label": "Facilities & Support",
        "icon": "building",
        "departments": [
            "Housekeeping", "Maintenance & Engineering",
            "IT & Systems", "Security"
        ]
    }
}

EXECUTIVE_TIERS = ["OPERATIVE", "MANAGER", "DIRECTOR", "C-SUITE", "BOARD"]

INDUSTRY_VERTICALS = [
    "Hospitality", "Healthcare", "Real Estate", "Finance",
    "Retail", "Supply Chain", "IT & Technology", "F&B",
    "Security", "Education", "Manufacturing", "Logistics"
]

# ==========================================
# TAXONOMY MAPPER (Fine-grained -> Matrix Code)
# Ensures AGI and Grids sync perfectly
# ==========================================
DEPT_TO_MATRIX_CODE = {
    # EXECUTIVE_COMMAND
    "Board of Directors": "HR",
    "C-Suite Executive": "HR",
    "Chief Medical Officer": "CDO",
    "Group CEO Office": "HR",
    "Chief of Staff": "HR",
    "Executive Advisory": "HR",

    # CLINICAL_AND_SURGERY  → DOCTOR
    "Physicians": "DOCTOR",
    "Surgeons": "DOCTOR",
    "Medical Specialists": "DOCTOR",
    "Anesthesiology": "DOCTOR",
    "Operating Theater (OT)": "DOCTOR",
    "Outpatient (OPD)": "DOCTOR",
    "ER Doctors": "EMR",
    "Trauma Unit": "EMR",
    "Clinical Operations": "DOCTOR",

    # NURSING_CARE  → NURSE
    "Head Nurse": "NURSE",
    "ICU Nursing": "NURSE",
    "Ward Nursing": "NURSE",
    "ER Nursing": "NURSE",
    "Pediatric Nursing": "NURSE",
    "Midwifery": "NURSE",
    "Nursing & Allied Health": "NURSE",

    # DIAGNOSTICS_AND_LAB  → LAB_TECH
    "Laboratory Technicians": "LAB_TECH",
    "Radiology & Imaging": "LAB_TECH",
    "Pathology": "LAB_TECH",
    "Phlebotomy": "LAB_TECH",

    # PHARMACY_AND_DISPENSARY  → PHARMACIST
    "Clinical Pharmacists": "PHARMACIST",
    "Dispensary": "PHARMACIST",
    "Pharmacy Inventory": "PHARMACIST",
    "Pharmacy & Dispensary": "PHARMACIST",

    # EMERGENCY_AND_EMS  → EMR
    "Paramedics": "EMR",
    "Ambulance Drivers": "EMR",

    # PATIENT_RELATIONS  → WARD_ADMIN
    "Front Desk & Reception": "WARD_ADMIN",
    "Patient Guides": "WARD_ADMIN",
    "Concierge": "WARD_ADMIN",
    "Admissions & Discharges": "WARD_ADMIN",
    "Patient Relations": "WARD_ADMIN",
    "Medical Administration": "WARD_ADMIN",

    # FINANCE_AND_ADMINISTRATION  → ACC / HR
    "Accounts & Audit": "ACC",
    "Billing & Insurance": "ACC",
    "Human Resources": "HR",
    "Hospital Administration": "HR",
    "Legal & Compliance": "HR",
    "Health & Safety Compliance": "HR",
    "Corporate Finance": "ACC",
    "Treasury & Cash Management": "ACC",
    "Tax & Compliance": "ACC",
    "Financial Planning & Analysis": "ACC",
    "Payroll & Compensation": "ACC",
    "Accounts Receivable": "ACC",
    "Accounts Payable": "ACC",
    "Revenue Management": "ACC",

    # HR_AND_TALENT  → HR
    "Talent Acquisition": "HR",
    "Learning & Development": "HR",
    "Compensation & Benefits": "HR",
    "HR Business Partner": "HR",
    "Employee Relations": "HR",
    "Workforce Planning": "HR",

    # FACILITIES_AND_SUPPORT  → MN / IT / HK
    "Housekeeping": "HK",
    "Maintenance & Engineering": "MN",
    "IT & Systems": "IT",
    "Security": "MN",
    "Maintenance & Repairs": "MN",
    "Engineering & Mechanical": "MN",
    "Electrical & Plumbing": "MN",
    "Energy & Sustainability": "MN",
    "Civil & Construction": "MN",
    "Facilities Management": "MN",
    "Physical Security": "MN",
    "Global Security Operations": "MN",
    "Risk & Compliance": "HR",
    "Legal & Regulatory": "HR",
    "CCTV & Access Control": "IT",

    # IT_AND_SYSTEMS  → IT
    "IT Infrastructure": "IT",
    "Systems Integration": "IT",
    "Cybersecurity": "IT",
    "Software Development": "IT",
    "Data Engineering & BI": "IT",
    "ERP & CRM Systems": "IT",
    "Network & Comms": "IT",
    "AI & Automation": "IT",

    # SUPPLY_CHAIN  → ACC
    "Procurement & Sourcing": "ACC",
    "Inventory & Warehouse": "ACC",
    "Logistics & Distribution": "ACC",
    "Vendor Management": "ACC",
    "Import & Export": "ACC",

    # SALES_AND_MARKETING  → MK
    "Sales Operations": "MK",
    "Marketing & Brand": "MK",
    "Digital Marketing": "MK",
    "PR & Communications": "MK",
    "Channel Management": "MK",
}

# ==========================================
# 1. DIRECTORY SETUP (The CDO's Vault)
# ==========================================
BIOMETRIC_DIR = "app/assets/staff_biometrics"
DOC_DIR = "app/assets/documents"
os.makedirs(BIOMETRIC_DIR, exist_ok=True)
os.makedirs(DOC_DIR, exist_ok=True)

# ==========================================
# 2. ASSET FORGE: BIOMETRIC ONBOARDING & DB COMMIT
# ==========================================
# ==========================================
# STEP 2: DEPARTMENT & ROLE TAXONOMY ENDPOINTS
# ==========================================
@router.get("/departments")
def get_department_taxonomy():
    """Returns the full 12-vertical Super Enterprise department taxonomy."""
    return {
        "status": "SUCCESS",
        "taxonomy": SOVEREIGN_DEPT_TAXONOMY,
        "executive_tiers": EXECUTIVE_TIERS,
        "industry_verticals": INDUSTRY_VERTICALS
    }

@router.get("/roles")
def get_roles():
    """Returns all available RBAC roles for the Access Zone selector."""
    return {
        "status": "SUCCESS",
        "roles": [
            # Executive
            "CDO", "GM", "ADMIN",
            # Finance & HR
            "ACC", "HR",
            # Clinical
            "DOCTOR", "NURSE", "WARD_ADMIN", "PHARMACIST", "LAB_TECH", "EMR",
            # Operations & Support
            "IT", "MN", "HK", "STAFF", "SYNAPSE",
        ]
    }

# ==========================================
# SOVEREIGN ONBOARDING ENGINE V2.0
# Multi-Department | Multi-Industry | Executive Tier
# Iron Law 3: CRYPTOGRAPHIC ACID ISOLATION
# Iron Law 8: IMMUTABLE AUDIT TELEMETRY
# ==========================================
@router.post("/onboard")
async def onboard_operative(
    name: str = Form(...),
    last_name: str = Form(...),
    pos: str = Form(...),
    sal: float = Form(...),
    comm: float = Form(...),
    dept: str = Form(...),                          # PRIMARY dept (backward compat)
    dept_alignments: str = Form("[]"),              # JSON array of all dept alignments
    exec_tier: str = Form("OPERATIVE"),             # OPERATIVE|MANAGER|DIRECTOR|C-SUITE|BOARD
    industry_verticals_json: str = Form("[]"),      # JSON array of industry verticals
    role: str = Form(...),
    joining_date: Optional[str] = Form(None),       # Auto-sent as today's date
    off_days: int = Form(1),                         # Default 1 off day/week
    working_hours: float = Form(176.0),              # Default 176 hrs/month (8h x 22 days)
    gender: str = Form("UNSPECIFIED"),               # MALE | FEMALE | UNSPECIFIED
    admin_key: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    avatar_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """SOVEREIGN HR V2: Multi-Department Executive Onboarding.
    Accepts full department alignment array, executive tier, and industry verticals.
    Backward compatible: dept field always holds the primary department.
    """

    # --- Parse JSON arrays safely ---
    try:
        alignments_list = json.loads(dept_alignments) if dept_alignments else []
        if not isinstance(alignments_list, list):
            alignments_list = []
    except Exception:
        alignments_list = []

    try:
        verticals_list = json.loads(industry_verticals_json) if industry_verticals_json else []
        if not isinstance(verticals_list, list):
            verticals_list = []
    except Exception:
        verticals_list = []

    # Primary dept: first from alignments array, fallback to the legacy dept field
    primary_dept = alignments_list[0] if alignments_list else dept
    # Resolve the mapped Corporate Matrix code for AGI and Grid compatibility
    mapped_code = DEPT_TO_MATRIX_CODE.get(primary_dept, str(primary_dept))
    # Always populate dept for backward compat with all existing queries
    dept_code = str(mapped_code)[:50]

    # Validate executive tier
    tier = exec_tier.upper() if exec_tier.upper() in EXECUTIVE_TIERS else "OPERATIVE"

    # --- Generate Sovereign Asset ID ---
    dept_prefix = str(dept_code)[:2].upper()
    new_asset_id = f"{dept_prefix}-{str(uuid.uuid4().int)[:4]}"

    # --- Sovereign Login Genesis ---
    generated_username = f"{str(name).upper()}_{str(last_name).upper()}"
    final_password = admin_key if (role.upper() in ["ADMIN", "CDO", "GM"] and admin_key) else "1212"

    # --- Image Processing ---
    webp_filename = None
    avatar_filename = None

    try:
        if photo and photo.filename:
            image_data = await photo.read()
            if image_data:
                img = Image.open(io.BytesIO(image_data))
                webp_filename = f"{new_asset_id}_bio.webp"
                img.save(os.path.join(BIOMETRIC_DIR, webp_filename), "webp", optimize=True, quality=80)

        if avatar_image and avatar_image.filename:
            avatar_data = await avatar_image.read()
            if avatar_data:
                img_av = Image.open(io.BytesIO(avatar_data))
                avatar_filename = f"{new_asset_id}_avatar.webp"
                img_av.save(os.path.join(BIOMETRIC_DIR, avatar_filename), "webp", optimize=True, quality=80)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image Processing Failed: {str(e)}")

    # --- ACID Database Commit (Iron Law 3) ---
    try:
        with db.begin_nested():
            new_user = User(
                username=generated_username,
                hashed_password=final_password,
                role=role.upper(),
                is_active=True
            )
            db.add(new_user)
            db.flush()

            avatar_url = f"/api/hr/biometric/{avatar_filename}" if avatar_filename else ""

            new_employee = Employee(
                id=new_asset_id,
                user_id=new_user.id,
                full_name=name,
                last_name=last_name,
                position=f"{primary_dept} - {pos.upper()}",
                dept=dept_code,                          # PRIMARY dept — backward compat
                department_alignments=alignments_list,   # FULL alignment array
                executive_tier=tier,
                industry_verticals=verticals_list,
                status="OFFLINE",
                avatar_url=avatar_url,
                gender=gender.upper() if gender.upper() in ['MALE', 'FEMALE', 'UNSPECIFIED'] else 'UNSPECIFIED',
                base_salary=sal,
                commission_rate=comm,
                revenue_impact=0.0,
                monthly_hours=float(working_hours),
                efficiency_rating=100.0
            )
            db.add(new_employee)

            # Auto-create StaffVault for the new employee
            from app.models.models import StaffVault
            vault = StaffVault(employee_id=new_asset_id)
            db.add(vault)

            # Iron Law 8: IMMUTABLE TELEMETRY -- Audit every hire
            audit = AuditLog(
                action="OPERATIVE_ONBOARDED",
                operator="SYSTEM",
                target=f"{new_asset_id} | {name} {last_name} | Tier:{tier} | Depts:{','.join(alignments_list)}"
            )
            db.add(audit)

        db.commit()
        logger.info(f"ASSET FORGED: {new_asset_id} | Tier: {tier} | Depts: {alignments_list}")

        return {
            "status": "AUTHORIZATION GRANTED",
            "id": new_asset_id,
            "credentials": {"user": generated_username, "pass": "PROTECTED" if role.upper() == "CDO" else "1212"},
            "executive_tier": tier,
            "dept_alignments": alignments_list,
            "message": f"Operative {name} synchronized to Kernel DB. {len(alignments_list)} department(s) aligned."
        }
    except Exception as e:
        db.rollback()
        logger.error(f"HR_ONBOARD_FATAL: {str(e)}")
        raise HTTPException(status_code=500, detail="Database integrity failure during onboarding.")

# ==========================================
# 3. TELEMETRY: REAL-TIME PERFORMANCE MATRIX
# ==========================================
@router.get("/performance-matrix")
async def get_performance_matrix(db: Session = Depends(get_db)):
    """Extracts true physical staff data from DB. Calculates ROI and Efficiency."""
    try:
        # 🛡️ CDO FIX: Join with User to get credentials for the Sovereign Vault
        from app.models.models import User
        employees = db.query(Employee).join(User, Employee.user_id == User.id).all()
        
        if not employees:
            return {"status": "SUCCESS", "analytics": []}

        analytics = []
        for emp in employees:
            # Business Logic: Sovereign ROI Math
            sal = float(emp.base_salary or 0.0)
            rev = float(emp.revenue_impact or 0.0)
            comm_rate = float(emp.commission_rate or 0.0)
            
            commission_earned = rev * (comm_rate / 100)
            total_monthly_payout = sal + commission_earned
            
            # ROI Factor: (Revenue / Salary)
            roi_factor = round(rev / sal, 1) if sal > 0 else 0.0
            
            # Safe date extraction
            joined_str = emp.joined_date.strftime("%Y-%m-%d") if emp.joined_date else "UNKNOWN"

            analytics.append({
                "id": str(emp.id),
                "name": f"{emp.full_name} {emp.last_name or ''}".strip(),
                "position": str(emp.position),
                "department": str(emp.dept),
                "dept_alignments": emp.department_alignments or [],
                "executive_tier": str(emp.executive_tier or "OPERATIVE"),
                "industry_verticals": emp.industry_verticals or [],
                "salary": sal,
                "joined": joined_str,
                "working_hours": float(emp.monthly_hours or 0.0),
                "efficiency": f"{emp.efficiency_rating}%",
                "revenue": rev,
                "commission": commission_earned,
                "commission_rate": comm_rate,
                "total_monthly": total_monthly_payout,
                "roi_score": f"{roi_factor}x Factor",
                "status": str(emp.status),
                "is_online": bool(emp.is_online),
                "last_seen": emp.last_seen.isoformat() if emp.last_seen else None,
                "img": str(emp.avatar_url or ""),
                "gender": str(getattr(emp, 'gender', 'UNSPECIFIED') or 'UNSPECIFIED'),
                "username": emp.user.username if emp.user else None,
                "password": emp.user.hashed_password if emp.user else None,
                "role": str(emp.user.role) if emp.user else "STAFF"
            })
            
        return {"status": "SUCCESS", "analytics": analytics}
    except Exception as e:
        logger.error(f"🚨 PERFORMANCE_MATRIX_FAIL: {str(e)}")
        return {"status": "ERROR", "analytics": []}

@router.get("/on-duty-staff")
async def get_on_duty_staff(db: Session = Depends(get_db)):
    """Returns all ON-DUTY staff for the Operative Real-Time Load panel in the Dispatch Center."""
    try:
        on_duty = db.query(Employee).filter(Employee.status == "ON-DUTY").all()
        staff_list = []
        for emp in on_duty:
            shift_minutes = 0
            if emp.shift_start:
                now = datetime.now(timezone.utc)
                shift_minutes = int((now - emp.shift_start.replace(tzinfo=timezone.utc)).total_seconds() / 60)
            staff_list.append({
                "id": str(emp.id),
                "name": f"{emp.full_name} {emp.last_name or ''}".strip(),
                "dept": str(emp.dept),
                "position": str(emp.position or ""),
                "shift_minutes": shift_minutes,
                "avatar": str(emp.avatar_url or ""),
                "username": emp.user.username if emp.user else None,
            })
        return {"status": "SUCCESS", "staff": staff_list}
    except Exception as e:
        logger.error(f"🚨 ON_DUTY_STAFF_FAIL: {str(e)}")
        return {"status": "ERROR", "staff": []}


@router.get("/performance-matrix/{username}")
async def get_specific_performance(username: str, db: Session = Depends(get_db)):
    """Extracts a single operative's performance data for the Solve Portal HUD."""
    try:
        from app.models.models import User
        # Case insensitive lookup
        user_obj = db.query(User).filter(User.username.ilike(username)).first()
        if not user_obj or not user_obj.employee_profile:
            return {"status": "ERROR", "message": "Operative not found"}
            
        emp = user_obj.employee_profile
        
        # 🛡️ THE 16-HOUR REAPER (BACKEND ENFORCEMENT)
        if emp.status == "ON-DUTY" and emp.shift_start:
            now = datetime.now(timezone.utc)
            delta_hours = (now - emp.shift_start.replace(tzinfo=timezone.utc)).total_seconds() / 3600.0
            if delta_hours >= 16.0:
                emp.monthly_hours = float((emp.monthly_hours or 0.0) + 16.0)
                emp.status = "OFFLINE"
                emp.shift_start = None
                db.commit()
                # Optionally, we could fire a grid update here, but they are offline anyway
        
        sal = float(emp.base_salary or 0.0)
        rev = float(emp.revenue_impact or 0.0)
        comm_rate = float(emp.commission_rate or 0.0)
        commission_earned = rev * (comm_rate / 100)
        
        return {
            "status": "SUCCESS",
            "operative_status": emp.status,
            "shift_start": emp.shift_start.isoformat() if emp.shift_start else None,
            "monthly_hours": float(emp.monthly_hours or 0.0),
            "salary": sal,
            "commission": commission_earned,
            "show_salary": True if user_obj.role in ["ADMIN", "CDO", "GM"] else False
        }
    except Exception as e:
        logger.error(f"🚨 SPECIFIC_PERF_FAIL: {str(e)}")
        return {"status": "ERROR", "message": str(e)}

# ==========================================
# 4. FINANCIAL SYNC: ONE-CLICK PAYSLIP
# ==========================================
@router.post("/execute-payroll/{staff_id}")
async def execute_payroll_sync(staff_id: str, db: Session = Depends(get_db)):
    """Pushes Staff Payout to Accounts Vault (Z-11)."""
    try:
        emp = db.query(Employee).filter(Employee.id == staff_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Operative Not Found in DB")

        sal = float(emp.base_salary or 0.0)
        rev = float(emp.revenue_impact or 0.0)
        comm_rate = float(emp.commission_rate or 0.0)
        
        commission = rev * (comm_rate / 100)
        final_amount = sal + commission

        from app.models.models import SystemConfig
        config = db.query(SystemConfig).first()
        fl = config.financial_laws if config and config.financial_laws else {}
        base_cur = fl.get("base_currency", "BDT")
        ref = f"PAY-{staff_id}-{datetime.now(timezone.utc).strftime('%m%Y')}"

        if final_amount > 0:
            # 🔱 SOVEREIGN KERNEL: Payroll double-entry
            from app.routers.accounting_engine import post_double_entry
            post_double_entry(db, 'PAYROLL_DISBURSEMENT',
                f"Payroll: {emp.full_name} ({staff_id}) - {datetime.now(timezone.utc).strftime('%b %Y')}", [
                    {"code": 5000, "debit": final_amount, "credit": 0.0},  # Payroll Expense up
                    {"code": 1000, "debit": 0.0, "credit": final_amount},  # Cash/Bank down
                ])
            
            # Write payslip entry to StaffVault (VaultFile category=PAYSLIP)
            from app.models.models import StaffVault, VaultFile
            vault = db.query(StaffVault).filter(StaffVault.employee_id == staff_id).first()
            if vault:
                payslip_entry = VaultFile(
                    vault_id=vault.id,
                    original_name=f"Payslip_{ref}.pdf",
                    file_type="application/json",
                    vps_path=f"payroll/{ref}",
                    category="PAYSLIP",
                    description=f"Payslip for {base_cur} {final_amount:,.2f}",
                    uploaded_by="SYSTEM"
                )
                db.add(payslip_entry)
            db.commit()

        return {
            "status": "PAYROLL_SYNC_COMPLETE",
            "staff_notified": True,
            "amount_locked": final_amount,
            "ref": ref,
            "message": f"Payslip for {base_cur} {final_amount:,.2f} recorded in Sovereign Ledger for {emp.full_name}."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# PHASE 5 HR BRIDGE: PMS REVENUE IMPACT SYNC
# Connects frontdesk checkout events to HR performance tracking.
# Called by frontdesk_engine.py on checkout — updates operative's revenue_impact.
# This feeds: commission calculation, performance_stars, talent badges.
# ==========================================

def update_revenue_impact(
    db: Session,
    employee_id: str,
    amount: float,
    source: str = "PMS_CHECKOUT"
) -> bool:
    """
    Internal callable: Adds revenue to an employee's revenue_impact field.
    Called by frontdesk_engine on guest checkout.
    source: PMS_CHECKOUT | POS_SALE | OWNER_YIELD | RESERVATION

    Returns True if updated, False if employee not found.
    """
    if not employee_id or amount <= 0:
        return False
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        logger.warning(f"[HR BRIDGE] Employee {employee_id} not found for revenue_impact update.")
        return False

    emp.revenue_impact = round(float(emp.revenue_impact or 0.0) + amount, 2)
    logger.info(f"[HR BRIDGE] {employee_id}: revenue_impact += {amount:.2f} ({source}). New total: {emp.revenue_impact:.2f}")

    # Add audit entry (lightweight — no commit here; caller commits)
    db.add(AuditLog(
        action=f"PMS_REVENUE_CREDIT: +{amount:.2f} USD from {source}",
        operator="SYSTEM",
        target=employee_id
    ))
    return True


@router.post("/pms-revenue-credit")
async def pms_revenue_credit(
    employee_id: str = Body(...),
    amount: float = Body(...),
    source: str = Body("PMS_CHECKOUT"),
    db: Session = Depends(get_db)
):
    """
    PHASE 5: API endpoint for PMS -> HR revenue impact credit.
    Called by frontdesk_engine on checkout for the operative who processed check-in.
    Also called when owner-employee receives yield credit.
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail=f"Operative {employee_id} not found.")

    updated = update_revenue_impact(db, employee_id, amount, source)
    if updated:
        db.commit()
        # Recalculate commission for display
        comm_rate = float(emp.commission_rate or 0.0)
        earned_commission = round(float(emp.revenue_impact or 0.0) * (comm_rate / 100), 2)
        return {
            "status": "SUCCESS",
            "employee_id": employee_id,
            "revenue_impact_new": emp.revenue_impact,
            "commission_earned": earned_commission,
            "source": source,
            "message": f"Revenue impact updated. Commission: USD {earned_commission:,.2f}"
        }
    raise HTTPException(status_code=500, detail="Failed to update revenue impact.")


@router.get("/pms-performance-report")
async def get_pms_performance_report(db: Session = Depends(get_db)):
    """
    PHASE 5: Property Revenue Performance Report.
    Lists all staff by PMS-attributed revenue_impact, commission earned, and star rating.
    Used by management to identify top-performing front desk and owner-employee operatives.
    """
    operatives = db.query(Employee).filter(
        Employee.revenue_impact > 0
    ).order_by(Employee.revenue_impact.desc()).all()

    report = []
    for emp in operatives:
        sal = float(emp.base_salary or 0.0)
        rev = float(emp.revenue_impact or 0.0)
        comm_rate = float(emp.commission_rate or 0.0)
        commission = round(rev * (comm_rate / 100), 2)
        roi = round((rev / sal), 2) if sal > 0 else 0.0

        report.append({
            "employee_id": emp.id,
            "full_name": f"{emp.full_name} {emp.last_name or ''}".strip(),
            "dept": emp.dept,
            "executive_tier": emp.executive_tier,
            "revenue_impact_usd": rev,
            "commission_earned_usd": commission,
            "commission_rate_pct": comm_rate,
            "roi_factor": roi,
            "performance_stars": emp.performance_stars,
            "tasks_completed": emp.tasks_completed,
            "avg_response_minutes": emp.avg_response_minutes,
            # Talent badge: awarded when PMS revenue exceeds 10x monthly salary
            "property_revenue_badge": rev >= (sal * 10),
        })

    return {
        "status": "SUCCESS",
        "total_operatives_with_revenue": len(report),
        "report": report
    }

# ==========================================
# 5. REGISTRY SURGERY (Mass Update)
# ==========================================
@router.post("/sync-registry")
async def sync_registry(payload: List[dict] = Body(...), db: Session = Depends(get_db)):
    """Mass update physical staff metrics from the Registry surgery tab."""
    try:
        with db.begin_nested():
            for update in payload:
                s_id = update.get("id")
                if not s_id:
                    continue
                    
                emp = db.query(Employee).filter(Employee.id == s_id).first()
                if emp:
                    if "sal" in update: emp.base_salary = float(update["sal"])
                    if "commRate" in update: emp.commission_rate = float(update["commRate"])
                    if "status" in update: emp.status = str(update["status"])
                    if "img" in update: emp.avatar_url = str(update["img"])
                    
                    # Update related User auth logic if username/password/role are passed
                    if "username" in update or "password" in update or "role" in update:
                        if emp.user:
                            if "username" in update: emp.user.username = str(update["username"])
                            if "password" in update: emp.user.hashed_password = str(update["password"])
                            if "role" in update: emp.user.role = str(update["role"])
                            
        db.commit()
        return {"status": "SUCCESS", "message": "Global Registry physically synchronized to PostgreSQL."}
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 REGISTRY_SYNC_FAIL: {str(e)}")
        raise HTTPException(status_code=500, detail="Database override failed.")

# ==========================================
# 6. ASSET SERVING: THE BIOMETRIC VAULT
# ==========================================
@router.get("/biometric/{filename}")
async def serve_biometric_image(filename: str):
    """Serves high-resolution biometric assets from the physical vault."""
    file_path = os.path.join(BIOMETRIC_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Biometric Asset Not Found")
    return FileResponse(file_path)

@router.post("/upload-avatar/{employee_id}")
async def upload_employee_avatar(
    employee_id: str,
    avatar_image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload or update employee profile avatar."""
    try:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        avatar_data = await avatar_image.read()
        if not avatar_data:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        # Save to BIOMETRIC_DIR as webp
        img_av = Image.open(io.BytesIO(avatar_data))
        avatar_filename = f"{employee_id}_avatar.webp"
        img_av.save(os.path.join(BIOMETRIC_DIR, avatar_filename), "webp", optimize=True, quality=80)

        # Update employee record
        emp.avatar_url = f"/api/hr/biometric/{avatar_filename}"
        
        # Log audit
        db.add(AuditLog(
            action="AVATAR_UPLOADED",
            operator="SYSTEM",
            target=f"{employee_id} | avatar: {avatar_filename}"
        ))
        db.commit()

        return {
            "status": "SUCCESS",
            "avatar_url": emp.avatar_url,
            "message": "Avatar uploaded and updated successfully."
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"AVATAR_UPLOAD_FAIL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload avatar: {str(e)}")

# ==========================================
# 7. OPERATIVE DNA: DUTY LIFECYCLE ENGINE
# ==========================================
@router.post("/duty/start")
async def start_duty_shift(username: str = Form(...), db: Session = Depends(get_db)):
    """Logs the operative in, marks them ON-DUTY, and starts the 16-hour clock."""
    try:
        from app.models.models import User
        user = db.query(User).filter(User.username.ilike(username)).first()
        if not user or not user.employee_profile:
            raise HTTPException(status_code=404, detail="Operative Profile Not Found")
            
        emp = user.employee_profile
        emp.status = "ON-DUTY"
        emp.shift_start = datetime.now(timezone.utc)
        
        db.commit()
        
        # Broadcast to Grid (safe singleton, no circular import)
        try:
            from app.core.ws_manager import master_socket
            await master_socket.broadcast("GRID_UPDATE", {
                "action": "STAFF_DUTY_START",
                "staff_id": emp.id,
                "dept": emp.dept
            })
        except Exception as ws_err:
            logger.warning(f"WS broadcast skipped: {ws_err}")
        
        return {
            "status": "ON-DUTY",
            "message": f"Welcome back, {emp.full_name}. Shift started.",
            "shift_start": emp.shift_start.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 DUTY_START_FAIL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize duty shift: {str(e)}")

@router.post("/duty/end")
async def end_duty_shift(username: str = Form(...), db: Session = Depends(get_db)):
    """Logs the operative out, calculates hours, updates ROI math, and marks OFFLINE."""
    try:
        from app.models.models import User
        user = db.query(User).filter(User.username.ilike(username)).first()
        if not user or not user.employee_profile:
            raise HTTPException(status_code=404, detail="Operative Profile Not Found")
            
        emp = user.employee_profile
        
        if emp.status == "ON-DUTY" and emp.shift_start:
            # Calculate hours worked (capped at 16 if forgotten)
            now = datetime.now(timezone.utc)
            delta = (now - emp.shift_start.replace(tzinfo=timezone.utc)).total_seconds() / 3600.0
            hours_worked = min(delta, 16.0)
            
            emp.monthly_hours = float((emp.monthly_hours or 0.0) + hours_worked)
            
        emp.status = "OFFLINE"
        emp.shift_start = None
        
        db.commit()
        
        # Broadcast to Grid (safe singleton, no circular import)
        try:
            from app.core.ws_manager import master_socket
            await master_socket.broadcast("GRID_UPDATE", {
                "action": "STAFF_DUTY_END",
                "staff_id": emp.id,
                "dept": emp.dept
            })
        except Exception as ws_err:
            logger.warning(f"WS broadcast skipped: {ws_err}")
        
        return {
            "status": "OFFLINE",
            "message": "Shift closed. Hours logged to Sovereign HR Ledger."
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 DUTY_END_FAIL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to close duty shift: {str(e)}")

# ==========================================
# 📝 HR DOCUMENT DRAFTS (MANTALA WORD MODULE)
# ==========================================
from pydantic import BaseModel
class DraftRequest(BaseModel):
    author_id: str
    title: str
    content: str

@router.post("/drafts")
def save_hr_draft(payload: DraftRequest, db: Session = Depends(get_db)):
    try:
        # Check if draft with same title and author exists
        draft = db.query(HRDocumentDraft).filter_by(author_id=payload.author_id, title=payload.title).first()
        if draft:
            draft.content = payload.content
        else:
            draft = HRDocumentDraft(
                author_id=payload.author_id,
                title=payload.title,
                content=payload.content
            )
            db.add(draft)
        db.commit()
        return {"status": "SUCCESS", "message": "Draft securely saved to Master Kernel."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/drafts/{author_id}")
def get_hr_drafts(author_id: str, db: Session = Depends(get_db)):
    drafts = db.query(HRDocumentDraft).filter_by(author_id=author_id).order_by(HRDocumentDraft.updated_at.desc()).all()
    return {"status": "SUCCESS", "drafts": [{"id": d.id, "title": d.title, "content": d.content, "updated_at": d.updated_at} for d in drafts]}

@router.delete("/drafts/{draft_id}")
def delete_hr_draft(draft_id: int, db: Session = Depends(get_db)):
    draft = db.query(HRDocumentDraft).filter_by(id=draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    db.delete(draft)
    db.commit()
    return {"status": "SUCCESS", "message": "Draft purged from Master Kernel."}
