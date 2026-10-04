'use strict';
// Proves the RAW CLI subprocess path still works — this is what GitHub Actions actually spawns
// (agent-task.yml: `node src/index.js --yes --once "<task>"`), independent of the desktop app's
// own in-process engine (see embedded-engine.test.js for that). Decoupled from anything under
// desktop/lib/ on purpose: this is a property of the engine's CLI contract itself, not of the
// desktop app's integration with it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const ENTRY = path.join(REPO, 'src', 'index.js');
const haveEngine = fs.existsSync(ENTRY);

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

// Minimal, inline stdin/stdout handling — no dependency on desktop/lib/runner.js or parse.js.
// Approval prompts end with no trailing newline (safety.js uses readline .question), so a
// buffer that matches /\[y\/N\]\s*$/ (or the 3-way app variant) means "waiting for input".
function runCli(args, env, onApprovalPrompt) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [ENTRY, ...args], { cwd: REPO, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '', buf = '';
    child.stdout.on('data', (d) => {
      out += d; buf += d;
      if (onApprovalPrompt && /\[y\/N\]\s*$/.test(buf)) { const b = buf; buf = ''; child.stdin.write(onApprovalPrompt(b) + '\n'); }
    });
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (code) => resolve({ code, out, err }));
  });
}

test('CLI subprocess: a tool call then a final answer reaches stdout correctly', { skip: !haveEngine }, async () => {
  const server = await mockLlm([
    JSON.stringify({ action: 'tool', tool: 'sys_info', args: {}, thought: 'checking the system' }),
    JSON.stringify({ answer: 'Hello from the CLI' }),
  ]);
  const r = await runCli(['--once', 'what system is this?'], {
    MODEL_API_URL: `http://127.0.0.1:${server.address().port}`, MODEL_NAME: 'mock', MODEL_API_KEY: 'x',
    SKILL_SOURCE: 'local', USE_SCOUTED_MODELS: 'false',
  });
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /\[step 1\].*checking the system/);
  assert.match(r.out, /\[tool\] sys_info ->/);
  assert.match(r.out, /Hello from the CLI/);
  server.close();
});

test('CLI subprocess: approval prompt (no trailing newline) — allow lets the write happen', { skip: !haveEngine }, async () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wa-cli-out-')), 'out.txt');
  const server = await mockLlm([
    JSON.stringify({ action: 'tool', tool: 'file_write', args: { path: target, content: 'hi' }, thought: 'write it' }),
    JSON.stringify({ answer: 'written' }),
  ]);
  const r = await runCli(['--once', 'write a file'], {
    MODEL_API_URL: `http://127.0.0.1:${server.address().port}`, MODEL_NAME: 'mock', MODEL_API_KEY: 'x',
    SKILL_SOURCE: 'local', USE_SCOUTED_MODELS: 'false',
  }, () => 'y');
  assert.ok(fs.existsSync(target), 'file must exist after approval');
  assert.match(r.out, /written/);
  server.close();
});

test('CLI subprocess: denying an approval blocks the action', { skip: !haveEngine }, async () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wa-cli-out-')), 'nope.txt');
  const server = await mockLlm([
    JSON.stringify({ action: 'tool', tool: 'file_write', args: { path: target, content: 'hi' } }),
    JSON.stringify({ answer: 'could not write' }),
  ]);
  const r = await runCli(['--once', 'write a file'], {
    MODEL_API_URL: `http://127.0.0.1:${server.address().port}`, MODEL_NAME: 'mock', MODEL_API_KEY: 'x',
    SKILL_SOURCE: 'local', USE_SCOUTED_MODELS: 'false',
  }, () => 'n');
  assert.ok(!fs.existsSync(target), 'file must NOT exist after deny');
  assert.match(r.out, /"ok":false/);
  server.close();
});

test('CLI subprocess: --selftest exits 0 with no network needed', { skip: !haveEngine }, async () => {
  const r = await runCli(['--selftest'], { SKILL_SOURCE: 'local' });
  assert.match(r.out, /SELFTEST/);
});
