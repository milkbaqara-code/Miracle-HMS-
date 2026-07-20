"use client";
import React from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';

// 🔱 MIRACLE HMS: GUEST CONCIERGE DASHBOARD PORTAL (STAFF VIEW)
// This page provides a staff-facing gateway to the Guest App experience.

export default function GuestAppDashboardPortal() {
  const isViewMode = useViewMode();
  
  return (
    <div className={isViewMode ? 'zone-view-mode' : ''} style={{ padding: '30px', height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <ViewModeBanner />
      
      {/* 🛡️ SOVEREIGN SYSTEM HEADER */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        paddingBottom: '25px',
        marginBottom: '25px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Cinzel', fontSize: '28px', color: '#D4AF37', textShadow: '0 0 20px rgba(212,175,55,0.3)', letterSpacing: '2px' }}>
            ZONE PATIENT: CONCIERGE MONITOR
          </h1>
          <p style={{ margin: '5px 0 0 0', color: '#00F2FF', fontSize: '10px', fontWeight: 900, letterSpacing: '1px' }}>
            STAFF OVERSIGHT | LIVE GUEST PORTAL PREVIEW
          </p>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
             <button 
                onClick={() => window.open('/guest', '_blank')}
                style={{ 
                    background: 'rgba(212, 175, 55, 0.05)', 
                    border: '1px solid #D4AF37', 
                    color: '#D4AF37', 
                    padding: '12px 25px', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    fontSize: '11px', 
                    fontWeight: 900,
                    letterSpacing: '1px',
                    transition: '0.3s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.05)'}
             >
                OPEN STANDALONE PORTAL ↗
             </button>
        </div>
      </div>
      
      {/* 📱 PORTAL FRAME */}
      <div style={{ 
        flex: 1, 
        background: '#000', 
        borderRadius: '24px', 
        border: '1px solid rgba(255,255,255,0.1)', 
        overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8)'
      }}>
        <iframe 
          src="/guest" 
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Guest Concierge Live Stream"
        />
      </div>
      
      {/* 🛡️ INFRASTRUCTURE FOOTER */}
      <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ fontSize: '9px', color: '#444', fontWeight: 900, letterSpacing: '1px' }}>
            SOVEREIGN ARCHITECTURE V7.5 | ZONE PATIENT ENCAPSULATED
         </div>
         <div style={{ color: '#00FF88', fontSize: '9px', fontWeight: 900 }}>
            ● LINK SECURE
         </div>
      </div>
    </div>
  );
}
