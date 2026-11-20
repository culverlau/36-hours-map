// Build public/data/articles.json from cached archive months.
// node scripts/build-data.js [--no-geocode]
import fs from 'node:fs';
import { loadAllCachedMonths } from './lib/archive.js';
import { pickQuery, dedupe, expandGlocation } from './lib/places.js';
import { tagline } from './lib/tagline.js';
import { geocode, loadCache, loadOverrides } from './lib/geocode.js';

const skipGeocode = process.argv.includes('--no-geocode');

const raw = loadAllCachedMonths().filter((a) => !/[…]|\bReaders\b/.test(a.title)).map((a) => ({ ...a, ...pickQuery(a) }));
const articles = dedupe(raw.filter((a) => a.query));
console.log(`${raw.length} raw items -> ${articles.length} after merging duplicates`);

const cache = loadCache();
const overrides = loadOverrides();
const groups = new Map();
const unresolved = [];

for (const [i, a] of articles.entries()) {
  const candidates = [...new Set([a.query, a.titlePlace, ...a.glocations.slice(0, 2).map(expandGlocation)])].filter(Boolean);
  const geo = skipGeocode ? cache[a.query] && { ...cache[a.query], query: a.query } : await geocode(candidates, cache, overrides);
  if (!geo) { unresolved.push({ title: a.title, url: a.url, tried: candidates }); continue; }
  const key = `${geo.lat.toFixed(2)},${geo.lng.toFixed(2)}`;
  if (!groups.has(key)) {
    groups.set(key, { id: key, name: a.query === a.query.toLowerCase() ? a.query.replace(/\b\w/g, (c) => c.toUpperCase()) : a.query, lat: geo.lat, lng: geo.lng, country: geo.country ?? null, articles: [] });
  }
  groups.get(key).articles.push({ id: a.id, title: a.title, url: a.url, date: a.date, abstract: tagline(a.abstract), series: a.series || '36-hours' });
  if ((i + 1) % 50 === 0) console.log(`geocoded ${i + 1}/${articles.length}`);
}

const locations = [...groups.values()].map((l) => ({
  ...l,
  articles: l.articles.sort((x, y) => y.date.localeCompare(x.date)),
}));
const out = {
  generatedAt: new Date().toISOString(),
  totalArticles: locations.reduce((n, l) => n + l.articles.length, 0),
  totalLocations: locations.length,
  locations,
};
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/articles.json', JSON.stringify(out));
fs.writeFileSync('data/unresolved.json', JSON.stringify(unresolved, null, 2));
console.log(`Wrote ${out.totalArticles} articles at ${out.totalLocations} locations; ${unresolved.length} unresolved (data/unresolved.json)`);
