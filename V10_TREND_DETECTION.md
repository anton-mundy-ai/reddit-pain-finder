# v10: Trend Detection

## Overview
Added trend detection to identify **rising pain points** and **emerging opportunities** by tracking mention counts over time.

## New Tables

### `pain_trends`
Daily snapshots of topic mention counts with velocity metrics.

| Column | Type | Description |
|--------|------|-------------|
| topic_canonical | TEXT | Normalized topic name |
| cluster_id | INTEGER | Link to pain_clusters |
| snapshot_date | TEXT | YYYY-MM-DD |
| mention_count | INTEGER | Total mentions |
| new_mentions | INTEGER | New since last snapshot |
| velocity | REAL | Daily growth rate |
| velocity_7d | REAL | 7-day rolling velocity |
| velocity_30d | REAL | 30-day rolling velocity |
| trend_status | TEXT | hot/rising/stable/cooling/cold |
| is_spike | INTEGER | 1 if sudden spike (3x normal) |

### `trend_summary`
Aggregated view of current trend state per topic.

## Velocity Calculation
```
velocity = (this_period - last_period) / last_period
```

## Trend Classification
| Status | Velocity | Description |
|--------|----------|-------------|
| 🔥 Hot | ≥50% or spike | Rapidly growing |
| 📈 Rising | 10-50% | Steady growth |
| ➖ Stable | -10% to +10% | No significant change |
| 📉 Cooling | -10% to -30% | Declining interest |
| ❄️ Cold | < -30% | Significant decline |

## Spike Detection
A spike is detected when:
- New mentions ≥ 3x the 7-day daily average, OR
- ≥5 new mentions when no historical average exists

## API Endpoints

### `GET /api/trends`
Get all trends with filtering.

Query params:
- `status`: all | hot | rising | stable | cooling
- `limit`: number (default 50)
- `period`: 7d | 30d | 90d

### `GET /api/trends/hot`
Get only hot/rising topics.

### `GET /api/trends/cooling`
Get declining topics.

### `GET /api/trends/history/:topic`
Get historical data for a specific topic.

Query params:
- `days`: number (default 90)

### `POST /api/trigger/snapshot-trends`
Manually trigger a trend snapshot.

### `POST /api/trigger/migrate-v10`
Run the v10 database migration.

## Cron Integration
Trend snapshots run automatically at the end of each pipeline execution (Step 7).
- Runs every 30 minutes (existing cron)
- Daily snapshots are deduplicated by date
- Weekly velocity recalculated from 7-day data

## UI Features
New `/trends` page with:
- Stats summary: hot/rising/stable/cooling counts
- Sparkline charts for each topic (30-day view)
- Status badges with icons
- Period selector (7d/30d/90d)
- Click-through to opportunity detail
- History modal for detailed view

## Migration

Run the migration endpoint:
```bash
curl -X POST https://ideas.koda-software.com/api/trigger/migrate-v10
```

Then trigger first snapshot:
```bash
curl -X POST https://ideas.koda-software.com/api/trigger/snapshot-trends
```

## Files Changed
- `migrations/0005_pain_trends.sql` - New tables
- `src/layers/trend-detection.ts` - Trend detection layer
- `src/index.ts` - API endpoints + cron integration
- `frontend/src/pages/TrendsPage.tsx` - UI page
- `frontend/src/api.ts` - API client
- `frontend/src/types.ts` - Type definitions
- `frontend/src/App.tsx` - Route
- `frontend/src/components/Layout.tsx` - Navigation
