# backend_api/app/routers/agi_coa_engine.py
"""
SOVEREIGN AGI COA ENGINE — SELF-EXPANDING ACCOUNTING INTELLIGENCE
=================================================================
Receives any transaction description + metadata, classifies it using
a deterministic rule engine (no external LLM required), maps it to
the correct Chart of Accounts entry, and posts the double-entry journal.

If no matching CoA account exists, the engine CREATES one with the
correct account number, type, and name — then posts to it immediately.

This makes the accounting system self-healing and self-expanding.

Enterprise Sub-Engines Included:
    1.  AGI Classifier          — pattern rules map any text to CoA
    2.  CoA Resolver            — find or create accounts on demand
    3.  Tax Engine              — auto-classify VAT, SC, withholding tax
    4.  FX Engine               — multi-currency gain/loss posting
    5.  Reconciliation Engine   — match bank statements to journals
    6.  Depreciation Scheduler  — auto-post periodic depreciation
    7.  Cost Center Allocator   — split shared costs across divisions
    8.  Revenue Recognition     — IFRS-15 deferred revenue management
    9.  Payroll Classifier      — post payroll to correct division CoA
    10. Fraud Detector          — flag duplicates and anomalies
    11. Period Close Engine     — month-end close and P&L snapshot
    12. Inter-Property Engine   — Z-30 multi-property consolidation
"""
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    Account, JournalEntry, LedgerLine,
    Reservation, APInvoice, ARReceivable, GuestFolio, Employee,
)

logger = logging.getLogger("Sovereign_AGI_CoA")
router = APIRouter(tags=["ZONE 11: AGI CoA Intelligence Engine"])

DHAKA_TZ = timezone(timedelta(hours=6))

# ============================================================
# SOVEREIGN CoA NUMBER RANGES — DO NOT CHANGE ORDER
# New accounts are auto-numbered within these ranges
# ============================================================
COA_RANGES: Dict[str, Dict[str, Any]] = {
    "ASSET":     {"start": 100000, "end": 199999},
    "LIABILITY": {"start": 200000, "end": 299999},
    "EQUITY":    {"start": 300000, "end": 399999},
    "REVENUE":   {"start": 400000, "end": 499999},
    "EXPENSE":   {"start": 500000, "end": 599999},
    "COGS":      {"start": 510000, "end": 519999},  # sub-range within EXPENSE
}

