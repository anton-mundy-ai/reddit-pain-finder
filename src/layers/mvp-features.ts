// Layer 8: MVP Feature Extraction v12
// Extract actionable feature requirements from pain points
// Uses GPT-5-nano to identify must-have, nice-to-have, and differentiator features

import { Env, PainCluster } from '../types';

// Feature types
export type FeatureType = 'must_have' | 'nice_to_have' | 'differentiator';

// Extracted feature
export interface MVPFeature {
  id?: number;
  opportunity_id: number;
  feature_name: string;
  feature_type: FeatureType;
  description: string;
  priority_score: number;        // 0-100 based on mentions × severity
  mention_count: number;
  source_quotes: string;         // JSON array of quote snippets
  confidence: number;            // 0-1 confidence in extraction
  extracted_at: number;
}

// Feature with full opportunity context
export interface FeatureWithContext extends MVPFeature {
  product_name: string;
  tagline: string;
  social_proof_count: number;
}

const BATCH_SIZE = 10;

/**
 * Extract features from pain points using GPT-5-nano
 */
async function extractFeaturesFromCluster(
  apiKey: string,
  productName: string,
  tagline: string,
  targetCustomer: string,
  quotes: Array<{ text: string; severity?: string; persona?: string }>
): Promise<Array<{
  feature_name: string;
  feature_type: FeatureType;
  description: string;
  source_snippets: string[];
  confidence: number;
}>> {
  
  // Group quotes by severity for context
  const criticalQuotes = quotes.filter(q => q.severity === 'critical' || q.severity === 'high');
  const mediumQuotes = quotes.filter(q => q.severity === 'medium');
  const otherQuotes = quotes.filter(q => !q.severity || q.severity === 'low');
  
  const quotesSample = [
    ...criticalQuotes.slice(0, 5),
    ...mediumQuotes.slice(0, 3),
    ...otherQuotes.slice(0, 2)
  ].map(q => q.text.slice(0, 200)).join('\n\n---\n\n');
  
  const prompt = `Analyze these user pain points and extract specific MVP features that would solve them.

**Product:** ${productName}
**Tagline:** ${tagline}
**Target:** ${targetCustomer}

**User Pain Points (${quotes.length} total):**
${quotesSample}

**Extract features in 3 categories:**

1. **MUST-HAVE** (🔴): Core features that directly solve the main pain. Without these, the product is useless.
2. **NICE-TO-HAVE** (🟡): Features users mentioned but aren't critical for launch.
3. **DIFFERENTIATOR** (🔵): Features that would beat existing solutions/competitors.

For each feature, include:
- A specific, actionable feature name (not vague)
- Brief description of what it does
- Which quote(s) support it (short snippets)

Return JSON array (max 10 features total):
[
  {
    "feature_name": "Specific Feature Name",
    "feature_type": "must_have" | "nice_to_have" | "differentiator",
    "description": "What this feature does and why it matters",
    "source_snippets": ["quote snippet 1", "quote snippet 2"],
    "confidence": 0.0-1.0
  }
]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.filter((f: any) => 
        f.feature_name && 
        ['must_have', 'nice_to_have', 'differentiator'].includes(f.feature_type)
      ).map((f: any) => ({
        feature_name: f.feature_name.slice(0, 100),
        feature_type: f.feature_type as FeatureType,
        description: (f.description || '').slice(0, 500),
        source_snippets: (f.source_snippets || []).slice(0, 5),
        confidence: Math.min(1, Math.max(0, f.confidence || 0.7))
      }));
    }
  } catch (error) {
    console.error('Feature extraction error:', error);
  }
  
  return [];
}

/**
 * Calculate priority score based on mentions, severity, and feature type
 */
function calculatePriorityScore(
  featureType: FeatureType,
  mentionCount: number,
  avgSeverity: number,  // 1-4 scale
  confidence: number
): number {
  // Base score from feature type
  const typeMultipliers: Record<FeatureType, number> = {
    'must_have': 1.5,
    'nice_to_have': 0.8,
    'differentiator': 1.2
  };
  
  // Mentions contribute 0-40 points
  const mentionScore = Math.min(40, Math.log2(mentionCount + 1) * 15);
  
  // Severity contributes 0-30 points  
  const severityScore = (avgSeverity / 4) * 30;
  
  // Confidence contributes 0-20 points
  const confidenceScore = confidence * 20;
  
  // Type multiplier
  const baseScore = mentionScore + severityScore + confidenceScore;
  
  return Math.round(baseScore * typeMultipliers[featureType]);
}

/**
 * Count feature mentions in quotes
 */
function countFeatureMentions(
  featureName: string,
  sourceSnippets: string[],
  allQuotes: string[]
): number {
  // Direct matches from extracted snippets
  let count = sourceSnippets.length;
  
  // Check for keyword matches in all quotes
  const keywords = featureName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  for (const quote of allQuotes) {
    const lowerQuote = quote.toLowerCase();
    const matches = keywords.filter(kw => lowerQuote.includes(kw)).length;
    if (matches >= 2) count++;  // At least 2 keyword matches
  }
  
  return Math.max(1, count);  // At least 1 mention (the extraction itself)
}

/**
 * Get average severity from quotes
 */
function getAvgSeverity(quotes: Array<{ severity?: string }>): number {
  const severityValues: Record<string, number> = {
    'critical': 4,
    'high': 3,
    'medium': 2,
    'low': 1
  };
  
  let total = 0;
  let count = 0;
  
  for (const q of quotes) {
    if (q.severity && severityValues[q.severity]) {
      total += severityValues[q.severity];
      count++;
    }
  }
  
  return count > 0 ? total / count : 2;  // Default to medium
}

/**
 * Store features in database
 */
async function storeFeatures(db: D1Database, features: MVPFeature[]): Promise<number> {
  let stored = 0;
  
  for (const feature of features) {
    try {
      await db.prepare(`
        INSERT OR REPLACE INTO mvp_features 
        (opportunity_id, feature_name, feature_type, description, 
         priority_score, mention_count, source_quotes, confidence, extracted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        feature.opportunity_id,
        feature.feature_name,
        feature.feature_type,
        feature.description,
        feature.priority_score,
        feature.mention_count,
        feature.source_quotes,
        feature.confidence,
        feature.extracted_at
      ).run();
      stored++;
    } catch (error) {
      console.error(`Error storing feature "${feature.feature_name}":`, error);
    }
  }
  
  return stored;
}

