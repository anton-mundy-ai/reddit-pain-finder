// Layer 1: HIGH THROUGHPUT Ingestion v8
// v8: ALL subreddits, ultra-low thresholds, 300ms rate limit, 500+ comments
// Goal: 100k+ comments for massive social proof

import { Env, RedditPost, HNComment } from '../types';

// 50+ subreddits - process ALL each cron run
const SUBREDDITS = [
  // Australia general
  'australia', 'melbourne', 'sydney', 'brisbane', 'perth', 'adelaide',
  'AusFinance', 'AusProperty', 'AusLegal', 'AustralianPolitics',
  
  // Business/Startup
  'Entrepreneur', 'smallbusiness', 'startups', 'SideProject', 'microsaas',
  'indiehackers', 'SaaS', 'webdev', 'freelance', 'Blogging',
  
  // Specific verticals
  'homestead', 'farming', 'agriculture', 'tractors', 'ranching',
  'RealEstate', 'realestateinvesting', 'landlords', 'PropertyManagement',
  'accounting', 'bookkeeping', 'tax', 'Bookkeeping',
  'ecommerce', 'dropship', 'FulfillmentByAmazon', 'shopify',
  'restaurateur', 'KitchenConfidential', 'bartenders',
  
  // Professional services
  'legaladvice', 'AusLegal', 'Insurance', 'LawFirm',
  'contractors', 'Construction', 'HVAC', 'Plumbing', 'Electricians',
  
  // Tech adjacent
  'selfhosted', 'homelab', 'sysadmin', 'devops', 'webhosting',
  
  // v8: More pain-rich subreddits
  'rant', 'TrueOffMyChest', 'offmychest', 'NoStupidQuestions',
  'personalfinance', 'povertyfinance', 'Frugal',
  'careerguidance', 'jobs', 'antiwork'
];

// v8: AGGRESSIVE settings for maximum throughput
const RATE_LIMIT_MS = 300;  // v8: Faster - 300ms between requests
const MIN_POST_SCORE = 0;   // v8: Any post at all
const MIN_COMMENTS = 0;     // v8: Any discussion at all
const MAX_COMMENTS_PER_POST = 500;  // v8: Fetch up to 500

/**
 * v6: Fetch LOTS of comments - up to 500 for high-engagement posts
 */
function getCommentLimit(postScore: number, numComments: number): number {
  // v6: More aggressive - fetch more from every post
  if (postScore >= 100 || numComments >= 100) return 500;
  if (postScore >= 50 || numComments >= 50) return 300;
  if (postScore >= 10 || numComments >= 20) return 200;
  return 100;  // Even small posts get 100 comments
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchSubredditPosts(subreddit: string, sortType: 'top' | 'hot' | 'new' = 'top'): Promise<RedditPost[]> {
  const timeParam = sortType === 'top' ? '&t=week' : '';
  const url = `https://www.reddit.com/r/${subreddit}/${sortType}.json?limit=100${timeParam}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainPointFinder/6.0)' }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch r/${subreddit}: ${response.status}`);
      return [];
    }
    
    const data = await response.json() as any;
    const posts: RedditPost[] = [];
    
    for (const child of data.data?.children || []) {
      const post = child.data;
      
      // v6: Ultra-low thresholds
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
    
    console.log(`r/${subreddit}: Found ${posts.length} posts`);
    return posts;
  } catch (error) {
    console.error(`Error fetching r/${subreddit}:`, error);
    return [];
  }
}

/**
 * v6: Fetch up to 500 comments with deeper nesting
 */
