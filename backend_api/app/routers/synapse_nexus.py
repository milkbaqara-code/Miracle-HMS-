from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import uuid
import json
import os
import shutil
from pathlib import Path

from app.core.database import get_db
from app.models.models import (
    Employee, StrategicDirective, DirectiveNode,
    WebRTCSession, AuditLog, SolveMission,
    SynapseThread, SynapseMessage, StaffVault, VaultFile
)

router = APIRouter(prefix="/synapse", tags=["Synapse Nexus"])

# ============================================================
# ZONE 20: SYNAPSE NEXUS -- CORPORATE HIERARCHY PROTOCOL
# Iron Law: No operative may bypass their chain of command.
# ============================================================

# Tier weights derived from executive_tier (set during HR Onboarding)
TIER_WEIGHTS: Dict[str, int] = {
    "C-SUITE": 4, "BOARD": 4,
    "DIRECTOR": 3,
    "MANAGER": 2,
    "OPERATIVE": 1,
}

def get_tier(executive_tier: Optional[str]) -> int:
    if not executive_tier:
        return 1
    return TIER_WEIGHTS.get(executive_tier.upper(), 1)


# ============================================================
# GATEKEEPER -- the mathematical heart of Zone 20
# ============================================================
def gatekeeper_check(initiator: Employee, target: Employee) -> Dict[str, Any]:
    """
    Returns ALLOW, ALLOW_WITH_CC, or REQUIRE_BRIDGE.
    Rule:
      - delta >= 0 (talking down or same level): ALLOW (if top-down, auto-CC manager)
      - delta == -1 (talking to immediate superior): ALLOW
      - delta <= -2 (skipping the chain): REQUIRE_BRIDGE
    """
    i_tier = get_tier(initiator.executive_tier)
    t_tier = get_tier(target.executive_tier)
    delta = i_tier - t_tier

    if delta >= 0:
        return {"verdict": "ALLOW", "auto_cc": True if delta >= 2 else False}
    elif delta == -1:
        return {"verdict": "ALLOW", "auto_cc": False}
    else:
        return {"verdict": "REQUIRE_BRIDGE", "auto_cc": False}


def find_immediate_manager(emp: Employee, db: Session) -> Optional[Employee]:
    """Find the lowest MANAGER in the same dept above an OPERATIVE."""
    managers = db.query(Employee).filter(
        Employee.dept == emp.dept,
        Employee.executive_tier.in_(["MANAGER", "DIRECTOR"]),
        Employee.status != "TERMINATED"
    ).all()
    if not managers:
        # Fall back to any manager in the system
        managers = db.query(Employee).filter(
            Employee.executive_tier.in_(["MANAGER", "DIRECTOR"]),
            Employee.status != "TERMINATED"
        ).all()
    if not managers:
        return None
    # Return lowest tier manager (closest to operative)
    return min(managers, key=lambda m: get_tier(m.executive_tier))


