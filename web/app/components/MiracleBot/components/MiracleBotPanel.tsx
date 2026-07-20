'use client';
// ============================================================
// MiracleBot / components / MiracleBotPanel.tsx
// The open chat panel — header, voice toggle bar, pending speech
// banner, feature request form, messages, and input bar.
// Conditionally overlays: IntakeDialog, ProposalHub.
// V4.0 — Enterprise Refactor
// ============================================================
import React from 'react';
import type { ZoneInfo, BotMessage, PendingProposal, VisitorRole } from '../lib/types';
import { MiracleBotMessages }      from './MiracleBotMessages';
import { MiracleBotInput }         from './MiracleBotInput';
import { MiracleBotProposalHub }   from './MiracleBotProposalHub';
import { MiracleBotIntakeDialog }  from './MiracleBotIntakeDialog';

const KERNEL_VERSION = 'V4.0-SOVEREIGN';

interface PanelProps {
  // Zone + identity
  zone:        ZoneInfo;
  synapseError:boolean;
  isSpeaking:  boolean;
  isThinking:  boolean;
  isListening: boolean;
  isMuted:     boolean;
  hasPendingSpeech: boolean;
  volume:      number;

  // Messages
  messages:    BotMessage[];
  hasInteracted:       React.MutableRefObject<boolean>;
  isAwakening:         boolean;
  visitorWarning:      string | null;
  onApproveProposal:   (i: number) => void;
  onDeclineProposal:   (i: number) => void;
  onAwaken:            () => void;
  onPanelClick:        () => void;

  // Controls
  onClose:             () => void;
  onMuteToggle:        () => void;
  onVolumeChange:      (v: number) => void;
  onUnlockAndPlay:     () => void;

  // Feature request
  showFeatureForm:     boolean;
  setShowFeatureForm:  (v: boolean) => void;
  featureText:         string;
  setFeatureText:      (v: string) => void;
  featureStatus:       string;
  onSubmitFeature:     () => void;

  // Input
  isReadOnly:          boolean;
  onStartListening:    () => void;
  onStopListening:     () => void;
  onSend:              (text: string) => void;

  // Drag (panel header drag)
  onPointerDown:       (e: React.PointerEvent) => void;
  onPointerMove:       (e: React.PointerEvent) => void;
  onPointerUp:         (e: React.PointerEvent) => void;

  // V4.0 Proposal Hub
  hubOpen:             boolean;
  setHubOpen:          (v: boolean) => void;
  pendingProposals:    PendingProposal[];
  onHubApprove:        (id: string) => void;
  onHubDecline:        (id: string) => void;

  // V4.0 Intake Dialog
  intakeOpen:          boolean;
  intakeSaving:        boolean;
  onIntakeSelect:      (role: VisitorRole) => void;
  onIntakeSkip:        () => void;
}

