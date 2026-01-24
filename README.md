# 36 Hours Travel Map

A public interactive map displaying all New York Times "36 Hours" travel articles, allowing users to explore weekend travel destinations worldwide.

## What This Is

The NYT "36 Hours" series (running since 2002) provides weekend travel guides for cities around the world. This project aggregates all ~500 articles and displays them on an interactive map grouped by location.

**Live site:** [TODO: Add custom domain once configured]

## Features

- Interactive world map with markers for each destination
- **Grouped markers**: Multiple articles about the same city (e.g., Tokyo 2008, 2015, 2022) show as one pin with a list of articles
- Click markers to see article cards with title, date, and link to NYT
- Filter by region/continent
- Search for specific cities
- Responsive design for mobile and desktop

## Tech Stack

- **Frontend**: React + Vite
- **Map**: Leaflet.js with OpenStreetMap tiles (abstracted for future Google Maps swap)
- **Data**: Static JSON committed to repo, grouped by location
- **Geocoding**: Google Geocoding API (with LLM fallback for ambiguous cases)
- **CI/CD**: GitHub Actions (daily check for new articles)
- **Hosting**: GitHub Pages with custom domain

## Quick Start

```bash
npm install
cp .env.example .env  # Add your API keys
npm run dev           # Start dev server at localhost:5173
```

See [docs/SETUP.md](docs/SETUP.md) for detailed instructions.

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design, data flow, key decisions
- [API_NOTES.md](docs/API_NOTES.md) - NYT API usage details
- [SETUP.md](docs/SETUP.md) - Setup and deployment guide
- [DECISIONS.md](docs/DECISIONS.md) - Record of architectural decisions and rationale

## Project Structure

```
36-hours-map/
├── .github/
│   └── workflows/
│       └── check-new-articles.yml  # Daily article check
├── docs/                           # Project documentation
├── scripts/
│   ├── fetch-articles.js           # One-time backfill script
│   ├── check-new-articles.js       # Daily incremental check
│   └── geocode.js                  # Geocoding utilities
├── data/
│   └── locations.json              # Article data grouped by location
├── src/
│   ├── components/
│   │   ├── Map/                    # Leaflet wrapper (swappable)
│   │   ├── ArticleCard/            # Article display card
│   │   └── LocationPopup/          # Popup with article list
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
└── vite.config.js
```

## License

MIT
