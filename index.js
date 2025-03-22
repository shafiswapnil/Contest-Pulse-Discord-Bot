require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');
const { fetchContests, fetchAtCoderContests } = require('./services/contestService');
const express = require('express');
const { runHealthChecks } = require('./utils/healthCheck');
const { createContestEmbed, createContestsEmbed, formatDateInTimezone } = require('./utils/embedFormatter');
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
  
  // Handle contest command
  if (message.content.toLowerCase() === '!contests') {
    message.channel.send('Checking for upcoming contests...');
    try {
      const contests = await fetchContests();
      
      // Debug info to check contest sources
      console.log(`Total contests found: ${contests.length}`);
      const atcoderContests = contests.filter(c => c.platform === 'AtCoder');
      const codeforcesContests = contests.filter(c => c.platform === 'Codeforces');
      console.log(`AtCoder contests: ${atcoderContests.length}`);
      console.log(`Codeforces contests: ${codeforcesContests.length}`);
      
      if (atcoderContests.length > 0) {
        console.log('AtCoder contests found:');
        atcoderContests.forEach(c => console.log(` - ${c.name} (${c.date}, ${c.startTime})`));
      } else {
        console.log('No AtCoder contests found in the next 7 days');
      }
      
      // Continue with normal contest display
      const embed = createContestsEmbed(contests);
      message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching contests:', error);
      message.channel.send('Error fetching contests. Please try again later.');
    }
  }
  
  // Add a special command for AtCoder contests (looking ahead further)
  if (message.content.toLowerCase() === '!atcoder') {
    message.channel.send('Checking for upcoming AtCoder contests...');
    try {
      // Temporarily modify the environment variable for a longer lookout
      const originalDaysAhead = process.env.CONTEST_DAYS_AHEAD;
      process.env.CONTEST_DAYS_AHEAD = '60'; // Look up to 60 days ahead
      
      // Only fetch AtCoder contests
      const atcoderContests = await fetchAtCoderContests();
      
      // Restore original setting
      process.env.CONTEST_DAYS_AHEAD = originalDaysAhead;
      
      console.log(`Found ${atcoderContests.length} AtCoder contests within the next 60 days`);
      
      if (atcoderContests.length === 0) {
        message.channel.send('No upcoming AtCoder contests found in the next 60 days.');
        return;
      }
      
      // Create a custom embed for AtCoder contests
      const embed = new EmbedBuilder()
        .setTitle('Upcoming AtCoder Contests')
        .setColor(0x00BFFF) // Light Blue for AtCoder
        .setTimestamp();
      
      // Group contests by date
      const contestsByDate = {};
      
      atcoderContests.forEach(contest => {
        const contestDate = new Date(contest.startTimeMs);
        const dateKey = formatDateInTimezone(contestDate, 'date');
        
        if (!contestsByDate[dateKey]) {
          contestsByDate[dateKey] = [];
        }
        contestsByDate[dateKey].push(contest);
      });
      
      // Add each date as a field
      for (const date in contestsByDate) {
        let contestsList = '';
        
        contestsByDate[date].forEach(contest => {
          const startDate = new Date(contest.startTimeMs);
          const endDate = new Date(contest.endTimeMs || startDate.getTime() + 2 * 60 * 60 * 1000);
          
          const startTimeFormatted = formatDateInTimezone(startDate, 'time');
          const endTimeFormatted = formatDateInTimezone(endDate, 'time');
          
          contestsList += `**${contest.name}**\n`;
          contestsList += `Time: ${startTimeFormatted} to ${endTimeFormatted}\n`;
          contestsList += `Link: [Contest Page](${contest.url})\n\n`;
        });
        
        embed.addFields({ name: date, value: contestsList });
      }
      
      embed.setFooter({ 
        text: `All times are shown in ${process.env.TIMEZONE || 'UTC'} timezone`
      });
      
      message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching AtCoder contests:', error);
      message.channel.send('Error fetching AtCoder contest information. Please try again later.');
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
  if (message.content.toLowerCase() === '!help') {
    const embed = new EmbedBuilder()
      .setTitle('Contest Bot Commands')
      .setColor(0x00AE86)
      .setDescription('Here are the available commands:')
      .addFields(
        { name: '!contests', value: 'Show all upcoming contests for the next 7 days', inline: false },
        { name: '!today', value: 'Show contests happening today', inline: false },
        { name: '!tomorrow', value: 'Show contests happening tomorrow', inline: false },
        { name: '!atcoder', value: 'Show all upcoming AtCoder contests for the next 60 days', inline: false },
        { name: '!setup-reminders', value: 'Manually set up contest reminders', inline: false },
        { name: '!health', value: 'Check the bot\'s connection to APIs', inline: false },
        { name: '!help', value: 'Show this help message', inline: false }
      )
      .setFooter({ text: 'Contest Bot - Get reminders for upcoming programming contests' });
    
    message.channel.send({ embeds: [embed] });
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
  let PORT = parseInt(process.env.PORT || '3000', 10);
  
  // Create server with error handling
  const startServer = () => {
    const server = app.listen(PORT, () => {
      console.log(`Health check server running on port ${PORT}`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use, trying port ${PORT + 1}`);
        PORT += 1;
        startServer(); // Try the next port
      } else {
        console.error('Failed to start health check server:', err);
      }
    });
  };
  
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
  
  startServer();
} 