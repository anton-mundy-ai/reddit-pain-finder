// Layer 7: Market Sizing v11
// Estimate TAM/SAM/SOM for opportunities based on category, geography, and industry
// Uses GPT-5-nano for classification and industry benchmarks for estimation

import { Env, PainCluster } from '../types';

// Market size tiers (rough order of magnitude)
export type MarketTier = '$1M' | '$10M' | '$100M' | '$1B' | '$10B+';

// Pain point categories for market sizing
export type PainCategory = 
  | 'b2b_saas_enterprise'    // Enterprise SaaS (>1000 employees)
  | 'b2b_saas_smb'           // SMB SaaS (<500 employees)
  | 'b2b_saas_startup'       // Startup tools (<50 employees)
  | 'consumer_mass'          // Mass consumer (100M+ potential users)
  | 'consumer_niche'         // Niche consumer (1M-10M users)
  | 'prosumer'               // Professional consumers / creators
  | 'developer_tools'        // Dev tools & infrastructure
  | 'fintech'                // Financial technology
  | 'healthtech'             // Health & wellness
  | 'ecommerce'              // E-commerce & retail
  | 'productivity'           // Productivity & workflow
  | 'education'              // EdTech
  | 'gaming'                 // Gaming & entertainment
  | 'other';

// Geographic scope
export type GeoScope = 'global' | 'us_only' | 'english_speaking' | 'regional';

// Market estimate result
export interface MarketEstimate {
  cluster_id: number;
  tam_estimate: number;         // Total Addressable Market in USD
  tam_tier: MarketTier;         // Rough order of magnitude
  sam_estimate: number;         // Serviceable Addressable Market
  sam_tier: MarketTier;
  som_estimate: number;         // Serviceable Obtainable Market
  som_tier: MarketTier;
  confidence: number;           // 0-1 confidence score
  category: PainCategory;
  geo_scope: GeoScope;
  industry_vertical: string;
  reasoning: string;
  estimated_at: number;
}

// Industry TAM benchmarks (conservative estimates in USD)
const INDUSTRY_TAM_BENCHMARKS: Record<PainCategory, number> = {
  'b2b_saas_enterprise': 100_000_000_000,   // $100B - Enterprise software
  'b2b_saas_smb': 50_000_000_000,           // $50B - SMB software
  'b2b_saas_startup': 10_000_000_000,       // $10B - Startup tools
  'consumer_mass': 500_000_000_000,         // $500B - Mass consumer
  'consumer_niche': 5_000_000_000,          // $5B - Niche consumer
  'prosumer': 20_000_000_000,               // $20B - Creator economy
  'developer_tools': 50_000_000_000,        // $50B - Dev tools
  'fintech': 200_000_000_000,               // $200B - Fintech
  'healthtech': 150_000_000_000,            // $150B - Health tech
  'ecommerce': 300_000_000_000,             // $300B - E-commerce
  'productivity': 40_000_000_000,           // $40B - Productivity
  'education': 30_000_000_000,              // $30B - EdTech
  'gaming': 200_000_000_000,                // $200B - Gaming
  'other': 10_000_000_000,                  // $10B - Fallback
};

// Subreddit to category hints
const SUBREDDIT_CATEGORY_HINTS: Record<string, PainCategory> = {
  // Enterprise / SMB
  'sysadmin': 'b2b_saas_enterprise',
  'msp': 'b2b_saas_smb',
  'salesforce': 'b2b_saas_enterprise',
  'hubspot': 'b2b_saas_smb',
  'ITManagers': 'b2b_saas_enterprise',
  
  // Developer tools
  'programming': 'developer_tools',
  'webdev': 'developer_tools',
  'devops': 'developer_tools',
  'golang': 'developer_tools',
  'rust': 'developer_tools',
  'python': 'developer_tools',
  'javascript': 'developer_tools',
  'hackernews': 'developer_tools',
  
  // Startups
  'startups': 'b2b_saas_startup',
  'SaaS': 'b2b_saas_startup',
  'Entrepreneur': 'b2b_saas_startup',
  'smallbusiness': 'b2b_saas_smb',
  
  // Fintech
  'personalfinance': 'fintech',
  'CryptoCurrency': 'fintech',
  'investing': 'fintech',
  'FinancialPlanning': 'fintech',
  
  // Prosumer / Creator
  'Freelance': 'prosumer',
  'freelanceWriters': 'prosumer',
  'Photography': 'prosumer',
  'videography': 'prosumer',
  'youtube': 'prosumer',
  'Twitch': 'prosumer',
  
  // Consumer
  'LifeProTips': 'consumer_mass',
  'lifehacks': 'consumer_mass',
  'productivity': 'productivity',
  
  // Health
  'ADHD': 'healthtech',
  'mentalhealth': 'healthtech',
  'Fitness': 'healthtech',
  
  // Education
  'learnprogramming': 'education',
  'languagelearning': 'education',
  
  // E-commerce
  'dropship': 'ecommerce',
  'FulfillmentByAmazon': 'ecommerce',
  'Etsy': 'ecommerce',
};

