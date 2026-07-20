# ==============================================================================
# MIRACLE OS - DEPARTMENTAL ACCOUNTING ENGINE (Phase 6A)
# Router: /api/accounting/dept/* | /api/accounting/gateway/* | /api/accounting/master/*
#
# GOVERNING LAWS:
#   Iron Law 64: Expense catalog enforcement - only UUID category_id
#   Iron Law 65: 20-tx batch consent gate - blocks until dept head PIN
#   Iron Law 66: master_ledger is APPEND-ONLY - zero UPDATE/DELETE
#   Iron Law 67: Void double-authorization - dept head + accounts both required
#   Iron Law 68: Negative till block - HTTP 409 if expense goes negative
#   Iron Law 69: Double-entry atomicity - till_tx + ledger_entry in same DB tx
#   Iron Law 70: Cross-dept transactions marked with is_cross_dept=True
#   Iron Law 71: ACCOUNTS role cannot enter transactions - reviewer only
#
# READ: SOVEREIGN_ACCOUNTING_DIRECTIVE.md + MIRACLE_ACCOUNTING_BIBLE.md
# ==============================================================================
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, func, and_, desc
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, date
from pathlib import Path
import uuid
import hashlib
import logging

from app.core.database import get_db

logger = logging.getLogger("MasterOS")

router = APIRouter(tags=["ZONE 11: Departmental Accounting Engine"])

# ==============================================================================
# AUTH HELPER (reads role from JWT header - same pattern as rest of codebase)
# ==============================================================================

def get_caller_info(request_data: Dict[str, Any]) -> Dict[str, str]:
    """Extract user info from request body (caller_id + caller_role)."""
    return {
        "id": request_data.get("caller_id", "SYSTEM"),
        "role": request_data.get("caller_role", "STAFF").upper(),
        "username": request_data.get("caller_username", "unknown"),
    }

def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()

def _new_id() -> str:
    return str(uuid.uuid4())

def _hash_pin(pin: str) -> str:
    """SHA-256 hash of PIN for storage (never store raw PIN)."""
    return hashlib.sha256(pin.encode()).hexdigest()


# ==============================================================================
# SECTION 1: DATABASE SCHEMA AUTO-MIGRATION
# Call this from main.py lifespan to auto-create all 7 accounting tables.
# ==============================================================================

ACCOUNTING_SCHEMA_SQL = [
    # 1. Department Registry
    """
    CREATE TABLE IF NOT EXISTS departments (
        id              VARCHAR(64) PRIMARY KEY,
        zone_id         VARCHAR(32),
        name            VARCHAR(255) NOT NULL,
        type            VARCHAR(64) DEFAULT 'REVENUE',
        head_user_id    VARCHAR(64),
        head_name       VARCHAR(255),
        dept_head_pin   VARCHAR(255),
        till_float      REAL DEFAULT 0.0,
        opening_float   REAL DEFAULT 0.0,
        currency        VARCHAR(16) DEFAULT 'PKR',
        active          INTEGER DEFAULT 1,
        price_tier      VARCHAR(64) DEFAULT 'ENTERPRISE',
        gl_prefix       VARCHAR(32) NOT NULL,
        created_at      VARCHAR(64),
        updated_at      VARCHAR(64)
    )
    """,
    # 2. Expense Categories (Pre-approved catalog per department)
    """
    CREATE TABLE IF NOT EXISTS expense_categories (
        id                  VARCHAR(64) PRIMARY KEY,
        dept_id             VARCHAR(64) NOT NULL,
        name                VARCHAR(255) NOT NULL,
        gl_code             VARCHAR(64) NOT NULL,
        per_tx_limit        REAL DEFAULT 0.0,
        daily_limit         REAL DEFAULT 0.0,
        requires_pin_above  REAL DEFAULT 0.0,
        active              INTEGER DEFAULT 1,
        created_by          VARCHAR(255),
        created_at          VARCHAR(64)
    )
    """,
    # 3. Department Till Transactions (Layer 1 - raw feed)
    """
    CREATE TABLE IF NOT EXISTS till_transactions (
        id              VARCHAR(64) PRIMARY KEY,
        dept_id         VARCHAR(64) NOT NULL,
        type            VARCHAR(64) NOT NULL,
        amount          REAL NOT NULL,
        direction       VARCHAR(16) NOT NULL,
        category_id     VARCHAR(64),
        category_name   VARCHAR(255),
        description     VARCHAR(255),
        payment_method  VARCHAR(64),
        reference_id    VARCHAR(255),
        staff_id        VARCHAR(64),
        staff_name      VARCHAR(255),
        shift_id        VARCHAR(64),
        batch_id        VARCHAR(64),
        status          VARCHAR(64) DEFAULT 'ACTIVE',
        void_reason     VARCHAR(255),
        void_reason_code VARCHAR(64),
        voided_by       VARCHAR(64),
        voided_at       VARCHAR(64),
        is_cross_dept   INTEGER DEFAULT 0,
        cross_dept_token VARCHAR(64),
        gl_debit        VARCHAR(64),
        gl_credit       VARCHAR(64),
        created_at      VARCHAR(64)
    )
    """,
    # 4. Transaction Batches (every 20 tx - consent required)
    """
    CREATE TABLE IF NOT EXISTS tx_batches (
        id                  VARCHAR(64) PRIMARY KEY,
        dept_id             VARCHAR(64) NOT NULL,
        batch_number        INTEGER DEFAULT 1,
        tx_count            INTEGER DEFAULT 0,
        total_revenue       REAL DEFAULT 0.0,
        total_expense       REAL DEFAULT 0.0,
        total_voids         INTEGER DEFAULT 0,
        status              VARCHAR(64) DEFAULT 'OPEN',
        dept_head_id        VARCHAR(64),
        dept_head_name      VARCHAR(255),
        consent_at          VARCHAR(64),
        consent_pin_hash    VARCHAR(255),
        gateway_reviewer    VARCHAR(255),
        gateway_action      VARCHAR(64),
        gateway_note        VARCHAR(255),
        gateway_at          VARCHAR(64),
        posted_by           VARCHAR(255),
        posted_at           VARCHAR(64),
        created_at          VARCHAR(64),
        updated_at          VARCHAR(64)
    )
    """,
    # 5. Department Ledger Entries (Layer 1 - double-entry per transaction)
    """
    CREATE TABLE IF NOT EXISTS dept_ledger_entries (
        id              VARCHAR(64) PRIMARY KEY,
        dept_id         VARCHAR(64) NOT NULL,
        batch_id        VARCHAR(64),
        tx_id           VARCHAR(64),
        debit_account   VARCHAR(64) NOT NULL,
        credit_account  VARCHAR(64) NOT NULL,
        amount          REAL NOT NULL,
        narration       VARCHAR(255),
        entry_date      VARCHAR(64),
        status          VARCHAR(64) DEFAULT 'DRAFT',
        created_at      VARCHAR(64)
    )
    """,
    # 6. Void Log (dedicated void tracking)
    """
    CREATE TABLE IF NOT EXISTS void_log (
        id                      VARCHAR(64) PRIMARY KEY,
        tx_id                   VARCHAR(64) NOT NULL,
        dept_id                 VARCHAR(64) NOT NULL,
        amount                  REAL NOT NULL,
        reason                  VARCHAR(255),
        reason_code             VARCHAR(64),
        requested_by            VARCHAR(64),
        requested_by_name       VARCHAR(255),
        requested_at            VARCHAR(64),
        dept_head_approved      INTEGER DEFAULT 0,
        dept_head_id            VARCHAR(64),
        dept_head_at            VARCHAR(64),
        dept_head_note          VARCHAR(255),
        accounts_eliminated     INTEGER DEFAULT 0,
        eliminated_by           VARCHAR(255),
        eliminated_at           VARCHAR(64),
        escalated               INTEGER DEFAULT 0,
        escalated_to            VARCHAR(64),
        gm_approved             INTEGER DEFAULT 0,
        gm_approved_by          VARCHAR(255),
        gm_approved_at          VARCHAR(64)
    )
    """,
    # 7. Master Ledger (Layer 3 - APPEND-ONLY, immutable)
    """
    CREATE TABLE IF NOT EXISTS master_ledger (
        id              VARCHAR(64) PRIMARY KEY,
        dept_id         VARCHAR(64),
        batch_id        VARCHAR(64),
        tx_id           VARCHAR(64),
        debit_account   VARCHAR(64) NOT NULL,
        credit_account  VARCHAR(64) NOT NULL,
        amount          REAL NOT NULL,
        narration       VARCHAR(255),
        entry_date      VARCHAR(64) NOT NULL,
        posted_by       VARCHAR(255),
        posted_at       VARCHAR(64) NOT NULL,
        is_void         INTEGER DEFAULT 0,
        void_ref        VARCHAR(64),
        is_force_approved INTEGER DEFAULT 0,
        force_approved_by VARCHAR(255),
        force_approved_reason VARCHAR(255)
    )
    """
]

# Default department seed data
DEFAULT_DEPARTMENTS = [
    {"id": "DEPT_POS",       "zone_id": "Z-06", "name": "Pharmacy Revenue",         "gl_prefix": "060", "type": "REVENUE"},
    {"id": "DEPT_WELLNESS",  "zone_id": "Z-27", "name": "LIS Diagnostic Labs",    "gl_prefix": "270", "type": "REVENUE"},
    {"id": "DEPT_PMS",       "zone_id": "Z-30", "name": "Ward ADT PMS",             "gl_prefix": "300", "type": "MIXED"},
    {"id": "DEPT_FB",        "zone_id": "Z-29", "name": "Patient Dietary & Meals",  "gl_prefix": "290", "type": "REVENUE"},
    {"id": "DEPT_BOUTIQUE",  "zone_id": "Z-28", "name": "Medical Supplies Store",   "gl_prefix": "280", "type": "REVENUE"},
    {"id": "DEPT_FLEET",     "zone_id": "Z-26", "name": "Ambulance & Emergency",    "gl_prefix": "260", "type": "REVENUE"},
    {"id": "DEPT_RENTAL",    "zone_id": "Z-3B", "name": "Medical Equipment Rent",   "gl_prefix": "3B0", "type": "MIXED"},
    {"id": "DEPT_CINEMA",    "zone_id": "Z-14", "name": "Medical Education Lab",    "gl_prefix": "090", "type": "REVENUE"},
]

