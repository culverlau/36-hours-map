// Find each Infatuation city's general "best restaurants" guide from the site's own sitemap
// (which lists every guide page). A general guide is one whose address is only filler words plus
// the city: best-paris-restaurants, nashville-restaurants, best-restaurants-nyc...
// Output: data/infatuation-general-guides.json  { "<city-slug>": "<url>" }
import fs from 'node:fs';
import { get } from './http.js';

const REGIONS = /^(us|usa|uk|italy|mexico|spain|france|japan|canada|england|ireland|germany|thailand|brazil|peru|argentina|portugal|belgium|netherlands|ontario|quebec|texas|california|florida|georgia|colorado|oregon|maine|vermont|connecticut|massachusetts|pennsylvania|virginia|carolina|north|south|new|york|jersey|island|louisiana|tennessee|arizona|utah|ohio|michigan|illinois|wisconsin|minnesota|missouri|kentucky|washington|hawaii|nevada|idaho|montana|wyoming|alabama|mississippi|oklahoma|kansas|iowa|nebraska|indiana|maryland|delaware|penang|malaysia|colombia|chile|indonesia|philippines|korea|singapore|sicily|tuscany|bahamas|jamaica)$/;
const STOP = new Set(['best', 'the', 'in', 'restaurants', 'restaurant', 'guide', 'top', 'of', 'a', 'our', 'where', 'to', 'eat', 'food', 'dining', 'good', 'great', 'greatest', 'hits', 'list', 'ranked', 'nyc', 'dc']);

const urls = [];
for (const n of [0, 1]) {
  const xml = await get(`https://www.theinfatuation.com/sitemap-${n}.xml`, { delay: 1500 });
  urls.push(...[...(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
}
const byCity = {};
for (const u of urls) {
  const m = u.match(/theinfatuation\.com\/([a-z0-9-]+)\/guides\/([a-z0-9-]+)$/);
  if (m) (byCity[m[1]] ??= []).push(m[2]);
}
const general = {};
for (const [city, slugs] of Object.entries(byCity)) {
  const cityWords = new Set(city.split('-'));
  const ok = slugs.filter((s) => {
    const w = s.split('-');
    return w.some((x) => x === 'restaurants' || x === 'restaurant') && w.every((x) => STOP.has(x) || cityWords.has(x) || REGIONS.test(x));
  });
  if (ok.length) general[city] = `https://www.theinfatuation.com/${city}/guides/${ok.sort((a, b) => a.length - b.length)[0]}`;
}
delete general.all;
// Keep what earlier runs already found, so the slower title checks only run for cities still missing one.
if (fs.existsSync('data/infatuation-general-guides.json')) Object.assign(general, JSON.parse(fs.readFileSync('data/infatuation-general-guides.json', 'utf8')));

// Second pass: some general guides have odd addresses (best-restaurants-hotels-barcelona), so for cities
// still without one, read the page titles of the likeliest candidates: "The 25 Best Restaurants In <City>".
const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const pending = Object.keys(byCity).filter((c) => !general[c] && c !== 'all');
for (const city of pending) {
  const cityName = norm(city.replace(/-/g, ' '));
  const candidates = byCity[city].filter((s) => /restaurants?/.test(s) && !/(^|-)(near|bars?|brunch|lunch|breakfast|sushi|pizza|vegan|cheap|date|group|hotel-bars)(-|$)/.test(s)).sort((a, b) => a.length - b.length).slice(0, 4);
  for (const slug of candidates) {
    const html = await get(`https://www.theinfatuation.com/${city}/guides/${slug}`, { delay: 1500 });
    const title = (html?.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    const m = title.match(/^The (?:\d+ )?Best Restaurants In ([^-]+?)\s+-/i);
    if (m && norm(m[1]).startsWith(cityName)) { general[city] = `https://www.theinfatuation.com/${city}/guides/${slug}`; console.log(`  by title: ${city} -> ${slug}`); break; }
  }
}
fs.writeFileSync('data/infatuation-general-guides.json', JSON.stringify(general, null, 1));
console.log(`${Object.keys(byCity).length} cities in the sitemap, general guide found for ${Object.keys(general).length}`);
console.log('no general guide found: ' + Object.keys(byCity).filter((c) => !general[c] && c !== 'all').join(', '));

// Third pass: a city's own page links to its featured guides with their real names, so for cities still
// without a general guide, look for a link reading "The Best Restaurants In <City>".
for (const city of Object.keys(byCity).filter((c) => !general[c] && c !== 'all')) {
  const cityName = norm(city.replace(/-/g, ' '));
  const html = await get(`https://www.theinfatuation.com/${city}`, { delay: 1500 });
  if (!html) continue;
  for (const m of html.matchAll(/<a[^>]*href="(\/[a-z0-9-]+\/guides\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const t = text.match(/^The (?:\d+ )?Best Restaurants In (.+)$/i);
    if (t && norm(t[1]).startsWith(cityName)) { general[city] = `https://www.theinfatuation.com${m[1]}`; console.log(`  by city page: ${city} -> ${m[1]}`); break; }
  }
}
fs.writeFileSync('data/infatuation-general-guides.json', JSON.stringify(general, null, 1));
console.log(`final: ${Object.keys(general).length} cities with a general guide; none for: ` + Object.keys(byCity).filter((c) => !general[c] && c !== 'all').join(', '));
