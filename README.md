# Alliance Discord Bot

A Discord bot for Albion Online Alliance management with MongoDB integration.

## Features

- **Guild Registration**: Users can register and select their guild
- **Role Management**: Automatic role assignment based on guild selection
- **Nickname Management**: Automatic nickname changes with guild tags
- **MongoDB Integration**: User data stored in MongoDB
- **Permission System**: Optional required role for guild role assignment

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure the Bot**
   - Open `config.js`
   - Replace the role IDs with actual role IDs from your Discord server
   - Update the `requiredRoleId` if you want to require a specific role for guild role assignment

3. **Deploy Slash Commands**
   ```bash
   node deploy-commands.js
   ```

4. **Start the Bot**
   ```bash
   npm start
   ```

## Configuration

### Guild Setup
In `config.js`, configure your guilds:

```javascript
guilds: {
    'Phoenix Rebels': {
        roleId: 'PHOENIX_ROLE_ID', // Replace with actual role ID
        tag: '[PHNX]',
        color: '#FF6B35'
    }
}
```

### Required Role
Set `requiredRoleId` to a specific role ID if you want to require users to have that role before they can get guild roles. Set to `null` if no role is required.

## Commands

### `/register`
- Allows users to register for the alliance
- Shows a dropdown menu to select guild
- Prompts for in-game name
- Assigns guild role (if user has required role)
- Changes nickname with guild tag

## Database Schema

The bot uses MongoDB with the following user schema:

```javascript
{
    discordId: String,        // Discord user ID
    username: String,         // Discord username
    guild: String,           // Selected guild name
    ingameName: String,      // In-game name
    registeredAt: Date,      // Registration timestamp
    hasRequiredRole: Boolean, // Whether user has required role
    lastUpdated: Date        // Last update timestamp
}
```

## Getting Role IDs

1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on the role you want to use
3. Select "Copy ID"
4. Replace the placeholder role IDs in `config.js`

## Troubleshooting

- Make sure the bot has the necessary permissions in your Discord server
- Ensure the bot has permission to manage roles and change nicknames
- Check that the MongoDB connection is working
- Verify that role IDs are correct and the roles exist in your server
