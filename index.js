const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const config = require('./config');

// Debug logging
console.log('🔍 Debug Info:');
console.log('BOT_TOKEN exists:', !!process.env.BOT_TOKEN);
console.log('BOT_TOKEN length:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 'undefined');
console.log('BOT_TOKEN starts with:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.substring(0, 10) + '...' : 'undefined');
console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
console.log('CLIENT_ID value:', process.env.CLIENT_ID);

const User = require('./models/User');
const Composition = require('./models/Composition');
const SignupSession = require('./models/SignupSession');
const Guild = require('./models/Guild');

// Create Discord client with enhanced connection settings
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent
    ],
    // Enhanced connection settings for better stability
    rest: {
        timeout: 30000, // 30 seconds timeout
        retries: 3
    },
    // WebSocket settings
    ws: {
        large_threshold: 250,
        compress: true
    },
    // Presence settings
    presence: {
        status: 'online',
        activities: [{
            name: 'Albion Online Alliance',
            type: 0 // Playing
        }]
    }
});

// Create commands collection
client.commands = new Collection();

// Store comp creation data temporarily
const compSessions = new Map();

async function getGuildConfigByName(guildName) {
    if (!guildName) {
        return null;
    }

    const dbGuild = await Guild.findByNameCaseInsensitive(guildName);
    if (dbGuild) {
        return {
            name: dbGuild.name,
            roleId: dbGuild.roleId,
            tag: dbGuild.tag || '',
            color: dbGuild.color || config.embedColor,
            source: 'database',
            dbGuild
        };
    }

    const configGuildName = Object.keys(config.guilds || {}).find(name => name.toLowerCase() === guildName.toLowerCase());
    if (configGuildName) {
        const guildConfig = config.guilds[configGuildName];
        return {
            name: configGuildName,
            roleId: guildConfig.roleId,
            tag: guildConfig.tag || '',
            color: guildConfig.color || config.embedColor,
            source: 'config'
        };
    }

    return null;
}

async function getAllGuildChoices() {
    const dbGuilds = await Guild.find({}).sort({ name: 1 }).lean();
    const configGuilds = Object.keys(config.guilds || {});

    const names = new Set();
    dbGuilds.forEach(guild => names.add(guild.name));
    configGuilds.forEach(name => names.add(name));

    return Array.from(names).sort((a, b) => a.localeCompare(b));
}

// MongoDB Connection
mongoose.connect(config.mongoUri)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    console.log(`🔗 Bot ID: ${client.user.id}`);
    console.log(`🌐 Gateway: ${client.ws.gateway}`);
    
    // Set bot presence to show it's active
    client.user.setPresence({
        activities: [{
            name: 'Albion Online Alliance',
            type: 0 // Playing
        }],
        status: 'online'
    });
});

// Connection status monitoring
client.on('shardReady', (id) => {
    console.log(`🟢 Shard ${id} is ready`);
});

client.on('shardReconnecting', (id) => {
    console.log(`🔄 Shard ${id} is reconnecting...`);
});

client.on('shardResumed', (id) => {
    console.log(`✅ Shard ${id} resumed`);
});

client.on('shardDisconnect', (event, id) => {
    console.log(`🔴 Shard ${id} disconnected:`, event);
});

client.on('shardError', (error, id) => {
    console.error(`❌ Shard ${id} error:`, error);
});

// Handle disconnection and reconnection
client.on('disconnect', () => {
    console.log('🔌 Bot disconnected from Discord');
});

client.on('reconnecting', () => {
    console.log('🔄 Bot reconnecting to Discord...');
});

client.on('resume', () => {
    console.log('✅ Bot reconnected to Discord');
});

// Slash command interaction handler
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'register') {
            await handleRegisterCommand(interaction);
        } else if (commandName === 'lootsplit') {
            await handleLootsplitCommand(interaction);
        } else if (commandName === 'comp') {
            await handleCompCommand(interaction);
        } else if (commandName === 'signup') {
            await handleSignupCommand(interaction);
        } else if (commandName === 'add-guild') {
            await handleAddGuildCommand(interaction);
        } else if (commandName === 'remove-guild') {
            await handleRemoveGuildCommand(interaction);
        }
    }
});

