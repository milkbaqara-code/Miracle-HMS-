// web/app/dashboard/hr/layout.tsx
'use client';
import React from 'react';

export default function HRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section style={{ 
      width: '100%', 
      height: '100%', 
      animation: 'hrVaultEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
      overflow: 'hidden',
      position: 'relative' // CRITICAL: Unlocks modal Z-Indexing
    }}>
      {/* HUMAN CAPITAL SYSTEM STYLES - AUDITED */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes hrVaultEntrance {
          from { opacity: 0; filter: blur(15px); transform: scale(0.98); }
          to { opacity: 1; filter: blur(0px); transform: scale(1); }
        }

        /* Sovereign Scrollbar - SYNCED TO PAGE.TSX */
        .hr-viewport-scroll::-webkit-scrollbar { width: 4px; }
        .hr-viewport-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        .hr-viewport-scroll::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 20px; }

        /* Performance Row Highlighting */
        .performance-row:hover {
          background: rgba(0, 255, 136, 0.05) !important;
          transition: background 0.3s ease;
        }

        /* Registry Surgery Focus Glow */
        input:focus, select:focus, textarea:focus {
          border-color: #D4AF37 !important;
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.2);
          outline: none;
        }

        /* Biometric Card Kinetic Lift */
        .staff-card-master {
          transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1) !important;
        }
        .staff-card-master:hover {
          transform: translateY(-10px) scale(1.02) !important;
          border-color: #D4AF37 !important;
          box-shadow: 0 15px 30px rgba(0,0,0,0.5);
        }
      `}} />
      
      {/* Main HR Viewport */}
      <div className="hr-viewport-scroll" style={{ 
        height: '100%', 
        overflowY: 'auto', 
        paddingRight: '10px',
        perspective: '1200px' // High-tier depth rendering
      }}>
        {children}
      </div>
    </section>
  );
}
