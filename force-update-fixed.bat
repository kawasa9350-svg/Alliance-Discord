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
echo Setting environment variables...
set BOT_TOKEN=MTQxNTAyMDYzMjQwMzQ4MDYxNw.GAK4XI.1CUD-zPcYe_LHHgO3xajt0RubVtwfgzovo0WTY
set CLIENT_ID=1415020632403480617
set TEST_GUILD_ID=1339172884836519948
set MONGO_URI=mongodb+srv://kawasa9350_db_user:rS9SuaApB8gWftap@allianceserver.qzivyq8.mongodb.net/?retryWrites=true&w=majority&appName=AllianceServer
set PHOENIX_REBELS_ROLE_ID=1406351228870459434
set REQUIRED_ROLE_ID=1339184104582807635
set PREFIX=!
set EMBED_COLOR=#0099ff
set CALLER_FEE_RATE=0.08

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
