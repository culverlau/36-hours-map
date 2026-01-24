# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ONE-TIME BACKFILL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐          │
│  │ NYT API  │───▶│  Parse   │───▶│ Google   │───▶│ LLM Fallback │          │
│  │ (search) │    │ Titles   │    │ Geocode  │    │ (if needed)  │          │
│  └──────────┘    └──────────┘    └──────────┘    └──────────────┘          │
│       │                                                  │                  │
│       │ ~50 requests (10 articles each)                  │                  │
│       │ = ~500 articles                                  ▼                  │
│       │                                          ┌──────────────┐          │
│       └─────────────────────────────────────────▶│ locations.json│          │
│                                                  │ (grouped by  │          │
│                                                  │  location)   │          │
│                                                  └──────────────┘          │
│                                                         │                   │
│                                                         ▼                   │
│                                                  ┌──────────────┐          │
│                                                  │  git commit  │          │
│                                                  └──────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      DAILY CHECK (GitHub Action)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌─────────────────┐                                   │
│  │ Cron trigger │────▶│ Check NYT API   │                                   │
│  │ (daily)      │     │ for new articles│                                   │
│  └──────────────┘     └────────┬────────┘                                   │
│                                │                                             │
│                    ┌───────────┴───────────┐                                │
│                    │                       │                                │
│               No new articles         New article found                     │
│                    │                       │                                │
│                    ▼                       ▼                                │
│               ┌────────┐          ┌───────────────┐                         │
│               │  Exit  │          │ Geocode + LLM │                         │
│               └────────┘          │ (if ambiguous)│                         │
│                                   └───────┬───────┘                         │
│                                           │                                 │
│                              ┌────────────┴────────────┐                    │
│                              │                         │                    │
│                         Resolved                  Unresolved                │
│                              │                         │                    │
│                              ▼                         ▼                    │
│                    ┌─────────────────┐      ┌──────────────────┐           │
│                    │ Update JSON     │      │ Create GitHub    │           │
│                    │ Commit + Push   │      │ Issue for review │           │
│                    │ (triggers build)│      └──────────────────┘           │
│                    └─────────────────┘                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              RUNTIME                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐              │
│  │ GitHub Pages │───▶│   Browser    │◀──▶│ OpenStreetMap    │              │
│  │ (static)     │    │              │    │ Tile Server      │              │
│  └──────────────┘    └──────────────┘    └──────────────────┘              │
│                             │                                               │
│                             ▼                                               │
│                   ┌─────────────────┐                                       │
│                   │ locations.json  │                                       │
│                   │ (bundled)       │                                       │
│                   └─────────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Model

### locations.json Structure

The data is grouped by location, not by article. Each location can have multiple articles.

```typescript
interface LocationsData {
  meta: {
    lastUpdated: string;      // ISO date of last data update
    totalLocations: number;   // Count of unique locations
    totalArticles: number;    // Count of total articles
    lastArticleDate: string;  // Date of most recent article (for checking new)
  };
  locations: Location[];
}

interface Location {
  id: string;                 // Slug from location name, e.g., "tokyo-japan"
  name: string;               // Display name, e.g., "Tokyo, Japan"
  coordinates: {
    lat: number;
    lng: number;
  };
  region: string;             // Continent/region for filtering: "Asia", "Europe", etc.
  articles: Article[];        // All articles for this location
}

interface Article {
  nytId: string;              // NYT's unique identifier (won't change)
  title: string;              // Full article title
  url: string;                // Link to NYT article
  date: string;               // Publication date (ISO 8601)
  abstract: string;           // Article summary (for LLM disambiguation, not displayed)
}
```

### Example

```json
{
  "meta": {
    "lastUpdated": "2024-01-15T00:00:00Z",
    "totalLocations": 287,
    "totalArticles": 512,
    "lastArticleDate": "2024-01-10T00:00:00Z"
  },
  "locations": [
    {
      "id": "tokyo-japan",
      "name": "Tokyo, Japan",
      "coordinates": { "lat": 35.6762, "lng": 139.6503 },
      "region": "Asia",
      "articles": [
        {
          "nytId": "nyt://article/abc123",
          "title": "36 Hours in Tokyo",
          "url": "https://www.nytimes.com/2022/03/15/travel/36-hours-tokyo.html",
          "date": "2022-03-15",
          "abstract": "From teamLab exhibitions to izakayas..."
        },
        {
          "nytId": "nyt://article/def456",
          "title": "36 Hours in Tokyo",
          "url": "https://www.nytimes.com/2015/08/20/travel/36-hours-tokyo.html",
          "date": "2015-08-20",
          "abstract": "A weekend guide to Japan's capital..."
        }
      ]
    }
  ]
}
```

