// web/app/dashboard/pos/layout.tsx
'use client';
import React from 'react';

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section style={{ 
      width: '100%', 
      height: '100%', 
      animation: 'posTerminalBoot 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* ==========================================
          SOVEREIGN POS HARDWARE STYLES - MULTI-TERMINAL
          ========================================== */}
      <style dangerouslySetInnerHTML={{__html: `
        /* 1. Hardware Boot Animation */
        @keyframes posTerminalBoot {
          from { opacity: 0; transform: scale(1.02); filter: brightness(1.5) contrast(1.2); }
          to { opacity: 1; transform: scale(1); filter: brightness(1) contrast(1); }
        }

        /* 2. High-Density Viewport Scrollbar */
        .pos-viewport::-webkit-scrollbar { width: 4px; }
        .pos-viewport::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .pos-viewport::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 10px; }

        /* 3. Global Haptic Interlock for Touch Screens */
        button:active, .product-card:active {
          transform: scale(0.97) translateY(2px) !important;
          filter: brightness(1.3);
          transition: 0.1s !important;
        }

        /* ==========================================
           4. THERMAL PRINTER PROTOCOL (KOT/RECEIPTS)
           ========================================== */
        @media print {
          /* Hide the dashboard sidebar, headers, config tabs, and UI controls */
          aside, header, footer, button, input, select, .no-print {
            display: none !important;
          }
          
          /* Force pure black and white for 80mm thermal paper */
          body, main, section, .pos-viewport {
            background: white !important;
            color: black !important;
            overflow: visible !important;
            height: auto !important;
            width: 80mm !important; /* Standard Thermal Receipt Width */
          }
          
          /* KOT IMAGE SHIELD: Prevent WebP images from jamming the thermal printer */
          img {
             display: none !important;
          }
          
          /* Reveal only the printable receipt/KOT payload */
          .thermal-print-payload {
            display: block !important;
            font-family: 'Courier New', monospace !important;
            font-size: 12px !important;
          }
        }
      `}} />
      
      {/* Main Container protecting the unified POS + Config Lab */}
      <div className="pos-viewport" style={{ 
        height: '100%', 
        overflowY: 'auto', 
        paddingRight: '10px'
      }}>
        {children}
      </div>
    </section>
  );
}
