const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    EmbedBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    ButtonStyle,
    AttachmentBuilder,
    StringSelectMenuBuilder,
    Events
} = require('discord.js');
const { createTranscript: generateTranscript } = require('discord-html-transcripts');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Import all panel modules
const panelModules = {
    joinTeam: require('./panels/jointeampanel'),
    support: require('./panels/supportpanel'),
    hr: require('./panels/hrpanel'),
    partnership: require('./panels/partnershippanel'),
    bookUs: require('./panels/bookuspanel'),
    founders: require('./panels/founderpanel')
};

// File path for ticket persistence
const TICKETS_FILE = path.join(__dirname, 'active_tickets.json');

// Load active tickets from file
function loadActiveTickets() {
    if (fs.existsSync(TICKETS_FILE)) {
        try {
            const data = fs.readFileSync(TICKETS_FILE, 'utf8');
            const tickets = JSON.parse(data);
            const ticketsMap = new Map();
            Object.entries(tickets).forEach(([key, value]) => {
                if (!value.channelId) value.channelId = key;
                if (value.createdAt) value.createdAt = new Date(value.createdAt);
                if (value.closedAt) value.closedAt = new Date(value.closedAt);
                if (value.reopenedAt) value.reopenedAt = new Date(value.reopenedAt);
                ticketsMap.set(key, value);
            });
            console.log(`Loaded ${ticketsMap.size} tickets from persistence file`);
            return ticketsMap;
        } catch (error) {
            console.error('Error loading active tickets:', error);
            return new Map();
        }
    } else {
        console.log('No active_tickets.json file found. Starting with empty tickets.');
        return new Map();
    }
}

// Save active tickets with queue to prevent race conditions
const saveQueue = [];
let isSaving = false;

function saveActiveTickets(tickets) {
    return new Promise((resolve, reject) => {
        saveQueue.push({ tickets: new Map(tickets), resolve, reject });
        
        if (!isSaving) {
            processNextSave();
        }
    });
}

async function processNextSave() {
    if (saveQueue.length === 0) {
        isSaving = false;
        return;
    }
    
    isSaving = true;
    const { tickets, resolve, reject } = saveQueue.shift();
    
    try {
        const ticketsObj = {};
        tickets.forEach((value, key) => {
            ticketsObj[key] = value;
        });
        
        await fs.promises.writeFile(TICKETS_FILE, JSON.stringify(ticketsObj, null, 2));
        resolve();
    } catch (error) {
        console.error('Error saving active tickets:', error);
        reject(error);
    } finally {
        // Process the next save operation in the queue
        setTimeout(processNextSave, 10);
    }
}

const activeTickets = loadActiveTickets();
const buttonToPanel = {};

// Helper for safe interaction replies
async function safeReply(interaction, options, isEdit = false) {
    try {
        if (isEdit) {
            return await interaction.editReply(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (error) {
        console.error(`Error ${isEdit ? 'editing' : 'sending'} reply:`, error);
        return null;
    }
}

// Safely handle interactions to prevent unknown interaction errors
async function safeInteractionHandler(interaction, handler) {
    try {
        await handler(interaction);
    } catch (error) {
        console.error(`Error handling ${interaction.type} interaction:`, error);
        
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({ 
                    content: 'An error occurred while processing your request.',
                    ephemeral: true
                }).catch(() => {});
            } catch (replyError) {
                // Silent fail - interaction may have expired
            }
        }
    }
}

// Sanitize channel names for Discord's requirements
function sanitizeChannelName(name) {
    return name.toLowerCase()
        .replace(/[^\w\s-]/g, '')  // Remove special chars
        .replace(/\s+/g, '-')      // Replace spaces with dashes
        .replace(/-+/g, '-')       // Replace multiple dashes with a single dash
        .substring(0, 90);         // Trim to a reasonable length
}

function formatDateUTC(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getUnixTimestamp() {
    return Math.floor(Date.now() / 1000);
}

// Create standardized ticket control buttons
function createTicketControlsRow(includeDelete = true) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji(config.emojis?.close || '🔒')
        );
        
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_transcript')
            .setLabel('Save Transcript')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📑')
    );
    
    if (includeDelete) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_delete')
                .setLabel('Delete Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji(config.emojis?.delete || '🗑️')
        );
    }
    
    return row;
}

// Memory optimization - ensure tickets are loaded when needed
let ticketsLoaded = false;

function ensureTicketsLoaded() {
    if (!ticketsLoaded) {
        const loadedTickets = loadActiveTickets();
        activeTickets.clear();
        loadedTickets.forEach((value, key) => {
            activeTickets.set(key, value);
        });
        ticketsLoaded = true;
        console.log(`Loaded ${activeTickets.size} tickets on demand`);
    }
}

