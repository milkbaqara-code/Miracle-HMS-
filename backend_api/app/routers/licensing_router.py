# ============================================================
# MIRACLE OS — ZONE LICENSING ROUTER
# File: backend_api/app/routers/licensing_router.py
#
# ENDPOINTS:
#   GET  /api/licensing/package/{client_code}
#        → Returns allowed_zones for a client (production use)
#
#   POST /api/licensing/demo/register
#        → Registers a demo session for analytics tracking
#        → Package selector UI calls this (non-blocking, best-effort)
#
#   GET  /api/licensing/packages
#        → Returns public package catalog (mirrors packagePresets.ts)
#        → Called by Vigilant website to render package cards
#
# Auth: GET package lookup is public (client_code acts as key).
#       POST routes require X-Internal-Key header (optional guard).
# ============================================================

import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal

router = APIRouter()
logger = logging.getLogger("LICENSING-ROUTER")


# ─── DB SESSION DEP ──────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class DemoRegistration(BaseModel):
    package_id: str
    entity_name: str = "Demo Session"
    visitor_ip: str = ""
    browser_tag: str = ""


# ─── PUBLIC PACKAGE CATALOG (mirrors packagePresets.ts) ──────────────────────

PACKAGE_CATALOG = [
    {
        "id": "FB_SUITE",
        "name": "F&B Suite",
        "tagline": "Complete restaurant operating system",
        "icon": "🍽️",
        "color": "#FF6B35",
        "target_client": "Restaurant, café, bar, food court, canteen",
        "zones": [
            "Z-07", "Z-29", "Z-12", "Z-08",
            "Z-16", "Z-17", "Z-25", "Z-GUEST",
            "Z-VAULT", "Z-DEPT-GW",
        ],
    },
    {
        "id": "SPA_SUITE",
        "name": "Spa & Wellness Suite",
        "tagline": "Complete wellness center management",
        "icon": "🧬",
        "color": "#7C3AED",
        "target_client": "Spa, salon, wellness center, gym, clinic",
        "zones": [
            "Z-07", "Z-27", "Z-12", "Z-08",
            "Z-10", "Z-16", "Z-17", "Z-GUEST",
            "Z-VAULT", "Z-DEPT-GW",
        ],
    },
    {
        "id": "BOUTIQUE_SUITE",
        "name": "Boutique & Retail Suite",
        "tagline": "Complete retail management system",
        "icon": "🛍️",
        "color": "#DB2777",
        "target_client": "Boutique, gift shop, mini-mart, luxury retail",
        "zones": [
            "Z-07", "Z-28", "Z-12", "Z-08",
            "Z-10", "Z-25", "Z-16", "Z-17",
            "Z-VAULT", "Z-DEPT-GW",
        ],
    },
    {
        "id": "FLEET_SUITE",
        "name": "Fleet & Transport Suite",
        "tagline": "Complete transport operation management",
        "icon": "🚁",
        "color": "#0891B2",
        "target_client": "Car rental, tour operator, aviation, transport company",
        "zones": [
            "Z-07", "Z-26", "Z-12", "Z-3B",
            "Z-08", "Z-16", "Z-17",
            "Z-VAULT", "Z-DEPT-GW",
        ],
    },
    {
        "id": "HOTEL_PRO",
        "name": "Hotel Pro",
        "tagline": "Full hotel operation — PMS + revenue departments",
        "icon": "🏢",
        "color": "#D4AF37",
        "target_client": "Specialized clinic, guesthouse, serviced medical apartments",
        "zones": [
            "Z-07", "Z-30", "Z-05", "Z-08", "Z-10",
            "Z-09", "Z-20", "Z-29", "Z-27", "Z-28",
            "Z-12", "Z-16", "Z-17", "Z-25", "Z-31",
            "Z-GUEST", "Z-OWNER",
            "Z-11", "Z-1B", "Z-VAULT", "Z-DEPT-GW", "Z-MASTER",
        ],
    },
    {
        "id": "ENTERPRISE",
        "name": "Enterprise",
        "tagline": "Full 31-zone Miracle HMS — unlimited power",
        "icon": "🌐",
        "color": "#00F2FF",
        "target_client": "Full hospital, medical group, multi-property clinical chain",
        "zones": None,  # None = no filter, show all zones
    },
]


