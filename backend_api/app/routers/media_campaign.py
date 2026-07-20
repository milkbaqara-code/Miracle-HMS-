from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.core.ai_kernel import call_llm
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class CampaignRequest(BaseModel):
    subject: str
    target_audience: str
    platforms: List[str]
    link_share: Optional[str] = ""
    include_emoji: bool = True
    include_seo: bool = True
    codebase_sync: bool = False
    custom_instructions: Optional[str] = ""
    topic_theme: Optional[str] = ""
    platform_modes: Optional[Dict[str, str]] = {}

def parse_campaign_tags(raw_text: str) -> Dict[str, str]:
    tags = [
        "LINKEDIN", 
        "TWITTER", 
        "FACEBOOK", 
        "YOUTUBE", 
        "SEO_TITLE", 
        "SEO_DESCRIPTION", 
        "SEO_KEYWORDS", 
        "MEDIA_PROMPT"
    ]
    
    result = {t.lower(): "" for t in tags}
    current_tag = None
    
    for line in raw_text.splitlines():
        upper_line = line.strip().upper()
        found_tag = False
        for tag in tags:
            if f"[{tag}]" in upper_line or f"**[{tag}]**" in upper_line or f"**{tag}:**" in upper_line:
                current_tag = tag.lower()
                found_tag = True
                break
        if found_tag:
            continue
        if current_tag:
            result[current_tag] += line + "\n"
            
    # Fallbacks: if any section is empty, clean it up or extract raw if nothing matches
    for k in result:
        result[k] = result[k].strip()
        
    # If LinkedIn is empty but we have raw text, dump raw text in it
    if not result["linkedin"] and not result["twitter"] and raw_text.strip():
        result["linkedin"] = raw_text.strip()
        
    return result

