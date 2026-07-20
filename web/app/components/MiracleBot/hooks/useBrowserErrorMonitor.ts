'use client';
// ============================================================
// MiracleBot / hooks / useBrowserErrorMonitor.ts
// Z-23 BROWSER CONSOLE MONITOR (V4)
// Intercepts console.error + uncaught exceptions + unhandled
// promise rejections → debounce-batches → POST to Z-23.
// Extracted from the monolith — zero coupling to any UI state.
// V4.0 — Enterprise Refactor
// ============================================================
import { useEffect } from 'react';
import { API } from '../lib/constants';

interface MonitorOptions {
  zone: string;
  sessionId: string;
}

export function useBrowserErrorMonitor({ zone, sessionId }: MonitorOptions) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const errorQueue: any[] = [];
    let flushTimer: any = null;

    const flush = () => {
      if (errorQueue.length === 0) return;
      const batch = errorQueue.splice(0, errorQueue.length);
      fetch(`${API}/infra/browser-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors: batch, zone, session_id: sessionId }),
      }).catch(() => {}); // must never crash the AI
    };

    const IGNORE = [
      'miracle_session_id', 'hot-update', 'favicon',
      'ERR_BLOCKED', '__nextjs',
    ];

    const report = (level: string, message: string, detail = '') => {
      if (IGNORE.some(s => message.includes(s) || detail.includes(s))) return;
      errorQueue.push({
        level,
        message: message.slice(0, 500),
        detail:  detail.slice(0, 200),
        ts: Date.now(),
      });
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 3000); // debounce 3s
    };

    // 1. Intercept console.error
    const origError = console.error;
    console.error = (...args: any[]) => {
      origError(...args);
      report('console_error', args.map(String).join(' '));
    };

    // 2. Uncaught JS exceptions
    const onError = (e: ErrorEvent) => {
      report('uncaught_exception', e.message || 'Unknown error', `${e.filename}:${e.lineno}`);
    };
    window.addEventListener('error', onError);

    // 3. Unhandled promise rejections
    const onUnhandled = (e: PromiseRejectionEvent) => {
      report('unhandled_rejection', String(e.reason));
    };
    window.addEventListener('unhandledrejection', onUnhandled);

    return () => {
      console.error = origError;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
      clearTimeout(flushTimer);
    };
  }, [zone, sessionId]);
}
