// Reddit Pain Point Finder v7 - Types
// Architecture: Embedding-based semantic clustering

// Environment bindings
export interface Env {
  DB: D1Database;
  OPENAI_API_KEY: string;
  ENVIRONMENT: string;
  // VECTORIZE?: VectorizeIndex; // Not available due to API permissions
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

// v6.1: HackerNews types
export interface HNComment {
  id: number;
  text: string;
  author: string;
  created_at: string;
  story_id: number;
  story_title?: string;
  story_url?: string;
}

// v6.1: Severity levels
export type Severity = 'low' | 'medium' | 'high' | 'critical';

// v7: Enhanced pain record with embeddings
export interface PainRecord {
  id?: number;
  source_type: 'post' | 'comment' | 'hn_comment';
  source_id: string;
  subreddit: string;
  raw_quote: string;
  author: string | null;
  source_score: number;
  source_url: string | null;
  source_created_utc: number | null;
  extracted_at: number;
  
  // Quality tagging (GPT-5.2)
  topics: string | null;           // JSON array of 3-5 fine-grained topics
  keywords: string | null;         // JSON array
  persona: string | null;          // Who is affected
  severity: Severity | null;       // low/medium/high/critical
  tagged_at: number | null;        // When quality tagging was done
  
  // v7: Embeddings
  embedding_id: number | null;     // Reference to embeddings table
  normalized_topic: string | null; // Normalized canonical topic
  
  // Clustering (embedding-based)
  cluster_id: number | null;
  cluster_similarity: number | null;  // Similarity score to cluster centroid
  
  // Legacy fields (kept for compatibility)
  category: string | null;
}

// v7: Embedding-based cluster
export interface PainCluster {
  id?: number;
  topic: string | null;               // The topic this cluster represents
  topic_canonical: string | null;     // v7: Normalized canonical topic
  centroid_text: string | null;       // Description of the topic
  centroid_embedding_id: number | null; // v7: Reference to centroid embedding
  broad_category: string | null;      // v7: Broad category for filtering
  
  // PRODUCT OUTPUT
  product_name: string | null;
  tagline: string | null;
  how_it_works: string | null;    // JSON array
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
  top_quotes: string | null;      // JSON array
  subreddits_list: string | null; // JSON array
  
  // Legacy fields
  last_backvalidation: number | null;
  search_keywords: string | null;
  categories: string | null;
}

// API Response types
export interface Quote {
  text: string;
  author: string;
  subreddit: string;
  persona?: string;
  severity?: string;
}

// v6.1: Pain point for visualization
export interface PainPointView {
  id: number;
  raw_quote: string;
  author: string;
  subreddit: string;
  topics: string[];
  persona: string;
  severity: string;
  source_score: number;
  cluster_id: number | null;
}

// v6.1: Topic for visualization
export interface TopicView {
  topic: string;
  count: number;
  personas: string[];
  subreddits: string[];
  severity_breakdown: Record<string, number>;
}

// v6.1: Product-focused opportunity brief
export interface OpportunityBrief {
  id: number;
  
  // Product
  product_name: string;
  tagline: string;
  how_it_works: string[];
  target_customer: string;
  version: number;
  
  // Topic info
  topic: string;
  
  // Social proof
  social_proof_count: number;
  subreddits: string[];
  personas: string[];           // v6.1: Who is affected
  
  // Display
  top_quotes: Quote[];
  total_quotes: number;
  
  // Score
  total_score: number;
  
  // Severity breakdown
  severity_breakdown: Record<string, number>;
  
  // Timestamps
  updated_at: number;
}

// Full cluster detail with all quotes
export interface ClusterDetail extends OpportunityBrief {
  all_quotes: Quote[];
  unique_authors: number;
  total_upvotes: number;
}
