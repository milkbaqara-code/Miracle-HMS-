'use client';

/**
 * MIRACLE HMS — ACCOUNTING AGI INTELLIGENCE DASHBOARD (Phase 6F)
 * ==============================================================
 * Route: /dashboard/accounts/intelligence
 * Access: ACCOUNTS, GM, ADMIN, CDO
 *
 * Live panels:
 *   1. System Status Banner (HEALTHY / WARNING / CRITICAL)
 *   2. Department Health Score Cards (0–100 composite KPI)
 *   3. Void Pattern Anomalies (staff-level fraud radar)
 *   4. Revenue Spike / Drop Alerts
 *   5. Stalled Batch Detector
 *   6. Monthly P&L Executive Narrative
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Strip trailing /api from NEXT_PUBLIC_API_URL so fetch calls prefixing /api/ don't double-up
const _RAW_API = process.env.NEXT_PUBLIC_API_URL || 'https://miracle.vigilantitsolution.com/api';
const API_BASE = _RAW_API.endsWith('/api') ? _RAW_API.slice(0, -4) : _RAW_API;
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes auto-refresh

const fmt = (n: number) =>
  `PKR ${(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthScore {
  dept_id: string; dept_name: string; score: number; grade: string; status: string;
  breakdown: { revenue_trend: number; void_hygiene: number; batch_flow: number; expense_ratio: number };
}
interface VoidAnomaly {
  staff_id: string; staff_name: string; dept_name: string;
  void_count: number; void_total: number; severity: string; alert: string;
}
interface RevenueAlert {
  dept_name: string; alert_type: string; today_revenue: number;
  '7day_avg': number; pct_change: number; severity: string; message: string;
}
interface StalledBatch {
  id: string; dept_name: string; batch_number: number; status: string;
  tx_count: number; hours_stalled: number; severity: string; action_required: string;
}
interface IntelReport {
  system_status: string;
  total_alerts: number;
  headline: string;
  void_intelligence: { anomalies: VoidAnomaly[]; anomaly_count: number; summary: string };
  revenue_intelligence: { alerts: RevenueAlert[]; alert_count: number; summary: string };
  batch_intelligence: { stalled_batches: StalledBatch[]; stalled_count: number; summary: string };
  health_scores: { department_scores: HealthScore[]; overall_health: number; overall_grade: string; needs_attention: HealthScore[] };
  monthly_summary: { performance_grade: string; financials: Record<string, number>; narrative: string };
}

// ─── Status colour map ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  HEALTHY:   { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)',  text: '#4ade80' },
  WARNING:   { bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.3)',  text: '#fbbf24' },
  CRITICAL:  { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.3)',  text: '#f87171' },
  EXCELLENT: { bg: 'rgba(129,140,248,0.08)',border: 'rgba(129,140,248,0.3)',text: '#818cf8' },
};
const SEV_COLOR: Record<string, string> = {
  LOW: '#4ade80', MEDIUM: '#fbbf24', HIGH: '#f97316', CRITICAL: '#ef4444',
};
const GRADE_COLOR: Record<string, string> = {
  A: '#4ade80', B: '#60a5fa', C: '#fbbf24', D: '#f97316', F: '#ef4444',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SystemBanner({ status, headline, totalAlerts }: { status: string; headline: string; totalAlerts: number }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.HEALTHY;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14,
      padding: '16px 24px', marginBottom: 24, display: 'flex',
      justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: c.text, letterSpacing: 2, marginBottom: 4 }}>
          SYSTEM STATUS — {status}
        </div>
        <div style={{ fontSize: 14, color: '#e8e8f0', fontWeight: 600 }}>{headline}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: c.text, lineHeight: 1 }}>
          {totalAlerts}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>ACTIVE ALERTS</div>
      </div>
    </div>
  );
}

function HealthCard({ dept }: { dept: HealthScore }) {
  const grade_c = GRADE_COLOR[dept.grade] || '#94a3b8';
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const filled = (dept.score / 100) * circ;

  return (
    <div style={{
      background: 'rgba(15,15,35,0.95)', border: `1px solid ${dept.score >= 70 ? 'rgba(74,222,128,0.2)' : dept.score >= 50 ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)'}`,
      borderRadius: 14, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12
    }}>
      {/* Circular gauge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <svg width={96} height={96} style={{ flexShrink: 0 }}>
          <circle cx={48} cy={48} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
          <circle cx={48} cy={48} r={radius} fill="none" stroke={grade_c} strokeWidth={8}
            strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 48 48)" style={{ transition: 'stroke-dasharray 1s ease' }} />
          <text x={48} y={44} textAnchor="middle" fill={grade_c} fontSize={20} fontWeight={900}
            fontFamily="Inter">{dept.score}</text>
          <text x={48} y={60} textAnchor="middle" fill={grade_c} fontSize={13} fontWeight={900}
            fontFamily="Inter">Grade {dept.grade}</text>
        </svg>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e8e8f0', marginBottom: 4 }}>{dept.dept_name}</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: grade_c, letterSpacing: 1 }}>{dept.status}</div>
        </div>
      </div>

      {/* Score breakdown */}
      {Object.entries(dept.breakdown).map(([key, val]) => (
        <div key={key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
              {key.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span style={{ fontSize: 10, fontWeight: 800, color: grade_c }}>{val}</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
            <div style={{
              height: 4, borderRadius: 99, background: grade_c,
              width: `${(val / (key === 'revenue_trend' ? 30 : key === 'void_hygiene' ? 25 : key === 'batch_flow' ? 25 : 20)) * 100}%`,
              transition: 'width 0.8s ease'
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountingIntelligencePage() {
  const [report, setReport] = useState<IntelReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [activeTab, setActiveTab] = useState<'health' | 'voids' | 'revenue' | 'batches' | 'pl'>('health');
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounting/agi/intelligence-report`);
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setReport(data);
        setLastRefresh(new Date());
        setCountdown(REFRESH_MS / 1000);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchReport();
    const interval = setInterval(fetchReport, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchReport]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timerRef.current);
  }, [lastRefresh]);

  const tabs: [typeof activeTab, string][] = [
    ['health',   '🏥 Health Scores'],
    ['voids',    '🚫 Void Anomalies'],
    ['revenue',  '📈 Revenue Alerts'],
    ['batches',  '⏳ Stalled Batches'],
    ['pl',       '📊 Monthly P&L'],
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #02020e 0%, #060618 50%, #080820 100%)',
      color: '#e8e8f0', fontFamily: "'Inter', sans-serif", padding: 24
    }}>

      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: 'rgba(212,175,55,0.5)', letterSpacing: 3, fontWeight: 800, marginBottom: 6 }}>
          ZONE Z-11F — ACCOUNTING AGI INTELLIGENCE LAYER
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#fff' }}>
            🧠 AGI Financial Intelligence
          </h1>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
              {lastRefresh ? `Last scan: ${lastRefresh.toLocaleTimeString()}` : 'Scanning...'}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: `conic-gradient(rgba(212,175,55,0.7) ${(countdown / (REFRESH_MS / 1000)) * 360}deg, rgba(255,255,255,0.08) 0deg)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#d4af37'
              }}>{countdown}s</div>
              <button onClick={fetchReport} style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(212,175,55,0.3)',
                background: 'rgba(212,175,55,0.08)', color: '#d4af37',
                cursor: 'pointer', fontWeight: 800, fontSize: 12
              }}>⚡ Scan Now</button>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
          Void anomaly detection · Revenue spike radar · Batch flow monitor · Dept health scores · Executive P&L
        </p>
      </div>

      {loading && !report && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.3)'
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>AGI Intelligence Engine scanning all departments...</div>
        </div>
      )}

      {report && (
        <>
          {/* System Banner */}
          <SystemBanner
            status={report.system_status}
            headline={report.headline}
            totalAlerts={report.total_alerts}
          />

          {/* Tab Bar */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 24,
            background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, overflowX: 'auto'
          }}>
            {tabs.map(([key, label]) => {
              const alertCount =
                key === 'voids' ? (report.void_intelligence?.anomaly_count ?? 0) :
                key === 'revenue' ? (report.revenue_intelligence?.alert_count ?? 0) :
                key === 'batches' ? (report.batch_intelligence?.stalled_count ?? 0) : 0;
              return (
                <button key={key} onClick={() => setActiveTab(key)} style={{
                  flex: 1, minWidth: 130, padding: '10px 8px', borderRadius: 9, border: 'none',
                  cursor: 'pointer', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
                  transition: 'all 0.2s', position: 'relative',
                  background: activeTab === key ? 'rgba(212,175,55,0.15)' : 'transparent',
                  color: activeTab === key ? '#d4af37' : 'rgba(255,255,255,0.4)',
                  borderBottom: activeTab === key ? '2px solid #d4af37' : '2px solid transparent'
                }}>
                  {label}
                  {alertCount > 0 && (
                    <span style={{
                      marginLeft: 6, background: '#ef4444', color: '#fff',
                      borderRadius: 99, fontSize: 9, fontWeight: 900,
                      padding: '1px 5px', verticalAlign: 'middle'
                    }}>{alertCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Health Scores Tab ── */}
          {activeTab === 'health' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                  Overall Portfolio Health:
                </div>
                <div style={{
                  fontSize: 28, fontWeight: 900,
                  color: GRADE_COLOR[report.health_scores?.overall_grade ?? ''] || '#d4af37'
                }}>
                  {report.health_scores?.overall_health ?? 0}/100
                  <span style={{ fontSize: 16, marginLeft: 8 }}>
                    Grade {report.health_scores?.overall_grade ?? '—'}
                  </span>
                </div>
              </div>

              {(report.health_scores?.needs_attention?.length ?? 0) > 0 && (
                <div style={{
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 12, padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#f87171'
                }}>
                  ⚠️ <strong>{report.health_scores.needs_attention.length} department(s)</strong> need immediate attention:{' '}
                  {report.health_scores.needs_attention.map(d => d.dept_name).join(', ')}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                {(report.health_scores?.department_scores ?? []).map(dept => (
                  <HealthCard key={dept.dept_id} dept={dept} />
                ))}
              </div>
            </>
          )}

          {/* ── Void Anomalies Tab ── */}
          {activeTab === 'voids' && (
            <>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {report.void_intelligence?.summary ?? 'Scanning...'}
              </div>
              {(report.void_intelligence?.anomalies?.length ?? 0) === 0 ? (
                <EmptyState icon="✅" text="No void anomalies detected in the last 24 hours." />
              ) : (report.void_intelligence?.anomalies ?? []).map((a, i) => (
                <div key={i} style={{
                  background: 'rgba(15,15,35,0.95)',
                  border: `1px solid ${SEV_COLOR[a.severity] || '#444'}44`,
                  borderLeft: `4px solid ${SEV_COLOR[a.severity] || '#ef4444'}`,
                  borderRadius: 12, padding: '16px 20px', marginBottom: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#e8e8f0', marginBottom: 4 }}>
                        {a.staff_name}
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                          @ {a.dept_name}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: SEV_COLOR[a.severity], fontWeight: 700, marginBottom: 6 }}>
                        {a.void_count} voids · {fmt(a.void_total)} total voided
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{a.alert}</div>
                    </div>
                    <SeverityBadge severity={a.severity} />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Revenue Alerts Tab ── */}
          {activeTab === 'revenue' && (
            <>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {report.revenue_intelligence?.summary ?? 'Scanning...'}
              </div>
              {(report.revenue_intelligence?.alerts?.length ?? 0) === 0 ? (
                <EmptyState icon="📊" text="All department revenues within normal parameters." />
              ) : (report.revenue_intelligence?.alerts ?? []).map((a, i) => (
                <div key={i} style={{
                  background: 'rgba(15,15,35,0.95)',
                  border: `1px solid ${a.alert_type === 'SPIKE' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  borderLeft: `4px solid ${a.alert_type === 'SPIKE' ? '#4ade80' : '#ef4444'}`,
                  borderRadius: 12, padding: '16px 20px', marginBottom: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#e8e8f0', marginBottom: 6 }}>
                        {a.dept_name}
                        <span style={{
                          marginLeft: 10, fontSize: 11, fontWeight: 900,
                          color: a.alert_type === 'SPIKE' ? '#4ade80' : '#ef4444'
                        }}>
                          {a.alert_type === 'SPIKE' ? '▲' : '▼'} {Math.abs(a.pct_change)}%
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{a.message}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#e8e8f0' }}>{fmt(a.today_revenue)}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>7-day avg: {fmt(a['7day_avg'])}</div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Stalled Batches Tab ── */}
          {activeTab === 'batches' && (
            <>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {report.batch_intelligence?.summary ?? 'Scanning...'}
              </div>
              {(report.batch_intelligence?.stalled_batches?.length ?? 0) === 0 ? (
                <EmptyState icon="⚡" text="No stalled batches. All financial flows moving normally." />
              ) : (report.batch_intelligence?.stalled_batches ?? []).map((b, i) => (
                <div key={i} style={{
                  background: 'rgba(15,15,35,0.95)',
                  border: `1px solid ${SEV_COLOR[b.severity] || '#444'}44`,
                  borderLeft: `4px solid ${SEV_COLOR[b.severity] || '#fbbf24'}`,
                  borderRadius: 12, padding: '16px 20px', marginBottom: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#e8e8f0', marginBottom: 4 }}>
                        {b.dept_name} — Batch #{b.batch_number}
                        <span style={{
                          marginLeft: 10, fontSize: 10, padding: '2px 8px', borderRadius: 99,
                          background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 800
                        }}>{b.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>
                        ⏰ {b.hours_stalled}h stalled
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                        ACTION: {b.action_required}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                      <SeverityBadge severity={b.severity} />
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{b.tx_count} tx</span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Monthly P&L Tab ── */}
          {activeTab === 'pl' && report.monthly_summary && (
            <>
              {/* Grade Banner */}
              <div style={{
                background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: 14, padding: '20px 24px', marginBottom: 24,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)', fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
                    MONTHLY PERFORMANCE GRADE
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#d4af37' }}>
                    {report.monthly_summary.performance_grade}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                  {[
                    { label: 'Gross Revenue', value: fmt(report.monthly_summary.financials.gross_revenue), color: '#4ade80' },
                    { label: 'Total Expenses', value: fmt(report.monthly_summary.financials.total_expenses), color: '#f87171' },
                    { label: 'Net Income', value: fmt(report.monthly_summary.financials.net_operating_income), color: report.monthly_summary.financials.net_operating_income >= 0 ? '#d4af37' : '#ef4444' },
                  ].map(k => (
                    <div key={k.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 4 }}>{k.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: k.color }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Void Adj.', value: fmt(report.monthly_summary.financials.void_adjustments), color: '#fb923c' },
                  { label: 'Net Revenue', value: fmt(report.monthly_summary.financials.net_revenue), color: '#60a5fa' },
                  { label: 'Gross Margin', value: `${report.monthly_summary.financials.gross_margin_pct}%`, color: '#a78bfa' },
                  { label: 'Void Count', value: String(report.monthly_summary.financials.void_count), color: '#f87171' },
                  { label: 'Active Depts', value: String(report.monthly_summary.financials.active_departments), color: '#4ade80' },
                ].map(k => (
                  <div key={k.label} style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: '14px 16px'
                  }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>{k.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Executive Narrative */}
              <div style={{
                background: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: 24
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(212,175,55,0.6)', letterSpacing: 2, marginBottom: 14 }}>
                  EXECUTIVE NARRATIVE — AUTO-GENERATED BY AGI
                </div>
                <pre style={{
                  fontFamily: "'Courier New', monospace", fontSize: 12.5, lineHeight: 1.8,
                  color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', margin: 0,
                  borderLeft: '3px solid rgba(212,175,55,0.3)', paddingLeft: 16
                }}>
                  {report.monthly_summary.narrative}
                </pre>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEV_COLOR[severity] || '#94a3b8';
  return (
    <span style={{
      fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 99,
      background: `${c}18`, color: c, border: `1px solid ${c}44`, letterSpacing: 0.5,
      whiteSpace: 'nowrap'
    }}>{severity}</span>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)'
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{text}</div>
    </div>
  );
}
