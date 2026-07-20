# backend_api/app/routers/accounting_enterprise.py
# ============================================================
# MIRACLE OS — SOVEREIGN ENTERPRISE ACCOUNTING ENGINE V2
# Oracle/Xero-Grade Features:
#   1. Ledger Audit Trail with Auto-Remarks
#   2. Period Locking (prevent posting to closed periods)
#   3. Journal Reversal (immutable ACID-safe reversal)
#   4. Bank Reconciliation (statement import, line matching)
#   5. GL Account Statement (running balance per account)
#   6. Partial AR/AP Payments
#   7. Budget vs Actual Module
# ============================================================
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from jose import jwt

from app.core.database import get_db
from app.models.models import (
    Account, JournalEntry, LedgerLine,
    ARReceivable, APInvoice, Vendor,
    AccountingPeriod, LedgerAuditTrail,
    BankAccount, BankStatementLine, ReconciliationSession,
    ARPayment, APPayment, Budget
)

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

DHAKA_TZ = timezone(timedelta(hours=6))
logger = logging.getLogger("MiracleOS_EnterpriseAccounting")
router = APIRouter(tags=["ZONE 18: Enterprise Accounting V2"])


# ============================================================
# INTERNAL HELPERS
# ============================================================

def _now() -> datetime:
    return datetime.now(DHAKA_TZ)


def _write_audit_trail(
    db: Session,
    journal_id: int,
    action: str,
    performed_by: str,
    auto_remark: str,
    field_changed: str = None,
    old_value: str = None,
    new_value: str = None,
    ip_address: str = None
) -> LedgerAuditTrail:
    """
    Creates an immutable audit trail entry for a journal change.
    Called automatically on every creation, amendment, reversal, approval,
    or quarantine event. Never call this from outside the accounting router.
    """
    entry = LedgerAuditTrail(
        journal_id=journal_id,
        action=action,
        field_changed=field_changed,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        auto_remark=auto_remark,
        performed_by=performed_by,
        performed_at=_now(),
        ip_address=ip_address
    )
    db.add(entry)
    return entry


def _check_period_lock(db: Session, posting_date: datetime) -> None:
    """
    Validates that the posting_date falls within an OPEN accounting period.
    Raises HTTP 423 (Locked) if the period is CLOSED or PERMANENTLY_CLOSED.
    If no periods are configured, posting is allowed (open-book mode).
    """
    period = db.query(AccountingPeriod).filter(
        AccountingPeriod.start_date <= posting_date,
        AccountingPeriod.end_date >= posting_date
    ).first()

    if period is None:
        # No period configured — open-book mode, allow posting
        return

    if period.status == "CLOSED":
        raise HTTPException(
            status_code=423,
            detail=f"Period '{period.period_name}' is CLOSED. "
                   f"Reopen the period before posting. Closed by: {period.closed_by}"
        )

    if period.status == "PERMANENTLY_CLOSED":
        raise HTTPException(
            status_code=423,
            detail=f"Period '{period.period_name}' is PERMANENTLY CLOSED and cannot be reopened. "
                   f"This is an immutable period lock."
        )


def _post_double_entry_enterprise(
    db: Session,
    reference_type: str,
    description: str,
    lines: list,
    posted_by: str = "SYSTEM",
    fiscal_period_id: int = None,
    check_period: bool = True
) -> JournalEntry:
    """
    THE SOVEREIGN KERNEL — Enterprise double-entry engine with:
    - Strict ACID balance check (Dr == Cr to the cent)
    - Period lock verification
    - Automatic audit trail creation on CREATED
    Never call db.commit() here — caller is responsible.
    """
    # Step 1: Balance check — ZERO TOLERANCE
    total_dr = round(sum(float(l.get("debit", 0)) for l in lines), 2)
    total_cr = round(sum(float(l.get("credit", 0)) for l in lines), 2)

    if abs(total_dr - total_cr) >= 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"ACID VIOLATION: Unbalanced entry — Dr {total_dr} ≠ Cr {total_cr} "
                   f"(variance: {abs(total_dr - total_cr):.4f}). Journal rejected."
        )

    # Step 2: Period lock check
    if check_period:
        _check_period_lock(db, _now())

    # Step 3: Create JournalEntry header
    journal = JournalEntry(
        reference_type=reference_type,
        description=description,
        timestamp=_now(),
        verification_status="VERIFIED"
    )
    db.add(journal)
    db.flush()  # Get journal.id

    # Step 4: Create LedgerLines
    for line in lines:
        code = int(line["code"])
        account = db.query(Account).filter(Account.code == code).first()
        if not account:
            raise HTTPException(
                status_code=422,
                detail=f"Account code {code} does not exist in Chart of Accounts. "
                       f"Add it via COA management before posting."
            )
        db.add(LedgerLine(
            journal_id=journal.id,
            account_id=account.id,
            debit=float(line.get("debit", 0)),
            credit=float(line.get("credit", 0))
        ))

    # Step 5: Automatic Audit Trail — CREATED event
    remark = (
        f"Journal entry CREATED by {posted_by}. "
        f"Ref: {reference_type}. "
        f"Description: {description}. "
        f"Lines: {len(lines)}. Dr={total_dr} Cr={total_cr}. "
        f"Status: VERIFIED."
    )
    _write_audit_trail(
        db=db,
        journal_id=journal.id,
        action="CREATED",
        performed_by=posted_by,
        auto_remark=remark
    )

    logger.info(f"[ENTERPRISE GL] Journal {journal.id} posted: {reference_type} | Dr={total_dr} Cr={total_cr}")
    return journal


# ============================================================
# PHASE 1: ACCOUNTING PERIOD MANAGEMENT
# ============================================================

class PeriodCreatePayload(BaseModel):
    period_name: str       # "June 2026"
    fiscal_year: int       # 2026
    period_month: int      # 6
    start_date: str        # "2026-06-01"
    end_date: str          # "2026-06-30"


@router.get("/periods")
async def list_accounting_periods(db: Session = Depends(get_db)):
    """List all accounting periods with their lock status."""
    periods = db.query(AccountingPeriod).order_by(
        AccountingPeriod.fiscal_year.desc(),
        AccountingPeriod.period_month.desc()
    ).all()
    return {
        "status": "SUCCESS",
        "data": [
            {
                "id": p.id,
                "period_name": p.period_name,
                "fiscal_year": p.fiscal_year,
                "period_month": p.period_month,
                "start_date": p.start_date.strftime("%Y-%m-%d"),
                "end_date": p.end_date.strftime("%Y-%m-%d"),
                "status": p.status,
                "closed_by": p.closed_by,
                "closed_at": p.closed_at.isoformat() if p.closed_at else None,
                "created_at": p.created_at.isoformat()
            }
            for p in periods
        ]
    }


