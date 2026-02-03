// v16: Types with Geo Analysis + Alerts + MVP Features + embedding-based clustering + Trends + Market Sizing

// v16: Geographic region types
export type RegionCode = 'AU' | 'US' | 'UK' | 'EU' | 'GLOBAL';

export interface RegionInfo {
  emoji: string;
  name: string;
  color: string;
}

export const REGION_INFO: Record<RegionCode, RegionInfo> = {
  AU: { emoji: '🇦🇺', name: 'Australia', color: '#00843D' },
  US: { emoji: '🇺🇸', name: 'United States', color: '#3C3B6E' },
  UK: { emoji: '🇬🇧', name: 'United Kingdom', color: '#012169' },
  EU: { emoji: '🇪🇺', name: 'Europe', color: '#003399' },
  GLOBAL: { emoji: '🌍', name: 'Global', color: '#6B7280' },
};

export interface GeoRegionStat {
  region: RegionCode;
  pain_count: number;
  cluster_count: number;
  avg_confidence: number;
  percentage: number;
}

export interface Quote {
  text: string;
  author: string;
  subreddit: string;
  persona?: string;
  severity?: string;
  similarity?: number;  // v7: similarity score
}

// v14: Alert types
export type AlertType = 'new_cluster' | 'trend_spike' | 'competitor_gap' | 'high_severity';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: number;
  alert_type: AlertType;
  title: string;
  description: string;
  severity: AlertSeverity;
  opportunity_id: number | null;
  topic_canonical: string | null;
  product_name: string | null;
  created_at: number;
  read_at: number | null;
}

export interface AlertStats {
  total: number;
  unread: number;
  by_type: Record<AlertType, number>;
  by_severity: Record<AlertSeverity, number>;
  recent_24h: number;
}

// v11: Market sizing types
export type MarketTier = '$1M' | '$10M' | '$100M' | '$1B' | '$10B+';

export interface MarketEstimate {
  tam_tier: MarketTier;
  sam_tier: MarketTier;
  som_tier: MarketTier;
  tam_estimate: number;
  confidence: number;
  category: string;
}

// v10: Trend types
export type TrendStatus = 'hot' | 'rising' | 'stable' | 'cooling' | 'cold';

export interface TrendSummary {
  topic_canonical: string;
  cluster_id: number | null;
  current_count: number;
  current_velocity: number;
  trend_status: TrendStatus;
  peak_count: number;
  peak_date: string;
  first_seen: string;
  last_updated: number;
  sparkline: number[];
  product_name?: string;
  tagline?: string;
}

export interface TrendHistory {
  topic: string;
  snapshots: Array<{
    date: string;
    count: number;
    velocity: number | null;
    status: TrendStatus;
  }>;
}

export interface Opportunity {
  id: number;
  product_name: string;
  tagline: string;
  how_it_works: string[];
  target_customer: string;
  version: number;
  topic: string;
  topic_canonical?: string;    // v7: normalized topic
  broad_category?: string;     // v7: broad category
  social_proof_count: number;
  subreddits: string[];
  personas: string[];
  top_quotes: Quote[];
  total_quotes: number;
  total_score: number;
  severity_breakdown: Record<string, number>;
  avg_similarity?: number;     // v7: cluster cohesion
  updated_at: number;
  market?: MarketEstimate | null;  // v11: market sizing
  // v16: Region data (when filtering by region)
  region_count?: number | null;
  region_percentage?: number | null;
}

export interface OpportunityDetail extends Opportunity {
  all_quotes: Quote[];
  unique_authors: number;
  total_upvotes: number;
}

// Pain point for visualization
export interface PainPoint {
  id: number;
  raw_quote: string;
  author: string;
  subreddit: string;
  topics: string[];
  persona: string;
  severity: string;
  source_score: number;
  cluster_id: number | null;
  normalized_topic?: string;   // v7
  has_embedding?: boolean;     // v7
}

// Topic for visualization
export interface Topic {
  topic: string;
  count: number;
  personas: string[];
  subreddits: string[];
  severity_breakdown: Record<string, number>;
}

// v13: Landing page types
export interface LandingBenefit {
  icon: string;
  title: string;
  description: string;
}

export interface LandingSocialProof {
  mention_count: number;
  sources: string[];
  quotes: Array<{
    text: string;
    author: string;
    source: string;
  }>;
}

export interface LandingPage {
  id: number;
  opportunity_id: number;
  headline: string;
  subheadline: string;
  benefits: LandingBenefit[];
  social_proof: LandingSocialProof;
  cta_text: string;
  hero_description?: string;
  generated_at: number;
  version: number;
}

export interface Stats {
  raw_posts: number;
  raw_comments: number;
  hn_comments: number;
  pain_records: number;
  tagged_records: number;
  embeddings?: number;         // v7: embedding count
  clusters: number;
  unique_topics: number;
  qualifying_clusters: number; // 5+ members
  products_generated: number;
  avg_cluster_size?: number;   // v7: average mentions per cluster
  // v9: competitor mining stats
  competitor_complaints?: number;
  competitor_products?: number;
  competitor_feature_gaps?: number;
  // v10: trend stats
  trends_tracked?: number;
  trends_hot?: number;
  trends_rising?: number;
  trends_cooling?: number;
  last_trend_snapshot?: string | null;
  // v11: market sizing stats
  market_estimated?: number;
  market_by_tier?: Record<MarketTier, number>;
  market_avg_confidence?: number;
  // v12: MVP feature stats
  mvp_features_total?: number;
  mvp_features_by_type?: Record<string, number>;
  mvp_opportunities_with_features?: number;
  mvp_avg_features_per_opp?: number;
  mvp_top_priority_features?: number;
  // v14: alert stats
  alerts_total?: number;
  alerts_unread?: number;
  alerts_by_type?: Record<AlertType, number>;
  alerts_recent_24h?: number;
  // v15: Outreach stats
  outreach_total?: number;
  outreach_pending?: number;
  outreach_contacted?: number;
  outreach_responded?: number;
  outreach_opportunities?: number;
  // v16: Geo stats
  geo_tagged?: number;
  geo_by_region?: Record<RegionCode, number>;
  geo_regions?: GeoRegionStat[];
  version: string;
  last_updated: number;
}
