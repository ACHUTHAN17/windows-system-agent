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

test('reasoning-model response (empty content, text in .reasoning) is used instead of failing — the exact Pollinations openai-fast shape', async () => {
  const s = await server(200, {
    id: 'pllns_test',
    choices: [{ index: 0, message: { role: 'assistant', content: '', reasoning: 'The user wants X, so call tool Y.', tool_calls: [{ id: 'x' }] } }],
  });
  const cfg = { provider: 'openai-compatible', apiUrl: url(s), model: 'openai-fast', timeoutMs: 3000, useScoutedModels: false };
  const text = await chat(cfg, [{ role: 'user', content: 'hi' }]);
  assert.strictEqual(text, 'The user wants X, so call tool Y.');
  s.close();
});

test('truly empty response (no content, no reasoning) still fails clearly', async () => {
  const s = await server(200, { choices: [{ message: { role: 'assistant', content: '' } }] });
  const cfg = { provider: 'openai-compatible', apiUrl: url(s), model: 'x', timeoutMs: 3000, useScoutedModels: false };
  await assert.rejects(() => chat(cfg, [{ role: 'user', content: 'hi' }]), /Unexpected LLM response shape/);
  s.close();
});

test('max_tokens is sent explicitly (reasoning models need real budget, not a provider default)', async () => {
  let capturedBody = null;
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; });
    req.on('end', () => {
      capturedBody = JSON.parse(b);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const cfg = { provider: 'openai-compatible', apiUrl: `http://127.0.0.1:${srv.address().port}`, model: 'x', timeoutMs: 3000, useScoutedModels: false };
  await chat(cfg, [{ role: 'user', content: 'hi' }]);
  assert.strictEqual(capturedBody.max_tokens, 4096);

  const cfg2 = { ...cfg, maxTokens: 8192 };
  await chat(cfg2, [{ role: 'user', content: 'hi' }]);
  assert.strictEqual(capturedBody.max_tokens, 8192, 'cfg.maxTokens overrides the default');
  srv.close();
});
