# Master Implementation Plan: PMS & Co-Owner Mortgage Accounting Upgrade

An engineering roadmap to implement co-owner rental pools, mortgage amortization netting, management alerting, and AGI AI Property Manager — **fully integrated with HR (Zone 09), Synapse Nexus (Zone 20), and the Accounting Kernel (Zone 18)**.

---

## SECTION 0: FORENSIC GAP ANALYSIS — What The Previous Plan Missed

> [!CAUTION]
> The previous 6-phase plan treated PMS as an **isolated module**. This forensic audit reveals **5 critical cross-system gaps** that would have caused data corruption, financial discrepancies, and orphaned workflows in production.

### GAP 1: HR ↔ PMS Owner Integration (MISSING)
- **Finding**: [hr.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/hr.py) already has a working payroll engine (line 564) that posts GL journal entries via `post_double_entry()` (Code 5000 Debit → Code 1000 Credit).
- **Gap**: No link exists between `PMSOwnerProfile` and `Employee`. If a property owner is also an employee/investor, their rental yield never flows into the HR commission system.
- **Impact**: Owner-employees would see zero revenue_impact even when their units generate millions.

### GAP 2: Synapse ↔ PMS Automation (MISSING)
- **Finding**: [synapse_nexus.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/synapse_nexus.py) has a full directive/task pipeline (line 392) with AGI Vision Verification, auto-status transitions, and can spawn Zone 16 SolveMission tickets.
- **Gap**: No PMS event triggers Synapse directives. Room checkout doesn't create housekeeping tasks. Mortgage alerts don't create management threads. Maintenance requests from guests don't flow into Synapse.
- **Impact**: Housekeeping, maintenance, and management alerts would remain manual — defeating the "Supreme Property Manager" objective.

### GAP 3: Synapse Efficiency ↔ PMS Performance (MISSING)
- **Finding**: [synapse_efficiency.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/synapse_efficiency.py) calculates `avg_response_minutes`, `performance_stars`, and `tasks_completed` from directive node completion times → syncs to Employee table (line 69-75).
- **Gap**: PMS operations (room turnaround, check-in speed, complaint resolution) don't feed into the efficiency engine. Staff performance in hospitality is invisible.
- **Impact**: Front desk and housekeeping staff would always show 0 tasks completed and no star ratings.

### GAP 4: Accounting COA ↔ Owner Disbursement Pipeline (MISSING)
- **Finding**: [accounting_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/accounting_engine.py) has division-scoped P&L (line 241-248) covering rooms/fb/fleet/wellness/boutique/cinema, but no owner disbursement codes exist.
- **Gap**: The proposed COA codes (113200, 200300, 440100, 521200) were planned but the accounting engine has no `record_owner_disbursement()` or `record_mortgage_payment()` dispatcher functions.
- **Impact**: Owner payouts would bypass the double-entry system entirely, creating an audit black hole.

### GAP 5: No Scheduler/Daemon Infrastructure (MISSING)
- **Finding**: `synapse_efficiency.py` has a manual `/purge-completed` endpoint but no actual cron/scheduler.
- **Gap**: Mortgage netting requires monthly sweeps. Alert checking requires daily scans. Owner yield calculations require post-checkout triggers. None of these have a scheduler framework.
- **Impact**: All "automated" features would require manual API calls to function.

---

## SECTION 1: EXISTING SYSTEM INTEGRATION MAP

> [!IMPORTANT]
> Every file listed below has been **read in full** during this audit. The connections (✅ exists / ❌ missing) are verified from source code.

### HR System (Zone 09) — What Exists

| File | Key Features | Integration Status |
|------|-------------|-------------------|
| [hr.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/hr.py) | Onboarding, Performance Matrix, Payroll GL Sync, Duty Lifecycle, Registry Surgery | ✅ Posts to Accounting via `post_double_entry()` |
| [hr_compliance.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/hr_compliance.py) | Compliance tracking | ❌ No PMS link |
| [hr_talent_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/hr_talent_engine.py) | Talent/performance engine | ❌ No PMS link |
| [hr_leave.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/hr_leave.py) | Leave management | ❌ No PMS staffing link |
| [hr_training.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/hr_training.py) | Training tracking | ❌ No PMS link |

