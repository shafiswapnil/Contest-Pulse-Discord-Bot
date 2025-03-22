const { EmbedBuilder } = require('discord.js');

/**
 * Creates a Discord embed for a contest announcement
 * @param {Object} contest - Contest data object
 * @returns {EmbedBuilder} Formatted Discord embed
 */
function createContestEmbed(contest) {
  const platformColors = {
    'Codeforces': 0x1890FF,  // Blue
    'AtCoder': 0x52C41A,     // Green
    'default': 0xFADB14      // Yellow
  };
  
  const color = platformColors[contest.platform] || platformColors.default;
  
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(contest.name)
    .setURL(contest.url)
    .addFields(
      { name: 'Platform', value: contest.platform, inline: true },
      { name: 'Date', value: contest.date, inline: true },
      { name: 'Time', value: `${contest.startTime} to ${contest.endTime}`, inline: true }
    )
    .setFooter({ 
      text: `${contest.platform} Contest`, 
      iconURL: contest.platform === 'Codeforces' 
        ? 'https://codeforces.org/favicon.ico'
        : 'https://img.atcoder.jp/assets/favicon.png'
    })
    .setTimestamp();
  
  return embed;
}

module.exports = {
  createContestEmbed
}; 