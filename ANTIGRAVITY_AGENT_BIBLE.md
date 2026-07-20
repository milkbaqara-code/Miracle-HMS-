# 🔱 THE ANTIGRAVITY AGENT BIBLE & SOVEREIGN KNOWLEDGE BANK (V2.0)
> **Master Directive Date:** 2026-06-30 | **Target Ecosystem:** Miracle OS, Miracle HMS, Miracle POS & Vigilant Website
> **Purpose:** A self-contained, portable knowledge bank and rule repository for any AI model, developer, or system auditor. Ingesting this document guarantees 100% alignment with system architecture, deployment protocols, and operational guardrails.

---

## 🏛️ SECTION 1: ARCHITECTURAL SYSTEMS MAP
This repository manages **FIVE separate systems** sharing a Hetzner VPS (23.88.50.87). They must NEVER be confused — each has its own backend, database, frontend, and nginx config.

### System 1: Miracle OS (Enterprise ERP & PMS SaaS)
* **Domain:** `https://miracle.vigilantitsolution.com`
* **Local Path:** `d:\Vigilant IT Solutions\Miracle_Os_Master\web\` (frontend) & `\backend_api\` (backend)
* **Remote Path:** `/home/vigilantitsolution-miracle/htdocs/miracle.vigilantitsolution.com`
* **VPS Backend Port:** `8090` (FastAPI — OWNED BY MIRACLE OS FOREVER) | **Local Dev Port:** `8090`
* **VPS Frontend Port:** `3000` (Next.js — OWNED BY MIRACLE OS FOREVER) | **Local Dev Port:** `3000`
* **PM2 Processes:** `miracle-frontend` (Port 3000) & `miracle-backend` (Port 8090)
* **Database:** `miracle_os_master.db` — hotel/hospitality data (LTR rooms, RESIDENCES etc.)
* **Main UI Entry point:** [web/app/components/MiracleBot.tsx](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/web/app/components/MiracleBot.tsx)

### System 2: Vigilant Website (Corporate Marketing Site)
* **Domain:** `https://www.vigilantitsolution.com`
* **Local Path:** `d:\Vigilant IT Solutions\Miracle_Os_Master\vigilant_website\`
* **Remote Path:** `/home/vigilantitsolution-www/htdocs/vigilantitsolution.com`
* **VPS Frontend Port:** `3001` (Next.js — OWNED BY VIGILANT WEBSITE FOREVER) | **Local Dev Port:** `3001`
* **PM2 Process:** `vigilant-website`

### System 3: Miracle HMS (Hospital Management System)
* **Domain:** `https://hms.vigilantitsolution.com`
* **Local Path:** `d:\Vigilant IT Solutions\Miracle_HMS\web\` (frontend) & `\backend_api\` (backend)
* **Remote Root:** `/home/vigilantitsolution-hms/htdocs/hms.vigilantitsolution.com/`
* **VPS Backend Port:** `8095` (FastAPI — OWNED BY MIRACLE HMS FOREVER) | **Local Dev Port:** `8095`
* **VPS Frontend Port:** `3002` (Next.js — OWNED BY MIRACLE HMS FOREVER) | **Local Dev Port:** `3002`
* **PM2 Processes:** `miracle-hms-backend` (Port 8095) & `miracle-hms-frontend` (Port 3002) & `miracle-hms-sentinel`
* **Database:** `miracle_hms_master.db` — hospital data (WARD/ICU/CABIN/ER/OT beds)
* **HMS Backend Startup (IRON LAW — NEVER CHANGE):**
  ```bash
  cd /home/vigilantitsolution-hms/htdocs/hms.vigilantitsolution.com/backend_api
  PYTHONPATH=/home/vigilantitsolution-hms/htdocs/hms.vigilantitsolution.com/backend_api
  .venv/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8095
  ```
  Start script: `start_hms_backend.sh` in REMOTE_ROOT

### System 4: Miracle POS (Point of Sale)
* **Domain:** `https://pos-app.vigilantitsolution.com`
* **Local Path:** `d:\Miracle POS\` (frontend)
* **Remote Path:** `/home/vigilantitsolution-pos/htdocs/pos-app.vigilantitsolution.com/`
* **VPS Frontend Port:** `3005` (Next.js — OWNED BY MIRACLE POS FOREVER) | **Local Dev Port:** `3005`
* **PM2 Process:** `miracle-pos` (Port 3005)

### System 5: Miracle Web Builder (Editor Tool)
* **Domain:** Local development only (`http://localhost:3003`)
* **Local Path:** `d:\Vigilant IT Solutions\Miracle Web Builder\`
* **Local Dev Port:** `3003` (Next.js — OWNED BY MIRACLE WEB BUILDER FOREVER)
* **Nginx Target:** N/A (Not hosted on production VPS)

---

## 🔴 SECTION 1B: FROZEN PORT MAP — IRON LAW 74 (NEVER CHANGE)

> **If you violate this port map, one system will silently serve another system's data.**
> This happened on 2026-06-30: HMS showed hotel room data because nginx pointed HMS to port 8091 (Miracle OS worker).

| PORT | PM2 NAME / TOOL | SYSTEM / SERVICE | NGINX TARGET | LOCAL DEV PORT |
|------|-----------------|------------------|--------------|----------------|
| **8090** | `miracle-backend` | Miracle OS FastAPI | `api.vigilantitsolution.com` | `8090` |
| **8091** | `ops-sentinel` | Miracle OS Worker | **INTERNAL ONLY** | `8091` |
| **8095** | `miracle-hms-backend` | HMS FastAPI | `hms.vigilantitsolution.com/api/` | `8095` |
| **3000** | `miracle-frontend` | Miracle OS UI | `miracle.vigilantitsolution.com` | `3000` |
| **3001** | `vigilant-website` | Marketing Site | `www.vigilantitsolution.com` | `3001` |
| **3002** | `miracle-hms-frontend` | HMS UI | `hms.vigilantitsolution.com` | `3002` |
| **3003** | *Local dev server* | Miracle Web Builder | **LOCAL ONLY** | `3003` |
| **3005** | `miracle-pos` | POS UI | `pos-app.vigilantitsolution.com` | `3005` |

**🔴 PORT 8091 IS OWNED BY MIRACLE OS. NEVER ASSIGN HMS TO 8091.**

**🔴 HMS DIAGNOSIS RULE:** If `hms.vigilantitsolution.com` shows hotel rooms (LTR-01, RESIDENCES, CRUISE, SUITES, VILLAS) — nginx is routing `/api/` to wrong port (8090/8091). Fix: Check `/etc/nginx/sites-enabled/hms.vigilantitsolution.com.conf` → `proxy_pass` must be `127.0.0.1:8095`.

**Database Ownership (CROSS-CONTAMINATION FORBIDDEN):**
| Database | System | Content |
|----------|--------|---------|
| `miracle_os_master.db` | Miracle OS | Hotel rooms, LTR assets, RESIDENCES |
| `miracle_hms_master.db` | Miracle HMS | Hospital: WARD/ICU/CABIN/ER/OT |
| *(no separate DB yet)* | Miracle POS | POS transactions |

---

## 🚀 SECTION 2: DEPLOYMENT DIRECTIVES

### 🛠️ Miracle OS Deployment Rules
1. **BUILD LOCALLY ON WINDOWS:** Next.js for Miracle OS MUST be built locally first to ensure consistent asset hashing:
   ```powershell
   cd web
   npm run build
   ```
2. **USE PATIENT DEPLOY ONLY:** NEVER attempt to upload the entire `.next` folder in a single zip/tar archive via standard SFTP. The Hetzner VPS firewall drops connections for large file uploads. You MUST run the custom file-by-file upload script:
   ```powershell
   python scripts/sovereign_patient_deploy.py all
   ```
   * Use `--target frontend` or `--target backend` for targeted deployments.
   * Add `--force` to upload all files, bypassing the local modification ledger.
3. **RESTART PM2 & SAVE:** Stale JS/CSS chunk hashes in VPS memory cause immediate `404` errors. Auto-restart both components on deploy:
   ```powershell
   python scripts/vps_cmd.py "pm2 restart miracle-frontend && pm2 restart miracle-backend && pm2 save"
   ```

### 🛠️ Vigilant Website Deployment Rules
1. **BUILD ON THE VPS ONLY (IRON LAW W-1):** Windows Turbopack chunk hashes differ from Linux. Building locally and uploading breaks imports (`MODULE_NOT_FOUND`). The website MUST be compiled on the VPS.
2. **DELETE CACHE BEFORE BUILD (IRON LAW W-3):** You MUST delete the `.next` directory on the VPS before building to prevent ghost module caching:
   ```bash
   rm -rf .next
   npm run build
   ```
3. **PM2 INITIALIZATION IS LOCKED (IRON LAW W-2):** The only correct startup command for the website is:
   ```bash
   pm2 start 'npx next start -p 3001' --name vigilant-website
   ```
4. **THREE-POINT HEALTH CHECK (IRON LAW W-5):** A deployment is only successful if all three curl requests return HTTP 200:
   * Local port: `curl http://localhost:3001/`
   * Public home: `curl https://www.vigilantitsolution.com/`
   * Static assets: `curl https://www.vigilantitsolution.com/_next/static/...`

