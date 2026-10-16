'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ChatSync, BRANCH } = require('../lib/chat-sync');

function fakeGh() {
  const calls = [];
  let branch = false;
  let content = '';
  let sha = '';
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url.includes('/git/ref/heads/' + BRANCH)) return branch ? { status: 200, ok: true } : { status: 404, ok: false };
    if (url.endsWith('/git/ref/heads/main')) return { status: 200, ok: true, json: async () => ({ object: { sha: 'main' } }) };
    if (url.endsWith('/git/refs')) { branch = true; return { status: 201, ok: true }; }
    if (url.includes('/contents/') && options.method === 'PUT') { content = Buffer.from(JSON.parse(options.body).content, 'base64').toString(); sha = 'next'; return { status: 200, ok: true }; }
    if (url.includes('/contents/') && content) return { status: 200, ok: true, json: async () => ({ sha, content: Buffer.from(content).toString('base64') }) };
    return { status: 404, ok: false };
  };
  return { fetchImpl, calls, get content() { return content; } };
}

test('ChatSync checkpoints a chat on the agent-chats branch', async () => {
  const fake = fakeGh();
  const statuses = [];
  const sync = new ChatSync({ repo: 'https://github.com/me/repo.git', pat: 'token', fetchImpl: fake.fetchImpl, onStatus: (s) => statuses.push(s) });
  sync.start('chat/1', 'open settings', []);
  sync.record({ t: 'tool', name: 'app_open', ok: true });
  await sync.flush();
  await sync.finish({ status: 'completed' });
  assert.ok(fake.content.includes('chat_start'));
  assert.ok(fake.content.includes('app_open'));
  assert.ok(fake.content.includes('chat_finish'));
  assert.ok(fake.calls.some((c) => c.url.includes('/git/refs')));
  assert.ok(statuses.every((s) => s.ok));
});
