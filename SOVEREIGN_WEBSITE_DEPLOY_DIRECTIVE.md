# SOVEREIGN WEBSITE DEPLOY DIRECTIVE (V1.0)
# VIGILANT IT SOLUTIONS -- www.vigilantitsolution.com
# AUTHOR: ANTIGRAVITY AI | DATE: 2026-06-13 | STATUS: LOCKED

> This directive governs deployment of the marketing website ONLY.
> For Miracle OS (miracle.vigilantitsolution.com), use sovereign_patient_deploy.py.
> Both systems share the same VPS but are INDEPENDENT processes.

---

## SYSTEM MAP (DO NOT CONFUSE THESE)

| Property         | Miracle OS (App)                     | Vigilant Website (Marketing)                     | Web Builder (Editor Tool)                        |
|:-------------    |:-----------------------------------  |:-----------------------------------------------  |:------------------------------------------------ |
| URL              | miracle.vigilantitsolution.com       | www.vigilantitsolution.com                       | http://localhost:3003 (Local)                    |
| VPS Path         | /home/vigilantitsolution-miracle/... | /home/vigilantitsolution-www/htdocs/vigilantitsolution.com | N/A (Local Dev Only)                            |
| Local Source     | D:\Vigilant IT Solutions\Miracle_Os_Master\web\ | D:\Vigilant IT Solutions\Miracle_Os_Master\vigilant_website\ | D:\Vigilant IT Solutions\Miracle Web Builder\   |
| Junction Target  | N/A                                  | Linked from Miracle Web Builder\vigilantitsolution.com\ | N/A                                              |
| PM2 Name         | miracle-frontend                     | vigilant-website                                 | N/A (Local Process)                              |
| Port             | 3000                                 | 3001                                             | 3003                                             |
| Nginx Config     | miracle.vigilantitsolution.com.conf  | vigilant-website.conf                            | N/A                                              |
| PM2 Start Cmd    | `npm run start` (via ecosystem)      | `npx next start -p 3001`                         | `MIRACLE-BUILDER.bat` (Port 3003)                |

> [!NOTE]
> The folder `D:\Vigilant IT Solutions\Miracle Web Builder\vigilantitsolution.com` is a **Windows Directory Junction** pointing directly to `D:\Vigilant IT Solutions\Miracle_Os_Master\vigilant_website`. 
> Editing files in the Web Builder automatically writes changes to the master website folder.
> To deploy changes directly from the Web Builder folder, double-click `deploy-website.bat`.


---

## IRON LAWS FOR WEBSITE DEPLOYMENT

### [IRON LAW W-1] BUILD ON VPS -- NEVER LOCALLY
The website MUST be built ON the VPS via SSH, NOT locally on Windows.

- Windows Turbopack builds create chunk hashes that NEVER match Linux paths.
- Building locally then uploading .next creates MODULE_NOT_FOUND errors on the VPS.
- Linux VPS build takes 12 seconds. Windows build takes 2.4 minutes AND still breaks.

CORRECT DEPLOY FLOW:
  1. Upload changed source files to VPS (via sovereign_website_deploy.py)
  2. SSH into VPS: npm run build
  3. pm2 restart vigilant-website
  4. Health check: curl http://localhost:3001/

FORBIDDEN:
  - npm run build on Windows, then upload .next  [CAUSES: MODULE_NOT_FOUND on VPS]
  - tar .next and upload                          [CAUSES: Hash mismatch, 404 on all JS]
  - pm2 restart without rebuilding               [CAUSES: Old broken chunks served]

---

### [IRON LAW W-2] PM2 START COMMAND IS LOCKED
The PM2 start command for vigilant-website is:
  `npx next start -p 3001`

NEVER use:
  - `npm start`         (does not bind to port 3001 -- causes LOCAL:000)
  - `next start`        (not in PATH -- causes process crash)
  - `pm2 restart`       (use only AFTER a fresh VPS build)
  - cluster mode        (this is a simple Next.js app, fork mode only)

