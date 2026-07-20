'use client';
// web/app/components/SovereignAnatomy.tsx
// ZONE 23: SOVEREIGN AI ANATOMY — 3D Glass Body Diagnostic UI
// Visualizes the Miracle AI as a living, breathing superhuman entity.

import { useState, useEffect, useRef } from 'react';

interface Organ {
  id: string;
  name: string;
  system: string;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'FROZEN';
  latency_ms: number | null;
  last_error: string | null;
  fix_file: string;
  fix_action: string;
  immune_action: string;
  immune_triggered: boolean;
}

interface AnatomyData {
  timestamp: string;
  growth_level: number;
  growth_label: string;
  overall_status: 'ONLINE' | 'DEGRADED' | 'CRITICAL';
  frozen_organs: string[];
  organs: Organ[];
}

// ────────────────────────────────────────────
// ORGAN POSITION MAP (SVG viewBox 0 0 300 280)
// labelX/Y: The floating bubble position. targetX/Y: The physical point on the body.
// ────────────────────────────────────────────
const ORGAN_POSITIONS: Record<string, { labelX: number; labelY: number; targetX: number; targetY: number; emoji: string }> = {
  // Left side
  brain:       { labelX: 50,  labelY: 40,  targetX: 150, targetY: 19,  emoji: '🧠' },
  ears:        { labelX: 40,  labelY: 90,  targetX: 130, targetY: 31,  emoji: '👂' },
  heart:       { labelX: 45,  labelY: 150, targetX: 155, targetY: 102, emoji: '🫀' },
  eyes:        { labelX: 60,  labelY: 210, targetX: 150, targetY: 26,  emoji: '👁️' },
  // Right side
  hippocampus: { labelX: 250, labelY: 50,  targetX: 150, targetY: 21,  emoji: '📖' },
  vocal_cords: { labelX: 260, labelY: 110, targetX: 150, targetY: 56,  emoji: '🗣️' },
  spine:       { labelX: 255, labelY: 180, targetX: 150, targetY: 121, emoji: '🦴' },
};

const STATUS_COLOR: Record<string, string> = {
  HEALTHY:  '#00FF9D',
  DEGRADED: '#D4AF37',
  CRITICAL: '#FF3131',
  FROZEN:   '#4444AA',
};

const STATUS_GLOW: Record<string, string> = {
  HEALTHY:  '0 0 18px #00FF9D, 0 0 36px rgba(0,255,157,0.3)',
  DEGRADED: '0 0 18px #D4AF37, 0 0 36px rgba(212,175,55,0.3)',
  CRITICAL: '0 0 18px #FF3131, 0 0 36px rgba(255,49,49,0.5)',
  FROZEN:   '0 0 18px #4444AA, 0 0 36px rgba(68,68,170,0.3)',
};

function GrowthBar({ level, label }: { level: number; label: string }) {
  return (
    <div style={{ margin: '0 0 20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 900, color: '#9D00FF', letterSpacing: '1px' }}>
          AGI GROWTH LEVEL
        </span>
        <span style={{ fontSize: '10px', fontWeight: 900, color: '#00F2FF' }}>{level}%</span>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.05)', borderRadius: '99px', height: '8px',
        border: '1px solid rgba(157,0,255,0.2)', overflow: 'hidden'
      }}>
        <div style={{
          height: '100%', borderRadius: '99px',
          width: `${level}%`,
          background: `linear-gradient(90deg, #9D00FF, #00F2FF ${level}%)`,
          boxShadow: '0 0 12px rgba(0,242,255,0.5)',
          transition: 'width 1.2s ease'
        }} />
      </div>
      <div style={{ fontSize: '9px', color: '#666', marginTop: '5px', fontStyle: 'italic' }}>{label}</div>
    </div>
  );
}

