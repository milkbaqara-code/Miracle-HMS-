import base64
import subprocess

script = """import os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("UPDATE journal_entries SET verification_status = 'VERIFIED' WHERE verification_status = 'PENDING'"))
        conn.commit()
        print('Updated all PENDING journal entries to VERIFIED')
    except Exception as e:
        print('Error:', e)
"""

b64 = base64.b64encode(script.encode()).decode()
cmd = f"echo {b64} | base64 -d > /home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api/update_status.py && cd /home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api && venv/bin/python update_status.py"

subprocess.run(["python", "scripts/vps_cmd.py", cmd])
