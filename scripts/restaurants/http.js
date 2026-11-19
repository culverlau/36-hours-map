// Polite fetching: one request at a time, with a pause, plain identifying User-Agent.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;

export async function get(url, { delay = 2000 } = {}) {
  const wait = delay - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  last = Date.now();
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': '36-hours-map/1.0 (personal hobby project)' }, redirect: 'follow' });
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch {}
    await sleep(3000 * (i + 1));
  }
  return null;
}
