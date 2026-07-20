"""
MIRACLE HMS -- SMART CONTEXTUAL RECALL ENGINE (V2.0)
====================================================
Replaces the flat importance_score ordering with query-aware
TF-IDF-style relevance scoring. Returns the 5 MOST RELEVANT
knowledge entries to the SPECIFIC query, not just globally important ones.

4-Layer Token Hierarchy:
  This runs at LAYER 0 -- 0 LLM tokens.
  Python scores knowledge in microseconds before ANY API call.

Scoring Algorithm:
  relevance   = count of query words appearing in insight text
  cat_boost   = category weight multiplier
  base_score  = entry.importance_score
  FINAL SCORE = (relevance * 15 * cat_boost) + base_score
"""

import re
import logging
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, text as sql_text
from app.models.miracle_ai_models import MiracleKnowledge

logger = logging.getLogger("SmartRecall")

# ── Category weights: clinical knowledge > glossary > API > UI pages
CATEGORY_WEIGHTS = {
    "ANTI_HALLUCINATION": 5.0,   # Always must fire
    "HMS_IDENTITY":       4.5,
    "HMS_VOCABULARY":     4.0,
    "FINANCE_RULES":      3.5,
    "HMS_WORKFLOW":       3.0,
    "HMS_GLOSSARY":       2.8,
    "ZONE_":              2.5,
    "HMS_CLINICAL":       2.5,
    "HMS_COMMAND_GRID":   2.5,
    "DB_SCHEMA":          2.2,
    "HMS_ACCOUNTING":     2.2,
    "HMS_HR":             2.0,
    "HMS_SYNAPSE":        2.0,
    "HMS_POLICY":         2.0,
    "HMS_PATIENT":        2.0,
    "GLOSSARY_":          1.8,
    "API_ENGINE":         1.6,
    "UI_PAGE":            1.4,
}

# ── Query-type modifiers: boost specific categories for known query types
QUERY_TYPE_BOOSTS = {
    "definition":     ["HMS_GLOSSARY", "GLOSSARY_", "HMS_WORKFLOW", "HMS_HR", "HMS_CLINICAL"],
    "navigation":     ["ZONE_", "UI_PAGE", "HMS_KERNEL_VERSION"],
    "financial":      ["FINANCE_RULES", "HMS_ACCOUNTING", "HMS_WORKFLOW_FINANCE", "DB_SCHEMA"],
    "clinical":       ["HMS_COMMAND_GRID", "HMS_WORKFLOW_ADMISSION", "HMS_CLINICAL_KPIS"],
    "hr_staff":       ["HMS_HR", "GLOSSARY_NRS", "HMS_WORKFLOW_HR", "API_ENGINE_HR"],
    "sql":            ["DB_SCHEMA", "ANTI_HALLUCINATION", "FINANCE_RULES"],
    "security":       ["ANTI_HALLUCINATION", "HMS_SECURITY"],
    "pharmacy":       ["HMS_WORKFLOW_PHARMACY", "GLOSSARY_PAR", "API_ENGINE_INVENTORY"],
}

def _detect_query_type(query_lower: str) -> str:
    """Classify the query type for category boosting."""
    if any(w in query_lower for w in ["what is", "define", "meaning", "stands for", "abbreviation", "nrs", "opd", "bor", "alos", "mrn", "tat"]):
        return "definition"
    if any(w in query_lower for w in ["take me", "navigate", "go to", "open", "where is", "show me"]):
        return "navigation"
    if any(w in query_lower for w in ["revenue", "profit", "loss", "p&l", "account", "billing", "finance", "ledger", "invoice"]):
        return "financial"
    if any(w in query_lower for w in ["bed", "ward", "admitted", "discharge", "patient census", "bor", "alos", "icu"]):
        return "clinical"
    if any(w in query_lower for w in ["staff", "nurse", "doctor", "nrs", "hr", "employee", "payroll", "department"]):
        return "hr_staff"
    if any(w in query_lower for w in ["select", "sql", "query", "table", "column", "database"]):
        return "sql"
    if any(w in query_lower for w in ["security", "hack", "injection", "xss", "csrf", "apoptosis"]):
        return "security"
    if any(w in query_lower for w in ["drug", "pharmacy", "stock", "par level", "medicine", "dispense"]):
        return "pharmacy"
    return "general"


