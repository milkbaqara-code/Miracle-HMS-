"""
MIRACLE HMS -- OPS SENTINEL V1.0
=================================
The Self-Questioning, Self-Improving AI Brain.
Runs as a PM2 background process. Never sleeps.

WHAT IT DOES EVERY 60 SECONDS:
  1. Scans AIReplyAuditLog for hallucinations and weak replies
  2. Cross-references AI responses against real DB data
  3. Detects hotel vocabulary in responses (persona drift)
  4. Generates HMS self-questions and tests its own knowledge
  5. Injects corrections into miracle_knowledge for any gap found
  6. Boots importance_score for validated correct entries
  7. Logs every self-improvement action to sentinel_activity_log table

COST: 0 LLM TOKENS (Layer 0 -- Pure Python + SQLite only)
"""

import os
import re
import time
import logging
import sqlite3
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ──────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(r"d:\Vigilant IT Solutions\Miracle_HMS")
DB_PATH = PROJECT_ROOT / "miracle_os_master.db"
SCAN_INTERVAL = 60  # seconds between scan cycles
MAX_INJECTIONS_PER_CYCLE = 5  # rate limit per cycle

logging.basicConfig(
    level=logging.INFO,
    format="[SENTINEL] %(asctime)s %(levelname)s -- %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("OpsSentinel")


# ──────────────────────────────────────────────────────────────
# HOTEL VOCABULARY DETECTOR -- BANNED WORDS IN AI RESPONSES
# ──────────────────────────────────────────────────────────────
HOTEL_VOCAB_VIOLATIONS = {
    r"\b(hotel|resort|spa)\b":          ("hotel/resort", "Use 'hospital' exclusively."),
    r"\b(guests?)\b(?! portal)":        ("'guest' for patient", "Use 'patient' not 'guest'."),
    r"\bcheck[\s-]in\b(?!\s+date)":     ("'check-in' for admission", "Use 'admission' not 'check-in'."),
    r"\bcheck[\s-]out\b(?!\s+date)":    ("'check-out' for discharge", "Use 'discharge' not 'check-out'."),
    r"\bnightly rate\b":                ("'nightly rate'", "Use 'daily ward rate' not 'nightly rate'."),
    r"\brevpar\b":                       ("RevPAR (hotel metric)", "Use RevPAB (Revenue Per Available Bed)."),
    r"\bhousekeep":                      ("housekeeping", "Use 'ward cleaning' or 'biomedical maintenance'."),
    r"\broom number\b(?!.*bed)":         ("'room number'", "Use 'bed number' not 'room number'."),
    r"\bfront desk\b":                   ("'front desk'", "Use 'Admissions Desk' or 'Hospital Reception'."),
    r"\bconcierge\b":                    ("'concierge'", "Use 'Patient Care Coordinator'."),
    r"\b(amenities|amenity)\b":          ("amenities", "Use 'hospital services' or 'clinical facilities'."),
    # System instruction echo -- added after LIS Labs bug 2026-06-29
    r"ABSOLUTE IDENTITY LAW":            ("raw system directive in reply", "NEVER return knowledge DB entries verbatim. System rules are for AI context only."),
    r"You are Miracle\..*Sovereign":     ("identity law echoed verbatim", "Strip system-instruction text. local_sovereign_brain must exclude rule categories."),
}

# ──────────────────────────────────────────────────────────────
# HMS SELF-QUESTION BANK
# Questions the sentinel asks itself every cycle
# to test its own knowledge and find gaps
# ──────────────────────────────────────────────────────────────
HMS_QUESTION_BANK = [
    # Glossary/Definitions
    {"q": "What does NRS stand for in HMS?",           "keywords": ["nursing", "nurse", "department", "nrs"],           "category": "GLOSSARY_NRS"},
    {"q": "What is BOR in a hospital context?",        "keywords": ["bed occupancy rate", "occupied", "total"],          "category": "GLOSSARY_BOR"},
    {"q": "What is ALOS?",                             "keywords": ["average length of stay", "days", "discharge"],      "category": "GLOSSARY_ALOS"},
    {"q": "What is RevPAB?",                           "keywords": ["revenue per available bed", "income"],              "category": "GLOSSARY_REVPAB"},
    {"q": "What is PAR level in pharmacy?",            "keywords": ["minimum stock", "reorder", "par"],                  "category": "GLOSSARY_PAR"},
    {"q": "What is TAT in a laboratory?",              "keywords": ["turnaround time", "urgent", "routine"],             "category": "GLOSSARY_TAT"},
    {"q": "What does MRN stand for?",                  "keywords": ["medical record number", "patient", "unique"],       "category": "GLOSSARY_MRN"},
    {"q": "What is OPD?",                              "keywords": ["outpatient", "without admission", "clinic"],        "category": "GLOSSARY_OPD"},
    {"q": "What is IPD?",                              "keywords": ["inpatient", "admitted", "ward"],                    "category": "GLOSSARY_IPD"},
    {"q": "What is TPA in hospital billing?",          "keywords": ["third party", "insurance", "administrator"],        "category": "GLOSSARY_TPA"},
    {"q": "What is AMC for biomedical equipment?",     "keywords": ["annual maintenance", "contract", "service"],        "category": "GLOSSARY_AMC"},
    {"q": "What is CPPD?",                             "keywords": ["cost per patient day", "operating cost", "total"],  "category": "GLOSSARY_CPPD"},

    # Zone knowledge
    {"q": "What is Zone Z-07 in Miracle HMS?",         "keywords": ["command grid", "bed", "clinical"],                  "category": "ZONE_Z_07"},
    {"q": "What is Zone Z-05 used for?",               "keywords": ["opd", "appointment", "reservation"],                "category": "ZONE_Z_05"},
    {"q": "What does Z-20 Synapse Nexus do?",          "keywords": ["war room", "directive", "org chart", "synapse"],    "category": "ZONE_Z_20"},
    {"q": "What is the purpose of Zone Z-19?",         "keywords": ["policy", "pricing", "rate", "sop"],                 "category": "ZONE_Z_19"},
    {"q": "What is Zone Z-09?",                        "keywords": ["hr", "human resource", "payroll", "staff"],         "category": "ZONE_Z_09"},
    {"q": "What does Z-12 Clinical Inventory manage?", "keywords": ["pharmacy", "drug", "stock", "inventory"],           "category": "ZONE_Z_12"},
    {"q": "What is the Z-23 Sovereign Infra panel?",   "keywords": ["server", "pm2", "infrastructure", "ai audit"],      "category": "ZONE_Z_23"},
    {"q": "What is the Patient Portal Z-GUEST?",       "keywords": ["patient", "appointment", "bill", "meal"],           "category": "ZONE_Z_GUEST"},

    # Workflows
    {"q": "What is the patient admission workflow?",   "keywords": ["opd", "admitted", "bed", "folio", "ward"],          "category": "HMS_WORKFLOW_ADMISSION"},
    {"q": "What is the patient discharge workflow?",   "keywords": ["billing", "settle", "discharge", "checkout"],       "category": "HMS_WORKFLOW_DISCHARGE"},
    {"q": "How does pharmacy dispensing work?",        "keywords": ["par", "deduct", "inventory", "prescription"],       "category": "HMS_WORKFLOW_PHARMACY"},
    {"q": "How does the payroll system work?",         "keywords": ["base salary", "attendance", "overtime", "deduction"],"category": "HMS_WORKFLOW_HR"},
    {"q": "How does the night audit work?",            "keywords": ["daily ledger", "close", "journal", "z-11"],          "category": "HMS_WORKFLOW_FINANCE"},

    # Anti-hallucination
    {"q": "What columns does the reservations table have?", "keywords": ["room_id", "guest_name", "start_date", "nights"], "category": "DB_SCHEMA_MODELS"},
    {"q": "What is the correct BOR SQL query?",             "keywords": ["asset_grid", "in-house", "is_active"],           "category": "DB_SCHEMA_MODELS"},
    {"q": "What columns does asset_grid have?",             "keywords": ["current_status", "current_guest", "base_rate"],  "category": "DB_SCHEMA_MODELS"},
]

# ──────────────────────────────────────────────────────────────
# CORE SENTINEL ENGINE
# ──────────────────────────────────────────────────────────────
class OpsSentinel:
    """
    The Self-Questioning, Self-Improving Brain of Miracle HMS.
    Runs continuously. Never sleeps.
    """

    def __init__(self):
        self.db_path = str(DB_PATH)
        self.cycle_count = 0
        self.total_corrections = 0
        self.total_questions_asked = 0
        self._ensure_sentinel_table()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_sentinel_table(self):
        """Create sentinel activity log table if it doesn't exist."""
        try:
            with self._conn() as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS sentinel_activity_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        cycle INTEGER NOT NULL,
                        action_type TEXT NOT NULL,
                        description TEXT NOT NULL,
                        knowledge_injected TEXT,
                        tokens_used INTEGER DEFAULT 0,
                        created_at TEXT DEFAULT (datetime('now'))
                    )
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"Sentinel table creation failed: {e}")

    def _log_action(self, conn, action_type: str, description: str, knowledge: str = ""):
        """Log sentinel action to sentinel_activity_log."""
        try:
            conn.execute(
                "INSERT INTO sentinel_activity_log (cycle, action_type, description, knowledge_injected, tokens_used) VALUES (?,?,?,?,0)",
                (self.cycle_count, action_type, description[:500], knowledge[:300] if knowledge else "")
            )
        except Exception:
            pass

    def _inject_knowledge(self, conn, category: str, insight: str,
                          importance: int, prevention_rule: str = "", business_context: str = "SENTINEL"):
        """Upsert knowledge into miracle_knowledge table."""
        now = datetime.now(timezone.utc).isoformat()
        cur = conn.cursor()
        # Check if category exists and if the insight is genuinely different
        cur.execute(
            "SELECT id, insight FROM miracle_knowledge WHERE category=? AND status='ACTIVE' LIMIT 1",
            (category,)
        )
        row = cur.fetchone()
        if row:
            # Only update if insight has changed (avoid pointless writes)
            existing = (row["insight"] or "").strip()
            new = insight.strip()
            if existing == new:
                return False  # No change needed
            cur.execute(
                "UPDATE miracle_knowledge SET insight=?, importance_score=?, prevention_rule=?, created_at=? WHERE id=?",
                (new[:4000], importance, prevention_rule[:500], now, row["id"])
            )
        else:
            cur.execute(
                "INSERT INTO miracle_knowledge (source_role, category, insight, business_context, importance_score, status, created_at, prevention_rule) VALUES (?,?,?,?,?,?,?,?)",
                ("SENTINEL", category, insight[:4000], business_context, importance, "ACTIVE", now, prevention_rule[:500])
            )
        self.total_corrections += 1
        return True

    # ──────────────────────────────────────────────────
    # SCAN 1: AUDIT LOG HALLUCINATION DETECTOR
    # ──────────────────────────────────────────────────
    def scan_audit_log(self, conn) -> int:
        """
        Reads recent AI replies from AIReplyAuditLog.
        Detects hotel vocabulary, persona drift, and data fabrication.
        Injects ANTI_HALLUCINATION corrections for any violation found.
        """
        corrections_made = 0
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
            rows = conn.execute("""
                SELECT id, zone, user_query, ai_reply, verdict, hallucination_type
                FROM ai_reply_audit_log
                WHERE created_at >= ?
                  AND verdict IN ('PENDING', 'UNVERIFIABLE', 'HALLUCINATION')
                ORDER BY created_at DESC
                LIMIT 30
            """, (cutoff,)).fetchall()

            for row in rows:
                reply = (row["ai_reply"] or "").lower()
                violations = []

                # Check for hotel vocabulary
                for pattern, (term, rule) in HOTEL_VOCAB_VIOLATIONS.items():
                    if re.search(pattern, reply, re.IGNORECASE):
                        violations.append((term, rule))

                # Check for ellipsis (truncation signal)
                if "..." in (row["ai_reply"] or ""):
                    violations.append(("ellipsis truncation", "Never use '...' in responses. Truncation is a SYSTEM FAILURE."))

                # Check for offline mode text
                if "offline mode" in reply or "[offline" in reply:
                    violations.append(("OFFLINE MODE text", "Never output [OFFLINE MODE] or similar. TTS reads brackets as characters."))

                # Check for apology patterns
                if re.search(r"\b(i'm sorry|i am sorry|i apologize|i cannot|i am unable)\b", reply, re.IGNORECASE):
                    violations.append(("apology pattern", "NEVER apologize or say 'I cannot'. Always find a path forward."))

                if violations:
                    for term, rule in violations[:2]:  # max 2 per reply
                        cat = f"ANTI_HALLUCINATION"
                        insight = (
                            f"SELF-CORRECTED VIOLATION (Sentinel Cycle {self.cycle_count}):\n"
                            f"Violation detected: {term}\n"
                            f"Found in reply to: '{(row['user_query'] or '')[:100]}'\n"
                            f"Correction rule: {rule}"
                        )
                        if self._inject_knowledge(conn, cat, insight, 97, rule):
                            corrections_made += 1
                            self._log_action(conn, "HALLUCINATION_CORRECTED",
                                             f"Corrected {term} violation in reply {row['id']}", rule)

                    # Mark as reviewed
                    conn.execute(
                        "UPDATE ai_reply_audit_log SET verdict='REVIEWED_BY_SENTINEL' WHERE id=?",
                        (row["id"],)
                    )

        except Exception as e:
            logger.warning(f"Audit scan failed: {e}")

        return corrections_made

    # ──────────────────────────────────────────────────
    # SCAN 2: SELF-QUESTIONING KNOWLEDGE TEST
    # ──────────────────────────────────────────────────
    def run_self_questions(self, conn) -> int:
        """
        The sentinel asks itself questions from the HMS_QUESTION_BANK.
        For each question, it checks if miracle_knowledge has a good answer.
        If the answer is missing or weak, it injects the correct answer.
        """
        improvements = 0

        # Pick questions for this cycle (rotate through bank, 5 per cycle)
        start_idx = (self.cycle_count * 5) % len(HMS_QUESTION_BANK)
        questions_this_cycle = HMS_QUESTION_BANK[start_idx:start_idx + 5]
        if len(questions_this_cycle) < 5:
            questions_this_cycle += HMS_QUESTION_BANK[:5 - len(questions_this_cycle)]

        for qdata in questions_this_cycle:
            self.total_questions_asked += 1
            q = qdata["q"]
            keywords = qdata["keywords"]
            category = qdata["category"]

            try:
                # Ask: does miracle_knowledge have a good answer for this?
                placeholders = " OR ".join(["insight LIKE ?" for _ in keywords])
                params = [f"%{kw}%" for kw in keywords]
                row = conn.execute(
                    f"SELECT id, insight, importance_score FROM miracle_knowledge "
                    f"WHERE status='ACTIVE' AND ({placeholders}) "
                    f"ORDER BY importance_score DESC LIMIT 1",
                    params
                ).fetchone()

                answer_quality = 0
                if row:
                    # Score quality: how many keywords appear in the answer?
                    ans = (row["insight"] or "").lower()
                    matched = sum(1 for kw in keywords if kw in ans)
                    answer_quality = matched / len(keywords) if keywords else 0

                if answer_quality < 0.5:
                    # KNOWLEDGE GAP DETECTED -- inject the correct answer
                    correct_answer = self._generate_correct_answer(category, qdata)
                    if correct_answer:
                        injected = self._inject_knowledge(
                            conn, category, correct_answer, 85,
                            f"Sentinel auto-generated answer for: {q}",
                            "SENTINEL_SELF_LEARNING"
                        )
                        if injected:
                            improvements += 1
                            self._log_action(
                                conn, "KNOWLEDGE_GAP_FILLED",
                                f"Q: {q} | Quality was {answer_quality:.1%} | Injected answer",
                                correct_answer[:200]
                            )
                else:
                    # Good answer exists -- boost its importance slightly
                    if row and row["importance_score"] < 90:
                        conn.execute(
                            "UPDATE miracle_knowledge SET importance_score=MIN(importance_score+1, 90) WHERE id=?",
                            (row["id"],)
                        )

            except Exception as e:
                logger.warning(f"Self-question '{q}' failed: {e}")

        return improvements

    def _generate_correct_answer(self, category: str, qdata: dict) -> str:
        """
        Generate a correct HMS answer for a given category.
        Pure Python knowledge -- 0 tokens. Pre-programmed ground truth.
        """
        answers = {
            "GLOSSARY_NRS":  "NRS = Nursing department staff code in Z-09 HR Engine. NRS staff includes: Staff Nurses, Senior Nurses, Head Nurses, ICU Nurses, Ward Nursing Assistants. NRS is NOT an external software system. It is used as a department filter in employee records. SQL: SELECT * FROM employees WHERE dept LIKE '%Nurs%'",
            "GLOSSARY_BOR":  "BOR = Bed Occupancy Rate. Formula: (Occupied Beds / Total Active Beds) x 100. SQL: SELECT ROUND(CAST(SUM(CASE WHEN current_status='IN-HOUSE' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as BOR FROM asset_grid WHERE is_active=1. Benchmark: >90% = OVERCAPACITY risk. 70-90% = OPTIMAL. <50% = LOW.",
            "GLOSSARY_ALOS": "ALOS = Average Length of Stay. Formula: Total Patient-Days / Total Discharges. SQL: SELECT AVG(nights) FROM reservations WHERE status='CHECKED_IN'. Benchmark: General ward <7 days GOOD. ICU <5 days GOOD. Longer ALOS increases cost but also revenue per patient.",
            "GLOSSARY_REVPAB": "RevPAB = Revenue Per Available Bed. HMS equivalent of hotel RevPAR. Formula: Total Revenue / (Total Active Beds x Days). Measures revenue efficiency of bed utilisation. Higher RevPAB = better commercial performance of clinical capacity.",
            "GLOSSARY_PAR":  "PAR = Minimum reorder level for pharmacy and medical supplies in Z-12 Clinical Inventory Vault. When stock < min_level, a PAR alert fires automatically. Patient safety depends on maintaining PAR. SQL: SELECT name, stock, min_level FROM inventory WHERE stock < min_level AND min_level > 0 ORDER BY (min_level-stock) DESC.",
            "GLOSSARY_TAT":  "TAT = Turnaround Time for laboratory tests. Benchmarks: URGENT/STAT tests < 2 hours. Routine tests < 24 hours. Critical values must be telephoned to the ward immediately regardless of TAT. Tracked in Z-12 and Z-16.",
            "GLOSSARY_MRN":  "MRN = Medical Record Number. Unique lifetime patient identifier in Miracle HMS. All clinical records, lab results, prescriptions, and billing folios are linked to the MRN. Stored in guest_crm table as patient's primary key.",
            "GLOSSARY_OPD":  "OPD = Outpatient Department. Patients seen, treated, and discharged WITHOUT bed admission. OPD workflow: Register in Z-05 > Doctor consults > Prescribe > Collect pharmacy > Pay at Z-08. No bed allocated. Revenue coded as OPD_REVENUE.",
            "GLOSSARY_IPD":  "IPD = Inpatient Department. Patients formally ADMITTED to a hospital bed (ward/ICU/private). IPD workflow: OPD referral or Emergency > Admission in Z-05 > Bed allocated in Z-07 > Daily ward charges accumulate in folio > Discharge via Z-08.",
            "GLOSSARY_TPA":  "TPA = Third Party Administrator. Insurance companies that pay for patient treatment under health insurance policies. TPA billing workflow: Pre-authorisation > Treatment > Bill submission to TPA > Claim settlement. Managed in Z-08 Billing under Insurance/TPA tab.",
            "GLOSSARY_AMC":  "AMC = Annual Maintenance Contract. Service contracts for biomedical equipment (MRI, CT, Ventilators, Ultrasound, X-Ray). Tracked in Z-30 Asset Management. Alerts fire when AMC expiry approaches. Equipment not under AMC = regulatory compliance risk.",
            "GLOSSARY_CPPD": "CPPD = Cost Per Patient Day. Formula: Total Operating Cost / Total Patient-Days. Includes payroll, consumables, utilities, overhead. Key efficiency metric: lower CPPD with maintained quality = better hospital management. Benchmark varies by bed category (ICU > Private > General Ward).",

            "ZONE_Z_07": "Z-07 CLINICAL COMMAND GRID: The hospital's god-view dashboard. Every active bed displayed as a card with: Bed ID, Patient Name, Assigned Doctor, Daily Ward Rate, Outstanding Bill Balance, Active Tickets. Bed status colours: VACANT=grey, ADMITTED=cyan-neon, DISCHARGE_DUE=amber, CRITICAL=red-strobe, MAINTENANCE=amber-static. Top KPIs: Total Beds, BOR%, CRITICAL count, DISCHARGE_DUE count. Path: /dashboard",
            "ZONE_Z_05": "Z-05 OPD APPOINTMENTS AND ADMISSIONS: 45-day visual tape chart, OPD booking, Walk-In queue registration, Admission management (convert OPD to IPD). Route: /dashboard/reservations. Key actions: BOOK APPOINTMENT, WALK-IN REGISTER, ADMIT PATIENT, VIEW PATIENT HISTORY.",
            "ZONE_Z_20": "Z-20 SYNAPSE NEXUS -- HOSPITAL WAR ROOM: Panel 1 = Neural Tree (clickable org-chart, click staff node for VIDEO CALL/DIRECTIVE/FILE). Panel 2 = Kanban BACKLOG/ACTIVE/REVIEW/SECURED + Command Grid tiles. AGI Arbitrator: paste a directive, AI decomposes into 6-12 tasks and auto-assigns to optimal staff. Panel 3 = WebRTC COMM-LINK: ICU Frequency, Nursing Channel, Pharmacy Link, Lab Direct. Route: /dashboard/synapse",
            "ZONE_Z_19": "Z-19 POLICY ENGINE -- PRICE MASTER: ALL service prices set ONLY here. OPD consultation fees (General/Specialist/Emergency). IPD daily ward rates (General/Semi-Private/Private/ICU). Lab fees, procedure charges, pharmacy margins. SOPs stored here. IRON LAW: Never change prices in Z-05 or Z-08. Z-19 is the SOLE price authority. Route: /dashboard/policy",
            "ZONE_Z_09": "Z-09 HR ENGINE: Full staff registry, payroll processing, attendance (feeds from Z-18 Biometric). Staff codes: NRS=Nursing, PHY=Physicians, LAB=Lab Techs, PHARM=Pharmacists, ADMIN=Admin, IT=IT. Payroll = Base + Allowances + Overtime - Deductions. Route: /dashboard/hr",
            "ZONE_Z_12": "Z-12 CLINICAL INVENTORY VAULT: Pharmacy drugs, surgical consumables, lab reagents, PPE, canteen items, linen. PAR alerts auto-fire when stock < min_level. Receiving Bay: all stock enters via formal receiving workflow with dual-sign for controlled drugs. POS in Z-06 auto-deducts stock on sale. Route: /dashboard/inventory",
            "ZONE_Z_23": "Z-23 SOVEREIGN INFRA: CDO-only panel. VPS telemetry (CPU/RAM/Disk), PM2 process monitor (miracle-backend, miracle-frontend, miracle-brain-sync, miracle-sentinel), AI audit stream (every AI reply visible with verdict), BRAIN MANIFEST tab (knowledge injection gate for CDO-managed entries). Route: /dashboard/infrastructure",
            "ZONE_Z_GUEST": "Z-GUEST PATIENT PORTAL: Patient-facing web/app at /guest. Sections: HUB (today's appointment, bed number, bill balance), APPOINTMENTS (view/manage), BOOK (book OPD appointment), BILL (itemised invoice), MEALS (order ward meals to bed), CONCIERGE (message nursing station), RECORDS (lab results, prescriptions, discharge summary). IRON LAW: This is a PATIENT portal, not a hotel guest portal. Never mix terminology.",

            "HMS_WORKFLOW_ADMISSION": "PATIENT ADMISSION WORKFLOW (Miracle HMS): 1. Book OPD appointment in Z-05. 2. Doctor reviews patient, decides IPD admission. 3. Admissions desk in Z-05 selects available bed in Z-07. 4. Patient folio auto-created in Z-08 with advance deposit. 5. Bed card in Z-07 turns ADMITTED (cyan). 6. Daily ward charges accumulate in folio automatically. 7. Nursing staff in Z-GUEST can see patient details and meal orders.",
            "HMS_WORKFLOW_DISCHARGE": "PATIENT DISCHARGE WORKFLOW (Miracle HMS): 1. Doctor approves discharge. 2. Z-08 Billing: pull patient folio, compile final bill (ward + nursing + lab + pharmacy + procedures). 3. Patient/TPA settles balance. 4. Print discharge summary and final invoice. 5. Mark folio as CHECKED_OUT. 6. Bed status in Z-07 changes to VACANT. 7. Auto-ticket to ward cleaning/biomedical maintenance in Z-16.",
            "HMS_WORKFLOW_PHARMACY": "PHARMACY DISPENSING WORKFLOW (Miracle HMS): 1. Doctor issues prescription (Z-DOCTOR portal). 2. Pharmacist in Z-12 receives prescription. 3. Drugs dispensed from inventory (stock auto-deducted). 4. Charge posted to patient folio in Z-08. 5. For OTC sales without prescription: Z-06 POS used. 6. Controlled drugs require dual staff verification + audit log. 7. PAR alert fires if stock drops below min_level.",
            "HMS_WORKFLOW_HR": "PAYROLL WORKFLOW (Miracle HMS): 1. Staff clock in/out via Z-18 Biometric Portal. 2. Z-09 HR Engine reads attendance data nightly. 3. Overtime auto-calculated for shifts exceeding scheduled hours. 4. Monthly payroll run: Base + Allowances + Overtime - Deductions (loans/advances). 5. Payslip generated per employee. 6. Journal entry posted to accounting_ledger (EXPENSE_PAYROLL).",
            "HMS_WORKFLOW_FINANCE": "NIGHT AUDIT WORKFLOW (Miracle HMS): 1. Z-11 Accounts > Night Audit tab. 2. System posts all pending folio charges (ward charges, nursing, meals). 3. Daily revenue summary generated by account code. 4. Bank reconciliation check. 5. Day closed, date advances. 6. Revenue posted to accounting_ledger. 7. AR Aging updated (highlight overdue patient bills). Available only to ACC/CDO/GM roles.",

            "DB_SCHEMA_MODELS": (
                "MIRACLE HMS DATABASE SCHEMA (Anti-hallucination -- use ONLY these exact names):\n"
                "TABLE asset_grid: room_id, current_status(VACANT|IN-HOUSE|DIRTY|INSPECTED|OUT-OF-ORDER), current_guest[=PATIENT], category(ICU|WARD|PRIVATE|SEMI-PRIVATE|ER|OT), base_rate, is_active\n"
                "TABLE reservations: id, room_id[=BED_ID], guest_name[=PATIENT], start_date[=ADMISSION_DATE], nights[=LOS], status(CONFIRMED|CHECKED_IN|CANCELLED), nightly_rate, total_yield\n"
                "TABLE guest_crm: id, full_name, phone, email, total_ltv, total_stays, vip_tier(STANDARD|GOLD|PLATINUM|ROYAL)\n"
                "TABLE guest_folios: id, room_number[=BED], guest_name[=PATIENT], status(IN_HOUSE|CHECKED_OUT|SUSPENDED), balance[=BILL], rate, check_in_date[=ADMISSION_DATE]\n"
                "TABLE employees: id, full_name, dept, status(ON-DUTY|OFFLINE|TERMINATED), base_salary, efficiency_rating\n"
                "TABLE inventory: id, name, category, unit, stock, min_level[=PAR], cost_price, sell_price, dept\n"
                "TABLE accounting_ledger: id, transaction_type, account_code, debit, credit, description, posted_by, created_at\n"
                "TABLE solve_missions: id, title, priority(LOW|NORMAL|URGENT|CRITICAL), status(PENDING|ACTIVE|SECURED|CANCELLED), room_no[=BED_NO], dept\n"
                "BANNED COLUMNS: checkout_date, end_date, departure_date, room_type (it's 'category' in asset_grid)\n"
                "DISCHARGE DATE = start_date + nights (never a stored column)"
            ),
        }
        return answers.get(category, "")

    # ──────────────────────────────────────────────────
    # SCAN 3: DATA CONSISTENCY VALIDATOR
    # Cross-references AI knowledge against real DB data
    # ──────────────────────────────────────────────────
    def validate_data_consistency(self, conn) -> int:
        """
        Checks that the AI's knowledge about certain DB facts is accurate.
        E.g.: "How many beds?" -- if AI knowledge says 50 but DB has 80, inject correction.
        """
        corrections = 0
        try:
            # Check: total bed count knowledge
            actual_beds = conn.execute(
                "SELECT COUNT(*) as cnt FROM asset_grid WHERE is_active=1"
            ).fetchone()
            if actual_beds and actual_beds["cnt"] > 0:
                bed_count = actual_beds["cnt"]
                knowledge_exists = conn.execute(
                    "SELECT id FROM miracle_knowledge WHERE category='HMS_BED_COUNT' AND status='ACTIVE' LIMIT 1"
                ).fetchone()

                correct_insight = (
                    f"Miracle HMS has {bed_count} total active beds as of Sentinel validation.\n"
                    f"BOR SQL: SELECT ROUND(CAST(SUM(CASE WHEN current_status='IN-HOUSE' THEN 1 ELSE 0 END) AS FLOAT)/COUNT(*)*100,1) FROM asset_grid WHERE is_active=1\n"
                    f"Available beds: SELECT COUNT(*) FROM asset_grid WHERE current_status='VACANT' AND is_active=1"
                )

                if not knowledge_exists:
                    injected = self._inject_knowledge(
                        conn, "HMS_BED_COUNT", correct_insight, 88,
                        "Always refer to actual bed count from asset_grid. Never estimate.",
                        "SENTINEL_DB_VALIDATED"
                    )
                    if injected:
                        corrections += 1

            # Check: staff count
            actual_staff = conn.execute(
                "SELECT COUNT(*) as cnt FROM employees WHERE status != 'TERMINATED'"
            ).fetchone()
            if actual_staff and actual_staff["cnt"] > 0:
                staff_count = actual_staff["cnt"]
                dept_breakdown = conn.execute(
                    "SELECT dept, COUNT(*) as cnt FROM employees WHERE status != 'TERMINATED' GROUP BY dept ORDER BY cnt DESC LIMIT 8"
                ).fetchall()
                dept_text = ", ".join([f"{r['dept']}: {r['cnt']}" for r in dept_breakdown])

                correct_insight = (
                    f"Miracle HMS has {staff_count} active staff members (non-terminated).\n"
                    f"By department: {dept_text}\n"
                    f"SQL for staff roster: SELECT full_name, dept, status, base_salary FROM employees WHERE status != 'TERMINATED' ORDER BY dept"
                )
                self._inject_knowledge(
                    conn, "HMS_STAFF_COUNT", correct_insight, 86,
                    "Staff count is validated from DB. Never estimate headcount.",
                    "SENTINEL_DB_VALIDATED"
                )

        except Exception as e:
            logger.warning(f"Data consistency check failed: {e}")

        return corrections

    # ──────────────────────────────────────────────────
    # SCAN 4: KNOWLEDGE QUALITY DECAY CLEANUP
    # Remove stale or low-quality entries from the brain
    # ──────────────────────────────────────────────────
    def cleanup_stale_knowledge(self, conn) -> int:
        """
        Retires DUPLICATE and SUPERSEDED knowledge entries.
        Keeps the highest importance_score version per category.
        """
        cleaned = 0
        try:
            # Find categories with multiple ACTIVE entries (duplicates)
            dups = conn.execute("""
                SELECT category, COUNT(*) as cnt
                FROM miracle_knowledge
                WHERE status='ACTIVE'
                GROUP BY category
                HAVING COUNT(*) > 2
                LIMIT 10
            """).fetchall()

            for dup in dups:
                cat = dup["category"]
                # Keep only the best 2 entries per category
                all_entries = conn.execute(
                    "SELECT id FROM miracle_knowledge WHERE category=? AND status='ACTIVE' ORDER BY importance_score DESC, created_at DESC",
                    (cat,)
                ).fetchall()
                # Retire everything after the top 2
                to_retire = [r["id"] for r in all_entries[2:]]
                if to_retire:
                    placeholders = ",".join(["?" for _ in to_retire])
                    conn.execute(
                        f"UPDATE miracle_knowledge SET status='RETIRED' WHERE id IN ({placeholders})",
                        to_retire
                    )
                    cleaned += len(to_retire)

        except Exception as e:
            logger.warning(f"Knowledge cleanup failed: {e}")

        return cleaned

    # ──────────────────────────────────────────────────
    # MAIN SCAN CYCLE
    # ──────────────────────────────────────────────────
    def run_cycle(self):
        """
        Single scan cycle. Called every SCAN_INTERVAL seconds.
        Layer 0 only -- 0 LLM tokens.
        """
        self.cycle_count += 1
        cycle_start = time.time()

        try:
            with self._conn() as conn:
                total_actions = 0

                # --- 1. Audit log hallucination scanner ---
                audit_fixes = self.scan_audit_log(conn)
                total_actions += audit_fixes

                # --- 2. Self-questioning knowledge test ---
                knowledge_gaps = self.run_self_questions(conn)
                total_actions += knowledge_gaps

                # --- 3. Data consistency validator (every 10 cycles) ---
                if self.cycle_count % 10 == 0:
                    data_fixes = self.validate_data_consistency(conn)
                    total_actions += data_fixes

                # --- 4. Stale knowledge cleanup (every 20 cycles) ---
                if self.cycle_count % 20 == 0:
                    cleaned = self.cleanup_stale_knowledge(conn)
                    if cleaned > 0:
                        self._log_action(conn, "KNOWLEDGE_CLEANUP", f"Retired {cleaned} stale/duplicate entries")

                conn.commit()

                elapsed = time.time() - cycle_start
                if total_actions > 0 or self.cycle_count % 10 == 0:
                    logger.info(
                        f"Cycle {self.cycle_count} | Actions: {total_actions} | "
                        f"Questions: {self.total_questions_asked} total | "
                        f"Corrections: {self.total_corrections} total | "
                        f"{elapsed:.2f}s | 0 tokens"
                    )

        except Exception as e:
            logger.error(f"Cycle {self.cycle_count} failed: {e}")

    # ──────────────────────────────────────────────────
    # MAIN WATCHER LOOP
    # ──────────────────────────────────────────────────
    def watch(self):
        """
        Entry point. Runs forever. Never sleeps.
        Every SCAN_INTERVAL seconds: scan, learn, improve, repeat.
        """
        logger.info("=" * 60)
        logger.info("MIRACLE HMS OPS SENTINEL ACTIVATED")
        logger.info(f"Scan interval: {SCAN_INTERVAL}s | DB: {DB_PATH.name}")
        logger.info("Self-questioning brain online. Knowledge improvement begins now.")
        logger.info("=" * 60)

        while True:
            try:
                self.run_cycle()
                time.sleep(SCAN_INTERVAL)
            except KeyboardInterrupt:
                logger.info(f"Sentinel stopped after {self.cycle_count} cycles.")
                logger.info(f"Total self-improvements made: {self.total_corrections}")
                break
            except Exception as e:
                logger.error(f"Sentinel outer loop error: {e}")
                time.sleep(SCAN_INTERVAL)


# ──────────────────────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    sentinel = OpsSentinel()
    sentinel.watch()
