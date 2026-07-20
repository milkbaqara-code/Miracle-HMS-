'use client';

/**
 * DEPARTMENT VAULT — MIRACLE HMS PHASE 6C
 * =========================================================
 * Route: /dashboard/accounts/vault
 * Access: DEPT_HEAD, GM, ADMIN, CDO, ACCOUNTS
 *
 * Features:
 * - Department selector (filtered by user's dept_head assignment)
 * - Full transaction list with filters
 * - 20-tx batch consent modal (PIN + legal checkbox)
 * - Void approval queue (approve / reject / escalate)
 * - Live Department P&L card
 * - Submit to Gateway button
 */

import React, { useState, useEffect, useCallback } from 'react';

// Strip trailing /api from NEXT_PUBLIC_API_URL so fetch calls that prefix /api/ don't double-up
const _RAW_API = process.env.NEXT_PUBLIC_API_URL || 'https://miracle.vigilantitsolution.com/api';
const API_BASE = _RAW_API.endsWith('/api') ? _RAW_API.slice(0, -4) : _RAW_API;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department { id: string; name: string; zone_id: string; currency: string; active: number; }
interface TillTx { id: string; type: string; amount: number; direction: string; category_name: string; description: string; payment_method: string; staff_name: string; status: string; created_at: string; gl_debit: string; gl_credit: string; }
interface VoidRecord { id: string; tx_id: string; amount: number; reason_code: string; reason: string; requested_by_name: string; requested_at: string; dept_head_approved: number; accounts_eliminated: number; }
interface BatchInfo { id: string; batch_number: number; tx_count: number; total_revenue: number; total_expense: number; status: string; dept_head_name: string; consent_at: string; }
interface PLData { gross_revenue: number; void_adjustments: number; net_revenue: number; total_expenses: number; net_operating_income: number; gross_margin_pct: number; }

// Caller stub — in production, read from auth context/session
const CALLER = {
  caller_id: 'dept_head_001',
  caller_role: 'DEPT_HEAD',
  caller_username: 'dept.head'
};

