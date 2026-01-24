import './Header.css';

function Header({
  meta,
  regions,
  selectedRegion,
  onRegionChange,
  searchQuery,
  onSearchChange,
  filteredCount,
}) {
  return (
    <header className="header">
      <div className="header-brand">
        <h1 className="header-title">36 Hours Map</h1>
        <p className="header-subtitle">
          Explore {meta?.totalArticles || 0} NYT travel guides across {meta?.totalLocations || 0} destinations
        </p>
      </div>

      <div className="header-controls">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search destinations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        <select
          className="region-select"
          value={selectedRegion}
          onChange={(e) => onRegionChange(e.target.value)}
        >
          <option value="all">All Regions</option>
          {regions.map(region => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>

        <span className="results-count">
          {filteredCount} {filteredCount === 1 ? 'destination' : 'destinations'}
        </span>
      </div>
    </header>
  );
}

export default Header;
