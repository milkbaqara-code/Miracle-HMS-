# 🏛️ SOVEREIGN VPS MULTI-APP DEPLOYMENT DIRECTIVE (V2.0)
> **PURPOSE**: Unified deployment and configuration manual to run Miracle OS, Miracle HMS, and Miracle POS individually on a single Hetzner VPS.
> **LAST UPDATED**: 2026-06-30 | **AUTHOR**: Antigravity AI
> **STATUS**: Miracle OS live | Miracle HMS & POS pre-deployment phase
> **VPS**: `23.88.50.87` (Hetzner, Nuremberg) | **SSH User**: `root` | **Key**: `~/.ssh/miracle_os_key`

---

## 🌐 THE SOVEREIGN PORT & DOMAIN MAP

To run all applications individually without resource conflicts, the Hetzner server uses the following mapping layout:

| Service | Public Domain | Internal Port | VPS Home Directory | PM2 Process Names |
| :--- | :--- | :--- | :--- | :--- |
| **Miracle OS Frontend** | `miracle.vigilantitsolution.com` | **3000** | `/home/vigilantitsolution-miracle/` | `miracle-frontend` |
| **Miracle OS Backend API** | `miracle.vigilantitsolution.com/api` | **8090** | `/home/vigilantitsolution-api/` | `miracle-backend` |
| **Vigilant Website** | `www.vigilantitsolution.com` | **3001** | `/home/vigilantitsolution-www/` | `vigilant-website` |
| **Miracle HMS Frontend** | `hms.vigilantitsolution.com` | **3002** | `/home/vigilantitsolution-hms/` | `miracle-hms-frontend` |
| **Miracle HMS Backend API** | `hms.vigilantitsolution.com/api` | **8091** | `/home/vigilantitsolution-hms/` | `miracle-hms-backend`<br>`miracle-hms-sentinel` |
| **Miracle POS App** | `pos-app.vigilantitsolution.com` | **3005** | `/home/vigilantitsolution-pos/` | `miracle-pos` |
| **POS Showcase Website** | `pos.vigilantitsolution.com` | Static cPanel | N/A (cPanel hosting) | N/A |

---

## 📁 VPS Directory Structure (Unified)

```
/home/
├── vigilantitsolution-miracle/              ← Miracle OS ERP (Live)
│   └── htdocs/miracle.vigilantitsolution.com/
│
├── vigilantitsolution-www/                  ← Vigilant Marketing Site (Live)
│   └── htdocs/vigilantitsolution.com/
│
├── vigilantitsolution-hms/                  ← Miracle HMS (Planned)
│   ├── logs/nginx/
│   └── htdocs/hms.vigilantitsolution.com/   ← Port 3002 (FE) / 8091 (BE)
│       ├── web/.next/                       ← Built locally on Windows
│       ├── backend_api/                     ← Python FastAPI
│       ├── miracle_os_master.db             ← HMS SQLite Database
│       ├── miracle_kernel.json              ← HMS AI Kernel
│       ├── miracle-pm2-ecosystem-vps.json   ← PM2 configuration file
│       └── .env                             ← HMS-specific environment variables
│
└── vigilantitsolution-pos/                  ← Miracle POS (Planned)
    ├── logs/nginx/
    └── htdocs/pos-app.vigilantitsolution.com/ ← Port 3005 (Next.js fullstack)
        ├── .next/                           ← Built locally on Windows
        ├── db_products.json                 ← POS JSON Database
        ├── db_orders.json
        ├── db_customers.json
        ├── miracle-pos-pm2-vps.json         ← PM2 configuration file
        └── .env.local                       ← POS-specific environment variables
```

---

## 🛠️ ONE-TIME VPS SERVER BOOTSTRAPPING

Execute these steps via SSH on `23.88.50.87` to prepare the environments for HMS and POS:

### 1. DNS Records Setup (In your Domain Panel)
Add A records for the subdomains pointing to the Hetzner server IP:
```
Type: A | Host: hms     | Value: 23.88.50.87 | TTL: 300
Type: A | Host: pos-app | Value: 23.88.50.87 | TTL: 300
```

### 2. Issue Let's Encrypt SSL Certificates (via CyberPanel)
In CyberPanel, add websites `hms.vigilantitsolution.com` and `pos-app.vigilantitsolution.com`, and issue Let's Encrypt certificates.

