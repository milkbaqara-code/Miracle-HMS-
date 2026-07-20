# backend_api/app/routers/pos_router.py
# SOVEREIGN POS CHECKOUT ENGINE - Enterprise V2.0
# LOOPHOLES FIXED:
#   [1] COGS now posted on ALL payments (CASH, CARD, ROOM_CHARGE) - was missing on Room Charge
#   [2] VAT -> 2100 (VAT Payable), SC -> 2110 (SC Payable). Never credited to Revenue.
#   [3] Folio line items include VAT+SC breakdown so guest receipt math is exact.
#   [4] SERVICE items credit AP (2000), not Inventory. Fleet/Spa/Cinema owe vendors.
#   [5] Zone-specific GL routing: Z-29->4100/5100, Z-26->4400/5110, Z-27->4500/5120,
#       Z-28->4600/5130, Z-17->4700/5140. Revenue never conflated across departments.
import logging
import json
import uuid as _uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.schemas.pos_schema import POSCheckoutPayload
from app.models.models import Inventory, POSTransaction, POSOrderItem

from app.routers.accounting_engine import post_double_entry

DHAKA_TZ = timezone(timedelta(hours=6))
logger = logging.getLogger("Zone14_POS_V2")
router = APIRouter(tags=["ZONE 14: POS Engine"])

# ============================================================
# SOVEREIGN ZONE GL ROUTING TABLE
# Maps terminal_id prefix -> (revenue_code, cogs_code, asset_code)
# asset_code: 121000=F&B Inv, 123000=Boutique Inv, 200000=AP (for services)
# ============================================================
ZONE_GL_MAP = {
    "Z-29": (410000, 510100, 121000),   # Gastronomy: F&B Revenue, F&B COGS, F&B Inventory
    "Z-28": (460000, 510400, 123000),   # Boutique: Retail Revenue, Boutique COGS, General Inventory
    "Z-26": (440000, 510200, 200000),   # Fleet: Transport Revenue, Vendor Cost, Accounts Payable
    "Z-27": (450000, 510300, 200000),   # Wellness: Spa Revenue, Treatment Cost, Accounts Payable
    "Z-17": (470000, 510500, 200000),   # Cinema: Entertainment Revenue, License Cost, Accounts Payable
}

# Legacy terminal_id aliases (backward compat with old RS-RESTAURANT, SPA etc.)
LEGACY_TERMINAL_MAP = {
    "RESTAURANT":    "Z-29",
    "COFFEE":        "Z-29",
    "ROOM SERVICE":  "Z-29",
    "BAR":           "Z-29",
    "GASTRONOMY":    "Z-29",
    "F&B":           "Z-29",
    "F & B":         "Z-29",
    "BOUTIQUE":      "Z-28",
    "RETAIL":        "Z-28",
    "FLEET":         "Z-26",
    "TRANSPORT":     "Z-26",
    "SPA":           "Z-27",
    "WELLNESS":      "Z-27",
    "MASSAGE":       "Z-27",
    "CINEMA":        "Z-17",
    "CINEPLEX":      "Z-17",
    "ENTERTAINMENT": "Z-17",
}

def is_beverage_item(item_id: str, item_name: str) -> bool:
    """Classifies if a product is a beverage based on prefix/keyword triggers."""
    name_upper = str(item_name).upper()
    id_upper = str(item_id).upper()
    return (
        id_upper.startswith("BTTL") or
        "BEVERAGE" in name_upper or
        "WATER" in name_upper or
        "COCA COLA" in name_upper or
        "COLA" in name_upper or
        "CAPPUCCINO" in name_upper or
        "COFFEE" in name_upper or
        "TEA" in name_upper or
        "JUICE" in name_upper or
        "WINE" in name_upper or
        "LIQUOR" in name_upper or
        "BEER" in name_upper or
        "SODA" in name_upper or
        "DRINK" in name_upper
    )

def resolve_zone_gl(terminal_id: str):
    """
    Resolves a terminal_id to its GL codes.
    Priority: Z-XX prefix match -> legacy keyword match -> F&B default.
    Returns (revenue_code, cogs_code, asset_credit_code)
    """
    t = str(terminal_id).upper().strip()

    # Try direct prefix match first (Z-29-RESTAURANT etc.)
    for prefix, gl in ZONE_GL_MAP.items():
        if t.startswith(prefix):
            logger.info(f"GL_ROUTE: {terminal_id} -> Zone prefix {prefix} -> Rev:{gl[0]} COGS:{gl[1]} Asset:{gl[2]}")
            return gl

    # Try legacy keyword match
    for keyword, zone_prefix in LEGACY_TERMINAL_MAP.items():
        if keyword in t:
            gl = ZONE_GL_MAP[zone_prefix]
            logger.info(f"GL_ROUTE: {terminal_id} -> Legacy keyword '{keyword}' -> Rev:{gl[0]} COGS:{gl[1]} Asset:{gl[2]}")
            return gl

    # Safe default: F&B (backward compatible)
    logger.warning(f"GL_ROUTE: Unknown terminal '{terminal_id}' -> Defaulting to Z-29 F&B GL codes")
    return ZONE_GL_MAP["Z-29"]