const BATCH_SIZE = 10;

/**
 * Classify pain point category using GPT-5-nano
 */
async function classifyCategory(
  apiKey: string,
  productName: string,
  tagline: string,
  subreddits: string[],
  personas: string[],
  topQuotes: string[]
): Promise<{ category: PainCategory; geo_scope: GeoScope; industry: string; confidence: number }> {
  // Quick heuristic based on subreddits
  let hintCategory: PainCategory = 'other';
  for (const sub of subreddits) {
    if (SUBREDDIT_CATEGORY_HINTS[sub]) {
      hintCategory = SUBREDDIT_CATEGORY_HINTS[sub];
      break;
    }
  }
  
  const prompt = `Classify this product opportunity for market sizing:

Product: ${productName}
Tagline: ${tagline}
Active subreddits: ${subreddits.slice(0, 5).join(', ')}
Target personas: ${personas.slice(0, 3).join(', ')}
Sample quotes: ${topQuotes.slice(0, 2).join(' | ').slice(0, 300)}

Categories (pick one):
- b2b_saas_enterprise: Enterprise software for large companies (>1000 emp)
- b2b_saas_smb: Software for small-medium businesses
- b2b_saas_startup: Tools for startups and founders
- consumer_mass: Mass market consumer app (100M+ potential users)
- consumer_niche: Niche consumer product (1-10M users)
- prosumer: Professional consumers, creators, freelancers
- developer_tools: Developer tools, APIs, infrastructure
- fintech: Financial technology, payments, investing
- healthtech: Health, wellness, medical
- ecommerce: E-commerce, retail, marketplace
- productivity: Productivity and workflow tools
- education: Educational technology
- gaming: Gaming and entertainment
- other: Doesn't fit above

Geographic scope:
- global: Appeals worldwide
- us_only: Primarily US market
- english_speaking: US, UK, AU, CA
- regional: Specific region/country

Return JSON only:
{"category": "...", "geo_scope": "...", "industry": "specific vertical name", "confidence": 0.0-1.0}`;

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
        temperature: 0.3,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category || hintCategory,
        geo_scope: parsed.geo_scope || 'english_speaking',
        industry: parsed.industry || 'general',
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5))
      };
    }
  } catch (error) {
    console.error('Classification error:', error);
  }
  
  // Fallback to heuristic
  return {
    category: hintCategory,
    geo_scope: 'english_speaking',
    industry: 'general software',
    confidence: 0.3
  };
}

/**
 * Calculate market size based on category, signals, and heuristics
 */
function calculateMarketSize(
  category: PainCategory,
  geoScope: GeoScope,
  socialProofCount: number,
  subredditCount: number,
  uniqueAuthors: number
): { tam: number; sam: number; som: number } {
  // Start with industry baseline
  let tam = INDUSTRY_TAM_BENCHMARKS[category];
  
  // Geographic adjustment
  const geoMultipliers: Record<GeoScope, number> = {
    'global': 1.0,
    'english_speaking': 0.5,
    'us_only': 0.35,
    'regional': 0.15
  };
  tam = tam * geoMultipliers[geoScope];
  
  // Niche down based on specificity (more specific = smaller but more capturable)
  // If many unique subreddits, it's more cross-cutting = larger market
  const specificityMultiplier = Math.min(1, 0.1 + (subredditCount * 0.15));
  tam = tam * specificityMultiplier;
  
  // SAM: What portion can you realistically serve?
  // Typically 10-40% of TAM for SaaS
  const samPercent = category.includes('b2b') ? 0.25 : 0.15;
  const sam = tam * samPercent;
  
  // SOM: What you can capture in 3-5 years
  // Based on social proof as proxy for problem severity
  // More mentions = more urgent problem = higher capturable market
  let somPercent: number;
  if (socialProofCount >= 50) somPercent = 0.05;      // 5% of SAM
  else if (socialProofCount >= 20) somPercent = 0.03;  // 3% of SAM
  else if (socialProofCount >= 10) somPercent = 0.02;  // 2% of SAM
  else somPercent = 0.01;                              // 1% of SAM
  
  const som = sam * somPercent;
  
  return { tam, sam, som };
}

