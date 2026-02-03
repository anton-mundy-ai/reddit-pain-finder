// Reddit Pain Point Finder v5 - Types
// Focus: Social proof, high throughput, product-focused output

// Environment bindings
export interface Env {
  DB: D1Database;
  OPENAI_API_KEY: string;
  ENVIRONMENT: string;
}

// Reddit API types
export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
}

export interface RedditComment {
  id: string;
  parent_id: string;
  body: string;
  author: string;
  created_utc: number;
  score: number;
  link_id: string;
  post_score?: number;
  post_title?: string;
  subreddit?: string;
}

// v5: Simplified pain record - just the quote
export interface PainRecord {
  id?: number;
  source_type: 'post' | 'comment';
  source_id: string;
  subreddit: string;
  raw_quote: string;
  author: string | null;
  source_score: number;
  source_url: string | null;
  source_created_utc: number | null;
  extracted_at: number;
  cluster_id: number | null;
  cluster_similarity: number | null;
}

// v5: Product-focused cluster
export interface PainCluster {
  id?: number;
  centroid_text: string | null;
  
  // PRODUCT OUTPUT
  product_name: string | null;
  tagline: string | null;
  how_it_works: string | null;  // JSON array
  target_customer: string | null;
  
  // SOCIAL PROOF
  social_proof_count: number;
  last_synth_count: number;
  version: number;
  
  // Stats
  member_count: number;
  unique_authors: number;
  subreddit_count: number;
  total_upvotes: number;
  total_score: number;
  
  // Timestamps
  created_at: number;
  updated_at: number;
  synthesized_at: number | null;
  scored_at: number | null;
  
  // Display
  top_quotes: string | null;  // JSON array
  subreddits_list: string | null;  // JSON array
}

// API Response types
export interface Quote {
  text: string;
  author: string;
  subreddit: string;
}

// v5: Product-focused opportunity brief
export interface OpportunityBrief {
  id: number;
  
  // Product
  product_name: string;
  tagline: string;
  how_it_works: string[];
  target_customer: string;
  version: number;
  
  // Social proof
  social_proof_count: number;
  subreddits: string[];
  
  // Display
  top_quotes: Quote[];
  total_quotes: number;
  
  // Score
  total_score: number;
  
  // Timestamps
  updated_at: number;
}

// Full cluster detail with all quotes
export interface ClusterDetail extends OpportunityBrief {
  all_quotes: Quote[];
  unique_authors: number;
  total_upvotes: number;
}
