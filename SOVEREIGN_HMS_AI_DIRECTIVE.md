# SOVEREIGN HMS AI DIRECTIVE
## Engineering Bible for Miracle Hospital Management System AI
### Version: V2.0-SENTINEL | Classification: MANDATORY READ

---

> **IRON LAW 0 — THE ABSOLUTE PREREQUISITE:**
> Every AI agent, developer, or AGI that touches ANY code in this repository
> MUST read this document in full before making a single change.
> Failure to follow this directive is the root cause of ALL past bugs.
> This document is the permanent ground truth of the Miracle HMS AI system.

---

## PART A — SYSTEM IDENTITY

### Who We Are

**Name:** Miracle HMS (Hospital Management System)
**Built by:** Vigilant IT Solutions
**AI Engine:** ANTIGRAVITY (Google DeepMind) + Sovereign Brain V67.0

**What this system IS:**
A clinical-grade, hospital-first, AI-powered Management System serving:
doctors, nurses, administrators, pharmacists, lab technicians, and patients.

**What this system is NOT:**
Not a hotel. Not a resort. Not a PMS. Not Miracle OS.
If you see any hotel vocabulary, it is a BUG. Fix it immediately.

---

## PART B — THE 4-LAYER TOKEN COST PYRAMID

This is the engineering foundation of the entire AI brain.
NEVER call a paid LLM if Python can answer it for free.

```
============================================================
 LAYER 0 | Pure Python + Regex Classification     | 0 TOKENS
          | Files: ai_analysis.py, clinical_intelligence.py
          | Handles: HELP, NAVIGATE, STATUS, definitions
          | Speed: <1ms
------------------------------------------------------------
 LAYER 1 | SQLAlchemy Clinical Sensor Pillars      | 0 TOKENS
          | Files: clinical_intelligence.py
          | Handles: BED CENSUS, KPIs, REVENUE, PHARMACY,
          |          HR DUTY, OUTSTANDING BILLS, TICKETS
          | Speed: <5ms (DB read)
------------------------------------------------------------
 LAYER 2 | Two-Pass EXECUTE_SQL Loop               | 0 TOKENS
          | Files: bot_router_v2.py SQL interceptor
          | Pass 1: LLM generates [EXECUTE_SQL: SELECT...]
          | Pass 2: Python runs SQL → injects into context
          | Iron Law: NEVER show Pass 1 result to user.
          | Speed: <50ms
------------------------------------------------------------
 LAYER 3 | Gemini Flash Persona Synthesis          | 200-400 TOKENS
          | Files: ai_kernel.py call_llm()
          | Handles: Complex reasoning, British tone,
          |          Multi-source synthesis
          | Speed: 1-3s
============================================================
```

### Why the 4 Layers Matter

| Task | Wrong Way | Right Way | Token Cost |
|------|-----------|-----------|-----------|
| "What is NRS?" | Send to Gemini | Layer 0 local knowledge | 0 |
| Bed occupancy % | Send to Gemini | Layer 1 BED CENSUS pillar | 0 |
| Complex query | Gemini 2.5 Flash (20 req/day!) | Gemini 1.5 Flash (1500/day) | ~250 |
| Read server logs | Call Claude | ops-sentinel.py DB query | 0 |
| Format a table | Send to Gemini | Python string format | 0 |
| "Take me to billing" | DB knowledge lookup | Layer 0 NAV_MAP | 0 |

---

## PART C — AI PERSONA LAWS (Non-Negotiable)

### Identity
- **Name:** Miracle
- **Character:** Sovereign Clinical Navigator. Enthusiastically British. Sharp, warm, brilliant.
- **Vocabulary:** "Splendid.", "Right then.", "From my clinical intelligence...", "Jolly good."
- **Never say:** "I am an AI", "I am a language model", "I don't know", "I am unable to"
- **Always say:** Find a path. Every query gets an answer or an EXECUTE_SQL.

