# Reddit Pain Point Finder v2

A comprehensive 6-layer Reddit analysis pipeline that identifies, classifies, clusters, and ranks business pain points and opportunities.

## Architecture

### Layer 1: Ingestion
- Fetches posts and comments from 15 targeted subreddits
- Rate-limited to respect Reddit's API limits (1 req/sec)
- Stores raw data in D1

### Layer 2: Normalization + Filtering
- Language detection (English + AU slang)
- Content quality filtering
- GPT-5-nano classification for pain point detection
- Categorizes: complaint, recommendation_ask, rant, how_to

### Layer 3: Extraction
- Extracts structured pain records
- Problem statement, persona, context
- Severity and frequency signals
- Current workarounds and willingness-to-pay hints

### Layer 4: Clustering
- Uses Cloudflare Vectorize for semantic embeddings
- Groups similar pain points together
- Similarity threshold: 0.75

### Layer 5: Synthesis
- Generates opportunity briefs per cluster
- Auto-summary with top quotes
- Identifies common personas and workarounds

### Layer 6: Scoring
Multi-factor ranking:
- Frequency (unique authors, cross-subreddit)
- Severity (urgency, blocking language)
- Economic value (B2B potential, explicit mentions)
- Solvability (clear problem definition)
- Competition gap (existing solutions inadequate)
- AU fit (Australian market relevance)

## Subreddits Monitored

**Business:**
- r/Entrepreneur
- r/smallbusiness
- r/startups

**Australia:**
- r/australia
- r/melbourne
- r/sydney
- r/brisbane
- r/perth
- r/adelaide
- r/AusFinance

**Agriculture:**
- r/homestead
- r/farming
- r/agriculture
- r/tractors
- r/ranching

## Tech Stack

- Cloudflare Workers + D1 + Vectorize + Pages
- OpenAI GPT-5-nano for classification and synthesis
- Cron: Every 30 minutes

## Development

```bash
npm install
npm run dev          # Local dev server
npm run test         # Run tests
npm run deploy       # Deploy to production
```

## API Endpoints

- `GET /api/opportunities` - List ranked opportunities
- `GET /api/opportunities/:id` - Get detailed opportunity brief
- `GET /api/stats` - Dashboard statistics
- `POST /trigger/ingest` - Manual pipeline trigger

## Dashboard

Visit `ideas.koda-software.com` for the interactive dashboard.
