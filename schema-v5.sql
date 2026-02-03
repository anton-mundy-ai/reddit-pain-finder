-- Reddit Pain Point Finder v5 - Social Proof & High Throughput Schema
-- Key changes: social_proof_count, product-focused output, version tracking

-- Drop existing tables (clean slate for v5)
DROP TABLE IF EXISTS cluster_members;
DROP TABLE IF EXISTS cluster_scores;
DROP TABLE IF EXISTS pain_clusters;
DROP TABLE IF EXISTS pain_records;
DROP TABLE IF EXISTS classifications;
DROP TABLE IF EXISTS filter_decisions;
DROP TABLE IF EXISTS raw_comments;
DROP TABLE IF EXISTS raw_posts;
DROP TABLE IF EXISTS validations;
DROP TABLE IF EXISTS ingestion_stats;
DROP TABLE IF EXISTS daily_stats;
DROP TABLE IF EXISTS processing_state;

-- High-engagement posts (honeypots for comments)
-- v5: Lowered thresholds for high throughput
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
    sort_type TEXT DEFAULT 'top',
    fetched_at INTEGER DEFAULT (unixepoch()),
    comments_fetched INTEGER DEFAULT 0,
    comments_fetched_at INTEGER,
    processed INTEGER DEFAULT 0
);

CREATE INDEX idx_posts_subreddit ON raw_posts(subreddit);
CREATE INDEX idx_posts_score ON raw_posts(score DESC);
CREATE INDEX idx_posts_engagement ON raw_posts(score, num_comments);
CREATE INDEX idx_posts_processed ON raw_posts(processed);

-- Comments are the PRIMARY source of pain points
CREATE TABLE raw_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    parent_id TEXT,
    body TEXT NOT NULL,
    author TEXT,
    created_utc INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    post_score INTEGER,
    post_title TEXT,
    subreddit TEXT,
    fetched_at INTEGER DEFAULT (unixepoch()),
    processed_at INTEGER,
    is_pain_point INTEGER DEFAULT NULL,  -- v5: null=unprocessed, 0=no, 1=yes
    FOREIGN KEY (post_id) REFERENCES raw_posts(id)
);

CREATE INDEX idx_comments_post ON raw_comments(post_id);
CREATE INDEX idx_comments_score ON raw_comments(score DESC);
CREATE INDEX idx_comments_processed ON raw_comments(processed_at);
CREATE INDEX idx_comments_subreddit ON raw_comments(subreddit);
CREATE INDEX idx_comments_unprocessed ON raw_comments(is_pain_point) WHERE is_pain_point IS NULL;

-- Pain records with VERBATIM quotes
-- v5: Simplified - focus on the quote
CREATE TABLE pain_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    subreddit TEXT NOT NULL,
    raw_quote TEXT NOT NULL,
    author TEXT,
    source_score INTEGER DEFAULT 0,
    source_url TEXT,
    source_created_utc INTEGER,
    extracted_at INTEGER DEFAULT (unixepoch()),
    cluster_id INTEGER,
    cluster_similarity REAL,
    UNIQUE(source_type, source_id)
);

CREATE INDEX idx_pain_cluster ON pain_records(cluster_id);
CREATE INDEX idx_pain_subreddit ON pain_records(subreddit);
CREATE INDEX idx_pain_unclustered ON pain_records(cluster_id) WHERE cluster_id IS NULL;

-- Opportunity clusters with PRODUCT focus
-- v5: Social proof + product generation
CREATE TABLE pain_clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Core problem definition
    centroid_text TEXT,
    
    -- v5: PRODUCT GENERATION OUTPUT
    product_name TEXT,              -- 2-3 words, like "ReviewShield"
    tagline TEXT,                   -- 10 words max
    how_it_works TEXT,              -- JSON array of 3 bullet points
    target_customer TEXT,           -- Specific persona
    
    -- v5: SOCIAL PROOF TRACKING
    social_proof_count INTEGER DEFAULT 0,  -- Total pain points in cluster
    last_synth_count INTEGER DEFAULT 0,    -- Count when last synthesized
    version INTEGER DEFAULT 1,              -- Product version, increments each synthesis
    
    -- Stats
    member_count INTEGER DEFAULT 0,
    unique_authors INTEGER DEFAULT 0,
    subreddit_count INTEGER DEFAULT 0,
    total_upvotes INTEGER DEFAULT 0,
    
    -- Scoring
    total_score REAL DEFAULT 0,
    
    -- Timestamps
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    synthesized_at INTEGER,
    scored_at INTEGER,
    
    -- Top quotes for display (JSON array of {text, author, subreddit})
    top_quotes TEXT,
    
    -- Subreddits list
    subreddits_list TEXT  -- JSON array
);

CREATE INDEX idx_clusters_score ON pain_clusters(total_score DESC);
CREATE INDEX idx_clusters_social_proof ON pain_clusters(social_proof_count DESC);
CREATE INDEX idx_clusters_needs_synth ON pain_clusters(social_proof_count, last_synth_count);

-- Cluster membership tracking
CREATE TABLE cluster_members (
    cluster_id INTEGER NOT NULL,
    pain_record_id INTEGER NOT NULL,
    similarity_score REAL,
    added_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (cluster_id, pain_record_id),
    FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id),
    FOREIGN KEY (pain_record_id) REFERENCES pain_records(id)
);

CREATE INDEX idx_members_cluster ON cluster_members(cluster_id);
CREATE INDEX idx_members_record ON cluster_members(pain_record_id);

-- Processing state
CREATE TABLE processing_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER DEFAULT (unixepoch())
);

INSERT INTO processing_state (key, value) VALUES ('last_ingestion', '0');
INSERT INTO processing_state (key, value) VALUES ('subreddits_index', '0');
INSERT INTO processing_state (key, value) VALUES ('pipeline_version', '5');

-- Stats tracking
CREATE TABLE daily_stats (
    date TEXT PRIMARY KEY,
    posts_ingested INTEGER DEFAULT 0,
    comments_ingested INTEGER DEFAULT 0,
    pain_points_found INTEGER DEFAULT 0,
    clusters_created INTEGER DEFAULT 0,
    clusters_updated INTEGER DEFAULT 0,
    llm_calls INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
);
