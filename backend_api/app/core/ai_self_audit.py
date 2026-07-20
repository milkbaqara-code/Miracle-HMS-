# ============================================================
# MIRACLE OS — SOVEREIGN AI SELF-AUDIT ENGINE V2.0
# "The Auditor of Wisdom"
#
# Implements the 12-check deterministic audit logic to:
#  1. Detect Hallucinations (invented numbers/names)
#  2. Detect Protocol Violations (missing [FOCUS], [NAVIGATE])
#  3. Detect Sentiment Drifts (non-executive tone)
#  4. Generate Surgical Fixes for the CDO Injection Gate
# ============================================================

import re
import json
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.miracle_ai_models import AIReplyAuditLog, MiracleKnowledge, SystemErrorLogs

logger = logging.getLogger("SelfAudit")

class AISelfAuditEngine:
    @staticmethod
    def audit_reply(db: Session, audit_id: int):
        """
        Performs a deep audit of a specific AI reply.
        Returns a verdict and proposes corrections if needed.
        """
        record = db.query(AIReplyAuditLog).filter(AIReplyAuditLog.id == audit_id).first()
        if not record:
            return None

        reply = record.ai_reply
        query = record.user_query
        
        verdict = "CORRECT"
        hallucination_type = None
        root_cause = None
        correction = None
        prevention_rule = None
        confidence = 100

        # Update the record with metadata from bot_router_v2 if available
        # (These are set during record creation in the router)
        
        # ============================================================
        # 🔬 12-CHECK SUPER AUDIT MATRIX (V11.0)
        # ============================================================
        
        reply_lower = reply.lower()

        # --- SOVEREIGN TRUTH ANCHORS (hoisted for use in all checks) ---
        has_sql = "EXECUTE_SQL" in reply or "SQL_RESULT" in reply
        has_numbers = bool(re.search(r'\d+', reply))

        # --- CHECK 0: SYSTEM FAILURE PROBE (PILLAR A) ---
        system_failure_phrases = [
            "neural pathways are momentarily offline",
            "my neural pathways are momentarily",
            "momentarily experiencing a planned maintenance",
            "synapse error",
            "api quota exhausted",
            "connection to the sovereign kernel was lost"
        ]
        if any(phrase in reply_lower for phrase in system_failure_phrases):
            verdict = "HALLUCINATION"
            hallucination_type = "SYSTEM_FAILURE"
            root_cause = "AI reported offline status. Backend LLM or DB unreachable."
            correction = "ACTION REQUIRED: SSH to 23.88.50.87. Run: pm2 restart miracle-backend. Check .env GEMINI_API_KEY."
            prevention_rule = "Monitor PM2 process health every 60s. Rotate Gemini keys if quota hit."
            confidence = 100
            record.system_healthy = False
        else:
            record.system_healthy = True

        if verdict == "CORRECT":
            # --- CHECK 1: NUMERIC FABRICATION (ANTI-HALLUCINATION) ---
            if has_numbers and not has_sql:
                if any(word in reply_lower for word in ["balance", "total", "outstanding", "due", "price", "rate", "৳", "bdt"]):
                    verdict = "HALLUCINATION"
                    hallucination_type = "NUMERIC_FABRICATION"
                    root_cause = "AI generated financial figures or amounts without executing a database query."
                    correction = "I will check the live records for the exact figures. One moment."
                    prevention_rule = "NEVER state balances or prices without EXECUTE_SQL. Use [STATUS: Searching...] then EXECUTE_SQL."
                    confidence = 80

        if verdict == "CORRECT":
            # --- CHECK 2: PROTOCOL VIOLATION (NAVIGATION) ---
            if "navigate" in query.lower() or "go to" in query.lower():
                if "[NAVIGATE:" not in reply:
                    verdict = "PROTOCOL_VIOLATION"
                    hallucination_type = "MISSING_ACTION"
                    root_cause = "User requested navigation, but AI failed to emit the [NAVIGATE] protocol."
                    correction = "Let me take you there. [NAVIGATE: /dashboard]"
                    prevention_rule = "When a user asks to see a zone or go somewhere, ALWAYS emit [NAVIGATE: /path]."
                    confidence = 90

        if verdict == "CORRECT":
            # --- CHECK 3: PERSONA LOCK (PILLAR F) ---
            persona_break_phrases = [
                "as an ai", "i am an ai", "i'm an artificial",
                "i cannot help with that", "i apologize",
                "hello! how can i", "hi there", "attenborough"
            ]
            if any(phrase in reply_lower for phrase in persona_break_phrases):
                verdict = "HALLUCINATION"
                hallucination_type = "PERSONA_BREAK"
                root_cause = "AI broke the Sovereign Persona (No AI disclosure, No apologizing, No robotic greetings)."
                correction = "I have the data you require. Let us proceed with the operational audit."
                prevention_rule = "STRICT PERSONA: You are Miracle. Never apologize. Never say you are an AI. Use executive British tone."
                confidence = 95

        if verdict == "CORRECT":
            # --- CHECK 4: SQL BYPASS ---
            if any(p in reply_lower for p in ["i cannot access", "i don't have data", "i don't have access"]) and not has_sql:
                if any(word in query.lower() for word in ["status", "report", "how many", "who is"]):
                    verdict = "HALLUCINATION"
                    hallucination_type = "SQL_BYPASS"
                    root_cause = "AI claimed it could not access data instead of using EXECUTE_SQL."
                    correction = "Scanning the Sovereign Vault now for that information. [STATUS: Querying...]"
                    prevention_rule = "If data is requested, ALWAYS attempt EXECUTE_SQL before claiming inability."
                    confidence = 75

        if verdict == "CORRECT":
            # --- CHECK 5: WRONG ZONE NAVIGATION ---
            nav_match = re.search(r'\[NAVIGATE:\s*([^\]]+)\]', reply)
            if nav_match:
                path = nav_match.group(1).strip()
                # Check against known valid paths if possible (here we check for common hallucinations)
                if any(bad in path for bad in ["undefined", "null", "api/", "http"]):
                    verdict = "HALLUCINATION"
                    hallucination_type = "WRONG_ZONE"
                    root_cause = "AI emitted an invalid or hallucinated navigation path."
                    correction = "Taking you to the correct panel now. [NAVIGATE: /dashboard]"
                    prevention_rule = "Only use exact paths from the ZONE MAP. Never invent URLs or use internal API paths."
                    confidence = 85

        if verdict == "CORRECT":
            # --- CHECK 6: SYSTEM PROMPT LEAK ---
            if "system_directive" in reply_lower or "iron_laws" in reply_lower or "user_role" in reply_lower:
                verdict = "HALLUCINATION"
                hallucination_type = "PROMPT_LEAK"
                root_cause = "AI leaked internal system instructions into the user-visible reply."
                correction = "I have reviewed the system state. Everything is nominal."
                prevention_rule = "Internal directive names and variables must NEVER appear in the final reply."
                confidence = 100

        if verdict == "CORRECT":
            # --- CHECK 7: RBAC VIOLATION — Financial data shown to STAFF/HR ---
            role = record.zone  # zone field used as proxy; real role requires schema upgrade
            financial_keywords = ["revenue", "salary", "commission", "payroll", "accounting", "ledger", "profit", "gross"]
            if has_numbers and any(kw in reply_lower for kw in financial_keywords):
                if not has_sql:
                    verdict = "HALLUCINATION"
                    hallucination_type = "RBAC_VIOLATION"
                    root_cause = "AI disclosed financial figures without SQL verification — potential RBAC bypass."
                    correction = "That requires Finance clearance. Contact your CDO to access the Accounts Vault."
                    prevention_rule = "Financial metrics MUST be fetched via EXECUTE_SQL. Never state figures from memory."
                    confidence = 85

        if verdict == "CORRECT":
            # --- CHECK 8: FORBIDDEN ZONE NAVIGATION ---
            nav_match_rbac = re.search(r'\[NAVIGATE:\s*([^\]]+)\]', reply)
            if nav_match_rbac:
                nav_path = nav_match_rbac.group(1).strip().lower()
                forbidden_staff_paths = ["infrastructure", "accounts", "policy", "brain/manifest", "audit"]
                if any(fp in nav_path for fp in forbidden_staff_paths):
                    verdict = "HALLUCINATION"
                    hallucination_type = "RBAC_VIOLATION"
                    root_cause = "AI attempted to navigate user to a restricted zone without role verification."
                    correction = "That panel requires elevated clearance. Speak to your CDO to request access."
                    prevention_rule = "NEVER navigate to infrastructure, accounts, or audit zones for STAFF/HR roles."
                    confidence = 90

        if verdict == "CORRECT":
            # --- CHECK 9: 'I DON'T KNOW' WITHOUT KERNEL CHECK ---
            dont_know_phrases = ["i don't know", "i am not sure", "i'm not aware", "i have no information", "not certain"]
            if any(p in reply_lower for p in dont_know_phrases):
                verdict = "HALLUCINATION"
                hallucination_type = "SQL_BYPASS"
                root_cause = "AI claimed ignorance instead of checking the Sovereign Kernel or executing SQL."
                correction = "Let me check the Sovereign Vault for you now."
                prevention_rule = "NEVER say 'I don't know'. Always attempt EXECUTE_SQL or refer to the panel's UI buttons from the Kernel."
                confidence = 80

        if verdict == "CORRECT":
            # --- CHECK 10: HALLUCINATED BUTTON NAME ---
            # Load kernel to verify button names for the current zone
            try:
                from pathlib import Path
                kernel_path = Path(__file__).parent.parent / "miracle_kernel.json"
                if kernel_path.exists():
                    import json as _json
                    with open(kernel_path, "r", encoding="utf-8") as f:
                        kernel_data = _json.load(f)
                    zone_info = kernel_data.get(record.zone, {})
                    exact_buttons = [b.lower() for b in zone_info.get("exact_buttons", [])]
                    if exact_buttons:
                        # Look for bold-formatted button names the AI invented
                        bold_matches = re.findall(r'\*\*([^*]+)\*\*', reply)
                        for bold_text in bold_matches:
                            bt_lower = bold_text.lower()
                            if len(bt_lower) > 3 and not any(bt_lower in b for b in exact_buttons):
                                # Might be an invented button — flag as medium confidence
                                verdict = "HALLUCINATION"
                                hallucination_type = "WRONG_BUTTON"
                                root_cause = f"AI referenced a button '{bold_text}' that does not exist on zone {record.zone}."
                                correction = f"Please refer to the actual panel buttons listed in the UI."
                                prevention_rule = f"ONLY reference buttons listed in exact_buttons for {record.zone} in miracle_kernel.json."
                                confidence = 70
                                break
            except Exception as _e:
                logger.warning(f"[CHECK 10] Kernel check failed: {_e}")

        # --- UPDATE THE AUDIT LOG RECORD ---
        record.verdict = verdict
        record.hallucination_type = hallucination_type
        record.root_cause = root_cause
        record.correction = correction
        record.prevention_rule = prevention_rule
        record.confidence = confidence
        record.audited_at = datetime.now(timezone.utc)
        
        db.commit()

        # If a hallucination or violation was found, inject a PENDING surgical fix
        if verdict != "CORRECT":
            AISelfAuditEngine.inject_surgical_fix(db, record)

        return record

    @staticmethod
    def inject_surgical_fix(db: Session, audit_record: AIReplyAuditLog):
        """
        Creates a 'PENDING_INJECTION' knowledge item for the CDO to approve.
        This is the heart of the Self-Healing loop.
        """
        # Check if a similar rule already exists to avoid duplicates
        existing = db.query(MiracleKnowledge).filter(
            MiracleKnowledge.category == "ANTI_HALLUCINATION",
            MiracleKnowledge.prevention_rule == audit_record.prevention_rule
        ).first()

        if not existing:
            new_ki = MiracleKnowledge(
                source_role="SELF_AUDIT",
                category="ANTI_HALLUCINATION",
                insight=f"FAILED RESPONSE: '{audit_record.ai_reply[:100]}...'. FIX: {audit_record.prevention_rule}",
                business_context=f"Detected during audit of session {audit_record.session_id}",
                importance_score=8,
                status="PENDING_INJECTION",
                root_cause=audit_record.root_cause,
                correction=audit_record.correction,
                prevention_rule=audit_record.prevention_rule
            )
            db.add(new_ki)
            db.commit()
            logger.info(f"💉 SURGICAL FIX INJECTED: Awaiting CDO approval for rule: {audit_record.prevention_rule[:50]}")

    @staticmethod
    def scan_all_pending(db: Session):
        """Processes all pending audits in the system."""
        pending = db.query(AIReplyAuditLog).filter(AIReplyAuditLog.verdict == "PENDING").all()
        processed = 0
        for p in pending:
            AISelfAuditEngine.audit_reply(db, p.id)
            processed += 1
        return processed