function setupTicketSystem(client) {
    Object.values(panelModules).forEach(panel => {
        buttonToPanel[panel.buttonId] = panel;
    });

    client.once('ready', async () => {
        console.log(`Bot is ready. Current date (UTC): ${formatDateUTC(new Date())}`);
        let removedCount = 0;
        for (const [channelId, ticketData] of activeTickets.entries()) {
            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                console.log(`Removing ticket for non-existent channel: ${channelId}`);
                activeTickets.delete(channelId);
                removedCount++;
            } else {
                console.log(`Found valid ticket channel: ${channel.name} (${channelId})`);
            }
        }
        saveActiveTickets(activeTickets);
        console.log(`Loaded ${activeTickets.size} active tickets (removed ${removedCount} invalid entries)`);
    });

    // Main interaction handler with improved error handling
    client.on(Events.InteractionCreate, (interaction) => {
        safeInteractionHandler(interaction, async (interaction) => {
            // --- PANEL SETUP COMMANDS ---
            if (interaction.isCommand() || interaction.isChatInputCommand()) {
                const commandName = interaction.commandName;

                if (commandName === 'setup-jointeam') {
                    if (!panelModules.joinTeam) {
                        return await safeReply(interaction, { content: 'Join Team panel module not found!', ephemeral: true });
                    }
                    await panelModules.joinTeam.sendPanel(interaction.channel);
                    return await safeReply(interaction, { content: 'Join Team panel has been set up!', ephemeral: true });
                } else if (commandName === 'setup-bookus') {
                    if (!panelModules.bookUs) {
                        return await safeReply(interaction, { content: 'Book Us panel module not found!', ephemeral: true });
                    }
                    await panelModules.bookUs.sendPanel(interaction.channel);
                    return await safeReply(interaction, { content: 'Book Us panel has been set up!', ephemeral: true });
                } else if (commandName === 'setup-support') {
                    if (!panelModules.support) {
                        return await safeReply(interaction, { content: 'Support panel module not found!', ephemeral: true });
                    }
                    await panelModules.support.sendPanel(interaction.channel);
                    return await safeReply(interaction, { content: 'Support panel has been set up!', ephemeral: true });
                } else if (commandName === 'setup-partnership') {
                    if (!panelModules.partnership) {
                        return await safeReply(interaction, { content: 'Partnership panel module not found!', ephemeral: true });
                    }
                    await panelModules.partnership.sendPanel(interaction.channel);
                    return await safeReply(interaction, { content: 'Partnership panel has been set up!', ephemeral: true });
                } else if (commandName === 'setup-founders') {
                    if (!panelModules.founders) {
                        return await safeReply(interaction, { content: 'Founders panel module not found!', ephemeral: true });
                    }
                    await panelModules.founders.sendPanel(interaction.channel);
                    return await safeReply(interaction, { content: 'Founders panel has been set up!', ephemeral: true });
                } else if (commandName === 'setup-hr') {
                    if (!panelModules.hr) {
                        return await safeReply(interaction, { content: 'HR panel module not found!', ephemeral: true });
                    }
                    await panelModules.hr.sendPanel(interaction.channel);
                    return await safeReply(interaction, { content: 'HR panel has been set up!', ephemeral: true });
                } else if (commandName === 'register-ticket') {
                    await registerExistingTicket(interaction);
                    return;
                } else if (commandName === 'debug-tickets') {
                    await debugTickets(interaction);
                    return;
                }

                // Handle regular dynamically loaded commands
                const command = interaction.client.commands.get(commandName);
                if (!command) {
                    return await safeReply(interaction, { content: 'Command not found!', ephemeral: true });
                }

                console.log(`[COMMAND] ${commandName} executed by ${interaction.user.tag} (${interaction.user.id})`);
                await command.execute(interaction);
                return;
            }

            // --- BUTTON INTERACTIONS ---
            if (interaction.isButton()) {
                const { customId } = interaction;

                // Handle panel button clicks
                if (buttonToPanel[customId]) {
                    await interaction.showModal(buttonToPanel[customId].createModal());
                    return;
                }

                // Handle ticket management buttons
                if (
                    customId === 'ticket_close' || 
                    customId === 'ticket_delete' || 
                    customId === 'ticket_reopen' || 
                    customId === 'ticket_transcript'
                ) {
                    ensureTicketsLoaded(); // Ensure tickets are loaded
                    
                    if (!activeTickets.has(interaction.channel.id)) {
                        await safeReply(interaction, {
                            content: 'This channel is not set up as a ticket. If this is an error, please contact an administrator.',
                            ephemeral: true
                        });
                        return;
                    }
                    // --- STAFF CHECK for sensitive actions ---
                    if (
                        customId === 'ticket_close' ||
                        customId === 'ticket_delete' ||
                        customId === 'ticket_reopen'
                    ) {
                        // Only staff or admins may proceed
                        const ticketData = activeTickets.get(interaction.channel.id);
                        const staffRoleIds = getTicketRoles(ticketData.type);
                        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
                            staffRoleIds.some(roleId => interaction.member.roles.cache.has(roleId));
                        if (!isStaff) {
                            await safeReply(interaction, {
                                content: "Only staff members can close, delete, or reopen tickets.",
                                ephemeral: true
                            });
                            return;
                        }
                    }

                    if (customId === 'ticket_close') await closeTicket(interaction);
                    if (customId === 'ticket_delete') await deleteTicket(interaction);
                    if (customId === 'ticket_reopen') await reopenTicket(interaction);
                    if (customId === 'ticket_transcript') await createTranscript(interaction);
                    return;
                }

                // Handle ticket close confirmation
                if (customId === 'ticket_close_confirm') {
                    await closeTicketConfirmed(interaction);
                    return;
                }
                if (customId === 'ticket_close_cancel') {
                    await closeTicketCancelled(interaction);
                    return;
                }

                // Handle ticket creation buttons
                if (customId.startsWith('ticket_create_')) {
                    const ticketType = customId.split('_')[2];
                    await createTicket(interaction, ticketType);
                    return;
                }

                // --- ACCEPT/DECLINE EVENT BUTTONS ---
                if (customId === 'event_accept' || customId === 'event_decline') {
                    ensureTicketsLoaded(); // Ensure tickets are loaded
                    
                    // Get ticket creator from activeTickets
                    let ticketCreatorId = null;
                    const ticketData = activeTickets.get(interaction.channel.id);
                    if (ticketData && ticketData.userId) {
                        ticketCreatorId = ticketData.userId;
                    }

                    // Fallback to button clicker if not found (shouldn't happen)
                    if (!ticketCreatorId) ticketCreatorId = interaction.user.id;

                    if (customId === 'event_accept') {
                        const acceptedEmbed = new EmbedBuilder()
                            .setTitle('Real Ops Request Accepted')
                            .setDescription(`Hello <@${ticketCreatorId}>,\n\nThank you for requesting our services at your event. Your request has been **accepted** and forwarded to our planning department.\n\nWe will contact you again before finalizing documents. Please be patient.`)
                            .setImage('https://i.postimg.cc/J0v07zL4/Accepted-event.png')
                            .setColor('#00b894')
                            .setFooter({ text: `The RealOps Group`, iconURL: 'https://i.ibb.co/FMYFdhk/real-ops-group-logo.png' })
                            .setThumbnail('https://i.ibb.co/FMYFdhk/real-ops-group-logo.png');

                        try {
                            await interaction.update({
                                embeds: interaction.message.embeds,
                                components: [],
                            });

                            await interaction.followUp({
                                content: `✅ <@${ticketCreatorId}>`,
                                embeds: [acceptedEmbed],
                                ephemeral: false
                            });
                        } catch (error) {
                            console.error('Error handling event accept:', error);
                            // Try to send a new message if update fails
                            await interaction.channel.send({
                                content: `✅ <@${ticketCreatorId}>`,
                                embeds: [acceptedEmbed]
                            }).catch(console.error);
                        }
                        return;
                    }

                    if (customId === 'event_decline') {
                        try {
                            // Show reason dropdown
                            const reasonSelect = new StringSelectMenuBuilder()
                                .setCustomId('decline_reason_select')
                                .setPlaceholder('Select a reason for declining')
                                .addOptions([
                                    {
                                        label: 'Fully booked for that month',
                                        value: 'full_month'
                                    },
                                    {
                                        label: 'We are not available on this date',
                                        value: 'not_available'
                                    },
                                    {
                                        label: 'Requirements not met',
                                        description: 'You do not meet the requirements for Real Ops at your event',
                                        value: 'not_requirements'
                                    },
                                    {
                                        label: 'Partners event on this date',
                                        value: 'partner_event'
                                    },
                                    {
                                        label: 'Less than 4 weeks from now',
                                        value: 'short_notice'
                                    }
                                ]);

                            const actionRow = new ActionRowBuilder().addComponents(reasonSelect);

                            await safeReply(interaction, {
                                content: 'Please select the reason for declining this event booking:',
                                components: [actionRow],
                                ephemeral: true
                            });
                        } catch (error) {
                            console.error('Error showing decline reasons:', error);
                        }
                        return;
                    }
                }
            }

            // --- REASON SELECTED FROM DROPDOWN ---
            if (interaction.isStringSelectMenu() && interaction.customId === 'decline_reason_select') {
                ensureTicketsLoaded(); // Ensure tickets are loaded
                
                // Get ticket creator from activeTickets
                let ticketCreatorId = null;
                const ticketData = activeTickets.get(interaction.channel.id);
                if (ticketData && ticketData.userId) {
                    ticketCreatorId = ticketData.userId;
                }
                // Fallback to selector if not found (shouldn't happen)
                if (!ticketCreatorId) ticketCreatorId = interaction.user.id;

                const selected = interaction.values[0];
                let reasonText = '';
                switch (selected) {
                    case 'full_month':
                        reasonText = 'We are fully booked for that month.';
                        break;
                    case 'not_available':
                        reasonText = 'We are not available on this date.';
                        break;
                    case 'not_requirements':
                        reasonText = 'You do not meet the requirements to secure Real Ops at your event.';
                        break;
                    case 'partner_event':
                        reasonText = "We have a partner's event scheduled on this date.";
                        break;
                    case 'short_notice':
                        reasonText = 'The event is scheduled less than 4 weeks from the date of this ticket.';
                        break;
                    default:
                        reasonText = 'No specific reason provided.';
                }

                try {
                    const declinedEmbed = new EmbedBuilder()
                        .setTitle('Real Ops Request Declined')
                        .setDescription(`Hello <@${ticketCreatorId}>,\n\nThank you for requesting our services. Unfortunately, we have **declined** your request for the following reason:\n\n• ${reasonText}\n\nWe encourage you to consider us again in the future.`)
                        .setImage('https://i.imgur.com/K51VLvn.png')
                        .setColor('#e74c3c')
                        .setFooter({ text: `Posted by Bharat27-d • 2025-07-06 18:09:29`, iconURL: 'https://i.ibb.co/FMYFdhk/real-ops-group-logo.png' })
                        .setThumbnail('https://i.ibb.co/FMYFdhk/real-ops-group-logo.png');

                    // Public message to channel
                    await interaction.message.channel.send({
                        content: `❌ <@${ticketCreatorId}>, your event booking has been **declined**.`,
                        embeds: [declinedEmbed]
                    });

                    // Private confirmation to selector
                    await interaction.update({
                        content: '✅ Decline reason has been posted in the channel.',
                        components: [],
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Error processing decline reason:', error);
                    try {
                        // Try to send just the message if updating the interaction fails
                        await interaction.message.channel.send({
                            content: `❌ <@${ticketCreatorId}>, your event booking has been **declined** due to: ${reasonText}`
                        });
                    } catch (err) {
                        console.error('Failed to send decline fallback message:', err);
                    }
                }
                return;
            }

            // --- MODAL SUBMISSIONS ---
            if (interaction.isModalSubmit()) {
                const { customId } = interaction;
                const panelModule = Object.values(panelModules).find(panel => panel.modalId === customId);
                if (panelModule) {
                    try {
                        if (!interaction.deferred && !interaction.replied) {
                            await interaction.deferReply({ ephemeral: true });
                        }
                        
                        const submittedData = panelModule.processSubmittedData(interaction);
                        await createTicketWithFormData(interaction, panelModule.ticketType, submittedData, panelModule);
                    } catch (error) {
                        console.error('Error handling modal submission:', error);
                        await safeReply(interaction, { 
                            content: 'An error occurred while processing your submission. Please try again later.'
                        }, true);
                    }
                }
            }
        });
    });
    console.log('Ticket system initialized');
}

/**
 * Register an existing channel as a ticket
 * Usage: /register-ticket @user type:support
 */
async function registerExistingTicket(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return safeReply(interaction, {
            content: 'You need administrator permissions to register tickets.',
            ephemeral: true
        });
    }
    
    try {
        await interaction.deferReply({ ephemeral: true });
    } catch (error) {
        console.error('Error deferring reply for register-ticket:', error);
        return;
    }
    
    try {
        ensureTicketsLoaded(); // Ensure tickets are loaded
        
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const targetUser = interaction.options.getUser('user');
        const ticketType = interaction.options.getString('type');
        
        // Validate ticket type
        if (!['support', 'joinTeam', 'bookUs', 'partnership', 'founders', 'hr'].includes(ticketType)) {
            return safeReply(interaction, {
                content: 'Invalid ticket type. Valid types: support, joinTeam, bookUs, partnership, founders, hr',
                ephemeral: true
            }, true);
        }
        
        // Check if channel is already registered
        if (activeTickets.has(channel.id)) {
            return safeReply(interaction, {
                content: `This channel is already registered as a ${formatTicketType(activeTickets.get(channel.id).type)} ticket.`,
                ephemeral: true
            }, true);
        }
        
        // Register the channel as a ticket
        activeTickets.set(channel.id, {
            channelId: channel.id,
            userId: targetUser.id,
            type: ticketType,
            createdAt: new Date(),
            manuallyRegistered: true
        });
        
        // Save active tickets to file
        await saveActiveTickets(activeTickets);
        
        // Add ticket controls
        const ticketControls = createTicketControlsRow(true);
        
        await channel.send({
            content: `This channel has been registered as a ${formatTicketType(ticketType)} ticket for ${targetUser}.`,
            components: [ticketControls]
        });
        
        // Log the action
        logTicketAction(
            interaction.guild, 
            interaction.user, 
            ticketType, 
            'manually-registered', 
            channel.id
        );
        
        await safeReply(interaction, {
            content: `Successfully registered ${channel} as a ${formatTicketType(ticketType)} ticket for ${targetUser}.`,
            ephemeral: true
        }, true);
    } catch (error) {
        console.error('Error registering ticket:', error);
        await safeReply(interaction, {
            content: 'An error occurred while registering the ticket: ' + error.message,
            ephemeral: true
        }, true);
    }
}

