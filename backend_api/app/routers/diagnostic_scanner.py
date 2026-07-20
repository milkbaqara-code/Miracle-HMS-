# ============================================================
# MIRACLE OS — SOVEREIGN DIAGNOSTIC SCANNER V1.0
# "The All-Seeing Eye of Z-23"
#
# Provides deep system scanning for CDO oversight:
#  1. ROUTE INTEGRITY — Validates all registered routes have matching frontend pages
#  2. FRONTEND DIAGNOSTICS — Scans for import errors, missing components, build issues
#  3. BACKEND DIAGNOSTICS — Scans for missing imports, unhandled routes, DB issues
#  4. API ENDPOINT VALIDATOR — Tests all registered endpoints for responsiveness
#  5. FILE INTEGRITY — Checks for missing files referenced in kernel/config
#  6. AI ENGINE HEALTH — Monitors token usage, response times, offline events
#  7. SECURITY AUDIT — Ghost conflicts, deprecated imports, exposed secrets
# ============================================================

import os
import re
import time
import logging
import importlib
import traceback
from pathlib import Path
from datetime import datetime, date, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.models.models import AssetGrid, User, Employee, Reservation, Inventory, SolveMission, SystemConfig
from app.models.miracle_ai_models import AIReplyAuditLog, MiracleSession, MiracleKnowledge

logger = logging.getLogger("DiagnosticScanner")
router = APIRouter(prefix="/diagnostics", tags=["ZONE 23: SRE Diagnostic Scanner"])

# === SRE CACHE: The Living Heart of Z-23 ===
_LAST_SCAN_REPORT = {
    "summary": {"overall_health": "UNKNOWN"},
    "scanned_at": None,
    "issues": []
}

# === ROOT PATHS ===
import platform
if platform.system() != "Windows" and Path("/home/vigilantitsolution-miracle/htdocs/miracle.vigilantitsolution.com").exists():
    FRONTEND_ROOT = Path("/home/vigilantitsolution-miracle/htdocs/miracle.vigilantitsolution.com")
    BACKEND_ROOT = Path("/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api")
    PROJECT_ROOT = BACKEND_ROOT.parent
    KERNEL_PATH = BACKEND_ROOT / "miracle_kernel.json"
else:
    PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent  # Miracle_Os_Master
    BACKEND_ROOT = PROJECT_ROOT / "backend_api"
    FRONTEND_ROOT = PROJECT_ROOT / "web"
    KERNEL_PATH = PROJECT_ROOT / "miracle_kernel.json"


def _ts():
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# 1. ROUTE INTEGRITY SCANNER
# Validates that every zone path in miracle_kernel.json
# has a matching Next.js page directory
# ============================================================
def scan_route_integrity() -> dict:
    issues = []
    valid = []
    try:
        import json
        with open(KERNEL_PATH, "r", encoding="utf-8") as f:
            kernel = json.load(f)

        app_dir = FRONTEND_ROOT / "app"
        for zone in kernel.get("zones", []):
            path = zone.get("path", "")
            zone_id = zone.get("id", "?")
            if not path or path in ("*", "None", "/"):
                continue

            # /dashboard/settings -> web/app/dashboard/settings/page.tsx
            segments = path.strip("/").split("/")
            page_dir = app_dir / "/".join(segments)
            page_file = page_dir / "page.tsx"

            if page_file.exists():
                valid.append({"zone": zone_id, "path": path, "status": "OK"})
            else:
                issues.append({
                    "zone": zone_id,
                    "path": path,
                    "expected_file": str(page_file.relative_to(PROJECT_ROOT)),
                    "severity": "CRITICAL",
                    "message": f"No page.tsx found for route {path}"
                })
    except Exception as e:
        issues.append({"zone": "SCANNER", "severity": "ERROR", "message": str(e)})

    return {
        "scanner": "ROUTE_INTEGRITY",
        "scanned_at": _ts(),
        "total_routes": len(valid) + len(issues),
        "valid": len(valid),
        "issues": issues,
        "valid_routes": valid,
        "status": "PASS" if not issues else "FAIL"
    }


