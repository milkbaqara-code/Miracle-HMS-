import sqlite3
import os

base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db_path = os.path.join(base_dir, "miracle_os_master.db")

print(f"Connecting to DB at: {db_path}")

try:
    db = sqlite3.connect(db_path)
    cursor = db.cursor()

    room_map = {}
    idx = 101

    # 5 RS
    for i in range(1, 6): room_map[str(idx)] = f"RS-0{i}"; idx += 1
    # 5 PS
    for i in range(1, 6): room_map[str(idx)] = f"PS-0{i}"; idx += 1
    # 10 V
    for i in range(1, 11): room_map[str(idx)] = f"V-{i:02d}"; idx += 1
    # 10 LTR
    for i in range(1, 11): room_map[str(idx)] = f"LTR-{i:02d}"; idx += 1
    # 5 OB
    for i in range(1, 6): room_map[str(idx)] = f"OB-0{i}"; idx += 1

    for old_id, new_id in room_map.items():
        cursor.execute("UPDATE guest_folios SET room_number = ? WHERE room_number = ?", (new_id, old_id))
        cursor.execute("UPDATE reservations SET room_id = ? WHERE room_id = ?", (new_id, old_id))
        cursor.execute("UPDATE asset_grid SET room_id = ? WHERE room_id = ?", (new_id, old_id))
        cursor.execute("UPDATE active_occupancy SET room_number = ? WHERE room_number = ?", (new_id, old_id))
        
        # solve_missions might not exist or might have room_no column
        try:
            cursor.execute("UPDATE solve_missions SET room_no = ? WHERE room_no = ?", (new_id, old_id))
        except sqlite3.OperationalError:
            pass

    db.commit()
    print("Migration complete!")

except Exception as e:
    print(f"Error: {e}")
