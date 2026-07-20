'use client';
// ============================================================
// MiracleBot / components / MiracleBotProposalHub.tsx  [V4.0]
// DB-Backed Proposal Hub tray — fetched PENDING proposals from
// the database, rendered as cards with approve/decline actions.
// Slides in from the right as a tray over the chat panel.
// V4.0 — Enterprise Refactor
// ============================================================
import React from 'react';
import type { PendingProposal } from '../lib/types';

interface ProposalHubProps {
  proposals: PendingProposal[];
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
  onClose:   () => void;
}

export function MiracleBotProposalHub({
  proposals, onApprove, onDecline, onClose,
}: ProposalHubProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'rgba(4,4,6,0.97)', backdropFilter: 'blur(40px)',
      borderRadius: 36, display: 'flex', flexDirection: 'column',
      animation: 'mirSlide 0.4s cubic-bezier(0.16,1,0.3,1)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(212,175,55,0.15)',
        background: 'rgba(212,175,55,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ color: '#D4AF37', fontWeight: 900, fontSize: 11, letterSpacing: 2 }}>
            🔑 PROPOSAL HUB
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, letterSpacing: 1, marginTop: 2 }}>
            {proposals.length} PENDING ACTION{proposals.length !== 1 ? 'S' : ''} AWAITING APPROVAL
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,49,49,0.1)', border: '1px solid rgba(255,49,49,0.3)',
            color: '#FF3131', cursor: 'pointer', fontSize: 12, fontWeight: 900,
            width: 22, height: 22, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      {/* Proposals List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {proposals.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            No pending proposals
          </div>
        ) : proposals.map(p => (
          <div key={p.id} style={{
            padding: 16,
            background: 'rgba(212,175,55,0.04)',
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Action title */}
            <div style={{ fontSize: 10, fontWeight: 900, color: '#D4AF37', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              🔑 {p.action}
            </div>
            {/* Explanation */}
            {p.explanation && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                {p.explanation}
              </div>
            )}
            {/* Parameters */}
            {Object.keys(p.parameters || {}).length > 0 && (
              <div style={{
                fontSize: 11, color: 'rgba(255,255,255,0.5)',
                fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)',
                padding: 8, borderRadius: 8, whiteSpace: 'pre-wrap',
              }}>
                {JSON.stringify(p.parameters, null, 2)}
              </div>
            )}
            {/* Timestamp */}
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
              {new Date(p.created_at).toLocaleString()}
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onApprove(p.id)}
                style={{
                  flex: 1, padding: '9px 12px',
                  border: '1px solid rgba(57,255,20,0.5)',
                  background: 'rgba(57,255,20,0.1)',
                  color: '#39FF14', borderRadius: 8,
                  fontSize: 11, fontWeight: 800, cursor: 'pointer',
                }}
              >
                ✅ Approve &amp; Execute
              </button>
              <button
                onClick={() => onDecline(p.id)}
                style={{
                  flex: 1, padding: '9px 12px',
                  border: '1px solid rgba(255,49,49,0.5)',
                  background: 'rgba(255,49,49,0.1)',
                  color: '#FF3131', borderRadius: 8,
                  fontSize: 11, fontWeight: 800, cursor: 'pointer',
                }}
              >
                ❌ Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
