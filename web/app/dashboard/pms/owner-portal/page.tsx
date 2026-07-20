'use client';
import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/api$/, '') || '';

function currencyFormat(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

export default function OwnerPortal() {
  const [nidInput, setNidInput] = useState('');
  const [activeNid, setActiveNid] = useState('');
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // Payout request form
  const [payoutAmount, setPayoutAmount] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Fetch logged in owner NID from token on mount
  useEffect(() => {
    const token = localStorage.getItem('miracle_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.sub && payload.role === 'OWNER') {
          setActiveNid(payload.sub);
          setNidInput(payload.sub);
        }
      } catch (e) {
        console.error('Failed to parse token payload', e);
      }
    }
  }, []);

  const fetchProfile = useCallback(async (nidToFetch: string) => {
    if (!nidToFetch) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('miracle_token') || '';
      const res = await fetch(`${API_BASE}/api/pms/owner/profile?owner_nid=${encodeURIComponent(nidToFetch)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Owner profile not found.');
      }
      const data = await res.json();
      setProfileData(data);
      setActiveNid(nidToFetch);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load profile.');
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeNid) {
      fetchProfile(activeNid);
    }
  }, [activeNid, fetchProfile]);

  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData) return;
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid amount greater than zero.', 'err');
      return;
    }
    if (amount > profileData.profile.balance) {
      showToast('Insufficient balance for this payout request.', 'err');
      return;
    }

    setSubmittingPayout(true);
    try {
      const token = localStorage.getItem('miracle_token') || '';
      const res = await fetch(`${API_BASE}/api/pms/owner/payout-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          owner_nid: activeNid,
          amount: amount,
          bank_details: profileData.profile.bank_details
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Request failed');
      showToast('Payout request submitted successfully');
      setPayoutAmount('');
      fetchProfile(activeNid);
    } catch (err: any) {
      showToast(err.message || 'Request failed', 'err');
    } finally {
      setSubmittingPayout(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #070a13 0%, #0f172a 100%)', color: '#f1f5f9', fontFamily: 'Inter, sans-serif', padding: '32px 24px' }}>
      
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 99999, background: toast.type === 'ok' ? '#10b981' : '#ef4444', color: '#fff', borderRadius: 12, padding: '14px 24px', fontWeight: 600, fontSize: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', animation: 'fadeIn 0.3s ease' }}>
          {toast.type === 'ok' ? '✓ ' : '⚠ '} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 24, marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #00F2FF, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            MIRACLE HMS // SOVEREIGN OWNER PORTAL
          </div>
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, marginTop: 4, letterSpacing: '0.1em' }}>
            ZONE 30: REAL ESTATE EARNINGS & SETTLEMENT ENGINE
          </div>
        </div>
        <a href="/dashboard/pms" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>
          ← Back to PMS
        </a>
      </div>

      {/* NID Input Gateway if not loaded */}
      {!profileData && (
        <div style={{ maxWidth: 450, margin: '60px auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, padding: 32, backdropFilter: 'blur(20px)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>👤</div>
          <div style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 6, color: '#f1f5f9' }}>Owner Identity Gateway</div>
          <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
            Provide your registered NID or Passport number to synchronize earnings logs, rent reports, and request bank payouts.
          </div>

          <form onSubmit={(e) => { e.preventDefault(); fetchProfile(nidInput); }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>NID / Passport Number</label>
              <input type="text" value={nidInput} onChange={(e) => setNidInput(e.target.value)} placeholder="e.g. NID-99887766" style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 16px', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} required />
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: '#fff', borderRadius: 8, padding: '12px 0', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
              {loading ? 'Authorizing Secure Sync...' : 'Sync Owner Accounts'}
            </button>
          </form>

          {errorMsg && (
            <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12, marginTop: 16, fontSize: 13, textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* Main Owner Portal Dashboard */}
      {profileData && (
        <div>
          {/* Top Profile Summary Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginBottom: 32 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #00F2FF, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#070a13' }}>
                {profileData.profile.full_name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{profileData.profile.full_name}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  NID/Passport: <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{profileData.profile.nid_passport}</span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  Contact: {profileData.profile.contact || 'N/A'} · Address: {profileData.profile.address || 'N/A'}
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Available Balance</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981', marginTop: 6 }}>{currencyFormat(profileData.profile.balance)}</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Withdrawable commissions & rents</div>
              </div>
              <button onClick={() => {
                const token = localStorage.getItem('miracle_token');
                localStorage.removeItem('miracle_token');
                window.location.reload();
              }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Disconnect
              </button>
            </div>
          </div>

          {/* Stat Metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Properties Owned</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#818cf8' }}>{profileData.summary.property_count}</div>
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Active real estate units</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Total Commission Accrued</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#a78bfa' }}>{currencyFormat(profileData.summary.total_commissions_accrued)}</div>
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Accrued managed yields</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Rent Revenues Earned</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#f59e0b' }}>{currencyFormat(profileData.summary.total_rent_earned)}</div>
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Accumulated rental yields</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Total Rents/Commissions Withdrawn</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#ec4899' }}>{currencyFormat(profileData.profile.total_withdrawn || 0)}</div>
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Total settled bank transfers</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
            {/* Left Column: Properties Portfolio & History Logs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Properties Portfolio */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: '#818cf8', letterSpacing: '-0.01em' }}>🏢 Associated Real Estate Portfolio</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {profileData.properties.map((p: any, idx: number) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <strong style={{ fontSize: 14, color: '#f1f5f9' }}>{p.room_id}</strong>
                        <span style={{ fontSize: 11, background: p.ownership_type === 'AFFILIATED' ? 'rgba(167,139,250,0.1)' : 'rgba(245,158,11,0.1)', color: p.ownership_type === 'AFFILIATED' ? '#a78bfa' : '#f59e0b', border: `1px solid ${p.ownership_type === 'AFFILIATED' ? '#a78bfa33' : '#f59e0b33'}`, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                          {p.ownership_type}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{p.category}</div>
                      <div style={{ color: '#64748b', fontSize: 11, marginBottom: 12 }}>Status: <span style={{ color: p.current_status === 'AVAILABLE' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{p.current_status}</span></div>
                      
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {p.ownership_type === 'AFFILIATED' ? (
                          <>
                            <div>
                              <div style={{ color: '#64748b', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>Commission %</div>
                              <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 700, marginTop: 2 }}>{p.commission_rate}%</div>
                            </div>
                            <div>
                              <div style={{ color: '#64748b', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>Unpaid Comm.</div>
                              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginTop: 2 }}>{currencyFormat(p.accrued_commission)}</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <div style={{ color: '#64748b', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>Lease / Mo</div>
                              <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 700, marginTop: 2 }}>{currencyFormat(p.rent_payable)}</div>
                            </div>
                            <div>
                              <div style={{ color: '#64748b', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>Rents Received</div>
                              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginTop: 2 }}>{currencyFormat(p.rent_earned)}</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {profileData.properties.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>No active properties linked to this NID/Passport.</div>
                  )}
                </div>
              </div>

              {/* Payout Transfer Logs */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: '#ec4899', letterSpacing: '-0.01em' }}>📜 Payout History Ledger</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                        {['Ref ID', 'Amount', 'Bank Account', 'Status', 'Requested At'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {profileData.payouts.map((py: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: '#cbd5e1' }}>#{py.id}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: '#cbd5e1', fontWeight: 700 }}>{currencyFormat(py.amount)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: '#64748b' }}>{py.bank_details?.bank_name} - {py.bank_details?.account_number}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              background: py.status === 'APPROVED' ? 'rgba(16,185,129,0.1)' : (py.status === 'PENDING' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'),
                              border: `1px solid ${py.status === 'APPROVED' ? '#10b981' : (py.status === 'PENDING' ? '#f59e0b' : '#ef4444')}`,
                              color: py.status === 'APPROVED' ? '#10b981' : (py.status === 'PENDING' ? '#f59e0b' : '#ef4444'),
                              borderRadius: 6, fontSize: 10, fontWeight: 700, padding: '2px 8px'
                            }}>{py.status}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: '#64748b' }}>
                            {py.requested_at ? new Date(py.requested_at).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                      {profileData.payouts.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 12 }}>No payout history logs found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Bank details display & Payout request Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Bank Account snapshot */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: '#10b981', letterSpacing: '-0.01em' }}>🏦 Registered Bank Details</div>
                
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 16 }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Bank Name</div>
                    <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600, marginTop: 4 }}>{profileData.profile.bank_details?.bank_name || 'N/A'}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Account Name</div>
                    <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600, marginTop: 4 }}>{profileData.profile.bank_details?.account_name || 'N/A'}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Account Number</div>
                    <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600, marginTop: 4 }}>{profileData.profile.bank_details?.account_number || 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>IBAN / SWIFT Code</div>
                    <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600, marginTop: 4 }}>{profileData.profile.bank_details?.iban_swift || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Withdraw request Console */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: '#10b981', letterSpacing: '-0.01em' }}>💸 Request Payout Transfer</div>
                
                <form onSubmit={handleSubmitPayout}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Payout Amount ($)</label>
                    <input type="number" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} placeholder="0.00" min="1" step="any" style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 16px', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                  
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                    Payouts will be sent directly to your registered bank account listed above. Requests are audited and finalized by the accounts department within 24 hours.
                  </div>

                  <button type="submit" disabled={submittingPayout || profileData.profile.balance <= 0} style={{ width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', borderRadius: 8, padding: '12px 0', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                    {submittingPayout ? 'Submitting Transfer...' : 'Initiate Bank Payout'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
