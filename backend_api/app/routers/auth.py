from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from jose import jwt
import pytz
import logging

# 1. 🛡️ CLEAN ENTERPRISE IMPORTS (No sys.path hacks)
from app.models.models import User, AuditLog
from app.core.database import get_db
from app.models.miracle_ai_models import LoginSessionLog, AccessCredential

logger = logging.getLogger(__name__)

# ==========================================
# 🛡️ SOVEREIGN VAULT SEEDER
# ==========================================
def seed_access_vault(db: Session):
    """Ensures the master passwords exist in the DB if not already present."""
    defaults = [
        {"label": "ADMIN_GOD_MODE", "username": "ADMIN", "password": "M@ntala@14@", "role": "SUPER_ADMIN", "desc": "Master OS God-Mode Bypass"},
        {"label": "VISITOR_DEMO", "username": "VISITOR", "password": "Miracle4U", "role": "VISITOR", "desc": "Public Demo Access"}
    ]
    for d in defaults:
        exists = db.query(AccessCredential).filter_by(label=d["label"]).first()
        if not exists:
            db.add(AccessCredential(
                label=d["label"], 
                username=d["username"], 
                password=d["password"], 
                role=d["role"],
                description=d["desc"]
            ))
    db.commit()

# 2. SECURITY CONFIGURATION
SECRET_KEY = "MIRACLE_OS_SUPREME_SECRET_KEY_CHANGE_IN_PROD"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

router = APIRouter(tags=["ZONE 02: Security Gate"])

