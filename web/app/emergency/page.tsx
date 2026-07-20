"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import styled, { keyframes, createGlobalStyle } from 'styled-components';

const API = "/api";
const WS_URL = typeof window !== 'undefined'
  ? `ws://${window.location.hostname}:8095/api/emergency/ws`
  : 'ws://127.0.0.1:8095/api/emergency/ws';

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=Share+Tech+Mono&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #020506; color: #e0f0ec; font-family: 'Outfit', sans-serif; -webkit-font-smoothing: antialiased; }
`;

// ── ANIMATIONS ─────────────────────────────────────────────────────────────
const pulseRed = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,50,50,0.8), 0 0 20px rgba(255,50,50,0.3); }
  50%       { box-shadow: 0 0 0 16px rgba(255,50,50,0), 0 0 40px rgba(255,50,50,0.6); }
`;
const flashBg = keyframes`
  0%, 100% { background: rgba(255,30,30,0.08); }
  50%       { background: rgba(255,30,30,0.18); }
`;
const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-20px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const ripple = keyframes`
  0%   { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(2.5); opacity: 0; }
`;
const scan = keyframes`
  0%   { top: 0%; }
  100% { top: 100%; }
`;
const breathe = keyframes`
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
`;
const countUp = keyframes`
  from { transform: translateY(4px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
`;

// ── SHELL ───────────────────────────────────────────────────────────────────
const Shell = styled.div`
  min-height: 100vh;
  background: #020506;
  display: flex;
  flex-direction: column;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  background: rgba(2,8,10,0.98);
  border-bottom: 1px solid rgba(255,50,50,0.2);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(20px);

  .brand {
    display: flex; align-items: center; gap: 14px;
    .logo { font-size: 22px; }
    .title { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 0.5px; }
    .sub   { font-size: 10px; color: rgba(255,50,50,0.8); letter-spacing: 2px; font-weight: 600; }
  }
  .live-badge {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 14px;
    background: rgba(255,50,50,0.1);
    border: 1px solid rgba(255,50,50,0.3);
    border-radius: 20px;
    font-size: 11px; font-weight: 800; color: #FF3232; letter-spacing: 1px;
    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #FF3232;
      animation: ${breathe} 1s ease infinite;
    }
  }
  .time-display {
    font-family: 'Share Tech Mono', monospace;
    font-size: 18px; color: #52d1a3; font-weight: 400;
  }
`;

// ── STATS ROW ───────────────────────────────────────────────────────────────
const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
`;

const StatBox = styled.div<{ $color: string }>`
  background: #020809;
  padding: 16px 24px;
  .s-val  { font-size: 32px; font-weight: 900; color: ${p => p.$color}; line-height: 1; margin-bottom: 4px; font-family: 'Share Tech Mono', monospace; }
  .s-lbl  { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.35); letter-spacing: 2px; text-transform: uppercase; }
`;

// ── MAIN LAYOUT ─────────────────────────────────────────────────────────────
const MainLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 0;
  flex: 1;
  min-height: 0;
`;

const GridPanel = styled.div`
  padding: 24px;
  overflow-y: auto;
  border-right: 1px solid rgba(255,255,255,0.05);
`;

const SidePanel = styled.div`
  background: rgba(2,8,10,0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

// ── WARD BED GRID ───────────────────────────────────────────────────────────
const GridTitle = styled.div`
  font-size: 10px; font-weight: 800; letter-spacing: 3px; color: rgba(255,255,255,0.3);
  text-transform: uppercase; margin-bottom: 16px;
  display: flex; align-items: center; justify-content: space-between;
`;

const BedGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
`;

