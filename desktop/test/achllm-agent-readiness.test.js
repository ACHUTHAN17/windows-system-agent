'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { validateReadOnlyPlan, agentReadinessReport } = require(path.join('..', '..', 'src', 'achllm-agent-readiness.js'));

test('AchLLM agent gate accepts only bounded read-only plans', () => {
  const accepted = validateReadOnlyPlan({ goal: 'Read one licensed reference', steps: [
    { id: 'reference', tool: 'browser_reference', args: { url: 'https://en.wikipedia.org/wiki/Algorithm' } },
  ] });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.executable, false);
  assert.match(validateReadOnlyPlan({ goal: 'install app', steps: [{ id: 'x', tool: 'package_install' }] }).error, /not permitted/);
  assert.match(validateReadOnlyPlan({ goal: 'browse', steps: [{ id: 'x', tool: 'browser_reference', args: { url: 'https://example.com' } }] }).error, /Wikimedia/);
  assert.match(validateReadOnlyPlan({ goal: 'secret', steps: [{ id: 'x', tool: 'system_info', args: { password: 'x' } }] }).error, /credentials/);
  assert.equal(agentReadinessReport().executable, false);
});
