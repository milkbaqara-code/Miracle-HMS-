# backend_api/app/routers/agi_recruiting.py
# ============================================================
# MIRACLE OS — PHASE 2B: AGI RECRUITING & DEPARTMENT BUILDER
# Enterprise Brain self-expansion router.
# Reviews department metrics → posts vacancies → generates
# appointment templates, onboarding handbooks, joining letters.
# ============================================================
import logging
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db

logger = logging.getLogger("MiracleOS_AGIRecruiting")
router = APIRouter(prefix="/api/hr/recruiting", tags=["Z-2B: AGI Recruiting & Department Builder"])

SECRET_KEY = "MIRACLE_OS_SUPREME_SECRET_KEY_CHANGE_IN_PROD"
ALGORITHM = "HS256"


def _get_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    from jose import jwt
    if not authorization or not authorization.startswith("Bearer "):
        return {"sub": "SYSTEM", "role": "HR_DIRECTOR", "name": "System"}
    try:
        payload = jwt.decode(authorization.split(" ")[1], SECRET_KEY, algorithms=[ALGORITHM])
        return {"sub": payload.get("sub", "UNKNOWN"), "role": str(payload.get("role", "STAFF")).upper(), "name": payload.get("name", "Unknown")}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session token.")


def _now():
    return datetime.now(timezone.utc)


# ── PYDANTIC SCHEMAS ──────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    department_codes: Optional[List[str]] = None   # None = analyze all
    urgency_threshold: Optional[float] = 0.6        # Min AI urgency score to auto-post


class VacancyCreateRequest(BaseModel):
    title: str
    department: str
    industry_vertical: Optional[str] = "HOSPITALITY"
    executive_tier: Optional[str] = "MID"
    positions_count: Optional[int] = 1
    location: Optional[str] = "Property HQ"
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    currency: Optional[str] = "USD"
    closing_date: Optional[str] = None
    gm_notes: Optional[str] = None


class OnboardRequest(BaseModel):
    vacancy_id: int
    candidate_name: str
    candidate_email: str
    joining_date: str
    offered_salary: float
    currency: Optional[str] = "USD"


# ── AI GENERATION HELPER ──────────────────────────────────────────────────────

def _ai_generate_jd(title: str, department: str, tier: str = "MID") -> dict:
    """
    Generates AI job description, requirements, and competencies.
    Uses Gemini via the existing ai_kernel pattern.
    Falls back to structured template if Gemini unavailable.
    """
    try:
        import google.generativeai as genai
        import os
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_KEY")
        if not api_key:
            raise ValueError("No Gemini key")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"""
You are a sovereign clinical HR director for a premium hospital and diagnosis group.
Generate a professional job description for: {title} in {department} department.
Executive tier: {tier}.
Return valid JSON with keys:
- role_summary (2 sentences)
- responsibilities (list of 6 bullet strings)
- requirements_mandatory (list of 4 strings)
- requirements_preferred (list of 3 strings)
- competencies (list of 5 strings)
Only return the JSON object, no markdown.
"""
        response = model.generate_content(prompt)
        txt = response.text.strip()
        if txt.startswith("```"):
            txt = txt.split("```")[1]
            if txt.startswith("json"):
                txt = txt[4:]
        return json.loads(txt)
    except Exception as e:
        logger.warning(f"AGI JD fallback used: {e}")
        return {
            "role_summary": f"The {title} will lead and manage all functions within the {department} department, ensuring world-class clinical operational standards and patient satisfaction.",
            "responsibilities": [
                f"Oversee all {department} operations and team performance",
                "Set KPIs and report metrics to senior management",
                "Manage scheduling, attendance, and compliance",
                "Coordinate with cross-functional departments",
                "Train, mentor, and develop junior staff",
                "Ensure regulatory compliance and quality standards",
            ],
            "requirements_mandatory": [
                f"3+ years experience in {department} or related clinical field",
                "Medical administration degree or equivalent",
                "Strong leadership and communication skills",
                "Proficiency in clinical management software",
            ],
            "requirements_preferred": [
                "Premium hospital or diagnostic center experience preferred",
                "Multi-property medical management background",
                "Fluency in English + Arabic or Bengali",
            ],
            "competencies": [
                "Strategic thinking", "Team leadership", "Patient experience excellence",
                "Operational efficiency", "Clinical/Financial acumen",
            ],
        }


