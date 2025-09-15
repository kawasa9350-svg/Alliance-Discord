const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const mongoose = require('mongoose');
const config = require('./config');
const User = require('./models/User');
const Composition = require('./models/Composition');
const SignupSession = require('./models/SignupSession');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent
    ]
});

// Create commands collection
client.commands = new Collection();

// Store comp creation data temporarily
const compSessions = new Map();

// MongoDB Connection
mongoose.connect(config.mongoUri)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
});

// Slash command interaction handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'register') {
        await handleRegisterCommand(interaction);
    } else if (commandName === 'lootsplit') {
        await handleLootsplitCommand(interaction);
    } else if (commandName === 'comp') {
        await handleCompCommand(interaction);
    } else if (commandName === 'signup') {
        await handleSignupCommand(interaction);
    }
});

// Register command handler
async function handleRegisterCommand(interaction) {
    try {
        const selectedGuild = interaction.options.getString('guild');
        const ingameName = interaction.options.getString('ingame_name').trim();
        const guildConfig = config.guilds[selectedGuild];
        
        if (!guildConfig) {
            await interaction.reply({ 
                content: '❌ Invalid guild selection. Please try again.', 
                ephemeral: true 
            });
            return;
        }

        // Validate in-game name
        if (ingameName.length < 2 || ingameName.length > 20) {
            await interaction.reply({ 
                content: '❌ In-game name must be between 2 and 20 characters.', 
                ephemeral: true 
            });
            return;
        }

        // Check if user has required role
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const hasRequiredRole = !config.requiredRoleId || member.roles.cache.has(config.requiredRoleId);

        // Update or create user in database
        const userData = {
            discordId: interaction.user.id,
            username: interaction.user.username,
            guild: selectedGuild,
            ingameName: ingameName,
            registeredAt: new Date(),
            hasRequiredRole: hasRequiredRole
        };

        await User.findOneAndUpdate(
            { discordId: interaction.user.id },
            userData,
            { upsert: true, new: true }
        );

        // Handle role assignment and nickname change
        let roleAssigned = false;
        let nicknameChanged = false;
        let nicknameError = '';

        if (hasRequiredRole) {
            // Assign guild role
            try {
                const role = interaction.guild.roles.cache.get(guildConfig.roleId);
                if (role) {
                    await member.roles.add(role);
                    roleAssigned = true;
                }
            } catch (error) {
                console.error('Error assigning role:', error);
            }

            // Change nickname with guild tag
            try {
                const newNickname = `${guildConfig.tag} ${ingameName}`;
                await member.setNickname(newNickname);
                nicknameChanged = true;
            } catch (error) {
                console.error('Error changing nickname:', error);
                nicknameError = `Please manually change your nickname to: **${guildConfig.tag} ${ingameName}**`;
            }
        } else {
            // Just change nickname without tag
            try {
                await member.setNickname(ingameName);
                nicknameChanged = true;
            } catch (error) {
                console.error('Error changing nickname:', error);
                nicknameError = `Please manually change your nickname to: **${ingameName}**`;
            }
        }

        // Send confirmation
        const confirmEmbed = new EmbedBuilder()
            .setTitle('✅ Registration Successful!')
            .setDescription(`Welcome to Big and Strong!`)
            .setColor(guildConfig.color)
            .addFields(
                { name: 'In-Game Name', value: ingameName, inline: true },
                { name: 'Guild', value: selectedGuild, inline: true },
                { name: 'Role Assigned', value: roleAssigned ? '✅ Yes' : '❌ No (Missing required role)', inline: true },
                { name: 'Nickname Changed', value: nicknameChanged ? '✅ Yes' : '❌ No (Bot lacks permission)', inline: true }
            )
            .setTimestamp();

        // Add nickname instruction if there was an error
        if (nicknameError) {
            confirmEmbed.addFields({ name: '📝 Manual Action Required', value: nicknameError, inline: false });
        }

        await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

    } catch (error) {
        console.error('Error in register command:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while processing your registration. Please try again later.', 
            ephemeral: true 
        });
    }
}

