from sqlalchemy import Column, Integer, String, Float, Boolean, JSON, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from app.models.tenant_models import TenantRegistry
# ==========================================
# ZONE 21: OS KERNEL SETTINGS
# ==========================================
class SystemConfig(Base):
    """The Master Brain: Controls Kernel behavior & Security Bridges"""
    __tablename__ = "system_settings"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    auth_expiry_minutes = Column(Integer, default=480)
    ip_whitelist = Column(Text, default="127.0.0.1")
    sync_pulse_interval = Column(Integer, default=2)
    biometric_threshold = Column(Float, default=0.85)
    stripe_live_mode = Column(Boolean, default=False)
    system_log_level = Column(String(50), default="DEBUG")
    auto_backup = Column(Boolean, default=True)
    master_pin_hash = Column(String(255), default="1414") 
    hotel_name = Column(String(255), default="Miracle General Hospital & Diagnosis Center") 
    
    # 🛡️ Sovereign Global Laws (VAT/SC/Penalty constants)
    financial_laws = Column(JSON, default=dict) 

# ==========================================
# ZONE 02/11: SECURITY GATE & HR DNA
# ==========================================
class User(Base):
    """Core Authentication & RBAC Vault"""
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True} 

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(255), default="STAFF")  # Expanded: supports comma-separated multi-role (CDO,GM,HR)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    employee_profile = relationship("Employee", back_populates="user", uselist=False)

class Employee(Base):
    """Staff Registry and ROI Intelligence (SOVEREIGN EXPANDED)"""
    __tablename__ = "employees"
    __table_args__ = {'extend_existing': True}

    id = Column(String(50), primary_key=True, index=True) # e.g., OP-777
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    
    # 🛡️ CDO FIX: Added missing Identity & HR fields
    full_name = Column(String(255), nullable=False)
    last_name = Column(String(100), nullable=True)
    position = Column(String(100), nullable=True)
    dept = Column(String(50), index=True) # PRIMARY dept for backward compat (HK, MN, RS, IT)
    status = Column(String(50), default="OFFLINE") # ON-DUTY, OFFLINE, TERMINATED
    joined_date = Column(DateTime(timezone=True), server_default=func.now())
    shift_start = Column(DateTime(timezone=True), nullable=True)  # Time tracked shift — run migrate_all_models.py if missing
    avatar_url = Column(Text, nullable=True)
    gender = Column(String(20), nullable=True, default="UNSPECIFIED")  # MALE | FEMALE | UNSPECIFIED

    # PRESENCE MATRIX V2: is_online is DECOUPLED from on_duty status.
    # A staff member can be OFFLINE (not working) but ONLINE (watching cinema, on radio).
    is_online = Column(Boolean, default=False, nullable=False)  # WebSocket heartbeat driven
    last_seen = Column(DateTime(timezone=True), nullable=True)  # Timestamp of last heartbeat

    # SOVEREIGN HR V2: Super Enterprise Multi-Alignment
    department_alignments = Column(JSON, default=list)  # ["Accounts & Audit", "IT Integration", ...]
    executive_tier = Column(String(50), default="OPERATIVE")  # OPERATIVE|MANAGER|DIRECTOR|C-SUITE|BOARD
    industry_verticals = Column(JSON, default=list)  # ["Hospitality", "Finance", "Healthcare", ...]

    # 📈 Performance ROI & Financial Tracking (CDO Upgrades)
    base_salary = Column(Float, default=0.0)
    commission_rate = Column(Float, default=0.0)
    doctor_commission_rate = Column(Float, default=0.70)
    revenue_impact = Column(Float, default=0.0)
    monthly_hours = Column(Float, default=0.0)
    missions_secured = Column(Integer, default=0)
    efficiency_rating = Column(Float, default=100.0)

    # 🏆 SYNAPSE EFFICIENCY ENGINE — Zone 20 ↔ Zone 17
    avg_response_minutes = Column(Float, nullable=True)   # Calculated from directive_nodes
    performance_stars = Column(Integer, nullable=True)    # 1–5 stars derived from avg_response
    tasks_completed = Column(Integer, default=0)          # Total directive nodes completed

    user = relationship("User", back_populates="employee_profile")
    missions = relationship("SolveMission", back_populates="assignee")

# ==========================================
# ZONE 05: RESERVATIONS & CRM DNA
# ==========================================
class Reservation(Base):
    """The Infinite Tape Ledger (Future Asset Locking)"""
    __tablename__ = "reservations"
    __table_args__ = {'extend_existing': True}

    id = Column(String(100), primary_key=True, index=True) # RES-XXXX
    room_id = Column(String(50), ForeignKey("asset_grid.room_id"), index=True)
    guest_crm_id = Column(String(50), ForeignKey("guest_crm.id"), nullable=True)
    guest_name = Column(String(255), nullable=False)
    
    start_date = Column(DateTime(timezone=True), nullable=False)
    nights = Column(Integer, default=1)
    status = Column(String(50), default="CONFIRMED") 
    
    nightly_rate = Column(Float, nullable=False)
    total_yield = Column(Float, nullable=False)
    vault_token = Column(String(255), nullable=True) 
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class GuestDNA(Base):
    """Sovereign CRM Intelligence"""
    __tablename__ = "guest_dna"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), unique=True, index=True)
    passport_nid = Column(String(100), unique=True)
    preferences = Column(JSON, default=list) 
    last_stay = Column(DateTime(timezone=True))

class GuestCRM(Base):
    """The Permanent Vault for Guest Data"""
    __tablename__ = "guest_crm"
    __table_args__ = {'extend_existing': True}

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    full_name = Column(String(255), unique=True, index=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    passport_nid = Column(String(100), unique=True, index=True, nullable=True)
    
    # 🛡️ SOCIAL AUTH KERNEL (Level 1 Hub Access)
    social_id = Column(String(255), unique=True, index=True, nullable=True) 
    social_provider = Column(String(50), nullable=True) # GOOGLE, FACEBOOK
    password_hash = Column(String(255), nullable=True)
    
    total_ltv = Column(Float, default=0.0)
    total_stays = Column(Integer, default=0)
    vip_tier = Column(String(50), default="STANDARD") # STANDARD, GOLD, PLATINUM, ROYAL
    preferences = Column(JSON, default=list)
    coins = Column(Float, default=0.0) # Loyalty Points / Cashback
    
    # 🩺 INSURANCE & TPA DATA
    insurance_provider = Column(String(255), nullable=True)
    policy_number = Column(String(255), nullable=True)
    co_pay_pct = Column(Float, default=0.20) # e.g. 20% patient cash co-pay

    active_occupancies = relationship("ActiveOccupancy", back_populates="guest", cascade="all, delete-orphan")

class ActiveOccupancy(Base):
    """The Ultra-Fast POS Radar"""
    __tablename__ = "active_occupancy"
    __table_args__ = {'extend_existing': True}

    room_number = Column(String(50), primary_key=True)
    guest_crm_id = Column(String(50), ForeignKey("guest_crm.id", ondelete="CASCADE"), index=True)
    folio_id = Column(Integer, ForeignKey("guest_folios.id", ondelete="CASCADE"))
    check_in_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    guest = relationship("GuestCRM", back_populates="active_occupancies")
    folio = relationship("GuestFolio")

# ==========================================
# ZONE 08: GUEST FOLIO
# ==========================================
class GuestFolio(Base):
    """Current Active Guest Financial Ledger"""
    __tablename__ = "guest_folios"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(50), ForeignKey("asset_grid.room_id")) 
    guest_crm_id = Column(String(50), ForeignKey("guest_crm.id", ondelete="SET NULL"), nullable=True)
    guest_name = Column(String(255), nullable=False)
    status = Column(String(50), default="IN_HOUSE") 
    
    balance = Column(Float, default=0.0)
    rate = Column(Float, default=0.0)
    advance_paid = Column(Float, default=0.0)
    ref_staff = Column(String(100), default="NONE")
    
    check_in_date = Column(DateTime(timezone=True), server_default=func.now())
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Financial Engine Fields
    payment_network = Column(String(50), nullable=True) # VISA, MASTERCARD, AMEX, CASH
    gateway_txn_id = Column(String(255), nullable=True) # Stripe/Adyen token
    last_4_digits = Column(String(4), nullable=True)
    
    charges = relationship("FolioCharge", back_populates="folio", cascade="all, delete-orphan")

