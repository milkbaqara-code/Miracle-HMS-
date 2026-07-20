# SOVEREIGN ENGINEERING DIRECTIVE (V1.0 — FULL STACK)
# Miracle OS | Miracle Eco Resort | Vigilant IT Solutions
#
# > AGENTIC HANDSHAKE: Any AI agent or developer starting work on the
# > Frontend (web/), Backend (backend_api/), or Guest APK (web/android/)
# > MUST read this document IN FULL before touching a single file.
# > This is the Engineering Constitution. Violating it breaks the habitat.

---

## DIRECTIVE CHAIN (READ ORDER FOR AI AGENTS)

Before any code task, execute this discovery chain IN ORDER:

| Step | File | Purpose |
|------|------|---------|
| 1 | `.antigravityrules` | Hard constraints, credentials, deployment laws |
| 2 | `SOVEREIGN_AI_DIRECTIVE.md` | AI persona, voice engine, phonetic laws |
| 3 | **THIS FILE** | Frontend, Backend, APK engineering standards |
| 4 | `miracle_kernel.json` | Zone map and knowledge base for AI responses |
| 5 | `scratch/diagnose_ai.py` | Run to verify all kernel files are intact |

---

## PART 1: FRONTEND ENGINEERING LAW (web/)

### 1.1 The Design System (The Single Source of Truth)

All visual decisions originate from `web/app/globals.css`. **Never override the design system with inline styles.**

#### CSS Tokens — USE THESE, NEVER HARDCODE PIXELS:
```
Spacing: --space-xs / --space-sm / --space-md / --space-lg / --space-xl
Text:    --text-xs / --text-sm / --text-md / --text-lg / --text-xl / --text-hero
Colors:  --neon-cyan (#00F2FF)  | Primary actions, active states
         --neon-gold (#D4AF37)  | Highlights, VIP, premium elements
         --neon-burgundy (#D70F64) | Secondary branding accents
         --surface-dark (#050505)  | Page backgrounds
         --surface-glass (rgba 15,15,15,0.7) | Card backgrounds
Touch:   --touch-min: 44px     | Minimum button size (Apple HIG)
Radius:  --radius-sm/md/lg/xl  | Consistent border-radius
```

#### Typography (Hardcoded — DO NOT CHANGE):
- **Primary Font:** `Inter` (body text, data, labels)
- **Display Font:** `Cinzel` (hero titles, zone headers)
- **Weight System:** 400 (body) / 700 (emphasis) / 900 (hero)

### 1.2 CSS Anti-Bloat Law (NON-NEGOTIABLE)

`globals.css` is the ONLY global stylesheet. It currently has 10 sections (see the INDEX at the top of the file).

- **RULE 1:** NEVER append new styles to the end of `globals.css`. Merge into existing sections.
- **RULE 2:** If `globals.css` exceeds 900 lines, STOP and run a de-duplication audit first.
- **RULE 3:** All new components MUST use `--space-*` and `--text-*` tokens. No hardcoded `px` values.
- **RULE 4:** Animations MUST only use `transform`, `opacity`, or `filter`. NEVER animate `width`, `height`, or `margin`.
- **RULE 5:** Mobile styles LIVE EXCLUSIVELY inside `@media (max-width: 767px)`. Desktop is the base style.

### 1.3 Component Architecture (Next.js 14)

```
web/
├── app/                  ← Miracle OS ERP App
│   ├── globals.css       ← DESIGN SYSTEM (The Law)
│   ├── layout.tsx        ← Root shell
│   ├── dashboard/        ← ERP Zones (Z-07 to Z-30)
│   └── guest/            ← Guest APK pages (Capacitor)
vigilant_website/         ← Marketing Site (Port 3001)
web_builder/              ← Web Builder Editor (Port 3003)
```

#### Component Rules:
- **State:** Use `useState` and `useReducer`. No global state libraries (no Redux).
- **Performance:** ALL callbacks inside components must use `useCallback`. ALL computed values use `useMemo`.
- **API Calls:** All fetches go to `process.env.NEXT_PUBLIC_API_URL || '/api'`. Never hardcode the domain.
- **Auth:** Read role from `localStorage.getItem('vigilant_role')`. Write via the `/api/auth/token` endpoint only.

### 1.4 Mobile-First Protocol (Capacitor / Android APK)

The Guest APK is built from `web/` using Capacitor. Every page must work as an Android app.

- Use `env(safe-area-inset-*)` for notch-safe layouts (already in CSS tokens as `--safe-*`).
- Use `100dvh` (not `100vh`) for full-screen mobile pages to account for browser chrome.
- All touch targets MUST be minimum `44x44px` (enforced via `--touch-min`).
- Capacitor bridge is at `web/android/`. NEVER look for it in the root.
- After any frontend change, run: `cd web && npm run build && npx cap sync android`.
- **Capacitor Cookies:** If cookie-based auth is ever used remotely, `CapacitorCookies` MUST be enabled in `capacitor.config.ts`. If it's not, `document.cookie` throws a `SecurityError` causing a crash. Prefer header-based tokens where possible.