const BedCard = styled.div<{ $status: 'NORMAL' | 'ACTIVE' | 'DOCTOR_NOTIFIED' | 'AMBULANCE_DISPATCHED' | 'ARRIVED' | 'EMPTY' }>`
  border-radius: 16px;
  padding: 18px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s;
  animation: ${p => p.$status === 'ACTIVE' ? slideDown : 'none'} 0.4s ease;

  background: ${p => ({
    NORMAL: 'rgba(10,24,28,0.8)',
    ACTIVE: 'rgba(40,8,8,0.95)',
    DOCTOR_NOTIFIED: 'rgba(30,20,5,0.95)',
    AMBULANCE_DISPATCHED: 'rgba(15,20,40,0.95)',
    ARRIVED: 'rgba(8,30,20,0.95)',
    EMPTY: 'rgba(8,16,18,0.5)',
  }[p.$status])};

  border: 1px solid ${p => ({
    NORMAL: 'rgba(82,209,163,0.15)',
    ACTIVE: 'rgba(255,50,50,0.6)',
    DOCTOR_NOTIFIED: 'rgba(251,191,36,0.5)',
    AMBULANCE_DISPATCHED: 'rgba(99,102,241,0.5)',
    ARRIVED: 'rgba(52,211,153,0.5)',
    EMPTY: 'rgba(255,255,255,0.05)',
  }[p.$status])};

  animation: ${p => p.$status === 'ACTIVE' ? `${flashBg} 1.5s ease infinite` : 'none'};
  box-shadow: ${p => p.$status === 'ACTIVE' ? '0 0 30px rgba(255,50,50,0.2)' : 'none'};

  &:hover { transform: scale(1.02); }

  .bed-id    { font-size: 11px; font-weight: 800; letter-spacing: 2px; color: rgba(255,255,255,0.4); margin-bottom: 6px; }
  .patient   { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .vitals    { font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 10px; font-family: 'Share Tech Mono', monospace; }
`;

const AlertPulse = styled.div`
  position: absolute;
  top: 14px; right: 14px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: #FF3232;
  animation: ${pulseRed} 1.2s ease infinite;

  &::before {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: rgba(255,50,50,0.3);
    animation: ${ripple} 1.2s ease infinite;
  }
`;

const StatusPill = styled.div<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;

  background: ${p => ({
    ACTIVE: 'rgba(255,50,50,0.15)',
    DOCTOR_NOTIFIED: 'rgba(251,191,36,0.15)',
    AMBULANCE_DISPATCHED: 'rgba(99,102,241,0.15)',
    ARRIVED: 'rgba(52,211,153,0.15)',
    RESOLVED: 'rgba(255,255,255,0.05)',
    NORMAL: 'rgba(82,209,163,0.1)',
  }[p.$status] || 'rgba(255,255,255,0.05)')};

  color: ${p => ({
    ACTIVE: '#FF3232',
    DOCTOR_NOTIFIED: '#fbbf24',
    AMBULANCE_DISPATCHED: '#818cf8',
    ARRIVED: '#34d399',
    RESOLVED: '#888',
    NORMAL: '#52d1a3',
  }[p.$status] || '#888')};

  border: 1px solid ${p => ({
    ACTIVE: 'rgba(255,50,50,0.3)',
    DOCTOR_NOTIFIED: 'rgba(251,191,36,0.3)',
    AMBULANCE_DISPATCHED: 'rgba(99,102,241,0.3)',
    ARRIVED: 'rgba(52,211,153,0.3)',
    RESOLVED: 'rgba(255,255,255,0.08)',
    NORMAL: 'rgba(82,209,163,0.2)',
  }[p.$status] || 'rgba(255,255,255,0.08)')};
`;

// ── ACTION BUTTONS ──────────────────────────────────────────────────────────
const ActionBtn = styled.button<{ $color: string }>`
  flex: 1;
  padding: 10px 8px;
  border: 1px solid ${p => p.$color}44;
  border-radius: 10px;
  background: ${p => p.$color}12;
  color: ${p => p.$color};
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;

  &:hover { background: ${p => p.$color}22; border-color: ${p => p.$color}88; }
  &:active { transform: scale(0.96); }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;

