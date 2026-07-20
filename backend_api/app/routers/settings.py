# backend_api/app/routers/settings.py
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

# KERNEL SYNC: Connecting to Master DB & Audit Matrix
from app.core.database import get_db
from app.models.models import SystemConfig, AuditLog
from app.models.miracle_ai_models import AccessCredential
from app.core.kernel_manager import kernel_manager

logger = logging.getLogger("Zone21_Kernel_Settings")
router = APIRouter(tags=["ZONE 21: OS Settings"])

class CredentialUpdate(BaseModel):
    label: str
    username: str
    password: str
    role: str
    description: Optional[str] = None
    master_pin: str
    operator_id: str

# ==========================================
# 1. STRICT DATA CONTRACTS (PYDANTIC)
# ==========================================
class SettingsUpdate(BaseModel):
    """Payload requires the Master PIN for Authorization"""
    master_pin: str  # 🛡️ CDO FIX: Mandatory Security Lock
    operator_id: str # 🛡️ CDO FIX: Who is making the change?
    
    auth_expiry_minutes: Optional[int] = None
    ip_whitelist: Optional[str] = None
    sync_pulse_interval: Optional[int] = None
    biometric_threshold: Optional[float] = None
    stripe_live_mode: Optional[bool] = None
    system_log_level: Optional[str] = None
    auto_backup: Optional[bool] = None
    hotel_name: Optional[str] = None
    
    # 🛡️ SOVEREIGN FIX: Financial Constants Control
    financial_laws: Optional[Dict[str, Any]] = None

# ==========================================
# 2. THE SOVEREIGN KERNEL RETRIEVAL
# ==========================================
@router.get("/live")
def get_live_config(db: Session = Depends(get_db)):
    """Retrieves the current Sovereign Configuration."""
    try:
        config = db.query(SystemConfig).first()
        
        # 🛡️ NO GHOST DATA: Auto-Forge the Genesis Configuration if missing
        if not config:
            logger.warning("KERNEL CONFIG MISSING. Forging Genesis Settings.")
            default_financial_laws = {
                "vat_rate": 15.0,
                "service_charge": 10.0,
                "late_checkout_penalty": 2500.0,
                "base_currency": "BDT",
                "currency": "BDT",
                "exchange_rate_usd": 110.50,
                "exchange_rate_aed": 30.50,
                "supported_currencies": ["BDT", "USD", "AED"],
                "currency_symbols": {"BDT": "৳", "USD": "$", "AED": "د.إ"}
            }
            
            new_config = SystemConfig(
                id=1,
                master_pin_hash="1414", # Default Genesis PIN
                financial_laws=default_financial_laws
            )
            db.add(new_config)
            db.commit()
            db.refresh(new_config)
            return {"status": "SUCCESS", "data": new_config}
            
        return {"status": "SUCCESS", "data": config}
        
    except Exception as e:
        logger.error(f"🚨 KERNEL_FETCH_FATAL: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve Master Configuration.")

# ==========================================
# 3. ATOMIC UPDATE & AUDIT LOGGING ENGINE
# ==========================================
@router.patch("/update")
def update_kernel_config(payload: SettingsUpdate, db: Session = Depends(get_db)):
    """Atomic Update: Modifies Kernel with Master PIN & logs to Audit Vault."""
    config = db.query(SystemConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="Kernel Configuration Not Found. Reboot Kernel.")

    # 🛡️ SECURITY GATE: Verify Master PIN
    if payload.master_pin != config.master_pin_hash:
        # Log the failed attempt
        failed_audit = AuditLog(
            action="UNAUTHORIZED_SETTINGS_BREACH",
            operator=payload.operator_id,
            target="SystemConfig"
        )
        db.add(failed_audit)
        db.commit()
        logger.error(f"🚨 SECURITY BREACH: Invalid PIN attempt by {payload.operator_id}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ACCESS DENIED: Invalid Master PIN.")

    try:
        with db.begin_nested():
            # Update only the fields provided in the request
            update_data = payload.dict(exclude_unset=True, exclude={"master_pin", "operator_id"})
            
            changed_fields = []
            for key, value in update_data.items():
                old_val = getattr(config, key)
                if old_val != value:
                    setattr(config, key, value)
                    changed_fields.append(f"{key}: {old_val} -> {value}")

            # 🛡️ THE SOVEREIGN AUDIT: Record exactly what changed
            if changed_fields:
                audit_entry = AuditLog(
                    action=f"SYS_CONFIG_PATCHED | Changes: {', '.join(changed_fields)}",
                    operator=payload.operator_id,
                    target="SystemConfig"
                )
                db.add(audit_entry)
                
        db.commit()
        db.refresh(config)
        logger.info(f"✅ KERNEL SECURED: Settings updated by {payload.operator_id}.")
        return {"status": "SUCCESS", "message": "Kernel Handshake Updated & Audited.", "data": config}
        
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 VAULT_WRITE_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Vault Write Error: {str(e)}")

