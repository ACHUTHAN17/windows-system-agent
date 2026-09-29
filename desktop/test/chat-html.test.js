'use strict';
// Exercises the attachment logic actually shipped in ../../docs/chat.html inside jsdom,
// with a fake File/fetch so no real GitHub calls happen.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function fakeFile(name, content, type) {
  const buf = Buffer.from(content);
  return { name, size: buf.length, type: type || 'text/plain', text: async () => content, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
}

async function load() {
  const file = path.join(__dirname, '..', '..', 'docs', 'chat.html');
  const dom = await JSDOM.fromFile(file, { runScripts: 'dangerously', resources: 'usable', url: 'https://example.com/chat.html' });
  await new Promise(r => setTimeout(r, 100));
  return dom;
}
const tick = () => new Promise(r => setTimeout(r, 20));

test('text attachment is inlined without needing a PAT', async () => {
  const dom = await load(); const w = dom.window; const d = w.document;
  await w.handleFiles([fakeFile('notes.txt', 'hello world')]);
  assert.strictEqual(d.querySelectorAll('#attach .achip').length, 1);
  d.getElementById('doin').value = 'do something';
  const suffix = w.attachmentsSuffix();
  assert.ok(suffix.includes('notes.txt') && suffix.includes('hello world'));
});

test('binary attachment needs a PAT, uploads via Contents API when present, chip removable', async () => {
  const dom = await load(); const w = dom.window; const d = w.document;
  // no PAT yet -> should prompt for it, not upload
  w.localStorage.setItem('wa_pat', ''); w.localStorage.setItem('wa_repo', 'me/repo');
  let putCalled = false;
  w.fetch = async (url, opts) => {
    if (String(url).includes('/contents/') && opts && opts.method === 'PUT') { putCalled = true; return { ok: true, status: 201, json: async () => ({}) }; }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  await w.handleFiles([fakeFile('photo.png', 'binarydata', 'image/png')]);
  assert.strictEqual(putCalled, false, 'no upload without a PAT');
  assert.ok(d.getElementById('cfg').style.display === 'grid', 'settings panel opened to prompt for PAT');

  w.localStorage.setItem('wa_pat', 'ghp_test');
  await w.handleFiles([fakeFile('photo2.png', 'binarydata2', 'image/png')]);
  assert.strictEqual(putCalled, true, 'uploaded once a PAT is present');
  const suffix = w.attachmentsSuffix();
  assert.ok(suffix.includes('photo2.png') && suffix.includes('uploads/'));

  const chips = d.querySelectorAll('#attach .achip');
  const last = chips[chips.length - 1];
  last.querySelector('button').click();
  assert.ok(!w.attachmentsSuffix().includes('photo2.png'), 'removed attachment drops out of the suffix');
});

test('oversized attachment is rejected with a visible error chip and excluded from the task', async () => {
  const dom = await load(); const w = dom.window; const d = w.document;
  const big = fakeFile('huge.bin', 'x');
  big.size = 20 * 1024 * 1024;
  await w.handleFiles([big]);
  const chip = d.querySelector('#attach .achip.err');
  assert.ok(chip && chip.textContent.includes('too large'));
  assert.ok(!w.attachmentsSuffix().includes('huge.bin'));
});
