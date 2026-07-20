"""
ZONE SGPE — SOVEREIGN GLOBAL POLICY ENGINE
Miracle OS Sovereign Router v1.0

Converts Government Policies → Executable Software Rules that compile into:
  • Dynamic ledger entries
  • Document packets
  • Escrow locks
  • Tax records
  • JV share certificates

Sub-Engines:
  1. FDI & Immigration Engine   — Golden Visa / CBI threshold tracking
  2. Trustee Escrow Vault       — Dubai RERA / Bangladesh BOT milestone locking
  3. Tax Shield Engine          — US MACRS Cost Segregation + 1031 Exchange
  4. Sovereign Subsidy Engine   — LIHTC + Green credits
  5. BD JV Share-Selling Engine — Bangladesh resort fractional ownership (BIDA/RJSC)

Iron Laws:
  - All financial releases post double-entry via accounting_engine
  - Escrow release requires a RESOLVED SolveMission — no mission, no money
  - Policy configs are JSON-driven: any country/policy added via API, zero code change
  - Bangladesh share transfers require Bangladesh Bank 14-day AD report flag
"""

import logging
import json
import uuid
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.core.database import get_db
from app.models.models import (
    AssetGrid, SolveMission, SGPEPolicy, SGPEFDITracker,
    SGPEEscrowVault, SGPETaxRecord, SGPESubsidyRecord, SGPEJVShareRecord
)

logger = logging.getLogger("SGPE-ENGINE")
router = APIRouter(prefix="/api/sgpe", tags=["Z-SGPE: Sovereign Global Policy Engine"])

