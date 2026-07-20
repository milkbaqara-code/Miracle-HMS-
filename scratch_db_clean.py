import sys
from pathlib import Path
sys.path.append(str(Path('backend_api').resolve()))
from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print('Starting DB Cleanup...')
    
    # 1. Fix Onions
    db.execute(text("UPDATE inventory SET type='RAW', dept='Z-12-VAULT' WHERE name LIKE '%ONION%'"))
    
    # 2. Fix Cappuccino
    db.execute(text("UPDATE inventory SET dept='Z-29-COFFEE & BAR', cat='COMPILED_SERVICE' WHERE name LIKE '%Cappuccino%'"))
    
    # 3. Fix Wagyu Burger
    burgers = db.execute(text("SELECT product_id FROM inventory WHERE name LIKE '%Wagyu Burger%'")).fetchall()
    if len(burgers) > 1:
        keep_id = burgers[0][0]
        for b in burgers[1:]:
            delete_id = b[0]
            db.execute(text(f"DELETE FROM inventory WHERE product_id = '{delete_id}'"))
            print(f'Deleted duplicate Wagyu Burger: {delete_id}')
        db.execute(text(f"UPDATE inventory SET dept='Z-29-RESTAURANT', cat='COMPILED_SERVICE' WHERE product_id = '{keep_id}'"))
    elif len(burgers) == 1:
        db.execute(text("UPDATE inventory SET dept='Z-29-RESTAURANT', cat='COMPILED_SERVICE' WHERE name LIKE '%Wagyu Burger%'"))
        
    db.commit()
    print('DB Cleanup Success!')
except Exception as e:
    db.rollback()
    print('DB Error:', e)
finally:
    db.close()
