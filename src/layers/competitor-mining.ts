// Layer: Competitor Complaint Mining v9
// Find people complaining about existing products = validated pain + proven willingness to pay

import { Env } from '../types';

// Target products to mine complaints for
// NICHE FOCUS: Smaller verticals = less competition = better opportunities!
const TARGET_PRODUCTS = {
  // === MAINSTREAM (keep a few for comparison) ===
  productivity: ['Notion', 'Slack', 'Asana', 'Trello', 'Monday', 'ClickUp'],
  finance: ['QuickBooks', 'Xero', 'FreshBooks', 'Wave'],
  crm: ['Salesforce', 'HubSpot', 'Pipedrive'],
  
  // === NICHE VERTICALS (the goldmine!) ===
  
  // Agriculture & Farming
  farming: ['John Deere', 'Granular', 'FarmLogs', 'Bushel', 'AgriWebb', 'Conservis'],
  
  // Australian Real Estate
  realestate_au: ['Domain', 'REA', 'PropertyMe', 'Console Cloud', 'PropertyTree', 'Rockend'],
  
  // Trades & Field Services
  trades: ['ServiceM8', 'Tradify', 'Fergus', 'simPRO', 'Jobber', 'Housecall Pro'],
  
  // Australian Legal
  legal_au: ['LEAP', 'Actionstep', 'Smokeball', 'LawMaster', 'SILQ'],
  
  // Australian Medical/Health
  medical_au: ['Cliniko', 'Halaxy', 'Nookal', 'Power Diary', 'Timely', 'Jane App'],
  
  // Australian Accounting
  accounting_au: ['MYOB', 'Reckon', 'Saasu', 'Cashflow Manager'],
  
  // Retail & POS
  retail: ['Vend', 'Lightspeed', 'Square POS', 'Shopify POS', 'Clover'],
  
  // Restaurants & Hospitality
  restaurants: ['Toast POS', 'TouchBistro', 'Lightspeed Restaurant', 'Square for Restaurants', 'Revel'],
  
  // Fitness & Gyms
  gyms: ['Mindbody', 'Glofox', 'Wodify', 'Zen Planner', 'PushPress', 'Gymdesk'],
  
  // Churches & Nonprofits
  churches: ['Planning Center', 'Pushpay', 'Tithe.ly', 'Breeze', 'ChurchTrac', 'Realm'],
  
  // Schools & Education
  schools: ['Compass', 'SEQTA', 'Canvas', 'Schoology', 'PowerSchool', 'Blackboard'],
  
  // Construction
  construction: ['Procore', 'Buildertrend', 'CoConstruct', 'PlanGrid', 'Fieldwire', 'BuilderPrime'],
  
  // Photography & Creative Services
  photography: ['Honeybook', 'Dubsado', '17hats', 'Studio Ninja', 'Táve', 'Pixieset'],
  
  // Music & Lessons
  music_teachers: ['My Music Staff', 'TakeLessons', 'Fons', 'Music Teacher\'s Helper', 'Duet Partner'],
  
  // Pet Services
  pet_services: ['PetDesk', 'Gingr', 'Time To Pet', 'Pet Sitter Plus', 'ProPet Software', 'DaySmart Pet'],
  
  // Salon & Beauty
  salons: ['Vagaro', 'Fresha', 'Booksy', 'Boulevard', 'GlossGenius', 'Schedulicity'],
  
  // Auto & Mechanics
  automotive: ['Shop-Ware', 'Mitchell 1', 'Tekmetric', 'AutoLeap', 'Shopmonkey']
};

// All products flattened
const ALL_PRODUCTS = Object.values(TARGET_PRODUCTS).flat();

// Complaint search patterns
const COMPLAINT_PATTERNS = [
  '{product} sucks',
  '{product} alternative',
  'hate {product}',
  'frustrated with {product}',
  'switching from {product}',
  'why I left {product}',
  '{product} vs',
  'looking for {product} replacement',
  '{product} is so slow',
  '{product} pricing',
  'cancel {product}',
  'quit using {product}',
  '{product} problems'
];

// Rate limiting
const RATE_LIMIT_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search Reddit for complaints about a product
 */
