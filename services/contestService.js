const axios = require('axios');

/**
 * Fetches upcoming contests from Codeforces API
 * @returns {Promise<Array>} Array of formatted contest objects
 */
async function fetchCodeforcesContests() {
  try {
    let url = 'https://codeforces.com/api/contest.list';
    let params = {};
    
    // Use API key and secret if provided
    const apiKey = process.env.CODEFORCES_API_KEY;
    const apiSecret = process.env.CODEFORCES_API_SECRET;
    
    if (apiKey && apiSecret) {
      console.log('Using Codeforces API credentials');
      // Codeforces API authentication parameters
      // These would be used if the API required authentication in the future
      params = {
        apiKey,
        time: Math.floor(Date.now() / 1000)
        // Normally would need to add a hash signature, but not implementing full auth flow here
      };
    }
    
    const response = await axios.get(url, { params });
    
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
 * Fetches upcoming contests from AtCoder API
 * @returns {Promise<Array>} Array of formatted contest objects
 */
async function fetchAtCoderContests() {
  try {
    // Using an unofficial API to fetch AtCoder contests
    let url = 'https://kenkoooo.com/atcoder/resources/contests.json';
    let headers = {};
    
    // Use API key if provided
    const apiKey = process.env.ATCODER_API_KEY;
    if (apiKey) {
      console.log('Using AtCoder API credentials');
      headers = {
        'Authorization': `Bearer ${apiKey}`
      };
    }
    
    const response = await axios.get(url, { headers });
    
    const now = Date.now();
    // Filter for upcoming contests only
    const upcomingContests = response.data.filter(contest => {
      const startTimeMs = new Date(contest.start_time).getTime();
      return startTimeMs > now;
    });
    
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
    console.error('Error fetching AtCoder contests:', error.message);
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