// NYT Archive API helpers: fetch one month, keep only 36 Hours travel items.
import fs from 'node:fs';
import path from 'node:path';

// 36 Hours and the other guide types are stored separately, one small file per month in each.
export const SERIES_ROOT = path.resolve(process.env.SERIES_ROOT || 'data/series');
export const kindOf = (series) => (series === '36-hours' ? '36-hours' : 'other');
export const kindDir = (kind) => path.join(SERIES_ROOT, kind);

// Which guide series (if any) an archive item belongs to.
export const SERIES = {
  '36-hours': '36 Hours',
  'whats-new': 'What’s New',
  layover: 'Layover',
  'flocking-to': 'Flocking To',
  'five-places': '5 Places',
};

export function classify(doc) {
  const main = (doc.headline?.main || '').trim();
  const kicker = (doc.headline?.kicker || '').trim();
  const url = doc.web_url || '';
  if (/\/slideshow\//.test(url)) return null; // photo versions of existing guides
  const travel = /travel/i.test(doc.section_name || '') || /\/travel\//.test(url);
  if (/^36 hours\b/i.test(main)) return travel || /\/video\//.test(url) ? '36-hours' : null;
  // T Magazine's city guides live outside the Travel section.
  if (/^flocking to\b/i.test(kicker) && /t-magazine/.test(url)) return 'flocking-to';
  if (!travel) return null;
  if (/^what[’']s new\b/i.test(kicker)) return 'whats-new';
  if (/^layover$/i.test(kicker)) return 'layover';
  if (/^5 places$/i.test(kicker)) return 'five-places';
  return null;
}

export function slimDoc(doc, series) {
  return {
    series,
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
    return docs.map((d) => [classify(d), d]).filter(([c]) => c).map(([c, d]) => slimDoc(d, c));
  }
  throw new Error(`Archive ${year}/${month}: rate limited too many times`);
}

export function monthFile(kind, year, month) {
  return path.join(kindDir(kind), `${year}-${String(month).padStart(2, '0')}.json`);
}

/** kind: '36-hours' | 'other' | 'all' */
export function loadAllCachedMonths(kind = 'all') {
  const kinds = kind === 'all' ? ['36-hours', 'other'] : [kind];
  return kinds.flatMap((k) => {
    const dir = kindDir(k);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  });
}