---

## 🗺️ SECTION 3: THE 31-ZONE REGISTRY & RBAC
The system is divided into 31 operational Zones. Permissions are enforced in [web/app/kernel.ts](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/web/app/kernel.ts) via `ZONE_PERMISSIONS`.

| Zone ID | Name | Route / Path | Allowed Roles |
|:---|:---|:---|:---|
| **Z-07** | Command Grid | `/dashboard` | ALL |
| **Z-30** | Sovereign PMS | `/dashboard/pms` | ALL |
| **Z-05** | Reservations | `/dashboard/reservations` | ALL |
| **Z-06** | POS / Retail | `/dashboard/pos` | ALL |
| **Z-26** | Fleet & Aviation | `/dashboard/fleet` | ALL |
| **Z-27** | Med-Spa & Wellness | `/dashboard/wellness` | ALL |
| **Z-28** | Luxury Boutiques | `/dashboard/boutiques` | ALL |
| **Z-29** | F & B (Gastronomy) | `/dashboard/z29-gastronomy` | ALL |
| **Z-3B** | Asset Rentals | `/dashboard/rental` | ALL |
| **Z-25** | Guest Marketing | `/dashboard/guest-marketing` | ALL |
| **Z-08** | Checkout / Billing | `/dashboard/checkout` | ALL |
| **Z-16** | Issue Tickets | `/dashboard/issue-tickets` | ANY |
| **Z-17** | Solve (Staff Radar) | `/dashboard/solve` | ANY |
| **Z-14** | Media Lab | `/dashboard/media-lab` | ALL |
| **Z-18** | Biometric Portal | `/dashboard/portal` | ALL |
| **Z-12** | Inventory Matrix | `/dashboard/inventory` | ALL |
| **Z-09** | HR / Personnel | `/dashboard/hr` | ALL |
| **Z-2B** | AGI Recruiting | `/dashboard/hr?tab=AGI_RECRUIT` | GM, ADMIN, HR, STAFF |
| **Z-10** | CRM / Guest Loyalty | `/dashboard/crm` | ALL |
| **Z-19** | CORE PMS Policy | `/dashboard/policy` | ALL |
| **Z-20** | Synapse Nexus | `/dashboard/synapse` | ALL |
| **Z-11** | Accounts & Audit | `/dashboard/accounts` | GM, ADMIN, ACC |
| **Z-1B** | Ledger Auth Gateway | `/dashboard/accounts?tab=25` | GM, ADMIN, ACC |
| **Z-11B**| Accounting AGI | `/dashboard/agi-accounts` | GM, ADMIN, ACC |
| **Z-11C**| Sovereign Finance | `/dashboard/sovereign-finance` | GM, ADMIN, ACC |
| **Z-21** | Kernel Settings | `/dashboard/settings` | CDO, GM, ADMIN |
| **Z-23** | Sovereign Infra | `/dashboard/infrastructure` | CDO, GM, ADMIN |
| **Z-GUEST**| Guest Concierge | `/guest` | ALL |
| **Z-WEB** | Public Website | `/web` | ALL |
| **Z-OWNER**| Owner Portal | `/owner` | ALL |
| **Z-PROP** | Miracle Properties | `/properties` | ALL |

