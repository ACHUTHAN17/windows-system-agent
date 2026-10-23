'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { submitPending, pendingProposals } = require('../lib/self-improve');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wa-si-'));
function stage(dir, id, patch) {
  const d = path.join(dir, 'self-improvements'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, id + '.json'), JSON.stringify({ targetFile: 'src/llm.js', rationale: 'r', newContent: 'X', createdAt: 't', status: 'pending-review', ...patch }, null, 2));
}

test('pendingProposals only returns pending-review entries with the required fields', () => {
  const dir = tmp();
  stage(dir, 'a', {});
  stage(dir, 'b', { status: 'submitted' });
  fs.writeFileSync(path.join(dir, 'self-improvements', 'broken.json'), '{not json');
  const p = pendingProposals(dir);
  assert.strictEqual(p.length, 1); assert.strictEqual(p[0].file, 'a.json');
});

function fakeGh() {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url, method: (opts && opts.method) || 'GET', body: opts && opts.body });
    if (url.endsWith('/git/ref/heads/main')) return { ok: true, status: 200, json: async () => ({ object: { sha: 'main-sha' } }) };
    if (url.includes('/git/refs')) return { ok: true, status: 201 };
    if (url.includes('/contents/') && (!opts.method || opts.method === 'GET')) return { ok: false, status: 404 };
    if (url.includes('/contents/') && opts.method === 'PUT') return { ok: true, status: 201 };
    if (url.endsWith('/pulls') && opts.method === 'POST') return { ok: true, status: 201, json: async () => ({ html_url: 'https://github.com/me/repo/pull/1' }) };
    return { ok: false, status: 500 };
  };
  f.calls = calls; return f;
}

test('submitPending opens a branch off main + a PR, and never touches main directly', async () => {
  const dir = tmp(); stage(dir, 'a', {});
  const f = fakeGh();
  const r = await submitPending({ agentDir: dir, repo: 'me/repo', pat: 'tok', fetchImpl: f });
  assert.strictEqual(r.errors.length, 0);
  assert.deepStrictEqual(r.opened, [{ file: 'a.json', url: 'https://github.com/me/repo/pull/1' }]);
  assert.ok(!f.calls.some(c => c.method === 'PUT' && JSON.parse(c.body).branch === 'main'), 'never commits to main');
  const pr = f.calls.find(c => c.url.endsWith('/pulls'));
  assert.strictEqual(JSON.parse(pr.body).base, 'main');
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'self-improvements', 'a.json'), 'utf8'));
  assert.strictEqual(saved.status, 'submitted'); assert.strictEqual(saved.prUrl, 'https://github.com/me/repo/pull/1');
});

test('submitPending does not resubmit an already-submitted proposal', async () => {
  const dir = tmp(); stage(dir, 'a', { status: 'submitted' });
  const f = fakeGh();
  const r = await submitPending({ agentDir: dir, repo: 'me/repo', pat: 'tok', fetchImpl: f });
  assert.deepStrictEqual(r.opened, []); assert.strictEqual(f.calls.length, 0);
});

test('submitPending reports (not throws) on a GitHub error for one proposal', async () => {
  const dir = tmp(); stage(dir, 'a', {});
  const f = async (url) => (url.endsWith('/git/ref/heads/main') ? { ok: false, status: 500 } : { ok: false, status: 500 });
  const r = await submitPending({ agentDir: dir, repo: 'me/repo', pat: 'tok', fetchImpl: f });
  assert.strictEqual(r.opened.length, 0); assert.ok(r.errors[0].includes('src/llm.js'));
});

test('submitPending commits a multi-file rewrite atomically to a review branch', async () => {
  const dir = tmp();
  const d = path.join(dir, 'self-improvements'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'rewrite.json'), JSON.stringify({
    kind: 'multi-file-rewrite', files: [{ path: 'src/a.js', newContent: 'export const a = 1;' }, { path: 'desktop/renderer/app.js', newContent: 'console.log("ok");' }],
    rationale: 'r', createdAt: 't', status: 'pending-review', preflight: { syntax: 'passed' },
  }));
  const calls = [];
  const f = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    if (url.endsWith('/git/ref/heads/main')) return { ok: true, status: 200, json: async () => ({ object: { sha: 'main-sha' } }) };
    if (url.endsWith('/git/commits/main-sha')) return { ok: true, status: 200, json: async () => ({ tree: { sha: 'tree-sha' } }) };
    if (url.endsWith('/git/blobs')) return { ok: true, status: 201, json: async () => ({ sha: `blob-${calls.length}` }) };
    if (url.endsWith('/git/trees')) return { ok: true, status: 201, json: async () => ({ sha: 'new-tree' }) };
    if (url.endsWith('/git/commits') && opts.method === 'POST') return { ok: true, status: 201, json: async () => ({ sha: 'new-commit' }) };
    if (url.endsWith('/git/refs')) return { ok: true, status: 201, json: async () => ({}) };
    if (url.endsWith('/pulls')) return { ok: true, status: 201, json: async () => ({ html_url: 'https://github.com/me/repo/pull/2' }) };
    return { ok: false, status: 500, json: async () => ({}) };
  };
  const r = await submitPending({ agentDir: dir, repo: 'me/repo', pat: 'tok', fetchImpl: f });
  assert.deepStrictEqual(r.opened, [{ file: 'rewrite.json', url: 'https://github.com/me/repo/pull/2' }]);
  assert.strictEqual(calls.filter((x) => x.url.endsWith('/git/blobs')).length, 2);
  const ref = calls.find((x) => x.url.endsWith('/git/refs'));
  assert.ok(ref.url.indexOf('/git/refs') > -1);
  assert.ok(calls.findIndex((x) => x.url.endsWith('/git/refs')) > calls.findIndex((x) => x.url.endsWith('/git/commits') && x.method === 'POST'), 'branch is created after the commit exists');
  assert.ok(!calls.some((x) => x.url.includes('/contents/')), 'no sequential partial file writes');
});
