'use client';
// ============================================================
// MIRACLE HMS — VISITOR TOUR GATEWAY + PACKAGE DEMO LAUNCHER
// Route: /visitor-tour
//
// TWO ENTRY MODES — detected from URL params:
//
// MODE A — TOKEN TOUR (from Vigilant website AI chat):
//   /visitor-tour?token=xxx
//   → Reads visitor profile from backend
//   → Sets allowed zones from backend response
//   → Redirects to /dashboard with personalised tour
//
// MODE B — PACKAGE LAUNCHER (direct enterprise demo):
//   /visitor-tour?package=FB_SUITE           (auto-launch)
//   /visitor-tour?launcher=true              (show selector UI)
//   /visitor-tour?package=FB_SUITE&auto=true (auto-launch from Vigilant site DemoTab)
//   → Shows 6 package cards OR auto-launches selected package
//   → Sets allowed zones from packagePresets.ts (no backend call needed)
//   → Redirects to /dashboard with scoped zone view
// ============================================================

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ZONE_PACKAGES, ZonePackage, PackageId, getPackage, activatePackageDemo } from '../lib/packagePresets';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');
const VISITOR_USERNAME = 'VISITOR';
const VISITOR_PASSWORD = 'VISITOR2024';

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function MiracleFlame() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes flameBreatheLarge {
          0%, 100% {
            filter: drop-shadow(0 0 10px #00f2ff) drop-shadow(0 0 25px rgba(0,242,255,0.35));
            transform: scale(0.98);
            opacity: 0.9;
          }
          50% {
            filter: drop-shadow(0 0 20px #00f2ff) drop-shadow(0 0 45px rgba(0,242,255,0.6));
            transform: scale(1.04);
            opacity: 1;
          }
        }
        .miracle-breathing-flame-lg {
          animation: flameBreatheLarge 3s ease-in-out infinite;
        }
      `}} />
      <svg
        width="48"
        height="60"
        viewBox="0 0 40 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="miracle-breathing-flame-lg"
      >
        <defs>
          <linearGradient id="vt-flame1" x1="20" y1="30" x2="20" y2="5" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00f2ff" />
            <stop offset="45%" stopColor="#9D00FF" />
            <stop offset="100%" stopColor="#ff007f" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="vt-flame2" x1="20" y1="27.5" x2="20" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00f2ff" opacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" opacity="0.85" />
          </linearGradient>
        </defs>
        <rect x="16" y="34" width="8" height="12" rx="1.5" fill="rgba(255,255,255,0.3)" stroke="rgba(0,242,255,0.4)" strokeWidth="0.75" />
        <line x1="20" y1="34" x2="20" y2="28" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round" />
        <path
          d="M20 5 C20 5, 27 15, 27 22 C27 26.5 23.8 30 20 30 C16.2 30 13 26.5 13 22 C13 15, 20 5, 20 5Z"
          fill="url(#vt-flame1)"
          opacity="0.95"
        />
        <path
          d="M20 12 C20 12, 24.5 18, 24.5 22.5 C24.5 25.5 22.5 27.5 20 27.5 C17.5 27.5 15.5 25.5 15.5 22.5 C15.5 18, 20 12, 20 12Z"
          fill="url(#vt-flame2)"
          opacity="0.85"
        />
        <circle cx="20" cy="21" r="2.5" fill="white" opacity="0.9" />
      </svg>
    </div>
  );
}

// ─── PACKAGE LAUNCHER UI (Mode B — no token) ─────────────────────────────────

function PackageLauncher({ autoPackage }: { autoPackage: PackageId | null }) {
  const router = useRouter();
  const [launching, setLaunching] = useState<string | null>(null);
  
  // Track selected package to show registration form
  const [selectedPkg, setSelectedPkg] = useState<ZonePackage | null>(null);
  
  // Registration Form state
  const [fullName, setFullName] = useState('');
  const [phoneNum, setPhoneNum] = useState('');
  const [enterpriseName, setEnterpriseName] = useState('');
  const [empCount, setEmpCount] = useState('10-50');
  const [errorMsg, setErrorMsg] = useState('');
  
  const COUNTRIES = [
    { code: 'AE', dial: '+971', name: 'UAE / Dubai' },
    { code: 'BD', dial: '+880', name: 'Bangladesh' },
    { code: 'GB', dial: '+44', name: 'United Kingdom' },
    { code: 'AU', dial: '+61', name: 'Australia' },
    { code: 'CA', dial: '+1', name: 'Canada' },
    { code: 'US', dial: '+1', name: 'United States' },
    { code: 'IN', dial: '+91', name: 'India' },
    { code: 'SA', dial: '+966', name: 'Saudi Arabia' },
    { code: 'SG', dial: '+65', name: 'Singapore' },
    { code: 'MY', dial: '+60', name: 'Malaysia' },
  ];
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);

  useEffect(() => {
    // Auto-select package if ?package=xxx (from Vigilant website click)
    if (autoPackage) {
      const pkg = getPackage(autoPackage);
      if (pkg) {
        setSelectedPkg(pkg);
      }
    }
  }, [autoPackage]);

  const handleLaunch = (pkg: ZonePackage) => {
    setLaunching(pkg.id);
    // Activate the package demo session (sets localStorage keys)
    activatePackageDemo(pkg);
    // Brief animation delay for visual polish, then navigate
    setTimeout(() => {
      router.push('/dashboard');
    }, 900);
  };

  const handleRegisterAndLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkg) return;
    setErrorMsg('');
    setLaunching(selectedPkg.id);

    if (!fullName || !phoneNum || !enterpriseName) {
      setErrorMsg('Please complete all required fields.');
      setLaunching(null);
      return;
    }

    // Clean phone number format
    const cleanNum = phoneNum.replace(/\D/g, '');
    const formattedNum = cleanNum.startsWith('0') ? cleanNum.substring(1) : cleanNum;
    const fullPhone = selectedCountry.dial + formattedNum;

    try {
      // 1. Submit lead to capture in database
      const res = await fetch(`${API_BASE}/visitor/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          enterprise_name: enterpriseName,
          emp_count: empCount,
          phone: fullPhone,
          country_code: selectedCountry.code,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.detail || 'Demo registration failed. Please check phone format.');
        setLaunching(null);
        return;
      }

      // Store lead name in local storage so header displays it
      localStorage.setItem('miracle_user', `${fullName} (Demo)`);

      // 2. Launch the scoped package demo
      handleLaunch(selectedPkg);

    } catch (err) {
      console.error('Registration failed:', err);
      // Fallback: If network error or backend fails, launch demo anyway so customer is not blocked
      localStorage.setItem('miracle_user', `${fullName} (Demo)`);
      handleLaunch(selectedPkg);
    }
  };

  // If auto-launching and loading
  if (selectedPkg && launching && fullName) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 20% 40%, rgba(0,242,255,0.07) 0%, transparent 60%), #04040e',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'monospace', gap: 0,
      }}>
        <style>{`
          @keyframes vt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
        <div style={{ fontSize: 56, marginBottom: 20 }}>{selectedPkg.icon}</div>
        <p style={{ color: selectedPkg.color || '#00f2ff', fontSize: 12, letterSpacing: 5, fontFamily: "'Orbitron', monospace", marginBottom: 8 }}>
          MIRACLE HMS
        </p>
        <p style={{ color: 'white', fontSize: 18, letterSpacing: 1, marginBottom: 4 }}>
          {selectedPkg.name}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 2, marginBottom: 32 }}>
          Preparing your scoped demo environment...
        </p>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: `2px solid rgba(255,255,255,0.1)`,
          borderTop: `2px solid ${selectedPkg.color || '#00f2ff'}`,
          animation: 'vt-spin 0.9s linear infinite',
        }} />
      </div>
    );
  }

  // Render registration form if a package is selected
  if (selectedPkg) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at 10% 20%, ${selectedPkg.color}15 0%, transparent 50%), #04040e`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: 'Inter, sans-serif',
      }}>
        <style dangerouslySetInnerHTML={{ __html: `
          .reg-panel {
            background: rgba(8, 8, 16, 0.7);
            border: 1px solid ${selectedPkg.color}35;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${selectedPkg.color}08;
            backdrop-filter: blur(12px);
            border-radius: 24px;
            width: 100%;
            max-width: 440px;
            padding: 32px;
          }
          .reg-title {
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            letter-spacing: 1px;
            color: white;
            text-align: center;
          }
          .reg-input {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 11px 16px;
            color: white;
            width: 100%;
            font-size: 13px;
            outline: none;
            transition: all 0.2s ease;
          }
          .reg-input:focus {
            border-color: ${selectedPkg.color};
            background: rgba(255,255,255,0.05);
            box-shadow: 0 0 10px ${selectedPkg.color}25;
          }
          .reg-btn {
            background: ${selectedPkg.color}15;
            border: 1px solid ${selectedPkg.color}45;
            color: white;
            padding: 12px;
            border-radius: 12px;
            font-family: 'Orbitron', monospace;
            font-weight: bold;
            font-size: 12px;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.2s ease;
            width: 100%;
          }
          .reg-btn:hover {
            background: ${selectedPkg.color}35;
            border-color: ${selectedPkg.color};
            box-shadow: 0 0 15px ${selectedPkg.color}35;
          }
          .reg-select {
            background: #04040e;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            color: white;
            font-size: 11px;
            padding: 0 12px;
            outline: none;
            width: 100px;
          }
        `}} />

        <div className="reg-panel">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{selectedPkg.icon}</div>
            <p style={{ color: selectedPkg.color, fontSize: 9, letterSpacing: 4, fontFamily: "'Orbitron', monospace", margin: '0 0 4px' }}>
              ACTIVATING SANDBOX
            </p>
            <h2 className="reg-title" style={{ fontSize: 18 }}>
              {selectedPkg.name}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
              Please register your profile below to generate an active 20-minute sandbox session.
            </p>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(255, 49, 49, 0.1)', border: '1px solid #ff3131', color: '#ff3131', padding: '10px 14px', borderRadius: '10px', fontSize: '11px', marginBottom: 16 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleRegisterAndLaunch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', display: 'block', marginBottom: '6px', fontFamily: "'Orbitron', sans-serif" }}>YOUR FULL NAME</label>
              <input className="reg-input" placeholder="e.g. Sajeed Islam" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>

            <div>
              <label style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', display: 'block', marginBottom: '6px', fontFamily: "'Orbitron', sans-serif" }}>ENTERPRISE / HOTEL NAME</label>
              <input className="reg-input" placeholder="e.g. Grand Palace Hotel" value={enterpriseName} onChange={e => setEnterpriseName(e.target.value)} required />
            </div>

            <div>
              <label style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', display: 'block', marginBottom: '6px', fontFamily: "'Orbitron', sans-serif" }}>WHATSAPP NUMBER</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  className="reg-select"
                  value={JSON.stringify(selectedCountry)}
                  onChange={e => setSelectedCountry(JSON.parse(e.target.value))}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={JSON.stringify(c)}>{c.code} ({c.dial})</option>
                  ))}
                </select>
                <input className="reg-input" placeholder="e.g. 1711477509" value={phoneNum} onChange={e => setPhoneNum(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="button" className="reg-btn" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.1)' }} onClick={() => setSelectedPkg(null)}>
                BACK
              </button>
              <button type="submit" className="reg-btn">
                INITIALISE DEMO
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500;600&display=swap');
        @keyframes vt-fadeup { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes vt-pulse-ring { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.35; } }
        .pkg-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px 20px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
          text-align: left;
          animation: vt-fadeup 0.5s ease both;
        }
        .pkg-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 16px;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }
        .pkg-card:hover {
          border-color: var(--pkg-color);
          background: rgba(255,255,255,0.06);
          transform: translateY(-3px);
          box-shadow: 0 0 28px rgba(0,0,0,0.4), 0 0 0 1px var(--pkg-color), 0 8px 32px rgba(0,0,0,0.3);
        }
        .pkg-card:hover::before {
          opacity: 1;
          background: radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.04) 0%, transparent 70%);
        }
        .pkg-card.launching {
          border-color: var(--pkg-color);
          background: rgba(255,255,255,0.08);
          transform: scale(0.98);
        }
        .pkg-icon {
          font-size: 32px;
          margin-bottom: 12px;
          display: block;
          line-height: 1;
        }
        .pkg-name {
          font-family: 'Orbitron', monospace;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 1px;
          color: white;
          margin-bottom: 4px;
        }
        .pkg-tagline {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 12px;
          line-height: 1.5;
        }
        .pkg-target {
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          color: rgba(255,255,255,0.3);
          line-height: 1.4;
        }
        .pkg-badge {
          position: absolute;
          top: 14px;
          right: 14px;
          font-size: 9px;
          letter-spacing: 1.5px;
          padding: 3px 8px;
          border-radius: 20px;
          font-family: 'Orbitron', monospace;
          font-weight: 700;
        }
        .launch-indicator {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 2px;
          border-radius: 0 0 16px 16px;
          background: var(--pkg-color);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .pkg-card:hover .launch-indicator,
        .pkg-card.launching .launch-indicator {
          opacity: 1;
        }
        .pkg-zone-count {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: rgba(255,255,255,0.3);
          font-family: 'Inter', sans-serif;
          margin-top: 10px;
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 15% 30%, rgba(0,242,255,0.05) 0%, transparent 55%), radial-gradient(ellipse at 85% 70%, rgba(157,0,255,0.05) 0%, transparent 55%), #04040e',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '48px 24px 64px',
        fontFamily: 'Inter, sans-serif',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48, animation: 'vt-fadeup 0.4s ease both' }}>
          <MiracleFlame />
          <p style={{ color: '#00f2ff', fontSize: 10, letterSpacing: 6, fontFamily: "'Orbitron', monospace", marginTop: 16, marginBottom: 4, textShadow: '0 0 12px rgba(0,242,255,0.5)' }}>
            MIRACLE HMS
          </p>
          <h1 style={{ color: 'white', fontSize: 26, fontWeight: 700, fontFamily: "'Orbitron', monospace", letterSpacing: 2, margin: '8px 0 6px' }}>
            Choose Your Demo
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, maxWidth: 400, lineHeight: 1.7, margin: '0 auto' }}>
            Select your business type. Your dashboard will show only the zones relevant to you — a real, working production environment.
          </p>
        </div>

        {/* Package Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          width: '100%',
          maxWidth: 820,
        }}>
          {ZONE_PACKAGES.map((pkg, idx) => {
            const isLaunching = launching === pkg.id;
            const totalZones = pkg.zones.length + pkg.accountingZones.length;
            const isEnterprise = pkg.id === 'ENTERPRISE';
            return (
              <div
                key={pkg.id}
                className={`pkg-card${isLaunching ? ' launching' : ''}`}
                style={{
                  '--pkg-color': pkg.color,
                  animationDelay: `${idx * 0.06}s`,
                } as React.CSSProperties}
                onClick={() => !launching && setSelectedPkg(pkg)}
              >
                {isEnterprise && (
                  <span className="pkg-badge" style={{ background: `${pkg.color}22`, color: pkg.color, border: `1px solid ${pkg.color}44` }}>
                    ALL ZONES
                  </span>
                )}
                <span className="pkg-icon">{pkg.icon}</span>
                <div className="pkg-name" style={{ color: pkg.color }}>{pkg.name}</div>
                <div className="pkg-tagline">{pkg.tagline}</div>
                <div className="pkg-target">{pkg.targetClient}</div>
                {!isEnterprise && (
                  <div className="pkg-zone-count">
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: pkg.color, display: 'inline-block', opacity: 0.7 }} />
                    {totalZones} zones included
                  </div>
                )}
                {isLaunching && (
                  <div style={{
                    position: 'absolute', top: 14, right: 14,
                    width: 16, height: 16, borderRadius: '50%',
                    border: `2px solid rgba(255,255,255,0.1)`,
                    borderTop: `2px solid ${pkg.color}`,
                    animation: 'vt-spin 0.7s linear infinite',
                  }} />
                )}
                <div className="launch-indicator" />
              </div>
            );
          })}
        </div>

        {/* Footer separator */}
        <div style={{ width: '100%', maxWidth: 820, margin: '36px 0 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }} />

        {/* Existing credentials fallback */}
        <div style={{ textAlign: 'center', animation: 'vt-fadeup 0.6s ease 0.4s both' }}>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginBottom: 14, letterSpacing: 1 }}>
            Already have access credentials?
          </p>
          <a
            href="/"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              color: 'rgba(0,242,255,0.6)', fontSize: 11, letterSpacing: 2,
              textDecoration: 'none', border: '1px solid rgba(0,242,255,0.2)',
              borderRadius: 10, padding: '8px 20px', fontFamily: "'Orbitron', monospace",
              transition: 'all 0.2s ease',
            }}
          >
            ← LOGIN WITH CREDENTIALS
          </a>
          <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: 9, marginTop: 32, letterSpacing: 3 }}>
            VIGILANT IT SOLUTION LTD · MIRACLE HMS · ENTERPRISE GRADE
          </p>
        </div>
      </div>
    </>
  );
}

