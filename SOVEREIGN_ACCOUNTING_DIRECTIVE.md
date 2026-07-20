# 🏦 MIRACLE OS — SOVEREIGN ACCOUNTING DIRECTIVE (V1.0)
> **PURPOSE**: The absolute, unbreakable law governing ALL financial transaction handling, ledger architecture,
> department vault operations, and accounts gateway flows in Miracle OS.
> **LAST UPDATED**: 2026-06-20
> **VERSION**: V1.0-SOVEREIGN-ACCOUNTING
> **CLASSIFICATION**: FOUNDING DOCUMENT — READ BEFORE TOUCHING ANY ACCOUNTING CODE
> **COMPANION**: MIRACLE_ACCOUNTING_BIBLE.md (detailed doctrine) | SOVEREIGN_ENGINEERING_DIRECTIVE.md (code standards)

---

> [!CAUTION]
> **AGENTIC HANDSHAKE**: Any AI agent, developer, or contributor beginning work on any accounting,
> ledger, till, vault, expense, or financial reporting feature MUST read this directive IN FULL
> before writing a single line of code. Violating these laws breaks financial integrity and trust.

---

## SECTION 1: THE THREE-LAYER LEDGER STACK (IRON LAW — IMMUTABLE)

The Miracle OS accounting system is built on a **three-layer sovereignty model**. Data ONLY flows
upward, NEVER downward. Every layer has its own authority and access controls.

```
LAYER 3 ─── MASTER ACCOUNTS LEDGER (IMMUTABLE)
             Access: ACCOUNTS / GM / CDO only
             Entries: Auto-posted from Layer 2 approved batches only
             Records: Trial Balance, Income Statement, Balance Sheet, Cross-Dept P&L
             Law: ONCE POSTED, CANNOT BE DELETED — only reversed with a contra entry
             ↑
             [APPROVED by Accounts Gateway Only]
             ↑
LAYER 2 ─── LEDGER AUTH GATEWAY (Z-1B)
             Access: ACCOUNTS / GM / CDO (read+approve) | DEPT_HEAD (submit+respond)
             Entries: Dept-consented batches waiting for accounts approval
             Actions: APPROVE → posts to Layer 3 | QUERY → returns to dept | REJECT → back to dept
             Law: NO batch advances to Layer 3 without an Accounts officer approval stamp
             ↑
             [SUBMITTED after Dept Head PIN consent every 20 transactions]
             ↑
LAYER 1 ─── DEPARTMENT PRIMARY LEDGER (VAULT)
             Access: STAFF (enter own dept only) | DEPT_HEAD (full dept control) | ACC (read only)
             Entries: All raw till transactions — revenue, expense, void, float, cash drop
             Law: All expenses MUST be from pre-approved expense catalog — NO freeform entries
```

---

## SECTION 2: DEPARTMENT AS PROFIT CENTER (THE SOVEREIGNTY PRINCIPLE)

Every Miracle OS revenue-generating zone is a **Sovereign Profit Center** — an independently
accountable economic entity with its own:

- Cash till balance (live, real-time)
- Primary ledger (Layer 1)
- Expense catalog (pre-approved, GL-coded)
- Department Head accountability
- P&L statement (live, not monthly)
- Void authorization chain
- Submission authority to Gateway (Layer 2)

### Department Types:

| Type | Description | Examples |
|---|---|---|
| `REVENUE` | Generates income, has a physical or virtual till | POS, Sauna, F&B, PMS, Boutique, Fleet, Rentals |
| `COST` | Spends but does not earn directly | Housekeeping, Maintenance, Admin |
| `MIXED` | Both earns commissions and incurs costs | PMS (commission model), HR (training fees) |

### Department Registry Rules:
- Departments are created via `POST /api/accounting/departments` — one API call auto-creates:
  till, expense catalog template, GL prefix, vault, and batch counter
