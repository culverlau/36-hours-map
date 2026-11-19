import { SERIES, seriesLabel } from './series.js';

const fmt = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const SOURCE_LABEL = { eater: 'Eater', infatuation: 'The Infatuation' };

function Chips({ label, options, active, onToggle }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={active.has(o.id) ? 'chip on' : 'chip'} aria-pressed={active.has(o.id)} onClick={() => onToggle(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const toggle = (set, id, setSet) => {
  const next = new Set(set);
  next.has(id) ? next.delete(id) : next.add(id);
  if (next.size) setSet(next);
};

export default function Sidebar({
  tab, setTab, loadingTab, notice, selected, onClose, query, setQuery, yearRange, setYearRange, bounds,
  results, total, onPick, scope, onClearCluster, series, setSeries, availableSeries, sources, setSources,
}) {
  const nyt = tab === 'nyt';
  const years = range(bounds[0], bounds[1]);
  const noun = nyt ? 'articles' : 'guides';

  return (
    <aside className="sidebar">
      <header>
        <h1>36 Hours Map</h1>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={nyt} className={nyt ? 'tab on' : 'tab'} onClick={() => setTab('nyt')}>NYTimes</button>
          <button role="tab" aria-selected={!nyt} className={!nyt ? 'tab on' : 'tab'} onClick={() => setTab('restaurants')}>Restaurants</button>
        </div>
        <p className="sub">
          {nyt ? 'Every New York Times “36 Hours” guide, on a map.' : 'Best-restaurant guides from Eater and The Infatuation, by city.'}
        </p>
      </header>

      <div className="controls">
        <input
          type="search"
          placeholder={nyt ? 'Search a city, country or title' : 'Search a city or guide'}
          value={query}
          aria-label="Search"
          onChange={(e) => setQuery(e.target.value)}
        />
        {nyt ? (
          <>
            {availableSeries.size > 1 && (
              <Chips
                label="Guide types"
                options={SERIES.filter((x) => availableSeries.has(x.id))}
                active={series}
                onToggle={(id) => toggle(series, id, setSeries)}
              />
            )}
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
          </>
        ) : (
          <Chips
            label="Sources"
            options={Object.entries(SOURCE_LABEL).map(([id, label]) => ({ id, label }))}
            active={sources}
            onToggle={(id) => toggle(sources, id, setSources)}
          />
        )}
        <p className="count">
          {notice ? notice : loadingTab ? 'Loading…' : <>{results.length} places · {total} {noun} {scope}</>}
          {onClearCluster && <> · <button className="back" onClick={onClearCluster}>Show all in view</button></>}
        </p>
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
                <time>
                  {nyt
                    ? `${fmt(a.date)}${a.series && a.series !== '36-hours' ? ` · ${seriesLabel(a.series)}` : ''}`
                    : SOURCE_LABEL[a.source]}
                </time>
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
                <small>
                  {nyt
                    ? `${l.articles[0].date.slice(0, 4)}${l.articles.length > 1 ? ` · ${l.articles.length} articles` : ''}`
                    : `${l.articles.length} ${l.articles.length === 1 ? 'guide' : 'guides'}`}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <footer>
        {nyt
          ? 'Data © The New York Times. Links open nytimes.com. Unofficial fan project.'
          : 'Links go to the original guides on Eater and The Infatuation. Unofficial fan project.'}
      </footer>
    </aside>
  );
}
