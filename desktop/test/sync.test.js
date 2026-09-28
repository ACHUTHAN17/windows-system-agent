'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { syncFromGitHub, mergeMemory, wanted } = require('../lib/sync');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wa-sync-'));

test('wanted(): allow skills/docs/memory, never tools-imported/.env/runs, src only on opt-in', () => {
  const o = { includeEngine: false, syncMemory: true };
  assert.ok(wanted('skills/docx.md', o)); assert.ok(wanted('docs/models.json', o)); assert.ok(wanted('memory/MEMORY.md', o));
  assert.ok(!wanted('tools-imported/self-authored/evil.js', o)); assert.ok(!wanted('tools-imported/candidates/x.js', o));
  assert.ok(!wanted('src/tools.js', o)); assert.ok(wanted('src/tools.js', { ...o, includeEngine: true }));
  assert.ok(!wanted('memory/MEMORY.md', { ...o, syncMemory: false }));
  assert.ok(!wanted('.env', { ...o, includeEngine: true })); assert.ok(!wanted('runs/x.json', o)); assert.ok(!wanted('skills/../../etc/passwd', o));
  assert.ok(!wanted('desktop/main.js', { ...o, includeEngine: true }));
});

test('mergeMemory keeps local notes and only adds new bullet lines', () => {
  const local = '# Memory\n- likes tea\n- works on WinAgent\n';
  const remote = '# Memory\n- likes tea\n- cloud learned X\n## heading\nprose line\n';
  const m = mergeMemory('memory/MEMORY.md', local, remote);
  assert.ok(m.text.includes('- likes tea') && m.text.includes('- works on WinAgent') && m.text.includes('- cloud learned X'));
  assert.ok(!m.text.includes('prose line')); assert.strictEqual(m.added, 1);
  assert.strictEqual(mergeMemory('memory/MEMORY.md', local, local).added, 0);
  assert.strictEqual(mergeMemory('memory/MEMORY.md', null, remote).text, remote);
  const s = mergeMemory('memory/SELF.md', '- [2026-01-02 10:00] b\n', '- [2026-01-01 10:00] a\n- [2026-01-02 10:00] b\n');
  assert.ok(s.text.indexOf('] a') < s.text.indexOf('] b')); assert.strictEqual(s.added, 1);
});

function fakeFetch(files) {
  const tree = { tree: Object.entries(files).map(([p, c]) => ({ path: p, type: 'blob', size: c.length, sha: 'sha-' + c.length + '-' + c.slice(0, 4) })) };
  const calls = [];
  const f = async (url) => {
    calls.push(url);
    if (url.includes('/git/trees/')) return { ok: true, status: 200, json: async () => tree };
    const rel = decodeURIComponent(url.split('/main/')[1]);
    if (!(rel in files)) return { ok: false, status: 404 };
    return { ok: true, status: 200, arrayBuffer: async () => Buffer.from(files[rel]) };
  };
  f.calls = calls; return f;
}

test('syncFromGitHub downloads only allowed files, merges memory, skips unchanged on 2nd run', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'memory'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'memory', 'MEMORY.md'), '- my local note\n');
  const files = {
    'skills/a.md': '# a', 'skills/b.md': '# b', 'docs/models.json': '{}',
    'memory/MEMORY.md': '- my local note\n- remote note\n',
    'tools-imported/self-authored/evil.js': 'x', 'src/index.js': 'engine', '.env': 'SECRET=1',
  };
  const f = fakeFetch(files);
  const r = await syncFromGitHub({ agentDir: dir, fetchImpl: f });
  assert.strictEqual(r.errors.length, 0); assert.strictEqual(r.skills, 2); assert.strictEqual(r.memoryLinesAdded, 1);
  assert.ok(fs.existsSync(path.join(dir, 'skills', 'a.md')));
  assert.ok(!fs.existsSync(path.join(dir, 'tools-imported'))); assert.ok(!fs.existsSync(path.join(dir, 'src'))); assert.ok(!fs.existsSync(path.join(dir, '.env')));
  const mem = fs.readFileSync(path.join(dir, 'memory', 'MEMORY.md'), 'utf8');
  assert.ok(mem.includes('my local note') && mem.includes('remote note'));
  const before = f.calls.length;
  const r2 = await syncFromGitHub({ agentDir: dir, fetchImpl: f });
  assert.strictEqual(r2.updated, 0); assert.strictEqual(f.calls.length, before + 1); // only the tree call
  const r3 = await syncFromGitHub({ agentDir: dir, fetchImpl: f, includeEngine: true });
  assert.strictEqual(r3.engine, 1); assert.ok(fs.existsSync(path.join(dir, 'src', 'index.js')));
});

test('syncFromGitHub surfaces rate-limit errors clearly', async () => {
  await assert.rejects(() => syncFromGitHub({ agentDir: tmp(), fetchImpl: async () => ({ ok: false, status: 403 }) }), /rate limit/);
});