class FolioCharge(Base):
    """Itemized record of charges for a guest folio"""
    __tablename__ = "folio_charges"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    folio_id = Column(Integer, ForeignKey("guest_folios.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(255), nullable=False)
    category = Column(String(100)) # F&B, SPA, HK, etc.
    amount = Column(Float, nullable=False)
    qty = Column(Float, default=1.0)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    transaction_id = Column(String(100), nullable=True)
    
    folio = relationship("GuestFolio", back_populates="charges")

# ==========================================
# ZONE 12/14: INVENTORY & POS
# ==========================================
class Inventory(Base):
    """Unified Asset Vault"""
    __tablename__ = "inventory"
    __table_args__ = {'extend_existing': True}

    product_id = Column(String(100), primary_key=True, index=True) 
    name = Column(String(255), nullable=False)
    type = Column(String(50), index=True, default="PRODUCT") 
    dept = Column(String(100), index=True)        
    cat = Column(String(50), default="CONSUMABLE")
    margin = Column(String(50), default="0.0")
    min_level = Column(Float, default=5.0)
    s_unit = Column(String(50), default="PCS")
    p_unit = Column(String(50), default="BOX")
    factor = Column(Float, default=1.0)
    desc = Column(String(500), nullable=True)
    img = Column(Text, nullable=True)
    barcode = Column(String(100), nullable=True)
    shelf_location = Column(String(100), nullable=True)
    active_ingredient = Column(String(255), nullable=True)
    dosage_form = Column(String(100), nullable=True)
    
    pp = Column(Float, default=0.0)               
    rp = Column(Float, default=0.0) 
    stock = Column(Float, default=0.0)
    bom = Column(JSON, default=list)              
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class InventoryAuditLedger(Base):
    """Wastage & Audit Ledger for Single Kernel BOM Engine"""
    __tablename__ = "inventory_audit_ledger"
    __table_args__ = {'extend_existing': True}

    id = Column(String(100), primary_key=True, index=True)
    product_id = Column(String(100), ForeignKey("inventory.product_id", ondelete="CASCADE"), index=True)
    product_name = Column(String(512), nullable=True)
    action_type = Column(String(64), nullable=False) # WASTAGE, AUDIT_ADJUSTMENT, MANUAL_ADD
    qty_changed = Column(Float, nullable=False)
    stock_before = Column(Float, nullable=True)
    stock_after = Column(Float, nullable=True)
    unit_cost = Column(Float, default=0.0)
    cost_impact = Column(Float, default=0.0)
    reason = Column(Text, nullable=True)
    department = Column(String(128), default="GLOBAL_AUDIT")
    operator = Column(String(255), nullable=True)
    source_tx_id = Column(String(255), nullable=True)
    zone_id = Column(String(64), nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    inventory_item = relationship("Inventory")

class POSTransaction(Base):
    """Immutable Ledger for Smart TV & POS orders"""
    __tablename__ = "pos_transactions"
    __table_args__ = {'extend_existing': True}

    id = Column(String(100), primary_key=True, index=True) 
    terminal_id = Column(String(100), index=True)
    cashier_pin = Column(String(100), nullable=True)
    guest_type = Column(String(50), nullable=True) # WALK_IN, HOTEL_GUEST, VIP_MEMBER
    guest_ref = Column(String(50), index=True)
    payment_method = Column(String(50), nullable=True) # CASH, CREDIT_CARD, ROOM_CHARGE
    
    subtotal = Column(Float, default=0.0)
    total_cogs = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    vat = Column(Float, default=0.0)
    sc = Column(Float, default=0.0)
    grand_total = Column(Float, default=0.0)
    true_profit = Column(Float, default=0.0)
    zone_gl_code = Column(Integer, default=410000)
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    items = relationship("POSOrderItem", back_populates="transaction", cascade="all, delete-orphan")

class POSOrderItem(Base):
    __tablename__ = "pos_order_items"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(100), ForeignKey("pos_transactions.id", ondelete="CASCADE"))
    product_id = Column(String(100))
    name = Column(String(255))
    type = Column(String(50))
    qty = Column(Float, default=1.0)
    rp = Column(Float, default=0.0)
    cogs = Column(Float, default=0.0)
    is_foc = Column(Boolean, default=False)
    
    transaction = relationship("POSTransaction", back_populates="items")

# ==========================================
# ZONE 16/17: SYSTEM RADAR (SOLVE)
# ==========================================
class SolveMission(Base):
    """Tactical Ticketing with Temporal ROI Tracking"""
    __tablename__ = "solve_missions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    room_no = Column(String(50), ForeignKey("asset_grid.room_id"), index=True, nullable=False) 
    dept = Column(String(50), index=True, nullable=False)    
    subject = Column(String(255), nullable=False)
    priority = Column(String(50), default="NORMAL") # LOW, NORMAL, CRITICAL          
    status = Column(String(50), default="PENDING") # PENDING, ACTIVE, RESOLVED           
    sop_steps = Column(JSON, default=list) 
    
    # 🛡️ CDO FIX: String identifier to easily match the 'assigned_to' logic in engine.py
    assigned_to = Column(String(100), default="Unassigned")
    operator_id = Column(String(50), ForeignKey("employees.id"), nullable=True)
    
    # 🕒 HR ROI TELEMETRY
    raised_at = Column(DateTime(timezone=True), server_default=func.now())
    picked_up_at = Column(DateTime(timezone=True), nullable=True)
    secured_at = Column(DateTime(timezone=True), nullable=True)
    
    # 🛡️ CDO FIX: The Visual Proof Vault
    proof_image_url = Column(String(255), nullable=True)
    
    assignee = relationship("Employee", back_populates="missions")

# ==========================================
# ZONE 18: SOVEREIGN ACCOUNTING KERNEL (REPLACEMENT)
# ==========================================
class Account(Base):
    """Chart of Accounts (CoA) Core"""
    __tablename__ = "accounts"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(Integer, unique=True, index=True, nullable=False) # e.g., 1000
    name = Column(String(255), nullable=False) # e.g., Cash/Bank
    type = Column(String(50), nullable=False) # ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    
    lines = relationship("LedgerLine", back_populates="account")

class JournalEntry(Base):
    """Header for every financial event"""
    __tablename__ = "journal_entries"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    reference_type = Column(String(100), index=True) # e.g., 'VOUCHER', 'STOCK_PURCHASE', 'POS_SALE'
    description = Column(String(500))
    verification_status = Column(String(50), default="PENDING") # PENDING, VERIFIED, QUARANTINED
    posted_by = Column(String(100), nullable=True)
    approved_by = Column(String(100), nullable=True)
    approval_notes = Column(String(500), nullable=True)
    currency_code = Column(String(10), default="USD")
    exchange_rate = Column(Float, default=1.0)
    
    lines = relationship("LedgerLine", back_populates="journal", cascade="all, delete-orphan")

class LedgerLine(Base):
    """Atomic balancing lines for ACID compliance"""
    __tablename__ = "ledger_lines"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)
    currency_code = Column(String(10), default="USD")
    exchange_rate = Column(Float, default=1.0)
    fixed_asset_id = Column(Integer, ForeignKey("fixed_assets.id", ondelete="SET NULL"), nullable=True)
    
    journal = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account", back_populates="lines")

class AccountingLedger(Base):
    """LEGACY: The Immutable General Ledger (Migrating to Sovereign Kernel)"""
    __tablename__ = "accounting_ledger"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    
    transaction_ref = Column(String(100), unique=True, index=True, nullable=False) 
    
    type = Column(String(50), nullable=False) # DEBIT, CREDIT
    category = Column(String(100), nullable=False) # REVENUE, EXPENSE, TAX, PAYROLL
    
    amount = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    
    description = Column(String(255))
    operator_id = Column(String(100))
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Enterprise Payment Integration
    payment_network = Column(String(50), nullable=True)
    gateway_txn_id = Column(String(255), nullable=True)
    last_4_digits = Column(String(4), nullable=True)

# ==========================================
# ZONE 19: POLICY ENGINE (MDM)
# ==========================================
class AssetGrid(Base):
    """The Supreme Source of Truth for Physical Resort Inventory"""
    __tablename__ = "asset_grid"
    __table_args__ = {'extend_existing': True}

    room_id = Column(String(50), primary_key=True)
    category = Column(String(100)) # ROYAL SUITE, DELUXE QUEEN, etc.
    base_rate = Column(Float, nullable=False, default=5500.0)
    floor = Column(Integer)
    is_active = Column(Boolean, default=True)

    # Live Snapshot for Command Grid (Zone 07)
    current_status = Column(String(50), default="AVAILABLE")
    current_guest = Column(String(255), default="NONE")

    # ==========================================
    # ZONE 30: PROPERTY MANAGEMENT (PMS)
    # Ownership taxonomy for correct financial accounting
    # ==========================================
    # OWNED: Resort owns the property freehold (linked to fixed_assets depreciation)
    # RENTED: Resort leases from landlord (rent_payable is monthly lease cost)
    # AFFILIATED: Managed franchise (commission_rate % of booking yield paid to owner)
    ownership_type = Column(String(20), default="OWNED")  # OWNED | RENTED | AFFILIATED
    commission_rate = Column(Float, default=0.0)          # % commission for AFFILIATED (e.g. 15.0)
    rent_payable = Column(Float, default=0.0)             # Monthly lease liability for RENTED
    fixed_asset_id = Column(Integer, ForeignKey("fixed_assets.id", ondelete="SET NULL"), nullable=True)  # OWNED only
    capitalized_setup_cost = Column(Float, default=0.0)   # Calculated from BOM fixtures
    # Owner/Landlord contact for RENTED or AFFILIATED properties
    owner_entity = Column(String(255), nullable=True)     # Owner name or company
    lease_start = Column(DateTime(timezone=True), nullable=True)  # Lease start date
    lease_end = Column(DateTime(timezone=True), nullable=True)    # Lease end date

    # Expanded Z-30 properties
    size_sqft = Column(Float, default=1200.0)
    rooms_detail = Column(JSON, nullable=True)
    facilities_detail = Column(JSON, nullable=True)
    carousel_images = Column(JSON, nullable=True)
    video_url = Column(String(500), nullable=True)
    property_location = Column(String(255), default="Dubai Marina, UAE")
    owner_address = Column(String(500), nullable=True)
    owner_contact = Column(String(255), nullable=True)
    owner_bank_details = Column(JSON, nullable=True)
    owner_nid = Column(String(100), nullable=True, index=True)

    # ==========================================
    # PHASE 1 UPGRADE: Co-Owner & Mortgage Fields
    # owner_type: FULL_OWNER | MORTGAGE_BUYER | RENTAL_OWNER
    # FULL_OWNER   - Owns the unit outright, receives 100% net yield after management fee
    # MORTGAGE_BUYER - Bought via installment; yield is netted against monthly installment
    # RENTAL_OWNER - Leases FROM them at a fixed monthly rent; they receive fixed_lease_rent
    # ==========================================
    owner_type = Column(String(30), default="FULL_OWNER")          # FULL_OWNER | MORTGAGE_BUYER | RENTAL_OWNER
    pool_category = Column(String(100), nullable=True)             # Pool name e.g. ROYAL_POOL, DELUXE_POOL
    currency_code = Column(String(10), default="USD")              # Owner transaction currency (base = USD)

    # Mortgage fields (active when owner_type = MORTGAGE_BUYER)
    mortgage_total = Column(Float, default=0.0)                    # Total purchase price on installment
    mortgage_monthly_payment = Column(Float, default=0.0)          # Monthly installment due
    mortgage_paid_to_date = Column(Float, default=0.0)             # Total principal already paid
    mortgage_interest_rate = Column(Float, default=0.0)            # Annual interest rate e.g. 8.5
    mortgage_due_day = Column(Integer, default=5)                   # Day of month installment is due
    mortgage_balance = Column(Float, default=0.0)                  # Remaining principal outstanding

    # Lease fields (active when owner_type = RENTAL_OWNER)
    lease_fixed_rent = Column(Float, default=0.0)                  # Fixed monthly rent payable TO owner

    # HR link: If this owner is also a registered employee/investor
    linked_employee_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)

    # Yield tracking (cumulative, reset each fiscal period)
    ytd_gross_yield = Column(Float, default=0.0)                   # Year-to-date gross room revenue
    ytd_net_yield = Column(Float, default=0.0)                     # After management fee deductions
    management_fee_pct = Column(Float, default=20.0)               # % taken by management (default 20%)
    nights_occupied_ytd = Column(Integer, default=0)               # For AI rotation dispatcher

    # Manual override audit
    last_override_by = Column(String(100), nullable=True)          # CDO/GM ID who last overrode AI dispatch
    last_override_reason = Column(Text, nullable=True)             # Mandatory reason for override
    last_override_at = Column(DateTime(timezone=True), nullable=True)

    # BOM links for this property