/**
 * Debug ticket system - for admins only
 * Usage: /debug-tickets
 */
async function debugTickets(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return safeReply(interaction, {
            content: 'You need administrator permissions to debug tickets.',
            ephemeral: true
        });
    }
    
    try {
        await interaction.deferReply({ ephemeral: true });
    } catch (error) {
        console.error('Error deferring reply for debug-tickets:', error);
        return;
    }
    
    try {
        ensureTicketsLoaded(); // Ensure tickets are loaded
        
        const currentChannel = interaction.channel;
        const debugInfo = [];
        
        // Current channel info
        debugInfo.push(`**Current Channel**`);
        debugInfo.push(`- ID: ${currentChannel.id}`);
        debugInfo.push(`- Name: ${currentChannel.name}`);
        debugInfo.push(`- Is Ticket: ${activeTickets.has(currentChannel.id) ? 'Yes' : 'No'}`);
        
        // If it's a ticket, show details
        if (activeTickets.has(currentChannel.id)) {
            const ticket = activeTickets.get(currentChannel.id);
            debugInfo.push(`- Type: ${formatTicketType(ticket.type)}`);
            debugInfo.push(`- User: <@${ticket.userId}>`);
            debugInfo.push(`- Created: ${ticket.createdAt ? formatDateUTC(ticket.createdAt) : 'Unknown'}`);
            debugInfo.push(`- Status: ${ticket.closed ? 'Closed' : 'Open'}`);
        }
        
        debugInfo.push(`\n**All Active Tickets**`);
        debugInfo.push(`Total: ${activeTickets.size}`);
        
        // Show first 10 tickets
        let count = 0;
        for (const [id, ticket] of activeTickets.entries()) {
            if (count >= 10) {
                debugInfo.push(`... and ${activeTickets.size - 10} more`);
                break;
            }
            
            const channel = interaction.guild.channels.cache.get(id);
            const channelExists = channel ? 'Yes' : 'No';
            debugInfo.push(`${count + 1}. ${ticket.type} - <#${id}> - Exists: ${channelExists}`);
            count++;
        }
        
        debugInfo.push(`\n**System Information**`);
        debugInfo.push(`Current Date (UTC): ${formatDateUTC(new Date())}`);
        debugInfo.push(`Persistence File: ${TICKETS_FILE}`);
        debugInfo.push(`File Exists: ${fs.existsSync(TICKETS_FILE) ? 'Yes' : 'No'}`);
        
        if (fs.existsSync(TICKETS_FILE)) {
            const stats = fs.statSync(TICKETS_FILE);
            debugInfo.push(`File Size: ${stats.size} bytes`);
            debugInfo.push(`Last Modified: ${formatDateUTC(new Date(stats.mtime))}`);
        }
        
        await safeReply(interaction, {
            content: debugInfo.join('\n'),
            ephemeral: true
        }, true);
    } catch (error) {
        console.error('Error debugging tickets:', error);
        await safeReply(interaction, {
            content: 'An error occurred while debugging tickets: ' + error.message,
            ephemeral: true
        }, true);
    }
}

