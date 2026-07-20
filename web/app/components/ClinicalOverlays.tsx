import React, { useState, useEffect } from 'react';

// --- STYLES (GLASS OPTIMIZED MEDIC THEME) ---
const overlayContainer: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(5, 8, 16, 0.85)',
  backdropFilter: 'blur(12px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  color: '#fff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const glassPanel: React.CSSProperties = {
  background: 'rgba(16, 24, 48, 0.45)',
  border: '1px solid rgba(16, 185, 129, 0.25)',
  boxShadow: '0 0 30px rgba(16, 185, 129, 0.1), inset 0 0 20px rgba(16, 185, 129, 0.05)',
  borderRadius: '16px',
  padding: '30px',
  width: '100%',
  maxWidth: '650px',
  maxHeight: '90vh',
  overflowY: 'auto',
  position: 'relative',
};

const consultPanel: React.CSSProperties = {
  ...glassPanel,
  maxWidth: '1100px',
  display: 'grid',
  gridTemplateColumns: '1fr 1.5fr',
  gap: '24px',
};

const closeBtn: React.CSSProperties = {
  position: 'absolute',
  top: '20px',
  right: '20px',
  background: 'transparent',
  border: 'none',
  color: '#888',
  fontSize: '24px',
  cursor: 'pointer',
};

const sectionTitle: React.CSSProperties = {
  color: '#10b981',
  textShadow: '0 0 8px rgba(16, 185, 129, 0.3)',
  fontSize: '20px',
  fontWeight: 'bold',
  marginBottom: '20px',
  borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
  paddingBottom: '8px',
};

const inputGroup: React.CSSProperties = {
  marginBottom: '15px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  color: '#9ca3af',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(5, 8, 16, 0.6)',
  border: '1px solid rgba(16, 185, 129, 0.2)',
  borderRadius: '8px',
  padding: '10px 14px',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: '80px',
  resize: 'vertical',
};

const actionBtn: React.CSSProperties = {
  background: '#10b981',
  color: '#050810',
  border: 'none',
  borderRadius: '8px',
  padding: '12px 24px',
  fontWeight: 'bold',
  fontSize: '14px',
  cursor: 'pointer',
  boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
  transition: 'all 0.2s',
  width: '100%',
  marginTop: '10px',
};

const secondaryBtn: React.CSSProperties = {
  ...actionBtn,
  background: 'rgba(255, 49, 49, 0.15)',
  color: '#ff3131',
  border: '1px solid rgba(255, 49, 49, 0.3)',
  boxShadow: 'none',
};

