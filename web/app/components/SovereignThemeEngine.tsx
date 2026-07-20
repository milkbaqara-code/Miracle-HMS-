'use client';
import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme, BgMode } from '../context/ThemeContext';

// ============================================================
// SOVEREIGN THEME ENGINE V2.0 — Reads from ThemeContext
// CRITICAL DIRECTIVE: ALL effects must be opacity 0.03–0.15 max.
// "Barely visible from distance. Needs a deeper eye to see."
// ============================================================

const MATRIX_CHARS = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي',
  'ก','ข','ค','ง','จ','ช','ซ','ญ','ด','ต','ถ','ท','น','บ','ป','ผ','ฝ','พ','ฟ','ม','ย','ร','ล','ว','ส','ห','อ',
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  '0','1','2','3','4','5','6','7','8','9','0','1','0','1',
];

function MatrixRain({ intensity, color }: { intensity: number; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    const COL_W = 16, cols = Math.floor(W / COL_W);
    const drops: number[] = Array(cols).fill(1).map(() => Math.random() * -H);
    const MAX_ALPHA = 0.15 * Math.max(0.1, intensity);
    const resize = () => { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; };
    window.addEventListener('resize', resize);
    const draw = () => {
      ctx.fillStyle = `rgba(0,0,0,${0.08 + 0.04 * intensity})`;
      ctx.fillRect(0, 0, W, H);
      ctx.font = `10px 'Courier New', monospace`;
      for (let i = 0; i < cols; i++) {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        const alpha = MAX_ALPHA * (0.5 + 0.5 * Math.random());
        ctx.fillStyle = `rgba(${hexToRgb(color)},${alpha})`;
        ctx.fillText(char, i * COL_W, drops[i]);
        if (Math.random() > 0.6) {
          ctx.fillStyle = `rgba(${hexToRgb(color)},${alpha * 0.4})`;
          ctx.fillText(MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)], i * COL_W, drops[i] - COL_W);
        }
        if (drops[i] > H && Math.random() > 0.975) drops[i] = 0;
        else drops[i] += COL_W * 0.4;
      }
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
  }, [intensity, color]);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

function CircuitBoard({ intensity, color }: { intensity: number; color: string }) {
  const alpha = (0.1 * Math.max(0.1, intensity)).toFixed(3);
  const pulseAlpha = (0.15 * Math.max(0.1, intensity)).toFixed(3);
  const rgb = hexToRgb(color);
  return (
    <>
      <style>{`
        @keyframes cph{0%{left:-20%;opacity:0}10%{opacity:1}90%{opacity:1}100%{left:110%;opacity:0}}
        @keyframes cpv{0%{top:-20%;opacity:0}10%{opacity:1}90%{opacity:1}100%{top:110%;opacity:0}}
        .cwh{position:fixed;height:1px;width:100vw;left:0;background:linear-gradient(90deg,transparent,rgba(${rgb},${alpha}),transparent);pointer-events:none;z-index:0}
        .cwv{position:fixed;width:1px;height:100vh;top:0;background:linear-gradient(180deg,transparent,rgba(${rgb},${alpha}),transparent);pointer-events:none;z-index:0}
        .cph{position:absolute;height:2px;width:40px;background:linear-gradient(90deg,transparent,rgba(${rgb},${pulseAlpha}),transparent);top:-0.5px;animation:cph linear infinite;border-radius:2px;filter:blur(1px)}
        .cpv{position:absolute;width:2px;height:40px;background:linear-gradient(180deg,transparent,rgba(${rgb},${pulseAlpha}),transparent);left:-0.5px;animation:cpv linear infinite;border-radius:2px;filter:blur(1px)}
        .cnode{position:fixed;width:3px;height:3px;border-radius:50%;background:rgba(${rgb},${parseFloat(alpha)*2});pointer-events:none;z-index:0}
      `}</style>
      {CIRCUIT_H_WIRES.map((w,i) => <div key={`hw${i}`} className="cwh" style={{top:`${w.top}%`}}>{w.pulses.map((p,j) => <div key={j} className="cph" style={{animationDuration:`${p.dur}s`,animationDelay:`${p.delay}s`}}/>)}</div>)}
      {CIRCUIT_V_WIRES.map((w,i) => <div key={`vw${i}`} className="cwv" style={{left:`${w.left}%`}}>{w.pulses.map((p,j) => <div key={j} className="cpv" style={{animationDuration:`${p.dur}s`,animationDelay:`${p.delay}s`}}/>)}</div>)}
      {CIRCUIT_NODES.map((n,i) => <div key={`n${i}`} className="cnode" style={{top:`${n.y}%`,left:`${n.x}%`}}/>)}
    </>
  );
}

