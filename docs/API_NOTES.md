# API Documentation

## NYT Article Search API

### Endpoint

```
https://api.nytimes.com/svc/search/v2/articlesearch.json
```

### Query for 36 Hours Articles

| Parameter | Value | Description |
|-----------|-------|-------------|
| `q` | `"36 Hours"` | Search query |
| `fq` | `section_name:("Travel")` | Filter to Travel section |
| `api-key` | `YOUR_API_KEY` | Your NYT API key |
| `page` | `0-199` | Pagination (10 results per page) |
| `sort` | `newest` or `oldest` | Sort order |
| `begin_date` | `YYYYMMDD` | Filter articles after this date |

### Example Request

```bash
curl "https://api.nytimes.com/svc/search/v2/articlesearch.json?q=36%20Hours&fq=section_name:(Travel)&sort=newest&api-key=YOUR_KEY"
```

### Response Structure

```json
{
  "response": {
    "docs": [
      {
        "_id": "nyt://article/abc123-def456",
        "headline": {
          "main": "36 Hours in Austin, Texas"
        },
        "web_url": "https://www.nytimes.com/2023/05/15/travel/36-hours-austin.html",
        "pub_date": "2023-05-15T00:00:00+0000",
        "abstract": "A weekend guide to the Texas capital...",
        "keywords": [
          { "name": "glocations", "value": "Austin (Tex)" },
          { "name": "subject", "value": "Travel and Vacations" }
        ],
        "byline": {
          "original": "By Author Name"
        }
      }
    ],
    "meta": {
      "hits": 512,
      "offset": 0
    }
  }
}
```

### Key Fields to Extract

| Field | Use |
|-------|-----|
| `_id` | Unique identifier (stable, use as `nytId`) |
| `headline.main` | Article title, parse for location |
| `web_url` | Link to article |
| `pub_date` | Publication date |
| `abstract` | Summary (useful for LLM disambiguation) |
| `keywords` | May contain location info (glocations) |

### Rate Limits

- **5 requests per minute**
- **500 requests per day**

For ~500 articles at 10 per page = ~50 requests = ~10 minutes for full backfill.

### Pagination

- API returns 10 articles per page
- Use `page` parameter (0-indexed)
- Check `response.meta.hits` for total count
- Max 200 pages (2000 results)

### Checking for New Articles

To check for articles newer than our last stored date:

```bash
curl "https://api.nytimes.com/svc/search/v2/articlesearch.json?q=36%20Hours&fq=section_name:(Travel)&begin_date=20240115&sort=newest&api-key=YOUR_KEY"
```

If `meta.hits` is 0, no new articles. Otherwise, process the new ones.

---

## Google Geocoding API

### Endpoint

```
https://maps.googleapis.com/maps/api/geocode/json
```

### Example Request

```bash
curl "https://maps.googleapis.com/maps/api/geocode/json?address=Amalfi+Coast,+Italy&key=YOUR_KEY"
```

### Response Structure

```json
{
  "results": [
    {
      "formatted_address": "Amalfi Coast, Province of Salerno, Campania, Italy",
      "geometry": {
        "location": {
          "lat": 40.6333,
          "lng": 14.6029
        },
        "location_type": "APPROXIMATE"
      },
      "types": ["establishment", "natural_feature", "point_of_interest"]
    }
  ],
  "status": "OK"
}
```

### Interpreting Results

| Status | Meaning |
|--------|---------|
| `OK` | At least one result found |
| `ZERO_RESULTS` | No match (try LLM fallback) |
| `OVER_QUERY_LIMIT` | Rate limited |
| `INVALID_REQUEST` | Bad query |

**Confidence signals:**
- Single result = high confidence
- Multiple results = may need disambiguation
- `location_type: "ROOFTOP"` = very precise
- `location_type: "APPROXIMATE"` = region/area (fine for our use)

### Pricing

- **$5 per 1,000 requests**
- **$200 free credit per month**
- For this project: ~300 geocode calls for backfill, 1-2/month after = effectively free

### Tips

1. Include country/region when known: "Portland, Oregon" not just "Portland"
2. The `keywords` field from NYT may have location hints
3. Strip common prefixes: "the Amalfi Coast" → "Amalfi Coast"

---

## LLM API (Fallback for Disambiguation)

Used when geocoding returns ambiguous results.

### Input to LLM

```json
{
  "title": "36 Hours in Portland",
  "abstract": "From Powell's Books to food carts...",
  "keywords": ["Portland (Ore)", "Travel"],
  "geocode_options": [
    { "name": "Portland, Oregon, USA", "lat": 45.5152, "lng": -122.6784 },
    { "name": "Portland, Maine, USA", "lat": 43.6591, "lng": -70.2568 }
  ]
}
```

### Expected Output

```json
{
  "selected": "Portland, Oregon, USA",
  "confidence": "high",
  "reasoning": "Powell's Books is a famous bookstore in Portland, Oregon"
}
```

### LLM Choice

Use any capable model:
- OpenAI GPT-4o-mini (cheap, fast, good enough)
- Anthropic Claude Haiku (similar)
- Local model if preferred

The task is simple classification, doesn't need a large model.

---

## Error Handling

### NYT API

```javascript
if (response.status === 429) {
  // Rate limited - wait and retry
  await sleep(60000); // 1 minute
  retry();
}
```

### Geocoding API

```javascript
if (result.status === 'ZERO_RESULTS') {
  // Try LLM to interpret location
  return await llmGeocode(title, abstract);
}

if (result.results.length > 1) {
  // Ambiguous - use LLM to pick
  return await llmDisambiguate(title, abstract, result.results);
}
```

### LLM Fallback

```javascript
if (llmResult.confidence === 'low' || !llmResult.selected) {
  // Create GitHub issue for manual review
  await createGitHubIssue({
    title: `Manual review needed: ${articleTitle}`,
    body: `Could not determine location for article...`
  });
}
```