---

## PART 2: BACKEND ENGINEERING LAW (backend_api/)

### 2.1 The Router Map (main.py — The Sovereign Binding)

All API routes are registered in `backend_api/app/main.py`. **Do not add a new router without registering it here.**

```
ZONE 02:  /api/auth         ← auth.py          (Identity & Sessions)
ZONE 05:  /api/frontdesk    ← frontdesk_engine  (Reservations & Tape Chart)
ZONE 05:  /api/reservation  ← reservation_engine (OTA Channels)
ZONE 08:  /api/billing      ← billing           (Guest Folio Settlement)
ZONE 11:  /api/hr           ← hr                (Payroll & Staff)
ZONE 12:  /api/inventory    ← inventory_engine  (Stock Vault)
ZONE 14:  /api/pos          ← pos_router        (Point of Sale)
ZONE 17:  /api/solve        ← solve_router      (Mission Board)
ZONE 18:  /api/accounting   ← accounting_engine (Double-Entry Ledger)
ZONE 19:  /api/policy       ← policy            (Room Pricing Policy)
ZONE 21:  /api/settings     ← settings          (Kernel Settings)
ZONE 23:  /api/infra        ← infra             (VPS Monitoring)
ZONE 25:  /api/guest        ← guest_api         (Guest Marketing)
MIRACLE:  /api/bot/v2       ← bot_router_v2     (AI V2 — PRODUCTION)
WB_AUTH:  /api/wb/auth      ← wb_auth           (Web Builder Subscriber Auth)
WB_PROJ:  /api/wb/projects  ← wb_projects       (Web Builder Save/Load)
WB_PAY:   /api/wb/payments  ← wb_payments       (Web Builder Stripe Gate)
WEBSOCKET:/ws/grid-sync                         (Real-time Command Grid)
HEALTH:   /api/health                           (Deployment Ping)
```

### 2.2 Database Law (SQLAlchemy + PostgreSQL)

- **NO MOCKS, NO FAKE DATA:** Empty tables return `[]`. Never hardcode test data in production code.
- **Transactions:** All financial writes use `with db.begin_nested():` for atomic savepoints.
- **Concurrency:** Use `.with_for_update()` for any inventory or booking write to prevent race conditions.
- **No N+1 Queries:** Use `.options(joinedload(...))` for related data. Never query inside a loop.
- **ASCII Only:** All Python files MUST be pure ASCII. No em-dashes (—), no smart quotes. Use hyphens (-).

### 2.2b IRON LAW 52: POS ENGINE BOM SYNC
All Z-26 (Fleet), Z-27 (Wellness), Z-28 (Boutiques), and Z-29 (Gastronomy) products MUST include a strict JSON `bom` array linking directly to Z-12 Raw Materials. The Master POS router (`pos_router.py`) must deserialize these BOMs during checkout and recursively deduct raw materials from the master vault. Do NOT bypass the master vault for departmental inventory.

### 2.2c IRON LAW 53: MIRACLE KERNEL SYNC
The root `miracle_kernel.json` is the singular source of truth for the system map, AI knowledge, and zone permissions. The backend serves this map to the frontend via `/api/settings/kernel`. Any updates made to the root `miracle_kernel.json` MUST be immediately copied to `backend_api/app/miracle_kernel.json` before deploying. Failure to sync these files will cause "Zone Blindness" in the frontend UI.

### 2.3 Model Structure

```
backend_api/app/models/
├── models.py           ← All operational tables (Rooms, Guests, Inventory, etc.)
└── miracle_ai_models.py ← AI-specific tables (Sessions, Leads, Knowledge, Logs)
```

**Adding a new table:**
1. Define the class in the correct models file.
2. Import it in `main.py` (as a `noqa` import so Genesis auto-creates it).
3. Genesis (`core/genesis.py`) will create the table on next boot. No manual `ALTER TABLE`.

### 2.4 Error Handling Protocol

Every FastAPI route MUST follow this pattern:
```python
@router.post("/endpoint")
async def my_endpoint(payload: MySchema, db: Session = Depends(get_db)):
    try:
        # Business logic here
        return {"status": "ok", "data": result}
    except HTTPException:
        raise  # Re-raise FastAPI HTTP errors as-is
    except Exception as e:
        logger.error(f"[MY_ENDPOINT] Failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
```

### 2.5 AI Engine Architecture (The 4-Layer Brain)

```
Layer 0 → ai_analysis.py (classify_locally)   ← 0 Tokens, instant
Layer 1 → bot_router_v2.py (intent routing)   ← ~150 Tokens
Layer 2 → ai_analysis.py (DB analytics tools) ← 0 Tokens, SQL
Layer 3 → bot_router_v2.py (executive synth)  ← ~400 Tokens
```

