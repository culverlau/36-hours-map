const fmt = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export default function Sidebar({ selected, onClose, query, setQuery, yearRange, setYearRange, bounds, results, total, onPick }) {
  const years = range(bounds[0], bounds[1]);
  return (
    <aside className="sidebar">
      <header>
        <h1>36 Hours Map</h1>
        <p className="sub">Every New York Times “36 Hours” guide, on a map.</p>
      </header>

      <div className="controls">
        <input
          type="search"
          placeholder="Search a city, country or title"
          value={query}
          aria-label="Search"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="years">
          <label>
            From
            <select value={yearRange[0]} onChange={(e) => setYearRange([+e.target.value, Math.max(+e.target.value, yearRange[1])])}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          <label>
            To
            <select value={yearRange[1]} onChange={(e) => setYearRange([Math.min(yearRange[0], +e.target.value), +e.target.value])}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
        </div>
        <p className="count">{total} articles in {results.length} places</p>
      </div>

      {selected ? (
        <section className="detail">
          <button className="back" onClick={onClose}>← All places</button>
          <h2>{selected.name}</h2>
          {selected.country && <p className="country">{selected.country}</p>}
          <ul>
            {selected.articles.map((a) => (
              <li key={a.id}>
                <a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
                <time>{fmt(a.date)}</time>
                {a.abstract && <p>{a.abstract}</p>}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <ul className="places">
          {results.slice(0, 200).map((l) => (
            <li key={l.id}>
              <button onClick={() => onPick(l.id)}>
                <span>{l.name}</span>
                <small>{l.articles.length > 1 ? `${l.articles.length} articles` : l.articles[0].date.slice(0, 4)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <footer>Data © The New York Times. Links open nytimes.com. Unofficial fan project.</footer>
    </aside>
  );
}