def map_terminal_to_accounting_dept(terminal_id: str) -> str:
    t = str(terminal_id).upper().strip()
    if t.startswith("Z-06") or "PHARMACY" in t or "POS" in t:
        return "DEPT_POS"
    elif t.startswith("Z-27") or "SPA" in t or "WELLNESS" in t:
        return "DEPT_WELLNESS"
    elif t.startswith("Z-29") or "GASTRONOMY" in t or "RESTAURANT" in t or "F&B" in t or "COFFEE" in t:
        return "DEPT_FB"
    elif t.startswith("Z-28") or "BOUTIQUE" in t or "RETAIL" in t or "SUPPLIES" in t:
        return "DEPT_BOUTIQUE"
    elif t.startswith("Z-26") or "FLEET" in t or "TRANSPORT" in t or "AMBULANCE" in t:
        return "DEPT_FLEET"
    elif t.startswith("Z-3B") or "RENTAL" in t or "EQUIPMENT" in t:
        return "DEPT_RENTAL"
    elif t.startswith("Z-17") or "CINEMA" in t or "CINEPLEX" in t or "MEDIA" in t or "Z-14" in t:
        return "DEPT_CINEMA"
    else:
        return "DEPT_PMS"


# ============================================================
# INVENTORY AUDIT LEDGER — BOM Deduction Trail (Iron Law 66)
# Append-only: never UPDATE or DELETE. Linked to POS tx_id.
# ============================================================
_AUDIT_LEDGER_DDL = """
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
_audit_ledger_ready = False  # module-level flag — only runs DDL once per worker


def _write_audit_entry(
    db: Session,
    action_type: str,
    product_id: str,
    product_name: str,
    qty_changed: float,
    stock_before: float,
    stock_after: float,
    unit_cost: float,
    reason: str,
    source_tx_id: str,
    department: str = 'POS',
    zone_id: str = None
) -> None:
    """
    Append-only audit ledger writer (Iron Law 66).
    Silently skips on error to avoid blocking checkout.
    """
    global _audit_ledger_ready
    try:
        if not _audit_ledger_ready:
            db.execute(text(_AUDIT_LEDGER_DDL))
            db.flush()
            _audit_ledger_ready = True
        cost_impact = round(unit_cost * qty_changed, 4)
        db.execute(text("""
            INSERT INTO inventory_audit_ledger
            (id, product_id, product_name, action_type, qty_changed,
             stock_before, stock_after, unit_cost, cost_impact,
             reason, department, operator, source_tx_id, zone_id)
            VALUES (:id, :pid, :pname, :atype, :qty,
                    :sb, :sa, :uc, :ci,
                    :reason, :dept, 'POS_ENGINE', :src, :zone)
        """), {
            'id': str(_uuid.uuid4()),
            'pid': product_id,
            'pname': product_name,
            'atype': action_type,
            'qty': qty_changed,
            'sb': stock_before,
            'sa': stock_after,
            'uc': unit_cost,
            'ci': cost_impact,
            'reason': reason,
            'dept': department,
            'src': source_tx_id,
            'zone': zone_id
        })
    except Exception as _ae:
        logger.warning(f'[WARN] Audit ledger write skipped: {_ae}')


@router.post("/checkout", status_code=status.HTTP_200_OK)
async def handle_checkout(payload: POSCheckoutPayload, db: Session = Depends(get_db)):
    """
    SOVEREIGN POS CHECKOUT ENGINE - Enterprise V2.0
    Implements ACID-compliant double-entry for all zones.
    Fixes all 5 accounting loopholes identified in the Enterprise Audit.
    """
    logger.info(f"POS_SESSION: Initiating atomic checkout TXN:{payload.transaction_id} | Terminal:{payload.terminal_id} | Method:{payload.payment_method}")

    # Resolve GL codes for this zone BEFORE entering the transaction
    rev_code, cogs_code, asset_credit_code = resolve_zone_gl(payload.terminal_id)

    # Decompose financials
    net_revenue   = max(0.0, payload.financials.subtotal - payload.financials.discount)
    vat_amount    = float(payload.financials.vat)
    sc_amount     = float(payload.financials.sc)
    grand_total   = float(payload.financials.grand)
    total_cogs    = float(payload.financials.totalCOGS)

    missions_to_broadcast = []

    try:
        with db.begin_nested():
            # ============================================================
            # STEP 1: Forge the Immutable POS Transaction Record
            # ============================================================
            new_tx = POSTransaction(
                id=payload.transaction_id,
                terminal_id=payload.terminal_id,
                cashier_pin=payload.cashier_pin,
                guest_type=payload.guest_type,
                guest_ref=payload.guest_ref,
                payment_method=payload.payment_method,
                subtotal=payload.financials.subtotal,
                total_cogs=total_cogs,
                discount=payload.financials.discount,
                vat=vat_amount,
                sc=sc_amount,
                grand_total=grand_total,
                true_profit=payload.financials.trueProfit,
                zone_gl_code=rev_code
            )
            db.add(new_tx)

            # ============================================================
            # STEP 2: SOVEREIGN DOUBLE-ENTRY - Revenue + Tax Segregation
            # FIX [2]: VAT -> 210000 (Gov liability), SC -> 211000 (payable)
            # Debit resolved based on payment method:
            # - ROOM_CHARGE -> 111000 (Guest Ledger)
            # - CASH -> 105000 (House Banks/Till Float)
            # - CARD/DIGITAL/ONLINE -> 102000 (CC Merchant Clearing)
            # - default fallback -> 100000 (Consolidated Cash)
            # ============================================================
            if payload.payment_method == "ROOM_CHARGE":
                debit_code = 111000  # Guest Ledger
                ref_type = "POS_ROOM_CHARGE"
                desc = f"Room Charge TXN:{payload.transaction_id} Terminal:{payload.terminal_id} Room:{payload.guest_ref}"
            elif payload.payment_method in ["CARD", "DIGITAL", "ONLINE"]:
                debit_code = 102000  # Credit Card Merchant Clearing
                ref_type = "POS_CARD_SALE"
                desc = f"Card Sale TXN:{payload.transaction_id} Terminal:{payload.terminal_id}"
            elif payload.payment_method == "CASH":
                debit_code = 105000  # House Banks (Till Float)
                ref_type = "POS_CASH_SALE"
                desc = f"Cash Sale TXN:{payload.transaction_id} Terminal:{payload.terminal_id}"
            else:
                debit_code = 100000  # Consolidated Cash Fallback
                ref_type = f"POS_{str(payload.payment_method).upper()}_SALE"
                desc = f"{payload.payment_method} Sale TXN:{payload.transaction_id} Terminal:{payload.terminal_id}"

            rev_entries = [
                {"code": debit_code, "debit": grand_total, "credit": 0.0},
                {"code": rev_code,   "debit": 0.0,         "credit": net_revenue},
            ]
            if vat_amount > 0:
                rev_entries.append({"code": 210000, "debit": 0.0, "credit": vat_amount})
            if sc_amount > 0:
                rev_entries.append({"code": 211000, "debit": 0.0, "credit": sc_amount})

            post_double_entry(db, ref_type, desc, rev_entries)

            # ============================================================
            # STEP 3: COGS Recognition - ALL payment methods
            # Dynamically splits Food vs Beverage for Gastronomy (Z-29)
            # ============================================================
            if total_cogs > 0:
                # Accumulate debits and credits by account code
                cogs_debits = {}   # account_code -> amount
                cogs_credits = {}  # account_code -> amount
                
                # Retrieve prefix for dynamic zone checking
                t_clean = str(payload.terminal_id).upper().strip()
                terminal_id_prefix = "Z-29"
                for prefix in ZONE_GL_MAP.keys():
                    if t_clean.startswith(prefix):
                        terminal_id_prefix = prefix
                        break

                for cart_item in payload.items:
                    if not cart_item.isFOC:
                        item_cogs = float(cart_item.cogs or 0.0) * float(cart_item.qty or 0)
                        if item_cogs <= 0:
                            continue
                        
                        item_type = str(getattr(cart_item, "type", "PRODUCT")).upper()
                        
                        # Resolve specific accounts for this item
                        if item_type == "SERVICE":
                            # Services credit AP (200000) and debit cogs_code
                            item_cogs_code = cogs_code
                            item_asset_code = 200000
                        else:
                            # Products credit inventory and debit cogs_code
                            # For F&B (Z-29), check if it's a beverage
                            if terminal_id_prefix == "Z-29" and is_beverage_item(cart_item.id, cart_item.name):
                                item_cogs_code = 510150   # Beverage COGS
                                item_asset_code = 121200  # Beverage Stock
                            elif terminal_id_prefix == "Z-29":
                                item_cogs_code = 510100   # Food COGS
                                item_asset_code = 121100  # Food Stock
                            else:
                                item_cogs_code = cogs_code
                                item_asset_code = asset_credit_code
                        
                        cogs_debits[item_cogs_code] = cogs_debits.get(item_cogs_code, 0.0) + item_cogs
                        cogs_credits[item_asset_code] = cogs_credits.get(item_asset_code, 0.0) + item_cogs
                
                # Single combined double-entry transaction keeps the ledger tidy:
                cogs_lines = []
                for code, amt in cogs_debits.items():
                    cogs_lines.append({"code": code, "debit": round(amt, 2), "credit": 0.0})
                for code, amt in cogs_credits.items():
                    cogs_lines.append({"code": code, "debit": 0.0, "credit": round(amt, 2)})
                
                if cogs_lines:
                    post_double_entry(db, "POS_COGS",
                        f"COGS Recognition TXN:{payload.transaction_id}",
                        cogs_lines)

            # ============================================================
            # STEP 4: FOC / Complimentary Expense
            # ============================================================
            total_foc_cogs = sum(
                float(getattr(i, "cogs", 0.0)) * float(i.qty)
                for i in payload.items if getattr(i, "isFOC", False)
            )
            if total_foc_cogs > 0:
                # Dynamic FOC fallback resolving for FOC credit accounts
                t_clean = str(payload.terminal_id).upper().strip()
                terminal_id_prefix = "Z-29"
                for prefix in ZONE_GL_MAP.keys():
                    if t_clean.startswith(prefix):
                        terminal_id_prefix = prefix
                        break
                
                foc_credit_code = asset_credit_code
                if terminal_id_prefix == "Z-29":
                    # Assume Food Stock default for FOC unless beverage detected
                    has_beverage = any(is_beverage_item(i.id, i.name) for i in payload.items if getattr(i, "isFOC", False))
                    foc_credit_code = 121200 if has_beverage else 121100

                post_double_entry(db, "POS_FOC_EXPENSE",
                    f"FOC/Complimentary Expense TXN:{payload.transaction_id}",
                    [
                        {"code": 530000,          "debit": total_foc_cogs, "credit": 0.0},
                        {"code": foc_credit_code, "debit": 0.0,            "credit": total_foc_cogs},
                    ])

            # ============================================================
            # STEP 5: Inventory Deduction + Order Items + Solve Missions
            # ============================================================
            for cart_item in payload.items:
                order_item = POSOrderItem(
                    transaction_id=payload.transaction_id,
                    product_id=cart_item.id,
                    name=cart_item.name,
                    qty=cart_item.qty,
                    rp=cart_item.rp,
                    cogs=cart_item.cogs,
                    is_foc=cart_item.isFOC
                )
                db.add(order_item)

                db_item = db.query(Inventory).filter(Inventory.product_id == cart_item.id).first()
                if not db_item:
                    logger.warning(f"ASSET_MISSING: {cart_item.id} not found in Vault. Skipping deduction.")
                    continue

                item_type = str(getattr(db_item, "type", "PRODUCT")).upper()

                if item_type == "SERVICE":
                    # Deduct BOM raw materials (if any)
                    bom_data = getattr(db_item, "bom", None)
                    if isinstance(bom_data, str):
                        try:
                            bom_data = json.loads(bom_data)
                        except Exception:
                            bom_data = []
                    if bom_data and isinstance(bom_data, list):
                        for ingredient in bom_data:
                            raw_id = ingredient.get("rawId") or ingredient.get("id")
                            if not raw_id:
                                continue
                            total_deduction = float(ingredient.get("qty", 0)) * float(cart_item.qty)

                            # Fetch stock snapshot BEFORE deduction for audit trail
                            snap = db.execute(
                                text('SELECT stock, name, pp FROM inventory WHERE product_id = :rid'),
                                {'rid': raw_id}
                            ).fetchone()
                            snap_before = float(snap[0] or 0) if snap else 0.0
                            snap_name = str(snap[1] or raw_id) if snap else raw_id
                            snap_cost = float(snap[2] or 0) if snap else 0.0

                            db.execute(
                                text("UPDATE inventory SET stock = stock - :deduction WHERE product_id = :raw_id"),
                                {"deduction": total_deduction, "raw_id": raw_id}
                            )

                            # BOM_DEDUCTION audit trail (Iron Law 66)
                            _write_audit_entry(
                                db,
                                action_type='BOM_DEDUCTION',
                                product_id=raw_id,
                                product_name=snap_name,
                                qty_changed=total_deduction,
                                stock_before=snap_before,
                                stock_after=snap_before - total_deduction,
                                unit_cost=snap_cost,
                                reason=f'BOM deduction for {cart_item.name} x{cart_item.qty}',
                                source_tx_id=payload.transaction_id,
                                department=payload.terminal_id,
                                zone_id=payload.terminal_id
                            )

                    # Spawn Z-07 Solve Mission for service delivery (Iron Law 48)
                    if payload.guest_type == "HOTEL_GUEST" and payload.guest_ref:
                        try:
                            from app.services.solve_engine import SystemSentinel
                            sentinel = SystemSentinel(db)
                            raw_dept = str(getattr(db_item, "dept", "RS")).upper()
                            if any(x in raw_dept for x in ["SPA", "WELLNESS", "Z-27"]):
                                target_dept = "SPA"
                            elif any(x in raw_dept for x in ["HK", "HOUSEKEEPING"]):
                                target_dept = "HK"
                            elif any(x in raw_dept for x in ["FLEET", "TRANSPORT", "Z-26"]):
                                target_dept = "FLEET"
                            elif "MAINTENANCE" in raw_dept:
                                target_dept = "MAINTENANCE"
                            elif any(x in raw_dept for x in ["CINEMA", "Z-17"]):
                                target_dept = "CINEMA"
                            else:
                                target_dept = "RS"

                            success, result = sentinel.register_mission({
                                "room": str(payload.guest_ref).strip(),
                                "dept": target_dept,
                                "subject": f"Deliver/Execute: {cart_item.name} ({cart_item.qty}x)",
                                "priority": "HIGH"
                            })
                            if success:
                                missions_to_broadcast.append({
                                    "room": str(payload.guest_ref).strip(),
                                    "priority": "HIGH"
                                })
                        except Exception as mission_err:
                            logger.warning(f"SOLVE_MISSION_WARN: {str(mission_err)}")

                else:
                    # Physical product: deduct stock directly
                    # Fetch stock snapshot BEFORE deduction for audit trail
                    prod_snap = db.execute(
                        text('SELECT stock, pp FROM inventory WHERE product_id = :iid'),
                        {'iid': cart_item.id}
                    ).fetchone()
                    prod_before = float(prod_snap[0] or 0) if prod_snap else 0.0
                    prod_cost = float(prod_snap[1] or 0) if prod_snap else 0.0

                    db.execute(
                        text("UPDATE inventory SET stock = stock - :qty WHERE product_id = :item_id"),
                        {"qty": cart_item.qty, "item_id": cart_item.id}
                    )

                    # SALE_DEDUCTION audit trail (Iron Law 66)
                    _write_audit_entry(
                        db,
                        action_type='SALE_DEDUCTION',
                        product_id=cart_item.id,
                        product_name=cart_item.name,
                        qty_changed=float(cart_item.qty),
                        stock_before=prod_before,
                        stock_after=prod_before - float(cart_item.qty),
                        unit_cost=prod_cost,
                        reason=f'POS sale TXN:{payload.transaction_id}',
                        source_tx_id=payload.transaction_id,
                        department=payload.terminal_id,
                        zone_id=payload.terminal_id
                    )

            # ============================================================
            # STEP 6: Guest Folio Binding (Zone 08)
            # FIX [3]: Folio charges now include VAT & SC breakdown rows
            # so itemized guest receipt EXACTLY matches folio.balance
            # ============================================================
            if payload.payment_method == "ROOM_CHARGE":
                from app.models.models import GuestFolio, FolioCharge
                clean_room = str(payload.guest_ref).strip()
                folio = db.query(GuestFolio).filter(
                    GuestFolio.room_number == clean_room,
                    GuestFolio.status == "IN_HOUSE"
                ).first()

                if not folio:
                    raise ValueError(f"Room Charge Lock Failed: Room {clean_room} is Vacant or Invalid.")

                folio.balance += grand_total

                # Insert individual item charge rows (base price only)
                for cart_item in payload.items:
                    if not cart_item.isFOC:
                        item_base = float(cart_item.rp) * float(cart_item.qty)
                        new_charge = FolioCharge(
                            folio_id=folio.id,
                            item_name=cart_item.name,
                            category=payload.terminal_id,
                            amount=item_base,
                            qty=cart_item.qty,
                            transaction_id=payload.transaction_id
                        )
                        db.add(new_charge)

                # FIX [3]: Insert VAT and SC as separate folio line items
                # This ensures sum(folio_charges) == folio.balance exactly
                if vat_amount > 0:
                    db.add(FolioCharge(
                        folio_id=folio.id,
                        item_name=f"VAT 15% (TXN:{payload.transaction_id[-8:]})",
                        category="TAX",
                        amount=vat_amount,
                        qty=1,
                        transaction_id=payload.transaction_id
                    ))
                if sc_amount > 0:
                    db.add(FolioCharge(
                        folio_id=folio.id,
                        item_name=f"Service Charge (TXN:{payload.transaction_id[-8:]})",
                        category="SERVICE_CHARGE",
                        amount=sc_amount,
                        qty=1,
                        transaction_id=payload.transaction_id
                    ))

            # 🔱 DEPARTMENT ACCOUNTING ENTRY INTEGRATION
            try:
                from app.routers.dept_accounting import _utcnow, _new_id, _get_or_create_open_batch, _post_ledger_entry
                acc_dept_id = map_terminal_to_accounting_dept(payload.terminal_id)
                dept_row = db.execute(text("SELECT gl_prefix FROM departments WHERE id = :id"), {"id": acc_dept_id}).fetchone()
                pfx = dept_row[0] if dept_row else "000"
                batch_id = _get_or_create_open_batch(acc_dept_id, db)
                
                # Determine till account vs revenue account
                debit_acct = f"1000-{pfx}"  # Default Till
                if payload.payment_method == "ROOM_CHARGE":
                    debit_acct = f"1110-{pfx}" # Guest Ledger / Room Charge AR
                elif payload.payment_method in ["CARD", "DIGITAL", "ONLINE"]:
                    debit_acct = f"1020-{pfx}" # CC Clearing
                
                credit_acct = f"4000-{pfx}" # Revenue GL
                
                # Log Till Transaction
                db.execute(text("""
                    INSERT INTO till_transactions
                    (id, dept_id, type, amount, direction, description, payment_method,
                     reference_id, staff_id, staff_name, batch_id, status, gl_debit, gl_credit, created_at)
                    VALUES (:id, :dept_id, :type, :amount, 'IN', :desc, :pm, :ref, :sid, :sname, :bid, 'ACTIVE', :gd, :gc, :ts)
                """), {
                    "id": _new_id(),
                    "dept_id": acc_dept_id,
                    "type": f"REVENUE_{payload.payment_method.upper()}" if payload.payment_method in ("CASH", "CARD") else "REVENUE_ROOM_CHARGE",
                    "amount": grand_total,
                    "desc": f"POS Sale: {payload.transaction_id}",
                    "pm": payload.payment_method.upper(),
                    "ref": payload.transaction_id,
                    "sid": payload.cashier_pin,
                    "sname": f"POS Cashier PIN {payload.cashier_pin}",
                    "bid": batch_id,
                    "gd": debit_acct,
                    "gc": credit_acct,
                    "ts": _utcnow()
                })
                
                # Log Ledger Entry
                _post_ledger_entry(acc_dept_id, batch_id, payload.transaction_id, debit_acct, credit_acct, grand_total,
                                   f"POS Sale: {payload.transaction_id} Terminal {payload.terminal_id}", db)
                
                # Increment batch totals
                db.execute(text("""
                    UPDATE tx_batches SET
                        tx_count = tx_count + 1,
                        total_revenue = total_revenue + :a,
                        updated_at = :ts
                    WHERE id = :bid
                """), {"bid": batch_id, "a": grand_total, "ts": _utcnow()})
            except Exception as dept_acc_err:
                logger.warning(f"Department accounting POS sale entry failed: {dept_acc_err}")

        # MASTER HARD COMMIT - all or nothing
        db.commit()
        logger.info(f"SETTLEMENT_COMPLETE: {payload.transaction_id} | Zone:{payload.terminal_id} | Rev:{rev_code} | Amount:{grand_total}")

        # Broadcast to Z-07 Grid
        try:
            from app.main import master_socket
            await master_socket.broadcast("GRID_UPDATE", {
                "action": "POS_SALE_REGISTERED",
                "transaction_id": payload.transaction_id,
                "terminal_id": payload.terminal_id,
                "amount": grand_total,
                "zone_revenue_code": rev_code
            })
            for m in missions_to_broadcast:
                await master_socket.broadcast("GRID_UPDATE", {
                    "action": "MISSION_REGISTERED",
                    "room": m["room"],
                    "priority": m["priority"]
                })
        except Exception as ws_err:
            logger.warning(f"WS_BROADCAST_WARN: {str(ws_err)}")

        return {
            "status": "SUCCESS",
            "message": "Transaction cleared and Sovereign Ledger synchronized.",
            "transaction_id": payload.transaction_id,
            "zone_gl": {
                "revenue_code": rev_code,
                "cogs_code": cogs_code,
                "asset_credit_code": asset_credit_code
            }
        }

    except ValueError as ve:
        db.rollback()
        logger.warning(f"POS_BUSINESS_REJECTION: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        db.rollback()
        logger.error(f"POS_SYSTEM_CRITICAL: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Settlement Engine failure.")


@router.get("/status")
async def get_pos_status():
    return {
        "status": "ONLINE",
        "zone": "14",
        "engine": "MasterOS_Sovereign_V2_Enterprise",
        "gl_routing": "ACTIVE",
        "audit_level": "ENTERPRISE",
        "zones_supported": ["Z-29", "Z-28", "Z-27", "Z-26", "Z-17"]
    }


# ============================================================
# PHASE 5: GUEST APK CHECKOUT ENDPOINT
# Accepts the simplified guest app payload, converts to full
# sovereign POS transaction and writes to master ledger.
# Z-07 radar pulse + RS solve mission auto-triggered.
# ============================================================
class GuestCartItem(BaseModel):
    id: str
    name: str
    qty: float = 1.0
    rp: float = 0.0
    dept: str = "Z-29"
    cogs: float = 0.0
    type: str = "PRODUCT"
    bom: list = []

class GuestCheckoutPayload(BaseModel):
    items: List[GuestCartItem]
    payment_method: str = "ROOM_CHARGE"
    guest_ref: str = "N/A"
    zone: str = "Z-29"
    total: float = 0.0
    source: str = "GUEST_APK"


@router.post("/guest-checkout", status_code=status.HTTP_200_OK)
async def handle_guest_checkout(payload: GuestCheckoutPayload, db: Session = Depends(get_db)):
    """
    PHASE 5 — Guest APK Checkout Gateway
    Accepts simplified guest payload, maps to sovereign POS transaction,
    posts double-entry, deducts BOM/stock, fires Z-07 radar pulse.
    """
    DHAKA_TZ = timezone(timedelta(hours=6))
    tx_id = f"GAPK-{int(datetime.now().timestamp())}-{_uuid.uuid4().hex[:6].upper()}"
    terminal_id = payload.zone or "Z-29"
    missions_to_broadcast = []

    logger.info(f"GUEST_APK_CHECKOUT: {tx_id} | Zone:{terminal_id} | Room:{payload.guest_ref} | Total:{payload.total}")

    rev_code, cogs_code, asset_credit_code = resolve_zone_gl(terminal_id)

    # Build financials
    subtotal = sum(i.rp * i.qty for i in payload.items)
    total_cogs = sum((i.cogs or 0.0) * i.qty for i in payload.items)
    vat = round(subtotal * 0.0, 2)   # No VAT on guest app orders (pre-tax menu prices)
    sc = round(subtotal * 0.0, 2)
    grand_total = round(subtotal + vat + sc, 2)
    true_profit = round(subtotal - total_cogs, 2)

    try:
        with db.begin_nested():
            # STEP 1: Insert POS Transaction record
            db.execute(text("""
                INSERT INTO pos_transactions
                (id, terminal_id, cashier_pin, guest_type, guest_ref, payment_method,
                 subtotal, total_cogs, discount, vat, sc, grand_total, true_profit, zone_gl_code, timestamp)
                VALUES (:id, :tid, :pin, :gtype, :gref, :pm,
                        :sub, :cogs, 0, :vat, :sc, :grand, :profit, :gl, :ts)
            """), {
                'id': tx_id, 'tid': terminal_id, 'pin': 'GUEST_APP',
                'gtype': 'HOTEL_GUEST' if payload.payment_method == 'ROOM_CHARGE' else 'WALK_IN',
                'gref': payload.guest_ref, 'pm': payload.payment_method,
                'sub': subtotal, 'cogs': total_cogs, 'vat': vat, 'sc': sc,
                'grand': grand_total, 'profit': true_profit, 'gl': rev_code,
                'ts': datetime.now(DHAKA_TZ).isoformat()
            })

            # STEP 2: Double-entry — Revenue
            if payload.payment_method == "ROOM_CHARGE":
                debit_code = 111000
                ref_type = "GUEST_APK_ROOM_CHARGE"
            else:
                debit_code = 105000
                ref_type = "GUEST_APK_CASH"

            rev_entries = [
                {"code": debit_code, "debit": grand_total, "credit": 0.0},
                {"code": rev_code,   "debit": 0.0,         "credit": subtotal},
            ]
            post_double_entry(db, ref_type, f"Guest APK Order TXN:{tx_id} Room:{payload.guest_ref}", rev_entries)

            # STEP 3: COGS double-entry
            if total_cogs > 0:
                cogs_lines = [
                    {"code": cogs_code,         "debit": round(total_cogs, 2), "credit": 0.0},
                    {"code": asset_credit_code, "debit": 0.0,                  "credit": round(total_cogs, 2)},
                ]
                post_double_entry(db, "GUEST_APK_COGS", f"COGS TXN:{tx_id}", cogs_lines)

            # STEP 4: Order items + stock deduction + BOM deduction + Z-07 missions
            for item in payload.items:
                # Insert order item
                db.execute(text("""
                    INSERT INTO pos_order_items
                    (transaction_id, product_id, name, type, qty, rp, cogs, is_foc)
                    VALUES (:tid, :pid, :name, :type, :qty, :rp, :cogs, 0)
                """), {'tid': tx_id, 'pid': item.id, 'name': item.name,
                       'type': item.type or 'PRODUCT',
                       'qty': item.qty, 'rp': item.rp, 'cogs': item.cogs or 0})

                db_item = db.execute(
                    text("SELECT product_id, type, bom, dept FROM inventory WHERE product_id = :pid"),
                    {'pid': item.id}
                ).fetchone()

                if not db_item:
                    logger.warning(f"GUEST_APK: Item {item.id} not in vault. Skipping deduction.")
                    continue

                item_type = str(db_item[1] or 'PRODUCT').upper()

                if item_type == "SERVICE":
                    # Deduct BOM ingredients
                    import json as _json
                    bom_raw = db_item[2]
                    bom_list = []
                    if isinstance(bom_raw, str):
                        try:
                            bom_list = _json.loads(bom_raw)
                        except Exception:
                            bom_list = []
                    elif isinstance(bom_raw, list):
                        bom_list = bom_raw

                    for ingredient in bom_list:
                        raw_id = ingredient.get("rawId") or ingredient.get("id")
                        if not raw_id:
                            continue
                        total_deduction = float(ingredient.get("qty", 0)) * float(item.qty)
                        db.execute(
                            text("UPDATE inventory SET stock = stock - :d WHERE product_id = :pid"),
                            {"d": total_deduction, "pid": raw_id}
                        )

                    # Spawn Z-07 solve mission for service delivery
                    try:
                        from app.services.solve_engine import SystemSentinel
                        sentinel = SystemSentinel(db)
                        raw_dept = str(db_item[3] or '').upper()
                        if any(x in raw_dept for x in ["SPA", "WELLNESS", "Z-27"]):
                            target_dept = "SPA"
                        elif any(x in raw_dept for x in ["FLEET", "TRANSPORT", "Z-26"]):
                            target_dept = "FLEET"
                        elif any(x in raw_dept for x in ["HK", "HOUSEKEEPING"]):
                            target_dept = "HK"
                        elif any(x in raw_dept for x in ["CINEMA", "Z-17"]):
                            target_dept = "CINEMA"
                        else:
                            target_dept = "RS"

                        success, _ = sentinel.register_mission({
                            "room": str(payload.guest_ref).strip(),
                            "dept": target_dept,
                            "subject": f"GUEST APK — Deliver: {item.name} ({int(item.qty)}x)",
                            "priority": "HIGH"
                        })
                        if success:
                            missions_to_broadcast.append({"room": str(payload.guest_ref).strip(), "priority": "HIGH"})
                    except Exception as mission_err:
                        logger.warning(f"GUEST_APK_MISSION_WARN: {mission_err}")

                else:
                    # Physical product: direct stock deduction
                    db.execute(
                        text("UPDATE inventory SET stock = stock - :qty WHERE product_id = :pid"),
                        {"qty": item.qty, "pid": item.id}
                    )

            # STEP 5: Room Charge folio binding
            if payload.payment_method == "ROOM_CHARGE" and payload.guest_ref not in ["N/A", "", "UNKNOWN"]:
                from app.models.models import GuestFolio, FolioCharge
                clean_room = str(payload.guest_ref).strip()
                folio = db.query(GuestFolio).filter(
                    GuestFolio.room_number == clean_room,
                    GuestFolio.status == "IN_HOUSE"
                ).first()
                if folio:
                    folio.balance += grand_total
                    for item in payload.items:
                        db.add(FolioCharge(
                            folio_id=folio.id,
                            item_name=item.name,
                            category=f"GUEST_APK/{terminal_id}",
                            amount=round(item.rp * item.qty, 2),
                            qty=item.qty,
                            transaction_id=tx_id
                        ))

            # 🔱 DEPARTMENT ACCOUNTING ENTRY INTEGRATION
            try:
                from app.routers.dept_accounting import _utcnow, _new_id, _get_or_create_open_batch, _post_ledger_entry
                acc_dept_id = map_terminal_to_accounting_dept(terminal_id)
                dept_row = db.execute(text("SELECT gl_prefix FROM departments WHERE id = :id"), {"id": acc_dept_id}).fetchone()
                pfx = dept_row[0] if dept_row else "000"
                batch_id = _get_or_create_open_batch(acc_dept_id, db)
                
                # Determine till account vs revenue account
                debit_acct = f"1000-{pfx}"  # Default Till
                if payload.payment_method == "ROOM_CHARGE":
                    debit_acct = f"1110-{pfx}" # Guest Ledger / Room Charge AR
                elif payload.payment_method in ["CARD", "DIGITAL", "ONLINE"]:
                    debit_acct = f"1020-{pfx}" # CC Clearing
                
                credit_acct = f"4000-{pfx}" # Revenue GL
                
                # Log Till Transaction
                db.execute(text("""
                    INSERT INTO till_transactions
                    (id, dept_id, type, amount, direction, description, payment_method,
                     reference_id, staff_id, staff_name, batch_id, status, gl_debit, gl_credit, created_at)
                    VALUES (:id, :dept_id, :type, :amount, 'IN', :desc, :pm, :ref, :sid, :sname, :bid, 'ACTIVE', :gd, :gc, :ts)
                """), {
                    "id": _new_id(),
                    "dept_id": acc_dept_id,
                    "type": f"REVENUE_{payload.payment_method.upper()}" if payload.payment_method in ("CASH", "CARD") else "REVENUE_ROOM_CHARGE",
                    "amount": grand_total,
                    "desc": f"Guest APK Sale: {tx_id}",
                    "pm": payload.payment_method.upper(),
                    "ref": tx_id,
                    "sid": "GUEST_APK",
                    "sname": "Guest App Order",
                    "bid": batch_id,
                    "gd": debit_acct,
                    "gc": credit_acct,
                    "ts": _utcnow()
                })
                
                # Log Ledger Entry
                _post_ledger_entry(acc_dept_id, batch_id, tx_id, debit_acct, credit_acct, grand_total,
                                   f"Guest APK Sale: {tx_id} Terminal {terminal_id}", db)
                
                # Increment batch totals
                db.execute(text("""
                    UPDATE tx_batches SET
                        tx_count = tx_count + 1,
                        total_revenue = total_revenue + :a,
                        updated_at = :ts
                    WHERE id = :bid
                """), {"bid": batch_id, "a": grand_total, "ts": _utcnow()})
            except Exception as dept_acc_err:
                logger.warning(f"Department accounting Guest APK sale entry failed: {dept_acc_err}")

        # HARD COMMIT
        db.commit()
        logger.info(f"GUEST_APK_SETTLED: {tx_id} | Room:{payload.guest_ref} | Amount:{grand_total}")

        # Z-07 RADAR PULSE
        try:
            from app.main import master_socket
            await master_socket.broadcast("GRID_UPDATE", {
                "action": "GUEST_APK_ORDER",
                "transaction_id": tx_id,
                "terminal_id": terminal_id,
                "amount": grand_total,
                "guest_ref": payload.guest_ref,
                "zone_revenue_code": rev_code
            })
            for m in missions_to_broadcast:
                await master_socket.broadcast("GRID_UPDATE", {
                    "action": "MISSION_REGISTERED",
                    "room": m["room"],
                    "priority": m["priority"]
                })
        except Exception as ws_err:
            logger.warning(f"GUEST_APK_WS_WARN: {ws_err}")

        return {
            "status": "SUCCESS",
            "message": "Guest order received and logged to Sovereign Ledger.",
            "transaction_id": tx_id,
            "total": grand_total,
            "zone": terminal_id
        }

    except Exception as e:
        db.rollback()
        logger.error(f"GUEST_APK_CHECKOUT_CRITICAL: {e}")
        raise HTTPException(status_code=500, detail=f"Guest checkout failed: {str(e)}")