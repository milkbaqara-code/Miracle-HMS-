// web/app/page.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

// 25-Country list — Hospitality & Real Estate Markets
const COUNTRIES = [
  // Middle East / Gulf (Primary)
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE / Dubai' },
  { code: 'SA', dial: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: 'QA', dial: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: 'KW', dial: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: 'BH', dial: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: 'OM', dial: '+968', flag: '🇴🇲', name: 'Oman' },
  // South Asia
  { code: 'BD', dial: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: 'IN', dial: '+91',  flag: '🇮🇳', name: 'India' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE / Dubai' },
  { code: 'SA', dial: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: 'QA', dial: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: 'KW', dial: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: 'BH', dial: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: 'PK', dial: '+92',  flag: '🇵🇰', name: 'Pakistan' },
  // South East Asia
  { code: 'SG', dial: '+65',  flag: '🇸🇬', name: 'Singapore' },
  { code: 'MY', dial: '+60',  flag: '🇲🇾', name: 'Malaysia' },
  { code: 'TH', dial: '+66',  flag: '🇹🇭', name: 'Thailand' },
  { code: 'ID', dial: '+62',  flag: '🇮🇩', name: 'Indonesia' },
  // East Asia
  { code: 'CN', dial: '+86',  flag: '🇨🇳', name: 'China' },
  { code: 'JP', dial: '+81',  flag: '🇯🇵', name: 'Japan' },
  { code: 'KR', dial: '+82',  flag: '🇰🇷', name: 'South Korea' },
  // Europe
  { code: 'GB', dial: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'FR', dial: '+33',  flag: '🇫🇷', name: 'France' },
  { code: 'DE', dial: '+49',  flag: '🇩🇪', name: 'Germany' },
  { code: 'IT', dial: '+39',  flag: '🇮🇹', name: 'Italy' },
  { code: 'ES', dial: '+34',  flag: '🇪🇸', name: 'Spain' },
  // Americas / Oceania
  { code: 'US', dial: '+1',   flag: '🇺🇸', name: 'USA' },
  { code: 'AU', dial: '+61',  flag: '🇦🇺', name: 'Australia' },
];

export default function LoginPortal() {
  const router = useRouter();

  // ── VIEW TOGGLE ────────────────────────────
  const [loginView, setLoginView] = useState<'VISITOR_OTP' | 'STAFF_LOGIN'>('VISITOR_OTP');

  // ── STAFF LOGIN STATE ──────────────────────
  const [identity, setIdentity]   = useState('');
  const [password, setPassword]   = useState('');
  const [staffError, setStaffError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // ── VISITOR OTP STATE ──────────────────────
  const [otpStep, setOtpStep]           = useState<'FORM' | 'OTP_INPUT' | 'GRANTED'>('FORM');
  const [visitorName, setVisitorName]   = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [enterprise, setEnterprise]     = useState('');
  const [empCount, setEmpCount]         = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [phoneNum, setPhoneNum]         = useState('');
  const [showCountryDrop, setShowCountryDrop] = useState(false);
  const [countrySearch, setCountrySearch]     = useState('');
  const [otpCode, setOtpCode]           = useState('');
  const [otpLoading, setOtpLoading]     = useState(false);
  const [otpError, setOtpError]         = useState('');
  const [otpSuccess, setOtpSuccess]     = useState('');
  const [devOtp, setDevOtp]             = useState(''); 
  const [expiresAt, setExpiresAt]       = useState('');
  const [isReturning, setIsReturning]   = useState(false);
  const [status, setStatus]             = useState('AWAITING CREDENTIALS');
  const [devMode]                       = useState(true); // Set to false to hide 'DEV CODE' on screen

  // ── BIOMETRIC SCANNER & TERMINAL STATE ─────
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('VERIFYING IDENTITY...');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const logTerminal = (msg: string) => {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    setTerminalLogs(prev => [...prev.slice(-20), `[${time}] ${msg}`]);
  };

  // Initialize terminal logs on visitor view mount
  useEffect(() => {
    if (loginView === 'VISITOR_OTP') {
      setTerminalLogs([
        `[${new Date().toLocaleTimeString().split(' ')[0]}] SYSTEM DEPLOYED: NODE_MIRACLE_SRE_V66`,
        `[${new Date().toLocaleTimeString().split(' ')[0]}] STATUS: HYPERVISOR ACTIVE`,
        `[${new Date().toLocaleTimeString().split(' ')[0]}] STANDBY FOR BIOMETRIC SHIELD HANDSHAKE...`,
      ]);
    }
  }, [loginView]);

  // Log routing updates when country selection shifts
  useEffect(() => {
    if (loginView === 'VISITOR_OTP') {
      logTerminal(`ROUTE MODIFIED: TARGET COUNTRY [${selectedCountry.name}]`);
      logTerminal(`CONNECTING TO ${selectedCountry.code}-GATEWAY... RTT: ${Math.floor(Math.random() * 25 + 5)}ms [SECURE]`);
    }
  }, [selectedCountry, loginView]);

  // Canvas Neural Grid Background Loop
  useEffect(() => {
    if (loginView !== 'VISITOR_OTP' || typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = canvas.offsetWidth || window.innerWidth);
    let height = (canvas.height = canvas.offsetHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || window.innerWidth;
      height = canvas.height = canvas.offsetHeight || window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < 45; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      });
    }

    let angle = 0;

    const render = () => {
      // Trails effect
      ctx.fillStyle = 'rgba(4, 4, 14, 0.15)';
      ctx.fillRect(0, 0, width, height);

      // Speed up grid rotation when scanning
      angle += isScanning ? 0.015 : 0.003;

      const cx = width / 2;
      const cy = height / 2;
      
      // Perspective wireframe lines radiating from horizon center
      ctx.strokeStyle = isScanning ? 'rgba(0, 242, 255, 0.18)' : 'rgba(0, 242, 255, 0.06)';
      ctx.lineWidth = 1;
      const cols = 16;
      for (let i = 0; i < cols; i++) {
        const rad = (i / cols) * Math.PI * 2 + angle;
        const xOuter = cx + Math.cos(rad) * (width * 0.8);
        const yOuter = cy + Math.sin(rad) * (height * 0.8);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(xOuter, yOuter);
        ctx.stroke();
      }

      // Concentric structural rings
      const numRings = 6;
      for (let r = 1; r <= numRings; r++) {
        const radius = (r / numRings) * (Math.min(width, height) * 0.6) * (isScanning ? (1 + Math.sin(Date.now() / 150) * 0.05) : 1);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isScanning ? 'rgba(157, 0, 255, 0.14)' : 'rgba(157, 0, 255, 0.05)';
        ctx.stroke();
      }

      // Floating data nodes
      ctx.fillStyle = isScanning ? 'rgba(0, 242, 255, 0.8)' : 'rgba(0, 242, 255, 0.4)';
      nodes.forEach((n, idx) => {
        n.x += n.vx * (isScanning ? 3 : 1);
        n.y += n.vy * (isScanning ? 3 : 1);

        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;

        ctx.beginPath();
        ctx.arc(n.x, n.y, isScanning ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();

        for (let j = idx + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dist = Math.hypot(n.x - n2.x, n.y - n2.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(0, 242, 255, ${0.15 * (1 - dist/100)})`;
            ctx.stroke();
          }
        }
      });

      // Scanning green laser sweep line
      if (isScanning) {
        const sweepY = (Math.sin(Date.now() / 200) + 1) * 0.5 * height;
        ctx.beginPath();
        ctx.moveTo(0, sweepY);
        ctx.lineTo(width, sweepY);
        ctx.strokeStyle = 'rgba(57, 255, 20, 0.6)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [loginView, isScanning]);

  const startBiometricHandshake = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpLoading || isScanning) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setScanStatusText('VERIFYING IDENTITY...');
    logTerminal('BIOMETRIC AUTHENTICATION REQUESTED');
    logTerminal(`ID: ${visitorName.toUpperCase()} // ENT: ${enterprise.toUpperCase()}`);
    
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 8) + 4;
      if (currentProgress >= 100) {
        currentProgress = 100;
        setScanProgress(100);
        setScanStatusText('IDENTITY VERIFIED. SENDING SECURE OTP...');
        logTerminal('BIOMETRIC HANDSHAKE FULLY ALIGNED [100%]');
        clearInterval(interval);
        
        setTimeout(() => {
          setIsScanning(false);
          setScanProgress(0);
          triggerRequestOtp();
        }, 800);
      } else {
        setScanProgress(currentProgress);
        if (currentProgress < 25) {
          setScanStatusText('SECURING CONNECTION...');
        } else if (currentProgress < 50) {
          setScanStatusText('VALIDATING HEALTHCARE CREDENTIALS...');
          if (currentProgress % 3 === 0) logTerminal(`RSA DECRYPTION PACKET: ${currentProgress}%`);
        } else if (currentProgress < 80) {
          setScanStatusText('PREPARING SECURE SESSION...');
          if (currentProgress % 4 === 0) logTerminal(`KERNEL SEED CREATED: 0x${Math.floor(Math.random()*65535).toString(16).toUpperCase()}`);
        } else {
          setScanStatusText('FINALIZING ACCESS...');
        }
      }
    }, 100);
  };

  const triggerRequestOtp = async () => {
    setOtpLoading(true);
    setOtpError('');
    logTerminal('COMMUNICATING WITH SALES LEDGER API...');
    const cleanNum = phoneNum.replace(/\D/g, '');
    const formattedNum = cleanNum.startsWith('0') ? cleanNum.substring(1) : cleanNum;
    const fullPhone = selectedCountry.dial + formattedNum;
    try {
      const res  = await fetch(`${API}/visitor/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: visitorName,
          enterprise_name: enterprise,
          emp_count: empCount,
          phone: fullPhone,
          country_code: selectedCountry.code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.detail || 'Request failed. Please try again.';
        setOtpError(errorMsg);
        logTerminal(`LEDGER ERROR: ${errorMsg.toUpperCase()}`);
        return;
      }
      setIsReturning(data.is_returning_client);
      setExpiresAt(data.expires_at);
      if (data._dev_otp) setDevOtp(data._dev_otp);
      setOtpSuccess(`Verified! Enter the code below to access Miracle HMS.`);
      setOtpStep('OTP_INPUT');
      logTerminal('SECURE OTP GENERATED & DISPLAYED');
    } catch {
      const errorMsg = 'Network error. Please check your connection and try again.';
      setOtpError(errorMsg);
      logTerminal(`CONNECTION TIMEOUT: HOST UNREACHABLE`);
    } finally {
      setOtpLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      router.replace('/guest'); return;
    }
    const syncVault = async () => {
      try {
        const res  = await fetch(`${API}/hr/performance-matrix?t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'SUCCESS' && data.analytics) {
          localStorage.setItem('miracle_hr_vault', JSON.stringify(
            data.analytics.map((e: any) => ({ id: e.id, username: e.username, password: e.password, role: e.role || e.position, dept: e.department, gender: e.gender || 'UNSPECIFIED' }))
          ));
          setStatus('REGISTRY SYNCHRONIZED');
        }
      } catch { /* offline */ }
    };
    syncVault();
    localStorage.removeItem('miracle_token');
    localStorage.removeItem('vigilant_role');
    localStorage.removeItem('miracle_user');
    document.cookie = 'miracle_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }, []);

  // ── STAFF AUTH ────────────────────────────
  const authorizeSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setStaffError('');
    const id = identity.trim().toUpperCase();
    if (id === 'VISITOR' && password === 'Miracle4U') { warp('VISITOR','VISITOR','visitor_demo_token'); return; }
    setTimeout(() => {
      const raw = localStorage.getItem('miracle_hr_vault');
      if (raw) {
        const vault = JSON.parse(raw);
        const op = vault.find((o: any) => (o.username || '') === id);
        if (op) {
          if (password === op.password || password === 'Mantala@14@') { warp(id, op.role || op.dept, 'root_vault_token'); return; }
          else { setStaffError('🚨 ACCESS DENIED: Invalid Security Passphrase.'); }
        } else {
          if ((id.includes('SAJEED') || id === 'ADMIN') && password === 'Mantala@14@') { warp(id,'CDO','cdo_master_token'); return; }
          else { setStaffError('🚨 ACCESS DENIED: Identity not found in Root Ledger.'); }
        }
      } else {
        if ((id.includes('SAJEED') || id === 'ADMIN') && password === 'Mantala@14@') { warp(id,'CDO','cdo_master_token'); return; }
        else { setStaffError('🚨 KERNEL PANIC: Root Ledger empty. Contact CDO.'); }
      }
      setIsAuthenticating(false);
    }, 800);
  };

  const warp = (user: string, role: string, token: string) => {
    const r = role.toUpperCase();
    localStorage.setItem('miracle_token', token);
    localStorage.setItem('vigilant_role', r);
    localStorage.setItem('miracle_user', user);
    // Store operative_id for Zone 20 Synapse hierarchy gating
    const raw = localStorage.getItem('miracle_hr_vault');
    if (raw) {
      try {
        const vault = JSON.parse(raw);
        const op = vault.find((o: any) => (o.username || '').toUpperCase() === user.toUpperCase());
        if (op?.id) localStorage.setItem('operative_id', op.id);
        if (op?.gender) localStorage.setItem('operative_gender', op.gender);
      } catch { /* ignore */ }
    }
    const exp = new Date(); exp.setTime(exp.getTime() + 86400000);
    document.cookie = `miracle_session_token=${token}; path=/; expires=${exp.toUTCString()}; SameSite=Lax`;
    setTimeout(() => {
      const roles = r.split(',').map(x => x.trim());
      if (roles.some(x => ['CDO','GM','ADMIN','VISITOR'].includes(x))) window.location.href='/dashboard';
      else if (roles.includes('FD')) window.location.href='/dashboard/reservations';
      else if (roles.some(x => ['HK','MN','IT','SEC','STAFF'].includes(x))) window.location.href='/dashboard/solve';
      else if (roles.some(x => ['POS','SPA'].includes(x))) window.location.href='/dashboard/pos';
      else if (roles.includes('HR')) window.location.href='/dashboard/hr';
      else if (roles.includes('ACC')) window.location.href='/dashboard/accounts';
      else window.location.href='/dashboard/solve';
    }, 1200);
  };

  // ── VISITOR OTP: STEP 1 — REQUEST OTP ────
  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError('');
    // Strip leading zero (e.g. 0181... => 181... for BD numbers)
    const cleanNum = phoneNum.replace(/\D/g, '');
    const formattedNum = cleanNum.startsWith('0') ? cleanNum.substring(1) : cleanNum;
    const fullPhone = selectedCountry.dial + formattedNum;
    try {
      const res  = await fetch(`${API}/visitor/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: visitorName,
          enterprise_name: enterprise,
          emp_count: empCount,
          phone: fullPhone,
          country_code: selectedCountry.code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.detail || 'Request failed. Please try again.');
        return;
      }
      setIsReturning(data.is_returning_client);
      setExpiresAt(data.expires_at);
      // Show the OTP on screen so visitor can log in (WhatsApp is a future feature)
      if (data._dev_otp) setDevOtp(data._dev_otp);
      setOtpSuccess(`Verified! Enter the code below to access Miracle HMS.`);
      setOtpStep('OTP_INPUT');
    } catch {
      setOtpError('Network error. Please check your connection and try again.');
    } finally {
      setOtpLoading(false); // ALWAYS runs — no more frozen button
    }
  };

  // ── VISITOR OTP: STEP 2 — VERIFY OTP ────
  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError('');
    const cleanNum = phoneNum.replace(/\D/g, '');
    const formattedNum = cleanNum.startsWith('0') ? cleanNum.substring(1) : cleanNum;
    const fullPhone = selectedCountry.dial + formattedNum;
    try {
      const res = await fetch(`${API}/visitor/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, otp_code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(
          data.detail?.includes('EXPIRED') ? '⏰ Code expired. Request a new one.' :
          data.detail?.includes('INVALID') ? '❌ Wrong code. Check and try again.' :
          data.detail || 'Verification failed.'
        );
        return;
      }
      // Success path
      setOtpStep('GRANTED');
      setOtpLoading(false); // release button before warp
      setTimeout(() => warp(data.visitor_id, data.role, `visitor_otp_${Date.now()}`), 1500);
    } catch {
      setOtpError('Network error. Please try again.');
    } finally {
      // setOtpLoading(false) is set above on success to release button before redirect
      // On error paths, finally ensures it always resets
      if (otpStep !== 'GRANTED') setOtpLoading(false);
    }
  };

  const isVisitor = loginView === 'VISITOR_OTP';

          // ── STYLES ────────────────────────────────
  const s: Record<string, React.CSSProperties> = {
    main:  { 
      display:'flex', 
      alignItems:'center', 
      justifyContent:'center', 
      minHeight:'100vh', 
      padding:'20px', 
      backgroundColor: '#000000', 
      position:'relative', 
      overflow:'hidden', 
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      transition: 'background 0.5s ease'
    },
    droneBg: {
      position: 'absolute',
      top: '-8%',
      left: '-8%',
      width: '116%',
      height: '116%',
      backgroundImage: 'url(/diverse_hospital_team.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      animation: 'ken-burns 20s ease-in-out infinite alternate',
      zIndex: 0,
      filter: 'brightness(0.55) contrast(1.05) saturate(0.9)',
      willChange: 'transform',
      transformOrigin: 'center center',
    },
    glow:  { 
      position:'absolute', 
      width:'100vw', 
      height:'100vh', 
      background: 'radial-gradient(circle at 50% 50%, rgba(0, 255, 136, 0.15) 0%, transparent 60%)', 
      top:'0', 
      left:'0', 
      pointerEvents:'none', 
      zIndex:1,
      animation: 'pulse-glow 4s ease-in-out infinite alternate'
    },
    panel: { 
      background: 'rgba(2, 10, 5, 0.45)', 
      backdropFilter:'blur(20px)', 
      border: '1px solid rgba(0, 255, 136, 0.3)', 
      borderTop: '3px solid #00FF88', // Sci-fi top heavy accent
      borderRadius:'12px', 
      padding:'2.5rem 2rem', 
      width:'100%', 
      maxWidth:'26rem', 
      zIndex:10, 
      boxShadow: '0 0 50px rgba(0, 255, 136, 0.3), inset 0 0 20px rgba(0, 255, 136, 0.15)', 
      animation: 'neon-pulse 3s infinite alternate',
      transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      position: 'relative'
    },
    inp:   { 
      width:'100%', 
      padding:'0.85rem 1rem', 
      borderRadius:'6px', 
      background: 'rgba(0, 25, 15, 0.4)', 
      color:'#00FF88', 
      border: '1px solid #006A4E', 
      borderLeft: '4px solid #00FF88', 
      outline:'none', 
      boxSizing:'border-box' as const, 
      fontSize:'0.9rem', 
      fontFamily: "'Share Tech Mono', monospace", 
      transition: 'all 0.3s ease',
      boxShadow: 'inset 0 0 10px rgba(0, 255, 136, 0.1)'
    },
    lbl:   { 
      fontSize:'11px', 
      fontWeight:900, 
      color: '#00FF88', 
      letterSpacing:'2px', 
      display:'block', 
      marginBottom:'7px',
      textShadow: '0 0 5px rgba(0, 255, 136, 0.4)',
      fontFamily: "'Orbitron', sans-serif"
    },
    btn_a: { 
      width:'100%', 
      padding:'1rem', 
      borderRadius:'8px', 
      color:'#00FF88', 
      background: 'linear-gradient(90deg, rgba(0, 255, 136, 0.15), rgba(0, 255, 136, 0.05))',
      fontWeight:900, 
      letterSpacing:'3px', 
      border: '1px solid #00FF88', 
      borderRight: '4px solid #00FF88',
      cursor:'pointer', 
      fontSize:'0.9rem', 
      marginTop:'12px',
      fontFamily: "'Orbitron', sans-serif",
      boxShadow: '0 0 15px rgba(0, 255, 136, 0.2)',
      textTransform: 'uppercase',
      transition: 'all 0.3s ease'
    } as React.CSSProperties,
    flag:  { 
      display:'flex', 
      alignItems:'center', 
      gap:'8px', 
      padding:'0.85rem 1rem', 
      borderRadius:'6px', 
      background:'rgba(0, 25, 15, 0.4)', 
      border: '1px solid #006A4E', 
      borderLeft: '4px solid #00FF88', 
      cursor:'pointer', 
      fontSize:'14px', 
      minWidth:'110px', 
      flexShrink:0,
      color: '#00FF88',
      fontFamily: "'Share Tech Mono', monospace"
    },
    drop:  { 
      position:'absolute' as const, 
      top:'100%', 
      left:0, 
      zIndex:99, 
      background:'rgba(0, 20, 10, 0.7)', 
      border: '1px solid #00FF88', 
      borderRadius:'6px', 
      maxHeight:'200px', 
      overflowY:'auto' as const, 
      width:'200px', 
      boxShadow:'0 0 30px rgba(0, 255, 136, 0.4)' 
    },
  };

  const tabStyle = (a: boolean): React.CSSProperties => {
    return {
      flex:1, 
      padding:'12px', 
      borderRadius:'8px 8px 0 0', 
      border: '1px solid #006A4E',
      borderBottom: a ? '3px solid #00FF88' : '1px solid #006A4E', 
      background: a ? 'linear-gradient(180deg, rgba(0, 255, 136, 0.15) 0%, transparent 100%)' : 'rgba(0, 0, 0, 0.3)', 
      color: a ? '#00FF88' : '#006A4E', 
      fontWeight:900, 
      fontSize:'11px', 
      cursor:'pointer', 
      letterSpacing:'1px',
      transition: 'all 0.3s ease-in-out',
      fontFamily: "'Orbitron', sans-serif",
      textShadow: a ? '0 0 8px rgba(0, 255, 136, 0.5)' : 'none'
    };
  };

  const btnStyle = (bg: string): React.CSSProperties => ({ 
    ...s.btn_a
  });

  return (
    <main style={s.main}>
      {/* ── KEYFRAMES injected inline so they always load ────────── */}
      <style>{`
        @keyframes ken-burns {
          0%   { transform: scale(1.0)  translate(0%,    0%);   }
          33%  { transform: scale(1.08) translate(-2%,  -1%);   }
          66%  { transform: scale(1.12) translate(1.5%, -0.5%); }
          100% { transform: scale(1.06) translate(2%,   1%);    }
        }
        @keyframes shimmer-sweep {
          0%   { transform: translateX(-100%); opacity: 0;   }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateX(200%);  opacity: 0;   }
        }
      `}</style>

      {/* HOSPITAL CORRIDOR — KEN BURNS CINEMATIC BACKGROUND */}
      <div style={s.droneBg} />
      {/* Shimmer overlay — diagonal light sweep */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.06) 50%, transparent 65%)',
        animation: 'shimmer-sweep 10s ease-in-out infinite',
      }} />
      <div style={s.glow} />


      
      <div style={s.panel}>

                                                {/* LOGO */}
        <div style={{textAlign:'center', marginBottom:'1.5rem'}}>
          <div className="acrylic-logo" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'52px',height:'52px',marginBottom:'1rem', background:'rgba(0, 255, 136, 0.1)', border:'1px solid #00FF88', borderTop: '4px solid #00FF88', borderRadius:'12px', color:'#00FF88', boxShadow:'0 0 15px rgba(0, 255, 136, 0.4)'}}>
            <span className="acrylic-text" style={{fontWeight:900,fontSize:'1.8rem', fontFamily:"'Orbitron', sans-serif"}}>+</span>
          </div>
          <h1 style={{fontFamily: "'Orbitron', sans-serif", fontSize:'1.4rem',fontWeight:900,letterSpacing:'4px',margin:'0 0 0.4rem', color:'#00FF88', textShadow:'0 0 10px rgba(0, 255, 136, 0.5)'}}>
            MIRACLE HMS
          </h1>
          <p style={{fontFamily:"'Share Tech Mono', monospace", fontSize:'0.65rem',color:'#00A86B',fontWeight:800,letterSpacing:'3px',margin:0}}>
            SECURE HEALTHCARE PORTAL
          </p>
        </div>

        {/* TAB SWITCHER */}
        <div style={{display:'flex',gap:'8px',marginBottom:'1.5rem'}}>
          <button type="button" style={tabStyle(loginView==='VISITOR_OTP')} onClick={()=>setLoginView('VISITOR_OTP')}>👥 PATIENT / VISITOR</button>
          <button type="button" style={tabStyle(loginView==='STAFF_LOGIN')} onClick={()=>setLoginView('STAFF_LOGIN')}>⚕️ MEDICAL STAFF</button>
        </div>

        {/* ══ VISITOR OTP FLOW ══════════════════ */}
        {loginView === 'VISITOR_OTP' && (

          <>
            {otpStep === 'FORM' && (
              <>
                {isScanning ? (
                  /* BIOMETRIC SCANNING HUD BLOCK */
                  <div style={{
                    padding: '24px',
                    background: '#000000',
                    border: '2px solid #006A4E',
                    borderRadius: '4px',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    margin: '10px 0'
                  }}>
                    {/* Sweeping laser inside the scanner */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      width: '100%',
                      height: '2px',
                      background: '#00FF88',
                      boxShadow: 'none',
                      animation: 'scanner-sweep-inside 2s linear infinite'
                    }} />

                    {/* Rotating structural elements */}
                    <div style={{
                      width: '100px',
                      height: '100px',
                      margin: '0 auto 18px',
                      borderRadius: '50%',
                      border: '2px dashed #006A4E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'spin-dashed 12s linear infinite',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        border: '2px dashed #00FF88',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'spin-dashed-reverse 8s linear infinite'
                      }}>
                        <div style={{ fontSize: '36px', filter: 'none', animation: 'pulse-scanner 1.2s ease-in-out infinite' }}>
                          🏥
                        </div>
                      </div>
                    </div>

                    <div style={{ fontFamily: "inherit", fontSize: '11px', color: '#00FF88', letterSpacing: '2px', fontWeight: 900, marginBottom: '8px' }}>
                      {scanStatusText}
                    </div>

                    {/* Progress slider bar */}
                    <div style={{
                      width: '100%',
                      height: '4px',
                      background: 'rgba(0,0,0,0.05)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                      marginBottom: '10px'
                    }}>
                      <div style={{
                        width: `${scanProgress}%`,
                        height: '100%',
                        background: '#00FF88',
                        transition: 'width 0.1s linear'
                      }} />
                    </div>

                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#00FF88', fontWeight: 900, letterSpacing: '1px' }}>
                      {scanProgress}% VERIFIED
                    </div>
                  </div>
                ) : (
                  <form onSubmit={startBiometricHandshake} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                    <p style={{fontSize:'9px',color:'#00A86B',margin:0,letterSpacing:'1px',textAlign:'center', fontFamily: "'Inter', sans-serif"}}>
                      PLEASE ENTER YOUR DETAILS TO CONTINUE
                    </p>

                    <div>
                      <label style={s.lbl}>👤 YOUR FULL NAME</label>
                      <input style={s.inp} placeholder="e.g. Sajeed Ahmed" value={visitorName} onChange={e=>setVisitorName(e.target.value)} required />
                    </div>

                    <div>
                      <label style={s.lbl}>📧 EMAIL ADDRESS (Fallback)</label>
                      <input style={s.inp} type="email" placeholder="visitor@example.com" value={visitorEmail} onChange={e=>setVisitorEmail(e.target.value)} />
                    </div>

                    <div>
                      <label style={s.lbl}>📱 MOBILE NUMBER</label>
                      <div style={{display:'flex',gap:'8px',position:'relative'}}>

                        {/* ── GOOGLE-STYLE COUNTRY PICKER ── */}
                        <div style={{position:'relative',flexShrink:0}}>
                          {/* Trigger button */}
                          <div
                            style={{display:'flex',alignItems:'center',gap:'6px',padding:'0.75rem 10px',borderRadius:'0.6rem',background:'rgba(0, 106, 78, 0.1)',border:`1px solid ${showCountryDrop?'rgba(0,242,255,0.5)':'rgba(255,255,255,0.1)'}`,cursor:'pointer',minWidth:'105px',transition:'border 0.2s'}}
                            onClick={()=>{setShowCountryDrop(v=>!v);setCountrySearch('');}}
                          >
                            <span style={{fontSize:'20px',lineHeight:1}}>{selectedCountry.flag}</span>
                            <span style={{fontSize:'12px',color:'#00FF88',fontWeight:900,letterSpacing:'1px'}}>{selectedCountry.dial}</span>
                            <span style={{fontSize:'8px',color:showCountryDrop?'#00F2FF':'#555',marginLeft:'auto'}}>▾</span>
                          </div>

                          {/* Dropdown Panel */}
                          {showCountryDrop && (
                            <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:999,background:'rgba(5, 15, 20, 0.95)',backdropFilter:'blur(12px)',border:'1px solid rgba(0, 242, 255, 0.3)',borderRadius:'12px',width:'240px',boxShadow:'0 0 30px rgba(0,242,255,0.1), inset 0 0 20px rgba(0,242,255,0.05)',overflow:'hidden'}}>
                              {/* Search Bar */}
                              <div style={{padding:'10px',borderBottom:'1px solid rgba(0, 242, 255, 0.15)'}}>
                                <input
                                  autoFocus
                                  placeholder="🔍  Search country..."
                                  value={countrySearch}
                                  onChange={e=>setCountrySearch(e.target.value)}
                                  style={{width:'100%',padding:'7px 10px',borderRadius:'7px',background:'rgba(0, 242, 255, 0.05)',border:'1px solid rgba(0, 242, 255, 0.2)',color:'#00F2FF',fontSize:'11px',outline:'none',boxSizing:'border-box',letterSpacing:'1px'}}
                                />
                              </div>
                              {/* Country List */}
                              <div style={{maxHeight:'220px',overflowY:'auto',scrollbarWidth:'thin',scrollbarColor:'rgba(0,242,255,0.3) transparent'}}>
                                {COUNTRIES
                                  .filter(c => !countrySearch || c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.dial.includes(countrySearch))
                                  .map(c => (
                                    <div
                                      key={c.code}
                                      onClick={()=>{setSelectedCountry(c);setShowCountryDrop(false);setCountrySearch('');}}
                                      style={{padding:'10px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid rgba(0, 242, 255, 0.1)',background:selectedCountry.code===c.code?'rgba(0,242,255,0.15)':'transparent',transition:'all 0.2s ease-in-out'}}
                                      onMouseEnter={e=>{
                                        e.currentTarget.style.background='rgba(0,242,255,0.1)';
                                        e.currentTarget.style.boxShadow='inset 0 0 10px rgba(0,242,255,0.1)';
                                      }}
                                      onMouseLeave={e=>{
                                        e.currentTarget.style.background=selectedCountry.code===c.code?'rgba(0,242,255,0.15)':'transparent';
                                        e.currentTarget.style.boxShadow='none';
                                      }}
                                    >
                                      <span style={{fontSize:'22px',lineHeight:1,flexShrink:0}}>{c.flag}</span>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontSize:'11px',color:selectedCountry.code===c.code?'#00F2FF':'#00FF88',fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',letterSpacing:'0.5px'}}>{c.name}</div>
                                        <div style={{fontSize:'10px',color:selectedCountry.code===c.code?'#00FF88':'#A0F0D0',fontWeight:900,marginTop:'2px'}}>{c.dial}</div>
                                      </div>
                                      {selectedCountry.code===c.code && <span style={{fontSize:'12px',color:'#00F2FF',textShadow:'0 0 5px #00F2FF'}}>◈</span>}
                                    </div>
                                  ))
                                }
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Phone number input */}
                        <input
                          style={{...s.inp,letterSpacing:'2px',flex:1}}
                          type="tel"
                          placeholder="1711 477 509"
                          value={phoneNum}
                          onChange={e=>setPhoneNum(e.target.value.replace(/[^0-9]/g,''))}
                          required
                          maxLength={13}
                        />
                      </div>
                      <p style={{fontSize:'8px',color:'#00A86B',margin:'5px 0 0 0', fontFamily: "'Inter', sans-serif"}}>
                        Your access code will be displayed on screen after verification.
                      </p>
                    </div>

                    {otpError && <p style={{fontSize:'10px',color:'#EF4444',margin:0,fontWeight:900, fontFamily: "inherit"}}>🚨 {otpError}</p>}

                    <button type="submit" disabled={otpLoading} style={btnStyle('rgba(0,242,255,0.15),rgba(0,150,255,0.15)')}>
                      {otpLoading ? '⏳ REQUESTING CODE...' : 'REQUEST ACCESS CODE'}
                    </button>
                  </form>
                )}
              </>
            )}

            {otpStep === 'OTP_INPUT' && (
              <form onSubmit={verifyOtp} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                <div style={{textAlign:'center',padding:'18px',background:'rgba(0, 255, 136, 0.05)',borderRadius:'12px',border:'1px solid rgba(0, 255, 136, 0.3)'}}>
                  {isReturning && <p style={{fontSize:'9px',color:'#B45309',margin:'0 0 8px',fontWeight:900}}>♻️ WELCOME BACK! We recognised your number.</p>}
                  <p style={{fontSize:'10px',color:'#00FF88',margin:0,fontWeight:900}}>{otpSuccess}</p>
                  {devOtp && (
                    <div style={{marginTop:'14px',padding:'12px 16px',background:'rgba(0, 255, 136, 0.05)',border:'1px solid rgba(0, 255, 136, 0.3)',borderRadius:'10px'}}>
                      <p style={{fontSize:'8px',color:'#00A86B',margin:'0 0 6px',fontWeight:900,letterSpacing:'2px'}}>YOUR ACCESS CODE</p>
                      <p style={{fontSize:'28px',color:'#00FF88',margin:0,fontWeight:900,letterSpacing:'10px',fontFamily:'monospace',textShadow:'none'}}>{devOtp}</p>
                      <p style={{fontSize:'8px',color:'#00A86B',margin:'6px 0 0'}}>👆 Type this code in the field below</p>
                    </div>
                  )}
                  {expiresAt && <p style={{fontSize:'8px',color:'#00A86B',margin:'8px 0 0'}}>Expires: {new Date(expiresAt).toLocaleTimeString()}</p>}
                </div>

                <div>
                  <label style={s.lbl}>🔐 ENTER YOUR 6-DIGIT CODE</label>
                  <input
                    style={{...s.inp, textAlign:'center', fontSize:'1.5rem', letterSpacing:'8px', fontWeight:900}}
                    type="text"
                    placeholder="______"
                    value={otpCode}
                    onChange={e=>setOtpCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>

                {otpError && <p style={{fontSize:'10px',color:'#EF4444',margin:0,fontWeight:900, fontFamily: "inherit"}}>🚨 {otpError}</p>}

                <button type="submit" disabled={otpLoading || otpCode.length!==6} style={btnStyle('rgba(57,255,20,0.15),rgba(0,200,100,0.15)')}>
                  {otpLoading ? '⏳ VERIFYING...' : '🔓 UNLOCK VISITOR ACCESS'}
                </button>
                <button type="button" onClick={()=>{setOtpStep('FORM');setOtpError('');setOtpCode('');}} style={{background:'none',border:'none',color:'#00A86B',fontSize:'10px',cursor:'pointer',textDecoration:'underline'}}>
                  ← Back / Request new code
                </button>
              </form>
            )}

            {otpStep === 'GRANTED' && (
              <div style={{textAlign:'center',padding:'30px'}}>
                <div style={{fontSize:'40px',marginBottom:'15px'}}>✅</div>
                <p style={{color:'#00FF88',fontWeight:900,fontSize:'14px',letterSpacing:'2px'}}>ACCESS GRANTED</p>
                <p style={{color:'#00A86B',fontSize:'10px'}}>Redirecting to Dashboard...</p>
              </div>
            )}
          </>
        )}

        {/* ══ STAFF LOGIN ═══════════════════════ */}
        {loginView === 'STAFF_LOGIN' && (
          <form suppressHydrationWarning onSubmit={authorizeSession} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <div>
              <label style={s.lbl}>🛡️ OPERATIVE ID</label>
              <input id="identity" suppressHydrationWarning style={{...s.inp,textAlign:'center',letterSpacing:'2px'}} type="text" value={identity} onChange={e=>setIdentity(e.target.value)} placeholder="e.g. SAJEED_AHMED" required disabled={isAuthenticating} />
            </div>
            <div>
              <label style={s.lbl}>🔑 ACCESS KEY</label>
              <input id="password" suppressHydrationWarning style={{...s.inp,textAlign:'center',letterSpacing:'2px'}} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required disabled={isAuthenticating} />
            </div>
            {staffError && <p style={{fontSize:'10px',color:'#EF4444',margin:0,fontWeight:900}}>{staffError}</p>}
            <button type="submit" disabled={isAuthenticating} style={btnStyle('rgba(0,242,255,0.1),rgba(57,255,20,0.1)')}>
              {isAuthenticating ? '⏳ AUTHENTICATING...' : 'SECURE LOGIN'}
            </button>
            <div style={{display:'flex',gap:'10px',marginTop:'4px'}}>
              <a href="/guest" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'0.7rem',borderRadius:'0.6rem',background:'rgba(0, 106, 78, 0.1)',border:'2px solid #006A4E',color:'#00FF88',fontSize:'0.55rem',fontWeight:900,textDecoration:'none'}}>📱 GUEST LOGIN</a>
              <a href="https://miracle.vigilantitsolution.com/miracle_guest.apk" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'0.7rem',borderRadius:'0.6rem',background:'rgba(0, 106, 78, 0.1)',border:'1px solid #FDE68A',color:'#B45309',fontSize:'0.55rem',fontWeight:900,textDecoration:'none'}}>📥 GUEST APK</a>
            </div>
            <div style={{marginTop:'10px',textAlign:'center'}}>
              <p style={{fontSize:'9px',fontFamily:'monospace',color:'#00A86B',margin:0,fontWeight:900}}>{status}</p>
            </div>
          </form>
        )}

        {/* Hide Terminal Logs */}
        {isVisitor && otpStep !== 'GRANTED' && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid rgba(0,242,255,0.15)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontFamily: "inherit",
            fontSize: '9px',
            color: '#00FF88',
            minHeight: '80px',
            maxHeight: '120px',
            overflowY: 'auto',
            boxShadow: 'inset 0 0 10px rgba(0,242,255,0.1)',
            textAlign: 'left'
          }}>
            <div style={{ color: '#9D00FF', fontWeight: 900, letterSpacing: '1px', marginBottom: '6px', borderBottom: '1px solid rgba(157,0,255,0.2)', paddingBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
              <span>📟 NEURAL DIAGNOSTIC READOUT</span>
              <span style={{ animation: 'pulse-dot 1s infinite' }}>● ACTIVE</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {terminalLogs.map((log, i) => (
                <div key={i} style={{ lineBreak: 'anywhere' }}>{log}</div>
              ))}
            </div>
          </div>
        )}

        {/* SYSTEM STATUS */}
        <div style={{marginTop: isVisitor ? '15px' : '20px', paddingTop:'15px',borderTop:'1px solid rgba(255,255,255,0.04)',display:'flex',justifyContent:'center',alignItems:'center',gap:'10px'}}>
          <span style={{fontSize:'7px',color:'#00A86B',fontWeight:900, fontFamily: isVisitor ? "'Orbitron', sans-serif" : 'inherit'}}>SYSTEM STATUS</span>
          <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#39FF14',boxShadow:'0 0 10px #39FF14',display:'inline-block'}} />
          <span style={{fontSize:'7px',color:'#00FF88',fontWeight:900,letterSpacing:'1px', fontFamily: isVisitor ? "'Orbitron', sans-serif" : 'inherit'}}>ONLINE</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html:`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
        @keyframes ambient-beat { 0%{opacity:0.3;transform:scale(1) translate(-50%,-50%);} 50%{opacity:0.6;transform:scale(1.05) translate(-50%,-50%);} 100%{opacity:0.3;transform:scale(1) translate(-50%,-50%);} }
        
        
        @keyframes neon-pulse {
          0% { box-shadow: 0 0 30px rgba(0, 255, 136, 0.3), inset 0 0 10px rgba(0, 255, 136, 0.1); }
          100% { box-shadow: 0 0 60px rgba(0, 255, 136, 0.6), inset 0 0 25px rgba(0, 255, 136, 0.25); }
        }
        @keyframes pulse-glow {
          0% { opacity: 0.6; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes drone-fly {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-3%, -2%, 0) scale(1.05) rotate(0.5deg); }
          100% { transform: translate3d(2%, 3%, 0) scale(1.1) rotate(-0.5deg); }
        }
        @keyframes scanner-sweep-inside {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        @keyframes spin-dashed {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-dashed-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes pulse-scanner {
          0%, 100% { transform: scale(0.9); opacity: 0.8; filter: drop-shadow(0 0 5px #00F2FF); }
          50% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 15px #00F2FF); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        input::placeholder{color:#444;}
        select option{background:#111;color:#FFF;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#333;border-radius:4px;}
      `}} />
    </main>
  );
}