// Register command handler
async function handleRegisterCommand(interaction) {
    try {
        const selectedGuild = interaction.options.getString('guild');
        const ingameName = interaction.options.getString('ingame_name').trim();
        const guildConfig = await getGuildConfigByName(selectedGuild);
        
        if (!guildConfig) {
            await interaction.reply({ 
                content: '❌ Invalid guild selection. Please try again.', 
                ephemeral: true 
            });
            return;
        }

        const guildDisplayName = guildConfig.name || selectedGuild;
        const guildRoleId = guildConfig.roleId;
        const guildTag = guildConfig.tag ? guildConfig.tag.trim() : '';
        const embedColor = guildConfig.color || config.embedColor;

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
            guild: guildDisplayName,
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
                if (guildRoleId) {
                    const role = interaction.guild.roles.cache.get(guildRoleId);
                    if (role) {
                        await member.roles.add(role);
                        roleAssigned = true;
                    } else {
                        console.warn(`Guild role with ID ${guildRoleId} not found in guild ${interaction.guild.id}`);
                    }
                } else {
                    console.warn(`Guild ${guildDisplayName} does not have a configured roleId`);
                }
            } catch (error) {
                console.error('Error assigning role:', error);
            }

            // Change nickname with guild tag
            try {
                const newNickname = guildTag ? `${guildTag} ${ingameName}` : ingameName;
                await member.setNickname(newNickname);
                nicknameChanged = true;
            } catch (error) {
                console.error('Error changing nickname:', error);
                nicknameError = guildTag
                    ? `Please manually change your nickname to: **${guildTag} ${ingameName}**`
                    : `Please manually change your nickname to: **${ingameName}**`;
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
        // Format role mention if role is missing
        let roleAssignedText = '✅ Yes';
        if (!roleAssigned && config.requiredRoleId) {
            const requiredRoleMention = `<@&${config.requiredRoleId}>`;
            roleAssignedText = `❌ No (Missing ${requiredRoleMention} role)`;
        } else if (!roleAssigned) {
            roleAssignedText = '❌ No (Missing @alliance role)';
        }
        
        const confirmEmbed = new EmbedBuilder()
            .setTitle('✅ Registration Successful!')
            .setDescription(`Welcome to ${guildDisplayName}!`)
            .setColor(embedColor)
            .addFields(
                { name: 'In-Game Name', value: ingameName, inline: true },
                { name: 'Guild', value: guildDisplayName, inline: true },
                { name: 'Role Assigned', value: roleAssignedText, inline: true },
                { name: 'Nickname Changed', value: nicknameChanged ? '✅ Yes' : '❌ No (Bot lacks permission)', inline: true }
            )
            .setTimestamp();

        // Add nickname instruction if there was an error
        if (nicknameError) {
            confirmEmbed.addFields({ name: '📝 Manual Action Required', value: nicknameError, inline: false });
        }

        await interaction.reply({ embeds: [confirmEmbed] });

    } catch (error) {
        console.error('Error in register command:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while processing your registration. Please try again later.', 
            ephemeral: true 
        });
    }
}