**RULE:** Miracle AI self-lea---

## PART 3: SRE DIAGNOSTICS & ERROR HANDLING (V2.0 -- 2026-05-09)

### 3.1 Real-Time System Observability
Miracle OS is an SRE-first environment. All system states must be observable via the Z-23 Infrastructure Dashboard.
- **Log Aggregation:** Every backend exception and frontend console error must be captured by the `SystemErrorLogs` pipeline.
- **Endpoint Matrix:** The system monitors API connectivity through live pinging of routes. If a route fails, the CDO must be notified with a root-cause trace (e.g., port conflict, database timeout).

### 3.2 Pure SQL Delegation (Non-Negotiable)
Hardcoded "surgical fixes" and AI memory rules are deprecated.
- **Standard:** Any query requiring business data (sales, occupancy, prices) must use `EXECUTE_SQL: SELECT...`. 
- **Validation:** AI is forbidden from fabricating numbers. If the database returns no data, the AI must report "No data found in DB" rather than "guessing".

### 3.3 Dashboard (Z-23 SRE)
- **Telemetry:** Real-time monitoring of CPU, RAM, and Disk on the VPS.
- **Process Control:** PM2 overrides for `miracle-backend` and `miracle-frontend`.
- **Diagnostics:** Analysis of stack traces via the CDO Diagnostics Pipeline.

---

## PART 4: SOVEREIGN-FIRST DEVELOPMENT PROTOCOL

### 4.1 The Mandatory Build Order
Every new feature or AI fix MUST attempt each step in order. Skip a step ONLY if it genuinely cannot solve the problem.

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: BUILT-IN ENGINE (Free, Instant, Sovereign)                  │
│  → Pure Python + miracle_kernel.json + DB query                     │
│  → Examples: deterministic_audit_check(), classify_locally()        │
│  → If this solves it: DONE. Zero cost.                              │
├─────────────────────────────────────────────────────────────────────┤
│ STEP 2: SOVEREIGN SENSOR PILLARS (Free, Live DB)                    │
│  → ai_analysis.py Pillars 1-5                                       │
│  → Extends an existing sensor or adds a new one                     │
│  → If this solves it: DONE. Zero cost.                              │
├─────────────────────────────────────────────────────────────────────┤
│ STEP 3: PAID GEMINI API (Last Resort)                               │
│  → Only if Steps 1+2 cannot solve it                                │
│  → Document WHY in commit message                                   │
│  → Use GEMINI_API_KEY (VPS primary). Never hardcode other names.    │
│  → AUDIT_LLM_ENABLED stays False in production. Always.             │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Validation Gate — Before Injecting Any Fix
No correction is injected into the AI brain (`miracle_knowledge`) without passing these gates:

1. **Ground Truth Check:** Verify the correction against `miracle_kernel.json` zone data
2. **Pattern Test:** Test the detection pattern against 3+ similar queries to confirm no false positives
3. **Injection:** Only then set `importance_score=10`, `category=ANTI_HALLUCINATION`

### 4.3 miracle_kernel.json is the Single Source of Truth
- The audit engine (`ai_self_audit.py`) reads ALL zone/button/navigation facts from `miracle_kernel.json` at startup
- To add a new fact: update `miracle_kernel.json` → the audit engine picks it up automatically on next restart
- To add a new detection rule: add to `deterministic_audit_check()` referencing `MIRACLE_OS_GROUND_TRUTH`
- Never duplicate facts by hardcoding them in Python when they already exist in the kernel file

---

## PART 4: DEPLOYMENT LAW

### 4.1 Master Deploy (VPS)
```powershell
cd web; npm run build; cd ..; python scripts\sovereign_patient_deploy.py all
```
This command:
1. **MUST** have `npm run build` run inside the `web` folder first.
2. Uses the patient deploy engine to upload file-by-file (to bypass security blocks).
3. Auto-restarts PM2 for both frontend and backend upon completion.

### 4.2 Legacy Scripts (FORBIDDEN)
Never use `vps_tar_deploy.py`, `vps_delta_sync.py`, `fast_deploy_next.py`, or any scratch deployment scripts. They are permanently banned.

### 4.3 APK Build (Android)
```powershell
$env:CAPACITOR_BUILD="true"
cd web
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
# Output: web/android/app/build/outputs/apk/debug/app-debug.apk
# MANDATORY: Copy to web/public/miracle_guest.apk
```

### 4.4 Content Security Policy (CSP) Whitelist Mandate
**ROOT CAUSE:** Miracle OS enforces strict CSP in `next.config.ts`. Unlisted external APIs will work locally but crash in production.
**RULE:** Anytime a new external API fetch or image source is added to the frontend, you MUST add its domain to `web/next.config.ts` (inside the `connect-src` or `img-src` directive).
**VIOLATION:** Skipping this step guarantees the feature will fail silently on the live server.

---

## PART 5: APOPTOSIS PROTOCOL (CODE CLEANUP)