const fmt = (n: number, cur = 'PKR') => `${cur} ${n.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
const badge = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    OPEN: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' },
    PENDING_CONSENT: { bg: 'rgba(234,179,8,0.15)', color: '#fbbf24' },
    CONSENTED: { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
    SUBMITTED: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
    POSTED: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' },
    QUERIED: { bg: 'rgba(251,146,60,0.15)', color: '#fb923c' },
    REJECTED: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
    ACTIVE: { bg: 'rgba(34,197,94,0.1)', color: '#4ade80' },
    VOIDED: { bg: 'rgba(239,68,68,0.1)', color: '#f87171' },
  };
  const s = map[status] || { bg: 'rgba(255,255,255,0.05)', color: '#94a3b8' };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 99,
      background: s.bg, color: s.color, border: `1px solid ${s.color}33`, letterSpacing: 0.5
    }}>{status}</span>
  );
};

export default function DepartmentVaultPage() {
  const [depts, setDepts] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [txList, setTxList] = useState<TillTx[]>([]);
  const [voids, setVoids] = useState<VoidRecord[]>([]);
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [batchTxs, setBatchTxs] = useState<TillTx[]>([]);
  const [pl, setPl] = useState<PLData | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'batch' | 'voids' | 'pl'>('transactions');

  // Consent modal
  const [showConsent, setShowConsent] = useState(false);
  const [consentPin, setConsentPin] = useState('');
  const [consentTick, setConsentTick] = useState(false);

  // Void action modal
  const [voidAction, setVoidAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [voidNote, setVoidNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Load depts ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API_BASE}/api/accounting/dept/list`)
      .then(r => r.json())
      .then(d => {
        if (d.status === 'SUCCESS') {
          setDepts(d.departments);
          if (d.departments.length > 0) setSelectedDept(d.departments[0].id);
        }
      }).catch(() => {});
  }, []);

  // ── Load dept data when dept changes ────────────────────────────────────────

  const loadDeptData = useCallback(async () => {
    if (!selectedDept) return;
    try {
      const [batchRes, plRes, voidsRes] = await Promise.all([
        fetch(`${API_BASE}/api/accounting/dept/${selectedDept}/batch/current`).then(r => r.json()),
        fetch(`${API_BASE}/api/accounting/dept/${selectedDept}/pl`).then(r => r.json()),
        fetch(`${API_BASE}/api/accounting/dept/${selectedDept}/voids?status_filter=pending`).then(r => r.json()),
      ]);
      if (batchRes.status === 'SUCCESS' && batchRes.batch) {
        setBatch(batchRes.batch);
        setBatchTxs(batchRes.batch.transactions || []);
        setTxList(batchRes.batch.transactions || []);
      }
      if (plRes.status === 'SUCCESS') setPl(plRes.pl);
      if (voidsRes.status === 'SUCCESS') setVoids(voidsRes.voids);
    } catch { /* silent */ }
  }, [selectedDept]);

  useEffect(() => { loadDeptData(); }, [loadDeptData]);

  // ── Batch consent ────────────────────────────────────────────────────────────

  const submitConsent = async () => {
    if (!consentPin || consentPin.length < 4) return showToast('PIN must be 4+ digits.', 'error');
    if (!consentTick) return showToast('Check the certification box.', 'warning');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/${selectedDept}/batch/consent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...CALLER, pin: consentPin, batch_id: batch?.id })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast('✅ Batch consented. Ready to submit to Gateway.');
        setShowConsent(false); setConsentPin(''); setConsentTick(false);
        await loadDeptData();
      } else showToast(data.detail || 'Consent failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
    setLoading(false);
  };

  // ── Submit batch to gateway ──────────────────────────────────────────────────

  const submitToGateway = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/${selectedDept}/batch/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CALLER)
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast('🚀 Submitted to Ledger Auth Gateway. New batch opened.');
        await loadDeptData();
      } else showToast(data.detail || 'Submission failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
    setLoading(false);
  };

  // ── Void approve/reject ──────────────────────────────────────────────────────

  const handleVoidAction = async () => {
    if (!voidAction) return;
    setLoading(true);
    const endpoint = voidAction.action === 'approve'
      ? `/api/accounting/void/${voidAction.id}/dept-approve`
      : `/api/accounting/void/${voidAction.id}/dept-reject`;
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...CALLER, note: voidNote })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast(voidAction.action === 'approve' ? '✅ Void approved. Awaiting Accounts elimination.' : '❌ Void rejected.');
        setVoidAction(null); setVoidNote('');
        await loadDeptData();
      } else showToast(data.detail || 'Action failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
    setLoading(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const currentDept = depts.find(d => d.id === selectedDept);
  const batchProgress = batch ? Math.min(100, Math.round((batch.tx_count / 20) * 100)) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#050510 0%,#080820 100%)', color: '#e8e8f0', fontFamily: "'Inter', sans-serif", padding: 24 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10,
          fontWeight: 700, fontSize: 13, maxWidth: 360,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.95)' : toast.type === 'warning' ? 'rgba(234,179,8,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
        }}>{toast.msg}</div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          ZONE 11 — DEPARTMENTAL ACCOUNTING
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: 0 }}>
            🏦 Department Vault
          </h1>
          {/* Dept Selector */}
          <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(212,175,55,0.3)',
            color: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name} ({d.zone_id})</option>)}
          </select>
        </div>
      </div>

      {/* Batch Bar */}
      {batch && (
        <div style={{
          background: 'linear-gradient(135deg,rgba(15,15,35,0.95),rgba(20,20,50,0.95))',
          border: '1px solid rgba(212,175,55,0.25)', borderRadius: 14, padding: 20, marginBottom: 24
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: 1 }}>
                BATCH #{batch.batch_number} — {batch.tx_count}/20 TRANSACTIONS
              </span>
              <span style={{ marginLeft: 12 }}>{badge(batch.status)}</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {batch.status === 'PENDING_CONSENT' && (
                <button onClick={() => setShowConsent(true)} style={btnStyle('#d4af37', '#000')}>🔐 Consent Batch</button>
              )}
              {batch.status === 'CONSENTED' && (
                <button onClick={submitToGateway} disabled={loading} style={btnStyle('#6366f1', '#fff')}>
                  {loading ? '...' : '🚀 Submit to Gateway'}
                </button>
              )}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999, transition: 'width 0.6s ease',
              width: `${batchProgress}%`,
              background: batch.status === 'PENDING_CONSENT' ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#d4af37,#22c55e)'
            }} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#4ade80' }}>Revenue: {fmt(batch.total_revenue, currentDept?.currency)}</span>
            <span style={{ fontSize: 12, color: '#f87171' }}>Expenses: {fmt(batch.total_expense, currentDept?.currency)}</span>
            <span style={{ fontSize: 12, color: '#fbbf24' }}>Net: {fmt(batch.total_revenue - batch.total_expense, currentDept?.currency)}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, overflowX: 'auto' }}>
        {[['transactions', '📋 Transactions'], ['batch', '📦 Batch Detail'], ['voids', `🚫 Voids (${voids.length})`], ['pl', '📊 P&L']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key as typeof activeTab)} style={{
            flex: 1, minWidth: 100, padding: '10px 8px', borderRadius: 9, border: 'none',
            cursor: 'pointer', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', transition: 'all 0.2s',
            background: activeTab === key ? 'rgba(212,175,55,0.15)' : 'transparent',
            color: activeTab === key ? '#d4af37' : 'rgba(255,255,255,0.4)',
            borderBottom: activeTab === key ? '2px solid #d4af37' : '2px solid transparent'
          }}>{label}</button>
        ))}
      </div>

      {/* ── Transactions Tab ── */}
      {activeTab === 'transactions' && (
        <div style={{ background: 'rgba(15,15,35,0.9)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
            Current Batch Transactions
          </div>
          {txList.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No transactions in current batch.</div>
            : txList.map(tx => (
              <div key={tx.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr',
                padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                alignItems: 'center', gap: 12
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{tx.type}</div>
                  {badge(tx.status)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>{tx.description || tx.category_name || '—'}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{tx.staff_name} · {new Date(tx.created_at).toLocaleTimeString()}</div>
                  <div style={{ fontSize: 10, color: 'rgba(212,175,55,0.5)', marginTop: 2 }}>Dr {tx.gl_debit} / Cr {tx.gl_credit}</div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tx.payment_method}</div>
                <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 800, color: tx.direction === 'IN' ? '#4ade80' : '#f87171' }}>
                  {tx.direction === 'IN' ? '+' : '−'}{fmt(tx.amount, currentDept?.currency)}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Batch Detail Tab ── */}
      {activeTab === 'batch' && batch && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(15,15,35,0.9)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(212,175,55,0.7)', marginBottom: 16 }}>BATCH SUMMARY — #{batch.batch_number}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
              {[
                { label: 'TX Count', value: `${batch.tx_count}/20`, color: '#94a3b8' },
                { label: 'Revenue', value: fmt(batch.total_revenue, currentDept?.currency), color: '#4ade80' },
                { label: 'Expense', value: fmt(batch.total_expense, currentDept?.currency), color: '#f87171' },
                { label: 'Net', value: fmt(batch.total_revenue - batch.total_expense, currentDept?.currency), color: batch.total_revenue - batch.total_expense >= 0 ? '#4ade80' : '#f87171' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label.toUpperCase()}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            {batch.consent_at && (
              <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Consented by {batch.dept_head_name} at {new Date(batch.consent_at).toLocaleString()}
              </div>
            )}
          </div>

          {/* Double-entry preview */}
          <div style={{ background: 'rgba(15,15,35,0.9)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 700, color: 'rgba(212,175,55,0.6)' }}>
              DOUBLE-ENTRY PREVIEW — Iron Law 69
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Description', 'Dr Account', 'Cr Account', 'Amount'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Amount' ? 'right' : 'left', color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batchTxs.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 16px', color: '#e8e8f0' }}>{tx.description || tx.category_name}</td>
                    <td style={{ padding: '10px 16px', color: '#60a5fa', fontFamily: 'monospace' }}>{tx.gl_debit}</td>
                    <td style={{ padding: '10px 16px', color: '#a78bfa', fontFamily: 'monospace' }}>{tx.gl_credit}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: tx.direction === 'IN' ? '#4ade80' : '#f87171' }}>
                      {fmt(tx.amount, currentDept?.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Voids Tab ── */}
      {activeTab === 'voids' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {voids.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14, background: 'rgba(15,15,35,0.9)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>No pending voids.</div>
            : voids.map(v => (
              <div key={v.id} style={{ background: 'rgba(15,15,35,0.9)', borderRadius: 14, border: '1px solid rgba(239,68,68,0.2)', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>
                      {v.reason_code.replace(/_/g, ' ')} — {fmt(v.amount, currentDept?.currency)}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      By {v.requested_by_name} · {new Date(v.requested_at).toLocaleString()}
                    </div>
                    {v.reason && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>"{v.reason}"</div>}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, fontFamily: 'monospace' }}>TX: {v.tx_id}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!v.dept_head_approved && (
                      <>
                        <button onClick={() => setVoidAction({ id: v.id, action: 'approve' })} style={btnStyle('#22c55e', '#fff')}>✅ Approve</button>
                        <button onClick={() => setVoidAction({ id: v.id, action: 'reject' })} style={btnStyle('#ef4444', '#fff')}>❌ Reject</button>
                      </>
                    )}
                    {v.dept_head_approved && !v.accounts_eliminated && (
                      <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>Awaiting Accounts Elimination</span>
                    )}
                    {v.accounts_eliminated && (
                      <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>✅ Eliminated</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── P&L Tab ── */}
      {activeTab === 'pl' && pl && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {[
            { label: 'Gross Revenue', value: fmt(pl.gross_revenue, currentDept?.currency), color: '#4ade80', icon: '📈' },
            { label: 'Void Adjustments', value: `− ${fmt(pl.void_adjustments, currentDept?.currency)}`, color: '#f87171', icon: '🚫' },
            { label: 'Net Revenue', value: fmt(pl.net_revenue, currentDept?.currency), color: '#60a5fa', icon: '💰' },
            { label: 'Total Expenses', value: `− ${fmt(pl.total_expenses, currentDept?.currency)}`, color: '#f87171', icon: '🧾' },
            { label: 'Net Operating Income', value: fmt(pl.net_operating_income, currentDept?.currency), color: pl.net_operating_income >= 0 ? '#d4af37' : '#ef4444', icon: '🏛️' },
            { label: 'Gross Margin', value: `${pl.gross_margin_pct}%`, color: '#a78bfa', icon: '📊' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'linear-gradient(135deg,rgba(15,15,35,0.95),rgba(20,20,50,0.95))',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Consent Modal ── */}
      {showConsent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'linear-gradient(135deg,#0f0f23,#1a1a3e)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, border: '1px solid rgba(212,175,55,0.4)' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#d4af37', marginBottom: 8 }}>🔐 Batch #{batch?.batch_number} Consent</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24, lineHeight: 1.7 }}>
              You are certifying {batch?.tx_count} transactions totaling {fmt(batch?.total_revenue || 0)} revenue and {fmt(batch?.total_expense || 0)} expenses are accurate and authorized.
            </div>
            <input type="password" placeholder="Enter 4-digit PIN" value={consentPin} onChange={e => setConsentPin(e.target.value)}
              maxLength={8} style={{ ...iStyle, marginBottom: 16, textAlign: 'center', fontSize: 22, letterSpacing: 10 }} />
            <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 24 }}>
              <input type="checkbox" checked={consentTick} onChange={e => setConsentTick(e.target.checked)} style={{ marginTop: 3, accentColor: '#d4af37' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                I certify I have personally reviewed all transactions and accept accountability for this batch.
              </span>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowConsent(false); setConsentPin(''); setConsentTick(false); }}
                style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 700 }}>
                Cancel
              </button>
              <button onClick={submitConsent} disabled={loading}
                style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 900, background: 'linear-gradient(135deg,#d4af37,#b8960c)', color: '#000' }}>
                {loading ? '...' : '✅ CONSENT & SEAL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Void Action Modal ── */}
      {voidAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'linear-gradient(135deg,#0f0f23,#1a1a3e)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, border: `1px solid ${voidAction.action === 'approve' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, color: voidAction.action === 'approve' ? '#4ade80' : '#f87171' }}>
              {voidAction.action === 'approve' ? '✅ Approve Void' : '❌ Reject Void'}
            </div>
            <textarea placeholder="Note / reason (optional)" value={voidNote} onChange={e => setVoidNote(e.target.value)}
              rows={3} style={{ ...iStyle, resize: 'none', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setVoidAction(null)} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button onClick={handleVoidAction} disabled={loading} style={{
                flex: 2, padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 900,
                background: voidAction.action === 'approve' ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#ef4444,#b91c1c)',
                color: '#fff'
              }}>{loading ? '...' : `Confirm ${voidAction.action === 'approve' ? 'Approve' : 'Reject'}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontWeight: 800, fontSize: 12, background: bg, color
});

const iStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 9, fontSize: 14,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', outline: 'none', boxSizing: 'border-box', display: 'block'
};
