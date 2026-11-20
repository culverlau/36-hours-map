import { useRef, useState } from 'react';
import { SERIES, seriesLabel } from './series.js';
import { LANGS } from './i18n.js';

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

function LangSwitch({ lang, setLang, t }) {
  return (
    <div className="lang" role="group" aria-label={t('language')}>
      {LANGS.map((l) => (
        <button key={l.id} type="button" className={lang === l.id ? 'lang-btn on' : 'lang-btn'} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

export default function Sidebar({
  tab, setTab, loadingTab, notice, selected, onClose, query, setQuery, yearRange, setYearRange, bounds,
  results, total, onPick, scope, onClearCluster, series, setSeries, availableSeries, sources, setSources,
  t, lang, setLang,
}) {
  const nyt = tab === 'nyt';
  const years = range(bounds[0], bounds[1]);
  const noun = (n) => t.noun(nyt ? 'article' : 'guide', n);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const toggleSearch = () => {
    if (searchOpen) { setSearchOpen(false); return; }
    setSearchOpen(true);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  return (
    <aside className="sidebar">
      <header>
        <div className="title-row">
          <h1>{t('appTitle')}</h1>
          <LangSwitch lang={lang} setLang={setLang} t={t} />
        </div>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={nyt} className={nyt ? 'tab on' : 'tab'} onClick={() => setTab('nyt')}>{t('tabNyt')}</button>
          <button role="tab" aria-selected={!nyt} className={!nyt ? 'tab on' : 'tab'} onClick={() => setTab('restaurants')}>{t('tabFood')}</button>
        </div>
        <p className="sub">{nyt ? t('subNyt') : t('subFood')}</p>
      </header>

      <div className="controls">
        <div className="summary">
          <p className="count">
            {notice ? t(notice) : loadingTab ? t('loading') : <>{results.length} {t('places')} · {total} {noun(total)} {t(scope)}</>}
            {onClearCluster && <> · <button className="back" onClick={onClearCluster}>{t('showAllInView')}</button></>}
          </p>
          <button type="button" className="filters-btn" aria-expanded={searchOpen || !!query} onClick={toggleSearch}>
            <svg className="icon" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg>
            {t('searchLabel')}
          </button>
          <button type="button" className="filters-btn" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
            <svg className="icon" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 7h16M7 12h10M10 17h4" /></svg>
            {t('filters')}
          </button>
        </div>
        <input
          ref={searchRef}
          className={searchOpen || query ? 'search open' : 'search'}
          type="search"
          placeholder={nyt ? t('searchNyt') : t('searchFood')}
          value={query}
          aria-label={t('searchLabel')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={filtersOpen ? 'filters open' : 'filters'}>
          {nyt ? (
            <>
              {availableSeries.size > 1 && (
                <Chips
                  label={t('guideTypes')}
                  options={SERIES.filter((x) => availableSeries.has(x.id))}
                  active={series}
                  onToggle={(id) => toggle(series, id, setSeries)}
                />
              )}
              <div className="years">
                <label>
                  {t('from')}
                  <select value={yearRange[0]} onChange={(e) => setYearRange([+e.target.value, Math.max(+e.target.value, yearRange[1])])}>
                    {years.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </label>
                <label>
                  {t('to')}
                  <select value={yearRange[1]} onChange={(e) => setYearRange([Math.min(yearRange[0], +e.target.value), +e.target.value])}>
                    {years.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </label>
              </div>
            </>
          ) : (
            <Chips
              label={t('sources')}
              options={Object.entries(SOURCE_LABEL).map(([id, label]) => ({ id, label }))}
              active={sources}
              onToggle={(id) => toggle(sources, id, setSources)}
            />
          )}
        </div>
      </div>

      {selected ? (
        <section className="detail">
          <button className="back" onClick={onClose}>{t('allPlaces')}</button>
          <h2>{selected.name}</h2>
          {selected.country && <p className="country">{selected.country}</p>}
          <ul>
            {selected.articles.map((a) => (
              <li key={a.id}>
                <a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
                <time>
                  {nyt
                    ? `${t.date(a.date)}${a.series && a.series !== '36-hours' ? ` · ${seriesLabel(a.series)}` : ''}`
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
                    ? `${l.articles[0].date.slice(0, 4)}${l.articles.length > 1 ? ` · ${t.count('article', l.articles.length)}` : ''}`
                    : t.count('guide', l.articles.length)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <footer>
        {nyt ? t('footerNyt') : t('footerFood')}
      </footer>
    </aside>
  );
}
