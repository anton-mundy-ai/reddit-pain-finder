// Reddit Pain Point Finder v10 - Main Worker Entry Point
// Architecture: Embedding-based semantic clustering + Trend Detection

import { Env, OpportunityBrief, Quote, PainPointView, TopicView } from './types';
import { runIngestion } from './layers/ingestion';
import { runExtraction } from './layers/extraction';
import { runTagging, getTopicStats } from './layers/tagging';
import { runClustering, getClusterMembers, mergeSimularClusters, updateClusterStats } from './layers/clustering';
import { runSynthesis } from './layers/synthesis';
import { runScoring, getTopOpportunities } from './layers/scoring';
import { runTopicMerge, shouldRunTopicMerge, incrementCronCount } from './layers/topic-merge';
import { runCompetitorMining, getCompetitorStats, getProductComplaints, getFeatureGaps, getCategoryStats, ALL_PRODUCTS, NICHE_VERTICALS } from './layers/competitor-mining';
import { runTrendSnapshot, getTrends, getTrendHistory, getHotTopics, getCoolingTopics, getTrendStats } from './layers/trend-detection';
import { generateEmbeddingsBatch, storeEmbedding } from './utils/embeddings';
import { normalizeTopic, extractBroadCategory } from './utils/normalize';

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
      version: 'v10-trends',
      timestamp: Date.now() 
    });
  }
  
  // ===============================
  // v10: Trend Detection Endpoints
  // ===============================
  
  // Get all trends with filtering
  if (path === '/api/trends') {
    try {
      const status = url.searchParams.get('status') as any || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const period = (url.searchParams.get('period') || '7d') as '7d' | '30d' | '90d';
      
      const [trends, stats] = await Promise.all([
        getTrends(env.DB, { status, limit, period }),
        getTrendStats(env.DB)
      ]);
      
      // Categorize trends by status
      const hot = trends.filter(t => t.trend_status === 'hot');
      const rising = trends.filter(t => t.trend_status === 'rising');
      const stable = trends.filter(t => t.trend_status === 'stable');
      const cooling = trends.filter(t => t.trend_status === 'cooling' || t.trend_status === 'cold');
      
      return jsonResponse({ 
        trends,
        categorized: { hot, rising, stable, cooling },
        stats
      });
    } catch (error) {
      console.error('Error fetching trends:', error);
      return jsonResponse({ error: 'Failed to fetch trends' }, 500);
    }
  }
  
  // Get hot/rising topics only
  if (path === '/api/trends/hot') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const hot = await getHotTopics(env.DB, limit);
      return jsonResponse({ hot_topics: hot });
    } catch (error) {
      console.error('Error fetching hot topics:', error);
      return jsonResponse({ error: 'Failed to fetch hot topics' }, 500);
    }
  }
  
  // Get cooling/declining topics
  if (path === '/api/trends/cooling') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const cooling = await getCoolingTopics(env.DB, limit);
      return jsonResponse({ cooling_topics: cooling });
    } catch (error) {
      console.error('Error fetching cooling topics:', error);
      return jsonResponse({ error: 'Failed to fetch cooling topics' }, 500);
    }
  }
  
  // Get trend history for a specific topic
  if (path.startsWith('/api/trends/history/')) {
    const topic = decodeURIComponent(path.split('/api/trends/history/')[1] || '');
    if (!topic) return jsonResponse({ error: 'Invalid topic' }, 400);
    
    try {
      const days = parseInt(url.searchParams.get('days') || '90');
      const history = await getTrendHistory(env.DB, topic, days);
      return jsonResponse({ history });
    } catch (error) {
      console.error('Error fetching trend history:', error);
      return jsonResponse({ error: 'Failed to fetch trend history' }, 500);
    }
  }
  
  // ===============================
  // v9: Competitor Mining Endpoints
  // ===============================
  
  // Get all competitors with complaint counts
  if (path === '/api/competitors') {
    try {
      const stats = await getCompetitorStats(env.DB);
      const categoryStats = await getCategoryStats(env.DB);
      
      return jsonResponse({ 
        competitors: stats,
        categories: categoryStats,
        products_tracked: ALL_PRODUCTS.length
      });
    } catch (error) {
      console.error('Error fetching competitor stats:', error);
      return jsonResponse({ error: 'Failed to fetch competitor stats' }, 500);
    }
  }
  
  // Get complaints for a specific product
  if (path.startsWith('/api/competitors/') && !path.includes('/feature-gaps')) {
    const product = decodeURIComponent(path.split('/').pop() || '');
    if (!product) return jsonResponse({ error: 'Invalid product' }, 400);
    
    try {
      const complaints = await getProductComplaints(env.DB, product, 100);
      const stats = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative,
          SUM(CASE WHEN sentiment = 'frustrated' THEN 1 ELSE 0 END) as frustrated,
          SUM(CASE WHEN feature_gap IS NOT NULL THEN 1 ELSE 0 END) as with_feature_gap,
          AVG(score) as avg_score
        FROM competitor_mentions WHERE product_name = ?
      `).bind(product).first();
      
      return jsonResponse({ 
        product,
        complaints,
        stats
      });
    } catch (error) {
      console.error('Error fetching product complaints:', error);
      return jsonResponse({ error: 'Failed to fetch product complaints' }, 500);
    }
  }
  
  // Get aggregated feature gaps
  if (path === '/api/feature-gaps') {
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    try {
      const gaps = await getFeatureGaps(env.DB, limit);
      return jsonResponse({ feature_gaps: gaps });
    } catch (error) {
      console.error('Error fetching feature gaps:', error);
      return jsonResponse({ error: 'Failed to fetch feature gaps' }, 500);
    }
  }

  // v7: Get opportunities with filter control
  if (path === '/api/opportunities') {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const minMentions = parseInt(url.searchParams.get('min') || '5');  // Default 5
    const showAll = url.searchParams.get('all') === 'true';           // Override filter

    try {
      const clusters = await getTopOpportunities(env.DB, limit, showAll ? 1 : minMentions);
      
      const opportunities: OpportunityBrief[] = clusters.map((c: any) => {
        const categoriesData = safeParseJSON(c.categories, {});
        return {
          id: c.id,
          product_name: c.product_name || 'Unnamed',
          tagline: c.tagline || '',
          how_it_works: safeParseJSON(c.how_it_works, []),
          target_customer: c.target_customer || '',
          version: c.version || 1,
          topic: c.topic || '',
          topic_canonical: c.topic_canonical || '',
          broad_category: c.broad_category || 'general',
          social_proof_count: c.social_proof_count || 0,
          subreddits: safeParseJSON(c.subreddits_list, []),
          personas: categoriesData.personas || [],
          top_quotes: safeParseJSON(c.top_quotes, []).slice(0, 3),
          total_quotes: c.social_proof_count || 0,
          total_score: c.total_score || 0,
          severity_breakdown: categoriesData.severity || {},
          avg_similarity: categoriesData.avgSimilarity || 0,
          updated_at: c.updated_at
        };
      });
      
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
        SELECT * FROM pain_clusters WHERE id = ?
      `).bind(id).first();

      if (!cluster) return jsonResponse({ error: 'Not found' }, 404);

      const members = await getClusterMembers(env.DB, id);
      
      const allQuotes: (Quote & { similarity?: number })[] = members.map(m => ({
        text: m.raw_quote || '',
        author: m.author || 'anonymous',
        subreddit: m.subreddit,
        persona: m.persona || undefined,
        severity: m.severity || undefined,
        similarity: m.cluster_similarity || undefined
      }));
      
      const subreddits = [...new Set(members.map(m => m.subreddit))];
      
      // v8: Use deduplicated personas from cluster categories
      const categoriesData = safeParseJSON((cluster as any).categories, {});
      const personas = categoriesData.personas || [...new Set(members.map(m => m.persona).filter(Boolean))].slice(0, 5);
      
      // Severity breakdown
      const severityBreakdown: Record<string, number> = {};
      for (const m of members) {
        const sev = m.severity || 'medium';
        severityBreakdown[sev] = (severityBreakdown[sev] || 0) + 1;
      }
      
      const detail = {
        id: (cluster as any).id,
        product_name: (cluster as any).product_name || 'Unnamed',
        tagline: (cluster as any).tagline || '',
        how_it_works: safeParseJSON((cluster as any).how_it_works, []),
        target_customer: (cluster as any).target_customer || '',
        version: (cluster as any).version || 1,
        topic: (cluster as any).topic || '',
        topic_canonical: (cluster as any).topic_canonical || '',
        broad_category: (cluster as any).broad_category || 'general',
        social_proof_count: (cluster as any).social_proof_count || 0,
        subreddits,
        personas,
        top_quotes: allQuotes.slice(0, 5),
        all_quotes: allQuotes,
        total_quotes: allQuotes.length,
        unique_authors: (cluster as any).unique_authors || 0,
        total_upvotes: (cluster as any).total_upvotes || 0,
        total_score: (cluster as any).total_score || 0,
        severity_breakdown: severityBreakdown,
        updated_at: (cluster as any).updated_at
      };

      return jsonResponse({ opportunity: detail });
    } catch (error) {
      console.error('Error fetching opportunity:', error);
      return jsonResponse({ error: 'Failed to fetch opportunity' }, 500);
    }
  }

  // Get all pain points for visualization
  if (path === '/api/painpoints') {
    const limit = parseInt(url.searchParams.get('limit') || '200');
    
    try {
      const result = await env.DB.prepare(`
        SELECT id, raw_quote, author, subreddit, topics, persona, severity, 
               source_score, cluster_id, normalized_topic, embedding_id
        FROM pain_records 
        WHERE topics IS NOT NULL
        ORDER BY extracted_at DESC
        LIMIT ?
      `).bind(limit).all();
      
      const painpoints: PainPointView[] = (result.results || []).map((r: any) => ({
        id: r.id,
        raw_quote: r.raw_quote?.slice(0, 200) || '',
        author: r.author || 'anonymous',
        subreddit: r.subreddit,
        topics: safeParseJSON(r.topics, []),
        persona: r.persona || 'unknown',
        severity: r.severity || 'medium',
        source_score: r.source_score || 0,
        cluster_id: r.cluster_id,
        normalized_topic: r.normalized_topic,
        has_embedding: !!r.embedding_id
      }));
      
      return jsonResponse({ painpoints });
    } catch (error) {
      console.error('Error fetching painpoints:', error);
      return jsonResponse({ error: 'Failed to fetch painpoints' }, 500);
    }
  }

  // Get topic stats for visualization
  if (path === '/api/topics') {
    try {
      // v8: Fetch all records with topics in one query for efficiency
      const allRecords = await env.DB.prepare(`
        SELECT topics, persona, subreddit, severity
        FROM pain_records 
        WHERE topics IS NOT NULL
      `).all();
      
      // Build topic stats from records
      const topicData = new Map<string, {
        count: number;
        personas: Set<string>;
        subreddits: Set<string>;
        severity: Record<string, number>;
      }>();
      
      for (const row of allRecords.results || []) {
        const r = row as any;
        let topics: string[] = [];
        try { topics = JSON.parse(r.topics || '[]'); } catch {}
        
        for (const topic of topics) {
          if (!topicData.has(topic)) {
            topicData.set(topic, {
              count: 0,
              personas: new Set(),
              subreddits: new Set(),
              severity: {}
            });
          }
          const data = topicData.get(topic)!;
          data.count++;
          if (r.persona) data.personas.add(r.persona);
          if (r.subreddit) data.subreddits.add(r.subreddit);
          const sev = r.severity || 'medium';
          data.severity[sev] = (data.severity[sev] || 0) + 1;
        }
      }
      
      // Convert to array format
      const topicsWithDetails: TopicView[] = [];
      for (const [topic, data] of topicData.entries()) {
        topicsWithDetails.push({
          topic,
          count: data.count,
          personas: [...data.personas].slice(0, 5),
          subreddits: [...data.subreddits],
          severity_breakdown: data.severity
        });
      }
      
      // Sort by count
      topicsWithDetails.sort((a, b) => b.count - a.count);
      
      return jsonResponse({ topics: topicsWithDetails });
    } catch (error) {
      console.error('Error fetching topics:', error);
      return jsonResponse({ error: 'Failed to fetch topics' }, 500);
    }
  }

  // v7: Enhanced stats endpoint
  if (path === '/api/stats') {
    try {
      const [postsCount, commentsCount, painRecordsCount, taggedCount, 
             clustersCount, productCount, embeddingsCount] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) as count FROM raw_posts").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM raw_comments").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM pain_records").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM pain_records WHERE tagged_at IS NOT NULL").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM pain_clusters").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM pain_clusters WHERE product_name IS NOT NULL AND social_proof_count >= 5").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM embeddings").first().catch(() => ({ count: 0 })),
      ]);

      // Topic stats
      const [topicCount, qualifyingClusters, hnCount, avgClusterSize] = await Promise.all([
        env.DB.prepare("SELECT COUNT(DISTINCT topic_canonical) as count FROM pain_clusters WHERE topic_canonical IS NOT NULL").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM pain_clusters WHERE social_proof_count >= 5").first(),
        env.DB.prepare("SELECT COUNT(*) as count FROM raw_comments WHERE subreddit = 'hackernews'").first(),
        env.DB.prepare("SELECT AVG(social_proof_count) as avg FROM pain_clusters WHERE social_proof_count > 0").first(),
      ]);

      // v9: Add competitor stats
      const competitorStats = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total_complaints,
          COUNT(DISTINCT product_name) as products_tracked,
          SUM(CASE WHEN feature_gap IS NOT NULL THEN 1 ELSE 0 END) as feature_gaps
        FROM competitor_mentions
      `).first().catch(() => ({ total_complaints: 0, products_tracked: 0, feature_gaps: 0 }));
      
      // v10: Add trend stats
      const trendStats = await getTrendStats(env.DB).catch(() => ({
        total_tracked: 0, hot_count: 0, rising_count: 0, stable_count: 0, cooling_count: 0, last_snapshot: null
      }));
      
      return jsonResponse({
        raw_posts: (postsCount as any)?.count || 0,
        raw_comments: (commentsCount as any)?.count || 0,
        hn_comments: (hnCount as any)?.count || 0,
        pain_records: (painRecordsCount as any)?.count || 0,
        tagged_records: (taggedCount as any)?.count || 0,
        embeddings: (embeddingsCount as any)?.count || 0,
        clusters: (clustersCount as any)?.count || 0,
        unique_topics: (topicCount as any)?.count || 0,
        qualifying_clusters: (qualifyingClusters as any)?.count || 0,  // 5+ members
        products_generated: (productCount as any)?.count || 0,
        avg_cluster_size: Math.round(((avgClusterSize as any)?.avg || 0) * 10) / 10,
        // v9: Competitor mining stats
        competitor_complaints: (competitorStats as any)?.total_complaints || 0,
        competitor_products: (competitorStats as any)?.products_tracked || 0,
        competitor_feature_gaps: (competitorStats as any)?.feature_gaps || 0,
        // v10: Trend stats
        trends_tracked: trendStats.total_tracked,
        trends_hot: trendStats.hot_count,
        trends_rising: trendStats.rising_count,
        trends_cooling: trendStats.cooling_count,
        last_trend_snapshot: trendStats.last_snapshot,
        version: 'v10-trends',
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
  if (path === '/api/trigger/tag' && request.method === 'POST') {
    const result = await runTagging(env);
    return jsonResponse({ 
      success: true, 
      result: {
        tagged: result.tagged,
        failed: result.failed,
        topics_created: Array.from(result.topics_created),
        personas_found: Array.from(result.personas_found)
      }
    });
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
  
  // v7: Topic merge endpoint
  if (path === '/api/trigger/merge' && request.method === 'POST') {
    const result = await runTopicMerge(env);
    return jsonResponse({ success: true, result });
  }
  
  // v7: Re-cluster existing data endpoint
  if (path === '/api/trigger/recluster' && request.method === 'POST') {
    const result = await reclusterExistingData(env);
    return jsonResponse({ success: true, result });
  }
  
  // v8: Fix cluster stats endpoint
  if (path === '/api/trigger/fix-stats' && request.method === 'POST') {
    const result = await fixAllClusterStats(env);
    return jsonResponse({ success: true, result });
  }
  
  if (path === '/api/trigger/full' && request.method === 'POST') {
    const results = await runFullPipeline(env);
    return jsonResponse({ success: true, results });
  }
  
  // v9: Competitor mining trigger
  if (path === '/api/trigger/mine-competitors' && request.method === 'POST') {
    const result = await runCompetitorMining(env);
    return jsonResponse({ success: true, result });
  }
  
  // v10: Trend snapshot trigger (manual)
  if (path === '/api/trigger/snapshot-trends' && request.method === 'POST') {
    const result = await runTrendSnapshot(env);
    return jsonResponse({ success: true, result });
  }
  
  // v10: Migration endpoint for pain_trends tables
  if (path === '/api/trigger/migrate-v10' && request.method === 'POST') {
    try {
      // Create pain_trends table
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS pain_trends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          topic_canonical TEXT NOT NULL,
          cluster_id INTEGER,
          snapshot_date TEXT NOT NULL,
          bucket_type TEXT DEFAULT 'daily',
          mention_count INTEGER NOT NULL,
          new_mentions INTEGER DEFAULT 0,
          velocity REAL,
          velocity_7d REAL,
          velocity_30d REAL,
          trend_status TEXT,
          is_spike INTEGER DEFAULT 0,
          avg_severity REAL,
          subreddit_spread INTEGER,
          created_at INTEGER NOT NULL,
          UNIQUE(topic_canonical, snapshot_date, bucket_type)
        )
      `).run();
      
      // Create indexes
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_trends_topic ON pain_trends(topic_canonical)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_trends_date ON pain_trends(snapshot_date DESC)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_trends_status ON pain_trends(trend_status)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_trends_velocity ON pain_trends(velocity DESC)`).run();
      
      // Create trend_summary table
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS trend_summary (
          topic_canonical TEXT PRIMARY KEY,
          cluster_id INTEGER,
          current_count INTEGER,
          current_velocity REAL,
          trend_status TEXT,
          peak_count INTEGER,
          peak_date TEXT,
          first_seen TEXT,
          last_updated INTEGER,
          sparkline TEXT
        )
      `).run();
      
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_summary_status ON trend_summary(trend_status)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_summary_velocity ON trend_summary(current_velocity DESC)`).run();
      
      // Add state tracking
      await env.DB.prepare(`
        INSERT OR IGNORE INTO processing_state (key, value, updated_at) VALUES ('last_trend_snapshot', '0', 0)
      `).run();
      
      return jsonResponse({ success: true, message: 'v10 migration complete - trend tables created' });
    } catch (error) {
      console.error('v10 migration error:', error);
      return jsonResponse({ error: `Migration failed: ${error}` }, 500);
    }
  }
  
  // v9.2: Migration endpoint for competitor_mentions table (with subreddit column)
  if (path === '/api/trigger/migrate-v9' && request.method === 'POST') {
    try {
      // Create table with all columns
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS competitor_mentions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_name TEXT NOT NULL,
          category TEXT,
          complaint_text TEXT NOT NULL,
          source_type TEXT,
          source_url TEXT,
          author TEXT,
          score INTEGER DEFAULT 0,
          sentiment TEXT,
          feature_gap TEXT,
          subreddit TEXT,
          created_at INTEGER NOT NULL,
          UNIQUE(source_url)
        )
      `).run();
      
      // Try to add subreddit column if it doesn't exist (for existing tables)
      try {
        await env.DB.prepare(`ALTER TABLE competitor_mentions ADD COLUMN subreddit TEXT`).run();
      } catch (e) {
        // Column already exists, ignore
      }
      
      // Create indexes
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_competitor_product ON competitor_mentions(product_name)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_competitor_category ON competitor_mentions(category)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_competitor_sentiment ON competitor_mentions(sentiment)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_competitor_score ON competitor_mentions(score DESC)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_competitor_subreddit ON competitor_mentions(subreddit)`).run();
      
      return jsonResponse({ success: true, message: 'v9.2 migration complete - competitor_mentions table with subreddit column' });
    } catch (error) {
      console.error('v9.2 migration error:', error);
      return jsonResponse({ error: `Migration failed: ${error}` }, 500);
    }
  }
  
  // Reset endpoint
  if (path === '/api/trigger/reset' && request.method === 'POST') {
    try {
      await env.DB.exec(`
        DELETE FROM cluster_members;
        DELETE FROM embeddings;
        DELETE FROM pain_clusters;
        DELETE FROM pain_records;
        DELETE FROM raw_comments;
        DELETE FROM raw_posts;
      `);
      return jsonResponse({ success: true, message: 'Data cleared for v7 fresh start' });
    } catch (error) {
      console.error('Reset error:', error);
      return jsonResponse({ error: 'Failed to reset' }, 500);
    }
  }
  
  // v7: Migration endpoint
  if (path === '/api/trigger/migrate-v7' && request.method === 'POST') {
    try {
      // Create embeddings table if not exists
      await env.DB.exec(`
        CREATE TABLE IF NOT EXISTS embeddings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pain_record_id INTEGER NOT NULL UNIQUE,
          vector TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_embeddings_record ON embeddings(pain_record_id);
      `);
      
      // Add columns if they don't exist (SQLite doesn't support IF NOT EXISTS for columns)
      const pragmaResult = await env.DB.prepare("PRAGMA table_info(pain_records)").all();
      const columns = (pragmaResult.results || []).map((r: any) => r.name);
      
      if (!columns.includes('embedding_id')) {
        await env.DB.exec("ALTER TABLE pain_records ADD COLUMN embedding_id INTEGER");
      }
      if (!columns.includes('normalized_topic')) {
        await env.DB.exec("ALTER TABLE pain_records ADD COLUMN normalized_topic TEXT");
      }
      
      const clusterPragma = await env.DB.prepare("PRAGMA table_info(pain_clusters)").all();
      const clusterColumns = (clusterPragma.results || []).map((r: any) => r.name);
      
      if (!clusterColumns.includes('topic_canonical')) {
        await env.DB.exec("ALTER TABLE pain_clusters ADD COLUMN topic_canonical TEXT");
      }
      if (!clusterColumns.includes('broad_category')) {
        await env.DB.exec("ALTER TABLE pain_clusters ADD COLUMN broad_category TEXT");
      }
      if (!clusterColumns.includes('centroid_embedding_id')) {
        await env.DB.exec("ALTER TABLE pain_clusters ADD COLUMN centroid_embedding_id INTEGER");
      }
      
      return jsonResponse({ success: true, message: 'v7 migration complete' });
    } catch (error) {
      console.error('Migration error:', error);
      return jsonResponse({ error: `Migration failed: ${error}` }, 500);
    }
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

/**
 * Re-cluster existing pain records with embeddings
 */
async function reclusterExistingData(env: Env): Promise<{
  processed: number;
  embeddings_generated: number;
  clusters_before: number;
  clusters_after: number;
}> {
  const db = env.DB;
  const apiKey = env.OPENAI_API_KEY;
  
  console.log('\n=== v7 Re-clustering Existing Data ===');
  
  const clustersBefore = await db.prepare(
    "SELECT COUNT(*) as cnt FROM pain_clusters"
  ).first() as { cnt: number };
  
  // Clear existing clusters
  await db.exec(`
    DELETE FROM cluster_members;
    DELETE FROM embeddings;
    DELETE FROM pain_clusters;
    UPDATE pain_records SET cluster_id = NULL, cluster_similarity = NULL, embedding_id = NULL;
  `);
  
  // Get all pain records with topics
  const records = await db.prepare(`
    SELECT id, raw_quote, topics FROM pain_records 
    WHERE topics IS NOT NULL AND raw_quote IS NOT NULL
    ORDER BY id
  `).all();
  
  const allRecords = records.results || [];
  console.log(`Found ${allRecords.length} records to re-cluster`);
  
  let processed = 0;
  let embeddingsGenerated = 0;
  
  // Process in batches of 20
  const batchSize = 20;
  for (let i = 0; i < allRecords.length; i += batchSize) {
    const batch = allRecords.slice(i, i + batchSize);
    const texts = batch.map((r: any) => r.raw_quote as string);
    
    console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(allRecords.length / batchSize)}...`);
    
    try {
      // Generate embeddings in batch
      const embeddings = await generateEmbeddingsBatch(apiKey, texts);
      embeddingsGenerated += embeddings.length;
      
      // Store each embedding and update record
      for (let j = 0; j < batch.length; j++) {
        const record = batch[j] as any;
        const embedding = embeddings[j];
        
        if (embedding && embedding.length === 1536) {
          const embeddingId = await storeEmbedding(db, record.id, embedding);
          
          // Parse topics and normalize
          let topics: string[] = [];
          try { topics = JSON.parse(record.topics); } catch {}
          const normalizedTopic = normalizeTopic(topics[0] || 'general');
          
          await db.prepare(`
            UPDATE pain_records 
            SET embedding_id = ?, normalized_topic = ? 
            WHERE id = ?
          `).bind(embeddingId, normalizedTopic, record.id).run();
          
          processed++;
        }
      }
    } catch (error) {
      console.error(`Error processing batch:`, error);
    }
  }
  
  // Now run clustering
  console.log('\nRunning semantic clustering...');
  await runClustering(env);
  
  // Merge similar clusters
  console.log('\nMerging similar clusters...');
  await mergeSimularClusters(env);
  
  const clustersAfter = await db.prepare(
    "SELECT COUNT(*) as cnt FROM pain_clusters"
  ).first() as { cnt: number };
  
  console.log(`\n=== Re-clustering Complete ===`);
  console.log(`Processed: ${processed}, Embeddings: ${embeddingsGenerated}`);
  console.log(`Clusters: ${clustersBefore.cnt} → ${clustersAfter.cnt}`);
  
  return {
    processed,
    embeddings_generated: embeddingsGenerated,
    clusters_before: clustersBefore.cnt,
    clusters_after: clustersAfter.cnt
  };
}

