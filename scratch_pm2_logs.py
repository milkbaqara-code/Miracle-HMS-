import paramiko
import json
from pathlib import Path

VPS_IP = '23.88.50.87'
VPS_USER = 'root'
VPS_KEY_PATH = str(Path('.ssh') / 'id_ed25519')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
key = paramiko.Ed25519Key.from_private_key_file(VPS_KEY_PATH)
ssh.connect(VPS_IP, username=VPS_USER, pkey=key, timeout=15)

print('--- PM2 STATUS ---')
stdin, stdout, stderr = ssh.exec_command('pm2 jlist')
pm2_data = json.loads(stdout.read().decode('utf-8', 'ignore'))
for app in pm2_data:
    print(f"{app['name']}: {app['pm2_env']['status']}")

print('\n--- FRONTEND LOGS ---')
stdin, stdout, stderr = ssh.exec_command('pm2 logs miracle-frontend --lines 30 --nostream')
print(stdout.read().decode('ascii', 'ignore'))
print(stderr.read().decode('ascii', 'ignore'))

print('\n--- BACKEND LOGS ---')
stdin, stdout, stderr = ssh.exec_command('pm2 logs miracle-backend --lines 30 --nostream')
print(stdout.read().decode('ascii', 'ignore'))
print(stderr.read().decode('ascii', 'ignore'))

ssh.close()