async function fetchPostComments(
  postId: string, 
  subreddit: string,
  limit: number,
  postScore: number,
  postTitle: string
): Promise<any[]> {
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?limit=${limit}&sort=top&depth=5`;  // v6: depth 5
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainPointFinder/6.0)' }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const comments: any[] = [];
    
    function extractComments(children: any[], depth: number = 0) {
      if (depth > 4) return;  // v6: Max depth 5
      
      for (const child of children) {
        if (child.kind !== 't1') continue;
        const comment = child.data;
        
        if (!comment.body || comment.body === '[deleted]' || comment.body === '[removed]') continue;
        if (comment.body.length < 30) continue;  // v6: Even shorter OK
        
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

/**
 * v6: Search HackerNews for relevant discussions
 * Free API, no auth required
 */
export async function fetchHackerNewsComments(query: string, limit: number = 100): Promise<HNComment[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=${limit}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const comments: HNComment[] = [];
    
    for (const hit of data.hits || []) {
      if (!hit.comment_text || hit.comment_text.length < 30) continue;
      
      comments.push({
        id: hit.objectID,
        text: hit.comment_text,
        author: hit.author || 'unknown',
        created_at: hit.created_at,
        story_id: hit.story_id,
        story_title: hit.story_title,
        story_url: hit.story_url
      });
    }
    
    return comments;
  } catch (error) {
    console.error('Error fetching HN comments:', error);
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

/**
 * Store HackerNews comment as a regular comment (with subreddit='hackernews')
 */
async function storeHNComment(db: D1Database, comment: HNComment): Promise<boolean> {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO raw_comments
      (id, post_id, parent_id, body, author, created_utc, score, post_score, post_title, subreddit, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `hn_${comment.id}`,
      comment.story_id?.toString() || 'unknown',
      null,
      comment.text,
      comment.author,
      Math.floor(new Date(comment.created_at).getTime() / 1000),
      0,  // HN doesn't give us points
      0,
      comment.story_title || '',
      'hackernews',  // Mark as HN source
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
  hn_comments_ingested: number;
  subreddits_processed: number;
}> {
  const db = env.DB;
  let totalPosts = 0;
  let totalComments = 0;
  let hnComments = 0;
  let subredditsProcessed = 0;
  
  // v6: Process ALL 42 subreddits each run
  console.log(`\n=== v6 High-Throughput Ingestion: ALL ${SUBREDDITS.length} subreddits ===\n`);
  
  for (let i = 0; i < SUBREDDITS.length; i++) {
    const subreddit = SUBREDDITS[i];
    
    console.log(`[${i + 1}/${SUBREDDITS.length}] Processing r/${subreddit}...`);
    
    // Alternate between top, hot, and new
    const sortTypes = ['top', 'hot', 'new'];
    const sortType = sortTypes[i % 3] as 'top' | 'hot' | 'new';
    
    const posts = await fetchSubredditPosts(subreddit, sortType);
    await sleep(RATE_LIMIT_MS);
    
    let subredditComments = 0;
    
    for (const post of posts) {
      const existing = await db.prepare(
        "SELECT comments_fetched FROM raw_posts WHERE id = ?"
      ).bind(post.id).first() as { comments_fetched: number } | null;
      
      const stored = await storePost(db, post, sortType);
      if (stored && !existing) totalPosts++;
      
      if (existing && existing.comments_fetched > 0) continue;
      
      // v6: More comments per post
      const commentLimit = getCommentLimit(post.score, post.num_comments);
      
      await sleep(RATE_LIMIT_MS);
      const comments = await fetchPostComments(post.id, subreddit, commentLimit, post.score, post.title);
      
      let storedComments = 0;
      for (const comment of comments) {
        if (await storeComment(db, comment)) {
          totalComments++;
          subredditComments++;
          storedComments++;
        }
      }
      
      await updatePostCommentsFetched(db, post.id, storedComments);
    }
    
    console.log(`  → ${subredditComments} comments stored`);
    subredditsProcessed++;
  }
  
  // v6: Also ingest from HackerNews - search for startup/business pain points
  console.log(`\n=== Ingesting from HackerNews ===`);
  const hnQueries = [
    'frustrated with', 'problem with', 'wish there was', 'need help with',
    'anyone else have this issue', 'struggling with', 'looking for solution'
  ];
  
  for (const query of hnQueries) {
    const hnCommentsResult = await fetchHackerNewsComments(query, 50);
    for (const comment of hnCommentsResult) {
      if (await storeHNComment(db, comment)) {
        hnComments++;
      }
    }
    await sleep(200);  // Light rate limiting for HN
  }
  
  console.log(`  → ${hnComments} HN comments stored`);
  
  await db.prepare(
    "INSERT OR REPLACE INTO processing_state (key, value, updated_at) VALUES ('last_ingestion', ?, ?)"
  ).bind(Math.floor(Date.now() / 1000).toString(), Math.floor(Date.now() / 1000)).run();
  
  console.log(`\n=== Ingestion Complete ===`);
  console.log(`Posts: ${totalPosts}, Reddit comments: ${totalComments}, HN comments: ${hnComments}`);
  
  return { 
    posts_ingested: totalPosts, 
    comments_ingested: totalComments, 
    hn_comments_ingested: hnComments,
    subreddits_processed: subredditsProcessed 
  };
}

export async function getUnprocessedComments(db: D1Database, limit: number = 200): Promise<any[]> {
  // v6: Larger batch size
  const result = await db.prepare(`
    SELECT * FROM raw_comments 
    WHERE is_pain_point IS NULL 
    AND LENGTH(body) >= 30
    ORDER BY score DESC 
    LIMIT ?
  `).bind(limit).all();
  
  return result.results || [];
}
