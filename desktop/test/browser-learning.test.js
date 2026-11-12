'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { browserWikimediaRecordFromDom } = require(path.join('..', '..', 'src', 'browser-learning.js'));

test('browser research accepts only attributable allow-listed Wikimedia pages', () => {
  const dom = `<html><head><title>Algorithm - Wikipedia</title></head><body><main id="content"><p>${'Algorithms transform input into output. '.repeat(20)}</p></main></body></html>`;
  const record = browserWikimediaRecordFromDom(dom, { url: 'https://en.wikipedia.org/wiki/Algorithm' });
  assert.equal(record.title, 'Algorithm');
  assert.equal(record.domain, 'browser');
  assert.match(record.collectionMethod, /isolated-headless-chromium/);
  assert.equal(browserWikimediaRecordFromDom(dom, { url: 'https://example.com/wiki/Algorithm' }), null);
});

test('browser research falls back when a nested content container is too short', () => {
  const dom = `<html><head><title>Algorithm - Wikipedia</title></head><body><main id="content"><div class="mw-content">tiny</div>${'Useful rendered reference text. '.repeat(20)}</main></body></html>`;
  const record = browserWikimediaRecordFromDom(dom, { url: 'https://en.wikipedia.org/wiki/Algorithm' });
  assert.ok(record && record.text.includes('Useful rendered reference text'));
});
