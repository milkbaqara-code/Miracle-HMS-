# 🏛️ MIRACLE OS — FUTURE DEVELOPMENT DIRECTIVE (V2.0-NEXT)
> **PURPOSE**: Structural engineering roadmap and feature specifications for the next system expansion.
> **TARGET SYSTEM**: V69.0-SOVEREIGN-ACCOUNTING
> **LAST UPDATED**: 2026-06-20
> **NEW FOUNDING DOCUMENTS**: SOVEREIGN_ACCOUNTING_DIRECTIVE.md | MIRACLE_ACCOUNTING_BIBLE.md

---

> [!IMPORTANT]
> **PHASE 6 IS NOW THE ACTIVE PRIORITY** — The Departmental Accounting Engine (Department Vault System)
> is the next major build. All other phases below remain valid but Phase 6 takes precedence.
> Before any work on phases 1-5, check if Phase 6 tasks need to be completed first.

---

## 🍽️ F&B ENTERPRISE ARCHITECTURE: POST-MORTEM & CORE DIRECTIVES
*Objective: Codify the lessons learned, database fixes, and schema alignments from the successful deployment of the 3-Tier F&B Enterprise Solution (Z-29 Gastronomy). All future modules must strictly adhere to these architectural precedents to prevent schema drift and integration failures.*

### 1. Database & Schema Alignment (The MySQL / SQLite Drift)
* **The Problem**: Severe schema drift occurred between the local SQLite development environment (`miracle_os_master.db`) and the live production VPS (MySQL). SQLAlchemy's `Base.metadata.create_all()` silently bypassed existing tables (`fnb_orders`), causing critical `500 Internal Server Errors` because the production database lacked new columns (`guest_profile_id`, `pos_transaction_id`).
* **The Fix**: 
  - Abandoned generic `create_all()` commands for existing production tables. 
  - Executed targeted, direct-SSH `ALTER TABLE` operations using SQLAlchemy `text()` wrappers on the live MySQL `engine.connect()` thread.
* **The Directive**: **NO MORE SILENT MIGRATIONS**. Any structural change to an ORM model in local development MUST be paired with an explicit, raw SQL `ALTER TABLE` migration script deployed specifically to the MySQL VPS environment. 

### 2. App Integration & Phantom Columns
* **The Problem**: Procurement Alert APIs crashed entirely because backend SQL queries requested a `vendor` column from the `inventory` table that did not exist in production. The UI expected this data for its 3D analytics matrices.
* **The Fix**: 
  - Rapidly patched the FastAPI `fnb_orders_router.py` logic to inject mock columns (`'' as vendor`) at the SQL query level.
  - This allowed the frontend components to render seamlessly without requiring a destructive, table-dropping rebuild of the production inventory database.
* **The Directive**: **DEFENSIVE QUERYING**. Backend API routes must dynamically check or mock missing peripheral columns when performing cross-module `JOIN` operations, ensuring that the presentation tier (UI) never receives a hard `500` crash due to a single missing data point.

### 3. Inventory Alignment & Data Ghosting
* **The Problem**: Stale, deleted items ("Signature Wagyu Burger", "Sovereign Cappuccino") continued to trigger automated procurement alerts and warp the Cost of Goods Sold (COGS) metrics because they were deleted locally but persisted on the live MySQL server.
* **The Fix**: 
  - Bypassed the ORM and ran raw `DELETE FROM inventory WHERE name IN (...)` commands on the production VPS.
  - Re-synced the Kernel Watchdog to recalculate stock depreciation based strictly on the newly sanitized database.
* **The Directive**: **ABSOLUTE STATE ALIGNMENT**. Local deletions do not equal production deletions. Any cleanup of master templates (like default inventory, GL codes, or base pricing) must be executed explicitly via production-targeted scripts to maintain mathematical integrity across the 3-tier architecture.

---

## 🏦 PHASE 6: DEPARTMENTAL ACCOUNTING ENGINE (ACTIVE — PRIORITY 1)
*Objective: Build the world's first AI-native, department-sovereign hospitality accounting engine.
Each Miracle OS revenue zone becomes an independently accountable economic entity with its own
till balance, primary ledger, expense catalog, department vault, and live P&L.*

**GOVERNING DOCUMENTS** (MUST READ before coding):
- `SOVEREIGN_ACCOUNTING_DIRECTIVE.md` — Iron laws, API routes, role matrix
- `MIRACLE_ACCOUNTING_BIBLE.md` — Business logic, P&L structure, void doctrine, GL codes

