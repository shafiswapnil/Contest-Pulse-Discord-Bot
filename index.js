require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');
const { fetchContests } = require('./services/contestService');
const express = require('express');
const { runHealthChecks } = require('./utils/healthCheck');
const { createContestEmbed } = require('./utils/embedFormatter');

// Create Express server for health checks
const app = express();
const PORT = process.env.PORT || 3000;

// Discord bot configuration
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Bot ready event
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // Get schedule from env or use default (daily at 12:00 UTC)
  const cronSchedule = process.env.CONTEST_CHECK_SCHEDULE || '0 12 * * *';
  console.log(`Contest check scheduled with cron: ${cronSchedule}`);
  
  // Schedule contest checks based on configuration
  schedule.scheduleJob(cronSchedule, async () => {
    await checkAndAnnounceContests();
  });
  
  // Run initial health check
  runHealthChecks().then(result => {
    console.log('Health check result:', result);
  });
  
  console.log('Contest checking scheduler initialized');
});

// Function to check contests and send announcements
async function checkAndAnnounceContests() {
  try {
    const channelId = process.env.DISCORD_CHANNEL_ID;
    const channel = client.channels.cache.get(channelId);
    
    if (!channel) {
      console.error(`Channel with ID ${channelId} not found`);
      return;
    }
    
    console.log('Fetching upcoming contests...');
    const contests = await fetchContests();
    
    if (contests.length === 0) {
      console.log('No upcoming contests found within the next 7 days');
      return;
    }
    
    console.log(`Found ${contests.length} upcoming contests`);
    
    // Get the role mention string if role ID is provided
    const roleId = process.env.CONTEST_ROLE_ID;
    const roleMention = roleId ? `<@&${roleId}>` : '';
    
    // Mention the role first, if applicable
    if (roleMention) {
      await channel.send(roleMention + ' New contest alert!');
    }
    
    // Send announcements for each contest using embeds
    for (const contest of contests) {
      const embed = createContestEmbed(contest);
      
      await channel.send({ embeds: [embed] });
      console.log(`Sent announcement for ${contest.name}`);
      
      // Add small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error in checkAndAnnounceContests:', error);
  }
}

// Add a command handler for manual contest check
client.on('messageCreate', async (message) => {
  // Only respond to messages from guild members with the specific commands
  if (message.content === '!contests') {
    await message.channel.send('Checking for upcoming contests...');
    await checkAndAnnounceContests();
  }
  
  // Health check command
  if (message.content === '!health') {
    const result = await runHealthChecks();
    
    const statusEmbed = new EmbedBuilder()
      .setTitle('Bot Health Check')
      .setColor(result.status === 'healthy' ? 0x52C41A : 0xFF4D4F)
      .addFields(
        { name: 'Overall Status', value: result.status, inline: false },
        { name: 'Discord API', value: result.services.discord, inline: true },
        { name: 'Codeforces API', value: result.services.codeforces, inline: true },
        { name: 'AtCoder Sources', value: result.services.atcoder_problems === 'ok' || result.services.clist === 'ok' ? 'ok' : 'fail', inline: true },
        { name: '- AtCoder Problems API', value: result.services.atcoder_problems, inline: true },
        { name: '- Clist.by API', value: result.services.clist, inline: true }
      )
      .setTimestamp();
    
    await message.channel.send({ embeds: [statusEmbed] });
  }
  
  // Help command
  if (message.content === '!help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('Contest Bot Commands')
      .setColor(0x1890FF)
      .setDescription('Here are the available commands for the Contest Notification Bot:')
      .addFields(
        { name: '!contests', value: 'Check for upcoming contests in the next 7 days', inline: false },
        { name: '!health', value: 'Check the bot\'s connection status to various services', inline: false },
        { name: '!help', value: 'Show this help message', inline: false }
      );
    
    await message.channel.send({ embeds: [helpEmbed] });
  }
});

// Express routes
app.get('/', (req, res) => {
  res.send('Discord Codeforces & AtCoder Contest Bot is running!');
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthResult = await runHealthChecks();
  res.status(healthResult.status === 'healthy' ? 200 : 500)
     .json(healthResult);
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

// Login the bot
client.login(process.env.DISCORD_TOKEN);

// Handle errors and keep process running
client.on('error', console.error);
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Log Railway environment info
console.log('Environment:', {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: PORT
}); 