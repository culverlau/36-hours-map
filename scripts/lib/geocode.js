// Free geocoding via OpenStreetMap Nominatim (max 1 request/second), with a persistent cache.
import fs from 'node:fs';

const CACHE = 'data/geocode-cache.json';
const OVERRIDES = 'data/overrides.json';
const UA = '36-hours-map/1.0 (hobby project)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
export const loadCache = () => readJson(CACHE, {});
export const saveCache = (c) => fs.writeFileSync(CACHE, JSON.stringify(c, null, 1));
export const loadOverrides = () => readJson(OVERRIDES, {});

let last = 0;
export async function nominatim(query) {
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&accept-language=en&q=${encodeURIComponent(query)}`;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const [hit] = await res.json();
      if (!hit) return null;
      return {
        lat: Number(Number(hit.lat).toFixed(5)),
        lng: Number(Number(hit.lon).toFixed(5)),
        country: hit.address?.country || null,
        countryCode: (hit.address?.country_code || '').toUpperCase() || null,
        display: hit.display_name,
        type: hit.type,
      };
    }
    await sleep(5000 * (i + 1));
  }
  return null;
}

/** Try each candidate query in order; cache hits and misses. */
export async function geocode(candidates, cache, overrides) {
  for (const q of candidates) {
    if (overrides[q]) return { ...overrides[q], query: q };
  }
  for (const q of candidates) {
    if (!(q in cache)) {
      cache[q] = await nominatim(q);
      saveCache(cache);
    }
    if (cache[q]) return { ...cache[q], query: q };
  }
  return null;
}
