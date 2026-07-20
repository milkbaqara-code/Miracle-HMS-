"use client";
import React, { useEffect, useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import OwnerAiButler from '../components/OwnerAiButler';

const nebulaFlow = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

const UnifiedCanvas = styled.div`
  min-height: 100vh;
  background: #04070c;
  color: #FFF;
  font-family: 'Inter', sans-serif;
  overflow-x: hidden;
  position: relative;
  max-width: 600px;
  margin: 0 auto;
  box-shadow: 0 0 100px rgba(0,0,0,1);

  &::before {
    content: '';
    position: fixed;
    inset: 0;
    background: linear-gradient(-45deg, #04070c, #090e17, #020408, #050c18);
    background-size: 400% 400%;
    animation: ${nebulaFlow} 15s ease infinite;
    z-index: 0;
  }
`;

const GlassHeader = styled.div`
  background: rgba(5, 7, 12, 0.85);
  backdrop-filter: blur(50px);
  -webkit-backdrop-filter: blur(50px);
  padding: 24px 20px 18px;
  border-bottom: 1px solid rgba(0, 242, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 50;

  .greeting {
    h2 { margin: 0; font-size: 20px; font-weight: 900; color: #FFF; letter-spacing: 0.5px; }
    p { margin: 4px 0 0 0; font-size: 8px; color: #00f2ff88; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
  }

  .avatar {
    width: 40px; height: 40px;
    background: linear-gradient(135deg, #090d16, #1e293b);
    border: 1px solid rgba(0, 242, 255, 0.3);
    border-radius: 12px; color: #00f2ff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 900; font-size: 14px;
    cursor: pointer; transition: 0.3s;
    &:active { transform: scale(0.9); }
  }
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 20px;
  position: relative;
  z-index: 10;
`;

const MetricCard = styled.div<{ $color: string; $delay?: number }>`
  background: rgba(10, 15, 30, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid ${props => props.$color}22;
  border-radius: 20px;
  padding: 16px;
  animation: ${fadeUp} 0.4s ease forwards;
  animation-delay: ${props => (props.$delay || 0) * 0.08}s;
  opacity: 0;

  .label { font-size: 9px; font-weight: 900; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; }
  .val { font-size: 20px; font-weight: 900; color: ${props => props.$color}; margin-top: 6px; }
`;

const QuickActionRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 0 20px;
  position: relative;
  z-index: 10;
`;

const QuickBtn = styled(Link)<{ $color: string; $delay?: number }>`
  display: flex; flex-direction: column; align-items: center; gap: 7px;
  padding: 14px 6px; background: rgba(255,255,255,0.02);
  border: 1px solid ${props => props.$color}22;
  border-radius: 16px; cursor: pointer; text-decoration: none;
  transition: all 0.2s; opacity: 0;
  animation: ${fadeUp} 0.4s ease forwards;
  animation-delay: ${props => (props.$delay || 0) * 0.06}s;

  .icon { font-size: 22px; filter: drop-shadow(0 0 5px ${props => props.$color}55); }
  .label { font-size: 7px; font-weight: 900; letter-spacing: 1px; color: rgba(255,255,255,0.5); text-transform: uppercase; text-align: center; }

  &:active { transform: scale(0.9); border-color: ${props => props.$color}; background: ${props => props.$color}10; }
`;

const SectionTitle = styled.h3`
  margin: 24px 20px 12px; font-size: 10px; font-weight: 900;
  color: #64748b; letter-spacing: 3px; text-transform: uppercase;
  position: relative; z-index: 10;
`;

const PropertyCard = styled.div<{ $delay?: number }>`
  background: rgba(10, 15, 30, 0.65);
  border: 1px solid rgba(0, 242, 255, 0.1);
  border-radius: 20px;
  padding: 18px;
  margin: 0 20px 12px;
  position: relative;
  z-index: 10;
  animation: ${fadeUp} 0.4s ease forwards;
  animation-delay: ${props => (props.$delay || 0) * 0.08}s;
  opacity: 0;

  .card-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
    strong { font-size: 16px; color: #fff; }
    .type-badge {
      font-size: 8px; font-weight: 900; letter-spacing: 1px; padding: 3px 8px; border-radius: 8px;
      background: rgba(0, 242, 255, 0.1); color: #00f2ff; border: 1px solid rgba(0, 242, 255, 0.2);
    }
  }

  .status-row {
    font-size: 11px; color: #64748b; margin-bottom: 14px;
    span.val { color: #fff; font-weight: 700; }
  }

  .splits {
    border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;

    .split-col {
      .lbl { font-size: 8px; color: #64748b; font-weight: 700; text-transform: uppercase; }
      .num { font-size: 13px; color: #00ff88; font-weight: 800; margin-top: 2px; }
    }
  }
`;
// ── SOVEREIGN STATUS CARDS COMPONENT ──────────────────────────────────────
// Shows JV Share Record, Escrow Vault, FDI Tracker, and Z-PROP listing link
// keyed by ownerNid — the single source of truth across SGPE + PMS tables
function SovereignCards({ ownerNid }: { ownerNid: string }) {
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/api$/, '') || '';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerNid) return;
    const tok = typeof window !== 'undefined' ? localStorage.getItem('miracle_token') : null;
    const h: any = tok ? { Authorization: `Bearer ${tok}` } : {};
    Promise.all([
      fetch(`${API_BASE}/api/pms/owner/portfolio?owner_nid=${encodeURIComponent(ownerNid)}`, { headers: h }).then(r => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/sovereign-finance/jv/list?investor_nid=${encodeURIComponent(ownerNid)}&limit=5`, { headers: h }).then(r => r.json()).catch(() => ({ records: [] })),
      fetch(`${API_BASE}/api/sovereign-finance/escrow/list?depositor_nid=${encodeURIComponent(ownerNid)}&limit=5`, { headers: h }).then(r => r.json()).catch(() => ({ vaults: [] })),
      fetch(`${API_BASE}/api/sovereign-finance/fdi/status?owner_nid=${encodeURIComponent(ownerNid)}`, { headers: h }).then(r => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/properties/listings?owner_nid=${encodeURIComponent(ownerNid)}&limit=5`, { headers: h }).then(r => r.json()).catch(() => ({ listings: [] })),
    ]).then(([_pms, jvData, escrowData, fdiData, listingsData]) => {
      setData({ jv: jvData.records || [], escrow: escrowData.vaults || [], fdi: fdiData, listings: listingsData.listings || [] });
    }).finally(() => setLoading(false));
  }, [ownerNid, API_BASE]);

  if (loading) return <div style={{ padding: '20px', textAlign: 'center', color: '#334155', fontSize: 12 }}>Loading sovereign data…</div>;
  if (!data) return null;

  const cardStyle = (color: string): React.CSSProperties => ({
    margin: '0 20px 12px',
    background: `rgba(${color},0.04)`,
    border: `1px solid rgba(${color},0.2)`,
    borderRadius: 14,
    padding: '16px 18px',
    position: 'relative',
    overflow: 'hidden',
  });
  const titleStyle: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 };
  const chipStyle = (bg: string, col: string): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: bg, color: col
  });

  return (
    <>
      <div style={{ padding: '8px 20px 4px', fontSize: 9, fontWeight: 900, letterSpacing: 2, color: '#334155', textTransform: 'uppercase' }}>
        Sovereign Status
      </div>

      {/* Z-PROP Marketplace Listings */}
      {data.listings.length > 0 && (
        <div style={cardStyle('14,165,233')}>
          <div style={{ ...titleStyle, color: '#0ea5e9' }}>🏠 Your Z-PROP Listings</div>
          {data.listings.map((l: any) => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{l.title}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={chipStyle(l.is_published ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.15)', l.is_published ? '#34d399' : '#fbbf24')}>
                  {l.is_published ? 'LIVE' : 'DRAFT'}
                </span>
                <a href={`/properties/${l.slug}`} target="_blank" rel="noopener" style={{ color: '#0ea5e9', fontSize: 10, textDecoration: 'none' }}>View ↗</a>
              </div>
            </div>
          ))}
          <a href="/properties" target="_blank" style={{ fontSize: 11, color: '#38bdf8', textDecoration: 'none' }}>Browse all on Z-PROP →</a>
        </div>
      )}

      {/* JV Share Records */}
      {data.jv.length > 0 && (
        <div style={cardStyle('167,139,250')}>
          <div style={{ ...titleStyle, color: '#a78bfa' }}>📊 JV Share Records</div>
          {data.jv.map((jv: any) => (
            <div key={jv.id} style={{ marginBottom: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{jv.project_name}</span>
                <span style={chipStyle('rgba(167,139,250,0.15)', '#a78bfa')}>{jv.share_type}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: 11 }}>
                Shares: <strong style={{ color: '#c4b5fd' }}>{jv.shares_held}/{jv.total_project_shares}</strong> &nbsp;·&nbsp;
                Ownership: <strong style={{ color: '#c4b5fd' }}>{jv.ownership_pct?.toFixed(1)}%</strong> &nbsp;·&nbsp;
                Invested: <strong style={{ color: '#fbbf24' }}>{jv.investment_currency} {Number(jv.total_invested).toLocaleString()}</strong>
              </div>
              <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                Payout YTD: <strong style={{ color: '#34d399' }}>{jv.investment_currency} {Number(jv.investor_share_ytd || 0).toLocaleString()}</strong> &nbsp;·&nbsp;
                Status: <span style={chipStyle(jv.transfer_status === 'LOCKED' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', jv.transfer_status === 'LOCKED' ? '#f87171' : '#34d399')}>{jv.transfer_status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Escrow Vaults */}
      {data.escrow.length > 0 && (
        <div style={cardStyle('251,191,36')}>
          <div style={{ ...titleStyle, color: '#fbbf24' }}>🔒 Escrow Vaults</div>
          {data.escrow.map((v: any) => (
            <div key={v.id} style={{ marginBottom: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{v.vault_ref}</span>
                <span style={chipStyle(v.vault_status === 'RELEASED' ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.15)', v.vault_status === 'RELEASED' ? '#34d399' : '#fbbf24')}>{v.vault_status}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: 11 }}>
                {v.milestone_label} &nbsp;·&nbsp; <strong style={{ color: '#fde68a' }}>{v.currency} {Number(v.deposit_amount).toLocaleString()}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FDI / Immigration Tracker */}
      {data.fdi?.eligibility_status && (
        <div style={cardStyle('34,211,238')}>
          <div style={{ ...titleStyle, color: '#22d3ee' }}>🛂 FDI / Immigration Status</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 700 }}>{data.fdi.target_country} — {data.fdi.visa_type || 'Visa Tracking'}</div>
              <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
                Invested: <strong style={{ color: '#22d3ee' }}>{data.fdi.threshold_currency} {Number(data.fdi.cumulative_invested || 0).toLocaleString()}</strong> of {Number(data.fdi.threshold_amount || 0).toLocaleString()}
              </div>
            </div>
            <span style={chipStyle(
              data.fdi.eligibility_status === 'THRESHOLD_MET' ? 'rgba(16,185,129,0.15)' : 'rgba(34,211,238,0.1)',
              data.fdi.eligibility_status === 'THRESHOLD_MET' ? '#34d399' : '#22d3ee'
            )}>{data.fdi.eligibility_status}</span>
          </div>
        </div>
      )}

      {/* No sovereign records */}
      {data.jv.length === 0 && data.escrow.length === 0 && !data.fdi?.eligibility_status && data.listings.length === 0 && (
        <div style={{ padding: '16px 20px', color: '#334155', fontSize: 12, textAlign: 'center' }}>
          No JV shares, escrow vaults, or FDI records found for your NID.<br/>
          <a href="/properties" style={{ color: '#38bdf8', fontSize: 11, textDecoration: 'none' }}>Explore Z-PROP Marketplace →</a>
        </div>
      )}
    </>
  );
}

export default function OwnerHub() {

  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('SOV_OWNER_SESSION');
    const token = localStorage.getItem('SOV_OWNER_TOKEN');
    if (!raw || !token) {
      router.replace('/owner');
      return;
    }
    const parsedSession = JSON.parse(raw);
    setSession(parsedSession);

    // Fetch live profile details
    fetch(`/api/pms/owner/profile?owner_nid=${encodeURIComponent(parsedSession.nid_passport)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Sync failed");
        return res.json();
      })
      .then(data => {
        setProfileData(data);
        setLoading(false);
      })
      .catch(() => {
        router.replace('/owner');
      });
  }, [router]);

  if (loading || !session) {
    return (
      <div style={{ minHeight: '100vh', background: '#04070c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid rgba(0,242,255,0.15)', borderTop: '2px solid #00f2ff', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: '9px', fontWeight: 900, color: '#334155', letterSpacing: '3px' }}>MIRACLE REAL ESTATE</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const welcomeName = session.full_name.split(' ')[0];
  const initials = session.full_name.slice(0, 2).toUpperCase();
  const balance = profileData?.profile?.balance || 0.0;
  const withdrawn = profileData?.profile?.total_withdrawn || 0.0;
  const propertiesCount = profileData?.summary?.property_count || 0;
  const rentEarned = profileData?.summary?.total_rent_earned || 0;

  return (
    <UnifiedCanvas>
      <GlassHeader>
        <div className="greeting">
          <p>Real Estate Ledger</p>
          <h2>Welcome, {welcomeName}</h2>
        </div>
        <div className="avatar">{initials}</div>
      </GlassHeader>

      {/* METRIC CARDS */}
      <MetricGrid>
        <MetricCard $color="#00f2ff" $delay={0}>
          <div className="label">Available Yield</div>
          <div className="val">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </MetricCard>
        <MetricCard $color="#a78bfa" $delay={1}>
          <div className="label">Total Withdrawn</div>
          <div className="val">${withdrawn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </MetricCard>
        <MetricCard $color="#f59e0b" $delay={2}>
          <div className="label">Properties</div>
          <div className="val">{propertiesCount} Units</div>
        </MetricCard>
        <MetricCard $color="#00ff88" $delay={3}>
          <div className="label">Accumulated Rent</div>
          <div className="val">${rentEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </MetricCard>
      </MetricGrid>

      {/* QUICK ACTIONS */}
      <SectionTitle>Quick Actions</SectionTitle>
      <QuickActionRow>
        <QuickBtn href="/owner/payouts" $color="#00f2ff" $delay={0}>
          <span className="icon">💸</span>
          <span className="label">Withdraw</span>
        </QuickBtn>
        <QuickBtn href="/owner/mortgage" $color="#a78bfa" $delay={1}>
          <span className="icon">🏦</span>
          <span className="label">Mortgage</span>
        </QuickBtn>
        <QuickBtn href="/owner/pools" $color="#f59e0b" $delay={2}>
          <span className="icon">🏊</span>
          <span className="label">Pools</span>
        </QuickBtn>
        <QuickBtn href="/owner" $color="#ef4444" $delay={3}>
          <span className="icon">🔑</span>
          <span className="label">Disconnect</span>
        </QuickBtn>
      </QuickActionRow>

      {/* PORTFOLIO LIST */}
      <SectionTitle>Property Portfolio</SectionTitle>
      {profileData?.properties?.map((p: any, i: number) => (
        <PropertyCard key={p.room_id} $delay={i}>
          <div className="card-header">
            <strong>Room {p.room_id}</strong>
            <span className="type-badge">{p.ownership_type}</span>
          </div>
          <div className="status-row">
            Category: <span className="val">{p.category}</span> · Status: <span className="val" style={{ color: p.current_status === 'AVAILABLE' ? '#00ff88' : '#f59e0b' }}>{p.current_status}</span>
          </div>
          <div className="splits">
            {p.ownership_type === 'AFFILIATED' ? (
              <>
                <div className="split-col">
                  <div className="lbl">Comm. Share</div>
                  <div className="num">{p.commission_rate}%</div>
                </div>
                <div className="split-col">
                  <div className="lbl">Accrued Yield</div>
                  <div className="num" style={{ color: '#00f2ff' }}>${p.accrued_commission.toFixed(2)}</div>
                </div>
              </>
            ) : (
              <>
                <div className="split-col">
                  <div className="lbl">Monthly Rent</div>
                  <div className="num">${p.rent_payable.toLocaleString()}</div>
                </div>
                <div className="split-col">
                  <div className="lbl">Rent Received</div>
                  <div className="num" style={{ color: '#00ff88' }}>${p.rent_earned.toFixed(2)}</div>
                </div>
              </>
            )}
          </div>
        </PropertyCard>
      ))}

      {(!profileData?.properties || profileData.properties.length === 0) && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
          No active real estate properties are registered to your NID/Passport.
        </div>
      )}

      {/* ══════════════════════════════════════════════
          SOVEREIGN STATUS CARDS — JV · Escrow · FDI
      ══════════════════════════════════════════════ */}
      <SovereignCards ownerNid={session.nid_passport} />

      <div style={{ height: '100px' }} />


      {/* AGI OWNER BUTLER */}
      <OwnerAiButler ownerNid={session.nid_passport} ownerName={session.full_name} />
    </UnifiedCanvas>
  );
}
