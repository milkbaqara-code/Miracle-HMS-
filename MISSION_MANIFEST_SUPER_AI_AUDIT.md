# MISSION MANIFEST: SUPER AI AUDIT & SELF-HEALING ENGINE (V11.0)
> **STATUS:** AWAITING CDO APPROVAL | **Author:** ANTIGRAVITY AI | **Date:** 2026-05-07
> **TO ACTIVATE:** Mention "Execute Mission Manifest V11.0" in a new session.
> **READ ORDER:** This file -> .antigravityrules -> sovereign_architecture.md -> then execute.

---

## SECTION 0: PRE-FLIGHT FILE AUDIT (WHAT WAS SCANNED)

All files below were read in full before writing this plan. Future agents MUST re-read them.

| File | Purpose | Lines | Status |
|---|---|---|---|
| `ai_self_audit.py` | Hallucination detection engine (Tier-0 + Tier-1) | 682 | ACTIVE — has gaps |
| `ai_analysis.py` | 5 Sovereign Sensor Pillars + local classifier | 530 | ACTIVE — clean |
| `bot_router_v2.py` | Primary AI endpoint, SQL loop, audit dispatch | 565 | ACTIVE — ghost import |
| `bot_router.py` | Legacy V1 router — provides call_llm, recall_knowledge | 1027 | LEGACY — ghost code inside |
| `miracle_ai_models.py` | DB schema: AIReplyAuditLog, MiracleKnowledge | 151 | ACTIVE — missing fields |
| `miracle_brain.ts` | Frontend Layer-0: surgical fix search, CDO commands | 91 | ACTIVE — disconnected |
| `miracle_surgical_fixes.json` | 26 surgical fixes for infra/DB/billing errors | 185 | ACTIVE — not wired to audit |
| `MiracleBot.tsx` | AI UI, voice, Kinetic Wisp, zone resolver | 1545 | ACTIVE — large, check for ghosts |
| `diagnose_ai.py` | Kernel integrity checker (file existence only) | 88 | WEAK — no live checks |
| `SOVEREIGN_AI_DIRECTIVE.md` | V20.0 — persona, navigator, audit laws | 328 | ACTIVE |
| `SOVEREIGN_ENGINEERING_DIRECTIVE.md` | Build laws, deployment, learning engine | 348 | ACTIVE |
| `SOVEREIGN_SYSTEM_MAP.md` | Phase log, zone map, infra nodes | 359 | STALE — last updated Phase 48 |

---

## SECTION 1: GHOST CODE & CONFLICT AUDIT FINDINGS

### GHOST 1 — bot_router.py Line 879: Wrong model name in response
```python
# CURRENT (WRONG):
return {"response": reply, "reply": reply, "model": "gemini-2.5-flash", "zone": zone}
# FIX: gemini-2.5-flash is FORBIDDEN (20 req/day limit). Should say gemini-1.5-flash-latest
```

### GHOST 2 — bot_router.py Line 802-826: Duplicate SQL Interceptor
The V1 router has its own SQL interceptor loop (Lines 802-835). The V2 router (`bot_router_v2.py` Lines 166-194) also has one. They use DIFFERENT regex patterns:
- V1: `r'\[EXECUTE_SQL:\s*(SELECT.*?)\]'` — requires square brackets
- V2: `r'(?:\[)?EXECUTE_SQL:\s*(SELECT.*?)(?:\]|$)'` — accepts both forms
**Risk:** If a request accidentally hits the V1 endpoint, SQL may not fire correctly.
**Fix:** Route ALL traffic exclusively through V2. V1 `/query` endpoint must be disabled or redirected.

### GHOST 3 — bot_router_v2.py Lines 12-18: V2 imports from V1 (Circular Risk)
```python
from app.routers.bot_router import (
    call_llm, load_memory as build_memory_context,
    recall_knowledge, distill_and_store_knowledge, save_memory,
)
```
V2 borrows critical functions from V1. If V1 is ever refactored or deleted, V2 breaks silently.
**Fix:** Extract `call_llm`, `recall_knowledge`, `save_memory` into `app/core/ai_kernel.py`.

### GHOST 4 — bot_router.py Lines 185-480: Redundant `build_live_context()`
This 295-line function builds live DB data per zone. It is entirely superseded by `ai_analysis.py` Sensor Pillars. However, the V1 `/query` endpoint still calls it. This means:
- Duplicate DB queries on every V1 call
- Two separate code paths for the same data
**Fix:** Remove `build_live_context()` from V1. All data flows through Sensor Pillars only.