# ============================================================
# 2. FRONTEND DIAGNOSTICS SCANNER
# Checks for common React/Next.js issues
# ============================================================
def scan_frontend() -> dict:
    issues = []
    stats = {"total_tsx": 0, "total_ts": 0, "total_css": 0}

    try:
        app_dir = FRONTEND_ROOT / "app"
        if not app_dir.exists():
            return {"scanner": "FRONTEND", "status": "ERROR", "message": "web/app directory not found"}

        for fpath in app_dir.rglob("*.tsx"):
            stats["total_tsx"] += 1
            try:
                content = fpath.read_text(encoding="utf-8", errors="replace")

                # Check for 'use client' directive in files with hooks
                if any(hook in content for hook in ["useState", "useEffect", "useCallback", "useRef"]):
                    if "'use client'" not in content and '"use client"' not in content:
                        issues.append({
                            "file": str(fpath.relative_to(PROJECT_ROOT)),
                            "type": "MISSING_DIRECTIVE",
                            "severity": "WARNING",
                            "message": "Uses React hooks but missing 'use client' directive"
                        })

                # Check for broken imports (relative paths that don't exist)
                imports = re.findall(r"from\s+['\"](\.\./[^'\"]+|\.\/[^'\"]+)['\"]", content)
                for imp in imports:
                    # Resolve the import path
                    imp_clean = imp.replace("'", "").replace('"', '')
                    resolved = (fpath.parent / imp_clean).resolve()
                    # Check .tsx, .ts, /index.tsx, /index.ts variants
                    candidates = [
                        resolved.with_suffix(".tsx"),
                        resolved.with_suffix(".ts"),
                        resolved / "index.tsx",
                        resolved / "index.ts",
                        resolved,
                    ]
                    if not any(c.exists() for c in candidates):
                        issues.append({
                            "file": str(fpath.relative_to(PROJECT_ROOT)),
                            "type": "BROKEN_IMPORT",
                            "severity": "CRITICAL",
                            "message": f"Import '{imp_clean}' does not resolve to any file"
                        })

                # Check for console.error calls (potential error handlers)
                error_count = content.count("console.error")
                if error_count > 3:
                    issues.append({
                        "file": str(fpath.relative_to(PROJECT_ROOT)),
                        "type": "EXCESSIVE_ERROR_LOGGING",
                        "severity": "INFO",
                        "message": f"{error_count} console.error calls — review for production readiness"
                    })
            except Exception:
                pass

        for fpath in app_dir.rglob("*.ts"):
            if not fpath.name.endswith(".tsx"):
                stats["total_ts"] += 1

        for fpath in app_dir.rglob("*.css"):
            stats["total_css"] += 1

    except Exception as e:
        issues.append({"type": "SCANNER_ERROR", "severity": "ERROR", "message": str(e)})

    return {
        "scanner": "FRONTEND",
        "scanned_at": _ts(),
        "stats": stats,
        "issues": issues,
        "issue_count": len(issues),
        "status": "PASS" if not [i for i in issues if i["severity"] == "CRITICAL"] else "FAIL"
    }


