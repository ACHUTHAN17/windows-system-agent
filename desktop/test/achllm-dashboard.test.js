'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');

test('AchLLM dashboard exposes a zoomable evidence-only comparison workspace', () => {
  const html = fs.readFileSync(path.join(root, 'docs', 'achllm.html'), 'utf8');
  for (const text of ['Frontier comparison workspace', 'Ctrl + wheel to zoom', 'reasoning', 'multilingual', 'long-context', 'tool-use', 'Not evaluated']) {
    assert.ok(html.includes(text), `missing ${text}`);
  }
});

test('public telemetry distinguishes publication from capability evaluation', () => {
  const script = fs.readFileSync(path.join(root, 'scripts', 'write-achllm-status.mjs'), 'utf8');
  assert.match(script, /status: 'published'/);
  assert.match(script, /codeLicense: 'Proprietary/);
  assert.match(script, /comparableToFrontier: false/);
  assert.match(script, /awaiting-normalized-evidence/);
});