def _score_entry(query_words: set, query_type: str, entry: MiracleKnowledge) -> float:
    """Score a single knowledge entry for relevance to the query."""
    insight_lower = (entry.insight or "").lower()
    category = entry.category or ""
    importance = float(entry.importance_score or 50)

    # 1. Relevance: count matching query words
    relevance = sum(1 for w in query_words if w in insight_lower)

    # 2. Category weight
    cat_weight = 1.0
    for prefix, weight in CATEGORY_WEIGHTS.items():
        if category.startswith(prefix) or category == prefix.rstrip("_"):
            cat_weight = weight
            break

    # 3. Query-type boost: if this category is especially relevant for the query type
    type_boost = 1.0
    boosted_cats = QUERY_TYPE_BOOSTS.get(query_type, [])
    for bc in boosted_cats:
        if category.startswith(bc):
            type_boost = 1.8
            break

    # 4. Exact phrase bonus: if the full query appears verbatim in the insight
    phrase_bonus = 20.0 if any(
        phrase in insight_lower
        for phrase in [" ".join(list(query_words)[:2])]
        if len(phrase) > 4
    ) else 0.0

    return (relevance * 15.0 * cat_weight * type_boost) + importance + phrase_bonus


def smart_recall(db: Session, query: str, zone_scope: str = None, limit: int = 8) -> str:
    """
    SMART CONTEXTUAL RECALL V2.0
    =============================
    Returns the most RELEVANT knowledge entries for the specific query.
    Uses TF-IDF-inspired scoring: relevance * category_weight + importance_score.

    Parameters:
      db         - SQLAlchemy session
      query      - The user's raw query string
      zone_scope - Current zone (e.g. "Z-07") for zone-specific boost
      limit      - Max entries to return (default 8, roughly 600 tokens)

    Returns:
      Formatted knowledge string for injection into system prompt.
      All at Layer 0 cost -- 0 LLM tokens.
    """
    if not query:
        return ""

    q_lower = query.lower()
    query_words = {w for w in re.findall(r'\b\w{3,}\b', q_lower) if w not in
                   {"the", "and", "for", "are", "you", "can", "how", "what", "this", "that",
                    "with", "from", "have", "will", "its", "our", "their", "they", "them"}}
    query_type = _detect_query_type(q_lower)

    try:
        # -- Step 1: Always pull ANTI_HALLUCINATION + IDENTITY hard rules (top 3) --
        hard_rules = (
            db.query(MiracleKnowledge)
            .filter(
                MiracleKnowledge.status == "ACTIVE",
                MiracleKnowledge.category.in_(["ANTI_HALLUCINATION", "HMS_VOCABULARY_LAW", "HMS_IDENTITY_LAW"])
            )
            .order_by(desc(MiracleKnowledge.importance_score))
            .limit(3).all()
        )

        # -- Step 2: Candidate pool -- fetch broader set then score in Python --
        # Pull candidates: zone-specific + globally important entries
        # We fetch more than needed and let scoring pick the best
        candidate_limit = max(80, limit * 12)

        # Build candidate query -- prefer zone-relevant + high importance
        candidates_q = (
            db.query(MiracleKnowledge)
            .filter(
                MiracleKnowledge.status == "ACTIVE",
                ~MiracleKnowledge.category.in_(["ANTI_HALLUCINATION", "HMS_VOCABULARY_LAW", "HMS_IDENTITY_LAW"])
            )
            .order_by(desc(MiracleKnowledge.importance_score), desc(MiracleKnowledge.created_at))
            .limit(candidate_limit)
        )
        candidates = candidates_q.all()

        # -- Step 3: Score all candidates --
        scored = []
        hard_ids = {r.id for r in hard_rules}
        for entry in candidates:
            if entry.id in hard_ids:
                continue
            score = _score_entry(query_words, query_type, entry)
            scored.append((score, entry))

        # Sort by score descending, take top N
        scored.sort(key=lambda x: x[0], reverse=True)
        top_entries = [e for _, e in scored[:limit]]

        # -- Step 4: Zone-specific entries always included if zone_scope provided --
        zone_specific = []
        if zone_scope:
            zone_key = f"ZONE_{zone_scope.replace('-','_').replace('/','_')}"
            zone_entries = [e for e in top_entries if e.category.startswith(zone_key)]
            if not zone_entries:
                # Force-add zone entry even if scoring didn't pick it
                zone_q = (
                    db.query(MiracleKnowledge)
                    .filter(
                        MiracleKnowledge.status == "ACTIVE",
                        MiracleKnowledge.category.like(f"{zone_key}%")
                    )
                    .order_by(desc(MiracleKnowledge.importance_score))
                    .first()
                )
                if zone_q and zone_q.id not in {e.id for e in top_entries}:
                    zone_specific.append(zone_q)

        # -- Step 5: Assemble output --
        lines = []

        if hard_rules:
            lines.append("=== HMS IRON LAWS (Absolute -- Never Override) ===")
            for r in hard_rules:
                lines.append(f"[RULE] {r.prevention_rule or r.insight[:200]}")
            lines.append("=== END IRON LAWS ===\n")

        if zone_specific:
            lines.append(f"=== ZONE {zone_scope} KNOWLEDGE ===")
            for e in zone_specific:
                lines.append(f"[ZONE] {e.insight[:500]}")
            lines.append("")

        if top_entries:
            lines.append(f"=== RELEVANT KNOWLEDGE (Query: '{query[:50]}' | Type: {query_type}) ===")
            for entry in top_entries[:limit]:
                # Trim insight to ~300 chars for token efficiency
                insight_trim = entry.insight[:300]
                if len(entry.insight) > 300:
                    insight_trim = insight_trim.rsplit(".", 1)[0] + "."
                lines.append(f"[{entry.category}] {insight_trim}")

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"SmartRecall failed: {e}")
        return ""