# ==========================================
# CURRENCY ENGINE — Admin Exchange Rate Control
# ==========================================
class CurrencyRateUpdate(BaseModel):
    """Admin updates exchange rates manually from Kernel Settings panel — 14-currency sovereign engine."""
    master_pin: str
    operator_id: str
    # All rates are expressed as Units-per-1-USD. e.g. exchange_rate_aed=3.67 means 1 USD = 3.67 AED
    exchange_rate_usd: float = Field(...,  gt=0, description="USD per 1 USD (Always 1)")
    exchange_rate_aed: float = Field(...,  gt=0, description="AED per 1 USD")
    exchange_rate_gbp: Optional[float] = Field(default=None, gt=0, description="GBP per 1 USD")
    exchange_rate_eur: Optional[float] = Field(default=None, gt=0, description="EUR per 1 USD")
    exchange_rate_sar: Optional[float] = Field(default=None, gt=0, description="SAR per 1 USD")
    exchange_rate_qar: Optional[float] = Field(default=None, gt=0, description="QAR per 1 USD")
    exchange_rate_sgd: Optional[float] = Field(default=None, gt=0, description="SGD per 1 USD")
    exchange_rate_bdt: Optional[float] = Field(default=None, gt=0, description="BDT per 1 USD")
    exchange_rate_inr: Optional[float] = Field(default=None, gt=0, description="INR per 1 USD")
    exchange_rate_jpy: Optional[float] = Field(default=None, gt=0, description="JPY per 1 USD")
    exchange_rate_cny: Optional[float] = Field(default=None, gt=0, description="CNY per 1 USD")
    exchange_rate_chf: Optional[float] = Field(default=None, gt=0, description="CHF per 1 USD")
    exchange_rate_kwd: Optional[float] = Field(default=None, gt=0, description="KWD per 1 USD")
    exchange_rate_omr: Optional[float] = Field(default=None, gt=0, description="OMR per 1 USD")
    base_currency: Optional[str] = Field(default=None, description="Active display currency code")

@router.get("/currency")
def get_currency_config(db: Session = Depends(get_db)):
    """Returns the full 14-currency configuration for frontend, POS, guest, and owner app consumption."""
    config = db.query(SystemConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="Kernel not initialized.")
    fl = config.financial_laws or {}
    return {
        "status": "SUCCESS",
        "currency": {
            "base_currency":        fl.get("base_currency", "USD"),
            "supported_currencies": fl.get("supported_currencies", ["USD", "AED", "EUR", "GBP", "SAR", "QAR", "SGD", "BDT", "INR", "JPY", "CNY", "CHF", "KWD", "OMR"]),
            # All rates stored as Units-per-1-USD
            "exchange_rate_usd":    fl.get("exchange_rate_usd", 1.00),
            "exchange_rate_aed":    fl.get("exchange_rate_aed", 3.67),
            "exchange_rate_gbp":    fl.get("exchange_rate_gbp", 0.76),
            "exchange_rate_eur":    fl.get("exchange_rate_eur", 0.90),
            "exchange_rate_sar":    fl.get("exchange_rate_sar", 3.75),
            "exchange_rate_qar":    fl.get("exchange_rate_qar", 3.64),
            "exchange_rate_sgd":    fl.get("exchange_rate_sgd", 1.34),
            "exchange_rate_bdt":    fl.get("exchange_rate_bdt", 110.50),
            "exchange_rate_inr":    fl.get("exchange_rate_inr", 83.50),
            "exchange_rate_jpy":    fl.get("exchange_rate_jpy", 150.00),
            "exchange_rate_cny":    fl.get("exchange_rate_cny", 7.20),
            "exchange_rate_chf":    fl.get("exchange_rate_chf", 0.91),
            "exchange_rate_kwd":    fl.get("exchange_rate_kwd", 0.31),
            "exchange_rate_omr":    fl.get("exchange_rate_omr", 0.38),
            "currency_symbols":     fl.get("currency_symbols", {"BDT": "৳", "USD": "$", "AED": "د.إ", "GBP": "£", "EUR": "€"}),
            "vat_rate":             fl.get("vat_rate", 15.0),
            "service_charge":       fl.get("service_charge", 10.0),
        }
    }

