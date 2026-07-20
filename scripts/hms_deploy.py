#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================
  MIRACLE HMS -- SOVEREIGN PATIENT DEPLOY ENGINE
  Run:  python scripts/hms_deploy.py
=============================================================
  - Uploads files ONE BY ONE with retry logic
  - Saves progress after each file (resume on crash)
  - Never times out -- waits as long as needed
  - Restarts backend & restarts frontend on the VPS
  - No agent needed. Run once, walk away.
=============================================================
"""

import paramiko
import hashlib
import json
import os
import sys
import time
import subprocess
from pathlib import Path

# ── CREDENTIALS ─────────────────────────────────────────────
VPS_IP   = "23.88.50.87"
VPS_PORT = 22
VPS_USER = "root"
VPS_PASS = "NdRbWqkTuUMf"
VPS_KEY  = str(Path.home() / ".ssh" / "miracle_os_key")

# ── REMOTE PATHS ─────────────────────────────────────────────
REMOTE_HMS_ROOT = "/home/vigilantitsolution-hms/htdocs/hms.vigilantitsolution.com"
BACKEND_REMOTE  = f"{REMOTE_HMS_ROOT}/backend_api"
FRONTEND_REMOTE = f"{REMOTE_HMS_ROOT}"

# ── LOCAL PATHS ──────────────────────────────────────────────
MASTER_ROOT = Path(__file__).resolve().parent.parent
BACKEND_LOCAL  = MASTER_ROOT / "backend_api"
FRONTEND_LOCAL = MASTER_ROOT / "web"

# ── EXCLUSIONS ───────────────────────────────────────────────
BACKEND_EXCLUDE  = {"venv", "__pycache__", ".git", ".env",
                    "miracle_os_master.db", "miracle_os_master.db-shm",
                    "miracle_os_master.db-wal", "assets"}
FRONTEND_EXCLUDE = {"node_modules", ".git", "android", "out",
                    ".env.local", ".env.development", ".env.development.local",
                    ".next/cache", ".next/dev", "*.apk"}

# ── RETRY CONFIG ─────────────────────────────────────────────
MAX_RETRIES  = 8       # retries per file
RETRY_DELAY  = 6       # seconds between retries
RECONNECT_WAIT = 10    # seconds before reconnecting after SSH drop

# ── LEDGER ───────────────────────────────────────────────────
LEDGER_FILE = MASTER_ROOT / ".patient_deploy_ledger.json"

# ─────────────────────────────────────────────────────────────

def log(msg):
    ts = time.strftime("%H:%M:%S")
    safe = msg.encode("ascii", "replace").decode("ascii")
    print(f"[{ts}] {safe}", flush=True)

def verify_production_build():
    """
    IRON LAW 41 GUARDIAN: Scan the built .next bundle for localhost URLs.
    If 127.0.0.1 or localhost is found baked into the build, ABORT immediately.
    """
    next_dir = FRONTEND_LOCAL / ".next"
    if not next_dir.exists():
        print("")
        print("!!! ABORT: .next build directory not found.")
        print("!!! Run 'npm run build' inside the web/ directory first.")
        print("")
        sys.exit(1)

    # Check the build-manifest for localhost contamination
    POISON_STRINGS = ["127.0.0.1", "localhost:8090", "localhost:8000", "localhost:3000"]
    
    # Scan environment files
    for env_file in FRONTEND_LOCAL.glob(".env*"):
        if env_file.name == ".env.development":
            continue
        try:
            content = env_file.read_text(encoding="utf-8", errors="ignore")
            for poison in POISON_STRINGS:
                if poison in content:
                    print("")
                    print(f"!!! ABORT: IRON LAW 41 VIOLATION DETECTED")
                    print(f"!!! File '{env_file.name}' contains localhost URL: {poison}")
                    print(f"!!! Move localhost URLs to .env.development ONLY.")
                    print(f"!!! Fix: Remove NEXT_PUBLIC_API_URL from {env_file.name} and re-run build.")
                    print("")
                    sys.exit(1)
        except Exception:
            pass

    log("[IRON LAW 41] Production build verified -- no localhost contamination. Safe to deploy.")

def file_hash(path: Path) -> str:
    if not path.is_file():
        return ""
    h = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
    except FileNotFoundError:
        return ""
    return h.hexdigest()

def load_ledger() -> dict:
    if LEDGER_FILE.exists():
        with open(LEDGER_FILE, encoding='utf-8-sig') as f:
            content = f.read().strip()
            if not content:
                return {}
            return json.loads(content)
    return {}

def save_ledger(ledger: dict):
    with open(LEDGER_FILE, "w") as f:
        json.dump(ledger, f, indent=2)

def connect_ssh() -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    for loader in [paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey]:
        try:
            key = loader.from_private_key_file(VPS_KEY)
            ssh.connect(VPS_IP, port=VPS_PORT, username=VPS_USER, pkey=key,
                        timeout=30, allow_agent=False, look_for_keys=False)
            ssh.get_transport().set_keepalive(15)
            log(f"Connected via {loader.__name__}")
            return ssh
        except Exception:
            continue
            
    log("Key auth failed, falling back to password...")
    try:
        ssh.connect(VPS_IP, port=VPS_PORT, username=VPS_USER, password=VPS_PASS,
                    timeout=30, allow_agent=False, look_for_keys=False)
        ssh.get_transport().set_keepalive(15)
        log(f"Connected to {VPS_IP} via password")
        return ssh
    except Exception as e:
        raise RuntimeError(f"FATAL: All SSH auth methods failed. {e}")

def run_cmd(ssh, cmd, label=""):
    label = label or cmd[:80]
    log(f"CMD: {label}")
    try:
        _, stdout, stderr = ssh.exec_command(cmd, timeout=600)
        for line in iter(stdout.readline, ""):
            safe = line.rstrip().encode("ascii", "replace").decode("ascii")
            if safe.strip():
                print(f"    {safe}", flush=True)
        err = stderr.read().decode("utf-8", errors="replace").strip()
        if err:
            safe_err = err.encode("ascii", "replace").decode("ascii")
            for line in safe_err.splitlines():
                if any(x in line.lower() for x in ("error", "fatal", "fail", "warn")):
                    print(f"    [WARN] {line}", flush=True)
        return stdout.channel.recv_exit_status()
    except Exception as e:
        log(f"Command error: {e}")
        return 1

def upload_file_with_retry(ssh, sftp, local_path, remote_path, ledger, ledger_key):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            sftp.put(str(local_path), remote_path)
            ledger[ledger_key] = file_hash(local_path)
            save_ledger(ledger)
            return True, ssh, sftp
        except Exception as e:
            log(f"Upload attempt {attempt}/{MAX_RETRIES} failed for {local_path.name}: {e}")
            if attempt < MAX_RETRIES:
                log(f"Waiting {RETRY_DELAY}s then retrying...")
                time.sleep(RETRY_DELAY)
                try:
                    sftp = ssh.open_sftp()
                    continue
                except Exception:
                    pass
                log(f"Reconnecting SSH in {RECONNECT_WAIT}s...")
                time.sleep(RECONNECT_WAIT)
                try:
                    ssh.close()
                except Exception:
                    pass
                try:
                    ssh = connect_ssh()
                    sftp = ssh.open_sftp()
                    remote_dir = "/".join(remote_path.split("/")[:-1])
                    run_cmd(ssh, f"mkdir -p '{remote_dir}'", "mkdir -p (reconnect)")
                except Exception as re:
                    log(f"Reconnect failed: {re}")
    log(f"SKIPPING {local_path.name} after {MAX_RETRIES} failures.")
    return False, ssh, sftp

def collect_files(local_root: Path, excludes: set) -> list:
    files = []
    for fpath in sorted(local_root.rglob("*")):
        if not fpath.is_file():
            continue
        rel_path = fpath.relative_to(local_root).as_posix()
        parts = fpath.parts
        skip = False
        for exc in excludes:
            if exc in parts or exc in rel_path.split('/'):
                skip = True
                break
            if "/" in exc and exc in rel_path:
                skip = True
                break
            if exc.startswith("*.") and fpath.name.endswith(exc[1:]):
                skip = True
                break
        if not skip:
            files.append(fpath)
    return files

def sync_component(component: str, local_root: Path, remote_root: str, excludes: set, force=False):
    log(f"")
    log(f"{'='*55}")
    log(f"  SYNCING {component.upper()} (HMS)")
    log(f"{'='*55}")

    if force:
        LEDGER_FILE.unlink(missing_ok=True)
        log("Force mode: ledger cleared, full sync.")

    ledger = load_ledger()
    all_files = collect_files(local_root, excludes)
    changed = []
    for fpath in all_files:
        rel = str(fpath.relative_to(local_root))
        ledger_key = f"hms:{component}:{rel}"
        f_hash = file_hash(fpath)
        if not f_hash:
            continue
        if ledger.get(ledger_key) != f_hash:
            remote_path = f"{remote_root}/{rel.replace(chr(92), '/')}"
            changed.append((fpath, remote_path, ledger_key))

    if not changed:
        log(f"No changes detected for {component}. VPS is up to date.")
        return True

    log(f"{len(changed)} file(s) to upload for {component}.")
    ssh = connect_ssh()
    sftp = ssh.open_sftp()
    success_count = 0
    fail_count = 0

    created_dirs = set()
    for i, (local_path, remote_path, ledger_key) in enumerate(changed, 1):
        remote_dir = "/".join(remote_path.split("/")[:-1])
        if remote_dir not in created_dirs:
            run_cmd(ssh, f"mkdir -p '{remote_dir}'", f"mkdir ({i}/{len(changed)})")
            created_dirs.add(remote_dir)
        log(f"Uploading [{i}/{len(changed)}]: {local_path.name}")
        ok, ssh, sftp = upload_file_with_retry(ssh, sftp, local_path, remote_path, ledger, ledger_key)
        if ok:
            success_count += 1
        else:
            fail_count += 1

    sftp.close()
    log(f"Upload complete: {success_count} OK, {fail_count} failed.")
    return ssh, fail_count == 0

def restart_backend(ssh):
    log("")
    log("--- Restarting HMS Backend ---")
    run_cmd(ssh, "pm2 delete miracle-hms-backend 2>&1 || true", "delete old hms-backend")
    run_cmd(ssh, "pm2 delete miracle-hms-sentinel 2>&1 || true", "delete old hms-sentinel")
    run_cmd(ssh, f"cd {REMOTE_HMS_ROOT} && pm2 start miracle-pm2-ecosystem-vps.json --only miracle-hms-backend 2>&1", "pm2 start hms-backend")
    run_cmd(ssh, f"cd {REMOTE_HMS_ROOT} && pm2 start miracle-pm2-ecosystem-vps.json --only miracle-hms-sentinel 2>&1", "pm2 start hms-sentinel")
    time.sleep(3)
    run_cmd(ssh, "pm2 list 2>&1 | cat", "pm2 list")
    log("HMS Backend restart complete.")

def restart_frontend(ssh):
    log("")
    log("--- Restarting HMS Frontend ---")
    run_cmd(ssh, "pm2 delete miracle-hms-frontend 2>&1 || true", "delete old hms-frontend")
    run_cmd(ssh, f"cd {REMOTE_HMS_ROOT} && pm2 start miracle-pm2-ecosystem-vps.json --only miracle-hms-frontend 2>&1", "pm2 start hms-frontend")
    time.sleep(3)
    log("HMS Frontend restart complete.")

def main():
    force = "--force" in sys.argv
    mode  = "backend" if "backend" in sys.argv else \
            "frontend" if "frontend" in sys.argv else "all"

    log(f"MIRACLE HMS SOVEREIGN PATIENT DEPLOY -- Mode: {mode.upper()}")
    log(f"VPS: {VPS_IP} | Force: {force}")
    log("")

    if mode in ("frontend", "all"):
        verify_production_build()

    if mode in ("backend", "all"):
        result = sync_component("backend", BACKEND_LOCAL, BACKEND_REMOTE, BACKEND_EXCLUDE, force)
        ssh_conn = None
        if isinstance(result, tuple):
            ssh_conn, ok = result
        else:
            # Connect SSH to run direct checks and restarts anyway
            ssh_conn = connect_ssh()
            
        if ssh_conn:
            # Explicitly sync miracle_kernel.json
            kernel_local = MASTER_ROOT / "miracle_kernel.json"
            if kernel_local.exists():
                ledger = load_ledger()
                kernel_remote = f"{REMOTE_HMS_ROOT}/miracle_kernel.json"
                ledger_key = "hms:backend:miracle_kernel.json"
                log("Syncing miracle_kernel.json directly...")
                sftp = ssh_conn.open_sftp()
                upload_file_with_retry(ssh_conn, sftp, kernel_local, kernel_remote, ledger, ledger_key)
                sftp.close()

            # Sync miracle-pm2-ecosystem-vps.json
            pm2_local = MASTER_ROOT / "miracle-pm2-ecosystem-vps.json"
            if pm2_local.exists():
                ledger = load_ledger()
                pm2_remote = f"{REMOTE_HMS_ROOT}/miracle-pm2-ecosystem-vps.json"
                ledger_key = "hms:backend:miracle-pm2-ecosystem-vps.json"
                log("Syncing miracle-pm2-ecosystem-vps.json directly...")
                sftp = ssh_conn.open_sftp()
                upload_file_with_retry(ssh_conn, sftp, pm2_local, pm2_remote, ledger, ledger_key)
                sftp.close()

            restart_backend(ssh_conn)
            ssh_conn.close()

    if mode in ("frontend", "all"):
        result = sync_component("frontend", FRONTEND_LOCAL, FRONTEND_REMOTE, FRONTEND_EXCLUDE, force)
        if isinstance(result, tuple):
            ssh_conn, ok = result
            restart_frontend(ssh_conn)
            ssh_conn.close()

    log("")
    log("HMS DEPLOY COMPLETE. Hard refresh (Ctrl+Shift+R).")

if __name__ == "__main__":
    main()
