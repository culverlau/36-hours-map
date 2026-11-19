import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseEater, parseInfatuation, listTitle } from '../scripts/restaurants/extract.js';
import { groupByCity } from '../scripts/restaurants/build.js';

const read = (f) => fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');

test('parseEater reads coordinates from a guide page and drops repeats', () => {
  const r = parseEater(read('eater-sample.html'));
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].lat, r[0].lng], [40.1, -73.9]);
  assert.equal(listTitle(read('eater-sample.html')), 'The 38 Best Restaurants in Test City');
});

test('parseInfatuation reads venues from the guide data', () => {
  const r = parseInfatuation(read('infatuation-sample.html'));
  assert.equal(r.length, 2);
  assert.equal(r[1].name, 'Noodle & Co');
});

test('guides for the same city share one pin; far-apart cities do not', () => {
  const g = (source, city, lat, lng, title) => ({ source, city, lat, lng, title, label: title, url: `https://x/${source}/${city}` });
  const pins = groupByCity([
    g('eater', 'Paris', 48.86, 2.35, 'Eater Paris'),
    g('infatuation', 'Paris', 48.87, 2.33, 'Best Restaurants In Paris - Paris - The Infatuation'),
    g('eater', 'Rome', 41.9, 12.5, 'Eater Rome'),
  ]);
  assert.equal(pins.length, 2);
  const paris = pins.find((p) => p.name === 'Paris');
  assert.deepEqual(paris.articles.map((a) => a.source).sort(), ['eater', 'infatuation']);
  assert.equal(paris.articles.find((a) => a.source === 'infatuation').title, 'Best Restaurants In Paris');
});
