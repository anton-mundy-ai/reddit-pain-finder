-- Migration: Add competitor_mentions table for v9
-- Feature: Competitor Complaint Mining

CREATE TABLE IF NOT EXISTS competitor_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    category TEXT,                    -- productivity, finance, crm, etc.
    complaint_text TEXT NOT NULL,
    source_type TEXT,                 -- reddit_post, reddit_comment, hn
    source_url TEXT,
    author TEXT,
    score INTEGER DEFAULT 0,
    sentiment TEXT,                   -- negative, frustrated, neutral
    feature_gap TEXT,                 -- extracted feature wish/gap
    created_at INTEGER NOT NULL,
    UNIQUE(source_url)                -- Prevent duplicates
);

CREATE INDEX IF NOT EXISTS idx_competitor_product ON competitor_mentions(product_name);
CREATE INDEX IF NOT EXISTS idx_competitor_category ON competitor_mentions(category);
CREATE INDEX IF NOT EXISTS idx_competitor_sentiment ON competitor_mentions(sentiment);
CREATE INDEX IF NOT EXISTS idx_competitor_feature_gap ON competitor_mentions(feature_gap) WHERE feature_gap IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competitor_score ON competitor_mentions(score DESC);
