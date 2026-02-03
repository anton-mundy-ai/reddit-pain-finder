-- v7 Migration: Add embedding support and normalize topics
-- Run this on existing databases

-- Add embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pain_record_id INTEGER NOT NULL UNIQUE,
    vector TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (pain_record_id) REFERENCES pain_records(id)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_record ON embeddings(pain_record_id);

-- Add new columns to pain_records
ALTER TABLE pain_records ADD COLUMN embedding_id INTEGER;
ALTER TABLE pain_records ADD COLUMN normalized_topic TEXT;

-- Add new columns to pain_clusters
ALTER TABLE pain_clusters ADD COLUMN topic_canonical TEXT;
ALTER TABLE pain_clusters ADD COLUMN broad_category TEXT;
ALTER TABLE pain_clusters ADD COLUMN centroid_embedding_id INTEGER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pain_embedding ON pain_records(embedding_id);
CREATE INDEX IF NOT EXISTS idx_pain_normalized_topic ON pain_records(normalized_topic);
CREATE INDEX IF NOT EXISTS idx_clusters_topic ON pain_clusters(topic_canonical);
CREATE INDEX IF NOT EXISTS idx_clusters_category ON pain_clusters(broad_category);
CREATE INDEX IF NOT EXISTS idx_clusters_social_proof ON pain_clusters(social_proof_count DESC);

-- Add cron counter for topic merge scheduling
INSERT OR IGNORE INTO processing_state (key, value, updated_at) VALUES ('cron_count', '0', 0);
