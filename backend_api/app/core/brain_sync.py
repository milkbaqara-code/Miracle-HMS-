"""
MIRACLE HMS — SOVEREIGN BRAIN SYNC ENGINE
==========================================
Auto-learns from the entire codebase. Runs as a background PM2 process.
Updates the AI's miracle_knowledge DB whenever ANYTHING changes:
  - New router files (new API engines)
  - New TSX dashboard pages
  - Changes to miracle_kernel.json zones
  - Changes to DB models (new tables/columns)
  - Changes to accounting engines
  - New HR departments
  - New CSS layouts

4-LAYER COST HIERARCHY:
  Layer 0: Pure Python regex  = 0 tokens
  Layer 1: SQLAlchemy DB      = 0 tokens
  Layer 2: EXECUTE_SQL loop   = 0 tokens
  Layer 3: Gemini Flash       = ~200 tokens (last resort only)

This engine runs at Layer 0 cost — zero LLM tokens to train the AI.
"""

import os
import re
import ast
import json
import time
import sqlite3
import logging
import hashlib
import threading
from pathlib import Path
from datetime import datetime, timezone

# ──────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────
PROJECT_ROOT   = Path(__file__).resolve().parent.parent.parent.parent
BACKEND_ROOT   = PROJECT_ROOT / "backend_api"
FRONTEND_ROOT  = PROJECT_ROOT / "web"
KERNEL_PATH    = PROJECT_ROOT / "miracle_kernel.json"
DB_PATH        = PROJECT_ROOT / "miracle_os_master.db"
LEDGER_PATH    = PROJECT_ROOT / ".brain_sync_ledger.json"  # tracks file hashes

WATCH_DIRS = {
    "routers":    BACKEND_ROOT / "app" / "routers",
    "models":     BACKEND_ROOT / "app" / "models",
    "pages":      FRONTEND_ROOT / "app" / "dashboard",
    "core":       BACKEND_ROOT / "app" / "core",
    "kernel":     PROJECT_ROOT,
}

POLL_INTERVAL = 30  # seconds between scans

logging.basicConfig(
    level=logging.INFO,
    format="[BRAIN-SYNC] %(asctime)s %(levelname)s — %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("BrainSync")


# ──────────────────────────────────────────────────────────────
# HASH LEDGER — tracks which files have changed
# ──────────────────────────────────────────────────────────────
def _load_ledger() -> dict:
    if LEDGER_PATH.exists():
        try:
            return json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}

def _save_ledger(ledger: dict):
    LEDGER_PATH.write_text(json.dumps(ledger, indent=2), encoding="utf-8")

def _file_hash(path: Path) -> str:
    try:
        return hashlib.md5(path.read_bytes()).hexdigest()
    except Exception:
        return ""

def _changed_files(ledger: dict, directory: Path, extensions: list) -> list:
    changed = []
    for ext in extensions:
        for f in directory.rglob(f"*{ext}"):
            if any(skip in str(f) for skip in ["__pycache__", ".next", "node_modules", ".venv", "venv"]):
                continue
            h = _file_hash(f)
            if ledger.get(str(f)) != h:
                changed.append(f)
                ledger[str(f)] = h
    return changed


# ──────────────────────────────────────────────────────────────
# DB INJECTOR — upserts knowledge into miracle_knowledge
# ──────────────────────────────────────────────────────────────
def _inject(conn: sqlite3.Connection, category: str, insight: str,
            business_context: str, importance: int, prevention_rule: str = ""):
    """Upsert a knowledge entry. Update if exists, insert if not."""
    now = datetime.now(timezone.utc).isoformat()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM miracle_knowledge WHERE category=? AND status='ACTIVE' LIMIT 1",
        (category,)
    )
    row = cur.fetchone()
    if row:
        cur.execute(
            "UPDATE miracle_knowledge SET insight=?, business_context=?, importance_score=?, prevention_rule=?, created_at=? WHERE id=?",
            (insight[:4000], business_context[:200], importance, prevention_rule[:500], now, row[0])
        )
    else:
        cur.execute(
            "INSERT INTO miracle_knowledge (source_role, category, insight, business_context, importance_score, status, created_at, prevention_rule) VALUES (?,?,?,?,?,?,?,?)",
            ("CDO", category, insight[:4000], business_context[:200], importance, "ACTIVE", now, prevention_rule[:500])
        )


