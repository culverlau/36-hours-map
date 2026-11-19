// Group the saved guides by city and write public/data/guides.json: one pin per city, each
// listing its Eater / The Infatuation guides as links (same shape the map uses for NYT articles).
import fs from 'node:fs';
import { reverseName } from './names.js';

const metres = (a, b) => {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const cleanTitle = (t, fallback) =>
  (t || fallback).replace(/\s+-\s+The Infatuation$/i, '').replace(/\s+-\s+[^-]+$/, (m) => (/^\s-\s[A-Z][A-Za-z .]+$/.test(m) ? '' : m)).trim() || fallback;

/** Guides whose centre points are within `km` of a city's first guide share a pin. */
export function groupByCity(guides, km = 40) {
  const places = [];
  for (const g of guides) {
    const entry = { id: g.url, title: cleanTitle(g.title, g.label), url: g.url, source: g.source, date: '', main: Boolean(g.main) };
    const home = places.find((p) => metres(p, g) < km * 1000);
    if (home) {
      home.articles.push(entry);
      home.names.push(g.city);
    } else {
      places.push({ lat: g.lat, lng: g.lng, names: [g.city], articles: [entry] });
    }
  }
  return places.map((p, i) => {
    const counts = p.names.reduce((m, n) => ((m[n] = (m[n] || 0) + 1), m), {});
    const name = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.length - b.length)[0];
    p.articles.sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0) || a.source.localeCompare(b.source) || a.title.localeCompare(b.title));
    return { id: `g${i}`, name, lat: p.lat, lng: p.lng, country: null, articles: p.articles };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = 'data/restaurants';
  // Names and labels come from the reviewed sources file, so renaming a city there takes effect without refetching.
  const meta = new Map(JSON.parse(fs.readFileSync('data/restaurant-sources.json', 'utf8')).map((x) => [x.url, x]));
  const guides = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')))
    .filter((g) => meta.has(g.url)) // drop saved guides that were removed from the sources file
    .map((g) => ({ ...g, city: meta.get(g.url).city, label: meta.get(g.url).label, main: meta.get(g.url).main !== false }))
    // main guides first so the first guide decides where the city's pin sits
    .sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
  const overrides = fs.existsSync('data/city-names.json') ? JSON.parse(fs.readFileSync('data/city-names.json', 'utf8')) : {};
  const grouped = groupByCity(guides);
  const locations = [];
  for (const l of grouped) {
    const looked = await reverseName(l.lat, l.lng); // consistent city/town names, even for odd guide titles
    const name = looked || l.name;
    locations.push({ ...l, name: overrides[name] || name });
  }
  fs.writeFileSync('public/data/guides.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalGuides: guides.length,
    totalCities: locations.length,
    locations,
  }));
  console.log(`${locations.length} cities with ${guides.length} guides (${locations.filter((l) => new Set(l.articles.map((a) => a.source)).size > 1).length} cities have both Eater and The Infatuation)`);
}
