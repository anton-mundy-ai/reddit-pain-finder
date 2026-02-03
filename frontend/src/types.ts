// v12: Types with MVP Features + embedding-based clustering + Trends + Market Sizing

export interface Quote {
  text: string;
  author: string;
  subreddit: string;
  persona?: string;
  severity?: string;
  similarity?: number;  // v7: similarity score
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
  version: string;
  last_updated: number;
}
