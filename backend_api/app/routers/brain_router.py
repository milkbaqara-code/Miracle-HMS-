# backend_api/app/routers/brain_router.py
# ============================================================
# MIRACLE HMS — SOVEREIGN BRAIN MANAGEMENT API
# Zone: CDO Intelligence Control (Brain Router)
#
# RBAC: CDO / GM / SUPER_ADMIN only (all endpoints enforced)
# DB: SQLAlchemy ORM (primary) + raw sqlite3 (bulk ops)
# Prefix: /api/brain
#
# ENDPOINTS:
#   GET  /api/brain/status           — AI brain health dashboard
#   POST /api/brain/sync             — Trigger full brain resync
#   GET  /api/brain/knowledge        — Query knowledge entries
#   POST /api/brain/inject           — CDO inject knowledge
#   DELETE /api/brain/knowledge/{id} — Soft-retire a knowledge entry
#   GET  /api/brain/audit            — Last 50 AI audit log entries
#   POST /api/brain/correct          — Inject correction & mark audit
# ============================================================

import json
import logging
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.miracle_ai_models import AIReplyAuditLog, MiracleKnowledge

logger = logging.getLogger("BrainRouter")

# ──────────────────────────────────────────────────────────────
# ROUTER CONFIG
# ──────────────────────────────────────────────────────────────
router = APIRouter(
    prefix="/api/brain",
    tags=["ZONE AI: CDO Brain Management"],
)

# ──────────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────────
SECRET_KEY  = "MIRACLE_OS_SUPREME_SECRET_KEY_CHANGE_IN_PROD"
ALGORITHM   = "HS256"

# Absolute path for bulk sqlite3 operations (brain sync uses same path)
BRAIN_DB_PATH   = r"d:\Vigilant IT Solutions\Miracle_HMS\miracle_os_master.db"
LEDGER_PATH     = Path(r"d:\Vigilant IT Solutions\Miracle_HMS\.brain_sync_ledger.json")

# Roles authorised to manage the AI brain
ALLOWED_ROLES = {"CDO", "GM", "SUPER_ADMIN"}

