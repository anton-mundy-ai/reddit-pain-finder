// Layer 3: Extraction - Extract structured pain records

import { Env, PainRecord, ExtractionResponse, RawPost, RawComment } from '../types';
import { callGPT5Nano } from '../utils/openai';
import { getUnextractedPainPoints } from './classification';

const BATCH_SIZE = 5;

const EXTRACTION_PROMPT = `Extract structured information from this Reddit pain point.

Respond in JSON:
{
  "problem_statement": "Clear 1-2 sentence summary",
  "persona": "Who has this problem (e.g., 'small business owner', 'Melbourne commuter')",
  "context": {
    "industry": "industry/domain or null",
    "location": "geographic context (prioritize AU) or null",
    "situation": "specific situation triggering the problem"
  },
  "severity": { "score": 1-10, "signals": ["severity indicators"] },
  "frequency": { "score": 1-10, "signals": ["frequency indicators"] },
  "workaround": "current workaround or null",
  "willingness_to_pay": { "score": 1-10, "hints": ["W2P indicators"] },
  "constraints": ["regulatory, privacy, geographic constraints"],
  "domain_tags": ["tags like 'saas', 'agriculture', 'finance'"],
  "confidence": 0-1
}

Scoring: Severity = "can't", "frustrated", "desperate"; Frequency = "always", "every week"; W2P = "I'd pay", "costing me", B2B context`;

async function extractPainPoint(apiKey: string, content: string, title?: string, subreddit?: string): Promise<ExtractionResponse | null> {
  const contextNote = subreddit ? `\nSubreddit: r/${subreddit}` : '';
  const fullContent = title ? `Title: ${title}${contextNote}\n\nContent: ${content}` : `${contextNote}\nContent: ${content}`;
  
  try {
    const { content: responseText } = await callGPT5Nano(apiKey,
      [{ role: 'system', content: EXTRACTION_PROMPT }, { role: 'user', content: fullContent.slice(0, 3000) }],
      { temperature: 0.2, max_completion_tokens: 600, json_mode: true }
    );
    return JSON.parse(responseText) as ExtractionResponse;
  } catch (error) {
    console.error('Extraction error:', error);
    return null;
  }
}

async function storePainRecord(db: D1Database, record: PainRecord): Promise<number | null> {
  try {
    await db.prepare(`
      INSERT OR REPLACE INTO pain_records
      (source_type, source_id, subreddit, problem_text, persona, 
       context_industry, context_location, context_situation,
       severity_score, frequency_score, w2p_score,
       severity_signals, frequency_signals, workaround_text, w2p_hints, constraints,
       domain_tags, extraction_confidence, raw_extraction,
       source_url, source_author, source_score, source_created_utc, extracted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.source_type, record.source_id, record.subreddit, record.problem_text, record.persona,
      record.context_industry, record.context_location, record.context_situation,
      record.severity_score, record.frequency_score, record.w2p_score,
      record.severity_signals, record.frequency_signals, record.workaround_text, record.w2p_hints, record.constraints,
      record.domain_tags, record.extraction_confidence, record.raw_extraction,
      record.source_url, record.source_author, record.source_score, record.source_created_utc, record.extracted_at
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

export async function runExtraction(env: Env): Promise<{ extracted: number }> {
  const db = env.DB;
  let extracted = 0;
  
  const { posts, comments } = await getUnextractedPainPoints(db, BATCH_SIZE);
  
  for (const post of posts) {
    const result = await extractPainPoint(env.OPENAI_API_KEY, post.body || '', post.title, post.subreddit);
    if (result) {
      const record: PainRecord = {
        source_type: 'post', source_id: post.id, subreddit: post.subreddit,
        problem_text: result.problem_statement, persona: result.persona,
        context_industry: result.context.industry, context_location: result.context.location, context_situation: result.context.situation,
        severity_score: result.severity.score, frequency_score: result.frequency.score, w2p_score: result.willingness_to_pay.score,
        severity_signals: JSON.stringify(result.severity.signals), frequency_signals: JSON.stringify(result.frequency.signals),
        workaround_text: result.workaround, w2p_hints: JSON.stringify(result.willingness_to_pay.hints),
        constraints: JSON.stringify(result.constraints), domain_tags: JSON.stringify(result.domain_tags),
        extraction_confidence: result.confidence, raw_extraction: JSON.stringify(result),
        source_url: post.permalink, source_author: post.author, source_score: post.score, source_created_utc: post.created_utc,
        extracted_at: Math.floor(Date.now() / 1000), cluster_id: null
      };
      const id = await storePainRecord(db, record);
      if (id) extracted++;
    }
  }
  
  for (const comment of comments) {
    const postResult = await db.prepare("SELECT subreddit, permalink FROM raw_posts WHERE id = ?")
      .bind(comment.post_id).first() as { subreddit: string; permalink: string } | null;
    
    const result = await extractPainPoint(env.OPENAI_API_KEY, comment.body, undefined, postResult?.subreddit);
    if (result) {
      const record: PainRecord = {
        source_type: 'comment', source_id: comment.id, subreddit: postResult?.subreddit || 'unknown',
        problem_text: result.problem_statement, persona: result.persona,
        context_industry: result.context.industry, context_location: result.context.location, context_situation: result.context.situation,
        severity_score: result.severity.score, frequency_score: result.frequency.score, w2p_score: result.willingness_to_pay.score,
        severity_signals: JSON.stringify(result.severity.signals), frequency_signals: JSON.stringify(result.frequency.signals),
        workaround_text: result.workaround, w2p_hints: JSON.stringify(result.willingness_to_pay.hints),
        constraints: JSON.stringify(result.constraints), domain_tags: JSON.stringify(result.domain_tags),
        extraction_confidence: result.confidence, raw_extraction: JSON.stringify(result),
        source_url: postResult?.permalink ? `${postResult.permalink}${comment.id}` : null,
        source_author: comment.author, source_score: comment.score, source_created_utc: comment.created_utc,
        extracted_at: Math.floor(Date.now() / 1000), cluster_id: null
      };
      const id = await storePainRecord(db, record);
      if (id) extracted++;
    }
  }
  
  return { extracted };
}

export async function getUnclusteredRecords(db: D1Database, limit: number = 50): Promise<PainRecord[]> {
  const result = await db.prepare(`
    SELECT * FROM pain_records WHERE cluster_id IS NULL ORDER BY severity_score DESC, w2p_score DESC LIMIT ?
  `).bind(limit).all() as D1Result<PainRecord>;
  return result.results || [];
}
