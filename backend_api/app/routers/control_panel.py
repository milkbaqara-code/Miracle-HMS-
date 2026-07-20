import os
import shutil
import platform
import logging
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from app.core.database import get_db, engine
from app.models.tenant_models import TenantRegistry

logger = logging.getLogger("CONTROL-PANEL")

router = APIRouter(prefix="/api/ctrl", tags=["Sovereign Control Panel"])

class ExtendTenantRequest(BaseModel):
    days: int

def get_master_db():
    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()

def get_system_health():
    total, used, free = shutil.disk_usage("/")
    disk_used_pct = round((used / total) * 100, 1)
    
    cpu_pct = 12.5
    mem_used_pct = 38.2
    
    try:
        import psutil
        cpu_pct = psutil.cpu_percent(interval=None) or 12.5
        mem_used_pct = psutil.virtual_memory().percent or 38.2
    except ImportError:
        if platform.system() == "Linux":
            try:
                with open("/proc/loadavg", "r") as f:
                    load = float(f.read().split()[0])
                    cpu_pct = min(100.0, round(load * 10, 1))
                with open("/proc/meminfo", "r") as f:
                    lines = f.readlines()
                    mem_total = int(lines[0].split()[1])
                    mem_free = int(lines[1].split()[1])
                    mem_used_pct = round(((mem_total - mem_free) / mem_total) * 100, 1)
            except Exception:
                pass
                
    return {
        "cpu_pct": cpu_pct,
        "mem_pct": mem_used_pct,
        "disk_pct": disk_used_pct,
        "platform": platform.system(),
        "status": "ONLINE" if cpu_pct < 90 else "HIGH_LOAD"
    }

@router.get("/tenants")
def list_tenants(db: Session = Depends(get_master_db)):
    tenants = db.query(TenantRegistry).order_by(TenantRegistry.created_at.desc()).all()
    
    # Refresh DB sizes
    for t in tenants:
        if os.name == "nt":
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            parent_dir = os.path.dirname(base_dir)
            tenants_root = os.path.join(parent_dir, "miracle-tenants")
        else:
            tenants_root = "/home/miracle-tenants"
        db_path = os.path.join(tenants_root, t.tenant_id, "miracle_os.db")
        if os.path.exists(db_path):
            t.db_size_mb = round(os.path.getsize(db_path) / (1024 * 1024), 2)
            
    db.commit()
    
    return {
        "status": "SUCCESS",
        "total": len(tenants),
        "data": [
            {
                "id": t.id,
                "tenant_id": t.tenant_id,
                "entity_name": t.entity_name,
                "package_id": t.package_id,
                "allowed_zones": json.loads(t.allowed_zones) if t.allowed_zones else [],
                "status": t.status,
                "subscription_expires_at": t.subscription_expires_at.isoformat() if t.subscription_expires_at else None,
                "whatsapp": t.whatsapp,
                "email": t.email,
                "db_size_mb": t.db_size_mb,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "last_login_at": t.last_login_at.isoformat() if t.last_login_at else None
            }
            for t in tenants
        ]
    }

@router.post("/tenant/{tenant_id}/suspend")
def suspend_tenant(tenant_id: str, db: Session = Depends(get_master_db)):
    tenant = db.query(TenantRegistry).filter(TenantRegistry.tenant_id == tenant_id.lower().strip()).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    tenant.status = "SUSPENDED"
    db.commit()
    return {"status": "SUCCESS", "message": f"Tenant {tenant_id} suspended successfully."}

@router.post("/tenant/{tenant_id}/activate")
def activate_tenant(tenant_id: str, db: Session = Depends(get_master_db)):
    tenant = db.query(TenantRegistry).filter(TenantRegistry.tenant_id == tenant_id.lower().strip()).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    tenant.status = "ACTIVE"
    db.commit()
    return {"status": "SUCCESS", "message": f"Tenant {tenant_id} activated successfully."}

@router.post("/tenant/{tenant_id}/extend")
def extend_tenant_expiry(tenant_id: str, req: ExtendTenantRequest, db: Session = Depends(get_master_db)):
    tenant = db.query(TenantRegistry).filter(TenantRegistry.tenant_id == tenant_id.lower().strip()).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    
    current_expiry = tenant.subscription_expires_at
    if not current_expiry:
        current_expiry = datetime.now(timezone.utc)
        
    new_expiry = current_expiry + timedelta(days=req.days)
    tenant.subscription_expires_at = new_expiry
    db.commit()
    return {
        "status": "SUCCESS", 
        "message": f"Tenant {tenant_id} extended by {req.days} days.",
        "new_expiry": new_expiry.isoformat()
    }

@router.get("/system-health")
def system_health_status():
    return {
        "status": "SUCCESS",
        "metrics": get_system_health()
    }
