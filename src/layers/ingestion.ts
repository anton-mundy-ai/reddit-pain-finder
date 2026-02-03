// Layer 1: HIGH THROUGHPUT Ingestion
// v5: Lower thresholds, more subreddits, more comments
// Goal: Thousands of pain points, not dozens

import { Env, RedditPost } from '../types';

// 42 subreddits - same coverage, higher volume
const SUBREDDITS = [
  // Australia general
  'australia', 'melbourne', 'sydney', 'brisbane', 'perth', 'adelaide',
  'AusFinance', 'AusProperty', 'AusLegal', 'AustralianPolitics',
  
  // Business/Startup
  'Entrepreneur', 'smallbusiness', 'startups', 'SideProject', 'microsaas',
  'indiehackers', 'SaaS', 'webdev', 'freelance',
  
  // Specific verticals
  'homestead', 'farming', 'agriculture', 'tractors', 'ranching',
  'RealEstate', 'realestateinvesting', 'landlords',
  'accounting', 'bookkeeping', 'tax',
  'ecommerce', 'dropship', 'FulfillmentByAmazon',
  'restaurateur', 'KitchenConfidential',
  
  // Professional services
  'legaladvice', 'AusLegal', 'Insurance',
  'contractors', 'Construction', 'HVAC', 'Plumbing', 'Electricians',
  
  // Tech adjacent
  'selfhosted', 'homelab', 'sysadmin'
];

const RATE_LIMIT_MS = 1000;  // Slightly faster

// v5: LOWER THRESHOLDS for high throughput
const MIN_POST_SCORE = 20;   // Was 50
const MIN_COMMENTS = 10;     // Was 20

/**
 * v5: Fetch MORE comments based on engagement
 */
function getCommentLimit(postScore: number, numComments: number): number {
  // Fetch up to 300 for very hot posts
  if (postScore >= 500 || numComments >= 200) return 300;
  if (postScore >= 200 || numComments >= 100) return 200;
  if (postScore >= 50 || numComments >= 50) return 100;
  return 50;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchSubredditPosts(subreddit: string, sortType: 'top' | 'hot' = 'top'): Promise<RedditPost[]> {
  const timeParam = sortType === 'top' ? '&t=week' : '';
  const url = `https://www.reddit.com/r/${subreddit}/${sortType}.json?limit=100${timeParam}`;  // More posts
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainPointFinder/5.0)' }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch r/${subreddit}: ${response.status}`);
      return [];
    }
    
    const data = await response.json() as any;
    const posts: RedditPost[] = [];
    
    for (const child of data.data?.children || []) {
      const post = child.data;
      
      // v5: Lower thresholds
      if (post.score < MIN_POST_SCORE) continue;
      if (post.num_comments < MIN_COMMENTS) continue;
      if (post.over_18 || post.removed_by_category || post.locked) continue;
      
      posts.push({
        id: post.id,
        subreddit: post.subreddit,
        title: post.title,
        selftext: post.selftext || '',
        author: post.author,
        created_utc: post.created_utc,
        score: post.score,
        num_comments: post.num_comments,
        url: post.url,
        permalink: `https://reddit.com${post.permalink}`
      });
    }
    
    console.log(`r/${subreddit}: Found ${posts.length} posts (score≥${MIN_POST_SCORE}, comments≥${MIN_COMMENTS})`);
    return posts;
  } catch (error) {
    console.error(`Error fetching r/${subreddit}:`, error);
    return [];
  }
}

/**
 * v5: Fetch MORE comments for high-volume extraction
 */