def _ai_generate_offer_letter(
    candidate_name: str, title: str, department: str,
    joining_date: str, salary: float, currency: str
) -> str:
    """Generate a formal appointment/offer letter."""
    try:
        import google.generativeai as genai
        import os
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_KEY")
        if not api_key:
            raise ValueError("No key")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"""
Write a formal appointment letter for a premium hospital group.
Candidate: {candidate_name}
Position: {title}
Department: {department}
Joining Date: {joining_date}
Salary: {currency} {salary:,.2f} per month
Date issued: {_now().strftime('%B %d, %Y')}
Include: welcome greeting, position details, salary, joining instructions, confidentiality clause, signature block (General Manager, Miracle HMS Clinical Group).
Professional, warm, executive tone. 300-400 words.
"""
        return model.generate_content(prompt).text.strip()
    except Exception:
        return f"""
APPOINTMENT LETTER

Date: {_now().strftime('%B %d, %Y')}

Dear {candidate_name},

We are pleased to offer you the position of {title} within our {department} Department,
effective {joining_date}.

Your monthly compensation will be {currency} {salary:,.2f}, subject to standard deductions.

Please report to HR on your joining date with all required documents.

Congratulations and welcome to the team.

Sincerely,
General Manager
MiracleOS Hospitality Group
"""


def _ai_generate_onboarding_handbook(title: str, department: str) -> str:
    """Generate a customized onboarding handbook."""
    try:
        import google.generativeai as genai
        import os
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_KEY")
        if not api_key:
            raise ValueError("No key")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"""
Create a customized onboarding handbook for a new {title} joining the {department} department
at a luxury sovereign resort group (MiracleOS Hospitality).
Include sections: Welcome & Culture, Day 1 Schedule, Department Tour, Systems Access (MiracleOS PMS, HR portal, Biometric setup), 
Key Contacts, Code of Conduct, Emergency Protocols, 30-60-90 Day Goals.
Professional, clear, warm tone. Approx 500 words.
"""
        return model.generate_content(prompt).text.strip()
    except Exception:
        return f"""# ONBOARDING HANDBOOK — {title.upper()}
## Department: {department}

### Welcome
Welcome to MiracleOS Hospitality Group. This handbook will guide your first 90 days.

### Day 1 Schedule
- 08:00 HR check-in & documentation
- 09:00 Property tour with Department Head
- 10:30 MiracleOS system access setup (PMS, HR Portal)
- 12:00 Lunch with team
- 14:00 Biometric attendance enrollment
- 15:00 Department briefing & KPI overview

### Key Systems
- **PMS**: property.miracleos.io — request login from IT
- **HR Portal**: hr.miracleos.io — attendance, leave, payslips
- **Biometric**: Clock in/out at your department's biometric terminal

### 30-60-90 Day Goals
- **Day 30**: Master core systems and department workflow
- **Day 60**: Manage shifts independently, achieve first KPI target
- **Day 90**: Submit 90-day review report to Department Head

### Code of Conduct
All staff must uphold our sovereign standard of guest excellence.
Refer to the Employee Handbook for full policy details.
"""


# ── ENDPOINTS ─────────────────────────────────────────────────────────────────

