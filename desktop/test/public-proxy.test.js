'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { authorized, configFromEnvironment, createPublicProxy, hashPassword, verifyPassword } = require(path.join(__dirname, '..', '..', 'deploy', 'seed-lm', 'public-proxy.cjs'));

const password = 'a secure test password';
const passwordHash = hashPassword(password, Buffer.alloc(16, 7));
const auth = (value = password) => `Basic ${Buffer.from(`owner:${value}`).toString('base64')}`;

test('public proxy requires a hashed gateway credential and verifies it safely', () => {
  assert.ok(verifyPassword(password, passwordHash));
  assert.equal(verifyPassword('wrong password', passwordHash), false);
  assert.ok(authorized(auth(), 'owner', passwordHash));
  assert.equal(authorized(auth('wrong password'), 'owner', passwordHash), false);
  assert.equal(authorized(auth(), 'not-owner', passwordHash), false);
  assert.throws(() => configFromEnvironment({ WINAGENT_PROXY_USER: 'owner' }), /PASSWORD_HASH/);
  assert.throws(() => configFromEnvironment({ WINAGENT_PROXY_USER: 'bad user', WINAGENT_PROXY_PASSWORD_HASH: passwordHash }), /username/);
});

test('public proxy exposes only documented model routes and rejects oversized streamed bodies', async () => {
  const server = createPublicProxy({ user: 'owner', passwordHash, allowedOrigin: 'https://achuthan17.github.io' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); const base = `http://127.0.0.1:${address.port}`;
  try {
    let response = await fetch(`${base}/v1/system/shutdown`, { headers: { Authorization: auth() } });
    assert.equal(response.status, 404);
    response = await fetch(`${base}/v1/models`, { method: 'POST', headers: { Authorization: auth() } });
    assert.equal(response.status, 404);
    response = await fetch(`${base}/v1/chat/completions`, { method: 'POST', headers: { Authorization: auth(), 'Content-Type': 'application/json' }, body: 'x'.repeat(65_537) });
    assert.equal(response.status, 413);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('public gateway service applies the restrictive sandbox while retaining network support', () => {
  const unit = fs.readFileSync(path.join(__dirname, '..', '..', 'deploy', 'seed-lm', 'winagent-public-proxy.service'), 'utf8');
  for (const setting of ['ConditionPathExists=', 'ProtectSystem=strict', 'ProtectHome=read-only', 'PrivateDevices=true', 'ProtectKernelModules=true', 'RestrictNamespaces=true', 'RemoveIPC=true', 'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6', 'CapabilityBoundingSet=']) assert.ok(unit.includes(setting), `missing ${setting}`);
});
