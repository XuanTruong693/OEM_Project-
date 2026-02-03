@echo off
title OEM - Start All Services
echo ========================================
echo    Starting OEM Project Services
echo ========================================
echo.

echo [1/2] Starting Backend Server...
start "OEM Backend" cmd /k "cd /d C:\Users\Administrator\Documents\OEM_Project\backend && node src/app.js"

timeout /t 3 /nobreak > nul

echo [2/2] Starting AI Service...
start "OEM AI Service" cmd /k "cd /d C:\Users\Administrator\Documents\OEM_Project\ai_services && call .venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

echo.
echo ========================================
echo All services started!
echo.
echo Backend:     http://localhost:5000
echo AI Service:  http://localhost:8000
echo Frontend:    https://www.oem.io.vn (via IIS)
echo ========================================
echo.
echo Press any key to exit this window...
pause > nul
