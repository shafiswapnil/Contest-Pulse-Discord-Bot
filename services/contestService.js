const axios = require('axios');

/**
 * Fetches upcoming contests from Codeforces API
 * @returns {Promise<Array>} Array of formatted contest objects
 */
async function fetchCodeforcesContests() {
  try {
    let url = 'https://codeforces.com/api/contest.list';
    
    // Check if API credentials are provided
    const apiKey = process.env.CODEFORCES_API_KEY;
    const apiSecret = process.env.CODEFORCES_API_SECRET;
    
    // Only use credentials if both key and secret are provided and not empty placeholders
    const useCredentials = 
      apiKey && 
      apiSecret && 
      apiKey !== 'your_codeforces_api_key_here' &&
      apiSecret !== 'your_codeforces_api_secret_here';
    
    let response;
    if (useCredentials) {
      console.log('Using Codeforces API credentials');
      // Implement proper Codeforces authentication if needed in the future
      // Currently not implementing full authentication as the public API works without it
      
      // For now, log a warning and use the public API instead
      console.log('Warning: Codeforces API authentication is not fully implemented. Using public API instead.');
    }
    
    // Always use the public API for now
    response = await axios.get(url);
    
    if (response.data.status !== 'OK') {
      console.error('Codeforces API returned non-OK status:', response.data.status);
      return [];
    }
    
    // Filter for upcoming contests only (phase === 'BEFORE')
    const upcomingContests = response.data.result.filter(contest => contest.phase === 'BEFORE');
    
    // Format contests to a standardized structure
    return upcomingContests.map(contest => {
      // Codeforces provides time in seconds since epoch
      const startTimeMs = contest.startTimeSeconds * 1000;
      const durationMs = contest.durationSeconds * 1000;
      const endTimeMs = startTimeMs + durationMs;
      
      const startDate = new Date(startTimeMs);
      const endDate = new Date(endTimeMs);
      
      return {
        platform: 'Codeforces',
        name: contest.name,
        date: startDate.toDateString(),
        startTime: startDate.toLocaleTimeString(),
        endTime: endDate.toLocaleTimeString(),
        startTimeMs,
        url: `https://codeforces.com/contests/${contest.id}`,
      };
    });
  } catch (error) {
    console.error('Error fetching Codeforces contests:', error.message);
    return [];
  }
}

/**
 * Sleep function for rate limiting
 * @param {number} ms - Time to sleep in milliseconds
 * @returns {Promise} Promise that resolves after the specified time
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches upcoming contests from Clist.by API v4 for AtCoder
 * @see https://clist.by/api/v4/doc/
 * @returns {Promise<Array>} Array of formatted contest objects
 */
async function fetchAtCoderContests() {
  try {
    const username = process.env.CLIST_USERNAME;
    const apiKey = process.env.CLIST_API_KEY;
    
    // Check if Clist.by credentials are provided
    if (!username || !apiKey || 
        username === 'your_clist_username_here' || 
        apiKey === 'your_clist_api_key_here') {
      console.error('Clist.by credentials are not configured. Please set CLIST_USERNAME and CLIST_API_KEY in your .env file.');
      console.log('Attempting to fall back to the unofficial AtCoder Problems API...');
      return fetchAtCoderContestsFromProblems();
    }
    
    console.log('Fetching AtCoder contests from Clist.by API v4...');
    
    // Get current time and time 7 days ahead (or whatever is configured)
    const daysAhead = parseInt(process.env.CONTEST_DAYS_AHEAD || '7', 10);
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    // Format dates for Clist.by API
    const startTime = now.toISOString();
    const endTime = futureDate.toISOString();
    
    // Construct the API URL for Clist.by v4
    const url = 'https://clist.by/api/v4/contests/';
    const params = {
      username: username,
      api_key: apiKey,
      resource: 'atcoder.jp', // Filter to only AtCoder contests
      start__gte: startTime,  // Start time greater than or equal to now
      end__lte: endTime,      // End time less than or equal to future date
      order_by: 'start',      // Order by start time
      limit: 100              // Limit the number of results
    };
    
    // Make the API request
    const response = await axios.get(url, { params });
    
    // Check if the response has the expected format
    // Note: The structure of response might be different in v4 compared to v2
    if (!response.data || !response.data.objects || !Array.isArray(response.data.objects)) {
      console.error('Clist.by API v4 returned unexpected data format:', response.data);
      
      // If the response structure is different in v4, try to adapt
      if (response.data && Array.isArray(response.data.results)) {
        console.log('Found alternate data structure in v4 API, adapting...');
        const contests = response.data.results;
        return formatClistContests(contests);
      }
      
      if (response.data && Array.isArray(response.data)) {
        console.log('Found direct array in v4 API response, adapting...');
        return formatClistContests(response.data);
      }
      
      return fetchAtCoderContestsFromProblems();
    }
    
    const contests = response.data.objects;
    console.log(`Found ${contests.length} upcoming AtCoder contests from Clist.by v4`);
    
    return formatClistContests(contests);
  } catch (error) {
    console.error('Error fetching AtCoder contests from Clist.by v4:', error.message);
    console.log('Falling back to unofficial AtCoder Problems API...');
    return fetchAtCoderContestsFromProblems();
  }
}

