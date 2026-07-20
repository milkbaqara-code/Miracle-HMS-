# ============================================================
# MIRACLE HMS — BACKEND CLINICAL KERNEL v67.0 (SOVEREIGN)
# 
# INDEX / TABLE OF CONTENTS:
# 1. SOVEREIGN EVENT MATRIX (WS) (Lines 15-50)
# 2. SOVEREIGN ROUTER MAPPING (Lines 52-70)
# 3. KERNEL LIFESPAN & GENESIS (Lines 90-120)
# 4. KERNEL INITIALIZATION (Lines 122-132)
# 5. MIDDLEWARE & SECURITY SHIELDS (Lines 134-190)
# 6. OPERATIONAL ZONE MOUNTING (Lines 192-223)
# 7. MASTER TELEMETRY & HEALTH (Lines 225-254)
# ============================================================
import time
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, Request, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

# ==========================================
# 0. THE SOVEREIGN EVENT MATRIX (WEBSOCKETS)
# ==========================================
class SovereignConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"📡 WEBSOCKET CONNECTED: Total Nodes: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"🔌 WEBSOCKET DISCONNECTED: Total Nodes: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, payload: dict):
        if event_type == "GRID_UPDATE":
            try:
                from app.core.database import SessionLocal
                from app.routers.frontdesk_engine import get_live_grid
                db = SessionLocal()
                try:
                    grid_res = await get_live_grid(db)
                    payload = {"grid_state": grid_res.get("data", []), "action": payload.get("action", "SYNC")}
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"WS Full Payload Failure: {e}")

        message = {"event": event_type, "data": payload, "timestamp": datetime.now(timezone.utc).isoformat()}
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"⚠️ WEBSOCKET BROADCAST ERROR: {str(e)}")

master_socket = SovereignConnectionManager()

