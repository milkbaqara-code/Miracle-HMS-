"use client";
import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  box-shadow: 0 0 100px rgba(0,0,0,1);
  position: relative;
`;

const HeaderRow = styled.div`
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
  h2 { font-size: 20px; font-weight: 900; color: #00f2ff; letter-spacing: 0.5px; }
  .back-btn {
    text-decoration: none; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    color: #cbd5e1; border-radius: 10px; padding: 8px 16px; fontSize: 12px; fontWeight: 600;
  }
`;

const SectionTitle = styled.h3`
  margin: 20px 0 12px; font-size: 10px; font-weight: 900;
  color: #64748b; letter-spacing: 2px; text-transform: uppercase;
`;

const PoolCard = styled.div<{ $highlighted: boolean; $delay?: number }>`
  background: ${props => props.$highlighted ? 'rgba(0, 242, 255, 0.04)' : 'rgba(10, 15, 30, 0.7)'};
  backdrop-filter: blur(20px);
  border: 1px solid ${props => props.$highlighted ? '#00f2ff33' : 'rgba(255,255,255,0.08)'};
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 20px;
  animation: ${fadeUp} 0.4s ease forwards;
  animation-delay: ${props => (props.$delay || 0) * 0.08}s;
  opacity: 0;
  position: relative;

  .pool-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
    strong { font-size: 16px; color: ${props => props.$highlighted ? '#00f2ff' : '#fff'}; }
    .mgt-badge {
      font-size: 8px; font-weight: 900; letter-spacing: 1.5px; padding: 4px 10px; border-radius: 8px;
      background: rgba(255,255,255,0.03); color: #94a3b8; border: 1px solid rgba(255,255,255,0.08);
    }
  }

  .desc { font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 16px; }

  .stats {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px;
  }
`;

const PoolStat = styled.div`
  .lbl { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; }
  .val { font-size: 13px; font-weight: 800; color: #fff; margin-top: 2px; }
`;

const UdiRow = styled.div`
  background: rgba(0, 242, 255, 0.06);
  border: 1px dashed rgba(0, 242, 255, 0.2);
  border-radius: 12px;
  padding: 12px 14px;
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .left {
    .room { font-size: 13px; font-weight: 800; color: #00f2ff; }
    .sqft { font-size: 9px; color: #64748b; margin-top: 2px; }
  }
  .right {
    text-align: right;
    .pct { font-size: 13px; font-weight: 800; color: #00ff88; }
    .label { font-size: 8px; color: #64748b; font-weight: 700; text-transform: uppercase; }
  }
`;

export default function PoolsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('SOV_OWNER_SESSION');
    const token = localStorage.getItem('SOV_OWNER_TOKEN');
    if (!raw || !token) {
      router.replace('/owner');
      return;
    }
    const parsed = JSON.parse(raw);
    setSession(parsed);

    // Fetch pool details
    fetch('/api/pms/pools/status', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setPools(data.pools || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router]);

  if (loading || !session) return null;

  return (
    <UnifiedCanvas>
      <HeaderRow>
        <h2>Rental Pools</h2>
        <Link href="/owner/hub" className="back-btn">← Back</Link>
      </HeaderRow>

      <SectionTitle>Active Profit pools</SectionTitle>
      {pools.map((p, idx) => {
        // Find if this owner owns any rooms in this pool
        const ownerRooms = p.rooms?.filter((r: any) => 
          r.owner_entity?.toLowerCase().includes(session.full_name?.toLowerCase()) || 
          r.owner_entity?.toLowerCase().includes(session.nid_passport?.toLowerCase())
        ) || [];

        const hasRooms = ownerRooms.length > 0;

        return (
          <PoolCard key={p.pool_name} $highlighted={hasRooms} $delay={idx}>
            <div className="pool-header">
              <strong>{p.pool_name.replace(/_/g, ' ')}</strong>
              <span className="mgt-badge">Fee: {p.management_fee_pct}%</span>
            </div>
            <div className="desc">{p.description}</div>

            <div className="stats">
              <PoolStat>
                <div className="lbl">Pool Revenue (YTD)</div>
                <div className="val">${p.ytd_pool_revenue?.toLocaleString()}</div>
              </PoolStat>
              <PoolStat>
                <div className="lbl">Total Capacity</div>
                <div className="val">{p.total_rooms} Units ({p.total_pool_sqft?.toLocaleString()} sqft)</div>
              </PoolStat>
              <PoolStat>
                <div className="lbl">Disbursed Yield</div>
                <div className="val">${p.ytd_disbursed?.toLocaleString()}</div>
              </PoolStat>
              <PoolStat>
                <div className="lbl">Pool Type</div>
                <div className="val" style={{ color: '#a78bfa' }}>UDI Fractional</div>
              </PoolStat>
            </div>

            {hasRooms && <div style={{ fontSize: '9px', fontWeight: 900, color: '#00f2ff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>My UDI Allocation</div>}
            
            {ownerRooms.map((or: any) => (
              <UdiRow key={or.room_id}>
                <div className="left">
                  <div className="room">Room {or.room_id}</div>
                  <div className="sqft">{or.size_sqft} sq ft size</div>
                </div>
                <div className="right">
                  <div className="pct">{or.udi_share_pct}%</div>
                  <div className="label">Undivided Interest</div>
                </div>
              </UdiRow>
            ))}
          </PoolCard>
        );
      })}

      {pools.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
          No active profit pools found.
        </div>
      )}
    </UnifiedCanvas>
  );
}
