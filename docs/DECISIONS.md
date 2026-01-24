# Architectural Decisions Record

This document captures key decisions made during project planning. Future contributors (human or AI) should read this to understand the rationale behind the architecture.

---

## Decision 1: Static Site with JSON Data in Repo

**Context:** Need to store ~500 articles with location data.

**Options considered:**
- Database (PostgreSQL, MongoDB)
- Cloud storage (S3, GCS)
- JSON file in repo

**Decision:** JSON file committed to the repository.

**Rationale:**
- Data is small (~500 articles, under 1MB)
- Updates are infrequent (1-2 new articles per month)
- No external dependencies or costs
- Version controlled - can see history of changes
- Site can be fully static, no runtime database needed

---

## Decision 2: GitHub Actions for Daily Checks (Not GCP/AWS)

**Context:** Need to periodically check for new NYT articles.

**Options considered:**
- GCP Cloud Scheduler + Cloud Functions
- AWS Lambda + EventBridge
- GitHub Actions scheduled workflow

**Decision:** GitHub Actions.

**Rationale:**
- Everything stays in GitHub (code, data, CI/CD, hosting)
- One less service/account to manage
- Free tier is more than sufficient
- Simpler debugging - logs are in the same place as code

---

## Decision 3: Google Geocoding API (Not Nominatim)

**Context:** Need to convert location names to coordinates.

**Options considered:**
- OpenStreetMap Nominatim (free, no key needed)
- Google Geocoding API ($5/1000 requests, $200 free monthly)
- Mapbox Geocoding

**Decision:** Google Geocoding API.

**Rationale:**
- Higher accuracy for tourist destinations and regions
- Free tier covers our usage (~50 requests for backfill, 1-2/month after)
- Better handling of ambiguous place names
- User already has Google Cloud account

---

## Decision 4: LLM as Fallback for Ambiguous Locations

**Context:** Some locations are ambiguous (e.g., "Portland" could be Oregon or Maine, "Wine Country" could be multiple places).

**Options considered:**
- Always use LLM for parsing
- Manual review for all ambiguous cases
- Geocoding first, LLM as fallback

**Decision:** Tiered approach - Geocoding → LLM fallback → Human review.

**Rationale:**
- Most locations (~90%) will geocode cleanly
- LLM is only called when geocoder returns low confidence or multiple results
- Minimizes LLM costs (few cents per month at most)
- Human review only for rare edge cases (creates GitHub issue)
- Article abstract and keywords provide context for LLM disambiguation

---

## Decision 5: Group Articles by Location

**Context:** Some cities have multiple "36 Hours" articles from different years (e.g., Tokyo 2008, 2015, 2022).

**Options considered:**
- One marker per article (cluttered map)
- One marker per location with latest article only
- One marker per location with all articles listed

**Decision:** One marker per location, popup shows list of all articles for that location.

**Rationale:**
- Cleaner map with ~200-300 markers instead of ~500
- Users can see the evolution of coverage for a city
- More useful - if planning a trip, you want to see all guides for that destination
- Grouping determined by geocoding - same coordinates = same location

---

## Decision 6: Single Pin for Multi-Location Articles

**Context:** Some articles cover regions or multiple cities (e.g., "36 Hours: Three Perfect Days in Japan").

**Options considered:**
- Multiple pins for each location mentioned
- Skip these articles
- Single pin at region/country level

**Decision:** Single pin at the most logical location (country or region center).

**Rationale:**
- Simplicity - avoid over-engineering for edge cases
- These articles are rare
- Users will click and see the article title, which makes it clear
- "Japan" as a pin location is fine - map won't be so dense that it causes confusion

---

## Decision 7: Leaflet with Abstraction Layer (Not Google Maps)

**Context:** Need an interactive map library.

**Options considered:**
- Google Maps (requires API key, has costs at scale)
- Leaflet + OpenStreetMap (free, open source)
- Mapbox GL JS (nice styling, free tier)

**Decision:** Leaflet with OpenStreetMap tiles, but wrapped in an abstraction.

**Rationale:**
- Completely free, no API key needed for tiles
- Lightweight (~40KB)
- Sufficient for our needs
- Abstraction layer allows swapping to Google Maps later if Leaflet has issues
- No lock-in to any paid service

---

## Decision 8: Vite + React (Not Next.js)

**Context:** User is familiar with React/Next.js.

**Options considered:**
- Next.js + Vercel
- Next.js + GitHub Pages (static export)
- Vite + React + GitHub Pages
- Vanilla JS + GitHub Pages

**Decision:** Vite + React + GitHub Pages.

**Rationale:**
- Site is fully static, no need for Next.js server features
- Vite is simpler and faster for pure static sites
- GitHub Pages keeps everything in one place
- React provides familiar component patterns
- No Vercel dependency

---

## Decision 9: GitHub Pages with Custom Domain

**Context:** Need to host the site publicly.

**Options considered:**
- Vercel (free tier)
- Netlify (free tier)
- GitHub Pages (free)
- Cloudflare Pages (free)

**Decision:** GitHub Pages with custom domain.

**Rationale:**
- Free
- Native GitHub integration - deploys on push
- Custom domain support built-in (just CNAME record)
- Keeps entire project in GitHub ecosystem
- One less service to manage

---

## Decision 10: Popup Content - Title, Date, CTA

**Context:** What to show when user clicks a marker.

**Decision:** Each article card shows:
- Article title
- Publication date
- CTA button linking to NYT article

**Not included:**
- Article images (copyright concerns, adds complexity)
- Full abstract (keep it minimal, encourage click-through)
- Author (not essential for trip planning)

**Rationale:**
- Clean, scannable UI
- Respects NYT's content - we're a discovery tool, not a republisher
- Date is important because older articles may be outdated
- Multiple articles per location shown as a list of cards

---

## Open Questions / Future Considerations

1. **Marker clustering** - If map feels cluttered at low zoom, consider clustering nearby markers
2. **Filters** - By year, region, or search - not in MVP but likely addition
3. **Offline support** - Service worker could cache for travel use - future enhancement
4. **Analytics** - May want to track which destinations are popular - consider privacy-respecting option