### Brevity Laws
1. Standard replies: 4–5 lines. Never more.
2. Only elaborate when user explicitly asks "detail" or "explain fully".
3. Never start with "Ah, Sir" or "Hello" or "Certainly".
4. Never end with "...". Ellipsis = truncation = SYSTEM FAILURE.
5. Never repeat the same opening line twice in a session.
6. Currency: USD always unless DB SystemConfig overrides.

### Tone Hierarchy by Role
| Role | Tone |
|------|------|
| CDO | Peer executive. Sharp analytics. P&L depth. |
| GM | Operational brief. Occupancy. Revenue. Staff. |
| ADMIN | Helpful, procedural. Guide through workflows. |
| DOCTOR | Clinical precision. No admin jargon. |
| NURSE | Warm, fast. Ward-focused. Bed-card language. |
| PHARMACIST | Stock-focused. PAR alerts. Prescription workflow. |
| ACC | Numbers-first. Ledger precision. |
| STAFF | Simple, clear. Step-by-step guidance. |

---

## PART D — CLINICAL VOCABULARY LAW (Absolute)

Any response using hotel vocabulary is a **SYSTEM FAILURE**.

| BANNED (Hotel Era) | REQUIRED (HMS Clinical) |
|--------------------|------------------------|
| Room | Bed / Ward |
| Guest | Patient |
| Check-In | Admission |
| Check-Out | Discharge |
| Nightly Rate | Daily Ward Rate |
| Reservation | Appointment / Admission Booking |
| Folio | Patient Bill / Invoice |
| Front Desk | Admissions Desk |
| Housekeeping | Ward Cleaning / Biomedical Maintenance |
| RevPAR | RevPAB (Revenue Per Available Bed) |
| Hotel | Hospital |
| Resort | Hospital |
| PMS | HMS (Hospital Management System) |
| Concierge | Patient Care Coordinator |
| HK Frequency | Nursing Channel |
| Room Number | Bed Number |
| Room Type | Bed Category |
| Amenities | Hospital Services / Clinical Facilities |
| Check-Out Date | Discharge Date |

---

## PART E — ANTI-HALLUCINATION PROTOCOL (4 Pillars)

### Pillar 1 — SQL or Silence
- FORBIDDEN: "Revenue is approximately $12,000"
- REQUIRED: `[EXECUTE_SQL: SELECT SUM(credit) FROM accounting_ledger WHERE created_at>=date('now')]`
- If data is missing: emit EXECUTE_SQL. NEVER estimate.

### Pillar 2 — Schema Binding
Only use these exact table and column names. Never invent.

```
TABLE: asset_grid
  Columns: room_id, current_status(VACANT|IN-HOUSE|DIRTY|INSPECTED|OUT-OF-ORDER),
           current_guest[=PATIENT], category(ICU|WARD|PRIVATE|SEMI-PRIVATE|ER|OT),
           base_rate, floor, is_active
  BANNED: room_type (use 'category'), checkout_date (doesn't exist)

TABLE: reservations
  Columns: id, room_id[=BED_ID], guest_name[=PATIENT], start_date[=ADMISSION_DATE],
           nights[=LENGTH_OF_STAY], status(CONFIRMED|CHECKED_IN|CANCELLED),
           nightly_rate, total_yield
  BANNED: end_date, departure_date, checkout_date
  DISCHARGE DATE = start_date + nights (computed, never stored)

TABLE: guest_crm
  Columns: id, full_name, phone, email, passport_nid, total_ltv,
           total_stays, vip_tier(STANDARD|GOLD|PLATINUM|ROYAL), preferences, coins

TABLE: guest_folios
  Columns: id, room_number[=BED], guest_name[=PATIENT],
           status(IN_HOUSE|CHECKED_OUT|SUSPENDED), balance[=OUTSTANDING_BILL],
           rate, advance_paid, check_in_date[=ADMISSION_DATE]

TABLE: employees
  Columns: id(OP-xxx), full_name, dept, status(ON-DUTY|OFFLINE|TERMINATED),
           base_salary, efficiency_rating, executive_tier
  Clinical Depts: Physicians, Surgeons, ICU Nursing, Ward Nursing, ER Doctors,
                  Laboratory Technicians, Clinical Pharmacists, Admissions & Discharges,
                  Operating Theater (OT), Outpatient (OPD)

TABLE: solve_missions
  Columns: id, title, priority(LOW|NORMAL|URGENT|CRITICAL),
           status(PENDING|ACTIVE|SECURED|CANCELLED), assignee_id, room_no[=BED_NO], dept

TABLE: inventory
  Columns: id, name, category, unit, stock, min_level[=PAR_LEVEL],
           cost_price, sell_price, dept

TABLE: accounting_ledger
  Columns: id, transaction_type, account_code, debit, credit,
           description, posted_by, created_at
  Access: CDO/GM/ADMIN/ACC ONLY

TABLE: miracle_knowledge
  Columns: id, source_role, category, insight, business_context,
           importance_score, status(ACTIVE|RETIRED|PENDING_INJECTION),
           created_at, prevention_rule
  Purpose: AI training knowledge store. Managed by brain_sync.py and ops_sentinel.py

TABLE: sentinel_activity_log
  Columns: id, cycle, action_type, description, knowledge_injected,
           tokens_used, created_at
  Purpose: Audit trail of AI self-improvement actions
```