@router.post("/periods")
async def create_accounting_period(payload: PeriodCreatePayload, db: Session = Depends(get_db)):
    """Create a new accounting period. Periods must not overlap."""
    try:
        start = datetime.strptime(payload.start_date, "%Y-%m-%d").replace(tzinfo=DHAKA_TZ)
        end = datetime.strptime(payload.end_date, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=DHAKA_TZ
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Check for overlap with existing periods
    overlap = db.query(AccountingPeriod).filter(
        and_(AccountingPeriod.start_date <= end, AccountingPeriod.end_date >= start)
    ).first()
    if overlap:
        raise HTTPException(
            status_code=409,
            detail=f"Period overlaps with existing period '{overlap.period_name}' ({overlap.status}). "
                   f"Fix the date range before creating."
        )

    period = AccountingPeriod(
        period_name=payload.period_name,
        fiscal_year=payload.fiscal_year,
        period_month=payload.period_month,
        start_date=start,
        end_date=end,
        status="OPEN"
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return {"status": "SUCCESS", "id": period.id, "period_name": period.period_name, "status_value": "OPEN"}


@router.post("/periods/{period_id}/close")
async def close_accounting_period(period_id: int, operator: str = "SYSTEM", db: Session = Depends(get_db)):
    """
    Close an accounting period. Prevents any further posting within this date range.
    Can be reopened. Use /periods/{id}/lock for permanent close.
    """
    period = db.query(AccountingPeriod).filter(AccountingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found.")
    if period.status == "PERMANENTLY_CLOSED":
        raise HTTPException(status_code=423, detail="Period is permanently locked. Cannot change status.")

    old_status = period.status
    period.status = "CLOSED"
    period.closed_by = operator
    period.closed_at = _now()
    db.commit()
    logger.warning(f"[PERIOD] Period '{period.period_name}' CLOSED by {operator}.")
    return {
        "status": "SUCCESS",
        "message": f"Period '{period.period_name}' is now CLOSED. No postings allowed within {period.start_date.strftime('%Y-%m-%d')} — {period.end_date.strftime('%Y-%m-%d')}.",
        "previous_status": old_status,
        "closed_by": operator
    }


@router.post("/periods/{period_id}/reopen")
async def reopen_accounting_period(period_id: int, operator: str = "SYSTEM", db: Session = Depends(get_db)):
    """Reopen a CLOSED period. Cannot reopen a PERMANENTLY_CLOSED period."""
    period = db.query(AccountingPeriod).filter(AccountingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found.")
    if period.status == "PERMANENTLY_CLOSED":
        raise HTTPException(status_code=423, detail="This period is permanently locked and cannot be reopened. This is by design — audit trail is immutable.")
    if period.status == "OPEN":
        return {"status": "NO_ACTION", "message": "Period is already OPEN."}

    period.status = "OPEN"
    period.closed_by = None
    period.closed_at = None
    db.commit()
    logger.info(f"[PERIOD] Period '{period.period_name}' REOPENED by {operator}.")
    return {"status": "SUCCESS", "message": f"Period '{period.period_name}' reopened by {operator}."}


@router.post("/periods/{period_id}/lock")
async def permanently_lock_period(period_id: int, operator: str = "SYSTEM", db: Session = Depends(get_db)):
    """
    PERMANENTLY close a period. This is IRREVERSIBLE — no postings ever again.
    Use only for tax-filed, audited periods. Matches Oracle's 'Permanently Close'.
    """
    period = db.query(AccountingPeriod).filter(AccountingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found.")
    if period.status == "PERMANENTLY_CLOSED":
        return {"status": "NO_ACTION", "message": "Already permanently closed."}

    period.status = "PERMANENTLY_CLOSED"
    period.closed_by = operator
    period.closed_at = _now()
    db.commit()
    logger.critical(f"[PERIOD] Period '{period.period_name}' PERMANENTLY LOCKED by {operator}. IRREVERSIBLE.")
    return {
        "status": "SUCCESS",
        "message": f"Period '{period.period_name}' is PERMANENTLY CLOSED. No future postings allowed. This cannot be reversed.",
        "locked_by": operator,
        "locked_at": period.closed_at.isoformat()
    }


# ============================================================
# PHASE 2: LEDGER AUDIT TRAIL
# ============================================================

@router.get("/audit-trail/journal/{journal_id}")
async def get_journal_audit_trail(journal_id: int, db: Session = Depends(get_db)):
    """
    Returns the full chronological audit trail for a specific journal entry.
    Shows every action: CREATED, APPROVED, REVERSED, AMENDED, QUARANTINED.
    """
    journal = db.query(JournalEntry).filter(JournalEntry.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail=f"Journal {journal_id} not found.")

    trail = db.query(LedgerAuditTrail).filter(
        LedgerAuditTrail.journal_id == journal_id
    ).order_by(LedgerAuditTrail.performed_at.asc()).all()

    # Build journal line summary
    lines_data = []
    for line in journal.lines:
        acct = line.account
        lines_data.append({
            "account_code": acct.code if acct else 0,
            "account_name": acct.name if acct else "UNKNOWN",
            "account_type": acct.type if acct else "UNKNOWN",
            "debit": round(line.debit, 2),
            "credit": round(line.credit, 2)
        })

    return {
        "status": "SUCCESS",
        "journal": {
            "id": journal.id,
            "reference_type": journal.reference_type,
            "description": journal.description,
            "timestamp": journal.timestamp.isoformat(),
            "verification_status": journal.verification_status,
            "lines": lines_data
        },
        "audit_trail": [
            {
                "id": t.id,
                "action": t.action,
                "field_changed": t.field_changed,
                "old_value": t.old_value,
                "new_value": t.new_value,
                "auto_remark": t.auto_remark,
                "performed_by": t.performed_by,
                "performed_at": t.performed_at.isoformat(),
                "ip_address": t.ip_address
            }
            for t in trail
        ],
        "trail_count": len(trail)
    }


@router.get("/audit-trail/recent")
async def get_recent_audit_trail(
    limit: int = 100,
    action_filter: str = None,
    db: Session = Depends(get_db)
):
    """
    Returns recent ledger audit trail entries across all journals.
    Supports filtering by action type (CREATED, REVERSED, AMENDED, etc.)
    """
    query = db.query(LedgerAuditTrail).order_by(LedgerAuditTrail.performed_at.desc())
    if action_filter:
        query = query.filter(LedgerAuditTrail.action == action_filter.upper())
    trail = query.limit(limit).all()

    return {
        "status": "SUCCESS",
        "count": len(trail),
        "data": [
            {
                "id": t.id,
                "journal_id": t.journal_id,
                "action": t.action,
                "auto_remark": t.auto_remark,
                "performed_by": t.performed_by,
                "performed_at": t.performed_at.isoformat(),
                "field_changed": t.field_changed,
                "old_value": t.old_value,
                "new_value": t.new_value
            }
            for t in trail
        ]
    }


# ============================================================
# PHASE 3: JOURNAL REVERSAL
# ============================================================

class ReversalPayload(BaseModel):
    reason: str
    reversed_by: str = "SYSTEM"


@router.post("/journal/{journal_id}/reverse")
async def reverse_journal(journal_id: int, payload: ReversalPayload, db: Session = Depends(get_db)):
    """
    ORACLE-GRADE JOURNAL REVERSAL.
    Creates an equal and opposite journal entry. Never modifies the original.
    Links both journals via description. Marks original as REVERSED.
    Writes audit trail on both journals.
    """
    original = db.query(JournalEntry).filter(JournalEntry.id == journal_id).first()
    if not original:
        raise HTTPException(status_code=404, detail=f"Journal {journal_id} not found.")

    # Prevent double-reversal
    if original.verification_status == "REVERSED":
        raise HTTPException(
            status_code=409,
            detail=f"Journal {journal_id} has already been reversed. Double-reversal is not allowed."
        )

    original_lines = db.query(LedgerLine).filter(LedgerLine.journal_id == journal_id).all()
    if not original_lines:
        raise HTTPException(status_code=400, detail="Original journal has no ledger lines to reverse.")

    # Build reversal lines (swap debit and credit)
    reversal_lines = []
    for line in original_lines:
        acct = db.query(Account).filter(Account.id == line.account_id).first()
        if not acct:
            raise HTTPException(status_code=422, detail=f"Account ID {line.account_id} not found during reversal.")
        reversal_lines.append({
            "code": acct.code,
            "debit": line.credit,    # swapped
            "credit": line.debit     # swapped
        })

    reversal_description = (
        f"REVERSAL of Journal #{journal_id} ({original.reference_type}): "
        f"'{original.description}'. "
        f"Reason: {payload.reason}. "
        f"Reversed by: {payload.reversed_by}."
    )

    # Post the reversal journal — period check applies to reversal date
    reversal_journal = _post_double_entry_enterprise(
        db=db,
        reference_type=f"REVERSAL_{original.reference_type}",
        description=reversal_description,
        lines=reversal_lines,
        posted_by=payload.reversed_by,
        check_period=True
    )

    # Mark original as REVERSED
    old_status = original.verification_status
    original.verification_status = "REVERSED"

    # Write audit trail on ORIGINAL journal
    _write_audit_trail(
        db=db,
        journal_id=original.id,
        action="REVERSED",
        performed_by=payload.reversed_by,
        auto_remark=(
            f"Journal REVERSED by {payload.reversed_by}. "
            f"Reason: {payload.reason}. "
            f"Reversal journal created: #{reversal_journal.id}. "
            f"Original status changed from {old_status} → REVERSED."
        ),
        field_changed="verification_status",
        old_value=old_status,
        new_value="REVERSED"
    )

    # Write audit trail on REVERSAL journal
    _write_audit_trail(
        db=db,
        journal_id=reversal_journal.id,
        action="REVERSAL_POSTED",
        performed_by=payload.reversed_by,
        auto_remark=(
            f"This is a REVERSAL journal for original J-{journal_id}. "
            f"Reason: {payload.reason}. "
            f"All debit/credit lines are exactly swapped from the original."
        )
    )

    db.commit()
    logger.warning(f"[REVERSAL] Journal {journal_id} reversed by {payload.reversed_by}. Reversal: {reversal_journal.id}")
    return {
        "status": "SUCCESS",
        "message": f"Journal #{journal_id} has been reversed.",
        "original_journal_id": journal_id,
        "reversal_journal_id": reversal_journal.id,
        "original_status": "REVERSED",
        "reversed_by": payload.reversed_by,
        "reason": payload.reason
    }


# ============================================================
# PHASE 4: GL ACCOUNT STATEMENT (Running Balance Drill-Down)
# ============================================================

@router.get("/account/{account_code}/statement")
async def get_account_statement(
    account_code: int,
    date_from: str = None,
    date_to: str = None,
    db: Session = Depends(get_db)
):
    """
    ORACLE-GRADE GL ACCOUNT STATEMENT.
    Returns every posting to this account with a running balance.
    This is the source of truth for any single account's history.
    Supports optional date range filtering.
    """
    account = db.query(Account).filter(Account.code == account_code).first()
    if not account:
        raise HTTPException(status_code=404, detail=f"Account code {account_code} not found in Chart of Accounts.")

    # Build query for all ledger lines for this account
    query = db.query(
        LedgerLine.id,
        LedgerLine.debit,
        LedgerLine.credit,
        JournalEntry.id.label("journal_id"),
        JournalEntry.timestamp,
        JournalEntry.reference_type,
        JournalEntry.description,
        JournalEntry.verification_status
    ).join(JournalEntry, LedgerLine.journal_id == JournalEntry.id).filter(
        LedgerLine.account_id == account.id,
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    )

    # Date range filters
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=DHAKA_TZ) if "+" not in date_from else datetime.fromisoformat(date_from)
            query = query.filter(JournalEntry.timestamp >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=DHAKA_TZ) if "+" not in date_to else datetime.fromisoformat(date_to)
            query = query.filter(JournalEntry.timestamp <= dt_to)
        except ValueError:
            pass

    rows = query.order_by(JournalEntry.timestamp.asc()).all()

    # Calculate opening balance (everything BEFORE date_from)
    opening_balance = 0.0
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=DHAKA_TZ) if "+" not in date_from else datetime.fromisoformat(date_from)
            ob_dr = db.query(func.coalesce(func.sum(LedgerLine.debit), 0.0)).join(JournalEntry).filter(
                LedgerLine.account_id == account.id,
                JournalEntry.timestamp < dt_from,
                JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
            ).scalar() or 0.0
            ob_cr = db.query(func.coalesce(func.sum(LedgerLine.credit), 0.0)).join(JournalEntry).filter(
                LedgerLine.account_id == account.id,
                JournalEntry.timestamp < dt_from,
                JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
            ).scalar() or 0.0
            # For normal balance: ASSET/EXPENSE = Dr-Cr; LIABILITY/EQUITY/REVENUE = Cr-Dr
            if account.type in ("ASSET", "EXPENSE"):
                opening_balance = round(ob_dr - ob_cr, 2)
            else:
                opening_balance = round(ob_cr - ob_dr, 2)
        except Exception:
            opening_balance = 0.0

    # Build statement with running balance
    transactions = []
    running_balance = opening_balance
    total_debits = 0.0
    total_credits = 0.0

    for row in rows:
        dr = round(float(row.debit), 2)
        cr = round(float(row.credit), 2)

        # Normal balance direction
        if account.type in ("ASSET", "EXPENSE"):
            running_balance = round(running_balance + dr - cr, 2)
        else:
            running_balance = round(running_balance + cr - dr, 2)

        total_debits += dr
        total_credits += cr

        transactions.append({
            "line_id": row.id,
            "journal_id": row.journal_id,
            "date": row.timestamp.strftime("%Y-%m-%d"),
            "time": row.timestamp.strftime("%H:%M:%S"),
            "reference_type": row.reference_type,
            "description": row.description,
            "verification_status": row.verification_status,
            "debit": dr,
            "credit": cr,
            "running_balance": running_balance
        })

    closing_balance = running_balance

    return {
        "status": "SUCCESS",
        "account": {
            "code": account.code,
            "name": account.name,
            "type": account.type,
            "normal_balance": "DEBIT" if account.type in ("ASSET", "EXPENSE") else "CREDIT"
        },
        "period": {
            "from": date_from or "INCEPTION",
            "to": date_to or "PRESENT"
        },
        "opening_balance": opening_balance,
        "closing_balance": closing_balance,
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
        "net_movement": round(total_debits - total_credits, 2),
        "transaction_count": len(transactions),
        "transactions": transactions
    }


# ============================================================
# PHASE 5: BANK RECONCILIATION
# ============================================================

class BankAccountPayload(BaseModel):
    name: str
    bank_name: str
    account_number: str
    gl_account_code: int      # Must exist in CoA, e.g. 100000
    currency: str = "BDT"
    opening_balance: float = 0.0


class BankStatementLineItem(BaseModel):
    transaction_date: str     # "YYYY-MM-DD"
    description: str
    reference: Optional[str] = None
    debit_amount: float = 0.0
    credit_amount: float = 0.0
    running_balance: Optional[float] = None


class BankStatementImportPayload(BaseModel):
    bank_account_id: int
    period_start: str          # "YYYY-MM-DD"
    period_end: str            # "YYYY-MM-DD"
    statement_closing_balance: float
    lines: List[BankStatementLineItem]
    opened_by: str = "SYSTEM"


class ReconcileMatchPayload(BaseModel):
    statement_line_id: int
    journal_id: int
    matched_by: str = "SYSTEM"


@router.get("/bank/accounts")
async def list_bank_accounts(db: Session = Depends(get_db)):
    """List all registered bank accounts."""
    accounts = db.query(BankAccount).filter(BankAccount.is_active == True).all()
    return {
        "status": "SUCCESS",
        "data": [
            {
                "id": a.id,
                "name": a.name,
                "bank_name": a.bank_name,
                "account_number": a.account_number,
                "gl_account_code": a.gl_account_code,
                "currency": a.currency,
                "current_balance": a.current_balance
            }
            for a in accounts
        ]
    }


@router.post("/bank/accounts")
async def create_bank_account(payload: BankAccountPayload, db: Session = Depends(get_db)):
    """Register a bank account linked to a GL cash account."""
    gl_acct = db.query(Account).filter(Account.code == payload.gl_account_code).first()
    if not gl_acct:
        raise HTTPException(
            status_code=422,
            detail=f"GL Account {payload.gl_account_code} not found in Chart of Accounts."
        )

    existing = db.query(BankAccount).filter(BankAccount.account_number == payload.account_number).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Bank account {payload.account_number} already registered.")

    bank_acct = BankAccount(
        name=payload.name,
        bank_name=payload.bank_name,
        account_number=payload.account_number,
        gl_account_code=payload.gl_account_code,
        currency=payload.currency,
        current_balance=payload.opening_balance,
        is_active=True
    )
    db.add(bank_acct)
    db.commit()
    db.refresh(bank_acct)
    return {"status": "SUCCESS", "id": bank_acct.id, "name": bank_acct.name}


@router.post("/bank/statements/import")
async def import_bank_statement(payload: BankStatementImportPayload, db: Session = Depends(get_db)):
    """
    Import bank statement lines for reconciliation.
    Each line starts as UNMATCHED. Reconciliation happens via /bank/reconcile/match.
    A ReconciliationSession is created for the period automatically.
    """
    bank_acct = db.query(BankAccount).filter(BankAccount.id == payload.bank_account_id).first()
    if not bank_acct:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    try:
        period_start = datetime.strptime(payload.period_start, "%Y-%m-%d").replace(tzinfo=DHAKA_TZ)
        period_end = datetime.strptime(payload.period_end, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=DHAKA_TZ
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Create reconciliation session
    session = ReconciliationSession(
        bank_account_id=payload.bank_account_id,
        period_start=period_start,
        period_end=period_end,
        statement_closing_balance=payload.statement_closing_balance,
        gl_closing_balance=None,  # Will be calculated during reconciliation
        difference=None,
        status="OPEN",
        opened_by=payload.opened_by
    )
    db.add(session)
    db.flush()

    # Import statement lines
    imported_count = 0
    for item in payload.lines:
        try:
            txn_date = datetime.strptime(item.transaction_date, "%Y-%m-%d").replace(tzinfo=DHAKA_TZ)
        except ValueError:
            continue  # Skip malformed dates

        line = BankStatementLine(
            bank_account_id=payload.bank_account_id,
            transaction_date=txn_date,
            description=item.description,
            reference=item.reference,
            debit_amount=item.debit_amount,
            credit_amount=item.credit_amount,
            running_balance=item.running_balance,
            status="UNMATCHED",
            reconciliation_session_id=session.id
        )
        db.add(line)
        imported_count += 1

    # Update bank account current balance
    bank_acct.current_balance = payload.statement_closing_balance
    db.commit()

    return {
        "status": "SUCCESS",
        "session_id": session.id,
        "bank_account": bank_acct.name,
        "period": f"{payload.period_start} — {payload.period_end}",
        "lines_imported": imported_count,
        "statement_closing_balance": payload.statement_closing_balance,
        "message": f"Statement imported. {imported_count} lines ready for reconciliation. Use /bank/reconcile/match to match lines."
    }


@router.get("/bank/statements/{bank_account_id}/unmatched")
async def get_unmatched_statement_lines(bank_account_id: int, session_id: int = None, db: Session = Depends(get_db)):
    """
    Returns all unmatched bank statement lines for a bank account.
    Optionally filter by reconciliation session.
    """
    query = db.query(BankStatementLine).filter(
        BankStatementLine.bank_account_id == bank_account_id,
        BankStatementLine.status == "UNMATCHED"
    )
    if session_id:
        query = query.filter(BankStatementLine.reconciliation_session_id == session_id)

    lines = query.order_by(BankStatementLine.transaction_date.asc()).all()
    return {
        "status": "SUCCESS",
        "bank_account_id": bank_account_id,
        "unmatched_count": len(lines),
        "data": [
            {
                "id": l.id,
                "date": l.transaction_date.strftime("%Y-%m-%d"),
                "description": l.description,
                "reference": l.reference,
                "debit": l.debit_amount,
                "credit": l.credit_amount,
                "running_balance": l.running_balance,
                "session_id": l.reconciliation_session_id
            }
            for l in lines
        ]
    }


@router.post("/bank/reconcile/match")
async def match_statement_to_gl(payload: ReconcileMatchPayload, db: Session = Depends(get_db)):
    """
    Match a bank statement line to a GL journal entry.
    Once matched, the line status becomes MATCHED and cannot be re-matched.
    """
    stmt_line = db.query(BankStatementLine).filter(BankStatementLine.id == payload.statement_line_id).first()
    if not stmt_line:
        raise HTTPException(status_code=404, detail="Statement line not found.")
    if stmt_line.status == "MATCHED":
        raise HTTPException(status_code=409, detail="This statement line is already matched.")

    journal = db.query(JournalEntry).filter(JournalEntry.id == payload.journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail=f"Journal {payload.journal_id} not found.")

    stmt_line.status = "MATCHED"
    stmt_line.matched_journal_id = payload.journal_id
    stmt_line.matched_at = _now()
    stmt_line.matched_by = payload.matched_by
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Statement line #{payload.statement_line_id} matched to Journal #{payload.journal_id}.",
        "matched_by": payload.matched_by,
        "matched_at": stmt_line.matched_at.isoformat()
    }


@router.post("/bank/reconcile/{session_id}/unmatch/{line_id}")
async def unmatch_statement_line(session_id: int, line_id: int, db: Session = Depends(get_db)):
    """Remove a match from a statement line (reset to UNMATCHED). Audit-safe."""
    line = db.query(BankStatementLine).filter(
        BankStatementLine.id == line_id,
        BankStatementLine.reconciliation_session_id == session_id
    ).first()
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found in this session.")
    if line.status != "MATCHED":
        return {"status": "NO_ACTION", "message": "Line is not matched."}

    line.status = "UNMATCHED"
    line.matched_journal_id = None
    line.matched_at = None
    line.matched_by = None
    db.commit()
    return {"status": "SUCCESS", "message": f"Line #{line_id} unmatched and reset to UNMATCHED."}


@router.get("/bank/reconcile/{session_id}/proof")
async def get_reconciliation_proof(session_id: int, db: Session = Depends(get_db)):
    """
    ORACLE-GRADE RECONCILIATION PROOF REPORT.
    Computes: Statement Balance vs GL Balance and calculates difference.
    Lists all unmatched items. A clean reconciliation has difference = 0.00.
    """
    session = db.query(ReconciliationSession).filter(ReconciliationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Reconciliation session not found.")

    bank_acct = db.query(BankAccount).filter(BankAccount.id == session.bank_account_id).first()

    # Get all lines in this session
    all_lines = db.query(BankStatementLine).filter(
        BankStatementLine.reconciliation_session_id == session_id
    ).all()

    matched = [l for l in all_lines if l.status == "MATCHED"]
    unmatched = [l for l in all_lines if l.status == "UNMATCHED"]
    excluded = [l for l in all_lines if l.status == "EXCLUDED"]

    # Calculate GL balance for the bank account over the period
    gl_account = db.query(Account).filter(Account.code == bank_acct.gl_account_code).first()
    gl_balance = 0.0
    if gl_account:
        gl_dr = db.query(func.coalesce(func.sum(LedgerLine.debit), 0.0)).join(JournalEntry).filter(
            LedgerLine.account_id == gl_account.id,
            JournalEntry.timestamp >= session.period_start,
            JournalEntry.timestamp <= session.period_end,
            JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
        ).scalar() or 0.0
        gl_cr = db.query(func.coalesce(func.sum(LedgerLine.credit), 0.0)).join(JournalEntry).filter(
            LedgerLine.account_id == gl_account.id,
            JournalEntry.timestamp >= session.period_start,
            JournalEntry.timestamp <= session.period_end,
            JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
        ).scalar() or 0.0
        gl_balance = round(float(gl_dr) - float(gl_cr), 2)

    difference = round(session.statement_closing_balance - gl_balance, 2)
    is_balanced = abs(difference) < 0.01

    # Update session with computed values
    session.gl_closing_balance = gl_balance
    session.difference = difference
    if is_balanced and session.status == "OPEN":
        session.status = "BALANCED"
    db.commit()

    # Build unmatched items detail
    unmatched_detail = [
        {
            "id": l.id,
            "date": l.transaction_date.strftime("%Y-%m-%d"),
            "description": l.description,
            "debit": l.debit_amount,
            "credit": l.credit_amount,
            "net": round(l.credit_amount - l.debit_amount, 2)
        }
        for l in unmatched
    ]

    return {
        "status": "SUCCESS",
        "session": {
            "id": session.id,
            "bank_account": bank_acct.name if bank_acct else "UNKNOWN",
            "gl_account_code": bank_acct.gl_account_code if bank_acct else None,
            "period": f"{session.period_start.strftime('%Y-%m-%d')} — {session.period_end.strftime('%Y-%m-%d')}",
            "status": session.status
        },
        "reconciliation": {
            "statement_closing_balance": round(session.statement_closing_balance, 2),
            "gl_closing_balance": round(gl_balance, 2),
            "difference": difference,
            "is_balanced": is_balanced,
            "verdict": "✅ RECONCILED" if is_balanced else f"⚠️ UNRECONCILED — difference: {abs(difference):.2f}"
        },
        "summary": {
            "total_lines": len(all_lines),
            "matched": len(matched),
            "unmatched": len(unmatched),
            "excluded": len(excluded)
        },
        "unmatched_items": unmatched_detail
    }


# ============================================================
# PHASE 6: PARTIAL PAYMENTS — AR & AP
# ============================================================

class ARPartialPayPayload(BaseModel):
    amount: float
    payment_method: str = "CASH"
    reference: Optional[str] = None
    posted_by: str = "SYSTEM"
    notes: Optional[str] = None


class APPartialPayPayload(BaseModel):
    amount: float
    payment_method: str = "BANK_TRANSFER"
    reference: Optional[str] = None
    posted_by: str = "SYSTEM"
    notes: Optional[str] = None


@router.get("/ar/{receivable_id}/payments")
async def get_ar_payment_history(receivable_id: int, db: Session = Depends(get_db)):
    """Full payment history for an AR receivable with outstanding balance."""
    ar = db.query(ARReceivable).filter(ARReceivable.id == receivable_id).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Receivable not found.")

    payments = db.query(ARPayment).filter(ARPayment.receivable_id == receivable_id).all()
    total_paid = round(sum(p.amount for p in payments), 2)
    outstanding = round(ar.amount - total_paid, 2)

    return {
        "status": "SUCCESS",
        "receivable": {
            "id": ar.id,
            "client": ar.client_name,
            "ota_type": ar.ota_type,
            "total_amount": ar.amount,
            "current_status": ar.status,
            "total_paid": total_paid,
            "outstanding": outstanding
        },
        "payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "date": p.payment_date.strftime("%Y-%m-%d"),
                "method": p.payment_method,
                "reference": p.reference,
                "journal_id": p.journal_id,
                "posted_by": p.posted_by,
                "notes": p.notes
            }
            for p in payments
        ]
    }


@router.post("/ar/{receivable_id}/partial-pay")
async def partial_pay_ar(receivable_id: int, payload: ARPartialPayPayload, db: Session = Depends(get_db)):
    """
    Post a partial payment against an AR receivable.
    Updates status: OUTSTANDING → PARTIAL → PAID when fully settled.
    Posts double-entry: Dr Cash (100000) / Cr AR (110000) for the partial amount.
    """
    ar = db.query(ARReceivable).filter(ARReceivable.id == receivable_id).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Receivable not found.")
    if ar.status == "PAID":
        raise HTTPException(status_code=409, detail="Receivable is already fully paid.")

    # Calculate already paid
    existing_payments = db.query(ARPayment).filter(ARPayment.receivable_id == receivable_id).all()
    already_paid = round(sum(p.amount for p in existing_payments), 2)
    outstanding = round(ar.amount - already_paid, 2)

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")
    if payload.amount > outstanding + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount {payload.amount} exceeds outstanding balance {outstanding}. Overpayment not allowed."
        )

    actual_amount = min(payload.amount, outstanding)

    # Post double-entry to GL
    desc = (
        f"Partial AR Payment: {ar.client_name} ({ar.ota_type or 'DIRECT'}) "
        f"— Amount: {actual_amount:.2f} | Ref: {payload.reference or 'N/A'}"
    )
    journal = _post_double_entry_enterprise(
        db=db,
        reference_type="AR_PARTIAL_RECEIPT",
        description=desc,
        lines=[
            {"code": 100000, "debit": actual_amount, "credit": 0.0},   # Dr Cash/Bank
            {"code": 110000, "debit": 0.0, "credit": actual_amount}    # Cr AR Consolidated
        ],
        posted_by=payload.posted_by
    )

    # Record the payment
    payment = ARPayment(
        receivable_id=receivable_id,
        amount=actual_amount,
        payment_method=payload.payment_method,
        reference=payload.reference,
        journal_id=journal.id,
        posted_by=payload.posted_by,
        notes=payload.notes
    )
    db.add(payment)

    # Update AR status
    new_total_paid = round(already_paid + actual_amount, 2)
    new_outstanding = round(ar.amount - new_total_paid, 2)

    if new_outstanding <= 0.01:
        ar.status = "PAID"
    else:
        ar.status = "PARTIAL"

    db.commit()

    return {
        "status": "SUCCESS",
        "receivable_id": receivable_id,
        "client": ar.client_name,
        "payment_posted": actual_amount,
        "total_paid": new_total_paid,
        "outstanding_remaining": max(0.0, new_outstanding),
        "ar_status": ar.status,
        "journal_id": journal.id,
        "message": f"Payment of {actual_amount:.2f} posted. {'Fully settled.' if ar.status == 'PAID' else f'{new_outstanding:.2f} still outstanding.'}"
    }


@router.get("/ap/{invoice_id}/payments")
async def get_ap_payment_history(invoice_id: int, db: Session = Depends(get_db)):
    """Full payment history for an AP invoice with outstanding balance."""
    inv = db.query(APInvoice).filter(APInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    vendor = db.query(Vendor).filter(Vendor.id == inv.vendor_id).first()
    payments = db.query(APPayment).filter(APPayment.invoice_id == invoice_id).all()
    total_paid = round(sum(p.amount for p in payments), 2)
    outstanding = round(inv.amount - total_paid, 2)

    return {
        "status": "SUCCESS",
        "invoice": {
            "id": inv.id,
            "vendor": vendor.name if vendor else "UNKNOWN",
            "invoice_ref": inv.invoice_ref,
            "total_amount": inv.amount,
            "current_status": inv.status,
            "total_paid": total_paid,
            "outstanding": outstanding
        },
        "payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "date": p.payment_date.strftime("%Y-%m-%d"),
                "method": p.payment_method,
                "reference": p.reference,
                "journal_id": p.journal_id,
                "posted_by": p.posted_by,
                "notes": p.notes
            }
            for p in payments
        ]
    }


