'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('disk-space report creates and verifies a usable interactive artifact', async () => {
  const { buildTools } = await import('../../src/tools.js');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'winagent-disk-report-'));
  const outPath = path.join(root, 'report.html');
  try {
    await fs.mkdir(path.join(root, 'large'));
    await fs.mkdir(path.join(root, 'small'));
    await fs.writeFile(path.join(root, 'large', 'payload.bin'), Buffer.alloc(20 * 1024));
    await fs.writeFile(path.join(root, 'small', 'payload.bin'), Buffer.alloc(1024));

    const tool = buildTools().find(candidate => candidate.name === 'disk_space_report');
    const report = await tool.run({ root, outPath, maxDepth: 2, maxEntries: 1000 }, { cfg: { allowedRoots: [root], blockedPaths: [] } });
    assert.equal(report.ok, true, report.error);
    assert.equal(report.path, outPath);
    const html = await fs.readFile(outPath, 'utf8');
    assert.match(html, /Disk space report/);
    assert.match(html, /Sort by size/);
    assert.match(html, /large/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
