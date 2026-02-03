// Layer 9: Landing Page Generator v13
// Generate landing page copy for validated opportunities
// Uses GPT-5.2 for high-quality marketing copy generation

import { Env, PainCluster } from '../types';

// Landing page content structure
export interface LandingPageContent {
  id?: number;
  opportunity_id: number;
  headline: string;                 // Pain-focused hook (8-12 words)
  subheadline: string;              // Solution teaser (15-25 words)
  benefits: string;                 // JSON array of 3 benefits with icon, title, description
  social_proof: string;             // JSON with mention_count, sources, top_quotes
  cta_text: string;                 // Call-to-action text
  hero_description?: string;        // Extended description for hero section
  generated_at: number;
  version: number;                  // For A/B testing iterations
}

export interface Benefit {
  icon: string;                     // Emoji icon
  title: string;                    // Short benefit title (3-5 words)
  description: string;              // Benefit description (10-20 words)
}

export interface SocialProofData {
  mention_count: number;
  sources: string[];                // Subreddits/HN
  quotes: Array<{
    text: string;
    author: string;
    source: string;
  }>;
}

const BATCH_SIZE = 5;

/**
 * Generate landing page copy using GPT-5.2
 */
async function generateLandingCopy(
  apiKey: string,
  productName: string,
  tagline: string,
  targetCustomer: string,
  howItWorks: string[],
  quotes: Array<{ text: string; author: string; subreddit: string; severity?: string }>,
  features: Array<{ name: string; type: string; description: string }> | null
): Promise<{
  headline: string;
  subheadline: string;
  benefits: Benefit[];
  hero_description: string;
  cta_text: string;
} | null> {
  
  // Sample quotes for context (prioritize high severity)
  const sortedQuotes = [...quotes].sort((a, b) => {
    const severity: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return (severity[b.severity || 'medium'] || 2) - (severity[a.severity || 'medium'] || 2);
  });
  const sampleQuotes = sortedQuotes.slice(0, 5).map(q => `"${q.text.slice(0, 150)}..."`).join('\n');
  
  // Format features if available
  const featuresContext = features && features.length > 0
    ? `\n**Key Features to Highlight:**\n${features.slice(0, 5).map(f => `- ${f.name}: ${f.description}`).join('\n')}`
    : '';
  
  const prompt = `Generate high-converting landing page copy for this product.

**Product:** ${productName}
**Tagline:** ${tagline}
**Target Customer:** ${targetCustomer}

**How It Works:**
${howItWorks.map(h => `• ${h}`).join('\n')}
${featuresContext}

**Real User Pain Points (${quotes.length} mentions):**
${sampleQuotes}

Generate CONVERSION-FOCUSED copy that speaks directly to the pain:

1. **HEADLINE** (8-12 words): Start with the pain point, hint at the solution. Use power words.
   - Good: "Stop Wasting Hours on [Pain]. Finally [Benefit]."
   - Bad: "The Best [Product] for [Generic]"

2. **SUBHEADLINE** (15-25 words): Expand on the transformation. Be specific about the before/after.

3. **BENEFITS** (exactly 3): Each with:
   - Icon: Single relevant emoji
   - Title: 3-5 word punchy benefit
   - Description: 10-20 words explaining the benefit concretely

4. **HERO_DESCRIPTION** (40-60 words): Paragraph expanding the value proposition with emotional appeal.

5. **CTA_TEXT** (3-6 words): Action-oriented, specific to the product. Not generic "Sign Up" or "Learn More".

Return ONLY valid JSON:
{
  "headline": "...",
  "subheadline": "...",
  "benefits": [
    {"icon": "🎯", "title": "...", "description": "..."},
    {"icon": "⚡", "title": "...", "description": "..."},
    {"icon": "💪", "title": "...", "description": "..."}
  ],
  "hero_description": "...",
  "cta_text": "..."
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',  // GPT-5.2 equivalent
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,  // Slightly creative for marketing copy
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (parsed.headline && parsed.subheadline && parsed.benefits && parsed.cta_text) {
        return {
          headline: parsed.headline.slice(0, 200),
          subheadline: parsed.subheadline.slice(0, 300),
          benefits: (parsed.benefits || []).slice(0, 3).map((b: any) => ({
            icon: (b.icon || '✨').slice(0, 4),
            title: (b.title || 'Benefit').slice(0, 50),
            description: (b.description || '').slice(0, 200)
          })),
          hero_description: (parsed.hero_description || '').slice(0, 500),
          cta_text: (parsed.cta_text || 'Get Started').slice(0, 50)
        };
      }
    }
    
    console.error('Failed to parse landing copy response:', content.slice(0, 200));
  } catch (error) {
    console.error('Landing copy generation error:', error);
  }
  
  return null;
}

/**
 * Build social proof data from quotes
 */
function buildSocialProof(
  quotes: Array<{ text: string; author: string; subreddit: string }>,
  subreddits: string[]
): SocialProofData {
  // Get top 3 most impactful quotes (shortest and punchiest)
  const topQuotes = quotes
    .filter(q => q.text.length >= 30 && q.text.length <= 200)
    .slice(0, 3)
    .map(q => ({
      text: q.text,
      author: q.author,
      source: q.subreddit === 'hackernews' ? 'HackerNews' : `r/${q.subreddit}`
    }));
  
  // Fallback if no good quotes
  if (topQuotes.length === 0 && quotes.length > 0) {
    topQuotes.push({
      text: quotes[0].text.slice(0, 200),
      author: quotes[0].author,
      source: quotes[0].subreddit === 'hackernews' ? 'HackerNews' : `r/${quotes[0].subreddit}`
    });
  }
  
  return {
    mention_count: quotes.length,
    sources: subreddits.map(s => s === 'hackernews' ? 'HackerNews' : `r/${s}`),
    quotes: topQuotes
  };
}

/**
 * Store landing page content in database
 */
async function storeLandingPage(db: D1Database, landing: LandingPageContent): Promise<number> {
  const result = await db.prepare(`
    INSERT OR REPLACE INTO landing_pages 
    (opportunity_id, headline, subheadline, benefits, social_proof, cta_text, hero_description, generated_at, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    landing.opportunity_id,
    landing.headline,
    landing.subheadline,
    landing.benefits,
    landing.social_proof,
    landing.cta_text,
    landing.hero_description || null,
    landing.generated_at,
    landing.version
  ).run();
  
  return result.meta.last_row_id || 0;
}

