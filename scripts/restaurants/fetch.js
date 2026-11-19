// Fetch every guide page in data/restaurant-sources.json and save a city-level summary:
// the guide's title/link and a centre point (median of the places it covers). Individual
// restaurants are read only to find that centre and are not stored.
// node scripts/restaurants/fetch.js [--only=eater|infatuation] [--refresh] [--extras]
// Without --refresh, lists that were already fetched are skipped.
import fs from 'node:fs';
import { get } from './http.js';
import { parseEater, parseInfatuation, listTitle } from './extract.js';

const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const sources = JSON.parse(fs.readFileSync('data/restaurant-sources.json', 'utf8'));
const parsers = { eater: parseEater, infatuation: parseInfatuation };
fs.mkdirSync('data/restaurants', { recursive: true });

const slug = (s) => s.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '').toLowerCase();
let failures = 0;
// Extra guides (neighborhood, cuisine, college...) are only fetched on request: --extras
const wanted = (x) => (!only || x.source === only) && (x.main !== false || process.argv.includes('--extras'));
for (const s of sources.filter(wanted)) {
  const file = `data/restaurants/${slug(s.url)}.json`;
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (previous && !process.argv.includes('--refresh')) continue;
  const html = await get(s.url);
  const restaurants = html ? parsers[s.source](html) : [];
  if (!restaurants.length) {
    // Never overwrite good data with an empty result (a page layout change would otherwise wipe the map).
    failures++;
    console.error(`FAILED ${s.source} ${s.city}: ${html ? 'no restaurants found in page' : 'page did not load'} (${s.url})${previous ? ` - keeping the saved version` : ''}`);
    continue;
  }
  const median = (xs) => xs.sort((a, b) => a - b)[xs.length >> 1];
  const summary = {
    ...s,
    title: listTitle(html),
    count: restaurants.length,
    lat: median(restaurants.map((r) => r.lat)),
    lng: median(restaurants.map((r) => r.lng)),
    fetchedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(summary, null, 1));
  console.log(`${s.source} ${s.city}: ${restaurants.length} places`);
}
if (failures) { console.error(`${failures} list(s) failed`); process.exit(1); }
