# backend_api/app/workers/biometric_supervisor.py
# ============================================================
# MIRACLE OS — PHASE 2A: BIOMETRIC OVER-HOUR SIGN-OUT GUARD
# Scans biometric_attendance every 10 minutes.
# If any active shift exceeds 12 continuous hours:
#   1. Auto signs out the employee (sets sign_out_time=now)
#   2. Logs violation to employee_compliance_logs
#   3. Broadcasts WebSocket alert to HR Director channel
# ============================================================
import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("MiracleOS_BiometricSupervisor")

MAX_SHIFT_HOURS = 12          # Auto sign-out threshold
SCAN_INTERVAL_SECS = 600      # Every 10 minutes


async def run_biometric_scan():
    """Run a single scan of all active shifts and enforce 12-hour rule."""
    from app.core.database import SessionLocal
    from app.models.models import BiometricAttendance, EmployeeComplianceLog
    from app.core.ws_manager import master_socket

    db = SessionLocal()
    violations = []

    try:
        now = datetime.now(timezone.utc)

        # Fetch all active shifts
        active_shifts = db.query(BiometricAttendance).filter(
            BiometricAttendance.is_active_shift == True,
            BiometricAttendance.sign_out_time == None
        ).all()

        for shift in active_shifts:
            # Compute continuous hours since sign-in
            sign_in = shift.sign_in_time
            if sign_in.tzinfo is None:
                sign_in = sign_in.replace(tzinfo=timezone.utc)

            continuous_hours = (now - sign_in).total_seconds() / 3600.0

            # Update continuous_hours on every scan (for monitoring)
            shift.continuous_hours = round(continuous_hours, 2)

            if continuous_hours >= MAX_SHIFT_HOURS:
                # ── AUTO SIGN-OUT ──────────────────────────────────────
                shift.sign_out_time = now
                shift.auto_signout = True
                shift.auto_signout_at = now
                shift.is_active_shift = False

                # ── LOG COMPLIANCE VIOLATION ───────────────────────────
                log = EmployeeComplianceLog(
                    employee_id=shift.employee_id,
                    violation_type="OVERTIME_12H",
                    description=(
                        f"Auto sign-out triggered after {continuous_hours:.1f} continuous hours. "
                        f"Shift started: {sign_in.strftime('%Y-%m-%d %H:%M UTC')}. "
                        f"Auto sign-out: {now.strftime('%Y-%m-%d %H:%M UTC')}."
                    ),
                    shift_hours=round(continuous_hours, 2),
                    attendance_id=shift.id,
                    severity="CRITICAL" if continuous_hours >= 14 else "WARNING",
                    notified_hr=True,
                    notified_at=now,
                    logged_by="BIOMETRIC_SUPERVISOR",
                )
                db.add(log)
                violations.append({
                    "employee_id": shift.employee_id,
                    "hours": round(continuous_hours, 2),
                    "location": shift.location or "Unknown",
                    "sign_in": sign_in.isoformat(),
                    "auto_signout_at": now.isoformat(),
                })

        db.commit()

        # ── BROADCAST WS ALERT IF VIOLATIONS FOUND ────────────────────
        if violations:
            await master_socket.broadcast("BIOMETRIC_OVERTIME_ALERT", {
                "zone": "Z-HR",
                "violations": violations,
                "count": len(violations),
                "message": (
                    f"⚠️ BIOMETRIC SUPERVISOR: {len(violations)} employee(s) auto signed out "
                    f"after exceeding {MAX_SHIFT_HOURS}h shift limit."
                ),
                "scanned_at": now.isoformat(),
            })
            logger.warning(
                f"⚠️ BIOMETRIC SUPERVISOR: {len(violations)} violation(s) detected and logged."
            )
        else:
            logger.debug(
                f"✅ BIOMETRIC SUPERVISOR: Scan clean — {len(active_shifts)} active shifts, "
                f"no overtime violations."
            )

        return {"violations": len(violations), "active_shifts": len(active_shifts)}

    except Exception as e:
        logger.error(f"❌ BIOMETRIC SUPERVISOR ERROR: {e}")
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


async def run_biometric_supervisor():
    """
    Async daemon loop — scans every 10 minutes continuously.
    Registered in main.py lifespan as asyncio.create_task(run_biometric_supervisor()).
    """
    logger.info("🛡️ BIOMETRIC SUPERVISOR: Daemon started — 10-minute scan cycle active.")
    await asyncio.sleep(20)  # Brief startup delay

    while True:
        try:
            result = await run_biometric_scan()
            v = result.get("violations", 0)
            a = result.get("active_shifts", 0)
            logger.info(
                f"🛡️ BIOMETRIC SUPERVISOR: Scan complete — "
                f"{a} active shifts, {v} violation(s). Next scan in {SCAN_INTERVAL_SECS}s."
            )
        except Exception as e:
            logger.error(f"🛡️ BIOMETRIC SUPERVISOR DAEMON ERROR: {e}")

        await asyncio.sleep(SCAN_INTERVAL_SECS)
