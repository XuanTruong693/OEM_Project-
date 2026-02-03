@echo off
title OEM Backend Server
echo ========================================
echo    OEM Backend Server (Port 5000)
echo ========================================
echo.

cd /d "C:\Users\Administrator\Documents\OEM_Project\backend"

echo Starting Node.js Backend Server...
node src/app.js

pause
