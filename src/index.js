/**
 * Reddit Pain Point Finder v3
 * Modern dark theme dashboard with validation, visualizations, and admin controls
 */

import { handleAPIRequest } from './api/router.js';
import { runIngestion } from './layers/1-ingestion.js';
import { runFiltering } from './layers/2-filtering.js';
import { runExtraction } from './layers/3-extraction.js';
import { runClustering } from './layers/4-clustering.js';
import { runSynthesis } from './layers/5-synthesis.js';
import { runScoring } from './layers/6-scoring.js';

export default {
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
    
    // Manual triggers
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
      try {
        const result = await runSynthesis(env);
        return jsonResponse({ status: 'Synthesis complete', result });
      } catch (e) {
        return jsonResponse({ status: 'Synthesis failed', error: e.message }, 500);
      }
    }
    if (url.pathname === '/trigger/score' && request.method === 'POST') {
      try {
        const result = await runScoring(env);
        return jsonResponse({ status: 'Scoring complete', result });
      } catch (e) {
        return jsonResponse({ status: 'Scoring failed', error: e.message }, 500);
      }
    }
    if (url.pathname === '/trigger/all' && request.method === 'POST') {
      ctx.waitUntil((async () => {
        await runIngestion(env);
        await runFiltering(env);
        await runExtraction(env);
        await runClustering(env);
        await runSynthesis(env);
        await runScoring(env);
      })());
      return jsonResponse({ status: 'Full pipeline triggered' });
    }
    
    // Serve dashboard
    return new Response(getDashboardHTML(), {
      headers: { 'Content-Type': 'text/html' },
    });
  },

  async scheduled(event, env, ctx) {
    const minute = new Date().getMinutes();
    const layerIndex = Math.floor(minute / 5) % 6;
    
    const layers = [
      { name: 'ingestion', fn: runIngestion },
      { name: 'filtering', fn: runFiltering },
      { name: 'extraction', fn: runExtraction },
      { name: 'clustering', fn: runClustering },
      { name: 'synthesis', fn: runSynthesis },
      { name: 'scoring', fn: runScoring },
    ];
    
    const layer = layers[layerIndex];
    console.log(`[Cron] Running layer ${layerIndex + 1}: ${layer.name}`);
    
    try {
      const result = await layer.fn(env);
      console.log(`[Cron] ${layer.name} completed:`, result);
    } catch (error) {
      console.error(`[Cron] ${layer.name} failed:`, error);
    }
  },
};

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
  <title>Pain Point Finder | Discover Startup Ideas</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0a0f;
      --bg-2: #0f0f17;
      --surface: #13131d;
      --surface-2: #1a1a28;
      --surface-3: #222233;
      --border: #2a2a3d;
      --text: #e8e8ef;
      --text-dim: #8888a0;
      --text-muted: #5a5a70;
      --accent: #8b5cf6;
      --accent-dim: #6d28d9;
      --accent-glow: rgba(139, 92, 246, 0.2);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --au-gold: #ffd700;
      --gradient: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
    }
    
    /* Navigation */
    .nav {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0.75rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(10px);
    }
    .logo {
      font-size: 1.25rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .logo span { color: var(--accent); }
    .nav-tabs {
      display: flex;
      gap: 0.5rem;
    }
    .nav-tab {
      padding: 0.5rem 1rem;
      background: transparent;
      border: none;
      color: var(--text-dim);
      font-size: 0.9rem;
      cursor: pointer;
      border-radius: 0.5rem;
      transition: all 0.2s;
    }
    .nav-tab:hover { color: var(--text); background: var(--surface-2); }
    .nav-tab.active { color: var(--accent); background: var(--accent-glow); }
    
    /* Main Container */
    .container { max-width: 1600px; margin: 0 auto; padding: 1.5rem; }
    
    /* Page Sections */
    .page { display: none; }
    .page.active { display: block; }
    
    /* Stats Row */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.25rem;
      position: relative;
      overflow: hidden;
    }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--gradient);
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 0.25rem;
    }
    .stat-label { font-size: 0.85rem; color: var(--text-dim); }
    
    /* Filters */
    .filters {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-btn {
      padding: 0.5rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      color: var(--text);
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover { border-color: var(--accent); }
    .filter-btn.active { background: var(--accent-dim); border-color: var(--accent); }
    .filter-btn.au { border-color: var(--au-gold); }
    .filter-btn.au.active { background: rgba(255, 215, 0, 0.2); border-color: var(--au-gold); }
    .filter-search {
      flex: 1;
      min-width: 200px;
      padding: 0.5rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      color: var(--text);
      font-size: 0.9rem;
    }
    .filter-search::placeholder { color: var(--text-muted); }
    .filter-search:focus { outline: none; border-color: var(--accent); }
    
    /* Opportunity Grid */
    .opportunities-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }
    .opp-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.25rem;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }
    .opp-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    }
    .opp-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }
    .opp-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text);
      line-height: 1.3;
    }
    .opp-score {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.6rem;
      background: var(--accent-glow);
      border: 1px solid var(--accent-dim);
      border-radius: 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--accent);
      white-space: nowrap;
    }
    .opp-summary {
      color: var(--text-dim);
      font-size: 0.9rem;
      margin-bottom: 1rem;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .opp-meta {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .opp-meta span { display: flex; align-items: center; gap: 0.25rem; }
    .au-badge {
      background: var(--au-gold);
      color: #000;
      padding: 0.15rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.7rem;
      font-weight: 700;
    }
    
    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: none;
      justify-content: center;
      align-items: flex-start;
      padding: 2rem;
      z-index: 200;
      overflow-y: auto;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      max-width: 900px;
      width: 100%;
      margin: 2rem auto;
      position: relative;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .modal-title { font-size: 1.5rem; font-weight: 700; }
    .modal-close {
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0.25rem;
    }
    .modal-close:hover { color: var(--text); }
    .modal-body { padding: 1.5rem; }
    .modal-section { margin-bottom: 1.5rem; }
    .modal-section:last-child { margin-bottom: 0; }
    .section-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }
    
    /* Score Grid */
    .score-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
    }
    .score-item {
      background: var(--surface-2);
      padding: 1rem;
      border-radius: 0.75rem;
      text-align: center;
    }
    .score-item-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--accent);
    }
    .score-item-label {
      font-size: 0.75rem;
      color: var(--text-dim);
      margin-top: 0.25rem;
    }
    
    /* Quote */
    .quote {
      background: var(--surface-2);
      border-left: 3px solid var(--accent);
      padding: 1rem;
      margin-bottom: 0.75rem;
      border-radius: 0 0.5rem 0.5rem 0;
    }
    .quote-text {
      font-style: italic;
      color: var(--text);
      margin-bottom: 0.5rem;
      line-height: 1.5;
    }
    .quote-source {
      font-size: 0.8rem;
      color: var(--text-dim);
    }
    .quote-source a { color: var(--accent); text-decoration: none; }
    .quote-source a:hover { text-decoration: underline; }
    
    /* Tags */
    .tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .tag {
      padding: 0.35rem 0.75rem;
      background: var(--surface-2);
      border-radius: 1rem;
      font-size: 0.8rem;
      color: var(--text);
    }
    
    /* Back-validate button */
    .btn {
      padding: 0.6rem 1.25rem;
      background: var(--gradient);
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 15px var(--accent-glow); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: var(--surface-2);
      border: 1px solid var(--border);
    }
    
    /* Validator Page */
    .validator-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 2rem;
      max-width: 700px;
      margin: 0 auto 2rem;
    }
    .validator-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      text-align: center;
    }
    .validator-subtitle {
      color: var(--text-dim);
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .validator-input {
      width: 100%;
      padding: 1rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      color: var(--text);
      font-size: 1rem;
      min-height: 100px;
      resize: vertical;
      margin-bottom: 1rem;
    }
    .validator-input:focus { outline: none; border-color: var(--accent); }
    .validator-result {
      background: var(--surface-2);
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-top: 1.5rem;
    }
    .validation-score-big {
      font-size: 3rem;
      font-weight: 700;
      text-align: center;
      margin-bottom: 0.5rem;
    }
    .validation-score-big.strong { color: var(--success); }
    .validation-score-big.moderate { color: var(--warning); }
    .validation-score-big.weak { color: var(--danger); }
    .validation-verdict {
      text-align: center;
      font-size: 1.1rem;
      color: var(--text-dim);
      margin-bottom: 1.5rem;
    }
    
    /* Charts */
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .chart-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.5rem;
    }
    .chart-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .chart-container {
      position: relative;
      height: 250px;
    }
    
    /* Admin Panel */
    .admin-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
    }
    .admin-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.5rem;
    }
    .admin-card h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .admin-btn {
      width: 100%;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      color: var(--text);
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .admin-btn:hover { border-color: var(--accent); }
    .admin-btn.danger { border-color: var(--danger); color: var(--danger); }
    .admin-btn.danger:hover { background: rgba(239, 68, 68, 0.1); }
    .admin-status {
      font-size: 0.85rem;
      color: var(--text-dim);
      margin-top: 0.5rem;
    }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-dim);
    }
    .empty-state-icon { font-size: 3rem; margin-bottom: 1rem; }
    .empty-state-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text); }
    
    /* Loading */
    .loading {
      text-align: center;
      padding: 4rem;
      color: var(--text-dim);
    }
    .spinner {
      display: inline-block;
      width: 40px;
      height: 40px;
      border: 3px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    /* Responsive */
    @media (max-width: 768px) {
      .nav { padding: 0.75rem 1rem; flex-wrap: wrap; gap: 0.5rem; }
      .container { padding: 1rem; }
      .opportunities-grid { grid-template-columns: 1fr; }
      .charts-grid { grid-template-columns: 1fr; }
      .modal { margin: 1rem; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="logo">🔍 Pain Point <span>Finder</span></div>
    <div class="nav-tabs">
      <button class="nav-tab active" data-page="dashboard">Dashboard</button>
      <button class="nav-tab" data-page="validator">Validator</button>
      <button class="nav-tab" data-page="charts">Charts</button>
      <button class="nav-tab" data-page="admin">Admin</button>
    </div>
  </nav>
  
  <div class="container">
    <!-- Dashboard Page -->
    <div class="page active" id="page-dashboard">
      <div class="stats-row" id="stats-row">
        <div class="stat-card">
          <div class="stat-value" id="stat-opportunities">-</div>
          <div class="stat-label">Opportunities</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-pain-points">-</div>
          <div class="stat-label">Pain Points</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-posts">-</div>
          <div class="stat-label">Posts Analyzed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-au">-</div>
          <div class="stat-label">AU Focused</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-avg-score">-</div>
          <div class="stat-label">Avg Score</div>
        </div>
      </div>
      
      <div class="filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn au" data-filter="au">🇦🇺 Australia</button>
        <button class="filter-btn" data-filter="high">High Score (80+)</button>
        <button class="filter-btn" data-filter="severity">By Severity</button>
        <input type="text" class="filter-search" id="search-input" placeholder="Search opportunities...">
      </div>
      
      <div class="opportunities-grid" id="opportunities-grid">
        <div class="loading"><div class="spinner"></div><p style="margin-top:1rem">Loading opportunities...</p></div>
      </div>
    </div>
    
    <!-- Validator Page -->
    <div class="page" id="page-validator">
      <div class="validator-box">
        <h2 class="validator-title">💡 Idea Validator</h2>
        <p class="validator-subtitle">Test your business idea against real pain points from Reddit</p>
        <textarea class="validator-input" id="idea-input" placeholder="Describe your business idea...&#10;&#10;Example: A tool that helps freelancers automatically track time and generate invoices"></textarea>
        <button class="btn" id="validate-btn" style="width:100%">Validate Idea</button>
        <div id="validation-result"></div>
      </div>
      
      <h3 style="margin-bottom:1rem">Recent Validations</h3>
      <div id="validations-list"></div>
    </div>
    
    <!-- Charts Page -->
    <div class="page" id="page-charts">
      <div class="charts-grid">
        <div class="chart-card">
          <h3 class="chart-title">📊 Score Distribution</h3>
          <div class="chart-container"><canvas id="score-chart"></canvas></div>
        </div>
        <div class="chart-card">
          <h3 class="chart-title">📍 Subreddit Breakdown</h3>
          <div class="chart-container"><canvas id="subreddit-chart"></canvas></div>
        </div>
        <div class="chart-card">
          <h3 class="chart-title">⚡ Severity vs Frequency</h3>
          <div class="chart-container"><canvas id="scatter-chart"></canvas></div>
        </div>
      </div>
    </div>
    
    <!-- Admin Page -->
    <div class="page" id="page-admin">
      <div class="admin-grid">
        <div class="admin-card">
          <h3>🔄 Pipeline Controls</h3>
          <button class="admin-btn" onclick="triggerPipeline('ingest')">Run Ingestion</button>
          <button class="admin-btn" onclick="triggerPipeline('filter')">Run Filtering</button>
          <button class="admin-btn" onclick="triggerPipeline('extract')">Run Extraction</button>
          <button class="admin-btn" onclick="triggerPipeline('cluster')">Run Clustering</button>
          <button class="admin-btn" onclick="triggerPipeline('synthesize')">Run Synthesis</button>
          <button class="admin-btn" onclick="triggerPipeline('score')">Run Scoring</button>
          <button class="admin-btn" style="background:var(--accent-dim);border-color:var(--accent)" onclick="triggerPipeline('all')">Run Full Pipeline</button>
          <div class="admin-status" id="pipeline-status">Status: Idle</div>
        </div>
        
        <div class="admin-card">
          <h3>📈 Pipeline Status</h3>
          <div id="detailed-stats">Loading...</div>
        </div>
        
        <div class="admin-card">
          <h3>⚠️ Danger Zone</h3>
          <button class="admin-btn danger" onclick="resetData()">Clear All Data</button>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem">This will delete all opportunities, pain points, and validations.</p>
        </div>
        
        <div class="admin-card">
          <h3>📋 Subreddits (42)</h3>
          <div id="subreddit-list" style="max-height:200px;overflow-y:auto;font-size:0.8rem;color:var(--text-dim)">Loading...</div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Detail Modal -->
  <div class="modal-overlay" id="modal">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title" id="modal-title">Opportunity Detail</h2>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body" id="modal-body"></div>
    </div>
  </div>
  
  <script>
    // State
    let allOpportunities = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let charts = {};
    
    // Page Navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('page-' + tab.dataset.page).classList.add('active');
        
        if (tab.dataset.page === 'charts') loadCharts();
        if (tab.dataset.page === 'admin') loadAdminData();
        if (tab.dataset.page === 'validator') loadValidations();
      });
    });
    
    // Load Dashboard Data
    async function loadDashboard() {
      try {
        const [opps, stats] = await Promise.all([
          fetch('/api/opportunities?limit=100').then(r => r.json()),
          fetch('/api/stats').then(r => r.json())
        ]);
        
        allOpportunities = opps.opportunities || [];
        updateStats(stats);
        renderOpportunities(allOpportunities);
      } catch (e) {
        console.error('Failed to load dashboard:', e);
        document.getElementById('opportunities-grid').innerHTML = 
          '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Pipeline Warming Up</div><p>Data will appear after a few cron cycles.</p></div>';
      }
    }
    
    function updateStats(stats) {
      document.getElementById('stat-opportunities').textContent = stats.opportunities || 0;
      document.getElementById('stat-pain-points').textContent = stats.painRecords || 0;
      document.getElementById('stat-posts').textContent = stats.rawPosts || 0;
      document.getElementById('stat-au').textContent = stats.auFocused || 0;
      document.getElementById('stat-avg-score').textContent = stats.avgScore || 0;
    }
    
    function renderOpportunities(opps) {
      const container = document.getElementById('opportunities-grid');
      
      if (!opps.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">No Opportunities Yet</div><p>The pipeline is analyzing Reddit posts. Check back soon!</p></div>';
        return;
      }
      
      container.innerHTML = opps.map(opp => \`
        <div class="opp-card" onclick="showDetail(\${opp.cluster_id})">
          <div class="opp-header">
            <h3 class="opp-title">\${escapeHtml(opp.product_name || opp.centroid_text?.slice(0, 40) || 'Unnamed')}</h3>
            <div class="opp-score">
              <span>⚡</span>
              <span>\${Math.round(opp.total_score || 0)}</span>
            </div>
          </div>
          <p class="opp-summary">\${escapeHtml(opp.summary || '')}</p>
          <div class="opp-meta">
            <span>👥 \${opp.member_count || 0}</span>
            <span>🎯 Severity \${Math.round(opp.severity_score || 0)}</span>
            \${(opp.au_fit_score || 0) >= 50 ? '<span class="au-badge">AU</span>' : ''}
          </div>
        </div>
      \`).join('');
    }
    
    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        applyFilters();
      });
    });
    
    document.getElementById('search-input').addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      applyFilters();
    });
    
    function applyFilters() {
      let filtered = [...allOpportunities];
      
      // Apply filter
      switch (currentFilter) {
        case 'au':
          filtered = filtered.filter(o => (o.au_fit_score || 0) >= 50);
          break;
        case 'high':
          filtered = filtered.filter(o => (o.total_score || 0) >= 80);
          break;
        case 'severity':
          filtered.sort((a, b) => (b.severity_score || 0) - (a.severity_score || 0));
          break;
      }
      
      // Apply search
      if (searchQuery) {
        filtered = filtered.filter(o => 
          (o.product_name || '').toLowerCase().includes(searchQuery) ||
          (o.summary || '').toLowerCase().includes(searchQuery)
        );
      }
      
      renderOpportunities(filtered);
    }
    
    // Detail Modal
    async function showDetail(clusterId) {
      try {
        const detail = await fetch('/api/opportunities/' + clusterId).then(r => r.json());
        
        document.getElementById('modal-title').textContent = detail.product_name || 'Opportunity Detail';
        document.getElementById('modal-body').innerHTML = \`
          <div class="modal-section">
            <p style="font-size:1.1rem;margin-bottom:1rem">\${escapeHtml(detail.summary || '')}</p>
          </div>
          
          <div class="modal-section">
            <div class="section-title">Score Breakdown</div>
            <div class="score-grid">
              \${renderScoreItem('Total', detail.scores?.total)}
              \${renderScoreItem('Severity', detail.scores?.severity)}
              \${renderScoreItem('Frequency', detail.scores?.frequency)}
              \${renderScoreItem('Economic', detail.scores?.economic)}
              \${renderScoreItem('Solvability', detail.scores?.solvability)}
              \${renderScoreItem('AU Fit', detail.scores?.au_fit)}
            </div>
          </div>
          
          <div class="modal-section">
            <div class="section-title">Top Quotes</div>
            \${(detail.top_quotes || []).slice(0, 5).map(q => \`
              <div class="quote">
                <div class="quote-text">"\${escapeHtml(q.quote || '')}"</div>
                <div class="quote-source">
                  r/\${q.subreddit || 'unknown'}
                  \${q.url ? ' — <a href="' + q.url + '" target="_blank">View on Reddit →</a>' : ''}
                </div>
              </div>
            \`).join('') || '<p style="color:var(--text-dim)">No quotes available</p>'}
          </div>
          
          <div class="modal-section">
            <div class="section-title">Personas</div>
            <div class="tags">
              \${(detail.personas || []).map(p => '<span class="tag">' + escapeHtml(p) + '</span>').join('') || '<span style="color:var(--text-dim)">Not analyzed</span>'}
            </div>
          </div>
          
          <div class="modal-section">
            <div class="section-title">Current Workarounds</div>
            <div class="tags">
              \${(detail.workarounds || []).map(w => '<span class="tag">' + escapeHtml(w) + '</span>').join('') || '<span style="color:var(--text-dim)">Not analyzed</span>'}
            </div>
          </div>
          
          <div class="modal-section" style="margin-top:1.5rem">
            <button class="btn" onclick="backValidate(\${clusterId})" id="validate-cluster-btn">🔍 Find More Evidence</button>
            <span id="validate-status" style="margin-left:1rem;color:var(--text-dim)"></span>
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
          <div class="score-item-value">\${Math.round(pct)}</div>
          <div class="score-item-label">\${label}</div>
        </div>
      \`;
    }
    
    function closeModal() {
      document.getElementById('modal').classList.remove('open');
    }
    
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') closeModal();
    });
    
    // Back-validate
    async function backValidate(clusterId) {
      const btn = document.getElementById('validate-cluster-btn');
      const status = document.getElementById('validate-status');
      
      btn.disabled = true;
      status.textContent = 'Searching for more evidence...';
      
      try {
        const result = await fetch('/api/opportunities/' + clusterId + '/validate', { method: 'POST' }).then(r => r.json());
        status.textContent = 'Found ' + result.new_posts_found + ' new posts. Score: ' + Math.round(result.updated_score);
        loadDashboard();
      } catch (e) {
        status.textContent = 'Failed: ' + e.message;
      } finally {
        btn.disabled = false;
      }
    }
    
    // Idea Validator
    document.getElementById('validate-btn').addEventListener('click', async () => {
      const idea = document.getElementById('idea-input').value.trim();
      if (!idea) return;
      
      const btn = document.getElementById('validate-btn');
      const resultDiv = document.getElementById('validation-result');
      
      btn.disabled = true;
      btn.textContent = 'Validating...';
      resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      
      try {
        const result = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea })
        }).then(r => r.json());
        
        const scoreClass = result.validation_score >= 70 ? 'strong' : result.validation_score >= 40 ? 'moderate' : 'weak';
        
        resultDiv.innerHTML = \`
          <div class="validator-result">
            <div class="validation-score-big \${scoreClass}">\${Math.round(result.validation_score)}</div>
            <div class="validation-verdict">\${result.verdict?.toUpperCase() || 'ANALYZED'} — Confidence: \${result.confidence}%</div>
            
            <div class="modal-section">
              <div class="section-title">Market Signals</div>
              <div class="tags">
                \${(result.market_signals || []).map(s => '<span class="tag">' + escapeHtml(s) + '</span>').join('') || '<span style="color:var(--text-dim)">None found</span>'}
              </div>
            </div>
            
            \${result.concerns?.length ? \`
              <div class="modal-section">
                <div class="section-title">Concerns</div>
                <div class="tags">
                  \${result.concerns.map(c => '<span class="tag" style="background:rgba(239,68,68,0.2)">' + escapeHtml(c) + '</span>').join('')}
                </div>
              </div>
            \` : ''}
            
            \${result.suggested_pivot ? \`
              <div class="modal-section">
                <div class="section-title">Suggested Pivot</div>
                <p>\${escapeHtml(result.suggested_pivot)}</p>
              </div>
            \` : ''}
            
            <div class="modal-section">
              <div class="section-title">Matching Pain Points (\${result.matching_pain_points?.length || 0})</div>
              \${(result.matching_pain_points || []).slice(0, 5).map(p => \`
                <div class="quote">
                  <div class="quote-text">"\${escapeHtml(p.problem || '')}"</div>
                  <div class="quote-source">r/\${p.subreddit} — \${p.persona || 'User'}</div>
                </div>
              \`).join('') || '<p style="color:var(--text-dim)">No direct matches found</p>'}
            </div>
          </div>
        \`;
      } catch (e) {
        resultDiv.innerHTML = '<p style="color:var(--danger)">Error: ' + e.message + '</p>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Validate Idea';
      }
    });
    
    async function loadValidations() {
      try {
        const result = await fetch('/api/validations').then(r => r.json());
        const container = document.getElementById('validations-list');
        
        if (!result.validations?.length) {
          container.innerHTML = '<p style="color:var(--text-dim)">No validations yet. Try validating an idea above!</p>';
          return;
        }
        
        container.innerHTML = result.validations.map(v => \`
          <div class="opp-card" style="margin-bottom:0.5rem">
            <div class="opp-header">
              <span>\${escapeHtml(v.idea_text?.slice(0, 60) || '')}...</span>
              <div class="opp-score"><span>\${Math.round(v.validation_score || 0)}</span></div>
            </div>
          </div>
        \`).join('');
      } catch (e) {
        console.error('Failed to load validations:', e);
      }
    }
    
    // Charts
    async function loadCharts() {
      try {
        const [scoreData, subredditData, scatterData] = await Promise.all([
          fetch('/api/charts/score-distribution').then(r => r.json()),
          fetch('/api/charts/subreddit-breakdown').then(r => r.json()),
          fetch('/api/charts/severity-frequency').then(r => r.json())
        ]);
        
        // Score Distribution
        if (charts.score) charts.score.destroy();
        charts.score = new Chart(document.getElementById('score-chart'), {
          type: 'bar',
          data: {
            labels: scoreData.data.map(d => d.range),
            datasets: [{
              label: 'Opportunities',
              data: scoreData.data.map(d => d.count),
              backgroundColor: 'rgba(139, 92, 246, 0.6)',
              borderColor: 'rgb(139, 92, 246)',
              borderWidth: 1
            }]
          },
          options: chartOptions('Count')
        });
        
        // Subreddit Breakdown
        if (charts.subreddit) charts.subreddit.destroy();
        charts.subreddit = new Chart(document.getElementById('subreddit-chart'), {
          type: 'doughnut',
          data: {
            labels: subredditData.data.slice(0, 10).map(d => 'r/' + d.subreddit),
            datasets: [{
              data: subredditData.data.slice(0, 10).map(d => d.count),
              backgroundColor: [
                '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6',
                '#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444'
              ]
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#888' } } }
          }
        });
        
        // Severity vs Frequency Scatter
        if (charts.scatter) charts.scatter.destroy();
        charts.scatter = new Chart(document.getElementById('scatter-chart'), {
          type: 'scatter',
          data: {
            datasets: [{
              label: 'Opportunities',
              data: scatterData.data.map(d => ({
                x: d.frequency_score || 0,
                y: d.severity_score || 0,
                r: Math.max(5, (d.member_count || 1) * 2)
              })),
              backgroundColor: 'rgba(139, 92, 246, 0.6)',
              borderColor: 'rgb(139, 92, 246)',
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { title: { display: true, text: 'Frequency', color: '#888' }, grid: { color: '#333' }, ticks: { color: '#888' } },
              y: { title: { display: true, text: 'Severity', color: '#888' }, grid: { color: '#333' }, ticks: { color: '#888' } }
            },
            plugins: { legend: { display: false } }
          }
        });
      } catch (e) {
        console.error('Failed to load charts:', e);
      }
    }
    
    function chartOptions(yLabel) {
      return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#333' }, ticks: { color: '#888' } },
          y: { title: { display: true, text: yLabel, color: '#888' }, grid: { color: '#333' }, ticks: { color: '#888' } }
        },
        plugins: { legend: { display: false } }
      };
    }
    
    // Admin
    async function loadAdminData() {
      try {
        const [detailed, subreddits] = await Promise.all([
          fetch('/api/stats/detailed').then(r => r.json()),
          fetch('/api/admin/subreddits').then(r => r.json())
        ]);
        
        document.getElementById('detailed-stats').innerHTML = \`
          <p>Posts: \${detailed.totals?.posts || 0}</p>
          <p>Comments: \${detailed.totals?.comments || 0}</p>
          <p>Pain Records: \${detailed.totals?.painRecords || 0}</p>
          <p>Clusters: \${detailed.totals?.clusters || 0}</p>
          <p>Pending: \${detailed.pendingPosts || 0} posts</p>
        \`;
        
        document.getElementById('subreddit-list').innerHTML = 
          subreddits.subreddits.map(s => 'r/' + s).join(', ');
      } catch (e) {
        console.error('Failed to load admin data:', e);
      }
    }
    
    async function triggerPipeline(step) {
      const status = document.getElementById('pipeline-status');
      status.textContent = 'Running ' + step + '...';
      
      try {
        const result = await fetch('/trigger/' + step, { method: 'POST' }).then(r => r.json());
        status.textContent = 'Status: ' + result.status;
        if (step === 'all' || step === 'score') loadDashboard();
      } catch (e) {
        status.textContent = 'Error: ' + e.message;
      }
    }
    
    async function resetData() {
      if (!confirm('Are you sure? This will delete ALL data.')) return;
      
      try {
        await fetch('/api/admin/reset', { method: 'POST' });
        alert('Data cleared!');
        loadDashboard();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
    
    // Utils
    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }
    
    // Init
    loadDashboard();
    setInterval(loadDashboard, 120000);
  </script>
</body>
</html>`;
}
