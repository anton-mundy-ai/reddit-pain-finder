// Layer 4: PRODUCT SYNTHESIS with GPT-5.2
// v5: Generate product concepts from clustered pain points
// Only runs when cluster grows by 10%+

import { Env, PainCluster, PainRecord, Quote } from '../types';
import { callGPT52 } from '../utils/openai';
import { getClustersNeedingSynthesis, getClusterMembers } from './clustering';

const BATCH_SIZE = 5;  // Expensive model, small batches

// v5: PRODUCT GENERATION PROMPT
const PRODUCT_PROMPT = `You are a product designer. Create a product concept from these real user quotes expressing the same problem.

QUOTES FROM REAL USERS ({COUNT} total mentions):
{QUOTES}

SUBREDDITS: {SUBREDDITS}

Generate a product concept that solves this problem.

Respond in JSON:
{
  "product_name": "2-3 words MAX, memorable startup name (e.g., ReviewShield, BookKeepBot, FarmTrack)",
  "tagline": "10 words MAX, what it does (e.g., 'Defend against review extortion')",
  "how_it_works": ["Feature 1", "Feature 2", "Feature 3"],
  "target_customer": "Specific persona (e.g., 'Small e-commerce sellers with 100-1000 monthly orders')"
}

Rules:
- product_name: Should sound like a real startup. 2-3 words max.
- tagline: What does it DO? Not what problem it solves. 10 words max.
- how_it_works: 3 specific, actionable features. Not generic.
- target_customer: Be specific about size, industry, situation.`;

interface ProductResult {
  product_name: string;
  tagline: string;
  how_it_works: string[];
  target_customer: string;
}

/**
 * Generate product concept from cluster quotes
 */
async function generateProduct(
  apiKey: string, 
  quotes: Quote[],
  totalCount: number,
  subreddits: string[]
): Promise<ProductResult | null> {
  // Format ALL quotes for the model
  const quotesText = quotes
    .map((q, i) => `${i + 1}. "${q.text}" — u/${q.author} (r/${q.subreddit})`)
    .join('\n\n');
  
  const prompt = PRODUCT_PROMPT
    .replace('{COUNT}', totalCount.toString())
    .replace('{QUOTES}', quotesText)
    .replace('{SUBREDDITS}', subreddits.join(', '));

  try {
    const { content } = await callGPT52(apiKey,
      [{ role: 'user', content: prompt }],
      { max_completion_tokens: 300, json_mode: true }
    );
    return JSON.parse(content) as ProductResult;
  } catch (error) {
    console.error('Product generation error:', error);
    return null;
  }
}

/**
 * Update cluster with product info
 */
async function updateClusterProduct(
  db: D1Database, 
  clusterId: number, 
  product: ProductResult,
  currentCount: number,
  currentVersion: number
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const newVersion = currentVersion + 1;
  
  await db.prepare(`
    UPDATE pain_clusters SET 
      product_name = ?,
      tagline = ?,
      how_it_works = ?,
      target_customer = ?,
      last_synth_count = ?,
      version = ?,
      synthesized_at = ?
    WHERE id = ?
  `).bind(
    product.product_name,
    product.tagline,
    JSON.stringify(product.how_it_works),
    product.target_customer,
    currentCount,
    newVersion,
    now,
    clusterId
  ).run();
}

export async function runSynthesis(env: Env): Promise<{ synthesized: number }> {
  const db = env.DB;
  let synthesized = 0;
  
  // Get clusters that need synthesis (10% growth or never synthesized)
  const clusters = await getClustersNeedingSynthesis(db, BATCH_SIZE);
  
  console.log(`Synthesizing ${clusters.length} clusters...`);
  
  for (const cluster of clusters) {
    if (!cluster.id) continue;
    
    const members = await getClusterMembers(db, cluster.id);
    if (members.length < 1) {
      console.log(`  Skipping cluster #${cluster.id}: only ${members.length} members`);
      continue;
    }
    
    console.log(`  Synthesizing cluster #${cluster.id} (${members.length} quotes, v${cluster.version})...`);
    
    // Build quotes array for ALL members
    const quotes: Quote[] = members.map(m => ({
      text: (m.raw_quote || '').slice(0, 400),
      author: m.author || 'anonymous',
      subreddit: m.subreddit
    }));
    
    // Get subreddits
    const subreddits = [...new Set(members.map(m => m.subreddit))];
    
    // Generate product with GPT-5.2
    const product = await generateProduct(
      env.OPENAI_API_KEY,
      quotes,
      members.length,
      subreddits
    );
    
    if (product) {
      await updateClusterProduct(
        db, 
        cluster.id, 
        product, 
        members.length,
        cluster.version || 0
      );
      console.log(`    ✓ ${product.product_name}: "${product.tagline}" (v${(cluster.version || 0) + 1})`);
      synthesized++;
    }
  }
  
  console.log(`\n=== Synthesis Complete ===`);
  console.log(`Synthesized: ${synthesized} product concepts`);
  
  return { synthesized };
}