**Key HR Fields Already in Employee Model** ([models.py:45-88](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/models/models.py#L45-L88)):
- `base_salary`, `commission_rate`, `revenue_impact` → ROI math exists
- `avg_response_minutes`, `performance_stars`, `tasks_completed` → Synapse efficiency sync exists
- `department_alignments`, `executive_tier` → Multi-department, chain-of-command exists

### Synapse Nexus (Zone 20) — What Exists

| File | Key Features | Integration Status |
|------|-------------|-------------------|
| [synapse_nexus.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/synapse_nexus.py) | Org Chart, Gatekeeper, Threads, WebSocket Chat, Directives, AGI Verification, WebRTC, Presence, Staff Vault | ✅ Syncs efficiency to HR Employee table |
| [synapse_agi.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/synapse_agi.py) | AGI command processing | ❌ No PMS queries |
| [synapse_departments.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/synapse_departments.py) | Department management | ❌ No PMS link |
| [synapse_efficiency.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/synapse_efficiency.py) | Star ratings, response time calc, auto-purge | ✅ Writes to Employee table |

### Accounting Engine (Zone 18) — What Exists

| File | Key Features | Integration Status |
|------|-------------|-------------------|
| [accounting_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/accounting_engine.py) | ACID double-entry, Stock Purchase, F&B COGS, Voucher/Capitalize, Division P&L, Trial Balance | ✅ HR Payroll posts here |
| [accounting_enterprise.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/accounting_enterprise.py) | Enterprise-level consolidation | ❌ No owner disbursement |
| [accounting_vault.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/accounting_vault.py) | Treasury features | ❌ No mortgage tracking |
| [agi_coa_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/agi_coa_engine.py) | AGI-managed Chart of Accounts | ❌ No owner/mortgage codes |

---

## SECTION 2: REAL-LIFE IMPLEMENTATION BARRIERS

> [!WARNING]
> These are production-grade risks that will cause data loss or financial discrepancy if not addressed in the architecture.

### Barrier 1: Double-Payment Race Condition
- **Risk**: `execute-payroll/{staff_id}` (hr.py:564) has NO idempotency guard. Clicking "Pay" twice creates two GL entries.
- **Solution**: Add `reference` uniqueness constraint. Check `JournalEntry.reference_type + posted_by + month` before posting.
- **Applies to**: Mortgage netting, owner disbursements — all must be idempotent.

### Barrier 2: Partial Netting Corruption
- **Risk**: If the monthly mortgage sweep processes 50 owners and crashes at owner #31, the first 30 have debited entries but the sweep reports failure.
- **Solution**: Wrap the entire sweep in a single database transaction with `db.begin_nested()`. Either ALL owners net or NONE do.

### Barrier 3: No Multi-Currency Owner Support
- **Risk**: The accounting engine supports `currency_code` and `exchange_rate` on journal entries (line 60-61), but the PMS has no currency field on `PMSOwnerProfile`.
- **Solution**: Add `currency_code` to owner profiles. Convert at posting time using the journal's exchange rate field.

### Barrier 4: No Owner Portal Authentication
- **Risk**: Owners need to view their statements, download schedules, and check balances. The current auth system (`User` table) only supports employees.
- **Solution**: Extend the `GuestCRM` or create a new `OwnerPortalUser` model linked to `PMSOwnerProfile`.

### Barrier 5: Synapse Directive Flooding
- **Risk**: If every room checkout auto-creates a housekeeping directive, a 200-room hotel generates 200+ directives daily. The Kanban board becomes unusable.
- **Solution**: Use a "batch directive" pattern — one directive per floor/wing with room-level nodes. Auto-complete nodes when housekeeping scans a QR code.

### Barrier 6: AGI Bot Context Window Explosion
- **Risk**: Injecting live data for ALL owners, ALL rooms, ALL mortgage schedules into the LLM prompt will exceed token limits.
- **Solution**: Use a "query-on-demand" pattern. The bot detects intent → runs a targeted DB query → injects ONLY the relevant slice into the prompt.

---

## SECTION 3: DEVELOPMENT LIFECYCLE MAP (UPGRADED 8-PHASE)

```mermaid
graph TD
    classDef default fill:#0a0e17,stroke:#22d3ee,stroke-width:1px,color:#f1f5f9;
    classDef phase fill:#0f172a,stroke:#c084fc,stroke-width:1.5px,color:#fff;
    classDef critical fill:#1a0a0a,stroke:#ef4444,stroke-width:2px,color:#fca5a5;
    
    Start["PMS Upgrade Initiation"] :::phase --> P1["Phase 1: DB Schema Surgery & COA Mapping"] :::phase
    P1 --> P2["Phase 2: Rental Pooling & UDI Engine"] :::phase
    P2 --> P3["Phase 3: AI-Driven Fair Rotation Dispatcher"] :::phase
    P3 --> P4["Phase 4: Mortgage Amortization & Netting"] :::phase
    P4 --> P5["Phase 5: HR Integration Bridge"] :::critical
    P5 --> P6["Phase 6: Synapse Nexus PMS Automation"] :::critical
    P6 --> P7["Phase 7: Compliance Alerting & Management UI"] :::phase
    P7 --> P8["Phase 8: AGI Bot Property Manager Sync"] :::phase
```

---

## SECTION 4: PHASE-BY-PHASE DEVELOPMENT PLAN

### PHASE 1: DB Schema Surgery & COA Mapping

**Objective**: Define database schema structures and Chart of Accounts codes.

**Existing Files to MODIFY**:

#### [MODIFY] [models.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/models/models.py)
- Add columns to `PMSOwnerProfile`: `owner_type` (String: `FULL_OWNER` / `MORTGAGE_BUYER` / `RENTAL_OWNER`), `mortgage_total`, `mortgage_monthly_payment`, `mortgage_paid_to_date`, `mortgage_interest_rate`, `mortgage_due_day`, `lease_fixed_rent`, `currency_code`, `employee_id` (FK → employees.id, nullable — links owner to HR if they are also staff)
- Add `pool_category` and `sq_ft` columns to `AssetGrid` if not present
- Add `owner_disbursement_ref` uniqueness index to prevent double-payments

#### [MODIFY] [genesis.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/core/genesis.py)
- Add SQL migration strings inside `perform_database_surgery()` for all new columns
- Add idempotency check (IF NOT EXISTS) for each ALTER TABLE

#### [MODIFY] [accounting_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/accounting_engine.py)
- Add new COA codes to seed: `113200` (Mortgage Principal Receivable), `113300` (Owner Yield Payable), `200300` (Lease Payable), `440100` (Interest Revenue - Mortgage), `521200` (Lease Expense), `521300` (Owner Disbursement Expense)
- Add `OWNER` division to `DIVISION_ACCOUNTS` mapping
- Create dispatcher functions: `record_owner_disbursement()`, `record_mortgage_payment()`, `record_lease_payment()`

**UI/UX Task**: Create migration verification script

---

### PHASE 2: Rental Pooling & UDI Engine

**Objective**: Implement Category-Based Rental Pooling using square footage.

**Existing Files to MODIFY**:

#### [MODIFY] [pms.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/pms.py)
- Add pool configuration endpoints (`/api/pms/pools/configure`, `/api/pms/pools/status`)
- Define pool categories (ROYAL_POOL, DELUXE_POOL, etc.) with sq_ft weighting
- Calculate UDI share: $$\text{UDI Share} = \frac{\text{Room Sq Ft} \times \text{Value Weight}}{\text{Total Active Sq Ft in Pool}}$$

#### [MODIFY] [frontdesk_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/frontdesk_engine.py)
- Modify `process_master_checkout`: If room belongs to a pool, calculate owner share using UDI
- Post owner yield as GL journal entry via `record_owner_disbursement()`
- **BARRIER FIX**: Wrap in `db.begin_nested()` to prevent partial checkout corruption

**UI/UX Task**: Add "Rental Pools" dashboard tab showing active pools, sq_ft breakdown, YTD revenue per pool

---

### PHASE 3: The AI-Driven Fair Rotation Room Dispatcher

**Objective**: Remove manual room-assignment favoritism and equalize wear-and-tear.

**Existing Files to MODIFY**:

#### [MODIFY] [frontdesk_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/frontdesk_engine.py)
- Modify check-in and quick-walk-in endpoints: Query `AssetGrid` for available rooms in category, assign the unit with lowest cumulative Nights Occupied (YTD)
- Log rotation decision to `AuditLog` for transparency
- Allow manual override with CDO/GM approval flag

**UI/UX Task**: "Dispatch Lock" indicator in Front Desk room matrix — rooms assigned by AI show a lock icon

---

### PHASE 4: Mortgage Amortization & Automated Netting Service

**Objective**: Automate installment payments and yield offsets.

**New Files to BUILD**:

#### [NEW] [mortgage_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/mortgage_engine.py)
- Build amortization schedule generator (principal + interest split per month)
- Monthly reconciliation sweep: net mortgage payment from owner's yield balance
- **BARRIER FIX**: Idempotency guard — check `JournalEntry` for existing `MORTGAGE_NET-{owner_id}-{MMYYYY}` before posting
- **BARRIER FIX**: Atomic transaction — entire sweep runs in one `db.begin_nested()` block
- Post GL journal entries: Debit owner profile balance → Credit principal receivable → Credit interest revenue
- Manual override endpoint for CDO to adjust individual owner balances

**UI/UX Task**: "Mortgage Ledger" section in Owner Portal — payment schedule download, payments made, outstanding balance

---

### PHASE 5: HR Integration Bridge (NEW — Previously Missing)

> [!IMPORTANT]
> This phase was completely absent from the previous plan. Without it, owner revenue and staff performance are disconnected from the HR system.

**Objective**: Bridge PMS revenue events to HR performance tracking.

**Existing Files to MODIFY**:

#### [MODIFY] [hr.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/hr.py)
- Add `update_revenue_impact(employee_id, amount, source)` function
- When a front desk operative checks in a guest, their `revenue_impact` increases by the room revenue
- When a POS sale is made by staff, their `revenue_impact` increases by the sale amount
- This feeds the existing ROI math: `roi_factor = rev / sal`

#### [MODIFY] [frontdesk_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/frontdesk_engine.py)
- On checkout: Call `update_revenue_impact()` for the front desk operative who processed the check-in
- If the room's owner has an `employee_id` link, also update their HR revenue_impact

#### [MODIFY] [hr_talent_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/hr_talent_engine.py)
- Add "Property Revenue Contributor" talent badge for staff whose PMS revenue exceeds threshold
- Link talent scores to PMS performance metrics

**New Integration Points**:
- HR Payroll (`execute-payroll`) already posts GL entries → extend to include owner commission payout
- Owner disbursement should create a `VaultFile` (PAYSLIP category) in the owner's `StaffVault` if they are an employee

---

### PHASE 6: Synapse Nexus PMS Automation (NEW — Previously Missing)

> [!IMPORTANT]
> This phase was completely absent from the previous plan. Without it, all PMS operational tasks remain manual.

**Objective**: Auto-generate Synapse directives from PMS events.

**Existing Files to MODIFY**:

#### [MODIFY] [frontdesk_engine.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/frontdesk_engine.py)
- On checkout: Auto-create a Synapse directive for housekeeping using existing `StrategicDirective` + `DirectiveNode` models
- **BARRIER FIX**: Use batch directives — one per floor with room-level nodes to prevent Kanban flooding
- On guest complaint: Auto-create a SolveMission ticket linked to the relevant department

#### [MODIFY] [synapse_efficiency.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/synapse_efficiency.py)
- Add PMS-specific metrics: room turnaround time (checkout → room marked clean), check-in processing speed
- Feed these into the existing star rating system alongside directive response times

#### [MODIFY] [synapse_nexus.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/synapse_nexus.py)
- Add `/synapse/pms-alerts` endpoint that creates management threads for:
  - Mortgage payments past due
  - Owner yield deficit notifications
  - Revenue anomalies (room revenue < expected)

**New Integration Points**:
- Synapse AGI escalation (line 746-763 in synapse_nexus.py) already auto-notifies issuers when directives reach 100% → reuse for PMS alert escalation
- Staff Vault already stores payslips → extend to store housekeeping completion reports

---

### PHASE 7: Compliance Alerting & Management UI

**Objective**: Alert management of payout liabilities and receivable due dates.

**New Files to BUILD**:

#### [NEW] [reporting_alerts.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/reporting_alerts.py)
- Daily scan daemon scanning all owner profiles
- Generate alerts for: Mortgage past due, Impending lease payments, Yield deficit (mortgage > yield)
- **INTEGRATION**: Post alerts as Synapse threads (Phase 6 bridge)
- **INTEGRATION**: Update Employee.revenue_impact if owner is also staff (Phase 5 bridge)

#### [NEW] [scheduler_daemon.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/core/scheduler_daemon.py)
- APScheduler-based cron system
- Daily: Run alert scanner, run efficiency sync
- Monthly: Run mortgage netting sweep
- Weekly: Auto-purge completed directives (currently manual endpoint)
- **BARRIER FIX**: All scheduled jobs are idempotent and use database locks

**UI/UX Task**: "Alerts & Schedules" tab in PMS operator dashboard with flashing badges for overdue accounts

---

### PHASE 8: AGI AI Bot Property Manager Sync

**Objective**: Turn the AI Bot into a supreme property manager with live knowledge.

**Existing Files to MODIFY**:

#### [MODIFY] [bot_router_v2.py](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/bot_router_v2.py)
- **Dynamic Context Injection**: Hook inside `execute_executive_synthesis()`. On owner/asset/payout queries, run targeted DB queries and inject ONLY relevant results
- **BARRIER FIX**: Query-on-demand pattern, NOT bulk injection. Detect intent → query → inject slice
- **AGI Interceptor Commands**:
  - `/agi pms-reconcile`: Runs mortgage netting sweep
  - `/agi rotation-status`: Returns room dispatcher equity log
  - `/agi owner-statement {owner_id}`: Returns owner P&L
  - `/agi hr-sync`: Triggers efficiency sync for all operatives
  - `/agi alert-scan`: Runs the alert scanner

#### [MODIFY] [MiracleBot.tsx](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/web/app/components/MiracleBot.tsx)
- Integrate AGI command autocomplete in the operator chat panel
- Render owner statements and mortgage schedules as formatted cards

---

## SECTION 5: CROSS-SYSTEM INTEGRATION MATRIX

```mermaid
graph LR
    classDef zone fill:#0f172a,stroke:#22d3ee,stroke-width:1.5px,color:#fff;
    
    PMS["PMS<br/>Zone 08"] :::zone
    HR["HR<br/>Zone 09"] :::zone
    ACC["Accounting<br/>Zone 18"] :::zone
    SYN["Synapse<br/>Zone 20"] :::zone
    BOT["AGI Bot<br/>Zone 30"] :::zone
    
    PMS -->|"revenue_impact update"| HR
    PMS -->|"owner yield GL entry"| ACC
    PMS -->|"housekeeping directives"| SYN
    HR -->|"payroll GL entry"| ACC
    HR -->|"commission from PMS revenue"| PMS
    SYN -->|"efficiency stars"| HR
    SYN -->|"alert threads"| PMS
    ACC -->|"trial balance data"| BOT
    PMS -->|"live room/owner data"| BOT
    HR -->|"staff performance"| BOT
    SYN -->|"directive status"| BOT
```

---

## SECTION 6: SEEDING, DEBUGGING & COMPILATION CHECK

Following [SOVEREIGN_DEVELOPMENT_DIRECTIVE_NEXT.md](file:///D:/Vigilant%20IT%20Solutions/Miracle_Os_Master/SOVEREIGN_DEVELOPMENT_DIRECTIVE_NEXT.md):

- `[ ]` **Database Seeding**: Build `scripts/seed_pms_data.py` with mock co-owners (Full, Mortgage, Leased), linked employees, and pool configurations
- `[ ]` **TypeScript/Lint Check**: Run `npm run build` in web directory. Resolve type/import errors
- `[ ]` **Endpoint Verification**: Test all new endpoints via cURL/Postman
- `[ ]` **Bi-directional Netting Test**: Checkout room → verify owner balance → run sweep → verify GL codes balance
- `[ ]` **HR Bridge Test**: Checkout room → verify front desk operative's revenue_impact increased → run payroll → verify commission calculated
- `[ ]` **Synapse Bridge Test**: Checkout room → verify housekeeping directive auto-created → complete directive → verify efficiency stars updated
- `[ ]` **Idempotency Test**: Run mortgage sweep twice → verify no duplicate GL entries
- `[ ]` **AGI Bot Test**: Ask bot about owner balances → verify live data returned
- `[ ]` **Next.js Production Build & Deploy**: Execute deployment following server port rules

---

## SECTION 7: OPEN QUESTIONS FOR USER

> [!IMPORTANT]
> These decisions impact the architecture and should be resolved before Phase 1 begins.

1. **Owner Portal Access**: Should property owners log in through the existing employee auth system, or do they need a separate portal (like the Guest Hub)?
2. **Housekeeping Batch Granularity**: Should auto-generated housekeeping directives be per-floor, per-wing, or per-room?
3. **Manual Override Policy**: When CDO/GM manually overrides the AI room dispatcher or mortgage netting, should the system require a reason/comment for the audit trail?
4. **Multi-Currency**: Are any property owners transacting in currencies other than the base currency (BDT)?
5. **Scheduler Deployment**: Should the APScheduler daemon run inside the FastAPI process or as a separate systemd service on the VPS?