// ── TIMELINE TRACKER ────────────────────────────────────────────────────────
const Timeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 12px;
`;

const TLStep = styled.div<{ $done: boolean; $breach: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;
  padding-bottom: 16px;

  &::before {
    content: '';
    position: absolute;
    left: 11px; top: 24px;
    width: 2px; bottom: 0;
    background: ${p => p.$done ? 'rgba(82,209,163,0.3)' : 'rgba(255,255,255,0.08)'};
  }
  &:last-child::before { display: none; }

  .tl-dot {
    width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px;
    background: ${p => p.$done ? (p.$breach ? 'rgba(255,90,50,0.2)' : 'rgba(52,211,153,0.2)') : 'rgba(255,255,255,0.05)'};
    border: 1.5px solid ${p => p.$done ? (p.$breach ? '#FF5A32' : '#34d399') : 'rgba(255,255,255,0.1)'};
  }

  .tl-info {
    .tl-label { font-size: 11px; font-weight: 700; color: ${p => p.$done ? '#fff' : 'rgba(255,255,255,0.35)'}; margin-bottom: 2px; }
    .tl-time  { font-size: 10px; color: ${p => p.$breach ? '#FF5A32' : '#52d1a3'}; font-family: 'Share Tech Mono', monospace; }
    .tl-sla   { font-size: 9px; color: ${p => p.$breach ? '#FF5A32' : '#52d1a388'}; margin-top: 2px; }
  }
`;

// ── SLA METER ───────────────────────────────────────────────────────────────
const SLAMeter = styled.div<{ $pct: number; $breach: boolean }>`
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 6px;

  &::after {
    content: '';
    display: block;
    width: ${p => Math.min(p.$pct, 100)}%;
    height: 100%;
    background: ${p => p.$breach ? '#FF5A32' : '#52d1a3'};
    border-radius: 4px;
    transition: width 1s ease;
  }
`;

// ── SIDE PANEL SECTIONS ─────────────────────────────────────────────────────
const SideSection = styled.div`
  padding: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
`;
const SideTitle = styled.div`
  font-size: 9px; font-weight: 800; letter-spacing: 2.5px;
  color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 14px;
`;

const SimCard = styled.div`
  background: rgba(255,50,50,0.06);
  border: 1px solid rgba(255,50,50,0.15);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;

  .sim-title { font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 8px; }
  .sim-desc  { font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 10px; line-height: 1.4; }

  input, select {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; padding: 8px 10px;
    color: #fff; font-size: 12px; outline: none;
    margin-bottom: 8px; font-family: 'Outfit', sans-serif;
    &:focus { border-color: rgba(255,50,50,0.4); }
  }
`;

const TriggerBtn = styled.button`
  width: 100%;
  padding: 12px;
  background: rgba(255,30,30,0.15);
  border: 1.5px solid rgba(255,30,30,0.5);
  border-radius: 10px;
  color: #FF3232;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  &:hover { background: rgba(255,30,30,0.25); box-shadow: 0 0 20px rgba(255,30,30,0.2); }
  &:active { transform: scale(0.97); }
`;

const HistoryItem = styled.div`
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  &:last-child { border-bottom: none; }

  .h-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .h-name { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.8); }
  .h-time { font-size: 10px; color: rgba(255,255,255,0.3); font-family: 'Share Tech Mono', monospace; }
  .h-detail { font-size: 10px; color: rgba(255,255,255,0.4); }
`;

// ── WRISTBAND VITALS DISPLAY ────────────────────────────────────────────────
const WristbandRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 8px;
`;
const WristPill = styled.div<{ $alert: boolean }>`
  background: ${p => p.$alert ? 'rgba(255,50,50,0.1)' : 'rgba(10,28,30,0.8)'};
  border: 1px solid ${p => p.$alert ? 'rgba(255,50,50,0.4)' : 'rgba(82,209,163,0.15)'};
  border-radius: 10px;
  padding: 10px 6px;
  text-align: center;

  .wp-val  { font-size: 15px; font-weight: 800; color: ${p => p.$alert ? '#FF5A5A' : '#fff'}; font-family: 'Share Tech Mono', monospace; }
  .wp-unit { font-size: 8px; color: rgba(255,255,255,0.3); }
  .wp-lbl  { font-size: 8px; color: ${p => p.$alert ? '#FF5A5A' : '#52d1a3'}; font-weight: 700; margin-top: 4px; }
