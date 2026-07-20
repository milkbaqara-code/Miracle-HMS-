'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCurrencyLang } from './CurrencyLangContext';

// ============================================================
// 🔮 SOVEREIGN FINANCIAL INTELLIGENCE HUB — V3.0
// Burj Al Arab Standard · Premium Analytics Engine
// Three Master Charts: Revenue Arch · Expense Arch · Equilibrium
// ============================================================

interface ZoneData {
  zone: string;
  code: number;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  color: string;
}
interface ForecastPoint { month: string; projected: number; is_actual: boolean; }
interface HotelKPIs {
  total_rooms: number; occupied_rooms: number; occupancy_pct: number;
  adr: number; revpar: number; total_room_revenue: number; in_house_guests: number;
}
interface IntelligenceData {
  zone_revenue: ZoneData[];
  room_revenue: { direct: number; ota: number; total: number };
  tax_collected: { vat: number; sc: number; real_vat_liability: number };
  deferred_revenue: number; ota_commissions: number;
  expenditure: { zone_cogs: number; payroll: number; maintenance: number; loyalty: number; total: number };
  kpis: { total_revenue: number; gross_operating_profit: number; cogs_ratio: number; net_profit_margin: number; net_profit: number };
  forecast: ForecastPoint[];
  roi_data?: RoiDivision[];
}
interface RoiDivision {
  name: string; icon: string; color: string; revenue: number; cogs: number;
  gross_profit: number; fixed_assets: number; estimated_investment: number;
  roi_pct: number; payback_months: number; has_real_assets: boolean;
}
interface Props { formatMoney?: (n: number) => string; }

// ─── helpers ────────────────────────────────────────────────
function useCountUp(target: number, dur = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    const step = target / (dur / 16);
    let cur = 0;
    const t = setInterval(() => { cur += step; if (cur >= target) { setV(target); clearInterval(t); } else setV(cur); }, 16);
    return () => clearInterval(t);
  }, [target, dur]);
  return v;
}

// Consolidated zone data (group ROOM DIRECT + ROOM OTA → ROOMS)
function consolidateZones(zones: ZoneData[]) {
  const g: { label: string; shortLabel: string; color: string; darkColor: string; icon: string; revenue: number; cogs: number; profit: number; margin: number }[] = [];
  let roomRev = 0, roomCogs = 0;
  zones.forEach(z => {
    const zu = z.zone.toUpperCase();
    if (zu.includes('ROOM')) { roomRev += z.revenue; roomCogs += z.cogs; }
    else if (zu.includes('F') && zu.includes('B')) g.push({ label: 'F&B', shortLabel: 'F&B', color: '#00F2FF', darkColor: '#006E73', icon: '🍽️', revenue: z.revenue, cogs: z.cogs, profit: z.profit, margin: z.margin });
    else if (zu.includes('WELLNESS')) g.push({ label: 'WELLNESS', shortLabel: 'SPA', color: '#00FF88', darkColor: '#007A41', icon: '💆', revenue: z.revenue, cogs: z.cogs, profit: z.profit, margin: z.margin });
    else if (zu.includes('BOUTIQUE')) g.push({ label: 'BOUTIQUE', shortLabel: 'BOUTQ', color: '#9D50BB', darkColor: '#5B2170', icon: '👜', revenue: z.revenue, cogs: z.cogs, profit: z.profit, margin: z.margin });
    else if (zu.includes('FLEET')) g.push({ label: 'FLEET', shortLabel: 'FLEET', color: '#FF8C00', darkColor: '#7A4300', icon: '🚗', revenue: z.revenue, cogs: z.cogs, profit: z.profit, margin: z.margin });
    else if (zu.includes('CINEMA')) g.push({ label: 'CINEMA', shortLabel: 'FILM', color: '#E91E63', darkColor: '#9B1040', icon: '🎬', revenue: z.revenue, cogs: z.cogs, profit: z.profit, margin: z.margin });
  });
  const roomProfit = roomRev - roomCogs;
  g.unshift({ label: 'ROOMS', shortLabel: 'ROOMS', color: '#D4AF37', darkColor: '#8B6914', icon: '🛏️', revenue: roomRev, cogs: roomCogs, profit: roomProfit, margin: roomRev > 0 ? Math.round(roomProfit / roomRev * 100) : 0 });
  return g;
}

// ─── ISO BAR MATH ────────────────────────────────────────────
const W = 64, D = 22, MAX_H = 200, GAP = 110, START_X = 70, BASE_Y = 300, SVG_W = 800, SVG_H = 400;
const ix = Math.cos(Math.PI / 6) * W * 0.5;
const iy = Math.sin(Math.PI / 6) * W * 0.5;
function topFacePts(x0: number, y0: number, h: number) {
  return [[x0, y0-h], [x0+ix, y0-h-iy], [x0+W, y0-h], [x0+W-ix, y0-h+iy]].map(p => p.join(',')).join(' ');
}
function leftFacePts(x0: number, y0: number, h: number) {
  return [[x0, y0-h], [x0, y0], [x0+W-ix, y0+iy], [x0+W-ix, y0-h+iy]].map(p => p.join(',')).join(' ');
}
function rightFacePts(x0: number, y0: number, h: number) {
  return [[x0+W, y0-h], [x0+W-ix, y0-h+iy], [x0+W-ix, y0+iy], [x0+W, y0]].map(p => p.join(',')).join(' ');
}
function topCenterX(x0: number) { return x0 + W / 2 - ix / 4; }
function topCenterY(y0: number, h: number) { return y0 - h - iy / 2; }