async function handleAddGuildCommand(interaction) {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
            content: '❌ You need the **Manage Server** permission to use this command.',
            ephemeral: true
        });
        return;
    }

    const name = interaction.options.getString('name').trim();
    const roleId = interaction.options.getString('role_id').trim();
    const tag = interaction.options.getString('tag')?.trim() || '';
    const colorInput = interaction.options.getString('color')?.trim() || '';

    if (!/^\d{17,19}$/.test(roleId)) {
        await interaction.reply({
            content: '❌ Invalid role ID. Please provide a valid Discord role ID.',
            ephemeral: true
        });
        return;
    }

    let color = colorInput;
    if (color) {
        if (!/^#?[0-9A-Fa-f]{6}$/.test(color)) {
            await interaction.reply({
                content: '❌ Invalid color format. Please provide a hex color like `#FFAA00`.',
                ephemeral: true
            });
            return;
        }
        if (!color.startsWith('#')) {
            color = `#${color}`;
        }
    } else {
        color = config.embedColor;
    }

    const existingGuild = await Guild.findByNameCaseInsensitive(name);

    let guildDoc;
    if (existingGuild) {
        existingGuild.roleId = roleId;
        existingGuild.tag = tag;
        existingGuild.color = color;
        existingGuild.updatedBy = {
            discordId: interaction.user.id,
            username: interaction.user.username
        };
        guildDoc = await existingGuild.save();
    } else {
        guildDoc = await Guild.create({
            name,
            roleId,
            tag,
            color,
            createdBy: {
                discordId: interaction.user.id,
                username: interaction.user.username
            },
            updatedBy: {
                discordId: interaction.user.id,
                username: interaction.user.username
            }
        });
    }

    const baseMessage = `• Role ID: \`${guildDoc.roleId}\`\n• Tag: \`${guildDoc.tag || 'None'}\`\n• Color: \`${guildDoc.color}\``;

    await interaction.reply({
        content: existingGuild
            ? `✅ Updated guild **${guildDoc.name}**.\n${baseMessage}`
            : `✅ Added new guild **${guildDoc.name}**.\n${baseMessage}\n\n✅ The guild is now available in /register autocomplete.`,
        ephemeral: true
    });
}

