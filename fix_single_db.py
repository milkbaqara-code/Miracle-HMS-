import paramiko
from pathlib import Path

VPS_IP   = "miracle.vigilantitsolution.com"
VPS_PORT = 22
VPS_USER = "root"
VPS_PASS = "NdRbWqkTuUMf"
VPS_KEY  = str(Path.home() / ".ssh" / "miracle_os_key")

remote_script = """import sqlite3
db_path = '/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/miracle_os_master.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = c.fetchall()
print("Tables in master DB:", tables)

c.execute("SELECT * FROM inventory WHERE name LIKE '%Signature Wagyu Burger%';")
print("Burgers found:", c.fetchall())

try:
    c.execute("ALTER TABLE fnb_orders ADD COLUMN guest_profile_id VARCHAR(64);")
    print("Added guest_profile_id to fnb_orders")
except Exception as e:
    print("Error altering:", e)

c.execute("DELETE FROM inventory WHERE name IN ('Signature Wagyu Burger', 'Sovereign Cappuccino');")
print(f"Deleted {c.rowcount} items")
conn.commit()
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
