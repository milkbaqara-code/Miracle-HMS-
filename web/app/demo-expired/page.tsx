'use client';

import React from 'react';

export default function DemoExpiredPage() {
  const handleRestartDemo = () => {
    window.location.href = '/visitor-tour';
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500;600&display=swap');

        @keyframes de-fadeup {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes de-pulse-whatsapp {
          0%, 100% { box-shadow: 0 0 15px rgba(37, 211, 102, 0.4); }
          50% { box-shadow: 0 0 30px rgba(37, 211, 102, 0.7), 0 0 0 2px rgba(37, 211, 102, 0.2); }
        }
        @keyframes de-glitch {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(-2px, -2px); }
          60% { transform: translate(2px, 2px); }
          80% { transform: translate(2px, -2px); }
        }
        @keyframes de-radar-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .de-container {
          min-height: 100vh;
          background: radial-gradient(circle at 50% 30%, rgba(255, 49, 49, 0.08) 0%, transparent 60%), 
                      radial-gradient(circle at 10% 80%, rgba(157, 0, 255, 0.04) 0%, transparent 50%),
                      #04040e;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          font-family: 'Inter', sans-serif;
          color: white;
          overflow: hidden;
          position: relative;
        }

        .de-card {
          width: 100%;
          max-width: 520px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 49, 49, 0.25);
          border-radius: 24px;
          padding: 48px 40px;
          text-align: center;
          backdrop-filter: blur(20px);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8), inset 0 0 32px rgba(255, 49, 49, 0.05);
          animation: de-fadeup 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
          position: relative;
        }

        .de-card::before {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%; height: 1px;
          background: linear-gradient(90deg, transparent, #ff3131, transparent);
        }

        .de-timer-expired-icon {
          position: relative;
          width: 96px;
          height: 96px;
          margin: 0 auto 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .de-icon-circle {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px dashed rgba(255, 49, 49, 0.3);
          animation: de-radar-spin 20s linear infinite;
        }

        .de-icon-circle-solid {
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          border: 1px solid rgba(255, 49, 49, 0.5);
          background: rgba(255, 49, 49, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .de-badge {
          display: inline-block;
          font-family: 'Orbitron', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #ff3131;
          text-transform: uppercase;
          background: rgba(255, 49, 49, 0.1);
          border: 1px solid rgba(255, 49, 49, 0.2);
          padding: 6px 14px;
          border-radius: 20px;
          margin-bottom: 20px;
          text-shadow: 0 0 10px rgba(255, 49, 49, 0.5);
        }

        .de-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 2px;
          margin-bottom: 16px;
          text-transform: uppercase;
        }

        .de-description {
          font-size: 14px;
          line-height: 1.7;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 40px;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }

        .de-btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 16px 24px;
          background: #25d366;
          border: none;
          border-radius: 14px;
          color: white;
          font-family: 'Orbitron', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
          animation: de-pulse-whatsapp 2s infinite ease-in-out;
        }

        .de-btn-primary:hover {
          background: #20ba59;
          transform: translateY(-2px);
        }

        .de-btn-secondary {
          display: block;
          width: 100%;
          padding: 15px 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          color: white;
          font-family: 'Orbitron', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          margin-top: 12px;
        }

        .de-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .de-restart-link {
          display: inline-block;
          margin-top: 32px;
          color: rgba(255, 255, 255, 0.3);
          font-size: 11px;
          letter-spacing: 1px;
          text-decoration: none;
          transition: color 0.2s ease;
          cursor: pointer;
        }

        .de-restart-link:hover {
          color: #ff3131;
        }

        .de-footer {
          margin-top: 48px;
          font-family: 'Orbitron', monospace;
          font-size: 9px;
          letter-spacing: 3px;
          color: rgba(255, 255, 255, 0.15);
          text-transform: uppercase;
        }
      `}} />

      <div className="de-container">
        <div className="de-card">
          <div className="de-timer-expired-icon">
            <div className="de-icon-circle" />
            <div className="de-icon-circle-solid">
              <span style={{ fontSize: '32px', color: '#ff3131', filter: 'drop-shadow(0 0 10px rgba(255,49,49,0.5))' }}>⏱</span>
            </div>
          </div>

          <span className="de-badge">Session Expired</span>
          <h2 className="de-title">Demo Window Closed</h2>
          <p className="de-description">
            Your 20-minute guided tour has concluded. To explore further or provision a dedicated enterprise instance for your business, connect with our support team.
          </p>

          <a 
            href={`https://wa.me/8801711477509?text=${encodeURIComponent("Hello! I was testing the Miracle HMS demo and it expired. I'd like to get details on setting up a custom enterprise solution.")}`}
            target="_blank" 
            rel="noopener noreferrer" 
            className="de-btn-primary"
          >
            💬 Contact Engineer on WhatsApp
          </a>

          <a 
            href="https://www.vigilantitsolution.com#pricing" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="de-btn-secondary"
          >
            💳 View Packages & Pricing
          </a>

          <div 
            onClick={handleRestartDemo}
            className="de-restart-link"
          >
            ← Restart Another Demo Session
          </div>
        </div>

        <div className="de-footer">
          Vigilant IT Solution Ltd · Miracle HMS
        </div>
      </div>
    </>
  );
}
