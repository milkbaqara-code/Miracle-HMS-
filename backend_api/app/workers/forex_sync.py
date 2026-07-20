# backend_api/app/workers/forex_sync.py
# ============================================================
# MIRACLE OS — PHASE 1A: DAILY EXCHANGE RATE SYNC DAEMON
# Fetches USD, EUR, GBP, AED, SGD, BDT, SAR, INR, JPY, CNY
# from Frankfurter API (free, no key) and persists to DB.
# Runs immediately on boot, then every 24h at 00:00 UTC.
# POS, Billing, and SGPE read from system_forex_rates table.
# ============================================================
import asyncio
import logging
import httpx
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("MiracleOS_ForexSync")

FRANKFURTER_URL = "https://api.frankfurter.app/latest"
TARGET_CURRENCIES = ["EUR", "GBP", "AED", "SGD", "BDT", "SAR", "INR", "JPY", "CNY", "TRY"]
BASE_CURRENCY = "USD"


async def fetch_and_store_rates(db=None):
    """
    Fetch latest rates from Frankfurter API and upsert into SystemForexRate table.
    If db is None, creates its own session.
    """
    from app.core.database import SessionLocal
    from app.models.models import SystemForexRate

    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        symbols = ",".join(TARGET_CURRENCIES)
        url = f"{FRANKFURTER_URL}?from={BASE_CURRENCY}&to={symbols}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        rates = data.get("rates", {})
        now = datetime.now(timezone.utc)

        for target, rate_value in rates.items():
            # Get previous rate for delta calculation
            prev = db.query(SystemForexRate).filter(
                SystemForexRate.base_currency == BASE_CURRENCY,
                SystemForexRate.target_currency == target,
                SystemForexRate.is_current == True
            ).first()

            prev_rate = prev.rate if prev else None
            pct_change = None
            if prev_rate and prev_rate > 0:
                pct_change = round(((rate_value - prev_rate) / prev_rate) * 100, 4)

            # Mark old records as not current
            if prev:
                prev.is_current = False
                prev.previous_rate = prev_rate

            # Insert new current record
            new_rate = SystemForexRate(
                base_currency=BASE_CURRENCY,
                target_currency=target,
                rate=rate_value,
                previous_rate=prev_rate,
                pct_change=pct_change,
                source="Frankfurter API",
                fetched_at=now,
                is_current=True,
            )
            db.add(new_rate)

        # Also store USD→USD as 1.0 for completeness
        usd_self = db.query(SystemForexRate).filter(
            SystemForexRate.target_currency == "USD",
            SystemForexRate.is_current == True
        ).first()
        if usd_self:
            usd_self.is_current = False
        db.add(SystemForexRate(
            base_currency="USD", target_currency="USD",
            rate=1.0, previous_rate=1.0, pct_change=0.0,
            source="IDENTITY", fetched_at=now, is_current=True
        ))

        db.commit()
        logger.info(
            f"💱 FOREX SYNC: {len(rates)} rates updated from Frankfurter API — "
            f"{', '.join([f'{k}={v}' for k, v in list(rates.items())[:4]])}..."
        )
        return {"status": "OK", "rates_updated": len(rates) + 1, "fetched_at": now.isoformat()}

    except httpx.HTTPError as e:
        logger.error(f"💱 FOREX SYNC ERROR: HTTP fetch failed — {e}")
        return {"status": "ERROR", "error": str(e)}
    except Exception as e:
        logger.error(f"💱 FOREX SYNC ERROR: {e}")
        db.rollback()
        return {"status": "ERROR", "error": str(e)}
    finally:
        if close_db:
            db.close()


def get_rate(target_currency: str, base_currency: str = "USD", db=None) -> float:
    """
    Synchronous helper — look up a rate from the cache table.
    Returns 1.0 if not found (safe fallback).
    Called by POS, Billing, and SGPE for multicurrency conversions.
    """
    from app.core.database import SessionLocal
    from app.models.models import SystemForexRate

    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True
    try:
        rec = db.query(SystemForexRate).filter(
            SystemForexRate.base_currency == base_currency,
            SystemForexRate.target_currency == target_currency,
            SystemForexRate.is_current == True
        ).first()
        return rec.rate if rec else 1.0
    finally:
        if close_db:
            db.close()


def convert_amount(amount: float, from_currency: str, to_currency: str, db=None) -> float:
    """Convert amount between any two currencies via USD as pivot."""
    if from_currency == to_currency:
        return amount
    if from_currency == "USD":
        rate = get_rate(to_currency, db=db)
        return round(amount * rate, 4)
    elif to_currency == "USD":
        rate = get_rate(from_currency, db=db)
        return round(amount / rate, 4) if rate else amount
    else:
        # Convert via USD pivot
        to_usd = get_rate(from_currency, db=db)
        to_target = get_rate(to_currency, db=db)
        usd_amount = amount / to_usd if to_usd else amount
        return round(usd_amount * to_target, 4)


async def run_forex_sync_daemon():
    """
    Async daemon loop — runs immediately on boot, then every 24h.
    Registered in main.py lifespan as asyncio.create_task(run_forex_sync_daemon()).
    """
    logger.info("💱 FOREX DAEMON: Starting — immediate fetch on boot...")
    await asyncio.sleep(3)  # Brief delay for DB to be ready

    while True:
        try:
            result = await fetch_and_store_rates()
            logger.info(f"💱 FOREX DAEMON: {result.get('status')} — next sync in 24h")
        except Exception as e:
            logger.error(f"💱 FOREX DAEMON ERROR: {e}")

        # Sleep until next 00:00 UTC
        now = datetime.now(timezone.utc)
        tomorrow_midnight = (now + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        sleep_secs = (tomorrow_midnight - now).total_seconds()
        logger.info(f"💱 FOREX DAEMON: Sleeping {sleep_secs/3600:.1f}h until next UTC midnight sync")
        await asyncio.sleep(sleep_secs)