### 5.1 Apoptosis Protocol (Code Deletion)
Never leave "ghost" code (commented out blocks, dead files, `_old` variants) in the active directory. 
1. **Purge:** Ruthlessly delete decommissioned logic (e.g., the legacy Immune System).
2. **Context:** If an AI needs historical context on why something was deleted, it must query the Git history. Do not pollute the live context window with dead code.

## PART 6: SOVEREIGN SRE PROTOCOL

### 6.1 Diagnostic Hands
The AI uses the following "Hands" to maintain the infrastructure:
*   **Sensor:** `SovereignAnalysisEngine.get_system_health()`.
*   **Function:** Audits DB connectivity, PM2 process states, and VPS telemetry.
*   **Trigger:** Automatically fired when a user asks about "health", "infrastructure", or "errors".

### 6.2 The CDO Diagnostics Pipeline
- **Analysis:** AI decodes stack traces from `SystemErrorLogs`.
- **Correction:** AI generates actionable code/config fixes for the developer.

---

## PART 7: UI VISIBILITY & PERSISTENCE
1. **WISP PERSISTENCE:** The Wisp navigator (`.miracle-wisp`) MUST use `position: fixed` and a high `z-index` (999999) to remain visible across all panels, including the Master Command Grid.
2. **SPEECH CONTINUITY:** Navigational speech must not be interrupted by auto-generated greeting prompts. Auto-greetings for standard dashboard zones are disabled to preserve this continuity.

---

**DIRECTIVE VERSION:** V5.0 | **LOCKED:** 2026-05-10 | **AUTHOR:** ANTIGRAVITY AI
**SRE STATUS:** Stabilized Persistence | Fixed Wisp Visibility | Hardened TTS Purity

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
4. **EXPECTED APK SIZE**: Approximately 30-80MB. If it exceeds 200MB, the `out/` folder was accidentally bundled.
---

---
### 🚨 GHOST MIDDLEWARE PURGE PROTOCOL (IRON LAW 48 — 2026-05-22)

**ROOT CAUSE:** Next.js compiles `middleware.ts` (or proxy.ts when configured as middleware) into `.next/server/middleware.js` at build time. The `sovereign_patient_deploy.py` script is a DELTA sync — it only uploads files that CHANGED. It does NOT delete old files on the VPS. A stale `middleware.js` survives on the VPS indefinitely, intercepting ALL requests to `/guest` and returning `307 Temporary Redirect`. In the Android Capacitor WebView, a 307 = immediate BLACK SCREEN.

**SYMPTOMS:**
- PM2 logs print: `SECURITY INTERCEPT: Blocked unauthorized access to /guest`
- `https://miracle.vigilantitsolution.com/guest` returns HTTP 307
- Android APK installs successfully but shows an immediate **black screen** on launch
- Bug persists EVEN AFTER the middleware source is fixed locally and redeployed via delta sync

---

## THE SURGICAL FIX — 315 BYTES, NOT 850MB

> **CRITICAL LESSON (2026-05-22):** An agent wasted time deploying 1,218 files (~850MB build)
> to fix a ghost middleware issue. THIS IS ALWAYS WRONG. The fix is 2 SSH commands and
> uploading 1 file that is 83 bytes. Total data transferred = ~315 bytes.

**STEP 1 — Diagnose first (check PM2 logs):**
```powershell
python scripts/vps_cmd.py "pm2 logs miracle-frontend --lines 20 --nostream"
```
If you see `SECURITY INTERCEPT` for `/guest` → ghost middleware confirmed. Proceed to Step 2.

**STEP 2 — Delete the ghost via SSH (no code change, no local build, no deploy):**
```powershell
python scripts/vps_cmd.py "rm -f /home/vigilantitsolution-miracle/htdocs/miracle.vigilantitsolution.com/.next/server/middleware.js /home/vigilantitsolution-miracle/htdocs/miracle.vigilantitsolution.com/.next/server/middleware-manifest.json && echo [OK] Deleted"
```

**STEP 3 — MANDATORY: Restore the clean middleware-manifest.json (83 bytes):**
> WARNING: Deleting middleware-manifest.json WITHOUT replacing it = Next.js crashes with
> `MODULE_NOT_FOUND` and HTTP 500. You MUST upload the clean local copy immediately.
> The clean local file is at `web/.next/server/middleware-manifest.json` and contains:
> `{"version": 3, "middleware": {}, "sortedMiddleware": [], "functions": {}}`

```python
# Save as a one-off script or run inline. Uploads ONLY the 83-byte manifest:
import paramiko
from pathlib import Path
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
key = paramiko.RSAKey.from_private_key_file(str(Path.home()/'.ssh'/'miracle_os_key'))
ssh.connect('23.88.50.87', username='root', pkey=key, timeout=30)
sftp = ssh.open_sftp()
sftp.put(
    r'web\.next\server\middleware-manifest.json',
    '/home/vigilantitsolution-miracle/htdocs/miracle.vigilantitsolution.com/.next/server/middleware-manifest.json'
)
sftp.close()
_, stdout, _ = ssh.exec_command('pm2 restart miracle-frontend && echo [OK]')
stdout.read()
ssh.close()
print('[DONE] Ghost purged and PM2 restarted')
```

