'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { MASTER_ZONES, ZONE_PERMISSIONS } from '../kernel';
import GlobalRadioWidget from '../components/GlobalRadioWidget';

interface DesktopLayoutProps {
  children: React.ReactNode;
  liveTime: Date | null;
  fxRates: Record<string, { rate: number; prev: number }>;
  activeUser: string;
  activeRole: string;
  allowedZones: string[] | null;
  kernel: any;
  handleLogout: () => void;
  formatTZ: (date: Date, tz: string) => string;
  setLayoutMode: (mode: 'classic' | 'desktop') => void;
}

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

const CATEGORIES = [
  {
    id: 'operations',
    name: '⚙️ OPERATIONS',
    zones: ['Z-07', 'Z-05', 'Z-06', 'Z-26', 'Z-27', 'Z-28', 'Z-29', 'Z-3B', 'Z-08', 'Z-16', 'Z-17', 'Z-12']
  },
  {
    id: 'guest',
    name: '🤝 GUEST & CRM',
    zones: ['Z-GUEST', 'Z-25', 'Z-10']
  },
  {
    id: 'property',
    name: '🏢 PROPERTY & ASSETS',
    zones: ['Z-30', 'Z-PROP', 'Z-31']
  },
  {
    id: 'hr',
    name: '👥 HR & PEOPLE',
    zones: ['Z-09', 'Z-2B', 'Z-18']
  },
  {
    id: 'finance',
    name: '📊 FINANCE & LEDGERS',
    zones: ['Z-11', 'Z-1B', 'Z-11B', 'Z-11C', 'Z-VAULT', 'Z-DEPT-GW', 'Z-MASTER', 'Z-INTEL']
  },
  {
    id: 'system',
    name: '🔧 SYSTEM & INFRA',
    zones: ['Z-21', 'Z-23', 'Z-14', 'Z-19', 'Z-20', 'Z-WEB', 'Z-OWNER']
  }
];

const ZONE_TABS: Record<string, { label: string; query: string }[]> = {
  'Z-11': [
    { label: '💎 ROI Gallery', query: '?tab=0' },
    { label: '📋 Item Trace', query: '?tab=1' },
    { label: '📊 Burden Matrix', query: '?tab=2' },
    { label: '🧠 Action Center', query: '?tab=3' },
    { label: '🕒 Payroll Pulse', query: '?tab=4' },
    { label: '🌃 Night Audit', query: '?tab=5' },
    { label: '📖 GL Entry', query: '?tab=6' },
    { label: '⏳ AR Aging', query: '?tab=7' },
    { label: '🏦 Bank Recon', query: '?tab=8' },
    { label: '📦 AP Module', query: '?tab=9' },
    { label: '▖️ Trial Balance', query: '?tab=10' },
    { label: '📁 Sovereign Vault', query: '?tab=12' },
    { label: '🔮 Intelligence', query: '?tab=13' },
    { label: '🏢 Division P&L', query: '?tab=14' },
    { label: '🔒 Period Locking', query: '?tab=15' },
    { label: '🔄 Reversals', query: '?tab=16' },
    { label: '💱 Currency Console', query: '?tab=21' },
    { label: '⚖️ Tax Rules', query: '?tab=22' },
    { label: '🔍 SOC-2 Audit', query: '?tab=23' },
    { label: '🔐 Ledger Auth Gateway', query: '?tab=25' }
  ],
  'Z-30': [
    { label: '📊 PMS Dashboard', query: '' },
    { label: '🛏️ Rooms Grid', query: '?tab=rooms' },
    { label: '👥 Guest Folios', query: '?tab=folios' },
    { label: '🧹 Housekeeping', query: '?tab=hk' },
    { label: '🔧 Maintenance', query: '?tab=maintenance' },
    { label: '📬 Owner Requests', query: '?tab=requests' },
    { label: '⚙️ PMS Settings', query: '?tab=settings' }
  ],
  'Z-09': [
    { label: '👥 Personnel Registry', query: '' },
    { label: '📅 Attendance Log', query: '?tab=attendance' },
    { label: '💰 Payroll Center', query: '?tab=payroll' },
    { label: '🤖 AGI Recruiting', query: '?tab=AGI_RECRUIT' }
  ],
  'Z-06': [
    { label: '🛒 Sales Terminal', query: '' },
    { label: '📦 Active Orders', query: '?tab=orders' },
    { label: '📝 Sales Log', query: '?tab=log' }
  ]
};