// Create a ticket with form data
async function createTicketWithFormData(interaction, ticketType, formData, panelModule) {
    ensureTicketsLoaded(); // Ensure tickets are loaded
    
    const { guild, user } = interaction;
    
    // Get ticket limits from config (with fallbacks if not defined)
    const maxTotal = config.ticketOptions?.maxTicketsPerUser ?? 10;
    const maxPerType = config.ticketOptions?.maxTicketsPerUserPerType ?? 3;
    
    // Get user's open tickets
    const userTickets = Array.from(activeTickets.values())
        .filter(ticket => ticket.userId === user.id && !ticket.closed);
    
    // Get user's open tickets of the current type
    const userTicketsOfType = userTickets
        .filter(ticket => ticket.type === ticketType);
    
    // Check total ticket limit
    if (userTickets.length >= maxTotal) {
        return safeReply(interaction, { 
            content: `You have reached the maximum limit of ${maxTotal} open tickets. Please close some of your existing tickets before creating more.`,
            ephemeral: true 
        }, true);
    }
    
    // Check per-type ticket limit
    if (userTicketsOfType.length >= maxPerType) {
        return safeReply(interaction, { 
            content: `You can only have ${maxPerType} open ${formatTicketType(ticketType)} tickets at once. Please close some of your existing ${formatTicketType(ticketType)} tickets before creating more.`,
            ephemeral: true 
        }, true);
    }
    
    try {
        // Get appropriate category and roles for this ticket type
        const categoryId = config.ticketCategories[ticketType] || config.ticketCategories.support;
        const visibleRoles = getTicketRoles(ticketType).filter(roleId => {
            // Filter out invalid role IDs
            if (!isValidSnowflake(roleId)) {
                console.warn(`Warning: Invalid role ID in config: ${roleId}`);
                return false;
            }
            return true;
        });
        
        // Create permissions array for the channel
        const permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,   // <-- Allow sending images
                    PermissionFlagsBits.AddReactions,  // <-- Allow adding reactions
                    PermissionFlagsBits.EmbedLinks
                ]
            }
        ];
        
        // Add role permissions for valid roles only
        for (const roleId of visibleRoles) {
            // Validate that the role exists in the guild's cache
            const role = guild.roles.cache.get(roleId);
            if (role) {
                permissionOverwrites.push({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                });
            } else {
                console.warn(`Warning: Role ID ${roleId} not found in guild cache`);
            }
        }
        
        // Add counter for multiple tickets if needed
        let ticketName = sanitizeChannelName(`${ticketType}-${user.username}`);
        if (userTicketsOfType.length > 0) {
            ticketName = sanitizeChannelName(`${ticketType}-${user.username}-${userTicketsOfType.length + 1}`);
        }
        
        // Create the ticket channel
        const ticketChannel = await guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: permissionOverwrites,
            topic: `${formatTicketType(ticketType)} ticket for ${user.tag} | ID: ${user.id}`
        });
        
        // Track the ticket
        activeTickets.set(ticketChannel.id, {
            channelId: ticketChannel.id,
            userId: user.id,
            type: ticketType,
            createdAt: new Date(),
            formData: formData
        });
        
        // Save active tickets to file
        await saveActiveTickets(activeTickets);
        
        // Create ticket management buttons
        const ticketControls = createTicketControlsRow(true);
        
        // Create welcome embed
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`${formatTicketType(ticketType)} Ticket`)
            .setDescription(`Thank you for your submission, ${user}!\nOur team will assist you shortly.`)
            .setColor(getTicketColor(ticketType))
            .setFooter({ 
                text: `Posted by Bharat27-d • 2025-07-06 18:09:29`, 
                iconURL: 'https://i.ibb.co/FMYFdhk/real-ops-group-logo.png'
            })
            .setTimestamp();
        
        // Create response embed using the panel's formatter
        const responseEmbed = panelModule.createResponseEmbed(user, formData, ticketChannel.id);
        
        // Get valid mentions for roles (with duplicate removal)
        const validRoleMentions = [...new Set(visibleRoles)]
            .filter(roleId => guild.roles.cache.has(roleId))
            .map(roleId => `<@&${roleId}>`)
            .join(' ');
        
        // Send welcome message and form data to the ticket channel
        await ticketChannel.send({ 
            content: `<@${user.id}> ${validRoleMentions}`,
            embeds: [welcomeEmbed, responseEmbed]
        });
        
        // Then send controls only for staff/admins
        await ticketChannel.send({
    components: [ticketControls]
});
        
        // If this is a "Book Us" ticket, fetch and send TruckerMP event details
        if (ticketType === 'bookUs' && formData && formData.eventLink) {
            try {
                // Wait a moment to ensure the first message is sent
                setTimeout(async () => {
                    try {
                        // Try to send event details from TruckerMP API
                        await panelModule.sendEventDetails(ticketChannel, formData, user);
                    } catch (innerError) {
                        console.error('Error in delayed event details sending:', innerError);
                        ticketChannel.send('There was an error fetching event details. Please provide the event details manually.').catch(console.error);
                    }
                }, 1500); // Slightly longer delay to ensure the first message is sent
            } catch (eventError) {
                console.error('Error queuing event details send:', eventError);
            }
        }
        
        // Log ticket creation
        logTicketAction(guild, user, ticketType, 'created', ticketChannel.id, formData);
        
        // Reply to the user
        await safeReply(interaction, { 
            content: `Your ${formatTicketType(ticketType)} ticket has been created: <#${ticketChannel.id}>`,
            ephemeral: true 
        }, true);
    } catch (error) {
        console.error('Error creating ticket:', error);
        await safeReply(interaction, {
            content: 'An error occurred while creating your ticket. Please contact an administrator.',
            ephemeral: true
        }, true);
    }
}

