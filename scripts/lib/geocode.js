/**
 * Google Geocoding API utilities
 */

const GEOCODE_API_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Geocode a location string to coordinates
 * @param {string} location - Location name (e.g., "Austin, Texas")
 * @param {string} apiKey - Google Geocoding API key
 * @returns {Promise<{lat: number, lng: number, formattedAddress: string, confidence: string} | null>}
 */
export async function geocodeLocation(location, apiKey) {
  const params = new URLSearchParams({
    address: location,
    key: apiKey,
  });

  const url = `${GEOCODE_API_BASE}?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status === 'ZERO_RESULTS') {
    return null;
  }

  if (data.status === 'OVER_QUERY_LIMIT') {
    throw new Error('Geocoding API quota exceeded');
  }

  if (data.status !== 'OK') {
    throw new Error(`Geocoding API error: ${data.status}`);
  }

  const results = data.results;

  if (results.length === 0) {
    return null;
  }

  // Determine confidence based on number of results and location type
  let confidence = 'high';
  if (results.length > 1) {
    confidence = 'medium';
  }
  if (results[0].geometry.location_type === 'APPROXIMATE') {
    // APPROXIMATE is fine for regions/areas
    confidence = results.length > 1 ? 'low' : 'medium';
  }

  const result = results[0];

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
    confidence,
    allResults: results.length > 1 ? results.map(r => ({
      formattedAddress: r.formatted_address,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
    })) : undefined,
  };
}

/**
 * Determine the region/continent from coordinates
 * Simple heuristic based on longitude/latitude ranges
 */
export function determineRegion(lat, lng) {
  // Very rough continental boundaries
  if (lat > 35 && lng > -30 && lng < 60) return 'Europe';
  if (lat > 0 && lat < 35 && lng > -20 && lng < 60) return 'Africa';
  if (lat < 0 && lng > -20 && lng < 60) return 'Africa';
  if (lng > 60 && lng < 150) return 'Asia';
  if (lat < 0 && lng > 100) return 'Oceania';
  if (lng > -170 && lng < -30) {
    if (lat > 15) return 'North America';
    if (lat > -15) return 'Central America';
    return 'South America';
  }
  if (lng > 140 || lng < -140) return 'Oceania';

  return 'Other';
}

/**
 * Create a slug from a location name
 * "Austin, Texas" -> "austin-texas"
 */
export function createLocationSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Check if two coordinates are close enough to be the same location
 * Uses ~10km threshold
 */
export function isSameLocation(coord1, coord2, thresholdKm = 10) {
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return distance < thresholdKm;
}