@router.patch("/currency")
def update_currency_rates(payload: CurrencyRateUpdate, db: Session = Depends(get_db)):
    """
    🔱 KERNEL CURRENCY ENGINE — Admin sets exchange rates manually.
    Requires Master PIN. All rates stored as BDT-per-unit (functional currency = BDT).
    Example: exchange_rate_usd = 110.5 means 1 USD = 110.5 BDT
    """
    config = db.query(SystemConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="Kernel not initialized.")

    if payload.master_pin != config.master_pin_hash:
        db.add(AuditLog(
            action="UNAUTHORIZED_CURRENCY_RATE_CHANGE",
            operator=payload.operator_id,
            target="SystemConfig.financial_laws"
        ))
        db.commit()
        raise HTTPException(status_code=401, detail="ACCESS DENIED: Invalid Master PIN.")

    try:
        fl = dict(config.financial_laws or {})
        old_base = fl.get("base_currency", "USD")

        fl["exchange_rate_usd"] = round(payload.exchange_rate_usd, 4)
        fl["exchange_rate_aed"] = round(payload.exchange_rate_aed, 4)

        optional_rates = {
            "exchange_rate_gbp": (payload.exchange_rate_gbp, 0.76),
            "exchange_rate_eur": (payload.exchange_rate_eur, 0.90),
            "exchange_rate_sar": (payload.exchange_rate_sar, 3.75),
            "exchange_rate_qar": (payload.exchange_rate_qar, 3.64),
            "exchange_rate_sgd": (payload.exchange_rate_sgd, 1.34),
            "exchange_rate_bdt": (payload.exchange_rate_bdt, 110.50),
            "exchange_rate_inr": (payload.exchange_rate_inr, 83.50),
            "exchange_rate_jpy": (payload.exchange_rate_jpy, 150.00),
            "exchange_rate_cny": (payload.exchange_rate_cny, 7.20),
            "exchange_rate_chf": (payload.exchange_rate_chf, 0.91),
            "exchange_rate_kwd": (payload.exchange_rate_kwd, 0.31),
            "exchange_rate_omr": (payload.exchange_rate_omr, 0.38),
        }
        for key, (new_val, default) in optional_rates.items():
            if new_val is not None:
                fl[key] = round(new_val, 4)
            elif key not in fl:
                fl[key] = default  # seed defaults on first use
        
        # Set active display currency (any of the 14 supported codes)
        SUPPORTED = ["USD","AED","EUR","GBP","SAR","QAR","SGD","BDT","INR","JPY","CNY","CHF","KWD","OMR"]
        if payload.base_currency and payload.base_currency in SUPPORTED:
            fl["base_currency"] = payload.base_currency
            fl["currency"]      = payload.base_currency
        elif "base_currency" not in fl:
            fl["base_currency"] = "USD"
            fl["currency"]      = "USD"

        fl["supported_currencies"] = SUPPORTED
        fl["currency_symbols"] = {
            "USD":"$","AED":"AED","EUR":"€","GBP":"£","SAR":"SAR","QAR":"QAR",
            "SGD":"S$","BDT":"৳","INR":"₹","JPY":"¥","CNY":"¥","CHF":"CHF","KWD":"KWD","OMR":"OMR"
        }

        from sqlalchemy.orm.attributes import flag_modified
        config.financial_laws = fl
        flag_modified(config, "financial_laws")

        db.add(AuditLog(
            action=(
                f"CURRENCY_RATES_UPDATED | BASE: {old_base}→{fl['base_currency']} | "
                f"USD={fl['exchange_rate_usd']} | AED={fl['exchange_rate_aed']} | "
                f"GBP={fl.get('exchange_rate_gbp','—')} | EUR={fl.get('exchange_rate_eur','—')}"
            ),
            operator=payload.operator_id,
            target="SystemConfig.financial_laws"
        ))
        db.commit()
        db.refresh(config)
        logger.info(f"✅ 14-currency rates updated by {payload.operator_id} | BASE={fl['base_currency']}")
        return {
            "status": "SUCCESS",
            "message": "All 14 currency exchange rates updated in Sovereign Kernel.",
            "currency": {k: fl[k] for k in fl if k.startswith("exchange_rate_") or k == "base_currency"}
        }
    except Exception as e:
        db.rollback()
        logger.error(f"CURRENCY_UPDATE_ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Currency Update Failed: {str(e)}")

# ==========================================
# 4. SOVEREIGN KERNEL BLUEPRINT (DYNAMIC)
# ==========================================
@router.get("/kernel")
def get_sovereign_kernel(db: Session = Depends(get_db)):
    """Retrieves the full Miracle OS Kernel Blueprint for Frontend/AI Sync."""
    kernel = kernel_manager.get_kernel()
    
    # 🔱 CDO IDENTITY INJECTION
    config = db.query(SystemConfig).first()
    if config and config.hotel_name:
        kernel["hotel_name"] = config.hotel_name
    else:
        kernel["hotel_name"] = "Miracle General Hospital & Diagnosis Center"
        
    return kernel

