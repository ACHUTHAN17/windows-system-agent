'use strict';
// End-to-end: the REAL engine (../../src) driven by the desktop AgentRunner against a mock
// OpenAI-compatible LLM. Proves markers, step/tool parsing, and the approval round-trip.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { AgentRunner } = require('../lib/runner');
const { ensureAgentDir } = require('../lib/agentdir');

const REPO = path.resolve(__dirname, '..', '..');
const haveEngine = fs.existsSync(path.join(REPO, 'src', 'index.js'));

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

async function runTask(replies, text, onApproval) {
  const server = await mockLlm(replies);
  const agentDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wa-e2e-')), 'agent');
  fs.mkdirSync(path.join(agentDir, 'memory'), { recursive: true });
  fs.cpSync(path.join(REPO, 'src'), path.join(agentDir, 'src'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'package.json'), path.join(agentDir, 'package.json'));
  const r = new AgentRunner({ agentDir, execPath: process.execPath });
  const evs = [];
  const done = new Promise(res => r.on('event', (e) => { evs.push(e); if (e.t === 'approval') onApproval(r, e); if (e.t === 'done') res(); }));
  const env = { MODEL_API_URL: `http://127.0.0.1:${server.address().port}/v1`, MODEL_NAME: 'mock', MODEL_API_KEY: 'x', SKILL_SOURCE: 'local', USE_SCOUTED_MODELS: 'false', ELECTRON_RUN_AS_NODE: '' };
  assert.ok(r.run({ text, env }).ok);
  await Promise.race([done, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout; events: ' + JSON.stringify(evs))), 40000))]);
  server.close();
  return { evs, agentDir };
}

test('e2e: tool call then multi-line answer', { skip: !haveEngine }, async () => {
  const { evs } = await runTask([
    JSON.stringify({ action: 'tool', tool: 'sys_info', args: {}, thought: 'check the system' }),
    JSON.stringify({ answer: 'Hello from mock\nsecond line' }),
  ], 'what system is this?', () => {});
  assert.ok(evs.some(e => e.t === 'banner'));
  assert.ok(evs.some(e => e.t === 'step' && /check the system/.test(e.text)));
  const tool = evs.find(e => e.t === 'tool');
  assert.strictEqual(tool.name, 'sys_info'); assert.strictEqual(tool.ok, true);
  assert.strictEqual(evs.find(e => e.t === 'answer').text, 'Hello from mock\nsecond line');
  assert.strictEqual(evs.find(e => e.t === 'done').code, 0);
});

test('e2e: approval prompt is surfaced and honoured (allow -> file written)', { skip: !haveEngine }, async () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wa-out-')), 'out.txt');
  const { evs } = await runTask([
    JSON.stringify({ action: 'tool', tool: 'file_write', args: { path: target, content: 'hi' }, thought: 'write it' }),
    JSON.stringify({ answer: 'written' }),
  ], 'write a file', (r, e) => setTimeout(() => r.approve(e.id, 'once'), 30));
  const ap = evs.find(e => e.t === 'approval');
  assert.ok(ap && /file_write/.test(ap.label), 'approval event with tool name');
  assert.ok(fs.existsSync(target), 'file must exist after approval');
  assert.strictEqual(evs.find(e => e.t === 'answer').text, 'written');
});

test('e2e: denying an approval blocks the action', { skip: !haveEngine }, async () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wa-out-')), 'nope.txt');
  const { evs } = await runTask([
    JSON.stringify({ action: 'tool', tool: 'file_write', args: { path: target, content: 'hi' } }),
    JSON.stringify({ answer: 'could not write' }),
  ], 'write a file', (r, e) => setTimeout(() => r.approve(e.id, 'deny'), 30));
  assert.ok(evs.some(e => e.t === 'approval'));
  assert.ok(!fs.existsSync(target), 'file must NOT exist after deny');
  assert.strictEqual(evs.find(e => e.t === 'tool').ok, false);
});