### Phase 6A — Backend Foundation (DB + Core API)
* **Files**: `backend_api/app/routers/dept_accounting.py` (NEW) | DB migration script
* **Tasks**:
  1. Database migration: Create 7 new tables (departments, expense_categories, till_transactions,
     tx_batches, dept_ledger_entries, void_log, master_ledger) — see Directive Section 12
  2. Department Registry API: CRUD for departments with price-plan gating
  3. Expense Catalog API: Create/edit/deactivate categories with GL codes and limits
  4. Till Operations: revenue, expense (catalog enforced), float topup, cash drop
  5. Void initiation engine with reason codes
  6. 20-Transaction batch counter with PENDING_CONSENT gate (Iron Law 65)
  7. Batch consent endpoint: dept head PIN verification
  8. Void approval chain: dept head approve/reject/escalate
  9. Double-entry atomicity: every till_transaction + dept_ledger_entry in same DB transaction
* **Iron Laws**: 64, 65, 66, 67, 68, 69, 70, 71 (see .antigravityrules)

### Phase 6B — Frontend: Till Panel (embedded in zone POS screens)
* **Files**: `web/components/DeptTillPanel.tsx` (NEW) — embeds into Z-06, Z-27, Z-29, Z-28, Z-26, Z-3B
* **Tasks**:
  1. Live till balance counter (real-time, WebSocket update)
  2. Revenue entry form: amount + payment method dropdown + category dropdown + reference field
  3. Expense entry form: expense catalog dropdown + amount + note
  4. Float topup / Cash drop buttons (manager-gated)
  5. Void initiation button with reason code selector
  6. 20-tx batch progress bar: "[16/20] — consent required at 20"
  7. Today's summary: total revenue, total expense, void count

### Phase 6C — Frontend: Department Vault Screen
* **Files**: `web/app/dashboard/accounts/vault/page.tsx` (NEW) or tab in Z-11
* **Tasks**:
  1. Department selector (only shows depts where user is dept_head)
  2. Full transaction list with filter (by type, date, amount range)
  3. 20-tx batch consent modal: PIN entry + checkbox certification
  4. Void approval queue: pending voids with approve/reject/escalate
  5. Department P&L card (live: revenue, expense, net)
  6. "Submit to Gateway" button (active only when batch is CONSENTED)

### Phase 6D — Frontend: Ledger Auth Gateway Upgrade (Z-1B)
* **Files**: `web/app/dashboard/accounts/page.tsx` — enhance existing Ledger Auth Gateway tab
* **Tasks**:
  1. Department filter tabs at top of gateway
  2. Batch detail drawer: see all 20 transactions with double-entry preview
  3. Void elimination panel (separate from batch approval)
  4. One-click APPROVE → auto-post to master ledger
  5. QUERY flow: text box for question → sends back to dept head
  6. Live counter: "X pending | Y approved today | Z voided"
  7. WebSocket live updates when new batches arrive

### Phase 6E — Frontend: Master Ledger & Reports
* **Files**: New tab in `/dashboard/accounts` — "Master Ledger"
* **Tasks**:
  1. Full trial balance view (all accounts, debit/credit columns)
  2. Cross-department P&L comparison grid
  3. Void audit trail (all voids with full auth chain)
  4. Income/Expense waterfall chart (live, per dept)
  5. Export engine: PDF + Excel for trial balance and P&L

### Phase 6F — AI Integration (AGI Accounting Layer)
* **Files**: `backend_api/app/routers/agi_coa_engine.py` — extend existing
* **Tasks**:
  1. Auto-classify revenue category from transaction description
  2. Anomaly detection: flag unusual void patterns to GM
  3. Monthly P&L summary report generation (auto-narrative)
  4. Budget variance alerts (if budget configured)

---

---

## 🔱 PHASE 1: FINANCIAL LIMIT AUTHENTICATION & MULTICURRENCY SILOS
*Objective: Build hard guardrails for financial ledger entries and automate daily currency silo conversions.*

### 1. Daily Exchange Rate Sync Daemon
* **Task**: Create a background cron process in `app/workers/forex_sync.py` that executes daily at 00:00 UTC.
* **Logic**: Fetch currency exchange rates for USD, EUR, GBP, AED, SGD, and BDT from the Frankfurter/Open-Meteo Forex API and update the `system_forex_rates` cache table.
* **Integrations**: Update the POS and Billing modules to recalculate room charges and folio bills using the daily cached rates.

