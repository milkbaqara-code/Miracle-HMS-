// web/app/dashboard/policy/layout.tsx
'use client';
import React from 'react';

export default function PolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section style={{ 
      width: '100%', 
      height: '100%', 
      animation: 'policyEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
      position: 'relative' as const,
      overflow: 'hidden'
    }}>
      {/* GLOBAL POLICY ENGINE MASTER STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes policyEntrance {
          from { opacity: 0; filter: blur(10px); transform: scale(0.95); }
          to { opacity: 1; filter: blur(0px); transform: scale(1); }
        }

        /* Sovereign Scrollbar for Policy Grids */
        .policy-scroll::-webkit-scrollbar { width: 4px; }
        .policy-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        .policy-scroll::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 10px; }

        /* Radioactive Pulse for Hard-Lock Buttons */
        .lock-pulse:active {
          animation: pulse-gold 0.4s ease-out;
        }
        @keyframes pulse-gold {
          0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.7); }
          100% { box-shadow: 0 0 0 20px rgba(212, 175, 55, 0); }
        }

        /* Ghost Input Focus */
        input:focus, textarea:focus {
          border-color: #D4AF37 !important;
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.2);
        }

        /* Range Slider Styling - Dubai Gold */
        input[type=range] {
          -webkit-appearance: none;
          background: #222;
          height: 4px;
          border-radius: 5px;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: #D4AF37;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
        }
      `}} />
      
      {/* Scrollable Policy Content */}
      <div className="policy-scroll" style={{ 
        height: '100%', 
        overflowY: 'auto', 
        paddingRight: '10px',
        perspective: '1000px'
      }}>
        {children}
      </div>
    </section>
  );
}
