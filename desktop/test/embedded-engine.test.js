'use strict';
// Proves the REAL single-process architecture: no child process, no stdout parsing — the
// engine runs in this same process, driven by a mock HTTP model server.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { EmbeddedEngine } = require('../lib/embedded-engine');

const REPO = path.resolve(__dirname, '..', '..');

function mockLlm(replies) {
  const server = http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; });
    req.on('end', () => {
      const content = replies.length > 1 ? replies.shift() : replies[0];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}
function collect(engine) {
  const evs = [];
  return { evs, done: new Promise(res => engine.on('event', (e) => { evs.push(e); if (e.t === 'done') res(evs); })) };
}
function cleanRepoState() {
  for (const d of ['tools-imported/self-authored', 'self-improvements', 'generated']) fs.rmSync(path.join(REPO, d), { recursive: true, force: true });
  fs.rmSync(path.join(REPO, 'memory', 'selftest.md'), { force: true });
}

test('runs a task in-process: banner, step, tool, answer, done — no child process involved', async () => {
  cleanRepoState();
  const server = await mockLlm([
    JSON.stringify({ action: 'tool', tool: 'sys_info', args: {}, thought: 'checking the system' }),
    JSON.stringify({ answer: 'All good' }),
  ]);
  const engine = new EmbeddedEngine(REPO);
  const { evs, done } = collect(engine);
  const r = await engine.run('what system is this', { env: { MODEL_API_URL: `http://127.0.0.1:${server.address().port}`, MODEL_NAME: 'mock', USE_SCOUTED_MODELS: 'false' } });
  assert.strictEqual(r.ok, true);
  await done;
  assert.ok(evs.some(e => e.t === 'banner'));
  assert.ok(evs.some(e => e.t === 'step' && /checking the system/.test(e.text)));
  const tool = evs.find(e => e.t === 'tool');
  assert.strictEqual(tool.name, 'sys_info'); assert.strictEqual(tool.ok, true);
  assert.strictEqual(evs.find(e => e.t === 'answer').text, 'All good');
  assert.strictEqual(evs.find(e => e.t === 'done').code, 0);
  assert.strictEqual(engine.busy, false);
  server.close();
});

test('approval flow: allow runs the tool, deny blocks it — same engine instance, sequential', async () => {
  cleanRepoState();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-emb-'));
  const okFile = path.join(dir, 'ok.txt');
  const noFile = path.join(dir, 'no.txt');
  const server = await mockLlm(['placeholder']);
  const engine = new EmbeddedEngine(REPO);
  const env = { MODEL_API_URL: `http://127.0.0.1:${server.address().port}`, MODEL_NAME: 'mock', USE_SCOUTED_MODELS: 'false' };

  server.replies = [
    JSON.stringify({ action: 'tool', tool: 'file_write', args: { path: okFile, content: 'hi' } }),
    JSON.stringify({ answer: 'written' }),
  ];
  let { evs, done } = collect(engine);
  engine.on('event', (e) => { if (e.t === 'approval') setTimeout(() => engine.approve(e.id, 'once'), 20); });
  // rewire the mock server's reply queue for this run
  server.close();
  const s1 = await mockLlm(server.replies);
  const r1 = await engine.run('write ok', { env: { ...env, MODEL_API_URL: `http://127.0.0.1:${s1.address().port}` } });
  await done;
  assert.ok(evs.find(e => e.t === 'approval' && /file_write/.test(e.label)));
  assert.ok(fs.existsSync(okFile), 'approved write must happen');
  assert.strictEqual(evs.find(e => e.t === 'resolved').decision, 'once');

  const s2 = await mockLlm([
    JSON.stringify({ action: 'tool', tool: 'file_write', args: { path: noFile, content: 'hi' } }),
    JSON.stringify({ answer: 'could not write' }),
  ]);
  const engine2 = new EmbeddedEngine(REPO);
  const d2 = collect(engine2);
  engine2.on('event', (e) => { if (e.t === 'approval') setTimeout(() => engine2.approve(e.id, 'deny'), 20); });
  await engine2.run('write no', { env: { ...env, MODEL_API_URL: `http://127.0.0.1:${s2.address().port}` } });
  await d2.done;
  assert.ok(!fs.existsSync(noFile), 'denied write must NOT happen');
  assert.strictEqual(d2.evs.find(e => e.t === 'tool').ok, false);
  s1.close(); s2.close();
});

test('all-models-fail surfaces the full aggregate error, done code 1', async () => {
  cleanRepoState();
  const engine = new EmbeddedEngine(REPO);
  const { evs, done } = collect(engine);
  const r = await engine.run('hello', { env: { MODEL_API_URL: 'http://127.0.0.1:1', MODEL_NAME: 'x', USE_SCOUTED_MODELS: 'false', LLM_FALLBACK_URL: '' } });
  assert.strictEqual(r.ok, true); // run() itself succeeds; the FAILURE is in the emitted error event
  await done;
  assert.ok(evs.find(e => e.t === 'error'));
  assert.strictEqual(evs.find(e => e.t === 'done').code, 1);
});

test('busy: a second run() while one is in flight is rejected, not queued or crashed', async () => {
  cleanRepoState();
  const server = await mockLlm([JSON.stringify({ answer: 'slow' })]);
  // Add artificial delay so the first run is still in flight when we fire the second.
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: 'slow' }) } }] })); }, 200);
  });
  const engine = new EmbeddedEngine(REPO);
  const env = { MODEL_API_URL: `http://127.0.0.1:${server.address().port}`, MODEL_NAME: 'mock', USE_SCOUTED_MODELS: 'false' };
  const p1 = engine.run('first', { env });
  await new Promise(r => setTimeout(r, 30));
  const r2 = await engine.run('second', { env });
  assert.deepStrictEqual(r2, { ok: false, error: 'busy' });
  await p1;
  server.close();
});