# ==========================================
# 1. SOVEREIGN ROUTER MAPPING (ALIGNED v66.0)
# ==========================================
from app.routers import (
    auth as auth_module,       # ZONE 02: IDENTITY
    hr as hr_module,           # ZONE 09: HR ROI ENGINE
    hr_talent_engine as ste_mod, # ZONE 09: SOVEREIGN TALENT ENGINE (STE)
    hr_compliance as hr_comp_mod, # ZONE 09: HR COMPLIANCE ENGINE (Visa/Docs/Gratuity)
    hr_leave as hr_leave_mod,     # ZONE 09: HR LEAVE MANAGEMENT ENGINE (UAE Labour Law)
    hr_training as hr_train_mod,  # ZONE 09: HR TRAINING ENGINE
    solve_router as solve_mod, # ZONE 16/17: RADAR & MISSIONS
    inventory_engine as inv,   # ZONE 12: MASTER VAULT
    frontdesk_engine as fd,    # ZONE 05/08: RESERVATIONS & FOLIO
    reservation_engine as res, # ZONE 05: OTA CHANNELS & MASTER RESERVATIONS
    accounting_engine as acc_engine, # ZONE 18: SOVEREIGN ACCOUNTING KERNEL
    accounting_enterprise as acc_enterprise_mod, # ZONE 18: ENTERPRISE ACCOUNTING KERNEL V2
    billing as billing_mod,    # ZONE 08: GUEST FOLIO & BILLING
    pos_router as pos_module,  # ZONE 14: POS ENGINE
    policy as policy_module,   # ZONE 19: ARCHITECTURE LAW (NEW)
    settings as kernel_mod,    # ZONE 21: KERNEL SETTINGS (NEW)
    bot_router_v2 as bot_v2,     # MIRACLE BOT V2: AGENTIC 3-LAYER ENGINE
    infra as infra_mod,          # ZONE 23: SOVEREIGN INFRASTRUCTURE
    guest_api as guest_api,      # ZONE 25: GUEST MARKETING ENGINE
    surgical_fixes_router as surgical_fixes_mod, # SURGICAL FIXES SYNC
    diagnostic_scanner as diag_mod,  # ZONE 23: SOVEREIGN DIAGNOSTIC SCANNER

    visitor_otp_router as visitor_otp_mod, # Z-LOGIN: VISITOR OTP ENGINE
    doctor_api as doctor_api_mod,          # Z-DOCTOR: PHYSICIAN PORTAL
    visitor_ai as visitor_ai_mod,          # ZONE 19: VISITOR AI
    visitor_tour_router as visitor_tour_mod, # Z-TOUR: VISITOR GUIDED TOUR ENGINE

    accounting_vault as acc_vault_mod, # ZONE 18: SOVEREIGN ACCOUNTING VAULT
    synapse_nexus as synapse_mod,      # ZONE 20: SOVEREIGN SYNAPSE NEXUS
    synapse_agi as synapse_agi_mod,    # ZONE 20: SYNAPSE AGI ARBITRATOR ENGINE
    synapse_efficiency as synapse_eff_mod, # ZONE 20: EFFICIENCY ENGINE
    synapse_departments as synapse_dept_mod, # ZONE 20: SYNAPSE COMMAND GRID MATRIX
    anatomy_router as anatomy_mod,           # ZONE 23: SOVEREIGN ANATOMY ENGINE
    global_data as global_data_mod,          # GLOBAL DATA SYNC (Weather/FX)
    guest_bot_router as guest_bot_mod,       # GUEST AGI BUTLER ENGINE
    agi_coa_engine as agi_coa_mod,           # ZONE 11: AGI CoA INTELLIGENCE ENGINE
    # ── WEB BUILDER COMMERCIAL ──────────────────────────────────────────────
    wb_auth as wb_auth_mod,                  # WB: SUBSCRIBER AUTH GATE
    wb_projects as wb_projects_mod,          # WB: PROJECT MANAGEMENT
    wb_payments as wb_payments_mod,          # WB: STRIPE PAYMENT GATEWAY
    media_campaign as media_campaign_mod,    # ZONE 14: AGI CAMPAIGN ENGINE (NEW)
    sgpe as sgpe_mod,                          # ZONE SGPE: SOVEREIGN GLOBAL POLICY ENGINE
    agi_recruiting as agi_recruiting_mod,    # Z-2B: AGI RECRUITING & DEPARTMENT BUILDER
    dept_accounting as dept_acc_mod,         # Z-11: DEPARTMENTAL ACCOUNTING ENGINE (Phase 6)
    tenant_router as tenant_mod,
    licensing_router as licensing_mod,         # Z-LIC: ZONE LICENSING ENGINE (Package Selector)
    control_panel as control_panel_mod,
    content_creator_engine as cc_engine_mod,   # Z-CC: MIRACLE CONTENT CREATOR AGI ENGINE
    media_vault as mv_mod,                     # Z-MV: MIRACLE MEDIA VAULT (Studio)
    hms as hms_mod,                            # CLINICAL HMS ROUTER
    emergency as emergency_mod,                # RERS: REAL-TIME EMERGENCY RESPONSE SYSTEM
    brain_router as brain_router_mod,          # ZONE AI: CDO BRAIN MANAGEMENT API
)


# 🤖 MIRACLE AI V3: Register new tables for Genesis auto-creation
from app.models import miracle_ai_models as _miracle_ai_models  # noqa: F401
# 🌐 WEB BUILDER: Register wb_ tables for auto-creation
from app.models import wb_models as _wb_models  # noqa: F401
# 🩺 CLINICAL TABLES: Register clinical tables for auto-creation
from app.models.models import PatientVitals, PatientConsultation, Prescription, LabOrder, InsuranceClaim, OPDAppointment, EmergencyAlert, WristbandDevice  # noqa: F401

# Core Self-Healer
from app.core.genesis import run_genesis_sequence 

# --- ENTERPRISE LOGGING SETUP ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | 🛡️ KERNEL | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("MasterOS")