class PolicySOP(Base):
    """The Master Duty Checklist Repository"""
    __tablename__ = "policy_sop"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    dept = Column(String(50), index=True) # HK, RS, MN, IT
    task_list = Column(JSON, default=list) 
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())

class AuditLog(Base):
    """System-wide Security Radar"""
    __tablename__ = "audit_logs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(255), nullable=False)
    operator = Column(String(100), nullable=False)
    target = Column(String(255), nullable=True) 
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

# ==========================================
# ZONE 30 PHASE 1: PMS OWNER LEDGER
# Immutable record of every owner disbursement, mortgage netting, and lease payment.
# idempotency_key enforces: one entry per owner per month per event type.
# ==========================================
class Vendor(Base):
    __tablename__ = 'vendors'
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    contact = Column(String(100), nullable=True)
    tax_id = Column(String(100), nullable=True)
    payment_terms_days = Column(Integer, default=30)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    invoices = relationship('APInvoice', back_populates='vendor', cascade='all, delete-orphan')

class APInvoice(Base):
    __tablename__ = 'ap_invoices'
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey('vendors.id', ondelete='CASCADE'), nullable=False)
    invoice_ref = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(500), nullable=True)
    amount = Column(Float, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default='OUTSTANDING')
    journal_id = Column(Integer, ForeignKey('journal_entries.id'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    vendor = relationship('Vendor', back_populates='invoices')

class ARReceivable(Base):
    __tablename__ = 'ar_receivables'
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String(255), nullable=False)
    ota_type = Column(String(100), nullable=True)
    folio_id = Column(Integer, ForeignKey('guest_folios.id', ondelete='SET NULL'), nullable=True)
    reservation_id = Column(String(100), nullable=True)
    amount = Column(Float, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default='OUTSTANDING')
    journal_id = Column(Integer, ForeignKey('journal_entries.id'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ==========================================
# ZONE 25: MIRACLE CINEMA (GUEST MULTIMEDIA)
# ==========================================
class MovieAsset(Base):
    """Stores metadata and links for movies streamed to Guest Devices"""
    __tablename__ = 'movie_vault'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    category = Column(String(100), index=True) # ACTION, SCIFI, HORROR, CAROUSEL
    is_paid = Column(Boolean, default=False)
    price = Column(Float, default=0.0)
    
    drive_file_id = Column(String(255), nullable=True) # Google Drive Link/ID for Full Movie
    trailer_url = Column(Text, nullable=True) # Local path to uploaded MP4
    poster_url = Column(Text, nullable=True) # Cover image
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ==========================================
# ZONE 18: SOVEREIGN ACCOUNTING VAULT (DOCUMENTS)
# ==========================================
class FinancialDocument(Base):
    """Immutable Ledger for Generated Accounting PDFs"""
    __tablename__ = 'financial_documents'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    doc_type = Column(String(50), index=True) # REVENUE_VOUCHER, SALARY_SLIP, DISBURSEMENT
    doc_ref = Column(String(100), unique=True, index=True) # Cryptographic ID
    description = Column(String(500), nullable=True)
    amount = Column(Float, nullable=True)
    
    # 🔗 Links to the operative if it's a salary slip
    employee_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    
    file_url = Column(Text, nullable=False) # Cloud or Local path to the PDF
    generated_by = Column(String(100), nullable=False) # Operator who generated it
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PayrollLog(Base):
    """Tracks the 5th-of-the-month automated payouts"""
    __tablename__ = 'payroll_logs'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    month_year = Column(String(50), index=True) # e.g. "05-2026"
    employee_id = Column(String(50), ForeignKey("employees.id"))
    
    base_salary_calculated = Column(Float, default=0.0)
    commission_calculated = Column(Float, default=0.0)
    total_paid = Column(Float, default=0.0)
    
    status = Column(String(50), default="GENERATED") # GENERATED, PAID
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ==========================================
# ZONE 20: SOVEREIGN SYNAPSE NEXUS
# ==========================================
class StrategicDirective(Base):
    """High-level Strategic Tasks for the Synapse War Room"""
    __tablename__ = 'strategic_directives'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="ACTIVE") # BACKLOG, ACTIVE, REVIEW, SECURED
    priority = Column(String(50), default="NORMAL") # NORMAL, CRITICAL, STRATEGIC
    
    issued_by = Column(String(100), nullable=False) # Usually CEO or Dept Head
    target_dept = Column(String(50), index=True) # Target Department
    tagged_operatives = Column(JSON, default=list) # Array of employee IDs
    parent_directive_id = Column(Integer, ForeignKey("strategic_directives.id", ondelete="CASCADE"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    picked_at = Column(DateTime(timezone=True), nullable=True)    # When first node is started
    reviewed_at = Column(DateTime(timezone=True), nullable=True)  # When status → REVIEW
    
    nodes = relationship("DirectiveNode", back_populates="directive", cascade="all, delete-orphan")
    sub_directives = relationship("StrategicDirective", back_populates="parent_directive", cascade="all, delete-orphan")
    parent_directive = relationship("StrategicDirective", remote_side=[id], back_populates="sub_directives")

class DirectiveNode(Base):
    """Sub-tasks assigned to specific staff under a Directive"""
    __tablename__ = 'directive_nodes'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    directive_id = Column(Integer, ForeignKey("strategic_directives.id", ondelete="CASCADE"))
    task_name = Column(String(255), nullable=False)
    
    assigned_to_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    target_dept = Column(String(50), nullable=True, index=True) # Phase 26: Dept level assignments
    is_completed = Column(Boolean, default=False)
    
    # PERFORMANCE & TIME TRACKING
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # PHASE 2: AGI Zero-Trust Verification
    requires_verification = Column(Boolean, default=False)
    verification_status = Column(String(50), default="NONE") # NONE, PENDING, VERIFIED, REJECTED
    
    directive = relationship("StrategicDirective", back_populates="nodes")

class WebRTCSession(Base):
    """Logs active and past secure video/voice conferences"""
    __tablename__ = 'webrtc_sessions'
    __table_args__ = {'extend_existing': True}

    room_id = Column(String(100), primary_key=True, index=True)
    room_name = Column(String(255), nullable=False)
    created_by = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

# ==========================================
# ZONE 20: SYNAPSE NEXUS -- CORPORATE HIERARCHY MESSENGER
# ==========================================
class SynapseThread(Base):
    """
    A conversation container. Enforces Iron Law: Hierarchy Gating.
    thread_type: DIRECT | BRIDGED | DEPARTMENT
    initiator_tier / target_tier: integer weights (4=CDO, 3=DIRECTOR, 2=MANAGER, 1=OPERATIVE)
    bridge_manager_id: set only when a BRIDGED thread is created (the forced CC manager)
    """
    __tablename__ = 'synapse_threads'
    __table_args__ = {'extend_existing': True}

    id = Column(String(50), primary_key=True, index=True, default=lambda: f"THR-{uuid.uuid4().hex[:8].upper()}")
    thread_type = Column(String(20), default='DIRECT')   # DIRECT | BRIDGED | DEPARTMENT
    subject = Column(String(255), nullable=True)

    initiator_id = Column(String(50), nullable=False)    # employee.id who started thread
    initiator_tier = Column(Integer, default=1)
    target_id = Column(String(50), nullable=False)        # employee.id being messaged
    target_tier = Column(Integer, default=1)
    bridge_manager_id = Column(String(50), nullable=True) # Forced CC when BRIDGED

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_message_at = Column(DateTime(timezone=True), nullable=True)

    messages = relationship("SynapseMessage", back_populates="thread", cascade="all, delete-orphan")

class SynapseMessage(Base):
    """Individual message within a SynapseThread."""
    __tablename__ = 'synapse_messages'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(String(50), ForeignKey("synapse_threads.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(String(50), nullable=False)        # employee.id
    sender_name = Column(String(150), nullable=False)
    sender_tier = Column(Integer, default=1)
    content = Column(Text, nullable=False)
    msg_type = Column(String(20), default='TEXT')         # TEXT | DOCUMENT | TASK | SYSTEM
    attachment_url = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())

    thread = relationship("SynapseThread", back_populates="messages")

# ==========================================
# ZONE 20: SOVEREIGN STAFF VAULT
# ==========================================
class StaffVault(Base):
    """
    One immutable vault per onboarded employee.
    Created automatically upon HR onboarding.
    Stores the permanent digital record of the employee.
    """
    __tablename__ = 'staff_vaults'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.id", ondelete="CASCADE"), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    files = relationship("VaultFile", back_populates="vault", cascade="all, delete-orphan")


class VaultFile(Base):
    """
    A single file stored in a StaffVault or exchanged in a SynapseThread.
    Physical file lives on VPS at: /srv/synapse_vault/{employee_id}/{file_id}
    """
    __tablename__ = 'vault_files'
    __table_args__ = {'extend_existing': True}

    id = Column(String(50), primary_key=True, default=lambda: f"VF-{uuid.uuid4().hex[:10].upper()}")
    vault_id = Column(Integer, ForeignKey("staff_vaults.id", ondelete="CASCADE"), nullable=True)  # nullable for thread-shared files
    thread_id = Column(String(50), ForeignKey("synapse_threads.id", ondelete="SET NULL"), nullable=True)  # set if shared in chat
    directive_id = Column(Integer, ForeignKey("strategic_directives.id", ondelete="CASCADE"), nullable=True) # For Directive attachments

    # File metadata
    original_name = Column(String(500), nullable=False)  # e.g. "Payslip_May2026.pdf"
    file_type = Column(String(100), nullable=True)       # e.g. "application/pdf"
    file_size_bytes = Column(Integer, default=0)
    vps_path = Column(Text, nullable=False)              # Absolute path on VPS disk
    category = Column(String(50), default="DOCUMENT")   # PAYSLIP | JOINING_RECORD | DOCUMENT | CHAT_ATTACHMENT
    description = Column(String(500), nullable=True)

    uploaded_by = Column(String(50), nullable=False)    # employee.id who uploaded
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    vault = relationship("StaffVault", back_populates="files")


# ==========================================
# ZONE 20: SYNAPSE COMMAND GRID — CORPORATE MATRIX
# ==========================================
class CorporateDepartment(Base):
    """
    Virtual Grid Tile — mirrors AssetGrid but for departments/areas.
    Each row is one neon tile on the Synapse Command Grid.
    Signal state is computed live from active DirectiveNodes (not stored here).

    CATEGORIES:
      DEPARTMENT   — functional divisions (IT, HR, ACCOUNTS, MARKETING)
      PHYSICAL     — non-room areas (POOL, SPA, GYM, BOARDROOM, RECEPTION)
      OPERATIONAL  — service verticals (HOUSEKEEPING, MAINTENANCE, SECURITY)

    ICON_CODE: an emoji or lucide icon name rendered in the tile header.
    SIGNAL_COLOR: base neon color override (cyan/amber/purple). Defaults to cyan.
    sort_order: controls grid display sequence (lower = rendered first).
    """
    __tablename__ = "corporate_departments"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)

    # Identity
    code        = Column(String(20),  unique=True, nullable=False, index=True)  # e.g. "IT", "HK", "POOL"
    name        = Column(String(150), nullable=False)                             # e.g. "Information Technology"
    category    = Column(String(30),  default="DEPARTMENT")                      # DEPARTMENT | PHYSICAL | OPERATIONAL
    icon_code   = Column(String(100), default="🏢")                              # emoji or icon name
    signal_color= Column(String(20),  default="cyan")                            # cyan | amber | red | purple | green

    # Metadata
    description = Column(Text, nullable=True)
    sort_order  = Column(Integer, default=100)
    is_active   = Column(Boolean, default=True)

    # Responsible leader (optional — employee.id)
    head_employee_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)

    # Audit
    created_by  = Column(String(100), nullable=False, default="SYSTEM")
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

class HRDocumentDraft(Base):
    """Stores drafts for the HR Mantala Word Module"""
    __tablename__ = "hr_document_drafts"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(String(50), nullable=False, index=True) # ID of the HR operative
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False) # HTML content
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

# ==========================================
# ZONE 26/27/28: WELLNESS, FLEET & RETAIL
# ==========================================
class ServiceBooking(Base):
    """Med-Spa & Wellness Bookings (Zone 27)"""
    __tablename__ = "service_bookings"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    guest_crm_id = Column(String(50), ForeignKey("guest_crm.id", ondelete="SET NULL"), nullable=True)
    room_number = Column(String(50), ForeignKey("asset_grid.room_id", ondelete="SET NULL"), nullable=True)
    service_name = Column(String(255), nullable=False)
    booking_time = Column(DateTime(timezone=True), nullable=False)
    employee_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True) # Therapist
    status = Column(String(50), default="SCHEDULED") # SCHEDULED, COMPLETED, CANCELLED
    rate = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class FleetDispatch(Base):
    """Aviation & Transfers (Zone 26)"""
    __tablename__ = "fleet_dispatch"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(String(100), nullable=False)
    driver_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    guest_crm_id = Column(String(50), ForeignKey("guest_crm.id", ondelete="SET NULL"), nullable=True)
    room_number = Column(String(50), ForeignKey("asset_grid.room_id", ondelete="SET NULL"), nullable=True)
    destination = Column(String(255), nullable=False)
    dispatch_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), default="EN_ROUTE") # EN_ROUTE, COMPLETED
    rate = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ==========================================
