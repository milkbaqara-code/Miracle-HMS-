import paramiko
from pathlib import Path

VPS_IP   = "miracle.vigilantitsolution.com"
VPS_PORT = 22
VPS_USER = "root"
VPS_PASS = "NdRbWqkTuUMf"
VPS_KEY  = str(Path.home() / ".ssh" / "miracle_os_key")

remote_script = """import sqlite3
import os

db_path = '/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/miracle_os_master.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

create_table_sql = '''
CREATE TABLE IF NOT EXISTS fnb_orders (
    id VARCHAR(36) PRIMARY KEY,
    table_label VARCHAR(32) NOT NULL,
    guest_name VARCHAR(128),
    status VARCHAR(32) DEFAULT 'PENDING',
    items_json TEXT NOT NULL,
    special_note TEXT,
    subtotal FLOAT DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    bump_count INTEGER DEFAULT 0,
    device_id VARCHAR(64),
    pos_transaction_id VARCHAR(64),
    guest_profile_id VARCHAR(64)
);
'''
c.execute(create_table_sql)
print("Created fnb_orders table manually via SQLite")

create_preorder_sql = '''
CREATE TABLE IF NOT EXISTS fnb_pre_orders (
    id VARCHAR(36) PRIMARY KEY,
    reservation_id VARCHAR(64) NOT NULL,
    guest_name VARCHAR(128),
    table_label VARCHAR(32),
    status VARCHAR(32) DEFAULT 'PENDING',
    items_json TEXT NOT NULL,
    special_note TEXT,
    subtotal FLOAT DEFAULT 0.0,
    arrival_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
'''
c.execute(create_preorder_sql)
print("Created fnb_pre_orders table manually via SQLite")

# If table already existed, add the column just in case
try:
    c.execute('ALTER TABLE fnb_orders ADD COLUMN guest_profile_id VARCHAR(64);')
    print('Added guest_profile_id to fnb_orders')
except Exception as e:
    print('Add column error (expected if table was just created):', e)
    
c.execute("DELETE FROM inventory WHERE name IN ('Signature Wagyu Burger', 'Sovereign Cappuccino');")
print(f"Deleted {c.rowcount} items from inventory")
conn.commit()
conn.close()
"""

with open("temp_remote_script.py", "w") as f:
    f.write(remote_script)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_IP, port=VPS_PORT, username=VPS_USER, password=VPS_PASS, key_filename=VPS_KEY)

sftp = ssh.open_sftp()
sftp.put("temp_remote_script.py", "/tmp/temp_remote_script.py")
sftp.close()

stdin, stdout, stderr = ssh.exec_command("python3 /tmp/temp_remote_script.py")
print("STDOUT:", stdout.read().decode())
print("STDERR:", stderr.read().decode())

ssh.close()
