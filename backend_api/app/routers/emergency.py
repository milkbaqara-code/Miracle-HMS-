from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone
import json
import asyncio

from app.core.database import get_db
from app.models.models import EmergencyAlert, WristbandDevice, GuestCRM, ActiveOccupancy

router = APIRouter(prefix="/emergency", tags=["Emergency Response System"])

# ── WebSocket Connection Manager for Emergency Grid ─────────────────────────
class EmergencyBroadcaster:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, event: dict):
        dead = []
        for conn in self.connections:
            try:
                await conn.send_json(event)
            except Exception:
                dead.append(conn)
        for d in dead:
            self.connections.remove(d)

emergency_broadcaster = EmergencyBroadcaster()

# ── ALERT THRESHOLDS ─────────────────────────────────────────────────────────
DEFAULT_THRESHOLDS = {
    "hr_min": 50, "hr_max": 130,
    "spo2_min": 92,
    "temp_min": 35.0, "temp_max": 39.5,
}

def classify_alert(hr, spo2, temp, bp) -> Optional[str]:
    """Evaluate vitals against thresholds and return alert type or None."""
    if hr is not None:
        if hr < DEFAULT_THRESHOLDS["hr_min"]:
            return "CARDIAC_BRADYCARDIA"
        if hr > DEFAULT_THRESHOLDS["hr_max"]:
            return "TACHYCARDIA"
    if spo2 is not None and spo2 < DEFAULT_THRESHOLDS["spo2_min"]:
        return "HYPOXIA"
    if temp is not None:
        if temp > DEFAULT_THRESHOLDS["temp_max"]:
            return "HYPERTHERMIA"
        if temp < DEFAULT_THRESHOLDS["temp_min"]:
            return "HYPOTHERMIA"
    if bp is not None:
        try:
            systolic = int(bp.split("/")[0])
            if systolic < 80:
                return "HYPOTENSION"
            if systolic > 180:
                return "HYPERTENSION_CRISIS"
        except Exception:
            pass
    return None


def sla_color(seconds: Optional[int], limit: int) -> str:
    if seconds is None:
        return "PENDING"
    return "COMPLIANT" if seconds <= limit else "BREACH"


# ── SCHEMAS ───────────────────────────────────────────────────────────────────
class VitalsStream(BaseModel):
    device_id: str
    heart_rate: Optional[int] = None
    blood_pressure: Optional[str] = None
    spo2: Optional[int] = None
    temperature: Optional[float] = None

class AlertAcknowledge(BaseModel):
    doctor_id: str
    notes: Optional[str] = None

class AlertResolve(BaseModel):
    notes: Optional[str] = None


# ── ENDPOINTS ─────────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def emergency_ws(websocket: WebSocket):
    """Emergency Command Grid WebSocket — real-time alert broadcasts."""
    await emergency_broadcaster.connect(websocket)
    try:
        while True:
            # Keep alive — client can send pings
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        emergency_broadcaster.disconnect(websocket)


