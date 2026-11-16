'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const pkg = require(path.join(__dirname, '..', 'package.json'));

test('release configuration builds both macOS architectures and pins the security-remediated build chain', () => {
  assert.match(pkg.scripts['dist:mac'], /--x64/);
  assert.match(pkg.scripts['dist:mac'], /--arm64/);
  assert.equal(pkg.devDependencies.electron, '^45.3.3');
  assert.equal(pkg.devDependencies['electron-builder'], '^26.18.0');
  assert.equal(pkg.overrides.minimatch, '11.0.1');
});
