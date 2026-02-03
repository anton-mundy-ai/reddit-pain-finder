// Layer v16: Geographic Analysis
// Detect location mentions in pain points and tag by region
// Primary focus: Australia (AU)

import { Env } from '../types';

// Region codes and their detection patterns
export type RegionCode = 'AU' | 'US' | 'UK' | 'EU' | 'GLOBAL';

export interface GeoDetection {
  region: RegionCode;
  confidence: number;  // 0-1
  signals: string[];   // What triggered the detection
}

// Australian subreddits (high confidence)
const AU_SUBREDDITS = new Set([
  'australia', 'melbourne', 'sydney', 'brisbane', 'perth', 'adelaide',
  'ausfinance', 'ausproperty', 'auslegal', 'australianpolitics',
  'canberra', 'hobart', 'darwin', 'goldcoast', 'newcastle',
  'auslaw', 'australianmfa', 'ausstocks', 'ausmemes',
]);

// US subreddits (high confidence)  
const US_SUBREDDITS = new Set([
  'askanamerican', 'usanews', 'politicalhumor', 'wallstreetbets',
  'sanfrancisco', 'nyc', 'losangeles', 'chicago', 'texas', 'florida',
  'california', 'personalfinance', 'legaladvice',
]);

// UK subreddits (high confidence)
const UK_SUBREDDITS = new Set([
  'unitedkingdom', 'ukpolitics', 'britishproblems', 'casualuk',
  'london', 'ukpersonalfinance', 'legaladviceuk',
]);

// Location keywords with their regions
const LOCATION_KEYWORDS: Array<{ pattern: RegExp; region: RegionCode; weight: number }> = [
  // Australia - cities and states
  { pattern: /\b(sydney|melbourne|brisbane|perth|adelaide|canberra|hobart|darwin|gold coast|newcastle)\b/i, region: 'AU', weight: 0.8 },
  { pattern: /\b(nsw|new south wales|victoria|vic|queensland|qld|western australia|wa|south australia|sa|tasmania|tas|northern territory|nt|act)\b/i, region: 'AU', weight: 0.7 },
  { pattern: /\b(australia|aussie|australian|straya|ozzie|downunder)\b/i, region: 'AU', weight: 0.9 },
  { pattern: /\b(aud|\$[0-9]+k?m? aud|centrelink|medicare australia|myob|xero|afterpay)\b/i, region: 'AU', weight: 0.6 },
  { pattern: /\b(nbn|telstra|optus|woolworths|coles|bunnings|aldi australia)\b/i, region: 'AU', weight: 0.5 },
  
  // US - cities and states
  { pattern: /\b(new york|los angeles|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|jacksonville|san francisco|seattle|denver|boston|atlanta|miami|portland|las vegas)\b/i, region: 'US', weight: 0.8 },
  { pattern: /\b(california|texas|florida|new york state|pennsylvania|ohio|illinois|georgia|north carolina|michigan)\b/i, region: 'US', weight: 0.7 },
  { pattern: /\b(america|american|usa|united states|u\.s\.|u\.s\.a)\b/i, region: 'US', weight: 0.9 },
  { pattern: /\b(usd|\$[0-9]+k?m? usd|401k|irs|medicare|medicaid|obamacare|aca|social security|venmo|zelle)\b/i, region: 'US', weight: 0.6 },
  { pattern: /\b(dmv|hoa|state farm|geico|costco us|walmart|target)\b/i, region: 'US', weight: 0.5 },
  
  // UK - cities and regions
  { pattern: /\b(london|manchester|birmingham|leeds|glasgow|liverpool|newcastle uk|sheffield|bristol|edinburgh|cardiff|belfast)\b/i, region: 'UK', weight: 0.8 },
  { pattern: /\b(england|scotland|wales|northern ireland|uk|britain|british|united kingdom)\b/i, region: 'UK', weight: 0.9 },
  { pattern: /\b(gbp|£[0-9]+k?m?|nhs|hmrc|council tax|national insurance|monzo|revolut uk)\b/i, region: 'UK', weight: 0.6 },
  { pattern: /\b(tesco|sainsbury|asda|argos|currys|boots uk)\b/i, region: 'UK', weight: 0.5 },
  
  // EU - major cities and countries
  { pattern: /\b(paris|berlin|madrid|rome|amsterdam|brussels|vienna|munich|barcelona|milan|prague|dublin|lisbon)\b/i, region: 'EU', weight: 0.7 },
  { pattern: /\b(germany|france|spain|italy|netherlands|belgium|austria|ireland|portugal|greece|poland|sweden|denmark|finland|norway)\b/i, region: 'EU', weight: 0.8 },
  { pattern: /\b(europe|european|eu|eur|€[0-9]+k?m?|gdpr|schengen)\b/i, region: 'EU', weight: 0.7 },
];

