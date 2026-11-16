import test from 'node:test';
import assert from 'node:assert/strict';
import { placeFromTitle, expandGlocation, pickQuery, dedupe } from '../scripts/lib/places.js';

test('placeFromTitle handles title styles', () => {
  assert.equal(placeFromTitle('36 Hours in Savannah, Ga.'), 'Savannah, Ga.');
  assert.equal(placeFromTitle('36 Hours -- Death Valley'), 'Death Valley');
  assert.equal(placeFromTitle('36 Hours | Portland'), 'Portland');
  assert.equal(placeFromTitle('36 Hours: Ljubljana, Slovenia'), 'Ljubljana, Slovenia');
});
test('expandGlocation expands AP state abbreviations', () => {
  assert.equal(expandGlocation('Portland (Ore)'), 'Portland, Oregon');
  assert.equal(expandGlocation('DEATH VALLEY (CALIF)'), 'Death Valley, California');
  assert.equal(expandGlocation('Toronto (Ontario)'), 'Toronto, Ontario');
});
test('pickQuery prefers matching glocation', () => {
  const a = { title: '36 Hours in Portland, Maine', glocations: ['Peaks Island (Me)', 'Portland (Me)'] };
  assert.equal(pickQuery({ title: '36 Hours in Portland', glocations: ['Portland (Me)'] }).query, 'Portland, Maine');
  assert.equal(pickQuery(a).query, 'Portland, Maine');
  assert.equal(pickQuery({ title: '36 Hours in Indianapolis', glocations: ['Indiana'] }).query, 'Indianapolis');
  assert.equal(pickQuery({ title: '36 Hours in Savannah, Ga.', glocations: [] }).query, 'Savannah, Georgia');
  assert.equal(pickQuery({ title: '36 Hours in Lyon', glocations: [] }).query, 'Lyon');
});
test('dedupe merges video/interactive twins but keeps years apart', () => {
  const mk = (url, date, type) => ({ query: 'Savannah, Georgia', url, date, type });
  const out = dedupe([
    mk('https://nytimes.com/video/x', '2015-06-03', 'video'),
    mk('https://nytimes.com/2015/a', '2015-06-07', 'article'),
    mk('https://nytimes.com/2023/a', '2023-03-02', 'article'),
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].type, 'article');
});

test('placeFromTitle drops stray leading digit', () => {
  assert.equal(placeFromTitle('36 HOURS | 5 Half Moon Bay, Calif.'), 'Half Moon Bay, Calif.');
});

test('placeFromTitle handles "on" and "the"', () => {
  assert.equal(placeFromTitle('36 Hours on Martha’s Vineyard, Mass.'), 'Martha’s Vineyard, Mass.');
  assert.equal(placeFromTitle('36 Hours on the Amalfi Coast, Italy'), 'Amalfi Coast, Italy');
});
test('expandGlocation avoids duplicated city for DC', () => {
  assert.equal(expandGlocation('Washington (DC)'), 'Washington, D.C.');
});
