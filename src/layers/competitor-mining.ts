// Layer: Competitor Complaint Mining v9.2
// DEEP NICHE FOCUS: Search specific subreddits where users hang out
// Find people complaining about existing products = validated pain + proven willingness to pay

import { Env } from '../types';

// Target products WITH their specific subreddit communities
const NICHE_VERTICALS: Record<string, { products: string[], subreddits: string[] }> = {
  // Agriculture & Farming
  farming: {
    products: ['John Deere', 'Granular', 'FarmLogs', 'Bushel', 'AgriWebb', 'Figured', 'Conservis', 'Agworld', 'Trimble Ag'],
    subreddits: ['farming', 'agriculture', 'homestead', 'tractors', 'ranching', 'agribusiness', 'farmers']
  },
  
  // Trades & Field Service (AU focus)
  trades: {
    products: ['ServiceM8', 'Tradify', 'Fergus', 'simPRO', 'ServiceTitan', 'Jobber', 'Housecall Pro', 'FieldEdge', 'Kickserv'],
    subreddits: ['HVAC', 'electricians', 'Plumbing', 'bluecollar', 'Construction', 'Carpentry', 'Contractors', 'tradies']
  },
  
  // Healthcare & Allied Health
  healthcare: {
    products: ['Cliniko', 'Jane App', 'Halaxy', 'Nookal', 'Practice Better', 'Power Diary', 'SimplePractice', 'TherapyNotes', 'IntakeQ'],
    subreddits: ['physicaltherapy', 'chiropractic', 'massage', 'dietetics', 'Osteopathy', 'occupationaltherapy', 'speechtherapy', 'psychotherapy']
  },
  
  // Fitness & Wellness
  fitness: {
    products: ['Mindbody', 'Glofox', 'Wodify', 'PushPress', 'Zen Planner', 'Gymdesk', 'Exercise.com', 'Virtuagym', 'ClubReady'],
    subreddits: ['gymowner', 'crossfit', 'yoga', 'personaltraining', 'pilates', 'fitness', 'weightroom', 'yogateachers']
  },
  
  // Beauty & Salons
  beauty: {
    products: ['Vagaro', 'Fresha', 'Booksy', 'Boulevard', 'GlossGenius', 'Schedulicity', 'Rosy', 'Meevo', 'SalonBiz'],
    subreddits: ['hairstylist', 'Estheticians', 'Nails', 'salons', 'Barber', 'HairDye', 'cosmetology', 'MakeupAddiction']
  },
  
  // Hospitality & Restaurants
  hospitality: {
    products: ['Toast', 'TouchBistro', '7shifts', 'Lightspeed Restaurant', 'MarketMan', 'Restaurant365', 'Upserve', 'Revel', 'Square for Restaurants'],
    subreddits: ['restaurateur', 'bartenders', 'KitchenConfidential', 'Serverlife', 'TalesFromYourServer', 'Chefit', 'restaurantowners']
  },
  
  // Real Estate & Property Management
  realestate: {
    products: ['PropertyMe', 'Buildium', 'AppFolio', 'Rent Manager', 'Yardi', 'Propertyware', 'TenantCloud', 'Rentec Direct', 'Console Cloud'],
    subreddits: ['realtors', 'propertymanagement', 'landlords', 'CommercialRealEstate', 'realestateinvesting', 'RealEstate', 'PropertyManagement']
  },
  
  // Legal
  legal: {
    products: ['Clio', 'PracticePanther', 'LEAP', 'MyCase', 'Smokeball', 'Actionstep', 'CosmoLex', 'Rocket Matter', 'LawMaster'],
    subreddits: ['lawyers', 'LawFirm', 'paralegal', 'law', 'LegalAdviceUK', 'auslaw', 'lawschool']
  },
  
  // Accounting & Bookkeeping
  accounting: {
    products: ['MYOB', 'Xero', 'QuickBooks', 'FreshBooks', 'Karbon', 'Canopy', 'Jetpack Workflow', 'TaxDome', 'Reckon', 'Saasu'],
    subreddits: ['Accounting', 'Bookkeeping', 'taxpros', 'CPA', 'tax', 'AccountingDepartment', 'AusFinance']
  },
  
  // Nonprofits & Churches
  nonprofit: {
    products: ['Planning Center', 'Pushpay', 'Bloomerang', 'Little Green Light', 'Tithe.ly', 'Breeze', 'ChurchTrac', 'Realm', 'Network for Good'],
    subreddits: ['nonprofit', 'church', 'pastors', 'Christianity', 'religion', 'volunteering', 'CharitableDonations']
  },
  
  // Education & Tutoring
  education: {
    products: ['TutorBird', 'My Music Staff', 'Teachworks', 'TakeLessons', 'Fons', 'Duet Partner', 'Lessonspace', 'Teachable', 'Thinkific'],
    subreddits: ['Teachers', 'tutors', 'musicteachers', 'OnlineLearning', 'teaching', 'education', 'piano', 'guitarlessons']
  },
  
  // Pet Industry
  pet: {
    products: ['Gingr', 'Time To Pet', 'PetDesk', 'eVetPractice', 'Pet Sitter Plus', 'DaySmart Pet', 'Pawfinity', 'ProPet Software', 'PetExec'],
    subreddits: ['doggrooming', 'petsitting', 'DogTraining', 'veterinary', 'VetTech', 'dogs', 'cats', 'petcare']
  },
  
  // Photography & Events
  photography: {
    products: ['HoneyBook', 'Dubsado', '17hats', 'Studio Ninja', 'ShootProof', 'Táve', 'Pixieset', 'Sprout Studio', 'Iris Works'],
    subreddits: ['photography', 'WeddingPhotography', 'weddingplanning', 'photobusiness', 'videography', 'WeddingVideography', 'Portraits']
  },
  
  // Cleaning Services
  cleaning: {
    products: ['Jobber', 'ZenMaid', 'Swept', 'CleanGuru', 'Launch27', 'Maidily', 'BookingKoala', 'CleanCloud'],
    subreddits: ['CleaningTips', 'CommercialCleaning', 'MaidService', 'EntrepreneurRideAlong', 'sweatystartup', 'cleaning']
  },
  
  // Moving & Logistics
  moving: {
    products: ['MoveitPro', 'Supermove', 'MoverBase', 'SmartMoving', 'Vonigo', 'Elromco', 'MoveHQ'],
    subreddits: ['moving', 'logistics', 'Truckers', 'FreightBrokers', 'supplychain', 'movers']
  },
  
  // Construction & Contractors
  construction: {
    products: ['Procore', 'Buildertrend', 'CoConstruct', 'PlanGrid', 'Fieldwire', 'BuilderPrime', 'Houzz Pro', 'JobNimbus'],
    subreddits: ['Construction', 'Contractors', 'HomeImprovement', 'Carpentry', 'Roofing', 'Concrete', 'HomeBuilding']
  },
  
  // Automotive & Mechanics
  automotive: {
    products: ['Shop-Ware', 'Mitchell 1', 'Tekmetric', 'AutoLeap', 'Shopmonkey', 'AutoVitals', 'R.O. Writer', 'NAPA TRACS'],
    subreddits: ['MechanicAdvice', 'AutoMechanics', 'Cartalk', 'Justrolledintotheshop', 'AutoDetailing', 'mechanics']
  },
  
  // Dental
  dental: {
    products: ['Dentrix', 'Open Dental', 'Eaglesoft', 'Curve Dental', 'Dentally', 'tab32', 'Planet DDS'],
    subreddits: ['Dentistry', 'DentalHygiene', 'DentalSchool', 'orthodontics']
  },
  
  // Schools & EdTech
  schools: {
    products: ['Compass', 'SEQTA', 'Canvas', 'Schoology', 'PowerSchool', 'Blackboard', 'Infinite Campus', 'Skyward'],
    subreddits: ['Teachers', 'education', 'edtech', 'k12sysadmin', 'HigherEducation', 'teaching']
  }
};

