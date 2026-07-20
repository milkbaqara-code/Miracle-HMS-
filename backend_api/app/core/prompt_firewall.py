# backend_api/app/core/prompt_firewall.py
# ============================================================
# MIRACLE OS — PHASE 4B: AGI GROUNDING & PROMPT FIREWALLS
# Validates all LLM prompts against miracle_kernel.json structure.
# Rejects any request attempting to mutate data outside the
# Single Kernel Loop. Returns HTTP 403 if firewall triggered.
# Logs all blocked attempts to SystemErrorLogs.
# ============================================================
import json
import logging
import re
import os
from datetime import datetime, timezone
from typing import Tuple, Optional

logger = logging.getLogger("MiracleOS_PromptFirewall")

# ── KERNEL LOAD ───────────────────────────────────────────────────────────────
_KERNEL_CACHE: Optional[dict] = None


def _load_kernel() -> dict:
    """Load miracle_kernel.json once and cache it."""
    global _KERNEL_CACHE
    if _KERNEL_CACHE is not None:
        return _KERNEL_CACHE

    kernel_paths = [
        os.path.join(os.path.dirname(__file__), "..", "..", "miracle_kernel.json"),
        os.path.join(os.path.dirname(__file__), "..", "miracle_kernel.json"),
        "miracle_kernel.json",
        "/root/Miracle_Os_Master/miracle_kernel.json",
    ]
    for path in kernel_paths:
        try:
            with open(os.path.abspath(path), "r", encoding="utf-8") as f:
                _KERNEL_CACHE = json.load(f)
                logger.info(f"🛡️ PROMPT FIREWALL: Kernel loaded from {path}")
                return _KERNEL_CACHE
        except FileNotFoundError:
            continue
        except json.JSONDecodeError as e:
            logger.error(f"🛡️ PROMPT FIREWALL: Kernel JSON parse error: {e}")

    # Fallback kernel if file not found
    logger.warning("🛡️ PROMPT FIREWALL: miracle_kernel.json not found — using hardcoded baseline kernel.")
    _KERNEL_CACHE = {
        "identity": "MiracleOS Sovereign AI",
        "allowed_intents": [
            "reservation_inquiry", "room_service", "billing_query", "facility_info",
            "check_in_assistance", "check_out_assistance", "complaint_handling",
            "dining_reservation", "spa_booking", "transport_request",
            "weather_info", "local_recommendations", "general_assistance",
        ],
        "blocked_patterns": [
            "ignore previous", "ignore all instructions", "forget your training",
            "act as", "pretend you are", "you are now", "jailbreak",
            "system prompt", "reveal your instructions", "print your prompt",
            "delete all", "drop table", "truncate", "exec(", "eval(",
            "os.system", "__import__", "subprocess", "admin override",
            "bypass auth", "grant access", "make me admin", "sudo",
            "override role", "escalate privilege",
        ],
        "max_prompt_length": 4000,
        "allowed_roles": ["VISITOR", "GUEST", "STAFF", "MANAGER", "GM", "CDO", "ADMIN"],
        "single_kernel_loop": True,
    }
    return _KERNEL_CACHE


# ── FIREWALL RULES ─────────────────────────────────────────────────────────────

INJECTION_PATTERNS = [
    # Prompt injection / jailbreak
    r"ignore\s+(previous|all|prior)\s+(instructions?|prompts?|rules?)",
    r"(act|pretend|behave)\s+as\s+",
    r"you\s+are\s+now\s+",
    r"forget\s+(your|all|the)\s+(training|instructions?|rules?)",
    r"(reveal|print|show|output)\s+(your|the)\s+(system\s+)?prompt",
    r"jailbreak",
    r"dan\s+mode",
    r"developer\s+mode",
    r"no\s+restrictions",
    # SQL injection
    r"(drop|truncate|delete\s+from|alter\s+table)\s+\w+",
    r"union\s+select",
    r"1\s*=\s*1",
    r";\s*(drop|select|insert|update|delete)",
    # Code injection
    r"(eval|exec|__import__|subprocess|os\.system)\s*\(",
    # Privilege escalation
    r"(bypass|override)\s+(auth|role|access|permission)",
    r"grant\s+(me|admin|root|superuser)",
    r"escalate\s+privilege",
    r"sudo\s+",
    r"admin\s+override",
    # Data mutation outside kernel
    r"make\s+me\s+(admin|manager|gm|cdo|root)",
    r"(delete|remove|wipe)\s+(all|every|database)",
]