// Lootsplit command handler
async function handleLootsplitCommand(interaction) {
    try {
        const contentType = interaction.options.getString('content_type');
        const hostGuild = interaction.options.getString('host_guild');
        const usersInput = interaction.options.getString('users');
        const totalLoot = interaction.options.getInteger('total_loot');

        // Get content type config
        const contentConfig = config.contentTypes[contentType];
        if (!contentConfig) {
            await interaction.reply({ 
                content: '❌ Invalid content type selected.',
                flags: 64 // Ephemeral flag
            });
            return;
        }

        // Parse mentioned users from the users input string
        const mentionRegex = /<@!?(\d+)>/g;
        const mentionedUserIds = [];
        let match;
        
        while ((match = mentionRegex.exec(usersInput)) !== null) {
            mentionedUserIds.push(match[1]);
        }

        if (mentionedUserIds.length === 0) {
            await interaction.reply({ 
                content: '❌ Please mention the users participating in the loot split.',
                flags: 64 // Ephemeral flag
            });
            return;
        }

        // Fetch the mentioned users
        const mentionedUsers = new Map();
        for (const userId of mentionedUserIds) {
            try {
                const user = await client.users.fetch(userId);
                mentionedUsers.set(userId, user);
            } catch (error) {
                console.error(`Error fetching user ${userId}:`, error);
            }
        }

        // Check if all mentioned users are registered
        const unregisteredUsers = [];
        const registeredUsers = [];

        for (const [userId, user] of mentionedUsers) {
            const userData = await User.findOne({ discordId: userId });
            if (userData) {
                registeredUsers.push({
                    user: user,
                    ingameName: userData.ingameName,
                    guild: userData.guild
                });
            } else {
                unregisteredUsers.push(user);
            }
        }

        // If there are unregistered users, show error
        if (unregisteredUsers.length > 0) {
            const unregisteredMentions = unregisteredUsers.map(user => `<@${user.id}>`).join(', ');
            await interaction.reply({ 
                content: `❌ The following users need to register first: ${unregisteredMentions}\n\nPlease use \`/register\` to register before participating in loot splits.`,
                flags: 64 // Ephemeral flag
            });
            return;
        }

        // Calculate loot split
        const guildTaxRate = contentConfig.taxRate;
        const callerFeeRate = config.callerFeeRate;
        
        const guildTax = Math.floor(totalLoot * guildTaxRate);
        const callerFee = Math.floor(totalLoot * callerFeeRate);
        const totalTaxes = guildTax + callerFee;
        const lootAfterTax = totalLoot - totalTaxes;
        const lootPerPerson = Math.floor(lootAfterTax / registeredUsers.length);

        // Group users by guild for per-guild totals
        const guildTotals = {};
        registeredUsers.forEach(user => {
            if (!guildTotals[user.guild]) {
                guildTotals[user.guild] = 0;
            }
            guildTotals[user.guild] += lootPerPerson;
        });

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle('Loot Split')
            .setColor(contentConfig.color)
            .addFields(
                { name: 'Split Type', value: contentType, inline: true },
                { name: 'Total Loot (Before Tax)', value: totalLoot.toLocaleString(), inline: true },
                { name: 'Host Guild', value: hostGuild, inline: true },
                { name: 'Caller Fee', value: callerFee.toLocaleString(), inline: true },
                { name: 'Guild Tax', value: guildTax.toLocaleString(), inline: true },
                { name: 'Total Loot (After Tax)', value: lootAfterTax.toLocaleString(), inline: true },
                { name: 'Attendees', value: registeredUsers.length.toString(), inline: true },
                { name: 'Player Payout', value: lootPerPerson.toLocaleString(), inline: true }
            )
            .setTimestamp();

        // Add players list as proper mentions only
        const playersList = registeredUsers.map(user => {
            return `<@${user.user.id}>`;
        }).join(' ');

        embed.addFields({ name: 'Players', value: playersList, inline: false });

        // Add per guild totals
        const perGuildTotals = Object.entries(guildTotals)
            .map(([guild, total]) => `**${guild}:** ${total.toLocaleString()}`)
            .join('\n');

        embed.addFields({ name: 'Per Guild Total to Collect', value: perGuildTotals, inline: false });

        await interaction.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in lootsplit command:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while calculating the loot split. Please try again later.',
            flags: 64 // Ephemeral flag
        });
    }
}

