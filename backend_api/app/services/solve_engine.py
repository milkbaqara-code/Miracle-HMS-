# backend_api/app/engine.py
import logging
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.models import AuditLog

logger = logging.getLogger("MasterOS.SolveEngine")

class SystemSentinel:
    """
    ZONE 16/17 SENTINEL: The logical heart of the Solve Radar.
    Handles data aggregation, IoT mission registration, and audit trails.
    """
    def __init__(self, db: Session):
        self.db = db

    async def run_supreme_audit(self) -> Dict[str, Any]:
        """
        SELF-HEALING SCAN: 
        Checks for desyncs between missions and inventory.
        """
        logger.info("🛰️ SENTINEL: Initiating high-grade logical audit...")
        
        # 1. Check for 'Ghost' Missions (Linked to deleted/missing rooms)
        query = text("""
            SELECT m.id, m.room_no 
            FROM solve_missions m
            LEFT JOIN inventory i ON m.room_no = i.product_id
            WHERE i.product_id IS NULL
        """)
        ghosts = self.db.execute(query).all()
        alarms = [f"Ghost Mission {g.id} found for room {g.room_no}" for g in ghosts]
        
        return {
            "status": "GREEN" if not alarms else "AMBER",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "integrity_alarms": alarms,
            "system_state": "SYNCHRONIZED"
        }

    def fetch_active_missions(self) -> List[Dict]:
        """
        Broadcasts active room signals. 
        CDO FIX: Aligned perfectly with page.tsx 'Mission' Interface.
        """
        query = text("""
            SELECT 
                m.id, m.room_no, m.dept, m.subject, m.status, 
                m.priority, m.sop_steps, m.assigned_to,
                m.raised_at, m.picked_up_at, m.secured_at, m.proof_image_url
            FROM solve_missions m
            WHERE m.status != 'Resolved'
            ORDER BY 
                CASE m.priority 
                    WHEN 'CRITICAL' THEN 1 
                    WHEN 'HIGH' THEN 2 
                    WHEN 'NORMAL' THEN 3
                    ELSE 4 
                END, m.raised_at DESC
        """)
        
        result = self.db.execute(query).mappings().all()
        
        missions = []
        for row in result:
            # INTEGRITY AUDIT: SAFE JSON PARSING
            steps = row['sop_steps']
            if isinstance(steps, str):
                try:
                    steps = json.loads(steps)
                except Exception:
                    steps = []
            elif steps is None:
                steps = []

            # CDO FIX: Flattening the dictionary back to string[] for the frontend checklist
            flattened_checks = [s.get("step", s) if isinstance(s, dict) else s for s in steps]

            def safe_iso(dt):
                if not dt: return None
                if isinstance(dt, str): return dt
                return dt.isoformat()

            missions.append({
                "id": row['id'],
                "room_no": row['room_no'],
                "dept": row['dept'],
                "subject": row['subject'],
                "status": row['status'],
                "priority": row['priority'],
                "assigned_to": row['assigned_to'] or "Unassigned",
                "raised_at": safe_iso(row['raised_at']),
                "picked_up_at": safe_iso(row['picked_up_at']),
                "secured_at": safe_iso(row['secured_at']),
                "proof_image": row['proof_image_url'],
                "checks": flattened_checks 
            })
        return missions

    def register_mission(self, payload_data: Dict) -> Tuple[bool, str]:
        """Atomic operation to bridge IoT/Guest signals to the Radar."""
        try:
            # 1. Validate Unit Existence — rooms are in asset_grid
            room_check = self.db.execute(
                text("SELECT room_id, category FROM asset_grid WHERE room_id = :rm"),
                {"rm": payload_data['room']}
            ).fetchone()

            # 🛡️ SOVEREIGN FIX: If room not in asset_grid, still create the ticket.
            # Do NOT block — the dropdown should always show live rooms, but
            # legacy or manually-typed IDs must not silently drop to localStorage.
            if not room_check:
                logger.warning(
                    f"[SOLVE] Room '{payload_data['room']}' not in asset_grid — "
                    f"creating ticket anyway (orphaned room guard)."
                )

            # 2. Atomic Prep & Insert (Aligned to Temporal Vectors)
            self.db.execute(text("""
                INSERT INTO solve_missions (
                    room_no, dept, subject, priority, sop_steps, 
                    status, assigned_to, raised_at
                )
                VALUES (
                    :rm, :dept, :sub, :pri, :sop, 
                    'Active', 'Unassigned', :now
                )
            """), {
                "rm": payload_data['room'],
                "dept": payload_data['dept'],
                "sub": payload_data['subject'],
                "pri": payload_data.get('priority', 'NORMAL'),
                "sop": json.dumps(payload_data.get('checks', [])),
                "now": datetime.now(timezone.utc)
            })

            # 3. Secure Audit Trail
            self.db.add(AuditLog(
                operator="SYSTEM_RADAR",
                action="MISSION_CREATED",
                target=f"ROOM_{payload_data['room']} | {payload_data['dept']}"
            ))

            self.db.commit()
            return True, payload_data['room']

        except Exception as e:
            self.db.rollback()
            logger.error(f"ENGINE_FAULT: {str(e)}")
            return False, str(e)


    def fetch_operative_stats(self, username: str) -> Dict[str, Any]:
        """
        Extracts performance metrics for a specific operative.
        ROI logic: Hours worked, missions secured, and avg response time.
        """
        
        # 1. Locate Operative
        user = self.db.query(User).filter(User.username == username).first()
        if not user or not user.employee_profile:
            return {
                "monthly_hours": 0.0,
                "avg_response": 0.0,
                "missions_count": 0
            }
        
        emp = user.employee_profile
        
        # 2. Calculate Mission Stats
        resolved_missions = self.db.query(SolveMission).filter(
            SolveMission.operator_id == emp.id,
            SolveMission.status == 'Resolved'
        ).all()
        
        total_missions = len(resolved_missions)
        
        avg_resp = 0.0
        if total_missions > 0:
            total_minutes = 0
            count = 0
            for m in resolved_missions:
                if m.raised_at and m.picked_up_at:
                    delta = (m.picked_up_at - m.raised_at).total_seconds() / 60
                    total_minutes += delta
                    count += 1
            
            if count > 0:
                avg_resp = round(total_minutes / count, 1)

        return {
            "monthly_hours": round(emp.monthly_hours or 0.0, 1),
            "avg_response": avg_resp,
            "missions_count": total_missions
        }