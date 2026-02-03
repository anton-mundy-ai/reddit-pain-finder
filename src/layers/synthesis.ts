// Layer 4: PRODUCT SYNTHESIS v6.1
// Only synthesizes clusters with 5+ members
// Uses topic + persona info for better products

import { Env, PainCluster, Quote } from '../types';
import { callGPT52 } from '../utils/openai';
import { getClustersNeedingSynthesis, getClusterMembers } from './clustering';

const BATCH_SIZE = 10;

// v6.1: Enhanced prompt with persona and severity context
const PRODUCT_PROMPT = `You are a product designer. Create a product concept from these real user pain points.

TOPIC: {TOPIC}

QUOTES FROM REAL USERS ({COUNT} total mentions):
{QUOTES}

AFFECTED PERSONAS: {PERSONAS}
SEVERITY BREAKDOWN: {SEVERITY}
SOURCE COMMUNITIES: {SUBREDDITS}

{VERSION_CONTEXT}

Generate a product concept that solves this specific problem.

Respond in JSON:
{
  "product_name": "2-3 words MAX, memorable startup name",
  "tagline": "10 words MAX, what it does",
  "how_it_works": ["Feature 1", "Feature 2", "Feature 3"],
  "target_customer": "Specific persona based on the affected personas above"
}`;

const VERSION_CONTEXT_NEW = `This is a NEW product concept. Create something compelling for these users.`;

const VERSION_CONTEXT_EVOLVE = `PREVIOUS VERSION (v{VERSION}):
Name: {PREV_NAME}
Tagline: {PREV_TAGLINE}

The cluster has grown with more evidence. REFINE the product if needed.`;

interface ProductResult {
  product_name: string;
  tagline: string;
  how_it_works: string[];
  target_customer: string;
}

async function generateProduct(
  apiKey: string, 
  topic: string,
  quotes: Quote[],
  personas: string[],
  severityBreakdown: Record<string, number>,
  subreddits: string[],
  previousProduct: { name: string; tagline: string; version: number } | null
): Promise<ProductResult | null> {
  const quotesText = quotes
    .slice(0, 25)
    .map((q, i) => {
      let line = `${i + 1}. "${q.text}"`;
      if (q.persona) line += ` [${q.persona}]`;
      if (q.severity) line += ` (${q.severity})`;
      return line;
    })
    .join('\n\n');
  
  const severityText = Object.entries(severityBreakdown)
    .map(([sev, count]) => `${sev}: ${count}`)
    .join(', ');
  
  let versionContext: string;
  if (previousProduct && previousProduct.version > 0) {
    versionContext = VERSION_CONTEXT_EVOLVE
      .replace('{VERSION}', previousProduct.version.toString())
      .replace('{PREV_NAME}', previousProduct.name)
      .replace('{PREV_TAGLINE}', previousProduct.tagline);
  } else {
    versionContext = VERSION_CONTEXT_NEW;
  }
  
  const prompt = PRODUCT_PROMPT
    .replace('{TOPIC}', topic.replace(/_/g, ' '))
    .replace('{COUNT}', quotes.length.toString())
    .replace('{QUOTES}', quotesText)
    .replace('{PERSONAS}', personas.join(', ') || 'various')
    .replace('{SEVERITY}', severityText || 'medium: ' + quotes.length)
    .replace('{SUBREDDITS}', subreddits.join(', '))
    .replace('{VERSION_CONTEXT}', versionContext);

  try {
    const { content } = await callGPT52(apiKey,
      [{ role: 'user', content: prompt }],
      { max_completion_tokens: 400, json_mode: true }
    );
    return JSON.parse(content) as ProductResult;
  } catch (error) {
    console.error('Product generation error:', error);
    return null;
  }
}

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

export async function runSynthesis(env: Env): Promise<{ 
  synthesized: number;
  new_products: number;
  evolved_products: number;
  skipped: number;
}> {
  const db = env.DB;
  let synthesized = 0;
  let newProducts = 0;
  let evolvedProducts = 0;
  let skipped = 0;
  
  // v6.1: Only clusters with 5+ members
  const clusters = await getClustersNeedingSynthesis(db, BATCH_SIZE);
  
  console.log(`Synthesizing ${clusters.length} clusters (5+ members)...`);
  
  for (const cluster of clusters) {
    if (!cluster.id) continue;
    
    const members = await getClusterMembers(db, cluster.id);
    
    // v6.1: Require 5+ members
    if (members.length < 5) {
      console.log(`  Skipping cluster #${cluster.id}: only ${members.length} members (need 5+)`);
      skipped++;
      continue;
    }
    
    const isEvolving = cluster.synthesized_at !== null && cluster.version > 0;
    const action = isEvolving ? 'Evolving' : 'Creating';
    console.log(`  ${action} cluster #${cluster.id} (${cluster.topic}): ${members.length} quotes, v${cluster.version}...`);
    
    // Build quotes array with persona/severity
    const quotes: Quote[] = members.map(m => ({
      text: (m.raw_quote || '').slice(0, 400),
      author: m.author || 'anonymous',
      subreddit: m.subreddit,
      persona: m.persona || undefined,
      severity: m.severity || undefined
    }));
    
    const subreddits = [...new Set(members.map(m => m.subreddit))];
    const personas = [...new Set(members.map(m => m.persona).filter((p): p is string => !!p))];
    
    // Severity breakdown
    const severityBreakdown: Record<string, number> = {};
    for (const m of members) {
      const sev = m.severity || 'medium';
      severityBreakdown[sev] = (severityBreakdown[sev] || 0) + 1;
    }
    
    const previousProduct = isEvolving ? {
      name: cluster.product_name || '',
      tagline: cluster.tagline || '',
      version: cluster.version || 0
    } : null;
    
    const product = await generateProduct(
      env.OPENAI_API_KEY,
      cluster.topic || 'unknown_topic',
      quotes,
      personas,
      severityBreakdown,
      subreddits,
      previousProduct
    );
    
    if (product) {
      await updateClusterProduct(
        db, 
        cluster.id, 
        product, 
        members.length,
        cluster.version || 0
      );
      
      console.log(`    ✓ ${product.product_name} v${(cluster.version || 0) + 1}: "${product.tagline}"`);
      
      synthesized++;
      if (isEvolving) {
        evolvedProducts++;
      } else {
        newProducts++;
      }
    }
  }
  
  console.log(`\n=== Synthesis Complete ===`);
  console.log(`Synthesized: ${synthesized}, New: ${newProducts}, Evolved: ${evolvedProducts}, Skipped: ${skipped}`);
  
  return { synthesized, new_products: newProducts, evolved_products: evolvedProducts, skipped };
}