# DEPRECIATION ENGINE & ASSET REGISTER
# ==========================================
class FixedAsset(Base):
    """Fixed Asset Register for straight-line depreciation tracking"""
    __tablename__ = "fixed_assets"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    division = Column(String(50), nullable=False)  # ROOMS, F&B, FLEET, WELLNESS, BOUTIQUE, CINEMA, GENERAL
    purchase_date = Column(DateTime(timezone=True), nullable=False)
    purchase_cost = Column(Float, nullable=False)
    useful_life_months = Column(Integer, nullable=False)
    salvage_value = Column(Float, default=0.0)
    method = Column(String(50), default="STRAIGHT_LINE")
    accumulated_depreciation = Column(Float, default=0.0)
    net_book_value = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    declining_factor = Column(Float, default=2.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    depreciation_logs = relationship("DepreciationLog", back_populates="asset", cascade="all, delete-orphan")

class DepreciationLog(Base):
    """Immutable audit logs of individual straight-line depreciation events"""
    __tablename__ = "depreciation_logs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("fixed_assets.id", ondelete="CASCADE"), nullable=False)
    journal_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    amount = Column(Float, nullable=False)
    period_date = Column(DateTime(timezone=True), nullable=False) # e.g. first of month date
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    asset = relationship("FixedAsset", back_populates="depreciation_logs")

# ==========================================
# ZONE 30: PROPERTY MANAGEMENT SYSTEM (PMS)
# ==========================================

class AccountingPeriod(Base):
    """Fiscal Period Control — Prevents posting to closed periods (Oracle-grade)"""
    __tablename__ = 'accounting_periods'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    period_name = Column(String(50), nullable=False)        # e.g. "June 2026"
    fiscal_year = Column(Integer, nullable=False, index=True)
    period_month = Column(Integer, nullable=False)           # 1–12
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default='OPEN')              # OPEN | CLOSED | PERMANENTLY_CLOSED
    closed_by = Column(String(100), nullable=True)           # Employee ID
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LedgerAuditTrail(Base):
    """Immutable audit log for every change to a JournalEntry — Oracle-grade traceability"""
    __tablename__ = 'ledger_audit_trail'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey('journal_entries.id', ondelete='CASCADE'), nullable=False, index=True)
    action = Column(String(50), nullable=False)              # CREATED | APPROVED | REVERSED | AMENDED | QUARANTINED | PERIOD_LOCKED
    field_changed = Column(String(100), nullable=True)       # e.g. 'verification_status'
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    auto_remark = Column(Text, nullable=False)               # System-generated human description
    performed_by = Column(String(100), nullable=False)       # Employee ID or 'SYSTEM'
    performed_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    ip_address = Column(String(45), nullable=True)

    journal = relationship('JournalEntry', foreign_keys=[journal_id])


class BankAccount(Base):
    """Bank account register linked to GL Cash accounts"""
    __tablename__ = 'bank_accounts'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)               # e.g. "Sonali Bank — Main Current"
    bank_name = Column(String(255), nullable=False)
    account_number = Column(String(100), unique=True, nullable=False)
    gl_account_code = Column(Integer, nullable=False)        # Links to Account.code (e.g. 100000)
    currency = Column(String(10), default='BDT')
    current_balance = Column(Float, default=0.0)             # Statement balance (not GL balance)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    statement_lines = relationship('BankStatementLine', back_populates='bank_account', cascade='all, delete-orphan')


class BankStatementLine(Base):
    """Individual line from a bank statement — to be matched against GL journals"""
    __tablename__ = 'bank_statement_lines'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey('bank_accounts.id', ondelete='CASCADE'), nullable=False, index=True)
    transaction_date = Column(DateTime(timezone=True), nullable=False)
    value_date = Column(DateTime(timezone=True), nullable=True)
    description = Column(String(500), nullable=False)
    reference = Column(String(200), nullable=True)
    debit_amount = Column(Float, default=0.0)                # Money out of bank
    credit_amount = Column(Float, default=0.0)               # Money into bank
    running_balance = Column(Float, nullable=True)           # As shown on statement
    status = Column(String(20), default='UNMATCHED')         # UNMATCHED | MATCHED | EXCLUDED
    matched_journal_id = Column(Integer, ForeignKey('journal_entries.id', ondelete='SET NULL'), nullable=True)
    matched_at = Column(DateTime(timezone=True), nullable=True)
    matched_by = Column(String(100), nullable=True)
    reconciliation_session_id = Column(Integer, ForeignKey('reconciliation_sessions.id', ondelete='SET NULL'), nullable=True)
    imported_at = Column(DateTime(timezone=True), server_default=func.now())

    bank_account = relationship('BankAccount', back_populates='statement_lines')


class ReconciliationSession(Base):
    """A bank reconciliation session for a given period and bank account"""
    __tablename__ = 'reconciliation_sessions'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey('bank_accounts.id', ondelete='CASCADE'), nullable=False, index=True)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    statement_closing_balance = Column(Float, nullable=False) # From bank statement
    gl_closing_balance = Column(Float, nullable=True)         # Calculated from GL
    difference = Column(Float, nullable=True)                 # statement - gl
    status = Column(String(20), default='OPEN')               # OPEN | BALANCED | CLOSED
    opened_by = Column(String(100), nullable=False)
    closed_by = Column(String(100), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bank_account = relationship('BankAccount')


class ARPayment(Base):
    """Partial payment record for Accounts Receivable — supports partial settlements"""
    __tablename__ = 'ar_payments'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    receivable_id = Column(Integer, ForeignKey('ar_receivables.id', ondelete='CASCADE'), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime(timezone=True), server_default=func.now())
    payment_method = Column(String(50), default='CASH')       # CASH | BANK_TRANSFER | CHEQUE
    reference = Column(String(200), nullable=True)
    journal_id = Column(Integer, ForeignKey('journal_entries.id'), nullable=True)
    posted_by = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    receivable = relationship('ARReceivable')


class APPayment(Base):
    """Partial payment record for Accounts Payable — supports partial vendor settlements"""
    __tablename__ = 'ap_payments'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey('ap_invoices.id', ondelete='CASCADE'), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime(timezone=True), server_default=func.now())
    payment_method = Column(String(50), default='BANK_TRANSFER')
    reference = Column(String(200), nullable=True)
    journal_id = Column(Integer, ForeignKey('journal_entries.id'), nullable=True)
    posted_by = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship('APInvoice')


class Budget(Base):
    """Annual/monthly budget by account and division — for Budget vs Actual variance analysis"""
    __tablename__ = 'budgets'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    fiscal_year = Column(Integer, nullable=False, index=True)
    period_month = Column(Integer, nullable=False)            # 1–12 (0 = full year aggregate)
    account_code = Column(Integer, ForeignKey('accounts.code', ondelete='CASCADE'), nullable=False)
    division = Column(String(50), default='CONSOLIDATED')     # ROOMS | FB | FLEET | WELLNESS | etc.
    budget_amount = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    account = relationship('Account')


# ==========================================
# GAPS ALIGNED ENTERPRISE UPGRADE MODELS
# ==========================================
class CurrencyRate(Base):
    __tablename__ = 'currency_rates'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, index=True, nullable=False)
    rate_to_usd = Column(Float, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class TaxRate(Base):
    __tablename__ = 'tax_rates'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    rate = Column(Float, nullable=False)
    gl_account_code = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)

    rules = relationship("TaxRule", back_populates="tax_rate", cascade="all, delete-orphan")

class TaxRule(Base):
    __tablename__ = 'tax_rules'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(100), nullable=False)
    transaction_type = Column(String(50), nullable=False, index=True)
    division = Column(String(50), nullable=False, index=True)
    tax_rate_code = Column(String(30), ForeignKey("tax_rates.code"), nullable=False)
    effective_from = Column(DateTime(timezone=True), nullable=False)
    effective_to = Column(DateTime(timezone=True), nullable=True)

    tax_rate = relationship("TaxRate", back_populates="rules")

