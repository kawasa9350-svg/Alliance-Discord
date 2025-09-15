@echo off
echo ========================================
echo    Deploying Discord Slash Commands
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
echo Deploying slash commands to Discord...
call node deploy-commands.js
if %errorlevel% neq 0 (
    echo ERROR: Failed to deploy commands
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ Commands deployed successfully!
echo ========================================
echo.
echo Note: It may take a few minutes for commands
echo to appear in Discord. If they don't show up,
echo try restarting Discord or waiting a bit longer.
echo.
pause