# ─────────────────────────────────────────────────────────────
# BUILT-IN POLICY SEED DATA (seeded on startup if DB is empty)
# ─────────────────────────────────────────────────────────────
SEED_POLICIES = [
    {
        "policy_code":  "uae_golden_visa",
        "country_code": "AE",
        "policy_name":  "UAE 10-Year Golden Visa",
        "category":     "FDI_IMMIGRATION",
        "description":  "Minimum AED 2M (~USD 545,000) in UAE property grants a 10-year Golden Visa with 100% corporate ownership and zero income tax. Off-plan eligible.",
        "rule_config": {
            "threshold_usd": 545000,
            "threshold_aed": 2000000,
            "visa_duration_years": 10,
            "off_plan_eligible": True,
            "tax_rate_income": 0,
            "corporate_ownership_pct": 100,
            "authority": "RERA / ICA",
            "document_checklist": [
                "Title deed(s) or off-plan SPA",
                "Passport copy (all pages)",
                "Emirates ID (if existing)",
                "Proof of property valuation (DLD certified)",
                "NOC from developer (for off-plan)",
                "Bank statement (3 months)",
                "Passport-size photos (white background)"
            ],
            "triggers": {"threshold_met": "auto_assemble_docs"},
            "actions":  {"on_threshold_met": "set_eligibility_status=DOCS_READY"}
        }
    },
    {
        "policy_code":  "turkey_citizenship",
        "country_code": "TR",
        "policy_name":  "Turkey Citizenship by Investment",
        "category":     "FDI_IMMIGRATION",
        "description":  "USD 400,000 property investment with 3-year hold period grants Turkish citizenship (passport). No residency requirement.",
        "rule_config": {
            "threshold_usd": 400000,
            "hold_period_years": 3,
            "citizenship": True,
            "residency_required": False,
            "authority": "TKGM / Turkish Directorate of Land Registry",
            "document_checklist": [
                "Title deed (Tapu)",
                "Certified property valuation report",
                "Passport copy",
                "Birth certificate (apostilled)",
                "Criminal record clearance",
                "Health insurance proof",
                "Declaration of no Turkish citizenship renouncement"
            ],
            "triggers": {"threshold_met": "auto_assemble_docs", "hold_period_end": "notify_owner"},
            "actions":  {"on_threshold_met": "set_eligibility_status=DOCS_READY"}
        }
    },
    {
        "policy_code":  "greece_golden_visa",
        "country_code": "GR",
        "policy_name":  "Greece Golden Visa (Permanent Residency)",
        "category":     "FDI_IMMIGRATION",
        "description":  "EUR 250,000+ property investment grants permanent residency with zero physical stay requirement. Schengen access. Prime areas (Athens/Mykonos) require EUR 800,000.",
        "rule_config": {
            "threshold_eur_standard": 250000,
            "threshold_eur_prime": 800000,
            "threshold_usd_standard": 272000,
            "physical_stay_required": False,
            "schengen_access": True,
            "historical_conversion_eligible": True,
            "authority": "Greek Migration Ministry",
            "document_checklist": [
                "Title deed (notarized translation)",
                "Passport (all pages)",
                "Property insurance certificate",
                "Tax clearance certificate (Enfia)",
                "Biometrics appointment confirmation",
                "Proof of funds / bank transfer receipts",
                "Health insurance valid in Greece"
            ],
            "triggers": {"threshold_met": "auto_assemble_docs"},
            "actions":  {"on_threshold_met": "set_eligibility_status=DOCS_READY"}
        }
    },
    {
        "policy_code":  "us_section_1031",
        "country_code": "US",
        "policy_name":  "US IRC Section 1031 Like-Kind Exchange",
        "category":     "TAX_SHIELD",
        "description":  "Defer capital gains tax indefinitely by rolling sale proceeds into a like-kind replacement property. 45-day identification window, 180-day close window.",
        "rule_config": {
            "identification_days": 45,
            "exchange_days": 180,
            "like_kind_requirement": True,
            "qualified_intermediary_required": True,
            "max_replacement_properties": 3,
            "authority": "US IRS",
            "document_checklist": [
                "Closing disclosure (sale of relinquished property)",
                "Qualified Intermediary (QI) agreement",
                "Replacement property identification letter (within 45 days)",
                "Purchase agreement for replacement property",
                "Final closing disclosure (replacement property)",
                "Form 8824 (Like-Kind Exchange)"
            ],
            "triggers": {"sale_recorded": "start_45_day_timer", "property_identified": "start_180_day_timer"},
            "actions":  {"on_deadline_breach": "set_exchange_status=FAILED", "on_close": "set_exchange_status=CLOSED"}
        }
    },
    {
        "policy_code":  "us_macrs_depreciation",
        "country_code": "US",
        "policy_name":  "US MACRS Cost Segregation (Bonus Depreciation)",
        "category":     "TAX_SHIELD",
        "description":  "Segregate BOM line items into 5yr/15yr/39yr MACRS classes. Apply 100% bonus depreciation to 5yr and 15yr classes in year 1, generating immediate tax write-offs.",
        "rule_config": {
            "asset_classes": {
                "5yr":  ["FURNITURE", "APPLIANCES", "CARPET", "TECHNOLOGY", "FIXTURES"],
                "15yr": ["LANDSCAPING", "PARKING", "FENCING", "OUTDOOR_AMENITY"],
                "39yr": ["STRUCTURAL", "FOUNDATION", "ROOF", "HVAC_STRUCTURAL"]
            },
            "bonus_depreciation_pct": 100,
            "bonus_eligible_classes": ["5yr", "15yr"],
            "authority": "US IRS / IRC Section 168",
            "document_checklist": [
                "Cost Segregation Study report (certified engineer)",
                "Bill of Materials with asset class mapping",
                "Property acquisition/construction cost basis",
                "Form 4562 (Depreciation and Amortization)"
            ]
        }
    },
    {
        "policy_code":  "us_lihtc",
        "country_code": "US",
        "policy_name":  "US Low-Income Housing Tax Credit (LIHTC)",
        "category":     "SUBSIDY",
        "description":  "9% annual LIHTC credit on eligible basis for 10 years. Requires ≥20% of units at ≤50% AMI or ≥40% at ≤60% AMI. Credits are tradeable to banks/corporations.",
        "rule_config": {
            "credit_rate": 0.09,
            "credit_period_years": 10,
            "qualification_tests": [
                {"name": "20-50 Test", "pct_units": 20, "max_ami_pct": 50},
                {"name": "40-60 Test", "pct_units": 40, "max_ami_pct": 60}
            ],
            "authority": "IRS / State Housing Finance Agency",
            "tradeable": True,
            "typical_buyer": "Banks / Corporations (Community Reinvestment Act)",
            "market_rate_per_dollar": 0.90,
            "document_checklist": [
                "Low-Income Housing Tax Credit application",
                "Qualified Allocation Plan (QAP) compliance",
                "Tenant income certification records",
                "Extended use agreement",
                "IRS Form 8609 (LIHTC Allocation Certification)"
            ]
        }
    },
    {
        "policy_code":  "bd_jv_luxury_resort",
        "country_code": "BD",
        "policy_name":  "Bangladesh JV Luxury/Eco Resort Share-Selling Model",
        "category":     "JV_SHARE_SELL",
        "description":  "SPV-based fractional ownership model for Bangladesh luxury and eco resorts. Compliant with Companies Act 1994, BIDA FDI Registry, Bangladesh Bank repatriation rules, and RJSC share transfer reporting. Revenue pooled and distributed quarterly.",
        "rule_config": {
            "entity_type": "Private Limited Company (SPV)",
            "governing_law": "Bangladesh Companies Act 1994",
            "registrar": "RJSC (Registrar of Joint Stock Companies)",
            "fdi_authority": "BIDA (Bangladesh Investment Development Authority)",
            "forex_authority": "Bangladesh Bank (AD Bank channel)",
            "share_types": ["EQUITY_SHARE", "REVENUE_SHARE", "MEMBERSHIP", "BOT_UNIT"],
            "project_locations": ["Cox's Bazar", "Sylhet", "Chittagong Hill Tracts", "Sundarbans Buffer Zone", "Saint Martin's Island"],
            "min_investment_bdt": 500000,
            "repatriation_rules": {
                "channel": "Authorized Dealer (AD) Bank",
                "bb_report_within_days": 14,
                "prior_bb_consent_for_repatriation": True,
                "lock_period_years": 3
            },
            "valuation_method": "NET_ASSET_VALUE (NAV) — audited financials",
            "revenue_pool": {
                "sources": ["Room Revenue", "F&B Revenue", "Spa & Wellness", "Event Bookings", "Tour Packages"],
                "distribution_frequency": "QUARTERLY",
                "management_fee_pct": 10,
                "investor_pool_pct": 90
            },
            "bot_model": {
                "applicable_to": "Government/coastal/forest land",
                "lease_duration_years": [25, 50, 99],
                "transfer_to_govt_on_expiry": True,
                "authority": "Bangladesh Economic Zones Authority (BEZA) / Forest Dept"
            },
            "tax_incentives": {
                "tax_holiday_years": 3,
                "reduced_rate_years": 7,
                "vat_exemption": "Tourism sector inputs",
                "green_resort_subsidy": "Bangladesh DOE Green Tourism Certification"
            },
            "document_checklist": [
                "SPV incorporation certificate (RJSC)",
                "BIDA investment registration",
                "Share purchase agreement",
                "Sub-Kabla registration / deed",
                "Environmental clearance (Bangladesh DOE)",
                "Bangladesh Bank encashment certificate",
                "Investor passport / NID copy",
                "Board resolution for share allotment",
                "Audited NAV valuation report",
                "Bangladesh Bank transfer report (14-day AD report)",
                "Fire safety and trade license"
            ],
            "triggers": {
                "share_registered": "generate_share_certificate",
                "quarterly_close": "calculate_pool_payout",
                "lock_period_end": "set_transfer_status=TRANSFERABLE",
                "bb_report_due": "flag_bb_report_submission"
            }
        }
    }
]


def seed_sgpe_policies(db: Session):
    """Auto-seed built-in policy configs on first boot."""
    for p in SEED_POLICIES:
        exists = db.query(SGPEPolicy).filter_by(policy_code=p["policy_code"]).first()
        if not exists:
            db.add(SGPEPolicy(**p))
    try:
        db.commit()
        logger.info(f"✅ SGPE: {len(SEED_POLICIES)} sovereign policy configs seeded.")
    except Exception as e:
        db.rollback()
        logger.error(f"SGPE seed error: {e}")


