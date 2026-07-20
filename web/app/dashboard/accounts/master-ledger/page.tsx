'use client';

/**
 * MASTER LEDGER & REPORTS — MIRACLE HMS PHASE 6E
 * =====================================================
 * Route: /dashboard/accounts/master-ledger
 * Access: ACCOUNTS, GM, ADMIN, CDO
 *
 * Tabs:
 *   1. Master Ledger (append-only view)
 *   2. Trial Balance (aggregate debit/credit check)
 *   3. Cross-Dept P&L Comparison
 *   4. Void Audit Trail
 */

import React, { useState, useEffect, useCallback } from 'react';

// Strip trailing /api from NEXT_PUBLIC_API_URL so fetch calls prefixing /api/ don't double-up
const _RAW_API = process.env.NEXT_PUBLIC_API_URL || 'https://miracle.vigilantitsolution.com/api';
const API_BASE = _RAW_API.endsWith('/api') ? _RAW_API.slice(0, -4) : _RAW_API;
const fmt = (n: number, cur = 'PKR') => `${cur} ${(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

type TabKey = 'ledger' | 'trial' | 'pl' | 'voids';

export default function MasterLedgerPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ledger');
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd]   = useState('');

  // Master Ledger
  const [entries, setEntries]   = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal]       = useState(0);
  const [offset, setOffset]     = useState(0);
  const LIMIT = 50;

  // Trial Balance
  const [trial, setTrial]       = useState<{ balanced: boolean; total_debit: number; total_credit: number; variance: number; accounts: Array<Record<string,unknown>> } | null>(null);

  // P&L Comparison
  const [plComp, setPlComp]     = useState<{ departments: Array<Record<string,unknown>>; totals: Record<string,unknown>; period: Record<string,unknown> } | null>(null);

  // Void Report
  const [voidReport, setVoidReport] = useState<Record<string,unknown> | null>(null);

  const [loading, setLoading]   = useState(false);

  // ── Load depts ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API_BASE}/api/accounting/dept/list`)
      .then(r => r.json()).then(d => { if (d.status === 'SUCCESS') setDepts(d.departments); })
      .catch(() => {});
    // Default period = current month
    const now = new Date();
    setPeriodStart(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`);
    setPeriodEnd(now.toISOString().slice(0,10));
  }, []);

  // ── Tab loaders ──────────────────────────────────────────────────────────────

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/accounting/master/ledger?limit=${LIMIT}&offset=${offset}`;
      if (deptFilter) url += `&dept_id=${deptFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'SUCCESS') { setEntries(data.entries); setTotal(data.total); }
    } catch { /* silent */ }
    setLoading(false);
  }, [deptFilter, offset]);

  const loadTrial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/master/trial-balance`);
      const data = await res.json();
      if (data.status === 'SUCCESS') setTrial(data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const loadPL = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/accounting/master/pl-comparison`;
      if (periodStart && periodEnd) url += `?period_start=${periodStart}&period_end=${periodEnd}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'SUCCESS') setPlComp(data);
    } catch { /* silent */ }
    setLoading(false);
  }, [periodStart, periodEnd]);

  const loadVoids = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/master/void-report`);
      const data = await res.json();
      if (data.status === 'SUCCESS') setVoidReport(data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') loadLedger();
    if (activeTab === 'trial') loadTrial();
    if (activeTab === 'pl') loadPL();
    if (activeTab === 'voids') loadVoids();
  }, [activeTab, loadLedger, loadTrial, loadPL, loadVoids]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: [TabKey, string][] = [
    ['ledger', '📒 Master Ledger'],
    ['trial',  '⚖️ Trial Balance'],
    ['pl',     '📊 P&L Comparison'],
    ['voids',  '🚫 Void Audit'],
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#050510 0%,#080820 100%)', color: '#e8e8f0', fontFamily: "'Inter', sans-serif", padding: 24 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          ZONE 11 — MASTER LEDGER & REPORTS
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: 0 }}>
          📒 Master Ledger
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
          Append-only financial record. Iron Law 66: zero UPDATE / DELETE ever permitted.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, overflowX: 'auto' }}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            flex: 1, minWidth: 120, padding: '10px 8px', borderRadius: 9, border: 'none',
            cursor: 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', transition: 'all 0.2s',
            background: activeTab === key ? 'rgba(212,175,55,0.15)' : 'transparent',
            color: activeTab === key ? '#d4af37' : 'rgba(255,255,255,0.4)',
            borderBottom: activeTab === key ? '2px solid #d4af37' : '2px solid transparent'
          }}>{label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>⏳ Loading...</div>
      )}

      {/* ── Master Ledger Tab ── */}
      {activeTab === 'ledger' && !loading && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setOffset(0); }} style={selStyle}>
              <option value="">All Departments</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button onClick={() => { setOffset(0); loadLedger(); }} style={refreshBtn}>🔄 Refresh</button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Total entries: {total}</span>
          </div>

          {/* Ledger Table */}
          <div style={{ background: 'rgba(15,15,35,0.9)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['Date', 'Department', 'Narration', 'Dr Account', 'Cr Account', 'Amount', 'Posted By', 'Type'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Amount' ? 'right' : 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 10, letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>No master ledger entries yet.</td></tr>
                ) : entries.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: e['is_void'] ? 0.6 : 1 }}>
                    <td style={{ padding: '9px 14px', color: '#94a3b8' }}>{String(e['entry_date'] || '').slice(0, 10)}</td>
                    <td style={{ padding: '9px 14px', color: '#e8e8f0' }}>{String(e['dept_name'] || e['dept_id'])}</td>
                    <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.5)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(e['narration'])}</td>
                    <td style={{ padding: '9px 14px', color: '#60a5fa', fontFamily: 'monospace' }}>{String(e['debit_account'])}</td>
                    <td style={{ padding: '9px 14px', color: '#a78bfa', fontFamily: 'monospace' }}>{String(e['credit_account'])}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#d4af37' }}>{fmt(Number(e['amount']))}</td>
                    <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.4)' }}>{String(e['posted_by'])}</td>
                    <td style={{ padding: '9px 14px' }}>
                      {e['is_void'] ? <span style={{ color: '#f87171', fontSize: 10, fontWeight: 800 }}>VOID</span> :
                       e['is_force_approved'] ? <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 800 }}>FORCE</span> :
                       <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 800 }}>NORMAL</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))} style={{ ...refreshBtn, opacity: offset === 0 ? 0.4 : 1 }}>← Prev</button>
            <span style={{ padding: '8px 14px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
            <button disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)} style={{ ...refreshBtn, opacity: offset + LIMIT >= total ? 0.4 : 1 }}>Next →</button>
          </div>
        </>
      )}

      {/* ── Trial Balance Tab ── */}
      {activeTab === 'trial' && !loading && trial && (
        <>
          {/* Balance Indicator */}
          <div style={{
            padding: '16px 24px', borderRadius: 14, marginBottom: 24,
            background: trial.balanced ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${trial.balanced ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: trial.balanced ? '#4ade80' : '#f87171', marginBottom: 4 }}>
                {trial.balanced ? '✅ LEDGER IS BALANCED' : '⚠️ LEDGER IMBALANCE DETECTED'}
              </div>
              {!trial.balanced && (
                <div style={{ fontSize: 13, color: '#f87171' }}>Variance: {fmt(Math.abs(trial.variance))}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>TOTAL DEBIT</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#60a5fa' }}>{fmt(trial.total_debit)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>TOTAL CREDIT</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#a78bfa' }}>{fmt(trial.total_credit)}</div>
              </div>
            </div>
          </div>

          {/* Account lines */}
          <div style={{ background: 'rgba(15,15,35,0.9)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['Account Code', 'Total Debit', 'Total Credit', 'Net Balance'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Account Code' ? 'left' : 'right', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trial.accounts.map((a, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 16px', color: '#e8e8f0', fontFamily: 'monospace', fontWeight: 700 }}>{String(a['account'])}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#60a5fa', fontWeight: 600 }}>{fmt(Number(a['debit']))}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#a78bfa', fontWeight: 600 }}>{fmt(Number(a['credit']))}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: Number(a['net']) >= 0 ? '#4ade80' : '#f87171' }}>
                      {Number(a['net']) >= 0 ? '+' : ''}{fmt(Number(a['net']))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(212,175,55,0.08)', borderTop: '2px solid rgba(212,175,55,0.3)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 900, color: '#d4af37' }}>TOTALS</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#60a5fa' }}>{fmt(trial.total_debit)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#a78bfa' }}>{fmt(trial.total_credit)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: trial.balanced ? '#4ade80' : '#f87171' }}>
                    {trial.balanced ? 'BALANCED ✅' : `±${fmt(Math.abs(trial.variance))}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* ── P&L Comparison Tab ── */}
      {activeTab === 'pl' && !loading && plComp && (
        <>
          {/* Period filter */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>FROM</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={inputDateStyle} />
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>TO</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={inputDateStyle} />
            <button onClick={loadPL} style={refreshBtn}>📊 Generate P&L</button>
          </div>

          {/* Company totals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total Revenue', value: fmt(Number(plComp.totals['gross_revenue'])), color: '#4ade80' },
              { label: 'Total Expenses', value: fmt(Number(plComp.totals['total_expenses'])), color: '#f87171' },
              { label: 'Net Income', value: fmt(Number(plComp.totals['net_income'])), color: Number(plComp.totals['net_income']) >= 0 ? '#d4af37' : '#f87171' },
            ].map(t => (
              <div key={t.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 8 }}>{t.label.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: t.color }}>{t.value}</div>
              </div>
            ))}
          </div>

          {/* Per-dept breakdown */}
          <div style={{ background: 'rgba(15,15,35,0.9)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 700, color: 'rgba(212,175,55,0.6)' }}>
              DEPARTMENT P&L COMPARISON — {String(plComp.period?.['start'] || '')} to {String(plComp.period?.['end'] || '')}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Department', 'Gross Revenue', 'Expenses', 'Voids', 'Net Income', 'Margin %'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Department' ? 'left' : 'right', color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(plComp.departments as Array<Record<string,unknown>>).map((dept, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#e8e8f0' }}>{String(dept['dept_name'])}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#4ade80' }}>{fmt(Number(dept['gross_revenue']))}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#f87171' }}>{fmt(Number(dept['total_expenses']))}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#fbbf24' }}>{fmt(Number(dept['void_amount']))}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: Number(dept['net_income']) >= 0 ? '#d4af37' : '#f87171' }}>
                      {fmt(Number(dept['net_income']))}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: Number(dept['margin_pct']) >= 50 ? '#4ade80' : Number(dept['margin_pct']) >= 20 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>
                      {Number(dept['margin_pct'])}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Void Audit Trail ── */}
      {activeTab === 'voids' && !loading && voidReport && (
        <>
          {/* Summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Voids', value: (voidReport['summary'] as Record<string,unknown>)?.['total_voids'], color: '#94a3b8' },
              { label: 'Pending Dept Approval', value: (voidReport['summary'] as Record<string,unknown>)?.['pending_dept_approval'], color: '#fbbf24' },
              { label: 'Pending Elimination', value: (voidReport['summary'] as Record<string,unknown>)?.['pending_elimination'], color: '#fb923c' },
              { label: 'Eliminated', value: (voidReport['summary'] as Record<string,unknown>)?.['eliminated'], color: '#4ade80' },
              { label: 'Total Void Amount', value: fmt(Number((voidReport['summary'] as Record<string,unknown>)?.['total_void_amount'])), color: '#f87171' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontWeight: 700 }}>{s.label.toUpperCase()}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{String(s.value ?? '—')}</div>
              </div>
            ))}
          </div>

          {/* Void lists */}
          {(['pending', 'pending_elimination', 'eliminated'] as const).map(section => {
            const sectionData = (voidReport[section] as Array<Record<string,unknown>>) || [];
            const labels: Record<string, string> = { pending: '⏳ Pending Dept Approval', pending_elimination: '💬 Dept-Approved, Pending Elimination', eliminated: '✅ Eliminated' };
            const colors: Record<string, string> = { pending: '#fbbf24', pending_elimination: '#fb923c', eliminated: '#4ade80' };
            if (sectionData.length === 0) return null;
            return (
              <div key={section} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: colors[section], marginBottom: 10 }}>{labels[section]} ({sectionData.length})</div>
                {sectionData.map((v, i) => (
                  <div key={i} style={{
                    background: 'rgba(15,15,35,0.9)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 10, padding: '12px 16px', marginBottom: 8,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>
                        {String(v['reason_code']).replace(/_/g,' ')} — {fmt(Number(v['amount']))}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        By {String(v['requested_by_name'])} · {String(v['requested_at']).slice(0,16)}
                        {v['dept_head_at'] && ` · DH Approved: ${String(v['dept_head_at']).slice(0,16)}`}
                        {v['eliminated_at'] && ` · Eliminated: ${String(v['eliminated_at']).slice(0,16)}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)' }}>
                      {String(v['tx_id']).slice(0, 16)}...
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const selStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer'
};

const refreshBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer', fontWeight: 700, fontSize: 12
};

const inputDateStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer'
};
