"use client";
import React, { useState, useEffect, Component } from 'react';
import { useRouter } from 'next/navigation';
import { RadioProvider } from '../context/RadioContext';
import StyledComponentsRegistry from './registry';

// ============================================================
// PATIENT APP ERROR BOUNDARY
// ============================================================
class PatientErrorBoundary extends Component<
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
          position: 'fixed', inset: 0, background: '#020b0c',
          color: '#fff', padding: 20, overflowY: 'auto', fontFamily: 'monospace',
          zIndex: 99999,
        }}>
          <div style={{ color: '#ff5a5a', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            🔴 CLINICAL APP EXCEPTION
          </div>
          <div style={{
            background: '#1a0000', border: '1px solid #ff5a5a', borderRadius: 10,
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
              marginTop: 20, padding: '12px 24px', background: '#52d1a3',
              color: '#041417', border: 'none', borderRadius: 10, fontWeight: 'bold',
              fontSize: 14, cursor: 'pointer', width: '100%',
            }}
          >RETRY SYNC</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// PATIENT PORTAL LAYOUT
// ============================================================
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<{name: string, room: string} | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setWindowError(`${e.message}\n\nFile: ${e.filename}:${e.lineno}`);
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      setWindowError(`Unhandled Promise: ${e.reason}`);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    const restoreSession = () => {
      try {
        const guestData = localStorage.getItem('SOV_GUEST_SESSION');
        const token = localStorage.getItem('SOV_GUEST_TOKEN');
        if (guestData && guestData !== 'undefined' && token) {
          setSession(JSON.parse(guestData));
        }
      } catch (e) {
        localStorage.removeItem('SOV_GUEST_SESSION');
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
      if (p === '/guest/hub' || p === '/guest') {
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
    if (confirm('End your clinical session?')) {
      localStorage.removeItem('SOV_GUEST_SESSION');
      localStorage.removeItem('SOV_GUEST_TOKEN');
      setSession(null);
      router.push('/guest');
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
    <RadioProvider>
      <StyledComponentsRegistry>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          min-height: 100vh;
          background: #020b0c;
          color: #f4f9f7;
          font-family: 'Outfit', sans-serif;
          -webkit-font-smoothing: antialiased;
          -webkit-text-size-adjust: 100%;
        }
      `}</style>

      {/* Window-level error overlay */}
      {windowError && (
        <div style={{
          position: 'fixed', inset: 0, background: '#020b0c', color: '#fff',
          padding: 20, overflowY: 'auto', fontFamily: 'monospace', zIndex: 99999,
        }}>
          <div style={{ color: '#ff5a5a', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
            🔴 JS EXCEPTION DETECTED
          </div>
          <div style={{
            background: '#1a0000', border: '1px solid #ff5a5a', borderRadius: 8,
            padding: 15, fontSize: 12, lineHeight: 1.6, wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
          }}>
            {windowError}
          </div>
          <button
            onClick={() => setWindowError(null)}
            style={{
              marginTop: 20, padding: '12px 24px', background: '#52d1a3',
              color: '#041417', border: 'none', borderRadius: 10, fontWeight: 'bold',
              fontSize: 14, cursor: 'pointer', width: '100%',
            }}
          >DISMISS</button>
        </div>
      )}

      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        color: '#f4f9f7',
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
            borderBottom: '1px solid rgba(82,209,163,0.15)',
            background: 'rgba(4,20,23,0.9)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}>
            <div style={{ width: 44 }} />
            <h1 style={{
              fontSize: 'clamp(0.75rem, 2.5vw, 1rem)',
              color: '#52d1a3',
              letterSpacing: 1.5,
              fontWeight: 'bold',
            }}>PATIENT PORTAL</h1>
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
              transition: 'all 0.2s',
            }}
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
          <PatientErrorBoundary>
            {children}
          </PatientErrorBoundary>
        </main>

        {showExitConfirm && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30,
          }}>
            <div style={{
              background: 'rgba(4,20,23,0.95)',
              border: '1px solid rgba(82,209,163,0.3)',
              borderRadius: 24, padding: '40px 30px',
              textAlign: 'center', maxWidth: 340, width: '100%',
            }}>
              <div style={{ fontSize: 50, marginBottom: 20 }}>🌿</div>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 12 }}>Exit Patient Portal?</h2>
              <p style={{ color: '#aaa', fontSize: 12, marginBottom: 30, lineHeight: 1.6 }}>
                Are you sure you want to end your active patient session?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <button onClick={() => setShowExitConfirm(false)} style={{
                  padding: 16, borderRadius: 12,
                  background: '#52d1a3',
                  color: '#041417', border: 'none', fontWeight: 'bold',
                  fontSize: 12, letterSpacing: 1.5, cursor: 'pointer',
                }}>CONTINUE SESSION</button>
                <button onClick={confirmExit} style={{
                  padding: 14, background: 'transparent', color: '#ff5a5a',
                  border: '1px solid rgba(255,90,90,0.2)', borderRadius: 12,
                  fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, cursor: 'pointer',
                }}>EXIT PORTAL</button>
              </div>
            </div>
          </div>
        )}
      </div>
      </StyledComponentsRegistry>
    </RadioProvider>
  );
}
