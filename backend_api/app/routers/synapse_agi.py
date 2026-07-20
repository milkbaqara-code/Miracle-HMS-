"""
SYNAPSE AGI ENGINE - Phase 1: Fractal Directive Decomposition
Mounted at /synapse/agi prefix in main.py

Iron Law: Uses SOVEREIGN httpx REST API calls (NOT the genai SDK).
Same pattern as ai_kernel.py -- battle-proven, SDK-version-independent.
Fallback chain: Gemini 2.0 Flash -> Gemini 1.5 Flash -> Gemini Flash 8b -> Groq Llama
"""
import os
import json
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.models.models import Employee, AuditLog
from app.routers.hr import DEPT_TO_MATRIX_CODE

logger = logging.getLogger("SynapseAGI")

router = APIRouter(prefix="/synapse/agi", tags=["Synapse AGI Engine"])

# ── SOVEREIGN MODEL WATERFALL (mirrors ai_kernel.py) ────────────────────────
# These are REST endpoint model names -- NOT SDK aliases.
GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
]
GROQ_MODEL = "llama-3.1-8b-instant"


def _get_keys() -> list:
    """Collect all configured Gemini API keys."""
    keys = []
    for k in ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2",
              "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"]:
        v = os.environ.get(k, "").strip()
        if v:
            keys.append(v)
    return list(dict.fromkeys(keys))  # deduplicate while preserving order


async def _call_gemini_rest(prompt: str, system: str) -> str:
    """
    Call Gemini via direct REST API with multi-key, multi-model fallback.
    Returns raw text or raises RuntimeError if all paths exhausted.
    """
    keys = _get_keys()
    if not keys:
        raise RuntimeError("No Gemini API keys configured in .env")

    payload = {
        "systemInstruction": {"role": "user", "parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.35,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        }
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for key in keys:
            for model in GEMINI_MODELS:
                url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models"
                    f"/{model}:generateContent?key={key}"
                )
                try:
                    res = await client.post(
                        url,
                        headers={"Content-Type": "application/json"},
                        json=payload,
                    )
                    data = res.json()
                    if "candidates" in data and data["candidates"]:
                        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    err = data.get("error", {})
                    code = err.get("code", 0)
                    msg  = err.get("message", "")
                    logger.warning(f"Gemini {model} key={key[:12]}... -> {code}: {msg}")
                    # 404 = wrong model name, try next model
                    # 429/403 = quota/auth, try next key
                    if code in (429, 403):
                        break   # next key
                    # otherwise try next model
                except Exception as e:
                    logger.warning(f"Gemini {model} exception: {e}")
                    continue

    raise RuntimeError("All Gemini models exhausted.")


async def _call_groq_rest(prompt: str, system: str) -> str:
    """Groq Llama fallback via REST."""
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not groq_key:
        raise RuntimeError("No GROQ_API_KEY configured.")

    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": prompt},
    ]
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}",
                     "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": messages, "temperature": 0.35},
        )
        data = res.json()
        if "choices" in data:
            return data["choices"][0]["message"]["content"].strip()
        raise RuntimeError(f"Groq error: {data}")


async def _sovereign_generate(prompt: str, system: str) -> str:
    """Full sovereign fallback chain: Gemini -> Groq."""
    try:
        return await _call_gemini_rest(prompt, system)
    except Exception as ge:
        logger.warning(f"Gemini chain failed: {ge}. Trying Groq fallback...")
        try:
            return await _call_groq_rest(prompt, system)
        except Exception as qe:
            raise RuntimeError(f"ALL AI engines failed. Gemini: {ge} | Groq: {qe}")


# ── HELPERS ──────────────────────────────────────────────────────────────────

def _build_staff_context(employees: list, target_dept: str) -> str:
    context = []
    target_matrix_code = target_dept.upper() if target_dept else "ALL"
    
    for emp in employees:
        name = f"{emp.full_name} {emp.last_name or ''}".strip()
        
        primary_dept = emp.dept
        if emp.department_alignments and isinstance(emp.department_alignments, list) and len(emp.department_alignments) > 0:
            primary_dept = emp.department_alignments[0]
            
        mapped_code = DEPT_TO_MATRIX_CODE.get(primary_dept, str(primary_dept))
        if not mapped_code or mapped_code == "None":
            mapped_code = emp.dept or "GENERAL"
            
        context.append({
            "id": emp.id, "name": name,
            "tier": emp.executive_tier or "OPERATIVE",
            "dept": mapped_code, "on_duty": emp.status == "ON-DUTY",
            "alignments": emp.department_alignments or []
        })
        
    if target_matrix_code not in ("ALL", ""):
        filtered = []
        for e in context:
            if e["dept"].upper() == target_matrix_code:
                filtered.append(e)
            else:
                # Also check secondary alignments
                for alignment in e["alignments"]:
                    if DEPT_TO_MATRIX_CODE.get(alignment, "").upper() == target_matrix_code:
                        filtered.append(e)
                        break
        if filtered:
            context = filtered
            
    lines = [
        f"- ID: {e['id']} | {e['name']} | Dept: {e['dept']} | Tier: {e['tier']} | OnDuty: {e['on_duty']}"
        for e in context[:30]
    ]
    return "\n".join(lines)