async function handleRemoveGuildCommand(interaction) {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
            content: '❌ You need the **Manage Server** permission to use this command.',
            ephemeral: true
        });
        return;
    }

    const name = interaction.options.getString('name').trim();
    const guildDoc = await Guild.findByNameCaseInsensitive(name);

    if (!guildDoc) {
        await interaction.reply({
            content: `❌ Guild **${name}** was not found in the database.`,
            ephemeral: true
        });
        return;
    }

    await guildDoc.deleteOne();

    await interaction.reply({
        content: `✅ Removed guild **${guildDoc.name}**.\n\n✅ It has been removed from /register autocomplete.`,
        ephemeral: true
    });
}
// Lootsplit command handler
async function handleLootsplitCommand(interaction) {
    try {
        const contentType = interaction.options.getString('content_type');
        const usersInput = interaction.options.getString('users');
        const callerInput = interaction.options.getString('caller');
        const repairFees = interaction.options.getInteger('repair_fees');
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
        const userIds = [];
        let match;
        
        while ((match = mentionRegex.exec(usersInput)) !== null) {
            userIds.push(match[1]);
        }

        if (userIds.length === 0) {
            await interaction.reply({ 
                content: '❌ Please mention the users participating in the loot split.',
                flags: 64 // Ephemeral flag
            });
            return;
        }

        // Parse caller from the caller input string
        if (!callerInput) {
            await interaction.reply({ 
                content: '❌ This command has been updated. Please use the new format: `/lootsplit content_type users caller total_loot`\n\n**New format:**\n- `content_type`: Type of content\n- `users`: Mention participating users\n- `caller`: Mention the caller\n- `total_loot`: Total loot value\n\nPlease try the command again with the updated format.',
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        const callerMatch = callerInput.match(/<@!?(\d+)>/);
        if (!callerMatch) {
            await interaction.reply({ 
                content: '❌ Please mention the caller user.',
                flags: 64 // Ephemeral flag
            });
            return;
        }
        const callerId = callerMatch[1];

        // Fetch the mentioned users
        const mentionedUsers = new Map();
        for (const userId of userIds) {
            try {
                const user = await client.users.fetch(userId);
                mentionedUsers.set(userId, user);
            } catch (error) {
                console.error(`Error fetching user ${userId}:`, error);
            }
        }

        // Fetch caller
        let caller;
        try {
            caller = await client.users.fetch(callerId);
        } catch (error) {
            console.error(`Error fetching caller ${callerId}:`, error);
            await interaction.reply({ 
                content: '❌ Error fetching caller user.',
                flags: 64 // Ephemeral flag
            });
            return;
        }

        // Automatically add caller to participants if not already present
        const callerAlreadyInParticipants = userIds.includes(callerId);
        if (!callerAlreadyInParticipants) {
            // Add caller to the participants list
            userIds.push(callerId);
            mentionedUsers.set(callerId, caller);
        }

        // Check if all mentioned users (including potentially added caller) are registered
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

        // Check if caller is registered
        const callerData = await User.findOne({ discordId: callerId });
        if (!callerData) {
            await interaction.reply({ 
                content: `❌ The caller ${caller} needs to register first.\n\nPlease use \`/register\` to register before participating in loot splits.`,
                flags: 64 // Ephemeral flag
            });
            return;
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

        // Calculate loot split (repair fees subtracted first, then caller fee, no guild tax)
        const lootAfterRepairFees = totalLoot - repairFees;
        const callerFeeRate = config.callerFeeRate;
        const callerFee = Math.floor(lootAfterRepairFees * callerFeeRate);
        const lootAfterCallerFee = lootAfterRepairFees - callerFee;
        const lootPerPerson = Math.floor(lootAfterCallerFee / registeredUsers.length);

        // Group users by guild for per-guild totals
        const guildTotals = {};
        const guildPlayerCounts = {};
        
        // Count players per guild
        registeredUsers.forEach(user => {
            if (!guildPlayerCounts[user.guild]) {
                guildPlayerCounts[user.guild] = 0;
            }
            guildPlayerCounts[user.guild]++;
        });
        
        // Calculate per-guild totals (player payouts + caller fee if caller is from that guild)
        Object.entries(guildPlayerCounts).forEach(([guild, playerCount]) => {
            const totalPerGuild = lootPerPerson * playerCount;
            // Add caller fee to the caller's guild
            if (guild === callerData.guild) {
                guildTotals[guild] = totalPerGuild + callerFee;
            } else {
                guildTotals[guild] = totalPerGuild;
            }
        });

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle(`💰 Loot Split - ${contentType}`)
            .setColor(contentConfig.color)
            .addFields(
                { name: '📊 Summary', value: `**Total Loot:** ${totalLoot.toLocaleString()} silver\n**Repair Fees:** ${repairFees.toLocaleString()} silver\n**After Repairs:** ${lootAfterRepairFees.toLocaleString()} silver\n**Caller Fee (${(callerFeeRate * 100).toFixed(1)}%):** ${callerFee.toLocaleString()} silver\n**Per Person:** ${lootPerPerson.toLocaleString()} silver`, inline: false },
                { name: '📢 Caller', value: `${caller} - ${callerData.guild}`, inline: false }
            )
            .setTimestamp();

        // Add players list grouped by guild
        const playersByGuild = {};
        registeredUsers.forEach(user => {
            if (!playersByGuild[user.guild]) {
                playersByGuild[user.guild] = [];
            }
            playersByGuild[user.guild].push(user.user.id);
        });

        const sortedGuilds = Object.keys(playersByGuild).sort();

        let participantsContent = '';
        for (const guild of sortedGuilds) {
            const memberIds = playersByGuild[guild];
            participantsContent += `**${guild} (${memberIds.length})**\n`;
            participantsContent += memberIds.map(id => `<@${id}>`).join(', ') + '\n\n';
        }

        // Chunking logic for the new format
        const lines = participantsContent.split('\n');
        let currentField = '';
        let fieldCount = 1;

        for (const line of lines) {
            // Check if adding this line would exceed the limit
            if (currentField.length + line.length + 1 >= 1000) {
                embed.addFields({ name: `👥 Participants ${fieldCount > 1 ? `(${fieldCount})` : ''}`, value: currentField, inline: false });
                currentField = line;
                fieldCount++;
            } else {
                currentField = currentField ? `${currentField}\n${line}` : line;
            }
        }
        
        // Add the last field
        if (currentField) {
            embed.addFields({ name: `👥 Participants ${fieldCount > 1 ? `(${fieldCount})` : ''}`, value: currentField, inline: false });
        }

        // Add per guild totals
        const perGuildTotals = Object.entries(guildTotals)
            .map(([guild, total]) => `**${guild}:** ${total.toLocaleString()} silver (${guildPlayerCounts[guild]} players)`)
            .join('\n');

        embed.addFields({ name: '🏛️ Guild Breakdown', value: perGuildTotals, inline: false });

        // Reply to interaction first (must be within 3 seconds)
        await interaction.reply({ embeds: [embed] });

        // Send split to Phoenix Assistance for tax/balance handling (webhook) - do this after reply
        // Only send Phoenix Rebels members to Phoenix, filter out other guilds
        if (config.phoenixWebhookUrl && config.phoenixWebhookSecret) {
            // Run webhook in background (don't await to avoid blocking)
            (async () => {
                try {
                    const targetGuildId = config.phoenixTargetGuildId || interaction.guildId;
                    
                    // Filter to only Phoenix Rebels members - exclude other guilds even if registered in Phoenix
                    const phoenixRebelsUsers = registeredUsers.filter(user => user.guild === 'Phoenix Rebels');
                    const phoenixRebelsUserIds = phoenixRebelsUsers.map(user => user.user.id);
                    
                    // Only send if there are Phoenix Rebels members
                    if (phoenixRebelsUserIds.length > 0) {
                        // Calculate Phoenix Rebels portion of the original loot (before repairs/caller fee)
                        // User Request: "If phoenix is 10 people then 1,187,500*10 + (caller fee) is sent to albion assistance"
                        // 1,187,500 is the Net Per Person share (after repairs and caller fee).
                        // So Phoenix Base Share = NetPerPerson * PhoenixCount.
                        // And we add the Caller Fee ON TOP of that if the caller is Phoenix.
                        
                        // Let's recalculate based on the Alliance logic:
                        // lootAfterRepairFees = totalLoot - repairFees
                        // callerFee = lootAfterRepairFees * rate
                        // lootAfterCallerFee = lootAfterRepairFees - callerFee
                        // lootPerPerson = lootAfterCallerFee / totalParticipants
                        
                        // Phoenix Share = (lootPerPerson * phoenixCount)
                        // If Caller is Phoenix, we ADD the callerFee to the payload total so Phoenix Assistance can strip it out later.
                        
                        let phoenixTotalLoot = Math.floor(lootPerPerson * phoenixRebelsUserIds.length);
                        
                        // If caller is in Phoenix, add the caller fee to the bundle
                        if (callerData && callerData.guild === 'Phoenix Rebels') {
                            phoenixTotalLoot += callerFee;
                        }

                        // Send actual callerId - Phoenix will only credit caller fee if caller is Phoenix Rebels
                        const res = await fetch(config.phoenixWebhookUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Webhook-Secret': config.phoenixWebhookSecret
                            },
                            body: JSON.stringify({
                                guildId: targetGuildId,
                                contentType,
                                totalLoot: phoenixTotalLoot, // Calculated as (Split * Count) + CallerFee
                                repairFees: repairFees, // Send FULL repair fees as requested for tax deduction logic
                                explicitCallerFee: callerFee, // The exact fee amount
                                callerFeeRate,
                                callerId, 
                                participants: phoenixRebelsUserIds 
                            })
                        });
                        
                        if (!res.ok) {
                            const text = await res.text();
                            console.error('Phoenix ingest failed', res.status, text);
                        } else {
                            console.log(`Phoenix ingest ok - credited ${phoenixRebelsUserIds.length} Phoenix Rebels members`);
                        }
                    } else {
                        console.log('No Phoenix Rebels members in split; skipping Phoenix webhook');
                    }
                } catch (error) {
                    console.error('Failed to send split to Phoenix:', error);
                }
            })();
        } else {
            console.warn('Phoenix webhook not configured; skipping outbound split');
        }

    } catch (error) {
        console.error('Error in lootsplit command:', error);
        try {
            // Check if interaction was already replied to
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: '❌ An error occurred while calculating the loot split. Please try again later.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({ 
                    content: '❌ An error occurred while calculating the loot split. Please try again later.',
                    flags: 64 // Ephemeral flag
                });
            }
        } catch (replyError) {
            // If interaction expired or already responded, just log it
            console.error('Failed to send error message to user:', replyError);
        }
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
        const compName = interaction.options.getString('comp');

        if (!compName) {
            await interaction.reply({
                content: '❌ Please pick a comp, e.g. `/comp list comp:<your comp>`',
                flags: 64
            });
            return;
        }

        const comp = await Composition.findOne({ name: compName });
        if (!comp) {
            await interaction.reply({
                content: `❌ Comp "${compName}" not found.`,
                flags: 64
            });
            return;
        }

        const rolesList = (comp.roles && comp.roles.length > 0)
            ? comp.roles.map((role, index) => `${index + 1}. ${role}`).join('\n')
            : 'No builds saved for this comp.';

        const embed = new EmbedBuilder()
            .setTitle(`📋 ${comp.name}`)
            .addFields({ name: 'Available Builds', value: rolesList })
            .setColor('#0099ff')
            .setTimestamp();

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
    } else if (interaction.commandName === 'comp') {
        // Reuse same autocomplete for comp list subcommand
        await handleSignupAutocomplete(interaction);
    } else if (interaction.commandName === 'register') {
        await handleGuildAutocomplete(interaction);
    } else if (interaction.commandName === 'remove-guild') {
        await handleGuildAutocomplete(interaction);
    }
});

