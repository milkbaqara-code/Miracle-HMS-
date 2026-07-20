'use client';

/**
 * /maas — Miracle-as-a-Service Client Portal
 * Enterprise owners submit prompts, track builds, download solutions.
 * Dispatcher API: localhost:9000
 *   POST /api/jobs/submit_architect  — submit a build job
 *   GET  /api/jobs/recent            — last 20 jobs
 *   GET  /api/cluster/status         — workers + job stats
 */

import React, { useState, useEffect, useCallback } from 'react';

const DISPATCHER_URL = 'http://localhost:9000';

interface Zone { id: string; name: string; }

interface JobResult {
  status: string;
  job_id: string;
  industry: string;
  brand: string;
  color: string;
  icon: string;
  zones: string[];
  zone_details: Zone[];
  zone_count: number;
  confidence: number;
  preview_url: string;
  preview_live: boolean;
  download_url: string;
  test_grade: string;
  tests_passed: number;
  tests_total: number;
  warnings: string[];
  assembled_at: string;
  message: string;
}

interface RawJob {
  id: number;
  status: string;
  payload: string;
  assigned_to: string | null;
  result: string | null;
  created_at: string;
}

interface ParsedJob {
  id: number;
  status: string;
  assigned_to: string | null;
  created_at: string;
  industry?: string;
  brand?: string;
  color?: string;
  icon?: string;
  download_url?: string;
  preview_url?: string;
  zones?: string[];
  test_grade?: string;
  tests_passed?: number;
  tests_total?: number;
  message?: string;
  prompt?: string;
}

interface ClusterStatus {
  nodes: { node_name: string; status: string; last_seen: string }[];
  job_stats: { PENDING: number; RUNNING: number; COMPLETED: number; FAILED: number };
}

const INDUSTRY_EXAMPLES = [
  { label: '🎬 Cinema / Netflix', prompt: 'Build me a Netflix-style cinema showing platform with ticket booking and concessions' },
  { label: '🏨 Hotel OS', prompt: 'I need a full hotel management system for a 5-star property with PMS and POS' },
  { label: '🏥 Hospital OS', prompt: 'Build a hospital management platform for patient records and billing' },
  { label: '🍽️ Restaurant OS', prompt: 'Create a restaurant POS and table management system' },
  { label: '🛍️ Retail OS', prompt: 'I need a retail store management system with inventory and POS' },
  { label: '🏋️ Gym OS', prompt: 'Build a gym membership and fitness center management system' },
  { label: '🦷 Dental Clinic', prompt: 'I need a dental clinic management system with appointments and billing' },
  { label: '🚗 Car Rental', prompt: 'Build a car rental and fleet management system' },
];

const GRADE_COLORS: Record<string, string> = {
  PASS: '#10b981',
  WARN: '#f59e0b',
  FAIL: '#ef4444',
};

function parseJob(raw: RawJob): ParsedJob {
  const parsed: ParsedJob = {
    id: raw.id,
    status: raw.status,
    assigned_to: raw.assigned_to,
    created_at: raw.created_at,
  };

  // Try to parse result JSON
  if (raw.result && raw.status === 'COMPLETED') {
    try {
      const textStart = raw.result.indexOf('---TEXT_START---');
      const textEnd = raw.result.indexOf('---TEXT_END---');
      if (textStart !== -1 && textEnd !== -1) {
        const jsonStr = raw.result.slice(textStart + 16, textEnd).trim();
        const res: JobResult = JSON.parse(jsonStr);
        parsed.industry = res.industry;
        parsed.brand = res.brand;
        parsed.color = res.color;
        parsed.icon = res.icon;
        parsed.zones = res.zones;
        parsed.download_url = res.download_url;
        parsed.preview_url = res.preview_url;
        parsed.test_grade = res.test_grade;
        parsed.tests_passed = res.tests_passed;
        parsed.tests_total = res.tests_total;
        parsed.message = res.message;
      }
    } catch {
      // Non-JSON result — try to find industry in result text
    }
  }

  // Try to extract industry from running/pending payload
  if (!parsed.industry && raw.payload) {
    const industryMatch = raw.payload.match(/Industry\s*:\s*(\w+)/i);
    const brandMatch = raw.payload.match(/Brand\s*:\s*([^\n]+)/i);
    if (industryMatch) parsed.industry = industryMatch[1];
    if (brandMatch) parsed.brand = brandMatch[1].trim();
    // Extract prompt
    const promptMatch = raw.payload.match(/Prompt received:\s*'([^']+)'/i);
    if (promptMatch) parsed.prompt = promptMatch[1];
  }

  return parsed;
}

