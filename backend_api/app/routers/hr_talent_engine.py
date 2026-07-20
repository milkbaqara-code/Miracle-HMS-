# =============================================================================
# MIRACLE OS — SOVEREIGN TALENT ENGINE (STE) v1.0
# Zone 09: AGI-Driven HR Recruitment Intelligence
#
# Standard: SHRM + ILO Hybrid (International Hospitality)
# UAE Compliance: Labour Law Article 60 — Employment Contract Standards
#
# FLOW: AGI Scan → LLM JD Generate → HR Edit → GM Approve → Auto-Publish
# =============================================================================

import logging
import os
import uuid
import json
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.core.database import get_db
from app.models.models import (
    Employee, SolveMission, JobVacancy, JobApplication, SystemConfig
)
from app.core.ai_kernel import call_llm

logger = logging.getLogger("Zone09_STE")
router = APIRouter(tags=["Zone 09: Sovereign Talent Engine"])

# =============================================================================
# CONSTANTS — AGI SCAN THRESHOLDS (Confirmed by CDO)
# =============================================================================
URGENCY_TICKET_THRESHOLD = 5        # open missions per operative
URGENCY_EFFICIENCY_THRESHOLD = 75.0 # avg efficiency % below which = understaffed
URGENCY_SCORE_HIRE_THRESHOLD = 50   # minimum urgency score to auto-flag

# UAE Standard Benefits (auto-added to every JD)
UAE_STANDARD_BENEFITS = [
    {"title": "Accommodation", "detail": "Company-provided accommodation or housing allowance"},
    {"title": "Visa & Work Permit", "detail": "UAE residence visa and work permit sponsored"},
    {"title": "Medical Insurance", "detail": "Comprehensive health insurance coverage"},
    {"title": "Annual Flight Ticket", "detail": "One annual return flight to home country"},
    {"title": "Meals", "detail": "Daily meals provided during working hours"},
    {"title": "Transportation", "detail": "Transport to/from work facility"},
    {"title": "Annual Leave", "detail": "30 calendar days annual leave per UAE Labour Law"},
    {"title": "End of Service Gratuity", "detail": "UAE Labour Law Article 132 — 21 days per year for first 5 years"},
]

# Department → Zone mapping
DEPT_ZONE_MAP = {
    "Front Desk & Reservations": "Z-05",
    "Food & Beverage": "Z-29",
    "Accounts & Audit": "Z-11",
    "Human Resources": "Z-09",
    "Housekeeping & Laundry": "Z-07",
    "Spa & Wellness": "Z-26",
    "Boutiques & Retail": "Z-27",
    "Fleet & Transport": "Z-28",
    "IT & Technology": "Z-23",
    "Inventory & Warehouse": "Z-12",
    "Security": "Z-07",
    "Maintenance & Engineering": "Z-16",
}

# Minimum recommended headcount per dept (AGI uses to flag understaffing)
MIN_HEADCOUNT = {
    "Housekeeping & Laundry": 4,
    "Front Desk & Reservations": 3,
    "Food & Beverage": 4,
    "Accounts & Audit": 2,
    "Human Resources": 1,
    "Spa & Wellness": 2,
    "Security": 2,
    "Maintenance & Engineering": 2,
    "IT & Technology": 1,
    "Fleet & Transport": 2,
}

def _gen_id(prefix: str) -> str:
    """Generate a readable ID like JV-202506-0001"""
    stamp = datetime.now(timezone.utc).strftime("%Y%m")
    uid = str(uuid.uuid4()).replace("-", "")[:6].upper()
    return f"{prefix}-{stamp}-{uid}"


# =============================================================================
# AGI CORE: DEPARTMENT TALENT SCANNER
# Pillar 3 Extension — reads live DB, never hallucinates
# =============================================================================