@router.post("/sync")
async def trigger_kernel_sync():
    """Forces a reload of the kernel and signals all nodes."""
    kernel = kernel_manager.get_kernel()
    
    # Broadcast to all connected clients via WebSocket
    try:
        from app.main import master_socket
        await master_socket.broadcast("KERNEL_UPDATE", {"version": kernel.get("version")})
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed during sync: {e}")
        
    return {"status": "SYNCED", "version": kernel.get("version")}

@router.post("/clear-ai-memory")
def clear_ai_memory(db: Session = Depends(get_db)):
    from sqlalchemy import text
    try:
        db.execute(text("DELETE FROM bot_memory"))
        db.commit()
        return {"status": "SUCCESS", "message": "AI Session Memory Purged"}
    except Exception as e:
        db.rollback()
        # Table might not exist, but let's not crash if it doesn't
        return {"status": "ERROR", "message": str(e)}

@router.post("/reset-alert-cache")
def reset_alert_cache():
    # Placeholder for actual cache reset logic if Redis or similar was used.
    # Currently alerts are DB driven.
    return {"status": "SUCCESS", "message": "Alert Cache Reset"}

@router.post("/rebuild-genesis")
def rebuild_genesis(db: Session = Depends(get_db)):
    try:
        from app.core.genesis import run_genesis_sequence
        run_genesis_sequence()
        return {"status": "SUCCESS", "message": "Genesis Tables Rebuilt"}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

# ==========================================
# 5. DIAGNOSTICS KERNEL
# ==========================================
@router.get("/diagnostics")
def get_system_diagnostics(db: Session = Depends(get_db)):
    """Provides a live health check of the Sovereign Master Database for the CDO."""
    from sqlalchemy import text
    try:
        tables_to_check = ['asset_grid', 'inventory', 'employees', 'guest_folios', 'solve_missions', 'pos_transactions']
        row_counts = {}
        for t in tables_to_check:
            try:
                count = db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                row_counts[t] = count
            except Exception:
                row_counts[t] = "ERROR"
                
        # Get active API endpoints (to detect frontend routing mismatches)
        from app.main import app as main_app
        routes = []
        for route in main_app.routes:
            if hasattr(route, 'path'):
                methods = list(route.methods) if hasattr(route, 'methods') else ["GET"]
                routes.append(f"{methods[0]} {route.path}")
                
        return {
            "status": "SUCCESS",
            "data": {
                "database_online": True,
                "row_counts": row_counts,
                "api_routes": routes
            }
        }
    except Exception as e:
        logger.error(f"DIAGNOSTICS_FATAL: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to run System Diagnostics.")

# ==========================================
# 6. SOVEREIGN VAULT (PASSWORD LOG)
# ==========================================
@router.get("/credentials")
def get_vault_credentials(db: Session = Depends(get_db)):
    """Retrieves all system-wide access credentials for the Admin Password Log."""
    try:
        creds = db.query(AccessCredential).all()
        return {"status": "SUCCESS", "data": creds}
    except Exception as e:
        logger.error(f"VAULT_FETCH_ERROR: {e}")
        return {"status": "ERROR", "message": "Vault is currently locked or offline."}

@router.post("/credentials/update")
def update_vault_credential(payload: CredentialUpdate, db: Session = Depends(get_db)):
    """Updates or Decrypts a system credential in the Sovereign Vault."""
    config = db.query(SystemConfig).first()
    if not config or payload.master_pin != config.master_pin_hash:
        raise HTTPException(status_code=401, detail="INVALID MASTER PIN — ACCESS DENIED")

    try:
        cred = db.query(AccessCredential).filter_by(label=payload.label).first()
        if not cred:
            # Creation of new labels is allowed if Master PIN is valid
            cred = AccessCredential(label=payload.label)
            db.add(cred)
        
        old_val = f"{cred.username}:{cred.password}"
        cred.username = payload.username
        cred.password = payload.password
        cred.role = payload.role
        if payload.description:
            cred.description = payload.description
        
        # Log the change to the Audit Vault
        audit = AuditLog(
            action=f"VAULT_CRED_UPDATE | Label: {payload.label} | User: {payload.username}",
            operator=payload.operator_id,
            target="AccessCredential"
        )
        db.add(audit)
        db.commit()
        
        logger.info(f"🔑 VAULT UPDATED: {payload.label} modified by {payload.operator_id}.")
        return {"status": "SUCCESS", "message": f"Vault updated: {payload.label}"}
    except Exception as e:
        db.rollback()
        logger.error(f"VAULT_WRITE_ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Vault Write Error: {str(e)}")
