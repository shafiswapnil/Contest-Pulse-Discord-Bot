const schedule = require('node-schedule');
const { fetchContests } = require('./contestService');
const { createContestEmbed, formatDateInTimezone, formatTimeRemaining } = require('../utils/embedFormatter');
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
      
      // Calculate exact time remaining at the moment of sending
      const exactTimeRemaining = formatTimeRemaining(contest.startTimeMs);
      
      // Create embed for the specific contest with dynamic time remaining
      const embed = createContestEmbed(contest, `Starts in ${exactTimeRemaining}`);
      
      // Add an @everyone mention if a role ID is configured
      const roleId = process.env.CONTEST_ROLE_ID;
      let mentionText = '';
      
      if (roleId && roleId !== 'your_contest_role_id_here') {
        mentionText = `<@&${roleId}> `;
      }
      
      await channel.send({
        content: `${mentionText}Contest reminder! **${contest.name}** starts in **${exactTimeRemaining}**`,
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
    
    // Sort by start time
    todayContests = todayContests.sort((a, b) => a.startTimeMs - b.startTimeMs);
    
    // Display all today's contests in the channel
    console.log(`Today's contests (sorted):`);
    todayContests.forEach(contest => {
      console.log(`- ${contest.name} (${contest.platform}) at ${new Date(contest.startTimeMs).toLocaleString()}`);
    });
    
    // Calculate time until contest starts for each contest
    todayContests.forEach(contest => {
      // Calculate exact time remaining at the moment of sending
      const timeRemaining = formatTimeRemaining(contest.startTimeMs);
      
      console.log(`Contest "${contest.name}" time remaining: "${timeRemaining}"`);
      
      // Create embed with time remaining information
      const embed = createContestEmbed(contest, `🔔 Today's Contest: ${timeRemaining}`, 0x3498db);
      
      // Add role mention if configured
      const roleId = process.env.CONTEST_ROLE_ID;
      let mentionText = '';
      
      if (roleId && roleId !== 'your_contest_role_id_here') {
        mentionText = `<@&${roleId}> `;
      }
      
      channel.send({
        content: `${mentionText}Today's Contest: **${contest.name}** starts in **${timeRemaining}**`,
        embeds: [embed]
      });
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
      if (channel) {
        channel.send('No programming contests are scheduled for tomorrow.');
      }
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
      if (channel) {
        channel.send('No programming contests are scheduled for tomorrow.');
      }
      return false;
    }
    
    console.log(`Found ${tomorrowContests.length} contests happening tomorrow`);
    
    // Sort contests by start time
    const sortedContests = tomorrowContests.sort((a, b) => a.startTimeMs - b.startTimeMs);
    
    // Get channel to send notifications
    let targetChannel = channel;
    if (!targetChannel) {
      const channelId = process.env.DISCORD_CHANNEL_ID;
      targetChannel = await client.channels.fetch(channelId);
      if (!targetChannel) {
        console.error(`Could not find channel with ID ${channelId}`);
        return false;
      }
    }
    
    // Send a summary message first
    const summary = new EmbedBuilder()
      .setTitle("Tomorrow's Programming Contests")
      .setColor(0x4CAF50)
      .setDescription(`${sortedContests.length} contest${sortedContests.length === 1 ? '' : 's'} scheduled for tomorrow.`)
      .setTimestamp();
    
    await targetChannel.send({ embeds: [summary] });
    
    // Send individual contest notifications
    for (const contest of sortedContests) {
      // Calculate exact time remaining at the moment of sending
      const timeRemaining = formatTimeRemaining(contest.startTimeMs);
      
      // Create contest embed with time remaining
      const embed = createContestEmbed(contest, `🔔 Tomorrow's Contest: ${timeRemaining}`, 0xFFA500);
      
      // Add role mention if configured
      const roleId = process.env.CONTEST_ROLE_ID;
      let mentionText = '';
      
      if (roleId && roleId !== 'your_contest_role_id_here') {
        mentionText = `<@&${roleId}> `;
      }
      
      await targetChannel.send({
        content: `${mentionText}Tomorrow's Contest: **${contest.name}** starts in **${timeRemaining}**`,
        embeds: [embed]
      });
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
 * @param {Discord.Client} client - Discord client
 * @param {Array} contests - Array of contest objects
 */
function scheduleReminders(client, contests) {
  // Clean up any existing schedules
  clearAllReminders();
  
  // Reset reminder tracking sets
  sentReminders.day = new Set();
  sentReminders.hours = new Set();
  sentReminders.minutes = new Set();
  
  // Get current time
  const now = Date.now();
  
  // Process each contest
  contests.forEach(contest => {
    // Create a unique ID for this contest
    const contestId = `${contest.platform}-${contest.name}-${contest.startTimeMs}`;
    
    // Calculate time until contest
    const timeUntilContest = contest.startTimeMs - now;
    
    // Skip if contest is in the past
    if (timeUntilContest <= 0) {
      return;
    }
    
    // Define standard reminder times
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sixHoursMs = 6 * 60 * 60 * 1000;
    const thirtyMinutesMs = 30 * 60 * 1000;
    
    // Schedule each type of reminder if applicable
    // 1-day reminder, only if contest is more than a day away
    if (timeUntilContest > oneDayMs) {
      const reminderTime = contest.startTimeMs - oneDayMs;
      scheduleReminder(client, contest, reminderTime, '1 day', contestId);
    }
    
    // 6-hour reminder, only if contest is more than 6 hours away
    if (timeUntilContest > sixHoursMs) {
      const reminderTime = contest.startTimeMs - sixHoursMs;
      scheduleReminder(client, contest, reminderTime, '6 hours', contestId);
    }
    
    // 30-minute reminder, only if contest is more than 30 minutes away
    if (timeUntilContest > thirtyMinutesMs) {
      const reminderTime = contest.startTimeMs - thirtyMinutesMs;
      scheduleReminder(client, contest, reminderTime, '30 minutes', contestId);
    }
    
    // Add a dynamic reminder for contests that are starting soon but more than 30 minutes away
    // This helps with contests happening in the next few hours
    if (timeUntilContest > thirtyMinutesMs && timeUntilContest < sixHoursMs) {
      // Schedule a reminder at the midpoint between now and contest start
      const midpointTime = now + (timeUntilContest / 2);
      scheduleReminder(client, contest, midpointTime, 'soon', contestId);
    }
    
    // If the contest is very close (within 30 minutes)
    if (timeUntilContest <= thirtyMinutesMs) {
      // Schedule an immediate reminder
      scheduleReminder(client, contest, now + 1000, 'imminent', contestId);
    }
    
    console.log(`Scheduled reminders for contest: ${contest.name} (${contest.platform})`);
  });
}

module.exports = {
  scheduleContestReminders,
  sendTodayContestReminders,
  checkTomorrowContests,
  refreshContests
}; 