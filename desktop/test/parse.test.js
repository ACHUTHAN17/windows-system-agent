'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseLine, detectPrompt } = require('../lib/parse');
const MD = require('../renderer/markdown.js');

test('parseLine recognises steps, tools, notes, banner', () => {
  assert.deepStrictEqual(parseLine('  [step 2] look at the folder'), { kind: 'step', n: 2, text: 'look at the folder' });
  const t = parseLine('  [tool] file_list -> {"ok":true,"entries":[]}');
  assert.strictEqual(t.kind, 'tool'); assert.strictEqual(t.name, 'file_list'); assert.strictEqual(t.ok, true);
  assert.strictEqual(parseLine('  [tool] file_write -> {"ok":false,"error":"x"}').ok, false);
  assert.strictEqual(parseLine('  [skill] docx <- github (live)').kind, 'note');
  assert.strictEqual(parseLine('  [self-tool] ping <- tools-imported/self-authored (loaded)').kind, 'note');
  assert.strictEqual(parseLine('WinAgent — llama3.1 [x] @ http://localhost').kind, 'banner');
  assert.strictEqual(parseLine('just some text').kind, 'log');
});

test('detectPrompt handles tool and app approvals, ignores normal text', () => {
  const a = detectPrompt('Allow file_delete path=C:\\tmp\\x? [y/N] ');
  assert.strictEqual(a.kind, 'tool'); assert.deepStrictEqual(a.options, ['once', 'deny']); assert.match(a.label, /file_delete/);
  const b = detectPrompt('Allow agent to control app "notepad.exe"? [y=once / a=always / N] ');
  assert.strictEqual(b.kind, 'app'); assert.deepStrictEqual(b.options, ['once', 'always', 'deny']);
  assert.strictEqual(detectPrompt('  [step 1] thinking'), null);
});

test('markdown escapes HTML and only links https', () => {
  const h = MD.render('<img src=x onerror=alert(1)> **b** [ok](https://a.com) [bad](javascript:alert(1)) http://plain.com');
  assert.ok(!h.includes('<img'));
  assert.ok(h.includes('data-href="https://a.com"'));
  assert.ok(!h.includes('data-href="javascript'));
  assert.ok(!h.includes('data-href="http://'));
  assert.ok(h.includes('<strong>b</strong>'));
});
