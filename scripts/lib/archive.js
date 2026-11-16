// NYT Archive API helpers: fetch one month, keep only 36 Hours travel items.
import fs from 'node:fs';
import path from 'node:path';

export const CACHE_DIR = path.resolve(process.env.MONTHS_DIR || 'data/months');

export function isThirtySixHours(doc) {
  const main = doc.headline?.main || '';
  const url = doc.web_url || '';
  if (!/^36 hours\b/i.test(main.trim())) return false;
  if (/\/video\//.test(url)) return true; // kept so we can merge, dropped later
  const travel = /travel/i.test(doc.section_name || '') || /\/travel\//.test(url);
  return travel;
}

export function slimDoc(doc) {
  return {
    id: doc._id,
    title: doc.headline?.main || '',
    kicker: doc.headline?.kicker || null,
    url: doc.web_url,
    date: (doc.pub_date || '').slice(0, 10),
    type: doc.document_type || null,
    abstract: doc.abstract || doc.snippet || '',
    glocations: (doc.keywords || []).filter((k) => k.name === 'glocations').map((k) => k.value),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchMonth(year, month, apiKey, { retries = 4 } = {}) {
  const url = `https://api.nytimes.com/svc/archive/v1/${year}/${month}.json?api-key=${apiKey}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await sleep(65_000);
      continue;
    }
    if (!res.ok) {
      if (attempt === retries) throw new Error(`Archive ${year}/${month}: HTTP ${res.status}`);
      await sleep(5_000 * (attempt + 1));
      continue;
    }
    const data = await res.json();
    const docs = data.response?.docs ?? data.docs ?? [];
    return docs.filter(isThirtySixHours).map(slimDoc);
  }
  throw new Error(`Archive ${year}/${month}: rate limited too many times`);
}

export function monthFile(year, month) {
  return path.join(CACHE_DIR, `${year}-${String(month).padStart(2, '0')}.json`);
}

export function loadAllCachedMonths() {
  if (!fs.existsSync(CACHE_DIR)) return [];
  return fs
    .readdirSync(CACHE_DIR)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8')));
}
