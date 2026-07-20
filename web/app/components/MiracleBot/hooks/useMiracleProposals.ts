'use client';
// ============================================================
// MiracleBot / hooks / useMiracleProposals.ts  [V4.0 — NEW]
// DB-backed Proposal Hub — fetches PENDING proposals from the
// database, exposes approve/decline actions that call the
// V4.0 backend endpoints. Drives the Proposal Hub tray and
// the orb's pending-count badge.
// Polls every 60s; refreshes immediately after any action.
// V4.0 — Enterprise Refactor
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { API } from '../lib/constants';
import type { PendingProposal } from '../lib/types';

interface ProposalOptions {
  sessionId: string;
  role: string;
  activeUser: string;
}

export function useMiracleProposals({ sessionId, role, activeUser }: ProposalOptions) {
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>([]);
  const [hubOpen,          setHubOpen]          = useState(false);
  const pollRef = useRef<any>(null);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/bot/v2/proposals?session_id=${sessionId}&status=PENDING`
      );
      if (res.ok) {
        const data = await res.json();
        setPendingProposals(data.proposals || []);
      }
    } catch { /* silent — never block the UI */ }
  }, [sessionId]);

  // Poll every 60s; fetch immediately on mount
  useEffect(() => {
    fetchProposals();
    pollRef.current = setInterval(fetchProposals, 60_000);
    return () => clearInterval(pollRef.current);
  }, [fetchProposals]);

  const approveProposal = useCallback(async (proposalId: string) => {
    try {
      await fetch(`${API}/bot/v2/proposals/${proposalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: activeUser, role }),
      });
      // Optimistic update
      setPendingProposals(prev => prev.filter(p => p.id !== proposalId));
      await fetchProposals(); // Refresh from DB
    } catch { /* silent */ }
  }, [activeUser, role, fetchProposals]);

  const declineProposal = useCallback(async (proposalId: string) => {
    try {
      await fetch(`${API}/bot/v2/proposals/${proposalId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ declined_by: activeUser, role }),
      });
      setPendingProposals(prev => prev.filter(p => p.id !== proposalId));
      await fetchProposals();
    } catch { /* silent */ }
  }, [activeUser, role, fetchProposals]);

  return {
    pendingProposals,
    pendingCount: pendingProposals.length,
    hubOpen, setHubOpen,
    approveProposal,
    declineProposal,
    refreshProposals: fetchProposals,
  };
}