# ==========================================
# 2. MODERN LIFESPAN MANAGER
# ==========================================
@asynccontextmanager
async def system_lifespan(app: FastAPI):
    """Sovereign boot sequence with Atomic Genesis."""
    logger.info("=========================================================")
    logger.info("   VIGILANT MASTER OS - BACKEND KERNEL [CDO CONTROL]     ")
    logger.info("   STATUS: INITIATING SOVEREIGN HANDSHAKE                ")
    logger.info("=========================================================")
    
    try:
        logger.info("🛡️ KERNEL: Executing Master Genesis Sequence...")
        run_genesis_sequence()
        logger.info("✅ GENESIS COMPLETE: Asset Grid & System Config Locked.")
        
        # 🏛️ SOVEREIGN VAULT IGNITION
        from app.core.database import SessionLocal
        from app.routers.accounting_engine import seed_coa
        db = SessionLocal()
        try:
            seed_coa(db)
            logger.info("🏛️ ACCOUNTING KERNEL: Chart of Accounts Synchronized.")
        finally:
            db.close()

        # 🏦 PHASE 6: DEPARTMENTAL ACCOUNTING ENGINE — seed tables & default vaults
        db_acc = SessionLocal()
        try:
            from app.routers.dept_accounting import seed_department_accounting
            seed_department_accounting(db_acc)
            logger.info("🏦 DEPT-ACC: 7 department vaults initialized. Expense catalogs seeded.")
        finally:
            db_acc.close()

        # 🌐 WEB BUILDER: Seed subscription plan tiers
        db2 = SessionLocal()
        try:
            from app.routers.wb_auth import seed_wb_plans
            seed_wb_plans(db2)
            logger.info("🌐 WEB BUILDER: Subscription plan tiers seeded (free/pro/enterprise).")
        finally:
            db2.close()

        # 🌍 SGPE: Seed built-in sovereign policy configs
        db3 = SessionLocal()
        try:
            from app.routers.sgpe import seed_sgpe_policies
            seed_sgpe_policies(db3)
            logger.info("🌍 SGPE: Sovereign policy configs seeded (UAE, US, BD, GR, TR).")
        finally:
            db3.close()

        # 🛡️ PHASE 4B: Pre-load Prompt Firewall kernel on boot
        try:
            from app.core.prompt_firewall import get_kernel_status
            ks = get_kernel_status()
            logger.info(f"🛡️ PROMPT FIREWALL: Active — {ks['regex_patterns_count']} regex rules, {ks['blocked_patterns_count']} kernel patterns. Kernel: '{ks['identity']}'.")
        except Exception as fw_err:
            logger.warning(f"🛡️ PROMPT FIREWALL: Kernel load warning — {fw_err}")

        # ⚡ AUTO-PURGE SCHEDULER: Purge COMPLETED directives > 48h old every 12 hours
        import asyncio
        async def auto_purge_loop():
            await asyncio.sleep(30)  # Wait for full server stabilization
            while True:
                try:
                    logger.info("🛡️ KERNEL: Running automated 48-hour completed directive purge...")
                    from app.core.database import SessionLocal as PurgeSession
                    from app.routers.synapse_efficiency import purge_completed_directives
                    pdb = PurgeSession()
                    try:
                        res = purge_completed_directives(pdb)
                        logger.info(f"🛡️ KERNEL: Automated purge completed successfully: {res}")
                    finally:
                        pdb.close()
                except Exception as ex:
                    logger.error(f"🚨 KERNEL: Error during automated directive purge: {ex}")
                await asyncio.sleep(12 * 3600)

        # 🧠 V12.0 KERNEL SYNC SCHEDULER: Auto-learns new panels every 5 minutes
        async def auto_kernel_sync_loop():
            await asyncio.sleep(15)  # Wait for full server stabilization
            from pathlib import Path
            # Search order: VPS path -> local app folder -> workspace root
            kernel_path = Path(__file__).parent.parent / "miracle_kernel.json"
            if not kernel_path.exists():
                kernel_path = Path(__file__).parent / "miracle_kernel.json"
            if not kernel_path.exists():
                kernel_path = Path(__file__).parent.parent.parent / "miracle_kernel.json"
            while True:
                try:
                    from app.core.database import SessionLocal as SyncSession
                    from app.core.kernel_intelligence_sync import sync_kernel_knowledge
                    sdb = SyncSession()
                    try:
                        sync_kernel_knowledge(sdb, kernel_path)
                    finally:
                        sdb.close()
                except Exception as ex:
                    logger.error(f"🚨 KERNEL SYNC LOOP FAILED: {ex}")
                await asyncio.sleep(300) # 5 minutes

        asyncio.create_task(auto_purge_loop())
        asyncio.create_task(auto_kernel_sync_loop())
        # SOVEREIGN PROACTIVE WATCHDOG — pre-checkout, inventory, SLA scanner
        from app.core.watchdog_engine import run_proactive_watchdog
        asyncio.create_task(run_proactive_watchdog())

        # 🤖 Z-CC: AGI CAMPAIGN CHRONO-TRIGGER — auto-generates & publishes content Tue/Thu
        from app.routers.content_creator_engine import run_agi_campaign_pulse
        asyncio.create_task(run_agi_campaign_pulse())
        logger.info("🤖 Z-CC: AGI Campaign Chrono-Trigger daemon online. Fires: TUE/THU 09:00 UTC.")

        # 🌍 GLOBAL DATA SYNC SCHEDULER: Auto-fetches Weather & FX every 1 hour
        async def auto_global_data_sync_loop():
            await asyncio.sleep(5)  # Fetch immediately after boot
            while True:
                try:
                    logger.info("🌍 GLOBAL DATA: Proactively fetching Weather & FX for cache...")
                    from app.routers.global_data import update_weather_cache, update_fx_cache
                    # Force cache update by resetting timestamps before calling
                    from app.routers.global_data import global_cache
                    global_cache.last_weather_fetch = 0
                    global_cache.last_fx_fetch = 0
                    await asyncio.gather(update_weather_cache(), update_fx_cache())
                    logger.info("✅ GLOBAL DATA: Cache successfully warmed.")
                except Exception as ex:
                    logger.error(f"🚨 GLOBAL DATA SYNC LOOP FAILED: {ex}")
                await asyncio.sleep(3600) # 1 hour
        asyncio.create_task(auto_global_data_sync_loop())

        # 💱 PHASE 1A: DAILY FOREX SYNC DAEMON
        from app.workers.forex_sync import run_forex_sync_daemon
        asyncio.create_task(run_forex_sync_daemon())
        logger.info("💱 FOREX DAEMON: Daily rate sync scheduled (boot + 00:00 UTC).")

        # 🛡️ PHASE 2A: BIOMETRIC OVER-HOUR SUPERVISOR
        from app.workers.biometric_supervisor import run_biometric_supervisor
        asyncio.create_task(run_biometric_supervisor())
        logger.info("🛡️ BIOMETRIC SUPERVISOR: 10-minute scan cycle armed.")

        # ⚙️ SOVEREIGN BACKGROUND JOB WORKER: Asynchronous co-owner disbursements & Synapse directives
        from app.workers.background_job_worker import run_background_job_worker
        asyncio.create_task(run_background_job_worker())
        logger.info("⚙️ BACKGROUND JOB WORKER: Database-backed background queue runner armed.")

        # 🧹 V4.0: SOVEREIGN SESSION REAPER — Hourly TTL purge of expired AI memory
        # Deletes miracle_sessions rows older than 8 hours. Keeps the table lean
        # under high multi-user concurrency. Uses raw DELETE for O(1) efficiency.
        async def auto_session_purge_loop():
            await asyncio.sleep(60)  # Short boot delay — let Genesis finish first
            while True:
                try:
                    from app.core.database import SessionLocal as _PurgeSession
                    from app.core.ai_kernel import purge_expired_sessions
                    _pdb = _PurgeSession()
                    try:
                        result = purge_expired_sessions(_pdb)
                        logger.info(f"🧹 SESSION REAPER: {result.get('purged_rows', 0)} expired memory rows purged (TTL=8h).")
                    finally:
                        _pdb.close()
                except Exception as _ex:
                    logger.error(f"🚨 SESSION REAPER FAILED: {_ex}")
                await asyncio.sleep(3600)  # Repeat every 1 hour

        asyncio.create_task(auto_session_purge_loop())
        logger.info("🧹 SESSION REAPER: Hourly memory TTL sweep armed (8-hour expiry).")
    except Exception as e:
        logger.critical(f"🚨 GENESIS FAILURE: System unstable. Reason: {e}")
    
    yield
    
    logger.info("INITIATING CLEAN SHUTDOWN: Severing Vault links.")

