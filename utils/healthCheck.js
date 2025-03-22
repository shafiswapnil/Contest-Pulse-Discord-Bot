/**
 * Health check utility for the Discord bot
 * Verifies that the bot can connect to all required services
 */
const axios = require('axios');

/**
 * Checks if Codeforces API is reachable
 * @returns {Promise<boolean>} True if API is reachable
 */
async function checkCodeforcesAPI() {
  try {
    const response = await axios.get('https://codeforces.com/api/contest.list', { timeout: 5000 });
    return response.data.status === 'OK';
  } catch (error) {
    console.error('Codeforces API health check failed:', error.message);
    return false;
  }
}

/**
 * Checks if AtCoder API is reachable
 * @returns {Promise<boolean>} True if API is reachable
 */
async function checkAtCoderAPI() {
  try {
    const response = await axios.get('https://kenkoooo.com/atcoder/resources/contests.json', { timeout: 5000 });
    return Array.isArray(response.data);
  } catch (error) {
    console.error('AtCoder API health check failed:', error.message);
    return false;
  }
}

/**
 * Checks if Discord API is reachable and token is valid
 * @returns {Promise<boolean>} True if Discord API is reachable
 */
async function checkDiscordAPI() {
  try {
    // This endpoint just requires authentication, no special permissions
    const response = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`
      },
      timeout: 5000
    });
    
    return response.status === 200;
  } catch (error) {
    console.error('Discord API health check failed:', error.message);
    return false;
  }
}

/**
 * Run all health checks
 * @returns {Promise<Object>} Health check results
 */
async function runHealthChecks() {
  const discordCheck = await checkDiscordAPI();
  const codeforcesCheck = await checkCodeforcesAPI();
  const atcoderCheck = await checkAtCoderAPI();
  
  const allChecksPass = discordCheck && codeforcesCheck && atcoderCheck;
  
  return {
    status: allChecksPass ? 'healthy' : 'unhealthy',
    services: {
      discord: discordCheck ? 'ok' : 'fail',
      codeforces: codeforcesCheck ? 'ok' : 'fail',
      atcoder: atcoderCheck ? 'ok' : 'fail'
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  runHealthChecks,
  checkDiscordAPI,
  checkCodeforcesAPI,
  checkAtCoderAPI
}; 