/**
 * Detect the most likely region for a pain point
 */
export function detectRegion(
  text: string,
  subreddit: string
): GeoDetection {
  const signals: string[] = [];
  const scores: Record<RegionCode, number> = {
    AU: 0,
    US: 0,
    UK: 0,
    EU: 0,
    GLOBAL: 0.1, // Base score for global
  };
  
  const lowerSubreddit = subreddit.toLowerCase();
  
  // 1. Check subreddit (highest confidence)
  if (AU_SUBREDDITS.has(lowerSubreddit)) {
    scores.AU += 0.9;
    signals.push(`subreddit:r/${subreddit}`);
  } else if (US_SUBREDDITS.has(lowerSubreddit)) {
    scores.US += 0.9;
    signals.push(`subreddit:r/${subreddit}`);
  } else if (UK_SUBREDDITS.has(lowerSubreddit)) {
    scores.UK += 0.9;
    signals.push(`subreddit:r/${subreddit}`);
  }
  
  // 2. Check text content for location keywords
  for (const { pattern, region, weight } of LOCATION_KEYWORDS) {
    const matches = text.match(pattern);
    if (matches) {
      scores[region] += weight;
      signals.push(`keyword:${matches[0].toLowerCase()}`);
    }
  }
  
  // 3. Find the highest scoring region
  let maxRegion: RegionCode = 'GLOBAL';
  let maxScore = scores.GLOBAL;
  
  for (const [region, score] of Object.entries(scores) as Array<[RegionCode, number]>) {
    if (score > maxScore) {
      maxScore = score;
      maxRegion = region;
    }
  }
  
  // Normalize confidence to 0-1
  const confidence = Math.min(maxScore, 1);
  
  return {
    region: maxRegion,
    confidence,
    signals: [...new Set(signals)].slice(0, 5), // Dedupe and limit
  };
}

/**
 * Run geo analysis on untagged pain records
 */
export async function runGeoAnalysis(env: Env): Promise<{
  analyzed: number;
  by_region: Record<RegionCode, number>;
}> {
  const db = env.DB;
  
  console.log('\n=== v16 Geographic Analysis ===\n');
  
  // Get pain records without geo tags
  const records = await db.prepare(`
    SELECT id, raw_quote, subreddit 
    FROM pain_records 
    WHERE geo_region IS NULL 
      AND raw_quote IS NOT NULL
    ORDER BY extracted_at DESC
    LIMIT 500
  `).all();
  
  const toProcess = records.results || [];
  console.log(`Found ${toProcess.length} records to geo-tag...`);
  
  const byRegion: Record<RegionCode, number> = {
    AU: 0,
    US: 0,
    UK: 0,
    EU: 0,
    GLOBAL: 0,
  };
  
  let analyzed = 0;
  
  // Batch update for efficiency
  const batchSize = 50;
  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);
    
    const updates: Array<{ id: number; region: RegionCode; confidence: number; signals: string }> = [];
    
    for (const record of batch) {
      const r = record as any;
      const detection = detectRegion(r.raw_quote || '', r.subreddit || '');
      
      updates.push({
        id: r.id,
        region: detection.region,
        confidence: detection.confidence,
        signals: JSON.stringify(detection.signals),
      });
      
      byRegion[detection.region]++;
      analyzed++;
    }
    
    // Batch update
    for (const update of updates) {
      await db.prepare(`
        UPDATE pain_records 
        SET geo_region = ?, geo_confidence = ?, geo_signals = ?
        WHERE id = ?
      `).bind(update.region, update.confidence, update.signals, update.id).run();
    }
    
    if (analyzed % 100 === 0) {
      console.log(`  Analyzed ${analyzed}/${toProcess.length}...`);
    }
  }
  
  // Update geo_stats table
  await updateGeoStats(db);
  
  console.log('\n=== Geo Analysis Complete ===');
  console.log(`Analyzed: ${analyzed}`);
  console.log('By region:', byRegion);
  
  return { analyzed, by_region: byRegion };
}