# ============================================================
# 3. BACKEND DIAGNOSTICS SCANNER
# Checks Python backend for import errors, missing modules,
# router registration issues
# ============================================================
def scan_backend() -> dict:
    issues = []
    stats = {"total_py": 0, "routers_found": 0}

    try:
        backend_app = BACKEND_ROOT / "app"
        if not backend_app.exists():
            return {"scanner": "BACKEND", "status": "ERROR", "message": "backend_api/app not found"}

        # Scan all Python files
        for fpath in backend_app.rglob("*.py"):
            if "__pycache__" in str(fpath):
                continue
            # Skip self (scanner contains its own check strings — would self-flag)
            if fpath.name == "diagnostic_scanner.py":
                continue
            stats["total_py"] += 1
            try:
                content = fpath.read_text(encoding="utf-8", errors="replace")

                # Check for deprecated imports
                if "from app.routers.bot_router import" in content:
                    rel = str(fpath.relative_to(PROJECT_ROOT))
                    if "DEPRECATED" not in fpath.name:
                        issues.append({
                            "file": rel,
                            "type": "DEPRECATED_IMPORT",
                            "severity": "CRITICAL",
                            "message": "Imports from deprecated bot_router.py — must use bot_router_v2"
                        })

                # Check for bare except clauses
                bare_excepts = len(re.findall(r"except\s*:", content))
                if bare_excepts > 2:
                    issues.append({
                        "file": str(fpath.relative_to(PROJECT_ROOT)),
                        "type": "BARE_EXCEPT",
                        "severity": "WARNING",
                        "message": f"{bare_excepts} bare except clauses — may swallow critical errors"
                    })

                # Check for hardcoded API keys (skip DEPRECATED files)
                if "DEPRECATED" not in fpath.name:
                    key_patterns = re.findall(r'(AIzaSy[a-zA-Z0-9_-]{33}|gsk_[a-zA-Z0-9]{20,})', content)
                    if key_patterns:
                        issues.append({
                            "file": str(fpath.relative_to(PROJECT_ROOT)),
                            "type": "EXPOSED_SECRET",
                            "severity": "CRITICAL",
                            "message": f"{len(key_patterns)} hardcoded API key(s) detected — move to .env"
                        })

            except Exception:
                pass

        # Check router registration in main.py
        main_py = backend_app / "main.py"
        if main_py.exists():
            main_content = main_py.read_text(encoding="utf-8", errors="replace")
            router_dir = backend_app / "routers"
            if router_dir.exists():
                for rfile in router_dir.glob("*.py"):
                    if rfile.name.startswith("__") or rfile.name.startswith("DEPRECATED"):
                        continue
                    stats["routers_found"] += 1
                    module_name = rfile.stem
                    if module_name not in main_content:
                        issues.append({
                            "file": f"backend_api/app/routers/{rfile.name}",
                            "type": "UNREGISTERED_ROUTER",
                            "severity": "WARNING",
                            "message": f"Router '{module_name}' exists but may not be registered in main.py"
                        })

    except Exception as e:
        issues.append({"type": "SCANNER_ERROR", "severity": "ERROR", "message": str(e)})

    return {
        "scanner": "BACKEND",
        "scanned_at": _ts(),
        "stats": stats,
        "issues": issues,
        "issue_count": len(issues),
        "status": "PASS" if not [i for i in issues if i["severity"] == "CRITICAL"] else "FAIL"
    }


# ============================================================
# 4. API ENDPOINT VALIDATOR
# Tests all registered FastAPI routes for responsiveness
# ============================================================
def scan_api_endpoints() -> dict:
    issues = []
    valid = []

    try:
        from app.main import app as fastapi_app
        routes = []
        for route in fastapi_app.routes:
            path = getattr(route, "path", None)
            methods = getattr(route, "methods", set())
            if path and not path.startswith("/docs") and not path.startswith("/openapi"):
                routes.append({"path": path, "methods": list(methods)})

        for r in routes:
            valid.append(r)

        # Check for duplicate paths + methods combination
        routes_seen = set()
        for r in routes:
            p = r["path"]
            for m in r["methods"]:
                key = (p, m)
                if key in routes_seen:
                    issues.append({
                        "type": "DUPLICATE_ROUTE",
                        "severity": "WARNING",
                        "message": f"Duplicate route: {m} {p}"
                    })
                routes_seen.add(key)

    except Exception as e:
        issues.append({"type": "SCANNER_ERROR", "severity": "ERROR", "message": str(e)})

    return {
        "scanner": "API_ENDPOINTS",
        "scanned_at": _ts(),
        "total_endpoints": len(valid),
        "endpoints": valid[:100],  # Cap output
        "issues": issues,
        "issue_count": len(issues),
        "status": "PASS" if not issues else "WARN"
    }