# Default expense catalog templates per dept type
DEFAULT_EXPENSE_CATALOG = {
    "DEPT_WELLNESS": [
        {"name": "Spa Supplies & Amenities",   "gl_code": "5100-270", "per_tx_limit": 5000,  "daily_limit": 20000, "requires_pin_above": 3000},
        {"name": "Essential Oils & Products",  "gl_code": "5110-270", "per_tx_limit": 8000,  "daily_limit": 25005, "requires_pin_above": 5000},
        {"name": "Linen & Towel Replacement",  "gl_code": "5120-270", "per_tx_limit": 3000,  "daily_limit": 10000, "requires_pin_above": 2000},
        {"name": "Staff Refreshments",         "gl_code": "5200-270", "per_tx_limit": 1000,  "daily_limit": 3000,  "requires_pin_above": 0},
        {"name": "Equipment Maintenance",      "gl_code": "5400-270", "per_tx_limit": 10000, "daily_limit": 30000, "requires_pin_above": 5000},
        {"name": "Marketing Materials",        "gl_code": "5700-270", "per_tx_limit": 2000,  "daily_limit": 5000,  "requires_pin_above": 0},
        {"name": "Petty Cash - Urgent",        "gl_code": "5900-270", "per_tx_limit": 500,   "daily_limit": 1500,  "requires_pin_above": 0},
    ],
    "DEPT_POS": [
        {"name": "Raw Materials - Kitchen",    "gl_code": "5100-060", "per_tx_limit": 20000, "daily_limit": 80000, "requires_pin_above": 10000},
        {"name": "Bar Consumables",            "gl_code": "5110-060", "per_tx_limit": 10000, "daily_limit": 40000, "requires_pin_above": 5000},
        {"name": "Packaging Materials",        "gl_code": "5120-060", "per_tx_limit": 2000,  "daily_limit": 8000,  "requires_pin_above": 0},
        {"name": "Staff Meals",                "gl_code": "5200-060", "per_tx_limit": 500,   "daily_limit": 2000,  "requires_pin_above": 0},
        {"name": "Kitchen Equipment Repair",   "gl_code": "5400-060", "per_tx_limit": 15000, "daily_limit": 50000, "requires_pin_above": 8000},
        {"name": "Cleaning Supplies",          "gl_code": "5500-060", "per_tx_limit": 3000,  "daily_limit": 10000, "requires_pin_above": 0},
        {"name": "Petty Cash - Urgent",        "gl_code": "5900-060", "per_tx_limit": 1000,  "daily_limit": 3000,  "requires_pin_above": 0},
    ],
    "DEPT_FB": [
        {"name": "Food Ingredients - Fresh",   "gl_code": "5100-290", "per_tx_limit": 25000, "daily_limit": 100000,"requires_pin_above": 15000},
        {"name": "Beverage Stock",             "gl_code": "5110-290", "per_tx_limit": 15000, "daily_limit": 60000, "requires_pin_above": 8000},
        {"name": "Disposables & Packaging",   "gl_code": "5120-290", "per_tx_limit": 3000,  "daily_limit": 10000, "requires_pin_above": 0},
        {"name": "Staff Meals",                "gl_code": "5200-290", "per_tx_limit": 500,   "daily_limit": 2000,  "requires_pin_above": 0},
        {"name": "Equipment Maintenance",      "gl_code": "5400-290", "per_tx_limit": 20000, "daily_limit": 60000, "requires_pin_above": 10000},
        {"name": "Petty Cash - Urgent",        "gl_code": "5900-290", "per_tx_limit": 1000,  "daily_limit": 3000,  "requires_pin_above": 0},
    ],
    "DEPT_BOUTIQUE": [
        {"name": "Retail Stock Replenishment", "gl_code": "5100-280", "per_tx_limit": 30000, "daily_limit": 100000,"requires_pin_above": 15000},
        {"name": "Packaging & Gift Wrap",      "gl_code": "5120-280", "per_tx_limit": 2000,  "daily_limit": 8000,  "requires_pin_above": 0},
        {"name": "Display & Decor",            "gl_code": "5300-280", "per_tx_limit": 5000,  "daily_limit": 15000, "requires_pin_above": 3000},
        {"name": "Staff Refreshments",         "gl_code": "5200-280", "per_tx_limit": 500,   "daily_limit": 1500,  "requires_pin_above": 0},
        {"name": "Petty Cash - Urgent",        "gl_code": "5900-280", "per_tx_limit": 500,   "daily_limit": 1500,  "requires_pin_above": 0},
    ],
    "DEPT_FLEET": [
        {"name": "Fuel - Vehicle",             "gl_code": "5100-260", "per_tx_limit": 15000, "daily_limit": 60000, "requires_pin_above": 8000},
        {"name": "Toll & Parking Fees",        "gl_code": "5110-260", "per_tx_limit": 500,   "daily_limit": 2000,  "requires_pin_above": 0},
        {"name": "Vehicle Maintenance",        "gl_code": "5400-260", "per_tx_limit": 20000, "daily_limit": 80000, "requires_pin_above": 10000},
        {"name": "Driver Allowance",           "gl_code": "5200-260", "per_tx_limit": 2000,  "daily_limit": 8000,  "requires_pin_above": 0},
        {"name": "Vehicle Cleaning",           "gl_code": "5500-260", "per_tx_limit": 1500,  "daily_limit": 6000,  "requires_pin_above": 0},
        {"name": "Emergency Parts",            "gl_code": "5900-260", "per_tx_limit": 5000,  "daily_limit": 20000, "requires_pin_above": 3000},
    ],
    "DEPT_PMS": [
        {"name": "Guest Complimentary",        "gl_code": "5100-300", "per_tx_limit": 5000,  "daily_limit": 20000, "requires_pin_above": 2000},
        {"name": "OTA Commission Payout",      "gl_code": "5200-300", "per_tx_limit": 50000, "daily_limit": 200000,"requires_pin_above": 20000},
        {"name": "Room Supplies",              "gl_code": "5300-300", "per_tx_limit": 3000,  "daily_limit": 12000, "requires_pin_above": 0},
        {"name": "Stationery & Office",        "gl_code": "5400-300", "per_tx_limit": 1000,  "daily_limit": 4000,  "requires_pin_above": 0},
        {"name": "Petty Cash - Urgent",        "gl_code": "5900-300", "per_tx_limit": 500,   "daily_limit": 2000,  "requires_pin_above": 0},
    ],
    "DEPT_RENTAL": [
        {"name": "Asset Maintenance",          "gl_code": "5400-3B0", "per_tx_limit": 25000, "daily_limit": 80000, "requires_pin_above": 10000},
        {"name": "Insurance Payments",         "gl_code": "5500-3B0", "per_tx_limit": 30000, "daily_limit": 100000,"requires_pin_above": 15000},
        {"name": "Cleaning & Preparation",     "gl_code": "5600-3B0", "per_tx_limit": 3000,  "daily_limit": 10000, "requires_pin_above": 0},
        {"name": "Petty Cash - Urgent",        "gl_code": "5900-3B0", "per_tx_limit": 1000,  "daily_limit": 3000,  "requires_pin_above": 0},
    ],
    "DEPT_CINEMA": [
        {"name": "Movie Licensing Fee",        "gl_code": "5100-090", "per_tx_limit": 50000, "daily_limit": 150000,"requires_pin_above": 20000},
        {"name": "Concession Inventory",       "gl_code": "5110-090", "per_tx_limit": 10000, "daily_limit": 30000, "requires_pin_above": 5000},
        {"name": "Equipment Maintenance",      "gl_code": "5400-090", "per_tx_limit": 25000, "daily_limit": 75000, "requires_pin_above": 10000},
        {"name": "Cinema Cleaning Supplies",    "gl_code": "5500-090", "per_tx_limit": 2000,  "daily_limit": 6000,  "requires_pin_above": 0},
        {"name": "Petty Cash - Urgent",        "gl_code": "5900-090", "per_tx_limit": 1000,  "daily_limit": 3000,  "requires_pin_above": 0},
    ],
}

# GL account mappings for auto double-entry
REVENUE_GL_MAP = {
    "TREATMENT_FEE":    ("4100", "1000"),  # Dr Till, Cr Treatment Revenue
    "ROOM_REVENUE":     ("4200", "1000"),
    "FB_SALES":         ("4300", "1000"),
    "RETAIL_SALES":     ("4400", "1000"),
    "COMMISSION_INCOME":("4500", "1200"),  # Dr AR-OTA, Cr Commission Income
    "MEMBERSHIP_FEE":   ("4600", "1000"),
    "RENTAL_INCOME":    ("4700", "1000"),
    "SERVICE_CHARGE":   ("4800", "1000"),
    "CANCELLATION_FEE": ("4850", "1000"),
    "MISCELLANEOUS":    ("4900", "1000"),
}

VOID_REASON_CODES = [
    "GUEST_COMPLAINT",
    "ENTRY_ERROR",
    "SYSTEM_ERROR",
    "MANAGER_OVERRIDE",
    "PRICE_CORRECTION",
    "FRAUD_INVESTIGATION",
]

PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "OTA_CREDIT", "ROOM_CHARGE", "CHEQUE", "DIGITAL_WALLET"]


