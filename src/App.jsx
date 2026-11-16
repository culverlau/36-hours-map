import { useEffect, useMemo, useState } from 'react';
import MapView from './MapView.jsx';
import Sidebar from './Sidebar.jsx';

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [yearRange, setYearRange] = useState(null);
  const [cluster, setCluster] = useState(null); // { clusterId, ids } when a map cluster is selected
  const [view, setView] = useState(null); // [west, south, east, north]

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/articles.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        setData(d);
        const years = d.locations.flatMap((l) => l.articles.map((a) => +a.date.slice(0, 4)));
        setYearRange([Math.min(...years), Math.max(...years)]);
      })
      .catch(setError);
  }, []);

  const bounds = useMemo(() => {
    if (!data) return null;
    const years = data.locations.flatMap((l) => l.articles.map((a) => +a.date.slice(0, 4)));
    return [Math.min(...years), Math.max(...years)];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data || !yearRange) return [];
    const q = query.trim().toLowerCase();
    return data.locations
      .map((l) => ({
        ...l,
        articles: l.articles.filter((a) => {
          const y = +a.date.slice(0, 4);
          return y >= yearRange[0] && y <= yearRange[1];
        }),
      }))
      .filter((l) => l.articles.length)
      .sort((a, b) => b.articles[0].date.localeCompare(a.articles[0].date))
      .filter((l) => !q || `${l.name} ${l.country ?? ''} ${l.articles.map((a) => a.title).join(' ')}`.toLowerCase().includes(q));
  }, [data, query, yearRange]);

  const visible = useMemo(() => {
    if (cluster) return filtered.filter((l) => cluster.ids.includes(l.id));
    if (!view) return filtered;
    const [w, s, e, n] = view;
    const wholeWorld = e - w >= 360;
    return filtered.filter((l) => l.lat >= s && l.lat <= n && (wholeWorld || (l.lng >= w && l.lng <= e)));
  }, [filtered, view, cluster]);

  if (error) return <div className="status">Could not load data: {error.message}</div>;
  if (!data) return <div className="status">Loading…</div>;

  const selected = filtered.find((l) => l.id === selectedId) || null;
  const total = visible.reduce((n, l) => n + l.articles.length, 0);

  return (
    <div className="app">
      <Sidebar
        selected={selected}
        onClose={() => setSelectedId(null)}
        query={query}
        setQuery={setQuery}
        yearRange={yearRange}
        setYearRange={setYearRange}
        bounds={bounds}
        results={visible}
        total={total}
        scope={cluster ? 'in this cluster' : 'in view'}
        onClearCluster={cluster ? () => setCluster(null) : null}
        onPick={setSelectedId}
      />
      <MapView
        onViewChange={setView}
        clusterId={cluster?.clusterId ?? null}
        onClusterSelect={(c) => { setCluster(c); setSelectedId(null); }}
        onBlankClick={() => { setCluster(null); setSelectedId(null); }}
        onClusterClear={() => setCluster(null)} fitKey={query.trim() ? query.trim().toLowerCase() : ''} locations={filtered} selectedId={selectedId} onSelect={(id) => { setCluster(null); setSelectedId(id); }} />
    </div>
  );
}
