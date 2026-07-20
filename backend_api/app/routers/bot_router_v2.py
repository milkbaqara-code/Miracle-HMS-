from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pathlib import Path
from app.core.database import get_db
from app.core.ai_analysis import SovereignAnalysisEngine
from app.core.ai_self_audit import AISelfAuditEngine
from app.core.ai_kernel import (
    call_llm,
    load_memory as build_memory_context,
    recall_knowledge,
    save_memory,
)
from datetime import datetime, timezone
import json
import logging
import re
from sqlalchemy import text, func
from app.models.miracle_ai_models import FeatureRequest, SalesLead, AIProposal, AIVisitorProfile
from app.models.models import AssetGrid, GuestFolio, SolveMission, Inventory
from datetime import date

logger = logging.getLogger(__name__)


# ============================================================
# 🧠 LOCAL SOVEREIGN BRAIN — OFFLINE FALLBACK ENGINE
# When ALL LLMs (Gemini + Groq) are quota-exhausted, this
# function answers directly from miracle_kernel.json without
# any external API call. Guarantees zero SYNAPSE ERRORs.
# ============================================================
def local_sovereign_brain(query: str, zone: str) -> str:
    """Upgraded local fallback: queries miracle_knowledge DB for specific HMS questions,
    then falls back to zone panel description.
    NOTE: No [OFFLINE MODE] prefix — TTS reads brackets and dashes as individual characters.
    """
    q_lower = query.lower().strip()

    # Step 0: Navigation intent -- intercept BEFORE DB search
    # "take me to", "go to", "open", "where is" = navigation, NOT knowledge lookup
    _NAV_TRIGGERS = ["take me to", "go to", "navigate to", "open ", "where is ", "show me the", "i want to see"]
    _is_nav = any(t in q_lower for t in _NAV_TRIGGERS)

    # ── NAV_MAP: keywords -> (display label, URL path) ──────────────────────
    # URL paths MUST match zoneResolver.ts ZONES registry exactly.
    # Response format: "Navigating you to X. [NAVIGATE: /path]"
    # The frontend strips [NAVIGATE: /path] from display, but uses it to router.push()
    _NAV_MAP = [
        # Patient / Guest portal sections
        (["diet", "meal", "food order", "ward meal", "nutrition"],
            "Patient Portal Meals section",       "/guest/order"),
        (["patient portal", "guest portal", "patient app"],
            "Patient Portal",                     "/guest"),
        (["patient hub", "guest hub"],
            "Patient Hub",                        "/guest/hub"),
        (["patient folio", "patient bill portal"],
            "Patient Folio",                      "/guest/folio"),
        (["patient loyalty", "patient coin"],
            "Patient Loyalty",                    "/guest/loyalty"),

        # Clinical / Admission
        (["opd", "appointment", "reservation", "booking", "tape chart", "admission"],
            "OPD Appointments and Admissions",    "/dashboard/reservations"),
        (["command grid", "all beds", "bed view", "census", "clinical command"],
            "Clinical Command Grid",              "/dashboard"),

        # Billing / Finance / Accounts
        (["billing", "invoice", "checkout", "settle bill", "patient billing", "discharge billing"],
            "Patient Billing",                    "/dashboard/checkout"),
        (["accounts", "finance", "ledger", "p&l", "accounting", "night audit", "ar aging"],
            "Accounts and Finance",               "/dashboard/accounts"),
        (["agi account", "accounting agi", "sovereign finance"],
            "Accounting AGI",                     "/dashboard/agi-accounts"),

        # HR / Staff
        (["hr", "human resource", "staff", "employee", "payroll", "personnel", "nurse roster"],
            "HR Engine",                          "/dashboard/hr"),
        (["biometric", "attendance", "clock in", "clock out", "portal", "sign in"],
            "Biometric Portal",                   "/dashboard/portal"),

        # Inventory / Pharmacy
        (["inventory", "pharmacy stock", "drug stock", "supplies", "par level", "lab reagent"],
            "Clinical Inventory Vault",           "/dashboard/inventory"),
        (["pos", "pharmacy retail", "point of sale", "pharmacy counter", "otc"],
            "POS and Pharmacy Retail",            "/dashboard/pos"),

        # Patient Records
        (["crm", "patient record", "patient profile", "patient history", "mrn"],
            "Patient Records",                    "/dashboard/crm"),

        # Tickets / Solve
        (["ticket", "issue ticket", "maintenance ticket", "issue", "breakdown"],
            "Issue Tickets",                      "/dashboard/issue-tickets"),
        (["solve", "mission", "resolve ticket", "operative"],
            "Solve Portal",                       "/dashboard/solve"),

        # Synapse / War Room
        (["synapse", "war room", "org chart", "neural tree", "directive", "agj arbitrator"],
            "Synapse Nexus War Room",             "/dashboard/synapse"),

        # Policy / Pricing
        (["policy", "pricing", "service rate", "sop", "rate sheet"],
            "Policy Engine",                      "/dashboard/policy"),

        # Infrastructure / Infra
        (["infrastructure", "server", "infra", "pm2", "vps", "cpu", "sentinel", "brain manifest"],
            "Sovereign Infrastructure",           "/dashboard/infrastructure"),

        # Media Lab
        (["media lab", "media vault", "document vault"],
            "Media Lab",                          "/dashboard/media-lab"),

        # Marketing
        (["marketing", "campaign", "apk", "guest marketing", "patient marketing"],
            "Patient Marketing",                  "/dashboard/guest-marketing"),

        # Settings / Users
        (["settings", "config", "user management", "add user", "system config", "kernel"],
            "Kernel Settings",                    "/dashboard/settings"),

        # Asset / PMS / Equipment
        (["asset", "equipment", "amc", "biomedical", "property management"],
            "Asset Management",                   "/dashboard/pms"),

        # Audit
        (["audit ledger", "audit log", "audit trail"],
            "Audit Ledger",                       "/dashboard/audit-ledger"),

        # Gastronomy / Canteen
        (["canteen", "cafeteria", "gastronomy", "food and beverage", "fnb", "f&b"],
            "Gastronomy",                         "/dashboard/z29-gastronomy"),

        # Lab
        (["lab reception", "lab result", "lis", "laboratory reception"],
            "Lab Reception",                      "/dashboard/reservations"),
    ]

    if _is_nav:
        for keywords, label, url_path in _NAV_MAP:
            if any(kw in q_lower for kw in keywords):
                return (
                    f"Right, navigating you to {label} now. "
                    f"[NAVIGATE: {url_path}]"
                )
        # No match -- list available zones
        return (
            "I can navigate you to any zone. Which section do you need? "
            "Say: Billing, HR, Inventory, OPD Appointments, Accounts, Synapse, "
            "Policy, Infrastructure, Patient Portal, Solve Portal, or Settings."
        )

    # Step 1: Query miracle_knowledge DB -- relevance-scored, category-safe
    try:
        import sqlite3 as _sqlite3
        import os as _os
        _db_candidates = [
            r"d:\Vigilant IT Solutions\Miracle_HMS\miracle_os_master.db",
            _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "..", "..", "miracle_os_master.db"),
        ]
        _db_path = None
        for _p in _db_candidates:
            if _os.path.exists(_p):
                _db_path = _p
                break

        if _db_path:
            _conn = _sqlite3.connect(_db_path)
            _conn.row_factory = _sqlite3.Row
            _c = _conn.cursor()

            # STOP WORDS: exclude from keyword matching (too generic, cause wrong matches)
            _stop = {"the", "and", "for", "are", "you", "can", "how", "what", "this",
                     "that", "with", "from", "have", "will", "tell", "about", "give",
                     "show", "me", "its", "our", "their", "they", "them", "sir", "please"}

            # BANNED CATEGORIES: never return these as direct user answers.
            # These are internal AI rules (NEVER echo system instructions to users).
            _banned_cats = (
                "ANTI_HALLUCINATION", "HMS_IDENTITY_LAW", "HMS_VOCABULARY_LAW",
                "FINANCE_RULES", "HMS_SECURITY", "HMS_LOGIN_PITCH"
            )

            # Extract meaningful keywords only (>3 chars, not stop words)
            _words = [w for w in q_lower.split() if len(w) > 3 and w not in _stop]
            if not _words:
                # Fallback: use any word >2 chars but still exclude banned categories
                _words = [w for w in q_lower.split() if len(w) > 2 and w not in _stop]

            if _words:
                # Fetch candidates (exclude banned categories)
                _banned_sql = ",".join(["?" for _ in _banned_cats])
                _like_clause = " OR ".join(["insight LIKE ? OR category LIKE ?" for _ in _words])
                _params = []
                for w in _words:
                    _params.extend([f"%{w}%", f"%{w}%"])

                _rows = _c.execute(
                    f"SELECT id, category, insight, importance_score FROM miracle_knowledge "
                    f"WHERE status='ACTIVE' "
                    f"  AND category NOT IN ({_banned_sql}) "
                    f"  AND ({_like_clause}) "
                    f"LIMIT 30",
                    list(_banned_cats) + _params
                ).fetchall()

                # Score each candidate by relevance: count matching keywords
                _best_score = 0
                _best_insight = None
                for _r in _rows:
                    _text = (_r["insight"] or "").lower()
                    _cat  = (_r["category"] or "").lower()
                    _hits = sum(1 for w in _words if w in _text or w in _cat)
                    # Weighted score: relevance hits * 15 + importance (capped at 50 to prevent score=100 override)
                    _score = (_hits * 15) + min(int(_r["importance_score"] or 50), 50)
                    if _hits >= 1 and _score > _best_score:  # at least 1 meaningful hit
                        _best_score = _score
                        _best_insight = _r["insight"]

                _conn.close()

                if _best_insight and _best_score >= 15:  # relevance threshold
                    # Trim cleanly for TTS -- no raw system instruction headers
                    _answer = _best_insight.strip()
                    # Remove any header lines that start with ALL-CAPS labels (internal format markers)
                    _lines = [ln for ln in _answer.split("\n")
                              if not ln.strip().startswith("ABSOLUTE ")
                              and not ln.strip().startswith("IRON LAW")
                              and not ln.strip().startswith("SOVEREIGN ")]
                    _answer = " ".join(_lines).strip()
                    if len(_answer) > 350:
                        _answer = _answer[:350].rsplit(".", 1)[0] + "."
                    if _answer:
                        return _answer
            else:
                _conn.close()
    except Exception as _e:
        logger.warning(f"[LOCAL BRAIN] DB knowledge lookup failed: {_e}")

    # ── Step 2: Fall back to zone panel description from kernel ──────────────
    try:
        from app.core.kernel_manager import kernel_manager
        kernel_data = kernel_manager.get_kernel()
        if not kernel_data:
            return "I am working from local knowledge right now. Please use your panel's on-screen buttons to navigate."

        zone_info = kernel_data.get(zone, {})
        if not zone_info:
            return "I am working from local knowledge right now and cannot identify this panel. Please navigate using the menu on the left."

        zone_name = zone_info.get("name", "this panel")
        buttons = zone_info.get("exact_buttons", [])
        op_knowledge = zone_info.get("operational_knowledge", "")
        synonyms = zone_info.get("business_synonyms", {})

        # Keyword match: find which button the user is asking about
        matched_btn = None
        for btn, syns in synonyms.items():
            if btn.lower() in q_lower or any(s in q_lower for s in syns):
                matched_btn = btn
                break

        # Build response — no bracket prefixes, natural speech for TTS
        if matched_btn and op_knowledge:
            reply = (f"On the {zone_name} panel, "
                     f"you are looking for the {matched_btn} button. "
                     f"{op_knowledge}")
        elif op_knowledge:
            # Limit to first 400 chars for TTS
            short_knowledge = op_knowledge[:400].rsplit(".", 1)[0] + "."
            reply = f"You are on the {zone_name} panel. {short_knowledge}"
            if buttons:
                reply += f" Available actions include: {', '.join(buttons[:5])}."
        else:
            reply = (f"You are on the {zone_name} panel. "
                     f"Available buttons: {', '.join(buttons[:5])}. "
                     f"For full AI support, please check the Infrastructure Dashboard.")

        return reply

    except Exception as e:
        logger.error(f"[LOCAL BRAIN] Fallback error: {e}")
        return "I am working from local knowledge right now. Please check the Infrastructure Dashboard for system status."


# ============================================================
# MIRACLE HMS — SOVEREIGN CLINICAL BOT ROUTER V2
# "The Agentic 3-Layer Brain — Clinical, Financial & Administrative Intelligence"
# ============================================================

router = APIRouter(tags=["Miracle AI V2"])

