# MIRACLE OS — CLAUDE CODE PROJECT RULES
# This file is automatically read by Claude Code at the start of every session.
# It gives Claude instant full context about this project without any re-analysis.

## PROJECT IDENTITY
- **Product:** Miracle OS — Enterprise Hospitality & Business Management SaaS
- **Company:** Vigilant IT Solution Ltd
- **Architecture:** Next.js 14 (frontend) + FastAPI (backend) + SQLite (VPS DB)
- **Live URL:** https://miracle.vigilantitsolution.com
- **API URL:** https://api.vigilantitsolution.com
- **Marketing site:** https://vigilantitsolution.com (/vigilant_website)

## REPO STRUCTURE
```
Miracle_Os_Master/
├── web/                          ← Next.js 14 App Router (Miracle OS frontend)
│   └── app/
│       ├── lib/packagePresets.ts ← SINGLE SOURCE OF TRUTH for zone packages
│       ├── kernel.ts             ← MASTER_ZONES[] — all 31 zone definitions
│       ├── layout.tsx            ← Sidebar + zone filter logic
│       ├── dashboard/page.tsx    ← Z-07 Master Command Grid
│       └── visitor-tour/page.tsx ← Demo launcher + token tour
├── backend_api/app/
│   ├── main.py                   ← FastAPI app + all router registration
│   ├── core/genesis.py           ← DB auto-migration (idempotent surgery)
│   ├── core/database.py          ← SQLAlchemy engine
│   ├── routers/                  ← 31+ zone routers
│   └── models/models.py          ← All ORM models
├── vigilant_website/             ← Next.js marketing site
│   └── app/tabs/DemoTab.tsx      ← Package selector (bridges to Miracle OS)
├── scripts/
│   ├── sovereign_patient_deploy.py  ← Deploy Miracle OS to VPS
│   └── sovereign_website_deploy.py  ← Deploy Vigilant website to VPS
└── .agents/
    └── SOVEREIGN_ENGINEERING_DIRECTIVE.md ← Full architecture reference
```

## THE 6 ENTERPRISE PACKAGES (Zone-Scoped)
| ID              | Name              | Target Client                    |
|-----------------|-------------------|----------------------------------|
| FB_SUITE        | F&B Suite         | Restaurant, café, bar            |
| SPA_SUITE       | Spa & Wellness    | Spa, salon, wellness center      |
| BOUTIQUE_SUITE  | Boutique & Retail | Boutique, gift shop, retail      |
| FLEET_SUITE     | Fleet & Transport | Car rental, tours, aviation      |
| HOTEL_PRO       | Hotel Pro         | Boutique hotel, guesthouse       |
| ENTERPRISE      | Enterprise        | Full resort, hotel group         |

**CANONICAL SOURCE:** `web/app/lib/packagePresets.ts` — never duplicate zone arrays elsewhere.

## KEY ZONE IDs (used throughout codebase)
Z-07=Dashboard, Z-29=F&B, Z-27=Spa, Z-28=Boutique, Z-26=Fleet, Z-30=PMS,
Z-05=Reservations, Z-08=Billing, Z-12=Inventory, Z-09=HR, Z-10=CRM,
Z-16=Issues, Z-17=Solve, Z-20=Synapse, Z-11=Accounts, Z-25=Marketing,
Z-VAULT=DeptVault, Z-DEPT-GW=BatchGateway, Z-MASTER=MasterLedger

## ZONE FILTER MECHANISM
- `vigilant_role = 'VISITOR'` in localStorage → sidebar filters zones
- `miracle_visitor_allowed_zones` = JSON array of allowed zone IDs
- Set by: `activatePackageDemo()` in `packagePresets.ts`
- Read by: `layout.tsx` sidebar nav

## DATABASE RULES
- DB: SQLite on VPS (`miracle_os_master.db`)
- All schema changes go in `genesis.py :: perform_database_surgery()`
- Pattern: `("table", "column", "ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...")`
- Genesis runs on every server boot — must be 100% idempotent
- New table: Use `CREATE TABLE IF NOT EXISTS` pattern

## BACKEND ROUTER REGISTRATION PATTERN
```python
# 1. Add import to main.py import block (lines 66-116):
    new_router as new_mod,   # ZONE XX: Description

# 2. Mount in main.py zone mounting section (after line 525):
app.include_router(new_mod.router, prefix="/api/xxx", tags=["ZONE XX: Name"])
```

## DEPLOYMENT
```bash
# Build first — always verify zero errors before deploy
cd web && npm run build

# Deploy Miracle OS (web + backend) to VPS
python scripts/sovereign_patient_deploy.py

# Deploy Vigilant marketing website
python scripts/sovereign_website_deploy.py
```

## ACCOUNTING ARCHITECTURE
- Every revenue zone is a Sovereign Profit Center
- Flow: Zone Router → Dept Vault (Z-VAULT) → Batch Gateway → Master Ledger
- NEVER post directly to master ledger — always via batch gateway consent
- Reference: `MIRACLE_SOVEREIGN_ACCOUNTING_ARCHITECTURE.md`

## ENGINEERING LAWS (NEVER VIOLATE)
1. `packagePresets.ts` is LAW — never hardcode zone arrays elsewhere
2. Genesis surgery is idempotent — `IF NOT EXISTS` or catch duplicate errors
3. No dead buttons — every UI element must route somewhere live
4. Visitor firewall active — backend blocks all POST/PUT/DELETE for VISITOR role
5. Build before deploy — `npm run build` must pass clean
6. Zone filter is client-side defense-in-depth — backend enforces access too
7. Clear `miracle_package` localStorage key on logout

## MIRACLEBOT AI CONTEXT
- MiracleBot reads `sessionStorage.miracle_visitor_context` (token tours)
- MiracleBot reads `localStorage.miracle_package` (package demo sessions)
- Greeting adapts to active package: "Welcome to your F&B Suite demo..."

## FILE PATHS FOR COMMON TASKS
| Task                         | File                                          |
|------------------------------|-----------------------------------------------|
| Add/edit a zone package      | `web/app/lib/packagePresets.ts`               |
| Add a new sidebar zone       | `web/app/kernel.ts` (MASTER_ZONES array)      |
| Add a DB column/table        | `backend_api/app/core/genesis.py`             |
| Create a new API route       | `backend_api/app/routers/new_router.py`       |
| Register new router          | `backend_api/app/main.py` (import + mount)    |
| Edit the demo launcher       | `web/app/visitor-tour/page.tsx`               |
| Edit marketing demo cards    | `vigilant_website/app/tabs/DemoTab.tsx`       |
| Deploy to VPS                | `scripts/sovereign_patient_deploy.py`         |

## FULL ARCHITECTURE REFERENCE
See: `.agents/SOVEREIGN_ENGINEERING_DIRECTIVE.md`
This has the complete zone map, flow diagrams, accounting layers, and all integration points.
