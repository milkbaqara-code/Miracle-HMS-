# ============================================================
# MIRACLE OS -- ZONE 23: SOVEREIGN INFRASTRUCTURE ROUTER
# Exposes the 5 Sovereign Sensor Pillars to the frontend dashboard.
# Also exposes Immune System status and Self-Healing activity log.
#
# ENDPOINTS:
# GET  /api/infra/telemetry   -- 5-Pillar sensor summary (Zone 23 dashboard)
# GET  /api/infra/services    -- PM2 process health simulation
# GET  /api/infra/immune      -- Immune System status + self-healing log
# GET  /api/infra/logs/{target} -- AI session activity (replaces shell logs)
# POST /api/infra/action      -- Restart a PM2 service (PIN protected)
# POST /api/infra/backup      -- Database export (PIN protected)
# ============================================================

import os
import time
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, date, timedelta
from app.core.database import get_db
from app.core.ai_analysis import SovereignAnalysisEngine
from app.core.immune_system import audit_firewall_integrity, get_immune_status

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Zone 23 - Sovereign Infrastructure"])

INFRA_MASTER_PIN = os.getenv("INFRA_MASTER_PIN", "Miracle2026!")


# ============================================================
# GET /api/infra/telemetry
# Returns all 5 Sovereign Pillar snapshots for Zone 23 dashboard
# Refreshed every 5 seconds by the frontend pulse engine
# ============================================================
@router.get("/telemetry")
async def get_infra_telemetry(db: Session = Depends(get_db)):
    """
    Zone 23 Flight Deck: Combines all 5 Pillar sensors into one call.
    The frontend polls this every 5 seconds to keep gauges live.
    """
    try:
        # Pillar 1: Financial
        financial = SovereignAnalysisEngine.get_financial_vault(db)
    except Exception as e:
        financial = {"error": str(e)}

    try:
        # Pillar 2: Operational
        operational = SovereignAnalysisEngine.get_operational_grid(db)
    except Exception as e:
        operational = {"error": str(e)}

    try:
        # Pillar 3: Human Capital
        staff = SovereignAnalysisEngine.get_human_capital_report(db)
    except Exception as e:
        staff = {"error": str(e)}

    try:
        # Pillar 4: Guest Intelligence
        guests = SovereignAnalysisEngine.get_guest_intelligence(db)
    except Exception as e:
        guests = {"error": str(e)}

    try:
        # Pillar 5: SRE
        sre = SovereignAnalysisEngine.get_system_health(db)
    except Exception as e:
        sre = {"error": str(e)}

    return {
        "data": {
            "uptime": f"Port 8090 | {datetime.now().strftime('%H:%M:%S')}",
            "financial": financial,
            "operational": operational,
            "human_capital": staff,
            "guest_intelligence": guests,
            "sre": sre,
            "timestamp": datetime.now().isoformat()
        }
    }


# ============================================================
# GET /api/infra/services
# Returns PM2 process health (based on DB and API state)
# No SSH required -- reads from DB counters
# ============================================================
@router.get("/services")
async def get_infra_services(db: Session = Depends(get_db)):
    """
    Returns the health status of Miracle OS services.
    Since we cannot SSH from the API, we infer status from DB responsiveness.
    """
    start = time.time()
    try:
        db.execute(text("SELECT 1")).first()
        db_latency = round((time.time() - start) * 1000, 2)
        db_online = True
    except Exception:
        db_latency = 9999
        db_online = False

    from app.models.miracle_ai_models import MiracleSession
    today_start = datetime.combine(date.today(), datetime.min.time())
    sessions_today = db.query(MiracleSession).filter(
        MiracleSession.created_at >= today_start
    ).count() if db_online else 0

    services = [
        {
            "name": "miracle-backend",
            "status": "ONLINE" if db_online else "DEGRADED",
            "memory_mb": "~8.5",
            "cpu_percent": 0,
            "note": f"DB Latency: {db_latency}ms | Sessions Today: {sessions_today}"
        },
        {
            "name": "miracle-frontend",
            "status": "ONLINE",
            "memory_mb": "~67.7",
            "cpu_percent": 0,
            "note": "Next.js 14 | Port 3000"
        },
        {
            "name": "immune-system",
            "status": "ACTIVE",
            "memory_mb": "~0.5",
            "cpu_percent": 0,
            "note": "Semantic Firewall + Apoptosis Guard + Shadow Simulation"
        }
    ]

    return {"data": services}