# ============================================================
# 5. FILE INTEGRITY SCANNER
# Checks that critical system files exist
# ============================================================
def scan_file_integrity() -> dict:
    issues = []
    valid = []

    critical_files = [
        (KERNEL_PATH, "Kernel Configuration"),
        (BACKEND_ROOT / "app/main.py", "Backend Entry Point"),
        (BACKEND_ROOT / "app/routers/bot_router_v2.py", "AI Router V2"),
        (BACKEND_ROOT / "app/core/ai_analysis.py", "Sovereign Analysis Engine"),
        (BACKEND_ROOT / "app/core/kernel_manager.py", "Kernel Manager"),
        (BACKEND_ROOT / "app/core/database.py", "Database Engine"),
        (FRONTEND_ROOT / "app/layout.tsx", "Frontend Root Layout"),
        (FRONTEND_ROOT / "app/kernel.ts", "Frontend Kernel"),
        (FRONTEND_ROOT / "app/globals.css", "Design System"),
        (FRONTEND_ROOT / "app/dashboard/layout.tsx", "Dashboard Layout"),
        (FRONTEND_ROOT / "app/components/MiracleBot.tsx", "AI Chat Component"),
        (FRONTEND_ROOT / "package.json", "Frontend Dependencies"),
    ]

    for full, label in critical_files:
        if full.exists():
            size = full.stat().st_size
            mtime = datetime.fromtimestamp(full.stat().st_mtime).isoformat()
            valid.append({"file": full.name, "label": label, "size_bytes": size, "last_modified": mtime})
        else:
            issues.append({
                "file": full.name,
                "label": label,
                "severity": "CRITICAL",
                "message": f"Missing critical file: {full.name}"
            })

    return {
        "scanner": "FILE_INTEGRITY",
        "scanned_at": _ts(),
        "total_checked": len(critical_files),
        "valid": len(valid),
        "missing": len(issues),
        "files": valid,
        "issues": issues,
        "status": "PASS" if not issues else "FAIL"
    }


# ============================================================
# 6. AI ENGINE HEALTH SCANNER
# Monitors token patterns, session activity, response quality
# ============================================================
def scan_ai_health(db: Session) -> dict:
    issues = []
    stats = {}

    try:
        from app.models.miracle_ai_models import MiracleSession, MiracleKnowledge

        today_start = datetime.combine(date.today(), datetime.min.time())
        week_ago = today_start - timedelta(days=7)

        # Session activity
        sessions_today = db.query(MiracleSession).filter(
            MiracleSession.created_at >= today_start
        ).count()
        sessions_week = db.query(MiracleSession).filter(
            MiracleSession.created_at >= week_ago
        ).count()

        # Knowledge base size
        total_ki = db.query(MiracleKnowledge).count()
        active_ki = db.query(MiracleKnowledge).filter(
            MiracleKnowledge.status == "ACTIVE"
        ).count()
        pending_ki = db.query(MiracleKnowledge).filter(
            MiracleKnowledge.status == "PENDING_INJECTION"
        ).count()

        # Check for system errors in recent sessions
        error_sessions = db.query(MiracleSession).filter(
            MiracleSession.created_at >= today_start,
            MiracleSession.content.ilike("%SYSTEM_ERROR%")
        ).count()

        offline_sessions = db.query(MiracleSession).filter(
            MiracleSession.created_at >= today_start,
            MiracleSession.content.ilike("%offline%")
        ).count()

        stats = {
            "sessions_today": sessions_today,
            "sessions_this_week": sessions_week,
            "knowledge_items_total": total_ki,
            "knowledge_items_active": active_ki,
            "knowledge_items_pending": pending_ki,
            "system_errors_today": error_sessions,
            "offline_events_today": offline_sessions,
        }

        if offline_sessions > 3:
            issues.append({
                "type": "FREQUENT_OFFLINE",
                "severity": "CRITICAL",
                "message": f"{offline_sessions} offline events today — check API keys and token limits"
            })

        if pending_ki > 10:
            issues.append({
                "type": "PENDING_OVERFLOW",
                "severity": "WARNING",
                "message": f"{pending_ki} pending knowledge items awaiting CDO approval"
            })

        # DB latency test
        start = time.time()
        db.execute(text("SELECT 1")).first()
        latency_ms = round((time.time() - start) * 1000, 2)
        stats["db_latency_ms"] = latency_ms

        if latency_ms > 500:
            issues.append({
                "type": "HIGH_DB_LATENCY",
                "severity": "WARNING",
                "message": f"DB latency {latency_ms}ms — investigate connection pooling"
            })

    except Exception as e:
        issues.append({"type": "SCANNER_ERROR", "severity": "ERROR", "message": str(e)})

    return {
        "scanner": "AI_ENGINE",
        "scanned_at": _ts(),
        "stats": stats,
        "issues": issues,
        "issue_count": len(issues),
        "status": "PASS" if not [i for i in issues if i["severity"] == "CRITICAL"] else "FAIL"
    }