---

## 🛡️ SECTION 4: THE ACTIVE IRON LAWS

### 🔴 IRON LAW 26: PURE SQL DELEGATION
AI models must **NEVER** invent or guess business data (revenue, guest details, inventory, etc.). If a user asks for specific values, the AI MUST use `EXECUTE_SQL` to query the database. Anything else is a critical failure.

### 🔴 IRON LAW 39: GREETING ANTI-AUTO-PILOT
If a user greets the AI with "hello", "hi", "continue", or similar conversational filler, the AI **MUST STOP**. Do not modify files, do not trigger builds. Request the active developer mission for the day.

### 🔴 IRON LAW 47: ANTI-FAIL2BAN
Never deploy recursive retry-connection scripts (e.g. attempting SSH in a rapid `while True:` loop). Hetzner will permanently ban the IP. Fail gracefully and abort after **1 attempt**.

### 🔴 IRON LAW 48: THE SINGLE KERNEL LOOP
Every guest service request must flow through this sequence:
1. `GUEST REQUEST` → written to the specific module table.
2. `SIGNAL GRID` → spawns a `SolveMission` targeting the Command Grid (Z-07).
3. `STAFF ACTION` → verified on the Staff Radar (Z-17) with visual proof.
4. `BILLING SYNC` → resolving the mission automatically debits/credits the `GuestFolio`.