def seed_department_accounting(db: Session):
    """Called on boot from main.py lifespan. Creates tables and seeds default data."""
    try:
        # Create all 7 tables
        for sql in ACCOUNTING_SCHEMA_SQL:
            db.execute(text(sql))
        db.commit()
        logger.info("[DEPT-ACC] Schema migration: 7 accounting tables verified/created.")

        # Seed default departments
        for dept in DEFAULT_DEPARTMENTS:
            exists = db.execute(
                text("SELECT id FROM departments WHERE id = :id"),
                {"id": dept["id"]}
            ).fetchone()
            if not exists:
                db.execute(text("""
                    INSERT INTO departments (id, zone_id, name, type, gl_prefix, active, price_tier, currency, created_at)
                    VALUES (:id, :zone_id, :name, :type, :gl_prefix, 1, 'ENTERPRISE', 'PKR', :created_at)
                """), {**dept, "created_at": _utcnow()})

                # Create opening batch for this dept
                batch_id = _new_id()
                batch_num = db.execute(
                    text("SELECT COALESCE(MAX(batch_number), 0) + 1 FROM tx_batches WHERE dept_id = :d"),
                    {"d": dept["id"]}
                ).scalar() or 1
                db.execute(text("""
                    INSERT INTO tx_batches (id, dept_id, batch_number, tx_count, status, created_at, updated_at)
                    VALUES (:id, :dept_id, :bn, 0, 'OPEN', :ts, :ts)
                """), {"id": batch_id, "dept_id": dept["id"], "bn": batch_num, "ts": _utcnow()})
            else:
                # Sync Name, Zone ID, and Type for clinical branding
                db.execute(text("""
                    UPDATE departments 
                    SET name = :name, zone_id = :zone_id, type = :type 
                    WHERE id = :id
                """), dept)

        db.commit()
        logger.info("[DEPT-ACC] Default departments seeded (7 zones).")

        # Seed expense catalogs
        for dept_id, catalog in DEFAULT_EXPENSE_CATALOG.items():
            for cat in catalog:
                exists = db.execute(
                    text("SELECT id FROM expense_categories WHERE dept_id=:d AND name=:n"),
                    {"d": dept_id, "n": cat["name"]}
                ).fetchone()
                if not exists:
                    db.execute(text("""
                        INSERT INTO expense_categories
                        (id, dept_id, name, gl_code, per_tx_limit, daily_limit, requires_pin_above, active, created_at)
                        VALUES (:id, :dept_id, :name, :gl_code, :ptl, :dl, :rpa, 1, :ts)
                    """), {
                        "id": _new_id(), "dept_id": dept_id, "ts": _utcnow(),
                        "name": cat["name"], "gl_code": cat["gl_code"],
                        "ptl": cat["per_tx_limit"], "dl": cat["daily_limit"],
                        "rpa": cat["requires_pin_above"]
                    })
        db.commit()
        logger.info("[DEPT-ACC] Default expense catalogs seeded for all 7 departments.")

    except Exception as e:
        db.rollback()
        logger.error(f"[DEPT-ACC] Seed error: {e}")


# ==============================================================================
# SECTION 2: DEPARTMENT REGISTRY ENDPOINTS
# ==============================================================================

