'use client';
/**
 * GlobalRadioWidget.tsx
 * SOVEREIGN FM RADIO — GLOBAL FLOATING WIDGET
 * Rendered ONCE in dashboard/layout.tsx. Persists across ALL panels.
 * The collapsed pill shows on every panel when radio is active.
 * Closing sends it back to "Solve Portal only" mode.
 */
import React, { useState } from 'react';
import { useRadio, STATIONS } from '../context/RadioContext';

export default function GlobalRadioWidget() {
  const {
    radioActive, radioStation, radioExpanded, radioVisible,
    favourites, frequency, volume,
    setRadioExpanded, setRadioVisible,
    setFrequency, setVolume,
    toggleRadio, switchStation, toggleFavourite, playCustom,
  } = useRadio();

  const [showFineTune, setShowFineTune] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  // Hidden unless visible (user has opened it from Solve Portal at least once)
  if (!radioVisible) return null;

  const tuneCustom = () => {
    if (!customUrl.trim()) return;
    playCustom(customUrl.trim(), customName.trim() || 'Custom Station');
    setShowFineTune(false);
    setCustomName('');
    setCustomUrl('');
  };

  const handleClose = () => {
    setRadioVisible(false);
    setRadioExpanded(false);
  };

  return (
    <div style={widgetWrap(radioActive, radioExpanded)} id="global-radio-widget">

      {/* ── COLLAPSED PILL ── */}
      {!radioExpanded && (
        <div style={pill} onClick={() => setRadioExpanded(true)}>
          <span style={{ fontSize: 18, filter: radioActive ? 'drop-shadow(0 0 8px #00F2FF)' : 'none', animation: radioActive ? 'spin 3s linear infinite' : 'none', display: 'inline-block' }}>📻</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: radioActive ? '#00F2FF' : '#888', letterSpacing: '1px' }}>FM RADIO</span>
            {radioActive && <span style={{ fontSize: 8, color: '#00FF88', animation: 'pulse-text 1.5s infinite' }}>{STATIONS[radioStation]?.name.split(' - ')[1] || STATIONS[radioStation]?.name}</span>}
          </div>
          <button
            onClick={e => { e.stopPropagation(); toggleRadio(); }}
            style={miniBtn(radioActive)} aria-label={radioActive ? 'Pause Radio' : 'Play Radio'}
          >
            {radioActive ? '⏸' : '▶'}
          </button>
        </div>
      )}

      {/* ── EXPANDED PANEL ── */}
      {radioExpanded && (
        <div style={{ padding: 15 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20, animation: radioActive ? 'spin 3s linear infinite' : 'none', display: 'inline-block' }}>📻</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#00F2FF', letterSpacing: '1px' }}>OPERATIVE FM</div>
                {radioActive && <div style={{ fontSize: 8, color: '#00FF88', animation: 'pulse-text 1.5s infinite' }}>● LIVE — {STATIONS[radioStation]?.name}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setRadioExpanded(false)} style={iconBtn('#555')} title="Minimise">─</button>
              <button onClick={handleClose} style={iconBtn('#FF3131')} title="Close (back to Solve Portal)">✕</button>
            </div>
          </div>

          {/* Equaliser bars */}
          {radioActive && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 20, marginBottom: 12, justifyContent: 'center' }}>
              {[...Array(7)].map((_, i) => (
                <div key={i} style={{ width: 4, background: 'linear-gradient(to top,#00F2FF,#9D00FF)', borderRadius: 2, animation: `eq-bar ${0.4 + i * 0.1}s ease-in-out infinite alternate`, height: `${30 + i * 10}%` }} />
              ))}
            </div>
          )}

          {/* Frequency Slider */}
          <div style={{ marginBottom: 12, background: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 10, border: '1px solid #1a1a1a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#D4AF37', fontWeight: 900, marginBottom: 6 }}>
              <span>88.0</span>
              <span style={{ fontSize: 12, color: '#00F2FF' }}>{frequency.toFixed(1)} MHz</span>
              <span>108.0</span>
            </div>
            <input type="range" min={88} max={108} step={0.1} value={frequency}
              onChange={e => setFrequency(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#00F2FF', cursor: 'pointer' }}
            />
          </div>

          {/* Volume Slider */}
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12 }}>🔊</span>
            <input type="range" min={0} max={1} step={0.05} value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#00FF88', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 9, color: '#555', width: 28 }}>{Math.round(volume * 100)}%</span>
          </div>

          {/* Station list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {STATIONS.map((st, i) => (
              <div key={i} style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => switchStation(i)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${radioStation === i ? '#00F2FF' : 'rgba(255,255,255,0.05)'}`, background: radioStation === i ? 'rgba(0,242,255,0.1)' : 'rgba(0,0,0,0.4)', color: radioStation === i ? '#00F2FF' : '#666', fontSize: 10, fontWeight: 900, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{st.name.split(' - ')[1] || st.name}</span>
                  <span style={{ fontSize: 8, color: '#444' }}>{st.genre}</span>
                </button>
                <button onClick={() => toggleFavourite(i)}
                  style={{ width: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)', color: favourites.includes(i) ? '#D4AF37' : '#444', cursor: 'pointer', fontSize: 14 }}>
                  {favourites.includes(i) ? '★' : '☆'}
                </button>
              </div>
            ))}
          </div>

          {/* Fine Tune */}
          <button onClick={() => setShowFineTune(!showFineTune)}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px dashed rgba(212,175,55,0.4)', background: 'rgba(212,175,55,0.05)', color: '#D4AF37', fontSize: 9, fontWeight: 900, cursor: 'pointer', letterSpacing: '1px', marginBottom: 8 }}>
            {showFineTune ? '── CLOSE FINE TUNE' : '+ FINE TUNE (CUSTOM STREAM)'}
          </button>
          {showFineTune && (
            <div style={{ padding: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 10, border: '1px solid rgba(212,175,55,0.2)', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <input type="text" placeholder="Station name (optional)" value={customName} onChange={e => setCustomName(e.target.value)}
                style={{ padding: '8px 10px', background: '#0a0a0a', border: '1px solid #333', borderRadius: 6, color: '#D4AF37', fontSize: 10, outline: 'none' }} />
              <input type="url" placeholder="Stream URL (https://...mp3)" value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                style={{ padding: '8px 10px', background: '#0a0a0a', border: '1px solid #333', borderRadius: 6, color: '#FFF', fontSize: 10, outline: 'none' }} />
              <button onClick={tuneCustom}
                style={{ padding: 9, borderRadius: 7, background: 'rgba(212,175,55,0.15)', border: '1px solid #D4AF37', color: '#D4AF37', fontWeight: 900, fontSize: 10, cursor: 'pointer' }}>
                TUNE IN TO CUSTOM STREAM
              </button>
            </div>
          )}

          {/* Play / Stop */}
          <button onClick={toggleRadio}
            style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${radioActive ? '#FF3131' : '#00F2FF'}`, background: radioActive ? 'rgba(255,49,49,0.1)' : 'rgba(0,242,255,0.1)', color: radioActive ? '#FF3131' : '#00F2FF', fontWeight: 900, fontSize: 12, cursor: 'pointer', letterSpacing: '1px', transition: '0.3s' }}>
            {radioActive ? '⏹ STOP BROADCAST' : '▶ TUNE IN'}
          </button>
          <p style={{ fontSize: 8, color: '#333', textAlign: 'center', margin: '6px 0 0' }}>
            Plays in background · persists across all panels
          </p>
        </div>
      )}

      {/* Scoped animations */}
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse-text { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes eq-bar { from{transform:scaleY(0.2)} to{transform:scaleY(1)} }
      `}</style>
    </div>
  );
}

