'use client';

/**
 * LEDGER AUTH GATEWAY — DEPARTMENT BATCH PANEL (Phase 6D)
 * =========================================================
 * Route: /dashboard/accounts/gateway  (or embedded as tab in accounts)
 * Access: ACCOUNTS, GM, ADMIN, CDO
 *
 * Displays all submitted department batches awaiting accounts review.
 * Actions: APPROVE (auto-posts to Master Ledger) | QUERY | REJECT
 * Void Elimination panel: separately eliminates dept-head-approved voids.
 *
 * Iron Law 66: Approval auto-posts to master_ledger (APPEND-ONLY)
 * Iron Law 67: Void elimination requires dept_head_approved=1 first
 */

import React, { useState, useEffect, useCallback } from 'react';

// Strip trailing /api from NEXT_PUBLIC_API_URL so fetch calls that prefix /api/ don't double-up
const _RAW_API = process.env.NEXT_PUBLIC_API_URL || 'https://miracle.vigilantitsolution.com/api';
const API_BASE = _RAW_API.endsWith('/api') ? _RAW_API.slice(0, -4) : _RAW_API;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GatewayBatch {
  id: string;
  dept_id: string;
  dept_name: string;
  batch_number: number;
  tx_count: number;
  total_revenue: number;
  total_expense: number;
  total_voids: number;
  status: string;
  dept_head_name: string;
  consent_at: string;
  gateway_reviewer: string;
  gateway_action: string;
  gateway_note: string;
  gateway_at: string;
  posted_at: string;
  created_at: string;
}

interface BatchDetail {
  batch: Record<string, unknown>;
  transactions: Array<Record<string, unknown>>;
  ledger_entries: Array<Record<string, unknown>>;
  voids: Array<Record<string, unknown>>;
}

interface VoidRecord {
  id: string;
  tx_id: string;
  dept_id: string;
  amount: number;
  reason_code: string;
  reason: string;
  requested_by_name: string;
  requested_at: string;
  dept_head_approved: number;
  dept_head_at: string;
  accounts_eliminated: number;
  dept_name?: string;
  tx_amount?: number;
}

const CALLER = {
  caller_id: 'accounts_001',
  caller_role: 'ACCOUNTS',
  caller_username: 'accounts.officer',
};

