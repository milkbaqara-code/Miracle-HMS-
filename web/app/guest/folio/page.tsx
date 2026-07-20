"use client";
import React, { useEffect, useState, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { useRouter } from 'next/navigation';
import { useCurrencyLang } from '../../components/CurrencyLangContext';

const API_BASE = "/api";

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const PageShell = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: #020b0c;
  color: #FFF;
  font-family: 'Outfit', sans-serif;
  max-width: 600px;
  margin: 0 auto;
  box-shadow: 0 0 80px rgba(0,0,0,0.9);
  position: relative;
  animation: ${fadeUp} 0.35s ease;

  &::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse at 50% -5%, rgba(82,209,163,0.06), transparent 55%),
      radial-gradient(ellipse at 80% 100%, rgba(112,197,226,0.04), transparent 55%);
    pointer-events: none;
    z-index: 0;
  }
`;

const Header = styled.header`
  background: rgba(4,20,23,0.9);
  backdrop-filter: blur(55px);
  -webkit-backdrop-filter: blur(55px);
  padding: 30px 20px 18px;
  border-bottom: 1px solid rgba(82,209,163,0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 50;
`;

const BackBtn = styled.button`
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #FFF;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
  &:active { transform: scale(0.86); background: rgba(255,255,255,0.1); }
`;

const BalanceCard = styled.div`
  margin: 20px 18px;
  padding: 28px 24px;
  background: linear-gradient(
    135deg,
    rgba(82,209,163,0.05) 0%,
    rgba(10,22,25,0.8) 40%,
    rgba(112,197,226,0.05) 100%
  );
  border: 1px solid rgba(82,209,163,0.15);
  border-radius: 26px;
  text-align: center;
  position: relative;
  z-index: 10;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 10%; right: 10%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(82,209,163,0.3), rgba(112,197,226,0.3), transparent);
  }
  
  .label {
    font-size: 9px;
    font-weight: bold;
    color: rgba(255,255,255,0.4);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  
  .amount {
    font-size: clamp(36px,10vw,48px);
    font-weight: bold;
    color: #52d1a3;
    text-shadow: 0 0 30px rgba(82,209,163,0.25);
    margin-bottom: 10px;
  }
  
  .room {
    font-size: 10px;
    font-weight: bold;
    color: #70c5e2;
    letter-spacing: 2px;
    text-transform: uppercase;
    opacity: 0.85;
  }
`;

const SectionLabel = styled.div`
  padding: 0 18px;
  margin: 22px 0 12px;
  font-size: 9px;
  font-weight: bold;
  color: rgba(82,209,163,0.8);
  letter-spacing: 2px;
  text-transform: uppercase;
  position: relative;
  z-index: 10;
`;

const ChargeItem = styled.div`
  margin: 0 18px 10px;
  padding: 18px;
  background: rgba(10,22,25,0.65);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(82,209,163,0.1);
  border-radius: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 10;
  transition: transform 0.2s;
  animation: ${fadeUp} 0.3s ease;

  &:active { transform: scale(0.97); }

  .left {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    
    .qty-badge {
      width: 38px; height: 38px;
      background: rgba(82,209,163,0.08);
      border: 1px solid rgba(82,209,163,0.2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #52d1a3;
      font-size: 13px;
      font-weight: bold;
      flex-shrink: 0;
    }

    .name-stack {
      .name { font-size: 13px; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 4px; line-height: 1.2; }
      .time { font-size: 9px; color: rgba(255,255,255,0.3); }
    }
  }

  .right {
    text-align: right;
    flex-shrink: 0;
    .amount { font-size: 15px; font-weight: bold; color: #FFF; margin-bottom: 3px; }
    .rate { font-size: 8px; color: rgba(112,197,226,0.8); }
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 25px;
  position: relative;
  z-index: 10;
  
  .icon { font-size: 48px; margin-bottom: 15px; opacity: 0.3; }
  .title { font-size: 14px; font-weight: bold; color: #8892b0; margin-bottom: 8px; }
  .subtitle { font-size: 11px; color: #52d1a3; }
`;

const LoadingSpinner = styled.div`
  height: 100vh;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #020b0c;
  flex-direction: column;
  gap: 18px;

  .spinner {
    width: 44px;
    height: 44px;
    border: 2px solid rgba(82,209,163,0.15);
    border-top-color: #52d1a3;
    border-radius: 50%;
    animation: ${spin} 0.8s linear infinite;
  }

  p {
    color: #52d1a3;
    font-size: 9px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
`;

interface FolioCharge {
  id: string | number;
  item_name: string;
  category: string;
  amount: number;
  qty: number;
  timestamp: string;
  transaction_id?: string;
}

interface FolioData {
  folio_id: number;
  room_number: string;
  guest_name: string;
  balance: number;
  charges: FolioCharge[];
}

export default function GuestFolioPage() {
  const { formatMoney } = useCurrencyLang();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [folio, setFolio] = useState<FolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const guestData = localStorage.getItem('SOV_GUEST_SESSION');
    if (!guestData) { router.push('/guest'); return; }
    const parsed = JSON.parse(guestData);
    setSession(parsed);

    // Fetch folio data using room number
    fetch(`${API_BASE}/guest/folio/${parsed.room_number}`)
      .then(res => {
        if (!res.ok) throw new Error('Could not load folio');
        return res.json();
      })
      .then(data => {
        if (data.status === 'SUCCESS') {
          setFolio(data.data);
        } else {
          setError('No active clinical folio found.');
        }
      })
      .catch(err => {
        setError('Unable to load your clinical bill.');
        console.error('FOLIO_FETCH_ERROR', err);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const groupedCharges = useMemo(() => {
    if (!folio?.charges) return {};
    const grouped: Record<string, FolioCharge[]> = {};
    folio.charges.forEach(charge => {
      const cat = charge.category || 'OTHER';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(charge);
    });
    return grouped;
  }, [folio]);

  const categoryLabels: Record<string, string> = {
    'ROOM': 'Ward / Cabin Stay',
    'ROOM_CHARGE': 'Ward / Cabin Stay',
    'GUEST_APP': 'Prescriptions & Pharmacy',
    'POS': 'LIS Diagnostic Lab Work',
    'F&B': 'Clinical Nutrition & Diets',
    'SPA': 'Therapy & Rehabilitation',
    'HOUSEKEEPING': 'Sanitation & Bedding Services',
    'ADVANCE': 'Advance Insurance Deposits',
    'OTHER': 'Other Clinical Charges'
  };

  if (loading) return (
    <LoadingSpinner>
      <div className="spinner" />
      <p>Syncing Clinical Folio...</p>
    </LoadingSpinner>
  );

  return (
    <PageShell>
      <Header>
        <BackBtn onClick={() => router.push('/guest/hub')}>←</BackBtn>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px', color: '#FFF' }}>My Clinical Bill</h1>
          <p style={{ margin: '2px 0 0', fontSize: '9px', fontWeight: 'bold', letterSpacing: '2px', color: '#52d1a3' }}>LIVE INVOICE</p>
        </div>
        <div style={{ width: '40px' }} />
      </Header>

      <div style={{ position: 'relative', zIndex: 10, paddingBottom: '50px' }}>
        {error ? (
          <EmptyState>
            <div className="icon">📜</div>
            <div className="title">{error}</div>
            <div className="subtitle">Contact the billing desk for assistance.</div>
          </EmptyState>
        ) : folio ? (
          <>
            <BalanceCard>
              <div className="label">CURRENT BALANCE</div>
              <div className="amount">{formatMoney(folio.balance, { decimals: 0 })}</div>
              <div className="room">WARD / BED {folio.room_number} — {folio.guest_name}</div>
            </BalanceCard>

            {Object.keys(groupedCharges).length > 0 ? (
              Object.entries(groupedCharges).map(([category, charges]) => (
                <div key={category}>
                  <SectionLabel>{categoryLabels[category] || category}</SectionLabel>
                  {charges.map((charge, idx) => {
                    const unitRate = charge.amount / (charge.qty || 1);
                    return (
                      <ChargeItem key={charge.id || idx}>
                        <div className="left">
                          <div className="qty-badge">{charge.qty || 1}</div>
                          <div className="name-stack">
                            <div className="name">{(charge.item_name || '').replace('[APP] ', '')}</div>
                            <div className="time">{charge.timestamp ? new Date(charge.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                          </div>
                        </div>
                        <div className="right">
                          <div className="amount">{formatMoney(charge.amount, { decimals: 0 })}</div>
                          {charge.qty > 1 && <div className="rate">{formatMoney(unitRate, { decimals: 0 })} / unit</div>}
                        </div>
                      </ChargeItem>
                    );
                  })}
                </div>
              ))
            ) : (
              <EmptyState>
                <div className="icon">✨</div>
                <div className="title">No charges yet</div>
                <div className="subtitle">Your clinical folio is clean.</div>
              </EmptyState>
            )}
          </>
        ) : (
          <EmptyState>
            <div className="icon">📜</div>
            <div className="title">No active folio</div>
            <div className="subtitle">Please check in at admissions first.</div>
          </EmptyState>
        )}
      </div>
    </PageShell>
  );
}
