'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const { detectLocalAction, tryLocalAction } = require('../lib/local-actions');

test('detects known special folders, ignoring filler words and casing', () => {
  for (const [phrase, expectSubstr] of [
    ['open downloads', 'Downloads'], ['Open my Downloads folder', 'Downloads'],
    ['open documents', 'Documents'], ['show me my desktop', 'Desktop'],
    ['launch pictures', 'Pictures'], ['open this pc', os.homedir()],
  ]) {
    const d = detectLocalAction(phrase);
    assert.strictEqual(d.handled, true, phrase);
    assert.strictEqual(d.kind, 'path');
    assert.ok(d.target.includes(expectSubstr) || d.target === expectSubstr, `${phrase} -> ${d.target}`);
  }
});

test('detects known apps and URI-style targets', () => {
  assert.deepStrictEqual(detectLocalAction('open notepad'), { handled: true, label: 'Opened notepad', target: 'notepad', kind: 'app' });
  assert.strictEqual(detectLocalAction('open settings').target, 'uri:ms-settings:');
  assert.strictEqual(detectLocalAction('open settings').kind, 'uri');
  assert.strictEqual(detectLocalAction('start task manager').target, 'taskmgr');
  assert.strictEqual(detectLocalAction('please open chrome').target, 'chrome');
});

test('detects an explicit path (drive-letter, UNC, and ~)', () => {
  assert.strictEqual(detectLocalAction('open C:\\Users\\me\\report.pdf').target, 'C:\\Users\\me\\report.pdf');
  assert.strictEqual(detectLocalAction('open \\\\server\\share\\file.txt').target, '\\\\server\\share\\file.txt');
  assert.strictEqual(detectLocalAction('open ~\\notes.txt').target, path.join(os.homedir(), 'notes.txt'));
});

test('NEVER shortcuts a compound task — falls through to the agent instead', () => {
  const compound = [
    'open the report and summarize it',
    'open downloads and tell me what is taking up space',
    'open notepad and write a poem',
    'open the invoices folder, find the largest file, and delete it',
    'show me what is in my downloads folder',
    'open C:\\Users\\me\\file.txt and read it to me',
  ];
  for (const t of compound) assert.strictEqual(detectLocalAction(t).handled, false, t);
});

test('unknown app/target and long/unrelated messages fall through', () => {
  assert.strictEqual(detectLocalAction('open some-random-app-nobody-heard-of').handled, false);
  assert.strictEqual(detectLocalAction('what is the weather like today').handled, false);
  assert.strictEqual(detectLocalAction('open ' + 'x'.repeat(100)).handled, false);
});

test('tryLocalAction executes nothing on non-Windows (guard), and rejects a path outside allowedRoots', async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  assert.strictEqual(await tryLocalAction({ text: 'open notepad', agentDir: '/tmp' }), null);
  Object.defineProperty(process, 'platform', { value: 'win32' });

  const realAgentDir = path.resolve(__dirname, '..', '..'); // repo root, where src/safety.js actually lives
  const r = await tryLocalAction({ text: 'open C:\\definitely\\not\\allowed\\x.txt', agentDir: realAgentDir, allowedRoots: 'C:\\Users\\me\\Documents' });
  assert.ok(r.error && /outside/.test(r.error), JSON.stringify(r));
  Object.defineProperty(process, 'platform', { value: origPlatform });
});