### GHOST 5 — miracle_brain.ts: Disconnected from Backend Audit
`miracle_brain.ts` has a surgical fix search engine (Layer 2) that reads `miracle_surgical_fixes.json`. However, when it finds a fix and delivers it to the user, it does NOT log this to `AIReplyAuditLog`. The audit engine has no visibility into frontend-resolved queries.
**Fix:** When `runMiracleBrain()` returns `true`, send a log event to `/api/bot/v2/audit/log` with `intent=LOCAL_BRAIN_FIX`.

### GHOST 6 — diagnose_ai.py: File Existence Only, No Live Health
`diagnose_ai.py` only checks if files exist on disk. It does NOT check:
- Is the backend running on port 8090?
- Is the DB connected?
- Is Gemini API key valid?
- Are PM2 processes alive?
**Fix:** Extend `diagnose_ai.py` with live HTTP pings and DB connection test.

### GHOST 7 — AIReplyAuditLog Model: Missing Critical Fields
The current `AIReplyAuditLog` table is missing fields needed for a "Super Audit":
```python
# MISSING FROM miracle_ai_models.py:
audit_source    = Column(String(32))   # AUTO | MANUAL | FRONTEND | VOICE
system_healthy  = Column(Boolean)      # Was backend healthy at time of reply?
llm_latency_ms  = Column(Integer)      # How long did Gemini take?
layer_used      = Column(String(32))   # LAYER_0 | LAYER_2 | LAYER_3 | LOCAL_BRAIN
prevention_rule = Column(Text)         # The SPECIFIC rule to prevent recurrence
```

### GHOST 8 — ai_self_audit.py: "Unavailable" Treated as Non-Event
When AI says "My neural pathways are momentarily offline," Tier-0 marks it `UNVERIFIABLE` and stops. It does NOT:
1. Check WHY the system was offline
2. Flag it for CDO attention
3. Suggest a PM2 restart action
4. Count it as a system failure event
This means system crashes are invisible in the audit dashboard.

### GHOST 9 — SOVEREIGN_SYSTEM_MAP.md: SSH Key Still Shows Old Path
Line 57: `SSH Auth: Uses key-based authentication. Key at .ssh/id_ed25519`
Should be: `.ssh/miracle_os_key` (updated in deployment but not here).

---

## SECTION 2: WHAT "SUPER AUDIT" MEANS FOR MIRACLE OS

A professional ERP audit engine must verify 7 dimensions, not just 4. Here is the complete matrix:

| Dimension | Current Status | Target |
|---|---|---|
| Zone Integrity | ACTIVE (6 checks) | Expand to all 25 zones |
| Button Precision | ACTIVE (global check) | Zone-scoped button check |
| Data Fabrication | ACTIVE (number detection) | + SQL schema validation |
| Persona Lock | NOT AUDITED | Add CDO voice check |
| System Health | NOT AUDITED | Add Diagnostic Probe |
| Response Latency | NOT TRACKED | Add LLM latency field |
| Layer Transparency | NOT TRACKED | Log which Layer answered |

---

## SECTION 3: THE 6-PILLAR SUPER AUDIT ARCHITECTURE

### PILLAR A: Diagnostic Probe (System-Level Healing)
**Files to modify:** `ai_self_audit.py`
**What it does:** When "neural pathways offline" is detected, instead of `UNVERIFIABLE`, it:
1. Fires `SovereignAnalysisEngine.get_system_health()` in the background
2. Records `system_healthy=False` in `AIReplyAuditLog`
3. Sets `hallucination_type=SYSTEM_FAILURE`
4. Generates `correction` = "Run: pm2 restart miracle-backend on VPS 23.88.50.87"
5. Displays a RED banner on the Z-23 dashboard automatically

**Code location:** `deterministic_audit_check()` in `ai_self_audit.py` around line 247.
**New check to add:**
```python
# Check 0 (NEW): SYSTEM FAILURE PROBE
system_failure_phrases = [
    "neural pathways are momentarily offline",
    "my neural pathways are momentarily",
    "momentarily experiencing a planned maintenance",
    "synapse error",
]
if any(phrase in reply_lower for phrase in system_failure_phrases):
    return {
        "verdict": "HALLUCINATION",
        "confidence": 100,
        "hallucination_type": "SYSTEM_FAILURE",
        "what_is_wrong": "AI reported offline status. Backend LLM or DB unreachable.",
        "root_cause": "Gemini API quota exhausted OR DB connection lost OR PM2 crashed.",
        "correction": "ACTION REQUIRED: SSH to 23.88.50.87. Run: pm2 restart miracle-backend. Check .env GEMINI_API_KEY.",
        "prevention_rule": "Monitor PM2 process health every 60s. Rotate Gemini keys if quota hit."
    }
```
**Why this is critical:** Right now every system crash is silent. With this change, every crash becomes a visible, actionable audit record.

