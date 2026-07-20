'use client';
// ============================================================
// MiracleBot / components / MiracleBotOrb.tsx
// The floating flame orb — drag handle, alert badge, sparkle
// particles, zone login hint, and first-use onboarding hint.
// V4.0 — Enterprise Refactor
// ============================================================
import React from 'react';
import type { ZoneInfo } from '../lib/types';

interface OrbProps {
  zone: ZoneInfo;
  isSpeaking:   boolean;
  isGhostMode:  boolean;
  alertCount:   number;
  showOrbHint:  boolean;
  wispTarget:   string | null;
  onPointerDown:(e: React.PointerEvent) => void;
  onPointerMove:(e: React.PointerEvent) => void;
  onPointerUp:  (e: React.PointerEvent) => void;
  onClick:      () => void;
}

export function MiracleBotOrb({
  zone, isSpeaking, isGhostMode, alertCount, showOrbHint, wispTarget,
  onPointerDown, onPointerMove, onPointerUp, onClick,
}: OrbProps) {
  const c = zone.color;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative' }}>

      {/* FIRST-USE HINT — auto-dismisses via CSS animation */}
      {showOrbHint && (
        <div style={{
          position: 'absolute', bottom: '105%', right: 0, whiteSpace: 'nowrap',
          background: 'rgba(4,4,14,0.93)', border: '1px solid rgba(0,242,255,0.35)',
          borderRadius: 12, padding: '8px 14px', fontSize: 9.5, fontWeight: 800,
          color: '#00F2FF', letterSpacing: 1, boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
          animation: 'hintFadeOut 4.5s ease-in-out forwards',
          pointerEvents: 'none',
        }}>
          👆 Tap to chat &nbsp;·&nbsp; Hold &amp; drag &nbsp;·&nbsp; Double-tap to hide
          <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '7px solid rgba(0,242,255,0.35)', margin: '6px auto 0' }} />
        </div>
      )}

      {/* Z-LOGIN HINT SIGN */}
      {zone.zone === 'Z-LOGIN' && !isGhostMode && (
        <div style={{
          background: 'rgba(4,4,10,0.92)', border: '1px solid rgba(0,242,255,0.25)',
          borderRadius: 14, padding: '10px 16px', maxWidth: 170,
          textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.7), 0 0 20px rgba(0,242,255,0.08)',
          animation: 'hintFadeOut 5s ease-in-out forwards', pointerEvents: 'none',
        }}>
          <div style={{ color: '#00F2FF', fontSize: 9, fontWeight: 900, letterSpacing: 1.5, lineHeight: 1.6 }}>
            OPEN YOUR<br />
            <span style={{ color: '#D4AF37', fontSize: 11 }}>MIRACLE AI AGENT</span><br />
            TO CHAT
          </div>
          <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid rgba(0,242,255,0.25)', margin: '8px auto 0' }} />
        </div>
      )}

      {/* ORB BODY — pointer events for drag */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        style={{
          position: 'relative', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'flex-end',
          width: 60, height: 88,
          pointerEvents: 'auto', touchAction: 'none',
        }}
      >
        {/* Alert badge */}
        {alertCount > 0 && !isGhostMode && (
          <div className="mirAlertBadge" style={{
            position: 'absolute', top: -5, right: -5,
            background: 'radial-gradient(circle at top left, #ff6b6b, #ff0000)',
            color: '#fff', borderRadius: '50%', width: 22, height: 22,
            fontSize: 11, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2, boxShadow: '0 0 10px rgba(255,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.4)',
            animation: 'mirAlertBadgePulse 1.5s infinite',
            border: '1px solid rgba(255,255,255,0.3)',
          }}>
            {alertCount}
          </div>
        )}

        {/* Sparkle particles */}
        {!isGhostMode && (<>
          <div style={{ position: 'absolute', top: 6,  left: 10, width: 3, height: 3, borderRadius: '50%', background: '#00f2ff', animation: 'mirSpark1 1.4s ease-in-out infinite', opacity: 0, zIndex: 3 }} />
          <div style={{ position: 'absolute', top: 12, right: 8,  width: 2, height: 2, borderRadius: '50%', background: '#7b61ff', animation: 'mirSpark2 1.8s ease-in-out 0.3s infinite', opacity: 0, zIndex: 3 }} />
          <div style={{ position: 'absolute', top: 8,  left: 20, width: 2, height: 2, borderRadius: '50%', background: '#00f2ff', animation: 'mirSpark3 1.2s ease-in-out 0.7s infinite', opacity: 0, zIndex: 3 }} />
          <div style={{ position: 'absolute', top: 18, right: 12, width: 2, height: 2, borderRadius: '50%', background: '#a78bfa', animation: 'mirSpark1 2s ease-in-out 0.5s infinite', opacity: 0, zIndex: 3 }} />
        </>)}

        {/* THE FLAME — reacts to alert severity */}
        <div
          className={`miracle-flame-wrapper${wispTarget ? ' wisp-active' : ''} ${alertCount >= 3 ? 'flame-rage' : ''}`}
          style={{
            position: 'relative', width: 38, height: 58, marginBottom: 4,
            filter: isSpeaking
              ? 'drop-shadow(0 0 14px #7c3aed) drop-shadow(0 0 28px #7c3aedaa)'
              : alertCount >= 3
                ? 'drop-shadow(0 0 16px #ff0000) drop-shadow(0 0 32px rgba(255,0,0,0.8))'
                : alertCount > 0
                  ? 'drop-shadow(0 0 14px #ff8c00) drop-shadow(0 0 28px rgba(255,140,0,0.6))'
                  : `drop-shadow(0 0 12px ${c}) drop-shadow(0 0 24px ${c}88)`,
          }}
        >
          {/* Outer flame */}
          <div style={{
            position: 'absolute', inset: 0,
            background: isSpeaking
              ? 'radial-gradient(ellipse 55% 70% at 50% 80%, #6d28d9 0%, #7c3aed 30%, #a78bfa 60%, transparent 100%)'
              : alertCount >= 3
                ? 'radial-gradient(ellipse 55% 70% at 50% 80%, #b30000 0%, #ff0000 40%, #ff6666 70%, transparent 100%)'
                : alertCount > 0
                  ? 'radial-gradient(ellipse 55% 70% at 50% 80%, #cc5500 0%, #ff8c00 40%, #ffb366 70%, transparent 100%)'
                  : `radial-gradient(ellipse 55% 70% at 50% 80%, #1d4ed8 0%, ${c} 40%, #bae6fd 70%, transparent 100%)`,
            borderRadius: '50% 50% 35% 35% / 60% 60% 40% 40%',
            filter: 'blur(3px)',
            animation: alertCount >= 3 ? 'mirFlameAlert 0.25s ease-in-out infinite alternate'
                     : alertCount > 0  ? 'mirFlameAlert 0.5s ease-in-out infinite alternate'
                     : 'mirFlame 0.95s ease-in-out infinite alternate',
          }} />
          {/* Inner core */}
          <div style={{
            position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
            width: '45%', height: '55%',
            background: alertCount >= 3
              ? 'radial-gradient(ellipse at 50% 75%, #ffffff 0%, #ffcccc 50%, transparent 100%)'
              : 'radial-gradient(ellipse at 50% 75%, #ffffff 0%, #e0f2fe 50%, transparent 100%)',
            borderRadius: '50% 50% 30% 30% / 65% 65% 35% 35%',
            filter: 'blur(1px)',
            animation: alertCount > 0
              ? 'mirFlameCore 0.4s ease-in-out 0.18s infinite alternate'
              : 'mirFlameCore 0.7s ease-in-out 0.18s infinite alternate',
          }} />
        </div>

        {/* MIRACLE label */}
        <div style={{
          color: isGhostMode ? 'transparent' : isSpeaking ? '#a78bfa' : c,
          fontSize: 9, fontWeight: 800, letterSpacing: 2,
          fontFamily: "'Inter', sans-serif",
          textShadow: isSpeaking ? '0 0 8px #7c3aed' : `0 0 8px ${c}`,
          userSelect: 'none', transition: 'color 0.5s',
        }}>
          MIRACLE
        </div>
      </div>
    </div>
  );
}
