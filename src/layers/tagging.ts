// Layer 2.5: QUALITY TAGGING with GPT-5.2 v6.1
// Rich tagging for EVERY pain point:
// - 3-5 fine-grained topics (specific, not broad)
// - Keywords
// - Persona affected
// - Severity

import { Env, PainRecord, Severity } from '../types';
import { callGPT52 } from '../utils/openai';
import { getUntaggedRecords } from './extraction';

const BATCH_SIZE = 30;  // GPT-5.2 is more expensive, smaller batches

// v6.1: Quality tagging prompt
const TAGGING_PROMPT = `Analyze this pain point and extract structured tags.

PAIN POINT:
"""
{QUOTE}
"""
From: r/{SUBREDDIT}

Generate:
1. **topics**: 3-5 FINE-GRAINED, SPECIFIC topics. NOT broad categories like "money" or "time". 
   Use specific problem patterns like:
   - "invoice_payment_delays" not "money"
   - "client_ghosting" not "communication"
   - "scope_creep" not "projects"
   - "contractor_no_shows" not "hiring"
   Format: lowercase_with_underscores

2. **keywords**: 5-10 specific words/phrases from the text

3. **persona**: WHO has this problem? Be specific:
   - "freelance_designer" not "freelancer"
   - "small_restaurant_owner" not "business owner"
   - "first_home_buyer" not "buyer"

4. **severity**: How painful is this?
   - "low": Minor annoyance
   - "medium": Significant frustration
   - "high": Major problem affecting work/life
   - "critical": Urgent, causing real harm/loss

Respond in JSON:
{
  "topics": ["topic_one", "topic_two", "topic_three"],
  "keywords": ["word1", "word2", ...],
  "persona": "specific_persona",
  "severity": "low|medium|high|critical"
}`;

interface TaggingResult {
  topics: string[];
  keywords: string[];
  persona: string;
  severity: Severity;
}

async function tagPainPoint(
  apiKey: string, 
  quote: string, 
  subreddit: string
): Promise<TaggingResult | null> {
  const prompt = TAGGING_PROMPT
    .replace('{QUOTE}', quote.slice(0, 1200))
    .replace('{SUBREDDIT}', subreddit);

  try {
    const { content } = await callGPT52(apiKey,
      [{ role: 'user', content: prompt }],
      { max_completion_tokens: 300, json_mode: true }
    );
    
    const result = JSON.parse(content);
    
    // Validate and normalize
    return {
      topics: (result.topics || [])
        .slice(0, 5)
        .map((t: string) => t.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')),
      keywords: (result.keywords || []).slice(0, 10),
      persona: (result.persona || 'unknown').toLowerCase().replace(/\s+/g, '_'),
      severity: ['low', 'medium', 'high', 'critical'].includes(result.severity) 
        ? result.severity 
        : 'medium'
    };
  } catch (error) {
    console.error('Tagging error:', error);
    return null;
  }
}

async function updateRecordTags(
  db: D1Database,
  recordId: number,
  tags: TaggingResult
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  await db.prepare(`
    UPDATE pain_records SET 
      topics = ?,
      keywords = ?,
      persona = ?,
      severity = ?,
      tagged_at = ?
    WHERE id = ?
  `).bind(
    JSON.stringify(tags.topics),
    JSON.stringify(tags.keywords),
    tags.persona,
    tags.severity,
    now,
    recordId
  ).run();
}

export async function runTagging(env: Env): Promise<{
  tagged: number;
  failed: number;
  topics_created: Set<string>;
  personas_found: Set<string>;
}> {
  const db = env.DB;
  let tagged = 0;
  let failed = 0;
  const topicsCreated = new Set<string>();
  const personasFound = new Set<string>();
  
  const records = await getUntaggedRecords(db, BATCH_SIZE);
  
  console.log(`Quality tagging ${records.length} pain points with GPT-5.2...`);
  
  for (const record of records) {
    if (!record.id) continue;
    
    const tags = await tagPainPoint(
      env.OPENAI_API_KEY,
      record.raw_quote,
      record.subreddit
    );
    
    if (tags) {
      await updateRecordTags(db, record.id, tags);
      tagged++;
      
      // Track unique topics and personas
      tags.topics.forEach(t => topicsCreated.add(t));
      personasFound.add(tags.persona);
      
      if (tagged % 10 === 0) {
        console.log(`  Tagged ${tagged} records, ${topicsCreated.size} unique topics...`);
      }
    } else {
      failed++;
    }
  }
  
  console.log(`\n=== Tagging Complete ===`);
  console.log(`Tagged: ${tagged}, Failed: ${failed}`);
  console.log(`Unique topics: ${topicsCreated.size}`);
  console.log(`Unique personas: ${personasFound.size}`);
  
  return { 
    tagged, 
    failed, 
    topics_created: topicsCreated,
    personas_found: personasFound 
  };
}

/**
 * Get all unique topics with their counts
 */
export async function getTopicStats(db: D1Database): Promise<Map<string, number>> {
  const records = await db.prepare(`
    SELECT topics FROM pain_records WHERE topics IS NOT NULL
  `).all();
  
  const topicCounts = new Map<string, number>();
  
  for (const row of records.results || []) {
    try {
      const topics = JSON.parse((row as any).topics || '[]');
      for (const topic of topics) {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      }
    } catch {}
  }
  
  return topicCounts;
}
