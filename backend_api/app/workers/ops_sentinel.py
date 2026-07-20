#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================
  MIRACLE OS -- OPS SENTINEL DAEMON (ops-sentinel)
  Agent Role: Triage and System Monitoring
  Model Tier: Gemini 3 Flash (background, non-reasoning)
  Run: Managed by PM2 as a persistent process
=============================================================
  Monitors:
    - PM2 error logs (miracle-backend, miracle-frontend, wa-gateway)
    - Nginx error log
  Actions:
    - Parses new error lines since last checkpoint
    - Writes anomalies to SystemErrorLogs (Z-23 Dashboard)
    - Sends a heartbeat ping every HEARTBEAT_INTERVAL seconds
  Design Laws:
    - NEVER crashes the main backend (all DB errors are swallowed)
    - ASCII-safe logging (no Unicode in output)
    - Uses a watermark file to track log position (no DB reads for state)
=============================================================
"""

import os
import sys
import time
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

# -- Path bootstrap so we can import from backend_api root
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

try:
    from app.core.database import SessionLocal
    from app.models import SystemErrorLog
    DB_AVAILABLE = True
except Exception as e:
    print(f"[OPS-SENTINEL] DB import failed: {e}. Running in log-only mode.", flush=True)
    DB_AVAILABLE = False

# -- Configuration
POLL_INTERVAL      = 30      # seconds between sweeps
HEARTBEAT_INTERVAL = 300     # seconds between heartbeat writes
MAX_LINE_BYTES     = 2000    # truncate very long log lines

WATERMARK_FILE = BACKEND_ROOT / ".ops_sentinel_watermark.json"

LOG_TARGETS = {
    "miracle-backend":  "/root/.pm2/logs/miracle-backend-error.log",
    "miracle-frontend": "/root/.pm2/logs/miracle-frontend-error.log",
    "wa-gateway":       "/root/.pm2/logs/wa-gateway-error.log",
    "nginx":            "/home/vigilantitsolution-miracle/logs/nginx/error.log",
}

SEVERITY_PATTERNS = [
    (r"(FATAL|CRITICAL|fatal|critical)", "CRITICAL"),
    (r"(ERROR|error|SyntaxError|RuntimeError|ModuleNotFoundError|ImportError)", "ERROR"),
    (r"(WARNING|WARN|warn|DeprecationWarning)", "WARNING"),
    (r"(Traceback|most recent call last)", "ERROR"),
    (r"(502 Bad Gateway|503 Service Unavailable|500 Internal)", "ERROR"),
]


def log(msg: str):
    ts = datetime.utcnow().strftime("%H:%M:%S")
    safe = str(msg).encode("ascii", "replace").decode("ascii")
    print(f"[{ts}] [OPS-SENTINEL] {safe}", flush=True)


def load_watermark() -> dict:
    if WATERMARK_FILE.exists():
        try:
            return json.loads(WATERMARK_FILE.read_text())
        except Exception:
            pass
    return {}


def save_watermark(wm: dict):
    try:
        WATERMARK_FILE.write_text(json.dumps(wm, indent=2))
    except Exception as e:
        log(f"Watermark save failed: {e}")


def detect_severity(line: str) -> str:
    for pattern, severity in SEVERITY_PATTERNS:
        if re.search(pattern, line):
            return severity
    return "INFO"


def line_fingerprint(line: str) -> str:
    return hashlib.md5(line.strip().encode("utf-8", "replace")).hexdigest()


def write_to_db(source: str, severity: str, message: str):
    if not DB_AVAILABLE:
        return
    try:
        db = SessionLocal()
        entry = SystemErrorLog(
            source=f"ops-sentinel:{source}",
            severity=severity,
            message=message[:2000],
            timestamp=datetime.utcnow(),
        )
        db.add(entry)
        db.commit()
        db.close()
    except Exception as e:
        log(f"DB write failed ({source}): {e}")


def sweep_log(source: str, log_path: str, watermark: dict) -> dict:
    """Read new lines from log_path since last watermark position."""
    if not os.path.exists(log_path):
        return watermark

    current_size = os.path.getsize(log_path)
    last_pos = watermark.get(source, 0)

    # Handle log rotation (file shrank)
    if current_size < last_pos:
        log(f"Log rotation detected for {source}. Resetting watermark.")
        last_pos = 0

    if current_size == last_pos:
        return watermark  # No new data

    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            f.seek(last_pos)
            new_lines = f.readlines()
            watermark[source] = f.tell()
    except Exception as e:
        log(f"Could not read {log_path}: {e}")
        return watermark

    seen_fingerprints = set()
    errors_found = 0

    for line in new_lines:
        line = line.strip()
        if not line:
            continue

        severity = detect_severity(line)
        if severity == "INFO":
            continue  # Skip noise

        fp = line_fingerprint(line)
        if fp in seen_fingerprints:
            continue
        seen_fingerprints.add(fp)

        safe_line = line[:MAX_LINE_BYTES].encode("ascii", "replace").decode("ascii")
        log(f"[{severity}] [{source}] {safe_line[:120]}")
        write_to_db(source, severity, safe_line)
        errors_found += 1

    if errors_found:
        log(f"Sweep complete: {errors_found} anomalies found in [{source}].")

    return watermark


def write_heartbeat():
    write_to_db(
        source="heartbeat",
        severity="INFO",
        message=f"OPS-SENTINEL alive. Monitoring {len(LOG_TARGETS)} log targets. UTC={datetime.utcnow().isoformat()}",
    )
    log("Heartbeat written to Z-23.")


def main():
    log("OPS-SENTINEL DAEMON STARTING. Sovereign Monitoring Active.")
    log(f"Targets: {list(LOG_TARGETS.keys())}")
    log(f"Poll interval: {POLL_INTERVAL}s | Heartbeat: {HEARTBEAT_INTERVAL}s")

    watermark = load_watermark()
    last_heartbeat = 0.0

    while True:
        try:
            now = time.time()

            # Heartbeat
            if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                write_heartbeat()
                last_heartbeat = now

            # Sweep all log targets
            for source, log_path in LOG_TARGETS.items():
                watermark = sweep_log(source, log_path, watermark)

            save_watermark(watermark)

        except Exception as e:
            log(f"Main loop error: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