def _sanitize_tasks(raw_tasks: list) -> list:
    sanitized = []
    for t in raw_tasks:
        if not isinstance(t, dict):
            continue
        est = t.get("estimated_minutes", 30)
        try:
            est = int(est)
        except (ValueError, TypeError):
            est = 30
        sanitized.append({
            "task_name":            str(t.get("task_name", "Unnamed task"))[:200],
            "assignee_id":          t.get("assignee_id") or None,
            "assignee_name":        t.get("assignee_name") or None,
            "department":           str(t.get("department", "GENERAL")),
            "requires_verification": bool(t.get("requires_verification", False)),
            "estimated_minutes":    max(5, min(est, 480)),
        })
    return sanitized


# ── ENDPOINT ─────────────────────────────────────────────────────────────────

@router.post("/decompose-directive")
async def agi_decompose_directive(data: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Phase 1: Fractal Directive Decomposition.
    Converts a single CDO executive sentence into a structured task sequence
    with optimal operative assignments from the Neural Tree.
    Uses sovereign httpx REST API -- no genai SDK dependency.
    """
    title       = (data.get("title") or "").strip()
    priority    = (data.get("priority") or "NORMAL").upper()
    target_dept = (data.get("target_dept") or "ALL").strip()
    issuer_id   = (data.get("issuer_id") or "CDO").strip()

    if not title:
        raise HTTPException(status_code=422, detail="Directive title is required.")

    # Step 1: Fetch Neural Tree (zero token cost)
    employees = db.query(Employee).filter(Employee.status != "TERMINATED").all()
    if not employees:
        raise HTTPException(status_code=404, detail="No active operatives found in the Neural Tree.")

    staff_context = _build_staff_context(employees, target_dept)
    task_target   = {"CRITICAL": 12, "STRATEGIC": 9, "NORMAL": 6}.get(priority, 6)

    # Step 2: Build prompt
    system_instruction = (
        "You are the Miracle HMS Synapse AGI Arbitrator. "
        "A world-class autonomous clinical operations engine inside a Hospital Management System (HMS). "
        "Your SOLE output is a valid JSON array. No prose, no markdown, no code fences. "
        "Each array item has EXACTLY these keys: "
        "task_name (string, imperative sentence, max 15 words), "
        "assignee_id (string matching an ID from the staff list, or null), "
        "assignee_name (string full name matching assignee_id, or null), "
        "department (string — use clinical dept names: Physicians/Nursing/Pharmacy/Lab/Admissions/etc), "
        "requires_verification (boolean, true for clinical, patient-safety, or critical tasks), "
        "estimated_minutes (integer, realistic time in minutes). "
        "No operative assigned to more than 2 tasks. "
        "Final task must always be a managerial or clinical lead sign-off or inspection. "
        "Prefer ON-DUTY operatives. Assign clinical tasks ONLY to clinical staff (DOCTOR/NURSE/LAB_TECH/PHARMACIST/EMR/WARD_ADMIN). "
        "Assign admin/operational tasks to ADMIN/HR/ACC/IT/MN/HK staff. "
        "CRITICAL: Escape all internal double quotes inside strings. Do NOT use newlines inside strings. "
        "The output MUST be 100% valid JSON parseable by Python json.loads()."
    )

    user_prompt = (
        f'DIRECTIVE: "{title}"\n'
        f"PRIORITY: {priority}\n"
        f"TARGET DEPT: {target_dept}\n\n"
        f"AVAILABLE OPERATIVES (Clinical & Admin Staff):\n{staff_context}\n\n"
        f"Generate exactly {task_target} tasks for a HOSPITAL MANAGEMENT SYSTEM. "
        "Assign clinical tasks to clinical staff only (DOCTOR/NURSE/PHARMACIST/LAB_TECH/EMR). "
        "Distribute across departments. "
        "Output only the JSON array."
    )

    # Step 3: Call sovereign AI chain
    try:
        raw_text = await _sovereign_generate(user_prompt, system_instruction)

        # Defensive: strip code fences if model ignores mime type
        raw_text = raw_text.strip()
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            raw_text = "\n".join(lines).strip()

        # Attempt to fix common JSON truncation/trailing comma issues
        if raw_text.endswith(",}"):
            raw_text = raw_text[:-2] + "}"
        elif raw_text.endswith(",]"):
            raw_text = raw_text[:-2] + "]"

        try:
            raw_tasks = json.loads(raw_text)
        except json.JSONDecodeError:
            # Fallback for severe JSON corruption: try ast.literal_eval if it's Python-like dict array
            import ast
            raw_tasks = ast.literal_eval(raw_text)
            
        if not isinstance(raw_tasks, list):
            raise ValueError("AGI did not return a JSON array.")

        sanitized = _sanitize_tasks(raw_tasks)

        # Step 4: Immutable audit trail
        try:
            db.add(AuditLog(
                action=f"AGI_DECOMPOSE: '{title[:80]}' -> {len(sanitized)} tasks | priority={priority}",
                operator=issuer_id,
                target="SYNAPSE_AGI_ENGINE",
            ))
            db.commit()
        except Exception:
            db.rollback()

        return {
            "status": "SUCCESS",
            "directive_title": title,
            "priority": priority,
            "task_count": len(sanitized),
            "tasks": sanitized,
        }

    except json.JSONDecodeError as je:
        raise HTTPException(
            status_code=502,
            detail=f"AGI returned malformed JSON. Parser error: {str(je)}"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"AGI Decomposition failed: {str(e)}"
        )