async function searchRedditComplaints(product: string, limit: number = 50): Promise<any[]> {
  const results: any[] = [];
  
  // Try multiple complaint patterns
  const patterns = COMPLAINT_PATTERNS.slice(0, 5); // Use first 5 patterns
  
  for (const pattern of patterns) {
    const query = pattern.replace('{product}', product);
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=${Math.ceil(limit / patterns.length)}&t=year`;
    
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainPointFinder/9.0)' }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json() as any;
      
      for (const child of data.data?.children || []) {
        const post = child.data;
        if (post.over_18 || post.removed_by_category) continue;
        
        // Include both title and selftext for posts
        const text = `${post.title} ${post.selftext || ''}`.toLowerCase();
        
        // Verify it's actually about this product (case-insensitive)
        if (!text.includes(product.toLowerCase())) continue;
        
        results.push({
          type: 'reddit_post',
          id: post.id,
          text: post.title + (post.selftext ? `\n\n${post.selftext.slice(0, 1000)}` : ''),
          author: post.author,
          subreddit: post.subreddit,
          score: post.score,
          url: `https://reddit.com${post.permalink}`,
          created_utc: post.created_utc
        });
      }
      
      await sleep(RATE_LIMIT_MS);
    } catch (error) {
      console.error(`Error searching Reddit for "${query}":`, error);
    }
  }
  
  return results;
}

/**
 * Search HackerNews for complaints about a product
 */
async function searchHNComplaints(product: string, limit: number = 30): Promise<any[]> {
  const results: any[] = [];
  
  const queries = [
    `${product} problems`,
    `${product} alternative`,
    `frustrated ${product}`,
    `hate ${product}`
  ];
  
  for (const query of queries) {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=(story,comment)&hitsPerPage=${Math.ceil(limit / queries.length)}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      
      const data = await response.json() as any;
      
      for (const hit of data.hits || []) {
        const text = (hit.comment_text || hit.title || '').toLowerCase();
        if (!text.includes(product.toLowerCase())) continue;
        
        results.push({
          type: 'hn',
          id: hit.objectID,
          text: hit.comment_text || hit.title || '',
          author: hit.author || 'unknown',
          subreddit: null,
          score: hit.points || 0,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          created_utc: new Date(hit.created_at).getTime() / 1000
        });
      }
      
      await sleep(200);
    } catch (error) {
      console.error(`Error searching HN for "${query}":`, error);
    }
  }
  
  return results;
}

/**
 * Detect sentiment from complaint text
 */
function detectSentiment(text: string): 'negative' | 'frustrated' | 'neutral' {
  const lowerText = text.toLowerCase();
  
  const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'garbage', 'trash', 'useless', 'broken', 'sucks'];
  const frustratedWords = ['frustrated', 'annoyed', 'confused', 'difficult', 'complicated', 'slow', 'buggy', 'expensive'];
  
  const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
  const frustratedCount = frustratedWords.filter(w => lowerText.includes(w)).length;
  
  if (negativeCount >= 2) return 'negative';
  if (frustratedCount >= 2 || negativeCount >= 1) return 'frustrated';
  return 'neutral';
}

/**
 * Extract feature gaps from complaint text
 * Looks for phrases like "I wish it had", "It doesn't do", "missing feature"
 */
