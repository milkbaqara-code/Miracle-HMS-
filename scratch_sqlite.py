import sqlite3

try:
    print('Connecting to local SQLite DB...')
    db = sqlite3.connect('backend_api/app/miracle_os_master.db')
    cursor = db.cursor()
    
    print('Fixing Onions...')
    cursor.execute("UPDATE inventory SET type='RAW', dept='Z-12-VAULT' WHERE name LIKE '%ONION%'")
    
    print('Fixing Cappuccino...')
    cursor.execute("UPDATE inventory SET dept='Z-29-COFFEE & BAR', cat='COMPILED_SERVICE' WHERE name LIKE '%Cappuccino%'")
    
    print('Fixing Wagyu Burger...')
    cursor.execute("DELETE FROM inventory WHERE name LIKE '%Wagyu Burger%' AND product_id NOT IN (SELECT product_id FROM inventory WHERE name LIKE '%Wagyu Burger%' LIMIT 1)")
    cursor.execute("UPDATE inventory SET dept='Z-29-RESTAURANT', cat='COMPILED_SERVICE' WHERE name LIKE '%Wagyu Burger%'")
    
    db.commit()
    db.close()
    print('DB Cleanup Success!')
except Exception as e:
    print('DB Error:', e)
