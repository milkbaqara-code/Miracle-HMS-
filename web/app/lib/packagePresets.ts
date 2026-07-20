// =====================================================================
// MIRACLE HMS — SOVEREIGN ZONE PACKAGE REGISTRY
// File: web/app/lib/packagePresets.ts
// SOURCE OF TRUTH for all saleable zone packages.
// Edit THIS file to add/remove zones from any package.
// NEVER hardcode zone arrays in any other file.
// =====================================================================

export type PackageId =
  | 'FB_SUITE'
  | 'SPA_SUITE'
  | 'BOUTIQUE_SUITE'
  | 'FLEET_SUITE'
  | 'HOTEL_PRO'
  | 'ENTERPRISE';

export interface ZonePackage {
  id: PackageId;
  name: string;
  tagline: string;
  icon: string;
  color: string;          // brand accent color for the demo session glow
  targetClient: string;   // shown in the launcher card subtitle
  zones: string[];        // CORE zone IDs for this package
  accountingZones: string[]; // accounting/vault zones always included
  demoSeedTag: string;    // tag for future backend demo-data seeding
}

// ─── 6 SOVEREIGN PACKAGES ────────────────────────────────────────────────────
export const ZONE_PACKAGES: ZonePackage[] = [
  {
    id: 'FB_SUITE',
    name: 'F&B Suite',
    tagline: 'Complete restaurant operating system',
    icon: '🍽️',
    color: '#FF6B35',
    targetClient: 'Restaurant, café, bar, food court, canteen',
    zones: [
      'Z-07',        // Command Grid (F&B scoped tiles)
      'Z-29',        // F&B / Gastronomy — menu catalog & BOM engine
      'Z-KDS',       // Kitchen Display System — real-time order board
      'Z-MENU',      // Guest QR Menu — table self-ordering
      'Z-DELIVERY',  // Rider Portal — dispatch, location, CoD wallet
      'Z-12',        // Inventory Matrix — stock, BOM, wastage
      'Z-08',        // Checkout / Billing — till settlement
      'Z-16',        // Issue Tickets — equipment faults, supplier issues
      'Z-17',        // Solve (Staff) — kitchen/service task resolution
      'Z-25',        // Guest Marketing — promo campaigns, vouchers
      'Z-GUEST',     // Guest Concierge — QR table ordering
    ],
    accountingZones: [
      'Z-VAULT',   // Dept Vault — Z-29 till + primary ledger
      'Z-DEPT-GW', // Batch Gateway — 20-tx consent layer
    ],
    demoSeedTag: 'FB_DEMO',
  },

  {
    id: 'SPA_SUITE',
    name: 'Spa & Wellness Suite',
    tagline: 'Complete wellness center management',
    icon: '🧬',
    color: '#7C3AED',
    targetClient: 'Spa, salon, wellness center, gym, clinic',
    zones: [
      'Z-07',   // Command Grid (Wellness scoped tiles)
      'Z-27',   // Med-Spa & Wellness — bookings, treatment BOM
      'Z-12',   // Inventory Matrix — products, amenities, retail stock
      'Z-08',   // Checkout / Billing — treatment payments
      'Z-10',   // CRM / Guest Loyalty — membership, profiles
      'Z-16',   // Issue Tickets
      'Z-17',   // Solve (Staff)
      'Z-GUEST',// Guest Concierge — booking requests
    ],
    accountingZones: [
      'Z-VAULT',
      'Z-DEPT-GW',
    ],
    demoSeedTag: 'SPA_DEMO',
  },

  {
    id: 'BOUTIQUE_SUITE',
    name: 'Boutique & Retail Suite',
    tagline: 'Complete retail management system',
    icon: '🛍️',
    color: '#DB2777',
    targetClient: 'Boutique, gift shop, mini-mart, luxury retail',
    zones: [
      'Z-07',   // Command Grid (Retail scoped tiles)
      'Z-28',   // Luxury Boutiques — retail POS, product catalog
      'Z-12',   // Inventory Matrix — stock control, reorder alerts
      'Z-08',   // Checkout / Billing — cash, card, online
      'Z-10',   // CRM / Guest Loyalty — loyalty points, profiles
      'Z-25',   // Guest Marketing — promo campaigns
      'Z-16',   // Issue Tickets
      'Z-17',   // Solve (Staff)
    ],
    accountingZones: [
      'Z-VAULT',
      'Z-DEPT-GW',
    ],
    demoSeedTag: 'BOUTIQUE_DEMO',
  },

  {
    id: 'FLEET_SUITE',
    name: 'Fleet & Transport Suite',
    tagline: 'Complete transport operation management',
    icon: '🚁',
    color: '#0891B2',
    targetClient: 'Car rental, tour operator, aviation, transport company',
    zones: [
      'Z-07',   // Command Grid (Fleet scoped tiles)
      'Z-26',   // Fleet & Aviation — vehicle catalog, trip logs
      'Z-12',   // Inventory Matrix — fuel, parts, maintenance supplies
      'Z-3B',   // Asset Rentals — long-term vehicle/asset leasing
      'Z-08',   // Checkout / Billing — trip charges, rental settlement
      'Z-16',   // Issue Tickets — breakdown, maintenance requests
      'Z-17',   // Solve (Staff) — driver/mechanic task resolution
    ],
    accountingZones: [
      'Z-VAULT',
      'Z-DEPT-GW',
    ],
    demoSeedTag: 'FLEET_DEMO',
  },

  {
    id: 'HOTEL_PRO',
    name: 'Hotel Pro',
    tagline: 'Full hotel operation — PMS + revenue departments',
    icon: '🏢',
    color: '#D4AF37',
    targetClient: 'Boutique hotel, guesthouse, serviced apartments',
    zones: [
      'Z-07',   // Command Grid
      'Z-30',   // Sovereign PMS — room management, check-in/out, folio
      'Z-05',   // Reservations — booking engine, OTA sync
      'Z-08',   // Checkout / Billing — folio settlement
      'Z-10',   // CRM / Guest Loyalty
      'Z-09',   // HR / Personnel
      'Z-20',   // Synapse Nexus — internal comms
      'Z-29',   // F&B Gastronomy
      'Z-27',   // Spa & Wellness
      'Z-28',   // Boutique
      'Z-12',   // Inventory Matrix
      'Z-16',   // Issue Tickets
      'Z-17',   // Solve (Staff)
      'Z-25',   // Guest Marketing
      'Z-31',   // Owner Bridge
      'Z-GUEST',// Guest Concierge
      'Z-OWNER',// Owner Portal
    ],
    accountingZones: [
      'Z-11',      // Accounts & Audit
      'Z-1B',      // Ledger Auth Gateway
      'Z-VAULT',
      'Z-DEPT-GW',
      'Z-MASTER',  // Master Ledger
    ],
    demoSeedTag: 'HOTEL_DEMO',
  },

  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Full 31-zone Miracle HMS — unlimited power',
    icon: '🌐',
    color: '#00F2FF',
    targetClient: 'Full resort, hotel group, multi-property chain',
    // Empty = no filter applied — show ALL zones (handled in getAllowedZonesForPackage)
    zones: [],
    accountingZones: [],
    demoSeedTag: 'ENTERPRISE_DEMO',
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Get a single package definition by ID */
export const getPackage = (id: PackageId): ZonePackage | undefined =>
  ZONE_PACKAGES.find(p => p.id === id);

/**
 * Returns the full list of allowed zone IDs for a package.
 * Returns null for ENTERPRISE (null = show all zones, no filter).
 */
export const getAllowedZonesForPackage = (id: PackageId): string[] | null => {
  const pkg = getPackage(id);
  if (!pkg) return null;
  if (pkg.zones.length === 0) return null; // Enterprise = no filter
  return [...pkg.zones, ...pkg.accountingZones];
};

/** Reads the active package from localStorage (client-side only) */
export const getActivePackage = (): ZonePackage | null => {
  if (typeof window === 'undefined') return null;
  const id = localStorage.getItem('miracle_package') as PackageId | null;
  if (!id) return null;
  return getPackage(id) || null;
};

/**
 * Sets a package demo session in localStorage.
 * This wires directly into the existing sidebar filter in layout.tsx
 * which reads miracle_visitor_allowed_zones.
 */
export const activatePackageDemo = (pkg: ZonePackage): void => {
  if (typeof window === 'undefined') return;

  // Auth identity (VISITOR role triggers the sidebar zone filter)
  localStorage.setItem('miracle_token', 'PACKAGE_DEMO_SESSION');
  localStorage.setItem('miracle_user', `${pkg.name} Demo`);
  localStorage.setItem('vigilant_role', 'VISITOR');
  localStorage.setItem('miracle_demo_expires_at', (Date.now() + 20 * 60 * 1000).toString());

  // Cookie sync to satisfy Next.js middleware bouncer
  document.cookie = 'miracle_session_token=PACKAGE_DEMO_SESSION; path=/; max-age=7200; SameSite=Lax';

  // Zone scope — the sidebar reads this key (layout.tsx lines 225-244)
  const zones = getAllowedZonesForPackage(pkg.id);
  if (zones) {
    localStorage.setItem('miracle_visitor_allowed_zones', JSON.stringify(zones));
  } else {
    // Enterprise: remove the filter so all zones show
    localStorage.removeItem('miracle_visitor_allowed_zones');
  }

  // Package identity — used by dashboard header and AI context
  localStorage.setItem('miracle_package', pkg.id);
  localStorage.setItem('miracle_package_name', pkg.name);
  localStorage.setItem('miracle_package_color', pkg.color);
  localStorage.setItem('miracle_package_icon', pkg.icon);
};