async function handleGuildAutocomplete(interaction) {
    try {
        const focusedValue = interaction.options.getFocused(true)?.value || '';
        const allGuilds = await getAllGuildChoices();
        const filtered = allGuilds
            .filter(name => name.toLowerCase().includes(focusedValue.toLowerCase()))
            .slice(0, 25);

        if (filtered.length === 0) {
            await interaction.respond([{
                name: 'No guilds found. Add one with /add-guild',
                value: focusedValue || 'no-guilds-found'
            }]);
            return;
        }

        await interaction.respond(filtered.map(name => ({
            name,
            value: name
        })));
    } catch (error) {
        console.error('Error in guild autocomplete:', error);
        await interaction.respond([{
            name: 'Error loading guilds',
            value: 'error-loading'
        }]);
    }
}

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





// Enhanced error handling and memory management
client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
    // Don't exit the process, let Discord.js handle reconnection
});

client.on('warn', (warning) => {
    console.warn('⚠️ Discord Client Warning:', warning);
});

// Handle rate limits
client.on('rateLimit', (rateLimitData) => {
    console.warn('⏱️ Rate limited:', rateLimitData);
});

// Handle invalid session
client.on('invalidSession', () => {
    console.log('🔄 Invalid session, reconnecting...');
});

// Connection monitoring and auto-reconnect
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let reconnectTimeout;