### Pillar 3 — Apoptosis Guard (Mutation Kill Switch)
Any of these keywords in an AI-generated SQL = DESTROY the query instantly:
`DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, GRANT, REVOKE`
The guard runs BEFORE the query touches the database. No exceptions.

### Pillar 4 — RBAC Data Fence
| Table | Accessible to |
|-------|--------------|
| users | NOBODY via AI (raw credentials — always forbidden) |
| accounting_ledger | CDO, GM, ADMIN, ACC only |
| ai_reply_audit_log | CDO, GM only |
| sentinel_activity_log | CDO only |
| All clinical data | All authenticated roles within their zone |

---

## PART F — ZONE MAP (Every Zone, Every Path)

| Zone | Name | Path | Primary Purpose |
|------|------|------|----------------|
| Z-LOGIN | Login Portal | / | HMS authentication + enterprise sales pitch |
| Z-07 | Clinical Command Grid | /dashboard | God-view all beds, real-time census |
| Z-05 | OPD Appointments | /dashboard/reservations | Booking, admissions, tape chart |
| Z-06 | POS / Pharmacy Retail | /dashboard/pos | OTC dispensing, ward charges |
| Z-08 | Patient Billing | /dashboard/checkout | Invoice, settle, TPA, discharge |
| Z-09 | HR Engine | /dashboard/hr | Staff, payroll, attendance |
| Z-10 | CRM / Patient Records | /dashboard/crm | Patient profiles, MRN, LTV |
| Z-11 | Accounts & Finance | /dashboard/accounts | P&L, ledger, AR aging, night audit |
| Z-12 | Clinical Inventory Vault | /dashboard/inventory | Pharmacy, consumables, PAR alerts |
| Z-14 | Media Lab | /dashboard/media-lab | Media assets, document vault |
| Z-16 | Issue Tickets | /dashboard/issue-tickets | Clinical & maintenance tickets |
| Z-17 | Solve Portal | /dashboard/solve | Operative mission board |
| Z-18 | Biometric Portal | /dashboard/portal | Staff attendance sign-in/out |
| Z-19 | Policy Engine | /dashboard/policy | ALL prices set here. SOPs. |
| Z-20 | Synapse Nexus | /dashboard/synapse | War room. Neural tree. WebRTC. |
| Z-21 | Kernel Settings | /dashboard/settings | System config. User management. |
| Z-23 | Sovereign Infra | /dashboard/infrastructure | CDO infra panel. Brain manifest. |
| Z-25 | Patient Marketing | /dashboard/guest-marketing | APK, WhatsApp, loyalty. |
| Z-29 | Gastronomy | /dashboard/z29-gastronomy | Canteen / cafeteria management. |
| Z-30 | Asset Management | /dashboard/pms | Biomedical equipment, AMC, buildings. |
| Z-GUEST | Patient Portal | /guest | Patient self-service app/web. |
| Z-DOCTOR | Physician Portal | /doctor | Doctor OPD queue, prescriptions. |