# ==========================================
# 3. KERNEL INITIALIZATION
# ==========================================
app = FastAPI(
    title="Miracle HMS | Healthcare Intelligence Kernel",
    description="Sovereign Architecture for Hospital Management System.",
    version="66.0.0", 
    contact={"name": "CDO Sajeed", "url": "https://vigilantitsolution.com"},
    docs_url="/api/docs", 
    redoc_url=None, 
    lifespan=system_lifespan
)

# ==========================================
# 4. HIGH-PERFORMANCE MIDDLEWARE & SHIELDS
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Local dev
        "http://localhost:3065",
        "http://127.0.0.1:3065",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost",
        "https://localhost",
        # Android APK (Capacitor)
        "capacitor://localhost",
        "http://localhost:8080",
        # Production domains
        "https://miracle.vigilantitsolution.com",
        "https://api.vigilantitsolution.com",
        "https://demo.vigilantitsolution.com",
        "https://vigilantitsolution.com",
        # Web Builder
        "https://builder.miracleos.com",
        "https://miracleos.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Network Latency Shield."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Vigilant-Process-Time"] = f"{process_time:.4f} sec"
    return response

@app.middleware("http")
async def visitor_security_firewall(request: Request, call_next):
    """
    🛡️ SOVEREIGN FIREWALL: 200% Solid RBAC for Visitors.
    Physically blocks any DB mutation at the network layer if the token role is VISITOR.
    """
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        safe_paths = [
            "/api/auth/token",
            "/api/bot/query",
            "/api/bot/v2/query",
            "/api/infra/browser-error",
            # WEB BUILDER — these use their own WB JWT, not the hotel VISITOR role
            "/api/wb/auth/register",
            "/api/wb/auth/login",
            "/api/wb/payments/webhook",  # Stripe calls this — no user token
        ]
        if request.url.path not in safe_paths:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                try:
                    from jose import jwt
                    payload = jwt.decode(token, options={"verify_signature": False})
                    if payload.get("role", "").upper() == "VISITOR":
                        logger.warning(f"🚨 FIREWALL BLOCKED VISITOR MUTATION: {request.method} {request.url.path}")
                        return JSONResponse(
                            status_code=status.HTTP_403_FORBIDDEN,
                            content={"status": "ERROR", "message": "Enterprise Demo Mode: Execution commands are disabled for visitors."}
                        )
                except Exception:
                    pass
    return await call_next(request)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"🚨 KERNEL PANIC: {request.method} {request.url} | Error: {str(exc)}")
    
    # --- CDO DIAGNOSTICS PIPELINE INJECTION ---
    try:
        from app.core.database import SessionLocal
        from app.models.miracle_ai_models import SystemErrorLogs
        import traceback
        db = SessionLocal()
        tb_str = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        log = SystemErrorLogs(
            source="BACKEND",
            error_type=type(exc).__name__[:128],
            error_message=str(exc),
            stack_trace=tb_str,
            url=str(request.url)[:255],
            user_agent=request.headers.get("user-agent", "")[:512],
        )
        db.add(log)
        db.commit()
        db.close()
    except Exception as log_err:
        logger.error(f"Failed to write to SystemErrorLogs: {log_err}")
    # ------------------------------------------

    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"status": "CRITICAL_FAILURE", "message": "Kernel Exception Intercepted.", "detail": str(exc)}
    )
    # 🛡️ SOVEREIGN SHIELD: Manually inject CORS headers for crash recovery
    origin = request.headers.get("origin")
    allowed = [
        "https://miracle.vigilantitsolution.com",
        "https://api.vigilantitsolution.com",
        "https://demo.vigilantitsolution.com",
        "https://vigilantitsolution.com",
        "http://localhost:3000",
        "http://localhost",
        "capacitor://localhost",
    ]
    if origin in allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


