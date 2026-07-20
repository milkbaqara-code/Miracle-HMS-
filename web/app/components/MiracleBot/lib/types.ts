// ============================================================
// MiracleBot / lib / types.ts
// SOVEREIGN TYPE DEFINITIONS — Shared interfaces for the entire
// MiracleBot architecture. One place, zero duplication.
// V4.0 — Enterprise Refactor
// ============================================================

export interface BotMessage {
  role: 'bot' | 'user' | 'alert' | 'info';
  text: string;
  time: string;
  showContact?: boolean;
  proposal?: ProposalPayload;
}

export interface ZoneInfo {
  name: string;
  zone: string;
  color: string;
}

/** An in-chat AI action proposal (in-memory, attached to a BotMessage) */
export interface ProposalPayload {
  type?: string;
  action: string;
  explanation?: string;
  parameters?: Record<string, any>;
  // V4.0 DB-backed fields
  proposal_id?: string;
  approved?: boolean;
  declined?: boolean;
  resultText?: string;
}

/** A DB-backed proposal fetched from the Proposal Hub endpoint */
export interface PendingProposal {
  id: string;
  session_id: string;
  action: string;
  explanation: string;
  parameters: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'EXECUTED';
  created_at: string;
}

/** Visitor role from the V4.0 Intake Dialog */
export type VisitorRole =
  | 'INVESTOR'
  | 'PROPERTY_OWNER'
  | 'BUYER'
  | 'REALTOR'
  | 'RENTER'
  | 'OPERATOR'
  | 'VISITOR';