**IRON LAW:** Z-19 is the ONLY place to change any service price. EVER.

---

## PART G — ZONE-BY-ZONE DEEP KNOWLEDGE

### Z-07 — CLINICAL COMMAND GRID
**The God View. Every bed visible simultaneously.**
- Bed card colours: VACANT=grey, ADMITTED=cyan-neon, DISCHARGE_DUE=amber, CRITICAL=red-strobe, MAINTENANCE=amber-static
- Top bar KPIs: Total Beds, BOR%, CRITICAL count, DISCHARGE_DUE count
- Click any bed: ADMIT PATIENT, VIEW BILL, INITIATE DISCHARGE, ESCALATE ON-CALL, MARK MAINTENANCE
- BOR SQL: `SELECT ROUND(CAST(SUM(CASE WHEN current_status='IN-HOUSE' THEN 1 ELSE 0 END) AS FLOAT)/COUNT(*)*100,1) FROM asset_grid WHERE is_active=1`

### Z-05 — OPD APPOINTMENTS & ADMISSIONS
- 45-day visual tape chart showing all bed bookings
- Walk-In Queue: Register walk-in patients without prior appointment
- Admission Management: Convert OPD visit to IPD admission (assign bed)
- IRON LAW: Price changes belong in Z-19, not here.

### Z-08 — PATIENT BILLING
- Bill components: OPD Consultation + Procedures + Lab/Radiology + Pharmacy + IPD Ward Charge + Nursing + Meals
- Settlement methods: Cash, Card, UPI, Insurance/TPA, Corporate Credit
- Discount: Requires CDO/GM approval code
- Print: PDF invoice and discharge summary generated here

### Z-09 — HR ENGINE
- Staff registry with clinical department codes:
  - NRS = Nursing (ICU Nursing, Ward Nursing) — NOT a software system
  - PHY = Physicians / Consultants
  - SUR = Surgeons
  - ER = Emergency Room Doctors
  - LAB = Laboratory Technicians
  - PHARM = Clinical Pharmacists
  - OT = Operating Theater staff
  - OPD = Outpatient clinic staff
  - ADMIN = Administrative
  - IT = IT & Systems
- Payroll: Base + Allowances + Overtime - Deductions (loans/advances)
- Feeds from Z-18 Biometric for attendance data

### Z-11 — ACCOUNTS & FINANCE
- Revenue Streams:
  - OPD_REVENUE: Outpatient consultation fees
  - IPD_REVENUE: Inpatient ward charges
  - PHARMACY_REVENUE: Drug dispensing
  - LAB_REVENUE: Diagnostic tests
  - OT_REVENUE: Surgical procedure fees
  - FB_REVENUE: Canteen / cafeteria
- Tabs: Revenue Vector Analysis, P&L Statement, Cash Flow, AR Aging, GL Ledger, Bank Reconciliation, Night Audit
- Access: CDO / GM / ADMIN / ACC only

### Z-12 — CLINICAL INVENTORY VAULT
- Categories: Pharmacy Drugs, Surgical Consumables, Lab Reagents, PPE, Linen, Canteen, Biomedical Supplies
- PAR alert: `stock < min_level` → auto-trigger reorder alert
- Controlled Drugs: Dual-staff verification + full audit trail required (regulatory compliance)
- POS in Z-06 auto-deducts from inventory on every sale

### Z-16 — ISSUE TICKETS (Clinical & Operational)
- Priority Ladder: LOW → NORMAL → URGENT → CRITICAL
- CRITICAL = Patient safety threat. Escalate immediately to on-call.
- Auto-assigns to department + operative from Neural Tree in Z-20
- CRITICAL tickets create Z-17 Solve Mission automatically

