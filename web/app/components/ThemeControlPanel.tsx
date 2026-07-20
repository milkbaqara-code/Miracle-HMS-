'use client';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  MiracleThemeConfig, BgMode, BtnStyle, SidebarMode, FontScale,
  DEFAULT_THEME, readTheme, applyGlobalVars,
} from '../context/ThemeContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './SovereignToast';

const COLOR_PRESETS = [
  { name: 'CYBER CYAN',     hex: '#00F2FF' },
  { name: 'SOVEREIGN GOLD', hex: '#D4AF37' },
  { name: 'ROYAL PURPLE',   hex: '#9D00FF' },
  { name: 'PHANTOM GREEN',  hex: '#00FF88' },
  { name: 'INFERNO RED',    hex: '#FF3131' },
  { name: 'SUNSET AMBER',   hex: '#F59E0B' },
  { name: 'LOTUS PINK',     hex: '#FF6B9D' },
  { name: 'ARCTIC WHITE',   hex: '#E8F4FF' },
];

const PAGE_ROUTES = [
  { label: 'Guest Hub',       path: '/guest/hub' },
  { label: 'Guest Ecommerce', path: '/guest/ecommerce' },
  { label: 'Guest Concierge', path: '/guest/concierge' },
  { label: 'Guest Cinema',    path: '/guest/cinema' },
  { label: 'Guest Folio',     path: '/guest/folio' },
  { label: 'Guest Order',     path: '/guest/order' },
  { label: 'Dashboard Home',  path: '/dashboard' },
  { label: 'POS Terminal',    path: '/dashboard/pos' },
  { label: 'Reservations',    path: '/dashboard/reservations' },
  { label: 'Wellness Zone',   path: '/dashboard/wellness' },
  { label: 'Accounts',        path: '/dashboard/accounts' },
];

const BG_MODES: { mode: BgMode; icon: string; label: string; desc: string }[] = [
  { mode: 'OFF',           icon: '⬛', label: 'OFF',           desc: 'Clean dark. No animation.' },
  { mode: 'NEON_DOTS',     icon: '✦', label: 'NEON DOTS',     desc: 'Floating luminous particles.' },
  { mode: 'CIRCUIT_BOARD', icon: '⬡', label: 'CIRCUIT BOARD', desc: 'Cyan wire grid with pulse flows.' },
  { mode: 'MATRIX_RAIN',   icon: '▓', label: 'MATRIX RAIN',   desc: 'Arabic · Thai · English falling.' },
  { mode: 'CITY_DUBAI',    icon: '🏙', label: 'NEON DUBAI',     desc: 'Futuristic Burj Khalifa skyline.' },
  { mode: 'CITY_LONDON',   icon: '🎡', label: 'NEON LONDON',    desc: 'Cyberpunk Tower Bridge glow.' },
  { mode: 'CITY_NEWYORK',  icon: '🗽', label: 'NEON NEW YORK',  desc: 'Manhattan glowing night grid.' },
  { mode: 'CITY_SAUDI',    icon: '🕋', label: 'NEON SAUDI',     desc: 'Riyadh Kingdom Centre pulse.' },
  { mode: 'CITY_QATAR',    icon: '🕌', label: 'NEON QATAR',     desc: 'Doha Tornado Tower cyberpunk.' },
  { mode: 'CITY_SINGAPORE',icon: '🦁', label: 'NEON SINGAPORE', desc: 'Marina Bay Sands matrix.' },
];

