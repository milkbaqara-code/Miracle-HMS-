'use client';
import React, { useState } from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';

interface Ambulance {
  id: string;
  driver: string;
  paramedic: string;
  status: 'STANDBY' | 'DISPATCHED' | 'MAINTENANCE';
  location: string;
}

interface TriageCase {
  id: string;
  patient_name: string;
  severity: 'CRITICAL' | 'URGENT' | 'STABLE';
  symptoms: string;
  assigned_bed: string;
  time_logged: string;
}

export default function EmergencyCommandPage() {
  const isViewMode = useViewMode();

  const [ambulances, setAmbulances] = useState<Ambulance[]>([
    { id: 'AMB-01', driver: 'James Miller', paramedic: 'Dr. Sarah Connor', status: 'STANDBY', location: 'ER Base Bay 1' },
    { id: 'AMB-02', driver: 'David Clark', paramedic: 'Nurse Kyle Reese', status: 'DISPATCHED', location: 'Highway Interstate Route 4' },
    { id: 'AMB-03', driver: 'Robert Martinez', paramedic: 'Dr. John Croft', status: 'STANDBY', location: 'ER Base Bay 2' },
    { id: 'AMB-04', driver: 'William Davis', paramedic: 'Nurse Helen Ripley', status: 'MAINTENANCE', location: 'Central Garage' }
  ]);

  const [triageCases, setTriageCases] = useState<TriageCase[]>([
    { id: 'TRG-404', patient_name: 'Arthur Pendragon', severity: 'CRITICAL', symptoms: 'Severe acute chest pain, suspected myocardial infarction', assigned_bed: 'ICU-01', time_logged: '21:35' },
    { id: 'TRG-405', patient_name: 'Guinevere Croft', severity: 'URGENT', symptoms: 'Compound femur fracture from trauma', assigned_bed: 'ER-01', time_logged: '21:40' },
    { id: 'TRG-406', patient_name: 'Lancelot Smith', severity: 'STABLE', symptoms: 'Sprained ankle with superficial abrasions', assigned_bed: 'WARD-03', time_logged: '21:44' }
  ]);

  // Form State
  const [selectedAmb, setSelectedAmb] = useState('');
  const [dispatchLoc, setDispatchLoc] = useState('');
  const [dispatchDetails, setDispatchDetails] = useState('');
  
  // Triage Log State
  const [triageName, setTriageName] = useState('');
  const [triageSeverity, setTriageSeverity] = useState<'CRITICAL' | 'URGENT' | 'STABLE'>('STABLE');
  const [triageSymptoms, setTriageSymptoms] = useState('');
  const [triageBed, setTriageBed] = useState('');

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmb || !dispatchLoc) return;

    setAmbulances(prev => prev.map(a => {
      if (a.id === selectedAmb) {
        return { ...a, status: 'DISPATCHED', location: dispatchLoc };
      }
      return a;
    }));

    alert(`Emergency dispatch authorized for ${selectedAmb} to location: ${dispatchLoc}`);
    setSelectedAmb('');
    setDispatchLoc('');
    setDispatchDetails('');
  };

  const handleLogTriage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!triageName || !triageSymptoms) return;

    const newCase: TriageCase = {
      id: `TRG-${Math.floor(400 + Math.random() * 600)}`,
      patient_name: triageName,
      severity: triageSeverity,
      symptoms: triageSymptoms,
      assigned_bed: triageBed || 'PENDING ALLOC',
      time_logged: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setTriageCases([newCase, ...triageCases]);
    setTriageName('');
    setTriageSymptoms('');
    setTriageBed('');
  };

  const handleResetAmbulance = (ambId: string) => {
    setAmbulances(prev => prev.map(a => {
      if (a.id === ambId) {
        return { ...a, status: 'STANDBY', location: 'ER Base' };
      }
      return a;
    }));
  };

  return (
    <div style={containerStyle}>
      <ViewModeBanner />

      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>🚑 EMERGENCY COMMAND CENTER</h1>
          <p style={subtitleStyle}>ER TRIAGE BOARD & AMBULANCE FLEET DISPATCH MONITOR</p>
        </div>
      </div>

      <div style={layoutGrid}>
        
        {/* LEFT BLOCK: DISPATCH & TRIAGE INPUT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* AMBULANCE DISPATCH PANEL */}
          <div style={glassPanel}>
            <h2 style={sectionTitle}>Dispatch Emergency Vehicle</h2>
            <form onSubmit={handleDispatch}>
              <div style={inputGroup}>
                <label style={labelStyle}>Select Standby Ambulance</label>
                <select style={inputStyle} value={selectedAmb} onChange={e => setSelectedAmb(e.target.value)} required>
                  <option value="">-- Choose Available Unit --</option>
                  {ambulances.filter(a => a.status === 'STANDBY').map(a => (
                    <option key={a.id} value={a.id}>{a.id} - Paramedic: {a.paramedic}</option>
                  ))}
                </select>
              </div>

              <div style={inputGroup}>
                <label style={labelStyle}>Emergency Location Address</label>
                <input type="text" style={inputStyle} placeholder="e.g. 5th Avenue Crossing" value={dispatchLoc} onChange={e => setDispatchLoc(e.target.value)} required />
              </div>

              <div style={inputGroup}>
                <label style={labelStyle}>Incident Telemetry Details</label>
                <input type="text" style={inputStyle} placeholder="e.g. Road accident, multi-vehicle trauma" value={dispatchDetails} onChange={e => setDispatchDetails(e.target.value)} />
              </div>

              <button type="submit" style={actionBtn}>AUTHORIZE DISPATCH EMERGENCY TEAM</button>
            </form>
          </div>

          {/* LOG NEW EMERGENCY CASE */}
          <div style={glassPanel}>
            <h2 style={sectionTitle}>Log Incoming Emergency Patient</h2>
            <form onSubmit={handleLogTriage}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '15px', marginBottom: '15px' }}>
                <div style={inputGroupNoMargin}>
                  <label style={labelStyle}>Patient Name / ID</label>
                  <input type="text" style={inputStyle} placeholder="Anonymous/Unknown or Name" value={triageName} onChange={e => setTriageName(e.target.value)} required />
                </div>
                <div style={inputGroupNoMargin}>
                  <label style={labelStyle}>Severity Level</label>
                  <select style={inputStyle} value={triageSeverity} onChange={e => setTriageSeverity(e.target.value as any)}>
                    <option value="CRITICAL">🔴 CRITICAL (RED)</option>
                    <option value="URGENT">🟡 URGENT (YELLOW)</option>
                    <option value="STABLE">🟢 STABLE (GREEN)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '15px', marginBottom: '15px' }}>
                <div style={inputGroupNoMargin}>
                  <label style={labelStyle}>Presenting Symptoms</label>
                  <input type="text" style={inputStyle} placeholder="e.g. Difficulty breathing, blunt trauma" value={triageSymptoms} onChange={e => setTriageSymptoms(e.target.value)} required />
                </div>
                <div style={inputGroupNoMargin}>
                  <label style={labelStyle}>Assigned ER Bed</label>
                  <input type="text" style={inputStyle} placeholder="e.g. ER-02 or PENDING" value={triageBed} onChange={e => setTriageBed(e.target.value)} />
                </div>
              </div>

              <button type="submit" style={{ ...actionBtn, background: '#FF3131', color: '#fff', boxShadow: '0 0 10px rgba(255,49,49,0.3)' }}>
                LOG & ALLOCATE ER PATIENT
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT BLOCK: ER TRIAGE & AMBULANCE STATUS QUEUES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ER TRIAGE CASES LIST */}
          <div style={glassPanel}>
            <h2 style={sectionTitle}>Active ER Triage Worklist</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {triageCases.map(t => (
                <div key={t.id} style={triageCardStyle(t.severity)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>
                    <span>{t.id} - Admitted {t.time_logged}</span>
                    <span style={{ color: severityColor(t.severity) }}>{t.severity}</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{t.patient_name}</div>
                  <div style={{ fontSize: '11px', color: '#ccc', margin: '4px 0 6px 0' }}>{t.symptoms}</div>
                  <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 'bold', textTransform: 'uppercase', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px' }}>
                    📍 Bed: {t.assigned_bed}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AMBULANCE STATUS LIST */}
          <div style={glassPanel}>
            <h2 style={sectionTitle}>Ambulance Fleet Status</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {ambulances.map(a => (
                <div key={a.id} style={ambCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{a.id}</span>
                    <span style={ambStatusStyle(a.status)}>{a.status}</span>
                  </div>
                  <div style={ambDetailText}>Crew: {a.paramedic.replace('Dr. ', '').replace('Nurse ', '')}</div>
                  <div style={ambDetailText}>Loc: {a.location}</div>
                  {a.status === 'DISPATCHED' && (
                    <button style={returnBtnStyle} onClick={() => handleResetAmbulance(a.id)}>
                      RECALL TO BASE
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

// Helper colors
const severityColor = (sev: string) => {
  if (sev === 'CRITICAL') return '#FF3131';
  if (sev === 'URGENT') return '#f59e0b';
  return '#10b981';
};

const triageCardStyle = (severity: string): React.CSSProperties => {
  const borderCol = severityColor(severity);
  return {
    background: 'rgba(5, 8, 16, 0.4)',
    padding: '14px',
    borderRadius: '10px',
    borderLeft: `4px solid ${borderCol}`,
    borderTop: '1px solid rgba(255,255,255,0.05)',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  };
};

// Styling definitions
const containerStyle: React.CSSProperties = {
  padding: '30px',
  color: '#fff',
  fontFamily: 'system-ui, sans-serif',
  background: 'transparent',
};

const headerStyle: React.CSSProperties = {
  marginBottom: '25px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#FF3131',
  textShadow: '0 0 10px rgba(255, 49, 49, 0.2)',
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  margin: '5px 0 0 0',
  fontSize: '11px',
  color: '#aaa',
  letterSpacing: '1px',
};

const layoutGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1.1fr',
  gap: '30px',
};

const glassPanel: React.CSSProperties = {
  background: 'rgba(16, 24, 48, 0.45)',
  border: '1px solid rgba(255, 49, 49, 0.15)',
  boxShadow: '0 0 20px rgba(255, 49, 49, 0.02)',
  borderRadius: '16px',
  padding: '24px',
  backdropFilter: 'blur(10px)',
};

const sectionTitle: React.CSSProperties = {
  color: '#FF3131',
  fontSize: '16px',
  fontWeight: 'bold',
  marginTop: 0,
  marginBottom: '20px',
};

const inputGroup: React.CSSProperties = {
  marginBottom: '15px',
};

const inputGroupNoMargin: React.CSSProperties = {
  marginBottom: 0,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: '#aaa',
  marginBottom: '6px',
  textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(5, 8, 16, 0.8)',
  border: '1px solid rgba(255, 49, 49, 0.2)',
  borderRadius: '8px',
  padding: '10px',
  color: '#fff',
  outline: 'none',
  fontSize: '13px',
};

const actionBtn: React.CSSProperties = {
  width: '100%',
  background: '#fff',
  color: '#000',
  border: 'none',
  borderRadius: '8px',
  padding: '12px',
  fontWeight: 'bold',
  fontSize: '12px',
  cursor: 'pointer',
  marginTop: '10px',
};

const ambCardStyle: React.CSSProperties = {
  background: 'rgba(5, 8, 16, 0.4)',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.05)',
};

const ambStatusStyle = (status: string): React.CSSProperties => {
  const isStandby = status === 'STANDBY';
  const isDispatched = status === 'DISPATCHED';
  return {
    fontSize: '9px',
    fontWeight: 'bold',
    padding: '2px 5px',
    borderRadius: '4px',
    background: isStandby ? 'rgba(16, 185, 129, 0.15)' : isDispatched ? 'rgba(255, 49, 49, 0.15)' : 'rgba(255,255,255,0.05)',
    color: isStandby ? '#10b981' : isDispatched ? '#FF3131' : '#888',
    border: `1px solid ${isStandby ? '#10b981' : isDispatched ? '#FF3131' : '#444'}`,
  };
};

const ambDetailText: React.CSSProperties = {
  fontSize: '11px',
  color: '#aaa',
  marginTop: '3px',
};

const returnBtnStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '10px',
  background: 'rgba(255, 255, 255, 0.1)',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '4px',
  fontSize: '10px',
  fontWeight: 'bold',
  cursor: 'pointer',
};