function extractFeatureGap(text: string): string | null {
  const patterns = [
    /i wish (?:it|they) (?:had|would|could) ([^.!?\n]{10,100})/i,
    /(?:it|they) (?:doesn't|don't|can't|cannot) ([^.!?\n]{10,100})/i,
    /missing ([^.!?\n]{5,50})/i,
    /no (?:way to|option to|feature for) ([^.!?\n]{10,100})/i,
    /why (?:can't|isn't|doesn't) (?:it|there) ([^.!?\n]{10,100})/i,
    /need(?:s)? ([^.!?\n]{10,100}) but/i,
    /should have ([^.!?\n]{10,100})/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().slice(0, 200);
    }
  }
  
  return null;
}

/**
 * Get category for a product
 */
function getProductCategory(product: string): string {
  for (const [category, products] of Object.entries(TARGET_PRODUCTS)) {
    if (products.includes(product)) return category;
  }
  return 'other';
}

/**
 * Store a competitor mention
 */
async function storeCompetitorMention(
  db: D1Database,
  product: string,
  complaint: any,
  sentiment: string,
  featureGap: string | null
): Promise<boolean> {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO competitor_mentions 
      (product_name, category, complaint_text, source_type, source_url, author, score, sentiment, feature_gap, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      product,
      getProductCategory(product),
      complaint.text.slice(0, 2000),
      complaint.type,
      complaint.url,
      complaint.author,
      complaint.score,
      sentiment,
      featureGap,
      Math.floor(Date.now() / 1000)
    ).run();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the next products to mine (rotates through list)
 * Increased to 8 per cycle for larger product list
 */
async function getNextProductsToMine(db: D1Database, count: number = 8): Promise<string[]> {
  // Get current index
  const state = await db.prepare(
    "SELECT value FROM processing_state WHERE key = 'competitor_index'"
  ).first() as { value: string } | null;
  
  let index = parseInt(state?.value || '0');
  
  // Get next N products
  const products: string[] = [];
  for (let i = 0; i < count; i++) {
    products.push(ALL_PRODUCTS[index % ALL_PRODUCTS.length]);
    index++;
  }
  
  // Update index
  await db.prepare(
    "INSERT OR REPLACE INTO processing_state (key, value, updated_at) VALUES ('competitor_index', ?, ?)"
  ).bind(index.toString(), Math.floor(Date.now() / 1000)).run();
  
  return products;
}

/**
 * Main competitor mining function
 */
export async function runCompetitorMining(env: Env): Promise<{
  products_mined: number;
  complaints_found: number;
  feature_gaps_extracted: number;
}> {
  const db = env.DB;
  
  console.log('\n=== Competitor Complaint Mining ===\n');
  
  // Get next 5 products to mine
  const productsToMine = await getNextProductsToMine(db, 5);
  console.log(`Mining complaints for: ${productsToMine.join(', ')}`);
  
  let totalComplaints = 0;
  let totalFeatureGaps = 0;
  
  for (const product of productsToMine) {
    console.log(`\nSearching for ${product} complaints...`);
    
    // Search Reddit and HN in parallel
    const [redditResults, hnResults] = await Promise.all([
      searchRedditComplaints(product, 30),
      searchHNComplaints(product, 20)
    ]);
    
    const allResults = [...redditResults, ...hnResults];
    console.log(`  Found ${allResults.length} potential complaints`);
    
    for (const complaint of allResults) {
      const sentiment = detectSentiment(complaint.text);
      const featureGap = extractFeatureGap(complaint.text);
      
      if (await storeCompetitorMention(db, product, complaint, sentiment, featureGap)) {
        totalComplaints++;
        if (featureGap) totalFeatureGaps++;
      }
    }
    
    await sleep(1000); // Rate limit between products
  }
  
  console.log(`\n=== Mining Complete ===`);
  console.log(`Products: ${productsToMine.length}, Complaints: ${totalComplaints}, Feature Gaps: ${totalFeatureGaps}`);
  
  return {
    products_mined: productsToMine.length,
    complaints_found: totalComplaints,
    feature_gaps_extracted: totalFeatureGaps
  };
}

/**
 * Get competitor stats for API
 */
export async function getCompetitorStats(db: D1Database): Promise<any[]> {
  const result = await db.prepare(`
    SELECT 
      product_name,
      category,
      COUNT(*) as complaint_count,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative_count,
      SUM(CASE WHEN sentiment = 'frustrated' THEN 1 ELSE 0 END) as frustrated_count,
      SUM(CASE WHEN feature_gap IS NOT NULL THEN 1 ELSE 0 END) as feature_gap_count,
      AVG(score) as avg_score
    FROM competitor_mentions
    GROUP BY product_name
    ORDER BY complaint_count DESC
  `).all();
  
  return result.results || [];
}

/**
 * Get complaints for a specific product
 */
export async function getProductComplaints(db: D1Database, product: string, limit: number = 50): Promise<any[]> {
  const result = await db.prepare(`
    SELECT *
    FROM competitor_mentions
    WHERE product_name = ?
    ORDER BY score DESC, created_at DESC
    LIMIT ?
  `).bind(product, limit).all();
  
  return result.results || [];
}

/**
 * Get aggregated feature gaps across all products
 */
export async function getFeatureGaps(db: D1Database, limit: number = 50): Promise<any[]> {
  const result = await db.prepare(`
    SELECT 
      product_name,
      category,
      feature_gap,
      COUNT(*) as mention_count,
      GROUP_CONCAT(DISTINCT author) as authors
    FROM competitor_mentions
    WHERE feature_gap IS NOT NULL
    GROUP BY product_name, feature_gap
    ORDER BY mention_count DESC
    LIMIT ?
  `).bind(limit).all();
  
  return result.results || [];
}

/**
 * Get category breakdown
 */
export async function getCategoryStats(db: D1Database): Promise<any[]> {
  const result = await db.prepare(`
    SELECT 
      category,
      COUNT(DISTINCT product_name) as products_tracked,
      COUNT(*) as total_complaints,
      SUM(CASE WHEN feature_gap IS NOT NULL THEN 1 ELSE 0 END) as feature_gaps
    FROM competitor_mentions
    GROUP BY category
    ORDER BY total_complaints DESC
  `).all();
  
  return result.results || [];
}

// Export product list for reference
export { TARGET_PRODUCTS, ALL_PRODUCTS };
