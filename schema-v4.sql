-- Reddit Pain Point Finder v4 - Quality Overhaul Schema
-- Key changes: verbatim quotes, comment-first extraction, dynamic clustering

-- Drop existing tables (clean slate for v4)
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
    sort_type TEXT DEFAULT 'top', -- 'top' or 'hot'
    fetched_at INTEGER DEFAULT (unixepoch()),
    comments_fetched INTEGER DEFAULT 0, -- how many comments we've fetched
    comments_fetched_at INTEGER
);

CREATE INDEX idx_posts_subreddit ON raw_posts(subreddit);
CREATE INDEX idx_posts_score ON raw_posts(score DESC);
CREATE INDEX idx_posts_engagement ON raw_posts(score, num_comments);

-- Comments are the PRIMARY source of pain points
CREATE TABLE raw_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    parent_id TEXT,
    body TEXT NOT NULL,
    author TEXT,
    created_utc INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    -- Denormalized parent post info for easy access
    post_score INTEGER,
    post_title TEXT,
    subreddit TEXT,
    fetched_at INTEGER DEFAULT (unixepoch()),
    processed_at INTEGER,
    FOREIGN KEY (post_id) REFERENCES raw_posts(id)
);

CREATE INDEX idx_comments_post ON raw_comments(post_id);
CREATE INDEX idx_comments_score ON raw_comments(score DESC);
CREATE INDEX idx_comments_processed ON raw_comments(processed_at);
CREATE INDEX idx_comments_subreddit ON raw_comments(subreddit);

-- Pain records with VERBATIM quotes
CREATE TABLE pain_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL, -- 'comment' (primary) or 'post'
    source_id TEXT NOT NULL,
    subreddit TEXT NOT NULL,
    
    -- VERBATIM quote - the actual text, not summarized
    raw_quote TEXT NOT NULL,
    
    -- Extracted/synthesized summary
    problem_summary TEXT,
    persona TEXT,
    
    -- Context
    context_industry TEXT,
    context_location TEXT,
    context_situation TEXT,
    
    -- Scores (1-10)
    severity_score REAL,
    frequency_score REAL,
    w2p_score REAL,
    
    -- Signals
    severity_signals TEXT, -- JSON array
    frequency_signals TEXT, -- JSON array
    workaround_text TEXT,
    w2p_hints TEXT, -- JSON array
    
    -- Metadata
    constraints TEXT, -- JSON array
    domain_tags TEXT, -- JSON array
    extraction_confidence REAL,
    raw_extraction TEXT, -- Full LLM response
    
    -- Source attribution
    source_url TEXT,
    source_author TEXT,
    source_score INTEGER, -- upvotes on the comment/post
    source_created_utc INTEGER,
    
    -- Parent post info (for comments)
    parent_post_id TEXT,
    parent_post_score INTEGER,
    parent_post_title TEXT,
    
    -- Timestamps
    extracted_at INTEGER DEFAULT (unixepoch()),
    
    -- Clustering (can be reassigned as clusters grow)
    cluster_id INTEGER,
    cluster_similarity REAL, -- how well this matches its cluster
    
    UNIQUE(source_type, source_id)
);

CREATE INDEX idx_pain_cluster ON pain_records(cluster_id);
CREATE INDEX idx_pain_subreddit ON pain_records(subreddit);
CREATE INDEX idx_pain_score ON pain_records(source_score DESC);
CREATE INDEX idx_pain_unclustered ON pain_records(cluster_id) WHERE cluster_id IS NULL;

-- Opportunity clusters with rich descriptions
CREATE TABLE pain_clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Core problem definition
    centroid_text TEXT, -- Representative problem statement
    
    -- Rich description (v4 enhancement)
    core_problem TEXT, -- 1 sentence what's the problem
    who_experiences TEXT, -- Specific personas JSON
    how_often TEXT, -- Frequency/triggers
    what_theyve_tried TEXT, -- Workarounds JSON
    why_solutions_fail TEXT, -- Why existing solutions don't work
    
    -- Stats (updated dynamically as members are added)
    member_count INTEGER DEFAULT 0,
    unique_authors INTEGER DEFAULT 0,
    subreddit_count INTEGER DEFAULT 0,
    total_upvotes INTEGER DEFAULT 0, -- Sum of all member upvotes
    
    -- Average scores across members
    avg_severity REAL,
    avg_w2p REAL,
    avg_frequency REAL,
    
    -- Timestamps
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    
    -- Synthesis
    brief_summary TEXT,
    brief_personas TEXT, -- JSON array
    brief_workarounds TEXT, -- JSON array
    brief_open_questions TEXT, -- JSON array
    synthesized_at INTEGER,
    
    -- Top quotes for display (JSON array of {text, author, score, url})
    top_quotes TEXT,
    
    -- Scoring
    frequency_score REAL,
    severity_score REAL,
    economic_score REAL,
    solvability_score REAL,
    competitive_score REAL,
    au_fit_score REAL,
    total_score REAL,
    score_breakdown TEXT, -- Full scoring response JSON
    scored_at INTEGER
);

CREATE INDEX idx_clusters_score ON pain_clusters(total_score DESC);
CREATE INDEX idx_clusters_updated ON pain_clusters(updated_at DESC);
CREATE INDEX idx_clusters_members ON pain_clusters(member_count DESC);

-- Cluster membership tracking (for dynamic clustering)
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
INSERT INTO processing_state (key, value) VALUES ('pipeline_version', '4');

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
