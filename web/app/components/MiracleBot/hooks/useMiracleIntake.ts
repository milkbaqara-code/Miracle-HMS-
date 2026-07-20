'use client';
// ============================================================
// MiracleBot / hooks / useMiracleIntake.ts  [V4.0 — NEW]
// Sovereign Visitor Intake — checks if the current session has
// a stored visitor profile. If not, triggers the intake dialog.
// On role selection: POSTs to /api/bot/v2/intake/visitor-profile
// so the AI can respond with a role-personalized greeting.
// V4.0 — Enterprise Refactor
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { API, INTAKE_TRIGGER_ZONES } from '../lib/constants';
import type { VisitorRole } from '../lib/types';

interface IntakeOptions {
  zone: string;
  sessionId: string;
  isVisitor: boolean;
}

export function useMiracleIntake({ zone, sessionId, isVisitor }: IntakeOptions) {
  const [intakeOpen,     setIntakeOpen]     = useState(false);
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [intakeRole,     setIntakeRole]     = useState<VisitorRole | null>(null);
  const [intakeSaving,   setIntakeSaving]   = useState(false);

  // On mount: check if visitor profile already exists for this session
  useEffect(() => {
    if (!isVisitor) { setIntakeComplete(true); return; }
    if (!INTAKE_TRIGGER_ZONES.includes(zone)) return;

    const checkProfile = async () => {
      try {
        const res = await fetch(
          `${API}/bot/v2/intake/visitor-profile?session_id=${sessionId}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.role) {
            setIntakeRole(data.role as VisitorRole);
            setIntakeComplete(true);
            return;
          }
        }
      } catch { /* silent — never block the UI */ }

      // No profile found — show intake dialog after a 1.5s polite delay
      setTimeout(() => setIntakeOpen(true), 1500);
    };

    checkProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, sessionId]);

  const saveIntake = useCallback(async (role: VisitorRole, country = 'BD') => {
    setIntakeSaving(true);
    try {
      await fetch(`${API}/bot/v2/intake/visitor-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, role, country }),
      });
      setIntakeRole(role);
      setIntakeComplete(true);
      setIntakeOpen(false);
    } catch {
      // Silent fail — still close the dialog so the user isn't blocked
      setIntakeComplete(true);
      setIntakeOpen(false);
    } finally {
      setIntakeSaving(false);
    }
  }, [sessionId]);

  return {
    intakeOpen, setIntakeOpen,
    intakeComplete,
    intakeRole,
    intakeSaving,
    saveIntake,
  };
}
