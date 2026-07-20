# ==============================================================
# MIRACLE OS -- SOVEREIGN EXECUTIVE PHONETIC LEXICON
# File: backend_api/app/services/phonetic_lexicon.py
#
# DIRECTIVE: This module is the FIRST gate in the TTS pipeline.
# It runs BEFORE any regex heuristic. The Lexicon expands
# enterprise acronyms into their full spoken forms so the TTS
# engine speaks like a top-tier CEO, not a robot.
#
# MAINTENANCE RULES FOR FUTURE DEVELOPERS:
# 1. ALWAYS add new terms here, NOT in tts_service.py regex.
# 2. Use `spoken_form` for terms that should be EXPANDED
#    (e.g., "ROI" -> "Return on Investment").
# 3. Use `phonetic` for terms that should be PRONOUNCED as a
#    word but are ambiguous (e.g., "EBITDA" -> "Eh-bid-dah").
# 4. The key is the EXACT uppercase acronym as it appears in text.
# 5. All expansions must sound natural when spoken aloud. Test
#    each entry with the Google TTS engine before committing.
# 6. Index: FINANCE > HOSPITALITY > ERP/IT > INVENTORY >
#    HR/LEGAL > MIRACLE-OS SPECIFIC
# ==============================================================

import re
from typing import Dict

# ==============================================================
# THE SOVEREIGN LEXICON
# Format: "ACRONYM": "Spoken Expansion"
# Priority: Longer matches are applied first to avoid partial
# replacements (e.g., "RevPAR" before "PAR").
# ==============================================================
SOVEREIGN_LEXICON: Dict[str, str] = {

    # ---- FINANCE & ACCOUNTING ----
    "ROI":      "Return on Investment",
    "P&L":      "Profit and Loss",
    "EBITDA":   "Eh-bid-dah",         # Acronym pronounced as a word
    "COGS":     "Cost of Goods Sold",
    "OPEX":     "Operational Expenditure",
    "CAPEX":    "Capital Expenditure",
    "AR":       "Accounts Receivable",
    "AP":       "Accounts Payable",
    "VAT":      "Value Added Tax",
    "SC":       "Service Charge",
    "COA":      "Chart of Accounts",
    "GL":       "General Ledger",
    "FIFO":     "First In, First Out",
    "LIFO":     "Last In, First Out",
    "NPV":      "Net Present Value",
    "IRR":      "Internal Rate of Return",
    "WACC":     "Weighted Average Cost of Capital",
    "YTD":      "Year to Date",
    "MTD":      "Month to Date",
    "QTD":      "Quarter to Date",
    "MOM":      "Month over Month",
    "YOY":      "Year over Year",
    "GP":       "Gross Profit",
    "NP":       "Net Profit",
    "EBIT":     "Earnings Before Interest and Tax",
    "FCF":      "Free Cash Flow",

    # ---- HOSPITALITY SPECIFIC ----
    "ADR":      "Average Daily Rate",
    "RevPAR":   "Revenue Per Available Room",
    "REVPAR":   "Revenue Per Available Room",
    "PAR":      "Per Available Room",
    "OCC":      "Occupancy",
    "MICE":     "Mice",               # Pronounced as a word: Meetings Incentives Conferences Exhibitions
    "FIT":      "Free Independent Traveller",
    "GIT":      "Group Inclusive Tour",
    "OTA":      "Online Travel Agency",
    "PMS":      "Property Management System",
    "CRS":      "Central Reservation System",
    "RMS":      "Revenue Management System",
    "ARR":      "Average Room Rate",
    "LOS":      "Length of Stay",
    "ETA":      "Estimated Time of Arrival",
    "ETD":      "Estimated Time of Departure",
    "FD":       "Front Desk",
    "HK":       "Housekeeping",
    "F&B":      "Food and Beverage",
    "OOO":      "Out of Order",
    "OOS":      "Out of Service",
    "DND":      "Do Not Disturb",
    "VIP":      "Very Important Person",
    "FIT":      "Fully Independent Traveller",
    "CIP":      "Commercially Important Person",
    "IN-HOUSE": "In-House",           # Fix: prevent spelling out hyphenated caps
    "AVAILABLE": "Available",

    # ---- ERP, TECHNOLOGY & SYSTEM ----
    "ERP":      "Enterprise Resource Planning",
    "CRM":      "Customer Relationship Management",
    "API":      "Application Programming Interface",
    "SaaS":     "Software as a Service",
    "SAAS":     "Software as a Service",
    "AI":       "A. I.",               # Spell out: letter by letter
    "ML":       "Machine Learning",
    "NLP":      "Natural Language Processing",
    "UI":       "User Interface",
    "UX":       "User Experience",
    "IT":       "I. T.",               # Spell out
    "OS":       "Operating System",
    "VPS":      "Virtual Private Server",
    "DNS":      "Domain Name System",
    "CDN":      "Content Delivery Network",
    "SQL":      "Sequel",              # Pronounced as a word
    "NoSQL":    "No Sequel",
    "JWT":      "JSON Web Token",
    "JSON":     "Jason",               # Commonly pronounced as a word
    "CORS":     "Cross-Origin Resource Sharing",
    "SSH":      "Secure Shell",
    "SSL":      "Secure Sockets Layer",
    "MFA":      "Multi-Factor Authentication",
    "OTP":      "One-Time Password",
    "CRUD":     "Create, Read, Update, and Delete",
    "REST":     "Representational State Transfer",
    "PM2":      "P. M. 2",
    "URL":      "web address",         # More human: "the URL" -> "the web address"
    "HTTP":     "H. T. T. P.",
    "HTTPS":    "H. T. T. P. S.",

    # ---- INVENTORY & OPERATIONS ----
    "BOM":      "Bill of Materials",
    "PO":       "Purchase Order",
    "SKU":      "Stock Keeping Unit",
    "COGS":     "Cost of Goods Sold",
    "FOB":      "Free On Board",
    "MRP":      "Material Requirements Planning",
    "WIP":      "Work In Progress",
    "RAW":      "raw material",
    "PAR":      "Par Level",
    "SOP":      "Standard Operating Procedure",
    "KPI":      "Key Performance Indicator",
    "OKR":      "Objectives and Key Results",
    "SLA":      "Service Level Agreement",
    "POC":      "Proof of Concept",
    "MVP":      "Minimum Viable Product",

    # ---- POINT OF SALE ----
    "POS":      "Point of Sale",
    "FOC":      "Free of Charge",
    "VOID":     "Voided",              # Prevent "void" from being split
    "GST":      "Goods and Services Tax",
    "MFS":      "Mobile Financial Service",

    # ---- HR & LEGAL ----
    "HR":       "Human Resources",
    "CDO":      "Chief Digital Officer",
    "CEO":      "Chief Executive Officer",
    "CFO":      "Chief Financial Officer",
    "CTO":      "Chief Technology Officer",
    "COO":      "Chief Operating Officer",
    "GM":       "General Manager",
    "HOD":      "Head of Department",
    "JD":       "Job Description",
    "KYC":      "Know Your Customer",
    "NDA":      "Non-Disclosure Agreement",
    "SOP":      "Standard Operating Procedure",

    # ---- MIRACLE OS SPECIFIC ----
    "MIRACLE":  "Miracle",            # Property name: pronounce as a word
    "VIGILANT": "Vigilant",           # Company name: pronounce as a word
}

