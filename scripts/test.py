import hms_deploy
ssh = hms_deploy.connect_ssh()
hms_deploy.run_cmd(ssh, "grep -r '8091' /home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/ || echo 'Not Found'")
hms_deploy.run_cmd(ssh, "cat /home/vigilantitsolution-api/htdocs/api.vigilantitsolution.com/backend_api/ecosystem.config.js")
