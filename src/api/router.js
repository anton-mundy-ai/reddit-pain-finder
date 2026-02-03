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
    
    // GET /api/pain-records - List pain records
    if (path === '/pain-records' && request.method === 'GET') {
      return getPainRecords(env, url.searchParams);
    }
    
    // POST /api/trigger/:layer - Manual trigger for specific layer
    if (path.startsWith('/trigger/') && request.method === 'POST') {
      const layer = path.split('/')[2];
      return triggerLayer(env, ctx, layer);
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
  const offset = parseInt(params.get('offset')) || 0;
  const auOnly = params.get('au') === 'true';
  const minScore = parseInt(params.get('min_score')) || 0;
  
  let query = `
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
  `;
  
  const queryParams = [];
  
  if (auOnly) {
    query += ` AND s.au_fit_score > 50`;
  }
  
  if (minScore > 0) {
    query += ` AND s.total_score >= ?`;
    queryParams.push(minScore);
  }
  
  query += ` ORDER BY s.total_score DESC NULLS LAST LIMIT ? OFFSET ?`;
  queryParams.push(limit, offset);
  
  const result = await env.DB.prepare(query).bind(...queryParams).all();
  
  // Get subreddits for each cluster
  const opportunities = await Promise.all(
    result.results.map(async (opp) => {
      const subreddits = await env.DB.prepare(`
        SELECT DISTINCT pr.subreddit
        FROM pain_records pr
        JOIN cluster_members cm ON cm.pain_record_id = pr.id
        WHERE cm.cluster_id = ?
        LIMIT 5
      `).bind(opp.cluster_id).all();
      
      return {
        ...opp,
        subreddits: subreddits.results.map(s => s.subreddit),
      };
    })
  );
  
  return jsonResponse({ opportunities });
}

async function getOpportunityDetail(env, clusterId) {
  // Get cluster info
  const cluster = await env.DB.prepare(`
    SELECT c.*, b.summary, b.top_quotes, b.personas, b.common_workarounds, b.impact_indicators
    FROM pain_clusters c
    LEFT JOIN opportunity_briefs b ON b.cluster_id = c.id
    WHERE c.id = ?
  `).bind(clusterId).first();
  
  if (!cluster) {
    return jsonResponse({ error: 'Cluster not found' }, 404);
  }
  
  // Get scores
  const scores = await env.DB.prepare(`
    SELECT * FROM cluster_scores WHERE cluster_id = ?
  `).bind(clusterId).first();
  
  // Get member pain records
  const members = await env.DB.prepare(`
    SELECT pr.*, cm.similarity_score
    FROM pain_records pr
    JOIN cluster_members cm ON cm.pain_record_id = pr.id
    WHERE cm.cluster_id = ?
    ORDER BY cm.similarity_score DESC
    LIMIT 20
  `).bind(clusterId).all();
  
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
    members: members.results,
  });
}

async function getStats(env) {
  const [clusters, painRecords, subreddits, auFocused, lastIngestion] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as count FROM pain_clusters WHERE is_active = 1').first(),
    env.DB.prepare('SELECT COUNT(*) as count FROM pain_records').first(),
    env.DB.prepare('SELECT COUNT(DISTINCT subreddit) as count FROM raw_posts').first(),
    env.DB.prepare('SELECT COUNT(*) as count FROM cluster_scores WHERE au_fit_score > 50').first(),
    env.DB.prepare('SELECT MAX(run_at) as last_run FROM ingestion_stats').first(),
  ]);
  
  return jsonResponse({
    clusters: clusters?.count || 0,
    painRecords: painRecords?.count || 0,
    subreddits: subreddits?.count || 0,
    auFocused: auFocused?.count || 0,
    lastIngestion: lastIngestion?.last_run || null,
  });
}

async function getPainRecords(env, params) {
  const limit = Math.min(parseInt(params.get('limit')) || 50, 100);
  const offset = parseInt(params.get('offset')) || 0;
  const subreddit = params.get('subreddit');
  
  let query = 'SELECT * FROM pain_records WHERE 1=1';
  const queryParams = [];
  
  if (subreddit) {
    query += ' AND subreddit = ?';
    queryParams.push(subreddit);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);
  
  const result = await env.DB.prepare(query).bind(...queryParams).all();
  
  return jsonResponse({ pain_records: result.results });
}

async function triggerLayer(env, ctx, layer) {
  const { runIngestion } = await import('../layers/1-ingestion.js');
  const { runFiltering } = await import('../layers/2-filtering.js');
  const { runExtraction } = await import('../layers/3-extraction.js');
  const { runClustering } = await import('../layers/4-clustering.js');
  const { runSynthesis } = await import('../layers/5-synthesis.js');
  const { runScoring } = await import('../layers/6-scoring.js');
  
  const layers = {
    'ingest': runIngestion,
    '1': runIngestion,
    'filter': runFiltering,
    '2': runFiltering,
    'extract': runExtraction,
    '3': runExtraction,
    'cluster': runClustering,
    '4': runClustering,
    'synthesize': runSynthesis,
    '5': runSynthesis,
    'score': runScoring,
    '6': runScoring,
  };
  
  const runFn = layers[layer];
  if (!runFn) {
    return jsonResponse({ error: 'Unknown layer: ' + layer }, 400);
  }
  
  ctx.waitUntil(runFn(env));
  return jsonResponse({ status: 'Layer triggered', layer });
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