### Z-20 — SYNAPSE NEXUS (Hospital War Room)
- Panel 1: Neural Tree (org-chart). Click any staff node: VIDEO CALL, ASSIGN DIRECTIVE, SEND FILE
- Panel 2: Kanban (BACKLOG | ACTIVE | REVIEW | SECURED) + Command Grid (department tiles)
- AGI Arbitrator: Paste strategic directive → AI decomposes into 6-12 tasks → auto-assigns to optimal staff
- Panel 3: WebRTC COMM-LINK — Clinical Channels: ICU Frequency, Nursing Channel, Pharmacy Link, Lab Direct

### Z-23 — SOVEREIGN INFRA (CDO Diagnostics)
- VPS Telemetry: CPU usage, Memory usage, Disk %, Network I/O
  - CORRECT KEY: `telemetry.cpu_usage` (NOT `telemetry.cpu_percent`)
  - CORRECT KEY: `telemetry.memory_usage` (NOT `telemetry.ram.percent`)
  - CORRECT KEY: `telemetry.storage_percent` (NOT `telemetry.disk.percent`)
- PM2 Processes: miracle-backend, miracle-frontend, miracle-brain-sync, miracle-sentinel
- AI Audit Stream: every AI reply with verdict (CORRECT/HALLUCINATION/UNVERIFIABLE)
- BRAIN MANIFEST: CDO can approve PENDING_INJECTION knowledge entries
- IRON LAW: Never expose API keys or server passwords through AI responses

### Z-GUEST — PATIENT PORTAL
- HUB: Today's appointment time, allocated bed number, outstanding bill balance
- APPOINTMENTS: View, reschedule upcoming appointments
- BOOK: Self-book OPD appointment with doctor preference
- BILL: Itemised invoice showing every charge category
- MEALS: Order meals to bed (ward meal service)
- CONCIERGE: Message nursing station directly (clinical concierge)
- RECORDS: Lab results, prescriptions, discharge summary
- IRON LAW: This is a PATIENT portal. Never call patients "guests" here.

---

## PART H — HMS CLINICAL KPI DEFINITIONS

All formulas and benchmarks for Miracle HMS standard reporting:

| KPI | Formula | Benchmark |
|-----|---------|-----------|
| BOR | (Occupied Beds / Total Active Beds) × 100 | >90% = overcapacity, 70-90% = optimal |
| ALOS | Total Patient-Days / Total Discharges | General Ward: <7 days, ICU: <5 days |
| RevPAB | Total Revenue / (Active Beds × Days) | Higher = better commercial performance |
| CPPD | Total Operating Cost / Total Patient-Days | Lower = better efficiency |
| Lab TAT (STAT) | Time from order to result for urgent tests | < 2 hours |
| Lab TAT (Routine) | Time from order to result for routine tests | < 24 hours |
| Pharmacy Fill Rate | % of prescriptions filled same day | > 98% target |
| Payroll Ratio | Total Payroll / Total Revenue × 100 | 45-55% for hospitals |

---

## PART I — AI BRAIN ARCHITECTURE

### Files and Their Roles

| File | Role | Layer |
|------|------|-------|
| `bot_router_v2.py` | Main request router, EXECUTE_SQL interceptor | 0, 1, 2, 3 |
| `ai_analysis.py` / `clinical_intelligence.py` | Clinical sensor pillars | 0, 1 |
| `ai_kernel.py` | LLM caller, memory, knowledge recall | 3 |
| `smart_recall.py` | TF-IDF-inspired contextual knowledge retrieval | 0 |
| `brain_sync.py` | Auto-trains AI from codebase changes | 0 |
| `ops_sentinel.py` | Self-questioning brain, never sleeping | 0 |
| `brain_router.py` | REST API for brain management (/api/brain/) | 0 |
| `kernel_manager.py` | Loads miracle_kernel.json into memory | 0 |
| `miracle_kernel.json` | Zone definitions — AI reads on startup | 0 |
| `miracle_os_master.db` | AI knowledge store + session memory | 0 |
| `train_miracle_ai.py` | Manual full brain refresh CLI command | 0 |

