/**
 * Layer 1: Ingestion
 * Fetches posts and comments from Reddit
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

const POSTS_PER_SUBREDDIT = 15;
const COMMENTS_PER_POST = 20;

export async function runIngestion(env) {
  const stats = { posts: 0, comments: 0 };
  
  for (const subreddit of SUBREDDITS) {
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
          
          // Fetch comments for posts with discussion
          if (post.num_comments > 3 && isRelevantContent(post.title + ' ' + post.body)) {
            const comments = await fetchPostComments(subreddit, post.id, {
              limit: COMMENTS_PER_POST,
            });
            
            for (const comment of comments) {
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
    VALUES ('all', ?, ?)
  `).bind(stats.posts, stats.comments).run();
  
  return stats;
}
