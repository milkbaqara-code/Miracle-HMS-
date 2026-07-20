import sqlite3
import datetime

db_path = "d:/Vigilant IT Solutions/Miracle_HMS/miracle_os_master.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')

c.execute("""
INSERT INTO solve_missions (room_no, dept, subject, status, raised_at) 
VALUES ('CABIN-01', 'DOC', 'Patient requires immediate consultation', 'PENDING', ?)
""", (now,))

c.execute("""
INSERT INTO solve_missions (room_no, dept, subject, status, raised_at) 
VALUES ('CABIN-02', 'NRS', 'Administer prescribed IV drip', 'PENDING', ?)
""", (now,))

c.execute("""
INSERT INTO solve_missions (room_no, dept, subject, status, raised_at) 
VALUES ('ICU-01', 'DOC', 'Critical patient assessment', 'PENDING', ?)
""", (now,))
c.execute("""
INSERT INTO solve_missions (room_no, dept, subject, status, raised_at) 
VALUES ('ICU-01', 'IT', 'Ventilator monitor alarm triggered', 'PENDING', ?)
""", (now,))

conn.commit()
conn.close()

print("Test clinical tickets seeded successfully!")

conn.commit()
conn.close()

print("Test clinical tickets seeded successfully!")
