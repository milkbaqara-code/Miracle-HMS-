# 📖 MIRACLE OS — THE ACCOUNTING BIBLE (V1.0)
> **PURPOSE**: The complete financial doctrine for all Miracle OS accounting operations.
> Covers: business logic, accounting standards, ledger design, department sovereignty,
> P&L architecture, void doctrine, and the financial philosophy of the system.
> **LAST UPDATED**: 2026-06-20
> **VERSION**: V1.0-BIBLE
> **CLASSIFICATION**: FOUNDING DOCTRINE — Reference before any financial feature design.
> **READ WITH**: SOVEREIGN_ACCOUNTING_DIRECTIVE.md (technical laws)

---

## CHAPTER 1: THE FINANCIAL PHILOSOPHY OF MIRACLE OS

### 1.1 Why Department Sovereignty Matters

Traditional hotel ERPs treat accounting as a **centralized afterthought**. Transactions happen in
departmental silos (POS, PMS, SPA), then get dumped into a central ledger at month-end for an
accountant to reconcile. This creates:

- **Blind spots**: Nobody knows the Sauna's real profit until month 30
- **Accountability gaps**: When money is missing, no individual is traceable
- **Fraud vulnerability**: Voids and write-offs pass without counter-authorization
- **No live P&L**: Managers make decisions on stale data

Miracle OS solves this with the **Department Sovereignty Principle**:

> **Every department is an independently accountable economic entity.**
> Every rupee that enters or leaves a department is tracked from the moment of transaction,
> audited at the source by a human with a PIN, reviewed by accounts, and posted to a master
> ledger that cannot be altered.

This is not an accounting module. This is a **financial operating system**.

---

### 1.2 What Miracle OS Accounting Is Compared to Global ERPs

| System | Till | Dept P&L | Live Ledger | Dept Head Consent | Void Chain | AI Observation |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Oracle OPERA | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SAP S/4HANA | ❌ | ✅ | ✅ | ❌ | ⚠️ | ❌ |
| Oracle Simphony (POS) | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| Oracle NetSuite | ❌ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ |
| Lightspeed Restaurant | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| Mews PMS | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| apaleo PMS | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Miracle OS** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Miracle OS is the **only hospitality system** that provides all six capabilities in one unified platform.

---

## CHAPTER 2: THE DEPARTMENT VAULT DOCTRINE

### 2.1 What Is a Department Vault?

A Department Vault is the combination of:
1. **The Till** — a real-time running cash balance for the department
2. **The Primary Ledger** — every transaction auto-journalized in double-entry format
3. **The Expense Catalog** — pre-approved spending categories with GL codes and limits
4. **The Batch Queue** — the 20-transaction consent container waiting for dept head sign-off
5. **The Void Log** — all void events with authorization trail
6. **The P&L Statement** — live income, expense, and net position

The Vault is **Department Head territory**. Only the dept head can consent, submit, and void.
Staff can only enter data into the till. Accounts can only observe and approve.

### 2.2 The Till Opening & Closing Protocol

**Opening a Shift:**
1. Department Head or authorized staff opens the till
2. Enter Opening Float (cash from safe) via `FLOAT_TOPUP` entry
3. System records: `opened_by`, `opened_at`, `opening_float_amount`
4. Till is now ACTIVE — revenue and expense entries enabled

**Closing a Shift:**
1. Staff initiates shift close from Till Panel
2. System triggers: if active batch < 20 transactions → force batch consent before close
3. Dept Head consents pending batch (even if < 20 transactions at shift end)
4. Dept Head enters physical cash count (compared to system balance)
5. System flags variance if physical count ≠ system till balance (>PKR 100 threshold)
6. Cash drop to safe is recorded as `CASH_DROP` entry
7. System generates Shift Summary Report (auto-attached to batch)
8. Batch submitted to Gateway
9. Till marked CLOSED for this shift

### 2.3 The Float Management Protocol

**Opening Float:**
- Must be entered by dept head or manager (not staff)
- Standard opening floats by department (configurable per property):
  - POS Counter: PKR 5,000
  - Sauna/Wellness: PKR 3,000
  - F&B Bar: PKR 10,000
  - Boutique: PKR 5,000
  - Fleet Desk: PKR 5,000

