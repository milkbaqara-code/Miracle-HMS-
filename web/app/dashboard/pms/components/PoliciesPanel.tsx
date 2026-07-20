// web/app/dashboard/pms/components/PoliciesPanel.tsx
'use client';

import { useState, useEffect } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/api$/, '') || '';

interface PoliciesPanelProps {
  setToast: (toast: { msg: string; type: 'ok' | 'err' } | null) => void;
}

export default function PoliciesPanel({ setToast }: PoliciesPanelProps) {
  const [regionPolicies, setRegionPolicies] = useState<any[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesSaving, setPoliciesSaving] = useState(false);

  const fetchPolicies = async () => {
    setPoliciesLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vigilant_token') : '';
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/api/properties/policies`, { headers });
      if (r.ok) {
        const d = await r.json();
        setRegionPolicies(d.policies || []);
      }
    } catch { /* silent */ }
    finally { setPoliciesLoading(false); }
  };

  const savePolicies = async () => {
    setPoliciesSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vigilant_token') : '';
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/api/properties/policies/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify(regionPolicies),
      });
      if (r.ok) {
        setToast({ msg: '✅ Dynamic Policies Saved Successfully!', type: 'ok' });
      }
    } catch { /* silent */ }
    finally { setPoliciesSaving(false); }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>⚙️ Region Policy Editor</h3>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Configure capitalization rates, fixed lease terms, and VAT rules dynamically per region.</div>
        </div>
        <button
          onClick={savePolicies}
          disabled={policiesSaving}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none', color: '#1e293b', fontWeight: 700,
            borderRadius: 10, padding: '10px 24px', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
            fontSize: 13, transition: 'all 0.2s'
          }}
        >
          {policiesSaving ? '⏳ Saving...' : '💾 Save All Policies'}
        </button>
      </div>

      {policiesLoading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>⏳ Loading dynamic policies...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}>
                {['Region', 'Cap Rate %', 'Lease Yield %', 'Sign Bonus %', 'Mgmt Fee %', 'Land Discount %', 'Road Premium %', 'VAT Tax %', 'Lease Term (Yrs)', 'Currency Note'].map(h => (
                  <th key={h} style={{ padding: '12px 8px', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1, fontWeight: 600, textAlign: 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regionPolicies.map((pol, idx) => (
                <tr key={pol.region_code} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>{pol.region_code}</td>
                  
                  {[
                    { key: 'cap_rate', scale: 100 },
                    { key: 'lease_yield', scale: 100 },
                    { key: 'sign_bonus_pct', scale: 100 },
                    { key: 'mgmt_fee', scale: 1 },
                    { key: 'land_discount', scale: 100 },
                    { key: 'road_premium', scale: 100 },
                    { key: 'vat_tax_pct', scale: 100 },
                  ].map(({ key, scale }) => (
                    <td key={key} style={{ padding: '6px 4px', textAlign: 'center' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={(pol[key] * scale).toFixed(2).replace(/\.00$/, '')}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0.0;
                          setRegionPolicies(prev => prev.map((p, pIdx) => pIdx === idx ? { ...p, [key]: val / scale } : p));
                        }}
                        style={{
                          width: 70, textAlign: 'center', background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9',
                          borderRadius: 6, padding: '4px 6px', fontSize: 13
                        }}
                      />
                    </td>
                  ))}
                  
                  <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                    <input
                      type="number"
                      value={pol.lease_term_years}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 5;
                        setRegionPolicies(prev => prev.map((p, pIdx) => pIdx === idx ? { ...p, lease_term_years: val } : p));
                      }}
                      style={{
                        width: 60, textAlign: 'center', background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9',
                        borderRadius: 6, padding: '4px 6px', fontSize: 13
                      }}
                    />
                  </td>

                  <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                    <input
                      type="text"
                      value={pol.currency_note}
                      onChange={e => {
                        const val = e.target.value;
                        setRegionPolicies(prev => prev.map((p, pIdx) => pIdx === idx ? { ...p, currency_note: val } : p));
                      }}
                      style={{
                        width: 100, textAlign: 'center', background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9',
                        borderRadius: 6, padding: '4px 6px', fontSize: 13
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
