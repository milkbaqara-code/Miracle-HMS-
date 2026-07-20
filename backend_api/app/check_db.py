import sqlite3
import os

base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db_path = os.path.join(base_dir, "miracle_os_master.db")

print(f"Connecting to DB at: {db_path}")

try:
    db = sqlite3.connect(db_path)
    cursor = db.cursor()

    cursor.execute("SELECT id, room_number, status FROM guest_folios WHERE status='IN_HOUSE'")
    print("Guest folios (IN_HOUSE):")
    print(cursor.fetchall())

    cursor.execute("SELECT id, room_id, status FROM asset_grid")
    print("\nAsset grid:")
    print(cursor.fetchall())

except Exception as e:
    print(f"Error: {e}")