# ============================================================
# WebSocket Connection Manager (real-time chat)
# ============================================================
class SynapseChatManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, thread_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(thread_id, []).append(ws)

    def disconnect(self, thread_id: str, ws: WebSocket):
        if thread_id in self.connections:
            self.connections[thread_id] = [c for c in self.connections[thread_id] if c != ws]

    async def broadcast(self, thread_id: str, message: dict):
        for ws in self.connections.get(thread_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                pass

chat_manager = SynapseChatManager()


# ============================================================
# A. ORG CHART (Neural Tree)
# ============================================================
@router.get("/org-chart")
def get_org_chart(db: Session = Depends(get_db)):
    """Hierarchical org-chart sorted by tier weight for the Neural Tree UI."""
    employees = db.query(Employee).filter(Employee.status != "TERMINATED").all()
    nodes = []
    for emp in employees:
        tier = get_tier(emp.executive_tier)
        nodes.append({
            "id": emp.id,
            "name": f"{emp.full_name} {emp.last_name or ''}".strip(),
            "position": emp.position or "Operative",
            "department": emp.dept or "GENERAL",
            "executive_tier": emp.executive_tier or "OPERATIVE",
            "tier_weight": tier,
            "on_duty": emp.status == "ON-DUTY",
            "is_online": getattr(emp, 'is_online', False),
            "last_seen": emp.last_seen.isoformat() if getattr(emp, 'last_seen', None) else None,
            "status": emp.status,
            "avatar_url": emp.avatar_url or "",
            "shift_start": emp.shift_start.isoformat() if emp.shift_start else None,
        })
    nodes.sort(key=lambda n: (-n["tier_weight"], n["name"]))
    return {
        "status": "SUCCESS",
        "total_staff": len(nodes),
        "on_duty_count": sum(1 for n in nodes if n["on_duty"]),
        "online_count": sum(1 for n in nodes if n["is_online"]),
        "nodes": nodes
    }


# ============================================================
# B. GATEKEEPER CHECK (pre-flight before opening a thread)
# ============================================================
@router.get("/can-message")
def can_message(initiator_id: str, target_id: str, db: Session = Depends(get_db)):
    """
    Returns the verdict BEFORE the user tries to send a message.
    Frontend uses this to show LOCK icon vs OPEN chat.
    """
    initiator = db.query(Employee).filter(Employee.id == initiator_id).first()
    target = db.query(Employee).filter(Employee.id == target_id).first()
    if not initiator or not target:
        raise HTTPException(status_code=404, detail="Operative not found.")

    result = gatekeeper_check(initiator, target)
    manager = None
    if result["verdict"] == "REQUIRE_BRIDGE":
        mgr = find_immediate_manager(initiator, db)
        if mgr:
            manager = {"id": mgr.id, "name": f"{mgr.full_name} {mgr.last_name or ''}".strip()}
    return {
        "verdict": result["verdict"],
        "auto_cc": result["auto_cc"],
        "initiator_tier": get_tier(initiator.executive_tier),
        "target_tier": get_tier(target.executive_tier),
        "bridge_manager": manager
    }


# ============================================================
# C. THREAD MANAGEMENT
# ============================================================
@router.post("/threads")
def create_thread(data: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Create or retrieve a DIRECT thread. If gatekeeper returns REQUIRE_BRIDGE,
    the request must pass bridge_manager_id or it will be rejected.
    """
    initiator_id = data.get("initiator_id")
    target_id = data.get("target_id")
    force_bridge_mgr = data.get("bridge_manager_id")

    initiator = db.query(Employee).filter(Employee.id == initiator_id).first()
    target = db.query(Employee).filter(Employee.id == target_id).first()
    if not initiator or not target:
        raise HTTPException(status_code=404, detail="Operative not found.")

    result = gatekeeper_check(initiator, target)

    if result["verdict"] == "REQUIRE_BRIDGE" and not force_bridge_mgr:
        mgr = find_immediate_manager(initiator, db)
        raise HTTPException(status_code=403, detail={
            "code": "BRIDGE_REQUIRED",
            "message": "Direct communication not permitted. Chain of command protocol enforced.",
            "bridge_manager_id": mgr.id if mgr else None,
            "bridge_manager_name": f"{mgr.full_name} {mgr.last_name or ''}".strip() if mgr else "No Manager Found"
        })

    # Check for existing active direct thread between these two
    existing = db.query(SynapseThread).filter(
        SynapseThread.initiator_id == initiator_id,
        SynapseThread.target_id == target_id,
        SynapseThread.is_active == True
    ).first()
    if not existing:
        existing = db.query(SynapseThread).filter(
            SynapseThread.initiator_id == target_id,
            SynapseThread.target_id == initiator_id,
            SynapseThread.is_active == True
        ).first()

    if existing:
        return {"status": "SUCCESS", "thread_id": existing.id, "is_new": False}

    thread_type = "BRIDGED" if force_bridge_mgr else "DIRECT"
    thread = SynapseThread(
        id=f"THR-{uuid.uuid4().hex[:8].upper()}",
        thread_type=thread_type,
        subject=data.get("subject", f"{initiator.full_name} <> {target.full_name}"),
        initiator_id=initiator_id,
        initiator_tier=get_tier(initiator.executive_tier),
        target_id=target_id,
        target_tier=get_tier(target.executive_tier),
        bridge_manager_id=force_bridge_mgr if thread_type == "BRIDGED" else None
    )
    db.add(thread)

    # System message to announce thread creation
    sys_msg = SynapseMessage(
        thread_id=thread.id,
        sender_id="SYSTEM",
        sender_name="Synapse Kernel",
        sender_tier=4,
        content=f"Secure channel opened. {thread_type} thread. Chain of command: enforced.",
        msg_type="SYSTEM"
    )
    db.add(sys_msg)

    audit = AuditLog(
        action=f"SYNAPSE_THREAD_CREATED: {thread_type} {initiator_id} -> {target_id}",
        operator=initiator.full_name,
        target=target.full_name
    )
    db.add(audit)
    db.commit()

    return {"status": "SUCCESS", "thread_id": thread.id, "thread_type": thread_type, "is_new": True}


@router.get("/threads/{employee_id}")
def get_my_threads(employee_id: str, db: Session = Depends(get_db)):
    """Returns all threads an employee participates in."""
    threads = db.query(SynapseThread).filter(
        ((SynapseThread.initiator_id == employee_id) |
         (SynapseThread.target_id == employee_id) |
         (SynapseThread.bridge_manager_id == employee_id)),
        SynapseThread.is_active == True
    ).order_by(desc(SynapseThread.last_message_at)).all()

    result = []
    for t in threads:
        last_msg = t.messages[-1] if t.messages else None
        result.append({
            "thread_id": t.id,
            "thread_type": t.thread_type,
            "subject": t.subject,
            "last_message": last_msg.content[:80] if last_msg else "",
            "last_sender": last_msg.sender_name if last_msg else "",
            "last_at": last_msg.sent_at.isoformat() if last_msg else t.created_at.isoformat(),
            "unread": sum(1 for m in t.messages if not m.is_read and m.sender_id != employee_id),
            "initiator_id": t.initiator_id,
            "target_id": t.target_id,
            "bridge_manager_id": t.bridge_manager_id
        })

    return {"status": "SUCCESS", "threads": result}


@router.get("/threads/{thread_id}/messages")
def get_thread_messages(thread_id: str, db: Session = Depends(get_db)):
    """Fetch all messages in a thread."""
    thread = db.query(SynapseThread).filter(SynapseThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found.")
    msgs = [
        {
            "id": m.id, "sender_id": m.sender_id, "sender_name": m.sender_name,
            "sender_tier": m.sender_tier, "content": m.content,
            "msg_type": m.msg_type, "attachment_url": m.attachment_url,
            "sent_at": m.sent_at.isoformat()
        } for m in thread.messages
    ]
    return {"status": "SUCCESS", "messages": msgs}


@router.post("/threads/{thread_id}/messages")
def post_message(thread_id: str, data: Dict[str, Any], db: Session = Depends(get_db)):
    """Post a message via REST (WebSocket is preferred for real-time)."""
    thread = db.query(SynapseThread).filter(SynapseThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found.")

    sender = db.query(Employee).filter(Employee.id == data.get("sender_id")).first()
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found.")

    msg = SynapseMessage(
        thread_id=thread_id,
        sender_id=sender.id,
        sender_name=f"{sender.full_name} {sender.last_name or ''}".strip(),
        sender_tier=get_tier(sender.executive_tier),
        content=data.get("content", ""),
        msg_type=data.get("msg_type", "TEXT")
    )
    db.add(msg)
    thread.last_message_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "SUCCESS", "message_id": msg.id}


# ============================================================
# D. REAL-TIME WEBSOCKET CHAT
# ============================================================
@router.websocket("/chat/{thread_id}")
async def synapse_chat_ws(thread_id: str, websocket: WebSocket):
    """
    Real-time WebSocket chat for a Synapse thread.
    Clients send: {"sender_id": "OP-001", "content": "Hello", "msg_type": "TEXT"}
    Server broadcasts to all participants of the thread.
    """
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        thread = db.query(SynapseThread).filter(
            SynapseThread.id == thread_id, SynapseThread.is_active == True
        ).first()
        if not thread:
            await websocket.close(code=4004)
            return
    finally:
        db.close()

    await chat_manager.connect(thread_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            db = SessionLocal()
            try:
                payload = json.loads(raw)
                sender = db.query(Employee).filter(Employee.id == payload.get("sender_id")).first()
                if not sender:
                    continue

                msg = SynapseMessage(
                    thread_id=thread_id,
                    sender_id=sender.id,
                    sender_name=f"{sender.full_name} {sender.last_name or ''}".strip(),
                    sender_tier=get_tier(sender.executive_tier),
                    content=payload.get("content", ""),
                    msg_type=payload.get("msg_type", "TEXT")
                )
                db.add(msg)
                
                # Fetch thread inside this short-lived session to update it
                thread_in_session = db.query(SynapseThread).filter(SynapseThread.id == thread_id).first()
                if thread_in_session:
                    thread_in_session.last_message_at = datetime.now(timezone.utc)
                    
                db.commit()
                db.refresh(msg)

                await chat_manager.broadcast(thread_id, {
                    "id": msg.id,
                    "sender_id": msg.sender_id,
                    "sender_name": msg.sender_name,
                    "sender_tier": msg.sender_tier,
                    "content": msg.content,
                    "msg_type": msg.msg_type,
                    "sent_at": msg.sent_at.isoformat()
                })
            except (json.JSONDecodeError, Exception):
                db.rollback()
            finally:
                db.close()
    except WebSocketDisconnect:
        chat_manager.disconnect(thread_id, websocket)


# ============================================================
# E. STRATEGIC DIRECTIVES (Kanban -- preserved from V1)
# ============================================================
@router.get("/directives")
def list_directives(db: Session = Depends(get_db)):
    directives = db.query(StrategicDirective).order_by(desc(StrategicDirective.created_at)).all()
    priority_weight = {"CRITICAL": 0, "STRATEGIC": 1, "NORMAL": 2}
    result = []
    for d in directives:
        completion = (sum(1 for n in d.nodes if n.is_completed) / len(d.nodes) * 100) if d.nodes else 0
        
        # Get attached files
        attached_files = db.query(VaultFile).filter(VaultFile.directive_id == d.id).all()
        
        result.append({
            "id": d.id, "title": d.title, "description": d.description,
            "status": d.status, "priority": d.priority,
            "priority_weight": priority_weight.get(d.priority, 2),
            "issued_by": d.issued_by, "target_dept": d.target_dept,
            "tagged_operatives": d.tagged_operatives or [],
            "parent_directive_id": d.parent_directive_id,
            "node_count": len(d.nodes), "completion_pct": round(completion, 1),
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "picked_at": d.picked_at.isoformat() if d.picked_at else None,
            "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            "nodes": [
                {
                    "id": n.id, 
                    "task": n.task_name, 
                    "done": n.is_completed,
                    "assigned_to_id": n.assigned_to_id,
                    "target_dept": n.target_dept,
                    "requires_verification": n.requires_verification,
                    "verification_status": n.verification_status,
                    "started_at": n.started_at.isoformat() if n.started_at else None,
                    "completed_at": n.completed_at.isoformat() if n.completed_at else None
                } for n in d.nodes
            ],
            "files": [{"id": f.id, "name": f.original_name, "url": f"/api/synapse/files/{f.id}"} for f in attached_files]
        })
    result.sort(key=lambda x: x["priority_weight"])
    return {"status": "SUCCESS", "total": len(result), "directives": result}


@router.post("/directives")
def create_directive(data: Dict[str, Any], db: Session = Depends(get_db)):
    if not data.get("title"):
        raise HTTPException(status_code=422, detail="Directive title is required.")
    try:
        new_dir = StrategicDirective(
            title=data["title"].strip(),
            description=data.get("description", "").strip() if data.get("description") else "",
            priority=(data.get("priority") or "NORMAL").upper(),
            status="BACKLOG",
            target_dept=data.get("target_dept") or None,
            issued_by=data.get("issued_by") or "CDO",
            tagged_operatives=data.get("tagged_operatives", []),
            parent_directive_id=data.get("parent_directive_id")
        )
        db.add(new_dir)
        db.flush()
        
        # Safe addition of tasks with AGI metadata
        for task in data.get("nodes", []):
            if isinstance(task, dict) and task.get("task"):
                db.add(DirectiveNode(
                    directive_id=new_dir.id, 
                    task_name=str(task["task"]).strip(),
                    assigned_to_id=task.get("assigned_to_id"),
                    target_dept=task.get("target_dept"), # Phase 26
                    requires_verification=bool(task.get("requires_verification", False)),
                    verification_status="PENDING" if bool(task.get("requires_verification")) else "NONE"
                ))
            elif isinstance(task, str) and task.strip():
                db.add(DirectiveNode(directive_id=new_dir.id, task_name=task.strip()))
                
        db.add(AuditLog(action=f"DIRECTIVE_CREATED: {new_dir.title}", operator="CDO", target=f"DIR_{new_dir.id}"))
        db.commit()
        return {"status": "SUCCESS", "directive_id": new_dir.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/directives/{directive_id}/upload")
async def upload_directive_file(
    directive_id: int,
    file: UploadFile = File(...),
    uploaded_by: str = Form("CDO"),
    node_id: int = Form(None), # Optional node link for AGI verification
    db: Session = Depends(get_db)
):
    """Upload an attachment directly to a Directive, with optional AGI Vision Verification."""
    import google.generativeai as genai
    import os

    d = db.query(StrategicDirective).filter(StrategicDirective.id == directive_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Directive not found.")

    file_id = f"VF-{uuid.uuid4().hex[:10].upper()}"
    dest_dir = VAULT_BASE / "directive_attachments" / str(directive_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{file_id}_{file.filename}"

    try:
        with open(dest, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File write failed: {e}")

    size = dest.stat().st_size
    
    # ── PHASE 2: AGI Zero-Trust Visual Verification (httpx REST -- no SDK) ──
    verification_feedback = None
    if node_id:
        node = db.query(DirectiveNode).filter(DirectiveNode.id == node_id).first()
        if node and node.requires_verification:
            try:
                import mimetypes
                import base64
                import httpx as _httpx
                mime_type, _ = mimetypes.guess_type(dest)
                if mime_type and mime_type.startswith("image/"):
                    with open(dest, "rb") as f:
                        img_b64 = base64.b64encode(f.read()).decode("utf-8")

                    api_key = (
                        os.environ.get("GEMINI_API_KEY") or
                        os.environ.get("GEMINI_API_KEY_1") or ""
                    ).strip()

                    vision_prompt = (
                        f"You are a strict QA auditor. Task: '{node.task_name}'. "
                        "Does this image prove the task is completed? "
                        "Reply with ONLY a JSON object: "
                        "{\"verified\": true/false, \"reason\": \"Brief explanation\"}"
                    )

                    vision_payload = {
                        "contents": [{
                            "role": "user",
                            "parts": [
                                {"text": vision_prompt},
                                {"inline_data": {"mime_type": mime_type, "data": img_b64}},
                            ]
                        }],
                        "generationConfig": {
                            "temperature": 0.1,
                            "maxOutputTokens": 256,
                            "responseMimeType": "application/json",
                        }
                    }

                    vision_models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
                    vision_result = None
                    async with _httpx.AsyncClient(timeout=25.0) as _client:
                        for _model in vision_models:
                            _url = (
                                f"https://generativelanguage.googleapis.com/v1beta/models"
                                f"/{_model}:generateContent?key={api_key}"
                            )
                            try:
                                _res = await _client.post(
                                    _url,
                                    headers={"Content-Type": "application/json"},
                                    json=vision_payload
                                )
                                _data = _res.json()
                                if "candidates" in _data and _data["candidates"]:
                                    vision_result = _data["candidates"][0]["content"]["parts"][0]["text"].strip()
                                    break
                            except Exception:
                                continue

                    if vision_result:
                        raw_text = vision_result
                        if raw_text.startswith("```"):
                            raw_text = "\n".join(raw_text.split("\n")[1:-1])
                        result = json.loads(raw_text)
                        if result.get("verified"):
                            node.verification_status = "VERIFIED"
                            node.is_completed = True
                            verification_feedback = "✅ Verified by AGI."
                        else:
                            node.verification_status = "REJECTED"
                            node.is_completed = False
                            verification_feedback = f"❌ Rejected: {result.get('reason')}"
                        db.commit()
                    else:
                        verification_feedback = "⚠️ AGI Engine unavailable. Manual review required."
            except Exception as e:
                logger.error(f"AGI Vision Exception: {e}")
                verification_feedback = "⚠️ AGI Engine unavailable. Manual review required."

    vf = VaultFile(
        id=file_id,
        directive_id=directive_id,
        original_name=file.filename,
        file_type=file.content_type,
        file_size_bytes=size,
        vps_path=str(dest),
        category="DIRECTIVE_ATTACHMENT",
        uploaded_by=uploaded_by,
    )
    db.add(vf)
    db.add(AuditLog(
        action=f"DIRECTIVE_UPLOAD: '{file.filename}' -> DIR_{directive_id}",
        operator=uploaded_by, target=f"DIR_{directive_id}"
    ))
    db.commit()
    
    return {
        "status": "SUCCESS", 
        "file_id": file_id, 
        "download_url": f"/api/synapse/files/{file_id}",
        "agi_feedback": verification_feedback
    }


@router.patch("/directives/{directive_id}")
def update_directive(directive_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    d = db.query(StrategicDirective).filter(StrategicDirective.id == directive_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Directive not found.")
    try:
        if "status" in data:
            new_status = data["status"].upper()
            # 🔒 SOVEREIGN REVIEW GATE: Only the issuer can push REVIEW → COMPLETED
            if new_status == "COMPLETED":
                requester_id = data.get("reviewed_by") or data.get("issued_by") or ""
                if requester_id != d.issued_by:
                    # Check if they are a manager-level superior
                    requester = db.query(Employee).filter(Employee.id == requester_id).first()
                    is_superior = requester and requester.executive_tier in ["DIRECTOR", "C-SUITE", "BOARD"]
                    if not is_superior and requester_id != d.issued_by:
                        raise HTTPException(
                            status_code=403,
                            detail="Only the directive creator can mark it COMPLETED."
                        )
                d.updated_at = datetime.now(timezone.utc)
            d.status = new_status
        if "priority" in data:
            d.priority = data["priority"].upper()
        if "description" in data:
            d.description = data["description"]
        if "tagged_operatives" in data:
            d.tagged_operatives = data["tagged_operatives"]
        if "nodes" in data:
            # Rebuild nodes (for managers editing the directive)
            db.query(DirectiveNode).filter(DirectiveNode.directive_id == d.id).delete()
            for task in data["nodes"]:
                if isinstance(task, dict) and task.get("task"):
                    db.add(DirectiveNode(
                        directive_id=d.id, 
                        task_name=task["task"].strip(), 
                        is_completed=task.get("done", False),
                        assigned_to_id=task.get("assignee_id") or task.get("assigned_to_id"),
                        target_dept=task.get("target_dept"), # Phase 26
                        requires_verification=bool(task.get("requires_verification", False)),
                        verification_status=task.get("verification_status", "NONE")
                    ))
                elif isinstance(task, str) and task.strip():
                    db.add(DirectiveNode(directive_id=d.id, task_name=task.strip(), is_completed=False))

        db.commit()
        return {"status": "SUCCESS"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/directives/{directive_id}")
def delete_directive(directive_id: int, issued_by: str = "", db: Session = Depends(get_db)):
    """
    Permanently delete a directive.
    Only the issuer (creator) or a MANAGER/DIRECTOR/C-SUITE can delete.
    Operatives are blocked.
    """
    d = db.query(StrategicDirective).filter(StrategicDirective.id == directive_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Directive not found.")

    # Access check: requester must be the issuer OR a manager+
    requester = db.query(Employee).filter(Employee.id == issued_by).first()
    is_manager = requester and requester.executive_tier in ["MANAGER", "DIRECTOR", "C-SUITE", "BOARD"]
    is_issuer  = (d.issued_by == issued_by)

    if not is_issuer and not is_manager:
        raise HTTPException(status_code=403, detail="Only the directive creator or a Manager can delete this directive.")

    try:
        db.add(AuditLog(
            action=f"DIRECTIVE_DELETED: '{d.title}' (DIR_{d.id})",
            operator=issued_by or "CDO",
            target=f"DIR_{d.id}"
        ))
        db.delete(d)
        db.commit()
        return {"status": "SUCCESS", "message": f"Directive DIR_{directive_id} permanently deleted."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/directives/{directive_id}/nodes/{node_id}")
def toggle_directive_node(directive_id: int, node_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    """Operatives hit this to check off tasks. System auto-transitions directive status."""
    d = db.query(StrategicDirective).filter(StrategicDirective.id == directive_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Directive not found.")
    
    node = db.query(DirectiveNode).filter(DirectiveNode.id == node_id, DirectiveNode.directive_id == directive_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Task node not found.")

    try:
        from sqlalchemy.sql import func as sqlfunc
        now = datetime.now(timezone.utc)

        if "is_completed" in data:
            is_done = bool(data["is_completed"])
            node.is_completed = is_done
            if is_done:
                node.completed_at = now
                if not node.started_at:
                    node.started_at = now
                # Stamp picked_at on directive if this is the first pickup
                if not d.picked_at:
                    d.picked_at = now
            else:
                node.completed_at = None

        if "started" in data and bool(data["started"]):
            node.started_at = now
            if not d.picked_at:
                d.picked_at = now

        db.commit()
        db.refresh(d)

        # Recalculate completion percentage
        total_nodes = len(d.nodes)
        completed_nodes = sum(1 for n in d.nodes if n.is_completed)
        completion_pct = (completed_nodes / total_nodes * 100) if total_nodes > 0 else 0

        # Autonomous State Transitions
        old_status = d.status
        if completion_pct > 0 and completion_pct < 100 and d.status == "BACKLOG":
            d.status = "IN_PROGRESS"
        elif completion_pct == 100 and d.status in ["BACKLOG", "IN_PROGRESS"]:
            d.status = "REVIEW"
            d.reviewed_at = now

            # PHASE 3: AGI Pre-Cog Escalation — notify the issuer
            if d.issued_by:
                thread = SynapseThread(
                    thread_type="AGI_ESCALATION",
                    subject=f"🔍 REVIEW REQUIRED: DIR_{d.id}",
                    initiator_id="SYSTEM_AGI",
                    initiator_tier=4,
                    target_id=d.issued_by,
                    target_tier=4
                )
                db.add(thread)
                db.flush()
                db.add(SynapseMessage(
                    thread_id=thread.id,
                    sender_id="SYSTEM_AGI",
                    sender_name="Miracle AGI Arbiter",
                    sender_tier=4,
                    content=f"Sir, Directive '{d.title}' (DIR_{d.id}) has reached 100% completion and is awaiting your Executive Review. Please open the directive and mark it COMPLETED.",
                    msg_type="SYSTEM"
                ))

            # Trigger efficiency sync for the assigned operative
            if node.assigned_to_id:
                try:
                    from app.routers.synapse_efficiency import recalculate_operative
                    recalculate_operative(node.assigned_to_id, db)
                except Exception:
                    pass

        elif completion_pct < 100 and d.status == "REVIEW":
            d.status = "IN_PROGRESS"

        if old_status != d.status:
            db.commit()

        return {
            "status": "SUCCESS",
            "completion_pct": round(completion_pct, 1),
            "directive_status": d.status
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/directives/{directive_id}/spawn-ticket")
def spawn_zone16_ticket(directive_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    d = db.query(StrategicDirective).filter(StrategicDirective.id == directive_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Directive not found.")
    try:
        with db.begin_nested():
            ticket = SolveMission(
                room_no=data.get("room_no", "GENERAL"),
                dept=data.get("dept", d.target_dept or "MN"),
                subject=f"[Z-20 DIRECTIVE #{directive_id}] {d.title}",
                priority=d.priority, status="PENDING", assigned_to="Unassigned"
            )
            db.add(ticket)
        db.commit()
        return {"status": "SUCCESS", "ticket_id": ticket.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# F. WEBRTC COMM-LINK (preserved from V1)
# ============================================================
class SynapseSignalingManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def join_room(self, room_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(room_id, []).append(ws)

    def leave_room(self, room_id: str, ws: WebSocket):
        if room_id in self.rooms:
            self.rooms[room_id] = [w for w in self.rooms[room_id] if w != ws]
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def relay_signal(self, room_id: str, sender: WebSocket, message: dict):
        for peer in self.rooms.get(room_id, []):
            if peer != sender:
                try:
                    await peer.send_json(message)
                except Exception:
                    pass

synapse_signal_manager = SynapseSignalingManager()


@router.post("/webrtc/create-room")
def create_webrtc_room(data: Dict[str, Any], db: Session = Depends(get_db)):
    room_id = f"SYNAPSE-{uuid.uuid4().hex[:8].upper()}"
    session = WebRTCSession(room_id=room_id, room_name=data.get("room_name", room_id), created_by=data.get("created_by", "CDO"), is_active=True)
    db.add(session)
    db.commit()
    return {"status": "SUCCESS", "room_id": room_id, "ws_url": f"/ws/synapse/signal/{room_id}"}


@router.get("/webrtc/rooms")
def list_active_rooms(db: Session = Depends(get_db)):
    rooms = db.query(WebRTCSession).filter(WebRTCSession.is_active == True).all()
    return {"status": "SUCCESS", "rooms": [{"room_id": r.room_id, "room_name": r.room_name, "created_by": r.created_by, "peer_count": len(synapse_signal_manager.rooms.get(r.room_id, []))} for r in rooms]}


@router.post("/webrtc/rooms/{room_id}/end")
def end_webrtc_room(room_id: str, db: Session = Depends(get_db)):
    session = db.query(WebRTCSession).filter(WebRTCSession.room_id == room_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Room not found.")
    session.is_active = False
    session.ended_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "SUCCESS"}


@router.websocket("/signal/{room_id}")
async def webrtc_signaling(room_id: str, websocket: WebSocket):
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        session = db.query(WebRTCSession).filter(WebRTCSession.room_id == room_id, WebRTCSession.is_active == True).first()
        if not session:
            await websocket.close(code=4004)
            return
    finally:
        db.close()
        
    await synapse_signal_manager.join_room(room_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                await synapse_signal_manager.relay_signal(room_id, websocket, json.loads(raw))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        synapse_signal_manager.leave_room(room_id, websocket)

@router.get("/staff/{employee_id}/status")
def get_staff_status(employee_id: str, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Operative not found.")
    return {
        "employee_id": emp.id, "name": emp.full_name,
        "status": emp.status, "on_duty": emp.status == "ON-DUTY",
        "is_online": getattr(emp, 'is_online', False),
        "last_seen": emp.last_seen.isoformat() if getattr(emp, 'last_seen', None) else None,
        "dept": emp.dept
    }


# ============================================================
# G. PRESENCE MATRIX (Dual-Status: on_duty vs is_online)
# A staff member can be OFF-DUTY but ONLINE (watching cinema, radio)
# The frontend pings this WS every 25s to keep is_online=True.
# On disconnect, is_online is set False and last_seen is stamped.
# ============================================================
class PresenceManager:
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}

    async def connect(self, emp_id: str, ws: WebSocket):
        await ws.accept()
        self.connections[emp_id] = ws

    def disconnect(self, emp_id: str):
        self.connections.pop(emp_id, None)

    def is_connected(self, emp_id: str) -> bool:
        return emp_id in self.connections

presence_manager = PresenceManager()


@router.websocket("/presence/{employee_id}")
async def presence_heartbeat(employee_id: str, websocket: WebSocket):
    """
    Presence WebSocket. Frontend connects on app load and sends {type: 'ping'} every 25s.
    Server responds {type: 'pong'} and keeps Employee.is_online=True.
    On disconnect, is_online=False and last_seen is stamped.
    """
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            await websocket.close(code=4004)
            return
        setattr(emp, 'is_online', True)
        db.commit()
    except Exception:
        db.rollback()
        await websocket.close(code=4004)
        return
    finally:
        db.close()

    await presence_manager.connect(employee_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
                if payload.get("type") == "ping":
                    await websocket.send_json({"type": "pong", "ts": datetime.now(timezone.utc).isoformat()})
            except Exception:
                pass
    except WebSocketDisconnect:
        presence_manager.disconnect(employee_id)
        db = SessionLocal()
        try:
            emp = db.query(Employee).filter(Employee.id == employee_id).first()
            if emp:
                setattr(emp, 'is_online', False)
                setattr(emp, 'last_seen', datetime.now(timezone.utc))
                db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


# ============================================================
# H. SOVEREIGN STAFF VAULT
# One vault per employee — permanent, created on first access.
# Holds payslips, joining records, working hours, documents.
# ============================================================
VAULT_BASE = Path("/srv/synapse_vault")


def get_or_create_vault(emp_id: str, db: Session) -> StaffVault:
    vault = db.query(StaffVault).filter(StaffVault.employee_id == emp_id).first()
    if not vault:
        vault = StaffVault(employee_id=emp_id)
        db.add(vault)
        db.commit()
        db.refresh(vault)
    return vault


@router.get("/vault/{employee_id}")
def get_vault(employee_id: str, db: Session = Depends(get_db)):
    """Returns the full vault contents for an employee. Auto-creates vault if first access."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Operative not found.")
    vault = get_or_create_vault(employee_id, db)
    files = []
    for f in vault.files:
        files.append({
            "id": f.id,
            "original_name": f.original_name,
            "file_type": f.file_type,
            "file_size_bytes": f.file_size_bytes,
            "category": f.category,
            "description": f.description,
            "uploaded_by": f.uploaded_by,
            "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None,
            "download_url": f"/api/synapse/files/{f.id}",
        })
    # Group by category
    grouped = {}
    for f in files:
        grouped.setdefault(f["category"], []).append(f)
    return {
        "status": "SUCCESS",
        "vault_id": vault.id,
        "employee_id": employee_id,
        "employee_name": f"{emp.full_name} {emp.last_name or ''}".strip(),
        "total_files": len(files),
        "files": files,
        "grouped": grouped,
    }


@router.post("/vault/{employee_id}/upload")
async def upload_to_vault(
    employee_id: str,
    file: UploadFile = File(...),
    category: str = Form("DOCUMENT"),
    description: str = Form(""),
    uploaded_by: str = Form("CDO"),
    db: Session = Depends(get_db)
):
    """Upload a file to an employee's personal vault (payslip, joining record, etc.)."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Operative not found.")
    vault = get_or_create_vault(employee_id, db)

    file_id = f"VF-{uuid.uuid4().hex[:10].upper()}"
    emp_dir = VAULT_BASE / employee_id
    emp_dir.mkdir(parents=True, exist_ok=True)
    dest = emp_dir / f"{file_id}_{file.filename}"

    try:
        with open(dest, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File write failed: {e}")

    size = dest.stat().st_size
    vf = VaultFile(
        id=file_id,
        vault_id=vault.id,
        original_name=file.filename,
        file_type=file.content_type,
        file_size_bytes=size,
        vps_path=str(dest),
        category=category.upper(),
        description=description,
        uploaded_by=uploaded_by,
    )
    db.add(vf)
    db.add(AuditLog(
        action=f"VAULT_UPLOAD: {category} '{file.filename}' -> {employee_id}",
        operator=uploaded_by, target=employee_id
    ))
    db.commit()
    return {"status": "SUCCESS", "file_id": file_id, "download_url": f"/api/synapse/files/{file_id}"}


# ============================================================
# I. FILE EXCHANGE (Chat Attachments + Download)
# Files shared in a thread are stored on VPS disk and served here.
# ============================================================
@router.post("/files/upload")
async def upload_thread_file(
    file: UploadFile = File(...),
    thread_id: str = Form(...),
    sender_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """Upload a file attachment to a chat thread. Stored on VPS disk."""
    thread = db.query(SynapseThread).filter(SynapseThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found.")

    file_id = f"VF-{uuid.uuid4().hex[:10].upper()}"
    dest_dir = VAULT_BASE / "thread_attachments" / thread_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{file_id}_{file.filename}"

    try:
        with open(dest, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File write failed: {e}")

    size = dest.stat().st_size
    vf = VaultFile(
        id=file_id,
        thread_id=thread_id,
        original_name=file.filename,
        file_type=file.content_type,
        file_size_bytes=size,
        vps_path=str(dest),
        category="CHAT_ATTACHMENT",
        uploaded_by=sender_id,
    )
    db.add(vf)

    # Also save as a message in the thread
    sender = db.query(Employee).filter(Employee.id == sender_id).first()
    sender_name = f"{sender.full_name} {sender.last_name or ''}".strip() if sender else sender_id
    msg = SynapseMessage(
        thread_id=thread_id,
        sender_id=sender_id,
        sender_name=sender_name,
        sender_tier=get_tier(sender.executive_tier) if sender else 1,
        content=file.filename,
        msg_type="FILE",
        attachment_url=f"/api/synapse/files/{file_id}"
    )
    db.add(msg)
    thread.last_message_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(vf)

    await chat_manager.broadcast(thread_id, {
        "id": msg.id,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "sender_tier": msg.sender_tier,
        "content": file.filename,
        "msg_type": "FILE",
        "attachment_url": f"/api/synapse/files/{file_id}",
        "file_size_bytes": size,
        "sent_at": msg.sent_at.isoformat()
    })

    return {"status": "SUCCESS", "file_id": file_id, "download_url": f"/api/synapse/files/{file_id}"}


@router.get("/files/{file_id}")
def download_file(file_id: str, db: Session = Depends(get_db)):
    """Stream a file from VPS disk. Works for both vault files and thread attachments."""
    from fastapi.responses import FileResponse
    vf = db.query(VaultFile).filter(VaultFile.id == file_id).first()
    if not vf:
        raise HTTPException(status_code=404, detail="File not found in vault.")
    if not os.path.exists(vf.vps_path):
        raise HTTPException(status_code=410, detail="File no longer exists on disk.")
    return FileResponse(
        path=vf.vps_path,
        filename=vf.original_name,
        media_type=vf.file_type or "application/octet-stream"
    )

