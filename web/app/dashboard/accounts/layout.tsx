// web/app/dashboard/accounts/layout.tsx
'use client';
import React from 'react';

export default function AccountsLayout({
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
        /* Ambient Glow to make the Glassmorphism panels pop */
        backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(212,175,55,0.05) 0%, transparent 50%), radial-gradient(circle at 100% 50%, rgba(0,242,255,0.03) 0%, transparent 40%)',
      }}
    >
      {/* ==========================================
          ZONE 11: GLOBAL LAYOUT STYLES & PRINT SHIELD
          ========================================== */}
      <style dangerouslySetInnerHTML={{__html: `
        /* --- 1. SMOOTH MOUNT ANIMATION --- */
        @keyframes layoutFadeIn {
          from { opacity: 0; filter: blur(4px); }
          to { opacity: 1; filter: blur(0px); }
        }

        .accounts-viewport {
          animation: layoutFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* --- 2. EXECUTIVE SCROLLBAR --- */
        .accounts-viewport::-webkit-scrollbar { 
          width: 8px; 
          height: 8px;
        }
        .accounts-viewport::-webkit-scrollbar-track { 
          background: rgba(0,0,0,0.6); 
          border-left: 1px solid rgba(255,255,255,0.05);
        }
        .accounts-viewport::-webkit-scrollbar-thumb { 
          background: rgba(212,175,55,0.5); /* Muted Gold */
          border-radius: 10px; 
          transition: background 0.3s;
        }
        .accounts-viewport::-webkit-scrollbar-thumb:hover { 
          background: rgba(212,175,55,0.8); 
        }

        /* --- 3. THE HARDENED PRINT SHIELD (CRITICAL FOR A4 EOD REPORT) --- */
        /* Intercepts Ctrl+P / Cmd+P to destroy the UI and render a physical document */
        @media print {
          /* 1. Annihilate the global Next.js Master OS Sidebar & Header */
          aside, nav, header { 
            display: none !important; 
          }
          
          /* 2. Annihilate the HUD, Tabs, and Buttons inside our page */
          .no-print { 
            display: none !important; 
          }
          
          /* 3. Strip the dark mode and ambient glow for ink-saving white */
          body, html, section {
            background: white !important;
            background-image: none !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 4. Release the viewport constraints so the 13 pages flow down the paper */
          .accounts-viewport {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            animation: none !important;
          }
        }
      `}} />
      
      {/* --- MASTER ACCOUNTS VIEWPORT --- */}
      <div 
        className="accounts-viewport" 
        style={{ 
          height: '100%', 
          overflowY: 'auto', 
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch', /* iPad Momentum Scrolling */
        }}
      >
        {children}
      </div>
    </section>
  );
}