/**
 * Extract features for a single cluster
 */
async function extractClusterFeatures(
  db: D1Database,
  apiKey: string,
  cluster: PainCluster
): Promise<MVPFeature[]> {
  if (!cluster.id || !cluster.product_name) return [];
  
  // Get all quotes for this cluster with severity info
  const members = await db.prepare(`
    SELECT pr.raw_quote, pr.severity, pr.persona
    FROM pain_records pr
    JOIN cluster_members cm ON pr.id = cm.pain_record_id
    WHERE cm.cluster_id = ?
  `).bind(cluster.id).all();
  
  const quotes = (members.results || []).map((r: any) => ({
    text: r.raw_quote || '',
    severity: r.severity,
    persona: r.persona
  }));
  
  if (quotes.length === 0) return [];
  
  // Extract features using LLM
  const extractedFeatures = await extractFeaturesFromCluster(
    apiKey,
    cluster.product_name || 'Unknown',
    cluster.tagline || '',
    cluster.target_customer || '',
    quotes
  );
  
  const avgSeverity = getAvgSeverity(quotes);
  const allQuoteTexts = quotes.map(q => q.text);
  const now = Date.now();
  
  // Convert to MVPFeature objects with priority scoring
  const features: MVPFeature[] = extractedFeatures.map(f => {
    const mentionCount = countFeatureMentions(f.feature_name, f.source_snippets, allQuoteTexts);
    const priority = calculatePriorityScore(
      f.feature_type,
      mentionCount,
      avgSeverity,
      f.confidence
    );
    
    return {
      opportunity_id: cluster.id!,
      feature_name: f.feature_name,
      feature_type: f.feature_type,
      description: f.description,
      priority_score: priority,
      mention_count: mentionCount,
      source_quotes: JSON.stringify(f.source_snippets),
      confidence: f.confidence,
      extracted_at: now
    };
  });
  
  return features;
}

/**
 * Main entry point: Extract features for opportunities missing them
 */
export async function runMVPFeatureExtraction(env: Env): Promise<{
  processed: number;
  features_extracted: number;
  by_type: Record<FeatureType, number>;
  failed: number;
}> {
  const db = env.DB;
  const apiKey = env.OPENAI_API_KEY;
  
  console.log('\n=== v12 MVP Feature Extraction ===');
  
  // Get clusters with 5+ members that don't have features yet (or stale)
  const clusters = await db.prepare(`
    SELECT c.* FROM pain_clusters c
    LEFT JOIN (
      SELECT opportunity_id, MAX(extracted_at) as latest
      FROM mvp_features
      GROUP BY opportunity_id
    ) f ON c.id = f.opportunity_id
    WHERE c.social_proof_count >= 5
      AND c.product_name IS NOT NULL
      AND (f.opportunity_id IS NULL OR f.latest < ?)
    ORDER BY c.social_proof_count DESC
    LIMIT ?
  `).bind(Date.now() - 7 * 24 * 60 * 60 * 1000, BATCH_SIZE).all(); // Re-extract weekly
  
  const toProcess = clusters.results || [];
  console.log(`Found ${toProcess.length} opportunities to extract features from`);
  
  let processed = 0;
  let featuresExtracted = 0;
  let failed = 0;
  const byType: Record<FeatureType, number> = {
    'must_have': 0,
    'nice_to_have': 0,
    'differentiator': 0
  };
  
  for (const row of toProcess) {
    const cluster = row as any as PainCluster;
    
    try {
      // Clear old features for this cluster
      await db.prepare(`DELETE FROM mvp_features WHERE opportunity_id = ?`)
        .bind(cluster.id).run();
      
      // Extract new features
      const features = await extractClusterFeatures(db, apiKey, cluster);
      
      if (features.length > 0) {
        const stored = await storeFeatures(db, features);
        featuresExtracted += stored;
        
        // Count by type
        for (const f of features) {
          byType[f.feature_type]++;
        }
        
        console.log(`  ${cluster.product_name}: ${features.length} features ` +
          `(🔴${features.filter(f => f.feature_type === 'must_have').length} ` +
          `🟡${features.filter(f => f.feature_type === 'nice_to_have').length} ` +
          `🔵${features.filter(f => f.feature_type === 'differentiator').length})`);
        
        processed++;
      }
    } catch (error) {
      console.error(`  Error extracting features for ${cluster.product_name}:`, error);
      failed++;
    }
    
    // Rate limiting - 300ms between calls
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`\n=== Feature Extraction Complete ===`);
  console.log(`Processed: ${processed}, Features: ${featuresExtracted}, Failed: ${failed}`);
  console.log(`By type: Must-have=${byType.must_have}, Nice-to-have=${byType.nice_to_have}, Differentiators=${byType.differentiator}`);
  
  return { processed, features_extracted: featuresExtracted, by_type: byType, failed };
}

