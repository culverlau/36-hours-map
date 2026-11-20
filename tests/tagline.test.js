import test from 'node:test';
import assert from 'node:assert/strict';
import { tagline } from '../scripts/lib/tagline.js';

test('short abstracts are untouched', () => {
  assert.equal(tagline('A short teaser.'), 'A short teaser.');
});

test('a full article is cut at a sentence end', () => {
  const full = `${'First sentence is here. '.repeat(3)}${'More text goes on and on. '.repeat(40)}`;
  const out = tagline(full);
  assert.ok(out.length <= 240);
  assert.ok(out.endsWith('.'));
});

test('with no sentence break it cuts at a word and adds an ellipsis', () => {
  const out = tagline('word '.repeat(200));
  assert.ok(out.length <= 241);
  assert.ok(out.endsWith('…'));
});

test('missing abstract passes through', () => {
  assert.equal(tagline(undefined), undefined);
});
