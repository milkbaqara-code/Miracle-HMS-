'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useCurrencyLang } from '../../components/CurrencyLangContext';

// ============================================================
// TYPES — Sovereign Enterprise Audit V2.0
// ============================================================
interface AuditLine {
  account_code: number;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
}
interface AuditJournal {
  journal_id: number;
  reference_type: string;
  description: string;
  timestamp: string;
  total_debit: number;
  total_credit: number;
  balanced: boolean;
  variance: number;
  lines: AuditLine[];
}
interface AuditSummary {
  total_journals: number;
  total_debits: number;
  total_credits: number;
  variance: number;
  balanced: boolean;
}

interface TrialRow {
  code: number;
  name: string;
  type: string;
  total_debit: number;
  total_credit: number;
  balance_dr: number;
  balance_cr: number;
  has_activity: boolean;
}
interface TrialBalance {
  accounts: Record<string, TrialRow[]>;
  type_totals: Record<string, { debit: number; credit: number }>;
  grand_total: { debit: number; credit: number; variance: number; balanced: boolean };
}

interface NightAuditRoom {
  room: string;
  guest: string;
  nightly_rate: number;
  net_revenue: number;
  vat: number;
  sc: number;
  cogs: number;
}
interface NightAuditResult {
  status: string;
  audit_date: string;
  rooms_processed: number;
  total_recognized: number;
  journals: NightAuditRoom[];
  message: string;
}

// ============================================================
// CONSTANTS
// ============================================================
const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const REF_COLORS: Record<string, string> = {
  ROOM_SALE_REV:       '#00F2FF',
  POS_SALE:            '#D4AF37',
  OTA_COMMISSION:      '#E91E63',
  ADVANCE_DEPOSIT:     '#9D50BB',
  NIGHT_AUDIT:         '#00FF88',
  NIGHT_AUDIT_ACCRUAL: '#4CAF50',
  NIGHT_AUDIT_COGS:    '#FF6B35',
  VENDOR_PAYMENT:      '#FF3131',
  AR_RECONCILIATION:   '#00BCD4',
  COIN_EARNED:         '#FFD700',
  COIN_SPENT:          '#FFA500',
  MANUAL:              '#888888',
};
const ACCT_TYPE_COLOR: Record<string, string> = {
  ASSET:     '#00F2FF',
  LIABILITY: '#E91E63',
  EQUITY:    '#9D50BB',
  REVENUE:   '#00FF88',
  EXPENSE:   '#FF3131',
};
const TABS = ['JOURNAL LEDGER', 'TRIAL BALANCE', 'NIGHT AUDIT', 'Z-REPORT'];
const DATE_PRESETS = ['TODAY', 'THIS WEEK', 'THIS MONTH', 'ALL TIME'];

function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmt(now);
  if (preset === 'TODAY') return { from: today, to: today };
  if (preset === 'THIS WEEK') {
    const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1);
    return { from: fmt(mon), to: today };
  }
  if (preset === 'THIS MONTH') {
    return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: today };
  }
  return { from: '', to: '' };
}

// ============================================================

