import sqlite3

def main():
    db_path = '/root/miracle-os-master/backend_api/miracle_db.sqlite'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("UPDATE asset_grid SET status='IN_HOUSE' WHERE room_id IN (SELECT room_id FROM guest_folios WHERE status='IN_HOUSE')")
    conn.commit()
    conn.close()
    print("Database updated successfully.")

if __name__ == '__main__':
    main()
