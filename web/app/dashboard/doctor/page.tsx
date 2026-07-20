'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function DoctorPortal() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  // Auth state
  const [docId, setDocId] = useState('');
  const [docName, setDocName] = useState('UNIDENTIFIED PHYSICIAN');
  const [isOnDuty, setIsOnDuty] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState<'APPOINTMENTS' | 'ROSTER' | 'VIDEO_ROOM'>('APPOINTMENTS');
  const [roster, setRoster] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // WebRTC Video State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [streamError, setStreamError] = useState('');

  // Dynamic Data State
  const [appointments, setAppointments] = useState<any[]>([]);
  const [emrData, setEmrData] = useState<any | null>(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [clinicalNote, setClinicalNote] = useState({ symptoms: '', examination: '', diagnosis: '', plan: '' });

  useEffect(() => {
    setIsClient(true);
    const user = localStorage.getItem('miracle_user') || 'DR-001'; // fallback to DR-001 for testing
    setDocId(user);
    if(user.includes('SAJEED') || user === 'ADMIN') {
      setDocName('DR. SAJEED AHMED (CHIEF OF SURGERY)');
    } else {
      setDocName(`PHYSICIAN ${user}`);
    }
  }, []);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  useEffect(() => {
    if (isOnDuty && docId) {
      fetchAppointments();
      fetchRoster();
    }
  }, [isOnDuty, docId]);

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`${API_URL}/doctor/appointments?doctor_id=${docId}`);
      if (res.ok) {
        const json = await res.json();
        setAppointments(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch appointments:", e);
    }
  };

  const fetchRoster = async () => {
    try {
      const res = await fetch(`${API_URL}/doctor/roster?doctor_id=${docId}`);
      if (res.ok) {
        const json = await res.json();
        setRoster(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch roster:", e);
    }
  };

  const fetchEMR = async (patientId: string) => {
    setEmrData(null);
    try {
      const res = await fetch(`${API_URL}/doctor/emr/${patientId}`);
      if (res.ok) {
        const json = await res.json();
        setEmrData(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch EMR:", e);
    }
  };

  const handlePatientSelect = (apt: any) => {
    setSelectedPatient(apt);
    fetchEMR(apt.patientId);
  };

  const handleStartDuty = async () => {
    try {
      await fetch(`${API_URL}/doctor/duty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: docId, status: 'ON-DUTY' })
      });
      setIsOnDuty(true);
      console.log(`[SYNAPSE] ${docName} IS NOW ON DUTY.`);
    } catch (e) {
      console.error("Failed to start duty:", e);
      // Fallback for UI testing if backend is down
      setIsOnDuty(true); 
    }
  };

  const handleEndDuty = async () => {
    try {
      await fetch('http://localhost:8000/api/doctor/duty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: docId, status: 'OFFLINE' })
      });
      setIsOnDuty(false);
      stopCamera();
      console.log(`[SYNAPSE] ${docName} SIGNED OFF.`);
    } catch (e) {
      setIsOnDuty(false);
    }
  };

  const submitClinicalNote = async () => {
    if (!selectedPatient) return;
    try {
      await fetch('http://localhost:8000/api/doctor/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient.patientId,
          doctor_id: docId,
          symptoms: clinicalNote.symptoms,
          examination: clinicalNote.examination,
          diagnosis_icd10: clinicalNote.diagnosis,
          treatment_plan: clinicalNote.plan
        })
      });
      setIsNotesModalOpen(false);
      setClinicalNote({ symptoms: '', examination: '', diagnosis: '', plan: '' });
      fetchEMR(selectedPatient.patientId); // Refresh EMR
    } catch (e) {
      console.error("Failed to submit note:", e);
    }
  };

  const startCamera = async () => {
    try {
      setStreamError('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if(videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch(err) {
      setStreamError('CAMERA ACCESS DENIED OR UNAVAILABLE');
    }
  };

  const stopCamera = () => {
    if(videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  if(!isClient) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#020A05', color: '#00FF88', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #006A4E', paddingBottom: '15px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '24px', letterSpacing: '2px', textShadow: '0 0 10px rgba(0, 255, 136, 0.5)' }}>
            Z-DOCTOR: PHYSICIAN COMMAND
          </h1>
          <p style={{ margin: 0, fontSize: '11px', color: '#00A86B', fontWeight: 900 }}>{docName} | ID: {docId}</p>
        </div>
        <div>
          {!isOnDuty ? (
            <button onClick={handleStartDuty} style={{ background: '#00FF88', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 0 15px rgba(0,255,136,0.4)' }}>
              ▶ START DUTY
            </button>
          ) : (
            <button onClick={handleEndDuty} style={{ background: 'transparent', color: '#EF4444', border: '2px solid #EF4444', padding: '10px 20px', borderRadius: '4px', fontWeight: 900, cursor: 'pointer' }}>
              ⏹ LOG OUT (END DUTY)
            </button>
          )}
        </div>
      </div>

      {!isOnDuty ? (
        <div style={{ textAlign: 'center', padding: '100px 20px', color: '#006A4E' }}>
          <h2>YOU ARE CURRENTLY OFF DUTY</h2>
          <p>Please click START DUTY to synchronize with Synapse Nexus and access patient records.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 120px)' }}>
          
          {/* LEFT NAV PANEL */}
          <div style={{ width: '250px', background: 'rgba(0,20,10,0.8)', border: '1px solid #006A4E', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => setActiveTab('APPOINTMENTS')} style={{ background: activeTab === 'APPOINTMENTS' ? 'rgba(0,255,136,0.2)' : 'transparent', color: '#00FF88', border: '1px solid #006A4E', padding: '15px', textAlign: 'left', fontWeight: 900, cursor: 'pointer', borderRadius: '4px' }}>
              📅 APPOINTMENT HUB
            </button>
            <button onClick={() => setActiveTab('VIDEO_ROOM')} style={{ background: activeTab === 'VIDEO_ROOM' ? 'rgba(0,255,136,0.2)' : 'transparent', color: '#00FF88', border: '1px solid #006A4E', padding: '15px', textAlign: 'left', fontWeight: 900, cursor: 'pointer', borderRadius: '4px' }}>
              🎥 VIDEO CONSULTATION
            </button>
            <button onClick={() => setActiveTab('ROSTER')} style={{ background: activeTab === 'ROSTER' ? 'rgba(0,255,136,0.2)' : 'transparent', color: '#00FF88', border: '1px solid #006A4E', padding: '15px', textAlign: 'left', fontWeight: 900, cursor: 'pointer', borderRadius: '4px' }}>
              👥 DUTY ROSTER (READ ONLY)
            </button>
          </div>

          {/* MAIN CONTENT AREA */}
          <div style={{ flex: 1, background: 'rgba(0,10,5,0.9)', border: '1px solid #006A4E', borderRadius: '8px', padding: '20px', overflowY: 'auto', position: 'relative' }}>
            
            {/* APPOINTMENTS TAB */}
            {activeTab === 'APPOINTMENTS' && (
              <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
                {/* APPOINTMENT LIST */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ borderBottom: '1px solid #006A4E', paddingBottom: '10px' }}>TODAY'S SCHEDULE</h3>
                  {appointments.length === 0 ? (
                    <div style={{ color: '#006A4E', marginTop: '20px', textAlign: 'center' }}>No appointments scheduled for today.</div>
                  ) : appointments.map(apt => (
                    <div 
                      key={apt.id} 
                      onClick={() => handlePatientSelect(apt)}
                      style={{ 
                        background: selectedPatient?.id === apt.id ? 'rgba(0,255,136,0.1)' : 'transparent',
                        border: '1px solid #006A4E', 
                        padding: '15px', 
                        marginBottom: '10px', 
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '10px', color: '#00A86B', fontWeight: 900 }}>{apt.time} | {apt.type}</div>
                        <div style={{ fontSize: '16px', fontWeight: 900 }}>{apt.patient}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{apt.reason}</div>
                      </div>
                      <div style={{ fontSize: '10px', background: '#006A4E', padding: '4px 8px', borderRadius: '10px' }}>{apt.status}</div>
                    </div>
                  ))}
                </div>

                {/* EMR SIDE PANEL */}
                <div style={{ width: '350px', borderLeft: '1px solid #006A4E', paddingLeft: '20px' }}>
                  <h3 style={{ borderBottom: '1px solid #006A4E', paddingBottom: '10px' }}>ELECTRONIC MEDICAL RECORD</h3>
                  {selectedPatient ? (
                    <div>
                      <div style={{ background: '#001a10', padding: '15px', borderRadius: '4px', marginBottom: '15px', border: '1px solid #00FF88' }}>
                        <h4 style={{ margin: '0 0 10px 0' }}>{selectedPatient.patient}</h4>
                        <p style={{ margin: '0', fontSize: '12px', color: '#00A86B' }}>ID: {selectedPatient.patientId}</p>
                      </div>
                      
                      {!emrData ? (
                        <div style={{ color: '#00A86B', fontSize: '12px' }}>Loading EMR from backend...</div>
                      ) : (
                        <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                          <p><strong>🩺 VITALS:</strong> {emrData.vitals}</p>
                          <p style={{ whiteSpace: 'pre-line' }}><strong>📜 HISTORY:</strong><br/>{emrData.history}</p>
                          <p><strong>💊 MEDICATION:</strong> {emrData.meds}</p>
                          <p><strong>🔬 LAB ORDERS:</strong> {emrData.labs}</p>
                        </div>
                      )}
                      
                      <button onClick={() => setIsNotesModalOpen(true)} style={{ width: '100%', background: 'transparent', border: '1px dashed #00FF88', color: '#00FF88', padding: '10px', marginTop: '20px', cursor: 'pointer', borderRadius: '4px' }}>
                        + ADD CLINICAL NOTE
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: '#006A4E', fontSize: '12px', textAlign: 'center', marginTop: '50px' }}>
                      SELECT AN APPOINTMENT TO VIEW EMR
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIDEO ROOM TAB */}
            {activeTab === 'VIDEO_ROOM' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3 style={{ borderBottom: '1px solid #006A4E', paddingBottom: '10px' }}>SECURE VIDEO CONSULTATION ROOM</h3>
                
                <div style={{ flex: 1, background: '#000', border: '2px solid #006A4E', borderRadius: '8px', position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  
                  {/* LOCAL VIDEO STREAM */}
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: cameraActive ? 1 : 0 }} 
                  />

                  {!cameraActive && (
                    <div style={{ position: 'absolute', color: '#006A4E' }}>
                      CAMERA OFFLINE
                    </div>
                  )}

                  {/* HUD OVERLAY */}
                  {cameraActive && (
                    <div style={{ position: 'absolute', top: '20px', left: '20px', color: '#00FF88', fontSize: '10px', fontWeight: 900, textShadow: '0 0 5px #000' }}>
                      ● LIVE: SECURE WEBRTC TRANSMISSION
                    </div>
                  )}
                </div>
                
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  {!cameraActive ? (
                    <button onClick={startCamera} style={{ background: '#00FF88', color: '#000', padding: '15px 30px', border: 'none', borderRadius: '30px', fontWeight: 900, cursor: 'pointer' }}>
                      ENABLE CAMERA & MIC
                    </button>
                  ) : (
                    <button onClick={stopCamera} style={{ background: '#EF4444', color: '#FFF', padding: '15px 30px', border: 'none', borderRadius: '30px', fontWeight: 900, cursor: 'pointer' }}>
                      END CALL
                    </button>
                  )}
                </div>
                {streamError && <p style={{ color: '#EF4444', textAlign: 'center', fontWeight: 900 }}>{streamError}</p>}
              </div>
            )}

            {/* ROSTER TAB */}
            {activeTab === 'ROSTER' && (
              <div>
                <h3 style={{ borderBottom: '1px solid #006A4E', paddingBottom: '10px' }}>MY DUTY ROSTER (SYNCED WITH HR)</h3>
                <p style={{ fontSize: '11px', color: '#00A86B' }}>Note: Roster changes must be requested through HR Admin as per Miracle HMS Policy.</p>
                <div style={{ marginTop: '20px', background: 'rgba(0,255,136,0.05)', border: '1px solid #006A4E', borderRadius: '8px', padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', borderBottom: '1px solid #006A4E', paddingBottom: '10px', fontWeight: 900 }}>
                    <div>DAY</div>
                    <div>SHIFT</div>
                    <div>WARD / DEPT</div>
                  </div>
                  
                  {roster.length === 0 ? (
                    <div style={{ paddingTop: '15px', color: '#006A4E', textAlign: 'center' }}>No shifts assigned.</div>
                  ) : roster.map((r) => (
                    <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', paddingTop: '15px', color: '#00FF88' }}>
                      <div>{r.day}</div>
                      <div>{r.shift}</div>
                      <div>{r.department}</div>
                    </div>
                  ))}
                  
                </div>
              </div>
            )}

            {/* CLINICAL NOTE MODAL */}
            {isNotesModalOpen && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,10,5,0.95)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ background: '#021008', border: '1px solid #00FF88', padding: '30px', borderRadius: '8px', width: '500px' }}>
                  <h2 style={{ margin: '0 0 20px 0', color: '#00FF88' }}>ADD CLINICAL NOTE (SOAP)</h2>
                  
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#00A86B' }}>Symptoms (Subjective)</label>
                  <textarea 
                    value={clinicalNote.symptoms} 
                    onChange={e => setClinicalNote({...clinicalNote, symptoms: e.target.value})}
                    style={{ width: '100%', background: 'transparent', border: '1px solid #006A4E', color: '#FFF', padding: '10px', marginBottom: '15px', borderRadius: '4px', minHeight: '60px' }} 
                  />
                  
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#00A86B' }}>Examination (Objective)</label>
                  <textarea 
                    value={clinicalNote.examination} 
                    onChange={e => setClinicalNote({...clinicalNote, examination: e.target.value})}
                    style={{ width: '100%', background: 'transparent', border: '1px solid #006A4E', color: '#FFF', padding: '10px', marginBottom: '15px', borderRadius: '4px', minHeight: '60px' }} 
                  />
                  
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#00A86B' }}>Diagnosis / ICD-10 (Assessment)</label>
                  <input 
                    type="text" 
                    value={clinicalNote.diagnosis} 
                    onChange={e => setClinicalNote({...clinicalNote, diagnosis: e.target.value})}
                    style={{ width: '100%', background: 'transparent', border: '1px solid #006A4E', color: '#FFF', padding: '10px', marginBottom: '15px', borderRadius: '4px' }} 
                  />
                  
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#00A86B' }}>Treatment Plan (Plan)</label>
                  <textarea 
                    value={clinicalNote.plan} 
                    onChange={e => setClinicalNote({...clinicalNote, plan: e.target.value})}
                    style={{ width: '100%', background: 'transparent', border: '1px solid #006A4E', color: '#FFF', padding: '10px', marginBottom: '20px', borderRadius: '4px', minHeight: '60px' }} 
                  />
                  
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setIsNotesModalOpen(false)} style={{ background: 'transparent', color: '#888', border: '1px solid #666', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>CANCEL</button>
                    <button onClick={submitClinicalNote} style={{ background: '#00FF88', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 900, cursor: 'pointer' }}>SAVE NOTE</button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
