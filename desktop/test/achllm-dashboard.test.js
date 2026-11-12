'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');

test('AchLLM dashboard exposes zoomable evidence charts and a protected test chat', () => {
  const html = fs.readFileSync(path.join(root, 'docs', 'achllm.html'), 'utf8');
  for (const text of ['Checkpoint growth', 'Training inventory', 'Evidence readiness', 'Ten-aspect evidence map', 'Ctrl + wheel', 'reasoning', 'multilingual', 'long-context', 'tool-use', 'Test AchLLM', 'Gateway password']) {
    assert.ok(html.includes(text), `missing ${text}`);
  }
});

test('public telemetry distinguishes publication from capability evaluation', () => {
  const script = fs.readFileSync(path.join(root, 'scripts', 'write-achllm-status.mjs'), 'utf8');
  assert.match(script, /status: 'published'/);
  assert.match(script, /codeLicense: 'Proprietary/);
  assert.match(script, /comparableToFrontier: false/);
  assert.match(script, /awaiting-normalized-evidence/);
  assert.match(script, /achllm-history\.json/);
});

test('public gateway keeps model access authenticated and origin-restricted', () => {
  const proxy = fs.readFileSync(path.join(root, 'deploy', 'seed-lm', 'public-proxy.cjs'), 'utf8');
  assert.match(proxy, /WINAGENT_PROXY_PASSWORD/);
  assert.match(proxy, /WINAGENT_CORS_ORIGIN/);
  assert.match(proxy, /rateAllowed/);
  assert.match(proxy, /v1\/chat\/completions/);
});
