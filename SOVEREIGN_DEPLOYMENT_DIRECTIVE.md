# 🏛️ MIRACLE OS — SOVEREIGN DEPLOYMENT DIRECTIVE (V2.0)
> **PURPOSE**: This is the unhidden, standalone source of truth for all deployment operations to the Miracle OS VPS.
> **LAST UPDATED**: 2026-06-22
> **VERSION**: V68.0-SOVEREIGN-SRE
> **ZONES**: 34 active zones | **KERNEL**: V66.0-SOVEREIGN-SRE

---

## 🌐 PRODUCTION & DEV TARGETS
| Component | URL | VPS Path | Local Port |
|---|---|---|---|
| **Frontend (ERP)** | https://miracle.vigilantitsolution.com | `/home/vigilantitsolution-miracle/htdocs/miracle.vigilantitsolution.com` | `3000` |
| **Backend API** | https://miracle.vigilantitsolution.com/api | `/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api` | `8090` |
| **Vigilant Marketing Site** | https://www.vigilantitsolution.com | `/home/vigilantitsolution-www/htdocs/vigilantitsolution.com` | `3001` |
| **Web Builder Editor** | N/A (Local Dev Utility) | N/A (Local Dev) | `3003` |
| **Standalone Miracle POS**| N/A (AWS Template) | N/A (Local Dev) | `3005` |
| **WebSocket** | wss://miracle.vigilantitsolution.com/ws | Port 8090 (Proxied via Nginx) | `8090` |
| **VPS IP** | `23.88.50.87` (Hetzner) | User: `root` | N/A |

> [!IMPORTANT]
> **SSL NOTE**: We use `miracle.vigilantitsolution.com` for BOTH Frontend and API/WS calls because it has a valid Let's Encrypt certificate. `api.vigilantitsolution.com` is currently untrusted.

---

## 🚀 THE PATIENT DEPLOY ENGINE (IRON FIST)
To deploy the entire ecosystem safely, use the Sovereign Patient Deploy Engine exclusively.

> [!CAUTION]
> **STRICT AI DEPLOYMENT LAW**: NEVER attempt to zip the `.next` directory or build folders and upload them manually via SCP/SFTP. The Hetzner VPS will aggressively block and reset connections for large file transfers or rapid batch uploads. You MUST use the patient deploy engine below, even if it takes a long time.

> [!IMPORTANT]
> **SOVEREIGN ECOSYSTEM BUILD & PORT RULES:**
> - **Miracle OS** (`web/`): Build **LOCALLY on Windows** (Port 3000), then deploy `.next` to VPS via patient deploy.
> - **Vigilant Website** (`vigilant_website/`): Build **ON THE VPS ONLY** on Port 3001 (`rm -rf .next && npm run build`). Never build locally — Windows Turbopack hash differences cause `MODULE_NOT_FOUND` on Linux (Iron Law W-1).
> - **Web Builder** (`web_builder/`): Runs locally on Port 3003. Interacts with Backend Port 8090.
> - **Standalone Miracle POS** (`D:\Miracle POS`): Runs locally on Port 3005 (remapped to prevent collision).

### Full Deployment Protocol for Miracle OS:
1. **Build Frontend Locally** (MANDATORY — compiles `.next` bundle with correct hashes):
   ```powershell
   cd web; npm run build
   ```
   > This takes ~90 seconds. Do NOT skip this step. Simply restarting PM2 without a new build serves stale old CSS/JS chunk hashes (404 errors).

2. **Sync All Files** (uploads `.next` + source files, restarts PM2):
   ```powershell
   python -X utf8 scripts/sovereign_patient_deploy.py --target frontend --force
   ```
   > `--force` bypasses the file-change ledger and uploads everything. Use when CSS/layout is broken.
   > Without `--force`, only changed files upload (faster for backend-only changes).

3. **Backend Only** (if only Python files changed):
   ```powershell
   python -X utf8 scripts/sovereign_patient_deploy.py --target backend
   ```

4. **Hard Refresh Browser** after deploy:
   ```
   Ctrl + Shift + R  (clears cached CSS/JS hashes)
   ```