# ==========================================
# 5. MOUNT OPERATIONAL ZONES (Sovereign Binding)
# ==========================================
# IDENTITY & ACCESS
app.include_router(auth_module.router, prefix="/api/auth", tags=["ZONE 02: Security Gate"])

# ARCHITECTURE LAW
app.include_router(policy_module.router, prefix="/api/policy", tags=["ZONE 19: Master Policy"])
app.include_router(kernel_mod.router, prefix="/api/settings", tags=["ZONE 21: OS Kernel"])

# HUMAN CAPITAL, TALENT ENGINE, COMPLIANCE & LEAVE
app.include_router(hr_module.router, prefix="/api/hr", tags=["ZONE 09: HR ROI Engine"])
app.include_router(ste_mod.router, prefix="/api", tags=["ZONE 09: Sovereign Talent Engine"])
app.include_router(hr_comp_mod.router, prefix="/api", tags=["ZONE 09: HR Compliance Engine"])
app.include_router(hr_leave_mod.router, prefix="/api", tags=["ZONE 09: HR Leave Management"])
app.include_router(hr_train_mod.router, prefix="/api", tags=["ZONE 09: HR Training Engine"])
app.include_router(solve_mod.router, prefix="/api/solve", tags=["ZONE 16: System Radar"])

# FRONT DESK & FINANCIAL VESSEL
app.include_router(res.router, prefix="/api/reservation", tags=["ZONE 05: OTA Matrix"])
app.include_router(fd.router, prefix="/api/frontdesk", tags=["ZONE 05: Tape Chart"])

