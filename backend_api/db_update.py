import sqlite3

conn = sqlite3.connect(r'd:\Vigilant IT Solutions\Miracle_Os_Master\miracle_os_master.db')
c = conn.cursor()

# 1. Add guest_profile_id to fnb_orders if not exists
try:
    c.execute('ALTER TABLE fnb_orders ADD COLUMN guest_profile_id VARCHAR(64);')
    print('Added guest_profile_id to fnb_orders')
except sqlite3.OperationalError as e:
    print(f'Add column error: {e}')

# 2. Delete the two items from inventory
c.execute("DELETE FROM inventory WHERE name IN ('Signature Wagyu Burger', 'Sovereign Cappuccino');")
deleted = c.rowcount
print(f'Deleted {deleted} items from inventory')

conn.commit()
conn.close()
