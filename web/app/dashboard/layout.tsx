/**
 * web/app/dashboard/layout.tsx
 * SOVEREIGN INDEX PROTOCOL:
 * 1. SYNC KERNEL & CONTEXT (Lines 15-35)
 * 2. ZONE REGISTRY & CITIES (Lines 40-60)
 * 3. AUTH & REAPER ENGINE (Lines 95-150)
 * 4. WEBSOCKET GRID-SYNC (Lines 155-225)
 * 5. SIDEBAR ARCHITECTURE (Lines 275-360)
 * 6. MOBILE DOCK & OVERLAY (Lines 440-500)
 */
'use client';
// 🛡️ HEARTBEAT FORCE-SYNC: v1.7.6
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MASTER_ZONES, ZONE_PERMISSIONS } from '../kernel';
import { useGlobalSync } from '../context/GlobalSyncContext';
import { RadioProvider } from '../context/RadioContext';
import GlobalRadioWidget from '../components/GlobalRadioWidget';
import VisitorAIAgent from '../components/VisitorAIAgent'; // LEGACY: kept for reference, not rendered
import './desktop-shell.css';
import DesktopLayout from './DesktopLayout';
import FloatingDemoTimer from '../components/FloatingDemoTimer';
import ScreenCaptureBot from '../components/ScreenCaptureBot';

// ==========================================
// 1. KERNEL-LINKED ZONE REGISTRY
// ==========================================
// 🛡️ Data is now pulled from miracle_kernel.json via kernel.ts
const masterZones = MASTER_ZONES;

// ==========================================
// 2. THE SOVEREIGN GHOSTING ENGINE (SIDEBAR)
// ==========================================
const WORLD_CITIES = [
  { name: 'NEW YORK',  tz: 'America/New_York',   color: '#00F2FF' },
  { name: 'LONDON',   tz: 'Europe/London',       color: '#39FF14' },
  { name: 'DUBAI',    tz: 'Asia/Dubai',           color: '#D4AF37' },
  { name: 'DHAKA',    tz: 'Asia/Dhaka',           color: '#FF3131' },
  { name: 'SINGAPORE',tz: 'Asia/Singapore',       color: '#9D00FF' },
  { name: 'TOKYO',    tz: 'Asia/Tokyo',           color: '#FF69B4' },
  { name: 'SYDNEY',   tz: 'Australia/Sydney',     color: '#00FF88' },
  { name: 'MUMBAI',   tz: 'Asia/Kolkata',         color: '#FF8C00' },
  { name: 'PARIS',    tz: 'Europe/Paris',         color: '#C084FC' },
  { name: 'BEIJING',  tz: 'Asia/Shanghai',        color: '#F87171' },
];

const FX_PAIRS = ['EUR','GBP','JPY','AED','SGD','BDT','AUD','INR','CNY','CAD'];
const FX_COLORS: Record<string,string> = {
  EUR:'#C084FC', GBP:'#39FF14', JPY:'#FF69B4', AED:'#D4AF37',
  SGD:'#9D00FF', BDT:'#FF3131', AUD:'#00FF88', INR:'#FF8C00',
  CNY:'#F87171', CAD:'#00F2FF',
};

const MARQUEE_CITIES = [...WORLD_CITIES, ...WORLD_CITIES];

