"use client";
import React, { useEffect, useState, useCallback } from 'react';
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

const RoomSelectorRow = styled.div`
  display: flex; gap: 8px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 4px;
  &::-webkit-scrollbar { display: none; }
`;

const RoomTab = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.02)'};
  border: 1px solid ${props => props.$active ? '#00f2ff' : 'rgba(255,255,255,0.08)'};
  color: ${props => props.$active ? '#00f2ff' : '#cbd5e1'};
  border-radius: 12px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer;
  white-space: nowrap; transition: 0.25s;

  &:active { transform: scale(0.95); }
`;

const StatsCard = styled.div`
  background: rgba(10, 15, 30, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 242, 255, 0.15);
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 24px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  animation: ${fadeUp} 0.4s ease forwards;
`;

const StatItem = styled.div`
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 12px;
  padding: 10px 14px;

  .lbl { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; }
  .val { font-size: 13px; font-weight: 800; color: #00f2ff; margin-top: 2px; }
`;

const AmortizationRow = styled.div<{ $delay?: number }>`
  background: rgba(255,255,255,0.01);
  border: 1px solid rgba(255,255,255,0.03);
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  animation: ${fadeUp} 0.4s ease forwards;
  animation-delay: ${props => (props.$delay || 0) * 0.04}s;
  opacity: 0;

  .left {
    .period { font-size: 13px; font-weight: 800; color: #fff; }
    .date { font-size: 9px; color: #64748b; margin-top: 3px; }
  }
  .right {
    text-align: right;
    .amount { font-size: 13px; font-weight: 700; color: #00ff88; }
    .breakdown { font-size: 9px; color: #64748b; margin-top: 2px; }
  }
`;

export default function MortgagePage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [mortgageRooms, setMortgageRooms] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(async (roomId: string) => {
    try {
      const token = localStorage.getItem('SOV_OWNER_TOKEN') || '';
      const res = await fetch(`/api/mortgage/schedule/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setScheduleData(data);
    } catch {
      setScheduleData(null);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('SOV_OWNER_SESSION');
    const token = localStorage.getItem('SOV_OWNER_TOKEN');
    if (!raw || !token) {
      router.replace('/owner');
      return;
    }
    const parsed = JSON.parse(raw);
    setSession(parsed);

    // Fetch profile to find mortgage rooms
    fetch(`/api/pms/owner/profile?owner_nid=${encodeURIComponent(parsed.nid_passport)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        const rooms = (data.properties || [])
          .filter((p: any) => p.ownership_type === 'MORTGAGE_BUYER')
          .map((p: any) => p.room_id);
        setMortgageRooms(rooms);
        if (rooms.length > 0) {
          setSelectedRoom(rooms[0]);
          fetchSchedule(rooms[0]);
        }
        setLoading(false);
      })
      .catch(() => {
        router.replace('/owner');
      });
  }, [router, fetchSchedule]);

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoom(roomId);
    fetchSchedule(roomId);
  };

  if (loading) return null;

  return (
    <UnifiedCanvas>
      <HeaderRow>
        <h2>Mortgage Engine</h2>
        <Link href="/owner/hub" className="back-btn">← Back</Link>
      </HeaderRow>

      {mortgageRooms.length === 0 ? (
        <div style={{ background: 'rgba(10, 15, 30, 0.7)', border: '1px solid rgba(0, 242, 255, 0.1)', borderRadius: 24, padding: 40, textAlign: 'center', marginTop: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🛡️</div>
          <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>Freehold Status</h3>
          <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.6 }}>
            You do not have any active mortgage buyout accounts. All your registered property assets are owned in full.
          </p>
        </div>
      ) : (
        <>
          <RoomSelectorRow>
            {mortgageRooms.map(r => (
              <RoomTab key={r} $active={r === selectedRoom} onClick={() => handleRoomSelect(r)}>
                Room {r}
              </RoomTab>
            ))}
          </RoomSelectorRow>

          {scheduleData && (
            <>
              <StatsCard>
                <StatItem>
                  <div className="lbl">Remaining Balance</div>
                  <div className="val" style={{ color: '#00ff88' }}>${scheduleData.mortgage_balance?.toLocaleString()}</div>
                </StatItem>
                <StatItem>
                  <div className="lbl">Monthly Swep</div>
                  <div className="val">${scheduleData.mortgage_monthly_payment?.toLocaleString()}</div>
                </StatItem>
                <StatItem>
                  <div className="lbl">Paid to Date</div>
                  <div className="val">${scheduleData.mortgage_paid_to_date?.toLocaleString()}</div>
                </StatItem>
                <StatItem>
                  <div className="lbl">Interest Rate</div>
                  <div className="val">{scheduleData.mortgage_interest_rate}% p.a.</div>
                </StatItem>
                <StatItem>
                  <div className="lbl">Installments Left</div>
                  <div className="val">{scheduleData.remaining_payments} Mo</div>
                </StatItem>
                <StatItem>
                  <div className="lbl">Payoff Forecast</div>
                  <div className="val" style={{ fontSize: 11, color: '#a78bfa' }}>{scheduleData.estimated_payoff_date || 'N/A'}</div>
                </StatItem>
              </StatsCard>

              <SectionTitle>Amortization Schedule (Next 12 Months)</SectionTitle>
              {scheduleData.schedule?.slice(0, 12).map((s: any, idx: number) => (
                <AmortizationRow key={s.period} $delay={idx}>
                  <div className="left">
                    <div className="period">Period #{s.period}</div>
                    <div className="date">Due: {s.due_date}</div>
                  </div>
                  <div className="right">
                    <div className="amount">${s.payment.toFixed(2)}</div>
                    <div className="breakdown">Pr: ${s.principal.toFixed(2)} | Int: ${s.interest.toFixed(2)}</div>
                  </div>
                </AmortizationRow>
              ))}
            </>
          )}
        </>
      )}
    </UnifiedCanvas>
  );
}
