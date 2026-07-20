'use client';
import React, { useState, useEffect, useCallback } from 'react';
import ViewModeBanner from '../../components/ViewModeBanner';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface BedSlot {
  bed_id: string;
  dept: string;
  floor: string;
  bed_type: 'ICU' | 'CABIN' | 'WARD' | 'EMR' | 'OT' | 'ISOLATION';
  status: 'OCCUPIED' | 'AVAILABLE' | 'MAINTENANCE';
  patient_name?: string;
  patient_id?: string;
  folio_id?: number;
  check_in?: string;
  assigned_doctor?: string;
}

interface Patient {
  id: number;
  full_name: string;
  insurance_provider?: string;
}

interface OccupancyRecord {
  room_number: string;
  guest_crm_id: number;
  folio_id: number;
  check_in_timestamp: string;
}

// ─── STATIC BED MASTER (synced with DB room layout) ─────────────────────────

const BED_MASTER: Omit<BedSlot, 'status' | 'patient_name' | 'patient_id' | 'folio_id' | 'check_in'>[] = [
  // ICU
  { bed_id: 'ICU-01', dept: 'ICU', floor: 'F2', bed_type: 'ICU' },
  { bed_id: 'ICU-02', dept: 'ICU', floor: 'F2', bed_type: 'ICU' },
  { bed_id: 'ICU-03', dept: 'ICU', floor: 'F2', bed_type: 'ICU' },
  { bed_id: 'ICU-04', dept: 'ICU', floor: 'F2', bed_type: 'ICU' },
  // EMERGENCY
  { bed_id: 'EMR-01', dept: 'EMR', floor: 'F1', bed_type: 'EMR' },
  { bed_id: 'EMR-02', dept: 'EMR', floor: 'F1', bed_type: 'EMR' },
  { bed_id: 'EMR-03', dept: 'EMR', floor: 'F1', bed_type: 'EMR' },
  // GENERAL WARD
  { bed_id: 'WARD-01', dept: 'WARD', floor: 'F3', bed_type: 'WARD' },
  { bed_id: 'WARD-02', dept: 'WARD', floor: 'F3', bed_type: 'WARD' },
  { bed_id: 'WARD-03', dept: 'WARD', floor: 'F3', bed_type: 'WARD' },
  { bed_id: 'WARD-04', dept: 'WARD', floor: 'F3', bed_type: 'WARD' },
  { bed_id: 'WARD-05', dept: 'WARD', floor: 'F3', bed_type: 'WARD' },
  { bed_id: 'WARD-06', dept: 'WARD', floor: 'F3', bed_type: 'WARD' },
  // PRIVATE CABINS
  { bed_id: 'CABIN-01', dept: 'VIP', floor: 'F4', bed_type: 'CABIN' },
  { bed_id: 'CABIN-02', dept: 'VIP', floor: 'F4', bed_type: 'CABIN' },
  { bed_id: 'CABIN-03', dept: 'VIP', floor: 'F4', bed_type: 'CABIN' },
  // ISOLATION
  { bed_id: 'ISO-01', dept: 'ISO', floor: 'F2', bed_type: 'ISOLATION' },
  { bed_id: 'ISO-02', dept: 'ISO', floor: 'F2', bed_type: 'ISOLATION' },
  // OT / RECOVERY
  { bed_id: 'OT-REC-01', dept: 'OT', floor: 'F3', bed_type: 'OT' },
  { bed_id: 'OT-REC-02', dept: 'OT', floor: 'F3', bed_type: 'OT' },
];

const BED_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  ICU:       { bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.35)',    glow: 'rgba(239,68,68,0.2)' },
  EMR:       { bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.35)',   glow: 'rgba(245,158,11,0.2)' },
  WARD:      { bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.35)',   glow: 'rgba(59,130,246,0.2)' },
  CABIN:     { bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.35)',   glow: 'rgba(16,185,129,0.2)' },
  ISOLATION: { bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.35)',   glow: 'rgba(139,92,246,0.2)' },
  OT:        { bg: 'rgba(20,184,166,0.08)',   border: 'rgba(20,184,166,0.35)',   glow: 'rgba(20,184,166,0.2)' },
};