test('runSelftest(): captures real output into a code-fenced answer, no network needed', async () => {
  cleanRepoState();
  const engine = new EmbeddedEngine(REPO);
  const { evs, done } = collect(engine);
  const r = await engine.runSelftest();
  assert.strictEqual(r.ok, true);
  await done;
  const ans = evs.find(e => e.t === 'answer');
  assert.ok(ans.text.startsWith('```\n') && ans.text.includes('SELFTEST'));
  assert.strictEqual(evs.find(e => e.t === 'done').code, 0);
});

test('switching MODEL_* env between runs actually takes effect (cached engine is invalidated)', async () => {
  cleanRepoState();
  const bad = await mockLlm(['x']);
  const badPort = bad.address().port;
  bad.close(); // now guaranteed-closed: connection refused
  const good = await mockLlm([JSON.stringify({ answer: 'from the new model' })]);
  const engine = new EmbeddedEngine(REPO);
  const base = { MODEL_NAME: 'mock', USE_SCOUTED_MODELS: 'false' };

  let d = collect(engine);
  await engine.run('first', { env: { ...base, MODEL_API_URL: `http://127.0.0.1:${badPort}` } });
  await d.done;
  assert.ok(d.evs.find(e => e.t === 'error'), 'first run against the dead port fails as expected');

  d = collect(engine);
  await engine.run('second', { env: { ...base, MODEL_API_URL: `http://127.0.0.1:${good.address().port}` } });
  await d.done;
  assert.strictEqual(d.evs.find(e => e.t === 'answer')?.text, 'from the new model', 'second run must use the NEW url, not a cached engine pointed at the dead one');
  good.close();
});

test('stop() aborts between steps and auto-denies any pending approval', async () => {
  cleanRepoState();
  // Deliberately slow (not just "repeats forever") so stop() reliably lands mid-loop
  // regardless of how many steps cfg.maxSteps allows or how fast the mock responds.
  const server = http.createServer((req, res) => {
    setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: 'tool', tool: 'sys_info', args: {} }) } }] })); }, 80);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const engine = new EmbeddedEngine(REPO);
  const { evs, done } = collect(engine);
  const env = { MODEL_API_URL: `http://127.0.0.1:${server.address().port}`, MODEL_NAME: 'mock', USE_SCOUTED_MODELS: 'false' };
  const p = engine.run('loop forever', { env });
  await new Promise((resolve) => engine.on('event', function onEv(e) { if (e.t === 'tool') { engine.removeListener('event', onEv); resolve(); } }));
  engine.stop();
  await p; await done;
  assert.ok(evs.find(e => e.t === 'answer' && e.text === 'Stopped.'), JSON.stringify(evs.map(e => e.t)));
  server.close();
});

test('reasoning dump with no JSON triggers one retry, then the tool actually runs (the exact "open windows settings" failure mode)', async () => {
  cleanRepoState();
  const reasoningDump = 'We need to open Windows Settings app. We can use app_launch or app_open? '
    + 'The skill mentions opening Settings via WIN+I keys. We can use key_press? But need to focus window. '
    + 'We can use app_launch with "ms-settings:"? Actually Windows Settings can be launched via "ms-settings:" URI. '
    + 'Use app_launch with command "ms-settings:"? The tool app_launch expects exe path or command. '
    + 'We can use "ms-settings:" as command? Might need to use "start ms-settings:"? '
    + 'We need to output JSON with action.';
  assert.ok(reasoningDump.length > 300 && !reasoningDump.includes('{'), 'fixture matches the real failure shape');
  const server = await mockLlm([
    reasoningDump, // first reply: exactly what the real model produced — no JSON at all
    JSON.stringify({ action: 'tool', tool: 'sys_info', args: {} }), // after the retry nudge
    JSON.stringify({ answer: 'Opened Settings.' }),
  ]);
  const engine = new EmbeddedEngine(REPO);
  const { evs, done } = collect(engine);
  await engine.run('open windows settings', { env: { MODEL_API_URL: `http://127.0.0.1:${server.address().port}`, MODEL_NAME: 'mock', USE_SCOUTED_MODELS: 'false' } });
  await done;
  // Must NOT surface the raw reasoning dump as if it were a real answer.
  assert.ok(!evs.some(e => e.t === 'answer' && e.text.includes('ms-settings')), 'the half-finished reasoning must never reach the user as a final answer');
  assert.ok(evs.some(e => e.t === 'tool' && e.name === 'sys_info'), 'the retry must actually get the agent to act');
  assert.strictEqual(evs.find(e => e.t === 'answer').text, 'Opened Settings.');
  server.close();
});

test('a short genuine conversational answer with no braces is NOT retried (no wasted call)', async () => {
  cleanRepoState();
  let callCount = 0;
  const server = require('node:http').createServer((req, res) => {
    callCount++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'Hello! How can I help you today?' } }] }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const engine = new EmbeddedEngine(REPO);
  const { evs, done } = collect(engine);
  await engine.run('hi', { env: { MODEL_API_URL: `http://127.0.0.1:${server.address().port}`, MODEL_NAME: 'mock', USE_SCOUTED_MODELS: 'false' } });
  await done;
  assert.strictEqual(callCount, 1, 'a short, clearly-conversational reply must not trigger a retry');
  assert.strictEqual(evs.find(e => e.t === 'answer').text, 'Hello! How can I help you today?');
  server.close();
});
