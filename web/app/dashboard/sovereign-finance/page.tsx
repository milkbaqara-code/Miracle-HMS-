'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');

// ── TYPES ────────────────────────────────────────────────────────────────────
interface BenfordDigit {
  digit: number; observed: number; observed_pct: number;
  expected_pct: number; deviation: number; is_anomalous: boolean;
}
interface BenfordData {
  total_samples: number; chi_squared: number; chi_squared_critical: number;
  anomaly_level: 'NORMAL' | 'ELEVATED' | 'WARNING' | 'CRITICAL' | 'INSUFFICIENT_DATA';
  anomalous_digits: number[];
  digit_distribution: Record<string, BenfordDigit>;
  scanned_at: string;
}
interface WeekBucket { week: number; label: string; inflow: number; outflow: number; net: number; }
interface TreasuryData {
  baseline_cash: number; projected_inflow_90d: number;
  projected_outflow_90d: number; net_90d_position: number;
  liquidity_health: 'STRONG' | 'HEALTHY' | 'TIGHT' | 'CRITICAL';
  payroll_monthly_burn: number;
  weekly_projection: WeekBucket[];
  top_inflows: { source: string; amount: number }[];
  top_outflows: { source: string; amount: number }[];
}
interface FeedEntry {
  id: number; timestamp: string; description: string;
  reference_type: string; posted_by: string; currency: string;
  amount: number; is_balanced: boolean; verification_status: string;
  debit_account: { code: number; name: string; type: string } | null;
  credit_account: { code: number; name: string; type: string } | null;
}
interface FeedData {
  count: number; balanced_count: number; unbalanced_count: number;
  integrity: 'SOVEREIGN' | 'BREACHED'; feed: FeedEntry[];
}
interface APARBucket {
  total: number; overdue: number; due_30d: number; due_60d: number; due_90d: number;
  items: { ref?: string; vendor?: string; client?: string; ota?: string; amount: number; due_date: string; is_overdue: boolean }[];
}
interface APARData { ap: APARBucket; ar: APARBucket; net_working_capital: number; }

// ── UTILS ────────────────────────────────────────────────────────────────────
const fmt = (n: number, decimals = 2) => {
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
};
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return fmt(n, 0);
};

const ANOMALY_COLORS: Record<string, string> = {
  NORMAL: '#00FF88', ELEVATED: '#F59E0B', WARNING: '#FF8C00', CRITICAL: '#FF3131',
  INSUFFICIENT_DATA: '#555',
};
const HEALTH_COLORS: Record<string, string> = {
  STRONG: '#00FF88', HEALTHY: '#00F2FF', TIGHT: '#F59E0B', CRITICAL: '#FF3131',
};
const REF_COLORS: Record<string, string> = {
  'AGI-REVENUE': '#00FF88', 'AGI-EXPENSE': '#FF3131', 'AGI-ASSET': '#00F2FF',
  'AGI-LIABILITY': '#F59E0B', 'AGI-EQUITY': '#9D00FF', 'AGI-TAX': '#FF6B9D',
  'VOUCHER': '#D4AF37', 'STOCK_PURCHASE': '#FF8C00', 'POS_SALE': '#00FF88',
};