@router.get("/dept/list")
def list_departments(
    active_only: bool = True,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """List all departments. Active filter default. Any authenticated role."""
    where = "WHERE active = 1" if active_only else ""
    rows = db.execute(text(f"""
        SELECT id, zone_id, name, type, head_user_id, head_name,
               till_float, opening_float, currency, active, price_tier, gl_prefix, created_at
        FROM departments {where}
        ORDER BY name
    """)).fetchall()
    return {
        "status": "SUCCESS",
        "count": len(rows),
        "departments": [dict(r._mapping) for r in rows]
    }


@router.get("/dept/{dept_id}/info")
def get_department(dept_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get a single department's configuration."""
    row = db.execute(
        text("SELECT * FROM departments WHERE id = :id"),
        {"id": dept_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Department {dept_id} not found.")
    return {"status": "SUCCESS", "department": dict(row._mapping)}


@router.post("/dept/create")
def create_department(data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """CDO only: Create a new department. Auto-creates opening batch."""
    caller = get_caller_info(data)
    if caller["role"] not in ("CDO", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only CDO/ADMIN can create departments.")

    dept_id = data.get("id", f"DEPT_{data.get('name','').upper().replace(' ','_')[:10]}")
    if not data.get("gl_prefix"):
        raise HTTPException(status_code=422, detail="gl_prefix is required.")

    try:
        db.execute(text("""
            INSERT INTO departments (id, zone_id, name, type, head_user_id, head_name,
                                     gl_prefix, currency, active, price_tier, created_at, updated_at)
            VALUES (:id, :zone_id, :name, :type, :head_user_id, :head_name,
                    :gl_prefix, :currency, 1, :price_tier, :ts, :ts)
        """), {
            "id": dept_id,
            "zone_id": data.get("zone_id", ""),
            "name": data.get("name", dept_id),
            "type": data.get("type", "REVENUE"),
            "head_user_id": data.get("head_user_id"),
            "head_name": data.get("head_name"),
            "gl_prefix": data.get("gl_prefix"),
            "currency": data.get("currency", "PKR"),
            "price_tier": data.get("price_tier", "ENTERPRISE"),
            "ts": _utcnow()
        })
        # Create opening batch
        batch_id = _new_id()
        db.execute(text("""
            INSERT INTO tx_batches (id, dept_id, batch_number, tx_count, status, created_at, updated_at)
            VALUES (:id, :dept_id, 1, 0, 'OPEN', :ts, :ts)
        """), {"id": batch_id, "dept_id": dept_id, "ts": _utcnow()})
        db.commit()
        return {"status": "SUCCESS", "message": f"Department {dept_id} created.", "dept_id": dept_id, "first_batch_id": batch_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/dept/{dept_id}/update")
def update_department(dept_id: str, data: dict, db: Session = Depends(get_db)) -> dict:
    """CDO only: Update department. Iron Law 72: Deactivation blocked if pending batches or positive till."""
    caller = get_caller_info(data)
    if caller["role"] not in ("CDO", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only CDO/ADMIN can modify departments.")

    # === IRON LAW 72: Deactivation Safety Guards ===
    if data.get("active") == 0 or data.get("active") is False:
        # Guard A: Block if any in-flight batch
        pending = db.execute(text(
            "SELECT id, status FROM tx_batches WHERE dept_id=:d "
            "AND status IN ('OPEN','PENDING_CONSENT','CONSENTED','SUBMITTED','QUERIED') LIMIT 1"
        ), {"d": dept_id}).fetchone()
        if pending:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"[IRON LAW 72] Deactivation blocked. Batch {pending[0]} status='{pending[1]}'. "
                    "All batches must be POSTED or REJECTED before deactivating this department."
                )
            )
        # Guard B: Block if positive till balance
        balance = _compute_till_balance(dept_id, db)
        if balance > 0:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"[IRON LAW 72] Deactivation blocked. Till balance is PKR {round(balance, 2)}. "
                    "Perform a CASH_DROP to zero the till first."
                )
            )
        logger.info(f"[DEPT-ACC][LAW-72] {dept_id} passed deactivation guards: balance=0, no pending batches.")
    # === End Iron Law 72 ===

    updates = []
    params = {"id": dept_id, "ts": _utcnow()}
    for field in ("head_user_id", "head_name", "active", "price_tier"):
        if field in data:
            updates.append(f"{field} = :{field}")
            params[field] = data[field]
    if not updates:
        raise HTTPException(status_code=422, detail="No updatable fields provided.")
    updates.append("updated_at = :ts")
    db.execute(text(f"UPDATE departments SET {', '.join(updates)} WHERE id = :id"), params)
    db.commit()
    action = "DEACTIVATED (all historical data preserved)" if data.get("active") == 0 else "UPDATED"
    return {"status": "SUCCESS", "message": f"Department {dept_id} — {action}."}


# ==============================================================================
# SECTION 3: EXPENSE CATALOG ENDPOINTS
# ==============================================================================

@router.get("/dept/{dept_id}/expense-catalog")
def get_expense_catalog(dept_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get all active expense categories for a department."""
    rows = db.execute(text("""
        SELECT id, name, gl_code, per_tx_limit, daily_limit, requires_pin_above, active
        FROM expense_categories WHERE dept_id = :d AND active = 1 ORDER BY name
    """), {"d": dept_id}).fetchall()
    return {
        "status": "SUCCESS",
        "dept_id": dept_id,
        "categories": [dict(r._mapping) for r in rows]
    }


@router.post("/expense-catalog/add")
def add_expense_category(data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """ACCOUNTS/CDO only: Add a new expense category to a department's catalog."""
    caller = get_caller_info(data)
    if caller["role"] not in ("ACCOUNTS", "ACC", "CDO", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only Accounts/CDO can manage expense catalogs.")
    cat_id = _new_id()
    try:
        db.execute(text("""
            INSERT INTO expense_categories
            (id, dept_id, name, gl_code, per_tx_limit, daily_limit, requires_pin_above, active, created_by, created_at)
            VALUES (:id, :dept_id, :name, :gl_code, :ptl, :dl, :rpa, 1, :created_by, :ts)
        """), {
            "id": cat_id,
            "dept_id": data["dept_id"],
            "name": data["name"],
            "gl_code": data["gl_code"],
            "ptl": float(data.get("per_tx_limit", 0)),
            "dl": float(data.get("daily_limit", 0)),
            "rpa": float(data.get("requires_pin_above", 0)),
            "created_by": caller["username"],
            "ts": _utcnow()
        })
        db.commit()
        return {"status": "SUCCESS", "category_id": cat_id, "message": "Expense category added."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/expense-catalog/{cat_id}/update")
def update_expense_category(cat_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """ACCOUNTS/CDO only: Update limits, activate/deactivate a catalog entry."""
    caller = get_caller_info(data)
    if caller["role"] not in ("ACCOUNTS", "ACC", "CDO", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only Accounts/CDO can modify expense catalogs.")
    updates, params = [], {"id": cat_id}
    for field in ("name", "gl_code", "per_tx_limit", "daily_limit", "requires_pin_above", "active"):
        if field in data:
            updates.append(f"{field} = :{field}")
            params[field] = data[field]
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update.")
    db.execute(text(f"UPDATE expense_categories SET {', '.join(updates)} WHERE id = :id"), params)
    db.commit()
    return {"status": "SUCCESS", "message": "Expense category updated."}


# ==============================================================================
# SECTION 4: TILL OPERATIONS (Revenue, Expense, Float, Void Init)
# ==============================================================================

def _get_or_create_open_batch(dept_id: str, db: Session) -> str:
    """Get the current OPEN batch ID for a department, or create a new one."""
    row = db.execute(
        text("SELECT id FROM tx_batches WHERE dept_id = :d AND status = 'OPEN' LIMIT 1"),
        {"d": dept_id}
    ).fetchone()
    if row:
        return row[0]
    # Create new batch
    batch_id = _new_id()
    batch_num = db.execute(
        text("SELECT COALESCE(MAX(batch_number), 0) + 1 FROM tx_batches WHERE dept_id = :d"),
        {"d": dept_id}
    ).scalar() or 1
    db.execute(text("""
        INSERT INTO tx_batches (id, dept_id, batch_number, tx_count, status, created_at, updated_at)
        VALUES (:id, :d, :bn, 0, 'OPEN', :ts, :ts)
    """), {"id": batch_id, "d": dept_id, "bn": batch_num, "ts": _utcnow()})
    return batch_id


def _compute_till_balance(dept_id: str, db: Session) -> float:
    """Compute current till balance from transaction log (Iron Law 68 - never stored)."""
    row = db.execute(text("""
        SELECT
            COALESCE(SUM(CASE WHEN direction='IN'  AND status='ACTIVE' THEN amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN direction='OUT' AND status='ACTIVE' THEN amount ELSE 0 END), 0)
        FROM till_transactions WHERE dept_id = :d
    """), {"d": dept_id}).fetchone()
    return float(row[0]) if row else 0.0


def _check_batch_gate(dept_id: str, db: Session):
    """Iron Law 65: Block if batch is PENDING_CONSENT."""
    row = db.execute(
        text("SELECT status FROM tx_batches WHERE dept_id = :d AND status IN ('OPEN','PENDING_CONSENT') ORDER BY created_at DESC LIMIT 1"),
        {"d": dept_id}
    ).fetchone()
    if row and row[0] == "PENDING_CONSENT":
        raise HTTPException(
            status_code=409,
            detail="[IRON LAW 65] Batch consent required. Department Head must consent this batch before new entries can be recorded."
        )


def _post_ledger_entry(dept_id: str, batch_id: str, tx_id: str,
                        debit_acct: str, credit_acct: str,
                        amount: float, narration: str, db: Session):
    """Iron Law 69: Post double-entry ledger record atomically with till transaction."""
    db.execute(text("""
        INSERT INTO dept_ledger_entries
        (id, dept_id, batch_id, tx_id, debit_account, credit_account, amount, narration, entry_date, status, created_at)
        VALUES (:id, :dept_id, :batch_id, :tx_id, :debit, :credit, :amount, :narration, :date, 'DRAFT', :ts)
    """), {
        "id": _new_id(), "dept_id": dept_id, "batch_id": batch_id, "tx_id": tx_id,
        "debit": debit_acct, "credit": credit_acct, "amount": amount,
        "narration": narration, "date": date.today().isoformat(), "ts": _utcnow()
    })


def _update_batch_after_tx(batch_id: str, tx_type: str, amount: float, db: Session):
    """Increment batch counters after each transaction. Trigger consent gate at 20."""
    db.execute(text("""
        UPDATE tx_batches SET
            tx_count = tx_count + 1,
            total_revenue = total_revenue + CASE WHEN :t IN ('REVENUE_CASH','REVENUE_CARD','REVENUE_BANK','REVENUE_ROOM_CHARGE','FLOAT_TOPUP') THEN :a ELSE 0 END,
            total_expense = total_expense + CASE WHEN :t IN ('EXPENSE_CASH','CASH_DROP') THEN :a ELSE 0 END,
            updated_at = :ts
        WHERE id = :id
    """), {"id": batch_id, "t": tx_type, "a": amount, "ts": _utcnow()})

    # Check if batch hit 20 — trigger consent gate
    row = db.execute(text("SELECT tx_count FROM tx_batches WHERE id = :id"), {"id": batch_id}).fetchone()
    if row and row[0] >= 20:
        db.execute(text(
            "UPDATE tx_batches SET status='PENDING_CONSENT', updated_at=:ts WHERE id=:id"
        ), {"id": batch_id, "ts": _utcnow()})
        logger.info(f"[DEPT-ACC] Batch {batch_id} reached 20 tx — PENDING_CONSENT gate activated.")


@router.get("/dept/{dept_id}/till")
def get_till_status(dept_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get current till balance + today's revenue/expense summary + active batch status."""
    dept = db.execute(text("SELECT * FROM departments WHERE id = :id"), {"id": dept_id}).fetchone()
    if not dept:
        raise HTTPException(status_code=404, detail=f"Department {dept_id} not found.")

    balance = _compute_till_balance(dept_id, db)
    today = date.today().isoformat()

    summary = db.execute(text("""
        SELECT
            COALESCE(SUM(CASE WHEN direction='IN'  AND type LIKE 'REVENUE%' AND DATE(created_at)=:today AND status='ACTIVE' THEN amount ELSE 0 END), 0) as revenue_today,
            COALESCE(SUM(CASE WHEN direction='OUT' AND type='EXPENSE_CASH'  AND DATE(created_at)=:today AND status='ACTIVE' THEN amount ELSE 0 END), 0) as expense_today,
            COUNT(CASE WHEN status='VOIDED' AND DATE(created_at)=:today THEN 1 END) as voids_today
        FROM till_transactions WHERE dept_id = :d
    """), {"d": dept_id, "today": today}).fetchone()

    batch = db.execute(text("""
        SELECT id, batch_number, tx_count, total_revenue, total_expense, status
        FROM tx_batches WHERE dept_id = :d
        ORDER BY created_at DESC LIMIT 1
    """), {"d": dept_id}).fetchone()

    if not batch:
        batch_id = _get_or_create_open_batch(dept_id, db)
        db.commit()
        batch = db.execute(text("""
            SELECT id, batch_number, tx_count, total_revenue, total_expense, status
            FROM tx_batches WHERE id = :bid
        """), {"bid": batch_id}).fetchone()

    return {
        "status": "SUCCESS",
        "dept_id": dept_id,
        "dept_name": dept._mapping["name"],
        "currency": dept._mapping["currency"],
        "till_balance": round(balance, 2),
        "revenue_today": round(float(summary[0]), 2),
        "expense_today": round(float(summary[1]), 2),
        "voids_today": int(summary[2]),
        "batch": dict(batch._mapping) if batch else None
    }


@router.post("/dept/{dept_id}/till/revenue")
def add_revenue(dept_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Staff: Record revenue entry in department till. Iron Laws 65, 69, 71."""
    caller = get_caller_info(data)

    # Iron Law 71: ACCOUNTS cannot enter transactions
    if caller["role"] in ("ACCOUNTS", "ACC"):
        raise HTTPException(status_code=403, detail="[IRON LAW 71] Accounts role cannot enter till transactions.")

    # Iron Law 65: Check batch consent gate
    _check_batch_gate(dept_id, db)

    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Revenue amount must be positive.")

    payment_method = data.get("payment_method", "CASH").upper()
    if payment_method not in PAYMENT_METHODS:
        raise HTTPException(status_code=422, detail=f"Invalid payment_method. Valid: {PAYMENT_METHODS}")

    revenue_type = data.get("revenue_type", "MISCELLANEOUS").upper()
    tx_type = f"REVENUE_{payment_method}" if payment_method in ("CASH", "CARD") else "REVENUE_BANK"
    if payment_method == "ROOM_CHARGE":
        tx_type = "REVENUE_ROOM_CHARGE"

    # Get GL codes for double-entry
    gl_income, gl_till = REVENUE_GL_MAP.get(revenue_type, ("4900", "1000"))
    dept = db.execute(text("SELECT gl_prefix FROM departments WHERE id=:id"), {"id": dept_id}).fetchone()
    pfx = dept[0] if dept else "000"
    gl_debit = f"{gl_till}-{pfx}"   # Dr Till/AR
    gl_credit = f"{gl_income}-{pfx}" # Cr Revenue

    try:
        with db.begin_nested():
            tx_id = _new_id()
            batch_id = _get_or_create_open_batch(dept_id, db)

            # Iron Law 69: Till transaction + ledger entry in same nested transaction
            db.execute(text("""
                INSERT INTO till_transactions
                (id, dept_id, type, amount, direction, description, payment_method,
                 reference_id, staff_id, staff_name, batch_id, status, gl_debit, gl_credit, created_at)
                VALUES (:id, :dept_id, :type, :amount, 'IN', :desc, :pm, :ref, :sid, :sname, :bid, 'ACTIVE', :gd, :gc, :ts)
            """), {
                "id": tx_id, "dept_id": dept_id, "type": tx_type,
                "amount": amount, "desc": data.get("description", revenue_type),
                "pm": payment_method, "ref": data.get("reference_id", ""),
                "sid": caller["id"], "sname": caller["username"],
                "bid": batch_id, "gd": gl_debit, "gc": gl_credit, "ts": _utcnow()
            })

            _post_ledger_entry(dept_id, batch_id, tx_id, gl_debit, gl_credit,
                               amount, f"{revenue_type} via {payment_method}", db)
            _update_batch_after_tx(batch_id, tx_type, amount, db)

        db.commit()
        new_balance = _compute_till_balance(dept_id, db)
        return {
            "status": "SUCCESS",
            "message": "Revenue recorded.",
            "tx_id": tx_id,
            "amount": amount,
            "new_till_balance": round(new_balance, 2),
            "gl_entry": f"Dr {gl_debit} / Cr {gl_credit}"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Revenue entry failed: {str(e)}")


@router.post("/dept/{dept_id}/till/expense")
def add_expense(dept_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Staff: Record expense from pre-approved catalog only. Iron Laws 64, 65, 68, 69, 71."""
    caller = get_caller_info(data)

    # Iron Law 71
    if caller["role"] in ("ACCOUNTS", "ACC"):
        raise HTTPException(status_code=403, detail="[IRON LAW 71] Accounts role cannot enter till transactions.")

    # Iron Law 64: category_id is mandatory — no freeform
    category_id = data.get("category_id")
    if not category_id:
        raise HTTPException(status_code=422, detail="[IRON LAW 64] category_id is required. Freeform expense categories are prohibited.")

    cat = db.execute(
        text("SELECT * FROM expense_categories WHERE id = :id AND dept_id = :d AND active = 1"),
        {"id": category_id, "d": dept_id}
    ).fetchone()
    if not cat:
        raise HTTPException(status_code=422, detail="[IRON LAW 64] Invalid or inactive expense category for this department.")

    # Iron Law 65
    _check_batch_gate(dept_id, db)

    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Expense amount must be positive.")

    # Check per-tx limit
    cat_map = dict(cat._mapping)
    if cat_map["per_tx_limit"] > 0 and amount > cat_map["per_tx_limit"]:
        raise HTTPException(status_code=422, detail=f"Amount exceeds per-transaction limit of {cat_map['per_tx_limit']} for this category.")

    # Iron Law 68: Negative till block
    current_balance = _compute_till_balance(dept_id, db)
    if current_balance - amount < 0:
        raise HTTPException(
            status_code=409,
            detail=f"[IRON LAW 68] Insufficient till balance. Current: {round(current_balance, 2)}, Requested: {amount}"
        )

    gl_debit = cat_map["gl_code"]                # Dr Expense GL
    dept = db.execute(text("SELECT gl_prefix FROM departments WHERE id=:id"), {"id": dept_id}).fetchone()
    pfx = dept[0] if dept else "000"
    gl_credit = f"1000-{pfx}"                   # Cr Till/Cash

    try:
        with db.begin_nested():
            tx_id = _new_id()
            batch_id = _get_or_create_open_batch(dept_id, db)

            db.execute(text("""
                INSERT INTO till_transactions
                (id, dept_id, type, amount, direction, category_id, category_name, description,
                 payment_method, staff_id, staff_name, batch_id, status, gl_debit, gl_credit, created_at)
                VALUES (:id, :dept_id, 'EXPENSE_CASH', :amount, 'OUT', :cat_id, :cat_name, :desc,
                        'CASH', :sid, :sname, :bid, 'ACTIVE', :gd, :gc, :ts)
            """), {
                "id": tx_id, "dept_id": dept_id, "amount": amount,
                "cat_id": category_id, "cat_name": cat_map["name"],
                "desc": data.get("note", cat_map["name"]),
                "sid": caller["id"], "sname": caller["username"],
                "bid": batch_id, "gd": gl_debit, "gc": gl_credit, "ts": _utcnow()
            })

            _post_ledger_entry(dept_id, batch_id, tx_id, gl_debit, gl_credit,
                               amount, f"Expense: {cat_map['name']}", db)
            _update_batch_after_tx(batch_id, "EXPENSE_CASH", amount, db)

        db.commit()
        new_balance = _compute_till_balance(dept_id, db)
        return {
            "status": "SUCCESS",
            "message": "Expense recorded.",
            "tx_id": tx_id,
            "category": cat_map["name"],
            "amount": amount,
            "new_till_balance": round(new_balance, 2),
            "gl_entry": f"Dr {gl_debit} / Cr {gl_credit}",
            "requires_pin": amount >= cat_map.get("requires_pin_above", 0) and cat_map.get("requires_pin_above", 0) > 0
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Expense entry failed: {str(e)}")


@router.post("/dept/{dept_id}/till/float")
def add_float(dept_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Manager/Dept Head: Add opening float or mid-shift cash drop."""
    caller = get_caller_info(data)
    if caller["role"] not in ("DEPT_HEAD", "DEPT_MANAGER", "WELLNESS_MANAGER", "GM", "ADMIN", "CDO"):
        raise HTTPException(status_code=403, detail="Float operations require Manager or higher authority.")

    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be positive.")

    float_type = data.get("float_type", "FLOAT_TOPUP").upper()
    if float_type not in ("FLOAT_TOPUP", "CASH_DROP"):
        raise HTTPException(status_code=422, detail="float_type must be FLOAT_TOPUP or CASH_DROP.")

    direction = "IN" if float_type == "FLOAT_TOPUP" else "OUT"

    # Iron Law 68: Block cash drop if would go negative
    if float_type == "CASH_DROP":
        _check_batch_gate(dept_id, db)
        balance = _compute_till_balance(dept_id, db)
        if balance - amount < 0:
            raise HTTPException(status_code=409, detail=f"[IRON LAW 68] Cannot drop more than till balance ({round(balance, 2)}).")

    dept = db.execute(text("SELECT gl_prefix FROM departments WHERE id=:id"), {"id": dept_id}).fetchone()
    pfx = dept[0] if dept else "000"

    try:
        with db.begin_nested():
            tx_id = _new_id()
            batch_id = _get_or_create_open_batch(dept_id, db)

            db.execute(text("""
                INSERT INTO till_transactions
                (id, dept_id, type, amount, direction, description, payment_method,
                 staff_id, staff_name, batch_id, status, gl_debit, gl_credit, created_at)
                VALUES (:id, :dept_id, :type, :amount, :dir, :desc, 'CASH',
                        :sid, :sname, :bid, 'ACTIVE', :gd, :gc, :ts)
            """), {
                "id": tx_id, "dept_id": dept_id, "type": float_type,
                "amount": amount, "dir": direction,
                "desc": data.get("note", float_type.replace("_", " ").title()),
                "sid": caller["id"], "sname": caller["username"],
                "bid": batch_id,
                "gd": f"1000-{pfx}" if direction == "IN" else "1050-000",  # Till or Safe
                "gc": "1050-000" if direction == "IN" else f"1000-{pfx}",
                "ts": _utcnow()
            })

            _post_ledger_entry(dept_id, batch_id, tx_id,
                               f"1000-{pfx}" if direction == "IN" else "1050-000",
                               "1050-000" if direction == "IN" else f"1000-{pfx}",
                               amount, float_type, db)
            _update_batch_after_tx(batch_id, float_type, amount, db)

        db.commit()
        return {
            "status": "SUCCESS",
            "message": f"{float_type} of {amount} recorded.",
            "tx_id": tx_id,
            "new_till_balance": round(_compute_till_balance(dept_id, db), 2)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dept/{dept_id}/till/void-initiate")
def initiate_void(dept_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Staff: Initiate void request. Reason code required. Iron Law 67."""
    caller = get_caller_info(data)
    tx_id = data.get("tx_id")
    reason_code = data.get("reason_code", "").upper()

    if not tx_id:
        raise HTTPException(status_code=422, detail="tx_id is required.")
    if reason_code not in VOID_REASON_CODES:
        raise HTTPException(status_code=422, detail=f"[IRON LAW 67] Invalid reason_code. Valid: {VOID_REASON_CODES}")

    tx = db.execute(
        text("SELECT * FROM till_transactions WHERE id = :id AND dept_id = :d"),
        {"id": tx_id, "d": dept_id}
    ).fetchone()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found in this department.")
    if tx._mapping["status"] == "VOIDED":
        raise HTTPException(status_code=409, detail="Transaction is already voided.")

    try:
        void_id = _new_id()
        db.execute(text("""
            INSERT INTO void_log
            (id, tx_id, dept_id, amount, reason, reason_code, requested_by, requested_by_name, requested_at)
            VALUES (:id, :tx_id, :dept_id, :amount, :reason, :rc, :rb, :rbn, :ts)
        """), {
            "id": void_id, "tx_id": tx_id, "dept_id": dept_id,
            "amount": tx._mapping["amount"],
            "reason": data.get("reason", reason_code),
            "rc": reason_code,
            "rb": caller["id"], "rbn": caller["username"],
            "ts": _utcnow()
        })
        db.commit()
        return {
            "status": "SUCCESS",
            "message": "Void request submitted. Awaiting Department Head approval.",
            "void_id": void_id,
            "tx_id": tx_id,
            "amount": tx._mapping["amount"]
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# SECTION 5: VOID MANAGEMENT (Dept Head approval chain)
# ==============================================================================

@router.get("/dept/{dept_id}/voids")
def list_voids(dept_id: str, status_filter: Optional[str] = None, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """List all voids for a department with full auth chain state."""
    where = "WHERE dept_id = :d"
    params: Dict[str, Any] = {"d": dept_id}
    if status_filter == "pending":
        where += " AND dept_head_approved = 0 AND accounts_eliminated = 0"
    elif status_filter == "approved":
        where += " AND dept_head_approved = 1"
    elif status_filter == "eliminated":
        where += " AND accounts_eliminated = 1"

    rows = db.execute(text(f"SELECT * FROM void_log {where} ORDER BY requested_at DESC"), params).fetchall()
    return {
        "status": "SUCCESS",
        "count": len(rows),
        "voids": [dict(r._mapping) for r in rows]
    }


@router.post("/void/{void_id}/dept-approve")
def dept_head_approve_void(void_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Dept Head: Approve a void. Marks the till transaction as VOIDED. Iron Law 67."""
    caller = get_caller_info(data)
    if caller["role"] not in ("DEPT_HEAD", "DEPT_MANAGER", "WELLNESS_MANAGER", "GM", "ADMIN", "CDO"):
        raise HTTPException(status_code=403, detail="Only Department Head or above can approve voids.")

    void_rec = db.execute(text("SELECT * FROM void_log WHERE id = :id"), {"id": void_id}).fetchone()
    if not void_rec:
        raise HTTPException(status_code=404, detail="Void record not found.")
    if void_rec._mapping["dept_head_approved"]:
        raise HTTPException(status_code=409, detail="Void already approved by department head.")

    try:
        with db.begin_nested():
            # Approve void
            db.execute(text("""
                UPDATE void_log SET dept_head_approved=1, dept_head_id=:uid, dept_head_at=:ts, dept_head_note=:note
                WHERE id=:id
            """), {"uid": caller["id"], "ts": _utcnow(), "note": data.get("note", ""), "id": void_id})

            # Mark till transaction as VOIDED
            db.execute(text("""
                UPDATE till_transactions SET status='VOIDED', voided_by=:uid, voided_at=:ts,
                void_reason=:reason, void_reason_code=:rc
                WHERE id=:tx_id
            """), {
                "uid": caller["id"], "ts": _utcnow(),
                "reason": data.get("note", ""), "rc": void_rec._mapping["reason_code"],
                "tx_id": void_rec._mapping["tx_id"]
            })

            # Update batch void counter
            tx = db.execute(text("SELECT batch_id FROM till_transactions WHERE id=:id"), {"id": void_rec._mapping["tx_id"]}).fetchone()
            if tx and tx[0]:
                db.execute(text("UPDATE tx_batches SET total_voids=total_voids+1, updated_at=:ts WHERE id=:bid"),
                           {"ts": _utcnow(), "bid": tx[0]})

        db.commit()

        # Check void escalation pattern (Iron Law 67 fraud detection)
        _check_void_pattern(void_rec._mapping["requested_by"], void_rec._mapping["dept_id"], db)

        return {"status": "SUCCESS", "message": "Void approved by Department Head. Awaiting Accounts elimination."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


def _check_void_pattern(staff_id: str, dept_id: str, db: Session):
    """Check if staff has exceeded void threshold — log escalation alert."""
    count = db.execute(text("""
        SELECT COUNT(*) FROM void_log
        WHERE requested_by=:sid AND dept_id=:d
        AND datetime(requested_at) >= datetime('now','-24 hours')
    """), {"sid": staff_id, "d": dept_id}).scalar() or 0
    if count >= 3:
        logger.warning(f"[DEPT-ACC] VOID ALERT: Staff {staff_id} has {count} voids in 24h at dept {dept_id}. GM/ACC should review.")


@router.post("/void/{void_id}/dept-reject")
def dept_head_reject_void(void_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Dept Head: Reject a void request. Transaction remains ACTIVE."""
    caller = get_caller_info(data)
    if caller["role"] not in ("DEPT_HEAD", "DEPT_MANAGER", "WELLNESS_MANAGER", "GM", "ADMIN", "CDO"):
        raise HTTPException(status_code=403, detail="Only Department Head or above can reject voids.")

    void_rec = db.execute(text("SELECT * FROM void_log WHERE id=:id"), {"id": void_id}).fetchone()
    if not void_rec:
        raise HTTPException(status_code=404, detail="Void record not found.")

    db.execute(text("""
        UPDATE void_log SET dept_head_approved=0, dept_head_id=:uid, dept_head_at=:ts, dept_head_note=:note
        WHERE id=:id
    """), {"uid": caller["id"], "ts": _utcnow(), "note": f"REJECTED: {data.get('note','')}", "id": void_id})
    db.commit()
    return {"status": "SUCCESS", "message": "Void rejected. Transaction remains active."}


# ==============================================================================
# SECTION 6: BATCH CONSENT & SUBMISSION
# ==============================================================================

@router.get("/dept/{dept_id}/batch/current")
def get_current_batch(dept_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get current batch state for a department."""
    # Step 1: Get the most recent batch (no JOIN, no COUNT - MySQL ONLY_FULL_GROUP_BY safe)
    batch = db.execute(text("""
        SELECT *
        FROM tx_batches
        WHERE dept_id = :d
        ORDER BY created_at DESC LIMIT 1
    """), {"d": dept_id}).fetchone()

    if not batch:
        return {"status": "SUCCESS", "batch": None}

    # Get transactions in this batch
    transactions = db.execute(text("""
        SELECT id, type, amount, direction, category_name, description,
               payment_method, staff_name, status, created_at
        FROM till_transactions WHERE batch_id = :bid
        ORDER BY created_at
    """), {"bid": batch._mapping["id"]}).fetchall()

    return {
        "status": "SUCCESS",
        "batch": {
            **dict(batch._mapping),
            "transactions": [dict(t._mapping) for t in transactions],
            "progress_pct": min(100, round((batch._mapping["tx_count"] / 20) * 100))
        }
    }


@router.post("/dept/{dept_id}/batch/consent")
def consent_batch(dept_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Dept Head: PIN-consent the current batch. Iron Law 65."""
    caller = get_caller_info(data)
    if caller["role"] not in ("DEPT_HEAD", "DEPT_MANAGER", "WELLNESS_MANAGER", "GM", "ADMIN", "CDO"):
        raise HTTPException(status_code=403, detail="Only Department Head can consent a batch.")

    pin = data.get("pin", "")
    if len(pin) < 4:
        raise HTTPException(status_code=422, detail="PIN must be at least 4 digits.")

    batch_id = data.get("batch_id")
    if not batch_id:
        # Auto-find the pending batch
        row = db.execute(
            text("SELECT id FROM tx_batches WHERE dept_id=:d AND status='PENDING_CONSENT' ORDER BY created_at DESC LIMIT 1"),
            {"d": dept_id}
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No batch pending consent for this department.")
        batch_id = row[0]

    batch = db.execute(text("SELECT * FROM tx_batches WHERE id=:id"), {"id": batch_id}).fetchone()
    if not batch or batch._mapping["status"] != "PENDING_CONSENT":
        raise HTTPException(status_code=409, detail="Batch is not in PENDING_CONSENT state.")

    try:
        pin_hash = _hash_pin(pin)
        db.execute(text("""
            UPDATE tx_batches SET status='CONSENTED', dept_head_id=:uid, dept_head_name=:uname,
            consent_at=:ts, consent_pin_hash=:pin_hash, updated_at=:ts
            WHERE id=:id
        """), {
            "uid": caller["id"], "uname": caller["username"],
            "ts": _utcnow(), "pin_hash": pin_hash, "id": batch_id
        })
        # Update ledger entry statuses to DEPT_APPROVED
        db.execute(text("""
            UPDATE dept_ledger_entries SET status='DEPT_APPROVED'
            WHERE batch_id=:bid AND status='DRAFT'
        """), {"bid": batch_id})
        db.commit()
        return {
            "status": "SUCCESS",
            "message": "Batch consented. Ready to submit to Ledger Auth Gateway.",
            "batch_id": batch_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dept/{dept_id}/batch/submit")
def submit_batch_to_gateway(dept_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Dept Head: Submit a consented batch to the Ledger Auth Gateway."""
    caller = get_caller_info(data)
    if caller["role"] not in ("DEPT_HEAD", "DEPT_MANAGER", "WELLNESS_MANAGER", "GM", "ADMIN", "CDO"):
        raise HTTPException(status_code=403, detail="Only Department Head can submit batches to Gateway.")

    batch_id = data.get("batch_id")
    if not batch_id:
        row = db.execute(
            text("SELECT id FROM tx_batches WHERE dept_id=:d AND status='CONSENTED' ORDER BY created_at DESC LIMIT 1"),
            {"d": dept_id}
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No consented batch found. Please consent a batch first.")
        batch_id = row[0]

    batch = db.execute(text("SELECT * FROM tx_batches WHERE id=:id"), {"id": batch_id}).fetchone()
    if not batch or batch._mapping["status"] != "CONSENTED":
        raise HTTPException(status_code=409, detail="Batch must be in CONSENTED state before submission.")

    try:
        db.execute(text("""
            UPDATE tx_batches SET status='SUBMITTED', updated_at=:ts WHERE id=:id
        """), {"ts": _utcnow(), "id": batch_id})
        db.commit()

        # Open a fresh batch for the department
        new_batch_id = _new_id()
        next_num = (batch._mapping["batch_number"] or 0) + 1
        db.execute(text("""
            INSERT INTO tx_batches (id, dept_id, batch_number, tx_count, status, created_at, updated_at)
            VALUES (:id, :dept_id, :bn, 0, 'OPEN', :ts, :ts)
        """), {"id": new_batch_id, "dept_id": dept_id, "bn": next_num, "ts": _utcnow()})
        db.commit()

        return {
            "status": "SUCCESS",
            "message": "Batch submitted to Ledger Auth Gateway.",
            "submitted_batch_id": batch_id,
            "new_batch_id": new_batch_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# SECTION 7: LEDGER AUTH GATEWAY (Z-1B — Accounts Review Layer)
# ==============================================================================

@router.get("/gateway/queue")
def gateway_queue(
    dept_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get all submitted batches in the gateway queue. ACC/GM/CDO."""
    where_clauses = ["b.status IN ('SUBMITTED','QUERIED','APPROVED','REJECTED','POSTED')"]
    params: Dict[str, Any] = {}
    if dept_id:
        where_clauses.append("b.dept_id = :dept_id")
        params["dept_id"] = dept_id
    if status_filter:
        where_clauses.append("b.status = :sf")
        params["sf"] = status_filter.upper()

    where = "WHERE " + " AND ".join(where_clauses)
    rows = db.execute(text(f"""
        SELECT b.id, b.dept_id, d.name as dept_name, b.batch_number,
               b.tx_count, b.total_revenue, b.total_expense, b.total_voids,
               b.status, b.dept_head_name, b.consent_at,
               b.gateway_reviewer, b.gateway_action, b.gateway_note, b.gateway_at,
               b.posted_at, b.created_at
        FROM tx_batches b
        LEFT JOIN departments d ON d.id = b.dept_id
        {where}
        ORDER BY b.created_at DESC
    """), params).fetchall()

    # Pending void count for header KPI
    pending_voids = db.execute(text("""
        SELECT COUNT(*) FROM void_log WHERE dept_head_approved=1 AND accounts_eliminated=0
    """)).scalar() or 0

    return {
        "status": "SUCCESS",
        "pending_voids_total": pending_voids,
        "count": len(rows),
        "batches": [dict(r._mapping) for r in rows]
    }


@router.get("/gateway/batch/{batch_id}/detail")
def gateway_batch_detail(batch_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get full batch detail: all transactions + double-entry ledger preview."""
    batch = db.execute(text("""
        SELECT b.*, d.name as dept_name, d.gl_prefix, d.currency
        FROM tx_batches b LEFT JOIN departments d ON d.id=b.dept_id
        WHERE b.id=:id
    """), {"id": batch_id}).fetchone()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    transactions = db.execute(text("""
        SELECT * FROM till_transactions WHERE batch_id=:bid ORDER BY created_at
    """), {"bid": batch_id}).fetchall()

    ledger_entries = db.execute(text("""
        SELECT * FROM dept_ledger_entries WHERE batch_id=:bid ORDER BY created_at
    """), {"bid": batch_id}).fetchall()

    voids_in_batch = db.execute(text("""
        SELECT v.* FROM void_log v
        JOIN till_transactions t ON t.id=v.tx_id
        WHERE t.batch_id=:bid
    """), {"bid": batch_id}).fetchall()

    return {
        "status": "SUCCESS",
        "batch": dict(batch._mapping),
        "transactions": [dict(t._mapping) for t in transactions],
        "ledger_entries": [dict(e._mapping) for e in ledger_entries],
        "voids": [dict(v._mapping) for v in voids_in_batch]
    }


@router.post("/gateway/batch/{batch_id}/approve")
def gateway_approve_batch(batch_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Accounts: Approve batch → auto-posts all entries to Master Ledger. Iron Law 66."""
    caller = get_caller_info(data)
    if caller["role"] not in ("ACCOUNTS", "ACC", "CDO", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only Accounts/CDO can approve gateway batches.")

    batch = db.execute(text("SELECT * FROM tx_batches WHERE id=:id"), {"id": batch_id}).fetchone()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    if batch._mapping["status"] not in ("SUBMITTED", "QUERIED"):
        raise HTTPException(status_code=409, detail="Batch must be in SUBMITTED or QUERIED state.")

    force_approve = caller["role"] == "CDO" and data.get("force_approve", False)
    force_reason = data.get("force_reason", "")
    if force_approve and len(force_reason) < 10:
        raise HTTPException(status_code=422, detail="CDO force-approval requires a reason (min 10 chars).")

    try:
        with db.begin_nested():
            now = _utcnow()

            # Get all ledger entries for this batch
            entries = db.execute(text("""
                SELECT * FROM dept_ledger_entries WHERE batch_id=:bid
            """), {"bid": batch_id}).fetchall()

            # Iron Law 66: APPEND-ONLY to master_ledger — no UPDATE/DELETE ever
            for entry in entries:
                e = dict(entry._mapping)
                db.execute(text("""
                    INSERT INTO master_ledger
                    (id, dept_id, batch_id, tx_id, debit_account, credit_account, amount,
                     narration, entry_date, posted_by, posted_at, is_void, is_force_approved,
                     force_approved_by, force_approved_reason)
                    VALUES (:id, :dept_id, :batch_id, :tx_id, :debit, :credit, :amount,
                            :narration, :edate, :posted_by, :posted_at, 0, :fa, :fab, :far)
                """), {
                    "id": _new_id(), "dept_id": e["dept_id"], "batch_id": batch_id,
                    "tx_id": e["tx_id"], "debit": e["debit_account"], "credit": e["credit_account"],
                    "amount": e["amount"], "narration": e["narration"],
                    "edate": e["entry_date"] or now[:10],
                    "posted_by": caller["username"], "posted_at": now,
                    "fa": 1 if force_approve else 0,
                    "fab": caller["username"] if force_approve else None,
                    "far": force_reason if force_approve else None
                })

            # Update dept_ledger_entries to POSTED
            db.execute(text("""
                UPDATE dept_ledger_entries SET status='POSTED' WHERE batch_id=:bid
            """), {"bid": batch_id})

            # Update batch status
            db.execute(text("""
                UPDATE tx_batches SET status='POSTED', gateway_reviewer=:reviewer,
                gateway_action='APPROVED', gateway_at=:ts, posted_by=:reviewer, posted_at=:ts, updated_at=:ts
                WHERE id=:id
            """), {"reviewer": caller["username"], "ts": now, "id": batch_id})

        db.commit()
        return {
            "status": "SUCCESS",
            "message": f"Batch approved. {len(entries)} entries posted to Master Ledger.",
            "batch_id": batch_id,
            "entries_posted": len(entries),
            "force_approved": force_approve
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Gateway approval failed: {str(e)}")


@router.post("/gateway/batch/{batch_id}/query")
def gateway_query_batch(batch_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Accounts: Query a batch — returns to dept head with a question."""
    caller = get_caller_info(data)
    if caller["role"] not in ("ACCOUNTS", "ACC", "CDO", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only Accounts/CDO can query batches.")

    note = data.get("note", "")
    if len(note) < 5:
        raise HTTPException(status_code=422, detail="Query note must be at least 5 characters.")

    db.execute(text("""
        UPDATE tx_batches SET status='QUERIED', gateway_reviewer=:reviewer,
        gateway_action='QUERIED', gateway_note=:note, gateway_at=:ts, updated_at=:ts
        WHERE id=:id
    """), {"reviewer": caller["username"], "note": note, "ts": _utcnow(), "id": batch_id})
    db.commit()
    return {"status": "SUCCESS", "message": "Batch queried. Returned to Department Head for response."}


@router.post("/gateway/batch/{batch_id}/reject")
def gateway_reject_batch(batch_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Accounts: Reject a batch — returns to dept head for correction."""
    caller = get_caller_info(data)
    if caller["role"] not in ("ACCOUNTS", "ACC", "CDO", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only Accounts/CDO can reject batches.")

    note = data.get("note", "")
    if len(note) < 10:
        raise HTTPException(status_code=422, detail="Rejection reason must be at least 10 characters.")

    db.execute(text("""
        UPDATE tx_batches SET status='REJECTED', gateway_reviewer=:reviewer,
        gateway_action='REJECTED', gateway_note=:note, gateway_at=:ts, updated_at=:ts
        WHERE id=:id
    """), {"reviewer": caller["username"], "note": note, "ts": _utcnow(), "id": batch_id})
    db.commit()
    return {"status": "SUCCESS", "message": "Batch rejected. Returned to Department Head."}


@router.post("/gateway/void/{void_id}/eliminate")
def eliminate_void(void_id: str, data: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Accounts: Eliminate an approved void from the primary ledger. Iron Law 67."""
    caller = get_caller_info(data)
    if caller["role"] not in ("ACCOUNTS", "ACC", "CDO", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only Accounts/CDO can eliminate voids.")

    void_rec = db.execute(text("SELECT * FROM void_log WHERE id=:id"), {"id": void_id}).fetchone()
    if not void_rec:
        raise HTTPException(status_code=404, detail="Void record not found.")
    if not void_rec._mapping["dept_head_approved"]:
        raise HTTPException(status_code=409, detail="Void must be approved by Department Head before Accounts can eliminate it.")
    if void_rec._mapping["accounts_eliminated"]:
        raise HTTPException(status_code=409, detail="Void already eliminated.")

    try:
        with db.begin_nested():
            now = _utcnow()
            # Post contra entry to master ledger (Iron Law 66 - append only)
            tx = db.execute(text("SELECT * FROM till_transactions WHERE id=:id"),
                            {"id": void_rec._mapping["tx_id"]}).fetchone()
            if tx:
                t = dict(tx._mapping)
                dept = db.execute(text("SELECT gl_prefix FROM departments WHERE id=:id"),
                                  {"id": t["dept_id"]}).fetchone()
                pfx = dept[0] if dept else "000"
                db.execute(text("""
                    INSERT INTO master_ledger
                    (id, dept_id, batch_id, tx_id, debit_account, credit_account,
                     amount, narration, entry_date, posted_by, posted_at, is_void, void_ref)
                    VALUES (:id, :dept_id, :bid, :tx_id, :debit, :credit,
                            :amount, :narration, :date, :posted_by, :ts, 1, :void_ref)
                """), {
                    "id": _new_id(), "dept_id": t["dept_id"],
                    "bid": t.get("batch_id"), "tx_id": t["id"],
                    # Reverse the original debit/credit
                    "debit": t.get("gl_credit", f"4900-{pfx}"),
                    "credit": t.get("gl_debit", f"1000-{pfx}"),
                    "amount": t["amount"],
                    "narration": f"VOID ELIMINATION: {void_rec._mapping['reason_code']}",
                    "date": now[:10], "posted_by": caller["username"], "ts": now,
                    "void_ref": void_id
                })

            # Mark void as eliminated
            db.execute(text("""
                UPDATE void_log SET accounts_eliminated=1, eliminated_by=:uid, eliminated_at=:ts
                WHERE id=:id
            """), {"uid": caller["username"], "ts": now, "id": void_id})

            # Update dept_ledger_entries for the voided tx
            db.execute(text("""
                UPDATE dept_ledger_entries SET status='ELIMINATED' WHERE tx_id=:tx_id
            """), {"tx_id": void_rec._mapping["tx_id"]})

        db.commit()
        return {"status": "SUCCESS", "message": "Void eliminated from primary ledger. Contra entry posted to Master Ledger."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# SECTION 8: DEPARTMENT P&L + REPORTS
# ==============================================================================

@router.get("/dept/{dept_id}/pl")
def dept_pl(
    dept_id: str,
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get live Department P&L. Defaults to current month."""
    dept = db.execute(text("SELECT * FROM departments WHERE id=:id"), {"id": dept_id}).fetchone()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    today = date.today()
    start = period_start or today.replace(day=1).isoformat()
    end = period_end or today.isoformat()

    summary = db.execute(text("""
        SELECT
            COALESCE(SUM(CASE WHEN direction='IN'  AND type LIKE 'REVENUE%' AND status='ACTIVE' THEN amount ELSE 0 END),0) as gross_revenue,
            COALESCE(SUM(CASE WHEN direction='OUT' AND type='EXPENSE_CASH' AND status='ACTIVE' THEN amount ELSE 0 END),0) as total_expenses,
            COALESCE(SUM(CASE WHEN direction='IN'  AND type='FLOAT_TOPUP'  AND status='ACTIVE' THEN amount ELSE 0 END),0) as total_floats,
            COALESCE(SUM(CASE WHEN direction='OUT' AND type='CASH_DROP'    AND status='ACTIVE' THEN amount ELSE 0 END),0) as total_drops,
            COUNT(CASE WHEN status='VOIDED' THEN 1 END) as void_count,
            COALESCE(SUM(CASE WHEN status='VOIDED' THEN amount ELSE 0 END),0) as void_amount
        FROM till_transactions
        WHERE dept_id=:d AND DATE(created_at) BETWEEN :s AND :e
    """), {"d": dept_id, "s": start, "e": end}).fetchone()

    # Expense breakdown by category
    by_category = db.execute(text("""
        SELECT category_name, SUM(amount) as total
        FROM till_transactions
        WHERE dept_id=:d AND type='EXPENSE_CASH' AND status='ACTIVE'
        AND DATE(created_at) BETWEEN :s AND :e
        GROUP BY category_name ORDER BY total DESC
    """), {"d": dept_id, "s": start, "e": end}).fetchall()

    # Revenue breakdown by type
    by_rev_type = db.execute(text("""
        SELECT payment_method, SUM(amount) as total
        FROM till_transactions
        WHERE dept_id=:d AND direction='IN' AND type LIKE 'REVENUE%' AND status='ACTIVE'
        AND DATE(created_at) BETWEEN :s AND :e
        GROUP BY payment_method ORDER BY total DESC
    """), {"d": dept_id, "s": start, "e": end}).fetchall()

    gross_revenue = float(summary[0])
    total_expenses = float(summary[1])
    void_amount = float(summary[5])
    net_revenue = gross_revenue - void_amount
    net_income = net_revenue - total_expenses

    return {
        "status": "SUCCESS",
        "dept_id": dept_id,
        "dept_name": dept._mapping["name"],
        "period": {"start": start, "end": end},
        "pl": {
            "gross_revenue": round(gross_revenue, 2),
            "void_adjustments": round(void_amount, 2),
            "net_revenue": round(net_revenue, 2),
            "total_expenses": round(total_expenses, 2),
            "net_operating_income": round(net_income, 2),
            "gross_margin_pct": round((net_revenue / gross_revenue * 100) if gross_revenue else 0, 1),
            "void_count": int(summary[4])
        },
        "revenue_by_method": [{"method": r[0], "amount": round(float(r[1]), 2)} for r in by_rev_type],
        "expenses_by_category": [{"category": r[0], "amount": round(float(r[1]), 2)} for r in by_category]
    }


@router.get("/master/ledger")
def master_ledger_view(
    dept_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """View Master Ledger entries. ACC/GM/CDO only. Iron Law 66 — read only."""
    where = "WHERE 1=1"
    params: Dict[str, Any] = {"limit": limit, "offset": offset}
    if dept_id:
        where += " AND dept_id = :dept_id"
        params["dept_id"] = dept_id

    rows = db.execute(text(f"""
        SELECT m.*, d.name as dept_name
        FROM master_ledger m
        LEFT JOIN departments d ON d.id=m.dept_id
        {where}
        ORDER BY m.posted_at DESC
        LIMIT :limit OFFSET :offset
    """), params).fetchall()

    total = db.execute(text(f"SELECT COUNT(*) FROM master_ledger {where}"), params).scalar() or 0

    return {
        "status": "SUCCESS",
        "total": total,
        "offset": offset,
        "limit": limit,
        "entries": [dict(r._mapping) for r in rows]
    }


@router.get("/master/trial-balance")
def trial_balance(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Generate trial balance from master ledger across all departments."""
    rows = db.execute(text("""
        SELECT
            debit_account as account,
            SUM(amount) as debit_total,
            0 as credit_total
        FROM master_ledger WHERE is_void=0
        GROUP BY debit_account
        UNION ALL
        SELECT
            credit_account as account,
            0 as debit_total,
            SUM(amount) as credit_total
        FROM master_ledger WHERE is_void=0
        GROUP BY credit_account
        ORDER BY account
    """)).fetchall()

    # Consolidate by account
    accounts: Dict[str, Dict] = {}
    for row in rows:
        acct = row[0]
        if acct not in accounts:
            accounts[acct] = {"account": acct, "debit": 0.0, "credit": 0.0}
        accounts[acct]["debit"] += float(row[1])
        accounts[acct]["credit"] += float(row[2])

    total_debit = sum(a["debit"] for a in accounts.values())
    total_credit = sum(a["credit"] for a in accounts.values())

    return {
        "status": "SUCCESS",
        "balanced": abs(total_debit - total_credit) < 0.01,
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
        "variance": round(total_debit - total_credit, 2),
        "accounts": [
            {"account": a["account"], "debit": round(a["debit"], 2), "credit": round(a["credit"], 2),
             "net": round(a["debit"] - a["credit"], 2)}
            for a in sorted(accounts.values(), key=lambda x: x["account"])
        ]
    }


@router.get("/master/pl-comparison")
def pl_comparison(
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Cross-department P&L comparison. ACC/GM/CDO."""
    today = date.today()
    start = period_start or today.replace(day=1).isoformat()
    end = period_end or today.isoformat()

    depts = db.execute(text("SELECT id, name FROM departments WHERE active=1")).fetchall()
    results = []
    for dept in depts:
        dept_id = dept[0]
        s = db.execute(text("""
            SELECT
                COALESCE(SUM(CASE WHEN direction='IN'  AND type LIKE 'REVENUE%' AND status='ACTIVE' THEN amount ELSE 0 END),0),
                COALESCE(SUM(CASE WHEN direction='OUT' AND type='EXPENSE_CASH' AND status='ACTIVE' THEN amount ELSE 0 END),0),
                COUNT(CASE WHEN status='VOIDED' THEN 1 END),
                COALESCE(SUM(CASE WHEN status='VOIDED' THEN amount ELSE 0 END),0)
            FROM till_transactions
            WHERE dept_id=:d AND DATE(created_at) BETWEEN :s AND :e
        """), {"d": dept_id, "s": start, "e": end}).fetchone()
        rev = float(s[0]); exp = float(s[1]); void_amt = float(s[3])
        net = (rev - void_amt) - exp
        results.append({
            "dept_id": dept_id,
            "dept_name": dept[1],
            "gross_revenue": round(rev, 2),
            "total_expenses": round(exp, 2),
            "void_amount": round(void_amt, 2),
            "net_income": round(net, 2),
            "margin_pct": round((net / rev * 100) if rev else 0, 1)
        })

    results.sort(key=lambda x: x["net_income"], reverse=True)
    return {
        "status": "SUCCESS",
        "period": {"start": start, "end": end},
        "departments": results,
        "totals": {
            "gross_revenue": round(sum(r["gross_revenue"] for r in results), 2),
            "total_expenses": round(sum(r["total_expenses"] for r in results), 2),
            "net_income": round(sum(r["net_income"] for r in results), 2)
        }
    }


@router.get("/master/void-report")
def void_report(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Consolidated void analysis across all departments."""
    rows = db.execute(text("""
        SELECT v.*, d.name as dept_name, t.amount as tx_amount, t.type as tx_type
        FROM void_log v
        LEFT JOIN departments d ON d.id=v.dept_id
        LEFT JOIN till_transactions t ON t.id=v.tx_id
        ORDER BY v.requested_at DESC
        LIMIT 200
    """)).fetchall()

    pending = [r for r in rows if not r._mapping["dept_head_approved"]]
    approved_not_eliminated = [r for r in rows if r._mapping["dept_head_approved"] and not r._mapping["accounts_eliminated"]]
    eliminated = [r for r in rows if r._mapping["accounts_eliminated"]]

    return {
        "status": "SUCCESS",
        "summary": {
            "total_voids": len(rows),
            "pending_dept_approval": len(pending),
            "pending_elimination": len(approved_not_eliminated),
            "eliminated": len(eliminated),
            "total_void_amount": round(sum(float(r._mapping.get("amount", 0)) for r in rows), 2)
        },
        "pending": [dict(r._mapping) for r in pending],
        "pending_elimination": [dict(r._mapping) for r in approved_not_eliminated],
        "eliminated": [dict(r._mapping) for r in eliminated[:50]]
    }