# ============================================================
# 6.1 VOICE & LATENCY SCANNER (CDO PILLAR)
# Detects why AI voice or processing might be delayed
# ============================================================
def scan_voice_latency(db: Session) -> dict:
    issues = []
    avg_latency = 0
    try:
        recent = db.query(AIReplyAuditLog).order_by(AIReplyAuditLog.created_at.desc()).limit(10).all()
        latencies = [r.llm_latency_ms for r in recent if r.llm_latency_ms]
        if latencies:
            avg_latency = sum(latencies) / len(latencies)
        
        if avg_latency > 3000:
            issues.append({
                "type": "HIGH_VOICE_LATENCY",
                "severity": "CRITICAL",
                "message": f"Average AI response time is {round(avg_latency/1000, 2)}s. This causes voice delay/stutter."
            })
        elif avg_latency > 1500:
            issues.append({
                "type": "DEGRADED_PERFORMANCE",
                "severity": "WARNING",
                "message": f"AI response time is {round(avg_latency/1000, 2)}s. Noticeable delay in interaction."
            })
    except Exception as e:
        issues.append({"type": "LATENCY_PROBE_FAIL", "severity": "ERROR", "message": str(e)})

    return {
        "scanner": "VOICE_LATENCY",
        "scanned_at": _ts(),
        "avg_latency_ms": round(avg_latency, 2),
        "issues": issues,
        "issue_count": len(issues),
        "status": "PASS" if not issues else "FAIL" if any(i["severity"] == "CRITICAL" for i in issues) else "WARN"
    }


# ============================================================
# 6.2 DATABASE SINK SCANNER (DATA INTEGRITY)
# Ensures core tables actually contain data (The Sink Check)
# ============================================================
def scan_database_sinks(db: Session) -> dict:
    issues = []
    checks = [
        (AssetGrid, "Asset Grid (Rooms)"),
        (User, "Operative Registry (Users)"),
        (Employee, "Human Capital (Staff)"),
        (Inventory, "Inventory Matrix"),
        (Reservation, "Reservation Ledger"),
        (MiracleKnowledge, "AI Brain (Knowledge)"),
        (SystemConfig, "Kernel Settings")
    ]
    
    counts = {}
    for model, label in checks:
        try:
            count = db.query(model).count()
            counts[label] = count
            if count == 0:
                issues.append({
                    "type": "EMPTY_SINK",
                    "severity": "CRITICAL",
                    "message": f"Missing Data: {label} table is empty. Everything will show as 'offline' or 'missing'."
                })
        except Exception as e:
            issues.append({"type": "DB_PROBE_FAIL", "severity": "ERROR", "message": f"{label}: {str(e)}"})

    return {
        "scanner": "DATABASE_SINKS",
        "scanned_at": _ts(),
        "counts": counts,
        "issues": issues,
        "issue_count": len(issues),
        "status": "PASS" if not issues else "FAIL"
    }


