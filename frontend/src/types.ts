// v7: Types with embedding-based clustering

export interface Quote {
  text: string;
  author: string;
  subreddit: string;
  persona?: string;
  severity?: string;
  similarity?: number;  // v7: similarity score
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
  version: string;
  last_updated: number;
}
