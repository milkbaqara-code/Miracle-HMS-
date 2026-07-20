'use client';
import React, { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface VaultDoc { id: number; doc_type: string; doc_ref: string; description: string; amount: number; employee_id: string | null; file_url: string; generated_by: string; created_at: string; }
interface PayrollCalc { employee_id: string; name: string; position: string; dept: string; base_salary: number; commission: number; total: number; already_paid: boolean; pay_status: string; }

const DOC_ICONS: Record<string, string> = { SALARY_SLIP: '💼', REVENUE_VOUCHER: '🧾', DISBURSEMENT: '💸', MISC: '📄' };
const DOC_COLORS: Record<string, string> = { SALARY_SLIP: '#00fbff', REVENUE_VOUCHER: '#D4AF37', DISBURSEMENT: '#00ff88', MISC: '#888' };

export default function SovereignVaultPanel({ formatMoney, currency }: { formatMoney: (n: number) => string; currency: string }) {
  const [subTab, setSubTab] = useState<'docs' | 'payroll' | 'history'>('docs');
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [payroll, setPayroll] = useState<PayrollCalc[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err' | 'info'; msg: string } | null>(null);
  const [filterType, setFilterType] = useState('');
  const [runningPayroll, setRunningPayroll] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('miracle_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/accounting/vault/documents${filterType ? `?doc_type=${filterType}` : ''}`, { headers });
      const d = await r.json();
      if (d.status === 'SUCCESS') setDocs(d.documents || []);
    } catch { setDocs([]); }
    setLoading(false);
  }, [filterType]);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/accounting/vault/payroll/calculate`, { headers });
      const d = await r.json();
      if (d.status === 'SUCCESS') setPayroll(d.calculations || []);
    } catch { setPayroll([]); }
    setLoading(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/accounting/vault/payroll/history`, { headers });
      const d = await r.json();
      if (d.status === 'SUCCESS') setHistory(d.history || []);
    } catch { setHistory([]); }
    setLoading(false);
  }, []);

  useEffect(() => { if (subTab === 'docs') fetchDocs(); }, [subTab, fetchDocs]);
  useEffect(() => { if (subTab === 'payroll') fetchPayroll(); }, [subTab, fetchPayroll]);
  useEffect(() => { if (subTab === 'history') fetchHistory(); }, [subTab, fetchHistory]);

  const runPayroll = async () => {
    if (!window.confirm('Execute payroll run for ALL active operatives this month?')) return;
    setRunningPayroll(true);
    setStatusMsg({ type: 'info', msg: 'Executing Payroll Run...' });
    try {
      const r = await fetch(`${API}/accounting/vault/payroll/run`, {
        method: 'POST', headers,
        body: JSON.stringify({ month_year: new Date().toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' }).replace('/', '-') })
      });
      const d = await r.json();
      if (d.status === 'SUCCESS') {
        setStatusMsg({ type: 'ok', msg: `✅ ${d.message} — Total: ${formatMoney(d.total_disbursed)}` });
        fetchPayroll(); fetchHistory();
      } else {
        setStatusMsg({ type: 'err', msg: d.detail || 'Payroll run failed.' });
      }
    } catch (e: any) { setStatusMsg({ type: 'err', msg: e.message }); }
    setRunningPayroll(false);
  };

  const glass: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(20px)' };
  const neonText = (color: string): React.CSSProperties => ({ color, textShadow: `0 0 12px ${color}44`, fontWeight: 900 });
  const subBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: '8px', border: active ? '1px solid #00fbff' : '1px solid rgba(255,255,255,0.08)',
    background: active ? 'rgba(0,251,255,0.1)' : 'transparent', color: active ? '#00fbff' : '#666',
    cursor: 'pointer', fontSize: '11px', fontWeight: 900, letterSpacing: '1px', transition: '0.2s'
  });

  const grandTotal = payroll.reduce((s, e) => s + e.total, 0);

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Cinzel', ...neonText('#D4AF37'), fontSize: '22px', letterSpacing: '3px' }}>📁 SOVEREIGN VAULT</h2>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '4px', letterSpacing: '2px' }}>ZONE 18 · FINANCIAL DOCUMENT ARCHIVE & PAYROLL ENGINE</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['docs', 'payroll', 'history'] as const).map(t => (
            <button key={t} style={subBtnStyle(subTab === t)} onClick={() => setSubTab(t)}>
              {t === 'docs' ? '📄 DOCUMENTS' : t === 'payroll' ? '💰 PAYROLL ENGINE' : '📜 HISTORY'}
            </button>
          ))}
        </div>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div style={{ ...glass, padding: '12px 20px', marginBottom: '16px', border: `1px solid ${statusMsg.type === 'ok' ? '#00ff88' : statusMsg.type === 'err' ? '#ff3366' : '#00fbff'}44`, color: statusMsg.type === 'ok' ? '#00ff88' : statusMsg.type === 'err' ? '#ff3366' : '#00fbff', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{statusMsg.msg}</span>
          <button onClick={() => setStatusMsg(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>
      )}

      {/* DOCUMENTS TAB */}
      {subTab === 'docs' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['', 'SALARY_SLIP', 'REVENUE_VOUCHER', 'DISBURSEMENT'].map(type => (
              <button key={type} onClick={() => setFilterType(type)} style={{ ...subBtnStyle(filterType === type), fontSize: '10px' }}>
                {type === '' ? 'ALL TYPES' : type.replace('_', ' ')}
              </button>
            ))}
            <button onClick={fetchDocs} style={{ marginLeft: 'auto', ...subBtnStyle(false), color: '#00fbff', borderColor: '#00fbff44' }}>↻ REFRESH</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#444' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⚡</div>
              <div style={{ letterSpacing: '3px', fontSize: '11px' }}>SCANNING VAULT...</div>
            </div>
          ) : docs.length === 0 ? (
            <div style={{ ...glass, padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>🗄️</div>
              <div style={{ color: '#444', fontSize: '13px', letterSpacing: '2px' }}>NO DOCUMENTS ARCHIVED</div>
              <div style={{ color: '#333', fontSize: '10px', marginTop: '8px' }}>Generate salary slips or revenue vouchers to populate the vault</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {docs.map(doc => {
                const color = DOC_COLORS[doc.doc_type] || '#888';
                const icon = DOC_ICONS[doc.doc_type] || '📄';
                return (
                  <div key={doc.id} style={{ ...glass, padding: '20px', boxShadow: `0 0 20px ${color}11`, transition: '0.2s', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 30px ${color}33`)}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 0 20px ${color}11`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <span style={{ fontSize: '28px' }}>{icon}</span>
                      <span style={{ fontSize: '9px', color, border: `1px solid ${color}44`, padding: '2px 8px', borderRadius: '20px', letterSpacing: '1px', fontWeight: 900 }}>
                        {doc.doc_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ color: '#FFF', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{doc.doc_ref}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px' }}>{doc.description || 'Sovereign Vault Document'}</div>
                    <div style={{ ...neonText(color), fontSize: '20px', marginBottom: '12px', fontFamily: 'monospace' }}>{formatMoney(doc.amount || 0)}</div>
                    <div style={{ fontSize: '9px', color: '#555', marginBottom: '12px' }}>
                      {new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · BY {doc.generated_by}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={doc.file_url} target="_blank" rel="noreferrer"
                        style={{ flex: 1, textAlign: 'center', padding: '8px', background: `${color}15`, border: `1px solid ${color}44`, borderRadius: '8px', color, fontSize: '10px', fontWeight: 900, letterSpacing: '1px', textDecoration: 'none' }}>
                        📥 DOWNLOAD
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PAYROLL ENGINE TAB */}
      {subTab === 'payroll' && (
        <div>
          {/* Summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ ...glass, padding: '20px' }}>
              <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', marginBottom: '8px' }}>TOTAL OPERATIVE COUNT</div>
              <div style={{ ...neonText('#00fbff'), fontSize: '32px', fontFamily: 'monospace' }}>{payroll.length}</div>
            </div>
            <div style={{ ...glass, padding: '20px' }}>
              <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', marginBottom: '8px' }}>TOTAL PAYROLL LIABILITY</div>
              <div style={{ ...neonText('#D4AF37'), fontSize: '32px', fontFamily: 'monospace' }}>{formatMoney(grandTotal)}</div>
            </div>
            <div style={{ ...glass, padding: '20px' }}>
              <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', marginBottom: '8px' }}>ALREADY PROCESSED</div>
              <div style={{ ...neonText('#00ff88'), fontSize: '32px', fontFamily: 'monospace' }}>{payroll.filter(p => p.already_paid).length}</div>
            </div>
            <div style={{ ...glass, padding: '20px', border: '1px solid rgba(212,175,55,0.2)' }}>
              <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', marginBottom: '12px' }}>5TH-OF-MONTH ENGINE</div>
              <button onClick={runPayroll} disabled={runningPayroll}
                style={{ width: '100%', padding: '12px', background: runningPayroll ? '#111' : 'rgba(212,175,55,0.15)', border: '1px solid #D4AF3766', borderRadius: '8px', color: '#D4AF37', fontWeight: 900, fontSize: '11px', letterSpacing: '1px', cursor: runningPayroll ? 'not-allowed' : 'pointer', transition: '0.2s' }}>
                {runningPayroll ? '⏳ PROCESSING...' : '⚡ RUN PAYROLL'}
              </button>
            </div>
          </div>

          {/* Payroll table */}
          {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#444', letterSpacing: '3px', fontSize: '11px' }}>CALCULATING...</div> : (
            <div style={{ ...glass, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['OPERATIVE', 'DEPT', 'BASE SALARY', 'COMMISSION', 'TOTAL PAYOUT', 'STATUS'].map(h => (
                      <th key={h} style={{ padding: '14px 16px', fontSize: '9px', color: '#555', fontWeight: 900, letterSpacing: '1px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payroll.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#444', fontSize: '12px' }}>No active operatives found in registry.</td></tr>
                  ) : payroll.map((emp, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: '0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ color: '#FFF', fontWeight: 700, fontSize: '13px' }}>{emp.name}</div>
                        <div style={{ color: '#555', fontSize: '10px' }}>{emp.position}</div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#00fbff', fontSize: '11px', fontWeight: 700 }}>{emp.dept || '—'}</td>
                      <td style={{ padding: '14px 16px', color: '#FFF', fontFamily: 'monospace', fontSize: '13px' }}>{formatMoney(emp.base_salary)}</td>
                      <td style={{ padding: '14px 16px', color: '#D4AF37', fontFamily: 'monospace', fontSize: '13px' }}>{formatMoney(emp.commission)}</td>
                      <td style={{ padding: '14px 16px', color: '#00ff88', fontFamily: 'monospace', fontSize: '16px', fontWeight: 900 }}>{formatMoney(emp.total)}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '9px', fontWeight: 900, letterSpacing: '1px', background: emp.already_paid ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)', color: emp.already_paid ? '#00ff88' : '#555', border: `1px solid ${emp.already_paid ? '#00ff8844' : 'rgba(255,255,255,0.06)'}` }}>
                          {emp.pay_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {subTab === 'history' && (
        <div>
          {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#444', letterSpacing: '3px', fontSize: '11px' }}>LOADING HISTORY...</div>
            : history.length === 0 ? (
              <div style={{ ...glass, padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📜</div>
                <div style={{ color: '#444', fontSize: '13px', letterSpacing: '2px' }}>NO PAYROLL RUNS YET</div>
              </div>
            ) : history.map((run, i) => (
              <div key={i} style={{ ...glass, padding: '20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#D4AF37', fontWeight: 900, fontFamily: 'Cinzel', letterSpacing: '2px', fontSize: '14px' }}>PERIOD: {run.period}</div>
                    <div style={{ color: '#555', fontSize: '10px', marginTop: '4px' }}>{run.count} operatives processed</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...neonText('#00ff88'), fontSize: '22px', fontFamily: 'monospace' }}>{formatMoney(run.total_disbursed)}</div>
                    <div style={{ color: '#555', fontSize: '9px', marginTop: '2px', letterSpacing: '1px' }}>TOTAL DISBURSED</div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
    </div>
  );
}
