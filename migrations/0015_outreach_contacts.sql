-- v15: Outreach Contacts Table
-- Track Reddit users who expressed pain points for founder outreach

CREATE TABLE IF NOT EXISTS outreach_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    opportunity_id INTEGER NOT NULL,
    
    -- Fit scoring
    fit_score INTEGER NOT NULL DEFAULT 0,      -- 0-100
    pain_severity TEXT,                         -- critical/high/medium/low
    engagement_score INTEGER DEFAULT 0,         -- upvotes on their post
    recency_score INTEGER DEFAULT 0,            -- how recent the post was
    
    -- Source info
    source_post_url TEXT NOT NULL,
    pain_expressed TEXT NOT NULL,               -- The actual quote
    subreddit TEXT,
    post_created_at INTEGER,
    
    -- Outreach status
    outreach_status TEXT NOT NULL DEFAULT 'pending',  -- pending/contacted/responded/declined
    contacted_at INTEGER,
    responded_at INTEGER,
    notes TEXT,
    
    -- Metadata
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    FOREIGN KEY (opportunity_id) REFERENCES pain_clusters(id),
    UNIQUE(username, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_outreach_opportunity ON outreach_contacts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_outreach_username ON outreach_contacts(username);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_contacts(outreach_status);
CREATE INDEX IF NOT EXISTS idx_outreach_fit_score ON outreach_contacts(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_recency ON outreach_contacts(post_created_at DESC);