class InventoryLot(Base):
    __tablename__ = 'inventory_lots'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String(100), index=True, nullable=False)
    purchase_qty = Column(Float, nullable=False)
    remaining_qty = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SystemAuditLog(Base):
    __tablename__ = 'system_audit_logs'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    operator = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False) # INSERT, UPDATE, DELETE
    table_name = Column(String(100), nullable=False)
    record_id = Column(String(100), nullable=False)
    field_name = Column(String(100), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)


# ==========================================
# ZONE 09: SOVEREIGN TALENT ENGINE (STE)
# AGI-Driven Recruitment & Vacancy Pipeline
# SHRM + ILO International Standard
# ==========================================

class JobVacancy(Base):
    __tablename__ = "job_vacancies"
    __table_args__ = {"extend_existing": True}

    id = Column(String(50), primary_key=True, index=True)   # JV-202506-001
    title = Column(String(255), nullable=False)
    department = Column(String(150), nullable=False)
    industry_vertical = Column(String(100), nullable=True)
    executive_tier = Column(String(50), default="OPERATIVE")
    zone = Column(String(20), nullable=True)
    positions_count = Column(Integer, default=1)
    location = Column(String(255), default="On-site, UAE")
    role_summary = Column(Text, nullable=True)
    responsibilities = Column(JSON, default=list)
    requirements_mandatory = Column(JSON, default=list)
    requirements_preferred = Column(JSON, default=list)
    competencies = Column(JSON, default=list)
    working_conditions = Column(Text, nullable=True)
    salary_min = Column(Float, nullable=True)
    salary_max = Column(Float, nullable=True)
    currency = Column(String(10), default="AED")
    benefits = Column(JSON, default=list)
    linkedin_url = Column(Text, nullable=True)
    indeed_url = Column(Text, nullable=True)
    external_apply_url = Column(Text, nullable=True)
    status = Column(String(50), default="DRAFT", index=True)
    closing_date = Column(DateTime(timezone=True), nullable=True)
    is_featured = Column(Boolean, default=False)
    ai_generated = Column(Boolean, default=False)
    ai_urgency_score = Column(Float, default=0.0)
    ai_trigger_reason = Column(Text, nullable=True)
    ai_trigger_data = Column(JSON, default=dict)
    gm_notes = Column(Text, nullable=True)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    applications = relationship("JobApplication", back_populates="vacancy", cascade="all, delete-orphan")


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = {"extend_existing": True}

    id = Column(String(50), primary_key=True, index=True)   # APP-202506-001
    vacancy_id = Column(String(50), ForeignKey("job_vacancies.id", ondelete="CASCADE"), nullable=False)
    applicant_name = Column(String(255), nullable=False)
    applicant_email = Column(String(255), nullable=False, index=True)
    applicant_phone = Column(String(50), nullable=True)
    applicant_nationality = Column(String(100), nullable=True)
    current_location = Column(String(255), nullable=True)
    notice_period = Column(String(100), nullable=True)
    current_salary = Column(String(100), nullable=True)
    expected_salary = Column(String(100), nullable=True)
    cover_letter = Column(Text, nullable=True)
    cv_url = Column(Text, nullable=True)
    linkedin_profile = Column(Text, nullable=True)
    portfolio_url = Column(Text, nullable=True)
    source = Column(String(50), default="WEBSITE")
    referral_by = Column(String(100), nullable=True)
    status = Column(String(50), default="NEW", index=True)
    hr_notes = Column(Text, nullable=True)
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    onboarding_prefill = Column(JSON, default=dict)
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    vacancy = relationship("JobVacancy", back_populates="applications")

# ==========================================
# ZONE 09: HR AGI — COMPLIANCE ENGINE
# Tracks all staff documents with expiry alerts
# ==========================================
class EmployeeDocument(Base):
    """Tracks visa, passport, Emirates ID, health card — with expiry alerts"""
    __tablename__ = "employee_documents"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type = Column(String(50), nullable=False, index=True)
    # VISA | EMIRATES_ID | PASSPORT | HEALTH_CARD | WORK_PERMIT | LABOUR_CONTRACT | INSURANCE_CARD
    doc_number = Column(String(100), nullable=True)
    issue_date = Column(DateTime(timezone=True), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True, index=True)  # THE CRITICAL FIELD
    issuing_authority = Column(String(255), nullable=True)
    # alert_status computed on read: OK | EXPIRING_60 | EXPIRING_30 | EXPIRING_7 | EXPIRED
    vault_file_id = Column(String(50), ForeignKey("vault_files.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    uploaded_by = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ==========================================
# ZONE 09: HR AGI — LEAVE MANAGEMENT ENGINE
# UAE Labour Law compliant leave tracking
# ==========================================
class LeaveBalance(Base):
    """Annual leave balance per employee per year"""
    __tablename__ = "leave_balances"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(Integer, nullable=False)  # e.g. 2026
    annual_entitlement = Column(Float, default=30.0)   # UAE: 30 days/year
    annual_used = Column(Float, default=0.0)
    sick_used = Column(Float, default=0.0)
    emergency_used = Column(Float, default=0.0)
    hajj_used = Column(Float, default=0.0)
    maternity_used = Column(Float, default=0.0)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class LeaveRequest(Base):
    """Individual leave request with full approval workflow"""
    __tablename__ = "leave_requests"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type = Column(String(50), nullable=False)
    # ANNUAL | SICK | EMERGENCY | HAJJ | MATERNITY | PATERNITY | UNPAID | STUDY
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    days_requested = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(50), default="PENDING", index=True)
    # PENDING | APPROVED | REJECTED | CANCELLED
    approved_by = Column(String(50), nullable=True)          # employee.id of approver
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    synapse_thread_id = Column(String(50), nullable=True)    # Synapse thread for this request
    cover_plan = Column(Text, nullable=True)                 # Who covers during absence
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ==========================================
# ZONE 09: HR AGI — TRAINING & CERTIFICATION ENGINE
# Links to Synapse StrategicDirective for task tracking
# ==========================================
class TrainingProgram(Base):
    """Defines a training course or certification requirement"""
    __tablename__ = "training_programs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    # HACCP | FIRE_SAFETY | FIRST_AID | FOOD_HYGIENE | HOSPITALITY | IT_SECURITY | CUSTOM
    description = Column(Text, nullable=True)
    expiry_months = Column(Integer, default=12)    # How many months cert is valid
    is_mandatory = Column(Boolean, default=False)
    applicable_depts = Column(JSON, default=list)  # Which dept codes this applies to
    created_by = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    enrollments = relationship("TrainingEnrollment", back_populates="program", cascade="all, delete-orphan")


class TrainingEnrollment(Base):
    """Tracks an employee's enrollment and completion of a training program"""
    __tablename__ = "training_enrollments"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    program_id = Column(Integer, ForeignKey("training_programs.id", ondelete="CASCADE"), nullable=False)
    directive_id = Column(Integer, ForeignKey("strategic_directives.id", ondelete="SET NULL"), nullable=True)
    # ↑ Links to Synapse Kanban card for task tracking
    status = Column(String(50), default="ENROLLED", index=True)
    # ENROLLED | IN_PROGRESS | COMPLETED | EXPIRED | FAILED
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    cert_expiry_date = Column(DateTime(timezone=True), nullable=True)  # completed_at + expiry_months
    cert_vault_file_id = Column(String(50), ForeignKey("vault_files.id", ondelete="SET NULL"), nullable=True)
    # ↑ Certificate stored in StaffVault
    score = Column(Float, nullable=True)    # Exam/assessment score if applicable
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    program = relationship("TrainingProgram", back_populates="enrollments")


# ============================================================
# ZONE SGPE — SOVEREIGN GLOBAL POLICY ENGINE
# Converts Government Policies → Executable Software Rules
# Supports: UAE Golden Visa, US 1031 Exchange, MACRS Depreciation,
#           Greece/Turkey/Cyprus CBI, LIHTC Subsidies,
#           Bangladesh JV Resort Share-Selling Model (BIDA/RJSC)
# ============================================================

class SGPEPolicy(Base):
    """
    Master Policy Config Store.
    Each row is a JSON rule file (uae_golden_visa, us_section_1031, bd_jv_resort, etc.)
    Admins can upload new policies without touching backend code.
    """
    __tablename__ = "sgpe_policies"
    __table_args__ = {"extend_existing": True}

    id             = Column(Integer, primary_key=True, index=True)
    policy_code    = Column(String(100), unique=True, nullable=False, index=True)
    # e.g. uae_golden_visa | us_section_1031 | bd_jv_luxury_resort | greece_golden_visa
    country_code   = Column(String(10), nullable=False, index=True)   # AE | US | BD | GR | TR | CY | GB
    policy_name    = Column(String(255), nullable=False)
    category       = Column(String(100), nullable=False)
    # FDI_IMMIGRATION | ESCROW | TAX_SHIELD | SUBSIDY | JV_SHARE_SELL
    description    = Column(Text, nullable=True)
    rule_config    = Column(JSON, nullable=False, default=dict)
    # Full JSON rule: triggers, thresholds, conditions, actions, document_checklist
    is_active      = Column(Boolean, default=True)
    effective_date = Column(DateTime(timezone=True), nullable=True)
    expiry_date    = Column(DateTime(timezone=True), nullable=True)
    created_by     = Column(String(100), default="CDO")
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())


class SGPEFDITracker(Base):
    """
    FDI & Immigration Engine — tracks cumulative investment per owner/passport.
    When the aggregated value crosses a policy threshold, auto-assembles the
    visa/citizenship document packet and marks the owner as ELIGIBLE.
    Supports: UAE 10-Year Golden Visa (AED 2M), Turkey Citizenship ($400K),
              Greece Residency (€250K), and Bangladesh BIDA FDI Registry.
    """
    __tablename__ = "sgpe_fdi_tracker"
    __table_args__ = {"extend_existing": True}

    id                    = Column(Integer, primary_key=True, index=True)
    owner_nid             = Column(String(100), nullable=False, index=True)  # Passport/NID
    owner_name            = Column(String(255), nullable=True)
    owner_nationality     = Column(String(100), nullable=True)
    policy_code           = Column(String(100), ForeignKey("sgpe_policies.policy_code", ondelete="SET NULL"), nullable=True)
    target_country        = Column(String(10), nullable=False)    # AE | GR | TR | BD
    threshold_currency    = Column(String(10), default="USD")
    threshold_amount      = Column(Float, nullable=False)         # e.g. 545000 (USD equiv of AED 2M)
    cumulative_invested   = Column(Float, default=0.0)            # Aggregated from linked AssetGrid rows
    linked_properties     = Column(JSON, default=list)            # [room_id, ...] contributing to total
    eligibility_status    = Column(String(50), default="TRACKING")
    # TRACKING | THRESHOLD_MET | DOCS_READY | SUBMITTED | APPROVED | REJECTED
    document_packet       = Column(JSON, default=dict)            # Auto-assembled checklist + doc URLs
    visa_type             = Column(String(100), nullable=True)    # Golden Visa | Citizenship | Residency
    notes                 = Column(Text, nullable=True)
    last_evaluated        = Column(DateTime(timezone=True), server_default=func.now())
    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), onupdate=func.now())