// ─── STYLES ──────────────────────────────────────────────────────────────────

const S = {
  page: { padding: '28px', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", background: 'transparent', minHeight: '100vh' } as React.CSSProperties,
  heading: { fontSize: '22px', fontWeight: 900, color: '#10b981', textShadow: '0 0 20px rgba(16,185,129,0.4)', letterSpacing: '0.04em', margin: 0 } as React.CSSProperties,
  subheading: { fontSize: '11px', color: '#4b5563', letterSpacing: '0.12em', marginTop: '4px', textTransform: 'uppercase' as const },
  tabBar: { display: 'flex', gap: '6px', margin: '22px 0 20px', flexWrap: 'wrap' as const },
  tab: (a: boolean): React.CSSProperties => ({ padding: '8px 20px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', cursor: 'pointer', border: 'none', background: a ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.04)', color: a ? '#10b981' : '#555', boxShadow: a ? '0 0 16px rgba(16,185,129,0.25)' : 'none', transition: 'all 0.2s' }),
  glass: { background: 'rgba(8,14,36,0.6)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: '16px', padding: '22px', backdropFilter: 'blur(10px)' } as React.CSSProperties,
  label: { display: 'block', fontSize: '10px', color: '#6b7280', marginBottom: '5px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  inp: { width: '100%', background: 'rgba(2,6,20,0.7)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  secTitle: { color: '#10b981', fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid rgba(16,185,129,0.15)', textShadow: '0 0 10px rgba(16,185,129,0.3)' },
  btn: (c = '#10b981'): React.CSSProperties => ({ background: `rgba(${c==='#10b981'?'16,185,129':c==='#ef4444'?'239,68,68':c==='#6366f1'?'99,102,241':c==='#f59e0b'?'245,158,11':'20,184,166'},0.12)`, border: `1px solid ${c}`, color: c, borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '11px', cursor: 'pointer', letterSpacing: '0.07em', boxShadow: `0 0 14px ${c}22`, transition: 'all 0.2s' }),
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function ADTPage() {
  const [activeTab, setActiveTab] = useState<'BEDGRID' | 'ADMIT' | 'DISCHARGE' | 'TRANSFER' | 'OPD_BOOKING'>('BEDGRID');
  const [beds, setBeds] = useState<BedSlot[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedBed, setSelectedBed] = useState<BedSlot | null>(null);
  const [filterDept, setFilterDept] = useState('ALL');

  // Admit form
  const [admitPatientId, setAdmitPatientId] = useState('');
  const [admitBedId, setAdmitBedId] = useState('');
  const [admitDoctor, setAdmitDoctor] = useState('');
  const [admitRate, setAdmitRate] = useState('1500');
  const [admitAdvance, setAdmitAdvance] = useState('500');

  // Discharge form
  const [dischargeBedRef, setDischargeBedRef] = useState('');

  // Transfer form
  const [transferPatientRef, setTransferPatientRef] = useState('');
  const [transferToBed, setTransferToBed] = useState('');

  // Action log
  const [actionLog, setActionLog] = useState<string[]>([]);
  const log = (msg: string) => setActionLog(prev => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev.slice(0, 9)]);

  // OPD Booking form
  const [opdPatientId, setOpdPatientId] = useState('');
  const [opdDoctorId, setOpdDoctorId] = useState('');
  const [opdDate, setOpdDate] = useState(new Date().toISOString().split('T')[0]);
  const [opdTime, setOpdTime] = useState('10:00');
  const [opdNotes, setOpdNotes] = useState('');
  const [opdIsWalkIn, setOpdIsWalkIn] = useState(false);
  const [doctorsList, setDoctorsList] = useState<{id:string, name:string, spec:string}[]>([]);

  const API = '/api';

  useEffect(() => {
    fetch(`${API}/doctor/list`)
      .then(r => r.json())
      .then(j => setDoctorsList(j.data || []))
      .catch(() => {});
  }, []);

  // ── Load beds + occupancy ─────────────────────────────────────────────────
  const loadBeds = useCallback(async () => {
    try {
      const res = await fetch(`${API}/hms/beds`);
      const occupancyData: OccupancyRecord[] = res.ok ? (await res.json()).data || [] : [];

      const occupiedMap: Record<string, OccupancyRecord> = {};
      occupancyData.forEach((o: OccupancyRecord) => { occupiedMap[o.room_number] = o; });

      const grid: BedSlot[] = BED_MASTER.map(b => {
        const occ = occupiedMap[b.bed_id];
        return {
          ...b,
          status: occ ? 'OCCUPIED' : 'AVAILABLE',
          patient_name: occ ? `Patient #${occ.guest_crm_id}` : undefined,
          patient_id: occ ? String(occ.guest_crm_id) : undefined,
          folio_id: occ?.folio_id,
          check_in: occ?.check_in_timestamp,
        };
      });

      // Enrich with patient names
      const pMap: Record<string, string> = {};
      patients.forEach(p => { pMap[String(p.id)] = p.full_name; });
      grid.forEach(b => { if (b.patient_id && pMap[b.patient_id]) b.patient_name = pMap[b.patient_id]; });

      setBeds(grid);
    } catch {
      // Fallback: use static grid
      setBeds(BED_MASTER.map(b => ({ ...b, status: 'AVAILABLE' })));
    }
  }, [patients]);

  // ── Load patients ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/crm/guests?limit=100`)
      .then(r => r.json())
      .then(j => setPatients(Array.isArray(j) ? j : (j.data || [])))
      .catch(() => {});
  }, []);

  useEffect(() => { loadBeds(); }, [loadBeds]);

  // ── ADMIT patient ─────────────────────────────────────────────────────────
  const handleAdmit = async () => {
    if (!admitPatientId || !admitBedId) return alert('Select patient and bed.');
    setIsBusy(true);
    try {
      const res = await fetch(`${API}/hms/admit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: admitPatientId, bed_id: admitBedId, assigned_doctor: admitDoctor, rate: parseFloat(admitRate), advance_paid: parseFloat(admitAdvance) }),
      });
      const data = await res.json();
      if (res.ok) {
        log(`ADMIT: Patient ${admitPatientId} → Bed ${admitBedId}`);
        setAdmitPatientId(''); setAdmitBedId('');
        loadBeds();
      } else { alert(data.detail || 'Admission failed'); }
    } catch { alert('Network error'); }
    setIsBusy(false);
  };

  // ── DISCHARGE patient ─────────────────────────────────────────────────────
  const handleDischarge = async () => {
    if (!dischargeBedRef) return alert('Enter bed or folio reference.');
    setIsBusy(true);
    try {
      const res = await fetch(`${API}/hms/discharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bed_id: dischargeBedRef }),
      });
      const data = await res.json();
      if (res.ok) {
        log(`DISCHARGE: ${dischargeBedRef} → Bed cleared`);
        setDischargeBedRef('');
        loadBeds();
      } else { alert(data.detail || 'Discharge failed'); }
    } catch { alert('Network error'); }
    setIsBusy(false);
  };

  // ── TRANSFER patient ──────────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!transferPatientRef || !transferToBed) return;
    setIsBusy(true);
    try {
      const res = await fetch(`${API}/hms/adt/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: transferPatientRef, target_bed_id: transferToBed }),
      });
      const data = await res.json();
      if (res.ok) {
        log(`TRANSFER: Patient ${transferPatientRef} → Bed ${transferToBed}`);
        setTransferPatientRef(''); setTransferToBed('');
        loadBeds();
      } else { alert(data.detail || 'Transfer failed'); }
    } catch { alert('Network error'); }
    setIsBusy(false);
  };

  // ── OPD BOOKING ───────────────────────────────────────────────────────────
  const handleOpdBook = async () => {
    if (!opdPatientId || !opdDoctorId || !opdDate || !opdTime) return alert('Fill in all required fields.');
    setIsBusy(true);
    try {
      const res = await fetch(`${API}/hms/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          patient_id: opdPatientId, 
          doctor_id: opdDoctorId, 
          appointment_time: `${opdDate}T${opdTime}:00`,
          notes: opdNotes + (opdIsWalkIn ? " [WALK-IN]" : "")
        }),
      });
      const data = await res.json();
      if (res.ok) {
        log(`OPD BOOKED: Patient ${opdPatientId} with Doctor ${opdDoctorId} at ${opdTime}`);
        setOpdPatientId(''); setOpdNotes('');
      } else { alert(data.detail || 'Booking failed'); }
    } catch { alert('Network error'); }
    setIsBusy(false);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total = beds.length;
  const occupied = beds.filter(b => b.status === 'OCCUPIED').length;
  const available = beds.filter(b => b.status === 'AVAILABLE').length;
  const occupancyPct = total ? Math.round((occupied / total) * 100) : 0;

  const filteredBeds = filterDept === 'ALL' ? beds : beds.filter(b => b.bed_type === filterDept || b.dept === filterDept);
  const allDepts = ['ALL', ...Array.from(new Set(BED_MASTER.map(b => b.bed_type)))];
  const availableBeds = beds.filter(b => b.status === 'AVAILABLE');
  const occupiedBeds = beds.filter(b => b.status === 'OCCUPIED');

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <ViewModeBanner />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <div>
          <h1 style={S.heading}>🏥 CLINICAL ADT — BED ALLOCATION ENGINE</h1>
          <p style={S.subheading}>Admission · Discharge · Transfer · Real-Time Bed Grid</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { label: 'TOTAL BEDS', val: total, color: '#6b7280' },
            { label: 'OCCUPIED', val: occupied, color: '#ef4444' },
            { label: 'AVAILABLE', val: available, color: '#10b981' },
            { label: 'OCCUPANCY', val: `${occupancyPct}%`, color: '#f59e0b' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center', background: 'rgba(8,14,36,0.6)', border: `1px solid ${stat.color}33`, borderRadius: '10px', padding: '10px 16px', minWidth: '70px' }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: stat.color }}>{stat.val}</div>
              <div style={{ fontSize: '9px', color: '#4b5563', letterSpacing: '0.08em', marginTop: '2px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={S.tabBar}>
        {(['BEDGRID', 'ADMIT', 'DISCHARGE', 'TRANSFER', 'OPD_BOOKING'] as const).map(t => (
          <button key={t} style={S.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
            {t === 'BEDGRID' ? '🗺️ LIVE BED GRID' : t === 'ADMIT' ? '🛏️ ADMIT PATIENT' : t === 'DISCHARGE' ? '📤 DISCHARGE' : t === 'TRANSFER' ? '🔄 TRANSFER' : '🩺 OPD BOOKING'}
          </button>
        ))}
        <button style={{ ...S.btn('#6b7280'), marginLeft: 'auto', fontSize: '10px' }} onClick={loadBeds}>🔄 REFRESH</button>
      </div>

      {/* ─── TAB: LIVE BED GRID ─────────────────────────────────────────── */}
      {activeTab === 'BEDGRID' && (
        <div>
          {/* Dept filter pills */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {allDepts.map(d => (
              <button key={d} onClick={() => setFilterDept(d)} style={{
                padding: '5px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', border: 'none',
                background: filterDept === d ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
                color: filterDept === d ? '#10b981' : '#555',
                boxShadow: filterDept === d ? '0 0 10px rgba(16,185,129,0.2)' : 'none',
              }}>{d}</button>
            ))}
          </div>

          {/* Bed Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
            {filteredBeds.map(bed => {
              const col = BED_COLORS[bed.bed_type] || BED_COLORS.WARD;
              const isOccupied = bed.status === 'OCCUPIED';
              return (
                <div
                  key={bed.bed_id}
                  onClick={() => setSelectedBed(bed)}
                  style={{
                    borderRadius: '12px', padding: '14px', cursor: 'pointer',
                    background: isOccupied ? col.bg : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isOccupied ? col.border : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: isOccupied ? `0 0 18px ${col.glow}` : 'none',
                    transition: 'all 0.25s',
                    position: 'relative' as const,
                  }}
                >
                  {/* Pulse dot for occupied */}
                  {isOccupied && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', borderRadius: '50%', background: col.border, boxShadow: `0 0 8px ${col.glow}`, animation: 'pulse 2s infinite' }} />
                  )}
                  <div style={{ fontSize: '10px', color: isOccupied ? col.border : '#374151', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '6px' }}>{bed.bed_id}</div>
                  <div style={{ fontSize: '9px', color: '#4b5563', marginBottom: '8px' }}>{bed.bed_type} · {bed.floor}</div>
                  {isOccupied ? (
                    <>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bed.patient_name}</div>
                      {bed.check_in && <div style={{ fontSize: '9px', color: '#6b7280' }}>Since {new Date(bed.check_in).toLocaleDateString()}</div>}
                      <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                        <button onClick={e => { e.stopPropagation(); setActiveTab('TRANSFER'); setTransferPatientRef(bed.patient_id || ''); }} style={{ ...S.btn('#6366f1'), padding: '3px 8px', fontSize: '9px' }}>TRANSFER</button>
                        <button onClick={e => { e.stopPropagation(); setActiveTab('DISCHARGE'); setDischargeBedRef(bed.bed_id); }} style={{ ...S.btn('#ef4444'), padding: '3px 8px', fontSize: '9px' }}>DISCHARGE</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, marginBottom: '8px' }}>AVAILABLE</div>
                      <button onClick={e => { e.stopPropagation(); setActiveTab('ADMIT'); setAdmitBedId(bed.bed_id); }} style={{ ...S.btn('#10b981'), padding: '3px 10px', fontSize: '9px', width: '100%' }}>ADMIT</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bed Detail Panel */}
          {selectedBed && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedBed(null)}>
              <div style={{ background: '#08142a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '18px', padding: '28px', width: '360px', boxShadow: '0 0 40px rgba(16,185,129,0.15)' }} onClick={e => e.stopPropagation()}>
                <div style={{ color: '#10b981', fontWeight: 900, fontSize: '16px', marginBottom: '14px' }}>🛏 {selectedBed.bed_id}</div>
                {[
                  ['Type', selectedBed.bed_type],
                  ['Department', selectedBed.dept],
                  ['Floor', selectedBed.floor],
                  ['Status', selectedBed.status],
                  ...(selectedBed.status === 'OCCUPIED' ? [
                    ['Patient', selectedBed.patient_name || '—'],
                    ['Check-in', selectedBed.check_in ? new Date(selectedBed.check_in).toLocaleString() : '—'],
                    ['Folio ID', String(selectedBed.folio_id || '—')],
                  ] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
                    <span style={{ color: '#6b7280' }}>{k}</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                <button style={{ ...S.btn('#6b7280'), width: '100%', marginTop: '16px' }} onClick={() => setSelectedBed(null)}>CLOSE</button>
              </div>
            </div>
          )}

          {/* Action Log */}
          {actionLog.length > 0 && (
            <div style={{ marginTop: '20px', ...S.glass }}>
              <div style={S.secTitle}>ADT ACTION LOG</div>
              {actionLog.map((l, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#6b7280', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{l}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: ADMIT ─────────────────────────────────────────────────── */}
      {activeTab === 'ADMIT' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          <div style={S.glass}>
            <div style={S.secTitle}>🛏️ ADMIT PATIENT TO BED</div>

            <div style={{ marginBottom: '14px' }}>
              <div style={S.label}>Select Patient</div>
              <select style={S.inp} value={admitPatientId} onChange={e => setAdmitPatientId(e.target.value)}>
                <option value="">— Choose Patient —</option>
                {patients.map(p => <option key={p.id} value={String(p.id)}>{p.full_name} {p.insurance_provider ? `(${p.insurance_provider})` : ''}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={S.label}>Assign Bed</div>
              <select style={S.inp} value={admitBedId} onChange={e => setAdmitBedId(e.target.value)}>
                <option value="">— Select Available Bed —</option>
                {availableBeds.map(b => <option key={b.bed_id} value={b.bed_id}>{b.bed_id} ({b.bed_type} · {b.floor})</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={S.label}>Admitting Doctor (optional)</div>
              <input style={S.inp} type="text" placeholder="Doctor ID or name" value={admitDoctor} onChange={e => setAdmitDoctor(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div>
                <div style={S.label}>Daily Rate (AED)</div>
                <input style={S.inp} type="number" value={admitRate} onChange={e => setAdmitRate(e.target.value)} />
              </div>
              <div>
                <div style={S.label}>Advance Paid (AED)</div>
                <input style={S.inp} type="number" value={admitAdvance} onChange={e => setAdmitAdvance(e.target.value)} />
              </div>
            </div>

            <button style={{ ...S.btn('#10b981'), width: '100%', padding: '12px', fontSize: '12px' }} onClick={handleAdmit} disabled={isBusy || !admitPatientId || !admitBedId}>
              {isBusy ? '⏳ ADMITTING...' : '✅ CONFIRM ADMISSION'}
            </button>
          </div>

          {/* Right: Available Bed Preview */}
          <div style={S.glass}>
            <div style={S.secTitle}>AVAILABLE BEDS ({availableBeds.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '480px', overflowY: 'auto' }}>
              {availableBeds.map(b => {
                const col = BED_COLORS[b.bed_type];
                return (
                  <div key={b.bed_id} onClick={() => setAdmitBedId(b.bed_id)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', borderRadius: '10px', border: admitBedId === b.bed_id ? `1px solid ${col.border}` : '1px solid rgba(255,255,255,0.06)', background: admitBedId === b.bed_id ? col.bg : 'rgba(255,255,255,0.02)', cursor: 'pointer', boxShadow: admitBedId === b.bed_id ? `0 0 14px ${col.glow}` : 'none' }}>
                    <div style={{ fontSize: '18px' }}>🛏</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '13px', color: col.border }}>{b.bed_id}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>{b.bed_type} · {b.floor}</div>
                    </div>
                    {admitBedId === b.bed_id && <div style={{ marginLeft: 'auto', fontSize: '10px', color: '#10b981', fontWeight: 700 }}>SELECTED</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: DISCHARGE ─────────────────────────────────────────────── */}
      {activeTab === 'DISCHARGE' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          <div style={S.glass}>
            <div style={S.secTitle}>📤 DISCHARGE PATIENT</div>
            <div style={{ marginBottom: '14px' }}>
              <div style={S.label}>Bed ID (e.g. WARD-01)</div>
              <select style={S.inp} value={dischargeBedRef} onChange={e => setDischargeBedRef(e.target.value)}>
                <option value="">— Select Occupied Bed —</option>
                {occupiedBeds.map(b => <option key={b.bed_id} value={b.bed_id}>{b.bed_id} — {b.patient_name}</option>)}
              </select>
            </div>
            {dischargeBedRef && (() => {
              const bed = beds.find(b => b.bed_id === dischargeBedRef);
              return bed ? (
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
                  <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700, marginBottom: '8px' }}>PATIENT TO BE DISCHARGED</div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{bed.patient_name}</div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px' }}>Bed: {bed.bed_id} · Folio: #{bed.folio_id}</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Check-in: {bed.check_in ? new Date(bed.check_in).toLocaleString() : '—'}</div>
                </div>
              ) : null;
            })()}
            <button style={{ ...S.btn('#ef4444'), width: '100%', padding: '12px', fontSize: '12px' }} onClick={handleDischarge} disabled={isBusy || !dischargeBedRef}>
              {isBusy ? '⏳ PROCESSING...' : '📤 CONFIRM DISCHARGE & CLEAR BED'}
            </button>
          </div>

          <div style={S.glass}>
            <div style={S.secTitle}>CURRENTLY ADMITTED ({occupiedBeds.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '480px', overflowY: 'auto' }}>
              {occupiedBeds.map(b => {
                const col = BED_COLORS[b.bed_type];
                return (
                  <div key={b.bed_id} onClick={() => setDischargeBedRef(b.bed_id)} style={{ padding: '12px 14px', borderRadius: '10px', border: dischargeBedRef === b.bed_id ? `1px solid ${col.border}` : '1px solid rgba(255,255,255,0.06)', background: dischargeBedRef === b.bed_id ? col.bg : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px' }}>{b.patient_name}</div>
                      <div style={{ fontSize: '10px', color: col.border, fontWeight: 700 }}>{b.bed_id}</div>
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px' }}>
                      {b.bed_type} · {b.check_in ? `Since ${new Date(b.check_in).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: TRANSFER ──────────────────────────────────────────────── */}
      {activeTab === 'TRANSFER' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          <div style={S.glass}>
            <div style={S.secTitle}>🔄 BED TRANSFER</div>
            <div style={{ marginBottom: '14px' }}>
              <div style={S.label}>Patient (by current bed or ID)</div>
              <select style={S.inp} value={transferPatientRef} onChange={e => setTransferPatientRef(e.target.value)}>
                <option value="">— Select Admitted Patient —</option>
                {occupiedBeds.map(b => <option key={b.bed_id} value={b.patient_id || ''}>{b.patient_name} (currently in {b.bed_id})</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={S.label}>Transfer To Bed</div>
              <select style={S.inp} value={transferToBed} onChange={e => setTransferToBed(e.target.value)}>
                <option value="">— Select Target Available Bed —</option>
                {availableBeds.map(b => <option key={b.bed_id} value={b.bed_id}>{b.bed_id} ({b.bed_type} · {b.floor})</option>)}
              </select>
            </div>

            {transferPatientRef && transferToBed && (() => {
              const fromBed = occupiedBeds.find(b => b.patient_id === transferPatientRef);
              const toBed = availableBeds.find(b => b.bed_id === transferToBed);
              return (
                <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
                  <div style={{ fontSize: '10px', color: '#6366f1', fontWeight: 700, marginBottom: '8px' }}>TRANSFER PREVIEW</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', fontWeight: 700 }}>
                    <span style={{ color: '#ef4444' }}>{fromBed?.bed_id}</span>
                    <span style={{ color: '#6b7280' }}>→</span>
                    <span style={{ color: '#10b981' }}>{toBed?.bed_id}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{fromBed?.patient_name}</div>
                </div>
              );
            })()}

            <button style={{ ...S.btn('#6366f1'), width: '100%', padding: '12px', fontSize: '12px' }} onClick={handleTransfer} disabled={isBusy || !transferPatientRef || !transferToBed}>
              {isBusy ? '⏳ TRANSFERRING...' : '🔄 CONFIRM BED TRANSFER'}
            </button>
          </div>

          <div style={S.glass}>
            <div style={S.secTitle}>TRANSFER GUIDE</div>
            {[
              { icon: '1', label: 'Select the admitted patient from the dropdown (left).', color: '#6b7280' },
              { icon: '2', label: 'Choose the destination bed — only available beds are shown.', color: '#6b7280' },
              { icon: '3', label: 'Confirm — the system updates the occupancy record and patient folio instantly.', color: '#6b7280' },
            ].map(s => (
              <div key={s.icon} style={{ display: 'flex', gap: '14px', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#6366f1', flexShrink: 0 }}>{s.icon}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af', paddingTop: '4px' }}>{s.label}</div>
              </div>
            ))}
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: '8px', fontSize: '11px', color: '#6b7280' }}>
              The existing <strong style={{ color: '#10b981' }}>/api/hms/adt/transfer</strong> endpoint updates both the Active Occupancy table and the Patient Folio room reference atomically.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
