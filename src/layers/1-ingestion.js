/**
 * Layer 1: Ingestion
 * Fetches posts and comments from Reddit
 * Processes 3 subreddits per run to stay within Worker CPU limits
 */

import { fetchSubredditPosts, fetchPostComments, isRelevantContent } from '../utils/reddit.js';

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
const MAX_COMMENTS_PER_RUN = 20;
const SUBREDDITS_PER_RUN = 3;

export async function runIngestion(env) {
  const stats = { posts: 0, comments: 0 };
  
  // Get current rotation index from DB
  let rotationIndex = 0;
  try {
    const state = await env.DB.prepare(
      "SELECT MAX(run_at) as last_run, COUNT(*) as total_runs FROM ingestion_stats"
    ).first();
    rotationIndex = (state?.total_runs || 0) % Math.ceil(SUBREDDITS.length / SUBREDDITS_PER_RUN);
  } catch (e) {
    // Start fresh
  }
  
  // Select subreddits for this run
  const startIdx = rotationIndex * SUBREDDITS_PER_RUN;
  const subredditsThisRun = SUBREDDITS.slice(startIdx, startIdx + SUBREDDITS_PER_RUN);
  
  console.log(`Ingesting subreddits ${startIdx} to ${startIdx + subredditsThisRun.length}: ${subredditsThisRun.join(', ')}`);
  
  let commentsFetched = 0;
  
  for (const subreddit of subredditsThisRun) {
    try {
      // Fetch recent posts
      const { posts } = await fetchSubredditPosts(subreddit, {
        limit: POSTS_PER_SUBREDDIT,
        sort: 'new',
      });
      
      for (const post of posts) {
        // Check if already exists
        const existing = await env.DB.prepare(
          'SELECT id FROM raw_posts WHERE id = ?'
        ).bind(post.id).first();
        
        if (!existing) {
          // Insert post
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
          
          // Fetch comments for posts with discussion (limit total comments per run)
          if (commentsFetched < MAX_COMMENTS_PER_RUN && 
              post.num_comments > 3 && 
              isRelevantContent(post.title + ' ' + post.body)) {
            
            const comments = await fetchPostComments(subreddit, post.id, {
              limit: 10,
            });
            
            for (const comment of comments.slice(0, 5)) {
              if (isRelevantContent(comment.body)) {
                const existingComment = await env.DB.prepare(
                  'SELECT id FROM raw_comments WHERE id = ?'
                ).bind(comment.id).first();
                
                if (!existingComment) {
                  await env.DB.prepare(`
                    INSERT INTO raw_comments (id, post_id, parent_id, body, author, score, created_utc)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
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
                  commentsFetched++;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error ingesting r/${subreddit}:`, error);
    }
  }
  
  // Log stats
  await env.DB.prepare(`
    INSERT INTO ingestion_stats (subreddit, posts_fetched, comments_fetched)
    VALUES (?, ?, ?)
  `).bind(subredditsThisRun.join(','), stats.posts, stats.comments).run();
  
  return stats;
}
