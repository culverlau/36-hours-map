// Turn a 36 Hours article into a clean, geocodable place query.
const STATES = {
  Ala: 'Alabama', Alaska: 'Alaska', Ariz: 'Arizona', Ark: 'Arkansas', Calif: 'California',
  Colo: 'Colorado', Conn: 'Connecticut', Del: 'Delaware', DC: 'Washington, D.C.', Fla: 'Florida',
  Ga: 'Georgia', Hawaii: 'Hawaii', Idaho: 'Idaho', Ill: 'Illinois', Ind: 'Indiana', Iowa: 'Iowa',
  Kan: 'Kansas', Ky: 'Kentucky', La: 'Louisiana', Me: 'Maine', Md: 'Maryland', Mass: 'Massachusetts',
  Mich: 'Michigan', Minn: 'Minnesota', Miss: 'Mississippi', Mo: 'Missouri', Mont: 'Montana',
  Neb: 'Nebraska', Nev: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NYC: 'New York City', NC: 'North Carolina', ND: 'North Dakota', Ohio: 'Ohio',
  Okla: 'Oklahoma', Ore: 'Oregon', Pa: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', Tenn: 'Tennessee', Tex: 'Texas', Utah: 'Utah', Vt: 'Vermont', Va: 'Virginia',
  Wash: 'Washington State', WVa: 'West Virginia', Wis: 'Wisconsin', Wyo: 'Wyoming',
};

const STATES_LC = Object.fromEntries(Object.entries(STATES).map(([k, v]) => [k.toLowerCase(), v]));
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(-])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase());

/** "36 Hours in Savannah, Ga." -> "Savannah, Ga." ; "36 Hours -- Death Valley" -> "Death Valley" */
export function placeFromTitle(title) {
  let t = clean(title).replace(/^36 hours\s*/i, '');
  t = t.replace(/^(:|--|-|—|–|\|)\s*/, '').replace(/^(in|on|at|near)\s+/i, '').replace(/^the\s+/i, '');
  t = t.replace(/^\d+\s+(?=[A-Za-z])/, '');
  return clean(t.replace(/\s*[|:].*$/, ''));
}

/** "Portland (Ore)" -> "Portland, Oregon"; "Toronto (Ontario)" -> "Toronto, Ontario" */
export function expandGlocation(g) {
  const m = g.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (!m) return titleCase(clean(g));
  const [, name, inner] = m;
  const region = STATES_LC[inner.replace(/\./g, '').toLowerCase()] || titleCase(inner);
  const city = titleCase(clean(name));
  return region.startsWith(city) ? region : `${city}, ${region}`;
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Pick the geocoding query. Prefer a glocation whose name matches the title's
 * place (gives us the state/country); otherwise fall back to the title text.
 */
export function pickQuery(article) {
  const titlePlace = placeFromTitle(article.title);
  const parts = titlePlace.split(',').map((x) => x.trim());
  // "Savannah, Ga." / "Ljubljana, Slovenia": the title already says where; just expand AP abbreviations.
  if (parts.length > 1) {
    const last = parts[parts.length - 1].replace(/\./g, '');
    parts[parts.length - 1] = STATES_LC[last.toLowerCase()] || parts[parts.length - 1].replace(/\.$/, '');
    return { query: parts.join(', '), titlePlace };
  }
  const head = norm(titlePlace);
  const match = (article.glocations || []).find((g) => {
    const gn = norm(g.replace(/\(.*\)/, ''));
    return gn && gn === head;
  });
  return { query: match ? expandGlocation(match) : titlePlace, titlePlace };
}

/** Drop videos / interactive duplicates of the same place published close together. */
export function dedupe(articles) {
  const byPlace = new Map();
  for (const a of articles) {
    const key = norm(a.query);
    if (!byPlace.has(key)) byPlace.set(key, []);
    byPlace.get(key).push(a);
  }
  const out = [];
  const rank = (a) => (a.type === 'article' ? 0 : a.type === 'multimedia' ? 1 : 2) + (/\/video\//.test(a.url) ? 5 : 0);
  for (const list of byPlace.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const clusters = [];
    for (const a of list) {
      const last = clusters[clusters.length - 1];
      const gap = last ? (new Date(a.date) - new Date(last[last.length - 1].date)) / 864e5 : Infinity;
      if (gap <= 45) last.push(a); else clusters.push([a]);
    }
    for (const c of clusters) out.push(c.sort((a, b) => rank(a) - rank(b))[0]);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