**STEP 4 — Verify (must return 200):**
```python
import urllib.request
r = urllib.request.urlopen('https://miracle.vigilantitsolution.com/guest')
print('HTTP', r.status)  # Must print: HTTP 200
```
If still 307 → a second ghost exists. Check `.next/server/middleware/` directory too.

---

**THE GUEST ROUTE WHITELIST CONTRACT (MUST STAY IN server.js — NEVER CHANGE):**
```javascript
// CORRECT: /guest is the PUBLIC login page. Only sub-routes are protected.
const isProtected = pathname.startsWith('/dashboard')
  || pathname.startsWith('/guest/hub')
  || pathname.startsWith('/guest/cinema')
  || pathname.startsWith('/guest/concierge')
  || pathname.startsWith('/guest/ecommerce')
  || pathname.startsWith('/guest/folio')
  || pathname.startsWith('/guest/order')
  || pathname.startsWith('/guest/profile')
  || pathname.startsWith('/guest/reserve');

// FORBIDDEN — blocks the login page → causes black screen:
// pathname.startsWith('/guest')  <-- NEVER WRITE THIS
```

**ABSOLUTELY FORBIDDEN:**
- Editing middleware source locally then running `sovereign_patient_deploy.py frontend` as the fix. This deploys 1,200+ files and still does NOT remove the ghost. It is always wrong.
- Deleting `middleware-manifest.json` without immediately uploading the clean 83-byte replacement. This crashes the server with HTTP 500.
- Assuming delta sync removed old compiled files. It never does.
---

**SYMPTOMS:**
- PM2 logs print: `SECURITY INTERCEPT: Blocked unauthorized access to /guest`
- `curl -I https://miracle.vigilantitsolution.com/guest` returns HTTP 307
- Android APK installs successfully but shows an immediate **black screen** on launch
- Bug persists EVEN AFTER the middleware source is fixed locally and redeployed via delta sync

**DIAGNOSIS STEPS:**
1. Check PM2 logs: `python scripts/vps_cmd.py "pm2 logs miracle-frontend --lines 20 --nostream"`
2. If you see `SECURITY INTERCEPT` for `/guest` → ghost middleware confirmed.
3. Run: `curl -I https://miracle.vigilantitsolution.com/guest` → must return 200, not 307.

**FIX: FULL .NEXT WIPE AND REPLACE (the ONLY solution):**
```powershell
cd web; npm run build; cd ..; python scripts/sovereign_patient_deploy.py all
```
The patient deploy script handles `.next` recreation gracefully and auto-restarts PM2. Do not use deprecated fast deploy scripts.

**VERIFY THE FIX:**
```powershell
curl -I https://miracle.vigilantitsolution.com/guest
# Must return: HTTP/2 200 (NOT 307)
```

**THE GUEST ROUTE WHITELIST CONTRACT (MUST STAY IN server.js — NEVER CHANGE):**
```javascript
// CORRECT: Only sub-pages of /guest are protected. /guest itself is the public login.
const isProtected = pathname.startsWith('/dashboard')
  || pathname.startsWith('/guest/hub')
  || pathname.startsWith('/guest/cinema')
  || pathname.startsWith('/guest/concierge')
  || pathname.startsWith('/guest/ecommerce')
  || pathname.startsWith('/guest/folio')
  || pathname.startsWith('/guest/order')
  || pathname.startsWith('/guest/profile')
  || pathname.startsWith('/guest/reserve');

// FORBIDDEN: This pattern blocks the login page itself — causes the black screen!
// const isProtected = pathname.startsWith('/guest'); // <-- NEVER DO THIS
```

**FORBIDDEN:**
- Using `sovereign_patient_deploy.py frontend` to fix a ghost middleware issue. It will NOT delete the ghost.
- Assuming delta sync removes old compiled files. It does not.
- Deploying `proxy.ts` to the VPS without renaming it away from middleware convention.
---

---
### 🚨 IRON LAW 51: SOVEREIGN APK / CAPACITOR DEVELOPMENT PROTOCOL
**Never break the Android App. The APK WebView is fragile and requires these strict rules.**