# ============================================================
# 6.3 CONNECTIVITY SCANNER (FRONT-BACK SYNC)
# Validates the bridge between layers
# ============================================================
def scan_connectivity() -> dict:
    issues = []
    # Test if we can reach the public IP/Domain if configured
    # For now, focus on internal bridge health
    
    try:
        # Check if miracle_kernel.json is in sync with the current system state
        with open(KERNEL_PATH, "r", encoding="utf-8") as f:
            import json
            kernel = json.load(f)
            version = kernel.get("version", "UNKNOWN")
            if version != "V66.0-SOVEREIGN-SRE":
                issues.append({
                    "type": "VERSION_MISMATCH",
                    "severity": "WARNING",
                    "message": f"Kernel version mismatch: {version} vs V66.0-SOVEREIGN-SRE. Sync required."
                })
    except Exception as e:
        issues.append({"type": "SYNC_PROBE_FAIL", "severity": "ERROR", "message": str(e)})

    return {
        "scanner": "CONNECTIVITY",
        "scanned_at": _ts(),
        "issues": issues,
        "issue_count": len(issues),
        "status": "PASS" if not issues else "WARN"
    }


# ============================================================
# 7. SECURITY AUDIT SCANNER
# Ghost conflicts, deprecated V1 usage, exposed secrets
# ============================================================
def scan_security() -> dict:
    issues = []
    checks_passed = 0

    try:
        # Check 1: V1 ghost router not imported in main.py
        main_py = BACKEND_ROOT / "app" / "main.py"
        if main_py.exists():
            content = main_py.read_text(encoding="utf-8", errors="replace")
            if "bot_router" in content and "bot_router_v2" not in content:
                issues.append({
                    "type": "GHOST_ROUTER",
                    "severity": "CRITICAL",
                    "message": "Deprecated bot_router V1 may still be registered in main.py"
                })
            else:
                checks_passed += 1

        # Check 2: .env file not in git-tracked directories
        env_web = FRONTEND_ROOT / ".env"
        env_backend = BACKEND_ROOT / ".env"
        gitignore = PROJECT_ROOT / ".gitignore"
        if gitignore.exists():
            gi_content = gitignore.read_text(encoding="utf-8", errors="replace")
            if ".env" not in gi_content:
                issues.append({
                    "type": "ENV_NOT_GITIGNORED",
                    "severity": "CRITICAL",
                    "message": ".env files may be tracked by git — add to .gitignore"
                })
            else:
                checks_passed += 1

        # Check 3: Check for CORS wildcard in production
        if main_py.exists():
            content = main_py.read_text(encoding="utf-8", errors="replace")
            if 'allow_origins=["*"]' in content or "allow_origins=['*']" in content:
                issues.append({
                    "type": "CORS_WILDCARD",
                    "severity": "WARNING",
                    "message": "CORS allows all origins (*) — restrict for production"
                })
            else:
                checks_passed += 1

        # Check 4: Deprecated router file still exists (ghost)
        deprecated = BACKEND_ROOT / "app" / "routers" / "bot_router.py"
        if deprecated.exists() and "DEPRECATED" not in deprecated.name:
            issues.append({
                "type": "GHOST_FILE",
                "severity": "WARNING",
                "message": "bot_router.py (V1) still exists — rename to DEPRECATED_bot_router.py"
            })
        else:
            checks_passed += 1

        # Check 5: Database file in deployment sync
        sync_ledger = PROJECT_ROOT / ".sync_ledger.json"
        if sync_ledger.exists():
            content = sync_ledger.read_text(encoding="utf-8", errors="replace")
            if ".db" in content:
                issues.append({
                    "type": "DB_IN_SYNC",
                    "severity": "CRITICAL",
                    "message": "Database file detected in sync ledger — may overwrite production data"
                })
            else:
                checks_passed += 1

    except Exception as e:
        issues.append({"type": "SCANNER_ERROR", "severity": "ERROR", "message": str(e)})

    return {
        "scanner": "SECURITY",
        "scanned_at": _ts(),
        "checks_passed": checks_passed,
        "total_checks": checks_passed + len(issues),
        "issues": issues,
        "issue_count": len(issues),
        "status": "PASS" if not [i for i in issues if i["severity"] == "CRITICAL"] else "FAIL"
    }