- Departments are NEVER hard-deleted — only soft-deactivated (historical data preserved)
- Price plan gates department access: `BASIC` → 2 depts | `PRO` → 4 depts | `ENTERPRISE` → all
- Every department has a `gl_prefix` (e.g., `270` for Wellness) — ALL GL codes for that dept
  are prefixed with this number

---

## SECTION 3: THE TILL BALANCE ENGINE (IRON LAW — NON-NEGOTIABLE)

Every Revenue Center department has a **Till** — a live running cash balance. The till is the
foundation of departmental cash visibility.

### Till Transaction Types (ONLY these are valid):

| Type | Direction | Description |
|---|---|---|
| `REVENUE_CASH` | IN | Guest pays cash at counter |
| `REVENUE_CARD` | IN | Card terminal settlement |
| `REVENUE_BANK` | IN | Bank transfer / OTA credit / wire |
| `REVENUE_ROOM_CHARGE` | IN | Posted to guest folio in PMS |
| `EXPENSE_CASH` | OUT | Staff spends from till (catalog only) |
| `CASH_DROP` | OUT | Cash moved from till to safe |
| `FLOAT_TOPUP` | IN | Manager adds opening/mid-shift float |
| `VOID` | REVERSAL | Cancellation of a prior revenue entry |

### Till Balance Formula:
```
Opening Float
+ All REVENUE_* entries (IN)
- All EXPENSE_CASH entries (OUT)
- All CASH_DROP entries (OUT)
- All approved VOID reversals
= CURRENT TILL BALANCE
```

### Iron Laws for Till:
1. **NEVER allow negative till balance** — system must block expense entry if till would go negative
2. **ALL revenue entries require a payment method** — `CASH | CARD | BANK | ROOM_CHARGE | OTA`
3. **ALL expense entries require a category from the expense catalog** — NO freeform text categories
4. **ALL void entries require a reason code from the void reason list** — NO freeform void reasons
5. **Till balance is ALWAYS computed from the transaction log** — never stored as a single mutable number

---

## SECTION 4: THE EXPENSE CATALOG (PRE-AUTHORIZATION LAW)

The Expense Catalog is the **single most important financial control** in the system.

### Law:
> Staff can ONLY select an expense category from the pre-configured, department-specific catalog.
> Free-text expense entries are FORBIDDEN at the system level. No exceptions.

### Catalog Structure per Entry:
- `name` — display name (e.g., "Spa Supplies & Amenities")
- `gl_code` — the GL account code this posts to (e.g., `5100-270`)
- `per_tx_limit` — maximum amount per single expense transaction
- `daily_limit` — maximum total for this category per day per department
- `requires_pin_above` — if expense exceeds this amount, dept head PIN required on the spot
- `active` — soft on/off toggle (accounts can deactivate without deleting)

### Who Manages the Catalog:
- **ACCOUNTS / ADMIN** — create, edit, set limits, assign GL codes
- **GM / CDO** — read-only view
- **DEPT_HEAD** — read-only view (can REQUEST changes, cannot make them)
- **STAFF** — selection only (no visibility into limits or GL codes)

---

## SECTION 5: THE 20-TRANSACTION CONSENT MECHANISM

This is Miracle OS's most unique financial accountability innovation.

### Law:
> After every 20 transactions (or at shift end, whichever comes first), the department's primary
> ledger batch is **sealed** and requires the Department Head's PIN consent before ANY further
> transactions can be recorded OR the batch can advance to Layer 2.

### Consent Process:
1. Transaction counter reaches 20 (or shift-end trigger fires)
2. System locks further entries for this department
3. Dept Head receives notification: "Batch ready for consent"
4. Dept Head reviews all 20 transactions in the consent panel
5. Dept Head enters PIN + ticks the consent checkbox
6. System records: `dept_head_id`, `consent_at`, `pin_hash` (bcrypt), `batch_total_revenue`, `batch_total_expense`
7. Batch status changes: `OPEN` → `CONSENTED`
8. New batch opens (counter resets to 0/20)
9. Consented batch becomes available for "Submit to Gateway"