/**
 * Convert dollar amount to tier label
 */
function toMarketTier(value: number): MarketTier {
  if (value >= 10_000_000_000) return '$10B+';
  if (value >= 1_000_000_000) return '$1B';
  if (value >= 100_000_000) return '$100M';
  if (value >= 10_000_000) return '$10M';
  return '$1M';
}

/**
 * Estimate market size for a single cluster
 */
async function estimateClusterMarket(
  db: D1Database,
  apiKey: string,
  cluster: PainCluster
): Promise<MarketEstimate | null> {
  if (!cluster.id) return null;
  
  // Parse cluster data
  let subreddits: string[] = [];
  let personas: string[] = [];
  let topQuotes: string[] = [];
  
  try {
    subreddits = JSON.parse(cluster.subreddits_list || '[]');
    const categories = JSON.parse(cluster.categories || '{}');
    personas = categories.personas || [];
    topQuotes = JSON.parse(cluster.top_quotes || '[]').map((q: any) => q.text || q).slice(0, 3);
  } catch {}
  
  // Classify the opportunity
  const classification = await classifyCategory(
    apiKey,
    cluster.product_name || 'Unnamed Product',
    cluster.tagline || '',
    subreddits,
    personas,
    topQuotes
  );
  
  // Calculate market sizes
  const { tam, sam, som } = calculateMarketSize(
    classification.category,
    classification.geo_scope,
    cluster.social_proof_count || 0,
    subreddits.length,
    cluster.unique_authors || 0
  );
  
  // Build reasoning
  const reasoning = `Category: ${classification.category} (${classification.industry}). ` +
    `Geographic scope: ${classification.geo_scope}. ` +
    `Based on ${cluster.social_proof_count} mentions across ${subreddits.length} communities. ` +
    `TAM derived from ${classification.category} industry benchmark, adjusted for scope and specificity.`;
  
  return {
    cluster_id: cluster.id,
    tam_estimate: Math.round(tam),
    tam_tier: toMarketTier(tam),
    sam_estimate: Math.round(sam),
    sam_tier: toMarketTier(sam),
    som_estimate: Math.round(som),
    som_tier: toMarketTier(som),
    confidence: classification.confidence,
    category: classification.category,
    geo_scope: classification.geo_scope,
    industry_vertical: classification.industry,
    reasoning,
    estimated_at: Date.now()
  };
}

/**
 * Store market estimate in database
 */
