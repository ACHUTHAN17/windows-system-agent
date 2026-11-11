'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..', '..');
const mod = import(pathToFileURL(path.join(REPO, 'src', 'orchestra', 'usage-model.js')).href);

test('usage model trains from labelled agent tasks and selects configured workers only', async () => {
  const api = await mod;
  const samples = [
    { text: 'open settings on this computer', label: 'native' }, { text: 'create an HTML report locally', label: 'native' },
    { text: 'use Hermes WSL for a long coding task', label: 'hermes' }, { text: 'continue coding in the Hermes sidecar', label: 'hermes' },
    { text: 'delegate a gateway task to OpenClaw', label: 'openclaw' }, { text: 'use the OpenClaw subagent gateway', label: 'openclaw' },
    { text: 'run a GitHub Actions release build', label: 'cloud' }, { text: 'dispatch cloud CI workflow', label: 'cloud' },
  ];
  const model = api.trainUsageModel(samples);
  assert.equal(api.predictUsageModel(model, 'run a GitHub Actions build').label, 'cloud');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-usage-'));
  fs.mkdirSync(path.join(root, 'models')); fs.writeFileSync(path.join(root, 'models', 'agent-usage.model.json'), JSON.stringify(model));
  assert.equal(api.suggestUsageWorker('delegate to OpenClaw gateway', { root }).worker, 'native');
  assert.equal(api.suggestUsageWorker('delegate to OpenClaw gateway', { root, openclawCommand: 'openclaw' }).worker, 'openclaw');
});
