const schedule = require('node-schedule');
const { fetchContests } = require('./contestService');
const { createContestEmbed, formatDateInTimezone } = require('../utils/embedFormatter');
const { Client, EmbedBuilder } = require('discord.js');
const contestService = require('./contestService');

// Track which contests have already had reminders sent
const sentReminders = {
  day: new Set(),
  hours: new Set(),
  minutes: new Set()
};

/**
 * Schedules reminders for upcoming contests
 * @param {Discord.Client} client - Discord client
 */
async function scheduleContestReminders(client) {
  try {
    // Get the number of days to look ahead from environment variables
    const daysAhead = parseInt(process.env.CONTEST_DAYS_AHEAD || '7', 10);
    
    console.log(`Setting up contest reminders looking ahead ${daysAhead} days...`);
    
    // Fetch contest data
    const contests = await contestService.fetchContests(daysAhead);
    
    // Schedule reminders for the fetched contests
    if (contests.length > 0) {
      scheduleReminders(client, contests);
      console.log(`Scheduled reminders for ${contests.length} upcoming contests`);
    } else {
      console.log('No upcoming contests found to schedule reminders for');
    }
    
    return contests;
  } catch (error) {
    console.error('Failed to schedule contest reminders:', error.message);
    return [];
  }
}

/**
 * Schedule an individual contest reminder
 * @param {Client} client - Discord.js client
 * @param {Object} contest - Contest data
 * @param {number} reminderTime - Timestamp when reminder should be sent
 * @param {string} timeText - Human-readable time remaining text
 * @param {string} contestId - Unique identifier for the contest
 */
function scheduleReminder(client, contest, reminderTime, timeText, contestId) {
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const reminderDate = new Date(reminderTime);
  const timezone = process.env.TIMEZONE || 'UTC';
  
  // Format the reminder time for logging in the configured timezone
  const formattedTime = formatDateInTimezone(reminderDate, 'datetime');
  console.log(`Scheduling ${timeText} reminder for "${contest.name}" at ${formattedTime} (${timezone})`);
  
  // Create a job that runs at the specified time
  schedule.scheduleJob(reminderDate, async function() {
    try {
      // Check if we should track this reminder to avoid duplicates
      let shouldSend = true;
      
      if (timeText === '1 day') {
        if (sentReminders.day.has(contestId)) {
          shouldSend = false;
        } else {
          sentReminders.day.add(contestId);
        }
      } else if (timeText === '6 hours') {
        if (sentReminders.hours.has(contestId)) {
          shouldSend = false;
        } else {
          sentReminders.hours.add(contestId);
        }
      } else if (timeText === '30 minutes') {
        if (sentReminders.minutes.has(contestId)) {
          shouldSend = false;
        } else {
          sentReminders.minutes.add(contestId);
        }
      }
      
      if (!shouldSend) {
        console.log(`Skipping duplicate ${timeText} reminder for ${contest.name}`);
        return;
      }
      
      console.log(`Sending ${timeText} reminder for ${contest.name}`);
      
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        console.error(`Could not find channel with ID ${channelId}`);
        return;
      }
      
      // Create embed for the specific contest
      const embed = createContestEmbed(contest, `Starts in ${timeText}`);
      
      // Add an @everyone mention if a role ID is configured
      const roleId = process.env.CONTEST_ROLE_ID;
      let mentionText = '';
      
      if (roleId && roleId !== 'your_contest_role_id_here') {
        mentionText = `<@&${roleId}> `;
      }
      
      await channel.send({
        content: `${mentionText}Contest reminder!`,
        embeds: [embed]
      });
      
    } catch (error) {
      console.error(`Error sending ${timeText} reminder for ${contest.name}:`, error);
    }
  });
}

/**
 * Sends reminders for contests happening today
 * @param {Discord.Client} client - Discord client
 * @param {Discord.TextChannel} channel - Channel to send notifications to
 * @returns {Promise<boolean>} True if any contests were found for today
 */
