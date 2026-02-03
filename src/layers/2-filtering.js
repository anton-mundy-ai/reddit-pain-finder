/**
 * Layer 2: Filtering v3
 * Language detection, quality filtering, pain point classification
 * Uses GPT-5-nano for volume processing
 */

import { classifyContent } from '../utils/llm.js';
import { isLikelyEnglish, hasAustralianContext } from '../utils/reddit.js';

const BATCH_SIZE = 8;
const MIN_CONTENT_LENGTH = 80;

export async function runFiltering(env) {
  const stats = { processed: 0, passed: 0, skipped: 0 };
  
  // Process unprocessed posts
  const unprocessedPosts = await env.DB.prepare(`
    SELECT p.id, p.subreddit, p.title, p.body
    FROM raw_posts p
    LEFT JOIN filter_decisions f ON f.content_id = p.id AND f.content_type = 'post'
    WHERE p.processed = 0 AND f.id IS NULL
    ORDER BY p.created_utc DESC
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  console.log(`[Filtering] Found ${unprocessedPosts.results.length} unprocessed posts`);
  
  for (const post of unprocessedPosts.results) {
    try {
      const content = (post.title || '') + '\n\n' + (post.body || '');
      const result = await filterContent(env, 'post', post.id, content, post.subreddit);
      stats.processed++;
      if (result.passes) stats.passed++;
    } catch (e) {
      console.error(`[Filtering] Error on post ${post.id}:`, e.message);
      stats.skipped++;
    }
  }
  
  // Mark posts as processed
  if (unprocessedPosts.results.length > 0) {
    for (const post of unprocessedPosts.results) {
      await env.DB.prepare('UPDATE raw_posts SET processed = 1 WHERE id = ?')
        .bind(post.id).run();
    }
  }
  
  // Process unprocessed comments
  const unprocessedComments = await env.DB.prepare(`
    SELECT c.id, c.body, c.post_id, p.subreddit, p.title as post_title
    FROM raw_comments c
    JOIN raw_posts p ON p.id = c.post_id
    LEFT JOIN filter_decisions f ON f.content_id = c.id AND f.content_type = 'comment'
    WHERE c.processed = 0 AND f.id IS NULL
    ORDER BY c.created_utc DESC
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  console.log(`[Filtering] Found ${unprocessedComments.results.length} unprocessed comments`);
  
  for (const comment of unprocessedComments.results) {
    try {
      const result = await filterContent(env, 'comment', comment.id, comment.body, comment.subreddit);
      stats.processed++;
      if (result.passes) stats.passed++;
    } catch (e) {
      console.error(`[Filtering] Error on comment ${comment.id}:`, e.message);
      stats.skipped++;
    }
  }
  
  // Mark comments as processed
  if (unprocessedComments.results.length > 0) {
    for (const comment of unprocessedComments.results) {
      await env.DB.prepare('UPDATE raw_comments SET processed = 1 WHERE id = ?')
        .bind(comment.id).run();
    }
  }
  
  console.log(`[Filtering] Processed: ${stats.processed}, Passed: ${stats.passed}, Skipped: ${stats.skipped}`);
  return stats;
}

async function filterContent(env, contentType, contentId, text, subreddit) {
  let passes = false;
  let reason = null;
  let classification = null;
  
  // Basic filters (no LLM needed)
  if (!text || text.length < MIN_CONTENT_LENGTH) {
    reason = 'too_short';
  } else if (!isLikelyEnglish(text)) {
    reason = 'not_english';
  } else {
    // LLM classification (GPT-5-nano)
    try {
      classification = await classifyContent(env, text.slice(0, 2000), subreddit);
      
      if (!classification.is_pain_point) {
        reason = 'not_pain_point';
      } else if (classification.confidence < 35) {
        reason = 'low_confidence';
      } else if (classification.category === 'other') {
        reason = 'irrelevant_category';
      } else {
        passes = true;
      }
    } catch (error) {
      console.error('[Filtering] Classification error:', error.message);
      reason = 'classification_error';
    }
  }
  
  // Store decision
  try {
    await env.DB.prepare(`
      INSERT INTO filter_decisions (content_type, content_id, is_english, is_pain_point, pain_confidence, category, problem_type, passes_filter, filter_reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      contentType,
      contentId,
      isLikelyEnglish(text) ? 1 : 0,
      classification?.is_pain_point ? 1 : 0,
      classification?.confidence || 0,
      classification?.category || null,
      classification?.problem_type || null,
      passes ? 1 : 0,
      reason
    ).run();
  } catch (e) {
    // Might be duplicate, ignore
    console.log('[Filtering] Decision already exists for', contentId);
  }
  
  return { passes, classification, reason };
}

/**
 * Get filter stats for admin dashboard
 */
export async function getFilterStats(env) {
  const total = await env.DB.prepare('SELECT COUNT(*) as c FROM filter_decisions').first();
  const passed = await env.DB.prepare('SELECT COUNT(*) as c FROM filter_decisions WHERE passes_filter = 1').first();
  const byReason = await env.DB.prepare(`
    SELECT filter_reason, COUNT(*) as count 
    FROM filter_decisions 
    WHERE passes_filter = 0 
    GROUP BY filter_reason
  `).all();
  
  return {
    total: total?.c || 0,
    passed: passed?.c || 0,
    passRate: total?.c ? Math.round((passed?.c / total?.c) * 100) : 0,
    rejectionReasons: byReason.results || [],
  };
}
