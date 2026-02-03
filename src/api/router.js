/**
 * API Router v3
 * - Opportunities (CRUD)
 * - Idea Validation
 * - Back-Validation
 * - Admin Controls
 * - Stats & Visualizations
 */

import { validateIdea, generateBackValidationQueries } from '../utils/llm.js';
import { runTargetedIngestion, ALL_SUBREDDITS } from '../layers/1-ingestion.js';
import { resynthesizeCluster } from '../layers/5-synthesis.js';
import { rescoreCluster } from '../layers/6-scoring.js';

export async function handleAPIRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const method = request.method;
  
  try {
    // Opportunities
    if (path === '/opportunities' && method === 'GET') {
      return getOpportunities(env, url.searchParams);
    }
    if (path.match(/^\/opportunities\/\d+$/) && method === 'GET') {
      const id = path.split('/')[2];
      return getOpportunityDetail(env, id);
    }
    if (path.match(/^\/opportunities\/\d+\/validate$/) && method === 'POST') {
      const id = path.split('/')[2];
      return backValidate(env, id);
    }
    
    // Idea Validation
    if (path === '/validate' && method === 'POST') {
      const body = await request.json();
      return validateIdeaEndpoint(env, body);
    }
    if (path === '/validations' && method === 'GET') {
      return getValidations(env, url.searchParams);
    }
    if (path.match(/^\/validations\/\d+$/) && method === 'GET') {
      const id = path.split('/')[2];
      return getValidationDetail(env, id);
    }
    
    // Stats & Visualizations
    if (path === '/stats' && method === 'GET') {
      return getStats(env);
    }
    if (path === '/stats/detailed' && method === 'GET') {
      return getDetailedStats(env);
    }
    if (path === '/charts/severity-frequency' && method === 'GET') {
      return getSeverityFrequencyChart(env);
    }
    if (path === '/charts/subreddit-breakdown' && method === 'GET') {
      return getSubredditBreakdown(env);
    }
    if (path === '/charts/score-distribution' && method === 'GET') {
      return getScoreDistribution(env);
    }
    
    // Admin
    if (path === '/admin/reset' && method === 'POST') {
      return adminReset(env);
    }
    if (path === '/admin/subreddits' && method === 'GET') {
      return jsonResponse({ subreddits: ALL_SUBREDDITS, count: ALL_SUBREDDITS.length });
    }
    if (path === '/admin/pipeline-status' && method === 'GET') {
      return getPipelineStatus(env);
    }
    
    // Health
    if (path === '/health') {
      return jsonResponse({ status: 'ok', version: 'v3', timestamp: Date.now() });
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('API error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============ OPPORTUNITIES ============

async function getOpportunities(env, params) {
  const limit = Math.min(parseInt(params.get('limit')) || 50, 100);
  const minScore = parseInt(params.get('minScore')) || 0;
  const auOnly = params.get('auOnly') === 'true';
  const sort = params.get('sort') || 'total_score';
  
  let query = `
    SELECT 
      id as cluster_id,
      product_name,
      centroid_text,
      member_count,
      brief_summary as summary,
      brief_personas as personas,
      brief_workarounds as workarounds,
      total_score,
      frequency_score,
      severity_score,
      economic_score,
      solvability_score,
      competitive_score,
      au_fit_score,
      validation_score,
      synthesized_at,
      scored_at
    FROM pain_clusters
    WHERE member_count > 0
  `;
  
  const bindings = [];
  
  if (minScore > 0) {
    query += ' AND total_score >= ?';
    bindings.push(minScore);
  }
  
  if (auOnly) {
    query += ' AND au_fit_score >= 50';
  }
  
  // Sort options
  const sortColumn = ['total_score', 'severity_score', 'au_fit_score', 'member_count'].includes(sort) 
    ? sort 
    : 'total_score';
  query += ` ORDER BY ${sortColumn} DESC NULLS LAST LIMIT ?`;
  bindings.push(limit);
  
  const result = await env.DB.prepare(query).bind(...bindings).all();
  
  // Parse JSON fields
  const opportunities = (result.results || []).map(opp => ({
    ...opp,
    personas: parseJSON(opp.personas),
    workarounds: parseJSON(opp.workarounds),
  }));
  
  return jsonResponse({ opportunities, count: opportunities.length });
}

async function getOpportunityDetail(env, clusterId) {
  const cluster = await env.DB.prepare(`
    SELECT * FROM pain_clusters WHERE id = ?
  `).bind(clusterId).first();
  
  if (!cluster) {
    return jsonResponse({ error: 'Opportunity not found' }, 404);
  }
  
  // Get pain records
  const records = await env.DB.prepare(`
    SELECT pr.*, cm.similarity_score
    FROM pain_records pr
    JOIN cluster_members cm ON cm.pain_record_id = pr.id
    WHERE cm.cluster_id = ?
    ORDER BY cm.similarity_score DESC
    LIMIT 20
  `).bind(clusterId).all();
  
  // Get unique subreddits
  const subreddits = [...new Set(records.results.map(r => r.subreddit))];
  
  return jsonResponse({
    cluster_id: cluster.id,
    product_name: cluster.product_name,
    centroid_text: cluster.centroid_text,
    member_count: cluster.member_count,
    summary: cluster.brief_summary,
    top_quotes: parseJSON(cluster.brief_quotes),
    personas: parseJSON(cluster.brief_personas),
    workarounds: parseJSON(cluster.brief_workarounds),
    subreddits,
    scores: {
      total: cluster.total_score,
      frequency: cluster.frequency_score,
      severity: cluster.severity_score,
      economic: cluster.economic_score,
      solvability: cluster.solvability_score,
      competition: cluster.competitive_score,
      au_fit: cluster.au_fit_score,
    },
    validation: {
      score: cluster.validation_score,
      confidence: cluster.validation_confidence,
      signals: parseJSON(cluster.validation_signals),
    },
    pain_records: records.results.slice(0, 10).map(r => ({
      id: r.id,
      subreddit: r.subreddit,
      problem: r.problem_text,
      persona: r.persona,
      url: r.source_url,
      author: r.source_author,
      score: r.source_score,
    })),
    synthesized_at: cluster.synthesized_at,
    scored_at: cluster.scored_at,
  });
}

// ============ BACK-VALIDATION ============

async function backValidate(env, clusterId) {
  const cluster = await env.DB.prepare(`
    SELECT * FROM pain_clusters WHERE id = ?
  `).bind(clusterId).first();
  
  if (!cluster) {
    return jsonResponse({ error: 'Cluster not found' }, 404);
  }
  
  // Generate search queries
  const queries = await generateBackValidationQueries(env, cluster);
  
  // Run targeted ingestion
  const ingestionResult = await runTargetedIngestion(
    env,
    queries.queries || [],
    queries.target_subreddits || []
  );
  
  // Re-synthesize and re-score
  await resynthesizeCluster(env, parseInt(clusterId));
  await rescoreCluster(env, parseInt(clusterId));
  
  // Get updated cluster
  const updated = await env.DB.prepare(`
    SELECT * FROM pain_clusters WHERE id = ?
  `).bind(clusterId).first();
  
  return jsonResponse({
    success: true,
    queries_used: queries.queries,
    new_posts_found: ingestionResult.posts,
    updated_member_count: updated.member_count,
    updated_score: updated.total_score,
  });
}

// ============ IDEA VALIDATION ============

async function validateIdeaEndpoint(env, body) {
  const { idea } = body;
  
  if (!idea || idea.length < 10) {
    return jsonResponse({ error: 'Idea must be at least 10 characters' }, 400);
  }
  
  // Search existing pain points
  const searchTerms = idea.toLowerCase().split(/\s+/).slice(0, 5);
  
  let matchingPainPoints = [];
  for (const term of searchTerms) {
    if (term.length < 3) continue;
    
    const results = await env.DB.prepare(`
      SELECT * FROM pain_records
      WHERE problem_text LIKE ?
      LIMIT 20
    `).bind(`%${term}%`).all();
    
    matchingPainPoints.push(...results.results);
  }
  
  // Deduplicate
  const seen = new Set();
  matchingPainPoints = matchingPainPoints.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  
  // Get LLM validation
  const validation = await validateIdea(env, idea, matchingPainPoints.slice(0, 15));
  
  // Store validation record
  const insertResult = await env.DB.prepare(`
    INSERT INTO validations (idea_text, search_queries, matching_pain_ids, validation_score, market_signals, confidence, status, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, 'complete', unixepoch(), unixepoch())
    RETURNING id
  `).bind(
    idea,
    JSON.stringify(validation.search_queries || []),
    JSON.stringify(matchingPainPoints.slice(0, 20).map(p => p.id)),
    validation.validation_score,
    JSON.stringify(validation.market_signals || []),
    validation.confidence
  ).first();
  
  return jsonResponse({
    validation_id: insertResult?.id,
    idea,
    validation_score: validation.validation_score,
    confidence: validation.confidence,
    verdict: validation.verdict,
    market_signals: validation.market_signals,
    concerns: validation.concerns,
    suggested_pivot: validation.suggested_pivot,
    matching_pain_points: matchingPainPoints.slice(0, 10).map(p => ({
      id: p.id,
      problem: p.problem_text,
      subreddit: p.subreddit,
      persona: p.persona,
    })),
    search_queries: validation.search_queries,
  });
}

async function getValidations(env, params) {
  const limit = Math.min(parseInt(params.get('limit')) || 20, 50);
  
  const result = await env.DB.prepare(`
    SELECT id, idea_text, validation_score, confidence, status, created_at
    FROM validations
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();
  
  return jsonResponse({ validations: result.results || [] });
}

async function getValidationDetail(env, id) {
  const validation = await env.DB.prepare(`
    SELECT * FROM validations WHERE id = ?
  `).bind(id).first();
  
  if (!validation) {
    return jsonResponse({ error: 'Validation not found' }, 404);
  }
  
  return jsonResponse({
    ...validation,
    search_queries: parseJSON(validation.search_queries),
    matching_pain_ids: parseJSON(validation.matching_pain_ids),
    market_signals: parseJSON(validation.market_signals),
  });
}

// ============ STATS & VISUALIZATIONS ============

async function getStats(env) {
  const [clusters, painRecords, posts, auClusters, avgScore] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as c FROM pain_clusters WHERE member_count > 0').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM pain_records').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM raw_posts').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM pain_clusters WHERE au_fit_score >= 50').first(),
    env.DB.prepare('SELECT AVG(total_score) as avg FROM pain_clusters WHERE total_score IS NOT NULL').first(),
  ]);
  
  return jsonResponse({
    opportunities: clusters?.c || 0,
    painRecords: painRecords?.c || 0,
    rawPosts: posts?.c || 0,
    auFocused: auClusters?.c || 0,
    avgScore: Math.round(avgScore?.avg || 0),
  });
}

async function getDetailedStats(env) {
  const [
    totalPosts,
    totalComments,
    totalPainRecords,
    totalClusters,
    bySubreddit,
    recentIngestions,
    filterStats,
  ] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as c FROM raw_posts').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM raw_comments').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM pain_records').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM pain_clusters WHERE member_count > 0').first(),
    env.DB.prepare(`
      SELECT subreddit, COUNT(*) as count 
      FROM pain_records 
      GROUP BY subreddit 
      ORDER BY count DESC 
      LIMIT 15
    `).all(),
    env.DB.prepare(`
      SELECT subreddit, posts_fetched, comments_fetched, created_at
      FROM ingestion_stats
      ORDER BY created_at DESC
      LIMIT 20
    `).all(),
    env.DB.prepare(`
      SELECT filter_reason, COUNT(*) as count
      FROM filter_decisions
      WHERE passes_filter = 0
      GROUP BY filter_reason
    `).all(),
  ]);
  
  return jsonResponse({
    totals: {
      posts: totalPosts?.c || 0,
      comments: totalComments?.c || 0,
      painRecords: totalPainRecords?.c || 0,
      clusters: totalClusters?.c || 0,
    },
    bySubreddit: bySubreddit.results || [],
    recentIngestions: recentIngestions.results || [],
    filterStats: filterStats.results || [],
    subredditCount: ALL_SUBREDDITS.length,
  });
}

async function getSeverityFrequencyChart(env) {
  const data = await env.DB.prepare(`
    SELECT 
      id,
      product_name,
      severity_score,
      frequency_score,
      total_score,
      member_count
    FROM pain_clusters
    WHERE severity_score IS NOT NULL AND frequency_score IS NOT NULL
    ORDER BY total_score DESC
    LIMIT 50
  `).all();
  
  return jsonResponse({ data: data.results || [] });
}

async function getSubredditBreakdown(env) {
  const data = await env.DB.prepare(`
    SELECT subreddit, COUNT(*) as count
    FROM pain_records
    GROUP BY subreddit
    ORDER BY count DESC
    LIMIT 20
  `).all();
  
  return jsonResponse({ data: data.results || [] });
}

async function getScoreDistribution(env) {
  const data = await env.DB.prepare(`
    SELECT 
      CASE 
        WHEN total_score >= 80 THEN '80-100'
        WHEN total_score >= 60 THEN '60-79'
        WHEN total_score >= 40 THEN '40-59'
        WHEN total_score >= 20 THEN '20-39'
        ELSE '0-19'
      END as range,
      COUNT(*) as count
    FROM pain_clusters
    WHERE total_score IS NOT NULL
    GROUP BY range
    ORDER BY range DESC
  `).all();
  
  return jsonResponse({ data: data.results || [] });
}

// ============ ADMIN ============

async function adminReset(env) {
  // Clear all data
  await env.DB.exec(`
    DELETE FROM cluster_members;
    DELETE FROM pain_clusters;
    DELETE FROM pain_records;
    DELETE FROM filter_decisions;
    DELETE FROM raw_comments;
    DELETE FROM raw_posts;
    DELETE FROM validations;
    DELETE FROM ingestion_stats;
    DELETE FROM daily_stats;
  `);
  
  return jsonResponse({ success: true, message: 'All data cleared' });
}

async function getPipelineStatus(env) {
  const [lastIngestion, lastFilter, pendingPosts, pendingFilters] = await Promise.all([
    env.DB.prepare('SELECT * FROM ingestion_stats ORDER BY created_at DESC LIMIT 1').first(),
    env.DB.prepare('SELECT * FROM filter_decisions ORDER BY created_at DESC LIMIT 1').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM raw_posts WHERE processed = 0').first(),
    env.DB.prepare(`
      SELECT COUNT(*) as c FROM raw_posts p
      LEFT JOIN filter_decisions f ON f.content_id = p.id AND f.content_type = 'post'
      WHERE f.id IS NULL
    `).first(),
  ]);
  
  return jsonResponse({
    lastIngestion: lastIngestion || null,
    lastFilter: lastFilter?.created_at || null,
    pendingPosts: pendingPosts?.c || 0,
    pendingFilters: pendingFilters?.c || 0,
    status: 'running',
    cronSchedule: '*/30 * * * *',
  });
}

// ============ HELPERS ============

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function parseJSON(str) {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}
