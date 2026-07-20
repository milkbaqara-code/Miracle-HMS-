import paramiko
from pathlib import Path
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('23.88.50.87', username='root', pkey=paramiko.Ed25519Key.from_private_key_file(str(Path('.ssh')/'id_ed25519')))
stdin, stdout, stderr = ssh.exec_command('grep "Gemini" /root/.pm2/logs/miracle-backend-error.log | tail -n 20')
print(stdout.read().decode('ascii', 'ignore'))
