@echo off
title Miracle HMS Master Launcher
color 0B
echo ===================================================
echo     INITIATING MIRACLE HMS MASTER
echo ===================================================
echo.

echo [1/2] Booting Sovereign Backend Engine...
cd /d "%~dp0backend_api"
start "Miracle HMS - Backend" cmd /k "python -m uvicorn app.main:app --reload --reload-exclude \"*.db\" --reload-exclude \"*.db-journal\" --reload-exclude \"*.db-wal\" --reload-exclude \"*.db-shm\" --host 127.0.0.1 --port 8095"

echo [2/2] Booting Sovereign Frontend UI...
cd /d "%~dp0web"
:: Root Fix: Reducing NextJS memory limit to 2048MB to prevent system OOM on 4GB RAM machine
set NODE_OPTIONS=--max-old-space-size=2048
start "Miracle HMS - Frontend" cmd /k "node node_modules\next\dist\bin\next dev --webpack -p 3065"

echo.
echo Both engines are spinning up in separate windows...
echo Waiting 5 seconds before opening your browser...
timeout /t 5 /nobreak > nul
echo Opening http://localhost:3065...
start http://localhost:3065
echo.
echo ✅ System is live! You can close this green/blue window.
pause