# DATA VAULTS & TRANSACTIONAL ENGINES
app.include_router(inv.router, prefix="/api/inventory", tags=["ZONE 12: Stock Control"])
app.include_router(pos_module.router, prefix="/api/pos", tags=["ZONE 14: POS Engine"])
app.include_router(acc_engine.router, prefix="/api/accounting", tags=["ZONE 18: Sovereign Accounting Kernel"])
app.include_router(acc_enterprise_mod.router, prefix="/api/accounting", tags=["ZONE 18: Enterprise Accounting V2"])

# MIRACLE BOT - SOVEREIGN AI ENGINE
app.include_router(bot_v2.router, prefix="/api/bot/v2", tags=["MIRACLE BOT V2: AGENTIC"])

# DOCTOR PORTAL
app.include_router(doctor_api_mod.router, prefix="/api/doctor", tags=["Z-DOCTOR: Physician Command"])

app.include_router(surgical_fixes_mod.router, tags=["SURGICAL FIXES SYNC"])

# SOVEREIGN INFRASTRUCTURE (THE CPANEL MATRIX)
app.include_router(infra_mod.router, prefix="/api/infra", tags=["ZONE 23: Server Subsystems"])
app.include_router(diag_mod.router, prefix="/api", tags=["ZONE 23: Diagnostic Scanner"])
app.include_router(anatomy_mod.router, prefix="/api", tags=["ZONE 23: Sovereign Anatomy"])

# ZONE 25: GUEST MARKETING ENGINE, MIRACLE CINEMA & GUEST AGI BUTLER
app.include_router(guest_api.router, prefix="/api/guest", tags=["ZONE 25: Guest Marketing API"])
app.include_router(guest_bot_mod.router, prefix="/api/guest/bot", tags=["ZONE 25: Guest AGI Butler"])

# Z-LOGIN: VISITOR OTP ENGINE (Lead Capture + OTP Auth)
app.include_router(visitor_otp_mod.router, prefix="/api", tags=["Z-LOGIN: Visitor OTP Engine"])
app.include_router(visitor_ai_mod.router, prefix="/api/visitor/ai", tags=["Visitor AI Engine"])
app.include_router(visitor_tour_mod.router, prefix="/api", tags=["Visitor Tour"])

# ZONE 18 & 20: ACCOUNTING VAULT, SYNAPSE NEXUS & AGI ENGINE
app.include_router(acc_vault_mod.router, prefix="/api", tags=["ZONE 18: Accounting Vault"])
app.include_router(synapse_mod.router, prefix="/api", tags=["ZONE 20: Synapse Nexus"])
app.include_router(synapse_mod.router, prefix="/ws", tags=["ZONE 20: Synapse Nexus WS"])
app.include_router(synapse_agi_mod.router, prefix="/api", tags=["ZONE 20: Synapse AGI Engine"])
app.include_router(synapse_eff_mod.router, tags=["ZONE 20: Synapse Efficiency Engine"])
app.include_router(synapse_dept_mod.router, prefix="/api", tags=["ZONE 20: Synapse Command Grid Matrix"])

# GLOBAL DATA SYNC (Weather & FX)
app.include_router(global_data_mod.router, prefix="/api/global", tags=["Global Data Sync"])