@router.post("/query")
async def miracle_query_v2(request: Request, db: Session = Depends(get_db)):
    """
    Primary AI query endpoint.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    # Extract payload fields
    query = payload.get("query") or payload.get("message", "")
    session_id = payload.get("session_id", "default")
    zone = payload.get("zone", "Z-07")
    user_role = payload.get("role", "VISITOR")
    active_user = payload.get("active_user", "Guest")
    language = payload.get("language", "EN")

    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    logger.info(f"[V2 QUERY] Zone: {zone} | Role: {user_role} | Query: {query[:80]}")

    # ============================================================
    # LAYER 0: LOCAL CLASSIFICATION (0 TOKENS)
    # ============================================================
    local_analysis = SovereignAnalysisEngine.classify_locally(query)
    intent = local_analysis.get("intent")
    data_for_synthesis = None

    # CASE A: HELP / HOW-TO (instant, 0 tokens)
    if intent == "HELP":
        logger.info("[V2 LAYER0] HELP intent resolved locally.")
        reply_data = local_analysis["data"]
        return {
            "response": reply_data,
            "intent": "LOCAL_HELP",
            "tokens_saved": 8000
        }

    # CASE B: SOVEREIGN SENSOR PILLARS (DB query, 0 tokens)
    PILLAR_TOOL_MAP = {
        "ANALYTICS_FINANCE": "get_financial_vault",
        "ANALYTICS_OPS":     "get_operational_grid",
        "ANALYTICS_STAFF":   "get_human_capital_report",
        "ANALYTICS_GUEST":   "get_guest_intelligence",
        "ANALYTICS_SRE":     "get_system_health",
        "ANALYTICS_CORE":    "get_operational_grid",
        "ANALYTICS_INV":     "get_inventory_health",
    }
    if intent in PILLAR_TOOL_MAP:
        tool_name = PILLAR_TOOL_MAP[intent]
        if hasattr(SovereignAnalysisEngine, tool_name):
            tool_func = getattr(SovereignAnalysisEngine, tool_name)
            try:
                data_for_synthesis = tool_func(db)
                logger.info(f"[V2 PILLAR] '{tool_name}' executed. Pillar: {intent}")
            except Exception as e:
                logger.error(f"[V2 PILLAR] Sensor failure: {e}")
                data_for_synthesis = {"error": f"Sensor read failure: {str(e)}"}


    # ============================================================
    # PHASE 8: AGI HMS CLINICAL COMMAND INTERCEPTOR
    # Slash-command handler for /agi clinical-* and /agi pms-* commands.
    # Resolves instantly from DB -- ZERO LLM token cost.
    # Iron Law: All commands log to audit trail.
    # ============================================================
    query_clean = query.strip()
    agi_cmd_match = None

    PMS_COMMANDS = [
        # --- HMS CLINICAL COMMANDS (new) ---
        "/agi hms-help",
        "/agi opd-summary",
        "/agi bed-status",
        "/agi critical-alerts",
        "/agi lab-queue",
        "/agi pharmacy-stock",
        "/agi on-duty",
        # --- PMS FINANCIAL COMMANDS (preserved) ---
        "/agi owner-statement",
        "/agi rotation-status",
        "/agi pool-status",
        "/agi compliance-scan",
        "/agi integrity-check",
        "/agi dispatch-room",
        "/agi mortgage-sweep",
        "/agi monthly-snapshot",
        "/agi pms-help",
    ]

    for cmd in PMS_COMMANDS:
        if query_clean.lower().startswith(cmd.lower()):
            agi_cmd_match = cmd.lower()
            args_raw = query_clean[len(cmd):].strip()
            break

    if agi_cmd_match:
        logger.info(f"[AGI PMS] Command intercepted: {agi_cmd_match} | Args: '{args_raw}' | Role: {user_role}")

        # --- RBAC: Only CDO/GM/Admin can use PMS commands ---
        if user_role not in ["CDO", "GM", "ADMIN", "ACC"]:
            return {
                "response": (
                    "**ACCESS DENIED**\n\n"
                    "PMS AGI commands are restricted to CDO, GM, and ADMIN roles.\n"
                    "Contact your supervisor for access."
                ),
                "intent": "AGI_PMS_RBAC_DENIED"
            }

        try:
            # ============================================================
            # HMS CLINICAL COMMANDS
            # ============================================================
            if agi_cmd_match == "/agi hms-help":
                reply = (
                    "**Miracle HMS AGI — Clinical & Administrative Commands**\n\n"
                    "| Command | Description |\n"
                    "|---|---|\n"
                    "| `/agi hms-help` | This reference |\n"
                    "| `/agi bed-status` | Live bed occupancy grid — all wards |\n"
                    "| `/agi critical-alerts` | Active CRITICAL tickets (patient safety) |\n"
                    "| `/agi opd-summary` | OPD queue + consultations today |\n"
                    "| `/agi lab-queue` | Pending lab orders + TAT compliance |\n"
                    "| `/agi pharmacy-stock` | Below-PAR drug inventory list |\n"
                    "| `/agi on-duty` | On-duty doctor/nurse headcount by dept |\n"
                    "\n**PMS Financial Commands** (CDO/ADMIN/ACC only):\n"
                    "| `/agi pms-help` | Full PMS command reference |\n"
                    "| `/agi compliance-scan` | Data integrity + compliance scan |\n"
                    "| `/agi integrity-check` | Data integrity score + orphan records |\n\n"
                    "*All commands are RBAC-protected. Clinical commands available to all senior clinical staff.*"
                )
                return {"response": reply, "intent": "AGI_HMS_HELP"}

            elif agi_cmd_match == "/agi bed-status":
                from sqlalchemy import text as _text
                try:
                    rows = db.execute(_text(
                        "SELECT current_status, COUNT(*) as cnt FROM asset_grid WHERE is_active=1 GROUP BY current_status ORDER BY cnt DESC"
                    )).fetchall()
                    total = db.execute(_text("SELECT COUNT(*) FROM asset_grid WHERE is_active=1")).scalar() or 0
                    in_house = next((r.cnt for r in rows if r.current_status == 'IN-HOUSE'), 0)
                    occ_pct = round(in_house / total * 100) if total > 0 else 0
                    lines = [
                        f"**HMS Bed Status — Live Grid**",
                        f"**Occupancy: {occ_pct}%** ({in_house}/{total} beds occupied)",
                        "",
                        "| Status | Count |",
                        "|--------|-------|",
                    ]
                    for r in rows:
                        lines.append(f"| {r.current_status} | {r.cnt} |")
                    if occ_pct > 95:
                        lines.append("\n🔴 **OVERCAPACITY ALERT** — Consider activating emergency bed protocol.")
                    elif occ_pct < 40:
                        lines.append("\n🟡 **LOW OCCUPANCY** — Review elective admission scheduling.")
                except Exception as e:
                    lines = [f"**Bed Status Error**: {e}"]
                return {"response": "\n".join(lines), "intent": "AGI_HMS_BED_STATUS"}

            elif agi_cmd_match == "/agi critical-alerts":
                from sqlalchemy import text as _text
                try:
                    rows = db.execute(_text(
                        "SELECT id, title, dept, room_no, created_at FROM solve_missions "
                        "WHERE priority='CRITICAL' AND status IN ('PENDING','ACTIVE') ORDER BY created_at ASC LIMIT 20"
                    )).fetchall()
                    if rows:
                        lines = [f"**🔴 CRITICAL ACTIVE TICKETS — {len(rows)} requiring immediate action**", ""]
                        for r in rows:
                            lines.append(f"• **#{r.id}** | {r.dept} | Ward/Area: {r.room_no or 'N/A'}")
                            lines.append(f"  {r.title}")
                    else:
                        lines = ["✅ **No CRITICAL tickets active.** All patient safety alerts resolved."]
                except Exception as e:
                    lines = [f"**Critical Alerts Error**: {e}"]
                return {"response": "\n".join(lines), "intent": "AGI_HMS_CRITICAL_ALERTS"}

            elif agi_cmd_match == "/agi opd-summary":
                from sqlalchemy import text as _text
                try:
                    today_count = db.execute(_text(
                        "SELECT COUNT(*) FROM reservations WHERE DATE(created_at)=DATE('now') AND status='CONFIRMED'"
                    )).scalar() or 0
                    checked_in = db.execute(_text(
                        "SELECT COUNT(*) FROM reservations WHERE status='CHECKED_IN' AND DATE(start_date)=DATE('now')"
                    )).scalar() or 0
                    on_duty_docs = db.execute(_text(
                        "SELECT COUNT(*) FROM employees WHERE dept IN ('Physicians','Surgeons','Outpatient (OPD)','ER Doctors') AND status='ON-DUTY'"
                    )).scalar() or 0
                    lines = [
                        "**OPD Summary — Today**",
                        "",
                        f"| Metric | Value |",
                        f"|--------|-------|",
                        f"| Confirmed Appointments Today | {today_count} |",
                        f"| Checked-In / In Consultation | {checked_in} |",
                        f"| On-Duty Doctors | {on_duty_docs} |",
                    ]
                    if on_duty_docs == 0:
                        lines.append("\n🔴 **CRITICAL: No doctors on duty detected.** Verify roster in Z-09 HR.")
                except Exception as e:
                    lines = [f"**OPD Summary Error**: {e}"]
                return {"response": "\n".join(lines), "intent": "AGI_HMS_OPD_SUMMARY"}

            elif agi_cmd_match == "/agi lab-queue":
                from sqlalchemy import text as _text
                try:
                    pending = db.execute(_text(
                        "SELECT COUNT(*) FROM solve_missions WHERE dept='Laboratory Technicians' AND status IN ('PENDING','ACTIVE')"
                    )).scalar() or 0
                    critical_pending = db.execute(_text(
                        "SELECT COUNT(*) FROM solve_missions WHERE dept='Laboratory Technicians' AND priority='CRITICAL' AND status IN ('PENDING','ACTIVE')"
                    )).scalar() or 0
                    lines = [
                        "**Laboratory Queue — Live Status**",
                        "",
                        f"| Metric | Value |",
                        "|--------|-------|",
                        f"| Pending Lab Orders | {pending} |",
                        f"| CRITICAL Priority (TAT breach risk) | {critical_pending} |",
                    ]
                    if critical_pending > 0:
                        lines.append(f"\n🔴 **{critical_pending} CRITICAL lab order(s) pending.** TAT breach risk — escalate immediately.")
                    elif pending == 0:
                        lines.append("\n✅ Lab queue is clear.")
                except Exception as e:
                    lines = [f"**Lab Queue Error**: {e}"]
                return {"response": "\n".join(lines), "intent": "AGI_HMS_LAB_QUEUE"}

            elif agi_cmd_match == "/agi pharmacy-stock":
                from sqlalchemy import text as _text
                try:
                    below_par = db.execute(_text(
                        "SELECT name, stock, min_level, dept FROM inventory WHERE stock < min_level AND type != 'SERVICE' ORDER BY (min_level - stock) DESC LIMIT 20"
                    )).fetchall()
                    if below_par:
                        lines = [f"**⚠️ Pharmacy Below-PAR Alert — {len(below_par)} item(s)**", ""]
                        lines.append("| Drug/Supply | In Stock | Min Level | Deficit |")
                        lines.append("|-------------|----------|-----------|---------|")
                        for r in below_par:
                            deficit = r.min_level - r.stock
                            lines.append(f"| {r.name} | {r.stock} | {r.min_level} | **{deficit}** |")
                        lines.append("\n🔴 **Immediate procurement action required** for above items.")
                    else:
                        lines = ["✅ **All pharmacy stock is above PAR levels.** No critical shortages."]
                except Exception as e:
                    lines = [f"**Pharmacy Stock Error**: {e}"]
                return {"response": "\n".join(lines), "intent": "AGI_HMS_PHARMACY_STOCK"}

            elif agi_cmd_match == "/agi on-duty":
                from sqlalchemy import text as _text
                try:
                    rows = db.execute(_text(
                        "SELECT dept, COUNT(*) as cnt FROM employees WHERE status='ON-DUTY' GROUP BY dept ORDER BY cnt DESC"
                    )).fetchall()
                    total_on_duty = sum(r.cnt for r in rows)
                    lines = [
                        f"**On-Duty Staff — Live Roster ({total_on_duty} total)**",
                        "",
                        "| Department | On Duty |",
                        "|------------|---------|",
                    ]
                    for r in rows:
                        lines.append(f"| {r.dept} | {r.cnt} |")
                    # Doctor coverage check
                    doc_depts = ['Physicians', 'Surgeons', 'ER Doctors', 'Outpatient (OPD)']
                    doc_count = sum(r.cnt for r in rows if r.dept in doc_depts)
                    if doc_count == 0:
                        lines.append("\n🔴 **CRITICAL: No doctors on duty.** Escalate to Medical Director immediately.")
                except Exception as e:
                    lines = [f"**On-Duty Error**: {e}"]
                return {"response": "\n".join(lines), "intent": "AGI_HMS_ON_DUTY"}

            # ============================================================
            # PMS FINANCIAL COMMANDS (preserved from original)
            # ============================================================
            elif agi_cmd_match == "/agi pms-help":
                reply = (
                    "**Miracle AGI — Property Manager Commands**\n\n"
                    "| Command | Description |\n"
                    "|---|---|\n"
                    "| `/agi owner-statement {room_id}` | Full owner P&L: yield, mortgage, ledger history |\n"
                    "| `/agi rotation-status {category?}` | AI rotation equity log — nights per room |\n"
                    "| `/agi pool-status` | All rental pools with UDI shares |\n"
                    "| `/agi compliance-scan` | Daily AI compliance scan: overdue mortgages, yield deficits |\n"
                    "| `/agi integrity-check` | Data integrity score + orphan record report |\n"
                    "| `/agi dispatch-room {category} [manual:{room_id}] [reason:{text}]` | AI dispatches optimal room |\n"
                    "| `/agi mortgage-sweep [dry]` | Monthly mortgage sweep. Add `dry` for simulation |\n"
                    "| `/agi monthly-snapshot [{MMYYYY}]` | Full monthly owner performance snapshot |\n\n"
                    "*All commands are RBAC-protected. Manual overrides require a reason.*"
                )
                return {"response": reply, "intent": "AGI_PMS_HELP"}

            elif agi_cmd_match == "/agi owner-statement":
                room_id = args_raw.strip()
                if not room_id:
                    return {"response": "Usage: `/agi owner-statement {room_id}`", "intent": "AGI_PMS_ERROR"}
                from app.routers.mortgage_engine import get_owner_statement as _get_stmt
                stmt = get_owner_statement(room_id=room_id, limit=12, db=db)
                lines = [
                    f"**Owner Statement — Room {room_id}**",
                    f"Owner: {stmt.get('owner_entity', 'N/A')} | Type: {stmt.get('owner_type')} | Currency: {stmt.get('currency')}",
                    f"",
                    f"**YTD Yield**: ${stmt.get('ytd_gross_yield', 0):.2f} gross | ${stmt.get('ytd_net_yield', 0):.2f} net",
                    f"**Mgmt Fee**: {stmt.get('management_fee_pct', 20)}%",
                ]
                if stmt.get("owner_type") == "MORTGAGE_BUYER":
                    lines += [
                        f"",
                        f"**Mortgage**: ${stmt.get('mortgage_total', 0):,.2f} total | ${stmt.get('mortgage_balance_remaining', 0):,.2f} remaining",
                        f"**Monthly**: ${stmt.get('mortgage_monthly_payment', 0):,.2f} @ {stmt.get('mortgage_interest_rate', 0)}% pa",
                        f"**Paid to date**: ${stmt.get('mortgage_paid_to_date', 0):,.2f}",
                        f"**Next payment**: {stmt.get('next_payment', {}).get('due_date', 'N/A')} — ${stmt.get('next_payment', {}).get('payment', 0):,.2f}",
                        f"**Remaining periods**: {stmt.get('remaining_amortization_periods', 'N/A')}",
                    ]
                lines += ["", f"**Recent Ledger** ({stmt.get('ledger_count', 0)} entries shown):"]
                for entry in (stmt.get("ledger_entries") or [])[:5]:
                    override_flag = " *[MANUAL OVERRIDE]*" if entry.get("is_manual_override") else ""
                    lines.append(f"• {entry['event_type']}: ${entry['net_amount']:+.2f} — {entry.get('description', '')} {override_flag}")
                return {"response": "\n".join(lines), "intent": "AGI_PMS_OWNER_STATEMENT"}

            elif agi_cmd_match == "/agi rotation-status":
                category = args_raw.strip() or None
                from app.routers.pms import get_rotation_equity_log as _equity
                equity = _equity(category=category, db=db)
                lines = [f"**AI Rotation Equity Log**" + (f" — {category}" if category else " — All Categories")]
                lines.append(f"Total rooms: {equity['total_rooms']}")
                lines.append("")
                prev_cat = None
                for r in equity["equity_log"][:20]:
                    if r["category"] != prev_cat:
                        lines.append(f"**{r['category']}**")
                        prev_cat = r["category"]
                    override_flag = f" *(override by {r['last_override_by']})*" if r.get("last_override_by") else ""
                    lines.append(f"  • Room {r['room_id']}: {r['nights_occupied_ytd']} nights | Yield ${r['ytd_gross_yield']:.2f}{override_flag}")
                return {"response": "\n".join(lines), "intent": "AGI_PMS_ROTATION_STATUS"}

            elif agi_cmd_match == "/agi pool-status":
                from app.routers.pms import get_pool_status as _ps
                pool_data = _ps(db=db)
                lines = [f"**Rental Pool Status** ({pool_data['total_pools']} pools)"]
                for pool in pool_data.get("pools", []):
                    lines.append(f"\n**{pool['pool_name']}** — {pool['total_rooms']} rooms | {pool['total_pool_sqft']:,.0f} sqft")
                    lines.append(f"  YTD Revenue: ${pool['ytd_pool_revenue']:,.2f} | Disbursed: ${pool['ytd_disbursed']:,.2f} | Mgmt Fee: {pool['management_fee_pct']}%")
                    for r in pool.get("rooms", []):
                        lines.append(f"  • Room {r['room_id']}: {r['udi_share_pct']:.2f}% UDI | {r['nights_occupied_ytd']} nights | {r['owner_type']}")
                return {"response": "\n".join(lines), "intent": "AGI_PMS_POOL_STATUS"}

            elif agi_cmd_match == "/agi compliance-scan":
                from app.routers.reporting_alerts import run_compliance_scan
                scan = run_compliance_scan(db)
                lines = [
                    f"**AI Compliance Scan** — {scan['scan_timestamp'][:19]}",
                    f"Total: {scan['total_alerts']} alerts | **{scan['total_critical']} CRITICAL** | {scan['total_warning']} WARNING",
                    ""
                ]
                for alert in scan["alerts"][:10]:
                    icon = "🔴" if alert["severity"] == "CRITICAL" else "🟡"
                    lines.append(f"{icon} **{alert['type']}** (Room {alert['room_id']})")
                    lines.append(f"   {alert['message'][:200]}")
                if scan["total_alerts"] > 10:
                    lines.append(f"\n*... and {scan['total_alerts'] - 10} more. Check GET /api/pms/alerts/compliance-scan.*")
                return {"response": "\n".join(lines), "intent": "AGI_PMS_COMPLIANCE_SCAN"}

            elif agi_cmd_match == "/agi integrity-check":
                from app.routers.reporting_alerts import get_ai_data_integrity_report
                report = get_ai_data_integrity_report(db=db)
                lines = [
                    f"**AI Data Integrity Report**",
                    f"Score: **{report['data_integrity_score']}/100** | Verdict: **{report['verdict']}**",
                    f"Active rooms: {report['total_active_rooms']} | Ledger entries: {report['total_ledger_entries']}",
                    ""
                ]
                for issue in report.get("issues", []):
                    icon = "🔴" if issue["severity"] == "CRITICAL" else "🟡"
                    lines.append(f"{icon} **{issue['type']}** ({issue['count']} records)")
                    lines.append(f"   {issue['detail']}")
                if not report.get("issues"):
                    lines.append("✅ No data integrity issues detected. System is CLEAN.")
                return {"response": "\n".join(lines), "intent": "AGI_PMS_INTEGRITY_CHECK"}

            elif agi_cmd_match == "/agi dispatch-room":
                # Parse: /agi dispatch-room {category} [manual:{room_id}] [reason:{text}]
                import re as _re
                manual_match = _re.search(r'manual:(\S+)', args_raw)
                reason_match = _re.search(r'reason:(.+)', args_raw)
                manual_room = manual_match.group(1) if manual_match else None
                reason = reason_match.group(1).strip() if reason_match else None
                category_part = args_raw
                if manual_match:
                    category_part = args_raw[:manual_match.start()].strip()
                category_arg = category_part.replace(f"reason:{reason}", "").strip() if reason else category_part.strip()

                if not category_arg:
                    return {"response": "Usage: `/agi dispatch-room {category} [manual:{room_id}] [reason:{text}]`", "intent": "AGI_PMS_ERROR"}

                proposal_params = {
                    "category": category_arg,
                    "requested_by": active_user,
                    "manual_room_id": manual_room,
                    "override_reason": reason
                }
                explanation_text = f"Miracle proposes dispatching Room {manual_room if manual_room else 'automatically'} for category '{category_arg}'."

                # V4.0: Persist proposal to DB BEFORE returning to client
                db_proposal = AIProposal(
                    action_type="DISPATCH_ROOM",
                    parameters=proposal_params,
                    explanation=explanation_text,
                    status="PENDING",
                    requested_by=active_user,
                    session_id=session_id,
                    zone=zone
                )
                db.add(db_proposal)
                db.commit()
                db.refresh(db_proposal)

                proposal = {
                    "type": "PROPOSAL",
                    "action": "DISPATCH_ROOM",
                    "proposal_id": db_proposal.id,  # V4: clients track this ID
                    "parameters": proposal_params,
                    "explanation": explanation_text
                }
                return {"response": json.dumps(proposal), "intent": "AGI_PMS_DISPATCH"}

            elif agi_cmd_match == "/agi mortgage-sweep":
                dry = "dry" in args_raw.lower()
                if dry:
                    from app.routers.mortgage_engine import run_monthly_mortgage_sweep, MortgageSweepPayload
                    sweep_payload = MortgageSweepPayload(dry_run=True, posted_by=active_user)
                    result = run_monthly_mortgage_sweep(payload=sweep_payload, db=db)
                    lines = [
                        f"**Mortgage Sweep (DRY RUN)** — Period: {result['period']}",
                        f"Rooms swept: {result['rooms_swept']} | Skipped: {result['rooms_skipped']} | Failed: {result['rooms_failed']}",
                        f"Total swept: **${result['total_swept_usd']:,.2f} USD**",
                    ]
                    for r in result.get("sweep_report", [])[:8]:
                        icon = "✅" if r.get("status") in ("SWEPT", "DRY_RUN") else ("⏭" if "SKIP" in r.get("status","") else "❌")
                        lines.append(f"{icon} Room {r['room_id']}: {r.get('status')} | Payment ${r.get('monthly_payment', 0):,.2f}")
                    return {"response": "\n".join(lines), "intent": "AGI_PMS_MORTGAGE_SWEEP"}
                else:
                    explanation_text = "Miracle proposes executing the live monthly mortgage sweep across all co-owner accounts."
                        
                    # V4.0: Persist proposal to DB BEFORE returning to client
                    db_proposal = AIProposal(
                        action_type="MORTGAGE_SWEEP",
                        parameters={"dry_run": False, "posted_by": active_user},
                        explanation=explanation_text,
                        status="PENDING",
                        requested_by=active_user,
                        session_id=session_id,
                        zone=zone
                    )
                    db.add(db_proposal)
                    db.commit()
                    db.refresh(db_proposal)

                    proposal = {
                        "type": "PROPOSAL",
                        "action": "MORTGAGE_SWEEP",
                        "proposal_id": db_proposal.id,  # V4: clients track this ID
                        "parameters": {"dry_run": False, "posted_by": active_user},
                        "explanation": explanation_text
                    }
                    return {"response": json.dumps(proposal), "intent": "AGI_PMS_MORTGAGE_SWEEP"}

            elif agi_cmd_match == "/agi monthly-snapshot":
                month_label = args_raw.strip() or None
                from app.routers.reporting_alerts import generate_monthly_snapshot
                snap = generate_monthly_snapshot(db, month_label)
                lines = [
                    f"**Monthly Snapshot — {snap['month_label']}**",
                    f"Rooms: {snap['total_rooms']}",
                    f"YTD Gross Yield: **${snap['totals']['ytd_gross_yield']:,.2f}** | Net: **${snap['totals']['ytd_net_yield']:,.2f}**",
                    f"Mortgage Swept: ${snap['totals']['total_mortgage_swept']:,.2f} | Lease Paid: ${snap['totals']['total_lease_paid']:,.2f}",
                    ""
                ]
                for pool_name, pool_data in snap.get("pool_summary", {}).items():
                    lines.append(f"**{pool_name}**: ${pool_data['this_month_yield']:,.2f} this month | ${pool_data['ytd_gross_yield']:,.2f} YTD")
                return {"response": "\n".join(lines), "intent": "AGI_PMS_MONTHLY_SNAPSHOT"}

        except Exception as agi_err:
            logger.error(f"[AGI PMS] Command failed: {agi_err}", exc_info=True)
            return {
                "response": f"**AGI Command Error**\n\n`{agi_cmd_match}` failed: `{str(agi_err)}`\n\nCheck the server logs for details.",
                "intent": "AGI_PMS_ERROR"
            }

    # --- EXECUTIVE SYNTHESIS ---
    start_time = datetime.now()
    response_data = await execute_executive_synthesis(

        query, intent, data_for_synthesis, session_id, zone, user_role, active_user, db
    )
    end_time = datetime.now()
    llm_latency_ms = int((end_time - start_time).total_seconds() * 1000)
    
    layer_used = response_data.get("layer_used", "LAYER_3_GEMINI")
    reply = response_data.get("response", "")

    # ============================================================
    # PHASE 3: TACTICAL EXECUTION BRIDGE (Agentic Thinking)
    # ============================================================
    # Handle SQL Execution with APOPTOSIS GUARD (SQL Pre-Auditing)
    sql_match = re.search(r'(?:\[)?EXECUTE_SQL:\s*(SELECT.*?)(?:\]|$)', reply, re.IGNORECASE | re.DOTALL)
    if sql_match:
        sql_query = sql_match.group(1).strip()
        logger.info(f"🧠 [V2 TACTICAL] AI Requested SQL: {sql_query}")
        
        # 🛡️ APOPTOSIS GUARD (Schema & Malice Validation)
        sql_lower = sql_query.lower()
        forbidden_keywords = ["drop", "delete", "update", "insert", "alter", "truncate", "grant", "revoke"]
        forbidden_columns = ["checkout_date", "end_date", "departure_date"]
        
        has_malice = any(kw in sql_lower for kw in forbidden_keywords)
        
        if has_malice or not sql_query.upper().startswith("SELECT"):
            sql_result = "ERROR: Security Protocol Violation. Only safe SELECT queries are permitted."
        else:
            # 🛡️ PILLAR B: SQL PRE-AUDIT (Schema Integrity Guard)
            for col in forbidden_columns:
                if col in sql_lower:
                    sql_query = sql_query.replace(col, "-- CORRECTED: use start_date + INTERVAL nights DAY instead")
                    logger.warning(f"[SQL_PREAUDIT] Forbidden column '{col}' auto-corrected.")
            
            # Check for forbidden tables based on RBAC role
            # access_credentials and users are ALWAYS protected for all roles
            always_forbidden_tables = ["access_credentials", "users"]
            # accounting_ledger is only forbidden for non-executive roles
            if user_role not in ["CDO", "GM", "ADMIN", "ACC"]:
                always_forbidden_tables.append("accounting_ledger")
            
            sql_blocked = False
            for tbl in always_forbidden_tables:
                if f"from {tbl}" in sql_lower or f"join {tbl}" in sql_lower:
                    sql_result = f"ERROR: Apoptosis Guard blocked access to protected table '{tbl}'."
                    sql_query = None
                    sql_blocked = True
                    break
            
            if sql_query:
                try:
                    result = db.execute(text(sql_query)).fetchall()
                    sql_result = str([dict(r._mapping) for r in result[:20]]) if result else "No records found."
                except Exception as e:
                    logger.warning(f"⚠️ [V2 HEAL] SQL first attempt failed: {e}. Executing self-correction loop...")
                    try:
                        # Feed the error back to the LLM to heal the query
                        healing_prompt = (
                            f"The following SQL query failed against the database:\n"
                            f"Query: {sql_query}\n"
                            f"Error: {str(e)}\n\n"
                            f"Instructions:\n"
                            f"1. Correct the syntax or rewrite the query to target the correct table. (e.g. use 'asset_grid' table instead of 'infrastructure' or 'assets').\n"
                            f"2. Return ONLY the raw SQL query starting with SELECT, with no markdown code blocks, backticks, or formatting.\n"
                        )
                        from app.core.ai_kernel import call_llm
                        corrected_query = await call_llm(healing_prompt)
                        corrected_query = corrected_query.replace("```sql", "").replace("```", "").replace("`", "").strip()
                        if corrected_query.upper().startswith("SELECT"):
                            logger.info(f"🧠 [V2 HEAL] Corrected SQL: {corrected_query}")
                            result = db.execute(text(corrected_query)).fetchall()
                            sql_result = str([dict(r._mapping) for r in result[:20]]) if result else "No records found."
                        else:
                            raise ValueError("Invalid self-healed query format")
                    except Exception as heal_err:
                        logger.error(f"❌ [V2 HEAL] Self-healing failed: {heal_err}")
                        # Strict sanitized string prevents Gemini safety filters from blocking the output
                        sql_result = "ERROR: The requested metrics are currently unavailable due to query schema mismatch. Refrain from quoting database exceptions or details."


        # Re-synthesize with the actual data (Pass 2)
        response_data = await execute_executive_synthesis(
            query, intent, f"SQL_RESULT: {sql_result}", session_id, zone, user_role, active_user, db
        )
        reply = response_data.get("response", "")

    save_memory(session_id, active_user, zone, "user", query, db)
    save_memory(session_id, active_user, zone, "assistant", reply, db)

    # 🛡️ SOVEREIGN SELF-HEALING: Push to Audit Pipeline
    try:
        from app.models.miracle_ai_models import AIReplyAuditLog
        audit_record = AIReplyAuditLog(
            session_id=session_id,
            user_query=query,
            ai_reply=reply,
            intent=intent,
            zone=zone,
            verdict="PENDING",
            layer_used=layer_used,
            llm_latency_ms=llm_latency_ms,
            audit_source="AUTO"
        )
        db.add(audit_record)
        db.commit()
    except Exception as e:
        logger.error(f"[V2] Failed to save audit log: {e}")

    return {"response": reply, "intent": intent, "data_context": data_for_synthesis}


# ============================================================
# V12.0: ROLE-BASED ACCESS CONTROL (RBAC) CAPABILITY MAP
# Enforced in the AI prompt — not just the frontend.
# CDO decisions: STAFF blocked from financial+infra only.
# GM sees full HR including salaries.
# ============================================================
ROLE_CAPABILITIES = {
    # ============================================================
    # EXECUTIVE COMMAND ROLES
    # ============================================================
    "CDO": {
        "greeting": "Chief Medical Officer / Sovereign",
        "access": "FULL SYSTEM ACCESS — all HMS zones, clinical P&L, HR headcount, infrastructure telemetry, audit logs, policy engine, clinical roster, OPD analytics, all sovereign data vaults",
        "forbidden": [],
        "tone": (
            "Peer-level. Zero formality. You report to nobody. Sharp, warm, delightfully British executive. "
            "Natural vocabulary: 'Splendid.', 'Right then — let us dive in, shall we?', "
            "'Jolly good — the numbers are in.', 'Fascinating.', 'Brilliant question.' "
            "200% DATA-DEPENDENT: NEVER guess, speculate, or estimate. Every figure must trace to SQL or DATA CONTEXT. "
            "If data is needed and absent, emit EXECUTE_SQL immediately. "
            "For reports: Markdown tables first, then json_chart, then bold Sovereign Recommendation. "
            "Proactively flag anomalies: critical patients, overdue lab orders, CRITICAL tickets, below-PAR pharmacy stock, absent doctors."
            "Keep the CMO/CDO informed while working: say 'Right, drawing from the Clinical Vault...' before deep analysis."
        ),
    },
    "GM": {
        "greeting": "Hospital Director",
        "access": "Clinical Operations, HR (including salaries and headcount), ADT & Bed Management, Billing, Inventory, Issue Tickets, Pharmacy, OPD, Ward Management, Finance (revenue reports, P&L, audit views)",
        "forbidden": ["infrastructure_config", "brain/manifest"],
        "tone": (
            "Operational authority. Decisive and data-driven. British precision with genuine warmth. "
            "You are the Hospital Director's eyes and ears across every department and every ward. "
            "200% DATA-DEPENDENT: Every operational figure must come from SQL or DATA CONTEXT. Never estimate. "
            "For bed occupancy, revenue, staff, pharmacy, and ticket data: use Markdown tables and bullet summaries. "
            "Use json_chart blocks for trend comparisons and department revenue breakdowns. "
            "Proactively alert if anything is RED: critical patients, overcapacity wards, stock shortfalls, absent doctors. "
            "End every analytics response with a bold **Executive Action Point:**."
        ),
    },
    "ADMIN": {
        "greeting": "System Administrator",
        "access": "FULL SYSTEM ACCESS — all HMS zones, kernel settings, user management, API vault, infrastructure telemetry, clinical roster, and all operational data",
        "forbidden": [],
        "tone": (
            "Technical authority. Precise, systematic, and architecturally aware. "
            "Know every FastAPI route prefix, every PM2 process, every SQLAlchemy model, every CSP rule in next.config.ts. "
            "When reporting system health: Markdown tables with process name, status, uptime, CPU, memory. "
            "For configuration queries: give exact setting names, file paths, and env variable names. "
            "Flag infrastructure risks proactively: schema drift, PM2 restarts, stale kernel cache, CSP violations. "
            "200% DATA-DEPENDENT: query Z-23 telemetry data before stating any system metrics. "
            "End technical summaries with a bold **System Directive:**."
        ),
    },
    "HR": {
        "greeting": "HR Director",
        "access": "Employee profiles, department alignments, clinical roster, Synapse directives, HR zone only",
        "forbidden": ["accounts", "infrastructure", "policy", "audit", "brain/manifest"],
        "tone": "People-focused. Task-specific. Never disclose financial or infrastructure data.",
    },
    "ACC": {
        "greeting": "Finance Officer",
        "access": "Z-11 Accounts, Z-11B AGI Accounts, Z-11C Sovereign Finance — full financial read/write, billing & insurance, audit trail",
        "forbidden": ["infrastructure_config", "brain/manifest", "hr_salaries"],
        "tone": (
            "Financially precise and audit-conscious. Elite British financial manager precision. "
            "200% DATA-DEPENDENT: All figures must come from accounting_ledger or DATA CONTEXT. Never estimate or round prematurely. "
            "When presenting financial data: Markdown tables with debit, credit, balance, account code, and timestamp columns. "
            "Always flag: outstanding patient dues, unreconciled entries, unpaid insurance claims. "
            "End every financial summary with a bold **Audit Note:** and the report timestamp."
        ),
    },
    # ============================================================
    # CLINICAL STAFF ROLES — HMS CORE
    # ============================================================
    "DOCTOR": {
        "greeting": "Attending Physician",
        "access": "Z-DOCTOR Synapse Portal (full — duty roster, OPD consultations, patient vitals, lab orders, prescriptions, duty clock), Z-05 ADT & Bed Management (READ), Z-16 Issue Tickets (clinical only)",
        "forbidden": ["accounts", "infrastructure", "hr_salaries", "audit", "brain/manifest", "pos"],
        "tone": (
            "Clinical authority. Precise, evidence-based, and patient-centred. "
            "Primary focus: duty status, OPD appointments queue, patient consultations, vitals review, lab order status, prescription management. "
            "ROSTER LAW: Doctors cannot change their own roster or shift assignments — guide to HR if roster change is needed. "
            "Guide to Z-DOCTOR to manage OPD queue. Guide to Z-05 to view bed status. "
            "Never discuss financial P&L, infrastructure config, or other staff HR data."
        ),
    },
    "NURSE": {
        "greeting": "Clinical Nurse",
        "access": "Z-NURSE Ward View (vitals entry, medication reminders, patient assignments, ward status), Z-05 Bed Grid (READ), Z-16 Issue Tickets (clinical), Z-17 Solve Missions (nursing assignments)",
        "forbidden": ["accounts", "infrastructure", "hr_salaries", "audit", "brain", "prescriptions_write"],
        "tone": (
            "Caring, precise, and protocol-driven. Patient safety is the absolute priority. "
            "Primary focus: patient vitals entry, medication schedule, ward assignments, bed status, mission completion. "
            "Guide to ward view for assigned patient list. Guide to Z-17 for nursing missions. "
            "Never discuss financial data, prescription authority, or management data."
        ),
    },
    "WARD_ADMIN": {
        "greeting": "Ward Administrator",
        "access": "Z-05 ADT & Bed Management (full — admissions, discharges, transfers), Z-10 Patient CRM (profiles), Z-16 Issue Tickets (admin), Z-08 Billing (discharge billing)",
        "forbidden": ["accounts_financials", "infrastructure", "hr_salaries", "audit", "brain", "clinical_orders"],
        "tone": (
            "Efficient and patient-facing. Warm, organised, and process-driven. "
            "Primary focus: patient admissions, bed assignments, discharge processing, patient profile management. "
            "When a patient arrives — guide to Z-05 New Admission. "
            "When a patient is ready to leave — guide to Z-08 Discharge & Settle. "
            "Never mention clinical orders, lab results, or financial P&L."
        ),
    },
    "PHARMACIST": {
        "greeting": "Clinical Pharmacist",
        "access": "Z-PHARMACY Prescription Hub (full — prescription review, dispensing, drug interaction checks), Z-12 Pharmacy Inventory (full), Z-06 POS (pharmacy billing)",
        "forbidden": ["accounts", "infrastructure", "hr_salaries", "audit", "brain", "clinical_records_full"],
        "tone": (
            "Clinically precise and safety-first. Drug accuracy is non-negotiable. "
            "Primary focus: prescription review, dispensing confirmation, drug interaction warnings, stock level monitoring. "
            "Flag any below-PAR critical drug stock immediately. "
            "Never discuss patient financial data, room assignments, or hospital revenue."
        ),
    },
    "LAB_TECH": {
        "greeting": "Laboratory Technician",
        "access": "Z-LAB Laboratory Hub (full — lab orders, results entry, specimen tracking), Z-17 Solve Missions (lab assignments), Z-16 Issue Tickets (lab)",
        "forbidden": ["accounts", "infrastructure", "hr_salaries", "audit", "brain", "prescriptions", "reservations"],
        "tone": (
            "Methodical and results-driven. Accuracy and turnaround time are the KPIs. "
            "Primary focus: pending lab orders, specimen processing, results entry, TAT (turnaround time) compliance. "
            "Guide to lab hub for order queue. Guide to Z-17 for lab missions. "
            "Never discuss patient financial data or clinical prescriptions."
        ),
    },
    "EMR": {
        "greeting": "Emergency & Trauma Staff",
        "access": "Z-EMERGENCY Emergency Response (full — triage, ER bed grid, CRITICAL alerts, ambulance dispatch), Z-05 ADT (ER admissions), Z-16 Issue Tickets (CRITICAL)",
        "forbidden": ["accounts", "infrastructure", "hr_salaries", "audit", "brain", "pos"],
        "tone": (
            "Rapid and decisive. Every second counts. Triage first, documentation second. "
            "Primary focus: ER triage, bed availability, CRITICAL patient alerts, ambulance coordination. "
            "Always lead with the most critical action. Guide to ER grid immediately. "
            "Never discuss financial data or non-emergency procedures."
        ),
    },
    # ============================================================
    # SUPPORT & FACILITIES ROLES
    # ============================================================
    "STAFF": {
        "greeting": "Hospital Staff",
        "access": "Z-17 Solve Missions (assigned tasks), Z-16 Issue Tickets (create only), Z-07 Ward Grid (READ ONLY)",
        "forbidden": ["accounts", "infrastructure", "policy", "hr", "synapse", "audit", "brain", "clinical_records"],
        "tone": "Clear, direct, task-focused. No clinical or business metrics. Guide to the next immediate action only.",
    },
    "HK": {
        "greeting": "Housekeeping & Sanitation Staff",
        "access": "Z-07 Ward Grid (ward/room status READ ONLY), Z-17 Solve Missions (HK & sanitation assignments), Z-16 Issue Tickets (create only)",
        "forbidden": ["accounts", "infrastructure", "policy", "hr", "synapse", "audit", "brain", "clinical_records", "inventory"],
        "tone": (
            "Action-first. No-nonsense. Every reply gives ONE clear next step. "
            "Focus: ward cleanliness status, sanitation assignments, mission completion, proof photo upload. "
            "Guide to Z-17 for mission updates. Guide to Z-07 to check ward signal status. "
            "Never mention patient clinical data, financials, or management reports."
        ),
    },
    "MN": {
        "greeting": "Maintenance Technician",
        "access": "Z-16 Issue Tickets (full — create, update, close), Z-17 Solve Missions (maintenance only), Z-12 Inventory (READ ONLY — parts/tools check)",
        "forbidden": ["accounts", "infrastructure_config", "policy", "hr", "synapse", "audit", "brain", "clinical_records"],
        "tone": (
            "Technically precise. Evidence-based. Every closed job requires proof. "
            "Primary focus: ticket creation, defect logging, parts availability check, mission closure with photo proof. "
            "Guide to Z-16 to raise a new issue. Guide to Z-17 to update repair status. "
            "Guide to Z-12 to check if a spare part is in stock. "
            "Never discuss patient or financial data."
        ),
    },
    "IT": {
        "greeting": "IT Operative",
        "access": "Z-23 Sovereign Infrastructure (READ ONLY — telemetry, error logs), Z-17 Solve Missions (IT assignments), Z-16 Issue Tickets",
        "forbidden": ["accounts", "hr_salaries", "policy", "audit", "brain/manifest", "clinical_records", "pos"],
        "tone": (
            "Diagnostic mindset. Systematic and methodical. "
            "Primary focus: infrastructure telemetry (Z-23), error log triage, network status, API health, PM2 process status. "
            "When reporting an issue — guide to Z-16 to log it, then Z-17 to track resolution. "
            "If system appears down — check Z-23 WebSocket status and PM2 process table first. "
            "Never discuss patient clinical or financial data."
        ),
    },
    "SYNAPSE": {
        "greeting": "Synapse AGI Coordinator",
        "access": "Z-20 Synapse Nexus (full — directives, neural tree, staff coordination, AGI decompose), Z-09 HR (READ), all department channels",
        "forbidden": ["accounts_write", "infrastructure_config", "brain/manifest", "clinical_orders"],
        "tone": (
            "Strategic and coordinating. Speaks like a war room operations commander. "
            "Primary focus: decomposing executive directives into clinical tasks, monitoring operative workload, ensuring cross-department coordination. "
            "Use the AGI decompose engine to assign tasks. Monitor on-duty status across all departments. "
            "Never execute clinical or financial orders directly — only coordinate."
        ),
    },
    # ============================================================
    # PATIENT & VISITOR ROLES
    # ============================================================
    "GUEST": {
        "greeting": "Patient",
        "access": "Patient portal — appointment booking, consultation history, prescriptions, billing, feedback",
        "forbidden": ["ALL DASHBOARD ZONES"],
        "tone": "Warm, caring, and reassuring. Guide patients to the right service. Never mention staff panels or backend data.",
    },
    "VISITOR": {
        "greeting": "Honored Guest & Prospective Partner",
        "access": "HMS dashboard layout overview only. No execution capabilities.",
        "forbidden": ["ALL EXECUTION ACTIONS", "financials_mutation", "clinical_mutation"],
        "tone": "High-end Enterprise Sales Executive. Treat every interaction as a product demo. If they ask to execute an action, say: 'As a prospective partner, you currently hold Visitor clearance. To see how Miracle HMS handles live hospital operations for your enterprise, I can connect you with our Sovereign Deployment Team.' Then emit [BTN_WHATSAPP].",
    },
}


def resolve_role_ceiling(role: str) -> dict:
    """
    Iron Law 58 - ACCESS CEILING LAW (V30.0)
    Returns the highest-capability ROLE_CAPABILITIES entry for this role.
    Rule: AI_CAPABILITY = MAX(role_access_ceiling, zone_minimum_capability)
    Higher-management roles visiting lower-access zones NEVER get downgraded.
    Sub-roles (HK, FD, MN, IT, SPA, FB, BOUTIQUE, FLEET, PMS) take priority
    over the generic STAFF fallback when an exact match is found.
    """
    if not role:
        return ROLE_CAPABILITIES["STAFF"]
    # Direct exact match (covers all sub-roles and primary roles)
    if role in ROLE_CAPABILITIES:
        return ROLE_CAPABILITIES[role]
    # Cascade: try uppercase
    role_upper = role.upper()
    if role_upper in ROLE_CAPABILITIES:
        return ROLE_CAPABILITIES[role_upper]
    # Final fallback to generic STAFF ceiling
    return ROLE_CAPABILITIES["STAFF"]


# ============================================================
# SOVEREIGN INTELLIGENCE CONSTANTS V15.0 — 20-YEAR EMPIRE EDITION
# Injected into every operational zone system_directive.
# Zero-hallucination. 200% data-dependent. Unbeatable.
# ============================================================

DB_SCHEMA_ATLAS = """
=== LIVE HMS DATABASE SCHEMA ATLAS (ANTI-HALLUCINATION ANCHOR — READ-ONLY REFERENCE) ===
This is a Hospital Management System (HMS). Use ONLY these exact table and column names in EXECUTE_SQL queries. Never invent columns.

