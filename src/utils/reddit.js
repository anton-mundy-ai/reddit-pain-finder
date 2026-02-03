/**
 * Reddit Public JSON API Utility
 * Uses public .json endpoints (no auth required)
 * Rate limited to 1 request per second
 */

const USER_AGENT = 'PainPointFinder/2.0 (Cloudflare Workers)';
const REQUEST_DELAY_MS = 1100; // Slightly over 1 second to be safe

let lastRequestTime = 0;

async function rateLimitedFetch(url) {
  // Enforce rate limit
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < REQUEST_DELAY_MS) {
    await sleep(REQUEST_DELAY_MS - timeSinceLastRequest);
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited - wait and retry once
      await sleep(5000);
      return fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    }
    throw new Error(`Reddit API error: ${response.status}`);
  }
  
  return response;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch recent posts from a subreddit
 */
export async function fetchSubredditPosts(subreddit, options = {}) {
  const { limit = 25, sort = 'new', after = null } = options;
  
  let url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;
  if (after) {
    url += `&after=${after}`;
  }
  
  try {
    const response = await rateLimitedFetch(url);
    const data = await response.json();
    
    if (!data.data?.children) {
      return { posts: [], after: null };
    }
    
    const posts = data.data.children
      .filter(child => child.kind === 't3')
      .map(child => ({
        id: child.data.id,
        subreddit: child.data.subreddit,
        title: child.data.title,
        body: child.data.selftext || '',
        author: child.data.author,
        score: child.data.score,
        num_comments: child.data.num_comments,
        url: child.data.url,
        permalink: `https://reddit.com${child.data.permalink}`,
        created_utc: child.data.created_utc,
        is_self: child.data.is_self,
      }));
    
    return {
      posts,
      after: data.data.after,
    };
  } catch (error) {
    console.error(`Error fetching r/${subreddit}:`, error);
    return { posts: [], after: null };
  }
}

/**
 * Fetch comments for a post
 */
export async function fetchPostComments(subreddit, postId, options = {}) {
  const { limit = 50, sort = 'top' } = options;
  
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?limit=${limit}&sort=${sort}`;
  
  try {
    const response = await rateLimitedFetch(url);
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length < 2) {
      return [];
    }
    
    // Comments are in the second element
    const commentsData = data[1]?.data?.children || [];
    
    return commentsData
      .filter(child => child.kind === 't1' && child.data.body)
      .map(child => ({
        id: child.data.id,
        post_id: postId,
        parent_id: child.data.parent_id,
        body: child.data.body,
        author: child.data.author,
        score: child.data.score,
        created_utc: child.data.created_utc,
      }));
  } catch (error) {
    console.error(`Error fetching comments for ${postId}:`, error);
    return [];
  }
}

/**
 * Filter content for relevance
 */
export function isRelevantContent(text) {
  if (!text || typeof text !== 'string') return false;
  
  // Minimum length
  if (text.length < 50) return false;
  
  // Exclude common non-content patterns
  const excludePatterns = [
    /^\[removed\]$/i,
    /^\[deleted\]$/i,
    /^https?:\/\/\S+$/i, // Link-only
    /^(lol|lmao|haha|nice|this|same|yes|no|agreed|exactly)\.?$/i, // Low-effort
  ];
  
  for (const pattern of excludePatterns) {
    if (pattern.test(text.trim())) return false;
  }
  
  return true;
}

/**
 * Basic English detection (includes AU slang)
 */
export function isLikelyEnglish(text) {
  if (!text) return false;
  
  // Common English words that should appear frequently
  const englishIndicators = /\b(the|and|is|it|to|of|a|in|that|for|you|with|on|are|be|this|have|was|but|not|they|from|at|or|by|we|an|can|my|all|has|do|if|will|one|their|what|so|up|out|about|who|get|which|me|when|your|how|its|like|just|know|take|people|into|could|than|them|way|been|call|first|would|over|such|these|because|through|being|also|back|after|most|make|where|other|then|some|her|him|see|now|only|come|made|find|here|thing|give|many|new|still|very|well|those|both|feel|before|right|look|off|any|same|our|say|even|want|again|need|each|between|work|might|while|under|few|another|more|down|much|should|never|life|around|something|without|against|last|really|always|things|every|since|upon|too|does|may|cannot|become|little|went|did|going|part|once|place|better|big|lot|still)\b/gi;
  
  const matches = text.match(englishIndicators) || [];
  const wordCount = text.split(/\s+/).length;
  
  // At least 20% of words should be common English
  return matches.length / wordCount > 0.2;
}

/**
 * Detect Australian context
 */
export function hasAustralianContext(text, subreddit) {
  // Australian subreddits
  const auSubreddits = ['australia', 'melbourne', 'sydney', 'brisbane', 'perth', 'adelaide', 'ausfinance'];
  if (auSubreddits.includes(subreddit.toLowerCase())) {
    return true;
  }
  
  // Australian terms/locations
  const auPatterns = /\b(australia|australian|aussie|straya|melbourne|sydney|brisbane|perth|adelaide|queensland|nsw|victoria|wa|sa|tasmania|darwin|canberra|ato|centrelink|medicare|bunnings|woolies|coles|aldi|myer|kmart|abn|acn|gst|superannuation|super\s+fund|arvo|brekkie|servo|bottlo|tradie|ute|maccas|footy|afl|nrl)\b/gi;
  
  return auPatterns.test(text);
}
