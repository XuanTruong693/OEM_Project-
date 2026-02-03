@echo off
echo ========================================
echo    OEM Mini - Build and Deploy Frontend
echo ========================================
echo.

cd /d "C:\Users\Administrator\Documents\OEM_Project\frontend"

echo [1/3] Building frontend...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Deploying to IIS (C:\inetpub\wwwroot)...
xcopy /E /Y /I "dist\*" "C:\inetpub\wwwroot\"
if errorlevel 1 (
    echo ERROR: Deploy failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Restarting IIS...
iisreset /restart

echo.
echo ========================================
echo    ✅ BUILD AND DEPLOY COMPLETED!
echo ========================================
echo.
pause
