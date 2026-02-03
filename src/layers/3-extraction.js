/**
 * Layer 3: Extraction
 * Extract structured pain records from filtered content
 */

import { extractPainRecord } from '../utils/llm.js';
import { hasAustralianContext } from '../utils/reddit.js';

const BATCH_SIZE = 15;

export async function runExtraction(env) {
  const stats = { extracted: 0 };
  
  // Get content that passed filtering but hasn't been extracted yet
  const toExtract = await env.DB.prepare(`
    SELECT 
      f.content_type,
      f.content_id,
      f.category,
      f.problem_type,
      CASE 
        WHEN f.content_type = 'post' THEN p.title || '\n\n' || p.body
        ELSE c.body
      END as text,
      CASE 
        WHEN f.content_type = 'post' THEN p.subreddit
        ELSE ps.subreddit
      END as subreddit,
      CASE 
        WHEN f.content_type = 'post' THEN p.permalink
        ELSE 'https://reddit.com' || ps.permalink
      END as url,
      CASE 
        WHEN f.content_type = 'post' THEN p.author
        ELSE c.author
      END as author,
      CASE 
        WHEN f.content_type = 'post' THEN p.title
        ELSE ps.title
      END as post_title
    FROM filter_decisions f
    LEFT JOIN raw_posts p ON f.content_type = 'post' AND f.content_id = p.id
    LEFT JOIN raw_comments c ON f.content_type = 'comment' AND f.content_id = c.id
    LEFT JOIN raw_posts ps ON f.content_type = 'comment' AND c.post_id = ps.id
    LEFT JOIN pain_records pr ON pr.content_type = f.content_type AND pr.content_id = f.content_id
    WHERE f.passes_filter = 1 AND pr.id IS NULL
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  for (const item of toExtract.results) {
    try {
      const extracted = await extractPainRecord(env, item.text.slice(0, 3000), item.subreddit, {
        title: item.post_title,
      });
      
      // Determine AU context
      const isAU = hasAustralianContext(item.text, item.subreddit);
      if (isAU && !extracted.context?.location) {
        extracted.context = extracted.context || {};
        extracted.context.location = 'Australia';
      }
      
      // Store pain record
      await env.DB.prepare(`
        INSERT INTO pain_records (
          content_type, content_id, subreddit,
          problem_statement, persona,
          context_industry, context_location, context_situation,
          severity_score, severity_signals, frequency_signals,
          current_workaround, willingness_to_pay, constraints,
          raw_quote, reddit_url, author
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        item.content_type,
        item.content_id,
        item.subreddit,
        extracted.problem_statement || '',
        extracted.persona || '',
        extracted.context?.industry || null,
        extracted.context?.location || null,
        extracted.context?.situation || null,
        calculateSeverityScore(extracted.severity_signals),
        JSON.stringify(extracted.severity_signals || []),
        JSON.stringify(extracted.frequency_signals || []),
        extracted.current_workaround || null,
        extracted.willingness_to_pay || null,
        JSON.stringify(extracted.constraints || []),
        item.text.slice(0, 500),
        item.url,
        item.author
      ).run();
      
      stats.extracted++;
    } catch (error) {
      console.error('Extraction error:', error);
    }
  }
  
  return stats;
}

function calculateSeverityScore(signals) {
  if (!signals || !Array.isArray(signals)) return 0;
  
  const highSeverityTerms = ['impossible', 'nightmare', 'critical', 'urgent', 'emergency', 'desperate', 'breaking', 'failing'];
  const mediumSeverityTerms = ['frustrated', 'annoying', 'difficult', 'struggle', 'problem', 'issue', 'painful'];
  
  let score = 0;
  for (const signal of signals) {
    const lower = signal.toLowerCase();
    if (highSeverityTerms.some(t => lower.includes(t))) {
      score += 20;
    } else if (mediumSeverityTerms.some(t => lower.includes(t))) {
      score += 10;
    } else {
      score += 5;
    }
  }
  
  return Math.min(100, score);
}
