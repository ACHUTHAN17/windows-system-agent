import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { localToolCall, routeText } from '../../src/router.js';
import { buildTools } from '../../src/tools.js';

test('router sends a simple Windows Settings request to the local path', () => {
  const r = routeText('open system settings');
  assert.equal(r.kind, 'local');
  assert.equal(r.confidence, 'high');
  assert.deepEqual(localToolCall(r), { tool: 'app_open', args: { target: 'ms-settings:' } });
});

test('router sends a compound request to the agent instead of shortcutting it', () => {
  assert.equal(routeText('open Downloads and tell me what is taking space').kind, 'agent');
});

test('router recognizes image generation as a first-class capability', () => {
  const r = routeText('create an image of a glass robot in a rainy neon city');
  assert.equal(r.kind, 'image');
  assert.match(r.prompt, /glass robot/i);
});

test('router falls back for normal knowledge and multi-step work', () => {
  assert.equal(routeText('summarize my Documents folder').kind, 'agent');
  assert.equal(routeText('what is the weather today?').kind, 'agent');
});

test('image_generate uses the current authenticated Pollinations image endpoint', async () => {
  const oldFetch = globalThis.fetch;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-image-'));
  let seen = null;
  globalThis.fetch = async (url, opts) => {
    seen = { url: String(url), opts };
    return { ok: true, arrayBuffer: async () => Buffer.alloc(600, 7) };
  };
  try {
    const tool = buildTools().find(t => t.name === 'image_generate');
    const result = await tool.run({ prompt: 'a glass robot' }, { cfg: { root, imageApiKey: 'pk_test' } });
    assert.equal(result.ok, true);
    assert.match(seen.url, /^https:\/\/gen\.pollinations\.ai\/image\//);
    assert.equal(seen.opts.headers.Authorization, 'Bearer pk_test');
    assert.ok(fs.existsSync(path.join(root, result.path)));
  } finally {
    globalThis.fetch = oldFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