/**
 * Fix stats for all clusters
 */
async function fixAllClusterStats(env: Env): Promise<{ fixed: number }> {
  const db = env.DB;
  
  // Get all cluster IDs
  const clusters = await db.prepare(
    "SELECT id FROM pain_clusters"
  ).all();
  
  const clusterIds = (clusters.results || []).map((c: any) => c.id);
  console.log(`Fixing stats for ${clusterIds.length} clusters...`);
  
  let fixed = 0;
  for (const clusterId of clusterIds) {
    await updateClusterStats(db, clusterId);
    fixed++;
  }
  
  console.log(`Fixed ${fixed} cluster stats`);
  return { fixed };
}

async function runFullPipeline(env: Env): Promise<any> {
  const results: any = { version: 'v10' };
  
  console.log('\n========================================');
  console.log('Running v10 Pipeline: Trends + Competitor Mining + Clustering');
  console.log('========================================\n');
  
  // Increment cron counter for topic merge scheduling
  const cronCount = await incrementCronCount(env.DB);
  results.cron_count = cronCount;
  
  // v8: Run ingestion TWICE for more data
  console.log('Step 1a: First ingestion pass (Reddit + HN)...');
  const ingestion1 = await runIngestion(env);
  
  console.log('\nStep 1b: Second ingestion pass (different sort orders)...');
  const ingestion2 = await runIngestion(env);
  
  results.ingestion = {
    posts_ingested: ingestion1.posts_ingested + ingestion2.posts_ingested,
    comments_ingested: ingestion1.comments_ingested + ingestion2.comments_ingested,
    hn_comments_ingested: ingestion1.hn_comments_ingested + ingestion2.hn_comments_ingested,
    subreddits_processed: ingestion1.subreddits_processed + ingestion2.subreddits_processed
  };
  
  // v9: Run competitor mining every 3rd cron (after ingestion)
  if (cronCount % 3 === 0) {
    console.log('\nStep 1.5: Competitor complaint mining (every 3rd cron)...');
    results.competitor_mining = await runCompetitorMining(env);
  }
  
  console.log('\nStep 2: Binary filter (Nano)...');
  results.extraction = await runExtraction(env);
  
  console.log('\nStep 3: Quality tagging (GPT-5.2)...');
  const tagging = await runTagging(env);
  results.tagging = {
    tagged: tagging.tagged,
    failed: tagging.failed,
    unique_topics: tagging.topics_created.size,
    unique_personas: tagging.personas_found.size
  };
  
  console.log('\nStep 4: Semantic clustering (embeddings, threshold=0.65)...');
  results.clustering = await runClustering(env);
  
  // Run topic merge every 6th cron
  if (await shouldRunTopicMerge(env.DB)) {
    console.log('\nStep 4.5: Topic merge pass (every 6th cron)...');
    results.topic_merge = await runTopicMerge(env);
  }
  
  console.log('\nStep 5: Product synthesis (5+ members, auto-iterate on growth)...');
  results.synthesis = await runSynthesis(env);
  
  console.log('\nStep 6: Scoring...');
  results.scoring = await runScoring(env);
  
  // v10: Run trend snapshot daily (every cron, but data is deduplicated by date)
  console.log('\nStep 7: Trend snapshot...');
  results.trends = await runTrendSnapshot(env);
  
  console.log('\n========================================');
  console.log('v10 Pipeline Complete!');
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
