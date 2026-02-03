-- Reddit Pain Point Finder v3 - Database Schema
-- =============================================

-- Drop old tables to start fresh
DROP TABLE IF EXISTS cluster_scores;
DROP TABLE IF EXISTS cluster_members;
DROP TABLE IF EXISTS pain_clusters;
DROP TABLE IF EXISTS pain_records;
DROP TABLE IF EXISTS classifications;
DROP TABLE IF EXISTS filter_decisions;
DROP TABLE IF EXISTS raw_comments;
DROP TABLE IF EXISTS raw_posts;
DROP TABLE IF EXISTS processing_state;
DROP TABLE IF EXISTS daily_stats;
DROP TABLE IF EXISTS ingestion_stats;
DROP TABLE IF EXISTS opportunity_briefs;
DROP TABLE IF EXISTS validations;

-- Layer 1: Raw Ingestion
CREATE TABLE raw_posts (
    id TEXT PRIMARY KEY,
    subreddit TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    author TEXT,
    created_utc INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    num_comments INTEGER DEFAULT 0,
    url TEXT,
    permalink TEXT,
    fetched_at INTEGER DEFAULT (unixepoch()),
    processed INTEGER DEFAULT 0
);

CREATE INDEX idx_posts_subreddit ON raw_posts(subreddit);
CREATE INDEX idx_posts_created ON raw_posts(created_utc DESC);
CREATE INDEX idx_posts_processed ON raw_posts(processed);

CREATE TABLE raw_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    parent_id TEXT,
    body TEXT NOT NULL,
    author TEXT,
    created_utc INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    fetched_at INTEGER DEFAULT (unixepoch()),
    processed INTEGER DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES raw_posts(id)
);

CREATE INDEX idx_comments_post ON raw_comments(post_id);
CREATE INDEX idx_comments_processed ON raw_comments(processed);

-- Layer 2: Filter Decisions  
CREATE TABLE filter_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    is_english INTEGER,
    is_pain_point INTEGER,
    pain_confidence REAL,
    category TEXT,
    problem_type TEXT,
    passes_filter INTEGER,
    filter_reason TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(content_type, content_id)
);

CREATE INDEX idx_filter_passes ON filter_decisions(passes_filter);
CREATE INDEX idx_filter_content ON filter_decisions(content_type, content_id);

-- Layer 3: Extracted Pain Records
CREATE TABLE pain_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    subreddit TEXT NOT NULL,
    problem_text TEXT NOT NULL,
    persona TEXT,
    context_industry TEXT,
    context_location TEXT,
    context_situation TEXT,
    severity_score REAL,
    frequency_score REAL,
    w2p_score REAL,
    severity_signals TEXT,
    frequency_signals TEXT,
    workaround_text TEXT,
    w2p_hints TEXT,
    constraints TEXT,
    domain_tags TEXT,
    extraction_confidence REAL,
    raw_extraction TEXT,
    source_url TEXT,
    source_author TEXT,
    source_score INTEGER,
    source_created_utc INTEGER,
    extracted_at INTEGER DEFAULT (unixepoch()),
    cluster_id INTEGER,
    UNIQUE(source_type, source_id)
);

CREATE INDEX idx_pain_cluster ON pain_records(cluster_id);
CREATE INDEX idx_pain_subreddit ON pain_records(subreddit);
CREATE INDEX idx_pain_severity ON pain_records(severity_score DESC);

-- Layer 4: Clustering
CREATE TABLE pain_clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centroid_text TEXT,
    product_name TEXT,
    member_count INTEGER DEFAULT 0,
    unique_authors INTEGER DEFAULT 0,
    subreddit_count INTEGER DEFAULT 0,
    avg_severity REAL,
    avg_w2p REAL,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    brief_summary TEXT,
    brief_quotes TEXT,
    brief_personas TEXT,
    brief_workarounds TEXT,
    brief_open_questions TEXT,
    synthesized_at INTEGER,
    -- Score columns (denormalized for fast queries)
    frequency_score REAL,
    severity_score REAL,
    economic_score REAL,
    solvability_score REAL,
    competitive_score REAL,
    au_fit_score REAL,
    total_score REAL,
    scored_at INTEGER,
    -- Validation data
    validation_score REAL,
    validation_confidence REAL,
    validation_signals TEXT,
    validated_at INTEGER
);

CREATE INDEX idx_clusters_updated ON pain_clusters(updated_at DESC);
CREATE INDEX idx_clusters_score ON pain_clusters(total_score DESC);
CREATE INDEX idx_clusters_au ON pain_clusters(au_fit_score DESC);

CREATE TABLE cluster_members (
    cluster_id INTEGER NOT NULL,
    pain_record_id INTEGER NOT NULL,
    similarity_score REAL,
    added_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (cluster_id, pain_record_id),
    FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id),
    FOREIGN KEY (pain_record_id) REFERENCES pain_records(id)
);

-- Idea Validations (user-submitted ideas)
CREATE TABLE validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_text TEXT NOT NULL,
    search_queries TEXT,
    matching_cluster_ids TEXT,
    matching_pain_ids TEXT,
    validation_score REAL,
    market_signals TEXT,
    confidence REAL,
    status TEXT DEFAULT 'pending',
    created_at INTEGER DEFAULT (unixepoch()),
    completed_at INTEGER
);

CREATE INDEX idx_validations_status ON validations(status);
CREATE INDEX idx_validations_score ON validations(validation_score DESC);

-- Ingestion Stats (for rotation tracking)
CREATE TABLE ingestion_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subreddit TEXT,
    posts_fetched INTEGER,
    comments_fetched INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
);

-- Daily Statistics
CREATE TABLE daily_stats (
    date TEXT PRIMARY KEY,
    posts_ingested INTEGER DEFAULT 0,
    comments_ingested INTEGER DEFAULT 0,
    pain_points_found INTEGER DEFAULT 0,
    clusters_created INTEGER DEFAULT 0,
    clusters_updated INTEGER DEFAULT 0,
    validations_run INTEGER DEFAULT 0,
    llm_tokens_used INTEGER DEFAULT 0,
    llm_cost_cents INTEGER DEFAULT 0
);

-- Processing State
CREATE TABLE processing_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER DEFAULT (unixepoch())
);

INSERT INTO processing_state (key, value) VALUES ('last_ingestion', '0');
INSERT INTO processing_state (key, value) VALUES ('subreddits_index', '0');
