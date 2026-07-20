// ============================================================
// MiracleBot / lib / zoneResolver.ts
// SOVEREIGN ZONE REGISTRY — Maps every URL path to its
// Miracle HMS zone identity (name, zone code, accent color).
// Prefix-based resolution: longest match wins.
// V4.0 — Enterprise Refactor
// ============================================================
import type { ZoneInfo } from './types';

export const ZONES: Record<string, ZoneInfo> = {
  '/':                          { name: 'Login Portal',           zone: 'Z-LOGIN', color: '#00F2FF' },
  '/dashboard':                 { name: 'Command Grid',            zone: 'Z-07',    color: '#00F2FF' },
  '/dashboard/reservations':    { name: 'Reservations',           zone: 'Z-05',    color: '#0062FF' },
  '/dashboard/pos':             { name: 'POS',                    zone: 'Z-06',    color: '#D4AF37' },
  '/dashboard/pos-admin':       { name: 'POS Admin',              zone: 'Z-06',    color: '#D4AF37' },
  '/dashboard/inventory':       { name: 'Inventory',              zone: 'Z-12',    color: '#39FF14' },
  '/dashboard/hr':              { name: 'HR',                     zone: 'Z-09',    color: '#9D00FF' },
  '/dashboard/checkout':        { name: 'Checkout',               zone: 'Z-08',    color: '#FF3131' },
  '/dashboard/issue-tickets':   { name: 'Issue Tickets',          zone: 'Z-16',    color: '#F59E0B' },
  '/dashboard/solve':           { name: 'Solve Portal',           zone: 'Z-17',    color: '#00FF88' },
  '/dashboard/accounts':        { name: 'Accounts & Finance',     zone: 'Z-11',    color: '#00FF88' },
  '/dashboard/agi-accounts':    { name: 'Accounting AGI',         zone: 'Z-11B',   color: '#00FF88' },
  '/dashboard/sovereign-finance': { name: 'Sovereign Finance',    zone: 'Z-11C',   color: '#00FF88' },
  '/dashboard/pms':             { name: 'Property Management',    zone: 'Z-30',    color: '#60a5fa' },
  '/dashboard/synapse':         { name: 'Synapse Nexus',          zone: 'Z-20',    color: '#00fbff' },
  '/dashboard/crm':             { name: 'CRM',                    zone: 'Z-10',    color: '#FF69B4' },
  '/dashboard/audit-ledger':    { name: 'Audit Ledger',           zone: 'Z-19',    color: '#888'    },
  '/dashboard/settings':        { name: 'Settings',               zone: 'Z-21',    color: '#00F2FF' },
  '/dashboard/admin':           { name: 'Admin',                  zone: 'Z-21',    color: '#00F2FF' },
  '/dashboard/portal':          { name: 'Biometric Portal',       zone: 'Z-18',    color: '#00F2FF' },
  '/dashboard/policy':          { name: 'Policy',                 zone: 'Z-19',    color: '#a855f7' },
  '/dashboard/infrastructure':  { name: 'Infrastructure',         zone: 'Z-23',    color: '#22c55e' },
  '/dashboard/media-lab':       { name: 'Media Lab',              zone: 'Z-14',    color: '#f97316' },
  '/dashboard/guest-marketing': { name: 'Guest Marketing',        zone: 'Z-25',    color: '#f97316' },
  '/dashboard/wellness':        { name: 'Wellness & Spa',         zone: 'Z-26',    color: '#4ade80' },
  '/dashboard/boutiques':       { name: 'Boutiques & Retail',     zone: 'Z-27',    color: '#f472b6' },
  '/dashboard/fleet':           { name: 'Fleet & Transport',      zone: 'Z-28',    color: '#60a5fa' },
  '/dashboard/z29-gastronomy':  { name: 'F & B',                  zone: 'Z-29',    color: '#fb923c' },
  '/dashboard/rental':          { name: 'Asset Rentals',          zone: 'Z-3B',    color: '#0EA5E9' },
  '/properties':                { name: 'Miracle Properties',     zone: 'Z-PROP',  color: '#D4AF37' },
  '/web':                       { name: 'Public Website',         zone: 'Z-WEB',   color: '#22d3ee' },
  '/web/careers':               { name: 'Careers Page',           zone: 'Z-WEB',   color: '#22d3ee' },
  '/owner':                     { name: 'Owner Portal',           zone: 'Z-OWNER', color: '#f59e0b' },
  '/owner/hub':                 { name: 'Owner Hub',              zone: 'Z-OWNER', color: '#f59e0b' },
  '/guest':                     { name: 'Guest App',              zone: 'Z-GUEST', color: '#D4AF37' },
  '/guest/concierge':           { name: 'Concierge',              zone: 'Z-GUEST', color: '#D4AF37' },
  '/guest/ecommerce':           { name: 'eCommerce',              zone: 'Z-GUEST', color: '#D4AF37' },
  '/guest/hub':                 { name: 'Guest Hub',              zone: 'Z-GUEST', color: '#D4AF37' },
  '/guest/order':               { name: 'Guest Order',            zone: 'Z-GUEST', color: '#D4AF37' },
  '/guest/folio':               { name: 'Guest Folio',            zone: 'Z-GUEST', color: '#D4AF37' },
  '/guest/loyalty':             { name: 'Guest Loyalty',          zone: 'Z-GUEST', color: '#D4AF37' },
};

/**
 * Resolves the current URL pathname to a ZoneInfo object.
 * Priority: dynamic kernel zones → hardcoded ZONES → safe fallback.
 * Uses longest-prefix matching so /dashboard/pos wins over /dashboard.
 */
export const resolveZone = (path: string | null, kernelZones: any[]): ZoneInfo => {
  if (!path) return { name: 'Login Portal', zone: 'Z-LOGIN', color: '#00F2FF' };
  const cleanPath = path.split('?')[0];

  // 1. Dynamic kernel zones (runtime, from DB)
  if (kernelZones && kernelZones.length > 0) {
    const match = kernelZones
      .filter(z => z.path !== '/' && (cleanPath === z.path || cleanPath.startsWith(z.path)))
      .sort((a, b) => b.path.length - a.path.length)[0];
    if (match) return { name: match.name, zone: match.id, color: '#00F2FF' };
  }

  // 2. Exact match in hardcoded registry
  if (ZONES[cleanPath]) return ZONES[cleanPath];

  // 3. Longest-prefix match
  const match = Object.keys(ZONES)
    .filter(k => k !== '/' && cleanPath.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];

  return match ? ZONES[match] : { name: 'Dashboard', zone: 'Z-07', color: '#00F2FF' };
};
