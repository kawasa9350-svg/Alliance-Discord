# Discord Bot Deployment Guide

This guide will help you deploy your Alliance Discord Bot to Render using GitHub.

## Prerequisites

1. A GitHub account
2. A Render account (free tier available)
3. Your Discord bot token and other credentials

## Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it something like `alliance-discord-bot`
3. Make it public or private (your choice)
4. Don't initialize with README, .gitignore, or license (we already have these)

## Step 2: Push Your Code to GitHub

Run these commands in your project directory:

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Commit your changes
git commit -m "Initial commit: Discord bot ready for deployment"

# Add your GitHub repository as remote origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git push -u origin main
```

## Step 3: Deploy to Render

1. Go to [Render](https://render.com) and sign up/login
2. Click "New +" and select "Web Service"
3. Connect your GitHub account and select your repository
4. Configure the service:
   - **Name**: `alliance-discord-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm install --production`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid if you prefer)

## Step 4: Configure Environment Variables

In your Render dashboard, go to your service and click on "Environment":

Add these environment variables (replace with your actual values):

```
BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
TEST_GUILD_ID=your_test_guild_id_here
MONGO_URI=your_mongodb_connection_string_here
PHOENIX_REBELS_ROLE_ID=your_phoenix_rebels_role_id_here
REQUIRED_ROLE_ID=your_required_role_id_here
PREFIX=!
EMBED_COLOR=#0099ff
CALLER_FEE_RATE=0.08
```

**Note**: Get your actual values from your local `.env` file or the `env.example` file in this repository.

## Step 5: Deploy and Test

1. Click "Create Web Service" in Render
2. Wait for the deployment to complete (usually 2-5 minutes)
3. Check the logs to ensure your bot starts successfully
4. Test your bot commands in Discord

## Step 6: Deploy Commands

After your bot is running, you need to deploy the slash commands:

1. In your local project, run:
   ```bash
   node deploy-commands.js
   ```

2. Or you can add this as a build step in Render by modifying the build command to:
   ```bash
   npm install && node deploy-commands.js
   ```

## Important Notes

- **Free Tier Limitations**: Render's free tier puts your service to sleep after 15 minutes of inactivity. Your bot will restart when someone uses a command.
- **Environment Variables**: Never commit your actual `.env` file to GitHub. Use the environment variables in Render instead.
- **MongoDB**: Your MongoDB Atlas connection should work fine from Render.
- **Discord Permissions**: Make sure your bot has the necessary permissions in your Discord server.

## Troubleshooting

### Bot Not Starting
- Check the logs in Render dashboard
- Verify all environment variables are set correctly
- Ensure your bot token is valid

### Commands Not Working
- Run `node deploy-commands.js` to register slash commands
- Check if your bot has the necessary permissions in Discord

### Database Connection Issues
- Verify your MongoDB URI is correct
- Check if your MongoDB Atlas cluster allows connections from Render's IP ranges

## Updating Your Bot

To update your bot:
1. Make changes to your code locally
2. Commit and push to GitHub
3. Render will automatically redeploy your service

## Support

If you encounter any issues:
1. Check the Render logs
2. Verify your environment variables
3. Test your bot locally first
4. Check Discord bot permissions