### What Consent Certifies:
- Department Head has personally reviewed all 20 transactions
- Revenue figures are accurate
- Expense categories are legitimate
- Voids in the batch are authorized
- The batch is ready for accounts review

---

## SECTION 6: THE VOID AUTHORIZATION CHAIN

Voided transactions are the highest-risk accounting events. Every void MUST pass through
a three-stage authorization chain.

### Stage 1 — Staff Initiates:
- Staff clicks "Void" on a transaction
- System requires: void reason code (from predefined list) — NO freeform
- Void reason categories: `GUEST_COMPLAINT | ENTRY_ERROR | SYSTEM_ERROR | MANAGER_OVERRIDE | PRICE_CORRECTION`
- Transaction enters `VOID_PENDING` status — still shows in till until approved

### Stage 2 — Department Head Reviews:
- Dept Head receives alert: "Void pending your approval"
- Dept Head reviews original transaction + void reason
- OPTIONS: `APPROVE VOID` | `REJECT VOID` | `ESCALATE TO GM`
- If approved: transaction marked `VOIDED`, counter-entry created, till balance updated
- If rejected: transaction remains ACTIVE, staff notified
- If escalated: GM receives override request

### Stage 3 — Accounts Eliminates:
- Approved voids appear in the Ledger Auth Gateway void panel
- Accounts officer reviews void reason + approving dept head
- OPTIONS: `ELIMINATE FROM LEDGER` | `FLAG FOR INVESTIGATION`
- Elimination creates a formal contra-entry in the primary ledger
- Voided amounts are tracked in the department's void report (never deleted)

### Void Escalation Trigger (AUTO):
> If 3+ voids from the same staff member in 24 hours → **automatic GM alert + ACC notification**
> If any single void exceeds PKR 10,000 → **mandatory GM approval regardless of dept head**
> These thresholds are configurable per enterprise in system settings.

---

## SECTION 7: THE LEDGER AUTH GATEWAY (Z-1B) — OPERATIONS LAW

### Gateway States:
| Status | Meaning | Who Sees It |
|---|---|---|
| `PENDING_REVIEW` | Batch submitted, waiting for accounts | ACC, GM, CDO |
| `QUERIED` | Accounts sent questions back to dept | DEPT_HEAD (action required) |
| `APPROVED` | Accounts approved → posting to master | All observers |
| `REJECTED` | Sent back to dept for correction | DEPT_HEAD (action required) |
| `POSTED` | Successfully written to Master Ledger | All observers |

### What Accounts Reviews in Each Batch:
1. Revenue figures vs. POS/PMS daily reports (spot-check)
2. Expense category validity and limit compliance
3. Void reasons and dept head approvals
4. Dept Head consent stamp (timestamp + PIN hash verified)
5. Any anomalies: round numbers, same-category clusters, unusual timing

### Gateway Iron Laws:
- **NO batch reaches Master Ledger without Gateway approval stamp** — system-enforced
- **Accounts cannot edit batch contents** — can only approve, query, or reject
- **GM can observe ALL gateway activity** — cannot approve (approvals are Accounts authority)
- **CDO can override and force-approve** — requires CDO PIN + reason — creates an audit log entry
- **Approved batches are IMMUTABLE** — any error requires a new corrective entry, not an edit

---

## SECTION 8: ROLE LIMITS & ACCESS MATRIX

