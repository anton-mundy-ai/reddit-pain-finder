/**
 * Reddit Pain Point Finder v2
 * 6-layer analysis pipeline
 */

import { handleAPIRequest } from './api/router.js';
import { runIngestion } from './layers/1-ingestion.js';
import { runFiltering } from './layers/2-filtering.js';
import { runExtraction } from './layers/3-extraction.js';
import { runClustering } from './layers/4-clustering.js';
import { runSynthesis } from './layers/5-synthesis.js';
import { runScoring } from './layers/6-scoring.js';

export default {
  // HTTP requests
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleAPIRequest(request, env, ctx);
    }
    
    // Manual trigger endpoints (for testing)
    if (url.pathname === '/trigger/ingest' && request.method === 'POST') {
      ctx.waitUntil(runFullPipeline(env));
      return jsonResponse({ status: 'Pipeline triggered' });
    }
    
    // Serve static frontend
    return serveStatic(request, env);
  },

  // Cron trigger - runs every 30 minutes
  async scheduled(event, env, ctx) {
    console.log('Cron triggered:', new Date().toISOString());
    ctx.waitUntil(runFullPipeline(env));
  },
};

/**
 * Run the full 6-layer pipeline
 */
async function runFullPipeline(env) {
  const startTime = Date.now();
  const stats = {
    layer1: { posts: 0, comments: 0 },
    layer2: { processed: 0, passed: 0 },
    layer3: { extracted: 0 },
    layer4: { clustered: 0, newClusters: 0 },
    layer5: { synthesized: 0 },
    layer6: { scored: 0 },
  };

  try {
    console.log('=== Starting Pipeline ===');
    
    // Layer 1: Ingestion
    console.log('Layer 1: Ingestion...');
    const ingestionResult = await runIngestion(env);
    stats.layer1 = ingestionResult;
    console.log(`  Fetched ${ingestionResult.posts} posts, ${ingestionResult.comments} comments`);
    
    // Layer 2: Filtering
    console.log('Layer 2: Filtering...');
    const filterResult = await runFiltering(env);
    stats.layer2 = filterResult;
    console.log(`  Processed ${filterResult.processed}, passed ${filterResult.passed}`);
    
    // Layer 3: Extraction
    console.log('Layer 3: Extraction...');
    const extractResult = await runExtraction(env);
    stats.layer3 = extractResult;
    console.log(`  Extracted ${extractResult.extracted} pain records`);
    
    // Layer 4: Clustering
    console.log('Layer 4: Clustering...');
    const clusterResult = await runClustering(env);
    stats.layer4 = clusterResult;
    console.log(`  Clustered ${clusterResult.clustered}, new clusters: ${clusterResult.newClusters}`);
    
    // Layer 5: Synthesis
    console.log('Layer 5: Synthesis...');
    const synthResult = await runSynthesis(env);
    stats.layer5 = synthResult;
    console.log(`  Synthesized ${synthResult.synthesized} briefs`);
    
    // Layer 6: Scoring
    console.log('Layer 6: Scoring...');
    const scoreResult = await runScoring(env);
    stats.layer6 = scoreResult;
    console.log(`  Scored ${scoreResult.scored} clusters`);
    
    const duration = Date.now() - startTime;
    console.log(`=== Pipeline Complete (${duration}ms) ===`);
    
    return { success: true, stats, duration };
  } catch (error) {
    console.error('Pipeline error:', error);
    return { success: false, error: error.message, stats };
  }
}

/**
 * Serve static files from frontend/dist
 */
async function serveStatic(request, env) {
  const url = new URL(request.url);
  let path = url.pathname;
  
  // Default to index.html
  if (path === '/' || path === '') {
    path = '/index.html';
  }
  
  try {
    // Try to get from KV (site bucket)
    const asset = await env.__STATIC_CONTENT.get(path.slice(1));
    if (asset) {
      const contentType = getContentType(path);
      return new Response(asset, {
        headers: { 'Content-Type': contentType },
      });
    }
  } catch (e) {
    // Fallback to inline HTML if static content not available
  }
  
  // Return inline dashboard HTML as fallback
  return new Response(getDashboardHTML(), {
    headers: { 'Content-Type': 'text/html' },
  });
}

