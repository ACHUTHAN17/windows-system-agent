const test = require('node:test');
const assert = require('node:assert/strict');

let offlinePlan;
let latestRequest;
let hasConfiguredModel;
test('load offline modules', async () => {
  ({ offlinePlan, latestRequest } = await import('../../src/offline.js'));
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

test('offline routing ignores earlier conversation context', async () => {
  if (!offlinePlan || !latestRequest) ({ offlinePlan, latestRequest } = await import('../../src/offline.js'));
  const task = 'create a new folder on desktop named "testt"\n\n[Earlier in this conversation (context only — do not repeat or re-run it):\nUser: change to light theme and open a new tab on edge on that login to netflix\n]';
  assert.equal(latestRequest(task), 'create a new folder on desktop named "testt"');
  assert.equal(offlinePlan(task, cfg).steps[0].tool, 'file_mkdir');
  assert.match(offlinePlan(task, cfg).steps[0].args.path, /Desktop[\\/]testt$/i);
  assert.equal(offlinePlan('hey write a python program to print hello world', cfg).steps[0].tool, 'file_write');
  assert.match(offlinePlan('hey write a python program to print hello world', cfg).steps[0].args.content, /hello world/);
});

test('offline planner executes known compound desktop tasks without a model', async () => {
  if (!offlinePlan) ({ offlinePlan } = await import('../../src/offline.js'));
  const plan = offlinePlan('change to light theme and open a new tab on edge on that login to netflix', cfg);
  assert.deepEqual(plan.steps.map(step => step.tool), ['theme_set', 'browser_open']);
  assert.deepEqual(plan.steps[0].args, { mode: 'light' });
  assert.deepEqual(plan.steps[1].args, { browser: 'edge', url: 'https://www.netflix.com/login' });
});

test('offline planner composes ordinary local action sequences', async () => {
  if (!offlinePlan) ({ offlinePlan } = await import('../../src/offline.js'));
  assert.deepEqual(offlinePlan('install vscode and open settings', cfg).steps.map(step => step.tool), ['package_install', 'app_open']);
  assert.deepEqual(offlinePlan('drag from 100,200 to 500,600', cfg).steps[0], {
    tool: 'screen_drag', args: { x1: 100, y1: 200, x2: 500, y2: 600 }, label: 'Dragged from 100,200 to 500,600',
  });
  assert.deepEqual(offlinePlan('press Ctrl+Shift+S', cfg).steps[0].args, { key: 'S', modifiers: 'Ctrl,Shift' });
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