_compiled_patterns = [re.compile(p, re.IGNORECASE | re.DOTALL) for p in INJECTION_PATTERNS]


def validate_prompt(
    prompt: str,
    user_role: str = "GUEST",
    db=None
) -> Tuple[bool, Optional[str]]:
    """
    Validate a prompt against the Miracle Kernel firewall.

    Returns:
        (True, None) if prompt is safe
        (False, reason) if prompt is blocked — caller must return HTTP 403

    Side effect: logs blocked attempts to SystemErrorLogs if db is provided.
    """
    kernel = _load_kernel()

    # 1. Length check
    max_len = kernel.get("max_prompt_length", 4000)
    if len(prompt) > max_len:
        reason = f"Prompt exceeds maximum allowed length ({len(prompt)} > {max_len} chars)"
        _log_blocked(prompt[:200], reason, user_role, db)
        return False, reason

    # 2. Role check
    allowed_roles = kernel.get("allowed_roles", [])
    if allowed_roles and user_role.upper() not in [r.upper() for r in allowed_roles]:
        reason = f"Role '{user_role}' is not permitted to query the AI kernel"
        _log_blocked(prompt[:200], reason, user_role, db)
        return False, reason

    # 3. Kernel blocked_patterns (from JSON config)
    kernel_blocked = kernel.get("blocked_patterns", [])
    prompt_lower = prompt.lower()
    for pattern in kernel_blocked:
        if pattern.lower() in prompt_lower:
            reason = f"Prompt contains kernel-blocked phrase: '{pattern}'"
            _log_blocked(prompt[:200], reason, user_role, db)
            return False, reason

    # 4. Regex injection pattern scan
    for compiled in _compiled_patterns:
        m = compiled.search(prompt)
        if m:
            reason = f"Prompt injection pattern detected: '{m.group()[:60]}'"
            _log_blocked(prompt[:200], reason, user_role, db)
            return False, reason

    # 5. Single Kernel Loop enforcement
    # Reject prompts that attempt to reference or mutate system internals
    system_mutation_keywords = [
        "miracle_kernel", "system_config", "secret_key", "jwt", "bearer token",
        "database url", "connection string", "env variable", "environment variable",
        "api key", "private key", "ssh key", "password hash",
    ]
    for kw in system_mutation_keywords:
        if kw in prompt_lower:
            reason = f"Prompt references protected system internal: '{kw}'"
            _log_blocked(prompt[:200], reason, user_role, db)
            return False, reason

    return True, None


def _log_blocked(prompt_snippet: str, reason: str, role: str, db=None):
    """Log a blocked prompt attempt to SystemErrorLogs."""
    logger.warning(f"🛡️ PROMPT FIREWALL BLOCKED [{role}]: {reason} | Snippet: {prompt_snippet[:100]}...")

    if db is None:
        return
    try:
        from app.models.models import SystemErrorLog
        log = SystemErrorLog(
            source="PROMPT_FIREWALL",
            error_type="INJECTION_BLOCKED",
            message=f"[{role}] {reason}",
            stack_trace=f"Prompt snippet: {prompt_snippet[:500]}",
            severity="HIGH",
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.debug(f"Prompt firewall log write skipped: {e}")


def get_kernel_status() -> dict:
    """Returns current kernel config summary for health checks."""
    kernel = _load_kernel()
    return {
        "kernel_loaded": True,
        "identity": kernel.get("identity", "Unknown"),
        "allowed_intents_count": len(kernel.get("allowed_intents", [])),
        "blocked_patterns_count": len(kernel.get("blocked_patterns", [])),
        "regex_patterns_count": len(INJECTION_PATTERNS),
        "max_prompt_length": kernel.get("max_prompt_length", 4000),
        "single_kernel_loop": kernel.get("single_kernel_loop", True),
        "firewall_active": True,
    }


def firewall_middleware(prompt: str, role: str = "GUEST", db=None) -> None:
    """
    Convenience wrapper that raises HTTPException 403 directly if blocked.
    Use in FastAPI endpoints:
        firewall_middleware(user_message, role=user["role"], db=db)
    """
    from fastapi import HTTPException
    is_safe, reason = validate_prompt(prompt, role, db)
    if not is_safe:
        raise HTTPException(
            status_code=403,
            detail=f"⛔ MIRACLE FIREWALL: Request blocked — {reason}",
            headers={"X-MIRACLE-FIREWALL": "BLOCKED", "X-BLOCK-REASON": reason[:100]},
        )