# ZONE 30: PROPERTY MANAGEMENT SYSTEM (PMS)

# Z-MENU / Z-KDS: F&B ORDERS ENGINE (Guest QR Menu + Kitchen Display System)

# Z-DELIVERY: RIDER PORTAL ENGINE (Dispatch, Location, CoD Wallet)

# Z-CC: MIRACLE CONTENT CREATOR AGI ENGINE (Sovereign Campaign Matrix)
app.include_router(cc_engine_mod.router, prefix="/api/content-creator", tags=["Z-CC: Miracle Content Creator"])

# ZONE 30: MORTGAGE AMORTIZATION ENGINE (PHASE 4)

# ZONE 30: PMS COMPLIANCE ALERTING & AI DAEMON (PHASE 7)

# ZONE SGPE: SOVEREIGN GLOBAL POLICY ENGINE
app.include_router(sgpe_mod.router, tags=["Z-SGPE: Sovereign Global Policy Engine"])

# ZONE 11: AGI CoA INTELLIGENCE ENGINE (Self-Expanding Accounting)
app.include_router(agi_coa_mod.router, prefix="/api/accounting", tags=["ZONE 11: AGI CoA Intelligence Engine"])

# ── WEB BUILDER COMMERCIAL ZONE ─────────────────────────────────────────────
app.include_router(wb_auth_mod.router, prefix="/api/wb/auth", tags=["WB: Auth Gate"])
app.include_router(wb_projects_mod.router, prefix="/api/wb/projects", tags=["WB: Projects"])
app.include_router(wb_payments_mod.router, prefix="/api/wb/payments", tags=["WB: Stripe Payments"])
app.include_router(media_campaign_mod.router, prefix="/api/marketing", tags=["ZONE 14: AGI Campaign Engine"])

# Z-2B: AGI RECRUITING & DEPARTMENT BUILDER
app.include_router(agi_recruiting_mod.router, tags=["Z-2B: AGI Recruiting & Department Builder"])

# Z-3B: B2B LUXURY ASSET RENTAL ENGINE

# Z-11: DEPARTMENTAL ACCOUNTING ENGINE (Phase 6 — Sovereign Dept Vaults)
app.include_router(dept_acc_mod.router, prefix="/api/accounting", tags=["Z-11: Departmental Accounting Engine"])

# Z-11F: ACCOUNTING AGI LAYER (Phase 6F — Anomaly Detection, Health Scores, Monthly P&L)
from app.routers import dept_accounting_agi as dept_acc_agi_mod
app.include_router(dept_acc_agi_mod.router, prefix="/api/accounting", tags=["Z-11F: Accounting AGI Intelligence Layer"])

# Z-LIC: ZONE LICENSING ENGINE (Package Selector & Production Client Licenses)
app.include_router(licensing_mod.router, prefix="/api/licensing", tags=["Z-LIC: Zone Licensing Engine"])
app.include_router(tenant_mod.router)
app.include_router(control_panel_mod.router)

# Z-MV: MIRACLE MEDIA VAULT STUDIO
app.include_router(mv_mod.router, prefix="/api/media-vault", tags=["Z-MV: Media Vault"])
app.include_router(hms_mod.router, prefix="/api", tags=["Healthcare Management"])
app.include_router(emergency_mod.router, prefix="/api")  # ZONE RERS: Real-Time Emergency Response System

# ZONE AI: CDO BRAIN MANAGEMENT API (prefix is defined inside the router itself)
app.include_router(brain_router_mod.router, tags=["ZONE AI: CDO Brain Management"])



# ==========================================
# 5B. PHASE 4A — IP QUARANTINE MIDDLEWARE
# Foreign Attitude Auto-Lock:
# >100 req/60s with anomalous patterns triggers:
#   1. IP quarantine (in-memory + DB)
#   2. SystemConfig system_locked=1
#   3. Z-07 WebSocket SECURITY_ALERT broadcast
# ==========================================
import time
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse as _JSONResponse