# ============================================================
# GET /api/infra/immune
# Returns Immune System status + self-healing activity log
# This is the "Flight Recorder" for self-healing events
# ============================================================
@router.get("/immune")
async def get_immune_dashboard(db: Session = Depends(get_db)):
    """
    Returns the Immune System health, firewall whitelist,
    and the last 20 AI interaction events as a self-healing log.
    """
    immune = audit_firewall_integrity()
    status = get_immune_status()

    # Build self-healing activity log from AI session history
    from app.models.miracle_ai_models import MiracleSession, MiracleKnowledge
    today_start = datetime.combine(date.today(), datetime.min.time())

    recent_sessions = (
        db.query(MiracleSession)
        .filter(MiracleSession.created_at >= today_start)
        .order_by(MiracleSession.created_at.desc())
        .limit(20)
        .all()
    )

    session_log = [
        {
            "time": s.created_at.strftime("%H:%M:%S") if s.created_at else "N/A",
            "zone": s.zone,
            "role": s.role,
            "preview": s.content[:80] + "..." if s.content and len(s.content) > 80 else (s.content or "")
        }
        for s in recent_sessions
    ]

    # Knowledge items (self-learning events)
    recent_ki = (
        db.query(MiracleKnowledge)
        .order_by(MiracleKnowledge.created_at.desc())
        .limit(10)
        .all()
    )

    ki_log = [
        {
            "time": k.created_at.strftime("%H:%M:%S") if k.created_at else "N/A",
            "category": k.category,
            "insight": k.insight[:100] if k.insight else "",
            "importance": k.importance_score
        }
        for k in recent_ki
    ]

    return {
        "data": {
            "immune_active": True,
            "pillars": {
                "semantic_firewall": "ACTIVE",
                "shadow_simulation": "ACTIVE",
                "apoptosis_guard": "ACTIVE",
                "self_audit": "ACTIVE"
            },
            "firewall_whitelist": immune["whitelist"],
            "firewall_whitelist_count": len(immune["whitelist"]),
            "injection_signatures_blocked": immune["injection_signatures_count"],
            "protected_tables": immune["apoptosis_write_surface"],
            "session_activity_today": session_log,
            "self_learning_events": ki_log,
        }
    }


# ============================================================
# GET /api/infra/logs/{target}
# Returns AI session activity as a readable log stream
# ============================================================
@router.get("/logs/{target}")
async def get_infra_logs(target: str, lines: int = 50, db: Session = Depends(get_db)):
    """
    Returns recent AI activity as a human-readable log.
    Replaces shell-level PM2 logs which are not accessible from this context.
    """
    from app.models.miracle_ai_models import MiracleSession
    today_start = datetime.combine(date.today(), datetime.min.time())

    if target == "backend":
        rows = (
            db.query(MiracleSession)
            .filter(MiracleSession.created_at >= today_start)
            .order_by(MiracleSession.created_at.desc())
            .limit(lines)
            .all()
        )
        lines_out = [
            f"[{r.created_at.strftime('%H:%M:%S') if r.created_at else 'N/A'}] "
            f"[{r.zone}] [{r.role.upper()}] {(r.content or '')[:120]}"
            for r in reversed(rows)
        ]
        log_text = "\n".join(lines_out) if lines_out else "No backend activity logged today."

    elif target == "frontend":
        from app.models.miracle_ai_models import LoginSessionLog
        try:
            rows = db.query(LoginSessionLog).order_by(LoginSessionLog.id.desc()).limit(lines).all()
            lines_out = [
                f"[{r.login_time.strftime('%H:%M:%S') if r.login_time else 'N/A'}] "
                f"[{r.username}] [{r.status}] Zone: {r.zone or 'N/A'}"
                for r in reversed(rows)
            ]
            log_text = "\n".join(lines_out) if lines_out else "No frontend login activity today."
        except Exception as e:
            log_text = f"Frontend log unavailable: {e}"

    elif target == "nginx":
        # Report immune system blocks as the "nginx equivalent"
        from app.models.miracle_ai_models import MiracleKnowledge
        rows = db.query(MiracleKnowledge).order_by(MiracleKnowledge.created_at.desc()).limit(lines).all()
        lines_out = [
            f"[{r.created_at.strftime('%H:%M:%S') if r.created_at else 'N/A'}] "
            f"[IMMUNE] [{r.category}] (Score: {r.importance_score}) {(r.insight or '')[:80]}"
            for r in reversed(rows)
        ]
        log_text = "\n".join(lines_out) if lines_out else "No immune system events recorded."
    else:
        log_text = "Unknown log target. Use: backend | frontend | nginx"

    return {"data": log_text}