const attemptReconnect = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached. Bot will not reconnect automatically.');
        return;
    }
    
    reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
    
    // Clear any existing timeout
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }
    
    // Attempt to reconnect after a delay
    reconnectTimeout = setTimeout(() => {
        if (!client.isReady()) {
            console.log('🔄 Forcing reconnection...');
            client.destroy().then(() => {
                client.login(config.botToken).catch(error => {
                    console.error('❌ Reconnection failed:', error);
                    attemptReconnect(); // Try again
                });
            });
        }
    }, 5000 * reconnectAttempts); // Exponential backoff
};

// Monitor connection status
setInterval(() => {
    if (!client.isReady()) {
        console.log('⚠️ Bot is not ready, attempting reconnection...');
        attemptReconnect();
    } else {
        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;
    }
}, 30000); // Check every 30 seconds

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Don't exit the process, just log the error
});

// Memory usage monitoring and connection health checks
setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
    };
    
    // Log memory usage and connection status every 10 minutes
    console.log('📊 Memory Usage (MB):', memUsageMB);
    console.log('🔗 Discord Status:', client.isReady() ? 'Connected' : 'Disconnected');
    console.log('⏱️ Uptime:', Math.round(process.uptime() / 60), 'minutes');
    
    // Force garbage collection if memory usage is high
    if (memUsageMB.heapUsed > 150) { // More than 150MB
        if (global.gc) {
            global.gc();
            console.log('🗑️ Garbage collection triggered');
        }
    }
    
    // Check if bot is still connected to Discord
    if (!client.isReady()) {
        console.log('⚠️ Bot appears disconnected, attempting reconnection...');
        attemptReconnect();
    }
}, 10 * 60 * 1000); // Every 10 minutes

// Additional health check for Discord connection
setInterval(() => {
    if (client.isReady()) {
        // Update presence to show bot is active
        client.user.setPresence({
            activities: [{
                name: `Albion Online Alliance | ${client.guilds.cache.size} servers`,
                type: 0 // Playing
            }],
            status: 'online'
        });
    }
}, 5 * 60 * 1000); // Every 5 minutes

