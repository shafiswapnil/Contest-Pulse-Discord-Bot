const axios = require('axios');

/**
 * Fetches upcoming contests from Codeforces API
 * @returns {Promise<Array>} Array of formatted contest objects
 */
async function fetchCodeforcesContests(startTime, endTime) {
  try {
    console.log('Fetching Codeforces contests...');
    
    // Fetching directly from Codeforces API
    const response = await axios.get('https://codeforces.com/api/contest.list', {
      timeout: 10000
    });
    
    if (response.data && response.data.status === 'OK') {
      // Filter for only upcoming contests (those with negative relativeTimeSeconds)
      const upcomingContests = response.data.result
        .filter(contest => contest.phase === 'BEFORE')
        .map(contest => {
          // Calculate start and end times
          const startTimeMs = (contest.startTimeSeconds * 1000);
          const endTimeMs = startTimeMs + (contest.durationSeconds * 1000);
          
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
            url: `https://codeforces.com/contests/${contest.id}`
          };
        });
      
      // Get the current time and filter based on provided date range
      const now = new Date(startTime).getTime();
      const maxDate = new Date(endTime).getTime();
      
      // Filter out contests that are too far in the future based on daysAhead
      const filteredContests = upcomingContests.filter(contest => 
        contest.startTimeMs >= now && contest.startTimeMs <= maxDate
      );
      
      console.log(`Fetched ${filteredContests.length} upcoming Codeforces contests`);
      return filteredContests;
    } else {
      console.error('Error fetching from Codeforces API: Invalid response format');
      return [];
    }
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
async function fetchAtCoderContests(startTime, endTime) {
  try {
    // First, try to get from Clist.by API
    let contests = await fetchAtCoderContestsFromClist(startTime, endTime);
    
    // If we didn't get any contests, try the AtCoder Problems API as a fallback
    if (!contests || contests.length === 0) {
      console.log('No AtCoder contests found from Clist.by, trying AtCoder Problems API...');
      contests = await fetchAtCoderContestsFromProblems();
      
      // Filter by date range if we got contests
      if (contests && contests.length > 0) {
        const now = new Date(startTime).getTime();
        const maxDate = new Date(endTime).getTime();
        
        contests = contests.filter(contest => 
          contest.startTimeMs >= now && contest.startTimeMs <= maxDate
        );
      }
    }
    
    console.log(`Fetched ${contests.length} upcoming AtCoder contests`);
    return contests;
  } catch (error) {
    console.error('Error fetching AtCoder contests:', error.message);
    return [];
  }
}

/**
 * Fetches AtCoder contests from the Clist.by API
 * @param {string} startTime - ISO string for start time
 * @param {string} endTime - ISO string for end time 
 * @returns {Promise<Array>} Array of contest objects
 */
async function fetchAtCoderContestsFromClist(startTime, endTime) {
  try {
    const username = process.env.CLIST_USERNAME;
    const apiKey = process.env.CLIST_API_KEY;
    
    // Check if Clist.by credentials are provided
    if (!username || !apiKey || 
        username === 'your_clist_username_here' || 
        apiKey === 'your_clist_api_key_here') {
      console.log('Clist.by credentials not configured');
      return [];
    }
    
    console.log('Fetching AtCoder contests from Clist.by API...');
    
    // Construct the API URL for Clist.by
    const url = 'https://clist.by/api/v1/contest/';
    
    // Try to find the correct AtCoder resource ID
    let resourceId = null;
    try {
      // Find available resources
      const resourcesHeaders = {
        'Authorization': `ApiKey ${username}:${apiKey}`,
        'User-Agent': 'Discord Contest Bot'
      };
      
      const resourcesResponse = await axios.get('https://clist.by/api/v1/resource/', { 
        headers: resourcesHeaders,
        timeout: 10000
      });
      
      if (resourcesResponse.data && resourcesResponse.data.objects) {
        const resources = resourcesResponse.data.objects;
        console.log(`Found ${resources.length} resources from Clist.by`);
        
        // Look for AtCoder by name or host
        for (const resource of resources) {
          if (resource.host && resource.host.includes('atcoder.jp')) {
            resourceId = resource.id;
            break;
          }
          else if (!resourceId && resource.name && resource.name.toLowerCase().includes('atcoder')) {
            resourceId = resource.id;
            break;
          }
        }
      }
    } catch (error) {
      console.log('Error checking resources:', error.message);
    }
    
    // If not found, try common IDs
    if (!resourceId) {
      console.log('Looking for AtCoder in common resource IDs...');
      const commonIds = [93, 1, 2, 102];
      
      for (const id of commonIds) {
        try {
          const testParams = {
            resource__id: id,
            start__gte: startTime,
            end__lte: endTime,
            limit: 5
          };
          
          const testHeaders = {
            'Authorization': `ApiKey ${username}:${apiKey}`,
            'User-Agent': 'Discord Contest Bot'
          };
          
          const testResponse = await axios.get(url, { 
            params: testParams, 
            headers: testHeaders,
            timeout: 5000
          });
          
          if (testResponse.data?.objects?.length > 0) {
            const firstContest = testResponse.data.objects[0];
            if (firstContest.href && firstContest.href.includes('atcoder.jp')) {
              resourceId = id;
              break;
            }
          }
        } catch (error) {
          // Log only on the last attempt
          if (id === commonIds[commonIds.length - 1]) {
            console.log('Error testing resource IDs');
          }
        }
      }
    }
    
    // If still not found, try with title search
    if (!resourceId) {
      console.log('Could not find AtCoder resource ID, trying title search...');
      
      try {
        const titleParams = {
          event__icontains: 'atcoder',
          start__gte: startTime,
          end__lte: endTime,
          limit: 100
        };
        
        const headers = {
          'Authorization': `ApiKey ${username}:${apiKey}`,
          'User-Agent': 'Discord Contest Bot'
        };
        
        const response = await axios.get(url, { 
          params: titleParams, 
          headers: headers,
          timeout: 10000
        });
        
        if (response.data?.objects?.length > 0) {
          // Format the contests
          return formatClistContests(response.data.objects);
        }
      } catch (error) {
        console.log('Error searching by title:', error.message);
      }
      
      return [];
    }
    
    // If we found a resource ID, use it
    console.log(`Using resource ID ${resourceId} for AtCoder`);
    
    const params = {
      resource__id: resourceId,
      start__gte: startTime,
      end__lte: endTime,
      order_by: 'start',
      limit: 100
    };
    
    const headers = {
      'Authorization': `ApiKey ${username}:${apiKey}`,
      'User-Agent': 'Discord Contest Bot'
    };
    
    const response = await axios.get(url, { 
      params: params, 
      headers: headers,
      timeout: 10000
    });
    
    if (response.data?.objects?.length > 0) {
      console.log(`Found ${response.data.objects.length} contests from Clist.by`);
      return formatClistContests(response.data.objects);
    }
    
    return [];
  } catch (error) {
    console.log('Error fetching from Clist.by:', error.message);
    return [];
  }
}

/**
 * Format Clist.by API contest data to our standard format
 * @param {Array} contests - Contest data from Clist.by API
 * @returns {Array} Formatted contest objects
 */
function formatClistContests(contests) {
  console.log('Formatting contests from Clist.by API');
  
  // Track platform distribution for debugging
  const platformCounts = {};
  contests.forEach(contest => {
    const resource = contest.resource?.name;
    if (resource) {
      platformCounts[resource] = (platformCounts[resource] || 0) + 1;
    }
  });
  console.log('Platform distribution in raw data:', JSON.stringify(platformCounts));
  
  return contests.map(contest => {
    try {
      const startTimeMs = new Date(contest.start).getTime();
      const endTimeMs = new Date(contest.end).getTime();
      
      // Get dates in user's timezone
      const startDate = new Date(startTimeMs);
      const endDate = new Date(endTimeMs);
      
      // Determine platform based on resource name or contest URL
      let platform = 'Unknown';
      const resourceName = contest.resource?.name?.toLowerCase() || '';
      const contestUrl = contest.href?.toLowerCase() || '';
      
      if (resourceName.includes('atcoder') || 
          contestUrl.includes('atcoder.jp') || 
          contest.event.includes('AtCoder')) {
        platform = 'AtCoder';
        console.log(`Found AtCoder contest in Clist data: ${contest.event}`);
      } else if (resourceName.includes('codeforces') || 
                contestUrl.includes('codeforces.com')) {
        platform = 'Codeforces';
      } else {
        console.log(`Platform unknown for contest: ${contest.event}, URL: ${contest.href}, resource: ${resourceName}`);
      }
      
      // Skip contests if platform is unknown
      if (platform === 'Unknown') {
        return null;
      }
      
      return {
        platform,
        name: contest.event,
        date: startDate.toDateString(),
        startTime: startDate.toLocaleTimeString(),
        endTime: endDate.toLocaleTimeString(),
        startTimeMs,
        endTimeMs,
        url: contest.href,
      };
    } catch (error) {
      console.error(`Error formatting contest: ${contest.event || 'unknown'}`, error.message);
      return null;
    }
  }).filter(contest => contest !== null); // Remove any null entries
}

/**
 * Fallback function to fetch contests from unofficial AtCoder Problems API
 * @returns {Promise<Array>} Array of formatted contest objects
 */
async function fetchAtCoderContestsFromProblems() {
  try {
    // Using the unofficial AtCoder Problems API by kenkoooo
    console.log('Fetching contests from AtCoder...');
    
    // Try direct contest page scraping first for the most up-to-date data
    let scrapedContests = [];
    try {
      const directUrl = 'https://atcoder.jp/contests/';
      
      const response = await axios.get(directUrl, { 
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.data && typeof response.data === 'string') {
        console.log('Parsing contests from AtCoder website...');
        
        // Save HTML to examine structure
        const html = response.data;
        
        // Try multiple ways to find the upcoming contests section
        let upcomingSection = '';
        
        // Method 1: Look for the specific heading
        if (html.includes('Upcoming Contests')) {
          upcomingSection = html.split('Upcoming Contests')[1];
        } 
        // Method 2: Look for Japanese heading
        else if (html.includes('予定されたコンテスト')) {
          upcomingSection = html.split('予定されたコンテスト')[1];
        }
        
        if (upcomingSection) {
          // Find the closing table tag to limit our search
          const endIndex = upcomingSection.indexOf('</table>');
          if (endIndex > 0) {
            upcomingSection = upcomingSection.substring(0, endIndex + 8); // Include </table>
          }
          
          // Get all table rows - more robust approach
          const rows = upcomingSection.split('<tr');
          console.log(`Found ${rows.length - 1} potential contest rows`);
          
          const now = Date.now();
          let foundCount = 0;
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            try {
              // Extract contest name with more robust regex
              const nameMatch = row.match(/<a href="\/contests\/([^"]+)"[^>]*>(.*?)<\/a>/);
              if (!nameMatch) {
                continue;
              }
              
              const contestId = nameMatch[1];
              let contestName = nameMatch[2].trim();
              // Clean up HTML entities
              contestName = contestName.replace(/&amp;/g, '&')
                                      .replace(/&lt;/g, '<')
                                      .replace(/&gt;/g, '>');
              
              // Try multiple regex patterns for start time
              let startTimeMatch = null;
              let startTimeString = null;
              
              // Pattern 1: Look for time element directly - this is the most reliable method
              const timeElementMatch = row.match(/<time[^>]*>(.*?)<\/time>/);
              if (timeElementMatch) {
                startTimeString = timeElementMatch[1];
              }
              
              // Pattern 2: Original format (2025-03-22 12:00:00)
              if (!startTimeString) {
                startTimeMatch = row.match(/>\s*(20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*</);
                if (startTimeMatch) {
                  startTimeString = startTimeMatch[1];
                }
              }
              
              // Pattern 3: Alternative format with different separators
              if (!startTimeString) {
                startTimeMatch = row.match(/>\s*(20\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2})\s*</);
                if (startTimeMatch) {
                  startTimeString = startTimeMatch[1];
                }
              }
              
              // Pattern 4: Try with data attributes
              if (!startTimeString) {
                startTimeMatch = row.match(/data-timestamp="(\d+)"/);
                if (startTimeMatch) {
                  // Convert unix timestamp (seconds) to date string
                  const timestamp = parseInt(startTimeMatch[1], 10) * 1000;
                  const date = new Date(timestamp);
                  startTimeString = date.toISOString().replace('T', ' ').substr(0, 19);
                }
              }
              
              if (!startTimeString) {
                // Skip this contest without extensive logging
                continue;
              }
              
              // Handle different date formats
              let startTimeMs;
              if (startTimeString.match(/^\d+$/)) {
                // It's a timestamp
                startTimeMs = parseInt(startTimeString, 10) * 1000;
              } else {
                // It's a date string - assume JST (UTC+9)
                startTimeMs = new Date(startTimeString + ' UTC+9').getTime();
              }
              
              // Skip past contests
              if (startTimeMs < now) {
                continue;
              }
              
              // Extract duration with more robust regex
              let durationString = '2:00'; // Default 2 hours
              const durationMatch = row.match(/>\s*([\d:]{1,5})\s*</);
              if (durationMatch) {
                durationString = durationMatch[1];
              }
              
              // Calculate end time
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
              
              foundCount++;
            } catch (err) {
              // Minimize error logging
              console.log(`Error parsing contest row ${i}`);
            }
          }
          
          if (scrapedContests.length > 0) {
            console.log(`Successfully scraped ${scrapedContests.length} contests from AtCoder website`);
            return scrapedContests;
          } else {
            console.log('No contests found on AtCoder website, trying API fallback');
          }
        } else {
          console.log('Could not find upcoming contests section in AtCoder HTML');
        }
      } else {
        console.log('Did not receive valid HTML from AtCoder website');
      }
    } catch (err) {
      console.log('Direct AtCoder website fetch failed, trying API fallback');
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
        return null;
      }
    }).filter(contest => contest !== null);  // Filter out null entries
  } catch (error) {
    console.error('Error fetching AtCoder contests:', error.message);
    return [];
  }
}

