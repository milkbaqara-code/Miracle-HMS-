'use client';
import React, { useState } from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';

interface TrainingModule {
  id: string;
  title: string;
  category: string;
  duration: string;
  progress: number;
}

export default function MedicalEducationPage() {
  const isViewMode = useViewMode();

  const [modules, setModules] = useState<TrainingModule[]>([
    { id: 'EDU-01', title: 'Advanced Cardiac Life Support (ACLS)', category: 'Emergency Medicine', duration: '4 Hours', progress: 80 },
    { id: 'EDU-02', title: 'Sterile Field Setup & Aseptic Techniques', category: 'Surgical Operations', duration: '2 Hours', progress: 100 },
    { id: 'EDU-03', title: 'Electronic Health Record (EHR) SOAP Standards', category: 'Clinical Documentation', duration: '1 Hour', progress: 40 },
    { id: 'EDU-04', title: 'Hospital Infection Control & Sanitation', category: 'General Protocols', duration: '2.5 Hours', progress: 0 }
  ]);

  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(modules[0]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({ 'EDU-02': true });

  const handleStudy = (modId: string) => {
    setModules(prev => prev.map(m => {
      if (m.id === modId) {
        const nextProgress = Math.min(100, m.progress + 20);
        if (nextProgress === 100) {
          setCompleted(c => ({ ...c, [modId]: true }));
        }
        const updated = { ...m, progress: nextProgress };
        if (selectedModule && selectedModule.id === modId) {
          setSelectedModule(updated);
        }
        return updated;
      }
      return m;
    }));
  };

  return (
    <div style={containerStyle}>
      <ViewModeBanner />

      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>📚 MEDICAL EDUCATION LAB</h1>
          <p style={subtitleStyle}>CLINICAL TRAINING COURSES, SURGICAL CERTIFICATIONS, & CPD TRACKING</p>
        </div>
      </div>

      <div style={layoutGrid}>
        
        {/* LEFT COLUMN: MODULE LIST */}
        <div style={glassPanel}>
          <h2 style={sectionTitle}>Interactive Training Curriculum</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {modules.map(m => {
              const isComp = completed[m.id];
              return (
                <div 
                  key={m.id} 
                  onClick={() => setSelectedModule(m)}
                  style={cardStyle(selectedModule?.id === m.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#9cf', fontWeight: 'bold' }}>{m.category}</span>
                    <span style={{ fontSize: '11px', color: isComp ? '#10b981' : '#aaa' }}>
                      {isComp ? '✓ CERTIFIED' : `${m.progress}% COMPLETE`}
                    </span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>{m.title}</div>
                  
                  {/* PROGRESS BAR */}
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
                    <div style={{ width: `${m.progress}%`, height: '100%', background: isComp ? '#10b981' : '#3b82f6', borderRadius: '3px', transition: '0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: MODULE CONTENT AND STUDY STATION */}
        <div style={glassPanel}>
          {selectedModule ? (
            <div>
              <h2 style={sectionTitle}>CPD Study Station</h2>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
                {selectedModule.title}
              </div>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '20px' }}>
                Course Code: {selectedModule.id} | Duration: {selectedModule.duration}
              </div>

              <div style={studyContentStyle}>
                <h4 style={{ color: '#39FF14', margin: '0 0 10px 0' }}>Course Syllabus Highlights</h4>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#ccc' }}>
                  This training unit covers the regulatory standards, execution procedures, and safety checklists for {selectedModule.title.toLowerCase()}. Clinical personnel must review all modules and complete the assessment to receive continuous professional development (CPD) credits.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '25px' }}>
                <button 
                  style={actionBtn} 
                  onClick={() => handleStudy(selectedModule.id)}
                  disabled={completed[selectedModule.id]}
                >
                  {completed[selectedModule.id] ? '✓ TRAINING COMPLETED' : '📖 STUDY CURRENT SECTION (+20%)'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '50px' }}>
              Select a training module from the curriculum to launch the study station.
            </div>
          )}
        </div>

      </div>
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
  marginBottom: '25px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#3b82f6',
  textShadow: '0 0 10px rgba(59, 130, 246, 0.2)',
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
  gridTemplateColumns: '1.1fr 1fr',
  gap: '30px',
};

const glassPanel: React.CSSProperties = {
  background: 'rgba(16, 24, 48, 0.45)',
  border: '1px solid rgba(59, 130, 246, 0.15)',
  boxShadow: '0 0 20px rgba(59, 130, 246, 0.02)',
  borderRadius: '16px',
  padding: '24px',
  backdropFilter: 'blur(10px)',
};

const sectionTitle: React.CSSProperties = {
  color: '#3b82f6',
  fontSize: '16px',
  fontWeight: 'bold',
  marginTop: 0,
  marginBottom: '20px',
};

const cardStyle = (active: boolean): React.CSSProperties => {
  return {
    background: active ? 'rgba(59, 130, 246, 0.1)' : 'rgba(5, 8, 16, 0.4)',
    padding: '16px',
    borderRadius: '10px',
    border: `1px solid ${active ? '#3b82f6' : 'rgba(59, 130, 246, 0.1)'}`,
    cursor: 'pointer',
    transition: '0.2s'
  };
};

const studyContentStyle: React.CSSProperties = {
  background: 'rgba(5, 8, 16, 0.5)',
  padding: '16px',
  borderRadius: '8px',
  borderLeft: '4px solid #3b82f6'
};

const actionBtn: React.CSSProperties = {
  width: '100%',
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '12px',
  fontWeight: 'bold',
  fontSize: '12px',
  cursor: 'pointer',
  boxShadow: '0 0 10px rgba(59, 130, 246, 0.2)'
};