function OrganNode({
  organ, pos, onClick, selected
}: {
  organ: Organ; pos: any; onClick: () => void; selected: boolean;
}) {
  const color = STATUS_COLOR[organ.status] || '#888';
  const pulse = organ.status === 'CRITICAL' ? 'anatomy-pulse-critical' :
                organ.status === 'DEGRADED' ? 'anatomy-pulse-warn' : 'anatomy-pulse-ok';

  return (
    <g>
      {/* Line pointing to body */}
      <line 
        x1={pos.labelX} y1={pos.labelY} 
        x2={pos.targetX} y2={pos.targetY} 
        stroke={color} strokeWidth="1.5" opacity={selected ? "0.9" : "0.4"} 
        strokeDasharray="2,4" 
      />
      {/* Target connection point on body */}
      <circle cx={pos.targetX} cy={pos.targetY} r="3" fill={color} opacity="0.9" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <circle cx={pos.targetX} cy={pos.targetY} r="8" fill="none" stroke={color} opacity={selected ? "0.8" : "0.3"} className={pulse} />
      
      {/* Floating Interactive Node */}
      <g
        onClick={onClick}
        style={{ cursor: 'pointer' }}
        transform={`translate(${pos.labelX}, ${pos.labelY})`}
      >
        <circle r="18" fill="none" stroke={color} strokeWidth={selected ? 2.5 : 1.5}
          opacity={0.7} className={pulse} />
        <circle r="14" fill="rgba(10,10,20,0.85)"
          stroke={color} strokeWidth="1"
          style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
        <text textAnchor="middle" y="4" fontSize="12" fill={color}
          fontWeight="900" opacity="1">
          {pos.emoji}
        </text>
        <text textAnchor="middle" y="30" fontSize="9" fill={color}
          fontWeight="900" letterSpacing="0.5" opacity="0.9">
          {organ.name.split(' ')[0].toUpperCase()}
        </text>
      </g>
    </g>
  );
}