// Comp command handler
async function handleCompCommand(interaction) {
    try {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'create') {
            await handleCompCreateCommand(interaction);
        } else if (subcommand === 'list') {
            await handleCompListCommand(interaction);
        }
    } catch (error) {
        console.error('Error in comp command:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while processing the comp command. Please try again later.',
            flags: 64 // Ephemeral flag
        });
    }
}

// Comp create command handler
async function handleCompCreateCommand(interaction) {
    try {
        const contentType = interaction.options.getString('content_type');
        
        // Create step 1 embed - Enter comp name
        const embed = new EmbedBuilder()
            .setTitle('🎭 Comp Creation')
            .setDescription('Step 2: Enter a name for your comp.')
            .addFields({ name: 'Selected Content Type', value: contentType, inline: false })
            .setColor('#0099ff')
            .setFooter({ text: 'Phoenix Assistance Bot • Step 2 of 3 • Today at 1:40 PM' })
            .setTimestamp();

        // Create button for entering comp name
        const enterNameButton = new ButtonBuilder()
            .setCustomId('enter_comp_name')
            .setLabel('Enter Comp Name')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝');

        const row = new ActionRowBuilder().addComponents(enterNameButton);

        await interaction.reply({ 
            embeds: [embed], 
            components: [row],
            ephemeral: true 
        });
        
    } catch (error) {
        console.error('Error in comp create command:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while creating the composition. Please try again later.',
            flags: 64 // Ephemeral flag
        });
    }
}

// Comp list command handler
async function handleCompListCommand(interaction) {
    try {
        // Get all comps from database
        const comps = await Composition.find({}).sort({ createdAt: -1 }).limit(20);
        
        if (comps.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📋 Saved Comps')
                .setDescription('No comps found. Create your first comp with `/comp create`!')
                .setColor('#0099ff')
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }
        
        // Create embed with comp list
        const embed = new EmbedBuilder()
            .setTitle('📋 Saved Comps')
            .setDescription(`Found ${comps.length} saved comp${comps.length === 1 ? '' : 's'}`)
            .setColor('#0099ff')
            .setTimestamp();
        
        // Add each comp as a field
        comps.forEach((comp, index) => {
            const buildList = comp.roles.length > 0 
                ? comp.roles.map((role, i) => `${i + 1}. ${role}`).join('\n')
                : 'No builds';
            
            const truncatedList = buildList.length > 1000 
                ? buildList.substring(0, 1000) + '...' 
                : buildList;
            
            embed.addFields({
                name: `${index + 1}. ${comp.name}`,
                value: `**Builds (${comp.roles.length}):**\n${truncatedList}\n\n**Created by:** <@${comp.createdBy.discordId}>\n**Date:** ${comp.createdAt.toLocaleDateString()}`,
                inline: false
            });
        });
        
        // Add pagination info if there are many comps
        if (comps.length === 20) {
            embed.setFooter({ text: 'Showing latest 20 comps. More may be available.' });
        }
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        
    } catch (error) {
        console.error('Error in comp list command:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while fetching comps. Please try again later.',
            flags: 64 // Ephemeral flag
        });
    }
}

// Signup autocomplete handler
async function handleSignupAutocomplete(interaction) {
    try {
        console.log('Autocomplete triggered for signup command');
        
        // Get all comps from database
        const comps = await Composition.find({})
            .select('name')
            .sort({ name: 1 })
            .limit(25);
        
        console.log('Found comps in database:', comps.length);
        
        // Format choices for Discord
        const choices = comps.map(comp => ({
            name: comp.name,
            value: comp.name
        }));
        
        console.log('Sending choices to Discord:', choices.length);
        
        if (choices.length === 0) {
            await interaction.respond([{
                name: 'No comps found - Create one with /comp create',
                value: 'no-comps-found'
            }]);
        } else {
            await interaction.respond(choices);
        }
        
    } catch (error) {
        console.error('Error in signup autocomplete:', error);
        await interaction.respond([{
            name: 'Error loading comps',
            value: 'error-loading'
        }]);
    }
}

