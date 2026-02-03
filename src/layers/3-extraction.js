/**
 * Layer 3: Extraction v3
 * Extract structured pain records from filtered content
 * Uses GPT-5-nano for volume processing
 */

import { extractPainRecord } from '../utils/llm.js';

const BATCH_SIZE = 5;

export async function runExtraction(env) {
  const stats = { extracted: 0, failed: 0 };
  
  // Get content that passed filter but hasn't been extracted
  const pendingPosts = await env.DB.prepare(`
    SELECT p.id, p.subreddit, p.title, p.body, p.author, p.score, p.url, p.permalink, p.created_utc
    FROM raw_posts p
    JOIN filter_decisions f ON f.content_id = p.id AND f.content_type = 'post'
    LEFT JOIN pain_records pr ON pr.source_id = p.id AND pr.source_type = 'post'
    WHERE f.passes_filter = 1 AND pr.id IS NULL
    ORDER BY p.created_utc DESC
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  console.log(`[Extraction] Found ${pendingPosts.results.length} posts to extract`);
  
  for (const post of pendingPosts.results) {
    try {
      const content = (post.title || '') + '\n\n' + (post.body || '');
      const extraction = await extractPainRecord(env, content, post.subreddit, { title: post.title });
      
      await env.DB.prepare(`
        INSERT INTO pain_records (
          source_type, source_id, subreddit, problem_text, persona,
          context_industry, context_location, context_situation,
          severity_signals, frequency_signals, workaround_text, w2p_hints,
          source_url, source_author, source_score, source_created_utc,
          extracted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      `).bind(
        'post',
        post.id,
        post.subreddit,
        extraction.problem_statement || 'Unknown problem',
        extraction.persona,
        extraction.context?.industry,
        extraction.context?.location,
        extraction.context?.situation,
        JSON.stringify(extraction.severity_signals || []),
        JSON.stringify(extraction.frequency_signals || []),
        extraction.current_workaround,
        extraction.willingness_to_pay,
        post.permalink || post.url,
        post.author,
        post.score,
        post.created_utc
      ).run();
      
      stats.extracted++;
    } catch (e) {
      console.error(`[Extraction] Failed post ${post.id}:`, e.message);
      stats.failed++;
    }
  }
  
  // Extract from comments too
  const pendingComments = await env.DB.prepare(`
    SELECT c.id, c.body, c.author, c.score, c.created_utc, p.subreddit, p.title, p.permalink
    FROM raw_comments c
    JOIN raw_posts p ON p.id = c.post_id
    JOIN filter_decisions f ON f.content_id = c.id AND f.content_type = 'comment'
    LEFT JOIN pain_records pr ON pr.source_id = c.id AND pr.source_type = 'comment'
    WHERE f.passes_filter = 1 AND pr.id IS NULL
    ORDER BY c.created_utc DESC
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  console.log(`[Extraction] Found ${pendingComments.results.length} comments to extract`);
  
  for (const comment of pendingComments.results) {
    try {
      const extraction = await extractPainRecord(env, comment.body, comment.subreddit, { title: comment.title });
      
      await env.DB.prepare(`
        INSERT INTO pain_records (
          source_type, source_id, subreddit, problem_text, persona,
          context_industry, context_location, context_situation,
          severity_signals, frequency_signals, workaround_text, w2p_hints,
          source_url, source_author, source_score, source_created_utc,
          extracted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      `).bind(
        'comment',
        comment.id,
        comment.subreddit,
        extraction.problem_statement || 'Unknown problem',
        extraction.persona,
        extraction.context?.industry,
        extraction.context?.location,
        extraction.context?.situation,
        JSON.stringify(extraction.severity_signals || []),
        JSON.stringify(extraction.frequency_signals || []),
        extraction.current_workaround,
        extraction.willingness_to_pay,
        comment.permalink,
        comment.author,
        comment.score,
        comment.created_utc
      ).run();
      
      stats.extracted++;
    } catch (e) {
      console.error(`[Extraction] Failed comment ${comment.id}:`, e.message);
      stats.failed++;
    }
  }
  
  console.log(`[Extraction] Extracted: ${stats.extracted}, Failed: ${stats.failed}`);
  return stats;
}
