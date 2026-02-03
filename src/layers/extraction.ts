// Layer 2: HIGH THROUGHPUT Extraction
// v5: Fast nano classifier (binary), store verbatim quotes
// GPT-5-nano for volume - cheap and aggressive

import { Env, PainRecord } from '../types';
import { callGPT5Nano } from '../utils/openai';
import { getUnprocessedComments } from './ingestion';

// v5: Much larger batch for throughput
const BATCH_SIZE = 50;

// v5: SIMPLE binary classifier prompt
const PAIN_CLASSIFIER_PROMPT = `Is this Reddit comment expressing a PERSONAL problem, frustration, or unmet need?

YES if they are:
- Frustrated about something
- Describing a problem they have  
- Wishing something existed or worked better
- Asking how to solve their problem
- Complaining about a tool/process

NO if they are:
- Only giving advice (not their own problem)
- Just sharing information
- Celebrating a success
- Making a joke

Respond ONLY with: {"is_pain": true} or {"is_pain": false}`;

/**
 * v5: Batch classify comments with nano model
 * Fast and cheap - we want volume
 */
async function classifyComment(apiKey: string, body: string): Promise<boolean> {
  try {
    const { content } = await callGPT5Nano(apiKey,
      [
        { role: 'system', content: PAIN_CLASSIFIER_PROMPT },
        { role: 'user', content: body.slice(0, 1000) }  // Shorter context for speed
      ],
      { max_completion_tokens: 20, json_mode: true }
    );
    const result = JSON.parse(content);
    return result.is_pain === true;
  } catch (error) {
    // On error, err on side of inclusion
    return true;
  }
}

/**
 * Store a pain record - just the quote, simple
 */
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
      record.raw_quote.slice(0, 1000),  // Cap quote length
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

/**
 * Mark comment as processed
 */
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
  
  // Get batch of unprocessed comments
  const comments = await getUnprocessedComments(db, BATCH_SIZE);
  
  console.log(`Processing ${comments.length} comments with nano classifier...`);
  
  for (const comment of comments) {
    processed++;
    
    // Fast binary classification
    const isPain = await classifyComment(env.OPENAI_API_KEY, comment.body);
    
    // Mark as processed
    await markCommentProcessed(db, comment.id, isPain);
    
    if (!isPain) {
      skipped++;
      continue;
    }
    
    // Store pain point with verbatim quote
    const permalink = `https://reddit.com/r/${comment.subreddit}/comments/${comment.post_id}/_/${comment.id}`;
    
    const id = await storePainRecord(db, {
      source_type: 'comment',
      source_id: comment.id,
      subreddit: comment.subreddit,
      raw_quote: comment.body,
      author: comment.author,
      source_score: comment.score || 0,
      source_url: permalink
    });
    
    if (id) {
      painPointsFound++;
      if (painPointsFound % 10 === 0) {
        console.log(`  Found ${painPointsFound} pain points so far...`);
      }
    }
  }
  
  console.log(`\n=== Extraction Complete ===`);
  console.log(`Processed: ${processed}, Pain points: ${painPointsFound}, Skipped: ${skipped}`);
  
  return { processed, pain_points_found: painPointsFound, skipped };
}

export async function getUnclusteredRecords(db: D1Database, limit: number = 100): Promise<PainRecord[]> {
  const result = await db.prepare(`
    SELECT * FROM pain_records 
    WHERE cluster_id IS NULL 
    ORDER BY source_score DESC 
    LIMIT ?
  `).bind(limit).all() as D1Result<PainRecord>;
  return result.results || [];
}