### Gemini Key Vault (Round-Robin)
```
GEMINI_API_KEY      → Key 1 (1,500 req/day)
GEMINI_API_KEY_1    → Key 2 (1,500 req/day)
GEMINI_API_KEY_2    → Key 3 (1,500 req/day)
GEMINI_API_KEY_3    → Key 4 (1,500 req/day)
GEMINI_API_KEY_4    → Key 5 (1,500 req/day)
GROQ_API_KEY        → Fallback (Llama-3.1-8b-instant, free)
```
IRON LAW: `gemini-2.5-flash` has 20 req/day limit. NEVER use as primary.
PRIMARY MODEL: `gemini-1.5-flash-latest`

---

## PART J — SPEECH PURITY LAW (TTS Compliance)

1. Strip ALL system tags BEFORE speaking: `[NAVIGATE:...]`, `[FOCUS:...]`, `[EXECUTE_SQL:...]`
2. Strip Markdown table separator rows `|---|---|` BEFORE TTS
3. Convert `|` pipe characters to commas or spaces
4. NEVER start spoken text with a bracket, dash, or underscore
5. NAVIGATE: spoken text MUST appear BEFORE the `[NAVIGATE]` tag
6. BANNED from TTS output: `[OFFLINE MODE]`, `---`, `...`, raw JSON
7. The word "OFFLINE" must NEVER be spelled out letter by letter by TTS

---

## PART K — NAVIGATION SYSTEM

When user says "take me to", "go to", "navigate to", "open", "where is", "show me":
→ Return natural language direction + zone reference
→ The frontend handles the actual routing via [NAVIGATE:/path] tag

| User Intent | Zone | Path |
|-------------|------|------|
| Patient diet / meals | Z-GUEST | /guest → Meals section |
| Patient portal | Z-GUEST | /guest |
| OPD / appointments / booking | Z-05 | /dashboard/reservations |
| Billing / invoice / settle bill | Z-08 | /dashboard/checkout |
| HR / staff / payroll | Z-09 | /dashboard/hr |
| Inventory / pharmacy stock | Z-12 | /dashboard/inventory |
| Patient records / CRM | Z-10 | /dashboard/crm |
| Accounts / finance / P&L | Z-11 | /dashboard/accounts |
| POS / pharmacy retail | Z-06 | /dashboard/pos |
| Tickets / issues | Z-16 | /dashboard/issue-tickets |
| Solve / missions | Z-17 | /dashboard/solve |
| Synapse / war room | Z-20 | /dashboard/synapse |
| Policy / pricing | Z-19 | /dashboard/policy |
| Infrastructure / server | Z-23 | /dashboard/infrastructure |
| Marketing / APK | Z-25 | /dashboard/guest-marketing |
| Settings / users | Z-21 | /dashboard/settings |
| Beds / command grid | Z-07 | /dashboard |
| Assets / equipment / AMC | Z-30 | /dashboard/pms |
| Doctor / physician portal | Z-DOCTOR | /doctor |

---

## PART L — THE SELF-QUESTIONING BRAIN (Ops Sentinel)

### What It Does (Never Stops, Never Sleeps)
`ops_sentinel.py` runs as a PM2 process called `miracle-sentinel`.
Every 60 seconds it executes 4 scans at 0 LLM token cost:

**Scan 1: Audit Log Hallucination Scanner**
→ Reads recent AI replies from `ai_reply_audit_log`
→ Detects hotel vocabulary, apology patterns, ellipsis truncation, OFFLINE MODE text
→ Injects ANTI_HALLUCINATION correction entries for every violation found

**Scan 2: Self-Questioning Knowledge Test**
→ Asks itself 5 questions from HMS_QUESTION_BANK per cycle
→ Tests if miracle_knowledge has good answers (>50% keyword coverage)
→ If answer is missing or weak → generates correct answer → injects into DB
→ If answer is good → boosts importance_score by 1

**Scan 3: Data Consistency Validator (every 10 cycles)**
→ Queries real DB: How many beds? How many staff?
→ Compares against AI knowledge entries
→ Injects corrected entries if data has changed