### 3. Create Home Directories & Virtual Environments
```bash
# Miracle HMS Directory Setup
mkdir -p /home/vigilantitsolution-hms/htdocs/hms.vigilantitsolution.com/logs
mkdir -p /home/vigilantitsolution-hms/logs/nginx
cd /home/vigilantitsolution-hms/htdocs/hms.vigilantitsolution.com
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn sqlalchemy python-multipart python-jose passlib google-generativeai groq aiofiles scikit-learn numpy paramiko python-dotenv

# Miracle POS Directory Setup
mkdir -p /home/vigilantitsolution-pos/htdocs/pos-app.vigilantitsolution.com/logs
mkdir -p /home/vigilantitsolution-pos/logs/nginx

# Ensure correct file permissions
chown -R www-data:www-data /home/vigilantitsolution-hms/
chown -R www-data:www-data /home/vigilantitsolution-pos/
chmod -R 755 /home/vigilantitsolution-hms/
chmod -R 755 /home/vigilantitsolution-pos/
```

### 4. Setup Nginx Virtual Hosts
Create HMS Nginx config (`/etc/nginx/sites-enabled/hms.vigilantitsolution.com.conf`):
Copy the contents of `D:\Vigilant IT Solutions\Miracle_HMS\scratch\hms.vigilantitsolution.com.conf`.

Create POS Nginx config (`/etc/nginx/sites-enabled/pos-app.vigilantitsolution.com.conf`):
Copy the contents of `D:\Vigilant IT Solutions\Miracle_HMS\scratch\pos-app.vigilantitsolution.com.conf`.

Validate and reload Nginx:
```bash
nginx -t && systemctl reload nginx
```

---

## 🚀 THE DEPLOYMENT ENGINE (IRON LAW COMPLIANT)

Both systems use the sovereign patient deploy engine (file-by-file delta sync) to upload code securely without Hetzner connection drops.

### 🏥 Miracle HMS Deployment Flow
1. Update `NEXT_PUBLIC_API_URL=https://hms.vigilantitsolution.com` in `Miracle_HMS/web/.env.local`.
2. Build the Next.js bundle locally:
   ```powershell
   cd "D:\Vigilant IT Solutions\Miracle_HMS\web"
   npm run build
   ```
3. Run the deployment script:
   ```powershell
   cd "D:\Vigilant IT Solutions\Miracle_HMS"
   python -X utf8 scripts/hms_deploy.py
   ```

### 🛒 Miracle POS Deployment Flow
1. Verify `NEXT_PUBLIC_API_URL` is empty in `Miracle POS/.env.local` to use the built-in Next.js JSON database API.
2. Build the Next.js bundle locally:
   ```powershell
   cd "D:\Vigilant IT Solutions\Miracle POS"
   npm run build
   ```
3. Run the deployment script:
   ```powershell
   cd "D:\Vigilant IT Solutions\Miracle POS"
   python -X utf8 scripts/pos_deploy.py
   ```

---

## ⚡ PM2 PROCESS MANAGEMENT ON THE VPS

Manage each application independently without impacting the others:

```bash
# Manage Miracle OS
pm2 restart miracle-backend
pm2 restart miracle-frontend

# Manage Miracle HMS
pm2 start /home/vigilantitsolution-hms/htdocs/hms.vigilantitsolution.com/miracle-pm2-ecosystem-vps.json
pm2 restart miracle-hms-backend
pm2 restart miracle-hms-frontend
pm2 restart miracle-hms-sentinel

# Manage Miracle POS
pm2 start /home/vigilantitsolution-pos/htdocs/pos-app.vigilantitsolution.com/miracle-pos-pm2-vps.json
pm2 restart miracle-pos

# Save all PM2 process configurations
pm2 save
```

---

## 🚨 IRON DEPLOYMENT LAWS

1. **NEVER BUILD ON THE VPS**: Always run `npm run build` locally on Windows. Uploading the pre-built `.next` folder is mandatory.
2. **NEVER COPY DB FILES MANUALLY**: Standard SCP transfers on large SQLite or JSON DBs trigger firewall resets. Let the deployment scripts handle database synchronization safely.
3. **NEVER REUSE PORT NUMBERS**: Assign distinct ports (`3000`/`3001`/`3002`/`3005`) for each Next.js server, and distinct backend ports (`8090`/`8091`).
4. **ALWAYS TEST NGINX FIRST**: One bad Nginx configuration will take down **every** site on the VPS. Always run `nginx -t` before reloading the service.

---

*Directive authored by Antigravity AI — 2026-06-30*
*VPS: 23.88.50.87 (Hetzner Nuremberg) | SSH Key: ~/.ssh/miracle_os_key*
