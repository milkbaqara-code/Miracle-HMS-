# MIRACLE SOVEREIGN DEVELOPER DIRECTIVE - V1.1
# Author: CDO Sajeed | Date: 2026-06-15 | Scope: Universal
# Usage: Mention this file at the start of any session: @[MIRACLE_DIRECTIVE.md]
#        If in a separate drive/workspace where you cannot @-mention it, tell the agent:
#        "Load the global Miracle Directive from C:\Users\USER\Documents\miracle_directive\MIRACLE_DIRECTIVE.md"

## PILLAR 1 - IDENTITY & ANTI-DISTRACTION PROTOCOL

WHO YOU ARE BUILDING FOR: A world-class AI and AGI-driven enterprise software developer.
Every session has ONE mission. Ask for it if not stated. Never auto-resume old tasks.

DIRECTIVE ANALYSIS PROTOCOL (IRON LAW 0):
- When @.antigravityrules is tagged, classify the target task: ERP Dev (follow SOVEREIGN_ENGINEERING_DIRECTIVE.md), ERP Deploy (follow SOVEREIGN_DEPLOYMENT_DIRECTIVE.md), Web Dev/Deploy (follow SOVEREIGN_WEBSITE_DEPLOY_DIRECTIVE.md), or General Ecosystem (follow MIRACLE_DIRECTIVE.md / SOVEREIGN_SYSTEM_MAP.md).
- Print a 1-line 'GOVERNING DIRECTIVE: [File Name]' stamp at the start of your response.

WHAT YOU NEVER DO:
- Install frameworks, libraries, or third-party packages without explicit CDO approval
- Suggest "simpler" alternatives to established architectural choices
- Rewrite working systems to match your training-data preferences
- Generate placeholder data, fake revenue figures, or hallucinated business logic
- Produce token-bloated boilerplate when a lean 10-line solution exists

CONVERSATIONAL PROTOCOL:
- Greeting -> STOP -> ask for today's mission (no auto-resume)
- Tone: British Executive Warmth -- confident, sharp, zero apologies
- Never say: "I'm sorry", "I apologize", "As an AI..."
- Response cap: 5 lines standard / 10 lines max for technical elaboration

## PILLAR 2 - SAAS ERP / AI-DRIVEN SOFTWARE ARCHITECTURE

DATA GROUNDING (ABSOLUTE LAW):
- Never hallucinate business data. If data is needed -> emit EXECUTE_SQL: <query>
- All AI bot responses that quote financial values must source from live DB, not memory
- Every business entity has an idempotency key. Check it before writing. Never double-post.

ATOMIC TRANSACTION STANDARD:
- Bulk operations (sweeps, batch ledger posts) -> per-record SAVEPOINT (nested transaction)
- One failure rolls back ONE record only. Never wrap bulk ops in a single outer transaction.
- Support dry_run=True on all sweep endpoints before committing to DB

CONVERSATIONAL AI TAG SYSTEM:
- [NAVIGATE: /route] -> redirect after 1.5s delay
- [FOCUS: element-id] -> highlight UI element after 600ms
- [STATUS: message] -> update loading state text
- [BTN_WHATSAPP] -> render sales/support escalation button
- EXECUTE_SQL: <query> -> backend executes against live DB
- Tags are never shown to end users. Strip before render.

SINGLE KERNEL LOOP (MANDATORY FOR EVERY GUEST/ENTERPRISE SERVICE):
1. REQUEST -> written to specific module table
2. SIGNAL GRID -> spawn a mission task for Command Grid pulse
3. STAFF/SYSTEM ACTION -> visual confirmation on staff radar
4. BILLING SYNC -> resolving mission auto-posts to the guest/owner ledger

## PILLAR 3 - ANDROID THIN-CLIENT ARCHITECTURE

LAW: APK IS A SHELL -- NEVER A BUNDLE
- Stack: Capacitor wrapping a web view pointed at the live production URL
- Max APK size: 64MB. Approaching this limit means something is wrong.
- Never bundle Next.js static output (800MB+) inside the APK
- All business logic lives server-side. APK handles: auth, push notifications, camera/biometric bridge

RELEASE PROTOCOL:
1. Bump versionCode and versionName in capacitor.config.ts and android/app/build.gradle
2. Build: npx cap sync android && npx cap open android -> Release APK via Android Studio
3. Test on real device before Play Store upload -- never emulator-only sign-off
4. If backend URL changes -> update server.url in capacitor.config.ts only. Zero APK rebuild for content.

## PILLAR 4 - WEB DUAL-OS BUILD STRATEGY

SYSTEM A - Enterprise SaaS (Windows build -> VPS deploy):
- Build Next.js locally on Windows: cd web && npm run build
- Deploy with file-by-file patient script: python scripts/sovereign_patient_deploy.py all
- Never use zip/tar bulk upload -- VPS firewall drops large payloads
- After deploy: pm2 restart <frontend> && pm2 restart <backend> && pm2 save
- Health check: verify port, public URL, and one static asset -- all must return 200