### 2. Authentication-Bounded Ledger Gateways
* **Task**: Implement transaction-limit middleware in `app/routers/accounting_enterprise.py`.
* **Logic**: Intercept all transaction posts. If a ledger credit/debit exceeds a staff role's limit (e.g. $10,000 for front desk agents):
  1. Halt the transaction.
  2. Write to `pending_authorizations`.
  3. Broadcast a Z-07 alert to the General Manager/CDO.
  4. Release the transaction block only upon cryptographic token approval from the GM/CDO.

---

## 👥 PHASE 2: BIOMETRIC SHIFT COMPLIANCE & RECRUITING CORE
*Objective: Prevent payroll fraud via biometric enforcement and build the autonomous recruiting pipeline.*

### 1. Biometric Over-Hour Sign-Out Guard
* **Task**: Create a supervisor service in `app/workers/biometric_supervisor.py`.
* **Logic**: Scan `biometric_attendance` every 10 minutes. If an employee's continuous shift time exceeds 12 hours:
  1. Trigger an automatic remote sign-out.
  2. Log the overtime violation to `employee_compliance_logs`.
  3. Push an SMS alert to the HR Director.

### 2. AGI Recruiting & Department Builder
* **Task**: Build the "Enterprise Brain" self-expansion router at `app/routers/agi_recruiting.py`.
* **Logic**: 
  - Expose a POST `/api/hr/recruiting/analyze` endpoint.
  - The AI reviews running department metrics (completed ticket queues vs. active staffing ratios).
  - Automatically posts vacancy notices to `job_vacancies`.
  - Generates appointment templates, customized onboarding handbooks, and issues secure joining letters.

---

## 🎬 PHASE 3: SECURED CINEPLEX STREAMING & RENTAL SERVICES
*Objective: Secure digital media streaming and implement rental-based B2B e-commerce bookings.*

### 1. Stream Session Authorization Handler
* **Task**: Build an asset-leasing gateway in `app/routers/cinema.py`.
* **Logic**: When a guest starts a movie on their WebView:
  1. Verify lease duration in `cinema_rentals`.
  2. Generate a tokenized, time-limited stream URL using signed cookies.
  3. Post the rental fee to `folio_charges` using revenue code `4700 (Cinema Revenue)`.

### 2. Rental-Based B2B E-Commerce Portals
* **Task**: Build reservation structures for luxury assets in `app/routers/rental_engine.py`.
* **Logic**: Allow B2B partners to schedule yacht charters, helicopters, and conference rooms. Integrate payment scheduling with automatic payment disbursement notifications to asset owners.

---

## 🛡️ PHASE 4: SYSTEM ANATOMY & AUTO-QUARANTINE SHIELDS
*Objective: Harden the system against external security threats and AI drift.*

### 1. Foreign Attitude Auto-Lock
* **Task**: Integrate request signature verification in the main API middleware.
* **Logic**: If an endpoint receives a burst of anomalous requests (e.g. invalid query patterns, missing headers, or rapid rate limits):
  1. Lock down the originating IP.
  2. Set `system_locked = 1` in `SystemConfig`.
  3. Broadcast a critical security alarm via `master_socket` to Z-07.

### 2. AGI Grounding and Prompt Firewalls
* **Task**: Hard-code input validations to check LLM prompts against the exact structures in `miracle_kernel.json`. Any request attempting to mutate data outside the Single Kernel Loop is rejected with an HTTP 403.

---

## 🔗 PHASE 5: CROSS-DOMAIN VISITOR-TOUR HANDOFF PROTOCOL
*Objective: Maintain secure connection handoffs between the public marketing domain and the restricted ERP subdomain.*

### 1. Loopback Network Handoff API
* **Task**: Implement route gateways to manage lead capture and database-enrichment loops using direct VPS loopback channels (`http://localhost:8090/api/visitor/...`).
* **Logic**:
  1. Public configurator inputs visitor info.
  2. Main website route handler (`POST /api/miracle-advisor/capture-lead`) invokes the Miracle OS backend visitor registration over the loopback network.
  3. Backend generates and updates a database-linked `tour_token` in `sales_leads`.
  4. User is redirected to `https://miracle.vigilantitsolution.com/visitor-tour?token=...` with the token.

### 2. Minimal Token Serialization
* **Task**: Standardize the token generation model to prevent SQL database column overflow.
* **Logic**: Construct `tour_token` containing only the vital validation attributes (`lead_id` and `issued_at`). All additional details (selected zones, business profile) must be updated separately via the `enrich-lead` database API to keep the base64-encoded string well within the 128-character schema boundary.

