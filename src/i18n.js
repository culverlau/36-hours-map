// UI text in each language. Article titles, summaries and guide names are data and stay in English.
export const LANGS = [
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
];

export const STRINGS = {
  en: {
    appTitle: '36 Hours Map',
    description: 'A world map of every New York Times 36 Hours travel guide, plus Eater and The Infatuation best-restaurant guides.',
    tabNyt: 'NYTimes',
    tabFood: 'Restaurants',
    subNyt: 'Every New York Times “36 Hours” guide, on a map.',
    subFood: 'Best-restaurant guides from Eater and The Infatuation, by city.',
    searchNyt: 'Search a city, country or title',
    searchFood: 'Search a city or guide',
    searchLabel: 'Search',
    guideTypes: 'Guide types',
    sources: 'Sources',
    from: 'From',
    to: 'To',
    places: 'places',
    scopeView: 'in view',
    scopeCluster: 'in this cluster',
    showAllInView: 'Show all in view',
    allPlaces: '← All places',
    loading: 'Loading…',
    foodUnavailable: 'Restaurant guides aren’t available yet.',
    loadError: 'Could not load data',
    footerNyt: 'Data © The New York Times. Links open nytimes.com. Unofficial fan project.',
    footerFood: 'Links go to the original guides on Eater and The Infatuation. Unofficial fan project.',
    article: { one: 'article', other: 'articles' },
    guide: { one: 'guide', other: 'guides' },
    language: 'Language',
    filters: 'Filters',
  },
  es: {
    appTitle: 'Mapa de 36 Hours',
    description: 'Un mapa mundial de todas las guías de viaje “36 Hours” del New York Times, además de las guías de los mejores restaurantes de Eater y The Infatuation.',
    tabNyt: 'NYTimes',
    tabFood: 'Restaurantes',
    subNyt: 'Todas las guías “36 Hours” del New York Times, en un mapa.',
    subFood: 'Guías de los mejores restaurantes de Eater y The Infatuation, por ciudad.',
    searchNyt: 'Busca una ciudad, país o título',
    searchFood: 'Busca una ciudad o guía',
    searchLabel: 'Buscar',
    guideTypes: 'Tipos de guía',
    sources: 'Fuentes',
    from: 'Desde',
    to: 'Hasta',
    places: 'lugares',
    scopeView: 'en la vista',
    scopeCluster: 'en este grupo',
    showAllInView: 'Mostrar todo en la vista',
    allPlaces: '← Todos los lugares',
    loading: 'Cargando…',
    foodUnavailable: 'Las guías de restaurantes aún no están disponibles.',
    loadError: 'No se pudieron cargar los datos',
    footerNyt: 'Datos © The New York Times. Los enlaces abren nytimes.com. Proyecto de fans, no oficial.',
    footerFood: 'Los enlaces llevan a las guías originales de Eater y The Infatuation. Proyecto de fans, no oficial.',
    article: { one: 'artículo', other: 'artículos' },
    guide: { one: 'guía', other: 'guías' },
    language: 'Idioma',
    filters: 'Filtros',
  },
};

/**
 * Pick the starting language: a saved choice wins; otherwise walk the browser's language list in order and
 * use the first one we support (["fr-FR", "es-MX"] gives Spanish); otherwise English.
 */
export function initialLang(storage, browserLangs = []) {
  let saved = null;
  try { saved = storage?.getItem('lang'); } catch { /* storage can be blocked */ }
  if (saved && STRINGS[saved]) return saved;
  const list = Array.isArray(browserLangs) ? browserLangs : [browserLangs];
  for (const l of list) {
    const base = String(l).slice(0, 2).toLowerCase();
    if (STRINGS[base]) return base;
  }
  return 'en';
}

export function makeT(lang) {
  const dict = STRINGS[lang] || STRINGS.en;
  const t = (key) => dict[key] ?? STRINGS.en[key] ?? key;
  /** Count with its noun: tn('guide', 3) -> "3 guides" */
  t.count = (key, n) => `${n} ${(t(key)[n === 1 ? 'one' : 'other'])}`;
  t.noun = (key, n) => t(key)[n === 1 ? 'one' : 'other'];
  t.date = (d) => new Date(d + 'T00:00').toLocaleDateString(lang === 'es' ? 'es' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return t;
}