// ── Styles ──
const widgetWrap = (active: boolean, expanded: boolean): React.CSSProperties => ({
  position: 'fixed',
  bottom: 90,
  right: 15,
  zIndex: 9999,
  background: active ? 'rgba(0,5,20,0.97)' : 'rgba(10,10,10,0.95)',
  backdropFilter: 'blur(20px)',
  border: `1px solid ${active ? '#00F2FF' : 'rgba(255,255,255,0.08)'}`,
  borderRadius: expanded ? 20 : 50,
  boxShadow: active
    ? '0 0 30px rgba(0,242,255,0.3), 0 0 60px rgba(0,242,255,0.1)'
    : '0 10px 30px rgba(0,0,0,0.8)',
  width: expanded ? 'clamp(260px, 80vw, 300px)' : 'auto',
  transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
  overflow: 'hidden',
});

const pill: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  cursor: 'pointer', padding: '10px 14px',
};

const miniBtn = (active: boolean): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: '50%',
  border: `1px solid ${active ? '#FF3131' : '#00F2FF'}`,
  background: active ? 'rgba(255,49,49,0.15)' : 'rgba(0,242,255,0.15)',
  color: active ? '#FF3131' : '#00F2FF',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, transition: '0.2s',
});

const iconBtn = (color: string): React.CSSProperties => ({
  background: 'none', border: 'none', color, fontSize: 14,
  cursor: 'pointer', padding: 4, lineHeight: 1,
});