```
OPERATION               │ STAFF  │ DEPT_HEAD │ ACCOUNTS │ GM    │ CDO
────────────────────────┼────────┼───────────┼──────────┼───────┼──────
Enter Revenue (own dept)│  YES   │    YES    │   NO     │  NO   │  NO
Enter Revenue (other dept│  NO    │    NO     │   NO     │  NO   │  NO
Enter Expense (catalog) │  YES*  │    YES    │   NO     │  NO   │  NO
Enter Expense (freeform)│  NEVER │   NEVER   │  NEVER   │ NEVER │ NEVER
Initiate Void           │  YES   │    YES    │   NO     │  NO   │  NO
Approve Void            │  NO    │    YES    │   NO     │  YES  │  YES
Consent Batch (PIN)     │  NO    │    YES    │   NO     │  NO   │  NO
Submit to Gateway       │  NO    │    YES    │   NO     │  NO   │  NO
Query/Approve Gateway   │  NO    │    NO     │   YES    │  NO   │  NO
Force-Approve (Override)│  NO    │    NO     │   NO     │  NO   │  YES
View Dept Vault         │  OWN   │   OWN     │   ALL    │  ALL  │  ALL
View Master Ledger      │  NO    │    NO     │   YES    │  YES  │  YES
View Dept P&L           │  NO    │   OWN     │   ALL    │  ALL  │  ALL
Manage Expense Catalog  │  NO    │    NO     │   YES    │  NO   │  YES
Create/Edit Departments │  NO    │    NO     │   NO     │  NO   │  YES
```
`*` = only up to their role's configured daily limit; above limit requires dept head PIN

### Cross-Department Access:
- Staff can ONLY record transactions in their **assigned department** (from HR profile)
- Cross-dept access requires a **time-limited override token** issued by GM
- Token expires in 4 hours, all cross-dept transactions marked with `is_cross_dept=True`
- Every cross-dept transaction triggers an automatic ACC notification

---

## SECTION 9: REVENUE SOURCE MAP (ALL MIRACLE OS EARNING ZONES)

| Zone | Dept ID | Revenue Types | Cash Source | Bank/Card Source |
|---|---|---|---|---|
| Z-06 POS | `DEPT_POS` | F&B, Retail, Packages | Counter cash | Card, QR Pay |
| Z-27 Sauna/Wellness | `DEPT_WELLNESS` | Treatments, Memberships, Retail | Counter cash | Card, Room charge |
| Z-30 PMS | `DEPT_PMS` | Room rent, Commissions, OTA net | Cash check-in | Bank, OTA payout |
| Z-29 F&B / Gastronomy | `DEPT_FB` | Table covers, Bar, Room service | Counter cash | Card, Room charge |
| Z-28 Boutique | `DEPT_BOUTIQUE` | Retail, Gift sets | Counter cash | Card, Online |
| Z-26 Fleet | `DEPT_FLEET` | Rental fees, Transfers | Cash deposit | Bank transfer |
| Z-3B Asset Rentals | `DEPT_RENTAL` | Daily/monthly rent, Lease | Cash | Bank, Cheque |
| Z-05 Reservations | `DEPT_RESERVATIONS` | Booking deposits, Cancel fees | Wire | OTA, Card |
| Z-08 Checkout | `DEPT_CHECKOUT` | Final settlement, Mini-bar | Cash | Card, Bank |

---

## SECTION 10: THE AUTO PRIMARY LEDGER (DOUBLE-ENTRY LAW)

Every till transaction automatically creates a **double-entry ledger record**. No exceptions.

### Examples:

**Revenue Cash:**
```
Dr  Cash/Till (ASSET 1000-{dept_gl})         ← money in the till increases
Cr  Revenue — {Category} (INCOME 4000-{dept_gl}) ← income recognized
```

**Expense Cash:**
```
Dr  {Expense Category} (EXPENSE 5000-{dept_gl})  ← expense recognized
Cr  Cash/Till (ASSET 1000-{dept_gl})             ← money leaves the till
```

**Void (approved):**
```
Dr  Revenue — {Category} (INCOME 4000-{dept_gl}) ← income reversed
Cr  Cash/Till (ASSET 1000-{dept_gl})             ← till reduced (if cash was taken back)
    OR
Cr  Voids & Adjustments (CONTRA 4900-{dept_gl}) ← if no cash exchange (posted charge)
```

**PMS Commission:**
```
Dr  Accounts Receivable — OTA (ASSET 1200-{dept_gl}) ← commission owed from OTA
Cr  Revenue — Commission Income (INCOME 4200-{dept_gl}) ← income recognized
```

---

## SECTION 11: DEPARTMENT P&L STRUCTURE

