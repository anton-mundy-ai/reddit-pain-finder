/**
 * API Router
 */

export async function handleAPIRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  
  try {
    // GET /api/opportunities - List all opportunities ranked by score
    if (path === '/opportunities' && request.method === 'GET') {
      return getOpportunities(env, url.searchParams);
    }
    
    // GET /api/opportunities/:id - Get detailed opportunity
    if (path.startsWith('/opportunities/') && request.method === 'GET') {
      const id = path.split('/')[2];
      return getOpportunityDetail(env, id);
    }
    
    // GET /api/stats - Dashboard stats
    if (path === '/stats' && request.method === 'GET') {
      return getStats(env);
    }
    
    // GET /api/health
    if (path === '/health') {
      return jsonResponse({ status: 'ok', timestamp: Date.now() });
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('API error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function getOpportunities(env, params) {
  const limit = Math.min(parseInt(params.get('limit')) || 50, 100);
  
  const result = await env.DB.prepare(`
    SELECT 
      c.id as cluster_id,
      c.name,
      c.member_count,
      b.summary,
      s.total_score,
      s.frequency_score,
      s.severity_score,
      s.economic_score,
      s.solvability_score,
      s.competition_score,
      s.au_fit_score
    FROM pain_clusters c
    LEFT JOIN opportunity_briefs b ON b.cluster_id = c.id
    LEFT JOIN cluster_scores s ON s.cluster_id = c.id
    WHERE c.is_active = 1
    ORDER BY s.total_score DESC NULLS LAST 
    LIMIT ?
  `).bind(limit).all();
  
  return jsonResponse({ opportunities: result.results || [] });
}

async function getOpportunityDetail(env, clusterId) {
  const cluster = await env.DB.prepare(`
    SELECT c.*, b.summary, b.top_quotes, b.personas, b.common_workarounds, b.impact_indicators
    FROM pain_clusters c
    LEFT JOIN opportunity_briefs b ON b.cluster_id = c.id
    WHERE c.id = ?
  `).bind(clusterId).first();
  
  if (!cluster) {
    return jsonResponse({ error: 'Cluster not found' }, 404);
  }
  
  const scores = await env.DB.prepare(`
    SELECT * FROM cluster_scores WHERE cluster_id = ?
  `).bind(clusterId).first();
  
  return jsonResponse({
    cluster_id: cluster.id,
    name: cluster.name,
    member_count: cluster.member_count,
    summary: cluster.summary,
    top_quotes: parseJSON(cluster.top_quotes),
    personas: parseJSON(cluster.personas),
    common_workarounds: parseJSON(cluster.common_workarounds),
    impact_indicators: parseJSON(cluster.impact_indicators),
    scores: scores || {},
  });
}

async function getStats(env) {
  // Single query for all stats
  const stats = await env.DB.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM pain_clusters WHERE is_active = 1) as clusters,
      (SELECT COUNT(*) FROM pain_records) as painRecords,
      (SELECT COUNT(DISTINCT subreddit) FROM raw_posts) as subreddits,
      (SELECT COUNT(*) FROM cluster_scores WHERE au_fit_score > 50) as auFocused
  `).first();
  
  return jsonResponse({
    clusters: stats?.clusters || 0,
    painRecords: stats?.painRecords || 0,
    subreddits: stats?.subreddits || 0,
    auFocused: stats?.auFocused || 0,
  });
}

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