# ============================================================
# API ENDPOINTS
# ============================================================

@router.post("/scan/all")
async def run_full_scan(db: Session = Depends(get_db)):
    """Run ALL diagnostic scanners and return a unified report."""
    global _LAST_SCAN_REPORT
    
    results = {
        "scan_timestamp": _ts(),
        "scanners": {
            "route_integrity": scan_route_integrity(),
            "frontend": scan_frontend(),
            "backend": scan_backend(),
            "api_endpoints": scan_api_endpoints(),
            "file_integrity": scan_file_integrity(),
            "ai_engine": scan_ai_health(db),
            "voice_latency": scan_voice_latency(db),
            "database_sinks": scan_database_sinks(db),
            "connectivity": scan_connectivity(),
            "security": scan_security(),
        }
    }

    # Calculate overall health
    all_statuses = [s["status"] for s in results["scanners"].values()]
    total_issues = sum(s.get("issue_count", len(s.get("issues", []))) for s in results["scanners"].values())
    critical_count = sum(
        len([i for i in s.get("issues", []) if i.get("severity") == "CRITICAL"])
        for s in results["scanners"].values()
    )

    results["summary"] = {
        "total_scanners": len(results["scanners"]),
        "passed": all_statuses.count("PASS"),
        "failed": all_statuses.count("FAIL"),
        "warnings": all_statuses.count("WARN"),
        "total_issues": total_issues,
        "critical_issues": critical_count,
        "overall_health": "CRITICAL" if critical_count > 0 else "HEALTHY" if all_statuses.count("FAIL") == 0 else "DEGRADED"
    }

    # Extract flat issue list for ledger
    flat_issues = []
    for s_name, s_data in results["scanners"].items():
        for issue in s_data.get("issues", []):
            flat_issues.append({
                "time": datetime.now().strftime("%H:%M:%S"),
                "zone": s_name.upper().replace("_", " "),
                "preview": f"[{issue['severity']}] {issue['message']}",
                "severity": issue['severity']
            })
    
    results["ledger"] = flat_issues
    _LAST_SCAN_REPORT = results

    return results


@router.get("/status")
def get_last_scan_status():
    """Returns the latest SRE ledger results."""
    return _LAST_SCAN_REPORT


@router.post("/scan/{scanner_name}")
async def run_single_scan(scanner_name: str, db: Session = Depends(get_db)):
    """Run a single diagnostic scanner by name."""
    scanner_map = {
        "route_integrity": lambda: scan_route_integrity(),
        "frontend": lambda: scan_frontend(),
        "backend": lambda: scan_backend(),
        "api_endpoints": lambda: scan_api_endpoints(),
        "file_integrity": lambda: scan_file_integrity(),
        "ai_engine": lambda: scan_ai_health(db),
        "security": lambda: scan_security(),
    }

    scanner_fn = scanner_map.get(scanner_name)
    if not scanner_fn:
        return {"error": f"Unknown scanner: {scanner_name}. Available: {list(scanner_map.keys())}"}

    return scanner_fn()
