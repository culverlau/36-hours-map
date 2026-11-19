// Turn data/restaurant-candidates.json into data/restaurant-sources.json: one main list per city.
// Rules first, then manual picks for the ambiguous cases. Review the output file; it is committed.
import fs from 'node:fs';

const cand = JSON.parse(fs.readFileSync('data/restaurant-candidates.json', 'utf8'));
const title = (s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const sources = [];
const main = new Set(); // urls of each city's main guide(s)

// ---- The Infatuation
const ALIAS = { 'new-york': ['nyc'], 'washington-dc': ['dc'], 'los-angeles': ['los-angeles', 'la'] };
const INF_PICK = { // manual picks where the rule can't tell
  boston: ['best-restaurants-in-boston-greatest-hits-list'],
  'mexico-city': ['best-restaurants-condesa-mexico-city'],
  paris: ['best-restaurants-marais-paris', 'best-restaurants-saint-germain-des-pres', 'best-restaurants-montmartre'],
  rome: ['best-restaurants-testaccio', 'best-restaurants-monti-rome'],
  barcelona: ['best-restaurants-gothic-quarter', 'best-restaurants-eixample'],
  houston: ['best-restaurants-downtown-houston', 'best-restaurants-rice-village-houston'],
  miami: ['best-restaurants-in-miami'],
  nashville: ['best-restaurants-east-nashville', 'best-restaurants-midtown-nashville'],
  'san-diego': ['best-restaurants-north-park'],
  vancouver: [], // the only guide found under this city is for Victoria, not Vancouver
  'hudson-valley': [], 'jersey-shore': [], 'the-catskills': [], vail: [], atlanta: ['best-restaurants-atlanta'],
};
for (const [city, urls] of Object.entries(cand.infatuation)) {
  const slugOf = (u) => u.split('/guides/')[1];
  let picks;
  if (city in INF_PICK) picks = urls.filter((u) => INF_PICK[city].includes(slugOf(u)));
  else if (urls.length <= 1) picks = urls;
  else {
    const names = [city, ...(ALIAS[city] || [])];
    const main = urls.find((u) => names.some((n) => new RegExp(`^best-restaurants-(in-)?${n}(-[a-z]+)?$`).test(slugOf(u))));
    picks = main ? [main] : urls.slice(0, 1);
  }
  for (const url of picks) sources.push({ source: 'infatuation', city: title(city), url, label: title(slugOf(url).replace(/^best-restaurants-/, '')) });
}

// General city guides found by trying the usual address patterns (scripts/restaurants/guess-infatuation.js)
if (fs.existsSync('data/infatuation-general-guides.json')) {
  const found = JSON.parse(fs.readFileSync('data/infatuation-general-guides.json', 'utf8'));
  for (const [city, url] of Object.entries(found)) {
    // the sitemap's general guide replaces any other Infatuation guide picked earlier for this city
    for (let i = sources.length - 1; i >= 0; i--) {
      if (sources[i].source === 'infatuation' && sources[i].city === title(city) && sources[i].url !== url) sources.splice(i, 1);
    }
    if (sources.some((x) => x.url === url)) continue;
    sources.push({ source: 'infatuation', city: title(city), url, label: title(url.split('/guides/')[1].replace(/^best-/, '')) });
  }
}

// ---- Eater
const EATER_PICK = {
  ny: ['best-new-york-restaurants-38-map'],
  la: ['best-los-angeles-restaurants-eater-38-essential'],
  pdx: ['best-portland-oregon-restaurants'],
  nola: ['best-restaurants-new-orleans-38-map-nola'],
  vegas: ['best-restaurants-las-vegas-strip'],
  carolinas: ['best-charleston-restaurants-38', 'best-restaurants-charlotte-north-carolina', 'best-asheville-restaurants'],
  twincities: ['best-restaurants-minneapolis-st-paul-38-map'],
  philly: ['best-philadelphia-restaurants-38-map-philly'],
  www: null, // all of them: international maps
};
const CITY = { www: null, ny: 'New York', la: 'Los Angeles', sf: 'San Francisco', chicago: 'Chicago', austin: 'Austin', dallas: 'Dallas', houston: 'Houston', miami: 'Miami', atlanta: 'Atlanta', boston: 'Boston', dc: 'Washington DC', philly: 'Philadelphia', seattle: 'Seattle', pdx: 'Portland', denver: 'Denver', vegas: 'Las Vegas', nola: 'New Orleans', detroit: 'Detroit', phoenix: 'Phoenix', sandiego: 'San Diego', nashville: 'Nashville', twincities: 'Twin Cities', carolinas: 'The Carolinas' };
const CUISINE = /sushi|indian|mexican|vegan|breakfast|lunch|brunch|steak|pizza|chinese|italian|pasta|christmas|private|group|kid|romantic|hotel|beverly|ballard|sandwich|taco|bbq|seafood|hmong|gaslamp|convoy|valle|tijuana|ann-arbor|dearborn|underrated|downtown|waterfront|splurge|tasting|salem|provincetown|chinatown|key-west|coral|monterey|athens|wilmington|greenville|rittenhouse|cherry|flatiron|all-you|late-night|off-strip|rochester|fancy|vegetarian/;
const DROP = new Set(['the', 'best', 'restaurants', 'restaurant', 'in', 'eater', '38', 'guide', 'where', 'to', 'eat', 'map', 'food', 'bars']);
const REGION = new Set(['italy', 'japan', 'canada', 'france', 'portugal', 'quebec', 'spain', 'mexico', 'thailand', 'india', 'australia', 'netherlands', 'sweden', 'egypt', 'chile', 'colombia', 'brazil', 'argentina', 'turkey', 'korea', 'uae', 'wisconsin', 'missouri', 'ohio', 'kentucky', 'utah', 'kansas', 'idaho', 'iowa', 'oklahoma', 'hawaii', 'bc', 'baja', 'california', 'connecticut', 'pennsylvania', 'new', 'york', 'florida', 'bolivia', 'panama', 'costa', 'rica', 'cote', 'divoire', 'puerto', 'rico', 'denmark', 'germany', 'ireland', 'england', 'north', 'south', 'carolina']);
const NAME_FIX = { 'best-restaurants-san-jose-costa-rica': 'San José, Costa Rica' };
function cityFromSlug(slug) {
  if (NAME_FIX[slug]) return NAME_FIX[slug];
  let w = slug.split('-').filter((x) => !DROP.has(x));
  // trim trailing country/state words, but never down to nothing
  while (w.length > 1 && REGION.has(w[w.length - 1])) w.pop();
  return title(w.join('-'));
}
for (const [host, urls] of Object.entries(cand.eater)) {
  let picks;
  if (host === 'www') {
    // International city guides: "…38…" maps or "best restaurants <place>" maps, minus colleges, topics and neighborhoods.
    const CITY_GUIDE = /(^|-)38(-|$)|essential|^(the-)?best-(restaurants-[a-z-]+|[a-z-]+-restaurants[a-z-]*)$/;
    const NOT_CITY = /university|college|ohio-state|penn-state|amherst|bloomington|tuscaloosa|heatmap|vegan|waikiki|disney|universal|new-restaurants|pastr|cuisine|things-to|across|america|country|walking|watch|olympics|chocolate|shops|cocktail|pizzeri|burger|coffee|valentine|tourism|fondue|national-park|road-trip|statewide|-and-|^austin-houston|^best-restaurants-(hawaii|maine)$|maine-massachusetts|georgia-carolina|new-tokyo|tainan-street|street-tainan|best-maine-restaurants|austin-houston-dallas|restaurants-hawaii-38/;
    picks = urls.filter((u) => CITY_GUIDE.test(u.split('/maps/')[1]) && !NOT_CITY.test(u.split('/maps/')[1]));
  }
  else if (host in EATER_PICK) picks = urls.filter((u) => EATER_PICK[host].includes(u.split('/maps/')[1]));
  else picks = [urls.find((u) => /38|essential/.test(u) && !CUISINE.test(u)) || urls.find((u) => !CUISINE.test(u))].filter(Boolean);
  for (const url of picks) {
    const slug = url.split('/maps/')[1];
    sources.push({ source: 'eater', city: (host !== 'carolinas' && CITY[host]) || cityFromSlug(slug), url, label: title(slug) });
  }
}

// The New York map was filtered out of discovery by the "new-" rule, so add it directly.
const NY38 = 'https://ny.eater.com/maps/best-new-york-restaurants-38-map';
if (!sources.some((x) => x.url === NY38)) sources.push({ source: 'eater', city: 'New York', url: NY38, label: 'Best New York Restaurants 38 Map' });
for (const s of sources) s.city = s.city.trim();

// Keep only general city guides. For The Infatuation a general guide's address names the city itself,
// so neighborhood guides standing in for a missing city guide (Paris: Marais, Rome: Testaccio...) are dropped.
const NEIGHBORHOOD = /marais|saint-germain|montmartre|testaccio|monti|gothic|eixample|downtown|rice-village|east-nashville|midtown|north-park|neukolln|condesa|coyoacan|centro-historico|near-|airport|stadium|arlington|plano|kingston|beacon|rhinebeck|cold-spring|asbury|long-beach-island|cape-may|avalon|wildwood|point-pleasant|woodstock|phoenicia|tannersville|catskill/;
const ALIASES = { nyc: 'new-york', dc: 'washington-dc' };
function isGeneral(x) {
  const slug = x.url.split(/\/(?:guides|maps)\//)[1] || '';
  if (NEIGHBORHOOD.test(slug)) return false;
  if (x.source !== 'infatuation') return true;
  const tokens = x.city.toLowerCase().replace(/\./g, '').split(/\s+/).filter((t) => t !== 'the');
  const hay = slug.replace(/-/g, ' ').replace(/\b(nyc|dc)\b/, (m) => ALIASES[m].replace(/-/g, ' '));
  return tokens.every((t) => hay.includes(t));
}
const dropped = sources.filter((x) => !isGeneral(x));
for (const x of dropped) sources.splice(sources.indexOf(x), 1);
console.log(`dropped ${dropped.length} neighborhood / non-general guides:\n` + dropped.map((x) => `  ${x.source} ${x.city}: ${x.url.split(/\/(?:guides|maps)\//)[1]}`).join('\n'));

// Everything else is an extra guide (neighborhood, college town, cuisine...) shown under the same city.
for (const x of sources) main.add(x.url);
const SKIP_EATER = /heatmap|hot-list|holiday|thanksgiving|christmas|valentine|new-year|mothers-day|fathers-day|easter|super-bowl|world-cup|gift|takeout|delivery|new-restaurants|new-nyc|cocktail-bars/;
const SKIP_INF = /hit-list|best-new|best-dishes|-20\d\d|hot-list|new-restaurants/;
const have = new Set(sources.map((x) => x.url));
const extras = [];
for (const [city, urls] of Object.entries(cand.infatuation)) {
  for (const url of urls) {
    const slug = url.split('/guides/')[1];
    if (have.has(url) || SKIP_INF.test(slug)) continue;
    extras.push({ source: 'infatuation', city: title(city), url, label: title(slug.replace(/^best-/, '')) });
  }
}
for (const [host, urls] of Object.entries(cand.eater)) {
  for (const url of urls) {
    const slug = url.split('/maps/')[1];
    if (have.has(url) || SKIP_EATER.test(slug) || /^(the-)?(best|essential|\d+-best)/.test(slug) === false && !/38|essential/.test(slug)) continue;
    extras.push({ source: 'eater', city: CITY[host] || cityFromSlug(slug), url, label: title(slug) });
  }
}
for (const x of sources) x.main = true;
for (const x of extras) x.main = false;
// Extras are not used by default: the map shows each city's main guide(s) only. Pass --extras to include them.
if (process.argv.includes('--extras')) sources.push(...extras);
for (const s of sources) s.city = s.city.trim();

fs.writeFileSync('data/restaurant-sources.json', JSON.stringify(sources, null, 1));
const by = (s) => sources.filter((x) => x.source === s).length;
console.log(`main guides: ${sources.filter((x) => x.main).length}, extra guides found but not used: ${extras.length}`);
console.log(`Infatuation: ${by('infatuation')} lists | Eater: ${by('eater')} lists`);
console.log('Eater picks:\n' + sources.filter((x) => x.source === 'eater').map((x) => `  ${x.city}: ${x.url.split('/maps/')[1]}`).join('\n'));
