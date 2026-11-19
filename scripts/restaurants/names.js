// Look up a city/town name for a pin from its coordinates (OpenStreetMap Nominatim reverse geocoding,
// cached in data/city-name-cache.json so each place is looked up once).
import fs from 'node:fs';
import { get } from './http.js';

const FILE = 'data/city-name-cache.json';
const cache = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};

export async function reverseName(lat, lng) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (key in cache) return cache[key];
  const body = await get(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${lat}&lon=${lng}`, { delay: 1100 });
  let name = null;
  try {
    const a = JSON.parse(body)?.address || {};
    name = a.city || a.town || a.village || a.municipality || a.county || a.state || null;
  } catch {}
  cache[key] = name;
  fs.writeFileSync(FILE, JSON.stringify(cache, null, 1));
  return name;
}
