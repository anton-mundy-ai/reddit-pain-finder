# v9.2: Deep Niche Competitor Complaint Mining

## Concept
Find people complaining about existing products = validated pain + **proven willingness to pay**.

**The niche advantage:** Smaller verticals have passionate users with specific pain points = less competition for solutions!

## What's New in v9.2

### Deep Niche Search
Instead of just searching Reddit-wide, we now:
1. Identify **specific subreddits** where each vertical's users hang out
2. Search **within those subreddits** for product mentions
3. Extract complaints with software context filtering

### 19 Niche Verticals

| Vertical | Products | Subreddits |
|----------|----------|------------|
| **Farming** | John Deere, Granular, FarmLogs, Bushel, AgriWebb | r/farming, r/agriculture, r/homestead, r/tractors, r/ranching |
| **Trades** | ServiceM8, Tradify, Fergus, simPRO, ServiceTitan, Jobber | r/HVAC, r/electricians, r/Plumbing, r/Construction |
| **Healthcare** | Cliniko, Jane App, Halaxy, Nookal, Practice Better | r/physicaltherapy, r/chiropractic, r/massage, r/dietetics |
| **Fitness** | Mindbody, Glofox, Wodify, PushPress, Zen Planner | r/gymowner, r/crossfit, r/yoga, r/personaltraining |
| **Beauty** | Vagaro, Fresha, Booksy, Boulevard, GlossGenius | r/hairstylist, r/Estheticians, r/Nails, r/salons |
| **Hospitality** | Toast, TouchBistro, 7shifts, Lightspeed Restaurant | r/restaurateur, r/bartenders, r/KitchenConfidential |
| **Real Estate** | PropertyMe, Buildium, AppFolio, Rent Manager, Yardi | r/realtors, r/propertymanagement, r/landlords |
| **Legal** | Clio, PracticePanther, LEAP, MyCase, Smokeball | r/lawyers, r/LawFirm, r/paralegal |
| **Accounting** | MYOB, Xero, QuickBooks, Karbon, Canopy, TaxDome | r/Accounting, r/Bookkeeping, r/taxpros |
| **Nonprofit** | Planning Center, Pushpay, Bloomerang, Tithe.ly | r/nonprofit, r/church, r/pastors |
| **Education** | TutorBird, My Music Staff, Teachworks, TakeLessons | r/Teachers, r/tutors, r/musicteachers |
| **Pet** | Gingr, Time To Pet, PetDesk, eVetPractice | r/doggrooming, r/petsitting, r/DogTraining, r/veterinary |
| **Photography** | HoneyBook, Dubsado, 17hats, Studio Ninja, ShootProof | r/photography, r/WeddingPhotography |
| **Cleaning** | Jobber, ZenMaid, Swept, CleanGuru, Launch27 | r/CleaningTips, r/CommercialCleaning, r/MaidService |
| **Moving** | MoveitPro, Supermove, MoverBase, SmartMoving | r/moving, r/logistics, r/Truckers |
| **Construction** | Procore, Buildertrend, CoConstruct, PlanGrid | r/Construction, r/Contractors, r/Carpentry |
| **Automotive** | Shop-Ware, Mitchell 1, Tekmetric, Shopmonkey | r/MechanicAdvice, r/AutoMechanics |
| **Dental** | Dentrix, Open Dental, Eaglesoft, Curve Dental | r/Dentistry, r/DentalHygiene |
| **Schools** | Compass, SEQTA, Canvas, Schoology, PowerSchool | r/Teachers, r/education, r/edtech |

### Software Context Filtering
Ambiguous product names (Wave, Granular, Bushel, etc.) now require software-related context to avoid false positives:
- Must include words like: software, app, platform, integration, api, dashboard, feature, bug, etc.
- Or patterns like: "using [Product]", "[Product] app", "switched to [Product]"

## Current Stats (as of deployment)
- **416 complaints** mined
- **13 products** tracked
- **32 feature gaps** extracted
- **3 categories** active (farming leading with 161 complaints!)

### Farming Vertical Highlights 🚜
- **John Deere**: 79 complaints, 6 feature gaps
- **Granular**: 36 complaints, 11 feature gaps  
- **Bushel**: 38 complaints, 3 feature gaps
- **FarmLogs**: 8 complaints, 2 feature gaps

## Cron Schedule
- Mines **3 verticals per cycle**
- Runs every 3rd cron (every 90 minutes)
- Rotates through all 19 verticals
- Full rotation: ~6 cycles = ~9 hours

## URLs
- **UI**: https://reddit-pain-finder-ui.pages.dev/competitors
- **API**: https://ideas.koda-software.com/api/competitors
- **Feature Gaps**: https://ideas.koda-software.com/api/feature-gaps

## API Endpoints
- `GET /api/competitors` - List products with complaint counts by category
- `GET /api/competitors/:product` - Complaints for specific product
- `GET /api/feature-gaps` - Aggregated feature gaps (real product opportunities!)
- `POST /api/trigger/mine-competitors` - Manual trigger

## Future Improvements
1. Link competitor complaints to pain_clusters for opportunity synthesis
2. Track complaint trends over time
3. Identify emerging competitors in each vertical
4. Auto-generate product briefs from feature gaps
