-- Reddit Pain Point Finder v7 - Database Schema
-- Embedding-based semantic clustering
-- =============================================

-- Layer 1: Raw Ingestion
CREATE TABLE IF NOT EXISTS raw_posts (
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
    fetched_at INTEGER NOT NULL,
    processed_at INTEGER,
    UNIQUE(id)
);

CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON raw_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_posts_created ON raw_posts(created_utc DESC);
CREATE INDEX IF NOT EXISTS idx_posts_processed ON raw_posts(processed_at);

CREATE TABLE IF NOT EXISTS raw_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    parent_id TEXT,
    body TEXT NOT NULL,
    author TEXT,
    created_utc INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    fetched_at INTEGER NOT NULL,
    processed_at INTEGER,
    FOREIGN KEY (post_id) REFERENCES raw_posts(id),
    UNIQUE(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON raw_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_processed ON raw_comments(processed_at);

-- Layer 2: Classification Results
CREATE TABLE IF NOT EXISTS classifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    is_pain_point INTEGER NOT NULL,
    pain_type TEXT,
    content_type TEXT,
    confidence REAL NOT NULL,
    raw_response TEXT,
    classified_at INTEGER NOT NULL,
    UNIQUE(source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_class_pain ON classifications(is_pain_point);
CREATE INDEX IF NOT EXISTS idx_class_source ON classifications(source_type, source_id);

-- Layer 3: Extracted Pain Records (v7: added embedding fields)
CREATE TABLE IF NOT EXISTS pain_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    subreddit TEXT NOT NULL,
    
    -- Content
    problem_text TEXT NOT NULL,
    raw_quote TEXT,
    author TEXT,
    
    -- v6.1: Quality tagging
    topics TEXT,                     -- JSON array of topics
    keywords TEXT,                   -- JSON array
    persona TEXT,
    severity TEXT,                   -- low/medium/high/critical
    tagged_at INTEGER,
    
    -- v7: Embedding fields
    embedding_id INTEGER,            -- Reference to embeddings table
    normalized_topic TEXT,           -- Normalized canonical topic
    
    -- Clustering
    cluster_id INTEGER,
    cluster_similarity REAL,
    
    -- Source metadata
    source_url TEXT,
    source_score INTEGER,
    source_created_utc INTEGER,
    extracted_at INTEGER NOT NULL,
    
    -- Legacy fields (compatibility)
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
    source_author TEXT,
    category TEXT,
    
    FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id),
    UNIQUE(source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_pain_cluster ON pain_records(cluster_id);
CREATE INDEX IF NOT EXISTS idx_pain_subreddit ON pain_records(subreddit);
CREATE INDEX IF NOT EXISTS idx_pain_severity ON pain_records(severity DESC);
CREATE INDEX IF NOT EXISTS idx_pain_embedding ON pain_records(embedding_id);
CREATE INDEX IF NOT EXISTS idx_pain_normalized_topic ON pain_records(normalized_topic);

-- v7: Embeddings table (D1-based vector storage)
CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pain_record_id INTEGER NOT NULL UNIQUE,
    vector TEXT NOT NULL,            -- JSON array of 1536 floats (compressed)
    created_at INTEGER NOT NULL,
    FOREIGN KEY (pain_record_id) REFERENCES pain_records(id)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_record ON embeddings(pain_record_id);

-- Layer 4: Clustering (v7: added canonical topic and category)
CREATE TABLE IF NOT EXISTS pain_clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Topic info (v7)
    topic TEXT,                      -- Original topic string
    topic_canonical TEXT,            -- Normalized canonical topic
    broad_category TEXT,             -- Broad category for filtering
    centroid_text TEXT,              -- Description
    centroid_embedding_id INTEGER,   -- Reference to centroid embedding
    
    -- Product output
    product_name TEXT,
    tagline TEXT,
    how_it_works TEXT,               -- JSON array
    target_customer TEXT,
    
    -- Social proof
    social_proof_count INTEGER DEFAULT 0,
    last_synth_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    
    -- Stats
    member_count INTEGER DEFAULT 0,
    unique_authors INTEGER DEFAULT 0,
    subreddit_count INTEGER DEFAULT 0,
    total_upvotes INTEGER DEFAULT 0,
    total_score REAL DEFAULT 0,
    
    -- Display data
    top_quotes TEXT,                 -- JSON array
    subreddits_list TEXT,            -- JSON array
    categories TEXT,                 -- JSON: personas, severity breakdown
    
    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synthesized_at INTEGER,
    scored_at INTEGER,
    
    -- Legacy
    embedding_id TEXT,
    avg_severity REAL,
    avg_w2p REAL,
    brief_summary TEXT,
    brief_quotes TEXT,
    brief_personas TEXT,
    brief_workarounds TEXT,
    brief_open_questions TEXT,
    last_backvalidation INTEGER,
    search_keywords TEXT
);

CREATE INDEX IF NOT EXISTS idx_clusters_updated ON pain_clusters(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_topic ON pain_clusters(topic_canonical);
CREATE INDEX IF NOT EXISTS idx_clusters_category ON pain_clusters(broad_category);
CREATE INDEX IF NOT EXISTS idx_clusters_social_proof ON pain_clusters(social_proof_count DESC);

CREATE TABLE IF NOT EXISTS cluster_members (
    cluster_id INTEGER NOT NULL,
    pain_record_id INTEGER NOT NULL,
    similarity_score REAL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (cluster_id, pain_record_id),
    FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id),
    FOREIGN KEY (pain_record_id) REFERENCES pain_records(id)
);

-- Layer 6: Scoring
CREATE TABLE IF NOT EXISTS cluster_scores (
    cluster_id INTEGER PRIMARY KEY,
    frequency_score REAL,
    severity_score REAL,
    economic_score REAL,
    solvability_score REAL,
    competitive_score REAL,
    au_fit_score REAL,
    total_score REAL,
    score_breakdown TEXT,
    scored_at INTEGER NOT NULL,
    FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id)
);

CREATE INDEX IF NOT EXISTS idx_scores_total ON cluster_scores(total_score DESC);

-- Processing State
CREATE TABLE IF NOT EXISTS processing_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER
);

INSERT OR IGNORE INTO processing_state (key, value, updated_at) VALUES ('last_ingestion', '0', 0);
INSERT OR IGNORE INTO processing_state (key, value, updated_at) VALUES ('subreddits_index', '0', 0);
INSERT OR IGNORE INTO processing_state (key, value, updated_at) VALUES ('cron_count', '0', 0);

-- Daily Statistics
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    posts_ingested INTEGER DEFAULT 0,
    comments_ingested INTEGER DEFAULT 0,
    pain_points_found INTEGER DEFAULT 0,
    clusters_created INTEGER DEFAULT 0,
    clusters_updated INTEGER DEFAULT 0,
    llm_tokens_used INTEGER DEFAULT 0,
    llm_cost_cents INTEGER DEFAULT 0
);
