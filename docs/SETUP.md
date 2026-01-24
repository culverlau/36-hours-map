# Setup Guide

## Prerequisites

- Node.js 20+ installed
- NYT API key ([get one here](https://developer.nytimes.com/))
- Google Cloud account with Geocoding API enabled
- Git installed

## API Keys Setup

### NYT Article Search API

1. Go to https://developer.nytimes.com/
2. Create an account and register an app
3. Enable the "Article Search API"
4. Copy your API key

### Google Geocoding API

1. Go to https://console.cloud.google.com/
2. Create a project (or use existing)
3. Enable the "Geocoding API"
4. Create credentials → API Key
5. (Optional) Restrict the key to Geocoding API only

### LLM API (Optional - for disambiguation fallback)

If using OpenAI:
1. Go to https://platform.openai.com/
2. Create an API key
3. Add billing (pay-as-you-go, very low usage expected)

---

## Local Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/36-hours-map.git
cd 36-hours-map
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
NYT_API_KEY=your_nyt_api_key_here
GOOGLE_GEOCODING_KEY=your_google_key_here
OPENAI_API_KEY=your_openai_key_here  # Optional, for LLM fallback
```

### 3. Initial Data Fetch (One-Time Backfill)

```bash
npm run fetch-data
```

This will:
- Query NYT API for all "36 Hours" articles (~50 requests, ~10 minutes)
- Extract locations from titles
- Geocode each unique location
- Use LLM for any ambiguous cases
- Save results to `data/locations.json`

**Note:** Due to rate limits, this takes about 10 minutes. Progress is logged to console.

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 to view the map.

### 5. Build for Production

```bash
npm run build
```

Output is in `dist/` folder.

---

## Deployment to GitHub Pages

### Initial Setup

1. Push code to GitHub

2. Enable GitHub Pages:
   - Go to repo Settings → Pages
   - Source: "GitHub Actions"

3. Add repository secrets (Settings → Secrets → Actions):
   - `NYT_API_KEY`
   - `GOOGLE_GEOCODING_KEY`
   - `OPENAI_API_KEY` (if using LLM fallback)

4. The GitHub Action will build and deploy on push to `main`

### Custom Domain

1. Buy a domain (Namecheap, Google Domains, etc.)

2. Add DNS records:
   ```
   Type: CNAME
   Name: www (or @)
   Value: YOUR_USERNAME.github.io
   ```

3. In repo Settings → Pages → Custom domain:
   - Enter your domain
   - Check "Enforce HTTPS"

4. Create `public/CNAME` file with your domain:
   ```
   yourdomain.com
   ```

---

## GitHub Actions

### Daily Article Check

The workflow at `.github/workflows/check-new-articles.yml` runs daily at 6 AM UTC.

To manually trigger:
1. Go to Actions tab
2. Select "Check for new articles"
3. Click "Run workflow"

### What It Does

1. Checks NYT API for articles newer than last stored date
2. If found:
   - Geocodes new locations
   - Updates `data/locations.json`
   - Commits and pushes (triggers rebuild)
3. If location is ambiguous and LLM can't resolve:
   - Creates a GitHub Issue for manual review

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run fetch-data` | Full backfill of all articles |
| `npm run check-new` | Check for new articles only |

---

## Project Structure After Setup

```
36-hours-map/
├── .env                    # Local environment variables (not committed)
├── .env.example            # Template for environment variables
├── data/
│   └── locations.json      # Article data (committed, auto-updated)
├── dist/                   # Production build (not committed)
├── src/                    # Source code
└── ...
```

---

## Troubleshooting

### "Rate limit exceeded" during fetch

- Wait 1 minute, the script auto-retries
- If persistent, check your API key hasn't exceeded daily quota (500/day for NYT)

### Geocoding returns wrong location

1. Check `data/locations.json`
2. Find the location entry
3. Manually update coordinates
4. Commit the change

### GitHub Action fails

1. Check Actions tab for error logs
2. Verify secrets are set correctly
3. Check API quotas haven't been exceeded

### Map shows no markers

1. Check browser console for errors
2. Verify `data/locations.json` has data
3. Check that the file is being imported correctly in the build

---

## Updating Dependencies

```bash
npm update
npm audit fix
```

Review changes and test before committing.