def create_access_token(data: dict):
    """Generates a secure JWT for the operative session."""
    to_encode = data.copy()
    # Microsoft Grade: Modern timezone-aware UTC
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def log_session(db, operative: str, role: str, outcome: str, request: any, token: str = None):
    """🛡️ IMMUTABLE SESSION LEDGER: Record every login event."""
    try:
        ip = None
        ua = None
        if request:
            ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else None)
            ua = request.headers.get("User-Agent", "")[:512]
        entry = LoginSessionLog(
            operative=operative,
            role=role,
            outcome=outcome,
            ip_address=ip,
            user_agent=ua,
            session_token=token[:128] if token else None,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        logger.warning(f"SessionLog write failed: {e}")
        db.rollback()

@router.post("/token")
def authorize_operative_session(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db),
    request: Request = None
):
    """The Master Gatekeeper for Miracle OS."""
    
    # Ensure vault is seeded (FastAPI context)
    seed_access_vault(db)
    
    dhk_tz = pytz.timezone("Asia/Dhaka")
    dhk_now = datetime.now(dhk_tz)

    # ==========================================
    # 0. 🛡️ CDO GOD-MODE BYPASS (Sovereign Access)
    # ==========================================
    admin_cred = db.query(AccessCredential).filter_by(label="ADMIN_GOD_MODE").first()
    if admin_cred and form_data.username.upper() == admin_cred.username and form_data.password == admin_cred.password:
        access_token = create_access_token(
            data={"sub": "ADMIN", "role": "SUPER_ADMIN", "name": "Sajeed (Master)"}
        )
        
        # Log the Master Override securely
        override_log = AuditLog(
            operator="Sajeed (Master)",
            action="GOD_MODE_LOGIN",
            target="API_LOGIN",
            timestamp=dhk_now
        )
        db.add(override_log)
        db.commit()
        
        logger.info("👑 CDO OVERRIDE: Master Admin bypassed DB and entered Master OS.")
        log_session(db, "ADMIN", "SUPER_ADMIN", "SUCCESS", request, access_token)
        
        return {
            "access_token": access_token, 
            "token_type": "bearer", 
            "role": "SUPER_ADMIN",
            "name": "Sajeed (Master)"
        }

    # ==========================================
    # 0.5 🛡️ VISITOR DEMO MODE BYPASS
    # ==========================================
    visitor_cred = db.query(AccessCredential).filter_by(label="VISITOR_DEMO").first()
    if visitor_cred and form_data.username.upper() == visitor_cred.username and form_data.password == visitor_cred.password:
        access_token = create_access_token(
            data={"sub": "VISITOR", "role": "VISITOR", "name": "Guest Visitor"}
        )
        
        visitor_log = AuditLog(
            operator="Guest Visitor",
            action="VISITOR_LOGIN",
            target="API_LOGIN",
            timestamp=dhk_now
        )
        db.add(visitor_log)
        db.commit()
        
        logger.info("👁️ VISITOR GRANTED: Demo access activated.")
        log_session(db, "VISITOR", "VISITOR", "SUCCESS", request, access_token)
        
        return {
            "access_token": access_token, 
            "token_type": "bearer", 
            "role": "VISITOR",
            "name": "Guest Visitor"
        }

    # ==========================================
    # 1. FETCH OPERATIVE (Standard Staff Login)
    # ==========================================
    operative = db.query(User).filter(User.username == form_data.username.upper()).first()
    
    if not operative:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Operative ID not recognized"
        )
        
    role_field = str(operative.role).upper()
    if "TERMINATED" in role_field:
        raise HTTPException(status_code=403, detail="Account Decommissioned")

    # ==========================================
    # 2. AUTHENTICATION LOGIC (🛡️ SECURE TYPE GUARD)
    # ==========================================
    is_authenticated = False
    
    # Check Legacy Pattern (Role | PWD:password)
    if "| PWD:" in role_field:
        db_pwd = role_field.split("| PWD:")[1].strip()
        if form_data.password == db_pwd:
            is_authenticated = True
            
    # Check Modern Pattern 
    else:
        # 🛡️ MICROSOFT GRADE-A FIX: 
        db_val = getattr(operative, 'hashed_password', None)
        actual_hash = str(db_val) if db_val is not None else ""
        
        if actual_hash == form_data.password:
            is_authenticated = True

    # 3. AUDIT LOGGING (Dhaka Time - Zone 16 Radar)
    if not is_authenticated:
        # 🛡️ Microsoft Grade: Pure ORM Insert (Immune to SQL Injection)
        failed_log = AuditLog(
            operator="SYSTEM",
            action="FAILED_LOGIN",
            target=f"Denied: {form_data.username}",
            timestamp=dhk_now
        )
        db.add(failed_log)
        db.commit()
        
        logger.warning(f"🚨 SECURITY ALERT: Failed login attempt for {form_data.username}")
        log_session(db, form_data.username, "N/A", "FAILED", request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid Access Key"
        )

    # 4. ISSUE SECURE TOKEN
    # Extract actual employee name if linked, fallback to username
    operative_name = operative.employee_profile.full_name if getattr(operative, 'employee_profile', None) else operative.username

    access_token = create_access_token(
        data={"sub": operative.username, "role": operative.role, "name": operative_name}
    )
    
    # 🛡️ Microsoft Grade: Pure ORM Insert
    success_log = AuditLog(
        operator=operative_name,
        action="SESSION_GRANTED",
        target="API_LOGIN",
        timestamp=dhk_now
    )
    db.add(success_log)
    db.commit()
    
    logger.info(f"✅ CLEARANCE GRANTED: Operative {operative_name} logged into Master OS.")
    log_session(db, operative_name, str(operative.role), "SUCCESS", request, access_token)

    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": operative.role,
        "name": operative_name
    }


# ==========================================
# SECTION: IMMUTABLE SESSION HISTORY LEDGER
# ==========================================

@router.get("/session-history")
def get_session_history(
    limit: int = 100,
    operative: str = None,
    outcome: str = None,
    db: Session = Depends(get_db)
):
    """
    🛡️ ADMIN: Returns the complete immutable login & session history.
    Filterable by operative name and outcome (SUCCESS / FAILED / LOGOUT).
    """
    query = db.query(LoginSessionLog)
    if operative:
        query = query.filter(LoginSessionLog.operative.ilike(f"%{operative}%"))
    if outcome:
        query = query.filter(LoginSessionLog.outcome == outcome.upper())
    
    entries = query.order_by(LoginSessionLog.login_at.desc()).limit(limit).all()
    
    return {
        "status": "SUCCESS",
        "total": len(entries),
        "data": [
            {
                "id": e.id,
                "operative": e.operative,
                "role": e.role,
                "outcome": e.outcome,
                "ip_address": e.ip_address,
                "user_agent": e.user_agent,
                "session_token": e.session_token[:16] + "..." if e.session_token else None,
                "login_at": e.login_at.isoformat() if e.login_at else None,
                "logout_at": e.logout_at.isoformat() if e.logout_at else None,
                "duration_min": e.duration_min,
            }
            for e in entries
        ]
    }