## Geocoding Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     GEOCODING FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input: "36 Hours in the Amalfi Coast"                          │
│                    │                                             │
│                    ▼                                             │
│  ┌─────────────────────────────────┐                            │
│  │ Extract location from title      │                            │
│  │ Regex: /36 Hours in (.+)/i       │                            │
│  │ Result: "the Amalfi Coast"       │                            │
│  └─────────────────────────────────┘                            │
│                    │                                             │
│                    ▼                                             │
│  ┌─────────────────────────────────┐                            │
│  │ Google Geocoding API             │                            │
│  │ Query: "Amalfi Coast"            │                            │
│  └─────────────────────────────────┘                            │
│                    │                                             │
│         ┌─────────┴─────────┐                                   │
│         │                   │                                   │
│    High confidence     Low confidence /                         │
│    (single result)     multiple results                         │
│         │                   │                                   │
│         ▼                   ▼                                   │
│  ┌─────────────┐    ┌─────────────────────┐                     │
│  │ Use coords  │    │ LLM disambiguation   │                     │
│  └─────────────┘    │ Input: title,        │                     │
│                     │ abstract, keywords   │                     │
│                     │ Output: best match   │                     │
│                     └──────────┬──────────┘                     │
│                                │                                 │
│                     ┌─────────┴─────────┐                       │
│                     │                   │                       │
│                Resolved            Unresolved                   │
│                     │                   │                       │
│                     ▼                   ▼                       │
│              ┌─────────────┐    ┌─────────────────┐             │
│              │ Use coords  │    │ Create GitHub   │             │
│              └─────────────┘    │ issue for       │             │
│                                 │ manual review   │             │
│                                 └─────────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
src/
├── components/
│   ├── Map/
│   │   ├── Map.jsx              # Main map component
│   │   ├── MapProvider.jsx      # Abstraction layer (Leaflet today, swappable)
│   │   └── markers.js           # Marker creation utilities
│   │
│   ├── LocationPopup/
│   │   ├── LocationPopup.jsx    # Popup container
│   │   └── ArticleCard.jsx      # Individual article card
│   │
│   ├── Filters/                 # Future: region/year filters
│   │   └── ...
│   │
│   └── Search/                  # Future: location search
│       └── ...
│
├── hooks/
│   └── useLocations.js          # Load and manage location data
│
├── data/
│   └── locations.json           # Static data (imported at build)
│
├── App.jsx
├── main.jsx
└── index.css
```

## Map Abstraction

To allow swapping Leaflet for Google Maps later:

```jsx
// MapProvider.jsx - abstracts the map implementation
const MapProvider = ({ children, center, zoom }) => {
  // Currently uses Leaflet
  // Can be swapped to Google Maps without changing consuming components
  return (
    <LeafletMap center={center} zoom={zoom}>
      {children}
    </LeafletMap>
  );
};

// Marker abstraction
const Marker = ({ position, onClick, children }) => {
  // Wraps Leaflet marker
  // Same interface would work with Google Maps
};
```

## GitHub Actions Workflow

```yaml
# .github/workflows/check-new-articles.yml
name: Check for new articles

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:      # Manual trigger

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Check for new articles
        env:
          NYT_API_KEY: ${{ secrets.NYT_API_KEY }}
          GOOGLE_GEOCODING_KEY: ${{ secrets.GOOGLE_GEOCODING_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}  # For LLM fallback
        run: node scripts/check-new-articles.js

      - name: Commit if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/locations.json
          git diff --staged --quiet || git commit -m "Add new article(s)"
          git push
```

## Deployment

GitHub Pages deployment is configured via the repo settings:
- Source: `gh-pages` branch (or `main` branch `/dist` folder)
- Custom domain: configured in repo settings + CNAME record

Vite build outputs to `dist/` which is deployed.