/**
 * Generate landing page for a single opportunity
 */
export async function generateLandingForOpportunity(
  db: D1Database,
  apiKey: string,
  opportunityId: number
): Promise<LandingPageContent | null> {
  // Get cluster data
  const cluster = await db.prepare(`
    SELECT * FROM pain_clusters WHERE id = ?
  `).bind(opportunityId).first() as any;
  
  if (!cluster || !cluster.product_name) {
    console.log(`Opportunity ${opportunityId} not found or missing product name`);
    return null;
  }
  
  // Get all quotes
  const members = await db.prepare(`
    SELECT pr.raw_quote, pr.author, pr.subreddit, pr.severity
    FROM pain_records pr
    JOIN cluster_members cm ON pr.id = cm.pain_record_id
    WHERE cm.cluster_id = ?
  `).bind(opportunityId).all();
  
  const quotes = (members.results || []).map((r: any) => ({
    text: r.raw_quote || '',
    author: r.author || 'anonymous',
    subreddit: r.subreddit || 'unknown',
    severity: r.severity
  }));
  
  if (quotes.length === 0) {
    console.log(`Opportunity ${opportunityId} has no quotes`);
    return null;
  }
  
  // Get MVP features if available
  let features: Array<{ name: string; type: string; description: string }> | null = null;
  try {
    const featuresResult = await db.prepare(`
      SELECT feature_name, feature_type, description 
      FROM mvp_features 
      WHERE opportunity_id = ?
      ORDER BY priority_score DESC
      LIMIT 5
    `).bind(opportunityId).all();
    
    if (featuresResult.results && featuresResult.results.length > 0) {
      features = (featuresResult.results as any[]).map(f => ({
        name: f.feature_name,
        type: f.feature_type,
        description: f.description
      }));
    }
  } catch (e) {
    // mvp_features table might not exist, continue without
  }
  
  // Parse how it works
  let howItWorks: string[] = [];
  try {
    howItWorks = JSON.parse(cluster.how_it_works || '[]');
  } catch {}
  
  // Parse subreddits
  let subreddits: string[] = [];
  try {
    subreddits = JSON.parse(cluster.subreddits_list || '[]');
  } catch {}
  
  // Get current version
  const existingLanding = await db.prepare(`
    SELECT version FROM landing_pages WHERE opportunity_id = ?
  `).bind(opportunityId).first() as any;
  const newVersion = existingLanding ? (existingLanding.version || 0) + 1 : 1;
  
  // Generate copy
  const copy = await generateLandingCopy(
    apiKey,
    cluster.product_name,
    cluster.tagline || '',
    cluster.target_customer || '',
    howItWorks,
    quotes,
    features
  );
  
  if (!copy) {
    console.log(`Failed to generate copy for ${cluster.product_name}`);
    return null;
  }
  
  // Build social proof
  const socialProof = buildSocialProof(quotes, subreddits);
  
  // Create landing page content
  const landing: LandingPageContent = {
    opportunity_id: opportunityId,
    headline: copy.headline,
    subheadline: copy.subheadline,
    benefits: JSON.stringify(copy.benefits),
    social_proof: JSON.stringify(socialProof),
    cta_text: copy.cta_text,
    hero_description: copy.hero_description,
    generated_at: Date.now(),
    version: newVersion
  };
  
  // Store in database
  const id = await storeLandingPage(db, landing);
  landing.id = id;
  
  console.log(`Generated landing page v${newVersion} for "${cluster.product_name}"`);
  
  return landing;
}