---

### PILLAR B: SQL Pre-Audit (Schema Integrity Guard)
**Files to modify:** `bot_router_v2.py` (SQL interceptor, Lines 166-194)
**What it does:** Before executing `EXECUTE_SQL`, validates the SQL against `miracle_kernel.json` schema.
**Detected violations:**
- `checkout_date` column used (does not exist — must calculate from `start_date + nights`)
- `SELECT *` on forbidden tables (`accounting_ledger`, `access_credentials`)
- Wrong table name (e.g., `rooms` instead of `asset_grid`)

**Code to add BEFORE db.execute():**
```python
# SQL PRE-AUDIT: Validate against known schema
FORBIDDEN_COLUMNS = ["checkout_date", "end_date", "departure_date"]
FORBIDDEN_TABLES = ["accounting_ledger", "access_credentials", "users"]
sql_lower = sql_query.lower()

for col in FORBIDDEN_COLUMNS:
    if col in sql_lower:
        sql_query = sql_query.replace(col,
            "-- CORRECTED: use start_date + INTERVAL nights DAY instead")
        logger.warning(f"[SQL_PREAUDIT] Forbidden column '{col}' auto-corrected.")

for tbl in FORBIDDEN_TABLES:
    if f"from {tbl}" in sql_lower or f"join {tbl}" in sql_lower:
        sql_result = f"ERROR: Apoptosis Guard blocked access to protected table '{tbl}'."
        break
```

---

### PILLAR C: Brain Manifest UI (Injection Gate — CDO Control)
**Files to create:** `web/app/dashboard/infrastructure/BrainViewer.tsx`
**Files to modify:** `web/app/dashboard/infrastructure/page.tsx` (add the new panel)
**What it does:** A live table in Z-23 showing every record in `miracle_knowledge` table.
**Columns to show:** `id | category | insight (preview) | source_role | importance_score | created_at | [APPROVE] [REJECT]`

**New API endpoint needed:** `GET /api/bot/v2/brain/manifest?category=ANTI_HALLUCINATION`
```python
@router.get("/brain/manifest")
async def get_brain_manifest(category: str = None, db: Session = Depends(get_db)):
    q = db.query(MiracleKnowledge)
    if category:
        q = q.filter(MiracleKnowledge.category == category)
    records = q.order_by(MiracleKnowledge.importance_score.desc(),
                         MiracleKnowledge.created_at.desc()).limit(100).all()
    return {"records": [...], "total": len(records)}
```

**The Injection Gate:** Currently `inject_healing_fix()` auto-injects with no CDO review. We add a `PENDING_INJECTION` status.
- Auto-detected fixes → `status = PENDING_INJECTION` (visible in BrainViewer but not active)
- CDO clicks APPROVE → `importance_score = 10`, `status = ACTIVE` (now injected into prompts)
- CDO clicks REJECT → record soft-deleted, `status = REJECTED`

---

### PILLAR D: Layer Transparency (Anatomy Awareness)
**Files to modify:** `bot_router_v2.py`, `miracle_ai_models.py`
**What it does:** Every reply is tagged with which layer answered it.
- Layer 0 (local classify): `layer_used = "LAYER_0_LOCAL"`
- Pillar sensor: `layer_used = "LAYER_2_PILLAR_1"` (e.g., Financial Vault)
- Gemini synthesis: `layer_used = "LAYER_3_GEMINI"`
- Frontend brain: `layer_used = "LAYER_0_FRONTEND"`

This gives the CDO a real answer to "Why did the AI say that?" — because you can see exactly which code path fired.

---

### PILLAR E: Extended Detection Matrix (8 Checks → 12 Checks)
**Files to modify:** `ai_self_audit.py` — `deterministic_audit_check()`

Current checks: 6. Add these 6 new ones:

