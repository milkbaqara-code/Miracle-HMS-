"use client";
import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { useRouter } from 'next/navigation';
import { useCurrencyLang } from '../../components/CurrencyLangContext';

const API_BASE = "/api";

const floatAnim = keyframes`
  0% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(-5px) scale(1.02); }
  100% { transform: translateY(0px) scale(1); }
`;

const pulseGlow = keyframes`
  0% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.2); border-color: rgba(212, 175, 55, 0.2); }
  50% { box-shadow: 0 0 45px rgba(212, 175, 55, 0.6); border-color: rgba(212, 175, 55, 0.5); }
  100% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.2); border-color: rgba(212, 175, 55, 0.2); }
`;

const PageShell = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: #000;
  color: #FFF;
  font-family: var(--font-montserrat), sans-serif;
  overflow-x: hidden;
  max-width: 600px;
  margin: 0 auto;
  position: relative;
  
  &::before {
    content: '';
    position: fixed;
    inset: 0;
    background: 
      radial-gradient(ellipse at 50% -5%, rgba(212,175,55,0.09), transparent 55%),
      radial-gradient(ellipse at 50% 110%, rgba(0,242,255,0.05), transparent 55%);
    pointer-events: none;
    z-index: 0;
  }
`;

const HeaderNav = styled.div`
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 50px 20px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(6,6,10,0.88);
  backdrop-filter: blur(55px) saturate(160%);
  -webkit-backdrop-filter: blur(55px) saturate(160%);
  box-shadow: 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px -10px rgba(0,0,0,0.8);
  will-change: transform;

  .back-btn {
    width: 42px; height: 42px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    color: #FFF; font-size: 18px; cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
    will-change: transform;
    &:active { transform: scale(0.86); background: rgba(255,255,255,0.1); }
  }
`;

const ContentBox = styled.div`
  position: relative;
  z-index: 10;
  padding: 10px 25px 120px;
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const IDCard = styled.div`
  background: linear-gradient(135deg, rgba(30,30,30,0.4), rgba(10,10,10,0.7));
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 35px;
  padding: 40px 30px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0,0,0,0.6);

  &::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.5), transparent);
  }

  .avatar {
    width: 90px; height: 90px;
    border-radius: 28px;
    background: linear-gradient(135deg, #111, #222);
    border: 1px solid rgba(0, 242, 255, 0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 36px; font-weight: 900; color: #00F2FF;
    margin-bottom: 25px;
    text-transform: uppercase;
    animation: ${floatAnim} 5s infinite ease-in-out;
    box-shadow: 0 10px 25px rgba(0, 242, 255, 0.2);
    font-family: var(--font-cinzel);
  }

  h1 { margin: 0 0 8px; font-size: 30px; font-weight: 900; letter-spacing: -0.5px; font-family: var(--font-montserrat); }
  .badge { 
    display: inline-block; padding: 8px 16px; background: rgba(0, 242, 255, 0.12); color: #00F2FF;
    border: 1px solid rgba(0,242,255,0.4); border-radius: 14px; font-size: 10px; font-weight: 900; letter-spacing: 2.5px;
    text-transform: uppercase;
  }
  .phone { margin-top: 15px; font-size: 14px; color: #666; font-weight: 600; letter-spacing: 1px; }
`;

const CoinVault = styled.div`
  background: rgba(212, 175, 55, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 32px;
  padding: 35px;
  text-align: center;
  position: relative;
  overflow: hidden;
  animation: ${pulseGlow} 5s infinite alternate ease-in-out;

  .label { font-size: 11px; color: #D4AF37; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; }
  .balance { 
    font-size: 56px; font-weight: 900; color: #FFF; margin: 15px 0 8px; 
    text-shadow: 0 0 40px rgba(212, 175, 55, 0.5);
    display: flex; align-items: center; justify-content: center; gap: 12px;
    font-family: var(--font-cinzel);
  }
  .balance span { color: #D4AF37; font-size: 38px; }
  .desc { font-size: 12px; color: #888; font-weight: 500; letter-spacing: 0.5px; }
`;

const PrivilegesGrid = styled.div`
  display: flex; gap: 18px; flex-direction: column;
  
  .title { font-size: 12px; color: #555; font-weight: 900; letter-spacing: 3px; padding-left: 10px; text-transform: uppercase;}
  
  .item {
    background: linear-gradient(135deg, rgba(20,20,20,0.5), rgba(10,10,10,0.8));
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 28px;
    padding: 24px;
    display: flex; align-items: center; gap: 18px;
    transition: all 0.3s;
    
    &:hover { border-color: rgba(255,255,255,0.2); transform: translateX(5px); }
    
    .icon { width: 50px; height: 50px; background: rgba(0,242,255,0.08); border: 1px solid rgba(0,242,255,0.15); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .text h4 { margin: 0 0 4px; font-size: 16px; color: #FFF; font-weight: 900; }
    .text p { margin: 0; font-size: 11px; color: #666; font-weight: 600; letter-spacing: 0.5px; }
    .status { margin-left: auto; font-size: 10px; font-weight: 900; color: #00FF88; background: rgba(0,255,136,0.1); padding: 6px 14px; border-radius: 12px; border: 1px solid rgba(0,255,136,0.2); }
  }
`;

