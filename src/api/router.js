/**
 * API Router - Adapted to existing database schema
 */

export async function handleAPIRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  
  try {
    if (path === '/opportunities' && request.method === 'GET') {
      return getOpportunities(env, url.searchParams);
    }
    
    if (path.startsWith('/opportunities/') && request.method === 'GET') {
      const id = path.split('/')[2];
      return getOpportunityDetail(env, id);
    }
    
    if (path === '/stats' && request.method === 'GET') {
      return getStats(env);
    }
    
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
  
  // Using existing schema columns
  const result = await env.DB.prepare(`
    SELECT 
      c.id as cluster_id,
      c.centroid_text as name,
      c.member_count,
      c.brief_summary as summary,
      s.total_score,
      s.frequency_score,
      s.severity_score,
      s.economic_score,
      s.solvability_score,
      s.competition_score,
      s.au_fit_score
    FROM pain_clusters c
    LEFT JOIN cluster_scores s ON s.cluster_id = c.id
    WHERE c.member_count > 0
    ORDER BY s.total_score DESC NULLS LAST 
    LIMIT ?
  `).bind(limit).all();
  
  return jsonResponse({ opportunities: result.results || [] });
}

async function getOpportunityDetail(env, clusterId) {
  const cluster = await env.DB.prepare(`
    SELECT 
      c.*,
      c.brief_summary as summary,
      c.brief_quotes as top_quotes,
      c.brief_personas as personas,
      c.brief_workarounds as common_workarounds
    FROM pain_clusters c
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
    name: cluster.centroid_text,
    member_count: cluster.member_count,
    summary: cluster.summary,
    top_quotes: parseJSON(cluster.top_quotes),
    personas: parseJSON(cluster.personas),
    common_workarounds: parseJSON(cluster.common_workarounds),
    scores: scores || {},
  });
}

async function getStats(env) {
  try {
    const clusters = await env.DB.prepare('SELECT COUNT(*) as c FROM pain_clusters WHERE member_count > 0').first();
    const painRecords = await env.DB.prepare('SELECT COUNT(*) as c FROM pain_records').first();
    const posts = await env.DB.prepare('SELECT COUNT(*) as c FROM raw_posts').first();
    
    return jsonResponse({
      clusters: clusters?.c || 0,
      painRecords: painRecords?.c || 0,
      subreddits: posts?.c || 0,
      auFocused: 0,
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
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
