export const SERIES = [
  { id: '36-hours', label: '36 Hours' },
  { id: 'whats-new', label: 'What’s New' },
  { id: 'layover', label: 'Layover' },
  { id: 'flocking-to', label: 'Flocking To (T Magazine)' },
  { id: 'five-places', label: '5 Places' },
];
export const seriesLabel = (id) => SERIES.find((s) => s.id === id)?.label ?? id;
