const { EmbedBuilder } = require('discord.js');

/**
 * Formats a date based on the configured timezone
 * @param {Date} date - The date to format
 * @param {string} format - The format to use (date, time, or datetime)
 * @returns {string} Formatted date string
 */
function formatDateInTimezone(date, format = 'datetime') {
  // Use the timezone from environment variables or default to UTC
  const timezone = process.env.TIMEZONE || 'UTC';
  
  // Options for different format types
  const options = {
    date: { 
      timeZone: timezone,
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    },
    time: { 
      timeZone: timezone,
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true
    },
    datetime: { 
      timeZone: timezone,
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true
    }
  };
  
  try {
    return date.toLocaleString('en-US', options[format]);
  } catch (error) {
    console.error(`Error formatting date with timezone ${timezone}:`, error);
    // Fallback to local time if timezone is invalid
    return format === 'date' ? date.toDateString() : 
           format === 'time' ? date.toLocaleTimeString() : 
           date.toLocaleString();
  }
}

/**
 * Creates an embed for a list of contests
 * @param {Array} contests - Array of contest objects
 * @returns {EmbedBuilder} Discord embed with contest information
 */
function createContestsEmbed(contests) {
  const embed = new EmbedBuilder()
    .setTitle('Upcoming Programming Contests')
    .setColor(0x00AE86)
    .setTimestamp();
  
  if (contests.length === 0) {
    embed.setDescription('No upcoming contests found in the next few days.');
    return embed;
  }
  
  // Group contests by date for better organization
  const contestsByDate = {};
  
  contests.forEach(contest => {
    // Get date in configured timezone
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
      // Calculate end date correctly
      let endDate;
      
      if (contest.endTimeMs) {
        // If we have endTimeMs directly
        endDate = new Date(contest.endTimeMs);
      } else if (typeof contest.endTime === 'string' && !contest.endTime.includes('Invalid')) {
        // If endTime is a valid string
        endDate = new Date(contest.endTime);
      } else {
        // Default duration (2 hours)
        endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
      }
      
      const startTimeFormatted = formatDateInTimezone(startDate, 'time');
      const endTimeFormatted = formatDateInTimezone(endDate, 'time');
      
      contestsList += `**${contest.name}**\n`;
      contestsList += `Platform: ${contest.platform}\n`;
      contestsList += `Time: ${startTimeFormatted} to ${endTimeFormatted}\n`;
      contestsList += `Link: [Contest Page](${contest.url})\n\n`;
    });
    
    embed.addFields({ name: date, value: contestsList });
  }
  
  embed.setFooter({ 
    text: `All times are shown in ${process.env.TIMEZONE || 'UTC'} timezone`
  });
  
  return embed;
}

/**
 * Creates an embed for a single contest
 * @param {Object} contest - Contest object
 * @param {string} timeText - Text describing when the contest starts (e.g., "in 1 day")
 * @returns {EmbedBuilder} Discord embed with contest information
 */
function createContestEmbed(contest, timeText) {
  const embed = new EmbedBuilder()
    .setTitle(contest.name)
    .setColor(contest.platform === 'Codeforces' ? 0x1E90FF : 0x00BFFF) // Blue for Codeforces, Light Blue for AtCoder
    .setTimestamp();
  
  // Add a small colored bar to the left side based on time remaining
  let colorBar = '🟦'; // Default blue
  if (timeText.includes('hour')) {
    colorBar = '🟨'; // Yellow for hours
  } else if (timeText.includes('min')) {
    colorBar = '🟥'; // Red for minutes
  }
  
  // Format dates in the configured timezone
  const startDate = new Date(contest.startTimeMs);
  
  // Calculate end date correctly
  let endDate;
  if (contest.endTimeMs) {
    // If we have endTimeMs directly
    endDate = new Date(contest.endTimeMs);
  } else if (typeof contest.endTime === 'string' && !contest.endTime.includes('Invalid')) {
    // If endTime is a valid string
    endDate = new Date(contest.endTime);
  } else {
    // Default duration (2 hours)
    endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  }
  
  const dateFormatted = formatDateInTimezone(startDate, 'date');
  const startTimeFormatted = formatDateInTimezone(startDate, 'time');
  const endTimeFormatted = formatDateInTimezone(endDate, 'time');
  
  // Add fields for contest details
  embed.addFields(
    { name: 'Platform', value: contest.platform, inline: true },
    { name: 'Date', value: dateFormatted, inline: true },
    { name: 'Time', value: `${startTimeFormatted} to ${endTimeFormatted}`, inline: true }
  );
  
  // Add footer with time info and timezone
  const now = new Date();
  embed.setFooter({ 
    text: `${contest.platform} Contest • ${formatDateInTimezone(now, 'datetime')} (${process.env.TIMEZONE || 'UTC'})`
  });
  
  // Add URL as author link
  embed.setURL(contest.url);
  
  return embed;
}

module.exports = {
  createContestsEmbed,
  createContestEmbed,
  formatDateInTimezone
}; 