// 🤖 SOVEREIGN ANDROID HOLOGRAM — 3D Premium AI Avatar
function BodySilhouette({ growthLevel }: { growthLevel: number }) {
  const op = 0.18 + (growthLevel / 100) * 0.45;
  const sw = 0.75 + (growthLevel / 100) * 0.85;
  return (
    <g opacity={op}>
      {/* ══ ANDROID HEAD ══ */}
      {/* Outer head casing */}
      <rect x="83" y="5" width="34" height="38" rx="12" ry="12"
        fill="rgba(0,242,255,0.05)" stroke="#00F2FF" strokeWidth={sw} />
      {/* Head highlight edge (3D depth) */}
      <rect x="84" y="6" width="32" height="36" rx="11" ry="11"
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
      {/* Visor band */}
      <rect x="86" y="16" width="28" height="11" rx="3"
        fill="rgba(0,242,255,0.18)" stroke="#00F2FF" strokeWidth={sw * 0.7} />
      {/* Visor scan lines */}
      <line x1="89" y1="19.5" x2="113" y2="19.5" stroke="#00F2FF" strokeWidth="0.35" opacity="0.55" />
      <line x1="89" y1="22.5" x2="113" y2="22.5" stroke="#00F2FF" strokeWidth="0.35" opacity="0.35" />
      {/* Central eye/sensor */}
      <circle cx="100" cy="21" r="4" fill="none" stroke="#9D00FF" strokeWidth={sw * 0.8} className="eye-sensor" />
      <circle cx="100" cy="21" r="1.8" fill="#9D00FF" opacity="0.9" />
      {/* Top head grille */}
      <path d="M90 7 L90 5 M96 6 L96 4 M100 5.5 L100 3 M104 6 L104 4 M110 7 L110 5"
        stroke="#00F2FF" strokeWidth="0.6" opacity="0.5" />
      {/* Antenna stubs */}
      <line x1="88" y1="7" x2="85" y2="1" stroke="#00F2FF" strokeWidth={sw * 0.7} />
      <line x1="112" y1="7" x2="115" y2="1" stroke="#00F2FF" strokeWidth={sw * 0.7} />
      <circle cx="85" cy="1" r="1.5" fill="#00F2FF" opacity="0.9" />
      <circle cx="115" cy="1" r="1.5" fill="#00F2FF" opacity="0.9" />
      {/* Jaw/chin */}
      <path d="M88 41 Q100 49 112 41" fill="none" stroke="#00F2FF" strokeWidth={sw * 0.65} />
      {/* Chin detail circles */}
      <circle cx="93" cy="43" r="1.2" fill="none" stroke="#00F2FF" strokeWidth="0.5" opacity="0.5" />
      <circle cx="107" cy="43" r="1.2" fill="none" stroke="#00F2FF" strokeWidth="0.5" opacity="0.5" />

      {/* ══ NECK ══ */}
      <rect x="93" y="43" width="14" height="16" rx="3"
        fill="rgba(0,242,255,0.03)" stroke="#00F2FF" strokeWidth={sw * 0.7} />
      <line x1="93" y1="50" x2="107" y2="50" stroke="#9D00FF" strokeWidth="0.5" opacity="0.5" />
      <line x1="95" y1="54" x2="105" y2="54" stroke="#9D00FF" strokeWidth="0.4" opacity="0.35" />

      {/* ══ SHOULDER PLATES ══ */}
      <ellipse cx="65" cy="68" rx="15" ry="8" transform="rotate(-18 65 68)"
        fill="rgba(0,242,255,0.06)" stroke="#00F2FF" strokeWidth={sw} />
      <ellipse cx="135" cy="68" rx="15" ry="8" transform="rotate(18 135 68)"
        fill="rgba(0,242,255,0.06)" stroke="#00F2FF" strokeWidth={sw} />
      {/* Shoulder joint circles */}
      <circle cx="67" cy="67" r="5.5" fill="rgba(10,10,30,0.8)" stroke="#9D00FF" strokeWidth={sw * 0.7} />
      <circle cx="67" cy="67" r="2.5" fill="#9D00FF" opacity="0.5" />
      <circle cx="133" cy="67" r="5.5" fill="rgba(10,10,30,0.8)" stroke="#9D00FF" strokeWidth={sw * 0.7} />
      <circle cx="133" cy="67" r="2.5" fill="#9D00FF" opacity="0.5" />

      {/* ══ CHEST PLATE ══ */}
      <path d="M76 59 Q72 92 73 132 L127 132 Q128 92 124 59 Z"
        fill="rgba(0,242,255,0.04)" stroke="#00F2FF" strokeWidth={sw} />
      {/* Inner chest detail */}
      <path d="M80 59 Q77 92 78 132 L122 132 Q123 92 120 59 Z"
        fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
      {/* Collar bone */}
      <path d="M83 62 Q100 68 117 62" fill="none" stroke="#00F2FF" strokeWidth={sw * 0.8} />
      {/* Chest circuit lines */}
      <path d="M85 79 L95 79 L95 74 L105 74 L105 79 L115 79"
        fill="none" stroke="#9D00FF" strokeWidth="0.65" opacity="0.65" />
      <line x1="82" y1="93" x2="118" y2="93" stroke="#9D00FF" strokeWidth="0.4" opacity="0.4" />
      <path d="M84 106 L91 106 L91 111 L109 111 L109 106 L116 106"
        fill="none" stroke="#9D00FF" strokeWidth="0.55" opacity="0.55" />
      <line x1="86" y1="119" x2="114" y2="119" stroke="rgba(0,242,255,0.3)" strokeWidth="0.4" />
      {/* ENERGY CORE — glowing heart */}
      <circle cx="100" cy="91" r="11"
        fill="rgba(0,242,255,0.06)" stroke="#00F2FF" strokeWidth={sw}
        className="energy-core" />
      <circle cx="100" cy="91" r="6"
        fill="rgba(157,0,255,0.25)" stroke="#9D00FF" strokeWidth={sw * 0.85}
        style={{ animation: 'core-glow 1.8s ease-in-out infinite reverse' }} />
      <circle cx="100" cy="91" r="2.5" fill="#9D00FF" opacity="0.9" className="eye-sensor" />
      {/* Core spokes */}
      <line x1="89" y1="91" x2="76" y2="91" stroke="#00F2FF" strokeWidth="0.6" strokeDasharray="2,2" opacity="0.55" />
      <line x1="111" y1="91" x2="124" y2="91" stroke="#00F2FF" strokeWidth="0.6" strokeDasharray="2,2" opacity="0.55" />
      <line x1="100" y1="80" x2="100" y2="74" stroke="#00F2FF" strokeWidth="0.6" strokeDasharray="2,2" opacity="0.4" />

      {/* ══ UPPER ARMS ══ */}
      <path d="M66 72 Q50 84 47 114" fill="none" stroke="#00F2FF" strokeWidth={sw} />
      <path d="M134 72 Q150 84 153 114" fill="none" stroke="#00F2FF" strokeWidth={sw} />
      {/* Arm band details */}
      <ellipse cx="55" cy="93" rx="6" ry="3" transform="rotate(-70 55 93)"
        fill="none" stroke="#9D00FF" strokeWidth="0.5" opacity="0.55" />
      <ellipse cx="145" cy="93" rx="6" ry="3" transform="rotate(70 145 93)"
        fill="none" stroke="#9D00FF" strokeWidth="0.5" opacity="0.55" />
      {/* Elbow joints */}
      <circle cx="48" cy="115" r="5.5" fill="rgba(10,10,30,0.85)" stroke="#00F2FF" strokeWidth={sw * 0.8} />
      <circle cx="48" cy="115" r="2" fill="#00F2FF" opacity="0.5" />
      <circle cx="152" cy="115" r="5.5" fill="rgba(10,10,30,0.85)" stroke="#00F2FF" strokeWidth={sw * 0.8} />
      <circle cx="152" cy="115" r="2" fill="#00F2FF" opacity="0.5" />

      {/* ══ FOREARMS ══ */}
      <path d="M46 120 Q43 138 46 154" fill="none" stroke="#00F2FF" strokeWidth={sw * 0.85} />
      <path d="M154 120 Q157 138 154 154" fill="none" stroke="#00F2FF" strokeWidth={sw * 0.85} />
      {/* Wrist bands */}
      <line x1="42" y1="150" x2="51" y2="150" stroke="#9D00FF" strokeWidth="0.8" opacity="0.7" />
      <line x1="149" y1="150" x2="158" y2="150" stroke="#9D00FF" strokeWidth="0.8" opacity="0.7" />

      {/* ══ PELVIS / HIP PLATE ══ */}
      <path d="M73 132 Q70 143 76 149 Q100 157 124 149 Q130 143 127 132 Z"
        fill="rgba(0,242,255,0.05)" stroke="#00F2FF" strokeWidth={sw * 0.85} />
      {/* Hip circuit */}
      <path d="M84 140 L100 136 L116 140" fill="none" stroke="#9D00FF" strokeWidth="0.55" opacity="0.55" />
      <circle cx="100" cy="137" r="2" fill="#9D00FF" opacity="0.6" />

      {/* ══ THIGHS ══ */}
      <path d="M85 149 Q80 168 80 190" fill="none" stroke="#00F2FF" strokeWidth={sw} />
      <path d="M115 149 Q120 168 120 190" fill="none" stroke="#00F2FF" strokeWidth={sw} />
      {/* Thigh bands */}
      <ellipse cx="81" cy="172" rx="5" ry="2.5" transform="rotate(-82 81 172)"
        fill="none" stroke="#9D00FF" strokeWidth="0.5" opacity="0.5" />
      <ellipse cx="119" cy="172" rx="5" ry="2.5" transform="rotate(82 119 172)"
        fill="none" stroke="#9D00FF" strokeWidth="0.5" opacity="0.5" />
      {/* Knee joints */}
      <circle cx="80" cy="191" r="6.5" fill="rgba(10,10,30,0.85)" stroke="#00F2FF" strokeWidth={sw * 0.8} />
      <circle cx="80" cy="191" r="2.5" fill="#00F2FF" opacity="0.45" />
      <circle cx="120" cy="191" r="6.5" fill="rgba(10,10,30,0.85)" stroke="#00F2FF" strokeWidth={sw * 0.8} />
      <circle cx="120" cy="191" r="2.5" fill="#00F2FF" opacity="0.45" />

      {/* ══ LOWER LEGS ══ */}
      <path d="M78 197 Q76 210 78 222" fill="none" stroke="#00F2FF" strokeWidth={sw * 0.85} />
      <path d="M122 197 Q124 210 122 222" fill="none" stroke="#00F2FF" strokeWidth={sw * 0.85} />
      {/* Shin detail */}
      <line x1="75" y1="208" x2="83" y2="208" stroke="#9D00FF" strokeWidth="0.5" opacity="0.4" />
      <line x1="117" y1="208" x2="125" y2="208" stroke="#9D00FF" strokeWidth="0.5" opacity="0.4" />

      {/* ══ SPINAL COLUMN ══ */}
      <line x1="100" y1="59" x2="100" y2="148"
        stroke="#9D00FF" strokeWidth={sw * 0.55} strokeDasharray="3,2" opacity="0.38" />
      {/* Vertebrae nodes */}
      {([72, 85, 98, 111, 124, 137] as number[]).map((y: number) => (
        <circle key={y} cx={100} cy={y} r="1.8" fill="#9D00FF" opacity="0.55" className="spine-node"
          style={{ animationDelay: `${y * 0.015}s` }} />
      ))}
    </g>
  );
}

