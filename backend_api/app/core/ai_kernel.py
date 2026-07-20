# backend_api/app/core/ai_kernel.py
# ============================================================
# MIRACLE HMS — SOVEREIGN CLINICAL AI KERNEL (V12.0)
# "The Heart of Clinical Intelligence"
# ============================================================
import os
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.miracle_ai_models import MiracleSession, MiracleKnowledge

# Smart contextual recall (TF-IDF-inspired scoring -- 0 tokens)
try:
    from app.core.smart_recall import recall_knowledge_v2 as _smart_recall
    _SMART_RECALL_AVAILABLE = True
except ImportError:
    _SMART_RECALL_AVAILABLE = False

logger = logging.getLogger("AIKernel")

# Memory TTL: 8 hours (must match auto_session_purge_loop in main.py)
MEMORY_TTL_HOURS = 8
# Max turns to load per session (prevents context window bloat under high concurrency)
MEMORY_MAX_TURNS = 8


# ============================================================
# 🔐 SOVEREIGN KEY VAULT (Round-Robin Engine)
# ============================================================
_SOVEREIGN_KEY_VAULT = [
    os.getenv("GEMINI_API_KEY", ""),
    os.getenv("GEMINI_API_KEY_1", ""),
    os.getenv("GEMINI_API_KEY_2", ""),
    os.getenv("GEMINI_API_KEY_3", ""),
    os.getenv("GEMINI_API_KEY_4", ""),
]
_SOVEREIGN_KEY_VAULT = list(dict.fromkeys([k for k in _SOVEREIGN_KEY_VAULT if k]))
_key_index = 0
_key_lock = __import__("threading").Lock()

def _next_key() -> str:
    global _key_index
    with _key_lock:
        key = _SOVEREIGN_KEY_VAULT[_key_index % len(_SOVEREIGN_KEY_VAULT)]
        _key_index += 1
    return key

_KEY_EXHAUSTED_SIGNALS = ["quota", "rate_limit", "429", "exhausted", "per day"]

def _is_key_exhausted(error_message: str) -> bool:
    msg = error_message.lower()
    return any(signal.lower() in msg for signal in _KEY_EXHAUSTED_SIGNALS)

GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-flash"]

async def call_llm(messages, temperature: float = 0.7) -> str:
    """Sovereign In-House LLM Caller with Multi-Key Fallback."""
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]

    # Build Gemini payload
    system_instruction = next((msg["content"] for msg in messages if msg["role"] == "system"), None)
    contents = []
    for msg in messages:
        if msg["role"] != "system":
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    gemini_payload = {
        "contents": contents,
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 4096}
    }
    if system_instruction:
        gemini_payload["systemInstruction"] = {"role": "system", "parts": [{"text": system_instruction}]}

    num_keys = len(_SOVEREIGN_KEY_VAULT)
    async with httpx.AsyncClient(timeout=20.0) as client:
        for _ in range(num_keys):
            key = _next_key()
            for model in GEMINI_MODELS:
                try:
                    res = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
                        headers={"Content-Type": "application/json"},
                        json=gemini_payload
                    )
                    data = res.json()
                    if "candidates" in data and data["candidates"]:
                        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    
                    err_msg = str(data.get("error", {}).get("message", ""))
                    if _is_key_exhausted(err_msg):
                        break # Try next key
                except Exception as e:
                    logger.warning(f"Gemini call failed: {e}")
                    continue

    # Fallback to Groq
    if GROQ_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                    json={"model": "llama-3.1-8b-instant", "messages": messages, "temperature": temperature}
                )
                data = res.json()
                if "choices" in data:
                    return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"Groq fallback failed: {e}")

    return ""

# ============================================================
# 🧠 KNOWLEDGE & MEMORY ENGINE
# ============================================================

def recall_knowledge(db: Session, limit: int = 5, zone_scope: str = None, query: str = "") -> str:
    """
    V6.0 (Smart Recall): Contextual knowledge retrieval with TF-IDF-inspired scoring.
    When 'query' is provided, returns the MOST RELEVANT entries to that specific query.
    Without query, falls back to importance_score DESC (backward compatible).

    Always leads with ANTI_HALLUCINATION hard rules (importance 97-100).
    Zone-specific entries are always included when zone_scope is provided.
    """
    if _SMART_RECALL_AVAILABLE and query:
        return _smart_recall(db, query=query, limit=limit, zone_scope=zone_scope)
    if _SMART_RECALL_AVAILABLE:
        return _smart_recall(db, query="", limit=limit, zone_scope=zone_scope)

    # Fallback: original flat ordering (used if smart_recall import fails)
    try:
        corrections = (
            db.query(MiracleKnowledge)
            .filter(MiracleKnowledge.category == "ANTI_HALLUCINATION", MiracleKnowledge.status == "ACTIVE")
            .order_by(desc(MiracleKnowledge.created_at))
            .limit(3).all()
        )
        zone_wisdom = []
        if zone_scope:
            try:
                zone_wisdom = (
                    db.query(MiracleKnowledge)
                    .filter(
                        MiracleKnowledge.status == "ACTIVE",
                        MiracleKnowledge.category != "ANTI_HALLUCINATION",
                        MiracleKnowledge.zone_scope == zone_scope
                    )
                    .order_by(desc(MiracleKnowledge.importance_score))
                    .limit(3).all()
                )
            except Exception:
                zone_wisdom = []
        global_limit = max(1, limit - len(zone_wisdom))
        wisdom = (
            db.query(MiracleKnowledge)
            .filter(MiracleKnowledge.category != "ANTI_HALLUCINATION", MiracleKnowledge.status == "ACTIVE")
            .order_by(desc(MiracleKnowledge.importance_score), desc(MiracleKnowledge.created_at))
            .limit(global_limit).all()
        )
        lines = []
        if corrections:
            lines.append("=== HARD RULES (Self-Corrected -- Never Violate) ===")
            for c in corrections:
                lines.append(f"[RULE]: {c.prevention_rule or c.insight}")
            lines.append("=== END HARD RULES ===")
        if zone_wisdom:
            lines.append(f"=== ZONE KNOWLEDGE ({zone_scope}) ===")
            for w in zone_wisdom:
                lines.append(f"[{w.category}]: {w.insight}")
        for w in wisdom:
            lines.append(f"[{w.category}]: {w.insight}")
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Recall failed: {e}")
        return ""

