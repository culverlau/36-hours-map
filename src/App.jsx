import { useEffect, useMemo, useState } from 'react';
import MapView from './MapView.jsx';
import { SERIES } from './series.js';
import Sidebar from './Sidebar.jsx';
import { initialLang, makeT } from './i18n.js';

const SOURCES = ['eater', 'infatuation'];
const ACCENT = { nyt: '#c8102e', restaurants: '#4f46e5' }; // red for NYTimes, indigo for restaurants

const load = (file) =>
  fetch(`${import.meta.env.BASE_URL}data/${file}`).then(async (r) => {
    // A missing file can come back as the site's HTML page, so check before parsing.
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error(`${file} is not available yet`);
    return r.json();
  });

export default function App() {
  const [lang, setLangState] = useState(() => initialLang(window.localStorage, navigator.languages?.length ? navigator.languages : [navigator.language]));
  const t = useMemo(() => makeT(lang), [lang]);
  const setLang = (next) => {
    setLangState(next);
    try { window.localStorage.setItem('lang', next); } catch { /* storage can be blocked */ }
  };
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('appTitle');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('description'));
  }, [lang, t]);

  const [tab, setTab] = useState('nyt'); // 'nyt' | 'restaurants'
  const [data, setData] = useState(null);
  const [restaurants, setRestaurants] = useState(null);
  const [error, setError] = useState(null);
  const [foodError, setFoodError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [yearRange, setYearRange] = useState(null);
  const [cluster, setCluster] = useState(null); // { clusterId, ids } when a map cluster is selected
  const [flyTo, setFlyTo] = useState(null);
  const [series, setSeries] = useState(() => new Set(SERIES.map((x) => x.id)));
  const [sources, setSources] = useState(() => new Set(SOURCES));
  const [view, setView] = useState(null); // [west, south, east, north]

  useEffect(() => {
    load('articles.json')
      .then((d) => {
        setData(d);
        const years = d.locations.flatMap((l) => l.articles.map((a) => +a.date.slice(0, 4)));
        setYearRange([Math.min(...years), Math.max(...years)]);
      })
      .catch(setError);
  }, []);

  useEffect(() => {
    if (tab === 'restaurants' && !restaurants && !foodError) {
      load('guides.json').then((d) => setRestaurants(d.locations)).catch(setFoodError);
    }
  }, [tab, restaurants, foodError]);

  const switchTab = (next) => {
    setTab(next);
    setQuery('');
    setSelectedId(null);
    setCluster(null);
  };

  const bounds = useMemo(() => {
    if (!data) return null;
    const years = data.locations.flatMap((l) => l.articles.map((a) => +a.date.slice(0, 4)));
    return [Math.min(...years), Math.max(...years)];
  }, [data]);

  const availableSeries = useMemo(() => {
    if (!data) return new Set();
    return new Set(data.locations.flatMap((l) => l.articles.map((a) => a.series || '36-hours')));
  }, [data]);

  const nyt = useMemo(() => {
    if (!data || !yearRange) return [];
    const q = query.trim().toLowerCase();
    return data.locations
      .map((l) => ({
        ...l,
        articles: l.articles.filter((a) => {
          const y = +a.date.slice(0, 4);
          return y >= yearRange[0] && y <= yearRange[1] && series.has(a.series || '36-hours');
        }),
      }))
      .filter((l) => l.articles.length)
      .sort((a, b) => b.articles[0].date.localeCompare(a.articles[0].date))
      .filter((l) => !q || `${l.name} ${l.country ?? ''} ${l.articles.map((a) => a.title).join(' ')}`.toLowerCase().includes(q));
  }, [data, query, yearRange, series]);

  const food = useMemo(() => {
    if (!restaurants) return [];
    const q = query.trim().toLowerCase();
    return restaurants
      .map((l) => ({ ...l, articles: l.articles.filter((a) => sources.has(a.source)) }))
      .filter((l) => l.articles.length)
      .filter((l) => !q || `${l.name} ${l.articles.map((a) => a.title).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [restaurants, query, sources]);

  const filtered = tab === 'nyt' ? nyt : food;

  const visible = useMemo(() => {
    if (cluster) return filtered.filter((l) => cluster.ids.includes(l.id));
    if (!view) return filtered;
    const [w, s, e, n] = view;
    const wholeWorld = e - w >= 360;
    return filtered.filter((l) => l.lat >= s && l.lat <= n && (wholeWorld || (l.lng >= w && l.lng <= e)));
  }, [filtered, view, cluster]);

  if (error) return <div className="status">{t('loadError')}: {error.message}</div>;
  if (!data) return <div className="status">{t('loading')}</div>;

  const selected = filtered.find((l) => l.id === selectedId) || null;
  const total = visible.reduce((n, l) => n + l.articles.length, 0);
  // Re-fit the map only while searching; switching tabs leaves the map exactly where it is.
  const fitKey = query.trim() ? `${tab}|${query.trim().toLowerCase()}` : '';

  return (
    <div className="app" data-tab={tab}>
      <Sidebar
        tab={tab}
        setTab={switchTab}
        loadingTab={tab === 'restaurants' && !restaurants && !foodError}
        notice={tab === 'restaurants' && foodError ? 'foodUnavailable' : null}
        selected={selected}
        onClose={() => setSelectedId(null)}
        query={query}
        setQuery={setQuery}
        series={series}
        setSeries={setSeries}
        availableSeries={availableSeries}
        sources={sources}
        setSources={setSources}
        yearRange={yearRange}
        setYearRange={setYearRange}
        bounds={bounds}
        results={visible}
        total={total}
        scope={cluster ? 'scopeCluster' : 'scopeView'}
        t={t}
        lang={lang}
        setLang={setLang}
        onClearCluster={cluster ? () => setCluster(null) : null}
        onPick={(id) => {
          setSelectedId(id);
          setFlyTo({ id, n: Date.now() });
          setCluster((c) => (c ? { ...c, clusterId: null } : c)); // cluster ids change once we zoom
        }}
      />
      <MapView
        accent={ACCENT[tab]}
        flyTo={flyTo}
        onViewChange={setView}
        clusterId={cluster?.clusterId ?? null}
        onClusterSelect={(c) => { setCluster(c); setSelectedId(null); }}
        onBlankClick={() => { setCluster(null); setSelectedId(null); }}
        onClusterClear={() => setCluster(null)}
        fitKey={fitKey}
        locations={filtered}
        selectedId={selectedId}
        onSelect={(id) => { setCluster(null); setSelectedId(id); }}
      />
    </div>
  );
}
