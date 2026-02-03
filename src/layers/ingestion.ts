// Layer 1: Ingestion - Fetch posts and comments from Reddit

import { Env, RedditPost, RedditComment, RawPost, RawComment } from '../types';

const SUBREDDITS = [
  'Entrepreneur', 'smallbusiness', 'startups',
  'australia', 'melbourne', 'AusFinance', 'sydney', 'brisbane', 'perth', 'adelaide',
  'homestead', 'farming', 'agriculture', 'tractors', 'ranching'
];

const RATE_LIMIT_MS = 1100;
const POSTS_PER_SUBREDDIT = 25;
const MIN_SCORE = 2;
const MAX_AGE_DAYS = 7;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchSubredditPosts(subreddit: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${POSTS_PER_SUBREDDIT}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainPointFinder/1.0)' }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch r/${subreddit}: ${response.status}`);
      return [];
    }
    
    const data = await response.json() as any;
    const posts: RedditPost[] = [];
    const cutoffTime = Math.floor(Date.now() / 1000) - (MAX_AGE_DAYS * 24 * 60 * 60);
    
    for (const child of data.data?.children || []) {
      const post = child.data;
      if (post.created_utc < cutoffTime) continue;
      if (post.score < MIN_SCORE) continue;
      if (post.over_18 || post.removed_by_category) continue;
      
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
    return posts;
  } catch (error) {
    console.error(`Error fetching r/${subreddit}:`, error);
    return [];
  }
}

async function fetchPostComments(postId: string, subreddit: string): Promise<RedditComment[]> {
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?limit=50&depth=1`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainPointFinder/1.0)' }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const comments: RedditComment[] = [];
    const commentData = data[1]?.data?.children || [];
    
    for (const child of commentData) {
      if (child.kind !== 't1') continue;
      const comment = child.data;
      if (!comment.body || comment.body === '[deleted]' || comment.body === '[removed]') continue;
      if (comment.score < 1) continue;
      
      comments.push({
        id: comment.id,
        parent_id: comment.parent_id,
        body: comment.body,
        author: comment.author,
        created_utc: comment.created_utc,
        score: comment.score,
        link_id: comment.link_id?.replace('t3_', '') || postId
      });
    }
    return comments;
  } catch (error) {
    console.error(`Error fetching comments for ${postId}:`, error);
    return [];
  }
}

async function storePost(db: D1Database, post: RedditPost): Promise<boolean> {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO raw_posts 
      (id, subreddit, title, body, author, created_utc, score, num_comments, url, permalink, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      post.id, post.subreddit, post.title, post.selftext || null, post.author,
      post.created_utc, post.score, post.num_comments, post.url, post.permalink,
      Math.floor(Date.now() / 1000)
    ).run();
    return true;
  } catch (error) {
    console.error(`Failed to store post ${post.id}:`, error);
    return false;
  }
}

async function storeComment(db: D1Database, comment: RedditComment): Promise<boolean> {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO raw_comments
      (id, post_id, parent_id, body, author, created_utc, score, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      comment.id, comment.link_id, comment.parent_id, comment.body, comment.author,
      comment.created_utc, comment.score, Math.floor(Date.now() / 1000)
    ).run();
    return true;
  } catch (error) {
    console.error(`Failed to store comment ${comment.id}:`, error);
    return false;
  }
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
  
  const stateResult = await db.prepare(
    "SELECT value FROM processing_state WHERE key = 'subreddits_index'"
  ).first() as { value: string } | null;
  
  let currentIndex = parseInt(stateResult?.value || '0', 10);
  const subredditsToProcess = 3;
  
  for (let i = 0; i < subredditsToProcess; i++) {
    const subredditIndex = (currentIndex + i) % SUBREDDITS.length;
    const subreddit = SUBREDDITS[subredditIndex];
    
    console.log(`Processing r/${subreddit}...`);
    const posts = await fetchSubredditPosts(subreddit);
    await sleep(RATE_LIMIT_MS);
    
    for (const post of posts) {
      const stored = await storePost(db, post);
      if (stored) totalPosts++;
      
      if (post.num_comments >= 3 && post.score >= 5) {
        await sleep(RATE_LIMIT_MS);
        const comments = await fetchPostComments(post.id, subreddit);
        for (const comment of comments) {
          const commentStored = await storeComment(db, comment);
          if (commentStored) totalComments++;
        }
      }
    }
    
    subredditsProcessed++;
    console.log(`Completed r/${subreddit}: ${posts.length} posts`);
  }
  
  const newIndex = (currentIndex + subredditsToProcess) % SUBREDDITS.length;
  await db.prepare(
    "UPDATE processing_state SET value = ?, updated_at = ? WHERE key = 'subreddits_index'"
  ).bind(newIndex.toString(), Math.floor(Date.now() / 1000)).run();
  
  await db.prepare(
    "UPDATE processing_state SET value = ?, updated_at = ? WHERE key = 'last_ingestion'"
  ).bind(Math.floor(Date.now() / 1000).toString(), Math.floor(Date.now() / 1000)).run();
  
  return { posts_ingested: totalPosts, comments_ingested: totalComments, subreddits_processed: subredditsProcessed };
}

export async function getUnprocessedContent(db: D1Database, limit: number = 50): Promise<{
  posts: RawPost[];
  comments: RawComment[];
}> {
  const posts = await db.prepare(`
    SELECT * FROM raw_posts WHERE processed_at IS NULL AND (LENGTH(body) > 50 OR LENGTH(title) > 30)
    ORDER BY score DESC LIMIT ?
  `).bind(limit).all() as D1Result<RawPost>;
  
  const comments = await db.prepare(`
    SELECT * FROM raw_comments WHERE processed_at IS NULL AND LENGTH(body) > 50
    ORDER BY score DESC LIMIT ?
  `).bind(limit).all() as D1Result<RawComment>;
  
  return { posts: posts.results || [], comments: comments.results || [] };
}