| Law | Rule |
|-----|------|
| **APK LAW 1** | Session MUST be read synchronously in `useState` initializer (`useState(() => JSON.parse(localStorage.getItem('session')))`). Never async in `useEffect` or you will trigger a black screen. |
| **APK LAW 2** | FORBIDDEN: `return null` while loading. You MUST always return a UI element (e.g., gold loading spinner) while awaiting hydration. |
| **APK LAW 3** | Write `localStorage` first, wait 50ms (`await new Promise(r => setTimeout(r, 50))`), then `router.replace()`. WebView race conditions will drop writes if you push immediately. |
| **APK LAW 4** | Auth tokens MUST be passed in the `Authorization: Bearer` header. NEVER rely on `document.cookie` because Capacitor will throw `SecurityError` or drop cookies remotely. |
| **APK LAW 5** | `/guest/*` routes MUST NEVER be included in `proxy.ts` protected paths. |
| **UI REDESIGN**| All Hub and Cinema interfaces must adhere to luxury styling (Playfair Display, glassmorphism, no simple emoji buttons) while maintaining these strict laws. |
---

---
## PART 8: SOVEREIGN DESIGN SYSTEM V5.0 — GLASSMORPHIC NEON UI CONSTITUTION
> This section governs ALL visual decisions across the entire platform.
> Violation = breaking change. Every UI element MUST conform.

### 8.1 The Golden Rules

1. **ZERO INLINE px VALUES** — Use CSS tokens: `--space-*`, `--text-*`, `--radius-*`
2. **ZERO TAILWIND IN COMPONENT FILES** — Use `.s-panel`, `.s-btn`, `.s-input`, etc. from `globals.css`
3. **ZONE COLOR INHERITANCE** — Every zone panel/button receives its color via the CSS custom property `--zone-color`. Set it on the parent: `<div class="zone-purple">` — children inherit automatically
4. **GLASSMORPHIC BASE** — All cards use `backdrop-filter: blur(20px)` + `background: rgba(255,255,255,0.015)` + `border: 1px solid rgba(255,255,255,0.06)`
5. **NEON GLOW** — Active/hover states use `box-shadow: 0 0 30px var(--zone-color)` — NEVER flat solid backgrounds
6. **NO DOS-STYLE FORMS** — Every input field, button, and form must look premium. If it looks like 1990s terminal: STOP and restyle

### 8.2 The Sovereign CSS Class System (globals.css Section 11)

All classes are defined in `web/app/globals.css` Section 11. Use them by className:

| Class | Purpose |
|-------|---------|
| `.s-panel` | Glass card container with blur + subtle border |
| `.s-panel--glow` | Panel with zone-color neon border and shadow |
| `.s-input` | Glass input field — auto-glows in zone color on focus |
| `.s-label` | Uppercase 10px tracking label above inputs |
| `.s-btn` | Primary zone-colored neon action button |
| `.s-btn--ghost` | Secondary/cancel button (dim, no glow) |
| `.s-btn--danger` | Delete/destructive action (red neon) |
| `.s-tabs` | Flex tab container |
| `.s-tab` | Individual tab button, `.active` applies zone color |
| `.s-metric` | KPI card with animated top border glow line |
| `.s-metric__label` | Label inside metric card |
| `.s-metric__value` | Large monospace number inside metric card |
| `.s-row` | Data list row with hover zone-color tint |
| `.s-badge` | Pill label: `--success`, `--warning`, `--danger`, `--zone` variants |
| `.s-divider` | Neon gradient horizontal rule |
| `.s-modal-overlay` | Full-screen glass backdrop for modals |
| `.s-modal` | Modal container with zone-color border |
| `.s-progress-track` | Progress bar container |
| `.s-progress-fill` | Animated progress fill with zone-color glow |
| `.s-pulse` | 8px pulsing dot indicator |
| `.s-arch-header` | Standard Architect Engine header row |
| `.s-arch-title` | 22px bold white title |
| `.s-arch-subtitle` | 10px dim subtitle |

### 8.3 Zone Color Map

Apply on the outermost container of each zone panel:

| Zone | Class | CSS Value |
|------|-------|-----------|
| Z-29 Gastronomy | `.zone-amber` | `#F59E0B` |
| Z-27 Wellness | `.zone-purple` | `#9D00FF` |
| Z-28 Boutique | `.zone-green` | `#00FF88` |
| Z-26 Fleet | `.zone-orange` | `#FF8C00` |
| Z-17 Cinema | `.zone-pink` | `#FF6B9D` |
| Accounting / Financial | `.zone-gold` | `#D4AF37` |
| Active alerts | `.zone-red` | `#FF3131` |
| Default / System | `.zone-cyan` | `#00F2FF` |

### 8.4 Architect Engine Standard Pattern

Every zone's Architect Engine MUST follow this pattern:
```tsx
// 1. Wrap outermost div with zone class
<div className="zone-purple">

  {/* 2. Header */}
  <div className="s-arch-header">
    <div>
      <div className="s-arch-title">⚒ Architect Engine</div>
      <div className="s-arch-subtitle">Z-27 — WELLNESS</div>
    </div>
    <div className="s-tabs">
      <button className="s-tab active">GALLERY</button>
      <button className="s-tab">CREATE</button>
      <button className="s-tab">EDIT</button>
    </div>
  </div>

  {/* 3. Content panels */}
  <div className="s-panel s-panel--glow">
    <label className="s-label">Service Name</label>
    <input className="s-input" />
    <button className="s-btn">PUBLISH SERVICE</button>
    <button className="s-btn s-btn--danger">DELETE</button>
  </div>

</div>
```

