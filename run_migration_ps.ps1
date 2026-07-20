scp -i ~/.ssh/miracle_os_key -o StrictHostKeyChecking=no remote_migration.py root@23.88.50.87:/home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api/
ssh -i ~/.ssh/miracle_os_key -o StrictHostKeyChecking=no root@23.88.50.87 "cd /home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api && source venv/bin/activate && python remote_migration.py"
