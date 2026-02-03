-- v18: Users & Authentication (Cloudflare Access)
-- ================================================

-- Users table for tracking authenticated users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',           -- free, pro (for future)
    preferences TEXT,                             -- JSON: theme, notifications, etc.
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen DESC);

-- User sessions/activity log (optional, for analytics)
CREATE TABLE IF NOT EXISTS user_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,                         -- view_opportunity, search, export, etc.
    resource_id INTEGER,                          -- opportunity_id, etc.
    metadata TEXT,                                -- JSON: additional context
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON user_activity(action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity(created_at DESC);