class SGPEEscrowVault(Base):
    """
    Trustee Escrow Vault — Dubai RERA model + Bangladesh PPP/BOT model.
    Off-plan deposits are ring-fenced here and released to developers ONLY
    when a linked SolveMission (construction milestone) is RESOLVED.
    Prevents developer misuse of buyer funds — Iron Law: No release without mission proof.
    """
    __tablename__ = "sgpe_escrow_vaults"
    __table_args__ = {"extend_existing": True}

    id                  = Column(Integer, primary_key=True, index=True)
    vault_ref           = Column(String(100), unique=True, nullable=False, index=True)
    # e.g. ESC-LTR01-M3
    property_id         = Column(String(100), ForeignKey("asset_grid.room_id", ondelete="SET NULL"), nullable=True)
    depositor_name      = Column(String(255), nullable=True)
    depositor_nid       = Column(String(100), nullable=True)
    escrow_bank         = Column(String(255), nullable=True)        # Actual bank holding funds
    deposit_amount      = Column(Float, nullable=False)
    currency            = Column(String(10), default="USD")
    milestone_label     = Column(String(255), nullable=False)       # "Foundation Complete" | "Structure 50%"
    linked_mission_id   = Column(Integer, ForeignKey("solve_missions.id", ondelete="SET NULL"), nullable=True)
    # Release is triggered automatically when this SolveMission status = RESOLVED
    release_amount      = Column(Float, nullable=True)              # Could be partial release
    release_percentage  = Column(Float, default=100.0)
    vault_status        = Column(String(50), default="LOCKED")
    # LOCKED | MILESTONE_CLEARED | PARTIAL_RELEASE | RELEASED | DISPUTED | REFUNDED
    locked_at           = Column(DateTime(timezone=True), server_default=func.now())
    released_at         = Column(DateTime(timezone=True), nullable=True)
    released_by         = Column(String(100), nullable=True)
    gl_release_entry_id = Column(Integer, nullable=True)            # Accounting GL reference
    policy_code         = Column(String(100), ForeignKey("sgpe_policies.policy_code", ondelete="SET NULL"), nullable=True)
    notes               = Column(Text, nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())


class SGPETaxRecord(Base):
    """
    Tax Shield Engine — US MACRS Cost Segregation + 1031 Exchange tracker.
    Cost Segregation: BOM lines → MACRS asset classes → bonus depreciation.
    1031 Exchange: Sold property → 45-day ID window → 180-day close window.
    Tax basis is adjusted when linked SolveMissions (capex) are resolved.
    """
    __tablename__ = "sgpe_tax_records"
    __table_args__ = {"extend_existing": True}

    id                     = Column(Integer, primary_key=True, index=True)
    record_type            = Column(String(50), nullable=False)
    # COST_SEGREGATION | EXCHANGE_1031 | BONUS_DEPRECIATION | DTAA_NETTING
    property_id            = Column(String(100), ForeignKey("asset_grid.room_id", ondelete="SET NULL"), nullable=True)
    owner_nid              = Column(String(100), nullable=True, index=True)
    policy_code            = Column(String(100), ForeignKey("sgpe_policies.policy_code", ondelete="SET NULL"), nullable=True)

    # Cost Segregation fields
    total_cost_basis       = Column(Float, default=0.0)             # Total acquisition + capex cost
    segregated_5yr         = Column(Float, default=0.0)             # Personal property (5yr MACRS)
    segregated_15yr        = Column(Float, default=0.0)             # Land improvements (15yr MACRS)
    segregated_39yr        = Column(Float, default=0.0)             # Structural components (39yr MACRS)
    bonus_depreciation_pct = Column(Float, default=100.0)           # 100% bonus in year 1 (2024 rules)
    year1_deduction        = Column(Float, default=0.0)             # Calculated year-1 write-off
    bom_lines_analyzed     = Column(JSON, default=list)             # [{product_id, amount, asset_class}]

    # 1031 Exchange fields
    sale_date              = Column(DateTime(timezone=True), nullable=True)
    sale_price             = Column(Float, nullable=True)
    realized_gain          = Column(Float, nullable=True)
    identification_deadline = Column(DateTime(timezone=True), nullable=True)  # +45 days from sale
    exchange_deadline      = Column(DateTime(timezone=True), nullable=True)   # +180 days from sale
    replacement_property_id = Column(String(100), nullable=True)
    exchange_status        = Column(String(50), default="PENDING")
    # PENDING | IDENTIFIED | CLOSED | FAILED | DEFERRED

    exchange_notes         = Column(Text, nullable=True)
    tax_year               = Column(Integer, nullable=True)
    jurisdiction           = Column(String(50), default="US")       # US | UK | AE | BD
    posted_by              = Column(String(100), default="SGPE-ENGINE")
    created_at             = Column(DateTime(timezone=True), server_default=func.now())
    updated_at             = Column(DateTime(timezone=True), onupdate=func.now())


class SGPESubsidyRecord(Base):
    """
    Sovereign Subsidy Engine — LIHTC + Green Energy Incentives.
    Detects affordable housing ratios & solar/green configurations.
    Calculates tradeable tax credits that developers can sell to banks/corporations.
    Also handles Bangladesh green tourism certification subsidies.
    """
    __tablename__ = "sgpe_subsidy_records"
    __table_args__ = {"extend_existing": True}

    id                    = Column(Integer, primary_key=True, index=True)
    subsidy_type          = Column(String(100), nullable=False)
    # LIHTC | GREEN_ENERGY | ECO_RESORT_BD | AFFORDABLE_HOUSING | SOLAR_CREDIT
    property_id           = Column(String(100), ForeignKey("asset_grid.room_id", ondelete="SET NULL"), nullable=True)
    policy_code           = Column(String(100), ForeignKey("sgpe_policies.policy_code", ondelete="SET NULL"), nullable=True)
    eligible_units        = Column(Integer, default=0)              # Units qualifying for subsidy
    affordable_pct        = Column(Float, default=0.0)              # % of units at ≤60% AMI
    green_output_kwh      = Column(Float, default=0.0)              # Annual solar/green output
    credit_amount         = Column(Float, default=0.0)              # Total tradeable credit value
    credit_rate           = Column(Float, default=0.09)             # 9% LIHTC or applicable rate
    annual_credit         = Column(Float, default=0.0)              # Per-year credit value
    credit_period_years   = Column(Integer, default=10)             # Standard 10-year LIHTC period
    total_credit_value    = Column(Float, default=0.0)              # annual_credit × period
    trade_status          = Column(String(50), default="AVAILABLE")
    # AVAILABLE | LISTED | SOLD | EXPIRED | CLAIMED
    buyer_entity          = Column(String(255), nullable=True)       # Corporation/bank that bought it
    sale_price            = Column(Float, nullable=True)             # Actual cash received
    certification_body    = Column(String(255), nullable=True)       # IRS | DOE | BD-DOE | LEED
    certification_ref     = Column(String(100), nullable=True)
    jurisdiction          = Column(String(50), default="US")
    notes                 = Column(Text, nullable=True)
    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), onupdate=func.now())


class SGPEJVShareRecord(Base):
    """
    Bangladesh JV Resort Share-Selling Engine.
    Tracks fractional ownership in SPV-structured luxury/eco resort projects.
    Models: Unit-Share System | Revenue Pool | BOT (Build-Operate-Transfer)
    Compliant with: Bangladesh Companies Act 1994, BIDA FDI Registry,
                    Bangladesh Bank repatriation rules, RJSC share transfer reporting.

    Share Types:
      - EQUITY_SHARE: Full ownership stake in the resort SPV
      - REVENUE_SHARE: Pool-based income right (no equity, pure yield)
      - MEMBERSHIP: Usage rights + revenue participation (hybrid)
      - BOT_UNIT: BOT project investor unit (government land, 25-99yr lease)
    """
    __tablename__ = "sgpe_jv_share_records"
    __table_args__ = {"extend_existing": True}

    id                    = Column(Integer, primary_key=True, index=True)
    share_ref             = Column(String(100), unique=True, nullable=False, index=True)
    # e.g. BD-ECO-COX-00142
    project_name          = Column(String(255), nullable=False)
    # e.g. "Cox's Bazar Eco Resort Phase 1" | "Sylhet Tea Garden Luxury Resort"
    property_id           = Column(String(100), ForeignKey("asset_grid.room_id", ondelete="SET NULL"), nullable=True)
    spv_name              = Column(String(255), nullable=True)      # SPV company name (RJSC registered)
    spv_rjsc_reg          = Column(String(100), nullable=True)      # RJSC registration number
    bida_reg_number       = Column(String(100), nullable=True)      # BIDA investment registration
    project_type          = Column(String(100), default="ECO_RESORT")
    # ECO_RESORT | LUXURY_RESORT | BOUTIQUE_HOTEL | BOT_COASTAL | PPP_TOURISM

    # Share Details
    share_type            = Column(String(50), default="REVENUE_SHARE")
    # EQUITY_SHARE | REVENUE_SHARE | MEMBERSHIP | BOT_UNIT
    investor_name         = Column(String(255), nullable=False)
    investor_nid_passport = Column(String(100), nullable=False, index=True)
    investor_nationality  = Column(String(100), nullable=True)      # BD | Foreign
    investor_bank         = Column(String(255), nullable=True)      # For BB repatriation tracking
    authorized_dealer     = Column(String(255), nullable=True)      # Bangladesh Bank AD bank name

    # Financial Terms
    total_project_shares  = Column(Integer, nullable=False)         # Total issued shares
    shares_held           = Column(Integer, nullable=False)         # This investor's shares
    share_face_value      = Column(Float, nullable=False)           # BDT per share
    investment_currency   = Column(String(10), default="BDT")      # BDT | USD | GBP | AED
    total_invested        = Column(Float, nullable=False)           # Total BDT invested
    usd_equivalent        = Column(Float, nullable=True)            # For BIDA FX reporting
    ownership_pct         = Column(Float, nullable=False)           # shares_held / total × 100

    # Revenue Pool Terms
    pool_revenue_ytd      = Column(Float, default=0.0)             # Total pool revenue this year
    investor_share_ytd    = Column(Float, default=0.0)             # This investor's cut YTD
    payout_frequency      = Column(String(50), default="QUARTERLY") # MONTHLY | QUARTERLY | ANNUAL
    last_payout_date      = Column(DateTime(timezone=True), nullable=True)
    last_payout_amount    = Column(Float, default=0.0)

    # Usage Benefits (Membership/Hybrid model)
    free_nights_annual    = Column(Integer, default=0)              # Complimentary nights/year
    discount_pct          = Column(Float, default=0.0)             # Member rate discount %

    # Transfer & Exit
    transfer_status       = Column(String(50), default="LOCKED")
    # LOCKED (3yr hold) | TRANSFERABLE | LISTED | TRANSFERRED | REPATRIATED
    lock_expiry_date      = Column(DateTime(timezone=True), nullable=True)  # 3yr BIDA lock period
    nav_valuation         = Column(Float, nullable=True)            # Latest NAV-based valuation
    nav_method            = Column(String(50), default="NET_ASSET_VALUE")  # Bangladesh Bank requirement
    bb_report_submitted   = Column(Boolean, default=False)          # Bangladesh Bank 14-day report
    bb_report_date        = Column(DateTime(timezone=True), nullable=True)

    # Regulatory & Documents
    share_certificate_url = Column(Text, nullable=True)             # Digital share certificate
    sub_kabla_reg_ref     = Column(String(100), nullable=True)      # Sub-Kabla/deed registration ref
    env_clearance_ref     = Column(String(100), nullable=True)      # Bangladesh DOE clearance
    policy_code           = Column(String(100), ForeignKey("sgpe_policies.policy_code", ondelete="SET NULL"), nullable=True)
    notes                 = Column(Text, nullable=True)
    registered_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), onupdate=func.now())


