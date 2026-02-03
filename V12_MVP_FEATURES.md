# V12: MVP Feature Extraction

## Overview
Extracts actionable MVP feature requirements from pain points to help founders know what to build first.

## New Layer: `src/layers/mvp-features.ts`

### Feature Types
- 🔴 **Must-have**: Core features that directly solve the main pain. Without these, the product is useless.
- 🟡 **Nice-to-have**: Features users mentioned but aren't critical for launch.
- 🔵 **Differentiator**: Features that would beat existing solutions/competitors.

### Priority Score Calculation
```
priority = (mention_score + severity_score + confidence_score) × type_multiplier

Where:
- mention_score: 0-40 points based on log2(mention_count)
- severity_score: 0-30 points based on avg pain severity
- confidence_score: 0-20 points based on extraction confidence
- type_multiplier: must_have=1.5, differentiator=1.2, nice_to_have=0.8
```

## Database Updates

### New Table: `mvp_features`
```sql
CREATE TABLE mvp_features (
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
```

## New API Endpoints

### GET `/api/features`
Get all features across opportunities.

**Query params:**
- `limit` (default: 100)
- `type`: Filter by `must_have`, `nice_to_have`, or `differentiator`

**Response:**
```json
{
  "features": [...],
  "stats": {
    "total_features": 150,
    "by_type": { "must_have": 50, "nice_to_have": 60, "differentiator": 40 },
    "opportunities_with_features": 25,
    "avg_features_per_opportunity": 6.0,
    "top_priority_features": 20
  }
}
```

### GET `/api/opportunities/:id/features`
Get features for a specific opportunity.

**Response:**
```json
{
  "features": [...],
  "grouped": {
    "must_have": [...],
    "nice_to_have": [...],
    "differentiator": [...]
  },
  "total": 8
}
```

### POST `/api/trigger/extract-features`
Manually trigger feature extraction for opportunities.

### POST `/api/trigger/migrate-v12`
Run the v12 database migration to create the mvp_features table.

## UI Updates

### Opportunity Detail Page
New "🎯 MVP Feature Requirements" section showing:
- Features grouped by type (must-have, nice-to-have, differentiator)
- Priority score badge
- Mention count
- Expandable source quotes showing where the feature was mentioned

## Pipeline Integration

Feature extraction runs every 2nd cron cycle (offset from market sizing to spread API load):
```
cron % 2 === 1  → Extract MVP features
cron % 2 === 0  → Market sizing
```

## Example Output

For an opportunity like "AutoScheduler - AI-powered meeting scheduler":

### 🔴 Must-have
1. **Calendar Integration** (Priority: 85, 12 mentions)
   - "Sync with Google Calendar and Outlook"
   
2. **Automatic Time Zone Detection** (Priority: 72, 8 mentions)
   - "Stop the timezone confusion nightmare"

### 🟡 Nice-to-have
1. **Slack Integration** (Priority: 45, 4 mentions)
   - "Would be nice to schedule from Slack"

### 🔵 Differentiators
1. **Smart Rescheduling** (Priority: 68, 6 mentions)
   - "Calendly doesn't handle rescheduling well"
