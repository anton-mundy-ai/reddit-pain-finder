# Pain Finder v2.0 - Ticket Breakdown

## 🎫 Infrastructure (v1-v5)

### v1 - Docker Base Setup ✅ IN PROGRESS
- Create Dockerfile + docker-compose.yml
- Basic Node.js/TypeScript setup
- Environment variables
- Health check endpoint

### v2 - Reddit Scraper
- Implement Reddit API client
- Rate limiting (1 req/2s)
- Scrape r/australia + r/ausfinance (test)
- Store raw comments locally

### v3 - Multi-Subreddit Expansion
- Add ALL 50+ subreddits
- Rotating scrape schedule
- Track last scraped timestamp
- Verify diverse data collection

### v4 - HackerNews Scraper
- Implement HN API client
- Scrape Show HN, Ask HN
- Filter for complaints/pain points
- Store raw comments

### v5 - D1 Sync Service
- Cloudflare D1 HTTP API integration
- Batch insert optimization
- Retry logic on failures
- Sync status logging

---

## 🎫 Processing Pipeline (v6-v10)

### v6 - Pain Point Extraction
- GPT-5-nano integration
- isPainPoint() classifier
- Extract severity, topic, verbatim quote
- Store in pain_records table

### v7 - Topic Tagging
- GPT-5.2 for topic extraction
- Normalize topics (synonyms, stemming)
- Deduplicate similar topics
- Fix persona duplicates bug

### v8 - Embedding Generation
- OpenAI text-embedding-3-small
- Store embeddings in D1
- Batch processing for efficiency

### v9 - Clustering Layer
- Cosine similarity clustering
- Higher threshold (0.65+) for quality
- Merge similar clusters
- Track cluster growth

### v10 - Product Synthesis
- GPT-5.2 for product ideas
- 5+ mentions minimum
- Auto-iterate on new mentions
- Version tracking (v1→v2→v3)

---

## 🎫 Competitor Intelligence (v11-v13)

### v11 - Competitor Scraper
- Search patterns: "[Product] sucks", "hate [Product]"
- Target 35+ products
- Categories: Farming, Trades, Medical, etc.

### v12 - Feature Gap Extraction
- "I wish it had..." patterns
- Extract missing features
- Link to competitor products

### v13 - Competitor API + UI
- /api/competitors endpoint
- /api/feature-gaps endpoint
- UI: Competitor Gaps page

---

## 🎫 Analytics Features (v14-v17)

### v14 - Trend Detection
- Daily snapshots
- Velocity calculation
- Hot/rising/cooling classification
- Spike detection (3x normal)

### v15 - Trend UI
- Sparkline charts
- Status badges (🔥📈📉)
- Time period selector (7d/30d/90d)
- Trends page

### v16 - Market Sizing
- TAM/SAM/SOM estimates
- Industry benchmarks
- Confidence scoring
- $1M/$10M/$100M/$1B badges

### v17 - Geographic Analysis
- Location detection from content
- Region tagging (AU, US, UK, EU)
- AU-specific filter
- Geographic stats page

---

## 🎫 User Features (v18-v21)

### v18 - MVP Feature Extraction
- Must-have vs nice-to-have
- Differentiators
- Priority scoring
- Source quotes

### v19 - Landing Page Generator
- GPT-5.2 copy generation
- Headline + benefits + CTA
- Preview mode
- Copy-to-clipboard

### v20 - Outreach List Builder
- Extract Reddit usernames
- Fit score calculation
- Message templates
- CSV export

### v21 - Real-time Alerts
- Bell icon + unread count
- Alert triggers (new cluster, spike, gap)
- Mark as read functionality
- Alert history

---

## 🎫 API Fixes (v22-v24)

### v22 - Fix /topics Endpoint
- Rewrite problematic LIKE queries
- Proper pagination
- Performance optimization

### v23 - Fix Stats Bugs
- 0 authors/upvotes bug
- Proper COUNT(DISTINCT)
- SUM(source_score)

### v24 - Worker Cleanup
- Remove scraping from worker
- API-only mode
- Optimize cold starts

---

## 🎫 Design Overhaul (v25-v28)

### v25 - Design Research
- Dribbble/Awwwards research
- Screenshot inspiration
- Color palette selection
- Typography choices

### v26 - Component Library
- Card components
- Table components
- Form inputs
- Buttons/badges

### v27 - Layout Overhaul
- Sticky header
- Collapsible sidebar
- Mobile responsive
- Dark mode polish

### v28 - Animation & Polish
- Loading skeletons
- Hover effects
- Smooth transitions
- Empty states

---

## 🎫 Auth & Security (v29-v30)

### v29 - Cloudflare Access Setup
- Configure Zero Trust
- Email OTP authentication
- Access policies

### v30 - User Management
- users table
- Preferences storage
- Activity logging
- "Upgrade to Pro" placeholder

---

## 🎫 Final (v31-v35)

### v31 - Integration Test
- Test all endpoints
- Verify Docker→D1 flow
- Cross-browser testing

### v32 - Performance Audit
- Lighthouse score
- Query optimization
- Bundle size check

### v33 - Bug Fixes Round 1
- Fix discovered issues
- Edge cases

### v34 - Bug Fixes Round 2
- More fixes
- Polish

### v35 - Production Deploy
- Final verification
- Documentation
- Handoff

---

## 📊 Summary
- **35 small tickets** (was 19 big ones)
- **Sequential execution** with verification
- **Docker heavy lifting** in v1-v5
- **Each ticket = 1 focused task**