### What the Patient Deploy Engine automates:
1. **Connectivity Check**: Aborts if the VPS is unreachable.
2. **Backend Deployment**: Packages and uploads `backend_api` one file at a time (highly reliable on unstable networks).
3. **Database Sync**: Uploads `miracle_os_master.db` to the VPS to ensure grid parity.
4. **Kernel Sync**: Synchronizes `miracle_kernel.json`.
5. **Frontend Sync**: Uploads the pre-built local `.next` bundle one file at a time.
6. **Auto-Resume**: Progress is saved per-file, allowing instant resumption on SSH packet drops.
7. **PM2 Restart**: Auto-restarts `miracle-frontend` after upload.

---

## 📱 MOBILE APK UPDATE
If the Guest App logic or concierge UI is modified:

1. **Build Locally**:
   ```powershell
   $env:CAPACITOR_BUILD="true"; cd web; npm run build; npx cap sync android; cd android; .\gradlew assembleDebug
   ```
2. **Sync to Public Download Link**:
   ```powershell
   cp web/android/app/build/outputs/apk/debug/app-debug.apk web/public/miracle_guest.apk
   ```
3. **Deploy**:
   ```powershell
   python scripts/sovereign_patient_deploy.py frontend
   ```

---

## 🗺️ ZONE REGISTRY (34 ACTIVE ZONES)

> **Source of truth:** `web/app/kernel.ts` → `ZONE_PERMISSIONS` and `MASTER_ZONES`

| Zone ID | Name | Path | Roles |
|---------|------|------|-------|
| Z-07 | Command Grid | `/dashboard` | ALL |
| Z-30 | Sovereign PMS | `/dashboard/pms` | ALL |
| Z-05 | Reservations | `/dashboard/reservations` | ALL |
| Z-06 | POS / Retail | `/dashboard/pos` | ALL |
| Z-26 | Fleet & Aviation | `/dashboard/fleet` | ALL |
| Z-27 | Med-Spa & Wellness | `/dashboard/wellness` | ALL |
| Z-28 | Luxury Boutiques | `/dashboard/boutiques` | ALL |
| Z-29 | F & B | `/dashboard/z29-gastronomy` | ALL |
| Z-KDS | 🆕 Kitchen Display System | `/dashboard/orders` | CDO/GM/ADMIN/FB/CHEF/STAFF |
| Z-MENU | 🆕 Guest QR Table Menu | `/menu` | PUBLIC |
| Z-DELIVERY | 🆕 Rider Delivery Portal | `/delivery` | CDO/GM/ADMIN/RIDER/FB/STAFF |
| Z-3B | 🆕 Asset Rentals | `/dashboard/rental` | ALL |
| Z-25 | Guest Marketing | `/dashboard/guest-marketing` | ALL |
| Z-08 | Checkout / Billing | `/dashboard/checkout` | ALL |
| Z-16 | Issue Tickets | `/dashboard/issue-tickets` | ANY |
| Z-17 | Solve (Staff) | `/dashboard/solve` | ANY |
| Z-14 | Media Lab | `/dashboard/media-lab` | ALL |
| Z-18 | Biometric Portal | `/dashboard/portal` | ALL |
| Z-12 | Inventory Matrix | `/dashboard/inventory` | ALL |
| Z-09 | HR / Personnel | `/dashboard/hr` | ALL |
| Z-2B | 🆕 AGI Recruiting | `/dashboard/hr?tab=AGI_RECRUIT` | GM/ADMIN/HR |
| Z-10 | CRM / Guest Loyalty | `/dashboard/crm` | ALL |
| Z-19 | CORE PMS | `/dashboard/policy` | ALL |
| Z-20 | Synapse Nexus | `/dashboard/synapse` | ALL |
| Z-11 | Accounts & Audit | `/dashboard/accounts` | GM/ADMIN/ACC |
| Z-1B | 🆕 Ledger Auth Gateway | `/dashboard/accounts?tab=25` | GM/ADMIN/ACC |
| Z-11B | Accounting AGI | `/dashboard/agi-accounts` | GM/ADMIN/ACC |
| Z-11C | Sovereign Finance | `/dashboard/sovereign-finance` | GM/ADMIN/ACC |
| Z-21 | Kernel Settings | `/dashboard/settings` | CDO/GM/ADMIN |
| Z-23 | Sovereign Infra | `/dashboard/infrastructure` | CDO/GM/ADMIN |
| Z-GUEST | 🆕 Guest Concierge | `/guest` | ALL |
| Z-WEB | 🆕 Public Website | `/web` | ALL |
| Z-OWNER | 🆕 Owner Portal | `/owner` | ALL |
| Z-PROP | 🆕 Miracle Properties | `/properties` | ALL |