@router.get("/hr/talent/scan")
def scan_talent_gaps(db: Session = Depends(get_db)):
    """
    AGI TALENT SCANNER — Reads live employee, solve_mission data and
    returns a ranked urgency report per department.

    Urgency Score (0–100):
    - Ticket overload  (>5 open missions/person):  +40 pts
    - Low efficiency   (<75% avg):                 +30 pts
    - Understaffed     (< MIN_HEADCOUNT):          +30 pts
    """
    all_staff = db.query(Employee).filter(Employee.status != "TERMINATED").all()

    # Build headcount per department (using department_alignments JSON array)
    dept_headcount: dict = {}
    dept_efficiency: dict = {}
    dept_salary_avg: dict = {}

    for emp in all_staff:
        depts = emp.department_alignments or []
        if not depts and emp.dept:
            depts = [emp.dept]
        for d in depts:
            d = d.strip()
            if not d:
                continue
            dept_headcount[d] = dept_headcount.get(d, 0) + 1
            if d not in dept_efficiency:
                dept_efficiency[d] = []
            dept_efficiency[d].append(emp.efficiency_rating or 100.0)
            if d not in dept_salary_avg:
                dept_salary_avg[d] = []
            if emp.base_salary and emp.base_salary > 0:
                dept_salary_avg[d].append(emp.base_salary)

    # Open solve_missions per dept
    open_missions = db.query(SolveMission).filter(
        SolveMission.status.in_(["OPEN", "IN_PROGRESS", "CRITICAL"])
    ).all()

    dept_tickets: dict = {}
    for m in open_missions:
        dept = (m.dept or "Unknown").strip()
        dept_tickets[dept] = dept_tickets.get(dept, 0) + 1

    # Build urgency report
    report = []
    all_depts = set(list(dept_headcount.keys()) + list(dept_tickets.keys()))

    for dept in sorted(all_depts):
        if dept in ("Unknown", "", "TERMINATED"):
            continue

        headcount = dept_headcount.get(dept, 0)
        open_count = dept_tickets.get(dept, 0)
        efficiencies = dept_efficiency.get(dept, [])
        avg_eff = sum(efficiencies) / len(efficiencies) if efficiencies else 100.0
        salaries = dept_salary_avg.get(dept, [])
        avg_salary = sum(salaries) / len(salaries) if salaries else 0.0
        min_salary = min(salaries) if salaries else 0.0
        max_salary = max(salaries) if salaries else 0.0
        workload_per_person = open_count / max(headcount, 1)
        min_hc = MIN_HEADCOUNT.get(dept, 1)

        # Calculate urgency score
        urgency = 0
        reasons = []

        if workload_per_person > URGENCY_TICKET_THRESHOLD:
            urgency += 40
            reasons.append(f"Overloaded: {workload_per_person:.1f} tickets/person (threshold: {URGENCY_TICKET_THRESHOLD})")

        if avg_eff < URGENCY_EFFICIENCY_THRESHOLD:
            urgency += 30
            reasons.append(f"Low efficiency: {avg_eff:.1f}% (threshold: {URGENCY_EFFICIENCY_THRESHOLD}%)")

        if headcount < min_hc:
            urgency += 30
            reasons.append(f"Understaffed: {headcount} staff (minimum: {min_hc})")

        urgency = min(urgency, 100)

        report.append({
            "department": dept,
            "zone": DEPT_ZONE_MAP.get(dept, ""),
            "headcount": headcount,
            "open_tickets": open_count,
            "workload_per_person": round(workload_per_person, 2),
            "avg_efficiency_pct": round(avg_eff, 1),
            "avg_salary_aed": round(avg_salary, 2),
            "salary_range_aed": {"min": round(min_salary, 2), "max": round(max_salary, 2)},
            "urgency_score": urgency,
            "urgency_level": "CRITICAL" if urgency >= 70 else "HIGH" if urgency >= 50 else "MODERATE" if urgency >= 30 else "HEALTHY",
            "needs_hiring": urgency >= URGENCY_SCORE_HIRE_THRESHOLD,
            "trigger_reasons": reasons,
        })

    # Sort by urgency descending
    report.sort(key=lambda x: x["urgency_score"], reverse=True)

    critical = sum(1 for d in report if d["urgency_level"] == "CRITICAL")
    high = sum(1 for d in report if d["urgency_level"] == "HIGH")

    return {
        "scan_timestamp": datetime.now(timezone.utc).isoformat(),
        "total_departments_analyzed": len(report),
        "critical_departments": critical,
        "high_urgency_departments": high,
        "departments_needing_hiring": sum(1 for d in report if d["needs_hiring"]),
        "thresholds_used": {
            "ticket_overload": f">{URGENCY_TICKET_THRESHOLD} open tickets per person",
            "efficiency_low": f"<{URGENCY_EFFICIENCY_THRESHOLD}% average efficiency",
            "understaffed": "Below minimum recommended headcount",
        },
        "results": report
    }


