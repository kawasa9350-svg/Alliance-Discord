const { REST, Routes } = require('discord.js');
const config = require('./config');

// Check if required environment variables are set
if (!config.botToken) {
    console.error('❌ BOT_TOKEN environment variable is not set!');
    process.exit(1);
}

if (!config.clientId) {
    console.error('❌ CLIENT_ID environment variable is not set!');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(config.botToken);

(async () => {
    try {
        console.log('🧹 CLEARING DUPLICATE GUILD COMMANDS...');
        console.log('=====================================');
        
        // Get all guilds the bot is in
        const guilds = await rest.get(Routes.userGuilds());
        console.log(`📊 Bot is in ${guilds.length} servers`);
        
        // Clear guild-specific commands from ALL guilds
        for (const guild of guilds) {
            try {
                console.log(`🗑️  Clearing guild commands from: ${guild.name} (${guild.id})`);
                
                // Clear existing guild commands
                await rest.put(
                    Routes.applicationGuildCommands(config.clientId, guild.id),
                    { body: [] }
                );
                
                console.log(`✅ Cleared commands from: ${guild.name}`);
            } catch (error) {
                console.error(`❌ Failed to clear commands from ${guild.name}:`, error.message);
            }
        }
        
        console.log('=====================================');
        console.log('🎉 GUILD COMMANDS CLEARED!');
        console.log('Now only global commands will show (no duplicates)');
        console.log('Global commands may take up to 1 hour to update everywhere.');
        
    } catch (error) {
        console.error('❌ Error clearing guild commands:', error);
    }
})();