| Check # | Pattern | Verdict |
|---|---|---|
| 7 | AI says "I cannot access" or "I don't have data" WITHOUT trying EXECUTE_SQL | HALLUCINATION / SQL_BYPASS |
| 8 | Reply contains a BDT/৳ amount in a "how much" query WITHOUT SQL evidence | HALLUCINATION / INVENTED_FACT |
| 9 | Reply navigates to a zone NOT in the Zone Path Map | HALLUCINATION / WRONG_ZONE |
| 10 | Reply mentions a staff member name not confirmed by DB | HALLUCINATION / INVENTED_FACT |
| 11 | Voice query `[MIC]` but reply contains `[FOCUS]` to wrong zone | HALLUCINATION / WRONG_ZONE |
| 12 | System prompt `[SYSTEM_PROMPT]` appears in user-visible reply | HALLUCINATION / PERSONA_BREAK |

---

### PILLAR F: Persona Lock Audit
**Files to modify:** `ai_self_audit.py`
**What it does:** Detects when the AI breaks its British CDO persona.
**Patterns to flag:**
```python
persona_break_phrases = [
    "as an ai", "i am an ai", "i'm an artificial",
    "i cannot help with that", "i apologize",
    "hello! how can i", "hi there",  # robot greetings
    "attenborough",  # ghost persona leak
]
```
If detected: `verdict = HALLUCINATION`, `hallucination_type = PERSONA_BREAK`

---

## SECTION 4: SELF-HEALING — HOW IT WORKS END-TO-END

### Current Flow (Broken for System Errors):
```
User Query → AI Reply → log_reply_for_audit() → audit_reply_async() [background]
    → deterministic_audit_check() → CORRECT/HALLUCINATION/UNVERIFIABLE
    → if HALLUCINATION: inject ANTI_HALLUCINATION into miracle_knowledge
    → next query: recall_knowledge() surfaces as HARD RULE
```

### Target Flow (V11.0 — Super Healing):
```
User Query → AI Reply → log_reply_for_audit() [now logs layer_used, llm_latency_ms]
    → audit_reply_async() [background, 12 checks]
        → Check 0 (SYSTEM_FAILURE): fires get_system_health() if offline detected
        → Check 5 (DATA_BYPASS): validates SQL was used for number queries
        → Check 7-12 (NEW): persona, SQL bypass, navigation, amount fabrication
    → if HALLUCINATION:
        → status = PENDING_INJECTION (CDO must approve)
        → Z-23 BrainViewer shows the pending fix
        → CDO clicks APPROVE → importance_score=10, becomes HARD RULE
    → if SYSTEM_FAILURE:
        → Z-23 shows RED banner "Backend Offline — Run PM2 Restart"
        → correction = actionable VPS command
```

---

## SECTION 5: WHAT NEEDS TO BE BUILT vs WHAT EXISTS

| Component | EXISTS? | Status | Action Required |
|---|---|---|---|
| Tier-0 deterministic check | YES | 6 checks | Extend to 12 checks |
| SYSTEM_FAILURE detection | NO | Missing | Build in Pillar A |
| SQL Pre-Audit | NO | Missing | Build in Pillar B |
| Brain Manifest UI | NO | Missing | Build in Pillar C |
| CDO Injection Gate (Approve/Reject) | NO | Missing | Build in Pillar C |
| Layer transparency logging | NO | Missing | Build in Pillar D |
| Persona lock audit | NO | Missing | Build in Pillar F |
| `AIReplyAuditLog` extra fields | NO | Missing | Migrate DB |
| `diagnose_ai.py` live health | NO | Partial | Extend script |
| Ghost code purge (V1 router) | NO | Required | Apoptosis |
| `ai_kernel.py` shared core | NO | Required | Refactor |
| `SOVEREIGN_SYSTEM_MAP.md` SSH fix | NO | Stale | Update line 57 |

---

## SECTION 6: EXECUTION PLAN (ORDERED — DO NOT SKIP STEPS)

### PHASE 1: DATABASE MIGRATION (No UI, No Deploy Risk)
**Step 1.1** — Add missing columns to `AIReplyAuditLog` in `miracle_ai_models.py`:
- `audit_source`, `system_healthy`, `llm_latency_ms`, `layer_used`, `prevention_rule`

**Step 1.2** — Add `status` field to `MiracleKnowledge` model:
- Values: `ACTIVE` | `PENDING_INJECTION` | `REJECTED`

**Step 1.3** — Run `vps_delta_sync.py backend` to apply schema changes via Genesis auto-migration.

---