// ── BENFORD CHART ────────────────────────────────────────────────────────────
function BenfordChart({ data }: { data: BenfordData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  const digits = [1,2,3,4,5,6,7,8,9];
  const maxPct = 32;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, color: '#555', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 900 }}>
            Engine 11 · Continuous Auditor
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FFF', marginTop: 4 }}>Benford Anomaly Radar</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 11, fontWeight: 900, letterSpacing: 1.5, padding: '6px 14px',
            borderRadius: 8, border: `1px solid ${ANOMALY_COLORS[data.anomaly_level] || '#555'}`,
            background: `${ANOMALY_COLORS[data.anomaly_level] || '#555'}18`,
            color: ANOMALY_COLORS[data.anomaly_level] || '#555',
          }}>
            {data.anomaly_level}
          </div>
          <div style={{ fontSize: 9, color: '#444', marginTop: 4, fontFamily: 'Courier New, monospace' }}>
            χ² = {data.chi_squared.toFixed(3)} / crit {data.chi_squared_critical}
          </div>
          <div style={{ fontSize: 9, color: '#333', marginTop: 2 }}>
            {data.total_samples.toLocaleString()} samples
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 6, alignItems: 'flex-end', height: 160 }}>
        {digits.map(d => {
          const dist = data.digit_distribution[d];
          if (!dist) return <div key={d} />;
          const obsH = mounted ? (dist.observed_pct / maxPct) * 140 : 0;
          const expH = (dist.expected_pct / maxPct) * 140;
          const color = dist.is_anomalous ? '#FF3131' : '#D4AF37';
          return (
            <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {/* Bars container */}
              <div style={{ position: 'relative', width: '100%', height: 140, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                {/* Expected ghost bar */}
                <div style={{
                  position: 'absolute', bottom: 0, width: '60%',
                  height: expH, background: 'rgba(255,255,255,0.06)',
                  borderRadius: '4px 4px 0 0',
                  border: '1px dashed rgba(255,255,255,0.1)',
                }} />
                {/* Actual bar */}
                <div style={{
                  position: 'absolute', bottom: 0, width: '40%',
                  height: obsH,
                  background: `linear-gradient(180deg, ${color}cc, ${color}44)`,
                  boxShadow: dist.is_anomalous ? `0 0 14px ${color}88` : `0 0 6px ${color}44`,
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 1.2s cubic-bezier(0.16,1,0.3,1)',
                }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 900, color: dist.is_anomalous ? '#FF3131' : '#888' }}>{d}</div>
              <div style={{ fontSize: 8, color: dist.is_anomalous ? '#FF3131' : '#444', fontFamily: 'Courier New, monospace' }}>
                {dist.observed_pct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#555' }}>
          <div style={{ width: 12, height: 8, border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} />
          EXPECTED (BENFORD)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#555' }}>
          <div style={{ width: 12, height: 8, background: '#D4AF3788', borderRadius: 2 }} />
          ACTUAL (LEDGER)
        </div>
        {data.anomalous_digits.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#FF3131' }}>
            <div style={{ width: 12, height: 8, background: '#FF313188', borderRadius: 2 }} />
            ANOMALOUS DIGIT ({data.anomalous_digits.join(', ')})
          </div>
        )}
      </div>
    </div>
  );
}

// ── TREASURY PROJECTION ───────────────────────────────────────────────────────
function TreasuryRadar({ data }: { data: TreasuryData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 200); return () => clearTimeout(t); }, []);

  const hColor = HEALTH_COLORS[data.liquidity_health] || '#00F2FF';
  const weeks = data.weekly_projection.slice(0, 8); // show first 8 weeks
  const maxVal = Math.max(...weeks.map(w => Math.max(w.inflow, w.outflow)), 1);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, color: '#555', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 900 }}>
            Engine 12 · Treasury Intelligence
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FFF', marginTop: 4 }}>90-Day Liquidity Radar</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 11, fontWeight: 900, letterSpacing: 1.5, padding: '6px 14px',
            borderRadius: 8, border: `1px solid ${hColor}`,
            background: `${hColor}18`, color: hColor,
          }}>
            {data.liquidity_health}
          </div>
          <div style={{ fontSize: 9, color: '#444', marginTop: 4, fontFamily: 'Courier New, monospace' }}>
            Net 90d: {data.net_90d_position >= 0 ? '+' : ''}{fmtShort(data.net_90d_position)}
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'INFLOW 90D', value: fmtShort(data.projected_inflow_90d), color: '#00FF88' },
          { label: 'OUTFLOW 90D', value: fmtShort(data.projected_outflow_90d), color: '#FF3131' },
          { label: 'PAYROLL/MO', value: fmtShort(data.payroll_monthly_burn), color: '#F59E0B' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 8, color: '#444', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 900 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Courier New, monospace', color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Weekly Bar Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: 4, alignItems: 'flex-end', height: 120 }}>
        {weeks.map(w => {
          const inH = mounted ? Math.max(4, (w.inflow / maxVal) * 100) : 4;
          const outH = mounted ? Math.max(4, (w.outflow / maxVal) * 100) : 4;
          return (
            <div key={w.week} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
                <div style={{
                  width: 8, height: inH,
                  background: 'linear-gradient(180deg, #00FF88cc, #00FF8844)',
                  boxShadow: '0 0 6px #00FF8844', borderRadius: '2px 2px 0 0',
                  transition: 'height 1.2s cubic-bezier(0.16,1,0.3,1)',
                }} />
                <div style={{
                  width: 8, height: outH,
                  background: 'linear-gradient(180deg, #FF3131cc, #FF313144)',
                  boxShadow: '0 0 6px #FF313144', borderRadius: '2px 2px 0 0',
                  transition: 'height 1.2s cubic-bezier(0.16,1,0.3,1)',
                }} />
              </div>
              <div style={{ fontSize: 7, color: '#333', textAlign: 'center', lineHeight: 1.2 }}>W{w.week}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
        <span style={{ fontSize: 8, color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, background: '#00FF88', borderRadius: 1, display: 'inline-block' }} />IN
        </span>
        <span style={{ fontSize: 8, color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, background: '#FF3131', borderRadius: 1, display: 'inline-block' }} />OUT
        </span>
      </div>
    </div>
  );
}

// ── LIVE FEED ─────────────────────────────────────────────────────────────────
function LiveFeed({ data }: { data: FeedData }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const getRefColor = (ref: string) => {
    for (const key in REF_COLORS) {
      if (ref?.startsWith(key) || ref === key) return REF_COLORS[key];
    }
    return '#555';
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: '#555', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 900 }}>Engine 13 · Intelligence Stream</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FFF', marginTop: 4 }}>Live Journal Feed</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="s-pulse" style={{ background: data.integrity === 'SOVEREIGN' ? '#00FF88' : '#FF3131', boxShadow: `0 0 8px ${data.integrity === 'SOVEREIGN' ? '#00FF88' : '#FF3131'}` }} />
          <span style={{ fontSize: 9, color: data.integrity === 'SOVEREIGN' ? '#00FF88' : '#FF3131', fontWeight: 900, letterSpacing: 1 }}>
            {data.integrity}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'ENTRIES', value: data.count, color: '#D4AF37' },
          { label: 'BALANCED', value: data.balanced_count, color: '#00FF88' },
          { label: 'UNBALANCED', value: data.unbalanced_count, color: data.unbalanced_count > 0 ? '#FF3131' : '#333' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 7, color: '#444', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 900 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: 'Courier New, monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Feed Stream */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.feed.map((entry, i) => {
          const rc = getRefColor(entry.reference_type || '');
          return (
            <div key={entry.id} className="live-entry" style={{
              background: 'rgba(255,255,255,0.015)',
              border: `1px solid rgba(255,255,255,0.04)`,
              borderLeft: `2px solid ${rc}`,
              borderRadius: 8,
              padding: '8px 12px',
              animationDelay: `${i * 0.04}s`,
              transition: 'background 0.2s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 8, color: rc, fontWeight: 900, letterSpacing: 1 }}>#{entry.id}</span>
                    <span style={{ fontSize: 8, color: '#444', background: `${rc}18`, border: `1px solid ${rc}33`, borderRadius: 4, padding: '1px 6px', fontWeight: 900 }}>
                      {entry.reference_type || 'JOURNAL'}
                    </span>
                    {!entry.is_balanced && (
                      <span style={{ fontSize: 8, color: '#FF3131', fontWeight: 900 }}>⚠ UNBALANCED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.description || '—'}
                  </div>
                  {entry.debit_account && (
                    <div style={{ fontSize: 8, color: '#333', marginTop: 2, fontFamily: 'Courier New, monospace' }}>
                      Dr [{entry.debit_account.code}] {entry.debit_account.name}
                      {entry.credit_account && ` → Cr [${entry.credit_account.code}]`}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: rc, fontFamily: 'Courier New, monospace' }}>
                    {entry.currency} {fmt(entry.amount)}
                  </div>
                  <div style={{ fontSize: 8, color: '#333', marginTop: 2 }}>
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AP/AR MATRIX ──────────────────────────────────────────────────────────────
function APARMatrix({ data }: { data: APARData }) {
  if (!data || !data.ap || !data.ar) return null;
  const netColor = data.net_working_capital >= 0 ? '#00FF88' : '#FF3131';

  const AgingBar = ({ ap, ar }: { ap: APARBucket; ar: APARBucket }) => {
    const maxVal = Math.max(ap.total, ar.total, 1);
    const buckets = [
      { key: 'overdue', label: 'OVERDUE', apColor: '#FF3131', arColor: '#FF6B9D' },
      { key: 'due_30d', label: '0–30d', apColor: '#F59E0B', arColor: '#D4AF37' },
      { key: 'due_60d', label: '30–60d', apColor: '#FF8C00', arColor: '#F59E0B' },
      { key: 'due_90d', label: '60–90d', apColor: '#555', arColor: '#00F2FF' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {buckets.map(b => {
          const apV = (ap as any)[b.key] || 0;
          const arV = (ar as any)[b.key] || 0;
          return (
            <div key={b.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 8, color: '#444', letterSpacing: 1, fontWeight: 900 }}>{b.label}</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 8, color: b.apColor, fontFamily: 'Courier New, monospace' }}>AP {fmtShort(apV)}</span>
                  <span style={{ fontSize: 8, color: b.arColor, fontFamily: 'Courier New, monospace' }}>AR {fmtShort(arV)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 2, height: 6 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(apV / maxVal) * 100}%`, background: b.apColor, borderRadius: 3, transition: 'width 1s' }} />
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(arV / maxVal) * 100}%`, background: b.arColor, borderRadius: 3, transition: 'width 1s' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: '#555', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 900 }}>Engine 14 · AP/AR Matrix</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FFF', marginTop: 4 }}>Working Capital</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: netColor, fontFamily: 'Courier New, monospace' }}>
            {data.net_working_capital >= 0 ? '+' : ''}{fmtShort(data.net_working_capital)}
          </div>
          <div style={{ fontSize: 8, color: '#444', letterSpacing: 1 }}>NET POSITION</div>
        </div>
      </div>

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <div style={{ background: 'rgba(255,49,49,0.04)', border: '1px solid rgba(255,49,49,0.15)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 8, color: '#FF3131', letterSpacing: 2, fontWeight: 900 }}>AP · WE OWE</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#FF3131', fontFamily: 'Courier New, monospace', marginTop: 4 }}>
            {fmtShort(data.ap.total)}
          </div>
          {data.ap.overdue > 0 && (
            <div style={{ fontSize: 9, color: '#FF313188', marginTop: 4 }}>⚠ {fmtShort(data.ap.overdue)} OVERDUE</div>
          )}
        </div>
        <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 8, color: '#00FF88', letterSpacing: 2, fontWeight: 900 }}>AR · OWED TO US</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#00FF88', fontFamily: 'Courier New, monospace', marginTop: 4 }}>
            {fmtShort(data.ar.total)}
          </div>
          {data.ar.overdue > 0 && (
            <div style={{ fontSize: 9, color: '#00FF8888', marginTop: 4 }}>⚠ {fmtShort(data.ar.overdue)} OVERDUE</div>
          )}
        </div>
      </div>

      {/* Aging Analysis */}
      <div style={{ fontSize: 9, color: '#444', letterSpacing: 2, fontWeight: 900, marginBottom: 8, textTransform: 'uppercase' }}>
        Aging Analysis · AP (left) vs AR (right)
      </div>
      <AgingBar ap={data.ap} ar={data.ar} />

      {/* Items preview */}
      {data.ap.items.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 9, color: '#444', letterSpacing: 2, fontWeight: 900, marginBottom: 6, textTransform: 'uppercase' }}>
            Outstanding AP
          </div>
          {data.ap.items.slice(0, 4).map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 10px', borderRadius: 6, marginBottom: 4,
              background: item.is_overdue ? 'rgba(255,49,49,0.06)' : 'rgba(255,255,255,0.01)',
              border: `1px solid ${item.is_overdue ? 'rgba(255,49,49,0.2)' : 'rgba(255,255,255,0.04)'}`,
            }}>
              <div>
                <div style={{ fontSize: 9, color: '#888' }}>{item.vendor || item.client}</div>
                <div style={{ fontSize: 8, color: '#444', fontFamily: 'Courier New, monospace' }}>{item.ref || item.ota} · {item.due_date}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 900, color: item.is_overdue ? '#FF3131' : '#F59E0B', fontFamily: 'Courier New, monospace' }}>
                {fmtShort(item.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function SovereignFinancePage() {
  const [benford, setBenford] = useState<BenfordData | null>(null);
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [apar, setAPAR] = useState<APARData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, t, f, a] = await Promise.allSettled([
        fetch(`${API}/api/accounting/agi/benford/scan`).then(r => r.json()),
        fetch(`${API}/api/accounting/agi/treasury/radar`).then(r => r.json()),
        fetch(`${API}/api/accounting/agi/journals/live-feed?limit=30`).then(r => r.json()),
        fetch(`${API}/api/accounting/agi/treasury/ap-ar`).then(r => r.json()),
      ]);
      if (b.status === 'fulfilled') setBenford(b.value);
      if (t.status === 'fulfilled') setTreasury(t.value);
      if (f.status === 'fulfilled') setFeed(f.value);
      if (a.status === 'fulfilled') setAPAR(a.value);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [loadAll]);

  // ── SGPE State ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'finance' | 'sgpe'>('finance');
  const [sgpe, setSgpe] = useState<any>(null);
  const [sgpeLoading, setSgpeLoading] = useState(false);
  const [sgpePolicies, setSgpePolicies] = useState<any[]>([]);
  const [fdiNid, setFdiNid] = useState('');
  const [fdiResult, setFdiResult] = useState<any>(null);
  const [fdiLoading, setFdiLoading] = useState(false);
  const [escrowProperty, setEscrowProperty] = useState('');
  const [escrowResult, setEscrowResult] = useState<any>(null);
  const [jvPortfolioNid, setJvPortfolioNid] = useState('');
  const [jvPortfolio, setJvPortfolio] = useState<any>(null);
  const [jvProjects, setJvProjects] = useState<any[]>([]);

  const loadSgpe = useCallback(async () => {
    setSgpeLoading(true);
    try {
      const token = localStorage.getItem('miracle_token') || '';
      const h = { Authorization: `Bearer ${token}` };
      const [dash, pol] = await Promise.all([
        fetch(`${API}/api/sgpe/dashboard`, { headers: h }).then(r => r.json()),
        fetch(`${API}/api/sgpe/policies`, { headers: h }).then(r => r.json()),
      ]);
      setSgpe(dash.summary || null);
      setSgpePolicies(pol.policies || []);
      const proj = await fetch(`${API}/api/sgpe/bd-jv/projects`, { headers: h }).then(r => r.json());
      setJvProjects(proj.projects || []);
    } catch {}
    finally { setSgpeLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'sgpe') loadSgpe();
  }, [activeTab, loadSgpe]);

  const runFdiCheck = async () => {
    if (!fdiNid) return;
    setFdiLoading(true);
    try {
      const token = localStorage.getItem('miracle_token') || '';
      const r = await fetch(`${API}/api/sgpe/fdi/status/${fdiNid}`, { headers: { Authorization: `Bearer ${token}` } });
      setFdiResult(await r.json());
    } catch {}
    finally { setFdiLoading(false); }
  };

  const loadEscrow = async () => {
    if (!escrowProperty) return;
    try {
      const token = localStorage.getItem('miracle_token') || '';
      const r = await fetch(`${API}/api/sgpe/escrow/status/${escrowProperty}`, { headers: { Authorization: `Bearer ${token}` } });
      setEscrowResult(await r.json());
    } catch {}
  };

  const loadJvPortfolio = async () => {
    if (!jvPortfolioNid) return;
    try {
      const token = localStorage.getItem('miracle_token') || '';
      const r = await fetch(`${API}/api/sgpe/bd-jv/portfolio/${jvPortfolioNid}`, { headers: { Authorization: `Bearer ${token}` } });
      setJvPortfolio(await r.json());
    } catch {}
  };

  const topHUDItems = [
    {
      label: 'CASH BALANCE',
      value: treasury ? fmtShort(treasury.baseline_cash) : '—',
      color: '#D4AF37',
      sub: 'Account 100000',
      icon: '💰',
    },
    {
      label: 'AR OUTSTANDING',
      value: apar ? fmtShort(apar.ar.total) : '—',
      color: '#00FF88',
      sub: apar && apar.ar.overdue > 0 ? `⚠ ${fmtShort(apar.ar.overdue)} overdue` : 'All current',
      icon: '📥',
    },
    {
      label: 'AP OUTSTANDING',
      value: apar ? fmtShort(apar.ap.total) : '—',
      color: '#FF3131',
      sub: apar && apar.ap.overdue > 0 ? `⚠ ${fmtShort(apar.ap.overdue)} overdue` : 'All current',
      icon: '📤',
    },
    {
      label: '90D NET POSITION',
      value: treasury ? (treasury.net_90d_position >= 0 ? '+' : '') + fmtShort(treasury.net_90d_position) : '—',
      color: treasury ? (treasury.net_90d_position >= 0 ? '#00FF88' : '#FF3131') : '#555',
      sub: treasury ? `Health: ${treasury.liquidity_health}` : '—',
      icon: '📊',
    },
  ];

  return (
    <div className="zone-gold" style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      {/* Cyber Grid Background */}
      <div className="fin-intel-bg" />
      <div style={{ position: 'relative', zIndex: 1, padding: '28px 24px' }}>

        {/* ── TOP TAB SWITCHER ── */}
        <style>{`
          @keyframes sgpeGlow { 0%,100%{box-shadow:0 0 8px #9D00FF55;} 50%{box-shadow:0 0 20px #9D00FF99;} }
          .sgpe-tab { display:flex; align-items:center; gap:8px; padding:10px 24px; border:none; background:transparent;
            cursor:pointer; font-weight:700; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;
            border-bottom:2px solid transparent; transition:all 0.2s; white-space:nowrap; }
          .sgpe-tab:hover { background:rgba(255,255,255,0.04); }
          .sgpe-tab-active-fin { border-bottom:2px solid #D4AF37; color:#D4AF37 !important; }
          .sgpe-tab-active-sgpe { border-bottom:2px solid #9D00FF; color:#9D00FF !important; animation:sgpeGlow 2s ease-in-out infinite; }
          .sgpe-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:20px; }
          .sgpe-kpi { background:rgba(157,0,255,0.07); border:1px solid rgba(157,0,255,0.2); border-radius:12px; padding:16px; }
          .sgpe-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; letter-spacing:0.06em; }
        `}</style>

        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:28, gap:0 }}>
          <button className={`sgpe-tab ${activeTab==='finance'?'sgpe-tab-active-fin':''}`}
            style={{ color: activeTab==='finance' ? '#D4AF37' : '#555' }}
            onClick={() => setActiveTab('finance')}>
            💰 Financial Intelligence
          </button>
          <button className={`sgpe-tab ${activeTab==='sgpe'?'sgpe-tab-active-sgpe':''}`}
            style={{ color: activeTab==='sgpe' ? '#9D00FF' : '#555' }}
            onClick={() => setActiveTab('sgpe')}>
            🌍 Sovereign Policy Engine
            <span style={{ background:'rgba(157,0,255,0.2)', border:'1px solid rgba(157,0,255,0.4)', color:'#9D00FF', borderRadius:20, fontSize:9, padding:'1px 7px', marginLeft:4 }}>SGPE</span>
          </button>
        </div>

        {/* ═══ FINANCIAL INTELLIGENCE TAB ═══ */}
        {activeTab === 'finance' && (<>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: '#D4AF37', letterSpacing: 3, fontWeight: 900, textTransform: 'uppercase', marginBottom: 6 }}>Z-11C · Miracle Intelligence Suite</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#FFF', letterSpacing: 0.5 }}>Financial Intelligence</span>
              <span style={{ fontSize: 28, fontWeight: 900, background: 'linear-gradient(90deg, #D4AF37, #FFE57A, #D4AF37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>War Room</span>
            </div>
            <div style={{ fontSize: 10, color: '#444', marginTop: 4, letterSpacing: 2 }}>4 MIRACLE-TIER ENGINES · REAL-TIME DATA FUSION · ANTI-HALLUCINATION GUARANTEE</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {lastRefresh && (<div style={{ fontSize: 8, color: '#333', fontFamily: 'Courier New, monospace', textAlign: 'right' }}>LAST SYNC<br />{lastRefresh.toLocaleTimeString()}</div>)}
            <button id="fin-intel-refresh" onClick={loadAll} className="s-btn" disabled={loading} style={{ padding: '8px 18px', fontSize: 9 }}>
              {loading ? '⟳ SYNCING...' : '⟳ REFRESH'}
            </button>
          </div>
        </div>
        {loading && <div className="fin-scan-line" />}
        {error && (<div style={{ background: 'rgba(255,49,49,0.08)', border: '1px solid rgba(255,49,49,0.25)', borderRadius: 12, padding: '12px 18px', marginBottom: 20, color: '#FF3131', fontSize: 12 }}>⚠ Backend connection error: {error}</div>)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {topHUDItems.map((k, i) => (
            <div key={i} className="s-metric" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${k.color}, transparent)` }} />
              <div style={{ fontSize: 8, color: '#555', letterSpacing: 2, fontWeight: 900, textTransform: 'uppercase', marginBottom: 8 }}>{k.icon} {k.label}</div>
              {loading ? (<div style={{ height: 32, display: 'flex', alignItems: 'center' }}><div className="agi-spinner" style={{ width: 24, height: 24, borderTopColor: k.color, borderColor: `${k.color}22` }} /></div>)
                : (<div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'Courier New, monospace', color: k.color, textShadow: `0 0 20px ${k.color}44` }}>{k.value}</div>)}
              <div style={{ fontSize: 9, color: '#444', marginTop: 6 }}>{k.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="s-panel s-panel--glow">{loading || !benford ? (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}><div className="agi-spinner" /><div style={{ fontSize: 10, color: '#444', letterSpacing: 2 }}>SCANNING LEDGER...</div></div>) : (<BenfordChart data={benford} />)}</div>
          <div className="s-panel s-panel--glow">{loading || !treasury ? (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}><div className="agi-spinner" /><div style={{ fontSize: 10, color: '#444', letterSpacing: 2 }}>PROJECTING CASH FLOW...</div></div>) : (<TreasuryRadar data={treasury} />)}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
          <div className="s-panel" style={{ minHeight: 400, display: 'flex', flexDirection: 'column' }}>{loading || !feed ? (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 380, gap: 16 }}><div className="agi-spinner" /><div style={{ fontSize: 10, color: '#444', letterSpacing: 2 }}>LOADING JOURNAL STREAM...</div></div>) : (<LiveFeed data={feed} />)}</div>
          <div className="s-panel" style={{ minHeight: 400, display: 'flex', flexDirection: 'column' }}>{loading || !apar ? (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 380, gap: 16 }}><div className="agi-spinner" /><div style={{ fontSize: 10, color: '#444', letterSpacing: 2 }}>COMPUTING AP/AR...</div></div>) : (<APARMatrix data={apar} />)}</div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(255,255,255,0.01)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', gap: 20 }}>
            {[{ label: 'BENFORD ENGINE', active: !!benford }, { label: 'TREASURY RADAR', active: !!treasury }, { label: 'JOURNAL FEED', active: !!feed }, { label: 'AP/AR MATRIX', active: !!apar }].map(e => (
              <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: e.active ? '#00FF88' : '#FF3131', boxShadow: `0 0 6px ${e.active ? '#00FF88' : '#FF3131'}` }} />
                <span style={{ fontSize: 8, color: '#444', letterSpacing: 1, fontWeight: 900 }}>{e.label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 8, color: '#333', fontFamily: 'Courier New, monospace' }}>Z-11C · SOVEREIGN FINANCIAL INTELLIGENCE ENGINE · V1.0</div>
        </div>
        </>)}

        {/* ═══ SOVEREIGN GLOBAL POLICY ENGINE TAB ═══ */}
        {activeTab === 'sgpe' && (
          <div>
            {/* SGPE Header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 9, color: '#9D00FF', letterSpacing: 3, fontWeight: 900, textTransform: 'uppercase', marginBottom: 6 }}>ZONE SGPE · MiracleOS Sovereign Engine</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: '#FFF' }}>Sovereign Global</span>
                <span style={{ fontSize: 26, fontWeight: 900, background: 'linear-gradient(90deg, #9D00FF, #C77DFF, #9D00FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Policy Engine</span>
              </div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 4, letterSpacing: 1.5 }}>GOVERNMENT POLICIES → EXECUTABLE SOFTWARE RULES · UAE · US · BD · GR · TR · CY · GB</div>
            </div>

            {sgpeLoading && <div style={{ textAlign: 'center', padding: 40, color: '#9D00FF' }}>Loading SGPE data...</div>}

            {/* KPI Row */}
            {sgpe && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Escrow Locked', value: `$${(sgpe.escrow_locked_usd/1000).toFixed(0)}K`, color: '#f59e0b', icon: '🔒', sub: 'Off-plan ring-fenced' },
                  { label: 'Tax Deductions', value: `$${(sgpe.tax_deductions_year1/1000).toFixed(0)}K`, color: '#4ade80', icon: '🛡', sub: 'MACRS Year-1 write-offs' },
                  { label: 'Gains Deferred', value: `$${(sgpe.gains_deferred_1031/1000).toFixed(0)}K`, color: '#38bdf8', icon: '🔄', sub: '1031 Exchange protected' },
                  { label: 'BD JV Invested', value: `$${(sgpe.bd_jv_invested_usd/1000).toFixed(0)}K`, color: '#f472b6', icon: '🇧🇩', sub: `${sgpe.bd_jv_projects} active projects` },
                ].map((k, i) => (
                  <div key={i} className="sgpe-kpi" style={{ borderColor: `${k.color}33` }}>
                    <div style={{ fontSize: 8, color: '#555', letterSpacing: 2, fontWeight: 900, textTransform: 'uppercase', marginBottom: 8 }}>{k.icon} {k.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: k.color, fontFamily: 'Courier New, monospace' }}>{k.value}</div>
                    <div style={{ fontSize: 9, color: '#555', marginTop: 4 }}>{k.sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Additional KPIs */}
            {sgpe && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                {[
                  { label: 'Visa-Eligible Owners', value: sgpe.visa_eligible_owners, color: '#818cf8', icon: '🛂' },
                  { label: 'Tradeable Credits', value: `$${(sgpe.tradeable_credits/1000).toFixed(0)}K`, color: '#34d399', icon: '🌿' },
                  { label: 'Est. Tax Saved', value: `$${(sgpe.estimated_tax_saved/1000).toFixed(0)}K`, color: '#fbbf24', icon: '💰' },
                ].map((k, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${k.color}22`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontSize: 28 }}>{k.icon}</div>
                    <div>
                      <div style={{ fontSize: 9, color: '#555', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase' }}>{k.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>

              {/* FDI / Visa Checker */}
              <div className="sgpe-card">
                <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>🛂 FDI Visa Eligibility Checker</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input value={fdiNid} onChange={e => setFdiNid(e.target.value)} placeholder="Owner NID / Passport" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
                  <button onClick={runFdiCheck} disabled={fdiLoading} style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.4)', color: '#818cf8', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>
                    {fdiLoading ? '...' : 'CHECK'}
                  </button>
                </div>
                {fdiResult && fdiResult.policy_evaluations?.map((pe: any, i: number) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${pe.eligible ? '#4ade8044' : '#94a3b822'}`, borderRadius: 10, padding: '12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#f1f5f9' }}>{pe.policy_name}</div>
                      <span className="sgpe-badge" style={{ background: pe.eligible ? 'rgba(74,222,128,0.15)' : 'rgba(148,163,184,0.1)', border: `1px solid ${pe.eligible ? '#4ade8044' : '#94a3b822'}`, color: pe.eligible ? '#4ade80' : '#94a3b8' }}>
                        {pe.eligible ? '✓ ELIGIBLE' : pe.completion_pct + '% met'}
                      </span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ height: '100%', width: `${pe.completion_pct}%`, background: pe.eligible ? 'linear-gradient(90deg,#4ade80,#34d399)' : 'linear-gradient(90deg,#818cf8,#a78bfa)', borderRadius: 6, transition: 'width 1s ease' }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>${(pe.invested_usd/1000).toFixed(0)}K of ${(pe.threshold_usd/1000).toFixed(0)}K · {pe.visa_type}</div>
                  </div>
                ))}
              </div>

              {/* Escrow Vault Monitor */}
              <div className="sgpe-card">
                <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>🔒 Escrow Vault Monitor</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input value={escrowProperty} onChange={e => setEscrowProperty(e.target.value)} placeholder="Property ID (e.g. LTR-01)" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
                  <button onClick={loadEscrow} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>VIEW</button>
                </div>
                {escrowResult && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px' }}>
                        <div style={{ fontSize: 8, color: '#f59e0b', letterSpacing: 1.5, fontWeight: 700 }}>LOCKED</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b' }}>${(escrowResult.total_locked/1000).toFixed(0)}K</div>
                      </div>
                      <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px' }}>
                        <div style={{ fontSize: 8, color: '#4ade80', letterSpacing: 1.5, fontWeight: 700 }}>RELEASED</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#4ade80' }}>${(escrowResult.total_released/1000).toFixed(0)}K</div>
                      </div>
                    </div>
                    {escrowResult.vaults?.slice(0,3).map((v: any, i: number) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px', marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>{v.vault_ref}</div>
                          <span className="sgpe-badge" style={{ background: v.vault_status === 'RELEASED' ? 'rgba(74,222,128,0.15)' : 'rgba(245,158,11,0.15)', border: `1px solid ${v.vault_status === 'RELEASED' ? '#4ade8044' : '#f59e0b44'}`, color: v.vault_status === 'RELEASED' ? '#4ade80' : '#f59e0b' }}>{v.vault_status}</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{v.milestone_label} · ${(v.deposit_amount/1000).toFixed(0)}K</div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* 1031 Exchange Timers */}
              <div className="sgpe-card">
                <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>🔄 Tax Shield · 1031 Countdown</div>
                {sgpe?.active_1031_exchanges?.length > 0 ? sgpe.active_1031_exchanges.map((ex: any, i: number) => (
                  <div key={i} style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, padding: '12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#f1f5f9' }}>{ex.property}</div>
                      <span className="sgpe-badge" style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.35)', color: '#38bdf8' }}>{ex.status}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>Gain Deferred: ${(ex.gain/1000).toFixed(0)}K</div>
                    {ex.days_to_close != null && (
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(0, 100 - (ex.days_to_close/180*100))}%`, background: ex.days_to_close < 30 ? 'linear-gradient(90deg,#ef4444,#f87171)' : 'linear-gradient(90deg,#38bdf8,#7dd3fc)', borderRadius: 6 }} />
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>{ex.days_to_close} days remaining to close</div>
                  </div>
                )) : (
                  <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 20 }}>No active 1031 exchanges. Run a cost-segregation or register a property sale to begin.</div>
                )}
              </div>
            </div>

            {/* Bangladesh JV Resort Engine */}
            <div style={{ background: 'linear-gradient(135deg, rgba(244,114,182,0.05), rgba(157,0,255,0.05))', border: '1px solid rgba(244,114,182,0.15)', borderRadius: 16, padding: '24px', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #f472b6, #9D00FF)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🇧🇩</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9' }}>Bangladesh JV Resort Share-Selling Engine</div>
                  <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>BIDA · RJSC · Bangladesh Bank Compliant · SPV Revenue Pool Model</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {['ECO_RESORT', 'LUXURY_RESORT', 'BOT_COASTAL'].map(t => (
                    <span key={t} className="sgpe-badge" style={{ background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.25)', color: '#f472b6' }}>{t.replace('_', ' ')}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Investor Portfolio Lookup */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f472b6', marginBottom: 10 }}>Investor Portfolio Lookup</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input value={jvPortfolioNid} onChange={e => setJvPortfolioNid(e.target.value)} placeholder="Investor NID / Passport" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
                    <button onClick={loadJvPortfolio} style={{ background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.4)', color: '#f472b6', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>LOOKUP</button>
                  </div>
                  {jvPortfolio && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <div style={{ background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: 8, padding: '10px' }}>
                          <div style={{ fontSize: 8, color: '#f472b6', letterSpacing: 1.5, fontWeight: 700 }}>TOTAL INVESTED</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#f472b6' }}>${(jvPortfolio.total_invested_usd/1000).toFixed(0)}K</div>
                        </div>
                        <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px' }}>
                          <div style={{ fontSize: 8, color: '#4ade80', letterSpacing: 1.5, fontWeight: 700 }}>YTD INCOME</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#4ade80' }}>{jvPortfolio.total_ytd_income?.toFixed(0) || 0} BDT</div>
                        </div>
                      </div>
                      {jvPortfolio.holdings?.map((h: any, i: number) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px', marginBottom: 6 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: '#f1f5f9', marginBottom: 4 }}>{h.project_name}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span className="sgpe-badge" style={{ background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.25)', color: '#f472b6' }}>{h.share_type}</span>
                            <span className="sgpe-badge" style={{ background: h.transfer_status === 'LOCKED' ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)', border: `1px solid ${h.transfer_status === 'LOCKED' ? '#ef444444' : '#4ade8044'}`, color: h.transfer_status === 'LOCKED' ? '#ef4444' : '#4ade80' }}>{h.transfer_status}</span>
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{h.ownership_pct}% ownership · {h.total_invested}</div>
                          {h.free_nights > 0 && <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 2 }}>🌙 {h.free_nights} free nights/year · {h.discount_pct}% member rate</div>}
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Active JV Projects */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f472b6', marginBottom: 10 }}>Active Resort Projects</div>
                  {jvProjects.length > 0 ? jvProjects.map((p: any, i: number) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(244,114,182,0.12)', borderRadius: 10, padding: '12px', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#f1f5f9', marginBottom: 4 }}>{p.project_name}</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className="sgpe-badge" style={{ background: 'rgba(157,0,255,0.1)', border: '1px solid rgba(157,0,255,0.25)', color: '#C77DFF' }}>{p.project_type}</span>
                        <span className="sgpe-badge" style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8' }}>{p.total_investors} investors</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{p.spv_name || 'SPV not registered'}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#f472b6' }}>${(p.total_invested_usd/1000).toFixed(0)}K invested</div>
                        <div style={{ fontSize: 10, color: '#475569' }}>{p.total_shares_issued?.toLocaleString()} total shares</div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 30, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10 }}>No active projects registered.<br /><span style={{ fontSize: 10, color: '#374151' }}>Use POST /api/sgpe/bd-jv/register-share to onboard your first project.</span></div>
                  )}
                </div>
              </div>

              {/* BD Compliance Checklist */}
              <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(244,114,182,0.04)', border: '1px solid rgba(244,114,182,0.12)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#f472b6', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>🇧🇩 Bangladesh Regulatory Compliance Framework</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { icon: '🏛', label: 'BIDA Registration', desc: 'Investment registration with Bangladesh Investment Development Authority' },
                    { icon: '📋', label: 'RJSC Filing', desc: 'SPV incorporation & share allotment filed with Joint Stock Companies Registrar' },
                    { icon: '🏦', label: 'Bangladesh Bank', desc: 'AD Bank report within 14 days of foreign share transfer' },
                    { icon: '📜', label: 'Sub-Kabla / Deed', desc: 'Land/property deed registration under Transfer of Property Act 1882' },
                    { icon: '🌿', label: 'DOE Clearance', desc: 'Environmental clearance from Dept. of Environment (eco-resort mandatory)' },
                    { icon: '💱', label: 'NAV Valuation', desc: 'Net Asset Value audit required before any share transfer or repatriation' },
                  ].map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16 }}>{c.icon}</span>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f1f5f9' }}>{c.label}</div>
                        <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.4 }}>{c.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Policy Library */}
            <div className="sgpe-card">
              <div style={{ fontSize: 10, color: '#9D00FF', fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>📜 Active Policy Config Library — {sgpePolicies.length} Policies Loaded</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {sgpePolicies.map((p, i) => {
                  const catColors: Record<string, string> = { FDI_IMMIGRATION: '#818cf8', TAX_SHIELD: '#4ade80', SUBSIDY: '#34d399', ESCROW: '#f59e0b', JV_SHARE_SELL: '#f472b6' };
                  const cc = catColors[p.category] || '#94a3b8';
                  return (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${cc}22`, borderRadius: 10, padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#f1f5f9' }}>{p.policy_name}</div>
                        <span style={{ fontSize: 9, fontWeight: 900, color: cc, background: `${cc}18`, border: `1px solid ${cc}33`, borderRadius: 4, padding: '2px 6px' }}>{p.country_code}</span>
                      </div>
                      <span className="sgpe-badge" style={{ background: `${cc}12`, border: `1px solid ${cc}30`, color: cc, marginBottom: 8 }}>{p.category.replace('_', ' ')}</span>
                      <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>{p.description?.substring(0, 120)}...</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(157,0,255,0.05)', border: '1px solid rgba(157,0,255,0.15)', borderRadius: 8, fontSize: 10, color: '#64748b' }}>
                💡 <strong style={{ color: '#9D00FF' }}>JSON-Driven Architecture:</strong> Drop a new <code style={{ color: '#C77DFF', background: 'rgba(199,125,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>country_policy.json</code> file via POST /api/sgpe/policies and the engine auto-activates it — zero backend code change required.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