async function fetchPostComments(
  postId: string, 
  subreddit: string,
  limit: number,
  postScore: number,
  postTitle: string
): Promise<any[]> {
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?limit=${limit}&sort=top&depth=3`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainPointFinder/5.0)' }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const comments: any[] = [];
    
    function extractComments(children: any[], depth: number = 0) {
      if (depth > 2) return;  // Max depth 3
      
      for (const child of children) {
        if (child.kind !== 't1') continue;
        const comment = child.data;
        
        if (!comment.body || comment.body === '[deleted]' || comment.body === '[removed]') continue;
        if (comment.body.length < 40) continue;  // Slightly shorter OK
        
        comments.push({
          id: comment.id,
          parent_id: comment.parent_id,
          body: comment.body,
          author: comment.author,
          created_utc: comment.created_utc,
          score: comment.score,
          link_id: postId,
          post_score: postScore,
          post_title: postTitle,
          subreddit: subreddit
        });
        
        if (comment.replies?.data?.children) {
          extractComments(comment.replies.data.children, depth + 1);
        }
      }
    }
    
    const commentData = data[1]?.data?.children || [];
    extractComments(commentData);
    
    return comments;
  } catch (error) {
    console.error(`Error fetching comments for ${postId}:`, error);
    return [];
  }
}

async function storePost(db: D1Database, post: RedditPost, sortType: string): Promise<boolean> {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO raw_posts 
      (id, subreddit, title, body, author, created_utc, score, num_comments, url, permalink, sort_type, fetched_at, processed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      post.id, post.subreddit, post.title, post.selftext || null, post.author,
      post.created_utc, post.score, post.num_comments, post.url, post.permalink,
      sortType, Math.floor(Date.now() / 1000)
    ).run();
    return true;
  } catch (error) {
    return false;
  }
}

async function storeComment(db: D1Database, comment: any): Promise<boolean> {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO raw_comments
      (id, post_id, parent_id, body, author, created_utc, score, post_score, post_title, subreddit, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      comment.id, 
      comment.link_id, 
      comment.parent_id, 
      comment.body, 
      comment.author,
      comment.created_utc, 
      comment.score,
      comment.post_score,
      comment.post_title,
      comment.subreddit,
      Math.floor(Date.now() / 1000)
    ).run();
    return true;
  } catch (error) {
    return false;
  }
}

async function updatePostCommentsFetched(db: D1Database, postId: string, count: number): Promise<void> {
  await db.prepare(`
    UPDATE raw_posts SET comments_fetched = ?, comments_fetched_at = ? WHERE id = ?
  `).bind(count, Math.floor(Date.now() / 1000), postId).run();
}

export async function runIngestion(env: Env): Promise<{
  posts_ingested: number;
  comments_ingested: number;
  subreddits_processed: number;
}> {
  const db = env.DB;
  let totalPosts = 0;
  let totalComments = 0;
  let subredditsProcessed = 0;
  
  // Get current subreddit rotation index
  const stateResult = await db.prepare(
    "SELECT value FROM processing_state WHERE key = 'subreddits_index'"
  ).first() as { value: string } | null;
  
  let currentIndex = parseInt(stateResult?.value || '0', 10);
  
  // v5: Process MORE subreddits per run (8 instead of 5)
  const subredditsToProcess = 8;
  
  for (let i = 0; i < subredditsToProcess; i++) {
    const subredditIndex = (currentIndex + i) % SUBREDDITS.length;
    const subreddit = SUBREDDITS[subredditIndex];
    
    console.log(`\n=== Processing r/${subreddit} ===`);
    
    const sortType = i % 2 === 0 ? 'top' : 'hot';
    
    const posts = await fetchSubredditPosts(subreddit, sortType as 'top' | 'hot');
    await sleep(RATE_LIMIT_MS);
    
    for (const post of posts) {
      const existing = await db.prepare(
        "SELECT comments_fetched FROM raw_posts WHERE id = ?"
      ).bind(post.id).first() as { comments_fetched: number } | null;
      
      const stored = await storePost(db, post, sortType);
      if (stored && !existing) totalPosts++;
      
      if (existing && existing.comments_fetched > 0) continue;
      
      // v5: More comments
      const commentLimit = getCommentLimit(post.score, post.num_comments);
      console.log(`  → ${post.title.slice(0, 50)}... (${post.score}↑) - fetching ${commentLimit} comments`);
      
      await sleep(RATE_LIMIT_MS);
      const comments = await fetchPostComments(post.id, subreddit, commentLimit, post.score, post.title);
      
      let storedComments = 0;
      for (const comment of comments) {
        if (await storeComment(db, comment)) {
          totalComments++;
          storedComments++;
        }
      }
      
      await updatePostCommentsFetched(db, post.id, storedComments);
      console.log(`    Stored ${storedComments} comments`);
    }
    
    subredditsProcessed++;
  }
  
  // Update rotation index
  const newIndex = (currentIndex + subredditsToProcess) % SUBREDDITS.length;
  await db.prepare(
    "INSERT OR REPLACE INTO processing_state (key, value, updated_at) VALUES ('subreddits_index', ?, ?)"
  ).bind(newIndex.toString(), Math.floor(Date.now() / 1000)).run();
  
  await db.prepare(
    "INSERT OR REPLACE INTO processing_state (key, value, updated_at) VALUES ('last_ingestion', ?, ?)"
  ).bind(Math.floor(Date.now() / 1000).toString(), Math.floor(Date.now() / 1000)).run();
  
  console.log(`\n=== Ingestion Complete ===`);
  console.log(`Posts: ${totalPosts}, Comments: ${totalComments}`);
  
  return { posts_ingested: totalPosts, comments_ingested: totalComments, subreddits_processed: subredditsProcessed };
}

export async function getUnprocessedComments(db: D1Database, limit: number = 100): Promise<any[]> {
  const result = await db.prepare(`
    SELECT * FROM raw_comments 
    WHERE is_pain_point IS NULL 
    AND LENGTH(body) >= 50
    ORDER BY score DESC 
    LIMIT ?
  `).bind(limit).all();
  
  return result.results || [];
}
