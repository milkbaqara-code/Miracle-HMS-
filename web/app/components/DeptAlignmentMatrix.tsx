'use client';
/**
 * DeptAlignmentMatrix.tsx
 * SOVEREIGN HR V2.0 — Super Enterprise Multi-Department Selector
 * Iron Law 9: Dubai Neon-Glass Aesthetic
 * Iron Law 6: useMemo/useCallback for 60FPS
 * Iron Law 10: Decoupled logic hook
 */
import React, { useState, useCallback, useMemo } from 'react';

// ─── STATIC TAXONOMY (mirrors backend SOVEREIGN_DEPT_TAXONOMY) ─────────────
export const DEPT_TAXONOMY: Record<string, { label: string; emoji: string; departments: string[] }> = {
  EXECUTIVE_COMMAND: {
    label: 'Executive Command', emoji: '👑',
    departments: ['Board of Directors', 'Chief Medical Officer', 'Group CEO Office', 'Chief of Staff', 'Executive Advisory']
  },
  CLINICAL_AND_SURGERY: {
    label: 'Clinical & Surgery', emoji: '⚕️',
    departments: ['Physicians', 'Surgeons', 'Medical Specialists', 'Anesthesiology', 'Operating Theater (OT)', 'Outpatient (OPD)']
  },
  NURSING_CARE: {
    label: 'Nursing Care', emoji: '🩺',
    departments: ['Head Nurse', 'ICU Nursing', 'Ward Nursing', 'ER Nursing', 'Pediatric Nursing', 'Midwifery']
  },
  DIAGNOSTICS_AND_LAB: {
    label: 'Diagnostics & Lab', emoji: '🔬',
    departments: ['Laboratory Technicians', 'Radiology & Imaging', 'Pathology', 'Phlebotomy']
  },
  PHARMACY_AND_DISPENSARY: {
    label: 'Pharmacy', emoji: '💊',
    departments: ['Clinical Pharmacists', 'Dispensary', 'Pharmacy Inventory']
  },
  EMERGENCY_AND_EMS: {
    label: 'Emergency & EMS', emoji: '🚑',
    departments: ['ER Doctors', 'Paramedics', 'Ambulance Drivers', 'Trauma Unit']
  },
  PATIENT_RELATIONS: {
    label: 'Patient Relations', emoji: '🤝',
    departments: ['Front Desk & Reception', 'Patient Guides', 'Concierge', 'Admissions & Discharges']
  },
  FINANCE_AND_ADMINISTRATION: {
    label: 'Finance & Admin', emoji: '📊',
    departments: ['Accounts & Audit', 'Billing & Insurance', 'Human Resources', 'Hospital Administration', 'Legal & Compliance']
  },
  FACILITIES_AND_SUPPORT: {
    label: 'Facilities & Support', emoji: '🏢',
    departments: ['Housekeeping', 'Maintenance & Engineering', 'IT & Systems', 'Security']
  }
};

