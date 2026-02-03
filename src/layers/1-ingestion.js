/**
 * Layer 1: Ingestion v3
 * Expanded subreddit coverage across multiple categories
 * ONE subreddit per run for rate limit compliance
 */

import { fetchSubredditPosts, fetchPostComments, isRelevantContent } from '../utils/reddit.js';

// Expanded subreddit list by category
const SUBREDDITS = {
  // Startup/Business
  startup: [
    'Entrepreneur', 'smallbusiness', 'startups', 'SaaS', 'indiehackers',
    'ecommerce', 'dropshipping', 'sidehustle', 'venturecapital', 'crowdfunding',
  ],
  
  // Tech
  tech: [
    'programming', 'webdev', 'sysadmin', 'devops', 'cscareerquestions',
  ],
  
  // Business/Professional
  business: [
    'sales', 'marketing', 'freelance', 'consulting',
  ],
  
  // Help/Complaints (high pain point density)
  help: [
    'techsupport', 'personalfinance', 'legaladvice', 'advice', 'rant',
  ],
  
  // Australia - National
  au_national: [
    'australia', 'ausfinance', 'ausbiz', 'australianpolitics',
  ],
  
  // Australia - Cities
  au_cities: [
    'melbourne', 'sydney', 'brisbane', 'perth', 'adelaide', 'canberra', 'tasmania',
  ],
  
  // Agriculture/Rural (original focus)
  rural: [
    'homestead', 'farming', 'agriculture', 'tractors', 'ranching',
  ],
};

// Flatten and create rotation list
const ALL_SUBREDDITS = Object.values(SUBREDDITS).flat();

const POSTS_PER_SUBREDDIT = 15;
const COMMENTS_PER_POST = 10;

export async function runIngestion(env) {
  const stats = { posts: 0, comments: 0, subreddit: '' };
  
  // Get current rotation index
  let rotationIndex = 0;
  try {
    const countResult = await env.DB.prepare(
      "SELECT COUNT(*) as runs FROM ingestion_stats"
    ).first();
    rotationIndex = (countResult?.runs || 0) % ALL_SUBREDDITS.length;
  } catch (e) {
    console.log('Starting fresh rotation');
  }
  
  // Process ONE subreddit per run
  const subreddit = ALL_SUBREDDITS[rotationIndex];
  stats.subreddit = subreddit;
  console.log(`[Ingestion] ${rotationIndex + 1}/${ALL_SUBREDDITS.length}: r/${subreddit}`);
  
  try {
    const { posts } = await fetchSubredditPosts(subreddit, {
      limit: POSTS_PER_SUBREDDIT,
      sort: 'new',
    });
    
    for (const post of posts) {
      // Skip if already exists
      const existing = await env.DB.prepare(
        'SELECT id FROM raw_posts WHERE id = ?'
      ).bind(post.id).first();
      
      if (existing) continue;
      
      // Insert post
      await env.DB.prepare(`
        INSERT INTO raw_posts (id, subreddit, title, body, author, score, num_comments, url, permalink, created_utc, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      `).bind(
        post.id,
        post.subreddit,
        post.title,
        post.body,
        post.author,
        post.score,
        post.num_comments,
        post.url,
        post.permalink,
        post.created_utc
      ).run();
      
      stats.posts++;
      
      // Fetch comments for posts with engagement
      if (post.num_comments >= 3 && post.is_self) {
        try {
          const comments = await fetchPostComments(subreddit, post.id, {
            limit: COMMENTS_PER_POST,
            sort: 'top',
          });
          
          for (const comment of comments) {
            if (!isRelevantContent(comment.body)) continue;
            
            const existingComment = await env.DB.prepare(
              'SELECT id FROM raw_comments WHERE id = ?'
            ).bind(comment.id).first();
            
            if (!existingComment) {
              await env.DB.prepare(`
                INSERT INTO raw_comments (id, post_id, parent_id, body, author, score, created_utc, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
              `).bind(
                comment.id,
                comment.post_id,
                comment.parent_id,
                comment.body,
                comment.author,
                comment.score,
                comment.created_utc
              ).run();
              
              stats.comments++;
            }
          }
        } catch (e) {
          console.log(`Failed to fetch comments for ${post.id}:`, e.message);
        }
      }
    }
    
    console.log(`[Ingestion] r/${subreddit}: ${stats.posts} posts, ${stats.comments} comments`);
  } catch (error) {
    console.error(`[Ingestion] Error r/${subreddit}:`, error.message);
  }
  
  // Log stats
  try {
    await env.DB.prepare(`
      INSERT INTO ingestion_stats (subreddit, posts_fetched, comments_fetched, created_at)
      VALUES (?, ?, ?, unixepoch())
    `).bind(subreddit, stats.posts, stats.comments).run();
  } catch (e) {
    console.log('Stats logging failed:', e.message);
  }
  
  return stats;
}

/**
 * Targeted ingestion for validation/back-validation
 * Searches specific subreddits with query
 */
export async function runTargetedIngestion(env, queries, targetSubreddits = []) {
  const stats = { posts: 0, queries: queries.length };
  
  // Use provided subreddits or defaults
  const subreddits = targetSubreddits.length > 0 
    ? targetSubreddits 
    : ['Entrepreneur', 'smallbusiness', 'startups', 'SaaS'];
  
  console.log(`[Targeted] Searching ${queries.length} queries in ${subreddits.length} subreddits`);
  
  for (const query of queries.slice(0, 3)) {
    for (const subreddit of subreddits.slice(0, 4)) {
      try {
        const { posts } = await fetchSubredditPosts(subreddit, {
          limit: 10,
          sort: 'relevance',
          query: query,
        });
        
        for (const post of posts) {
          const existing = await env.DB.prepare(
            'SELECT id FROM raw_posts WHERE id = ?'
          ).bind(post.id).first();
          
          if (!existing) {
            await env.DB.prepare(`
              INSERT INTO raw_posts (id, subreddit, title, body, author, score, num_comments, url, permalink, created_utc, fetched_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
            `).bind(
              post.id,
              post.subreddit,
              post.title,
              post.body,
              post.author,
              post.score,
              post.num_comments,
              post.url,
              post.permalink,
              post.created_utc
            ).run();
            
            stats.posts++;
          }
        }
      } catch (e) {
        console.log(`[Targeted] Error searching ${subreddit}:`, e.message);
      }
    }
  }
  
  return stats;
}

// Export subreddit list for admin UI
export { ALL_SUBREDDITS, SUBREDDITS };