@router.post("/generate")
async def generate_campaign(request: CampaignRequest):
    try:
        # 📚 Pre-loaded Codebase Knowledge Bank & Brain Bank
        codebase_knowledge = (
            "MIRACLE OS SYSTEM CAPABILITIES & MODULES (V68.0-AGI-ERP):\n"
            "1. SOVEREIGN SINGLE-LOOP KERNEL (miracle_kernel.json): Core database schemas, COA classifications, and AI prompts are synchronized in a single loop to eliminate data drift and ensure 100% database integrity.\n"
            "2. PMS OWNER HUB (Zone 30): Property owners can track real-time yield forecasts, sign digital covenants with e-signatures, activate Stripe SEPA/ACH direct debit mandates, perform automated monthly sweeps, calculate MACRS depreciation, and apply Withholding Tax (WHT) treaty relief optimization (WHT = max(0, WHT_Local - Delta_Treaty)) & occupancy-based interest.\n"
            "3. SOLVEMISSION & RADAR CONTROL (Zone 16/17): Autonomous maintenance ticketing, department assignment, SLA tracking, and audit ledger entries.\n"
            "4. SOVEREIGN FINANCE & ACCOUNTS (Zone 18): Multi-property general ledger double-entry bookkeeping, automated daily forex rate sync (USD, EUR, GBP, AED, SGD, BDT), and cryptographic token approvals for transaction limits (e.g. over $10,000).\n"
            "5. SYNAPSE AGI NEXUS (Zone 20): Self-expanding department building, employee shift compliance, biometric attendance monitoring, and supervisor alert daemons.\n"
            "6. MEDIA LAB (Zone 14): Luxury WebP media forge, CSS-GPU accelerated cropper, and Cineplex movie streaming rentals.\n"
            "7. GUEST MARKETING ZONE (Zone 25): Mobile/Tablet simulator, guest concierge services, order folio billing, and cinema revenue codes."
        )

        audience_guidelines = {
            "enterprise": "Tone: Prestigious, strategic, elite. Focus on ROI, operational efficiency, zero-leakage financial controls, PM2 scaling, and luxury guest satisfaction.",
            "property_owners": "Tone: Financially astute, secure, rewarding. Focus on automated yield payouts, occupancy interest, WHT optimization, covenant compliance, and direct debit safety.",
            "developers": "Tone: Highly technical, clean, structured. Focus on the single kernel loop, single source of truth, Next.js page generation, SQLite/PostgreSQL schemas, and zero-drift database integrity.",
            "automation": "Tone: Visionary, optimized, futuristic. Focus on Synapse Nexus AGI command grid, biometric violations tracking, auto-quarantine prompt firewalls, and self-expanding department nodes."
        }

        topic_guidelines = {
            "launch": "Core Theme: Vigilant IT Solution Services & Miracle OS. Focus on showcasing our elite software development services, dynamic cloud node provisioning, custom enterprise solutions, and core architectural features of Miracle OS. Always tag with Vigilant IT Solution and Miracle OS for maximum search engine visibility.",
            "zones": "Core Theme: Diverse Zones of Miracle OS. Highlight the possibilities of our solution across diverse enterprise activities (PMS, POS, Accounting, HR, Inventory, CRM) executing in a single, unified database kernel with zero API fragmentation. Emphasize how people can find Vigilant IT Solution and Miracle OS tagged with these topics.",
            "workforce": "Core Theme: Workforce Acceleration & Hour Reduction. Focus on how our AI/AGI-driven OS reduces employee working hours (by up to 40%) through automated scheduling, biometric check-in rosters, shift alignment, and supervisor alerts, driving high operational efficiency.",
            "loopholes": "Core Theme: Auto-Detecting Enterprise Loopholes. Highlight the system's ability to run automated audits, auto-detect operational and financial weaknesses, identify leakage, track compliance, and propose immediate areas of improvement across the enterprise.",
            "marketing": "Core Theme: Self-Controlled AI-Driven Marketing Agencies. Emphasize self-governed marketing agents that run autonomous media campaigns, capture leads, auto-generate SEO content, and accelerate targeted business growth with minimal human intervention."
        }

        tone_rules = audience_guidelines.get(request.target_audience.lower(), "Tone: Professional, engaging, high-growth.")
        theme_rules = topic_guidelines.get(request.topic_theme.lower(), "Core Theme: General advertising campaign.")

        # Build prompt
        prompt_lines = [
            "You are the Sovereign AGI Content Campaign Engine for Miracle OS and Vigilant IT Solution Ltd.",
            "Your task is to generate high-converting, viral, SEO-optimized advertising content focusing on the possibilities of our solution in diverse enterprise activities.",
            "Enforce these key requirements in the generated posts:",
            "- Write and speak about the possibilities of our software in diverse enterprise operations (PMS, POS, HR, Accounting, Inventory).",
            "- Focus on top-needed software features that users actively search for online (e.g. unified database kernel, zero-drift integrity, zero API bridges, biometric payroll automation, automated risk/loophole auditing).",
            "- Explicitly tag Vigilant IT Solution Ltd and Miracle OS in these posts to ensure they appear for relevant global search engine queries, boosting visibility.",
            "",
            f"Campaign Goal/Subject: {request.subject}",
            f"Target Audience: {request.target_audience.upper()}",
            tone_rules,
            theme_rules,
            f"Share Link: {request.link_share or 'https://www.vigilantitsolution.com'}",
            f"Include Emojis: {request.include_emoji}",
            f"Include SEO optimization: {request.include_seo}",
            f"Sync Codebase Brain Knowledge: {request.codebase_sync}",
            "",
            "CRITICAL: Output your response using ONLY the following section tags, in this exact format. Do not add intro or outro conversational text outside these tags:"
        ]

        modes = request.platform_modes or {}

        if "linkedin" in request.platforms:
            li_mode = modes.get("linkedin", "thought_leadership")
            prompt_lines.append(f"[LINKEDIN]\n(Format: {li_mode.replace('_', ' ').title()}. Write a high-converting, professional LinkedIn post targeted at the selected audience and theme. Focus on capabilities, value propositions, and add bullet points and appropriate hashtags.)")
        if "twitter" in request.platforms:
            tw_mode = modes.get("twitter", "feature_teaser")
            prompt_lines.append(f"[TWITTER]\n(Format: {tw_mode.replace('_', ' ').title()}. Write a punchy Twitter/X post under 280 characters, including a link and hashtags matching the theme.)")
        if "facebook" in request.platforms:
            fb_mode = modes.get("facebook", "visual_story")
            prompt_lines.append(f"[FACEBOOK]\n(Format: {fb_mode.replace('_', ' ').title()}. Write a warm, engaging Facebook post with visual calls to action.)")
        if "youtube" in request.platforms:
            yt_mode = modes.get("youtube", "tutorial_walkthrough")
            prompt_lines.append(f"[YOUTUBE]\n(Format: {yt_mode.replace('_', ' ').title()}. Write a compelling video description or community post layout, including simulated chapters/timeline if relevant, and target links.)")

        if request.include_seo:
            prompt_lines.append("[SEO_TITLE]\n(A high-CTR title tag under 60 characters for our landing page)")
            prompt_lines.append("[SEO_DESCRIPTION]\n(A compelling meta description under 160 characters)")
            prompt_lines.append("[SEO_KEYWORDS]\n(Comma-separated list of 10 high-volume SEO keywords)")
            
        prompt_lines.append("[MEDIA_PROMPT]\n(A detailed visual asset prompt for our Media Lab to generate/crop an image or video thumbnail that matches this post)")

        if request.codebase_sync:
            prompt_lines.append("\nReference these system components and directories in your posts to make them authentic:\n" + codebase_knowledge)

        if request.custom_instructions:
            prompt_lines.append(f"\nAdditional Custom Instructions:\n{request.custom_instructions}")

        full_prompt = "\n".join(prompt_lines)
        
        # Call LLM
        messages = [{"role": "user", "content": full_prompt}]
        raw_reply = await call_llm(messages)
        
        if not raw_reply:
            raise HTTPException(status_code=500, detail="LLM engine failed to respond.")
            
        parsed = parse_campaign_tags(raw_reply)
        return {"status": "SUCCESS", "campaign": parsed, "raw": raw_reply}
        
    except Exception as e:
        logger.error(f"Campaign Generator Error: {e}")
        return {"status": "ERROR", "message": str(e)}
