// Collect Eater map guide URLs from the site's own monthly sitemaps and ADD any new ones to
// data/restaurant-candidates.json (existing entries are kept).
//   node scripts/restaurants/eater-sitemap.js           all months (first run)
//   node scripts/restaurants/eater-sitemap.js --recent  only the latest 3 months (monthly update)
import fs from 'node:fs';
import { get } from './http.js';

const index = (await get('https://www.eater.com/sitemaps', { delay: 1500 })) || '';
let months = [...index.matchAll(/<loc>(https:\/\/www\.eater\.com\/sitemaps\/entries\/[^<]+)<\/loc>/g)].map((m) => m[1]);
if (process.argv.includes('--recent')) months = months.slice(0, 3); // the index lists newest first
console.log(`${months.length} monthly sitemaps`);

const maps = new Set();
let n = 0;
for (const url of months) {
  const xml = (await get(url, { delay: 1500 })) || '';
  for (const m of xml.matchAll(/<loc>(https:\/\/[a-z]+\.eater\.com\/maps\/[a-z0-9-]+)<\/loc>/g)) maps.add(m[1]);
  if (++n % 25 === 0) console.log(`  ${n}/${months.length} sitemaps, ${maps.size} maps so far`);
}

const file = 'data/restaurant-candidates.json';
const cand = JSON.parse(fs.readFileSync(file, 'utf8'));
const known = new Set(Object.values(cand.eater).flat().map((u) => u.split('/maps/')[1]));
cand.eater.www ??= [];
let added = 0;
for (const u of maps) {
  const slug = u.split('/maps/')[1];
  if (!known.has(slug)) { cand.eater.www.push(u); known.add(slug); added++; }
}
fs.writeFileSync(file, JSON.stringify(cand, null, 2));
console.log(`${maps.size} maps seen, ${added} new`);
