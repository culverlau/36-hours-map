import { useState, useMemo } from 'react';
import Map from './components/Map/Map';
import Header from './components/Header/Header';
import { useLocations } from './hooks/useLocations';

function App() {
  const { locations, meta, loading, error } = useLocations();
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get unique regions for filter
  const regions = useMemo(() => {
    if (!locations) return [];
    const uniqueRegions = [...new Set(locations.map(loc => loc.region))];
    return uniqueRegions.sort();
  }, [locations]);

  // Filter locations based on region and search
  const filteredLocations = useMemo(() => {
    if (!locations) return [];

    return locations.filter(location => {
      // Region filter
      if (selectedRegion !== 'all' && location.region !== selectedRegion) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = location.name.toLowerCase().includes(query);
        const matchesArticle = location.articles.some(
          article => article.title.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesArticle) {
          return false;
        }
      }

      return true;
    });
  }, [locations, selectedRegion, searchQuery]);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading travel destinations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <h2>Error loading data</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        meta={meta}
        regions={regions}
        selectedRegion={selectedRegion}
        onRegionChange={setSelectedRegion}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredCount={filteredLocations.length}
      />
      <main className="main">
        <Map locations={filteredLocations} />
      </main>
    </div>
  );
}

export default App;
