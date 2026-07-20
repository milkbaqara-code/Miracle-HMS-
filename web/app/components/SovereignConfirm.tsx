'use client';
// web/app/components/SovereignConfirm.tsx
// SOVEREIGN CONFIRM ENGINE — Replaces all confirm() calls across Miracle HMS
// Windows-style option buttons, contextual labels, destructive variant.

import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ConfirmOption {
  label: string;
  value: string;
  variant: 'danger' | 'warning' | 'confirm' | 'cancel';
}

export interface ConfirmRequest {
  title: string;
  message: string;
  icon?: string;
  options: ConfirmOption[];
}

interface ConfirmContextValue {
  showConfirm: {
    (request: ConfirmRequest): Promise<string | null>;
    (title: string, message: string): Promise<boolean>;
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────
const ConfirmContext = createContext<ConfirmContextValue>({
  showConfirm: async () => null as any,
});

export function useConfirm() {
  return useContext(ConfirmContext);
}

// ─── Variant Styles ───────────────────────────────────────────────────────────
const VARIANT_STYLE: Record<ConfirmOption['variant'], React.CSSProperties> = {
  danger:  { background: 'rgba(255,51,102,0.12)', border: '1px solid rgba(255,51,102,0.5)', color: '#ff3366' },
  warning: { background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.5)', color: '#D4AF37' },
  confirm: { background: 'rgba(0,251,255,0.12)', border: '1px solid rgba(0,251,255,0.5)', color: '#00fbff' },
  cancel:  { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', color: '#888' },
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SovereignConfirmProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ConfirmRequest | null>(null);
  const [resolveRef, setResolveRef] = useState<((val: string | null) => void) | null>(null);

  const showConfirm = useCallback((titleOrRequest: string | ConfirmRequest, message?: string): Promise<any> => {
    return new Promise(resolve => {
      if (typeof titleOrRequest === 'string') {
        setCurrent({
          title: titleOrRequest,
          message: message || '',
          options: [
            { label: 'CONFIRM', value: 'CONFIRM', variant: 'confirm' },
            { label: 'CANCEL', value: 'CANCEL', variant: 'cancel' }
          ]
        });
        setResolveRef(() => (val: string | null) => resolve(val === 'CONFIRM'));
      } else {
        setCurrent(titleOrRequest);
        setResolveRef(() => resolve);
      }
    });
  }, []);

  const handleSelect = (value: string | null) => {
    if (resolveRef) resolveRef(value);
    setCurrent(null);
    setResolveRef(null);
  };

  return (
    <ConfirmContext.Provider value={{ showConfirm }}>
      {children}
      {current && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(12px)',
            zIndex: 100000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'scrimFadeIn 0.2s ease',
          }}
          onClick={() => handleSelect(null)} // click outside = cancel
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '420px',
              background: 'rgba(10,10,15,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
              animation: 'confirmSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '24px 24px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: '16px', alignItems: 'flex-start',
            }}>
              {current.icon && (
                <div style={{ fontSize: '28px', flexShrink: 0, marginTop: '2px' }}>{current.icon}</div>
              )}
              <div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#FFF', letterSpacing: '0.5px', marginBottom: '8px', fontFamily: 'var(--font-cinzel, Cinzel, serif)' }}>
                  {current.title}
                </div>
                <div style={{ fontSize: '13px', color: '#aaa', lineHeight: '1.6' }}>
                  {current.message}
                </div>
              </div>
            </div>

            {/* Options */}
            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {current.options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    ...VARIANT_STYLE[opt.variant],
                    padding: '14px 20px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 900,
                    letterSpacing: '1px',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    width: '100%',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes scrimFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes confirmSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </ConfirmContext.Provider>
  );
}
