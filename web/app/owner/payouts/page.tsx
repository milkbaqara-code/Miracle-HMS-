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

const FormPanel = styled.div`
  background: rgba(10, 15, 30, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0,242,255,0.15);
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 24px;
  animation: ${fadeUp} 0.4s ease forwards;
`;

const PayoutInput = styled.input`
  width: 100%;
  padding: 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  outline: none;
  box-sizing: border-box;
  margin-bottom: 16px;
  text-align: center;
  transition: border-color 0.25s;

  &:focus { border-color: #00f2ff; }
`;

const BankInfoCard = styled.div`
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 11px;
  line-height: 1.6;

  .label-group {
    margin-bottom: 8px;
    span.lbl { color: #64748b; font-weight: 700; text-transform: uppercase; margin-right: 6px; }
    span.val { color: #cbd5e1; }
  }
`;

const ActionButton = styled.button`
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #00f2ff 0%, #008ba3 100%);
  color: #000;
  border: none;
  border-radius: 12px;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PayoutRow = styled.div<{ $delay?: number }>`
  background: rgba(255,255,255,0.01);
  border: 1px solid rgba(255,255,255,0.03);
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  animation: ${fadeUp} 0.4s ease forwards;
  animation-delay: ${props => (props.$delay || 0) * 0.05}s;
  opacity: 0;

  .left {
    .amount { font-size: 14px; font-weight: 800; color: #fff; }
    .date { font-size: 9px; color: #64748b; margin-top: 3px; }
  }
  .right {
    .badge {
      font-size: 8px; font-weight: 900; letter-spacing: 1px; padding: 4px 10px; border-radius: 8px;
      text-transform: uppercase; border-width: 1px; border-style: solid;
    }
  }
`;

export default function PayoutsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);

  const showToast = useCallback((msg: string, err: boolean = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async (nid: string, token: string) => {
    try {
      const res = await fetch(`/api/pms/owner/profile?owner_nid=${encodeURIComponent(nid)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfileData(data);
    } catch {
      router.replace('/owner');
    }
  }, [router]);

  useEffect(() => {
    const raw = localStorage.getItem('SOV_OWNER_SESSION');
    const token = localStorage.getItem('SOV_OWNER_TOKEN');
    if (!raw || !token) {
      router.replace('/owner');
      return;
    }
    const parsed = JSON.parse(raw);
    setSession(parsed);
    fetchData(parsed.nid_passport, token);
  }, [router, fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData || !session) return;
    const val = parseFloat(amountInput);
    if (isNaN(val) || val <= 0) {
      showToast('Enter a valid amount', true);
      return;
    }
    if (val > profileData.profile.balance) {
      showToast('Insufficient yield balance', true);
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('SOV_OWNER_TOKEN') || '';
      const res = await fetch(`/api/pms/owner/payout-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          owner_nid: session.nid_passport,
          amount: val,
          bank_details: profileData.profile.bank_details
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Request failed');

      showToast('Withdrawal request submitted!');
      setAmountInput('');
      fetchData(session.nid_passport, token);
    } catch (err: any) {
      showToast(err.message || 'Request failed', true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!profileData) return null;

  const balance = profileData.profile.balance;

  return (
    <UnifiedCanvas>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: toast.err ? '#ef4444' : '#00f2ff', color: '#000',
          fontSize: '12px', fontWeight: 900, padding: '12px 20px', borderRadius: '10px',
          boxShadow: '0 8px 30px rgba(0,242,255,0.25)', zIndex: 99999
        }}>
          {toast.msg}
        </div>
      )}

      <HeaderRow>
        <h2>Withdraw Yield</h2>
        <Link href="/owner/hub" className="back-btn">← Back</Link>
      </HeaderRow>

      <FormPanel>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Available Balance</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#00ff88', marginTop: 4 }}>
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <PayoutInput
            type="number"
            value={amountInput}
            onChange={e => setAmountInput(e.target.value)}
            placeholder="0.00"
            min="1"
            step="any"
            required
          />

          <SectionTitle style={{ marginTop: 0 }}>Routing Destination</SectionTitle>
          <BankInfoCard>
            <div className="label-group">
              <span className="lbl">Bank Name:</span>
              <span className="val">{profileData.profile.bank_details?.bank_name || 'N/A'}</span>
            </div>
            <div className="label-group">
              <span className="lbl">Account Name:</span>
              <span className="val">{profileData.profile.bank_details?.account_name || 'N/A'}</span>
            </div>
            <div className="label-group">
              <span className="lbl">Account No:</span>
              <span className="val">{profileData.profile.bank_details?.account_number || 'N/A'}</span>
            </div>
          </BankInfoCard>

          <ActionButton type="submit" disabled={submitting || balance <= 0}>
            {submitting ? 'Submitting Transfer...' : 'Confirm Withdrawal'}
          </ActionButton>
        </form>
      </FormPanel>

      <SectionTitle>Payout History Ledger</SectionTitle>
      {profileData.payouts?.map((py: any, idx: number) => {
        const isApproved = py.status === 'APPROVED';
        const isPending = py.status === 'PENDING';
        return (
          <PayoutRow key={py.id} $delay={idx}>
            <div className="left">
              <div className="amount">${py.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <div className="date">{py.requested_at ? new Date(py.requested_at).toLocaleDateString() : 'N/A'}</div>
            </div>
            <div className="right">
              <span className="badge" style={{
                background: isApproved ? 'rgba(0,255,136,0.06)' : (isPending ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)'),
                color: isApproved ? '#00ff88' : (isPending ? '#f59e0b' : '#ef4444'),
                borderColor: isApproved ? 'rgba(0,255,136,0.2)' : (isPending ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)')
              }}>
                {py.status}
              </span>
            </div>
          </PayoutRow>
        );
      })}

      {(!profileData.payouts || profileData.payouts.length === 0) && (
        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
          No previous payout history logs found.
        </div>
      )}
    </UnifiedCanvas>
  );
}
