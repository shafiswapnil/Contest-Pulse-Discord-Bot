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
        endTimeMs,
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
 * Fetches upcoming contests from Clist.by API for AtCoder
 * @see https://clist.by/api/v1/doc/
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
    
    console.log('Fetching AtCoder contests from Clist.by API...');
    
    // Get current time and time 7 days ahead (or whatever is configured)
    const daysAhead = parseInt(process.env.CONTEST_DAYS_AHEAD || '7', 10);
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    // Format dates for Clist.by API
    const startTime = now.toISOString();
    const endTime = futureDate.toISOString();
    
    // Construct the API URL for Clist.by (using v1 which is known to work)
    const url = 'https://clist.by/api/v1/contest/';
    
    // Parameters for filtering contests
    const params = {
      resource__id: 1, // AtCoder's resource ID is 1 in Clist.by
      start__gte: startTime,  // Start time greater than or equal to now
      end__lte: endTime,      // End time less than or equal to future date
      order_by: 'start',      // Order by start time
      limit: 100              // Limit the number of results
    };
    
    // Set up authorization header based on the documentation
    const headers = {
      'Authorization': `ApiKey ${username}:${apiKey}`,
      'User-Agent': 'Discord Contest Bot'
    };
    
    // Try up to 3 times with increasing timeouts
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;
    
    while (attempts < maxAttempts) {
      attempts++;
      const timeout = 10000 * attempts; // 10s, 20s, 30s
      
      try {
        console.log(`Clist.by API attempt ${attempts}/${maxAttempts} with ${timeout}ms timeout...`);
        
        // Make the API request with authorization header
        const response = await axios.get(url, { 
          params, 
          headers,
          timeout: timeout
        });
        
        // Check if the response has the expected format
        if (!response.data || !response.data.objects || !Array.isArray(response.data.objects)) {
          console.error('Clist.by API returned unexpected data format:', response.data);
          continue; // Try again with longer timeout
        }
        
        const contests = response.data.objects;
        console.log(`Found ${contests.length} upcoming AtCoder contests from Clist.by`);
        
        return formatClistContests(contests);
      } catch (error) {
        lastError = error;
        const errorMsg = error.response 
          ? `Status: ${error.response.status}, ${error.response.statusText}` 
          : error.message;
          
        console.error(`Clist.by API attempt ${attempts} failed: ${errorMsg}`);
        
        // If it's not a timeout error, no point in retrying
        if (error.code !== 'ECONNABORTED' && error.code !== 'ETIMEDOUT') {
          break;
        }
        
        // Wait a bit before retrying
        await sleep(1000);
      }
    }
    
    console.error(`Failed to fetch from Clist.by API after ${maxAttempts} attempts: ${lastError?.message}`);
    console.log('Falling back to unofficial AtCoder Problems API...');
    return fetchAtCoderContestsFromProblems();
  } catch (error) {
    console.error('Error fetching AtCoder contests from Clist.by:', error.message);
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
    try {
      // Handle potential differences in field names between versions
      const startField = contest.start || contest.startTime || contest.start_time;
      const endField = contest.end || contest.endTime || contest.end_time;
      const eventField = contest.event || contest.name || contest.title;
      const urlField = contest.href || contest.url || contest.link;
      const resourceField = contest.resource || contest.platform || '';
      
      const startTimeMs = new Date(startField).getTime();
      const endTimeMs = new Date(endField).getTime();
      
      // Skip contests with invalid dates
      if (isNaN(startTimeMs) || isNaN(endTimeMs)) {
        console.warn(`Skipping contest with invalid date: ${eventField || 'unknown contest'}`);
        return null;
      }
      
      const startDate = new Date(startTimeMs);
      const endDate = new Date(endTimeMs);
      
      // Determine platform based on URL, resource field, or title
      let platform = 'Unknown';
      
      if (resourceField && typeof resourceField === 'string') {
        if (resourceField.toLowerCase().includes('atcoder')) {
          platform = 'AtCoder';
        } else if (resourceField.toLowerCase().includes('codeforces')) {
          platform = 'Codeforces';
        }
      }
      
      // If no platform determined yet, check the URL
      if (platform === 'Unknown' && urlField) {
        if (urlField.includes('atcoder.jp')) {
          platform = 'AtCoder';
        } else if (urlField.includes('codeforces.com')) {
          platform = 'Codeforces';
        }
      }
      
      // If still unknown, try to determine from the event name
      if (platform === 'Unknown' && eventField) {
        if (eventField.toLowerCase().includes('atcoder')) {
          platform = 'AtCoder';
        } else if (eventField.toLowerCase().includes('codeforces')) {
          platform = 'Codeforces';
        }
      }
      
      return {
        platform: platform,
        name: eventField,
        date: startDate.toDateString(),
        startTime: startDate.toLocaleTimeString(),
        endTime: endDate.toLocaleTimeString(),
        startTimeMs,
        endTimeMs,
        url: urlField,
      };
    } catch (err) {
      console.error(`Error processing Clist contest: ${contest.event || contest.name || 'unknown contest'}`, err);
      return null;
    }
  }).filter(contest => contest !== null);  // Filter out null entries
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
      try {
        // The API provides start_time and end_time as ISO 8601 strings
        const startTimeMs = new Date(contest.start_time).getTime();
        return startTimeMs > now && !isNaN(startTimeMs);
      } catch (err) {
        console.error(`Error filtering contest: ${contest.id || 'unknown contest'}`);
        return false;
      }
    });
    
    console.log(`Found ${upcomingContests.length} upcoming AtCoder contests from Problems API`);
    
    // Format contests to a standardized structure
    return upcomingContests.map(contest => {
      try {
        const startTimeMs = new Date(contest.start_time).getTime();
        const endTimeMs = new Date(contest.end_time).getTime();
        
        const startDate = new Date(startTimeMs);
        const endDate = new Date(endTimeMs);
        
        // Only include contests with valid dates
        if (isNaN(startTimeMs) || isNaN(endTimeMs)) {
          console.warn(`Skipping contest with invalid date: ${contest.id || 'unknown contest'}`);
          return null;
        }
        
        // Determine the platform based on contest ID or title
        let platform = 'AtCoder';  // Default is AtCoder since this API is primarily for AtCoder
        
        // If contest title or ID contains "codeforces", override the platform
        if ((contest.title && contest.title.toLowerCase().includes('codeforces')) || 
            (contest.id && contest.id.toLowerCase().includes('codeforces'))) {
          platform = 'Codeforces';
        }
        
        return {
          platform: platform,
          name: contest.title,
          date: startDate.toDateString(),
          startTime: startDate.toLocaleTimeString(),
          endTime: endDate.toLocaleTimeString(),
          startTimeMs,
          endTimeMs,
          url: platform === 'Codeforces' 
             ? `https://codeforces.com/contests/${contest.id}`
             : `https://atcoder.jp/contests/${contest.id}`,
        };
      } catch (err) {
        console.error(`Error processing contest: ${contest.id || 'unknown contest'}`, err);
        return null;
      }
    }).filter(contest => contest !== null);  // Filter out null entries
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