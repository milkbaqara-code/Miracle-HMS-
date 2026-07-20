# 🏛️ VIGILANT IT SOLUTION — SOVEREIGN INFRASTRUCTURE REDESIGN
> **Goal**: Fix the broken shared-hosting website, move the main domain to VPS, and repurpose shared hosting for POS showcase.

---

## 📐 TARGET ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    HETZNER VPS (23.88.50.87)                    │
│                                                                 │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐  │
│  │  miracle.vigilant...com  │  │   www.vigilant...com        │  │
│  │  Port 3000 (Next.js)     │  │   Port 3001 (Next.js)       │  │
│  │  PM2: miracle-frontend   │  │   PM2: vigilant-website     │  │
│  │  Backend: Port 8090      │  │   Supabase / Stripe live    │  │
│  └──────────────────────────┘  └─────────────────────────────┘  │
│                                                                 │
│  Nginx reverse proxy routes each domain to its port             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              SHARED cPANEL HOSTING (current)                    │
│                                                                 │
│  pos.vigilantitsolution.com  — POS Showcase Microsite           │
│  Pure static HTML/CSS/JS — Zero Node.js dependency              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🌐 DOMAIN ROUTING PLAN

| Domain | Destination | Purpose |
|---|---|---|
| `www.vigilantitsolution.com` | VPS Port 3001 (new) | Main marketing website — full Next.js |
| `miracle.vigilantitsolution.com` | VPS Port 3000 (existing) | Miracle OS — unchanged |
| `pos.vigilantitsolution.com` | cPanel shared hosting | POS showcase static microsite |

---

## ✅ PHASE 1 — Fix the Main Website (vigilantitsolution.com) Code

### Changes to `D:\Miracle Web Builder\vigilantitsolution.com\`

#### [MODIFY] `app/tabs/DemoTab.tsx` or Demo button in `page.tsx`
- Change DEMO tab to **redirect to `https://miracle.vigilantitsolution.com/`** instead of showing an internal demo
- Add a premium "Launch Live Demo →" button that opens the VPS Miracle OS app

#### [MODIFY] All API routes — Remove `force-static` patch
- Remove `export const dynamic = "force-static"` added during static build attempts
- API routes will work properly on VPS Node.js

#### [MODIFY] `next.config.ts`
- Ensure NO `output: "export"` — full Node.js server mode for VPS
- Keep `turbopack.root` setting

#### [NEW] `ecosystem.config.js` (PM2 config for VPS)
- Defines `vigilant-website` process on port 3001
- Auto-restart, log paths configured

#### [NEW] `scripts/nginx_vigilant_website.conf`
- Nginx server block for `www.vigilantitsolution.com` → port 3001
- SSL using existing cert infrastructure or new Let's Encrypt cert
- HTTP → HTTPS redirect

---

## ✅ PHASE 2 — VPS Deployment of Main Website

### Deployment approach follows Sovereign Patient Deploy principles:
1. **Build locally**: `npm run build` in `vigilantitsolution.com/`
2. **Package**: Use `vps_tar_deploy.py` pattern (tar.gz → 1 file upload → extract on VPS)
3. **Install**: `npm install --production` on VPS
4. **PM2 Start**: `pm2 start ecosystem.config.js --only vigilant-website`
5. **Nginx**: Add new server block, reload nginx

### VPS paths:
```
/home/vigilantitsolution-www/htdocs/vigilantitsolution.com/   ← website files
```

---

## ✅ PHASE 3 — POS Showcase on Shared Hosting

### `pos.vigilantitsolution.com` — Premium Static Microsite

A self-contained, beautiful **single HTML file** showcasing:
- **F&B/Retail POS** zone features (Z-06, Z-28, Z-29)
- Live screenshots / carousel of Miracle POS
- Feature comparison table
- WhatsApp CTA button
- Request Demo → links to `miracle.vigilantitsolution.com`

**Tech**: Pure HTML + Vanilla CSS (no Node.js, works perfectly on cPanel)

### DNS/cPanel setup:
- Create `pos` subdomain in cPanel → points to shared hosting
- Upload single `index.html` to `public_html/pos/` or subdomain root

---

## ✅ PHASE 4 — DNS Changes

| Record | Type | Value |
|---|---|---|
| `www.vigilantitsolution.com` | A | `23.88.50.87` (Hetzner VPS) |
| `pos.vigilantitsolution.com` | A / CNAME | Shared hosting IP |
| `miracle.vigilantitsolution.com` | A | `23.88.50.87` (unchanged) |

> [!IMPORTANT]
> The `www.vigilantitsolution.com` DNS A record must point to the VPS IP (`23.88.50.87`), not the shared hosting. This is done in your domain registrar's DNS panel.

---

## ⚠️ Open Questions

> [!IMPORTANT]
> **1. Demo Tab Behavior**: Should the DEMO tab in the main website:
> - (A) Navigate directly to `https://miracle.vigilantitsolution.com/` in a new tab?
> - (B) Show an embedded iframe preview with a "Open Full Demo" button?
> - (C) Keep the current internal demo tab but add a "Live Demo" button linking to Miracle OS?

> [!IMPORTANT]
> **2. VPS Deployment Tool**: The `sovereign_patient_deploy.py` and `vps_tar_deploy.py` scripts are set up for Miracle OS. Should I create a **separate deploy script** for the vigilant website, or extend the existing one to handle a second process?

> [!IMPORTANT]
> **3. SSL Certificate for www.vigilantitsolution.com**: Once DNS points to VPS:
> - Does the VPS already have a wildcard cert (`*.vigilantitsolution.com`) that covers `www`?  
> - Or does a new Let's Encrypt cert need to be issued on the VPS via `certbot`?

> [!NOTE]
> **4. POS Showcase Content**: How much detail do you want on `pos.vigilantitsolution.com`? Options:
> - (A) Simple 1-page landing with features + WhatsApp CTA
> - (B) Multi-section scrolling page with screenshots and pricing
> - (C) Full interactive demo showing the POS zone UI

---

## 🔧 Verification Plan

1. `curl https://www.vigilantitsolution.com` → HTTP 200, Next.js response
2. `curl https://miracle.vigilantitsolution.com` → HTTP 200, Miracle OS unchanged
3. `curl https://pos.vigilantitsolution.com` → HTTP 200, static POS page
4. DEMO button on main website → opens `miracle.vigilantitsolution.com` correctly
5. PM2 on VPS shows 2 processes: `miracle-frontend` (3000) + `vigilant-website` (3001)
