/**
 * Layer 3: Extraction
 * Extract structured pain records from filtered content
 * Adapted to existing database schema
 */

import { extractPainRecord } from '../utils/llm.js';
import { hasAustralianContext } from '../utils/reddit.js';

const BATCH_SIZE = 3;

export async function runExtraction(env) {
  const stats = { extracted: 0 };
  
  // Get content that passed filtering but hasn't been extracted yet
  const toExtract = await env.DB.prepare(`
    SELECT 
      f.content_type,
      f.content_id,
      f.category,
      p.title || ' ' || COALESCE(p.body, '') as text,
      p.subreddit,
      p.permalink,
      p.author,
      p.title as post_title,
      p.score,
      p.created_utc
    FROM filter_decisions f
    JOIN raw_posts p ON f.content_id = p.id AND f.content_type = 'post'
    LEFT JOIN pain_records pr ON pr.source_id = f.content_id AND pr.source_type = f.content_type
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
      
      const severityScore = calculateSeverityScore(extracted.severity_signals);
      
      // Store pain record using existing schema column names
      await env.DB.prepare(`
        INSERT INTO pain_records (
          source_type, source_id, subreddit,
          problem_text, persona,
          context_industry, context_location, context_situation,
          severity_score, severity_signals, frequency_signals,
          workaround_text, w2p_hints, constraints,
          source_url, source_author, source_score, source_created_utc, extracted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      `).bind(
        item.content_type,
        item.content_id,
        item.subreddit,
        extracted.problem_statement || '',
        extracted.persona || '',
        extracted.context?.industry || null,
        extracted.context?.location || null,
        extracted.context?.situation || null,
        severityScore,
        JSON.stringify(extracted.severity_signals || []),
        JSON.stringify(extracted.frequency_signals || []),
        extracted.current_workaround || null,
        extracted.willingness_to_pay || null,
        JSON.stringify(extracted.constraints || []),
        item.permalink ? `https://reddit.com${item.permalink}` : null,
        item.author,
        item.score || 0,
        item.created_utc
      ).run();
      
      stats.extracted++;
      console.log(`Extracted pain record from r/${item.subreddit}`);
    } catch (error) {
      console.error('Extraction error:', error.message);
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
