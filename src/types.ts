// Environment bindings
export interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
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
}

// Database models
export interface RawPost {
  id: string;
  subreddit: string;
  title: string;
  body: string | null;
  author: string | null;
  created_utc: number;
  score: number;
  num_comments: number;
  url: string | null;
  permalink: string | null;
  fetched_at: number;
  processed_at: number | null;
}

export interface RawComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  body: string;
  author: string | null;
  created_utc: number;
  score: number;
  fetched_at: number;
  processed_at: number | null;
}

export interface Classification {
  id?: number;
  source_type: 'post' | 'comment';
  source_id: string;
  is_pain_point: number;
  pain_type: 'consumer' | 'business' | 'technical' | null;
  content_type: 'complaint' | 'recommendation_ask' | 'rant' | 'how_to' | 'other' | null;
  confidence: number;
  raw_response: string;
  classified_at: number;
}

export interface PainRecord {
  id?: number;
  source_type: 'post' | 'comment';
  source_id: string;
  subreddit: string;
  problem_text: string;
  persona: string | null;
  context_industry: string | null;
  context_location: string | null;
  context_situation: string | null;
  severity_score: number | null;
  frequency_score: number | null;
  w2p_score: number | null;
  severity_signals: string | null;
  frequency_signals: string | null;
  workaround_text: string | null;
  w2p_hints: string | null;
  constraints: string | null;
  domain_tags: string | null;
  extraction_confidence: number | null;
  raw_extraction: string | null;
  source_url: string | null;
  source_author: string | null;
  source_score: number | null;
  source_created_utc: number | null;
  extracted_at: number;
  cluster_id: number | null;
}

export interface PainCluster {
  id?: number;
  centroid_text: string;
  embedding_id: string | null;
  member_count: number;
  unique_authors: number;
  subreddit_count: number;
  avg_severity: number | null;
  avg_w2p: number | null;
  created_at: number;
  updated_at: number;
  brief_summary: string | null;
  brief_quotes: string | null;
  brief_personas: string | null;
  brief_workarounds: string | null;
  brief_open_questions: string | null;
  synthesized_at: number | null;
}

export interface ClusterScore {
  cluster_id: number;
  frequency_score: number;
  severity_score: number;
  economic_score: number;
  solvability_score: number;
  competitive_score: number;
  au_fit_score: number;
  total_score: number;
  score_breakdown: string;
  scored_at: number;
}

// LLM Response types
export interface ClassificationResponse {
  is_pain_point: boolean;
  pain_type: 'consumer' | 'business' | 'technical' | null;
  content_type: 'complaint' | 'recommendation_ask' | 'rant' | 'how_to' | 'other';
  confidence: number;
  reasoning: string;
}

export interface ExtractionResponse {
  problem_statement: string;
  persona: string | null;
  context: {
    industry: string | null;
    location: string | null;
    situation: string | null;
  };
  severity: {
    score: number;
    signals: string[];
  };
  frequency: {
    score: number;
    signals: string[];
  };
  workaround: string | null;
  willingness_to_pay: {
    score: number;
    hints: string[];
  };
  constraints: string[];
  domain_tags: string[];
  confidence: number;
}

export interface SynthesisResponse {
  summary: string;
  personas: string[];
  common_workarounds: string[];
  open_questions: string[];
}

export interface ScoringResponse {
  frequency: { score: number; reasoning: string };
  severity: { score: number; reasoning: string };
  economic: { score: number; reasoning: string };
  solvability: { score: number; reasoning: string };
  competitive: { score: number; reasoning: string };
  au_fit: { score: number; reasoning: string };
}

export interface OpportunityBrief {
  id: number;
  summary: string;
  problem_statement: string;
  total_score: number;
  member_count: number;
  unique_authors: number;
  subreddits: string[];
  personas: string[];
  workarounds: string[];
  top_quotes: {
    text: string;
    url: string;
    author: string;
    score: number;
  }[];
  score_breakdown: {
    frequency: number;
    severity: number;
    economic: number;
    solvability: number;
    competitive: number;
    au_fit: number;
  };
  open_questions: string[];
  updated_at: number;
}
