// web/app/dashboard/issue-tickets/layout.tsx
'use client';
import React from 'react';

export default function IssueTicketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section 
      style={{ 
        width: '100%', 
        height: '100%', 
        animation: 'dispatchBoot 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* ==========================================
          ZONE 16 DISPATCH STYLES (UN-SHRUNK)
          ========================================== */}
      <style dangerouslySetInnerHTML={{__html: `
        /* --- 1. TERMINAL BOOT ANIMATION --- */
        /* Simulates a high-priority communication terminal powering on */
        @keyframes dispatchBoot {
          from { 
            opacity: 0; 
            transform: translateY(-10px); 
            filter: brightness(1.5) contrast(1.2); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
            filter: brightness(1) contrast(1); 
          }
        }

        /* --- 2. TACTICAL SCROLLBAR --- */
        /* Keeps the UI clean and aligned with the OS aesthetic */
        .dispatch-viewport::-webkit-scrollbar { 
          width: 5px; 
        }
        .dispatch-viewport::-webkit-scrollbar-track { 
          background: rgba(0,0,0,0.2); 
        }
        .dispatch-viewport::-webkit-scrollbar-thumb { 
          background: #D4AF37; 
          border-radius: 10px; 
        }
        
        /* --- 3. HARDWARE ACCELERATION FOR MOBILE DISPATCH --- */
        .dispatch-viewport {
          -webkit-overflow-scrolling: touch;
        }

        /* --- 4. PRINT SHIELD FOR DISPATCH TICKETS --- */
        /* If an operative needs to physically print a work order */
        @media print {
          body * { visibility: hidden; }
          .dispatch-viewport, .dispatch-viewport * { visibility: visible; }
          .dispatch-viewport {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}} />
      
      {/* --- MAIN DISPATCH VIEWPORT --- */}
      <div 
        className="dispatch-viewport" 
        style={{ 
          height: '100%', 
          overflowY: 'auto', 
          paddingRight: '10px',
          paddingBottom: '40px' /* Prevents bottom elements from hugging the screen edge */
        }}
      >
        {children}
      </div>
    </section>
  );
}
