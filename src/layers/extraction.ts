// Layer 2: BINARY FILTER with Nano v6.1
// Nano ONLY does: Is this a pain point? Yes/No
// Quality tagging happens in separate layer

import { Env, PainRecord } from '../types';
import { callGPT5Nano } from '../utils/openai';
import { getUnprocessedComments } from './ingestion';

const BATCH_SIZE = 200;

// v6.1: SIMPLE binary classifier - nothing else
const BINARY_FILTER_PROMPT = `Is this a PERSONAL problem, frustration, or unmet need?

YES if they are:
- Frustrated about something they experienced
- Describing a problem THEY have
- Wishing something existed or worked better for them
- Complaining about a tool/process/situation they dealt with

NO if they are:
- Only giving advice to others
- Making general observations
- Celebrating success
- Making jokes
- Quoting someone else's problem

Respond ONLY: {"is_pain": true} or {"is_pain": false}`;

async function isPainPoint(apiKey: string, body: string): Promise<boolean> {
  try {
    const { content } = await callGPT5Nano(apiKey,
      [
        { role: 'system', content: BINARY_FILTER_PROMPT },
        { role: 'user', content: body.slice(0, 800) }
      ],
      { max_completion_tokens: 20, json_mode: true }
    );
    return JSON.parse(content).is_pain === true;
  } catch {
    // On error, err on side of inclusion
    return true;
  }
}

async function storePainRecord(db: D1Database, record: {
  source_type: string;
  source_id: string;
  subreddit: string;
  raw_quote: string;
  author: string | null;
  source_score: number;
  source_url: string;
}): Promise<number | null> {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO pain_records
      (source_type, source_id, subreddit, raw_quote, author, source_score, source_url, extracted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.source_type,
      record.source_id,
      record.subreddit,
      record.raw_quote.slice(0, 1500),
      record.author,
      record.source_score,
      record.source_url,
      Math.floor(Date.now() / 1000)
    ).run();
    
    const idResult = await db.prepare(
      "SELECT id FROM pain_records WHERE source_type = ? AND source_id = ?"
    ).bind(record.source_type, record.source_id).first() as { id: number } | null;
    return idResult?.id || null;
  } catch (error) {
    console.error('Failed to store pain record:', error);
    return null;
  }
}

async function markCommentProcessed(db: D1Database, commentId: string, isPain: boolean): Promise<void> {
  await db.prepare(`
    UPDATE raw_comments SET processed_at = ?, is_pain_point = ? WHERE id = ?
  `).bind(Math.floor(Date.now() / 1000), isPain ? 1 : 0, commentId).run();
}

export async function runExtraction(env: Env): Promise<{ 
  processed: number;
  pain_points_found: number;
  skipped: number;
}> {
  const db = env.DB;
  let processed = 0;
  let painPointsFound = 0;
  let skipped = 0;
  
  const comments = await getUnprocessedComments(db, BATCH_SIZE);
  
  console.log(`Binary filtering ${comments.length} comments with Nano...`);
  
  for (const comment of comments) {
    processed++;
    
    // v6.1: ONLY binary filter
    const isPain = await isPainPoint(env.OPENAI_API_KEY, comment.body);
    
    await markCommentProcessed(db, comment.id, isPain);
    
    if (!isPain) {
      skipped++;
      continue;
    }
    
    // Determine source type
    const isHN = comment.id.startsWith('hn_');
    const sourceType = isHN ? 'hn_comment' : 'comment';
    const subreddit = comment.subreddit || (isHN ? 'hackernews' : 'unknown');
    
    // Build permalink
    let permalink: string;
    if (isHN) {
      const hnId = comment.id.replace('hn_', '');
      permalink = `https://news.ycombinator.com/item?id=${hnId}`;
    } else {
      permalink = `https://reddit.com/r/${subreddit}/comments/${comment.post_id}/_/${comment.id}`;
    }
    
    const id = await storePainRecord(db, {
      source_type: sourceType,
      source_id: comment.id,
      subreddit: subreddit,
      raw_quote: comment.body,
      author: comment.author,
      source_score: comment.score || 0,
      source_url: permalink
    });
    
    if (id) {
      painPointsFound++;
      if (painPointsFound % 20 === 0) {
        console.log(`  Found ${painPointsFound} pain points so far...`);
      }
    }
  }
  
  console.log(`\n=== Extraction Complete ===`);
  console.log(`Processed: ${processed}, Pain points: ${painPointsFound}, Skipped: ${skipped}`);
  
  return { processed, pain_points_found: painPointsFound, skipped };
}

export async function getUntaggedRecords(db: D1Database, limit: number = 50): Promise<PainRecord[]> {
  const result = await db.prepare(`
    SELECT * FROM pain_records 
    WHERE tagged_at IS NULL 
    ORDER BY source_score DESC 
    LIMIT ?
  `).bind(limit).all() as D1Result<PainRecord>;
  return result.results || [];
}

export async function getUnclusteredRecords(db: D1Database, limit: number = 100): Promise<PainRecord[]> {
  const result = await db.prepare(`
    SELECT * FROM pain_records 
    WHERE cluster_id IS NULL 
    AND topics IS NOT NULL
    ORDER BY source_score DESC 
    LIMIT ?
  `).bind(limit).all() as D1Result<PainRecord>;
  return result.results || [];
}
