#!/usr/bin/env node

/**
 * Incremental update script - checks for new articles since last update
 * Run this daily via GitHub Actions
 *
 * Usage: node scripts/check-new-articles.js
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fetchAllArticles, formatDateForApi } from './lib/nyt.js';
import {
  geocodeLocation,
  determineRegion,
  createLocationSlug,
  isSameLocation,
} from './lib/geocode.js';
import { disambiguateLocation, llmGeocode } from './lib/llm.js';

const NYT_API_KEY = process.env.NYT_API_KEY;
const GOOGLE_GEOCODING_KEY = process.env.GOOGLE_GEOCODING_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

const DATA_FILE = 'data/locations.json';

if (!NYT_API_KEY) {
  console.error('Error: NYT_API_KEY environment variable is required');
  process.exit(1);
}

if (!GOOGLE_GEOCODING_KEY) {
  console.error('Error: GOOGLE_GEOCODING_KEY environment variable is required');
  process.exit(1);
}

/**
 * Load existing data
 */
function loadExistingData() {
  if (!existsSync(DATA_FILE)) {
    console.error(`Error: ${DATA_FILE} not found. Run fetch-articles.js first.`);
    process.exit(1);
  }

  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

/**
 * Check if article already exists in data
 */
function articleExists(data, nytId) {
  for (const location of data.locations) {
    for (const article of location.articles) {
      if (article.nytId === nytId) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Process a single new article
 */
async function processNewArticle(article) {
  const location = article.locationFromTitle;
  console.log(`  Geocoding: ${location}`);

  let geocodeResult = await geocodeLocation(location, GOOGLE_GEOCODING_KEY);

  if (!geocodeResult && OPENAI_API_KEY) {
    console.log(`    Geocoding failed, trying LLM fallback...`);
    const llmResult = await llmGeocode(article, OPENAI_API_KEY);
    if (llmResult && llmResult.lat && llmResult.lng) {
      geocodeResult = {
        lat: llmResult.lat,
        lng: llmResult.lng,
        formattedAddress: llmResult.name,
        confidence: llmResult.confidence,
      };
    }
  }

  if (!geocodeResult) {
    return { success: false, reason: 'Geocoding failed' };
  }

  if (geocodeResult.confidence === 'low' && geocodeResult.allResults && OPENAI_API_KEY) {
    console.log(`    Ambiguous location, using LLM...`);
    const disambiguation = await disambiguateLocation(
      article,
      geocodeResult.allResults,
      OPENAI_API_KEY
    );

    if (disambiguation.selected && disambiguation.confidence !== 'low') {
      geocodeResult = {
        lat: disambiguation.selected.lat,
        lng: disambiguation.selected.lng,
        formattedAddress: disambiguation.selected.formattedAddress,
        confidence: disambiguation.confidence,
      };
    }
  }

  if (geocodeResult.confidence === 'low') {
    return { success: false, reason: 'Low confidence geocoding' };
  }

  return {
    success: true,
    coordinates: { lat: geocodeResult.lat, lng: geocodeResult.lng },
    formattedAddress: geocodeResult.formattedAddress,
  };
}

/**
 * Add article to existing data
 */
function addArticleToData(data, article, geocodeResult) {
  const articleData = {
    nytId: article.nytId,
    title: article.title,
    url: article.url,
    date: article.date,
    abstract: article.abstract,
  };

  // Find existing location with same coordinates
  const existingLocation = data.locations.find(loc =>
    isSameLocation(loc.coordinates, geocodeResult.coordinates)
  );

  if (existingLocation) {
    console.log(`    Adding to existing location: ${existingLocation.name}`);
    existingLocation.articles.push(articleData);
    existingLocation.articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else {
    const region = determineRegion(geocodeResult.coordinates.lat, geocodeResult.coordinates.lng);
    const name = geocodeResult.formattedAddress || article.locationFromTitle;

    console.log(`    Creating new location: ${name}`);
    data.locations.push({
      id: createLocationSlug(name),
      name,
      coordinates: geocodeResult.coordinates,
      region,
      articles: [articleData],
    });

    data.locations.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Update meta
  data.meta.totalLocations = data.locations.length;
  data.meta.totalArticles = data.locations.reduce((sum, loc) => sum + loc.articles.length, 0);
  data.meta.lastUpdated = new Date().toISOString();

  if (article.date > data.meta.lastArticleDate) {
    data.meta.lastArticleDate = article.date;
  }
}

/**
 * Create GitHub issue for articles needing review
 */
async function createGitHubIssue(article, reason) {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    console.log(`    Would create GitHub issue (no token): ${article.title}`);
    return;
  }

  const [owner, repo] = GITHUB_REPOSITORY.split('/');

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      title: `Manual review needed: ${article.title}`,
      body: `## Article Details

- **Title**: ${article.title}
- **URL**: ${article.url}
- **Date**: ${article.date}
- **Location from title**: ${article.locationFromTitle}

## Issue

${reason}

## Action Needed

Please manually determine the correct coordinates for this location and update \`data/locations.json\`.
`,
      labels: ['needs-review', 'automated'],
    }),
  });

  if (response.ok) {
    console.log(`    Created GitHub issue for review`);
  } else {
    console.error(`    Failed to create GitHub issue: ${response.status}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== 36 Hours Map - Check for New Articles ===\n');

  // Load existing data
  const data = loadExistingData();
  console.log(`Existing data: ${data.meta.totalLocations} locations, ${data.meta.totalArticles} articles`);
  console.log(`Last article date: ${data.meta.lastArticleDate}\n`);

  // Calculate start date (day after last article)
  const lastDate = new Date(data.meta.lastArticleDate);
  lastDate.setDate(lastDate.getDate() + 1);
  const beginDate = formatDateForApi(lastDate);

  console.log(`Checking for articles after ${beginDate}...\n`);

  // Fetch new articles
  const newArticles = await fetchAllArticles(NYT_API_KEY, beginDate);

  // Filter out articles we already have (by nytId)
  const trulyNewArticles = newArticles.filter(a => !articleExists(data, a.nytId));

  if (trulyNewArticles.length === 0) {
    console.log('\nNo new articles found.');
    return;
  }

  console.log(`\nFound ${trulyNewArticles.length} new article(s)\n`);

  // Process each new article
  let addedCount = 0;
  const needsReview = [];

  for (const article of trulyNewArticles) {
    console.log(`Processing: ${article.title}`);

    const result = await processNewArticle(article);

    if (result.success) {
      addArticleToData(data, article, result);
      addedCount++;
    } else {
      console.log(`    NEEDS REVIEW: ${result.reason}`);
      needsReview.push({ article, reason: result.reason });
    }
  }

  // Save updated data
  if (addedCount > 0) {
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`\nSaved ${addedCount} new article(s) to ${DATA_FILE}`);
  }

  // Create GitHub issues for articles needing review
  for (const { article, reason } of needsReview) {
    await createGitHubIssue(article, reason);
  }

  console.log('\n=== Complete ===');
  console.log(`Added: ${addedCount}`);
  console.log(`Needs review: ${needsReview.length}`);
}

main().catch(console.error);
