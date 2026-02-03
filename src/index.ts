// Reddit Pain Point Finder v18 - Main Worker Entry Point
// Architecture: Embedding-based semantic clustering + Trend Detection + Market Sizing + MVP Features + Real-time Alerts

import { Env, OpportunityBrief, Quote, PainPointView, TopicView, AuthContext } from './types';
import { runIngestion } from './layers/ingestion';
import { runExtraction } from './layers/extraction';
import { runTagging, getTopicStats } from './layers/tagging';
import { runClustering, getClusterMembers, mergeSimularClusters, updateClusterStats } from './layers/clustering';
import { runSynthesis } from './layers/synthesis';
import { runScoring, getTopOpportunities } from './layers/scoring';
import { runTopicMerge, shouldRunTopicMerge, incrementCronCount } from './layers/topic-merge';
import { runCompetitorMining, getCompetitorStats, getProductComplaints, getFeatureGaps, getCategoryStats, ALL_PRODUCTS, NICHE_VERTICALS } from './layers/competitor-mining';
import { runTrendSnapshot, getTrends, getTrendHistory, getHotTopics, getCoolingTopics, getTrendStats } from './layers/trend-detection';
import { runMarketSizing, getMarketEstimate, getAllMarketEstimates, getMarketSizingStats } from './layers/market-sizing';
import { runMVPFeatureExtraction, getOpportunityFeatures, getAllFeatures, getFeatureStats, FeatureType } from './layers/mvp-features';
import { runAlertChecks, getAlerts, getUnreadCount, markAlertRead, markAllAlertsRead, getAlertStats, AlertType } from './layers/alerts';
import { runLandingGeneration, getLandingPage, getAllLandingPages, getLandingStats, generateLandingForOpportunity } from './layers/landing-generator';
import { runOutreachListBuilder, getOutreachList, getOutreachStats, updateOutreachStatus, exportOutreachCSV, buildOutreachList, generateOutreachTemplates, OutreachStatus } from './layers/outreach';
import { runGeoAnalysis, getGeoStats, getOpportunitiesByRegion, getClusterRegionBreakdown, REGION_INFO, RegionCode } from './layers/geo-analysis';
import { generateEmbeddingsBatch, storeEmbedding } from './utils/embeddings';
import { normalizeTopic, extractBroadCategory } from './utils/normalize';
import { getAuthContext, getUserStats, logActivity, isPublicRoute } from './utils/auth';

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
      version: 'v18-auth',
      timestamp: Date.now() 
    });
  }
  
  // ===============================
  // v18: Auth & User Endpoints
  // ===============================
  
  // Get current user (from Cloudflare Access JWT)
  if (path === '/api/me') {
    try {
      const auth = await getAuthContext(request, env.DB);
      
      if (!auth.isAuthenticated) {
        return jsonResponse({ 
          authenticated: false,
          message: 'Not authenticated. Access this page through Cloudflare Access.'
        });
      }
      
      return jsonResponse({
        authenticated: true,
        user: auth.user ? {
          id: auth.user.id,
          email: auth.user.email,
          plan: auth.user.plan,
          first_seen: auth.user.first_seen,
          last_seen: auth.user.last_seen,
          preferences: auth.user.preferences
        } : { email: auth.email }
      });
    } catch (error) {
      console.error('Error getting user:', error);
      return jsonResponse({ error: 'Failed to get user info' }, 500);
    }
  }
  
  // Update user preferences
  if (path === '/api/me/preferences' && request.method === 'POST') {
    try {
      const auth = await getAuthContext(request, env.DB);
      if (!auth.isAuthenticated || !auth.user) {
        return jsonResponse({ error: 'Not authenticated' }, 401);
      }
      
      const body = await request.json() as { preferences: Record<string, any> };
      const newPrefs = { ...auth.user.preferences, ...body.preferences };
      
      await env.DB.prepare(
        'UPDATE users SET preferences = ? WHERE id = ?'
      ).bind(JSON.stringify(newPrefs), auth.user.id).run();
      
      return jsonResponse({ success: true, preferences: newPrefs });
    } catch (error) {
      console.error('Error updating preferences:', error);
      return jsonResponse({ error: 'Failed to update preferences' }, 500);
    }
  }
  
  // Get user stats (admin endpoint)
  if (path === '/api/users/stats') {
    try {
      const auth = await getAuthContext(request, env.DB);
      // In future, could restrict to admin users
      
      const stats = await getUserStats(env.DB);
      return jsonResponse({ stats });
    } catch (error) {
      console.error('Error getting user stats:', error);
      return jsonResponse({ error: 'Failed to get user stats' }, 500);
    }
  }
  
  // Cloudflare Access logout URL
  if (path === '/api/logout') {
    // Return the logout URL - frontend should redirect to this
    return jsonResponse({
      logout_url: 'https://ideas.koda-software.com/cdn-cgi/access/logout'
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
  // v18: Real-time Alerts Endpoints
  // ===============================
  
  // Get alerts with filtering
  if (path === '/api/alerts') {
    try {
      const type = url.searchParams.get('type') as AlertType | null;
      const unreadOnly = url.searchParams.get('unread') === 'true';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      
      const [alerts, stats] = await Promise.all([
        getAlerts(env.DB, { 
          type: type || undefined, 
          unreadOnly, 
          limit, 
          offset 
        }),
        getAlertStats(env.DB)
      ]);
      
      return jsonResponse({ alerts, stats });
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return jsonResponse({ error: 'Failed to fetch alerts' }, 500);
    }
  }
  
  // Get unread count (lightweight endpoint for polling)
  if (path === '/api/alerts/count') {
    try {
      const count = await getUnreadCount(env.DB);
      return jsonResponse({ unread: count });
    } catch (error) {
      console.error('Error fetching alert count:', error);
      return jsonResponse({ error: 'Failed to fetch alert count' }, 500);
    }
  }
  
  // Mark single alert as read
  if (path.match(/^\/api\/alerts\/\d+\/read$/) && request.method === 'POST') {
    const id = parseInt(path.split('/')[3]);
    if (!id) return jsonResponse({ error: 'Invalid ID' }, 400);
    
    try {
      const success = await markAlertRead(env.DB, id);
      return jsonResponse({ success, id });
    } catch (error) {
      console.error('Error marking alert read:', error);
      return jsonResponse({ error: 'Failed to mark alert read' }, 500);
    }
  }
  
  // Mark all alerts as read
  if (path === '/api/alerts/read-all' && request.method === 'POST') {
    try {
      const count = await markAllAlertsRead(env.DB);
      return jsonResponse({ success: true, marked: count });
    } catch (error) {
      console.error('Error marking all alerts read:', error);
      return jsonResponse({ error: 'Failed to mark alerts read' }, 500);
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
  
  // ===============================
  // v11: Market Sizing Endpoints
  // ===============================
  
  // Get all market estimates with stats
  if (path === '/api/market') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const sortBy = url.searchParams.get('sort') || 'tam';  // tam, som, confidence
      
      const [estimates, stats] = await Promise.all([
        getAllMarketEstimates(env.DB, limit),
        getMarketSizingStats(env.DB)
      ]);
      
      // Sort if needed
      if (sortBy === 'som') {
        estimates.sort((a: any, b: any) => b.som_estimate - a.som_estimate);
      } else if (sortBy === 'confidence') {
        estimates.sort((a: any, b: any) => b.confidence - a.confidence);
      }
      
      return jsonResponse({ estimates, stats });
    } catch (error) {
      console.error('Error fetching market estimates:', error);
      return jsonResponse({ error: 'Failed to fetch market estimates' }, 500);
    }
  }
  
  // Get market estimate for a specific opportunity
  if (path.startsWith('/api/market/')) {
    const id = parseInt(path.split('/').pop() || '0');
    if (!id) return jsonResponse({ error: 'Invalid ID' }, 400);
    
    try {
      const estimate = await getMarketEstimate(env.DB, id);
      if (!estimate) {
        return jsonResponse({ error: 'No market estimate found', cluster_id: id }, 404);
      }
      return jsonResponse({ estimate });
    } catch (error) {
      console.error('Error fetching market estimate:', error);
      return jsonResponse({ error: 'Failed to fetch market estimate' }, 500);
    }
  }
  
  // ===============================
  // v12: MVP Feature Endpoints
  // ===============================
  
  // Get all features across opportunities
  if (path === '/api/features') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const type = url.searchParams.get('type') as FeatureType | undefined;
      
      const [features, stats] = await Promise.all([
        getAllFeatures(env.DB, limit, type || undefined),
        getFeatureStats(env.DB)
      ]);
      
      return jsonResponse({ features, stats });
    } catch (error) {
      console.error('Error fetching features:', error);
      return jsonResponse({ error: 'Failed to fetch features' }, 500);
    }
  }
  
  // Get features for a specific opportunity
  if (path.match(/^\/api\/opportunities\/\d+\/features$/)) {
    const id = parseInt(path.split('/')[3]);
    if (!id) return jsonResponse({ error: 'Invalid ID' }, 400);
    
    try {
      const features = await getOpportunityFeatures(env.DB, id);
      
      // Group by type for easier frontend consumption
      const grouped = {
        must_have: features.filter(f => f.feature_type === 'must_have'),
        nice_to_have: features.filter(f => f.feature_type === 'nice_to_have'),
        differentiator: features.filter(f => f.feature_type === 'differentiator')
      };
      
      return jsonResponse({ 
        features, 
        grouped,
        total: features.length 
      });
    } catch (error) {
      console.error('Error fetching opportunity features:', error);
      return jsonResponse({ error: 'Failed to fetch opportunity features' }, 500);
    }
  }
  
  // ===============================
  // v15: Outreach List Endpoints
  // ===============================
  
  // Get outreach list for a specific opportunity
  if (path.match(/^\/api\/opportunities\/\d+\/outreach$/)) {
    const id = parseInt(path.split('/')[3]);
    if (!id) return jsonResponse({ error: 'Invalid ID' }, 400);
    
    try {
      const status = url.searchParams.get('status') as OutreachStatus | undefined;
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const sortBy = url.searchParams.get('sort') as 'fit_score' | 'recency' | 'engagement' || 'fit_score';
      
      // Build the list first (ensures it's up to date)
      await buildOutreachList(env.DB, id);
      
      const [contacts, stats] = await Promise.all([
        getOutreachList(env.DB, id, { status, limit, sortBy }),
        getOutreachStats(env.DB, id)
      ]);
      
      // Get opportunity info for templates
      const opp = await env.DB.prepare(`
        SELECT product_name, tagline, target_customer FROM pain_clusters WHERE id = ?
      `).bind(id).first() as any;
      
      // Generate template if we have contacts
      const templates = contacts.length > 0 && opp
        ? generateOutreachTemplates(
            opp.product_name || 'Unknown Product',
            opp.tagline || '',
            opp.target_customer || '',
            contacts[0].pain_expressed
          )
        : [];
      
      return jsonResponse({ 
        contacts, 
        stats,
        templates
      });
    } catch (error) {
      console.error('Error fetching outreach list:', error);
      return jsonResponse({ error: 'Failed to fetch outreach list' }, 500);
    }
  }
  
  // Export outreach list as CSV
  if (path === '/api/outreach/export') {
    try {
      const opportunityId = url.searchParams.get('opportunity_id');
      const csv = await exportOutreachCSV(
        env.DB, 
        opportunityId ? parseInt(opportunityId) : undefined
      );
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="outreach-${Date.now()}.csv"`,
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error exporting outreach:', error);
      return jsonResponse({ error: 'Failed to export outreach list' }, 500);
    }
  }
  
  // Update outreach contact status
  if (path.match(/^\/api\/outreach\/\d+\/status$/) && request.method === 'POST') {
    const id = parseInt(path.split('/')[3]);
    if (!id) return jsonResponse({ error: 'Invalid ID' }, 400);
    
    try {
      const body = await request.json() as { status: OutreachStatus; notes?: string };
      
      if (!['pending', 'contacted', 'responded', 'declined'].includes(body.status)) {
        return jsonResponse({ error: 'Invalid status' }, 400);
      }
      
      const success = await updateOutreachStatus(env.DB, id, body.status, body.notes);
      
      if (success) {
        return jsonResponse({ success: true, message: 'Status updated' });
      } else {
        return jsonResponse({ error: 'Failed to update status' }, 500);
      }
    } catch (error) {
      console.error('Error updating outreach status:', error);
      return jsonResponse({ error: 'Failed to update status' }, 500);
    }
  }
  
  // Get outreach stats across all opportunities
  if (path === '/api/outreach/stats') {
    try {
      const result = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN outreach_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN outreach_status = 'contacted' THEN 1 ELSE 0 END) as contacted,
          SUM(CASE WHEN outreach_status = 'responded' THEN 1 ELSE 0 END) as responded,
          SUM(CASE WHEN outreach_status = 'declined' THEN 1 ELSE 0 END) as declined,
          AVG(fit_score) as avg_fit_score,
          COUNT(DISTINCT opportunity_id) as opportunities_with_contacts
        FROM outreach_contacts
      `).first();
      
      return jsonResponse({ stats: result });
    } catch (error) {
      console.error('Error fetching outreach stats:', error);
      return jsonResponse({ error: 'Failed to fetch outreach stats' }, 500);
    }
  }
  
  // ===============================
  // v13: Landing Page Endpoints
  // ===============================
  
  // Get all landing pages
  if (path === '/api/landings') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      
      const [landings, stats] = await Promise.all([
        getAllLandingPages(env.DB, limit),
        getLandingStats(env.DB)
      ]);
      
      return jsonResponse({ landings, stats });
    } catch (error) {
      console.error('Error fetching landing pages:', error);
      return jsonResponse({ error: 'Failed to fetch landing pages' }, 500);
    }
  }
  
  // Get landing page for a specific opportunity
  if (path.match(/^\/api\/opportunities\/\d+\/landing$/)) {
    const id = parseInt(path.split('/')[3]);
    if (!id) return jsonResponse({ error: 'Invalid ID' }, 400);
    
    try {
      const landing = await getLandingPage(env.DB, id);
      
      if (!landing) {
        return jsonResponse({ error: 'No landing page found', opportunity_id: id }, 404);
      }
      
      // Parse JSON fields for frontend
      let benefits = [];
      let socialProof = { mention_count: 0, sources: [], quotes: [] };
      try { benefits = JSON.parse(landing.benefits || '[]'); } catch {}
      try { socialProof = JSON.parse(landing.social_proof || '{}'); } catch {}
      
      return jsonResponse({ 
        landing: {
          ...landing,
          benefits,
          social_proof: socialProof
        }
      });
    } catch (error) {
      console.error('Error fetching landing page:', error);
      return jsonResponse({ error: 'Failed to fetch landing page' }, 500);
    }
  }

  // ===============================
  // v16: Geographic Analysis Endpoints
  // ===============================
  
  // Get geo stats - pain points by region
  if (path === '/api/geo/stats') {
    try {
      const stats = await getGeoStats(env.DB);
      return jsonResponse({ 
        ...stats, 
        regions_info: REGION_INFO 
      });
    } catch (error) {
      console.error('Error fetching geo stats:', error);
      return jsonResponse({ error: 'Failed to fetch geo stats' }, 500);
    }
  }
  
  // Get opportunities by region
  if (path.match(/^\/api\/geo\/[A-Z]{2,6}$/)) {
    const region = path.split('/').pop()?.toUpperCase() as RegionCode;
    if (!['AU', 'US', 'UK', 'EU', 'GLOBAL'].includes(region)) {
      return jsonResponse({ error: 'Invalid region. Use: AU, US, UK, EU, GLOBAL' }, 400);
    }
    
    try {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const opportunities = await getOpportunitiesByRegion(env.DB, region, limit);
      
      // Parse JSON fields for each opportunity
      const formatted = opportunities.map((o: any) => ({
        ...o,
        how_it_works: safeParseJSON(o.how_it_works, []),
        subreddits: safeParseJSON(o.subreddits_list, []),
        top_quotes: safeParseJSON(o.top_quotes, []).slice(0, 3),
        categories: safeParseJSON(o.categories, {}),
      }));
      
      return jsonResponse({ 
        region,
        region_info: REGION_INFO[region],
        opportunities: formatted,
        count: formatted.length
      });
    } catch (error) {
      console.error('Error fetching opportunities by region:', error);
      return jsonResponse({ error: 'Failed to fetch opportunities by region' }, 500);
    }
  }
  
  // Get region breakdown for a specific opportunity
  if (path.match(/^\/api\/opportunities\/\d+\/geo$/)) {
    const id = parseInt(path.split('/')[3]);
    if (!id) return jsonResponse({ error: 'Invalid ID' }, 400);
    
    try {
      const breakdown = await getClusterRegionBreakdown(env.DB, id);
      const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
      
      const percentages: Record<string, number> = {};
      for (const [region, count] of Object.entries(breakdown)) {
        percentages[region] = total > 0 ? Math.round((count / total) * 100) : 0;
      }
      
      return jsonResponse({ 
        breakdown,
        percentages,
        total,
        regions_info: REGION_INFO
      });
    } catch (error) {
      console.error('Error fetching opportunity geo breakdown:', error);
      return jsonResponse({ error: 'Failed to fetch geo breakdown' }, 500);
    }
  }

  // v12: Get opportunities with filter control and market data
  // v16: Added region filter
  if (path === '/api/opportunities') {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const minMentions = parseInt(url.searchParams.get('min') || '5');  // Default 5
    const showAll = url.searchParams.get('all') === 'true';           // Override filter
    const sortBy = url.searchParams.get('sort') || 'mentions';        // mentions, score, market
    const region = url.searchParams.get('region')?.toUpperCase() as RegionCode | null;  // v16: region filter

    try {
      let clusters;
      
      if (region && ['AU', 'US', 'UK', 'EU', 'GLOBAL'].includes(region)) {
        // v16: Filter by region - get clusters where this region is dominant
        clusters = await env.DB.prepare(`
          SELECT c.*, 
                 m.tam_estimate, m.tam_tier, m.sam_tier, m.som_tier,
                 m.confidence as market_confidence, m.category as market_category,
                 (SELECT COUNT(*) FROM pain_records pr WHERE pr.cluster_id = c.id AND pr.geo_region = ?) as region_count,
                 ROUND((SELECT COUNT(*) FROM pain_records pr WHERE pr.cluster_id = c.id AND pr.geo_region = ?) * 100.0 / 
                       NULLIF(c.social_proof_count, 0), 1) as region_percentage
          FROM pain_clusters c
          LEFT JOIN market_estimates m ON c.id = m.cluster_id
          WHERE c.product_name IS NOT NULL
            AND c.social_proof_count >= ?
            AND EXISTS (SELECT 1 FROM pain_records pr WHERE pr.cluster_id = c.id AND pr.geo_region = ?)
          ORDER BY region_percentage DESC,
                   ${sortBy === 'market' ? 'COALESCE(m.tam_estimate, 0) DESC,' : ''} 
                   ${sortBy === 'score' ? 'c.total_score DESC,' : ''} 
                   c.social_proof_count DESC
          LIMIT ?
        `).bind(region, region, showAll ? 1 : minMentions, region, limit).all();
      } else {
        // v11: Original query - join with market estimates
        clusters = await env.DB.prepare(`
          SELECT c.*, 
                 m.tam_estimate, m.tam_tier, m.sam_tier, m.som_tier,
                 m.confidence as market_confidence, m.category as market_category
          FROM pain_clusters c
          LEFT JOIN market_estimates m ON c.id = m.cluster_id
          WHERE c.product_name IS NOT NULL
            AND c.social_proof_count >= ?
          ORDER BY ${sortBy === 'market' ? 'COALESCE(m.tam_estimate, 0) DESC,' : ''} 
                   ${sortBy === 'score' ? 'c.total_score DESC,' : ''} 
                   c.social_proof_count DESC
          LIMIT ?
        `).bind(showAll ? 1 : minMentions, limit).all();
      }
      
      const opportunities = (clusters.results || []).map((c: any) => {
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
          updated_at: c.updated_at,
          // v11: Market sizing data
          market: c.tam_estimate ? {
            tam_tier: c.tam_tier,
            sam_tier: c.sam_tier,
            som_tier: c.som_tier,
            tam_estimate: c.tam_estimate,
            confidence: c.market_confidence,
            category: c.market_category
          } : null,
          // v16: Region data (when filtering by region)
          region_count: c.region_count || null,
          region_percentage: c.region_percentage || null
        };
      });
      
      return jsonResponse({ 
        opportunities,
        // v16: Include region filter info in response
        filter: region ? { region, region_info: REGION_INFO[region] } : null
      });
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
  // v22: Added pagination support
  if (path === '/api/topics') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const page = parseInt(url.searchParams.get('page') || '1');
      const offset = (page - 1) * limit;
      
      // v8: Fetch all records with topics in one query for efficiency
      // Note: We need to aggregate in JS because topics is a JSON array field
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
      const allTopics: TopicView[] = [];
      for (const [topic, data] of topicData.entries()) {
        allTopics.push({
          topic,
          count: data.count,
          personas: [...data.personas].slice(0, 5),
          subreddits: [...data.subreddits],
          severity_breakdown: data.severity
        });
      }
      
      // Sort by count descending
      allTopics.sort((a, b) => b.count - a.count);
      
      // Apply pagination
      const total = allTopics.length;
      const paginatedTopics = allTopics.slice(offset, offset + limit);
      const totalPages = Math.ceil(total / limit);
      
      return jsonResponse({ 
        topics: paginatedTopics,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages
        }
      });
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
      
      // v23: Aggregate author/upvote stats using proper COUNT(DISTINCT) and SUM
      const aggregateStats = await env.DB.prepare(`
        SELECT 
          COUNT(DISTINCT author) as unique_authors,
          COALESCE(SUM(source_score), 0) as total_upvotes,
          COUNT(DISTINCT subreddit) as unique_subreddits
        FROM pain_records 
        WHERE author IS NOT NULL AND author != '[deleted]' AND author != 'AutoModerator'
      `).first().catch(() => ({ unique_authors: 0, total_upvotes: 0, unique_subreddits: 0 }));
      
      // v23: Cluster score aggregates
      const clusterScoreStats = await env.DB.prepare(`
        SELECT 
          COALESCE(SUM(total_score), 0) as total_score_sum,
          COALESCE(AVG(total_score), 0) as avg_score,
          COALESCE(SUM(total_upvotes), 0) as cluster_upvotes_sum,
          COALESCE(SUM(unique_authors), 0) as cluster_authors_sum
        FROM pain_clusters 
        WHERE product_name IS NOT NULL AND social_proof_count >= 5
      `).first().catch(() => ({ total_score_sum: 0, avg_score: 0, cluster_upvotes_sum: 0, cluster_authors_sum: 0 }));

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
      
      // v11: Add market sizing stats
      const marketStats = await getMarketSizingStats(env.DB).catch(() => ({
        total_estimated: 0, by_tier: {}, by_category: {}, avg_confidence: 0
      }));
      
      // v12: Add MVP feature stats
      const featureStats = await getFeatureStats(env.DB).catch(() => ({
        total_features: 0, by_type: {}, opportunities_with_features: 0, avg_features_per_opportunity: 0, top_priority_features: 0
      }));
      
      // v18: Add alert stats
      const alertStats = await getAlertStats(env.DB).catch(() => ({
        total: 0, unread: 0, by_type: {}, by_severity: {}, recent_24h: 0
      }));
      
      // v15: Add outreach stats
      const outreachStats = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN outreach_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN outreach_status = 'contacted' THEN 1 ELSE 0 END) as contacted,
          SUM(CASE WHEN outreach_status = 'responded' THEN 1 ELSE 0 END) as responded,
          COUNT(DISTINCT opportunity_id) as opportunities_with_contacts
        FROM outreach_contacts
      `).first().catch(() => ({ total: 0, pending: 0, contacted: 0, responded: 0, opportunities_with_contacts: 0 }));
      
      // v13: Add landing page stats
      const landingStats = await getLandingStats(env.DB).catch(() => ({
        total_generated: 0, opportunities_with_landing: 0, avg_version: 1, last_generated: null
      }));
      
      // v16: Add geo stats
      const geoStats = await getGeoStats(env.DB).catch(() => ({
        regions: [], total: 0
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
        // v11: Market sizing stats
        market_estimated: marketStats.total_estimated,
        market_by_tier: marketStats.by_tier,
        market_avg_confidence: Math.round((marketStats.avg_confidence || 0) * 100) / 100,
        // v12: MVP feature stats
        mvp_features_total: featureStats.total_features,
        mvp_features_by_type: featureStats.by_type,
        mvp_opportunities_with_features: featureStats.opportunities_with_features,
        mvp_avg_features_per_opp: featureStats.avg_features_per_opportunity,
        mvp_top_priority_features: featureStats.top_priority_features,
        // v18: Alert stats
        alerts_total: alertStats.total,
        alerts_unread: alertStats.unread,
        alerts_by_type: alertStats.by_type,
        alerts_recent_24h: alertStats.recent_24h,
        // v15: Outreach stats
        outreach_total: (outreachStats as any)?.total || 0,
        outreach_pending: (outreachStats as any)?.pending || 0,
        outreach_contacted: (outreachStats as any)?.contacted || 0,
        outreach_responded: (outreachStats as any)?.responded || 0,
        outreach_opportunities: (outreachStats as any)?.opportunities_with_contacts || 0,
        // v13: Landing page stats
        landing_pages_total: landingStats.total_generated,
        landing_pages_opportunities: landingStats.opportunities_with_landing,
        landing_pages_avg_version: landingStats.avg_version,
        landing_pages_last_generated: landingStats.last_generated,
        // v16: Geo stats
        geo_tagged: geoStats.total,
        geo_by_region: Object.fromEntries(geoStats.regions.map(r => [r.region, r.pain_count])),
        geo_regions: geoStats.regions,
        // v23: Aggregate engagement stats
        unique_authors: (aggregateStats as any)?.unique_authors || 0,
        total_upvotes: (aggregateStats as any)?.total_upvotes || 0,
        unique_subreddits: (aggregateStats as any)?.unique_subreddits || 0,
        cluster_total_score: (clusterScoreStats as any)?.total_score_sum || 0,
        cluster_avg_score: Math.round(((clusterScoreStats as any)?.avg_score || 0) * 10) / 10,
        version: 'v23-stats',
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
  
  // v16: Geo analysis endpoint
  if (path === '/api/trigger/geo-analyze' && request.method === 'POST') {
    const result = await runGeoAnalysis(env);
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
  
  // v11: Market sizing trigger
  if (path === '/api/trigger/estimate-markets' && request.method === 'POST') {
    const result = await runMarketSizing(env);
    return jsonResponse({ success: true, result });
  }
  
  // v12: MVP Feature extraction trigger
  if (path === '/api/trigger/extract-features' && request.method === 'POST') {
    const result = await runMVPFeatureExtraction(env);
    return jsonResponse({ success: true, result });
  }
  
  // v13: Generate all landing pages trigger
  if (path === '/api/trigger/generate-all-landings' && request.method === 'POST') {
    const result = await runLandingGeneration(env);
    return jsonResponse({ success: true, result });
  }
  
  // v13: Generate landing page for specific opportunity
  if (path.match(/^\/api\/trigger\/generate-landing\/\d+$/) && request.method === 'POST') {
    const id = parseInt(path.split('/').pop() || '0');
    if (!id) return jsonResponse({ error: 'Invalid ID' }, 400);
    
    try {
      const landing = await generateLandingForOpportunity(env.DB, env.OPENAI_API_KEY, id);
      if (!landing) {
        return jsonResponse({ error: 'Failed to generate landing page', opportunity_id: id }, 500);
      }
      
      // Parse JSON fields for response
      let benefits = [];
      let socialProof = { mention_count: 0, sources: [], quotes: [] };
      try { benefits = JSON.parse(landing.benefits || '[]'); } catch {}
      try { socialProof = JSON.parse(landing.social_proof || '{}'); } catch {}
      
      return jsonResponse({ 
        success: true, 
        landing: {
          ...landing,
          benefits,
          social_proof: socialProof
        }
      });
    } catch (error) {
      console.error('Error generating landing page:', error);
      return jsonResponse({ error: `Failed to generate landing page: ${error}` }, 500);
    }
  }
  
  // v15: Outreach list builder trigger
  if (path === '/api/trigger/build-outreach' && request.method === 'POST') {
    const result = await runOutreachListBuilder(env);
    return jsonResponse({ success: true, result });
  }
  
  // v15: Migration endpoint for outreach_contacts table
  if (path === '/api/trigger/migrate-v15' && request.method === 'POST') {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS outreach_contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          opportunity_id INTEGER NOT NULL,
          fit_score INTEGER NOT NULL DEFAULT 0,
          pain_severity TEXT,
          engagement_score INTEGER DEFAULT 0,
          recency_score INTEGER DEFAULT 0,
          source_post_url TEXT NOT NULL,
          pain_expressed TEXT NOT NULL,
          subreddit TEXT,
          post_created_at INTEGER,
          outreach_status TEXT NOT NULL DEFAULT 'pending',
          contacted_at INTEGER,
          responded_at INTEGER,
          notes TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (opportunity_id) REFERENCES pain_clusters(id),
          UNIQUE(username, opportunity_id)
        )
      `).run();
      
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_outreach_opportunity ON outreach_contacts(opportunity_id)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_outreach_username ON outreach_contacts(username)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_contacts(outreach_status)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_outreach_fit_score ON outreach_contacts(fit_score DESC)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_outreach_recency ON outreach_contacts(post_created_at DESC)`).run();
      
      return jsonResponse({ success: true, message: 'v15 migration complete - outreach_contacts table created' });
    } catch (error) {
      console.error('v15 migration error:', error);
      return jsonResponse({ error: `Migration failed: ${error}` }, 500);
    }
  }
  
  // v16: Migration endpoint for geo columns and geo_stats table
  if (path === '/api/trigger/migrate-v16' && request.method === 'POST') {
    try {
      // Add geo columns to pain_records
      try {
        await env.DB.prepare(`ALTER TABLE pain_records ADD COLUMN geo_region TEXT`).run();
      } catch (e) { /* Column may already exist */ }
      
      try {
        await env.DB.prepare(`ALTER TABLE pain_records ADD COLUMN geo_confidence REAL`).run();
      } catch (e) { /* Column may already exist */ }
      
      try {
        await env.DB.prepare(`ALTER TABLE pain_records ADD COLUMN geo_signals TEXT`).run();
      } catch (e) { /* Column may already exist */ }
      
      // Create indexes
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pain_geo_region ON pain_records(geo_region)`).run();
      
      // Create geo_stats table
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS geo_stats (
          region TEXT PRIMARY KEY,
          pain_count INTEGER DEFAULT 0,
          cluster_count INTEGER DEFAULT 0,
          avg_confidence REAL DEFAULT 0,
          updated_at INTEGER NOT NULL
        )
      `).run();
      
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_geo_stats_count ON geo_stats(pain_count DESC)`).run();
      
      return jsonResponse({ success: true, message: 'v16 migration complete - geo columns and geo_stats table created' });
    } catch (error) {
      console.error('v16 migration error:', error);
      return jsonResponse({ error: `Migration failed: ${error}` }, 500);
    }
  }
  
  // v13: Migration endpoint for landing_pages table
  if (path === '/api/trigger/migrate-v13' && request.method === 'POST') {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS landing_pages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          opportunity_id INTEGER NOT NULL UNIQUE,
          headline TEXT NOT NULL,
          subheadline TEXT NOT NULL,
          benefits TEXT NOT NULL,
          social_proof TEXT NOT NULL,
          cta_text TEXT NOT NULL,
          hero_description TEXT,
          generated_at INTEGER NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (opportunity_id) REFERENCES pain_clusters(id)
        )
      `).run();
      
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_landing_opportunity ON landing_pages(opportunity_id)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_landing_generated ON landing_pages(generated_at DESC)`).run();
      
      return jsonResponse({ success: true, message: 'v13 migration complete - landing_pages table created' });
    } catch (error) {
      console.error('v13 migration error:', error);
      return jsonResponse({ error: `Migration failed: ${error}` }, 500);
    }
  }
  
  // v18: Alert check trigger (manual)
  if (path === '/api/trigger/check-alerts' && request.method === 'POST') {
    const result = await runAlertChecks(env.DB);
    return jsonResponse({ success: true, result });
  }
  
  // v18: Migration endpoint for alerts table
  if (path === '/api/trigger/migrate-v18' && request.method === 'POST') {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'info',
          opportunity_id INTEGER,
          topic_canonical TEXT,
          product_name TEXT,
          created_at INTEGER NOT NULL,
          read_at INTEGER,
          FOREIGN KEY (opportunity_id) REFERENCES pain_clusters(id)
        )
      `).run();
      
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_alerts_opportunity ON alerts(opportunity_id)`).run();
      
      return jsonResponse({ success: true, message: 'v18 migration complete - alerts table created' });
    } catch (error) {
      console.error('v18 migration error:', error);
      return jsonResponse({ error: `Migration failed: ${error}` }, 500);
    }
  }
  
  // v18-auth: Migration endpoint for users table (Cloudflare Access auth)
  if (path === '/api/trigger/migrate-v18-auth' && request.method === 'POST') {
    try {
      // Users table
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          first_seen INTEGER NOT NULL,
          last_seen INTEGER NOT NULL,
          plan TEXT NOT NULL DEFAULT 'free',
          preferences TEXT,
          created_at INTEGER NOT NULL
        )
      `).run();
      
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen DESC)`).run();
      
      // User activity log
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS user_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          resource_id INTEGER,
          metadata TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `).run();
      
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity(user_id)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_action ON user_activity(action)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity(created_at DESC)`).run();
      
      return jsonResponse({ success: true, message: 'v18-auth migration complete - users and user_activity tables created' });
    } catch (error) {
      console.error('v18-auth migration error:', error);
      return jsonResponse({ error: `Migration failed: ${error}` }, 500);
    }
  }
  
  // v12: Migration endpoint for mvp_features table
  if (path === '/api/trigger/migrate-v12' && request.method === 'POST') {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS mvp_features (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          opportunity_id INTEGER NOT NULL,
          feature_name TEXT NOT NULL,
          feature_type TEXT NOT NULL,
          description TEXT,
          priority_score INTEGER NOT NULL DEFAULT 0,
          mention_count INTEGER NOT NULL DEFAULT 1,
          source_quotes TEXT,
          confidence REAL NOT NULL DEFAULT 0.5,
          extracted_at INTEGER NOT NULL,
          FOREIGN KEY (opportunity_id) REFERENCES pain_clusters(id),
          UNIQUE(opportunity_id, feature_name)
        )
      `).run();
      
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_features_opp ON mvp_features(opportunity_id)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_features_type ON mvp_features(feature_type)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_features_priority ON mvp_features(priority_score DESC)`).run();
      
      return jsonResponse({ success: true, message: 'v12 migration complete - mvp_features table created' });
    } catch (error) {
      console.error('v12 migration error:', error);
      return jsonResponse({ error: `Migration failed: ${error}` }, 500);
    }
  }
  
  // v11: Migration endpoint for market_estimates table
  if (path === '/api/trigger/migrate-v11' && request.method === 'POST') {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS market_estimates (
          cluster_id INTEGER PRIMARY KEY,
          tam_estimate INTEGER NOT NULL,
          tam_tier TEXT NOT NULL,
          sam_estimate INTEGER NOT NULL,
          sam_tier TEXT NOT NULL,
          som_estimate INTEGER NOT NULL,
          som_tier TEXT NOT NULL,
          confidence REAL NOT NULL,
          category TEXT NOT NULL,
          geo_scope TEXT NOT NULL,
          industry_vertical TEXT,
          reasoning TEXT,
          estimated_at INTEGER NOT NULL,
          FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id)
        )
      `).run();
      
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_tam ON market_estimates(tam_estimate DESC)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_tier ON market_estimates(tam_tier)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_category ON market_estimates(category)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_confidence ON market_estimates(confidence DESC)`).run();
      
      return jsonResponse({ success: true, message: 'v11 migration complete - market_estimates table created' });
    } catch (error) {
      console.error('v11 migration error:', error);
      return jsonResponse({ error: `Migration failed: ${error}` }, 500);
    }
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
  const results: any = { version: 'v16' };
  
  console.log('\n========================================');
  console.log('Running v16 Pipeline: Geo + Alerts + MVP Features + Market Sizing + Trends + Clustering');
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
  
  // v16: Geographic analysis (runs after tagging, every cron)
  console.log('\nStep 3.5: Geographic analysis (v16)...');
  results.geo_analysis = await runGeoAnalysis(env);
  
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
  
  // v11: Market sizing (every 2nd cron to save API calls)
  if (cronCount % 2 === 0) {
    console.log('\nStep 8: Market sizing (every 2nd cron)...');
    results.market_sizing = await runMarketSizing(env);
  }
  
  // v12: MVP Feature extraction (every 2nd cron, offset from market sizing)
  if (cronCount % 2 === 1) {
    console.log('\nStep 9: MVP Feature extraction (every 2nd cron, offset)...');
    results.mvp_features = await runMVPFeatureExtraction(env);
  }
  
  // v14: Alert checks (every cron)
  console.log('\nStep 10: Alert checks...');
  results.alerts = await runAlertChecks(env.DB);
  
  console.log('\n========================================');
  console.log('v14 Pipeline Complete!');
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