# ──────────────────────────────────────────────────────────────
# EXTRACTOR 1: ROUTER FILES → API ENDPOINT KNOWLEDGE
# ──────────────────────────────────────────────────────────────
def extract_router_knowledge(router_file: Path) -> dict | None:
    """Parse a Python router file and extract endpoint knowledge."""
    try:
        source = router_file.read_text(encoding="utf-8", errors="ignore")
        name = router_file.stem

        # Extract route decorators
        routes = re.findall(
            r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']',
            source, re.IGNORECASE
        )

        # Extract docstrings near route decorators
        func_blocks = re.findall(
            r'@router\.\w+\([^)]+\)\s*(?:@[^\n]+\n)*async def \w+[^:]*:\s*"""([^"]{0,300})',
            source, re.DOTALL
        )

        # Extract RBAC role checks
        roles = re.findall(r'role(?:s)?\s+(?:in|not in)\s+[\[\(][^\]\)]+[\]\)]', source)
        roles_text = "; ".join(roles[:5]) if roles else "No RBAC restrictions found"

        # Extract key variable names that hint at purpose
        tables = re.findall(r'db\.query\((\w+)\)', source)
        unique_tables = list(dict.fromkeys(tables[:10]))

        if not routes:
            return None

        route_list = "\n".join([f"  {m.upper()} /api/{name.replace('_', '-')}{r}" for m, r in routes[:20]])
        doc_text = func_blocks[0].strip().replace("\n", " ")[:300] if func_blocks else "See endpoint source for details."
        tables_text = ", ".join(unique_tables) if unique_tables else "various"

        insight = (
            f"ROUTER: {name}.py — HMS API ENGINE\n"
            f"Endpoints ({len(routes)} total):\n{route_list}\n"
            f"DB Tables accessed: {tables_text}\n"
            f"RBAC: {roles_text[:200]}\n"
            f"Purpose: {doc_text}"
        )

        return {
            "category": f"API_ENGINE_{name.upper().replace('-','_')}",
            "insight": insight,
            "business_context": name,
            "importance": 82,
            "prevention_rule": f"When user asks about {name.replace('_',' ')} functionality, use this API knowledge. Exact endpoints available."
        }
    except Exception as e:
        logger.warning(f"Router extract failed for {router_file.name}: {e}")
        return None


# ──────────────────────────────────────────────────────────────
# EXTRACTOR 2: TSX PAGES → UI PANEL KNOWLEDGE
# ──────────────────────────────────────────────────────────────
def extract_tsx_knowledge(tsx_file: Path) -> dict | None:
    """Parse a Next.js TSX page and extract UI knowledge."""
    try:
        source = tsx_file.read_text(encoding="utf-8", errors="ignore")

        # Get page path relative to app directory
        try:
            rel = tsx_file.relative_to(FRONTEND_ROOT / "app")
            page_path = "/" + str(rel.parent).replace("\\", "/")
        except ValueError:
            page_path = str(tsx_file.parent.name)

        # Extract tab names
        tabs = re.findall(
            r'(?:tab|Tab|TAB)[^"\']*["\']([^"\']{2,40})["\']',
            source
        )
        # Extract button text
        buttons = re.findall(
            r'<[Bb]utton[^>]*>\s*([A-Z][A-Za-z\s&/]{2,35})\s*</[Bb]utton>',
            source
        )
        # Extract heading text
        headings = re.findall(r'<h[123][^>]*>([^<]{3,60})</h[123]>', source)
        # Extract section/card titles
        titles = re.findall(
            r'(?:title|heading|label)[^"\']*["\']([A-Z][A-Za-z\s&/]{3,40})["\']',
            source
        )
        # Extract API calls
        api_calls = re.findall(r'fetch\(["\`][^"\'`]*(/api/[^"\'`\s)]+)', source)
        unique_apis = list(dict.fromkeys(api_calls[:10]))

        # Extract state variable names for clues about features
        states = re.findall(r'const\s*\[(\w+),\s*set\w+\]\s*=\s*useState', source)

        page_name = tsx_file.parent.name if tsx_file.name == "page.tsx" else tsx_file.stem

        tabs_clean = list(dict.fromkeys([t.strip() for t in tabs if len(t.strip()) > 2]))[:12]
        btns_clean = list(dict.fromkeys([b.strip() for b in buttons if len(b.strip()) > 2]))[:15]
        hdgs_clean = list(dict.fromkeys([h.strip() for h in headings if len(h.strip()) > 2]))[:8]

        if not any([tabs_clean, btns_clean, hdgs_clean, unique_apis]):
            return None  # Skip empty pages

        insight_parts = [f"UI PAGE: {page_name} at {page_path}"]
        if hdgs_clean:
            insight_parts.append(f"Headings/Sections: {' | '.join(hdgs_clean[:5])}")
        if tabs_clean:
            insight_parts.append(f"Tabs available: {', '.join(tabs_clean)}")
        if btns_clean:
            insight_parts.append(f"Buttons/Actions: {', '.join(btns_clean[:10])}")
        if unique_apis:
            insight_parts.append(f"API endpoints called: {', '.join(unique_apis[:6])}")

        return {
            "category": f"UI_PAGE_{page_name.upper().replace('-','_')}",
            "insight": "\n".join(insight_parts),
            "business_context": page_path,
            "importance": 78,
            "prevention_rule": f"When user asks about the {page_name} page or navigates to {page_path}, use this UI knowledge to describe what they see and what actions are available."
        }
    except Exception as e:
        logger.warning(f"TSX extract failed for {tsx_file.name}: {e}")
        return None


