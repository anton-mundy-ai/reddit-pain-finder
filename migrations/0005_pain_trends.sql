-- Migration: Add pain_trends table for v10
-- Feature: Trend Detection - Track rising/cooling pain points

-- Daily snapshots of topic mention counts
CREATE TABLE IF NOT EXISTS pain_trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_canonical TEXT NOT NULL,
    cluster_id INTEGER,               -- Optional link to cluster
    
    -- Snapshot data
    snapshot_date TEXT NOT NULL,      -- YYYY-MM-DD
    bucket_type TEXT DEFAULT 'daily', -- 'daily' or 'weekly'
    mention_count INTEGER NOT NULL,   -- Total mentions as of snapshot
    new_mentions INTEGER DEFAULT 0,   -- New mentions since last snapshot
    
    -- Velocity metrics
    velocity REAL,                    -- Growth rate: (this - prev) / prev
    velocity_7d REAL,                 -- 7-day rolling velocity
    velocity_30d REAL,                -- 30-day rolling velocity
    
    -- Trend classification
    trend_status TEXT,                -- 'hot', 'rising', 'stable', 'cooling', 'cold'
    is_spike INTEGER DEFAULT 0,       -- 1 if sudden spike detected (3x normal)
    
    -- Context
    avg_severity REAL,                -- Average severity of recent mentions
    subreddit_spread INTEGER,         -- Number of unique subreddits
    
    created_at INTEGER NOT NULL,
    
    UNIQUE(topic_canonical, snapshot_date, bucket_type)
);

CREATE INDEX IF NOT EXISTS idx_trends_topic ON pain_trends(topic_canonical);
CREATE INDEX IF NOT EXISTS idx_trends_date ON pain_trends(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_trends_status ON pain_trends(trend_status);
CREATE INDEX IF NOT EXISTS idx_trends_velocity ON pain_trends(velocity DESC);
CREATE INDEX IF NOT EXISTS idx_trends_spike ON pain_trends(is_spike) WHERE is_spike = 1;

-- Aggregated trend summary (materialized view pattern)
CREATE TABLE IF NOT EXISTS trend_summary (
    topic_canonical TEXT PRIMARY KEY,
    cluster_id INTEGER,
    
    -- Current state
    current_count INTEGER,
    current_velocity REAL,
    trend_status TEXT,
    
    -- Historical peaks
    peak_count INTEGER,
    peak_date TEXT,
    
    -- Tracking
    first_seen TEXT,                  -- First snapshot date
    last_updated INTEGER,
    
    -- Display data
    sparkline TEXT                    -- JSON array of last 30 daily counts
);

CREATE INDEX IF NOT EXISTS idx_summary_status ON trend_summary(trend_status);
CREATE INDEX IF NOT EXISTS idx_summary_velocity ON trend_summary(current_velocity DESC);

-- Add state tracking for trend snapshots
INSERT OR IGNORE INTO processing_state (key, value, updated_at) VALUES ('last_trend_snapshot', '0', 0);
