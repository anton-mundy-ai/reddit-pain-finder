-- v12: MVP Feature Extraction
-- Extract actionable feature requirements from pain points

CREATE TABLE IF NOT EXISTS mvp_features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL,
  feature_name TEXT NOT NULL,
  feature_type TEXT NOT NULL,           -- must_have, nice_to_have, differentiator
  description TEXT,
  priority_score INTEGER NOT NULL DEFAULT 0,
  mention_count INTEGER NOT NULL DEFAULT 1,
  source_quotes TEXT,                   -- JSON array of quote snippets
  confidence REAL NOT NULL DEFAULT 0.5,
  extracted_at INTEGER NOT NULL,
  FOREIGN KEY (opportunity_id) REFERENCES pain_clusters(id),
  UNIQUE(opportunity_id, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_features_opp ON mvp_features(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_features_type ON mvp_features(feature_type);
CREATE INDEX IF NOT EXISTS idx_features_priority ON mvp_features(priority_score DESC);
