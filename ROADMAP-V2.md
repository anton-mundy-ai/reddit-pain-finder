# Pain Finder v2.0 - Full Roadmap

## Architecture
```
┌─────────────────────────────────────────────────────────────┐
│              SERVER (Docker - Heavy Lifting)                 │
│  - Scrapes ALL 50+ subreddits continuously                  │
│  - HackerNews scraping                                       │
│  - GPT processing (no time limits)                          │
│  - Competitor complaint mining                               │
│  - Pushes to D1 via API                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              CLOUDFLARE (API + Frontend)                     │
│  - Worker: API endpoints only                               │
│  - D1: Database storage                                      │
│  - Pages: Frontend UI                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Infrastructure (v1-v3)

### v1 - Docker Ingestion Service
- [ ] Docker container on server
- [ ] Scrape ALL 50+ subreddits (not just r/australia!)
- [ ] HackerNews scraping
- [ ] Rate limiting (1 req/2s)
- [ ] Job queue for processing
- [ ] Sync to D1 via Cloudflare API

### v2 - D1 Sync Verification
- [ ] Verify data flowing to D1
- [ ] Check multi-subreddit data
- [ ] Test sync reliability
- [ ] Add retry logic

### v3 - Fix Worker (API Only)
- [ ] Remove scraping from worker
- [ ] Keep API endpoints only
- [ ] Fix /topics endpoint
- [ ] Real domain: ideas.koda-software.com ✅

---

## Phase 2: Core Features (v4-v8)

### v4 - Pain Extraction + Clustering
- [ ] GPT-5-nano for pain detection
- [ ] Higher similarity threshold (quality > quantity)
- [ ] 500+ comments per post target
- [ ] Fix 0 authors/upvotes bug
- [ ] Fix persona duplicates

### v5 - Competitor Mining
- [ ] Monitor 35+ competitor products
- [ ] Extract complaints from Reddit/HN
- [ ] Categories: Farming, Trades AU, Real Estate, Medical, Accounting, Gyms, Construction
- [ ] Feature gap detection

### v6 - Trend Detection
- [ ] Track velocity (growth rate)
- [ ] Hot/rising/cooling classification
- [ ] Spike detection (3x normal)
- [ ] Sparkline charts

### v7 - Market Sizing
- [ ] TAM/SAM/SOM estimates
- [ ] Industry benchmarks
- [ ] Confidence scoring
- [ ] Market size badges

### v8 - MVP Features
- [ ] Extract must-have features
- [ ] Nice-to-have features
- [ ] Differentiators
- [ ] Priority scoring
- [ ] Auto-iterate on every new mention

---

## Phase 3: User Features (v9-v12)

### v9 - Landing Page Generator
- [ ] GPT-5.2 for copy generation
- [ ] Headline + subheadline
- [ ] Benefits from features
- [ ] Social proof section
- [ ] CTA text
- [ ] Copy-to-clipboard

### v10 - Real-time Alerts
- [ ] Bell icon with unread count
- [ ] Alert triggers:
  - New qualifying cluster (5+ mentions)
  - Trend spike (3x volume)
  - New competitor gap
  - High-severity pain point
- [ ] Email notifications (optional)

### v11 - Outreach List
- [ ] Extract Reddit usernames
- [ ] Fit score calculation
- [ ] Outreach message templates
- [ ] CSV export
- [ ] Contact status tracking

### v12 - Geographic Analysis
- [ ] Detect locations from content
- [ ] Region tagging (AU, US, UK, EU, Global)
- [ ] AU-specific focus
- [ ] Geographic filter in UI

---

## Phase 4: Polish (v13-v14)

### v13 - Design Overhaul (HEAVY)
- [ ] Research: Dribbble, Awwwards
- [ ] AI design tools: Midjourney, Figma AI
- [ ] Professional SaaS aesthetic (Linear, Vercel, Stripe)
- [ ] Component library
- [ ] Modern color palette (dark mode)
- [ ] Smooth animations
- [ ] Loading skeletons
- [ ] Mobile responsive

### v14 - Auth & Signup
- [ ] Cloudflare Access (free tier)
- [ ] Email OTP authentication
- [ ] User table (email, plan, preferences)
- [ ] Protected routes
- [ ] "Upgrade to Pro" placeholder

---

## Phase 5: Final (v15-v19)

### v15 - Full Integration Test
- [ ] Test all endpoints
- [ ] Verify Docker → D1 sync
- [ ] UI functionality check
- [ ] Mobile testing
- [ ] Performance audit

### v16-v19 - Bug Fixes & Verification
- [ ] Fix any discovered issues
- [ ] Autonomous fixes allowed
- [ ] Production hardening
- [ ] Final deploy

---

## Critical Fixes (apply throughout)
1. 🔧 UI bugs (0 authors/upvotes, persona dupes)
2. 🔧 /topics endpoint
3. 📈 More scraping (500+ comments/post)
4. 🔒 Private GitHub repo ✅
5. 🌐 Real domain ✅
6. ⬆️ Higher similarity threshold
7. 🔄 Auto-iterate on new mentions

---

## Subreddits (50+)
**Tech:** programming, webdev, sysadmin, devops, cscareerquestions, learnprogramming, javascript, reactjs, node, aws

**Business:** entrepreneur, startups, smallbusiness, sales, marketing, freelance, consulting, saas, indiehackers

**Help/Rants:** techsupport, personalfinance, legaladvice, advice, rant, antiwork, workfromhome

**Australia:** australia, ausfinance, ausbiz, melbourne, sydney, brisbane, perth, adelaide, canberra, tasmania

**Verticals:** accounting, realestate, construction, healthcare, fitness, gym, farming, agriculture

---

## Competitor Products (35+)
- **Farming:** John Deere, Granular, FarmLogs, Climate FieldView
- **Trades AU:** ServiceM8, Tradify, Fergus, simPRO
- **Real Estate AU:** PropertyMe, Console Cloud, MRI Software
- **Medical AU:** Cliniko, Halaxy, Nookal
- **Accounting AU:** MYOB, Reckon, Xero
- **Gyms:** Mindbody, Glofox, Gymmaster
- **Construction:** Procore, Buildertrend, CoConstruct
- **General SaaS:** Slack, Asana, Notion, Trello, Monday
