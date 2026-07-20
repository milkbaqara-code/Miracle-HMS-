// web/app/dashboard/issue-tickets/page.tsx
'use client';
import { useCurrencyLang } from '../../components/CurrencyLangContext';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobalSync } from '../../context/GlobalSyncContext';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useToast } from '../../components/SovereignToast';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');
const WS_BASE = API_BASE.replace(/^https?/, (m) => m === 'https' ? 'wss' : 'ws').replace('/api', '');

interface OnDutyStaff {
  id: string;
  name: string;
  dept: string;
  position: string;
  shift_minutes: number;
  avatar: string;
  username: string | null;
}

export default function IssueServiceTickets() {
  const isViewMode = useViewMode();
  const { formatMoney, t } = useCurrencyLang();
  const router = useRouter();
  const { triggerGlobalSync } = useGlobalSync();
  const { showToast } = useToast();

  // 1. MISSION FORM STATE
  const [targetRoom, setTargetRoom] = useState('101');
  const [deptChoice, setDeptChoice] = useState('HK');
  const [objective, setObjective] = useState('');
  const [priority, setPriority] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [isDeptLocked, setIsDeptLocked] = useState(false);

  // 2. OPERATIVE ASSIGNMENT STATE
  const [onDutyStaff, setOnDutyStaff] = useState<OnDutyStaff[]>([]);
  const [selectedOperative, setSelectedOperative] = useState<OnDutyStaff | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(true);

  // 🛡️ LIVE ROOMS FROM ASSET GRID (Z16 fix — no more hardcoded 101-130)
  const [assetRooms, setAssetRooms] = useState<{room_id: string; category: string; status: string}[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // 3. URL PARAMS BOOT
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qsRoom = params.get('room');
    const qsDept = params.get('dept');
    if (qsRoom) { setTargetRoom(qsRoom); setIsRoomLocked(true); }
    else {
      const savedTarget = localStorage.getItem('miracle_target_room');
      if (savedTarget) { setTargetRoom(savedTarget); localStorage.removeItem('miracle_target_room'); }
    }
    if (qsDept) { setDeptChoice(qsDept.toUpperCase()); setIsDeptLocked(true); }
  }, []);

  // 4. FETCH ALL ON-DUTY STAFF (Live from HR Ledger)
  const fetchOnDutyStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const res = await fetch(`${API_BASE}/hr/on-duty-staff`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'SUCCESS') setOnDutyStaff(data.staff);
      }
    } catch (e) {
      console.warn("Could not fetch on-duty staff:", e);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    fetchOnDutyStaff();
    // Refresh every 30s to keep list live
    const interval = setInterval(fetchOnDutyStaff, 30000);
    return () => clearInterval(interval);
  }, [fetchOnDutyStaff]);

  // 🛡️ FETCH LIVE ROOMS FROM ASSET GRID
  const fetchAssetRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/solve/rooms`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'SUCCESS' && data.rooms?.length > 0) {
          setAssetRooms(data.rooms);
          // Set default to first room if current targetRoom not in list
          setTargetRoom(prev => {
            const ids = data.rooms.map((r: any) => r.room_id);
            return ids.includes(prev) ? prev : data.rooms[0].room_id;
          });
        }
      }
    } catch (e) {
      console.warn('Could not fetch asset rooms:', e);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssetRooms();
  }, [fetchAssetRooms]);

  // Filter for selected dept
  const deptStaff = onDutyStaff.filter(s => s.dept === deptChoice);
  const allDeptStaff = onDutyStaff; // for showing all

  const POLICY_SOP: Record<string, string[]> = {
    HK: ['Sanitize Remote', 'Verify Mini-Bar Seal', 'Linen Geometric Alignment'],
    MN: ['Power Isolation Check', 'HVAC Pressure Test', 'Leakage Verification'],
    RS: ['Temperature Audit', 'Cutlery Polish Check', 'Guest ID Verification'],
    IT: ['Biometric Sync', 'Kernel Cache Purge'],
    FD: ['Guest Verification', 'Rate Confirmation', 'Key Card Issue'],
    ACC: ['Ledger Entry Verification', 'Receipt Print'],
    MARKETING: ['Campaign Status Check', 'Offer Confirmation'],
    MN2: ['Equipment Inspection', 'Safety Audit'],
    SPA: ['Treatment Room Prep', 'Equipment Sterilization', 'Guest Consent Verification'],
    FLT: ['Vehicle Inspection', 'Fuel Level Check', 'Driver Briefing'],
    BTQ: ['Display Check', 'Inventory Count', 'POS Terminal Test'],
  };
  const currentSop = POLICY_SOP[deptChoice] || ['Standard Procedures'];

  // 5. TRANSMISSION ENGINE
  const transmitCommand = async () => {
    if (!objective) {
      showToast('AUDIT BLOCK', 'warning', 'Define Operational Objective.');
      return;
    }
    setIsTransmitting(true);

    const assignedName = selectedOperative ? selectedOperative.name : 'Unassigned';
    const assignedUsername = selectedOperative ? (selectedOperative.username || selectedOperative.name) : 'Unassigned';

    const missionID = Math.floor(Math.random() * 90000) + 10000;
    const localMissionRecord = {
      id: missionID,
      room: targetRoom,
      dept: deptChoice,
      subject: objective.toUpperCase(),
      status: 'Active',
      assigned_to: assignedName,
      priority: priority ? 'CRITICAL' : 'NORMAL',
      checks: currentSop,
      raised_at: new Date().toISOString(),
      picked_up_at: selectedOperative ? new Date().toISOString() : null,
      secured_at: null,
      issued_by: localStorage.getItem('miracle_user') || 'SYSTEM'
    };

    // API PAYLOAD — includes assigned_operative for direct routing
    const apiPayload = {
      room: targetRoom,
      dept: deptChoice,
      subject: objective.toUpperCase(),
      priority: priority ? 'CRITICAL' : 'NORMAL',
      checks: currentSop,
      assigned_to: assignedUsername,
    };

    try {
      const res = await fetch(`${API_BASE}/solve/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
      });
      if (!res.ok) throw new Error("Backend Uplink Failed");

      const existingMissions = JSON.parse(localStorage.getItem('miracle_missions') || '[]');
      existingMissions.push(localMissionRecord);
      localStorage.setItem('miracle_missions', JSON.stringify(existingMissions));
    } catch (e) {
      console.warn("API Down, pushing to local ledger only.");
      const existingMissions = JSON.parse(localStorage.getItem('miracle_missions') || '[]');
      existingMissions.push(localMissionRecord);
      localStorage.setItem('miracle_missions', JSON.stringify(existingMissions));
    }

    localStorage.setItem('miracle_active_pulse', JSON.stringify({
      room: targetRoom,
      type: priority ? 'EMERGENCY' : 'SERVICE'
    }));

    triggerGlobalSync();

    setTimeout(() => {
      try {
        const ws = new WebSocket(`${WS_BASE}/ws/grid-sync`);
        ws.onopen = () => {
          ws.send(JSON.stringify({ event: 'GRID_UPDATE', data: { action: 'MANUAL_SYNC' } }));
          setTimeout(() => ws.close(), 100);
        };
      } catch (e) {}

      const routingMsg = selectedOperative
        ? `✅ MISSION ASSIGNED DIRECTLY TO: ${selectedOperative.name}\n\nThis ticket will appear in their MY TASKS.`
        : `✅ MISSION BROADCAST TO RADAR\n\nAll ON-DUTY ${deptChoice} staff will see this mission.`;

      showToast('MISSION SECURED', 'success', routingMsg);
      setIsTransmitting(false);
      setSelectedOperative(null);
      setObjective('');
      router.push('/dashboard');
    }, 800);
  };

  const formatShiftTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  return (
    <div style={{ padding: '20px', background: 'transparent', minHeight: '100vh', color: '#FFF' }} className={isViewMode ? "zone-view-mode" : ""}>
      <ViewModeBanner />

      {/* HUD HEADER */}
      <div style={headerFrame}>
        <div>
          <h1 style={titleStyle}>🛰️ SERVICE DISPATCH CENTER</h1>
          <p style={subTitleStyle}>ZONE 16 | HR TELEMETRY & SOP SYNC ACTIVE | v8.0</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#666', fontWeight: 900 }}>ON-DUTY OPERATIVES</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#00FF88' }}>{onDutyStaff.length}</div>
          </div>
          <button onClick={fetchOnDutyStaff} style={refreshBtn}>🔄 SYNC</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px' }}>

        {/* LEFT: MISSION CREATOR */}
        <div style={panelBox(priority ? '#FF3131' : '#D4AF37')}>
          <h4 style={panelTitle}>⚡ NEW SERVICE COMMAND</h4>

          {/* Selected Operative Banner */}
          {selectedOperative && (
            <div style={assignedBanner}>
              <div>
                <div style={{ fontSize: '9px', color: '#D4AF37', fontWeight: 900, letterSpacing: '1px' }}>ASSIGNED OPERATIVE</div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#FFF' }}>{selectedOperative.name}</div>
                <div style={{ fontSize: '9px', color: '#00F2FF' }}>{selectedOperative.dept} · {selectedOperative.position}</div>
              </div>
              <button onClick={() => setSelectedOperative(null)} style={clearAssignBtn}>✕ CLEAR</button>
            </div>
          )}

          {!selectedOperative && (
            <div style={radarHintBanner}>
              <span style={{ fontSize: '11px' }}>📡</span>
              <span style={{ fontSize: '9px', color: '#888' }}>No operative selected — ticket will broadcast to <strong style={{ color: '#00F2FF' }}>RADAR</strong> (all dept staff can pickup)</span>
            </div>
          )}

          <div style={grid2}>
            <div>
              <label style={labelStyle}>TARGET ASSET / ROOM</label>
              <select
                style={{ ...inputStyle, opacity: isRoomLocked ? 0.6 : 1 }}
                value={targetRoom}
                onChange={e => setTargetRoom(e.target.value)}
                disabled={isRoomLocked || roomsLoading}
              >
                {roomsLoading && <option value="">⏳ Loading rooms...</option>}
                {!roomsLoading && assetRooms.length === 0 && (
                  <option value={targetRoom}>{targetRoom} (manual)</option>
                )}
                {assetRooms.map(r => (
                  <option key={r.room_id} value={r.room_id}>
                    {r.room_id} — {r.category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>DEPARTMENT VECTOR</label>
              <select
                style={{ ...inputStyle, opacity: isDeptLocked ? 0.6 : 1 }}
                value={deptChoice}
                onChange={e => { setDeptChoice(e.target.value); setSelectedOperative(null); }}
                disabled={isDeptLocked}
              >
                <option value="HK">HOUSEKEEPING (HK)</option>
                <option value="MN">MAINTENANCE (MN)</option>
                <option value="RS">ROOM SERVICE (RS)</option>
                <option value="IT">IT & INFRASTRUCTURE (IT)</option>
                <option value="FD">FRONT DESK (FD)</option>
                <option value="ACC">ACCOUNTS (ACC)</option>
                <option value="SPA">MED-SPA & WELLNESS (SPA)</option>
                <option value="FLT">FLEET & AVIATION (FLT)</option>
                <option value="BTQ">LUXURY BOUTIQUES (BTQ)</option>
              </select>
            </div>
          </div>

          <label style={labelStyle}>OPERATIONAL OBJECTIVE</label>
          <input
            style={inputStyle}
            value={objective}
            onChange={e => setObjective(e.target.value)}
            placeholder="e.g. AC Repair, Sanitization"
          />

          <div style={sopPreview}>
            <small style={{ color: '#D4AF37', fontSize: '8px', fontWeight: 900 }}>ATTACHED SOP PROTOCOL:</small>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              {currentSop.map(task => <span key={task} style={sopBadge}>{task}</span>)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
            <input type="checkbox" checked={priority} onChange={e => setPriority(e.target.checked)} style={{ cursor: 'pointer' }} />
            <label style={{ fontSize: '11px', color: priority ? '#FF3131' : '#666', fontWeight: 900 }}>MARK AS CRITICAL PRIORITY</label>
          </div>

          <button
            onClick={transmitCommand}
            disabled={isTransmitting || !objective}
            style={actionBtn(selectedOperative ? '#D4AF37' : (priority ? '#FF3131' : '#00F2FF'), isTransmitting)}
          >
            {isTransmitting ? '⏳ TRANSMITTING...' :
              selectedOperative ? `⚡ ASSIGN TO ${selectedOperative.name.split(' ')[0].toUpperCase()}` :
              '📡 BROADCAST TO RADAR'}
          </button>
        </div>

        {/* RIGHT: OPERATIVE REAL-TIME LOAD */}
        <div style={panelBox('#00F2FF')}>
          <h4 style={{ ...panelTitle, color: '#00F2FF' }}>
            👥 OPERATIVE REAL-TIME LOAD
          </h4>
          <div style={{ fontSize: '9px', color: '#555', marginBottom: '15px', fontWeight: 900 }}>
            TAP AN OPERATIVE TO ASSIGN THE MISSION DIRECTLY
          </div>

          {loadingStaff && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#444' }}>
              <div style={{ fontSize: '20px', marginBottom: '10px' }}>📡</div>
              <div style={{ fontSize: '10px' }}>SCANNING HR LEDGER...</div>
            </div>
          )}

          {!loadingStaff && onDutyStaff.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#444', border: '1px dashed #222', borderRadius: '12px' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔴</div>
              <div style={{ fontSize: '10px', fontWeight: 900 }}>NO OPERATIVES ON-DUTY</div>
              <div style={{ fontSize: '8px', color: '#333', marginTop: '5px' }}>Staff must START DUTY in their My Profile to appear here</div>
            </div>
          )}

          {/* Dept-matched staff FIRST */}
          {deptStaff.length > 0 && (
            <>
              <div style={{ fontSize: '8px', color: '#D4AF37', fontWeight: 900, marginBottom: '8px', letterSpacing: '1px' }}>
                {deptChoice} DEPARTMENT ({deptStaff.length} ACTIVE)
              </div>
              {deptStaff.map(s => (
                <StaffCard
                  key={s.id}
                  staff={s}
                  selected={selectedOperative?.id === s.id}
                  onSelect={() => setSelectedOperative(prev => prev?.id === s.id ? null : s)}
                  formatShiftTime={formatShiftTime}
                  highlighted={true}
                />
              ))}
            </>
          )}

          {/* Other dept staff */}
          {onDutyStaff.filter(s => s.dept !== deptChoice).length > 0 && (
            <>
              <div style={{ fontSize: '8px', color: '#666', fontWeight: 900, margin: '15px 0 8px 0', letterSpacing: '1px', borderTop: '1px solid #111', paddingTop: '15px' }}>
                OTHER DEPARTMENTS
              </div>
              {onDutyStaff.filter(s => s.dept !== deptChoice).map(s => (
                <StaffCard
                  key={s.id}
                  staff={s}
                  selected={selectedOperative?.id === s.id}
                  onSelect={() => setSelectedOperative(prev => prev?.id === s.id ? null : s)}
                  formatShiftTime={formatShiftTime}
                  highlighted={false}
                />
              ))}
            </>
          )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media(max-width: 768px) {
          .dispatch-grid { grid-template-columns: 1fr !important; }
        }
        .staff-card-hover:hover { background: rgba(0,242,255,0.08) !important; transform: translateX(3px); }
      `}} />
    </div>
  );
}

// Staff Card Sub-Component
function StaffCard({ staff, selected, onSelect, formatShiftTime, highlighted }: {
  staff: OnDutyStaff;
  selected: boolean;
  onSelect: () => void;
  formatShiftTime: (m: number) => string;
  highlighted: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className="staff-card-hover"
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 15px', background: selected ? 'rgba(0,242,255,0.12)' : 'rgba(0,0,0,0.4)',
        borderRadius: '12px', marginBottom: '8px', cursor: 'pointer',
        border: selected ? '1px solid #00F2FF' : `1px solid ${highlighted ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)'}`,
        transition: 'all 0.2s ease',
        boxShadow: selected ? '0 0 12px rgba(0,242,255,0.2)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: highlighted ? 'rgba(212,175,55,0.2)' : 'rgba(0,242,255,0.1)',
          border: `1px solid ${highlighted ? '#D4AF37' : '#00F2FF'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 900, color: highlighted ? '#D4AF37' : '#00F2FF',
          flexShrink: 0,
        }}>
          {staff.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 900, color: '#FFF' }}>{staff.name}</div>
          <div style={{ fontSize: '8px', color: '#888' }}>{staff.dept} · {staff.position || 'Operative'}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '8px', color: '#00FF88', fontWeight: 900 }}>● ON-DUTY</div>
        <div style={{ fontSize: '8px', color: '#555' }}>{formatShiftTime(staff.shift_minutes)}</div>
        {selected && <div style={{ fontSize: '8px', color: '#00F2FF', fontWeight: 900, marginTop: '2px' }}>✓ SELECTED</div>}
      </div>
    </div>
  );
}

// --- SOVEREIGN STYLES ---
const headerFrame: React.CSSProperties = { marginBottom: '30px', borderBottom: '1px solid #1a1a1a', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const titleStyle: React.CSSProperties = { fontFamily: 'Cinzel', color: '#D4AF37', fontSize: 'clamp(20px, 4vw, 32px)', margin: 0, letterSpacing: '3px' };
const subTitleStyle: React.CSSProperties = { color: '#00F2FF', fontSize: '10px', fontWeight: 900, letterSpacing: '2px', marginTop: '5px' };
const refreshBtn: React.CSSProperties = { padding: '8px 14px', background: 'rgba(0,242,255,0.1)', color: '#00F2FF', border: '1px solid #00F2FF', borderRadius: '8px', cursor: 'pointer', fontSize: '10px', fontWeight: 900 };
const panelBox = (c: string): React.CSSProperties => ({ background: 'rgba(15,15,15,0.8)', backdropFilter: 'blur(10px)', padding: '30px', borderRadius: '20px', border: `1px solid ${c}22`, borderTop: `1px solid ${c}44` });
const panelTitle: React.CSSProperties = { color: '#D4AF37', fontFamily: 'Cinzel', marginBottom: '20px', fontSize: '13px', letterSpacing: '2px' };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '9px', fontWeight: 900, color: '#555', marginBottom: '8px', letterSpacing: '1px' };
const inputStyle: React.CSSProperties = { width: '100%', background: '#000', border: '1px solid #222', padding: '14px', borderRadius: '10px', color: '#FFF', outline: 'none', boxSizing: 'border-box' };
const sopPreview: React.CSSProperties = { background: 'rgba(0,0,0,0.5)', padding: '15px', borderRadius: '12px', border: '1px solid #111', marginTop: '15px' };
const sopBadge: React.CSSProperties = { fontSize: '8px', background: '#1a1a1a', padding: '4px 8px', borderRadius: '4px', color: '#888' };
const actionBtn = (c: string, disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '18px', background: disabled ? '#222' : (c === '#D4AF37' ? 'linear-gradient(90deg, rgba(212,175,55,0.2), rgba(212,175,55,0.1))' : 'transparent'),
  color: disabled ? '#444' : c, fontWeight: 900, borderRadius: '12px',
  border: `1px solid ${disabled ? '#333' : c}`, cursor: disabled ? 'not-allowed' : 'pointer',
  marginTop: '25px', letterSpacing: '1px', fontSize: '12px', transition: '0.3s',
  boxShadow: disabled ? 'none' : `0 0 15px ${c}33`,
});
const assignedBanner: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'rgba(212,175,55,0.1)', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.3)', marginBottom: '15px' };
const radarHintBanner: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 15px', background: 'rgba(0,242,255,0.05)', borderRadius: '10px', border: '1px solid rgba(0,242,255,0.1)', marginBottom: '15px' };
const clearAssignBtn: React.CSSProperties = { padding: '6px 12px', background: 'rgba(255,49,49,0.1)', color: '#FF3131', border: '1px solid #FF3131', borderRadius: '8px', cursor: 'pointer', fontSize: '9px', fontWeight: 900 };
