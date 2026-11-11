'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { recordsFromWikimedia } = require(path.join('..', '..', 'src', 'seed-training.js'));

test('public training ingestion keeps an attributable source and rejects tiny extracts', () => {
  const records = recordsFromWikimedia({ query: { pages: [
    { pageid: 7, title: 'Example page', extract: 'A'.repeat(400) },
    { pageid: 8, title: 'Tiny page', extract: 'too short' },
  ] } });
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].source, 'https://en.wikipedia.org/wiki/Example_page');
  assert.match(records[0].license, /CC BY-SA/);
});