// ============================================================
// COMPONENT
// ============================================================
export default function EnterpriseAuditLedger() {
  const { formatMoney, currencySymbol } = useCurrencyLang();
  const isViewMode = useViewMode();
  const [activeTab, setActiveTab] = useState(0);

  // ── JOURNAL STATE ──────────────────────────────────────────
  const [journals, setJournals] = useState<AuditJournal[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [refTypes, setRefTypes] = useState<string[]>([]);
  const [selectedRef, setSelectedRef] = useState('ALL');
  const [datePreset, setDatePreset] = useState('ALL TIME');
  const [expandedJournal, setExpandedJournal] = useState<number | null>(null);
  const [journalLoading, setJournalLoading] = useState(true);
  const [networkStatus, setNetworkStatus] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');

  // ── TRIAL BALANCE STATE ────────────────────────────────────
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [showZeroBalance, setShowZeroBalance] = useState(false);

  // ── NIGHT AUDIT STATE ──────────────────────────────────────
  const [nightAuditResult, setNightAuditResult] = useState<NightAuditResult | null>(null);
  const [nightAuditRunning, setNightAuditRunning] = useState(false);

  // ── Z-REPORT STATE ─────────────────────────────────────────
  const [zReportDate, setZReportDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  // ── FETCH JOURNAL ──────────────────────────────────────────
  const fetchJournals = useCallback(async () => {
    setJournalLoading(true);
    const range = getPresetRange(datePreset);
    const params = new URLSearchParams();
    if (range.from) params.set('date_from', range.from + 'T00:00:00');
    if (range.to)   params.set('date_to',   range.to   + 'T23:59:59');
    if (selectedRef !== 'ALL') params.set('ref_type', selectedRef);
    params.set('limit', '300');
    try {
      const res = await fetch(`${API}/accounting/audit/transactions?${params}`);
      if (!res.ok) throw new Error('API error');
      const d = await res.json();
      if (d.status === 'SUCCESS') {
        setJournals(d.data);
        setAuditSummary(d.summary);
        setNetworkStatus('ONLINE');
      }
    } catch {
      setNetworkStatus('OFFLINE');
    } finally {
      setJournalLoading(false);
    }
  }, [datePreset, selectedRef]);

  const fetchRefTypes = useCallback(async () => {
    try {
      const res = await fetch(`${API}/accounting/audit/ref-types`);
      const d = await res.json();
      if (d.status === 'SUCCESS') setRefTypes(['ALL', ...d.data]);
    } catch {}
  }, []);

  const fetchTrialBalance = useCallback(async () => {
    setTrialLoading(true);
    try {
      const res = await fetch(`${API}/accounting/trial-balance`);
      const d = await res.json();
      if (d.status === 'SUCCESS') setTrialBalance(d);
    } catch {}
    finally { setTrialLoading(false); }
  }, []);

  const runNightAudit = async () => {
    setNightAuditRunning(true);
    setNightAuditResult(null);
    try {
      const res = await fetch(`${API}/accounting/night-audit/run`, { method: 'POST' });
      const d = await res.json();
      setNightAuditResult(d);
    } catch (e: any) {
      setNightAuditResult({ status: 'ERROR', message: 'Night Audit failed: ' + e.message, audit_date: '', rooms_processed: 0, total_recognized: 0, journals: [] });
    } finally {
      setNightAuditRunning(false);
    }
  };

  useEffect(() => { fetchJournals(); fetchRefTypes(); }, [fetchJournals, fetchRefTypes]);
  useEffect(() => { if (activeTab === 1) fetchTrialBalance(); }, [activeTab, fetchTrialBalance]);

  // ── Z-REPORT DERIVED ───────────────────────────────────────
  const zReportData = useMemo(() => {
    const dayJournals = journals.filter(j => j.timestamp.startsWith(zReportDate));
    const byRef: Record<string, { count: number; amount: number }> = {};
    let totalIn = 0, totalExp = 0;
    for (const j of dayJournals) {
      const ref = j.reference_type;
      if (!byRef[ref]) byRef[ref] = { count: 0, amount: 0 };
      byRef[ref].count++;
      byRef[ref].amount += j.total_debit;
      if (['ROOM_SALE_REV','POS_SALE','ADVANCE_DEPOSIT','NIGHT_AUDIT','NIGHT_AUDIT_ACCRUAL'].includes(ref)) totalIn += j.total_debit;
      if (['VENDOR_PAYMENT','OTA_COMMISSION','NIGHT_AUDIT_COGS'].includes(ref)) totalExp += j.total_debit;
    }
    return { byRef, totalIn, totalExp, netProfit: totalIn - totalExp, journalCount: dayJournals.length };
  }, [journals, zReportDate]);

  // ── CSV EXPORT ─────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [['Journal ID','Reference Type','Description','Timestamp','Total Debit','Total Credit','Balanced']];
    for (const j of journals) {
      rows.push([
        String(j.journal_id), j.reference_type, `"${j.description}"`,
        j.timestamp, String(j.total_debit), String(j.total_credit), j.balanced ? 'YES' : 'NO'
      ]);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sovereign-ledger-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportTrialCSV = () => {
    if (!trialBalance) return;
    const rows = [['Code','Account Name','Type','Total Debit','Total Credit','Balance DR','Balance CR']];
    for (const [, accts] of Object.entries(trialBalance.accounts)) {
      for (const a of accts) {
        rows.push([String(a.code), `"${a.name}"`, a.type, String(a.total_debit), String(a.total_credit), String(a.balance_dr), String(a.balance_cr)]);
      }
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `trial-balance-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={S.container} className={isViewMode ? 'zone-view-mode' : ''}>
      <ViewModeBanner />

      {/* ── SOVEREIGN HEADER ── */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>⚖️ SOVEREIGN AUDIT COMMAND</h1>
          <div style={S.subtitle}>ENTERPRISE GENERAL LEDGER · REAL-TIME DOUBLE-ENTRY INTELLIGENCE</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          {/* Balance status pill */}
          {auditSummary && (
            <div style={auditSummary.balanced ? S.pillBalanced : S.pillUnbalanced}>
              {auditSummary.balanced ? '✓ GL BALANCED' : `⚠ VARIANCE ${formatMoney(Math.abs(auditSummary.variance))}`}
            </div>
          )}
          <div style={networkStatus === 'ONLINE' ? S.netOnline : S.netOffline}>
            <span style={networkStatus === 'ONLINE' ? S.dotOn : S.dotOff} />
            {networkStatus === 'ONLINE' ? 'LEDGER SYNCED' : 'OFFLINE MODE'}
          </div>
          <button onClick={exportCSV} style={S.btnExport}>📥 EXPORT CSV</button>
          <button onClick={fetchJournals} disabled={journalLoading} style={S.btnRefresh}>
            {journalLoading ? '⟳ SYNCING...' : '🔄 REFRESH'}
          </button>
        </div>
      </div>

      {/* ── KPI BAR ── */}
      {auditSummary && (
        <div style={S.kpiBar}>
          <div style={S.kpiCard('#00F2FF')}>
            <div style={S.kpiLabel}>TOTAL JOURNALS</div>
            <div style={S.kpiVal}>{auditSummary.total_journals.toLocaleString()}</div>
          </div>
          <div style={S.kpiCard('#D4AF37')}>
            <div style={S.kpiLabel}>TOTAL DEBITS</div>
            <div style={S.kpiVal}>{formatMoney(auditSummary.total_debits)}</div>
          </div>
          <div style={S.kpiCard('#00FF88')}>
            <div style={S.kpiLabel}>TOTAL CREDITS</div>
            <div style={S.kpiVal}>{formatMoney(auditSummary.total_credits)}</div>
          </div>
          <div style={auditSummary.balanced ? S.kpiCard('#00FF88') : S.kpiCard('#FF3131')}>
            <div style={S.kpiLabel}>VARIANCE (Dr − Cr)</div>
            <div style={{ ...S.kpiVal, color: auditSummary.balanced ? '#00FF88' : '#FF3131' }}>
              {auditSummary.balanced ? `${currencySymbol} 0.00  ✓` : formatMoney(auditSummary.variance)}
            </div>
          </div>
          <div style={S.kpiCard('#9D50BB')}>
            <div style={S.kpiLabel}>GL STATUS</div>
            <div style={{ ...S.kpiVal, fontSize:'16px', color: auditSummary.balanced ? '#00FF88' : '#FF3131' }}>
              {auditSummary.balanced ? 'CLEAN ✓' : 'QUARANTINE ⚠'}
            </div>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={S.tabBar}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setActiveTab(i)} style={activeTab === i ? S.tabActive : S.tab}>
            {i === 0 && '📋 '}{i === 1 && '⚖️ '}{i === 2 && '🌙 '}{i === 3 && '📊 '}{t}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 0: JOURNAL LEDGER                                   */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 0 && (
        <div style={S.tabContent}>
          {/* Filters */}
          <div style={S.filterRow}>
            <div style={{ display:'flex', gap:'8px' }}>
              {DATE_PRESETS.map(p => (
                <button key={p} onClick={() => setDatePreset(p)}
                  style={datePreset === p ? S.filterPillActive : S.filterPill}>{p}</button>
              ))}
            </div>
            <select style={S.select} value={selectedRef} onChange={e => setSelectedRef(e.target.value)}>
              {(refTypes.length ? refTypes : ['ALL']).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Journal Table */}
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['#','REF TYPE','DESCRIPTION','TIMESTAMP','DEBIT','CREDIT','STATUS'].map(h => (
                    <th key={h} style={{ ...S.th, textAlign: ['DEBIT','CREDIT'].includes(h) ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {journalLoading && (
                  <tr><td colSpan={7} style={S.emptyCell}>
                    <div style={S.loadingPulse}>SYNCING SOVEREIGN LEDGER...</div>
                  </td></tr>
                )}
                {!journalLoading && journals.length === 0 && (
                  <tr><td colSpan={7} style={S.emptyCell}>No journal entries found for this filter.</td></tr>
                )}
                {!journalLoading && journals.map(j => (
                  <React.Fragment key={j.journal_id}>
                    <tr style={expandedJournal === j.journal_id ? S.trExpanded : S.tr}
                        onClick={() => setExpandedJournal(expandedJournal === j.journal_id ? null : j.journal_id)}>
                      <td style={S.td}><span style={S.journalId}>J-{j.journal_id}</span></td>
                      <td style={S.td}>
                        <span style={refPill(j.reference_type)}>{j.reference_type.replace(/_/g,' ')}</span>
                      </td>
                      <td style={{ ...S.td, maxWidth:'320px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#CCC' }}>
                        {j.description}
                      </td>
                      <td style={{ ...S.td, color:'#888', fontSize:'11px' }}>
                        {new Date(j.timestamp).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td style={{ ...S.td, textAlign:'right', color:'#FF9800' }}>{formatMoney(j.total_debit)}</td>
                      <td style={{ ...S.td, textAlign:'right', color:'#00F2FF' }}>{formatMoney(j.total_credit)}</td>
                      <td style={{ ...S.td, textAlign:'center' }}>
                        {j.balanced
                          ? <span style={S.balancedBadge}>✓ BAL</span>
                          : <span style={S.unbalancedBadge}>⚠ {j.variance.toFixed(2)}</span>}
                      </td>
                    </tr>
                    {expandedJournal === j.journal_id && (
                      <tr key={`exp-${j.journal_id}`}>
                        <td colSpan={7} style={{ padding:0 }}>
                          <div style={S.expandedPanel}>
                            <div style={S.expandedTitle}>
                              DOUBLE-ENTRY LEDGER — Journal #{j.journal_id}
                            </div>
                            <table style={{ ...S.table, margin:0 }}>
                              <thead>
                                <tr>
                                  {['ACCT CODE','ACCOUNT NAME','TYPE','DEBIT','CREDIT'].map(h => (
                                    <th key={h} style={{ ...S.th, background:'#0a0a0a', fontSize:'10px',
                                      textAlign:['DEBIT','CREDIT'].includes(h)?'right':'left' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {j.lines.map((l, li) => (
                                  <tr key={li} style={{ background: li%2===0?'rgba(255,255,255,0.01)':'transparent' }}>
                                    <td style={{ ...S.td, color:'#888', fontSize:'12px', fontFamily:'monospace' }}>{l.account_code}</td>
                                    <td style={{ ...S.td, fontSize:'12px' }}>{l.account_name}</td>
                                    <td style={{ ...S.td }}>
                                      <span style={{ color: ACCT_TYPE_COLOR[l.account_type] || '#888', fontSize:'10px', fontWeight:900 }}>
                                        {l.account_type}
                                      </span>
                                    </td>
                                    <td style={{ ...S.td, textAlign:'right', color: l.debit>0?'#FF9800':'#333', fontWeight: l.debit>0?900:400, fontFamily:'monospace' }}>
                                      {l.debit > 0 ? formatMoney(l.debit) : '—'}
                                    </td>
                                    <td style={{ ...S.td, textAlign:'right', color: l.credit>0?'#00F2FF':'#333', fontWeight: l.credit>0?900:400, fontFamily:'monospace' }}>
                                      {l.credit > 0 ? formatMoney(l.credit) : '—'}
                                    </td>
                                  </tr>
                                ))}
                                {/* Totals row */}
                                <tr style={{ borderTop:'2px solid #333' }}>
                                  <td colSpan={3} style={{ ...S.td, color:'#666', fontSize:'10px', fontWeight:900 }}>JOURNAL TOTALS</td>
                                  <td style={{ ...S.td, textAlign:'right', color:'#FF9800', fontWeight:900, fontFamily:'monospace' }}>{formatMoney(j.total_debit)}</td>
                                  <td style={{ ...S.td, textAlign:'right', color:'#00F2FF', fontWeight:900, fontFamily:'monospace' }}>{formatMoney(j.total_credit)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 1: TRIAL BALANCE                                    */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 1 && (
        <div style={S.tabContent}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
            <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
              <button onClick={fetchTrialBalance} style={S.btnRefresh}>🔄 REFRESH</button>
              <label style={{ display:'flex', gap:'8px', alignItems:'center', color:'#888', fontSize:'12px', cursor:'pointer' }}>
                <input type="checkbox" checked={showZeroBalance} onChange={e => setShowZeroBalance(e.target.checked)}
                  style={{ accentColor:'#00F2FF' }} />
                SHOW ZERO BALANCES
              </label>
            </div>
            <button onClick={exportTrialCSV} style={S.btnExport}>📥 EXPORT TRIAL BALANCE</button>
          </div>

          {/* Balanced Banner */}
          {trialBalance && (
            <div style={trialBalance.grand_total.balanced ? S.balanceBanner : S.unbalanceBanner}>
              {trialBalance.grand_total.balanced
                ? `✓  GENERAL LEDGER IS BALANCED — Total Debits ${formatMoney(trialBalance.grand_total.debit)} = Total Credits ${formatMoney(trialBalance.grand_total.credit)}`
                : `⚠  LEDGER VARIANCE DETECTED — Dr ${formatMoney(trialBalance.grand_total.debit)} ≠ Cr ${formatMoney(trialBalance.grand_total.credit)} | DIFF: ${formatMoney(Math.abs(trialBalance.grand_total.variance))}`
              }
            </div>
          )}

          {trialLoading && <div style={S.loadingPulse}>COMPUTING TRIAL BALANCE...</div>}

          {!trialLoading && trialBalance && (
            <div style={S.tableWrap}>
              {(['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'] as const).map(type => {
                const rows = (trialBalance.accounts[type] || []).filter(r => showZeroBalance || r.has_activity);
                const totals = trialBalance.type_totals[type];
                if (!rows.length) return null;
                return (
                  <div key={type} style={{ marginBottom:'30px' }}>
                    <div style={{ ...S.sectionHead, borderLeft:`4px solid ${ACCT_TYPE_COLOR[type]}` }}>
                      <span style={{ color: ACCT_TYPE_COLOR[type] }}>{type}</span> ACCOUNTS
                      <span style={{ color:'#888', marginLeft:'auto', fontSize:'11px' }}>
                        DR: {formatMoney(totals.debit)} &nbsp;|&nbsp; CR: {formatMoney(totals.credit)}
                      </span>
                    </div>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          {['CODE','ACCOUNT NAME','TOTAL DR','TOTAL CR','BALANCE DR','BALANCE CR'].map(h => (
                            <th key={h} style={{ ...S.th, textAlign: h==='ACCOUNT NAME'?'left':'right' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.code} style={S.tr}>
                            <td style={{ ...S.td, color:'#888', fontFamily:'monospace', textAlign:'right', width:'80px' }}>{r.code}</td>
                            <td style={{ ...S.td, color: r.has_activity ? '#FFF' : '#444' }}>{r.name}</td>
                            <td style={{ ...S.td, textAlign:'right', color:'#FF9800', fontFamily:'monospace' }}>
                              {r.total_debit > 0 ? formatMoney(r.total_debit) : '—'}
                            </td>
                            <td style={{ ...S.td, textAlign:'right', color:'#00F2FF', fontFamily:'monospace' }}>
                              {r.total_credit > 0 ? formatMoney(r.total_credit) : '—'}
                            </td>
                            <td style={{ ...S.td, textAlign:'right', fontWeight:900, fontFamily:'monospace', color: r.balance_dr > 0 ? '#FF9800' : '#333' }}>
                              {r.balance_dr > 0 ? formatMoney(r.balance_dr) : '—'}
                            </td>
                            <td style={{ ...S.td, textAlign:'right', fontWeight:900, fontFamily:'monospace', color: r.balance_cr > 0 ? '#00F2FF' : '#333' }}>
                              {r.balance_cr > 0 ? formatMoney(r.balance_cr) : '—'}
                            </td>
                          </tr>
                        ))}
                        {/* Type subtotal */}
                        <tr style={{ background:'rgba(255,255,255,0.03)', borderTop:'1px solid #333' }}>
                          <td colSpan={2} style={{ ...S.td, color:'#666', fontSize:'10px', fontWeight:900 }}>SUBTOTAL — {type}</td>
                          <td style={{ ...S.td, textAlign:'right', color:'#FF9800', fontWeight:900, fontFamily:'monospace' }}>{formatMoney(totals.debit)}</td>
                          <td style={{ ...S.td, textAlign:'right', color:'#00F2FF', fontWeight:900, fontFamily:'monospace' }}>{formatMoney(totals.credit)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {/* Grand Total Footer */}
              {trialBalance && (
                <div style={S.grandTotalFooter}>
                  <div style={S.grandLabel}>GRAND TOTAL</div>
                  <div style={{ display:'flex', gap:'60px' }}>
                    <div>
                      <div style={{ color:'#888', fontSize:'10px', marginBottom:'4px' }}>TOTAL DEBITS</div>
                      <div style={{ color:'#FF9800', fontSize:'20px', fontWeight:900, fontFamily:'monospace' }}>{formatMoney(trialBalance.grand_total.debit)}</div>
                    </div>
                    <div>
                      <div style={{ color:'#888', fontSize:'10px', marginBottom:'4px' }}>TOTAL CREDITS</div>
                      <div style={{ color:'#00F2FF', fontSize:'20px', fontWeight:900, fontFamily:'monospace' }}>{formatMoney(trialBalance.grand_total.credit)}</div>
                    </div>
                    <div>
                      <div style={{ color:'#888', fontSize:'10px', marginBottom:'4px' }}>VARIANCE</div>
                      <div style={{ color: trialBalance.grand_total.balanced ? '#00FF88' : '#FF3131', fontSize:'20px', fontWeight:900, fontFamily:'monospace' }}>
                        {trialBalance.grand_total.balanced ? `${currencySymbol} 0.00 ✓` : formatMoney(trialBalance.grand_total.variance)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 2: NIGHT AUDIT                                      */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 2 && (
        <div style={S.tabContent}>
          <div style={S.nightAuditHero}>
            <div style={S.nightAuditGlow} />
            <div style={{ position:'relative', zIndex:1 }}>
              <div style={S.nightAuditIcon}>🌙</div>
              <h2 style={S.nightAuditTitle}>NIGHT AUDIT ENGINE</h2>
              <p style={S.nightAuditDesc}>
                Posts nightly revenue recognition for all in-house guests.
                Converts deferred advance deposits into earned revenue on the General Ledger.
                Run once per night after last check-in.
              </p>
              <div style={S.nightAuditProcess}>
                {[
                  { step:'01', label:'QUERY IN-HOUSE', desc:'All GuestFolios with status = IN_HOUSE' },
                  { step:'02', label:'RECOGNIZE REVENUE', desc:'Dr Deferred (2300) → Cr Room Rev (4000) + VAT + SC' },
                  { step:'03', label:'POST COGS', desc:'Dr Room Cost (5150) 8% → Cr Room Supplies (1120)' },
                  { step:'04', label:'SEAL LEDGER', desc:'Atomic commit — all entries balanced or nothing posts' },
                ].map(s => (
                  <div key={s.step} style={S.nightStep}>
                    <div style={S.nightStepNum}>{s.step}</div>
                    <div style={S.nightStepLabel}>{s.label}</div>
                    <div style={S.nightStepDesc}>{s.desc}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={runNightAudit}
                disabled={nightAuditRunning}
                style={nightAuditRunning ? S.nightBtnRunning : S.nightBtn}
              >
                {nightAuditRunning ? '⟳  RUNNING NIGHT AUDIT...' : '🌙  RUN NIGHT AUDIT NOW'}
              </button>
            </div>
          </div>

          {/* Night Audit Results */}
          {nightAuditResult && (
            <div style={S.nightResultWrap}>
              <div style={nightAuditResult.status === 'SUCCESS' ? S.nightResultBanner : S.nightResultBannerWarn}>
                <span style={{ fontSize:'20px' }}>{nightAuditResult.status === 'SUCCESS' ? '✅' : nightAuditResult.status === 'NO_ACTION' ? '💤' : '❌'}</span>
                <div>
                  <div style={{ fontWeight:900, fontSize:'14px' }}>
                    {nightAuditResult.status === 'SUCCESS' ? `NIGHT AUDIT COMPLETE — ${nightAuditResult.audit_date}` :
                     nightAuditResult.status === 'NO_ACTION' ? 'NO ACTION REQUIRED' : 'NIGHT AUDIT ERROR'}
                  </div>
                  <div style={{ color:'#888', fontSize:'12px', marginTop:'4px' }}>{nightAuditResult.message}</div>
                </div>
                {nightAuditResult.status === 'SUCCESS' && (
                  <div style={{ marginLeft:'auto', textAlign:'right' }}>
                    <div style={{ color:'#888', fontSize:'10px' }}>TOTAL RECOGNIZED</div>
                    <div style={{ color:'#00FF88', fontSize:'20px', fontWeight:900 }}>{formatMoney(nightAuditResult.total_recognized)}</div>
                    <div style={{ color:'#888', fontSize:'10px' }}>{nightAuditResult.rooms_processed} rooms</div>
                  </div>
                )}
              </div>

              {nightAuditResult.journals.length > 0 && (
                <div style={{ marginTop:'20px' }}>
                  <div style={S.sectionHead}>ROOM-BY-ROOM RECOGNITION</div>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        {['ROOM','GUEST','NIGHTLY RATE','NET REVENUE','VAT (15%)','SC (10%)','ROOM COGS (8%)'].map(h => (
                          <th key={h} style={{ ...S.th, textAlign: h==='ROOM'||h==='GUEST' ? 'left' : 'right' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {nightAuditResult.journals.map((r, i) => (
                        <tr key={i} style={{ ...S.tr, animationDelay:`${i*50}ms` }}>
                          <td style={{ ...S.td, color:'#D4AF37', fontWeight:900 }}>{r.room}</td>
                          <td style={S.td}>{r.guest}</td>
                          <td style={{ ...S.td, textAlign:'right', fontFamily:'monospace' }}>{formatMoney(r.nightly_rate)}</td>
                          <td style={{ ...S.td, textAlign:'right', color:'#00F2FF', fontFamily:'monospace', fontWeight:900 }}>{formatMoney(r.net_revenue)}</td>
                          <td style={{ ...S.td, textAlign:'right', color:'#F59E0B', fontFamily:'monospace' }}>{formatMoney(r.vat)}</td>
                          <td style={{ ...S.td, textAlign:'right', color:'#9D50BB', fontFamily:'monospace' }}>{formatMoney(r.sc)}</td>
                          <td style={{ ...S.td, textAlign:'right', color:'#FF6B35', fontFamily:'monospace' }}>{formatMoney(r.cogs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 3: Z-REPORT                                         */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 3 && (
        <div style={S.tabContent}>
          <div style={{ display:'flex', gap:'16px', alignItems:'center', marginBottom:'24px' }}>
            <div style={{ color:'#888', fontSize:'12px', fontWeight:900 }}>REPORT DATE:</div>
            <input type="date" value={zReportDate} onChange={e => setZReportDate(e.target.value)}
              style={{ ...S.select, width:'180px' }} />
            <div style={S.netOnline}><span style={S.dotOn} />{zReportData.journalCount} JOURNALS FOUND</div>
          </div>

          {/* Z-Report KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'20px', marginBottom:'30px' }}>
            <div style={S.zKpi('#00FF88')}>
              <div style={S.kpiLabel}>TOTAL INFLOW (REVENUE)</div>
              <div style={{ ...S.kpiVal, color:'#00FF88' }}>{formatMoney(zReportData.totalIn)}</div>
            </div>
            <div style={S.zKpi('#FF3131')}>
              <div style={S.kpiLabel}>TOTAL OUTFLOW (EXPENSE)</div>
              <div style={{ ...S.kpiVal, color:'#FF3131' }}>{formatMoney(zReportData.totalExp)}</div>
            </div>
            <div style={S.zKpi(zReportData.netProfit >= 0 ? '#00F2FF' : '#FF3131')}>
              <div style={S.kpiLabel}>NET PROFIT / (LOSS)</div>
              <div style={{ ...S.kpiVal, color: zReportData.netProfit >= 0 ? '#00F2FF' : '#FF3131' }}>
                {zReportData.netProfit < 0 && '('}{formatMoney(Math.abs(zReportData.netProfit))}{zReportData.netProfit < 0 && ')'}
              </div>
            </div>
          </div>

          {/* Breakdown by reference type */}
          <div style={S.sectionHead}>JOURNAL ACTIVITY BY REFERENCE TYPE</div>
          <table style={S.table}>
            <thead>
              <tr>
                {['REFERENCE TYPE','JOURNAL COUNT','TOTAL POSTED','AVG PER JOURNAL'].map(h => (
                  <th key={h} style={{ ...S.th, textAlign: h==='REFERENCE TYPE' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(zReportData.byRef).length === 0 && (
                <tr><td colSpan={4} style={S.emptyCell}>No journal activity found for {zReportDate}.</td></tr>
              )}
              {Object.entries(zReportData.byRef).sort((a,b) => b[1].amount - a[1].amount).map(([ref, data]) => (
                <tr key={ref} style={S.tr}>
                  <td style={S.td}><span style={refPill(ref)}>{ref.replace(/_/g,' ')}</span></td>
                  <td style={{ ...S.td, textAlign:'right', color:'#888' }}>{data.count}</td>
                  <td style={{ ...S.td, textAlign:'right', fontFamily:'monospace', fontWeight:900 }}>{formatMoney(data.amount)}</td>
                  <td style={{ ...S.td, textAlign:'right', color:'#888', fontFamily:'monospace' }}>
                    {formatMoney(data.count > 0 ? data.amount / data.count : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Z-Report Footer Stamp */}
          <div style={S.zFooter}>
            <div style={{ color:'#444', fontSize:'10px' }}>
              Z-REPORT GENERATED: {new Date().toLocaleString()} &nbsp;|&nbsp; SOVEREIGN AUDIT ENGINE V2.0 &nbsp;|&nbsp; MIRACLE HMS
            </div>
            <div style={{ color:'#444', fontSize:'10px' }}>
              THIS REPORT IS AN IMMUTABLE RECORD OF THE GENERAL LEDGER FOR {zReportDate}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STYLE HELPERS
// ============================================================
const refPill = (ref: string) => ({
  background: `${REF_COLORS[ref] || '#888'}18`,
  color: REF_COLORS[ref] || '#888',
  padding: '3px 10px',
  borderRadius: '20px',
  fontSize: '10px',
  fontWeight: 900,
  letterSpacing: '0.5px',
  border: `1px solid ${REF_COLORS[ref] || '#888'}40`,
  whiteSpace: 'nowrap' as const,
});

// ============================================================
// STYLES
// ============================================================
const S = {
  container: {
    padding: '24px',
    maxWidth: '1900px',
    margin: '0 auto',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'transparent',
    fontFamily: "'Inter', 'system-ui', sans-serif",
    gap: '0px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: '1px solid #1a1a1a',
  },
  title: {
    fontFamily: "'Cinzel', Georgia, serif",
    color: '#FFF',
    margin: '0 0 6px 0',
    fontSize: '22px',
    letterSpacing: '3px',
    fontWeight: 900,
  },
  subtitle: {
    color: '#00F2FF',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '2px',
  },
  pillBalanced: {
    background: 'rgba(0,255,136,0.08)',
    border: '1px solid rgba(0,255,136,0.3)',
    color: '#00FF88',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '1px',
  },
  pillUnbalanced: {
    background: 'rgba(255,49,49,0.08)',
    border: '1px solid rgba(255,49,49,0.4)',
    color: '#FF3131',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '1px',
    animation: 'pulse 1.5s infinite',
  },
  netOnline: { fontSize:'11px', color:'#00FF88', fontWeight:900, display:'flex', alignItems:'center', gap:'6px' },
  netOffline: { fontSize:'11px', color:'#FF3131', fontWeight:900, display:'flex', alignItems:'center', gap:'6px' },
  dotOn:  { display:'inline-block', width:'7px', height:'7px', background:'#00FF88', borderRadius:'50%' },
  dotOff: { display:'inline-block', width:'7px', height:'7px', background:'#FF3131', borderRadius:'50%' },
  btnRefresh: {
    background: '#111',
    color: '#FFF',
    border: '1px solid #333',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '1px',
  },
  btnExport: {
    background: 'transparent',
    color: '#00F2FF',
    border: '1px solid #00F2FF',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '1px',
  },
  kpiBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  kpiCard: (color: string) => ({
    background: '#0a0a0a',
    border: '1px solid #1a1a1a',
    borderLeft: `3px solid ${color}`,
    borderRadius: '12px',
    padding: '18px 20px',
  }),
  kpiLabel: {
    color: '#666',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  kpiVal: {
    color: '#FFF',
    fontSize: '18px',
    fontFamily: "'Cinzel', Georgia, serif",
    fontWeight: 900,
    letterSpacing: '1px',
  },
  tabBar: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    borderBottom: '1px solid #1a1a1a',
    paddingBottom: '0',
  },
  tab: {
    background: 'transparent',
    color: '#555',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '12px 24px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '1px',
    marginBottom: '-1px',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: 'transparent',
    color: '#00F2FF',
    border: 'none',
    borderBottom: '2px solid #00F2FF',
    padding: '12px 24px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '1px',
    marginBottom: '-1px',
  },
  tabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0,
  },
  filterRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  filterPill: {
    background: '#111',
    color: '#666',
    border: '1px solid #222',
    padding: '8px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '1px',
  },
  filterPillActive: {
    background: 'rgba(0,242,255,0.08)',
    color: '#00F2FF',
    border: '1px solid rgba(0,242,255,0.3)',
    padding: '8px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '1px',
  },
  select: {
    background: '#111',
    color: '#FFF',
    border: '1px solid #333',
    padding: '10px 16px',
    borderRadius: '10px',
    outline: 'none',
    fontSize: '11px',
    cursor: 'pointer',
  },
  tableWrap: {
    flex: 1,
    overflowY: 'auto' as const,
    background: '#070707',
    border: '1px solid #1a1a1a',
    borderRadius: '16px',
    padding: '0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    textAlign: 'left' as const,
  },
  th: {
    color: '#444',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '1px',
    padding: '14px 16px',
    borderBottom: '1px solid #1a1a1a',
    position: 'sticky' as const,
    top: 0,
    background: '#070707',
    whiteSpace: 'nowrap' as const,
  },
  tr: {
    cursor: 'pointer',
    background: 'transparent',
    transition: 'background 0.15s',
    borderBottom: '1px solid #0d0d0d',
  },
  trExpanded: {
    cursor: 'pointer',
    background: 'rgba(0,242,255,0.03)',
    borderBottom: 'none',
  },
  td: {
    padding: '13px 16px',
    color: '#FFF',
    fontSize: '12px',
    borderBottom: '1px solid #0d0d0d',
  },
  emptyCell: {
    textAlign: 'center' as const,
    padding: '60px',
    color: '#444',
    fontSize: '12px',
  },
  loadingPulse: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#00F2FF',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '3px',
    animation: 'pulse 1.5s infinite',
  },
  journalId: {
    fontFamily: 'monospace',
    color: '#444',
    fontSize: '11px',
  },
  balancedBadge: {
    background: 'rgba(0,255,136,0.08)',
    color: '#00FF88',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 900,
  },
  unbalancedBadge: {
    background: 'rgba(255,49,49,0.08)',
    color: '#FF3131',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 900,
  },
  expandedPanel: {
    background: '#050505',
    borderTop: '1px solid rgba(0,242,255,0.15)',
    borderBottom: '1px solid rgba(0,242,255,0.1)',
    padding: '20px 30px',
    marginBottom: '0',
  },
  expandedTitle: {
    color: '#00F2FF',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '2px',
    marginBottom: '16px',
    paddingLeft: '4px',
    borderLeft: '3px solid #00F2FF',
    paddingLeft2: '12px',
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#0a0a0a',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '12px',
    color: '#888',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '2px',
    borderLeft: '4px solid #333',
  },
  balanceBanner: {
    background: 'rgba(0,255,136,0.06)',
    border: '1px solid rgba(0,255,136,0.25)',
    borderRadius: '12px',
    padding: '16px 24px',
    color: '#00FF88',
    fontSize: '12px',
    fontWeight: 900,
    letterSpacing: '0.5px',
    marginBottom: '20px',
  },
  unbalanceBanner: {
    background: 'rgba(255,49,49,0.06)',
    border: '1px solid rgba(255,49,49,0.3)',
    borderRadius: '12px',
    padding: '16px 24px',
    color: '#FF3131',
    fontSize: '12px',
    fontWeight: 900,
    letterSpacing: '0.5px',
    marginBottom: '20px',
    animation: 'pulse 1.5s infinite',
  },
  grandTotalFooter: {
    background: '#0a0a0a',
    border: '1px solid #222',
    borderRadius: '16px',
    padding: '24px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '20px',
  },
  grandLabel: {
    color: '#444',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '3px',
  },
  // Night Audit
  nightAuditHero: {
    position: 'relative' as const,
    background: '#060606',
    border: '1px solid #1a1a1a',
    borderRadius: '24px',
    padding: '48px',
    textAlign: 'center' as const,
    overflow: 'hidden',
    marginBottom: '24px',
  },
  nightAuditGlow: {
    position: 'absolute' as const,
    top: '-100px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '300px',
    background: 'radial-gradient(ellipse at center, rgba(0,255,136,0.04) 0%, transparent 70%)',
    pointerEvents: 'none' as const,
  },
  nightAuditIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  nightAuditTitle: {
    fontFamily: "'Cinzel', Georgia, serif",
    color: '#FFF',
    fontSize: '28px',
    letterSpacing: '4px',
    margin: '0 0 12px 0',
    fontWeight: 900,
  },
  nightAuditDesc: {
    color: '#666',
    fontSize: '13px',
    lineHeight: '1.8',
    maxWidth: '600px',
    margin: '0 auto 36px',
  },
  nightAuditProcess: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    marginBottom: '36px',
    flexWrap: 'wrap' as const,
  },
  nightStep: {
    background: '#0a0a0a',
    border: '1px solid #1a1a1a',
    borderRadius: '12px',
    padding: '20px 24px',
    width: '200px',
    textAlign: 'center' as const,
  },
  nightStepNum: {
    color: '#00FF88',
    fontSize: '24px',
    fontWeight: 900,
    fontFamily: 'monospace',
    marginBottom: '8px',
  },
  nightStepLabel: {
    color: '#FFF',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  nightStepDesc: {
    color: '#555',
    fontSize: '10px',
    lineHeight: '1.6',
  },
  nightBtn: {
    background: 'linear-gradient(135deg, #00FF88, #00D4AA)',
    color: '#000',
    border: 'none',
    padding: '18px 48px',
    borderRadius: '50px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 900,
    letterSpacing: '2px',
    boxShadow: '0 0 40px rgba(0,255,136,0.3)',
    transition: 'all 0.3s',
  },
  nightBtnRunning: {
    background: '#1a1a1a',
    color: '#00FF88',
    border: '1px solid #00FF88',
    padding: '18px 48px',
    borderRadius: '50px',
    cursor: 'not-allowed',
    fontSize: '14px',
    fontWeight: 900,
    letterSpacing: '2px',
    animation: 'pulse 1s infinite',
  },
  nightResultWrap: {
    background: '#060606',
    border: '1px solid #1a1a1a',
    borderRadius: '16px',
    padding: '24px',
  },
  nightResultBanner: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    background: 'rgba(0,255,136,0.05)',
    border: '1px solid rgba(0,255,136,0.2)',
    borderRadius: '12px',
    padding: '20px 24px',
    color: '#FFF',
  },
  nightResultBannerWarn: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    background: 'rgba(255,193,7,0.05)',
    border: '1px solid rgba(255,193,7,0.2)',
    borderRadius: '12px',
    padding: '20px 24px',
    color: '#FFF',
  },
  // Z-Report
  zKpi: (color: string) => ({
    background: '#0a0a0a',
    border: '1px solid #1a1a1a',
    borderRadius: '16px',
    padding: '24px',
    borderTop: `3px solid ${color}`,
  }),
  zFooter: {
    marginTop: '40px',
    borderTop: '1px solid #111',
    paddingTop: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    alignItems: 'center',
  },
};