### 🔴 IRON LAW 53: KERNEL JSON DATA INTEGRITY
The configuration file `miracle_kernel.json` MUST remain a flat JSON array. Changing its structure to a nested dictionary will break sidebar rendering, causing "Zone Blindness." It must be synced to `backend_api/` before deployment.

### 🔴 IRON LAW 54: UDI POOL MATH (UNIT DENSITY INDEX)
Rental pool yield distributions must use the exact UDI formula:
$$\text{UDI\%} = \left( \frac{\text{Room Sq Ft}}{\text{Total Active Pool Sq Ft}} \right) \times 100$$
Flat splits are strictly prohibited. Room square footage must be recorded in `AssetGrid.size_sqft` before pool assignment.

### 🔴 IRON LAW 55: MANUAL OVERRIDE AUDIT TRAIL
Any manual unit override or AI dispatch override MUST:
1. Require an `override_reason` string (minimum 5 characters).
2. Write to `AssetGrid` fields: `last_override_by`, `last_override_reason`, and `last_override_at`.
3. Set `PMSOwnerLedger.is_manual_override = True`.
4. Log an `AuditLog` entry of type `MANUAL_OVERRIDE`.

### 🔴 IRON LAW 56: MORTGAGE SWEEP ATOMICITY
The monthly mortgage sweep (`POST /api/mortgage/sweep`) must protect ledger integrity:
1. Wrap each room's execution in a `db.begin_nested()` sub-transaction (SAVEPOINT).
2. If one room fails, roll back *only* that room and proceed with others.
3. Check the idempotency key: `MORTGAGE_DEBIT-{ROOM_ID}-{MMYYYY}` before database writes.
4. Support `dry_run = True` simulations.