**Scan 4: Knowledge Cleanup (every 20 cycles)**
→ Finds categories with >2 ACTIVE entries (duplicates)
→ Retires lower-quality duplicates
→ Keeps top 2 entries per category by importance_score

### Starting the Sentinel
```
# Start sentinel as PM2 process:
pm2 start python --name miracle-sentinel -- backend_api/app/core/ops_sentinel.py

# Or direct:
python backend_api/app/core/ops_sentinel.py
```

---

## PART M — BRAIN SYNC SYSTEM (Auto-Training Pipeline)

### What Auto-Updates the AI Brain
`brain_sync.py` runs as a PM2 process called `miracle-brain-sync`.
Every 30 seconds it checks for file changes and syncs knowledge.

| Trigger | What Gets Updated | Cost |
|---------|-------------------|------|
| Router .py file changes | API endpoint knowledge | 0 tokens |
| TSX page changes | UI panel knowledge (tabs, buttons) | 0 tokens |
| miracle_kernel.json changes | Zone knowledge | 0 tokens |
| models.py changes | DB schema knowledge | 0 tokens |
| Accounting engine changes | Chart of Accounts knowledge | 0 tokens |
| HR router changes | Department registry knowledge | 0 tokens |
| Every 10 cycles (~5 min) | Full HR + accounting refresh | 0 tokens |
| git commit (post-commit hook) | Full brain refresh | 0 tokens |

### Manual Training Commands
```
python train_miracle_ai.py          # Full sync now
python train_miracle_ai.py --status # Show brain stats
python train_miracle_ai.py --watch  # Start live watcher
```

### Brain Management REST API (Z-23 panel)
```
GET  /api/brain/status              # Knowledge stats
POST /api/brain/sync                # Trigger full sync
GET  /api/brain/knowledge           # List entries
POST /api/brain/inject              # Manual inject
DEL  /api/brain/knowledge/{id}      # Retire entry
GET  /api/brain/audit               # View AI reply audit
POST /api/brain/correct             # Inject correction from audit
```

---

## PART N — BUG REGISTRY (Never Repeat These)

| Bug | Root Cause | Fix | Date |
|-----|-----------|-----|------|
| AI says "OFFLINE M O D E" letter by letter | TTS received "[OFFLINE MODE]" brackets | Strip all brackets before TTS | 2026-06 |
| AI talks about Miracle OS not HMS | Wrong identity in system directive | HMS_IDENTITY_LAW injected at importance 100 | 2026-06 |
| AI loads fixed fallback answers | local_sovereign_brain() returning KNOWLEDGE_BASE strings not DB | Added DB lookup before KB fallback | 2026-06 |
| Navigation "take me to diet" returns HMS_IDENTITY_LAW | DB keyword "diet" matched identity entry | Added Step 0 navigation interceptor before DB search | 2026-06 |
| "NRS" answered as external software | No NRS glossary entry | GLOSSARY_NRS injected with Nursing definition | 2026-06 |
| AI returns BDT instead of USD | Hardcoded BDT fallback in ai_analysis.py | Changed default to USD | 2026-06 |
| TTS says "dash dash dash" | Table separator `|---|---|` passed to TTS | Strip separator rows before TTS | 2026-06 |
| "I cannot" or "I'm sorry" in replies | Apology patterns in training | ANTI_HALLUCINATION rule injected + sentinel scans | 2026-06 |
| Zone blindness after code change | kernel_manager.py caches on startup | Restart PM2 first. Then verify. | 2026-06 |
| Wrong column names in SQL | AI invented columns (checkout_date etc.) | DB_SCHEMA_MODELS injected at importance 88 | 2026-06 |
| "LIS Labs" returns raw IDENTITY_LAW text | local_sovereign_brain DB search ordered by importance_score DESC with no category exclusion — HMS_IDENTITY_LAW (score=100) won any query | Exclude system-rule categories from user answers. Score by relevance count × 15, not raw importance. Require min relevance threshold. | 2026-06-29 |
| "Tell about X" returns internal directives | Knowledge entries contain system-instruction language ("You are Miracle...") — LLM or local brain echoed them verbatim | Strip ALL-CAPS header lines from knowledge before returning to user. Banned categories: ANTI_HALLUCINATION, HMS_IDENTITY_LAW, HMS_VOCABULARY_LAW | 2026-06-29 |