/**
 * Update aggregated geo stats table
 */
async function updateGeoStats(db: D1Database): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  // Get current counts by region
  const stats = await db.prepare(`
    SELECT 
      geo_region,
      COUNT(*) as pain_count,
      COUNT(DISTINCT cluster_id) as cluster_count,
      AVG(geo_confidence) as avg_confidence
    FROM pain_records
    WHERE geo_region IS NOT NULL
    GROUP BY geo_region
  `).all();
  
  for (const row of stats.results || []) {
    const r = row as any;
    await db.prepare(`
      INSERT INTO geo_stats (region, pain_count, cluster_count, avg_confidence, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(region) DO UPDATE SET
        pain_count = excluded.pain_count,
        cluster_count = excluded.cluster_count,
        avg_confidence = excluded.avg_confidence,
        updated_at = excluded.updated_at
    `).bind(r.geo_region, r.pain_count, r.cluster_count, r.avg_confidence, now).run();
  }
}

/**
 * Get geo stats summary
 */
export async function getGeoStats(db: D1Database): Promise<{
  regions: Array<{
    region: RegionCode;
    pain_count: number;
    cluster_count: number;
    avg_confidence: number;
    percentage: number;
  }>;
  total: number;
}> {
  const result = await db.prepare(`
    SELECT 
      region,
      pain_count,
      cluster_count,
      avg_confidence
    FROM geo_stats
    ORDER BY pain_count DESC
  `).all();
  
  const regions = (result.results || []) as Array<{
    region: RegionCode;
    pain_count: number;
    cluster_count: number;
    avg_confidence: number;
  }>;
  
  const total = regions.reduce((sum, r) => sum + r.pain_count, 0);
  
  return {
    regions: regions.map(r => ({
      ...r,
      percentage: total > 0 ? Math.round((r.pain_count / total) * 100) : 0,
    })),
    total,
  };
}

/**
 * Get opportunities filtered by region
 */
export async function getOpportunitiesByRegion(
  db: D1Database,
  region: RegionCode,
  limit: number = 50
): Promise<any[]> {
  // Get cluster IDs where majority of pain points are from this region
  const result = await db.prepare(`
    SELECT 
      c.id,
      c.product_name,
      c.tagline,
      c.how_it_works,
      c.target_customer,
      c.topic,
      c.topic_canonical,
      c.broad_category,
      c.social_proof_count,
      c.total_score,
      c.subreddits_list,
      c.top_quotes,
      c.categories,
      c.updated_at,
      COUNT(pr.id) as region_count,
      ROUND(COUNT(pr.id) * 100.0 / c.social_proof_count, 1) as region_percentage
    FROM pain_clusters c
    JOIN pain_records pr ON pr.cluster_id = c.id
    WHERE pr.geo_region = ?
      AND c.product_name IS NOT NULL
      AND c.social_proof_count >= 3
    GROUP BY c.id
    HAVING region_count >= 2
    ORDER BY region_percentage DESC, c.social_proof_count DESC
    LIMIT ?
  `).bind(region, limit).all();
  
  return result.results || [];
}

/**
 * Get region breakdown for a specific cluster
 */
export async function getClusterRegionBreakdown(
  db: D1Database,
  clusterId: number
): Promise<Record<RegionCode, number>> {
  const result = await db.prepare(`
    SELECT geo_region, COUNT(*) as count
    FROM pain_records
    WHERE cluster_id = ? AND geo_region IS NOT NULL
    GROUP BY geo_region
  `).all();
  
  const breakdown: Record<RegionCode, number> = {
    AU: 0,
    US: 0,
    UK: 0,
    EU: 0,
    GLOBAL: 0,
  };
  
  for (const row of result.results || []) {
    const r = row as any;
    if (r.geo_region in breakdown) {
      breakdown[r.geo_region as RegionCode] = r.count;
    }
  }
  
  return breakdown;
}

// Region display info
export const REGION_INFO: Record<RegionCode, { emoji: string; name: string; color: string }> = {
  AU: { emoji: '🇦🇺', name: 'Australia', color: '#00843D' },
  US: { emoji: '🇺🇸', name: 'United States', color: '#3C3B6E' },
  UK: { emoji: '🇬🇧', name: 'United Kingdom', color: '#012169' },
  EU: { emoji: '🇪🇺', name: 'Europe', color: '#003399' },
  GLOBAL: { emoji: '🌍', name: 'Global', color: '#6B7280' },
};
