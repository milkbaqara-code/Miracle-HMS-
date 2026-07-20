from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.core.ai_kernel import call_llm
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class VisitorChatRequest(BaseModel):
    text: str
    visitor_id: str
    context: Optional[Dict[str, Any]] = {}

@router.post("/chat")
async def visitor_chat(request: VisitorChatRequest):
    try:
        user_msg = request.text
        v_id = request.visitor_id
        ctx = request.context or {}
        
        visitor_name = ctx.get('visitor_name', 'Valued Visitor')
        enterprise_name = ctx.get('enterprise_name', 'your enterprise')
        business_type = ctx.get('business_type', '')
        recommended_zones = ctx.get('recommended_zones', [])
        conversation_summary = ctx.get('conversation_summary', '')

        zones_str = ', '.join(recommended_zones) if recommended_zones else 'relevant Miracle HMS zones'
        zone_paths = {
            'Z-07': '/dashboard', 'Z-05': '/dashboard/reservations',
            'Z-30': '/dashboard/pms', 'Z-08': '/dashboard/checkout',
            'Z-06': '/dashboard/pos', 'Z-29': '/dashboard/z29-gastronomy',
            'Z-12': '/dashboard/inventory', 'Z-09': '/dashboard/hr',
            'Z-11': '/dashboard/accounts', 'Z-11B': '/dashboard/agi-accounts',
            'Z-11C': '/dashboard/sovereign-finance', 'Z-10': '/dashboard/crm',
            'Z-20': '/dashboard/synapse', 'Z-16': '/dashboard/issue-tickets',
            'Z-28': '/dashboard/boutiques', 'Z-27': '/dashboard/wellness',
            'Z-19': '/dashboard/policy', 'Z-23': '/dashboard/infrastructure',
            'Z-AUDIT': '/dashboard/accounts', 'Z-26': '/dashboard/fleet',
            'Z-25': '/dashboard/guest-marketing', 'Z-18': '/dashboard/portal',
        }
        zone_guide_lines = '\n'.join(
            [f'  - {z}: {zone_paths.get(z, "/dashboard")}' for z in recommended_zones]
        ) if recommended_zones else '  - Navigate to /dashboard to explore'

        system_prompt = (
            f"You are Miracle AI — the sovereign enterprise intelligence for Vigilant IT Solutions.\n"
            f"You are currently in GUIDED TOUR MODE for a pre-qualified website visitor.\n\n"
            f"VISITOR PROFILE:\n"
            f"  Name: {visitor_name}\n"
            f"  Enterprise: {enterprise_name}\n"
            f"  Business Type: {business_type or 'Enterprise'}\n"
            f"  Recommended Zones: {zones_str}\n"
            f"  Website Conversation Summary: {conversation_summary or 'Visitor was qualified via website Miracle AI bot.'}\n\n"
            f"YOUR MISSION IN THIS SESSION:\n"
            f"1. Greet {visitor_name} by name immediately — they are a pre-qualified lead\n"
            f"2. Reference what you already know about their {business_type or 'enterprise'} needs\n"
            f"3. Act as a GUIDED TOUR HOST — walk them through their recommended zones:\n"
            f"{zone_guide_lines}\n"
            f"4. When they ask about PRICING — always link them back to our pricing page:\n"
            f"   https://www.vigilantitsolution.com/#pricing\n"
            f"   And offer: 'Would you like to book a call with our engineer within the next hour?'\n"
            f"5. For appointment booking — tell them to type 'book appointment' and you will arrange it\n"
            f"6. Use rich markdown: **bold**, tables, bullet lists, emojis\n"
            f"7. NEVER invent features or prices — only describe what is in the zone documentation\n"
            f"8. Keep responses focused and action-oriented — guide them to click and explore\n"
            f"\nEngineer WhatsApp (for live support): https://wa.me/8801711477509\n"
            f"Pricing Page: https://www.vigilantitsolution.com/#pricing"
        )
        
        # Build the prompt
        full_prompt = f"System: {system_prompt}\n\nVisitor ({visitor_name}): {user_msg}\n\nMiracle AI:"
        
        # Call the core LLM Engine
        reply = await call_llm(full_prompt)
        
        if not reply:
            reply = "I apologize, but my core processors are currently realigning. How else may I assist you today?"
            
        return {"reply": reply, "status": "SUCCESS"}
    except Exception as e:
        logger.error(f"Visitor AI Error: {e}")
        return {"reply": "I am experiencing temporary neural interference. Please try again in a moment.", "status": "ERROR"}
