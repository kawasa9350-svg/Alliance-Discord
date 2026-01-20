require('dotenv').config();

module.exports = {
    // Bot Configuration
    botToken: (process.env.BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '').trim(),
    clientId: (process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID || '').trim(),
    
    // Test Server ID for instant command updates (get this from Discord server settings)
    testGuildId: process.env.TEST_GUILD_ID,
    
    // Bot configuration object (for compatibility with deploy-commands.js)
    bot: {
        token: (process.env.BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '').trim(),
        applicationId: (process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID || '').trim()
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
        }
    },

    // Content Types
    contentTypes: {
        'Royals': {
            color: '#0099ff'
        },
        'HO': {
            color: '#FF6B35'
        },
        'No Tax': {
            color: '#00ff00'
        }
    },

    // Caller Fee Rate
    callerFeeRate: process.env.CALLER_FEE_RATE !== undefined
        ? parseFloat(process.env.CALLER_FEE_RATE) || 0
        : 0,
    
    // Phoenix webhook (for pushing splits to Phoenix Assistance)
    phoenixWebhookUrl: process.env.PHOENIX_WEBHOOK_URL || '',
    phoenixWebhookSecret: process.env.PHOENIX_WEBHOOK_SECRET || '',
    phoenixTargetGuildId: process.env.PHOENIX_TARGET_GUILD_ID || '',
    
    // Required role ID to get guild roles (set to null if no role required)
    requiredRoleId: process.env.REQUIRED_ROLE_ID,
    
    // Bot Settings
    prefix: process.env.PREFIX || '!',
    embedColor: process.env.EMBED_COLOR || '#0099ff'
};