### PHASE 2: BACKEND AUDIT ENGINE UPGRADE
**Step 2.1** — `ai_self_audit.py`: Add Pillar A (SYSTEM_FAILURE check as Check 0).
**Step 2.2** — `ai_self_audit.py`: Add Pillar F (persona lock check).
**Step 2.3** — `ai_self_audit.py`: Add checks 7-12 (SQL bypass, amount fabrication, navigation, persona break).
**Step 2.4** — `bot_router_v2.py`: Add SQL Pre-Audit before `db.execute()` (Pillar B).
**Step 2.5** — `bot_router_v2.py`: Log `layer_used` and `llm_latency_ms` on every reply.
**Step 2.6** — `bot_router_v2.py`: Change `inject_healing_fix()` to set `status=PENDING_INJECTION`.
**Step 2.7** — Add new endpoint: `GET /api/bot/v2/brain/manifest`.
**Step 2.8** — Add new endpoint: `POST /api/bot/v2/brain/approve/{knowledge_id}`.
**Step 2.9** — Add new endpoint: `POST /api/bot/v2/brain/reject/{knowledge_id}`.

---

### PHASE 3: GHOST CODE PURGE
**Step 3.1** — `bot_router.py`: Mark `/query` endpoint as DEPRECATED. Add redirect to `/api/bot/v2/query`.
**Step 3.2** — `bot_router.py`: Delete `build_live_context()` (Lines 185-480). All data flows through Pillar sensors only.
**Step 3.3** — Create `backend_api/app/core/ai_kernel.py` with: `call_llm`, `recall_knowledge`, `save_memory`, `distill_and_store_knowledge`.
**Step 3.4** — Update `bot_router_v2.py` imports to use `app.core.ai_kernel` instead of `app.routers.bot_router`.
**Step 3.5** — `SOVEREIGN_SYSTEM_MAP.md` Line 57: Fix SSH key path to `miracle_os_key`.
**Step 3.6** — `diagnose_ai.py`: Add live HTTP ping to `http://localhost:8090/api/health` and DB connection test.

---

### PHASE 4: FRONTEND BRAIN MANIFEST UI
**Step 4.1** — Create `web/app/dashboard/infrastructure/BrainViewer.tsx`.
- Fetches `/api/bot/v2/brain/manifest?category=ANTI_HALLUCINATION`
- Displays: insight preview, source, importance, status badge
- APPROVE button → calls `/api/bot/v2/brain/approve/{id}`
- REJECT button → calls `/api/bot/v2/brain/reject/{id}`

**Step 4.2** — Add SYSTEM_FAILURE alert banner to Z-23 `infrastructure/page.tsx`.
- Polls `/api/bot/v2/audit/stats` every 10s
- If `system_failure_count > 0`, show RED banner with PM2 restart command

**Step 4.3** — Wire `miracle_brain.ts` to log frontend-resolved queries to audit log.

---

### PHASE 5: DEPLOY & VERIFY
**Step 5.1** — Run `python scratch/diagnose_ai.py` — all files must pass.
**Step 5.2** — Run `python scripts/vps_delta_sync.py backend`.
**Step 5.3** — Run `python scripts/vps_tar_deploy.py frontend`.

**Verification Tests:**
1. Ask AI "why are you offline?" → Audit must show `SYSTEM_FAILURE` with PM2 action.
2. Ask AI "what is room 101 status" → SQL must fire; no invented numbers.
3. Ask AI to go to checkout → Wisp must fly; audit must show `CORRECT`.
4. Open Z-23 BrainViewer → All pending healing rules visible.
5. Click APPROVE on one rule → Next query must reflect the new HARD RULE.
6. Ask "as an AI, what do you think?" → Audit must flag `PERSONA_BREAK`.

---

## SECTION 7: REQUIRED FIELDS FOR ERP-GRADE AUDIT (COMPLETE SPEC)

The `AIReplyAuditLog` table after Phase 1 migration will have these fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | Integer PK | Record ID |
| `session_id` | String | Browser session |
| `zone` | String | Z-07, Z-08, etc. |
| `user_query` | Text | What was asked |
| `ai_reply` | Text | What AI said |
| `intent` | String | Classified intent |
| `layer_used` | String (NEW) | LAYER_0/LAYER_2/LAYER_3 |
| `audit_source` | String (NEW) | AUTO/MANUAL/FRONTEND/VOICE |
| `system_healthy` | Boolean (NEW) | Was backend healthy? |
| `llm_latency_ms` | Integer (NEW) | Gemini response time |
| `verdict` | String | CORRECT/HALLUCINATION/UNVERIFIABLE |
| `hallucination_type` | String | WRONG_ZONE/INVENTED_FACT/SYSTEM_FAILURE/PERSONA_BREAK |
| `root_cause` | Text | WHY it failed |
| `correction` | Text | Verified correct answer |
| `prevention_rule` | Text (NEW) | Specific rule to prevent recurrence |
| `knowledge_id` | Integer | FK to MiracleKnowledge if healed |
| `confidence` | Integer | 0-100 audit confidence |
| `created_at` | DateTime | When reply was made |
| `audited_at` | DateTime | When audit completed |

