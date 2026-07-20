/**
 * ============================================================
 * 🔒 MIRACLE OS — MASTER SAFE POINT
 * ------------------------------------------------------------
 * Commit  : 8231f6f
 * Branch  : main
 * Saved   : 2026-04-23 20:45 (BD Time / UTC+6)
 * Repo    : https://github.com/milkbaqara-code/miracle-os-master
 *
 * RESTORE COMMAND (run from project root):
 *   git fetch origin && git reset --hard 8231f6f
 * ============================================================
 */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    // 🛡️ SOVEREIGN CSP — MASTER HEADER (server.js overrides next.config.ts on VPS)
    // RULE: Any new external script domain MUST be added here AND in next.config.ts
    // IRON LAW 32: Production API/WS goes through Nginx proxy on miracle.vigilantitsolution.com
    // IRON LAW 38: CSP must whitelist all required origins. ws:// for local dev, wss:// for production.
    res.setHeader('Content-Security-Policy',
      "default-src 'self' 'unsafe-eval' 'unsafe-inline' https://vigilantitsolution.com https://miracle.vigilantitsolution.com https://demo.vigilantitsolution.com https://www.googletagmanager.com; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vigilantitsolution.com https://miracle.vigilantitsolution.com https://demo.vigilantitsolution.com https://www.googletagmanager.com; " +
      "connect-src 'self' 'unsafe-eval' 'unsafe-inline' " +
        // Production endpoints (all proxied via Nginx on miracle.vigilantitsolution.com - Iron Law 32)
        "https://miracle.vigilantitsolution.com wss://miracle.vigilantitsolution.com " +
        // Legacy API subdomain (kept for backward compat)
        "https://api.vigilantitsolution.com wss://api.vigilantitsolution.com " +
        // Other allowed domains
        "https://vigilantitsolution.com wss://vigilantitsolution.com " +
        "https://demo.vigilantitsolution.com wss://demo.vigilantitsolution.com " +
        // Local dev (http/ws allowed on 8090 for local testing)
        "http://127.0.0.1:8090 http://localhost:8090 " +
        "ws://127.0.0.1:8090 ws://localhost:8090 " +
        // Analytics
        "https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com; " +
      "img-src 'self' data: https: blob:; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:;"
    );
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // 🛡️ THE BOUNCER: Auth Guard (For VPS Custom Server)
    const isProtected = pathname.startsWith('/dashboard');
    const cookies = req.headers.cookie || '';
    const hasToken = cookies.includes('miracle_session_token=');

    if (isProtected && !hasToken) {
      console.log(`🚨 SECURITY INTERCEPT [Server]: Blocked unauthorized access to ${pathname} (isProtected: ${isProtected})`);
      res.writeHead(307, { Location: '/' });
      res.end();
      return;
    }

    handle(req, res, parsedUrl);

  }).listen(process.env.PORT || 3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:' + (process.env.PORT || 3000));
  });
});