// Complaint search patterns - these work!
const COMPLAINT_PATTERNS = [
  '{product} sucks',
  '{product} alternative',
  'hate {product}',
  'frustrated with {product}',
  'switching from {product}',
  'leaving {product}',
  '{product} replacement',
  '{product} problems',
  '{product} is terrible',
  '{product} so slow',
  '{product} support sucks',
  'cancel {product}',
  'quit {product}',
  '{product} pricing',
  '{product} too expensive'
];

// Rate limiting
const RATE_LIMIT_MS = 400;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search a specific subreddit for complaints about a product
 */
async function searchSubredditForProduct(subreddit: string, product: string, limit: number = 25): Promise<any[]> {
  const results: any[] = [];
  
  // Search the subreddit for the product name
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(product)}&restrict_sr=on&sort=relevance&limit=${limit}&t=all`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainPointFinder/9.2)' }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    
    for (const child of data.data?.children || []) {
      const post = child.data;
      if (post.over_18 || post.removed_by_category) continue;
      
      const text = `${post.title} ${post.selftext || ''}`.toLowerCase();
      if (!text.includes(product.toLowerCase())) continue;
      
      // Check for complaint signals
      const hasComplaintSignal = COMPLAINT_PATTERNS.some(pattern => {
        const searchTerm = pattern.replace('{product}', product).toLowerCase();
        return text.includes(searchTerm.replace('{product}', '').trim());
      }) || text.includes('frustrat') || text.includes('hate') || text.includes('terrible') || 
         text.includes('awful') || text.includes('sucks') || text.includes('annoying') ||
         text.includes('expensive') || text.includes('slow') || text.includes('bug') ||
         text.includes('alternative') || text.includes('switch') || text.includes('replace');
      
      if (!hasComplaintSignal && post.score < 5) continue; // Skip low-engagement non-complaints
      
      results.push({
        type: 'reddit_post',
        id: post.id,
        text: post.title + (post.selftext ? `\n\n${post.selftext.slice(0, 1500)}` : ''),
        author: post.author,
        subreddit: post.subreddit,
        score: post.score,
        url: `https://reddit.com${post.permalink}`,
        created_utc: post.created_utc
      });
    }
  } catch (error) {
    // Silently fail - some subreddits may not exist
  }
  
  return results;
}