`;

// ── DEFAULT BEDS (from HMS clinical database) ───────────────────────────────
const DEFAULT_BEDS = [
  { bed: 'WARD-01', patient: 'Sajeed Master',    occupied: true  },
  { bed: 'WARD-02', patient: 'Fatima Al-Hassan', occupied: true  },
  { bed: 'WARD-03', patient: 'James Okonkwo',    occupied: true  },
  { bed: 'WARD-04', patient: '',                 occupied: false },
  { bed: 'WARD-05', patient: 'Priya Sharma',     occupied: true  },
  { bed: 'CABIN-01', patient: 'Omar Siddiqui',   occupied: true  },
  { bed: 'CABIN-02', patient: '',                occupied: false },
  { bed: 'CABIN-03', patient: 'Chen Wei',        occupied: true  },
  { bed: 'ICU-01',   patient: 'Maria Santos',    occupied: true  },
  { bed: 'ICU-02',   patient: '',                occupied: false },
  { bed: 'ER-01',    patient: 'Ali Karimi',      occupied: true  },
  { bed: 'OT-01',    patient: '',                occupied: false },
];

function fmtSeconds(s: number | null | undefined) {
  if (s == null) return '--';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtElapsed(triggeredAt: string | null) {
  if (!triggeredAt) return '0s';
  const diff = Math.floor((Date.now() - new Date(triggeredAt).getTime()) / 1000);
  return fmtSeconds(diff);
}

function alertLabel(type: string) {
  const map: Record<string, string> = {
    CARDIAC_BRADYCARDIA: '❤️ Bradycardia',
    TACHYCARDIA: '💔 Tachycardia',
    HYPOXIA: '💨 Hypoxia',
    HYPERTHERMIA: '🌡️ High Fever',
    HYPOTHERMIA: '🧊 Hypothermia',
    HYPOTENSION: '🩸 Low BP',
    HYPERTENSION_CRISIS: '🩸 Hypertensive Crisis',
  };
  return map[type] || type;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function EmergencyCommandGrid() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [clock, setClock] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);

  // Simulation state
  const [simBed, setSimBed] = useState('WARD-01');
  const [simHR, setSimHR] = useState('35');
  const [simSPO2, setSimSPO2] = useState('88');
  const [simBP, setSimBP] = useState('70/45');
  const [simTemp, setSimTemp] = useState('40.2');
  const [simType, setSimType] = useState('HYPOXIA');

  const wsRef = useRef<WebSocket | null>(null);
  const [elapsedMap, setElapsedMap] = useState<Record<number, number>>({});

  // Live clock
  useEffect(() => {
    const t = setInterval(() => {
      setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Elapsed timers for active alerts
  useEffect(() => {
    const t = setInterval(() => {
      setElapsedMap(prev => {
        const next = { ...prev };
        alerts.forEach(a => {
          if (a.triggered_at) {
            next[a.id] = Math.floor((Date.now() - new Date(a.triggered_at).getTime()) / 1000);
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [alerts]);

  // Fetch active alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/emergency/active`);
      const json = await res.json();
      if (json.status === 'SUCCESS') setAlerts(json.data);
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/emergency/history`);
      const json = await res.json();
      if (json.status === 'SUCCESS') setHistory(json.data.slice(0, 20));
    } catch {}
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchHistory();

    // Poll as backup every 5s
    const t = setInterval(() => { fetchAlerts(); fetchHistory(); }, 5000);
    return () => clearInterval(t);
  }, [fetchAlerts, fetchHistory]);

  // WebSocket
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          setWsConnected(false);
          setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (['EMERGENCY_TRIGGERED','DOCTOR_ACKNOWLEDGED','AMBULANCE_DISPATCHED','TEAM_ARRIVED','ALERT_RESOLVED'].includes(msg.event)) {
              fetchAlerts();
              fetchHistory();
            }
          } catch {}
        };
      } catch {}
    };
    connect();
    return () => wsRef.current?.close();
  }, [fetchAlerts, fetchHistory]);

  // Actions
  const doctorAck = async (alertId: number) => {
    await fetch(`${API}/emergency/${alertId}/doctor-acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctor_id: 'DR-ON-CALL', notes: 'Acknowledged from Emergency Grid' })
    });
    fetchAlerts();
  };

  const dispatchAmbulance = async (alertId: number) => {
    await fetch(`${API}/emergency/${alertId}/dispatch-ambulance`, { method: 'POST' });
    fetchAlerts();
  };

  const markArrived = async (alertId: number) => {
    await fetch(`${API}/emergency/${alertId}/service-arrived`, { method: 'POST' });
    fetchAlerts();
  };

  const resolveAlert = async (alertId: number) => {
    await fetch(`${API}/emergency/${alertId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Resolved from Emergency Grid' })
    });
    setSelectedAlert(null);
    fetchAlerts();
    fetchHistory();
  };

  // Wristband test simulation
  const simulateTrigger = async () => {
    const deviceId = `WB-${simBed}`;
    // Register device first
    await fetch(`${API}/emergency/devices/register?device_id=${deviceId}&patient_name=Test+Patient&bed_number=${simBed}`, {
      method: 'POST'
    });
    // Stream critical vitals
    await fetch(`${API}/emergency/vitals/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        heart_rate: parseInt(simHR) || null,
        spo2: parseInt(simSPO2) || null,
        blood_pressure: simBP || null,
        temperature: parseFloat(simTemp) || null,
      })
    });
    fetchAlerts();
  };

  // Map alerts to beds
  const alertByBed = alerts.reduce((acc: Record<string, any>, a) => {
    if (!['RESOLVED'].includes(a.status)) acc[a.bed_number] = a;
    return acc;
  }, {});

  const activeCount = alerts.filter(a => a.status === 'ACTIVE').length;
  const docCount = alerts.filter(a => a.status === 'DOCTOR_NOTIFIED').length;
  const ambCount = alerts.filter(a => a.status === 'AMBULANCE_DISPATCHED').length;
  const resolvedCount = history.filter(a => a.status === 'RESOLVED').length;

  return (
    <Shell>
      <GlobalStyle />

      {/* TOP BAR */}
      <TopBar>
        <div className="brand">
          <span className="logo">🚨</span>
          <div>
            <div className="title">Emergency Command Grid</div>
            <div className="sub">Miracle General Hospital · RERS v1.0</div>
          </div>
        </div>
        <div className="live-badge">
          <div className="dot" />
          {wsConnected ? 'LIVE MONITORING' : 'RECONNECTING...'}
        </div>
        <div className="time-display">{clock}</div>
      </TopBar>

      {/* STATS */}
      <StatsRow>
        <StatBox $color="#FF3232">
          <div className="s-val">{activeCount}</div>
          <div className="s-lbl">🔴 Critical Active</div>
        </StatBox>
        <StatBox $color="#fbbf24">
          <div className="s-val">{docCount}</div>
          <div className="s-lbl">🩺 Doctor Notified</div>
        </StatBox>
        <StatBox $color="#818cf8">
          <div className="s-val">{ambCount}</div>
          <div className="s-lbl">🚑 Ambulance En Route</div>
        </StatBox>
        <StatBox $color="#34d399">
          <div className="s-val">{resolvedCount}</div>
          <div className="s-lbl">✅ Resolved Today</div>
        </StatBox>
      </StatsRow>

      <MainLayout>

        {/* BED GRID */}
        <GridPanel>
          <GridTitle>
            <span>Ward Bed Monitor — All Stations</span>
            <span style={{ fontSize: 10, color: '#52d1a3' }}>{DEFAULT_BEDS.filter(b => b.occupied).length} occupied · {DEFAULT_BEDS.length} total</span>
          </GridTitle>

          <BedGrid>
            {DEFAULT_BEDS.map((bed) => {
              const alert = alertByBed[bed.bed];
              const status = !bed.occupied ? 'EMPTY' : alert ? alert.status : 'NORMAL';
              const elapsed = alert ? (elapsedMap[alert.id] || 0) : 0;

              return (
                <BedCard key={bed.bed} $status={status as any}
                  onClick={() => alert && setSelectedAlert(alert)}>

                  {status === 'ACTIVE' && <AlertPulse />}

                  <div className="bed-id">{bed.bed}</div>
                  <div className="patient">{bed.occupied ? (alert?.patient_name || bed.patient) : '— Vacant —'}</div>

                  {alert && (
                    <div className="vitals">
                      {alert.heart_rate && `HR: ${alert.heart_rate}bpm  `}
                      {alert.spo2 && `SpO2: ${alert.spo2}%  `}
                      {alert.blood_pressure && `BP: ${alert.blood_pressure}`}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <StatusPill $status={status}>
                      {status === 'EMPTY' ? '🛏 Vacant' :
                       status === 'NORMAL' ? '🟢 Stable' :
                       status === 'ACTIVE' ? '🔴 CRITICAL' :
                       status === 'DOCTOR_NOTIFIED' ? '🩺 Doc Ack' :
                       status === 'AMBULANCE_DISPATCHED' ? '🚑 En Route' :
                       status === 'ARRIVED' ? '✅ Arrived' : status}
                    </StatusPill>
                    {alert && (
                      <span style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", color: elapsed > 300 ? '#FF5A32' : '#52d1a3' }}>
                        T+{fmtSeconds(elapsed)}
                      </span>
                    )}
                  </div>

                  {alert && (
                    <div style={{ fontSize: 10, color: '#FF5A5A', fontWeight: 700, marginTop: 8 }}>
                      ⚠ {alertLabel(alert.alert_type)}
                    </div>
                  )}

                  {/* Quick Actions */}
                  {alert && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      {alert.status === 'ACTIVE' && (
                        <ActionBtn $color="#fbbf24" onClick={e => { e.stopPropagation(); doctorAck(alert.id); }}>
                          🩺 ACK
                        </ActionBtn>
                      )}
                      {['ACTIVE','DOCTOR_NOTIFIED'].includes(alert.status) && (
                        <ActionBtn $color="#818cf8" onClick={e => { e.stopPropagation(); dispatchAmbulance(alert.id); }}>
                          🚑 DISPATCH
                        </ActionBtn>
                      )}
                      {alert.status === 'AMBULANCE_DISPATCHED' && (
                        <ActionBtn $color="#34d399" onClick={e => { e.stopPropagation(); markArrived(alert.id); }}>
                          ✅ ARRIVED
                        </ActionBtn>
                      )}
                      {alert.status === 'ARRIVED' && (
                        <ActionBtn $color="#52d1a3" onClick={e => { e.stopPropagation(); resolveAlert(alert.id); }}>
                          RESOLVE
                        </ActionBtn>
                      )}
                    </div>
                  )}
                </BedCard>
              );
            })}
          </BedGrid>

          {/* SELECTED ALERT DETAIL */}
          {selectedAlert && (
            <div style={{ marginTop: 24, background: 'rgba(40,8,8,0.7)', border: '1px solid rgba(255,50,50,0.3)', borderRadius: 18, padding: 24, animation: `${slideDown} 0.3s ease` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#FF3232', letterSpacing: 2, fontWeight: 800, marginBottom: 4 }}>🚨 ACTIVE EMERGENCY — ALERT #{selectedAlert.id}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{selectedAlert.patient_name}</div>
                  <div style={{ fontSize: 13, color: '#FF5A5A', marginTop: 4 }}>{alertLabel(selectedAlert.alert_type)} · {selectedAlert.bed_number}</div>
                </div>
                <button onClick={() => setSelectedAlert(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>✕ Close</button>
              </div>

              {/* Vitals snapshot */}
              <WristbandRow>
                <WristPill $alert={!!selectedAlert.heart_rate && (selectedAlert.heart_rate < 50 || selectedAlert.heart_rate > 130)}>
                  <div className="wp-val">{selectedAlert.heart_rate || '--'}</div>
                  <div className="wp-unit">bpm</div>
                  <div className="wp-lbl">PULSE</div>
                </WristPill>
                <WristPill $alert={!!selectedAlert.spo2 && selectedAlert.spo2 < 92}>
                  <div className="wp-val">{selectedAlert.spo2 || '--'}</div>
                  <div className="wp-unit">%</div>
                  <div className="wp-lbl">SpO2</div>
                </WristPill>
                <WristPill $alert={!!selectedAlert.blood_pressure}>
                  <div className="wp-val">{selectedAlert.blood_pressure || '--'}</div>
                  <div className="wp-unit">mmHg</div>
                  <div className="wp-lbl">BP</div>
                </WristPill>
                <WristPill $alert={!!selectedAlert.temperature && (selectedAlert.temperature > 39.5 || selectedAlert.temperature < 35)}>
                  <div className="wp-val">{selectedAlert.temperature || '--'}</div>
                  <div className="wp-unit">°C</div>
                  <div className="wp-lbl">TEMP</div>
                </WristPill>
              </WristbandRow>

              {/* SLA Timeline */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, fontWeight: 800, marginBottom: 14 }}>RESPONSE SLA TIMELINE</div>
                <Timeline>
                  <TLStep $done={true} $breach={false}>
                    <div className="tl-dot">🔴</div>
                    <div className="tl-info">
                      <div className="tl-label">Alert Triggered</div>
                      <div className="tl-time">{new Date(selectedAlert.triggered_at).toLocaleTimeString()}</div>
                      <div className="tl-sla">Wristband auto-detected</div>
                    </div>
                  </TLStep>

                  <TLStep $done={!!selectedAlert.doctor_notified_at} $breach={selectedAlert.doctor_sla === 'BREACH'}>
                    <div className="tl-dot">{selectedAlert.doctor_notified_at ? '🩺' : '⏳'}</div>
                    <div className="tl-info">
                      <div className="tl-label">Doctor Acknowledged</div>
                      <div className="tl-time">{selectedAlert.doctor_notified_at ? fmtSeconds(selectedAlert.doctor_response_seconds) : `SLA: 60s`}</div>
                      <div className="tl-sla">{selectedAlert.doctor_sla === 'BREACH' ? '⚠ SLA BREACHED' : selectedAlert.doctor_sla === 'COMPLIANT' ? '✓ Within SLA' : 'Awaiting...'}</div>
                      <SLAMeter $pct={selectedAlert.doctor_response_seconds ? (selectedAlert.doctor_response_seconds / 60) * 100 : (elapsedMap[selectedAlert.id] || 0) / 60 * 100} $breach={selectedAlert.doctor_sla === 'BREACH'} />
                    </div>
                  </TLStep>

                  <TLStep $done={!!selectedAlert.ambulance_dispatched_at} $breach={selectedAlert.ambulance_sla === 'BREACH'}>
                    <div className="tl-dot">{selectedAlert.ambulance_dispatched_at ? '🚑' : '⏳'}</div>
                    <div className="tl-info">
                      <div className="tl-label">Ambulance Dispatched</div>
                      <div className="tl-time">{selectedAlert.ambulance_dispatched_at ? fmtSeconds(selectedAlert.ambulance_response_seconds) : 'SLA: 3 min'}</div>
                      <div className="tl-sla">{selectedAlert.ambulance_sla === 'BREACH' ? '⚠ SLA BREACHED' : selectedAlert.ambulance_sla === 'COMPLIANT' ? '✓ Within SLA' : 'Awaiting dispatch...'}</div>
                      <SLAMeter $pct={selectedAlert.ambulance_response_seconds ? (selectedAlert.ambulance_response_seconds / 180) * 100 : 0} $breach={selectedAlert.ambulance_sla === 'BREACH'} />
                    </div>
                  </TLStep>

                  <TLStep $done={!!selectedAlert.service_arrived_at} $breach={selectedAlert.arrival_sla === 'BREACH'}>
                    <div className="tl-dot">{selectedAlert.service_arrived_at ? '✅' : '⏳'}</div>
                    <div className="tl-info">
                      <div className="tl-label">Team Arrived at Patient</div>
                      <div className="tl-time">{selectedAlert.service_arrived_at ? fmtSeconds(selectedAlert.total_response_seconds) : 'SLA: 10 min'}</div>
                      <div className="tl-sla">{selectedAlert.arrival_sla === 'BREACH' ? '⚠ SLA BREACHED' : selectedAlert.arrival_sla === 'COMPLIANT' ? '✓ Within SLA' : 'En route...'}</div>
                      <SLAMeter $pct={selectedAlert.total_response_seconds ? (selectedAlert.total_response_seconds / 600) * 100 : 0} $breach={selectedAlert.arrival_sla === 'BREACH'} />
                    </div>
                  </TLStep>
                </Timeline>
              </div>
            </div>
          )}
        </GridPanel>

        {/* SIDE PANEL */}
        <SidePanel>

          {/* WRISTBAND SIMULATOR */}
          <SideSection>
            <SideTitle>🧪 Wristband Test Simulator</SideTitle>
            <SimCard>
              <div className="sim-title">Simulate Critical Vitals</div>
              <div className="sim-desc">Select a bed and inject out-of-threshold vitals to test the full emergency chain — alert → doctor → ambulance → SLA tracking.</div>

              <select value={simBed} onChange={e => setSimBed(e.target.value)}>
                {DEFAULT_BEDS.filter(b => b.occupied).map(b => (
                  <option key={b.bed} value={b.bed}>{b.bed} — {b.patient}</option>
                ))}
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4, letterSpacing: 1 }}>HEART RATE (bpm)</div>
                  <input type="number" value={simHR} onChange={e => setSimHR(e.target.value)} placeholder="e.g. 35 (critical)" />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4, letterSpacing: 1 }}>SpO2 (%)</div>
                  <input type="number" value={simSPO2} onChange={e => setSimSPO2(e.target.value)} placeholder="e.g. 88 (critical)" />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4, letterSpacing: 1 }}>BLOOD PRESSURE</div>
                  <input type="text" value={simBP} onChange={e => setSimBP(e.target.value)} placeholder="e.g. 70/45 (critical)" />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4, letterSpacing: 1 }}>TEMPERATURE (°C)</div>
                  <input type="number" step="0.1" value={simTemp} onChange={e => setSimTemp(e.target.value)} placeholder="e.g. 40.2 (critical)" />
                </div>
              </div>

              <TriggerBtn onClick={simulateTrigger}>🚨 TRIGGER EMERGENCY ALERT</TriggerBtn>
            </SimCard>
          </SideSection>

          {/* SLA KEY */}
          <SideSection>
            <SideTitle>⏱ SLA Response Standards</SideTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Doctor Acknowledgement', sla: '≤ 60 seconds', color: '#fbbf24' },
                { label: 'Ambulance Dispatched', sla: '≤ 3 minutes', color: '#818cf8' },
                { label: 'Medical Team Arrival', sla: '≤ 10 minutes', color: '#34d399' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{s.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: s.color, fontFamily: "'Share Tech Mono', monospace" }}>{s.sla}</span>
                </div>
              ))}
            </div>
          </SideSection>

          {/* RECENT HISTORY */}
          <SideSection style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <SideTitle>📋 Recent Alert History</SideTitle>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {history.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingTop: 20 }}>No alerts recorded yet.</div>
              ) : history.map((a, i) => (
                <HistoryItem key={i}>
                  <div className="h-top">
                    <span className="h-name">{a.patient_name} · {a.bed_number}</span>
                    <StatusPill $status={a.status}>{a.status}</StatusPill>
                  </div>
                  <div className="h-detail">
                    {alertLabel(a.alert_type)} ·
                    {a.doctor_response_seconds ? ` Doc: ${fmtSeconds(a.doctor_response_seconds)}` : ''} 
                    {a.total_response_seconds ? ` · Total: ${fmtSeconds(a.total_response_seconds)}` : ''}
                  </div>
                  <div className="h-time">{a.triggered_at ? new Date(a.triggered_at).toLocaleString() : ''}</div>
                </HistoryItem>
              ))}
            </div>
          </SideSection>
        </SidePanel>
      </MainLayout>
    </Shell>
  );
}
