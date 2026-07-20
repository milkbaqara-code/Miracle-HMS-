# backend_api/app/core/watchdog_engine.py
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.models import GuestFolio, AssetGrid, JournalEntry, LedgerLine, Inventory, ActiveOccupancy, SystemConfig

DHAKA_TZ = timezone(timedelta(hours=6))
logger = logging.getLogger("Sovereign_Watchdog")

async def verify_transaction_integrity(db_factory, transaction_id: str, event_type: str, payload: dict):
    """
    Sovereign Watchdog: Asynchronous verification of cross-module state integrity.
    Note: db_factory is used to get a fresh session for background operations.
    """
    db = db_factory()
    try:
        logger.info(f"WATCHDOG ACTIVATED: Verifying {event_type} [ID: {transaction_id}]")
        
        if event_type == 'CHECKOUT_EVENT':
            await _verify_checkout(db, transaction_id, payload)
        elif event_type == 'INVENTORY_DISPATCH':
            await _verify_inventory(db, transaction_id, payload)
        else:
            logger.warning(f"Watchdog: Unmapped event type {event_type}")
            
    except Exception as e:
        logger.error(f"Watchdog Kernel Panic: {str(e)}")
    finally:
        db.close()

async def _verify_checkout(db: Session, room_id: str, payload: dict):
    """
    Rule: Checkout must have Folio=CHECKED_OUT, Room=DIRTY, and no ActiveOccupancy.
    """
    folio = db.query(GuestFolio).filter(GuestFolio.room_number == room_id, GuestFolio.status == 'CHECKED_OUT').order_by(GuestFolio.last_updated.desc()).first()
    asset = db.query(AssetGrid).filter(AssetGrid.room_id == room_id).first()
    occupancy = db.query(ActiveOccupancy).filter(ActiveOccupancy.room_number == room_id).first()
    
    fractures = []
    if not folio:
        fractures.append("FOLIO_NOT_CLOSED")
    if asset and asset.current_status != 'DIRTY':
        fractures.append("ROOM_STATUS_FRACTURE")
    if occupancy:
        fractures.append("GUEST_RADAR_LEAK")
        
    if fractures:
        await _trigger_auto_recovery(db, 'CHECKOUT_EVENT', room_id, fractures)
    else:
        logger.info(f"Watchdog: Checkout for Room {room_id} confirmed as state-clean.")

async def _verify_inventory(db: Session, product_id: str, payload: dict):
    """
    Rule: Stock must be decremented AND a corresponding JournalEntry with COGS must exist.
    """
    journal_id = payload.get('journal_id')
    if not journal_id:
        return

    journal = db.query(JournalEntry).filter(JournalEntry.id == journal_id).first()
    if not journal:
        await _trigger_auto_recovery(db, 'INVENTORY_DISPATCH', product_id, ["JOURNAL_MISSING"])
        return

    cogs_entry = db.query(LedgerLine).join(JournalEntry).filter(
        JournalEntry.id == journal_id,
        LedgerLine.debit > 0
    ).first()
    
    if not cogs_entry:
        await _trigger_auto_recovery(db, 'INVENTORY_DISPATCH', product_id, ["LEDGER_SYNC_MISSING"])
    else:
        journal.verification_status = 'VERIFIED'
        db.commit()
        logger.info(f"Watchdog: Inventory dispatch for {product_id} verified.")

async def _trigger_auto_recovery(db: Session, event_type: str, target_id: str, fractures: list):
    """
    The Auto-Recovery Protocol: Quarantines state and alerts the CDO.
    """
    logger.error(f"FRACTURE DETECTED: {event_type} on {target_id}. Issues: {fractures}")
    
    if event_type == 'CHECKOUT_EVENT':
        folio = db.query(GuestFolio).filter(GuestFolio.room_number == target_id, GuestFolio.status == 'CHECKED_OUT').order_by(GuestFolio.last_updated.desc()).first()
        if folio:
            folio.status = 'QUARANTINED'
            db.commit()

    try:
        from app.main import master_socket
        alert_payload = {
            "type": "CRITICAL_SYSTEM_ALERT",
            "message": f"FRACTURE DETECTED: {event_type} failed for {target_id}. Auto-Recovery Protocol Initiated.",
            "details": fractures,
            "module": event_type.split('_')[0],
            "timestamp": datetime.now(DHAKA_TZ).isoformat()
        }
        await master_socket.broadcast("CRITICAL_SYSTEM_ALERT", alert_payload)
    except Exception as ws_err:
        logger.error(f"Watchdog: Could not broadcast alert: {ws_err}")