// Create a standard ticket (legacy support)
async function createTicket(interaction, ticketType) {
    try {
        await interaction.deferReply({ ephemeral: true });
    } catch (error) {
        console.error('Error deferring reply for createTicket:', error);
        return;
    }
    
    ensureTicketsLoaded(); // Ensure tickets are loaded
    
    const { guild, user } = interaction;
    
    // Get ticket limits from config (with fallbacks if not defined)
    const maxTotal = config.ticketOptions?.maxTicketsPerUser ?? 10;
    const maxPerType = config.ticketOptions?.maxTicketsPerUserPerType ?? 3;
    
    // Get user's open tickets
    const userTickets = Array.from(activeTickets.values())
        .filter(ticket => ticket.userId === user.id && !ticket.closed);
    
    // Get user's open tickets of the current type
    const userTicketsOfType = userTickets
        .filter(ticket => ticket.type === ticketType);
    
    // Check total ticket limit
    if (userTickets.length >= maxTotal) {
        return safeReply(interaction, { 
            content: `You have reached the maximum limit of ${maxTotal} open tickets. Please close some of your existing tickets before creating more.`,
            ephemeral: true 
        }, true);
    }
    
    // Check per-type ticket limit
    if (userTicketsOfType.length >= maxPerType) {
        return safeReply(interaction, { 
            content: `You can only have ${maxPerType} open ${formatTicketType(ticketType)} tickets at once. Please close some of your existing ${formatTicketType(ticketType)} tickets before creating more.`,
            ephemeral: true 
        }, true);
    }
    
    try {
        // Get appropriate category and roles for this ticket type
        const categoryId = config.ticketCategories[ticketType] || config.ticketCategories.support;
        const visibleRoles = getTicketRoles(ticketType).filter(roleId => isValidSnowflake(roleId));
        
        // Create permissions array for the channel
        const permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,   // <-- Allow sending images
                    PermissionFlagsBits.AddReactions   // <-- Allow adding reactions
                ]
            }
        ];
        
        // Add role permissions for valid roles only
        for (const roleId of visibleRoles) {
            const role = guild.roles.cache.get(roleId);
            if (role) {
                permissionOverwrites.push({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                });
            }
        }
        
        // Add counter for multiple tickets if needed
        let ticketName = sanitizeChannelName(`${ticketType}-${user.username}`);
        if (userTicketsOfType.length > 0) {
            ticketName = sanitizeChannelName(`${ticketType}-${user.username}-${userTicketsOfType.length + 1}`);
        }
        
        // Create the ticket channel
        const ticketChannel = await guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: permissionOverwrites,
            topic: `${formatTicketType(ticketType)} ticket for ${user.tag} | ID: ${user.id}`
        });
        
        // Track the ticket
        activeTickets.set(ticketChannel.id, {
            channelId: ticketChannel.id,
            userId: user.id,
            type: ticketType,
            createdAt: new Date()
        });
        
        // Save active tickets to file
        await saveActiveTickets(activeTickets);
        
        // Create ticket management buttons
        const ticketControls = createTicketControlsRow(true);
        
        // Create welcome embed
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`${formatTicketType(ticketType)} Ticket`)
            .setDescription(`Hello ${user}, thank you for creating a ${formatTicketType(ticketType)} ticket!\nOur staff will assist you shortly.`)
            .addFields(
                { name: 'User', value: `<@${user.id}>`, inline: true },
                { name: 'Type', value: formatTicketType(ticketType), inline: true },
                { name: 'Created', value: `2025-07-06 18:09:29`, inline: true }
            )
            .setColor(getTicketColor(ticketType))
            .setFooter({ 
                text: `Posted by Bharat27-d • 2025-07-06 18:09:29`, 
                iconURL: guild.iconURL() 
            })
            .setTimestamp();
        
        // Get valid mentions for roles (with duplicate removal)
        const validRoleMentions = [...new Set(visibleRoles)]
            .filter(roleId => guild.roles.cache.has(roleId))
            .map(roleId => `<@&${roleId}>`)
            .join(' ');
        
        // Send welcome message to the ticket channel
        await ticketChannel.send({ 
            content: `<@${user.id}> ${validRoleMentions}`,
            embeds: [welcomeEmbed],
            components: [ticketControls]
        });
        
        // Log ticket creation
        logTicketAction(guild, user, ticketType, 'created', ticketChannel.id);
        
        // Reply to the user
        await safeReply(interaction, { 
            content: `Your ticket has been created: <#${ticketChannel.id}>`,
            ephemeral: true 
        }, true);
    } catch (error) {
        console.error('Error creating ticket:', error);
        await safeReply(interaction, {
            content: 'An error occurred while creating your ticket. Please contact an administrator.',
            ephemeral: true
        }, true);
    }
}

