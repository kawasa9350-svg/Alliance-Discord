const { REST, Routes, PermissionFlagsBits } = require('discord.js');
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

const commands = [
    {
        name: 'register',
        description: 'Register for Albion Online Alliance and select your guild',
        options: [
            {
                name: 'guild',
                description: 'Select your guild',
                type: 3, // STRING type
                required: true,
                autocomplete: true
            },
            {
                name: 'ingame_name',
                description: 'Your in-game character name',
                type: 3, // STRING type
                required: true
            }
        ]
    },
    {
        name: 'add-guild',
        description: 'Add or update a guild for registrations',
        default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
        dm_permission: false,
        options: [
            {
                name: 'name',
                description: 'Guild name as it should appear',
                type: 3,
                required: true
            },
            {
                name: 'role_id',
                description: 'Discord role ID to assign on registration',
                type: 3,
                required: true
            },
            {
                name: 'tag',
                description: 'Optional guild tag to prepend to nickname',
                type: 3,
                required: false
            },
            {
                name: 'color',
                description: 'Optional embed color in hex (e.g., #FFAA00)',
                type: 3,
                required: false
            }
        ]
    },
    {
        name: 'remove-guild',
        description: 'Remove a guild from registrations',
        default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
        dm_permission: false,
        options: [
            {
                name: 'name',
                description: 'Select the guild to remove',
                type: 3,
                required: true,
                autocomplete: true
            }
        ]
    },
    {
        name: 'lootsplit',
        description: 'Calculate loot split with caller fees (no guild tax)',
        options: [
            {
                name: 'content_type',
                description: 'Type of content being run',
                type: 3, // STRING type
                required: true,
                choices: [
                    { name: 'BZ Roam', value: 'BZ Roam' },
                    { name: 'Shitters Roam', value: 'Shitters Roam' },
                    { name: 'Dungeons', value: 'Dungeons' },
                    { name: 'Avalonian Dungeon', value: 'Avalonian Dungeon' },
                    { name: 'Hellgate', value: 'Hellgate' },
                ]
            },
            {
                name: 'users',
                description: 'Mention the users participating (e.g., @user1 @user2 @user3)',
                type: 3, // STRING type
                required: true
            },
            {
                name: 'caller',
                description: 'Mention the caller user (e.g., @caller)',
                type: 3, // STRING type
                required: true
            },
            {
                name: 'repair_fees',
                description: 'Total repair fees in silver',
                type: 4, // INTEGER type
                required: true
            },
            {
                name: 'total_loot',
                description: 'Total loot value in silver',
                type: 4, // INTEGER type
                required: true
            }
        ]
    },
    {
        name: 'comp',
        description: 'Create a comp with roles and slots',
        options: [
            {
                name: 'create',
                description: 'Create a new comp',
                type: 1, // SUB_COMMAND type
                options: [
                    {
                        name: 'content_type',
                        description: 'Type of content for this comp',
                        type: 3, // STRING type
                        required: true,
                        choices: [
                            { name: 'BZ Roam', value: 'BZ Roam' },
                            { name: 'Shitters Roam', value: 'Shitters Roam' },
                            { name: 'Dungeons', value: 'Dungeons' },
                            { name: 'Avalonian Dungeon', value: 'Avalonian Dungeon' },
                            { name: 'Hellgate', value: 'Hellgate' }
                        ]
                    }
                ]
            },
            {
                name: 'list',
                description: 'Show builds for a specific comp',
                type: 1, // SUB_COMMAND type
                options: [
                    {
                        name: 'comp',
                        description: 'Select a comp to view its builds',
                        type: 3, // STRING type
                        required: true,
                        autocomplete: true
                    }
                ]
            }
        ]
    },
    {
        name: 'signup',
        description: 'Sign up for roles in a comp',
        options: [
            {
                name: 'comp',
                description: 'Select a comp to sign up for',
                type: 3, // STRING type
                required: true,
                autocomplete: true
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(config.botToken);

(async () => {
    try {
        console.log('🚀 FORCE UPDATING COMMANDS...');
        console.log('=====================================');
        
        // Get all guilds the bot is in
        const guilds = await rest.get(Routes.userGuilds());
        console.log(`📊 Bot is in ${guilds.length} servers`);
        
        // Clear and deploy to ALL guilds for instant updates
        for (const guild of guilds) {
            try {
                console.log(`🔄 Updating commands for: ${guild.name} (${guild.id})`);
                
                // Clear existing commands
                await rest.put(
                    Routes.applicationGuildCommands(config.clientId, guild.id),
                    { body: [] }
                );
                
                // Deploy new commands
                await rest.put(
                    Routes.applicationGuildCommands(config.clientId, guild.id),
                    { body: commands }
                );
                
                console.log(`✅ Updated commands for: ${guild.name}`);
            } catch (error) {
                console.error(`❌ Failed to update commands for ${guild.name}:`, error.message);
            }
        }
        
        // Also update global commands
        console.log('🌍 Updating global commands...');
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands }
        );
        console.log('✅ Updated global commands');
        
        console.log('=====================================');
        console.log('🎉 COMMAND UPDATE COMPLETE!');
        console.log('Commands should now be updated in all servers.');
        console.log('If you still see old commands, try restarting Discord.');
        
    } catch (error) {
        console.error('❌ Error force updating commands:', error);
    }
})();