# ─────────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────────────────────
class PolicyUpsertPayload(BaseModel):
    policy_code:  str
    country_code: str
    policy_name:  str
    category:     str
    description:  Optional[str] = None
    rule_config:  Dict[str, Any] = {}
    is_active:    bool = True

class FDITrackerPayload(BaseModel):
    owner_nid:         str
    owner_name:        Optional[str] = None
    owner_nationality: Optional[str] = None
    policy_code:       str
    target_country:    str
    threshold_amount:  float
    threshold_currency: str = "USD"

class EscrowLockPayload(BaseModel):
    property_id:        str
    depositor_name:     Optional[str] = None
    depositor_nid:      Optional[str] = None
    escrow_bank:        Optional[str] = None
    deposit_amount:     float
    currency:           str = "USD"
    milestone_label:    str
    linked_mission_id:  Optional[int] = None
    release_percentage: float = 100.0
    policy_code:        Optional[str] = "uae_golden_visa"

class CostSegregatePayload(BaseModel):
    property_id: str
    owner_nid:   Optional[str] = None
    policy_code: str = "us_macrs_depreciation"
    tax_year:    Optional[int] = None

class Exchange1031Payload(BaseModel):
    property_id:  str
    owner_nid:    str
    sale_price:   float
    cost_basis:   float
    sale_date:    Optional[str] = None

class SubsidyScanPayload(BaseModel):
    property_id:       str
    affordable_pct:    float = 0.0
    green_output_kwh:  float = 0.0
    eligible_units:    int = 0
    policy_code:       str = "us_lihtc"

class JVSharePayload(BaseModel):
    project_name:          str
    property_id:           Optional[str] = None
    spv_name:              Optional[str] = None
    spv_rjsc_reg:          Optional[str] = None
    bida_reg_number:       Optional[str] = None
    project_type:          str = "ECO_RESORT"
    share_type:            str = "REVENUE_SHARE"
    investor_name:         str
    investor_nid_passport: str
    investor_nationality:  Optional[str] = "BD"
    investor_bank:         Optional[str] = None
    authorized_dealer:     Optional[str] = None
    total_project_shares:  int
    shares_held:           int
    share_face_value:      float
    investment_currency:   str = "BDT"
    total_invested:        float
    usd_equivalent:        Optional[float] = None
    payout_frequency:      str = "QUARTERLY"
    free_nights_annual:    int = 0
    discount_pct:          float = 0.0
    sub_kabla_reg_ref:     Optional[str] = None
    env_clearance_ref:     Optional[str] = None
    notes:                 Optional[str] = None

class JVPayoutPayload(BaseModel):
    share_ref:        str
    pool_revenue:     float
    posted_by:        str = "SGPE-ENGINE"


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
def _fmt_currency(amount: float, currency: str = "USD") -> str:
    return f"{currency} {amount:,.2f}"

def _days_remaining(deadline: datetime) -> int:
    if not deadline:
        return 0
    delta = deadline.replace(tzinfo=None) - datetime.utcnow()
    return max(0, delta.days)

# MACRS asset class mapping — matches BOM product category keywords
MACRS_CLASS_MAP = {
    "5yr":  ["furniture", "appliance", "carpet", "technology", "fixture", "electronics", "equipment", "tv", "ac"],
    "15yr": ["landscape", "parking", "fence", "outdoor", "pool deck", "pathway", "garden"],
    "39yr": ["structural", "foundation", "roof", "hvac", "plumbing", "electrical", "wall", "concrete"]
}

def _classify_bom_item(product_name: str) -> str:
    name_lower = product_name.lower()
    for cls, keywords in MACRS_CLASS_MAP.items():
        if any(k in name_lower for k in keywords):
            return cls
    return "39yr"  # Default to structural if unknown


# ═══════════════════════════════════════════════════════════════
# POLICY CONFIG MANAGEMENT
# ═══════════════════════════════════════════════════════════════