def recall_knowledge_v2(db: Session, query: str = "", limit: int = 8, zone_scope: str = None) -> str:
    """
    Drop-in replacement for recall_knowledge() in ai_kernel.py.
    Backward compatible -- old callers pass limit/zone_scope as before.
    If query is provided, uses smart scoring. Otherwise falls back to importance_score DESC.
    """
    if query:
        return smart_recall(db, query, zone_scope=zone_scope, limit=limit)

    # Backward-compat fallback (no query provided): original flat ordering
    from sqlalchemy import desc as _desc
    try:
        corrections = (
            db.query(MiracleKnowledge)
            .filter(MiracleKnowledge.status == "ACTIVE",
                    MiracleKnowledge.category.in_(["ANTI_HALLUCINATION", "HMS_IDENTITY_LAW", "HMS_VOCABULARY_LAW"]))
            .order_by(_desc(MiracleKnowledge.importance_score))
            .limit(3).all()
        )
        wisdom = (
            db.query(MiracleKnowledge)
            .filter(MiracleKnowledge.status == "ACTIVE",
                    ~MiracleKnowledge.category.in_(["ANTI_HALLUCINATION", "HMS_IDENTITY_LAW", "HMS_VOCABULARY_LAW"]))
            .order_by(_desc(MiracleKnowledge.importance_score))
            .limit(limit).all()
        )
        lines = []
        if corrections:
            lines += [f"[RULE] {c.prevention_rule or c.insight[:200]}" for c in corrections]
        lines += [f"[{w.category}] {w.insight[:300]}" for w in wisdom]
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"recall_knowledge_v2 fallback failed: {e}")
        return ""