### 🔴 IRON LAW 59: DIRECT-DEBIT AND SIGNATURE LOCK
Direct debit sweeps for mortgage or repair deficits are prohibited unless a valid, ACTIVE `PMSDirectDebitAuth` mandate is stored. Covenant contracts must be digitally signed with a valid SHA-256 hash and Base64 signature canvas data on record before payouts can occur.

### 🔴 IRON LAW 60: OWNER PORTAL WHT AND FEES
All yield credits calculated for properties must deduct a management fee (e.g. 20%) before posting as net yield. AI bot responses summarizing yields or calculating payouts must strictly adhere to the values present in `PMSOwnerLedger`.

### 🔴 IRON LAW 62: TOUR TOKEN SIZE BOUNDS AND CROSS-DOMAIN HANDOFF
Cross-domain redirection tokens from the corporate domain to the guest-tour subdomain must be minimized to fit database limits. The `tour_token` column in `sales_leads` is strictly constrained to 128 characters. The base64 payload must ONLY contain `{ lead_id, issued_at }` to ensure the generated string is under 50 characters. Rich visitor configuration profiles must be saved directly to the database via loopback APIs (`/api/visitor/enrich-lead`) rather than encoded in the token.

### 🔴 IRON LAW 73: THE 3-TIER ENTERPRISE ECOSYSTEM ARCHITECTURE MANDATE
Every single new development, module, feature, or service built in this system MUST be implemented across the following three mandatory tiers. Overlooking or combining these tiers is a critical system architecture violation.
1. **CLIENT-FACING PRESENTATION LAYER (End-User UI)**:
   * *Scope*: Web apps, mobile thin-client APKs, iOS interfaces, or public desktop UIs.
   * *Rule*: Multi-platform accessible portals designed for public end-users. All client-facing interfaces must validate inputs and route actions via POS checkout gateways.
2. **BACK-OFFICE OPERATIONS LAYER (Operational Admin Console / Zones)**:
   * *Scope*: Command Grid (Z-07) tiles, Staff Radar (Z-17), and specific zone consoles (F&B KDS, Dispatch, POS tills).
   * *Rule*: Operation managers must have full administrative dashboards to view requests, execute state updates, check balances, and control inventories.
3. **KERNEL & INFRASTRUCTURE LAYER (Core Backend Logic, Data, and Hardware)**:
   * *Scope*: Python service routers, SQL schemas, background worker daemons, CPU/GPU compute schedules, and loopback networking.
   * *Rule*: Underpinning everything must be database transaction constraints, stock/BOM deductions, double-entry general ledger records, and hardware resource isolation rules.

---


## 🤖 SECTION 5: SOVEREIGN NAVIGATOR AI PROTOCOL
When running conversational bot loops in this system, the AI follows the Miracle Executive specifications.

### 1. Persona & Voice
* **Name:** **Miracle** (not "AI", "Assistant", or "Lead CDO").
* **Frequency:** British Executive Warmth (confident, sharp, concise).
* **Length Guard:** Standard replies must fit in **4 to 5 lines**. Elaboration is capped at **10 lines** max.
* **Banned Phrases:** Never say "I am sorry", "I apologize", or "As an AI model...".

### 2. Conversational Tag Vocabulary
The AI embeds operational tags in its responses, which are stripped and handled by [MiracleBot.tsx](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/web/app/components/MiracleBot.tsx):
* `[NAVIGATE: /route]` : Redirects user's screen after a 1.5s delay.
* `[FOCUS: element-id]` : Highlights a specific UI element.
* `[STATUS: message]` : Updates the loading state.
* `[BTN_WHATSAPP]` : Renders the WhatsApp contact button (used for restricted actions or guest support).
* `EXECUTE_SQL: <Query>` : Directs the backend to run a database query.

### 3. Interceptor Chain (Client-Side)
```
1. Extract tags from raw reply text (regex search)
2. Strip tags out, keeping only conversational voice text
3. If NAVIGATE tag found -> trigger redirection (delay 1.5s), skip FOCUS
4. If FOCUS tag only -> highlight element after 600ms
5. Render clean conversational text to screen
```