### 8.5 Animation Laws

All animations MUST use `@keyframes sovereignFadeIn`, `sovereignSlideUp`, or `sovereignPulse` defined in globals.css.
- NEVER animate `width`, `height`, `top`, `left`, or `margin`
- ONLY animate `transform`, `opacity`, `box-shadow`, `filter`, or `color`
- Duration: 200ms (micro), 300ms (panel), 1200ms (progress bars)
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` for all slide/grow animations

### 8.6 The "WOW Factor" Checklist

Before shipping any UI panel, confirm:
- [ ] Glassmorphic card (`backdrop-filter: blur`) — check
- [ ] Zone-color top border accent line — check
- [ ] Hover state produces neon glow — check
- [ ] Inputs light up in zone color on focus — check
- [ ] Buttons are NOT flat solid blocks — they have subtle transparency + glow — check
- [ ] Data values use monospace font (`'Courier New', monospace`) — check
- [ ] No hardcoded `#000000` background — use `rgba(0,0,0,0.4)` — check
- [ ] No Times New Roman or system-default serif fonts — Inter always — check

**ENFORCEMENT:** Any PR that fails this checklist will be rejected. The goal: every panel feels like a live financial trading terminal on a luxury superyacht — not a 1990s DOS application.

---

**DIRECTIVE VERSION:** V6.0 | LOCKED: 2026-05-26 | SECTION: Sovereign Design System V5.0

---

## 9. AGI CoA INTELLIGENCE ENGINE (Z-11B) -- SOVEREIGN NEW ZONE (2026-06-05)