/**
 * Search Reddit-wide for complaints about a product
 */
async function searchRedditWideComplaints(product: string, limit: number = 30): Promise<any[]> {
  const results: any[] = [];
  
  // Use multiple complaint patterns
  const patterns = COMPLAINT_PATTERNS.slice(0, 4);
  
  for (const pattern of patterns) {
    const query = pattern.replace('{product}', product);
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=${Math.ceil(limit / patterns.length)}&t=year`;
    
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainPointFinder/9.2)' }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json() as any;
      
      for (const child of data.data?.children || []) {
        const post = child.data;
        if (post.over_18 || post.removed_by_category) continue;
        
        const text = `${post.title} ${post.selftext || ''}`.toLowerCase();
        if (!text.includes(product.toLowerCase())) continue;
        
        results.push({
          type: 'reddit_post',
          id: post.id,
          text: post.title + (post.selftext ? `\n\n${post.selftext.slice(0, 1500)}` : ''),
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
 * Search HackerNews for complaints
 */
async function searchHNComplaints(product: string, limit: number = 20): Promise<any[]> {
  const results: any[] = [];
  
  const queries = [`${product} problems`, `${product} alternative`, `frustrated ${product}`];
  
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
      // Silently fail
    }
  }
  
  return results;
}

/**
 * Detect sentiment from complaint text
 */
function detectSentiment(text: string): 'negative' | 'frustrated' | 'neutral' {
  const lowerText = text.toLowerCase();
  
  const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'garbage', 'trash', 'useless', 'broken', 'sucks', 'horrible'];
  const frustratedWords = ['frustrated', 'annoyed', 'confused', 'difficult', 'complicated', 'slow', 'buggy', 'expensive', 'overpriced', 'clunky'];
  
  const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
  const frustratedCount = frustratedWords.filter(w => lowerText.includes(w)).length;
  
  if (negativeCount >= 2) return 'negative';
  if (frustratedCount >= 2 || negativeCount >= 1) return 'frustrated';
  return 'neutral';
}

/**
 * Extract feature gaps from complaint text
 */
function extractFeatureGap(text: string): string | null {
  const patterns = [
    /i wish (?:it|they|there was|there were) (?:had|would|could|a|an)? ?([^.!?\n]{10,150})/i,
    /(?:it|they) (?:doesn't|don't|can't|cannot|won't) ([^.!?\n]{10,150})/i,
    /missing ([^.!?\n]{5,100})/i,
    /no (?:way to|option to|feature for|ability to) ([^.!?\n]{10,150})/i,
    /why (?:can't|isn't|doesn't|won't) (?:it|there|they) ([^.!?\n]{10,150})/i,
    /need(?:s)? (?:a |an )?([^.!?\n]{10,150}) (?:but|and|that)/i,
    /should (?:be able to |have |support )([^.!?\n]{10,150})/i,
    /(?:lacks?|lacking) ([^.!?\n]{10,100})/i,
    /would (?:love|like|want|need) (?:it to |if it |to )([^.!?\n]{10,150})/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const gap = match[1].trim();
      // Filter out noise
      if (gap.length < 10 || gap.length > 200) continue;
      if (/^\d+$/.test(gap)) continue; // Skip pure numbers
      return gap.slice(0, 200);
    }
  }
  
  return null;
}

/**
 * Store a competitor mention
 */
async function storeCompetitorMention(
  db: D1Database,
  product: string,
  category: string,
  complaint: any,
  sentiment: string,
  featureGap: string | null
): Promise<boolean> {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO competitor_mentions 
      (product_name, category, complaint_text, source_type, source_url, author, score, sentiment, feature_gap, subreddit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      product,
      category,
      complaint.text.slice(0, 2000),
      complaint.type,
      complaint.url,
      complaint.author,
      complaint.score,
      sentiment,
      featureGap,
      complaint.subreddit || null,
      Math.floor(Date.now() / 1000)
    ).run();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the next verticals to mine (rotates through list)
 */
async function getNextVerticalsToMine(db: D1Database, count: number = 3): Promise<string[]> {
  const allVerticals = Object.keys(NICHE_VERTICALS);
  
  const state = await db.prepare(
    "SELECT value FROM processing_state WHERE key = 'vertical_index'"
  ).first() as { value: string } | null;
  
  let index = parseInt(state?.value || '0');
  
  const verticals: string[] = [];
  for (let i = 0; i < count; i++) {
    verticals.push(allVerticals[index % allVerticals.length]);
    index++;
  }
  
  await db.prepare(
    "INSERT OR REPLACE INTO processing_state (key, value, updated_at) VALUES ('vertical_index', ?, ?)"
  ).bind(index.toString(), Math.floor(Date.now() / 1000)).run();
  
  return verticals;
}

/**
 * Main competitor mining function - DEEP NICHE SEARCH
 */
export async function runCompetitorMining(env: Env): Promise<{
  verticals_mined: string[];
  products_mined: number;
  complaints_found: number;
  feature_gaps_extracted: number;
  subreddits_searched: number;
}> {
  const db = env.DB;
  
  console.log('\n=== Deep Niche Competitor Mining v9.2 ===\n');
  
  // Get next 3 verticals to mine
  const verticalsToMine = await getNextVerticalsToMine(db, 3);
  console.log(`Mining verticals: ${verticalsToMine.join(', ')}`);
  
  let totalComplaints = 0;
  let totalFeatureGaps = 0;
  let totalProducts = 0;
  let totalSubreddits = 0;
  
  for (const vertical of verticalsToMine) {
    const config = NICHE_VERTICALS[vertical];
    if (!config) continue;
    
    console.log(`\n--- ${vertical.toUpperCase()} ---`);
    console.log(`Products: ${config.products.join(', ')}`);
    console.log(`Subreddits: ${config.subreddits.join(', ')}`);
    
    for (const product of config.products) {
      console.log(`\n  Searching for "${product}" complaints...`);
      totalProducts++;
      
      const allResults: any[] = [];
      
      // Search each relevant subreddit
      for (const subreddit of config.subreddits) {
        const results = await searchSubredditForProduct(subreddit, product, 15);
        allResults.push(...results);
        totalSubreddits++;
        await sleep(RATE_LIMIT_MS);
      }
      
      // Also do a wide Reddit search
      const wideResults = await searchRedditWideComplaints(product, 20);
      allResults.push(...wideResults);
      
      // And HN
      const hnResults = await searchHNComplaints(product, 15);
      allResults.push(...hnResults);
      
      // Deduplicate by URL
      const seen = new Set<string>();
      const uniqueResults = allResults.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });
      
      console.log(`    Found ${uniqueResults.length} unique complaints`);
      
      for (const complaint of uniqueResults) {
        const sentiment = detectSentiment(complaint.text);
        const featureGap = extractFeatureGap(complaint.text);
        
        if (await storeCompetitorMention(db, product, vertical, complaint, sentiment, featureGap)) {
          totalComplaints++;
          if (featureGap) {
            totalFeatureGaps++;
            console.log(`    💡 Gap: "${featureGap.slice(0, 60)}..."`);
          }
        }
      }
      
      await sleep(500); // Rate limit between products
    }
  }
  
  console.log(`\n=== Mining Complete ===`);
  console.log(`Verticals: ${verticalsToMine.length}, Products: ${totalProducts}, Complaints: ${totalComplaints}`);
  console.log(`Feature Gaps: ${totalFeatureGaps}, Subreddits Searched: ${totalSubreddits}`);
  
  return {
    verticals_mined: verticalsToMine,
    products_mined: totalProducts,
    complaints_found: totalComplaints,
    feature_gaps_extracted: totalFeatureGaps,
    subreddits_searched: totalSubreddits
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
      GROUP_CONCAT(DISTINCT author) as authors,
      GROUP_CONCAT(DISTINCT subreddit) as subreddits
    FROM competitor_mentions
    WHERE feature_gap IS NOT NULL AND LENGTH(feature_gap) > 15
    GROUP BY product_name, feature_gap
    ORDER BY mention_count DESC, LENGTH(feature_gap) DESC
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
      SUM(CASE WHEN feature_gap IS NOT NULL THEN 1 ELSE 0 END) as feature_gaps,
      COUNT(DISTINCT subreddit) as subreddits_found
    FROM competitor_mentions
    GROUP BY category
    ORDER BY total_complaints DESC
  `).all();
  
  return result.results || [];
}

// Export for reference
export { NICHE_VERTICALS };

// Get all products flattened
export const ALL_PRODUCTS = Object.values(NICHE_VERTICALS).flatMap(v => v.products);
