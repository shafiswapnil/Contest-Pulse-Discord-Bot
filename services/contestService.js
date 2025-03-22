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
    console.log(`Using Clist.by credentials: ${username}`);
    
    // Get current time and time 7 days ahead (or whatever is configured)
    const daysAhead = parseInt(process.env.CONTEST_DAYS_AHEAD || '7', 10);
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    // Format dates for Clist.by API
    const startTime = now.toISOString();
    const endTime = futureDate.toISOString();
    
    console.log(`Looking for contests between ${startTime} and ${endTime}`);
    
    // Construct the API URL for Clist.by (using v1 which is known to work)
    const url = 'https://clist.by/api/v1/contest/';
    
    // Try different resource IDs for AtCoder
    // We'll try first with resource ID 2 which should be AtCoder
    const attemptWithResourceId = async (resourceId) => {
      console.log(`Trying Clist.by with resource ID ${resourceId}...`);
      
      // Parameters for filtering contests
      const params = {
        resource__id: resourceId,
        start__gte: startTime,
        end__lte: endTime,
        order_by: 'start',
        limit: 100
      };
      
      console.log('Using params:', JSON.stringify(params));
      
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
            console.error('Clist.by API returned unexpected data format:', typeof response.data);
            if (response.data) {
              console.log('Response data sample:', JSON.stringify(response.data).substring(0, 200));
            }
            continue; // Try again with longer timeout
          }
          
          const contests = response.data.objects;
          console.log(`Found ${contests.length} contests from Clist.by with resource ID ${resourceId}`);
          
          if (contests.length > 0) {
            console.log('First Clist.by contest sample:');
            console.log(JSON.stringify(contests[0], null, 2).substring(0, 500));
            const formatted = formatClistContests(contests);
            const atcoderContests = formatted.filter(c => c.platform === 'AtCoder');
            console.log(`Found ${atcoderContests.length} AtCoder contests after filtering`);
            
            if (atcoderContests.length > 0) {
              return atcoderContests;
            }
          }
          
          // If we reach here with no contests found, the loop will exit and try another resource ID
          break;
        } catch (error) {
          lastError = error;
          const errorMsg = error.response 
            ? `Status: ${error.response.status}, ${error.response.statusText}` 
            : error.message;
            
          console.error(`Clist.by API attempt ${attempts} with resource ID ${resourceId} failed: ${errorMsg}`);
          
          // If it's not a timeout error, no point in retrying
          if (error.code !== 'ECONNABORTED' && error.code !== 'ETIMEDOUT') {
            break;
          }
          
          // Wait a bit before retrying
          await sleep(1000);
        }
      }
      
      return null; // No AtCoder contests found with this resource ID
    };
    
    // Try with different resource IDs
    let atcoderContests = await attemptWithResourceId(2); // Try ID 2 first
    
    if (!atcoderContests || atcoderContests.length === 0) {
      console.log('No AtCoder contests found with resource ID 2, trying with ID 93...');
      atcoderContests = await attemptWithResourceId(93); // Try with ID 93 (another possible value)
    }
    
    if (!atcoderContests || atcoderContests.length === 0) {
      // Try without specifying a resource ID but with "atcoder" in the title
      console.log('No AtCoder contests found with specific resource IDs, trying with title search...');
      
      const params = {
        start__gte: startTime,
        end__lte: endTime,
        order_by: 'start',
        limit: 100,
        event__icontains: 'atcoder', // Search for "atcoder" in event title
      };
      
      const headers = {
        'Authorization': `ApiKey ${username}:${apiKey}`,
        'User-Agent': 'Discord Contest Bot'
      };
      
      try {
        const response = await axios.get(url, { params, headers, timeout: 10000 });
        
        if (response.data && response.data.objects && Array.isArray(response.data.objects)) {
          const contests = response.data.objects;
          console.log(`Found ${contests.length} contests with "atcoder" in title`);
          
          if (contests.length > 0) {
            const formatted = formatClistContests(contests);
            atcoderContests = formatted.filter(c => c.platform === 'AtCoder');
            console.log(`Found ${atcoderContests.length} AtCoder contests after filtering by title`);
            
            if (atcoderContests.length > 0) {
              return atcoderContests;
            }
          }
        }
      } catch (error) {
        console.error('Error searching for AtCoder contests by title:', error.message);
      }
    }
    
    // If we found any AtCoder contests, return them
    if (atcoderContests && atcoderContests.length > 0) {
      return atcoderContests;
    }
    
    console.log('No AtCoder contests found in Clist.by with any method, falling back to AtCoder Problems API...');
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
  console.log(`Formatting ${contests.length} contests from Clist.by API`);
  
  // Count platforms before filtering
  const platformCounts = {};
  contests.forEach(contest => {
    const resource = contest.resource?.name || 'unknown';
    platformCounts[resource] = (platformCounts[resource] || 0) + 1;
  });
  console.log('Platform distribution in raw data:', JSON.stringify(platformCounts));
  
  return contests.map(contest => {
    try {
      // Handle potential differences in field names between versions
      const startField = contest.start || contest.startTime || contest.start_time;
      const endField = contest.end || contest.endTime || contest.end_time;
      const eventField = contest.event || contest.name || contest.title;
      const urlField = contest.href || contest.url || contest.link;
      const resourceField = contest.resource?.name || contest.platform || '';
      
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
      const resourceName = resourceField.toLowerCase();
      
      // Log the resource info for debugging
      if (resourceName && resourceName.includes('atcoder')) {
        console.log(`Found AtCoder contest in Clist data: ${eventField}`);
        platform = 'AtCoder';
      } else if (resourceName && resourceName.includes('codeforces')) {
        platform = 'Codeforces';
      } else if (urlField && urlField.includes('atcoder.jp')) {
        console.log(`Found AtCoder contest by URL: ${eventField}`);
        platform = 'AtCoder';
      } else if (urlField && urlField.includes('codeforces.com')) {
        platform = 'Codeforces';
      } else if (eventField && eventField.toLowerCase().includes('atcoder')) {
        console.log(`Found AtCoder contest by name: ${eventField}`);
        platform = 'AtCoder';
      } else if (eventField && eventField.toLowerCase().includes('codeforces')) {
        platform = 'Codeforces';
      }
      
      // Skip contests with unknown platform
      if (platform === 'Unknown') {
        console.log(`Platform unknown for contest: ${eventField}, URL: ${urlField}, resource: ${resourceField}`);
        return null;
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
    
    // Try direct contest page scraping first for the most up-to-date data
    let scrapedContests = [];
    try {
      const directUrl = 'https://atcoder.jp/contests/';
      console.log(`Trying direct fetch from ${directUrl} for backup...`);
      
      const response = await axios.get(directUrl, { 
        timeout: 15000,
        headers: {
          'User-Agent': 'Discord Contest Bot - Respecting API Guidelines'
        }
      });
      
      if (response.data && typeof response.data === 'string') {
        console.log('Received HTML response from AtCoder website directly, parsing contests...');
        
        // Very basic HTML parsing to extract contest info
        // Look for the upcoming contests table
        const html = response.data;
        
        // Look for the upcoming contests section
        const upcomingSection = html.includes('Upcoming Contests') 
          ? html.split('Upcoming Contests')[1] 
          : (html.includes('予定されたコンテスト') ? html.split('予定されたコンテスト')[1] : '');
          
        if (upcomingSection) {
          console.log('Found upcoming contests section on AtCoder website');
          
          // Extract contest rows - this is a simple parser and might break if AtCoder changes their HTML
          const contestRows = upcomingSection.split('<tr>').slice(1);
          const now = Date.now();
          
          for (const row of contestRows) {
            try {
              // Extract contest name
              const nameMatch = row.match(/<a href="\/contests\/([^"]+)">(.*?)<\/a>/);
              if (!nameMatch) continue;
              
              const contestId = nameMatch[1];
              const contestName = nameMatch[2].trim();
              
              // Extract start time 
              const startTimeMatch = row.match(/>\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*</);
              if (!startTimeMatch) continue;
              
              const startTimeString = startTimeMatch[1];
              const startTimeMs = new Date(startTimeString + ' UTC+9').getTime(); // AtCoder times are JST
              
              // Skip past contests
              if (startTimeMs < now) continue;
              
              // Extract duration
              const durationMatch = row.match(/>\s*([\d:]+)\s*</);
              const durationString = durationMatch ? durationMatch[1] : '2:00';
              const [hours, minutes] = durationString.split(':').map(Number);
              const durationMs = (hours * 60 + minutes) * 60 * 1000;
              const endTimeMs = startTimeMs + durationMs;
              
              const startDate = new Date(startTimeMs);
              const endDate = new Date(endTimeMs);
              
              scrapedContests.push({
                platform: 'AtCoder',
                name: contestName,
                date: startDate.toDateString(),
                startTime: startDate.toLocaleTimeString(),
                endTime: endDate.toLocaleTimeString(),
                startTimeMs,
                endTimeMs,
                url: `https://atcoder.jp/contests/${contestId}`,
              });
              
              console.log(`Scraped contest: ${contestName} at ${startDate.toLocaleString()}`);
            } catch (err) {
              console.log('Error parsing contest row, skipping', err.message);
            }
          }
          
          if (scrapedContests.length > 0) {
            console.log(`Successfully scraped ${scrapedContests.length} contests from AtCoder website`);
            return scrapedContests;
          }
        }
      }
    } catch (err) {
      console.log('Direct AtCoder website fetch or parsing failed:', err.message);
    }
    
    // Continue with the AtCoder Problems API
    const url = 'https://kenkoooo.com/atcoder/resources/contests.json';
    
    // Respect API rate limiting guidelines (sleep at least 1 second between accesses)
    await sleep(1000);
    
    const response = await axios.get(url, { 
      timeout: 15000, // Increased timeout
      headers: {
        'User-Agent': 'Discord Contest Bot - Respecting API Guidelines'
      }
    });
    
    if (!Array.isArray(response.data)) {
      console.error('AtCoder Problems API returned invalid data format:', typeof response.data);
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
    if (upcomingContests.length > 0) {
      console.log('First AtCoder contest from API:');
      console.log(JSON.stringify(upcomingContests[0], null, 2));
    }
    
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
        
        // Check to ensure this is truly an AtCoder contest
        const isActuallyAtCoder = 
          contest.id && (contest.id.startsWith('abc') || 
                         contest.id.startsWith('arc') || 
                         contest.id.startsWith('agc') ||
                         contest.id.includes('atcoder'));
                         
        // Determine the platform based on contest ID or title
        let platform = isActuallyAtCoder ? 'AtCoder' : 'Unknown';  
        
        // If contest title or ID contains "codeforces", override the platform
        if ((contest.title && contest.title.toLowerCase().includes('codeforces')) || 
            (contest.id && contest.id.toLowerCase().includes('codeforces'))) {
          platform = 'Codeforces';
        }
        
        // Skip contests with unknown platform
        if (platform === 'Unknown') {
          console.warn(`Skipping contest with unknown platform: ${contest.id || 'unknown'} - ${contest.title || 'untitled'}`);
          return null;
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
    // Get the number of days to look ahead (default: 7)
    const daysAhead = parseInt(process.env.CONTEST_DAYS_AHEAD || '7', 10);
    
    // For AtCoder, we'll look further ahead to ensure we get contests
    const atcoderDaysAhead = Math.max(daysAhead, 45); // Look up to 45 days ahead for AtCoder
    
    console.log(`Looking ahead ${daysAhead} days for contests, ${atcoderDaysAhead} days for AtCoder specifically`);
    
    // Modify the environment temporarily for AtCoder fetching
    const originalDaysAhead = process.env.CONTEST_DAYS_AHEAD;
    process.env.CONTEST_DAYS_AHEAD = atcoderDaysAhead.toString();
    
    // Fetch AtCoder contests with extended timeframe
    const atcoderContests = await fetchAtCoderContests();
    
    // Restore original setting
    process.env.CONTEST_DAYS_AHEAD = originalDaysAhead;
    
    // Fetch Codeforces with normal timeframe
    const codeforcesContests = await fetchCodeforcesContests();
    
    // Log details about the fetched contests
    console.log(`Fetched ${codeforcesContests.length} Codeforces contests`);
    console.log(`Fetched ${atcoderContests.length} AtCoder contests`);
    
    if (atcoderContests.length === 0) {
      console.log('WARNING: No AtCoder contests found. This might indicate an issue with the Clist.by API or AtCoder Problems API.');
    }
    
    // Combine contests from both platforms
    let allContests = [...codeforcesContests, ...atcoderContests];
    
    // Get the current date and the date X days from now (using standard daysAhead)
    const now = Date.now();
    const futureDateMs = now + daysAhead * 24 * 60 * 60 * 1000;
    
    // Filter contests happening in the specified time range
    const filteredContests = allContests.filter(contest => {
      const isInTimeRange = contest.startTimeMs >= now && contest.startTimeMs <= futureDateMs;
      if (!isInTimeRange && contest.platform === 'AtCoder') {
        console.log(`AtCoder contest "${contest.name}" excluded because it's scheduled for ${new Date(contest.startTimeMs).toLocaleString()}, which is outside the ${daysAhead}-day window`);
      }
      return isInTimeRange;
    });
    
    console.log(`After date filtering: ${filteredContests.length} total contests remain`);
    console.log(`AtCoder contests after filtering: ${filteredContests.filter(c => c.platform === 'AtCoder').length}`);
    
    // Sort contests by start time (earliest first)
    filteredContests.sort((a, b) => a.startTimeMs - b.startTimeMs);
    
    return filteredContests;
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