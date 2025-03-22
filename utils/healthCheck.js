/**
 * Health check utility for the Discord bot
 * Verifies that the bot can connect to all required services
 */
const axios = require('axios');

/**
 * Sleep function for rate limiting
 * @param {number} ms - Time to sleep in milliseconds
 * @returns {Promise} Promise that resolves after the specified time
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
 * Checks if Clist.by API is reachable and credentials are valid
 * @returns {Promise<boolean>} True if API is reachable and credentials are valid
 */
async function checkClistAPI() {
  try {
    const username = process.env.CLIST_USERNAME;
    const apiKey = process.env.CLIST_API_KEY;
    
    // Check if credentials are provided
    if (!username || !apiKey || 
        username === 'your_clist_username_here' || 
        apiKey === 'your_clist_api_key_here') {
      console.log('Clist.by credentials not configured, skipping health check');
      return false;
    }
    
    const url = 'https://clist.by/api/v1/contest/';
    const params = {
      limit: 1 // Just get one contest to verify the API is working
    };
    
    // Set up authorization header based on the documentation
    const headers = {
      'Authorization': `ApiKey ${username}:${apiKey}`,
      'User-Agent': 'Discord Contest Bot'
    };
    
    console.log('Running Clist.by API health check...');
    
    // Increase timeout to 15 seconds as Clist.by API can be slow
    const response = await axios.get(url, { 
      params, 
      headers, 
      timeout: 15000 // Increased from 5000ms to 15000ms (15 seconds)
    });
    
    // Check for valid response structure
    const isValid = response.status === 200 && 
                    response.data && 
                    response.data.objects && 
                    Array.isArray(response.data.objects);
                    
    if (isValid) {
      console.log('Clist.by API health check passed');
    } else {
      console.error('Clist.by API returned unexpected data format:', response.data);
    }
    
    return isValid;
  } catch (error) {
    const errorMsg = error.response 
      ? `Status: ${error.response.status}, ${error.response.statusText}` 
      : error.message;
      
    console.error(`Clist.by API health check failed: ${errorMsg}`);
    return false;
  }
}

/**
 * Checks if AtCoder Problems API is reachable
 * Uses the unofficial API provided by kenkoooo
 * @see https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md
 * @returns {Promise<boolean>} True if API is reachable
 */
async function checkAtCoderAPI() {
  try {
    // Respect API rate limiting guidelines (sleep before request)
    await sleep(1000);

    const response = await axios.get('https://kenkoooo.com/atcoder/resources/contests.json', { 
      timeout: 5000,
      headers: {
        'User-Agent': 'Discord Contest Bot - Health Check'
      }
    });
    return Array.isArray(response.data);
  } catch (error) {
    console.error('AtCoder Problems API health check failed:', error.message);
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
  const clistCheck = await checkClistAPI();
  
  // Check if we have at least one way to fetch AtCoder contests
  const atcoderSourcesOk = atcoderCheck || clistCheck;
  
  const allChecksPass = discordCheck && codeforcesCheck && atcoderSourcesOk;
  
  return {
    status: allChecksPass ? 'healthy' : 'unhealthy',
    services: {
      discord: discordCheck ? 'ok' : 'fail',
      codeforces: codeforcesCheck ? 'ok' : 'fail',
      atcoder_problems: atcoderCheck ? 'ok' : 'fail',
      clist: clistCheck ? 'ok' : 'unavailable'
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  runHealthChecks,
  checkDiscordAPI,
  checkCodeforcesAPI,
  checkAtCoderAPI,
  checkClistAPI
}; 