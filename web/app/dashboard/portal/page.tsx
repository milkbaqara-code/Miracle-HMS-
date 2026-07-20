"use client";
import React, { useState } from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useToast } from '../../components/SovereignToast';

// The 10 hardware peripherals required for hotel automation
const PERIPHERALS = [
  { id: 'dev_pos_scan', name: 'POS Laser Scanner', type: 'INPUT', icon: '🔫', status: 'OFFLINE' },
  { id: 'dev_fingerprint', name: 'Biometric Scanner', type: 'SECURITY', icon: '👆', status: 'OFFLINE' },
  { id: 'dev_cctv', name: 'Sovereign CCTV', type: 'MONITOR', icon: '📹', status: 'OFFLINE' },
  { id: 'dev_printer', name: 'Thermal Receipt Printer', type: 'OUTPUT', icon: '🖨️', status: 'OFFLINE' },
  { id: 'dev_monitor', name: 'Kitchen/Bar Display', type: 'MONITOR', icon: '🖥️', status: 'OFFLINE' },
  { id: 'dev_tab', name: 'Staff Operative Tab', type: 'TERMINAL', icon: '📱', status: 'OFFLINE' },
  { id: 'dev_laser', name: 'Security Laser Grid', type: 'SECURITY', icon: '🚨', status: 'OFFLINE' },
  { id: 'dev_locker', name: 'Guest Locker Builder', type: 'PHYSICAL', icon: '🗄️', status: 'OFFLINE' },
  { id: 'dev_doc_scan', name: 'Passport/Doc Scanner', type: 'INPUT', icon: '📄', status: 'OFFLINE' },
  { id: 'dev_key_enc', name: 'Room Key Encoder', type: 'PHYSICAL', icon: '🗝️', status: 'OFFLINE' },
];

