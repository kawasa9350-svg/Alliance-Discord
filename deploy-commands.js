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
                choices: [
                    {
                        name: 'Phoenix Rebels',
                        value: 'Phoenix Rebels'
                    },
                    {
                        name: 'Trash Collectors',
                        value: 'Trash Collectors'
                    },
                    {
                        name: 'The Back Hand',
                        value: 'The Back Hand'
                    }
                ]
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
                description: 'Repair fees to subtract from total loot (in silver)',
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
        console.log('🔄 Started refreshing application (/) commands.');
        
        // Clear existing global commands first
        console.log('🗑️  Clearing existing global commands...');
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: [] },
        );
        console.log('✅ Cleared global commands.');
        
        // Deploy new global commands
        console.log('📤 Deploying new global commands...');
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );
        console.log('✅ Successfully deployed global application (/) commands.');

        // Deploy to guild-specific commands (instant updates)
        if (config.testGuildId) {
            console.log('📤 Deploying guild-specific commands for instant updates...');
            await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.testGuildId),
                { body: commands },
            );
            console.log('✅ Successfully deployed guild-specific (/) commands for testing.');
        } else {
            console.log('⚠️  No testGuildId configured. Add your server ID to config.js for instant command updates.');
        }

    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();