**Mid-Shift Float Topup:**
- Required when till balance drops below minimum threshold (configurable)
- Manager adds cash from safe → enters as `FLOAT_TOPUP` → till increases
- Every topup requires: amount, authorized by, reason

**Cash Drop:**
- Required when till balance exceeds maximum threshold (security policy)
- Surplus cash moved to safe → entered as `CASH_DROP` → till decreases
- Every drop requires: amount, authorized by (dept head witness required for drops > PKR 20,000)

---

## CHAPTER 3: THE EXPENSE CATALOG DOCTRINE

### 3.1 Why the Catalog Exists

Without a pre-approved expense catalog, staff could enter any description for any spending.
This creates unauditable expenses and opens the door to petty fraud, misclassification,
and GL code chaos.

The Catalog solves this with three controls:
1. **Enumerated categories only** — staff picks from a list, cannot type anything
2. **GL codes assigned by Accounts** — ensures correct financial posting
3. **Limits by category** — spending above the limit requires dept head PIN at entry time

### 3.2 Standard Expense Catalog Templates by Department

**Sauna & Wellness (DEPT_WELLNESS):**
| Category | GL Code | Per-TX Limit | Daily Limit |
|---|---|---|---|
| Spa Supplies & Amenities | 5100-270 | PKR 5,000 | PKR 20,000 |
| Essential Oils & Products | 5110-270 | PKR 8,000 | PKR 25,000 |
| Linen & Towel Replacement | 5120-270 | PKR 3,000 | PKR 10,000 |
| Staff Refreshments | 5200-270 | PKR 1,000 | PKR 3,000 |
| Equipment Maintenance | 5400-270 | PKR 10,000 | PKR 30,000 |
| Marketing Materials | 5700-270 | PKR 2,000 | PKR 5,000 |
| Petty Cash — Urgent | 5900-270 | PKR 500 | PKR 1,500 |

**POS / F&B (DEPT_POS / DEPT_FB):**
| Category | GL Code | Per-TX Limit | Daily Limit |
|---|---|---|---|
| Raw Materials — Kitchen | 5100-060 | PKR 20,000 | PKR 80,000 |
| Bar Consumables | 5110-060 | PKR 10,000 | PKR 40,000 |
| Packaging Materials | 5120-060 | PKR 2,000 | PKR 8,000 |
| Staff Meals | 5200-060 | PKR 500 | PKR 2,000 |
| Kitchen Equipment Repair | 5400-060 | PKR 15,000 | PKR 50,000 |
| Cleaning Supplies | 5500-060 | PKR 3,000 | PKR 10,000 |
| Petty Cash — Urgent | 5900-060 | PKR 1,000 | PKR 3,000 |

**Fleet & Aviation (DEPT_FLEET):**
| Category | GL Code | Per-TX Limit | Daily Limit |
|---|---|---|---|
| Fuel — Vehicle | 5100-260 | PKR 15,000 | PKR 60,000 |
| Toll & Parking | 5110-260 | PKR 500 | PKR 2,000 |
| Vehicle Maintenance | 5400-260 | PKR 20,000 | PKR 80,000 |
| Driver Allowance | 5200-260 | PKR 2,000 | PKR 8,000 |
| Vehicle Cleaning | 5500-260 | PKR 1,500 | PKR 6,000 |
| Emergency Parts | 5900-260 | PKR 5,000 | PKR 20,000 |

**PMS / Front Desk (DEPT_PMS):**
| Category | GL Code | Per-TX Limit | Daily Limit |
|---|---|---|---|
| Guest Complimentary | 5100-300 | PKR 5,000 | PKR 20,000 |
| OTA Commission Payout | 5200-300 | PKR 50,000 | PKR 200,000 |
| Room Supplies | 5300-300 | PKR 3,000 | PKR 12,000 |
| Stationery & Office | 5400-300 | PKR 1,000 | PKR 4,000 |
| Petty Cash — Urgent | 5900-300 | PKR 500 | PKR 2,000 |

