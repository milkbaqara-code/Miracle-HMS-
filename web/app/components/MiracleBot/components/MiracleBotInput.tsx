'use client';
// ============================================================
// MiracleBot / components / MiracleBotInput.tsx
// Sovereign input bar — mic button, AGI chip bar (Z-30 only),
// text input, and send button.
// V4.0 — Enterprise Refactor
// ============================================================
import React, { useState } from 'react';
import type { ZoneInfo } from '../lib/types';

interface InputProps {
  zone: ZoneInfo;
  isListening: boolean;
  isReadOnly: boolean;
  onStartListening: () => void;
  onStopListening:  () => void;
  onSend: (text: string) => void;
}

const AGI_CHIPS = [
  { label: 'Help',               cmd: '/agi pms-help',            color: '#00F2FF' },
  { label: '📊 Owner Statement', cmd: '/agi owner-statement ',    color: '#818cf8' },
  { label: '🔄 Rotation',        cmd: '/agi rotation-status',     color: '#10b981' },
  { label: '🏊 Pool Status',     cmd: '/agi pool-status',         color: '#60a5fa' },
  { label: '🛡 Compliance',      cmd: '/agi compliance-scan',     color: '#f59e0b' },
  { label: '🔍 Integrity',       cmd: '/agi integrity-check',     color: '#a78bfa' },
  { label: '🤖 Dispatch',        cmd: '/agi dispatch-room ',      color: '#9D00FF' },
  { label: '🏦 Sweep DRY',       cmd: '/agi mortgage-sweep dry',  color: '#f97316' },
  { label: '📅 Snapshot',        cmd: '/agi monthly-snapshot',    color: '#ec4899' },
];

export function MiracleBotInput({
  zone, isListening, isReadOnly,
  onStartListening, onStopListening, onSend,
}: InputProps) {
  const [userInput, setUserInput] = useState('');
  const c = zone.color;

  const handleSend = () => {
    if (!userInput.trim() || isReadOnly) return;
    onSend(userInput.trim());
    setUserInput('');
  };

  return (
    <div style={{
      padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)',
      flexShrink: 0, background: 'rgba(0,0,0,0.3)',
    }}>
      {/* AGI CHIP BAR — Z-30 PMS only */}
      {zone.zone === 'Z-30' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5, paddingLeft: 2 }}>
            🤖 AGI Property Manager Commands
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AGI_CHIPS.map(chip => (
              <button
                key={chip.cmd}
                onClick={() => setUserInput(chip.cmd)}
                onMouseEnter={e => { (e.currentTarget).style.background = `${chip.color}25`; (e.currentTarget).style.borderColor = `${chip.color}60`; }}
                onMouseLeave={e => { (e.currentTarget).style.background = `${chip.color}12`; (e.currentTarget).style.borderColor = `${chip.color}30`; }}
                style={{
                  background: `${chip.color}12`, border: `1px solid ${chip.color}30`,
                  color: chip.color, borderRadius: 20, padding: '4px 10px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* INPUT ROW */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {/* Mic Button */}
        <button
          onMouseDown={onStartListening}
          onMouseUp={onStopListening}
          onTouchStart={e => { e.preventDefault(); onStartListening(); }}
          onTouchEnd={onStopListening}
          title="Hold to speak"
          style={{
            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
            background:   isListening ? 'rgba(255,49,49,0.2)' : 'rgba(255,255,255,0.05)',
            border:       isListening ? '1px solid #FF3131' : `1px solid ${c}44`,
            color:        isListening ? '#FF3131' : c,
            cursor:       'pointer', fontSize: 18,
            display:      'flex', alignItems: 'center', justifyContent: 'center',
            transition:   '0.2s',
            boxShadow:    isListening ? '0 0 20px #FF313166' : 'none',
          }}
        >
          🎙️
        </button>

        {/* Text Input */}
        <input
          value={userInput}
          onChange={e => setUserInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && userInput.trim() && !isReadOnly) handleSend();
          }}
          onFocus={e  => { (e.target as HTMLInputElement).style.borderColor = `${c}66`; }}
          onBlur={e   => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.09)'; }}
          placeholder={
            isReadOnly
              ? 'View-only access in this zone'
              : zone.zone === 'Z-30'
              ? 'Type /agi pms-help to see all commands...'
              : 'Type or hold 🎙️ to speak...'
          }
          disabled={isReadOnly}
          style={{
            flex: 1,
            background:   'rgba(255,255,255,0.04)',
            border:       '1px solid rgba(255,255,255,0.09)',
            borderRadius: 20,
            padding:      '0 18px',
            height:       48,
            color:        isReadOnly ? '#555' : '#fff',
            fontSize:     14,
            outline:      'none',
            minWidth:     0,
            cursor:       isReadOnly ? 'not-allowed' : 'text',
            transition:   'border-color 0.2s',
          }}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!userInput.trim() || isReadOnly}
          style={{
            width:      48, height: 48, borderRadius: '50%', flexShrink: 0,
            background: !userInput.trim() || isReadOnly
              ? 'rgba(255,255,255,0.04)'
              : `linear-gradient(135deg, ${c} 0%, #9D00FF 100%)`,
            border:     `1px solid ${!userInput.trim() || isReadOnly ? 'rgba(255,255,255,0.08)' : c}`,
            color:      !userInput.trim() || isReadOnly ? '#444' : '#000',
            cursor:     !userInput.trim() || isReadOnly ? 'not-allowed' : 'pointer',
            fontSize:   18,
            display:    'flex', alignItems: 'center', justifyContent: 'center',
            transition: '0.3s',
            boxShadow:  !userInput.trim() || isReadOnly ? 'none' : `0 4px 18px ${c}55`,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