Every department generates a live P&L in this format:

```
GROSS REVENUE
  Revenue by Category (cash / card / bank / room charge)
  Less: Voids & Adjustments
= NET REVENUE

DIRECT COSTS
  Cost of Goods (BOM-linked inventory deductions)
  Direct Labor (allocated from HR shift costs)
= GROSS PROFIT

OPERATING EXPENSES
  All approved expense catalog entries (by GL category)
= NET OPERATING INCOME

ALLOCATIONS
  Utilities (allocated % of property utility costs)
  Management Fee (configured % of gross revenue)
= DEPARTMENT NET INCOME / (LOSS)
```

---

## SECTION 12: DATABASE TABLE REGISTRY (ACCOUNTING ENGINE)

The following tables are owned by the Accounting Engine. Never write to these tables
from non-accounting routers unless explicitly documented.

| Table | Layer | Purpose |
|---|---|---|
| `departments` | Config | Department registry with GL prefix, type, head user |
| `expense_categories` | Config | Pre-approved expense catalog per department |
| `till_transactions` | Layer 1 | All raw till entries (revenue, expense, void, float) |
| `tx_batches` | Layer 1→2 | 20-transaction batch containers with consent state |
| `dept_ledger_entries` | Layer 1 | Auto-generated double-entry records per transaction |
| `void_log` | Layer 1→2 | Dedicated void tracking with full auth chain |
| `master_ledger` | Layer 3 | Immutable final ledger — approved Gateway batches only |

**SOVEREIGN LAW**: `master_ledger` is APPEND-ONLY. No UPDATE or DELETE queries are ever
permitted on this table. Corrections are made via new contra entries only.

---

## SECTION 13: API ROUTE REGISTRY (ACCOUNTING ENGINE)

Router file: `backend_api/app/routers/dept_accounting.py`
Router prefix: `/api/accounting/`

```
# Department Management
GET|POST  /departments           → list or create departments
PATCH     /departments/{id}      → edit (CDO only)
DELETE    /departments/{id}      → soft-delete (CDO only)

# Expense Catalog
GET       /dept/{id}/expense-catalog      → get categories
POST      /expense-catalog               → add category (ACC/CDO)
PATCH     /expense-catalog/{id}          → edit (ACC/CDO)

# Till Operations
GET       /dept/{id}/till                → current balance + summary
POST      /dept/{id}/till/revenue        → add revenue entry
POST      /dept/{id}/till/expense        → add expense (catalog enforced)
POST      /dept/{id}/till/float          → float topup / cash drop
POST      /dept/{id}/till/void           → initiate void request

# Batch & Consent
GET       /dept/{id}/batch/current       → current open batch
POST      /dept/{id}/batch/consent       → dept head PIN consent
POST      /dept/{id}/batch/submit        → submit to gateway

# Void Management
GET       /dept/{id}/voids               → void list
POST      /void/{id}/approve             → dept head approve
POST      /void/{id}/reject              → dept head reject
POST      /void/{id}/escalate            → escalate to GM

# Ledger Auth Gateway
GET       /gateway/queue                 → all pending batches
GET       /gateway/queue/{dept_id}       → filter by dept
POST      /gateway/batch/{id}/approve    → accounts approve → master post
POST      /gateway/batch/{id}/query      → query → back to dept
POST      /gateway/batch/{id}/reject     → reject → back to dept
POST      /gateway/void/{id}/eliminate   → accounts eliminate void

# Reports
GET       /dept/{id}/pl                  → dept P&L (period param)
GET       /dept/{id}/ledger              → dept primary ledger entries
GET       /master/ledger                 → master accounts ledger
GET       /master/trial-balance          → trial balance all depts
GET       /master/void-report            → consolidated void analysis
GET       /master/pl-comparison          → cross-dept P&L comparison
```

---

## SECTION 14: IRON LAWS (ACCOUNTING — NUMBERED 64+)

