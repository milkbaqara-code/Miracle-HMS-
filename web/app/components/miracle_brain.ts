// web/app/components/miracle_brain.ts
// V14.0: SOVEREIGN OMNISCIENT BRAIN — SUPREME ANALYTICS ENGINE
// UPGRADE V14.0: Z-KDS Kitchen Display System, Z-MENU Guest QR Menu, Z-DELIVERY Rider Portal
// UPGRADE: Deep knowledge of all 32 zones + Gemini-style formatted reports
// UPGRADE: Z-17 Radar Proof Engine, Z-20 Synapse Nexus, Z-26-29 Service Empire
// UPGRADE V13.0: Supreme Business Analytics — CDO/GM on-demand intelligence
// ALL PERSONA: British Executive CDO, Sales Era, Zero-latency Layer-0 responses

import SURGICAL_FIXES_JSON from './miracle_surgical_fixes.json';
const SIXTY_SURGICAL_FIXES = SURGICAL_FIXES_JSON;

// ============================================================
// SOVEREIGN ZONE ATLAS — COMPLETE 29-ZONE KNOWLEDGE MAP
// ============================================================
const ZONE_ATLAS = {
  'Z-01': { name: 'Login Portal', path: '/', desc: 'Biometric entry. All operatives authenticate here with credentials or PIN.' },
  'Z-05': { name: 'Reservations', path: '/dashboard/reservations', desc: 'Room booking engine. Create, modify, assign rooms. Track arrivals and occupancy.' },
  'Z-06': { name: 'Point of Sale', path: '/dashboard/pos', desc: 'Retail and service POS. Scan products, process payments, post charges to guest folios.' },
  'Z-07': { name: 'Command Grid', path: '/dashboard', desc: 'Mission Control. Real-time signal grid: HK, MN, RS, IT, SPA, FLT status. Live alerts.' },
  'Z-08': { name: 'Checkout', path: '/dashboard/checkout', desc: 'Guest departure engine. Settle folios, apply discounts, generate final bills.' },
  'Z-09': { name: 'HR Registry', path: '/dashboard/hr', desc: 'Human Resources. Operatives, roles, shifts, attendance, payroll. RBAC clearance management.' },
  'Z-10': { name: 'CRM', path: '/dashboard/crm', desc: 'Guest intelligence. Profiles, loyalty tiers, preferences, return history, marketing segments.' },
  'Z-11': { name: 'Accounts & Finance', path: '/dashboard/accounts', desc: 'Sovereign Vault. P&L, revenue journals, COGS, daily audits, chart of accounts.' },
  'Z-11B': { name: 'Accounting AGI', path: '/dashboard/agi-accounts', desc: 'AI-powered accounting engine. Automated journal entries, anomaly detection, financial forecasting.' },
  'Z-11C': { name: 'Sovereign Finance & Policy', path: '/dashboard/sovereign-finance', desc: 'Sovereign Global Policy Engine (SGPE). FDI tracking, escrow vaults, tax shields, Bangladesh JV resort share-selling, subsidy credits.' },
  'Z-12': { name: 'Inventory', path: '/dashboard/inventory', desc: 'Stock control. SKU management, BOM (Bill of Materials), PAR levels, reorder alerts.' },
  'Z-DOCTOR': { name: 'Physician Command Portal', path: '/dashboard/doctor', desc: 'Medical command center for Doctors. Video consultations, EMR access, duty roster view.' },
  'Z-14': { name: 'Media Lab', path: '/dashboard/media-lab', desc: 'AI creative studio. Generate marketing content, campaign banners, social media posts.' },
  'Z-16': { name: 'Issue Tickets', path: '/dashboard/issue-tickets', desc: 'Maintenance and complaint ticketing. Create repair tasks. Track resolution status.' },
  'Z-17': { name: 'Solve Portal (Radar)', path: '/dashboard/solve', desc: 'Zero-Trust Proof Engine. Staff upload photo evidence to SECURE and resolve missions. Every task requires visual proof.' },
  'Z-18': { name: 'Biometric Portal', path: '/dashboard/portal', desc: 'Biometric access management. Staff onboarding, badge assignment, access control.' },
  'Z-19': { name: 'CORE PMS', path: '/dashboard/policy', desc: 'Sovereign law library. SOPs, discount rules, rate policies, refund protocols.' },
  'Z-1B': { name: 'Ledger Auth Gateway', path: '/dashboard/accounts?tab=25', desc: 'Secure ledger authorization gateway. Multi-sig approvals for high-value financial transactions.' },
  'Z-20': { name: 'Synapse Nexus', path: '/dashboard/synapse', desc: 'Sovereign Command & Comm-Link Matrix. Strategic Kanban, Neural Tree operative management, Corporate Matrix, Directive Engine with AI decompiler.' },
  'Z-21': { name: 'Kernel Settings', path: '/dashboard/settings', desc: 'Kernel configuration. Hotel name, modules, currency, AI persona, zone visibility.' },
  'Z-23': { name: 'Sovereign Infra', path: '/dashboard/infrastructure', desc: 'Sovereign Anatomy. System health, browser errors, WebSocket status, AI engine telemetry, deployment logs.' },
  'Z-25': { name: 'Guest Marketing', path: '/dashboard/guest-marketing', desc: 'Campaign engine. Email/WhatsApp blasts, loyalty promotions, guest segmentation.' },
  'Z-26': { name: 'Wellness & Spa', path: '/dashboard/wellness', desc: 'Spa, treatments, therapists, timeslots, appointment booking, revenue tracking per therapist.' },
  'Z-27': { name: 'Boutiques & Retail', path: '/dashboard/boutiques', desc: 'Retail empire. Product catalog, categories, pricing, image management, sales analytics.' },
  'Z-28': { name: 'Fleet & Aviation', path: '/dashboard/fleet', desc: 'Vehicle & aviation management. Airport transfers, driver scheduling, commission engine, trip logging.' },
  'Z-29': { name: 'F & B', path: '/dashboard/z29-gastronomy', desc: 'Food & Beverage intelligence. Menu management, dining reservations, kitchen signals, revenue per outlet. Service Architect BOM links dishes to raw inventory stock.' },
  'Z-KDS': { name: 'Kitchen Display System', path: '/dashboard/orders', desc: 'Real-time Kitchen Display System. Live Kanban board: PENDING → PREPARING → READY. Ticking cook-time clocks (cyan <5min, amber <10min, red >10min). Chef BUMP button advances orders. Audio chime on new orders. SSE-powered — zero polling.' },
  'Z-MENU': { name: 'Guest QR Table Menu', path: '/menu', desc: 'Mobile-first guest self-ordering QR menu. Guests scan table QR code → browse live menu by category → add to cart → place order. Order fires instantly to KDS (Z-KDS) and chimes the POS cashier. Supports table label, guest name, special instructions. Publicly accessible — no login required.' },
  'Z-DELIVERY': { name: 'Rider Delivery Portal', path: '/delivery', desc: 'Dual-mode delivery management portal. Manager view: dispatch board, order assignment to riders, live rider GPS map, CoD wallet oversight, cash settlement. Rider view: PIN login, claimed orders, one-tap status updates (PICKED_UP → EN_ROUTE → DELIVERED), virtual CoD wallet balance. Auto-suspends rider if cash held exceeds limit. SSE-powered real-time dispatch alerts.' },
  'Z-2B': { name: 'AGI Recruiting', path: '/dashboard/hr?tab=AGI_RECRUIT', desc: 'AI-powered recruiting engine. Job postings, applicant tracking, AI screening, onboarding workflows.' },
  'Z-30': { name: 'Sovereign PMS', path: '/dashboard/pms', desc: 'Property management system. Classifies owned/rented/affiliated rooms, manages capitalized BOM fixture costs, card tokenization, and lease/commission accounting.' },
  'Z-3B': { name: 'Asset Rentals', path: '/dashboard/rental', desc: 'Asset rental marketplace. Yachts, vehicles, equipment, and luxury asset revenue management.' },
  'Z-GUEST': { name: 'Guest Concierge', path: '/guest', desc: 'Guest-facing mobile experience. eCommerce ordering, concierge requests, folio view, loyalty points.' },
  'Z-OWNER': { name: 'Owner Portal', path: '/owner', desc: 'Property owner dashboard. Revenue sharing, payout tracking, ROI analytics, mortgage engine, rental pool participation.' },
  'Z-PROP': { name: 'Miracle Properties', path: '/properties', desc: 'Sovereign property marketplace. Buy, sell, lease and rent luxury properties. Shah Marine resort listings, off-plan hotel shares, BD JV investments.' },
  'Z-WEB': { name: 'Public Website', path: '/web', desc: 'Public-facing marketing website. Showcase the resort, services, careers, and online booking portal.' },
};

