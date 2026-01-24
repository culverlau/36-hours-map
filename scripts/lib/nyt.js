/**
 * NYT Article Search API utilities
 */

const NYT_API_BASE = 'https://api.nytimes.com/svc/search/v2/articlesearch.json';
const RATE_LIMIT_DELAY = 12000; // 12 seconds between requests (5 per minute limit)

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract location from article title
 * "36 Hours in Austin, Texas" -> "Austin, Texas"
 * "36 Hours in the Amalfi Coast" -> "Amalfi Coast"
 */
export function extractLocationFromTitle(title) {
  const match = title.match(/36 Hours in (.+)/i);
  if (!match) return null;

  let location = match[1].trim();

  // Remove leading "the" for cleaner geocoding
  if (location.toLowerCase().startsWith('the ')) {
    location = location.substring(4);
  }

  return location;
}

/**
 * Fetch a single page of articles from NYT API
 */
async function fetchPage(apiKey, page, beginDate = null) {
  const params = new URLSearchParams({
    q: '"36 Hours"',
    fq: 'section_name:("Travel")',
    sort: 'oldest',
    page: page.toString(),
    'api-key': apiKey,
  });

  if (beginDate) {
    params.set('begin_date', beginDate);
  }

  const url = `${NYT_API_BASE}?${params}`;
  const response = await fetch(url);

  if (response.status === 429) {
    console.log('Rate limited, waiting 60 seconds...');
    await sleep(60000);
    return fetchPage(apiKey, page, beginDate);
  }

  if (!response.ok) {
    throw new Error(`NYT API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Parse an article from NYT API response
 */
function parseArticle(doc) {
  const title = doc.headline?.main || '';
  const location = extractLocationFromTitle(title);

  // Skip if not a valid 36 Hours article
  if (!location) {
    return null;
  }

  // Extract glocations from keywords for additional context
  const glocations = doc.keywords
    ?.filter(k => k.name === 'glocations')
    ?.map(k => k.value) || [];

  return {
    nytId: doc._id,
    title,
    url: doc.web_url,
    date: doc.pub_date?.split('T')[0] || '',
    abstract: doc.abstract || '',
    locationFromTitle: location,
    glocations,
  };
}

/**
 * Fetch all 36 Hours articles from NYT API
 * @param {string} apiKey - NYT API key
 * @param {string|null} beginDate - Optional start date (YYYYMMDD format)
 * @param {function} onProgress - Optional progress callback
 */
export async function fetchAllArticles(apiKey, beginDate = null, onProgress = null) {
  const articles = [];
  let page = 0;
  let totalHits = null;

  console.log('Fetching articles from NYT API...');
  if (beginDate) {
    console.log(`Filtering for articles after ${beginDate}`);
  }

  while (true) {
    const data = await fetchPage(apiKey, page, beginDate);

    if (totalHits === null) {
      totalHits = data.response.meta.hits;
      console.log(`Total articles found: ${totalHits}`);
    }

    const docs = data.response.docs || [];

    if (docs.length === 0) {
      break;
    }

    for (const doc of docs) {
      const article = parseArticle(doc);
      if (article) {
        articles.push(article);
      }
    }

    const progress = Math.min(((page + 1) * 10 / totalHits) * 100, 100);
    console.log(`Page ${page + 1}: ${articles.length} valid articles (${progress.toFixed(1)}%)`);

    if (onProgress) {
      onProgress({ page, articles: articles.length, total: totalHits, progress });
    }

    // Check if we've fetched all pages
    if ((page + 1) * 10 >= totalHits) {
      break;
    }

    page++;

    // Rate limit: wait between requests
    await sleep(RATE_LIMIT_DELAY);
  }

  console.log(`Fetched ${articles.length} valid 36 Hours articles`);
  return articles;
}

/**
 * Get the date string for API queries (YYYYMMDD format)
 */
export function formatDateForApi(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}
