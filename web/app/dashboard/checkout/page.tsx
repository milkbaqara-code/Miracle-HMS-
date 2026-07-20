// web/app/dashboard/checkout/page.tsx
'use client';
import { useCurrencyLang } from '../../components/CurrencyLangContext';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useGlobalSync } from '../../context/GlobalSyncContext'; // Iron Law 31
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useToast } from '../../components/SovereignToast';
import { useConfirm } from '../../components/SovereignConfirm';

// --- TYPES (Anti-Theft Precision) ---
interface GuestData {
  id: string;
  name: string;
  checkIn: string;
  rate: number;
  refStaff: string;
  advancePaid: number; 
  charges?: { id: number; item: string; amount: number; sector: string }[];
}

export default function SovereignCheckoutHub() {
  const { formatMoney, t, currency } = useCurrencyLang();
  const { syncPulse, triggerGlobalSync, kernel } = useGlobalSync();
  const isViewMode = useViewMode();
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  // ==========================================
  // 1. SYNCHRONIZED MASTER DATABASE
  // ==========================================
  const [occupancyMap, setOccupancyMap] = useState<Record<string, GuestData>>({});
  const [isSyncing, setIsSyncing] = useState(true);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchLiveFolios = useCallback(async () => {
    // 🛡️ Retrieve permanent eviction list
    const evictedRooms = JSON.parse(localStorage.getItem('miracle_evicted_rooms') || '[]');

    try {
      const res = await fetch(`${API_BASE}/frontdesk/folios`);
      if (res.ok) {
        const data = await res.json();
        const actualData = data.data ? data.data : data; 
        
        // 🛡️ CDO FIX: ABSOLUTE SYNC
        // If the backend has folios, we SHOULD overwrite or at least prune the local miracle_folios
        // to prevent ghost guest drift.
        const backendRooms = Object.keys(actualData);
        evictedRooms.forEach((rm: string) => { if (actualData[rm]) delete actualData[rm]; });
        
        // Update local miracle_folios to only include what backend says is IN_HOUSE
        const localFolios = backendRooms.map(rm => ({
            id: rm,
            room: rm,
            name: actualData[rm].name,
            checkIn: actualData[rm].checkIn,
            rate: actualData[rm].rate,
            advancePaid: actualData[rm].advancePaid,
            charges: actualData[rm].charges || []
        }));
        localStorage.setItem('miracle_folios', JSON.stringify(localFolios));

        setOccupancyMap(actualData);
      } else {
        throw new Error("Backend Offline");
      }
    } catch (e) {
      console.warn("🚨 KERNEL OFFLINE: Booting synchronized local state.");
      
      // 🛡️ THE OMNI-VAULT FIX: Read ONLY from miracle_folios as the Single Sovereign Truth.
      const fallbackData: Record<string, GuestData> = {};
      const localFoliosStr = localStorage.getItem('miracle_folios') || '[]';
      let foliosVault = [];
      try {
          const parsed = JSON.parse(localFoliosStr);
          foliosVault = Array.isArray(parsed) ? parsed : Object.values(parsed);
      } catch { foliosVault = []; }

      foliosVault.forEach((f: any) => {
          const rm = String(f.id || f.room || f.room_number);
          if (rm && !evictedRooms.includes(rm)) {
              fallbackData[rm] = {
                  id: rm,
                  name: String(f.guest || f.name || f.guest_name || 'GUEST').toUpperCase(),
                  checkIn: f.checkIn || f.check_in_date || new Date().toISOString(),
                  rate: f.rate || 5500,
                  refStaff: f.refStaff || 'FRONT DESK',
                  advancePaid: f.advancePaid || 0,
                  charges: f.charges || []
              };
          }
      });

      setOccupancyMap(fallbackData);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // ==========================================
  // 2. UI & SETTLEMENT STATES
  // ==========================================
  const [selectedRoom, setSelectedRoom] = useState("");
  const [isSettled, setIsSettled] = useState(false);
  const [authPin, setAuthPin] = useState('');
  
  const [paymentMethod, setPaymentMethod] = useState('VISA');
  const [isSwiping, setIsSwiping] = useState(false);
  const [rebateAmount, setRebateAmount] = useState(0);
  const [latePenalty, setLatePenalty] = useState(0);
  const [printStyle, setPrintStyle] = useState<'ITEMIZED' | 'CONSOLIDATED'>('ITEMIZED');
  const [multiTender, setMultiTender] = useState({ card: 0, cash: 0, mfs: 0 });

  // 🛡️ RE-FETCH INSTANTLY WHEN THE OS PULSES
  useEffect(() => {
    fetchLiveFolios().then(() => {
      const target = localStorage.getItem('miracle_target_room');
      if (target) { 
        setSelectedRoom(String(target)); 
        localStorage.removeItem('miracle_target_room'); 
      }
    });
  }, [fetchLiveFolios, syncPulse]);

  // 🛡️ SOVEREIGN RESET: Clear Browser ghosts
  const performSovereignReset = async () => {
    const confirmed = await showConfirm(
      "SOVEREIGN RESET",
      "This will purge all local browser cache and force a fresh sync from the Master Ledger. Continue?"
    );
    if (confirmed) {
        localStorage.removeItem('miracle_folios');
        localStorage.removeItem('miracle_evicted_rooms');
        showToast('VAULT PURGED', 'warning', 'Re-syncing...');
        fetchLiveFolios();
    }
  };

  useEffect(() => {
    if (!selectedRoom && Object.keys(occupancyMap).length > 0) {
      setSelectedRoom(Object.keys(occupancyMap)[0]);
    }
  }, [occupancyMap, selectedRoom]);

  // ==========================================
  // 3. FINANCIAL MASTER KERNEL
  // ==========================================
  const activeGuest = occupancyMap[selectedRoom];
  
  const finance = useMemo(() => {
    if (!activeGuest) return { roomTotal: 0, incidentals: 0, subtotal: 0, sc: 0, vat: 0, grandTotal: 0, balanceDue: 0, nights: 1, usdEq: 0, sectorTotals: {}, commission: 0 };
    
    const safeCharges = activeGuest.charges || [];
    const safeAdvance = activeGuest.advancePaid || 0;
    
    const checkInDate = new Date(activeGuest.checkIn);
    // 🛡️ CDO FIX: Use absolute live date, not a hardcoded "2026-02-24"
    const today = new Date(); 
    
    let timeDiff = today.getTime() - checkInDate.getTime();
    let nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    if (nights < 1 || isNaN(nights)) nights = 1; // Minimum 1 night charge
    
    const roomTotal = (nights * activeGuest.rate) + latePenalty;
    const incidentals = safeCharges.reduce((sum, c) => sum + c.amount, 0);
    const grossSubtotal = roomTotal + incidentals;
    
    const netSubtotal = Math.max(0, grossSubtotal - rebateAmount);
    const sc = netSubtotal * 0.10;
    const vat = netSubtotal * 0.15;
    const grandTotal = netSubtotal + sc + vat;
    
    const balanceDue = grandTotal - safeAdvance;
    const usdEq = balanceDue / 110.50; 

    const commission = activeGuest.refStaff !== 'NONE' ? netSubtotal * 0.05 : 0;

    const sectorTotals = safeCharges.reduce((acc, curr) => {
      acc[curr.sector] = (acc[curr.sector] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    return { roomTotal, incidentals, subtotal: netSubtotal, sc, vat, grandTotal, balanceDue, nights, usdEq, sectorTotals, commission };
  }, [selectedRoom, activeGuest, rebateAmount, latePenalty]);

  const totalTendered = multiTender.card + multiTender.cash + multiTender.mfs;
  const isPaymentValid = paymentMethod === 'SPLIT_TENDER' ? totalTendered >= finance.balanceDue : true;

  // 🛡️ CDO FIX: The Permanent Eviction Protocol
  const executeSettlement = async () => {
    if (!authPin) {
      showToast('SECURITY BLOCK', 'error', 'Cashier PIN required.');
      return;
    }
    if (finance.balanceDue > 0 && !isPaymentValid) {
      showToast('AUDIT ERROR', 'warning', 'Tendered amount does not cover balance.');
      return;
    }
    
    const confirmed = await showConfirm(
      "AUDIT: SETTLEMENT",
      `Finalize settlement for RM ${selectedRoom} via ${paymentMethod}?`
    );
    
    if (confirmed) {
      try {
        const response = await fetch(`${API_BASE}/frontdesk/checkout/${selectedRoom}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_method: paymentMethod, amount_paid: finance.balanceDue, cashier_pin: authPin })
        });

        if (!response.ok && response.status !== 404) throw new Error("Ledger rejected the transaction.");

        // 1. ADD TO PERMANENT LOCAL QUARANTINE
        const evicted = JSON.parse(localStorage.getItem('miracle_evicted_rooms') || '[]');
        if (!evicted.includes(String(selectedRoom))) {
            evicted.push(String(selectedRoom));
            localStorage.setItem('miracle_evicted_rooms', JSON.stringify(evicted));
        }

        // 2. SEND INSTANT PULSE TO MASTER GRID
        localStorage.setItem('miracle_last_checkout', String(selectedRoom));
        triggerGlobalSync(); // Alert the whole OS

        // 3. CLEAR UI STATE
        setIsSettled(true);
        showToast('ACID TRANSACTION SUCCESS', 'success', `Ledger zeroed. ${formatMoney(finance.commission)} allocated to ${activeGuest.refStaff}.`);
        
        setOccupancyMap(prev => {
            const newMap = { ...prev };
            delete newMap[selectedRoom];
            return newMap;
        });
        
        setSelectedRoom("");

      } catch (e) {
          showToast('TRANSACTION FAILED', 'error', 'Unable to execute settlement.');
      }
    }
  };

  const handleRoomChange = (rm: string) => {
    setSelectedRoom(rm); setIsSettled(false); setRebateAmount(0); setLatePenalty(0); setAuthPin(''); setMultiTender({card: 0, cash: 0, mfs: 0});
  };

  if (isSyncing) return <div style={{ padding: '50px', color: '#00F2FF', textAlign: 'center', fontFamily: 'Cinzel' }}><h2>📡 SYNCING WITH MASTER LEDGER...</h2></div>;
  if (!activeGuest) return <div style={{ padding: '50px', color: '#D4AF37', textAlign: 'center', fontFamily: 'Cinzel' }}><h2>NO ACTIVE FOLIOS</h2></div>;

  return (
    <div className={isViewMode ? 'zone-view-mode' : ''} style={{ padding: '0 10px', maxWidth: '1750px', margin: '0 auto' }}>
      <ViewModeBanner />
      
      {/* EXECUTIVE HEADER */}
      <div style={headerFrame}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <div>
            <h1 style={titleStyle}>🩺 PATIENT BILLING & DISCHARGE</h1>
            <p style={subTitleStyle}>ZONE 08 | PATIENT DISCHARGE & INSURANCE CLAIMS RECONCILIATION</p>
          </div>
          <div style={pickerContainer}>
            <label style={labelStyle}>SELECT PATIENT WARD/BED</label>
            <select style={roomSelect} value={selectedRoom} onChange={(e) => handleRoomChange(e.target.value)}>
              {Object.keys(occupancyMap).map(rm => (
                <option key={rm} value={rm}>BED {rm} - {occupancyMap[rm].name}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={performSovereignReset} 
            style={{ 
              background: 'rgba(255,49,49,0.1)', 
              color: '#FF3131', 
              border: '1px solid #FF3131', 
              padding: '10px 20px', 
              borderRadius: '12px', 
              fontSize: '10px', 
              fontWeight: 900, 
              cursor: 'pointer', 
              letterSpacing: '1px', 
              transition: '0.3s', 
              marginLeft: 'auto' 
            }}
          >
            🔄 DEEP RE-SYNC
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '40px' }}>
        
        {/* LEFT: LEGAL PRINT FOLIO */}
        <div className="paper-reveal" style={folioPaper}>
          <div style={folioHeader}>
            <h2 style={{ margin: 0, letterSpacing: '2px' }}>{kernel?.hotel_name || 'MIRACLE GENERAL HOSPITAL'}</h2>
            <small style={{ fontWeight: 900, color: '#888' }}>OFFICIAL TAX INVOICE</small>
            <div style={{ fontSize: '10px', marginTop: '10px' }}>
              FOLIO: #{selectedRoom}-{new Date().toISOString().split('T')[0].replace(/-/g, '')} | CASHIER ID: {authPin ? 'AUTH-XXX' : 'PENDING'}
            </div>
          </div>

          <table style={folioTable}>
            <thead>
              <tr style={tableHeader}>
                <th style={{ paddingBottom: '10px' }}>DESCRIPTION</th>
                <th style={{ textAlign: 'right', paddingBottom: '10px' }}>AMOUNT ({currency})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>BED/WARD ADMISSION REVENUE ({finance.nights} NTS) {latePenalty > 0 && <span style={{color: '#FF3131'}}>+ LATE C/O</span>}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(finance.roomTotal)}</td>
              </tr>
              
              {printStyle === 'ITEMIZED' ? (
                (activeGuest.charges || []).map(c => {
                  const qty = (c as any).qty || 1;
                  const unitRate = c.amount / qty;
                  return (
                    <tr key={c.id}>
                      <td style={tdStyle}>[{c.sector}] {c.item} {qty > 1 ? `(${qty} x ${Math.floor(unitRate)})` : ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(c.amount)}</td>
                    </tr>
                  );
                })
              ) : (
                Object.entries(finance.sectorTotals).map(([sector, amount]) => (
                  <tr key={sector}>
                    <td style={tdStyle}>CONSOLIDATED {sector} CHARGES</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(amount)}</td>
                  </tr>
                ))
              )}
              
              <tr style={spacerRow}><td colSpan={2}></td></tr>
              
              {rebateAmount > 0 && (
                <tr style={{ color: '#FF3131' }}>
                  <td style={tdStyle}><b>MANAGEMENT REBATE</b></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}><b>-{formatMoney(rebateAmount)}</b></td>
                </tr>
              )}

              <tr>
                <td style={tdStyle}><b>NET SUBTOTAL</b></td>
                <td style={{ ...tdStyle, textAlign: 'right' }}><b>{formatMoney(finance.subtotal)}</b></td>
              </tr>
              <tr>
                <td style={tdStyle}>SERVICE CHARGE (10%)</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(finance.sc)}</td>
              </tr>
              <tr>
                <td style={tdStyle}>GOVT VAT (15%)</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(finance.vat)}</td>
              </tr>
              
              <tr style={grandTotalRow}>
                <td style={{ padding: '15px 10px' }}>GROSS TOTAL DUE</td>
                <td style={{ textAlign: 'right', padding: '15px 10px' }}>{formatMoney(finance.grandTotal)}</td>
              </tr>

              {(activeGuest.advancePaid || 0) > 0 && (
                <tr>
                  <td style={{ padding: '10px', color: '#555' }}>LESS: ADVANCE DEPOSIT</td>
                  <td style={{ textAlign: 'right', padding: '10px', color: '#555' }}>-{formatMoney((activeGuest.advancePaid || 0))}</td>
                </tr>
              )}

              <tr style={balanceDueRow}>
                <td style={{ padding: '20px 15px' }}>NET BALANCE PAYABLE</td>
                <td style={{ textAlign: 'right', padding: '20px 15px' }}>
                  <div style={{ fontSize: '24px' }}>{formatMoney(finance.balanceDue)}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>USD EQUIV: ${finance.usdEq.toFixed(2)}</div>
                </td>
              </tr>
            </tbody>
          </table>

          <div style={signatureBlock}>
            <div style={sigLine}>PATIENT/GUARDIAN SIGNATURE</div>
            <div style={sigLine}>AUTHORIZED CLINICAL CASHIER</div>
          </div>
        </div>
        
        {/* RIGHT: SETTLEMENT ORCHESTRATION */}
        <div style={actionPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h4 style={panelTitle}>SETTLEMENT CONTROLLER</h4>
            <select style={miniSelect} value={printStyle} onChange={e => setPrintStyle(e.target.value as any)}>
              <option value="ITEMIZED">🧾 ITEMIZED BILL</option>
              <option value="CONSOLIDATED">💼 CORPORATE BILL</option>
            </select>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
            <div>
              <label style={labelStyle}>SERVICE REBATE ({currency})</label>
              <input type="number" style={inputStyle} value={rebateAmount || ''} onChange={e => setRebateAmount(Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>LATE C/O PENALTY ({currency})</label>
              <input type="number" style={inputStyle} value={latePenalty || ''} onChange={e => setLatePenalty(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={labelStyle}>PRIMARY SETTLEMENT GATEWAY</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
              {['VISA', 'MASTERCARD', 'AMEX', 'MAESTRO', 'CASH', 'MFS', 'CITY_LEDGER', 'SPLIT_TENDER'].map(gw => (
                 <button key={gw} onClick={() => setPaymentMethod(gw)} style={paymentMethod === gw ? gatewayBtnActive : gatewayBtnInactive}>
                    {gw}
                 </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'SPLIT_TENDER' && (
            <div style={tenderBox}>
              <label style={{...labelStyle, color: '#D4AF37'}}>MULTI-TENDER PAYMENT COLLECTION</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div>
                  <small style={tenderLabel}>CARD</small>
                  <input type="number" style={inputStyle} value={multiTender.card || ''} onChange={e => setMultiTender({...multiTender, card: Number(e.target.value)})} />
                </div>
                <div>
                  <small style={tenderLabel}>CASH</small>
                  <input type="number" style={inputStyle} value={multiTender.cash || ''} onChange={e => setMultiTender({...multiTender, cash: Number(e.target.value)})} />
                </div>
                <div>
                  <small style={tenderLabel}>MFS</small>
                  <input type="number" style={inputStyle} value={multiTender.mfs || ''} onChange={e => setMultiTender({...multiTender, mfs: Number(e.target.value)})} />
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', marginTop: '15px', fontWeight: 900, color: isPaymentValid ? '#00FF88' : '#FF3131' }}>
                TENDERED: {formatMoney(totalTendered)} / DUE: {formatMoney(Math.max(0, finance.balanceDue))}
              </div>
            </div>
          )}

          <div style={commissionBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <small style={{ color: '#888', fontWeight: 900, letterSpacing: '1px' }}>REFERRAL PAYOUT ({activeGuest.refStaff})</small>
              <b style={{ color: '#00F2FF' }}>{formatMoney(finance.commission)}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: '15px' }}>
              <span style={{ color: '#FFF', fontSize: '18px', fontWeight: 900 }}>AMOUNT TO COLLECT:</span>
              <span style={{ color: '#00FF88', fontSize: '18px', fontWeight: 900 }}>{formatMoney(Math.max(0, finance.balanceDue))}</span>
            </div>
          </div>

          <input 
            type="password" 
            placeholder="ENTER CASHIER PIN" 
            style={{...inputStyle, textAlign: 'center', marginBottom: '20px', fontSize: '16px', letterSpacing: '4px'}} 
            value={authPin} 
            onChange={e => setAuthPin(e.target.value)} 
          />

          {isSwiping ? (
            <button disabled style={settleSwipeBtn}>
                <span className="pulse">📡 AWAITING TERMINAL SWIPE...</span>
            </button>
          ) : (
            <button onClick={() => {
              if (['VISA', 'MASTERCARD', 'AMEX', 'MAESTRO'].includes(paymentMethod)) {
                  setIsSwiping(true);
                  setTimeout(() => { setIsSwiping(false); executeSettlement(); }, 2500);
              } else {
                  executeSettlement();
              }
            }} disabled={isSettled || (finance.balanceDue > 0 && !isPaymentValid)} style={settleBtn(isSettled, isPaymentValid)}>
              {isSettled ? '✅ LEDGER ZEROED' : '🚀 EXECUTE FINAL SETTLEMENT'}
            </button>
          )}

          <button onClick={() => window.print()} className="no-print" style={printBtn}>
            🖨️ PRINT TAX INVOICE
          </button>
        </div>
      </div>
    </div>
  );
}

// --- SOVEREIGN STYLES ---
const headerFrame = { marginBottom: '30px', borderBottom: '1px solid #333', paddingBottom: '20px' };
const titleStyle = { fontFamily: 'Cinzel', color: '#D4AF37', fontSize: '32px', margin: 0, letterSpacing: '2px' };
const subTitleStyle = { color: '#00F2FF', fontSize: '10px', fontWeight: 900, letterSpacing: '2px', marginTop: '5px' };
const pickerContainer = { background: 'rgba(212,175,55,0.05)', padding: '12px 25px', borderRadius: '15px', border: '1px solid rgba(212,175,55,0.3)' };
const roomSelect = { background: 'transparent', border: 'none', color: '#D4AF37', fontWeight: 900, fontSize: '18px', outline: 'none', cursor: 'pointer' };

const folioPaper = { background: '#FFF', color: '#000', padding: '60px', borderRadius: '8px', minHeight: '850px', boxShadow: '0 0 50px rgba(0,0,0,1)' };
const folioHeader = { textAlign: 'center' as const, borderBottom: '3px solid #D4AF37', paddingBottom: '25px', marginBottom: '40px' };
const folioTable = { width: '100%', borderCollapse: 'collapse' as const, fontFamily: 'monospace', fontSize: '14px' };
const tableHeader = { borderBottom: '2px solid #000', textAlign: 'left' as const };
const tdStyle = { padding: '8px 0' };
const spacerRow = { height: '40px', borderBottom: '1px solid #eee' };
const grandTotalRow = { background: '#f4f4f4', fontWeight: 900, fontSize: '18px' };
const balanceDueRow = { background: '#000', color: '#D4AF37', fontWeight: 900, border: '2px solid #000' };
const signatureBlock = { marginTop: '150px', display: 'flex', justifyContent: 'space-between' };
const sigLine = { width: '40%', borderTop: '1px solid #000', paddingTop: '15px', fontSize: '10px', textAlign: 'center' as const, fontWeight: 900 };

const actionPanel = { background: 'rgba(255,255,255,0.02)', padding: '40px', borderRadius: '25px', border: '1px solid rgba(212,175,55,0.2)', height: 'fit-content' };
const panelTitle = { color: '#D4AF37', fontFamily: 'Cinzel', margin: 0, fontSize: '16px' };
const miniSelect = { background: '#000', color: '#FFF', border: '1px solid #333', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', outline: 'none', fontWeight: 900 };
const labelStyle = { display: 'block', fontSize: '9px', fontWeight: 900, color: '#888', marginBottom: '10px', letterSpacing: '1px' };
const inputStyle = { width: '100%', background: '#000', border: '1px solid #333', padding: '16px', borderRadius: '12px', color: '#FFF', outline: 'none', fontSize: '14px' };
const tenderBox = { background: 'rgba(212,175,55,0.05)', padding: '25px', borderRadius: '15px', border: '1px solid rgba(212,175,55,0.3)', marginBottom: '25px' };
const tenderLabel = { fontSize: '9px', color: '#888', display: 'block', marginBottom: '8px', fontWeight: 900 };
const commissionBox = { background: 'rgba(0,0,0,0.4)', padding: '25px', borderRadius: '15px', border: '1px solid #333', marginBottom: '30px' };
const settleBtn = (done: boolean, valid: boolean) => ({ width: '100%', padding: '22px', background: done ? '#00FF88' : valid ? '#D4AF37' : '#555', color: '#000', fontWeight: 900, borderRadius: '15px', border: 'none', cursor: (done || !valid) ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '1px', transition: '0.3s' });
const settleSwipeBtn = { width: '100%', padding: '22px', background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: '15px', fontWeight: 900, fontSize: '12px', letterSpacing: '1px', cursor: 'not-allowed' };
const printBtn = { width: '100%', padding: '22px', background: 'transparent', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: '15px', marginTop: '20px', cursor: 'pointer', fontWeight: 900, fontSize: '12px', letterSpacing: '1px' };
const gatewayBtnInactive = { padding: '10px', background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #333', borderRadius: '8px', fontSize: '9px', fontWeight: 900, cursor: 'pointer', transition: '0.3s' };
const gatewayBtnActive = { padding: '10px', background: 'rgba(0, 242, 255, 0.1)', color: '#00F2FF', border: '1px solid #00F2FF', borderRadius: '8px', fontSize: '9px', fontWeight: 900, cursor: 'pointer', transition: '0.3s', boxShadow: '0 0 10px rgba(0,242,255,0.3)' };
