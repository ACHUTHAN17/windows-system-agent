'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { attachFromPaths, copyFileIntoUploads, saveBufferIntoUploads, MAX_FILES } = require('../lib/attachments');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wa-att-'));
function makeFile(dir, name, content) { const p = path.join(dir, name); fs.writeFileSync(p, content); return p; }

test('copyFileIntoUploads: text file gets a preview, binary does not, both land under uploads/', () => {
  const src = tmp(); const agentDir = tmp();
  const txt = makeFile(src, 'notes.txt', 'hello world');
  const r1 = copyFileIntoUploads(agentDir, txt);
  assert.strictEqual(r1.preview, 'hello world'); assert.strictEqual(r1.isImage, false);
  assert.ok(r1.path.startsWith('uploads/'));
  assert.ok(fs.existsSync(path.join(agentDir, r1.path)));

  const img = makeFile(src, 'pic.png', Buffer.from([1, 2, 3, 4]));
  const r2 = copyFileIntoUploads(agentDir, img);
  assert.strictEqual(r2.isImage, true); assert.strictEqual(r2.preview, '');
});

test('copyFileIntoUploads rejects oversized files without touching disk', () => {
  const src = tmp(); const agentDir = tmp();
  const big = path.join(src, 'huge.bin');
  fs.writeFileSync(big, Buffer.alloc(1024)); // real size check uses fs.statSync, so fake a big stat via a sparse approach
  const origStat = fs.statSync;
  const fsSpy = require('node:fs');
  const realStatSync = fsSpy.statSync;
  fsSpy.statSync = (p) => (p === big ? { size: 30 * 1024 * 1024 } : realStatSync(p));
  try {
    const r = copyFileIntoUploads(agentDir, big);
    assert.ok(r.error && /too large/.test(r.error));
    assert.ok(!fs.existsSync(path.join(agentDir, 'uploads')) || fs.readdirSync(path.join(agentDir, 'uploads')).length === 0);
  } finally { fsSpy.statSync = realStatSync; }
});

test('attachFromPaths caps at MAX_FILES and preserves order', () => {
  const src = tmp(); const agentDir = tmp();
  const files = Array.from({ length: MAX_FILES + 5 }, (_, i) => makeFile(src, `f${i}.txt`, String(i)));
  const out = attachFromPaths(agentDir, files);
  assert.strictEqual(out.length, MAX_FILES);
  assert.strictEqual(out[0].name, 'f0.txt');
});

test('attachFromPaths reports a missing file as an error instead of throwing', () => {
  const agentDir = tmp();
  const out = attachFromPaths(agentDir, ['/does/not/exist.txt']);
  assert.strictEqual(out.length, 1); assert.ok(out[0].error);
});

test('saveBufferIntoUploads: pasted image is written and described correctly, oversized is rejected', () => {
  const agentDir = tmp();
  const r = saveBufferIntoUploads(agentDir, 'screenshot.png', Buffer.from([9, 9, 9]));
  assert.strictEqual(r.isImage, true); assert.ok(fs.existsSync(path.join(agentDir, r.path)));
  const big = saveBufferIntoUploads(agentDir, 'big.png', Buffer.alloc(26 * 1024 * 1024));
  assert.ok(big.error && /too large/.test(big.error));
});

test('two attachments with the same original name never collide on disk', () => {
  const src = tmp(); const agentDir = tmp();
  const a = makeFile(src, 'same.txt', 'A');
  fs.mkdirSync(path.join(src, 'sub'));
  const b = makeFile(path.join(src, 'sub'), 'same.txt', 'B');
  const [ra, rb] = attachFromPaths(agentDir, [a, b]);
  assert.notStrictEqual(ra.path, rb.path);
  assert.strictEqual(fs.readFileSync(path.join(agentDir, ra.path), 'utf8'), 'A');
  assert.strictEqual(fs.readFileSync(path.join(agentDir, rb.path), 'utf8'), 'B');
});
