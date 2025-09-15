@echo off
echo ========================================
echo    Deploying Test Commands (Instant)
echo ========================================
echo.

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Deploying commands to test server (instant updates)...
call node deploy-commands.js
if %errorlevel% neq 0 (
    echo ERROR: Failed to deploy commands
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ Test commands deployed instantly!
echo ========================================
echo.
echo Commands should be available immediately
echo in your test server. No waiting required!
echo.
pause