const fmt = (n: number | undefined, cur = 'PKR') =>
  `${cur} ${(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

const statusColor: Record<string, string> = {
  SUBMITTED: '#60a5fa',
  QUERIED:   '#fb923c',
  APPROVED:  '#4ade80',
  POSTED:    '#818cf8',
  REJECTED:  '#f87171',
  OPEN:      '#94a3b8',
};

function StatusBadge({ status }: { status: string }) {
  const color = statusColor[status] || '#94a3b8';
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
      background: `${color}18`, color, border: `1px solid ${color}44`, letterSpacing: 0.5
    }}>{status}</span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LedgerGatewayDept() {
  const [batches, setBatches] = useState<GatewayBatch[]>([]);
  const [voids, setVoids] = useState<VoidRecord[]>([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [pendingVoids, setPendingVoids] = useState(0);

  const [detailBatch, setDetailBatch] = useState<BatchDetail | null>(null);
  const [detailBatchId, setDetailBatchId] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  // Action modals
  const [action, setAction] = useState<{ batchId: string; type: 'approve' | 'query' | 'reject' } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [forceApprove, setForceApprove] = useState(false);
  const [forceReason, setForceReason] = useState('');

  // Void elimination
  const [eliminateVoidId, setEliminateVoidId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchBatches = useCallback(async () => {
    try {
      let url = `${API_BASE}/api/accounting/gateway/queue?status_filter=${statusFilter}`;
      if (deptFilter) url += `&dept_id=${deptFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setBatches(data.batches);
        setPendingVoids(data.pending_voids_total);
      }
    } catch { /* silent */ }
  }, [statusFilter, deptFilter]);

  const fetchPendingVoids = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/accounting/master/void-report`);
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setVoids(data.pending_elimination);
      }
    } catch { /* silent */ }
  }, []);

  const fetchDepts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/list`);
      const data = await res.json();
      if (data.status === 'SUCCESS') setDepts(data.departments);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchDepts();
  }, [fetchDepts]);

  useEffect(() => {
    fetchBatches();
    fetchPendingVoids();
  }, [fetchBatches, fetchPendingVoids, statusFilter, deptFilter]);

  // ── View batch detail ───────────────────────────────────────────────────────

  const viewDetail = async (batchId: string) => {
    setDetailBatchId(batchId);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/gateway/batch/${batchId}/detail`);
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setDetailBatch(data);
        setShowDetail(true);
      }
    } catch { showToast('Failed to load batch detail.', 'error'); }
  };

  // ── Execute action ──────────────────────────────────────────────────────────

  const executeAction = async () => {
    if (!action) return;
    setLoading(true);

    const endpoints: Record<string, string> = {
      approve: `/api/accounting/gateway/batch/${action.batchId}/approve`,
      query:   `/api/accounting/gateway/batch/${action.batchId}/query`,
      reject:  `/api/accounting/gateway/batch/${action.batchId}/reject`,
    };

    const body: Record<string, unknown> = {
      ...CALLER,
      note: actionNote,
    };
    if (action.type === 'approve' && forceApprove) {
      body.force_approve = true;
      body.force_reason = forceReason;
    }

    try {
      const res = await fetch(`${API_BASE}${endpoints[action.type]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast(
          action.type === 'approve' ? `✅ Batch APPROVED. ${data.entries_posted} entries posted to Master Ledger.` :
          action.type === 'query'   ? '💬 Batch QUERIED. Returned to Department Head.' :
                                      '❌ Batch REJECTED. Returned to Department Head.'
        );
        setAction(null); setActionNote(''); setForceApprove(false); setForceReason('');
        setShowDetail(false);
        fetchBatches();
      } else {
        showToast(data.detail || 'Action failed.', 'error');
      }
    } catch { showToast('Network error.', 'error'); }
    setLoading(false);
  };

  // ── Eliminate void ──────────────────────────────────────────────────────────

  const eliminateVoid = async (voidId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/gateway/void/${voidId}/eliminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CALLER),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast('✅ Void eliminated. Contra entry posted to Master Ledger.');
        setEliminateVoidId(null);
        fetchPendingVoids();
      } else {
        showToast(data.detail || 'Elimination failed.', 'error');
      }
    } catch { showToast('Network error.', 'error'); }
    setLoading(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const tabs = ['SUBMITTED', 'QUERIED', 'POSTED', 'REJECTED'];

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(180deg,#050510 0%,#080820 100%)',
      color: '#e8e8f0', fontFamily: "'Inter', sans-serif", padding: 24
    }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px',
          borderRadius: 10, fontWeight: 700, fontSize: 13, maxWidth: 380,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.95)' :
                      toast.type === 'warning' ? 'rgba(234,179,8,0.95)' :
                      'rgba(239,68,68,0.95)',
          color: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
        }}>{toast.msg}</div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          ZONE Z-DEPT-GW — DEPARTMENTAL BATCH GATEWAY
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: 0 }}>
            🔏 Departmental Batch Gateway
          </h1>
          {pendingVoids > 0 && (
            <span style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171', borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 800
            }}>
              {pendingVoids} VOID{pendingVoids > 1 ? 'S' : ''} AWAITING ELIMINATION
            </span>
          )}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>
          Department batches submitted by heads for Accounts review. Approval auto-posts to Master Ledger (Iron Law 66).
        </p>
      </div>

      {/* KPI Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Submitted', value: batches.filter(b => b.status === 'SUBMITTED').length, color: '#60a5fa' },
          { label: 'Queried', value: batches.filter(b => b.status === 'QUERIED').length, color: '#fb923c' },
          { label: 'Posted Today', value: batches.filter(b => b.status === 'POSTED').length, color: '#4ade80' },
          { label: 'Voids Pending', value: pendingVoids, color: '#f87171' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '14px 16px'
          }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 6 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters Row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setStatusFilter(t)} style={{
              padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontWeight: 800, fontSize: 11, transition: 'all 0.2s',
              background: statusFilter === t ? `${statusColor[t]}22` : 'transparent',
              color: statusFilter === t ? statusColor[t] : 'rgba(255,255,255,0.4)',
              borderBottom: statusFilter === t ? `2px solid ${statusColor[t]}` : '2px solid transparent'
            }}>{t}</button>
          ))}
        </div>
        {/* Dept Filter */}
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer'
        }}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={() => { fetchBatches(); fetchPendingVoids(); }} style={{
          padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
          background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 700, fontSize: 12
        }}>🔄 Refresh</button>
      </div>

      {/* Batch Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {batches.length === 0 ? (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 15
          }}>
            ✅ No {statusFilter.toLowerCase()} batches.
          </div>
        ) : batches.map(batch => (
          <div key={batch.id} style={{
            background: 'linear-gradient(135deg,rgba(15,15,35,0.95),rgba(20,20,50,0.95))',
            border: `1px solid ${statusFilter === 'SUBMITTED' ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 14, padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              {/* Left: Batch info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                    {batch.dept_name}
                  </span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Batch #{batch.batch_number}</span>
                  <StatusBadge status={batch.status} />
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>
                    ↑ Revenue: {fmt(batch.total_revenue)}
                  </span>
                  <span style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>
                    ↓ Expense: {fmt(batch.total_expense)}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {batch.tx_count} tx · {batch.total_voids || 0} void(s)
                  </span>
                  {batch.dept_head_name && (
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      Consented by {batch.dept_head_name}
                    </span>
                  )}
                </div>
                {batch.gateway_note && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#fb923c', background: 'rgba(251,146,60,0.1)', padding: '6px 10px', borderRadius: 6 }}>
                    💬 {batch.gateway_note}
                  </div>
                )}
              </div>
              {/* Right: Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => viewDetail(batch.id)} style={actionBtn('#6366f1', '#fff')}>
                  🔍 View Detail
                </button>
                {batch.status === 'SUBMITTED' && (
                  <>
                    <button onClick={() => setAction({ batchId: batch.id, type: 'approve' })} style={actionBtn('#22c55e', '#fff')}>
                      ✅ Approve
                    </button>
                    <button onClick={() => setAction({ batchId: batch.id, type: 'query' })} style={actionBtn('#fb923c', '#fff')}>
                      💬 Query
                    </button>
                    <button onClick={() => setAction({ batchId: batch.id, type: 'reject' })} style={actionBtn('#ef4444', '#fff')}>
                      ❌ Reject
                    </button>
                  </>
                )}
                {batch.status === 'QUERIED' && (
                  <button onClick={() => setAction({ batchId: batch.id, type: 'approve' })} style={actionBtn('#22c55e', '#fff')}>
                    ✅ Approve (after response)
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Void Elimination Panel ── */}
      {voids.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#f87171', marginBottom: 14, letterSpacing: 0.5 }}>
            🚫 VOID ELIMINATION QUEUE (Iron Law 67 — Accounts Step)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {voids.map(v => (
              <div key={v.id} style={{
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: 12
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>
                    {v.reason_code.replace(/_/g, ' ')} — {fmt(v.amount)}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    Requested by {v.requested_by_name} · Dept Head Approved ✅ · Pending Accounts Elimination
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                    TX: {v.tx_id}
                  </div>
                </div>
                <button
                  onClick={() => setEliminateVoidId(v.id)}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 12, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff' }}
                >
                  ⚡ Eliminate Void
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Batch Detail Drawer ── */}
      {showDetail && detailBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{
            background: 'linear-gradient(135deg,#0a0a1a,#111130)', borderRadius: 16,
            width: '100%', maxWidth: 820, maxHeight: '90vh', overflow: 'auto',
            border: '1px solid rgba(212,175,55,0.3)', boxShadow: '0 30px 80px rgba(0,0,0,0.8)'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#d4af37' }}>
                🔍 Batch Detail — {(detailBatch.batch as Record<string,unknown>)['dept_name'] as string} #{(detailBatch.batch as Record<string,unknown>)['batch_number'] as number}
              </div>
              <button onClick={() => setShowDetail(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            {/* Transaction table */}
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(212,175,55,0.6)', marginBottom: 12 }}>TRANSACTIONS ({detailBatch.transactions.length})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 24 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {['Type', 'Description', 'Staff', 'Dr Account', 'Cr Account', 'Amount'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Amount' ? 'right' : 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailBatch.transactions.map((tx, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{String(tx['type'])}</td>
                      <td style={{ padding: '8px 12px', color: '#e8e8f0' }}>{String(tx['description'] || tx['category_name'] || '—')}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.4)' }}>{String(tx['staff_name'])}</td>
                      <td style={{ padding: '8px 12px', color: '#60a5fa', fontFamily: 'monospace', fontSize: 11 }}>{String(tx['gl_debit'])}</td>
                      <td style={{ padding: '8px 12px', color: '#a78bfa', fontFamily: 'monospace', fontSize: 11 }}>{String(tx['gl_credit'])}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: tx['direction'] === 'IN' ? '#4ade80' : '#f87171' }}>
                        {tx['direction'] === 'IN' ? '+' : '−'}{fmt(Number(tx['amount']))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Void list if any */}
              {detailBatch.voids.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>VOIDS IN BATCH ({detailBatch.voids.length})</div>
                  {detailBatch.voids.map((v, i) => (
                    <div key={i} style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 12 }}>
                      <span style={{ color: '#f87171', fontWeight: 700 }}>{String(v['reason_code'])}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 12 }}>Dept Head: {v['dept_head_approved'] ? '✅ Approved' : '⏳ Pending'}</span>
                    </div>
                  ))}
                </>
              )}

              {/* Action buttons inside drawer */}
              {((detailBatch.batch as Record<string,unknown>)['status'] === 'SUBMITTED' || (detailBatch.batch as Record<string,unknown>)['status'] === 'QUERIED') && (
                <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button onClick={() => { setShowDetail(false); setAction({ batchId: detailBatchId, type: 'approve' }); }} style={actionBtn('#22c55e', '#fff')}>✅ Approve & Post</button>
                  <button onClick={() => { setShowDetail(false); setAction({ batchId: detailBatchId, type: 'query' }); }} style={actionBtn('#fb923c', '#fff')}>💬 Query</button>
                  <button onClick={() => { setShowDetail(false); setAction({ batchId: detailBatchId, type: 'reject' }); }} style={actionBtn('#ef4444', '#fff')}>❌ Reject</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Action Modal (Approve / Query / Reject) ── */}
      {action && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{
            background: 'linear-gradient(135deg,#0f0f23,#1a1a3e)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460,
            border: `1px solid ${action.type === 'approve' ? 'rgba(34,197,94,0.4)' : action.type === 'query' ? 'rgba(251,146,60,0.4)' : 'rgba(239,68,68,0.4)'}`
          }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, color: action.type === 'approve' ? '#4ade80' : action.type === 'query' ? '#fb923c' : '#f87171' }}>
              {action.type === 'approve' ? '✅ Approve Batch' : action.type === 'query' ? '💬 Query Batch' : '❌ Reject Batch'}
            </div>
            {action.type === 'approve' && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 12, color: '#4ade80', lineHeight: 1.6 }}>
                Approving will auto-post all ledger entries to the Master Ledger (Iron Law 66 — APPEND-ONLY, irreversible).
              </div>
            )}
            <textarea
              placeholder={action.type === 'approve' ? 'Note (optional)' : action.type === 'query' ? 'Your question to the Department Head (min 5 chars)' : 'Rejection reason (min 10 chars)'}
              value={actionNote} onChange={e => setActionNote(e.target.value)}
              rows={3} style={textareaStyle}
            />
            {action.type === 'approve' && CALLER.caller_role === 'CDO' && (
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={forceApprove} onChange={e => setForceApprove(e.target.checked)} style={{ accentColor: '#d4af37', marginTop: 2 }} />
                <span style={{ fontSize: 12, color: '#fbbf24' }}>CDO Force-Approve (bypasses all checks)</span>
              </label>
            )}
            {forceApprove && (
              <textarea placeholder="Force-approval reason (min 10 chars)" value={forceReason} onChange={e => setForceReason(e.target.value)}
                rows={2} style={{ ...textareaStyle, marginTop: 10, borderColor: 'rgba(212,175,55,0.4)' }} />
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setAction(null); setActionNote(''); setForceApprove(false); setForceReason(''); }}
                style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 700 }}>
                Cancel
              </button>
              <button onClick={executeAction} disabled={loading} style={{
                flex: 2, padding: 12, borderRadius: 8, border: 'none', cursor: loading ? 'default' : 'pointer', fontWeight: 900,
                background: loading ? 'rgba(255,255,255,0.08)' :
                  action.type === 'approve' ? 'linear-gradient(135deg,#22c55e,#16a34a)' :
                  action.type === 'query' ? 'linear-gradient(135deg,#fb923c,#ea580c)' :
                  'linear-gradient(135deg,#ef4444,#b91c1c)',
                color: loading ? 'rgba(255,255,255,0.3)' : '#fff'
              }}>{loading ? 'Processing...' : `Confirm ${action.type.charAt(0).toUpperCase() + action.type.slice(1)}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Void Elimination Confirm Modal ── */}
      {eliminateVoidId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'linear-gradient(135deg,#0f0f23,#1a1a3e)', borderRadius: 16, padding: 28, maxWidth: 420, width: '100%', border: '1px solid rgba(239,68,68,0.4)' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f87171', marginBottom: 12 }}>⚡ Eliminate Void</div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24, lineHeight: 1.7 }}>
              This will post a <strong style={{ color: '#fff' }}>contra entry</strong> to the Master Ledger reversing the voided transaction. This action is irreversible (Iron Law 66).
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEliminateVoidId(null)} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button onClick={() => eliminateVoid(eliminateVoidId)} disabled={loading}
                style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 900, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff' }}>
                {loading ? 'Eliminating...' : '⚡ Confirm Elimination'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const actionBtn = (bg: string, color: string): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontWeight: 800, fontSize: 12, background: bg, color, whiteSpace: 'nowrap'
});

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 9, fontSize: 13,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', outline: 'none', boxSizing: 'border-box', resize: 'none', display: 'block',
  fontFamily: "'Inter', sans-serif"
};
