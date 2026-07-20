// web/app/dashboard/checkout/layout.tsx
'use client';
import React from 'react';

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section 
      style={{ 
        width: '100%', 
        height: '100%', 
        animation: 'folioPowerUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* ==========================================
          5-STAR SETTLEMENT SYSTEM STYLES (UN-SHRUNK)
          ========================================== */}
      <style dangerouslySetInnerHTML={{__html: `
        /* --- 1. ENTRANCE ANIMATION --- */
        @keyframes folioPowerUp {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
            filter: contrast(1.2); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
            filter: contrast(1); 
          }
        }

        /* --- 2. LUXURY FINANCIAL SCROLLBAR --- */
        .folio-viewport::-webkit-scrollbar { 
          width: 5px; 
        }
        .folio-viewport::-webkit-scrollbar-track { 
          background: rgba(0,0,0,0.2); 
        }
        .folio-viewport::-webkit-scrollbar-thumb { 
          background: #D4AF37; 
          border-radius: 10px; 
        }

        /* --- 3. 3D DESK HOVER EXPERIENCE --- */
        /* This simulates picking up a physical paper folio from the desk */
        .paper-reveal {
          transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.6s;
          transform-origin: top center;
        }
        
        .paper-reveal:hover {
          transform: rotateX(2deg) translateY(-5px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.8) !important;
        }

        /* --- 4. AUDITOR LEDGER HIGHLIGHTING --- */
        tbody tr:hover td {
          background: rgba(212, 175, 55, 0.05);
          transition: background-color 0.2s ease;
        }

        /* ==========================================
           5. BULLETPROOF A4 PRINT PROTOCOL 
           ========================================== */
        @media print {
          /* Step A: Hide the entire application by default */
          body * {
            visibility: hidden;
          }
          
          /* Step B: Un-hide ONLY the paper folio and its children */
          .paper-reveal, .paper-reveal * {
            visibility: visible;
          }
          
          /* Step C: Snap the folio to the absolute top-left of the printer paper */
          .paper-reveal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            transform: none !important;
          }

          /* Step D: Force the printer to print the Black & Gold UI elements */
          /* Without this, Chrome/Edge will make the "Net Balance" box white */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Step E: Define physical paper size and kill digital scrollbars */
          @page { 
            size: A4 portrait; 
            margin: 1cm; 
          }
          .folio-viewport { 
            overflow: visible !important; 
          }
        }
      `}} />
      
      {/* --- MAIN CHECKOUT VIEWPORT --- */}
      <div 
        className="folio-viewport" 
        style={{ 
          height: '100%', 
          overflowY: 'auto', 
          paddingRight: '10px',
          perspective: '1500px' /* Required to make the 3D rotateX paper effect work */
        }}
      >
        {children}
      </div>
    </section>
  );
}
