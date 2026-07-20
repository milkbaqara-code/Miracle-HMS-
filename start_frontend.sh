#!/bin/bash
cd /home/vigilantitsolution-miracle/htdocs/miracle.vigilantitsolution.com/web
pm2 delete miracle-frontend || true
pm2 start npm --name "miracle-frontend" -- run start
pm2 save
