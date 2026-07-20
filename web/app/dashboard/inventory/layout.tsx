// web/app/dashboard/inventory/layout.tsx
'use client';
import React from 'react';

export default function InventoryLayout({
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
        backgroundColor: '#050505',
        /* High-Definition Grid Overlay: Gives a "Blueprint" engineering feel */
        backgroundImage: `
          linear-gradient(rgba(212,175,55,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(212,175,55,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }}
    >
      {/* ==========================================
          ZONE 12: LOGISTICS & KERNEL STYLES
          ========================================== */}
      <style dangerouslySetInnerHTML={{__html: `
        /* --- 1. SYSTEM BOOT SEQUENCE --- */
        @keyframes vaultEntry {
          from { 
            opacity: 0; 
            transform: scale(0.98);
            filter: brightness(0.5) blur(10px);
          }
          to { 
            opacity: 1; 
            transform: scale(1);
            filter: brightness(1) blur(0px);
          }
        }

        .inventory-viewport {
          animation: vaultEntry 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* --- 2. LOGISTICS SCROLLBAR (CYAN ACCENT) --- */
        .inventory-viewport::-webkit-scrollbar { 
          width: 6px; 
        }
        .inventory-viewport::-webkit-scrollbar-track { 
          background: rgba(0,0,0,0.8); 
        }
        .inventory-viewport::-webkit-scrollbar-thumb { 
          background: #00F2FF; /* Logistics Cyan */
          border-radius: 10px;
          box-shadow: 0 0 10px rgba(0, 242, 255, 0.5);
        }

        /* --- 3. THE "ACTIVE KERNEL" PERIMETER GLOW --- */
        .inventory-viewport::after {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          border: 1px solid rgba(212,175,55,0.1);
          box-shadow: inset 0 0 100px rgba(0,0,0,0.8);
          z-index: 5;
        }

        /* --- 4. DATA ROW INTERACTIVITY --- */
        .audit-row:hover {
          background: rgba(0, 242, 255, 0.03) !important;
          border-left: 2px solid #00F2FF;
          transition: 0.2s;
        }
      `}} />
      
      {/* --- MASTER INVENTORY VIEWPORT --- */}
      <div 
        className="inventory-viewport" 
        style={{ 
          height: '100%', 
          overflowY: 'auto', 
          position: 'relative',
          paddingBottom: '100px' /* Prevents bottom navigation overlap */
        }}
      >
        {children}
      </div>
    </section>
  );
}