---

## 🤖 AI BEHAVIOR & NAVIGATION PROTOCOLS
1. **IDENTITY**: The AI is strictly named **Miracle**. It operates as a Sovereign Navigator.
2. **NAVIGATION**: Wisp guidance is the primary UI driver. Navigation to new zones occurs 1.5s after the directive is announced to ensure TTS clarity.
3. **GLOBAL SALES PERSONA**: If a user is logged in as a `VISITOR`, the AI adopts the *Enterprise Sales Executive* persona across the *entire* dashboard (all zones), pitching the AGI capabilities of Miracle OS.
4. **EXECUTION BARRIER & FIREWALL**: Visitors are strictly blocked from mutate operations (`POST`, `PUT`, `DELETE`, `PATCH`) by a backend middleware firewall. If a visitor asks the AI to execute an action (e.g. check-out, bookings), the AI must pitch the OS, block the command, and output `[BTN_WHATSAPP]` to connect them with the sales team.
5. **Z-LOGIN ONBOARDING**: Treat Z-LOGIN arrivals as new clients and collect: Name, Enterprise Name, Size, and Contact before providing demo credentials.
6. **CREDENTIAL HANDOFF**: Demo ID: `VISITOR` | Key: `Miracle4U`.

---
**AUTHOR**: ANTIGRAVITY AI | **SRE STATUS**: SOVEREIGN DEPLOYMENT V1.3 LOCKED

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

## 🏗️ ACTIVE DEPLOYMENT: SINGLE KERNEL BOM & GUEST APK (5-PHASE STRATEGY)
If you are the next developer picking up this task, you MUST execute these strictly in order:

### Phase 1: The Backend Core (Data Layer)
- **Tasks:** Update `models.py` (add `InventoryAuditLedger`), build the Wastage API in `inventory_api.py`, and harden `pos_router.py` to ensure Guest APK checkouts trigger the BOM deduction.
- **Deploy:** Backend test, `pm2 restart miracle-backend`.

### Phase 2: The Service Architect Components (React UI)
- **Tasks:** Build `ServiceArchitectBOM.tsx` and `WastageAuditLog.tsx` as universal components in `web/components/`. Implement the live COGS calculator and polished UI.
- **Deploy:** Local `npm run build` to verify frontend compilation.

### Phase 3: Z-26 to Z-29 Department Rollout (The Architects)
- **Tasks:** Strip the dummy POS out of Fleet, Wellness, and Boutiques. Build `dining/page.tsx`. Mount the `ServiceArchitectBOM` in all four zones so managers can start building services.
- **Deploy:** Full `npm run build`, `sovereign_patient_deploy.py all`, Server Restart.

### Phase 4: Z-25 (Marketing) & Z-19 (Front Desk) Linkage
- **Tasks:** Upgrade Z-25's Promo Form with the "Fetch from Vault" dropdown. Update Z-19 so Front Desk can bundle these services into Room Offers.
- **Deploy:** Full `npm run build`, `sovereign_patient_deploy.py frontend`.

### Phase 5: Guest APK Checkout & Z-07 Radar (The Final Loop)
- **Tasks:** Wire the Guest APK (`/guest/order`) to post directly to the POS checkout endpoint using the linked `item_id`. Update Z-07 Command Grid so these orders pulse the `RS` radar.
- **Deploy:** Final `npm run build`, rebuild APK via Capacitor, `sovereign_patient_deploy.py frontend`.