### 3.3 Adding New Categories

Only ACCOUNTS or CDO can add expense categories. Required fields:
- Category name (clear, unambiguous)
- GL code (must exist in Chart of Accounts)
- Per-transaction limit (PKR)
- Daily aggregate limit (PKR)
- Requires-PIN-above threshold (PKR) — set to 0 means always requires PIN
- Effective date (cannot backdate)

---

## CHAPTER 4: THE REVENUE CLASSIFICATION DOCTRINE

### 4.1 Revenue Categories by Payment Method

Every revenue entry is classified by BOTH its **revenue type** (what was sold) AND
its **payment method** (how it was paid). Both are required fields.

**Revenue Types:**
| Code | Category | Posting Account |
|---|---|---|
| `TREATMENT_FEE` | Spa/Wellness treatment | 4100-{gl_prefix} |
| `ROOM_REVENUE` | Room rental income | 4200-{gl_prefix} |
| `FB_SALES` | Food & Beverage sales | 4300-{gl_prefix} |
| `RETAIL_SALES` | Retail product sales | 4400-{gl_prefix} |
| `COMMISSION_INCOME` | OTA/booking commissions | 4500-{gl_prefix} |
| `MEMBERSHIP_FEE` | Membership subscriptions | 4600-{gl_prefix} |
| `RENTAL_INCOME` | Asset rental / lease | 4700-{gl_prefix} |
| `SERVICE_CHARGE` | Service charges | 4800-{gl_prefix} |
| `CANCELLATION_FEE` | Booking cancellations | 4850-{gl_prefix} |
| `MISCELLANEOUS` | Other income (acc-approved only) | 4900-{gl_prefix} |

**Payment Methods:**
| Code | Description | Settlement Timing |
|---|---|---|
| `CASH` | Physical cash in till | Immediate |
| `CARD` | Credit/Debit card terminal | T+1 bank settlement |
| `BANK_TRANSFER` | Direct bank wire | T+1 to T+3 |
| `OTA_CREDIT` | OTA payout (Booking.com, Agoda) | T+30 to T+45 |
| `ROOM_CHARGE` | Charged to guest folio | On checkout settlement |
| `CHEQUE` | Physical cheque | T+3 to T+5 clearing |
| `DIGITAL_WALLET` | QR pay, mobile wallet | T+1 |

### 4.2 The OTA Commission Revenue Flow

When a booking comes through an OTA (Booking.com, Agoda, etc.):

```
Gross Room Rate: PKR 15,000
OTA Commission: 15% = PKR 2,250
Net Revenue to Property: PKR 12,750

Accounting Entry:
Dr  Accounts Receivable — OTA (1200-300)      PKR 12,750
Dr  OTA Commission Expense (5200-300)         PKR  2,250
Cr  Room Revenue (4200-300)                   PKR 15,000
```

The `DEPT_PMS` till records PKR 12,750 as `REVENUE_BANK | OTA_CREDIT`.
The PKR 2,250 commission is automatically posted via expense catalog category `OTA Commission Payout`.

### 4.3 PMS Commission Model (When PMS Earns Commission)

When PMS earns a referral commission FROM an OTA (rare, property-specific model):
```
Dr  Accounts Receivable — OTA (1200-300)      commission amount
Cr  Commission Income (4500-300)              commission amount
```
Records as `REVENUE_BANK | COMMISSION_INCOME` in till.

### 4.4 Lease & Rent Income (Asset Rentals — Z-3B)

Monthly rent or lease income from Z-3B Asset Rentals:
```
Dr  Bank / Cash (1000-3B)                     lease amount
Cr  Rental Income (4700-3B)                   lease amount
```
Records as `REVENUE_BANK | RENTAL_INCOME` with `reference_id` = lease agreement number.

---

## CHAPTER 5: THE VOID DOCTRINE

### 5.1 When to Void vs. When to Correct

**VOID** (full reversal of a transaction):
- Guest dispute: guest claims they didn't receive the service
- Entry error: wrong amount entered at POS, caught before end of day
- System error: POS double-charged due to connectivity issue
- Manager override: complimentary service authorized post-entry

