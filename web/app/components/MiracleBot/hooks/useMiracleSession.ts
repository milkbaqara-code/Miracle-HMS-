'use client';
// ============================================================
// MiracleBot / hooks / useMiracleSession.ts
// Reads session ID, userId, and role from browser storage once
// on mount. Returns stable refs — never triggers re-renders.
// V4.0 — Enterprise Refactor
// ============================================================
import { useRef, useEffect } from 'react';
import { getSessionId } from '../lib/sessionUtils';

export interface SessionData {
  sessionId: React.MutableRefObject<string>;
  userId: React.MutableRefObject<string>;
  role: React.MutableRefObject<string>;
  activeUser: React.MutableRefObject<string>;
  isVisitor: React.MutableRefObject<boolean>;
}

export function useMiracleSession(): SessionData {
  const sessionId  = useRef<string>(getSessionId());
  const userId     = useRef<string>('');
  const role       = useRef<string>('VISITOR');
  const activeUser = useRef<string>('Guest');
  const isVisitor  = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedRole = localStorage.getItem('vigilant_role') || 'VISITOR';
    const storedUser = localStorage.getItem('miracle_user')  || 'Guest';
    const storedId   = localStorage.getItem('miracle_user_id') || '';
    role.current       = storedRole;
    activeUser.current = storedUser;
    userId.current     = storedId;
    isVisitor.current  = storedRole === 'VISITOR' || !storedId;
  }, []);

  return { sessionId, userId, role, activeUser, isVisitor };
}