export function MiracleBotPanel({
  zone, synapseError, isSpeaking, isThinking, isListening,
  isMuted, hasPendingSpeech, volume,
  messages, hasInteracted, isAwakening, visitorWarning,
  onApproveProposal, onDeclineProposal, onAwaken, onPanelClick,
  onClose, onMuteToggle, onVolumeChange, onUnlockAndPlay,
  showFeatureForm, setShowFeatureForm, featureText, setFeatureText, featureStatus, onSubmitFeature,
  isReadOnly, onStartListening, onStopListening, onSend,
  onPointerDown, onPointerMove, onPointerUp,
  hubOpen, setHubOpen, pendingProposals, onHubApprove, onHubDecline,
  intakeOpen, intakeSaving, onIntakeSelect, onIntakeSkip,
}: PanelProps) {
  const c = zone.color;

  return (
    <div
      className="miracle-chat-panel"
      style={{
        position:       'relative',
        width:          'min(700px, 95vw)',
        height:         'min(750px, 85vh)',
        background:     'rgba(4,4,6,0.92)',
        backdropFilter: 'blur(40px)',
        border:         '1px solid rgba(255,255,255,0.1)',
        borderRadius:   36,
        display:        'flex',
        flexDirection:  'column',
        overflow:       'hidden',
        boxShadow:      '0 40px 120px rgba(0,0,0,0.95)',
        animation:      'mirSlide 0.5s cubic-bezier(0.16,1,0.3,1)',
        opacity:        1,
        transform:      'scale(1) translateY(0px)',
        pointerEvents:  'auto',
        transition:     'none',
      }}
    >
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          padding:      '20px 28px',
          cursor:       'grab',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background:   `linear-gradient(90deg,${c}18 0%,transparent 100%)`,
          display:      'flex',
          alignItems:   'center',
          justifyContent:'space-between',
          flexShrink:   0,
        }}
      >
        {/* Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 14, height: 22,
            background: isSpeaking ? 'linear-gradient(to top,#9D00FF,#00F2FF)' : c,
            borderRadius: '50% 50% 20% 20%',
            boxShadow: `0 0 18px ${c}`,
            animation: 'mirFlicker 0.12s infinite alternate',
          }} />
          <div>
            <div style={{
              color: synapseError ? '#FF3131' : '#fff',
              fontWeight: 800, fontSize: 11, letterSpacing: 2,
              animation: synapseError ? 'pulse_red 1s infinite' : 'none',
            }}>
              {synapseError ? 'SYNAPSE ERROR' : zone.zone === 'Z-LOGIN' ? 'MIRACLE SALES' : 'MIRACLE AI'}
            </div>
            <div style={{
              color: isSpeaking ? '#00F2FF' : hasPendingSpeech ? '#D4AF37' : c,
              fontSize: 8, fontWeight: 700, letterSpacing: 1.5, marginTop: 2,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>
                {synapseError    ? 'BRAIN OFFLINE'
                 : isThinking    ? 'THINKING...'
                 : isListening   ? 'LISTENING...'
                 : isSpeaking    ? 'SPEAKING...'
                 : hasPendingSpeech ? '⚡ TAP BELOW TO HEAR'
                 : 'VOICE READY'}
              </span>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{KERNEL_VERSION}</span>
            </div>
          </div>
        </div>

        {/* Hardware Control Unit */}
        <div
          onPointerDown={e => e.stopPropagation()}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.03)',
            padding: '6px 14px', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Mute toggle */}
          <button
            onClick={() => { const nv = volume === 0 ? 0.8 : 0; onVolumeChange(nv); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}
          >
            {volume === 0 ? '🔇' : '🔊'}
          </button>
          {/* Volume slider */}
          <input
            type="range" min="0" max="1" step="0.1"
            value={volume}
            onChange={e => onVolumeChange(parseFloat(e.target.value))}
            style={{ width: 45, height: 3, cursor: 'pointer', accentColor: '#00F2FF' }}
          />
          {/* Close */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,49,49,0.1)', border: '1px solid rgba(255,49,49,0.3)',
              color: '#FF3131', cursor: 'pointer', fontSize: 12, fontWeight: 900, marginLeft: 4,
              width: 22, height: 22, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      </div>

      {/* ── VOICE ON/OFF TOGGLE BAR ─────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: 10, letterSpacing: 1.5, fontWeight: 800, userSelect: 'none', flexShrink: 0,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>SPEAK MIRACLE ON/OFF:</span>
        <button
          onClick={onMuteToggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${isMuted ? 'rgba(255,49,49,0.3)' : 'rgba(57,255,20,0.3)'}`,
            borderRadius: 14, padding: '4px 10px',
            color: isMuted ? '#FF3131' : '#39FF14',
            fontSize: 9, fontWeight: 900, cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: isMuted ? 'none' : '0 0 10px rgba(57,255,20,0.2)',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isMuted ? '#FF3131' : '#39FF14',
            boxShadow: isMuted ? '0 0 8px #FF3131' : '0 0 8px #39FF14',
            display: 'inline-block',
          }} />
          {isMuted ? 'OFF' : 'ON'}
        </button>
      </div>

      {/* ── PENDING SPEECH BANNER ──────────────────────────── */}
      {hasPendingSpeech && (
        <button
          onClick={onUnlockAndPlay}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '10px 0',
            background: 'linear-gradient(90deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.08) 100%)',
            border: 'none', borderBottom: '1px solid rgba(212,175,55,0.3)',
            cursor: 'pointer', flexShrink: 0,
            animation: 'sovereignPulse 1.4s ease-in-out infinite',
          }}
        >
          <span style={{ fontSize: 16 }}>🔊</span>
          <span style={{ color: '#D4AF37', fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>
            TAP TO HEAR MIRACLE
          </span>
          <span style={{ fontSize: 16 }}>🔊</span>
        </button>
      )}

      {/* ── FEATURE REQUEST FORM ──────────────────────────── */}
      {showFeatureForm && (
        <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.6)', borderBottom: `1px solid ${c}33`, flexShrink: 0 }}>
          <p style={{ color: c, fontSize: 10, fontWeight: 800, letterSpacing: 2, margin: '0 0 8px' }}>💡 REQUEST A FEATURE</p>
          <textarea
            value={featureText}
            onChange={e => setFeatureText(e.target.value)}
            placeholder="Describe the feature you'd like added..."
            rows={3}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${c}44`, borderRadius: 12,
              padding: '10px 14px', color: '#fff', fontSize: 13,
              outline: 'none', resize: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={onSubmitFeature}
              style={{ flex: 1, padding: 10, borderRadius: 10, background: c, color: '#000', fontWeight: 800, fontSize: 11, border: 'none', cursor: 'pointer', letterSpacing: 1 }}
            >
              SEND TO MIRACLE DEV TEAM
            </button>
            <button
              onClick={() => setShowFeatureForm(false)}
              style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', color: '#888', border: 'none', cursor: 'pointer', fontSize: 11 }}
            >✕</button>
          </div>
          {featureStatus && <p style={{ color: '#39FF14', fontSize: 10, marginTop: 6, fontWeight: 700 }}>{featureStatus}</p>}
        </div>
      )}

      {/* ── MESSAGES ─────────────────────────────────────── */}
      <MiracleBotMessages
        messages={messages}
        isThinking={isThinking}
        zone={zone}
        hasInteracted={hasInteracted}
        isAwakening={isAwakening}
        visitorWarning={visitorWarning}
        onAwaken={onAwaken}
        onApproveProposal={onApproveProposal}
        onDeclineProposal={onDeclineProposal}
        onPanelClick={onPanelClick}
      />

      {/* ── INPUT BAR ────────────────────────────────────── */}
      <MiracleBotInput
        zone={zone}
        isListening={isListening}
        isReadOnly={isReadOnly}
        onStartListening={onStartListening}
        onStopListening={onStopListening}
        onSend={onSend}
      />

      {/* ── V4.0 OVERLAYS (rendered above everything) ─────── */}

      {/* Intake Dialog */}
      {intakeOpen && (
        <MiracleBotIntakeDialog
          onSelect={onIntakeSelect}
          onSkip={onIntakeSkip}
          isSaving={intakeSaving}
        />
      )}

      {/* Proposal Hub */}
      {hubOpen && (
        <MiracleBotProposalHub
          proposals={pendingProposals}
          onApprove={onHubApprove}
          onDecline={onHubDecline}
          onClose={() => setHubOpen(false)}
        />
      )}
    </div>
  );
}
