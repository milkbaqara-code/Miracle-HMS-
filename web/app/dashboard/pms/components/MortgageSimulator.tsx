// web/app/dashboard/pms/components/MortgageSimulator.tsx
'use client';

import { useState, useEffect } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/api$/, '') || '';

interface MortgageSimulatorProps {
  reqSelectedId: number | null;
  setToast: (toast: { msg: string; type: 'ok' | 'err' } | null) => void;
}

export default function MortgageSimulator({ reqSelectedId, setToast }: MortgageSimulatorProps) {
  const [simParams, setSimParams] = useState({
    shares_to_sell: 1000,
    share_price_usd: 1000,
    sale_velocity_monthly: 50,
    prepayment_allocation_pct: 80.0,
    extra_monthly_payment_usd: 0.0
  });
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const runMortgageSimulation = async () => {
    if (!reqSelectedId) return;
    setSimLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vigilant_token') : '';
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/api/properties/request/${reqSelectedId}/simulate-amortization`, {
        method: 'POST',
        headers,
        body: JSON.stringify(simParams),
      });
      if (r.ok) {
        const d = await r.json();
        setSimResult(d);
        setToast({ msg: '✅ Amortization payoff timeline computed!', type: 'ok' });
      }
    } catch { /* silent */ }
    finally { setSimLoading(false); }
  };

  useEffect(() => {
    setSimResult(null);
  }, [reqSelectedId]);

  if (!reqSelectedId) return null;

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>🏦 Mortgage Payoff & Debt Rescue</div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Target Shares to Sell:</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{simParams.shares_to_sell.toLocaleString()} shares</span>
          </label>
          <input
            type="range"
            min="100"
            max="50000"
            step="100"
            value={simParams.shares_to_sell}
            onChange={e => setSimParams(prev => ({ ...prev, shares_to_sell: parseInt(e.target.value) }))}
            style={{ width: '100%', accentColor: '#f59e0b', height: 4, margin: '8px 0' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Share Price (USD):</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>${simParams.share_price_usd.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min="10"
            max="5000"
            step="10"
            value={simParams.share_price_usd}
            onChange={e => setSimParams(prev => ({ ...prev, share_price_usd: parseInt(e.target.value) }))}
            style={{ width: '100%', accentColor: '#f59e0b', height: 4, margin: '8px 0' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Sale Velocity (Shares/Mo):</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{simParams.sale_velocity_monthly} shares/mo</span>
          </label>
          <input
            type="range"
            min="5"
            max="1000"
            step="5"
            value={simParams.sale_velocity_monthly}
            onChange={e => setSimParams(prev => ({ ...prev, sale_velocity_monthly: parseInt(e.target.value) }))}
            style={{ width: '100%', accentColor: '#f59e0b', height: 4, margin: '8px 0' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Sweep Allocation to Mortgage:</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{simParams.prepayment_allocation_pct}%</span>
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={simParams.prepayment_allocation_pct}
            onChange={e => setSimParams(prev => ({ ...prev, prepayment_allocation_pct: parseFloat(e.target.value) }))}
            style={{ width: '100%', accentColor: '#f59e0b', height: 4, margin: '8px 0' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Platform Extra Monthly Prepayment (USD):</label>
          <input
            type="number"
            value={simParams.extra_monthly_payment_usd}
            onChange={e => setSimParams(prev => ({ ...prev, extra_monthly_payment_usd: parseFloat(e.target.value) || 0 }))}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        <button
          onClick={runMortgageSimulation}
          disabled={simLoading}
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            border: 'none', color: '#fff', fontWeight: 700,
            borderRadius: 10, padding: '10px 18px', cursor: 'pointer',
            fontSize: 13, transition: 'all 0.2s', marginTop: 6
          }}
        >
          {simLoading ? '⏳ Simulating...' : '⚡ Run Rescue Simulation'}
        </button>
      </div>

      {simResult && simResult.has_mortgage && (
        <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 16, border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ color: '#818cf8', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📊 Rescue Simulation Metrics</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginBottom: 14 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 8 }}>
              <span style={{ color: '#64748b', display: 'block', fontSize: 10 }}>BASELINE PAYOFF</span>
              <strong style={{ color: '#e2e8f0', fontSize: 13 }}>{simResult.baseline_years} Yrs</strong>
            </div>
            <div style={{ background: 'rgba(16,185,129,0.08)', padding: 8, borderRadius: 8 }}>
              <span style={{ color: '#34d399', display: 'block', fontSize: 10 }}>ACCELERATED PAYOFF</span>
              <strong style={{ color: '#34d399', fontSize: 13 }}>{simResult.accelerated_years} Yrs</strong>
            </div>
            <div style={{ background: 'rgba(16,185,129,0.08)', padding: 8, borderRadius: 8, gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#34d399', display: 'block', fontSize: 10 }}>DEBT DURATION REDUCED BY</span>
                <strong style={{ color: '#34d399', fontSize: 14 }}>{simResult.years_saved} Years!</strong>
              </div>
              <span style={{ fontSize: 20 }}>🎉</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 8, gridColumn: 'span 2' }}>
              <span style={{ color: '#64748b', display: 'block', fontSize: 10 }}>TOTAL INTEREST SAVED</span>
              <strong style={{ color: '#fbbf24', fontSize: 14 }}>
                {simResult.input_currency} {Math.round(simResult.interest_saved_native).toLocaleString()}
              </strong>
              <span style={{ color: '#64748b', fontSize: 11, marginLeft: 6 }}>
                (${Math.round(simResult.interest_saved_usd).toLocaleString()} USD)
              </span>
            </div>
          </div>

          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Payoff Balance Projection:</div>
          <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: 11 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}>
                  <th style={{ padding: '4px', textAlign: 'left' }}>Year</th>
                  <th style={{ padding: '4px', textAlign: 'right' }}>Baseline ({simResult.input_currency})</th>
                  <th style={{ padding: '4px', textAlign: 'right' }}>Rescue ({simResult.input_currency})</th>
                </tr>
              </thead>
              <tbody>
                {simResult.yearly_schedule?.map((y: any) => (
                  <tr key={y.year} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '4px 0', color: '#818cf8', fontWeight: 600 }}>Year {y.year}</td>
                    <td style={{ padding: '4px 0', textAlign: 'right', color: '#94a3b8' }}>
                      {Math.round(y.baseline_balance_native).toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 0', textAlign: 'right', color: y.accelerated_balance_native === 0 ? '#34d399' : '#e2e8f0', fontWeight: y.accelerated_balance_native === 0 ? 700 : 400 }}>
                      {y.accelerated_balance_native === 0 ? 'CLEARED 👑' : Math.round(y.accelerated_balance_native).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