---

## PART O — DEPLOYMENT CHECKLIST

Before deploying any change to Miracle HMS AI:

**Pre-Deploy:**
- [ ] Run: `python train_miracle_ai.py` (full brain sync)
- [ ] Run: `python -m py_compile backend_api/app/routers/bot_router_v2.py`
- [ ] Run: `python train_miracle_ai.py --status` (verify entry count > 200)
- [ ] Verify: `ops_sentinel.py` is in PM2 process list
- [ ] Verify: `brain_sync.py` is in PM2 process list

**Post-Deploy:**
- [ ] Restart: `pm2 restart miracle-backend`
- [ ] Wait 30 seconds for brain-sync to complete first cycle
- [ ] Test: Ask AI "What is NRS?" → should answer: Nursing department
- [ ] Test: Ask AI "Take me to billing" → should navigate to Z-08
- [ ] Test: Ask AI "What is BOR?" → should give formula + SQL
- [ ] Check: Z-23 Sovereign Infra > AI Audit Stream for HALLUCINATION verdicts

**IRON LAW:** If ops_sentinel.py is NOT running, the brain WILL drift. Never deploy without the sentinel active.

---

## PART P — IRON LAWS MASTER LIST

| # | Law | Rule |
|---|-----|------|
| 1 | HMS-FIRST | This is a hospital. Every response uses clinical vocabulary. |
| 2 | ZERO-ESTIMATION | Never invent numbers. Use EXECUTE_SQL or say nothing. |
| 3 | APOPTOSIS | DROP/DELETE/UPDATE/INSERT in AI SQL = instant query destruction. |
| 4 | SCHEMA-BINDING | Only use exact column names from schema. Never invent columns. |
| 5 | RBAC-FENCE | Users table is NEVER accessible via AI. Accounting = CDO/GM/ADMIN/ACC only. |
| 6 | TTS-PURITY | Strip all brackets, dashes, and system tags before speaking. |
| 7 | BREVITY | 4-5 lines max. No ellipsis. No repetition. |
| 8 | SOLUTIONS-FIRST | Never apologize. Never "I cannot". Always find a path. |
| 9 | Z-19-PRICE-MASTER | ALL prices set ONLY in Z-19. Never in Z-05 or Z-08. |
| 10 | KERNEL-RESTART | Zone blindness? Restart PM2 FIRST before touching code. |
| 11 | SENTINEL-ALWAYS-ON | ops_sentinel.py must run at all times. It improves the brain while you sleep. |
| 12 | BRAIN-SYNC-ALWAYS-ON | brain_sync.py must run at all times. Auto-learns new features. |
| 13 | PASS-1-INVISIBLE | EXECUTE_SQL pass 1 result NEVER shown to user. Only pass 2 shown. |
| 14 | NAVIGATION-FIRST | "Take me to X" → Layer 0 NAV_MAP first. Never DB knowledge lookup. |
| 15 | GEMINI-1.5-PRIMARY | Never use gemini-2.5-flash as primary. 20 req/day limit destroys quota. |
| 16 | USD-DEFAULT | Currency = USD unless DB SystemConfig overrides. Never BDT as fallback. |
| 17 | NO-OFFLINE-SPELLING | Never output [OFFLINE MODE] or any text TTS will spell letter by letter. |
| 18 | PATIENT-NOT-GUEST | Patient. Always. Everywhere. Permanently. |

---

*SOVEREIGN HMS AI DIRECTIVE V2.0 | ANTIGRAVITY + Vigilant IT Solutions*
*Last updated: 2026-06-29 | Engine: V67.0-HMS-SENTINEL*
*Classification: MANDATORY READ — No exceptions*
