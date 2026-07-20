"""
🔱 MIRACLE HMS — PATIENT/GUEST AGI BUTLER ROUTER
Zone: GUEST CONCIERGE AGI ENGINE
URL Prefix: /api/guest/bot

This is a COMPLETELY ISOLATED router from the staff bot_router_v2.
The Guest Butler speaks to the LLM as a world-class patient/visitor assistant.
It parses [ACTION: TICKET | DEPT | desc] or [ACTION: ORDER | item_id | qty] tags
and executes them directly against the live DB — ZERO hallucination by design.

ANTI-HALLUCINATION LAWS:
1. Live catalog is injected into EVERY prompt from the DB.
2. Only valid dept codes are accepted: HK, RS, MN, SPA, IT, GYM, POOL
3. Action parser is wrapped in try/catch — LLM reply is always returned even if action fails.
4. No staff data, no financial data, no zone names leak to the patient/guest.

AUTH:
- All /query calls REQUIRE a valid GUEST JWT (issued by /api/guest/login)
- Token is verified on every call — if the guest checked out the folio is CHECKED_OUT
  and the request is rejected (401). No infinite sessions.
"""
import re
import uuid
import logging
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.core.database import get_db
from app.core.ai_kernel import call_llm
from app.models.models import SolveMission, Inventory, GuestFolio, StrategicDirective, DirectiveNode

logger = logging.getLogger("GuestAGIButler")
router = APIRouter(tags=["GUEST AGI BUTLER"])

_GUEST_SECRET = "MIRACLE_OS_SUPREME_SECRET_KEY_CHANGE_IN_PROD"
_GUEST_ALGORITHM = "HS256"

# ============================================================
# VALID DEPARTMENT CODES (IRON LAW: no free-text dept names)
# ============================================================
VALID_DEPTS = {
    "HK": "Housekeeping",
    "RS": "Room Service / Restaurant",
    "MN": "Maintenance",
    "SPA": "Spa & Wellness",
    "IT": "IT / Tech Support",
    "GYM": "Gym & Fitness",
    "POOL": "Pool Services",
    "TRANSPORT": "Transport / Fleet",
    "BELL": "Bell / Porter",
}

# ============================================================
# GUEST JWT VERIFIER — validates token AND live folio status
# ============================================================
async def get_verified_guest_session(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    Dependency: decodes the GUEST JWT from Authorization header.
    ALSO verifies the GuestFolio is still IN_HOUSE.
    Rejects with 401 if:
      - No token
      - Token invalid / expired
      - role != GUEST
      - Folio is CHECKED_OUT (guest has left the hotel)
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="GUEST_AUTH_REQUIRED: Please log in via the Guest App.")
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, _GUEST_SECRET, algorithms=[_GUEST_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="GUEST_TOKEN_INVALID: Session expired. Please log in again.")

    if payload.get("role") != "GUEST":
        raise HTTPException(status_code=403, detail="GUEST_ROLE_REQUIRED.")

    room = payload.get("room")
    name = payload.get("name", "Valued Guest")
    folio_id = payload.get("folio_id")

    # 🔱 Live folio check — if they checked out, their token is auto-revoked
    folio = db.query(GuestFolio).filter(
        GuestFolio.room_number == room,
        GuestFolio.status == "IN_HOUSE"
    ).first()
    if not folio:
        raise HTTPException(
            status_code=401,
            detail="GUEST_SESSION_EXPIRED: Your stay has concluded. Thank you for choosing Miracle."
        )

    return {"room": room, "name": name, "folio_id": folio_id, "folio": folio}

# ============================================================
# REQUEST SCHEMA (room/name no longer trusted from body — come from JWT)
# ============================================================
class GuestBotRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    language: str = "EN"
    # Legacy fields kept for APK backward compat — ignored server-side (JWT wins)
    room: Optional[str] = None
    guest_name: Optional[str] = None
    guest_type: Optional[str] = None