// Signup command handler
async function handleSignupCommand(interaction) {
    try {
        const compName = interaction.options.getString('comp');
        
        // Handle special cases
        if (compName === 'no-comps-found' || compName === 'error-loading') {
            await interaction.reply({ 
                content: '❌ No comps found in database. Create a comp first with `/comp create`.',
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        // Find the comp in database
        const comp = await Composition.findOne({ name: compName });
        if (!comp) {
            await interaction.reply({ 
                content: `❌ Comp "${compName}" not found. Use \`/comp list\` to see available comps.`,
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        // Generate session ID
        const sessionId = Math.random().toString(36).substring(2, 15);
        
        // Create signup session
        const signupSession = new SignupSession({
            sessionId: sessionId,
            compId: comp._id,
            compName: comp.name,
            roles: comp.roles.map(role => ({
                roleName: role,
                signups: []
            })),
            createdBy: {
                discordId: interaction.user.id,
                username: interaction.user.username
            }
        });
        
        await signupSession.save();
        
        // Add roles list
        const rolesList = comp.roles.map((role, index) => 
            `${index + 1}. ${role} - No signups`
        ).join('\n');
        
        // Create signup embed
        const embed = new EmbedBuilder()
            .setTitle(`📝 Build Signup - 0/${comp.roles.length}`)
            .addFields(
                { name: `${comp.name} - Available Builds`, value: '', inline: false },
                { name: '💜 Available Builds', value: rolesList, inline: false }
            )
            .setColor('#E74C3C')
            .setFooter({ text: `Phoenix Assistance Bot • Click buttons below to sign up • Session: ${sessionId} • Today at 1:52 PM` })
            .setTimestamp();
        
        // Create buttons for each role
        const buttons = [];
        comp.roles.forEach((role, index) => {
            const button = new ButtonBuilder()
                .setCustomId(`signup_${sessionId}_${index}`)
                .setLabel(`${index + 1}`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✅');
            buttons.push(button);
        });
        
        // Split buttons into rows of 4
        const buttonRows = [];
        for (let i = 0; i < buttons.length; i += 4) {
            const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 4));
            buttonRows.push(row);
        }
        
        await interaction.reply({ 
            embeds: [embed], 
            components: buttonRows
        });
        
    } catch (error) {
        console.error('Error in signup command:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while creating the signup session. Please try again later.',
            flags: 64 // Ephemeral flag
        });
    }
}

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'enter_comp_name') {
        // Create modal for comp name
        const modal = new ModalBuilder()
            .setCustomId('comp_name_modal')
            .setTitle('Enter Comp Name');

        const nameInput = new TextInputBuilder()
            .setCustomId('comp_name')
            .setLabel('Comp Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter your comp name...')
            .setRequired(true)
            .setMaxLength(50);

        const actionRow = new ActionRowBuilder().addComponents(nameInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('add_build_')) {
        const sessionId = interaction.customId.replace('add_build_', '');
        
        // Create modal for adding build
        const modal = new ModalBuilder()
            .setCustomId(`add_build_modal_${sessionId}`)
            .setTitle('Add Build to Comp');

        const buildInput = new TextInputBuilder()
            .setCustomId('build_name')
            .setLabel('Build Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter build name...')
            .setRequired(true)
            .setMaxLength(100);

        const actionRow = new ActionRowBuilder().addComponents(buildInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('create_comp_')) {
        const sessionId = interaction.customId.replace('create_comp_', '');
        const session = compSessions.get(sessionId);
        
        if (session) {
            // Save to database
            try {
                await Composition.create({
                    name: session.compName,
                    roles: session.builds,
                    createdBy: {
                        discordId: session.userId,
                        username: interaction.user.username
                    }
                });
                
                compSessions.delete(sessionId);
                await interaction.update({ 
                    content: '✅ Comp created and saved successfully!', 
                    components: [],
                    embeds: []
                });
            } catch (error) {
                console.error('Error saving comp:', error);
                await interaction.reply({ 
                    content: '❌ Error saving comp to database.', 
                    ephemeral: true 
                });
            }
        }
    } else if (interaction.customId.startsWith('cancel_comp_')) {
        const sessionId = interaction.customId.replace('cancel_comp_', '');
        compSessions.delete(sessionId);
        
        await interaction.update({ 
            content: '❌ Comp creation cancelled.', 
            components: [],
            embeds: []
        });
    } else if (interaction.customId.startsWith('signup_')) {
        // Handle signup button clicks
        const parts = interaction.customId.split('_');
        const sessionId = parts[1];
        const roleIndex = parseInt(parts[2]);
        
        // Find the signup session
        const session = await SignupSession.findOne({ sessionId: sessionId });
        if (!session) {
            await interaction.reply({ 
                content: '❌ Signup session not found or expired.',
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        // Check if user is registered
        const userData = await User.findOne({ discordId: interaction.user.id });
        if (!userData) {
            await interaction.reply({ 
                content: '❌ You need to register first with `/register` before signing up.',
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        // Check if user is already signed up for this role
        const role = session.roles[roleIndex];
        const existingSignup = role.signups.find(signup => signup.userId === interaction.user.id);
        
        // If role is taken by someone else, show error
        if (role.signups.length > 0 && !existingSignup) {
            await interaction.reply({ 
                content: `❌ This role is already taken by **${role.signups[0].ingameName}**! Only one person can sign up per role.`,
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        if (existingSignup) {
            // Remove signup
            role.signups = role.signups.filter(signup => signup.userId !== interaction.user.id);
            await session.save();
        } else {
            // Check if user is already signed up for any other role
            const userAlreadySignedUp = session.roles.some(r => 
                r.signups.some(signup => signup.userId === interaction.user.id)
            );
            
            if (userAlreadySignedUp) {
                await interaction.reply({ 
                    content: `❌ You're already signed up for another role! Please remove yourself from your current role first before signing up for a new one.`,
                    flags: 64 // Ephemeral flag
                });
                return;
            }
            
            // Check if this role already has someone signed up
            if (role.signups.length > 0) {
                await interaction.reply({ 
                    content: `❌ This role is already taken by **${role.signups[0].ingameName}**! Only one person can sign up per role.`,
                    flags: 64 // Ephemeral flag
                });
                return;
            }
            
            // Add signup
            role.signups.push({
                userId: interaction.user.id,
                username: interaction.user.username,
                ingameName: userData.ingameName,
                guild: userData.guild
            });
            await session.save();
        }
        
        // Update the public embed without sending ephemeral message
        await updateSignupEmbed(interaction, session);
    }
});

// Handle modal interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'comp_name_modal') {
        const compName = interaction.fields.getTextInputValue('comp_name');
        
        // Store comp session data
        const sessionId = `${interaction.user.id}_${Date.now()}`;
        compSessions.set(sessionId, {
            compName: compName,
            contentType: 'Shitters Roam', // This should come from the original command
            builds: [],
            userId: interaction.user.id
        });
        
        // Create step 2 embed - Add builds
        const embed = new EmbedBuilder()
            .setTitle('💚🎭 Add Builds to Comp')
            .addFields(
                { name: 'Comp', value: compName, inline: false },
                { name: 'Content Type', value: 'Shitters Roam', inline: false },
                { name: 'Current Builds (0/20)', value: 'No builds added yet', inline: false },
                { 
                    name: 'Instructions', 
                    value: '• Click "✏️ Add Build" to manually type a build name\n• You can type any build name\n• You can add the same build multiple times for variations\n• Builds will be added in the order you enter them',
                    inline: false 
                }
            )
            .setColor('#0099ff')
            .setFooter({ text: 'Phoenix Assistance Bot • Type build names manually • Today at 1:41 PM' })
            .setTimestamp();

        // Create buttons
        const addBuildButton = new ButtonBuilder()
            .setCustomId(`add_build_${sessionId}`)
            .setLabel('Add Build')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️');

        const createCompButton = new ButtonBuilder()
            .setCustomId(`create_comp_${sessionId}`)
            .setLabel('Create Comp')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

        const cancelButton = new ButtonBuilder()
            .setCustomId(`cancel_comp_${sessionId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');

        const row = new ActionRowBuilder().addComponents(addBuildButton, createCompButton, cancelButton);

        await interaction.update({ 
            embeds: [embed], 
            components: [row]
        });
    } else if (interaction.customId.startsWith('add_build_modal_')) {
        const sessionId = interaction.customId.replace('add_build_modal_', '');
        const buildName = interaction.fields.getTextInputValue('build_name');
        const session = compSessions.get(sessionId);
        
        if (session) {
            // Add build to session
            session.builds.push(buildName);
            
            // Update embed with new build count
            const buildsList = session.builds.length > 0 ? session.builds.map((build, index) => `${index + 1}. ${build}`).join('\n') : 'No builds added yet';
            
            const embed = new EmbedBuilder()
                .setTitle('💚🎭 Add Builds to Comp')
                .addFields(
                    { name: 'Comp', value: session.compName, inline: false },
                    { name: 'Content Type', value: session.contentType, inline: false },
                    { name: `Current Builds (${session.builds.length}/20)`, value: buildsList, inline: false },
                    { 
                        name: 'Instructions', 
                        value: '• Click "✏️ Add Build" to manually type a build name\n• You can type any build name\n• You can add the same build multiple times for variations\n• Builds will be added in the order you enter them',
                        inline: false 
                    }
                )
                .setColor('#0099ff')
                .setFooter({ text: 'Phoenix Assistance Bot • Type build names manually • Today at 1:41 PM' })
                .setTimestamp();

            // Create buttons with session ID
            const addBuildButton = new ButtonBuilder()
                .setCustomId(`add_build_${sessionId}`)
                .setLabel('Add Build')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️');

            const createCompButton = new ButtonBuilder()
                .setCustomId(`create_comp_${sessionId}`)
                .setLabel('Create Comp')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

            const cancelButton = new ButtonBuilder()
                .setCustomId(`cancel_comp_${sessionId}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');

            const row = new ActionRowBuilder().addComponents(addBuildButton, createCompButton, cancelButton);

            await interaction.update({ 
                embeds: [embed], 
                components: [row]
            });
        }
    }
});

// Handle autocomplete interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isAutocomplete()) return;

    if (interaction.commandName === 'signup') {
        await handleSignupAutocomplete(interaction);
    }
});

// Update signup embed function
async function updateSignupEmbed(interaction, session) {
    try {
        // Calculate total signups
        const totalSignups = session.roles.reduce((total, role) => total + role.signups.length, 0);
        
        // Add roles list with signups
        const rolesList = session.roles.map((role, index) => {
            if (role.signups.length === 0) {
                return `${index + 1}. ${role.roleName} - No signups`;
            } else {
                const signupList = role.signups.map(signup => {
                    return `<@${signup.userId}>`;
                }).join(', ');
                return `${index + 1}. ${role.roleName} - ${signupList}`;
            }
        }).join('\n');
        
        // Create updated embed
        const embed = new EmbedBuilder()
            .setTitle(`📝 Build Signup - ${totalSignups}/${session.roles.length}`)
            .addFields(
                { name: `${session.compName} - Available Builds`, value: '', inline: false },
                { name: '💜 Available Builds', value: rolesList, inline: false }
            )
            .setColor('#E74C3C')
            .setFooter({ text: `Assistance Bot • Click buttons below to sign up • Session: ${session.sessionId} • Today at 1:52 PM` })
            .setTimestamp();
        
        // Create updated buttons
        const buttons = [];
        session.roles.forEach((role, index) => {
            const isRoleTaken = role.signups.length > 0;
            
            let buttonStyle, emoji;
            
            if (isRoleTaken) {
                // Role is taken - show lock button with muted style
                buttonStyle = ButtonStyle.Secondary;
                emoji = '🔒';
            } else {
                // Role is available - show checkmark button with muted style
                buttonStyle = ButtonStyle.Secondary;
                emoji = '✅';
            }
            
            const button = new ButtonBuilder()
                .setCustomId(`signup_${session.sessionId}_${index}`)
                .setLabel(`${index + 1}`)
                .setStyle(buttonStyle)
                .setEmoji(emoji)
                .setDisabled(false); // All buttons are enabled
            buttons.push(button);
        });
        
        // Split buttons into rows of 4
        const buttonRows = [];
        for (let i = 0; i < buttons.length; i += 4) {
            const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 4));
            buttonRows.push(row);
        }
        
        await interaction.update({ 
            embeds: [embed], 
            components: buttonRows
        });
        
    } catch (error) {
        console.error('Error updating signup embed:', error);
    }
}

// Error handling
client.on('error', console.error);
process.on('unhandledRejection', console.error);

// Login to Discord
client.login(config.botToken);
