import paramiko
from pathlib import Path

VPS_IP   = "miracle.vigilantitsolution.com"
VPS_PORT = 22
VPS_USER = "root"
VPS_PASS = "NdRbWqkTuUMf"
VPS_KEY  = str(Path.home() / ".ssh" / "miracle_os_key")

remote_script = """import sys
import os

sys.path.append('/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api')
from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # 1. Add pos_transaction_id
    try:
        conn.execute(text("ALTER TABLE fnb_orders ADD COLUMN pos_transaction_id VARCHAR(64);"))
        print("Added pos_transaction_id")
    except Exception as e:
        print("Error adding pos_transaction_id:", e)
        
    # 2. Add guest_profile_id
    try:
        conn.execute(text("ALTER TABLE fnb_orders ADD COLUMN guest_profile_id VARCHAR(64);"))
        print("Added guest_profile_id")
    except Exception as e:
        print("Error adding guest_profile_id:", e)
        
    # 3. Delete from inventory
    try:
        res = conn.execute(text("DELETE FROM inventory WHERE name IN ('Signature Wagyu Burger', 'Sovereign Cappuccino');"))
        print(f"Deleted {res.rowcount} items from inventory")
    except Exception as e:
        print("Error deleting inventory:", e)
    
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

stdin, stdout, stderr = ssh.exec_command("cd /home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api && /home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api/venv/bin/python /tmp/temp_remote_script.py")
print("STDOUT:", stdout.read().decode())
print("STDERR:", stderr.read().decode())

ssh.close()