export const EXECUTIVE_TIERS = [
  { key: 'OPERATIVE', label: 'Operative', color: '#6b7280', glow: 'rgba(107,114,128,0.4)' },
  { key: 'MANAGER',   label: 'Manager',   color: '#00fbff', glow: 'rgba(0,251,255,0.4)' },
  { key: 'DIRECTOR',  label: 'Director',  color: '#a855f7', glow: 'rgba(168,85,247,0.4)' },
  { key: 'C-SUITE',   label: 'C-Suite',   color: '#D4AF37', glow: 'rgba(212,175,55,0.4)' },
  { key: 'BOARD',     label: 'Board',     color: '#ff3366', glow: 'rgba(255,51,102,0.4)' },
];

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface DeptAlignmentMatrixProps {
  selectedDepts: string[];
  onChange: (depts: string[]) => void;
  executiveTier: string;
  onTierChange: (tier: string) => void;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function DeptAlignmentMatrix({
  selectedDepts,
  onChange,
  executiveTier,
  onTierChange,
}: DeptAlignmentMatrixProps) {
  const [activeVertical, setActiveVertical] = useState<string | null>(null);

  const visibleDepts = useMemo(() => {
    if (!activeVertical) return null;
    return DEPT_TAXONOMY[activeVertical]?.departments || [];
  }, [activeVertical]);

  const toggleDept = useCallback((dept: string) => {
    if (selectedDepts.includes(dept)) {
      onChange(selectedDepts.filter(d => d !== dept));
    } else {
      onChange([...selectedDepts, dept]);
    }
  }, [selectedDepts, onChange]);

  const primaryDept = selectedDepts[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── EXECUTIVE TIER SELECTOR ─────────────────────────────────────── */}
      <div>
        <label style={{ color: '#9ca3af', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px', display: 'block' }}>
          Executive Tier
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {EXECUTIVE_TIERS.map(tier => {
            const isActive = executiveTier === tier.key;
            return (
              <button
                key={tier.key}
                type="button"
                id={`tier-${tier.key.toLowerCase()}`}
                onClick={() => onTierChange(tier.key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '24px',
                  border: `1.5px solid ${isActive ? tier.color : 'rgba(255,255,255,0.1)'}`,
                  background: isActive ? `rgba(${hexToRgb(tier.color)},0.15)` : 'rgba(255,255,255,0.03)',
                  color: isActive ? tier.color : '#6b7280',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? `0 0 12px ${tier.glow}` : 'none',
                  minWidth: '44px',
                  minHeight: '44px',
                }}
              >
                {tier.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── INDUSTRY VERTICAL FILTER ────────────────────────────────────── */}
      <div>
        <label style={{ color: '#9ca3af', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px', display: 'block' }}>
          Industry Vertical — Select to Browse Departments
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(DEPT_TAXONOMY).map(([key, cat]) => {
            const isActive = activeVertical === key;
            return (
              <button
                key={key}
                type="button"
                id={`vertical-${key.toLowerCase()}`}
                onClick={() => setActiveVertical(isActive ? null : key)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${isActive ? '#00fbff' : 'rgba(255,255,255,0.08)'}`,
                  background: isActive ? 'rgba(0,251,255,0.1)' : 'rgba(255,255,255,0.03)',
                  color: isActive ? '#00fbff' : '#9ca3af',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 0 12px rgba(0,251,255,0.25)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: '44px',
                }}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── DEPARTMENT TILES ────────────────────────────────────────────── */}
      {visibleDepts && (
        <div>
          <label style={{ color: '#9ca3af', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px', display: 'block' }}>
            {activeVertical ? `${DEPT_TAXONOMY[activeVertical].emoji} ${DEPT_TAXONOMY[activeVertical].label} — Click to align` : 'Select a vertical above'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {visibleDepts.map(dept => {
              const isPrimary = dept === primaryDept;
              const isSelected = selectedDepts.includes(dept);
              return (
                <button
                  key={dept}
                  type="button"
                  id={`dept-${dept.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
                  onClick={() => toggleDept(dept)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: isPrimary
                      ? '1.5px solid #D4AF37'
                      : isSelected
                        ? '1.5px solid #00fbff'
                        : '1px solid rgba(255,255,255,0.07)',
                    background: isPrimary
                      ? 'rgba(212,175,55,0.12)'
                      : isSelected
                        ? 'rgba(0,251,255,0.08)'
                        : 'rgba(255,255,255,0.03)',
                    color: isPrimary ? '#D4AF37' : isSelected ? '#00fbff' : '#6b7280',
                    fontSize: '12px',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isPrimary
                      ? '0 0 14px rgba(212,175,55,0.3)'
                      : isSelected
                        ? '0 0 10px rgba(0,251,255,0.2)'
                        : 'none',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '44px',
                  }}
                >
                  <span>{dept}</span>
                  {isPrimary && <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', background: '#D4AF37', color: '#000', borderRadius: '4px', padding: '2px 5px' }}>PRIMARY</span>}
                  {isSelected && !isPrimary && <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', background: 'rgba(0,251,255,0.2)', color: '#00fbff', borderRadius: '4px', padding: '2px 5px' }}>SEC</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SELECTED SUMMARY ────────────────────────────────────────────── */}
      {selectedDepts.length > 0 && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid rgba(212,175,55,0.2)',
          background: 'rgba(212,175,55,0.05)',
        }}>
          <div style={{ color: '#D4AF37', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', marginBottom: '8px' }}>
            ALIGNED DEPARTMENTS ({selectedDepts.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {selectedDepts.map((dept, idx) => (
              <span key={dept} style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 600,
                background: idx === 0 ? 'rgba(212,175,55,0.2)' : 'rgba(0,251,255,0.1)',
                color: idx === 0 ? '#D4AF37' : '#00fbff',
                border: `1px solid ${idx === 0 ? 'rgba(212,175,55,0.4)' : 'rgba(0,251,255,0.25)'}`,
                cursor: 'pointer',
              }} onClick={() => toggleDept(dept)}>
                {idx === 0 ? '★ ' : ''}{dept} ✕
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: convert hex color to rgb values string for rgba()
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : '0,0,0';
}
