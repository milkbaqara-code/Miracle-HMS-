'use client';
import React, { useState, useEffect } from 'react';

// ─── STYLES ───────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
  backgroundColor: 'rgba(2, 6, 20, 0.92)', backdropFilter: 'blur(16px)',
  zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '16px', fontFamily: "'Inter', system-ui, sans-serif",
};

const panel: React.CSSProperties = {
  background: 'rgba(8, 14, 36, 0.7)',
  border: '1px solid rgba(16, 185, 129, 0.25)',
  boxShadow: '0 0 60px rgba(16,185,129,0.08), 0 0 120px rgba(16,185,129,0.04)',
  borderRadius: '20px', padding: '28px',
  width: '100%', maxWidth: '1100px',
  maxHeight: '92vh', overflowY: 'auto', position: 'relative', color: '#fff',
};

const closeBtn: React.CSSProperties = {
  position: 'absolute', top: '18px', right: '22px',
  background: 'transparent', border: 'none', color: '#555',
  fontSize: '22px', cursor: 'pointer', lineHeight: 1,
};

const tabBar: React.CSSProperties = {
  display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap',
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '8px 18px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
  letterSpacing: '0.05em', cursor: 'pointer', border: 'none',
  background: active ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.04)',
  color: active ? '#10b981' : '#666',
  boxShadow: active ? '0 0 16px rgba(16,185,129,0.25)' : 'none',
  transition: 'all 0.2s',
});

const sectionTitle: React.CSSProperties = {
  color: '#10b981', fontSize: '13px', fontWeight: 800, letterSpacing: '0.1em',
  textTransform: 'uppercase', marginBottom: '18px',
  textShadow: '0 0 12px rgba(16,185,129,0.4)',
  borderBottom: '1px solid rgba(16,185,129,0.15)', paddingBottom: '10px',
};

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(2,6,20,0.7)',
  border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px',
  padding: '10px 14px', color: '#fff', fontSize: '13px', outline: 'none',
  boxSizing: 'border-box',
};

const label: React.CSSProperties = {
  display: 'block', fontSize: '10px', color: '#6b7280',
  marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em',
};

