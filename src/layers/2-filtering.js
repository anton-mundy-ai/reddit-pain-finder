/**
 * Layer 2: Normalization + Filtering
 * Language detection, quality filtering, pain point classification
 */

import { classifyContent } from '../utils/llm.js';
import { isLikelyEnglish, hasAustralianContext } from '../utils/reddit.js';

const BATCH_SIZE = 5;
const MIN_CONTENT_LENGTH = 100;

export async function runFiltering(env) {
  const stats = { processed: 0, passed: 0 };
  
  // Process unprocessed posts
  const unprocessedPosts = await env.DB.prepare(`
    SELECT p.id, p.subreddit, p.title, p.body
    FROM raw_posts p
    LEFT JOIN filter_decisions f ON f.content_id = p.id AND f.content_type = 'post'
    WHERE p.processed = 0 AND f.id IS NULL
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  for (const post of unprocessedPosts.results) {
    const result = await filterContent(env, 'post', post.id, post.title + '\n\n' + post.body, post.subreddit);
    stats.processed++;
    if (result.passes) stats.passed++;
  }
  
  // Mark posts as processed
  if (unprocessedPosts.results.length > 0) {
    const ids = unprocessedPosts.results.map(p => p.id);
    await env.DB.prepare(`
      UPDATE raw_posts SET processed = 1 WHERE id IN (${ids.map(() => '?').join(',')})
    `).bind(...ids).run();
  }
  
  // Process unprocessed comments
  const unprocessedComments = await env.DB.prepare(`
    SELECT c.id, c.body, p.subreddit, p.title as post_title
    FROM raw_comments c
    JOIN raw_posts p ON p.id = c.post_id
    LEFT JOIN filter_decisions f ON f.content_id = c.id AND f.content_type = 'comment'
    WHERE c.processed = 0 AND f.id IS NULL
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  for (const comment of unprocessedComments.results) {
    const result = await filterContent(env, 'comment', comment.id, comment.body, comment.subreddit);
    stats.processed++;
    if (result.passes) stats.passed++;
  }
  
  // Mark comments as processed
  if (unprocessedComments.results.length > 0) {
    const ids = unprocessedComments.results.map(c => c.id);
    await env.DB.prepare(`
      UPDATE raw_comments SET processed = 1 WHERE id IN (${ids.map(() => '?').join(',')})
    `).bind(...ids).run();
  }
  
  return stats;
}

async function filterContent(env, contentType, contentId, text, subreddit) {
  let passes = false;
  let reason = null;
  let classification = null;
  
  // Basic filters
  if (!text || text.length < MIN_CONTENT_LENGTH) {
    reason = 'too_short';
  } else if (!isLikelyEnglish(text)) {
    reason = 'not_english';
  } else {
    // LLM classification
    try {
      classification = await classifyContent(env, text.slice(0, 2000), subreddit);
      
      if (!classification.is_pain_point) {
        reason = 'not_pain_point';
      } else if (classification.confidence < 40) {
        reason = 'low_confidence';
      } else if (classification.category === 'other') {
        reason = 'irrelevant_category';
      } else {
        passes = true;
      }
    } catch (error) {
      console.error('Classification error:', error);
      reason = 'classification_error';
    }
  }
  
  // Store decision
  await env.DB.prepare(`
    INSERT INTO filter_decisions (content_type, content_id, is_english, is_pain_point, pain_confidence, category, problem_type, passes_filter, filter_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  
  return { passes, classification };
}
