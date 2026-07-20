import sys
import os

sys.path.append('/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api')
from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # 1. Add pos_transaction_id
    try:
        conn.execute(text("ALTER TABLE fnb_orders ADD COLUMN pos_transaction_id VARCHAR(64);"))
        print("Added pos_transaction_id")
    except Exception as e:
        print("Error adding pos_transaction_id:", e)
        
    # 2. Add guest_profile_id
    try:
        conn.execute(text("ALTER TABLE fnb_orders ADD COLUMN guest_profile_id VARCHAR(64);"))
        print("Added guest_profile_id")
    except Exception as e:
        print("Error adding guest_profile_id:", e)
        
    # 3. Delete from inventory
    try:
        res = conn.execute(text("DELETE FROM inventory WHERE name IN ('Signature Wagyu Burger', 'Sovereign Cappuccino');"))
        print(f"Deleted {res.rowcount} items from inventory")
    except Exception as e:
        print("Error deleting inventory:", e)
    
    conn.commit()