export default function DesktopLayout({
  children,
  liveTime,
  fxRates,
  activeUser,
  activeRole,
  allowedZones,
  kernel,
  handleLogout,
  formatTZ,
  setLayoutMode
}: DesktopLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isMinimized, setIsMinimized] = useState(false);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('operations');
  const [activeStartZone, setActiveStartZone] = useState<string | null>('Z-07');
  const [desktopShortcuts, setDesktopShortcuts] = useState<string[]>([]);

  const isZoneAllowed = useCallback((zone: any) => {
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
  }, [kernel, activeRole, allowedZones]);

  useEffect(() => {
    const allowed = (kernel?.zones || MASTER_ZONES).filter(isZoneAllowed);
    const saved = localStorage.getItem('miracle_desktop_shortcuts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const filtered = parsed.filter((id: string) => allowed.some(z => z.id === id));
        const missing = allowed.filter(z => !filtered.includes(z.id)).map(z => z.id);
        setDesktopShortcuts([...filtered, ...missing]);
      } catch {
        setDesktopShortcuts(allowed.map(z => z.id));
      }
    } else {
      setDesktopShortcuts(allowed.map(z => z.id));
    }
  }, [kernel, activeRole, allowedZones, isZoneAllowed]);

  useEffect(() => {
    setIsMinimized(false);
  }, [pathname]);

  // Click away listener for Start Menu
  useEffect(() => {
    if (!startMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.miracle-start-menu') && !target.closest('.taskbar-start-btn')) {
        setStartMenuOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [startMenuOpen]);

  // Drag and Drop Handlers for Desktop Grid
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', idx.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    const sourceIdxStr = e.dataTransfer.getData('text/plain');
    if (!sourceIdxStr) return;
    const sourceIdx = parseInt(sourceIdxStr, 10);
    if (isNaN(sourceIdx) || sourceIdx === targetIdx) return;
    const reordered = [...desktopShortcuts];
    const [removed] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, removed);
    setDesktopShortcuts(reordered);
    localStorage.setItem('miracle_desktop_shortcuts', JSON.stringify(reordered));
  };

  return (
    <div className="layout-desktop">
      {/* Shell layout switcher (floating at top right) */}
      <div className="layout-mode-switcher">
        <span style={{ fontSize: '9px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', marginRight: '4px' }}>SHELL:</span>
        <button className="layout-mode-switcher-btn active">DESKTOP</button>
        <button 
          className="layout-mode-switcher-btn"
          onClick={() => {
            setLayoutMode('classic');
            localStorage.setItem('miracle_layout_mode', 'classic');
          }}
        >
          CLASSIC
        </button>
      </div>

      {/* 🌐 THE GLOBAL MARQUEE (NEON TIME PULSE) */}
      <div style={{ height: '2.4rem', background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(15px)', borderBottom: '1px solid rgba(0, 242, 255, 0.2)', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 100 }}>
          {/* 👁️ VISITOR MODE BADGE */}
          {activeRole === 'VISITOR' && (
            <div style={{
              position: 'absolute', right: '80px', top: '50%', transform: 'translateY(-50%)',
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
              {[0, 1].map((blockIdx) => (
                <div key={`block-${blockIdx}`} style={{ display: 'flex', alignItems: 'center' }}>
                  {WORLD_CITIES.map((city, idx) => (
                    <div key={`c-${blockIdx}-${idx}`} style={{ display: 'flex', gap: '8px', padding: '0 32px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 900, whiteSpace: 'nowrap', alignItems: 'center' }}>
                      <span style={{ color: city.color, opacity: 0.8, fontSize: '10px', letterSpacing: '1px' }}>{city.name}</span>
                      <span className="time-pulse" style={{ color: '#FFF', textShadow: `0 0 10px ${city.color}` }}>
                        {liveTime ? formatTZ(liveTime, city.tz) : '--:--'}
                      </span>
                    </div>
                  ))}
                  <div style={{ padding: '0 20px', color: 'rgba(255,255,255,0.15)', fontSize: '18px', flexShrink: 0 }}>┃</div>
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

      {/* Desktop Grid */}
      <div className="desktop-grid">
        {desktopShortcuts.map((zoneId, index) => {
          const zone = (kernel?.zones || MASTER_ZONES).find(z => z.id === zoneId);
          if (!zone) return null;
          return (
            <div
              key={zone.id}
              className="desktop-shortcut-icon"
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onClick={() => {
                router.push(zone.path);
                setIsMinimized(false);
              }}
            >
              <div className="desktop-shortcut-icon-box">{zone.icon}</div>
              <div className="desktop-shortcut-label">{zone.name.toUpperCase()}</div>
              <div className="desktop-shortcut-zone-badge">{zone.id}</div>
            </div>
          );
        })}
      </div>

      {/* 3-Tier Start Menu Popup */}
      {startMenuOpen && (
        <div className="miracle-start-menu desktop-glass-panel">
          {/* Col 1: Categories */}
          <div className="start-menu-column start-col-categories">
            <div style={{ fontSize: '9px', fontWeight: 900, color: 'rgba(212,175,55,0.8)', letterSpacing: '1.5px', marginBottom: '12px' }}>CATEGORIES</div>
            {CATEGORIES.map((cat) => (
              <div 
                key={cat.id} 
                className={`start-menu-item ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat.id);
                  const allowed = (kernel?.zones || MASTER_ZONES).filter(isZoneAllowed).filter(zone => cat.zones.includes(zone.id));
                  setActiveStartZone(allowed[0]?.id || null);
                }}
              >
                <span>{cat.name}</span>
              </div>
            ))}
          </div>

          {/* Col 2: Zones */}
          <div className="start-menu-column start-col-zones">
            <div style={{ fontSize: '9px', fontWeight: 900, color: 'rgba(212,175,55,0.8)', letterSpacing: '1.5px', marginBottom: '12px' }}>ZONES</div>
            {(() => {
              const cat = CATEGORIES.find(c => c.id === activeCategory);
              if (!cat) return null;
              const allowed = (kernel?.zones || MASTER_ZONES).filter(isZoneAllowed).filter(zone => cat.zones.includes(zone.id));
              return allowed.map((zone) => (
                <div 
                  key={zone.id} 
                  className={`start-menu-item ${activeStartZone === zone.id ? 'active' : ''}`}
                  onClick={() => setActiveStartZone(zone.id)}
                >
                  <span className="start-item-icon">{zone.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{zone.name.toUpperCase()}</span>
                  <span className="start-item-badge">{zone.id}</span>
                </div>
              ));
            })()}
          </div>

          {/* Col 3: Tabs */}
          <div className="start-menu-column start-col-tabs">
            <div style={{ fontSize: '9px', fontWeight: 900, color: 'rgba(212,175,55,0.8)', letterSpacing: '1.5px', marginBottom: '12px' }}>TABS & PAGES</div>
            {(() => {
              if (!activeStartZone) return <div style={{ color: '#555', fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>Select a zone</div>;
              const zone = (kernel?.zones || MASTER_ZONES).find(z => z.id === activeStartZone);
              if (!zone) return null;
              const tabs = ZONE_TABS[activeStartZone];
              if (tabs && tabs.length > 0) {
                return tabs.map((tab, idx) => (
                  <div 
                    key={idx} 
                    className="start-menu-item"
                    onClick={() => {
                      router.push(`${zone.path}${tab.query}`);
                      setStartMenuOpen(false);
                      setIsMinimized(false);
                    }}
                  >
                    <span>{tab.label}</span>
                  </div>
                ));
              } else {
                return (
                  <div 
                    className="start-menu-item active"
                    onClick={() => {
                      router.push(zone.path);
                      setStartMenuOpen(false);
                      setIsMinimized(false);
                    }}
                  >
                    <span>🚀 LAUNCH ZONE</span>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}

      {/* App Window Wrapper */}
      <div className={`app-window-wrapper ${isMinimized ? 'minimized' : ''}`}>
        {/* controls */}
        <div className="app-window-controls">
          <button 
            className="window-control-btn" 
            onClick={() => setIsMinimized(true)}
            title="Minimize"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ➖
          </button>
          <button 
            className="window-control-btn close-btn" 
            onClick={() => {
              router.push('/dashboard');
              setIsMinimized(false);
            }}
            title="Close to Desktop"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>
        
        <div style={{ width: '100%', height: '100%', overflowY: 'auto' }} className="miracle-content-scroll">
          {children}
        </div>
      </div>

      {/* Bottom Taskbar */}
      <div className="windows-taskbar">
        <button 
          className="taskbar-start-btn" 
          onClick={() => setStartMenuOpen(!startMenuOpen)}
          title="Start Menu"
        >
          <span className="taskbar-start-logo">M</span>
        </button>

        {/* Center App Dock */}
        <div className="centered-app-dock">
          {(() => {
            const pinnedIds = ['Z-07', 'Z-30', 'Z-06', 'Z-11'];
            const activeZ = (kernel?.zones || MASTER_ZONES).find(
              (z: any) => z.path !== '/dashboard' && z.path && (pathname === z.path || pathname.startsWith(z.path + '?') || pathname.startsWith(z.path + '/'))
            );
            const dockIds = [...pinnedIds];
            if (activeZ && !dockIds.includes(activeZ.id)) {
              dockIds.push(activeZ.id);
            }

            return dockIds.map((id) => {
              const zone = (kernel?.zones || MASTER_ZONES).find(z => z.id === id);
              if (!zone) return null;

              const isRunning = pathname === zone.path || pathname.startsWith(zone.path + '?') || pathname.startsWith(zone.path + '/');
              
              const classes = [
                'dock-app-item',
                isRunning ? 'running' : '',
                (isRunning && !isMinimized) ? 'focused' : '',
                (isRunning && isMinimized) ? 'minimized' : ''
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={zone.id}
                  className={classes}
                  onClick={() => {
                    if (isRunning) {
                      setIsMinimized(!isMinimized);
                    } else {
                      router.push(zone.path);
                      setIsMinimized(false);
                    }
                  }}
                  title={zone.name}
                  style={{ background: 'none', border: 'none', color: '#FFF' }}
                >
                  {zone.icon}
                </button>
              );
            });
          })()}
        </div>

        {/* System Tray */}
        <div className="taskbar-system-tray">
          <div className="tray-item" style={{ gap: '6px' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid #00F2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#00F2FF', fontSize: '8px' }}>
              {activeUser.slice(0,2).toUpperCase()}
            </div>
            <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{activeUser}</span>
          </div>

          <div className="tray-item tray-clock">
            <span>🕒 {liveTime ? liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '00:00'}</span>
          </div>

          <button 
            onClick={() => {
              setLayoutMode('classic');
              localStorage.setItem('miracle_layout_mode', 'classic');
            }}
            className="tray-item"
            style={{ border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.05)', color: '#FFF', fontSize: '9px', fontWeight: 900, letterSpacing: '0.5px' }}
            title="Switch to Classic Layout"
          >
            🎛️ CLASSIC
          </button>
        </div>
      </div>

      <GlobalRadioWidget />
    </div>
  );
}