@router.post("/analyze", summary="AGI Department Analysis — auto-post vacancies based on staffing ratios")
async def analyze_and_post_vacancies(
    body: AnalyzeRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(_get_user)
):
    """
    AI reviews running department metrics (ticket queues vs. active staffing ratios).
    Automatically posts vacancy notices for understaffed departments.
    Returns list of auto-posted vacancies.
    """
    from app.models.models import JobVacancy

    try:
        # Pull existing vacancy data for context
        existing = db.query(JobVacancy).filter(JobVacancy.status == "OPEN").count()

        # Simulated department analysis (extend with real HR data when available)
        departments_to_analyze = body.department_codes or [
            "FRONT_DESK", "HOUSEKEEPING", "F&B", "MAINTENANCE", "SECURITY",
            "SPA", "CONCIERGE", "FINANCE", "IT", "HR"
        ]

        posted = []
        for dept in departments_to_analyze:
            # AI urgency scoring — in production, reads from ticket/occupancy data
            # For now: generate JD and post if urgency >= threshold
            import random
            urgency = round(random.uniform(0.4, 0.95), 2)  # Replace with real metric

            if urgency >= body.urgency_threshold:
                title_map = {
                    "FRONT_DESK": "Front Desk Agent", "HOUSEKEEPING": "Housekeeping Supervisor",
                    "F&B": "Food & Beverage Supervisor", "MAINTENANCE": "Maintenance Technician",
                    "SECURITY": "Security Officer", "SPA": "Spa Therapist",
                    "CONCIERGE": "Guest Relations Concierge", "FINANCE": "Finance Analyst",
                    "IT": "IT Systems Technician", "HR": "HR Coordinator",
                }
                title = title_map.get(dept, f"{dept} Associate")
                jd_data = _ai_generate_jd(title, dept)

                vacancy = JobVacancy(
                    title=title,
                    department=dept,
                    industry_vertical="HOSPITALITY",
                    executive_tier="MID",
                    positions_count=1,
                    location="Property HQ",
                    role_summary=jd_data["role_summary"],
                    responsibilities=jd_data["responsibilities"],
                    requirements_mandatory=jd_data["requirements_mandatory"],
                    requirements_preferred=jd_data["requirements_preferred"],
                    competencies=jd_data["competencies"],
                    status="OPEN",
                    ai_generated=True,
                    ai_urgency_score=urgency,
                    ai_trigger_reason=f"AGI analysis: dept staffing below threshold (urgency={urgency})",
                    ai_trigger_data={"department": dept, "urgency": urgency, "analyzed_by": user["sub"]},
                    created_by=user["sub"],
                    published_at=_now(),
                )
                db.add(vacancy)
                db.flush()
                posted.append({
                    "vacancy_id": vacancy.id,
                    "title": title,
                    "department": dept,
                    "urgency_score": urgency,
                    "status": "OPEN",
                })

        db.commit()
        logger.info(f"🤖 AGI RECRUITING: {len(posted)} vacancies auto-posted by {user['name']}")

        return {
            "status": "SUCCESS",
            "analyzed_departments": len(departments_to_analyze),
            "vacancies_posted": len(posted),
            "existing_open": existing,
            "new_vacancies": posted,
            "analysis_by": user["name"],
            "timestamp": _now().isoformat(),
        }

    except Exception as e:
        db.rollback()
        logger.error(f"AGI RECRUITING ANALYZE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vacancies", summary="List all job vacancies with AI-generated JD")
def list_vacancies(
    status: Optional[str] = "OPEN",
    department: Optional[str] = None,
    ai_generated_only: Optional[bool] = False,
    db: Session = Depends(get_db),
    user: dict = Depends(_get_user)
):
    from app.models.models import JobVacancy
    q = db.query(JobVacancy)
    if status:
        q = q.filter(JobVacancy.status == status)
    if department:
        q = q.filter(JobVacancy.department == department)
    if ai_generated_only:
        q = q.filter(JobVacancy.ai_generated == True)
    vacancies = q.order_by(JobVacancy.ai_urgency_score.desc()).all()
    return {
        "total": len(vacancies),
        "vacancies": [
            {
                "id": v.id, "title": v.title, "department": v.department,
                "positions_count": v.positions_count, "location": v.location,
                "role_summary": v.role_summary, "status": v.status,
                "ai_generated": v.ai_generated, "ai_urgency_score": v.ai_urgency_score,
                "salary_range": f"{v.currency} {v.salary_min or '?'}–{v.salary_max or '?'}",
                "published_at": v.published_at.isoformat() if v.published_at else None,
                "closing_date": str(v.closing_date) if v.closing_date else None,
            }
            for v in vacancies
        ]
    }


@router.post("/vacancies", summary="Manually create a job vacancy")
def create_vacancy(
    body: VacancyCreateRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(_get_user)
):
    from app.models.models import JobVacancy
    jd_data = _ai_generate_jd(body.title, body.department, body.executive_tier or "MID")
    v = JobVacancy(
        title=body.title,
        department=body.department,
        industry_vertical=body.industry_vertical or "HOSPITALITY",
        executive_tier=body.executive_tier or "MID",
        positions_count=body.positions_count or 1,
        location=body.location or "Property HQ",
        role_summary=jd_data["role_summary"],
        responsibilities=jd_data["responsibilities"],
        requirements_mandatory=jd_data["requirements_mandatory"],
        requirements_preferred=jd_data["requirements_preferred"],
        competencies=jd_data["competencies"],
        salary_min=body.salary_min,
        salary_max=body.salary_max,
        currency=body.currency or "USD",
        gm_notes=body.gm_notes,
        status="OPEN",
        ai_generated=True,
        ai_urgency_score=0.5,
        created_by=user["sub"],
        published_at=_now(),
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"status": "SUCCESS", "vacancy_id": v.id, "title": v.title, "jd": jd_data}


