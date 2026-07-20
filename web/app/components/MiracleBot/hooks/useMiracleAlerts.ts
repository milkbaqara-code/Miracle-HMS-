'use client';
// ============================================================
// MiracleBot / hooks / useMiracleAlerts.ts
// Watchdog alert state — WebSocket bridge listener +
// REST fallback polling every 2 minutes.
// V4.0 — Enterprise Refactor
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { API } from '../lib/constants';

export function useMiracleAlerts(isOpenRef: React.MutableRefObject<boolean>) {
  const [alertCount,     setAlertCount]     = useState(0);
  const [watchdogAlerts, setWatchdogAlerts] = useState<any[]>([]);
  const alertInterval = useRef<any>(null);

  // Injected setter so the parent can push alert messages into chat
  const onNewAlerts = useRef<((alerts: any[]) => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. WebSocket Bridge Handler (fired by the WS client elsewhere)
    const handleAlert = (e: Event) => {
      const payload = (e as CustomEvent).detail;
      if (payload && typeof payload.count === 'number') {
        setAlertCount(payload.count);
        setWatchdogAlerts(payload.alerts || []);
        if (isOpenRef.current && payload.alerts?.length > 0) {
          onNewAlerts.current?.(payload.alerts);
        }
      }
    };
    window.addEventListener('miracle_watchdog_alert', handleAlert);

    // 2. REST Fallback Polling (backup when WS drops)
    const pollWatchdog = async () => {
      try {
        const res = await fetch(`${API}/bot/v2/watchdog/alerts`);
        if (res.ok) {
          const payload = await res.json();
          if (payload && typeof payload.count === 'number') {
            setAlertCount(payload.count);
            setWatchdogAlerts(payload.alerts || []);
          }
        }
      } catch { /* silent — watchdog poll must never crash the AI */ }
    };

    alertInterval.current = setInterval(pollWatchdog, 120_000);
    pollWatchdog(); // Initial fetch on mount

    return () => {
      window.removeEventListener('miracle_watchdog_alert', handleAlert);
      clearInterval(alertInterval.current);
    };
  }, [isOpenRef]);

  return { alertCount, watchdogAlerts, onNewAlerts };
}