# ============================================================
# V68.0-AGI-ERP — SOVEREIGN DEVELOPMENT DIRECTIVE NEXT
# Phase 1: Forex Rates + Transaction Auth Limits
# Phase 2: Biometric Compliance + AGI Recruiting
# Phase 3: Cinema Streaming + B2B Rental Engine
# Phase 4: IP Quarantine Shields
# ============================================================

class SystemForexRate(Base):
    """
    Phase 1A — Daily Exchange Rate Sync Daemon.
    Persists fetched FX rates from Frankfurter API.
    POS, Billing, and SGPE read from this table for multicurrency conversions.
    Updated daily at 00:00 UTC by forex_sync worker.
    """
    __tablename__ = "system_forex_rates"
    __table_args__ = {"extend_existing": True}

    id              = Column(Integer, primary_key=True, index=True)
    base_currency   = Column(String(10), nullable=False, default="USD")
    target_currency = Column(String(10), nullable=False, index=True)
    # USD | EUR | GBP | AED | SGD | BDT | SAR | INR | JPY | CNY
    rate            = Column(Float, nullable=False)
    previous_rate   = Column(Float, nullable=True)        # Yesterday's rate for delta calc
    pct_change      = Column(Float, nullable=True)         # Daily % change
    source          = Column(String(100), default="Frankfurter API")
    fetched_at      = Column(DateTime(timezone=True), server_default=func.now())
    is_current      = Column(Boolean, default=True)        # Only latest rate is current=True


class PendingAuthorization(Base):
    """
    Phase 1B — Authentication-Bounded Ledger Gateway.
    When a transaction exceeds a staff role's limit, it is halted and
    written here. Funds are released only upon cryptographic GM/CDO approval.
    Role limits: FRONT_DESK=$10K | MANAGER=$50K | GM=$250K | CDO=unlimited
    """
    __tablename__ = "pending_authorizations"
    __table_args__ = {"extend_existing": True}

    id                   = Column(Integer, primary_key=True, index=True)
    ref_token            = Column(String(100), unique=True, nullable=False, index=True)
    transaction_payload  = Column(JSON, nullable=False)    # Full original POST body
    endpoint             = Column(String(255), nullable=True)
    amount               = Column(Float, nullable=False)
    currency             = Column(String(10), default="USD")
    submitted_by         = Column(String(100), nullable=False)
    submitted_role       = Column(String(50), nullable=False)
    role_limit           = Column(Float, nullable=False)   # Limit that was exceeded
    required_approver    = Column(String(50), default="GM")  # Role required to approve
    status               = Column(String(50), default="PENDING", index=True)
    # PENDING | APPROVED | REJECTED | EXPIRED
    rejection_reason     = Column(Text, nullable=True)
    resolved_by          = Column(String(100), nullable=True)
    resolved_at          = Column(DateTime(timezone=True), nullable=True)
    expires_at           = Column(DateTime(timezone=True), nullable=True)  # Auto-expire 24h
    created_at           = Column(DateTime(timezone=True), server_default=func.now())


class BiometricAttendance(Base):
    """
    Phase 2A — Biometric Shift Compliance.
    Tracks employee clock-in/out via biometric device or manual entry.
    Biometric Supervisor scans this every 10 minutes — auto signs out
    any shift exceeding 12 continuous hours and logs a compliance violation.
    """
    __tablename__ = "biometric_attendance"
    __table_args__ = {"extend_existing": True}

    id                = Column(Integer, primary_key=True, index=True)
    employee_id       = Column(String(50), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    shift_date        = Column(DateTime(timezone=True), nullable=False, index=True)
    sign_in_time      = Column(DateTime(timezone=True), nullable=False)
    sign_out_time     = Column(DateTime(timezone=True), nullable=True)
    continuous_hours  = Column(Float, nullable=True)        # Computed on sign-out / supervisor scan
    device_id         = Column(String(100), nullable=True)  # Biometric device serial
    sign_in_method    = Column(String(50), default="MANUAL")
    # FINGERPRINT | FACE_ID | CARD | MANUAL | AUTO_SIGNIN
    auto_signout      = Column(Boolean, default=False)       # True = supervisor forced sign-out
    auto_signout_at   = Column(DateTime(timezone=True), nullable=True)
    is_active_shift   = Column(Boolean, default=True, index=True)  # False = shift ended
    location          = Column(String(100), nullable=True)   # Department / zone
    notes             = Column(Text, nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())


class EmployeeComplianceLog(Base):
    """
    Phase 2A — Compliance violation log.
    Written when biometric supervisor triggers an auto sign-out,
    when overtime thresholds are breached, or disciplinary events occur.
    """
    __tablename__ = "employee_compliance_logs"
    __table_args__ = {"extend_existing": True}

    id              = Column(Integer, primary_key=True, index=True)
    employee_id     = Column(String(50), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    violation_type  = Column(String(100), nullable=False)
    # OVERTIME_12H | MISSED_SIGNOUT | UNAUTHORIZED_ACCESS | ATTENDANCE_FRAUD | MANUAL
    description     = Column(Text, nullable=False)
    shift_hours     = Column(Float, nullable=True)           # Hours at time of violation
    attendance_id   = Column(Integer, ForeignKey("biometric_attendance.id", ondelete="SET NULL"), nullable=True)
    severity        = Column(String(50), default="WARNING")  # WARNING | CRITICAL | INFO
    notified_hr     = Column(Boolean, default=False)
    notified_at     = Column(DateTime(timezone=True), nullable=True)
    acknowledged    = Column(Boolean, default=False)
    acknowledged_by = Column(String(100), nullable=True)
    logged_by       = Column(String(100), default="BIOMETRIC_SUPERVISOR")
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class QuarantinedIP(Base):
    """
    Phase 4A — Foreign Attitude Auto-Lock.
    When an IP triggers anomalous burst patterns (>100 req/60s with 4xx errors),
    it is written here and blocked at middleware level.
    SystemConfig.system_locked is set to 1 and Z-07 alert is broadcast.
    """
    __tablename__ = "quarantined_ips"
    __table_args__ = {"extend_existing": True}

    id              = Column(Integer, primary_key=True, index=True)
    ip_address      = Column(String(50), nullable=False, index=True)
    reason          = Column(String(255), nullable=False)
    anomaly_type    = Column(String(100), nullable=True)
    # BURST_RATE | INVALID_TOKEN | MISSING_HEADERS | 4XX_STORM | MANUAL_LOCK
    request_count   = Column(Integer, default=0)
    error_count     = Column(Integer, default=0)
    quarantined_at  = Column(DateTime(timezone=True), server_default=func.now())
    expires_at      = Column(DateTime(timezone=True), nullable=True)  # Auto-release after 1hr
    auto_released   = Column(Boolean, default=False)
    released_at     = Column(DateTime(timezone=True), nullable=True)
    released_by     = Column(String(100), nullable=True)
    is_active       = Column(Boolean, default=True, index=True)


# ============================================================
# Z-PROP: MIRACLE PROPERTIES MARKETPLACE
# Buy · Sell · Lease · Rent — B2B Property Portal
# Links to PMS via pms_property_id.
# Enquiries → CRM leads automatically.
# ============================================================

class SGPERegionPolicy(Base):
    """
    Sovereign real estate policies for the Dynamic Policy Engine.
    Administrators can edit rates and rules dynamically from the PMS Control Panel.
    """
    __tablename__ = "sgpe_region_policies"
    __table_args__ = {"extend_existing": True}

    id                  = Column(Integer, primary_key=True, index=True)
    region_code         = Column(String(10), unique=True, index=True, nullable=False) # e.g. BD, UAE, US, UK, SG, MV, SA, _
    cap_rate            = Column(Float, default=0.07)               # JV cap rate
    lease_yield         = Column(Float, default=0.065)              # Fixed Lease yield
    sign_bonus_pct      = Column(Float, default=0.04)               # Lease signing bonus %
    mgmt_fee            = Column(Float, default=20.0)               # Management fee %
    land_discount       = Column(Float, default=0.25)               # Pure land discount
    road_premium        = Column(Float, default=0.06)               # Premium for road access
    roi_divisor         = Column(Float, default=12.0)               # payback months divisor
    lease_term_years    = Column(Integer, default=10)               # Fixed lease contract years
    currency_note       = Column(String(50), default="USD")         # e.g. BDT / USD
    vat_tax_pct         = Column(Float, default=0.0)                # VAT Tax policy %
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BackgroundJob(Base):
    """Asynchronous/durable background tasks queue table."""
    __tablename__ = "background_jobs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    job_type = Column(String(100), nullable=False, index=True) # e.g. "checkout_disbursement", "checkout_synapse_directives"
    payload = Column(JSON, nullable=False) # JSON payload parameters
    status = Column(String(50), default="PENDING", index=True) # PENDING, PROCESSING, COMPLETED, FAILED
    error_log = Column(Text, nullable=True) # stack traces of failures
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)


# ==========================================
# CLINICAL HEALTHCARE VAULT (HMS ADVANCED)
# ==========================================
class PatientVitals(Base):
    """Vitals logs taken by nurses during triage"""
    __tablename__ = "patient_vitals"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), ForeignKey("guest_crm.id", ondelete="CASCADE"), index=True)
    heart_rate = Column(Integer, nullable=True)        # bpm
    blood_pressure = Column(String(50), nullable=True) # e.g. "120/80"
    temperature = Column(Float, nullable=True)         # °C
    spo2 = Column(Integer, nullable=True)              # Oxygen saturation %
    weight_kg = Column(Float, nullable=True)
    taken_at = Column(DateTime(timezone=True), server_default=func.now())