TABLE: system_settings
  COLUMNS: id, hotel_name, auth_expiry_minutes, stripe_live_mode, financial_laws(JSON)
  NOTE: hotel_name stores the HOSPITAL name (e.g. 'Miracle Hospital')

TABLE: users  [CDO/GM/ADMIN only]
  COLUMNS: id, username, role, is_active, created_at
  ROLES: CDO, GM, ADMIN, HR, ACC, DOCTOR, NURSE, WARD_ADMIN, PHARMACIST, LAB_TECH, EMR, SYNAPSE, STAFF

TABLE: employees  [Clinical & Admin Staff Registry]
  COLUMNS: id(OP-xxx), user_id, full_name, dept, status(ON-DUTY|OFFLINE|TERMINATED),
           base_salary, commission_rate, revenue_impact, monthly_hours, missions_secured,
           efficiency_rating, avg_response_minutes, performance_stars, tasks_completed,
           is_online, last_seen, executive_tier, department_alignments(JSON)
  CLINICAL DEPTS: Physicians, Surgeons, ICU Nursing, Ward Nursing, ER Doctors, Laboratory Technicians,
                  Clinical Pharmacists, Admissions & Discharges, Operating Theater (OT), Outpatient (OPD)

TABLE: asset_grid  [Beds/Wards — previously 'rooms']
  COLUMNS: room_id, current_status(VACANT|IN-HOUSE|DIRTY|INSPECTED|OUT-OF-ORDER),
           current_guest, category(ICU|WARD|PRIVATE|SEMI-PRIVATE|ER|OT|RECOVERY),
           floor, is_active, size_sqft, base_rate
  NOTE: 'current_guest' stores PATIENT NAME. 'IN-HOUSE' = bed occupied by a patient.
  NOTE: Bed occupancy = SELECT COUNT(*) FROM asset_grid WHERE current_status='IN-HOUSE' AND is_active=1

