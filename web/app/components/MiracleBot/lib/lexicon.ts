// ============================================================
// MiracleBot / lib / lexicon.ts
// SOVEREIGN PHONETIC LEXICON — The single source of truth for
// how the browser TTS engine pronounces enterprise vocabulary.
//
// MAINTENANCE LAW: Any new term added here MUST also be added
// to backend_api/app/core/phonetic_lexicon.py. Both must stay
// in sync for consistent pronunciation across voice channels.
//
// Priority: Terms are matched longest-first (e.g. "RevPAR"
// before "PAR") to prevent partial-word collisions.
// V4.0 — Enterprise Refactor
// ============================================================

export const SOVEREIGN_LEXICON: Record<string, string> = {
  // ── Miracle HMS Brand Identity (MUST be first / longest match) ──────────────
  'Miracle HMS':  'Miracle Oh Ess',
  'MiracleOS':   'Miracle Oh Ess',
  'Miracle AI':  'Miracle A I',
  'Miracle POS': 'Miracle Point of Sale',
  'Miracle PMS': 'Miracle Property Management System',
  // ── Zone Codes (full names for natural speech) ─────────────────────────────
  'Z-30':    'Zone Thirty, Sovereign Property Management',
  'Z-29':    'Zone Twenty Nine, Food and Beverage',
  'Z-28':    'Zone Twenty Eight, Luxury Boutiques',
  'Z-27':    'Zone Twenty Seven, Medical Spa and Wellness',
  'Z-26':    'Zone Twenty Six, Fleet and Aviation',
  'Z-25':    'Zone Twenty Five, Guest Marketing',
  'Z-23':    'Zone Twenty Three, Sovereign Infrastructure',
  'Z-21':    'Zone Twenty One, Kernel Settings',
  'Z-20':    'Zone Twenty, Synapse Nexus',
  'Z-19':    'Zone Nineteen, Core Policy',
  'Z-18':    'Zone Eighteen, Biometric Portal',
  'Z-17':    'Zone Seventeen, Staff Operations',
  'Z-16':    'Zone Sixteen, Issue Tickets',
  'Z-14':    'Zone Fourteen, Media Lab',
  'Z-12':    'Zone Twelve, Inventory Matrix',
  'Z-11C':   'Zone Eleven C, Sovereign Finance',
  'Z-11B':   'Zone Eleven B, Accounting Intelligence',
  'Z-11':    'Zone Eleven, Accounts and Audit',
  'Z-10':    'Zone Ten, CRM and Guest Loyalty',
  'Z-09':    'Zone Nine, Human Resources',
  'Z-08':    'Zone Eight, Checkout and Billing',
  'Z-07':    'Zone Seven, Command Grid',
  'Z-06':    'Zone Six, Point of Sale',
  'Z-05':    'Zone Five, Reservations',
  'Z-3B':    'Zone Three B, Asset Rentals',
  'Z-2B':    'Zone Two B, AGI Recruiting',
  'Z-1B':    'Zone One B, Ledger Authorization',
  'Z-GUEST': 'Zone Guest, Concierge Portal',
  'Z-WEB':   'Zone Web, Public Website',
  'Z-OWNER': 'Zone Owner, Owner Portal',
  'Z-PROP':  'Zone Properties, Miracle Properties',
  'Z-LOGIN': 'Zone Login, Visitor Access',
  // ── AI / AGI ───────────────────────────────────────────────────────────────
  'AGI': 'Artificial General Intelligence',
  'AI':  'A I',
  'LLM': 'Large Language Model',
  'NLP': 'Natural Language Processing',
  'GPU': 'Graphics Processing Unit',
  'ML':  'Machine Learning',
  // ── Finance ────────────────────────────────────────────────────────────────
  'ROI':    'Return on Investment',
  'P&L':    'Profit and Loss',
  'EBITDA': 'Eh-bid-dah',
  'COGS':   'Cost of Goods Sold',
  'OPEX':   'Operational Expenditure',
  'CAPEX':  'Capital Expenditure',
  'VAT':    'Value Added Tax',
  'WHT':    'Withholding Tax',
  'SC':     'Service Charge',
  'COA':    'Chart of Accounts',
  'FIFO':   'First In First Out',
  'LIFO':   'Last In First Out',
  'YTD':    'Year to Date',
  'MTD':    'Month to Date',
  'YOY':    'Year over Year',
  'MOM':    'Month over Month',
  'EBIT':   'Earnings Before Interest and Tax',
  'FCF':    'Free Cash Flow',
  'NPV':    'Net Present Value',
  'IRR':    'Internal Rate of Return',
  'UDI':    'Unit Density Index',
  // ── Hospitality ────────────────────────────────────────────────────────────
  'RevPAR':  'Revenue Per Available Room',
  'REVPAR':  'Revenue Per Available Room',
  'ADR':     'Average Daily Rate',
  'PAR':     'Par Level',
  'OTA':     'Online Travel Agency',
  'PMS':     'Property Management System',
  'MICE':    'Mice',
  'OCC':     'Occupancy',
  'LOS':     'Length of Stay',
  'FD':      'Front Desk',
  'HK':      'Housekeeping',
  'F&B':     'Food and Beverage',
  'VIP':     'Very Important Person',
  'DND':     'Do Not Disturb',
  'OOO':     'Out of Order',
  'IN-HOUSE':'In House',
  'AVAILABLE':'Available',
  // ── Point of Sale & ERP ────────────────────────────────────────────────────
  'POS':  'Point of Sale',
  'FOC':  'Free of Charge',
  'GST':  'Goods and Services Tax',
  'MFS':  'Mobile Financial Service',
  'ERP':  'Enterprise Resource Planning',
  'CRM':  'Customer Relationship Management',
  'SaaS': 'Software as a Service',
  'SAAS': 'Software as a Service',
  'API':  'Application Programming Interface',
  // ── Technology ─────────────────────────────────────────────────────────────
  'IT':   'I T',
  'OS':   'Oh Ess',
  'SQL':  'Sequel',
  'JSON': 'Jason',
  'JWT':  'Jason Web Token',
  'VPS':  'Virtual Private Server',
  'DNS':  'Domain Name System',
  'OTP':  'One Time Password',
  'CRUD': 'Create Read Update Delete',
  'PM2':  'Process Manager Two',
  'UI':   'User Interface',
  'UX':   'User Experience',
  // ── Inventory & Ops ────────────────────────────────────────────────────────
  'BOM': 'Bill of Materials',
  'PO':  'Purchase Order',
  'SKU': 'Stock Keeping Unit',
  'SOP': 'Standard Operating Procedure',
  'KPI': 'Key Performance Indicator',
  'SLA': 'Service Level Agreement',
  'MRP': 'Material Requirements Planning',
  'WIP': 'Work In Progress',
  // ── Leadership & HR ────────────────────────────────────────────────────────
  'CDO': 'Chief Digital Officer',
  'CEO': 'Chief Executive Officer',
  'CFO': 'Chief Financial Officer',
  'CTO': 'Chief Technology Officer',
  'COO': 'Chief Operating Officer',
  'GM':  'General Manager',
  'HOD': 'Head of Department',
  'HR':  'Human Resources',
  // ── Brand Names ────────────────────────────────────────────────────────────
  'VIGILANT': 'Vigilant',
  'MANTALA':  'Mantala',
};

/**
 * Applies the SOVEREIGN_LEXICON to a string.
 * Longer terms are matched first to prevent partial collisions (e.g. RevPAR before PAR).
 */
export const applyLexicon = (text: string): string => {
  const terms = Object.keys(SOVEREIGN_LEXICON).sort((a, b) => b.length - a.length);
  let result = text;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), SOVEREIGN_LEXICON[term]);
  }
  return result;
};