/**
 * Main entry point: Generate landing pages for opportunities missing them
 */
export async function runLandingGeneration(env: Env): Promise<{
  processed: number;
  generated: number;
  failed: number;
  skipped: number;
}> {
  const db = env.DB;
  const apiKey = env.OPENAI_API_KEY;
  
  console.log('\n=== v13 Landing Page Generation ===');
  
  // Get clusters with 5+ members that don't have landing pages yet (or stale > 7 days)
  const clusters = await db.prepare(`
    SELECT c.id, c.product_name FROM pain_clusters c
    LEFT JOIN landing_pages l ON c.id = l.opportunity_id
    WHERE c.social_proof_count >= 5
      AND c.product_name IS NOT NULL
      AND (l.opportunity_id IS NULL OR l.generated_at < ?)
    ORDER BY c.social_proof_count DESC
    LIMIT ?
  `).bind(Date.now() - 7 * 24 * 60 * 60 * 1000, BATCH_SIZE).all();
  
  const toProcess = clusters.results || [];
  console.log(`Found ${toProcess.length} opportunities needing landing pages`);
  
  let processed = 0;
  let generated = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const row of toProcess) {
    const cluster = row as any;
    processed++;
    
    try {
      const landing = await generateLandingForOpportunity(db, apiKey, cluster.id);
      
      if (landing) {
        generated++;
        console.log(`  ✓ ${cluster.product_name} (v${landing.version})`);
      } else {
        skipped++;
        console.log(`  ⊘ ${cluster.product_name} (skipped)`);
      }
    } catch (error) {
      failed++;
      console.error(`  ✗ ${cluster.product_name}:`, error);
    }
    
    // Rate limiting - 500ms between calls
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`\n=== Landing Generation Complete ===`);
  console.log(`Processed: ${processed}, Generated: ${generated}, Failed: ${failed}, Skipped: ${skipped}`);
  
  return { processed, generated, failed, skipped };
}

/**
 * Get landing page for a specific opportunity
 */
export async function getLandingPage(
  db: D1Database,
  opportunityId: number
): Promise<LandingPageContent | null> {
  const result = await db.prepare(`
    SELECT * FROM landing_pages WHERE opportunity_id = ?
  `).bind(opportunityId).first() as any;
  
  if (!result) return null;
  
  return {
    id: result.id,
    opportunity_id: result.opportunity_id,
    headline: result.headline,
    subheadline: result.subheadline,
    benefits: result.benefits,
    social_proof: result.social_proof,
    cta_text: result.cta_text,
    hero_description: result.hero_description,
    generated_at: result.generated_at,
    version: result.version
  };
}

/**
 * Get all landing pages with opportunity context
 */
export async function getAllLandingPages(
  db: D1Database,
  limit: number = 100
): Promise<Array<LandingPageContent & { product_name: string; tagline: string; social_proof_count: number }>> {
  const result = await db.prepare(`
    SELECT l.*, c.product_name, c.tagline, c.social_proof_count
    FROM landing_pages l
    JOIN pain_clusters c ON l.opportunity_id = c.id
    ORDER BY l.generated_at DESC
    LIMIT ?
  `).bind(limit).all();
  
  return (result.results || []).map((r: any) => ({
    id: r.id,
    opportunity_id: r.opportunity_id,
    headline: r.headline,
    subheadline: r.subheadline,
    benefits: r.benefits,
    social_proof: r.social_proof,
    cta_text: r.cta_text,
    hero_description: r.hero_description,
    generated_at: r.generated_at,
    version: r.version,
    product_name: r.product_name,
    tagline: r.tagline,
    social_proof_count: r.social_proof_count
  }));
}

/**
 * Get landing page generation stats
 */
export async function getLandingStats(db: D1Database): Promise<{
  total_generated: number;
  opportunities_with_landing: number;
  avg_version: number;
  last_generated: number | null;
}> {
  const [totalResult, oppResult, avgResult, lastResult] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as count FROM landing_pages`).first(),
    db.prepare(`SELECT COUNT(DISTINCT opportunity_id) as count FROM landing_pages`).first(),
    db.prepare(`SELECT AVG(version) as avg FROM landing_pages`).first(),
    db.prepare(`SELECT MAX(generated_at) as last FROM landing_pages`).first()
  ]);
  
  return {
    total_generated: (totalResult as any)?.count || 0,
    opportunities_with_landing: (oppResult as any)?.count || 0,
    avg_version: Math.round(((avgResult as any)?.avg || 1) * 10) / 10,
    last_generated: (lastResult as any)?.last || null
  };
}