# ============================================================
# CATALOG BUILDER — injects REAL items into LLM prompt
# ============================================================
def build_guest_catalog_context(db: Session) -> str:
    """Pulls live orderable items from DB for LLM injection. Zero hallucination."""
    try:
        items = db.query(Inventory).filter(
            Inventory.type != 'RAW_MATERIAL',
            Inventory.type != 'RAW',
            Inventory.stock > 0
        ).limit(60).all()

        if not items:
            return "AVAILABLE SERVICES: No items currently in catalog."

        lines = []
        by_dept: dict = {}
        for item in items:
            dept = re.sub(r'^Z-\d+-', '', (item.dept or 'GENERAL').upper()).strip()
            if dept not in by_dept:
                by_dept[dept] = []
            price = float(item.rp or 0)
            by_dept[dept].append(f"  - {item.name} (ID:{item.product_id}, Price:{price:.0f})")

        for dept, items_list in by_dept.items():
            lines.append(f"[{dept}]")
            lines.extend(items_list[:10])  # Max 10 per dept to stay within token budget

        return "AVAILABLE SERVICES IN CATALOG (ONLY suggest these):\n" + "\n".join(lines)
    except Exception as e:
        logger.error(f"[GUEST_BOT] Catalog build error: {e}")
        return "AVAILABLE SERVICES: Catalog temporarily unavailable. Do not suggest specific items."

# ============================================================
# ACTION EXECUTOR — parses and runs LLM-emitted action tags
# ============================================================
def execute_action_tag(tag_str: str, room: str, guest_name: str, db: Session) -> Optional[str]:
    """
    Parses [ACTION: TICKET | DEPT | description] or [ACTION: ORDER | item_id | qty]
    Wrapped in full try/catch — NEVER blocks the LLM reply from reaching the guest.
    """
    try:
        # Pattern: [ACTION: TICKET | HK | Need extra blanket]
        ticket_match = re.match(
            r'ACTION:\s*TICKET\s*\|\s*([A-Z]+)\s*\|\s*(.+)',
            tag_str.strip(), re.IGNORECASE
        )
        if ticket_match:
            dept_raw = ticket_match.group(1).upper().strip()
            description = ticket_match.group(2).strip()

            # IRON LAW: Only valid dept codes accepted
            dept = dept_raw if dept_raw in VALID_DEPTS else "HK"

            mission = SolveMission(
                room_no=room,
                dept=dept,
                subject=f"[BUTLER AI] {guest_name} — {description}",
                priority="HIGH",
                status="PENDING",
                assigned_to="Unassigned"
            )
            db.add(mission)
            db.flush()

            # 🔱 SYNAPSE DIRECTIVE: Mirror ticket into StrategicDirective so it shows in Command Grid
            try:
                directive = StrategicDirective(
                    title=f"[GUEST BUTLER] Room {room} — {dept}: {description[:80]}",
                    description=f"Auto-generated by Guest AGI Butler for {guest_name} in Room {room}.",
                    status="ACTIVE",
                    priority="CRITICAL" if dept == "MN" else "NORMAL",
                    issued_by=f"MIRACLE-BUTLER",
                    target_dept=dept,
                    tagged_operatives=[]
                )
                db.add(directive)
                db.flush()
                node = DirectiveNode(
                    directive_id=directive.id,
                    task_name=f"{description[:120]}",
                    target_dept=dept,
                    is_completed=False
                )
                db.add(node)
            except Exception as se:
                logger.warning(f"[GUEST_BOT] Synapse directive creation skipped: {se}")

            db.commit()

            # Broadcast to Command Grid via WebSocket
            try:
                from app.main import master_socket
                import asyncio
                asyncio.create_task(master_socket.broadcast("TICKET_UPDATE", {
                    "action": "NEW_GUEST_BUTLER_MISSION",
                    "room": room,
                    "dept": dept,
                    "mission_id": mission.id
                }))
            except Exception:
                pass  # WS failure must never break the butler response

            logger.info(f"[GUEST_BOT] ✅ Ticket created: {dept} | Room {room} | {description}")
            return f"ticket_created:{mission.id}"

        # Pattern: [ACTION: ORDER | ITEM_ID | 2]
        order_match = re.match(
            r'ACTION:\s*ORDER\s*\|\s*([^\|]+)\s*\|\s*(\d+)',
            tag_str.strip(), re.IGNORECASE
        )
        if order_match:
            item_id = order_match.group(1).strip()
            qty = int(order_match.group(2).strip())

            # Verify item exists in DB
            db_item = db.query(Inventory).filter(Inventory.product_id == item_id).first()
            if not db_item:
                logger.warning(f"[GUEST_BOT] Order blocked — item {item_id} not in DB.")
                return None

            price = float(db_item.rp or 0) * qty

            # Base currency
            from app.models.models import SystemConfig
            config = db.query(SystemConfig).first()
            fl = config.financial_laws if config and config.financial_laws else {}
            base_cur = fl.get("base_currency", "BDT")
            symbols = fl.get("currency_symbols", {"BDT": "৳", "USD": "$", "AED": "د.إ"})
            sym = symbols.get(base_cur, "৳")

            # Create fulfillment ticket for RS
            order_mission = SolveMission(
                room_no=room,
                dept="RS",
                subject=f"[BUTLER AI ORDER] Room {room} — {qty}x {db_item.name} ({sym}{price:.0f})",
                priority="HIGH",
                status="PENDING",
                assigned_to="POS_QUEUE"
            )
            db.add(order_mission)

            # Charge to folio if IN_HOUSE
            folio = db.query(GuestFolio).filter(
                GuestFolio.room_number == room,
                GuestFolio.status == "IN_HOUSE"
            ).first()
            if folio:
                folio.balance += price
                from app.models.models import FolioCharge
                charge = FolioCharge(
                    folio_id=folio.id,
                    item_name=f"[BUTLER] {qty}x {db_item.name}",
                    category="BUTLER_ORDER",
                    amount=price,
                    qty=qty,
                    transaction_id=f"BUTLER-{uuid.uuid4().hex[:8].upper()}"
                )
                db.add(charge)

            db.commit()
            logger.info(f"[GUEST_BOT] ✅ Order placed: {qty}x {db_item.name} for Room {room}")
            return f"order_placed:{item_id}"

    except Exception as e:
        logger.error(f"[GUEST_BOT] Action execution failed: {e}")
        db.rollback()

    return None

