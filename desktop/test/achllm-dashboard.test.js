'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');

test('AchLLM dashboard exposes zoomable evidence charts, sourced scorecards, and a protected test chat', () => {
  const html = fs.readFileSync(path.join(root, 'docs', 'achllm.html'), 'utf8');
  for (const text of ['Checkpoint growth', 'Training inventory', 'Evidence readiness', 'Ten-aspect evidence map', 'Published multi-model scorecard', 'achllm-benchmarks.json', 'Ctrl + wheel', 'reasoning', 'multilingual', 'long-context', 'tool-use', 'Test AchLLM', 'Gateway password', 'live refresh 2s', 'setInterval']) {
    assert.ok(html.includes(text), `missing ${text}`);
  }
  const benchmarks = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'achllm-benchmarks.json'), 'utf8'));
  assert.equal(benchmarks.suites.length, 2);
  assert.equal(benchmarks.suites[0].models[0].score, null, 'AchLLM must not receive an invented score');
  assert.ok(benchmarks.suites.every((suite) => /^https:\/\//.test(suite.source)));
});

test('public telemetry distinguishes publication from capability evaluation', () => {
  const script = fs.readFileSync(path.join(root, 'scripts', 'write-achllm-status.mjs'), 'utf8');
  assert.match(script, /status: 'published'/);
  assert.match(script, /codeLicense: 'Proprietary/);
  assert.match(script, /comparableToFrontier: false/);
  assert.match(script, /awaiting-normalized-evidence/);
  assert.match(script, /benchmarkCatalog/);
  assert.match(script, /achllm-history\.json/);
});

test('public gateway keeps model access authenticated and origin-restricted', () => {
  const proxy = fs.readFileSync(path.join(root, 'deploy', 'seed-lm', 'public-proxy.cjs'), 'utf8');
  assert.match(proxy, /WINAGENT_PROXY_PASSWORD/);
  assert.match(proxy, /WINAGENT_CORS_ORIGIN/);
  assert.match(proxy, /rateAllowed/);
  assert.match(proxy, /v1\/chat\/completions/);
  assert.match(proxy, /achllm\/status/);
});
