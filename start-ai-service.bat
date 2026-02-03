@echo off
title OEM AI Service
echo ========================================
echo    OEM AI Service (Port 8000)
echo ========================================
echo.

cd /d "C:\Users\Administrator\Documents\OEM_Project\ai_services"

echo Activating Python Virtual Environment...
call .venv\Scripts\activate.bat

echo Starting AI Service with Uvicorn...
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

pause
