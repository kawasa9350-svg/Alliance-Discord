@echo off
echo ========================================
echo    FORCE UPDATING DISCORD COMMANDS
echo ========================================
echo.

echo This will update commands in ALL servers
echo where your bot is present for instant updates.
echo.

pause

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Force updating commands...
call node force-update-commands.js
if %errorlevel% neq 0 (
    echo ERROR: Failed to force update commands
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ COMMANDS FORCE UPDATED!
echo ========================================
echo.
echo Commands should now be updated in all servers.
echo If you still see old commands, try restarting Discord.
echo.
pause
