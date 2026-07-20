"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styled, { keyframes } from 'styled-components';
import { useCurrencyLang } from '../../components/CurrencyLangContext';

const API_BASE = "/api";

const UnifiedCanvas = styled.div`
  min-height: 100vh;
  background: #000;
  color: #FFF;
  font-family: var(--font-montserrat), sans-serif;
  position: relative;
  max-width: 600px;
  margin: 0 auto;
  overflow-x: hidden;
  box-shadow: 0 0 100px rgba(0,0,0,1);

  &::before {
    content: '';
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at top, rgba(212, 175, 55, 0.15), transparent 70%),
                radial-gradient(circle at bottom, rgba(0, 242, 255, 0.05), transparent 50%),
                linear-gradient(to bottom, #000, #0a0a0a);
    z-index: 0;
  }
`;

const GlassHeader = styled.header`
  background: rgba(10, 10, 10, 0.75);
  backdrop-filter: blur(50px);
  -webkit-backdrop-filter: blur(50px);
  padding: 45px 25px 25px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h1 { 
    margin: 0; 
    font-size: 26px; 
    font-family: var(--font-cinzel), serif; 
    font-weight: 900; 
    letter-spacing: 2px; 
    color: #D4AF37; 
    text-shadow: 0 0 20px rgba(212,175,55,0.3); 
  }
`;

const ConciergeList = styled.div`
  padding: 25px;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 25px;
`;

const OfferCard = styled.div`
  background: rgba(15, 15, 15, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  scroll-snap-align: start;

  .image-area {
    height: 180px;
    background-size: cover;
    background-position: center;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
    }

    .badge {
      position: absolute;
      top: 15px;
      left: 15px;
      background: #D4AF37;
      color: #000;
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 1px;
      z-index: 2;
      box-shadow: 0 4px 10px rgba(212, 175, 55, 0.4);
    }
  }

  .content-area {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;

    h3 {
      margin: 0;
      color: #FFF;
      font-size: 20px;
      font-family: var(--font-cinzel), serif;
      font-weight: 900;
      letter-spacing: 1px;
    }

    p {
      margin: 0;
      color: #AAA;
      font-size: 12px;
      line-height: 1.5;
    }

    .action-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 15px;

      .price {
        color: #00F2FF;
        font-size: 18px;
        font-weight: 900;
      }

      button {
        background: linear-gradient(135deg, #00fbff 0%, #008080 100%);
        color: #000;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 900;
        font-size: 12px;
        letter-spacing: 1px;
        box-shadow: 0 4px 15px rgba(0, 242, 255, 0.3);
        cursor: pointer;
        transition: 0.2s;

        &:active {
          transform: scale(0.95);
        }
        
        &:disabled {
          background: #333;
          color: #888;
          box-shadow: none;
          cursor: not-allowed;
        }
      }
    }
  }
`;

const TabBar = styled.div`
  display: flex;
  gap: 10px;
  padding: 10px 25px;
  position: relative;
  z-index: 10;
  border-bottom: 1px solid rgba(255,255,255,0.06);
`;

const TabBtn = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? 'rgba(212, 175, 55, 0.15)' : 'transparent'};
  border: 1.5px solid ${props => props.$active ? 'rgba(212, 175, 55, 0.4)' : 'rgba(255,255,255,0.05)'};
  color: ${props => props.$active ? '#D4AF37' : '#888'};
  padding: 12px 20px;
  border-radius: 14px;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: 0.3s;
  
  &:active { transform: scale(0.95); }