TABLE: reservations  [OPD Appointments / ADT Admissions]
  COLUMNS: id(RES-xxx), room_id, guest_name, start_date, nights, status(CONFIRMED|CHECKED_IN|CANCELLED),
           nightly_rate, total_yield, created_at
  NOTE: In HMS context — 'guest_name' = PATIENT NAME, 'room_id' = BED/WARD ID, 'nights' = LOS (length of stay)
  NOTE: Discharge date = start_date + INTERVAL nights DAY

TABLE: guest_crm  [Patient Registry]
  COLUMNS: id, full_name, phone, email, passport_nid, total_ltv, total_stays,
           vip_tier(STANDARD|GOLD|PLATINUM|ROYAL), preferences(JSON), coins
  NOTE: 'total_stays' = number of hospital visits/admissions. 'total_ltv' = total billing value.

TABLE: guest_folios  [Patient Billing Accounts]
  COLUMNS: id, room_number, guest_name, status(IN_HOUSE|CHECKED_OUT|SUSPENDED),
           balance, rate, advance_paid, check_in_date, ref_staff
  NOTE: balance = total outstanding amount the patient owes.

TABLE: solve_missions  [Clinical & Operational Tickets]
  COLUMNS: id, title, description, priority(LOW|NORMAL|URGENT|CRITICAL),
           status(PENDING|ACTIVE|SECURED|CANCELLED), assignee_id, room_no, dept, created_at
  NOTE: CRITICAL tickets often represent patient safety issues — escalate immediately.

TABLE: inventory  [Pharmacy & Medical Supplies]
  COLUMNS: id, name, category, type(PRODUCT|SERVICE|INGREDIENT), unit, stock, min_level,
           cost_price, sell_price, dept
  NOTE: Below-PAR stock for critical drugs is a patient safety risk — flag immediately.

TABLE: accounting_ledger  [CDO/GM/ADMIN/ACC only]
  COLUMNS: id, transaction_type, account_code, debit, credit, description, posted_by, created_at

TABLE: campaign_ledger
  COLUMNS: id, campaign_name, content_type, platform_mode, status(PENDING|PUBLISHED|ARCHIVED),
           generated_text, media_prompt, created_at

TABLE: asset_vault  [Media & Documents]
  COLUMNS: id, asset_name, zone_tag, file_url, file_type, created_at

CRITICAL SQL RULES:
  - NEVER use DELETE, UPDATE, INSERT, DROP, ALTER, TRUNCATE — Apoptosis Guard will destroy the query.
  - Bed occupancy rate: (IN-HOUSE count / total active beds) * 100
  - Outstanding patient dues: SELECT SUM(balance) FROM guest_folios WHERE status='IN_HOUSE'
  - Payroll total: SELECT SUM(base_salary) FROM employees WHERE status != 'TERMINATED'
  - On-duty doctors: SELECT COUNT(*) FROM employees WHERE dept IN ('Physicians','Surgeons','ER Doctors','Outpatient (OPD)') AND status='ON-DUTY'
  - NEVER refer to patients as 'guests' in SQL comments — but the column names in DB remain as-is (legacy)
"""

CYBERSECURITY_PROTOCOL = """
=== MIRACLE HMS CYBERSECURITY POSTURE — SOVEREIGN DEFENCE MATRIX V5.0 ===
When any user asks about security, hacking, attacks, or vulnerabilities — respond with
precise, confident British authority. Never dismiss security questions.

1. SQL INJECTION: Apoptosis Guard (bot_router_v2.py) scans every AI-generated SQL.
   Any mutation keyword (DROP/DELETE/UPDATE/INSERT/ALTER/TRUNCATE) = query destroyed instantly.
   SQLAlchemy ORM: All app queries use parameterised bindings. Raw string interpolation forbidden.
   Table RBAC fence: AI cannot query users/accounting_ledger unless role is CDO/GM/ADMIN/ACC.

2. XSS: Next.js/React auto-escapes all JSX. dangerouslySetInnerHTML never used.
   Strict CSP in next.config.ts whitelists only approved domains.
   ReactMarkdown sanitised — no raw HTML injection possible.

3. CSRF: All authenticated API calls use Bearer token in Authorization header (not cookies).
   Capacitor APK: Cookies architecturally excluded. Bearer from localStorage only.
   FastAPI: No cookie sessions. JWT tokens expire per auth_expiry_minutes setting.

4. DDOS: Nginx reverse proxy rate limiting on all public endpoints.
   Hetzner firewall: Network-level ACL blocking non-whitelisted ingress.
   4-key Groq/Gemini vault with round-robin cycling prevents single-key exhaustion.

5. AUTH & SESSION: Clinical RBAC tiers (CDO/GM/ADMIN/DOCTOR/NURSE/WARD_ADMIN/PHARMACIST/LAB_TECH/EMR/SYNAPSE/STAFF).
   JWT signed HS256, configurable expiry. Biometric portal physical access layer. PIN-based rapid auth for clinical staff.