### Zone Profile
| Key | Value |
|---|---|
| **Zone ID** | Z-11B |
| **Name** | Accounting AGI |
| **Path** | /dashboard/agi-accounts |
| **Color** | .zone-gold (#D4AF37) |
| **Backend** | /api/accounting/agi/* |

### UI Tabs (all use sovereign CSS system classes)
| Tab | Mode | Description |
|---|---|---|
| STATUS | Read-only | Engine health, KPIs, 10 sub-engine status grid |
| CLASSIFY | DRY RUN (default) | Test description -> CoA mapping, no DB write |
| POST ENTRY | ARMED only | Live journal post (requires toggle + confirmation modal) |
| TAX ENGINE | ARMED | Gross->Net/VAT/SC auto-split and post |
| PAYROLL | ARMED | Division payroll post with Dr/Cr journal |
| INTER-PROPERTY | ARMED | Z-30 commission/rent/fee between properties |
| FRAUD SCAN | Read-only | Anomaly detection across all journals |
| PERIOD CLOSE | Read-only | P&L snapshot by month/year |
| RULES | Read-only | All 62 deterministic classification rules |

### Anti-Hallucination Laws for Z-11B
1. NEVER generate financial amounts from AI inference
2. CLASSIFY tab is always the default (safe dry-run)
3. ARMED toggle must be manually flipped -- no auto-arm
4. Confirmation modal MUST show full Dr/Cr journal before posting
5. All account auto-creation is logged in the audit trail

---

**DIRECTIVE VERSION:** V7.0 | UPDATED: 2026-06-05 | Z-11B AGI ACCOUNTING

---

## 10. FINANCIAL INTELLIGENCE WAR ROOM (Z-11C) — ROTHSCHILD TIER (2026-06-05)

### Zone Profile
| Key | Value |
|---|---|
| **Zone ID** | Z-11C |
| **Name** | Financial Intel |
| **Path** | /dashboard/sovereign-finance |
| **Color** | .zone-gold (#D4AF37) |
| **Backend** | /api/accounting/agi/benford/scan, /agi/treasury/*, /agi/journals/live-feed |

### The 4 Intelligence Panels

| Panel | Mode | Auto-Refresh |
|---|---|---|
| BENFORD ANOMALY RADAR | Read-only | 30s polling |
| 90-DAY TREASURY RADAR | Read-only | 30s polling |
| LIVE JOURNAL STREAM | Read-only | 30s polling |
| AP/AR MATRIX | Read-only | 30s polling |

### Sovereign Design Laws for Z-11C
1. ALL panels are read-only — no write actions in this zone
2. Benford chi-sq > 15.5 MUST display a WARNING badge (not silent)
3. CRITICAL anomaly (chi > 30) MUST trigger .anomaly-strobe CSS on affected bars
4. AP overdue items MUST be highlighted in red — not hidden
5. All financial values MUST use Courier New, monospace font
6. The .fin-intel-bg cyber grid MUST be present — it defines the zone feel
7. All 4 engines load in parallel (Promise.allSettled) — one failure must NOT block the others

### Anti-Hallucination Laws for Z-11C
- This zone is OBSERVATION ONLY — it reads existing data, never posts
- Benford score is a statistical indicator — NEVER used to automatically lock accounts
- Treasury projection is labeled as "estimate" — never treated as guaranteed revenue

---

**DIRECTIVE VERSION:** V8.0 | UPDATED: 2026-06-05 | Z-11C FINANCIAL INTELLIGENCE WAR ROOM

---

## 11. ADVANCED ROTHSCHILD PMS & MOBILE OWNER APP (Z-30)

### Zone Profile
| Key | Value |
|---|---|
| **Zone ID** | Z-30 |
| **Name** | Property Owner Mobile App |
| **Path** | /owner |
| **Color** | Indigo, Cyan & Silver (#00F2FF, #8b5cf6) |
| **Backend** | /api/pms/owner/*, /api/mortgage/* |

### App Architecture (web/app/owner/)
* **Shell**: Capacitor thin client WebView pointing to `/owner` (layout imports `StyledComponentsRegistry` and sets up `OwnerErrorBoundary` for on-screen debug reporting).
* **Login Gateway**: Authenticates owner NID against database and saves `SOV_OWNER_SESSION` & `SOV_OWNER_TOKEN` in local storage.
* **Dual-Column Workspace**:
  - Left Sidebar: Owner dossier profile details, Stripe direct debit SEPA/ACH mandate register, and resolved housekeeping/maintenance `PMSRepairInvoice` list. Includes interactive signature capture modals for legal contract signing (hashed to database).
  - Right Chat Panel: Gemini-styled AGI Owner Butler panel. Supports markdown text responses and includes a parser for `json_chart` blocks rendering dynamic Recharts line, bar, and pie graphs.

### Sovereign Design Laws for Z-30 Mobile
1. The viewport must be fully responsive, max-width 600px centered on desktop.
2. Left sidebar slides out on mobile via toggle.
3. Signature pad uses smooth HTML5 canvas with standard touch & pointer event listeners.
4. Chart blocks must be rendered inside responsive containers (`ResponsiveContainer` in Recharts).

### Core Financial Rules for Z-30
1. **Withholding Tax (WHT)**: All gross yield credits calculated for properties must deduct a management fee (e.g. 20%) to arrive at net yield. The WHT calculations are modeled in the AGI Tax Engine and verified against the general ledger.
2. **Direct-Debit Sweep Checks**: Direct debits via Stripe for mortgage sweeps (`POST /api/mortgage/sweep`) must verify the status of the authorization is `ACTIVE` and check the idempotency format `MORTGAGE_DEBIT-{ROOM_ID}-{MMYYYY}` before processing.
3. **SolveMission Repair Integration**: PMSRepairInvoice records must automatically compute the amount and standard VAT amount before debiting the yield balance.

---

## PART 12: CROSS-DOMAIN HANDOFF & TOKEN SIZE CONSTRAINTS (IRON LAW 62)

### 12.1 Handoff Architecture
When linking configurators on the public domain (`www.vigilantitsolution.com` / port 3001) to the visitor-tour experience on the restricted dashboard subdomain (`miracle.vigilantitsolution.com` / port 3000), developer and agent processes must use the secure dynamic tour context workflow:
1. **Lead Registration**: Post visitor info to `/api/visitor/request-otp` to record the lead and obtain a unique `lead_id`.
2. **Token Construction**: Build a minimal `tour_token` payload containing ONLY `{ lead_id, issued_at }` to keep the base64-encoded token short.
3. **Lead Enrichment**: Post the token and all selected zone metadata to `/api/visitor/enrich-lead` to associate them with the lead ID in the database.
4. **Handoff Redirection**: Redirect the visitor to the subdomain tour page: `https://miracle.vigilantitsolution.com/visitor-tour?token={tourToken}`.

### 12.2 Loopback Network Port Connection Standard
For local server-to-server calls on the Hetzner VPS (port 3001 marketing site calling port 8090 FastAPI API gateway):
- **Requirement**: Use internal loopback requests (`http://localhost:8090/api/visitor/...`) rather than routing through the public domain interface.
- **Benefits**: Eliminates external DNS lookup overhead, avoids Nginx proxy latencies, and bypasses local Node.js SSL certificate verification blocks on loopback streams.

### 12.3 Token Size Limit (Iron Law 62 Constraints)
- **Constraint**: The `tour_token` column in the `sales_leads` table is restricted to exactly `128` characters.
- **Rule**: NEVER encode rich user profile arrays, department lists, or text descriptions inside the base64 token. Doing so inflates the token length to 180+ characters, triggering SQL `Data too long for column 'tour_token'` database errors.
- **Compliance**: The token must be kept as a minimal base64 representation of `{ lead_id, issued_at }`, which generates a clean, safe ~50-character string. All rich user configurations must be saved to the database record.

---

**DIRECTIVE VERSION:** V10.0 | UPDATED: 2026-06-18 | PART 12 INTEGRATION & TOUR HANDOFF