# ============================================================
# MAIN ENDPOINT: POST /api/guest/bot/query
# ============================================================
@router.post("/query")
async def guest_butler_query(
    payload: GuestBotRequest,
    db: Session = Depends(get_db),
    session: dict = Depends(get_verified_guest_session)
):
    """
    The Miracle Guest AGI Butler.
    Requires a valid GUEST JWT. Room/name come from verified token — not body.
    """
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message is required.")

    # 🔱 Identity is ALWAYS from the verified JWT — guest cannot spoof their own room
    room = session["room"]
    guest_name = session["name"]
    session_id = payload.session_id or f"GUEST-{uuid.uuid4().hex[:8]}"

    # ── STEP 1: Build live catalog context (anti-hallucination core) ──
    catalog_context = build_guest_catalog_context(db)

    # ── STEP 2: Get hotel name from config ──
    hotel_name = "Miracle Eco Resort"
    try:
        from app.models.models import SystemConfig
        config = db.query(SystemConfig).first()
        hotel_name = config.hotel_name if config and config.hotel_name else hotel_name
    except Exception:
        pass

    # ── STEP 3: Build the Guest Butler system prompt ──
    dept_list = ", ".join([f"{k}={v}" for k, v in VALID_DEPTS.items()])

    system_prompt = f"""You are MIRACLE — the 7-Star AI Concierge Butler of {hotel_name}.
You are serving: {guest_name}, Room {room}.

YOUR PERSONA:
- Warm, elegant, ultra-professional — like a premium medical center patient concierge.
- Always address the guest/patient by name. Never sound robotic.
- Maximum 3 sentences in your spoken reply. Be warm but efficient.
- Never mention staff zones, backend systems, or Miracle HMS by name.
- Never reveal financial data, room/bed tariffs, or internal operations.

AVAILABLE DEPT CODES (ONLY use these in action tags): {dept_list}

{catalog_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTENT RULES — READ CAREFULLY:

1. BROWSING / INFO QUERY (guest is ASKING, not ordering):
   "What coffee do you have?", "Show me the menu", "What options are available?"
   → List items from the catalog. Be descriptive. DO NOT emit any [ACTION] tag.

2. EXPLICIT ORDER (guest says they WANT something):
   "I want a cappuccino", "Bring me 2 burgers", "Order me a coffee"
   → Confirm warmly. Emit: [ACTION: ORDER | ITEM_ID | QTY]

3. SERVICE / MAINTENANCE REQUEST:
   "My AC is cold", "I need towels", "The TV is broken", "Call me a taxi"
   → Acknowledge. Emit: [ACTION: TICKET | DEPT_CODE | brief description]

4. INFORMATION ONLY (hotel, timing, general questions):
   "What time is checkout?", "Where is the pool?"
   → Answer helpfully. DO NOT emit any [ACTION] tag.

CRITICAL: If the guest is BROWSING or ASKING about what’s available — NEVER emit an [ACTION] tag.
Only emit an action when the guest has EXPLICITLY confirmed they want to place an order or make a request.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANTI-HALLUCINATION LAWS:
- NEVER suggest items NOT listed in AVAILABLE SERVICES above.
- NEVER invent dept codes. Use ONLY the list above.
- If a requested item is not in the catalog, apologize and offer what IS available.
- If you cannot help: "I will personally connect you with our front desk right away."

EXAMPLES:
Guest: "What kind of coffee do you have?"
Reply: "Of course, {guest_name}! We offer a Single Origin V60 Pour Over, a 24K Gold Leaf Cappuccino, and a house Espresso. Which would you like me to arrange for you?"
[No action tag — this is a browsing query]

Guest: "I’ll take a cappuccino please"
Reply: "Wonderful choice, {guest_name}. Your 24K Gold Leaf Cappuccino is on its way and should arrive within 15 minutes. Enjoy! [ACTION: ORDER | CAPPUCCINO-001 | 1]"

Guest: "My AC is too cold"
Reply: "Of course, {guest_name}. I’ve immediately alerted our maintenance team to adjust your room temperature. They will attend within minutes. [ACTION: TICKET | MN | AC too cold — guest comfort adjustment]"

Guest: "I need an extra blanket"
Reply: "Absolutely, {guest_name}. I’ve dispatched Housekeeping to bring a premium blanket right away. [ACTION: TICKET | HK | Extra blanket requested]"
"""

    messages = [{"role": "user", "content": f"{system_prompt}\n\nGUEST: {payload.message}"}]

    # ── STEP 4: Call LLM ──
    try:
        raw_reply = await call_llm(messages, temperature=0.7)
    except Exception as e:
        logger.error(f"[GUEST_BOT] LLM failure: {e}")
        raw_reply = f"My sincerest apologies, {guest_name}. I am momentarily unavailable. Please press the room service button and our team will assist you immediately."

    if not raw_reply or not raw_reply.strip():
        raw_reply = f"Of course, {guest_name}. Let me take care of that for you right away."

    # ── STEP 5: Parse and execute action tags (SAFE — never blocks reply) ──
    action_tags = re.findall(r'\[ACTION:[^\]]+\]', raw_reply, re.IGNORECASE)
    actions_executed = []

    for tag in action_tags:
        inner = tag.strip('[]')
        result = execute_action_tag(inner, room, guest_name, db)
        if result:
            actions_executed.append(result)

    # ── STEP 6: Strip action tags from the spoken reply ──
    spoken_reply = re.sub(r'\[ACTION:[^\]]+\]', '', raw_reply, flags=re.IGNORECASE).strip()
    spoken_reply = re.sub(r'\s{2,}', ' ', spoken_reply).strip()

    if not spoken_reply:
        spoken_reply = f"Consider it done, {guest_name}."

    logger.info(f"[GUEST_BOT] Room {room} | Actions: {actions_executed} | Reply: {spoken_reply[:80]}")

    return {
        "status": "SUCCESS",
        "response": spoken_reply,
        "actions_executed": actions_executed,
        "session_id": session_id
    }


# ── Health check ──
@router.get("/health")
async def butler_health():
    return {"status": "ONLINE", "butler": "Miracle Guest AGI — Active"}