# =============================================================================
# AGI LLM JD GENERATOR — SHRM + ILO Standard
# =============================================================================

@router.post("/hr/talent/generate-jd")
async def generate_job_description(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    LLM-Powered Job Description Generator.
    Uses existing team salary data to auto-suggest UAE-standard compensation.
    Follows SHRM + ILO competency framework.
    """
    department = payload.get("department", "")
    role_title = payload.get("role_title", "")
    executive_tier = payload.get("executive_tier", "OPERATIVE")
    trigger_reason = payload.get("trigger_reason", "")
    ai_urgency_score = payload.get("ai_urgency_score", 0)
    salary_range = payload.get("salary_range_aed", {"min": 0, "max": 0})

    # Get hotel name from system config
    config = db.query(SystemConfig).first()
    hotel_name = config.hotel_name if config else "Miracle Eco Resort"

    # Auto-suggest salary band (UAE practice: based on existing team + market)
    sal_min = salary_range.get("min", 0)
    sal_max = salary_range.get("max", 0)
    if sal_min == 0 and sal_max == 0:
        # Fallback salary bands by tier (UAE hospitality market rates)
        tier_bands = {
            "OPERATIVE": (2500, 5000),
            "MANAGER": (6000, 12000),
            "DIRECTOR": (14000, 25000),
            "C-SUITE": (30000, 60000),
            "BOARD": (60000, 120000),
        }
        sal_min, sal_max = tier_bands.get(executive_tier, (3000, 6000))

    closing_date = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%B %d, %Y")

    prompt = f"""You are a world-class HR Director generating a professional job vacancy 
following SHRM + ILO international standards for a luxury hospitality property.

PROPERTY: {hotel_name}
DEPARTMENT: {department}
ROLE TITLE: {role_title}
TIER: {executive_tier}
LOCATION: UAE
URGENCY CONTEXT: {trigger_reason if trigger_reason else "Department expansion"}
SUGGESTED SALARY BAND: AED {sal_min:,.0f} – AED {sal_max:,.0f}
APPLICATION CLOSING DATE: {closing_date}

Generate a COMPLETE, professional job vacancy in valid JSON format with this EXACT structure:
{{
  "title": "exact professional job title",
  "role_summary": "3-4 compelling sentences about the role and its impact",
  "responsibilities": [
    {{"order": 1, "text": "responsibility description"}},
    ... (8-10 responsibilities)
  ],
  "requirements_mandatory": [
    {{"type": "education", "text": "..."}},
    {{"type": "experience", "text": "..."}},
    {{"type": "certification", "text": "..."}}
  ],
  "requirements_preferred": [
    {{"type": "skill", "text": "..."}}
  ],
  "competencies": [
    "Competency 1 (ILO Framework)",
    "Competency 2",
    ...
  ],
  "working_conditions": "shift hours, work environment description",
  "salary_min": {sal_min},
  "salary_max": {sal_max},
  "currency": "AED",
  "closing_date": "{closing_date}"
}}

Rules:
- Follow SHRM competency framework and ILO decent work standards
- Use UAE Labour Law compliant language
- Responsibilities must be specific to {department} in luxury hospitality
- Competencies must follow ISO 30405 HR Management standard
- Salary must be UAE market-competitive for {executive_tier} level
- Do NOT invent certifications that don't exist
- Return ONLY valid JSON, no markdown fences"""

    try:
        raw = await call_llm(prompt)
        # Strip any markdown fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        jd_data = json.loads(raw)

        # Append UAE standard benefits
        jd_data["benefits"] = UAE_STANDARD_BENEFITS.copy()
        jd_data["department"] = department
        jd_data["industry_vertical"] = "Hospitality"
        jd_data["zone"] = DEPT_ZONE_MAP.get(department, "")
        jd_data["executive_tier"] = executive_tier
        jd_data["ai_generated"] = True
        jd_data["ai_urgency_score"] = ai_urgency_score
        jd_data["ai_trigger_reason"] = trigger_reason
        jd_data["location"] = "UAE"
        jd_data["positions_count"] = payload.get("positions_count", 1)

        return {"status": "OK", "jd": jd_data}

    except json.JSONDecodeError as e:
        logger.error(f"[STE] JD JSON parse error: {e} | Raw: {raw[:200]}")
        return {"status": "ERROR", "message": "LLM returned invalid JSON. Please retry."}
    except Exception as e:
        logger.error(f"[STE] JD generation error: {e}")
        raise HTTPException(status_code=500, detail=f"JD generation failed: {str(e)}")


# =============================================================================
# VACANCY CRUD
# =============================================================================

@router.get("/hr/talent/vacancies")
def list_vacancies(
    status: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all vacancies. Public endpoint uses ?status=PUBLISHED."""
    q = db.query(JobVacancy)
    if status:
        q = q.filter(JobVacancy.status == status.upper())
    if department:
        q = q.filter(JobVacancy.department.ilike(f"%{department}%"))
    vacancies = q.order_by(JobVacancy.created_at.desc()).all()

    result = []
    for v in vacancies:
        app_count = db.query(func.count(JobApplication.id)).filter(
            JobApplication.vacancy_id == v.id
        ).scalar() or 0
        result.append({
            "id": v.id,
            "title": v.title,
            "department": v.department,
            "industry_vertical": v.industry_vertical,
            "executive_tier": v.executive_tier,
            "zone": v.zone,
            "positions_count": v.positions_count,
            "location": v.location,
            "role_summary": v.role_summary,
            "responsibilities": v.responsibilities or [],
            "requirements_mandatory": v.requirements_mandatory or [],
            "requirements_preferred": v.requirements_preferred or [],
            "competencies": v.competencies or [],
            "working_conditions": v.working_conditions,
            "salary_min": v.salary_min,
            "salary_max": v.salary_max,
            "currency": v.currency or "AED",
            "benefits": v.benefits or [],
            "linkedin_url": v.linkedin_url,
            "indeed_url": v.indeed_url,
            "external_apply_url": v.external_apply_url,
            "status": v.status,
            "is_featured": v.is_featured,
            "closing_date": v.closing_date.isoformat() if v.closing_date else None,
            "ai_generated": v.ai_generated,
            "ai_urgency_score": v.ai_urgency_score,
            "ai_trigger_reason": v.ai_trigger_reason,
            "gm_notes": v.gm_notes,
            "approved_by": v.approved_by,
            "approved_at": v.approved_at.isoformat() if v.approved_at else None,
            "published_at": v.published_at.isoformat() if v.published_at else None,
            "created_by": v.created_by,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "applications_count": app_count,
        })
    return {"vacancies": result, "total": len(result)}


@router.post("/hr/talent/vacancies")
def create_vacancy(payload: dict = Body(...), db: Session = Depends(get_db)):
    """HR creates or saves a vacancy (from JD generator or manual entry)."""
    vid = _gen_id("JV")
    closing_raw = payload.get("closing_date")
    closing_dt = None
    if closing_raw:
        try:
            closing_dt = datetime.fromisoformat(closing_raw.replace("Z", "+00:00"))
        except Exception:
            closing_dt = datetime.now(timezone.utc) + timedelta(days=30)
    else:
        closing_dt = datetime.now(timezone.utc) + timedelta(days=30)

    v = JobVacancy(
        id=vid,
        title=payload.get("title", ""),
        department=payload.get("department", ""),
        industry_vertical=payload.get("industry_vertical", "Hospitality"),
        executive_tier=payload.get("executive_tier", "OPERATIVE"),
        zone=payload.get("zone", ""),
        positions_count=int(payload.get("positions_count", 1)),
        location=payload.get("location", "UAE"),
        role_summary=payload.get("role_summary", ""),
        responsibilities=payload.get("responsibilities", []),
        requirements_mandatory=payload.get("requirements_mandatory", []),
        requirements_preferred=payload.get("requirements_preferred", []),
        competencies=payload.get("competencies", []),
        working_conditions=payload.get("working_conditions", ""),
        salary_min=payload.get("salary_min"),
        salary_max=payload.get("salary_max"),
        currency=payload.get("currency", "AED"),
        benefits=payload.get("benefits", UAE_STANDARD_BENEFITS),
        linkedin_url=payload.get("linkedin_url"),
        indeed_url=payload.get("indeed_url"),
        external_apply_url=payload.get("external_apply_url"),
        status="DRAFT",
        closing_date=closing_dt,
        is_featured=payload.get("is_featured", False),
        ai_generated=payload.get("ai_generated", False),
        ai_urgency_score=payload.get("ai_urgency_score", 0.0),
        ai_trigger_reason=payload.get("ai_trigger_reason"),
        ai_trigger_data=payload.get("ai_trigger_data", {}),
        created_by=payload.get("created_by", "HR"),
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"status": "CREATED", "id": v.id, "message": f"Vacancy {vid} saved as DRAFT"}


@router.put("/hr/talent/vacancies/{vacancy_id}")
def update_vacancy(vacancy_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """HR edits a vacancy (any field except status transitions)."""
    v = db.query(JobVacancy).filter(JobVacancy.id == vacancy_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    editable = [
        "title", "department", "industry_vertical", "executive_tier", "zone",
        "positions_count", "location", "role_summary", "responsibilities",
        "requirements_mandatory", "requirements_preferred", "competencies",
        "working_conditions", "salary_min", "salary_max", "currency", "benefits",
        "linkedin_url", "indeed_url", "external_apply_url", "is_featured", "working_conditions"
    ]
    for field in editable:
        if field in payload:
            setattr(v, field, payload[field])

    if "closing_date" in payload and payload["closing_date"]:
        try:
            v.closing_date = datetime.fromisoformat(payload["closing_date"].replace("Z", "+00:00"))
        except Exception:
            pass

    db.commit()
    return {"status": "UPDATED", "id": v.id}


@router.post("/hr/talent/vacancies/{vacancy_id}/submit-for-approval")
def submit_for_gm_approval(vacancy_id: str, db: Session = Depends(get_db)):
    """HR submits vacancy to GM approval queue."""
    v = db.query(JobVacancy).filter(JobVacancy.id == vacancy_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    if v.status not in ("DRAFT",):
        raise HTTPException(status_code=400, detail=f"Vacancy must be in DRAFT to submit. Current: {v.status}")
    v.status = "PENDING_GM"
    db.commit()
    return {"status": "SUBMITTED", "message": "Vacancy sent to GM Approval Queue"}


@router.post("/hr/talent/vacancies/{vacancy_id}/gm-action")
def gm_action(vacancy_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    GM approves or rejects a vacancy.
    action: 'APPROVE' | 'REJECT' | 'REQUEST_EDIT'
    """
    v = db.query(JobVacancy).filter(JobVacancy.id == vacancy_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    action = payload.get("action", "").upper()
    gm_username = payload.get("gm_username", "GM")
    notes = payload.get("notes", "")

    if action == "APPROVE":
        v.status = "APPROVED"
        v.approved_by = gm_username
        v.approved_at = datetime.now(timezone.utc)
        v.gm_notes = notes
        # Auto-publish immediately upon approval
        v.status = "PUBLISHED"
        v.published_at = datetime.now(timezone.utc)
        msg = "Vacancy APPROVED and PUBLISHED to careers page"

    elif action == "REJECT":
        v.status = "REJECTED"
        v.gm_notes = notes
        v.approved_by = gm_username
        msg = "Vacancy REJECTED"

    elif action == "REQUEST_EDIT":
        v.status = "DRAFT"
        v.gm_notes = f"[GM Edit Request] {notes}"
        msg = "Vacancy returned to HR for editing"

    else:
        raise HTTPException(status_code=400, detail="action must be APPROVE, REJECT, or REQUEST_EDIT")

    db.commit()
    return {"status": action, "message": msg, "vacancy_id": vacancy_id}


@router.post("/hr/talent/vacancies/{vacancy_id}/close")
def close_vacancy(vacancy_id: str, db: Session = Depends(get_db)):
    """Close a vacancy (no longer accepting applications)."""
    v = db.query(JobVacancy).filter(JobVacancy.id == vacancy_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    v.status = "CLOSED"
    db.commit()
    return {"status": "CLOSED", "id": vacancy_id}


# =============================================================================
# APPLICANT TRACKER
# =============================================================================

@router.post("/hr/talent/apply/{vacancy_id}")
async def submit_application(
    vacancy_id: str,
    applicant_name: str = Form(...),
    applicant_email: str = Form(...),
    applicant_phone: str = Form(""),
    applicant_nationality: str = Form(""),
    current_location: str = Form(""),
    notice_period: str = Form(""),
    current_salary: str = Form(""),
    expected_salary: str = Form(""),
    cover_letter: str = Form(""),
    linkedin_profile: str = Form(""),
    portfolio_url: str = Form(""),
    source: str = Form("WEBSITE"),
    cv_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Public endpoint — no auth required.
    Accepts job applications from /web/careers page.
    """
    v = db.query(JobVacancy).filter(JobVacancy.id == vacancy_id, JobVacancy.status == "PUBLISHED").first()
    if not v:
        raise HTTPException(status_code=404, detail="Vacancy not found or not accepting applications")

    # Handle CV upload
    cv_url = None
    if cv_file and cv_file.filename:
        upload_dir = os.path.join("static", "cv_uploads")
        os.makedirs(upload_dir, exist_ok=True)
        safe_name = f"{uuid.uuid4()}_{cv_file.filename.replace(' ', '_')}"
        cv_path = os.path.join(upload_dir, safe_name)
        content = await cv_file.read()
        with open(cv_path, "wb") as f:
            f.write(content)
        cv_url = f"/static/cv_uploads/{safe_name}"

    app_id = _gen_id("APP")

    # Pre-fill for one-click onboarding
    prefill = {
        "name": applicant_name.split()[0] if applicant_name else "",
        "lastName": " ".join(applicant_name.split()[1:]) if len(applicant_name.split()) > 1 else "",
        "pos": v.title,
        "dept": v.department,
        "sal": 0,
        "source": "applicant_tracker",
        "applicant_id": app_id,
        "vacancy_id": vacancy_id,
    }

    application = JobApplication(
        id=app_id,
        vacancy_id=vacancy_id,
        applicant_name=applicant_name,
        applicant_email=applicant_email,
        applicant_phone=applicant_phone,
        applicant_nationality=applicant_nationality,
        current_location=current_location,
        notice_period=notice_period,
        current_salary=current_salary,
        expected_salary=expected_salary,
        cover_letter=cover_letter,
        cv_url=cv_url,
        linkedin_profile=linkedin_profile,
        portfolio_url=portfolio_url,
        source=source.upper(),
        status="NEW",
        onboarding_prefill=prefill,
    )
    db.add(application)
    db.commit()

    return {
        "status": "RECEIVED",
        "application_id": app_id,
        "message": f"Thank you {applicant_name.split()[0]}! Your application for '{v.title}' has been received. Our HR team will be in touch."
    }


@router.get("/hr/talent/applications")
def list_applications(
    vacancy_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """HR: List all applications with optional filters."""
    q = db.query(JobApplication)
    if vacancy_id:
        q = q.filter(JobApplication.vacancy_id == vacancy_id)
    if status:
        q = q.filter(JobApplication.status == status.upper())
    apps = q.order_by(JobApplication.applied_at.desc()).all()

    result = []
    for a in apps:
        vac = db.query(JobVacancy).filter(JobVacancy.id == a.vacancy_id).first()
        result.append({
            "id": a.id,
            "vacancy_id": a.vacancy_id,
            "vacancy_title": vac.title if vac else "",
            "vacancy_department": vac.department if vac else "",
            "applicant_name": a.applicant_name,
            "applicant_email": a.applicant_email,
            "applicant_phone": a.applicant_phone,
            "applicant_nationality": a.applicant_nationality,
            "current_location": a.current_location,
            "notice_period": a.notice_period,
            "current_salary": a.current_salary,
            "expected_salary": a.expected_salary,
            "cover_letter": a.cover_letter,
            "cv_url": a.cv_url,
            "linkedin_profile": a.linkedin_profile,
            "portfolio_url": a.portfolio_url,
            "source": a.source,
            "status": a.status,
            "hr_notes": a.hr_notes,
            "reviewed_by": a.reviewed_by,
            "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
            "onboarding_prefill": a.onboarding_prefill or {},
            "applied_at": a.applied_at.isoformat() if a.applied_at else None,
        })
    return {"applications": result, "total": len(result)}


@router.put("/hr/talent/applications/{app_id}/status")
def update_application_status(app_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """HR updates applicant pipeline status."""
    a = db.query(JobApplication).filter(JobApplication.id == app_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")

    valid_statuses = ["NEW", "REVIEWING", "SHORTLISTED", "INTERVIEWED", "OFFER_SENT", "HIRED", "REJECTED"]
    new_status = payload.get("status", "").upper()
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid_statuses}")

    a.status = new_status
    a.hr_notes = payload.get("hr_notes", a.hr_notes)
    a.reviewed_by = payload.get("reviewed_by", a.reviewed_by)
    a.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "UPDATED", "application_id": app_id, "new_status": new_status}


# =============================================================================
# STATS ENDPOINT (for HR Dashboard header)
# =============================================================================

@router.get("/hr/talent/stats")
def get_talent_stats(db: Session = Depends(get_db)):
    """Quick stats for the TALENT ENGINE tab header."""
    total_vacancies = db.query(func.count(JobVacancy.id)).scalar() or 0
    published = db.query(func.count(JobVacancy.id)).filter(JobVacancy.status == "PUBLISHED").scalar() or 0
    pending_gm = db.query(func.count(JobVacancy.id)).filter(JobVacancy.status == "PENDING_GM").scalar() or 0
    total_apps = db.query(func.count(JobApplication.id)).scalar() or 0
    new_apps = db.query(func.count(JobApplication.id)).filter(JobApplication.status == "NEW").scalar() or 0

    return {
        "total_vacancies": total_vacancies,
        "published": published,
        "pending_gm_approval": pending_gm,
        "total_applications": total_apps,
        "new_unreviewed_applications": new_apps,
    }