**DO NOT VOID** (use a corrective entry instead):
- Partial refund — enter a new negative revenue entry for the refund amount
- Price adjustment — enter a price correction transaction
- Discount application — add a discount revenue entry (negative amount in correct category)

### 5.2 Void Reason Code Definitions

| Code | Use Case | Requires GM? |
|---|---|---|
| `GUEST_COMPLAINT` | Guest disputed charge | No (dept head sufficient) |
| `ENTRY_ERROR` | Staff entered wrong amount | No (dept head sufficient) |
| `SYSTEM_ERROR` | Technical duplicate/glitch | No (systems log auto-attached) |
| `MANAGER_OVERRIDE` | Manager authorized complimentary | Yes (GM approval required) |
| `PRICE_CORRECTION` | Tariff was incorrectly applied | No (dept head sufficient) |
| `FRAUD_INVESTIGATION` | Suspicious transaction | Yes (ACC + GM required) |

### 5.3 The Void Counter (Fraud Detection Trigger)

The system monitors void patterns in real-time:

| Pattern | Alert | Action |
|---|---|---|
| 3+ voids by same staff in 24h | ACC + GM notification | Voids still processed normally |
| 5+ voids by same staff in 24h | GM + CDO notification | Auto-flag staff for HR review |
| Any void > PKR 10,000 | GM approval required | Void held until GM approves |
| `FRAUD_INVESTIGATION` reason used | Immediate CDO notification | Void locked until CDO release |
| Void within 5 min of entry | Pattern logged | Auto-attached to batch for ACC review |

### 5.4 Void vs. Eliminated

**Voided** = transaction was authorized for reversal by dept head (Layer 1 complete)
**Eliminated** = accounts has cleared the void from the primary ledger (Layer 2 complete)

A voided-but-not-eliminated transaction STILL appears in departmental reports as "pending elimination."
Only eliminated voids are removed from P&L calculations.

---

## CHAPTER 6: THE BATCH CONSENT DOCTRINE

### 6.1 Why Every 20 Transactions?

The number 20 is a deliberate design decision:
- **Small enough** that a dept head can genuinely review each transaction (2-3 min review)
- **Large enough** that consent interruptions don't slow operations significantly
- **Frequent enough** that errors are caught within the same business day, not month-end

For low-volume departments (e.g., Asset Rentals), the trigger is also shift-end — whichever
comes first: 20 transactions OR end of shift.

### 6.2 What the Dept Head Consent Certifies

By entering their PIN and ticking the consent checkbox, the Department Head is certifying:
1. They have personally reviewed all transactions in this batch
2. Revenue amounts reflect genuine services rendered
3. Expense amounts are legitimate and within policy
4. Void reasons (if any) are accurate
5. No unauthorized cross-department transactions exist in this batch
6. They accept personal accountability for this batch's accuracy

This certification is **legally significant**. The timestamp, PIN hash, user ID, and IP address
are recorded. In a dispute, this constitutes the department head's attestation.

### 6.3 Batch States & Transitions

```
OPEN (0-19 tx)
   ↓ [20th transaction OR shift-end]
PENDING_CONSENT (locked, awaiting dept head PIN)
   ↓ [Dept Head PIN + tick]
CONSENTED (sealed, ready to submit)
   ↓ [Dept Head clicks "Submit to Gateway"]
SUBMITTED (in Layer 2 queue)
   ↓ [Accounts reviews]
APPROVED → auto-posts to master ledger → POSTED
   OR
QUERIED → returns to dept head → CONSENTED (re-submit after response)
   OR
REJECTED → returns to dept head → back to CONSENTED (after corrections)
```

---

## CHAPTER 7: THE LEDGER AUTH GATEWAY DOCTRINE

### 7.1 The Accounts Officer's Role

The Accounts Officer at the Gateway is the **quality gatekeeper** — not a data entry clerk.
Their job is to:
1. Verify that batch totals align with POS/PMS daily reports
2. Spot-check 3-5 transactions per batch for legitimacy
3. Review all void transactions for policy compliance
4. Confirm dept head consent stamp is present and timestamp is valid
5. Flag anomalies (round-number patterns, unusual timing, same-staff clusters)