const shineSwipe = keyframes`
  from { left: -60%; }
  to   { left: 120%; }
`;

const SignOutBtn = styled.button`
  width: 100%;
  padding: 20px;
  background: rgba(215,15,100,0.07);
  border: 1px solid rgba(215,15,100,0.2);
  color: rgba(215,15,100,0.9);
  border-radius: 22px;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 4px;
  cursor: pointer;
  transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s;
  text-transform: uppercase;
  margin-top: 20px;
  position: relative;
  overflow: hidden;
  will-change: transform;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: -60%; width: 40%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(215,15,100,0.15), transparent);
    transform: skewX(-20deg);
  }
  
  &:active {
    transform: scale(0.96);
    background: rgba(215,15,100,0.13);
    border-color: rgba(215,15,100,0.4);
    &::before { animation: ${shineSwipe} 0.4s ease; }
  }
`;

export default function GuestProfilePage() {
  const { formatMoney } = useCurrencyLang();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Cashout State
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutMethod, setCashoutMethod] = useState('BKASH');
  const [cashoutAccount, setCashoutAccount] = useState('');
  const [cashoutProcessing, setCashoutProcessing] = useState(false);

  useEffect(() => {
    const guestData = localStorage.getItem('SOV_GUEST_SESSION');
    if (!guestData) { router.push('/guest'); return; }
    const parsed = JSON.parse(guestData);
    setSession(parsed);

    // 🛡️ RE-SYNC CRM ID if missing in session but present in token
    const token = localStorage.getItem('SOV_GUEST_TOKEN');
    const crmId = parsed.crm_id || (token?.includes('SOVEREIGN-IN_HOUSE-') ? token.split('-')[2] : null);

    if (crmId) {
       fetch(`${API_BASE}/guest/profile/${crmId}`)
         .then(res => res.json())
         .then(data => {
            if (data.status === 'SUCCESS') setProfile(data.data);
            setLoading(false);
         })
         .catch(() => setLoading(false));
    } else {
       setLoading(false);
    }
  }, [router]);

  const handleSignOut = () => {
    localStorage.clear();
    router.push('/guest');
  };

  const handleCashout = async () => {
    const amt = parseFloat(cashoutAmount);
    if (!amt || amt <= 0) { alert('Enter a valid amount'); return; }
    if (amt > (profile?.coins || 0)) { alert('Insufficient coins'); return; }
    if (!cashoutAccount) { alert('Enter an account number'); return; }

    setCashoutProcessing(true);
    try {
      const parsed = JSON.parse(localStorage.getItem('SOV_GUEST_SESSION') || '{}');
      const token = localStorage.getItem('SOV_GUEST_TOKEN');
      const crmId = parsed.crm_id || (token?.includes('SOVEREIGN-IN_HOUSE-') ? token.split('-')[2] : null);

      const res = await fetch(`${API_BASE}/guest/ecommerce/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crm_id: crmId,
          amount: amt,
          method: cashoutMethod,
          account_details: cashoutAccount
        })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
         alert(`Cashout Successful! Payout: ${formatMoney(data.payout, { decimals: 0 })}. Fee: ${formatMoney(data.fee, { decimals: 0 })}`);
         setShowCashoutModal(false);
         setCashoutAmount(''); setCashoutAccount('');
         // Optimistic update
         setProfile((p: any) => ({ ...p, coins: p.coins - amt }));
      } else {
         alert(data.detail || data.message || 'Cashout failed.');
      }
    } catch (e) {
      alert("📶 Connection Interrupted.");
    } finally {
      setCashoutProcessing(false);
    }
  };

  if (loading) {
     return <PageShell style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
       <p style={{ color: '#D4AF37', fontSize: '11px', letterSpacing: '5px', fontWeight: 900 }}>REVEALING VAULT...</p>
     </PageShell>;
  }

  const name = profile?.name || session?.name || "Guest";
  const phone = profile?.phone || session?.phone || "No Phone Registered";
  const rawCoins = Number(profile?.coins) || 0;
  const displayCoins = rawCoins < 10 && rawCoins > 0 ? rawCoins.toFixed(2) : Math.floor(rawCoins).toLocaleString();
  const isGuest = session?.type === 'IN_HOUSE';

  return (
    <PageShell>
       <HeaderNav>
         <button className="back-btn" onClick={() => router.push('/guest/hub')}>←</button>
       </HeaderNav>

       <ContentBox>
          <IDCard>
             <div className="avatar">{name.slice(0, 2)}</div>
             <h1>{name}</h1>
             <div className="badge">{isGuest ? `ROOM ${session.room}` : 'NEIGHBOR / DELIVERY'}</div>
             <div className="phone">{phone}</div>
          </IDCard>

          <CoinVault>
             <div className="label">Miracle Coins</div>
             <div className="balance"><span>✸</span>{displayCoins}</div>
             <div className="desc" style={{ marginBottom: '15px' }}>Earn 0.05% Cashback on every Super App order.</div>
             {rawCoins > 0 && (
                <button 
                  onClick={() => setShowCashoutModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37, #AA7C11)', color: '#000',
                    border: 'none', padding: '10px 20px', borderRadius: '12px', fontSize: '11px',
                    fontWeight: 900, letterSpacing: '2px', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)'
                  }}
                >
                  CASHOUT COINS
                </button>
             )}
          </CoinVault>

          <PrivilegesGrid>
             <div className="title">Active Privileges</div>
             
             {isGuest && (
                 <div className="item">
                   <div className="icon">🏊</div>
                   <div className="text">
                     <h4>Pool Access</h4>
                     <p>Included with your stay</p>
                   </div>
                   <div className="status">ACTIVE</div>
                 </div>
             )}

             {profile?.preferences?.map((pref: string, idx: number) => (
                 <div className="item" key={idx}>
                   <div className="icon" style={{background: 'rgba(215, 15, 100, 0.08)', color: '#D70F64', borderColor: 'rgba(215, 15, 100, 0.2)'}}>⭐</div>
                   <div className="text">
                     <h4>{pref}</h4>
                     <p>Assigned by Concierge</p>
                   </div>
                   <div className="status" style={{color: '#D70F64', background: 'rgba(215, 15, 100, 0.08)', borderColor: 'rgba(215, 15, 100, 0.2)'}}>VIP</div>
                 </div>
             ))}

             {(!profile?.preferences || profile.preferences.length === 0) && !isGuest && (
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#444', marginTop: '15px', fontWeight: 700, letterSpacing: '1px' }}>No active privileges found.</p>
             )}
          </PrivilegesGrid>

          <SignOutBtn onClick={handleSignOut}>Secure Sign Out</SignOutBtn>
       </ContentBox>

       {showCashoutModal && (
         <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '400px', background: 'linear-gradient(135deg, #1a1a1a, #050505)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '24px', padding: '30px', position: 'relative' }}>
               <button onClick={() => setShowCashoutModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>×</button>
               <h3 style={{ margin: '0 0 10px', color: '#D4AF37', fontFamily: 'var(--font-cinzel)', fontSize: '20px' }}>Coin Cashout</h3>
               <p style={{ fontSize: '11px', color: '#888', margin: '0 0 20px', lineHeight: '1.5' }}>Convert Miracle Coins to Cash. A standard 20% processing and network fee applies to all withdrawals.</p>
               
               <div style={{ marginBottom: '15px' }}>
                 <label style={{ fontSize: '10px', color: '#D4AF37', fontWeight: 900, letterSpacing: '2px' }}>CASHOUT AMOUNT (MAX: {rawCoins.toFixed(2)})</label>
                 <input type="number" value={cashoutAmount} onChange={e => setCashoutAmount(e.target.value)} max={rawCoins} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', borderRadius: '12px', marginTop: '8px', fontSize: '16px' }} placeholder="0.00" />
               </div>

               <div style={{ marginBottom: '15px' }}>
                 <label style={{ fontSize: '10px', color: '#D4AF37', fontWeight: 900, letterSpacing: '2px' }}>WITHDRAWAL METHOD</label>
                 <select value={cashoutMethod} onChange={e => setCashoutMethod(e.target.value)} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', borderRadius: '12px', marginTop: '8px', fontSize: '14px' }}>
                   <option value="BKASH">bKash</option>
                   <option value="NAGAD">Nagad</option>
                   <option value="BANK_TRANSFER">Bank Transfer</option>
                 </select>
               </div>

               <div style={{ marginBottom: '25px' }}>
                 <label style={{ fontSize: '10px', color: '#D4AF37', fontWeight: 900, letterSpacing: '2px' }}>ACCOUNT / NUMBER</label>
                 <input type="text" value={cashoutAccount} onChange={e => setCashoutAccount(e.target.value)} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', borderRadius: '12px', marginTop: '8px', fontSize: '14px' }} placeholder="Enter details..." />
               </div>

               <div style={{ padding: '15px', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                    <span>Gross Amount:</span><span>{formatMoney(Number(cashoutAmount || 0))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#D70F64', marginBottom: '8px' }}>
                    <span>Processing Fee (20%):</span><span>-{formatMoney(Number(cashoutAmount || 0) * 0.2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#00FF88', fontWeight: 900, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                    <span>You Receive:</span><span>{formatMoney(Number(cashoutAmount || 0) * 0.8)}</span>
                  </div>
               </div>

               <button 
                 onClick={handleCashout}
                 disabled={cashoutProcessing}
                 style={{ width: '100%', padding: '15px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '14px', fontWeight: 900, fontSize: '12px', letterSpacing: '2px', cursor: 'pointer' }}
               >
                 {cashoutProcessing ? 'PROCESSING...' : 'CONFIRM CASHOUT'}
               </button>
            </div>
         </div>
       )}

       <style jsx global>{`
          body { background: #000; margin: 0; }
       `}</style>
    </PageShell>
  );
}
