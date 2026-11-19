# 36 Hours Map

An interactive world map of every New York Times "36 Hours" travel guide. Click a pin to see the articles for that place.
Unofficial fan project. Stores only article metadata and links to nytimes.com.

## How it works
1. `npm run fetch` pulls each month from the NYT Archive API (2002 to now) and keeps the 36 Hours items in `data/series/` (36 Hours in `36-hours/`, other guide types in `other/`). It is resumable and slow on purpose (NYT rate limits).
2. `npm run build-data` merges duplicates, finds a place name for each article, geocodes it with OpenStreetMap Nominatim (cached in `data/geocode-cache.json`), and writes `public/data/articles.json`. Fix wrong or missing places by adding entries to `data/overrides.json`. Items it couldn't place are listed in `data/unresolved.json`.
3. The site (React + MapLibre GL, free OpenFreeMap tiles) loads that JSON as a static file. No server or paid service is needed.
4. A weekly GitHub Action fetches the latest two months, updates the data, and redeploys to GitHub Pages.

## Restaurants tab
A second tab shows Eater and The Infatuation "best restaurants" lists as one combined map (a restaurant on both lists is one pin).
- `npm run restaurants:discover` finds each city's main list page; `data/restaurant-sources.json` holds the reviewed picks (edit it to add or remove lists).
- `npm run restaurants:update` (what the monthly Action runs) looks for new city guides in each site's sitemap and fetches only the new ones. `npm run restaurants` re-reads every saved guide.
- `npm run restaurants` fetches those pages slowly (one request every 2 seconds), keeps only name, address, coordinates and links, and writes `public/data/restaurants.json`. A list that fails to load never overwrites saved data.
- A monthly Action refreshes it.

## Run locally
```
cp .env.example .env     # add your NYT_API_KEY (Archive API enabled)
npm install
npm run dev
npm test
```

## Deploy
Push to GitHub, enable Pages (Source: GitHub Actions), add the `NYT_API_KEY` repository secret.

## overrides.json format
```json
{ "Some Query": { "lat": 48.85, "lng": 2.35, "country": "France" } }
```