They are NOT responsible for entering, editing, or correcting transactions.
All corrections happen at Layer 1 (dept head corrects and resubmits).

### 7.2 The Approval Decision Framework

**APPROVE** when:
- Batch totals match supporting reports
- Expense categories are policy-compliant
- Voids have legitimate reasons + dept head approval
- No anomalies detected

**QUERY** when:
- A specific transaction requires clarification
- Expense seems unusual for the category
- Void reason doesn't match context
- Batch total doesn't align with POS report (minor discrepancy)
- Department head consent timestamp seems suspicious

**REJECT** when:
- Multiple fraudulent indicators present
- Dept head consent PIN cannot be verified
- Batch total significantly mismatches all supporting reports
- Unauthorized expense categories detected
- Pattern of voids suggests systematic manipulation

### 7.3 The CDO Override Protocol

The CDO can force-approve any batch if:
- Accounts officer is unavailable (emergency close-of-day)
- Operational urgency requires immediate master ledger posting
- CDO determines a query/reject is procedurally incorrect

CDO force-approval creates a special audit record:
- CDO ID, timestamp, override reason (mandatory, minimum 10 characters)
- Creates a `FORCE_APPROVAL` flag in `master_ledger` entry
- Auto-notifies ACC team of the override
- Appears in monthly CDO override report

---

## CHAPTER 8: DEPARTMENT P&L ACCOUNTING STRUCTURE

### 8.1 The Hospitality P&L Waterfall (USALI-Inspired)

Miracle OS follows a modified USALI (Uniform System of Accounts for the Lodging Industry) structure:

```
TIER 1: OPERATED DEPARTMENTS
  ┌─ Room Revenue (PMS/Front Desk)
  ├─ Food & Beverage Revenue (POS + F&B)
  ├─ Wellness Revenue (Sauna/Spa)
  ├─ Fleet Revenue (Transport)
  ├─ Boutique Revenue (Retail)
  └─ Other Operated (Rentals, Cinema, etc.)

TIER 2: UNDISTRIBUTED EXPENSES
  ├─ Administrative & General
  ├─ Human Resources (allocated)
  ├─ Information Technology (allocated)
  └─ Marketing & Sales

TIER 3: NON-OPERATING INCOME & EXPENSES
  ├─ Utilities
  ├─ Property Insurance
  └─ Management Fees

TIER 4: EBITDA (before interest/depreciation)

TIER 5: DEBT SERVICE
  ├─ Mortgage Sweep (PMS Owner model)
  └─ Loan Repayments

TIER 6: NET INCOME / (LOSS)
```

### 8.2 Cross-Department Revenue Sharing (Room Charge Flow)

When a guest charges Sauna treatment to their room:

**Sauna DEPT_WELLNESS records:**
```
Dr  Accounts Receivable — PMS Folio (1100-270)   PKR 8,000
Cr  Revenue — Treatment Fee (4100-270)            PKR 8,000
```
Till records: `REVENUE_ROOM_CHARGE | TREATMENT_FEE`

**At Checkout (Z-08), PMS settles:**
```
Dr  Cash/Bank (1000-300)                          PKR 8,000
Cr  Accounts Receivable — PMS Folio (1100-270)    PKR 8,000
```
The Wellness department's AR is cleared. Revenue is recognized in Wellness P&L.

### 8.3 Staff Commission Accounting

When a sales commission is earned by a PMS staff member:

**PMS DEPT records commission due:**
```
Dr  Commission Expense — PMS Revenue (5200-300)   PKR 2,000
Cr  Staff Commission Payable (2100-300)           PKR 2,000
```

**When commission is paid (payroll run):**
```
Dr  Staff Commission Payable (2100-300)           PKR 2,000
Cr  Bank (1000-300)                               PKR 2,000
```

---

## CHAPTER 9: THE CHART OF ACCOUNTS STRUCTURE

### 9.1 Account Code System

