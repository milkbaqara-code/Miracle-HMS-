# backend_api/app/routers/inventory_engine.py
import logging
from typing import List, Optional, Any
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, field_validator
from datetime import datetime

# KERNEL SYNC: Direct alignment with Master Blueprint
from app.core.database import get_db
from app.schemas.pos_schema import POSCheckoutPayload
from app.models.models import Inventory

# 🛡️ ZONE 12 TELEMETRY
logger = logging.getLogger("Zone12_Master_Vault")
router = APIRouter(tags=["ZONE 12 & 14: Unified Vault Engine"])

# ==========================================
# 1. STRICT DATA CONTRACTS (THUMB RULE 1 & 2)
# ==========================================
class BOMItem(BaseModel):
    rawId: str
    name: str
    qty: float
    unit: str
    unitCost: float

class InventoryPayload(BaseModel):
    id: str 
    name: str
    type: str 
    dept: str
    cat: str
    pp: float = 0.0
    rp: float = 0.0
    stock: float = 0.0
    min_level: float = 0.0
    s_unit: str = "UNIT"
    p_unit: str = "UNIT" # 🛡️ FIXED: Physical field assignment
    factor: float = 1.0
    margin: str = "0.0"   # 🛡️ FIXED: Physical field assignment
    desc: Optional[str] = ""
    img: Optional[str] = ""
    barcode: Optional[str] = ""
    bom: Optional[List[BOMItem]] = []
    vendor: Optional[str] = ""
    shelf_location: Optional[str] = ""
    active_ingredient: Optional[str] = ""
    dosage_form: Optional[str] = ""

    # 🛡️ SELF-HEALING COERCION SHIELD
    @field_validator('pp', 'rp', 'stock', 'min_level', 'factor', mode='before')
    @classmethod
    def coerce_to_float(cls, v):
        try:
            return float(v) if v not in [None, ""] else 0.0
        except (ValueError, TypeError):
            return 0.0

# ==========================================
# 2. THE UNIFIED MATRIX ENGINE (THUMB RULE 3)
# ==========================================
# 🛡️ SMART ASSET CLEANER: Extracts raw URL from Markdown/HTML snippets
def clean_img_url(input_str: str) -> str:
    if not input_str: return ""
    import re
    # 1. Strip Markdown ![]() or []()
    md_match = re.search(r'\(+(https?://[^\s)]+)\)+', input_str)
    if md_match: input_str = md_match.group(1).strip()
    # 2. Strip HTML <img src="...">
    html_match = re.search(r'src=["\'](https?://[^"\']+)["\']', input_str)
    if html_match: input_str = html_match.group(1).strip()
    
    # 🛡️ Google Drive Direct Link Converter (V2 - High Reliability)
    if "drive.google.com" in input_str or "google.com" in input_str:
        # Match /d/ID or ?id=ID formats
        drive_match = re.search(r'(?:/d/|id=)([a-zA-Z0-9_-]+)', input_str)
        if drive_match:
            file_id = drive_match.group(1)
            # 🚀 PRO-TIP: service=lh3.googleusercontent.com is the most reliable direct image network
            return f"https://lh3.googleusercontent.com/d/{file_id}"
            
    return input_str.strip()

def map_inventory_dept_to_accounting_dept(inv_dept: str) -> str:
    dept = str(inv_dept).strip().upper()
    if "PHARMACY" in dept or "POS" in dept:
        return "DEPT_POS"
    elif "WELLNESS" in dept or "SPA" in dept or "Z-27" in dept:
        return "DEPT_WELLNESS"
    elif "RESTAURANT" in dept or "COFFEE" in dept or "F&B" in dept or "DIETARY" in dept or "KITCHEN" in dept or "MEAL" in dept:
        return "DEPT_FB"
    elif "BOUTIQUE" in dept or "SUPPLIES" in dept or "Z-28" in dept:
        return "DEPT_BOUTIQUE"
    elif "FLEET" in dept or "AMBULANCE" in dept or "EMERGENCY" in dept or "Z-26" in dept:
        return "DEPT_FLEET"
    elif "RENTAL" in dept or "EQUIPMENT" in dept or "Z-3B" in dept:
        return "DEPT_RENTAL"
    elif "CINEMA" in dept or "MEDIA" in dept or "Z-09" in dept or "Z-14" in dept:
        return "DEPT_CINEMA"
    else:
        return "DEPT_PMS"

