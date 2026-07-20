# backend_api/app/models/miracle_ai_models.py
# ============================================================
# MIRACLE AI V4 — SOVEREIGN MEMORY, PROPOSALS & VISITOR PROFILING
# Enterprise-grade: multi-user safe, indexed, proposal-persistent.
# V4.0 CHANGES:
#   - Compound indexes on miracle_sessions for O(log n) multi-user lookups
#   - AIProposal: persistent cross-session AI action queue
#   - AIVisitorProfile: role intake identification ledger
# ============================================================
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, Index
from sqlalchemy.sql import func
from app.core.database import Base


class MiracleSession(Base):
    """
    Persistent conversation memory for Miracle AI.
    V4.0: Compound indexes added for O(log n) multi-user concurrent lookups.
    Memory is scoped by BOTH session_id AND user_id to prevent cross-user leakage.
    TTL: 8 hours — enforced by auto_session_purge_loop in main.py lifespan.
    """
    __tablename__ = "miracle_sessions"
    __table_args__ = (
        # Compound index: fastest path for load_memory(session_id, user_id)
        Index('ix_ms_session_user_time', 'session_id', 'user_id', 'created_at'),
        # Secondary index: purge job queries by created_at only
        Index('ix_ms_created_at', 'created_at'),
        {'extend_existing': True}
    )

    id          = Column(Integer, primary_key=True, index=True)
    session_id  = Column(String(128), nullable=False)   # browser-generated UUID
    user_id     = Column(String(100), nullable=False, server_default='anonymous')  # REQUIRED from V4
    zone        = Column(String(32), nullable=True)     # e.g. Z-07, Z-LOGIN
    role        = Column(String(16), nullable=False)    # 'user' or 'assistant'
    content     = Column(Text, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class FeatureRequest(Base):
    """
    Captures user-submitted feature requests from the 'Send to Dev' button.
    Accessible via the admin panel in Z-21.
    """
    __tablename__ = "feature_requests"
    __table_args__ = {'extend_existing': True}

    id           = Column(Integer, primary_key=True, index=True)
    reference    = Column(String(64), unique=True, index=True)      # e.g. MFR-2026-0422-001
    user_id      = Column(String(100), nullable=True)
    zone         = Column(String(32), nullable=True)
    request_text = Column(Text, nullable=False)
    status       = Column(String(32), default="PENDING")            # PENDING, IN_PROGRESS, SHIPPED
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at  = Column(DateTime(timezone=True), nullable=True)

class SalesLead(Base):
    """
    Captures qualified enterprise leads from the Z-LOGIN Miracle AI Sales Funnel.
    Displayed in Zone 22 (Sales CRM).
    """
    __tablename__ = "sales_leads"
    __table_args__ = {'extend_existing': True}

    id              = Column(Integer, primary_key=True, index=True)
    lead_name       = Column(String(128), nullable=False)
    enterprise_name = Column(String(128), nullable=False)
    enterprise_size = Column(String(64), nullable=False)
    contact_details = Column(String(128), nullable=False)
    status          = Column(String(32), default="NEW_LEAD")
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class LoginSessionLog(Base):
    """
    Immutable login and session history ledger.
    Records every login attempt (success/fail), logout, and session duration.
    Auto-created by Genesis on first boot. Cannot be deleted.
    """
    __tablename__ = "login_session_log"
    __table_args__ = {'extend_existing': True}

    id            = Column(Integer, primary_key=True, index=True)
    operative     = Column(String(128), index=True, nullable=False)   # username / 'VISITOR' / 'ADMIN'
    role          = Column(String(64), nullable=True)                  # assigned role
    outcome       = Column(String(32), nullable=False)                 # SUCCESS / FAILED / LOGOUT / TIMEOUT
    ip_address    = Column(String(64), nullable=True)                  # client IP (best-effort)
    user_agent    = Column(String(512), nullable=True)                 # browser/device signature
    session_token = Column(String(128), nullable=True)                 # opaque token reference
    login_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    logout_at     = Column(DateTime(timezone=True), nullable=True)     # None = session still active
    duration_min  = Column(Integer, nullable=True)                     # session duration in minutes


class AccessCredential(Base):
    """
    🔐 THE SOVEREIGN VAULT: Stores system passwords for Admin, Visitors, and Staff.
    Allows the Admin to manage and log passwords through the frontend.
    """
    __tablename__ = "access_credentials"
    __table_args__ = {'extend_existing': True}

    id            = Column(Integer, primary_key=True, index=True)
    label         = Column(String(128), unique=True, index=True) # e.g., 'ADMIN_GOD_MODE', 'VISITOR_DEMO'
    username      = Column(String(128), nullable=False)
    password      = Column(String(128), nullable=False)          # Stored as text for the 'Password Log' requirement
    role          = Column(String(64), nullable=False)
    description   = Column(String(255), nullable=True)
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MiracleKnowledge(Base):
    """
    THE COLLECTIVE WISDOM LEDGER: Stores distilled insights from human interactions.
    Not the conversation itself, but the 'Knowledge' extracted from it.
    V11.0: Added 'status' field for CDO Injection Gate (PENDING_INJECTION -> ACTIVE).
    """
    __tablename__ = "miracle_knowledge"
    __table_args__ = {'extend_existing': True}

    id              = Column(Integer, primary_key=True, index=True)
    source_role     = Column(String(64), nullable=True) # ADMIN, STAFF, GUEST, SELF_AUDIT
    category        = Column(String(128), nullable=True) # BUG, SUGGESTION, BARRIER, ANTI_HALLUCINATION
    insight         = Column(Text, nullable=False)
    business_context = Column(String(255), nullable=True)
    importance_score = Column(Integer, default=1)
    
    # V11.0: SURGICAL FIXES / ANTI-HALLUCINATION DATA
    root_cause      = Column(Text, nullable=True)
    correction      = Column(Text, nullable=True)
    prevention_rule = Column(Text, nullable=True)

    # V11.0 CDO GATE: PENDING_INJECTION | ACTIVE | REJECTED
    # Auto-detected fixes start as PENDING_INJECTION. CDO must APPROVE before active.
    status          = Column(String(32), default="PENDING_INJECTION", nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class AIReplyAuditLog(Base):
    """
    🔬 SOVEREIGN SELF-AUDIT LEDGER (Bidirectional Self-Learning)
    Records every AI reply, cross-checks it against Miracle OS ground truth,
    detects hallucinations, and stores the root cause + auto-correction.

    ARCHITECTURE:
    - Every reply triggers an async background audit via ai_self_audit.py
    - If a hallucination is detected, a CORRECTION is injected into MiracleKnowledge
      with importance_score=10 so it dominates future context windows.
    - This permanently prevents the same hallucination from recurring.

    VERDICT VALUES: CORRECT | HALLUCINATION | UNVERIFIABLE | PARTIAL
    """
    __tablename__ = "ai_reply_audit_log"
    __table_args__ = {'extend_existing': True}

    id              = Column(Integer, primary_key=True, index=True)
    session_id      = Column(String(128), index=True, nullable=True)
    zone            = Column(String(32), nullable=True)
    user_query      = Column(Text, nullable=False)
    ai_reply        = Column(Text, nullable=False)
    intent          = Column(String(128), nullable=True)

    # Audit verdict fields
    verdict            = Column(String(32), default="PENDING")       # CORRECT | HALLUCINATION | UNVERIFIABLE | SYSTEM_FAILURE
    hallucination_type = Column(String(128), nullable=True)          # WRONG_BUTTON | WRONG_ZONE | INVENTED_FACT | SYSTEM_FAILURE | PERSONA_BREAK | SQL_BYPASS
    root_cause         = Column(Text, nullable=True)
    correction         = Column(Text, nullable=True)
    prevention_rule    = Column(Text, nullable=True)                  # V11.0: Specific rule to prevent recurrence
    knowledge_id       = Column(Integer, nullable=True)
    confidence         = Column(Integer, default=0)

    # V11.0 EXTENDED TELEMETRY
    audit_source    = Column(String(32), default="AUTO")             # AUTO | MANUAL | FRONTEND | VOICE
    system_healthy  = Column(Boolean, nullable=True)                 # Was backend healthy at time of reply?
    llm_latency_ms  = Column(Integer, nullable=True)                 # Gemini response time in ms
    layer_used      = Column(String(32), nullable=True)              # LAYER_0 | LAYER_2 | LAYER_3 | LOCAL_BRAIN

    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    audited_at      = Column(DateTime(timezone=True), nullable=True)


class SystemErrorLogs(Base):
    """
    V12.0 THE CDO DIAGNOSTICS PIPELINE
    Captures raw stack traces, 502s, network drops, and PM2 crashes across Frontend and Backend.
    Provides the basis for AI diagnostic analysis and self-healing.
    """
    __tablename__ = "system_error_logs"
    __table_args__ = {'extend_existing': True}

    id             = Column(Integer, primary_key=True, index=True)
    source         = Column(String(32), nullable=False)               # FRONTEND | BACKEND | NETWORK | DATABASE
    error_type     = Column(String(128), nullable=False)              # e.g. TypeError, SyntaxError, 502 Bad Gateway
    error_message  = Column(Text, nullable=False)
    stack_trace    = Column(Text, nullable=True)
    url            = Column(String(255), nullable=True)
    user_agent     = Column(String(512), nullable=True)
    status         = Column(String(32), default="UNRESOLVED")         # UNRESOLVED | AI_ANALYZING | HEALED | IGNORED
    ai_analysis    = Column(Text, nullable=True)                      # The AI's explanation of why it crashed
    ai_proposed_fix = Column(Text, nullable=True)                     # The code fix or action to take
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ============================================================
# V4.0: PERSISTENT AI PROPOSAL QUEUE
# Every AI write-action proposal is saved here BEFORE the
# frontend renders it. This makes proposals:
#   - Survives browser refresh / tab close
#   - Visible to ALL authorized operators (not just the proposer)
#   - Auditable with full history (who approved, when)
# ============================================================
class AIProposal(Base):
    """
    Sovereign AI Action Proposal Ledger.
    Proposals are written here before being returned to the client.
    Frontend fetches pending proposals on load for the Proposal Hub.
    """
    __tablename__ = "ai_proposals"
    __table_args__ = (
        Index('ix_prop_status_created', 'status', 'created_at'),
        {'extend_existing': True}
    )

    id              = Column(Integer, primary_key=True, index=True)
    action_type     = Column(String(64), nullable=False, index=True)  # DISPATCH_ROOM | MORTGAGE_SWEEP | PAYOUT_SWEEP
    parameters      = Column(JSON, nullable=True)                      # {category, room_id, reason, ...}
    explanation     = Column(Text, nullable=True)                      # Human-readable AI rationale
    status          = Column(String(32), default='PENDING', nullable=False)  # PENDING | APPROVED | DECLINED | EXECUTED

    # Who and where
    requested_by    = Column(String(100), nullable=True)   # operator username who triggered the proposal
    session_id      = Column(String(128), nullable=True)   # originating session
    zone            = Column(String(32), nullable=True)    # which panel generated this

    # Approval audit trail
    approved_by     = Column(String(100), nullable=True)   # who approved
    approved_at     = Column(DateTime(timezone=True), nullable=True)
    decline_reason  = Column(Text, nullable=True)          # reason if declined

    # Execution result
    execution_result = Column(JSON, nullable=True)         # backend result after execution
    executed_at      = Column(DateTime(timezone=True), nullable=True)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())


# ============================================================
# V4.0: VISITOR ROLE INTAKE PROFILE
# On first AI interaction, the bot asks the visitor to identify
# themselves (Owner | Buyer | Investor | Realtor | Renter).
# This profile is persisted so the AI can personalize all
# subsequent replies without re-asking.
# ============================================================
class AIVisitorProfile(Base):
    """
    Stores the self-identified role of a visitor/user across sessions.
    Keyed by user_id (authenticated) or session_id (anonymous).
    """
    __tablename__ = "ai_visitor_profiles"
    __table_args__ = {'extend_existing': True}

    id              = Column(Integer, primary_key=True, index=True)
    session_id      = Column(String(128), index=True, nullable=False)  # browser session key
    user_id         = Column(String(100), index=True, nullable=True)   # authenticated user (if any)
    visitor_role    = Column(String(64), nullable=False)               # PROPERTY_OWNER | BUYER | INVESTOR | REALTOR | RENTER | OPERATOR
    country_hint    = Column(String(64), nullable=True)                # e.g. 'United States', 'UAE'
    intake_complete = Column(Boolean, default=False)                   # True once all intake Qs answered
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())