const btn = (color = '#10b981'): React.CSSProperties => ({
  background: `rgba(${color === '#10b981' ? '16,185,129' : color === '#6366f1' ? '99,102,241' : '245,158,11'},0.15)`,
  border: `1px solid ${color}`,
  color, borderRadius: '8px', padding: '10px 18px', fontWeight: 700,
  fontSize: '11px', cursor: 'pointer', letterSpacing: '0.08em',
  boxShadow: `0 0 16px ${color}33`, transition: 'all 0.2s',
});

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function OPDScheduler({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'BOOK' | 'WALKIN' | 'QUEUE'>('ROSTER');

  // Shared state
  const [doctors, setDoctors] = useState<any[]>([]);
  const [rosters, setRosters] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Book tab state
  const [bookDate, setBookDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [chosenSlot, setChosenSlot] = useState('');
  const [patientRef, setPatientRef] = useState('');
  const [bookNotes, setBookNotes] = useState('');
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);

  // Walk-in ticket state
  const [walkPatientName, setWalkPatientName] = useState('');
  const [walkDept, setWalkDept] = useState('OPD');
  const [walkDoctorId, setWalkDoctorId] = useState('');
  const [ticketResult, setTicketResult] = useState<any>(null);

  // Queue tab state
  const [queueDept, setQueueDept] = useState('OPD');
  const [queueList, setQueueList] = useState<any[]>([]);

  // Roster override state
  const [editingRoster, setEditingRoster] = useState<any>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || '/api';

  // ── Load doctors on mount ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/hr/performance-matrix`)
      .then(r => r.json())
      .then(j => {
        const list = Array.isArray(j) ? j : (j.data || []);
        setDoctors(list);
        if (list.length) { setSelectedDoctor(list[0].id); setWalkDoctorId(list[0].id); }
      }).catch(console.error);
    loadRosters();
  }, []);

  // ── Load rosters ──────────────────────────────────────────────────────────
  const loadRosters = () => {
    fetch(`${API}/hms/roster`)
      .then(r => r.json())
      .then(j => setRosters(j.data || []))
      .catch(console.error);
  };

  // ── Load available slots when doctor + date chosen ─────────────────────────
  useEffect(() => {
    if (selectedDoctor && bookDate) {
      fetch(`${API}/hms/roster/${selectedDoctor}/available-slots?appt_date=${bookDate}`)
        .then(r => r.json())
        .then(j => { setAvailableSlots(j.available_slots || []); setChosenSlot(''); })
        .catch(console.error);
    }
  }, [selectedDoctor, bookDate]);

  // ── Load doctor appointments ───────────────────────────────────────────────
  useEffect(() => {
    if (selectedDoctor) {
      fetch(`${API}/hms/appointments/${selectedDoctor}`)
        .then(r => r.json())
        .then(j => setAppointmentsList(j.data || []))
        .catch(console.error);
    }
  }, [selectedDoctor]);

  // ── Confirm appointment ────────────────────────────────────────────────────
  const handleBook = async () => {
    if (!patientRef || !chosenSlot) return alert('Select a patient ref and a time slot.');
    setIsBusy(true);
    try {
      const res = await fetch(`${API}/hms/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientRef, doctor_id: selectedDoctor, appointment_time: chosenSlot, notes: bookNotes }),
      });
      if (res.ok) {
        setPatientRef(''); setBookNotes(''); setChosenSlot('');
        fetch(`${API}/hms/appointments/${selectedDoctor}`).then(r => r.json()).then(j => setAppointmentsList(j.data || []));
        fetch(`${API}/hms/roster/${selectedDoctor}/available-slots?appt_date=${bookDate}`).then(r => r.json()).then(j => setAvailableSlots(j.available_slots || []));
      } else {
        const err = await res.json();
        alert(err.detail || 'Booking failed.');
      }
    } catch (e) { alert('Network error.'); }
    setIsBusy(false);
  };

  // ── Issue walk-in ticket ───────────────────────────────────────────────────
  const handleWalkIn = async () => {
    if (!walkPatientName || !walkDept) return;
    setIsBusy(true);
    try {
      const res = await fetch(`${API}/hms/walk-in/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_name: walkPatientName, department_code: walkDept, assigned_doctor_id: walkDoctorId || null }),
      });
      const data = await res.json();
      if (res.ok) { setTicketResult(data); setWalkPatientName(''); }
    } catch (e) { alert('Ticket error.'); }
    setIsBusy(false);
  };

  // ── Load department queue ──────────────────────────────────────────────────
  const loadQueue = () => {
    fetch(`${API}/hms/walk-in/queue/${queueDept}`)
      .then(r => r.json())
      .then(j => setQueueList(j.queue || []))
      .catch(console.error);
  };

  useEffect(() => { if (activeTab === 'QUEUE') loadQueue(); }, [activeTab, queueDept]);

  // ── AI Generate Roster ─────────────────────────────────────────────────────
  const generateAiRoster = async () => {
    setIsBusy(true);
    const res = await fetch(`${API}/hms/roster/generate-ai`, { method: 'POST' });
    const data = await res.json();
    alert(data.message || 'AI Roster generated.');
    loadRosters();
    setIsBusy(false);
  };

  // ── Call next patient ──────────────────────────────────────────────────────
  const callNext = async () => {
    const res = await fetch(`${API}/hms/walk-in/call-next/${queueDept}`, { method: 'POST' });
    const data = await res.json();
    if (data.ticket) alert(`📢 NOW CALLING: ${data.ticket.patient_name} — ${data.ticket.serial}`);
    loadQueue();
  };

  // ── Save roster override ───────────────────────────────────────────────────
  const saveRosterOverride = async () => {
    if (!editingRoster) return;
    await fetch(`${API}/hms/roster/${editingRoster.roster_id}/override`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time: editingRoster.start_time, end_time: editingRoster.end_time, max_patients: editingRoster.max_patients }),
    });
    setEditingRoster(null);
    loadRosters();
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={overlay}>
      <div style={panel}>
        <button style={closeBtn} onClick={onClose}>×</button>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: '#10b981', fontSize: '18px', fontWeight: 900, textShadow: '0 0 20px rgba(16,185,129,0.5)', letterSpacing: '0.05em' }}>
            🩺 CLINICAL SCHEDULING COMMAND
          </div>
          <div style={{ color: '#4b5563', fontSize: '11px', marginTop: '4px' }}>Roster Planner · OPD Appointments · Walk-in Triage Queue</div>
        </div>

        {/* Tab Bar */}
        <div style={tabBar}>
          {(['ROSTER', 'BOOK', 'WALKIN', 'QUEUE'] as const).map(t => (
            <button key={t} style={tabBtn(activeTab === t)} onClick={() => setActiveTab(t)}>
              {t === 'ROSTER' ? '📋 WEEKLY ROSTER' : t === 'BOOK' ? '📅 BOOK APPOINTMENT' : t === 'WALKIN' ? '🎫 WALK-IN TICKET' : '📡 LIVE QUEUE'}
            </button>
          ))}
        </div>

        {/* ─── TAB: ROSTER PLANNER ────────────────────────────────── */}
        {activeTab === 'ROSTER' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={sectionTitle}>📋 WEEKLY DOCTOR ROSTER (AGI MANAGED)</div>
              <button style={btn('#6366f1')} onClick={generateAiRoster} disabled={isBusy}>
                {isBusy ? 'GENERATING...' : '🤖 AGI AUTO-GENERATE ROSTER'}
              </button>
            </div>

            {rosters.length === 0 ? (
              <div style={{ color: '#4b5563', textAlign: 'center', padding: '40px', fontSize: '13px' }}>
                No rosters found. Click <strong style={{ color: '#6366f1' }}>AGI Auto-Generate Roster</strong> to build the week automatically.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {rosters.map((doc: any) => (
                  <div key={doc.doctor_id} style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#fff' }}>👨‍⚕️ {doc.doctor_name}</div>
                        <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px', letterSpacing: '0.08em' }}>{doc.department}</div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#4b5563' }}>{doc.shifts.length} active day(s)</div>
                    </div>
                    {/* Glowing Week Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
                      {DAY_NAMES.map((day, i) => {
                        const shift = doc.shifts.find((s: any) => s.day_index === i);
                        return (
                          <div
                            key={i}
                            onClick={() => shift && setEditingRoster({ ...shift, doctor_name: doc.doctor_name })}
                            style={{
                              borderRadius: '8px', padding: '8px 4px', textAlign: 'center', fontSize: '10px',
                              cursor: shift ? 'pointer' : 'default',
                              background: shift ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                              border: shift ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.06)',
                              boxShadow: shift ? '0 0 12px rgba(16,185,129,0.15)' : 'none',
                              transition: 'all 0.2s',
                            }}
                          >
                            <div style={{ color: shift ? '#10b981' : '#374151', fontWeight: 700, marginBottom: '4px' }}>{day}</div>
                            {shift ? (
                              <>
                                <div style={{ color: '#d1fae5', fontSize: '9px' }}>{shift.start_time}–{shift.end_time}</div>
                                <div style={{ color: '#6b7280', fontSize: '9px', marginTop: '2px' }}>max {shift.max_patients} pts</div>
                              </>
                            ) : (
                              <div style={{ color: '#1f2937', fontSize: '9px' }}>OFF</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Edit Shift Modal */}
            {editingRoster && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#0a1020', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '16px', padding: '28px', width: '340px', boxShadow: '0 0 40px rgba(99,102,241,0.2)' }}>
                  <div style={{ color: '#6366f1', fontWeight: 800, marginBottom: '16px', fontSize: '13px' }}>✏️ EDIT SHIFT — {editingRoster.day} · {editingRoster.doctor_name}</div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={label}>Clinic Start Time</div>
                    <input style={inp} type="time" value={editingRoster.start_time} onChange={e => setEditingRoster({ ...editingRoster, start_time: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={label}>Clinic End Time</div>
                    <input style={inp} type="time" value={editingRoster.end_time} onChange={e => setEditingRoster({ ...editingRoster, end_time: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={label}>Max Patients / Day (International Standard: 20)</div>
                    <input style={inp} type="number" min={1} max={40} value={editingRoster.max_patients} onChange={e => setEditingRoster({ ...editingRoster, max_patients: Number(e.target.value) })} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={{ ...btn('#10b981'), flex: 1 }} onClick={saveRosterOverride}>✅ SAVE OVERRIDE</button>
                    <button style={{ ...btn('#ef4444'), flex: 1 }} onClick={() => setEditingRoster(null)}>CANCEL</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: BOOK APPOINTMENT ──────────────────────────────── */}
        {activeTab === 'BOOK' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
            {/* Left: Booking Form */}
            <div>
              <div style={sectionTitle}>📅 BOOK CONSULTATION SLOT</div>
              <div style={{ marginBottom: '14px' }}>
                <div style={label}>Select Doctor</div>
                <select style={inp} value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}>
                  {doctors.map((d: any) => <option key={d.id} value={d.id}>{d.full_name} ({d.position || 'Physician'})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <div style={label}>Appointment Date</div>
                <input style={inp} type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </div>

              {/* Available Slots */}
              {bookDate && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={label}>Available 15-Min Slots ({availableSlots.length} open)</div>
                  {availableSlots.length === 0 ? (
                    <div style={{ color: '#ef4444', fontSize: '11px', padding: '8px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                      ⚠ Doctor is fully booked or not rostered on this day.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {availableSlots.map((s: any) => (
                        <button
                          key={s.time} onClick={() => setChosenSlot(s.datetime)}
                          style={{
                            padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                            border: chosenSlot === s.datetime ? '1px solid #10b981' : '1px solid rgba(16,185,129,0.25)',
                            background: chosenSlot === s.datetime ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.05)',
                            color: chosenSlot === s.datetime ? '#10b981' : '#6b7280',
                            boxShadow: chosenSlot === s.datetime ? '0 0 10px rgba(16,185,129,0.3)' : 'none',
                          }}
                        >{s.time}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <div style={label}>Patient ID / Bed Number / Name</div>
                <input style={inp} type="text" placeholder="e.g. CABIN-02 or Patient ID" value={patientRef} onChange={e => setPatientRef(e.target.value)} />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <div style={label}>Clinical Notes / Chief Complaint</div>
                <textarea style={{ ...inp, minHeight: '60px', resize: 'none' }} placeholder="Reason for consultation..." value={bookNotes} onChange={e => setBookNotes(e.target.value)} />
              </div>
              <button style={{ ...btn('#10b981'), width: '100%', padding: '12px' }} onClick={handleBook} disabled={isBusy || !chosenSlot || !patientRef}>
                {isBusy ? '⏳ BOOKING...' : '✅ CONFIRM APPOINTMENT SLOT'}
              </button>
            </div>

            {/* Right: Upcoming Appointments */}
            <div>
              <div style={sectionTitle}>🗓️ UPCOMING APPOINTMENTS</div>
              {appointmentsList.length === 0 ? (
                <div style={{ color: '#374151', fontSize: '13px', textAlign: 'center', padding: '30px' }}>No consultations booked for this physician.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
                  {appointmentsList.map((a: any) => (
                    <div key={a.id} style={{ background: 'rgba(16,185,129,0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#10b981', marginBottom: '4px' }}>
                        <span>{new Date(a.appointment_time).toLocaleDateString()} · {new Date(a.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span style={{ fontWeight: 800, color: a.status === 'COMPLETED' ? '#6b7280' : '#10b981' }}>{a.status}</span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{a.patient_name}</div>
                      {a.notes && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{a.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: WALK-IN TICKET ────────────────────────────────── */}
        {activeTab === 'WALKIN' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start' }}>
            <div>
              <div style={sectionTitle}>🎫 ISSUE WALK-IN SERIAL TICKET</div>
              <div style={{ marginBottom: '14px' }}>
                <div style={label}>Patient Full Name</div>
                <input style={inp} type="text" placeholder="Walk-in patient name" value={walkPatientName} onChange={e => setWalkPatientName(e.target.value)} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <div style={label}>Department</div>
                <select style={inp} value={walkDept} onChange={e => setWalkDept(e.target.value)}>
                  {['OPD', 'EMR', 'ICU', 'WARD', 'CL', 'PH', 'CARDIOLOGY', 'ORTHO', 'NEURO', 'GYNAE'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <div style={label}>Assign to Doctor (optional)</div>
                <select style={inp} value={walkDoctorId} onChange={e => setWalkDoctorId(e.target.value)}>
                  <option value="">— Auto-assign —</option>
                  {doctors.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
              </div>
              <button style={{ ...btn('#f59e0b'), width: '100%', padding: '12px' }} onClick={handleWalkIn} disabled={isBusy || !walkPatientName}>
                {isBusy ? '⏳ ISSUING...' : '🎫 GENERATE SERIAL TICKET'}
              </button>
            </div>

            {/* Ticket Preview */}
            <div>
              {ticketResult ? (
                <div style={{
                  border: '2px dashed rgba(245,158,11,0.5)', borderRadius: '16px', padding: '28px',
                  background: 'rgba(245,158,11,0.05)', textAlign: 'center',
                  boxShadow: '0 0 40px rgba(245,158,11,0.1)',
                }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', letterSpacing: '0.15em', marginBottom: '8px' }}>MIRACLE HMS — WALK-IN TICKET</div>
                  <div style={{ fontSize: '52px', fontWeight: 900, color: '#f59e0b', textShadow: '0 0 30px rgba(245,158,11,0.5)', lineHeight: 1 }}>{ticketResult.ticket_serial}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: '10px 0 4px' }}>{ticketResult.data?.patient_name}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Dept: {ticketResult.data?.department_code}</div>
                  <div style={{ marginTop: '18px', padding: '14px', background: 'rgba(245,158,11,0.1)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#f59e0b', marginBottom: '4px' }}>⏱ ESTIMATED CONSULTATION TIME</div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>{ticketResult.estimated_time}</div>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>Position #{ticketResult.queue_position} · ~{ticketResult.estimated_wait_mins} min wait</div>
                  </div>
                  <div style={{ marginTop: '14px', fontSize: '10px', color: '#374151' }}>Present this ticket at the Front Desk reception</div>
                  <button style={{ ...btn('#f59e0b'), marginTop: '14px' }} onClick={() => setTicketResult(null)}>ISSUE NEW TICKET</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#1f2937', fontSize: '13px', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '40px' }}>🎫</div>
                  <div>Issue a walk-in ticket to see the preview here</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: LIVE QUEUE ────────────────────────────────────── */}
        {activeTab === 'QUEUE' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={sectionTitle}>📡 LIVE DEPARTMENT QUEUE</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select style={{ ...inp, width: '140px' }} value={queueDept} onChange={e => { setQueueDept(e.target.value); }}>
                  {['OPD', 'EMR', 'ICU', 'WARD', 'CL', 'PH', 'CARDIOLOGY', 'ORTHO', 'NEURO', 'GYNAE'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <button style={btn('#10b981')} onClick={loadQueue}>🔄 REFRESH</button>
                <button style={btn('#ef4444')} onClick={callNext}>📢 CALL NEXT</button>
              </div>
            </div>

            {queueList.length === 0 ? (
              <div style={{ color: '#374151', textAlign: 'center', padding: '40px', fontSize: '13px' }}>Queue is clear for {queueDept}.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {queueList.map((t: any, i: number) => (
                  <div key={t.ticket_serial} style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px',
                    borderRadius: '10px', background: t.status === 'CALLED' ? 'rgba(239,68,68,0.08)' : t.status === 'COMPLETED' ? 'rgba(255,255,255,0.02)' : 'rgba(16,185,129,0.05)',
                    border: t.status === 'CALLED' ? '1px solid rgba(239,68,68,0.3)' : t.status === 'COMPLETED' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(16,185,129,0.15)',
                    boxShadow: t.status === 'CALLED' ? '0 0 20px rgba(239,68,68,0.15)' : 'none',
                  }}>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: t.status === 'CALLED' ? '#ef4444' : t.status === 'COMPLETED' ? '#374151' : '#10b981', minWidth: '30px', textAlign: 'center' }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{t.patient_name}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>Ticket: {t.ticket_serial} · Est. {t.estimated_time}</div>
                    </div>
                    <div style={{
                      fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px',
                      background: t.status === 'CALLED' ? 'rgba(239,68,68,0.15)' : t.status === 'COMPLETED' ? 'rgba(107,114,128,0.15)' : 'rgba(16,185,129,0.15)',
                      color: t.status === 'CALLED' ? '#ef4444' : t.status === 'COMPLETED' ? '#6b7280' : '#10b981',
                    }}>{t.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
