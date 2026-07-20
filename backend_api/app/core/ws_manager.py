# backend_api/app/core/ws_manager.py
# Sovereign WebSocket Manager — Singleton, imported by all routers safely
import logging
from datetime import datetime, timezone
from typing import List
from fastapi import WebSocket

logger = logging.getLogger("WS_Manager")

class SovereignConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"📡 WEBSOCKET CONNECTED: Total Nodes: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"🔌 WEBSOCKET DISCONNECTED: Total Nodes: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, payload: dict):
        if event_type == "GRID_UPDATE":
            try:
                from app.core.database import SessionLocal
                from app.routers.frontdesk_engine import get_live_grid
                db = SessionLocal()
                try:
                    grid_res = await get_live_grid(db)
                    payload = {"grid_state": grid_res.get("data", []), "action": payload.get("action", "SYNC")}
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"WS Full Payload Failure: {e}")

        message = {"event": event_type, "data": payload, "timestamp": datetime.now(timezone.utc).isoformat()}
        dead = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for d in dead:
            self.active_connections.remove(d)


# 🛡️ GLOBAL SINGLETON — import this everywhere
master_socket = SovereignConnectionManager()