function getContentType(path) {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  return 'text/plain';
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

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pain Point Finder | Ideas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0a0f;
      --surface: #12121a;
      --surface-2: #1a1a25;
      --border: #2a2a3a;
      --text: #e4e4e7;
      --text-dim: #71717a;
      --accent: #8b5cf6;
      --accent-dim: #6d28d9;
      --success: #22c55e;
      --warning: #f59e0b;
      --au-gold: #ffcd00;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    h1 { font-size: 1.5rem; font-weight: 600; }
    h1 span { color: var(--accent); }
    .filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 0.5rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      color: var(--text);
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover, .filter-btn.active {
      background: var(--accent-dim);
      border-color: var(--accent);
    }
    .filter-btn.au { border-color: var(--au-gold); }
    .filter-btn.au.active { background: #3d3000; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1rem;
    }
    .stat-value { font-size: 1.75rem; font-weight: 700; color: var(--accent); }
    .stat-label { font-size: 0.875rem; color: var(--text-dim); }
    .opportunities { display: grid; gap: 1rem; }
    .opportunity-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .opportunity-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }
    .opportunity-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }
    .opportunity-score {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      background: var(--accent-dim);
      border-radius: 1rem;
      font-weight: 600;
    }
    .opportunity-summary { color: var(--text); margin-bottom: 1rem; }
    .opportunity-meta {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      font-size: 0.875rem;
      color: var(--text-dim);
    }
    .meta-item { display: flex; align-items: center; gap: 0.25rem; }
    .au-badge {
      background: var(--au-gold);
      color: #000;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: none;
      justify-content: center;
      align-items: center;
      padding: 2rem;
      z-index: 100;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 2rem;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }
    .modal-close {
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: 1.5rem;
      cursor: pointer;
    }
    .section { margin-bottom: 1.5rem; }
    .section-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }
    .quote {
      background: var(--surface-2);
      border-left: 3px solid var(--accent);
      padding: 1rem;
      margin-bottom: 0.75rem;
      border-radius: 0 0.5rem 0.5rem 0;
    }
    .quote-text { font-style: italic; margin-bottom: 0.5rem; }
    .quote-source {
      font-size: 0.875rem;
      color: var(--text-dim);
    }
    .quote-source a { color: var(--accent); text-decoration: none; }
    .score-breakdown {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .score-item {
      background: var(--surface-2);
      padding: 1rem;
      border-radius: 0.5rem;
    }
    .score-bar {
      height: 4px;
      background: var(--border);
      border-radius: 2px;
      margin-top: 0.5rem;
    }
    .score-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 2px;
      transition: width 0.3s;
    }
    .tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .tag {
      padding: 0.25rem 0.75rem;
      background: var(--surface-2);
      border-radius: 1rem;
      font-size: 0.875rem;
    }
    .loading {
      text-align: center;
      padding: 4rem;
      color: var(--text-dim);
    }
    .empty {
      text-align: center;
      padding: 4rem;
      color: var(--text-dim);
    }
    @media (max-width: 768px) {
      .container { padding: 1rem; }
      header { flex-direction: column; gap: 1rem; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔍 Pain Point <span>Finder</span></h1>
      <div class="refresh-info" id="refresh-info"></div>
    </header>
    
    <div class="filters">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn au" data-filter="au">🇦🇺 Australia Focus</button>
      <button class="filter-btn" data-filter="business">Business</button>
      <button class="filter-btn" data-filter="consumer">Consumer</button>
      <button class="filter-btn" data-filter="high-score">High Score (80+)</button>
    </div>
    
    <div class="stats" id="stats">
      <div class="stat-card">
        <div class="stat-value" id="stat-opportunities">-</div>
        <div class="stat-label">Opportunities</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="stat-pain-points">-</div>
        <div class="stat-label">Pain Points</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="stat-subreddits">-</div>
        <div class="stat-label">Subreddits</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="stat-au">-</div>
        <div class="stat-label">AU-Focused</div>
      </div>
    </div>
    
    <div class="opportunities" id="opportunities">
      <div class="loading">Loading opportunities...</div>
    </div>
  </div>
  
  <div class="modal-overlay" id="modal">
    <div class="modal" id="modal-content"></div>
  </div>
  
  <script>
    let allOpportunities = [];
    let currentFilter = 'all';
    
    async function loadData() {
      try {
        const [opps, stats] = await Promise.all([
          fetch('/api/opportunities').then(r => r.json()),
          fetch('/api/stats').then(r => r.json())
        ]);
        
        allOpportunities = opps.opportunities || [];
        updateStats(stats);
        renderOpportunities(allOpportunities);
        
        document.getElementById('refresh-info').textContent = 
          'Last updated: ' + new Date().toLocaleTimeString();
      } catch (e) {
        document.getElementById('opportunities').innerHTML = 
          '<div class="empty">Failed to load data. Pipeline may still be initializing.</div>';
      }
    }
    
    function updateStats(stats) {
      document.getElementById('stat-opportunities').textContent = stats.clusters || 0;
      document.getElementById('stat-pain-points').textContent = stats.painRecords || 0;
      document.getElementById('stat-subreddits').textContent = stats.subreddits || 0;
      document.getElementById('stat-au').textContent = stats.auFocused || 0;
    }
    
    function renderOpportunities(opps) {
      const container = document.getElementById('opportunities');
      
      if (!opps.length) {
        container.innerHTML = '<div class="empty">No opportunities found yet. Data is being collected and analyzed.</div>';
        return;
      }
      
      container.innerHTML = opps.map(opp => \`
        <div class="opportunity-card" onclick="showDetail(\${opp.cluster_id})">
          <div class="opportunity-header">
            <h3>\${escapeHtml(opp.summary?.slice(0, 100) || 'Untitled Opportunity')}...</h3>
            <div class="opportunity-score">
              <span>⚡</span>
              <span>\${Math.round(opp.total_score || 0)}</span>
            </div>
          </div>
          <p class="opportunity-summary">\${escapeHtml(opp.summary || '')}</p>
          <div class="opportunity-meta">
            <span class="meta-item">👥 \${opp.member_count || 0} mentions</span>
            <span class="meta-item">📊 \${(opp.subreddits || []).slice(0, 3).join(', ')}</span>
            \${opp.au_fit_score > 50 ? '<span class="au-badge">AU</span>' : ''}
          </div>
        </div>
      \`).join('');
    }
    
    async function showDetail(clusterId) {
      try {
        const detail = await fetch('/api/opportunities/' + clusterId).then(r => r.json());
        
        const quotes = detail.top_quotes || [];
        const personas = detail.personas || [];
        const workarounds = detail.common_workarounds || [];
        const scores = detail.scores || {};
        
        document.getElementById('modal-content').innerHTML = \`
          <div class="modal-header">
            <h2>\${escapeHtml(detail.summary || 'Opportunity Detail')}</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
          </div>
          
          <div class="section">
            <div class="section-title">Score Breakdown</div>
            <div class="score-breakdown">
              \${renderScoreItem('Frequency', scores.frequency_score)}
              \${renderScoreItem('Severity', scores.severity_score)}
              \${renderScoreItem('Economic Value', scores.economic_score)}
              \${renderScoreItem('Solvability', scores.solvability_score)}
              \${renderScoreItem('Competition Gap', scores.competition_score)}
              \${renderScoreItem('AU Fit', scores.au_fit_score)}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Top Quotes</div>
            \${quotes.map(q => \`
              <div class="quote">
                <div class="quote-text">"\${escapeHtml(q.quote)}"</div>
                <div class="quote-source">
                  — \${q.author || 'anonymous'} 
                  <a href="\${q.url}" target="_blank">View on Reddit →</a>
                </div>
              </div>
            \`).join('')}
          </div>
          
          <div class="section">
            <div class="section-title">Personas Affected</div>
            <div class="tags">
              \${personas.map(p => '<span class="tag">' + escapeHtml(p) + '</span>').join('')}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Current Workarounds</div>
            <div class="tags">
              \${workarounds.map(w => '<span class="tag">' + escapeHtml(w) + '</span>').join('')}
            </div>
          </div>
        \`;
        
        document.getElementById('modal').classList.add('open');
      } catch (e) {
        console.error('Failed to load detail:', e);
      }
    }
    
    function renderScoreItem(label, score) {
      const pct = Math.min(100, Math.max(0, score || 0));
      return \`
        <div class="score-item">
          <div style="display: flex; justify-content: space-between;">
            <span>\${label}</span>
            <span>\${Math.round(pct)}</span>
          </div>
          <div class="score-bar">
            <div class="score-fill" style="width: \${pct}%"></div>
          </div>
        </div>
      \`;
    }
    
    function closeModal() {
      document.getElementById('modal').classList.remove('open');
    }
    
    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }
    
    // Filter handlers
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        applyFilter();
      });
    });
    
    function applyFilter() {
      let filtered = allOpportunities;
      
      switch (currentFilter) {
        case 'au':
          filtered = allOpportunities.filter(o => (o.au_fit_score || 0) > 50);
          break;
        case 'business':
          filtered = allOpportunities.filter(o => o.category === 'business');
          break;
        case 'consumer':
          filtered = allOpportunities.filter(o => o.category === 'consumer');
          break;
        case 'high-score':
          filtered = allOpportunities.filter(o => (o.total_score || 0) >= 80);
          break;
      }
      
      renderOpportunities(filtered);
    }
    
    // Close modal on overlay click
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') closeModal();
    });
    
    // Initial load
    loadData();
    
    // Auto-refresh every 5 minutes
    setInterval(loadData, 300000);
  </script>
</body>
</html>`;
}