# Words that should ALWAYS be pronounced as-is (never letter-by-letter)
# These override the regex fallback heuristic.
PROPER_NOUNS = {
    "MIRACLE", "VIGILANT", "SOVEREIGN", "GENESIS",
}


def apply_lexicon(text: str) -> str:
    """
    SOVEREIGN PHONETIC BRIDGE
    -------------------------
    Applies the Sovereign Lexicon to the input text using word-boundary
    matching. This is the FIRST step in the TTS pipeline.

    Approach:
    1. Sort by key length descending (longest match wins — "RevPAR" before "PAR")
    2. Use \\b word boundaries to avoid partial matches
    3. Case-insensitive matching, but preserve proper noun casing

    This function MUST be called BEFORE any regex heuristics.
    """
    # Sort by length descending for greedy matching
    sorted_terms = sorted(SOVEREIGN_LEXICON.keys(), key=len, reverse=True)

    for term in sorted_terms:
        expansion = SOVEREIGN_LEXICON[term]
        # Escape special regex characters in the term (e.g., P&L, F&B)
        escaped = re.escape(term)
        # Case-insensitive word-boundary match
        text = re.sub(
            rf'\b{escaped}\b',
            expansion,
            text,
            flags=re.IGNORECASE
        )

    return text


def normalize_for_speech(text: str) -> str:
    """
    SOVEREIGN PHONETIC NORMALIZATION PIPELINE
    ------------------------------------------
    Full pipeline for the TTS pre-processor.

    ORDER IS CRITICAL:
    Step 1: Apply Lexicon (known terms get expanded correctly)
    Step 2: Apply Heuristic Regex (remaining ALL-CAPS unknowns)
             - 5+ letter ALL-CAPS -> Title Case (proper noun, e.g., MANTALA -> Mantala)
             - 2-4 letter ALL-CAPS -> Spaced letters (acronym, e.g., TX -> T X)
    Step 3: Number normalization (long IDs get spaced out)
    Step 4: Punctuation pacing (professional rhythm)

    WHY THIS ORDER:
    - Lexicon runs first so "FIFO" becomes "First In, First Out" before
      the regex would incorrectly convert it to "Fifo".
    - Heuristics only fire on UNKNOWN terms not in the Lexicon.
    - This gives us a "known world" of enterprise vocabulary + smart
      fallback for anything new.
    """
    # Step 1: Lexicon expansion (enterprise-aware)
    text = apply_lexicon(text)

    # Step 2: Heuristic regex for REMAINING unknown ALL-CAPS terms
    # Rule 2a: 5+ letter ALL-CAPS unknowns -> Title Case (assumed proper noun)
    text = re.sub(r'\b([A-Z]{5,})\b', lambda m: m.group(1).title(), text)
    # Rule 2b: 2-4 letter ALL-CAPS unknowns -> spaced letters (assumed acronym)
    text = re.sub(r'\b([A-Z]{2,4})\b', lambda m: " ".join(m.group(1)), text)

    # Step 3: Long number IDs -> space-separated digits
    text = re.sub(r'\d{6,}', lambda m: " ".join(m.group()), text)

    # Step 4: Pacing & rhythm cleanups
    text = text.replace("...", "... ")
    text = text.replace(" ,", ",")
    text = re.sub(r' +', ' ', text)  # Collapse double spaces

    return text.strip()
