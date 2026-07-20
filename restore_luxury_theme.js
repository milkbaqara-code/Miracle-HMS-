const fs = require('fs');

const layoutJsonPath = 'D:/Miracle Web Builder/lib/layout.json';
const siteLayoutJsonPath = 'D:/Miracle Web Builder/vigilantitsolution.com/lib/layout.json';

const defaultLayoutTsPath = 'D:/Miracle Web Builder/lib/defaultLayout.ts';
const siteDefaultLayoutTsPath = 'D:/Miracle Web Builder/vigilantitsolution.com/lib/defaultLayout.ts';

console.log('Reading existing layout metadata...');
const existingLayout = JSON.parse(fs.readFileSync(layoutJsonPath, 'utf8'));

// The components list for "Luxury Eco-Resort & Spa"
const luxuryComponents = [
  {
    "type": "hero",
    "title": "Luxury Hospitality Unbound",
    "subtitle": "Transforming the guest experience from check-in to spa checkout via frictionless automation.",
    "badgeText": "MIRACLE ECO-RESORT",
    "accentColor": "green",
    "elements": [
      { "label": "TOTAL BEDS", "value": "250+ Keys", "icon": "glob" },
      { "label": "FACILITY RATING", "value": "5-Star Diamond", "icon": "shield" },
      { "label": "AUTOMATION", "value": "100% Digital", "icon": "activity" }
    ],
    "buttonText": "Book Your Experience"
  },
  {
    "type": "split_feature",
    "title": "The Tape Chart Controller",
    "subtitle": "Monitor active bookings, check-ins, and folio allocations in one high-precision grid.",
    "badgeText": "ZONE 05 FRONT DESK",
    "accentColor": "cyan",
    "mediaUrl": "/web images/z07_grid.png",
    "mediaPosition": "right",
    "elements": [
      { "label": "Real-time Tape Chart", "value": "Visual room allocations mapped directly from OTA channels.", "icon": "activity" },
      { "label": "Integrated POS Charges", "value": "Restaurant and spa bills automatically route to the master folio.", "icon": "database" }
    ],
    "buttonText": "Explore Front Desk Engine"
  },
  {
    "type": "gallery",
    "title": "Visual Tour of Our Facilities",
    "subtitle": "Explore our lobby, room layouts, and automated spa control panels.",
    "badgeText": "RESORT ARCHIVE",
    "accentColor": "pink",
    "elements": [
      { "label": "Front Desk Console", "value": "Live room allocation tape chart mapping active guests.", "icon": "activity", "imageUrl": "/web images/z07_grid.png" },
      { "label": "Staff Secure Gate", "value": "Biometric authentication portal for resort operatives.", "icon": "shield", "imageUrl": "/web images/z00_login.png" },
      { "label": "PMS Owner Portal", "value": "Real-time leasing and occupancy status monitoring.", "icon": "database", "imageUrl": "/web images/z30_pms.png" }
    ]
  },
  {
    "type": "blog_showcase",
    "title": "Miracle Sovereign Intelligence Blogs",
    "subtitle": "Get noticed by top enterprise IT, software developers, and hospitality operators. Read our technical deep dives below.",
    "badgeText": "ENTERPRISE JOURNAL",
    "accentColor": "green"
  },
  {
    "type": "testimonials",
    "title": "Client Success Stories",
    "subtitle": "See how leading hospitality resorts maximized their revenue with Miracle OS.",
    "badgeText": "PARTNER REVIEW",
    "accentColor": "pink",
    "elements": [
      { "label": "Shah Marine Resort", "value": "Miracle OS resolved our booking double-allocations and cut checkout wait times by 40%.", "icon": "shield" },
      { "label": "Mantala Agro Resort", "value": "The unified inventory and auto room charge system reduced leaks in our F&B by 30%.", "icon": "activity" }
    ]
  },
  {
    "type": "footer",
    "title": "MIRACLE ECO-RESORT",
    "subtitle": "Powered by Miracle OS. Sovereign Software as a Service.",
    "badgeText": "NODE-BD05",
    "accentColor": "green",
    "elements": [
      { "label": "OPERATIONAL STATUS", "value": "OPTIMAL", "icon": "activity" },
      { "label": "DATABASE CONNECTION", value: "SECURE", "icon": "shield" }
    ]
  }
];

// Merge into new layout
const restoredLayout = {
  ...existingLayout,
  "theme": "luxury-hospitality",
  "cssClasses": "space-y-12",
  "components": luxuryComponents
};

// Write layout.json
console.log('Writing restored layout.json files...');
fs.writeFileSync(layoutJsonPath, JSON.stringify(restoredLayout, null, 2), 'utf8');
fs.writeFileSync(siteLayoutJsonPath, JSON.stringify(restoredLayout, null, 2), 'utf8');

// Write defaultLayout.ts
console.log('Writing defaultLayout.ts files...');
const tsContent = `import { GeneratedLayout } from "./gemini";\n\nexport const DEFAULT_LAYOUT: GeneratedLayout = ${JSON.stringify(restoredLayout, null, 2)};\n`;
fs.writeFileSync(defaultLayoutTsPath, tsContent, 'utf8');
fs.writeFileSync(siteDefaultLayoutTsPath, tsContent, 'utf8');

console.log('Layout restore complete!');
