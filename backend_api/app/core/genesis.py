# backend_api/app/core/genesis.py
import logging
from sqlalchemy import select, text
from sqlalchemy.orm import Session

# KERNEL IMPORTS: Aligned with the Master Blueprint
from app.core.database import engine, Base, SessionLocal
from app.models.models import *
from app.core.kernel_intelligence_sync import sync_kernel_knowledge
from pathlib import Path

# ENTERPRISE TELEMETRY
logger = logging.getLogger("MASTER-GENESIS")

def run_genesis_sequence():
    """
    THE MASTER GENESIS SEQUENCE:
    1. Infrastructure Reflection (Table Creation)
    2. PHYSICAL SURGERY (Force Column Injection)
    3. Fiscal Injection (Ledger Initialization)
    4. Human Capital Baseline (Admin Seeding)
    """
    logger.info("🛡️ KERNEL: INITIATING MASTER GENESIS SEQUENCE...")

    # PHASE 1: PHYSICAL INFRASTRUCTURE
    try:
        logger.info("Step 1: Reflecting Blueprints and building Physical Vaults...")
        # Create missing tables
        Base.metadata.create_all(bind=engine)
        
        # 🛡️ CDO ROOT FIX: Execute Physical Surgery on existing tables
        # This fixes the psycopg2.errors.UndefinedColumn errors from your logs
        perform_database_surgery()
        
        logger.info("✅ Physical Vaults Verified and Surgically Patched.")
    except Exception as e:
        logger.critical(f"🚨 BLUEPRINT REFLECTION FAILED: {e}")
        return

    # PHASE 2: DATA INJECTION (SEEDING)
    db = SessionLocal()
    try:
        logger.info("Step 2: Auditing Master Ledger Integrity...")
        seed_fiscal_ledger(db)
        
        logger.info("Step 3: Verifying Administrative Credentials...")
        seed_admin_baseline(db)
        
        logger.info("Step 4: Seeding Physical Asset Grid (30 Rooms)...")
        seed_asset_grid(db)
        
        logger.info("Step 5: Seeding Corporate Matrix Grid...")
        seed_corporate_matrix(db)
        
        logger.info("Step 6: V12.0 Panel Intelligence Sync (Self-Learning AI)...")
        kernel_path = Path(__file__).parent.parent / "routers" / "miracle_kernel.json"
        sync_kernel_knowledge(db, kernel_path)
        
        db.commit()
        logger.info("👑 GENESIS COMPLETE: MASTER OS IS OPERATIONAL.")
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 GENESIS DATA INJECTION FAILED: {e}")
    finally:
        db.close()

