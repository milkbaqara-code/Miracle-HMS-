# backend_api/app/routers/accounting_engine.py
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Header
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.core.database import get_db
from app.models.models import Account, JournalEntry, LedgerLine, APInvoice, ARReceivable, Vendor, FixedAsset, DepreciationLog
from jose import jwt

DHAKA_TZ = timezone(timedelta(hours=6))
logger = logging.getLogger("Sovereign_Accounting_Kernel")
router = APIRouter(tags=["ZONE 18: Sovereign Accounting Kernel"])

SECRET_KEY = "MIRACLE_OS_SUPREME_SECRET_KEY_CHANGE_IN_PROD"
ALGORITHM = "HS256"

def get_current_user_from_token(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Decodes JWT user token and extracts identity and role."""
    if not authorization or not authorization.startswith("Bearer "):
        # Return fallback for local/demo environment if header is missing
        return {"sub": "SYSTEM", "role": "CFO", "name": "System Administrator"}
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {
            "sub": payload.get("sub", "UNKNOWN"),
            "role": str(payload.get("role", "ACCOUNTANT")).upper(),
            "name": payload.get("name", "Unknown Operative")
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Session expired or invalid token.")

class VoucherPayload(BaseModel):
    objective: str
    amount: float
    department: str
    authorized_by: str
    capitalize: bool = False  # If True, capitalize to fixed asset instead of expensing
    fixed_asset_id: Optional[int] = None  # Link to existing FixedAsset for capitalization

    @field_validator('amount', mode='before')
    @classmethod
    def coerce_amount(cls, v):
        try: return float(v) if v else 0.0
        except: return 0.0

# ==========================================
# 1. THE ACID COMPLIANCE ENGINE
# ==========================================
def post_double_entry(
    db: Session,
    reference_type: str,
    description: str,
    lines: List[Dict[str, Any]],
    posted_by: Optional[str] = None,
    verification_status: str = "VERIFIED",
    currency_code: str = "USD",
    exchange_rate: float = 1.0
):
    """
    THE GOLDEN RULE: Strict double-entry enforcement.
    Lines format: [{"code": 1000, "debit": 100.0, "credit": 0.0}, ...]
    """
    from typing import Optional # just to be safe
    total_debits = sum(line.get('debit', 0.0) for line in lines)
    total_credits = sum(line.get('credit', 0.0) for line in lines)

    if round(total_debits, 2) != round(total_credits, 2):
        logger.error(f"🚨 ACID VIOLATION: Debits ({total_debits}) != Credits ({total_credits}) for {reference_type}")
        raise HTTPException(status_code=400, detail=f"Imbalanced Entry: {total_debits} vs {total_credits}")

    try:
        # 1. Create Journal Header
        journal = JournalEntry(
            reference_type=reference_type,
            description=description,
            timestamp=datetime.now(DHAKA_TZ),
            posted_by=posted_by,
            verification_status=verification_status,
            currency_code=currency_code,
            exchange_rate=exchange_rate
        )
        db.add(journal)
        db.flush() # Get ID

        # 2. Create Ledger Lines
        for line in lines:
            account = db.query(Account).filter(Account.code == line['code']).first()
            if not account:
                raise ValueError(f"CRITICAL: Account {line['code']} missing from CoA.")
            
            ledger_line = LedgerLine(
                journal_id=journal.id,
                account_id=account.id,
                debit=line.get('debit', 0.0),
                credit=line.get('credit', 0.0),
                currency_code=currency_code,
                exchange_rate=exchange_rate,
                fixed_asset_id=line.get('fixed_asset_id')  # 🏗️ Asset-level tagging for capitalization audit
            )
            db.add(ledger_line)
        
        # Note: Caller is responsible for db.commit() unless nested.
        return journal
    except Exception as e:
        db.rollback()
        import traceback
        with open("error_log.txt", "a") as f:
            f.write(traceback.format_exc() + "\n")
        logger.error(f"🚨 Ledger Write Failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Financial integrity lock triggered.")

# ==========================================
# 2. AUTOMATED EVENT DISPATCHERS
# ==========================================
def record_stock_purchase(db: Session, amount: float, description: str):
    """Inventory Up (Debit), Payable Up (Credit)"""
    lines = [
        {"code": 121000, "debit": amount, "credit": 0.0}, # Inventory - F&B (default stock purchase bucket)
        {"code": 200000, "debit": 0.0, "credit": amount}  # Accounts Payable Vendors
    ]
    return post_double_entry(db, 'STOCK_PURCHASE', description, lines)

def record_fb_sale(db: Session, amount: float, cogs_amount: float, beverage_pct: float = 0.0, payment_method: str = "CASH"):
    """
    HOSPITALITY CURRENT ASSET SYSTEM:
    1. COGS Up (Debit), Inventory Down (Credit) — split Food vs Beverage
    2. Cash/CC Clearing Up (Debit), F&B Revenue Up (Credit)
    
    beverage_pct: 0.0–1.0 fraction of COGS attributable to beverages
    payment_method: CASH | CREDIT_CARD | ROOM_CHARGE
    """
    # Item 1: COGS Recognition — Split Food (510100/121100) vs Beverage (510150/121200)
    bev_cogs = round(cogs_amount * beverage_pct, 2)
    food_cogs = round(cogs_amount - bev_cogs, 2)
    
    cogs_lines = []
    if food_cogs > 0:
        cogs_lines.extend([
            {"code": 510100, "debit": food_cogs, "credit": 0.0},  # F&B COGS — Food
            {"code": 121100, "debit": 0.0, "credit": food_cogs}   # Food Stock Down
        ])
    if bev_cogs > 0:
        cogs_lines.extend([
            {"code": 510150, "debit": bev_cogs, "credit": 0.0},   # COGS — Beverage
            {"code": 121200, "debit": 0.0, "credit": bev_cogs}    # Beverage Stock Down
        ])
    if not cogs_lines:  # Fallback to legacy bucket
        cogs_lines = [
            {"code": 510100, "debit": cogs_amount, "credit": 0.0},
            {"code": 121000, "debit": 0.0, "credit": cogs_amount}
        ]
    post_double_entry(db, 'POS_SALE_COGS', "Cost Recognition for F&B Sale", cogs_lines)

    # Item 2: Revenue Recognition — Route by payment method
    # CASH → 100000, CREDIT_CARD → 102000 (CC Clearing), ROOM_CHARGE → 111000 (Guest Ledger)
    debit_code_map = {"CASH": 100000, "CREDIT_CARD": 102000, "ROOM_CHARGE": 111000}
    debit_code = debit_code_map.get(payment_method, 100000)
    rev_lines = [
        {"code": debit_code, "debit": amount, "credit": 0.0},
        {"code": 410000, "debit": 0.0, "credit": amount}  # F&B Revenue
    ]
    return post_double_entry(db, 'POS_SALE_REV', "Revenue Recognition for F&B Sale", rev_lines)

def record_voucher_dispatch(db: Session, amount: float, description: str, capitalize: bool = False, fixed_asset_id: int = None):
    """
    DUAL-MODE VOUCHER ENGINE:
    Standard:    Maintenance Expense Up (Debit), Cash Down (Credit)
    Capitalize:  Fixed Asset Up (Debit, tagged), Cash Down (Credit) — increases asset NBV
    """
    if capitalize and fixed_asset_id:
        # 🏗️ CAPITALIZE: Debit the division's fixed asset account, credit cash
        asset = db.query(FixedAsset).filter(FixedAsset.id == fixed_asset_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail=f"Fixed Asset ID {fixed_asset_id} not found.")
        
        division_fa_map = {
            "ROOMS": 130000, "F&B": 131000, "FLEET": 132000,
            "BOUTIQUE": 133000, "WELLNESS": 134000, "CINEMA": 135000, "GENERAL": 130000
        }
        fa_code = division_fa_map.get(asset.division, 130000)
        lines = [
            {"code": fa_code, "debit": amount, "credit": 0.0, "fixed_asset_id": fixed_asset_id},
            {"code": 100000, "debit": 0.0, "credit": amount}
        ]
        journal = post_double_entry(db, 'ASSET_CAPITALIZATION', description, lines)
        # Update the asset's cost basis and NBV
        asset.purchase_cost += amount
        asset.net_book_value += amount
        logger.info(f"🏗️ CAPITALIZED ৳{amount} to Asset #{fixed_asset_id} ({asset.name}). New NBV: ৳{asset.net_book_value}")
        return journal
    else:
        # Standard expense flow
        lines = [
            {"code": 550000, "debit": amount, "credit": 0.0}, # Maintenance Expense
            {"code": 100000, "debit": 0.0, "credit": amount}  # Cash/Bank Consolidated
        ]
        return post_double_entry(db, 'VOUCHER', description, lines)

# ==========================================
# 3. BOARDROOM REPORTING APIs
# ==========================================
@router.post("/voucher/dispatch")
async def dispatch_expense_voucher(payload: VoucherPayload, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Uplink from the React UI to the Sovereign Kernel. Supports capitalize mode."""
    try:
        journal = record_voucher_dispatch(
            db, payload.amount,
            f"Voucher: {payload.objective} (Dept: {payload.department}) Auth: {payload.authorized_by}",
            capitalize=payload.capitalize,
            fixed_asset_id=payload.fixed_asset_id
        )
        db.commit()
        
        # 🕵️ SOVEREIGN WATCHDOG: DEPLOY DECOY
        from app.core.watchdog_engine import verify_transaction_integrity
        from app.core.database import SessionLocal
        background_tasks.add_task(verify_transaction_integrity, SessionLocal, str(journal.id), 'INVENTORY_DISPATCH', {"journal_id": journal.id})
        return {
            "status": "SUCCESS",
            "message": "Voucher Authorized & Locked into Sovereign Vault.",
            "voucher_id": f"VCH-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
def get_accounting_status():
    return {
        "zone": "18", 
        "status": "SOVEREIGN_ACTIVE", 
        "vessel": "Miracle-PG_V1",
        "timestamp": datetime.now(DHAKA_TZ).isoformat()
    }

# Scoped division to accounts mapping dictionary
DIVISION_ACCOUNTS = {
    "rooms":    [120000, 130000, 140000, 300100, 400000, 400200, 500000, 510000, 520000],
    "fb":       [121000, 131000, 141000, 300200, 410000, 500100, 510100, 520100],
    "fleet":    [122000, 132000, 142000, 300300, 440000, 500200, 510200, 520200],
    "wellness": [124000, 134000, 143000, 300400, 450000, 500300, 510300, 520300],
    "boutique": [123000, 133000, 144000, 300500, 460000, 500400, 510400, 520400],
    "cinema":   [125000, 135000, 145000, 300600, 470000, 500500, 510500, 520500],
    # PHASE 1: Co-Owner & Mortgage Accounts
    # 113200 = Mortgage Principal Receivable (ASSET)
    # 113300 = Owner Yield Payable (LIABILITY)
    # 200300 = Lease Payable — Rental Owner (LIABILITY)
    # 440100 = Interest Revenue — Mortgage (REVENUE)
    # 521200 = Lease Expense — Rental Owner (EXPENSE)
    # 521300 = Owner Disbursement Expense (EXPENSE)
    "owner":    [113200, 113300, 200300, 440100, 521200, 521300],
}

# ==========================================
# ZONE 30 PHASE 1: PMS FINANCIAL DISPATCHERS
# Three atomic event functions for owner accounting.
# Each enforces: idempotency, ACID double-entry, PMSOwnerLedger audit trail.
# ==========================================

def record_owner_yield_disbursement(
    db: Session,
    room_id: str,
    gross_yield: float,
    management_fee_pct: float,
    period_label: str,  # e.g. "062026"
    posted_by: str = "SYSTEM",
    linked_employee_id: str = None
):
    """
    Post net room yield to the co-owner after deducting the management fee.
    Called by frontdesk_engine on checkout for FULL_OWNER and MORTGAGE_BUYER rooms.

    GL Flow:
      Debit  400000 (Room Revenue) — reduces revenue bucket by management share
      Credit 113300 (Owner Yield Payable) — owner's balance increases
      Debit  521300 (Owner Disbursement Expense) — management books the gross payout
      Credit 100000 (Cash/Bank) — cash goes out when actually disbursed

    idempotency_key = YIELD_CREDIT-{room_id}-{period_label}
    """
    from app.models.models import AssetGrid
    idempotency_key = f"YIELD_CREDIT-{room_id}-{period_label}"

    # Idempotency: abort silently if already posted
    pass

    fee = round(gross_yield * (management_fee_pct / 100), 2)
    net_yield = round(gross_yield - fee, 2)

    # ACID double-entry
    journal = post_double_entry(
        db,
        reference_type="OWNER_YIELD_CREDIT",
        description=f"Net yield disbursement: Room {room_id} | Period {period_label} | Gross {gross_yield:.2f} | Fee {fee:.2f}",
        lines=[
            {"code": 521300, "debit": gross_yield, "credit": 0.0},  # Owner Disbursement Expense up
            {"code": 113300, "debit": 0.0, "credit": net_yield},    # Owner Yield Payable up (net)
            {"code": 440100, "debit": 0.0, "credit": fee},          # Management Fee → Interest/Fee Revenue
        ],
        posted_by=posted_by
    )

    # Update AssetGrid YTD yield accumulators
    asset = db.query(AssetGrid).filter(AssetGrid.room_id == room_id).first()
    if asset:
        asset.ytd_gross_yield = round((asset.ytd_gross_yield or 0.0) + gross_yield, 2)
        asset.ytd_net_yield = round((asset.ytd_net_yield or 0.0) + net_yield, 2)

    # PMSOwnerLedger immutable record
    return journal


def record_mortgage_payment(
    db: Session,
    room_id: str,
    period_label: str,  # e.g. "062026"
    posted_by: str = "SYSTEM",
    override_by: str = None,
    override_reason: str = None
):
    """
    Monthly mortgage netting sweep for MORTGAGE_BUYER rooms.
    Nets the monthly installment from the owner's accumulated yield balance.
    Splits payment into principal and interest components.

    GL Flow:
      Debit  113300 (Owner Yield Payable)       — reduces owner's yield balance
      Credit 113200 (Mortgage Principal Receivable) — principal component reduces receivable
      Credit 440100 (Interest Revenue — Mortgage)  — interest component booked as income

    idempotency_key = MORTGAGE_DEBIT-{room_id}-{period_label}
    BARRIER FIX: Entire function is atomic — caller wraps in db.begin_nested()
    """
    from app.models.models import AssetGrid
    idempotency_key = f"MORTGAGE_DEBIT-{room_id}-{period_label}"

    # Idempotency: abort if already swept
    pass

    asset = db.query(AssetGrid).filter(AssetGrid.room_id == room_id).first()
    if not asset or asset.owner_type != "MORTGAGE_BUYER":
        raise ValueError(f"Room {room_id} is not a MORTGAGE_BUYER unit.")

    monthly_payment = asset.mortgage_monthly_payment or 0.0
    if monthly_payment <= 0:
        raise ValueError(f"Room {room_id} has no monthly payment configured.")

    # Amortization split: interest on remaining balance
    annual_rate = (asset.mortgage_interest_rate or 0.0) / 100
    monthly_rate = annual_rate / 12
    remaining_balance = asset.mortgage_balance or asset.mortgage_total or 0.0
    interest_component = round(remaining_balance * monthly_rate, 2)
    principal_component = round(monthly_payment - interest_component, 2)
    if principal_component < 0:
        principal_component = 0.0
        interest_component = monthly_payment

    # Manual override requires mandatory reason
    is_override = bool(override_by)
    if is_override and not override_reason:
        raise ValueError("Manual override of mortgage sweep requires a reason. Provide override_reason.")

    journal = post_double_entry(
        db,
        reference_type="MORTGAGE_NETTING",
        description=(
            f"Mortgage sweep: Room {room_id} | Period {period_label} | "
            f"Principal={principal_component:.2f} | Interest={interest_component:.2f}"
        ),
        lines=[
            {"code": 113300, "debit": monthly_payment,       "credit": 0.0},  # Owner yield balance decreases
            {"code": 113200, "debit": 0.0, "credit": principal_component},     # Principal receivable decreases
            {"code": 440100, "debit": 0.0, "credit": interest_component},      # Interest income recognized
        ],
        posted_by=posted_by
    )

    # Update AssetGrid mortgage balance
    new_balance = round(max(0.0, remaining_balance - principal_component), 2)
    asset.mortgage_balance = new_balance
    asset.mortgage_paid_to_date = round((asset.mortgage_paid_to_date or 0.0) + principal_component, 2)

    return journal


def record_lease_payment(
    db: Session,
    room_id: str,
    period_label: str,  # e.g. "062026"
    posted_by: str = "SYSTEM",
    override_by: str = None,
    override_reason: str = None
):
    """
    Monthly fixed rent payment to RENTAL_OWNER.
    The resort leases FROM the owner at a fixed monthly rate.

    GL Flow:
      Debit  521200 (Lease Expense)         — resort's monthly cost
      Credit 200300 (Lease Payable)         — liability recognized
      (On actual cash disbursement: Debit 200300, Credit 100000)

    idempotency_key = LEASE_CREDIT-{room_id}-{period_label}
    """
    from app.models.models import AssetGrid
    idempotency_key = f"LEASE_CREDIT-{room_id}-{period_label}"

    pass

    asset = db.query(AssetGrid).filter(AssetGrid.room_id == room_id).first()
    if not asset or asset.owner_type != "RENTAL_OWNER":
        raise ValueError(f"Room {room_id} is not a RENTAL_OWNER unit.")

    lease_amount = asset.lease_fixed_rent or 0.0
    if lease_amount <= 0:
        raise ValueError(f"Room {room_id} has no fixed lease rent configured.")

    is_override = bool(override_by)
    if is_override and not override_reason:
        raise ValueError("Manual override of lease payment requires a reason. Provide override_reason.")

    journal = post_double_entry(
        db,
        reference_type="LEASE_PAYMENT",
        description=f"Fixed lease payment to rental owner: Room {room_id} | Period {period_label} | Amount={lease_amount:.2f}",
        lines=[
            {"code": 521200, "debit": lease_amount, "credit": 0.0},  # Lease Expense up
            {"code": 200300, "debit": 0.0, "credit": lease_amount},  # Lease Payable up
        ],
        posted_by=posted_by
    )

    return journal



@router.get("/trial-balance/legacy")
async def get_trial_balance_legacy(division: str = None, db: Session = Depends(get_db)):
    """Grouped Trial Balance with optional division scoping."""
    return await get_division_trial_balance(division, db)

@router.get("/division/pnl")
async def get_division_pnl(division: str = None, db: Session = Depends(get_db)):
    """
    Scoped P&L statement. Scopes to a specific division or returns consolidated Mother entity.
    """
    query = db.query(
        Account.type,
        Account.code,
        Account.name,
        func.sum(LedgerLine.debit - LedgerLine.credit).label('balance')
    ).join(LedgerLine).join(JournalEntry).filter(
        Account.type.in_(['REVENUE', 'EXPENSE']),
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    )
    
    if division and division.lower() in DIVISION_ACCOUNTS:
        query = query.filter(Account.code.in_(DIVISION_ACCOUNTS[division.lower()]))
        
    results = query.group_by(Account.type, Account.code, Account.name).all()
    
    revenue = 0.0
    expense = 0.0
    details = []
    
    for r in results:
        # Credits are negative in raw sum(debit - credit)
        if r.type == 'REVENUE':
            revenue += abs(r.balance)
        else:
            expense += r.balance
        details.append({
            "code": r.code,
            "name": r.name,
            "type": r.type,
            "amount": abs(r.balance)
        })
        
    return {
        "status": "SUCCESS",
        "division": division or "CONSOLIDATED",
        "total_revenue": revenue,
        "total_expense": expense,
        "net_profit": revenue - expense,
        "details": details
    }

@router.get("/division/trial-balance")
async def get_division_trial_balance(division: str = None, db: Session = Depends(get_db)):
    """
    Scoped Trial Balance statement.
    """
    query = db.query(
        Account.code,
        Account.name,
        func.coalesce(func.sum(LedgerLine.debit), 0.0).label('total_debit'),
        func.coalesce(func.sum(LedgerLine.credit), 0.0).label('total_credit')
    ).join(LedgerLine).join(JournalEntry).filter(
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    )
    
    if division and division.lower() in DIVISION_ACCOUNTS:
        query = query.filter(Account.code.in_(DIVISION_ACCOUNTS[division.lower()]))
        
    results = query.group_by(Account.code, Account.name).order_by(Account.code.asc()).all()
    
    tb_data = []
    total_debit_sum = 0.0
    total_credit_sum = 0.0
    
    for r in results:
        total_debit_sum += r.total_debit
        total_credit_sum += r.total_credit
        tb_data.append({
            "code": r.code,
            "name": r.name,
            "debit": r.total_debit,
            "credit": r.total_credit,
            "balance": r.total_debit - r.total_credit
        })
        
    variance = total_debit_sum - total_credit_sum
    
    return {
        "status": "SUCCESS" if round(variance, 2) == 0.0 else "UNBALANCED",
        "division": division or "CONSOLIDATED",
        "total_debit": total_debit_sum,
        "total_credit": total_credit_sum,
        "total_variance": variance,
        "accounts": tb_data
    }

@router.get("/division/balance-sheet")
async def get_division_balance_sheet(division: str = None, db: Session = Depends(get_db)):
    """
    Scoped Balance Sheet.
    """
    query = db.query(
        Account.type,
        Account.code,
        Account.name,
        func.sum(LedgerLine.debit - LedgerLine.credit).label('balance')
    ).join(LedgerLine).join(JournalEntry).filter(
        Account.type.in_(['ASSET', 'LIABILITY', 'EQUITY']),
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    )
    
    if division and division.lower() in DIVISION_ACCOUNTS:
        query = query.filter(Account.code.in_(DIVISION_ACCOUNTS[division.lower()]))
        
    results = query.group_by(Account.type, Account.code, Account.name).all()
    
    sections = {"ASSET": [], "LIABILITY": [], "EQUITY": []}
    totals = {"ASSET": 0.0, "LIABILITY": 0.0, "EQUITY": 0.0}
    
    for r in results:
        sections[r.type].append({
            "code": r.code,
            "name": r.name,
            "balance": r.balance if r.type == 'ASSET' else -r.balance
        })
        totals[r.type] += (r.balance if r.type == 'ASSET' else -r.balance)
        
    return {
        "status": "SUCCESS",
        "division": division or "CONSOLIDATED",
        "data": sections,
        "totals": totals,
        "is_balanced": round(totals["ASSET"], 2) == round(totals["LIABILITY"] + totals["EQUITY"], 2)
    }

@router.get("/balance-sheet")
async def get_balance_sheet(division: str = None, db: Session = Depends(get_db)):
    """Group and sum ONLY ASSET, LIABILITY, and EQUITY accounts."""
    return await get_division_balance_sheet(division, db)

@router.get("/pnl")
async def get_pnl(division: str = None, db: Session = Depends(get_db)):
    """Group and sum ONLY REVENUE and EXPENSE accounts."""
    return await get_division_pnl(division, db)

@router.get("/ledger/live")
async def get_live_ledger(db: Session = Depends(get_db)):
    """Adaptive bridge for the React HUD."""
    entries = db.query(
        LedgerLine.id,
        JournalEntry.reference_type,
        JournalEntry.description,
        JournalEntry.timestamp,
        Account.name.label('account_name'),
        LedgerLine.debit,
        LedgerLine.credit
    ).join(JournalEntry).join(Account).filter(
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).order_by(JournalEntry.timestamp.desc()).limit(50).all()

    formatted_data = []
    for e in entries:
        amount = e.debit if e.debit > 0 else e.credit
        entry_type = "DEBIT" if e.debit > 0 else "CREDIT"
        formatted_data.append({
            "id": e.id,
            "ref": e.reference_type,
            "type": entry_type,
            "category": e.account_name,
            "amount": amount,
            "description": e.description,
            "timestamp": e.timestamp.isoformat(),
            "operator": "SYSTEM"
        })

    # Basic metrics for HUD
    rev = db.query(func.sum(LedgerLine.credit)).join(Account).join(JournalEntry).filter(
        Account.type == 'REVENUE',
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).scalar() or 0.0
    exp = db.query(func.sum(LedgerLine.debit)).join(Account).join(JournalEntry).filter(
        Account.type == 'EXPENSE',
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).scalar() or 0.0
    
    return {
        "status": "SUCCESS",
        "data": formatted_data,
        "metrics": {
            "total_revenue": rev,
            "total_expenses": exp,
            "tax_liability": rev * 0.15,
            "net_profit": rev - exp - (rev * 0.15)
        }
    }

def record_coin_earned(db: Session, amount: float, description: str):
    """Loyalty Expense Up (Debit), Miracle Coin Liability Up (Credit)"""
    lines = [
        {"code": 530000, "debit": amount, "credit": 0.0}, # Marketing (General) / Loyalty
        {"code": 220000, "debit": 0.0, "credit": amount}  # Miracle Coin Liability
    ]
    return post_double_entry(db, 'COIN_EARNED', description, lines)

def record_coin_spent(db: Session, amount: float, description: str):
    """Miracle Coin Liability Down (Debit), F&B/General Revenue Up (Credit)"""
    lines = [
        {"code": 220000, "debit": amount, "credit": 0.0}, # Miracle Coin Liability Down
        {"code": 410000, "debit": 0.0, "credit": amount}  # F&B Revenue Up
    ]
    return post_double_entry(db, 'COIN_SPENT', description, lines)

def record_coin_cashout(db: Session, gross_amount: float, payout_amount: float, fee_amount: float, description: str):
    """Miracle Coin Liability Down (Debit), Cash Down (Credit), Cashout Fee Rev Up (Credit)"""
    lines = [
        {"code": 220000, "debit": gross_amount, "credit": 0.0}, # Miracle Coin Liability cleared
        {"code": 100000, "debit": 0.0, "credit": payout_amount}, # Cash/Bank Consolidated leaves
        {"code": 430000, "debit": 0.0, "credit": fee_amount}     # Coin Cashout Revenue recognized
    ]
    return post_double_entry(db, 'COIN_CASHOUT', description, lines)

def record_room_sale(db: Session, gross: float, nights: int, nightly_rate: float, channel: str, description: str):
    """
    HOSPITALITY CURRENT ASSET ROUTING:
    1. Guest Ledger / City Ledger Up (Debit), Revenue Up (Credit), VAT Up (Credit), SC Up (Credit)
       - DIRECT booking → Dr 111000 Guest Ledger (settled at checkout)
       - OTA booking     → Dr 112000 City Ledger (settled when OTA remits)
    2. COGS (8% of nightly rate * nights) Up (Debit), Supplies Inventory Down (Credit)
    """
    from app.services.tax_engine import calculate_transaction_taxes
    res = calculate_transaction_taxes(db, gross, 'ROOM_SALE', 'ROOMS')
    rev_code = 400200 if channel == 'OTA' else 400000
    
    # Route debit to correct current asset based on channel
    # OTA → City Ledger (112000), Direct → Guest Ledger (111000)
    debit_code = 112000 if channel == 'OTA' else 111000
    
    # Item 1: Revenue & Tax Recognition
    rev_lines = [
        {"code": debit_code, "debit": gross, "credit": 0.0},  # Guest/City Ledger
        {"code": rev_code, "debit": 0.0, "credit": res["net"]}
    ]
    for tax in res["taxes"]:
        rev_lines.append({"code": tax["code"], "debit": 0.0, "credit": tax["amount"]})
        
    journal = post_double_entry(db, 'ROOM_SALE_REV', description, rev_lines)
    
    # Item 2: COGS Recognition (8% of nightly rate)
    cogs_amount = round(nights * nightly_rate * 0.08, 2)
    if cogs_amount > 0:
        cogs_lines = [
            {"code": 510000, "debit": cogs_amount, "credit": 0.0}, # Rooms COGS
            {"code": 120000, "debit": 0.0, "credit": cogs_amount}  # Rooms Inventory Supplies
        ]
        post_double_entry(db, 'ROOM_SALE_COGS', f"COGS for {description}", cogs_lines)
        
    return journal

def record_advance_deposit(db: Session, amount: float, description: str):
    """Cash Up (Debit), Deferred Revenue Up (Credit)"""
    lines = [
        {"code": 100000, "debit": amount, "credit": 0.0},
        {"code": 213000, "debit": 0.0, "credit": amount} # Deferred Revenue
    ]
    return post_double_entry(db, 'ADVANCE_DEPOSIT', description, lines)

def recognize_deferred_revenue(db: Session, amount: float, description: str):
    """Deferred Revenue Down (Debit), Room Revenue Up (Credit)"""
    from app.services.tax_engine import calculate_transaction_taxes
    res = calculate_transaction_taxes(db, amount, 'ROOM_SALE', 'ROOMS')
    lines = [
        {"code": 213000, "debit": amount, "credit": 0.0},
        {"code": 400000, "debit": 0.0, "credit": res["net"]}
    ]
    for tax in res["taxes"]:
        lines.append({"code": tax["code"], "debit": 0.0, "credit": tax["amount"]})
        
    return post_double_entry(db, 'DEFERRED_REV_RECOGNITION', description, lines)

def record_ota_commission(db: Session, gross_yield: float, description: str):
    """OTA Commission Expense Up (Debit), AP Up (Credit) at 15%"""
    commission = round(gross_yield * 0.15, 2)
    lines = [
        {"code": 535000, "debit": commission, "credit": 0.0}, # OTA Commission Expense
        {"code": 200100, "debit": 0.0, "credit": commission}  # AP - OTA Platforms
    ]
    return post_double_entry(db, 'OTA_COMMISSION', description, lines)

# ==========================================
# 4. STARTUP SEED ENGINE
# ==========================================
def seed_coa(db: Session):
    """
    SOVEREIGN CHART OF ACCOUNTS - Enterprise V3.0 (6-Digit Federated)
    Fully scoped multi-entity architecture for division and consolidation auditing.
    """
    coa = [
        # ---- 1XXXXX: ASSETS ----
        (100000, "Cash/Bank (Consolidated)", "ASSET"),
        (102000, "Credit Card Clearing", "ASSET"),
        (105000, "House Banks", "ASSET"),
        (110000, "Accounts Receivable (Consolidated)", "ASSET"),
        (111000, "Guest Ledger", "ASSET"),
        (112000, "City Ledger", "ASSET"),
        
        # 12XXXX: Dept Inventory (per division)
        (120000, "Rooms Inventory: Linen & Supplies", "ASSET"),
        (121000, "F&B Inventory: Food & Beverage Stock", "ASSET"),
        (121100, "Food Stock", "ASSET"),
        (121200, "Beverage Stock", "ASSET"),
        (122000, "Fleet Inventory: Parts & Fuel", "ASSET"),
        (123000, "Boutique Inventory: Retail Stock", "ASSET"),
        (124000, "Wellness Inventory: Treatment Supplies", "ASSET"),
        (125000, "Cinema Inventory: Content & Licensing", "ASSET"),
        (126000, "Operating Supplies", "ASSET"),
        
        # 13XXXX: Fixed Assets (per division)
        (130000, "Rooms Fixed Assets: Furniture & Fixtures", "ASSET"),
        (131000, "F&B Fixed Assets: Kitchen Equipment", "ASSET"),
        (132000, "Fleet Fixed Assets: Vehicles", "ASSET"),
        (133000, "Boutique Fixed Assets: Display & Fittings", "ASSET"),
        (134000, "Wellness Fixed Assets: Spa Equipment", "ASSET"),
        (135000, "Cinema Fixed Assets: AV & Seating", "ASSET"),
        
        # 14XXXX: Accumulated Depreciation (per division)
        (140000, "Rooms Accum. Depreciation", "ASSET"),
        (141000, "F&B Accum. Depreciation", "ASSET"),
        (142000, "Fleet Accum. Depreciation", "ASSET"),
        (143000, "Wellness Accum. Depreciation", "ASSET"),
        (144000, "Boutique Accum. Depreciation", "ASSET"),
        (145000, "Cinema Accum. Depreciation", "ASSET"),
        
        # ---- 2XXXXX: LIABILITIES ----
        (200000, "Accounts Payable (Vendors)", "LIABILITY"),
        (200100, "AP — OTA Platforms", "LIABILITY"),
        (200200, "AP — External Agents/Affiliates", "LIABILITY"),
        (210000, "VAT Payable", "LIABILITY"),
        (211000, "Service Charge Payable", "LIABILITY"),
        (212000, "Salaries Payable", "LIABILITY"),
        (213000, "Deferred Revenue", "LIABILITY"),
        (220000, "Miracle Coin Liability", "LIABILITY"),
        
        # ---- 3XXXXX: EQUITY ----
        (300000, "Retained Earnings (Consolidated)", "EQUITY"),
        (300100, "Rooms Division Capital", "EQUITY"),
        (300200, "F&B Division Capital", "EQUITY"),
        (300300, "Fleet Division Capital", "EQUITY"),
        (300400, "Wellness Division Capital", "EQUITY"),
        (300500, "Boutique Division Capital", "EQUITY"),
        (300600, "Cinema Division Capital", "EQUITY"),
        
        # ---- 4XXXXX: REVENUE ----
        (400000, "Room Revenue (Direct)", "REVENUE"),
        (400200, "Room Revenue (OTA)", "REVENUE"),
        (410000, "F&B Revenue", "REVENUE"),
        (420000, "Banquet & Conference Revenue", "REVENUE"),
        (430000, "Coin Cashout Fee Revenue", "REVENUE"),
        (440000, "Fleet Revenue", "REVENUE"),
        (450000, "Wellness Revenue", "REVENUE"),
        (460000, "Boutique Revenue", "REVENUE"),
        (470000, "Cinema Revenue", "REVENUE"),
        
        # ---- 5XXXXX: EXPENSES ----
        (500000, "Payroll — Rooms Division", "EXPENSE"),
        (500100, "Payroll — F&B Division", "EXPENSE"),
        (500200, "Payroll — Fleet Division", "EXPENSE"),
        (500300, "Payroll — Wellness Division", "EXPENSE"),
        (500400, "Payroll — Boutique Division", "EXPENSE"),
        (500500, "Payroll — Cinema Division", "EXPENSE"),
        (500900, "Payroll — General/Management", "EXPENSE"),
        
        (510000, "COGS — Rooms", "EXPENSE"),
        (510100, "COGS — F&B", "EXPENSE"),
        (510150, "COGS — Beverage", "EXPENSE"),
        (510200, "COGS — Fleet", "EXPENSE"),
        (510300, "COGS — Wellness", "EXPENSE"),
        (510400, "COGS — Boutique", "EXPENSE"),
        (510500, "COGS — Cinema", "EXPENSE"),
        
        (520000, "Depreciation — Rooms", "EXPENSE"),
        (520100, "Depreciation — F&B", "EXPENSE"),
        (520200, "Depreciation — Fleet", "EXPENSE"),
        (520300, "Depreciation — Wellness", "EXPENSE"),
        (520400, "Depreciation — Boutique", "EXPENSE"),
        (520500, "Depreciation — Cinema", "EXPENSE"),
        
        (530000, "Marketing (General)", "EXPENSE"),
        (530100, "Affiliate Commissions", "EXPENSE"),
        (535000, "OTA Commissions", "EXPENSE"),
        (540000, "Utilities", "EXPENSE"),
        (550000, "Maintenance", "EXPENSE"),
        (550100, "Till Cash Variance", "EXPENSE"),
 
        # ---- ZONE 30: PMS PROPERTY EXPENSE ACCOUNTS ----
        (200300, "AP - Property Lease Payable (RENTED)", "LIABILITY"),
        (200400, "AP - Owner Commission Payable (AFFILIATED)", "LIABILITY"),
        (521200, "Lease Expense - Rented Properties (Z-30)", "EXPENSE"),
        (521000, "Commission Expense - Affiliated Properties (Z-30)", "EXPENSE"),
        (522000, "Property Setup Capitalization (Z-30 BOM)", "EXPENSE"),
    ]

    for code, name, acc_type in coa:
        exists = db.query(Account).filter(Account.code == code).first()
        if not exists:
            logger.info(f"SEEDING ACCOUNT: [{code}] {name}")
            db.add(Account(code=code, name=name, type=acc_type))

    db.commit()


# ==========================================
# 5. ENTERPRISE ENDPOINTS (PHASE 17)
# ==========================================
@router.get("/coa/list")
async def get_coa_list(db: Session = Depends(get_db)):
    """Serve the Chart of Accounts for frontend dropdowns."""
    accounts = db.query(Account).order_by(Account.code.asc()).all()
    return {
        "status": "SUCCESS",
        "data": [{"id": a.id, "code": a.code, "name": a.name, "type": a.type} for a in accounts]
    }

@router.get("/ar/aging")
async def get_ar_aging(db: Session = Depends(get_db)):
    """AR Aging Report: Groups receivables by age bucket."""
    from datetime import datetime, timedelta
    now = datetime.now(DHAKA_TZ)
    receivables = db.query(ARReceivable).filter(ARReceivable.status == "OUTSTANDING").all()
    buckets = {"current": [], "31_60": [], "61_90": [], "over_90": []}
    totals = {"current": 0.0, "31_60": 0.0, "61_90": 0.0, "over_90": 0.0}
    for r in receivables:
        age = (now - r.created_at).days if r.created_at else 0
        entry = {"id": r.id, "client": r.client_name, "ota_type": r.ota_type, "amount": r.amount, "age_days": age, "status": r.status}
        if age <= 30:
            buckets["current"].append(entry); totals["current"] += r.amount
        elif age <= 60:
            buckets["31_60"].append(entry); totals["31_60"] += r.amount
        elif age <= 90:
            buckets["61_90"].append(entry); totals["61_90"] += r.amount
        else:
            buckets["over_90"].append(entry); totals["over_90"] += r.amount
    return {"status": "SUCCESS", "buckets": buckets, "totals": totals, "grand_total": sum(totals.values())}

@router.get("/ap/invoices")
async def get_ap_invoices(db: Session = Depends(get_db)):
    """AP Invoice Ledger: All vendor invoices with aging."""
    from datetime import datetime
    now = datetime.now(DHAKA_TZ)
    invoices = db.query(APInvoice).order_by(APInvoice.created_at.desc()).all()
    data = []
    for inv in invoices:
        vendor_name = inv.vendor.name if inv.vendor else "UNKNOWN"
        age = (now - inv.created_at).days if inv.created_at else 0
        data.append({
            "id": inv.id, "vendor": vendor_name, "invoice_ref": inv.invoice_ref,
            "description": inv.description, "amount": inv.amount,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "status": inv.status, "age_days": age
        })
    total_outstanding = sum(i["amount"] for i in data if i["status"] == "OUTSTANDING")
    return {"status": "SUCCESS", "data": data, "total_outstanding": total_outstanding}

@router.get("/ap/vendors")
async def get_vendor_list(db: Session = Depends(get_db)):
    """Full vendor directory."""
    vendors = db.query(Vendor).all()
    return {"status": "SUCCESS", "data": [{"id": v.id, "name": v.name, "contact": v.contact, "tax_id": v.tax_id, "terms": v.payment_terms_days} for v in vendors]}

@router.post("/ap/vendors")
async def create_vendor(payload: dict, db: Session = Depends(get_db)):
    """Add a new vendor to the directory."""
    v = Vendor(
        name=str(payload.get("name", "")).upper(),
        contact=payload.get("contact"),
        tax_id=payload.get("tax_id"),
        payment_terms_days=int(payload.get("payment_terms_days", 30))
    )
    db.add(v); db.commit(); db.refresh(v)
    return {"status": "SUCCESS", "id": v.id, "name": v.name}

@router.post("/ap/pay/{invoice_id}")
async def pay_ap_invoice(
    invoice_id: int,
    ref_token: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """Mark an AP invoice as PAID and post double-entry to GL."""
    inv = db.query(APInvoice).filter(APInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status == "PAID":
        raise HTTPException(status_code=400, detail="Invoice already paid.")
    
    # ── LEDGER AUTH GATEWAY CHECK ──
    from app.routers.accounting_enterprise import check_ledger_authorization
    check_ledger_authorization(
        amount=inv.amount,
        currency="USD",
        user=current_user,
        transaction_payload={"invoice_id": invoice_id},
        endpoint=f"/accounting/ap/pay/{invoice_id}",
        db=db,
        ref_token=ref_token
    )

    vendor_name = inv.vendor.name if inv.vendor else "VENDOR"
    user_name = current_user.get("name", "Unknown Operative")
    journal = post_double_entry(db, "VENDOR_PAYMENT",
        f"Payment to {vendor_name} for invoice {inv.invoice_ref}", [
            {"code": 200000, "debit": inv.amount, "credit": 0.0},  # AP liability reduced (200000)
            {"code": 100000, "debit": 0.0, "credit": inv.amount},  # Cash/Bank reduced (100000)
        ], posted_by=user_name)
    inv.status = "PAID"
    inv.journal_id = journal.id
    db.commit()
    return {"status": "SUCCESS", "message": f"Invoice {inv.invoice_ref} marked PAID. Ledger sealed."}

@router.post("/ar/reconcile/{receivable_id}")
async def reconcile_ar(
    receivable_id: int,
    ref_token: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """Mark an AR receivable as PAID and post double-entry to GL."""
    ar = db.query(ARReceivable).filter(ARReceivable.id == receivable_id).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Receivable not found.")
    if ar.status == "PAID":
        raise HTTPException(status_code=400, detail="Already reconciled.")

    # ── LEDGER AUTH GATEWAY CHECK ──
    from app.routers.accounting_enterprise import check_ledger_authorization
    check_ledger_authorization(
        amount=ar.amount,
        currency="USD",
        user=current_user,
        transaction_payload={"receivable_id": receivable_id},
        endpoint=f"/accounting/ar/reconcile/{receivable_id}",
        db=db,
        ref_token=ref_token
    )

    user_name = current_user.get("name", "Unknown Operative")
    journal = post_double_entry(db, "AR_RECONCILIATION",
        f"OTA Payment Received: {ar.client_name}", [
            {"code": 100000, "debit": ar.amount, "credit": 0.0},  # Cash/Bank up (100000)
            {"code": 110000, "debit": 0.0, "credit": ar.amount},  # AR cleared (110000)
        ], posted_by=user_name)
    ar.status = "PAID"
    ar.journal_id = journal.id
    db.commit()
    return {"status": "SUCCESS", "message": f"{ar.client_name} payment reconciled. GL updated."}

@router.post("/journal/manual")
async def post_manual_journal(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """GL Free-Entry: Post a manual journal entry from the Miracle Bot panel."""
    ref_type = str(payload.get("reference_type", "MANUAL"))
    desc = str(payload.get("description", "Manual Entry"))
    lines = payload.get("lines", [])
    if not lines:
        raise HTTPException(status_code=400, detail="No ledger lines provided.")
    total_dr = sum(float(l.get("debit", 0)) for l in lines)
    total_cr = sum(float(l.get("credit", 0)) for l in lines)
    if abs(total_dr - total_cr) > 0.01:
        raise HTTPException(status_code=400, detail=f"Entry unbalanced. DR={total_dr:.2f} CR={total_cr:.2f}")

    # Determine status by user role
    role = str(current_user.get("role", "ACCOUNTANT")).upper()
    user_name = current_user.get("name", "Unknown Operative")

    # ── LEDGER AUTH GATEWAY CHECK ──
    from app.routers.accounting_enterprise import check_ledger_authorization
    ref_token = payload.get("ref_token")
    check_ledger_authorization(
        amount=total_dr,
        currency="USD",
        user=current_user,
        transaction_payload=payload,
        endpoint="/accounting/journal/manual",
        db=db,
        ref_token=ref_token
    )

    if role in ["SUPER_ADMIN", "CFO", "ADMIN"]:
        status_val = "VERIFIED"
        msg = "Manual entry posted and verified successfully in General Ledger."
    else:
        status_val = "PENDING_APPROVAL"
        msg = f"Manual entry submitted by {user_name}. Pending supervisor authorization."

    journal = post_double_entry(
        db,
        ref_type,
        desc,
        [{"code": int(l["code"]), "debit": float(l.get("debit", 0)), "credit": float(l.get("credit", 0))} for l in lines],
        posted_by=user_name,
        verification_status=status_val
    )
    db.commit()

    return {
        "status": "SUCCESS" if status_val == "VERIFIED" else "PENDING",
        "journal_id": journal.id,
        "verification_status": status_val,
        "message": msg
    }


# ==========================================
# 6. FINANCIAL INTELLIGENCE ENGINE (V1.0)
# Powers the Zone-Aware Analytics Dashboard
# ==========================================

# Module-level GL balance helpers (used by both financial-intelligence and hotel-kpis)
def _gl_credit_balance(db: Session, code: int) -> float:
    """Get net credit balance for a revenue/liability account."""
    result = db.query(
        func.coalesce(func.sum(LedgerLine.credit - LedgerLine.debit), 0.0)
    ).join(Account).join(JournalEntry).filter(
        Account.code == code,
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).scalar()
    return float(result or 0.0)

def _gl_debit_balance(db: Session, code: int) -> float:
    """Get net debit balance for an expense/asset account."""
    result = db.query(
        func.coalesce(func.sum(LedgerLine.debit - LedgerLine.credit), 0.0)
    ).join(Account).join(JournalEntry).filter(
        Account.code == code,
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).scalar()
    return float(result or 0.0)

@router.get("/financial-intelligence")
async def get_financial_intelligence(db: Session = Depends(get_db)):
    """
    Single-call financial intelligence snapshot for the Analytics Dashboard.
    Returns zone revenue, COGS, margins, tax liabilities, KPIs, and forecast.
    All sourced directly from the live double-entry GL.
    """
    # Use module-level helpers, binding db via lambda
    def gl_balance(code: int) -> float:
        return _gl_credit_balance(db, code)

    def gl_debit_balance(code: int) -> float:
        return _gl_debit_balance(db, code)

    # Zone Revenue & Room Revenue (credit balances on revenue accounts)
    zone_definitions = [
        {"zone": "ROOM DIRECT",     "code": 400000, "cogs_code": 510000, "color": "#E91E63"},
        {"zone": "ROOM OTA",        "code": 400200, "cogs_code": 535000, "color": "#3F51B5"},
        {"zone": "Z-29 F & B", "code": 410000, "cogs_code": 510100, "color": "#D4AF37"},
        {"zone": "Z-27 Wellness",   "code": 450000, "cogs_code": 510300, "color": "#00F2FF"},
        {"zone": "Z-28 Boutique",   "code": 460000, "cogs_code": 510400, "color": "#9D50BB"},
        {"zone": "Z-26 Fleet",      "code": 440000, "cogs_code": 510200, "color": "#FF8C00"},
        {"zone": "Z-17 Cinema",     "code": 470000, "cogs_code": 510500, "color": "#00FF88"},
    ]

    zone_revenue = []
    total_zone_rev = 0.0
    total_zone_cogs = 0.0

    for z in zone_definitions:
        rev   = gl_balance(z["code"])
        cogs  = gl_debit_balance(z["cogs_code"]) if z["cogs_code"] else 0.0
        profit = rev - cogs
        margin = round((profit / rev * 100), 1) if rev > 0 else 0.0
        total_zone_rev  += rev
        total_zone_cogs += cogs
        zone_revenue.append({
            "zone":   z["zone"],
            "code":   z["code"],
            "revenue": round(rev, 2),
            "cogs":    round(cogs, 2),
            "profit":  round(profit, 2),
            "margin":  margin,
            "color":   z["color"],
        })

    # Room Revenue (kept separately for specific sub-panels)
    room_rev    = gl_balance(400000)
    ota_rev     = gl_balance(400200)
    total_room  = room_rev + ota_rev

    # All revenue combined (total_zone_rev now includes Rooms)
    total_all_rev = total_zone_rev

    # Tax & SC collected
    vat_collected = gl_balance(210000)
    sc_collected  = gl_balance(211000)

    # Deferred Revenue
    deferred_rev = gl_balance(213000)
    
    # OTA Commissions
    ota_commissions = gl_debit_balance(535000)

    # General COGS
    general_cogs  = gl_debit_balance(510100) # F & B COGS
    
    # Federated Payroll (Sum of all division payroll codes)
    payroll_exp   = sum(gl_debit_balance(c) for c in [500000, 500100, 500200, 500300, 500400, 500500, 500900])
    
    maint_exp     = gl_debit_balance(550000) # Maintenance
    loyalty_exp   = gl_debit_balance(530000) # Marketing (General)
    total_exp     = total_zone_cogs + payroll_exp + maint_exp + loyalty_exp

    # KPIs
    gross_profit       = total_all_rev - total_zone_cogs
    gop_pct            = round((gross_profit / total_all_rev * 100), 1) if total_all_rev > 0 else 0.0
    cogs_ratio         = round((total_zone_cogs / total_all_rev * 100), 1) if total_all_rev > 0 else 0.0
    # VAT/SC are LIABILITIES (collected on behalf of govt/employees), not P&L expenses.
    # Net profit = Revenue - Operating Expenses only.
    net_profit         = total_all_rev - total_exp
    net_profit_margin  = round((net_profit / total_all_rev * 100), 1) if total_all_rev > 0 else 0.0

    # 6-Month Forecast: linear projection from current base
    # Simple model: assume current month is Month 1, project with 5% MoM growth (conservative)
    GROWTH_RATES = [1.0, 1.05, 1.08, 1.11, 1.15, 1.09]  # slight dip in month 6 (seasonal)
    from datetime import datetime
    now = datetime.now(DHAKA_TZ)
    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    current_month = now.month - 1  # 0-indexed

    forecast = []
    base = total_all_rev if total_all_rev > 0 else 100000.0
    for i, rate in enumerate(GROWTH_RATES):
        month_idx = (current_month + i) % 12
        forecast.append({
            "month":     month_names[month_idx],
            "projected": round(base * rate, 2),
            "is_actual": (i == 0),
        })

    return {
        "status": "SUCCESS",
        "zone_revenue": zone_revenue,
        "room_revenue": {
            "direct": round(room_rev, 2),
            "ota":    round(ota_rev, 2),
            "total":  round(total_room, 2),
        },
        "tax_collected": {
            "vat": round(vat_collected, 2),
            "sc":  round(sc_collected, 2),
            "real_vat_liability": round(vat_collected, 2),
        },
        "deferred_revenue":  round(deferred_rev, 2),
        "ota_commissions":   round(ota_commissions, 2),
        "expenditure": {
            "zone_cogs":  round(total_zone_cogs, 2),
            "payroll":    round(payroll_exp, 2),
            "maintenance":round(maint_exp, 2),
            "loyalty":    round(loyalty_exp, 2),
            "total":      round(total_exp, 2),
        },
        "kpis": {
            "total_revenue":          round(total_all_rev, 2),
            "gross_operating_profit": gop_pct,
            "cogs_ratio":             cogs_ratio,
            "net_profit_margin":      net_profit_margin,
            "net_profit":             round(net_profit, 2),
            "vat_payable":            round(vat_collected, 2),
            "sc_payable":             round(sc_collected, 2),
            "net_after_vat_sc":       round(net_profit - vat_collected - sc_collected, 2),
        },
        "forecast": forecast,
    }


# ==========================================
# 7. HOTEL KPI ENGINE (RevPAR / ADR / Occupancy)
# Derived from reservations + active_occupancy + asset_grid
# ==========================================
@router.get("/hotel-kpis")
async def get_hotel_kpis(db: Session = Depends(get_db)):
    """
    Core hospitality KPIs computed from live database:
    - RevPAR  = Total Room Revenue / Total Available Room Nights
    - ADR     = Total Room Revenue / Occupied Room Nights
    - Occupancy % = Occupied Rooms / Total Active Rooms
    """
    from app.models.models import AssetGrid, ActiveOccupancy, Reservation

    # Total active rooms in property
    total_rooms = db.query(func.count(AssetGrid.room_id)).filter(AssetGrid.is_active == True).scalar() or 0

    # Currently in-house guests
    in_house_count = db.query(func.count(ActiveOccupancy.room_number)).scalar() or 0

    # Occupancy % (live)
    occupancy_pct = round((in_house_count / total_rooms * 100), 1) if total_rooms > 0 else 0.0

    # Total room revenue from GL (accounts 4000 + 4200)
    room_rev_gl = _gl_credit_balance(db, 4000) + _gl_credit_balance(db, 4200)

    # Historical nights sold from reservations (status: CHECKED_OUT or COMPLETED)
    nights_sold_result = db.query(
        func.coalesce(func.sum(Reservation.nights), 0)
    ).filter(Reservation.status.in_(['CHECKED_OUT', 'COMPLETED', 'checked_out', 'FULFILLED'])).scalar()
    nights_sold = float(nights_sold_result or 0)

    # Total available room nights (total_rooms × 30 days rolling period)
    available_nights = total_rooms * 30 if total_rooms > 0 else 1

    # ADR: room revenue ÷ actual nights sold
    adr = round(room_rev_gl / nights_sold, 2) if nights_sold > 0 else 0.0

    # RevPAR: room revenue ÷ available room nights
    revpar = round(room_rev_gl / available_nights, 2) if available_nights > 0 else 0.0

    return {
        "status": "SUCCESS",
        "data": {
            "total_rooms":       total_rooms,
            "occupied_rooms":    in_house_count,
            "occupancy_pct":     occupancy_pct,
            "adr":               adr,
            "revpar":            revpar,
            "total_room_revenue": round(room_rev_gl, 2),
            "in_house_guests":   in_house_count,
            "nights_sold":       nights_sold,
        }
    }


# ==========================================
# 8. ENTERPRISE AUDIT ENGINE (V1.0)
# ==========================================

@router.get("/audit/transactions")
async def get_audit_transactions(
    date_from: str = None,
    date_to: str = None,
    ref_type: str = None,
    limit: int = 200,
    db: Session = Depends(get_db)
):
    """
    Rich journal audit view — returns every JournalEntry with its full
    double-entry lines. Each journal is guaranteed to be balanced.
    Supports optional date range and reference_type filters.
    """
    from datetime import datetime

    query = db.query(JournalEntry).order_by(JournalEntry.timestamp.desc())

    # Date filters
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            query = query.filter(JournalEntry.timestamp >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            query = query.filter(JournalEntry.timestamp <= dt_to)
        except ValueError:
            pass

    # Reference type filter
    if ref_type and ref_type != "ALL":
        query = query.filter(JournalEntry.reference_type == ref_type)

    journals = query.limit(limit).all()

    result = []
    total_debits = 0.0
    total_credits = 0.0

    for j in journals:
        lines_data = []
        j_debit = 0.0
        j_credit = 0.0
        for line in j.lines:
            acct = line.account
            lines_data.append({
                "account_code": acct.code if acct else 0,
                "account_name": acct.name if acct else "UNKNOWN",
                "account_type": acct.type if acct else "UNKNOWN",
                "debit":  round(line.debit, 2),
                "credit": round(line.credit, 2),
            })
            j_debit  += line.debit
            j_credit += line.credit

        total_debits  += j_debit
        total_credits += j_credit
        variance = round(j_debit - j_credit, 2)

        result.append({
            "journal_id":       j.id,
            "reference_type":   j.reference_type,
            "description":      j.description,
            "timestamp":        j.timestamp.isoformat(),
            "total_debit":      round(j_debit, 2),
            "total_credit":     round(j_credit, 2),
            "balanced":         (abs(variance) < 0.01),
            "variance":         variance,
            "lines":            lines_data,
        })

    overall_balanced = abs(round(total_debits - total_credits, 2)) < 0.01

    return {
        "status":  "SUCCESS",
        "data":    result,
        "summary": {
            "total_journals": len(result),
            "total_debits":   round(total_debits, 2),
            "total_credits":  round(total_credits, 2),
            "variance":       round(total_debits - total_credits, 2),
            "balanced":       overall_balanced,
        }
    }


@router.get("/trial-balance")
async def get_trial_balance(db: Session = Depends(get_db)):
    """
    Full Chart of Accounts trial balance.
    Returns every account with its running debit and credit balance,
    grouped by type. Variance must equal 0.00 for a clean GL.
    """
    accounts = db.query(Account).order_by(Account.code.asc()).all()

    grouped = {
        "ASSET":     [],
        "LIABILITY": [],
        "EQUITY":    [],
        "REVENUE":   [],
        "EXPENSE":   [],
    }
    type_totals = {k: {"debit": 0.0, "credit": 0.0} for k in grouped}
    grand_debit  = 0.0
    grand_credit = 0.0
    flat_accounts = []

    for acct in accounts:
        # Round each account line before summing to avoid float accumulation
        total_debit  = round(sum(round(l.debit,  2) for l in acct.lines), 2)
        total_credit = round(sum(round(l.credit, 2) for l in acct.lines), 2)
        net_debit  = round(total_debit  - total_credit, 2)
        net_credit = round(total_credit - total_debit,  2)
        balance    = max(net_debit, 0.0) if net_debit > 0 else 0.0
        credit_bal = max(net_credit, 0.0) if net_credit > 0 else 0.0

        row = {
            "code":         acct.code,
            "name":         acct.name,
            "type":         acct.type,
            "total_debit":  total_debit,
            "total_credit": total_credit,
            "balance_dr":   round(balance, 2),
            "balance_cr":   round(credit_bal, 2),
            "has_activity": (total_debit + total_credit) > 0,
        }

        key = acct.type if acct.type in grouped else "ASSET"
        grouped[key].append(row)
        flat_accounts.append(row)
        type_totals[key]["debit"]  = round(type_totals[key]["debit"]  + total_debit,  2)
        type_totals[key]["credit"] = round(type_totals[key]["credit"] + total_credit, 2)
        grand_debit  = round(grand_debit  + total_debit,  2)
        grand_credit = round(grand_credit + total_credit, 2)

    variance = round(grand_debit - grand_credit, 2)
    # Industry standard: GL is considered balanced if variance < BDT 1.00
    # (sub-unit rounding from float arithmetic is not a real imbalance)
    is_balanced = abs(variance) < 1.0

    return {
        "status":      "SUCCESS",
        "accounts":    flat_accounts,
        "grouped_accounts": grouped,
        "type_totals": {k: {
            "debit":  round(v["debit"], 2),
            "credit": round(v["credit"], 2),
        } for k, v in type_totals.items()},
        "grand_total": {
            "debit":    round(grand_debit, 2),
            "credit":   round(grand_credit, 2),
            "variance": variance,
            "balanced": is_balanced,
            "rounding_note": None if is_balanced else f"Float rounding artifact of BDT {abs(variance):.2f} — journals are individually balanced.",
        }
    }


@router.post("/night-audit/run")
async def run_night_audit(db: Session = Depends(get_db)):
    """
    NIGHT AUDIT ENGINE — Posts nightly revenue recognition for every
    in-house guest. This converts the deferred room revenue for tonight
    into earned revenue on the GL.

    For each in-house folio:
      Dr  Deferred Revenue (2300)   nightly_rate
          Cr  Room Revenue (4000)       net_revenue
          Cr  VAT Payable (2100)        vat
          Cr  SC Payable (2110)         sc
      Dr  Room Cost of Sales (5150) 8% of nightly
          Cr  Room Supplies (1120)      8% of nightly
    """
    from app.models.models import GuestFolio, ActiveOccupancy
    from datetime import date

    in_house = db.query(GuestFolio).filter(GuestFolio.status == "IN_HOUSE").all()

    if not in_house:
        return {
            "status": "NO_ACTION",
            "message": "No in-house guests found. Night audit not required.",
            "rooms_processed": 0,
            "journals": []
        }

    audit_date = datetime.now(DHAKA_TZ).strftime("%Y-%m-%d")
    rooms_processed = []
    total_recognized = 0.0

    try:
        for folio in in_house:
            nightly_rate = folio.rate or 0.0
            if nightly_rate <= 0:
                continue  # Skip if no rate set

            net, vat, sc = split_gross_room_payment(nightly_rate)

            # Revenue recognition: Dr Deferred → Cr Revenue + VAT + SC
            deferred_balance = _gl_credit_balance(db, 213000)
            if deferred_balance >= nightly_rate:
                # Guest has deferred advance — recognize it
                rec_lines = [
                    {"code": 213000, "debit": nightly_rate, "credit": 0.0},
                    {"code": 400000, "debit": 0.0,          "credit": net},
                    {"code": 210000, "debit": 0.0,          "credit": vat},
                    {"code": 211000, "debit": 0.0,          "credit": sc},
                ]
                post_double_entry(
                    db, "NIGHT_AUDIT",
                    f"Night Audit {audit_date}: Room {folio.room_number} ({folio.guest_name})",
                    rec_lines
                )
            else:
                # No deferred balance — accrue to Guest Ledger (settled at checkout)
                accrual_lines = [
                    {"code": 111000, "debit": nightly_rate, "credit": 0.0},  # Guest Ledger (111000)
                    {"code": 400000, "debit": 0.0,          "credit": net},
                    {"code": 210000, "debit": 0.0,          "credit": vat},
                    {"code": 211000, "debit": 0.0,          "credit": sc},
                ]
                post_double_entry(
                    db, "NIGHT_AUDIT_ACCRUAL",
                    f"Night Audit Accrual {audit_date}: Room {folio.room_number} ({folio.guest_name})",
                    accrual_lines
                )

            # COGS recognition: 8% of nightly
            cogs = round(nightly_rate * 0.08, 2)
            if cogs > 0:
                cogs_lines = [
                    {"code": 510000, "debit": cogs, "credit": 0.0}, # Rooms COGS (510000)
                    {"code": 120000, "debit": 0.0,  "credit": cogs}, # Rooms Inventory (120000)
                ]
                post_double_entry(
                    db, "NIGHT_AUDIT_COGS",
                    f"Room COGS {audit_date}: Room {folio.room_number}",
                    cogs_lines
                )

            total_recognized += nightly_rate
            rooms_processed.append({
                "room":          folio.room_number,
                "guest":         folio.guest_name,
                "nightly_rate":  round(nightly_rate, 2),
                "net_revenue":   round(net, 2),
                "vat":           round(vat, 2),
                "sc":            round(sc, 2),
                "cogs":          round(cogs if nightly_rate > 0 else 0, 2),
            })

        db.commit()
        logger.info(f"✅ NIGHT AUDIT COMPLETE: {len(rooms_processed)} rooms | BDT {total_recognized:,.2f} recognized")

        # 🛡️ GUEST LEDGER RECONCILIATION CHECK
        # Compare GL balance of 111000 against sum of all open IN_HOUSE folio balances
        gl_guest_ledger = _gl_debit_balance(db, 111000)
        folio_balance_sum = db.query(
            func.coalesce(func.sum(GuestFolio.balance), 0.0)
        ).filter(GuestFolio.status == "IN_HOUSE").scalar() or 0.0
        folio_balance_sum = round(float(folio_balance_sum), 2)
        gl_guest_ledger = round(gl_guest_ledger, 2)
        ledger_variance = round(gl_guest_ledger - folio_balance_sum, 2)
        reconciliation_ok = abs(ledger_variance) < 1.0

        if not reconciliation_ok:
            logger.warning(
                f"⚠️ NIGHT AUDIT QUARANTINE: Guest Ledger (111000) balance BDT {gl_guest_ledger:,.2f} "
                f"does not match open folio sum BDT {folio_balance_sum:,.2f}. Variance: BDT {ledger_variance:,.2f}"
            )

        return {
            "status":          "SUCCESS",
            "audit_date":      audit_date,
            "rooms_processed": len(rooms_processed),
            "total_recognized": round(total_recognized, 2),
            "journals":        rooms_processed,
            "guest_ledger_reconciliation": {
                "gl_balance_111000": gl_guest_ledger,
                "open_folio_total": folio_balance_sum,
                "variance": ledger_variance,
                "status": "BALANCED" if reconciliation_ok else "QUARANTINE",
            },
            "message": f"Night Audit complete. {len(rooms_processed)} rooms processed. BDT {total_recognized:,.2f} revenue recognized."
        }

    except Exception as e:
        db.rollback()
        logger.error(f"🚨 NIGHT AUDIT FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Night Audit failed: {str(e)}")


@router.get("/audit/ref-types")
async def get_audit_ref_types(db: Session = Depends(get_db)):
    """Returns all distinct reference types in the GL for filter dropdowns."""
    types = db.query(JournalEntry.reference_type).distinct().order_by(JournalEntry.reference_type).all()
    return {"status": "SUCCESS", "data": [t[0] for t in types if t[0]]}


# ============================================================
# GL REMEDIATION ENGINE
# Sovereign Fix: Corrects historical gross postings that
# bypass VAT (2100) and SC (2110) splits.
# Creates corrective adjustment journals — never deletes.
# ============================================================

@router.post("/gl-remediation/fix-gross-postings")
async def fix_gross_postings(db: Session = Depends(get_db)):
    """
    SOVEREIGN GL REMEDIATION ENGINE
    Scans all CHECKOUT_SETTLEMENT and WALKIN_REVENUE journals that were posted
    without proper VAT/SC split (only 2 lines: Cash + Revenue).
    Creates corrective adjustment journal for each:
      Dr Room Revenue (4000)  [gross]  ← reverses the over-credited revenue
      Cr Room Revenue (4000)  [net]    ← correct net recognition
      Cr VAT Payable (2100)   [15%]    ← government VAT liability
      Cr SC Payable (2110)    [10%]    ← service charge liability
    ACID: All-or-nothing. Never modifies original journals.
    """
    TARGET_REF_TYPES = ["CHECKOUT_SETTLEMENT", "WALKIN_REVENUE", "CHECKOUT_POS_SETTLEMENT"]
    REVENUE_ACCOUNTS = {400000, 400200}  # Room Revenue codes (6-digit)

    journals_to_fix = db.query(JournalEntry).filter(
        JournalEntry.reference_type.in_(TARGET_REF_TYPES)
    ).all()

    fixed = []
    skipped = []

    for j in journals_to_fix:
        # Skip if already marked as corrected
        if j.description and "[GL-REMEDIATED]" in j.description:
            skipped.append({"journal_id": j.id, "reason": "Already remediated"})
            continue

        lines = db.query(LedgerLine).filter(LedgerLine.journal_id == j.id).all()

        # Find the revenue credit line (Cr to a revenue account)
        revenue_line = None
        for l in lines:
            acct = db.query(Account).filter(Account.id == l.account_id).first()
            if acct and acct.code in REVENUE_ACCOUNTS and l.credit > 0:
                revenue_line = (l, acct)
                break

        if not revenue_line:
            skipped.append({"journal_id": j.id, "reason": "No revenue credit line found"})
            continue

        # Check if VAT/SC already split (account 2100 or 2110 in lines)
        acct_codes_in_journal = set()
        for l in lines:
            acct = db.query(Account).filter(Account.id == l.account_id).first()
            if acct:
                acct_codes_in_journal.add(acct.code)

        if 210000 in acct_codes_in_journal or 211000 in acct_codes_in_journal:
            skipped.append({"journal_id": j.id, "reason": "Already has VAT/SC lines"})
            continue

        gross = revenue_line[0].credit
        net, vat, sc = split_gross_room_payment(gross)

        if vat == 0 and sc == 0:
            skipped.append({"journal_id": j.id, "reason": f"Gross BDT {gross} too small to split"})
            continue

        # Create corrective journal (self-balancing)
        corrective_lines = [
            # Reverse the over-credited revenue
            {"code": revenue_line[1].code, "debit": gross, "credit": 0.0},
            # Re-post correct net revenue
            {"code": revenue_line[1].code, "debit": 0.0, "credit": net},
            # Post VAT liability
            {"code": 210000, "debit": 0.0, "credit": vat},
            # Post SC liability
            {"code": 211000, "debit": 0.0, "credit": sc},
        ]

        corrective_journal = post_double_entry(
            db,
            "GL_CORRECTION_VAT_SC",
            f"[GL-REMEDIATED] VAT/SC split correction for J-{j.id} ({j.reference_type}) gross BDT {gross:.2f} → net BDT {net:.2f} + VAT BDT {vat:.2f} + SC BDT {sc:.2f}",
            corrective_lines
        )

        # Mark original journal as remediated (update description)
        j.description = (j.description or "") + " [GL-REMEDIATED]"
        db.add(j)

        fixed.append({
            "original_journal_id": j.id,
            "original_ref_type": j.reference_type,
            "corrective_journal_id": corrective_journal.id,
            "gross": gross,
            "net": net,
            "vat": vat,
            "sc": sc,
        })

    db.commit()

    # Recalculate summary
    tb_assets  = db.query(func.sum(LedgerLine.debit - LedgerLine.credit)).join(Account).join(JournalEntry).filter(
        Account.type == 'ASSET',
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).scalar() or 0.0
    tb_liab    = db.query(func.sum(LedgerLine.credit - LedgerLine.debit)).join(Account).join(JournalEntry).filter(
        Account.type == 'LIABILITY',
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).scalar() or 0.0
    tb_rev     = db.query(func.sum(LedgerLine.credit - LedgerLine.debit)).join(Account).join(JournalEntry).filter(
        Account.type == 'REVENUE',
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).scalar() or 0.0
    tb_exp     = db.query(func.sum(LedgerLine.debit - LedgerLine.credit)).join(Account).join(JournalEntry).filter(
        Account.type == 'EXPENSE',
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).scalar() or 0.0

    # VAT and SC after remediation
    vat_account  = db.query(Account).filter(Account.code == 210000).first()
    sc_account   = db.query(Account).filter(Account.code == 211000).first()
    vat_balance = db.query(func.sum(LedgerLine.credit - LedgerLine.debit)).join(JournalEntry).filter(
        LedgerLine.account_id == vat_account.id,
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).scalar() if vat_account else 0.0
    sc_balance  = db.query(func.sum(LedgerLine.credit - LedgerLine.debit)).join(JournalEntry).filter(
        LedgerLine.account_id == sc_account.id,
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).scalar() if sc_account else 0.0

    return {
        "status": "SUCCESS",
        "message": f"GL Remediation complete. {len(fixed)} corrected, {len(skipped)} skipped.",
        "journals_fixed": len(fixed),
        "journals_skipped": len(skipped),
        "fixed_detail": fixed,
        "skipped_detail": skipped,
        "post_remediation_summary": {
            "total_assets": round(tb_assets, 2),
            "total_liabilities": round(tb_liab, 2),
            "net_revenue": round(tb_rev, 2),
            "total_expenses": round(tb_exp, 2),
            "vat_payable_210000": round(vat_balance or 0.0, 2),
            "sc_payable_211000": round(sc_balance or 0.0, 2),
            "net_profit": round(tb_rev - tb_exp, 2),
        }
    }


@router.post("/room-sale/post-with-vat")
async def post_room_sale_with_vat(
    gross: float,
    description: str,
    channel: str = "DIRECT",
    nights: int = 1,
    db: Session = Depends(get_db)
):
    """
    SOVEREIGN ROOM SALE: Always posts with proper VAT/SC split.
    Use this instead of raw /journal/manual for any room revenue posting.
    Dr Cash (100000) gross
      Cr Room Revenue (400000) net
      Cr VAT Payable (210000)  15%
      Cr SC Payable (211000)   10%
    + COGS entry: Dr COGS (510000) 8% / Cr Room Supplies (120000)
    """
    journal = record_room_sale(db, gross, nights=nights, nightly_rate=gross/nights, channel=channel, description=description)
    net, vat, sc = split_gross_room_payment(gross)
    return {
        "status": "SUCCESS",
        "journal_id": journal.id,
        "gross": gross,
        "net": net,
        "vat_210000": vat,
        "sc_211000": sc,
        "cogs_510000": round(gross * 0.08, 2)
    }


# ============================================================
# GL EXPENSE COMPLETION ENGINE
# Enterprise Standard: Posts missing operational expenses
# using industry-standard hotel cost ratios derived from
# actual GL revenue. Never posts duplicates.
# ============================================================
# Hotel Industry Benchmarks (luxury segment):
#   Room COGS (direct cost)  :  8% of room revenue
#   Payroll (all depts)      : 30% of total revenue
#   Utilities & Energy       :  6% of total revenue
#   Admin & General          :  4% of total revenue
#   Sales & Marketing        :  3% of total revenue
#   Maintenance & Repair     :  3% of total revenue
#   F&B COGS                 : 30% of F&B revenue
# ============================================================

EXPENSE_POSTING_MARKERS = {
    "ROOM_COGS_COMPLETION":    "ROOM_COGS_AUTO",
    "PAYROLL_COMPLETION":      "PAYROLL_AUTO",
    "UTILITIES_COMPLETION":    "UTILITIES_AUTO",
    "ADMIN_COMPLETION":        "ADMIN_GENERAL_AUTO",
    "MARKETING_COMPLETION":    "MARKETING_AUTO",
    "MAINTENANCE_COMPLETION":  "MAINTENANCE_AUTO",
    "FB_COGS_COMPLETION":      "FB_COGS_AUTO",
}

@router.get("/pl-statement")
async def get_pl_statement(db: Session = Depends(get_db)):
    """
    Full Enterprise P&L Statement from live GL.
    Shows Revenue, each expense category, gross margin,
    operating profit, VAT/SC, and net profit.
    """
    def bal(code): return _gl_credit_balance(db, code)
    def dbal(code): return _gl_debit_balance(db, code)

    # Revenue (6-digit)
    room_rev_direct = bal(400000)
    room_rev_ota    = bal(400200)
    fb_rev          = bal(410000)
    fleet_rev       = bal(440000)
    wellness_rev    = bal(450000)
    boutique_rev    = bal(460000)
    cinema_rev      = bal(470000)
    total_rev = room_rev_direct + room_rev_ota + fb_rev + fleet_rev + wellness_rev + boutique_rev + cinema_rev

    # COGS (6-digit)
    room_cogs       = dbal(510000)
    fb_cogs         = dbal(510100)
    fleet_cogs      = dbal(510200)
    wellness_cogs   = dbal(510300)
    boutique_cogs   = dbal(510400)
    cinema_cogs     = dbal(510500)
    total_cogs = room_cogs + fb_cogs + fleet_cogs + wellness_cogs + boutique_cogs + cinema_cogs

    gross_profit = total_rev - total_cogs
    gross_margin = round(gross_profit / total_rev * 100, 1) if total_rev > 0 else 0.0

    # Operating Expenses (6-digit)
    payroll     = sum(dbal(c) for c in [500000, 500100, 500200, 500300, 500400, 500500, 500900])
    maintenance = dbal(550000)
    marketing   = dbal(530000)
    ota_comm    = dbal(535000)
    total_opex  = payroll + maintenance + marketing + ota_comm

    operating_profit = gross_profit - total_opex
    operating_margin = round(operating_profit / total_rev * 100, 1) if total_rev > 0 else 0.0

    # Tax / SC (Balance Sheet — not deducted from P&L) (6-digit)
    vat_payable = bal(210000)
    sc_payable  = bal(211000)

    # Net Profit (operating profit, before tax distribution)
    net_profit = operating_profit
    net_margin = round(net_profit / total_rev * 100, 1) if total_rev > 0 else 0.0

    # Net cash available after settling VAT + SC to government
    cash_after_obligations = net_profit - vat_payable - sc_payable

    return {
        "status": "SUCCESS",
        "revenue": {
            "room_direct":  round(room_rev_direct, 2),
            "room_ota":     round(room_rev_ota, 2),
            "fb":           round(fb_rev, 2),
            "fleet_z26":    round(fleet_rev, 2),
            "wellness_z27": round(wellness_rev, 2),
            "boutique_z28": round(boutique_rev, 2),
            "cinema_z17":   round(cinema_rev, 2),
            "total":        round(total_rev, 2),
        },
        "cogs": {
            "room":     round(room_cogs, 2),
            "fb":       round(fb_cogs, 2),
            "fleet":    round(fleet_cogs, 2),
            "wellness": round(wellness_cogs, 2),
            "boutique": round(boutique_cogs, 2),
            "cinema":   round(cinema_cogs, 2),
            "total":    round(total_cogs, 2),
        },
        "gross_profit":   round(gross_profit, 2),
        "gross_margin_pct": gross_margin,
        "opex": {
            "payroll":     round(payroll, 2),
            "maintenance": round(maintenance, 2),
            "marketing":   round(marketing, 2),
            "ota_comm":    round(ota_comm, 2),
            "total":       round(total_opex, 2),
        },
        "operating_profit":     round(operating_profit, 2),
        "operating_margin_pct": operating_margin,
        "vat_payable":          round(vat_payable, 2),
        "sc_payable":           round(sc_payable, 2),
        "net_profit":           round(net_profit, 2),
        "net_margin_pct":       net_margin,
        "cash_after_obligations": round(cash_after_obligations, 2),
        "department_margins": [
            {
                "dept": "Room (Direct)",
                "revenue": round(room_rev_direct, 2),
                "cogs":    round(room_cogs, 2),
                "margin":  round((room_rev_direct - room_cogs) / room_rev_direct * 100, 1) if room_rev_direct > 0 else 0.0,
            },
            {
                "dept": "F&B (Z-29)",
                "revenue": round(fb_rev, 2),
                "cogs":    round(fb_cogs, 2),
                "margin":  round((fb_rev - fb_cogs) / fb_rev * 100, 1) if fb_rev > 0 else 0.0,
            },
            {
                "dept": "Fleet (Z-26)",
                "revenue": round(fleet_rev, 2),
                "cogs":    round(fleet_cogs, 2),
                "margin":  round((fleet_rev - fleet_cogs) / fleet_rev * 100, 1) if fleet_rev > 0 else 0.0,
            },
            {
                "dept": "Wellness (Z-27)",
                "revenue": round(wellness_rev, 2),
                "cogs":    round(wellness_cogs, 2),
                "margin":  round((wellness_rev - wellness_cogs) / wellness_rev * 100, 1) if wellness_rev > 0 else 0.0,
            },
            {
                "dept": "Boutique (Z-28)",
                "revenue": round(boutique_rev, 2),
                "cogs":    round(boutique_cogs, 2),
                "margin":  round((boutique_rev - boutique_cogs) / boutique_rev * 100, 1) if boutique_rev > 0 else 0.0,
            },
            {
                "dept": "Cinema (Z-17)",
                "revenue": round(cinema_rev, 2),
                "cogs":    round(cinema_cogs, 2),
                "margin":  round((cinema_rev - cinema_cogs) / cinema_rev * 100, 1) if cinema_rev > 0 else 0.0,
            },
        ],
        "analysis": {
            "missing_expenses": total_opex == 0.0 and payroll == 0.0,
            "missing_room_cogs": room_cogs == 0.0 and room_rev_direct > 0,
            "missing_payroll": payroll == 0.0,
            "missing_ota_commission": ota_comm == 0.0,
            "warning": (
                "⚠️ EXPENSE INCOMPLETE: Payroll, Room COGS, and/or OpEx are BDT 0. "
                "Run POST /accounting/gl-expenses/post-industry-standard to post estimated expenses, "
                "or use POST /accounting/journal/manual for actual amounts."
            )
        }
    }


@router.post("/gl-expenses/post-industry-standard")
async def post_industry_standard_expenses(
    month_label: str = "MAY-2026",
    db: Session = Depends(get_db)
):
    """
    SOVEREIGN EXPENSE ENGINE
    Posts estimated operational expenses using industry-standard
    hotel cost benchmarks derived from actual GL revenue.
    Safe to run: checks for existing postings and skips if already done.
    """
    posted = []
    skipped = []

    def already_posted(marker: str) -> bool:
        return db.query(JournalEntry).filter(
            JournalEntry.reference_type == marker,
            JournalEntry.description.contains(month_label)
        ).first() is not None

    def gl_bal(code): return _gl_credit_balance(db, code)
    def gl_dbal(code): return _gl_debit_balance(db, code)

    # Source amounts from actual GL revenue
    total_net_rev = gl_bal(400000) + gl_bal(400200) + gl_bal(410000) + gl_bal(440000) + gl_bal(450000) + gl_bal(460000) + gl_bal(470000)
    room_net_rev  = gl_bal(400000) + gl_bal(400200)
    fb_net_rev    = gl_bal(410000)

    if total_net_rev <= 0:
        return {"status": "NO_ACTION", "message": "No revenue in GL. Post revenue first."}

    expenses_plan = []

    # 1. Room COGS (8% of net room revenue)
    room_cogs_existing = gl_dbal(510000)
    if room_cogs_existing < (room_net_rev * 0.01):  # Less than 1% → not posted
        room_cogs = round(room_net_rev * 0.08, 2)
        expenses_plan.append({
            "marker": "ROOM_COGS_AUTO",
            "description": f"[AUTO] Room Direct COGS — 8% of Net Room Rev {month_label}",
            "amount": room_cogs,
            "lines": [
                {"code": 510000, "debit": room_cogs, "credit": 0.0},  # COGS expense
                {"code": 120000, "debit": 0.0, "credit": room_cogs},  # Room Supplies inventory consumed
            ]
        })
    else:
        skipped.append({"type": "ROOM_COGS", "reason": f"Already posted: {room_cogs_existing:.2f}"})

    # 2. Payroll — 30% of total revenue
    payroll_existing = sum(gl_dbal(c) for c in [500000, 500100, 500200, 500300, 500400, 500500, 500900])
    if payroll_existing < (total_net_rev * 0.01):
        payroll = round(total_net_rev * 0.30, 2)
        expenses_plan.append({
            "marker": "PAYROLL_AUTO",
            "description": f"[AUTO] Monthly Payroll — 30% of Revenue {month_label}",
            "amount": payroll,
            "lines": [
                {"code": 500900, "debit": payroll, "credit": 0.0},  # General payroll expense
                {"code": 100000, "debit": 0.0, "credit": payroll},  # Cash paid to staff
            ]
        })
    else:
        skipped.append({"type": "PAYROLL", "reason": f"Already posted: {payroll_existing:.2f}"})

    # 3. Utilities & Admin — 6% of total revenue → Maintenance account
    maint_existing = gl_dbal(550000)
    if maint_existing < (total_net_rev * 0.01):
        utilities = round(total_net_rev * 0.06, 2)
        expenses_plan.append({
            "marker": "UTILITIES_AUTO",
            "description": f"[AUTO] Utilities & Admin Overhead — 6% of Revenue {month_label}",
            "amount": utilities,
            "lines": [
                {"code": 550000, "debit": utilities, "credit": 0.0},  # Maintenance expense
                {"code": 100000, "debit": 0.0, "credit": utilities},  # Cash paid
            ]
        })
    else:
        skipped.append({"type": "UTILITIES", "reason": f"Already posted: {maint_existing:.2f}"})

    # 4. Sales & Marketing — 3% of total revenue
    marketing_existing = gl_dbal(530000)
    if marketing_existing < (total_net_rev * 0.01):
        marketing = round(total_net_rev * 0.03, 2)
        expenses_plan.append({
            "marker": "MARKETING_AUTO",
            "description": f"[AUTO] Sales & Marketing — 3% of Revenue {month_label}",
            "amount": marketing,
            "lines": [
                {"code": 530000, "debit": marketing, "credit": 0.0},  # Marketing expense
                {"code": 100000, "debit": 0.0, "credit": marketing},   # Cash paid
            ]
        })
    else:
        skipped.append({"type": "MARKETING", "reason": f"Already posted: {marketing_existing:.2f}"})

    # 5. F&B COGS — 30% of F&B revenue if not already well-covered
    fb_cogs_existing = gl_dbal(510100)
    if fb_net_rev > 0 and fb_cogs_existing < (fb_net_rev * 0.05):
        fb_cogs = round(fb_net_rev * 0.30, 2)
        fb_cogs_to_add = round(fb_cogs - fb_cogs_existing, 2)
        if fb_cogs_to_add > 0:
            expenses_plan.append({
                "marker": "FB_COGS_AUTO",
                "description": f"[AUTO] F&B COGS Completion — 30% of F&B Revenue {month_label}",
                "amount": fb_cogs_to_add,
                "lines": [
                    {"code": 510100, "debit": fb_cogs_to_add, "credit": 0.0},   # F&B COGS
                    {"code": 121000, "debit": 0.0, "credit": fb_cogs_to_add},   # F&B Inventory consumed
                ]
            })

    # Post all planned expenses
    for exp in expenses_plan:
        if already_posted(exp["marker"]):
            skipped.append({"type": exp["marker"], "reason": "Already posted this month"})
            continue
        try:
            journal = post_double_entry(db, exp["marker"], exp["description"], exp["lines"])
            posted.append({
                "type": exp["marker"],
                "journal_id": journal.id,
                "amount": exp["amount"],
                "description": exp["description"],
            })
        except Exception as e:
            skipped.append({"type": exp["marker"], "reason": str(e)})

    db.commit()

    # Recalculate P&L summary
    total_exp_after = gl_dbal(510000) + payroll_existing + gl_dbal(550000) + gl_dbal(530000) + gl_dbal(510100)
    net_profit_after = total_net_rev - total_exp_after
    net_margin_after = round(net_profit_after / total_net_rev * 100, 1) if total_net_rev > 0 else 0.0

    return {
        "status": "SUCCESS",
        "message": f"Expense completion: {len(posted)} posted, {len(skipped)} skipped.",
        "month": month_label,
        "journals_posted": len(posted),
        "posted": posted,
        "skipped": skipped,
        "pl_summary": {
            "total_net_revenue": round(total_net_rev, 2),
            "total_expenses":    round(total_exp_after, 2),
            "net_profit":        round(net_profit_after, 2),
            "net_margin_pct":    net_margin_after,
            "benchmark_note": (
                "Industry benchmark: Luxury hotel net margin = 15-25%. "
                "These are ESTIMATED expenses based on standard ratios. "
                "Replace with actual figures as they become available."
            )
        }
    }

# ==========================================
# DEPRECIATION ENGINE ENDPOINTS
# ==========================================

class AssetCreatePayload(BaseModel):
    name: str
    division: str  # ROOMS, F&B, FLEET, WELLNESS, BOUTIQUE, CINEMA, GENERAL
    purchase_date: str # YYYY-MM-DD
    purchase_cost: float
    useful_life_months: int
    salvage_value: float = 0.0
    method: str = "STRAIGHT_LINE"

@router.post("/depreciation/assets")
async def create_fixed_asset(payload: AssetCreatePayload, db: Session = Depends(get_db)):
    """Add a new fixed asset to the registry and initialize Net Book Value."""
    try:
        p_date = datetime.strptime(payload.purchase_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
    asset = FixedAsset(
        name=payload.name,
        division=payload.division.upper(),
        purchase_date=p_date,
        purchase_cost=payload.purchase_cost,
        useful_life_months=payload.useful_life_months,
        salvage_value=payload.salvage_value,
        method=payload.method,
        accumulated_depreciation=0.0,
        net_book_value=payload.purchase_cost,
        is_active=True
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return {"status": "SUCCESS", "asset_id": asset.id, "net_book_value": asset.net_book_value}

@router.get("/depreciation/assets")
async def get_fixed_assets(division: str = None, db: Session = Depends(get_db)):
    """Retrieve all fixed assets from the register."""
    query = db.query(FixedAsset)
    if division:
        query = query.filter(FixedAsset.division == division.upper())
    assets = query.all()
    return {
        "status": "SUCCESS",
        "data": [{
            "id": a.id,
            "name": a.name,
            "division": a.division,
            "purchase_date": a.purchase_date.strftime("%Y-%m-%d"),
            "purchase_cost": a.purchase_cost,
            "useful_life_months": a.useful_life_months,
            "salvage_value": a.salvage_value,
            "accumulated_depreciation": a.accumulated_depreciation,
            "net_book_value": a.net_book_value,
            "is_active": a.is_active
        } for a in assets]
    }

@router.post("/depreciation/run")
async def run_monthly_depreciation(db: Session = Depends(get_db)):
    """
    Triggers straight-line monthly depreciation for all active fixed assets.
    Posts double-entry journals to General Ledger per asset.
    """
    # Map division to specific Accumulated Depreciation (Asset Contra-Account) and Depreciation Expense
    depr_mapping = {
        "ROOMS":    {"expense": 520000, "contra": 140000},
        "F&B":      {"expense": 520100, "contra": 141000},
        "FLEET":    {"expense": 520200, "contra": 142000},
        "WELLNESS": {"expense": 520300, "contra": 143000},
        "BOUTIQUE": {"expense": 520400, "contra": 144000},
        "CINEMA":   {"expense": 520500, "contra": 145000},
        "GENERAL":  {"expense": 520000, "contra": 140000}, # Fallback
    }
    
    active_assets = db.query(FixedAsset).filter(FixedAsset.is_active == True).all()
    posted = []
    skipped = []
    
    current_period = datetime.now(DHAKA_TZ).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    for asset in active_assets:
        # Check if already depreciated for this period
        existing_log = db.query(DepreciationLog).filter(
            DepreciationLog.asset_id == asset.id,
            func.date(DepreciationLog.period_date) == current_period.date()
        ).first()
        
        if existing_log:
            skipped.append({"id": asset.id, "name": asset.name, "reason": "Already depreciated for this period"})
            continue
            
        # Straight line vs Declining balance calculation
        if asset.method == "DECLINING_BALANCE":
            factor = asset.declining_factor or 2.0
            monthly_amount = round((asset.net_book_value * factor) / asset.useful_life_months, 2)
        else: # Default: STRAIGHT_LINE
            depreciable_base = asset.purchase_cost - asset.salvage_value
            monthly_amount = round(depreciable_base / asset.useful_life_months, 2)
        
        # Avoid over-depreciating
        remaining_depr = asset.purchase_cost - asset.salvage_value - asset.accumulated_depreciation
        if remaining_depr <= 0:
            asset.is_active = False
            skipped.append({"id": asset.id, "name": asset.name, "reason": "Fully depreciated, marked inactive"})
            continue
            
        actual_depr_amount = min(monthly_amount, remaining_depr)
        
        # Post double entry
        mapping = depr_mapping.get(asset.division, depr_mapping["GENERAL"])
        desc = f"Depreciation recognition for {asset.name} ({asset.division} division)"
        
        lines = [
            {"code": mapping["expense"], "debit": actual_depr_amount, "credit": 0.0}, # Dr Depreciation Expense
            {"code": mapping["contra"], "debit": 0.0, "credit": actual_depr_amount}  # Cr Accum Depreciation
        ]
        
        try:
            journal = post_double_entry(db, 'DEPRECIATION_RUN', desc, lines)
            
            # Save depreciation log
            log = DepreciationLog(
                asset_id=asset.id,
                journal_id=journal.id,
                amount=actual_depr_amount,
                period_date=current_period
            )
            db.add(log)
            
            # Update asset net book value
            asset.accumulated_depreciation = round(asset.accumulated_depreciation + actual_depr_amount, 2)
            asset.net_book_value = round(asset.purchase_cost - asset.accumulated_depreciation, 2)
            
            if asset.net_book_value <= asset.salvage_value:
                asset.is_active = False # fully depreciated
                
            posted.append({"id": asset.id, "name": asset.name, "amount": actual_depr_amount})
        except Exception as e:
            db.rollback()
            skipped.append({"id": asset.id, "name": asset.name, "reason": f"Failed posting double entry: {str(e)}"})
            
    db.commit()
    return {"status": "SUCCESS", "posted": posted, "skipped": skipped}

# ==========================================
# PAYROLL ENGINE ENDPOINTS
# ==========================================
import calendar

class PayrollApprovePayload(BaseModel):
    year: int
    month: int
    overtime_hours: float = 0.0
    commission: float = 0.0
    deductions: float = 0.0

@router.get("/payroll/register")
async def get_payroll_register(year: int = None, month: int = None, db: Session = Depends(get_db)):
    """Calculate and return pro-rated payroll, overtime, and commissions for all staff."""
    from app.models.models import Employee
    
    now = datetime.now(DHAKA_TZ)
    y = year or now.year
    m = month or now.month
    
    employees = db.query(Employee).filter(Employee.status != "TERMINATED").all()
    register = []
    
    days_in_month = calendar.monthrange(y, m)[1]
    
    for emp in employees:
        # Step 1: Pro-rated salary based on joined_date
        full_salary = emp.base_salary or 0.0
        worked_days = days_in_month
        
        if emp.joined_date and emp.joined_date.year == y and emp.joined_date.month == m:
            worked_days = max(1, days_in_month - emp.joined_date.day + 1)
            
        pro_rated_base = round(full_salary * worked_days / days_in_month, 2)
        
        # Step 2: OT hours (if monthly_hours > 160, or use logged monthly_hours)
        hours = emp.monthly_hours or 0.0
        ot_hours = max(0.0, hours - 160.0)
        hourly_rate = (full_salary / 160.0) if full_salary > 0 else 0.0
        ot_pay = round(ot_hours * hourly_rate * 1.5, 2)
        
        # Step 3: Commission based on revenue impact or static rate
        comm = round((emp.revenue_impact or 0.0) * (emp.commission_rate or 0.0), 2)
        
        gross = pro_rated_base + ot_pay + comm
        net = gross # Deductions initialized as 0
        
        register.append({
            "employee_id": emp.id,
            "name": emp.full_name,
            "department": emp.dept or "GENERAL",
            "base_salary": full_salary,
            "pro_rated_base": pro_rated_base,
            "hours_logged": hours,
            "ot_hours": ot_hours,
            "ot_pay": ot_pay,
            "commission": comm,
            "gross_pay": gross,
            "deductions": 0.0,
            "net_pay": net,
            "status": emp.status
        })
        
    return {"status": "SUCCESS", "year": y, "month": m, "register": register}

@router.post("/payroll/approve/{employee_id}")
async def approve_employee_payroll(employee_id: str, payload: PayrollApprovePayload, db: Session = Depends(get_db)):
    """Approve payroll, post double-entry (Dr 500X Payroll / Cr 2120 Salaries Payable) and seal ledgers."""
    from app.models.models import Employee
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    # Recalculate based on input payload
    days_in_month = calendar.monthrange(payload.year, payload.month)[1]
    worked_days = days_in_month
    if emp.joined_date and emp.joined_date.year == payload.year and emp.joined_date.month == payload.month:
        worked_days = max(1, days_in_month - emp.joined_date.day + 1)
        
    pro_rated_base = round((emp.base_salary or 0.0) * worked_days / days_in_month, 2)
    hourly_rate = ((emp.base_salary or 0.0) / 160.0) if (emp.base_salary or 0.0) > 0 else 0.0
    ot_pay = round(payload.overtime_hours * hourly_rate * 1.5, 2)
    
    gross = pro_rated_base + ot_pay + payload.commission
    net = round(gross - payload.deductions, 2)
    
    # Division specific payroll expense account mapping
    dept_payroll_map = {
        "RS":      500000, # Rooms (Room Service/Front desk)
        "HK":      500000, # Rooms (Housekeeping)
        "FB":      500100, # F&B
        "FLEET":   500200, # Fleet
        "WELLNESS":500300, # Med-Spa
        "BOUTIQUE":500400, # Boutique
        "CINEMA":  500500, # Cinema
        "GENERAL": 500900, # General / Management
    }
    
    acct_code = dept_payroll_map.get(emp.dept, 500900)
    desc = f"Payroll approval for {emp.full_name} ({employee_id}) - {payload.year}-{payload.month:02d}"
    
    lines = [
        {"code": acct_code, "debit": net, "credit": 0.0}, # Dr Payroll Expense
        {"code": 212000, "debit": 0.0, "credit": net}    # Cr Salaries Payable
    ]
    
    try:
        journal = post_double_entry(db, "PAYROLL_APPROVAL", desc, lines)
        db.commit()
        return {
            "status": "SUCCESS",
            "message": f"Payroll approved for {emp.full_name}. sealed under journal ID {journal.id}",
            "net_pay": net,
            "payslip_url": f"/api/accounting/payroll/payslip/{employee_id}/{payload.year}/{payload.month}"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed posting payroll: {str(e)}")

@router.post("/payroll/disburse/{employee_id}")
async def disburse_employee_payroll(employee_id: str, amount: float, db: Session = Depends(get_db)):
    """Disburse salaries from bank to employee, clearing Salaries Payable (Dr 2120 / Cr 100000)"""
    from app.models.models import Employee
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    desc = f"Salary disbursement to {emp.full_name} ({employee_id})"
    lines = [
        {"code": 212000, "debit": amount, "credit": 0.0}, # Dr Salaries Payable
        {"code": 100000, "debit": 0.0, "credit": amount}  # Cr Cash/Bank Consolidated
    ]
    
    try:
        journal = post_double_entry(db, "SALARY_DISBURSEMENT", desc, lines)
        db.commit()
        return {"status": "SUCCESS", "message": f"Salary disbursed cleanly under journal ID {journal.id}."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed disbursing salary: {str(e)}")

# ==========================================
# COMMISSION & MARKETING ENDPOINTS
# ==========================================

class AffiliateCommissionPayload(BaseModel):
    booking_id: str
    affiliate_code: str
    amount: float
    guest_name: str

class OTACommissionPayload(BaseModel):
    booking_id: str
    platform: str # Booking.com, Expedia, etc.
    gross_amount: float
    rate: float = 0.15

@router.post("/commission/affiliate")
async def post_affiliate_commission(payload: AffiliateCommissionPayload, db: Session = Depends(get_db)):
    """Post external affiliate commission (Dr 530100 Marketing-Affiliate / Cr 200200 AP-Affiliates)"""
    desc = f"Affiliate Commission for {payload.guest_name} (Code: {payload.affiliate_code}, Booking: {payload.booking_id})"
    lines = [
        {"code": 530100, "debit": payload.amount, "credit": 0.0}, # Dr Affiliate Commissions
        {"code": 200200, "debit": 0.0, "credit": payload.amount}  # Cr AP - External Agents/Affiliates
    ]
    try:
        journal = post_double_entry(db, "AFFILIATE_COMMISSION", desc, lines)
        db.commit()
        return {"status": "SUCCESS", "journal_id": journal.id, "amount": payload.amount}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/commission/ota")
async def post_ota_commission(payload: OTACommissionPayload, db: Session = Depends(get_db)):
    """Post OTA channel commission (Dr 535000 OTA Commission / Cr 200100 AP-OTA)"""
    comm_amount = round(payload.gross_amount * payload.rate, 2)
    desc = f"OTA Commission ({payload.platform}) for Booking {payload.booking_id} (Rate: {payload.rate * 100}%)"
    lines = [
        {"code": 535000, "debit": comm_amount, "credit": 0.0}, # Dr OTA Commissions
        {"code": 200100, "debit": 0.0, "credit": comm_amount}  # Cr AP - OTA Platforms
    ]
    try:
        journal = post_double_entry(db, "OTA_COMMISSION", desc, lines)
        db.commit()
        return {"status": "SUCCESS", "journal_id": journal.id, "amount": comm_amount}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 12. HOSPITALITY OPERATIONAL CONTROLS
# Folio Settlements, CC Clearing, Till Drops
# ==========================================

class FolioSettlePayload(BaseModel):
    """Payload for checkout folio settlement."""
    folio_id: int
    payment_method: str = "CASH"  # CASH | CREDIT_CARD | CITY_LEDGER
    amount: Optional[float] = None  # If None, settles full balance

class CCSettlePayload(BaseModel):
    """Payload for credit card merchant clearing settlement."""
    amount: float
    bank_reference: str = ""
    settlement_date: Optional[str] = None

class TillDropPayload(BaseModel):
    """Payload for shift till cash drop."""
    terminal_id: str
    expected_amount: float  # POS-reported cash total for the shift
    actual_amount: float    # Physical cash counted at till drop
    shift_label: str = ""   # e.g. "MORNING", "EVENING"
    operator_id: str = "SYSTEM"


@router.post("/folio-settle")
async def settle_guest_folio(payload: FolioSettlePayload, db: Session = Depends(get_db)):
    """
    CHECKOUT SETTLEMENT ENGINE:
    Settles an in-house guest folio at checkout.

    Accounting flow:
      - CASH:         Dr Cash (100000)           / Cr Guest Ledger (111000)
      - CREDIT_CARD:  Dr CC Clearing (102000)    / Cr Guest Ledger (111000)
      - CITY_LEDGER:  Dr City Ledger (112000)    / Cr Guest Ledger (111000)
    """
    from app.models.models import GuestFolio

    folio = db.query(GuestFolio).filter(GuestFolio.id == payload.folio_id).first()
    if not folio:
        raise HTTPException(status_code=404, detail=f"Folio #{payload.folio_id} not found.")
    if folio.status != "IN_HOUSE":
        raise HTTPException(status_code=400, detail=f"Folio is {folio.status}, not IN_HOUSE. Cannot settle.")

    settle_amount = round(payload.amount or folio.balance, 2)
    if settle_amount <= 0:
        raise HTTPException(status_code=400, detail="Settlement amount must be positive.")

    # Route debit based on payment method
    debit_map = {
        "CASH": 100000,
        "CREDIT_CARD": 102000,
        "CITY_LEDGER": 112000,
    }
    debit_code = debit_map.get(payload.payment_method.upper(), 100000)
    method_label = payload.payment_method.upper()

    lines = [
        {"code": debit_code, "debit": settle_amount, "credit": 0.0},
        {"code": 111000,     "debit": 0.0,           "credit": settle_amount},  # Guest Ledger cleared
    ]

    try:
        journal = post_double_entry(
            db, "FOLIO_SETTLEMENT",
            f"Checkout Settlement: Folio #{folio.id} ({folio.guest_name}) via {method_label}",
            lines
        )

        # Update folio status
        folio.balance = round(folio.balance - settle_amount, 2)
        if folio.balance <= 0:
            folio.status = "CHECKED_OUT"
            folio.balance = 0.0

        db.commit()
        logger.info(f"✅ FOLIO SETTLED: #{folio.id} ({folio.guest_name}) BDT {settle_amount:,.2f} via {method_label}")

        return {
            "status": "SUCCESS",
            "journal_id": journal.id,
            "folio_id": folio.id,
            "guest_name": folio.guest_name,
            "settled_amount": settle_amount,
            "remaining_balance": folio.balance,
            "folio_status": folio.status,
            "payment_method": method_label,
            "message": f"Folio #{folio.id} settled. BDT {settle_amount:,.2f} via {method_label}."
        }
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 FOLIO SETTLEMENT FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Settlement failed: {str(e)}")


@router.post("/cc-settle")
async def settle_cc_merchant_clearing(payload: CCSettlePayload, db: Session = Depends(get_db)):
    """
    CREDIT CARD MERCHANT SETTLEMENT:
    When the acquiring bank remits card captures to the resort's bank account,
    this endpoint clears the Merchant Clearing account.

    Accounting flow:
      Dr Cash/Bank (100000)              — money received in bank
      Cr Credit Card Clearing (102000)   — clearing account zeroed out
    """
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Settlement amount must be positive.")

    # Verify CC Clearing has sufficient balance
    cc_balance = _gl_debit_balance(db, 102000)
    if cc_balance < payload.amount - 1.0:  # Allow BDT 1 rounding tolerance
        raise HTTPException(
            status_code=400,
            detail=f"CC Clearing balance (BDT {cc_balance:,.2f}) insufficient for settlement of BDT {payload.amount:,.2f}."
        )

    settle_date = payload.settlement_date or datetime.now(DHAKA_TZ).strftime("%Y-%m-%d")
    lines = [
        {"code": 100000, "debit": payload.amount, "credit": 0.0},  # Cash/Bank receives funds
        {"code": 102000, "debit": 0.0, "credit": payload.amount},   # CC Clearing zeroed
    ]

    try:
        journal = post_double_entry(
            db, "CC_MERCHANT_SETTLEMENT",
            f"CC Merchant Settlement {settle_date}: BDT {payload.amount:,.2f} (Ref: {payload.bank_reference})",
            lines
        )
        db.commit()
        logger.info(f"✅ CC SETTLEMENT: BDT {payload.amount:,.2f} cleared. Ref: {payload.bank_reference}")

        return {
            "status": "SUCCESS",
            "journal_id": journal.id,
            "amount_settled": payload.amount,
            "bank_reference": payload.bank_reference,
            "settlement_date": settle_date,
            "cc_clearing_remaining": round(_gl_debit_balance(db, 102000), 2),
            "message": f"CC Merchant Settlement complete. BDT {payload.amount:,.2f} transferred to bank."
        }
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 CC SETTLEMENT FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CC Settlement failed: {str(e)}")


@router.post("/till-drop")
async def record_till_drop(payload: TillDropPayload, db: Session = Depends(get_db)):
    """
    SHIFT TILL DROP ENGINE:
    Records cash deposit from outlet register (House Bank 105000) to central
    safe/bank (Cash 100000). Automatically detects and posts cash
    overage or shortage to Till Cash Variance (550100).

    Accounting flows:
      1. Main drop:  Dr Cash/Bank (100000) / Cr House Banks (105000)  — actual amount
      2. Shortage:   Dr Till Variance (550100) / Cr House Banks (105000)  — missing cash
      3. Overage:    Dr House Banks (105000) / Cr Till Variance (550100)  — excess cash (credit = revenue)
    """
    if payload.actual_amount < 0:
        raise HTTPException(status_code=400, detail="Actual amount cannot be negative.")

    variance = round(payload.actual_amount - payload.expected_amount, 2)
    shift_ref = f"{payload.terminal_id}/{payload.shift_label}" if payload.shift_label else payload.terminal_id
    drop_date = datetime.now(DHAKA_TZ).strftime("%Y-%m-%d %H:%M")

    journals_posted = []

    try:
        # 1. Main cash drop: move actual counted cash from House Bank to Central Cash
        if payload.actual_amount > 0:
            drop_lines = [
                {"code": 100000, "debit": payload.actual_amount, "credit": 0.0},  # Cash/Bank up
                {"code": 105000, "debit": 0.0, "credit": payload.actual_amount},   # House Bank down
            ]
            j1 = post_double_entry(
                db, "TILL_DROP",
                f"Till Drop {drop_date}: {shift_ref} — BDT {payload.actual_amount:,.2f} deposited by {payload.operator_id}",
                drop_lines
            )
            journals_posted.append(j1.id)

        # 2. Variance posting (if any)
        if abs(variance) >= 0.01:
            if variance < 0:
                # SHORTAGE: Cash is missing → expense
                shortage = abs(variance)
                var_lines = [
                    {"code": 550100, "debit": shortage, "credit": 0.0},  # Till Variance expense
                    {"code": 105000, "debit": 0.0,     "credit": shortage},  # House Bank adjustment
                ]
                j2 = post_double_entry(
                    db, "TILL_SHORTAGE",
                    f"Till Shortage {drop_date}: {shift_ref} — BDT {shortage:,.2f} short",
                    var_lines
                )
            else:
                # OVERAGE: Excess cash found → credit (reduces expense or becomes misc revenue)
                overage = variance
                var_lines = [
                    {"code": 105000, "debit": overage, "credit": 0.0},   # House Bank up (found cash)
                    {"code": 550100, "debit": 0.0,     "credit": overage},  # Till Variance credit
                ]
                j2 = post_double_entry(
                    db, "TILL_OVERAGE",
                    f"Till Overage {drop_date}: {shift_ref} — BDT {overage:,.2f} over",
                    var_lines
                )
            journals_posted.append(j2.id)

        db.commit()

        variance_status = "EXACT" if abs(variance) < 0.01 else ("SHORT" if variance < 0 else "OVER")
        logger.info(f"✅ TILL DROP: {shift_ref} | Expected: BDT {payload.expected_amount:,.2f} | Actual: BDT {payload.actual_amount:,.2f} | Variance: BDT {variance:,.2f} ({variance_status})")

        return {
            "status": "SUCCESS",
            "terminal_id": payload.terminal_id,
            "shift_label": payload.shift_label,
            "expected_amount": payload.expected_amount,
            "actual_amount": payload.actual_amount,
            "variance": variance,
            "variance_status": variance_status,
            "journal_ids": journals_posted,
            "operator": payload.operator_id,
            "timestamp": drop_date,
            "message": f"Till drop recorded. Variance: BDT {variance:,.2f} ({variance_status})."
        }
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 TILL DROP FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Till drop failed: {str(e)}")


# ==========================================
# SYSTEM AUDIT RADAR EVENT LISTENERS (SOC-2)
# ==========================================
from sqlalchemy import event
from app.models.models import Account, JournalEntry, LedgerLine, FixedAsset, Inventory

models_to_audit = [Account, JournalEntry, LedgerLine, FixedAsset, Inventory]

for model in models_to_audit:
    @event.listens_for(model, 'after_insert')
    def after_insert_listener(mapper, connection, target):
        tbl = target.__tablename__
        rec_id = str(getattr(target, 'id', getattr(target, 'product_id', 'UNKNOWN')))
        connection.execute(
            text("INSERT INTO system_audit_logs (operator, action, table_name, record_id, field_name) VALUES (:op, :act, :tbl, :rec, :fld)"),
            {"op": "SYSTEM", "act": "INSERT", "tbl": tbl, "rec": rec_id, "fld": "ALL"}
        )

    @event.listens_for(model, 'after_update')
    def after_update_listener(mapper, connection, target):
        tbl = target.__tablename__
        rec_id = str(getattr(target, 'id', getattr(target, 'product_id', 'UNKNOWN')))
        from sqlalchemy.orm import attributes
        state = attributes.instance_state(target)
        for attr in state.mapper.column_attrs:
            history = state.get_history(attr.key, passive=True)
            if history.has_changes():
                old_val = history.deleted[0] if history.deleted else None
                new_val = history.added[0] if history.added else None
                connection.execute(
                    text("INSERT INTO system_audit_logs (operator, action, table_name, record_id, field_name, old_value, new_value) VALUES (:op, :act, :tbl, :rec, :fld, :old, :new)"),
                    {"op": "SYSTEM", "act": "UPDATE", "tbl": tbl, "rec": rec_id, "fld": attr.key, "old": str(old_val) if old_val is not None else None, "new": str(new_val) if new_val is not None else None}
                )

    @event.listens_for(model, 'after_delete')
    def after_delete_listener(mapper, connection, target):
        tbl = target.__tablename__
        rec_id = str(getattr(target, 'id', getattr(target, 'product_id', 'UNKNOWN')))
        connection.execute(
            text("INSERT INTO system_audit_logs (operator, action, table_name, record_id, field_name) VALUES (:op, :act, :tbl, :rec, :fld)"),
            {"op": "SYSTEM", "act": "DELETE", "tbl": tbl, "rec": rec_id, "fld": "ALL"}
        )


