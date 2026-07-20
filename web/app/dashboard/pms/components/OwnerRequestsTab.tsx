// web/app/dashboard/pms/components/OwnerRequestsTab.tsx
'use client';

import { useState, useEffect } from 'react';
import MortgageSimulator from './MortgageSimulator';
import PoliciesPanel from './PoliciesPanel';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/api$/, '') || '';

interface OwnerRequestsTabProps {
  setToast: (toast: { msg: string; type: 'ok' | 'err' } | null) => void;
}

export default function OwnerRequestsTab({ setToast }: OwnerRequestsTabProps) {
  const [reqSubTab, setReqSubTab] = useState<'requests' | 'policies'>('requests');
  const [ownerRequests, setOwnerRequests] = useState<any[]>([]);
  const [reqTotal, setReqTotal] = useState(0);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqSelectedId, setReqSelectedId] = useState<number | null>(null);
  const [reqDetail, setReqDetail] = useState<any>(null);
  const [reqOverrideVal, setReqOverrideVal] = useState('');
  const [reqAdminNotes, setReqAdminNotes] = useState('');
  const [reqContactMethod, setReqContactMethod] = useState<'CALL' | 'EMAIL' | 'WHATSAPP'>('WHATSAPP');
  const [reqContactResult, setReqContactResult] = useState<any>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reqActionLoading, setReqActionLoading] = useState(false);
  const [reqStatusFilter, setReqStatusFilter] = useState('');

  const fetchRequests = async () => {
    setReqLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vigilant_token') : '';
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const params = new URLSearchParams({ limit: '100', offset: '0' });
      if (reqStatusFilter) params.set('status', reqStatusFilter);
      const r = await fetch(`${API_BASE}/api/properties/request/admin/list?${params}`, { headers });
      if (!r.ok) return;
      const d = await r.json();
      setOwnerRequests(d.requests || []);
      setReqTotal(d.total || 0);
    } catch { /* silent */ }
    finally { setReqLoading(false); }
  };

  const fetchDetail = async (id: number) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vigilant_token') : '';
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/api/properties/request/${id}`, { headers });
      if (!r.ok) return;
      const d = await r.json();
      setReqDetail(d.request);
      setReqOverrideVal(d.request.admin_override_valuation?.toString() || d.request.jv_valuation_usd?.toString() || '');
      setReqAdminNotes(d.request.admin_notes || '');
      setReqContactResult(null);
      setAiReport(d.request.ai_appraisal_report || null);
    } catch { /* silent */ }
  };

  const saveOverride = async (statusUpdate?: string) => {
    if (!reqSelectedId) return;
    setReqActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vigilant_token') : '';
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const body: any = { reviewed_by: 'ADMIN' };
      if (reqAdminNotes) body.admin_notes = reqAdminNotes;
      if (reqOverrideVal) body.admin_override_valuation = parseFloat(reqOverrideVal);
      if (statusUpdate) body.status = statusUpdate;
      const r = await fetch(`${API_BASE}/api/properties/request/admin/${reqSelectedId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      if (!r.ok) return;
      const d = await r.json();
      setReqDetail(d.request);
      if (statusUpdate) {
        setOwnerRequests(prev => prev.map((req: any) => req.id === reqSelectedId ? { ...req, status: statusUpdate } : req));
      }
      setToast({ msg: statusUpdate ? `✅ Status updated to ${statusUpdate}` : '✅ Override saved & recalculated', type: 'ok' });
    } catch { /* silent */ }
    finally { setReqActionLoading(false); }
  };

  const selectDealOnBehalf = async (deal: string) => {
    if (!reqSelectedId) return;
    setReqActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vigilant_token') : '';
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/api/properties/request/${reqSelectedId}/select-deal`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ selected_deal: deal }),
      });
      if (!r.ok) return;
      setReqDetail((prev: any) => ({ ...prev, status: 'OWNER_APPROVED', selected_deal: deal }));
      setOwnerRequests(prev => prev.map((req: any) => req.id === reqSelectedId ? { ...req, status: 'OWNER_APPROVED', selected_deal: deal } : req));
      setToast({ msg: `✅ Selected "${deal}" deal structure on behalf of owner`, type: 'ok' });
    } catch { /* silent */ }
    finally { setReqActionLoading(false); }
  };

  const approveRequest = async () => {
    if (!reqSelectedId || !window.confirm('Approve this request? This will create asset_grid entry, owner profile, GL journal, and payout.')) return;
    setReqActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vigilant_token') : '';
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/api/properties/request/admin/${reqSelectedId}/approve?reviewed_by=ADMIN`, {
        method: 'POST',
        headers
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail);
      setReqDetail((prev: any) => ({ ...prev, status: 'DISBURSEMENT_APPROVED', registered_room_id: d.registered_room_id }));
      setOwnerRequests(prev => prev.map((req: any) => req.id === reqSelectedId ? { ...req, status: 'DISBURSEMENT_APPROVED' } : req));
      setToast({ msg: `✅ APPROVED — Room: ${d.registered_room_id} | Payout: USD ${d.payout_amount_usd?.toLocaleString()}`, type: 'ok' });
    } catch (e: any) { setToast({ msg: `❌ ${e.message}`, type: 'err' }); }
    finally { setReqActionLoading(false); }
  };

  const simulateContact = async () => {
    if (!reqSelectedId) return;
    setReqActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vigilant_token') : '';
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/api/properties/request/admin/${reqSelectedId}/simulate-contact?method=${reqContactMethod}`, {
        method: 'POST',
        headers
      });
      const d = await r.json();
      setReqContactResult(d);
    } catch { /* silent */ }
    finally { setReqActionLoading(false); }
  };

  const generateAiAppraisal = async () => {
    if (!reqSelectedId) return;
    setAiLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vigilant_token') : '';
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/api/properties/request/${reqSelectedId}/ai-analyze`, {
        method: 'POST',
        headers
      });
      if (r.ok) {
        const d = await r.json();
        setAiReport(d.report);
        setToast({ msg: '✅ AGI Valuation Appraisal Report Generated!', type: 'ok' });
      }
    } catch { /* silent */ }
    finally { setAiLoading(false); }
  };

  useEffect(() => {
    if (reqSubTab === 'requests') {
      fetchRequests();
    }
  }, [reqStatusFilter, reqSubTab]);

  const statusColors: Record<string, string> = {
    PENDING: '#f59e0b', OWNER_APPROVED: '#10b981',
    DISBURSEMENT_APPROVED: '#6366f1', COMPLETED: '#34d399', REJECTED: '#ef4444',
  };
  const dealColors: Record<string, string> = { JV: '#818cf8', LEASE: '#D4AF37', RENTAL_POOL: '#38bdf8' };
  const fmt = (n: number | null | undefined) => n != null ? `$${Math.round(n).toLocaleString()}` : '—';

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Z-31 Sub-tab selector */}
      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 24, paddingBottom: 10 }}>
        <button
          onClick={() => setReqSubTab('requests')}
          style={{
            background: 'none', border: 'none',
            color: reqSubTab === 'requests' ? '#f59e0b' : '#64748b',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            borderBottom: reqSubTab === 'requests' ? '2px solid #f59e0b' : 'none',
            paddingBottom: 6, transition: 'all 0.2s'
          }}
        >
          📬 Pipeline Requests
        </button>
        <button
          onClick={() => setReqSubTab('policies')}
          style={{
            background: 'none', border: 'none',
            color: reqSubTab === 'policies' ? '#f59e0b' : '#64748b',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            borderBottom: reqSubTab === 'policies' ? '2px solid #f59e0b' : 'none',
            paddingBottom: 6, transition: 'all 0.2s'
          }}
        >
          ⚙️ Dynamic Policies Control Panel
        </button>
      </div>

      {reqSubTab === 'policies' ? (
        <PoliciesPanel setToast={setToast} />
      ) : (
        <>
          {/* Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>📬 Owner Bridge Pipeline</h2>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Total: {reqTotal} requests | Property owner submissions awaiting review</div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={reqStatusFilter}
                onChange={e => setReqStatusFilter(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: '#e2e8f0', fontSize: 13 }}
              >
                <option value=''>All Statuses</option>
                {['PENDING', 'OWNER_APPROVED', 'DISBURSEMENT_APPROVED', 'COMPLETED', 'REJECTED'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                onClick={fetchRequests}
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 10, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                {reqLoading ? '⏳ Loading...' : '↻ Refresh'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: reqSelectedId ? '1fr 420px' : '1fr', gap: 20 }}>
            {/* LEFT: Request Grid */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
              {ownerRequests.length === 0 && !reqLoading && (
                <div style={{ padding: 48, textAlign: 'center', color: '#475569' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>No requests yet</div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>When property owners submit via the public portal, they appear here.</div>
                  <button onClick={fetchRequests} style={{ marginTop: 20, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 10, padding: '10px 24px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Load Requests</button>
                </div>
              )}
              {reqLoading && (
                <div style={{ padding: 48, textAlign: 'center', color: '#475569' }}>⏳ Loading requests...</div>
              )}
              {ownerRequests.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        {['Ref', 'Owner', 'Country', 'Type', 'Valuation', 'Deal', 'Status', 'Date'].map(h => (
                          <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ownerRequests.map((req: any) => (
                        <tr
                          key={req.id}
                          onClick={() => { setReqSelectedId(req.id); fetchDetail(req.id); }}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: reqSelectedId === req.id ? 'rgba(245,158,11,0.06)' : 'transparent', transition: 'background .2s' }}
                        >
                          <td style={{ padding: '10px 14px', color: '#f59e0b', fontWeight: 700 }}>{req.ref_code}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{req.full_name}</div>
                            <div style={{ color: '#64748b', fontSize: 11 }}>{req.email || req.phone || '—'}</div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{req.property_country}</td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{req.asset_type}</td>
                          <td style={{ padding: '10px 14px', color: '#fbbf24', fontWeight: 600 }}>{fmt(req.admin_override_valuation || req.jv_valuation_usd)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {req.selected_deal ? (
                              <span style={{ padding: '2px 10px', borderRadius: 12, background: `${dealColors[req.selected_deal]}22`, color: dealColors[req.selected_deal], fontSize: 11, fontWeight: 700 }}>{req.selected_deal}</span>
                            ) : <span style={{ color: '#475569', fontSize: 11 }}>Pending</span>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 12, background: `${statusColors[req.status] || '#64748b'}22`, color: statusColors[req.status] || '#64748b', fontSize: 11, fontWeight: 700 }}>{req.status}</span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontSize: 11 }}>{req.created_at ? new Date(req.created_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* RIGHT: Detail Panel */}
            {reqSelectedId && reqDetail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Identity card */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>{reqDetail.ref_code}</div>
                      <div style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 800, marginTop: 4 }}>{reqDetail.full_name}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{reqDetail.email} · {reqDetail.phone}</div>
                    </div>
                    <button onClick={() => { setReqSelectedId(null); setReqDetail(null); }}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>✕ Close</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    {[
                      ['Property', reqDetail.property_title],
                      ['Type', reqDetail.asset_type],
                      ['Country', reqDetail.property_country],
                      ['City', reqDetail.property_city || '—'],
                      ['Land sqft', reqDetail.land_area_sqft?.toLocaleString() || '—'],
                      ['Built sqft', reqDetail.built_area_sqft?.toLocaleString() || '—'],
                      ['Owner Value', `${reqDetail.input_currency} ${reqDetail.estimated_value?.toLocaleString()}`],
                      ['Mortgage', reqDetail.has_mortgage ? `${reqDetail.input_currency} ${reqDetail.mortgage_outstanding?.toLocaleString()}` : 'None'],
                      ['NID/Passport', reqDetail.nid_passport || '—'],
                      ['Status', reqDetail.status],
                      ['Deal Selected', reqDetail.selected_deal || 'None yet'],
                      ['Room ID', reqDetail.registered_room_id || 'Not registered'],
                    ].map(([k, v]) => (
                      <div key={k}><div style={{ color: '#64748b' }}>{k}</div><div style={{ color: '#e2e8f0', fontWeight: 600, marginTop: 2 }}>{v}</div></div>
                    ))}
                  </div>
                </div>

                {/* Deal Proposals */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                  <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>📊 Engine Proposals (USD)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* JV */}
                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 14 }}>
                      <div style={{ color: '#818cf8', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>🤝 JOINT VENTURE</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                        <div><span style={{ color: '#64748b' }}>Valuation: </span><strong style={{ color: '#e2e8f0' }}>{fmt(reqDetail.jv_valuation_usd)}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Owner Share: </span><strong style={{ color: '#e2e8f0' }}>{reqDetail.jv_owner_share_pct?.toFixed(1)}%</strong></div>
                        <div><span style={{ color: '#64748b' }}>Net Annual: </span><strong style={{ color: '#34d399' }}>{fmt(reqDetail.jv_owner_annual_yield)}</strong></div>
                        <div><span style={{ color: '#64748b' }}>ROI: </span><strong style={{ color: '#e2e8f0' }}>{reqDetail.jv_roi_months} mo</strong></div>
                      </div>
                    </div>
                    {/* Lease */}
                    <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 12, padding: 14 }}>
                      <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>📃 FIXED LEASE</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                        <div><span style={{ color: '#64748b' }}>Signing Bonus: </span><strong style={{ color: '#D4AF37' }}>{fmt(reqDetail.lease_signing_bonus_usd)}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Monthly: </span><strong style={{ color: '#e2e8f0' }}>{fmt(reqDetail.lease_monthly_rent_usd)}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Term: </span><strong style={{ color: '#e2e8f0' }}>{reqDetail.lease_term_years} yr</strong></div>
                        <div><span style={{ color: '#64748b' }}>Total: </span><strong style={{ color: '#e2e8f0' }}>{fmt(reqDetail.lease_total_value_usd)}</strong></div>
                      </div>
                    </div>
                    {/* Pool */}
                    <div style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 12, padding: 14 }}>
                      <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>🏊 RENTAL POOL</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                        <div><span style={{ color: '#64748b' }}>UDI Share: </span><strong style={{ color: '#e2e8f0' }}>{reqDetail.pool_udi_pct?.toFixed(2)}%</strong></div>
                        <div><span style={{ color: '#64748b' }}>Monthly: </span><strong style={{ color: '#38bdf8' }}>{fmt(reqDetail.pool_projected_monthly_usd)}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Annual Net: </span><strong style={{ color: '#e2e8f0' }}>{fmt(reqDetail.pool_net_annual_usd)}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Mgmt: </span><strong style={{ color: '#e2e8f0' }}>{reqDetail.pool_management_fee_pct}%</strong></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin Controls: Override, Note, Accept/Cancel */}
                {reqDetail.status !== 'DISBURSEMENT_APPROVED' && reqDetail.status !== 'COMPLETED' && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                    <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>🛠️ Proposal Management & Action Panel</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Override Valuation */}
                      <div>
                        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Override Valuation (USD)</label>
                        <input
                          type='number'
                          value={reqOverrideVal}
                          onChange={e => setReqOverrideVal(e.target.value)}
                          placeholder='e.g. 750000'
                          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </div>

                      {/* Clarification Notes & Document Requirements */}
                      <div>
                        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>📝 Offer Clarification, Documents & Notes</label>
                        <textarea
                          value={reqAdminNotes}
                          onChange={e => setReqAdminNotes(e.target.value)}
                          rows={3}
                          placeholder='Specify requested documents (e.g. NID copies, deed proofs, floor layouts) or terms clarification here...'
                          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }}
                        />
                      </div>

                      {/* Save Offer Info */}
                      <button
                        onClick={() => saveOverride()}
                        disabled={reqActionLoading}
                        style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                      >
                        {reqActionLoading ? '⏳ Saving...' : '💾 Save Offer Details & Recalculate'}
                      </button>

                      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '12px 0' }} />

                      {/* Deal Approval / Rejection Actions */}
                      {reqDetail.status === 'PENDING' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Accept Proposal on behalf of Owner:</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button
                              onClick={() => selectDealOnBehalf('JV')}
                              disabled={reqActionLoading}
                              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 10, padding: '10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, textAlign: 'left' }}
                            >
                              🤝 Accept Joint Venture (JV)
                            </button>
                            <button
                              onClick={() => selectDealOnBehalf('LEASE')}
                              disabled={reqActionLoading}
                              style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', borderRadius: 10, padding: '10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, textAlign: 'left' }}
                            >
                              📃 Accept Fixed Lease
                            </button>
                            <button
                              onClick={() => selectDealOnBehalf('RENTAL_POOL')}
                              disabled={reqActionLoading}
                              style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)', color: '#38bdf8', borderRadius: 10, padding: '10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, textAlign: 'left' }}
                            >
                              🏊 Accept Rental Pool
                            </button>
                          </div>
                          <button
                            onClick={() => saveOverride('REJECTED')}
                            disabled={reqActionLoading}
                            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginTop: 6 }}
                          >
                            ❌ Cancel / Reject Request
                          </button>
                        </div>
                      )}

                      {reqDetail.status === 'OWNER_APPROVED' && reqDetail.selected_deal && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12, padding: 12 }}>
                            <div style={{ color: '#34d399', fontSize: 12, fontWeight: 700 }}>Chosen Offer: {reqDetail.selected_deal}</div>
                            <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>Ready to finalize in the portfolio ledger.</div>
                          </div>
                          <button
                            onClick={approveRequest}
                            disabled={reqActionLoading}
                            style={{ background: 'linear-gradient(90deg,#10b981,#34d399)', border: 'none', borderRadius: 12, padding: '12px', color: '#000', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}
                          >
                            {reqActionLoading ? '⏳ Registering...' : '🚀 Finalize & Approve Deal'}
                          </button>
                          <button
                            onClick={() => saveOverride('REJECTED')}
                            disabled={reqActionLoading}
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                          >
                            ❌ Cancel / Reject Request
                          </button>
                        </div>
                      )}

                      {reqDetail.status === 'REJECTED' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                          <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 700 }}>❌ Request Rejected / Cancelled</div>
                          <div style={{ color: '#64748b', fontSize: 11 }}>This offer proposal is inactive. You can review the details or reopen it below.</div>
                          <button
                            onClick={() => saveOverride('PENDING')}
                            disabled={reqActionLoading}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                          >
                            ↻ Reopen Request
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {reqDetail.status === 'DISBURSEMENT_APPROVED' && (
                  <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 16 }}>
                    <div style={{ color: '#818cf8', fontSize: 13, fontWeight: 700 }}>✅ Approved & Registered</div>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>Room: <strong style={{ color: '#e2e8f0' }}>{reqDetail.registered_room_id}</strong> | Payout ID: #{reqDetail.payout_request_id}</div>
                  </div>
                )}

                {/* Simulate Contact */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                  <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📡 Simulate Contact</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {(['EMAIL', 'CALL', 'WHATSAPP'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setReqContactMethod(m)}
                        style={{
                          padding: '6px 16px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          background: reqContactMethod === m ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                          borderColor: reqContactMethod === m ? '#818cf8' : 'rgba(255,255,255,0.1)',
                          color: reqContactMethod === m ? '#818cf8' : '#64748b',
                        }}
                      >{m}</button>
                    ))}
                    <button
                      onClick={simulateContact}
                      disabled={reqActionLoading}
                      style={{ padding: '6px 18px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {reqActionLoading ? '⏳' : '▶ Send'}
                    </button>
                  </div>
                  {reqContactResult && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 14, fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      <div style={{ color: '#34d399', fontWeight: 700, marginBottom: 6 }}>Simulation Output:</div>
                      {reqContactResult.method === 'EMAIL' && (
                        <><div><strong>To:</strong> {reqContactResult.simulation?.to}</div>
                          <div><strong>Subject:</strong> {reqContactResult.simulation?.subject}</div>
                          <div style={{ marginTop: 6 }}>{reqContactResult.simulation?.body}</div></>
                      )}
                      {reqContactResult.method === 'CALL' && (
                        <><div><strong>Number:</strong> {reqContactResult.simulation?.number}</div>
                          <div style={{ marginTop: 6 }}>{reqContactResult.simulation?.script}</div></>
                      )}
                      {reqContactResult.method === 'WHATSAPP' && (
                        <><div><strong>URL:</strong> {reqContactResult.simulation?.whatsapp_url}</div>
                          <div style={{ marginTop: 6 }}>{reqContactResult.simulation?.message}</div></>
                      )}
                    </div>
                  )}
                </div>

                {/* Z-31: AGI Valuation Appraisal Report */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700 }}>🧠 AGI Appraisal Report</div>
                    <button
                      onClick={generateAiAppraisal}
                      disabled={aiLoading}
                      style={{
                        background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#f59e0b', borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                        fontSize: 11, fontWeight: 700
                      }}
                    >
                      {aiLoading ? '⏳ Evaluating...' : '🧠 Run Appraisal'}
                    </button>
                  </div>
                  
                  {aiReport ? (
                    <div style={{
                      background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 14, fontSize: 12,
                      maxHeight: 280, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)',
                      color: '#cbd5e1', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: '1.4'
                    }}>
                      {aiReport}
                    </div>
                  ) : (
                    <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
                      No appraisal report generated yet. Click the button to invoke Miracle's AGI Real Estate Underwriter.
                    </div>
                  )}
                </div>

                {/* Z-31: Mortgage Payoff & Debt Rescue Simulator */}
                {reqDetail.has_mortgage && (
                  <MortgageSimulator reqSelectedId={reqSelectedId} setToast={setToast} />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