// Close a ticket
async function closeTicket(interaction) {
    ensureTicketsLoaded(); // Ensure tickets are loaded
    
    try {
        const { channel, user } = interaction;
        
        // We already validated this is a ticket channel in the main handler
        if (!activeTickets.has(channel.id)) {
            return await safeReply(interaction, {
                content: 'This channel is not set up as a ticket. If this is an error, please contact an administrator.',
                ephemeral: true
            });
        }
        
        // Instead of closing immediately, send a confirmation message
        const confirmationEmbed = new EmbedBuilder()
            .setTitle('Confirm Ticket Closure')
            .setDescription(`${user}, are you sure you want to close this ticket?`)
            .setColor('#f39c12')
            .setFooter({ 
                text: `Posted by Bharat27-d • 2025-07-06 18:09:29`,
                iconURL: user.displayAvatarURL()
            })
            .setTimestamp();
        
        const confirmationRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_close_confirm')
                    .setLabel('Yes, Close It')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_close_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await safeReply(interaction, {
            embeds: [confirmationEmbed],
            components: [confirmationRow]
        });
    } catch (error) {
        console.error('Error initiating ticket closure:', error);
        try {
            await safeReply(interaction, {
                content: 'An error occurred while processing your request.',
                ephemeral: true
            });
        } catch (replyError) {
            console.error('Error sending error message:', replyError);
        }
    }
}

// Confirmed ticket closing (actual closing process)
async function closeTicketConfirmed(interaction) {
    ensureTicketsLoaded(); // Ensure tickets are loaded
    
    try {
        const { channel, user } = interaction;
        
        try {
            await interaction.deferUpdate(); // Update the original message
        } catch (error) {
            console.error('Error deferring update for closeTicketConfirmed:', error);
            // Continue even if this fails
        }
        
        // Update channel permissions
        await channel.permissionOverwrites.edit(activeTickets.get(channel.id).userId, {
            SendMessages: false
        });
        
        // Create reopen button
        const reopenRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_reopen')
                    .setLabel('Reopen Ticket')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔓'),
                new ButtonBuilder()
                    .setCustomId('ticket_delete')
                    .setLabel('Delete Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(config.emojis?.delete || '🗑️')
            );
        
        const closedEmbed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setDescription(`This ticket was closed by <@${user.id}>`)
            .setColor('#f39c12')
            .setFooter({ 
                text: `Posted by Bharat27-d • 2025-07-06 18:09:29`,
                iconURL: user.displayAvatarURL()
            })
            .setTimestamp();
        
        await channel.send({ embeds: [closedEmbed], components: [reopenRow] });
        
        // Log ticket closing
        const ticketData = activeTickets.get(channel.id);
        logTicketAction(interaction.guild, user, ticketData.type, 'closed', channel.id);
        
        // Update ticket data but don't remove from active tickets
        const updatedTicketData = {
            ...ticketData,
            closed: true,
            closedAt: new Date(),
            closedBy: user.id
        };
        activeTickets.set(channel.id, updatedTicketData);
        await saveActiveTickets(activeTickets);
        
        // Edit the original confirmation message
        try {
            await interaction.editReply({
                content: 'Ticket has been closed.',
                embeds: [],
                components: []
            });
        } catch (error) {
            console.error('Error updating confirmation message:', error);
            // Continue even if this fails
        }
    } catch (error) {
        console.error('Error closing ticket:', error);
        try {
            await channel.send({
                content: 'An error occurred while closing the ticket: ' + error.message
            });
        } catch (err) {
            console.error('Failed to send error message to channel:', err);
        }
    }
}

// Cancel ticket closing
async function closeTicketCancelled(interaction) {
    try {
        await interaction.update({
            content: 'Ticket closure cancelled.',
            embeds: [],
            components: []
        });
    } catch (error) {
        console.error('Error cancelling ticket closure:', error);
    }
}