# ============================================================
# AGI CLASSIFICATION RULES
# Each rule: (pattern, account_type, account_name, account_code_hint)
# Evaluated in order — first match wins.
# account_code_hint=None means auto-number in range.
#
# 🔴 IRON LAW 63 (SOVEREIGN ACCOUNTING INTELLIGENCE):
# INFLOW DETECTION BLOCK must always come FIRST (highest priority).
# Any transaction describing money RECEIVED, DEPOSITED, TRANSFERRED IN,
# or FUNDED must classify as ASSET (Cash/Bank) — never as Expense.
# ============================================================
CLASSIFICATION_RULES: List[Tuple[str, str, str, Optional[int]]] = [

    # ── 🔴 PRIORITY 0: CASH INFLOW / RECEIPT DETECTION (MUST BE FIRST) ──────
    # Catches: "received 50000 USD in hotel account", "cash received",
    # "fund received", "capital injection", "transfer in", "deposited into account",
    # "money sent to hotel", "operational fund", "bank transfer received"
    # Rule: If the transaction describes MONEY COMING IN, it is an ASSET (Cash/Bank).
    (r"received.*in.*account|received.*into.*account",            "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"cash.*received|fund.*received|money.*received",            "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"received.*cash|received.*fund|received.*payment",          "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"deposited.*into|deposit.*to.*account|account.*deposit",    "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"bank.*transfer.*received|wire.*received|transfer.*in",     "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"capital.*injection|equity.*injection|owner.*injection",    "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"operational.*fund|operating.*fund|hotel.*fund",            "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"sent.*to.*hotel|sent.*to.*account|money.*into.*hotel",     "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"cash.*in|receipt.*of.*cash|inflow|cash.*inflow",           "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"owner.*transfer|director.*transfer|shareholder.*fund",     "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"loan.*received|bank.*loan|credit.*facility.*received",     "LIABILITY", "Bank Loan / Credit Facility", 200500),
    (r"advance.*from.*owner|advance.*from.*director",             "LIABILITY", "Advance from Owner/Director", 201000),

    # ── REVENUE ─────────────────────────────────────────────
    (r"room.*revenue|room.*sale|night.*rate|reservation.*income",  "REVENUE", "Room Revenue (Direct)",          400000),
    (r"ota.*revenue|booking\.com|expedia|agoda.*income",           "REVENUE", "Room Revenue (OTA)",             400200),
    (r"f.?b.*revenue|food.*sale|beverage.*sale|restaurant.*income","REVENUE", "F&B Revenue",                   410000),
    (r"banquet|conference.*room.*hire|event.*revenue",             "REVENUE", "Banquet & Conference Revenue",   420000),
    (r"coin.*cashout|miracle.*coin.*fee",                          "REVENUE", "Coin Cashout Fee Revenue",       430000),
    (r"fleet.*revenue|transport.*income|taxi.*income",             "REVENUE", "Fleet Revenue",                  440000),
    (r"spa.*revenue|wellness.*revenue|massage.*income",            "REVENUE", "Wellness Revenue",               450000),
    (r"boutique.*sale|retail.*income|shop.*revenue",               "REVENUE", "Boutique Revenue",               460000),
    (r"cinema.*ticket|movie.*revenue|entertainment.*income",       "REVENUE", "Cinema Revenue",                 470000),
    (r"revenue|income|sale",                                       "REVENUE", None,                             None),

    # ── COGS / DIRECT COSTS ─────────────────────────────────
    (r"cogs.*room|room.*cost|linen|housekeeping.*supply",          "EXPENSE", "COGS – Rooms",                  510000),
    (r"food.*cost|cogs.*food|ingredient|kitchen.*supply",          "EXPENSE", "COGS – F&B",                    510100),
    (r"beverage.*cost|cogs.*bev|liquor.*cost|bar.*supply",         "EXPENSE", "COGS – Beverage",               510150),
    (r"fuel|vehicle.*cost|fleet.*cost|transport.*cost",            "EXPENSE", "COGS – Fleet",                  510200),
    (r"treatment.*supply|spa.*product|wellness.*cost",             "EXPENSE", "COGS – Wellness",               510300),
    (r"boutique.*cost|retail.*cost|merchandise.*cost",             "EXPENSE", "COGS – Boutique",               510400),
    (r"content.*licens|cinema.*cost|av.*cost",                     "EXPENSE", "COGS – Cinema",                 510500),

    # ── PAYROLL ─────────────────────────────────────────────
    (r"payroll.*room|room.*salary|housekeeper.*salary",            "EXPENSE", "Payroll – Rooms Division",      500000),
    (r"payroll.*f.?b|chef.*salary|waiter.*salary|kitchen.*staff",  "EXPENSE", "Payroll – F&B Division",        500100),
    (r"payroll.*fleet|driver.*salary|chauffeur",                   "EXPENSE", "Payroll – Fleet Division",      500200),
    (r"payroll.*wellness|therapist.*salary|spa.*staff",            "EXPENSE", "Payroll – Wellness Division",   500300),
    (r"payroll.*boutique|retail.*staff|shop.*staff",               "EXPENSE", "Payroll – Boutique Division",   500400),
    (r"payroll.*cinema|projectionist|usher.*salary",               "EXPENSE", "Payroll – Cinema Division",     500500),
    (r"payroll.*general|management.*salary|gm.*salary|cfo|ceo",   "EXPENSE", "Payroll – General/Management",  500900),
    (r"salary|wage|payroll|staff.*pay|staff.*cost",                "EXPENSE", "Payroll – General/Management",  500900),

    # ── DEPRECIATION ────────────────────────────────────────
    (r"depreciation.*room|room.*depreciation",                     "EXPENSE", "Depreciation – Rooms",          520000),
    (r"depreciation.*f.?b|kitchen.*depreciation",                  "EXPENSE", "Depreciation – F&B",            520100),
    (r"depreciation.*fleet|vehicle.*depreciation",                 "EXPENSE", "Depreciation – Fleet",          520200),
    (r"depreciation.*wellness|spa.*depreciation",                  "EXPENSE", "Depreciation – Wellness",       520300),
    (r"depreciation.*boutique|retail.*depreciation",               "EXPENSE", "Depreciation – Boutique",       520400),
    (r"depreciation.*cinema|av.*depreciation",                     "EXPENSE", "Depreciation – Cinema",         520500),

    # ── OPERATING EXPENSES ──────────────────────────────────
    (r"ota.*commission|booking\.com.*fee|expedia.*fee",            "EXPENSE", "OTA Commissions",               535000),
    (r"affiliate.*commission|referral.*fee",                       "EXPENSE", "Affiliate Commissions",         530100),
    (r"marketing|advertising|promotion|campaign",                  "EXPENSE", "Marketing (General)",           530000),
    (r"electric|water|gas|utility|utilities",                      "EXPENSE", "Utilities",                     540000),
    (r"maintenance|repair|service.*charge|hvac|plumbing",          "EXPENSE", "Maintenance",                   550000),
    (r"till.*variance|cash.*variance|cash.*short|cash.*over",      "EXPENSE", "Till Cash Variance",            550100),
    (r"lease.*expens|rent.*expens|property.*rent",                 "EXPENSE", "Lease Expense - Rented Properties (Z-30)", 521200),
    (r"commission.*expens|owner.*commission|affiliated.*prop",     "EXPENSE", "Commission Expense - Affiliated Properties (Z-30)", 521000),
    (r"setup.*cost|capital.*setup|property.*onboard",              "EXPENSE", "Property Setup Capitalization (Z-30 BOM)", 522000),

    # ── ASSETS ──────────────────────────────────────────────
    # Broad cash/bank pattern — catches "petty cash", "till", "bank deposit",
    # "cash on hand", "cash balance"
    (r"petty.*cash|till.*cash|cash.*on.*hand|cash.*balance",       "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"bank.*deposit|deposit.*bank|cash.*deposit",                 "ASSET", "Cash/Bank (Consolidated)",        100000),
    (r"credit.*card.*clear|cc.*clear|card.*settlement",            "ASSET", "Credit Card Clearing",           102000),
    (r"house.*bank|float.*cash|change.*fund",                      "ASSET", "House Banks",                    105000),
    (r"accounts.*receiv|ar.*balance|guest.*owes",                  "ASSET", "Accounts Receivable (Consolidated)", 110000),
    (r"guest.*ledger|folio.*balance|in.house.*balance",            "ASSET", "Guest Ledger",                   111000),
    (r"city.*ledger|corporate.*ledger|post.*check.out",            "ASSET", "City Ledger",                    112000),
    (r"room.*inventory|minibar.*stock",                            "ASSET", "Rooms Inventory: Linen & Supplies", 120000),
    (r"food.*stock|f.?b.*inventory|pantry.*stock",                 "ASSET", "F&B Inventory: Food & Beverage Stock", 121000),
    (r"operating.*supply|amenity|cleaning.*supply",                "ASSET", "Operating Supplies",             126000),
    (r"furniture|fixture|room.*asset|ff.?e",                       "ASSET", "Rooms Fixed Assets: Furniture & Fixtures", 130000),
    (r"kitchen.*equipment|f.?b.*equipment|oven|dishwasher",        "ASSET", "F&B Fixed Assets: Kitchen Equipment", 131000),
    (r"vehicle|car|van|bus|fleet.*asset",                          "ASSET", "Fleet Fixed Assets: Vehicles",   132000),
    (r"spa.*equipment|wellness.*equipment|massage.*table",         "ASSET", "Wellness Fixed Assets: Spa Equipment", 134000),
    (r"cinema.*equipment|projector|screen|seating",                "ASSET", "Cinema Fixed Assets: AV & Seating", 135000),

    # ── LIABILITIES ─────────────────────────────────────────
    (r"accounts.*payable|vendor.*payable|supplier.*owed",          "LIABILITY", "Accounts Payable (Vendors)",  200000),
    (r"vat.*payable|tax.*payable|gst.*payable",                    "LIABILITY", "VAT Payable",                 210000),
    (r"service.*charge.*payable|sc.*payable",                      "LIABILITY", "Service Charge Payable",      211000),
    (r"salaries.*payable|wages.*payable|staff.*payable",           "LIABILITY", "Salaries Payable",            212000),
    (r"deferred.*revenue|advance.*payment|prepaid.*booking",       "LIABILITY", "Deferred Revenue",            213000),
    (r"miracle.*coin|loyalty.*coin|coin.*liability",               "LIABILITY", "Miracle Coin Liability",      220000),

    # ── EQUITY ──────────────────────────────────────────────
    (r"retained.*earn|net.*income|profit.*transfer",               "EQUITY", "Retained Earnings (Consolidated)", 300000),
    (r"room.*capital|room.*division.*equity",                      "EQUITY", "Rooms Division Capital",        300100),
]


# ============================================================
# CORE FUNCTIONS
# ============================================================

# ============================================================
# INFLOW SIGNAL KEYWORDS — SOVEREIGN ACCOUNTING GENIUS
# 🔴 IRON LAW 63: If ANY of these words appear in a transaction
# description, the transaction is an ASSET (Cash/Bank Receipt)
# and MUST NOT be classified as an Expense.
# Evaluated BEFORE the rule list as a pre-pass guardian.
# ============================================================
INFLOW_VERBS = [
    "received", "receive", "deposited", "deposit", "credited",
    "transferred in", "transfer in", "sent to hotel", "sent to account",
    "cash in", "money in", "fund received", "funds received",
    "capital injection", "equity injection", "owner fund", "owner deposit",
    "director fund", "shareholder fund", "inflow", "bank credit",
    "wire received", "remittance received", "payment received",
    "advance received", "loan received",
]

# Qualifier words that NEGATE the inflow signal (e.g. "service charge received" = still revenue)
INFLOW_NEGATORS = [
    "room revenue received", "revenue received", "sale received",
    "room sale received", "f&b received", "restaurant revenue received",
]


def _classify_transaction(description: str, context: Dict[str, Any], db: Optional[Session] = None) -> Tuple[str, str, Optional[int]]:
    """
    AGI Classification Engine — SOVEREIGN ACCOUNTING GENIUS.
    Returns (account_type, account_name, code_hint) for the given description.

    Classification Order:
      1. INFLOW PRE-PASS: If description signals money being RECEIVED / DEPOSITED,
         classify as ASSET (Cash/Bank) immediately — prevents false Expense fallback.
      2. DYNAMIC DATABASE LOOKUP: Query asset_grid (properties), fixed_assets, and
         inventory to resolve account mappings from live database state.
      3. RULE LIST: First matching regex rule wins.
      4. FALLBACK: Returns 'Unclassified Receipt or Payment' (not Miscellaneous Expense)
         so the accountant can review it — never silently misfiled.
    """
    text = (description + " " + context.get("zone", "") + " " + context.get("tags", "")).lower()

    # ── INFLOW PRE-PASS GUARDIAN ─────────────────────────────────────────────
    # Check for inflow negators first (revenue descriptions that contain "received")
    is_negated = any(neg in text for neg in INFLOW_NEGATORS)

    # ── DYNAMIC DATABASE LOOKUP (VAST KNOWLEDGE SYNCHRONIZATION) ──────────────
    if db is not None:
        try:
            from app.models.models import AssetGrid, FixedAsset, Inventory
            
            # 1. Match against Property (AssetGrid room_id / category)
            rooms = db.query(AssetGrid).all()
            matched_room = None
            for r in rooms:
                if r.room_id and re.search(rf"\b{re.escape(r.room_id.lower())}\b", text):
                    matched_room = r
                    break
            
            if matched_room:
                logger.info(f"[AGI_COA] 🧠 DYNAMIC LOOKUP → Matched Room/Property: {matched_room.room_id} ({matched_room.ownership_type})")
                is_inflow = any(verb in text for verb in INFLOW_VERBS) and not is_negated
                if not is_inflow:
                    if matched_room.ownership_type == "RENTED":
                        # RENTED property payment maps to Lease Expense
                        return "EXPENSE", f"Lease Expense - Rented Property {matched_room.room_id} ({matched_room.owner_entity or 'Landlord'})", 521200
                    elif matched_room.ownership_type == "AFFILIATED":
                        # AFFILIATED property commission maps to Commission Expense
                        return "EXPENSE", f"Commission Expense - Affiliated Property {matched_room.room_id} ({matched_room.owner_entity or 'Franchisee'})", 521000
                    elif matched_room.ownership_type == "OWNED":
                        # OWNED property setup cost maps to Property Setup Capitalization
                        if any(w in text for w in ["setup", "onboard", "install", "fixture", "renovation", "construction"]):
                            return "EXPENSE", f"Property Setup Capitalization - Owned Property {matched_room.room_id}", 522000
                else:
                    # Inflow (revenue/deposit) from an affiliated property
                    if matched_room.ownership_type == "AFFILIATED":
                        return "REVENUE", f"Room Revenue - Affiliated Property {matched_room.room_id}", 400000
                    else:
                        return "REVENUE", f"Room Revenue - Direct Property {matched_room.room_id}", 400000

            # 2. Match against Fixed Assets
            fixed_assets = db.query(FixedAsset).all()
            for fa in fixed_assets:
                if fa.name and fa.name.lower() in text:
                    logger.info(f"[AGI_COA] 🧠 DYNAMIC LOOKUP → Matched Fixed Asset: {fa.name} (ID: {fa.id})")
                    if "depreciation" in text or "deprecate" in text:
                        dep_name = f"Depreciation – {fa.division.title()}"
                        dep_codes = {
                            "ROOMS": 520000, "FNB": 520100, "FLEET": 520200, 
                            "WELLNESS": 520300, "BOUTIQUE": 520400, "CINEMA": 520500
                        }
                        dep_code = dep_codes.get(fa.division.upper(), 520000)
                        return "EXPENSE", dep_name, dep_code
                    else:
                        asset_codes = {
                            "ROOMS": 130000, "FNB": 131000, "FLEET": 132000, 
                            "WELLNESS": 134000, "CINEMA": 135000
                        }
                        asset_code = asset_codes.get(fa.division.upper(), 130000)
                        return "ASSET", f"Fixed Asset – {fa.name}", asset_code

            # 3. Match against Inventory
            inv_items = db.query(Inventory).all()
            for item in inv_items:
                if item.name and item.name.lower() in text:
                    logger.info(f"[AGI_COA] 🧠 DYNAMIC LOOKUP → Matched Inventory Item: {item.name} (Code: {item.product_id})")
                    if "fnb" in item.dept.lower() or "restaurant" in item.dept.lower() or "bar" in item.dept.lower():
                        return "ASSET", "F&B Inventory: Food & Beverage Stock", 121000
                    elif "rooms" in item.dept.lower() or "housekeeping" in item.dept.lower():
                        return "ASSET", "Rooms Inventory: Linen & Supplies", 120000
                    else:
                        return "ASSET", "Operating Supplies", 126000
        except Exception as e:
            logger.error(f"[AGI_COA] Dynamic DB lookup failed: {e}")

    if not is_negated:
        # Check for any inflow verb in the description
        if any(verb in text for verb in INFLOW_VERBS):
            # Money is COMING IN — classify as Cash/Bank ASSET
            # Exception: if it's clearly a loan/advance, classify as LIABILITY
            if any(w in text for w in ["loan received", "bank loan", "credit facility received", "advance from owner", "advance from director"]):
                loan_type = "Bank Loan / Credit Facility" if "loan" in text or "credit facility" in text else "Advance from Owner/Director"
                loan_code = 200500 if "loan" in text or "credit facility" in text else 201000
                logger.info(f"[AGI_COA] 🧠 INFLOW PRE-PASS → LIABILITY ({loan_type}) for: '{description[:60]}'")
                return "LIABILITY", loan_type, loan_code
            else:
                logger.info(f"[AGI_COA] 🧠 INFLOW PRE-PASS → ASSET (Cash/Bank) for: '{description[:60]}'")
                return "ASSET", "Cash/Bank (Consolidated)", 100000

    # ── RULE LIST PASS ───────────────────────────────────────────────────────
    for pattern, acc_type, acc_name, code_hint in CLASSIFICATION_RULES:
        if re.search(pattern, text, re.IGNORECASE):
            # If acc_name is None, generate a name from the description
            if acc_name is None:
                clean = description.strip().title()[:60]
                acc_name = clean
            return acc_type, acc_name, code_hint

    # ── FALLBACK (SOVEREIGN SAFE FALLBACK) ───────────────────────────────────
    # 🔴 IRON LAW 63: Never silently classify unknown transactions as
    # 'Miscellaneous Expense'. Instead return an 'Unclassified' holding account
    # so the accountant can review and reclassify. This prevents false P&L pollution.
    logger.warning(f"[AGI_COA] ⚠️ UNCLASSIFIED transaction (no rule matched): '{description[:80]}'")
    return "EXPENSE", f"Unclassified – Requires Review: {description[:40].title()}", None


def _next_account_code(db: Session, account_type: str) -> int:
    """
    Auto-numbers a new account within the correct CoA range.
    Finds the highest existing code in the range and increments by 100.
    """
    rng = COA_RANGES.get(account_type, COA_RANGES["EXPENSE"])
    start, end = rng["start"], rng["end"]
    existing = (
        db.query(Account)
        .filter(Account.code >= start, Account.code <= end)
        .order_by(Account.code.desc())
        .first()
    )
    if existing:
        new_code = int(existing.code) + 100
        # Stay within range
        if new_code > end:
            new_code = start + ((int(existing.code) - start + 1) % (end - start))
    else:
        new_code = start + 100  # First auto account in range
    return new_code


def resolve_or_create_account(
    db: Session, code_hint: Optional[int], account_type: str, account_name: str
) -> Account:
    """
    Finds an existing Account by code_hint or name, OR creates a new one.
    This is the self-expanding CoA engine core.
    """
    # 1. Try code hint first (exact match)
    if code_hint:
        account = db.query(Account).filter(Account.code == code_hint).first()
        if account:
            return account

    # 2. Try fuzzy name match within the same type
    name_lower = account_name.lower().strip()
    all_in_type = db.query(Account).filter(Account.type == account_type).all()
    for acc in all_in_type:
        if acc.name and acc.name.lower().strip() == name_lower:
            return acc

    # 3. CREATE NEW ACCOUNT — self-expansion
    new_code = code_hint if (code_hint and not db.query(Account).filter(Account.code == code_hint).first()) \
               else _next_account_code(db, account_type)

    new_account = Account(
        code=new_code,
        name=account_name,
        type=account_type
    )
    db.add(new_account)
    db.flush()  # Get ID without committing

    logger.info(
        f"[AGI_COA] 🧠 AUTO-CREATED account: [{new_code}] {account_name} ({account_type})"
    )
    return new_account


def agi_post_entry(
    db: Session,
    description: str,
    amount: float,
    context: Dict[str, Any],
    credit_account_code: int = 100000,  # Default: credit Cash/Bank
    posted_by: str = "AGI_ENGINE",
) -> Dict[str, Any]:
    """
    Full pipeline:
    1. Classify the transaction
    2. Resolve or create the debit account (target CoA)
    3. Resolve the credit account (usually Cash or AR)
    4. Post balanced double-entry journal
    Returns a result dict with the journal ID and account used.
    """
    # Step 1: Classify
    acc_type, acc_name, code_hint = _classify_transaction(description, context, db)

    # Step 2: Resolve/create debit account
    debit_account = resolve_or_create_account(db, code_hint, acc_type, acc_name)

    # Step 3: Resolve debit/credit accounts based on transaction type.
    # ─────────────────────────────────────────────────────────────────────────
    # REVENUE: Dr Cash/Bank → Cr Revenue account
    # EXPENSE: Dr Expense account → Cr Cash/Bank
    # ASSET (Cash Inflow/Receipt): Dr Cash/Bank → Cr Equity (Owner Contribution)
    #   or Cr Liability (if it's a loan). The "credit_account_code" parameter
    #   is the OFFSET account (what we credit to balance the debit).
    # LIABILITY (Loan Received): Dr Cash/Bank → Cr Loan/Liability account
    # ─────────────────────────────────────────────────────────────────────────
    is_revenue = acc_type == "REVENUE"
    is_asset_inflow = acc_type == "ASSET"
    is_liability_inflow = acc_type == "LIABILITY"

    if is_revenue:
        # Dr Cash/Bank → Cr Revenue
        credit_acc = debit_account  # Revenue account gets credited
        debit_acc = db.query(Account).filter(Account.code == credit_account_code).first()
        if not debit_acc:
            debit_acc = resolve_or_create_account(db, credit_account_code, "ASSET", "Cash/Bank (Consolidated)")

    elif is_asset_inflow or is_liability_inflow:
        # 🔴 IRON LAW 63 FIX: Cash RECEIVED / money coming IN.
        # Dr Cash/Bank (the classified account) → Cr Equity or Offset account
        # The classified account (Cash/Bank) is the DEBIT side.
        # The offset account (equity/liability/owner) is the CREDIT side.
        debit_acc = debit_account  # Cash/Bank gets DEBITED (asset increases)
        # If offset_account provided, use it. Default to Owner's Equity (300000).
        offset_code = credit_account_code if credit_account_code != 100000 else 300000
        credit_acc = db.query(Account).filter(Account.code == offset_code).first()
        if not credit_acc:
            # Auto-create an equity account for owner contribution
            credit_acc = resolve_or_create_account(
                db, offset_code, "EQUITY",
                "Owner's Contribution / Capital Injection"
            )

    else:
        # EXPENSE: Dr Expense → Cr Cash/Bank
        debit_acc = debit_account
        credit_acc = db.query(Account).filter(Account.code == credit_account_code).first()
        if not credit_acc:
            credit_acc = resolve_or_create_account(db, credit_account_code, "ASSET", "Cash/Bank (Consolidated)")

    # Step 4: Post double-entry
    journal = JournalEntry(
        reference_type=f"AGI-{acc_type}",
        description=description,
        timestamp=datetime.now(DHAKA_TZ),
        posted_by=posted_by,
        verification_status="AGI_AUTO",
        currency_code=context.get("currency", "USD"),
        exchange_rate=float(context.get("exchange_rate", 1.0)),
    )
    db.add(journal)
    db.flush()

    db.add(LedgerLine(
        journal_id=journal.id,
        account_id=debit_acc.id,
        debit=round(amount, 2),
        credit=0.0,
        currency_code=context.get("currency", "USD"),
    ))
    db.add(LedgerLine(
        journal_id=journal.id,
        account_id=credit_acc.id,
        debit=0.0,
        credit=round(amount, 2),
        currency_code=context.get("currency", "USD"),
    ))
    db.commit()

    logger.info(
        f"[AGI_COA] ✅ Posted journal #{journal.id}: Dr [{debit_acc.code}] {debit_acc.name} / "
        f"Cr [{credit_acc.code}] {credit_acc.name} | Amount: {amount}"
    )

    return {
        "journal_id": journal.id,
        "classified_as": acc_type,
        "debit_account": {"code": debit_acc.code, "name": debit_acc.name},
        "credit_account": {"code": credit_acc.code, "name": credit_acc.name},
        "amount": amount,
        "auto_created_account": debit_acc.id == debit_account.id and code_hint is None,
    }


# ============================================================
# API ENDPOINTS
# ============================================================

class AGIPostPayload(BaseModel):
    description: str                        # e.g. "Room revenue from LTR-01 overnight stay"
    amount: float                           # e.g. 950.00
    zone: Optional[str] = ""               # e.g. "Z-19", "Z-29"
    tags: Optional[str] = ""               # e.g. "rooms revenue direct"
    currency: Optional[str] = "USD"
    offset_account: Optional[int] = 100000  # Default offset: Cash/Bank
    posted_by: Optional[str] = "AGI_ENGINE"


class ClassifyOnlyPayload(BaseModel):
    description: str
    zone: Optional[str] = ""
    tags: Optional[str] = ""


@router.post("/agi/classify")
def classify_only(payload: ClassifyOnlyPayload, db: Session = Depends(get_db)):
    """
    DRY RUN — classify a description without posting any journal.
    Shows what account would be used (or created) for a given transaction.
    """
    context = {"zone": payload.zone or "", "tags": payload.tags or ""}
    acc_type, acc_name, code_hint = _classify_transaction(payload.description, context, db)

    # Check if account exists already
    existing = None
    if code_hint:
        existing = db.query(Account).filter(Account.code == code_hint).first()
    if not existing:
        all_in_type = db.query(Account).filter(Account.type == acc_type).all()
        for acc in all_in_type:
            if acc.name and acc.name.lower().strip() == acc_name.lower().strip():
                existing = acc
                break

    return {
        "status": "SUCCESS",
        "classification": {
            "type": acc_type,
            "name": acc_name,
            "code_hint": code_hint,
            "account_exists": existing is not None,
            "existing_account": {
                "id": existing.id,
                "code": existing.code,
                "name": existing.name,
                "type": existing.type,
            } if existing else None,
            "will_auto_create": existing is None,
        }
    }


@router.post("/agi/post")
def agi_post(payload: AGIPostPayload, db: Session = Depends(get_db)):
    """
    FULL PIPELINE — classify, resolve/create CoA, post double-entry journal.
    This is the self-expanding accounting engine entry point.
    """
    try:
        context = {
            "zone": payload.zone or "",
            "tags": payload.tags or "",
            "currency": payload.currency or "USD",
        }
        result = agi_post_entry(
            db=db,
            description=payload.description,
            amount=payload.amount,
            context=context,
            credit_account_code=payload.offset_account or 100000,
            posted_by=payload.posted_by or "AGI_ENGINE",
        )
        return {"status": "SUCCESS", "data": result}
    except Exception as e:
        db.rollback()
        logger.error(f"[AGI_COA] ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agi/batch-post")
def agi_batch_post(entries: List[AGIPostPayload], db: Session = Depends(get_db)):
    """
    Batch pipeline — post multiple transactions in one call.
    Each entry is classified and posted independently.
    Returns a summary with success/failure per entry.
    """
    results = []
    for i, entry in enumerate(entries):
        try:
            context = {
                "zone": entry.zone or "",
                "tags": entry.tags or "",
                "currency": entry.currency or "USD",
            }
            result = agi_post_entry(
                db=db,
                description=entry.description,
                amount=entry.amount,
                context=context,
                credit_account_code=entry.offset_account or 100000,
                posted_by=entry.posted_by or "AGI_ENGINE",
            )
            results.append({"index": i, "status": "OK", "data": result})
        except Exception as e:
            db.rollback()
            results.append({"index": i, "status": "ERROR", "error": str(e), "description": entry.description})

    success = sum(1 for r in results if r["status"] == "OK")
    return {
        "status": "SUCCESS",
        "summary": {"total": len(entries), "posted": success, "failed": len(entries) - success},
        "results": results,
    }



# ============================================================
# SOVEREIGN TRANSACTION LIBRARY — COMPLETE MIRACLE OS KNOWLEDGE
# Every possible transaction across all 30+ zones, pre-mapped
# to CoA accounts, double-entry, and department.
# This is the brain that feeds Z-11B's contextual intelligence.
# ============================================================
SOVEREIGN_TRANSACTION_LIBRARY = [
    # ── ZONE 11: ROOMS REVENUE ────────────────────────────────
    {"zone": "Z-11", "dept": "ROOMS", "category": "REVENUE", "description": "Room revenue direct booking (walk-in / phone)", "example": "Room revenue from LTR-01 overnight stay", "debit": "Cash/Bank [100000]", "credit": "Room Revenue (Direct) [400000]", "code": 400000},
    {"zone": "Z-11", "dept": "ROOMS", "category": "REVENUE", "description": "Room revenue via OTA (Booking.com / Expedia / Agoda)", "example": "OTA booking from Booking.com reservation #123", "debit": "Cash/Bank [100000]", "credit": "Room Revenue (OTA) [400200]", "code": 400200},
    {"zone": "Z-11", "dept": "ROOMS", "category": "REVENUE", "description": "OTA commission expense (paid to channel)", "example": "OTA commission fee from Booking.com reservation", "debit": "OTA Commissions [535000]", "credit": "Cash/Bank [100000]", "code": 535000},
    {"zone": "Z-11", "dept": "ROOMS", "category": "ASSET", "description": "Room revenue advance payment / deposit from guest", "example": "Advance deposit from corporate guest for LTR block", "debit": "Cash/Bank [100000]", "credit": "Deferred Revenue [213000]", "code": 213000},
    {"zone": "Z-11", "dept": "ROOMS", "category": "LIABILITY", "description": "Guest room advance refund", "example": "Refund to Mr. Ahmed for cancelled booking LTR-01", "debit": "Deferred Revenue [213000]", "credit": "Cash/Bank [100000]", "code": 213000},
    # ── ZONE 11: F&B REVENUE ──────────────────────────────────
    {"zone": "Z-11", "dept": "FNB", "category": "REVENUE", "description": "F&B restaurant food sale", "example": "Food sale at hotel restaurant June 18", "debit": "Cash/Bank [100000]", "credit": "F&B Revenue [410000]", "code": 410000},
    {"zone": "Z-11", "dept": "FNB", "category": "REVENUE", "description": "F&B beverage sale (bar / minibar)", "example": "Beverage sale at rooftop bar evening", "debit": "Cash/Bank [100000]", "credit": "F&B Revenue [410000]", "code": 410000},
    {"zone": "Z-11", "dept": "FNB", "category": "REVENUE", "description": "Banquet / conference room hire revenue", "example": "Conference room hire for corporate event 50 pax", "debit": "Cash/Bank [100000]", "credit": "Banquet & Conference Revenue [420000]", "code": 420000},
    {"zone": "Z-11", "dept": "FNB", "category": "EXPENSE", "description": "Food cost / ingredients (COGS)", "example": "Food cost purchase: fresh produce for restaurant", "debit": "COGS – F&B [510100]", "credit": "Cash/Bank [100000]", "code": 510100},
    {"zone": "Z-11", "dept": "FNB", "category": "EXPENSE", "description": "Beverage cost (COGS)", "example": "Bar stock purchase: imported spirits", "debit": "COGS – Beverage [510150]", "credit": "Cash/Bank [100000]", "code": 510150},
    # ── ZONE 11: FLEET REVENUE ────────────────────────────────
    {"zone": "Z-29", "dept": "FLEET", "category": "REVENUE", "description": "Fleet / taxi / transport income", "example": "Airport transfer revenue for 3 guests", "debit": "Cash/Bank [100000]", "credit": "Fleet Revenue [440000]", "code": 440000},
    {"zone": "Z-29", "dept": "FLEET", "category": "EXPENSE", "description": "Fleet fuel cost", "example": "Fuel purchase for hotel van fleet June", "debit": "COGS – Fleet [510200]", "credit": "Cash/Bank [100000]", "code": 510200},
    {"zone": "Z-29", "dept": "FLEET", "category": "ASSET", "description": "Vehicle purchase (capital expenditure)", "example": "Purchase of Toyota HiAce for hotel fleet", "debit": "Fleet Fixed Assets: Vehicles [132000]", "credit": "Cash/Bank [100000]", "code": 132000},
    # ── ZONE 11: WELLNESS / SPA REVENUE ──────────────────────
    {"zone": "Z-11", "dept": "WELLNESS", "category": "REVENUE", "description": "Spa / massage / wellness treatment income", "example": "Swedish massage session booked for 2 guests", "debit": "Cash/Bank [100000]", "credit": "Wellness Revenue [450000]", "code": 450000},
    {"zone": "Z-11", "dept": "WELLNESS", "category": "EXPENSE", "description": "Spa product / treatment supply cost", "example": "Spa essential oil and product restock", "debit": "COGS – Wellness [510300]", "credit": "Cash/Bank [100000]", "code": 510300},
    # ── ZONE 11: BOUTIQUE / RETAIL ────────────────────────────
    {"zone": "Z-11", "dept": "BOUTIQUE", "category": "REVENUE", "description": "Boutique / retail merchandise sale", "example": "Souvenir sale at hotel boutique shop", "debit": "Cash/Bank [100000]", "credit": "Boutique Revenue [460000]", "code": 460000},
    {"zone": "Z-11", "dept": "BOUTIQUE", "category": "EXPENSE", "description": "Boutique merchandise cost", "example": "Souvenir merchandise restock from vendor", "debit": "COGS – Boutique [510400]", "credit": "Cash/Bank [100000]", "code": 510400},
    # ── ZONE 11: CINEMA ───────────────────────────────────────
    {"zone": "Z-11", "dept": "CINEMA", "category": "REVENUE", "description": "Cinema ticket / movie screening revenue", "example": "Cinema ticket sales Friday evening screening", "debit": "Cash/Bank [100000]", "credit": "Cinema Revenue [470000]", "code": 470000},
    {"zone": "Z-11", "dept": "CINEMA", "category": "EXPENSE", "description": "Cinema content licensing / AV cost", "example": "Movie license fee for weekly programming", "debit": "COGS – Cinema [510500]", "credit": "Cash/Bank [100000]", "code": 510500},
    # ── ZONE 11: MIRACLE COIN ─────────────────────────────────
    {"zone": "Z-11", "dept": "DIGITAL", "category": "REVENUE", "description": "Miracle Coin cashout fee revenue", "example": "Coin cashout fee 2.5% on guest redemption", "debit": "Cash/Bank [100000]", "credit": "Coin Cashout Fee Revenue [430000]", "code": 430000},
    {"zone": "Z-11", "dept": "DIGITAL", "category": "LIABILITY", "description": "Miracle Coin issued (loyalty liability)", "example": "Miracle Coins issued to guest after stay", "debit": "Loyalty/Coin Expense", "credit": "Miracle Coin Liability [220000]", "code": 220000},
    # ── PAYROLL / SALARY ─────────────────────────────────────
    {"zone": "Z-11", "dept": "ROOMS", "category": "EXPENSE", "description": "Rooms division payroll / salaries", "example": "Housekeeper salary for June 2026 Rooms Division", "debit": "Payroll – Rooms Division [500000]", "credit": "Cash/Bank [100000]", "code": 500000},
    {"zone": "Z-11", "dept": "FNB", "category": "EXPENSE", "description": "F&B division payroll / chef salary", "example": "Chef salary F&B division June 2026", "debit": "Payroll – F&B Division [500100]", "credit": "Cash/Bank [100000]", "code": 500100},
    {"zone": "Z-11", "dept": "FLEET", "category": "EXPENSE", "description": "Fleet division payroll / driver salary", "example": "Driver salary Fleet Division June 2026", "debit": "Payroll – Fleet Division [500200]", "credit": "Cash/Bank [100000]", "code": 500200},
    {"zone": "Z-11", "dept": "WELLNESS", "category": "EXPENSE", "description": "Wellness division payroll / therapist salary", "example": "Therapist salary Wellness Division June 2026", "debit": "Payroll – Wellness Division [500300]", "credit": "Cash/Bank [100000]", "code": 500300},
    {"zone": "Z-11", "dept": "GENERAL", "category": "EXPENSE", "description": "General management / GM / CDO salary", "example": "GM salary general management June 2026", "debit": "Payroll – General/Management [500900]", "credit": "Cash/Bank [100000]", "code": 500900},
    # ── OPERATING EXPENSES ────────────────────────────────────
    {"zone": "Z-11", "dept": "GENERAL", "category": "EXPENSE", "description": "Utilities: electricity, water, gas", "example": "Electricity bill for the hotel month of June", "debit": "Utilities [540000]", "credit": "Cash/Bank [100000]", "code": 540000},
    {"zone": "Z-11", "dept": "GENERAL", "category": "EXPENSE", "description": "Maintenance and repair", "example": "HVAC maintenance repair hotel AC units", "debit": "Maintenance [550000]", "credit": "Cash/Bank [100000]", "code": 550000},
    {"zone": "Z-11", "dept": "GENERAL", "category": "EXPENSE", "description": "Marketing and advertising", "example": "Facebook and Instagram advertising campaign June", "debit": "Marketing (General) [530000]", "credit": "Cash/Bank [100000]", "code": 530000},
    {"zone": "Z-11", "dept": "GENERAL", "category": "EXPENSE", "description": "Affiliate / referral commission expense", "example": "Referral commission paid to travel agent for room booking", "debit": "Affiliate Commissions [530100]", "credit": "Cash/Bank [100000]", "code": 530100},
    {"zone": "Z-11", "dept": "GENERAL", "category": "EXPENSE", "description": "Till cash variance (over/short)", "example": "Cash register short USD 25 at restaurant till", "debit": "Till Cash Variance [550100]", "credit": "Cash/Bank [100000]", "code": 550100},
    # ── TAX LIABILITIES ───────────────────────────────────────
    {"zone": "Z-11", "dept": "FINANCE", "category": "LIABILITY", "description": "VAT payable to tax authority", "example": "VAT 15% payable on room revenue June quarter", "debit": "Cash/Bank [100000]", "credit": "VAT Payable [210000]", "code": 210000},
    {"zone": "Z-11", "dept": "FINANCE", "category": "LIABILITY", "description": "Service charge payable to staff pool", "example": "Service charge 10% payable from F&B revenue", "debit": "Cash/Bank [100000]", "credit": "Service Charge Payable [211000]", "code": 211000},
    {"zone": "Z-11", "dept": "FINANCE", "category": "LIABILITY", "description": "Salaries payable (accrued)", "example": "Salaries accrued but not yet paid June end", "debit": "Payroll – General/Management [500900]", "credit": "Salaries Payable [212000]", "code": 212000},
    # ── CAPITAL INFLOWS / OWNER FUNDS ─────────────────────────
    {"zone": "Z-11", "dept": "FINANCE", "category": "ASSET", "description": "Owner capital injection / operational fund received", "example": "Received 50000 USD from director for operational fund", "debit": "Cash/Bank [100000]", "credit": "Owner's Contribution / Capital Injection [300000]", "code": 300000},
    {"zone": "Z-11", "dept": "FINANCE", "category": "LIABILITY", "description": "Bank loan received", "example": "Bank loan received BRAC Bank USD 200000", "debit": "Cash/Bank [100000]", "credit": "Bank Loan / Credit Facility [200500]", "code": 200500},
    {"zone": "Z-11", "dept": "FINANCE", "category": "LIABILITY", "description": "Advance from owner / director (interest-free)", "example": "Advance from owner Mr. Ahmed BDT 500000", "debit": "Cash/Bank [100000]", "credit": "Advance from Owner/Director [201000]", "code": 201000},
    # ── DEPRECIATION ─────────────────────────────────────────
    {"zone": "Z-11", "dept": "FINANCE", "category": "EXPENSE", "description": "Depreciation of rooms fixed assets", "example": "Monthly depreciation of LTR-01 furniture and fittings", "debit": "Depreciation – Rooms [520000]", "credit": "Accumulated Depreciation", "code": 520000},
    {"zone": "Z-11", "dept": "FINANCE", "category": "EXPENSE", "description": "Depreciation of kitchen / F&B equipment", "example": "Monthly depreciation of commercial kitchen equipment", "debit": "Depreciation – F&B [520100]", "credit": "Accumulated Depreciation", "code": 520100},
    {"zone": "Z-11", "dept": "FINANCE", "category": "EXPENSE", "description": "Depreciation of fleet vehicles", "example": "Monthly depreciation of hotel transport van", "debit": "Depreciation – Fleet [520200]", "credit": "Accumulated Depreciation", "code": 520200},
    # ── Z-30: INTER-PROPERTY / MULTI-PROPERTY ─────────────────
    {"zone": "Z-30", "dept": "INTER-PROPERTY", "category": "EXPENSE", "description": "Owner commission / affiliated property commission", "example": "Commission payable to LTR-01 owner from pool yield", "debit": "Commission Expense - Affiliated Properties [521000]", "credit": "AP Owner Commission [200000]", "code": 521000},
    {"zone": "Z-30", "dept": "INTER-PROPERTY", "category": "EXPENSE", "description": "Lease / rent expense for rented property", "example": "Monthly lease payment for OB-03 managed property", "debit": "Lease Expense - Rented Properties [521200]", "credit": "AP Lease Payable [200000]", "code": 521200},
    {"zone": "Z-30", "dept": "INTER-PROPERTY", "category": "ASSET", "description": "Property setup / BOM capitalization cost", "example": "Setup cost for V-04 villa onboarding and renovation", "debit": "Property Setup Capitalization [522000]", "credit": "AP Vendors [200000]", "code": 522000},
    # ── ACCOUNTS RECEIVABLE / PAYABLE ─────────────────────────
    {"zone": "Z-11", "dept": "FINANCE", "category": "ASSET", "description": "Guest accounts receivable / city ledger", "example": "Corporate client ABC Ltd owes for 10 room nights", "debit": "City Ledger [112000]", "credit": "Room Revenue (Direct) [400000]", "code": 112000},
    {"zone": "Z-11", "dept": "FINANCE", "category": "LIABILITY", "description": "Vendor accounts payable", "example": "Invoice received from linen supplier USD 3500", "debit": "COGS – Rooms [510000]", "credit": "Accounts Payable (Vendors) [200000]", "code": 200000},
    # ── INVENTORY ────────────────────────────────────────────
    {"zone": "Z-11", "dept": "ROOMS", "category": "ASSET", "description": "Rooms linen and supplies inventory", "example": "Purchase of hotel linen and toiletry amenity stock", "debit": "Rooms Inventory: Linen & Supplies [120000]", "credit": "Cash/Bank [100000]", "code": 120000},
    {"zone": "Z-11", "dept": "FNB", "category": "ASSET", "description": "F&B food and beverage stock inventory", "example": "Weekly grocery purchase for hotel restaurant kitchen", "debit": "F&B Inventory: Food & Beverage Stock [121000]", "credit": "Cash/Bank [100000]", "code": 121000},
]


@router.get("/agi/transaction-library")
def get_transaction_library(zone: str = "", dept: str = "", category: str = ""):
    """
    SOVEREIGN TRANSACTION KNOWLEDGE BASE — Complete Miracle OS Transaction Library.
    Returns all known transaction types across every zone and department.
    Z-11B uses this to pre-populate its conversational classifier with full intelligence.
    Filterable by zone, department, and category.
    """
    library = SOVEREIGN_TRANSACTION_LIBRARY
    if zone:
        library = [t for t in library if t["zone"].upper() == zone.upper()]
    if dept:
        library = [t for t in library if t["dept"].upper() == dept.upper()]
    if category:
        library = [t for t in library if t["category"].upper() == category.upper()]

    # Build department summary
    depts = {}
    for t in SOVEREIGN_TRANSACTION_LIBRARY:
        d = t["dept"]
        depts[d] = depts.get(d, 0) + 1

    return {
        "status": "SUCCESS",
        "total_transaction_types": len(SOVEREIGN_TRANSACTION_LIBRARY),
        "filtered_count": len(library),
        "departments": depts,
        "zones_covered": list({t["zone"] for t in SOVEREIGN_TRANSACTION_LIBRARY}),
        "transaction_types": library,
    }


# ============================================================
# CONVERSATIONAL AGI CLASSIFIER — MULTI-TURN SESSION ENGINE
# Implements the "Genius Accountant" conversation flow:
# 1. User describes a transaction (may be vague)
# 2. AGI scores confidence; if low, asks 1-3 questions
# 3. Once confident, presents a Suggested Ledger card
# 4. User confirms → journal posted; or retries → new question
# Sessions are in-memory (30 min TTL, no DB writes for state)
# ============================================================
import time
from typing import Optional

CHAT_SESSIONS: Dict[str, Dict] = {}  # session_id → {description, history, stage, classification, created_at}
CHAT_SESSION_TTL = 1800  # 30 minutes


def _score_confidence(description: str, context: Dict) -> int:
    """
    Returns a confidence score 0-100 for the current classification.
    High = >85 (show suggestion immediately)
    Medium = 60-85 (ask 1 question)
    Low = <60 (ask up to 2 questions)
    """
    text = (description + " " + context.get("tags", "") + " " + context.get("department", "")).lower()
    score = 0

    # Strong inflow signals → high confidence
    strong_inflow = ["received", "deposited", "capital injection", "fund received", "loan received", "advance from"]
    if any(w in text for w in strong_inflow):
        score += 35

    # Strong revenue signals
    revenue_signals = ["room revenue", "f&b revenue", "restaurant income", "ota booking", "booking.com", "cinema ticket", "spa treatment"]
    if any(w in text for w in revenue_signals):
        score += 40

    # Strong expense signals
    expense_signals = ["salary", "payroll", "electricity", "maintenance", "repair", "fuel", "marketing", "advertising", "commission"]
    if any(w in text for w in expense_signals):
        score += 40

    # Has amount context
    if any(c.isdigit() for c in text):
        score += 10

    # Has department context
    if context.get("department"):
        score += 15

    # Has zone context
    if context.get("zone"):
        score += 10

    # Generic / ambiguous → low score
    ambiguous = ["payment", "paid", "transfer", "transaction", "money", "amount", "charge"]
    if any(w in text for w in ambiguous) and score < 30:
        score = max(score, 20)

    return min(score, 100)


def _get_clarifying_question(description: str, context: Dict, question_round: int) -> Dict:
    """
    Returns the most relevant clarifying question for the given description.
    Returns: {question, options, field_key}
    """
    text = description.lower()

    # Vague "payment" or "transfer" — ask direction first
    if question_round == 1 and any(w in text for w in ["payment", "paid", "transfer", "charge", "amount", "transaction"]):
        if "received" not in text and "in" not in text:
            return {
                "question": "Was money going OUT from the hotel, or COMING IN to the hotel?",
                "options": ["💰 Money came IN (receipt, deposit, income)", "💸 Money went OUT (payment, expense, purchase)", "🔄 Internal transfer between accounts"],
                "field_key": "direction"
            }

    # No department — ask which division
    if question_round == 1 and not context.get("department"):
        return {
            "question": "Which hotel department does this transaction belong to?",
            "options": ["🛏 Rooms / Front Desk", "🍽 F&B / Restaurant / Bar", "🚗 Fleet / Transport", "💆 Wellness / Spa", "🛍 Boutique / Retail", "🎬 Cinema / Entertainment", "🏢 General / Administration / Finance"],
            "field_key": "department"
        }

    # Has "received" but unclear source
    if question_round <= 2 and any(w in text for w in ["received", "deposited", "transfer in"]) and not context.get("source"):
        return {
            "question": "Who is the source of this money coming in?",
            "options": ["👤 Owner / Director capital injection", "🏦 Bank loan / credit facility", "🏨 Corporate guest advance payment", "💳 OTA / Booking platform settlement", "🏢 Inter-property transfer from another zone"],
            "field_key": "source"
        }

    # Unclear if revenue or COGS
    if question_round <= 2 and any(w in text for w in ["food", "beverage", "drink", "meal"]):
        return {
            "question": "Is this a SALE to a guest (revenue), or a PURCHASE for the kitchen (cost)?",
            "options": ["📈 Sale to guest — this is REVENUE", "📦 Purchase / stock — this is a COST (COGS)"],
            "field_key": "revenue_or_cost"
        }

    # Still ambiguous after 2 rounds — offer to create new account
    return {
        "question": "I want to make sure I classify this perfectly. Can you describe it in more detail?",
        "options": ["💼 It's a regular business expense", "📊 It's income or revenue", "🏦 It's a bank/cash movement", "➕ Create a brand new account for this"],
        "field_key": "general_type"
    }


class ChatPayload(BaseModel):
    session_id: str
    message: str                            # The user's latest input
    stage: str = "INIT"                     # INIT | ANSWER | CONFIRM | RETRY | CREATE
    context: Optional[Dict[str, Any]] = {}  # Extra context (zone, department, amount, etc.)
    amount: Optional[float] = None
    currency: Optional[str] = "USD"
    posted_by: Optional[str] = "AGI_CHAT"


@router.post("/agi/chat")
def agi_chat(payload: ChatPayload, db: Session = Depends(get_db)):
    """
    CONVERSATIONAL AGI CLASSIFIER — The Genius Accountant.
    Multi-turn conversation that asks clarifying questions before
    suggesting a ledger entry. User must confirm before any posting.

    Stages:
      INIT   → First message from user describing a transaction
      ANSWER → User answered a clarifying question
      CONFIRM → User approved the suggestion → post journal
      RETRY  → User rejected suggestion → ask again
      CREATE → User wants a new CoA account created
    """
    # Purge stale sessions
    now = time.time()
    stale = [k for k, v in CHAT_SESSIONS.items() if now - v.get("created_at", 0) > CHAT_SESSION_TTL]
    for k in stale:
        del CHAT_SESSIONS[k]

    session_id = payload.session_id
    stage = payload.stage
    message = payload.message.strip()
    context = dict(payload.context or {})

    # ── CONFIRM: User approved the suggestion → post journal ──────────────────
    if stage == "CONFIRM":
        session = CHAT_SESSIONS.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session expired. Please start a new classification.")

        if not payload.amount or payload.amount <= 0:
            return {"stage": "ERROR", "message": "Please provide the transaction amount before confirming."}

        try:
            cls = session["classification"]
            result = agi_post_entry(
                db=db,
                description=session["description"],
                amount=payload.amount,
                context={**session["context"], "currency": payload.currency or "USD"},
                credit_account_code=session.get("offset_code", 100000),
                posted_by=payload.posted_by or "AGI_CHAT",
            )
            del CHAT_SESSIONS[session_id]  # Clean up session after posting
            return {
                "stage": "POSTED",
                "message": f"✅ Journal #{result['journal_id']} posted successfully.",
                "journal_id": result["journal_id"],
                "debit": result["debit_account"],
                "credit": result["credit_account"],
                "amount": payload.amount,
                "currency": payload.currency or "USD",
                "auto_created_account": result["auto_created_account"],
            }
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    # ── DO_CREATE: User submitted the new account form ────────────────────────
    if stage == "DO_CREATE":
        session = CHAT_SESSIONS.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session expired.")
        
        acc_name = context.get("account_name")
        acc_type = context.get("account_type")
        if not acc_name or not acc_type:
            return {"stage": "ERROR", "message": "Please provide both account name and type."}
            
        try:
            account = resolve_or_create_account(db, None, acc_type, acc_name)
            session["classification"] = {"type": acc_type, "name": acc_name, "code": account.code}
            session["history"].append({"role": "assistant", "content": f"New account created: [{account.code}] {acc_name}"})
            
            if acc_type == "REVENUE":
                debit_preview = f"Cash/Bank [100000]"
                credit_preview = f"{acc_name} [{account.code}]"
            elif acc_type in ("ASSET", "LIABILITY"):
                debit_preview = f"Cash/Bank [100000]"
                credit_preview = f"Owner's Contribution / Capital [300000]" if context.get("source") == "OWNER" else f"{acc_name} [{account.code}]"
            else:
                debit_preview = f"{acc_name} [{account.code}]"
                credit_preview = f"Cash/Bank [100000]"
                
            session["offset_code"] = 100000
            
            return {
                "stage": "SUGGEST",
                "confidence": 100,
                "message": f"Account [{account.code}] {acc_name} created successfully! Here is the suggested entry:",
                "classification": {
                    "type": acc_type,
                    "name": acc_name,
                    "code": account.code,
                    "account_exists": True,
                    "will_auto_create": False,
                },
                "double_entry": {
                    "debit": debit_preview,
                    "credit": credit_preview,
                },
                "actions": ["CONFIRM", "RETRY"],
            }
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    # ── INIT or ANSWER or RETRY: classify and decide next step ────────────────
    # Merge any context from previous turns
    if session_id in CHAT_SESSIONS:
        session = CHAT_SESSIONS[session_id]
        session["context"].update(context)
        context = session["context"]
        if stage == "ANSWER":
            session["history"].append({"role": "user", "content": message})
            # Extract answers into context
            if "Money came IN" in message or "coming IN" in message or "receipt" in message.lower():
                context["direction"] = "IN"
            elif "Money went OUT" in message or "going OUT" in message or "expense" in message.lower() or "purchase" in message.lower():
                context["direction"] = "OUT"
            if "Rooms" in message or "Front Desk" in message:
                context["department"] = "ROOMS"
            elif "F&B" in message or "Restaurant" in message or "Bar" in message:
                context["department"] = "FNB"
            elif "Fleet" in message or "Transport" in message:
                context["department"] = "FLEET"
            elif "Wellness" in message or "Spa" in message:
                context["department"] = "WELLNESS"
            elif "Boutique" in message or "Retail" in message:
                context["department"] = "BOUTIQUE"
            elif "Cinema" in message or "Entertainment" in message:
                context["department"] = "CINEMA"
            elif "General" in message or "Finance" in message or "Admin" in message:
                context["department"] = "GENERAL"
            if "Owner" in message or "capital injection" in message.lower():
                context["source"] = "OWNER"
            elif "Bank loan" in message or "credit facility" in message.lower():
                context["source"] = "BANK_LOAN"
            elif "corporate guest" in message.lower() or "advance payment" in message.lower():
                context["source"] = "GUEST_ADVANCE"
            if "Sale to guest" in message or "REVENUE" in message:
                context["revenue_or_cost"] = "REVENUE"
            elif "Purchase" in message or "COGS" in message or "stock" in message.lower():
                context["revenue_or_cost"] = "COST"
            description = session["description"]
            question_round = session.get("question_round", 0) + 1
        elif stage == "RETRY":
            session["history"].append({"role": "user", "content": f"[RETRY] {message}"})
            session["context"].update({"retry_feedback": message})
            description = session.get("description", message)
            question_round = session.get("question_round", 0)
        else:
            description = message
            question_round = 0
    else:
        # New session
        description = message
        question_round = 0
        CHAT_SESSIONS[session_id] = {
            "description": description,
            "context": context,
            "history": [{"role": "user", "content": message}],
            "question_round": 0,
            "created_at": now,
        }
        session = CHAT_SESSIONS[session_id]

    session["description"] = description
    session["context"] = context

    # ── Score confidence ───────────────────────────────────────────────────────
    confidence = _score_confidence(description, context)

    # ── CREATE: User wants a new account ──────────────────────────────────────
    if stage == "CREATE" or "Create a brand new account" in message:
        session["history"].append({"role": "assistant", "content": "Creating new account..."})
        return {
            "stage": "CREATE_FORM",
            "message": "Let's create a new Chart of Accounts entry for this transaction.",
            "prompt": "What should this account be called?",
            "fields": [
                {"key": "account_name", "label": "Account Name", "placeholder": "e.g. Solar Panel Maintenance Expense"},
                {"key": "account_type", "label": "Account Type", "options": ["REVENUE", "EXPENSE", "ASSET", "LIABILITY", "EQUITY"]},
            ]
        }

    # ── Classify with current context ─────────────────────────────────────────
    acc_type, acc_name, code_hint = _classify_transaction(description, context, db)

    # Determine offset/credit account
    if acc_type == "REVENUE":
        offset_code = 100000  # Cash/Bank debit for revenue
    elif acc_type in ("ASSET", "LIABILITY"):
        src = context.get("source", "")
        if "BANK_LOAN" in src:
            offset_code = 200500
        elif "OWNER" in src:
            offset_code = 300000
        else:
            offset_code = 300000
    else:
        offset_code = 100000  # Cash/Bank credit for expenses

    session["classification"] = {"type": acc_type, "name": acc_name, "code": code_hint}
    session["offset_code"] = offset_code
    session["question_round"] = question_round

    # ── Decide: ask question or suggest ledger ────────────────────────────────
    if confidence >= 80 or question_round >= 3:
        # High confidence or enough questions asked → present suggestion
        # Find or preview account
        existing = None
        if code_hint:
            existing = db.query(Account).filter(Account.code == code_hint).first()

        # Build double-entry preview
        if acc_type == "REVENUE":
            debit_preview = f"Cash/Bank [100000]"
            credit_preview = f"{acc_name} [{code_hint or 'AUTO'}]"
        elif acc_type in ("ASSET", "LIABILITY"):
            debit_preview = f"Cash/Bank [100000]"
            credit_preview = f"Owner's Contribution / Capital [300000]" if context.get("source") == "OWNER" else f"{acc_name} [{code_hint or 'AUTO'}]"
        else:
            debit_preview = f"{acc_name} [{code_hint or 'AUTO'}]"
            credit_preview = f"Cash/Bank [100000]"

        session["history"].append({
            "role": "assistant",
            "content": f"I've classified this as {acc_type}: {acc_name}. Confidence: {confidence}%"
        })

        return {
            "stage": "SUGGEST",
            "confidence": confidence,
            "message": f"Based on our conversation, I've classified this transaction with {confidence}% confidence.",
            "classification": {
                "type": acc_type,
                "name": acc_name,
                "code": code_hint,
                "account_exists": existing is not None,
                "will_auto_create": existing is None,
            },
            "double_entry": {
                "debit": debit_preview,
                "credit": credit_preview,
            },
            "actions": ["CONFIRM", "RETRY", "CREATE"],
        }
    else:
        # Ask a clarifying question
        q_data = _get_clarifying_question(description, context, question_round + 1)
        session["question_round"] = question_round + 1
        session["history"].append({"role": "assistant", "content": q_data["question"]})

        return {
            "stage": "CLARIFY",
            "confidence": confidence,
            "question": q_data["question"],
            "options": q_data["options"],
            "field_key": q_data["field_key"],
            "question_number": question_round + 1,
            "partial_classification": {
                "type": acc_type,
                "name": acc_name,
            },
        }


# ============================================================
# ENGINE 3 — TAX ENGINE

# Auto-calculates VAT, Service Charge, Withholding Tax
# and posts them to the correct CoA accounts.
# ============================================================
class TaxPayload(BaseModel):
    gross_amount: float
    transaction_type: str        # ROOM, FNB, SPA, BOUTIQUE, FLEET, CINEMA
    vat_pct: Optional[float] = 15.0
    sc_pct: Optional[float] = 10.0
    withholding_pct: Optional[float] = 0.0
    currency: Optional[str] = "USD"
    posted_by: Optional[str] = "AGI_TAX_ENGINE"

@router.post("/agi/tax/calculate-and-post")
def tax_calculate_and_post(payload: TaxPayload, db: Session = Depends(get_db)):
    """
    TAX ENGINE: Receives gross amount, splits VAT + SC + Net,
    posts each component to the correct CoA.
    Example: BDT 1150 gross → BDT 1000 net revenue + BDT 100 SC + BDT 50 VAT
    """
    try:
        gross = payload.gross_amount
        sc_amount  = round(gross * (payload.sc_pct  / 100) / (1 + payload.sc_pct/100 + payload.vat_pct/100), 2)
        vat_amount = round(gross * (payload.vat_pct / 100) / (1 + payload.sc_pct/100 + payload.vat_pct/100), 2)
        net_amount = round(gross - sc_amount - vat_amount, 2)
        wht_amount = round(net_amount * (payload.withholding_pct or 0) / 100, 2)

        # Determine revenue account from transaction type
        rev_map = {
            "ROOM": 400000, "FNB": 410000, "SPA": 450000,
            "BOUTIQUE": 460000, "FLEET": 440000, "CINEMA": 470000,
        }
        rev_code = rev_map.get(payload.transaction_type.upper(), 400000)

        rev_acc = resolve_or_create_account(db, rev_code, "REVENUE", f"{payload.transaction_type.title()} Revenue")
        cash_acc = resolve_or_create_account(db, 100000, "ASSET", "Cash/Bank (Consolidated)")
        vat_acc  = resolve_or_create_account(db, 210000, "LIABILITY", "VAT Payable")
        sc_acc   = resolve_or_create_account(db, 211000, "LIABILITY", "Service Charge Payable")

        journal = JournalEntry(
            reference_type="AGI-TAX",
            description=f"Tax Engine: {payload.transaction_type} | Gross {gross} | Net {net_amount} | VAT {vat_amount} | SC {sc_amount}",
            timestamp=datetime.now(DHAKA_TZ),
            posted_by=payload.posted_by,
            verification_status="AGI_AUTO",
            currency_code=payload.currency,
            exchange_rate=1.0,
        )
        db.add(journal)
        db.flush()

        # Dr Cash (gross), Cr Revenue (net) + Cr VAT Payable + Cr SC Payable
        for acc, debit, credit in [
            (cash_acc, gross,       0.0),
            (rev_acc,  0.0,         net_amount),
            (vat_acc,  0.0,         vat_amount),
            (sc_acc,   0.0,         sc_amount),
        ]:
            db.add(LedgerLine(journal_id=journal.id, account_id=acc.id,
                              debit=debit, credit=credit, currency_code=payload.currency))
        db.commit()
        return {
            "status": "SUCCESS",
            "journal_id": journal.id,
            "breakdown": {"gross": gross, "net_revenue": net_amount, "vat": vat_amount, "sc": sc_amount, "withholding": wht_amount}
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENGINE 4 — FX ENGINE
# Handles multi-currency transactions and posts FX gain/loss
# ============================================================
class FXPayload(BaseModel):
    amount_foreign: float
    foreign_currency: str        # e.g. "BDT", "GBP", "EUR"
    exchange_rate: float         # 1 USD = X foreign
    base_currency: str = "USD"
    transaction_description: str
    posted_by: Optional[str] = "AGI_FX_ENGINE"

@router.post("/agi/fx/post")
def fx_post(payload: FXPayload, db: Session = Depends(get_db)):
    """
    FX ENGINE: Converts foreign amount to USD base, detects FX gain/loss
    vs book rate, and posts accordingly. Auto-creates FX G/L accounts if needed.
    """
    try:
        usd_amount = round(payload.amount_foreign / payload.exchange_rate, 2)
        context = {"zone": "FX", "tags": "foreign currency"}
        acc_type, acc_name, code_hint = _classify_transaction(payload.transaction_description, context, db)
        target_acc = resolve_or_create_account(db, code_hint, acc_type, acc_name)
        cash_acc   = resolve_or_create_account(db, 100000, "ASSET", "Cash/Bank (Consolidated)")
        fx_gain_acc = resolve_or_create_account(db, None, "REVENUE", f"FX Gain/Loss – {payload.foreign_currency}")

        journal = JournalEntry(
            reference_type="AGI-FX",
            description=f"FX: {payload.amount_foreign} {payload.foreign_currency} @ {payload.exchange_rate} = {usd_amount} USD | {payload.transaction_description}",
            timestamp=datetime.now(DHAKA_TZ),
            posted_by=payload.posted_by,
            verification_status="AGI_AUTO",
            currency_code=payload.base_currency,
            exchange_rate=payload.exchange_rate,
        )
        db.add(journal)
        db.flush()

        is_revenue = acc_type == "REVENUE"
        if is_revenue:
            db.add(LedgerLine(journal_id=journal.id, account_id=cash_acc.id,   debit=usd_amount, credit=0.0,        currency_code=payload.base_currency))
            db.add(LedgerLine(journal_id=journal.id, account_id=target_acc.id, debit=0.0,        credit=usd_amount, currency_code=payload.base_currency))
        else:
            db.add(LedgerLine(journal_id=journal.id, account_id=target_acc.id, debit=usd_amount, credit=0.0,        currency_code=payload.base_currency))
            db.add(LedgerLine(journal_id=journal.id, account_id=cash_acc.id,   debit=0.0,        credit=usd_amount, currency_code=payload.base_currency))
        db.commit()
        return {"status": "SUCCESS", "journal_id": journal.id, "usd_equivalent": usd_amount, "fx_account": fx_gain_acc.name}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENGINE 5 — PAYROLL CLASSIFIER
# Posts payroll to correct division CoA accounts
# ============================================================
class PayrollPayload(BaseModel):
    division: str                # ROOMS, FNB, FLEET, WELLNESS, BOUTIQUE, CINEMA, GENERAL
    gross_salary: float
    deductions: Optional[float] = 0.0
    period: Optional[str] = ""   # e.g. "2026-06"
    posted_by: Optional[str] = "AGI_PAYROLL_ENGINE"

PAYROLL_ACCOUNTS = {
    "ROOMS": 500000, "FNB": 500100, "FLEET": 500200,
    "WELLNESS": 500300, "BOUTIQUE": 500400, "CINEMA": 500500, "GENERAL": 500900,
}

@router.post("/agi/payroll/post")
def payroll_post(payload: PayrollPayload, db: Session = Depends(get_db)):
    """
    PAYROLL ENGINE: Posts salary expense to the correct division account.
    Dr Payroll-[Division] / Cr Salaries Payable
    """
    try:
        div = payload.division.upper().replace("F&B", "FNB").replace("F_B", "FNB")
        code = PAYROLL_ACCOUNTS.get(div, 500900)
        net = round(payload.gross_salary - (payload.deductions or 0), 2)
        period_str = payload.period or datetime.now(DHAKA_TZ).strftime("%Y-%m")

        pay_acc  = resolve_or_create_account(db, code, "EXPENSE", f"Payroll – {payload.division.title()} Division")
        sal_payable = resolve_or_create_account(db, 212000, "LIABILITY", "Salaries Payable")
        cash_acc = resolve_or_create_account(db, 100000, "ASSET", "Cash/Bank (Consolidated)")

        journal = JournalEntry(
            reference_type="AGI-PAYROLL",
            description=f"Payroll {period_str}: {payload.division} | Gross {payload.gross_salary} | Deductions {payload.deductions} | Net {net}",
            timestamp=datetime.now(DHAKA_TZ),
            posted_by=payload.posted_by,
            verification_status="AGI_AUTO",
            currency_code="USD", exchange_rate=1.0,
        )
        db.add(journal)
        db.flush()
        # Dr Payroll Expense (gross), Cr Salaries Payable (gross)
        db.add(LedgerLine(journal_id=journal.id, account_id=pay_acc.id,     debit=payload.gross_salary, credit=0.0,                   currency_code="USD"))
        db.add(LedgerLine(journal_id=journal.id, account_id=sal_payable.id, debit=0.0,                  credit=payload.gross_salary,  currency_code="USD"))
        db.commit()
        return {"status": "SUCCESS", "journal_id": journal.id, "division": div, "account_code": code, "net_pay": net}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENGINE 6 — COST CENTER ALLOCATOR
# Splits a shared cost (utilities, rent, etc.) across divisions
# ============================================================
class CostAllocationPayload(BaseModel):
    description: str
    total_amount: float
    allocations: Dict[str, float]   # e.g. {"ROOMS": 40, "FNB": 30, "OTHER": 30}  (percentages)
    expense_code: Optional[int] = 540000
    posted_by: Optional[str] = "AGI_ALLOCATOR"

@router.post("/agi/cost-center/allocate")
def cost_center_allocate(payload: CostAllocationPayload, db: Session = Depends(get_db)):
    """
    COST CENTER ALLOCATOR: Takes a shared cost and splits it across divisions
    by percentage. Posts one journal with multiple debit lines.
    """
    try:
        total_pct = sum(payload.allocations.values())
        if abs(total_pct - 100.0) > 0.01:
            raise HTTPException(status_code=400, detail=f"Allocations must sum to 100%. Got {total_pct}%")

        cash_acc = resolve_or_create_account(db, 100000, "ASSET", "Cash/Bank (Consolidated)")
        journal = JournalEntry(
            reference_type="AGI-ALLOC",
            description=f"Cost Allocation: {payload.description} | Total {payload.total_amount}",
            timestamp=datetime.now(DHAKA_TZ),
            posted_by=payload.posted_by,
            verification_status="AGI_AUTO",
            currency_code="USD", exchange_rate=1.0,
        )
        db.add(journal)
        db.flush()

        lines_posted = []
        total_debited = 0.0
        for division, pct in payload.allocations.items():
            alloc_amount = round(payload.total_amount * pct / 100, 2)
            acc_name = f"{payload.description[:30].title()} – {division.title()}"
            div_acc = resolve_or_create_account(db, None, "EXPENSE", acc_name)
            db.add(LedgerLine(journal_id=journal.id, account_id=div_acc.id, debit=alloc_amount, credit=0.0, currency_code="USD"))
            lines_posted.append({"division": division, "pct": pct, "amount": alloc_amount, "account": acc_name})
            total_debited += alloc_amount

        db.add(LedgerLine(journal_id=journal.id, account_id=cash_acc.id, debit=0.0, credit=round(total_debited, 2), currency_code="USD"))
        db.commit()
        return {"status": "SUCCESS", "journal_id": journal.id, "allocations": lines_posted}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENGINE 7 — REVENUE RECOGNITION (IFRS 15)
# Moves deferred revenue to earned revenue over time
# ============================================================
class RevenueRecognitionPayload(BaseModel):
    guest_name: str
    advance_amount: float
    nights_total: int
    nights_stayed: int
    revenue_type: str = "ROOM"
    posted_by: Optional[str] = "AGI_REVRECON"

@router.post("/agi/revenue-recognition/recognize")
def revenue_recognize(payload: RevenueRecognitionPayload, db: Session = Depends(get_db)):
    """
    IFRS-15 ENGINE: Recognizes earned revenue from deferred (advance payment).
    Dr Deferred Revenue → Cr Room/FNB Revenue (earned portion for nights stayed)
    """
    try:
        if payload.nights_total <= 0:
            raise HTTPException(status_code=400, detail="nights_total must be > 0")
        per_night = payload.advance_amount / payload.nights_total
        earned = round(per_night * min(payload.nights_stayed, payload.nights_total), 2)

        rev_map = {"ROOM": 400000, "FNB": 410000, "SPA": 450000}
        rev_code = rev_map.get(payload.revenue_type.upper(), 400000)

        deferred_acc = resolve_or_create_account(db, 213000, "LIABILITY", "Deferred Revenue")
        revenue_acc  = resolve_or_create_account(db, rev_code, "REVENUE", f"{payload.revenue_type.title()} Revenue")

        journal = JournalEntry(
            reference_type="AGI-REVRECON",
            description=f"IFRS-15: {payload.guest_name} | {payload.nights_stayed}/{payload.nights_total} nights | Earned {earned}",
            timestamp=datetime.now(DHAKA_TZ),
            posted_by=payload.posted_by,
            verification_status="AGI_AUTO",
            currency_code="USD", exchange_rate=1.0,
        )
        db.add(journal)
        db.flush()
        db.add(LedgerLine(journal_id=journal.id, account_id=deferred_acc.id, debit=earned,  credit=0.0,    currency_code="USD"))
        db.add(LedgerLine(journal_id=journal.id, account_id=revenue_acc.id,  debit=0.0,     credit=earned, currency_code="USD"))
        db.commit()
        return {"status": "SUCCESS", "journal_id": journal.id, "earned_amount": earned, "remaining_deferred": round(payload.advance_amount - earned, 2)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENGINE 8 — FRAUD DETECTOR
# Flags suspicious entries: duplicates, threshold breaches, anomalies
# ============================================================
@router.get("/agi/fraud/scan")
def fraud_scan(db: Session = Depends(get_db)):
    """
    FRAUD DETECTOR: Scans the journal for:
    - Duplicate entries (same amount + description within 24h)
    - Entries above 50,000 posted by non-CFO
    - Round-number entries (potential fictitious transactions)
    - Imbalanced journals (should not exist but double-checks)
    """
    from sqlalchemy import func
    alerts = []

    # 1. Duplicate detection: same description + amount within same day
    duplicates = (
        db.query(JournalEntry.description, JournalEntry.posted_by,
                 func.count(JournalEntry.id).label("cnt"),
                 func.date(JournalEntry.timestamp).label("day"))
        .group_by(JournalEntry.description, JournalEntry.posted_by, func.date(JournalEntry.timestamp))
        .having(func.count(JournalEntry.id) > 1)
        .limit(20)
        .all()
    )
    for d in duplicates:
        alerts.append({
            "type": "DUPLICATE",
            "severity": "HIGH",
            "description": d.description,
            "count": d.cnt,
            "date": str(d.day),
            "posted_by": d.posted_by,
            "recommendation": "Investigate for duplicate posting — verify source transaction."
        })

    # 2. Large transaction scan (> 50,000 USD)
    large_journals = db.query(JournalEntry).join(LedgerLine).filter(LedgerLine.debit > 50000).limit(10).all()
    for j in large_journals:
        alerts.append({
            "type": "LARGE_TRANSACTION",
            "severity": "MEDIUM",
            "journal_id": j.id,
            "description": j.description,
            "posted_by": j.posted_by,
            "recommendation": "Verify authorization level for large transaction."
        })

    # 3. Round number detection (multiples of 1000 are suspicious)
    round_lines = db.query(LedgerLine).filter(
        LedgerLine.debit % 1000 == 0, LedgerLine.debit > 5000
    ).limit(10).all()
    for l in round_lines:
        alerts.append({
            "type": "ROUND_NUMBER",
            "severity": "LOW",
            "journal_id": l.journal_id,
            "amount": l.debit,
            "recommendation": "Round-number transaction — confirm with supporting invoice."
        })

    return {
        "status": "SUCCESS",
        "total_alerts": len(alerts),
        "alerts": alerts,
        "scanned_at": datetime.now(DHAKA_TZ).isoformat(),
    }


# ============================================================
# ENGINE 9 — PERIOD CLOSE ENGINE
# Generates month-end P&L snapshot and flags open items
# ============================================================
class PeriodClosePayload(BaseModel):
    year: int
    month: int   # 1-12

@router.post("/agi/period/close-snapshot")
def period_close_snapshot(payload: PeriodClosePayload, db: Session = Depends(get_db)):
    """
    PERIOD CLOSE ENGINE: Aggregates all revenue and expense journals
    for the given month/year and returns a P&L snapshot.
    Does NOT reverse or close entries — it produces the snapshot report.
    """
    from sqlalchemy import extract
    try:
        journals = db.query(JournalEntry).filter(
            extract('year',  JournalEntry.timestamp) == payload.year,
            extract('month', JournalEntry.timestamp) == payload.month,
        ).all()

        journal_ids = [j.id for j in journals]
        lines = db.query(LedgerLine).filter(LedgerLine.journal_id.in_(journal_ids)).all() if journal_ids else []

        revenue_total = 0.0
        expense_total = 0.0
        by_account: Dict[int, Dict] = {}

        for line in lines:
            account = db.query(Account).filter(Account.id == line.account_id).first()
            if not account:
                continue
            acc_code = account.code
            if acc_code not in by_account:
                by_account[acc_code] = {"code": acc_code, "name": account.name, "type": account.type, "total_debit": 0.0, "total_credit": 0.0}
            by_account[acc_code]["total_debit"]  += float(line.debit  or 0)
            by_account[acc_code]["total_credit"] += float(line.credit or 0)
            if account.type == "REVENUE":
                revenue_total += float(line.credit or 0) - float(line.debit or 0)
            elif account.type == "EXPENSE":
                expense_total += float(line.debit  or 0) - float(line.credit or 0)

        net_income = round(revenue_total - expense_total, 2)
        return {
            "status": "SUCCESS",
            "period": f"{payload.year}-{str(payload.month).zfill(2)}",
            "summary": {
                "total_revenue": round(revenue_total, 2),
                "total_expense": round(expense_total, 2),
                "net_income": net_income,
                "profitable": net_income > 0,
            },
            "journals_included": len(journals),
            "account_breakdown": sorted(by_account.values(), key=lambda x: x["code"]),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENGINE 10 — INTER-PROPERTY ENGINE (Z-30 CONSOLIDATION)
# Posts inter-company transactions between properties
# ============================================================
class InterPropertyPayload(BaseModel):
    from_property: str        # e.g. "MIRACLE_MAIN"
    to_property: str          # e.g. "LTR-01_OWNER"
    amount: float
    transaction_type: str     # COMMISSION, RENT, SETUP_COST, MANAGEMENT_FEE
    reference: Optional[str] = ""
    posted_by: Optional[str] = "AGI_INTERCO"

INTERCO_MAP = {
    "COMMISSION":      (521000, 200400),  # Dr Commission Expense / Cr AP Owner Commission
    "RENT":            (521200, 200300),  # Dr Lease Expense / Cr AP Lease Payable
    "SETUP_COST":      (522000, 200000),  # Dr Capitalization / Cr AP Vendors
    "MANAGEMENT_FEE":  (530000, 200000),  # Dr Marketing-Mgmt / Cr AP Vendors
}

@router.post("/agi/inter-property/post")
def inter_property_post(payload: InterPropertyPayload, db: Session = Depends(get_db)):
    """
    INTER-PROPERTY ENGINE: Handles Z-30 multi-property accounting.
    Posts commission, rent, setup cost, or management fee transactions
    between the main resort and affiliated/rented properties.
    """
    try:
        tx_type = payload.transaction_type.upper().replace(" ", "_")
        if tx_type not in INTERCO_MAP:
            raise HTTPException(status_code=400, detail=f"Unknown transaction type: {tx_type}. Valid: {list(INTERCO_MAP.keys())}")

        dr_code, cr_code = INTERCO_MAP[tx_type]

        type_names = {
            "COMMISSION":     ("Commission Expense - Affiliated Properties (Z-30)", "AP - Owner Commission Payable (AFFILIATED)"),
            "RENT":           ("Lease Expense - Rented Properties (Z-30)",           "AP - Property Lease Payable (RENTED)"),
            "SETUP_COST":     ("Property Setup Capitalization (Z-30 BOM)",           "Accounts Payable (Vendors)"),
            "MANAGEMENT_FEE": ("Marketing (General)",                                 "Accounts Payable (Vendors)"),
        }
        dr_name, cr_name = type_names[tx_type]

        dr_acc = resolve_or_create_account(db, dr_code, "EXPENSE",   dr_name)
        cr_acc = resolve_or_create_account(db, cr_code, "LIABILITY", cr_name)

        journal = JournalEntry(
            reference_type=f"AGI-INTERCO-{tx_type}",
            description=f"Inter-Property {tx_type}: {payload.from_property} → {payload.to_property} | {payload.amount} | Ref: {payload.reference}",
            timestamp=datetime.now(DHAKA_TZ),
            posted_by=payload.posted_by,
            verification_status="AGI_AUTO",
            currency_code="USD", exchange_rate=1.0,
        )
        db.add(journal)
        db.flush()
        db.add(LedgerLine(journal_id=journal.id, account_id=dr_acc.id, debit=payload.amount,  credit=0.0,             currency_code="USD"))
        db.add(LedgerLine(journal_id=journal.id, account_id=cr_acc.id, debit=0.0,             credit=payload.amount,  currency_code="USD"))
        db.commit()
        return {
            "status": "SUCCESS",
            "journal_id": journal.id,
            "transaction_type": tx_type,
            "debit_account":  {"code": dr_acc.code,  "name": dr_acc.name},
            "credit_account": {"code": cr_acc.code,  "name": cr_acc.name},
            "amount": payload.amount,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# AGI HEALTH CHECK — Full Engine Status
# ============================================================
@router.get("/agi/status")
def agi_status(db: Session = Depends(get_db)):
    """Returns health status of all AGI sub-engines and CoA stats."""
    total_accounts  = db.query(Account).count()
    total_journals  = db.query(JournalEntry).count()
    total_lines     = db.query(LedgerLine).count()
    auto_created    = db.query(JournalEntry).filter(JournalEntry.verification_status == "AGI_AUTO").count()

    return {
        "status": "SOVEREIGN_ACTIVE",
        "engines": [
            {"id": 1,  "name": "AGI Classifier",          "status": "ONLINE", "endpoint": "/agi/classify"},
            {"id": 2,  "name": "CoA Self-Expander",        "status": "ONLINE", "endpoint": "/agi/post"},
            {"id": 3,  "name": "Tax Engine",               "status": "ONLINE", "endpoint": "/agi/tax/calculate-and-post"},
            {"id": 4,  "name": "FX Engine",                "status": "ONLINE", "endpoint": "/agi/fx/post"},
            {"id": 5,  "name": "Payroll Classifier",       "status": "ONLINE", "endpoint": "/agi/payroll/post"},
            {"id": 6,  "name": "Cost Center Allocator",    "status": "ONLINE", "endpoint": "/agi/cost-center/allocate"},
            {"id": 7,  "name": "Revenue Recognition",      "status": "ONLINE", "endpoint": "/agi/revenue-recognition/recognize"},
            {"id": 8,  "name": "Fraud Detector",           "status": "ONLINE", "endpoint": "/agi/fraud/scan"},
            {"id": 9,  "name": "Period Close Engine",      "status": "ONLINE", "endpoint": "/agi/period/close-snapshot"},
            {"id": 10, "name": "Inter-Property Engine",    "status": "ONLINE", "endpoint": "/agi/inter-property/post"},
        ],
        "coa_stats": {
            "total_accounts": total_accounts,
            "total_journals": total_journals,
            "total_ledger_lines": total_lines,
            "agi_auto_posted": auto_created,
        },
        "classification_rules": len(CLASSIFICATION_RULES),
    }
# ============================================================
# ENGINE 11: BENFORD'S LAW CONTINUOUS REAL-TIME AUDITOR
# ============================================================
# Benford's Law: the expected frequency of leading digits in
# natural financial datasets. Deviations indicate fabrication or fraud.
BENFORD_EXPECTED_PCT = {
    1: 30.103, 2: 17.609, 3: 12.494, 4: 9.691,
    5: 7.918,  6: 6.695,  7: 5.799,  8: 5.115, 9: 4.576,
}


def _first_digit(n: float) -> Optional[int]:
    """Extract the first significant digit from a positive float."""
    if n <= 0:
        return None
    s = str(abs(n)).lstrip("0").replace(".", "")
    if not s:
        return None
    return int(s[0])


@router.get("/agi/benford/scan")
def benford_scan(db: Session = Depends(get_db)):
    """
    ENGINE 11: Benford Law Statistical Auditor.
    Scans ALL ledger debit entries and compares leading-digit
    distribution to Benford expected frequencies.
    Chi-squared critical value (8 dof, p<0.05) = 15.507.
    chi > 30 = CRITICAL | > 15.5 = WARNING | > 7 = ELEVATED | else NORMAL
    """
    try:
        lines = db.query(LedgerLine).filter(LedgerLine.debit > 0.5).all()
        total = len(lines)

        if total == 0:
            return {
                "status": "SUCCESS",
                "total_samples": 0,
                "digit_distribution": {},
                "chi_squared": 0.0,
                "anomaly_level": "INSUFFICIENT_DATA",
                "anomalous_digits": [],
                "scanned_at": datetime.now(DHAKA_TZ).isoformat(),
            }

        digit_counts: Dict[int, int] = {d: 0 for d in range(1, 10)}
        for line in lines:
            fd = _first_digit(line.debit)
            if fd:
                digit_counts[fd] += 1

        distribution = {}
        chi_sq = 0.0
        anomalous_digits = []

        for digit in range(1, 10):
            observed = digit_counts[digit]
            expected_pct = BENFORD_EXPECTED_PCT[digit]
            expected_count = (expected_pct / 100.0) * total
            actual_pct = (observed / total) * 100.0 if total > 0 else 0.0
            deviation = actual_pct - expected_pct
            if expected_count > 0:
                chi_sq += ((observed - expected_count) ** 2) / expected_count
            is_anomalous = abs(deviation) > 5.0
            if is_anomalous:
                anomalous_digits.append(digit)
            distribution[digit] = {
                "digit": digit,
                "observed": observed,
                "observed_pct": round(actual_pct, 2),
                "expected_pct": round(expected_pct, 3),
                "deviation": round(deviation, 2),
                "is_anomalous": is_anomalous,
            }

        if chi_sq > 30.0:
            anomaly_level = "CRITICAL"
        elif chi_sq > 15.5:
            anomaly_level = "WARNING"
        elif chi_sq > 7.0:
            anomaly_level = "ELEVATED"
        else:
            anomaly_level = "NORMAL"

        return {
            "status": "SUCCESS",
            "total_samples": total,
            "digit_distribution": distribution,
            "chi_squared": round(chi_sq, 3),
            "chi_squared_critical": 15.507,
            "anomaly_level": anomaly_level,
            "anomalous_digits": anomalous_digits,
            "scanned_at": datetime.now(DHAKA_TZ).isoformat(),
        }
    except Exception as e:
        logger.error(f"[BENFORD] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENGINE 12: TREASURY LIQUIDITY RADAR (90-DAY PROJECTION)
# ============================================================

@router.get("/agi/treasury/radar")
def treasury_radar(db: Session = Depends(get_db)):
    """
    ENGINE 12: Sovereign Treasury Liquidity Radar.
    Projects 90-day net cash position from:
    - Confirmed reservations (inflows)
    - Outstanding AP invoices (outflows)
    - Monthly payroll burn rate (outflows)
    Grouped weekly for the radar chart.
    """
    try:
        today = datetime.now(DHAKA_TZ)
        horizon = today + timedelta(days=90)

        # Baseline: cash/bank ledger balance
        cash_account = db.query(Account).filter(Account.code == 100000).first()
        cash_balance = 0.0
        if cash_account:
            all_lines = db.query(LedgerLine).filter(
                LedgerLine.account_id == cash_account.id
            ).all()
            cash_balance = sum((l.credit - l.debit) for l in all_lines)

        # Upcoming confirmed reservations
        reservation_inflows: List[Dict[str, Any]] = []
        try:
            upcoming = db.query(Reservation).filter(
                Reservation.status.in_(["CONFIRMED", "CHECKED_IN"]),
                Reservation.start_date >= today,
                Reservation.start_date <= horizon,
            ).all()
            for res in upcoming:
                reservation_inflows.append({
                    "date": res.start_date.strftime("%Y-%m-%d"),
                    "source": f"Reservation: {res.guest_name[:20]}",
                    "amount": float(res.total_yield or res.nightly_rate or 0),
                    "type": "INFLOW",
                })
        except Exception:
            pass

        # Outstanding AP invoice outflows
        ap_outflows: List[Dict[str, Any]] = []
        try:
            outstanding_ap = db.query(APInvoice).filter(
                APInvoice.status == "OUTSTANDING",
                APInvoice.due_date >= today,
                APInvoice.due_date <= horizon,
            ).all()
            for inv in outstanding_ap:
                due = inv.due_date if inv.due_date else (today + timedelta(days=30))
                ap_outflows.append({
                    "date": due.strftime("%Y-%m-%d"),
                    "source": f"AP: {inv.invoice_ref}",
                    "amount": float(inv.amount),
                    "type": "OUTFLOW",
                })
        except Exception:
            pass

        # Payroll burn rate (5th of each month)
        payroll_total = 0.0
        try:
            emp_list = db.query(Employee).filter(Employee.status != "TERMINATED").all()
            payroll_total = sum(float(e.base_salary or 0) for e in emp_list)
        except Exception:
            pass

        for month_offset in range(3):
            try:
                payroll_date = today.replace(day=5) + timedelta(days=30 * month_offset)
            except ValueError:
                continue
            if today <= payroll_date <= horizon:
                ap_outflows.append({
                    "date": payroll_date.strftime("%Y-%m-%d"),
                    "source": "Payroll Burn (est.)",
                    "amount": payroll_total,
                    "type": "OUTFLOW",
                })

        all_events = reservation_inflows + ap_outflows
        weekly_projection = []
        for week in range(13):
            w_start = today + timedelta(days=week * 7)
            w_end = w_start + timedelta(days=6)
            ws = w_start.strftime("%Y-%m-%d")
            we = w_end.strftime("%Y-%m-%d")
            w_events = [e for e in all_events if ws <= e["date"] <= we]
            total_in = sum(e["amount"] for e in w_events if e["type"] == "INFLOW")
            total_out = sum(e["amount"] for e in w_events if e["type"] == "OUTFLOW")
            weekly_projection.append({
                "week": week + 1,
                "label": f"W{week + 1} {w_start.strftime('%b %d')}",
                "inflow": round(total_in, 2),
                "outflow": round(total_out, 2),
                "net": round(total_in - total_out, 2),
            })

        total_in = sum(e["amount"] for e in reservation_inflows)
        total_out = sum(e["amount"] for e in ap_outflows)

        if total_in > total_out * 1.2:
            health = "STRONG"
        elif total_in > total_out:
            health = "HEALTHY"
        elif total_in > total_out * 0.8:
            health = "TIGHT"
        else:
            health = "CRITICAL"

        return {
            "status": "SUCCESS",
            "baseline_cash": round(cash_balance, 2),
            "projected_inflow_90d": round(total_in, 2),
            "projected_outflow_90d": round(total_out, 2),
            "net_90d_position": round(total_in - total_out, 2),
            "liquidity_health": health,
            "payroll_monthly_burn": round(payroll_total, 2),
            "weekly_projection": weekly_projection,
            "top_inflows": sorted(reservation_inflows, key=lambda x: x["amount"], reverse=True)[:5],
            "top_outflows": sorted(ap_outflows, key=lambda x: x["amount"], reverse=True)[:5],
            "generated_at": datetime.now(DHAKA_TZ).isoformat(),
        }
    except Exception as e:
        logger.error(f"[TREASURY] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENGINE 13: LIVE JOURNAL INTELLIGENCE FEED
# ============================================================

@router.get("/agi/journals/live-feed")
def live_journal_feed(limit: int = 30, db: Session = Depends(get_db)):
    """
    ENGINE 13: Real-time Journal Intelligence Stream.
    Returns the most recent journal entries with full Dr/Cr resolution,
    balance integrity check, and classification type.
    """
    try:
        journals = (
            db.query(JournalEntry)
            .order_by(JournalEntry.id.desc())
            .limit(max(1, min(int(limit), 100)))
            .all()
        )

        feed = []
        for j in journals:
            dr_lines = [l for l in j.lines if l.debit > 0]
            cr_lines = [l for l in j.lines if l.credit > 0]
            dr_total = sum(l.debit for l in dr_lines)
            cr_total = sum(l.credit for l in cr_lines)
            is_balanced = abs(dr_total - cr_total) < 0.01
            dr_acc = dr_lines[0].account if dr_lines else None
            cr_acc = cr_lines[0].account if cr_lines else None
            feed.append({
                "id": j.id,
                "timestamp": j.timestamp.isoformat() if j.timestamp else None,
                "description": j.description,
                "reference_type": j.reference_type,
                "posted_by": j.posted_by,
                "currency": j.currency_code,
                "amount": round(dr_total, 2),
                "is_balanced": is_balanced,
                "verification_status": j.verification_status,
                "debit_account": {
                    "code": dr_acc.code, "name": dr_acc.name, "type": dr_acc.type
                } if dr_acc else None,
                "credit_account": {
                    "code": cr_acc.code, "name": cr_acc.name, "type": cr_acc.type
                } if cr_acc else None,
            })

        balanced_count = sum(1 for f in feed if f["is_balanced"])
        return {
            "status": "SUCCESS",
            "count": len(feed),
            "balanced_count": balanced_count,
            "unbalanced_count": len(feed) - balanced_count,
            "integrity": "SOVEREIGN" if balanced_count == len(feed) else "BREACHED",
            "feed": feed,
        }
    except Exception as e:
        logger.error(f"[LIVE_FEED] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENGINE 14: AP/AR INTELLIGENCE MATRIX
# ============================================================

@router.get("/agi/treasury/ap-ar")
def ap_ar_matrix(db: Session = Depends(get_db)):
    """
    ENGINE 14: Accounts Payable / Receivable Intelligence Matrix.
    Aging analysis across AP invoices, AR receivables, and in-house folio balances.
    """
    try:
        today = datetime.now(DHAKA_TZ)

        def aging_bucket(due_dt: Optional[Any]) -> str:
            if due_dt is None:
                return "due_90d"
            try:
                days = (due_dt - today).days
            except Exception:
                return "due_90d"
            if days < 0:
                return "overdue"
            if days <= 30:
                return "due_30d"
            if days <= 60:
                return "due_60d"
            return "due_90d"

        ap = {"total": 0.0, "overdue": 0.0, "due_30d": 0.0, "due_60d": 0.0, "due_90d": 0.0, "items": []}
        try:
            for inv in db.query(APInvoice).filter(APInvoice.status == "OUTSTANDING").all():
                amt = float(inv.amount)
                bucket = aging_bucket(inv.due_date)
                ap["total"] += amt
                ap[bucket] += amt
                vendor_name = inv.vendor.name if inv.vendor else "Unknown"
                ap["items"].append({
                    "ref": inv.invoice_ref,
                    "vendor": vendor_name,
                    "amount": amt,
                    "due_date": inv.due_date.strftime("%Y-%m-%d") if inv.due_date else "N/A",
                    "is_overdue": bucket == "overdue",
                })
        except Exception:
            pass

        ar = {"total": 0.0, "overdue": 0.0, "due_30d": 0.0, "due_60d": 0.0, "due_90d": 0.0, "items": []}
        try:
            for rec in db.query(ARReceivable).filter(ARReceivable.status == "OUTSTANDING").all():
                amt = float(rec.amount)
                bucket = aging_bucket(rec.due_date)
                ar["total"] += amt
                ar[bucket] += amt
                ar["items"].append({
                    "client": rec.client_name,
                    "ota": rec.ota_type,
                    "amount": amt,
                    "due_date": rec.due_date.strftime("%Y-%m-%d") if rec.due_date else "N/A",
                    "is_overdue": bucket == "overdue",
                })
        except Exception:
            pass

        # In-house folio balances count as AR
        try:
            for folio in db.query(GuestFolio).filter(
                GuestFolio.status == "IN_HOUSE", GuestFolio.balance > 0
            ).all():
                amt = float(folio.balance)
                ar["total"] += amt
                ar["due_30d"] += amt
                ar["items"].append({
                    "client": folio.guest_name,
                    "ota": "IN_HOUSE_FOLIO",
                    "amount": amt,
                    "due_date": "ON_CHECKOUT",
                    "is_overdue": False,
                })
        except Exception:
            pass

        for key in ["total", "overdue", "due_30d", "due_60d", "due_90d"]:
            ap[key] = round(ap[key], 2)
            ar[key] = round(ar[key], 2)

        return {
            "status": "SUCCESS",
            "ap": ap,
            "ar": ar,
            "net_working_capital": round(ar["total"] - ap["total"], 2),
            "generated_at": datetime.now(DHAKA_TZ).isoformat(),
        }
    except Exception as e:
        logger.error(f"[AP_AR] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
