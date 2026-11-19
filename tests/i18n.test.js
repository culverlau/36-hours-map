import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, initialLang, makeT } from '../src/i18n.js';

test('every English string has a Spanish translation, and vice versa', () => {
  assert.deepEqual(Object.keys(STRINGS.es).sort(), Object.keys(STRINGS.en).sort());
  for (const k of Object.keys(STRINGS.en)) {
    if (typeof STRINGS.en[k] === 'object') assert.deepEqual(Object.keys(STRINGS.es[k]).sort(), Object.keys(STRINGS.en[k]).sort());
    else assert.ok(STRINGS.es[k].length > 0, k);
  }
});

test('starting language: saved choice wins, then the browser, then English', () => {
  const store = (v) => ({ getItem: () => v });
  assert.equal(initialLang(store('en'), 'es-MX'), 'en');
  assert.equal(initialLang(store(null), 'es-MX'), 'es');
  assert.equal(initialLang(store(null), 'fr-FR'), 'en');
  assert.equal(initialLang({ getItem() { throw new Error('blocked'); } }, 'es'), 'es');
});

test('counts use the right singular and plural', () => {
  assert.equal(makeT('es').count('guide', 1), '1 guía');
  assert.equal(makeT('es').count('guide', 3), '3 guías');
  assert.equal(makeT('en').count('article', 1), '1 article');
});
