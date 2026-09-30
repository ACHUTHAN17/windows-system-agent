'use strict';
// src/llm.js's model fallback chain, exercised against local mock servers (no real network).
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');

const { chat } = require(path.join('..', '..', 'src', 'llm.js'));

function server(status, body) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}
const url = (s) => `http://127.0.0.1:${s.address().port}`;

test('single-entry chain: a failure throws a plain, unwrapped message', async () => {
  const bad = await server(500, {});
  const cfg = { provider: 'openai-compatible', apiUrl: url(bad), model: 'x', timeoutMs: 3000, useScoutedModels: false };
  await assert.rejects(() => chat(cfg, [{ role: 'user', content: 'hi' }]), (e) => {
    assert.ok(!e.message.includes('All '), 'no chain-summary wrapping for a single attempt');
    return true;
  });
  bad.close();
});

test('all-fail chain: error names EVERY attempt (primary vs fallback), not just the last one', async () => {
  const primary = await server(429, { error: 'rate limited' });
  const fallback = await server(402, { error: 'payment required' });
  const cfg = {
    provider: 'openai-compatible', apiUrl: url(primary), model: 'deepseek/deepseek-chat-v3.1:free', timeoutMs: 3000,
    fallbackUrl: url(fallback), fallbackModel: 'openai', useScoutedModels: false,
  };
  await assert.rejects(() => chat(cfg, [{ role: 'user', content: 'hi' }]), (e) => {
    assert.match(e.message, /All 2 configured model\(s\) failed/);
    assert.match(e.message, /primary \(deepseek\/deepseek-chat-v3\.1:free/);
    assert.match(e.message, /fallback #1 \(openai/);
    assert.match(e.message, /429/); // primary's real reason is visible, not just the fallback's
    assert.match(e.message, /402/);
    return true;
  });
  primary.close(); fallback.close();
});

test('primary fails, a scouted fallback succeeds: returns the answer, chain keeps working', async () => {
  const primary = await server(500, {});
  const good = await server(200, { choices: [{ message: { content: 'hello from fallback' } }] });
  const cfg = {
    provider: 'openai-compatible', apiUrl: url(primary), model: 'x', timeoutMs: 3000,
    useScoutedModels: true, scoutedModels: [{ url: url(good), model: 'mock' }],
  };
  const text = await chat(cfg, [{ role: 'user', content: 'hi' }]);
  assert.strictEqual(text, 'hello from fallback');
  primary.close(); good.close();
});

test('useScoutedModels:false means only the explicit chain is tried, never the scouted list', async () => {
  const primary = await server(500, {});
  const scouted = await server(200, { choices: [{ message: { content: 'should never be reached' } }] });
  const cfg = { provider: 'openai-compatible', apiUrl: url(primary), model: 'x', timeoutMs: 3000, useScoutedModels: false, scoutedModels: [{ url: url(scouted), model: 'mock' }] };
  await assert.rejects(() => chat(cfg, [{ role: 'user', content: 'hi' }]));
  primary.close(); scouted.close();
});
