// Pull months from the NYT Archive API and save 36 Hours and the other guide types separately.
//   node scripts/fetch-articles.js [--from=2002] [--delay=12000]
//        [--recent]            only the last two months (weekly update)
//        [--newest-first]      go from now backwards (most useful data first)
//        [--skip-36-hours]     don't write the 36 Hours set (it is already complete)
// Resumable: months that already have a file are skipped (except the current month and --recent).
import fs from 'node:fs';
import 'dotenv/config';
import { fetchMonth, monthFile, kindDir, kindOf } from './lib/archive.js';

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : def;
};
const recent = flag('recent');
const skip36 = flag('skip-36-hours');
const fromYear = arg('from', 2002);
const delay = arg('delay', 12000);
const key = process.env.NYT_API_KEY;
if (!key) throw new Error('NYT_API_KEY missing in .env');

for (const k of ['36-hours', 'other']) fs.mkdirSync(kindDir(k), { recursive: true });
const now = new Date();

// Build the month list, then order it.
const months = [];
for (let y = fromYear; y <= now.getFullYear(); y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === now.getFullYear() && m > now.getMonth() + 1) break;
    months.push([y, m]);
  }
}
if (flag('newest-first')) months.reverse();

// Requests are limited (about 500 a day on a free key), so say what this run will cost.
const isCurrent = (y, m) => y === now.getFullYear() && m === now.getMonth() + 1;
const monthsAgo = (y, m) => now.getFullYear() * 12 + now.getMonth() - (y * 12 + m - 1);
const todo = months.filter(([y, m]) => {
  if (recent) return monthsAgo(y, m) <= 1;
  return isCurrent(y, m) || !fs.existsSync(monthFile('other', y, m));
});
console.log(`${todo.length} requests needed (${months.length - todo.length} months already saved).`);

let done = 0;
for (const [y, m] of todo) {
  const items = await fetchMonth(y, m, key);
  const is36 = (i) => kindOf(i.series) === '36-hours';
  fs.writeFileSync(monthFile('other', y, m), JSON.stringify(items.filter((i) => !is36(i))));
  if (!skip36) fs.writeFileSync(monthFile('36-hours', y, m), JSON.stringify(items.filter(is36)));
  done++;
  console.log(`${y}-${String(m).padStart(2, '0')}: ${items.length} items (${done}/${todo.length})`);
  await new Promise((r) => setTimeout(r, delay));
}
console.log(`Done. ${done} requests this run.`);