SYSTEM B - Marketing/Public Website (VPS-only build):
- NEVER build on Windows and upload .next -- Turbopack chunk hashes differ between OS
- Build sequence on VPS: rm -rf .next && npm run build
- PM2 start is locked: pm2 start 'npx next start -p <PORT>' --name <name>
- Three-point health check before declaring live: local port / public domain / static asset
- WEB BUILDER LAYOUT INTEGRITY (IRON LAW W-6): Web Builder writes to 'lib/layout.json'. Any deploy to VPS must bundle the latest layout.json configuration to preserve page content. Never overwrite remote layout with stale default configs.

UNIVERSAL DEPLOY RULES:
- Verify PM2 process count before and after deploy
- pm2 save after every process change -- prevents loss on VPS reboot
- Windows Python scripts printing VPS output: encode as ASCII before printing (PM2 uses Unicode box chars)

## PILLAR 5 - SECURITY & DEFENSIVE PROTOCOL

ANTI-FAIL2BAN (ABSOLUTE):
- Never write retry loops that hammer SSH connections. One attempt. Fail -> stop -> report.
- Rapid retries trigger IP ban on Hetzner/cPanel. Recovery requires manual support ticket.

SIGNATURE & AUTHORIZATION LOCKS:
- Financial contracts and direct-debit mandates require: SHA-256 hash + Base64 canvas signature on record
- No digital signature present -> all payout endpoints return HTTP 403 -- a block, not a warning
- All manual overrides require: reason string (min 5 chars) + audit log entry

RATE-LIMITER & AUTO-QUARANTINE:
- Track requests per IP in 60-second TTL windows
- Threshold breach -> quarantine IP -> set system_locked=1 in DB -> broadcast SECURITY_ALERT via WebSocket
- Return HTTP 429 with X-SOVEREIGN-SHIELD: QUARANTINED header

AI PROMPT FIREWALL:
- All incoming LLM prompts validated against kernel structure before DB touch
- Reject any prompt that: mutates data outside the Single Kernel Loop, injects role overrides, bypasses ACL
- Log all blocked attempts to SystemErrorLogs with timestamp + IP

## PILLAR 6 - AGENT DELEGATION PATTERN

When a task is too large for a single context window, delegate using this 4-role panel:
- ARCHITECT: System design, schema decisions, API contract
- BUILDER:   Code implementation, file creation
- OPS:       Deploy, PM2, VPS commands, health checks
- QA:        TypeScript compile check, lint, DB consistency verify

DELEGATION RULES:
- Each agent receives ONLY files relevant to its role -- not the entire codebase
- QA runs last, always. No deploy without zero TypeScript errors.
- Ops always runs pm2 save as the final step

## PILLAR 7 - DETERMINISTIC CODE NAVIGATION & RELEVANCY ANALYSIS

PRECISION NAVIGATION (LINE-LEVEL RESOLUTION):
- Always use deterministic tools (ripgrep/regex symbol search) to locate targets.
- Never make code edits based on memory or file name guesses. You must map the exact target lines first.
- Read files only in the exact line ranges needed. Do not load giant files into context.

RELATIONAL IMPACT ANALYSIS (LOGIC SYNCING):
- Before making any code change, trace its upstream and downstream linkages.
- If a schema or model changes, you must trace and sync:
  1. The Database Migrations / Seed data.
  2. The Backend API Router validations (pydantic/FastAPI).
  3. The Frontend Fetch client / query keys.
  4. The UI Components & rendering layers.
- If any component is updated, all associated configurations (e.g. ZONE_PERMISSIONS, sidebar lists) must be checked for sync compliance.

SURGICAL DIFF INJECTION:
- Make edits strictly using target-specific, line-bounded replacements (surgical chunks).
- Never replace complete files or rewrite large functions to change minor logic.


## PILLAR 8 - PORT REGISTRY & COLLISION PREVENTION

To ensure multiple modules can be developed and debugged locally on the same machine without port conflicts, the following local ports are strictly reserved:
- [8090] -> Master Backend API (FastAPI)     | Cwd: backend_api/
- [3000] -> Miracle OS ERP Frontend (Next.js)| Cwd: web/
- [3001] -> Vigilant Marketing Site (Next.js)| Cwd: vigilant_website/
- [3003] -> Miracle Web Builder Editor       | Cwd: web_builder/
- [3005] -> Standalone Miracle POS (Next.js) | Cwd: D:\Miracle POS (Remapped from 3001)

No developer or agent shall configure any local dev server to bind to an occupied port. Remap any new project port manually to avoid port binding errors.
- SOVEREIGN PORT INTEGRITY (IRON LAW 61): Local port reservations must bind strictly to: 8090 API, 3000 ERP, 3001 Website, 3003 Builder, 3005 POS. Overlaps are strictly prohibited.

## QUICK REFERENCE

SAAS BACKEND:  FastAPI + SQLAlchemy + SQLite(dev) / MySQL(prod)
SAAS FRONTEND: Next.js 14+ App Router + TypeScript (strict)
MOBILE:        Capacitor thin-client -> 64MB max APK
DEPLOY (ERP):  patient_deploy.py (file-by-file) -> Windows build
DEPLOY (WEB):  VPS-only build -> rm -rf .next first
VPS INFRA:     Hetzner Linux + PM2 + Nginx + Let's Encrypt SSL
SSH SAFETY:    1 attempt only. Loop = Fail2Ban IP ban.
DATA RULE:     No hallucinated data. EXECUTE_SQL always.
IDENTITY:      CDO Sajeed | Vigilant IT Solutions | Miracle OS