def load_memory(session_id: str, db: Session, user_id: str = "anonymous", limit: int = None, zone: str = None) -> str:
    """
    V5.0 (Sprint 4 — Zone-Scoped Memory): Load rolling conversation history.
    CRITICAL: Scoped by BOTH session_id AND user_id to prevent cross-user data leakage.
    zone: if provided, ONLY memory entries from this zone are returned.
          This prevents the AI from reading Z-PROP investment conversations while
          answering a Z-07 housekeeping query (cross-zone memory pollution fix).
    ISOLATION ZONES: Z-PROP, Z-31, Z-WEB, Z-OWNER always get hard zone-scoped memory.
    """
    # These zones must always be zone-isolated regardless of caller passing zone param
    ALWAYS_ISOLATED_ZONES = {'Z-PROP', 'Z-31', 'Z-WEB', 'Z-OWNER', 'Z-31-PORTAL', 'Z-OWNER-PORTAL'}
    try:
        if limit is None:
            limit = MEMORY_MAX_TURNS
        cutoff = datetime.now(timezone.utc) - timedelta(hours=MEMORY_TTL_HOURS)
        # V4: DUAL-SCOPE FILTER — session_id alone is not sufficient
        q = db.query(MiracleSession).filter(
            MiracleSession.session_id == session_id,
            MiracleSession.created_at >= cutoff
        )
        # Only apply user_id filter for authenticated (non-anonymous) users
        if user_id and user_id not in ("anonymous", "Guest", ""):
            q = q.filter(MiracleSession.user_id == user_id)
        # V5.0: Zone scope filter — always applied for isolated zones, optional for others
        effective_zone = zone
        if zone and zone in ALWAYS_ISOLATED_ZONES:
            effective_zone = zone  # Force isolation
        if effective_zone:
            try:
                q = q.filter(MiracleSession.zone == effective_zone)
            except Exception:
                pass  # zone column may not be indexed — degrade gracefully
        rows = q.order_by(desc(MiracleSession.created_at)).limit(limit).all()
        rows.reverse()
        return "\n".join([f"{r.role.upper()}: {r.content}" for r in rows])
    except Exception as e:
        logger.error(f"Memory load failed: {e}")
        return ""

def save_memory(session_id: str, user_id: str, zone: str, role: str, content: str, db: Session):
    """V4.0: Save conversation turn to DB. user_id is required to enable dual-scope isolation."""
    try:
        safe_user_id = (user_id or "anonymous").strip() or "anonymous"
        entry = MiracleSession(
            session_id=session_id,
            user_id=safe_user_id,
            zone=zone,
            role=role,
            content=content[:4000]
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        logger.error(f"Memory save failed: {e}")
        db.rollback()


def purge_expired_sessions(db: Session) -> dict:
    """
    V4.0: SOVEREIGN SESSION REAPER.
    Deletes all miracle_sessions older than MEMORY_TTL_HOURS.
    Called by auto_session_purge_loop in main.py every hour.
    Returns a summary of purged rows for telemetry logging.
    """
    try:
        from sqlalchemy import text as _text
        cutoff = datetime.now(timezone.utc) - timedelta(hours=MEMORY_TTL_HOURS)
        # Use raw DELETE for maximum efficiency (avoids ORM fetch overhead)
        result = db.execute(
            _text("DELETE FROM miracle_sessions WHERE created_at < :cutoff"),
            {"cutoff": cutoff.isoformat()}
        )
        db.commit()
        purged = result.rowcount
        logger.info(f"[SESSION REAPER] Purged {purged} expired memory rows (TTL={MEMORY_TTL_HOURS}h).")
        return {"purged_rows": purged, "ttl_hours": MEMORY_TTL_HOURS, "cutoff": cutoff.isoformat()}
    except Exception as e:
        logger.error(f"[SESSION REAPER] Purge failed: {e}")
        db.rollback()
        return {"purged_rows": 0, "error": str(e)}


def load_visitor_profile(session_id: str, db: Session, user_id: str = None) -> dict | None:
    """
    V4.0: Load a visitor's self-identified role profile.
    Returns None if no intake has been completed yet.
    """
    try:
        from app.models.miracle_ai_models import AIVisitorProfile
        q = db.query(AIVisitorProfile).filter(
            AIVisitorProfile.session_id == session_id,
            AIVisitorProfile.intake_complete == True  # noqa: E712
        )
        if user_id and user_id not in ("anonymous", "Guest", ""):
            q = q.filter(AIVisitorProfile.user_id == user_id)
        profile = q.order_by(desc(AIVisitorProfile.created_at)).first()
        if profile:
            return {
                "visitor_role": profile.visitor_role,
                "country_hint": profile.country_hint,
                "intake_complete": profile.intake_complete
            }
        return None
    except Exception as e:
        logger.error(f"[VISITOR PROFILE] Load failed: {e}")
        return None
