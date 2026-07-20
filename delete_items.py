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

c.execute("SELECT product_id, name FROM inventory WHERE name LIKE '%Wagyu%' OR name LIKE '%Cappuccino%';")
items = c.fetchall()
print("Found items:", items)

for item in items:
    print(f"Deleting {item[1]}")
    c.execute("DELETE FROM inventory WHERE product_id = ?", (item[0],))
print(f"Deleted {c.rowcount} items")

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
