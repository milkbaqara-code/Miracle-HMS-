from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.sql import func
from app.core.database import Base

class TenantRegistry(Base):
    __tablename__ = "tenant_registry"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), unique=True, index=True, nullable=False) # e.g. FB-001, HTL-002
    entity_name = Column(String(255), nullable=False)
    package_id = Column(String(100), nullable=False)
    allowed_zones = Column(String(1000), default="[]") # JSON string of allowed zone IDs
    status = Column(String(50), default="ACTIVE") # ACTIVE, SUSPENDED, EXPIRED
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    whatsapp = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    db_size_mb = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)
