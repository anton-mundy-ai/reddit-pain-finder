export interface Opportunity {
  id: number;
  centroid_text: string;
  brief_summary: string | null;
  member_count: number;
  unique_authors: number;
  subreddit_count: number;
  avg_severity: number | null;
  avg_w2p: number | null;
  total_score: number;
  frequency_score: number;
  severity_score: number;
  economic_score: number;
  solvability_score: number;
  competitive_score: number;
  au_fit_score: number;
  updated_at: number;
}

export interface OpportunityDetail {
  id: number;
  summary: string;
  problem_statement: string;
  total_score: number;
  member_count: number;
  unique_authors: number;
  subreddits: string[];
  personas: string[];
  workarounds: string[];
  top_quotes: Quote[];
  score_breakdown: ScoreBreakdown;
  open_questions: string[];
  updated_at: number;
}

export interface Quote {
  text: string;
  url: string;
  author: string;
  score: number;
}

export interface ScoreBreakdown {
  frequency: number;
  severity: number;
  economic: number;
  solvability: number;
  competitive: number;
  au_fit: number;
}

export interface PainRecord {
  id: number;
  source_type: string;
  source_id: string;
  subreddit: string;
  problem_text: string;
  persona: string | null;
  context_location: string | null;
  severity_score: number | null;
  w2p_score: number | null;
  workaround_text: string | null;
  source_url: string | null;
  source_author: string | null;
  source_score: number | null;
}

export interface Stats {
  raw_posts: number;
  raw_comments: number;
  pain_points_classified: number;
  pain_records: number;
  clusters: number;
  scored_clusters: number;
  last_updated: number;
}
