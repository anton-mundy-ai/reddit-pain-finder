// v5: Product-focused types

export interface Quote {
  text: string;
  author: string;
  subreddit: string;
}

export interface Opportunity {
  id: number;
  product_name: string;
  tagline: string;
  how_it_works: string[];
  target_customer: string;
  version: number;
  social_proof_count: number;
  subreddits: string[];
  top_quotes: Quote[];
  total_quotes: number;
  total_score: number;
  updated_at: number;
}

export interface OpportunityDetail extends Opportunity {
  all_quotes: Quote[];
  unique_authors: number;
  total_upvotes: number;
}

export interface Stats {
  raw_posts: number;
  raw_comments: number;
  pain_records: number;
  clusters: number;
  products_generated: number;
  total_social_proof: number;
  version: string;
  last_updated: number;
}