`;

const RequestForm = styled.div`
  padding: 25px;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    label {
      font-size: 10px;
      font-weight: 900;
      color: #D4AF37;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    
    input, select, textarea {
      width: 100%;
      background: rgba(15, 15, 15, 0.6);
      border: 1px solid rgba(212, 175, 55, 0.2);
      color: #FFF;
      padding: 16px;
      border-radius: 16px;
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
      transition: 0.3s;
      
      &:focus {
        border-color: #D4AF37;
        box-shadow: 0 0 15px rgba(212, 175, 55, 0.15);
      }
    }
    
    textarea {
      min-height: 120px;
      resize: vertical;
    }
    
    select {
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23D4AF37' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 16px center;
      background-size: 16px;
    }
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .template-btn {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    color: #AAA;
    padding: 12px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
    transition: 0.2s;
    
    &:active {
      transform: scale(0.95);
      background: rgba(212, 175, 55, 0.08);
      border-color: rgba(212, 175, 55, 0.3);
      color: #FFF;
    }
  }
  
  .submit-btn {
    background: linear-gradient(135deg, #D4AF37 0%, #856404 100%);
    color: #000;
    border: none;
    padding: 18px;
    border-radius: 16px;
    font-weight: 900;
    font-size: 14px;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow: 0 5px 20px rgba(212, 175, 55, 0.25);
    transition: 0.3s;
    margin-top: 10px;
    
    &:active { transform: scale(0.97); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
`;

export default function GuestConciergePage() {
  const { formatMoney } = useCurrencyLang();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Custom request tab states
  const [activeTab, setActiveTab] = useState<'offers' | 'request'>('offers');
  const [customSubject, setCustomSubject] = useState('');
  const [customDept, setCustomDept] = useState('HK');
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSuccess, setCustomSuccess] = useState(false);

  useEffect(() => {
    const guestData = localStorage.getItem('SOV_GUEST_SESSION');
    if (!guestData) {
      router.push('/guest');
      return;
    }
    const parsed = JSON.parse(guestData);
    if (parsed.type !== 'IN_HOUSE') {
      alert("Exclusive Concierge Access is reserved for In-House Guests.");
      router.push('/guest/hub');
      return;
    }
    setSession(parsed);

    // Pre-select tab and department from query params if available
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const type = params.get('type');
      if (type) {
        setActiveTab('request');
        if (type === 'housekeeping') setCustomDept('HK');
        else if (type === 'frontdesk' || type === 'front-desk') setCustomDept('FD');
      }
    }

    // Fetch Bundle Offers (Z-19)
    fetch(`${API_BASE}/guest/offers`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'SUCCESS') {
          // Filter to show bundle offers or specific concierge items
          setBundles(data.data.filter((d: any) => d.is_broadcast !== true));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const purchaseBundle = async (bundle: any) => {
    if (!confirm(`Confirm purchase of ${bundle.title}?`)) return;
    setProcessingId(bundle.id);
    
    // Convert bundle to cart format for Z-06 POS engine
    const orderPayload = {
      room: session.room,
      user_type: session.type,
      payment_method: "ROOM_CHARGE",
      subtotal: bundle.rp || 0,
      total: bundle.rp || 0, // Assuming tax inclusive for bundle
      items: [{ id: bundle.id || bundle.product_id, name: bundle.title, qty: 1, rp: bundle.rp || 0, cogs: bundle.cogs || 0 }]
    };

    try {
      const res = await fetch(`${API_BASE}/guest/ecommerce/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      if (res.ok) {
        alert("✅ Concierge Request Confirmed! Our team has been notified.");
      } else {
        alert("Failed to process request. Please contact Front Desk.");
      }
    } catch (e) {
      alert("📶 Connection Interrupted. Retry request.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div style={{ height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontWeight: 900, letterSpacing: '4px' }}>CONNECTING CONCIERGE...</div>;

  const handleCustomRequest = async () => {
    if (!customSubject.trim()) return;
    setCustomSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/guest/concierge/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: session.room,
          subject: customSubject,
          dept: customDept,
          priority: 'NORMAL'
        })
      });
      if (res.ok) {
        setCustomSuccess(true);
        setCustomSubject('');
      } else {
        alert("Unable to process request. Please contact Front Desk.");
      }
    } catch {
      alert("📶 Connection Interrupted. Retry request.");
    } finally {
      setCustomSubmitting(false);
    }
  };

  const getTemplates = () => {
    if (customDept === 'HK') {
      return [
        { label: '🧹 Clean Suite', text: 'Please clean my suite and refresh the bedsheets.' },
        { label: '🛏️ Extra Towels & Pillows', text: 'I require extra fresh towels and pillows delivered to my room.' },
        { label: '🧼 Restock Toiletries', text: 'Please restock the shampoo, shower gel, and bath soaps.' },
        { label: '👕 Laundry Pick Up', text: 'I have clothes ready for dry cleaning / laundry collection.' },
      ];
    }
    if (customDept === 'FD') {
      return [
        { label: '🛎️ Late Checkout Request', text: 'I would like to request a late checkout if availability permits.' },
        { label: '⏰ Wake-Up Call', text: 'Please set a wake-up call for me tomorrow morning.' },
        { label: '👜 Luggage Assistance', text: 'I need assistance with my luggage for departure.' },
        { label: '🚗 Valet Parking Request', text: 'Please have my vehicle brought to the front driveway.' },
      ];
    }
    return [
      { label: '💡 Lighting Issue', text: 'There is a malfunctioning light bulb in my suite.' },
      { label: '❄️ AC Temperature Issue', text: 'The air conditioning in my room requires adjustment or maintenance.' },
      { label: '📶 WiFi Troubleshooting', text: 'I am experiencing connectivity issues with the room WiFi.' },
      { label: '🚿 Plumbing Request', text: 'Bathroom plumbing needs inspection/repair.' },
    ];
  };

  if (loading) return <div style={{ height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontWeight: 900, letterSpacing: '4px' }}>CONNECTING CONCIERGE...</div>;

  return (
    <UnifiedCanvas>
      <GlassHeader>
        <button onClick={() => router.push('/guest/hub')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', padding: '12px 18px', borderRadius: '14px', fontSize: '11px', fontWeight: 900, letterSpacing: '1px', cursor: 'pointer' }}>← HUB</button>
        <h1>Concierge</h1>
        <div style={{ width: '40px' }} />
      </GlassHeader>

      <TabBar>
        <TabBtn $active={activeTab === 'offers'} onClick={() => setActiveTab('offers')}>
          ✨ CURATED OFFERS
        </TabBtn>
        <TabBtn $active={activeTab === 'request'} onClick={() => setActiveTab('request')}>
          🛎️ SERVICE REQUESTS
        </TabBtn>
      </TabBar>

      {activeTab === 'offers' ? (
        <>
          <div style={{ padding: '25px 25px 0', position: 'relative', zIndex: 10 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: '14px', color: '#888', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 900 }}>Exclusive Bundles</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#555', lineHeight: '1.5' }}>Curated services and packages built directly by our luxury architects, billed directly to your suite.</p>
          </div>

          <ConciergeList>
            {bundles.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#555', fontSize: '12px', fontWeight: 700 }}>
                No exclusive bundles available at this moment.
              </div>
            ) : (
              bundles.map(bundle => (
                <OfferCard key={bundle.id}>
                  <div className="image-area" style={{ backgroundImage: `url(${bundle.image_url || bundle.image || 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80'})` }}>
                    <div className="badge">EXCLUSIVE</div>
                  </div>
                  <div className="content-area">
                    <h3>{bundle.title}</h3>
                    <p>{bundle.description || bundle.subtitle || 'A luxury experience tailored exclusively for our guests.'}</p>
                    <div className="action-row">
                      <div className="price">{bundle.rp ? formatMoney(bundle.rp, { decimals: 0 }) : 'COMPLIMENTARY'}</div>
                      <button 
                        onClick={() => purchaseBundle(bundle)}
                        disabled={processingId === bundle.id}
                      >
                        {processingId === bundle.id ? 'PROCESSING...' : 'REQUEST NOW'}
                      </button>
                    </div>
                  </div>
                </OfferCard>
              ))
            )}
          </ConciergeList>
        </>
      ) : (
        <>
          <div style={{ padding: '25px 25px 0', position: 'relative', zIndex: 10 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: '14px', color: '#888', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 900 }}>Suite Requests</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#555', lineHeight: '1.5' }}>Submit direct service requests to our duty hotel operatives. Your task goes straight to the Solve Engine.</p>
          </div>

          {customSuccess ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#D4AF37', margin: '0 0 10px' }}>Request Transmitted</h3>
              <p style={{ fontSize: '12px', color: '#888', lineHeight: 1.5, margin: '0 0 24px' }}>
                Your request has been routed to the Solve Command Center. An agent has been assigned.
              </p>
              <button 
                onClick={() => setCustomSuccess(false)}
                style={{
                  background: 'rgba(212, 175, 55, 0.15)',
                  border: '1.5px solid #D4AF37',
                  color: '#D4AF37',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                SUBMIT ANOTHER REQUEST
              </button>
            </div>
          ) : (
            <RequestForm>
              <div className="form-group">
                <label>Select Department</label>
                <select value={customDept} onChange={e => { setCustomDept(e.target.value); setCustomSubject(''); }}>
                  <option value="HK">🧹 Housekeeping & Laundry</option>
                  <option value="FD">🛎️ Front Desk / Concierge</option>
                  <option value="MAINTENANCE">🔧 Suite Maintenance</option>
                </select>
              </div>

              <div className="form-group">
                <label>Quick Presets</label>
                <div className="template-grid">
                  {getTemplates().map(t => (
                    <button 
                      key={t.label} 
                      type="button"
                      className="template-btn"
                      onClick={() => setCustomSubject(t.text)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Details of Request</label>
                <textarea 
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  placeholder="Please describe what you need in detail..."
                />
              </div>

              <button 
                className="submit-btn"
                disabled={customSubmitting || !customSubject.trim()}
                onClick={handleCustomRequest}
              >
                {customSubmitting ? 'TRANSMITTING...' : 'TRANSMIT REQUEST'}
              </button>
            </RequestForm>
          )}
        </>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        body { background: #000; margin: 0; }
      `}} />
    </UnifiedCanvas>
  );
}
