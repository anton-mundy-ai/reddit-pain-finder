# Reddit Pain Finder v7 - Embeddings & Smart Clustering

## Status: CODE COMPLETE ✅ | DEPLOYMENT BLOCKED 🚫

The v7 upgrade code is complete but cannot be deployed due to missing API token permissions for Workers deployment.

## What Was Implemented

### 1. Embedding System ✅
**File: `src/utils/embeddings.ts`**
- `generateEmbedding(text)` - Generates 1536-dim embeddings using `text-embedding-3-small`
- `generateEmbeddingsBatch(texts)` - Batch generation for efficiency
- `storeEmbedding()` - Stores embeddings in D1 (compressed JSON)
- `findSimilarRecords()` - Cosine similarity search
- `cosineSimilarity()` - Vector math helper
- `getAllEmbeddings()` - Bulk retrieval for cluster merging

### 2. Topic Normalization ✅
**File: `src/utils/normalize.ts`**
- `SYNONYM_MAP` - Maps 50+ common synonyms (client→customer, money→payment, etc.)
- `normalizeTopic(topic)` - Normalizes topics with stemming + synonyms
- `topicsMatch(a, b)` - Checks semantic similarity (60%+ Jaccard)
- `extractBroadCategory(topic)` - Maps to 10 broad categories
- `groupSimilarTopics(topics)` - Groups for merging

### 3. Semantic Clustering ✅
**File: `src/layers/clustering.ts`**
- Generates embedding for each new pain point
- Queries similar vectors (similarity > 0.80)
- Joins existing cluster or creates new one
- Updates cluster stats with similarity scores
- `mergeSimularClusters()` - Consolidates similar clusters

### 4. Topic Merge Layer ✅
**File: `src/layers/topic-merge.ts`**
- Runs every 6th cron cycle
- Rule-based normalization pass
- GPT-5.2 identifies remaining duplicates
- Merges clusters with matching canonical topics
- `shouldRunTopicMerge()` / `incrementCronCount()` for scheduling

### 5. Database Schema ✅
**File: `schema.sql` + `migrations/v7-embeddings.sql`**

New table:
```sql
CREATE TABLE embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pain_record_id INTEGER NOT NULL UNIQUE,
    vector TEXT NOT NULL,  -- JSON array, 1536 floats
    created_at INTEGER NOT NULL
);
```

New columns:
- `pain_records.embedding_id` - FK to embeddings
- `pain_records.normalized_topic` - Canonical topic
- `pain_clusters.topic_canonical` - Normalized topic
- `pain_clusters.broad_category` - Category for filtering
- `pain_clusters.centroid_embedding_id` - Cluster centroid

### 6. API Updates ✅
**File: `src/index.ts`**

New endpoints:
- `POST /api/trigger/merge` - Run topic merge manually
- `POST /api/trigger/recluster` - Re-cluster all existing data
- `POST /api/trigger/migrate-v7` - Apply schema migrations
- `GET /api/opportunities?all=true` - Show all clusters (bypass 5+ filter)

Updated stats:
- `embeddings` - Count of generated embeddings
- `avg_cluster_size` - Average mentions per cluster

### 7. Frontend Updates ✅
**Files: `frontend/src/pages/HomePage.tsx`, `frontend/src/components/OpportunityRow.tsx`**
- Toggle: "Show all clusters" vs "5+ mentions only"
- Default sort by mentions (most social proof first)
- Cluster cohesion indicator (average similarity)
- Prominent mention count badges with color coding
- Cluster distribution chart

## Files Modified/Created

```
src/
├── index.ts                      # Updated with new endpoints
├── types.ts                      # Added embedding fields
├── layers/
│   ├── clustering.ts             # Complete rewrite for embeddings
│   └── topic-merge.ts            # NEW
├── utils/
│   ├── embeddings.ts             # NEW
│   └── normalize.ts              # NEW
schema.sql                        # Updated with new tables/columns
migrations/
└── v7-embeddings.sql             # NEW
frontend/
└── src/
    ├── api.ts                    # Updated for new params
    ├── types.ts                  # Updated with new fields
    ├── pages/HomePage.tsx        # Updated with filter toggle
    └── components/OpportunityRow.tsx  # Updated with cohesion display
```

## To Deploy

The API token needs these permissions:
- Workers Scripts: Edit
- D1: Edit (already has)
- Account Settings: Read

Current token only has D1 read access.

### Deployment Commands
```bash
# Apply schema migration
curl -X POST https://ideas.koda-software.com/api/trigger/migrate-v7

# Re-cluster existing data with embeddings
curl -X POST https://ideas.koda-software.com/api/trigger/recluster

# Or run full pipeline
curl -X POST https://ideas.koda-software.com/api/trigger/full
```

## Expected Results

Before v7:
- 156 pain points → 76+ clusters (1-2 mentions each avg)

After v7:
- 156 pain points → ~15-25 clusters (5-15 mentions each)
- Clusters grouped by semantic meaning
- Real social proof (5+ unique mentions)

## Costs (Estimated)

- Embedding generation: ~$0.02 for 200 pain points
- Topic merge (GPT-5.2): ~$0.05 per run
- Total: <$1/month at current volume
