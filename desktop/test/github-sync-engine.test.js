const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let pushLearnedFiles;
test('engine learned-file sync loads without a model', async () => {
  ({ pushLearnedFiles } = await import('../../src/github-sync.js'));
});

test('engine sync pushes only the new skill/tool files to agent-learned', async () => {
  if (!pushLearnedFiles) ({ pushLearnedFiles } = await import('../../src/github-sync.js'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-engine-sync-'));
  fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tools-imported', 'self-authored'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills', 'new-skill.md'), '# new');
  fs.writeFileSync(path.join(root, 'tools-imported', 'self-authored', 'new-tool.js'), 'export const name = "new_tool";');
  const calls = [];
  let branch = false;
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url.includes('/git/ref/heads/agent-learned')) return branch ? { status: 200, ok: true } : { status: 404, ok: false };
    if (url.includes('/git/ref/heads/main')) return { status: 200, ok: true, json: async () => ({ object: { sha: 'main-sha' } }) };
    if (url.endsWith('/git/refs')) { branch = true; return { status: 201, ok: true }; }
    if (url.includes('/contents/') && options.method === 'PUT') return { status: 201, ok: true };
    if (url.includes('/contents/')) return { status: 404, ok: false };
    return { status: 500, ok: false };
  };
  const result = await pushLearnedFiles({ agentDir: root, repo: 'https://github.com/me/repo.git', pat: 'token', fetchImpl, files: ['skills/new-skill.md', 'tools-imported/self-authored/new-tool.js', 'src/index.js'] });
  assert.deepEqual(result.pushed, ['skills/new-skill.md', 'tools-imported/self-authored/new-tool.js']);
  assert.ok(calls.some((x) => x.url.endsWith('/git/refs')));
  assert.ok(!calls.some((x) => x.url.includes('src/index.js')));
});