/**
 * Get features for a specific opportunity
 */
export async function getOpportunityFeatures(
  db: D1Database, 
  opportunityId: number
): Promise<MVPFeature[]> {
  const result = await db.prepare(`
    SELECT * FROM mvp_features 
    WHERE opportunity_id = ?
    ORDER BY priority_score DESC
  `).bind(opportunityId).all();
  
  return (result.results || []).map((r: any) => ({
    id: r.id,
    opportunity_id: r.opportunity_id,
    feature_name: r.feature_name,
    feature_type: r.feature_type as FeatureType,
    description: r.description,
    priority_score: r.priority_score,
    mention_count: r.mention_count,
    source_quotes: r.source_quotes,
    confidence: r.confidence,
    extracted_at: r.extracted_at
  }));
}

/**
 * Get all features across opportunities (for API)
 */
export async function getAllFeatures(
  db: D1Database, 
  limit: number = 100,
  featureType?: FeatureType
): Promise<FeatureWithContext[]> {
  let query = `
    SELECT f.*, c.product_name, c.tagline, c.social_proof_count
    FROM mvp_features f
    JOIN pain_clusters c ON f.opportunity_id = c.id
  `;
  
  if (featureType) {
    query += ` WHERE f.feature_type = ?`;
  }
  
  query += ` ORDER BY f.priority_score DESC LIMIT ?`;
  
  const stmt = featureType
    ? db.prepare(query).bind(featureType, limit)
    : db.prepare(query).bind(limit);
    
  const result = await stmt.all();
  
  return (result.results || []).map((r: any) => ({
    id: r.id,
    opportunity_id: r.opportunity_id,
    feature_name: r.feature_name,
    feature_type: r.feature_type as FeatureType,
    description: r.description,
    priority_score: r.priority_score,
    mention_count: r.mention_count,
    source_quotes: r.source_quotes,
    confidence: r.confidence,
    extracted_at: r.extracted_at,
    product_name: r.product_name,
    tagline: r.tagline,
    social_proof_count: r.social_proof_count
  }));
}

/**
 * Get feature extraction stats
 */
export async function getFeatureStats(db: D1Database): Promise<{
  total_features: number;
  by_type: Record<FeatureType, number>;
  opportunities_with_features: number;
  avg_features_per_opportunity: number;
  top_priority_features: number;
}> {
  const [totalResult, typeResult, oppResult, avgResult, topResult] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as count FROM mvp_features`).first(),
    db.prepare(`
      SELECT feature_type, COUNT(*) as count 
      FROM mvp_features 
      GROUP BY feature_type
    `).all(),
    db.prepare(`SELECT COUNT(DISTINCT opportunity_id) as count FROM mvp_features`).first(),
    db.prepare(`
      SELECT AVG(feature_count) as avg FROM (
        SELECT COUNT(*) as feature_count 
        FROM mvp_features 
        GROUP BY opportunity_id
      )
    `).first(),
    db.prepare(`SELECT COUNT(*) as count FROM mvp_features WHERE priority_score >= 60`).first()
  ]);
  
  const byType: Record<FeatureType, number> = {
    'must_have': 0,
    'nice_to_have': 0,
    'differentiator': 0
  };
  
  for (const row of typeResult.results || []) {
    byType[(row as any).feature_type as FeatureType] = (row as any).count;
  }
  
  return {
    total_features: (totalResult as any)?.count || 0,
    by_type: byType,
    opportunities_with_features: (oppResult as any)?.count || 0,
    avg_features_per_opportunity: Math.round(((avgResult as any)?.avg || 0) * 10) / 10,
    top_priority_features: (topResult as any)?.count || 0
  };
}