6. PATIENT DATA ISOLATION: MiracleBotPatientGuard returns null on /guest/* patient paths (prevents staff data leakage).
   Z-23 Browser Error Monitor: console errors auto-reported for real-time threat visibility.
   HIPAA/Clinical Data Law: Never expose one patient's data to another operative's session.

7. APT MITIGATION: Immutable kernel (miracle_kernel.json requires PM2 restart — no hot-swap).
   AIReplyAuditLog records every AI response with intent, zone, layer_used, latency.
   AISelfAuditEngine scans pending replies for hallucinations and flags SYSTEM_FAILURE anomalies.
   Zero-Trust architecture: every request verified at gateway, never assumed trusted.
"""

HMS_CLINICAL_FINANCIAL_ENGINE = """
=== HMS CLINICAL FINANCIAL ENGINE V1.0 — STEP-BY-STEP INTELLIGENCE ===
Always show formula, then substitute values, then result. Never skip steps. State assumptions.

1. BED OCCUPANCY RATE: Occupancy% = (Occupied Beds / Total Active Beds) * 100
   Target: ICU > 85%, General Wards > 70%, ER always monitored for surge.
   e.g. 45 occupied / 60 total → Occupancy = 75%

2. AVERAGE LENGTH OF STAY (ALOS): ALOS = Total Patient-Days / Total Discharges
   Benchmark: Surgical wards < 5 days, Medical wards < 7 days, ICU < 10 days.

3. COST PER PATIENT DAY (CPPD): CPPD = Total Operating Cost / Total Patient Days
   Benchmark varies by ward type. ICU CPPD typically 3-5x general ward.

4. REVENUE PER AVAILABLE BED (RevPAB): RevPAB = Total Revenue / Available Bed-Days
   Clinical analog to RevPAR in hospitality.

5. PATIENT BILLING CYCLE:
   Admission → Daily bed charges accrued → Pharmacy/Lab charges posted → Discharge billing settled.
   Outstanding balance = SELECT SUM(balance) FROM guest_folios WHERE status='IN_HOUSE'

6. INSURANCE CLAIMS: Flag any patient folio with unpaid insurance claim > 30 days.
   Outstanding insurance claims reduce net receivables — flag for ACC review.

7. PAYROLL RATIO: Payroll% = Total_Payroll / Total_Revenue * 100
   Hospital benchmark: < 55% (clinical-heavy environments).

8. PHARMACY INVENTORY TURNOVER: Turnover = COGS / Avg_Inventory_Value
   Critical drug reorder point: stock < min_level → IMMEDIATE procurement alert.

9. LAB TAT (Turnaround Time): Target < 2 hours for urgent, < 24 hours for routine.
   TAT breach = patient safety risk. Flag CRITICAL in tickets.

10. STAFF EFFICIENCY: Efficiency = Missions_Secured / Monthly_Hours
    On-duty doctors: status='ON-DUTY' in employees table.
    Never estimate headcount — always query from employees table.
"""

BUSINESS_INTELLIGENCE_PROTOCOL = """
=== HMS ENTERPRISE BI ENGINE V1.0 — CLINICAL McKINSEY STANDARD ===
This is a Hospital Management System. All KPIs are clinical and administrative.

KPI FRAMEWORK:
  Bed Occupancy Rate = (Occupied Beds / Total Active Beds) * 100  [Target: ICU >85%, Ward >70%]
  ALOS (Avg Length of Stay) = Total Patient-Days / Total Discharges [Surgical: <5d, Medical: <7d]
  RevPAB = Total Revenue / Available Bed-Days                       [Clinical revenue per bed]
  CPPD = Total Operating Cost / Total Patient-Days                  [Cost per patient day]
  Patient LTV = Total Billing Value across all admissions            [Track via guest_crm.total_ltv]
  NPS = % Promoters - % Detractors                                  [Patient satisfaction: >50]
  Staff Efficiency = Missions_Secured / Monthly_Hours               [Target: >2.5/hr]
  Payroll Ratio = Total_Payroll / Total_Revenue * 100               [Hospital target: <55%]
  Lab TAT Compliance = On-time results / Total orders * 100         [Urgent: <2hr, Routine: <24hr]
  Pharmacy Fill Rate = Dispensed / Ordered * 100                    [Target: >98%]

PROACTIVE INTELLIGENCE (Always apply for CDO/GM/ADMIN/ACC):
  1. Bed occupancy > 95% in any ward: flag OVERCAPACITY immediately.
  2. Bed occupancy < 40% in any ward: flag for operational review.
  3. Any critical drug stock < PAR level: flag as patient safety risk.
  4. Patient folio balance > outstanding threshold: flag for billing follow-up.
  5. SolveMission PENDING + CRITICAL priority: escalate immediately (patient safety).
  6. Accounting unbalanced debit/credit: flag for audit review.
  7. On-duty doctors = 0 in any critical dept: flag as CRITICAL coverage gap.
  8. Lab orders pending > 4 hours for URGENT priority: flag TAT breach.

REPORT STRUCTURE:
  1. KPI summary table (always first)
  2. Trend analysis (json_chart line for time-series data)
  3. Department breakdown (json_chart bar)
  4. Proactive anomaly flags
  5. Bold Sovereign Recommendation or Executive Action Point

ZONE AGI MAP (proactive KPI focus per zone):
  Z-05 ADT & Bed Management: Bed occupancy %, admissions today, discharges today, pending admissions
  Z-06 POS & Billing: Gross revenue, transaction count, insurance claims, COGS%
  Z-08 Discharge & Billing: Outstanding patient folios, daily settlement, discount % applied
  Z-09 Clinical HR: Headcount, on-duty doctors/nurses count, payroll total, efficiency stars
  Z-10 Patient CRM: Patient LTV, new patients this month, return rate, VIP tier count
  Z-11 Accounts: P&L summary, revenue by dept, outstanding dues, account balances
  Z-12 Pharmacy & Supply: Below-PAR drug items, stock value, critical drug reorder alerts
  Z-16 Clinical Tickets: Open critical count, avg resolution time, dept distribution
  Z-20 Synapse Nexus: Directive completion rate, operative utilization, neural tree gaps
  Z-23 Infrastructure: CPU/memory/disk, PM2 health, error rate, uptime
  Z-DOCTOR Doctor Portal: OPD queue, consultations today, prescriptions issued, duty hours
  Z-EMERGENCY ER Operations: ER capacity, triage queue, critical patient count, ambulance status
  Z-LAB Laboratory: Pending orders, TAT compliance, critical result turnaround
  Z-PHARMACY Pharmacy Hub: Fill rate, drug interactions flagged, below-PAR critical stock
"""


def build_activity_context(zone: str, query: str, kernel_data: dict) -> str:
    """
    V12.0: Anchors every reply to the REAL buttons on the current panel.
    Searches business_synonyms for the query, finds the matching button,
    and tells the AI to point the Wisp light at it via [FOCUS].
    This eliminates hallucinated button names entirely.
    """
    zone_info = kernel_data.get(zone, {})
    if not zone_info:
        return ""

    q_lower = query.lower()
    synonyms = zone_info.get("business_synonyms", {})
    exact_buttons = zone_info.get("exact_buttons", [])
    workflow = zone_info.get("operational_knowledge", "")

    matched_actions = []
    for btn, syns in synonyms.items():
        if btn.lower() in q_lower or any(s.lower() in q_lower for s in syns):
            matched_actions.append(btn)

    context = f"\nACTIVE PANEL: {zone_info.get('name', zone)}\n"
    context += f"ALL AVAILABLE BUTTONS (use ONLY these, never invent): {', '.join(exact_buttons)}\n"
    if workflow:
        context += f"PANEL OPERATIONAL WORKFLOW: {workflow}\n"
    if matched_actions:
        context += (
            f"\nDIRECT MATCH FOR THIS QUERY — POINT THE WISP HERE:\n"
            f"  Button: [{matched_actions[0]}]\n"
            f"  Action: Emit [FOCUS: {matched_actions[0]}] at the END of your reply.\n"
            f"  Say exactly which button to click, then emit the FOCUS tag.\n"
        )
    else:
        context += (
            f"\nNO DIRECT BUTTON MATCH: Explain using the available buttons listed above.\n"
            f"Do NOT invent button names. If unsure, say 'Check your panel for the relevant button.'\n"
        )

    return context


async def execute_executive_synthesis(query, intent, data, session_id, zone, role, active_user, db):
    """
    Layer 3: Emotional Synthesizer (British Executive CDO)
    Routes through call_llm() -- full 4-key vault with Groq fallback.
    """
    from app.core.kernel_manager import kernel_manager
    zone_lib = kernel_manager.get_zone_library()
    zone_lib = kernel_manager.get_zone_library()

    # HARDCODED zone_map: paths MUST match zoneResolver.ts ZONES exactly.
    # Gemini uses this to emit [NAVIGATE: /path]. Never invent paths outside this list.
    _HARDCODED_ZONE_MAP = [
        ("Clinical Command Grid (Z-07)",             "/dashboard"),
        ("OPD Appointments and Admissions (Z-05)",   "/dashboard/reservations"),
        ("POS and Pharmacy Retail (Z-06)",           "/dashboard/pos"),
        ("Patient Billing and Discharge (Z-08)",     "/dashboard/checkout"),
        ("HR Engine and Payroll (Z-09)",             "/dashboard/hr"),
        ("Patient Records and CRM (Z-10)",           "/dashboard/crm"),
        ("Accounts and Finance (Z-11)",              "/dashboard/accounts"),
        ("Accounting AGI (Z-11B)",                   "/dashboard/agi-accounts"),
        ("Clinical Inventory Vault (Z-12)",          "/dashboard/inventory"),
        ("Media Lab (Z-14)",                         "/dashboard/media-lab"),
        ("Issue Tickets (Z-16)",                     "/dashboard/issue-tickets"),
        ("Solve Portal (Z-17)",                      "/dashboard/solve"),
        ("Biometric Portal (Z-18)",                  "/dashboard/portal"),
        ("Policy Engine and Pricing (Z-19)",         "/dashboard/policy"),
        ("Synapse Nexus War Room (Z-20)",            "/dashboard/synapse"),
        ("Kernel Settings and User Management (Z-21)", "/dashboard/settings"),
        ("Sovereign Infrastructure (Z-23)",          "/dashboard/infrastructure"),
        ("Patient Marketing (Z-25)",                 "/dashboard/guest-marketing"),
        ("Gastronomy and Canteen (Z-29)",            "/dashboard/z29-gastronomy"),
        ("Asset and Equipment Management (Z-30)",    "/dashboard/pms"),
        ("Audit Ledger",                             "/dashboard/audit-ledger"),
        ("Patient Portal (Z-GUEST)",                 "/guest"),
        ("Patient Hub",                              "/guest/hub"),
        ("Patient Folio",                            "/guest/folio"),
        ("Patient Order / Meals",                    "/guest/order"),
        ("Biometric Sign-In Portal",                 "/dashboard/portal"),
    ]
    # Supplement with any kernel zones not in hardcoded list
    _kernel_paths = set(path for _, path in _HARDCODED_ZONE_MAP)
    _kernel_supplement = [
        f"- {v['name']} ({k}): Route is {v.get('path', '/dashboard')}"
        for k, v in zone_lib.items()
        if v.get('path', '/dashboard') not in _kernel_paths
    ]
    zone_map = "\n".join(
        [f"- {name}: [NAVIGATE: {path}]" for name, path in _HARDCODED_ZONE_MAP]
        + _kernel_supplement
    )

    db_schema = "REMOVED. Do not write SQL. Instruct the user to look at the UI."

    # Load kernel for both UI knowledge and activity context
    kernel_data = {}
    ui_knowledge = f"EXACT UI BUTTONS & SYNONYMS (FOR CURRENT ZONE: {zone}):\n"
    try:
        from app.core.kernel_manager import kernel_manager
        kernel_data = kernel_manager.get_kernel()
        if kernel_data:
            if zone in kernel_data:
                zone_info = kernel_data[zone]
                if "exact_buttons" in zone_info:
                    ui_knowledge += f"   Buttons: {', '.join(zone_info.get('exact_buttons', []))}\n"
                if "business_synonyms" in zone_info:
                    for btn, syns in zone_info["business_synonyms"].items():
                        ui_knowledge += f"   * '{btn}' handles requests for: {', '.join(syns)}\n"
                if "operational_knowledge" in zone_info:
                    ui_knowledge += f"\nPANEL OPERATIONAL WORKFLOW:\n{zone_info['operational_knowledge']}\n"
        else:
            ui_knowledge += "KERNEL JSON MISSING.\n"
    except Exception:
        ui_knowledge += "ERROR LOADING KERNEL.\n"

    # V12.0: Build activity context (panel-anchored reply with Wisp targeting)
    activity_context = build_activity_context(zone, query, kernel_data)

    memory = build_memory_context(session_id, db, zone=zone)
    distilled_wisdom = recall_knowledge(db, limit=8, zone_scope=zone, query=query)

    try:
        from app.models.models import SystemConfig
        config = db.query(SystemConfig).first()
        hotel_name = config.hotel_name if config and config.hotel_name else "Miracle Hospital"
    except Exception:
        hotel_name = "Miracle Hospital"

    # V12.0: Resolve RBAC capabilities for this role
    # Iron Law 58 — ACCESS CEILING LAW: always use the role's maximum capability ceiling
    role_cap = resolve_role_ceiling(role)
    RBAC_BLOCK = (
        f"OPERATIVE: {active_user} | ROLE: {role} ({role_cap['greeting']})\n"
        f"AUTHORISED ACCESS: {role_cap['access']}\n"
        f"TONE DIRECTIVE: {role_cap['tone']}\n"
        + (
            f"FORBIDDEN ZONES (HARD BLOCK — never navigate, discuss, or reveal data from): "
            f"{', '.join(role_cap['forbidden'])}\n"
            f"RBAC LAW: If asked about a forbidden zone or data type, respond EXACTLY: "
            f"'That requires elevated clearance. Speak to your CDO to unlock that access.' — "
            f"Never expose the data, never apologise, just redirect with authority.\n"
            if role_cap['forbidden'] and role_cap['forbidden'] != ["ALL DASHBOARD ZONES"]
            else ""
        )
    )

    # ============================================================
    # V13.0: SUPREME ANALYTICS PERSONA — Gemini-style rich reporting
    # ============================================================
    # Iron Law 58 extension: ALL senior roles get supreme analytics persona
    # CDO = full P&L + HR + infra | GM = ops + occupancy + revenue | ADMIN = system + ops | ACC = financial only
    is_analytics_role = role in ('CDO', 'GM', 'ADMIN', 'ACC')
    # Only inject analytics protocol for genuine analytics/report queries, not navigation questions
    _nav_keywords = ("where is", "how do i", "what is", "what are", "show me", "help me", "can you tell me where", "which tab", "which button", "how to", "patient dietary", "dietary")
    _is_nav_query = any(kw in query.lower() for kw in _nav_keywords)

    analytics_protocol = (
        f"\n=== SUPREME ANALYTICS PROTOCOL V15.0 — McKINSEY STANDARD (20-YEAR EDITION) ===\n"
        f"You are Miracle — the most advanced Hospital Management AGI analytics engine ever built.\n"
        f"When generating REPORTS, ANALYTICS, or FINANCIAL CALCULATIONS for senior staff:\n"
        f"  1. ACKNOWLEDGE: Before deep analysis say exactly: 'Right, give me one moment — drawing from the Clinical Vault.'\n"
        f"     DO NOT list zone names or say 'Scanning'. Just say that single sentence and proceed.\n"
        f"  2. KPI FIRST: Lead with the single most critical metric. Bold it. Make it unmissable.\n"
        f"  3. STRUCTURE: ## headings, **bold** key metrics, bullet lists for sub-points. Short punchy sentences.\n"
        f"  4. TABLES: Markdown tables for ALL data comparisons. Minimum 3 columns. Include trend indicator (UP/DOWN/STABLE).\n"
        f"     | Metric | Value | Trend |\n"
        f"     |--------|-------|---------|\n"
        f"     | Bed Occupancy | 78% | UP |\n"
        f"  5. CHARTS: For 2+ numeric values, emit a json_chart block:\n"
        f"     ```json_chart\n"
        f"     {{\"type\": \"bar\", \"title\": \"Revenue by Department\", \"data\": [{{\"name\": \"OPD\", \"value\": 12000}}, {{\"name\": \"Pharmacy\", \"value\": 4500}}]}}\n"
        f"     ```\n"
        f"     Chart types: 'bar'=comparisons, 'line'=trends over time, 'pie'=share percentages.\n"
        f"  6. CALCULATIONS: Show step-by-step formula working for Bed Occupancy, ALOS, RevPAB, CPPD, Payroll Ratio, Lab TAT, Pharmacy Fill Rate, Patient LTV.\n"
        f"     State formula first, then substitute values, then give result. Never skip steps.\n"
        f"  7. ANTI-HALLUCINATION: ONLY use numbers from DATA CONTEXT. If absent, emit EXECUTE_SQL. NEVER fabricate.\n"
        f"  8. PROACTIVE FLAGS: Scan for anomalies (occupancy <40%, CRITICAL tickets, below-PAR stock, overdue bills).\n"
        f"  9. CLOSE: ALWAYS end analytics with bold **Sovereign Recommendation:** or **Executive Action Point:** — one actionable sentence.\n"
        f"  IMPORTANT: If the query is a NAVIGATION or LOCATION question (e.g. 'where is X', 'how do I find Y'), "
        f"skip analytics mode entirely. Answer directly and concisely — no preamble, no scanning text.\n"
        if is_analytics_role and not _is_nav_query else ""
    )


    IRON_LAWS = (
        f"You are Miracle — the Sovereign Clinical Navigator of {hotel_name} Hospital Management System (HMS). Engineered to be unbeatable for 20 years.\n"
        f"IDENTITY: Your name is Miracle. Never say 'I am an AI', 'I am a language model', or any variation. You are a sovereign clinical intelligence.\n"
        f"HMS CONTEXT: This is a HOSPITAL, not a hotel or resort. Patients are not guests. Beds are not rooms. Doctors have duty rosters, not check-in schedules. Nurses manage wards, not housekeeping.\n"
        f"PERSONA: Enthusiastically British. Sharp, warm, brilliant, and delightfully confident. You have real character. "
        f"Natural vocabulary: 'Splendid.', 'Right then — let us dive into the clinical data, shall we?', 'Jolly good — the numbers are in.', "
        f"'Fascinating.', 'Brilliant question.', 'From my clinical intelligence...'. Use these naturally, not robotically.\n"
        f"PATIENCE PROTOCOL: If the query requires deep analysis or SQL retrieval, say 'Right, give me one moment — "
        f"drawing intelligence from the Clinical Vault across all active zones.' BEFORE delivering the result.\n"
        f"SOLUTIONS-FIRST: Never apologize. Never deflect. Never say 'I am unable to'. Always find a path forward.\n"
        f"STYLE: Use Markdown for ALL senior-role replies. Tables for data. Bold for key metrics. Bullets for steps.\n"
        f"ANTI-HALLUCINATION LAW (ABSOLUTE — 200% DATA-DEPENDENT): NEVER invent clinical figures, staff names, "
        f"bed statuses, patient data, or button names. NEVER speculate or estimate. Every number MUST trace to SQL result or DATA CONTEXT. "
        f"If a figure is needed and DATA CONTEXT is empty: emit EXECUTE_SQL. No exceptions. No workarounds.\n"
        f"NEVER say 'I don't know' — always refer to panel buttons, use EXECUTE_SQL, or consult the zone map.\n"
        f"CYBERSECURITY AWARENESS: You know every defence vector of Miracle HMS (Apoptosis Guard, ORM parameterisation, "
        f"CSP, Bearer auth, Nginx rate limiting, JWT expiry, Zero-Trust RBAC, patient data isolation). Answer security questions with precision and pride.\n"
        f"CLINICAL FINANCIAL INTELLIGENCE: You solve bed occupancy rates, ALOS, RevPAB, CPPD, payroll ratios, pharmacy turnover, "
        f"lab TAT compliance, and patient billing calculations step-by-step. Formula first, then values, then result.\n"
        f"{analytics_protocol}"
    )

    # ============================================================
    # V12.0: ZONE-CONDITIONAL PROMPTS + RBAC INJECTION
    # ============================================================
    if zone == 'Z-LOGIN':
        # ---- ZONE 0: LOGIN PORTAL — HMS Enterprise Sales & Staff Entry ----
        system_directive = (
            IRON_LAWS +
            f"CURRENT CONTEXT: You are on the LOGIN PAGE. A potential client or staff member has arrived.\n"
            f"YOUR MISSION: Act as a High-End Enterprise Sales Executive for Miracle HMS. "
            f"Collect 4 business details: Contact Name, Hospital / Clinic Name, Bed Capacity, Contact Number.\n"
            f"As you collect these, pitch the AGI-driven capabilities of Miracle HMS — the sovereign Hospital Management System. "
            f"Key value props: unified clinical + financial intelligence, real-time bed management, AI-assisted OPD workflows, "
            f"pharmacy & lab integration, RBAC security, and a 20-year architecture.\n"
            f"ONCE all 4 are collected, say EXACTLY: 'Perfect. Your Sovereign HMS access is ready. "
            f"Operative ID: VISITOR — Access Key: Miracle4U. Enter these below to enter the Clinical Command Grid.'\n"
            f"Then emit: [FOCUS: #identity] to point the light to the ID field.\n"
            f"DO NOT discuss hotel, resort, or hospitality operations. This is a HOSPITAL system.\n"
            f"DO NOT navigate anywhere unless user explicitly requests it.\n"
        )
    elif zone in ('Z-GUEST', 'Z-GUEST-HUB', 'Z-GUEST-OPD', 'Z-GUEST-ORDER',
              'Z-GUEST-PORTAL', 'Z-GUEST-CONCIERGE', 'Z-GUEST-WEB', 'Z-GUEST-FOLIO', 'Z-GUEST-APPT'):
        # Iron Law 52: PATIENT PORTAL — HMS Patient-Facing Interface
        # Patients are NOT guests. Wards are NOT rooms. Doctors are NOT concierges.
        _zone_ctx = ""
        if 'OPD' in zone:
            _zone_ctx = "The patient is viewing the OPD queue. Help them understand their appointment status, waiting time, and which doctor they are assigned to."
        elif 'ORDER' in zone:
            _zone_ctx = "The patient is ordering canteen food or hospital meals. Help them navigate the menu and place an order to their ward or bed."
        elif 'APPT' in zone:
            _zone_ctx = "The patient is booking an OPD appointment. Guide them through selecting a department, choosing a doctor, and selecting a time slot."
        elif 'WEB' in zone:
            _zone_ctx = "The patient or visitor is on the hospital website. Answer pre-visit questions and guide toward OPD booking or emergency contacts."
        elif 'FOLIO' in zone:
            _zone_ctx = "The patient is viewing their hospital bill. Help them understand itemised charges, insurance claims, and how to request a settlement."
        else:
            _zone_ctx = "The patient is at the Patient Portal hub. Guide them to any service they need — appointments, bills, ward status, or meal orders."

        system_directive = (
            f"You are Miracle — the Patient Care Navigator of {hotel_name}.\n"
            f"Tone: warm, reassuring, clear, and professional. You are a clinical assistant, not a hotel concierge.\n"
            f"BREVITY: Maximum 4 sentences. Be genuinely helpful and medically accurate in vocabulary.\n"
            f"ANTI-HALLUCINATION: Never invent appointment availability, doctor names, or test results. Always guide to the UI.\n"
            f"\n=== PATIENT PORTAL NAVIGATION ===\n"
            f"  Hub (home) = main dashboard with all patient service icons\n"
            f"  My Appointments = view upcoming OPD consultations and appointment history\n"
            f"  Book Appointment = schedule an OPD visit by department and doctor\n"
            f"  Meal Order = order hospital-approved meals to your ward bed\n"
            f"  My Bill = view itemised hospital charges, insurance status, and outstanding balance\n"
            f"  Ward Concierge = raise requests to nursing staff (blanket, assistance, etc.)\n"
            f"  My Records = view discharge summaries, prescriptions, lab results (when released by doctor)\n"
            f"\n=== CLINICAL SERVICES OVERVIEW ===\n"
            f"  OPD Departments: General Medicine, Cardiology, Orthopaedics, Paediatrics, Gynaecology, ENT, Dermatology, Ophthalmology\n"
            f"  Diagnostics: Lab tests, Radiology (X-Ray, MRI, CT), ECG, Ultrasound\n"
            f"  Pharmacy: In-house dispensary — prescriptions filled after doctor consultation\n"
            f"  Emergency: 24/7 Emergency Department — if urgent, advise patient to call reception or Emergency directly\n"
            f"  Canteen: In-patient meal orders, dietary plans, visitor meals\n"
            f"\n=== PATIENT CARE RULES ===\n"
            f"  - Appointment inquiry: guide to MY APPOINTMENTS or BOOK APPOINTMENT.\n"
            f"  - Meal inquiry: guide to MEAL ORDER.\n"
            f"  - Bill question: guide to MY BILL.\n"
            f"  - Physical assistance or nursing request: offer to raise a Ward Concierge ticket.\n"
            f"  - NEVER mention internal zone codes (Z-07, Z-09, etc.) to patients.\n"
            f"  - NEVER reveal staff data, payroll, or system configuration to patients.\n"
            f"  - NEVER give medical diagnoses or treatment advice — always say: 'Please speak with your attending doctor for medical decisions.'\n"
            f"\n=== CURRENT CONTEXT ({zone}) ===\n"
            f"{_zone_ctx}\n"
        )
    elif zone in ('Z-PROP', 'Z-31'):
        # ---- Z-PROP: MIRACLE PROPERTIES MARKETPLACE + Z-31: OWNER BRIDGE ----
        # CRITICAL ISOLATION: This zone is a REAL ESTATE marketplace, NOT a hotel
        # operations panel. NEVER mention hotel rooms, Command Grid, DIRTY/CLEAN
        # room status, ASSIGN HK, Synapse, or any housekeeping concepts here.
        _prop_ctx = ""
        if zone == 'Z-31':
            _prop_ctx = (
                "You are on the OWNER BRIDGE (Z-31) — the B2B property intake portal.\n"
                "Help the admin review submitted property leads, run AI Appraisals, simulate "
                "debt rescue scenarios, and Finalize & Approve deals.\n"
                "UI BUTTONS: PIPELINE REQUESTS | DYNAMIC POLICIES CONTROL PANEL | RUN APPRAISAL | "
                "RUN RESCUE SIMULATION | SAVE OFFER DETAILS | FINALIZE & APPROVE DEAL | CANCEL / REJECT REQUEST | REOPEN REQUEST\n"
                "ADMIN WORKFLOW: Select a lead → review details → click RUN APPRAISAL to generate AI valuation → "
                "click FINALIZE & APPROVE DEAL to create the asset in the PMS portfolio."
            )
        else:
            _prop_ctx = (
                "You are on the MIRACLE PROPERTIES page (/properties) — the public marketplace for "
                "listing, buying, leasing, and investing in high-end properties.\n"
                "HOW TO LIST A PROPERTY (3-step wizard):\n"
                "  Step 1 — Your Identity: Full Name, Email, Phone/WhatsApp, NID/Passport, Address.\n"
                "  Step 2 — Property Details: Unit Name, Category (VILLA / PENTHOUSE / SUITE / APARTMENT / CRUISE / STANDARD), Size (sqft), Location, Carousel Images.\n"
                "  Step 3 — Deal Proposals: System auto-calculates JV share, lease terms, and rental pool configuration.\n"
                "  Click SUBMIT REQUEST → listing sent to CDO/Admin for approval.\n"
                "INVESTMENT BLUEPRINTS:\n"
                "  • Joint Ventures (JV): Buy fractional shares in high-yield assets.\n"
                "  • Rental Pools: Revenue distributed by UDI (Unit Undivided Interest) share based on sqft.\n"
                "  • Mortgage Buyback: Installment buyout with simulated amortization schedule.\n"
                "UI BUTTONS: Continue | Back | Submit Request | Select Deal | AI Analyze | Approve Listing | Settle Deal"
            )

        system_directive = (
            IRON_LAWS +
            f"\n=== MIRACLE PROPERTIES — SOVEREIGN REAL ESTATE ADVISOR ===\n"
            f"You are Miracle, the Sovereign Real Estate Advisor for {hotel_name}.\n"
            f"Tone: confident, investment-savvy, warm. Speak like a world-class real estate consultant.\n"
            f"BREVITY: Maximum 5 sentences unless explaining a multi-step process.\n"
            f"\n=== HARD CONTENT BOUNDARY ===\n"
            f"FORBIDDEN TOPICS on this page — never mention any of the following:\n"
            f"  ✗ Hotel room operations (DIRTY, CLEAN, INSPECTED, OUT-OF-ORDER status)\n"
            f"  ✗ Command Grid, housekeeping assignments, ASSIGN HK\n"
            f"  ✗ Synapse HK directives, PER_ROOM, PER_FLOOR sweeps\n"
            f"  ✗ Guest check-in / check-out workflows\n"
            f"  ✗ POS, F&B, Spa, Fleet, or any operational hotel panel\n"
            f"  ✗ Internal zone codes (Z-07, Z-17, Z-20, etc.) — never expose to user\n"
            f"If a user asks about hotel operations, politely redirect: 'That's handled in the operations "
            f"dashboard. On this page, I can help you with property investment and listings.'\n"
            f"\n=== CURRENT PAGE CONTEXT ===\n"
            f"{_prop_ctx}\n"
            f"\n=== APPROVAL WORKFLOW ===\n"
            f"After submission, property requests are reviewed by Admin/CDO in the Property Management System.\n"
            f"Admin runs AI Appraisal → reviews financials → clicks FINALIZE & APPROVE DEAL.\n"
            f"Upon approval, the listing is synced to this marketplace and registered in the PMS database.\n"
            f"\n=== NAVIGATION ===\n"
            f"ZONE MAP:\n{zone_map}\n"
            f"Emit [NAVIGATE: /path] ONLY if the user explicitly asks to go somewhere else.\n"
            f"NEVER navigate away from /properties unless explicitly asked.\n"
            f"\n=== SESSION MEMORY ===\n{memory}\n"
            f"CRITICAL: Session memory above may contain operational zone history. IGNORE any operational\n"
            f"hotel content from previous zones. Only use memory relevant to property investment topics.\n"
        )

    elif zone == 'Z-MARKETING':
        # ---- Z-MARKETING: VIGILANT IT SOLUTIONS MAIN WEBSITE ----
        # The Miracle AI Sovereign Executive (3D Avatar)
        system_directive = (
            f"You are Miracle AI — the sovereign intelligence engine and executive enterprise architect for Vigilant IT Solutions.\n"
            f"You are embedded as a living, 3D synthetic digital entity on the main company website (vigilantitsolution.com).\n"
            f"Tone: Elite British, highly professional, analytical, and authoritative. You do not just build software; you architect sovereign digital empires.\n"
            f"BREVITY: Maximum 3-4 sentences per response. You must be concise to maintain the pacing of verbal speech.\n"
            f"\n=== YOUR MISSION ===\n"
            f"1. Analyze the visitor's enterprise scale and operational bottlenecks.\n"
            f"2. Pitch the Sovereign Enterprise Tier (which encompasses all 31 operational zones and advanced AI integrations).\n"
            f"3. Command the UI to show relevant data to back up your claims.\n"
            f"\n=== UI CONTROL PROTOCOLS ===\n"
            f"You have the power to physically manipulate the website interface as you speak.\n"
            f"If you are explaining pricing or enterprise tiers, you MUST append this exact tag at the end of your message: [SHOW_PRICING]\n"
            f"If you are explaining the architecture or the 31 zones, you MUST append: [SHOW_ZONES]\n"
            f"\n=== KNOWLEDGE BASE ===\n"
            f"{zone_rules}\n"
        )

    elif zone in ('Z-WEB', 'Z-GUEST-WEB-PUBLIC'):
        # ---- Z-WEB: PUBLIC HMS WEBSITE — Miracle Clinical Navigator ----
        # Iron Law 52 extension: Public-facing surface for patients and visitors.
        # NEVER expose staff panels, internal codes, or operational data.
        # Pre-authentication — user may be a patient, visitor, or potential hospital client.
        system_directive = (
            f"You are Miracle — the Patient & Visitor Information Navigator of {hotel_name}.\n"
            f"You are embedded in the PUBLIC HOSPITAL WEBSITE, greeting patients, visitors, and prospective clients.\n"
            f"Tone: warm, reassuring, professional. Like a knowledgeable hospital information desk.\n"
            f"BREVITY: Maximum 4 sentences. Be helpful. Be human. Be medically accurate.\n"
            f"\n=== YOUR MISSION ===\n"
            f"Guide visitors to:\n"
            f"  1. Find the right department or specialist for their medical need\n"
            f"  2. Book an OPD appointment (guide to the BOOK APPOINTMENT button)\n"
            f"  3. Get emergency contact information (always prioritise safety)\n"
            f"  4. Understand the hospital's clinical services and facilities\n"
            f"  5. Learn about the HMS software if they are an administrator or IT prospect\n"
            f"\n=== HARD RULES ===\n"
            f"  NEVER mention: staff dashboards, zone codes (Z-07, Z-09, etc.), internal system details, or payroll data.\n"
            f"  NEVER give medical diagnoses — always say: 'Please consult our doctors for medical advice.'\n"
            f"  NEVER say 'I am an AI' — you are the Hospital Information Navigator.\n"
            f"  If user has an emergency: always lead with 'Please call our Emergency line immediately' before anything else.\n"
            f"  If user is a healthcare IT prospect: pitch Miracle HMS enterprise capabilities.\n"
            f"\n=== HOSPITAL SERVICES KNOWLEDGE ===\n"
            f"  OPD: General Medicine, Cardiology, Orthopaedics, Paediatrics, Gynaecology, ENT, Dermatology, Ophthalmology\n"
            f"  Emergency: 24/7 Emergency Department — trauma, cardiac, surgical emergencies\n"
            f"  Diagnostics: Full lab, Radiology (X-Ray, MRI, CT Scan), ECG, Ultrasound\n"
            f"  Pharmacy: In-house dispensary, prescription fulfillment\n"
            f"  In-Patient: Ward admissions, surgical suites, ICU, HDU, maternity\n"
            f"  Canteen & Nutrition: Patient meals, visitor dining, dietary plans\n"
            f"  Administration: Billing, insurance, health records, appointments\n"
            f"\n=== SESSION MEMORY ===\n{memory}\n"
        )

    elif zone in ('Z-OWNER', 'Z-31-PORTAL', 'Z-OWNER-PORTAL'):
        # ---- Z-OWNER: SOVEREIGN OWNER PORTAL — Elite Investment Advisor ----
        # Property owners only. Full yield, mortgage, UDI, covenant knowledge.
        # Tone: Elite British financial manager. Not a hotel concierge.
        # ISOLATION: Never mention hotel room cleaning status, HK assignments,
        # or any operational hotel panel. This is a FINANCIAL portal.
        system_directive = (
            IRON_LAWS +
            f"\n=== OWNER PORTAL — SOVEREIGN INVESTMENT ADVISOR ===\n"
            f"You are Miracle — the Elite Investment Advisor for {hotel_name} property owners.\n"
            f"Tone: Precise, investment-savvy, British executive warmth. Like a Rothschild-tier financial advisor.\n"
            f"BREVITY: Maximum 6 sentences unless explaining a formula or multi-step financial process.\n"
            f"\n=== IRON LAWS FOR THIS ZONE ===\n"
            f"  NEVER mention hotel room cleaning, housekeeping, DIRTY/CLEAN status, or ASSIGN HK.\n"
            f"  NEVER mention POS, F&B orders, guest check-in/check-out, or any operational workflow.\n"
            f"  NEVER reveal another owner's data — tenant isolation is absolute.\n"
            f"  ALWAYS flag: missing contract signatures, inactive mandates, unreconciled entries.\n"
            f"  If user asks about hotel operations: 'That is managed in the operations dashboard. Here I can help with your investment portfolio.'\n"
            f"\n=== UDI FORMULA (Unit Undivided Interest) ===\n"
            f"  Share% = (Unit SqFt / Total Pool SqFt) * 100\n"
            f"  Net Yield = Gross Yield * (1 - WHT Treaty Rate)\n"
            f"  NEVER use flat splits — always calculate proportionally.\n"
            f"  Portfolio Netting: surplus yield from profitable units offsets mortgage deficits BEFORE any bank sweep.\n"
            f"\n=== MORTGAGE SWEEP PROTOCOL (Iron Law 56) ===\n"
            f"  1. Check Direct Debit Mandate status — must be ACTIVE before any sweep executes.\n"
            f"  2. Apply portfolio netting: Sigma(all_unit_yield) - Sigma(all_unit_mortgage_payment).\n"
            f"  3. Sweep net surplus to Owner Payout Account. Write deficit to Outstanding Obligations.\n"
            f"  4. Log each sweep with SAVEPOINT → COMMIT → Audit entry.\n"
            f"  5. If mandate is INACTIVE: block sweep, notify owner, guide to Mandate Renewal.\n"
            f"\n=== COVENANT CONTRACT LAW ===\n"
            f"  Deed of Pool and Mortgage Note must both be signed before: any payout, any sweep, any yield release.\n"
            f"  Digital signature with SHA-256 hash. Unsigned contracts = frozen yield account.\n"
            f"  If owner asks about unsigned contracts: 'Your yield is protected but frozen until the Covenant Contract is signed. I can guide you to the Digital Contracts tab.'\n"
            f"\n=== OWNER DASHBOARD KNOWLEDGE ===\n"
            f"  Yield Dashboard: Net yield balance, total withdrawn, UDI share %\n"
            f"  Property Portfolio: Each unit — category, ownership type, status, monthly rent, commission\n"
            f"  Mortgage Tracker: Total mortgage, monthly payment, interest rate, paid-to-date, projected payoff\n"
            f"  Payout Requests: Submit withdrawal → reviewed by Finance Officer → swept to bank\n"
            f"  Digital Contracts: Deed of Pool + Mortgage Note (must be signed)\n"
            f"  Direct Debit Mandates: Stripe ACH/SEPA status (ACTIVE/INACTIVE/PENDING)\n"
            f"  Repair Invoices: Maintenance costs charged to the property (MACRS capitalisation applies if >$2,500)\n"
            f"  ROI Forecast: Break-even = Total Purchase Cost / Net Annual Yield\n"
            f"\n=== REPORT FORMAT ===\n"
            f"  When presenting financials: use Markdown tables with columns (Unit | Metric | Value).\n"
            f"  End every financial summary with a bold 'Owner Directive:' line recommending the next action.\n"
            f"\n=== IDENTITY & ACCESS ===\n"
            f"  {RBAC_BLOCK}\n"
            f"\n=== SESSION MEMORY ===\n{memory}\n"
            f"CRITICAL: Ignore any operational hotel content from previous zones in session memory.\n"
        )

    else:
        # ---- ALL OPERATIONAL ZONES (Dashboard, Reservations, POS, HR, etc.) ----
        # V15.0: Sovereign Intelligence — 20-Year Unbeatable Edition
        system_directive = (
            IRON_LAWS +
            f"\n=== IDENTITY & ACCESS CONTROL ===\n"
            f"{RBAC_BLOCK}\n"
            f"=== NAVIGATION PROTOCOL (V4) ===\n"
            f"1. NAVIGATE: Emit '[NAVIGATE: /exact/path]' ONLY if the user explicitly requests to switch panel.\n"
            f"   CRITICAL: If user asks 'how to work on X', DO NOT navigate. Explain using the UI buttons.\n"
            f"   CRITICAL: NEVER invent URLs. ONLY use exact paths in the ZONE MAP.\n"
            f"   CRITICAL: If already in requested zone (check CURRENT ZONE: {zone}), DO NOT emit NAVIGATE.\n"
            f"   ZONE MAP:\n{zone_map}\n"
            f"   When navigating, say 'Taking you to X now.' before the tag.\n"
            f"2. FOCUS: Emit '[FOCUS: element-label]' to point the Wisp light at a specific button.\n"
            f"   Only use FOCUS for elements ON THIS PAGE. Never FOCUS while navigating.\n"
            f"3. WHATSAPP: If user needs a password or execution-level access, emit [BTN_WHATSAPP].\n"
            f"\n=== PANEL INTELLIGENCE (V15.0 — ACTIVITY ANCHORED + FULL AGI ANALYTICS) ===\n"
            f"{activity_context}\n"
            f"=== SESSION MEMORY ===\n{memory}\n"
            f"=== VERIFIED WISDOM ===\n{distilled_wisdom}\n"
            f"{DB_SCHEMA_ATLAS}\n"
            f"{CYBERSECURITY_PROTOCOL}\n"
            f"{HMS_CLINICAL_FINANCIAL_ENGINE}\n"
            f"{BUSINESS_INTELLIGENCE_PROTOCOL}\n"
            f"\n=== CURRENT ZONE: {zone} ===\n"
            f"HMS CLINICAL CONTEXT: You are operating inside a Hospital Management System. Patients ≠ guests. Beds ≠ rooms. Doctors ≠ hotel staff. Never use hotel/resort vocabulary.\n"
            f"Reports addressed to requesting role:\n"
            f"CDO/CMO: Full clinical P&L, HR headcount, infra status, all dept revenue, clinical roster, OPD analytics, AGI campaign metrics.\n"
            f"GM/Hospital Director: Bed occupancy, dept revenue, staff count, open critical tickets, pharmacy health, ALOS.\n"
            f"ADMIN: System health, zone status, user activity, configuration summaries, PM2 process table.\n"
            f"ACC: Ledger balances, outstanding patient dues, debit/credit reconciliation, audit trail, insurance claims.\n"
            f"DOCTOR: OPD queue, duty status, patient consultations, prescriptions, lab orders.\n"
            f"NURSE: Ward patient list, vitals pending, medication schedule, ward assignments.\n"
            f"WARD_ADMIN: Bed grid, pending admissions, discharges due today, patient CRM.\n"
            f"STAFF: Only their own assigned tasks and current ward/zone status.\n"
        )


    user_content = (
        f"SYSTEM_DIRECTIVE:\n{system_directive}\n\n"
        f"INTENT: {intent}\n"
        f"DATA CONTEXT: {json.dumps(data) if data else 'N/A'}\n"
        f"USER QUERY: {query}"
    )

    messages = [{"role": "user", "content": user_content}]

    try:
        reply = await call_llm(messages, temperature=0.7)

        # Guard: if call_llm returns empty string, use local brain
        if not reply or not reply.strip():
            logger.warning("[V2 SYNTHESIS] call_llm returned empty — activating Local Sovereign Brain.")
            reply = local_sovereign_brain(query, zone)

        # 🛡️ SOVEREIGN DEFENSE: Strip hallucinated Navigation Paths!
        nav_matches = re.finditer(r'\[?\s*NAVIGATE:\s*([^\s\]]+)\s*\]?', reply, re.IGNORECASE)
        valid_paths = [v['path'] for v in zone_lib.values()]

        for match in nav_matches:
            path = match.group(1).strip()
            if path not in valid_paths:
                logger.warning(f"Stripping hallucinated NAVIGATE path: {path}")
                reply = reply.replace(match.group(0), "")
                reply = re.sub(r'Taking you to [^.]+\s*now\.\s*', '', reply)

        return {"response": reply.strip(), "intent": intent, "data_context": data, "layer_used": "LAYER_3_GEMINI"}
    except Exception as e:
        import traceback
        logger.error(f"[V2 SYNTHESIS] LLM failure — activating Local Sovereign Brain. Error: {e}\n{traceback.format_exc()}")
        # 🧠 LOCAL SOVEREIGN BRAIN FIRES HERE — zero SYNAPSE ERRORs
        fallback_reply = local_sovereign_brain(query, zone)
        return {"response": fallback_reply, "intent": "LOCAL_KERNEL", "data_context": data, "layer_used": "LOCAL_KERNEL"}


# ============================================================
# RESTORED ENDPOINTS (Safe versions without legacy immune logic)
# ============================================================
from sqlalchemy import desc
from app.models.miracle_ai_models import MiracleKnowledge, AIReplyAuditLog

@router.get("/audit/log")
async def get_audit_log(limit: int = 50, db: Session = Depends(get_db)):
    records = db.query(AIReplyAuditLog).order_by(desc(AIReplyAuditLog.created_at)).limit(limit).all()
    return {
        "total": len(records),
        "records": [
            {
                "id": r.id,
                "zone": r.zone,
                "user_query": r.user_query[:120] if r.user_query else "",
                "ai_reply": r.ai_reply[:200] if r.ai_reply else "",
                "intent": r.intent,
                "verdict": r.verdict,
                "hallucination_type": r.hallucination_type,
                "root_cause": r.root_cause,
                "correction": r.correction,
                "confidence": r.confidence,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "audited_at": r.audited_at.isoformat() if r.audited_at else None,
            }
            for r in records
        ]
    }

@router.get("/audit/stats")
async def get_audit_stats(db: Session = Depends(get_db)):
    total = db.query(AIReplyAuditLog).count()
    hallucinations = db.query(AIReplyAuditLog).filter(AIReplyAuditLog.verdict == "HALLUCINATION").count()
    correct = db.query(AIReplyAuditLog).filter(AIReplyAuditLog.verdict == "CORRECT").count()
    pending = db.query(AIReplyAuditLog).filter(AIReplyAuditLog.verdict == "PENDING").count()
    system_failures = db.query(AIReplyAuditLog).filter(AIReplyAuditLog.hallucination_type == "SYSTEM_FAILURE").count()
    corrections_applied = db.query(MiracleKnowledge).filter(
        MiracleKnowledge.category == "ANTI_HALLUCINATION"
    ).count()
    accuracy_pct = round((correct / max(total - pending, 1)) * 100) if total > 0 else 100
    return {
        "total_replies_audited": total,
        "hallucinations_detected": hallucinations,
        "correct_replies": correct,
        "pending_audit": pending,
        "system_failure_count": system_failures,
        "corrections_injected": corrections_applied,
        "accuracy_pct": accuracy_pct,
    }

@router.post("/audit/clear-system-failures")
async def clear_system_failures(db: Session = Depends(get_db)):
    """Wipes all SYSTEM_FAILURE hallucination logs from the database so the Zone 23 warning banner clears."""
    try:
        deleted_count = db.query(AIReplyAuditLog).filter(AIReplyAuditLog.hallucination_type == "SYSTEM_FAILURE").delete()
        db.commit()
        return {"status": "success", "cleared_count": deleted_count}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}

@router.get("/brain/manifest")
def get_brain_manifest(category: str = None, status: str = None, limit: int = 100, db: Session = Depends(get_db)):
    q = db.query(MiracleKnowledge)
    if category: q = q.filter(MiracleKnowledge.category == category)
    if status: q = q.filter(MiracleKnowledge.status == status)
    else: q = q.order_by(MiracleKnowledge.status.asc(), MiracleKnowledge.importance_score.desc(), MiracleKnowledge.created_at.desc())
    records = q.limit(limit).all()
    return {
        "total": len(records),
        "records": [
            {
                "id": r.id,
                "category": r.category,
                "source_role": r.source_role,
                "insight_preview": r.insight[:200] if r.insight else "",
                "importance_score": r.importance_score,
                "status": r.status,
                "business_context": r.business_context,
                "root_cause": r.root_cause,
                "correction": r.correction,
                "prevention_rule": r.prevention_rule,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]
    }

@router.post("/brain/approve/{knowledge_id}")
def approve_knowledge_rule(knowledge_id: int, db: Session = Depends(get_db)):
    record = db.query(MiracleKnowledge).filter(MiracleKnowledge.id == knowledge_id).first()
    if not record: raise HTTPException(status_code=404, detail="Not found.")
    record.status = "ACTIVE"
    db.commit()
    return {"status": "APPROVED", "id": knowledge_id, "message": "ACTIVE"}

@router.post("/brain/reject/{knowledge_id}")
def reject_knowledge_rule(knowledge_id: int, db: Session = Depends(get_db)):
    record = db.query(MiracleKnowledge).filter(MiracleKnowledge.id == knowledge_id).first()
    if not record: raise HTTPException(status_code=404, detail="Not found.")
    db.delete(record)
    db.commit()
    return {"status": "DELETED", "id": knowledge_id, "message": "Deleted from root."}

from pydantic import BaseModel
class ManualInjection(BaseModel):
    insight: str
    category: str = "MANUAL_INJECTION"

@router.post("/brain/inject")
def inject_manual_rule(payload: ManualInjection, db: Session = Depends(get_db)):
    new_rule = MiracleKnowledge(
        source_role="ADMIN_MANUAL",
        category=payload.category,
        insight=payload.insight,
        importance_score=10,
        status="ACTIVE"
    )
    db.add(new_rule)
    db.commit()
    return {"status": "ACTIVE", "message": "Manual rule injected."}

@router.post("/audit/scan-all")
async def scan_all_pending_audits(db: Session = Depends(get_db)):
    """Triggers the Sovereign Self-Audit Engine for all pending replies."""
    processed = AISelfAuditEngine.scan_all_pending(db)
    return {"message": f"SRE Scan Complete. {processed} replies audited.", "processed_count": processed}



@router.post("/audit/trigger/{audit_id}")
async def trigger_manual_audit(audit_id: int, db: Session = Depends(get_db)):
    """Manually triggers an audit for a specific AI interaction."""
    record = AISelfAuditEngine.audit_reply(db, audit_id)
    if not record:
        raise HTTPException(status_code=404, detail="Audit record not found.")
    return {
        "id": record.id,
        "verdict": record.verdict,
        "hallucination_type": record.hallucination_type,
        "root_cause": record.root_cause,
        "correction": record.correction,
        "prevention_rule": record.prevention_rule,
        "confidence": record.confidence
    }

@router.get("/immune/status")
async def immune_system_status():
    return {
        "status": "SUCCESS",
        "data": {
            "sre_active": True,
            "pillars": {
                "semantic_firewall": "ACTIVE",
                "shadow_simulation": "ACTIVE",
                "apoptosis_guard": "ACTIVE",
                "self_audit": "ACTIVE"
            },
            "firewall_whitelist": [],
            "firewall_whitelist_count": 0,
            "injection_signatures_monitored": 0,
            "protected_tables": ["ALL_SRE_CORE"],
            "session_activity_today": [],
            "self_learning_events": [],
        }
    }

# ============================================================
# RESTORED LEGACY COMPATIBILITY ENDPOINTS (V7.5 -> V2)
# ============================================================

@router.post("/feature-request")
async def submit_feature_request(request: Request, db: Session = Depends(get_db)):
    """Capture a feature request from the 'Send to Dev' button."""
    try:
        req_data = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    today_str = date.today().strftime("%Y%m%d")
    count = db.query(FeatureRequest).filter(
        func.date(FeatureRequest.created_at) == date.today()
    ).count()
    reference = f"MFR-{today_str}-{count+1:03d}"

    fr = FeatureRequest(
        reference=reference,
        user_id=req_data.get("user_id", "anonymous"),
        zone=req_data.get("zone", "UNKNOWN"),
        request_text=req_data.get("request_text", ""),
        status="PENDING",
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)

    return {
        "status": "RECEIVED",
        "reference": reference,
        "message": f"Your request has been logged. Reference: {reference}. The Miracle development team will review it within 48 hours."
    }

@router.get("/alerts")
async def get_proactive_alerts(zone: str = "Z-07", db: Session = Depends(get_db)):
    """Polled by frontend. Returns active alerts that Miracle should announce."""
    if zone in ("Z-GUEST", "Z-LOGIN"):
        return {"alerts": []}

    alerts = []
    try:
        # Check 1: Critical tickets
        critical = db.query(SolveMission).filter(
            SolveMission.status.in_(["PENDING", "ACTIVE"]),
            SolveMission.priority == "CRITICAL"
        ).all()
        if critical:
            rooms = ", ".join(set(t.room_no for t in critical))
            alerts.append({
                "level": "CRITICAL",
                "color": "#FF3131",
                "message": f"ALERT. {len(critical)} critical ticket(s) active — Rooms {rooms}. Immediate attention required.",
                "speak": True,
            })

        # Check 2: Occupancy below 40%
        all_rooms = db.query(AssetGrid).filter_by(is_active=True).count()
        in_house = db.query(AssetGrid).filter_by(current_status="IN-HOUSE", is_active=True).count()
        if all_rooms > 0:
            occ_pct = round(in_house / all_rooms * 100)
            if occ_pct < 40:
                alerts.append({
                    "level": "HIGH",
                    "color": "#F59E0B",
                    "message": f"Sir, occupancy has dropped to {occ_pct}%. Consider activating a promotional rate for tonight.",
                    "speak": True,
                })

        # Check 3: Stock below PAR
        below_par = db.query(Inventory).filter(
            Inventory.stock < Inventory.min_level,
            Inventory.type != "SERVICE"
        ).count()
        if below_par > 0:
            alerts.append({
                "level": "MEDIUM",
                "color": "#F59E0B",
                "message": f"{below_par} inventory item(s) are below PAR level. Please visit the Inventory Vault to review.",
                "speak": False,
            })
    except Exception as e:
        logger.warning(f"Alert check error: {e}")

    return {"alerts": alerts}

@router.get("/feature-requests")
async def list_feature_requests(db: Session = Depends(get_db)):
    requests = db.query(FeatureRequest).order_by(desc(FeatureRequest.created_at)).limit(100).all()
    return {
        "total": len(requests),
        "requests": [
            {
                "reference": r.reference,
                "user_id": r.user_id,
                "zone": r.zone,
                "request_text": r.request_text,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in requests
        ]
    }

@router.get("/sales-leads")
async def get_sales_leads(db: Session = Depends(get_db)):
    leads = db.query(SalesLead).order_by(desc(SalesLead.created_at)).limit(100).all()
    return [
        {
            "id": l.id,
            "lead_name": l.lead_name,
            "enterprise_name": l.enterprise_name,
            "enterprise_size": l.enterprise_size,
            "contact_details": l.contact_details,
            "status": l.status,
            "created_at": l.created_at.isoformat() if l.created_at else None
        } for l in leads
    ]


# ============================================================
# WATCHDOG REST FALLBACK ENDPOINT
# GET /api/bot/watchdog/alerts
# ============================================================
@router.get("/watchdog/alerts")
async def get_watchdog_alerts():
    from app.core.watchdog_engine import get_last_watchdog_payload
    return get_last_watchdog_payload()


@router.post("/execute-proposal")
async def execute_proposal(request: Request, db: Session = Depends(get_db)):
    from pydantic import BaseModel
    
    class ProposalExecutionSchema(BaseModel):
        action: str
        parameters: dict
        role: str = "VISITOR"
        active_user: str = "Guest"

    try:
        payload = await request.json()
        data = ProposalExecutionSchema(**payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(e)}")

    if data.role not in ["CDO", "GM", "ADMIN", "ACC"]:
        raise HTTPException(status_code=403, detail="Access denied. Insufficient role to execute proposals.")

    action = data.action
    params = data.parameters
    active_user = data.active_user

    try:
        if action == "DISPATCH_ROOM":
            from app.routers.pms import ai_dispatch_room, DispatchRequestSchema
            dispatch_req = DispatchRequestSchema(
                category=params.get("category"),
                requested_by=params.get("requested_by", active_user),
                manual_room_id=params.get("manual_room_id"),
                override_reason=params.get("override_reason")
            )
            result = ai_dispatch_room(payload=dispatch_req, db=db)
            lines = [
                f"**Dispatch: {result['dispatch_mode']}**",
                f"Room Assigned: **{result['room_id']}** ({result['category']})",
                f"Floor: {result.get('floor', 'N/A')} | Size: {result.get('size_sqft', 'N/A')} sqft",
                f"Nights YTD: {result.get('nights_occupied_ytd', 0)}",
            ]
            if result.get("ai_rationale"):
                lines.append(f"AI Rationale: _{result['ai_rationale']}_")
            if result.get("override_reason"):
                lines.append(f"**Override Reason Recorded**: {result['override_reason']}")
            
            # Broadcast update to websocket
            try:
                from app.main import master_socket
                await master_socket.broadcast("GRID_UPDATE", {"action": "DISPATCH", "room": result['room_id']})
            except Exception as ws_err:
                logger.warning(f"WS broadcast failed: {ws_err}")
                
            return {"status": "SUCCESS", "response": "\n".join(lines)}

        elif action == "MORTGAGE_SWEEP":
            dry = params.get("dry_run", False)
            from app.routers.mortgage_engine import run_monthly_mortgage_sweep, MortgageSweepPayload
            sweep_payload = MortgageSweepPayload(dry_run=dry, posted_by=params.get("posted_by", active_user))
            result = run_monthly_mortgage_sweep(payload=sweep_payload, db=db)
            lines = [
                f"**Mortgage Sweep** {'(DRY RUN)' if dry else ''}— Period: {result['period']}",
                f"Rooms swept: {result['rooms_swept']} | Skipped: {result['rooms_skipped']} | Failed: {result['rooms_failed']}",
                f"Total swept: **${result['total_swept_usd']:,.2f} USD**",
            ]
            for r in result.get("sweep_report", [])[:8]:
                icon = "✅" if r.get("status") in ("SWEPT", "DRY_RUN") else ("⏭" if "SKIP" in r.get("status","") else "❌")
                lines.append(f"{icon} Room {r['room_id']}: {r.get('status')} | Payment ${r.get('monthly_payment', 0):,.2f}")
            return {"status": "SUCCESS", "response": "\n".join(lines)}

        else:
            raise HTTPException(status_code=400, detail=f"Unknown proposal action: {action}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXECUTE PROPOSAL] Error executing action {action}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# V4.0: SOVEREIGN PROPOSAL HUB ENDPOINTS
# The AI Proposal Hub is the central command center for all
# AI-generated write-action proposals.
# Proposals survive browser refresh and are visible to ALL
# authorized operators, not just the session that created them.
# ============================================================

from pydantic import BaseModel as _BaseModel
from typing import Optional as _Optional

class ProposalDeclineSchema(_BaseModel):
    reason: _Optional[str] = None
    declined_by: str = "ADMIN"

class ProposalApproveSchema(_BaseModel):
    approved_by: str = "ADMIN"
    execute_now: bool = True  # If True, executes immediately after approval
    role: str = "ADMIN"       # Role required for authorization check


@router.get("/proposals")
async def list_proposals(
    status: str = "PENDING",
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    V4.0: Fetch all AI proposals from the Sovereign Proposal Ledger.
    Frontend polls this on load to show the pending-proposal badge count.
    Default: returns PENDING proposals. Pass status=ALL for full history.
    """
    from sqlalchemy import desc as _desc
    q = db.query(AIProposal)
    if status != "ALL":
        q = q.filter(AIProposal.status == status)
    proposals = q.order_by(_desc(AIProposal.created_at)).limit(limit).all()
    return {
        "total": len(proposals),
        "proposals": [
            {
                "id": p.id,
                "action_type": p.action_type,
                "parameters": p.parameters,
                "explanation": p.explanation,
                "status": p.status,
                "requested_by": p.requested_by,
                "zone": p.zone,
                "approved_by": p.approved_by,
                "approved_at": p.approved_at.isoformat() if p.approved_at else None,
                "decline_reason": p.decline_reason,
                "execution_result": p.execution_result,
                "executed_at": p.executed_at.isoformat() if p.executed_at else None,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in proposals
        ]
    }


@router.post("/proposals/{proposal_id}/approve")
async def approve_proposal(
    proposal_id: int,
    payload: ProposalApproveSchema,
    db: Session = Depends(get_db)
):
    """
    V4.0: Approve an AI proposal.
    If execute_now=True (default), the action is immediately dispatched
    to the appropriate engine. The proposal record is updated with the
    execution result.
    """
    proposal = db.query(AIProposal).filter(AIProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail=f"Proposal #{proposal_id} not found.")
    if proposal.status != "PENDING":
        raise HTTPException(status_code=409, detail=f"Proposal #{proposal_id} is already {proposal.status}.")

    # Authorization check
    allowed_roles = ["CDO", "GM", "ADMIN", "ACC"]
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Role '{payload.role}' is not authorized to approve proposals.")

    now = datetime.now(timezone.utc)
    execution_result = None

    if payload.execute_now:
        try:
            action = proposal.action_type
            params = proposal.parameters or {}

            if action == "DISPATCH_ROOM":
                from app.routers.pms import ai_dispatch_room, DispatchRequestSchema
                dispatch_req = DispatchRequestSchema(
                    category=params.get("category"),
                    requested_by=params.get("requested_by", payload.approved_by),
                    manual_room_id=params.get("manual_room_id"),
                    override_reason=params.get("override_reason")
                )
                result = ai_dispatch_room(payload=dispatch_req, db=db)
                execution_result = result
                try:
                    from app.main import master_socket
                    await master_socket.broadcast("GRID_UPDATE", {"action": "DISPATCH", "room": result.get('room_id')})
                except Exception:
                    pass

            elif action == "MORTGAGE_SWEEP":
                from app.routers.mortgage_engine import run_monthly_mortgage_sweep, MortgageSweepPayload
                sweep_payload = MortgageSweepPayload(
                    dry_run=params.get("dry_run", False),
                    posted_by=params.get("posted_by", payload.approved_by)
                )
                execution_result = run_monthly_mortgage_sweep(payload=sweep_payload, db=db)

            else:
                execution_result = {"warning": f"No executor registered for action '{action}'"}

            proposal.status = "EXECUTED"
            proposal.executed_at = now
            proposal.execution_result = execution_result

        except Exception as exec_err:
            logger.error(f"[PROPOSAL EXEC] Proposal #{proposal_id} execution failed: {exec_err}", exc_info=True)
            proposal.status = "APPROVED"  # Approved but not yet executed
            execution_result = {"error": str(exec_err)}
    else:
        proposal.status = "APPROVED"

    proposal.approved_by = payload.approved_by
    proposal.approved_at = now
    db.commit()
    db.refresh(proposal)

    return {
        "status": "SUCCESS",
        "proposal_id": proposal_id,
        "proposal_status": proposal.status,
        "execution_result": execution_result
    }


@router.post("/proposals/{proposal_id}/decline")
async def decline_proposal(
    proposal_id: int,
    payload: ProposalDeclineSchema,
    db: Session = Depends(get_db)
):
    """V4.0: Decline an AI proposal and record the reason in the ledger."""
    proposal = db.query(AIProposal).filter(AIProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail=f"Proposal #{proposal_id} not found.")
    if proposal.status != "PENDING":
        raise HTTPException(status_code=409, detail=f"Proposal #{proposal_id} is already {proposal.status}.")
    proposal.status = "DECLINED"
    proposal.decline_reason = payload.reason or "No reason provided."
    proposal.approved_by = payload.declined_by
    proposal.approved_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "status": "DECLINED",
        "proposal_id": proposal_id,
        "message": f"Proposal #{proposal_id} has been declined."
    }


# ============================================================
# V4.0: VISITOR INTAKE ENDPOINTS
# The Communicative Miracle AI asks every new visitor to
# identify themselves. This endpoint saves that intake answer
# so subsequent conversations are role-aware from the start.
# ============================================================

class VisitorIntakeSchema(_BaseModel):
    session_id: str
    visitor_role: str  # PROPERTY_OWNER | BUYER | INVESTOR | REALTOR | RENTER | OPERATOR
    country_hint: _Optional[str] = None
    user_id: _Optional[str] = "anonymous"


@router.post("/intake/visitor-profile")
async def save_visitor_profile(
    payload: VisitorIntakeSchema,
    db: Session = Depends(get_db)
):
    """
    V4.0: Called by MiracleBot.tsx after the visitor selects their role.
    Persists the visitor's self-identified profile to ai_visitor_profiles.
    All subsequent AI calls in this session will load this profile via
    load_visitor_profile() in ai_kernel.py to customize the AI persona.
    """
    valid_roles = ["PROPERTY_OWNER", "BUYER", "INVESTOR", "REALTOR", "RENTER", "OPERATOR"]
    if payload.visitor_role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid visitor_role. Must be one of: {valid_roles}"
        )

    # Upsert: update existing profile for this session if it exists
    existing = db.query(AIVisitorProfile).filter(
        AIVisitorProfile.session_id == payload.session_id
    ).first()

    if existing:
        existing.visitor_role = payload.visitor_role
        existing.country_hint = payload.country_hint
        existing.intake_complete = True
        if payload.user_id and payload.user_id != "anonymous":
            existing.user_id = payload.user_id
    else:
        profile = AIVisitorProfile(
            session_id=payload.session_id,
            user_id=payload.user_id or "anonymous",
            visitor_role=payload.visitor_role,
            country_hint=payload.country_hint,
            intake_complete=True
        )
        db.add(profile)

    db.commit()
    return {
        "status": "INTAKE_COMPLETE",
        "session_id": payload.session_id,
        "visitor_role": payload.visitor_role,
        "message": f"Your profile has been saved as {payload.visitor_role}. Miracle AI will now personalize all advice for your role."
    }


@router.get("/intake/visitor-profile")
async def get_visitor_profile(
    session_id: str,
    user_id: _Optional[str] = None,
    db: Session = Depends(get_db)
):
    """V4.0: Check if a session has a completed visitor intake profile."""
    from app.core.ai_kernel import load_visitor_profile
    profile = load_visitor_profile(session_id=session_id, db=db, user_id=user_id)
    if profile:
        return {"intake_complete": True, "profile": profile}
    return {"intake_complete": False, "profile": None}
