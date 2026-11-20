// One-off/idempotent: shorten oversized abstracts in public/data/articles.json without re-running the geocoder.
import fs from 'node:fs';
import { tagline } from './lib/tagline.js';

const file = 'public/data/articles.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
let changed = 0;
for (const l of data.locations) for (const a of l.articles) {
  const short = tagline(a.abstract);
  if (short !== a.abstract) { a.abstract = short; changed++; }
}
fs.writeFileSync(file, JSON.stringify(data));
console.log(`Shortened ${changed} abstracts`);
