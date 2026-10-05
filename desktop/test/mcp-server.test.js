'use strict';
// Spawns the REAL src/mcp-server.js as a subprocess and speaks real MCP JSON-RPC to it —
// proves the protocol handshake, tool listing/calling, and (critically) that routine engine
// startup chatter never leaks onto stdout and corrupts the JSON-RPC stream.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const ENTRY = path.join(REPO, 'src', 'mcp-server.js');
const haveEngine = fs.existsSync(ENTRY);

function startServer(env) {
  const child = spawn(process.execPath, [ENTRY], { cwd: REPO, env: { ...process.env, SKILL_SOURCE: 'local', ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = []; // every parsed stdout line — used to assert NONE of them fail JSON.parse
  const rawStdoutLines = [];
  let buf = '';
  const waiters = new Map();
  child.stdout.on('data', (d) => {
    buf += String(d);
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      rawStdoutLines.push(line);
      const msg = JSON.parse(line); // throws (failing the test) if the protocol stream is corrupted
      lines.push(msg);
      if (msg.id !== undefined && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id); }
    }
  });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  let nextId = 1;
  function rpc(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      waiters.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      // Generous on purpose: this file spawns a real subprocess per test, and when the whole
      // desktop suite runs its test FILES in parallel (node's default), several subprocess-
      // heavy files starting at once can push a single engine startup well past what it takes
      // in isolation. This is scheduling noise, not a protocol concern — tighten it back down
      // if these ever run serially.
      setTimeout(() => { if (waiters.has(id)) { waiters.delete(id); reject(new Error('rpc timeout: ' + method)); } }, 45000);
    });
  }
  function notify(method, params) { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); }
  async function init() {
    const r = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    notify('notifications/initialized', {});
    return r;
  }
  return { child, rpc, notify, init, lines, rawStdoutLines, stderrText: () => stderr, writeRaw: (s) => child.stdin.write(s), stop: () => child.kill() };
}

test('initialize handshake returns correct protocol version and server info', { skip: !haveEngine }, async () => {
  const s = startServer();
  const r = await s.init();
  assert.strictEqual(r.protocolVersion, '2024-11-05');
  assert.strictEqual(r.serverInfo.name, 'winagent');
  assert.ok(r.capabilities.tools);
  s.stop();
});

test('tools/list exposes real tools with proper JSON Schema and correct destructive annotations', { skip: !haveEngine }, async () => {
  const s = startServer();
  await s.init();
  const { tools } = await s.rpc('tools/list', {});
  assert.ok(Array.isArray(tools) && tools.length > 10);
  const sysInfo = tools.find(t => t.name === 'sys_info');
  assert.ok(sysInfo); assert.strictEqual(sysInfo.annotations.destructiveHint, false); assert.strictEqual(sysInfo.annotations.readOnlyHint, true);
  const write = tools.find(t => t.name === 'file_write');
  assert.ok(write); assert.strictEqual(write.annotations.destructiveHint, true); assert.strictEqual(write.annotations.readOnlyHint, false);
  assert.strictEqual(write.inputSchema.type, 'object');
  assert.ok(write.inputSchema.properties.path, 'path arg present in the generated schema');
  s.stop();
});

test('tools/call on a read-only tool succeeds with no approval gate needed', { skip: !haveEngine }, async () => {
  const s = startServer();
  await s.init();
  const r = await s.rpc('tools/call', { name: 'sys_info', arguments: {} });
  assert.strictEqual(r.isError, false);
  const parsed = JSON.parse(r.content[0].text);
  assert.strictEqual(parsed.ok, true);
  assert.ok(parsed.hostname);
  s.stop();
});

test('destructive tool is auto-denied by default (MCP_AUTO_YES unset) — no stdin prompt, clean error', { skip: !haveEngine }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-mcp-'));
  const target = path.join(dir, 'should-not-exist.txt');
  const s = startServer();
  await s.init();
  const r = await s.rpc('tools/call', { name: 'file_write', arguments: { path: target, content: 'x' } });
  assert.strictEqual(r.isError, true);
  assert.ok(!fs.existsSync(target), 'must NOT write without MCP_AUTO_YES');
  const parsed = JSON.parse(r.content[0].text);
  assert.strictEqual(parsed.ok, false);
  assert.match(parsed.error, /denied/i);
  s.stop();
});

test('destructive tool succeeds when MCP_AUTO_YES=true (explicit opt-in)', { skip: !haveEngine }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-mcp-'));
  const target = path.join(dir, 'should-exist.txt');
  const s = startServer({ MCP_AUTO_YES: 'true' });
  await s.init();
  const r = await s.rpc('tools/call', { name: 'file_write', arguments: { path: target, content: 'hello' } });
  assert.strictEqual(r.isError, false);
  assert.ok(fs.existsSync(target));
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'hello');
  s.stop();
});

test('unknown method returns a proper JSON-RPC error, server stays alive', { skip: !haveEngine }, async () => {
  const s = startServer();
  await s.init();
  await assert.rejects(() => s.rpc('totally/bogus', {}), /method not found/);
  const r2 = await s.rpc('tools/call', { name: 'sys_info', arguments: {} }); // still responsive after
  assert.strictEqual(r2.isError, false);
  s.stop();
});

test('unknown tool name is a clean tool-result error, not a protocol error', { skip: !haveEngine }, async () => {
  const s = startServer();
  await s.init();
  const r = await s.rpc('tools/call', { name: 'not_a_real_tool', arguments: {} });
  assert.strictEqual(r.isError, true);
  assert.match(r.content[0].text, /unknown tool/);
  s.stop();
});

test('a malformed line on stdin is ignored, never crashes the server', { skip: !haveEngine }, async () => {
  const s = startServer();
  await s.init();
  s.writeRaw('{not valid json at all\n');
  const r = await s.rpc('tools/call', { name: 'sys_info', arguments: {} }); // still responsive
  assert.strictEqual(r.isError, false);
  s.stop();
});

test('CRITICAL: every single stdout line is valid JSON — engine startup chatter never corrupts the protocol', { skip: !haveEngine }, async () => {
  const s = startServer();
  await s.init();
  await s.rpc('tools/list', {});
  await s.rpc('tools/call', { name: 'sys_info', arguments: {} });
  // The parsing happens inline as data arrives (see startServer) and would already have
  // thrown by now if any line were not valid JSON. This assertion just documents the
  // property and confirms we actually exercised multiple lines.
  assert.ok(s.rawStdoutLines.length >= 3, `expected several JSON-RPC lines, got ${s.rawStdoutLines.length}`);
  for (const line of s.rawStdoutLines) assert.doesNotThrow(() => JSON.parse(line), `non-JSON on stdout: ${line.slice(0, 200)}`);
  s.stop();
});
