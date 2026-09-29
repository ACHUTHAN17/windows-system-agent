'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pushLearned, listCandidates, isAllowed } = require('../lib/github-push');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wa-push-'));

test('isAllowed only permits skills/*.md, self-authored tools, and SELF.md', () => {
  assert.ok(isAllowed('skills/docx.md'));
  assert.ok(isAllowed('tools-imported/self-authored/ping.js'));
  assert.ok(isAllowed('memory/SELF.md'));
  assert.ok(!isAllowed('src/tools.js'));
  assert.ok(!isAllowed('tools-imported/candidates/evil.js'));
  assert.ok(!isAllowed('.env'));
  assert.ok(!isAllowed('memory/other.md'));
});

test('listCandidates finds exactly the allow-listed files that exist', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tools-imported', 'self-authored'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'memory'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skills', 'a.md'), 'A');
  fs.writeFileSync(path.join(dir, 'tools-imported', 'self-authored', 'x.js'), 'X');
  fs.writeFileSync(path.join(dir, 'memory', 'SELF.md'), 'S');
  const c = listCandidates(dir).sort();
  assert.deepStrictEqual(c, ['memory/SELF.md', 'skills/a.md', 'tools-imported/self-authored/x.js']);
});

function fakeGh(state = {}) {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url, method: (opts && opts.method) || 'GET' });
    if (url.includes('/git/ref/heads/agent-learned')) return state.branchExists ? { status: 200, ok: true } : { status: 404, ok: false };
    if (url.includes('/git/ref/heads/main')) return { ok: true, status: 200, json: async () => ({ object: { sha: 'main-sha' } }) };
    if (url.includes('/git/refs') && opts.method === 'POST') { state.branchExists = true; return { ok: true, status: 201 }; }
    if (url.includes('/contents/') && (!opts || !opts.method || opts.method === 'GET')) {
      const rel = decodeURIComponent(url.split('/contents/')[1].split('?')[0]);
      return state.files && state.files[rel] ? { status: 200, ok: true, json: async () => ({ sha: 'sha-' + rel }) } : { status: 404, ok: false };
    }
    if (url.includes('/contents/') && opts.method === 'PUT') {
      const rel = decodeURIComponent(url.split('/contents/')[1]);
      state.files = state.files || {}; state.files[rel] = true;
      return { ok: true, status: 201 };
    }
    return { ok: false, status: 500 };
  };
  f.calls = calls; return f;
}

test('pushLearned creates the branch once, pushes only allow-listed changed files, and is idempotent', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'skills'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skills', 'a.md'), 'content A');
  const state = {};
  const f = fakeGh(state);
  const r1 = await pushLearned({ agentDir: dir, repo: 'me/repo', pat: 'tok', fetchImpl: f, candidates: ['skills/a.md', 'src/tools.js'] });
  assert.deepStrictEqual(r1.pushed, ['skills/a.md']);
  assert.strictEqual(r1.errors.length, 0);
  assert.ok(f.calls.some(c => c.url.includes('/git/refs') && c.method === 'POST'), 'branch created');

  const r2 = await pushLearned({ agentDir: dir, repo: 'me/repo', pat: 'tok', fetchImpl: f, candidates: ['skills/a.md'] });
  assert.deepStrictEqual(r2.pushed, []); assert.strictEqual(r2.skipped, 1);
  const before = f.calls.length;
  const branchCreateCalls = f.calls.filter(c => c.url.includes('/git/refs') && c.method === 'POST').length;
  assert.strictEqual(branchCreateCalls, 1, 'branch is only created once across calls');

  fs.writeFileSync(path.join(dir, 'skills', 'a.md'), 'content A changed');
  const r3 = await pushLearned({ agentDir: dir, repo: 'me/repo', pat: 'tok', fetchImpl: f, candidates: ['skills/a.md'] });
  assert.deepStrictEqual(r3.pushed, ['skills/a.md'], 'changed content is re-pushed');
  assert.ok(f.calls.length > before);
});

test('pushLearned reports missing config instead of throwing', async () => {
  const r = await pushLearned({ agentDir: tmp(), repo: '', pat: '', candidates: ['skills/a.md'] });
  assert.strictEqual(r.pushed.length, 0); assert.ok(r.errors.length);
});