# ──────────────────────────────────────────────────────────────
# EXTRACTOR 3: MODELS.PY → DB SCHEMA KNOWLEDGE
# ──────────────────────────────────────────────────────────────
def extract_model_knowledge(model_file: Path) -> dict | None:
    """Parse SQLAlchemy model file and extract table schema."""
    try:
        source = model_file.read_text(encoding="utf-8", errors="ignore")

        # Find all model class definitions
        class_blocks = re.findall(
            r'class\s+(\w+)\s*\([^)]*Base[^)]*\):\s*\n\s+__tablename__\s*=\s*["\']([^"\']+)["\']([^#class]{0,800})',
            source, re.DOTALL
        )

        if not class_blocks:
            return None

        schema_lines = [f"DB SCHEMA from {model_file.name}:"]
        for cls_name, table_name, body in class_blocks[:20]:
            # Extract column names and types
            columns = re.findall(
                r'(\w+)\s*(?::|=)\s*(?:Mapped\[)?(?:Column\(|mapped_column\()?([A-Za-z]+)',
                body
            )
            col_names = [c[0] for c in columns if c[0] not in
                        ("id", "Base", "Column", "String", "Integer", "Boolean", "DateTime", "Float",
                         "ForeignKey", "relationship", "JSON", "Text", "Enum", "Optional", "List")]
            col_names = [c for c in col_names if not c.startswith("_") and len(c) > 1][:15]

            schema_lines.append(f"\n  TABLE: {table_name} (Model: {cls_name})")
            if col_names:
                schema_lines.append(f"  COLUMNS: {', '.join(col_names)}")

        return {
            "category": f"DB_SCHEMA_{model_file.stem.upper()}",
            "insight": "\n".join(schema_lines),
            "business_context": "DATABASE",
            "importance": 88,
            "prevention_rule": "Use ONLY these exact table and column names in any SQL queries. Never invent column names."
        }
    except Exception as e:
        logger.warning(f"Model extract failed for {model_file.name}: {e}")
        return None


# ──────────────────────────────────────────────────────────────
# EXTRACTOR 4: MIRACLE_KERNEL.JSON → ZONE KNOWLEDGE
# ──────────────────────────────────────────────────────────────
def extract_kernel_knowledge() -> list:
    """Extract per-zone knowledge from miracle_kernel.json."""
    entries = []
    try:
        data = json.loads(KERNEL_PATH.read_text(encoding="utf-8"))
        zones = data.get("zones", [])
        version = data.get("version", "unknown")

        # Version entry
        entries.append({
            "category": "HMS_KERNEL_VERSION",
            "insight": f"Miracle HMS Kernel Version: {version}. Total zones: {len(zones)}. This is the active kernel loaded by the AI.",
            "business_context": "SYSTEM",
            "importance": 90,
            "prevention_rule": "Always identify as Miracle HMS version per this kernel."
        })

        # Per-zone entries
        for z in zones:
            zid = z.get("id", "")
            zname = z.get("name", "")
            knowledge = z.get("ai_knowledge", "")
            greeting = z.get("ai_greeting_context", "")
            path = z.get("path", "")

            if not knowledge or not zid:
                continue

            # Extract buttons from knowledge block
            btns = []
            if "[EXACT UI BUTTONS:" in knowledge:
                btn_section = knowledge.split("[EXACT UI BUTTONS:")[1].split("]")[0]
                btns = [b.strip() for b in btn_section.split(",") if b.strip()]

            insight = (
                f"ZONE {zid} — {zname.upper()}\n"
                f"Path: {path or '/dashboard'}\n"
                f"AI Context: {greeting}\n"
                f"Knowledge: {knowledge[:1500]}"
            )

            entries.append({
                "category": f"ZONE_{zid.replace('-','_').replace('/','_')}_FULL",
                "insight": insight,
                "business_context": zid,
                "importance": 86,
                "prevention_rule": f"When user is on {zid} ({zname}), use this zone knowledge exclusively."
            })

        logger.info(f"Kernel: extracted {len(entries)} zone entries (version={version})")
    except Exception as e:
        logger.error(f"Kernel extract failed: {e}")
    return entries


