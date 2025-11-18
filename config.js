require('dotenv').config();

module.exports = {
    // Bot Configuration
    botToken: process.env.BOT_TOKEN || process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID,
    
    // Test Server ID for instant command updates (get this from Discord server settings)
    testGuildId: process.env.TEST_GUILD_ID,
    
    // Bot configuration object (for compatibility with deploy-commands.js)
    bot: {
        token: process.env.BOT_TOKEN || process.env.DISCORD_BOT_TOKEN,
        applicationId: process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID
    },
    
    // Development configuration
    development: {
        useGuildCommands: !!process.env.TEST_GUILD_ID,
        guildId: process.env.TEST_GUILD_ID
    },
    
    // MongoDB Configuration
    mongoUri: process.env.MONGO_URI,
    
    // Guild Configuration
    guilds: {
        'Phoenix Rebels': {
            roleId: process.env.PHOENIX_REBELS_ROLE_ID,
            tag: '[PHNX]',
            color: '#FF6B35'
        },
        'Riders of Rohirrim': {
            roleId: process.env.RIDERS_OF_ROHIRRIM_ROLE_ID,
            tag: '[RoR]',
            color: '#8B4513'
        }
    },

    // Content Types
    contentTypes: {
        'BZ Roam': {
            color: '#FF6B35'
        },
        'Shitters Roam': {
            color: '#4ECDC4'
        },
        'Dungeons': {
            color: '#9B59B6'
        },
        'Avalonian Dungeon': {
            color: '#E74C3C'
        },
        'Hellgate': {
            color: '#F39C12'
        }
    },

    // Caller Fee Rate
    callerFeeRate: parseFloat(process.env.CALLER_FEE_RATE) || 0.05,
    
    // Required role ID to get guild roles (set to null if no role required)
    requiredRoleId: process.env.REQUIRED_ROLE_ID,
    
    // Bot Settings
    prefix: process.env.PREFIX || '!',
    embedColor: process.env.EMBED_COLOR || '#0099ff'
};
