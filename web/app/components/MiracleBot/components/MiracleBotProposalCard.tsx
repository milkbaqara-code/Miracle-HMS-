'use client';
// ============================================================
// MiracleBot / components / MiracleBotProposalCard.tsx
// Renders a single AI Action Proposal inside the chat stream.
// Shows action + JSON params, approve/decline buttons, and
// result state after execution.
// V4.0 — Enterprise Refactor
// ============================================================
import React from 'react';
import type { ProposalPayload } from '../lib/types';

interface ProposalCardProps {
  proposal: ProposalPayload;
  messageIndex: number;
  onApprove: (index: number) => void;
  onDecline: (index: number) => void;
}

export function MiracleBotProposalCard({
  proposal, messageIndex, onApprove, onDecline,
}: ProposalCardProps) {
  return (
    <div style={{
      marginTop:    12,
      padding:      16,
      background:   'rgba(212,175,55,0.05)',
      border:       '1px solid rgba(212,175,55,0.3)',
      borderRadius: 14,
      boxShadow:    '0 0 15px rgba(212,175,55,0.1)',
      display:      'flex',
      flexDirection:'column',
      gap:          12,
    }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: '#D4AF37', letterSpacing: 1.5, textTransform: 'uppercase' }}>
        🔑 AI Action Proposal: {proposal.action}
      </div>

      <div style={{
        fontSize: 11, color: 'rgba(255,255,255,0.7)',
        fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)',
        padding: 8, borderRadius: 8, whiteSpace: 'pre-wrap',
      }}>
        {JSON.stringify(proposal.parameters, null, 2)}
      </div>

      {proposal.approved ? (
        <div style={{ fontSize: 12, color: '#39FF14', fontWeight: 700 }}>
          ✅ Approved &amp; Executed
          {proposal.resultText && (
            <div style={{ fontSize: 11, color: '#eee', marginTop: 4, fontFamily: 'monospace' }}>
              {proposal.resultText}
            </div>
          )}
        </div>
      ) : proposal.declined ? (
        <div style={{ fontSize: 12, color: '#FF3131', fontWeight: 700 }}>
          ❌ Declined by Operator
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onApprove(messageIndex)}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 10px rgba(57,255,20,0.3)'; }}
            onMouseOut={e  => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
            style={{
              flex: 1, padding: '8px 12px',
              border: '1px solid rgba(57,255,20,0.5)',
              background: 'rgba(57,255,20,0.1)',
              color: '#39FF14', borderRadius: 8,
              fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: '0.2s',
            }}
          >
            Approve
          </button>
          <button
            onClick={() => onDecline(messageIndex)}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 10px rgba(255,49,49,0.3)'; }}
            onMouseOut={e  => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
            style={{
              flex: 1, padding: '8px 12px',
              border: '1px solid rgba(255,49,49,0.5)',
              background: 'rgba(255,49,49,0.1)',
              color: '#FF3131', borderRadius: 8,
              fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: '0.2s',
            }}
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
