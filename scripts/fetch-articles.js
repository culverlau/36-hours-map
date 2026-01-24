#!/usr/bin/env node

/**
 * Full backfill script - fetches ALL 36 Hours articles from NYT API
 * Run this once to populate the initial data, then use check-new-articles.js for updates
 *
 * Usage: node scripts/fetch-articles.js
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fetchAllArticles } from './lib/nyt.js';
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

if (!NYT_API_KEY) {
  console.error('Error: NYT_API_KEY environment variable is required');
  process.exit(1);
}

if (!GOOGLE_GEOCODING_KEY) {
  console.error('Error: GOOGLE_GEOCODING_KEY environment variable is required');
  process.exit(1);
}

/**
 * Process a single article - geocode and handle ambiguity
 */
async function processArticle(article, existingLocations) {
  const location = article.locationFromTitle;
  console.log(`  Geocoding: ${location}`);

  // Try Google Geocoding first
  let geocodeResult = await geocodeLocation(location, GOOGLE_GEOCODING_KEY);

  // If geocoding failed entirely, try LLM
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
    console.log(`    WARNING: Could not geocode "${location}"`);
    return {
      ...article,
      coordinates: null,
      needsReview: true,
      reviewReason: 'Geocoding failed',
    };
  }

  // If multiple results and we have LLM, disambiguate
  if (geocodeResult.confidence === 'low' && geocodeResult.allResults && OPENAI_API_KEY) {
    console.log(`    Ambiguous location (${geocodeResult.allResults.length} results), using LLM...`);
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
      console.log(`    LLM selected: ${geocodeResult.formattedAddress}`);
    }
  }

  return {
    ...article,
    coordinates: {
      lat: geocodeResult.lat,
      lng: geocodeResult.lng,
    },
    formattedAddress: geocodeResult.formattedAddress,
    confidence: geocodeResult.confidence,
    needsReview: geocodeResult.confidence === 'low',
    reviewReason: geocodeResult.confidence === 'low' ? 'Low confidence geocoding' : null,
  };
}

/**
 * Group articles by location
 */
function groupByLocation(processedArticles) {
  const locations = [];

  for (const article of processedArticles) {
    if (!article.coordinates) {
      // Skip articles that couldn't be geocoded
      continue;
    }

    // Find existing location with same coordinates
    let existingLocation = locations.find(loc =>
      isSameLocation(loc.coordinates, article.coordinates)
    );

    if (existingLocation) {
      // Add article to existing location
      existingLocation.articles.push({
        nytId: article.nytId,
        title: article.title,
        url: article.url,
        date: article.date,
        abstract: article.abstract,
      });

      // Sort articles by date (newest first)
      existingLocation.articles.sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      );
    } else {
      // Create new location
      const region = determineRegion(article.coordinates.lat, article.coordinates.lng);
      const name = article.formattedAddress || article.locationFromTitle;

      locations.push({
        id: createLocationSlug(name),
        name,
        coordinates: article.coordinates,
        region,
        articles: [{
          nytId: article.nytId,
          title: article.title,
          url: article.url,
          date: article.date,
          abstract: article.abstract,
        }],
      });
    }
  }

  return locations;
}

/**
 * Main function
 */
async function main() {
  console.log('=== 36 Hours Map - Full Data Backfill ===\n');

  // Step 1: Fetch all articles from NYT
  console.log('Step 1: Fetching articles from NYT API...');
  const articles = await fetchAllArticles(NYT_API_KEY);
  console.log(`\nFetched ${articles.length} articles\n`);

  // Step 2: Geocode each unique location
  console.log('Step 2: Geocoding locations...');
  const processedArticles = [];
  const needsReview = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`[${i + 1}/${articles.length}] ${article.title}`);

    try {
      const processed = await processArticle(article, processedArticles);
      processedArticles.push(processed);

      if (processed.needsReview) {
        needsReview.push({
          title: processed.title,
          reason: processed.reviewReason,
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error(`  ERROR: ${error.message}`);
      processedArticles.push({
        ...article,
        coordinates: null,
        needsReview: true,
        reviewReason: error.message,
      });
      needsReview.push({
        title: article.title,
        reason: error.message,
      });
    }
  }

  // Step 3: Group by location
  console.log('\nStep 3: Grouping articles by location...');
  const locations = groupByLocation(processedArticles);

  // Step 4: Create output data
  const outputData = {
    meta: {
      lastUpdated: new Date().toISOString(),
      totalLocations: locations.length,
      totalArticles: processedArticles.filter(a => a.coordinates).length,
      lastArticleDate: articles.length > 0
        ? articles.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
        : null,
    },
    locations: locations.sort((a, b) => a.name.localeCompare(b.name)),
  };

  // Step 5: Write output
  console.log('\nStep 4: Writing output...');

  // Ensure data directory exists
  if (!existsSync('data')) {
    mkdirSync('data');
  }

  writeFileSync(
    'data/locations.json',
    JSON.stringify(outputData, null, 2)
  );

  console.log(`\n=== Complete ===`);
  console.log(`Locations: ${outputData.meta.totalLocations}`);
  console.log(`Articles: ${outputData.meta.totalArticles}`);
  console.log(`Output: data/locations.json`);

  if (needsReview.length > 0) {
    console.log(`\n=== Needs Review (${needsReview.length}) ===`);
    for (const item of needsReview) {
      console.log(`- ${item.title}: ${item.reason}`);
    }
  }
}

main().catch(console.error);
