# MIRACLE OS: SOVEREIGN SYSTEM MAP (V6.7 — F&B INTELLIGENCE UPGRADE)
**Status:** ACTIVE | **AI Engine:** GEMINI_1.5_FLASH | **Backend:** V7.7.0-FNB-INTEL | **Date:** 2026-06-22

---

### INDEX / TABLE OF CONTENTS
- [MASTER SAFE POINT](#master-safe-point--verified-stable-snapshot)
- [1. ARCHITECTURAL CORE](#1-architectural-core-v75--sovereign-stability)
- [2. DEPLOYMENT PROTOCOLS](#2-deployment-protocols)
- [3. SERVER INFRASTRUCTURE MAP](#3-server-infrastructure-map-production)
- [4. DNS ARCHITECTURE & RECOVERY](#4-dns-architecture--recovery-protocol)
- [5. CRITICAL ENDPOINTS](#5-critical-endpoints)
- [6. AI BRAIN ARCHITECTURE](#6-ai-brain-architecture-v40--sovereign-navigator)
- [7. KNOWN BUGS & RESOLVED INCIDENTS](#7-known-bugs--resolved-incidents)
- [8. KNOWN GHOSTS](#8-known-ghosts-do-not-delete)
- [9. PHASE COMPLETION STATUS](#9-phase-completion-status)
- [10. STRICT SOVEREIGN UI CSS LAWS](#10-strict-sovereign-ui-css-integrity-laws-v100)
- [11. SOVEREIGN INDEX PROTOCOL](#11-sovereign-index-protocol-the-iron-map)
- [12. SOVEREIGN SRE DASHBOARD](#12-sovereign-sre-dashboard-v250--active-2026-05-09)
- [13. WEB SERVER CONFIGURATION](#13-web-server-configuration-ssl--proxy-iron-law)
- [14. DATABASE SCHEMA MIGRATION PROTOCOL](#14-database-schema-migration-protocol-iron-law-33--auto-healing-v2)
- [15. Z-23 SYSTEM TELEMETRY KEY CONTRACT](#15-z-23-system-telemetry-key-contract-iron-law-34)
- [16. NETWORK MTU FRAGMENTATION PROTOCOL](#16-network-mtu-fragmentation-protocol-iron-law-37)
- [17. CINEPLEX MULTIMEDIA ENGINE](#17-sovereign-new-feature-cineplex-multimedia-engine-2026-05-15)
- [18. ZONE 20 SYNAPSE NEXUS](#18-sovereign-new-feature-zone-20-synapse-nexus--corporate-hierarchy-protocol-2026-05-17)
- [19. THE ARCHITECT ZONES](#19-sovereign-new-feature-the-architect-zones-2026-05-24)
- [20. AGI CoA INTELLIGENCE ENGINE](#20-sovereign-new-feature-agi-coa-intelligence-engine-2026-06-05)
- [21. FINANCIAL INTELLIGENCE WAR ROOM — Z-11C](#21-sovereign-new-feature-financial-intelligence-war-room--z-11c-2026-06-05)
- [22. ADVANCED ROTHSCHILD PMS & MOBILE OWNER APP — Z-30](#22-sovereign-new-feature-advanced-rothschild-pms--mobile-owner-app--z-30-2026-06-14)
- [23. PROPERTY OWNER BRIDGE — Z-31](#23-sovereign-new-feature-property-owner-bridge--z-31-2026-06-16)
- [24. FOOD & BEVERAGE INTEGRATION — Z-KDS, Z-MENU, Z-DELIVERY](#24-sovereign-new-feature-food--beverage-integration--z-kds-z-menu-z-delivery-2026-06-22)
- [25. F&B INTELLIGENCE ENGINE — Z-29-INTEL](#25-sovereign-upgrade-fb-intelligence-engine--z-29-intel-2026-06-22)

---

## MASTER SAFE POINT — VERIFIED STABLE SNAPSHOT

| Field | Value |
|:---|:---|
| **Commit Hash** | `e369a91` (unblocked dashboard/POS + synced v2.0.0) |
| **Commit Message** | `fix(dashboard): restore interactivity to main grid and POS by removing hardcoded zone-view-mode` |
| **Timestamp** | `2026-04-30 20:42 (BD Time / UTC+6)` |
| **Branch** | `main` |
| **GitHub URL** | `https://github.com/milkbaqara-code/miracle-os-master` |
| **Key Fixes** | Restored interactivity for Admins in Zone 07 & Zone 05, synced `v2.0.0` across all layers, lifted mandatory lock for Windows browsers. |

### ONE-COMMAND RESTORE — Return to this exact state:
```bash
# If repo already exists locally:
git fetch origin && git reset --hard 70fc6be

# If starting fresh on a new machine:
git clone https://github.com/milkbaqara-code/miracle-os-master.git
git checkout 70fc6be
```

> **RULE:** Every time a new stable state is confirmed on the live server, update this section with the new commit hash before doing anything else.

---

## 1. ARCHITECTURAL CORE (V7.6 — Sovereign Stability)

| Component | Production Port | Local Dev Port | Primary Directory |
| :--- | :--- | :--- | :--- |
| **Backend (FastAPI/Uvicorn)** | `8090` | `8090` | `backend_api/` |
| **Frontend (Miracle OS ERP)** | `3000` | `3000` | `web/` |
| **Vigilant Marketing Site** | `3001` | `3001` | `vigilant_website/` |
| **Web Builder Editor** | `3003` | `3003` | `web_builder/` |
| **Standalone Miracle POS** | N/A (AWS Template)| `3005` | `D:\Miracle POS` (Remapped) |
| **Database** | MySQL (via VPS) | SQLite (local dev) | `miracle_os_master.db` |

### Sovereign Laws:
1. **PORT ENFORCEMENT**: The backend engine **MUST** bind to port **8090**. Dev ports are locked to prevent conflicts (8090, 3000, 3001, 3003, 3005).
2. **SAFE BOX (VENV)**: Never use system `pip`. Always use the venv at `$BACKEND_ROOT/venv`.
3. **SCANNER PROTOCOL**: Before ignition, run the Python scanner to auto-install missing imports.
4. **PATH INTEGRITY**: Always import `pathlib.Path` in routers to avoid startup crashes.
5. **ENCODING LAW**: All Python source files MUST use ASCII-safe characters only. No em-dashes (—), no emoji in docstrings, no Unicode special characters in comments. These cause `SyntaxError` on the Linux production server even when local Windows dev shows no error.

---

## 2. DEPLOYMENT PROTOCOLS

### Master Deployment Engine: `scripts/sovereign_patient_deploy.py`
- **Function:** Orchestrates full-stack synchronization. Builds Next.js frontend, packages into tar, uploads both frontend and backend, migrates database, and restarts PM2.
- **Usage:** `python scripts/sovereign_patient_deploy.py all`
- **Root Resolution (V2.0 Update):** The script uses `Path(__file__).resolve().parent.parent` to automatically locate the master root directory (`backend_api` and `web/.next`). It will execute successfully regardless of the current working directory.
- **Safety:** Aborts on build failure. Automatically handles SSH auth and path injection.
- **AUTH METHOD:** Paramiko with **password first** (`NdRbWqkTuUMf`), RSAKey fallback. This is the ONLY reliable method for Windows-to-Hetzner SSH.

### Delta Repair Module: `scripts/vps_delta_sync.py`
- **Function:** Restores lost APK binaries and restarts stalled backend engines.

### IRON LAW 38: DEPLOY SCRIPT AUTHORING (2026-05-15 -- PERMANENT)
Any custom/targeted deploy script MUST follow these rules or it WILL fail on Windows:

| Rule | WRONG (will fail) | CORRECT |
|---|---|---|
| SSH/SCP | `subprocess.run(["ssh",...])` | `paramiko` password-first auth |
| File upload | `subprocess.run(["scp",...])` | `sftp.put(local, remote)` |
| npm build | `subprocess.run(["npm",...])` | `subprocess.run("npm run build", shell=True)` |
| Reference | Any invented pattern | Copy from `sovereign_patient_deploy.py` |

**Remote Paths (source of truth):**
- Backend:  `/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api`
- Frontend: `/home/vigilantitsolution-miracle/htdocs/miracle.vigilantitsolution.com`

### IRON LAW 49: THE GHOST MIDDLEWARE LAW
When deploying to the VPS (e.g. Next.js), you MUST execute `rm -rf .next` on the server before unzipping a new build. Zipping over an existing directory leaves old cached pages alive as "Ghost Middleware", causing infinite redirect loops and hydration crashes.

---

## 3. SERVER INFRASTRUCTURE MAP (PRODUCTION)

| Asset | Value |
|:---|:---|
| **VPS IP (Backend)** | `23.88.50.87` |
| **Shared Hosting IP (cPanel/Domain)** | `148.251.78.240` |
| **Backend Root (VPS)** | `/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api/` |
| **Frontend Root (VPS)** | `/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/web/` |
| **PM2 Backend Process** | `miracle-backend` |
| **PM2 Frontend Process** | `miracle-frontend` |
| **Backend .env Location** | `/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api/.env` |

### Production .env (VPS):
```env
PYTHONPATH=backend_api
DB_TYPE=mysql
DB_HOST=localhost
DB_USER=miracle_user
DB_PASS=MiracleSecure2026!
DB_NAME=miracle_os
GEMINI_API_KEY=[REDACTED]
GROQ_API_KEY=[REDACTED]
```

---

## 4. DNS ARCHITECTURE & RECOVERY PROTOCOL

> **CRITICAL KNOWLEDGE:** This section documents a DNS outage that occurred on 2026-05-01 and explains how to prevent and resolve it.

### The Two-Server Architecture:
The Miracle OS system uses TWO separate servers. This is not one machine.

| Server | IP | Role | Managed By |
|:---|:---|:---|:---|
| **Shared Hosting (cPanel)** | `148.251.78.240` | Hosts the domain `vigilantitsolution.com`, manages DNS zone, email | cPanel at `:2083` |
| **VPS (Hetzner)** | `23.88.50.87` | Hosts Miracle OS backend (port 8090) + Next.js frontend (port 3000) | SSH / PM2 |

### Why DNS Worked Before:
DNS records were previously correctly configured, pointing the subdomains to the VPS IP. When they work, the system is invisible to DNS issues.

### Why DNS Broke (2026-05-01 Root Cause):
The subdomain A records (`api`, `miracle`, `demo`) disappeared from the DNS zone managed by the cPanel hosting server at `148.251.78.240`. This can happen due to:
- cPanel hosting panel migration or server upgrade
- DNS zone auto-reset by the hosting provider
- Accidental deletion via the Zone Editor
- Domain nameserver change that wiped custom records

### How to Fix DNS (Step-by-Step):
1. Log in to cPanel: `http://148.251.78.240:2083` (or via your hosting provider's login page)
2. Navigate to: **Zone Editor** (or "DNS Zone Editor")
3. Select the domain: `vigilantitsolution.com`
4. Add or restore these **A Records**:

| Subdomain Name | Type | IP Address (Points To) | TTL |
|:---|:---|:---|:---|
| `api` | A | `23.88.50.87` | 3600 |
| `miracle` | A | `23.88.50.87` | 3600 |
| `demo` | A | `23.88.50.87` | 3600 |

5. Save and wait **5-30 minutes** for global DNS propagation.
6. Verify with: `nslookup api.vigilantitsolution.com` — should return `23.88.50.87`

### Interim Bypass (Access During DNS Outage):
To access the dashboard while DNS propagates, add these lines to your local `C:\Windows\System32\drivers\etc\hosts` file:
```
23.88.50.87 api.vigilantitsolution.com
23.88.50.87 miracle.vigilantitsolution.com
23.88.50.87 demo.vigilantitsolution.com
```

---

## 5. CRITICAL ENDPOINTS

- **Main App:** `https://miracle.vigilantitsolution.com/`
- **Guest Portal:** `https://miracle.vigilantitsolution.com/guest`
- **Synapse Nexus (Zone 20):** `https://miracle.vigilantitsolution.com/dashboard/synapse`
- **API Base:** `https://api.vigilantitsolution.com/api`
- **Health Gate:** `https://api.vigilantitsolution.com/api/health`
- **Live Grid API:** `https://api.vigilantitsolution.com/api/frontdesk/live-grid`
- **Bot Query:** `https://api.vigilantitsolution.com/api/bot/query`
- **Synapse AGI:** `https://api.vigilantitsolution.com/api/synapse/agi/decompose-directive`
- **WebSocket:** `wss://api.vigilantitsolution.com/ws/grid-sync`

---

## 6. AI BRAIN ARCHITECTURE (V4.0 — Sovereign Navigator)

- **Primary Engine:** Google Gemini 1.5 Flash
- **Fallback Engine:** Groq Llama 3.3 (70B) — Zero-Latency fallback
- **Persona:** Sovereign Navigator (V4.0) — Identity: "Miracle"
- **Persona Source of Truth:** `SOVEREIGN_AI_DIRECTIVE.md`
- **Backend Engine File:** `backend_api/app/routers/bot_router_v2.py` (V4 Deterministic)
- **Frontend Component:** `web/app/components/MiracleBot.tsx` (V4 Singleton)
- **Engine Stamp:** `SOVEREIGN_ENGINE_STAMP: V24.0-SOVEREIGN-NAVIGATOR-V4`

### DYNAMIC FLASH ROUTING PROTOCOL (NEW STANDARD)
To optimize costs while maintaining high reasoning for architecture:
- **FRONTIER TIER (Claude 4.6):** Triggered ONLY if `requires_deep_reasoning = true` or the task involves core refactoring/mathematical complexity.
- **FLASH TIER (Gemini 3 Flash):** Used for all standard pipelines. Optimizes further by setting `thinking_budget = 0` for simple data formatting, and `1024` for basic logic.

### GROQ Key Expiry:
- Key: [REDACTED]
- **Expires: Mid-June 2026 (~June 18)** — RENEW BEFORE JUNE 15, 2026.

### Voice Engine (V7.0):
- **Voice Target:** Enthusiastic British (Male/Female — Google UK English preferred)
- **Pitch:** 1.05 to 1.1 | **Rate:** 1.15 to 1.2

---

## 7. KNOWN BUGS & RESOLVED INCIDENTS

### Syntax Error: Non-ASCII Characters in Python (RESOLVED 2026-05-01)
- **Symptom:** Backend crashes at startup with `SyntaxError: invalid character` or `unterminated triple-quoted string literal`
- **Root Cause:** Em-dashes (—) or other Unicode characters were inserted into Python docstrings/comments by AI edits. Linux Python 3.12 on the VPS is stricter than Windows Python about encoding in source files.
- **Resolution:** Replaced all em-dashes with standard hyphens (-) in `bot_router.py`. 
- **Prevention Rule:** AI must never insert Unicode special characters into Python source files.

### Legacy CORE_IDENTITY Block (RESOLVED 2026-05-01)
- **Symptom:** `SyntaxError: unterminated triple-quoted string literal (detected at line 854)`
- **Root Cause:** The V7.0 upgrade accidentally left the old `CORE_IDENTITY = """..."""` block in place and inserted a NEW one below it, creating an unclosed triple-quote string that consumed the rest of the file.
- **Resolution:** Purged the legacy block, keeping only the V7.0 identity directive.

### Zombie PM2 Log Process (RESOLVED 2026-05-01)
- **Symptom:** Deployment sync script hangs indefinitely
- **Root Cause:** A `pm2 logs ... --raw` command left a hanging process (PID 101096) on the VPS that blocked the SSH session
- **Resolution:** Run `pkill -f "pm2 logs"` on the VPS to clear zombie log watchers before syncing.

### Infinite Redirect Loop Fix (RESOLVED 2026-04-30)
- **Symptom:** Browser stuck between `/` and `/dashboard` after session disconnect
- **Root Cause:** Next.js client-side router cache clash with Middleware cookie
- **Resolution:** `layout.tsx` explicitly destroys `miracle_session_token` cookie if `localStorage` is missing before redirecting.

---

## 8. KNOWN GHOSTS (DO NOT DELETE)
The server has folders with double 'O' or double 'N' typos.
- `miracle.vigilantitsolutioonn.com`
- `miracle.vigilantitsolutionn.com`
The Sync script must update ALL of these to ensure no old code is accidentally served by Nginx.

---

### 🤖 MIRACLE AI SOVEREIGN ARCHITECTURE (V3.0)
| Tier | Component | File | Responsibility |
| :--- | :--- | :--- | :--- |
| **Layer 0** | **Local Logic** | `ai_analysis.py` | Regex classification & local KNOWLEDGE_BASE (0 Tokens). |
| **Layer 1** | **Router** | `bot_router_v2.py` | Fallback Gemini classification. |
| **Layer 2** | **Analysis Engine**| `ai_analysis.py` | Native Python/SQL extraction — 5 Sovereign Sensor Pillars. |
| **Layer 3** | **Synthesizer** | `bot_router_v2.py` | British Executive persona synthesis. |

### 5 SOVEREIGN SENSOR PILLARS (V3.0 — 2026-05-05)
| Pillar | Sensor Function | Key Data Points |
|:---|:---|:---|
| **1 - Financial Vault** | `get_financial_vault()` | Revenue today/7d/30d/MTD, Tax, SC, Pool/SPA/Restaurant earnings, COGS, Profit, AR/AP, Folio Dues |
| **2 - Operational Grid** | `get_operational_grid()` | Room status (IN-HOUSE/AVAILABLE/DIRTY/MAINTENANCE), Occupancy %, Arrivals, Departures, HK queue |
| **3 - Human Capital** | `get_human_capital_report()` | Staff headcount, On-duty, Efficiency rating, Open tickets, Critical issues, Dept breakdown |
| **4 - Guest Intelligence** | `get_guest_intelligence()` | CRM profiles, VIPs, Returning guests, Loyalty coins, Top guest, Offers live, Upcoming reservations |
| **5 - SRE Infrastructure** | `get_system_health()` | DB latency, PM2 process states, API port, Telemetry |


### 🛠️ INFRASTRUCTURE NODES
- **Sovereign Vault:** 4-Key rotation engine for API resilience.
- **Pulse Monitor:** (Building) Background threshold monitoring.

---

## 9. PHASE COMPLETION STATUS

| Phase | Task | Status |
|:---|:---|:---:|
| 0 | GROQ key injection to VPS | Complete |
| 1 | Live DB context wired | Complete |
| 2 | Persistent memory (DB) | Complete |
| 3 | STT barge-in + rhythm TTS | Complete |
| 4 | 18-zone intelligence library | Complete |
| 5 | Proactive alert engine (90s poll) | Complete |
| 6 | Guest APK UI/UX (Dynamic Cats, Z-19 Concierge) | Complete -- 2026-05-24 |
| 7 | Brevity Protocol (IRON RULE 10) | Complete — 2026-04-24 |
| 8 | Pricing Absolute Ban (IRON RULE 11) | Complete — 2026-04-24 |
| 9 | MIC Interrupt tag (IRON RULE 12) | Complete — 2026-04-24 |
| 10 | Guest zone prefix routing fix | Complete — 2026-04-24 |
| 11 | Cloud TTS audioRef + stopAllSpeech | Complete — 2026-04-24 |
| 12 | British CDO Persona V7.0 (replaced Attenborough) | Complete — 2026-05-01 |
| 13 | Brevity Laws V7.0 (4-5 lines strict) | Complete — 2026-05-01 |
| 14 | Sales Intelligence Engine (Cost/Timeline logic) | Complete — 2026-05-01 |
| 15 | vps_delta_sync.py — full implementation | Complete — 2026-04-27 |
| 16 | PM2 Zombie Killer pre-flight checks | Complete — 2026-04-28 |
| 17 | Android TTS 15-second limit bypass (Chunked Queuing) | Complete — 2026-04-28 |
| 18 | Zone 25 renamed: Guest Cloud to Guest Marketing | Complete — 2026-04-29 |
| 19 | Immutable Login & Session History Ledger | Complete — 2026-04-29 |
| 20 | V7.5.3 Syntax Purge & Kernel Recovery | Complete — 2026-05-01 |
| 21 | DNS Architecture Documented & Recovery Protocol Written | Complete — 2026-05-02 |
| 22 | Sovereign UI Layout Protection & Fluid Squeeze Arch | Complete — 2026-05-02 |
| 23 | Sovereign Index Protocol Implemented (All Massive Files) | Complete — 2026-05-02 |
| 24 | Persona Exorcism (Attenborough Purged from Frontend) | Complete — 2026-05-02 |

---

## 10. STRICT SOVEREIGN UI CSS INTEGRITY LAWS (V10.0)

> **CRITICAL DIRECTIVE FOR ALL FUTURE DEVELOPERS / AGENTS:**
> The Sovereign UI is built on a "Fluid Squeeze" architecture (e.g., `grid-template-columns: 1.8fr 1fr;`) and uses `clamp()` for dynamic scaling. Any deviation from these laws will permanently damage the OS layout.

1. **NO GLOBAL ZOOM HACKS:** NEVER alter the `font-size` on `html, body` (e.g., `font-size: 70%` or `zoom: 0.8`). The OS relies on fluid CSS variables defined in `globals.css`.
2. **NO HARDCODED GRIDS:** NEVER use fixed pixel widths (like `340px`) for major layout columns. ALWAYS use fractional units (`fr`) so panels can fluidly "squeeze" and conform when the sidebar expands.
3. **NO STUCK SIDEBARS:** The `miracle-sidebar` MUST remain auto-hiding (hover-to-expand) via React state (`isHovered`), transitioning between `80px` and `280px`. Do not force a fixed `14.5rem` width.
4. **NO OVERFLOW HIDDEN ON CONTAINERS:** Do not trap the user with `overflow: hidden` on the main scrollable areas (`.pos-app-container`). If content overflows naturally, the user MUST be able to scroll to see bottom action buttons.
5. **MIN-WIDTH SQUEEZE:** Always ensure major flex/grid items have `min-width: 0` so they are allowed to shrink below their implicit content size. This is required for the fluid fractional columns to shrink properly.
6. **UI MEMORY BANK AUDIT:** Before any UI redesign or CSS overhaul, the agent MUST consult the architectural history in: `c:\Users\USER\.gemini\antigravity\brain\f61b6947-b597-4f56-92de-caea8439bf29\sovereign_ui_redesign.md.resolved`. This prevents the regression of critical mobile-first and fluid-scaling fixes.
7. **CSS BLOAT BAN:** Never append new styles to `globals.css`. Audit, merge, and de-duplicate existing rules.
8. **SAFE BUILD PROTOCOL:** Never delete the `.next` or `venv` directories on the production server before a new build is completed. This prevents 502 Bad Gateway outages.
9. **ASSET EXCLUSION LAW:** Massive binary files (APKs, ZIPs, Media) must be excluded from code sync scripts (`vps_delta_sync.py`) to prevent deployment timeouts and system paralysis.

---

## 11. SOVEREIGN INDEX PROTOCOL (THE IRON MAP)

> **MANDATORY LAW:** No agent shall edit a file exceeding 100 lines without first verifying or updating its Sovereign Index.

| File | Status | Index Points |
|:---|:---|:---|
| `globals.css` | **LOCKED** | 10-Point Architectural Roadmap |
| `bot_router.py` | **LOCKED** | 11-Point V1 Engine Index |
| `MiracleBot.tsx`| **LOCKED** | 14-Point Interaction Index |
| `layout.tsx` | PENDING | - |

**AUTHOR:** ANTIGRAVITY AI
**DATE:** 2026-05-02
**VERSION:** V6.5 -- Indexed & Hardened

---

## 12. SOVEREIGN SRE DASHBOARD (V25.0 — ACTIVE 2026-05-09)

> **CRITICAL MILESTONE:** The system has transitioned from autonomous "self-healing" to deterministic SRE monitoring.
> Zone 23 (Infrastructure) now serves as the central command center for technical diagnostics.

### Architecture: SRE Diagnostics

| Component | File | Responsibility |
|:---|:---|:---|
| **System Error Logs** | `SystemErrorLogs.tsx` | Aggregates stack traces and API exceptions for root-cause analysis |
| **Endpoint Matrix** | `EndpointPing.tsx` | Real-time monitoring of route connectivity and latency |
| **Process Control** | `PM2Override.tsx` | Direct lifecycle management for backend/frontend nodes |
| **Kinetic Logs** | `Infrastructure/page.tsx` | Live streaming of server stdout/stderr |

### New Endpoints (2026-05-11)
- `POST /api/infra/browser-error` -- Ingests client-side console errors into SRE pipeline.
- `GET /api/infra/logs` -- Fetches aggregated system error logs.
- `POST /api/infra/pm2/restart` -- Triggers PM2 process restarts via master PIN.
- `GET /api/infra/telemetry` -- Returns CPU/RAM/Disk health.

### Phase Status (V4 Navigator Cycle)

| Phase | Task | Status |
|:---|:---|:---:|
| 38 | Sovereign Navigator V4 (Interceptor Chain & Tag Priority) | Complete -- 2026-05-11 |
| 39 | Zone-Conditional Directives (Z-LOGIN Isolation) | Complete -- 2026-05-11 |
| 40 | Z-23 Browser Console Monitor (Telemetry Layer) | Complete -- 2026-05-11 |
| 25 | Sovereign AI Directive Kernel Index (V15-V16) | Complete -- 2026-05-05 |
| 26 | Engineering Directive V2.0 (Frontend/Backend/APK Laws) | Complete -- 2026-05-05 |
| 27 | Phonetic Lexicon (IN-HOUSE, AVAILABLE) | Complete -- 2026-05-05 |
| 28 | Android Voice Keep-Alive (7s mobile, 10s desktop) | Complete -- 2026-05-05 |
| 29 | Z-LOGIN Lead Capture (4-Field Funnel) | Complete -- 2026-05-05 |
| 30 | Anti-Hallucination Guard (Room locations blocked) | Complete -- 2026-05-05 |
| 31 | Pure SQL Delegation Protocol (Iron Law 26) | Complete -- 2026-05-09 |
| 32 | Z-23 SRE Pivot (Infrastructure Rebuild) | Complete -- 2026-05-09 |
| 33 | CDO Diagnostics Pipeline (Error Log Analysis) | Complete -- 2026-05-09 |
| 34 | API Endpoint Matrix (Live Ping) | Complete -- 2026-05-09 |
| 35 | Deterministic Analytical Reporting Engine | Complete -- 2026-05-09 |
| 36 | Legacy Immune/Audit Purge (Apoptosis V2) | Complete -- 2026-05-09 |
| 37 | System Architecture Document Synced (V25.0) | Complete -- 2026-05-09 |
| 41 | Accounting Department renamed to "Accounts & Finance" (UI + Kernel) | Complete -- 2026-05-13 |
| 42 | miracle_brain.ts integrated into MiracleBot.tsx (Layer 0 Local Brain) | Complete -- 2026-05-13 |
| 43 | GHOST 1 purged: gemini-2.5-flash banned from deprecated router | Complete -- 2026-05-13 |
| 44 | Directive V24.0 tail corruption repaired (zombie MTU text purged) | Complete -- 2026-05-13 |
| 45 | "Unified Sync Engine (Legacy)" renamed to "Delta Repair Module" | Complete -- 2026-05-13 |

**NEXT MILESTONE:** Monitor VPS production logs via Z-23. Establish automated DB backup triggers. Verify all business reporting uses the Pure SQL Delegation protocol.

---

## 13. WEB SERVER CONFIGURATION (SSL & PROXY IRON LAW)

> **CRITICAL SRE DIRECTIVE:** Browsers strictly block cross-origin requests (`ERR_CERT_AUTHORITY_INVALID`) if the backend SSL certificate is self-signed while the frontend uses a trusted Certificate Authority (e.g., Let's Encrypt).

### The Nginx Proxy Architecture
The Miracle OS VPS (`23.88.50.87`) utilizes an internal Nginx proxy to bypass SSL cross-origin restrictions entirely.

- **Frontend Domain:** `https://miracle.vigilantitsolution.com` (Secured via Let's Encrypt valid certificate)
- **Backend Domain:** `https://api.vigilantitsolution.com` (Self-Signed / Untrusted certificate)

### The API Routing Law (IRON LAW 32)
Because the `api.` subdomain lacks a trusted CA, the frontend **MUST NEVER** make direct API or WebSocket calls to `api.vigilantitsolution.com`.

Instead, Nginx on `miracle.vigilantitsolution.com` is configured with a reverse proxy for `/api` and `/ws` that points internally to the backend port (`http://127.0.0.1:8090`).

**Correct `.env` Frontend Configuration (Production):**
```env
NEXT_PUBLIC_API_URL="https://miracle.vigilantitsolution.com/api"
NEXT_PUBLIC_WS_URL="wss://miracle.vigilantitsolution.com/ws"
```
*Never use `127.0.0.1` or `api.vigilantitsolution.com` in the production frontend build. The `scripts/sovereign_deploy_all.py` script automatically enforces this injection during the Next.js build.*

---

## 14. DATABASE SCHEMA MIGRATION PROTOCOL (IRON LAW 33 / AUTO-HEALING V2)

> **CRITICAL SRE DIRECTIVE:** When new columns are added to SQLAlchemy models in Python, the production MySQL database does NOT automatically update via `create_all()`.

### The Problem
- Python/SQLAlchemy models define what the code *expects* to find in the DB.
- Without migration, the backend will return `500 Internal Server Error` with MySQL error `1054: Unknown column`.

### The Permanent Solution (Self-Healing Schema)
As of V66.0, Miracle OS implements **Automated Schema Surgery** on startup.
- You do NOT need to run manual `run_db_migration.py` scripts anymore.
- Instead, you **MUST** register any new columns in `backend_api/app/core/genesis.py` inside the `perform_database_surgery()` function.

**Template in `genesis.py`:**
```python
("table_name", "new_column_name", "ALTER TABLE table_name ADD COLUMN new_column_name VARCHAR(255);"),
```
When PM2 restarts (`python scripts/restart_backend_key.py`), the backend lifespan calls `run_genesis_sequence()`, which automatically detects missing columns and safely runs the `ALTER TABLE` injections before traffic is allowed.

**Known Auto-Healing Injections Performed:**
| Date | Tables Updated | Columns Added |
|------|----------------|---------------|
| 2026-05-11 | `miracle_knowledge` | `root_cause`, `correction`, `prevention_rule` |
| 2026-05-19 | `employees`, `strategic_directives`, `directive_nodes`, `vault_files` | (20+ Synapse Engine HR columns) |

---

## 15. Z-23 SYSTEM TELEMETRY KEY CONTRACT (IRON LAW 34)

> **CRITICAL:** The backend `/api/infra/telemetry` endpoint returns **flat keys**. The frontend MUST read these exact keys — never use nested structures.

### Backend Response Shape (from `infra.py`)
```json
{
  "status": "SUCCESS",
  "data": {
    "cpu_usage": 12.5,
    "memory_usage": 67.3,
    "storage_percent": 45.0,
    "storage_used": 18.0,
    "storage_total": 40.0,
    "network_out": 1024.5,
    "network_in": 2048.3,
    "uptime_days": 5,
    "uptime_hours": 3,
    "uptime_minutes": 22,
    "pillars": { ... }
  }
}
```

### Frontend Key Mapping (in `infrastructure/page.tsx`)
| UI Element | Correct Key | ❌ WRONG (Old Broken Keys) |
|------------|-------------|---------------------------|
| CPU Gauge | `telemetry?.cpu_usage` | ~~`telemetry?.cpu_percent`~~ |
| Memory Gauge | `telemetry?.memory_usage` | ~~`telemetry?.ram?.percent`~~ |
| Disk % | `telemetry?.storage_percent` | ~~`telemetry?.disk?.percent`~~ |
| Disk Used | `telemetry?.storage_used` | ~~`telemetry?.disk?.used`~~ |
| Network Sent | `telemetry?.network_out` | ~~`telemetry?.network?.sent_mb`~~ |
| Network Recv | `telemetry?.network_in` | ~~`telemetry?.network?.recv_mb`~~ |

*These wrong keys caused the CPU/Memory/Disk gauges to permanently display 0% despite the backend working correctly.*

---

## 16. NETWORK MTU FRAGMENTATION PROTOCOL (IRON LAW 37)

> **CRITICAL DEPLOYMENT SRE DIRECTIVE:** If SSH connections permanently hang at `expecting SSH2_MSG_KEX_ECDH_REPLY` (Key Exchange), it is due to a hard Path MTU Blackhole/Fragmentation drop on the Hetzner/Hostnin virtual network path when connecting from restricted ISPs (like Mobile Hotspots).

### The Root Cause
- Packets larger than ~1000 bytes (like standard SSH keys and certificates) are silently dropped by the Datacenter edge router without sending an ICMP Fragmentation Needed packet.
- This causes the `paramiko` or `ssh` client to hang indefinitely, breaking all deployment scripts (`vps_delta_sync.py`, `sovereign_deploy_all.py`, etc.).

### The Permanent Fix
1. The remote VPS interface MUST be configured to use a smaller MTU to prevent packet fragmentation.
2. A `systemd` startup service `mtu-fix.service` has been permanently installed on the VPS `23.88.50.87`.
3. It runs `ip link set dev eth0 mtu 1350` on every boot.

### The Rule for Future Agents
- **NEVER** assume the server is "down" or the password is "wrong" if SSH times out at KEX.
- If the MTU fix is somehow lost (e.g., OS reinstall), you **CANNOT** use `paramiko` or standard SSH to fix it. You MUST deploy the `ultimate_proxy.py` script locally to artificially clamp the TCP `SO_RCVBUF` to 512 bytes, restricting the remote server's window size and forcing the SSH handshake to fit through the blackhole.
- Always verify `Test-NetConnection 23.88.50.87 -Port 22` first. If TCP connects but SSH hangs, the MTU Blackhole has returned.

---

## 17. @sovereign new feature: CINEPLEX MULTIMEDIA ENGINE (2026-05-15)
> **ARCHITECTURE:** 
> - **Guest Hub Integration:** The `MiracleCinema.tsx` is accessed directly via `/guest/cinema` from the Guest Hub "Entertainment" section.
> - **Netflix Pro UI:** The UI is driven by a `3D Auto-rotating Cube` for featured items, horizontally scrollable Premiere Rows (Netflix card style), In-House Categories (Free), and Live TV networks.
> - **Aesthetic:** Pulse neon glow LED style, cinematic spacing, auto-preview playback on hover (with 800ms delay).
> - **Admin Control:** Zone 25 (Guest Marketing) > MIRACLE CINEMA tab. This tab is explicitly sorted to the front of the dashboard with neon button styles.
> - **Live Channels:** Hardcoded streaming arrays inside the UI component since they don't change often.
> - **Deployment:** Update backend (`python scripts/sovereign_patient_deploy.py backend`) when Movie Vault models change, but UI changes need frontend (`python scripts/sovereign_patient_deploy.py frontend`).

---

## 18. @sovereign new feature: ZONE 20 SYNAPSE NEXUS -- CORPORATE HIERARCHY PROTOCOL (2026-05-17)

> **ARCHITECTURE:**
> This is the Miracle OS internal corporate communications and task management platform.
> It enforces strict hierarchical communication barriers, preventing chain-of-command bypasses.

### Hierarchy Tier Weights (Source of Truth: `executive_tier` in HR Onboarding)

| Tier Weight | executive_tier DB Value | Assigned To | Communication Rights |
|---|---|---|---|
| **4** | `C-SUITE` or `BOARD` | CDO, GM | Can initiate DM to any tier. Top-down bridge auto-tags manager. |
| **3** | `DIRECTOR` | Directors | DM Tier 4, 3, 2. Cannot skip to Tier 1 without Bridge. |
| **2** | `MANAGER` | Managers | DM Tier 3, 2, 1 (immediate reports only). |
| **1** | `OPERATIVE` | All staff | DM peers (Tier 1) and immediate boss (Tier 2) only. |

### The Gatekeeper Formula
```python
delta = initiator.tier_weight - target.tier_weight
if delta >= 0 OR delta == -1: ALLOW_DIRECT_MESSAGE
else: REQUIRE_BRIDGE_PROTOCOL  # Block and offer Bridge Request
```

### The Bridge Protocol
- If Tier 1 (Operative) tries to message Tier 3+ (Director/CDO): **BLOCKED**.
  The UI shows a `Request Bridge` button which creates a 3-way thread tagging the immediate Manager.
- If Tier 4 (CDO) messages Tier 1 directly: The system **auto-tags** the relevant Manager as a CC participant.

### Key Files
- **Frontend:** `web/app/dashboard/synapse/page.tsx` (Zone 20 UI)
- **Backend:** `backend_api/app/routers/synapse_nexus.py` (Gatekeeper + Chat + Org-Chart API)
- **WebSocket Chat:** `wss://miracle.vigilantitsolution.com/ws/synapse/chat/{thread_id}`
- **DB Models:** `SynapseThread`, `SynapseMessage` (in `models.py`)

### Auto-Sync Rule
The moment HR changes an operative's `executive_tier`, their Zone 20 communication clearance upgrades automatically. No manual configuration required.

### The Miracle AI Alignment (Bot Knowledge)
The Miracle AI bot must know:
- "Zone 20 is the corporate messenger. Cross-tier communication is gated."
- "To message a skip-level superior, staff must request a Bridge via their Manager."
- "A CDO messaging any operative automatically includes that operative's Manager in the thread."


---
### 🚨 CRITICAL DEPLOYMENT DIRECTIVES: ANDROID GUEST APK (LESSONS LEARNED)
If you are developing, building, or deploying the Guest Android APK, you MUST adhere to the following laws discovered during production failures:

1. **CSS/UI BUILD REQUIREMENT**:
   - Running sovereign_patient_deploy.py frontend does NOT update the APK. The Android App bundles web assets natively. 
   - To apply CSS/UI changes to the APK, you MUST rebuild the native wrapper:
     `powershell
     $env:CAPACITOR_BUILD="true"; cd web; npm run build; npx cap sync android; cd android; .\gradlew assembleDebug
     `
   - Then copy it to web/public/miracle_guest.apk.

2. **VPS SFTP TIMEOUT (CHUNKED UPLOAD REQUIRED)**:
   - The Hetzner VPS SSH daemon forcibly drops single-file transfers >280MB (Error 10054).
   - NEVER upload the 600MB-800MB+ APK using standard SFTP or sovereign_patient_deploy.py.
   - ALWAYS use python scripts/upload_apk.py, which is specifically engineered to split the APK into 45MB chunks, upload via fresh SSH streams, and reassemble on the VPS via cat.

3. **SSH AUTHENTICATION BLACKHOLE**:
   - The VPS aggressively rejects password-based authentication for large or repeated chunk transfers.
   - Any custom deployment script MUST use paramiko Key loaders (paramiko.Ed25519Key, RSAKey, etc.) pointing to ~/.ssh/miracle_os_key. Password fallback will fail.

4. **WINDOWS CONSOLE ENCODING CRASH**:
   - NEVER use Unicode emojis (e.g., ✓, ✗) in Python print() statements running on the Windows console (cp1252). It causes a fatal UnicodeEncodeError. Use [OK] and [ERR] instead.

5. **FONT PRELOAD BUILD CRASH**:
   - In isolated production deployments, 
ext/font/google preloading can cause severe build crashes due to network timeouts. ALWAYS set preload: false on fonts in layout.tsx.
---

---
### 🚨 THIN CLIENT ARCHITECTURE (CAPACITOR WEB APP SHELL)
1. **NEVER BUNDLE THE NEXT.JS BUILD (out FOLDER)**:
   - Compiling the entire 800MB+ out static folder into the Android APK makes it massive, slow, and causes "Client-Side Exceptions" due to localhost routing issues within the Capacitor WebView.
2. **USE THE LIVE SERVER URL**:
   - The APK must act purely as a native Web App Shell pointing to the live server.
   - In capacitor.config.ts, server.url MUST be set to https://miracle.vigilantitsolution.com/guest.
3. **NEVER REBUILD FOR UI FIXES**:
   - Because the APK loads the live production server, you NEVER need to rebuild or re-deploy the APK to fix UI or CSS bugs.
   - Just deploy the Next.js frontend to the VPS normally (sovereign_patient_deploy.py). The APK will instantly reflect all changes globally upon launch without requiring an app update.
---

## 19. @sovereign new feature: THE ARCHITECT ZONES (2026-05-24)
> **ARCHITECTURE:**
> - **Centralized POS:** Zone 16 (POS) is now the ONLY authorized POS system in the entire OS. Dummy POS systems in departments have been completely stripped.
> - **The Architects:** Zones 26 (Fleet), 27 (Wellness), 28 (Boutiques), and 29 (Gastronomy) are now dedicated Architect Engines.
> - **BOM Creation:** Department Heads use the `ServiceArchitectBOM` component to pull raw Vault Inventory (Zone 12) and compile services/products with calculated COGS and Profit Margins.
> - **Wastage Log:** The `WastageAuditLog` securely tracks discarded/damaged items back to the Zone 11 Audit Ledger.


---

## 20. @sovereign new feature: AGI CoA INTELLIGENCE ENGINE (2026-06-05)
> **ZONE:** Z-11B -- Accounting AGI | **PATH:** /dashboard/agi-accounts
> **BACKEND:** ackend_api/app/routers/agi_coa_engine.py
> **FRONTEND:** web/app/dashboard/agi-accounts/page.tsx

### Architecture: Self-Expanding Chart of Accounts
The AGI CoA Engine is a 10-sub-engine sovereign accounting system that auto-classifies transactions via 62 deterministic pattern rules (zero LLM hallucination). Accounts auto-create when a new pattern is encountered, making the CoA self-expanding.

| Engine ID | Sub-Engine | Endpoint |
|---|---|---|
| 01 | Classification Engine | /agi/classify |
| 02 | Journal Post Engine | /agi/post |
| 03 | Tax & SC Split Engine | /agi/tax/calculate-and-post |
| 04 | Payroll Engine | /agi/payroll/post |
| 05 | FX Multi-Currency | /agi/fx/convert |
| 06 | Depreciation Engine | /agi/depreciation/run |
| 07 | Inter-Property Engine | /agi/inter-property/post |
| 08 | Fraud Detection Engine | /agi/fraud/scan |
| 09 | Period Close Engine | /agi/period/close-snapshot |
| 10 | Audit Export Engine | /agi/audit/export |

### ANTI-HALLUCINATION CONTRACT
- **62 deterministic regex rules** -- no LLM used for classification
- UI default tab = CLASSIFY (dry run) -- NOT POST
- POST requires explicit ARMED toggle + confirmation modal showing Dr/Cr
- All financial amounts are user-entered -- no AI-generated figures
- Auto-created accounts are logged and auditable

### Key Files
- **Backend:** ackend_api/app/routers/agi_coa_engine.py
- **Frontend:** web/app/dashboard/agi-accounts/page.tsx
- **Kernel Registration:** web/app/kernel.ts (Zone Z-11B, ACC + CDO permissions)
- **Router Registration:** ackend_api/app/main.py (/api/accounting)

### PERMISSIONS
| Role | Access |
|---|---|
| CDO, GM, ADMIN, ACC | Full read + write (ARMED mode) |
| VISITOR | BLOCKED (no visitor access to AGI posting) |

---

---

## 21. @sovereign new feature: FINANCIAL INTELLIGENCE WAR ROOM — Z-11C (2026-06-05)
> **ZONE:** Z-11C — Financial Intel | **PATH:** /dashboard/sovereign-finance
> **BACKEND ENGINES:** 4 new Rothschild-tier engines appended to gi_coa_engine.py
> **FRONTEND:** web/app/dashboard/sovereign-finance/page.tsx

### Architecture: The 4 Rothschild Engines

| Engine | Endpoint | Data Sources |
|---|---|---|
| 11: Benford Auditor | GET /agi/benford/scan | LedgerLine.debit — all posted journals |
| 12: Treasury Radar | GET /agi/treasury/radar | Reservation, APInvoice, Employee.base_salary |
| 13: Live Journal Feed | GET /agi/journals/live-feed | JournalEntry + LedgerLine + Account |
| 14: AP/AR Intelligence | GET /agi/treasury/ap-ar | APInvoice + ARReceivable + GuestFolio.balance |

### UI Panels (Bloomberg-terminal layout)

| Panel | Engine | Description |
|---|---|---|
| BENFORD ANOMALY RADAR | Engine 11 | 9-bar CSS chart, actual vs Benford expected, chi-sq score |
| 90-DAY LIQUIDITY PROJECTION | Engine 12 | Weekly inflow/outflow grouped bars, health badge |
| LIVE JOURNAL STREAM | Engine 13 | Real-time scrolling feed, Dr/Cr resolution, balance integrity |
| AP/AR INTELLIGENCE MATRIX | Engine 14 | Aging buckets, overdue flags, net working capital |

### Futuristic CSS (Section 12, globals.css)
- .fin-intel-bg — animated gold cyber-grid background (scrolling 40px grid)
- .fin-scan-line — gold neon scanning line (loading state)
- .live-entry — feed entry slide-in animation with stagger delay
- .benford-bar-fill — scaleY reveal animation for Benford bars
- .anomaly-strobe — red pulsing glow for CRITICAL Benford state
- .treasury-bar-inflow/.outflow — width grow animations for weekly bars

### PERMISSIONS
| Role | Access |
|---|---|
| CDO, GM, ADMIN, ACC | Full read access to all 4 intelligence panels |
| VISITOR | BLOCKED |

---

## 22. @sovereign new feature: ADVANCED ROTHSCHILD PMS & MOBILE OWNER APP — Z-30 (2026-06-14)
> **ZONE:** Z-30 — Property Owner Mobile App | **PATH:** /owner
> **BACKEND:** backend_api/app/routers/pms.py, app/models/models.py
> **FRONTEND:** web/app/owner/layout.tsx, web/app/owner/page.tsx, web/app/owner/hub/page.tsx, web/app/owner/payouts/page.tsx, web/app/owner/mortgage/page.tsx, web/app/owner/pools/page.tsx, web/app/owner/components/OwnerAiButler.tsx

### Architecture: Advanced PMS & Mobile Portal

| Component | Database Model / Endpoint | Description |
|---|---|---|
| Covenant Contracts | PMSPropertyContract | Digitally signs lease agreements, rental pool deeds, and mortgage notes with HTML5 drawing canvas signatures and SHA-256 hashes. |
| Direct Debit Mandates | PMSDirectDebitAuth | Captures SEPA/ACH debit mandate tokens via Stripe to auto-pull mortgage sweep deficits. |
| Repair Invoices | PMSRepairInvoice | Charges property repair costs resolved from SolveMission maintenance tickets directly back to owner balances. |
| AGI Chatbot Panel | POST /api/pms/owner/bot/query | Full-screen Gemini-styled chatbot screen that parses custom json_chart blocks to render interactive Recharts graphs in real time. |

### Synced Departments & Workflows

| Department | Zone | Flow Description |
|---|---|---|
| Z-17 SolveMissions | Z-17 | Housekeeping & Maintenance tasks that are resolved trigger repair charge entries into `PMSRepairInvoice` with VAT calculations. |
| Z-18 Double-Entry Ledger | Z-18 | Payout approvals debit yield balances and post journal entries (`521300` Owner Disbursement Expense, `113300` Yield Payable, `440100` Management Fee). Mortgage sweeps net payments from owner ledger balances. |
| Z-12 Master Inventory | Z-12 | Repair operations check raw materials usage and deduct them from the inventory vault. |

### PERMISSIONS
| Role | Access |
|---|---|
| OWNER | Access to their own portfolio, yields, payouts, contracts, debit mandates, and AGI chat butler. |
| CDO, GM, ADMIN, ACC | Admin oversight via operator dashboards. |

---


## 23. @sovereign new feature: PROPERTY OWNER BRIDGE — Z-31 (2026-06-16)
> **ZONE:** Z-31 - Property Owner Bridge (Public Listing Portal to Admin Approval Pipeline)
> **BACKEND:** ackend_api/app/routers/properties_marketplace.py, ackend_api/app/models/models.py
> **FRONTEND (Public):** web/app/properties/page.tsx - 3-step Owner Bridge modal
> **FRONTEND (Admin):** web/app/dashboard/pms/page.tsx - Owner Requests tab (Bridge Pipeline)

### Architecture

The **Owner Bridge** is the sovereign intake engine for property onboarding. A property owner submits
their asset via the public marketplace. The **RealEstatePolicyEngine** computes three deal proposals
instantly. The owner selects a deal. An admin reviews, overrides if needed, and approves -- atomically
creating an asset_grid row, owner profile, GL journal, and payout request.

#### Database Model: property_requests

| Column | Type | Description |
|---|---|---|
| 
ef_code | VARCHAR | Auto-generated unique ref e.g. ZP-2026-XXXX |
| status | ENUM | PENDING -> OWNER_APPROVED -> DISBURSEMENT_APPROVED -> COMPLETED |
| ull_name, email, phone, 
id_passport | VARCHAR | Owner identity |
| property_title, sset_type, property_country | VARCHAR | Property spec |
| input_currency, estimated_value | VARCHAR/FLOAT | Owner stated value |
| jv_valuation_usd | FLOAT | Engine-computed USD valuation |
| jv_owner_share_pct, jv_owner_annual_yield, jv_roi_months | FLOAT | JV deal figures |
| lease_signing_bonus_usd, lease_monthly_rent_usd, lease_term_years | FLOAT | Lease figures |
| pool_udi_pct, pool_projected_monthly_usd, pool_net_annual_usd | FLOAT | Pool figures |
| selected_deal | VARCHAR | JV, LEASE, or RENTAL_POOL |
| dmin_override_valuation | FLOAT | Admin override - re-triggers engine on PATCH |
| 
egistered_room_id | VARCHAR | Set on admin approval (links to asset_grid) |
| payout_request_id | INT | FK to PMSOwnerPayoutRequest after approval |

#### RealEstatePolicyEngine Iron Laws

- All inputs normalised to USD via 6-region rate table (Iron Law: always USD output)
- JV: equity share from sqft + encumbrance + country cap rates
- Lease: monthly = 6.5% annual yield / 12, signing bonus = 2 months
- Rental Pool: UDI share = property_usd / total_pool x 100
- Duplicate Detection: blocks same full_name + property_title with active status
- Migration: scripts/migrate_property_requests.py (idempotent)

#### Public API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/properties/request/submit | Submit + compute 3 deal proposals |
| GET | /api/properties/request/{id} | Get request detail |
| POST | /api/properties/request/{id}/select-deal | Owner selects deal |

#### Admin API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/properties/request/admin/list | Paginated list + status filter |
| GET | /api/properties/request/admin/stats | Pipeline counts by status |
| PATCH | /api/properties/request/admin/{id} | Override valuation + notes |
| POST | /api/properties/request/admin/{id}/approve | Atomic: asset_grid + GL + payout |
| POST | /api/properties/request/admin/{id}/simulate-contact | EMAIL/CALL/WHATSAPP simulation |

#### Approval Atom (Z-31 Iron Law)
On admin approval 4 operations execute atomically:
1. asset_grid INSERT via db.execute(text(...)) -- Z-30 pattern
2. PMSOwnerProfile UPSERT linked to new room
3. GL Journal: DR 132000 Property Asset / CR 315100 Owner Equity Payable
4. PMSOwnerPayoutRequest for signing bonus / first yield

#### UI: Public 3-Step Owner Bridge Modal
Step 1 - Your Identity: full name, email, phone, NID/Passport, address
Step 2 - Property Specification: title, asset type, country, dimensions, financials, mortgage toggle
Step 3 - Deal Proposals: 3 colour-coded cards (JV/Lease/Pool). Owner clicks Select ->
  status OWNER_APPROVED. Confirmed with ref code + WhatsApp link.
Trigger Points: Nav button, Hero CTA, bottom sell-CTA section.

#### UI: Admin Owner Requests Tab (PMS Dashboard)
- Left Panel: Filterable request grid (by status). Amber highlight on selected row.
- Right Panel: Identity card, 3 engine proposal sub-panels, admin override form,
  status-conditional approve button, simulate contact output.
- Tab: PMS sidebar -> Owner Requests (sub-label: Bridge Pipeline)

#### PERMISSIONS
| Role | Access |
|---|---|
| Public | Submit property + select deal (no login required) |
| ADMIN, CDO, GM | Full Owner Requests tab in PMS Dashboard |

#### Migration
`ash
python scripts/migrate_property_requests.py
`

---

## 24. @sovereign new feature: FOOD & BEVERAGE INTEGRATION — Z-KDS, Z-MENU, Z-DELIVERY (2026-06-22)
> **ZONE:** Z-KDS (Kitchen Display System), Z-MENU (Guest QR Table Menu), Z-DELIVERY (Rider Delivery Portal)
> **BACKEND:** `backend_api/app/routers/fnb_orders_router.py`, `backend_api/app/routers/delivery_router.py`
> **FRONTEND (KDS):** [orders/page.tsx](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/web/app/dashboard/orders/page.tsx) - Real-time Kanban board
> **FRONTEND (QR Menu):** [menu/page.tsx](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/web/app/menu/page.tsx) - Public guest self-service table ordering
> **FRONTEND (Delivery):** [delivery/page.tsx](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/web/app/delivery/page.tsx) - Rider PIN login & active dispatch view

### Architecture

The **F&B Integration** creates an autonomous, zero-latency transaction cycle from guest table ordering to kitchen production and rider dispatch. When a guest scans a QR code at their table, they place an order which appears instantly on the Kitchen Display System (Z-KDS) and notifies the staff with an auditory alert. Chefs bump the order status to prepare and finalize the dishes, automatically triggering inventory reductions. Once ready, orders can be dispatched to delivery riders who track locations and liabilities via PIN-secured portals.

#### Database Models: fnb_orders, delivery_riders, delivery_orders, rider_wallets

##### fnb_orders table:
- `id` (UUID PK)
- `table_label` (e.g. Table 7)
- `guest_name` (Optional string)
- `status` (PENDING → PREPARING → READY → DELIVERED → CANCELLED)
- `items_json` (JSON list of ordered items with quantities and prices)
- `special_note` (Special instructions text)
- `subtotal` (Float order amount)
- `device_id` (Tracks ordering client device)

##### delivery_riders table:
- `id` (UUID PK)
- `full_name` (Rider name)
- `phone` (Rider phone - unique)
- `pin` (Rider login PIN)
- `is_active` / `is_suspended` (Status boolean flags)
- `vehicle_type` (BIKE | CAR | BICYCLE)

##### delivery_orders table:
- `id` (UUID PK)
- `fnb_order_id` (Link to source order)
- `customer_name` / `customer_phone` / `delivery_address` (Delivery details)
- `status` (PENDING → ASSIGNED → PICKED_UP → EN_ROUTE → DELIVERED → FAILED)
- `rider_id` (FK to delivery_riders)
- `cod_settled` (Cash collected settlement flag)

##### rider_wallets table:
- `rider_id` (FK to delivery_riders - unique)
- `cash_held` / `cash_limit` (CoD cash tracking & auto-suspend limit threshold)

#### Real-Time SSE Broadcasters (Zero-Polling)
- F&B order changes are broadcast on `GET /api/fnb/events`.
- Rider dispatch status changes are broadcast on `GET /api/delivery/events`.
- Listeners on the frontend receive server-sent updates instantly, ensuring zero-latency coordination between customers, chefs, managers, and riders.

#### UI: Z-KDS Kanban Board (/dashboard/orders)
- Displays orders in visual columns: PENDING (amber), PREPARING (blue), READY (green).
- Ticking timer clocks display elapsed cook-times: cyan (<5 min), amber (<10 min), red (>10 min).
- Auditory chime plays automatically upon receipt of new orders via SSE.
- Chef "BUMP" button advances order status and calls inventory COGS calculations.

#### UI: Z-MENU QR Ordering (/menu)
- Publicly accessible page with table binding via URL query parameters (e.g., `?table=Table+7`).
- Mobile-first, responsive shopping cart interface with category filters and item notes.

#### UI: Z-DELIVERY Rider Portal (/delivery)
- Simple PIN lock screen for quick rider authentication.
- Claimed deliveries list with one-tap status transition buttons.
- Real-time location sync and warning indicators for cash overdraft limits.

#### PERMISSIONS
| Role | Access |
|---|---|
| Public | Access QR Menu (`Z-MENU`) to place orders (no login needed) |
| CHEF, FB, STAFF, CDO, GM, ADMIN | Access KDS (`Z-KDS`) to view and bump orders |
| RIDER | Access Rider Portal (`Z-DELIVERY`) via PIN auth |
| CDO, GM, ADMIN, FB | Full dispatcher control panel & rider wallet settlement |

---

## 25. SOVEREIGN UPGRADE: F&B INTELLIGENCE ENGINE — Z-29-INTEL (2026-06-22)

> **UPGRADE TYPE:** 3-Tier Enterprise Intelligence Layer (Iron Law 73 Compliant)
> **BUILD DATE:** 2026-06-22
> **VERSION:** V1.0-FNB-INTEL

This upgrade transforms the F&B system from a reactive order-processing pipeline into a **predictive, AI-driven enterprise intelligence ecosystem**. The upgrade targets all three tiers simultaneously and introduces 8 new capabilities.

### 3-Tier Architecture Map

| Tier | Role | New Additions |
|------|------|---------------|
| **Tier 1** | Guest UI (`/menu`) | Dynamic sold-out greyout, guest loyalty banner, pre-order mode |
| **Tier 2** | Admin Zones (Z-29, Z-KDS) | 6 new admin tabs + 2 new sub-routes + KDS pre-order panel |
| **Tier 3** | Backend (`fnb_orders_router.py`, `inventory_engine.py`) | 8 new API endpoints + 1 new DB model + BOM auto-deduction |

---

### New API Endpoints (Tier 3)

| Endpoint | Method | Feature | Description |
|----------|--------|---------|-------------|
| `/api/inventory/availability` | GET | F1-A | Live menu availability based on stock vs min_level |
| `/api/fnb/inventory-alerts` | GET | F2-A | Predictive stock depletion alerts (hours_until_zero < 4) |
| `/api/fnb/margin-alerts` | GET | F2-B | COGS margin erosion alerts (live BOM cost vs selling price) |
| `/api/fnb/analytics` | GET | F3-B | Revenue, velocity, peak-hour analytics (7/14/30 day window) |
| `/api/fnb/procurement-alerts` | GET | F3-D | Items at or below min_level with auto-draft reorder quantities |
| `/api/fnb/pre-orders` | POST | F3-A | Create a pre-order linked to a PMS reservation |
| `/api/fnb/pre-orders` | GET | F3-A | List upcoming pre-orders sorted by arrival_time |
| `/api/fnb/pre-orders/{id}/activate` | PUT | F3-A | Convert pre-order to live FnbOrder in kitchen |
| `/api/fnb/pre-orders/{id}` | DELETE | F3-A | Cancel pre-order (soft delete, Iron Law 66) |

### Modified Endpoints (Tier 3)

| Endpoint | Change | Feature |
|----------|--------|---------|
| `PUT /api/fnb/orders/{id}/status` | BOM deduction fires when status → READY | F1-B |
| `POST /api/fnb/orders` | Accepts `guest_profile_id` field | F3-C |

### New DB Models (Tier 3)

#### FnbPreOrder table:
- `id` (UUID PK)
- `reservation_id` (String 64, nullable — links to PMS)
- `guest_name` (String 128)
- `table_label` (String 32)
- `items_json` (Text — same format as FnbOrder)
- `special_note` (Text, nullable)
- `subtotal` (Float)
- `status` (Enum: UPCOMING | ACTIVATED | CANCELLED)
- `arrival_time` (DateTime, nullable — expected arrival)
- `created_at` (DateTime)

#### FnbOrder updates:
- Added `guest_profile_id` (String 64, nullable — links to CRM guest profile)

---

### New Admin Zones (Tier 2)

| Zone | Path | Feature | Access |
|------|------|---------|--------|
| **Z-29-STOCK** | `/dashboard/z29-gastronomy` (tab) | Stock Depletion Alerts | CDO/GM/ADMIN/FB |
| **Z-29-MARGIN** | `/dashboard/z29-gastronomy` (tab) | COGS Margin Monitor | CDO/GM/ADMIN/ACC |
| **Z-29-WASTE** | `/dashboard/z29-gastronomy` (tab) | Waste & Spoilage Log UI | CDO/GM/ADMIN/FB |
| **Z-29-ANALYTICS** | `/dashboard/z29-gastronomy/analytics` | Full F&B Intelligence Dashboard | CDO/GM/ADMIN |
| **Z-29-PREORDERS** | `/dashboard/z29-gastronomy/pre-orders` | Pre-Order Management (reservation link) | CDO/GM/ADMIN/FB/CHEF |
| **Z-29-PROCUREMENT** | `/dashboard/z29-gastronomy` (tab) | Auto-Procurement Alert + Draft PO | CDO/GM/ADMIN/ACC |

### Tier 1 Enhancements (Guest UI)

| Feature | URL | Trigger |
|---------|-----|---------|
| **Dynamic Availability** | `/menu` | Items greyed-out when stock ≤ min_level |
| **Guest Loyalty Banner** | `/menu?guest_id=X&guest_name=Y` | Welcome back banner, profile linked to order |
| **Pre-Order Mode** | `/menu?reservation_id=X` | Changes order submission to pre-order endpoint |

---

### Key Architectural Decisions

1. **BOM Deduction moved to KDS READY bump** (previously at POS cashier). This ensures stock accuracy reflects kitchen reality, not billing timing.
2. **Pre-orders use a separate `FnbPreOrder` model** to avoid polluting the live `fnb_orders` table. Activation converts it to a live order atomically.
3. **Analytics aggregation is pure DB query** — no external BI services. Derived from `fnb_orders` table using SQLAlchemy text queries.
4. **Wastage UI** wraps the existing `POST /inventory/wastage` endpoint (Iron Law 66 compliant). No new schema required.
5. **All alert endpoints are read-only** — no state mutations on alert fetch. Mutations only on explicit user action.

---