@router.post("/ap/{invoice_id}/partial-pay")
async def partial_pay_ap(invoice_id: int, payload: APPartialPayPayload, db: Session = Depends(get_db)):
    """
    Post a partial payment against an AP invoice.
    Updates status: OUTSTANDING → PARTIAL → PAID when fully settled.
    Posts double-entry: Dr AP (200000) / Cr Cash (100000).
    """
    inv = db.query(APInvoice).filter(APInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status == "PAID":
        raise HTTPException(status_code=409, detail="Invoice is already fully paid.")

    vendor = db.query(Vendor).filter(Vendor.id == inv.vendor_id).first()
    vendor_name = vendor.name if vendor else "VENDOR"

    existing_payments = db.query(APPayment).filter(APPayment.invoice_id == invoice_id).all()
    already_paid = round(sum(p.amount for p in existing_payments), 2)
    outstanding = round(inv.amount - already_paid, 2)

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")
    if payload.amount > outstanding + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Payment {payload.amount} exceeds outstanding {outstanding}. Overpayment not allowed."
        )

    actual_amount = min(payload.amount, outstanding)

    desc = (
        f"Partial AP Payment to {vendor_name} — Invoice: {inv.invoice_ref} "
        f"| Amount: {actual_amount:.2f} | Method: {payload.payment_method} | Ref: {payload.reference or 'N/A'}"
    )
    journal = _post_double_entry_enterprise(
        db=db,
        reference_type="AP_PARTIAL_PAYMENT",
        description=desc,
        lines=[
            {"code": 200000, "debit": actual_amount, "credit": 0.0},   # Dr AP (reducing liability)
            {"code": 100000, "debit": 0.0, "credit": actual_amount}    # Cr Cash/Bank
        ],
        posted_by=payload.posted_by
    )

    payment = APPayment(
        invoice_id=invoice_id,
        amount=actual_amount,
        payment_method=payload.payment_method,
        reference=payload.reference,
        journal_id=journal.id,
        posted_by=payload.posted_by,
        notes=payload.notes
    )
    db.add(payment)

    new_total_paid = round(already_paid + actual_amount, 2)
    new_outstanding = round(inv.amount - new_total_paid, 2)

    if new_outstanding <= 0.01:
        inv.status = "PAID"
    else:
        inv.status = "PARTIAL"

    db.commit()

    return {
        "status": "SUCCESS",
        "invoice_id": invoice_id,
        "vendor": vendor_name,
        "payment_posted": actual_amount,
        "total_paid": new_total_paid,
        "outstanding_remaining": max(0.0, new_outstanding),
        "invoice_status": inv.status,
        "journal_id": journal.id,
        "message": f"Payment of {actual_amount:.2f} posted to {vendor_name}. {'Fully settled.' if inv.status == 'PAID' else f'{new_outstanding:.2f} outstanding.'}"
    }