export default function MasterDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const [liveTime, setLiveTime] = useState<Date | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeUser, setActiveUser] = useState<string>('');
  const [activeRole, setActiveRole] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fxRates, setFxRates] = useState<Record<string,{rate:number;prev:number}>>({});
  const [allowedZones, setAllowedZones] = useState<string[] | null>(null);

  const [sidebarMode, setSidebarMode] = useState<'classic' | 'kinetic'>('classic');
  const sidebarRef = React.useRef<HTMLElement>(null);
  const sidebarModeRef = React.useRef(sidebarMode);

  const [layoutMode, setLayoutMode] = useState<'classic' | 'desktop'>('classic');

  useEffect(() => {
    sidebarModeRef.current = sidebarMode;
  }, [sidebarMode]);

  useEffect(() => {
    const savedMode = localStorage.getItem('miracle_layout_mode') as 'classic' | 'desktop';
    if (savedMode === 'desktop') {
      setLayoutMode('desktop');
    }
  }, []);

  const handleKineticMove = (e: React.MouseEvent<HTMLElement>) => {
    if (sidebarModeRef.current !== 'kinetic') return;
    if (!sidebarRef.current) return;
    
    const nav = sidebarRef.current.querySelector('.sidebar-nav-container');
    if (!nav) return;
    
    const navRect = nav.getBoundingClientRect();
    const items = Array.from(nav.querySelectorAll('.kinetic-dock-item'));
    
    // Pass 1: Calculate scales and extra visual height
    const itemData = items.map((item: any) => {
      // offsetTop requires nav to be position: relative to be perfectly accurate
      const layoutCenterY = navRect.top + (item.offsetTop - nav.scrollTop) + (item.offsetHeight / 2);
      const dist = Math.abs(e.clientY - layoutCenterY);
      
      let kScale = 1;
      let intensity = 0;
      
      if (dist < 150) {
        intensity = Math.pow(Math.cos((dist / 150) * (Math.PI / 2)), 2.5);
        kScale = 1 + 0.45 * intensity; // Scale up to 1.45x
      }
      
      // Extra height this item occupies visually
      const extraHeight = item.offsetHeight * (kScale - 1);
      
      return { item, kScale, intensity, extraHeight };
    });
    
    // Pass 2: Apply scale and margin
    itemData.forEach((data) => {
      const kRadius = 8 + (16 * data.intensity); // Visibly more roundy
      
      // Use margin to let Flexbox push siblings naturally, avoiding overlapping math issues.
      data.item.style.transform = `scale(${data.kScale})`;
      data.item.style.margin = `${data.extraHeight / 2}px 0`;
      data.item.style.borderRadius = `${kRadius}px`;
      data.item.style.zIndex = data.kScale > 1.1 ? '10' : '1';
    });
  };

  const handleKineticLeave = () => {
    setIsHovered(false);
    if (!sidebarRef.current) return;
    const items = sidebarRef.current.querySelectorAll('.kinetic-dock-item');
    items.forEach((item: any) => {
      item.style.transform = '';
      item.style.margin = '';
      item.style.borderRadius = '';
      item.style.zIndex = '';
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('miracle_sidebar_mode');
    if (saved === 'kinetic') setSidebarMode('kinetic');
  }, []);

  const toggleSidebarMode = () => {
    const newMode = sidebarMode === 'classic' ? 'kinetic' : 'classic';
    setSidebarMode(newMode);
    localStorage.setItem('miracle_sidebar_mode', newMode);
  };

  // 🛡️ THE FIX: THIS LINE PREVENTS THE CRASH
  const isActive = (path: string) => pathname === path;

  // 🛡️ THE GLOBAL SYNC STATE (THE HEARTBEAT & WEBSOCKET PAYLOAD)
  const [syncPulse, setSyncPulse] = useState(Date.now());
  const [globalGridState, setGlobalGridState] = useState<any[]>([]);
  const [kernel, setKernel] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  // 🌍 SOVEREIGN GLOBAL SYNC (Weather, FX, Time) from Backend Brain
  const serverTimeOffsetRef = React.useRef<number>(0);

  const fetchGlobalSync = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/global/sync`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.status === 'SUCCESS' && json.data) {
        // 1. Sync FX Rates
        const fx = json.data.fxRates || {};
        setFxRates(prev => {
          const next: Record<string,{rate:number;prev:number}> = {};
          FX_PAIRS.forEach(p => {
            const currentRate = fx[p]?.rate || 0;
            next[p] = { rate: currentRate, prev: prev[p]?.rate || currentRate };
          });
          return next;
        });

        // 2. Sync Global Time Offset
        if (json.data.server_time) {
           const serverDate = new Date(json.data.server_time);
           const localDate = new Date();
           serverTimeOffsetRef.current = serverDate.getTime() - localDate.getTime();
        }
      }
    } catch (err) {
      console.error("Failed to sync global data:", err);
    }
  }, [API_URL]);

  const fetchKernel = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/settings/kernel`);
      if (res.ok) {
        const data = await res.json();
        setKernel(data);
        console.log("🔱 KERNEL SYNCED:", data.version);
      }
    } catch (err) {
      console.error("Failed to fetch kernel:", err);
    }
  }, [API_URL]);

  // This function can be called by ANY child (like Check-In) to force all others to update.
  // triggerGlobalSync removed, now in provider

  // 🛡️ 1. AUTH, IGNITION & REAPER ENGINE
  useEffect(() => {
    const token = localStorage.getItem('miracle_token');
    const user = localStorage.getItem('miracle_user');
    const role = localStorage.getItem('vigilant_role');

    if (!token || !user) {
      // 🛡️ UI-LEVEL BOUNCER: If no token exists in localStorage, kick out immediately
      // 🚨 CRITICAL FIX: Destroy the middleware cookie here so we don't get stuck in an infinite redirect loop
      document.cookie = 'miracle_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.href = '/';
      return;
    } else {
      setIsAuthorized(true);
      setActiveUser(user);
      setActiveRole(role || 'OPERATIVE');

      // Load allowed zones for visitor tour
      const zonesStr = localStorage.getItem('miracle_visitor_allowed_zones');
      if (zonesStr) {
        try {
          const parsed = JSON.parse(zonesStr);
          setAllowedZones(parsed);

          // Route Guard for visitors trying to access uninvited zones directly via URL
          if (role === 'VISITOR' && pathname.startsWith('/dashboard')) {
            const currentZone = (kernel?.zones || MASTER_ZONES).find((z: any) => z.path === pathname);
            if (currentZone && currentZone.id !== 'Z-07' && !parsed.includes(currentZone.id)) {
              console.warn(`🚨 VISITOR ROUTE BLOCK: Direct navigation to ${pathname} rejected.`);
              router.replace('/dashboard');
            }
          }
        } catch {
          setAllowedZones(null);
        }
      } else {
        setAllowedZones(null);
      }
    }

    // 🔱 SOVEREIGN ROLE REFRESH: Re-read role from localStorage on window focus.
    // This means when the HR Registry sync reloads the page or the user returns
    // to the tab, the sidebar immediately reflects newly assigned zones.
    const onFocus = () => {
      const freshRole = localStorage.getItem('vigilant_role');
      if (freshRole) setActiveRole(freshRole);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [router, pathname, kernel]);

  // 🛡️ LIVE TIME & SOVEREIGN WS LISTENER
  useEffect(() => {
    setLiveTime(new Date(Date.now() + serverTimeOffsetRef.current));
    const timer = setInterval(() => setLiveTime(new Date(Date.now() + serverTimeOffsetRef.current)), 1000);

    // 🔱 SOVEREIGN WEBSOCKET — connects to the FastAPI backend, NOT the Next.js host
    // window.location.host = miracle.vigilantitsolution.com (Nginx, no WS)
    // API_URL = https://api.vigilantitsolution.com/api  →  wss://api.vigilantitsolution.com
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 2000; // Start at 2s, max 30s
    let destroyed = false;

    const getWsUrl = () => {
      try {
        // API_URL is like https://api.vigilantitsolution.com/api or /api
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        if (apiUrl.startsWith('http')) {
          const parsed = new URL(apiUrl);
          const wsProto = parsed.protocol === 'https:' ? 'wss' : 'ws';
          return `${wsProto}://${parsed.host}/ws/grid-sync`;
        }
        // Localhost dev fallback: connect directly to port 8095 (FastAPI backend)
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          return `ws://${window.location.hostname}:8095/ws/grid-sync`;
        }
        // Fallback: same host but use ws
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        return `${proto}://${window.location.host}/ws/grid-sync`;
      } catch { return null; }
    };

    const connect = () => {
      if (destroyed) return;
      const wsUrl = getWsUrl();
      if (!wsUrl) return;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          reconnectDelay = 2000; // Reset on success
          console.log('⚡ KERNEL GRID-SYNC: WebSocket connected.');
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'GRID_UPDATE' || msg.event === 'TICKET_UPDATE') {
              if (msg.data?.grid_state) setGlobalGridState(msg.data.grid_state);
              setSyncPulse(Date.now());
            }
            if (msg.event === 'KERNEL_UPDATE') fetchKernel();
            // SOVEREIGN WATCHDOG: Bridge to MiracleBot via custom window event
            if (msg.event === 'WATCHDOG_ALERT') {
              window.dispatchEvent(new CustomEvent('miracle_watchdog_alert', { detail: msg.data }));
            }
          } catch {}
        };

        ws.onclose = () => {
          if (destroyed) return;
          reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
          reconnectTimeout = setTimeout(connect, reconnectDelay);
        };

        ws.onerror = () => {
          // onerror is always followed by onclose, reconnect happens there
          ws?.close();
        };
      } catch {}
    };

    connect();
    fetchKernel();

    return () => {
      destroyed = true;
      clearInterval(timer);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🌍 Global Sync polling: initial + every 1 hour (since backend caches for 1 hour anyway)
  // We can poll every 5 min if we want, backend is extremely fast now.
  useEffect(() => {
    fetchGlobalSync();
    const gs = setInterval(fetchGlobalSync, 5 * 60 * 1000);
    return () => clearInterval(gs);
  }, [fetchGlobalSync]);

  const handleLogout = () => {
    localStorage.removeItem('miracle_token');
    localStorage.removeItem('vigilant_role');
    localStorage.removeItem('miracle_user');
    document.cookie = 'miracle_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = '/'; 
  };

  const formatTZ = (date: Date, tz: string) => {
    return date.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (!isAuthorized) {
    return (
      <div style={{ height: '100vh', width: '100vw', background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#00F2FF', fontFamily: 'Cinzel' }}>
        <h2 className="auth-pulse">🛡️ VERIFYING KERNEL CLEARANCE...</h2>
      </div>
    );
  }

  // 🛡️ WRAPPING REMOVED - NOW AT ROOT
  return (
    <RadioProvider>
      {layoutMode === 'classic' ? (
        <div style={{ display: 'flex', flexDirection: 'row', height: '100dvh', width: '100vw', background: 'transparent', color: '#FFF' }} className="miracle-shell">

        {/* 🚀 THE KINETIC SLIM DOCK (GLOSS STYLE) */}
        <aside 
          ref={sidebarRef as React.RefObject<HTMLDivElement>}
          className="miracle-sidebar"
          onMouseMove={handleKineticMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleKineticLeave}
          style={{ width: isHovered ? '280px' : '80px', transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* 🛡️ ACRYLIC LED LOGO SECTION */}
          <div className="sidebar-header-section" style={{ justifyContent: isHovered ? 'flex-start' : 'center', padding: isHovered ? '0 1.5rem' : '0' }}>
            <div className="acrylic-logo" style={{ 
              width: isHovered ? '3.2rem' : '2.5rem', 
              height: isHovered ? '3.2rem' : '2.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 900, 
              fontSize: isHovered ? '1.8rem' : '1.4rem', 
              fontFamily: 'Cinzel', 
              flexShrink: 0,
              transition: 'all 0.3s ease'
            }}>
              <span className="acrylic-text">M</span>
            </div>
            {isHovered && <div className="sidebar-header-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
              <h1 style={{ fontFamily: 'Cinzel', fontSize: '15px', margin: 0, letterSpacing: '2px', color: '#FFF', textShadow: '0 0 12px rgba(255,255,255,0.2)', fontWeight: 900, whiteSpace: 'nowrap' }}>MIRACLE HMS</h1>
              <div style={{ color: '#10b981', fontSize: '9px', fontWeight: 900, letterSpacing: '1.5px', textShadow: '0 0 8px rgba(16,185,129,0.6)' }}>{kernel?.hotel_name || 'MIRACLE GENERAL HOSPITAL'}</div>
            </div>}
          </div>

          <nav style={{ flex: 1, position: 'relative', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }} className="hide-scroll sidebar-nav-container">
            {(kernel?.zones || MASTER_ZONES).filter((zone: any) => {
              if (zone.id === 'Z-LOGIN') return false;
              if (zone.id === 'DEFAULT') return false;
              if (!zone.path || zone.path === '*' || zone.path === null) return false;
              const permissions = kernel?.zones?.find((z: any) => z.id === zone.id)?.permissions || ZONE_PERMISSIONS[zone.id] || [];
              if (permissions.includes('ANY')) return true;
              if (permissions.includes('INTERNAL_AI_ONLY')) return false;
              const userRoles = activeRole.split(',').map(r => r.trim());
              const roleAllowed = userRoles.some(r => permissions.includes(r));
              
              if (roleAllowed && activeRole === 'VISITOR' && allowedZones) {
                return zone.id === 'Z-07' || allowedZones.includes(zone.id);
              }
              return roleAllowed;
            }).map((zone: any, idx: number) => {
              const active = isActive(zone.path);
              
              return (
                <Link
                  key={zone.id}
                  href={zone.path}
                  className={`sidebar-item ${active ? 'active' : ''} ${sidebarMode === 'kinetic' ? 'kinetic-dock-item' : ''}`}
                  style={{ 
                     justifyContent: isHovered ? 'flex-start' : 'center', 
                     padding: isHovered ? '0 10px' : '0 6px',
                  }}
                  onClick={(e) => {
                    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
                      const lockedZones = ['Z-09', 'Z-11', 'Z-12', 'Z-18', 'Z-19', 'Z-21'];
                      if (lockedZones.includes(zone.id)) {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('miracle_bot_demo_block', { detail: { zoneName: zone.name } }));
                      }
                    }
                  }}
                >
                  {/* COLLAPSED: icon stacked above burgundy zone ID */}
                  {!isHovered && (
                    <div className="sidebar-icon-stack">
                      <div className="sidebar-icon-box">{zone.icon}</div>
                      <span className="sidebar-zone-badge-collapsed">{zone.id}</span>
                    </div>
                  )}
                  {/* EXPANDED: icon + label + zone badge */}
                  {isHovered && (
                    <>
                      <div className="sidebar-icon-box">{zone.icon}</div>
                      <div className="nav-label-container">
                        <div className="sidebar-label-main">{zone.name.toUpperCase()}</div>
                        <span className="sidebar-zone-badge">{zone.id}</span>
                      </div>
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-bottom-anchor">

            {/* 🍎 KINETIC / CLASSIC TOGGLE — compact pill switch */}
            <div style={{ padding: '0 10px', marginBottom: '8px' }}>
              {isHovered ? (
                /* Expanded: two-pill toggle */
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '3px', border: '1px solid #1e1e1e' }}>
                  <button
                    onClick={() => sidebarMode !== 'kinetic' && toggleSidebarMode()}
                    style={{
                      flex: 1, padding: '5px 4px', borderRadius: '6px', fontSize: '9px', fontWeight: 900,
                      letterSpacing: '0.5px', cursor: 'pointer', transition: 'all 0.2s',
                      background: sidebarMode === 'kinetic' ? 'rgba(0,242,255,0.12)' : 'transparent',
                      border: sidebarMode === 'kinetic' ? '1px solid rgba(0,242,255,0.4)' : '1px solid transparent',
                      color: sidebarMode === 'kinetic' ? '#00F2FF' : '#444',
                    }}
                  >🍎 KINETIC</button>
                  <button
                    onClick={() => sidebarMode !== 'classic' && toggleSidebarMode()}
                    style={{
                      flex: 1, padding: '5px 4px', borderRadius: '6px', fontSize: '9px', fontWeight: 900,
                      letterSpacing: '0.5px', cursor: 'pointer', transition: 'all 0.2s',
                      background: sidebarMode === 'classic' ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: sidebarMode === 'classic' ? '1px solid #444' : '1px solid transparent',
                      color: sidebarMode === 'classic' ? '#CCC' : '#444',
                    }}
                  >⬛ CLASSIC</button>
                </div>
              ) : (
                /* Collapsed: small icon */
                <button
                  onClick={toggleSidebarMode}
                  title={sidebarMode === 'kinetic' ? 'Switch to Classic' : 'Switch to Kinetic'}
                  style={{
                    width: '100%', padding: '6px', borderRadius: '8px', fontSize: '14px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1e1e',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >{sidebarMode === 'kinetic' ? '🍎' : '⬛'}</button>
              )}
            </div>

            {/* 💻 SOVEREIGN DESKTOP MODE TOGGLE */}
            <div style={{ padding: '0 10px', marginBottom: '8px' }}>
              {isHovered ? (
                <button
                  onClick={() => {
                    setLayoutMode('desktop');
                    localStorage.setItem('miracle_layout_mode', 'desktop');
                  }}
                  className="egress-cyan-hover"
                  style={{
                    width: '100%', padding: '6px 10px', borderRadius: '8px', fontSize: '9px', fontWeight: 900,
                    letterSpacing: '1px', cursor: 'pointer', background: 'rgba(0,242,255,0.05)',
                    border: '1px solid rgba(0,242,255,0.2)', color: '#00F2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                  }}
                >
                  💻 DESKTOP SHELL
                </button>
              ) : (
                <button
                  onClick={() => {
                    setLayoutMode('desktop');
                    localStorage.setItem('miracle_layout_mode', 'desktop');
                  }}
                  title="Switch to Desktop Shell"
                  style={{
                    width: '100%', padding: '6px', borderRadius: '8px', fontSize: '14px',
                    background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  💻
                </button>
              )}
            </div>

            {/* CURRENCY: Managed from Z-21 Sovereign Currency Engine only */}

            {/* 🛡️ COMPACT EGRESS */}
            <div className="sidebar-egress-section" style={{ alignItems: isHovered ? 'stretch' : 'center' }}>
              <button onClick={handleLogout} className="egress-cyan-hover egress-btn-compact" style={{ justifyContent: isHovered ? 'flex-start' : 'center', padding: isHovered ? '8px 12px' : '8px' }}>
                  <span style={{ fontSize: '14px' }}>🔒</span> {isHovered && <span>DISCONNECT</span>}
              </button>
            </div>

            {/* OPERATIVE BADGE */}
            <div className="sidebar-footer-section" style={{ justifyContent: isHovered ? 'flex-start' : 'center' }}>
              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '1.5px solid #00F2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#00F2FF', fontSize: '10px', boxShadow: '0 0 8px rgba(0,242,255,0.2)', flexShrink: 0 }}>{activeUser.slice(0,2)}</div>
              {isHovered && <div style={{ marginLeft: '1rem' }}>
                <div style={{ fontSize: '11px', fontWeight: 900, color: '#FFF' }}>{activeUser}</div>
                <div style={{ fontSize: '8px', color: '#00F2FF', fontWeight: 700, letterSpacing: '1px' }}>{activeRole} CLEARANCE</div>
              </div>}
            </div>
          </div>
        </aside>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'transparent', minHeight: 0, overflow: 'hidden', minWidth: 0, maxWidth: '100%' }} className={`miracle-main${activeRole === 'VISITOR' ? ' visitor-session' : ''}`}>

          {/* 📱 MOBILE TOP BAR — inside main column, hidden on desktop via CSS */}
          <div className="miracle-mobile-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="acrylic-logo" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '16px', fontFamily: 'Cinzel', borderRadius: '8px' }}>
                <span className="acrylic-text">M</span>
              </div>
              <span style={{ fontFamily: 'Cinzel', fontSize: '14px', color: '#D4AF37', letterSpacing: '2px' }}>MIRACLE HMS</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 8px #00FF88' }} />
              <span style={{ fontSize: '10px', color: '#888', fontWeight: 700 }}>{activeUser}</span>
            </div>
          </div>

          {/* 🌐 THE GLOBAL MARQUEE (NEON TIME PULSE) */}
          <div style={{ height: '2.4rem', background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(15px)', borderBottom: '1px solid rgba(0, 242, 255, 0.2)', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 100 }}>
              {/* 👁️ VISITOR MODE BADGE */}
              {activeRole === 'VISITOR' && (
                <div style={{
                  position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.5)',
                  borderRadius: '20px', padding: '4px 14px', color: '#D4AF37',
                  fontSize: '9px', fontWeight: 900, letterSpacing: '2px', zIndex: 200,
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D4AF37', display: 'inline-block', boxShadow: '0 0 6px #D4AF37' }} />
                  VISITOR SESSION
                </div>
              )}
              
              {/* 🔱 THE SOVEREIGN DHAKA PULSE (FIXED BRIDE) */}
              <div style={{ 
                height: '100%', 
                background: 'linear-gradient(90deg, #FF3131 0%, rgba(255,49,49,0.2) 100%)', 
                padding: '0 30px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '15px',
                borderRight: '2px solid #FF3131',
                boxShadow: '10px 0 30px rgba(255,49,49,0.3)',
                zIndex: 101,
                minWidth: '11.25rem'
              }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: '#000', letterSpacing: '2px' }}>DHAKA PULSE</span>
                <span style={{ fontSize: '1rem', 
                  fontFamily: 'monospace', 
                  fontWeight: 900, 
                  color: '#FFF', 
                  textShadow: '0 0 10px rgba(255,255,255,0.8)' 
                }}>
                  {liveTime ? formatTZ(liveTime, 'Asia/Dhaka') : '00:00'}
                </span>
                <div className="signoff-dot" style={{ background: '#FFF', boxShadow: '0 0 15px #FFF' }} />
              </div>

              <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 100 }}>
                <div className="marquee" style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                  {/* Render the full content block TWICE for seamless looping */}
                  {[0, 1].map((blockIdx) => (
                    <div key={`block-${blockIdx}`} style={{ display: 'flex', alignItems: 'center' }}>
                      {/* ─── CITY CLOCKS ─── */}
                      {WORLD_CITIES.map((city, idx) => (
                        <div key={`c-${blockIdx}-${idx}`} style={{ display: 'flex', gap: '8px', padding: '0 32px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 900, whiteSpace: 'nowrap', alignItems: 'center' }}>
                          <span style={{ color: city.color, opacity: 0.8, fontSize: '10px', letterSpacing: '1px' }}>{city.name}</span>
                          <span className="time-pulse" style={{ color: '#FFF', textShadow: `0 0 10px ${city.color}` }}>
                            {liveTime ? formatTZ(liveTime, city.tz) : '--:--'}
                          </span>
                        </div>
                      ))}
                      {/* ─── SEPARATOR ─── */}
                      <div style={{ padding: '0 20px', color: 'rgba(255,255,255,0.15)', fontSize: '18px', flexShrink: 0 }}>┃</div>
                      {/* ─── FX RATES (USD base) ─── */}
                      {FX_PAIRS.map((pair, idx) => {
                        const fx = fxRates[pair];
                        const up = fx ? fx.rate >= fx.prev : true;
                        const color = FX_COLORS[pair] || '#FFF';
                        return (
                          <div key={`fx-${blockIdx}-${idx}`} style={{ display: 'flex', gap: '6px', padding: '0 28px', fontFamily: 'monospace', fontSize: '11px', fontWeight: 900, whiteSpace: 'nowrap', alignItems: 'center' }}>
                            <span style={{ color, opacity: 0.85, letterSpacing: '0.5px', fontSize: '9px' }}>USD/{pair}</span>
                            <span style={{ color: '#FFF', textShadow: `0 0 8px ${color}` }}>
                              {fx ? fx.rate.toFixed(pair === 'JPY' || pair === 'BDT' || pair === 'INR' ? 2 : 4) : '----'}
                            </span>
                            <span style={{ color: fx ? (up ? '#00FF88' : '#FF3131') : '#555', fontSize: '10px' }}>
                              {fx ? (up ? '▲' : '▼') : '·'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
          </div>
          
          {/* 🛡️ ALL DASHBOARD PAGES (CHILDREN) NOW RECEIVE THE SYNC PULSE */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 env(safe-area-inset-bottom, 0px) 0' }} className="miracle-content-scroll miracle-main-content">{children}</div>
        </main>

        {/* 📻 SOVEREIGN FM RADIO — GLOBAL SINGLETON (all panels) */}
        <GlobalRadioWidget />

        {/* 🤖 MIRACLE AI: Global MiracleBot handles all visitor AI interactions via MiracleBotGuestGuard in root layout */}
        {/* VisitorAIAgent (Premium Concierge) has been RETIRED — it caused duplicate bot rendering for VISITOR role */}



        {/* ===================================================
            📱 MOBILE BOTTOM DOCK — Visible ONLY on ≤767px via CSS
            Shows 5 pinned zones + hamburger for full menu
            =================================================== */}
        <nav className="miracle-mobile-dock">
          {/* Pin the 5 most important zones */}
          {(kernel?.zones || MASTER_ZONES)
            .filter((z: any) => !['Z-LOGIN'].includes(z.id))
            .slice(0, 5)
            .map((zone: any) => {
              const active = isActive(zone.path);
              return (
                <Link key={zone.id} href={zone.path} className={`miracle-dock-item ${active ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}>
                  <span className="dock-icon">{zone.icon}</span>
                  <span className="dock-label">{zone.name.split(' ')[0]}</span>
                </Link>
              );
            })}
          {/* Hamburger — opens full menu */}
          <button className="miracle-dock-menu-btn" onClick={() => setMobileMenuOpen(o => !o)} aria-label="All Zones">
            <span /><span /><span />
            <span style={{ fontSize: '8px', color: '#555', fontWeight: 900, marginTop: '2px', letterSpacing: '0.5px' }}>MORE</span>
          </button>
        </nav>

        {/* ===================================================
            📱 MOBILE FULL MENU OVERLAY
            =================================================== */}
        {mobileMenuOpen && (
          <div className="miracle-mobile-menu">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <span style={{ fontFamily: 'Cinzel', color: '#D4AF37', fontSize: '16px', letterSpacing: '2px' }}>ALL ZONES</span>
              <button onClick={() => setMobileMenuOpen(false)}
                style={{ background: 'none', border: '1px solid #333', color: '#FFF', borderRadius: '12px', padding: '8px 16px', fontSize: '11px', fontWeight: 900, cursor: 'pointer' }}>CLOSE ✕</button>
            </div>
            {(kernel?.zones || MASTER_ZONES)
              .filter((zone: any) => {
                if (zone.id === 'Z-LOGIN') return false;
                const permissions = zone.permissions || ZONE_PERMISSIONS[zone.id] || [];
                if (permissions.includes('ANY')) return true;
                const userRoles = activeRole.split(',').map((r: string) => r.trim());
                const roleAllowed = userRoles.some((r: string) => permissions.includes(r));
                
                if (roleAllowed && activeRole === 'VISITOR' && allowedZones) {
                  return zone.id === 'Z-07' || allowedZones.includes(zone.id);
                }
                return roleAllowed;
              })
              .map((zone: any) => (
                <Link key={zone.id} href={zone.path} className="miracle-mobile-menu-item"
                  onClick={() => setMobileMenuOpen(false)}>
                  <span className="menu-icon">{zone.icon}</span>
                  <div>
                    <div className="menu-text">{zone.name.toUpperCase()}</div>
                    <div style={{ fontSize: '9px', color: '#444', fontWeight: 700, letterSpacing: '1px', marginTop: '2px' }}>{zone.id}</div>
                  </div>
                </Link>
              ))}
            <div style={{ borderTop: '1px solid #111', paddingTop: '20px', marginTop: '8px' }}>
              <button onClick={handleLogout}
                style={{ width: '100%', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid #33333344', borderRadius: '16px', color: '#555', fontSize: '12px', fontWeight: 900, cursor: 'pointer', letterSpacing: '1px' }}>
                🔒 DISCONNECT SESSION
              </button>
            </div>
          </div>
        )}

        {/* 🛡️ SIDEBAR + SHELL CSS — Consolidated in globals.css (Iron Law 19) */}
        <style dangerouslySetInnerHTML={{__html: `
          /* 🛡️ VISITOR VIEW-MODE */
          .zone-view-mode button,
          .zone-view-mode input,
          .zone-view-mode select,
          .zone-view-mode textarea,
          .zone-view-mode [contenteditable] {
            pointer-events: none !important;
            opacity: 0.4 !important;
            cursor: not-allowed !important;
            user-select: none !important;
          }
          .zone-view-mode .vm-banner,
          .zone-view-mode .vm-banner * {
            pointer-events: auto !important;
            opacity: 1 !important;
            cursor: default !important;
          }
          .visitor-session .egress-red-hover { opacity: 0.6; }
        `}} />
        </div>
      ) : (
        <DesktopLayout
          liveTime={liveTime}
          fxRates={fxRates}
          activeUser={activeUser}
          activeRole={activeRole}
          allowedZones={allowedZones}
          kernel={kernel}
          handleLogout={handleLogout}
          formatTZ={formatTZ}
          setLayoutMode={setLayoutMode}
        >
          {children}
        </DesktopLayout>
      )}
      <FloatingDemoTimer />
      <ScreenCaptureBot />
    </RadioProvider>
  );
}

const navItemStyle = (active: boolean) => ({});
const iconBoxStyle = (active: boolean) => ({});
