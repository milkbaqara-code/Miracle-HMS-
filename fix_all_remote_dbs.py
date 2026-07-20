import paramiko
from pathlib import Path

VPS_IP   = "miracle.vigilantitsolution.com"
VPS_PORT = 22
VPS_USER = "root"
VPS_PASS = "NdRbWqkTuUMf"
VPS_KEY  = str(Path.home() / ".ssh" / "miracle_os_key")

remote_script = """import sqlite3
import glob

db_files = glob.glob('/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/**/*.db', recursive=True)
for db_path in db_files:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Check if fnb_orders exists
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='fnb_orders';")
    if c.fetchone():
        print(f"Updating {db_path}...")
        try:
            c.execute('ALTER TABLE fnb_orders ADD COLUMN guest_profile_id VARCHAR(64);')
            print('  Added guest_profile_id')
        except Exception as e:
            pass # Probably already exists
            
    # Check if inventory exists
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory';")
    if c.fetchone():
        c.execute("DELETE FROM inventory WHERE name IN ('Signature Wagyu Burger', 'Sovereign Cappuccino');")
        if c.rowcount > 0:
            print(f"  Deleted {c.rowcount} items from inventory")
            
    conn.commit()
    conn.close()
print("All DBs updated.")
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