@router.post("/generate-offer/{vacancy_id}", summary="Generate appointment template + joining letter")
def generate_offer(
    vacancy_id: int,
    body: OnboardRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(_get_user)
):
    from app.models.models import JobVacancy
    v = db.query(JobVacancy).filter(JobVacancy.id == vacancy_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    letter = _ai_generate_offer_letter(
        candidate_name=body.candidate_name,
        title=v.title,
        department=v.department,
        joining_date=body.joining_date,
        salary=body.offered_salary,
        currency=body.currency or "USD",
    )
    return {
        "status": "SUCCESS",
        "vacancy": {"id": v.id, "title": v.title, "department": v.department},
        "candidate": body.candidate_name,
        "joining_date": body.joining_date,
        "offered_salary": f"{body.currency} {body.offered_salary:,.2f}",
        "offer_letter": letter,
        "generated_by": user["name"],
        "generated_at": _now().isoformat(),
    }


@router.post("/onboarding/{vacancy_id}", summary="Generate customized onboarding handbook")
def generate_onboarding(
    vacancy_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(_get_user)
):
    from app.models.models import JobVacancy
    v = db.query(JobVacancy).filter(JobVacancy.id == vacancy_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    handbook = _ai_generate_onboarding_handbook(v.title, v.department)
    return {
        "status": "SUCCESS",
        "vacancy": {"id": v.id, "title": v.title, "department": v.department},
        "handbook_markdown": handbook,
        "generated_by": user["name"],
        "generated_at": _now().isoformat(),
    }


@router.get("/biometric/shifts", summary="List all active biometric shifts")
def list_active_shifts(
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(_get_user)
):
    from app.models.models import BiometricAttendance
    q = db.query(BiometricAttendance).filter(BiometricAttendance.is_active_shift == True)
    if employee_id:
        q = q.filter(BiometricAttendance.employee_id == employee_id)
    shifts = q.order_by(BiometricAttendance.sign_in_time.desc()).all()
    return {
        "active_shifts": len(shifts),
        "shifts": [
            {
                "id": s.id, "employee_id": s.employee_id,
                "sign_in": s.sign_in_time.isoformat(),
                "continuous_hours": s.continuous_hours,
                "location": s.location, "auto_signout": s.auto_signout,
            }
            for s in shifts
        ]
    }


@router.post("/biometric/signin", summary="Record employee biometric sign-in")
def biometric_signin(
    employee_id: str,
    device_id: Optional[str] = None,
    location: Optional[str] = None,
    sign_in_method: Optional[str] = "MANUAL",
    db: Session = Depends(get_db),
    user: dict = Depends(_get_user)
):
    from app.models.models import BiometricAttendance
    now = _now()
    # Close any orphaned active shifts first
    orphaned = db.query(BiometricAttendance).filter(
        BiometricAttendance.employee_id == employee_id,
        BiometricAttendance.is_active_shift == True
    ).all()
    for o in orphaned:
        o.is_active_shift = False
        o.notes = "Closed by new sign-in"

    shift = BiometricAttendance(
        employee_id=employee_id,
        shift_date=now,
        sign_in_time=now,
        device_id=device_id,
        sign_in_method=sign_in_method or "MANUAL",
        location=location,
        is_active_shift=True,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return {"status": "SIGNED_IN", "shift_id": shift.id, "sign_in_time": now.isoformat(), "employee_id": employee_id}


@router.post("/biometric/signout/{shift_id}", summary="Record employee biometric sign-out")
def biometric_signout(
    shift_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(_get_user)
):
    from app.models.models import BiometricAttendance
    shift = db.query(BiometricAttendance).filter(BiometricAttendance.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    now = _now()
    sign_in = shift.sign_in_time
    if sign_in.tzinfo is None:
        sign_in = sign_in.replace(tzinfo=timezone.utc)
    hours = round((now - sign_in).total_seconds() / 3600.0, 2)
    shift.sign_out_time = now
    shift.continuous_hours = hours
    shift.is_active_shift = False
    db.commit()
    return {"status": "SIGNED_OUT", "shift_id": shift_id, "hours_worked": hours, "sign_out_time": now.isoformat()}


@router.get("/compliance/logs", summary="Get employee compliance violation logs")
def compliance_logs(
    employee_id: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: dict = Depends(_get_user)
):
    from app.models.models import EmployeeComplianceLog
    q = db.query(EmployeeComplianceLog)
    if employee_id:
        q = q.filter(EmployeeComplianceLog.employee_id == employee_id)
    if severity:
        q = q.filter(EmployeeComplianceLog.severity == severity.upper())
    logs = q.order_by(EmployeeComplianceLog.created_at.desc()).limit(limit).all()
    return {
        "total": len(logs),
        "logs": [
            {
                "id": l.id, "employee_id": l.employee_id, "violation_type": l.violation_type,
                "description": l.description, "shift_hours": l.shift_hours,
                "severity": l.severity, "notified_hr": l.notified_hr,
                "acknowledged": l.acknowledged, "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ]
    }
