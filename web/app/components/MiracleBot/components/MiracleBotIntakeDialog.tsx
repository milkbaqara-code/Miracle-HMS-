'use client';
// ============================================================
// MiracleBot / components / MiracleBotIntakeDialog.tsx  [V4.0]
// Sovereign Visitor Intake — a polite role-selection modal that
// appears for unknown visitors on key zones (Z-LOGIN, Z-PROP, Z-WEB).
// Saves selection to DB so the AI responds with context-aware greeting.
// V4.0 — Enterprise Refactor
// ============================================================
import React, { useState } from 'react';
import type { VisitorRole } from '../lib/types';

interface IntakeDialogProps {
  onSelect: (role: VisitorRole) => void;
  onSkip:   () => void;
  isSaving: boolean;
}

const ROLES: { role: VisitorRole; emoji: string; label: string; desc: string }[] = [
  { role: 'INVESTOR',       emoji: '💼', label: 'Investor',       desc: 'Looking to invest or evaluate ROI'       },
  { role: 'PROPERTY_OWNER', emoji: '🏢', label: 'Property Owner',  desc: 'Own a property, seeking management'      },
  { role: 'BUYER',          emoji: '🔑', label: 'Buyer',           desc: 'Looking to purchase property'            },
  { role: 'REALTOR',        emoji: '🤝', label: 'Realtor',         desc: 'Agent representing a buyer or seller'    },
  { role: 'RENTER',         emoji: '🏠', label: 'Renter',          desc: 'Looking to lease or rent'               },
  { role: 'OPERATOR',       emoji: '⚙️', label: 'Operator',        desc: 'Hotel or hospitality operator'           },
  { role: 'VISITOR',        emoji: '👀', label: 'Just Browsing',   desc: 'Exploring what Miracle HMS offers'        },
];

export function MiracleBotIntakeDialog({ onSelect, onSkip, isSaving }: IntakeDialogProps) {
  const [hovered, setHovered] = useState<VisitorRole | null>(null);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      background: 'rgba(4,4,6,0.97)', backdropFilter: 'blur(40px)',
      borderRadius: 36, display: 'flex', flexDirection: 'column',
      animation: 'mirSlide 0.5s cubic-bezier(0.16,1,0.3,1)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '28px 24px 16px',
        borderBottom: '1px solid rgba(0,242,255,0.1)',
        background: 'linear-gradient(180deg, rgba(0,242,255,0.06) 0%, transparent 100%)',
        flexShrink: 0, textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
        <div style={{ color: '#00F2FF', fontWeight: 900, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>
          Welcome to Miracle HMS
        </div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
          How can I best assist you today?<br />
          <span style={{ fontSize: 10 }}>Select your role for a personalized experience.</span>
        </div>
      </div>

      {/* Role Options */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ROLES.map(r => (
          <button
            key={r.role}
            onClick={() => onSelect(r.role)}
            onMouseEnter={() => setHovered(r.role)}
            onMouseLeave={() => setHovered(null)}
            disabled={isSaving}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 16px', borderRadius: 14,
              background: hovered === r.role ? 'rgba(0,242,255,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${hovered === r.role ? 'rgba(0,242,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
              cursor: isSaving ? 'wait' : 'pointer',
              textAlign: 'left', transition: 'all 0.2s',
              boxShadow: hovered === r.role ? '0 0 16px rgba(0,242,255,0.12)' : 'none',
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{r.emoji}</span>
            <div>
              <div style={{ color: hovered === r.role ? '#00F2FF' : '#eee', fontWeight: 800, fontSize: 13, transition: '0.2s' }}>
                {r.label}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                {r.desc}
              </div>
            </div>
            {isSaving && hovered === r.role && (
              <div style={{ marginLeft: 'auto', color: '#00F2FF', fontSize: 11 }}>Saving...</div>
            )}
          </button>
        ))}
      </div>

      {/* Skip */}
      <div style={{ padding: '12px 18px', flexShrink: 0, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={onSkip}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.25)', fontSize: 11, cursor: 'pointer',
            letterSpacing: 1, fontWeight: 600,
          }}
        >
          Skip for now →
        </button>
      </div>
    </div>
  );
}
