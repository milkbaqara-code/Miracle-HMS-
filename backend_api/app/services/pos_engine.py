# backend_api/app/services/pos_engine.py
import logging
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

# 🛡️ SOVEREIGN REGISTRY ALIGNMENT
from app.schemas.pos_schema import POSCheckoutPayload
from app.models.models import POSTransaction, POSOrderItem, AccountingLedger, GuestFolio, Inventory

logger = logging.getLogger("Zone14_POSEngine")

class MasterPOSEngine:
    def __init__(self, db_session: Session):
        self.db = db_session

    async def process_atomic_checkout(self, payload: POSCheckoutPayload):
        """
        The Master Transaction Circuit. 
        Synchronizes Zone 12 (Stock), Zone 14 (POS), and Zone 18 (Finance).
        """
        invoice_id = payload.transaction_id
        logger.info(f"🛡️ KERNEL: INITIATING ATOMIC SETTLEMENT: {invoice_id}")

        try:
            # 🛡️ MICROSOFT GRADE: Using a Savepoint for ACID Atomic Integrity
            with self.db.begin_nested():
                
                # ==========================================
                # 1. THE IMMUTABLE RECEIPT (Zone 14)
                # ==========================================
                # We must physically record the transaction and its items
                new_transaction = POSTransaction(
                    id=invoice_id,
                    room_id=payload.guest_ref if payload.payment_method == "ROOM_CHARGE" else "WALK-IN",
                    grand_total=payload.financials.grand,
                    timestamp=payload.timestamp
                )
                self.db.add(new_transaction)
                self.db.flush() # Lock the ID in the transaction scope

                # ==========================================
                # 2. NEURAL STOCK DEDUCTOR & ITEM LOGGING (Zone 12)
                # ==========================================
                for item in payload.items:
                    
                    # A. Log the item to the receipt
                    order_item = POSOrderItem(
                        transaction_id=invoice_id,
                        product_id=item.id,
                        qty=item.qty,
                        rp=item.rp
                    )
                    self.db.add(order_item)

                    # B. Deduct Stock (Only if NOT a service)
                    item_type = getattr(item, 'type', 'PRODUCT')
                    
                    if item_type != 'SERVICE':
                        self.db.execute(text("""
                            UPDATE inventory 
                            SET stock = stock - :qty 
                            WHERE product_id = :pid
                        """), {"qty": item.qty, "pid": item.id})

                    # C. BOM RECURSION: Deduct ingredients if recipes exist
                    if item.bom and not item.isFOC:
                        for raw in item.bom:
                            total_deduction = raw.qty * item.qty
                            self.db.execute(text("""
                                UPDATE inventory 
                                SET stock = stock - :deduction 
                                WHERE product_id = :raw_id
                            """), {"deduction": total_deduction, "raw_id": raw.rawId})

                # ==========================================
                # 3. DOUBLE-ENTRY LEDGER ROUTING (Zone 18)
                # ==========================================
                self._route_financial_ledger(invoice_id, payload)

                # ==========================================
                # 4. ROOM CHARGE NEXUS (Zone 08 - Guest Folio)
                # ==========================================
                if payload.payment_method == "ROOM_CHARGE":
                    if not payload.guest_ref or payload.guest_ref in ["N/A", "UNKNOWN"]:
                        raise ValueError("ROOM_CHARGE rejected: Valid Room Number required.")
                    
                    self._post_to_guest_folio(invoice_id, str(payload.guest_ref), payload.financials.grand)

            # FINAL SEAL
            self.db.commit()
            logger.info(f"✅ TRANSACTION {invoice_id} SECURED. ALL ZONES SYNCHRONIZED.")
            return {"status": "SUCCESS", "invoice": invoice_id}

        except Exception as e:
            self.db.rollback() 
            logger.error(f"🚨 KERNEL REJECTION: Rolling back {invoice_id}. Reason: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Settlement Engine Rejection: {str(e)}"
            )

    # ---------------------------------------------------------
    # PRIVATE ENTERPRISE HELPERS
    # ---------------------------------------------------------

    def _route_financial_ledger(self, invoice_id: str, payload: POSCheckoutPayload):
        """Uplinks to the Master Ledger (Zone 18) with standardized accounting types."""
        fin = payload.financials
        
        # 🔱 SOVEREIGN KERNEL: POS Revenue Injection
        from app.routers.accounting_engine import post_double_entry
        post_double_entry(self.db, 'POS_REVENUE', f"POS {payload.payment_method} | {payload.guest_type} | {payload.terminal_id}", [
            {"code": 1000, "debit": float(fin.grand), "credit": 0.0}, # Cash/Bank up
            {"code": 4100, "debit": 0.0, "credit": float(fin.grand)}  # F&B Revenue up
        ])

    def _post_to_guest_folio(self, invoice_id: str, room_num: str, amount: float):
        """Direct injection into the active Guest Folio (Zone 08)."""
        from app.models.models import SystemConfig
        config = self.db.query(SystemConfig).first()
        fl = config.financial_laws if config and config.financial_laws else {}
        base_cur = fl.get("base_currency", "BDT")
        symbols = fl.get("currency_symbols", {"BDT": "৳", "USD": "$", "AED": "د.إ"})
        sym = symbols.get(base_cur, "৳")

        logger.info(f"PMS_SYNC: Posting {sym}{amount} to Room {room_num} folio.")

        
        result = self.db.execute(text("""
            UPDATE guest_folios 
            SET balance = balance + :amt,
                last_updated = CURRENT_TIMESTAMP
            WHERE room_number = :room AND status = 'IN_HOUSE'
        """), {"amt": amount, "room": room_num})

        # 🛡️ PYLANCE & RUNTIME SHIELD
        rows_affected = getattr(result, "rowcount", 0)

        if rows_affected == 0:
            logger.error(f"🚨 FOLIO_REJECTION: Room {room_num} not found or not IN_HOUSE.")
            raise ValueError(f"Folio Sync Failed: Room {room_num} is not currently IN_HOUSE.") 