const { EmbedBuilder } = require('discord.js');

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
    if (!contestsByDate[contest.date]) {
      contestsByDate[contest.date] = [];
    }
    contestsByDate[contest.date].push(contest);
  });
  
  // Add each date as a field
  for (const date in contestsByDate) {
    let contestsList = '';
    
    contestsByDate[date].forEach(contest => {
      contestsList += `**${contest.name}**\n`;
      contestsList += `Platform: ${contest.platform}\n`;
      contestsList += `Time: ${contest.startTime} to ${contest.endTime}\n`;
      contestsList += `Link: [Contest Page](${contest.url})\n\n`;
    });
    
    embed.addFields({ name: date, value: contestsList });
  }
  
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
  
  // Add fields for contest details
  embed.addFields(
    { name: 'Platform', value: contest.platform, inline: true },
    { name: 'Date', value: contest.date, inline: true },
    { name: 'Time', value: `${contest.startTime} to ${contest.endTime}`, inline: true }
  );
  
  // Add footer with time info
  embed.setFooter({ 
    text: `${contest.platform} Contest • Today at ${new Date().toLocaleTimeString()}`
  });
  
  // Add URL as author link
  embed.setURL(contest.url);
  
  return embed;
}

module.exports = {
  createContestsEmbed,
  createContestEmbed
}; 