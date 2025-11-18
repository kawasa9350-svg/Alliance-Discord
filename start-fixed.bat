@echo off
echo ========================================
echo    Alliance Discord Bot Startup
echo ========================================
echo.

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/3] Deploying slash commands...
set BOT_TOKEN=MTQxNTAyMDYzMjQwMzQ4MDYxNw.GAK4XI.1CUD-zPcYe_LHHgO3xajt0RubVtwfgzovo0WTY
set CLIENT_ID=1415020632403480617
set TEST_GUILD_ID=1339172884836519948
set MONGO_URI=mongodb+srv://kawasa9350_db_user:rS9SuaApB8gWftap@allianceserver.qzivyq8.mongodb.net/?retryWrites=true&w=majority&appName=AllianceServer
set PHOENIX_REBELS_ROLE_ID=1406351228870459434
set REQUIRED_ROLE_ID=1339184104582807635
set PREFIX=!
set EMBED_COLOR=#0099ff
set CALLER_FEE_RATE=0.05

call node deploy-commands.js
if %errorlevel% neq 0 (
    echo ERROR: Failed to deploy commands
    pause
    exit /b 1
)

echo.
echo [3/3] Starting bot...
echo ========================================
echo Bot is starting... Press Ctrl+C to stop
echo ========================================
echo.

call node index.js

echo.
echo Bot has stopped.
pause
