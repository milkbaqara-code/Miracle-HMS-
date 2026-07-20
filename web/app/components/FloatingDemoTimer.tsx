'use client';

import React, { useState, useEffect } from 'react';

export default function FloatingDemoTimer() {
  const [role, setRole] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // in ms
  const [urgent, setUrgent] = useState<'normal' | 'warning' | 'critical'>('normal');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check role from localStorage
    const currentRole = localStorage.getItem('vigilant_role');
    setRole(currentRole);

    if (currentRole !== 'VISITOR') return;

    // Check expiration timestamp
    let expiresAtStr = localStorage.getItem('miracle_demo_expires_at');
    let expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;

    if (!expiresAt || isNaN(expiresAt)) {
      // Set to 20 minutes from now
      expiresAt = Date.now() + 20 * 60 * 1000;
      localStorage.setItem('miracle_demo_expires_at', expiresAt.toString());
    }

    const checkTime = () => {
      const currentRoleActive = localStorage.getItem('vigilant_role');
      if (currentRoleActive !== 'VISITOR') {
        setRole(null);
        return;
      }

      const now = Date.now();
      const diff = expiresAt! - now;

      if (diff <= 0) {
        setTimeLeft(0);
        handleDemoExpiration();
      } else {
        setTimeLeft(diff);
        if (diff <= 60 * 1000) {
          setUrgent('critical');
        } else if (diff <= 5 * 60 * 1000) {
          setUrgent('warning');
        } else {
          setUrgent('normal');
        }
      }
    };

    // Initial check
    checkTime();

    // Check every second
    const interval = setInterval(checkTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDemoExpiration = () => {
    // Clear demo local storage keys
    localStorage.removeItem('miracle_token');
    localStorage.removeItem('miracle_user');
    localStorage.removeItem('vigilant_role');
    localStorage.removeItem('miracle_visitor_allowed_zones');
    localStorage.removeItem('miracle_package');
    localStorage.removeItem('miracle_package_name');
    localStorage.removeItem('miracle_package_color');
    localStorage.removeItem('miracle_package_icon');
    localStorage.removeItem('miracle_demo_expires_at');

    // Clear middleware bouncer cookie
    document.cookie = 'miracle_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

    // Redirect to expired page
    window.location.href = '/demo-expired';
  };

  if (role !== 'VISITOR' || timeLeft === null) return null;

  // Format time
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Theme based on state
  const colors = {
    normal: {
      glow: 'rgba(0, 242, 255, 0.4)',
      border: '#00f2ff',
      bg: 'rgba(4, 4, 14, 0.85)',
      text: '#00f2ff',
    },
    warning: {
      glow: 'rgba(255, 140, 0, 0.5)',
      border: '#ff8c00',
      bg: 'rgba(15, 8, 2, 0.9)',
      text: '#ff8c00',
    },
    critical: {
      glow: 'rgba(255, 49, 49, 0.7)',
      border: '#ff3131',
      bg: 'rgba(20, 2, 2, 0.95)',
      text: '#ff3131',
    }
  };

  const currentTheme = colors[urgent];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes demo-radar-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes demo-pulse-glow {
          0%, 100% { box-shadow: 0 0 15px ${currentTheme.glow}, inset 0 0 10px ${currentTheme.glow}; }
          50% { box-shadow: 0 0 25px ${currentTheme.glow}, inset 0 0 15px ${currentTheme.glow}; }
        }
        @keyframes demo-flicker {
          0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 0.99; filter: drop-shadow(0 0 1px ${currentTheme.border}); }
          20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.4; filter: none; }
        }
        @keyframes demo-critical-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px #ff3131); }
          50% { transform: scale(1.05); filter: drop-shadow(0 0 25px #ff3131); }
        }
        .demo-timer-card {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 99999;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 20px;
          background: ${currentTheme.bg};
          border: 1px solid ${currentTheme.border};
          border-radius: 16px;
          backdrop-filter: blur(16px);
          font-family: 'Orbitron', monospace;
          color: white;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          animation: demo-pulse-glow 3s infinite ease-in-out;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .demo-timer-card.critical {
          animation: demo-critical-pulse 1s infinite ease-in-out;
        }
        .demo-timer-radar {
          position: relative;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid ${currentTheme.border}44;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .demo-timer-radar-sweep {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid transparent;
          border-top-color: ${currentTheme.border};
          animation: demo-radar-spin 2s linear infinite;
        }
        .demo-timer-label {
          font-size: 8px;
          letter-spacing: 2px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
        }
        .demo-timer-value {
          font-size: 18px;
          font-weight: 700;
          color: ${currentTheme.text};
          letter-spacing: 1.5px;
          text-shadow: 0 0 10px ${currentTheme.glow};
        }
        .demo-timer-value.flicker {
          animation: demo-flicker 4s infinite;
        }
      `}} />
      <div className={`demo-timer-card ${urgent}`}>
        <div className="demo-timer-radar">
          <div className="demo-timer-radar-sweep" />
          <span style={{ fontSize: '10px', color: currentTheme.text }}>⏱</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="demo-timer-label">Demo Session</span>
          <span className={`demo-timer-value ${urgent === 'critical' ? 'flicker' : ''}`}>{timeString}</span>
        </div>
      </div>
    </>
  );
}