_ip_request_log: dict = defaultdict(list)   # ip -> [timestamps]
_ip_error_log: dict = defaultdict(int)       # ip -> error count
_quarantined_ips: set = set()               # in-memory quarantine set
QUARANTINE_WINDOW = 60         # seconds
QUARANTINE_REQ_LIMIT = 100    # requests per window
QUARANTINE_ERROR_LIMIT = 20   # 4xx errors per window

@app.middleware("http")
async def sovereign_quarantine_shield(request: Request, call_next):
    """Phase 4A: Burst detection + IP quarantine shield."""
    client_ip = request.client.host if request.client else "unknown"

    # Skip internal/health checks & local dev bypass
    if client_ip in ("127.0.0.1", "localhost", "::1") or request.url.path in ("/api/health", "/", "/docs", "/openapi.json"):
        return await call_next(request)

    # Block quarantined IPs immediately
    if client_ip in _quarantined_ips:
        return _JSONResponse(
            status_code=429,
            content={"detail": "IP quarantined by Sovereign Shield. Contact system administrator."},
            headers={"X-SOVEREIGN-SHIELD": "QUARANTINED", "Retry-After": "3600"}
        )

    # Track request timestamps in sliding window
    now = time.time()
    window_start = now - QUARANTINE_WINDOW
    _ip_request_log[client_ip] = [t for t in _ip_request_log[client_ip] if t > window_start]
    _ip_request_log[client_ip].append(now)
    req_count = len(_ip_request_log[client_ip])

    response = await call_next(request)

    # Track error responses
    if response.status_code >= 400:
        _ip_error_log[client_ip] += 1

    # Evaluate quarantine trigger
    err_count = _ip_error_log.get(client_ip, 0)
    if req_count > QUARANTINE_REQ_LIMIT and err_count > QUARANTINE_ERROR_LIMIT:
        _quarantined_ips.add(client_ip)
        logger.critical(
            f"🚨 SOVEREIGN SHIELD: IP {client_ip} QUARANTINED — "
            f"{req_count} req/{QUARANTINE_WINDOW}s, {err_count} errors"
        )
        # Persist to DB async
        try:
            from app.core.database import SessionLocal as _Shield_DB
            from app.models.models import QuarantinedIP
            from datetime import datetime, timezone, timedelta
            _sdb = _Shield_DB()
            try:
                _qt = QuarantinedIP(
                    ip_address=client_ip,
                    reason=f"Burst: {req_count} req in {QUARANTINE_WINDOW}s, {err_count} errors",
                    anomaly_type="4XX_STORM" if err_count > QUARANTINE_ERROR_LIMIT else "BURST_RATE",
                    request_count=req_count,
                    error_count=err_count,
                    expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                    is_active=True,
                )
                _sdb.add(_qt)
                _sdb.commit()
            finally:
                _sdb.close()
        except Exception:
            pass
        # Broadcast Z-07 security alert
        try:
            from app.core.ws_manager import master_socket
            import asyncio
            asyncio.create_task(master_socket.broadcast("SECURITY_ALERT", {
                "zone": "Z-07",
                "level": "CRITICAL",
                "ip": client_ip,
                "requests": req_count,
                "errors": err_count,
                "message": f"🚨 FOREIGN ATTITUDE DETECTED: IP {client_ip} quarantined after burst ({req_count} req, {err_count} errors in {QUARANTINE_WINDOW}s)",
            }))
        except Exception:
            pass

    return response


# ==========================================
# 6. KERNEL HEALTH-GATE (DEPLOYMENT SHIELD)
# ==========================================
@app.get("/api/health")
async def kernel_health_pulse():
    """Validates Kernel is alive for deployment health-gates."""
    return {"status": "ok", "system": "Miracle HMS Sovereign Kernel"}

# ==========================================
# 7. MASTER TELEMETRY & WEBSOCKET GATEWAY
# ==========================================
@app.websocket("/ws/grid-sync")
async def websocket_grid_endpoint(websocket: WebSocket):
    await master_socket.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for client pings if needed
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        master_socket.disconnect(websocket)

@app.get("/", tags=["Kernel Diagnostics"])
async def read_root():
    return JSONResponse(content={
        "status": "SOVEREIGN_ONLINE",
        "system": "Miracle HMS",
        "version": "v66.0.HardLock",
        "operator": "CDO_SAJEED",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
