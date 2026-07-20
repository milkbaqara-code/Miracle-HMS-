'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface SyncContextType {
  syncPulse: number;
  triggerGlobalSync: () => void;
  globalGridState: any[];
  kernel: any;
  activeRole: string;
}

const GlobalSyncContext = createContext<SyncContextType>({ 
  syncPulse: 0, 
  triggerGlobalSync: () => {},
  globalGridState: [],
  kernel: null,
  activeRole: '',
});

export const useGlobalSync = () => useContext(GlobalSyncContext);

export const GlobalSyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [syncPulse, setSyncPulse] = useState(Date.now());
  const [globalGridState, setGlobalGridState] = useState<any[]>([]);
  const [kernel, setKernel] = useState<any>(null);
  const [activeRole, setActiveRole] = useState<string>('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchKernel = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/settings/kernel`);
      if (res.ok) {
        const data = await res.json();
        setKernel(data);
      }
    } catch (err) {
      // Silent fail — never log kernel errors as console.error on guest routes
      // (browser monitor in MiracleBot picks up console.error and causes crash cascade)
    }
  }, [API_URL]);

  const triggerGlobalSync = useCallback(() => {
    const now = Date.now();
    setSyncPulse(now);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('miracle_physical_sync', { detail: now }));
      localStorage.setItem('miracle_sync_pulse', now.toString());
    }
  }, []);

  useEffect(() => {
    // ============================================================
    // IRON LAW 50 — GUEST ZONE KERNEL EXCLUSION
    // /api/settings/kernel is a STAFF-ONLY endpoint.
    // Guest WebViews must NEVER call it — doing so triggers a crash
    // cascade (401 -> console.error -> browser monitor -> more fetches
    // -> WebView freeze within 5 seconds).
    // ============================================================
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/guest')) {
      return; // Abort: guest zone — no kernel polling, no role check
    }

    const role = localStorage.getItem('vigilant_role') || 'VISITOR';
    setActiveRole(role);
    fetchKernel();
    
    const interval = setInterval(fetchKernel, 60000 * 5); // Every 5 mins
    return () => clearInterval(interval);
  }, [fetchKernel]);

  return (
    <GlobalSyncContext.Provider value={{ syncPulse, triggerGlobalSync, globalGridState, kernel, activeRole }}>
      {children}
    </GlobalSyncContext.Provider>
  );
};