export default function ThemeControlPanel() {
  const { theme, updateTheme } = useTheme();  // ← Direct React Context — always in sync
  const [customColor, setCustomColor] = useState('');
  const { showToast } = useToast();

  const setPageOverride = (path: string, mode: BgMode | '') => {
    const overrides = { ...theme.page_overrides };
    if (mode === '') delete overrides[path];
    else overrides[path] = mode as BgMode;
    updateTheme({ page_overrides: overrides });
  };

  const resetToDefaults = () => {
    updateTheme(DEFAULT_THEME);
    showToast('Theme reset to defaults', 'success');
  };

  const exportTheme = () => {
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'miracle_theme.json'; a.click();
    showToast('Theme exported', 'success');
  };

  const color = theme.neon_color;
  const rgb = hexToRgbCSS(color);

  const section = (): React.CSSProperties => ({
    background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px', padding: '24px', marginBottom: '20px',
  });
  const sectionTitle = (): React.CSSProperties => ({
    fontSize: '10px', fontWeight: 900, letterSpacing: '2px',
    color, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px',
  });

  return (
    <div className="fade-in" style={{ maxWidth: '900px' }}>
      <style>{`
        .theme-input{background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 14px;color:#FFF;font-size:12px;outline:none;transition:border 0.2s;width:100%;box-sizing:border-box;font-family:'Inter',sans-serif}
        .theme-input:focus{border-color:${color}}
        .theme-select{background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 12px;color:#FFF;font-size:11px;outline:none;cursor:pointer;font-family:'Inter',sans-serif;font-weight:700;letter-spacing:1px}
        .theme-select option{background:#0a0a0a}
        .theme-range{width:100%;height:4px;-webkit-appearance:none;background:rgba(255,255,255,0.08);border-radius:2px;outline:none;cursor:pointer}
        .theme-range::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};cursor:pointer}
        .bg-card{padding:18px;border-radius:14px;cursor:pointer;transition:all 0.2s;border:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02)}
        .bg-card:hover{border-color:rgba(255,255,255,0.12)}
        .bg-card.active{background:rgba(${rgb},0.08);border-color:${color};box-shadow:0 0 20px rgba(${rgb},0.12)}
        .color-swatch{width:36px;height:36px;border-radius:50%;cursor:pointer;border:2px solid rgba(255,255,255,0.1);transition:all 0.2s;flex-shrink:0}
        .color-swatch:hover{transform:scale(1.15)}
        .color-swatch.active{border-width:3px;box-shadow:0 0 12px currentColor}
        .toggle-group{display:flex;gap:6px;flex-wrap:wrap}
        .tog-btn{padding:9px 18px;border-radius:8px;font-size:10px;font-weight:900;letter-spacing:1.5px;cursor:pointer;transition:all 0.2s;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);color:#555}
        .tog-btn.active{background:rgba(${rgb},0.12);border-color:${color};color:${color}}
        .action-btn{padding:10px 20px;border-radius:9px;font-size:10px;font-weight:900;letter-spacing:1.5px;cursor:pointer;transition:all 0.2s}
      `}</style>

      {/* SECTION 1 — Background Mode */}
      <div style={section()}>
        <div style={sectionTitle()}>◈ BACKGROUND DATA GRID</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
          {BG_MODES.map(({ mode, icon, label, desc }) => (
            <div key={mode} className={`bg-card ${theme.bg_mode === mode ? 'active' : ''}`}
              onClick={() => updateTheme({ bg_mode: mode })}>
              <div style={{ fontSize:'22px', marginBottom:'8px' }}>{icon}</div>
              <div style={{ fontSize:'12px', fontWeight:900, color: theme.bg_mode === mode ? color : '#AAA', marginBottom:'4px' }}>{label}</div>
              <div style={{ fontSize:'10px', color:'#444' }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom: '10px' }}>
          <div style={{ fontSize:'10px', color:'#555', fontWeight:900, letterSpacing:'1.5px', minWidth:'90px' }}>INTENSITY</div>
          <input type="range" className="theme-range" min="0" max="1" step="0.05"
            value={theme.bg_intensity}
            onChange={e => updateTheme({ bg_intensity: parseFloat(e.target.value) })} />
          <div style={{ fontSize:'11px', fontFamily:'monospace', color, minWidth:'36px', textAlign:'right' }}>
            {Math.round(theme.bg_intensity * 100)}%
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom: '10px' }}>
          <div style={{ fontSize:'10px', color:'#555', fontWeight:900, letterSpacing:'1.5px', minWidth:'90px' }}>TRANSPARENCY</div>
          <input type="range" className="theme-range" min="0" max="1" step="0.05"
            value={theme.bg_opacity}
            onChange={e => updateTheme({ bg_opacity: parseFloat(e.target.value) })} />
          <div style={{ fontSize:'11px', fontFamily:'monospace', color, minWidth:'36px', textAlign:'right' }}>
            {Math.round(theme.bg_opacity * 100)}%
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <div style={{ fontSize:'10px', color:'#555', fontWeight:900, letterSpacing:'1.5px', minWidth:'90px' }}>SHARPNESS</div>
          <input type="range" className="theme-range" min="0" max="100" step="1"
            value={theme.bg_sharpness}
            onChange={e => updateTheme({ bg_sharpness: parseInt(e.target.value) })} />
          <div style={{ fontSize:'11px', fontFamily:'monospace', color, minWidth:'36px', textAlign:'right' }}>
            {theme.bg_sharpness}%
          </div>
        </div>
        <div style={{ marginTop:'8px', fontSize:'9px', color:'#333', letterSpacing:'1px' }}>
          ⚠ Ultra-dim by design. Background never competes with UI.
        </div>
      </div>

      {/* SECTION 2 — Per-Page Override */}
      <div style={section()}>
        <div style={sectionTitle()}>⊙ PER-PAGE BACKGROUND OVERRIDE</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {PAGE_ROUTES.map(({ label, path }) => {
            const current = theme.page_overrides[path] || '';
            return (
              <div key={path} style={{ display:'flex', alignItems:'center', padding:'10px 14px', background:'rgba(255,255,255,0.02)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.04)', gap:'12px' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px', fontWeight:700, color:'#CCC' }}>{label}</div>
                  <div style={{ fontSize:'10px', color:'#444', marginTop:'2px', fontFamily:'monospace' }}>{path}</div>
                </div>
                <select className="theme-select" value={current}
                  onChange={e => setPageOverride(path, e.target.value as BgMode | '')}>
                  <option value="">— INHERIT GLOBAL —</option>
                  <option value="OFF">OFF</option>
                  <option value="NEON_DOTS">NEON DOTS</option>
                  <option value="CIRCUIT_BOARD">CIRCUIT BOARD</option>
                  <option value="MATRIX_RAIN">MATRIX RAIN</option>
                  <option value="CITY_DUBAI">NEON DUBAI</option>
                  <option value="CITY_LONDON">NEON LONDON</option>
                  <option value="CITY_NEWYORK">NEON NEW YORK</option>
                  <option value="CITY_SAUDI">NEON SAUDI</option>
                  <option value="CITY_QATAR">NEON QATAR</option>
                  <option value="CITY_SINGAPORE">NEON SINGAPORE</option>
                </select>
                {current && (
                  <div style={{ fontSize:'9px', padding:'3px 8px', background:`rgba(${rgb},0.1)`, border:`1px solid rgba(${rgb},0.3)`, borderRadius:'6px', color, fontWeight:900, letterSpacing:'1px', whiteSpace:'nowrap' }}>
                    {current}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3 — Neon Color */}
      <div style={section()}>
        <div style={sectionTitle()}>◆ NEON GLOW PALETTE</div>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'20px', alignItems:'center' }}>
          {COLOR_PRESETS.map(({ name, hex }) => (
            <div key={hex} title={name} className={`color-swatch ${theme.neon_color === hex ? 'active' : ''}`}
              style={{ background:hex, borderColor: theme.neon_color === hex ? hex : 'rgba(255,255,255,0.1)' }}
              onClick={() => updateTheme({ neon_color: hex })} />
          ))}
        </div>
        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
          <div style={{ fontSize:'10px', color:'#555', fontWeight:900, letterSpacing:'1.5px', whiteSpace:'nowrap' }}>CUSTOM HEX</div>
          <input className="theme-input" style={{ maxWidth:'160px' }}
            placeholder="#00F2FF" value={customColor}
            onChange={e => setCustomColor(e.target.value)}
            onBlur={() => {
              if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
                updateTheme({ neon_color: customColor });
                setCustomColor('');
              }
            }} />
          <div style={{ width:'28px', height:'28px', borderRadius:'6px', background: customColor || color, border:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }} />
          <div style={{ fontSize:'11px', fontFamily:'monospace', color, fontWeight:900 }}>{color}</div>
        </div>
      </div>

      {/* SECTION 4 — Button Style */}
      <div style={section()}>
        <div style={sectionTitle()}>⬡ BUTTON STYLE VARIANT</div>
        <div className="toggle-group" style={{ marginBottom:'12px' }}>
          {(['GLOW','SOLID','FROST'] as BtnStyle[]).map(s => (
            <button key={s} className={`tog-btn ${theme.btn_style === s ? 'active' : ''}`}
              onClick={() => updateTheme({ btn_style: s })}>{s}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center', marginTop:'8px', padding:'16px', background:'rgba(0,0,0,0.3)', borderRadius:'10px' }}>
          <span style={{ fontSize:'9px', color:'#444', letterSpacing:'1px', marginRight:'4px' }}>PREVIEW</span>
          <button style={previewBtnStyle(theme.btn_style, color)}>BOOK SERVICE</button>
          <button style={previewBtnStyle(theme.btn_style, '#FF3131')}>DELETE</button>
          <button style={previewBtnStyle(theme.btn_style, '#555')}>CANCEL</button>
        </div>
      </div>

      {/* SECTION 5 — Sidebar Mode */}
      <div style={section()}>
        <div style={sectionTitle()}>⟨ SIDEBAR PANEL MODE</div>
        <div className="toggle-group">
          {(['KINETIC','NORMAL'] as SidebarMode[]).map(s => (
            <button key={s} className={`tog-btn ${theme.sidebar_mode === s ? 'active' : ''}`}
              onClick={() => updateTheme({ sidebar_mode: s })}>{s}</button>
          ))}
        </div>
      </div>

      {/* SECTION 6 — Font Scale */}
      <div style={section()}>
        <div style={sectionTitle()}>Aa TYPOGRAPHY SCALE</div>
        <div className="toggle-group">
          {(['COMPACT','STANDARD','LARGE'] as FontScale[]).map(s => (
            <button key={s} className={`tog-btn ${theme.font_scale === s ? 'active' : ''}`}
              onClick={() => updateTheme({ font_scale: s })}>{s}</button>
          ))}
        </div>
      </div>

      {/* SECTION 7 — Active Config */}
      <div style={{ ...section(), borderColor:`rgba(${rgb},0.15)`, background:`rgba(${rgb},0.04)` }}>
        <div style={sectionTitle()}>◈ ACTIVE CONFIGURATION</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'20px' }}>
          {[
            { k:'BG MODE',    v: theme.bg_mode },
            { k:'INTENSITY',  v: `${Math.round(theme.bg_intensity*100)}%` },
            { k:'NEON COLOR', v: theme.neon_color },
            { k:'BUTTONS',    v: theme.btn_style },
            { k:'SIDEBAR',    v: theme.sidebar_mode },
            { k:'FONT SCALE', v: theme.font_scale },
          ].map(({ k, v }) => (
            <div key={k} style={{ background:'rgba(255,255,255,0.02)', padding:'12px 16px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize:'9px', color:'#444', fontWeight:900, letterSpacing:'1.5px', marginBottom:'6px' }}>{k}</div>
              <div style={{ fontSize:'13px', fontWeight:900, color, fontFamily:'monospace' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button className="action-btn" onClick={() => {
            const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'miracle_theme.json'; a.click();
            showToast('Theme exported', 'success');
          }}
            style={{ background:`rgba(${rgb},0.08)`, border:`1px solid rgba(${rgb},0.2)`, color, flex: 1 }}>
            ↓ EXPORT JSON
          </button>
          
          <button className="action-btn" onClick={() => {
             updateTheme(theme);
             showToast('Theme Saved & Applied Successfully!', 'success');
          }}
            style={{ background:`rgba(${rgb},0.2)`, border:`1px solid ${color}`, color:'#FFF', flex: 2, boxShadow: `0 0 15px rgba(${rgb},0.4)` }}>
            💾 SAVE & APPLY THEME
          </button>

          <button className="action-btn" onClick={resetToDefaults}
            style={{ background:'rgba(255,49,49,0.08)', border:'1px solid rgba(255,49,49,0.2)', color:'#FF3131', flex: 1 }}>
            ↺ RESET DEFAULTS
          </button>
        </div>
      </div>
    </div>
  );
}

function hexToRgbCSS(hex: string): string {
  const c = hex.replace('#','');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

function previewBtnStyle(style: BtnStyle, color: string): React.CSSProperties {
  const base: React.CSSProperties = { padding:'8px 18px', borderRadius:'8px', fontWeight:900, fontSize:'10px', letterSpacing:'1px', cursor:'pointer', transition:'all 0.2s' };
  if (style === 'SOLID') return { ...base, background:color, border:`1px solid ${color}`, color:'#000' };
  if (style === 'FROST') return { ...base, background:'rgba(255,255,255,0.08)', border:`1px solid rgba(255,255,255,0.15)`, color, backdropFilter:'blur(10px)' };
  return { ...base, background:`${color}18`, border:`1px solid ${color}`, color, boxShadow:`0 0 14px ${color}30` };
}
