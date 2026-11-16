// Resumable backfill: node scripts/fetch-articles.js [--from=2002] [--delay=12000] [--recent]
import fs from 'node:fs';
import 'dotenv/config';
import { fetchMonth, monthFile, CACHE_DIR } from './lib/archive.js';

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : def;
};
const recent = process.argv.includes('--recent'); // last two months only (weekly update)
const fromYear = arg('from', 2002);
const delay = arg('delay', 12000);
const key = process.env.NYT_API_KEY;
if (!key) throw new Error('NYT_API_KEY missing in .env');

fs.mkdirSync(CACHE_DIR, { recursive: true });
const now = new Date();
let done = 0, total = 0, found = 0;
for (let y = fromYear; y <= now.getFullYear(); y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === now.getFullYear() && m > now.getMonth() + 1) break;
    total++;
    const file = monthFile(y, m);
    if (recent && (now.getFullYear() * 12 + now.getMonth()) - (y * 12 + m - 1) > 1) continue;
    const isCurrent = y === now.getFullYear() && m === now.getMonth() + 1;
    if (fs.existsSync(file) && !isCurrent && !recent) continue;
    const docs = await fetchMonth(y, m, key);
    fs.writeFileSync(file, JSON.stringify(docs));
    done++; found += docs.length;
    console.log(`${y}-${String(m).padStart(2, '0')}: ${docs.length} items (fetched ${done}, found ${found})`);
    await new Promise((r) => setTimeout(r, delay));
  }
}
console.log(`Done. ${total} months checked, ${done} fetched this run.`);