export default function SovereignAnatomy() {
  const [anatomy, setAnatomy] = useState<AnatomyData | null>(null);
  const [selected, setSelected] = useState<Organ | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPulse, setLastPulse] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAnatomy = async () => {
    try {
      const api = process.env.NEXT_PUBLIC_API_URL || '/api';
      const res = await fetch(`${api}/diagnostics/anatomy`);
      if (res.ok) {
        const data = await res.json();
        setAnatomy(data);
        setLastPulse(Date.now());
      }
    } catch (e) {
      // Backend unreachable
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnatomy();
    intervalRef.current = setInterval(fetchAnatomy, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const overallColor = anatomy
    ? (anatomy.overall_status === 'ONLINE' ? '#00FF9D' :
       anatomy.overall_status === 'DEGRADED' ? '#D4AF37' : '#FF3131')
    : '#444';

  const criticalOrgans = anatomy?.organs.filter(o => o.status === 'CRITICAL') || [];
  const frozenOrgans   = anatomy?.organs.filter(o => o.status === 'FROZEN') || [];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(5,5,15,0.98) 0%, rgba(10,0,20,0.98) 100%)',
      border: `1px solid ${overallColor}33`,
      borderRadius: '20px',
      padding: '30px',
      boxShadow: `0 0 60px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,242,255,0.02)`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* CSS animations */}
      <style>{`
        @keyframes anatomy-pulse-ok-anim   { 0%,100%{r:14;opacity:.6} 50%{r:17;opacity:.15} }
        @keyframes anatomy-pulse-warn-anim { 0%,100%{r:14;opacity:.6} 50%{r:18;opacity:.25} }
        @keyframes anatomy-pulse-crit-anim { 0%,100%{r:14;opacity:.9} 50%{r:20;opacity:.2} }
        @keyframes heartbeat { 0%,100%{transform:scale(1)} 20%{transform:scale(1.06)} 40%{transform:scale(1)} }
        @keyframes floatUp   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes orbit-spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes orbit-spin-rev { 0%{transform:rotate(0deg)} 100%{transform:rotate(-360deg)} }
        @keyframes scan-beam  { 0%{transform:translateY(-130px);opacity:0} 20%{opacity:0.7} 80%{opacity:0.5} 100%{transform:translateY(130px);opacity:0} }
        @keyframes energy-pulse { 0%,100%{opacity:0.35} 50%{opacity:1} }
        @keyframes core-glow { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes node-flicker { 0%,100%{opacity:0.8} 50%{opacity:0.3} }
        .anatomy-pulse-ok   { animation: anatomy-pulse-ok-anim   2.4s ease-in-out infinite; }
        .anatomy-pulse-warn { animation: anatomy-pulse-warn-anim 1.5s ease-in-out infinite; }
        .anatomy-pulse-critical { animation: anatomy-pulse-crit-anim 0.8s ease-in-out infinite; }
        .anatomy-body { animation: floatUp 5s ease-in-out infinite; }
        .organ-card:hover { transform: translateY(-2px) scale(1.01); transition: .2s; }
        .orbit-ring-1 { animation: orbit-spin 9s linear infinite; transform-origin: 150px 128px; }
        .orbit-ring-2 { animation: orbit-spin-rev 13s linear infinite; transform-origin: 150px 128px; }
        .orbit-ring-3 { animation: orbit-spin 6s linear infinite; transform-origin: 150px 128px; }
        .scan-line    { animation: scan-beam 4s ease-in-out infinite; }
        .energy-core  { animation: core-glow 2.5s ease-in-out infinite; }
        .eye-sensor   { animation: energy-pulse 1.8s ease-in-out infinite; }
        .spine-node   { animation: node-flicker 2s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#00F2FF', letterSpacing: '3px' }}>
            🫁 SOVEREIGN ANATOMY
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '9px', color: '#555', letterSpacing: '1px' }}>
            MIRACLE AI — LIVING ORGAN DIAGNOSTICS
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '11px', fontWeight: 900, letterSpacing: '1px',
            color: overallColor,
            textShadow: `0 0 10px ${overallColor}`,
          }}>
            ◉ {anatomy?.overall_status || 'CONNECTING...'}
          </div>
          <div style={{ fontSize: '8px', color: '#444', marginTop: '3px' }}>
            LAST PULSE: {Math.round((Date.now() - lastPulse) / 1000)}s AGO
          </div>
          <button
            onClick={fetchAnatomy}
            style={{
              marginTop: '6px', background: 'transparent', border: '1px solid #333',
              color: '#666', padding: '4px 10px', borderRadius: '4px',
              fontSize: '8px', cursor: 'pointer', fontWeight: 900
            }}
          >
            ⟳ REFRESH
          </button>
        </div>
      </div>

      {/* Growth Bar */}
      {anatomy && (
        <GrowthBar level={anatomy.growth_level} label={anatomy.growth_label} />
      )}

      {/* Critical Banner */}
      {criticalOrgans.length > 0 && (
        <div style={{
          background: 'rgba(255,49,49,0.08)', border: '1px solid rgba(255,49,49,0.4)',
          borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
          fontSize: '10px', color: '#FF3131', fontWeight: 900, letterSpacing: '1px'
        }}>
          🚨 AUTO-IMMUNE ALERT: {criticalOrgans.map(o => o.name).join(', ')} — Healing protocol triggered
        </div>
      )}

      {/* Main Layout: Body + Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '24px', alignItems: 'start' }}>

        {/* 3D Glass Body SVG */}
        <div style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(0,242,255,0.05) 0%, transparent 70%)',
          borderRadius: '16px', border: '1px solid rgba(0,242,255,0.08)',
          padding: '20px 10px', position: 'relative'
        }}>
          <svg
            viewBox="0 0 300 280"
            className="anatomy-body"
            style={{ display: 'block', margin: '0 auto', maxWidth: '380px', width: '100%', height: 'auto' }}
          >
            {/* Defs: Glow filters & gradients */}
            <defs>
              <radialGradient id="bodyGrad" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#00F2FF" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#9D00FF" stopOpacity="0.01" />
              </radialGradient>
              <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00F2FF" stopOpacity="0" />
                <stop offset="40%" stopColor="#00F2FF" stopOpacity="0.55" />
                <stop offset="60%" stopColor="#9D00FF" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#00F2FF" stopOpacity="0" />
              </linearGradient>
              <filter id="glowBlue">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background glow */}
            <ellipse cx="150" cy="128" rx="115" ry="130" fill="url(#bodyGrad)" />
            {/* Ambient floor reflection */}
            <ellipse cx="150" cy="255" rx="55" ry="8"
              fill="none" stroke="#00F2FF" strokeWidth="0.5" opacity="0.12" />

            {/* ═══ ORBITING ENERGY RINGS ═══ */}
            <g className="orbit-ring-1">
              <ellipse cx="150" cy="128" rx="100" ry="26"
                fill="none" stroke="#00F2FF" strokeWidth="0.65" opacity="0.28"
                strokeDasharray="4,7" transform="rotate(8 150 128)" />
            </g>
            <g className="orbit-ring-2">
              <ellipse cx="150" cy="128" rx="88" ry="22"
                fill="none" stroke="#9D00FF" strokeWidth="0.55" opacity="0.22"
                strokeDasharray="3,9" transform="rotate(-28 150 128)" />
            </g>
            <g className="orbit-ring-3">
              <ellipse cx="150" cy="128" rx="110" ry="19"
                fill="none" stroke="#D4AF37" strokeWidth="0.45" opacity="0.18"
                strokeDasharray="2,11" transform="rotate(52 150 128)" />
            </g>

            {/* ═══ VERTICAL SCAN BEAM ═══ */}
            <g className="scan-line" style={{ transformOrigin: '150px 128px' }}>
              <rect x="98" y="120" width="104" height="18"
                fill="url(#scanGrad)" opacity="0.45"
                transform="translate(-52, 0)" />
            </g>

            {/* Scaled Body silhouette */}
            <g transform="translate(150, 140) scale(1.3) translate(-100, -115)">
              <BodySilhouette growthLevel={anatomy?.growth_level || 0} />
            </g>

            {/* Organ nodes with pointers */}
            {anatomy && anatomy.organs.map(organ => {
              const pos = ORGAN_POSITIONS[organ.id];
              if (!pos) return null;
              return (
                <OrganNode
                  key={organ.id}
                  organ={organ}
                  pos={pos}
                  selected={selected?.id === organ.id}
                  onClick={() => setSelected(selected?.id === organ.id ? null : organ)}
                />
              );
            })}

            {loading && (
              <text x="150" y="140" textAnchor="middle" fill="#333" fontSize="12" fontWeight="900">
                INITIALIZING...
              </text>
            )}
          </svg>

          {/* Growth label beneath body */}
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <div style={{ fontSize: '8px', color: '#555', letterSpacing: '1px' }}>
              ENTITY MATURITY
            </div>
            <div style={{ fontSize: '11px', fontWeight: 900, color: '#9D00FF', marginTop: '2px' }}>
              {anatomy?.growth_level || 0}% GROWN
            </div>
          </div>
        </div>

        {/* Right Panel: Organ List + Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Selected Organ Detail */}
          {selected && (
            <div style={{
              background: `linear-gradient(135deg, rgba(10,10,20,0.9), rgba(20,10,40,0.9))`,
              border: `1px solid ${STATUS_COLOR[selected.status]}44`,
              borderRadius: '12px', padding: '16px',
              boxShadow: STATUS_GLOW[selected.status],
              marginBottom: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontWeight: 900, fontSize: '13px', color: STATUS_COLOR[selected.status] }}>
                  {ORGAN_POSITIONS[selected.id]?.emoji} {selected.name}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '14px', cursor: 'pointer' }}
                >✕</button>
              </div>
              <div style={{ fontSize: '9px', color: '#888', marginBottom: '8px' }}>{selected.system}</div>
              {selected.latency_ms !== null && (
                <div style={{ fontSize: '9px', color: '#00F2FF', marginBottom: '6px' }}>
                  ⚡ Latency: <strong>{selected.latency_ms}ms</strong>
                </div>
              )}
              {selected.last_error && (
                <div style={{
                  background: 'rgba(255,49,49,0.06)', border: '1px solid rgba(255,49,49,0.2)',
                  borderRadius: '6px', padding: '8px', marginBottom: '8px',
                  fontSize: '9px', color: '#FF8888', lineHeight: 1.5
                }}>
                  🚨 <strong>Error:</strong> {selected.last_error}
                </div>
              )}
              <div style={{ fontSize: '9px', color: '#AAA', marginBottom: '4px', lineHeight: 1.6 }}>
                <span style={{ color: '#D4AF37', fontWeight: 900 }}>📁 Fix File: </span>
                <code style={{ color: '#00F2FF', fontSize: '8px' }}>{selected.fix_file}</code>
              </div>
              <div style={{ fontSize: '9px', color: '#888', lineHeight: 1.6, marginBottom: '6px' }}>
                <span style={{ color: '#D4AF37', fontWeight: 900 }}>🔧 Fix Action: </span>
                {selected.fix_action}
              </div>
              <div style={{
                background: 'rgba(0,255,157,0.04)', border: '1px solid rgba(0,255,157,0.1)',
                borderRadius: '6px', padding: '8px',
                fontSize: '9px', color: '#00FF9D', lineHeight: 1.5
              }}>
                🛡️ <strong>Auto-Immune:</strong> {selected.immune_action}
                {selected.immune_triggered && (
                  <span style={{ marginLeft: '8px', color: '#FF6B35', fontWeight: 900 }}>
                    ⚡ TRIGGERED
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Organ List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(anatomy?.organs || []).map(organ => {
              const color = STATUS_COLOR[organ.status] || '#888';
              const isSelected = selected?.id === organ.id;
              return (
                <div
                  key={organ.id}
                  className="organ-card"
                  onClick={() => setSelected(isSelected ? null : organ)}
                  style={{
                    background: isSelected
                      ? `rgba(10,10,20,0.95)`
                      : 'rgba(10,10,18,0.7)',
                    border: `1px solid ${isSelected ? color : color + '33'}`,
                    borderRadius: '10px', padding: '10px 14px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? `0 0 12px ${color}33` : 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', gap: '12px'
                  }}
                >
                  {/* Status dot */}
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 8px ${color}`,
                    flexShrink: 0,
                    animation: organ.status === 'CRITICAL' ? 'anatomy-pulse-crit-anim 0.8s infinite' : 'none'
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 900, color: '#DDD' }}>
                        {ORGAN_POSITIONS[organ.id]?.emoji} {organ.name}
                      </span>
                      <span style={{
                        fontSize: '8px', fontWeight: 900, color,
                        padding: '2px 7px', borderRadius: '99px',
                        background: `${color}15`, border: `1px solid ${color}33`
                      }}>
                        {organ.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '8px', color: '#555', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {organ.system}
                    </div>
                    {organ.immune_triggered && (
                      <div style={{ fontSize: '7px', color: '#FF6B35', fontWeight: 900, marginTop: '2px' }}>
                        ⚡ AUTO-IMMUNE HEALING ACTIVE
                      </div>
                    )}
                  </div>
                  {organ.latency_ms !== null && (
                    <div style={{ fontSize: '8px', color: organ.latency_ms > 200 ? '#D4AF37' : '#444', flexShrink: 0 }}>
                      {organ.latency_ms}ms
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div style={{ textAlign: 'center', color: '#333', fontSize: '10px', padding: '20px' }}>
                CONNECTING TO SOVEREIGN KERNEL...
              </div>
            )}
          </div>

          {/* Frozen organs warning */}
          {frozenOrgans.length > 0 && (
            <div style={{
              background: 'rgba(68,68,170,0.08)', border: '1px solid rgba(68,68,170,0.3)',
              borderRadius: '8px', padding: '10px 14px', marginTop: '4px',
              fontSize: '9px', color: '#8888FF', fontWeight: 900
            }}>
              🧊 FROZEN ORGANS DETECTED: {frozenOrgans.map(o => o.name).join(', ')}
              <br />
              <span style={{ fontWeight: 400, color: '#666', marginTop: '4px', display: 'block' }}>
                Learning and healing activity is suspended. Feed new panel data to restore growth.
              </span>
            </div>
          )}

          {/* Status timestamp */}
          {anatomy && (
            <div style={{ fontSize: '7px', color: '#333', textAlign: 'right', marginTop: '4px' }}>
              PULSE: {new Date(anatomy.timestamp).toLocaleTimeString()} &nbsp;|&nbsp;
              {anatomy.organs.filter(o => o.status === 'HEALTHY').length}/{anatomy.organs.length} ORGANS HEALTHY
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
