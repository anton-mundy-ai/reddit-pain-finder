# v9: Competitor Complaint Mining

## Feature Overview
Find people complaining about existing products = validated pain + **proven willingness to pay**.

## What's New

### New Database Table: `competitor_mentions`
```sql
- id, product_name, category, complaint_text
- source_type (reddit_post, hn), source_url, author, score
- sentiment (negative, frustrated, neutral)
- feature_gap (extracted wishes/gaps)
- created_at
```

### New Layer: `src/layers/competitor-mining.ts`
- Searches Reddit and HackerNews for product complaints
- 35+ target products across 9 categories
- Complaint patterns: "sucks", "alternative", "hate", "frustrated with", etc.
- Sentiment detection
- Feature gap extraction ("I wish it had...", "It doesn't do...")

### Target Products
| Category | Products |
|----------|----------|
| Productivity | Notion, Slack, Asana, Trello, Monday, ClickUp |
| Finance | QuickBooks, Xero, FreshBooks, Wave |
| CRM | Salesforce, HubSpot, Pipedrive |
| Email | Mailchimp, ConvertKit, ActiveCampaign |
| Dev | Jira, GitHub Issues, Linear |
| Design | Figma, Canva, Adobe |
| Scheduling | Calendly, Acuity |
| Forms | Typeform, Google Forms, JotForm |
| Analytics | Google Analytics, Mixpanel, Amplitude |

### API Endpoints
- `GET /api/competitors` - List products with complaint counts
- `GET /api/competitors/:product` - Complaints for specific product
- `GET /api/feature-gaps` - Aggregated feature gaps
- `POST /api/trigger/mine-competitors` - Manual trigger
- `POST /api/trigger/migrate-v9` - Create table

### Frontend
- New **Competitor Gaps** tab in navigation
- Three sub-tabs:
  1. **Products** - Products ranked by complaint count, with detail panel
  2. **Feature Gaps** - Extracted feature wishes/gaps
  3. **Categories** - Breakdown by product category
- Sentiment badges (negative/frustrated/neutral)
- Feature gap highlighting

### Cron Integration
- Runs every 3rd cron execution
- Mines 5 products per cycle
- Rotates through full product list

## URLs
- **API**: https://ideas.koda-software.com/api/competitors
- **UI**: https://reddit-pain-finder-ui.pages.dev/competitors
- **GitHub**: https://github.com/anton-mundy-ai/reddit-pain-finder

## Current Stats (as of deployment)
- 130+ complaints mined
- 4 products with data (Notion, Slack, Asana, Trello)
- 5 feature gaps extracted
- Sentiment breakdown available per product

## Future Improvements
1. Better feature gap extraction (reduce noise from word collisions like "asana" yoga)
2. Link competitor gaps to pain_clusters for product opportunity synthesis
3. Add competitor_source flag to pain_records
4. Time-series tracking of complaint trends
