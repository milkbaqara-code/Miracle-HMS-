'use client';

/**
 * DEPT TILL PANEL — MIRACLE HMS PHASE 6B
 * =========================================================
 * Embeds into any zone page (Z-06 POS, Z-27 Wellness, Z-29 F&B, Z-28 Boutique, Z-26 Fleet, Z-3B Rentals)
 *
 * IRON LAWS ENFORCED (frontend):
 *   Iron Law 64: Expense category MUST be UUID from catalog — NO freeform text
 *   Iron Law 65: Blocks entry when batch is PENDING_CONSENT
 *   Iron Law 68: Blocks expense when amount > till balance
 *
 * USAGE:
 *   <DeptTillPanel deptId="DEPT_WELLNESS" deptName="Med-Spa & Wellness" callerRole="DEPT_HEAD" callerId="user123" callerUsername="sara.khan" />
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Strip trailing /api suffix so fetch paths like `/api/accounting/...` don't double up
const _RAW_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.vigilantitsolution.com';
const API_BASE = _RAW_BASE.replace(/\/api\/?$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

interface TillStatus {
  till_balance: number;
  revenue_today: number;
  expense_today: number;
  voids_today: number;
  currency: string;
  dept_name: string;
  batch: {
    id: string;
    batch_number: number;
    tx_count: number;
    total_revenue: number;
    total_expense: number;
    status: string;
  } | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
  gl_code: string;
  per_tx_limit: number;
  daily_limit: number;
  requires_pin_above: number;
  active: number;
}

interface DeptTillPanelProps {
  deptId: string;
  deptName?: string;
  callerRole?: string;
  callerId?: string;
  callerUsername?: string;
  compact?: boolean;
}

// Payment method options
const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTA_CREDIT', 'ROOM_CHARGE', 'CHEQUE', 'DIGITAL_WALLET'];
const REVENUE_TYPES = ['TREATMENT_FEE', 'ROOM_REVENUE', 'FB_SALES', 'RETAIL_SALES', 'COMMISSION_INCOME', 'MEMBERSHIP_FEE', 'RENTAL_INCOME', 'SERVICE_CHARGE', 'CANCELLATION_FEE', 'MISCELLANEOUS'];
const VOID_REASONS = ['GUEST_COMPLAINT', 'ENTRY_ERROR', 'SYSTEM_ERROR', 'MANAGER_OVERRIDE', 'PRICE_CORRECTION', 'FRAUD_INVESTIGATION'];

// ─── Utility ──────────────────────────────────────────────────────────────────

const fmt = (n: number, cur = 'PKR') => `${cur} ${n.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

const callerPayload = (callerId: string, callerRole: string, callerUsername: string) => ({
  caller_id: callerId,
  caller_role: callerRole,
  caller_username: callerUsername,
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DeptTillPanel({ deptId, deptName, callerRole = 'STAFF', callerId = 'unknown', callerUsername = 'user', compact = false }: DeptTillPanelProps) {
  const [till, setTill] = useState<TillStatus | null>(null);
  const [catalog, setCatalog] = useState<ExpenseCategory[]>([]);
  const [activeTab, setActiveTab] = useState<'revenue' | 'expense' | 'float' | 'void'>('revenue');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Revenue form
  const [revAmount, setRevAmount] = useState('');
  const [revType, setRevType] = useState('FB_SALES');
  const [revMethod, setRevMethod] = useState('CASH');
  const [revRef, setRevRef] = useState('');
  const [revDesc, setRevDesc] = useState('');

  // Expense form
  const [expCatId, setExpCatId] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');

  // Float form
  const [floatAmount, setFloatAmount] = useState('');
  const [floatType, setFloatType] = useState<'FLOAT_TOPUP' | 'CASH_DROP'>('FLOAT_TOPUP');
  const [floatNote, setFloatNote] = useState('');

  // Void form
  const [voidTxId, setVoidTxId] = useState('');
  const [voidReason, setVoidReason] = useState('ENTRY_ERROR');
  const [voidNote, setVoidNote] = useState('');

  // Batch consent
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentPin, setConsentPin] = useState('');
  const [consentTick, setConsentTick] = useState(false);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchTill = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/${deptId}/till`);
      const data = await res.json();
      if (data.status === 'SUCCESS') setTill(data);
    } catch { /* silent */ }
  }, [deptId]);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/${deptId}/expense-catalog`);
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setCatalog(data.categories);
        if (data.categories.length > 0) setExpCatId(data.categories[0].id);
      }
    } catch { /* silent */ }
  }, [deptId]);

  useEffect(() => {
    fetchTill();
    fetchCatalog();
    refreshRef.current = setInterval(fetchTill, 15000); // refresh every 15s
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [fetchTill, fetchCatalog]);

  // ── Toast helper ─────────────────────────────────────────────────────────────

  const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Iron Law 65: Detect batch gate ──────────────────────────────────────────

  const isBatchBlocked = till?.batch?.status === 'PENDING_CONSENT';
  const isManager = ['DEPT_HEAD', 'DEPT_MANAGER', 'WELLNESS_MANAGER', 'GM', 'ADMIN', 'CDO'].includes(callerRole);

  // ── Revenue Submit ──────────────────────────────────────────────────────────

  const submitRevenue = async () => {
    if (!revAmount || parseFloat(revAmount) <= 0) return showToast('Enter a valid amount', 'error');
    if (isBatchBlocked) return showToast('[Law 65] Batch consent required before new entries.', 'warning');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/${deptId}/till/revenue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...callerPayload(callerId, callerRole, callerUsername),
          amount: parseFloat(revAmount),
          revenue_type: revType,
          payment_method: revMethod,
          reference_id: revRef,
          description: revDesc || revType,
        }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast(`Revenue recorded. New balance: ${fmt(data.new_till_balance)}`);
        setRevAmount(''); setRevRef(''); setRevDesc('');
        await fetchTill();
      } else {
        showToast(data.detail || 'Failed to record revenue.', 'error');
      }
    } catch { showToast('Network error. Try again.', 'error'); }
    setLoading(false);
  };

  // ── Expense Submit ──────────────────────────────────────────────────────────

  const submitExpense = async () => {
    // Iron Law 64: category_id mandatory
    if (!expCatId) return showToast('[Law 64] Select an expense category.', 'error');
    if (!expAmount || parseFloat(expAmount) <= 0) return showToast('Enter a valid amount.', 'error');
    if (isBatchBlocked) return showToast('[Law 65] Batch consent required before new entries.', 'warning');

    // Iron Law 68: Frontend pre-check
    if (till && parseFloat(expAmount) > till.till_balance) {
      return showToast(`[Law 68] Insufficient till balance. Current: ${fmt(till.till_balance)}`, 'warning');
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/${deptId}/till/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...callerPayload(callerId, callerRole, callerUsername),
          category_id: expCatId,
          amount: parseFloat(expAmount),
          note: expNote,
        }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast(`Expense recorded: ${data.category}. Balance: ${fmt(data.new_till_balance)}`);
        setExpAmount(''); setExpNote('');
        await fetchTill();
      } else {
        showToast(data.detail || 'Expense failed.', 'error');
      }
    } catch { showToast('Network error.', 'error'); }
    setLoading(false);
  };

  // ── Float Submit ────────────────────────────────────────────────────────────

  const submitFloat = async () => {
    if (!floatAmount || parseFloat(floatAmount) <= 0) return showToast('Enter a valid amount.', 'error');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/${deptId}/till/float`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...callerPayload(callerId, callerRole, callerUsername),
          amount: parseFloat(floatAmount),
          float_type: floatType,
          note: floatNote,
        }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast(`${floatType === 'FLOAT_TOPUP' ? '✅ Float added' : '🏦 Cash dropped'}. Balance: ${fmt(data.new_till_balance)}`);
        setFloatAmount(''); setFloatNote('');
        await fetchTill();
      } else {
        showToast(data.detail || 'Operation failed.', 'error');
      }
    } catch { showToast('Network error.', 'error'); }
    setLoading(false);
  };

  // ── Void Submit ─────────────────────────────────────────────────────────────

  const submitVoid = async () => {
    if (!voidTxId.trim()) return showToast('Enter a Transaction ID to void.', 'error');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/${deptId}/till/void-initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...callerPayload(callerId, callerRole, callerUsername),
          tx_id: voidTxId,
          reason_code: voidReason,
          reason: voidNote,
        }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast('Void request submitted. Awaiting Department Head approval.');
        setVoidTxId(''); setVoidNote('');
      } else {
        showToast(data.detail || 'Void failed.', 'error');
      }
    } catch { showToast('Network error.', 'error'); }
    setLoading(false);
  };

  // ── Batch Consent ────────────────────────────────────────────────────────────

  const submitConsent = async () => {
    if (!consentPin || consentPin.length < 4) return showToast('PIN must be at least 4 digits.', 'error');
    if (!consentTick) return showToast('You must certify the batch is accurate.', 'warning');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/${deptId}/batch/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...callerPayload(callerId, callerRole, callerUsername), pin: consentPin }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast('✅ Batch consented. Ready for submission to Gateway.');
        setShowConsentModal(false); setConsentPin(''); setConsentTick(false);
        await fetchTill();
      } else {
        showToast(data.detail || 'Consent failed.', 'error');
      }
    } catch { showToast('Network error.', 'error'); }
    setLoading(false);
  };

  // ── Submit Batch to Gateway ──────────────────────────────────────────────────

  const submitToGateway = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/dept/${deptId}/batch/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callerPayload(callerId, callerRole, callerUsername)),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showToast('🚀 Batch submitted to Ledger Auth Gateway. New batch opened.');
        await fetchTill();
      } else {
        showToast(data.detail || 'Submission failed.', 'error');
      }
    } catch { showToast('Network error.', 'error'); }
    setLoading(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const batch = till?.batch;
  const batchProgress = batch ? Math.min(100, Math.round((batch.tx_count / 20) * 100)) : 0;
  const selectedCat = catalog.find(c => c.id === expCatId);
  const pinRequired = selectedCat && expAmount && parseFloat(expAmount) >= selectedCat.requires_pin_above && selectedCat.requires_pin_above > 0;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(15,15,35,0.98) 0%, rgba(20,20,50,0.98) 100%)',
      border: '1px solid rgba(212,175,55,0.3)',
      borderRadius: compact ? 12 : 16,
      padding: compact ? 16 : 24,
      color: '#e8e8f0',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background shimmer */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)' }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 100,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.9)' : toast.type === 'warning' ? 'rgba(234,179,8,0.9)' : 'rgba(239,68,68,0.9)',
          color: '#fff', borderRadius: 8, padding: '10px 16px',
          fontSize: 13, fontWeight: 600, maxWidth: 320, boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(212,175,55,0.7)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
            Department Till
          </div>
          <div style={{ fontSize: compact ? 16 : 20, fontWeight: 800, color: '#fff' }}>
            {till?.dept_name || deptName || deptId}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Till Balance</div>
          <div style={{
            fontSize: compact ? 22 : 28, fontWeight: 900,
            color: (till?.till_balance || 0) < 1000 ? '#ef4444' : '#d4af37',
            textShadow: '0 0 20px rgba(212,175,55,0.4)'
          }}>
            {till ? fmt(till.till_balance, till.currency) : '—'}
          </div>
        </div>
      </div>

      {/* Today Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Revenue Today', value: till ? fmt(till.revenue_today, till.currency) : '—', color: '#4ade80' },
          { label: 'Expense Today', value: till ? fmt(till.expense_today, till.currency) : '—', color: '#f87171' },
          { label: 'Voids Today', value: till?.voids_today ?? '—', color: till?.voids_today ? '#fbbf24' : '#94a3b8' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, fontWeight: 600 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Batch Progress Bar */}
      {batch && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>
              BATCH #{batch.batch_number} — {batch.tx_count}/20 TRANSACTIONS
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
              background: batch.status === 'PENDING_CONSENT' ? 'rgba(234,179,8,0.2)' :
                          batch.status === 'CONSENTED'       ? 'rgba(34,197,94,0.2)' :
                          batch.status === 'POSTED'          ? 'rgba(99,102,241,0.2)' :
                                                               'rgba(255,255,255,0.1)',
              color:       batch.status === 'PENDING_CONSENT' ? '#fbbf24' :
                          batch.status === 'CONSENTED'        ? '#4ade80' :
                          batch.status === 'POSTED'           ? '#818cf8' :
                                                                '#94a3b8',
              border: '1px solid currentColor'
            }}>{batch.status}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999,
              width: `${batchProgress}%`,
              background: batch.status === 'PENDING_CONSENT' ? 'linear-gradient(90deg,#f59e0b,#ef4444)' :
                           'linear-gradient(90deg,#d4af37,#22c55e)',
              transition: 'width 0.6s ease'
            }} />
          </div>
          {/* Batch action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {batch.status === 'PENDING_CONSENT' && isManager && (
              <button onClick={() => setShowConsentModal(true)} style={{
                background: 'linear-gradient(135deg,#d4af37,#b8960c)', color: '#000',
                border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                fontWeight: 800, fontSize: 12, letterSpacing: 0.5
              }}>🔐 CONSENT BATCH</button>
            )}
            {batch.status === 'CONSENTED' && isManager && (
              <button onClick={submitToGateway} disabled={loading} style={{
                background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px',
                cursor: loading ? 'default' : 'pointer', fontWeight: 800, fontSize: 12
              }}>🚀 SUBMIT TO GATEWAY</button>
            )}
          </div>
          {/* IRON LAW 65 warning */}
          {isBatchBlocked && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)',
              color: '#fbbf24', fontSize: 12, fontWeight: 600
            }}>
              ⚠️ [Iron Law 65] Batch full — consent required before new entries
            </div>
          )}
        </div>
      )}

      {/* Action Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
        {([['revenue', '💰 Revenue'], ['expense', '🧾 Expense'], ...(isManager ? [['float', '🏦 Float']] : []), ['void', '🚫 Void']] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 7, border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.2s',
              background: activeTab === key ? 'linear-gradient(135deg,rgba(212,175,55,0.2),rgba(212,175,55,0.1))' : 'transparent',
              color: activeTab === key ? '#d4af37' : 'rgba(255,255,255,0.4)',
              borderBottom: activeTab === key ? '2px solid #d4af37' : '2px solid transparent'
            }}
          >{label}</button>
        ))}
      </div>

      {/* Form Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Revenue Tab ── */}
        {activeTab === 'revenue' && (
          <>
            <select value={revType} onChange={e => setRevType(e.target.value)} style={selectStyle}>
              {REVENUE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input placeholder="Amount" type="number" min="0" value={revAmount} onChange={e => setRevAmount(e.target.value)} style={inputStyle} />
              <select value={revMethod} onChange={e => setRevMethod(e.target.value)} style={selectStyle}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <input placeholder="Reference / Guest Name (optional)" value={revRef} onChange={e => setRevRef(e.target.value)} style={inputStyle} />
            <input placeholder="Description (optional)" value={revDesc} onChange={e => setRevDesc(e.target.value)} style={inputStyle} />
            <button onClick={submitRevenue} disabled={loading || isBatchBlocked} style={btnPrimary(isBatchBlocked || loading)}>
              {loading ? 'Recording...' : '+ Record Revenue'}
            </button>
          </>
        )}

        {/* ── Expense Tab ── */}
        {activeTab === 'expense' && (
          <>
            {/* Iron Law 64: Dropdown ONLY — no freeform */}
            <div style={{ position: 'relative' }}>
              <select value={expCatId} onChange={e => setExpCatId(e.target.value)} style={selectStyle}>
                {catalog.length === 0
                  ? <option value="">No categories available</option>
                  : catalog.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Limit: PKR {c.per_tx_limit.toLocaleString()}
                    </option>
                  ))
                }
              </select>
              <div style={{ fontSize: 10, color: 'rgba(212,175,55,0.6)', marginTop: 3, paddingLeft: 4 }}>
                [Iron Law 64] Pre-approved catalog only — GL: {selectedCat?.gl_code || '—'}
              </div>
            </div>
            <input placeholder="Amount" type="number" min="0" value={expAmount} onChange={e => setExpAmount(e.target.value)} style={inputStyle} />
            {pinRequired && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontSize: 12, fontWeight: 600 }}>
                ⚠️ Amount exceeds limit — Department Head PIN required at counter
              </div>
            )}
            <input placeholder="Note (optional)" value={expNote} onChange={e => setExpNote(e.target.value)} style={inputStyle} />
            <button onClick={submitExpense} disabled={loading || isBatchBlocked || catalog.length === 0} style={btnDanger(isBatchBlocked || loading || catalog.length === 0)}>
              {loading ? 'Recording...' : '− Record Expense'}
            </button>
          </>
        )}

        {/* ── Float Tab (Manager only) ── */}
        {activeTab === 'float' && isManager && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['FLOAT_TOPUP', 'CASH_DROP'] as const).map(ft => (
                <button key={ft} onClick={() => setFloatType(ft)} style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: '1px solid',
                  cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.2s',
                  borderColor: floatType === ft ? '#d4af37' : 'rgba(255,255,255,0.1)',
                  background: floatType === ft ? 'rgba(212,175,55,0.15)' : 'transparent',
                  color: floatType === ft ? '#d4af37' : 'rgba(255,255,255,0.4)'
                }}>
                  {ft === 'FLOAT_TOPUP' ? '↑ Add Float' : '↓ Cash Drop'}
                </button>
              ))}
            </div>
            <input placeholder="Amount" type="number" min="0" value={floatAmount} onChange={e => setFloatAmount(e.target.value)} style={inputStyle} />
            <input placeholder="Note / Reason" value={floatNote} onChange={e => setFloatNote(e.target.value)} style={inputStyle} />
            <button onClick={submitFloat} disabled={loading} style={btnFloat(loading)}>
              {loading ? 'Processing...' : floatType === 'FLOAT_TOPUP' ? '🏦 Add Float to Till' : '🏦 Drop Cash to Safe'}
            </button>
          </>
        )}

        {/* ── Void Tab ── */}
        {activeTab === 'void' && (
          <>
            <input placeholder="Transaction ID to void" value={voidTxId} onChange={e => setVoidTxId(e.target.value)} style={inputStyle} />
            <select value={voidReason} onChange={e => setVoidReason(e.target.value)} style={selectStyle}>
              {VOID_REASONS.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
            <input placeholder="Reason / Note (required for some codes)" value={voidNote} onChange={e => setVoidNote(e.target.value)} style={inputStyle} />
            <button onClick={submitVoid} disabled={loading} style={btnVoid(loading)}>
              {loading ? 'Submitting...' : '🚫 Submit Void Request'}
            </button>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
              [Iron Law 67] Void requires Department Head approval then Accounts elimination.
            </div>
          </>
        )}
      </div>

      {/* Batch Consent Modal */}
      {showConsentModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: 'linear-gradient(135deg,#0f0f23,#1a1a3e)', borderRadius: 16,
            padding: 32, width: '100%', maxWidth: 440,
            border: '1px solid rgba(212,175,55,0.4)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.8)'
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#d4af37', marginBottom: 6 }}>🔐 Batch Consent</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24, lineHeight: 1.6 }}>
              By entering your PIN and checking the box below, you certify that all {batch?.tx_count} transactions in Batch #{batch?.batch_number} are accurate and represent genuine, authorized operations.
            </div>
            <input
              type="password"
              placeholder="Enter your 4-digit PIN"
              value={consentPin}
              onChange={e => setConsentPin(e.target.value)}
              maxLength={8}
              style={{ ...inputStyle, marginBottom: 16, textAlign: 'center', fontSize: 20, letterSpacing: 8 }}
            />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 24 }}>
              <input type="checkbox" checked={consentTick} onChange={e => setConsentTick(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: '#d4af37' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                I certify that I have reviewed all transactions in this batch and accept personal accountability for their accuracy.
              </span>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowConsentModal(false); setConsentPin(''); setConsentTick(false); }} style={{
                flex: 1, padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 700
              }}>Cancel</button>
              <button onClick={submitConsent} disabled={loading} style={{
                flex: 2, padding: '12px', borderRadius: 8, border: 'none', cursor: loading ? 'default' : 'pointer',
                background: loading ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg,#d4af37,#b8960c)',
                color: '#000', fontWeight: 900, fontSize: 14
              }}>
                {loading ? 'Consenting...' : '✅ CONSENT & SEAL BATCH'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 9, fontSize: 14,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', outline: 'none', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '13px', borderRadius: 9, border: 'none',
  cursor: disabled ? 'default' : 'pointer', fontWeight: 800, fontSize: 14,
  background: disabled ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#d4af37,#b8960c)',
  color: disabled ? 'rgba(255,255,255,0.3)' : '#000',
  transition: 'all 0.2s', letterSpacing: 0.5
});

const btnDanger = (disabled: boolean): React.CSSProperties => ({
  ...btnPrimary(disabled),
  background: disabled ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#ef4444,#b91c1c)',
  color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
});

const btnFloat = (disabled: boolean): React.CSSProperties => ({
  ...btnPrimary(disabled),
  background: disabled ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
  color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
});

const btnVoid = (disabled: boolean): React.CSSProperties => ({
  ...btnPrimary(disabled),
  background: disabled ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#f97316,#c2410c)',
  color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
});
