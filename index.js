require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');
const { fetchContests } = require('./services/contestService');
const express = require('express');
const { runHealthChecks } = require('./utils/healthCheck');
const { createContestEmbed, createContestsEmbed } = require('./utils/embedFormatter');
const { scheduleContestReminders, sendTodayContestReminders, checkTomorrowContests } = require('./services/reminderService');

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
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Set up health check server
  setupHealthServer();
  
  // Schedule daily contest checking at specified time
  const checkSchedule = process.env.CONTEST_CHECK_SCHEDULE || '0 12 * * *'; // Default: daily at 12:00 UTC
  console.log(`Scheduling daily contest check at cron schedule: ${checkSchedule}`);
  
  // Initial setup of reminders
  await scheduleContestReminders(client);
  
  // Schedule daily refresh of reminders
  schedule.scheduleJob(checkSchedule, async () => {
    console.log('Running scheduled contest check...');
    await scheduleContestReminders(client);
    await checkTomorrowContests(client);
  });
  
  console.log('Bot setup complete!');
});

// Message handling
client.on('messageCreate', async message => {
  // Ignore messages from the bot
  if (message.author.bot) return;
  
  // Manual contest check command
  if (message.content === '!contests') {
    try {
      await message.channel.send('Checking for upcoming contests...');
      
      const contests = await fetchContests();
      
      if (contests.length === 0) {
        await message.channel.send('No upcoming contests found in the next few days.');
        return;
      }
      
      const embed = createContestsEmbed(contests);
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching contests:', error);
      await message.channel.send('Error fetching contest information. Please try again later.');
    }
  }
  
  // Check for contests tomorrow
  if (message.content === '!tomorrow') {
    message.channel.send('Checking for contests tomorrow...');
    const hasContests = await checkTomorrowContests(client);
    
    if (!hasContests) {
      message.channel.send('No contests scheduled for tomorrow.');
    }
  }
  
  // Check for contests today
  if (message.content === '!today') {
    message.channel.send('Checking for contests today...');
    await sendTodayContestReminders(client);
  }
  
  // Manual reminder setup
  if (message.content === '!setup-reminders') {
    message.channel.send('Setting up contest reminders...');
    await scheduleContestReminders(client);
    message.channel.send('Contest reminders have been set up. You will receive notifications 1 day, 6 hours, and 30 minutes before each contest.');
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
      .setColor(0x00AE86)
      .setDescription('Here are the commands you can use:')
      .addFields(
        { name: '!contests', value: 'Show all upcoming contests', inline: false },
        { name: '!today', value: 'Check if there are any contests today', inline: false },
        { name: '!tomorrow', value: 'Check if there are any contests tomorrow', inline: false },
        { name: '!setup-reminders', value: 'Manually set up contest reminders', inline: false },
        { name: '!health', value: 'Check the bot\'s connection status', inline: false },
        { name: '!help', value: 'Show this help message', inline: false }
      )
      .setFooter({ text: 'Contest reminders will be sent automatically at 1 day, 6 hours, and 30 minutes before each contest.' });
      
    await message.channel.send({ embeds: [helpEmbed] });
  }
});

// Express routes
app.get('/', (req, res) => {
  res.send('Contest Bot is running!');
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await runHealthChecks();
    res.status(result.status === 'healthy' ? 200 : 503).json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
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

// Set up health check server
function setupHealthServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  app.get('/', (req, res) => {
    res.send('Contest Bot is running!');
  });
  
  app.get('/health', async (req, res) => {
    try {
      const result = await runHealthChecks();
      res.status(result.status === 'healthy' ? 200 : 503).json(result);
    } catch (error) {
      res.status(500).json({ status: 'error', error: error.message });
    }
  });
  
  app.listen(PORT, () => {
    console.log(`Health check server running on port ${PORT}`);
  });
} 