const fs = require('fs');

const layoutJsonPath = 'D:/Miracle Web Builder/lib/layout.json';
const siteLayoutJsonPath = 'D:/Miracle Web Builder/vigilantitsolution.com/lib/layout.json';

const defaultLayoutTsPath = 'D:/Miracle Web Builder/lib/defaultLayout.ts';
const siteDefaultLayoutTsPath = 'D:/Miracle Web Builder/vigilantitsolution.com/lib/defaultLayout.ts';

console.log('Reading existing layout...');
const existingLayout = JSON.parse(fs.readFileSync(layoutJsonPath, 'utf8'));

// The default components from the pristine layout matching the zip's index.html
const defaultComponents = [
  {
    "type": "hero",
    "title": "Get your Enterprise Solution",
    "subtitle": "The AI-augmented Sovereign Business OS (Miracle OS) unifying Front Desk, Global Procurement, and Facilities Under One Master Ledger.",
    "badgeText": "MIRACLE OS KERNEL",
    "accentColor": "cyan",
    "elements": [
      {
        "label": "CONTROL STATUS",
        "value": "Absolute Control",
        "icon": "shield"
      },
      {
        "label": "INTELLIGENCE LAYER",
        "value": "AI-Driven AGI",
        "icon": "cpu"
      },
      {
        "label": "MASTER LEDGER",
        "value": "Double-Entry Vault",
        "icon": "database"
      }
    ],
    "buttonText": "Access Miracle Demo",
    "imageScale": "80%",
    "buttonLink": "https://miracle.vigilantitsolution.com/"
  },
  {
    "type": "feature",
    "title": "What Miracle Can Do For You",
    "subtitle": "Collapse operational fragmentation and unify your enterprise under one sovereign database.",
    "badgeText": "ENTERPRISE AUTOMATION",
    "accentColor": "pink",
    "elements": [
      {
        "label": "Eradicate Operational Silos",
        "value": "We collapse your Hospitality, F&B, and Facility Management into a single, real-time command centre, giving you absolute top-down visibility over your entire enterprise.",
        "icon": "glob"
      },
      {
        "label": "Optimize Your Workforce",
        "value": "We transform Human Resources from a complex headache into a strategic advantage, automating shift rosters, performance tracking, and payroll to align labor costs.",
        "icon": "activity"
      },
      {
        "label": "Synchronize Every Transaction",
        "value": "We bridge the gap between your front-line and your back office, ensuring every POS swipe instantly updates your master financial ledger and depletes inventory.",
        "icon": "database"
      }
    ]
  },
  {
    "type": "blog_showcase",
    "title": "Miracle Sovereign Intelligence Blogs",
    "subtitle": "Get noticed by top enterprise IT, software developers, and hospitality operators. Read our technical deep dives below.",
    "badgeText": "ENTERPRISE JOURNAL",
    "accentColor": "cyan"
  },
  {
    "type": "carousel",
    "title": "Sovereign Interface Showcase",
    "subtitle": "Click through some of the core management zones of the active Miracle OS Kernel.",
    "badgeText": "SCREENSHOT SHOWCASE",
    "accentColor": "cyan",
    "elements": [
      {
        "label": "Staff Login Portal",
        "value": "Zone 02 Identity Clearance login gate with visitor bypass options.",
        "icon": "shield",
        "imageUrl": "/web images/z00_login.png"
      },
      {
        "label": "Live Tape Chart Grid",
        "value": "Zone 05 operational room matrix and front desk folio controls.",
        "icon": "activity",
        "imageUrl": "/web images/z07_grid.png"
      },
      {
        "label": "PMS Owner Console",
        "value": "Zone 30 real-estate leasing ledger and payout dashboard.",
        "icon": "database",
        "imageUrl": "/web images/z30_pms.png"
      }
    ]
  },
  {
    "type": "video",
    "title": "Miracle OS Video Walkthrough",
    "subtitle": "Take a visual tour of how the double-entry ledger flow automatically links F&B POS and stock counts.",
    "badgeText": "VIDEO BRIEFING",
    "accentColor": "amber",
    "videoUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "elements": [
      {
        "label": "INTEGRATION TIME",
        "value": "Less than 14 Days",
        "icon": "activity"
      },
      {
        "label": "MUTATION SHIELD",
        "value": "Zero Visitor Overrides",
        "icon": "shield"
      }
    ]
  },
  {
    "type": "faq",
    "title": "Frequently Asked Questions",
    "subtitle": "Learn more about the capabilities, architecture, and deployment of Miracle OS.",
    "badgeText": "FAQ HELP CENTER",
    "accentColor": "cyan",
    "elements": [
      {
        "label": "What exactly is Miracle OS?",
        "value": "Miracle OS is a Unified Enterprise Resource Planning (ERP) system developed by Vigilant IT Solution. Unlike traditional fragmented software, Miracle OS centralises Front Desk Operations, Multi-Grade Point of Sale (POS), Advanced Inventory Logistics, and Human Capital Management into a single, real-time Sovereign Database.",
        "icon": "glob"
      },
      {
        "label": "What industries is Miracle OS built for?",
        "value": "While designed with Luxury Hospitality and Eco-Resorts in mind, its modular architecture makes it the perfect engine for Condominium Management, Super Shops, Multi-Outlet Retail, and large-scale Food & Beverage operations.",
        "icon": "glob"
      },
      {
        "label": "Can it handle complex inventory like recipes and raw materials?",
        "value": "Absolutely. Our Zone 12 Master Vault features a Dual-Unit Logistics and BOM (Bill of Materials) Explosion engine. You can purchase items in bulk (e.g., a 20kg box of coffee beans) and the system automatically converts it for retail sale. When you sell a cup of coffee, the system mathematically deducts the exact grams of raw materials used from your warehouse in real-time.",
        "icon": "database"
      },
      {
        "label": "How does the system handle guest billing and POS terminals?",
        "value": "We utilise a proprietary 'Auto Room Charge' matrix. If a guest orders from the Restaurant, Spa, or Mini Shop, the POS terminal seamlessly verifies their occupancy status and instantly routes the transaction to their Master Guest Folio at the front desk, eliminating manual ledger-entry errors.",
        "icon": "activity"
      },
      {
        "label": "Does Miracle OS support in-room Smart Device ordering?",
        "value": "Yes. We feature a 'Silent Concierge' protocol. Guests or condominium tenants can use smart devices from their rooms to browse real-time menus, order food, or request housekeeping services. These requests are routed immediately to the relevant operational department's radar.",
        "icon": "activity"
      },
      {
        "label": "How advanced is the Human Resources module?",
        "value": "It is a complete Human Capital powerhouse. It supports Biometric Face Recognition for frictionless staff check-ins, tracks real-time duty efficiency, maintains the payroll register, and features an automated commission disbursement engine to reward top-performing staff instantly.",
        "icon": "cpu"
      }
    ]
  },
  {
    "type": "testimonials",
    "title": "What Our Partners Say",
    "subtitle": "Real feedback from enterprise leaders who transformed their operations using Miracle OS.",
    "badgeText": "PARTNER TESTIMONIALS",
    "accentColor": "pink",
    "elements": [
      {
        "label": "Mantala Agro Resort",
        "value": "Running an Agro Resort on 11 acres, our biggest struggle was integration. Vigilant IT Solution built a custom ERP that gives us a 360-degree view. We can track seeds from the ground to dinner tables, procurement is automated, and waste has been slashed by 30%.",
        "icon": "activity"
      },
      {
        "label": "Baqara Milk",
        "value": "Before we partnered with Vigilant IT Solution, managing our BOM inventory and complex retail SKUs felt like catching rain in a sieve. Their PostgreSQL-backed architecture and Python integrations reduced our procurement waste by 25% because our BOM is finally accurate.",
        "icon": "database"
      },
      {
        "label": "Shah Marine Resort",
        "value": "At Vigilant, we believe in empowering people. We overhauled Shah Marine's internal workforce management using Miracle OS, implementing biometric check-ins and payroll automation for absolute operational efficiency.",
        "icon": "shield"
      }
    ]
  },
  {
    "type": "contact",
    "title": "Get In Touch",
    "subtitle": "Connect with our global offices to deploy Miracle OS in your enterprise.",
    "badgeText": "CONTACT PORTAL",
    "accentColor": "amber",
    "elements": [
      {
        "label": "Head Office",
        "value": "Office 19669 182-184 High Street North East Ham London E6 2JA",
        "icon": "glob"
      },
      {
        "label": "Global Contact",
        "value": "+880 1711 477 509",
        "icon": "activity"
      },
      {
        "label": "Support Email",
        "value": "info@vigilantitsolution.com",
        "icon": "shield"
      },
      {
        "label": "Middle East Branch",
        "value": "Dubai & Saudi Offices (Upcoming)",
        "icon": "glob"
      }
    ],
    "buttonText": "Send Inquiry"
  },
  {
    "type": "footer",
    "title": "VIGILANT IT SOLUTION",
    "subtitle": "Copyright © 2026 Vigilant IT Solution. All rights reserved. Sovereign Software as a Service.",
    "badgeText": "SECURE NODE",
    "accentColor": "green",
    "elements": [
      {
        "label": "VERSION",
        "value": "v2.4.1-LTS",
        "icon": "terminal"
      },
      {
        "label": "DATABASE",
        "value": "PostgreSQL",
        "icon": "database"
      },
      {
        "label": "STATUS",
        "value": "SECURE",
        "icon": "shield"
      }
    ]
  }
];

// Merge back to restore home page
const restoredLayout = {
  ...existingLayout,
  "theme": "cyberpunk",
  "cssClasses": "space-y-12",
  "components": defaultComponents,
  "logo": {
    "text": "VIGILANT // IT SOLUTION",
    "imageUrl": "https://drive.google.com/file/d/1P0WaWT7NDlZMZS2Q82qQ3lf-xY2vsJ7j/view?usp=drive_link",
    "alignment": "left"
  }
};

console.log('Writing layout.json files...');
fs.writeFileSync(layoutJsonPath, JSON.stringify(restoredLayout, null, 2), 'utf8');
fs.writeFileSync(siteLayoutJsonPath, JSON.stringify(restoredLayout, null, 2), 'utf8');

console.log('Writing defaultLayout.ts files...');
const tsContent = `import { GeneratedLayout } from "./gemini";\n\nexport const DEFAULT_LAYOUT: GeneratedLayout = ${JSON.stringify(restoredLayout, null, 2)};\n`;
fs.writeFileSync(defaultLayoutTsPath, tsContent, 'utf8');
fs.writeFileSync(siteDefaultLayoutTsPath, tsContent, 'utf8');

console.log('Home page layout restore complete!');
