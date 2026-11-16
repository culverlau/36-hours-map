import { useEffect, useMemo, useState } from 'react';
import MapView from './MapView.jsx';
import Sidebar from './Sidebar.jsx';

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [yearRange, setYearRange] = useState(null);

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

  if (error) return <div className="status">Could not load data: {error.message}</div>;
  if (!data) return <div className="status">Loading…</div>;

  const selected = filtered.find((l) => l.id === selectedId) || null;
  const total = filtered.reduce((n, l) => n + l.articles.length, 0);

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
        results={filtered}
        total={total}
        onPick={setSelectedId}
      />
      <MapView fitKey={query.trim() ? query.trim().toLowerCase() : ''} locations={filtered} selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  );
}
