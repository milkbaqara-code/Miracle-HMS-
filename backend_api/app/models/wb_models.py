# ============================================================
# MIRACLE OS WEB BUILDER — SQLAlchemy ORM Models
# Namespaced with wb_ to avoid conflicts with existing tables
# ============================================================
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class WbPlan(Base):
    """Subscription plan tiers: free, pro, enterprise"""
    __tablename__ = 'wb_plans'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)       # 'free','pro','enterprise'
    max_ai_credits = Column(Integer, nullable=False, default=0)
    monthly_price = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship('WbUser', back_populates='plan')


class WbUser(Base):
    """Web Builder subscriber accounts (separate from hotel staff Users)"""
    __tablename__ = 'wb_users'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    plan_id = Column(Integer, ForeignKey('wb_plans.id'), nullable=False, default=1)
    ai_credits_remaining = Column(Integer, nullable=False, default=0)
    next_reset_date = Column(DateTime(timezone=True), nullable=False)

    # Payment gateway fields
    stripe_customer_id = Column(String(255), unique=True, nullable=True)
    stripe_subscription_id = Column(String(255), unique=True, nullable=True)

    # Account state
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    billing_cycle = Column(String(20), default='monthly')  # monthly | 6month | yearly

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    plan = relationship('WbPlan', back_populates='users')
    projects = relationship('WbProject', back_populates='owner', cascade='all, delete-orphan')
    usage_logs = relationship('WbAiUsageLog', back_populates='user', cascade='all, delete-orphan')
    payment_logs = relationship('WbPaymentLog', back_populates='user', cascade='all, delete-orphan')


class WbProject(Base):
    """User's builder project / website"""
    __tablename__ = 'wb_projects'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('wb_users.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False, default='My Site')
    subdomain = Column(String(100), unique=True, nullable=True)
    custom_domain = Column(String(255), unique=True, nullable=True)
    layout_json = Column(Text, nullable=True)    # Full serialized builder state
    plan_tier = Column(String(50), default='free')
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship('WbUser', back_populates='projects')


class WbAiUsageLog(Base):
    """Immutable ledger of every AI credit consumed"""
    __tablename__ = 'wb_ai_usage_log'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('wb_users.id', ondelete='CASCADE'), nullable=False)
    action = Column(String(100), nullable=False)    # 'DALLE3_GENERATE', 'VISION_TAG'
    prompt = Column(Text, nullable=True)
    credits_used = Column(Integer, default=1)
    credits_after = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship('WbUser', back_populates='usage_logs')


class WbPaymentLog(Base):
    """Immutable payment transaction ledger"""
    __tablename__ = 'wb_payment_log'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('wb_users.id', ondelete='CASCADE'), nullable=False)
    gateway = Column(String(50), nullable=False)            # 'stripe' | 'paddle'
    gateway_event = Column(String(100), nullable=True)      # 'checkout.session.completed'
    amount_usd = Column(Float, nullable=False)
    plan_purchased = Column(String(50), nullable=True)
    credits_added = Column(Integer, default=0)
    status = Column(String(50), default='SUCCESS')
    raw_payload = Column(Text, nullable=True)               # Full webhook JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship('WbUser', back_populates='payment_logs')
