import os
import shutil
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
from app.models.models import User, SystemConfig
from app.models.miracle_ai_models import AccessCredential

logger = logging.getLogger("TENANT-PROVISIONER")

router = APIRouter(prefix="/api/tenant", tags=["SaaS Tenant Provisioning"])

class TenantProvisionRequest(BaseModel):
    tenant_id: str  # e.g. "fb-001" or "cafe-ali"
    entity_name: str
    package_id: str # e.g. "FB_SUITE", "SPA_SUITE", "HOTEL_PRO"
    email: str
    whatsapp: str
    admin_password: str

class TenantResponse(BaseModel):
    status: str
    message: str
    tenant_id: str
    admin_username: str
    setup_free_days: int

def get_master_db():
    """Explicitly yields a session to the main master database"""
    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()

def get_tenant_db_path(tenant_id: str) -> str:
    if os.name == "nt":
        # Windows Workspace path
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        parent_dir = os.path.dirname(base_dir)
        tenants_root = os.path.join(parent_dir, "miracle-tenants")
    else:
        # Linux VPS path
        tenants_root = "/home/miracle-tenants"
    return os.path.join(tenants_root, tenant_id, "miracle_os.db")

@router.post("/provision", response_model=TenantResponse)
def provision_tenant_instance(req: TenantProvisionRequest, master_db: Session = Depends(get_master_db)):
    # 1. Validate tenant_id format and check if exists
    tid = req.tenant_id.lower().strip()
    import re
    if not re.match(r"^[a-z0-9-]+$", tid):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID must contain only lowercase letters, numbers, and hyphens."
        )

    existing = master_db.query(TenantRegistry).filter(TenantRegistry.tenant_id == tid).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenant ID '{tid}' is already registered."
        )

    # 2. Get paths
    db_path = get_tenant_db_path(tid)
    db_dir = os.path.dirname(db_path)
    os.makedirs(db_dir, exist_ok=True)

    # Copy template database
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    parent_dir = os.path.dirname(base_dir)
    template_path = os.path.join(parent_dir, "miracle_os_master.db")
    if not os.path.exists(template_path):
        template_path = os.path.join(base_dir, "miracle_os_master.db")

    if not os.path.exists(template_path):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Template database not found on system."
        )

    try:
        shutil.copy2(template_path, db_path)
        logger.info(f"Copied template DB to {db_path}")
    except Exception as e:
        logger.error(f"Failed to copy DB for tenant {tid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database provisioning failed: {str(e)}"
        )

    # 3. Create entry in master Tenant Registry
    setup_days = 10
    expiry_date = datetime.now(timezone.utc) + timedelta(days=365) # 1 year subscription default
    
    # Map package to default allowed zones
    package_zones = {
        "FB_SUITE": ["Z-01", "Z-02", "Z-03", "Z-04", "Z-05", "Z-06", "Z-07"],
        "SPA_SUITE": ["Z-07", "Z-08", "Z-09", "Z-10", "Z-11", "Z-12"],
        "BOUTIQUE": ["Z-07", "Z-13", "Z-14", "Z-15"],
        "FLEET_SUITE": ["Z-07", "Z-16", "Z-17", "Z-18", "Z-19", "Z-20", "Z-21"],
        "HOTEL_PRO": ["Z-01", "Z-02", "Z-03", "Z-04", "Z-05", "Z-06", "Z-07", "Z-08", "Z-09", "Z-10", "Z-11", "Z-12", "Z-13", "Z-14", "Z-15", "Z-16", "Z-17"],
        "ENTERPRISE": ["Z-01", "Z-02", "Z-03", "Z-04", "Z-05", "Z-06", "Z-07", "Z-08", "Z-09", "Z-10", "Z-11", "Z-12", "Z-13", "Z-14", "Z-15", "Z-16", "Z-17", "Z-18", "Z-19", "Z-20", "Z-21", "Z-22", "Z-23", "Z-24", "Z-25", "Z-26", "Z-27", "Z-28", "Z-29"]
    }
    allowed_zones = package_zones.get(req.package_id, package_zones["ENTERPRISE"])

    registry_entry = TenantRegistry(
        tenant_id=tid,
        entity_name=req.entity_name,
        package_id=req.package_id,
        allowed_zones=json.dumps(allowed_zones),
        status="ACTIVE",
        subscription_expires_at=expiry_date,
        whatsapp=req.whatsapp,
        email=req.email,
        db_size_mb=round(os.path.getsize(db_path) / (1024 * 1024), 2)
    )
    master_db.add(registry_entry)
    master_db.commit()

    # 4. Connect to isolated DB to configure custom credentials and clean old users
    try:
        tenant_engine = create_engine(f"sqlite:///{db_path}")
        TenantSession = sessionmaker(bind=tenant_engine)
        tenant_db = TenantSession()

        # Clean/update users table in isolated DB
        # Keep a clean slate or replace/inject administrative users
        tenant_db.query(User).delete()
        tenant_db.query(AccessCredential).delete()

        # Create primary tenant owner user (ADMIN) with CDO and SUPER_ADMIN privilege
        owner = User(
            username="ADMIN",
            hashed_password=req.admin_password,  # Storing password hash or plain based on current scheme
            role="CDO,SUPER_ADMIN",
            is_active=True
        )
        tenant_db.add(owner)

        # Seed tenant specific AccessCredential
        tenant_db.add(AccessCredential(
            label="ADMIN_GOD_MODE",
            username="ADMIN",
            password=req.admin_password,
            role="SUPER_ADMIN",
            description="Tenant Super Admin bypass"
        ))

        # Update hotel/entity name in isolated system_settings
        sys_config = tenant_db.query(SystemConfig).first()
        if sys_config:
            sys_config.hotel_name = req.entity_name
        else:
            tenant_db.add(SystemConfig(hotel_name=req.entity_name))

        tenant_db.commit()
        tenant_db.close()
        tenant_engine.dispose()
        logger.info(f"Successfully seeded admin credentials in tenant isolated DB: {tid}")
    except Exception as e:
        logger.error(f"Failed to seed admin creds in tenant DB {tid}: {e}")
        # We don't rollback master registry as the DB exists, but report setup warning
        return TenantResponse(
            status="WARNING",
            message=f"Tenant provisioned but initial credentials seeding encountered an error: {str(e)}",
            tenant_id=tid,
            admin_username="ADMIN",
            setup_free_days=setup_days
        )

    return TenantResponse(
        status="SUCCESS",
        message="Tenant isolated database provisioned and seeded successfully.",
        tenant_id=tid,
        admin_username="ADMIN",
        setup_free_days=setup_days
    )