export default function MaaSPortalPage() {
  const [prompt, setPrompt] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [brandName, setBrandName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [jobs, setJobs] = useState<ParsedJob[]>([]);
  const [cluster, setCluster] = useState<ClusterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatcherOnline, setDispatcherOnline] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, clusterRes] = await Promise.all([
        fetch(`${DISPATCHER_URL}/api/jobs/recent`),
        fetch(`${DISPATCHER_URL}/api/cluster/status`),
      ]);
      if (jobsRes.ok) {
        const raw: RawJob[] = await jobsRes.json();
        setJobs(raw.map(parseJob));
        setDispatcherOnline(true);
      }
      if (clusterRes.ok) {
        const cs: ClusterStatus = await clusterRes.json();
        setCluster(cs);
      }
    } catch {
      setDispatcherOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${DISPATCHER_URL}/api/jobs/submit_architect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          client_email: clientEmail || 'admin@vigilantitsolution.com',
          brand_name: brandName || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.job_id) {
        setSuccessMsg(`✅ Job #${data.job_id} submitted! Workers are assembling your solution...`);
        setPrompt('');
        setBrandName('');
        fetchData();
      } else {
        setSubmitError(data.detail || data.error || data.message || 'Submission failed');
      }
    } catch {
      setSubmitError('Cannot reach dispatcher at ' + DISPATCHER_URL + '. Make sure START_MAAS.bat is running on this PC.');
    } finally {
      setSubmitting(false);
    }
  };

  const completedJobs = jobs.filter(j => j.status === 'COMPLETED');
  const runningJobs = jobs.filter(j => j.status === 'RUNNING');
  const pendingJobs = jobs.filter(j => j.status === 'PENDING');
  const onlineWorkers = cluster?.nodes.filter(n => n.status === 'ONLINE').length ?? 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 40%, #0a0a0f 100%)',
      color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0533 0%, #0d1a33 50%, #1a0533 100%)',
        borderBottom: '1px solid rgba(168,85,247,0.3)',
        padding: '40px 24px 32px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Dispatcher status badge */}
        <div style={{
          position: 'absolute', top: 16, right: 16,
          display: 'flex', alignItems: 'center', gap: 6,
          background: dispatcherOnline ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${dispatcherOnline ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: 20, padding: '4px 12px', fontSize: 12,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: dispatcherOnline ? '#10b981' : '#ef4444',
            animation: dispatcherOnline ? 'glow 2s infinite' : 'none',
          }} />
          {dispatcherOnline ? `Dispatcher Online • ${onlineWorkers}/5 Workers` : 'Dispatcher Offline'}
        </div>

        <div style={{ fontSize: 52, marginBottom: 8 }}>⚡</div>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900,
          background: 'linear-gradient(135deg, #a855f7, #3b82f6, #06b6d4)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          margin: '0 0 12px', letterSpacing: '-1px',
        }}>
          Miracle-as-a-Service
        </h1>
        <p style={{ color: '#a1a1aa', fontSize: 16, margin: '0 auto', maxWidth: 600 }}>
          Describe your business. Our AI Sovereign Workers assemble a complete enterprise OS — tailored to your industry — with zones, POS, HR, Finance, and more.
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 28, flexWrap: 'wrap' }}>
          {[
            { label: 'Builds Delivered', value: cluster?.job_stats.COMPLETED ?? completedJobs.length, color: '#10b981' },
            { label: 'Building Now', value: cluster?.job_stats.RUNNING ?? runningJobs.length, color: '#3b82f6' },
            { label: 'In Queue', value: cluster?.job_stats.PENDING ?? pendingJobs.length, color: '#f59e0b' },
            { label: 'Workers Online', value: onlineWorkers, color: '#a855f7' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', display: 'grid', gap: 28 }}>

        {/* Worker grid */}
        {cluster && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 10,
          }}>
            {cluster.nodes.map(node => (
              <div key={node.node_name} style={{
                background: node.status === 'ONLINE' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${node.status === 'ONLINE' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: node.status === 'ONLINE' ? '#10b981' : '#4b5563',
                    animation: node.status === 'ONLINE' ? 'glow 2s infinite' : 'none',
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: node.status === 'ONLINE' ? '#10b981' : '#6b7280' }}>
                    {node.node_name.replace('colab_', '').toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#4b5563' }}>
                  {node.status === 'ONLINE' ? '🟢 Online' : '⚫ Offline'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Submit Form */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(168,85,247,0.25)',
          borderRadius: 20, padding: 32,
          backdropFilter: 'blur(10px)',
        }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700 }}>🚀 Build Your Enterprise Solution</h2>
          <p style={{ color: '#71717a', margin: '0 0 20px', fontSize: 14 }}>
            Describe your business — the AI Brain classifies your industry, selects zones, assembles Miracle HMS, and delivers a ZIP.
          </p>

          {/* Quick examples */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {INDUSTRY_EXAMPLES.map(ex => (
              <button key={ex.label} onClick={() => setPrompt(ex.prompt)} style={{
                background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
                borderRadius: 8, padding: '6px 12px', color: '#c4b5fd', fontSize: 12,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.1)')}
              >{ex.label}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. Build me a Netflix-style cinema platform with ticket booking, concession POS, staff management, and loyalty marketing..."
              rows={4} style={{
                width: '100%', background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(168,85,247,0.3)', borderRadius: 12,
                padding: '14px 16px', color: '#fff', fontSize: 15, resize: 'vertical',
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(168,85,247,0.7)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(168,85,247,0.3)')}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input value={brandName} onChange={e => setBrandName(e.target.value)}
                placeholder="Brand name (e.g. Star Cineplex)" style={{
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14,
                  outline: 'none', fontFamily: 'inherit',
                }} />
              <input value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                placeholder="Your email (optional)" type="email" style={{
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14,
                  outline: 'none', fontFamily: 'inherit',
                }} />
            </div>

            {submitError && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '12px 16px', color: '#fca5a5', fontSize: 14,
              }}>⚠️ {submitError}</div>
            )}
            {successMsg && (
              <div style={{
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 10, padding: '12px 16px', color: '#6ee7b7', fontSize: 14,
              }}>{successMsg}</div>
            )}

            <button type="submit" disabled={submitting || !prompt.trim()} style={{
              background: submitting ? 'rgba(168,85,247,0.3)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              border: 'none', borderRadius: 12, padding: '14px 28px',
              color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {submitting ? '⚙️ Submitting to Workers...' : '⚡ Assemble Enterprise Solution'}
            </button>
          </form>
        </div>

        {/* Running Jobs */}
        {runningJobs.length > 0 && (
          <div>
            <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700, color: '#60a5fa' }}>
              ⚙️ Building Now ({runningJobs.length})
            </h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {runningJobs.map((job: ParsedJob & { current_phase?: string; progress_msg?: string; last_heartbeat?: string; retry_count?: number }) => {
                const heartbeatAge = job.last_heartbeat
                  ? Math.floor((Date.now() - new Date(job.last_heartbeat + 'Z').getTime()) / 1000)
                  : null;
                const isStale = heartbeatAge !== null && heartbeatAge > 300;
                return (
                  <div key={job.id} style={{
                    background: isStale ? 'rgba(239,68,68,0.07)' : 'rgba(59,130,246,0.07)',
                    border: `1px solid ${isStale ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.2)'}`,
                    borderLeft: `4px solid ${isStale ? '#ef4444' : '#3b82f6'}`,
                    borderRadius: 14, padding: '16px 20px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                      <div style={{ fontSize: 26 }}>{isStale ? '⚠️' : '⚙️'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{job.brand || job.industry || `Job #${job.id}`}</div>
                        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                          Job #{job.id} • Worker: {job.assigned_to || '?'}
                          {(job.retry_count ?? 0) > 0 && (
                            <span style={{ color: '#f59e0b', marginLeft: 8 }}>
                              ↻ Retry {job.retry_count}/3
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{
                        background: isStale ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
                        border: `1px solid ${isStale ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)'}`,
                        borderRadius: 20, padding: '4px 14px', fontSize: 11,
                        color: isStale ? '#fca5a5' : '#93c5fd', fontWeight: 600,
                      }}>
                        {isStale ? 'STALE — WATCHDOG RECOVERING' : 'BUILDING'}
                      </div>
                    </div>

                    {/* Live phase display from heartbeat */}
                    {(job.current_phase || job.progress_msg) && (
                      <div style={{
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 8, padding: '8px 12px',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: '#3b82f6',
                          animation: isStale ? 'none' : 'glow 1.5s infinite',
                          flexShrink: 0,
                        }} />
                        <div>
                          <span style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, marginRight: 6 }}>
                            {job.current_phase || 'WORKING'}
                          </span>
                          <span style={{ color: '#6b7280', fontSize: 12 }}>
                            {job.progress_msg || 'Processing...'}
                          </span>
                        </div>
                        {heartbeatAge !== null && (
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: isStale ? '#ef4444' : '#4b5563' }}>
                            {heartbeatAge < 60 ? `${heartbeatAge}s ago` : `${Math.floor(heartbeatAge/60)}m ago`}
                          </span>
                        )}
                      </div>
                    )}

                    {job.prompt && (
                      <div style={{ color: '#3b82f6', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                        "{job.prompt.slice(0, 90)}{job.prompt.length > 90 ? '…' : ''}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Builds */}
        {completedJobs.length > 0 && (
          <div>
            <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700, color: '#10b981' }}>
              ✅ Ready to Download ({completedJobs.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {completedJobs.map(job => (
                <div key={job.id} style={{
                  background: 'rgba(16,185,129,0.04)',
                  border: `1px solid ${job.color ? job.color + '33' : 'rgba(16,185,129,0.15)'}`,
                  borderTop: `3px solid ${job.color || '#10b981'}`,
                  borderRadius: 14, padding: 20, transition: 'transform 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 30 }}>{job.icon || '✅'}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{job.brand || job.industry || `Job #${job.id}`}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>Job #{job.id} • {job.industry}</div>
                    </div>
                  </div>

                  {job.zones && job.zones.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                      {job.zones.map(z => (
                        <span key={z} style={{
                          background: `${job.color || '#10b981'}22`,
                          border: `1px solid ${job.color || '#10b981'}44`,
                          borderRadius: 5, padding: '2px 7px', fontSize: 10,
                          color: job.color || '#10b981', fontWeight: 700,
                        }}>{z}</span>
                      ))}
                    </div>
                  )}

                  {job.test_grade && (
                    <div style={{ fontSize: 12, color: GRADE_COLORS[job.test_grade] || '#6b7280', marginBottom: 12 }}>
                      Grade: <strong>{job.test_grade}</strong>
                      {job.tests_passed != null && ` • ${job.tests_passed}/${job.tests_total} tests`}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {job.download_url && (
                      <a href={job.download_url} target="_blank" rel="noopener noreferrer" style={{
                        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                        borderRadius: 8, padding: '7px 14px', color: '#fff', fontSize: 13,
                        fontWeight: 600, textDecoration: 'none',
                      }}>📦 Download ZIP</a>
                    )}
                    {job.preview_url && (
                      <a href={job.preview_url} target="_blank" rel="noopener noreferrer" style={{
                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: 8, padding: '7px 14px', color: '#6ee7b7', fontSize: 13,
                        fontWeight: 600, textDecoration: 'none',
                      }}>🔍 Live Preview</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            color: '#4b5563',
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🏗️</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No builds yet</div>
            <div style={{ fontSize: 14 }}>Submit your first enterprise prompt above to get started.</div>
          </div>
        )}

        {/* How it works */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: '24px 28px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24,
        }}>
          {[
            { icon: '🧠', title: 'AI Brain', desc: 'Classifies your industry from 23 templates. Selects the right zones automatically.' },
            { icon: '⚙️', title: 'Sovereign Workers', desc: '5 Colab workers run in parallel. Each worker clones Miracle HMS and injects your config.' },
            { icon: '🎬', title: 'Cinema / Netflix OS', desc: 'Zones: Ticket POS, Screening Scheduler, Concessions, Staff HR, Finance, Marketing. Full enterprise coverage.' },
            { icon: '📦', title: 'Ready ZIP', desc: 'Self-contained build. Unzip → run. Includes database, frontend, backend, and Docker config.' },
          ].map(item => (
            <div key={item.title}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{item.title}</div>
              <div style={{ color: '#52525b', fontSize: 13, lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes glow { 0%, 100% { opacity: 1; box-shadow: 0 0 6px currentColor; } 50% { opacity: 0.7; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        textarea::placeholder, input::placeholder { color: #3f3f46; }
        a { transition: opacity 0.2s; }
        a:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
