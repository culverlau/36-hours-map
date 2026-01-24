import { useState, useEffect } from 'react';
import locationsData from '../../data/locations.json';

/**
 * Hook to load and manage location data
 * Currently loads from static JSON, but could be adapted for API calls
 */
export function useLocations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      // Data is imported statically at build time
      setData(locationsData);
      setLoading(false);
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }, []);

  return {
    locations: data?.locations || null,
    meta: data?.meta || null,
    loading,
    error,
  };
}