# ──────────────────────────────────────────────────────────────
# EXTRACTOR 5: ACCOUNTING ENGINE → COA KNOWLEDGE
# ──────────────────────────────────────────────────────────────
def extract_accounting_knowledge() -> list:
    """Extract Chart of Accounts and accounting categories."""
    entries = []
    accounting_files = [
        BACKEND_ROOT / "app" / "routers" / "accounting_engine.py",
        BACKEND_ROOT / "app" / "routers" / "dept_accounting.py",
        BACKEND_ROOT / "app" / "routers" / "agi_coa_engine.py",
        BACKEND_ROOT / "app" / "routers" / "accounting_enterprise.py",
    ]

    all_account_codes = []
    all_categories = []

    for af in accounting_files:
        if not af.exists():
            continue
        try:
            source = af.read_text(encoding="utf-8", errors="ignore")

            # Extract account codes like "OPD_REVENUE", "EXPENSE_PAYROLL"
            codes = re.findall(r'["\']([A-Z][A-Z_]{3,30})["\']', source)
            # Filter to likely account codes (all caps with underscores)
            account_codes = [c for c in codes if "_" in c and not c.startswith("HTTP")
                           and not c.endswith("_ID") and "SELECT" not in c]
            all_account_codes.extend(account_codes[:30])

            # Extract category strings
            cats = re.findall(r'category["\s=:]+["\']([^"\']{3,40})["\']', source)
            all_categories.extend(cats[:20])

        except Exception as e:
            logger.warning(f"Accounting extract failed for {af.name}: {e}")

    unique_codes = list(dict.fromkeys(all_account_codes))[:60]
    unique_cats = list(dict.fromkeys(all_categories))[:30]

    if unique_codes:
        entries.append({
            "category": "HMS_ACCOUNTING_COA",
            "insight": (
                "MIRACLE HMS CHART OF ACCOUNTS:\n"
                f"Revenue Account Codes: {', '.join([c for c in unique_codes if 'REVENUE' in c or 'INCOME' in c][:20])}\n"
                f"Expense Account Codes: {', '.join([c for c in unique_codes if 'EXPENSE' in c or 'COST' in c][:20])}\n"
                f"Other Codes: {', '.join([c for c in unique_codes if 'REVENUE' not in c and 'EXPENSE' not in c and 'COST' not in c and 'INCOME' not in c][:15])}\n"
                f"Transaction Categories: {', '.join(unique_cats[:15])}\n"
                "Use ONLY these exact codes in accounting queries and EXECUTE_SQL for account_code field."
            ),
            "business_context": "Z-11,ACCOUNTING",
            "importance": 89,
            "prevention_rule": "Use ONLY the account codes listed here. Never invent account codes for SQL queries."
        })

    return entries


