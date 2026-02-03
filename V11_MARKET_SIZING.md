# v11: Market Sizing Feature

## Summary
Added market sizing estimates to help prioritize opportunities by potential revenue.

## Features

### Market Data Layer (`src/layers/market-sizing.ts`)
- **TAM/SAM/SOM Estimation**: Calculates Total Addressable Market, Serviceable Addressable Market, and Serviceable Obtainable Market
- **GPT-5-nano Classification**: Categorizes pain points into:
  - `b2b_saas_enterprise` - Enterprise SaaS ($100B industry)
  - `b2b_saas_smb` - SMB SaaS ($50B)
  - `b2b_saas_startup` - Startup tools ($10B)
  - `consumer_mass` - Mass consumer ($500B)
  - `consumer_niche` - Niche consumer ($5B)
  - `prosumer` - Professional consumers ($20B)
  - `developer_tools` - Dev tools ($50B)
  - `fintech` - Financial technology ($200B)
  - `healthtech` - Health & wellness ($150B)
  - `ecommerce` - E-commerce ($300B)
  - `productivity` - Productivity tools ($40B)
  - `education` - EdTech ($30B)
  - `gaming` - Gaming ($200B)

- **Geographic Scope**: global, us_only, english_speaking, regional
- **Market Tiers**: $1M, $10M, $100M, $1B, $10B+
- **Confidence Scores**: 0-1 based on classification certainty

### Database (`migrations/0006_market_estimates.sql`)
```sql
CREATE TABLE market_estimates (
    cluster_id INTEGER PRIMARY KEY,
    tam_estimate INTEGER NOT NULL,
    tam_tier TEXT NOT NULL,
    sam_estimate INTEGER NOT NULL,
    sam_tier TEXT NOT NULL,
    som_estimate INTEGER NOT NULL,
    som_tier TEXT NOT NULL,
    confidence REAL NOT NULL,
    category TEXT NOT NULL,
    geo_scope TEXT NOT NULL,
    industry_vertical TEXT,
    reasoning TEXT,
    estimated_at INTEGER NOT NULL
);
```

### API Endpoints
- `GET /api/market` - All market estimates with stats
- `GET /api/market/:id` - Specific opportunity estimate
- `POST /api/trigger/estimate-markets` - Manually run estimation
- `POST /api/trigger/migrate-v11` - Create market_estimates table
- `GET /api/opportunities?sort=market` - Sort by market size

### UI Updates
- Market size badge on opportunity cards ($10M, $100M, etc.)
- Sort by market size option in dropdown
- Market size breakdown in expanded view (TAM/SAM/SOM)
- Market sizing stats in header stats row

## Deployment

### 1. Run Migration
```bash
curl -X POST https://ideas.koda-software.com/api/trigger/migrate-v11
```

### 2. Estimate Markets
```bash
curl -X POST https://ideas.koda-software.com/api/trigger/estimate-markets
```

### 3. Deploy Worker (requires valid CF token)
```bash
cd reddit-pain-finder
npx wrangler deploy
```

### 4. Deploy Frontend
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=reddit-pain-finder-ui
```

## Example Market Estimates

| Product | Category | TAM Tier | SAM Tier | SOM Tier | Confidence |
|---------|----------|----------|----------|----------|------------|
| DevOps Pipeline Optimizer | developer_tools | $1B | $100M | $10M | 75% |
| ADHD Focus App | healthtech | $100M | $10M | $1M | 80% |
| Freelancer Invoice Tool | prosumer | $100M | $10M | $1M | 70% |
| Enterprise Security Dashboard | b2b_saas_enterprise | $10B+ | $1B | $100M | 65% |

## Estimation Logic

1. **Classify** pain point category using GPT-5-nano
2. **Start** with industry baseline TAM from benchmarks
3. **Apply** geographic multiplier (global=1.0, us_only=0.35, etc.)
4. **Adjust** for specificity based on subreddit spread
5. **Calculate** SAM as 10-40% of TAM (B2B gets higher %)
6. **Calculate** SOM based on social proof count:
   - 50+ mentions → 5% of SAM
   - 20+ mentions → 3% of SAM
   - 10+ mentions → 2% of SAM
   - <10 mentions → 1% of SAM

## Pipeline Integration

Market sizing runs every 2nd cron cycle to conserve API calls. It only estimates:
- Clusters with 5+ members
- Clusters with product names
- Clusters that haven't been estimated in the last 7 days