@router.get("/status/{tenant_id}")
def get_tenant_status(tenant_id: str, master_db: Session = Depends(get_master_db)):
    tenant = master_db.query(TenantRegistry).filter(TenantRegistry.tenant_id == tenant_id.lower().strip()).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant registry record not found."
        )
    return {
        "tenant_id": tenant.tenant_id,
        "entity_name": tenant.entity_name,
        "package_id": tenant.package_id,
        "status": tenant.status,
        "subscription_expires_at": tenant.subscription_expires_at,
        "whatsapp": tenant.whatsapp,
        "email": tenant.email,
        "db_size_mb": tenant.db_size_mb,
        "created_at": tenant.created_at
    }

@router.post("/suspend/{tenant_id}")
def suspend_tenant_instance(tenant_id: str, master_db: Session = Depends(get_master_db)):
    tenant = master_db.query(TenantRegistry).filter(TenantRegistry.tenant_id == tenant_id.lower().strip()).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant registry record not found."
        )
    tenant.status = "SUSPENDED"
    master_db.commit()
    return {"status": "SUCCESS", "message": f"Tenant {tenant_id} has been suspended."}

@router.post("/activate/{tenant_id}")
def activate_tenant_instance(tenant_id: str, master_db: Session = Depends(get_master_db)):
    tenant = master_db.query(TenantRegistry).filter(TenantRegistry.tenant_id == tenant_id.lower().strip()).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant registry record not found."
        )
    tenant.status = "ACTIVE"
    master_db.commit()
    return {"status": "SUCCESS", "message": f"Tenant {tenant_id} has been activated."}
