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
 * Calculates and formats the time remaining between now and a future date
 * @param {Date|number} futureDate - The future date or timestamp
 * @returns {string} Human-readable time remaining (e.g., "1 day, 4 hours, 30 minutes")
 */
function formatTimeRemaining(futureDate) {
  const targetTime = futureDate instanceof Date ? futureDate.getTime() : futureDate;
  const currentTime = Date.now();
  
  // If the date is in the past, return appropriate message
  if (targetTime <= currentTime) {
    return "Started already";
  }
  
  const timeRemaining = targetTime - currentTime;
  
  // Calculate days, hours, minutes
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  
  // Format the time remaining based on how much time is left
  if (days > 0) {
    if (hours > 0) {
      return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    if (minutes > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
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
      
      // Calculate time remaining until this contest
      const timeRemaining = formatTimeRemaining(startDate);
      
      contestsList += `**${contest.name}**\n`;
      contestsList += `Platform: ${contest.platform}\n`;
      contestsList += `Time: ${startTimeFormatted} to ${endTimeFormatted}\n`;
      contestsList += `⏰ Starts in: ${timeRemaining}\n`;
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
 * @param {number} color - Optional color for the embed
 * @returns {EmbedBuilder} Discord embed with contest information
 */
function createContestEmbed(contest, timeText, color) {
  const embed = new EmbedBuilder()
    .setTitle(contest.name)
    .setColor(color || (contest.platform === 'Codeforces' ? 0x1E90FF : 0x00BFFF)) // Blue for Codeforces, Light Blue for AtCoder
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
  
  // Calculate time remaining until contest starts
  const timeRemaining = formatTimeRemaining(startDate);
  
  // Add fields for contest details
  embed.addFields(
    { name: 'Platform', value: contest.platform, inline: true },
    { name: 'Date', value: dateFormatted, inline: true },
    { name: 'Time', value: `${startTimeFormatted} to ${endTimeFormatted}`, inline: true },
    { name: '⏰ Time Remaining', value: timeRemaining, inline: false }
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
  formatDateInTimezone,
  formatTimeRemaining
}; 