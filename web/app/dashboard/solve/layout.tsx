// web/app/dashboard/solve/layout.tsx
'use client';
import React from 'react';

export default function SolveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section 
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#020202',
        /* CRT Scanline & Radar Grid Overlay */
        backgroundImage: `
          linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%),
          linear-gradient(90deg, rgba(212, 175, 55, 0.01) 1px, transparent 1px),
          linear-gradient(rgba(212, 175, 55, 0.01) 1px, transparent 1px)
        `,
        backgroundSize: '100% 4px, 50px 50px, 50px 50px'
      }}
    >
      {/* ==========================================
          ZONE 16: TACTICAL HUD STYLES
          ========================================== */}
      <style dangerouslySetInnerHTML={{__html: `
        /* --- 1. THE RADAR SWEEP EFFECT --- */
        @keyframes sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .radar-sweep-layer {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(from 0deg, transparent, rgba(0, 242, 255, 0.03), transparent);
          animation: sweep 10s linear infinite;
          pointer-events: none;
          z-index: 1;
        }

        /* --- 2. MISSION ENTRY ANIMATION --- */
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); filter: blur(10px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0px); }
        }

        .solve-viewport {
          position: relative;
          z-index: 10;
          animation: slideInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* --- 3. TACTICAL SCROLLBAR (RED ALERT) --- */
        .solve-viewport::-webkit-scrollbar { 
          width: 4px; 
        }
        .solve-viewport::-webkit-scrollbar-track { 
          background: #000; 
        }
        .solve-viewport::-webkit-scrollbar-thumb { 
          background: #FF3131; 
          box-shadow: 0 0 10px #FF3131;
        }

        /* --- 4. CRITICAL STATUS PERIMETER --- */
        /* Pulses red when a .pulse-alert class is active in the child page */
        .solve-viewport:has(.pulse-alert) {
          outline: 2px solid rgba(255, 49, 49, 0.2);
          outline-offset: -2px;
          box-shadow: inset 0 0 100px rgba(255, 49, 49, 0.1);
        }
      `}} />

      {/* AMBIENT LAYERS */}
      <div className="radar-sweep-layer" />
      
      {/* --- MASTER MISSION VIEWPORT --- */}
      <div 
        className="solve-viewport" 
        style={{ 
          height: '100%', 
          overflowY: 'auto', 
          padding: '20px 0',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div style={{ maxWidth: '1700px', margin: '0 auto', padding: '0 20px' }}>
          {children}
        </div>
      </div>

      {/* BOTTOM STATUS BAR (OS PERSISTENCE) */}
      <div style={bottomBar}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <span style={statusLed('#00FF88')} />
          <span style={{ fontSize: '9px', fontWeight: 900, color: '#555', letterSpacing: '2px' }}>
            ZONE 16 KERNEL: ACTIVE
          </span>
        </div>
        <div style={{ fontSize: '9px', fontWeight: 900, color: '#333' }}>
          MIRACLE HMS v26.8 // REGIONAL RADAR STABLE
        </div>
      </div>
    </section>
  );
}

// --- TACTICAL STYLES ---
const bottomBar = {
  position: 'absolute' as const,
  bottom: 0,
  left: 0,
  right: 0,
  height: '30px',
  background: 'rgba(0,0,0,0.8)',
  borderTop: '1px solid #111',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0 25px',
  zIndex: 100
};

const statusLed = (color: string) => ({
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: color,
  boxShadow: `0 0 10px ${color}`
});