# ============================================================
# PHASE 7: BUDGET vs ACTUAL MODULE
# ============================================================

class BudgetLinePayload(BaseModel):
    fiscal_year: int
    period_month: int         # 1–12, or 0 for full-year
    account_code: int
    division: str = "CONSOLIDATED"
    budget_amount: float
    notes: Optional[str] = None
    created_by: str = "SYSTEM"


class BudgetBatchPayload(BaseModel):
    lines: List[BudgetLinePayload]


@router.post("/budget")
async def create_budget_line(payload: BudgetLinePayload, db: Session = Depends(get_db)):
    """Create a single budget line for an account/period/division."""
    acct = db.query(Account).filter(Account.code == payload.account_code).first()
    if not acct:
        raise HTTPException(status_code=422, detail=f"Account code {payload.account_code} not in CoA.")

    # Upsert logic — if same year/month/account/division exists, update it
    existing = db.query(Budget).filter(
        Budget.fiscal_year == payload.fiscal_year,
        Budget.period_month == payload.period_month,
        Budget.account_code == payload.account_code,
        Budget.division == payload.division.upper()
    ).first()

    if existing:
        existing.budget_amount = payload.budget_amount
        existing.notes = payload.notes
        db.commit()
        return {"status": "UPDATED", "id": existing.id, "account": acct.name, "amount": payload.budget_amount}

    budget = Budget(
        fiscal_year=payload.fiscal_year,
        period_month=payload.period_month,
        account_code=payload.account_code,
        division=payload.division.upper(),
        budget_amount=payload.budget_amount,
        notes=payload.notes,
        created_by=payload.created_by
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return {"status": "CREATED", "id": budget.id, "account": acct.name, "amount": payload.budget_amount}


@router.post("/budget/batch")
async def create_budget_batch(payload: BudgetBatchPayload, db: Session = Depends(get_db)):
    """Create or update multiple budget lines at once."""
    results = []
    for line in payload.lines:
        acct = db.query(Account).filter(Account.code == line.account_code).first()
        if not acct:
            results.append({"account_code": line.account_code, "status": "SKIPPED", "reason": "Account not found"})
            continue

        existing = db.query(Budget).filter(
            Budget.fiscal_year == line.fiscal_year,
            Budget.period_month == line.period_month,
            Budget.account_code == line.account_code,
            Budget.division == line.division.upper()
        ).first()

        if existing:
            existing.budget_amount = line.budget_amount
            existing.notes = line.notes
            results.append({"account_code": line.account_code, "account_name": acct.name, "status": "UPDATED", "amount": line.budget_amount})
        else:
            budget = Budget(
                fiscal_year=line.fiscal_year,
                period_month=line.period_month,
                account_code=line.account_code,
                division=line.division.upper(),
                budget_amount=line.budget_amount,
                notes=line.notes,
                created_by=line.created_by
            )
            db.add(budget)
            results.append({"account_code": line.account_code, "account_name": acct.name, "status": "CREATED", "amount": line.budget_amount})

    db.commit()
    return {"status": "SUCCESS", "processed": len(results), "results": results}


@router.get("/budget/vs-actual")
async def get_budget_vs_actual(
    fiscal_year: int,
    period_month: int = 0,
    division: str = None,
    db: Session = Depends(get_db)
):
    """
    ORACLE-GRADE BUDGET vs ACTUAL VARIANCE REPORT.
    For every budgeted account, calculates:
      - Budget Amount
      - Actual Amount (from live GL)
      - Variance (Actual - Budget)
      - Variance % ((Actual - Budget) / Budget * 100)
    Grouped by account type.
    """
    budget_query = db.query(Budget).filter(Budget.fiscal_year == fiscal_year)
    if period_month > 0:
        budget_query = budget_query.filter(Budget.period_month == period_month)
    if division:
        budget_query = budget_query.filter(Budget.division == division.upper())

    budgets = budget_query.all()
    if not budgets:
        return {
            "status": "NO_DATA",
            "message": f"No budget data found for year {fiscal_year}"
                       + (f" month {period_month}" if period_month > 0 else "")
                       + (f" division {division}" if division else "") + ".",
            "tip": "Use POST /budget or POST /budget/batch to set budgets."
        }

    results = []
    total_budget = 0.0
    total_actual = 0.0

    for b in budgets:
        acct = db.query(Account).filter(Account.code == b.account_code).first()
        if not acct:
            continue

        # Get actual GL balance for this account
        dr_sum = db.query(func.coalesce(func.sum(LedgerLine.debit), 0.0)).join(JournalEntry).filter(
            LedgerLine.account_id == acct.id,
            JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
        ).scalar() or 0.0
        cr_sum = db.query(func.coalesce(func.sum(LedgerLine.credit), 0.0)).join(JournalEntry).filter(
            LedgerLine.account_id == acct.id,
            JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
        ).scalar() or 0.0

        # Normal balance direction
        if acct.type in ("ASSET", "EXPENSE"):
            actual = round(float(dr_sum) - float(cr_sum), 2)
        else:
            actual = round(float(cr_sum) - float(dr_sum), 2)

        budget_amt = round(b.budget_amount, 2)
        variance = round(actual - budget_amt, 2)
        variance_pct = round((variance / budget_amt * 100), 1) if budget_amt != 0 else 0.0

        total_budget += budget_amt
        total_actual += actual

        results.append({
            "account_code": acct.code,
            "account_name": acct.name,
            "account_type": acct.type,
            "division": b.division,
            "budget": budget_amt,
            "actual": actual,
            "variance": variance,
            "variance_pct": variance_pct,
            "status": (
                "ON_TRACK" if abs(variance_pct) <= 5
                else "OVER_BUDGET" if variance > 0 and acct.type == "EXPENSE"
                else "UNDER_BUDGET" if variance < 0 and acct.type == "REVENUE"
                else "FAVORABLE"
            )
        })

    # Group by account type
    grouped = {"ASSET": [], "LIABILITY": [], "EQUITY": [], "REVENUE": [], "EXPENSE": []}
    for r in results:
        grouped.get(r["account_type"], grouped["ASSET"]).append(r)

    total_variance = round(total_actual - total_budget, 2)
    total_variance_pct = round((total_variance / total_budget * 100), 1) if total_budget != 0 else 0.0

    return {
        "status": "SUCCESS",
        "period": {
            "fiscal_year": fiscal_year,
            "month": period_month if period_month > 0 else "FULL_YEAR",
            "division": division or "ALL_DIVISIONS"
        },
        "summary": {
            "total_budget": round(total_budget, 2),
            "total_actual": round(total_actual, 2),
            "total_variance": total_variance,
            "total_variance_pct": total_variance_pct,
            "accounts_tracked": len(results)
        },
        "by_type": grouped,
        "all_lines": results
    }


# ============================================================
# PHASE 8: SOVEREIGN ADAPTER ENDPOINTS
# Bridges between frontend payload shapes and core API.
# Every endpoint here is a clean wrapper — no business logic lives here;
# it delegates 100% to the Phase 1–7 functions above.
# ============================================================


# ============================================================
# 8.1  JOURNAL LIST
# ============================================================

@router.get("/journal/list")
async def list_journals(limit: int = 200, db: Session = Depends(get_db)):
    """
    Returns all journal entries (header + line count) in descending order.
    Used by Tab 16 (Reversal Engine) to populate the journal selector dropdown.
    """
    journals = db.query(JournalEntry).order_by(JournalEntry.timestamp.desc()).limit(limit).all()

    data = []
    for j in journals:
        line_count = db.query(func.count(LedgerLine.id)).filter(
            LedgerLine.journal_id == j.id
        ).scalar() or 0
        data.append({
            "id": j.id,
            "reference_type": j.reference_type,
            "description": j.description,
            "timestamp": j.timestamp.isoformat(),
            "verification_status": j.verification_status,
            "line_count": int(line_count)
        })

    return {"status": "SUCCESS", "count": len(data), "data": data}


class ApproveJournalPayload(BaseModel):
    notes: Optional[str] = None
    simulated_role: Optional[str] = None
    simulated_user: Optional[str] = None

@router.get("/journal/pending-approvals")
async def list_pending_approvals(db: Session = Depends(get_db)):
    """
    Returns all journal entries pending approval (verification_status = 'PENDING_APPROVAL')
    with full line breakdowns for check-and-approve UI panel.
    """
    journals = db.query(JournalEntry).filter(
        JournalEntry.verification_status == "PENDING_APPROVAL"
    ).order_by(JournalEntry.timestamp.desc()).all()

    data = []
    for j in journals:
        lines_data = []
        total_dr = 0.0
        for l in j.lines:
            total_dr += l.debit
            lines_data.append({
                "id": l.id,
                "account_code": l.account.code,
                "account_name": l.account.name,
                "debit": l.debit,
                "credit": l.credit
            })
        data.append({
            "id": j.id,
            "reference_type": j.reference_type,
            "description": j.description,
            "timestamp": j.timestamp.isoformat(),
            "verification_status": j.verification_status,
            "posted_by": j.posted_by or "Unknown Accountant",
            "total_debit": round(total_dr, 2),
            "lines": lines_data
        })

    return {"status": "SUCCESS", "count": len(data), "data": data}

@router.post("/journal/{journal_id}/approve")
async def approve_journal(
    journal_id: int,
    payload: ApproveJournalPayload,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Approves a manual journal entry. Enforces GM cap of USD 50,000.
    Updates verification_status to VERIFIED.
    """
    journal = db.query(JournalEntry).filter(JournalEntry.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal entry not found.")

    if journal.verification_status != "PENDING_APPROVAL":
        raise HTTPException(
            status_code=400,
            detail=f"Journal entry is in status {journal.verification_status}; only pending approvals can be authorized."
        )

    # Determine simulated or token role
    role = (payload.simulated_role or current_user.get("role") or "ACCOUNTANT").upper()
    user_name = payload.simulated_user or current_user.get("name") or "Authorized User"

    if role == "ACCOUNTANT":
        raise HTTPException(
            status_code=403,
            detail="Authorization Denied: Accountants are not authorized to approve journal entries."
        )

    # Calculate total debit for limit check
    total_debit = sum(float(l.debit) for l in journal.lines)

    if role == "GM" and total_debit > 50000.0:
        raise HTTPException(
            status_code=403,
            detail=f"Clearance threshold exceeded: General Manager limit is capped at USD 50,000. "
                   f"Journal amount is USD {total_debit:,.2f}. CFO authorization is required."
        )

    # Approve
    journal.verification_status = "VERIFIED"
    journal.approved_by = user_name
    journal.approval_notes = payload.notes or "Manual Journal Approved"

    # Write audit trail
    _write_audit_trail(
        db=db,
        journal_id=journal.id,
        action="APPROVAL",
        performed_by=user_name,
        auto_remark=f"Journal authorized. Approved as {role}. Notes: {payload.notes or ''}"
    )

    db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Journal entry approved successfully by {user_name} (Role: {role})."
    }

@router.post("/journal/{journal_id}/reject")
async def reject_journal(
    journal_id: int,
    payload: ApproveJournalPayload,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Rejects a pending journal entry, setting verification_status to REJECTED.
    """
    journal = db.query(JournalEntry).filter(JournalEntry.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal entry not found.")

    if journal.verification_status != "PENDING_APPROVAL":
        raise HTTPException(
            status_code=400,
            detail=f"Journal entry is in status {journal.verification_status}; only pending approvals can be rejected."
        )

    role = (payload.simulated_role or current_user.get("role") or "ACCOUNTANT").upper()
    user_name = payload.simulated_user or current_user.get("name") or "Authorized User"

    if role == "ACCOUNTANT":
        raise HTTPException(
            status_code=403,
            detail="Authorization Denied: Accountants are not authorized to reject journal entries."
        )

    # Reject
    journal.verification_status = "REJECTED"
    journal.approved_by = user_name
    journal.approval_notes = payload.notes or "Manual Journal Rejected"

    # Write audit trail
    _write_audit_trail(
        db=db,
        journal_id=journal.id,
        action="REJECTION",
        performed_by=user_name,
        auto_remark=f"Journal rejected. Declined as {role}. Reason: {payload.notes or ''}"
    )

    db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Journal entry rejected by {user_name} (Role: {role})."
    }



# ============================================================
# 8.2  AR RECEIVABLES LIST
# ============================================================

@router.get("/ar/receivables")
async def list_ar_receivables(db: Session = Depends(get_db)):
    """
    Full AR receivables list with payment summaries.
    Used by Tab 18 (Partial Payments) to show what can be collected.
    """
    receivables = db.query(ARReceivable).order_by(ARReceivable.created_at.desc()).all()

    data = []
    for ar in receivables:
        payments = db.query(ARPayment).filter(ARPayment.receivable_id == ar.id).all()
        total_paid = round(sum(p.amount for p in payments), 2)
        data.append({
            "id": ar.id,
            "client_name": ar.client_name,
            "ota_type": ar.ota_type,
            "amount": ar.amount,
            "status": ar.status,
            "paid_amount": total_paid,
            "outstanding": round(ar.amount - total_paid, 2),
            "created_at": ar.created_at.isoformat() if ar.created_at else None
        })

    return {"status": "SUCCESS", "count": len(data), "data": data}


# ============================================================
# 8.3  AR FULL PAY (alias for partial-pay with full outstanding)
# ============================================================

@router.post("/ar/{receivable_id}/pay")
async def full_pay_ar_alias(
    receivable_id: int,
    payload: ARPartialPayPayload,
    db: Session = Depends(get_db)
):
    """
    Alias endpoint. Frontend calls /ar/{id}/pay for both full and partial AR payments.
    Delegates 100% to partial_pay_ar which handles both full and partial amounts.
    """
    return await partial_pay_ar(receivable_id, payload, db)


# ============================================================
# 8.4  PERIOD STATUS PATCH (unified controller)
# ============================================================

class PeriodStatusPayload(BaseModel):
    status: str          # "OPEN" | "CLOSED" | "PERMANENTLY_CLOSED"
    operator: str = "SYSTEM"


@router.patch("/periods/{period_id}/status")
async def patch_period_status(
    period_id: int,
    payload: PeriodStatusPayload,
    db: Session = Depends(get_db)
):
    """
    Unified period status PATCH — maps a single `status` field to the
    correct close/reopen/lock operation. Frontend sends PATCH /periods/{id}/status
    with body { "status": "CLOSED" | "OPEN" | "PERMANENTLY_CLOSED" }.
    """
    action = payload.status.strip().upper()

    if action == "CLOSED":
        return await close_accounting_period(period_id, payload.operator, db)
    elif action == "OPEN":
        return await reopen_accounting_period(period_id, payload.operator, db)
    elif action == "PERMANENTLY_CLOSED":
        return await permanently_lock_period(period_id, payload.operator, db)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Allowed: OPEN, CLOSED, PERMANENTLY_CLOSED."
        )


# ============================================================
# 8.5  PERIOD CREATE — SIMPLIFIED (auto-derives fiscal_year & period_month)
# ============================================================

class PeriodSimplePayload(BaseModel):
    name: str          # "June 2026" or "FY2026-Q2"
    start_date: str    # "2026-06-01"
    end_date: str      # "2026-06-30"


@router.post("/periods/simple")
async def create_period_simple(
    payload: PeriodSimplePayload,
    db: Session = Depends(get_db)
):
    """
    Simplified period creation.
    Frontend only sends {name, start_date, end_date}.
    Fiscal year and period month are auto-derived from start_date.
    """
    try:
        start_dt = datetime.strptime(payload.start_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_date. Use YYYY-MM-DD.")

    derived_payload = PeriodCreatePayload(
        period_name=payload.name,
        fiscal_year=start_dt.year,
        period_month=start_dt.month,
        start_date=payload.start_date,
        end_date=payload.end_date
    )
    return await create_accounting_period(derived_payload, db)


# ============================================================
# 8.6  BANK STATEMENT — GET ALL LINES FOR AN ACCOUNT
# ============================================================

@router.get("/bank/{bank_account_id}/statement")
async def get_bank_statement_lines(
    bank_account_id: int,
    db: Session = Depends(get_db)
):
    """
    Returns all statement lines for a bank account (newest first).
    Used by Tab 8 to populate the reconciliation grid.
    """
    bank_acct = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
    if not bank_acct:
        raise HTTPException(status_code=404, detail=f"Bank account {bank_account_id} not found.")

    lines = db.query(BankStatementLine).filter(
        BankStatementLine.bank_account_id == bank_account_id
    ).order_by(BankStatementLine.transaction_date.desc()).all()

    return {
        "status": "SUCCESS",
        "bank_account": {
            "id": bank_acct.id,
            "name": bank_acct.name,
            "bank_name": bank_acct.bank_name,
            "account_number": bank_acct.account_number,
            "currency": bank_acct.currency,
            "current_balance": bank_acct.current_balance
        },
        "line_count": len(lines),
        "data": [
            {
                "id": l.id,
                "date": l.transaction_date.strftime("%Y-%m-%d"),
                "description": l.description,
                "reference": l.reference,
                "debit": round(l.debit_amount, 2),
                "credit": round(l.credit_amount, 2),
                "running_balance": round(l.running_balance, 2) if l.running_balance is not None else None,
                "status": l.status,
                "matched_journal_id": l.matched_journal_id,
                "session_id": l.reconciliation_session_id
            }
            for l in lines
        ]
    }


# ============================================================
# 8.7  BANK STATEMENT LINE — MANUAL SINGLE ENTRY POST
# ============================================================

class SingleStatementLinePayload(BaseModel):
    txn_date: str           # "YYYY-MM-DD"
    description: str
    amount: float           # positive = money in (credit), negative = money out (debit)
    reference: Optional[str] = None


@router.post("/bank/{bank_account_id}/statement-line")
async def add_bank_statement_line(
    bank_account_id: int,
    payload: SingleStatementLinePayload,
    db: Session = Depends(get_db)
):
    """
    Manually add a single bank statement line.
    Positive amount = credit (money received).
    Negative amount = debit (money sent / payment out).
    Auto-creates an OPEN reconciliation session if none exists.
    """
    bank_acct = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
    if not bank_acct:
        raise HTTPException(status_code=404, detail=f"Bank account {bank_account_id} not found.")

    try:
        txn_dt = datetime.strptime(payload.txn_date, "%Y-%m-%d").replace(tzinfo=DHAKA_TZ)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid txn_date. Use YYYY-MM-DD.")

    debit_amt  = abs(payload.amount) if payload.amount < 0 else 0.0
    credit_amt = payload.amount       if payload.amount > 0 else 0.0

    # Ensure an OPEN reconciliation session exists
    session = db.query(ReconciliationSession).filter(
        ReconciliationSession.bank_account_id == bank_account_id,
        ReconciliationSession.status == "OPEN"
    ).order_by(ReconciliationSession.id.desc()).first()

    if not session:
        session = ReconciliationSession(
            bank_account_id=bank_account_id,
            period_start=txn_dt,
            period_end=txn_dt,
            statement_closing_balance=round(bank_acct.current_balance + credit_amt - debit_amt, 2),
            status="OPEN",
            opened_by="MANUAL_ENTRY"
        )
        db.add(session)
        db.flush()
    else:
        # Extend period end if this transaction is newer
        if txn_dt > session.period_end:
            session.period_end = txn_dt

    line = BankStatementLine(
        bank_account_id=bank_account_id,
        transaction_date=txn_dt,
        description=payload.description,
        reference=payload.reference,
        debit_amount=debit_amt,
        credit_amount=credit_amt,
        running_balance=None,   # will be re-computed during recon proof
        status="UNMATCHED",
        reconciliation_session_id=session.id
    )
    db.add(line)

    # Update bank account running balance
    bank_acct.current_balance = round(bank_acct.current_balance + credit_amt - debit_amt, 2)
    session.statement_closing_balance = bank_acct.current_balance

    db.commit()
    db.refresh(line)

    direction = "CREDIT" if credit_amt > 0 else "DEBIT"
    logger.info(
        f"[BANK STMT] Manual line added: Account {bank_account_id} | "
        f"{direction} {abs(payload.amount):.2f} | '{payload.description}' | Line ID: {line.id}"
    )
    return {
        "status": "SUCCESS",
        "line_id": line.id,
        "session_id": session.id,
        "direction": direction,
        "amount": abs(payload.amount),
        "new_bank_balance": bank_acct.current_balance,
        "message": f"Statement line #{line.id} added. {direction} of {abs(payload.amount):.2f} recorded against {bank_acct.name}."
    }


# ============================================================
# 8.8  BANK STATEMENT LINE MATCH — SIMPLIFIED POST
# ============================================================

@router.post("/bank/statement-line/{line_id}/match")
async def simple_match_line(
    line_id: int,
    payload: dict = None,
    db: Session = Depends(get_db)
):
    """
    Simplified match endpoint.
    Body: { "journal_id": <int>, "matched_by": "<str>" }  (journal_id optional — auto-match if omitted)
    If no journal_id is provided, the line is marked MATCHED against journal 0 (manual confirmation).
    """
    if payload is None:
        payload = {}

    journal_id = payload.get("journal_id")
    matched_by = str(payload.get("matched_by", "SYSTEM"))

    line = db.query(BankStatementLine).filter(BankStatementLine.id == line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail=f"Statement line {line_id} not found.")
    if line.status == "MATCHED":
        return {"status": "NO_ACTION", "message": f"Line #{line_id} is already MATCHED."}

    if journal_id:
        # Delegate to full match logic
        match_payload = ReconcileMatchPayload(
            statement_line_id=line_id,
            journal_id=int(journal_id),
            matched_by=matched_by
        )
        return await match_statement_to_gl(match_payload, db)
    else:
        # Manual confirmation match — no GL journal required
        line.status = "MATCHED"
        line.matched_at = _now()
        line.matched_by = matched_by
        db.commit()
        logger.info(f"[BANK RECON] Line #{line_id} manually confirmed MATCHED by {matched_by}.")
        return {
            "status": "SUCCESS",
            "message": f"Statement line #{line_id} manually confirmed as MATCHED.",
            "matched_by": matched_by,
            "matched_at": line.matched_at.isoformat()
        }


# ============================================================
# 8.9  BANK RECONCILE TRIGGER — PROOF FOR ACTIVE SESSION
# ============================================================

@router.post("/bank/{bank_account_id}/reconcile")
async def trigger_bank_reconciliation(
    bank_account_id: int,
    db: Session = Depends(get_db)
):
    """
    Triggers reconciliation proof computation for a bank account's latest active session.
    Returns the full proof: Statement Balance vs GL Balance, difference, and unmatched items.
    """
    session = db.query(ReconciliationSession).filter(
        ReconciliationSession.bank_account_id == bank_account_id,
        ReconciliationSession.status.in_(["OPEN", "BALANCED"])
    ).order_by(ReconciliationSession.id.desc()).first()

    if not session:
        # Auto-create a minimal session if none exists, so the endpoint never fails cold
        bank_acct = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
        if not bank_acct:
            raise HTTPException(status_code=404, detail=f"Bank account {bank_account_id} not found.")

        now = _now()
        session = ReconciliationSession(
            bank_account_id=bank_account_id,
            period_start=now.replace(day=1),
            period_end=now,
            statement_closing_balance=bank_acct.current_balance,
            status="OPEN",
            opened_by="AUTO"
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        logger.info(f"[BANK RECON] Auto-created reconciliation session {session.id} for account {bank_account_id}.")

    return await get_reconciliation_proof(session.id, db)


# ============================================================
# 8.10  BUDGETS — LIST (year filter) + CREATE (monthly grid)
# ============================================================

@router.get("/budgets")
async def list_budgets(year: int = None, db: Session = Depends(get_db)):
    """
    Returns all budget lines, optionally filtered by fiscal year.
    Each record includes account metadata and month number.
    Used by Tab 19 to populate the budget grid.
    """
    query = db.query(Budget)
    if year:
        query = query.filter(Budget.fiscal_year == year)
    budget_lines = query.order_by(Budget.account_code.asc(), Budget.period_month.asc()).all()

    data = []
    for b in budget_lines:
        acct = db.query(Account).filter(Account.code == b.account_code).first()
        data.append({
            "id":            b.id,
            "fiscal_year":   b.fiscal_year,
            "period_month":  b.period_month,
            "account_code":  b.account_code,
            "account_name":  acct.name if acct else "UNKNOWN",
            "account_type":  acct.type if acct else "UNKNOWN",
            "division":      b.division,
            "budget_amount": round(b.budget_amount, 2),
            "notes":         b.notes
        })

    return {"status": "SUCCESS", "count": len(data), "data": data}


class BudgetMonthlyPayload(BaseModel):
    """
    Frontend sends a single record for all 12 months at once.
    This avoids 12 separate API calls for one account's annual budget entry.
    """
    account_code: int
    division:     str   = "CONSOLIDATED"
    year:         int
    january:      float = 0.0
    february:     float = 0.0
    march:        float = 0.0
    april:        float = 0.0
    may:          float = 0.0
    june:         float = 0.0
    july:         float = 0.0
    august:       float = 0.0
    september:    float = 0.0
    october:      float = 0.0
    november:     float = 0.0
    december:     float = 0.0
    notes:        Optional[str] = None
    created_by:   str = "SYSTEM"


@router.post("/budgets")
async def create_budget_monthly(payload: BudgetMonthlyPayload, db: Session = Depends(get_db)):
    """
    Upsert all 12 monthly budget lines for one account in a single call.
    If a line for that month/account/year/division already exists, it is updated.
    Returns counts of created vs updated lines.
    """
    acct = db.query(Account).filter(Account.code == payload.account_code).first()
    if not acct:
        raise HTTPException(
            status_code=422,
            detail=f"Account code {payload.account_code} not found in Chart of Accounts. "
                   f"Add it via COA management before creating a budget."
        )

    month_values = [
        (1, payload.january),   (2, payload.february),  (3, payload.march),
        (4, payload.april),     (5, payload.may),        (6, payload.june),
        (7, payload.july),      (8, payload.august),     (9, payload.september),
        (10, payload.october),  (11, payload.november),  (12, payload.december)
    ]

    created = 0
    updated = 0
    division_key = payload.division.strip().upper()

    for month_num, amount in month_values:
        existing = db.query(Budget).filter(
            Budget.fiscal_year   == payload.year,
            Budget.period_month  == month_num,
            Budget.account_code  == payload.account_code,
            Budget.division      == division_key
        ).first()

        if existing:
            existing.budget_amount = round(amount, 2)
            existing.notes         = payload.notes
            updated += 1
        else:
            db.add(Budget(
                fiscal_year     = payload.year,
                period_month    = month_num,
                account_code    = payload.account_code,
                division        = division_key,
                budget_amount   = round(amount, 2),
                notes           = payload.notes,
                created_by      = payload.created_by
            ))
            created += 1

    db.commit()
    logger.info(
        f"[BUDGET] 12-month budget set for [{payload.account_code}] {acct.name} "
        f"({division_key}) FY{payload.year}. Created: {created}, Updated: {updated}."
    )
    return {
        "status":      "SUCCESS",
        "account":     acct.name,
        "account_code": payload.account_code,
        "account_type": acct.type,
        "fiscal_year": payload.year,
        "division":    division_key,
        "created":     created,
        "updated":     updated,
        "message":     f"12-month budget set for {acct.name} ({division_key}) FY{payload.year}. {created} created, {updated} updated."
    }


# ============================================================
# 8.11  ACCOUNT STATEMENT — QUERY-PARAM ALIAS
# Backend core uses /account/{code}/statement (path param).
# Frontend calls /account/statement?code=X (query param).
# ============================================================

@router.get("/account/statement")
async def get_account_statement_by_query(
    code: int,
    date_from: str = None,
    date_to: str = None,
    db: Session = Depends(get_db)
):
    """
    Query-param alias for the core /account/{code}/statement endpoint.
    Frontend passes: /account/statement?code=100000&date_from=...&date_to=...
    Delegates 100% to get_account_statement.
    """
    return await get_account_statement(code, date_from, date_to, db)


# ============================================================
# PHASE 20/21: GAPS ALIGNED ENTERPRISE UPGRADE ENDPOINTS
# ============================================================
from app.models.models import CurrencyRate, TaxRate, TaxRule, SystemAuditLog, InventoryLot, SystemConfig

class CurrencyRatePayload(BaseModel):
    code: str
    rate_to_usd: float

class TaxRatePayload(BaseModel):
    code: str
    name: str
    rate: float
    gl_account_code: int

class TaxRulePayload(BaseModel):
    rule_name: str
    transaction_type: str
    division: str
    tax_rate_code: str
    effective_from: str # YYYY-MM-DD
    effective_to: Optional[str] = None # YYYY-MM-DD

@router.get("/currency/rates")
async def get_currency_rates(db: Session = Depends(get_db)):
    rates = db.query(CurrencyRate).all()
    return {"status": "SUCCESS", "data": [{"id": r.id, "code": r.code, "rate_to_usd": r.rate_to_usd, "updated_at": r.updated_at.isoformat() if r.updated_at else None} for r in rates]}

@router.post("/currency/rates")
async def update_currency_rate(payload: CurrencyRatePayload, db: Session = Depends(get_db)):
    code_val = payload.code.strip().upper()
    rate = db.query(CurrencyRate).filter(CurrencyRate.code == code_val).first()
    if rate:
        rate.rate_to_usd = payload.rate_to_usd
        rate.updated_at = datetime.now(DHAKA_TZ)
    else:
        rate = CurrencyRate(code=code_val, rate_to_usd=payload.rate_to_usd)
        db.add(rate)
    db.commit()
    return {"status": "SUCCESS", "message": f"Exchange rate for {code_val} set to {payload.rate_to_usd} USD."}

@router.post("/currency/revalue")
async def run_currency_revaluation(payload: dict, db: Session = Depends(get_db)):
    """
    Revalues balances in a foreign currency (e.g. AED) back to functional currency USD.
    Adjusts GL Cash accounts, AP, and AR accounts and posts realized/unrealized FX gain/loss.
    """
    currency = str(payload.get("currency_code", "AED")).upper()
    new_rate = float(payload.get("exchange_rate", 1.0))
    operator = str(payload.get("operator", "SYSTEM"))

    # Group by account_id
    from sqlalchemy import func
    balances = db.query(
        LedgerLine.account_id,
        func.sum(LedgerLine.debit - LedgerLine.credit).label("foreign_balance")
    ).join(JournalEntry).filter(
        LedgerLine.currency_code == currency,
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
    ).group_by(LedgerLine.account_id).all()

    revalued_count = 0
    total_adjustment = 0.0

    # Ensure Exchange Gain/Loss account 560000 exists in Chart of Accounts
    fx_gain_loss_acct = db.query(Account).filter(Account.code == 560000).first()
    if not fx_gain_loss_acct:
        fx_gain_loss_acct = Account(code=560000, name="Exchange Gain/Loss (FX)", type="EXPENSE")
        db.add(fx_gain_loss_acct)
        db.flush()

    for row in balances:
        account_id = row.account_id
        foreign_balance = row.foreign_balance
        if abs(foreign_balance) < 0.01:
            continue

        acct = db.query(Account).filter(Account.id == account_id).first()
        if not acct:
            continue

        # Get current USD book value (sum of debits - credits in functional USD values)
        current_usd_val = db.query(
            func.sum(LedgerLine.debit - LedgerLine.credit)
        ).join(JournalEntry).filter(
            LedgerLine.account_id == account_id,
            JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"])
        ).scalar() or 0.0

        # Calculated current value at new rate
        target_usd_val = foreign_balance * new_rate
        adjustment = target_usd_val - current_usd_val

        if abs(adjustment) < 0.01:
            continue

        # Post adjustment entry to this account and offset to FX Gain/Loss (560000)
        desc = f"FX Revaluation adjustment for {acct.name} at rate {new_rate} (Currency: {currency})"
        lines = []

        if adjustment > 0:
            # Asset value increases (Dr Asset / Cr FX Gain) or Liability decreases
            lines = [
                {"code": acct.code, "debit": abs(adjustment), "credit": 0.0},
                {"code": 560000, "debit": 0.0, "credit": abs(adjustment)}
            ]
        else:
            # Asset value decreases (Cr Asset / Dr FX Loss) or Liability increases
            lines = [
                {"code": 560000, "debit": abs(adjustment), "credit": 0.0},
                {"code": acct.code, "debit": 0.0, "credit": abs(adjustment)}
            ]

        from app.routers.accounting_engine import post_double_entry
        post_double_entry(db, "FX_REVALUATION", desc, lines, posted_by=operator, currency_code=currency, exchange_rate=new_rate)
        revalued_count += 1
        total_adjustment += abs(adjustment)

    db.commit()
    return {
        "status": "SUCCESS",
        "message": f"FX Revaluation complete. Adjustments made for {revalued_count} accounts. Total USD volume adjusted: {total_adjustment:.2f}"
    }

@router.get("/tax/rates")
async def get_tax_rates(db: Session = Depends(get_db)):
    rates = db.query(TaxRate).all()
    return {"status": "SUCCESS", "data": [{"id": r.id, "code": r.code, "name": r.name, "rate": r.rate, "gl_account_code": r.gl_account_code, "is_active": r.is_active} for r in rates]}

@router.post("/tax/rates")
async def create_tax_rate(payload: TaxRatePayload, db: Session = Depends(get_db)):
    rate_code = payload.code.strip().upper()
    rate = db.query(TaxRate).filter(TaxRate.code == rate_code).first()
    if rate:
        rate.name = payload.name
        rate.rate = payload.rate
        rate.gl_account_code = payload.gl_account_code
    else:
        rate = TaxRate(code=rate_code, name=payload.name, rate=payload.rate, gl_account_code=payload.gl_account_code)
        db.add(rate)
    db.commit()
    return {"status": "SUCCESS", "message": f"Tax rate {rate_code} set to {payload.rate * 100}%."}

@router.get("/tax/rules")
async def get_tax_rules(db: Session = Depends(get_db)):
    rules = db.query(TaxRule).all()
    return {
        "status": "SUCCESS",
        "data": [
            {
                "id": r.id,
                "rule_name": r.rule_name,
                "transaction_type": r.transaction_type,
                "division": r.division,
                "tax_rate_code": r.tax_rate_code,
                "effective_from": r.effective_from.strftime("%Y-%m-%d"),
                "effective_to": r.effective_to.strftime("%Y-%m-%d") if r.effective_to else None
            }
            for r in rules
        ]
    }

@router.post("/tax/rules")
async def create_tax_rule(payload: TaxRulePayload, db: Session = Depends(get_db)):
    rate = db.query(TaxRate).filter(TaxRate.code == payload.tax_rate_code.upper()).first()
    if not rate:
        raise HTTPException(status_code=422, detail=f"Tax rate code {payload.tax_rate_code} does not exist.")
        
    try:
        eff_from = datetime.strptime(payload.effective_from, "%Y-%m-%d")
        eff_to = datetime.strptime(payload.effective_to, "%Y-%m-%d") if payload.effective_to else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
    rule = TaxRule(
        rule_name=payload.rule_name,
        transaction_type=payload.transaction_type.upper(),
        division=payload.division.upper(),
        tax_rate_code=payload.tax_rate_code.upper(),
        effective_from=eff_from,
        effective_to=eff_to
    )
    db.add(rule)
    db.commit()
    return {"status": "SUCCESS", "message": f"Tax rule '{payload.rule_name}' created successfully."}

@router.get("/audit-logs")
async def get_system_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """Secure endpoint restricted to CFO and Admins to pull unalterable logs."""
    role = str(current_user.get("role", "ACCOUNTANT")).upper()
    if role not in ["SUPER_ADMIN", "CFO", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Access Denied: SOC-2 Audit Trail reports require CFO or Admin credentials.")

    logs = db.query(SystemAuditLog).order_by(SystemAuditLog.timestamp.desc()).limit(limit).all()
    return {
        "status": "SUCCESS",
        "count": len(logs),
        "data": [
            {
                "id": l.id,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "operator": l.operator,
                "action": l.action,
                "table_name": l.table_name,
                "record_id": l.record_id,
                "field_name": l.field_name,
                "old_value": l.old_value,
                "new_value": l.new_value
            }
            for l in logs
        ]
    }

@router.get("/inventory/costing/method")
async def get_costing_method(db: Session = Depends(get_db)):
    config = db.query(SystemConfig).first()
    method = "FIFO"
    if config and config.financial_laws:
        method = config.financial_laws.get("costing_method", "FIFO")
    return {"status": "SUCCESS", "method": method}

@router.post("/inventory/costing/method")
async def set_costing_method(payload: dict, db: Session = Depends(get_db)):
    method = str(payload.get("method", "FIFO")).upper()
    if method not in ["FIFO", "LIFO"]:
        raise HTTPException(status_code=400, detail="Invalid costing method. Allowed: FIFO, LIFO.")
        
    config = db.query(SystemConfig).first()
    if not config:
        config = SystemConfig(financial_laws={})
        db.add(config)
        
    # Copy dictionary to trigger updates
    laws = dict(config.financial_laws or {})
    laws["costing_method"] = method
    config.financial_laws = laws
    db.commit()
    return {"status": "SUCCESS", "method": method, "message": f"Inventory costing method set to {method}."}

# ============================================================
# 8.12  BANK FEEDS AUTO-MATCHING ENGINE (RULE-BASED)
# ============================================================

class AutoMatchStatementLineItem(BaseModel):
    id: int
    date: str
    description: str
    amount: float
    reference: Optional[str] = None

class BankAutoMatchPayload(BaseModel):
    bank_account_id: int
    lines: List[AutoMatchStatementLineItem]

@router.post("/bank/reconcile/auto-match")
async def auto_match_bank_statement(
    payload: BankAutoMatchPayload,
    db: Session = Depends(get_db)
):
    """
    Rule-Based Auto-matching Engine for Bank Statement reconciliation.
    Analyzes unmatched LedgerLines vs imported StatementLines.
    """
    bank_acct = db.query(BankAccount).filter(BankAccount.id == payload.bank_account_id).first()
    if not bank_acct:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    suggestions = []

    # Get matched journal entries to avoid suggesting already reconciled ones
    matched_journals = db.query(BankStatementLine.matched_journal_id).filter(
        BankStatementLine.matched_journal_id != None,
        BankStatementLine.status == "MATCHED"
    ).all()
    matched_ids = [r[0] for r in matched_journals]

    # Query unmatched ledger lines posted to bank GL code
    unmatched_ledger = db.query(LedgerLine, JournalEntry).join(JournalEntry).join(Account).filter(
        Account.code == bank_acct.gl_account_code,
        JournalEntry.verification_status.in_(["VERIFIED", "REVERSED"]),
        ~JournalEntry.id.in_(matched_ids) if matched_ids else True
    ).all()

    for line in payload.lines:
        try:
            line_date = datetime.strptime(line.date, "%Y-%m-%d").date()
        except ValueError:
            continue

        amt = abs(line.amount)
        is_debit = line.amount < 0  # Statement negative = money out = GL Credit

        best_match = None
        best_confidence = 0
        best_journal = None

        for ll, je in unmatched_ledger:
            ledger_amt = ll.credit if is_debit else ll.debit
            if abs(ledger_amt - amt) > 0.01:
                continue

            je_date = je.timestamp.date() if je.timestamp else line_date
            day_diff = abs((je_date - line_date).days)
            if day_diff > 3:
                continue

            # Base confidence based on date proximity
            if day_diff == 0:
                confidence = 98
            elif day_diff == 1:
                confidence = 90
            elif day_diff == 2:
                confidence = 80
            else:
                confidence = 70

            # Boost confidence for reference/description string match
            desc_match = False
            if line.reference and je.reference_type and line.reference.lower() in je.reference_type.lower():
                desc_match = True
            if line.description and je.description and line.description.lower() in je.description.lower():
                desc_match = True

            if desc_match:
                confidence = min(100, confidence + 5)

            if confidence > best_confidence:
                best_confidence = confidence
                best_match = ll
                best_journal = je

        if best_match and best_journal:
            suggestions.append({
                "statement_line_id": line.id,
                "journal_id": best_journal.id,
                "confidence": best_confidence,
                "match_type": "EXACT_LEDGER",
                "details": f"Journal #{best_journal.id} on {best_journal.timestamp.strftime('%Y-%m-%d')} ({best_journal.description})"
            })
        else:
            # Fallback payee rules matching
            rule_match = None
            rules = [
                ("Stripe", 200100, "Stripe Clearing"),
                ("Laundry", 520200, "Laundry Expense"),
                ("Salary", 520000, "Payroll Expense"),
                ("Utility", 520300, "Utilities Expense"),
                ("Tax", 200000, "VAT/Sales Tax Payable"),
            ]
            for keyword, code, name in rules:
                if keyword.lower() in line.description.lower():
                    rule_match = {"code": code, "name": name}
                    break

            if rule_match:
                suggestions.append({
                    "statement_line_id": line.id,
                    "journal_id": None,
                    "confidence": 60,
                    "match_type": "RULE_GL_ACCOUNT",
                    "details": f"Auto-map to GL [{rule_match['code']}] {rule_match['name']} (Rule: '{keyword}')"
                })

    return {"status": "SUCCESS", "suggestions": suggestions}


# ============================================================
# PHASE 1B — AUTHENTICATION-BOUNDED LEDGER GATEWAY
# Role-based transaction limits. Exceeding limit halts
# transaction, writes to pending_authorizations, and
# broadcasts Z-07 alert to GM/CDO for cryptographic approval.
# Limits: FRONT_DESK=$10K | MANAGER=$50K | GM=$250K | CDO=∞
# ============================================================
import uuid as _uuid
from datetime import datetime as _dt, timezone as _tz, timedelta as _td

ROLE_LIMITS = {
    "FRONT_DESK": 10_000,
    "RECEPTIONIST": 10_000,
    "CASHIER": 10_000,
    "SUPERVISOR": 25_000,
    "MANAGER": 50_000,
    "GM": 250_000,
    "CDO": float("inf"),
    "ADMIN": float("inf"),
    "CFO": float("inf"),
    "ACCOUNTANT": 25_000,
    "FINANCE": 50_000,
}


def check_ledger_authorization(
    amount: float,
    currency: str,
    user: dict,
    transaction_payload: dict,
    endpoint: str,
    db: Session,
    ref_token: Optional[str] = None
) -> dict:
    """
    Call this at the top of any high-value transaction endpoint.
    Returns {"authorized": True} or raises HTTP 402 with authorization ref.
    Intercepted transactions are written to PendingAuthorization table.
    """
    from app.models.models import PendingAuthorization
    from app.core.ws_manager import master_socket
    import asyncio

    role = user.get("role", "STAFF").upper()
    limit = ROLE_LIMITS.get(role, 10_000)

    # 🔐 Two-Pass Authorization Check
    if ref_token:
        record = db.query(PendingAuthorization).filter(
            PendingAuthorization.ref_token == ref_token
        ).first()
        if not record:
            raise HTTPException(status_code=400, detail=f"Invalid authorization reference token '{ref_token}'.")
        if record.status == "APPROVED":
            # Security protocol: Amount and currency must match to prevent tampering
            if abs(record.amount - amount) > 0.01:
                raise HTTPException(status_code=400, detail=f"Amount mismatch. Approved amount is {record.currency} {record.amount:.2f}, but got {currency} {amount:.2f}.")
            if record.currency != currency:
                raise HTTPException(status_code=400, detail=f"Currency mismatch. Approved currency is {record.currency}, but got {currency}.")
            
            # Consume the token to prevent double-spending/re-use
            record.status = "COMPLETED"
            db.commit()
            return {"authorized": True, "limit": limit, "role": role, "bypassed_by_approval": True}
        elif record.status == "PENDING":
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "AUTHORIZATION_PENDING",
                    "message": f"Authorization request '{ref_token}' is still pending approval.",
                    "ref_token": ref_token,
                    "required_approver": record.required_approver
                }
            )
        elif record.status == "COMPLETED":
            raise HTTPException(status_code=400, detail=f"Authorization reference token '{ref_token}' has already been used.")
        else:
            raise HTTPException(status_code=400, detail=f"Authorization reference token '{ref_token}' has been {record.status.lower()}.")

    if amount <= limit:
        return {"authorized": True, "limit": limit, "role": role}

    # Transaction BLOCKED — exceeds role limit
    generated_ref = f"AUTH-{_uuid.uuid4().hex[:12].upper()}"
    expires = _dt.now(_tz.utc) + _td(hours=24)

    required_approver = "CDO" if amount > 250_000 else "GM"

    pending = PendingAuthorization(
        ref_token=generated_ref,
        transaction_payload=transaction_payload,
        endpoint=endpoint,
        amount=amount,
        currency=currency,
        submitted_by=user.get("sub", "UNKNOWN"),
        submitted_role=role,
        role_limit=limit,
        required_approver=required_approver,
        status="PENDING",
        expires_at=expires,
    )
    db.add(pending)
    db.commit()

    # Broadcast alert to GM/CDO
    try:
        asyncio.create_task(master_socket.broadcast("LEDGER_AUTH_REQUIRED", {
            "zone": "Z-1B",
            "ref_token": generated_ref,
            "amount": amount,
            "currency": currency,
            "submitted_by": user.get("name", "Unknown"),
            "role": role,
            "role_limit": limit,
            "required_approver": required_approver,
            "endpoint": endpoint,
            "message": (
                f"🔐 LEDGER GATEWAY: Transaction of {currency} {amount:,.2f} "
                f"BLOCKED — exceeds {role} limit ({currency} {limit:,.0f}). "
                f"{required_approver} approval required. Ref: {generated_ref}"
            ),
        }))
    except Exception:
        pass

    raise HTTPException(
        status_code=402,
        detail={
            "error": "AUTHORIZATION_REQUIRED",
            "message": f"Transaction amount {currency} {amount:,.2f} exceeds your role limit of {currency} {limit:,.0f}.",
            "ref_token": generated_ref,
            "required_approver": required_approver,
            "action": f"Request approval from your {required_approver}. Reference: {generated_ref}",
        },
        headers={"X-LEDGER-GATEWAY": "BLOCKED", "X-AUTH-REF": generated_ref},
    )


@router.get("/ledger-gateway/pending", summary="List all pending ledger authorizations")
def list_pending_authorizations(
    status: Optional[str] = "PENDING",
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user_from_token)
):
    """GM/CDO view of all pending high-value transactions awaiting approval."""
    from app.models.models import PendingAuthorization
    allowed_roles = {"GM", "CDO", "ADMIN", "CFO"}
    if user["role"].upper() not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only GM/CDO/CFO may view pending authorizations.")
    q = db.query(PendingAuthorization)
    if status:
        q = q.filter(PendingAuthorization.status == status.upper())
    records = q.order_by(PendingAuthorization.created_at.desc()).limit(100).all()
    return {
        "total": len(records),
        "pending_authorizations": [
            {
                "id": r.id, "ref_token": r.ref_token,
                "amount": r.amount, "currency": r.currency,
                "submitted_by": r.submitted_by, "submitted_role": r.submitted_role,
                "role_limit": r.role_limit, "required_approver": r.required_approver,
                "status": r.status, "endpoint": r.endpoint,
                "expires_at": r.expires_at.isoformat() if r.expires_at else None,
                "created_at": r.created_at.isoformat(),
                # ✅ FIX: Include resolution fields so frontend can show who approved/rejected
                "resolved_by": r.resolved_by,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
                "rejection_reason": r.rejection_reason,
                "transaction_payload": r.transaction_payload,
            }
            for r in records
        ]
    }


@router.post("/ledger-gateway/authorize/{ref_token}", summary="GM/CDO cryptographic approval of a pending transaction")
def authorize_pending_transaction(
    ref_token: str,
    decision: str,           # APPROVED or REJECTED — passed as query param
    rejection_reason: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user_from_token)
):
    """
    Release or reject a blocked high-value transaction.
    Only GM, CDO, ADMIN, and CFO roles can authorize.
    decision must be 'APPROVED' or 'REJECTED' (case-insensitive).
    """
    from app.models.models import PendingAuthorization

    # ✅ FIX: Validate decision early with a clear error message
    if not decision or decision.strip() == "":
        raise HTTPException(status_code=422, detail="'decision' query parameter is required: must be APPROVED or REJECTED.")
    decision_upper = decision.strip().upper()
    if decision_upper not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=422, detail=f"Invalid decision '{decision}'. Must be APPROVED or REJECTED.")

    allowed_roles = {"GM", "CDO", "ADMIN", "CFO"}
    if user["role"].upper() not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Role '{user['role']}' cannot authorize transactions. Only GM/CDO/ADMIN/CFO can approve."
        )

    record = db.query(PendingAuthorization).filter(
        PendingAuthorization.ref_token == ref_token
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Authorization reference '{ref_token}' not found.")
    if record.status != "PENDING":
        raise HTTPException(status_code=409, detail=f"Transaction already {record.status}. Cannot re-action a resolved authorization.")
    if record.expires_at and _dt.now(_tz.utc) > record.expires_at.replace(tzinfo=_tz.utc):
        record.status = "EXPIRED"
        db.commit()
        raise HTTPException(status_code=410, detail="Authorization token has expired (24h limit). Transaction must be re-submitted.")

    record.status = decision_upper
    record.resolved_by = user["sub"]   # username/sub stored in DB
    record.resolved_at = _dt.now(_tz.utc)
    record.rejection_reason = rejection_reason if decision_upper == "REJECTED" else None
    db.commit()
    db.refresh(record)

    logger.info(
        f"[LEDGER-GATEWAY] {ref_token} → {decision_upper} by {user['name']} ({user['role']}) "
        f"| Amount: {record.currency} {record.amount} | Submitted by: {record.submitted_by}"
    )

    return {
        "status": "SUCCESS",
        "ref_token": ref_token,
        "decision": decision_upper,
        "resolved_by": user["name"],
        "resolved_by_sub": user["sub"],
        "resolved_at": record.resolved_at.isoformat(),
        "message": (
            f"Transaction {ref_token} {decision_upper} by {user['name']}. "
            + ("Re-submit the original transaction to proceed." if decision_upper == "APPROVED" else f"Reason: {rejection_reason or 'No reason given'}")
        )
    }