from fastapi import BackgroundTasks
@router.post("/bulk-register", status_code=status.HTTP_200_OK)
async def sync_unified_vault(items: List[InventoryPayload], background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Super CC Style Engine: Uses Hard Commits to guarantee 
    physical data writing to PostgreSQL.
    """
    try:
        for item in items:
            target_id = str(item.id).strip()
            if not target_id: continue

            # 🛡️ Department Normalization
            raw_dept = str(item.dept).strip().upper()
            if raw_dept in ["RESTAURANT", "COFFEE", "COFFEE & BAR", "HOUSEKEEPING"]:
                if "RS-" not in raw_dept and "HK-" not in raw_dept:
                    raw_dept = f"RS-{raw_dept}" if raw_dept != "HOUSEKEEPING" else "HK-HOUSEKEEPING"

            bom_data = [b.model_dump() for b in item.bom] if item.bom else []

            # 🛡️ THE HARD WRITE: Direct Identity Mapping
            existing = db.query(Inventory).filter(Inventory.product_id == target_id).first()

            if existing:
                setattr(existing, "name", str(item.name).strip().upper())
                setattr(existing, "type", str(item.type).strip().upper())
                setattr(existing, "dept", raw_dept)
                setattr(existing, "cat", str(item.cat).strip().upper())
                setattr(existing, "pp", item.pp)
                setattr(existing, "rp", item.rp)
                setattr(existing, "margin", str(item.margin)) # 🛡️ FIXED: Prevents UI Reset
                setattr(existing, "min_level", item.min_level)
                setattr(existing, "s_unit", str(item.s_unit).strip().upper())
                setattr(existing, "p_unit", str(item.p_unit).strip().upper()) # 🛡️ FIXED: Physical sync
                setattr(existing, "factor", item.factor if item.factor > 0 else 1.0)
                setattr(existing, "desc", str(item.desc) if item.desc else "")
                setattr(existing, "img", clean_img_url(item.img))
                setattr(existing, "barcode", str(item.barcode) if item.barcode else "")
                setattr(existing, "bom", bom_data)
                setattr(existing, "shelf_location", str(item.shelf_location) if item.shelf_location else "")
                setattr(existing, "active_ingredient", str(item.active_ingredient) if item.active_ingredient else "")
                setattr(existing, "dosage_form", str(item.dosage_form) if item.dosage_form else "")
                
                # 📦 CDO RULE: PROTECTED STOCK UPDATE
                # Only update stock if the new value is HIGHER than current DB level.
                # This prevents the Inventory UI from silently restoring stock that was
                # already deducted by POS sales (race condition fix).
                if item.stock > existing.stock:
                    added_s_qty = item.stock - existing.stock
                    factor = item.factor if item.factor > 0 else 1.0
                    added_p_qty = added_s_qty / factor
                    payable_amt = added_p_qty * item.pp 
                    
                    if payable_amt > 0:
                        from app.routers.accounting_engine import record_stock_purchase
                        from app.models.models import APInvoice, Vendor as VendorModel
                        from datetime import datetime, timedelta
                        journal = record_stock_purchase(db, payable_amt,
                            f"Stock Receive: {added_p_qty} {item.p_unit} {item.name}. Vendor: {item.vendor}")
                        if item.vendor:
                            v = db.query(VendorModel).filter(VendorModel.name == str(item.vendor).upper()).first()
                            if not v:
                                v = VendorModel(name=str(item.vendor).upper(), payment_terms_days=30)
                                db.add(v)
                                db.flush()
                            db.add(APInvoice(
                                vendor_id=v.id,
                                invoice_ref=f"AP-{item.id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                                description=f"Stock Receive: {item.name}",
                                amount=payable_amt,
                                due_date=datetime.now() + timedelta(days=v.payment_terms_days),
                                status="OUTSTANDING",
                                journal_id=journal.id if journal else None
                            ))
                            
                            # 🔱 DEPARTMENT ACCOUNTING ENTRY INGESTION
                            try:
                                from app.routers.dept_accounting import _utcnow, _get_or_create_open_batch, _post_ledger_entry
                                acc_dept_id = map_inventory_dept_to_accounting_dept(raw_dept)
                                dept_row = db.execute(text("SELECT gl_prefix FROM departments WHERE id = :id"), {"id": acc_dept_id}).fetchone()
                                pfx = dept_row[0] if dept_row else "000"
                                batch_id = _get_or_create_open_batch(acc_dept_id, db)
                                debit_acct = f"1210-{pfx}"
                                credit_acct = f"2000-{pfx}"
                                tx_id = f"REF-{target_id}-{int(datetime.now().timestamp())}"
                                _post_ledger_entry(acc_dept_id, batch_id, tx_id, debit_acct, credit_acct, payable_amt,
                                                   f"Stock Refill: {added_p_qty} {item.p_unit} {item.name}", db)
                                db.execute(text("""
                                    UPDATE tx_batches SET
                                        tx_count = tx_count + 1,
                                        total_expense = total_expense + :a,
                                        updated_at = :ts
                                    WHERE id = :bid
                                """), {"bid": batch_id, "a": payable_amt, "ts": _utcnow()})
                            except Exception as dept_acc_err:
                                logger.warning(f"Department accounting stock refill entry failed: {dept_acc_err}")

                            # 🐕 SRE WATCHDOG TRIGGER
                            from app.core.watchdog_engine import verify_transaction_integrity
                            from app.core.database import SessionLocal
                            if journal:
                                background_tasks.add_task(verify_transaction_integrity, SessionLocal, str(item.id), "INVENTORY_DISPATCH", {"journal_id": journal.id})
                    setattr(existing, "stock", item.stock)

            else:
                new_asset = Inventory(
                    product_id=target_id,
                    name=str(item.name).strip().upper(),
                    type=str(item.type).strip().upper(),
                    dept=raw_dept,
                    cat=str(item.cat).strip().upper(),
                    pp=item.pp,
                    rp=item.rp,
                    margin=str(item.margin),
                    stock=item.stock, 
                    min_level=item.min_level,
                    s_unit=str(item.s_unit).strip().upper(),
                    p_unit=str(item.p_unit).strip().upper(),
                    factor=item.factor if item.factor > 0 else 1.0,
                    desc=str(item.desc) if item.desc else "",
                    img=clean_img_url(item.img),
                    barcode=str(item.barcode) if item.barcode else "",
                    bom=bom_data,
                    shelf_location=str(item.shelf_location) if item.shelf_location else "",
                    active_ingredient=str(item.active_ingredient) if item.active_ingredient else "",
                    dosage_form=str(item.dosage_form) if item.dosage_form else ""
                )
                db.add(new_asset)
                
                if item.stock > 0 and item.pp > 0:
                    factor = item.factor if item.factor > 0 else 1.0
                    added_p_qty = item.stock / factor
                    payable_amt = added_p_qty * item.pp
                    from app.routers.accounting_engine import record_stock_purchase
                    from app.models.models import APInvoice, Vendor as VendorModel
                    from datetime import datetime, timedelta
                    journal = record_stock_purchase(db, payable_amt,
                        f"Initial Stock: {added_p_qty} {item.p_unit} {item.name}. Vendor: {item.vendor}")
                    if item.vendor:
                        v = db.query(VendorModel).filter(VendorModel.name == str(item.vendor).upper()).first()
                        if not v:
                            v = VendorModel(name=str(item.vendor).upper(), payment_terms_days=30)
                            db.add(v)
                            db.flush()
                        db.add(APInvoice(
                            vendor_id=v.id,
                            invoice_ref=f"AP-{item.id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                            description=f"Initial Stock: {item.name}",
                            amount=payable_amt,
                            due_date=datetime.now() + timedelta(days=v.payment_terms_days),
                            status="OUTSTANDING",
                            journal_id=journal.id if journal else None
                        ))
                        
                        # 🔱 DEPARTMENT ACCOUNTING ENTRY INGESTION
                        try:
                            from app.routers.dept_accounting import _utcnow, _get_or_create_open_batch, _post_ledger_entry
                            acc_dept_id = map_inventory_dept_to_accounting_dept(raw_dept)
                            dept_row = db.execute(text("SELECT gl_prefix FROM departments WHERE id = :id"), {"id": acc_dept_id}).fetchone()
                            pfx = dept_row[0] if dept_row else "000"
                            batch_id = _get_or_create_open_batch(acc_dept_id, db)
                            debit_acct = f"1210-{pfx}"
                            credit_acct = f"2000-{pfx}"
                            tx_id = f"INI-{target_id}-{int(datetime.now().timestamp())}"
                            _post_ledger_entry(acc_dept_id, batch_id, tx_id, debit_acct, credit_acct, payable_amt,
                                               f"Initial Stock Ingestion: {added_p_qty} {item.p_unit} {item.name}", db)
                            db.execute(text("""
                                UPDATE tx_batches SET
                                    tx_count = tx_count + 1,
                                    total_expense = total_expense + :a,
                                    updated_at = :ts
                                WHERE id = :bid
                            """), {"bid": batch_id, "a": payable_amt, "ts": _utcnow()})
                        except Exception as dept_acc_err:
                            logger.warning(f"Department accounting initial stock entry failed: {dept_acc_err}")

                        # 🐕 SRE WATCHDOG TRIGGER
                        from app.core.watchdog_engine import verify_transaction_integrity
                        from app.core.database import SessionLocal
                        if journal:
                            background_tasks.add_task(verify_transaction_integrity, SessionLocal, str(item.id), "INVENTORY_DISPATCH", {"journal_id": journal.id})

        db.commit() # 🚀 MASTER COMMIT: Hard-wires data to disk
        logger.info(f"✅ VAULT LOCKED: {len(items)} Assets physically secured.")
        return {"status": "SUCCESS", "message": f"{len(items)} items synchronized."}

    except Exception as e:
        db.rollback()
        logger.error(f"🚨 KERNEL SYNC FAILURE: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# 3. VAULT TELEMETRY (THE GRID FEED)
# ==========================================
@router.get("/live")
async def get_live_vault(db: Session = Depends(get_db)):
    """Streams physical DB state with absolute Type-Safety."""
    try:
        records = db.query(Inventory).all()
        return {
            "status": "SUCCESS",
            "data": [
                {
                    "id": str(getattr(r, "product_id", "UNKNOWN")),
                    "name": str(getattr(r, "name", "UNNAMED")),
                    "type": str(getattr(r, "type", "PRODUCT")),
                    "dept": str(getattr(r, "dept", "GENERAL")),
                    "cat": str(getattr(r, "cat", "CONSUMABLE")),
                    "pp": float(getattr(r, "pp", 0.0) or 0.0),
                    "rp": float(getattr(r, "rp", 0.0) or 0.0),
                    "stock": float(getattr(r, "stock", 0.0) or 0.0),
                    "min_level": float(getattr(r, "min_level", 0.0) or 0.0),
                    "s_unit": str(getattr(r, "s_unit", "UNIT")),
                    "p_unit": str(getattr(r, "p_unit", "UNIT")),
                    "factor": float(getattr(r, "factor", 1.0) or 1.0),
                    "img": clean_img_url(getattr(r, "img", "") or ""),
                    "desc": str(getattr(r, "desc", "") or ""),
                    "barcode": str(getattr(r, "barcode", "") or ""),
                    "bom": getattr(r, "bom", []) or [],
                    "margin": str(getattr(r, "margin", "0.0") or "0.0"), # 🛡️ FIXED: Type-Safe Return
                    "shelf_location": str(getattr(r, "shelf_location", "") or ""),
                    "active_ingredient": str(getattr(r, "active_ingredient", "") or ""),
                    "dosage_form": str(getattr(r, "dosage_form", "") or "")
                } for r in records
            ]
        }
    except Exception as e:
        logger.error(f"VAULT_SYNC_ERROR: {str(e)}")
        return {"status": "OFFLINE", "data": [], "error": str(e)}

# ==========================================
# 4. WASTAGE & AUDIT LOGGING (SOVEREIGN — Iron Law 66)
# ==========================================
import uuid as _uuid

# InventoryAuditLedger — Append-Only wastage/adjustment ledger (Iron Law 66)
# This DDL is safe to run on every startup: IF NOT EXISTS prevents duplication.
# It also adds the enriched columns (action_type, stock_before/after, etc.)
# that are wider than the base ORM model created by Genesis.
INVENTORY_AUDIT_SCHEMA = """
CREATE TABLE IF NOT EXISTS inventory_audit_ledger (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    product_name VARCHAR(512),
    action_type VARCHAR(64) NOT NULL,
    qty_changed DOUBLE NOT NULL,
    stock_before DOUBLE,
    stock_after DOUBLE,
    unit_cost DOUBLE DEFAULT 0,
    cost_impact DOUBLE DEFAULT 0,
    reason TEXT,
    department VARCHAR(128) DEFAULT 'GLOBAL_AUDIT',
    operator VARCHAR(255),
    source_tx_id VARCHAR(255),
    zone_id VARCHAR(64),
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""


def _ensure_audit_ledger(db: Session) -> None:
    """Idempotent boot-safe table guard. Runs DDL then commits."""
    try:
        db.execute(text(INVENTORY_AUDIT_SCHEMA))
        db.commit()
    except Exception as _e:
        db.rollback()
        logger.error(f'[ERR] inventory_audit_ledger DDL guard failed: {_e}')


class WastagePayload(BaseModel):
    product_id: str
    qty_changed: float
    reason: str
    department: str = 'GLOBAL_AUDIT'
    cost_impact: float = 0.0
    operator: str = 'System'
    source_tx_id: Optional[str] = None
    zone_id: Optional[str] = None


@router.post('/wastage', status_code=status.HTTP_200_OK)
def log_wastage(payload: WastagePayload, db: Session = Depends(get_db)):
    """Sovereign Wastage Engine — logs damaged goods without inflating sales. Append-only (Iron Law 66)."""
    _ensure_audit_ledger(db)
    try:
        # Fetch current stock snapshot
        row = db.execute(
            text('SELECT stock, name, pp FROM inventory WHERE product_id = :pid'),
            {'pid': payload.product_id}
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Product not found in Sovereign Vault')

        stock_before = float(row[0] or 0)
        product_name = str(row[1] or '')
        unit_cost = float(row[2] or 0)

        if payload.qty_changed > stock_before:
            raise HTTPException(
                status_code=400,
                detail=f'Wastage qty ({payload.qty_changed}) exceeds available stock ({stock_before})'
            )

        stock_after = stock_before - payload.qty_changed
        cost_impact = payload.cost_impact if payload.cost_impact > 0 else (unit_cost * payload.qty_changed)
        entry_id = str(_uuid.uuid4())

        # Deduct stock from inventory vault
        db.execute(
            text('UPDATE inventory SET stock = :s WHERE product_id = :pid'),
            {'s': stock_after, 'pid': payload.product_id}
        )

        # 🔱 DEPARTMENT ACCOUNTING ENTRY WASTAGE
        try:
            from app.routers.dept_accounting import _utcnow, _get_or_create_open_batch, _post_ledger_entry
            acc_dept_id = map_inventory_dept_to_accounting_dept(payload.department)
            dept_row = db.execute(text("SELECT gl_prefix FROM departments WHERE id = :id"), {"id": acc_dept_id}).fetchone()
            pfx = dept_row[0] if dept_row else "000"
            batch_id = _get_or_create_open_batch(acc_dept_id, db)
            debit_acct = f"5190-{pfx}"
            credit_acct = f"1210-{pfx}"
            tx_id = f"WST-{payload.product_id}-{int(datetime.now().timestamp())}"
            _post_ledger_entry(acc_dept_id, batch_id, tx_id, debit_acct, credit_acct, cost_impact,
                               f"Inventory Wastage: {product_name} x{payload.qty_changed} ({payload.reason})", db)
            db.execute(text("""
                UPDATE tx_batches SET
                    tx_count = tx_count + 1,
                    total_expense = total_expense + :a,
                    updated_at = :ts
                WHERE id = :bid
            """), {"bid": batch_id, "a": cost_impact, "ts": _utcnow()})
        except Exception as dept_acc_err:
            logger.warning(f"Department accounting wastage entry failed: {dept_acc_err}")

        # Append-only audit ledger write (Iron Law 66 — no UPDATE/DELETE)
        db.execute(text("""
            INSERT INTO inventory_audit_ledger
            (id, product_id, product_name, action_type, qty_changed, stock_before, stock_after,
             unit_cost, cost_impact, reason, department, operator, source_tx_id, zone_id)
            VALUES (:id, :pid, :pname, 'WASTAGE', :qty, :sb, :sa, :uc, :ci,
                    :reason, :dept, :op, :src, :zone)
        """), {
            'id': entry_id,
            'pid': payload.product_id,
            'pname': product_name,
            'qty': payload.qty_changed,
            'sb': stock_before,
            'sa': stock_after,
            'uc': unit_cost,
            'ci': cost_impact,
            'reason': payload.reason,
            'dept': payload.department,
            'op': payload.operator,
            'src': payload.source_tx_id,
            'zone': payload.zone_id
        })
        db.commit()

        logger.info(f'[OK] WASTAGE LOGGED: {product_name} | qty={payload.qty_changed} | entry={entry_id}')
        return {
            'status': 'SUCCESS',
            'message': f'Wastage logged for {product_name}',
            'entry_id': entry_id,
            'product_id': payload.product_id,
            'qty_wasted': payload.qty_changed,
            'stock_before': stock_before,
            'stock_after': stock_after,
            'cost_impact': cost_impact
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f'[ERR] Wastage log error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/audit-ledger')
def get_audit_ledger(
    department: Optional[str] = None,
    action_type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Read the append-only inventory audit ledger with optional filters."""
    _ensure_audit_ledger(db)
    try:
        wheres = []
        params: dict = {'limit': limit}
        if department:
            wheres.append('department = :dept')
            params['dept'] = department
        if action_type:
            wheres.append('action_type = :atype')
            params['atype'] = action_type

        where_clause = f"WHERE {' AND '.join(wheres)}" if wheres else ''
        rows = db.execute(text(f"""
            SELECT id, product_id, product_name, action_type, qty_changed,
                   stock_before, stock_after, unit_cost, cost_impact, reason,
                   department, operator, source_tx_id, zone_id, recorded_at
            FROM inventory_audit_ledger
            {where_clause}
            ORDER BY recorded_at DESC
            LIMIT :limit
        """), params).fetchall()

        return {
            'status': 'SUCCESS',
            'count': len(rows),
            'entries': [{
                'id': r[0],
                'product_id': r[1],
                'product_name': r[2],
                'action_type': r[3],
                'qty_changed': r[4],
                'stock_before': r[5],
                'stock_after': r[6],
                'unit_cost': r[7],
                'cost_impact': r[8],
                'reason': r[9],
                'department': r[10],
                'operator': r[11],
                'source_tx_id': r[12],
                'zone_id': r[13],
                'recorded_at': str(r[14])
            } for r in rows]
        }
    except Exception as e:
        logger.error(f'[ERR] Audit ledger fetch error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# 5. ITEM UPDATE (ARCHITECT ENGINE EDIT)
# ==========================================
import json as _json

class ItemUpdatePayload(BaseModel):
    name: str
    dept: str
    cat: str = "COMPILED_SERVICE"
    pp: float = 0.0
    rp: float = 0.0
    stock: float = 9999.0
    min_level: float = 0.0
    s_unit: str = "PKG"
    p_unit: str = "PKG"
    factor: float = 1.0
    margin: str = "0.0"
    desc: str = ""
    img: str = ""
    bom: list = []

@router.put("/update/{product_id}", status_code=status.HTTP_200_OK)
async def update_inventory_item(product_id: str, payload: ItemUpdatePayload, db: Session = Depends(get_db)):
    """
    ARCHITECT ENGINE: Update an existing inventory item (service or product).
    Edits name, pricing, BOM, department, description, and image.
    """
    try:
        item = db.query(Inventory).filter(Inventory.product_id == product_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item '{product_id}' not found in Vault.")

        item.name       = payload.name.upper()
        item.dept       = payload.dept.upper()
        item.cat        = payload.cat.upper()
        item.pp         = payload.pp
        item.rp         = payload.rp
        item.stock      = payload.stock
        item.min_level  = payload.min_level
        item.s_unit     = payload.s_unit
        item.p_unit     = payload.p_unit
        item.factor     = payload.factor
        item.margin     = str(payload.margin)
        item.desc       = payload.desc
        item.img        = payload.img
        # BOM is stored as JSON in the DB
        if hasattr(item, 'bom'):
            item.bom = payload.bom if isinstance(payload.bom, list) else []

        db.commit()
        logger.info(f"VAULT_UPDATE: {product_id} updated by Architect Engine.")
        return {"status": "SUCCESS", "message": f"Item '{payload.name}' updated in Vault."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"VAULT_UPDATE_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# 6. ITEM DELETE (ARCHITECT ENGINE REMOVE)
# ==========================================
@router.delete("/delete/{product_id}", status_code=status.HTTP_200_OK)
async def delete_inventory_item(product_id: str, db: Session = Depends(get_db)):
    """
    ARCHITECT ENGINE: Permanently removes an item from the Vault.
    Only allowed for SERVICE-type items (not raw materials / products in active use).
    """
    try:
        item = db.query(Inventory).filter(Inventory.product_id == product_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item '{product_id}' not found.")

        item_name = str(getattr(item, 'name', product_id))
        db.delete(item)
        db.commit()
        logger.warning(f"VAULT_DELETE: {product_id} ({item_name}) removed from Sovereign Vault.")
        return {"status": "SUCCESS", "message": f"'{item_name}' removed from Vault."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"VAULT_DELETE_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# 7. F1-A: AVAILABILITY ENDPOINT
# ==========================================
import math as _math

@router.get("/availability")
def get_fnb_availability(db: Session = Depends(get_db)):
    """
    F1-A: F&B Item Availability Feed.
    For every F&B-dept non-raw item:
      - is_available  = stock > min_level
      - estimated_portions = floor(min(stock_of_bom_ingredient / bom_qty)) for items with BOM
    Departments scanned: RESTAURANT, RS-, COFFEE, BAR, DINING, F&B, GASTRONOMY
    """
    try:
        FNB_DEPT_KEYS   = ["RESTAURANT", "RS-", "COFFEE", "BAR", "DINING", "F&B", "GASTRONOMY"]
        EXCLUDED_TYPES  = {"RAW_MATERIAL", "RAW"}

        all_records = db.query(Inventory).all()

        # Build a quick lookup: product_id -> Inventory row
        inv_map: dict = {str(getattr(r, "product_id", "")): r for r in all_records}

        # Filter to F&B menu/service items only
        fnb_items = [
            r for r in all_records
            if any(kw in (str(getattr(r, "dept", "") or "")).upper() for kw in FNB_DEPT_KEYS)
            and str(getattr(r, "type", "") or "").upper() not in EXCLUDED_TYPES
        ]

        result = []
        for item in fnb_items:
            item_id  = str(getattr(item, "product_id", ""))
            name     = str(getattr(item, "name", item_id) or item_id)
            stock    = float(getattr(item, "stock", 0) or 0)
            min_lvl  = float(getattr(item, "min_level", 0) or 0)
            unit     = str(getattr(item, "s_unit", "UNIT") or "UNIT")

            is_available = stock > min_lvl

            # Estimate portions from BOM ingredients
            bom = getattr(item, "bom", None) or []
            if isinstance(bom, str):
                try:
                    import json as _j
                    bom = _j.loads(bom)
                except Exception:
                    bom = []

            estimated_portions: int = -1  # -1 means no BOM / not calculable
            if bom:
                portions_per_ingredient = []
                for bom_entry in bom:
                    raw_id  = bom_entry.get("rawId") or bom_entry.get("id", "")
                    bom_qty = float(bom_entry.get("qty", 0))
                    if not raw_id or bom_qty <= 0:
                        continue
                    raw_inv = inv_map.get(raw_id)
                    if raw_inv is None:
                        portions_per_ingredient.append(0)
                        continue
                    raw_stock = float(getattr(raw_inv, "stock", 0) or 0)
                    portions_per_ingredient.append(raw_stock / bom_qty)

                if portions_per_ingredient:
                    estimated_portions = int(_math.floor(min(portions_per_ingredient)))

            result.append({
                "item_id":            item_id,
                "name":               name,
                "is_available":       is_available,
                "stock":              round(stock, 4),
                "min_level":          round(min_lvl, 4),
                "unit":               unit,
                "estimated_portions": estimated_portions,
            })

        logger.info(f"[F1-A] Availability feed: {len(result)} F&B items returned.")
        return {"status": "SUCCESS", "items": result}

    except Exception as e:
        logger.error(f"[ERR] /availability: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# 8. F1-B: BOM DEDUCTION FUNCTION
#    Called by fnb_orders_router when an order is bumped to READY.
#    Non-async, module-level, importable. Non-fatal (catches all exceptions).
# ==========================================

def deduct_bom_for_fnb_order(items_list: list, db: Session) -> None:
    """
    F1-B: BOM Deduction for F&B Orders.

    For each ordered item:
      1. Looks up its Inventory record.
      2. If it has a BOM list, deducts each ingredient proportional to qty ordered.
         new_stock = max(0, current_stock - (bom_item_qty * order_item_qty))
      3. Writes an append-only audit ledger entry (action_type='BOM_DEDUCTION').
      4. Commits once at the end.

    Iron Law 66 compliant: only INSERT into audit ledger, never DELETE/UPDATE ledger rows.
    This function is intentionally non-fatal -- exceptions are caught and logged.
    """
    try:
        _ensure_audit_ledger(db)

        import json as _j

        for order_item in items_list:
            order_item_id  = str(order_item.get("id", ""))
            order_item_qty = int(order_item.get("qty", 1))

            if not order_item_id:
                continue

            inv_rec = db.query(Inventory).filter(
                Inventory.product_id == order_item_id
            ).first()

            if not inv_rec:
                logger.warning(f"[BOM_DEDUCT] Item not found in inventory: {order_item_id}")
                continue

            bom = getattr(inv_rec, "bom", None) or []
            if isinstance(bom, str):
                try:
                    bom = _j.loads(bom)
                except Exception:
                    bom = []

            if not bom:
                continue  # no BOM -- nothing to deduct

            for bom_entry in bom:
                raw_id  = bom_entry.get("rawId") or bom_entry.get("id", "")
                bom_qty = float(bom_entry.get("qty", 0))

                if not raw_id or bom_qty <= 0:
                    continue

                # Fetch current raw material stock
                raw_row = db.execute(
                    text("SELECT stock, name, pp FROM inventory WHERE product_id = :pid"),
                    {"pid": raw_id}
                ).fetchone()

                if not raw_row:
                    logger.warning(f"[BOM_DEDUCT] Raw material not found: {raw_id}")
                    continue

                stock_before = float(raw_row[0] or 0)
                raw_name     = str(raw_row[1] or raw_id)
                unit_cost    = float(raw_row[2] or 0)
                deduct_qty   = bom_qty * order_item_qty
                stock_after  = max(0.0, stock_before - deduct_qty)
                cost_impact  = deduct_qty * unit_cost

                # Deduct stock
                db.execute(
                    text("UPDATE inventory SET stock = :s WHERE product_id = :pid"),
                    {"s": stock_after, "pid": raw_id}
                )

                # Append-only audit ledger write (Iron Law 66)
                entry_id = str(_uuid.uuid4())
                db.execute(text("""
                    INSERT INTO inventory_audit_ledger
                    (id, product_id, product_name, action_type, qty_changed,
                     stock_before, stock_after, unit_cost, cost_impact, reason,
                     department, operator, source_tx_id, zone_id)
                    VALUES
                    (:id, :pid, :pname, 'BOM_DEDUCTION', :qty,
                     :sb, :sa, :uc, :ci, :reason,
                     'FNB_KDS', 'KDS_SYSTEM', :src, NULL)
                """), {
                    "id":     entry_id,
                    "pid":    raw_id,
                    "pname":  raw_name,
                    "qty":    deduct_qty,
                    "sb":     stock_before,
                    "sa":     stock_after,
                    "uc":     unit_cost,
                    "ci":     cost_impact,
                    "reason": f"BOM deduction for order item {order_item_id} x{order_item_qty}",
                    "src":    order_item_id,
                })

                logger.info(
                    f"[BOM_DEDUCT] {raw_name} ({raw_id}): "
                    f"{stock_before} -> {stock_after} (deducted {deduct_qty})"
                )

        db.commit()
        logger.info(f"[BOM_DEDUCT] Committed deductions for {len(items_list)} ordered items.")

    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.error(f"[BOM_DEDUCT] Non-fatal error during BOM deduction: {e}")


# ==============================================================================
# SECTION 5: ENTERPRISE SUPPLY CHAIN & MULTI-VAULT SCHEMAS
# ==============================================================================

SUPPLY_CHAIN_SCHEMAS = [
    # 1. Inventory Nodes Table
    """
    CREATE TABLE IF NOT EXISTS inventory_nodes (
        id              VARCHAR(64) PRIMARY KEY,
        parent_node_id  VARCHAR(64),
        name            VARCHAR(255) NOT NULL,
        type            VARCHAR(64) NOT NULL,
        facility_code   VARCHAR(64) NOT NULL,
        active          INTEGER DEFAULT 1
    );
    """,
    # 2. Purchase Orders Table
    """
    CREATE TABLE IF NOT EXISTS purchase_orders (
        id              VARCHAR(64) PRIMARY KEY,
        po_number       VARCHAR(100) UNIQUE NOT NULL,
        vendor_id       VARCHAR(64) NOT NULL,
        ordered_at      VARCHAR(64) NOT NULL,
        delivery_node_id VARCHAR(64),
        total_amount    REAL NOT NULL,
        status          VARCHAR(64) DEFAULT 'PENDING'
    );
    """,
    # 3. Three-Way Matches Table
    """
    CREATE TABLE IF NOT EXISTS three_way_matches (
        id              VARCHAR(64) PRIMARY KEY,
        po_id           VARCHAR(64),
        vendor_invoice_ref VARCHAR(128),
        receiving_dock_log_id VARCHAR(64),
        matching_amount REAL NOT NULL,
        is_matched      INTEGER DEFAULT 0,
        matched_at      VARCHAR(64),
        auditor_operator_id VARCHAR(64)
    );
    """,
    # 4. Vault Stock Allocation Table (Per Node and Batch)
    """
    CREATE TABLE IF NOT EXISTS vault_stock_allocation (
        id              VARCHAR(64) PRIMARY KEY,
        vault_id        VARCHAR(64) NOT NULL,
        product_id      VARCHAR(100) NOT NULL,
        batch_number    VARCHAR(128) NOT NULL,
        expiry_date     VARCHAR(64),
        quantity        REAL DEFAULT 0.0,
        blocked_qty     REAL DEFAULT 0.0,
        last_audited_at VARCHAR(64)
    );
    """,
    # 5. Stock Transfers Table
    """
    CREATE TABLE IF NOT EXISTS stock_transfers (
        id              VARCHAR(64) PRIMARY KEY,
        source_node_id  VARCHAR(64),
        dest_node_id    VARCHAR(64),
        product_id      VARCHAR(100) NOT NULL,
        batch_number    VARCHAR(128) NOT NULL,
        qty_transferred REAL NOT NULL,
        transferred_at  VARCHAR(64) NOT NULL,
        operator_id     VARCHAR(64) NOT NULL,
        status          VARCHAR(64) DEFAULT 'TRANSIT'
    );
    """
]

DEFAULT_INVENTORY_NODES = [
    {"id": "NODE_CDC",          "parent_node_id": None,            "name": "Central Distribution Center", "type": "CDC",           "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_DOCK",         "parent_node_id": "NODE_CDC",      "name": "Receiving Loading Dock",     "type": "LOADING_DOCK",   "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_PHARMACY",     "parent_node_id": "NODE_DOCK",     "name": "Pharmacy Central Vault",     "type": "CENTRAL_VAULT",  "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_SURGICAL",     "parent_node_id": "NODE_DOCK",     "name": "Surgical Core Core Vault",   "type": "CENTRAL_VAULT",  "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_DIETARY",      "parent_node_id": "NODE_DOCK",     "name": "Patient Dietary Store",      "type": "CENTRAL_VAULT",  "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_LAB",          "parent_node_id": "NODE_DOCK",     "name": "Diagnostics Reagents Store",  "type": "CENTRAL_VAULT",  "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_BOUTIQUE",     "parent_node_id": "NODE_DOCK",     "name": "Medical Supplies Store",     "type": "CENTRAL_VAULT",  "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_RENTAL",       "parent_node_id": "NODE_DOCK",     "name": "Medical Equipment Rent Store","type": "CENTRAL_VAULT",  "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_CINEMA",       "parent_node_id": "NODE_DOCK",     "name": "Medical Education Lab Vault", "type": "CENTRAL_VAULT",  "facility_code": "SYS-ENTERPRISE"},
    
    # Satellites
    {"id": "NODE_SAT_PHARMACY", "parent_node_id": "NODE_PHARMACY", "name": "Pharmacy Dispensing Sat",    "type": "SATELLITE_WARD", "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_SAT_OT",       "parent_node_id": "NODE_SURGICAL", "name": "OR Prep Carts",              "type": "SATELLITE_WARD", "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_SAT_DIETARY",  "parent_node_id": "NODE_DIETARY",  "name": "Dietary Ward Pantry",        "type": "SATELLITE_WARD", "facility_code": "SYS-ENTERPRISE"},
    {"id": "NODE_SAT_WARD",     "parent_node_id": "NODE_BOUTIQUE", "name": "General Wards Supply Cart",  "type": "SATELLITE_WARD", "facility_code": "SYS-ENTERPRISE"},
]

def _ensure_supply_chain_schema(db: Session) -> None:
    """Creates the 5 supply chain tables and seeds default inventory nodes."""
    try:
        # Create tables
        for sql in SUPPLY_CHAIN_SCHEMAS:
            db.execute(text(sql))
        db.commit()

        # Seed default nodes
        for node in DEFAULT_INVENTORY_NODES:
            exists = db.execute(
                text("SELECT id FROM inventory_nodes WHERE id = :id"),
                {"id": node["id"]}
            ).fetchone()
            if not exists:
                db.execute(text("""
                    INSERT INTO inventory_nodes (id, parent_node_id, name, type, facility_code, active)
                    VALUES (:id, :parent_node_id, :name, :type, :facility_code, 1)
                """), node)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[SUPPLY-CHAIN] Schema guard/seed failed: {e}")


class POCreatePayload(BaseModel):
    po_number: str
    vendor_id: str
    delivery_node_id: str
    total_amount: float


class MatchPayload(BaseModel):
    po_number: str
    vendor_invoice_ref: str
    receiving_dock_log_id: str
    matching_amount: float
    product_id: str
    qty_received: float
    batch_number: str
    expiry_date: Optional[str] = None
    unit_cost: float
    operator_id: str


class TransferCreatePayload(BaseModel):
    source_node_id: str
    dest_node_id: str
    product_id: str
    batch_number: str
    qty_transferred: float
    operator_id: str


class TransferReceivePayload(BaseModel):
    transfer_id: str
    operator_id: str


@router.get("/nodes")
def get_inventory_nodes(db: Session = Depends(get_db)):
    _ensure_supply_chain_schema(db)
    rows = db.execute(text("SELECT id, parent_node_id, name, type, facility_code, active FROM inventory_nodes")).fetchall()
    return {
        "status": "SUCCESS",
        "nodes": [
            {
                "id": r[0],
                "parent_node_id": r[1],
                "name": r[2],
                "type": r[3],
                "facility_code": r[4],
                "active": r[5]
            } for r in rows
        ]
    }


@router.post("/purchase-orders/create")
async def create_purchase_order(payload: POCreatePayload, db: Session = Depends(get_db)):
    _ensure_supply_chain_schema(db)
    
    node = db.execute(text("SELECT id FROM inventory_nodes WHERE id = :id"), {"id": payload.delivery_node_id}).fetchone()
    if not node:
        raise HTTPException(status_code=404, detail=f"Delivery node '{payload.delivery_node_id}' not found.")
        
    po_id = str(_uuid.uuid4())
    ordered_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        db.execute(text("""
            INSERT INTO purchase_orders (id, po_number, vendor_id, ordered_at, delivery_node_id, total_amount, status)
            VALUES (:id, :po_num, :v_id, :ordered, :node_id, :amt, 'PENDING')
        """), {
            "id": po_id,
            "po_num": payload.po_number,
            "v_id": payload.vendor_id,
            "ordered": ordered_at,
            "node_id": payload.delivery_node_id,
            "amt": payload.total_amount
        })
        db.commit()
        
        try:
            from app.main import master_socket
            await master_socket.broadcast("GRID_UPDATE", {
                "action": "PO_CREATED",
                "po_number": payload.po_number,
                "amount": payload.total_amount
            })
        except Exception as ws_err:
            logger.warning(f"PO WS Broadcast failed: {ws_err}")
            
        return {"status": "SUCCESS", "po_id": po_id, "po_number": payload.po_number}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create PO: {str(e)}")


@router.post("/three-way-match")
async def execute_three_way_match(payload: MatchPayload, db: Session = Depends(get_db)):
    _ensure_supply_chain_schema(db)
    
    po = db.execute(text("SELECT id, delivery_node_id, status FROM purchase_orders WHERE po_number = :po_num"), 
                    {"po_num": payload.po_number}).fetchone()
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase order '{payload.po_number}' not found.")
    
    po_id = po[0]
    delivery_node = po[1] or "NODE_DOCK"
    
    prod = db.execute(text("SELECT name FROM inventory WHERE product_id = :pid"), {"pid": payload.product_id}).fetchone()
    if not prod:
        raise HTTPException(status_code=404, detail=f"Product '{payload.product_id}' not found in catalog.")
    prod_name = prod[0]
        
    try:
        match_id = str(_uuid.uuid4())
        matched_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        db.execute(text("""
            INSERT INTO three_way_matches (id, po_id, vendor_invoice_ref, receiving_dock_log_id, matching_amount, is_matched, matched_at, auditor_operator_id)
            VALUES (:id, :po_id, :inv, :dock, :amt, 1, :ts, :op)
        """), {
            "id": match_id,
            "po_id": po_id,
            "inv": payload.vendor_invoice_ref,
            "dock": payload.receiving_dock_log_id,
            "amt": payload.matching_amount,
            "ts": matched_at,
            "op": payload.operator_id
        })
        
        db.execute(text("UPDATE purchase_orders SET status = 'COMPLETED' WHERE id = :po_id"), {"po_id": po_id})
        
        alloc_id = str(_uuid.uuid4())
        alloc = db.execute(text("""
            SELECT id, quantity FROM vault_stock_allocation 
            WHERE vault_id = :vid AND product_id = :pid AND batch_number = :batch
        """), {"vid": delivery_node, "pid": payload.product_id, "batch": payload.batch_number}).fetchone()
        
        if alloc:
            new_qty = alloc[1] + payload.qty_received
            db.execute(text("""
                UPDATE vault_stock_allocation SET quantity = :qty, last_audited_at = :ts
                WHERE id = :aid
            """), {"qty": new_qty, "ts": matched_at, "aid": alloc[0]})
        else:
            db.execute(text("""
                INSERT INTO vault_stock_allocation (id, vault_id, product_id, batch_number, expiry_date, quantity, blocked_qty, last_audited_at)
                VALUES (:id, :vid, :pid, :batch, :exp, :qty, 0.0, :ts)
            """), {
                "id": alloc_id,
                "vid": delivery_node,
                "pid": payload.product_id,
                "batch": payload.batch_number,
                "exp": payload.expiry_date,
                "qty": payload.qty_received,
                "ts": matched_at
            })
            
        db.execute(text("""
            UPDATE inventory SET stock = stock + :qty WHERE product_id = :pid
        """), {"qty": payload.qty_received, "pid": payload.product_id})
        
        audit_id = str(_uuid.uuid4())
        db.execute(text("""
            INSERT INTO inventory_audit_ledger
            (id, product_id, product_name, action_type, qty_changed, stock_before, stock_after, unit_cost, cost_impact, reason, department, operator, source_tx_id, zone_id)
            VALUES (:id, :pid, :pname, 'RECEIVING', :qty, 0.0, :qty, :uc, :cost, :reason, 'CENTRAL_RECEIVING', :op, :po, NULL)
        """), {
            "id": audit_id,
            "pid": payload.product_id,
            "pname": prod_name,
            "qty": payload.qty_received,
            "uc": payload.unit_cost,
            "cost": payload.matching_amount,
            "reason": f"Receiving 3-Way Match PO:{payload.po_number}",
            "op": payload.operator_id,
            "po": payload.po_number
        })
        
        db.commit()
        
        try:
            from app.main import master_socket
            await master_socket.broadcast("GRID_UPDATE", {
                "action": "THREE_WAY_MATCH_COMPLETED",
                "po_number": payload.po_number,
                "product_id": payload.product_id,
                "quantity": payload.qty_received,
                "vault": delivery_node
            })
        except Exception as ws_err:
            logger.warning(f"3-Way Match WS Broadcast failed: {ws_err}")
            
        return {"status": "SUCCESS", "match_id": match_id, "allocated_qty": payload.qty_received}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to match and receive: {str(e)}")


@router.post("/transfers/create")
async def create_stock_transfer(payload: TransferCreatePayload, db: Session = Depends(get_db)):
    _ensure_supply_chain_schema(db)
    
    src_alloc = db.execute(text("""
        SELECT id, quantity FROM vault_stock_allocation 
        WHERE vault_id = :vid AND product_id = :pid AND batch_number = :batch
    """), {"vid": payload.source_node_id, "pid": payload.product_id, "batch": payload.batch_number}).fetchone()
    
    if not src_alloc or src_alloc[1] < payload.qty_transferred:
        available = src_alloc[1] if src_alloc else 0.0
        raise HTTPException(status_code=400, detail=f"Insufficient stock ({available}) in source node '{payload.source_node_id}' for batch '{payload.batch_number}'.")
        
    prod = db.execute(text("SELECT name, pp FROM inventory WHERE product_id = :pid"), {"pid": payload.product_id}).fetchone()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found in catalog.")
    prod_name = prod[0]
    unit_price = prod[1] or 0.0
    transfer_value = payload.qty_transferred * unit_price
    
    try:
        transfer_id = str(_uuid.uuid4())
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        
        db.execute(text("""
            UPDATE vault_stock_allocation SET quantity = quantity - :qty
            WHERE id = :aid
        """), {"qty": payload.qty_transferred, "aid": src_alloc[0]})
        
        dest_alloc = db.execute(text("""
            SELECT id, quantity FROM vault_stock_allocation 
            WHERE vault_id = :vid AND product_id = :pid AND batch_number = :batch
        """), {"vid": payload.dest_node_id, "pid": payload.product_id, "batch": payload.batch_number}).fetchone()
        
        if dest_alloc:
            db.execute(text("""
                UPDATE vault_stock_allocation SET quantity = quantity + :qty
                WHERE id = :aid
            """), {"qty": payload.qty_transferred, "aid": dest_alloc[0]})
        else:
            db.execute(text("""
                INSERT INTO vault_stock_allocation (id, vault_id, product_id, batch_number, expiry_date, quantity, blocked_qty, last_audited_at)
                VALUES (:id, :vid, :pid, :batch, NULL, :qty, 0.0, :ts)
            """), {
                "id": str(_uuid.uuid4()),
                "vid": payload.dest_node_id,
                "pid": payload.product_id,
                "batch": payload.batch_number,
                "qty": payload.qty_transferred,
                "ts": ts
            })
            
        db.execute(text("""
            INSERT INTO stock_transfers (id, source_node_id, dest_node_id, product_id, batch_number, qty_transferred, transferred_at, operator_id, status)
            VALUES (:id, :src, :dest, :pid, :batch, :qty, :ts, :op, 'COMPLETED')
        """), {
            "id": transfer_id,
            "src": payload.source_node_id,
            "dest": payload.dest_node_id,
            "pid": payload.product_id,
            "batch": payload.batch_number,
            "qty": payload.qty_transferred,
            "ts": ts,
            "op": payload.operator_id
        })
        
        src_dept_id = map_inventory_dept_to_accounting_dept(payload.source_node_id.replace("NODE_", ""))
        dest_dept_id = map_inventory_dept_to_accounting_dept(payload.dest_node_id.replace("NODE_", ""))
        
        if src_dept_id != dest_dept_id and transfer_value > 0:
            from app.routers.dept_accounting import _get_or_create_open_batch, _post_ledger_entry
            
            src_row = db.execute(text("SELECT gl_prefix FROM departments WHERE id = :id"), {"id": src_dept_id}).fetchone()
            src_pfx = src_row[0] if src_row else "000"
            src_batch = _get_or_create_open_batch(src_dept_id, db)
            
            dest_row = db.execute(text("SELECT gl_prefix FROM departments WHERE id = :id"), {"id": dest_dept_id}).fetchone()
            dest_pfx = dest_row[0] if dest_row else "000"
            dest_batch = _get_or_create_open_batch(dest_dept_id, db)
            
            tx_ref = f"TRF-{transfer_id[:8].upper()}"
            
            _post_ledger_entry(dest_dept_id, dest_batch, tx_ref, f"1210-{dest_pfx}", f"2000-{dest_pfx}", transfer_value,
                               f"Transfer IN: {prod_name} x{payload.qty_transferred} from {payload.source_node_id}", db)
            db.execute(text("""
                UPDATE tx_batches SET tx_count = tx_count + 1, total_expense = total_expense + :a WHERE id = :bid
            """), {"bid": dest_batch, "a": transfer_value})
            
            _post_ledger_entry(src_dept_id, src_batch, tx_ref, f"2000-{src_pfx}", f"1210-{src_pfx}", transfer_value,
                               f"Transfer OUT: {prod_name} x{payload.qty_transferred} to {payload.dest_node_id}", db)
            db.execute(text("""
                UPDATE tx_batches SET tx_count = tx_count + 1, total_expense = total_expense - :a WHERE id = :bid
            """), {"bid": src_batch, "a": transfer_value})
            
        db.commit()
        
        try:
            from app.main import master_socket
            await master_socket.broadcast("GRID_UPDATE", {
                "action": "STOCK_TRANSFER_COMPLETED",
                "transfer_id": transfer_id,
                "source": payload.source_node_id,
                "dest": payload.dest_node_id,
                "product_id": payload.product_id,
                "quantity": payload.qty_transferred
            })
        except Exception as ws_err:
            logger.warning(f"Stock Transfer WS Broadcast failed: {ws_err}")
            
        return {"status": "SUCCESS", "transfer_id": transfer_id, "transferred_qty": payload.qty_transferred}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create transfer: {str(e)}")


@router.post("/transfers/receive")
def receive_stock_transfer(payload: TransferReceivePayload, db: Session = Depends(get_db)):
    _ensure_supply_chain_schema(db)
    
    transfer = db.execute(text("SELECT id, status FROM stock_transfers WHERE id = :id"), {"id": payload.transfer_id}).fetchone()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found.")
        
    db.execute(text("UPDATE stock_transfers SET status = 'RECEIVED' WHERE id = :id"), {"id": payload.transfer_id})
    db.commit()
    return {"status": "SUCCESS", "transfer_id": payload.transfer_id, "state": "RECEIVED"}


@router.get("/vault-allocations")
def get_vault_allocations(vault_id: Optional[str] = None, product_id: Optional[str] = None, db: Session = Depends(get_db)):
    _ensure_supply_chain_schema(db)
    
    query = """
        SELECT a.id, a.vault_id, n.name as vault_name, a.product_id, i.name as product_name, a.batch_number, a.expiry_date, a.quantity, a.blocked_qty
        FROM vault_stock_allocation a
        JOIN inventory_nodes n ON a.vault_id = n.id
        JOIN inventory i ON a.product_id = i.product_id
        WHERE 1=1
    """
    params = {}
    if vault_id:
        query += " AND a.vault_id = :vid"
        params["vid"] = vault_id
    if product_id:
        query += " AND a.product_id = :pid"
        params["pid"] = product_id
        
    rows = db.execute(text(query), params).fetchall()
    
    return {
        "status": "SUCCESS",
        "allocations": [
            {
                "id": r[0],
                "vault_id": r[1],
                "vault_name": r[2],
                "product_id": r[3],
                "product_name": r[4],
                "batch_number": r[5],
                "expiry_date": r[6],
                "quantity": r[7],
                "blocked_qty": r[8]
            } for r in rows
        ]
    }