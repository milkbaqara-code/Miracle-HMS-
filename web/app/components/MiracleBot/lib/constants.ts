// ============================================================
// MiracleBot / lib / constants.ts
// SOVEREIGN CONSTANTS — Single source of truth for all magic
// values used across the MiracleBot architecture.
// V4.0 — Enterprise Refactor
// ============================================================

export const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export const CHART_COLORS = [
  '#00F2FF', '#D4AF37', '#9D00FF', '#39FF14',
  '#FF3131', '#F59E0B', '#60a5fa', '#fb923c',
];

// Zones where visitors can READ but NOT interact with the AI
export const VISITOR_READ_ONLY_ZONES = [
  'Z-08', 'Z-09', 'Z-11', 'Z-18', 'Z-19', 'Z-21', 'Z-23',
];

// Zones where file upload is blocked for visitors
export const VISITOR_BLOCKED_ZONES_FILE = ['Z-12'];

// Zones where the V4.0 Intake Dialog is triggered for unknown visitors
export const INTAKE_TRIGGER_ZONES = ['Z-LOGIN', 'Z-PROP', 'Z-WEB'];