# ─── ROUTES ──────────────────────────────────────────────────────────────────

@router.get("/packages")
def list_packages():
    """
    Public endpoint — returns full package catalog.
    Called by Vigilant website to render the demo selector.
    """
    return {
        "status": "OK",
        "packages": PACKAGE_CATALOG,
    }


@router.get("/package/{client_code}")
def get_client_package(client_code: str, db: Session = Depends(get_db)):
    """
    Production licensing lookup.
    Returns the allowed zones for a client, keyed by their client_code.
    The visitor-tour page can call this instead of packagePresets.ts
    for production (non-demo) sessions.
    """
    try:
        row = db.execute(
            text("SELECT package_id, allowed_zones, brand_color, is_demo, expires_at FROM client_licenses WHERE client_code = :code"),
            {"code": client_code}
        ).first()
    except Exception as db_err:
        logger.error(f"[LICENSING] DB error for {client_code}: {db_err}")
        raise HTTPException(status_code=503, detail="Licensing service temporarily unavailable.")

    if not row:
        raise HTTPException(status_code=404, detail=f"No license found for client code: {client_code}")

    # Check expiry
    if row.expires_at:
        expiry = row.expires_at if isinstance(row.expires_at, datetime) else datetime.fromisoformat(str(row.expires_at))
        if expiry < datetime.utcnow():
            raise HTTPException(status_code=403, detail="License expired. Please contact Vigilant IT Solution.")

    # Parse allowed_zones — may be JSON string or None (Enterprise = no filter)
    allowed_zones = None
    if row.allowed_zones:
        try:
            allowed_zones = json.loads(row.allowed_zones)
        except Exception:
            allowed_zones = [z.strip() for z in row.allowed_zones.split(",") if z.strip()]

    return {
        "status": "LICENSED",
        "client_code": client_code,
        "package_id": row.package_id,
        "allowed_zones": allowed_zones,
        "brand_color": row.brand_color or "#00F2FF",
        "is_demo": bool(row.is_demo),
    }


@router.post("/demo/register")
def register_demo_session(payload: DemoRegistration, db: Session = Depends(get_db)):
    """
    Non-blocking analytics registration for demo sessions.
    Called by visitor-tour page when a package is launched.
    Fails silently — the demo MUST launch even if this fails.
    """
    try:
        # Validate package_id is known
        known_ids = {p["id"] for p in PACKAGE_CATALOG}
        if payload.package_id not in known_ids:
            return {"status": "SKIPPED", "reason": "Unknown package_id"}

        # Insert a demo license record (or ignore if already exists)
        import uuid
        demo_code = f"DEMO-{payload.package_id}-{uuid.uuid4().hex[:8].upper()}"
        zones_for_pkg = next((p["zones"] for p in PACKAGE_CATALOG if p["id"] == payload.package_id), None)
        zones_json = json.dumps(zones_for_pkg) if zones_for_pkg else None

        db.execute(text("""
            INSERT INTO client_licenses
                (client_code, entity_name, package_id, allowed_zones, brand_color, is_demo)
            VALUES
                (:code, :entity, :pkg, :zones, :color, 1)
        """), {
            "code": demo_code,
            "entity": payload.entity_name[:100],
            "pkg": payload.package_id,
            "zones": zones_json,
            "color": next((p["color"] for p in PACKAGE_CATALOG if p["id"] == payload.package_id), "#00F2FF"),
        })
        db.commit()
        logger.info(f"[LICENSING] Demo registered: {demo_code} — {payload.package_id}")
        return {"status": "OK", "demo_code": demo_code}

    except Exception as ex:
        logger.warning(f"[LICENSING] Demo registration failed (non-fatal): {ex}")
        # Fail silently — demo session is already active in browser
        return {"status": "SKIPPED", "reason": str(ex)}