async function sendTodayContestReminders(client, channel) {
  try {
    console.log('Checking for contests happening today...');
    
    // We only look 2 days ahead for today's contests
    const contests = await contestService.fetchContests(2);
    if (!contests || contests.length === 0) {
      console.log('No upcoming contests found');
      return false;
    }
    
    // Get the current date in the configured timezone
    const timezone = process.env.TIMEZONE || 'UTC';
    const now = new Date();
    const todayStr = formatDateInTimezone(now, 'date', timezone);
    console.log(`Today's date in ${timezone}: ${todayStr}`);
    
    // Find contests happening today
    let todayContests = contests.filter(contest => {
      // Convert contest date to the configured timezone
      const contestDate = new Date(contest.startTimeMs);
      const contestDateStr = formatDateInTimezone(contestDate, 'date', timezone);
      
      // Check if this contest is today
      const isToday = contestDateStr === todayStr;
      console.log(`Contest "${contest.name}" (${contest.platform}) date: ${contestDateStr}, compared to today (${todayStr}), isToday: ${isToday}`);
      
      return isToday;
    });
    
    if (todayContests.length === 0) {
      console.log('No contests happening today');
      return false;
    }
    
    console.log(`Found ${todayContests.length} contests happening today`);
    
    // Filter out contests that start too soon (less than 6 hours from now)
    // to avoid cluttering the channel with reminders for contests that are about to start
    const sixHoursInMs = 6 * 60 * 60 * 1000;
    const minStartTime = Date.now() + sixHoursInMs;
    
    // Keep contests that are at least 6 hours away
    const filteredContests = todayContests.filter(contest => {
      const isFarEnough = contest.startTimeMs >= minStartTime;
      if (!isFarEnough) {
        console.log(`Skipping reminder for contest "${contest.name}" as it starts in less than 6 hours`);
      }
      return isFarEnough;
    });
    
    // Sort by start time
    todayContests = todayContests.sort((a, b) => a.startTimeMs - b.startTimeMs);
    
    // Display all today's contests in the channel
    console.log(`Today's contests (sorted):`);
    todayContests.forEach(contest => {
      console.log(`- ${contest.name} (${contest.platform}) at ${new Date(contest.startTimeMs).toLocaleString()}`);
    });
    
    // Calculate time until contest starts for each contest
    todayContests.forEach(contest => {
      const timeUntilStart = contest.startTimeMs - Date.now();
      
      // Format the time until start
      let timingMessage;
      if (timeUntilStart <= 0) {
        // Contest has already started
        const minutesAgo = Math.floor((Date.now() - contest.startTimeMs) / (60 * 1000));
        timingMessage = `Started ${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
      } else {
        // Contest will start in the future
        const hoursUntil = Math.floor(timeUntilStart / (60 * 60 * 1000));
        const minsUntil = Math.floor((timeUntilStart % (60 * 60 * 1000)) / (60 * 1000));
        timingMessage = `Starts in ${hoursUntil}h ${minsUntil}m`;
      }
      
      console.log(`Contest "${contest.name}" timing message: "${timingMessage}"`);
      
      // Send a notification for this contest
      const embed = createContestEmbed(contest, `🔔 Today's Contest: ${timingMessage}`, 0x3498db);
      channel.send({ embeds: [embed] });
    });
    
    return todayContests.length > 0;
  } catch (error) {
    console.error('Error checking today\'s contests:', error.message);
    return false;
  }
}

/**
 * Checks for contests happening tomorrow and sends notifications
 * @param {Discord.Client} client - Discord client
 * @param {Discord.TextChannel} channel - Channel to send notifications to
 * @returns {Promise<boolean>} True if any contests were found for tomorrow
 */
async function checkTomorrowContests(client, channel) {
  try {
    console.log('Checking for contests happening tomorrow...');
    
    // We need to look at least 2 days ahead to include tomorrow
    const contests = await contestService.fetchContests(3);
    if (!contests || contests.length === 0) {
      console.log('No upcoming contests found');
      return false;
    }
    
    // Get tomorrow's date in the configured timezone
    const timezone = process.env.TIMEZONE || 'UTC';
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateInTimezone(tomorrow, 'date', timezone);
    
    // Find contests happening tomorrow
    const tomorrowContests = contests.filter(contest => {
      // Convert contest date to the configured timezone
      const contestDate = new Date(contest.startTimeMs);
      const contestDateStr = formatDateInTimezone(contestDate, 'date', timezone);
      
      return contestDateStr === tomorrowStr;
    });
    
    if (tomorrowContests.length === 0) {
      console.log('No contests happening tomorrow');
      return false;
    }
    
    console.log(`Found ${tomorrowContests.length} contests happening tomorrow (${tomorrowStr})`);
    
    // Sort by start time
    tomorrowContests.sort((a, b) => a.startTimeMs - b.startTimeMs);
    
    // Send a summary message first
    const contestNames = tomorrowContests.map(c => `${c.name} (${c.platform})`).join('\n• ');
    const summaryEmbed = new EmbedBuilder()
      .setColor(0x3498db) // Blue color
      .setTitle(`📅 ${tomorrowContests.length} Contest${tomorrowContests.length > 1 ? 's' : ''} Tomorrow!`)
      .setDescription(`Get ready for these contests tomorrow:\n\n• ${contestNames}`)
      .setFooter({ text: `Tomorrow: ${tomorrowStr}` });
    
    await channel.send({ embeds: [summaryEmbed] });
    
    // Send individual contest details
    for (const contest of tomorrowContests) {
      const embed = createContestEmbed(contest, '📅 Contest Tomorrow', 0x3498db);
      await channel.send({ embeds: [embed] });
    }
    
    return true;
  } catch (error) {
    console.error('Error checking tomorrow\'s contests:', error.message);
    return false;
  }
}

/**
 * Refreshes the contest data and reschedules reminders
 * @param {Discord.Client} client - Discord client
 */
async function refreshContests(client) {
  try {
    console.log('Refreshing contest data...');
    
    // Clear all existing scheduled jobs
    clearAllReminders();
    
    // Get the number of days to look ahead from environment variables
    const daysAhead = parseInt(process.env.CONTEST_DAYS_AHEAD || '7', 10);
    
    // Fetch new contest data
    const contests = await contestService.fetchContests(daysAhead);
    
    // Schedule reminders for the fetched contests
    scheduleReminders(client, contests);
    
    // Check if there are any contests tomorrow and send a notification
    const channelId = process.env.DISCORD_CHANNEL_ID;
    const channel = client.channels.cache.get(channelId);
    
    if (channel) {
      // We should check tomorrow's contests after refreshing the data
      await checkTomorrowContests(client, channel);
    }
    
    console.log('Contest data refreshed and reminders rescheduled');
    return contests;
  } catch (error) {
    console.error('Error refreshing contest data:', error.message);
    return [];
  }
}

/**
 * Clears all scheduled reminders
 */
function clearAllReminders() {
  console.log('Clearing all scheduled reminders');
  Object.keys(schedule.scheduledJobs).forEach(jobName => {
    schedule.scheduledJobs[jobName].cancel();
  });
  
  // Reset reminder tracking
  sentReminders.day.clear();
  sentReminders.hours.clear();
  sentReminders.minutes.clear();
}

/**
 * Schedules reminders for all provided contests
 * @param {Client} client - Discord.js client
 * @param {Array} contests - Array of contest objects to schedule reminders for
 */
function scheduleReminders(client, contests) {
  console.log(`Setting up reminders for ${contests.length} contests`);
  
  // Clear existing scheduled jobs first
  clearAllReminders();
  
  const now = Date.now();
  
  // For each contest, schedule reminders at different time points
  contests.forEach(contest => {
    const contestStartTime = contest.startTimeMs;
    const contestId = `${contest.platform}-${contest.name}-${contestStartTime}`;
    
    // Schedule 1 day reminder
    const oneDayBefore = contestStartTime - (24 * 60 * 60 * 1000);
    if (oneDayBefore > now) {
      scheduleReminder(client, contest, oneDayBefore, '1 day', contestId);
    }
    
    // Schedule 6 hour reminder
    const sixHoursBefore = contestStartTime - (6 * 60 * 60 * 1000);
    if (sixHoursBefore > now) {
      scheduleReminder(client, contest, sixHoursBefore, '6 hours', contestId);
    }
    
    // Schedule 30 minute reminder
    const thirtyMinsBefore = contestStartTime - (30 * 60 * 1000);
    if (thirtyMinsBefore > now) {
      scheduleReminder(client, contest, thirtyMinsBefore, '30 minutes', contestId);
    }
  });
}

module.exports = {
  scheduleContestReminders,
  sendTodayContestReminders,
  checkTomorrowContests,
  refreshContests
}; 