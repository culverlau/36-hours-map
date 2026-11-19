// Pull restaurant facts (name, address, coordinates, link) out of a list page's embedded data.
// We deliberately keep only plain facts, not the sites' blurbs, ratings or photos.

const decode = (s = '') =>
  s.replace(/&apos;|&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

function walk(node, visit) {
  if (node && typeof node === 'object') {
    visit(node);
    for (const k in node) walk(node[k], visit);
  }
}

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

function ldBlocks(html) {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    try { return [JSON.parse(m[1])]; } catch { return []; }
  });
}

export function listTitle(html) {
  const og = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) || html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/);
  return decode(og?.[1] || (html.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1] || '');
}

/** Eater map pages: entries with { name, address, location: { latitude, longitude }, url }. */
export function parseEater(html) {
  const data = nextData(html);
  const seen = new Map();
  if (data) {
    walk(data, (o) => {
      if (o.name && o.location && typeof o.location === 'object' && typeof o.location.latitude === 'number') {
        const key = `${o.name}|${o.location.latitude}`;
        if (!seen.has(key)) {
          seen.set(key, {
            name: decode(o.name),
            address: decode(o.address || ''),
            lat: o.location.latitude,
            lng: o.location.longitude,
            website: o.url || null,
          });
        }
      }
    });
  }
  return [...seen.values()];
}

/**
 * The Infatuation guide pages. The full list lives in the page's Apollo cache:
 * guide -> body entries -> review -> venue { latlong, street, city, ... }.
 * (The schema.org markup only carries the first 20, so it is just a fallback.)
 */
export function parseInfatuation(html) {
  const data = nextData(html);
  const out = new Map();
  const add = (r) => { const k = `${r.name}|${r.lat}`; if (!out.has(k)) out.set(k, r); };

  const st = data?.props?.pageProps?.initialApolloState;
  if (st) {
    const deref = (o) => (o && o.__ref ? st[o.__ref] : o);
    const q = st.ROOT_QUERY || {};
    const guideKey = Object.keys(q).find((k) => k.startsWith('postGuideCollection'));
    const guide = guideKey && deref(q[guideKey]?.items?.[0]);
    const bodyKey = guide && Object.keys(guide).find((k) => k.startsWith('contentV2BodyCollection'));
    for (const b of (bodyKey ? guide[bodyKey].items : [])) {
      const venue = deref(deref(deref(b)?.review)?.venue);
      if (venue?.latlong && typeof venue.latlong.lat === 'number') {
        add({
          name: decode(venue.name),
          address: [venue.street, venue.city, venue.state].filter(Boolean).join(', '),
          lat: venue.latlong.lat,
          lng: venue.latlong.lon,
          website: venue.url || null,
          price: venue.price || null,
        });
      }
    }
  }
  if (out.size === 0) {
    const consider = (o) => {
      if (o['@type'] === 'Restaurant' && o.geo && typeof o.geo.latitude === 'number') {
        const a = o.address || {};
        add({ name: decode(o.name), address: decode(a.name || ''), lat: o.geo.latitude, lng: o.geo.longitude, website: null, price: null });
      }
    };
    for (const block of ldBlocks(html)) walk(block, consider);
  }
  return [...out.values()];
}