/**
 * Fetches contests from all platforms and filters for the next X days
 * @returns {Promise<Array>} Combined array of contest objects sorted by start time
 */
async function fetchContests(daysAhead = 7) {
  try {
    console.log('Fetching upcoming contests...');
    
    // Calculate the date range for fetching contests
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch contests from multiple sources
    const [cfContests, atCoderContests] = await Promise.all([
      fetchCodeforcesContests(startTime, endTime),
      fetchAtCoderContests(startTime, endTime),
    ]);
    
    // Log the summary of contests found
    console.log(`Fetched ${cfContests.length} Codeforces contests, ${atCoderContests.length} AtCoder contests`);
    
    // Filter contests by date
    const now = Date.now();
    const maxDate = now + daysAhead * 24 * 60 * 60 * 1000;
    
    // Filter contests to keep only those within the date range
    let contests = [...cfContests, ...atCoderContests].filter(contest => {
      const isWithinRange = contest.startTimeMs >= now && contest.startTimeMs <= maxDate;
      
      // Only log if contest is excluded
      if (!isWithinRange && contest.startTimeMs > maxDate) {
        console.log(`Contest "${contest.name}" excluded: outside the ${daysAhead}-day window`);
      }
      
      return isWithinRange;
    });
    
    // Sort contests by start time
    contests.sort((a, b) => a.startTimeMs - b.startTimeMs);
    
    // Count contests by platform after filtering
    const platformCounts = contests.reduce((acc, contest) => {
      acc[contest.platform] = (acc[contest.platform] || 0) + 1;
      return acc;
    }, {});
    
    // Log summary of filtered contests
    console.log(`After date filtering: ${contests.length} total contests remain`);
    Object.entries(platformCounts).forEach(([platform, count]) => {
      console.log(`${platform} contests after filtering: ${count}`);
    });
    
    return contests;
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