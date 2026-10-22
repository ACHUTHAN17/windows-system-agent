'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('local artifacts are created, edited, verified, and served only on loopback', async () => {
  const { buildTools } = await import('../../src/tools.js');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'winagent-artifact-'));
  const output = path.join(root, 'dashboard');
  const cfg = { allowedRoots: [root], blockedPaths: [] };
  try {
    const byName = Object.fromEntries(buildTools().map(tool => [tool.name, tool]));
    const created = await byName.artifact_create.run({ path: output, format: 'html', title: 'Local dashboard', content: '<h1>Initial</h1>', open: false }, { cfg });
    assert.equal(created.ok, true, created.error);
    assert.match(created.path, /dashboard\.html$/i);
    const edited = await byName.artifact_edit.run({ path: created.path, mode: 'replace', oldString: 'Initial', content: 'Updated' }, { cfg });
    assert.equal(edited.ok, true, edited.error);
    const published = await byName.artifact_publish_local.run({ path: created.path, port: 0, open: false }, { cfg });
    assert.equal(published.ok, true, published.error);
    assert.match(published.url, /^http:\/\/127\.0\.0\.1:\d+\//);
    const response = await fetch(published.url);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Updated/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