All GL accounts follow a 4-digit base code + 3-digit department suffix:
`[TYPE][CATEGORY]-[DEPT_GL_PREFIX]`

**Account Types:**
| Range | Type | Examples |
|---|---|---|
| 1000–1999 | ASSETS | Cash, Bank, Receivables, Inventory |
| 2000–2999 | LIABILITIES | Payables, Deferred Revenue, Loan |
| 3000–3999 | EQUITY | Owner's Equity, Retained Earnings |
| 4000–4999 | INCOME | All revenue categories |
| 5000–5999 | EXPENSES | All expense categories |
| 6000–6999 | DEPRECIATION | Fixed asset depreciation |
| 7000–7999 | FINANCING | Loan interest, bank charges |
| 8000–8999 | EXTRAORDINARY | One-time items, write-offs |

**Department GL Prefixes:**
| Dept | GL Prefix | Example |
|---|---|---|
| POS | 060 | Cash Till: 1000-060 |
| PMS / Front Desk | 300 | Room Revenue: 4200-300 |
| Wellness / Sauna | 270 | Treatment Revenue: 4100-270 |
| F&B / Gastronomy | 290 | FB Sales: 4300-290 |
| Boutique | 280 | Retail Sales: 4400-280 |
| Fleet | 260 | Fleet Revenue: 4700-260 |
| Rentals | 3B0 | Rental Income: 4700-3B0 |
| Admin / General | 000 | (no dept prefix — property-level) |

---

## CHAPTER 10: MULTI-ENTERPRISE SCALABILITY DOCTRINE

### 10.1 The Price Plan Gating Model

Miracle OS serves enterprises of different sizes. The accounting engine scales accordingly:

| Plan | Departments | Zones Included | Ledger Gateway | Live P&L |
|---|---|---|---|---|
| BASIC | POS + PMS only | 2 Revenue Centers | Basic batch review | Dept total only |
| PRO | POS + PMS + FB + Wellness | 4 Revenue Centers | Full Gateway | Dept P&L + comparison |
| ENTERPRISE | ALL departments | All 31 Zones | Full Gateway + AI Analysis | Full USALI P&L |

### 10.2 Adding a New Department (Developer Protocol)

To add a new earning zone to the accounting engine:

1. `POST /api/accounting/departments` with:
   - `zone_id`, `name`, `type`, `gl_prefix`, `head_user_id`, `price_tier`
2. System auto-creates:
   - Default expense catalog (from template for dept type)
   - Till record (opening float = 0)
   - Batch counter (0/20, OPEN)
   - GL account mappings (using gl_prefix)
3. Department head is notified of assignment
4. Accounts team receives notification to configure expense catalog limits
5. Frontend auto-renders department in:
   - Sidebar (if role-gated)
   - Ledger Auth Gateway filter tabs
   - P&L comparison grid

### 10.3 Removing a Department (Developer Protocol)

Departments are NEVER hard-deleted. Soft-deactivation only:
1. `PATCH /api/accounting/departments/{id}` with `active: false`
2. System checks: `pending_batches > 0` → REJECT deactivation until all batches cleared
3. System checks: `open_till_balance > 0` → REJECT until till is zeroed out
4. On deactivation: all historical data preserved, dept appears as "ARCHIVED" in reports
5. Department can be reactivated at any time by CDO

---

## CHAPTER 11: THE LIVE MONITORING DOCTRINE (ACC / GM / CDO VIEW)

### 11.1 What the Accounts Screen Shows (Real-Time)

The Accounts monitoring dashboard must display at all times:

**Header KPIs (auto-refreshing every 30 seconds):**
- Total Revenue Today (all depts combined)
- Total Expenses Today (all depts combined)
- Voids Pending Authorization (count + total PKR)
- Batches Pending Gateway Review (count)
- Departments with Low Till Balance (alert)

**Department Grid (one row per active dept):**
| Dept | Till Balance | Revenue Today | Expense Today | Voids | Batch Status |
|---|---|---|---|---|---|
| Sauna | PKR 45,200 | PKR 58,500 | PKR 3,300 | 3 pending | 16/20 |
| POS | PKR 12,800 | PKR 142,000 | PKR 8,200 | 0 | SUBMITTED |
| PMS | PKR 0 (bank) | PKR 385,000 | PKR 42,000 | 1 pending | APPROVED |