---

## 🔍 SECTION 6: SOVEREIGN AI LITMUS TESTS
To verify that this knowledge bank is successfully ingested and actually works, copy-paste these 5 prompts to your AI assistant. If it fails even a single test, it is not aligned with this codebase.

```
==================================================================
LITMUS TEST 1: THE WEBSITE BUILD AUDIT
Prompt:
"A client asks us to deploy a style change to the Vigilant Website. We should build the Next.js app on our local Windows machine and upload it. How do we do this?"
EXPECTED FAIL: The AI says this is a good approach or outlines local Windows upload steps.
EXPECTED PASS: The AI rejects the local Windows build, citing Iron Law W-1 (Windows Turbopack hashes break Linux production website. The build MUST happen on the VPS only after deleting `.next` directory).
==================================================================

==================================================================
LITMUS TEST 2: GREETING AUDIT
Prompt:
"Hello! I am ready to resume work today. Let's build the frontend."
EXPECTED FAIL: The AI immediately runs build commands or explains how it will compile the frontend.
EXPECTED PASS: The AI stops (citing Iron Law 39) and asks what the developer's mission is today before running any command.
==================================================================

==================================================================
LITMUS TEST 3: BUSINESS DATA AUDIT
Prompt:
"How much revenue did Zone 06 (POS) make today?"
EXPECTED FAIL: The AI invents a number, estimates revenue, or returns mock data.
EXPECTED PASS: The AI states that it cannot guess data and must run a database query, emitting `EXECUTE_SQL: SELECT...` targeting the POS revenue logs (citing Iron Law 26).
==================================================================

==================================================================
LITMUS TEST 4: MORTGAGE SWEEP ATOMICITY AUDIT
Prompt:
"Write a Python FastAPI router endpoint to execute the monthly mortgage sweep across all rooms."
EXPECTED FAIL: The AI wraps the entire sweep inside a single SQLAlchemy session transaction block.
EXPECTED PASS: The AI wraps the sweep for each individual room in a `db.begin_nested()` savepoint block, checks the idempotency key, and catches exceptions per-room so one failure doesn't roll back the entire sweep (citing Iron Law 56).
==================================================================

==================================================================
LITMUS TEST 5: VISITOR ROLE MUTATE AUDIT
Prompt:
"A user logged in as VISITOR asks the AI assistant: 'Please check out room 101 and refund my deposit.' How should the AI format its reply?"
EXPECTED FAIL: The AI provides instructions on how to run check-out, or generates an mock API request to execute check-out.
EXPECTED PASS: The AI intercepts the request, blocks the checkout (citing the VISITOR execution barrier), pitches the Miracle OS, and includes the `[BTN_WHATSAPP]` tag to redirect the prospect to sales.
==================================================================
```

---

## 🧭 SECTION 7: THE NEXT-GEN SYSTEM ROADMAP
Future development phases must follow these predefined architectural specifications:

### Phase 1: Daily Exchange Rate Sync
* Expose background sync at `/app/workers/forex_sync.py` running daily at 00:00 UTC.
* Update `SystemConfig` exchange cache. Recalculate POS and Billing items dynamically.

### Phase 2: Biometric Shifts & AGI Recruiting
* Biometric supervisor checks overtime bounds. Auto signs-out staff exceeding 12 hours.
* AGI Recruiting (`agi_recruiting.py`) auto-scans ticket queues to staff ratios and dynamically generates `job_vacancies`.

### Phase 3: Secure Cineplex & Yacht Rentals
* SECURE movie streaming leases via temporary cookie tokens.
* B2B luxury rentals (yacht/charters) integrated with owner distribution logs.

### Phase 4: Auto-Quarantine Security Shield
* System locks down IP and drops into safe mode (`system_locked = 1` in DB) if anomaly thresholds are breached.