// ==========================================
// 1. NURSE TRIAGE: VITALS MODAL
// ==========================================
export function VitalsModal({ bedId, onClose, onRefresh }: { bedId: string; onClose: () => void; onRefresh: () => void }) {
  const [hr, setHr] = useState('');
  const [bp, setBp] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/hms/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: bedId, // Mapped to the bed id initially
          heart_rate: hr ? parseInt(hr) : null,
          blood_pressure: bp || null,
          temperature: temp ? parseFloat(temp) : null,
          spo2: spo2 ? parseInt(spo2) : null,
          weight_kg: weight ? parseFloat(weight) : null
        })
      });
      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        alert("Failed to save vitals. Check if patient check-in exists.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayContainer}>
      <div style={glassPanel}>
        <button style={closeBtn} onClick={onClose}>&times;</button>
        <div style={sectionTitle}>🩺 NURSE TRIAGE | BED: {bedId}</div>
        <form onSubmit={handleSubmit}>
          <div style={inputGroup}>
            <label style={labelStyle}>Blood Pressure (mmHg)</label>
            <input style={inputStyle} type="text" placeholder="e.g. 120/80" value={bp} onChange={e => setBp(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={inputGroup}>
              <label style={labelStyle}>Pulse (bpm)</label>
              <input style={inputStyle} type="number" placeholder="e.g. 72" value={hr} onChange={e => setHr(e.target.value)} />
            </div>
            <div style={inputGroup}>
              <label style={labelStyle}>SpO2 (%)</label>
              <input style={inputStyle} type="number" placeholder="e.g. 98" value={spo2} onChange={e => setSpo2(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={inputGroup}>
              <label style={labelStyle}>Temperature (°C)</label>
              <input style={inputStyle} type="number" step="0.1" placeholder="e.g. 36.8" value={temp} onChange={e => setTemp(e.target.value)} />
            </div>
            <div style={inputGroup}>
              <label style={labelStyle}>Weight (kg)</label>
              <input style={inputStyle} type="number" step="0.1" placeholder="e.g. 70" value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
          </div>
          <button style={actionBtn} type="submit" disabled={loading}>{loading ? 'LOGGING...' : 'SAVE TRIAGE VITALS'}</button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. DOCTOR CONSULTATION DESK (SOAP NOTES)
// ==========================================
export function ConsultDesk({ patient, inventory, onClose, onRefresh }: {
  patient: { bedId: string; name: string };
  inventory: any[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const [symptoms, setSymptoms] = useState('');
  const [examination, setExamination] = useState('');
  const [icd10, setIcd10] = useState('');
  const [plan, setPlan] = useState('');
  
  // E-Prescription fields
  const [selectedDrug, setSelectedDrug] = useState('');
  const [dosage, setDosage] = useState('1 Tablet');
  const [frequency, setFrequency] = useState('Once daily (OD)');
  const [duration, setDuration] = useState('7');
  const [prescriptionsList, setPrescriptionsList] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load vitals history for this patient/bed
    fetch(`/api/hms/vitals/${patient.bedId}`)
      .then(res => res.json())
      .then(json => {
        if (json.status === 'SUCCESS') setVitalsHistory(json.data);
      })
      .catch(err => console.error("Error loading vitals:", err));
  }, [patient.bedId]);

  const addPrescription = () => {
    if (!selectedDrug) return;
    const drugItem = inventory.find(i => i.product_id === selectedDrug || i.name === selectedDrug);
    setPrescriptionsList([...prescriptionsList, {
      product_id: drugItem ? drugItem.product_id : selectedDrug,
      drug_name: drugItem ? drugItem.name : selectedDrug,
      dosage,
      frequency,
      duration_days: parseInt(duration) || 7
    }]);
    setSelectedDrug('');
  };

  const removePrescription = (idx: number) => {
    setPrescriptionsList(prescriptionsList.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hms/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.bedId,
          doctor_id: 'DR-SMITH',
          symptoms,
          examination,
          diagnosis_icd10: icd10,
          treatment_plan: plan,
          prescriptions: prescriptionsList
        })
      });
      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        alert("Failed to submit consultation report.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayContainer}>
      <div style={consultPanel}>
        <button style={closeBtn} onClick={onClose}>&times;</button>
        
        {/* LEFT COLUMN: MEDICAL HISTORY & VITALS FEED */}
        <div style={{ borderRight: '1px solid rgba(16, 185, 129, 0.15)', paddingRight: '20px', overflowY: 'auto', maxHeight: '80vh' }}>
          <div style={sectionTitle}>📋 VITALS LOGS</div>
          {vitalsHistory.length === 0 ? (
            <div style={{ color: '#888', fontSize: '14px' }}>No vitals captured by triage nurse yet.</div>
          ) : (
            vitalsHistory.map((v, i) => (
              <div key={v.id} style={{ background: 'rgba(5, 8, 16, 0.4)', borderRadius: '8px', padding: '12px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '4px' }}>
                  {new Date(v.taken_at).toLocaleTimeString()} ({new Date(v.taken_at).toLocaleDateString()})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
                  <div>BP: <span style={{ color: '#fff', fontWeight: 'bold' }}>{v.blood_pressure || '--'}</span></div>
                  <div>Pulse: <span style={{ color: '#fff', fontWeight: 'bold' }}>{v.heart_rate ? `${v.heart_rate} bpm` : '--'}</span></div>
                  <div>SpO2: <span style={{ color: '#fff', fontWeight: 'bold' }}>{v.spo2 ? `${v.spo2}%` : '--'}</span></div>
                  <div>Temp: <span style={{ color: '#fff', fontWeight: 'bold' }}>{v.temperature ? `${v.temperature}°C` : '--'}</span></div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT COLUMN: SOAP CONSULT FORM & PRESCRIPTION PAD */}
        <div style={{ overflowY: 'auto', maxHeight: '80vh', paddingRight: '10px' }}>
          <div style={sectionTitle}>🩺 CLINICAL SOAP JOURNAL | PATIENT: {patient.name}</div>
          
          <div style={inputGroup}>
            <label style={labelStyle}>Subjective (Symptoms / Chief Complaint)</label>
            <textarea style={textareaStyle} value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="Describe patient complaints..." />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>Objective (Physical Examination / Findings)</label>
            <textarea style={textareaStyle} value={examination} onChange={e => setExamination(e.target.value)} placeholder="Record vitals summary and clinical examinations..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={inputGroup}>
              <label style={labelStyle}>Assessment (ICD-10 Code / Diagnosis)</label>
              <input style={inputStyle} type="text" value={icd10} onChange={e => setIcd10(e.target.value)} placeholder="e.g. J06.9 (URTI)" />
            </div>
            <div style={inputGroup}>
              <label style={labelStyle}>Treatment Plan Summary</label>
              <input style={inputStyle} type="text" value={plan} onChange={e => setPlan(e.target.value)} placeholder="e.g. Bed rest, hydration" />
            </div>
          </div>

          {/* PRESCRIPTION EDITOR */}
          <div style={{ marginTop: '20px', background: 'rgba(5, 8, 16, 0.4)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#10b981', marginBottom: '12px' }}>💊 E-PRESCRIPTION INTEGRATION</div>
            
            <div style={inputGroup}>
              <label style={labelStyle}>Select Medication</label>
              <select style={inputStyle} value={selectedDrug} onChange={e => setSelectedDrug(e.target.value)}>
                <option value="">-- Choose Medicine from Pharmacy Inventory --</option>
                {inventory.map((inv: any) => (
                  <option key={inv.product_id} value={inv.product_id}>{inv.name} (Stock: {inv.stock} {inv.s_unit})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>Dosage</label>
                <input style={inputStyle} type="text" value={dosage} onChange={e => setDosage(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Frequency</label>
                <select style={inputStyle} value={frequency} onChange={e => setFrequency(e.target.value)}>
                  <option value="Once daily (OD)">Once daily (OD)</option>
                  <option value="Twice daily (BID)">Twice daily (BID)</option>
                  <option value="Thrice daily (TID)">Thrice daily (TID)</option>
                  <option value="Four times daily (QID)">Four times daily (QID)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Days</label>
                <input style={inputStyle} type="number" value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
            </div>

            <button style={{ ...actionBtn, padding: '8px 16px', boxShadow: 'none' }} onClick={addPrescription}>+ ADD MEDICINE</button>

            {/* List of active prescriptions */}
            {prescriptionsList.length > 0 && (
              <div style={{ marginTop: '15px' }}>
                <label style={labelStyle}>Prescribed Medications</label>
                {prescriptionsList.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(5, 8, 16, 0.6)', padding: '8px 12px', borderRadius: '6px', marginBottom: '6px', borderLeft: '3px solid #10b981' }}>
                    <div style={{ fontSize: '13px' }}>
                      <span style={{ fontWeight: 'bold' }}>{p.drug_name}</span> - {p.dosage} | {p.frequency} | {p.duration_days} days
                    </div>
                    <button style={{ background: 'transparent', border: 'none', color: '#ff3131', cursor: 'pointer', fontSize: '16px' }} onClick={() => removePrescription(idx)}>&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button style={{ ...actionBtn, marginTop: '24px' }} onClick={handleSubmit} disabled={loading}>
            {loading ? 'SUBMITTING...' : 'AUTHORIZE MEDICAL CONSULTATION & TRANSMIT'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. PHARMACY DISPENSARY QUEUE
// ==========================================
export function PharmacyQueue({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPrescriptions = () => {
    fetch('/api/hms/prescriptions')
      .then(res => res.json())
      .then(json => {
        if (json.status === 'SUCCESS') setPrescriptions(json.data);
      })
      .catch(err => console.error("Error loading prescriptions:", err));
  };

  useEffect(() => {
    loadPrescriptions();
  }, []);

  const handleDispense = async (pId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hms/prescriptions/${pId}/dispense`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        loadPrescriptions();
        onRefresh();
      } else {
        alert(json.detail || "Dispense failed. Check pharmacy stock level.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayContainer}>
      <div style={glassPanel}>
        <button style={closeBtn} onClick={onClose}>&times;</button>
        <div style={sectionTitle}>💊 CENTRAL PHARMACY DISPENSARY QUEUE</div>
        
        {prescriptions.length === 0 ? (
          <div style={{ color: '#888', padding: '20px 0', textAlign: 'center' }}>No pending prescriptions found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {prescriptions.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(5, 8, 16, 0.4)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#10b981', textTransform: 'uppercase' }}>Patient: {p.patient_name}</div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '4px' }}>{p.drug_name}</div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                    Dosage: {p.dosage} | Frequency: {p.frequency} | Duration: {p.duration_days} days
                  </div>
                </div>
                <button
                  style={{ ...actionBtn, width: 'auto', marginTop: 0, padding: '8px 16px', boxShadow: 'none' }}
                  onClick={() => handleDispense(p.id)}
                  disabled={loading}
                >
                  DISPENSE
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ==========================================
// 4. CLINICAL ADT: BED TRANSFER MODAL
// ==========================================
export function ADTTransferModal({
  patientId,
  currentBed,
  bedsList,
  onClose,
  onRefresh
}: {
  patientId: string;
  currentBed: string;
  bedsList: any[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [targetBed, setTargetBed] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter beds that are available and not our current bed
  const availableBeds = bedsList.filter(b => b.status === 'AVAILABLE' && b.id !== currentBed);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBed) return;

    setLoading(true);
    try {
      const res = await fetch('/api/hms/adt/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, target_bed_id: targetBed })
      });
      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        const json = await res.json();
        alert(json.detail || "Transfer failed.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayContainer}>
      <div style={glassPanel}>
        <button style={closeBtn} onClick={onClose}>&times;</button>
        <div style={sectionTitle}>🩺 CLINICAL ADT | TRANSFER PATIENT</div>
        <form onSubmit={handleTransfer}>
          <div style={inputGroup}>
            <label style={labelStyle}>Current Bed Assignment</label>
            <input style={{ ...inputStyle, background: 'rgba(255, 255, 255, 0.05)', color: '#888' }} type="text" value={currentBed} readOnly />
          </div>
          <div style={inputGroup}>
            <label style={labelStyle}>Select Target Clinical Bed</label>
            <select style={inputStyle} value={targetBed} onChange={e => setTargetBed(e.target.value)} required>
              <option value="">-- Choose Available Bed --</option>
              {availableBeds.map(b => (
                <option key={b.id} value={b.id}>{b.id} ({b.type})</option>
              ))}
            </select>
          </div>
          <button style={actionBtn} type="submit" disabled={loading || availableBeds.length === 0}>
            {loading ? 'TRANSFERRING...' : availableBeds.length === 0 ? 'NO AVAILABLE BEDS' : 'CONFIRM PATIENT TRANSFER'}
          </button>
        </form>
      </div>
    </div>
  );
}


// ==========================================
// 5. TPA BILLING: SPLIT SETTLEMENT MODAL
// ==========================================
export function InsuranceSplitModal({
  folioId,
  totalBalance,
  onClose,
  onRefresh
}: {
  folioId: number;
  totalBalance: number;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [provider, setProvider] = useState('');
  const [policyNum, setPolicyNum] = useState('');
  const [coPay, setCoPay] = useState(0.20);
  const [loading, setLoading] = useState(false);

  const patientCashShare = round(totalBalance * coPay, 2);
  const insurerClaimShare = round(totalBalance - patientCashShare, 2);

  function round(num: number, decimals: number) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  const handleSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !policyNum) return;

    setLoading(true);
    try {
      const res = await fetch('/api/hms/billing/split-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio_id: folioId,
          provider_name: provider,
          policy_number: policyNum
        })
      });
      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        alert("Failed to authorize split insurance claim.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayContainer}>
      <div style={glassPanel}>
        <button style={closeBtn} onClick={onClose}>&times;</button>
        <div style={sectionTitle}>💳 INSURANCE TPA | SPLIT SETTLEMENT</div>
        <form onSubmit={handleSplit}>
          <div style={inputGroup}>
            <label style={labelStyle}>Total Invoice Balance</label>
            <input style={{ ...inputStyle, background: 'rgba(255, 255, 255, 0.05)', color: '#D4AF37', fontWeight: 'bold' }} type="text" value={`$${totalBalance.toLocaleString()}`} readOnly />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div style={inputGroup}>
              <label style={labelStyle}>Insurance Provider</label>
              <input style={inputStyle} type="text" placeholder="e.g. Allianz, Bupa" value={provider} onChange={e => setProvider(e.target.value)} required />
            </div>
            <div style={inputGroup}>
              <label style={labelStyle}>Policy / Card Number</label>
              <input style={inputStyle} type="text" placeholder="e.g. POL-99411" value={policyNum} onChange={e => setPolicyNum(e.target.value)} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px', background: 'rgba(5, 8, 16, 0.4)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <span style={labelStyle}>Patient Co-Pay Cash Share (20%)</span>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>${patientCashShare.toLocaleString()}</div>
            </div>
            <div>
              <span style={labelStyle}>Insurer Invoice Claim Share (80%)</span>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#39FF14', marginTop: '4px' }}>${insurerClaimShare.toLocaleString()}</div>
            </div>
          </div>
          <button style={actionBtn} type="submit" disabled={loading}>
            {loading ? 'AUTHORIZING...' : 'AUTHORIZE SPLIT SETTLEMENT & INITIATE CLAIM'}
          </button>
        </form>
      </div>
    </div>
  );
}