// Reopen a ticket
async function reopenTicket(interaction) {
    ensureTicketsLoaded(); // Ensure tickets are loaded
    
    try {
        const { channel, user } = interaction;
        
        // We already validated this is a ticket channel in the main handler
        if (!activeTickets.has(channel.id)) {
            return await safeReply(interaction, {
                content: 'This channel is not set up as a ticket. If this is an error, please contact an administrator.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.deferReply(); // Non-ephemeral for actual action
        } catch (error) {
            console.error('Error deferring reply for reopenTicket:', error);
            // Continue even if this fails
        }
        
        // Update channel permissions
        await channel.permissionOverwrites.edit(activeTickets.get(channel.id).userId, {
            SendMessages: true
        });
        
        // Create standard ticket controls
        const ticketControls = createTicketControlsRow(true);
        
        const reopenedEmbed = new EmbedBuilder()
            .setTitle('Ticket Reopened')
            .setDescription(`This ticket was reopened by <@${user.id}>`)
            .setColor('#2ecc71')
            .setFooter({ 
                text: `Posted by Bharat27-d • 2025-07-06 18:09:29`,
                iconURL: user.displayAvatarURL()
            })
            .setTimestamp();
        
        await channel.send({ embeds: [reopenedEmbed], components: [ticketControls] });
        
        // Log ticket reopening
        const ticketData = activeTickets.get(channel.id);
        logTicketAction(interaction.guild, user, ticketData.type, 'reopened', channel.id);
        
        // Update ticket data
        const updatedTicketData = {
            ...ticketData,
            closed: false,
            reopenedAt: new Date(),
            reopenedBy: user.id
        };
        activeTickets.set(channel.id, updatedTicketData);
        await saveActiveTickets(activeTickets);
        
        // Edit the deferred reply
        try {
            await safeReply(interaction, {
                content: `Ticket has been reopened.`
            }, true);
        } catch (error) {
            console.error('Error editing reopened reply:', error);
        }
    } catch (error) {
        console.error('Error reopening ticket:', error);
        try {
            await channel.send({
                content: 'An error occurred while reopening the ticket: ' + error.message
            });
        } catch (err) {
            console.error('Failed to send error message to channel:', err);
        }
    }
}

// Delete a ticket
async function deleteTicket(interaction) {
    ensureTicketsLoaded(); // Ensure tickets are loaded
    
    try {
        const { channel, user } = interaction;
        
        // We already validated this is a ticket channel in the main handler
        if (!activeTickets.has(channel.id)) {
            return await safeReply(interaction, {
                content: 'This channel is not set up as a ticket. If this is an error, please contact an administrator.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.deferReply(); // Non-ephemeral for actual action
        } catch (error) {
            console.error('Error deferring reply for deleteTicket:', error);
            // Continue even if this fails
        }
        
        // Generate a transcript before deleting
        const ticketData = activeTickets.get(channel.id);
        
        try {
            // Try to create a transcript before deleting
            await createTranscriptForDeletion(channel, user, ticketData);
            await safeReply(interaction, { content: `Transcript saved. Ticket will be deleted in 5 seconds...` }, true);
        } catch (transcriptError) {
            console.error('Failed to create transcript before deletion:', transcriptError);
            await safeReply(interaction, { content: `Failed to save transcript. Ticket will be deleted in 5 seconds...` }, true);
        }
        
        // Log ticket deletion
        logTicketAction(interaction.guild, user, ticketData.type, 'deleted', channel.id);
        
        // Remove from active tickets
        activeTickets.delete(channel.id);
        await saveActiveTickets(activeTickets);
        
        // Delete after delay
        setTimeout(() => {
            channel.delete().catch(err => {
                console.error('Error deleting channel:', err);
            });
        }, 5000);
    } catch (error) {
        console.error('Error deleting ticket:', error);
        try {
            await channel.send({
                content: 'An error occurred while deleting the ticket: ' + error.message
            });
        } catch (err) {
            console.error('Failed to send error message to channel:', err);
        }
    }
}

// Create transcript for deletion
async function createTranscriptForDeletion(channel, user, ticketData) {
    const timestamp = Date.now();
    const fileName = `transcript-${channel.name}-${timestamp}.html`;
    
    // Create transcript
    const transcript = await generateTranscript(channel, {
        limit: -1,
        fileName: fileName,
        poweredBy: false,
        saveImages: true,
        footerText: `Transcript saved before deletion by ${user.tag} | 2025-07-06 18:09:29`,
        headerText: `Ticket Transcript - ${formatTicketType(ticketData.type)} (Deleted)`
    });
    
    // Send to transcript channel if configured
    const transcriptChannel = channel.guild.channels.cache.get(config.transcriptChannel);
    if (transcriptChannel) {
        const logEmbed = new EmbedBuilder()
            .setTitle('Ticket Deleted - Transcript')
            .addFields(
                { name: 'Ticket', value: channel.name, inline: true },
                { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
                { name: 'Type', value: formatTicketType(ticketData.type), inline: true },
                { name: 'Deleted At', value: `2025-07-06 18:09:29`, inline: true }
            )
            .setColor('#e74c3c')
            .setFooter({ 
                text: `Posted by Bharat27-d • 2025-07-06 18:09:29`,
                iconURL: user.displayAvatarURL()
            })
            .setTimestamp();
        
        await transcriptChannel.send({
            embeds: [logEmbed],
            files: [transcript]
        });
    }
}

// Create transcript
async function createTranscript(interaction) {
    ensureTicketsLoaded(); // Ensure tickets are loaded
    
    try {
        const { channel, user } = interaction;
        
        // We already validated this is a ticket channel in the main handler
        if (!activeTickets.has(channel.id)) {
            return await safeReply(interaction, {
                content: 'This channel is not set up as a ticket. If this is an error, please contact an administrator.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.deferReply();
        } catch (error) {
            console.error('Error deferring reply for createTranscript:', error);
            // Continue even if this fails
        }
        
        // Get ticket data
        const ticketData = activeTickets.get(channel.id);
        const timestamp = Date.now();
        const fileName = `transcript-${channel.name}-${timestamp}.html`;
        
        // Create transcript
        const transcript = await generateTranscript(channel, {
            limit: -1, // Fetch all messages
            fileName: fileName,
            poweredBy: false, // Remove the "Powered by discord-html-transcripts" text
            saveImages: true, // Save images
            footerText: `Transcript saved by ${user.tag} | 2025-07-06 18:09:29`,
            headerText: `Ticket Transcript - ${formatTicketType(ticketData.type)}`
        });
        
        // Send the transcript as an attachment in the channel
        await channel.send({
            content: `Transcript saved by ${user}`,
            files: [transcript]
        });
        
        // Log transcript creation
        logTicketAction(interaction.guild, user, ticketData.type, 'transcript', channel.id);
        
        // Reply to the interaction
        await safeReply(interaction, {
            content: 'Transcript has been created and saved!',
        }, true);
        
        // Send transcript to dedicated transcript channel if configured
        const transcriptChannel = interaction.guild.channels.cache.get(config.transcriptChannel);
        if (transcriptChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('Ticket Transcript Created')
                .addFields(
                    { name: 'Ticket', value: channel.name, inline: true },
                    { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
                    { name: 'Type', value: formatTicketType(ticketData.type), inline: true },
                    { name: 'Created At', value: `2025-07-06 18:09:29`, inline: true }
                )
                .setColor('#3498db')
                .setFooter({ 
                    text: `Posted by Bharat27-d • 2025-07-06 18:09:29`,
                    iconURL: user.displayAvatarURL()
                })
                .setTimestamp();
            
            await transcriptChannel.send({
                embeds: [logEmbed],
                files: [transcript]
            });
        }
    } catch (error) {
        console.error('Error creating transcript:', error);
        try {
            await channel.send({
                content: 'An error occurred while creating the transcript: ' + error.message
            });
        } catch (err) {
            console.error('Failed to send error message to channel:', err);
        }
    }
}

// Validate if string is a valid Discord ID (Snowflake)
function isValidSnowflake(id) {
    if (!id) return false;
    if (typeof id !== 'string' || !/^\d+$/.test(id)) return false;
    try {
        return id.length >= 17 && id.length <= 19;
    } catch (error) {
        return false;
    }
}

// Get roles that should see a specific ticket type
function getTicketRoles(ticketType) {
    const roles = [];
    switch(ticketType) {
        case 'joinTeam':
            if (Array.isArray(config.staffRoles.hr)) {
                roles.push(...config.staffRoles.hr);
            } else if (config.staffRoles.hr) {
                roles.push(config.staffRoles.hr);
            }
            break;
        case 'bookUs':
            if (Array.isArray(config.staffRoles.bookings)) {
                roles.push(...config.staffRoles.bookings);
            } else if (config.staffRoles.bookings) {
                roles.push(config.staffRoles.bookings);
            }
            break;
        case 'support':
            if (Array.isArray(config.staffRoles.support)) {
                roles.push(...config.staffRoles.support);
            } else if (config.staffRoles.support) {
                roles.push(config.staffRoles.support);
            }
            break;
        case 'partnership':
            if (Array.isArray(config.staffRoles.partnership)) {
                roles.push(...config.staffRoles.partnership);
            } else if (config.staffRoles.partnership) {
                roles.push(config.staffRoles.partnership);
            }
            break;
        case 'founders':
            if (Array.isArray(config.staffRoles.founders)) {
                roles.push(...config.staffRoles.founders);
            } else if (config.staffRoles.founders) {
                roles.push(config.staffRoles.founders);
            }
            break;
        case 'hr':
            if (Array.isArray(config.staffRoles.hr)) {
                roles.push(...config.staffRoles.hr);
            } else if (config.staffRoles.hr) {
                roles.push(config.staffRoles.hr);
            }
            break;
    }
    return [...new Set(roles.filter(Boolean))];
}

function getTicketColor(ticketType) {
    switch(ticketType) {
        case 'joinTeam': return '#3498db';
        case 'bookUs': return '#e74c3c';
        case 'support': return '#2ecc71';
        case 'partnership': return '#9b59b6';
        case 'founders': return '#f1c40f';
        case 'hr': return '#E74C3C';
        default: return '#95a5a6';
    }
}

// Format ticket type for display
function formatTicketType(ticketType) {
    switch(ticketType) {
        case 'joinTeam': return 'Join the Team';
        case 'bookUs': return 'Book Us';
        case 'support': return 'Support';
        case 'partnership': return 'Partnership';
        case 'founders': return 'Founders Manager';
        case 'hr': return 'HR Department';
        default: return ticketType.charAt(0).toUpperCase() + ticketType.slice(1);
    }
}

// Log ticket actions to a designated channel
function logTicketAction(guild, user, ticketType, action, ticketId, formData = null) {
    const logChannel = guild.channels.cache.get(config.logChannel);
    if (!logChannel) return;
    
    // Use Discord timestamp for user's local time
    const timestamp = getUnixTimestamp();
    
    const logEmbed = new EmbedBuilder()
                .setTitle(`Ticket ${action.charAt(0).toUpperCase() + action.slice(1)}`)
        .addFields(
            { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
            { name: 'Type', value: formatTicketType(ticketType), inline: true },
            { name: 'Ticket ID', value: ticketId, inline: true },
            { name: 'Action', value: action, inline: true },
            { name: 'Time', value: `<t:${timestamp}:F>`, inline: true }
        )
        .setColor(action === 'created' ? '#2ecc71' : action === 'closed' ? '#f39c12' : '#e74c3c')
        .setFooter({ 
            text: `Posted by Bharat27-d • 2025-07-06 18:13:51`,
            iconURL: user.displayAvatarURL()
        })
        .setTimestamp();
    
    // If we have form data and it's a creation action, add a summary
    if (formData && action === 'created') {
        // Add a summary based on the ticket type
        let summary = '';
        switch(ticketType) {
            case 'joinTeam':
                summary = `Position: ${formData.position}`;
                break;
            case 'hr':
                summary = `Reason: ${formData.reason}`;
                break;
            case 'partnership':
                summary = `VTC: ${formData.vtcName}`;
                break;
            case 'support':
                summary = `Discord Name: ${formData.discordName}`;
                break;
            case 'bookUs':
                summary = `Discord Name: ${formData.discordName}, VTC Role: ${formData.vtcRole}`;
                break;
            case 'founders':
                summary = `Discord Name: ${formData.discordName}`;
                break;
        }
        
        if (summary) {
            logEmbed.addFields({ name: 'Summary', value: summary, inline: true });
        }
    }
    
    logChannel.send({ embeds: [logEmbed] }).catch(error => {
        console.error('Failed to send log message:', error);
    });
}

module.exports = {
    setupTicketSystem,
    createTicket,
    closeTicket,
    reopenTicket,
    deleteTicket,
    createTranscript,
    registerExistingTicket,
    debugTickets,
    activeTickets, // Export activeTickets for other modules to use
    formatDateUTC,  // Exporting utility functions for use elsewhere
    formatTicketType
};