// Create a robust HTTP server for Render with health checks
const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    
    // Set CORS headers for monitoring services
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (path === '/health' || path === '/ping' || path === '/') {
        // Health check endpoint for monitoring services
        const memUsage = process.memoryUsage();
        const healthData = {
            status: client.isReady() ? 'online' : 'offline',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
                external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
            },
            discord: {
                status: client.isReady() ? 'connected' : 'disconnected',
                guilds: client.guilds?.cache?.size || 0,
                ping: client.ws?.ping || 'N/A',
                gateway: client.ws?.gateway || 'N/A'
            },
            reconnectAttempts: reconnectAttempts,
            version: process.version,
            platform: process.platform
        };
        
        const statusCode = client.isReady() ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthData, null, 2));
    } else if (path === '/status') {
        // Simple status endpoint
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Discord Bot is running!');
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 HTTP server running on port ${PORT}`);
    console.log(`🏥 Health check available at: http://localhost:${PORT}/health`);
    console.log(`📊 Status endpoint: http://localhost:${PORT}/status`);
});

// Self-pinging mechanism to keep bot alive on Render
let selfPingInterval;
const startSelfPing = () => {
    const pingUrl = `http://localhost:${PORT}/health`;
    
    selfPingInterval = setInterval(async () => {
        try {
            const response = await fetch(pingUrl);
            if (response.ok) {
                console.log('🔄 Self-ping successful - Bot is alive');
            } else {
                console.log('⚠️ Self-ping failed - Response not OK');
            }
        } catch (error) {
            console.error('❌ Self-ping error:', error.message);
        }
    }, 5 * 60 * 1000); // Ping every 5 minutes
    
    console.log('🔄 Self-ping mechanism started (every 5 minutes)');
};

// Start self-ping after server is ready
server.on('listening', () => {
    startSelfPing();
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`🛑 Received ${signal}, shutting down gracefully...`);
    
    // Clear all intervals
    if (selfPingInterval) {
        clearInterval(selfPingInterval);
    }
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }
    
    // Destroy Discord client
    if (client.isReady()) {
        client.destroy();
        console.log('✅ Discord client destroyed');
    }
    
    // Close HTTP server
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
        console.log('⚠️ Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Login to Discord with retry logic
const loginWithRetry = async (retries = 3) => {
    // Validate token before attempting login
    if (!config.botToken || config.botToken.trim().length === 0) {
        console.error('❌ BOT_TOKEN is missing or empty!');
        console.error('Please set BOT_TOKEN in your Render environment variables.');
        console.error('Go to your Render dashboard > Environment > Add BOT_TOKEN');
        process.exit(1);
    }

    // Basic token format validation (Discord bot tokens typically start with specific patterns)
    if (config.botToken.length < 50) {
        console.error('❌ BOT_TOKEN appears to be invalid (too short).');
        console.error('Discord bot tokens are typically 59+ characters long.');
        console.error('Please verify your BOT_TOKEN in Render environment variables.');
        process.exit(1);
    }

    try {
        console.log('🔑 Attempting to login with token:', config.botToken ? config.botToken.substring(0, 10) + '...' : 'undefined');
        console.log('📏 Token length:', config.botToken.length);
        await client.login(config.botToken);
        console.log('✅ Successfully logged in to Discord');
    } catch (error) {
        console.error('❌ Login failed:', error.message);
        
        // Provide helpful error messages
        if (error.message.includes('invalid token') || error.message.includes('401')) {
            console.error('💡 Troubleshooting tips:');
            console.error('   1. Verify your BOT_TOKEN in Render dashboard > Environment');
            console.error('   2. Make sure there are no extra spaces or quotes around the token');
            console.error('   3. Check if the token was regenerated - you may need a new one');
            console.error('   4. Go to https://discord.com/developers/applications to get a fresh token');
        }
        
        if (retries > 0) {
            console.log(`🔄 Retrying login in 5 seconds... (${retries} attempts left)`);
            setTimeout(() => {
                loginWithRetry(retries - 1);
            }, 5000);
        } else {
            console.error('❌ Max login attempts reached. Exiting...');
            process.exit(1);
        }
    }
};

// Start the bot
loginWithRetry();

