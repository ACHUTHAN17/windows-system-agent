'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');

test('Linux server dashboard stays local, approval-gated, and hardened', () => {
  const service = fs.readFileSync(path.join(root, 'deploy', 'server', 'winagent-dashboard.service'), 'utf8');
  const launcher = fs.readFileSync(path.join(root, 'deploy', 'server', 'winagent.desktop'), 'utf8');
  const guide = fs.readFileSync(path.join(root, 'docs', 'SERVER_AGENT.md'), 'utf8');
  assert.match(service, /src\/index\.js --ui 8080/);
  assert.match(service, /REQUIRE_APPROVAL=true/);
  assert.match(service, /AUTO_YES=false/);
  assert.match(service, /ALLOWED_ROOTS=%h\/winagent/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(service, /ProtectSystem=full/);
  assert.match(service, /Restart=always/);
  assert.match(launcher, /Name=WinAgent/);
  assert.match(launcher, /--app=http:\/\/127\.0\.0\.1:8080/);
  assert.match(guide, /127\.0\.0\.1:8080/);
  assert.match(guide, /no `sudo`/);
});
