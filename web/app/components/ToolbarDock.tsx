'use client';
// ============================================================
// TOOLBAR DOCK — MIRACLE HMS V1.0
// Floating launcher for Calendar + Calculator
// ============================================================
import { useState, useEffect } from 'react';
import SovereignCalendar from './SovereignCalendar';
import SovereignCalculator from './SovereignCalculator';

export default function ToolbarDock() {
  const [showCal, setShowCal] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [currentDate, setCurrentDate] = useState('00');

  useEffect(() => {
    setCurrentDate(new Date().getDate().toString().padStart(2, '0'));
  }, []);

  return (
    <>
      <div style={dockStyle}>
        {/* 🔥 DYNAMIC NEON CALENDAR */}
        <div 
          className="neon-calendar-btn"
          onClick={() => setShowCal(true)}
          title="Open Sovereign Calendar"
        >
          <div className="neon-calendar-header">
            <div className="neon-calendar-hole" />
            <div className="neon-calendar-hole" />
          </div>
          <div className="neon-calendar-body">
            <span className="neon-calendar-date">{currentDate}</span>
          </div>
        </div>

        <div style={divider} />
        
        <button
          id="toolbar-calculator-btn"
          style={iconBtnStyle('#00F2FF')}
          onClick={() => setShowCalc(true)}
          title="Open Calculator"
        >
          <span style={{ fontSize: '18px' }}>🧮</span>
        </button>
      </div>

      {showCal && <SovereignCalendar onClose={() => setShowCal(false)} />}
      {showCalc && <SovereignCalculator onClose={() => setShowCalc(false)} />}

      <style dangerouslySetInnerHTML={{ __html: `
        #toolbar-calendar-btn:hover, #toolbar-calculator-btn:hover {
          transform: scale(1.15) !important;
          filter: brightness(1.3);
        }
      ` }} />
    </>
  );
}

const dockStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  background: 'rgba(10,10,15,0.85)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  padding: '5px 8px',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

const iconBtnStyle = (glowColor: string): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
  filter: `drop-shadow(0 0 4px ${glowColor}44)`,
});

const divider: React.CSSProperties = {
  width: '1px',
  height: '20px',
  background: 'rgba(255,255,255,0.08)',
  margin: '0 2px',
};