[RED] **IRON LAW 64: EXPENSE CATALOG ENFORCEMENT**
ALL expense transactions MUST reference a valid `category_id` from `expense_categories`.
Any attempt to POST an expense without a valid catalog category returns HTTP 422 INSTANTLY.
The backend NEVER accepts `category_name` as a freeform string — only `category_id` UUID.

[RED] **IRON LAW 65: 20-TX BATCH CONSENT GATE**
The system MUST block further till entries for a department the moment the 20-transaction
batch is FULL and PENDING CONSENT. Staff cannot bypass this. The block lifts ONLY when
the dept head's PIN consent is recorded. No admin override exists for this gate.

[RED] **IRON LAW 66: MASTER LEDGER IMMUTABILITY**
The `master_ledger` table is APPEND-ONLY. The API router for dept_accounting.py MUST NOT
contain any UPDATE or DELETE query targeting `master_ledger`. Corrections = new entries.
Any AI agent or developer who writes UPDATE/DELETE to master_ledger has violated financial law.

[RED] **IRON LAW 67: VOID DOUBLE-AUTHORIZATION**
A void transaction MUST have BOTH: (a) dept head approval AND (b) accounts elimination before
it is considered "cleared." A dept-head-only approved void still appears in the Gateway void
panel until Accounts eliminates it. Single-party void clearance is prohibited.

[RED] **IRON LAW 68: NEGATIVE TILL BLOCK**
The backend MUST verify that `current_till_balance - expense_amount >= 0` before accepting
any `EXPENSE_CASH` or `CASH_DROP` entry. Negative till balance is a system integrity failure.
Return HTTP 409 with message "Insufficient till balance" — never allow negative till.

[RED] **IRON LAW 69: DOUBLE-ENTRY ATOMICITY**
Every `till_transaction` insert MUST be wrapped in a database transaction alongside its
matching `dept_ledger_entry` insert. If the ledger entry fails, the till transaction MUST
be rolled back. Orphaned till transactions without ledger entries are a financial disaster.

[RED] **IRON LAW 70: CROSS-DEPT TRANSACTION MARKING**
Any transaction recorded by a staff member outside their assigned department MUST carry
`is_cross_dept=True` and `cross_dept_token_id` referencing the GM-issued override token.
Transactions with expired tokens are rejected at the API middleware level.

[RED] **IRON LAW 71: ACCOUNTS CANNOT ENTER TRANSACTIONS**
The ACCOUNTS role is a REVIEWER and APPROVER — not a data entry role. The backend MUST
reject any till revenue or expense POST from a user with role=ACCOUNTS. Accounts posts
only through the Gateway (approve/query/reject) and master ledger corrections (contra entries).

---

## SECTION 15: THE ACCOUNTING DEVELOPMENT AGENT ONBOARDING CHECKLIST

Before any developer or AI agent works on accounting features, verify ALL of the following:

- [ ] Read this directive IN FULL
- [ ] Read `MIRACLE_ACCOUNTING_BIBLE.md` IN FULL
- [ ] Understand the 3-layer ledger stack (Section 1)
- [ ] Understand expense catalog enforcement (Section 4 + Iron Law 64)
- [ ] Understand the 20-tx consent gate (Section 5 + Iron Law 65)
- [ ] Understand void authorization chain (Section 6 + Iron Law 67)
- [ ] Confirm `master_ledger` is APPEND-ONLY in your code (Iron Law 66)
- [ ] Confirm negative till block is implemented (Iron Law 68)
- [ ] Confirm double-entry atomicity in every till write (Iron Law 69)
- [ ] Check role permissions matrix before adding any new endpoint (Section 8)

---
**AUTHOR**: ANTIGRAVITY AI × CDO Engineering | **VERSION**: V1.0-SOVEREIGN-ACCOUNTING
**STATUS**: FOUNDING LAW — LOCKED
**COMPANION DOCUMENTS**: MIRACLE_ACCOUNTING_BIBLE.md | SOVEREIGN_ENGINEERING_DIRECTIVE.md | MIRACLE_ZONE_ARCHITECTURE.md