# ──────────────────────────────────────────────────────────────
# RBAC GUARD
# ──────────────────────────────────────────────────────────────
def require_cdo_or_gm(request: Request) -> dict:
    """
    FastAPI dependency that enforces CDO / GM / SUPER_ADMIN access.

    Reads the Bearer JWT from the Authorization header, verifies it with
    the master secret, extracts the role claim, and raises HTTP 403 if the
    caller does not hold an authorised role.

    Returns the decoded JWT payload so downstream endpoints can access
    the caller's identity without re-decoding the token.

    Raises:
        HTTPException 401 — No / malformed token.
        HTTPException 403 — Valid token but role not permitted.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Brain API: Authorization header missing or malformed.",
        )

    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Brain API: Invalid or expired token — {exc}",
        )

    role = str(payload.get("role", "")).upper()
    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Brain API: Role '{role}' is not authorised. Required: CDO or GM.",
        )

    return payload


# ──────────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ──────────────────────────────────────────────────────────────
class KnowledgeInjectBody(BaseModel):
    """Payload for manually injecting a knowledge entry via CDO override."""
    category:         str = Field(..., min_length=2, max_length=128,  description="Knowledge category (e.g. ANTI_HALLUCINATION, BUG)")
    insight:          str = Field(..., min_length=5, max_length=4000, description="The distilled knowledge text")
    importance_score: int = Field(default=75, ge=1, le=100,           description="Priority weight (1=lowest, 100=highest)")
    prevention_rule:  str = Field(default="",  max_length=500,        description="Specific rule to prevent recurrence")
    business_context: str = Field(default="",  max_length=255,        description="Zone or department context")


class CorrectionBody(BaseModel):
    """Payload for injecting an AI correction and updating the audit log."""
    audit_log_id:     int = Field(..., description="ID of the AIReplyAuditLog entry to mark as CORRECTED")
    correct_response: str = Field(..., min_length=5, description="The factually correct response text")
    wrong_category:   str = Field(default="WRONG_FACT", max_length=128, description="Type of error (e.g. WRONG_BUTTON, INVENTED_FACT)")


# ──────────────────────────────────────────────────────────────
# HELPER: RAW SQLITE3 BULK QUERY
# ──────────────────────────────────────────────────────────────
def _raw_conn() -> sqlite3.Connection:
    """
    Opens a raw sqlite3 connection to the master brain DB.
    Used for bulk / aggregate operations where the ORM adds overhead.
    WAL mode is set on every open for concurrency safety.
    """
    conn = sqlite3.connect(BRAIN_DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.row_factory = sqlite3.Row
    return conn


# ──────────────────────────────────────────────────────────────
# 1. GET /api/brain/status
# ──────────────────────────────────────────────────────────────
@router.get("/status")
def get_brain_status(
    db:    Session = Depends(get_db),
    _auth: dict    = Depends(require_cdo_or_gm),
):
    """
    CDO Brain Health Dashboard.

    Returns a live snapshot of the Miracle AI knowledge base:
      - total_entries         : total rows in miracle_knowledge (any status)
      - entries_by_category   : counts grouped by category (ACTIVE only)
      - top_entries           : top 10 highest-importance ACTIVE entries
      - last_sync_time        : ISO timestamp of last brain sync from ledger file

    All aggregate counts are run via raw sqlite3 for O(1) speed.
    """
    try:
        conn = _raw_conn()
        cur  = conn.cursor()

        # — Total count (all statuses) —
        cur.execute("SELECT COUNT(*) FROM miracle_knowledge")
        total_entries = cur.fetchone()[0]

        # — Entries by category (ACTIVE only) —
        cur.execute(
            "SELECT category, COUNT(*) as cnt "
            "FROM miracle_knowledge WHERE status='ACTIVE' "
            "GROUP BY category ORDER BY cnt DESC"
        )
        entries_by_category = {row["category"]: row["cnt"] for row in cur.fetchall()}

        # — Top 10 by importance (ACTIVE only) —
        cur.execute(
            "SELECT category, importance_score, insight "
            "FROM miracle_knowledge WHERE status='ACTIVE' "
            "ORDER BY importance_score DESC LIMIT 10"
        )
        top_entries = [
            {
                "category":        row["category"],
                "importance_score": row["importance_score"],
                "insight":         (row["insight"] or "")[:100],
            }
            for row in cur.fetchall()
        ]

        conn.close()

        # — Last sync time from ledger file —
        last_sync_time = None
        if LEDGER_PATH.exists():
            try:
                stat = LEDGER_PATH.stat()
                last_sync_time = datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat()
            except Exception:
                last_sync_time = "LEDGER_STAT_ERROR"
        else:
            last_sync_time = "NEVER_SYNCED"

        return {
            "status":             "SUCCESS",
            "total_entries":      total_entries,
            "entries_by_category": entries_by_category,
            "top_entries":        top_entries,
            "last_sync_time":     last_sync_time,
        }

    except sqlite3.Error as exc:
        logger.error(f"Brain status DB error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Brain status query failed: {exc}",
        )


# ──────────────────────────────────────────────────────────────
# 2. POST /api/brain/sync
# ──────────────────────────────────────────────────────────────
@router.post("/sync")
def trigger_brain_sync(
    _auth: dict = Depends(require_cdo_or_gm),
):
    """
    Trigger a full Miracle AI brain resync.

    Launches brain_sync.run_full_sync() in a background daemon thread so the
    HTTP call returns immediately (non-blocking). The sync engine will:
      - Ingest all router .py files → API knowledge
      - Ingest all TSX pages       → UI panel knowledge
      - Ingest miracle_kernel.json → Zone knowledge
      - Ingest model files         → DB schema knowledge
      - Ingest HR + Accounting data

    The sync runs at Layer 0 cost — zero LLM tokens.

    Returns:
        message: Confirmation string
        status:  RUNNING
    """
    def _run_sync_in_background():
        try:
            logger.info("🧠 BRAIN SYNC: Background full sync initiated via API.")
            from app.core.brain_sync import run_full_sync
            run_full_sync()
            logger.info("🧠 BRAIN SYNC: Background full sync completed successfully.")
        except Exception as exc:
            logger.error(f"🚨 BRAIN SYNC: Background sync failed — {exc}")

    sync_thread = threading.Thread(
        target=_run_sync_in_background,
        daemon=True,
        name="BrainSyncWorker",
    )
    sync_thread.start()

    return {
        "message": "Brain sync started",
        "status":  "RUNNING",
    }


# ──────────────────────────────────────────────────────────────
# 3. GET /api/brain/knowledge
# ──────────────────────────────────────────────────────────────
@router.get("/knowledge")
def get_knowledge_entries(
    category: Optional[str] = None,
    search:   Optional[str] = None,
    limit:    int           = 50,
    db:       Session       = Depends(get_db),
    _auth:    dict          = Depends(require_cdo_or_gm),
):
    """
    Query the Miracle AI knowledge base.

    Supports optional filtering by category (exact match) and full-text
    search within the 'insight' column (case-insensitive LIKE). Results are
    ordered by importance_score descending.

    Query parameters:
        category  — Filter by exact category string (e.g. ANTI_HALLUCINATION)
        search    — Text to find anywhere in the insight field
        limit     — Maximum rows returned (default 50, max 200 enforced)

    Returns:
        List of knowledge entry dicts with all fields.
    """
    # Guard against absurdly large limits
    limit = min(limit, 200)

    query = db.query(MiracleKnowledge)

    if category:
        query = query.filter(MiracleKnowledge.category == category)

    if search:
        query = query.filter(
            MiracleKnowledge.insight.ilike(f"%{search}%")
        )

    entries = (
        query
        .order_by(MiracleKnowledge.importance_score.desc())
        .limit(limit)
        .all()
    )

    return {
        "status": "SUCCESS",
        "count":  len(entries),
        "data": [
            {
                "id":               e.id,
                "source_role":      e.source_role,
                "category":         e.category,
                "insight":          e.insight,
                "business_context": e.business_context,
                "importance_score": e.importance_score,
                "prevention_rule":  e.prevention_rule,
                "root_cause":       e.root_cause,
                "correction":       e.correction,
                "status":           e.status,
                "created_at":       e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
    }


# ──────────────────────────────────────────────────────────────
# 4. POST /api/brain/inject
# ──────────────────────────────────────────────────────────────
@router.post("/inject", status_code=status.HTTP_201_CREATED)
def inject_knowledge(
    body:  KnowledgeInjectBody,
    db:    Session = Depends(get_db),
    _auth: dict    = Depends(require_cdo_or_gm),
):
    """
    CDO Direct Knowledge Injection Gate.

    Bypasses the automated sync pipeline and writes a curated knowledge entry
    directly into miracle_knowledge with:
      - source_role  = 'CDO'
      - status       = 'ACTIVE'  (immediately usable by the AI — no gate required)

    Use this to inject anti-hallucination rules, correct AI misconceptions, or
    seed domain knowledge that the sync engine cannot auto-detect.

    Body:
        category         — Knowledge category string
        insight          — The distilled knowledge / rule text
        importance_score — Priority 1-100 (higher = more context weight)
        prevention_rule  — Specific prevention instruction for AI prompts
        business_context — Zone or operational context reference

    Returns:
        id      : The new knowledge entry ID
        message : Confirmation string
    """
    entry = MiracleKnowledge(
        source_role=     "CDO",
        category=        body.category.strip(),
        insight=         body.insight.strip(),
        importance_score=body.importance_score,
        prevention_rule= body.prevention_rule.strip(),
        business_context=body.business_context.strip(),
        status=          "ACTIVE",
    )

    try:
        db.add(entry)
        db.commit()
        db.refresh(entry)
        logger.info(
            f"🧠 CDO INJECT: Knowledge entry #{entry.id} "
            f"(category={entry.category}, score={entry.importance_score}) committed."
        )
        return {
            "id":      entry.id,
            "message": "Knowledge injected",
        }
    except Exception as exc:
        db.rollback()
        logger.error(f"Brain inject failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Knowledge injection failed: {exc}",
        )


# ──────────────────────────────────────────────────────────────
# 5. DELETE /api/brain/knowledge/{knowledge_id}
# ──────────────────────────────────────────────────────────────
@router.delete("/knowledge/{knowledge_id}")
def retire_knowledge_entry(
    knowledge_id: int,
    db:           Session = Depends(get_db),
    _auth:        dict    = Depends(require_cdo_or_gm),
):
    """
    Soft-Retire a Knowledge Entry.

    Sets status='RETIRED' on the specified miracle_knowledge row instead of
    physically deleting it. Retired entries are excluded from the AI context
    window but remain in the ledger for audit purposes.

    Path parameter:
        knowledge_id — Primary key of the miracle_knowledge row to retire

    Returns:
        message : Confirmation string with entry ID

    Raises:
        HTTPException 404 — Knowledge entry not found
    """
    entry = db.query(MiracleKnowledge).filter(MiracleKnowledge.id == knowledge_id).first()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge entry #{knowledge_id} not found.",
        )

    if entry.status == "RETIRED":
        return {
            "message": f"Knowledge entry #{knowledge_id} was already retired.",
        }

    try:
        entry.status = "RETIRED"
        db.commit()
        logger.info(f"🧠 BRAIN RETIRE: Knowledge entry #{knowledge_id} soft-deleted (RETIRED).")
        return {
            "message": f"Knowledge entry #{knowledge_id} retired",
        }
    except Exception as exc:
        db.rollback()
        logger.error(f"Brain retire failed for #{knowledge_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retire operation failed: {exc}",
        )


# ──────────────────────────────────────────────────────────────
# 6. GET /api/brain/audit
# ──────────────────────────────────────────────────────────────
@router.get("/audit")
def get_audit_log(
    verdict: Optional[str] = None,
    limit:   int           = 50,
    db:      Session       = Depends(get_db),
    _auth:   dict          = Depends(require_cdo_or_gm),
):
    """
    Sovereign AI Self-Audit Ledger.

    Returns the most recent AIReplyAuditLog entries, showing how the AI
    performed on each query and whether hallucinations were detected.

    Query parameters:
        verdict — Filter by verdict: CORRECT | HALLUCINATION | UNVERIFIABLE |
                  PARTIAL | CORRECTED | PENDING | SYSTEM_FAILURE (optional)
        limit   — Max rows returned (default 50, cap 200)

    Response fields per entry:
        id, zone, intent, layer_used, verdict, created_at,
        query[:80], response[:100]

    Raises:
        HTTPException 500 — DB query failure
    """
    limit = min(limit, 200)

    query = db.query(AIReplyAuditLog)

    if verdict:
        query = query.filter(
            AIReplyAuditLog.verdict == verdict.upper()
        )

    entries = (
        query
        .order_by(AIReplyAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "status":  "SUCCESS",
        "count":   len(entries),
        "verdict_filter": verdict,
        "data": [
            {
                "id":         e.id,
                "zone":       e.zone,
                "intent":     e.intent,
                "layer_used": e.layer_used,
                "verdict":    e.verdict,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "query":      (e.user_query or "")[:80],
                "response":   (e.ai_reply   or "")[:100],
            }
            for e in entries
        ],
    }


# ──────────────────────────────────────────────────────────────
# 7. POST /api/brain/correct
# ──────────────────────────────────────────────────────────────
@router.post("/correct")
def inject_correction(
    body:  CorrectionBody,
    db:    Session = Depends(get_db),
    _auth: dict    = Depends(require_cdo_or_gm),
):
    """
    CDO Correction Injection — Bidirectional Self-Learning Override.

    This endpoint closes the human-in-the-loop feedback cycle:

    1. Finds the specified AIReplyAuditLog entry.
    2. Creates a new MiracleKnowledge entry of category ANTI_HALLUCINATION
       with importance_score=99 (highest priority, dominates AI context).
    3. Updates the audit log entry's verdict to 'CORRECTED' so it is flagged
       in the audit ledger.

    The ANTI_HALLUCINATION entry will suppress the same hallucination in all
    future AI responses by injecting the correct answer into the context window.

    Body:
        audit_log_id     — ID of the AIReplyAuditLog row to correct
        correct_response — The factually accurate response / statement
        wrong_category   — Classification of the error type

    Returns:
        message          — Confirmation string

    Raises:
        HTTPException 404 — Audit log entry not found
        HTTPException 500 — DB commit failure
    """
    # — Resolve the audit log entry —
    audit_entry = (
        db.query(AIReplyAuditLog)
        .filter(AIReplyAuditLog.id == body.audit_log_id)
        .first()
    )

    if not audit_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AIReplyAuditLog entry #{body.audit_log_id} not found.",
        )

    # — Build the anti-hallucination knowledge entry —
    insight_text = (
        f"ANTI-HALLUCINATION CORRECTION\n"
        f"Zone: {audit_entry.zone or 'UNKNOWN'}\n"
        f"Error type: {body.wrong_category}\n"
        f"Original wrong reply (truncated): {(audit_entry.ai_reply or '')[:200]}\n"
        f"CORRECT RESPONSE: {body.correct_response}"
    )

    prevention_rule = (
        f"When asked about '{(audit_entry.user_query or '')[:100]}', "
        f"always respond with the corrected information. "
        f"Error type was: {body.wrong_category}. "
        f"Do NOT repeat the original hallucination."
    )

    knowledge_entry = MiracleKnowledge(
        source_role=     "CDO",
        category=        "ANTI_HALLUCINATION",
        insight=         insight_text[:4000],
        importance_score=99,
        prevention_rule= prevention_rule[:500],
        business_context=(audit_entry.zone or "CDO_CORRECTION"),
        root_cause=      body.wrong_category,
        correction=      body.correct_response[:2000],
        status=          "ACTIVE",
    )

    try:
        # — Commit the correction to the knowledge base —
        db.add(knowledge_entry)
        db.flush()  # get the new ID before updating audit

        # — Mark the audit log entry as corrected —
        audit_entry.verdict    = "CORRECTED"
        audit_entry.correction = body.correct_response[:2000]
        audit_entry.knowledge_id = knowledge_entry.id

        db.commit()
        db.refresh(knowledge_entry)

        logger.info(
            f"🧠 CORRECTION: AuditLog #{body.audit_log_id} marked CORRECTED. "
            f"Knowledge #{knowledge_entry.id} (ANTI_HALLUCINATION, score=99) injected."
        )

        return {
            "message":       "Correction injected into brain",
            "knowledge_id":  knowledge_entry.id,
            "audit_log_id":  body.audit_log_id,
        }

    except Exception as exc:
        db.rollback()
        logger.error(f"Brain correction failed for audit #{body.audit_log_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Correction injection failed: {exc}",
        )