async function storeMarketEstimate(db: D1Database, estimate: MarketEstimate): Promise<void> {
  await db.prepare(`
    INSERT OR REPLACE INTO market_estimates 
    (cluster_id, tam_estimate, tam_tier, sam_estimate, sam_tier, som_estimate, som_tier,
     confidence, category, geo_scope, industry_vertical, reasoning, estimated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    estimate.cluster_id,
    estimate.tam_estimate,
    estimate.tam_tier,
    estimate.sam_estimate,
    estimate.sam_tier,
    estimate.som_estimate,
    estimate.som_tier,
    estimate.confidence,
    estimate.category,
    estimate.geo_scope,
    estimate.industry_vertical,
    estimate.reasoning,
    estimate.estimated_at
  ).run();
}

/**
 * Main entry point: Estimate markets for clusters missing estimates
 */
export async function runMarketSizing(env: Env): Promise<{
  estimated: number;
  failed: number;
  categories: Record<string, number>;
}> {
  const db = env.DB;
  const apiKey = env.OPENAI_API_KEY;
  
  console.log('\n=== v11 Market Sizing ===');
  
  // Get clusters with 5+ members that don't have recent estimates (or any)
  const clusters = await db.prepare(`
    SELECT c.* FROM pain_clusters c
    LEFT JOIN market_estimates m ON c.id = m.cluster_id
    WHERE c.social_proof_count >= 5
      AND c.product_name IS NOT NULL
      AND (m.cluster_id IS NULL OR m.estimated_at < ?)
    ORDER BY c.social_proof_count DESC
    LIMIT ?
  `).bind(Date.now() - 7 * 24 * 60 * 60 * 1000, BATCH_SIZE).all(); // Re-estimate weekly
  
  const toProcess = clusters.results || [];
  console.log(`Found ${toProcess.length} clusters to estimate`);
  
  let estimated = 0;
  let failed = 0;
  const categories: Record<string, number> = {};
  
  for (const row of toProcess) {
    const cluster = row as any as PainCluster;
    
    try {
      const estimate = await estimateClusterMarket(db, apiKey, cluster);
      
      if (estimate) {
        await storeMarketEstimate(db, estimate);
        estimated++;
        categories[estimate.category] = (categories[estimate.category] || 0) + 1;
        
        console.log(`  ${cluster.product_name}: ${estimate.tam_tier} TAM (${estimate.category})`);
      }
    } catch (error) {
      console.error(`  Error estimating ${cluster.product_name}:`, error);
      failed++;
    }
    
    // Rate limiting - 200ms between calls
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n=== Market Sizing Complete ===`);
  console.log(`Estimated: ${estimated}, Failed: ${failed}`);
  
  return { estimated, failed, categories };
}

/**
 * Get market estimate for a specific opportunity
 */
export async function getMarketEstimate(db: D1Database, clusterId: number): Promise<MarketEstimate | null> {
  const result = await db.prepare(`
    SELECT * FROM market_estimates WHERE cluster_id = ?
  `).bind(clusterId).first();
  
  if (!result) return null;
  
  return {
    cluster_id: (result as any).cluster_id,
    tam_estimate: (result as any).tam_estimate,
    tam_tier: (result as any).tam_tier,
    sam_estimate: (result as any).sam_estimate,
    sam_tier: (result as any).sam_tier,
    som_estimate: (result as any).som_estimate,
    som_tier: (result as any).som_tier,
    confidence: (result as any).confidence,
    category: (result as any).category,
    geo_scope: (result as any).geo_scope,
    industry_vertical: (result as any).industry_vertical,
    reasoning: (result as any).reasoning,
    estimated_at: (result as any).estimated_at
  };
}

/**
 * Get all market estimates (for API)
 */
export async function getAllMarketEstimates(db: D1Database, limit: number = 100): Promise<any[]> {
  const result = await db.prepare(`
    SELECT m.*, c.product_name, c.tagline, c.social_proof_count, c.total_score
    FROM market_estimates m
    JOIN pain_clusters c ON m.cluster_id = c.id
    ORDER BY m.tam_estimate DESC
    LIMIT ?
  `).bind(limit).all();
  
  return result.results || [];
}

/**
 * Get market sizing stats
 */
export async function getMarketSizingStats(db: D1Database): Promise<{
  total_estimated: number;
  by_tier: Record<MarketTier, number>;
  by_category: Record<string, number>;
  avg_confidence: number;
}> {
  const [countResult, tierResult, categoryResult, confidenceResult] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as count FROM market_estimates`).first(),
    db.prepare(`
      SELECT tam_tier, COUNT(*) as count 
      FROM market_estimates 
      GROUP BY tam_tier
    `).all(),
    db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM market_estimates 
      GROUP BY category
      ORDER BY count DESC
    `).all(),
    db.prepare(`SELECT AVG(confidence) as avg FROM market_estimates`).first()
  ]);
  
  const byTier: Record<MarketTier, number> = {
    '$1M': 0, '$10M': 0, '$100M': 0, '$1B': 0, '$10B+': 0
  };
  for (const row of tierResult.results || []) {
    byTier[(row as any).tam_tier as MarketTier] = (row as any).count;
  }
  
  const byCategory: Record<string, number> = {};
  for (const row of categoryResult.results || []) {
    byCategory[(row as any).category] = (row as any).count;
  }
  
  return {
    total_estimated: (countResult as any)?.count || 0,
    by_tier: byTier,
    by_category: byCategory,
    avg_confidence: (confidenceResult as any)?.avg || 0
  };
}
