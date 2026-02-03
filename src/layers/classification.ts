// Layer 2: Classification - Use GPT-4o-mini to classify content

import { Env, Classification, ClassificationResponse, RawPost, RawComment } from '../types';
import { callGPT4oMini } from '../utils/openai';

const BATCH_SIZE = 10;

const CLASSIFICATION_PROMPT = `You are an expert at identifying pain points in online discussions. Analyze the following content from Reddit and classify it.

Respond in JSON format:
{
  "is_pain_point": boolean,
  "pain_type": "consumer" | "business" | "technical" | null,
  "content_type": "complaint" | "recommendation_ask" | "rant" | "how_to" | "other",
  "confidence": number (0-1),
  "reasoning": "brief explanation"
}

Guidelines:
- "is_pain_point" = true if describing a real problem, frustration, or unmet need
- "pain_type": consumer = personal/household; business = B2B/professional; technical = software/hardware
- Skip memes, jokes, banter, link-only posts
- Australian slang is valid English
- Look for: "frustrated", "can't find", "nothing works", "I need", "does anyone know"`;

function isValidContent(content: string): boolean {
  if (!content || content.length < 50) return false;
  if (/^\[deleted\]/i.test(content) || /^\[removed\]/i.test(content)) return false;
  if (/^https?:\/\/\S+$/i.test(content)) return false;
  return true;
}

async function classifyContent(apiKey: string, content: string, title?: string): Promise<ClassificationResponse | null> {
  const fullContent = title ? `Title: ${title}\n\nContent: ${content}` : content;
  
  try {
    const { content: responseText } = await callGPT4oMini(apiKey,
      [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: fullContent.slice(0, 2000) }
      ],
      { temperature: 0.1, max_tokens: 200, json_mode: true }
    );
    return JSON.parse(responseText) as ClassificationResponse;
  } catch (error) {
    console.error('Classification error:', error);
    return null;
  }
}

async function storeClassification(db: D1Database, classification: Classification): Promise<void> {
  await db.prepare(`
    INSERT OR REPLACE INTO classifications
    (source_type, source_id, is_pain_point, pain_type, content_type, confidence, raw_response, classified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    classification.source_type, classification.source_id, classification.is_pain_point,
    classification.pain_type, classification.content_type, classification.confidence,
    classification.raw_response, classification.classified_at
  ).run();
}

export async function runClassification(env: Env): Promise<{
  classified: number;
  pain_points_found: number;
}> {
  const db = env.DB;
  let classified = 0;
  let painPointsFound = 0;
  
  // Process posts
  const posts = await db.prepare(`
    SELECT p.* FROM raw_posts p
    LEFT JOIN classifications c ON c.source_type = 'post' AND c.source_id = p.id
    WHERE c.id IS NULL AND (LENGTH(p.body) > 50 OR LENGTH(p.title) > 30)
    ORDER BY p.score DESC LIMIT ?
  `).bind(BATCH_SIZE).all() as D1Result<RawPost>;
  
  for (const post of posts.results || []) {
    const content = post.body || '';
    const fullContent = `${post.title}\n\n${content}`.trim();
    
    if (!isValidContent(fullContent) && fullContent.length < 30) {
      await storeClassification(db, {
        source_type: 'post', source_id: post.id, is_pain_point: 0, pain_type: null,
        content_type: 'other', confidence: 1, raw_response: '{"skipped": "invalid"}',
        classified_at: Math.floor(Date.now() / 1000)
      });
      continue;
    }
    
    const result = await classifyContent(env.OPENAI_API_KEY, content, post.title);
    if (result) {
      await storeClassification(db, {
        source_type: 'post', source_id: post.id, is_pain_point: result.is_pain_point ? 1 : 0,
        pain_type: result.pain_type, content_type: result.content_type, confidence: result.confidence,
        raw_response: JSON.stringify(result), classified_at: Math.floor(Date.now() / 1000)
      });
      classified++;
      if (result.is_pain_point) painPointsFound++;
    }
    
    await db.prepare("UPDATE raw_posts SET processed_at = ? WHERE id = ?")
      .bind(Math.floor(Date.now() / 1000), post.id).run();
  }
  
  // Process comments
  const comments = await db.prepare(`
    SELECT c.* FROM raw_comments c
    LEFT JOIN classifications cl ON cl.source_type = 'comment' AND cl.source_id = c.id
    WHERE cl.id IS NULL AND LENGTH(c.body) > 50
    ORDER BY c.score DESC LIMIT ?
  `).bind(BATCH_SIZE).all() as D1Result<RawComment>;
  
  for (const comment of comments.results || []) {
    if (!isValidContent(comment.body)) {
      await storeClassification(db, {
        source_type: 'comment', source_id: comment.id, is_pain_point: 0, pain_type: null,
        content_type: 'other', confidence: 1, raw_response: '{"skipped": "invalid"}',
        classified_at: Math.floor(Date.now() / 1000)
      });
      continue;
    }
    
    const result = await classifyContent(env.OPENAI_API_KEY, comment.body);
    if (result) {
      await storeClassification(db, {
        source_type: 'comment', source_id: comment.id, is_pain_point: result.is_pain_point ? 1 : 0,
        pain_type: result.pain_type, content_type: result.content_type, confidence: result.confidence,
        raw_response: JSON.stringify(result), classified_at: Math.floor(Date.now() / 1000)
      });
      classified++;
      if (result.is_pain_point) painPointsFound++;
    }
    
    await db.prepare("UPDATE raw_comments SET processed_at = ? WHERE id = ?")
      .bind(Math.floor(Date.now() / 1000), comment.id).run();
  }
  
  return { classified, pain_points_found: painPointsFound };
}

export async function getUnextractedPainPoints(db: D1Database, limit: number = 20): Promise<{
  posts: (RawPost & { classification: Classification })[];
  comments: (RawComment & { classification: Classification })[];
}> {
  const postsResult = await db.prepare(`
    SELECT p.*, c.is_pain_point, c.pain_type, c.content_type, c.confidence
    FROM raw_posts p
    JOIN classifications c ON c.source_type = 'post' AND c.source_id = p.id
    LEFT JOIN pain_records pr ON pr.source_type = 'post' AND pr.source_id = p.id
    WHERE c.is_pain_point = 1 AND pr.id IS NULL
    ORDER BY c.confidence DESC, p.score DESC LIMIT ?
  `).bind(limit).all();
  
  const commentsResult = await db.prepare(`
    SELECT cm.*, c.is_pain_point, c.pain_type, c.content_type, c.confidence
    FROM raw_comments cm
    JOIN classifications c ON c.source_type = 'comment' AND c.source_id = cm.id
    LEFT JOIN pain_records pr ON pr.source_type = 'comment' AND pr.source_id = cm.id
    WHERE c.is_pain_point = 1 AND pr.id IS NULL
    ORDER BY c.confidence DESC, cm.score DESC LIMIT ?
  `).bind(limit).all();
  
  return {
    posts: (postsResult.results || []) as any[],
    comments: (commentsResult.results || []) as any[]
  };
}