# ============================================================
# PROACTIVE WATCHDOG ENGINE -- SOVEREIGN AUTONOMOUS SCANNER
# Runs every 60 seconds. Scans for PRE-CHECKOUT balance risk,
# critical inventory, and escalated missions BEFORE they
# become crises. Broadcasts WATCHDOG_ALERT via WebSocket.
# ============================================================

_last_watchdog_payload: dict = {"count": 0, "alerts": [], "scanned_at": None}


async def run_proactive_watchdog():
    """
    Background task started in main.py lifespan.
    Scans the live database for operational anomalies and
    broadcasts them to all connected dashboard clients.
    """
    await asyncio.sleep(30)
    logger.info("SOVEREIGN WATCHDOG: Proactive scanner is online.")

    while True:
        try:
            await _scan_and_broadcast()
        except Exception as e:
            logger.error(f"WATCHDOG SCAN FAILED: {e}")
        await asyncio.sleep(60)


async def _scan_and_broadcast():
    global _last_watchdog_payload

    from app.core.database import SessionLocal
    db = SessionLocal()
    alerts = []

    try:
        now_dhaka = datetime.now(DHAKA_TZ)

        # SCAN 1: PRE-CHECKOUT BALANCE ALERT
        # Guests IN_HOUSE, balance > 0, checkout within 120 mins
        try:
            if db.bind.dialect.name == 'sqlite':
                # SQLite fallback: fetch relevant folios/reservations and calculate time differences in Python
                rows_raw = db.execute(text("""
                    SELECT
                        gf.room_number,
                        gf.guest_name,
                        gf.balance,
                        r.start_date,
                        r.nights
                    FROM guest_folios gf
                    JOIN reservations r
                        ON r.room_id = gf.room_number
                        AND r.status = 'CONFIRMED'
                    WHERE gf.status = 'IN_HOUSE'
                      AND gf.balance > 0
                """)).fetchall()
                rows = []
                for room, name, balance, start_date, nights in rows_raw:
                    try:
                        if isinstance(start_date, str):
                            sd = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                        else:
                            sd = start_date
                        end_date = sd + timedelta(days=nights)
                        now_utc = datetime.now(timezone.utc)
                        if sd.tzinfo is not None:
                            diff = end_date - now_utc
                        else:
                            diff = end_date - datetime.utcnow()
                        mins = diff.total_seconds() / 60.0
                        if 0 <= mins <= 120:
                            rows.append((room, name, balance, start_date, nights, mins))
                    except Exception:
                        pass
            else:
                rows = db.execute(text("""
                    SELECT
                        gf.room_number,
                        gf.guest_name,
                        gf.balance,
                        r.start_date,
                        r.nights,
                        TIMESTAMPDIFF(
                            MINUTE,
                            NOW(),
                            DATE_ADD(r.start_date, INTERVAL r.nights DAY)
                        ) AS mins_to_checkout
                    FROM guest_folios gf
                    JOIN reservations r
                        ON r.room_id = gf.room_number
                        AND r.status = 'CONFIRMED'
                    WHERE gf.status = 'IN_HOUSE'
                      AND gf.balance > 0
                      AND TIMESTAMPDIFF(
                            MINUTE,
                            NOW(),
                            DATE_ADD(r.start_date, INTERVAL r.nights DAY)
                          ) BETWEEN 0 AND 120
                    ORDER BY mins_to_checkout ASC
                """)).fetchall()

            config = db.query(SystemConfig).first()
            fl = config.financial_laws if config and config.financial_laws else {}
            base_cur = fl.get("base_currency", "USD")

            for row in rows:
                mins = int(row[5]) if row[5] is not None else 0
                alerts.append({
                    "type": "PRE_CHECKOUT_BALANCE",
                    "room": str(row[0]),
                    "guest": str(row[1]),
                    "balance": float(row[2]),
                    "checkout_in_mins": mins,
                    "label": f"Room {row[0]}: {row[1]} has outstanding balance of {base_cur} {row[2]:,.0f}. Checkout in {mins} mins."
                })
        except Exception as e:
            logger.error(f"WATCHDOG SCAN 1 ERROR: {e}")

        # SCAN 2: CRITICAL INVENTORY (below reorder point)
        # Guard: reorder_point column may not exist in older MySQL schema — skip if missing
        try:
            if db.bind.dialect.name == 'sqlite':
                pragma_cols = db.execute(text("PRAGMA table_info(inventory)")).fetchall()
                col_check = any(col[1] == 'reorder_point' for col in pragma_cols)
            else:
                col_check = db.execute(text("""
                    SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'inventory'
                      AND COLUMN_NAME = 'reorder_point'
                """)).scalar()
            if col_check:
                rows = db.execute(text("""
                    SELECT name, stock, reorder_point,
                           (reorder_point - stock) as deficit
                    FROM inventory
                    WHERE stock <= reorder_point
                      AND status = 'ACTIVE'
                    ORDER BY deficit DESC
                    LIMIT 10
                """)).fetchall()
                for row in rows:
                    alerts.append({
                        "type": "LOW_STOCK",
                        "item": str(row[0]),
                        "stock": int(row[1]),
                        "reorder": int(row[2]),
                        "deficit": int(row[3]),
                        "label": f"LOW STOCK: {row[0]} has only {row[1]} units remaining (reorder at {row[2]})."
                    })
        except Exception as e:
            logger.error(f"WATCHDOG SCAN 2 ERROR: {e}")

        # SCAN 3: ESCALATED OR URGENT MISSIONS (SLA BREACHED)
        # Guard: 'title' and 'is_escalated' columns may not exist — use COALESCE fallback
        try:
            if db.bind.dialect.name == 'sqlite':
                pragma_cols = db.execute(text("PRAGMA table_info(solve_missions)")).fetchall()
                cols = {col[1] for col in pragma_cols}
            else:
                cols = {r[0] for r in db.execute(text("""
                    SELECT COLUMN_NAME FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'solve_missions'
                """)).fetchall()}
            title_col = 'title' if 'title' in cols else ('subject' if 'subject' in cols else 'CAST(id AS CHAR)')
            escalated_filter = "is_escalated = 1 OR" if 'is_escalated' in cols else ""
            rows = db.execute(text(f"""
                SELECT id, {title_col}, priority, assigned_to
                FROM solve_missions
                WHERE status NOT IN ('RESOLVED', 'CLOSED')
                  AND ({escalated_filter} priority = 'URGENT')
                ORDER BY id ASC
                LIMIT 10
            """)).fetchall()
            for row in rows:
                alerts.append({
                    "type": "ESCALATED_TICKET",
                    "id": int(row[0]),
                    "title": str(row[1]),
                    "priority": str(row[2]),
                    "assigned_to": str(row[3]) if row[3] else "UNASSIGNED",
                    "label": f"TICKET #{row[0]}: {row[1]} | {row[2]} | {row[3] or 'UNASSIGNED'}"
                })
        except Exception as e:
            logger.error(f"WATCHDOG SCAN 3 ERROR: {e}")

        payload = {
            "count": len(alerts),
            "alerts": alerts,
            "scanned_at": now_dhaka.isoformat()
        }
        _last_watchdog_payload = payload

        from app.main import master_socket
        await master_socket.broadcast("WATCHDOG_ALERT", payload)

        if alerts:
            logger.info(f"WATCHDOG ALERT: {len(alerts)} anomalies broadcast.")
        else:
            logger.info("WATCHDOG CLEAR: All systems nominal.")

    except Exception as e:
        logger.error(f"WATCHDOG BROADCAST ERROR: {e}")
    finally:
        db.close()


def get_last_watchdog_payload() -> dict:
    """Sync helper for the REST fallback GET endpoint."""
    return _last_watchdog_payload