function NeonDots({ intensity, color }: { intensity: number; color: string }) {
  const [dots, setDots] = useState<any[]>([]);
  useEffect(() => {
    const rgb = hexToRgb(color);
    const count = Math.max(10, Math.floor(35 * Math.max(0.1, intensity)));
    setDots(Array.from({ length: count }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: 1.5 + Math.random() * 2, dur: 8 + Math.random() * 14, delay: Math.random() * 8,
      opacity: (0.1 + Math.random() * 0.1) * Math.max(0.1, intensity), rgb,
    })));
  }, [intensity, color]);
  return (
    <>
      <style>{`@keyframes sdd{0%{transform:translate(0,0)}25%{transform:translate(6px,8px)}75%{transform:translate(-5px,4px)}100%{transform:translate(0,0)}}`}</style>
      {dots.map(d => (
        <div key={d.id} style={{
          position:'fixed', left:`${d.x}vw`, top:`${d.y}vh`,
          width:`${d.size}px`, height:`${d.size}px`, borderRadius:'50%',
          background:`rgba(${d.rgb},${d.opacity})`,
          boxShadow:`0 0 ${d.size*3}px rgba(${d.rgb},${d.opacity*0.6})`,
          pointerEvents:'none', zIndex:0,
          animation:`sdd ${d.dur}s ease-in-out ${d.delay}s infinite`,
        }}/>
      ))}
    </>
  );
}

// ============================================================
// MAIN ENGINE — reads mode from ThemeContext (React state)
// ============================================================
export default function SovereignThemeEngine() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const activeMode: BgMode = theme.page_overrides[pathname] || theme.bg_mode;
  const { bg_intensity: intensity, neon_color: color } = theme;
  const opacity = theme.bg_opacity ?? 0.15;
  const sharpness = theme.bg_sharpness ?? 50;

  if (activeMode === 'OFF') return null;

  const isCity = activeMode.startsWith('CITY_');

  return (
    <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden' }}>
      {activeMode === 'NEON_DOTS'    && <NeonDots     intensity={intensity} color={color} />}
      {activeMode === 'CIRCUIT_BOARD'&& <CircuitBoard intensity={intensity} color={color} />}
      {activeMode === 'MATRIX_RAIN'  && <MatrixRain   intensity={intensity} color={color} />}
      {isCity && <CityBackground city={activeMode} opacity={opacity} sharpness={sharpness} color={color} intensity={intensity} />}
    </div>
  );
}

// ---- Helpers ----
function hexToRgb(hex: string): string {
  const c = hex.replace('#','');
  if (c.length===3) return `${parseInt(c[0]+c[0],16)},${parseInt(c[1]+c[1],16)},${parseInt(c[2]+c[2],16)}`;
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

const CIRCUIT_H_WIRES = [
  {top:8,pulses:[{dur:14,delay:0},{dur:18,delay:6}]},{top:19,pulses:[{dur:22,delay:3}]},
  {top:32,pulses:[{dur:16,delay:8},{dur:20,delay:1}]},{top:45,pulses:[{dur:12,delay:5}]},
  {top:58,pulses:[{dur:19,delay:2},{dur:24,delay:9}]},{top:71,pulses:[{dur:17,delay:7}]},
  {top:84,pulses:[{dur:21,delay:4},{dur:15,delay:11}]},{top:94,pulses:[{dur:13,delay:6}]},
];
const CIRCUIT_V_WIRES = [
  {left:7,pulses:[{dur:16,delay:2},{dur:22,delay:8}]},{left:18,pulses:[{dur:20,delay:5}]},
  {left:31,pulses:[{dur:14,delay:1},{dur:18,delay:9}]},{left:44,pulses:[{dur:24,delay:4}]},
  {left:57,pulses:[{dur:17,delay:7},{dur:13,delay:3}]},{left:69,pulses:[{dur:21,delay:6}]},
  {left:82,pulses:[{dur:15,delay:0},{dur:19,delay:10}]},{left:93,pulses:[{dur:12,delay:8}]},
];
const CIRCUIT_NODES = [
  {x:7,y:8},{x:18,y:8},{x:31,y:8},{x:44,y:8},{x:57,y:8},{x:69,y:8},{x:82,y:8},{x:93,y:8},
  {x:7,y:19},{x:18,y:19},{x:44,y:19},{x:69,y:19},{x:82,y:19},{x:7,y:32},{x:31,y:32},
  {x:57,y:32},{x:93,y:32},{x:18,y:45},{x:44,y:45},{x:69,y:45},{x:7,y:58},{x:31,y:58},
  {x:82,y:58},{x:44,y:71},{x:57,y:71},{x:93,y:71},{x:18,y:84},{x:69,y:84},{x:7,y:94},
  {x:44,y:94},{x:82,y:94},
];

function CityBackground({ city, opacity, sharpness, color, intensity }: { city: string, opacity: number, sharpness: number, color: string, intensity: number }) {
  const cityMap: Record<string, string> = {
    'CITY_DUBAI': 'dubai.png',
    'CITY_LONDON': 'london.png',
    'CITY_NEWYORK': 'newyork.png',
    'CITY_SAUDI': 'saudi.png',
    'CITY_QATAR': 'qatar.png',
    'CITY_SINGAPORE': 'singapore.png'
  };
  const img = cityMap[city];
  
  // Sharpness is 0-100. 100 = 0px blur. 0 = 20px blur.
  const blurPx = Math.max(0, 20 - (sharpness * 0.2)); 
  
  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: -3,
        backgroundImage: `url(/themes/${img})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: opacity,
        filter: `blur(${blurPx}px) brightness(0.8)`,
        transition: 'opacity 0.3s, filter 0.3s'
      }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: -2,
        backgroundColor: color,
        mixBlendMode: 'color', // tints the city image with the chosen neon color
        opacity: intensity * 0.4,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: -1,
        background: `linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.8) 100%)`,
        opacity: opacity,
        pointerEvents: 'none',
      }} />
    </>
  );
}