/**
 * Helper function to format contest data from Clist.by API
 * @param {Array} contests - Array of contest objects from Clist.by
 * @returns {Array} Formatted contest objects
 */
function formatClistContests(contests) {
  return contests.map(contest => {
    // Handle potential differences in field names between v2 and v4
    const startField = contest.start || contest.startTime || contest.start_time;
    const endField = contest.end || contest.endTime || contest.end_time;
    const eventField = contest.event || contest.name || contest.title;
    const urlField = contest.href || contest.url || contest.link;
    
    const startTimeMs = new Date(startField).getTime();
    const endTimeMs = new Date(endField).getTime();
    
    const startDate = new Date(startTimeMs);
    const endDate = new Date(endTimeMs);
    
    return {
      platform: 'AtCoder',
      name: eventField,
      date: startDate.toDateString(),
      startTime: startDate.toLocaleTimeString(),
      endTime: endDate.toLocaleTimeString(),
      startTimeMs,
      url: urlField,
    };
  });
}

/**
 * Fallback function to fetch contests from unofficial AtCoder Problems API
 * @returns {Promise<Array>} Array of formatted contest objects
 */
async function fetchAtCoderContestsFromProblems() {
  try {
    // Using the unofficial AtCoder Problems API by kenkoooo
    console.log('Fetching contests from AtCoder Problems API...');
    
    const url = 'https://kenkoooo.com/atcoder/resources/contests.json';
    
    // Respect API rate limiting guidelines (sleep at least 1 second between accesses)
    await sleep(1000);
    
    const response = await axios.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Discord Contest Bot - Respecting API Guidelines'
      }
    });
    
    if (!Array.isArray(response.data)) {
      console.error('AtCoder Problems API returned invalid data format');
      return [];
    }
    
    const now = Date.now();
    // Filter for upcoming contests only
    const upcomingContests = response.data.filter(contest => {
      // The API provides start_time and end_time as ISO 8601 strings
      const startTimeMs = new Date(contest.start_time).getTime();
      return startTimeMs > now;
    });
    
    console.log(`Found ${upcomingContests.length} upcoming AtCoder contests from Problems API`);
    
    // Format contests to a standardized structure
    return upcomingContests.map(contest => {
      const startTimeMs = new Date(contest.start_time).getTime();
      const endTimeMs = new Date(contest.end_time).getTime();
      
      const startDate = new Date(startTimeMs);
      const endDate = new Date(endTimeMs);
      
      return {
        platform: 'AtCoder',
        name: contest.title,
        date: startDate.toDateString(),
        startTime: startDate.toLocaleTimeString(),
        endTime: endDate.toLocaleTimeString(),
        startTimeMs,
        url: `https://atcoder.jp/contests/${contest.id}`,
      };
    });
  } catch (error) {
    console.error('Error fetching AtCoder contests from Problems API:', error.message);
    return [];
  }
}

/**
 * Fetches contests from all platforms and filters for the next X days
 * @returns {Promise<Array>} Combined array of contest objects sorted by start time
 */
async function fetchContests() {
  try {
    // Fetch contests from both platforms in parallel
    const [codeforcesContests, atcoderContests] = await Promise.all([
      fetchCodeforcesContests(),
      fetchAtCoderContests()
    ]);
    
    // Combine contests from both platforms
    let allContests = [...codeforcesContests, ...atcoderContests];
    
    // Get the number of days to look ahead (default: 7)
    const daysAhead = parseInt(process.env.CONTEST_DAYS_AHEAD || '7', 10);
    
    // Get the current date and the date X days from now
    const now = Date.now();
    const futureDateMs = now + daysAhead * 24 * 60 * 60 * 1000;
    
    // Filter contests happening in the specified time range
    allContests = allContests.filter(contest => {
      return contest.startTimeMs >= now && contest.startTimeMs <= futureDateMs;
    });
    
    // Sort contests by start time (earliest first)
    allContests.sort((a, b) => a.startTimeMs - b.startTimeMs);
    
    return allContests;
  } catch (error) {
    console.error('Error fetching contests:', error.message);
    return [];
  }
}

module.exports = {
  fetchContests,
  fetchCodeforcesContests,
  fetchAtCoderContests
}; 