// ============================================================
// CHART 1: 3D REVENUE ARCHITECTURE
// ============================================================
function RevenueArchitecture3D({ data, formatMoney }: { data: IntelligenceData; formatMoney: (n: number) => string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const zones = useMemo(() => consolidateZones(data.zone_revenue), [data.zone_revenue]);
  const maxRev = useMemo(() => Math.max(...zones.map(z => z.revenue), 1), [zones]);

  const bars = zones.map((z, i) => {
    const x0 = START_X + i * (W + GAP);
    const h = Math.max(6, (z.revenue / maxRev) * MAX_H);
    return { ...z, x0, h, idx: i };
  });

  // Bezier flow line through bar top-centers
  const pts2 = bars.map(b => ({ x: topCenterX(b.x0), y: topCenterY(BASE_Y, b.h) }));
  const flowPath = pts2.length > 1 ? pts2.map((p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const pr = pts2[i - 1];
    const mx = (pr.x + p.x) / 2;
    return `C ${mx.toFixed(1)} ${pr.y.toFixed(1)} ${mx.toFixed(1)} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(' ') : '';

  const sel = selected !== null ? bars[selected] : null;
  const totalRev = zones.reduce((s, z) => s + z.revenue, 0);

  const svgActualW = START_X + bars.length * (W + GAP) + 40;

  return (
    <div>
      <style>{`
        @keyframes revRise { from { transform: scaleY(0); transform-box: fill-box; transform-origin: bottom center; } to { transform: scaleY(1); } }
        @keyframes flowDraw { from { stroke-dashoffset: 3000; } to { stroke-dashoffset: 0; } }
        @keyframes dotPulse { 0%,100%{r:4px;opacity:.8} 50%{r:6px;opacity:1} }
        .rev-bar-g { animation: revRise 1s cubic-bezier(.34,1.56,.64,1) both; cursor: pointer; }
        .rev-bar-g:nth-child(1){animation-delay:.05s} .rev-bar-g:nth-child(2){animation-delay:.13s}
        .rev-bar-g:nth-child(3){animation-delay:.21s} .rev-bar-g:nth-child(4){animation-delay:.29s}
        .rev-bar-g:nth-child(5){animation-delay:.37s} .rev-bar-g:nth-child(6){animation-delay:.45s}
        .rev-flow { stroke-dasharray: 3000; animation: flowDraw 2.2s ease .6s both; }
      `}</style>

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: 3, marginBottom: 4 }}>3D REVENUE ARCHITECTURE · DEPARTMENT MATRIX</div>
          <div style={{ fontSize: 13, color: '#AAA', fontWeight: 300 }}>Each bar = department revenue · Gold flow line = revenue trajectory · Click bar for breakdown</div>
        </div>
        <div style={{ textAlign: 'right', padding: '10px 16px', background: 'rgba(212,175,55,.06)', border: '1px solid rgba(212,175,55,.2)', borderRadius: 10 }}>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: 2 }}>TOTAL PORTFOLIO</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: '#D4AF37' }}>{formatMoney(totalRev)}</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${Math.max(svgActualW, SVG_W)} ${SVG_H}`} style={{ width: '100%', overflow: 'visible' }}>
        <defs>
          {bars.map((b, i) => (
            <linearGradient key={i} id={`rg${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={b.color} stopOpacity=".95" />
              <stop offset="100%" stopColor={b.darkColor} stopOpacity=".8" />
            </linearGradient>
          ))}
          <linearGradient id="revFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0" />
            <stop offset="15%" stopColor="#D4AF37" stopOpacity="1" />
            <stop offset="85%" stopColor="#FFD700" stopOpacity="1" />
            <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
          </linearGradient>
          <filter id="revGlow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* Horizontal grid */}
        {[.25,.5,.75,1].map(pct => (
          <line key={pct} x1={40} y1={BASE_Y - pct * MAX_H} x2={Math.max(svgActualW, SVG_W) - 20} y2={BASE_Y - pct * MAX_H}
            stroke="rgba(255,255,255,.03)" strokeWidth="1" strokeDasharray="5,5" />
        ))}
        {[0,25,50,75,100].map(pct => (
          <text key={pct} x={36} y={BASE_Y - (pct/100)*MAX_H + 4} fill="rgba(255,255,255,.2)" fontSize="9" textAnchor="end" fontFamily="monospace">{pct}%</text>
        ))}

        {/* Bars */}
        {bars.map((b, i) => {
          const isHov = hovered === i || selected === i;
          const isSel = selected === i;
          const pct = totalRev > 0 ? ((b.revenue / totalRev) * 100).toFixed(1) : '0.0';
          return (
            <g key={i} className="rev-bar-g"
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              onClick={() => setSelected(isSel ? null : i)}
              style={{ filter: isHov ? `drop-shadow(0 0 18px ${b.color}99)` : 'none', transition: 'filter .25s' }}>
              {/* Right face */}
              <polygon points={rightFacePts(b.x0, BASE_Y, b.h)} fill={b.darkColor} opacity={isHov ? 1 : .85} />
              {/* Left face */}
              <polygon points={leftFacePts(b.x0, BASE_Y, b.h)} fill={`url(#rg${i})`} opacity={isHov ? 1 : .88} />
              {/* Top face */}
              <polygon points={topFacePts(b.x0, BASE_Y, b.h)} fill={b.color} opacity={isHov ? 1 : .92} />
              <polygon points={topFacePts(b.x0, BASE_Y, b.h)} fill="rgba(255,255,255,.12)" />
              {/* Top highlight stroke */}
              <polygon points={topFacePts(b.x0, BASE_Y, b.h)} fill="none" stroke={b.color} strokeWidth={isHov ? 1.5 : .5} opacity={isHov ? 1 : .4} />
              {/* Margin badge on bar face */}
              {b.h > 40 && (
                <text x={b.x0 + W/2 - ix/4} y={BASE_Y - b.h/2} fill="rgba(255,255,255,.9)" fontSize="10" textAnchor="middle" fontWeight="900" fontFamily="monospace">{b.margin}%</text>
              )}
              {/* Revenue % above */}
              <text x={b.x0 + W/2 - ix/4} y={BASE_Y - b.h - iy - 14} fill={b.color} fontSize="10" textAnchor="middle" fontWeight="900" fontFamily="monospace"
                style={{ filter: `drop-shadow(0 0 5px ${b.color})` }}>{pct}%</text>
              {/* Amount on hover */}
              {isHov && <text x={b.x0 + W/2 - ix/4} y={BASE_Y - b.h - iy - 26} fill="#FFF" fontSize="9" textAnchor="middle" fontFamily="monospace" opacity=".9">{formatMoney(b.revenue)}</text>}
              {/* Icon */}
              <text x={b.x0 + W/2 - ix/4} y={BASE_Y - b.h - iy - 38} fill={b.color} fontSize="14" textAnchor="middle">{b.icon}</text>
              {/* Label below */}
              <text x={b.x0 + W/2 - ix/4} y={BASE_Y + iy + 18} fill={b.color} fontSize="9" textAnchor="middle" fontWeight="700" fontFamily="monospace" letterSpacing="1">{b.shortLabel}</text>
              {/* Selected indicator */}
              {isSel && <polygon points={topFacePts(b.x0, BASE_Y, b.h)} fill="none" stroke="#FFF" strokeWidth="2" opacity=".4" />}
            </g>
          );
        })}

        {/* Gold flow line connecting bar tops */}
        {pts2.length > 1 && <>
          <path d={flowPath} fill="none" stroke="#D4AF37" strokeWidth="5" opacity=".15" strokeLinecap="round" />
          <path d={flowPath} fill="none" stroke="url(#revFlowGrad)" strokeWidth="2.5" opacity=".95" strokeLinecap="round" className="rev-flow" />
          {pts2.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={hovered === i ? 7 : 5}
              fill={bars[i]?.color || '#D4AF37'} opacity=".95"
              style={{ filter: `drop-shadow(0 0 8px ${bars[i]?.color || '#D4AF37'})`, transition: 'r .2s', cursor: 'pointer' }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              onClick={() => setSelected(selected === i ? null : i)} />
          ))}
        </>}

        {/* Baseline */}
        <line x1={40} y1={BASE_Y + iy + 2} x2={Math.max(svgActualW, SVG_W) - 20} y2={BASE_Y + iy + 2} stroke="rgba(212,175,55,.1)" strokeWidth="1" />
      </svg>

      {/* Detail panel */}
      {sel && (
        <div style={{ marginTop: 14, padding: '18px 22px', background: `${sel.color}0C`, border: `1px solid ${sel.color}40`, borderLeft: `4px solid ${sel.color}`, borderRadius: 14, animation: 'fadeSlideUp .3s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 6 }}>DIVISION</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: sel.color }}>{sel.icon} {sel.label}</div>
            </div>
            {[
              { l: 'REVENUE', v: formatMoney(sel.revenue), c: sel.color },
              { l: 'COGS', v: formatMoney(sel.cogs), c: '#FF3131' },
              { l: 'GROSS PROFIT', v: formatMoney(sel.profit), c: '#00FF88' },
              { l: 'MARGIN', v: `${sel.margin}%`, c: sel.margin > 50 ? '#00FF88' : sel.margin > 30 ? '#F59E0B' : '#FF3131' },
            ].map((m, i) => (
              <div key={i}>
                <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 6 }}>{m.l}</div>
                <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: m.c }}>{m.v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, height: 4, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${sel.revenue > 0 ? Math.max((sel.profit/sel.revenue)*100, 0) : 0}%`, background: `linear-gradient(90deg, ${sel.color}66, ${sel.color})`, borderRadius: 2, transition: 'width 1.2s ease' }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHART 2: 3D EXPENSE ARCHITECTURE
// ============================================================
function ExpenseArchitecture3D({ data, formatMoney }: { data: IntelligenceData; formatMoney: (n: number) => string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const zones = useMemo(() => consolidateZones(data.zone_revenue), [data.zone_revenue]);

  // Build expense bars: COGS per dept + payroll + maintenance
  const expBars = useMemo(() => {
    const cogsBars = zones.map(z => ({
      label: `${z.shortLabel} COGS`, shortLabel: z.shortLabel, icon: z.icon,
      color: z.color.replace('#', '#').slice(0, 7) + 'CC',
      darkColor: z.darkColor, amount: z.cogs,
      subcategory: 'Cost of Sales',
    }));
    const payroll = data.expenditure?.payroll ?? 0;
    const maint = data.expenditure?.maintenance ?? 0;
    const loyalty = data.expenditure?.loyalty ?? 0;
    cogsBars.push({ label: 'PAYROLL', shortLabel: 'PAY', icon: '👥', color: '#9D50BB', darkColor: '#5B2170', amount: payroll, subcategory: 'HR & Wages' });
    cogsBars.push({ label: 'MAINTENANCE', shortLabel: 'MAINT', icon: '🔧', color: '#778CA3', darkColor: '#3A4A57', amount: maint, subcategory: 'Repairs & Upkeep' });
    if (loyalty > 0) cogsBars.push({ label: 'MARKETING', shortLabel: 'MKT', icon: '📢', color: '#E91E63', darkColor: '#9B1040', amount: loyalty, subcategory: 'Promotions' });
    return cogsBars;
  }, [zones, data.expenditure]);

  const maxAmt = Math.max(...expBars.map(b => b.amount), 1);
  const totalExp = expBars.reduce((s, b) => s + b.amount, 0);

  const bars = expBars.map((z, i) => ({
    ...z, x0: START_X + i * (W + GAP), h: Math.max(6, (z.amount / maxAmt) * MAX_H), idx: i,
  }));
  const svgActualW = START_X + bars.length * (W + GAP) + 40;

  const pts2 = bars.map(b => ({ x: topCenterX(b.x0), y: topCenterY(BASE_Y, b.h) }));
  const flowPath = pts2.length > 1 ? pts2.map((p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const pr = pts2[i - 1];
    const mx = (pr.x + p.x) / 2;
    return `C ${mx.toFixed(1)} ${pr.y.toFixed(1)} ${mx.toFixed(1)} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(' ') : '';

  const sel = selected !== null ? bars[selected] : null;

  return (
    <div>
      <style>{`
        @keyframes expRise { from { transform: scaleY(0); transform-box: fill-box; transform-origin: bottom center; } to { transform: scaleY(1); } }
        @keyframes expFlowDraw { from { stroke-dashoffset: 3500; } to { stroke-dashoffset: 0; } }
        .exp-bar-g { animation: expRise 1s cubic-bezier(.34,1.56,.64,1) both; cursor: pointer; }
        .exp-bar-g:nth-child(1){animation-delay:.04s} .exp-bar-g:nth-child(2){animation-delay:.11s}
        .exp-bar-g:nth-child(3){animation-delay:.18s} .exp-bar-g:nth-child(4){animation-delay:.25s}
        .exp-bar-g:nth-child(5){animation-delay:.32s} .exp-bar-g:nth-child(6){animation-delay:.39s}
        .exp-bar-g:nth-child(7){animation-delay:.46s} .exp-bar-g:nth-child(8){animation-delay:.53s}
        .exp-flow { stroke-dasharray: 3500; animation: expFlowDraw 2.5s ease .8s both; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: 3, marginBottom: 4 }}>3D EXPENSE ARCHITECTURE · COST BURDEN MATRIX</div>
          <div style={{ fontSize: 13, color: '#AAA', fontWeight: 300 }}>Each bar = department cost burden · Red flow line = expense trajectory · Click bar for analysis</div>
        </div>
        <div style={{ textAlign: 'right', padding: '10px 16px', background: 'rgba(255,49,49,.05)', border: '1px solid rgba(255,49,49,.2)', borderRadius: 10 }}>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: 2 }}>TOTAL BURDEN</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: '#FF3131' }}>{formatMoney(totalExp)}</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${Math.max(svgActualW, SVG_W)} ${SVG_H}`} style={{ width: '100%', overflow: 'visible' }}>
        <defs>
          {bars.map((b, i) => (
            <linearGradient key={i} id={`eg${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={b.color} stopOpacity=".95" />
              <stop offset="100%" stopColor={b.darkColor} stopOpacity=".8" />
            </linearGradient>
          ))}
          <linearGradient id="expFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF3131" stopOpacity="0" />
            <stop offset="15%" stopColor="#FF3131" stopOpacity="1" />
            <stop offset="85%" stopColor="#FF8C00" stopOpacity="1" />
            <stop offset="100%" stopColor="#FF8C00" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[.25,.5,.75,1].map(pct => (
          <line key={pct} x1={40} y1={BASE_Y - pct * MAX_H} x2={Math.max(svgActualW, SVG_W) - 20} y2={BASE_Y - pct * MAX_H}
            stroke="rgba(255,49,49,.04)" strokeWidth="1" strokeDasharray="5,5" />
        ))}

        {bars.map((b, i) => {
          const isHov = hovered === i || selected === i;
          const isSel = selected === i;
          const pct = totalExp > 0 ? ((b.amount / totalExp) * 100).toFixed(1) : '0.0';
          return (
            <g key={i} className="exp-bar-g"
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              onClick={() => setSelected(isSel ? null : i)}
              style={{ filter: isHov ? `drop-shadow(0 0 16px ${b.color}88)` : 'none', transition: 'filter .25s' }}>
              <polygon points={rightFacePts(b.x0, BASE_Y, b.h)} fill={b.darkColor} opacity={isHov ? 1 : .85} />
              <polygon points={leftFacePts(b.x0, BASE_Y, b.h)} fill={`url(#eg${i})`} opacity={isHov ? 1 : .88} />
              <polygon points={topFacePts(b.x0, BASE_Y, b.h)} fill={b.color} opacity={isHov ? 1 : .92} />
              <polygon points={topFacePts(b.x0, BASE_Y, b.h)} fill="rgba(255,255,255,.08)" />
              {b.h > 40 && (
                <text x={b.x0 + W/2 - ix/4} y={BASE_Y - b.h/2} fill="rgba(255,255,255,.8)" fontSize="9" textAnchor="middle" fontWeight="900" fontFamily="monospace">{pct}%</text>
              )}
              <text x={b.x0 + W/2 - ix/4} y={BASE_Y - b.h - iy - 14} fill={b.color} fontSize="10" textAnchor="middle" fontWeight="900" fontFamily="monospace"
                style={{ filter: `drop-shadow(0 0 5px ${b.color})` }}>{pct}%</text>
              {isHov && <text x={b.x0 + W/2 - ix/4} y={BASE_Y - b.h - iy - 26} fill="#FFF" fontSize="9" textAnchor="middle" fontFamily="monospace" opacity=".9">{formatMoney(b.amount)}</text>}
              <text x={b.x0 + W/2 - ix/4} y={BASE_Y - b.h - iy - 38} fill={b.color} fontSize="14" textAnchor="middle">{b.icon}</text>
              <text x={b.x0 + W/2 - ix/4} y={BASE_Y + iy + 18} fill={b.color} fontSize="8" textAnchor="middle" fontWeight="700" fontFamily="monospace" letterSpacing=".5">{b.shortLabel}</text>
              {isSel && <polygon points={topFacePts(b.x0, BASE_Y, b.h)} fill="none" stroke="#FFF" strokeWidth="2" opacity=".4" />}
            </g>
          );
        })}

        {pts2.length > 1 && <>
          <path d={flowPath} fill="none" stroke="#FF3131" strokeWidth="5" opacity=".12" strokeLinecap="round" />
          <path d={flowPath} fill="none" stroke="url(#expFlowGrad)" strokeWidth="2.5" opacity=".95" strokeLinecap="round" className="exp-flow" />
          {pts2.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={hovered === i ? 7 : 5}
              fill={bars[i]?.color || '#FF3131'} opacity=".95"
              style={{ filter: `drop-shadow(0 0 8px ${bars[i]?.color || '#FF3131'})`, transition: 'r .2s', cursor: 'pointer' }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              onClick={() => setSelected(selected === i ? null : i)} />
          ))}
        </>}
        <line x1={40} y1={BASE_Y + iy + 2} x2={Math.max(svgActualW, SVG_W) - 20} y2={BASE_Y + iy + 2} stroke="rgba(255,49,49,.1)" strokeWidth="1" />
      </svg>

      {sel && (
        <div style={{ marginTop: 14, padding: '18px 22px', background: `${sel.color}0C`, border: `1px solid ${sel.color}40`, borderLeft: `4px solid ${sel.color}`, borderRadius: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 6 }}>COST CENTRE</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: sel.color }}>{sel.icon} {sel.label}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>{sel.subcategory}</div>
            </div>
            {[
              { l: 'AMOUNT', v: formatMoney(sel.amount), c: sel.color },
              { l: '% OF TOTAL', v: `${totalExp > 0 ? ((sel.amount / totalExp) * 100).toFixed(2) : 0}%`, c: '#F59E0B' },
              { l: 'RISK LEVEL', v: (sel.amount / totalExp) > 0.35 ? '🔴 HIGH' : (sel.amount / totalExp) > 0.2 ? '🟡 MED' : '🟢 LOW', c: '#FFF' },
            ].map((m, i) => (
              <div key={i}>
                <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 6 }}>{m.l}</div>
                <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: m.c }}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHART 3: EQUILIBRIUM MONITOR
// ============================================================
function EquilibriumMonitor({ data, formatMoney }: { data: IntelligenceData; formatMoney: (n: number) => string }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number; kind: 'rev' | 'exp' } | null>(null);
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 150); return () => clearTimeout(t); }, []);

  const EQ_W = 860, EQ_H = 340;
  const PAD = { top: 40, right: 30, bottom: 60, left: 90 };
  const CW = EQ_W - PAD.left - PAD.right;
  const CH = EQ_H - PAD.top - PAD.bottom;

  const zones = useMemo(() => consolidateZones(data.zone_revenue), [data.zone_revenue]);
  const totalRev = data.kpis.total_revenue;
  const totalExp = data.expenditure.total;
  const netPL = totalRev - totalExp;
  const isProfit = netPL >= 0;

  // Build equilibrium data points per department + totals
  const points = useMemo(() => {
    const pts: { label: string; revenue: number; expense: number; color: string }[] = zones.map(z => ({
      label: z.shortLabel, revenue: z.revenue, expense: z.cogs, color: z.color,
    }));
    pts.push({ label: 'PAYROLL', revenue: 0, expense: data.expenditure?.payroll ?? 0, color: '#9D50BB' });
    pts.push({ label: 'TOTAL', revenue: totalRev, expense: totalExp, color: '#D4AF37' });
    return pts;
  }, [zones, data.expenditure, totalRev, totalExp]);

  const maxVal = Math.max(...points.map(p => Math.max(p.revenue, p.expense)), 1);
  const n = points.length;
  const xScale = (i: number) => PAD.left + (i / (n - 1)) * CW;
  const yScale = (v: number) => PAD.top + CH - (v / maxVal) * CH;

  const revPts = points.map((p, i) => ({ x: xScale(i), y: yScale(p.revenue) }));
  const expPts = points.map((p, i) => ({ x: xScale(i), y: yScale(p.expense) }));

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => {
      if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      const pr = pts[i - 1];
      const mx = (pr.x + p.x) / 2;
      return `C ${mx.toFixed(1)} ${pr.y.toFixed(1)} ${mx.toFixed(1)} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(' ');

  const revPath = buildPath(revPts);
  const expPath = buildPath(expPts);

  // Profit / loss area (between lines)
  const areaPath = n > 1 ? [
    ...revPts.map((p, i) => i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : (() => { const pr = revPts[i-1]; const mx = (pr.x+p.x)/2; return `C ${mx.toFixed(1)} ${pr.y.toFixed(1)} ${mx.toFixed(1)} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`; })()),
    ...[...expPts].reverse().map((p, i) => i === 0 ? `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    'Z',
  ].join(' ') : '';

  // Y-axis grid values
  const yTicks = [0, .25, .5, .75, 1];

  return (
    <div>
      {/* Status Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderRadius: 14, marginBottom: 20, background: isProfit ? 'rgba(0,255,136,.04)' : 'rgba(255,49,49,.04)', border: `1px solid ${isProfit ? '#00FF8820' : '#FF313120'}` }}>
        <div>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: 3, marginBottom: 4 }}>FINANCIAL EQUILIBRIUM STATUS</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: isProfit ? '#00FF88' : '#FF3131' }}>
            {isProfit ? '✅ PROFITABLE — Revenue exceeds total expenditure' : '⚠️ DEFICIT — Expenditure exceeds revenue · Action required'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {[
            { l: 'REVENUE', v: formatMoney(totalRev), c: '#D4AF37' },
            { l: 'EXPENSES', v: formatMoney(totalExp), c: '#FF3131' },
            { l: 'NET P&L', v: (isProfit ? '+' : '') + formatMoney(netPL), c: isProfit ? '#00FF88' : '#FF3131' },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: '#555', letterSpacing: 2 }}>{m.l}</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: m.c, textShadow: `0 0 16px ${m.c}55` }}>{m.v}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes eqDraw { from { stroke-dashoffset: 4000; } to { stroke-dashoffset: 0; } }
        .eq-rev-line { stroke-dasharray: 4000; animation: eqDraw 2s ease .3s both; }
        .eq-exp-line { stroke-dasharray: 4000; animation: eqDraw 2s ease .5s both; }
      `}</style>

      <svg viewBox={`0 0 ${EQ_W} ${EQ_H}`} style={{ width: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id="profitArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00FF88" stopOpacity=".3" />
            <stop offset="100%" stopColor="#00FF88" stopOpacity=".02" />
          </linearGradient>
          <linearGradient id="lossArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF3131" stopOpacity=".3" />
            <stop offset="100%" stopColor="#FF3131" stopOpacity=".02" />
          </linearGradient>
          <filter id="eqGlowG"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="eqGlowR"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* Grid */}
        {yTicks.map(pct => {
          const y = PAD.top + CH - pct * CH;
          const val = pct * maxVal;
          return (
            <g key={pct}>
              <line x1={PAD.left} y1={y} x2={EQ_W - PAD.right} y2={y} stroke="rgba(255,255,255,.04)" strokeWidth="1" strokeDasharray="4,6" />
              <text x={PAD.left - 10} y={y + 4} fill="rgba(255,255,255,.22)" fontSize="9" textAnchor="end" fontFamily="monospace">{val > 999 ? `${(val/1000).toFixed(0)}k` : val.toFixed(0)}</text>
            </g>
          );
        })}

        {/* X labels */}
        {points.map((p, i) => (
          <text key={i} x={xScale(i)} y={EQ_H - PAD.bottom + 20} fill={i === n-1 ? '#D4AF37' : 'rgba(255,255,255,.4)'}
            fontSize={i === n-1 ? 10 : 9} textAnchor="middle" fontFamily="monospace" fontWeight={i === n-1 ? '900' : '700'} letterSpacing="1">
            {p.label.substring(0, 7).toUpperCase()}
          </text>
        ))}

        {/* Equilibrium zero line */}
        <line x1={PAD.left} y1={yScale(0)} x2={EQ_W - PAD.right} y2={yScale(0)} stroke="rgba(255,255,255,.08)" strokeWidth="1" />

        {/* Area fill */}
        {animated && areaPath && <path d={areaPath} fill={isProfit ? 'url(#profitArea)' : 'url(#lossArea)'} />}

        {/* Expense line */}
        {animated && <>
          <path d={expPath} fill="none" stroke="#FF3131" strokeWidth="4" opacity=".15" strokeLinecap="round" />
          <path d={expPath} fill="none" stroke="#FF3131" strokeWidth="2.5" opacity=".9" strokeLinecap="round" className="eq-exp-line" style={{ filter: 'drop-shadow(0 0 8px #FF313166)' }} />
        </>}

        {/* Revenue line */}
        {animated && <>
          <path d={revPath} fill="none" stroke="#D4AF37" strokeWidth="5" opacity=".15" strokeLinecap="round" />
          <path d={revPath} fill="none" stroke="#D4AF37" strokeWidth="3" opacity="1" strokeLinecap="round" className="eq-rev-line" style={{ filter: 'drop-shadow(0 0 10px #D4AF3788)' }} />
        </>}

        {/* Revenue data points */}
        {animated && revPts.map((p, i) => (
          <circle key={`r${i}`} cx={p.x} cy={p.y} r={tooltip?.idx === i && tooltip?.kind === 'rev' ? 8 : 6}
            fill="#D4AF37" opacity=".95" style={{ cursor: 'pointer', filter: 'drop-shadow(0 0 8px #D4AF37)', transition: 'r .2s' }}
            onMouseEnter={() => setTooltip({ x: p.x, y: p.y, idx: i, kind: 'rev' })}
            onMouseLeave={() => setTooltip(null)} />
        ))}

        {/* Expense data points */}
        {animated && expPts.map((p, i) => (
          <circle key={`e${i}`} cx={p.x} cy={p.y} r={tooltip?.idx === i && tooltip?.kind === 'exp' ? 7 : 5}
            fill="#FF3131" opacity=".9" style={{ cursor: 'pointer', filter: 'drop-shadow(0 0 7px #FF3131)', transition: 'r .2s' }}
            onMouseEnter={() => setTooltip({ x: p.x, y: p.y, idx: i, kind: 'exp' })}
            onMouseLeave={() => setTooltip(null)} />
        ))}

        {/* Equilibrium crossover marker */}
        {animated && isProfit && (
          <g transform={`translate(${xScale(n - 1) - 12}, ${yScale(totalRev) - 8})`}>
            <text fontSize="16" fill="#D4AF37" style={{ filter: 'drop-shadow(0 0 8px #D4AF37)' }}>⭐</text>
          </g>
        )}

        {/* Tooltip */}
        {tooltip !== null && points[tooltip.idx] && (
          <g>
            <rect x={tooltip.x - 80} y={tooltip.y - 72} width={160} height={64} rx={10}
              fill="rgba(4,4,16,.97)" stroke={tooltip.kind === 'rev' ? '#D4AF3755' : '#FF313155'} strokeWidth="1" />
            <text x={tooltip.x} y={tooltip.y - 54} fill={tooltip.kind === 'rev' ? '#D4AF37' : '#FF3131'} fontSize="10" textAnchor="middle" fontFamily="monospace" fontWeight="900">
              {points[tooltip.idx].label.toUpperCase()}
            </text>
            <text x={tooltip.x} y={tooltip.y - 38} fill="#00FF88" fontSize="9" textAnchor="middle" fontFamily="monospace">
              REV: {formatMoney(points[tooltip.idx].revenue)}
            </text>
            <text x={tooltip.x} y={tooltip.y - 24} fill="#FF3131" fontSize="9" textAnchor="middle" fontFamily="monospace">
              EXP: {formatMoney(points[tooltip.idx].expense)}
            </text>
            <text x={tooltip.x} y={tooltip.y - 12} fill={points[tooltip.idx].revenue >= points[tooltip.idx].expense ? '#00FF88' : '#FF3131'} fontSize="9" textAnchor="middle" fontFamily="monospace">
              P&L: {formatMoney(points[tooltip.idx].revenue - points[tooltip.idx].expense)}
            </text>
          </g>
        )}

        {/* Legend */}
        <g transform={`translate(${PAD.left}, ${EQ_H - 14})`}>
          <circle cx={0} cy={0} r={5} fill="#D4AF37" />
          <text x={12} y={4} fill="#D4AF37" fontSize="10" fontFamily="monospace" fontWeight="700">REVENUE</text>
          <circle cx={100} cy={0} r={5} fill="#FF3131" />
          <text x={112} y={4} fill="#FF3131" fontSize="10" fontFamily="monospace" fontWeight="700">EXPENSES</text>
          <rect x={220} y={-5} width={10} height={10} fill={isProfit ? 'rgba(0,255,136,.4)' : 'rgba(255,49,49,.4)'} rx={2} />
          <text x={234} y={4} fill={isProfit ? '#00FF88' : '#FF3131'} fontSize="10" fontFamily="monospace" fontWeight="700">{isProfit ? 'PROFIT ZONE' : 'DEFICIT ZONE'}</text>
        </g>
      </svg>

      {/* Bottom KPI strips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
        {[
          { l: 'GROSS PROFIT MARGIN', v: `${data.kpis.gross_operating_profit}%`, c: '#00F2FF' },
          { l: 'NET PROFIT MARGIN', v: `${data.kpis.net_profit_margin}%`, c: '#00FF88' },
          { l: 'COGS RATIO', v: `${data.kpis.cogs_ratio}%`, c: '#F59E0B' },
          { l: 'DEFERRED REVENUE', v: formatMoney(data.deferred_revenue), c: '#9D50BB' },
        ].map((m, i) => (
          <div key={i} style={{ padding: '14px 18px', background: `${m.c}08`, border: `1px solid ${m.c}22`, borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 6 }}>{m.l}</div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: m.c }}>{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Strip ───────────────────────────────────────────────
function KPICard({ label, value, sub, color, prefix = '', suffix = '' }: { label: string; value: number; sub?: string; color: string; prefix?: string; suffix?: string }) {
  const animated = useCountUp(value);
  return (
    <div style={{ background: 'rgba(255,255,255,.02)', border: `1px solid ${color}33`, borderRadius: 16, padding: '22px 18px', position: 'relative', overflow: 'hidden', boxShadow: `0 0 28px ${color}0A`, transition: 'transform .3s, box-shadow .3s', cursor: 'default' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 36px ${color}30`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 28px ${color}0A`; }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div style={{ fontSize: 10, color: '#666', fontWeight: 900, letterSpacing: 2, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'monospace', color, textShadow: `0 0 18px ${color}55` }}>
        {prefix}{suffix === '%' ? animated.toFixed(1) : Math.round(animated).toLocaleString()}{suffix}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#555', marginTop: 6, fontWeight: 700 }}>{sub}</div>}
    </div>
  );
}

// ─── Forecast ────────────────────────────────────────────────
function ForecastChart({ forecast, formatMoney }: { forecast: ForecastPoint[]; formatMoney: (n: number) => string }) {
  const maxVal = Math.max(...forecast.map(f => f.projected), 1);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 180, marginBottom: 16 }}>
      {forecast.map((f, i) => {
        const pct = (f.projected / maxVal) * 100;
        const color = f.is_actual ? '#D4AF37' : `hsl(${185 + i * 14}, 80%, 55%)`;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color, fontWeight: 700 }}>{formatMoney(f.projected).replace(/[^\d,.$€£৳]/g, '')}</div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 130 }}>
              <div style={{ width: '100%', height: `${pct}%`, background: f.is_actual ? 'linear-gradient(180deg,#D4AF37,#A07820)' : `linear-gradient(180deg,${color}CC,${color}44)`, borderRadius: '6px 6px 2px 2px', boxShadow: `0 0 10px ${color}44`, border: f.is_actual ? '1px solid #D4AF3766' : `1px solid ${color}33`, transition: `height 1.2s cubic-bezier(.16,1,.3,1) ${i*.1}s`, position: 'relative' }}>
                {f.is_actual && <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: '#000', fontWeight: 900, background: '#D4AF37', padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>ACTUAL</div>}
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#666', fontWeight: 700, letterSpacing: '.5px' }}>{f.month}</div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function FinancialIntelligenceHub(props: Props) {
  const { formatMoney, currencySymbol } = useCurrencyLang();
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [hotelKpis, setHotelKpis] = useState<HotelKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setIsRefreshing(true);
    try {
      const [fiRes, kpiRes] = await Promise.allSettled([
        fetch(`${BASE}/accounting/financial-intelligence`),
        fetch(`${BASE}/accounting/hotel-kpis`),
      ]);
      if (fiRes.status === 'fulfilled' && fiRes.value.ok) {
        const d = await fiRes.value.json();
        if (d.status === 'SUCCESS') { setData(d); setError(null); }
        else setError('Intelligence feed returned an error.');
      } else if (!silent) setError('Cannot reach the Financial Intelligence Kernel.');
      if (kpiRes.status === 'fulfilled' && kpiRes.value.ok) {
        const k = await kpiRes.value.json();
        if (k.status === 'SUCCESS') setHotelKpis(k.data);
      }
      setLastUpdated(new Date());
    } catch { if (!silent) setError('Cannot reach the Financial Intelligence Kernel.'); }
    finally { setLoading(false); setIsRefreshing(false); }
  }, [BASE]);

  useEffect(() => { fetchAll(false); }, [fetchAll]);
  useEffect(() => { const iv = setInterval(() => fetchAll(true), 30000); return () => clearInterval(iv); }, [fetchAll]);

  const PANELS = [
    { id: 0, label: '📊 REVENUE ARCH' },
    { id: 1, label: '📉 EXPENSE ARCH' },
    { id: 2, label: '⚖️ EQUILIBRIUM' },
    { id: 3, label: '🎯 KPI MATRIX' },
    { id: 4, label: '🔮 FORECAST' },
  ];

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fiPulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #D4AF3733', borderTop: '3px solid #D4AF37', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 11, color: '#555', letterSpacing: 3 }}>LOADING INTELLIGENCE FEED...</div>
    </div>
  );

  if (error || !data) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#FF3131', fontSize: 13, border: '1px solid #FF313133', borderRadius: 16, background: 'rgba(255,49,49,.05)' }}>
      {error || 'No data. Run transactions to populate the intelligence feed.'}
      <div style={{ marginTop: 16 }}>
        <button onClick={() => fetchAll(false)} style={{ padding: '8px 20px', background: 'rgba(255,49,49,.1)', border: '1px solid #FF313144', borderRadius: 8, color: '#FF3131', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>↺ RETRY CONNECTION</button>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes fadeSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fiPulse{0%,100%{opacity:1}50%{opacity:.4}}
        .fi-panel{animation:fadeSlideUp .45s ease forwards}
        .fi-tab{background:none;border:1px solid rgba(255,255,255,.07);color:#555;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:10px;font-weight:900;letter-spacing:1.5px;transition:all .2s;white-space:nowrap}
        .fi-tab.active{border-color:#D4AF37;color:#D4AF37;background:rgba(212,175,55,.08);box-shadow:0 0 14px rgba(212,175,55,.15)}
        .fi-tab:hover:not(.active){border-color:rgba(255,255,255,.15);color:#AAA}
      `}</style>

      {/* Live Status Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '12px 16px', background: 'rgba(0,255,136,.03)', border: '1px solid rgba(0,255,136,.08)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: isRefreshing ? '#F59E0B' : '#00FF88', boxShadow: `0 0 10px ${isRefreshing ? '#F59E0B' : '#00FF88'}`, animation: 'fiPulse 1.5s infinite' }} />
          <span style={{ fontSize: 9, color: isRefreshing ? '#F59E0B' : '#00FF88', fontWeight: 900, letterSpacing: 2 }}>{isRefreshing ? 'SYNCING...' : 'LIVE · 30s POLL'}</span>
          {lastUpdated && <span style={{ fontSize: 9, color: '#444', marginLeft: 6 }}>{lastUpdated.toLocaleTimeString()}</span>}
        </div>
        <button onClick={() => fetchAll(true)} style={{ padding: '5px 14px', background: 'rgba(0,242,255,.05)', border: '1px solid rgba(0,242,255,.2)', borderRadius: 6, color: '#00F2FF', cursor: 'pointer', fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>↺ FORCE SYNC</button>
      </div>

      {/* Hotel KPIs strip */}
      {hotelKpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 24 }}>
          {[
            { l: 'OCCUPANCY', v: `${hotelKpis.occupancy_pct.toFixed(1)}%`, c: hotelKpis.occupancy_pct >= 80 ? '#00FF88' : hotelKpis.occupancy_pct >= 60 ? '#F59E0B' : '#FF3131', i: '🏨' },
            { l: 'ADR', v: formatMoney(hotelKpis.adr), c: '#D4AF37', i: '💰' },
            { l: 'RevPAR', v: formatMoney(hotelKpis.revpar), c: '#00F2FF', i: '📊' },
            { l: 'IN-HOUSE', v: `${hotelKpis.in_house_guests} guests`, c: '#9D50BB', i: '👥' },
            { l: 'ROOMS SOLD', v: `${hotelKpis.occupied_rooms}/${hotelKpis.total_rooms}`, c: '#FF8C00', i: '🚪' },
          ].map((it, i) => (
            <div key={i} style={{ padding: '12px 14px', background: `${it.c}08`, border: `1px solid ${it.c}22`, borderRadius: 10 }}>
              <div style={{ fontSize: 9, color: '#555', fontWeight: 900, letterSpacing: 2 }}>{it.i} {it.l}</div>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: it.c, marginTop: 4 }}>{it.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* GL KPI Scorecard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 28 }}>
        <KPICard label="TOTAL REVENUE" value={Math.round(data.kpis.total_revenue)} color="#D4AF37" prefix={currencySymbol} sub="All zones · GL live" />
        <KPICard label="NET PROFIT" value={Math.round(data.kpis.net_profit)} color="#00FF88" prefix={currencySymbol} sub="Bottom line" />
        <KPICard label="NET MARGIN" value={data.kpis.net_profit_margin} color="#00F2FF" suffix="%" sub="After all costs" />
        <KPICard label="DEFERRED REV" value={Math.round(data.deferred_revenue)} color="#9D50BB" prefix={currencySymbol} sub="Advance deposits" />
        <KPICard label="VAT LIABILITY" value={Math.round(data.tax_collected.real_vat_liability)} color="#F59E0B" prefix={currencySymbol} sub="Payable to Gov" />
        <KPICard label="OTA COMMISSIONS" value={Math.round(data.ota_commissions)} color="#FF3131" prefix={currencySymbol} sub="OTA expense" />
      </div>

      {/* Panel Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {PANELS.map(p => (
          <button key={p.id} className={`fi-tab ${activePanel === p.id ? 'active' : ''}`} onClick={() => setActivePanel(p.id)}>{p.label}</button>
        ))}
      </div>

      {/* Panel 0: Revenue Architecture */}
      {activePanel === 0 && (
        <div className="fi-panel" style={{ background: 'rgba(255,255,255,.015)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 20, padding: 28 }}>
          <RevenueArchitecture3D data={data} formatMoney={formatMoney} />
        </div>
      )}

      {/* Panel 1: Expense Architecture */}
      {activePanel === 1 && (
        <div className="fi-panel" style={{ background: 'rgba(255,255,255,.015)', border: '1px solid rgba(255,49,49,.08)', borderRadius: 20, padding: 28 }}>
          <ExpenseArchitecture3D data={data} formatMoney={formatMoney} />
        </div>
      )}

      {/* Panel 2: Equilibrium Monitor */}
      {activePanel === 2 && (
        <div className="fi-panel" style={{ background: 'rgba(255,255,255,.015)', border: '1px solid rgba(212,175,55,.08)', borderRadius: 20, padding: 28 }}>
          <EquilibriumMonitor data={data} formatMoney={formatMoney} />
        </div>
      )}

      {/* Panel 3: KPI Matrix (zone breakdown) */}
      {activePanel === 3 && (
        <div className="fi-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {data.zone_revenue.map((z, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,.02)', border: `1px solid ${z.color}33`, borderRadius: 20, padding: '26px 20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,transparent,${z.color},transparent)` }} />
              <div style={{ fontSize: 10, color: z.color, fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}>{z.zone}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                {[['REVENUE', z.revenue, z.color], ['COGS', z.cogs, '#FF3131'], ['PROFIT', z.profit, '#00FF88']].map(([l, v, c]) => (
                  <div key={l as string}>
                    <div style={{ fontSize: 9, color: '#444', letterSpacing: 1 }}>{l}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: c as string }}>{formatMoney(v as number)}</div>
                  </div>
                ))}
                <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#555', letterSpacing: 1 }}>MARGIN</span>
                  <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: z.margin > 50 ? '#00FF88' : z.margin > 30 ? '#F59E0B' : '#FF3131' }}>{z.margin}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panel 4: Forecast */}
      {activePanel === 4 && (
        <div className="fi-panel" style={{ background: 'rgba(255,255,255,.015)', border: '1px solid rgba(0,242,255,.1)', borderRadius: 20, padding: 36 }}>
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 18, color: '#FFF', fontWeight: 300, marginBottom: 6 }}>Financial Forecast Engine</div>
              <div style={{ fontSize: 11, color: '#444', letterSpacing: 1 }}>6-month revenue projection — linear model with seasonal adjustment</div>
            </div>
            <div style={{ padding: '12px 20px', background: 'rgba(0,242,255,.05)', border: '1px solid rgba(0,242,255,.15)', borderRadius: 10 }}>
              <div style={{ fontSize: 9, color: '#555', letterSpacing: 1 }}>CONFIDENCE</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#00F2FF' }}>HIGH</div>
            </div>
          </div>
          <ForecastChart forecast={data.forecast} formatMoney={formatMoney} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 20 }}>
            {[
              { l: 'BASE PROJECTION', v: data.forecast[2]?.projected, c: '#00F2FF' },
              { l: 'OPTIMISTIC (+15%)', v: (data.forecast[2]?.projected || 0) * 1.15, c: '#00FF88' },
              { l: 'PESSIMISTIC (−10%)', v: (data.forecast[2]?.projected || 0) * 0.9, c: '#F59E0B' },
            ].map((m, i) => (
              <div key={i} style={{ padding: '14px', background: 'rgba(255,255,255,.02)', borderRadius: 12, border: `1px solid ${m.c}22`, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 8 }}>{m.l}</div>
                <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: m.c }}>{formatMoney(m.v || 0)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
