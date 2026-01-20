const { REST, Routes, PermissionFlagsBits } = require('discord.js');
const config = require('./config.js');

// Define commands inline (matching force-update-commands.js)
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
                    { name: 'Royals', value: 'Royals' },
                    { name: 'HO', value: 'HO' },
                    { name: 'No Tax', value: 'No Tax' }
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
                name: 'total_loot',
                description: 'Total loot value in silver',
                type: 4, // INTEGER type
                required: true,
                min_value: 0
            },
            {
                name: 'silver_bags',
                description: 'Silver bags value (not taxed, added after tax)',
                type: 4, // INTEGER type
                required: true,
                min_value: 0
            },
            {
                name: 'repair_fees',
                description: 'Total repair fees in silver',
                type: 4, // INTEGER type
                required: true,
                min_value: 0
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
                            { name: 'Royals', value: 'Royals' },
                            { name: 'HO', value: 'HO' },
                            { name: 'No Tax', value: 'No Tax' }
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

// Create REST instance
const rest = new REST({ version: '10' }).setToken(config.bot.token);

// Deploy commands
(async () => {
    try {
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

        let data;
        
        // Determine target from env override or config
        const envTarget = (process.env.DEPLOY_TARGET || '').toLowerCase(); // 'guild' or 'global'
        const shouldUseGuild = envTarget === 'guild' || (
            envTarget !== 'global' &&
            config.development && config.development.useGuildCommands && config.development.guildId && config.development.guildId !== "YOUR_TEST_GUILD_ID_HERE"
        );

        if (shouldUseGuild) {
            console.log(`🎯 Deploying commands to guild: ${config.development.guildId}`);
            console.log(`⚡ Commands will be available INSTANTLY in this guild!`);
            
            // Deploy commands to specific guild (instant updates)
            data = await rest.put(
                Routes.applicationGuildCommands(config.bot.applicationId, config.development.guildId),
                { body: commands },
            );
        } else {
            console.log(`🌍 Deploying commands globally (may take up to 1 hour to update)`);
            
            // Deploy commands globally
            data = await rest.put(
                Routes.applicationCommands(config.bot.applicationId),
                { body: commands },
            );
        }

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
        
        // List deployed commands
        console.log('\n📋 Deployed Commands:');
        data.forEach(command => {
            console.log(`  - /${command.name}: ${command.description}`);
        });
        
        if (config.development && config.development.useGuildCommands && config.development.guildId && config.development.guildId !== "YOUR_TEST_GUILD_ID_HERE") {
            console.log('\n🎯 Commands deployed to your test guild!');
            console.log('⚡ They are available INSTANTLY - no waiting required!');
        } else {
            console.log('\n🌍 Commands deployed globally');
            console.log('⏰ May take up to 1 hour to appear in all servers');
        }
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();
