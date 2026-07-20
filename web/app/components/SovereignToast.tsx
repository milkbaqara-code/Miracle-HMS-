'use client';
// web/app/components/SovereignToast.tsx
// SOVEREIGN TOAST ENGINE — Replaces all alert() calls across Miracle HMS
// Top-center, auto-dismiss, stackable, color-coded by type.

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, default 4000
}

interface ToastContextValue {
  showToast: (title: string, type?: ToastType, message?: string, duration?: number) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// ─── Colors ──────────────────────────────────────────────────────────────────
const TOAST_CONFIG: Record<ToastType, { color: string; bg: string; border: string; icon: string }> = {
  success: { color: '#00ff88', bg: 'rgba(0,255,136,0.08)', border: 'rgba(0,255,136,0.3)', icon: '✅' },
  error:   { color: '#ff3366', bg: 'rgba(255,51,102,0.08)', border: 'rgba(255,51,102,0.3)', icon: '🚨' },
  warning: { color: '#D4AF37', bg: 'rgba(212,175,55,0.08)', border: 'rgba(212,175,55,0.3)', icon: '⚠️' },
  info:    { color: '#00fbff', bg: 'rgba(0,251,255,0.08)', border: 'rgba(0,251,255,0.3)', icon: '📡' },
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SovereignToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const showToast = useCallback((title: string, type: ToastType = 'info', message?: string, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration }]); // max 5 stacked
    timers.current[id] = setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container — TOP CENTER */}
      <div
        style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          pointerEvents: 'none',
          minWidth: '360px',
          maxWidth: '520px',
        }}
      >
        {toasts.map((toast, index) => {
          const cfg = TOAST_CONFIG[toast.type];
          return (
            <div
              key={toast.id}
              onClick={() => removeToast(toast.id)}
              title="Click to dismiss"
              style={{
                width: '100%',
                background: 'rgba(10,10,15,0.96)',
                border: `1px solid ${cfg.border}`,
                borderLeft: `4px solid ${cfg.color}`,
                borderRadius: '12px',
                padding: '14px 18px',
                boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${cfg.color}22`,
                backdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                pointerEvents: 'all',
                cursor: 'pointer',
                animation: 'sovereignSlideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity: 1 - index * 0.05,
                transform: `scale(${1 - index * 0.02})`,
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{cfg.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 900, color: cfg.color, letterSpacing: '0.5px', marginBottom: toast.message ? '4px' : 0 }}>
                  {toast.title}
                </div>
                {toast.message && (
                  <div style={{ fontSize: '11px', color: '#aaa', lineHeight: '1.5', wordBreak: 'break-word' }}>
                    {toast.message}
                  </div>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); removeToast(toast.id); }}
                style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px', padding: '0', flexShrink: 0, lineHeight: 1 }}
                title="Dismiss"
              >×</button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes sovereignSlideDown {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
