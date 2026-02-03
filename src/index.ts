// Reddit Pain Point Finder - Main Worker Entry Point

import { Env, OpportunityBrief, PainRecord } from './types';
import { runIngestion } from './layers/ingestion';
import { runClassification } from './layers/classification';
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
    return jsonResponse({ status: 'ok', timestamp: Date.now() });
  }

  // Get opportunities list
  if (path === '/api/opportunities') {
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const minScore = url.searchParams.get('minScore') ? parseFloat(url.searchParams.get('minScore')!) : undefined;
    const auOnly = url.searchParams.get('auOnly') === 'true';

    try {
      const opportunities = await getTopOpportunities(env.DB, limit, { minScore, auOnly });
      return jsonResponse({ opportunities });
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      return jsonResponse({ error: 'Failed to fetch opportunities' }, 500);
    }
  }

  // Get single opportunity detail
  if (path.startsWith('/api/opportunities/')) {
    const id = parseInt(path.split('/').pop() || '0');
    if (!id) return jsonResponse({ error: 'Invalid ID' }, 400);

    try {
      const cluster = await env.DB.prepare(`
        SELECT pc.*, cs.frequency_score, cs.severity_score, cs.economic_score, cs.solvability_score, cs.competitive_score, cs.au_fit_score, cs.total_score, cs.score_breakdown
        FROM pain_clusters pc LEFT JOIN cluster_scores cs ON cs.cluster_id = pc.id WHERE pc.id = ?
      `).bind(id).first();

      if (!cluster) return jsonResponse({ error: 'Not found' }, 404);

      const members = await getClusterMembers(env.DB, id);

      const brief: OpportunityBrief = {
        id: (cluster as any).id,
        summary: (cluster as any).brief_summary || (cluster as any).centroid_text,
        problem_statement: (cluster as any).centroid_text,
        total_score: (cluster as any).total_score || 0,
        member_count: (cluster as any).member_count || 0,
        unique_authors: (cluster as any).unique_authors || 0,
        subreddits: [...new Set(members.map(m => m.subreddit))],
        personas: safeParseJSON((cluster as any).brief_personas, []),
        workarounds: safeParseJSON((cluster as any).brief_workarounds, []),
        top_quotes: safeParseJSON((cluster as any).brief_quotes, []),
        score_breakdown: {
          frequency: (cluster as any).frequency_score || 0,
          severity: (cluster as any).severity_score || 0,
          economic: (cluster as any).economic_score || 0,
          solvability: (cluster as any).solvability_score || 0,
          competitive: (cluster as any).competitive_score || 0,
          au_fit: (cluster as any).au_fit_score || 0,
        },
        open_questions: safeParseJSON((cluster as any).brief_open_questions, []),
        updated_at: (cluster as any).updated_at
      };

      return jsonResponse({ opportunity: brief, members: members.slice(0, 50) });
    } catch (error) {
      console.error('Error fetching opportunity:', error);
      return jsonResponse({ error: 'Failed to fetch opportunity' }, 500);
    }
  }

  // Stats endpoint
  if (path === '/api/stats') {
    try {
      const [postsCount, commentsCount, classificationsCount, painRecordsCount, clustersCount, scoredCount] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) as count FROM raw_posts").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM raw_comments").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM classifications WHERE is_pain_point = 1").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM pain_records").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM pain_clusters").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM cluster_scores").first(),
      ]);

      return jsonResponse({
        raw_posts: (postsCount as any)?.count || 0,
        raw_comments: (commentsCount as any)?.count || 0,
        pain_points_classified: (classificationsCount as any)?.count || 0,
        pain_records: (painRecordsCount as any)?.count || 0,
        clusters: (clustersCount as any)?.count || 0,
        scored_clusters: (scoredCount as any)?.count || 0,
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
  if (path === '/api/trigger/classify' && request.method === 'POST') {
    const result = await runClassification(env);
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

  return jsonResponse({ error: 'Not found' }, 404);
}

async function runFullPipeline(env: Env): Promise<any> {
  const results: any = {};
  console.log('Running ingestion...');
  results.ingestion = await runIngestion(env);
  console.log('Running classification...');
  results.classification = await runClassification(env);
  console.log('Running extraction...');
  results.extraction = await runExtraction(env);
  console.log('Running clustering...');
  results.clustering = await runClustering(env);
  console.log('Running synthesis...');
  results.synthesis = await runSynthesis(env);
  console.log('Running scoring...');
  results.scoring = await runScoring(env);
  return results;
}

async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  console.log('Cron triggered:', new Date().toISOString());
  try {
    const results = await runFullPipeline(env);
    console.log('Pipeline completed:', results);
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
