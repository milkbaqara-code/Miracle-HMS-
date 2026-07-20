'use client';
// web/app/components/SovereignPrompt.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

export interface PromptRequest {
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  icon?: string;
}

interface PromptContextValue {
  showPrompt: (request: PromptRequest) => Promise<string | null>;
}

const PromptContext = createContext<PromptContextValue>({
  showPrompt: async () => null,
});

export function usePrompt() {
  return useContext(PromptContext);
}

export function SovereignPromptProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<PromptRequest | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [resolveRef, setResolveRef] = useState<((val: string | null) => void) | null>(null);

  const showPrompt = useCallback((request: PromptRequest): Promise<string | null> => {
    return new Promise(resolve => {
      setCurrent(request);
      setInputValue(request.defaultValue || '');
      setResolveRef(() => resolve);
    });
  }, []);

  const handleSelect = (value: string | null) => {
    if (resolveRef) resolveRef(value);
    setCurrent(null);
    setResolveRef(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(inputValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleSelect(null);
    }
  };

  return (
    <PromptContext.Provider value={{ showPrompt }}>
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
          onClick={() => handleSelect(null)}
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

            {/* Input & Options */}
            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={current.placeholder}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(0,251,255,0.3)',
                  color: '#FFF',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  outline: 'none',
                  fontSize: '14px',
                  transition: 'border 0.2s',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleSelect(inputValue)}
                  style={{
                    background: 'rgba(0,251,255,0.12)',
                    border: '1px solid rgba(0,251,255,0.5)',
                    color: '#00fbff',
                    padding: '14px 20px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 900,
                    letterSpacing: '1px',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                    flex: 1,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                >
                  CONFIRM
                </button>
                <button
                  onClick={() => handleSelect(null)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#888',
                    padding: '14px 20px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 900,
                    letterSpacing: '1px',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                    flex: 1,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PromptContext.Provider>
  );
}