export default function BiometricHardwarePortal() {
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const isViewMode = useViewMode();
  const { showToast } = useToast();
  
  const handleConnect = (id: string) => {
    setConnectingId(id);
    setTimeout(() => {
      showToast('KERNEL ALERT', 'error', 'Device Driver not installed. Installation required by Sovereign Engineers.');
      setConnectingId(null);
    }, 2000);
  };

  return (
    <div className={isViewMode ? 'zone-view-mode' : ''} style={{ padding: '40px', minHeight: '100vh', background: 'transparent', color: '#FFF' }}>
      <ViewModeBanner />
      
      {/* 🛡️ THE HEADER MATRIX */}
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel', fontSize: '32px', margin: 0, letterSpacing: '3px', color: '#FFF', textShadow: '0 0 20px rgba(0,242,255,0.4)' }}>
            HARDWARE MATRIX
          </h1>
          <p style={{ margin: '5px 0 0', color: '#00F2FF', fontSize: '10px', fontWeight: 900, letterSpacing: '4px' }}>
            PERIPHERAL DRIVER INTEGRATION
          </p>
        </div>
        
        {/* 🤖 CANDLE MIRACLE BOT PANEL */}
        <div className="candle-bot-panel">
          <div className="bot-avatar">
            <span className="flame">🔥</span>
          </div>
          <div className="bot-dialogue">
            <strong>Miracle Bot:</strong> "Hello CDO. This is the Sovereign Hardware Grid. 
            From here, you will be able to map physical devices like POS Printers and Document Scanners directly to the OS using API COM ports."
          </div>
        </div>
      </div>

      {/* 🛡️ PERIPHERAL GRID */}
      <div className="hardware-grid">
        {PERIPHERALS.map((dev) => (
          <div key={dev.id} className="hardware-node">
            <div className="node-icon">{dev.icon}</div>
            <div className="node-info">
              <div className="node-type">{dev.type}</div>
              <h3 className="node-title">{dev.name}</h3>
              <div className="node-status text-red">● {dev.status}</div>
            </div>
            
            <button 
              className={`connect-btn ${connectingId === dev.id ? 'connecting' : ''}`}
              onClick={() => handleConnect(dev.id)}
              disabled={connectingId !== null}
            >
               {connectingId === dev.id ? 'MAPPING PORT...' : '🔗 PORT CONNECT'}
            </button>
          </div>
        ))}
      </div>

      {/* 🌟 CSS ANIMATIONS & ANTI-GRAVITY NEON GLOW STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        .hardware-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 25px;
        }

        .hardware-node {
          background: rgba(20, 20, 25, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: 25px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }

        .hardware-node::before {
          content: '';
          position: absolute;
          top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle, rgba(0,242,255,0.05) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.4s;
          pointer-events: none;
        }

        .hardware-node:hover {
          transform: translateY(-5px) scale(1.02);
          border: 1px solid rgba(0, 242, 255, 0.3);
          box-shadow: 0 10px 40px rgba(0, 242, 255, 0.1);
        }

        .hardware-node:hover::before { opacity: 1; }

        .node-icon {
          width: 50px; height: 50px;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px;
          box-shadow: inset 0 0 15px rgba(0, 242, 255, 0.1);
        }

        .node-info { flex: 1; }
        
        .node-type {
          font-size: 8px; font-weight: 900; letter-spacing: 2px;
          color: #D4AF37; margin-bottom: 5px;
        }

        .node-title {
          font-size: 16px; font-weight: 900; color: #FFF; margin: 0 0 5px 0;
        }

        .node-status {
          font-size: 9px; font-weight: 900; letter-spacing: 1px;
        }
        .text-red { color: #FF3131; text-shadow: 0 0 10px rgba(255, 49, 49, 0.5); }

        .connect-btn {
          background: rgba(0, 242, 255, 0.05);
          border: 1px solid rgba(0, 242, 255, 0.3);
          color: #00F2FF;
          padding: 12px;
          border-radius: 12px;
          font-size: 10px; font-weight: 900; letter-spacing: 2px;
          cursor: pointer; transition: 0.3s;
          margin-top: 10px;
        }

        .connect-btn:hover:not(:disabled) {
          background: rgba(0, 242, 255, 0.2);
          box-shadow: 0 0 20px rgba(0, 242, 255, 0.4);
        }

        .connecting {
          animation: connecting-pulse 1s infinite alternate;
          color: #D4AF37; border-color: #D4AF37;
          cursor: wait;
        }

        @keyframes connecting-pulse {
          from { box-shadow: 0 0 0 rgba(212, 175, 55, 0); }
          to { box-shadow: 0 0 20px rgba(212, 175, 55, 0.6); }
        }

        /* 🤖 MIRACLE BOT STYLES */
        .candle-bot-panel {
          display: flex; align-items: flex-start; gap: 15px;
          background: rgba(212, 175, 55, 0.05);
          border: 1px solid rgba(212, 175, 55, 0.2);
          padding: 15px; border-radius: 16px;
          max-width: 400px;
          box-shadow: 0 0 30px rgba(212, 175, 55, 0.1);
        }

        .bot-avatar {
          width: 40px; height: 40px; flex-shrink: 0;
          background: #000; border-radius: 50%;
          border: 2px solid #D4AF37;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.5);
        }

        .flame {
          font-size: 18px; animation: flicker 0.1s infinite alternate;
        }

        .bot-dialogue {
          font-size: 11px; line-height: 1.5; color: rgba(255, 255, 255, 0.8);
        }

        .bot-dialogue strong {
          color: #D4AF37; font-weight: 900; letter-spacing: 1px;
        }

        @keyframes flicker {
          0% { transform: scale(1) translateY(0); opacity: 1; filter: drop-shadow(0 0 10px #FFD700); }
          100% { transform: scale(1.1) translateY(-2px); opacity: 0.8; filter: drop-shadow(0 0 20px #FF8C00); }
        }
      `}} />
    </div>
  );
}
