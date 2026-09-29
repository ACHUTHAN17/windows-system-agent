'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ensureAgentDir } = require('../lib/agentdir');
const { Settings } = require('../lib/settings');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wa-dir-'));
function bundle() {
  const b = tmp();
  for (const [p, c] of Object.entries({ 'src/index.js': 'v1', 'package.json': '{"type":"module"}', 'skills/a.md': 'A1', 'memory/MEMORY.md': '- seed', 'docs/chat.html': 'x' })) {
    fs.mkdirSync(path.dirname(path.join(b, p)), { recursive: true }); fs.writeFileSync(path.join(b, p), c);
  }
  return b;
}

test('ensureAgentDir seeds, refreshes engine on version change, never clobbers user data', () => {
  const b = bundle(), a = path.join(tmp(), 'agent');
  assert.ok(ensureAgentDir({ bundleDir: b, agentDir: a, version: '1.0.0' }).refreshed);
  assert.strictEqual(fs.readFileSync(path.join(a, 'src/index.js'), 'utf8'), 'v1');
  fs.writeFileSync(path.join(a, 'memory/MEMORY.md'), '- user note'); fs.writeFileSync(path.join(a, 'skills/a.md'), 'SYNCED'); fs.writeFileSync(path.join(a, '.env'), 'K=1');
  assert.ok(!ensureAgentDir({ bundleDir: b, agentDir: a, version: '1.0.0' }).refreshed);
  fs.writeFileSync(path.join(b, 'src/index.js'), 'v2'); fs.writeFileSync(path.join(b, 'skills/new.md'), 'NEW');
  assert.ok(ensureAgentDir({ bundleDir: b, agentDir: a, version: '1.1.0' }).refreshed);
  assert.strictEqual(fs.readFileSync(path.join(a, 'src/index.js'), 'utf8'), 'v2');
  assert.strictEqual(fs.readFileSync(path.join(a, 'memory/MEMORY.md'), 'utf8'), '- user note');
  assert.strictEqual(fs.readFileSync(path.join(a, 'skills/a.md'), 'utf8'), 'SYNCED');
  assert.strictEqual(fs.readFileSync(path.join(a, 'skills/new.md'), 'utf8'), 'NEW');
  assert.strictEqual(fs.readFileSync(path.join(a, '.env'), 'utf8'), 'K=1');
});

const fakeSS = { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from('enc:' + s), decryptString: (b) => b.toString().slice(4) };

test('Settings: free preset sends no model env; key is encrypted at rest and only reaches the child env', () => {
  const dir = tmp(); const s = new Settings(dir, fakeSS);
  assert.deepStrictEqual(s.agentEnv(), {});
  s.update({ preset: 'openai', provider: 'openai-compatible', apiUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: 'sk-secret', allowedRoots: 'C:\\Docs' });
  const disk = fs.readFileSync(path.join(dir, 'settings.json'), 'utf8');
  assert.ok(!disk.includes('sk-secret')); assert.ok(!JSON.stringify(s.publicView()).includes('sk-secret')); assert.strictEqual(s.publicView().hasKey, true);
  assert.deepStrictEqual(s.agentEnv(), { MODEL_PROVIDER: 'openai-compatible', MODEL_API_URL: 'https://api.openai.com/v1', MODEL_NAME: 'gpt-4o-mini', MODEL_API_KEY: 'sk-secret', ALLOWED_ROOTS: 'C:\\Docs' });
  s.update({ apiKey: '' }); assert.strictEqual(s.agentEnv().MODEL_API_KEY, 'sk-secret');
  s.update({ apiKey: null }); assert.strictEqual(s.agentEnv().MODEL_API_KEY, undefined);
  assert.strictEqual(new Settings(dir, fakeSS).data.model, 'gpt-4o-mini');
});

test('Settings: GitHub PAT is stored/encrypted separately from the model key and never in publicView', () => {
  const dir = tmp(); const s = new Settings(dir, fakeSS);
  assert.strictEqual(s.githubPat(), '');
  s.update({ apiKey: 'sk-model', githubPat: 'ghp_secret', githubRepo: 'me/repo', autoPushLearned: true });
  assert.strictEqual(s.githubPat(), 'ghp_secret');
  assert.strictEqual(s._key(), 'sk-model');
  const view = s.publicView();
  assert.ok(!JSON.stringify(view).includes('ghp_secret')); assert.ok(!JSON.stringify(view).includes('sk-model'));
  assert.strictEqual(view.hasGithubPat, true); assert.strictEqual(view.githubRepo, 'me/repo'); assert.strictEqual(view.autoPushLearned, true);
  s.update({ githubPat: null });
  assert.strictEqual(s.githubPat(), ''); assert.strictEqual(s.publicView().hasGithubPat, false);
});
