"use client";
import React, { useState, useEffect, Component } from 'react';
import { useRouter } from 'next/navigation';
import StyledComponentsRegistry from '../guest/registry';

// ============================================================
// ERROR BOUNDARY — shows actual error on screen (debug mode)
// ============================================================
class OwnerErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string; stack: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '', stack: '' };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err?.message || String(err), stack: err?.stack || '' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#05070c',
          color: '#fff', padding: 20, overflowY: 'auto', fontFamily: 'monospace',
          zIndex: 99999,
        }}>
          <div style={{ color: '#ff4444', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            🔴 OWNER APP CRASH
          </div>
          <div style={{
            background: '#1a0000', border: '1px solid #ff4444', borderRadius: 10,
            padding: 15, marginBottom: 15, fontSize: 13, lineHeight: 1.6,
            wordBreak: 'break-all',
          }}>
            <strong>Error:</strong> {this.state.error}
          </div>
          <div style={{
            background: '#111', border: '1px solid #333', borderRadius: 10,
            padding: 15, fontSize: 11, lineHeight: 1.5,
            wordBreak: 'break-all', whiteSpace: 'pre-wrap',
            maxHeight: '60vh', overflowY: 'auto',
          }}>
            <strong style={{ color: '#888' }}>Stack:</strong>{'\n'}
            {this.state.stack}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: '', stack: '' })}
            style={{
              marginTop: 20, padding: '12px 24px', background: '#00f2ff',
              color: '#000', border: 'none', borderRadius: 10, fontWeight: 'bold',
              fontSize: 14, cursor: 'pointer', width: '100%',
            }}
          >RETRY</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// MAIN OWNER LAYOUT
// ============================================================
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<{name: string; nid_passport: string} | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);

  useEffect(() => {
    // Catch any unhandled JS errors and show them on screen
    const handleError = (e: ErrorEvent) => {
      setWindowError(`${e.message}\n\nFile: ${e.filename}:${e.lineno}`);
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      setWindowError(`Unhandled Promise: ${e.reason}`);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // SESSION RECOVERY
    const restoreSession = () => {
      try {
        const ownerData = localStorage.getItem('SOV_OWNER_SESSION');
        const token = localStorage.getItem('SOV_OWNER_TOKEN');
        if (ownerData && ownerData !== 'undefined' && token) {
          setSession(JSON.parse(ownerData));
        }
      } catch (e) {
        localStorage.removeItem('SOV_OWNER_SESSION');
      }
    };
    restoreSession();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') restoreSession();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleExitTrigger = () => setShowExitConfirm(true);
    window.addEventListener('TRIGGER_EXIT_GUARD', handleExitTrigger as EventListener);

    const handlePopState = (e: PopStateEvent) => {
      const p = window.location.pathname;
      if (p === '/owner/hub' || p === '/owner') {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
        setShowExitConfirm(true);
      }
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('TRIGGER_EXIT_GUARD', handleExitTrigger as EventListener);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleLogout = () => {
    if (confirm('Disconnect owner session?')) {
      localStorage.removeItem('SOV_OWNER_SESSION');
      localStorage.removeItem('SOV_OWNER_TOKEN');
      setSession(null);
      router.push('/owner');
    }
  };

  const confirmExit = async () => {
    try {
      const { App } = await import('@capacitor/app');
      await App.exitApp();
    } catch (e) {
      try { window.close(); } catch (_) {}
      setShowExitConfirm(false);
    }
  };

  return (
    <StyledComponentsRegistry>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          min-height: 100vh;
          background: #04070c;
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          -webkit-text-size-adjust: 100%;
        }
      `}</style>

      {/* Window-level error overlay */}
      {windowError && (
        <div style={{
          position: 'fixed', inset: 0, background: '#05070c', color: '#fff',
          padding: 20, overflowY: 'auto', fontFamily: 'monospace', zIndex: 99999,
        }}>
          <div style={{ color: '#ff4444', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
            🔴 JS ERROR DETECTED
          </div>
          <div style={{
            background: '#1a0000', border: '1px solid #ff4444', borderRadius: 8,
            padding: 15, fontSize: 12, lineHeight: 1.6, wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
          }}>
            {windowError}
          </div>
          <button
            onClick={() => setWindowError(null)}
            style={{
              marginTop: 20, padding: '12px 24px', background: '#00f2ff',
              color: '#000', border: 'none', borderRadius: 10, fontWeight: 'bold',
              fontSize: 14, cursor: 'pointer', width: '100%',
            }}
          >DISMISS</button>
        </div>
      )}

      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        color: '#fff',
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}>
        {session && (
          <header style={{
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(0,242,255,0.15)',
            background: 'rgba(4,7,12,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}>
            <div style={{ width: 44 }} />
            <h1 style={{
              fontSize: 'clamp(0.75rem, 2.5vw, 1rem)',
              color: '#00f2ff',
              letterSpacing: 2,
              fontWeight: 900,
            }}>MIRACLE SOVEREIGN OWNER</h1>
            <button onClick={handleLogout} style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '11px', cursor: 'pointer',
              padding: '9px 16px', borderRadius: '50px',
              minWidth: 44, minHeight: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '7px',
              fontWeight: 700, letterSpacing: '1.5px',
              transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,80,80,0.4)'; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
            onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,80,80,0.4)'; }}
            onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              EXIT
            </button>
          </header>
        )}

        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <OwnerErrorBoundary>
            {children}
          </OwnerErrorBoundary>
        </main>

        {showExitConfirm && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30,
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #05070c 0%, #010205 100%)',
              border: '1px solid rgba(0,242,255,0.3)',
              borderRadius: 35, padding: '50px 30px',
              textAlign: 'center', maxWidth: 340, width: '100%',
            }}>
              <div style={{ fontSize: 50, marginBottom: 25 }}>🏦</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#FFF', marginBottom: 12 }}>Close Owner App?</h2>
              <p style={{ color: '#666', fontSize: 12, marginBottom: 40, lineHeight: 1.8 }}>
                Closing the app will sign you out of your secure real estate ledger session.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <button onClick={() => setShowExitConfirm(false)} style={{
                  padding: 18, borderRadius: 18,
                  background: 'linear-gradient(135deg, #00f2ff 0%, #008ba3 100%)',
                  color: '#000', border: 'none', fontWeight: 900,
                  fontSize: 12, letterSpacing: 2, cursor: 'pointer',
                }}>CONTINUE SESSION</button>
                <button onClick={confirmExit} style={{
                  padding: 15, background: 'transparent', color: '#FF3131',
                  border: '1px solid rgba(255,49,49,0.2)', borderRadius: 18,
                  fontSize: 10, fontWeight: 900, letterSpacing: 2, cursor: 'pointer', opacity: 0.6,
                }}>EXIT PORTAL</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StyledComponentsRegistry>
  );
}