def perform_database_surgery():
    """🛡️ CDO EXCLUSIVE: Forces missing columns into existence via Raw SQL."""
    surgery_points = [
        # Fix Solve Missions Column
        ("solve_missions", "assigned_to", "ALTER TABLE solve_missions ADD COLUMN assigned_to VARCHAR(255);"),
        # Fix Accounting Ledger Column
        ("accounting_ledger", "type", "ALTER TABLE accounting_ledger ADD COLUMN type VARCHAR(100);"),
        # Fix Room Number alias
        ("solve_missions", "room_no", "ALTER TABLE solve_missions ADD COLUMN room_no VARCHAR(50);"),
        # 💉 GUEST FOLIO UPGRADE: Financial Matrix
        ("guest_folios", "rate", "ALTER TABLE guest_folios ADD COLUMN rate DOUBLE PRECISION DEFAULT 0.0;"),
        ("guest_folios", "advance_paid", "ALTER TABLE guest_folios ADD COLUMN advance_paid DOUBLE PRECISION DEFAULT 0.0;"),
        ("guest_folios", "payment_network", "ALTER TABLE guest_folios ADD COLUMN payment_network VARCHAR(50) DEFAULT 'CASH';"),
        ("guest_folios", "ref_staff", "ALTER TABLE guest_folios ADD COLUMN ref_staff VARCHAR(100) DEFAULT 'NONE';"),
        # 💉 POS TRANSACTION UPGRADE: Audit Matrix
        ("pos_transactions", "terminal_id", "ALTER TABLE pos_transactions ADD COLUMN terminal_id VARCHAR(100);"),
        ("pos_transactions", "cashier_pin", "ALTER TABLE pos_transactions ADD COLUMN cashier_pin VARCHAR(20);"),
        ("pos_transactions", "guest_type", "ALTER TABLE pos_transactions ADD COLUMN guest_type VARCHAR(50);"),
        ("pos_transactions", "guest_ref", "ALTER TABLE pos_transactions ADD COLUMN guest_ref VARCHAR(100);"),
        ("pos_transactions", "payment_method", "ALTER TABLE pos_transactions ADD COLUMN payment_method VARCHAR(50);"),
        ("pos_transactions", "subtotal", "ALTER TABLE pos_transactions ADD COLUMN subtotal DOUBLE PRECISION DEFAULT 0.0;"),
        ("pos_transactions", "total_cogs", "ALTER TABLE pos_transactions ADD COLUMN total_cogs DOUBLE PRECISION DEFAULT 0.0;"),
        ("pos_transactions", "discount", "ALTER TABLE pos_transactions ADD COLUMN discount DOUBLE PRECISION DEFAULT 0.0;"),
        ("pos_transactions", "vat", "ALTER TABLE pos_transactions ADD COLUMN vat DOUBLE PRECISION DEFAULT 0.0;"),
        ("pos_transactions", "sc", "ALTER TABLE pos_transactions ADD COLUMN sc DOUBLE PRECISION DEFAULT 0.0;"),
        ("pos_transactions", "true_profit", "ALTER TABLE pos_transactions ADD COLUMN true_profit DOUBLE PRECISION DEFAULT 0.0;"),
        # 🧪 POS ORDER ITEM UPGRADE
        ("pos_order_items", "name", "ALTER TABLE pos_order_items ADD COLUMN name VARCHAR(255);"),
        ("pos_order_items", "type", "ALTER TABLE pos_order_items ADD COLUMN type VARCHAR(50);"),
        ("pos_order_items", "cogs", "ALTER TABLE pos_order_items ADD COLUMN cogs DOUBLE PRECISION DEFAULT 0.0;"),
        ("pos_order_items", "is_foc", "ALTER TABLE pos_order_items ADD COLUMN is_foc BOOLEAN DEFAULT FALSE;"),
        # 🛡️ GUEST CRM: Social Auth & Loyalty
        ("guest_crm", "social_id", "ALTER TABLE guest_crm ADD COLUMN social_id VARCHAR(255) UNIQUE;"),
        ("guest_crm", "social_provider", "ALTER TABLE guest_crm ADD COLUMN social_provider VARCHAR(50);"),
        ("guest_crm", "coins", "ALTER TABLE guest_crm ADD COLUMN coins DOUBLE PRECISION DEFAULT 0.0;"),
        ("guest_crm", "password_hash", "ALTER TABLE guest_crm ADD COLUMN password_hash VARCHAR(255);"),
        # 🛡️ GUEST OFFERS: Broadcast & Deep Linking
        ("guest_offers", "is_broadcast", "ALTER TABLE guest_offers ADD COLUMN is_broadcast BOOLEAN DEFAULT FALSE;"),
        ("guest_offers", "action_url", "ALTER TABLE guest_offers ADD COLUMN action_url TEXT;"),
        # 🔱 SYSTEM SETTINGS: Dynamic Branding
        ("system_settings", "hotel_name", "ALTER TABLE system_settings ADD COLUMN hotel_name VARCHAR(255) DEFAULT 'Miracle General Hospital & Diagnosis Center';"),
        # 🔱 SYNAPSE UPGRADES: Employee Matrix V2 & Efficiency Engine
        ("employees", "gender", "ALTER TABLE employees ADD COLUMN gender VARCHAR(20) DEFAULT 'UNSPECIFIED';"),
        ("employees", "is_online", "ALTER TABLE employees ADD COLUMN is_online BOOLEAN DEFAULT FALSE;"),
        ("employees", "last_seen", "ALTER TABLE employees ADD COLUMN last_seen DATETIME NULL;"),
        ("employees", "department_alignments", "ALTER TABLE employees ADD COLUMN department_alignments JSON NULL;"),
        ("employees", "executive_tier", "ALTER TABLE employees ADD COLUMN executive_tier VARCHAR(50) DEFAULT 'OPERATIVE';"),
        ("employees", "industry_verticals", "ALTER TABLE employees ADD COLUMN industry_verticals JSON NULL;"),
        ("employees", "base_salary", "ALTER TABLE employees ADD COLUMN base_salary FLOAT DEFAULT 0.0;"),
        ("employees", "commission_rate", "ALTER TABLE employees ADD COLUMN commission_rate FLOAT DEFAULT 0.0;"),
        ("employees", "revenue_impact", "ALTER TABLE employees ADD COLUMN revenue_impact FLOAT DEFAULT 0.0;"),
        ("employees", "monthly_hours", "ALTER TABLE employees ADD COLUMN monthly_hours FLOAT DEFAULT 0.0;"),
        ("employees", "missions_secured", "ALTER TABLE employees ADD COLUMN missions_secured INT DEFAULT 0;"),
        ("employees", "efficiency_rating", "ALTER TABLE employees ADD COLUMN efficiency_rating FLOAT DEFAULT 100.0;"),
        ("employees", "avg_response_minutes", "ALTER TABLE employees ADD COLUMN avg_response_minutes FLOAT NULL;"),
        ("employees", "performance_stars", "ALTER TABLE employees ADD COLUMN performance_stars INT NULL;"),
        ("employees", "tasks_completed", "ALTER TABLE employees ADD COLUMN tasks_completed INT DEFAULT 0;"),
        # 🔱 SYNAPSE UPGRADES: Strategic Directives & Nodes
        ("strategic_directives", "picked_at", "ALTER TABLE strategic_directives ADD COLUMN picked_at DATETIME NULL;"),
        ("strategic_directives", "reviewed_at", "ALTER TABLE strategic_directives ADD COLUMN reviewed_at DATETIME NULL;"),
        ("strategic_directives", "requires_verification", "ALTER TABLE strategic_directives ADD COLUMN requires_verification BOOLEAN DEFAULT FALSE;"),
        ("strategic_directives", "verification_status", "ALTER TABLE strategic_directives ADD COLUMN verification_status VARCHAR(50) NULL;"),
        ("strategic_directives", "verification_evidence", "ALTER TABLE strategic_directives ADD COLUMN verification_evidence TEXT NULL;"),
        ("strategic_directives", "verifier_notes", "ALTER TABLE strategic_directives ADD COLUMN verifier_notes TEXT NULL;"),
        ("directive_nodes", "is_completed", "ALTER TABLE directive_nodes ADD COLUMN is_completed BOOLEAN DEFAULT FALSE;"),
        ("directive_nodes", "completed_at", "ALTER TABLE directive_nodes ADD COLUMN completed_at DATETIME NULL;"),
        ("directive_nodes", "target_dept", "ALTER TABLE directive_nodes ADD COLUMN target_dept VARCHAR(50) NULL;"),
        # 🔱 SYNAPSE UPGRADES: Vault Files Association
        ("vault_files", "uploaded_by", "ALTER TABLE vault_files ADD COLUMN uploaded_by VARCHAR(100) NULL;"),
        ("vault_files", "associated_directive_id", "ALTER TABLE vault_files ADD COLUMN associated_directive_id INT NULL;"),
        ("vault_files", "associated_node_id", "ALTER TABLE vault_files ADD COLUMN associated_node_id INT NULL;"),
        # ENTERPRISE AUDIT V2 - Zone-Aware POS Accounting (2026-05-26)
        ("pos_transactions", "grand_total", "ALTER TABLE pos_transactions ADD COLUMN grand_total DOUBLE PRECISION DEFAULT 0.0;"),
        ("pos_transactions", "zone_gl_code", "ALTER TABLE pos_transactions ADD COLUMN zone_gl_code INT DEFAULT 410000;"),
        ("folio_charges", "category", "ALTER TABLE folio_charges ADD COLUMN category VARCHAR(100) DEFAULT 'POS';"),
        # ZONE 30: PMS Ownership Taxonomy on AssetGrid (2026-06-03)
        ("asset_grid", "ownership_type", "ALTER TABLE asset_grid ADD COLUMN ownership_type VARCHAR(20) DEFAULT 'OWNED';"),
        ("asset_grid", "commission_rate", "ALTER TABLE asset_grid ADD COLUMN commission_rate DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "rent_payable", "ALTER TABLE asset_grid ADD COLUMN rent_payable DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "fixed_asset_id", "ALTER TABLE asset_grid ADD COLUMN fixed_asset_id INT NULL REFERENCES fixed_assets(id) ON DELETE SET NULL;"),
        ("asset_grid", "capitalized_setup_cost", "ALTER TABLE asset_grid ADD COLUMN capitalized_setup_cost DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "owner_entity", "ALTER TABLE asset_grid ADD COLUMN owner_entity VARCHAR(255) NULL;"),
        ("asset_grid", "lease_start", "ALTER TABLE asset_grid ADD COLUMN lease_start TIMESTAMPTZ NULL;"),
        ("asset_grid", "lease_end", "ALTER TABLE asset_grid ADD COLUMN lease_end TIMESTAMPTZ NULL;"),
        ("asset_grid", "owner_nid", "ALTER TABLE asset_grid ADD COLUMN owner_nid VARCHAR(100) NULL;"),
        # 💉 LEDGER LINE UPGRADE: Tag fixed assets
        ("ledger_lines", "fixed_asset_id", "ALTER TABLE ledger_lines ADD COLUMN fixed_asset_id INT NULL REFERENCES fixed_assets(id) ON DELETE SET NULL;"),
        # 💉 PHARMACY MATRICES: Shelving, Active Ingredient, Dosage Form
        ("inventory", "shelf_location", "ALTER TABLE inventory ADD COLUMN shelf_location VARCHAR(100) NULL;"),
        ("inventory", "active_ingredient", "ALTER TABLE inventory ADD COLUMN active_ingredient VARCHAR(255) NULL;"),
        ("inventory", "dosage_form", "ALTER TABLE inventory ADD COLUMN dosage_form VARCHAR(100) NULL;"),
        # ============================================================
        # ZONE 30 PHASE 1: Co-Owner & Mortgage Upgrade on AssetGrid
        # ============================================================
        ("asset_grid", "owner_type", "ALTER TABLE asset_grid ADD COLUMN owner_type VARCHAR(30) DEFAULT 'FULL_OWNER';"),
        ("asset_grid", "pool_category", "ALTER TABLE asset_grid ADD COLUMN pool_category VARCHAR(100) NULL;"),
        ("asset_grid", "currency_code", "ALTER TABLE asset_grid ADD COLUMN currency_code VARCHAR(10) DEFAULT 'USD';"),
        ("asset_grid", "mortgage_total", "ALTER TABLE asset_grid ADD COLUMN mortgage_total DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "mortgage_monthly_payment", "ALTER TABLE asset_grid ADD COLUMN mortgage_monthly_payment DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "mortgage_paid_to_date", "ALTER TABLE asset_grid ADD COLUMN mortgage_paid_to_date DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "mortgage_interest_rate", "ALTER TABLE asset_grid ADD COLUMN mortgage_interest_rate DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "mortgage_due_day", "ALTER TABLE asset_grid ADD COLUMN mortgage_due_day INT DEFAULT 5;"),
        ("asset_grid", "mortgage_balance", "ALTER TABLE asset_grid ADD COLUMN mortgage_balance DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "lease_fixed_rent", "ALTER TABLE asset_grid ADD COLUMN lease_fixed_rent DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "linked_employee_id", "ALTER TABLE asset_grid ADD COLUMN linked_employee_id VARCHAR(50) NULL REFERENCES employees(id) ON DELETE SET NULL;"),
        ("asset_grid", "ytd_gross_yield", "ALTER TABLE asset_grid ADD COLUMN ytd_gross_yield DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "ytd_net_yield", "ALTER TABLE asset_grid ADD COLUMN ytd_net_yield DOUBLE PRECISION DEFAULT 0.0;"),
        ("asset_grid", "management_fee_pct", "ALTER TABLE asset_grid ADD COLUMN management_fee_pct DOUBLE PRECISION DEFAULT 20.0;"),
        ("asset_grid", "nights_occupied_ytd", "ALTER TABLE asset_grid ADD COLUMN nights_occupied_ytd INT DEFAULT 0;"),
        ("asset_grid", "last_override_by", "ALTER TABLE asset_grid ADD COLUMN last_override_by VARCHAR(100) NULL;"),
        ("asset_grid", "last_override_reason", "ALTER TABLE asset_grid ADD COLUMN last_override_reason TEXT NULL;"),
        ("asset_grid", "last_override_at", "ALTER TABLE asset_grid ADD COLUMN last_override_at TIMESTAMPTZ NULL;"),
        # ============================================================
        # ZONE 30 PHASE 1: PMSOwnerLedger Table Creation
        # ============================================================
        ("pms_owner_ledger", "id", """
            CREATE TABLE IF NOT EXISTS pms_owner_ledger (
                id SERIAL PRIMARY KEY,
                room_id VARCHAR(50) NOT NULL REFERENCES asset_grid(room_id) ON DELETE CASCADE,
                event_type VARCHAR(50) NOT NULL,
                amount DOUBLE PRECISION NOT NULL,
                net_amount DOUBLE PRECISION NOT NULL,
                currency_code VARCHAR(10) DEFAULT 'USD',
                exchange_rate DOUBLE PRECISION DEFAULT 1.0,
                running_balance DOUBLE PRECISION DEFAULT 0.0,
                mortgage_balance_after DOUBLE PRECISION NULL,
                journal_entry_id INT NULL REFERENCES journal_entries(id) ON DELETE SET NULL,
                idempotency_key VARCHAR(150) UNIQUE NOT NULL,
                linked_employee_id VARCHAR(50) NULL REFERENCES employees(id) ON DELETE SET NULL,
                is_manual_override BOOLEAN DEFAULT FALSE,
                override_by VARCHAR(100) NULL,
                override_reason TEXT NULL,
                description VARCHAR(500) NULL,
                posted_by VARCHAR(100) DEFAULT 'SYSTEM',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """),
        # ============================================================
        # ZONE 30 PHASE 2: PMSRentalPool Table Creation
        # ============================================================
        ("pms_rental_pools", "id", """
            CREATE TABLE IF NOT EXISTS pms_rental_pools (
                id SERIAL PRIMARY KEY,
                pool_name VARCHAR(100) UNIQUE NOT NULL,
                description VARCHAR(500) NULL,
                is_active BOOLEAN DEFAULT TRUE,
                hk_granularity VARCHAR(20) DEFAULT 'ALL',
                total_pool_sqft DOUBLE PRECISION DEFAULT 0.0,
                ytd_pool_revenue DOUBLE PRECISION DEFAULT 0.0,
                ytd_disbursed DOUBLE PRECISION DEFAULT 0.0,
                management_fee_pct DOUBLE PRECISION DEFAULT 20.0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """),
        # ============================================================
        # ZONE LICENSING: client_licenses Table (2026-06-21)
        # Stores package assignments per client for zone-scoped demos
        # and production licensing. Idempotent via IF NOT EXISTS.
        # ============================================================
        ("client_licenses", "id", """
            CREATE TABLE IF NOT EXISTS client_licenses (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                client_code   VARCHAR(50) UNIQUE NOT NULL,
                entity_name   VARCHAR(100) NOT NULL,
                package_id    VARCHAR(50) NOT NULL,
                allowed_zones TEXT,
                brand_color   VARCHAR(20) DEFAULT '#00F2FF',
                is_demo       BOOLEAN DEFAULT 0,
                expires_at    DATETIME NULL,
                created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """),
    ]
    
    with engine.connect() as conn:
        for table, column, sql in surgery_points:
            try:
                # Check if column exists
                conn.execute(text(f"SELECT {column} FROM {table} LIMIT 1;"))
            except Exception:
                # Column is missing, perform surgery
                logger.warning(f"💉 SURGERY: Injecting missing column [{column}] into {table}...")
                # conn.rollback() No longer needed in some engines, but safe to try
                try:
                    conn.execute(text(sql))
                    # Manual commit for engines that support it
                    try: conn.execute(text("COMMIT;"))
                    except: pass 
                    logger.info(f"✅ SUCCESS: {table}.{column} is now online.")
                except Exception as ex:
                    logger.error(f"❌ SURGERY FAILED for {column}: {ex}")


def seed_fiscal_ledger(db: Session):
    """Initializes the Accounting Ledger with a Genesis Marker and seeds COA codes."""
    # Use text search for ref to avoid schema crashes during boot
    existing = db.execute(text("SELECT id FROM accounting_ledger WHERE transaction_ref = 'GENESIS_001'")).first()

    if not existing:
        genesis_entry = AccountingLedger(
            transaction_ref="GENESIS_001",
            type="SYSTEM_GENESIS",
            category="EQUITY",
            amount=0.0,
            balance_after=0.0,
            description="Master OS Genesis Initialization",
            operator_id="SYSTEM_ROOT"
        )
        db.add(genesis_entry)
        logger.info("✨ GENESIS: Master Ledger Online.")

    # =====================================================
    # ZONE 30 PHASE 1: Seed Co-Owner & Mortgage COA codes
    # Idempotent: Account.code has unique constraint
    # =====================================================
    pms_coa_codes = [
        {"code": 113200, "name": "Mortgage Principal Receivable",        "type": "ASSET"},
        {"code": 113300, "name": "Owner Yield Payable",                  "type": "LIABILITY"},
        {"code": 200300, "name": "Lease Payable — Rental Owner",         "type": "LIABILITY"},
        {"code": 440100, "name": "Interest & Fee Revenue — Mortgage",    "type": "REVENUE"},
        {"code": 521200, "name": "Lease Expense — Rental Owner",         "type": "EXPENSE"},
        {"code": 521300, "name": "Owner Disbursement Expense",           "type": "EXPENSE"},
        # ── Z-PROP Phase 1: Property Capitalisation & JV Accounting ──────────
        {"code": 150100, "name": "Property Assets — Freehold",          "type": "ASSET"},
        {"code": 150200, "name": "Property Assets — Leasehold",         "type": "ASSET"},
        {"code": 150300, "name": "Property Assets — Off-Plan",          "type": "ASSET"},
        {"code": 200400, "name": "Notes Payable — Property Purchase",   "type": "LIABILITY"},
        {"code": 200500, "name": "Escrow Deposit Liability",            "type": "LIABILITY"},
        {"code": 310100, "name": "JV Share Capital — SGPE",             "type": "EQUITY"},
        {"code": 310200, "name": "Retained Yield — Property Pool",      "type": "EQUITY"},
        {"code": 440200, "name": "Property Management Fee Revenue",     "type": "REVENUE"},
        {"code": 440300, "name": "Marketplace Commission Revenue",      "type": "REVENUE"},
        {"code": 521400, "name": "Property Registration Expense",       "type": "EXPENSE"},
        {"code": 521500, "name": "Property Depreciation Expense",       "type": "EXPENSE"},
    ]

    for coa in pms_coa_codes:
        try:
            existing_coa = db.execute(
                text(f"SELECT id FROM accounts WHERE code = {coa['code']}")
            ).first()
            if not existing_coa:
                db.execute(text(
                    f"INSERT INTO accounts (code, name, type) "
                    f"VALUES ({coa['code']}, '{coa['name']}', '{coa['type']}')"
                ))
                logger.info(f"✨ COA SEEDED: {coa['code']} — {coa['name']}")
        except Exception as coa_err:
            logger.warning(f"COA seed skipped for {coa['code']}: {coa_err}")


def seed_admin_baseline(db: Session):
    """Ensures at least one Admin exists for the Security and HR zones."""
    admin_check = db.execute(select(User).where(User.username == "ADMIN-001")).scalars().first()
    
    if not admin_check:
        # Create Security Profile
        root_admin = User(
            username="ADMIN-001",
            hashed_password="1234", # Sovereign Rule: Default seeding
            role="CDO",
            is_active=True
        )
        db.add(root_admin)
        db.flush() 
        
        # Create Linked Employee Profile
        root_employee = Employee(
            id="OP-001",
            user_id=root_admin.id,
            full_name="SYSTEM_ROOT",
            dept="COMMAND",
            position="CDO_INITIAL_ACCESS"
        )
        db.add(root_employee)
        logger.warning("⚠️ GENESIS: Root Admin 'ADMIN-001' created. [PWD: 1234]")

def seed_asset_grid(db: Session):
    """Populates the clinical HMS ward architecture into the Asset Grid using batch logic."""
    existing_count = db.query(AssetGrid).count()
    if existing_count > 0:
        logger.info("✨ GENESIS: Clinical Asset Grid already locked.")
        return

    # 🏥 MIRACLE HMS — CLINICAL WARD ARCHITECTURE
    # Ward configuration matches the physical bed plan.
    clinical_assets = []
    for i in range(1, 6):
        clinical_assets.append({"room_id": f"WARD-{i:02d}", "category": "WARD",      "base_rate": 150.0,  "floor": 1})
    for i in range(1, 6):
        clinical_assets.append({"room_id": f"CABIN-{i:02d}", "category": "CABIN",    "base_rate": 350.0,  "floor": 2})
    for i in range(1, 4):
        clinical_assets.append({"room_id": f"ICU-{i:02d}",  "category": "ICU",       "base_rate": 1200.0, "floor": 3})
    for i in range(1, 4):
        clinical_assets.append({"room_id": f"ER-{i:02d}",   "category": "EMERGENCY", "base_rate": 500.0,  "floor": 0})
    for i in range(1, 3):
        clinical_assets.append({"room_id": f"OT-{i:02d}",   "category": "OT",        "base_rate": 2500.0, "floor": 4})

    for asset in clinical_assets:
        existing = db.query(AssetGrid).filter(AssetGrid.room_id == asset["room_id"]).first()
        if not existing:
            new_asset = AssetGrid(
                room_id=asset["room_id"],
                category=asset["category"],
                base_rate=asset["base_rate"],
                floor=asset["floor"],
                is_active=True,
                current_status="AVAILABLE",
                current_guest="NONE"
            )
            db.add(new_asset)

    logger.info("✨ GENESIS: Clinical Asset Grid Online (WARD/CABIN/ICU/ER/OT).")

def seed_corporate_matrix(db: Session):
    """PHASE 26: Populates the Virtual Department Grid for Synapse Nexus."""
    
    default_departments = [
        {"code": "IT", "name": "Information Technology", "category": "DEPARTMENT", "icon_code": "💻", "color": "cyan"},
        {"code": "HK", "name": "Housekeeping", "category": "OPERATIONAL", "icon_code": "🧹", "color": "amber"},
        {"code": "ACC", "name": "Accounts & Finance", "category": "DEPARTMENT", "icon_code": "📊", "color": "green"},
        {"code": "MN", "name": "Maintenance", "category": "OPERATIONAL", "icon_code": "🔧", "color": "purple"},
        {"code": "HR", "name": "Human Resources", "category": "DEPARTMENT", "icon_code": "👥", "color": "cyan"},
        {"code": "MK", "name": "Marketing & Sales", "category": "DEPARTMENT", "icon_code": "📱", "color": "purple"},
        {"code": "POOL", "name": "Pool Area", "category": "PHYSICAL", "icon_code": "🏊", "color": "cyan"},
        {"code": "SPA", "name": "Spa & Wellness", "category": "PHYSICAL", "icon_code": "💆", "color": "amber"},
        {"code": "FD", "name": "Front Desk & Guest", "category": "OPERATIONAL", "icon_code": "🛎️", "color": "cyan"},
        {"code": "FB", "name": "Food & Beverage", "category": "OPERATIONAL", "icon_code": "🍽️", "color": "amber"},
        {"code": "SC", "name": "Supply Chain", "category": "DEPARTMENT", "icon_code": "📦", "color": "purple"},
        {"code": "SEC", "name": "Security & Risk", "category": "OPERATIONAL", "icon_code": "🛡️", "color": "green"},
        {"code": "EXEC", "name": "Executive Command", "category": "EXECUTIVE", "icon_code": "👑", "color": "cyan"},
    ]

    for i, dept in enumerate(default_departments):
        existing = db.query(CorporateDepartment).filter(CorporateDepartment.code == dept["code"]).first()
        if not existing:
            new_dept = CorporateDepartment(
                code=dept["code"],
                name=dept["name"],
                category=dept["category"],
                icon_code=dept["icon_code"],
                signal_color=dept["color"],
                sort_order=(i + 1) * 10
            )
            db.add(new_dept)
    
    db.commit()
    logger.info("✨ GENESIS: Corporate Matrix Grid Online (Phase 26).")

if __name__ == "__main__":
    run_genesis_sequence()