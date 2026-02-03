// Reddit Pain Point Finder v5 - Main Worker Entry Point
// v5: Social Proof + High Throughput + Product-Focused Output

import { Env, OpportunityBrief, Quote } from './types';
import { runIngestion } from './layers/ingestion';
import { runExtraction } from './layers/extraction';
import { runClustering, getClusterMembers } from './layers/clustering';
import { runSynthesis } from './layers/synthesis';
import { runScoring, getTopOpportunities } from './layers/scoring';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function safeParseJSON(str: string | null, defaultValue: any): any {
  if (!str) return defaultValue;
  try { return JSON.parse(str); } catch { return defaultValue; }
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (path === '/health' || path === '/') {
    return jsonResponse({ 
      status: 'ok', 
      version: 'v5-social-proof',
      timestamp: Date.now() 
    });
  }

  // v5: Get opportunities list (product-focused)
  if (path === '/api/opportunities') {
    const limit = parseInt(url.searchParams.get('limit') || '20');

    try {
      const clusters = await getTopOpportunities(env.DB, limit);
      
      const opportunities: OpportunityBrief[] = clusters.map((c: any) => ({
        id: c.id,
        product_name: c.product_name || 'Unnamed',
        tagline: c.tagline || '',
        how_it_works: safeParseJSON(c.how_it_works, []),
        target_customer: c.target_customer || '',
        version: c.version || 1,
        social_proof_count: c.social_proof_count || 0,
        subreddits: safeParseJSON(c.subreddits_list, []),
        top_quotes: safeParseJSON(c.top_quotes, []).slice(0, 3),
        total_quotes: c.social_proof_count || 0,
        total_score: c.total_score || 0,
        updated_at: c.updated_at
      }));
      
      return jsonResponse({ opportunities });
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      return jsonResponse({ error: 'Failed to fetch opportunities' }, 500);
    }
  }

  // v5: Get single opportunity detail with ALL quotes
  if (path.startsWith('/api/opportunities/')) {
    const id = parseInt(path.split('/').pop() || '0');
    if (!id) return jsonResponse({ error: 'Invalid ID' }, 400);

    try {
      const cluster = await env.DB.prepare(`
        SELECT * FROM pain_clusters WHERE id = ?
      `).bind(id).first();

      if (!cluster) return jsonResponse({ error: 'Not found' }, 404);

      const members = await getClusterMembers(env.DB, id);
      
      // Build ALL quotes
      const allQuotes: Quote[] = members.map(m => ({
        text: m.raw_quote || '',
        author: m.author || 'anonymous',
        subreddit: m.subreddit
      }));
      
      const subreddits = [...new Set(members.map(m => m.subreddit))];
      
      const detail = {
        id: (cluster as any).id,
        product_name: (cluster as any).product_name || 'Unnamed',
        tagline: (cluster as any).tagline || '',
        how_it_works: safeParseJSON((cluster as any).how_it_works, []),
        target_customer: (cluster as any).target_customer || '',
        version: (cluster as any).version || 1,
        social_proof_count: (cluster as any).social_proof_count || 0,
        subreddits,
        top_quotes: allQuotes.slice(0, 5),
        all_quotes: allQuotes,
        total_quotes: allQuotes.length,
        unique_authors: (cluster as any).unique_authors || 0,
        total_upvotes: (cluster as any).total_upvotes || 0,
        total_score: (cluster as any).total_score || 0,
        updated_at: (cluster as any).updated_at
      };

      return jsonResponse({ opportunity: detail });
    } catch (error) {
      console.error('Error fetching opportunity:', error);
      return jsonResponse({ error: 'Failed to fetch opportunity' }, 500);
    }
  }

  // Stats endpoint
  if (path === '/api/stats') {
    try {
      const [postsCount, commentsCount, painRecordsCount, clustersCount, productCount] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) as count FROM raw_posts").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM raw_comments").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM pain_records").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM pain_clusters").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM pain_clusters WHERE product_name IS NOT NULL").first(),
      ]);

      // Get total social proof
      const totalProof = await env.DB.prepare(
        "SELECT SUM(social_proof_count) as total FROM pain_clusters"
      ).first();

      return jsonResponse({
        raw_posts: (postsCount as any)?.count || 0,
        raw_comments: (commentsCount as any)?.count || 0,
        pain_records: (painRecordsCount as any)?.count || 0,
        clusters: (clustersCount as any)?.count || 0,
        products_generated: (productCount as any)?.count || 0,
        total_social_proof: (totalProof as any)?.total || 0,
        version: 'v5-social-proof',
        last_updated: Date.now()
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      return jsonResponse({ error: 'Failed to fetch stats' }, 500);
    }
  }

  // Manual trigger endpoints
  if (path === '/api/trigger/ingest' && request.method === 'POST') {
    const result = await runIngestion(env);
    return jsonResponse({ success: true, result });
  }
  if (path === '/api/trigger/extract' && request.method === 'POST') {
    const result = await runExtraction(env);
    return jsonResponse({ success: true, result });
  }
  if (path === '/api/trigger/cluster' && request.method === 'POST') {
    const result = await runClustering(env);
    return jsonResponse({ success: true, result });
  }
  if (path === '/api/trigger/synthesize' && request.method === 'POST') {
    const result = await runSynthesis(env);
    return jsonResponse({ success: true, result });
  }
  if (path === '/api/trigger/score' && request.method === 'POST') {
    const result = await runScoring(env);
    return jsonResponse({ success: true, result });
  }
  if (path === '/api/trigger/full' && request.method === 'POST') {
    const results = await runFullPipeline(env);
    return jsonResponse({ success: true, results });
  }
  
  // Reset endpoint
  if (path === '/api/trigger/reset' && request.method === 'POST') {
    try {
      await env.DB.exec(`
        DELETE FROM cluster_members;
        DELETE FROM pain_clusters;
        DELETE FROM pain_records;
        DELETE FROM raw_comments;
        DELETE FROM raw_posts;
        UPDATE processing_state SET value = '0' WHERE key = 'subreddits_index';
      `);
      return jsonResponse({ success: true, message: 'Data cleared' });
    } catch (error) {
      console.error('Reset error:', error);
      return jsonResponse({ error: 'Failed to reset' }, 500);
    }
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

async function runFullPipeline(env: Env): Promise<any> {
  const results: any = { version: 'v5' };
  
  console.log('\n========================================');
  console.log('Running v5 Pipeline: Social Proof + High Throughput');
  console.log('========================================\n');
  
  console.log('Step 1: High-throughput ingestion...');
  results.ingestion = await runIngestion(env);
  
  console.log('\nStep 2: Fast nano extraction...');
  results.extraction = await runExtraction(env);
  
  console.log('\nStep 3: Clustering with social proof tracking...');
  results.clustering = await runClustering(env);
  
  console.log('\nStep 4: Product synthesis (10% growth threshold)...');
  results.synthesis = await runSynthesis(env);
  
  console.log('\nStep 5: Scoring...');
  results.scoring = await runScoring(env);
  
  console.log('\n========================================');
  console.log('Pipeline Complete!');
  console.log('========================================\n');
  
  return results;
}

async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  console.log('Cron triggered:', new Date().toISOString());
  try {
    const results = await runFullPipeline(env);
    console.log('Pipeline completed:', JSON.stringify(results));
  } catch (error) {
    console.error('Pipeline error:', error);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env));
  }
};