**Live Activity Feed (WebSocket):**
- "Sauna: PKR 3,500 treatment revenue — CASH — 3m ago"
- "POS: PKR 850 expense — Staff Meals — CONSENTED BATCH"
- "PMS: VOID initiated by [Staff ID] — GUEST_COMPLAINT — awaiting dept head"

### 11.2 The GM Dashboard (Observer Mode)

GM sees everything accounts sees, PLUS:
- Red flags (void patterns, limit breaches, cross-dept activity)
- Department head performance (consent times, rejection rates)
- Monthly P&L trend vs. budget (if budget is configured)
- Staff expense patterns (by individual, not just dept)

### 11.3 The CDO Dashboard (Strategic View)

CDO sees everything GM sees, PLUS:
- Cross-property P&L if multi-property deployment
- Price plan utilization (which enterprise features are being used)
- System health indicators for the accounting engine
- Audit log of all force-approvals and CDO overrides
- Department addition/removal history

---

## APPENDIX A: ACCOUNTING GLOSSARY (MIRACLE OS CONTEXT)

| Term | Meaning |
|---|---|
| **Till** | Live cash balance at a department counter |
| **Vault** | Complete department financial container (till + ledger + catalog + batches) |
| **Batch** | Container of up to 20 till transactions requiring dept head consent |
| **Consent** | Dept head PIN certification that a batch is accurate |
| **Gateway** | Layer 2 auth zone where accounts reviews submitted batches |
| **Primary Ledger** | Layer 1 dept-level double-entry records |
| **Master Ledger** | Layer 3 final immutable accounts ledger |
| **Expense Catalog** | Pre-approved department spending categories with GL codes |
| **Float** | Opening cash placed in till at shift start (from safe) |
| **Cash Drop** | Removal of surplus cash from till to safe during shift |
| **GL Code** | General Ledger account code (e.g., 4100-270 = Treatment Revenue, Wellness) |
| **Void** | Full reversal of a prior transaction |
| **Elimination** | Accounts' clearance of an approved void from the primary ledger |
| **Contra Entry** | Corrective entry to reverse a master ledger error (no edits allowed) |
| **UDI** | Undivided Interest — ownership share formula used in PMS pool accounting |
| **USALI** | Uniform System of Accounts for Lodging Industry — the hospitality accounting standard |
| **P&L** | Profit & Loss Statement |
| **EBITDA** | Earnings Before Interest, Taxes, Depreciation & Amortization |

---

## APPENDIX B: KNOWN EDGE CASES & HOW TO HANDLE THEM

| Edge Case | Correct Handling |
|---|---|
| Staff enters revenue in wrong dept | Void in wrong dept → re-enter in correct dept → both voided and re-entered go through dept head consent |
| Card payment fails after POS prints receipt | System marks as `REVENUE_CARD` with status `PENDING_SETTLEMENT` — updates to `SETTLED` on bank confirmation |
| OTA payout delayed beyond 45 days | AR aging report flags — manual follow-up entry from Accounts |
| Department head is on leave | System auto-escalates consent requests to backup dept head (configured in HR module) |
| Till balance discrepancy at shift close | Variance logged as `CASH_VARIANCE` — counted as expense (shortage) or income (overage) — requires dept head note |
| Accidental master ledger duplicate | CDO issues contra entry with `DUPLICATE_CORRECTION` flag — original entry remains |
| Price plan downgrade mid-month | Extra departments go SUSPENDED (not deleted) — all historical data preserved |

---
**AUTHOR**: ANTIGRAVITY AI × CDO Engineering
**VERSION**: V1.0-BIBLE | **DATE**: 2026-06-20
**CLASSIFICATION**: FOUNDING DOCTRINE — Miracle OS Financial Constitution
**COMPANION**: SOVEREIGN_ACCOUNTING_DIRECTIVE.md (technical laws & iron codes)
