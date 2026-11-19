// Finds each city's main "best restaurants" page on The Infatuation and Eater.
// Output: data/restaurant-candidates.json  (review, then copy picks into data/restaurant-sources.json)
import fs from 'node:fs';
import { get } from './http.js';

const onlyEater = process.argv.includes('--only=eater');
const onlyInfatuation = process.argv.includes('--only=infatuation');
const prior = fs.existsSync('data/restaurant-candidates.json') ? JSON.parse(fs.readFileSync('data/restaurant-candidates.json', 'utf8')) : null;
const out = onlyEater && prior ? { ...prior, eater: {} }
  : onlyInfatuation && prior ? { ...prior, infatuation: {} }
  : { infatuation: {}, eater: {} };

// --- The Infatuation: cities come from the homepage nav, each city has /<city>/guides
if (!onlyEater) {
const home = await get('https://www.theinfatuation.com/');
const skip = new Set(['about', 'all', 'careers', 'experiences', 'newsletter', 'privacy-policy', 'sitemap', 'terms', 'travel']);
const cities = [...new Set([...home.matchAll(/href="\/([a-z-]+)"/g)].map((m) => m[1]))].filter((c) => !skip.has(c));
console.log(`Infatuation: ${cities.length} cities`);
for (const c of cities) {
  const html = await get(`https://www.theinfatuation.com/${c}/guides`);
  const links = html ? [...new Set([...html.matchAll(new RegExp(`href="(/${c}/guides/best-[a-z0-9-]+)"`, 'g'))].map((m) => m[1]))] : [];
  out.infatuation[c] = links.map((l) => `https://www.theinfatuation.com${l}`);
  console.log(' ', c, links.length ? links[0] : '-- none');
}
}

// --- Eater: city sites list their maps at /maps; the main one is usually "…38…" or "essential"
const hosts = ['www', 'ny', 'la', 'sf', 'chicago', 'austin', 'dallas', 'houston', 'miami', 'atlanta', 'boston', 'dc', 'philly', 'seattle', 'pdx', 'denver', 'vegas', 'nola', 'detroit', 'phoenix', 'sandiego', 'nashville', 'twincities', 'carolinas'];
for (const h of (onlyInfatuation ? [] : hosts)) {
  const base = `https://${h}.eater.com`;
  // Map lists are paginated (?page=N, 10 per page): keep going until a page adds nothing new.
  const slugs = [];
  for (let page = 1; page <= 60; page++) {
    const html = await get(page === 1 ? `${base}/maps` : `${base}/maps?page=${page}`);
    const found = html ? [...new Set([...html.matchAll(/href="\/maps\/([a-z0-9-]+)"/g)].map((m) => m[1]))] : [];
    const fresh = found.filter((x) => !slugs.includes(x));
    if (!fresh.length) break;
    slugs.push(...fresh);
  }
  out.eater[h] = [];
  out.eater[h] = slugs.map((x) => `${base}/maps/${x}`);
  const main = out.eater[h];
  console.log(' ', h, `${main.length} maps`);
}
fs.writeFileSync('data/restaurant-candidates.json', JSON.stringify(out, null, 2));