To recreate the PM2 process from scratch:
  ```bash
  pm2 delete vigilant-website
  cd /home/vigilantitsolution-www/htdocs/vigilantitsolution.com
  pm2 start 'npx next start -p 3001' --name vigilant-website
  pm2 save
  ```

---

### [IRON LAW W-3] ALWAYS DELETE .next BEFORE NEW BUILD
Before every build on the VPS, you MUST delete the old .next:
  ```bash
  rm -rf .next
  npm run build
  ```

REASON: Old Turbopack SSR chunks from a previous build leave ghost modules.
The new build references new chunk hashes. The old chunks cause MODULE_NOT_FOUND.
This is the #1 cause of "site unreachable" incidents.

---

### [IRON LAW W-4] WINDOWS cp1252 ENCODING -- NEVER PRINT UNICODE
All Python scripts running on Windows that SSH to the VPS MUST encode all
remote output as ASCII before printing:

CORRECT:
  print(output.encode('ascii', 'replace').decode(), flush=True)

WRONG:
  print(output)   # CRASHES on PM2 box-drawing chars: [?, ?, -]

This crash mid-script leaves the VPS in a half-deployed state.

---

### [IRON LAW W-5] HEALTH CHECK BEFORE DECLARING SUCCESS
Never declare the site "live" without running ALL THREE checks:
  1. `curl http://localhost:3001/`         must return 200
  2. `curl https://www.vigilantitsolution.com/`  must return 200
  3. `curl https://www.vigilantitsolution.com/_next/static/chunks/[any].js` must return 200

If check 1 fails: PM2 is not running on port 3001.
If check 2 fails: Nginx proxy is broken. Check /etc/nginx/sites-enabled/vigilant-website.conf
If check 3 fails: Static chunks not built. Run rm -rf .next && npm run build.

---

## COMPLETE DEPLOY PROCEDURE

### When you change source files locally and need to deploy:

```powershell
# From D:\Vigilant IT Solutions\Miracle_Os_Master\
python scripts\sovereign_website_deploy.py
```

The script will:
  [1] Upload changed source files to VPS (file-by-file with ledger)
  [2] Delete old .next on VPS
  [3] Run npm run build on VPS
  [4] Restart PM2 with correct start command
  [5] Run all 3 health checks
  [6] Report success or failure

---

## NGINX CONFIGURATION (DO NOT TOUCH)

File: /etc/nginx/sites-enabled/vigilant-website.conf
Key section:
  server_name www.vigilantitsolution.com vigilantitsolution.com;
  proxy_pass  http://localhost:3001;
  SSL via Let's Encrypt (expires 2026-09-11, auto-renews)

To test nginx config:  nginx -t
To reload nginx:       systemctl reload nginx

---

## KNOWN INCIDENTS & ROOT CAUSES

| Date       | Incident                  | Root Cause                              | Fix Applied          |
|:---------- |:------------------------- |:--------------------------------------- |:-------------------- |
| 2026-06-13 | 404 on all JS/CSS chunks  | Local Windows build hashes != VPS       | Build on VPS         |
| 2026-06-13 | MODULE_NOT_FOUND on start | Old .next not deleted before new build  | rm -rf .next first   |
| 2026-06-13 | LOCAL:000 after PM2 start | `npm start` does not use port 3001      | `npx next start -p 3001` |
| 2026-06-13 | Script crash mid-deploy   | PM2 unicode chars crash Windows cp1252  | ASCII-encode all output |

---

## VPS CREDENTIALS (REFERENCE)

| Field    | Value                              |
|:-------- |:---------------------------------- |
| Host     | miracle.vigilantitsolution.com     |
| IP       | 23.88.50.87                        |
| User     | root                               |
| Key      | ~/.ssh/miracle_os_key              |
| Password | NdRbWqkTuUMf (fallback only)       |
| Website  | /home/vigilantitsolution-www/htdocs/vigilantitsolution.com |

---
DOCUMENT STATUS: LOCKED V1.0 | 2026-06-13
