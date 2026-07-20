import paramiko
from pathlib import Path

VPS_IP   = "miracle.vigilantitsolution.com"
VPS_PORT = 22
VPS_USER = "root"
VPS_PASS = "NdRbWqkTuUMf"
VPS_KEY  = str(Path.home() / ".ssh" / "miracle_os_key")

remote_script = """import sqlite3
import os
import glob

tenant_dbs = glob.glob('/home/miracle-tenants/*/miracle_os.db')
print("Found databases:", tenant_dbs)

for db_path in tenant_dbs:
    print("Updating:", db_path)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    try:
        c.execute('ALTER TABLE fnb_orders ADD COLUMN guest_profile_id VARCHAR(64);')
        print('Added guest_profile_id to fnb_orders on VPS')
    except Exception as e:
        print('Add column error:', e)

    c.execute("DELETE FROM inventory WHERE name IN ('Signature Wagyu Burger', 'Sovereign Cappuccino');")
    print(f'Deleted {c.rowcount} items from inventory on VPS')

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
