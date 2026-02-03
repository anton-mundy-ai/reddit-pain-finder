-- Migration: Add market_estimates table for v11
-- Feature: Market Sizing - TAM/SAM/SOM estimates for opportunities

CREATE TABLE IF NOT EXISTS market_estimates (
    cluster_id INTEGER PRIMARY KEY,
    
    -- TAM (Total Addressable Market)
    tam_estimate INTEGER NOT NULL,        -- USD value
    tam_tier TEXT NOT NULL,               -- '$1M', '$10M', '$100M', '$1B', '$10B+'
    
    -- SAM (Serviceable Addressable Market)
    sam_estimate INTEGER NOT NULL,
    sam_tier TEXT NOT NULL,
    
    -- SOM (Serviceable Obtainable Market)
    som_estimate INTEGER NOT NULL,
    som_tier TEXT NOT NULL,
    
    -- Classification
    confidence REAL NOT NULL,             -- 0.0-1.0 confidence score
    category TEXT NOT NULL,               -- Pain category (b2b_saas_enterprise, consumer_mass, etc.)
    geo_scope TEXT NOT NULL,              -- global, us_only, english_speaking, regional
    industry_vertical TEXT,               -- Specific industry name
    
    -- Explanation
    reasoning TEXT,                       -- Human-readable explanation
    
    -- Metadata
    estimated_at INTEGER NOT NULL,        -- Timestamp of estimation
    
    FOREIGN KEY (cluster_id) REFERENCES pain_clusters(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_market_tam ON market_estimates(tam_estimate DESC);
CREATE INDEX IF NOT EXISTS idx_market_tier ON market_estimates(tam_tier);
CREATE INDEX IF NOT EXISTS idx_market_category ON market_estimates(category);
CREATE INDEX IF NOT EXISTS idx_market_confidence ON market_estimates(confidence DESC);