# ──────────────────────────────────────────────────────────────
# EXTRACTOR 6: HR DEPARTMENTS → DEPARTMENT KNOWLEDGE
# ──────────────────────────────────────────────────────────────
def extract_hr_knowledge() -> list:
    """Extract HR department codes and structures."""
    entries = []
    hr_files = [
        BACKEND_ROOT / "app" / "routers" / "hr.py",
        BACKEND_ROOT / "app" / "routers" / "hr_compliance.py",
        BACKEND_ROOT / "app" / "routers" / "hr_talent_engine.py",
    ]

    all_depts = []
    all_tiers = []
    all_designations = []

    for hf in hr_files:
        if not hf.exists():
            continue
        try:
            source = hf.read_text(encoding="utf-8", errors="ignore")
            # Extract department names from strings
            depts = re.findall(r'dept["\s=:]+["\']([^"\']{2,50})["\']', source, re.IGNORECASE)
            all_depts.extend(depts[:20])
            # Extract tier names
            tiers = re.findall(r'tier["\s=:]+["\']([^"\']{2,30})["\']', source, re.IGNORECASE)
            all_tiers.extend(tiers[:10])
            # Extract designation strings
            desigs = re.findall(r'(?:designation|position)["\s=:]+["\']([^"\']{2,40})["\']', source, re.IGNORECASE)
            all_designations.extend(desigs[:15])
        except Exception as e:
            logger.warning(f"HR extract failed for {hf.name}: {e}")

    # Add known clinical departments from DB_SCHEMA_ATLAS
    known_clinical_depts = [
        "Physicians", "Surgeons", "ICU Nursing", "Ward Nursing", "ER Doctors",
        "Laboratory Technicians", "Clinical Pharmacists", "Admissions & Discharges",
        "Operating Theater (OT)", "Outpatient (OPD)", "Radiology", "Physiotherapy",
        "Dietary & Nutrition", "Biomedical Engineering", "Admin", "HR", "Accounts",
        "IT & Systems", "Security", "Housekeeping (Biomedical Cleaning)"
    ]

    unique_depts = list(dict.fromkeys(known_clinical_depts + [d for d in all_depts if d.strip()]))[:40]
    unique_tiers = list(dict.fromkeys(all_tiers))[:10]
    unique_desigs = list(dict.fromkeys(all_designations))[:15]

    entries.append({
        "category": "HMS_HR_DEPARTMENTS",
        "insight": (
            "MIRACLE HMS HR DEPARTMENT REGISTRY:\n"
            f"Clinical Departments: {', '.join(unique_depts[:25])}\n"
            f"Executive Tiers: {', '.join(unique_tiers) if unique_tiers else 'CDO, GM, DIRECTOR, HOD, SENIOR, OPERATIVE'}\n"
            f"Designations: {', '.join(unique_desigs) if unique_desigs else 'Consultant, Specialist, Senior Nurse, Staff Nurse, Technician, Coordinator'}\n"
            "IMPORTANT: NRS = Nursing department staff. Use exact dept names in SQL WHERE dept= queries."
        ),
        "business_context": "Z-09,HR",
        "importance": 87,
        "prevention_rule": "NRS=Nursing. Use exact department names in SQL. Never guess department codes."
    })

    return entries


