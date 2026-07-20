from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import InventoryLot, Inventory

def deplete_stock_lots(
    db: Session,
    product_id: str,
    qty: float,
    method: str = "FIFO"
) -> float:
    """
    Sovereign Costing Lot Deductions Engine.
    Depletes stock from active purchase lots using FIFO or LIFO.
    Returns the calculated Cost of Goods Sold (COGS).
    """
    if qty <= 0:
        return 0.0

    # 1. Fetch active lots for the product
    query = db.query(InventoryLot).filter(
        InventoryLot.product_id == product_id,
        InventoryLot.remaining_qty > 0
    )
    
    if method.upper() == "LIFO":
        lots = query.order_by(InventoryLot.created_at.desc()).all()
    else: # Default: FIFO
        lots = query.order_by(InventoryLot.created_at.asc()).all()
        
    cogs_accumulated = 0.0
    qty_remaining = qty
    
    for lot in lots:
        if qty_remaining <= 0:
            break
            
        take = min(qty_remaining, lot.remaining_qty)
        lot.remaining_qty = round(lot.remaining_qty - take, 4)
        cogs_accumulated += round(take * lot.unit_cost, 2)
        qty_remaining = round(qty_remaining - take, 4)
        
    # Fallback: If requested qty exceeds registered lots, use the main inventory PP (purchase price)
    if qty_remaining > 0:
        product = db.query(Inventory).filter(Inventory.product_id == product_id).first()
        unit_cost = product.pp if product else 0.0
        cogs_accumulated += round(qty_remaining * unit_cost, 2)
        
    return cogs_accumulated
