// ============================================================
// MIRACLE OS -- PM2 ECOSYSTEM CONFIG (SOVEREIGN PROCESS MANAGER)
// Deploy: python scripts\sovereign_patient_deploy.py backend
// Start:  pm2 start ecosystem.config.js
// ============================================================
module.exports = {
  apps: [
    {
      // ── BACKEND API ─────────────────────────────────────────
      name: "miracle-backend",
      script: "/root/start_backend.sh",
      cwd: "/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,           // wait 3s between crash-restarts
      min_uptime: "5s",              // must survive 5s to count as stable
      env: {
        NODE_ENV: "production",
        PYTHONPATH: "/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api"
      },
      error_file: "/root/.pm2/logs/miracle-backend-error.log",
      out_file: "/root/.pm2/logs/miracle-backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      // ── FRONTEND ────────────────────────────────────────────
      name: "miracle-frontend",
      script: "npm",
      args: "start",
      cwd: "/home/vigilantitsolution-miracle/htdocs/miracle.vigilantitsolution.com",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      min_uptime: "5s",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      error_file: "/root/.pm2/logs/miracle-frontend-error.log",
      out_file: "/root/.pm2/logs/miracle-frontend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      // ── WHATSAPP GATEWAY ────────────────────────────────────
      name: "wa-gateway",
      script: "server.js",
      cwd: "/home/vigilantitsolution-api/whatsapp-gateway",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      min_uptime: "5s",
      env: {
        NODE_ENV: "production"
      },
      error_file: "/root/.pm2/logs/wa-gateway-error.log",
      out_file: "/root/.pm2/logs/wa-gateway-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      // ── OPS SENTINEL (The Guardian) ─────────────────────────
      name: "ops-sentinel",
      script: "venv/bin/python",
      args: "app/workers/ops_sentinel.py",
      cwd: "/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        PYTHONPATH: "/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api"
      },
      error_file: "/root/.pm2/logs/ops-sentinel-error.log",
      out_file: "/root/.pm2/logs/ops-sentinel-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
