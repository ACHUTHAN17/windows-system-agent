const test = require('node:test');
const assert = require('node:assert/strict');

let offlinePlan;
let hasConfiguredModel;
test('load offline modules', async () => {
  ({ offlinePlan } = await import('../../src/offline.js'));
  ({ hasConfiguredModel } = await import('../../src/llm.js'));
});

const cfg = { root: 'C:/agent' };

test('offline planner handles local actions without a model', async () => {
  if (!offlinePlan) ({ offlinePlan } = await import('../../src/offline.js'));
  assert.equal(offlinePlan('list files in Documents', cfg).steps[0].tool, 'file_list');
  assert.equal(offlinePlan('read file README.md', cfg).steps[0].tool, 'file_read');
  assert.equal(offlinePlan('open notepad', cfg).steps[0].tool, 'app_launch');
  assert.equal(offlinePlan('show system info', cfg).steps[0].tool, 'sys_info');
  assert.equal(offlinePlan('install vscode', cfg).steps[0].tool, 'package_install');
});

test('offline planner leaves ambiguous work for the optional model loop', async () => {
  if (!offlinePlan) ({ offlinePlan } = await import('../../src/offline.js'));
  assert.equal(offlinePlan('summarize my entire project and improve it', cfg), null);
});

test('model configuration is opt-in', async () => {
  if (!hasConfiguredModel) ({ hasConfiguredModel } = await import('../../src/llm.js'));
  assert.equal(hasConfiguredModel({ provider: 'none', apiUrl: '', model: '' }), false);
  assert.equal(hasConfiguredModel({ provider: 'openai-compatible', apiUrl: '', model: '' }), false);
  assert.equal(hasConfiguredModel({ provider: 'openai-compatible', apiUrl: 'http://localhost:11434/v1', model: 'llama3.1' }), true);
  assert.equal(hasConfiguredModel({ provider: 'anthropic', apiUrl: 'https://api.anthropic.com', model: 'claude', apiKey: '' }), false);
});
