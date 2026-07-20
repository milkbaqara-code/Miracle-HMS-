import paramiko
from pathlib import Path

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('23.88.50.87', username='root', pkey=paramiko.Ed25519Key.from_private_key_file(str(Path('.ssh')/'id_ed25519')))

# Inject all 4 keys into .env on VPS
env_path = '/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/.env'

# Read existing .env
stdin, stdout, stderr = ssh.exec_command(f'cat {env_path}')
existing = stdout.read().decode('ascii', 'ignore')

# Remove any old GEMINI_API_KEY entries
lines = [l for l in existing.splitlines() if not l.startswith('GEMINI_API_KEY')]

# Add the 4 new keys
lines.append('GEMINI_API_KEY_1=AIzaSyDMS_ZXCUBm6WzbtrlWaZyBjQE_AuvD4T0')
lines.append('GEMINI_API_KEY_2=AIzaSyDIfes6wbWtzuqbhR-qcfxY517hOUb8jBk')
lines.append('GEMINI_API_KEY_3=AIzaSyB4NMozAys4BdGOE-Ko9KdjwmoXrqsM72g')
lines.append('GEMINI_API_KEY_4=AIzaSyCjlZ-fUsvKWY8U0cT6GLHDp7n5LADySdo')

new_env = '\n'.join(lines) + '\n'
cmd = f"printf '%s' '{new_env}' > {env_path}"
ssh.exec_command(cmd)
print('VPS .env updated with 4-key vault.')

ssh.close()