class PatientConsultation(Base):
    """Doctor consultation notes (SOAP standard)"""
    __tablename__ = "patient_consultations"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), ForeignKey("guest_crm.id", ondelete="CASCADE"), index=True)
    doctor_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    
    # SOAP Format
    symptoms = Column(Text, nullable=True)             # Subjective (S)
    examination = Column(Text, nullable=True)          # Objective (O)
    diagnosis_icd10 = Column(String(100), nullable=True) # Assessment (A)
    treatment_plan = Column(Text, nullable=True)       # Plan (P)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Prescription(Base):
    """Clinical drug prescriptions linked to consultations and inventory"""
    __tablename__ = "prescriptions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("patient_consultations.id", ondelete="CASCADE"), index=True)
    product_id = Column(String(100), ForeignKey("inventory.product_id", ondelete="SET NULL"), nullable=True)
    
    dosage = Column(String(100), nullable=False)        # e.g., "500mg" or "1 tablet"
    frequency = Column(String(100), nullable=False)     # e.g., "Once daily (OD)" or "TID"
    duration_days = Column(Integer, default=7)
    dispense_status = Column(String(50), default="PENDING") # PENDING, DISPENSED
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LabOrder(Base):
    """Diagnostic requests for LIS integration"""
    __tablename__ = "lab_orders"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), ForeignKey("guest_crm.id", ondelete="CASCADE"), index=True)
    test_name = Column(String(255), nullable=False)     # e.g., "Complete Blood Count"
    status = Column(String(50), default="ORDERED")      # ORDERED, SAMPLE_COLLECTED, REPORTED
    result_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InsuranceClaim(Base):
    """Insurance Third Party Administrator claims ledger"""
    __tablename__ = "insurance_claims"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    folio_id = Column(Integer, ForeignKey("guest_folios.id", ondelete="CASCADE"), index=True)
    patient_id = Column(String(50), ForeignKey("guest_crm.id", ondelete="CASCADE"), index=True)
    provider_name = Column(String(100), nullable=False)
    policy_number = Column(String(100), nullable=False)
    total_invoice = Column(Float, nullable=False)
    patient_co_pay = Column(Float, nullable=False) # Cash paid by patient
    insurance_claim_amount = Column(Float, nullable=False) # Invoiced to insurer
    status = Column(String(50), default="PENDING") # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OPDAppointment(Base):
    """Outpatient consultations slots bookings"""
    __tablename__ = "opd_appointments"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), ForeignKey("guest_crm.id", ondelete="CASCADE"), index=True)
    doctor_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    appointment_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), default="SCHEDULED") # SCHEDULED, COMPLETED, CANCELLED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ==========================================
# ZONE RERS: REAL-TIME EMERGENCY RESPONSE SYSTEM
# ==========================================
class EmergencyAlert(Base):
    """Wristband-triggered emergency alerts with full SLA response tracking."""
    __tablename__ = "emergency_alerts"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(100), nullable=False, index=True)  # GuestCRM id or name
    patient_name = Column(String(255), nullable=False)
    bed_number = Column(String(50), nullable=False)

    # Vitals at time of alert
    alert_type = Column(String(50), nullable=False)  # CARDIAC, HYPOXIA, HYPOTENSION, FEVER, TACHYCARDIA
    heart_rate = Column(Integer, nullable=True)
    blood_pressure = Column(String(20), nullable=True)
    spo2 = Column(Integer, nullable=True)
    temperature = Column(Float, nullable=True)

    # Alert lifecycle timestamps (all nullable — filled as events progress)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    doctor_notified_at = Column(DateTime(timezone=True), nullable=True)
    ambulance_dispatched_at = Column(DateTime(timezone=True), nullable=True)
    service_arrived_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # SLA compliance flags
    doctor_response_seconds = Column(Integer, nullable=True)   # seconds from trigger to doctor ack
    ambulance_response_seconds = Column(Integer, nullable=True) # seconds from trigger to dispatch
    total_response_seconds = Column(Integer, nullable=True)     # seconds from trigger to arrival

    # Status: ACTIVE | DOCTOR_NOTIFIED | AMBULANCE_DISPATCHED | ARRIVED | RESOLVED
    status = Column(String(50), default="ACTIVE", nullable=False)

    # Notes from responding doctor
    doctor_id = Column(String(100), nullable=True)
    doctor_notes = Column(Text, nullable=True)

    severity = Column(String(20), default="CRITICAL")  # CRITICAL | HIGH | MEDIUM
    device_id = Column(String(100), nullable=True)  # Wristband device identifier


class WristbandDevice(Base):
    """IoT Wristband device registry linked to patient beds."""
    __tablename__ = "wristband_devices"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), unique=True, nullable=False, index=True)
    patient_id = Column(String(100), nullable=True)
    patient_name = Column(String(255), nullable=True)
    bed_number = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    battery_level = Column(Integer, default=100)  # percentage
    last_ping = Column(DateTime(timezone=True), nullable=True)
    registered_at = Column(DateTime(timezone=True), server_default=func.now())

    # Alert thresholds (can be customized per patient)
    threshold_hr_min = Column(Integer, default=50)
    threshold_hr_max = Column(Integer, default=130)
    threshold_spo2_min = Column(Integer, default=92)
    threshold_temp_max = Column(Float, default=39.5)
    threshold_temp_min = Column(Float, default=35.0)


# ==========================================
# ENTERPRISE SUPPLY CHAIN & MULTI-VAULT SYSTEM
# ==========================================

class InventoryNode(Base):
    """Echelon Nodes: Central Distribution, Receiving Docks, Core Vaults, and Satellites"""
    __tablename__ = "inventory_nodes"
    __table_args__ = {'extend_existing': True}

    id = Column(String(64), primary_key=True, index=True)
    parent_node_id = Column(String(64), ForeignKey("inventory_nodes.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    type = Column(String(64), nullable=False) # CDC, LOADING_DOCK, CENTRAL_VAULT, SATELLITE_WARD
    facility_code = Column(String(64), nullable=False)
    active = Column(Integer, default=1)


class PurchaseOrder(Base):
    """Vendor Purchase Orders for Apex Procurement Echelon"""
    __tablename__ = "purchase_orders"
    __table_args__ = {'extend_existing': True}

    id = Column(String(64), primary_key=True, index=True)
    po_number = Column(String(100), unique=True, nullable=False, index=True)
    vendor_id = Column(String(64), nullable=False)
    ordered_at = Column(String(64), nullable=False)
    delivery_node_id = Column(String(64), ForeignKey("inventory_nodes.id"), nullable=True)
    total_amount = Column(Float, nullable=False)
    status = Column(String(64), default="PENDING") # PENDING, DISPATCHED, COMPLETED, CANCELLED


class ThreeWayMatch(Base):
    """Verification ledger for PO vs Receiving vs Invoice"""
    __tablename__ = "three_way_matches"
    __table_args__ = {'extend_existing': True}

    id = Column(String(64), primary_key=True, index=True)
    po_id = Column(String(64), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=True)
    vendor_invoice_ref = Column(String(128), nullable=True)
    receiving_dock_log_id = Column(String(64), nullable=True)
    matching_amount = Column(Float, nullable=False)
    is_matched = Column(Integer, default=0)
    matched_at = Column(String(64), nullable=True)
    auditor_operator_id = Column(String(64), nullable=True)


class VaultStockAllocation(Base):
    """Batch-level stock allocations within physical inventory nodes"""
    __tablename__ = "vault_stock_allocation"
    __table_args__ = {'extend_existing': True}

    id = Column(String(64), primary_key=True, index=True)
    vault_id = Column(String(64), ForeignKey("inventory_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(100), ForeignKey("inventory.product_id", ondelete="CASCADE"), nullable=False, index=True)
    batch_number = Column(String(128), nullable=False, index=True)
    expiry_date = Column(String(64), nullable=True)
    quantity = Column(Float, default=0.0)
    blocked_qty = Column(Float, default=0.0)
    last_audited_at = Column(String(64), nullable=True)


class StockTransfer(Base):
    """Audit Trail for Echelon inventory movements"""
    __tablename__ = "stock_transfers"
    __table_args__ = {'extend_existing': True}

    id = Column(String(64), primary_key=True, index=True)
    source_node_id = Column(String(64), ForeignKey("inventory_nodes.id"), nullable=True)
    dest_node_id = Column(String(64), ForeignKey("inventory_nodes.id"), nullable=True)
    product_id = Column(String(100), ForeignKey("inventory.product_id", ondelete="CASCADE"), nullable=False)
    batch_number = Column(String(128), nullable=False)
    qty_transferred = Column(Float, nullable=False)
    transferred_at = Column(String(64), nullable=False)
    operator_id = Column(String(64), nullable=False)
    status = Column(String(64), default="TRANSIT") # TRANSIT, RECEIVED, REJECTED


class DoctorRoster(Base):
    """Weekly schedule rosters for doctors with daily slot caps"""
    __tablename__ = "doctor_rosters"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(String(50), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    department_code = Column(String(50), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False) # 0 = Monday, 6 = Sunday
    start_time = Column(String(10), default="09:00")
    end_time = Column(String(10), default="14:00")
    max_patients = Column(Integer, default=20)
    is_active = Column(Boolean, default=True)


class WalkInTicket(Base):
    """Real-time serial tickets for walk-in OPD patients"""
    __tablename__ = "walk_in_tickets"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    ticket_serial = Column(String(50), nullable=False, unique=True, index=True)
    patient_name = Column(String(255), nullable=False)
    department_code = Column(String(50), nullable=False)
    assigned_doctor_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    scheduled_time = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="ACTIVE") # ACTIVE, CALLED, COMPLETED
    created_at = Column(DateTime(timezone=True), server_default=func.now())


