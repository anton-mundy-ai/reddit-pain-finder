/**
 * Layer 1: Ingestion
 * Fetches posts from Reddit - ONE subreddit per run
 * Rate limited to 1 req/sec, so must stay under 30 sec worker limit
 */

import { fetchSubredditPosts, isRelevantContent } from '../utils/reddit.js';

const SUBREDDITS = [
  'Entrepreneur',
  'smallbusiness',
  'startups',
  'australia',
  'melbourne',
  'AusFinance',
  'sydney',
  'brisbane',
  'perth',
  'adelaide',
  'homestead',
  'farming',
  'agriculture',
  'tractors',
  'ranching',
];

const POSTS_PER_SUBREDDIT = 10;

export async function runIngestion(env) {
  const stats = { posts: 0, comments: 0 };
  
  // Get current rotation index
  let rotationIndex = 0;
  try {
    const state = await env.DB.prepare(
      "SELECT COUNT(*) as runs FROM ingestion_stats"
    ).first();
    rotationIndex = (state?.runs || 0) % SUBREDDITS.length;
  } catch (e) {
    // Start fresh
  }
  
  // Process ONE subreddit per run
  const subreddit = SUBREDDITS[rotationIndex];
  console.log(`Ingesting subreddit ${rotationIndex + 1}/${SUBREDDITS.length}: r/${subreddit}`);
  
  try {
    const { posts } = await fetchSubredditPosts(subreddit, {
      limit: POSTS_PER_SUBREDDIT,
      sort: 'new',
    });
    
    for (const post of posts) {
      const existing = await env.DB.prepare(
        'SELECT id FROM raw_posts WHERE id = ?'
      ).bind(post.id).first();
      
      if (!existing) {
        await env.DB.prepare(`
          INSERT INTO raw_posts (id, subreddit, title, body, author, score, num_comments, url, permalink, created_utc)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    
    console.log(`Ingested ${stats.posts} posts from r/${subreddit}`);
  } catch (error) {
    console.error(`Error ingesting r/${subreddit}:`, error.message);
  }
  
  // Log stats
  await env.DB.prepare(`
    INSERT INTO ingestion_stats (subreddit, posts_fetched, comments_fetched)
    VALUES (?, ?, ?)
  `).bind(subreddit, stats.posts, stats.comments).run();
  
  return stats;
}