@router.post("/vitals/stream")
async def stream_wristband_vitals(data: VitalsStream, db: Session = Depends(get_db)):
    """Wristband IoT device streams vitals. Auto-triggers alert if threshold breached."""
    # Find device
    device = db.query(WristbandDevice).filter(WristbandDevice.device_id == data.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Wristband device not registered.")

    # Update last ping
    device.last_ping = datetime.now(timezone.utc)
    db.commit()

    # Classify alert
    alert_type = classify_alert(data.heart_rate, data.spo2, data.temperature, data.blood_pressure)

    if alert_type:
        # Check: is there already an ACTIVE alert for this device?
        existing = db.query(EmergencyAlert).filter(
            EmergencyAlert.device_id == data.device_id,
            EmergencyAlert.status == "ACTIVE"
        ).first()

        if not existing:
            # Create alert
            alert = EmergencyAlert(
                patient_id=device.patient_id or "UNKNOWN",
                patient_name=device.patient_name or "Unknown Patient",
                bed_number=device.bed_number or "UNKNOWN",
                alert_type=alert_type,
                heart_rate=data.heart_rate,
                blood_pressure=data.blood_pressure,
                spo2=data.spo2,
                temperature=data.temperature,
                device_id=data.device_id,
                severity="CRITICAL",
                status="ACTIVE"
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)

            # Broadcast to Emergency Command Grid
            await emergency_broadcaster.broadcast({
                "event": "EMERGENCY_TRIGGERED",
                "alert_id": alert.id,
                "patient_name": alert.patient_name,
                "bed_number": alert.bed_number,
                "alert_type": alert_type,
                "heart_rate": data.heart_rate,
                "spo2": data.spo2,
                "temperature": data.temperature,
                "blood_pressure": data.blood_pressure,
                "triggered_at": alert.triggered_at.isoformat(),
                "severity": "CRITICAL",
            })

            return {
                "status": "ALERT_TRIGGERED",
                "alert_id": alert.id,
                "alert_type": alert_type,
                "message": f"CRITICAL alert triggered for {device.patient_name} in {device.bed_number}"
            }

    return {"status": "NORMAL", "message": "Vitals within safe parameters."}


@router.post("/trigger")
async def manual_trigger(device_id: str, alert_type: str, db: Session = Depends(get_db)):
    """Manually trigger an emergency alert (nurse button or test)."""
    device = db.query(WristbandDevice).filter(WristbandDevice.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found.")

    alert = EmergencyAlert(
        patient_id=device.patient_id or "UNKNOWN",
        patient_name=device.patient_name or "Unknown Patient",
        bed_number=device.bed_number or "UNKNOWN",
        alert_type=alert_type,
        device_id=device_id,
        severity="CRITICAL",
        status="ACTIVE"
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    await emergency_broadcaster.broadcast({
        "event": "EMERGENCY_TRIGGERED",
        "alert_id": alert.id,
        "patient_name": alert.patient_name,
        "bed_number": alert.bed_number,
        "alert_type": alert_type,
        "triggered_at": alert.triggered_at.isoformat(),
        "severity": "CRITICAL",
    })

    return {"status": "ALERT_TRIGGERED", "alert_id": alert.id}


@router.get("/active")
def get_active_alerts(db: Session = Depends(get_db)):
    """Get all active and recent alerts for the Emergency Command Grid."""
    alerts = db.query(EmergencyAlert).filter(
        EmergencyAlert.status.in_(["ACTIVE", "DOCTOR_NOTIFIED", "AMBULANCE_DISPATCHED", "ARRIVED"])
    ).order_by(EmergencyAlert.triggered_at.desc()).all()

    result = []
    for a in alerts:
        now = datetime.now(timezone.utc)
        elapsed = int((now - a.triggered_at.replace(tzinfo=timezone.utc)).total_seconds()) if a.triggered_at else 0
        result.append({
            "id": a.id,
            "patient_name": a.patient_name,
            "bed_number": a.bed_number,
            "alert_type": a.alert_type,
            "severity": a.severity,
            "status": a.status,
            "heart_rate": a.heart_rate,
            "blood_pressure": a.blood_pressure,
            "spo2": a.spo2,
            "temperature": a.temperature,
            "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
            "doctor_notified_at": a.doctor_notified_at.isoformat() if a.doctor_notified_at else None,
            "ambulance_dispatched_at": a.ambulance_dispatched_at.isoformat() if a.ambulance_dispatched_at else None,
            "service_arrived_at": a.service_arrived_at.isoformat() if a.service_arrived_at else None,
            "elapsed_seconds": elapsed,
            "doctor_response_seconds": a.doctor_response_seconds,
            "ambulance_response_seconds": a.ambulance_response_seconds,
            "total_response_seconds": a.total_response_seconds,
            "doctor_sla": sla_color(a.doctor_response_seconds, 60),
            "ambulance_sla": sla_color(a.ambulance_response_seconds, 180),
            "arrival_sla": sla_color(a.total_response_seconds, 600),
            "doctor_id": a.doctor_id,
            "doctor_notes": a.doctor_notes,
        })
    return {"status": "SUCCESS", "data": result}


@router.get("/history")
def get_alert_history(db: Session = Depends(get_db)):
    """Full alert history including resolved alerts."""
    alerts = db.query(EmergencyAlert).order_by(EmergencyAlert.triggered_at.desc()).limit(100).all()
    result = []
    for a in alerts:
        result.append({
            "id": a.id,
            "patient_name": a.patient_name,
            "bed_number": a.bed_number,
            "alert_type": a.alert_type,
            "severity": a.severity,
            "status": a.status,
            "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
            "doctor_response_seconds": a.doctor_response_seconds,
            "ambulance_response_seconds": a.ambulance_response_seconds,
            "total_response_seconds": a.total_response_seconds,
            "doctor_sla": sla_color(a.doctor_response_seconds, 60),
            "ambulance_sla": sla_color(a.ambulance_response_seconds, 180),
            "arrival_sla": sla_color(a.total_response_seconds, 600),
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        })
    return {"status": "SUCCESS", "data": result}


@router.post("/{alert_id}/doctor-acknowledge")
async def doctor_acknowledge(alert_id: int, body: AlertAcknowledge, db: Session = Depends(get_db)):
    """Doctor acknowledges and accepts the emergency."""
    alert = db.query(EmergencyAlert).filter(EmergencyAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    now = datetime.now(timezone.utc)
    alert.doctor_notified_at = now
    alert.doctor_id = body.doctor_id
    alert.doctor_notes = body.notes
    alert.status = "DOCTOR_NOTIFIED"
    alert.doctor_response_seconds = int((now - alert.triggered_at.replace(tzinfo=timezone.utc)).total_seconds())
    db.commit()

    await emergency_broadcaster.broadcast({
        "event": "DOCTOR_ACKNOWLEDGED",
        "alert_id": alert_id,
        "doctor_id": body.doctor_id,
        "bed_number": alert.bed_number,
        "response_seconds": alert.doctor_response_seconds,
        "sla": sla_color(alert.doctor_response_seconds, 60)
    })
    return {"status": "SUCCESS", "message": "Doctor acknowledgment recorded.", "response_seconds": alert.doctor_response_seconds}


@router.post("/{alert_id}/dispatch-ambulance")
async def dispatch_ambulance(alert_id: int, db: Session = Depends(get_db)):
    """Dispatch ambulance / emergency response team."""
    alert = db.query(EmergencyAlert).filter(EmergencyAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    now = datetime.now(timezone.utc)
    alert.ambulance_dispatched_at = now
    alert.status = "AMBULANCE_DISPATCHED"
    alert.ambulance_response_seconds = int((now - alert.triggered_at.replace(tzinfo=timezone.utc)).total_seconds())
    db.commit()

    await emergency_broadcaster.broadcast({
        "event": "AMBULANCE_DISPATCHED",
        "alert_id": alert_id,
        "bed_number": alert.bed_number,
        "patient_name": alert.patient_name,
        "dispatch_seconds": alert.ambulance_response_seconds,
        "sla": sla_color(alert.ambulance_response_seconds, 180)
    })
    return {"status": "SUCCESS", "message": "Ambulance dispatched.", "dispatch_seconds": alert.ambulance_response_seconds}


@router.post("/{alert_id}/service-arrived")
async def service_arrived(alert_id: int, db: Session = Depends(get_db)):
    """Mark medical team arrived at patient location."""
    alert = db.query(EmergencyAlert).filter(EmergencyAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    now = datetime.now(timezone.utc)
    alert.service_arrived_at = now
    alert.status = "ARRIVED"
    alert.total_response_seconds = int((now - alert.triggered_at.replace(tzinfo=timezone.utc)).total_seconds())
    db.commit()

    await emergency_broadcaster.broadcast({
        "event": "TEAM_ARRIVED",
        "alert_id": alert_id,
        "bed_number": alert.bed_number,
        "total_seconds": alert.total_response_seconds,
        "sla": sla_color(alert.total_response_seconds, 600)
    })
    return {"status": "SUCCESS", "message": "Medical team arrival recorded.", "total_seconds": alert.total_response_seconds}


@router.post("/{alert_id}/resolve")
async def resolve_alert(alert_id: int, body: AlertResolve, db: Session = Depends(get_db)):
    """Mark emergency as resolved."""
    alert = db.query(EmergencyAlert).filter(EmergencyAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    alert.resolved_at = datetime.now(timezone.utc)
    alert.status = "RESOLVED"
    if body.notes:
        alert.doctor_notes = (alert.doctor_notes or '') + ' | RESOLVED: ' + body.notes
    db.commit()

    await emergency_broadcaster.broadcast({
        "event": "ALERT_RESOLVED",
        "alert_id": alert_id,
        "bed_number": alert.bed_number,
    })
    return {"status": "SUCCESS", "message": "Emergency alert resolved."}


@router.post("/devices/register")
def register_device(device_id: str, patient_name: str, bed_number: str,
                    patient_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Register a wristband device to a patient bed."""
    existing = db.query(WristbandDevice).filter(WristbandDevice.device_id == device_id).first()
    if existing:
        existing.patient_name = patient_name
        existing.bed_number = bed_number
        existing.patient_id = patient_id
        existing.is_active = True
        db.commit()
        return {"status": "UPDATED", "device_id": device_id}
    device = WristbandDevice(
        device_id=device_id,
        patient_name=patient_name,
        bed_number=bed_number,
        patient_id=patient_id,
        is_active=True
    )
    db.add(device)
    db.commit()
    return {"status": "REGISTERED", "device_id": device_id}


@router.get("/devices")
def list_devices(db: Session = Depends(get_db)):
    """List all registered wristband devices."""
    devices = db.query(WristbandDevice).filter(WristbandDevice.is_active == True).all()
    return {"status": "SUCCESS", "data": [
        {
            "device_id": d.device_id,
            "patient_name": d.patient_name,
            "bed_number": d.bed_number,
            "battery_level": d.battery_level,
            "last_ping": d.last_ping.isoformat() if d.last_ping else None,
        } for d in devices
    ]}
