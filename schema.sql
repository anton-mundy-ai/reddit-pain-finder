-- Reddit Pain Point Finder - Database Schema
-- Layer 1: Raw data storage

CREATE TABLE IF NOT EXISTS raw_posts (
  id TEXT PRIMARY KEY,
  subreddit TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  author TEXT,
  score INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  url TEXT,
  permalink TEXT,
  created_utc INTEGER,
  fetched_at INTEGER DEFAULT (unixepoch()),
  processed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS raw_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  parent_id TEXT,
  body TEXT NOT NULL,
  author TEXT,
  score INTEGER DEFAULT 0,
  created_utc INTEGER,
  fetched_at INTEGER DEFAULT (unixepoch()),
  processed INTEGER DEFAULT 0,
  FOREIGN KEY (post_id) REFERENCES raw_posts(id)
);

-- Layer 2: Filtering decisions
CREATE TABLE IF NOT EXISTS filter_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL, -- 'post' or 'comment'
  content_id TEXT NOT NULL,
  is_english INTEGER DEFAULT 1,
  is_pain_point INTEGER DEFAULT 0,
  pain_confidence REAL DEFAULT 0,
  category TEXT, -- 'complaint', 'recommendation_ask', 'rant', 'how_to', 'other'
  problem_type TEXT, -- 'consumer', 'business', 'other'
  passes_filter INTEGER DEFAULT 0,
  filter_reason TEXT,
  processed_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(content_type, content_id)
);

-- Layer 3: Extracted pain records
CREATE TABLE IF NOT EXISTS pain_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  subreddit TEXT,
  problem_statement TEXT NOT NULL,
  persona TEXT,
  context_industry TEXT,
  context_location TEXT,
  context_situation TEXT,
  severity_score REAL DEFAULT 0,
  severity_signals TEXT, -- JSON array
  frequency_signals TEXT, -- JSON array
  current_workaround TEXT,
  willingness_to_pay TEXT,
  constraints TEXT, -- JSON array
  raw_quote TEXT,
  reddit_url TEXT,
  author TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  cluster_id INTEGER,
  UNIQUE(content_type, content_id),
  FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id)
);

-- Layer 4: Clustering
CREATE TABLE IF NOT EXISTS pain_clusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  centroid_vector_id TEXT, -- Reference to Vectorize
  member_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cluster_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id INTEGER NOT NULL,
  pain_record_id INTEGER NOT NULL,
  similarity_score REAL,
  added_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id),
  FOREIGN KEY (pain_record_id) REFERENCES pain_records(id),
  UNIQUE(cluster_id, pain_record_id)
);

-- Layer 5: Synthesis - Opportunity briefs
CREATE TABLE IF NOT EXISTS opportunity_briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id INTEGER UNIQUE NOT NULL,
  summary TEXT,
  top_quotes TEXT, -- JSON array of {quote, url, author}
  personas TEXT, -- JSON array
  common_workarounds TEXT, -- JSON array
  impact_indicators TEXT, -- JSON object
  generated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id)
);

-- Layer 6: Scoring
CREATE TABLE IF NOT EXISTS cluster_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id INTEGER UNIQUE NOT NULL,
  total_score REAL DEFAULT 0,
  frequency_score REAL DEFAULT 0,
  frequency_details TEXT, -- JSON
  severity_score REAL DEFAULT 0,
  severity_details TEXT, -- JSON
  economic_score REAL DEFAULT 0,
  economic_details TEXT, -- JSON
  solvability_score REAL DEFAULT 0,
  solvability_details TEXT, -- JSON
  competition_score REAL DEFAULT 0,
  competition_details TEXT, -- JSON
  au_fit_score REAL DEFAULT 0,
  au_fit_details TEXT, -- JSON
  calculated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON raw_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_posts_processed ON raw_posts(processed);
CREATE INDEX IF NOT EXISTS idx_comments_post ON raw_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_processed ON raw_comments(processed);
CREATE INDEX IF NOT EXISTS idx_filter_passes ON filter_decisions(passes_filter);
CREATE INDEX IF NOT EXISTS idx_pain_cluster ON pain_records(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_active ON pain_clusters(is_active);
CREATE INDEX IF NOT EXISTS idx_scores_total ON cluster_scores(total_score DESC);

-- Processing queue for async work
CREATE TABLE IF NOT EXISTS processing_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_type TEXT NOT NULL, -- 'filter', 'extract', 'cluster', 'synthesize', 'score'
  content_type TEXT,
  content_id TEXT,
  cluster_id INTEGER,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  started_at INTEGER,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status, priority DESC);

-- Stats tracking
CREATE TABLE IF NOT EXISTS ingestion_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subreddit TEXT NOT NULL,
  posts_fetched INTEGER DEFAULT 0,
  comments_fetched INTEGER DEFAULT 0,
  run_at INTEGER DEFAULT (unixepoch())
);