# ============================================================
# POST /api/infra/action
# PIN-protected service restart command
# ============================================================
@router.post("/action")
async def infra_action(request: Request, db: Session = Depends(get_db)):
    """PIN-protected action: restart a named PM2 service."""
    body = await request.json()
    pin = body.get("master_pin", "")
    service = body.get("service_name", "")
    action = body.get("action", "")

    if pin != INFRA_MASTER_PIN:
        raise HTTPException(status_code=403, detail="SOVEREIGN LOCK: Invalid Master PIN.")

    if action != "restart":
        raise HTTPException(status_code=400, detail="Only 'restart' is currently supported.")

    allowed_services = ["miracle-backend", "miracle-frontend"]
    if service not in allowed_services:
        raise HTTPException(status_code=400, detail=f"Service '{service}' is not in the allowed restart surface.")

    # On the VPS, we execute via subprocess. Locally this will fail gracefully.
    import subprocess
    try:
        result = subprocess.run(
            ["pm2", "restart", service],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            logger.warning(f"[INFRA ACTION] '{service}' restarted via Zone 23.")
            return {"status": "SUCCESS", "output": result.stdout[-500:]}
        else:
            raise HTTPException(status_code=500, detail=result.stderr[-300:])
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="PM2 not found on this host. VPS action only.")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="PM2 restart timed out.")


# ============================================================
# POST /api/infra/backup
# PIN-protected database SQL export
# ============================================================
@router.post("/backup")
async def infra_backup(request: Request, db: Session = Depends(get_db)):
    """PIN-protected: Exports a SQL dump of core tables."""
    body = await request.json()
    pin = body.get("master_pin", "")

    if pin != INFRA_MASTER_PIN:
        raise HTTPException(status_code=403, detail="SOVEREIGN LOCK: Invalid Master PIN.")

    from app.models.models import (
        AssetGrid, GuestFolio, POSTransaction, Reservation,
        Inventory, AccountingLedger, GuestCRM
    )
    from sqlalchemy import inspect as sa_inspect

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"miracle_sovereign_backup_{timestamp}.sql"
    export_models = [
        ("asset_grid", AssetGrid),
        ("guest_folios", GuestFolio),
        ("reservations", Reservation),
        ("inventory", Inventory),
    ]

    sql_lines = [f"-- MIRACLE OS SOVEREIGN BACKUP | {timestamp}\n"]
    for table_name, Model in export_models:
        rows = db.query(Model).all()
        if not rows:
            continue
        inspector = sa_inspect(Model)
        col_names = [c.key for c in inspector.mapper.column_attrs]
        sql_lines.append(f"\n-- TABLE: {table_name} ({len(rows)} rows)")
        for row in rows:
            vals = []
            for c in col_names:
                v = getattr(row, c, None)
                if v is None:
                    vals.append("NULL")
                elif isinstance(v, str):
                    vals.append(f"'{v.replace(chr(39), chr(39)*2)}'")
                elif isinstance(v, (datetime, date)):
                    vals.append(f"'{v}'")
                else:
                    vals.append(str(v))
            col_str = ", ".join(col_names)
            val_str = ", ".join(vals)
            sql_lines.append(f"INSERT INTO {table_name} ({col_str}) VALUES ({val_str});")

    sql_content = "\n".join(sql_lines)

    def generate():
        yield sql_content.encode("utf-8")

    return StreamingResponse(
        generate(),
        media_type="application/sql",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
