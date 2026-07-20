'use client';
import React, { useState, useEffect, useCallback } from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import UniversalCashierPOS from '../../components/UniversalPOS';

interface DietaryMeal {
  id: string;
  bed_id: string;
  patient_name: string;
  diet_type: string;
  meal_period: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  notes: string;
  status: 'PENDING' | 'PREPARED' | 'DELIVERED';
}

export default function DietaryMealsPage() {
  const isViewMode = useViewMode();
  
  const [beds, setBeds] = useState<any[]>([]);
  const [dietaryLogs, setDietaryLogs] = useState<DietaryMeal[]>([
    { id: 'DT-01', bed_id: 'CABIN-01', patient_name: 'Arthur Dent', diet_type: 'Liquid Diet Only', meal_period: 'LUNCH', notes: 'Post-op observation', status: 'DELIVERED' },
    { id: 'DT-02', bed_id: 'ICU-01', patient_name: 'Ford Prefect', diet_type: 'Low Sodium / Diabetic', meal_period: 'DINNER', notes: 'Monitor blood sugar before serving', status: 'PENDING' },
    { id: 'DT-03', bed_id: 'WARD-02', patient_name: 'Trillian Astra', diet_type: 'Regular Diet', meal_period: 'DINNER', notes: 'No sea food allergies', status: 'PREPARED' }
  ]);

  // Form State
  const [selectedBed, setSelectedBed] = useState('');
  const [dietType, setDietType] = useState('REGULAR');
  const [mealPeriod, setMealPeriod] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER'>('LUNCH');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentSection, setCurrentSection] = useState<'dietary' | 'billing'>('dietary');

  const fetchBeds = useCallback(async () => {
    try {
      const res = await fetch('/api/frontdesk/live-grid');
      if (res.ok) {
        const json = await res.json();
        setBeds((json.data || json).filter((b: any) => b.status === 'IN-HOUSE'));
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchBeds();
  }, [fetchBeds]);

  const handleAssignMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed || !dietType) return;

    setSubmitting(true);
    const targetBedObj = beds.find(b => b.id === selectedBed);
    const newLog: DietaryMeal = {
      id: `DT-${Math.floor(100 + Math.random() * 900)}`,
      bed_id: selectedBed,
      patient_name: targetBedObj ? targetBedObj.guest : 'Inpatient',
      diet_type: dietType,
      meal_period: mealPeriod,
      notes,
      status: 'PENDING'
    };

    setDietaryLogs([newLog, ...dietaryLogs]);
    setSelectedBed('');
    setNotes('');
    setSubmitting(false);
  };

  const handleUpdateStatus = (id: string, nextStatus: 'PREPARED' | 'DELIVERED') => {
    setDietaryLogs(prev => prev.map(log => log.id === id ? { ...log, status: nextStatus } : log));
  };

  return (
    <div style={containerStyle}>
      <ViewModeBanner />

      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>🍱 PATIENT DIETARY & MEALS</h1>
          <p style={subtitleStyle}>INPATIENT DIETETICS, NUTRITION PLANS, & MEAL PREPARATION DIRECTIVES</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            style={{
              ...btnStyle,
              background: currentSection === 'dietary' ? '#ffc107' : 'rgba(255, 193, 7, 0.15)',
              color: currentSection === 'dietary' ? '#000' : '#ffc107'
            }} 
            onClick={() => setCurrentSection('dietary')}
          >
            📋 DIETARY DIRECTIVES
          </button>
          <button 
            style={{
              ...btnStyle,
              background: currentSection === 'billing' ? '#ffc107' : 'rgba(255, 193, 7, 0.15)',
              color: currentSection === 'billing' ? '#000' : '#ffc107'
            }} 
            onClick={() => setCurrentSection('billing')}
          >
            💸 DIETARY RECEPTION POS
          </button>
          <button style={btnStyle} onClick={fetchBeds}>🔄 REFRESH WARD LIST</button>
        </div>
      </div>

      {currentSection === 'billing' ? (
        <UniversalCashierPOS 
          fixedTerminal="Z-29-GASTRONOMY" 
          fixedTitle="PATIENT DIETARY & MEALS RECEPTION" 
          fixedSubtitle="WARD FOOD SERVICE & NUTRITIONAL ITEMS TILL" 
        />
      ) : (
        <div style={layoutGrid}>
          
          {/* LEFT COLUMN: MEAL QUEUE */}
          <div style={glassPanel}>
            <h2 style={sectionTitle}>Therapeutic Meal Orders Queue</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {dietaryLogs.map(log => (
                <div key={log.id} style={cardStyle(log.status)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>📍 Bed {log.bed_id}</span>
                    <span style={statusBadgeStyle(log.status)}>{log.status}</span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>Patient: {log.patient_name}</div>
                  <div style={{ fontSize: '12px', color: '#ffc107', margin: '4px 0', fontWeight: 'bold' }}>
                    Diet: {log.diet_type} ({log.meal_period})
                  </div>
                  {log.notes && <div style={{ fontSize: '11px', color: '#aaa', fontStyle: 'italic', marginTop: '4px' }}>Note: {log.notes}</div>}
                  
                  {log.status === 'PENDING' && (
                    <button style={actionSubBtn('#ffc107', '#000')} onClick={() => handleUpdateStatus(log.id, 'PREPARED')}>
                      MARK PREPARED BY KITCHEN
                    </button>
                  )}
                  {log.status === 'PREPARED' && (
                    <button style={actionSubBtn('#10b981', '#fff')} onClick={() => handleUpdateStatus(log.id, 'DELIVERED')}>
                      MARK DELIVERED TO WARD
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: ASSIGN FORM */}
          <div style={glassPanel}>
            <h2 style={sectionTitle}>Assign Therapeutic Diet Plan</h2>
            <form onSubmit={handleAssignMeal}>
              <div style={inputGroup}>
                <label style={labelStyle}>Select Patient Ward/Bed</label>
                <select style={inputStyle} value={selectedBed} onChange={e => setSelectedBed(e.target.value)} required>
                  <option value="">-- Choose Admitted Patient --</option>
                  {beds.map(b => (
                    <option key={b.id} value={b.id}>Bed {b.id} - {b.guest}</option>
                  ))}
                </select>
              </div>

              <div style={inputGroup}>
                <label style={labelStyle}>Dietary Protocol / Restriction</label>
                <select style={inputStyle} value={dietType} onChange={e => setDietType(e.target.value)} required>
                  <option value="REGULAR">REGULAR NUTRITION DIET</option>
                  <option value="DIABETIC">LOW GLYCEMIC / DIABETIC DIET</option>
                  <option value="LOW_SODIUM">CARDIAC / LOW SODIUM DIET</option>
                  <option value="LIQUID">LIQUID DIET ONLY</option>
                  <option value="SOFT">SOFT/PUREE CONGESTIVE DIET</option>
                  <option value="NPO">NPO (NIL PER OS - FASTING)</option>
                </select>
              </div>

              <div style={inputGroup}>
                <label style={labelStyle}>Meal Schedule Period</label>
                <select style={inputStyle} value={mealPeriod} onChange={e => setMealPeriod(e.target.value as any)} required>
                  <option value="BREAKFAST">🌅 BREAKFAST SERVICE</option>
                  <option value="LUNCH">☀️ LUNCH SERVICE</option>
                  <option value="DINNER">🌙 DINNER SERVICE</option>
                </select>
              </div>

              <div style={inputGroup}>
                <label style={labelStyle}>Dietary Kitchen Notes</label>
                <textarea 
                  style={{ ...inputStyle, minHeight: '80px', fontFamily: 'inherit' }} 
                  placeholder="e.g. Allergen alerts, fluid limits, specific serving instructions..." 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                />
              </div>

              <button type="submit" style={actionBtn} disabled={submitting}>
                {submitting ? 'PROCESSING...' : 'DISPATCH MEAL ORDER'}
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}

// Styling definitions
const containerStyle: React.CSSProperties = {
  padding: '30px',
  color: '#fff',
  fontFamily: 'system-ui, sans-serif',
  background: 'transparent',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '25px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#ffc107',
  textShadow: '0 0 10px rgba(255, 193, 7, 0.2)',
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  margin: '5px 0 0 0',
  fontSize: '11px',
  color: '#aaa',
  letterSpacing: '1px',
};

const btnStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: 'rgba(255, 193, 7, 0.15)',
  border: '1px solid #ffc107',
  color: '#ffc107',
  borderRadius: '8px',
  fontSize: '11px',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: '0.3s',
};

const layoutGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.1fr 1fr',
  gap: '30px',
};

const glassPanel: React.CSSProperties = {
  background: 'rgba(16, 24, 48, 0.45)',
  border: '1px solid rgba(255, 193, 7, 0.15)',
  boxShadow: '0 0 20px rgba(255, 193, 7, 0.02)',
  borderRadius: '16px',
  padding: '24px',
  backdropFilter: 'blur(10px)',
};

const sectionTitle: React.CSSProperties = {
  color: '#ffc107',
  fontSize: '16px',
  fontWeight: 'bold',
  marginTop: 0,
  marginBottom: '20px',
};

const cardStyle = (status: string): React.CSSProperties => {
  let borderCol = 'rgba(255,255,255,0.05)';
  if (status === 'PREPARED') borderCol = '#ffc107';
  if (status === 'DELIVERED') borderCol = '#10b981';
  return {
    background: 'rgba(5, 8, 16, 0.4)',
    padding: '16px',
    borderRadius: '10px',
    borderLeft: `4px solid ${borderCol}`,
    borderTop: '1px solid rgba(255,255,255,0.05)',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  };
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  let bg = 'rgba(255,255,255,0.05)';
  let color = '#888';
  if (status === 'PENDING') {
    bg = 'rgba(255, 49, 49, 0.15)';
    color = '#FF3131';
  } else if (status === 'PREPARED') {
    bg = 'rgba(255, 193, 7, 0.15)';
    color = '#ffc107';
  } else if (status === 'DELIVERED') {
    bg = 'rgba(16, 185, 129, 0.15)';
    color = '#10b981';
  }
  return {
    fontSize: '9px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '4px',
    background: bg,
    color,
    border: `1px solid ${color}`
  };
};

const actionSubBtn = (color: string, textColor: string): React.CSSProperties => ({
  width: '100%',
  marginTop: '12px',
  background: color,
  color: textColor,
  border: 'none',
  borderRadius: '6px',
  padding: '6px',
  fontSize: '11px',
  fontWeight: 'bold',
  cursor: 'pointer'
});

const inputGroup: React.CSSProperties = {
  marginBottom: '15px',
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
  border: '1px solid rgba(255, 193, 7, 0.2)',
  borderRadius: '8px',
  padding: '10px',
  color: '#fff',
  outline: 'none',
  fontSize: '13px',
};

const actionBtn: React.CSSProperties = {
  width: '100%',
  background: '#ffc107',
  color: '#050810',
  border: 'none',
  borderRadius: '8px',
  padding: '12px',
  fontWeight: 'bold',
  fontSize: '12px',
  cursor: 'pointer',
  marginTop: '10px',
};
