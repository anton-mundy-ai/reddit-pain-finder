/**
 * Reddit Pain Point Finder v2
 * 6-layer analysis pipeline
 * 
 * Architecture: Each cron/trigger runs ONE layer to stay within CPU limits.
 * State machine tracks which layer to run next.
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
    
    // Manual trigger for specific layer
    if (url.pathname === '/trigger/ingest' && request.method === 'POST') {
      ctx.waitUntil(runIngestion(env));
      return jsonResponse({ status: 'Ingestion triggered' });
    }
    
    if (url.pathname === '/trigger/filter' && request.method === 'POST') {
      ctx.waitUntil(runFiltering(env));
      return jsonResponse({ status: 'Filtering triggered' });
    }
    
    if (url.pathname === '/trigger/extract' && request.method === 'POST') {
      ctx.waitUntil(runExtraction(env));
      return jsonResponse({ status: 'Extraction triggered' });
    }
    
    if (url.pathname === '/trigger/cluster' && request.method === 'POST') {
      ctx.waitUntil(runClustering(env));
      return jsonResponse({ status: 'Clustering triggered' });
    }
    
    if (url.pathname === '/trigger/synthesize' && request.method === 'POST') {
      ctx.waitUntil(runSynthesis(env));
      return jsonResponse({ status: 'Synthesis triggered' });
    }
    
    if (url.pathname === '/trigger/score' && request.method === 'POST') {
      ctx.waitUntil(runScoring(env));
      return jsonResponse({ status: 'Scoring triggered' });
    }
    
    // Serve static frontend
    return serveStatic(request, env);
  },

  // Cron trigger - runs every 30 minutes
  // Rotates through layers: ingest -> filter -> extract -> cluster -> synthesize -> score
  async scheduled(event, env, ctx) {
    const minute = new Date().getMinutes();
    const layerIndex = Math.floor(minute / 5) % 6; // Changes every 5 minutes
    
    const layers = [
      { name: 'ingestion', fn: runIngestion },
      { name: 'filtering', fn: runFiltering },
      { name: 'extraction', fn: runExtraction },
      { name: 'clustering', fn: runClustering },
      { name: 'synthesis', fn: runSynthesis },
      { name: 'scoring', fn: runScoring },
    ];
    
    const layer = layers[layerIndex];
    console.log(`Cron running layer ${layerIndex + 1}: ${layer.name}`);
    
    try {
      const result = await layer.fn(env);
      console.log(`Layer ${layer.name} completed:`, result);
    } catch (error) {
      console.error(`Layer ${layer.name} failed:`, error);
    }
  },
};

/**
 * Serve static files (inline HTML fallback)
 */
async function serveStatic(request, env) {
  return new Response(getDashboardHTML(), {
    headers: { 'Content-Type': 'text/html' },
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
    .pipeline-status {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }
    .pipeline-layers {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 0.5rem;
    }
    .layer-badge {
      padding: 0.25rem 0.5rem;
      background: var(--surface-2);
      border-radius: 0.25rem;
      font-size: 0.75rem;
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
    
    <div class="pipeline-status">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>Pipeline Status</span>
        <span id="pipeline-status" style="color: var(--success);">●  Running (cron every 30min)</span>
      </div>
      <div class="pipeline-layers">
        <span class="layer-badge">1️⃣ Ingest</span>
        <span class="layer-badge">2️⃣ Filter</span>
        <span class="layer-badge">3️⃣ Extract</span>
        <span class="layer-badge">4️⃣ Cluster</span>
        <span class="layer-badge">5️⃣ Synthesize</span>
        <span class="layer-badge">6️⃣ Score</span>
      </div>
    </div>
    
    <div class="filters">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn au" data-filter="au">🇦🇺 Australia Focus</button>
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
          '<div class="empty">⏳ Pipeline is warming up. Data will appear after a few cron cycles (~2 hours for full pipeline).</div>';
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
        container.innerHTML = '<div class="empty">📊 No opportunities yet. The pipeline runs every 30 minutes, processing one layer at a time.<br><br>Data will appear once enough pain points are collected, clustered, and scored.</div>';
        return;
      }
      
      container.innerHTML = opps.map(opp => \`
        <div class="opportunity-card" onclick="showDetail(\${opp.cluster_id})">
          <div class="opportunity-header">
            <h3>\${escapeHtml((opp.summary || 'Untitled Opportunity').slice(0, 100))}...</h3>
            <div class="opportunity-score">
              <span>⚡</span>
              <span>\${Math.round(opp.total_score || 0)}</span>
            </div>
          </div>
          <p class="opportunity-summary">\${escapeHtml(opp.summary || '')}</p>
          <div class="opportunity-meta">
            <span class="meta-item">👥 \${opp.member_count || 0} mentions</span>
            <span class="meta-item">📊 \${(opp.subreddits || []).slice(0, 3).join(', ')}</span>
            \${(opp.au_fit_score || 0) > 50 ? '<span class="au-badge">AU</span>' : ''}
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
            \${quotes.length ? quotes.map(q => \`
              <div class="quote">
                <div class="quote-text">"\${escapeHtml(q.quote || q)}"</div>
                <div class="quote-source">
                  — \${q.author || 'anonymous'} 
                  \${q.url ? '<a href="' + q.url + '" target="_blank">View on Reddit →</a>' : ''}
                </div>
              </div>
            \`).join('') : '<p style="color: var(--text-dim)">No quotes available</p>'}
          </div>
          
          <div class="section">
            <div class="section-title">Personas Affected</div>
            <div class="tags">
              \${personas.length ? personas.map(p => '<span class="tag">' + escapeHtml(p) + '</span>').join('') : '<span style="color: var(--text-dim)">Not yet analyzed</span>'}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Current Workarounds</div>
            <div class="tags">
              \${workarounds.length ? workarounds.map(w => '<span class="tag">' + escapeHtml(w) + '</span>').join('') : '<span style="color: var(--text-dim)">Not yet analyzed</span>'}
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
      return String(str).replace(/[&<>"']/g, c => ({
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
    
    // Auto-refresh every 2 minutes
    setInterval(loadData, 120000);
  </script>
</body>
</html>`;
}