# ──────────────────────────────────────────────────────────────
# MAIN SYNC ENGINE
# ──────────────────────────────────────────────────────────────
class MiracleBrainSyncEngine:

    def __init__(self):
        self.ledger = _load_ledger()
        self.conn = None
        self._connect_db()

    def _connect_db(self):
        try:
            self.conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
            logger.info(f"DB connected: {DB_PATH.name}")
        except Exception as e:
            logger.error(f"DB connect failed: {e}")
            self.conn = None

    def _save(self, entries: list, source_label: str):
        if not self.conn or not entries:
            return 0
        count = 0
        for e in entries:
            try:
                _inject(self.conn, e["category"], e["insight"],
                        e["business_context"], e["importance"],
                        e.get("prevention_rule", ""))
                count += 1
            except Exception as ex:
                logger.warning(f"Inject failed [{e['category']}]: {ex}")
        try:
            self.conn.commit()
        except Exception as ex:
            logger.error(f"Commit failed: {ex}")
        logger.info(f"[{source_label}] {count} entries synced to AI brain.")
        return count

    def sync_kernel(self):
        """Sync zone knowledge from miracle_kernel.json."""
        entries = extract_kernel_knowledge()
        return self._save(entries, "KERNEL")

    def sync_routers(self, files=None):
        """Sync API engine knowledge from all router .py files."""
        router_dir = WATCH_DIRS["routers"]
        if files is None:
            files = list(router_dir.glob("*.py"))

        entries = []
        for f in files:
            if f.stem.startswith("DEPRECATED") or f.stem == "__init__":
                continue
            result = extract_router_knowledge(f)
            if result:
                entries.append(result)

        return self._save(entries, "ROUTERS")

    def sync_tsx_pages(self, files=None):
        """Sync UI panel knowledge from dashboard TSX pages."""
        page_dir = WATCH_DIRS["pages"]
        if files is None:
            files = list(page_dir.rglob("page.tsx")) + list(page_dir.rglob("*.tsx"))

        entries = []
        seen = set()
        for f in files:
            if "node_modules" in str(f) or ".next" in str(f):
                continue
            page_key = f.parent.name
            if page_key in seen:
                continue
            seen.add(page_key)
            result = extract_tsx_knowledge(f)
            if result:
                entries.append(result)

        return self._save(entries, "TSX_PAGES")

    def sync_models(self, files=None):
        """Sync DB schema knowledge from SQLAlchemy model files."""
        model_dir = WATCH_DIRS["models"]
        if files is None:
            files = list(model_dir.glob("*.py"))

        entries = []
        for f in files:
            if f.stem == "__init__":
                continue
            result = extract_model_knowledge(f)
            if result:
                entries.append(result)

        return self._save(entries, "MODELS")

    def sync_accounting(self):
        """Sync Chart of Accounts and accounting categories."""
        entries = extract_accounting_knowledge()
        return self._save(entries, "ACCOUNTING")

    def sync_hr(self):
        """Sync HR department and designation registry."""
        entries = extract_hr_knowledge()
        return self._save(entries, "HR_DEPTS")

    def full_sync(self):
        """Full sync of ALL knowledge sources. Zero LLM tokens."""
        start = time.time()
        logger.info("=" * 60)
        logger.info("MIRACLE HMS BRAIN — FULL SYNC STARTING")
        logger.info("=" * 60)

        total = 0
        total += self.sync_kernel()
        total += self.sync_models()
        total += self.sync_accounting()
        total += self.sync_hr()
        total += self.sync_routers()
        total += self.sync_tsx_pages()

        elapsed = time.time() - start
        logger.info(f"FULL SYNC COMPLETE — {total} knowledge entries synced in {elapsed:.1f}s | 0 LLM tokens used")
        logger.info("=" * 60)
        return total

    def incremental_sync(self):
        """Check for changed files and sync only what changed."""
        changed_any = False

        # Check kernel
        kernel_hash = _file_hash(KERNEL_PATH)
        if self.ledger.get(str(KERNEL_PATH)) != kernel_hash:
            logger.info("miracle_kernel.json changed → syncing zones...")
            self.sync_kernel()
            self.ledger[str(KERNEL_PATH)] = kernel_hash
            changed_any = True

        # Check routers
        router_changes = _changed_files(self.ledger, WATCH_DIRS["routers"], [".py"])
        if router_changes:
            logger.info(f"{len(router_changes)} router file(s) changed → syncing API knowledge...")
            self.sync_routers(router_changes)
            changed_any = True

        # Check models
        model_changes = _changed_files(self.ledger, WATCH_DIRS["models"], [".py"])
        if model_changes:
            logger.info(f"{len(model_changes)} model file(s) changed → syncing DB schema...")
            self.sync_models(model_changes)
            # Also resync accounting since models affect schema
            self.sync_accounting()
            changed_any = True

        # Check TSX pages
        tsx_changes = _changed_files(self.ledger, WATCH_DIRS["pages"], [".tsx", ".ts"])
        if tsx_changes:
            logger.info(f"{len(tsx_changes)} TSX page(s) changed → syncing UI knowledge...")
            self.sync_tsx_pages(tsx_changes)
            changed_any = True

        # Sync HR periodically (no file trigger needed — check every 10 cycles)
        if not changed_any:
            logger.debug("No changes detected. Brain is up to date.")

        if changed_any:
            _save_ledger(self.ledger)

        return changed_any

    def watch_loop(self):
        """Continuous file watcher loop. Runs as background process."""
        logger.info(f"BRAIN SYNC WATCHER ACTIVE — polling every {POLL_INTERVAL}s")
        logger.info(f"Watching: {', '.join(WATCH_DIRS.keys())}")

        cycle = 0
        while True:
            try:
                cycle += 1
                self.incremental_sync()

                # Full sync every 20 cycles (~10 minutes) to catch anything missed
                if cycle % 20 == 0:
                    logger.info("Scheduled periodic full sync...")
                    self.sync_hr()
                    self.sync_accounting()

                time.sleep(POLL_INTERVAL)

            except KeyboardInterrupt:
                logger.info("Brain sync watcher stopped by user.")
                break
            except Exception as e:
                logger.error(f"Watcher loop error: {e}")
                time.sleep(POLL_INTERVAL)


# ──────────────────────────────────────────────────────────────
# ENTRY POINTS
# ──────────────────────────────────────────────────────────────
def run_full_sync():
    """One-shot full sync. Call this from train_miracle_ai.py or on deploy."""
    engine = MiracleBrainSyncEngine()
    engine.full_sync()
    return engine

def run_watcher():
    """Start continuous watcher. Registered as PM2 process."""
    engine = MiracleBrainSyncEngine()
    engine.full_sync()  # Full sync on startup
    engine.watch_loop()  # Then watch for changes

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--watch":
        run_watcher()
    else:
        run_full_sync()
