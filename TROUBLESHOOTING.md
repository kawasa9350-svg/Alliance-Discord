# Discord Bot Troubleshooting Guide

## Bot Going Offline Issues

### Symptoms
- Bot appears offline in Discord but shows as running on Render
- Bot stops responding to commands after 1-2 days
- UptimeRobot shows bot is alive but Discord shows offline

### Root Causes & Solutions

#### 1. Discord Connection Drops
**Problem**: Discord WebSocket connection can drop due to network issues, rate limits, or server restarts.

**Solution**: The bot now includes:
- Automatic reconnection logic with exponential backoff
- Connection status monitoring every 30 seconds
- Heartbeat and presence updates every 5 minutes
- Enhanced error handling for connection issues

#### 2. Memory Leaks
**Problem**: Bot accumulates memory over time, eventually causing crashes.

**Solution**: 
- Memory monitoring every 10 minutes
- Automatic garbage collection when memory usage exceeds 150MB
- Better cleanup of event listeners and intervals

#### 3. Unhandled Promise Rejections
**Problem**: Unhandled errors can cause the bot to become unresponsive.

**Solution**:
- Comprehensive error handling for all Discord events
- Graceful shutdown procedures
- Retry logic for critical operations

### Monitoring Your Bot

#### Health Check Endpoints
- `GET /health` - Detailed health information (JSON)
- `GET /ping` - Simple ping response
- `GET /status` - Basic status text

#### Using the Monitor Script
```bash
# Check bot health locally
npm run monitor

# Check bot health on Render (replace with your URL)
BOT_URL=https://your-bot-name.onrender.com npm run monitor
```

#### Health Check Response
```json
{
  "status": "online",
  "discord": {
    "status": "connected",
    "guilds": 5,
    "ping": 45,
    "gateway": "wss://gateway.discord.gg"
  },
  "memory": {
    "heapUsed": 45.2
  },
  "uptime": 3600,
  "reconnectAttempts": 0
}
```

### Render-Specific Issues

#### Free Tier Limitations
- Render free tier can sleep after 15 minutes of inactivity
- Use UptimeRobot to ping your bot every 5-10 minutes
- The bot includes self-pinging every 5 minutes

#### Environment Variables
Ensure all required environment variables are set:
- `BOT_TOKEN` - Your Discord bot token
- `CLIENT_ID` - Your Discord application client ID
- `MONGO_URI` - Your MongoDB connection string
- All role IDs and other configuration

### Debugging Steps

1. **Check Render Logs**
   ```bash
   # Look for these log messages:
   # ✅ Bot is online as YourBot#1234
   # 🔗 Discord Status: Connected
   # 📊 Memory Usage (MB): {...}
   ```

2. **Test Health Endpoint**
   ```bash
   curl https://your-bot-name.onrender.com/health
   ```

3. **Monitor Connection Status**
   - Look for reconnection attempts in logs
   - Check if `reconnectAttempts` is increasing
   - Verify Discord status shows "connected"

4. **Check Memory Usage**
   - Monitor heap usage over time
   - Look for garbage collection triggers
   - Ensure memory doesn't continuously grow

### Prevention Tips

1. **Regular Monitoring**
   - Set up UptimeRobot to ping `/health` every 5 minutes
   - Monitor Render logs for errors
   - Check Discord bot status regularly

2. **Environment Setup**
   - Use stable environment variables
   - Ensure MongoDB connection is reliable
   - Keep dependencies updated

3. **Code Maintenance**
   - Review logs for recurring errors
   - Update Discord.js when new versions are available
   - Test bot functionality after deployments

### Emergency Recovery

If your bot goes offline:

1. **Check Render Dashboard**
   - Verify service is running
   - Check recent logs for errors
   - Restart service if needed

2. **Force Reconnection**
   - The bot will automatically attempt reconnection
   - Check logs for reconnection attempts
   - Wait up to 5 minutes for automatic recovery

3. **Manual Restart**
   - If automatic recovery fails, restart the Render service
   - Monitor logs during startup
   - Verify bot comes online in Discord

### Support

If issues persist:
1. Check Render logs for specific error messages
2. Verify all environment variables are correct
3. Test the health endpoint
4. Review this troubleshooting guide
5. Check Discord.js documentation for API changes