// ─── TOKEN TOUR LOADER (Mode A — existing flow) ───────────────────────────────

type TourStage = 'loading' | 'authenticating' | 'ready' | 'error';

function TokenTourLoader({ token }: { token: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<TourStage>('loading');
  const [visitorName, setVisitorName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [statusLine, setStatusLine] = useState('Decoding your guided tour...');

  useEffect(() => {
    runTourFlow(token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runTourFlow(tok: string) {
    try {
      setStatusLine('Verifying your session...');
      const ctxRes = await fetch(`${API_BASE}/visitor/tour-context?token=${encodeURIComponent(tok)}`);

      if (!ctxRes.ok) {
        const err = await ctxRes.json().catch(() => ({ detail: 'Session expired or invalid.' }));
        throw new Error(err.detail || 'Tour token verification failed.');
      }

      const profile = await ctxRes.json();
      setVisitorName(profile.visitor_name || 'Valued Guest');

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('miracle_visitor_context', JSON.stringify(profile));
      }

      setStage('authenticating');
      setStatusLine(`Welcome, ${profile.visitor_name || 'Valued Guest'}! Preparing your guided tour...`);

      const authRes = await fetch(`${API_BASE}/visitor/tour-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok }),
      });

      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.access_token && typeof window !== 'undefined') {
          localStorage.setItem('miracle_token', authData.access_token);
          localStorage.setItem('vigilant_role', 'VISITOR');
          localStorage.setItem('miracle_user', profile.visitor_name || 'VISITOR');
          localStorage.setItem('miracle_visitor_allowed_zones', JSON.stringify(authData.allowed_zones || []));
          localStorage.setItem('miracle_demo_expires_at', (Date.now() + 20 * 60 * 1000).toString());
          document.cookie = `miracle_session_token=${authData.access_token}; path=/; max-age=7200; SameSite=Lax; Secure`;
        }
      } else {
        throw new Error('Dynamic tour session authentication failed.');
      }

      setStage('ready');
      setStatusLine('Initialising your sovereign tour environment...');
      await new Promise(r => setTimeout(r, 1800));
      router.push('/dashboard');

    } catch (err: any) {
      console.error('[VisitorTour]', err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setStage('error');
    }
  }

  if (stage === 'error') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 20% 40%, rgba(0,242,255,0.06) 0%, transparent 60%), #04040e',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Orbitron', monospace", padding: 24,
      }}>
        <MiracleFlame />
        <p style={{ color: '#ff4444', marginTop: 24, fontSize: 14, textAlign: 'center', maxWidth: 420 }}>
          ⚠️ {errorMsg}
        </p>
        <a href="https://www.vigilantitsolution.com" style={{ marginTop: 20, color: '#00f2ff', fontSize: 12, textDecoration: 'none', border: '1px solid rgba(0,242,255,0.3)', borderRadius: 10, padding: '10px 20px', letterSpacing: 2 }}>
          ← RETURN TO WEBSITE
        </a>
        <a href="https://wa.me/8801711477509" target="_blank" rel="noopener noreferrer" style={{ marginTop: 12, color: '#25d366', fontSize: 11, textDecoration: 'none', letterSpacing: 1 }}>
          💬 SPEAK TO OUR ENGINEER DIRECTLY
        </a>
      </div>
    );
  }

  const stageColors: Record<TourStage, string> = {
    loading: '#00f2ff',
    authenticating: '#9D00FF',
    ready: '#39FF14',
    error: '#ff4444',
  };

  return (
    <>
      <style>{`
        @keyframes vt-breathe { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        @keyframes vt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 20% 40%, rgba(0,242,255,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 60%, rgba(157,0,255,0.06) 0%, transparent 60%), #04040e',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'monospace', gap: 0,
      }}>
        <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${stageColors[stage]}`, opacity: 0.4, animation: 'vt-breathe 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: `1px solid ${stageColors[stage]}`, opacity: 0.15, animation: 'vt-breathe 2s ease-in-out infinite 0.5s' }} />
          <MiracleFlame />
        </div>
        <p style={{ color: stageColors[stage], fontSize: 11, letterSpacing: 6, fontFamily: "'Orbitron', monospace", marginBottom: 8, textShadow: `0 0 12px ${stageColors[stage]}` }}>
          MIRACLE AI
        </p>
        {visitorName && (
          <p style={{ color: 'white', fontSize: 16, marginBottom: 6, letterSpacing: 1 }}>{visitorName}</p>
        )}
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, marginBottom: 32, textAlign: 'center', maxWidth: 320 }}>
          GUIDED TOUR INITIALISING
        </p>
        <p style={{ color: 'rgba(0,242,255,0.7)', fontSize: 11, letterSpacing: 1, textAlign: 'center', maxWidth: 380, lineHeight: 1.8 }}>
          {statusLine}
        </p>
        <div style={{ marginTop: 32, width: 32, height: 32, borderRadius: '50%', border: `2px solid rgba(0,242,255,0.15)`, borderTop: `2px solid ${stageColors[stage]}`, animation: 'vt-spin 1s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, letterSpacing: 3, marginTop: 40 }}>
          VIGILANT IT SOLUTION LTD · MIRACLE HMS
        </p>
      </div>
    </>
  );
}

// ─── INNER CONTENT — Reads URL params to pick mode ───────────────────────────

function VisitorTourContent() {
  const searchParams = useSearchParams();

  const token    = searchParams.get('token');
  const pkgParam = searchParams.get('package') as PackageId | null;
  const launcher = searchParams.get('launcher');
  const auto     = searchParams.get('auto');

  // MODE A: Token-based tour from Vigilant website AI
  if (token) {
    return <TokenTourLoader token={token} />;
  }

  // MODE B: Package launcher
  // - ?launcher=true → show selector (no auto-launch)
  // - ?package=FB_SUITE → show selector with that card highlighted
  // - ?package=FB_SUITE&auto=true → auto-launch immediately
  const autoLaunch = pkgParam && auto === 'true' ? pkgParam : null;
  return <PackageLauncher autoPackage={autoLaunch} />;
}

// ─── DEFAULT EXPORT — Suspense wrapper (Next.js App Router requirement) ───────

export default function VisitorTourPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: '#04040e',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <MiracleFlame />
        <p style={{ color: 'rgba(0,242,255,0.5)', fontSize: 10, letterSpacing: 4, marginTop: 24, fontFamily: 'monospace' }}>
          MIRACLE AI LOADING...
        </p>
      </div>
    }>
      <VisitorTourContent />
    </Suspense>
  );
}
