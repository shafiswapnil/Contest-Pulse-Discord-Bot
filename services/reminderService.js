const schedule = require('node-schedule');
const { fetchContests } = require('./contestService');
const { createContestEmbed, formatDateInTimezone } = require('../utils/embedFormatter');
const { Client, EmbedBuilder } = require('discord.js');

// Track which contests have already had reminders sent
const sentReminders = {
  day: new Set(),
  hours: new Set(),
  minutes: new Set()
};

/**
 * Schedules reminders for upcoming contests
 * @param {Client} client - Discord.js client
 */
async function scheduleContestReminders(client) {
  try {
    console.log('Scheduling contest reminders...');
    
    // Clear any existing scheduled jobs
    Object.values(schedule.scheduledJobs).forEach(job => job.cancel());
    
    // Reset reminder tracking
    sentReminders.day.clear();
    sentReminders.hours.clear();
    sentReminders.minutes.clear();
    
    // Fetch upcoming contests
    const contests = await fetchContests();
    if (!contests || contests.length === 0) {
      console.log('No upcoming contests found to schedule reminders for');
      return;
    }
    
    console.log(`Scheduling reminders for ${contests.length} contests`);
    
    const now = Date.now();
    
    // Schedule reminders for each contest
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
  } catch (error) {
    console.error('Error scheduling contest reminders:', error);
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
 * @param {Client} client - Discord.js client
 * @param {Channel} responseChannel - Optional channel to send response to. If not provided, uses DISCORD_CHANNEL_ID
 */
async function sendTodayContestReminders(client, responseChannel = null) {
  try {
    const contests = await fetchContests();
    const defaultChannelId = process.env.DISCORD_CHANNEL_ID;
    const now = Date.now();
    
    // Get contests happening today based on the configured timezone
    const timezone = process.env.TIMEZONE || 'UTC';
    const todayStart = new Date();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    // Format dates based on the configured timezone for comparison
    const todayContests = contests.filter(contest => {
      const contestDate = new Date(contest.startTimeMs);
      
      // Create dates in the configured timezone for comparison
      const contestDateString = formatDateInTimezone(contestDate, 'date');
      const todayDateString = formatDateInTimezone(todayStart, 'date');
      
      return contestDateString === todayDateString;
    });
    
    // Only send reminders for contests at least 6 hours away
    const contestsToRemind = todayContests.filter(contest => {
      return contest.startTimeMs > now + (6 * 60 * 60 * 1000);
    });
    
    // Use the provided response channel or fetch the default channel
    const channel = responseChannel || await client.channels.fetch(defaultChannelId);
    
    if (!channel) {
      console.error(`Could not find channel ${responseChannel ? 'provided' : `with ID ${defaultChannelId}`}`);
      return false;
    }
    
    if (contestsToRemind.length === 0) {
      console.log('No contests today that are at least 6 hours away');
      await channel.send('No contests happening today (or contests are less than 6 hours away).');
      return false;
    }
    
    for (const contest of contestsToRemind) {
      const timeUntilStart = contest.startTimeMs - now;
      const hoursUntilStart = Math.floor(timeUntilStart / (1000 * 60 * 60));
      
      const embed = createContestEmbed(contest, `Starts in ${hoursUntilStart} hours`);
      
      await channel.send({
        content: `Today's contest:`,
        embeds: [embed]
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error sending today\'s contest reminders:', error);
    return false;
  }
}

/**
 * Checks if there are any contests tomorrow and sends a notification
 * @param {Client} client - Discord.js client
 * @param {Channel} responseChannel - Optional channel to send response to. If not provided, uses DISCORD_CHANNEL_ID
 * @returns {Promise<boolean>} True if contests were found and notification sent
 */
async function checkTomorrowContests(client, responseChannel = null) {
  try {
    const contests = await fetchContests();
    const defaultChannelId = process.env.DISCORD_CHANNEL_ID;
    
    // Get contests happening tomorrow based on the configured timezone
    const timezone = process.env.TIMEZONE || 'UTC';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Format tomorrow's date for comparison
    const tomorrowDateString = formatDateInTimezone(tomorrow, 'date');
    
    // Filter contests happening tomorrow
    const tomorrowContests = contests.filter(contest => {
      const contestDate = new Date(contest.startTimeMs);
      const contestDateString = formatDateInTimezone(contestDate, 'date');
      
      return contestDateString === tomorrowDateString;
    });
    
    // Use the provided response channel or fetch the default channel
    const channel = responseChannel || await client.channels.fetch(defaultChannelId);
    
    if (!channel) {
      console.error(`Could not find channel ${responseChannel ? 'provided' : `with ID ${defaultChannelId}`}`);
      return false;
    }
    
    if (tomorrowContests.length === 0) {
      await channel.send('No contests scheduled for tomorrow.');
      return false;
    }
    
    await channel.send(`There ${tomorrowContests.length === 1 ? 'is' : 'are'} ${tomorrowContests.length} contest${tomorrowContests.length === 1 ? '' : 's'} scheduled for tomorrow.`);
    
    for (const contest of tomorrowContests) {
      const embed = createContestEmbed(contest, 'Tomorrow');
      await channel.send({ embeds: [embed] });
    }
    
    return true;
  } catch (error) {
    console.error('Error checking tomorrow\'s contests:', error);
    return false;
  }
}

module.exports = {
  scheduleContestReminders,
  sendTodayContestReminders,
  checkTomorrowContests
}; 