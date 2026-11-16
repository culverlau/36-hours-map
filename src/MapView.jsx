import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const toGeoJSON = (locations) => ({
  type: 'FeatureCollection',
  features: locations.map((l) => ({
    type: 'Feature',
    properties: { id: l.id, name: l.name, count: l.articles.length },
    geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
  })),
});

export default function MapView({ locations, selectedId, onSelect, fitKey, onViewChange, clusterId, onClusterSelect, onBlankClick, onClusterClear, flyTo }) {
  const el = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const latest = useRef({});
  latest.current = { locations, onSelect, onViewChange, onClusterSelect, onBlankClick, onClusterClear };

  useEffect(() => {
    const m = new maplibregl.Map({
      container: el.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [10, 30],
      zoom: 1.6,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    m.on('load', () => {
      m.addSource('places', { type: 'geojson', data: toGeoJSON(latest.current.locations), cluster: true, clusterRadius: 40, clusterMaxZoom: 9 });
      m.addLayer({
        id: 'cluster-highlight', type: 'circle', source: 'places', filter: ['==', ['get', 'cluster_id'], -1],
        paint: {
          'circle-color': '#111', 'circle-opacity': 0.2,
          'circle-radius': ['+', ['step', ['get', 'point_count'], 14, 10, 18, 50, 24, 150, 30], 7],
          'circle-stroke-width': 2, 'circle-stroke-color': '#111',
        },
      });
      m.addLayer({
        id: 'clusters', type: 'circle', source: 'places', filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#c8102e',
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24, 150, 30],
          'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
        },
      });
      m.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'places', filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12, 'text-font': ['Noto Sans Bold'] },
        paint: { 'text-color': '#fff' },
      });
      m.addLayer({
        id: 'points', type: 'circle', source: 'places', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#c8102e',
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 6, 5, 10],
          'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
        },
      });
      m.addLayer({
        id: 'selected', type: 'circle', source: 'places', filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-color': '#111', 'circle-radius': 11, 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' },
      });

      m.on('click', 'clusters', async (e) => {
        const f = m.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
        const cid = f.properties.cluster_id;
        const leaves = await m.getSource('places').getClusterLeaves(cid, Infinity, 0);
        latest.current.onClusterSelect?.({ clusterId: cid, ids: leaves.map((l) => l.properties.id) });
      });
      m.on('click', (e) => {
        const hit = m.queryRenderedFeatures(e.point, { layers: ['clusters', 'points'] });
        if (!hit.length) latest.current.onBlankClick?.();
      });
      // Cluster ids change when the zoom level changes, so drop the cluster selection on a user zoom.
      m.on('zoomstart', (e) => { if (e.originalEvent) latest.current.onClusterClear?.(); });
      m.on('click', 'points', (e) => latest.current.onSelect(e.features[0].properties.id));
      for (const layer of ['clusters', 'points']) {
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
      }
      const report = () => {
        const b = m.getBounds();
        latest.current.onViewChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      };
      m.on('moveend', report);
      report();
      ready.current = true;
      m.fire('app-ready');
    });
    return () => m.remove();
  }, []);

  useEffect(() => {
    const m = map.current;
    const apply = () => m.getSource('places')?.setData(toGeoJSON(locations));
    ready.current ? apply() : m.once('app-ready', apply);
  }, [locations]);

  useEffect(() => {
    const m = map.current;
    const apply = () => m.setFilter('cluster-highlight', ['==', ['get', 'cluster_id'], clusterId ?? -1]);
    ready.current ? apply() : m.once('app-ready', apply);
  }, [clusterId]);

  useEffect(() => {
    const m = map.current;
    const apply = () => {
      const locs = latest.current.locations;
      if (!fitKey || !locs.length) return;
      const b = new maplibregl.LngLatBounds();
      locs.forEach((l) => b.extend([l.lng, l.lat]));
      m.fitBounds(b, { padding: 60, maxZoom: 8, duration: 600 });
    };
    ready.current ? apply() : m.once('app-ready', apply);
  }, [fitKey]);

  useEffect(() => {
    const m = map.current;
    const apply = () => {
      m.setFilter('selected', ['==', ['get', 'id'], selectedId || '']);
    };
    ready.current ? apply() : m.once('app-ready', apply);
  }, [selectedId]);

  // Picking a place from the list zooms to it (clicking a dot on the map does not).
  useEffect(() => {
    if (!flyTo) return;
    const m = map.current;
    const loc = latest.current.locations.find((l) => l.id === flyTo.id);
    if (loc) m.flyTo({ center: [loc.lng, loc.lat], zoom: Math.max(m.getZoom(), 7), duration: 700, essential: true });
  }, [flyTo]);

  return <div className="map" ref={el} />;
}