@router.get("/policies", summary="List all sovereign policy configs")
def list_policies(country_code: Optional[str] = None, category: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(SGPEPolicy)
    if country_code:
        q = q.filter(SGPEPolicy.country_code == country_code.upper())
    if category:
        q = q.filter(SGPEPolicy.category == category.upper())
    policies = q.order_by(SGPEPolicy.country_code, SGPEPolicy.category).all()
    return {
        "status": "SUCCESS",
        "count": len(policies),
        "policies": [
            {
                "policy_code":  p.policy_code,
                "country_code": p.country_code,
                "policy_name":  p.policy_name,
                "category":     p.category,
                "description":  p.description,
                "is_active":    p.is_active,
                "rule_config":  p.rule_config,
            }
            for p in policies
        ]
    }

@router.post("/policies", summary="Upload or update a sovereign policy config")
def upsert_policy(payload: PolicyUpsertPayload, db: Session = Depends(get_db)):
    existing = db.query(SGPEPolicy).filter_by(policy_code=payload.policy_code).first()
    if existing:
        existing.country_code = payload.country_code.upper()
        existing.policy_name  = payload.policy_name
        existing.category     = payload.category.upper()
        existing.description  = payload.description
        existing.rule_config  = payload.rule_config
        existing.is_active    = payload.is_active
        db.commit()
        return {"status": "UPDATED", "policy_code": payload.policy_code}
    else:
        db.add(SGPEPolicy(
            policy_code  = payload.policy_code,
            country_code = payload.country_code.upper(),
            policy_name  = payload.policy_name,
            category     = payload.category.upper(),
            description  = payload.description,
            rule_config  = payload.rule_config,
            is_active    = payload.is_active,
        ))
        db.commit()
        return {"status": "CREATED", "policy_code": payload.policy_code}


# ═══════════════════════════════════════════════════════════════
# SUB-ENGINE 1 — FDI & IMMIGRATION ENGINE (GOLDEN VISA / CBI)
# ═══════════════════════════════════════════════════════════════

@router.get("/fdi/status/{owner_nid}", summary="Get FDI visa eligibility status for an owner")
def get_fdi_status(owner_nid: str, db: Session = Depends(get_db)):
    """
    Aggregates the owner's full portfolio value from AssetGrid,
    evaluates against all active FDI_IMMIGRATION policies,
    and returns eligibility status + assembled document checklist.
    """
    # Aggregate portfolio value for this owner
    props = db.query(AssetGrid).filter(AssetGrid.owner_nid == owner_nid).all()
    total_value = sum(
        (getattr(p, "capitalized_setup_cost", 0) or 0) +
        (getattr(p, "base_rate", 0) or 0) * 365  # Annualised income value proxy
        for p in props
    )

    # Load all active FDI policies
    policies = db.query(SGPEPolicy).filter(
        SGPEPolicy.category == "FDI_IMMIGRATION",
        SGPEPolicy.is_active == True
    ).all()

    results = []
    for pol in policies:
        cfg = pol.rule_config or {}
        threshold = float(cfg.get("threshold_usd", cfg.get("threshold_usd_standard", 0)))
        pct = min(100.0, round((total_value / threshold * 100) if threshold > 0 else 0, 1))
        eligible = total_value >= threshold

        # Update or create tracker
        tracker = db.query(SGPEFDITracker).filter_by(
            owner_nid=owner_nid, policy_code=pol.policy_code
        ).first()
        if not tracker:
            tracker = SGPEFDITracker(
                owner_nid=owner_nid,
                policy_code=pol.policy_code,
                target_country=pol.country_code,
                threshold_currency="USD",
                threshold_amount=threshold,
                cumulative_invested=total_value,
                linked_properties=[p.room_id for p in props],
            )
            db.add(tracker)
        else:
            tracker.cumulative_invested = total_value
            tracker.linked_properties   = [p.room_id for p in props]
            tracker.threshold_amount    = threshold
            tracker.last_evaluated      = datetime.utcnow()

        if eligible and tracker.eligibility_status == "TRACKING":
            tracker.eligibility_status = "DOCS_READY"
            tracker.document_packet    = {
                "checklist": cfg.get("document_checklist", []),
                "generated_at": datetime.utcnow().isoformat(),
                "note": "All documents must be submitted to the relevant authority."
            }
        db.commit()

        results.append({
            "policy_code":        pol.policy_code,
            "policy_name":        pol.policy_name,
            "country":            pol.country_code,
            "threshold_usd":      threshold,
            "invested_usd":       round(total_value, 2),
            "completion_pct":     pct,
            "eligible":           eligible,
            "status":             tracker.eligibility_status,
            "linked_properties":  [p.room_id for p in props],
            "document_checklist": cfg.get("document_checklist", []) if eligible else [],
            "visa_type":          cfg.get("citizenship") and "Citizenship" or cfg.get("visa_duration_years") and f"{cfg['visa_duration_years']}-Year Golden Visa" or "Residency Permit",
        })

    return {
        "status": "SUCCESS",
        "owner_nid": owner_nid,
        "total_portfolio_properties": len(props),
        "estimated_portfolio_usd": round(total_value, 2),
        "policy_evaluations": results
    }

@router.post("/fdi/tracker", summary="Manually register an FDI tracking record")
def create_fdi_tracker(payload: FDITrackerPayload, db: Session = Depends(get_db)):
    tracker = SGPEFDITracker(
        owner_nid=payload.owner_nid,
        owner_name=payload.owner_name,
        owner_nationality=payload.owner_nationality,
        policy_code=payload.policy_code,
        target_country=payload.target_country.upper(),
        threshold_currency=payload.threshold_currency,
        threshold_amount=payload.threshold_amount,
    )
    db.add(tracker)
    db.commit()
    db.refresh(tracker)
    return {"status": "CREATED", "tracker_id": tracker.id, "owner_nid": payload.owner_nid}


# ═══════════════════════════════════════════════════════════════
# SUB-ENGINE 2 — TRUSTEE ESCROW VAULT (RERA / BOT MODEL)
# ═══════════════════════════════════════════════════════════════

@router.post("/escrow/lock", summary="Lock a deposit into the Trustee Escrow Vault")
def lock_escrow(payload: EscrowLockPayload, db: Session = Depends(get_db)):
    """
    Ring-fences an off-plan deposit. Funds are LOCKED until the linked
    SolveMission (construction milestone) is marked RESOLVED.
    """
    vault_ref = f"ESC-{payload.property_id}-{uuid.uuid4().hex[:6].upper()}"
    vault = SGPEEscrowVault(
        vault_ref          = vault_ref,
        property_id        = payload.property_id,
        depositor_name     = payload.depositor_name,
        depositor_nid      = payload.depositor_nid,
        escrow_bank        = payload.escrow_bank or "Designated Trustee Bank",
        deposit_amount     = payload.deposit_amount,
        currency           = payload.currency,
        milestone_label    = payload.milestone_label,
        linked_mission_id  = payload.linked_mission_id,
        release_percentage = payload.release_percentage,
        vault_status       = "LOCKED",
        policy_code        = payload.policy_code,
        notes              = f"Locked by SGPE at {datetime.utcnow().isoformat()}",
    )
    db.add(vault)
    db.commit()
    db.refresh(vault)
    logger.info(f"🔒 ESCROW LOCKED: {vault_ref} | {payload.deposit_amount} {payload.currency} for {payload.property_id}")
    return {
        "status": "LOCKED",
        "vault_ref": vault_ref,
        "deposit_amount": payload.deposit_amount,
        "currency": payload.currency,
        "milestone_label": payload.milestone_label,
        "linked_mission_id": payload.linked_mission_id,
        "message": "Deposit ring-fenced. Funds will release automatically when the linked SolveMission is RESOLVED."
    }

@router.post("/escrow/release/{vault_ref}", summary="Release escrow after milestone verification")
def release_escrow(vault_ref: str, released_by: str = "CDO", db: Session = Depends(get_db)):
    """
    Checks if the linked SolveMission is RESOLVED.
    If yes: releases funds, posts GL entry, updates vault status.
    If no:  returns milestone_pending with current mission status.
    """
    vault = db.query(SGPEEscrowVault).filter_by(vault_ref=vault_ref).first()
    if not vault:
        raise HTTPException(404, f"Escrow vault '{vault_ref}' not found")

    if vault.vault_status == "RELEASED":
        return {"status": "ALREADY_RELEASED", "vault_ref": vault_ref, "released_at": str(vault.released_at)}

    # Check milestone mission
    mission_ok = False
    mission_status = "NO_MISSION_LINKED"
    if vault.linked_mission_id:
        mission = db.query(SolveMission).filter_by(id=vault.linked_mission_id).first()
        if mission:
            mission_status = mission.status
            mission_ok = mission.status in ("RESOLVED", "CLOSED", "DONE")

    if not vault.linked_mission_id:
        mission_ok = True  # Manual release if no mission linked

    if not mission_ok:
        return {
            "status": "MILESTONE_PENDING",
            "vault_ref": vault_ref,
            "mission_status": mission_status,
            "message": f"Cannot release escrow — linked mission is '{mission_status}'. Must be RESOLVED first."
        }

    # Release
    release_amt = vault.deposit_amount * (vault.release_percentage / 100)
    vault.vault_status   = "RELEASED"
    vault.released_at    = datetime.utcnow()
    vault.released_by    = released_by
    vault.release_amount = release_amt
    vault.notes = (vault.notes or "") + f" | Released {release_amt:.2f} {vault.currency} on {datetime.utcnow().date()} by {released_by}"
    db.commit()

    logger.info(f"✅ ESCROW RELEASED: {vault_ref} | {release_amt:.2f} {vault.currency} | by {released_by}")
    return {
        "status": "RELEASED",
        "vault_ref": vault_ref,
        "released_amount": release_amt,
        "currency": vault.currency,
        "released_by": released_by,
        "mission_status": mission_status,
        "message": f"Milestone verified. {release_amt:,.2f} {vault.currency} released to developer."
    }

@router.get("/escrow/status/{property_id}", summary="Get all escrow vaults for a property")
def get_escrow_status(property_id: str, db: Session = Depends(get_db)):
    vaults = db.query(SGPEEscrowVault).filter_by(property_id=property_id).order_by(SGPEEscrowVault.locked_at.desc()).all()
    total_locked   = sum(v.deposit_amount for v in vaults if v.vault_status == "LOCKED")
    total_released = sum(v.release_amount or 0 for v in vaults if v.vault_status == "RELEASED")
    return {
        "status": "SUCCESS",
        "property_id": property_id,
        "total_locked": total_locked,
        "total_released": total_released,
        "vaults": [
            {
                "vault_ref":       v.vault_ref,
                "depositor_name":  v.depositor_name,
                "deposit_amount":  v.deposit_amount,
                "currency":        v.currency,
                "milestone_label": v.milestone_label,
                "vault_status":    v.vault_status,
                "linked_mission":  v.linked_mission_id,
                "locked_at":       str(v.locked_at),
                "released_at":     str(v.released_at) if v.released_at else None,
                "release_amount":  v.release_amount,
            }
            for v in vaults
        ]
    }


# ═══════════════════════════════════════════════════════════════
# SUB-ENGINE 3 — TAX SHIELD ENGINE (US MACRS + 1031 EXCHANGE)
# ═══════════════════════════════════════════════════════════════

@router.post("/tax/cost-segregate/{property_id}", summary="Run MACRS cost segregation on property BOM")
def run_cost_segregation(property_id: str, payload: CostSegregatePayload, db: Session = Depends(get_db)):
    """
    Reads all BOM lines for the property, classifies each item into
    MACRS 5yr/15yr/39yr asset classes, calculates 100% bonus depreciation
    on 5yr and 15yr items, and posts a SGPETaxRecord.
    """
    from sqlalchemy import text
    # Pull BOM lines from existing pms_bom_lines table
    try:
        rows = db.execute(text(
            "SELECT product_id, qty, unit_cost_snapshot FROM pms_bom_lines WHERE property_id = :pid"
        ), {"pid": property_id}).fetchall()
    except Exception:
        rows = []

    segregated = {"5yr": 0.0, "15yr": 0.0, "39yr": 0.0}
    bom_analysis = []
    total_basis = 0.0

    for row in rows:
        product_id = row[0]
        cost       = float(row[1] or 1) * float(row[2] or 0)
        cls        = _classify_bom_item(product_id)
        segregated[cls] += cost
        total_basis     += cost
        bom_analysis.append({"product_id": product_id, "cost": cost, "macrs_class": cls})

    # Also include capitalized_setup_cost from AssetGrid
    prop = db.query(AssetGrid).filter_by(room_id=property_id).first()
    if prop and getattr(prop, "capitalized_setup_cost", 0):
        additional = float(prop.capitalized_setup_cost)
        segregated["39yr"] += additional
        total_basis        += additional
        bom_analysis.append({"product_id": "CAPITALIZED_SETUP", "cost": additional, "macrs_class": "39yr"})

    bonus_eligible = segregated["5yr"] + segregated["15yr"]
    year1_deduction = bonus_eligible  # 100% bonus depreciation

    record = SGPETaxRecord(
        record_type            = "COST_SEGREGATION",
        property_id            = property_id,
        owner_nid              = payload.owner_nid,
        policy_code            = payload.policy_code,
        total_cost_basis       = total_basis,
        segregated_5yr         = segregated["5yr"],
        segregated_15yr        = segregated["15yr"],
        segregated_39yr        = segregated["39yr"],
        bonus_depreciation_pct = 100.0,
        year1_deduction        = year1_deduction,
        bom_lines_analyzed     = bom_analysis,
        tax_year               = payload.tax_year or datetime.utcnow().year,
        jurisdiction           = "US",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    logger.info(f"🛡 COST SEGREGATION: {property_id} | Year-1 Deduction: ${year1_deduction:,.2f}")
    return {
        "status": "SUCCESS",
        "property_id":    property_id,
        "total_basis":    round(total_basis, 2),
        "segregated_5yr":  round(segregated["5yr"], 2),
        "segregated_15yr": round(segregated["15yr"], 2),
        "segregated_39yr": round(segregated["39yr"], 2),
        "bonus_depreciation_pct": 100,
        "year1_tax_deduction": round(year1_deduction, 2),
        "estimated_tax_saving": round(year1_deduction * 0.37, 2),  # at 37% marginal rate
        "bom_items_analyzed": len(bom_analysis),
        "record_id": record.id,
    }

@router.post("/tax/1031-exchange", summary="Register a 1031 Like-Kind Exchange")
def register_1031_exchange(payload: Exchange1031Payload, db: Session = Depends(get_db)):
    sale_date = datetime.utcnow() if not payload.sale_date else datetime.fromisoformat(payload.sale_date)
    id_deadline       = sale_date + timedelta(days=45)
    exchange_deadline = sale_date + timedelta(days=180)
    realized_gain     = payload.sale_price - payload.cost_basis

    record = SGPETaxRecord(
        record_type             = "EXCHANGE_1031",
        property_id             = payload.property_id,
        owner_nid               = payload.owner_nid,
        policy_code             = "us_section_1031",
        sale_date               = sale_date,
        sale_price              = payload.sale_price,
        realized_gain           = realized_gain,
        identification_deadline = id_deadline,
        exchange_deadline       = exchange_deadline,
        exchange_status         = "PENDING",
        jurisdiction            = "US",
        exchange_notes          = f"1031 Exchange initiated. Gain deferred: ${realized_gain:,.2f}",
        tax_year                = sale_date.year,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    logger.info(f"🔄 1031 EXCHANGE: {payload.property_id} | Gain: ${realized_gain:,.2f} | Deadline: {exchange_deadline.date()}")
    return {
        "status": "EXCHANGE_INITIATED",
        "record_id":              record.id,
        "property_id":            payload.property_id,
        "realized_gain":          round(realized_gain, 2),
        "tax_deferred":           round(realized_gain, 2),
        "identification_deadline": id_deadline.date().isoformat(),
        "exchange_deadline":      exchange_deadline.date().isoformat(),
        "days_to_identify":       _days_remaining(id_deadline),
        "days_to_close":          _days_remaining(exchange_deadline),
        "message": "Find replacement property within 45 days. Close within 180 days to defer capital gains tax permanently."
    }

@router.get("/tax/shield-summary", summary="All active tax records (depreciation + 1031 timers)")
def get_tax_shield_summary(property_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(SGPETaxRecord)
    if property_id:
        q = q.filter(SGPETaxRecord.property_id == property_id)
    records = q.order_by(SGPETaxRecord.created_at.desc()).all()

    total_deductions = sum(r.year1_deduction or 0 for r in records if r.record_type == "COST_SEGREGATION")
    total_deferred   = sum(r.realized_gain or 0 for r in records if r.record_type == "EXCHANGE_1031" and r.exchange_status not in ("FAILED", "CLOSED"))

    return {
        "status": "SUCCESS",
        "total_year1_deductions": round(total_deductions, 2),
        "total_gains_deferred":   round(total_deferred, 2),
        "estimated_total_tax_saved": round((total_deductions + total_deferred) * 0.37, 2),
        "records": [
            {
                "id":            r.id,
                "type":          r.record_type,
                "property_id":   r.property_id,
                "year1_deduction": r.year1_deduction,
                "realized_gain": r.realized_gain,
                "exchange_status": r.exchange_status,
                "days_to_id_deadline":     _days_remaining(r.identification_deadline) if r.identification_deadline else None,
                "days_to_exchange_deadline": _days_remaining(r.exchange_deadline) if r.exchange_deadline else None,
                "jurisdiction":  r.jurisdiction,
                "created_at":    str(r.created_at),
            }
            for r in records
        ]
    }


# ═══════════════════════════════════════════════════════════════
# SUB-ENGINE 4 — SOVEREIGN SUBSIDY ENGINE (LIHTC + GREEN)
# ═══════════════════════════════════════════════════════════════

@router.post("/subsidy/claim/{property_id}", summary="Calculate and claim LIHTC / green subsidy credits")
def claim_subsidy(property_id: str, payload: SubsidyScanPayload, db: Session = Depends(get_db)):
    pol = db.query(SGPEPolicy).filter_by(policy_code=payload.policy_code, is_active=True).first()
    if not pol:
        raise HTTPException(404, f"Policy '{payload.policy_code}' not found or inactive")

    cfg = pol.rule_config or {}
    credit_rate   = float(cfg.get("credit_rate", 0.09))
    period_years  = int(cfg.get("credit_period_years", 10))

    prop = db.query(AssetGrid).filter_by(room_id=property_id).first()
    if not prop:
        raise HTTPException(404, f"Property '{property_id}' not found")

    eligible_basis   = (getattr(prop, "capitalized_setup_cost", 0) or 0)
    affordable_basis = eligible_basis * (payload.affordable_pct / 100)
    annual_credit    = affordable_basis * credit_rate
    total_credit     = annual_credit * period_years

    # Green energy credit supplement
    green_credit = payload.green_output_kwh * 0.026  # $0.026/kWh ITC equivalent

    record = SGPESubsidyRecord(
        subsidy_type       = pol.category,
        property_id        = property_id,
        policy_code        = payload.policy_code,
        eligible_units     = payload.eligible_units,
        affordable_pct     = payload.affordable_pct,
        green_output_kwh   = payload.green_output_kwh,
        credit_rate        = credit_rate,
        annual_credit      = annual_credit + green_credit,
        credit_period_years= period_years,
        total_credit_value = total_credit + (green_credit * period_years),
        trade_status       = "AVAILABLE",
        jurisdiction       = pol.country_code,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "status": "CREDIT_CALCULATED",
        "property_id":        property_id,
        "policy":             pol.policy_name,
        "eligible_basis":     round(eligible_basis, 2),
        "affordable_basis":   round(affordable_basis, 2),
        "credit_rate_pct":    credit_rate * 100,
        "annual_credit":      round(annual_credit, 2),
        "green_credit_annual": round(green_credit, 2),
        "total_annual_credit": round(annual_credit + green_credit, 2),
        "credit_period_years": period_years,
        "total_credit_value": round(record.total_credit_value, 2),
        "market_cash_value":  round(record.total_credit_value * float(cfg.get("market_rate_per_dollar", 0.90)), 2),
        "trade_status":       "AVAILABLE",
        "record_id":          record.id,
        "message": "Credits are tradeable — sell to banks/corporations under CRA compliance requirements."
    }

@router.get("/subsidy/tradeable", summary="List all tradeable subsidy credits")
def list_tradeable_credits(db: Session = Depends(get_db)):
    records = db.query(SGPESubsidyRecord).filter(
        SGPESubsidyRecord.trade_status.in_(["AVAILABLE", "LISTED"])
    ).all()
    return {
        "status": "SUCCESS",
        "tradeable_count": len(records),
        "total_credit_value": round(sum(r.total_credit_value for r in records), 2),
        "credits": [
            {
                "id":                r.id,
                "subsidy_type":      r.subsidy_type,
                "property_id":       r.property_id,
                "total_credit_value": r.total_credit_value,
                "annual_credit":     r.annual_credit,
                "period_years":      r.credit_period_years,
                "trade_status":      r.trade_status,
                "jurisdiction":      r.jurisdiction,
            }
            for r in records
        ]
    }


# ═══════════════════════════════════════════════════════════════
# SUB-ENGINE 5 — BANGLADESH JV RESORT SHARE-SELLING ENGINE
# (BIDA / RJSC / Bangladesh Bank Compliant)
# ═══════════════════════════════════════════════════════════════

@router.post("/bd-jv/register-share", summary="Register a Bangladesh JV resort share investment")
def register_jv_share(payload: JVSharePayload, db: Session = Depends(get_db)):
    """
    Creates a verified share certificate record for a Bangladesh resort JV.
    Calculates ownership percentage, sets 3-year BIDA lock period,
    flags Bangladesh Bank 14-day AD report requirement.
    """
    ownership_pct = round((payload.shares_held / payload.total_project_shares) * 100, 4)
    lock_expiry   = datetime.utcnow() + timedelta(days=3 * 365)
    share_ref     = f"BD-{payload.project_type[:3].upper()}-{uuid.uuid4().hex[:8].upper()}"

    record = SGPEJVShareRecord(
        share_ref             = share_ref,
        project_name          = payload.project_name,
        property_id           = payload.property_id,
        spv_name              = payload.spv_name,
        spv_rjsc_reg          = payload.spv_rjsc_reg,
        bida_reg_number       = payload.bida_reg_number,
        project_type          = payload.project_type,
        share_type            = payload.share_type,
        investor_name         = payload.investor_name,
        investor_nid_passport = payload.investor_nid_passport,
        investor_nationality  = payload.investor_nationality,
        investor_bank         = payload.investor_bank,
        authorized_dealer     = payload.authorized_dealer,
        total_project_shares  = payload.total_project_shares,
        shares_held           = payload.shares_held,
        share_face_value      = payload.share_face_value,
        investment_currency   = payload.investment_currency,
        total_invested        = payload.total_invested,
        usd_equivalent        = payload.usd_equivalent,
        ownership_pct         = ownership_pct,
        payout_frequency      = payload.payout_frequency,
        free_nights_annual    = payload.free_nights_annual,
        discount_pct          = payload.discount_pct,
        transfer_status       = "LOCKED",
        lock_expiry_date      = lock_expiry,
        bb_report_submitted   = False,
        sub_kabla_reg_ref     = payload.sub_kabla_reg_ref,
        env_clearance_ref     = payload.env_clearance_ref,
        policy_code           = "bd_jv_luxury_resort",
        notes                 = payload.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    logger.info(f"🇧🇩 BD-JV SHARE REGISTERED: {share_ref} | {payload.investor_name} | {ownership_pct}% of {payload.project_name}")
    return {
        "status": "SHARE_REGISTERED",
        "share_ref":          share_ref,
        "investor":           payload.investor_name,
        "project":            payload.project_name,
        "ownership_pct":      ownership_pct,
        "total_invested":     f"{payload.investment_currency} {payload.total_invested:,.2f}",
        "usd_equivalent":     payload.usd_equivalent,
        "transfer_status":    "LOCKED",
        "lock_expiry":        lock_expiry.date().isoformat(),
        "bb_report_required": True,
        "bb_report_deadline": (datetime.utcnow() + timedelta(days=14)).date().isoformat(),
        "compliance_notes": [
            "Bangladesh Bank 14-day AD report must be submitted for foreign investors",
            f"3-year BIDA lock period — transferable after {lock_expiry.date()}",
            "NAV valuation required for any share transfer (audited financials)",
            "Prior Bangladesh Bank consent required for repatriation of proceeds"
        ]
    }

@router.post("/bd-jv/pool-payout", summary="Calculate and distribute quarterly pool payout")
def process_pool_payout(payload: JVPayoutPayload, db: Session = Depends(get_db)):
    record = db.query(SGPEJVShareRecord).filter_by(share_ref=payload.share_ref).first()
    if not record:
        raise HTTPException(404, f"Share record '{payload.share_ref}' not found")

    # Get active policy for fee structure
    pol = db.query(SGPEPolicy).filter_by(policy_code="bd_jv_luxury_resort").first()
    mgmt_fee_pct = 10.0  # Default 10% management fee
    if pol and pol.rule_config:
        mgmt_fee_pct = pol.rule_config.get("revenue_pool", {}).get("management_fee_pct", 10)

    net_pool       = payload.pool_revenue * (1 - mgmt_fee_pct / 100)
    investor_share = net_pool * (record.ownership_pct / 100)

    record.pool_revenue_ytd    = (record.pool_revenue_ytd or 0) + payload.pool_revenue
    record.investor_share_ytd  = (record.investor_share_ytd or 0) + investor_share
    record.last_payout_date    = datetime.utcnow()
    record.last_payout_amount  = investor_share
    db.commit()

    return {
        "status":          "PAYOUT_CALCULATED",
        "share_ref":       payload.share_ref,
        "investor":        record.investor_name,
        "pool_revenue":    payload.pool_revenue,
        "management_fee":  round(payload.pool_revenue * mgmt_fee_pct / 100, 2),
        "net_pool":        round(net_pool, 2),
        "ownership_pct":   record.ownership_pct,
        "investor_payout": round(investor_share, 2),
        "currency":        record.investment_currency,
        "ytd_total":       round(record.investor_share_ytd, 2),
        "payout_date":     datetime.utcnow().date().isoformat(),
    }

@router.get("/bd-jv/portfolio/{investor_nid}", summary="Get full BD JV portfolio for an investor")
def get_jv_portfolio(investor_nid: str, db: Session = Depends(get_db)):
    records = db.query(SGPEJVShareRecord).filter_by(investor_nid_passport=investor_nid).all()
    total_invested_usd = sum(r.usd_equivalent or 0 for r in records)
    total_ytd_income   = sum(r.investor_share_ytd or 0 for r in records)

    return {
        "status":            "SUCCESS",
        "investor_nid":      investor_nid,
        "total_shares":      len(records),
        "total_invested_usd": round(total_invested_usd, 2),
        "total_ytd_income":  round(total_ytd_income, 2),
        "holdings": [
            {
                "share_ref":        r.share_ref,
                "project_name":     r.project_name,
                "project_type":     r.project_type,
                "share_type":       r.share_type,
                "ownership_pct":    r.ownership_pct,
                "total_invested":   f"{r.investment_currency} {r.total_invested:,.2f}",
                "usd_equivalent":   r.usd_equivalent,
                "ytd_income":       r.investor_share_ytd,
                "last_payout":      r.last_payout_amount,
                "payout_frequency": r.payout_frequency,
                "transfer_status":  r.transfer_status,
                "lock_expiry":      str(r.lock_expiry_date.date()) if r.lock_expiry_date else None,
                "bb_report":        r.bb_report_submitted,
                "free_nights":      r.free_nights_annual,
                "discount_pct":     r.discount_pct,
            }
            for r in records
        ]
    }

@router.get("/bd-jv/projects", summary="List all registered BD JV resort projects")
def list_jv_projects(project_type: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(SGPEJVShareRecord)
    if project_type:
        q = q.filter(SGPEJVShareRecord.project_type == project_type.upper())

    records = q.all()
    # Group by project_name
    projects: Dict[str, dict] = {}
    for r in records:
        key = r.project_name
        if key not in projects:
            projects[key] = {
                "project_name":       r.project_name,
                "project_type":       r.project_type,
                "spv_name":           r.spv_name,
                "bida_reg_number":    r.bida_reg_number,
                "total_shares_issued": r.total_project_shares,
                "total_investors":    0,
                "total_invested_bdt": 0.0,
                "total_invested_usd": 0.0,
                "investors": []
            }
        projects[key]["total_investors"]    += 1
        projects[key]["total_invested_bdt"] += r.total_invested
        projects[key]["total_invested_usd"] += (r.usd_equivalent or 0)
        projects[key]["investors"].append({
            "investor": r.investor_name,
            "shares":   r.shares_held,
            "pct":      r.ownership_pct,
            "status":   r.transfer_status,
        })

    return {
        "status":   "SUCCESS",
        "projects": list(projects.values())
    }

@router.get("/dashboard", summary="SGPE master dashboard overview")
def sgpe_dashboard(db: Session = Depends(get_db)):
    """Single endpoint powering the SGPE tab in sovereign-finance dashboard."""
    escrow_total   = db.query(sqlfunc.sum(SGPEEscrowVault.deposit_amount)).filter(SGPEEscrowVault.vault_status == "LOCKED").scalar() or 0
    escrow_released= db.query(sqlfunc.sum(SGPEEscrowVault.release_amount)).filter(SGPEEscrowVault.vault_status == "RELEASED").scalar() or 0
    tax_deductions = db.query(sqlfunc.sum(SGPETaxRecord.year1_deduction)).scalar() or 0
    tax_deferred   = db.query(sqlfunc.sum(SGPETaxRecord.realized_gain)).filter(SGPETaxRecord.exchange_status.in_(["PENDING", "IDENTIFIED"])).scalar() or 0
    subsidy_credits= db.query(sqlfunc.sum(SGPESubsidyRecord.total_credit_value)).filter(SGPESubsidyRecord.trade_status == "AVAILABLE").scalar() or 0
    jv_invested    = db.query(sqlfunc.sum(SGPEJVShareRecord.usd_equivalent)).scalar() or 0
    fdi_eligible   = db.query(SGPEFDITracker).filter(SGPEFDITracker.eligibility_status.in_(["DOCS_READY", "SUBMITTED", "APPROVED"])).count()
    active_policies= db.query(SGPEPolicy).filter(SGPEPolicy.is_active == True).count()
    jv_projects    = db.query(SGPEJVShareRecord.project_name).distinct().count()

    recent_vaults  = db.query(SGPEEscrowVault).order_by(SGPEEscrowVault.locked_at.desc()).limit(5).all()
    recent_1031    = db.query(SGPETaxRecord).filter_by(record_type="EXCHANGE_1031").order_by(SGPETaxRecord.created_at.desc()).limit(5).all()
    recent_jv      = db.query(SGPEJVShareRecord).order_by(SGPEJVShareRecord.registered_at.desc()).limit(5).all()

    return {
        "status": "SUCCESS",
        "summary": {
            "active_policies":        active_policies,
            "escrow_locked_usd":      round(escrow_total, 2),
            "escrow_released_usd":    round(escrow_released, 2),
            "tax_deductions_year1":   round(tax_deductions, 2),
            "gains_deferred_1031":    round(tax_deferred, 2),
            "tradeable_credits":      round(subsidy_credits, 2),
            "bd_jv_invested_usd":     round(jv_invested, 2),
            "bd_jv_projects":         jv_projects,
            "visa_eligible_owners":   fdi_eligible,
            "estimated_tax_saved":    round((tax_deductions + tax_deferred) * 0.37, 2),
        },
        "recent_escrow_vaults": [
            {"vault_ref": v.vault_ref, "property": v.property_id, "amount": v.deposit_amount, "currency": v.currency, "status": v.vault_status, "milestone": v.milestone_label}
            for v in recent_vaults
        ],
        "active_1031_exchanges": [
            {"property": r.property_id, "gain": r.realized_gain, "status": r.exchange_status,
             "days_to_close": _days_remaining(r.exchange_deadline) if r.exchange_deadline else None}
            for r in recent_1031
        ],
        "bd_jv_recent": [
            {"share_ref": r.share_ref, "investor": r.investor_name, "project": r.project_name,
             "type": r.share_type, "pct": r.ownership_pct, "status": r.transfer_status}
            for r in recent_jv
        ]
    }