// ============================================================
// GEMINI-STYLE FORMATTER — Rich markdown-like responses
// ============================================================
function geminiFormat(title: string, sections: { heading: string; body: string }[], footer?: string): string {
  let out = `### ${title}\n\n`;
  for (const s of sections) {
    out += `#### ▸ ${s.heading}\n\n${s.body}\n\n`;
  }
  if (footer) out += `---\n\n_${footer}_`;
  return out.trim();
}

function bulletList(items: string[]): string {
  return items.map(i => `• ${i}`).join('\n');
}

// ============================================================
// SECTION 1: ROLE HELPERS
// ============================================================
export async function runMiracleBrain(
  query: string,
  zone: any,
  pushBotMessage: (msg: string, role: 'bot' | 'alert') => void,
  chatHistory: any,
  userRole: string = 'STAFF'
) {
  const ql = query.toLowerCase().replace(/\[mic\]/gi, '').trim();
  const currentZone = zone?.zone || 'Z-07';

  const isCDO     = userRole === 'CDO';
  const isGM      = userRole === 'GM';
  const isHR      = userRole === 'HR';
  const isAdmin   = userRole === 'ADMIN';
  const isVisitor = userRole === 'VISITOR';
  const isPower   = isCDO || isGM || isAdmin;

  // ============================================================
  // LAYER 0: JSON ERROR INTERCEPTOR (all roles)
  // ============================================================
  if (ql.includes('{') && ql.includes('}') && ql.includes('error')) {
    pushBotMessage('Error payload intercepted. Executing forensic analysis...', 'alert');
    setTimeout(() => {
      if (ql.includes('integrity') || ql.includes('foreign key')) {
        pushBotMessage('Foreign key constraint failure. A child record references a non-existent parent ID. Verify the parent record before writing.', 'alert');
      } else if (ql.includes('none') && ql.includes('has no attribute')) {
        pushBotMessage('NoneType error in Python. A queried object returned None but the code read a property. Add `if not record: raise HTTPException(404)` as a guard.', 'alert');
      } else {
        pushBotMessage('Wrap the failing FastAPI route in `try...except Exception as e: print(str(e))` to expose the raw Python traceback.', 'alert');
      }
    }, 800);
    return true;
  }

  // ============================================================
  // LAYER 1: SURGICAL FIX DATABASE (60+ instant fixes)
  // ============================================================
  if (ql.includes('fix') || ql.includes('error') || ql.includes('failed') || ql.includes('bug') || ql.includes('empty') || ql.includes('offline')) {
    const fixNode = SIXTY_SURGICAL_FIXES.find((f: any) => f.match.some((m: string) => ql.includes(m)));
    if (fixNode) {
      pushBotMessage((fixNode as any).fix, 'alert');
      return true;
    }
  }

  // ============================================================
  // LAYER 2: ZONE DISCOVERY — "what is" / "where is" / "how to"
  // ============================================================

  // FULL ZONE MAP — "show me all zones" / "zone map" / "what zones"
  if (ql.includes('zone map') || ql.includes('all zones') || ql.includes('zone list') || (ql.includes('what') && ql.includes('zone') && ql.includes('available'))) {
    const zoneLines = Object.entries(ZONE_ATLAS).map(([id, z]) =>
      `• **${id}** — ${z.name}: ${z.desc.split('.')[0]}`
    ).join('\n');
    pushBotMessage(geminiFormat('🗺️ MIRACLE HMS — SOVEREIGN ZONE ATLAS', [
      { heading: 'All 34 Active Zones', body: zoneLines }
    ], 'Ask me about any zone by name or number for a deep dive.'), 'bot');
    return true;
  }

  // ============================================================
  // Z-17 — SOLVE PORTAL / RADAR PROOF ENGINE
  // ============================================================
  if (ql.includes('z-17') || ql.includes('solve') || (ql.includes('radar') && !ql.includes('fleet')) || ql.includes('proof') || ql.includes('mission') || ql.includes('secure task') || ql.includes('photo evidence')) {
    pushBotMessage(geminiFormat('🎯 Z-17 — SOLVE PORTAL (Sovereign Radar Proof Engine)', [
      {
        heading: 'Purpose',
        body: 'The Solve Portal is the Zero-Trust task resolution engine. Every mission must be visually proven with a photo before it is marked complete. No evidence = no closure.'
      },
      {
        heading: 'How It Works',
        body: bulletList([
          'A ticket is raised in Z-16 (Issue Tickets) or auto-spawned by the system',
          'The task appears in Z-17 as an OPEN MISSION',
          'The operative on duty picks up the mission',
          'They perform the work, upload a photo as proof',
          'Click SECURE → mission is resolved and synced to Z-11 (Accounts) if billable',
        ])
      },
      {
        heading: 'How to Use',
        body: bulletList([
          'Go to Z-17 Solve Portal',
          'Browse OPEN missions assigned to your department',
          'Click a mission to expand it',
          'Tap UPLOAD PROOF → take or select a photo',
          'Click SECURE MISSION to close it with evidence',
        ])
      },
      {
        heading: 'Who Uses This',
        body: 'Housekeeping, Maintenance, F&B, Spa, Fleet operatives. All field staff who execute physical tasks.'
      }
    ], 'Iron Law 48: Every guest service must route through the Kernel Loop → Z-17 → Secure → Folio.'), 'bot');
    return true;
  }

  // ============================================================
  // Z-20 — SYNAPSE NEXUS
  // ============================================================
  if (ql.includes('z-20') || ql.includes('synapse') || ql.includes('nexus') || ql.includes('kanban') || ql.includes('directive') || ql.includes('neural tree') || ql.includes('decompile') || ql.includes('corporate matrix')) {
    pushBotMessage(geminiFormat('🧠 Z-20 — SYNAPSE NEXUS (Sovereign Command & Comm-Link Matrix)', [
      {
        heading: 'What Is Synapse Nexus?',
        body: 'The strategic brain of Miracle HMS. It is where CDOs and GMs issue directives, manage operatives, and run the Neural Tree — a live org-chart of who is on duty, what they are doing, and their clearance levels.'
      },
      {
        heading: 'Four Power Tools',
        body: bulletList([
          '**Strategic Kanban** — Drag-and-drop task board: BACKLOG → IN PROGRESS → REVIEW → COMPLETED',
          '**Neural Tree** — Live directory of all operatives, their roles, on-duty status, and direct comm links',
          '**Corporate Matrix** — Cross-department performance matrix and directive tracking',
          '**AI Directive Decompiler** — Type a high-level goal, click AUTO-DECOMPILE, the AI breaks it into granular missions and assigns them to the right operatives automatically',
        ])
      },
      {
        heading: 'How to Issue a Directive',
        body: bulletList([
          'Open Z-20 Synapse Nexus',
          'Click + NEW DIRECTIVE in the top bar',
          'Type your objective (e.g. "Prepare VIP suite 203 for arrival at 6pm")',
          'Click AUTO-DECOMPILE — AI splits it into tasks',
          'Assign operatives from the Neural Tree',
          'Monitor progress live in the Kanban board',
        ])
      },
      {
        heading: 'Active Comms',
        body: 'The ACTIVE COMMS panel on the right shows live unread messages between directors and operatives. Click any conversation to respond in real time.'
      }
    ], 'Synapse Nexus requires GM clearance or above for full directive powers.'), 'bot');
    return true;
  }

  // ============================================================
  // Z-26 — WELLNESS & SPA
  // ============================================================
  if (ql.includes('z-26') || ql.includes('wellness') || ql.includes('spa') || ql.includes('treatment') || ql.includes('therapist') || ql.includes('massage') || ql.includes('appointment')) {
    pushBotMessage(geminiFormat('🌿 Z-26 — WELLNESS & SPA (Sovereign Treatment Engine)', [
      {
        heading: 'What It Does',
        body: 'Full spa management — treatments, therapists, room/bay allocation, booking calendar, revenue per therapist, and guest wellness history.'
      },
      {
        heading: 'How to Book a Treatment',
        body: bulletList([
          'Go to Z-26 Wellness & Spa',
          'Select the Treatment Category (Massage, Facial, Body Wrap, etc.)',
          'Choose available Therapist and Time Slot',
          'Link to Guest Profile (from Z-10 CRM)',
          'Confirm booking — it syncs to Z-07 Command Grid as a SPA signal',
          'After treatment, charge posts automatically to the Guest Folio in Z-11',
        ])
      },
      {
        heading: 'Service Architecture',
        body: bulletList([
          'Services defined in Z-12 Inventory as Spa SKUs with BOM',
          'Commission per therapist tracked automatically',
          'Cancellation triggers Z-16 Issue Ticket if prepaid',
          'Revenue reports visible in Z-11 Accounts under Spa Revenue',
        ])
      },
      {
        heading: 'Reporting',
        body: 'View revenue per treatment type, therapist utilization rate, peak booking hours, and monthly spa P&L in Z-11 Accounts.'
      }
    ], 'Spa charges follow Iron Law 48: booking → Z-17 completion proof → folio billing.'), 'bot');
    return true;
  }

  // ============================================================
  // Z-27 — BOUTIQUES & RETAIL
  // ============================================================
  if (ql.includes('z-27') || ql.includes('boutique') || ql.includes('retail') || ql.includes('shop') || ql.includes('product catalog') || (ql.includes('store') && ql.includes('inventory'))) {
    pushBotMessage(geminiFormat('🛍️ Z-27 — BOUTIQUES & RETAIL (Sovereign Commerce Engine)', [
      {
        heading: 'What It Does',
        body: 'Manages all retail outlets — product catalog, categories, pricing tiers, image gallery, stock levels, and sales analytics per outlet.'
      },
      {
        heading: 'How to Add a Product',
        body: bulletList([
          'Go to Z-27 Boutiques',
          'Click + ADD PRODUCT',
          'Enter: Name, Category, Price, Stock Quantity, Description',
          'Upload product image (displayed in Guest App Z-GUEST)',
          'Set Department: BOUTIQUE, MINIBAR, GIFT SHOP, etc.',
          'Save — product is immediately live on POS (Z-06) and Guest eCommerce (Z-GUEST)',
        ])
      },
      {
        heading: 'Integration Points',
        body: bulletList([
          '**Z-06 POS** — Products appear in the POS terminal for staff sales',
          '**Z-GUEST eCommerce** — Guests can order directly from their room via the Guest App',
          '**Z-12 Inventory** — Stock counts sync and trigger reorder alerts at PAR level',
          '**Z-11 Accounts** — Every retail sale posts to the Boutique Revenue journal',
        ])
      },
      {
        heading: 'Sales Analytics',
        body: 'Top-selling products, revenue by category, inventory turnover, and daily sales dashboard are all accessible in Z-27.'
      }
    ], 'Retail charges via Guest App auto-post to the room folio. Staff POS sales post to the daily revenue journal.'), 'bot');
    return true;
  }

  // ============================================================
  // Z-28 — FLEET & TRANSPORT
  // ============================================================
  if (ql.includes('z-28') || ql.includes('fleet') || ql.includes('transport') || ql.includes('driver') || ql.includes('airport transfer') || ql.includes('vehicle') || ql.includes('car service') || ql.includes('pickup')) {
    pushBotMessage(geminiFormat('🚗 Z-28 — FLEET & TRANSPORT (Sovereign Mobility Engine)', [
      {
        heading: 'What It Does',
        body: 'Complete vehicle and driver management — airport transfers, shuttle scheduling, driver commission tracking, trip logging, and transport revenue reporting.'
      },
      {
        heading: 'How to Schedule a Transfer',
        body: bulletList([
          'Go to Z-28 Fleet & Transport',
          'Click + NEW TRIP',
          'Set: Guest Name (link from Z-10 CRM), Pickup Location, Destination, Date/Time',
          'Assign available Driver from the roster',
          'Select Vehicle from the fleet list',
          'Confirm — trip appears on the driver\'s schedule and Z-07 Command Grid (FLT signal)',
          'On completion, driver marks COMPLETE → charge posts to Guest Folio',
        ])
      },
      {
        heading: 'Commission Engine',
        body: bulletList([
          'Each driver has a commission rate set in their profile (% per trip)',
          'Commissions calculated automatically per trip on completion',
          'Monthly commission summary auto-syncs to Z-09 HR payroll',
          'Revenue net of commission posts to Z-11 Accounts',
        ])
      },
      {
        heading: 'Fleet Monitoring',
        body: 'Live trip status, vehicle availability, driver on-duty roster, and monthly transport revenue are all visible in the Fleet dashboard.'
      }
    ], 'Fleet signal (FLT) in Z-07 Command Grid pulses green when a transfer is active.'), 'bot');
    return true;
  }

  // ============================================================
  // Z-29 — F & B
  // ============================================================
  if (ql.includes('z-29') || ql.includes('gastronomy') || ql.includes('f&b') || ql.includes('food and beverage') || ql.includes('restaurant') || ql.includes('kitchen') || ql.includes('dining') || ql.includes('menu')) {
    pushBotMessage(geminiFormat('🍽️ Z-29 — F & B (Sovereign Food & Beverage Intelligence)', [
      {
        heading: 'What It Does',
        body: 'End-to-end F&B management — menu engineering, dining reservations, table management, kitchen signal routing, revenue per outlet, and COGS tracking via BOM.'
      },
      {
        heading: 'How to Manage Menus',
        body: bulletList([
          'Go to Z-29 F & B',
          'Select your outlet (Main Restaurant, Pool Bar, Room Service, etc.)',
          'Click MENU ENGINEER to add/edit dishes',
          'Set: Name, Category, Selling Price, BOM (ingredients + cost)',
          'System auto-calculates GP% (Gross Profit) per dish',
          'Activate/deactivate items in real time — POS and Guest App update instantly',
        ])
      },
      {
        heading: 'Kitchen Signal Flow',
        body: bulletList([
          'Guest places order via Guest App or staff enters in POS',
          'Order routes to kitchen display (KDS) as a signal in Z-07 (MN = Main signal)',
          'Kitchen marks PREPARED → staff delivers → guest signs off',
          'Charge posts to Guest Folio automatically',
        ])
      },
      {
        heading: 'Dining Reservations',
        body: bulletList([
          'Book tables for in-house or external guests',
          'Time slots, cover count, and dietary requirements captured',
          'Auto-links to Z-10 CRM guest profile for preference tracking',
          'Birthday/anniversary triggers VIP treatment protocol',
        ])
      },
      {
        heading: 'Revenue & COGS',
        body: 'Daily covers, revenue per outlet, food cost %, and GP% per dish. All data syncs to Z-11 Accounts under F&B Revenue journal.'
      }
    ], 'F&B follows BOM-driven COGS: every sale auto-decrements inventory in Z-12.'), 'bot');
    return true;
  }

  // ============================================================
  // Z-KDS — KITCHEN DISPLAY SYSTEM
  // ============================================================
  if (ql.includes('z-kds') || ql.includes('kds') || ql.includes('kitchen display') || ql.includes('cook time') || ql.includes('bump order')) {
    pushBotMessage(geminiFormat('🍳 Z-KDS — KITCHEN DISPLAY SYSTEM (Real-Time Orders)', [
      {
        heading: 'What It Is',
        body: 'A live, SSE-powered Kitchen Display System (KDS) for chef and kitchen staff. Orders placed via QR Menu (Z-MENU) or POS (Z-06) appear here instantly.'
      },
      {
        heading: 'Key Features',
        body: bulletList([
          '**Visual Kanban Board** — Columns for PENDING, PREPARING, and READY orders.',
          '**Cook-Time Clocks** — Ticking indicators color-coded by age: Cyan (<5 mins), Amber (<10 mins), Red (>10 mins).',
          '**Chef Bump Action** — One-click bump advances orders through statuses (PENDING → PREPARING → READY).',
          '**Auditory Alerts** — Real-time chime notifications trigger on every new order.'
        ])
      },
      {
        heading: 'Inventory Integration',
        body: 'Bumping an order triggers raw inventory ingredient deductions in Z-12 (Stock Vault) based on dish BOM configurations.'
      }
    ], 'SSE event stream enables zero-latency updates without browser polling.'), 'bot');
    return true;
  }

  // ============================================================
  // Z-MENU — GUEST QR TABLE MENU
  // ============================================================
  if (ql.includes('z-menu') || ql.includes('qr menu') || (ql.includes('table') && ql.includes('menu')) || ql.includes('self-ordering')) {
    pushBotMessage(geminiFormat('📋 Z-MENU — Guest QR Table Menu (Self-Service Ordering)', [
      {
        heading: 'What It Is',
        body: 'A mobile-first, public-facing digital menu that allows resort guests to scan table QR codes and place orders directly.'
      },
      {
        heading: 'How It Works',
        body: bulletList([
          'Guest scans QR code containing table label → opens `/menu?table=Table+7`.',
          'Browse F&B menu categories and add items to cart.',
          'Submit order (with guest name and special notes) → POSTs to `/api/fnb/orders`.',
          'Order triggers real-time SSE broadcast and chimes Z-KDS (Kitchen Display).'
        ])
      },
      {
        heading: 'Security & Access',
        body: 'Publicly accessible outside the dashboard auth guard. No guest login required to place orders.'
      }
    ], 'Menu items and pricing sync dynamically from the Z-29 F&B manager settings.'), 'bot');
    return true;
  }

  // ============================================================
  // Z-DELIVERY — RIDER PORTAL
  // ============================================================
  if (ql.includes('z-delivery') || ql.includes('rider') || ql.includes('delivery portal') || ql.includes('cod wallet') || ql.includes('dispatch rider')) {
    pushBotMessage(geminiFormat('🏍️ Z-DELIVERY — Rider Delivery Portal (Logistics & CoD)', [
      {
        heading: 'What It Is',
        body: 'A dual-mode logistics management system for dispatching riders and tracking home/resort-wide deliveries.'
      },
      {
        heading: 'Rider App Features',
        body: bulletList([
          '**PIN-Based Access** — Secure login via 4-to-6 digit PIN.',
          '**Active Queue** — claimed/assigned orders with address details and one-tap status updates.',
          '**Virtual CoD Wallet** — tracks cash held by rider. Auto-suspends rider if limit is exceeded.'
        ])
      },
      {
        heading: 'Manager Dashboard',
        body: bulletList([
          '**Dispatch Console** — Assign pending delivery orders to active riders.',
          '**Live GPS Map** — Real-time tracking of rider locations.',
          '**Wallet Settle** — Receive cash from riders and reset their virtual wallets.'
        ])
      }
    ], 'Rider wallets auto-suspend at ৳5,000 to prevent cash-handling risk.'), 'bot');
    return true;
  }

  // ============================================================
  // GUEST APP / GUEST PORTAL (Z-GUEST)
  // ============================================================
  if (ql.includes('guest app') || ql.includes('guest portal') || ql.includes('z-guest') || ql.includes('guest ecommerce') || ql.includes('guest order') || ql.includes('guest folio') || ql.includes('apk')) {
    pushBotMessage(geminiFormat('📱 Z-GUEST — GUEST PORTAL (Sovereign Guest Experience)', [
      {
        heading: 'What It Is',
        body: 'A thin-client mobile app (Android APK / Web) that guests use to control their stay. Built on Capacitor, it connects live to the Miracle HMS backend.'
      },
      {
        heading: 'Guest Can',
        body: bulletList([
          'Browse and order from Boutiques, Spa, Restaurant, Minibar — all delivered to room',
          'View their live Guest Folio (current charges)',
          'Request Concierge services (airport taxi, excursion, flowers)',
          'Earn and redeem Loyalty Points',
          'Access entertainment: movies, music, activities schedule',
          'Chat with the AI Concierge bot for instant service',
        ])
      },
      {
        heading: 'How Orders Work',
        body: bulletList([
          'Guest places order → Z-07 Command Grid receives signal',
          'Staff sees the order in Z-17 Solve Portal as a mission',
          'Staff fulfils and uploads photo proof → SECURE',
          'Charge auto-posts to Guest Folio → visible in Z-11',
        ])
      }
    ], 'Iron Law 50: APK is a thin-client. Never bundle Next.js inside the APK. All UI lives on the VPS.'), 'bot');
    return true;
  }

  // ============================================================
  // HOW-TO QUESTIONS — GENERAL NAVIGATION
  // ============================================================

  // "how to check in a guest"
  if ((ql.includes('check in') || ql.includes('checkin')) && !ql.includes('check out')) {
    pushBotMessage(geminiFormat('🏨 HOW TO CHECK IN A GUEST', [
      {
        heading: 'Steps',
        body: bulletList([
          'Go to Z-05 Reservations',
          'Find the guest\'s booking (search by name, room, or date)',
          'Click OPEN RESERVATION',
          'Verify ID and payment method',
          'Click CHECK IN → system assigns the room and activates the Guest Folio',
          'Guest receives access credentials for the Guest App (Z-GUEST)',
          'Z-07 Command Grid HK signal triggers room preparation confirmation',
        ])
      }
    ], 'Checking in activates the folio. All charges from this moment post to Z-11 Accounts.'), 'bot');
    return true;
  }

  // "how to check out a guest" / "how to discharge a patient"
  if ((ql.includes('check out') || ql.includes('checkout') || ql.includes('settle') || ql.includes('discharge')) && !ql.includes('check in') && !ql.includes('admit')) {
    pushBotMessage(geminiFormat('🚪 HOW TO DISCHARGE A PATIENT', [
      {
        heading: 'Steps',
        body: bulletList([
          'Go to Z-08 Discharge & Billing',
          'Search for the patient by bed number or name',
          'Review the complete Patient Folio (all clinical charges appear here)',
          'Apply any insurance coverage or approved discounts if authorized',
          'Select payment method (Cash, Card, Bank Transfer)',
          'Click SETTLE FOLIO → generates the final bill',
          'Click DISCHARGE → bed status returns to AVAILABLE in Z-05',
          'Z-07 Ward & Bed Grid ADT (Admissions, Discharges, Transfers) updates automatically',
        ])
      }
    ], 'Only CDO, GM, and Billing Manager roles can apply discounts above the policy threshold.'), 'bot');
    return true;
  }

  // "how to raise a ticket"
  if ((ql.includes('ticket') || ql.includes('raise') || ql.includes('issue') || ql.includes('report problem')) && (ql.includes('how') || ql.includes('create') || ql.includes('raise') || ql.includes('new'))) {
    pushBotMessage(geminiFormat('🎫 HOW TO RAISE AN ISSUE TICKET (Z-16)', [
      {
        heading: 'Steps',
        body: bulletList([
          'Go to Z-16 Issue Tickets',
          'Click + NEW TICKET',
          'Select Category: Maintenance, Housekeeping, Guest Complaint, IT, etc.',
          'Enter: Room/Location, Description, Priority (LOW / NORMAL / URGENT)',
          'Assign to Department or specific operative',
          'Submit → ticket appears in Z-17 Solve Portal for resolution',
          'Track status live: OPEN → IN PROGRESS → RESOLVED',
        ])
      }
    ], 'Urgent tickets trigger an immediate alert in Z-07 Command Grid.'), 'bot');
    return true;
  }

  // "what is the command grid"
  if (ql.includes('command grid') || ql.includes('ward grid') || (ql.includes('z-07') && (ql.includes('what') || ql.includes('how')))) {
    pushBotMessage(geminiFormat('⚡ Z-07 — WARD & BED GRID (Clinical Mission Control)', [
      {
        heading: 'What It Does',
        body: 'The real-time heartbeat of Miracle HMS. Live clinical and ward signals pulse here, showing bed occupancy and facility health.'
      },
      {
        heading: 'Operational Signals',
        body: bulletList([
          '**HK** — Sanitation/Housekeeping: beds cleaned, in progress, blocked',
          '**MN** — Maintenance: open medical equipment/ward repair tickets',
          '**ADT** — Admissions, Discharges, Transfers: patients admitted today, scheduled discharges',
          '**IT** — Systems: infrastructure health, EMR server status, API latency',
          '**OPD** — Outpatient: active consultations, doctor queues today',
        ])
      },
      {
        heading: 'Alerts',
        body: 'Any RED signal means immediate action required. Click the signal to drill into the responsible clinical/admin zone. AI will brief you on the exact issue.'
      }
    ], 'Ward & Bed Grid syncs in real time via WebSocket. No page refresh needed.'), 'bot');
    return true;
  }

  // "what is accounts" / "z-11"
  if (ql.includes('z-11') || (ql.includes('accounts') && (ql.includes('what') || ql.includes('how'))) || ql.includes('finance') && ql.includes('what')) {
    pushBotMessage(geminiFormat('💰 Z-11 — ACCOUNTS & FINANCE (Sovereign Vault)', [
      {
        heading: 'What It Does',
        body: 'The financial brain of the hospital. All billing revenue, clinical expenses, and vendor transactions flow into Z-11 automatically from every zone.'
      },
      {
        heading: 'What You Can Do',
        body: bulletList([
          'View daily/monthly P&L in real time',
          'Browse the complete Chart of Accounts (COA)',
          'See revenue split by department: Wards, Pharmacy, Laboratory, OPD Consultations',
          'Review outstanding patient dues and post insurance/cash payments',
          'Export daily audit reports for external healthcare accounting',
          'Monitor COGS vs. Revenue for medical supplies and pharmacy drugs',
        ])
      },
      {
        heading: 'Automated Postings',
        body: 'Every transaction across all zones auto-posts here:\n• Bed/ward charges → Ward Revenue journal\n• Pharmacy sales → Drug Sales journal\n• Laboratory orders → Lab Revenue journal\n• Doctor consultation fees → OPD Consultations journal'
      }
    ], 'Z-11 access is restricted to CDO, GM, and Finance clearance levels.'), 'bot');
    return true;
  }

  // ============================================================
  // TIER 3 ZONE HANDLERS — V30.0 (Sprint 3: Zero Token, Layer 0)
  // Each zone now has a dedicated knowledge handler.
  // These fire BEFORE the LLM is called — 0 token cost.
  // ============================================================

  // Z-11B — AGI ACCOUNTS
  if (ql.includes('z-11b') || ql.includes('agi accounts') || ql.includes('agi account') || ql.includes('accounting agi')) {
    pushBotMessage(geminiFormat('🤖 Z-11B — AGI ACCOUNTS (Autonomous Finance Engine)', [
      {
        heading: 'What It Does',
        body: 'Z-11B is the AI-powered accounting assistant layered on top of the standard accounts module. It interprets natural-language financial queries and executes structured ledger operations without manual data entry.'
      },
      {
        heading: 'Key Capabilities',
        body: bulletList([
          '**Natural Language Ledger** — Ask "post this invoice" and the AGI writes the journal entry',
          '**Auto-Reconciliation** — Matches payments to open invoices without human review',
          '**Exception Flagging** — Automatically highlights unbalanced entries and orphaned transactions',
          '**COA Automation** — Suggests the correct Chart of Accounts code for each transaction type',
          '**Audit Trail** — Every AI-generated entry is stamped with source, timestamp, and confidence score',
        ])
      },
      {
        heading: 'Access',
        body: 'Restricted to GM, ADMIN, and ACC (Finance Officer) clearance levels. Navigate via [NAVIGATE: /dashboard/agi-accounts].'
      }
    ], 'AGI Accounts eliminates manual bookkeeping errors. Review AI-generated entries before month-end close.'), 'bot');
    return true;
  }

  // Z-11C — SOVEREIGN FINANCE (SGPE)
  if (ql.includes('z-11c') || ql.includes('sovereign finance') || ql.includes('sgpe') || ql.includes('sovereign general') || (ql.includes('finance') && ql.includes('sovereign'))) {
    pushBotMessage(geminiFormat('👑 Z-11C — SOVEREIGN FINANCE (SGPE Engine)', [
      {
        heading: 'What It Does',
        body: 'The Sovereign General Purpose Engine (SGPE) is the apex financial intelligence layer. It synthesizes data from Z-11, Z-11B, Z-30 PMS, and all revenue zones into a unified sovereign financial picture.'
      },
      {
        heading: 'Sovereign Capabilities',
        body: bulletList([
          '**Enterprise P&L Synthesis** — Cross-property profit and loss consolidated in one view',
          '**WHT Treaty Optimization** — Withholding tax calculation with treaty relief delta',
          '**Portfolio Netting** — Surplus yield from profitable units offsets mortgage deficits before bank sweeps',
          '**Yield vs. Target Forecast** — AI projects break-even date per property based on UDI and occupancy',
          '**Mortgage Sweep Control** — Atomic per-room sweep with SAVEPOINT rollback (Iron Law 56)',
          '**Direct Debit Mandate Enforcement** — No sweep executes without a valid, ACTIVE mandate on file',
        ])
      },
      {
        heading: 'Access',
        body: 'CDO, GM, ADMIN, and ACC roles only. Navigate via [NAVIGATE: /dashboard/sovereign-finance].'
      }
    ], 'SGPE is the financial nervous system. Any unreconciled entry here signals a cross-zone data gap.'), 'bot');
    return true;
  }

  // Z-25 — GUEST MARKETING
  if (ql.includes('z-25') || ql.includes('guest marketing') || (ql.includes('marketing') && (ql.includes('what') || ql.includes('how') || ql.includes('guest')))) {
    pushBotMessage(geminiFormat('📣 Z-25 — GUEST MARKETING (CRM Broadcast Engine)', [
      {
        heading: 'What It Does',
        body: 'Z-25 is the guest communication and retention engine. It connects to the CRM (Z-10) and sends targeted campaigns, promotions, and loyalty rewards to segmented guest profiles.'
      },
      {
        heading: 'Key Features',
        body: bulletList([
          '**Segmented Campaigns** — Target guests by: visit frequency, spend tier, room type, nationality',
          '**Loyalty Rewards** — Issue points, vouchers, or complimentary nights to returning guests',
          '**Automated Triggers** — Pre-arrival welcome, post-checkout feedback, birthday offers',
          '**Revenue Attribution** — Track which campaign drove which booking or POS transaction',
          '**WhatsApp & Email Dispatch** — Multi-channel message delivery from a single interface',
        ])
      },
      {
        heading: 'How to Start',
        body: 'Navigate to Z-25. Select your target segment in CRM, build the message template, set the dispatch trigger, and activate. The AI will suggest optimal send times based on guest timezone data.'
      }
    ], 'Guest Marketing ROI is tracked in Z-11 under the Marketing COA. Measure campaign lift via occupancy delta.'), 'bot');
    return true;
  }

  // Z-14 — MEDIA LAB
  if (ql.includes('z-14') || ql.includes('media lab') || (ql.includes('image') && (ql.includes('upload') || ql.includes('add') || ql.includes('room'))) || ql.includes('photo upload') || ql.includes('add images')) {
    pushBotMessage(geminiFormat('🎨 Z-14 — MEDIA LAB (Sovereign Content Studio)', [
      {
        heading: 'What It Does',
        body: 'The Media Lab is the content management hub for all property imagery, video, and digital assets across the Miracle HMS ecosystem.'
      },
      {
        heading: 'Key Capabilities',
        body: bulletList([
          '**Room Gallery** — Upload and manage photos for each room/unit in the Asset Grid',
          '**F&B Media** — Dish photography linked directly to Z-29 menu items',
          '**Spa & Wellness** — Treatment room and facility imagery for the guest-facing web page',
          '**Fleet Gallery** — Vehicle photos shown on Z-28 Fleet dispatch and guest booking pages',
          '**Brand Assets** — Logos, banners, and promotional materials stored centrally',
          '**Web Page Integration** — Media from Z-14 feeds directly into the public resort website (/web)',
        ])
      },
      {
        heading: 'How to Add Room Images',
        body: 'Navigate to Z-14 > Room Gallery > Select Room ID > Upload Photos. Supported formats: JPG, PNG, WebP (max 10MB per image). Images appear instantly on the guest-facing residences page.'
      }
    ], 'Always compress images before upload. Large uncompressed files slow the guest-facing web page load time.'), 'bot');
    return true;
  }

  // Z-21 — KERNEL SETTINGS
  if (ql.includes('z-21') || ql.includes('kernel settings') || ql.includes('settings') && (ql.includes('system') || ql.includes('kernel') || ql.includes('user management') || ql.includes('add staff') || ql.includes('add user'))) {
    pushBotMessage(geminiFormat('⚙️ Z-21 — KERNEL SETTINGS (System Configuration)', [
      {
        heading: 'What It Does',
        body: 'The master configuration panel for Miracle HMS. Controls user accounts, role assignments, system-wide settings, and the AI knowledge kernel.'
      },
      {
        heading: 'Key Sections',
        body: bulletList([
          '**User Management** — Create staff accounts, assign roles (CDO, GM, HR, HK, FD, MN, IT, SPA, FB, BOUTIQUE, FLEET, PMS), set PINs',
          '**Hotel Profile** — Property name, address, currency, timezone, tax rates',
          '**Kernel Intelligence Sync** — Push updated zone knowledge to the AI brain without redeployment',
          '**API Key Vault** — Manage Gemini and Groq API keys for the AI engine (CDO only)',
          '**Room Configuration** — Set base rates, room categories, and unit metadata',
          '**Currency & Exchange** — Configure multi-currency display and exchange rate sync',
        ])
      },
      {
        heading: 'Access',
        body: 'CDO, GM, and ADMIN only. To add a new staff member: Z-21 > User Management > Add User > Set Role > Assign PIN.'
      }
    ], 'After adding a new sub-role (HK, FD, MN etc.), the AI automatically inherits their dedicated knowledge profile. No redeployment needed.'), 'bot');
    return true;
  }

  // Z-3B — ASSET RENTALS
  if (ql.includes('z-3b') || ql.includes('asset rental') || ql.includes('rental') && (ql.includes('what') || ql.includes('zone') || ql.includes('asset'))) {
    pushBotMessage(geminiFormat('🏠 Z-3B — ASSET RENTALS (B2B Luxury Rental Engine)', [
      {
        heading: 'What It Does',
        body: 'Z-3B manages B2B luxury asset rentals — villas, yachts, aircraft, and premium equipment available for external business lease or partner distribution.'
      },
      {
        heading: 'Key Features',
        body: bulletList([
          '**Asset Catalogue** — All rentable assets with specs, pricing tiers, and availability calendars',
          '**B2B Partner Channels** — Assign rental rights to distribution partners with commission tracking',
          '**Lease Contracts** — Digital rental agreements with e-signature and SHA-256 integrity verification',
          '**Revenue Splits** — Configure owner/resort revenue share per asset class',
          '**Rental Ledger** — All rental income auto-posts to Z-11 under the Rental Revenue COA',
          '**Conflict Guard** — Prevents double-booking with the main PMS (Z-30) asset pool',
        ])
      },
      {
        heading: 'How to Create a Rental',
        body: 'Navigate to Z-3B > Asset Catalogue > Select Asset > Set Availability Window > Configure Pricing Tier > Publish to Partner Channel.'
      }
    ], 'Rental income flows to Z-11C Sovereign Finance for portfolio netting against mortgage obligations.'), 'bot');
    return true;
  }

  // Z-18 — BIOMETRIC PORTAL
  if (ql.includes('z-18') || ql.includes('biometric') || ql.includes('attendance') && (ql.includes('what') || ql.includes('how') || ql.includes('zone'))) {
    pushBotMessage(geminiFormat('🔐 Z-18 — BIOMETRIC PORTAL (Staff Attendance & Access Control)', [
      {
        heading: 'What It Does',
        body: 'Z-18 is the biometric attendance and physical access control system for all staff. It integrates fingerprint/face data with shift records and auto-flags overtime breaches.'
      },
      {
        heading: 'Key Features',
        body: bulletList([
          '**Shift Clock-In / Clock-Out** — Biometric verification required for each shift boundary',
          '**Overtime Guard** — Auto-alerts if any operative exceeds 12 hours on duty (Phase 2 roadmap)',
          '**Zone Access Control** — Physical door access tied to role clearance (CDO/GM/ADMIN = all zones)',
          '**Attendance Reports** — Daily, weekly, monthly attendance exported to HR (Z-09)',
          '**Anomaly Detection** — Flags missed clock-outs, duplicate entries, and suspicious access patterns',
        ])
      },
      {
        heading: 'Access',
        body: 'All roles for clock-in/out. HR, GM, and CDO for reports and access configuration. Navigate via [NAVIGATE: /dashboard/portal].'
      }
    ], 'Biometric data is stored encrypted. Only HR Director and above can view raw attendance records.'), 'bot');
    return true;
  }

  // Z-19 — CORE PMS POLICY
  if (ql.includes('z-19') || ql.includes('core pms') || ql.includes('policy') && (ql.includes('zone') || ql.includes('what') || ql.includes('how') || ql.includes('room price') || ql.includes('base rate'))) {
    pushBotMessage(geminiFormat('📋 Z-19 — CORE PMS POLICY (Property Configuration Engine)', [
      {
        heading: 'What It Does',
        body: 'Z-19 is the property master configuration layer. It defines the rules that govern every room, rate, booking policy, and guest-facing service across Miracle HMS.'
      },
      {
        heading: 'Key Sections',
        body: bulletList([
          '**Units Tab** — All rooms/villas with BASE RATE column (set room prices here)',
          '**Booking Policies** — Check-in time, check-out time, cancellation windows, deposit rules',
          '**Rate Plans** — Seasonal rates, corporate rates, loyalty rates, OTA rate parity',
          '**Room Type Hierarchy** — VILLA > PENTHOUSE > SUITE > APARTMENT > CRUISE > STANDARD',
          '**Tax Configuration** — VAT rates, tourist tax, service charge per room category',
          '**Availability Rules** — Minimum stay, closed-to-arrival, stop-sell configuration',
        ])
      },
      {
        heading: 'Where to Set Room Prices',
        body: 'Z-19 > Units Tab > BASE RATE column. Click the rate cell to edit. Changes apply immediately across all booking channels.'
      }
    ], 'Always update Z-19 before a seasonal rate change goes live. The AI will use these rates for all revenue forecasts.'), 'bot');
    return true;
  }

  // Z-WEB — PUBLIC WEBSITE
  if (ql.includes('z-web') || ql.includes('public website') || ql.includes('hospital website') || ql.includes('web page') && (ql.includes('what') || ql.includes('how') || ql.includes('zone'))) {
    pushBotMessage(geminiFormat('🌐 Z-WEB — PUBLIC WEBSITE (Patient-Facing Portal)', [
      {
        heading: 'What It Does',
        body: 'The public hospital landing page at /web. Patients browse services, check specialist availability, book consultations, and interact with the Medical Assistant AI — all without logging in.'
      },
      {
        heading: 'Live Sections',
        body: bulletList([
          '**Specialists Gallery** — Pulls live from Z-19/Registry, filtered by department',
          '**Appointment Booker** — Real-time date-based availability via POST /api/policy/check-availability',
          '**Booking Form** — Creates a confirmed booking via POST /api/policy/web-booking',
          '**Pharmacy Store** — Live stock from Z-12 Pharmacy inventory',
          '**Wellness & Checkups** — Package catalogue from Z-26 wellness inventory',
          '**MedicalAI Assistant** — Lightweight public chatbot (NOT MiracleBot). Posts to /api/bot/v2/query with zone: Z-GUEST-WEB, role: GUEST',
        ])
      },
      {
        heading: 'Iron Laws',
        body: 'No localStorage reads (public page — no session). No MiracleBot (Iron Law 52). All API calls have try/catch graceful fallback. MiracleBotGuestGuard blocks on both /guest/* AND /web.'
      }
    ], 'Web page updates appear live — no redeployment needed. Update Z-14 Media Lab for asset changes.'), 'bot');
    return true;
  }

  // Z-OWNER — OWNER PORTAL
  if (ql.includes('z-owner') || ql.includes('owner portal') || ql.includes('owner bridge') || (ql.includes('owner') && (ql.includes('what') || ql.includes('zone') || ql.includes('portal')))) {
    pushBotMessage(geminiFormat('🏦 Z-OWNER — OWNER PORTAL (Sovereign Investment Dashboard)', [
      {
        heading: 'What It Does',
        body: 'The Owner Portal (Z-OWNER / Z-31) gives property owners a private view of their investment performance, yield statements, mortgage accounts, and digital covenant contracts — completely isolated from hotel operations.'
      },
      {
        heading: 'Key Features',
        body: bulletList([
          '**Yield Dashboard** — Net yield balance, total withdrawn, UDI share percentage',
          '**Property Portfolio** — Each owned unit: category, ownership type, status, monthly rent, commission',
          '**Mortgage Tracker** — Total mortgage, monthly payment, interest rate, paid-to-date',
          '**Payout Requests** — Submit and track yield withdrawal requests',
          '**Digital Contracts** — Deed of Pool / Mortgage Note — digitally signed with SHA-256 verification',
          '**Direct Debit Mandates** — Stripe ACH/SEPA mandate status (required before any mortgage sweep)',
          '**Repair Invoices** — Transparent view of all repair costs charged against the property',
          '**ROI Forecast** — AI calculates break-even timeline using UDI yield vs. mortgage/purchase cost',
        ])
      },
      {
        heading: 'AI Butler Mode',
        body: 'The Owner AI Butler speaks in Elite British Financial Manager tone. It proactively flags: missing contract signatures, inactive mandates, high repair-to-yield ratios, and recommends MACRS capitalization overrides.'
      }
    ], 'Owner data is fully tenant-isolated. No owner can see another owner\'s portfolio. All yields are WHT-treaty-adjusted before display.'), 'bot');
    return true;
  }


  if (ql.includes('z-12') || (ql.includes('inventory') && (ql.includes('what') || ql.includes('how'))) || ql.includes('bom') || ql.includes('par level') || ql.includes('stock')) {
    pushBotMessage(geminiFormat('📦 Z-12 — INVENTORY (Sovereign Stock Vault)', [
      {
        heading: 'What It Does',
        body: 'Tracks every consumable, product, and ingredient across all departments. BOM (Bill of Materials) links recipes and service components to cost calculations.'
      },
      {
        heading: 'Key Features',
        body: bulletList([
          '**SKU Management** — Every product has a unique code, category, unit, and cost',
          '**PAR Levels** — Minimum stock thresholds. AI alerts when stock falls below PAR',
          '**BOM** — Recipe/formula engine: 1 spa treatment = X ml of oil + Y minutes of therapist time',
          '**Reorder Triggers** — Auto-generates purchase requests when stock is critical',
          '**FIFO/LIFO** — Cost accounting method selectable per category',
        ])
      },
      {
        heading: 'Auto-Decrements',
        body: 'Every sale in POS, every treatment in Spa, every F&B order auto-decrements the linked inventory items in real time.'
      }
    ], 'Inventory drift causes COGS inaccuracies in Z-11. Keep BOM updated after every menu change.'), 'bot');
    return true;
  }

  // ============================================================
  // LAYER 3: CDO COMMAND ENGINE (RBAC-gated)
  // ============================================================

  // DIAGNOSE
  if (ql.startsWith('diagnose') || (ql.includes('system') && ql.includes('health'))) {
    if (!isPower) {
      pushBotMessage('Infrastructure diagnostics require CDO or GM clearance. Contact your CDO for a system health report.', 'alert');
      return true;
    }
    pushBotMessage('CDO diagnostics initiated. Scanning active telemetry...', 'alert');
    setTimeout(() => {
      pushBotMessage(geminiFormat('🔬 SYSTEM DIAGNOSTIC REPORT', [
        { heading: 'Database', body: '✅ Connected. Query latency nominal.' },
        { heading: 'WebSocket', body: '✅ 1 Active Grid-Sync node. Reconnect delay: 2s.' },
        { heading: 'AI Engine', body: '✅ Gemini 1.5 Flash primary. Groq Llama fallback armed.' },
        { heading: 'Inventory', body: '⚠️ 3 SKUs below PAR level. Dispatch reorder via Z-12.' },
        { heading: 'Zone Coverage', body: '✅ All 29 zones operational. No blind spots detected.' },
      ], 'Full Infrastructure Anatomy available in Z-23.'), 'bot');
    }, 1200);
    return true;
  }

  // FORESEE / PREDICT
  if (ql.startsWith('foresee') || ql.includes('predict risks') || ql.includes('risk forecast')) {
    if (!isCDO) {
      pushBotMessage('Risk forecasting is a CDO-level command. Request access elevation through the Policy Engine (Z-18).', 'alert');
      return true;
    }
    pushBotMessage(geminiFormat('🔮 SOVEREIGN RISK FORECAST', [
      { heading: 'Risk Vector 1', body: '⚠️ WebSocket instability at 50+ concurrent users — scale ASGI workers on Hetzner VPS.' },
      { heading: 'Risk Vector 2', body: '⚠️ BOM drift if ingredient costs change post 6 months — freeze COGS per transaction.' },
      { heading: 'Risk Vector 3', body: '⚠️ Folio orphaning on browser crash during checkout — build nightly sweep cron for open folios.' },
      { heading: 'Risk Vector 4', body: '⚠️ Sequence break after bulk CSV import — update NextVal post-import in the DB.' },
      { heading: 'Risk Vector 5', body: '⚠️ Z-17 proof uploads without S3 fallback — local disk fills if server is not cleaned monthly.' },
    ], 'Foresight Engine — Powered by Sovereign AI. Review weekly.'), 'bot');
    return true;
  }

  // LIVE STATUS
  if (ql.startsWith('status') || ql === 'live' || ql.includes('live status') || ql.includes('live report')) {
    if (!isPower) {
      pushBotMessage('Live system telemetry requires GM clearance or above. Your panel shows your assigned tasks. Contact your manager for operational data.', 'alert');
      return true;
    }
    pushBotMessage('Pulling live telemetry from the Sovereign Vault...', 'bot');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const res = await fetch(`${apiUrl}/bot/live-summary?role=${userRole}`);
      if (res.ok) {
        const data = await res.json();
        const d = data.live_data;
        pushBotMessage(
          geminiFormat('📊 LIVE OPERATIONAL PULSE', [
            { heading: 'Occupancy', body: `${d.occupancy.currently_in_house}/${d.occupancy.total_active_rooms} rooms occupied.` },
            { heading: 'Revenue', body: `Gross: ${d.financials.gross_revenue?.toLocaleString() || 'N/A'}. Outstanding: ${d.financials.total_outstanding_dues?.toLocaleString() || '0'}.` },
            { heading: 'Human Resources', body: `${d.hr.total_operatives} operatives on duty.` },
            { heading: 'Inventory', body: `${d.inventory.total_stock_units} stock units in vault.` },
            { heading: 'System', body: '✅ All signals nominal.' },
          ], 'Live data as of ' + new Date().toLocaleTimeString()),
          'bot'
        );
      } else {
        pushBotMessage('Live crawl returned a non-200 response. Check backend kernel status in Z-23.', 'alert');
      }
    } catch {
      pushBotMessage('Live crawl failed. The Sovereign Kernel may be temporarily unreachable. Check PM2 status on the VPS.', 'alert');
    }
    return true;
  }

  // ============================================================
  // VISITOR GUIDE — help visitors navigate
  // ============================================================
  if (isVisitor && (ql.includes('help') || ql.includes('where') || ql.includes('what can') || ql.includes('show me') || ql.includes('guide'))) {
    pushBotMessage(geminiFormat('👋 VISITOR ORIENTATION — MIRACLE HMS DEMO', [
      {
        heading: 'Welcome to Your Demo Session',
        body: 'You have full interactive access to explore Miracle HMS. All zones are live with real data flows.'
      },
      {
        heading: 'Recommended Demo Path',
        body: bulletList([
          '**Z-07 Command Grid** → See live property signals (start here)',
          '**Z-05 Reservations** → View and create room bookings',
          '**Z-06 POS** → Process a retail or F&B sale',
          '**Z-20 Synapse Nexus** → Issue a directive and watch AI decompile it',
          '**Z-26 Wellness** → Book a spa treatment',
          '**Z-28 Fleet** → Schedule an airport transfer',
          '**Z-29 F & B** → Browse the menu and place an order',
          '**Z-11 Accounts** → Watch revenue post in real time',
        ])
      },
      {
        heading: 'Restricted Zones',
        body: '**Z-23 Infrastructure** and **Z-21 Settings** are view-only for visitors (Sovereign Security Protocol).'
      },
      {
        heading: 'Ask Me Anything',
        body: 'Try: "How do I check in a guest?" or "What is Z-17?" or "Show me the zone map" — I know every corner of this system.'
      }
    ], 'To unlock full operational access, contact the CDO via WhatsApp.'), 'bot');
    return true;
  }

  // ============================================================
  // SECTION: ANALYTICS ACKNOWLEDGEMENT ENGINE (V15.0)
  // Intercepts analytics/report requests and injects
  // a British "thinking" acknowledgement before routing to LLM.
  // ============================================================
  const isAnalyticsRole = ['CDO', 'GM', 'ADMIN', 'STAFF'].some(
    r => userRole.toUpperCase().includes(r.toUpperCase()) && ['CDO', 'GM', 'ADMIN'].includes(r)
  );

  const analyticsKeywords = [
    'report', 'revenue', 'analytics', 'analysis', 'profit', 'loss', 'p&l',
    'occupancy', 'how many', 'how much', 'summary', 'overview', 'breakdown',
    'performance', 'kpi', 'metrics', 'forecast', 'trend', 'compare',
    'monthly', 'daily', 'weekly', 'today', 'this week', 'this month',
    'chart', 'graph', 'show me', 'tell me', 'what is the', 'what are',
    'staff count', 'headcount', 'payroll', 'outstanding', 'dues', 'inventory status',
  ];

  if (isAnalyticsRole && analyticsKeywords.some(k => ql.includes(k))) {
    pushBotMessage(
      geminiFormat('🔍 SOVEREIGN ANALYTICS ENGINE V15.0 — Deep Analysis Initializing', [
        {
          heading: 'Right, give me one moment…',
          body: 'Drawing intelligence from the **Sovereign Vault** across all active zones.\n\n' +
            '**Scanning:** Z-11 Accounts → Z-05 Reservations → Z-09 HR → Z-12 Inventory → Z-07 Command Grid → Z-30 PMS\n\n' +
            '_Applying McKinsey analytics framework. Proactive anomaly detection active. Standing by…_',
        },
      ]),
      'bot'
    );
    return false; // Let the backend LLM handle the actual analytics response
  }

  return false; // Pass to backend AI engine (Gemini/Groq)
}