---

## SECTION 8: PRE-FLIGHT LAWS FOR ANY FUTURE AI AGENT

Before ANY code change, deploy, or feature addition, the agent MUST complete this checklist:

```
[ ] 1. Run `python scratch/diagnose_ai.py` — all files present?
[ ] 2. Read `.antigravityrules` fully — especially Rule 12 (Pre-Flight Laws).
[ ] 3. Read `sovereign_architecture.md` KI — VPS credentials confirmed?
[ ] 4. Check this MANIFEST for the component being changed — is there a known ghost?
[ ] 5. MIRROR LAW: grep the feature name across bot_router_v2.py AND bot_router.py.
[ ] 6. SCHEMA ANCHOR: verify column names in models.py before touching ai_analysis.py.
[ ] 7. ASCII LAW: No em-dashes or Unicode in Python files — causes VPS crash.
[ ] 8. BREVITY CHECK: Any directive change must keep 4-5 line response law intact.
[ ] 9. AUDIT LAW: audit_reply_async must NEVER be made synchronous.
[ ] 10. DEPLOY: Run backend sync BEFORE frontend sync. Never reverse the order.
```

---

## SECTION 9: FILES TO UPDATE IN `.antigravityrules`

Add this block at the end of `.antigravityrules`:

```
13. SUPER AUDIT PRE-FLIGHT (V11.0 — MANDATORY):
    - MANIFEST FIRST: Read MISSION_MANIFEST_SUPER_AI_AUDIT.md before touching ai_self_audit.py or bot_router_v2.py.
    - GHOST CHECK: Before any feature, grep for duplicates in bot_router.py vs bot_router_v2.py.
    - SYSTEM FAILURE = AUDIT RECORD: "Unavailable" responses must be flagged SYSTEM_FAILURE, not UNVERIFIABLE.
    - CDO GATE: No healing rule is AUTO-INJECTED. All rules go to PENDING_INJECTION for CDO approval first.
    - LAYER LOGGING: Every AI reply must record which layer (0/2/3/Frontend) generated it.
    - SQL PREAUDIT: Every EXECUTE_SQL must be validated against miracle_kernel.json schema BEFORE hitting the DB.
    - BRAIN VIEWER: The Z-23 BrainViewer is the CDO's window into AI learning. It must always be functional.
    - DIAGNOSE FIRST: Run diagnose_ai.py before any session that touches the AI engine.
```

---

## SECTION 10: ESTIMATED EFFORT PER PHASE

| Phase | Work Items | Complexity | Risk |
|---|---|---|---|
| Phase 1: DB Migration | 2 model edits | LOW | LOW — Genesis handles schema |
| Phase 2: Audit Engine | 9 backend edits | HIGH | MEDIUM — test each check |
| Phase 3: Ghost Purge | 6 refactors | HIGH | HIGH — test V2 imports after |
| Phase 4: Frontend UI | 3 components | MEDIUM | LOW — UI only |
| Phase 5: Deploy | 2 syncs + 6 tests | LOW | MEDIUM — VPS SSH required |

**Total estimated sessions:** 3-4 focused work sessions.

---

## DOCUMENT CONTROL

| Field | Value |
|---|---|
| Version | V11.0 |
| Created | 2026-05-07 |
| Author | ANTIGRAVITY AI (Full Codebase Audit) |
| Files Audited | 14 files, ~7,000 lines of code |
| Ghosts Found | 9 ghost code blocks |
| New Components | 3 (BrainViewer, ai_kernel.py, SQL Pre-Audit) |
| New DB Fields | 5 in AIReplyAuditLog, 1 in MiracleKnowledge |
| New Audit Checks | 6 (checks 7-12) |
| VPS | 23.88.50.87 | root | PEd9jivuqsAa | miracle_os_key |

**ACTIVATION COMMAND:** In a new session, say:
> "Execute Mission Manifest V11.0 — Phase 1: DB Migration"
> The agent will read this file first, then execute only the approved phase.
