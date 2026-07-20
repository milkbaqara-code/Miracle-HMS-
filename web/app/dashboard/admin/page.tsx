'use client';
import React, { useState } from 'react';

import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
export default function VigilantAdminTerminal() {
  const isViewMode = useViewMode();
  const [targetZone, setTargetZone] = useState('08_BILLING');
  const [payload, setPayload] = useState({ roomId: '', guestName: '', rate: '', dept: 'RS', isEmergency: false });
  const [status, setStatus] = useState('SYSTEM READY');

  // ==========================================
  // 1. DATABASE INJECTION (POSTGRESQL SYNC)
  // ==========================================
  const injectToDatabase = async () => {
    setStatus('INJECTING DATA INTO POSTGRESQL KERNEL...');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/frontdesk/force-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(response.ok) setStatus('DB SYNC SUCCESSFUL: MASTER LEDGER UPDATED');
      else setStatus('DB SYNC PENDING: BACKEND ENDPOINT NOT YET ACTIVE');
    } catch (e) {
      setStatus('ERROR: KERNEL OFFLINE OR REJECTED PAYLOAD');
    }
  };

  const forceRoomAvailable = async () => {
    if (!payload.roomId) return setStatus('ROOM ID REQUIRED');
    setStatus('EXECUTING SOVEREIGN OVERRIDE: RESETTING ROOM...');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/frontdesk/force-available/${payload.roomId}`, {
        method: 'POST'
      });
      if(response.ok) setStatus(`OVERRIDE SUCCESS: ROOM ${payload.roomId} RELEASED TO AVAILABLE`);
      else setStatus('OVERRIDE REJECTED: ASSET NOT FOUND');
    } catch (e) {
      setStatus('KERNEL OVERRIDE FAULT');
    }
  };

  // ==========================================
  // 2. LOCAL SIGNAL EMITTER (FOR DASHBOARD TESTING)
  // ==========================================
  const emitLocalSignal = () => {
    setStatus('⚡ BROADCASTING LOCAL SIGNAL TO COMMAND GRID...');
    
    // Read the current matrix of signals
    const activeSignals = JSON.parse(localStorage.getItem('miracle_active_signals') || '[]');
    
    // Create the new pulse based on user input
    const newPulse = {
      roomId: payload.roomId || '101',
      dept: payload.dept,
      action: payload.isEmergency ? 'PULSE_CRITICAL' : 'NORMAL'
    };

    // Remove any existing signals for this room, then add the new one
    const updatedSignals = [...activeSignals.filter((s: any) => s.roomId !== newPulse.roomId), newPulse];
    
    // Fire it into the matrix
    localStorage.setItem('miracle_active_signals', JSON.stringify(updatedSignals));
    
    setTimeout(() => {
      setStatus(`✅ SIGNAL LIVE: ROOM ${newPulse.roomId} IS NOW FLASHING ON DASHBOARD.`);
    }, 500);
  };

  const clearAllSignals = () => {
    localStorage.removeItem('miracle_active_signals');
    setStatus('🧹 ALL SIGNALS CLEARED FROM MATRIX.');
  };

  return (
    <div style={{ padding: '40px', background: 'radial-gradient(circle, #0a0a0a 0%, #000 100%)', minHeight: '100vh', color: '#D4AF37', fontFamily: 'system-ui, sans-serif' }} className={isViewMode ? "zone-view-mode" : ""}>
      <ViewModeBanner />
      
      {/* 1. BRANDING HEADER */}
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '20px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel', letterSpacing: '4px', margin: 0, color: '#D4AF37' }}>VIGILANT ADMIN TERMINAL</h1>
          <p style={{ color: '#00F2FF', fontSize: '10px', fontWeight: 900, letterSpacing: '2px', marginTop: '5px' }}>ZONE 16: KERNEL DISPATCH & OVERRIDE UNIT</p>
        </div>
        <button onClick={clearAllSignals} style={{ background: 'transparent', border: '1px solid #FF3131', color: '#FF3131', padding: '10px 20px', borderRadius: '8px', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}>
          DISABLE ALL ALARMS
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        
        {/* 2. DATA INPUT UNIT */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '40px', borderRadius: '20px', border: '1px solid #222', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '30px', color: '#00F2FF', letterSpacing: '1px' }}>📡 PAYLOAD CONFIGURATION</h3>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>TARGET ASSET (ROOM ID)</label>
              <input type="text" placeholder="e.g., 105" style={terminalInput} value={payload.roomId} onChange={(e) => setPayload({...payload, roomId: e.target.value})} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>GUEST / OPERATIVE NAME</label>
              <input type="text" placeholder="John Doe" style={terminalInput} value={payload.guestName} onChange={(e) => setPayload({...payload, guestName: e.target.value})} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>DISPATCH DEPARTMENT</label>
              <select style={terminalInput} value={payload.dept} onChange={(e) => setPayload({...payload, dept: e.target.value})}>
                <option value="RS">RS - ROOM SERVICE (Cyan)</option>
                <option value="HK">HK - HOUSEKEEPING (Red)</option>
                <option value="MN">MN - MAINTENANCE (Gold)</option>
                <option value="IT">IT - TECH SUPPORT (Red Pulse)</option>
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: payload.isEmergency ? 'rgba(255,49,49,0.1)' : '#111', padding: '12px', border: `1px solid ${payload.isEmergency ? '#FF3131' : '#333'}`, borderRadius: '8px', width: '100%', height: '43px', boxSizing: 'border-box' }}>
                <input type="checkbox" checked={payload.isEmergency} onChange={(e) => setPayload({...payload, isEmergency: e.target.checked})} style={{ accentColor: '#FF3131', transform: 'scale(1.5)' }} />
                <span style={{ color: payload.isEmergency ? '#FF3131' : '#888', fontWeight: 900 }}>TRIGGER RED ALARM</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <button onClick={emitLocalSignal} className="glow-btn" style={{ flex: 1, padding: '18px', background: 'transparent', color: '#00F2FF', border: '1px solid #00F2FF', fontWeight: 900, cursor: 'pointer', borderRadius: '10px', letterSpacing: '1px', fontSize: '11px' }}>
              ⚡ BROADCAST UI SIGNAL
            </button>
            <button onClick={injectToDatabase} className="glow-btn" style={{ flex: 1, padding: '18px', background: '#D4AF37', color: '#000', fontWeight: 900, border: 'none', cursor: 'pointer', borderRadius: '10px', letterSpacing: '1px', fontSize: '11px' }}>
              💾 COMMIT TO POSTGRES
            </button>
            <button onClick={forceRoomAvailable} className="glow-btn" style={{ flex: 1, padding: '18px', background: 'rgba(255,49,49,0.1)', color: '#FF3131', border: '1px solid #FF3131', fontWeight: 900, cursor: 'pointer', borderRadius: '10px', letterSpacing: '1px', fontSize: '11px' }}>
              👑 FORCE ROOM TO AVAILABLE
            </button>
          </div>
        </div>

        {/* 3. IMPACT RADAR */}
        <div style={{ background: 'rgba(0, 242, 255, 0.02)', padding: '40px', borderRadius: '20px', border: '1px solid rgba(0,242,255,0.2)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '20px', color: '#00F2FF', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="radar-spin" style={{ display: 'inline-block', width: '10px', height: '10px', background: '#00F2FF', borderRadius: '50%' }}></span>
            SYSTEM IMPACT RADAR
          </h3>
          
          <div style={{ background: '#000', border: '1px solid #111', borderRadius: '12px', padding: '20px', flex: 1, fontFamily: 'monospace', color: '#00FF88', fontSize: '12px', lineHeight: '2' }}>
            <p style={{ color: '#888', margin: '0 0 10px 0' }}>// LIVE TELEMETRY</p>
            <p>► <b>STATUS:</b> <span style={{ color: status.includes('ERROR') ? '#FF3131' : '#00F2FF' }}>{status}</span></p>
            <p>► <b>DATABASE:</b> <span style={{color: '#FFF'}}>PostgreSQL (guest_folios & issue_tickets)</span></p>
            <p>► <b>UI VISUAL EFFECT:</b></p>
            <ul style={{ color: '#AAA', marginTop: '5px', paddingLeft: '20px' }}>
              <li>Room {payload.roomId || '[WAITING]'} will illuminate on Dashboard.</li>
              <li>Department [{payload.dept}] neon indicator will activate.</li>
              {payload.isEmergency && <li style={{ color: '#FF3131' }}>CRITICAL ALARM STROBE WILL FLASH.</li>}
            </ul>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .glow-btn { transition: 0.3s all ease; }
        .glow-btn:hover { transform: scale(1.02); box-shadow: 0 0 20px rgba(212,175,55,0.3); }
        .glow-btn:active { transform: scale(0.98); }
        @keyframes pulse-dot { 0% { opacity: 0.5; box-shadow: 0 0 0 0 rgba(0, 242, 255, 0.7); } 70% { opacity: 1; box-shadow: 0 0 0 10px rgba(0, 242, 255, 0); } 100% { opacity: 0.5; box-shadow: 0 0 0 0 rgba(0, 242, 255, 0); } }
        .radar-spin { animation: pulse-dot 2s infinite; }
      `}} />
    </div>
  );
}

const labelStyle = { fontSize: '9px', display: 'block', marginBottom: '10px', color: '#666', fontWeight: 900, letterSpacing: '1px' };
const terminalInput = { 
  width: '100%', 
  background: 'transparent', 
  border: '1px solid #333', 
  color: '#FFF', 
  padding: '15px', 
  borderRadius: '10px', 
  outline: 'none',
  boxSizing: 'border-box' as const,
  fontSize: '12px',
  transition: 'border 0.3s'
};
