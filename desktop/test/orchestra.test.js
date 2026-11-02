'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..', '..');
const mod = (file) => import(pathToFileURL(path.join(REPO, 'src', 'orchestra', file)).href);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wa-orchestra-'));

test('conductor validates a bounded dependency DAG and rejects cycles', async () => {
  const { validatePlan } = await mod('conductor.js');
  const plan = validatePlan({ summary: 'x', tasks: [
    { id: 'inspect', goal: 'inspect', worker: 'native', resources: ['disk'] },
    { id: 'report', goal: 'report', worker: 'native', deps: ['inspect'], resources: ['disk'] },
  ] }, 'goal');
  assert.deepStrictEqual(plan.tasks[1].deps, ['inspect']);
  assert.throws(() => validatePlan({ tasks: [{ id: 'a', goal: 'a', deps: ['b'] }, { id: 'b', goal: 'b', deps: ['a'] }] }, 'goal'), /cycle/);
});

test('Muse Spark is used as the dedicated Conductor without replacing the normal model', async () => {
  const { planGoal } = await mod('conductor.js');
  const oldFetch = global.fetch; const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: 'planned', tasks: [{ id: 'inspect', goal: 'inspect locally', worker: 'native' }] }) } }] }), { status: 200 });
  };
  try {
    const result = await planGoal({ goal: 'inspect', cfg: {
      provider: 'none', apiUrl: '', model: '', apiKey: '', fallbackUrl: '', useScoutedModels: false,
      orchestraPlannerProvider: 'openai-compatible', orchestraPlannerUrl: 'https://api.meta.ai/v1', orchestraPlannerModel: 'muse-spark-1.1', orchestraPlannerKey: 'test-key',
    } });
    assert.strictEqual(result.source, 'muse-spark-1.1-conductor');
    assert.strictEqual(result.plan.tasks[0].worker, 'native');
    assert.strictEqual(calls[0].url, 'https://api.meta.ai/v1/chat/completions');
    assert.strictEqual(calls[0].options.headers.Authorization, 'Bearer test-key');
  } finally { global.fetch = oldFetch; }
});

test('scheduler persists blackboard state, honours dependencies, locks, and retries', async () => {
  const { Blackboard } = await mod('blackboard.js');
  const { Scheduler } = await mod('scheduler.js');
  const root = tmp(); const board = new Blackboard(root, 'run-test').create({ goal: 'test' });
  const order = []; let attempts = 0;
  const scheduler = new Scheduler({ blackboard: board, cfg: { orchestraConcurrency: 3, orchestraBudgetMs: 5000 }, workers: {
    native: async ({ task }) => {
      order.push(`${task.id}:${task.attempts}`);
      if (task.id === 'a' && ++attempts === 1) return { ok: false, error: 'transient' };
      return { ok: true, result: task.id };
    },
  } });
  const plan = { tasks: [
    { id: 'a', goal: 'a', worker: 'native', deps: [], retries: 1, timeoutMs: 1000, resources: ['desktop'] },
    { id: 'b', goal: 'b', worker: 'native', deps: ['a'], retries: 0, timeoutMs: 1000, resources: ['desktop'] },
  ] };
  const result = await scheduler.run(plan);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(order, ['a:1', 'a:2', 'b:1']);
  assert.strictEqual(board.readJson('plan.json'), null, 'scheduler does not overwrite conductor plan');
  assert.strictEqual(board.readTask('b').status, 'completed');
  assert.ok(board.listEvents().some((e) => e.type === 'task_retry'));
});

test('orchestra uses the native worker in an offline installation and writes a durable run', async () => {
  const { orchestrateGoal } = await mod('index.js');
  const root = tmp(); const notes = [];
  const result = await orchestrateGoal({
    goal: 'inspect this PC', cfg: { root, provider: 'none', apiUrl: '', model: '', orchestraConcurrency: 1, orchestraBudgetMs: 5000, onEvent: (e) => notes.push(e) },
    engine: { agentTask: async (goal) => `done: ${goal}` },
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.plan.planner, 'deterministic-fallback');
  assert.ok(fs.existsSync(path.join(root, 'runs', result.runId, 'plan.json')));
  assert.ok(notes.some((e) => e.t === 'note' && /Conductor/.test(e.text)));
});

test('kill switch records cancellation and leaves durable task state', async () => {
  const { Blackboard } = await mod('blackboard.js');
  const { Scheduler } = await mod('scheduler.js');
  const root = tmp(); const board = new Blackboard(root, 'run-kill').create({ goal: 'stop' });
  let scheduler;
  scheduler = new Scheduler({ blackboard: board, cfg: { orchestraConcurrency: 1, orchestraBudgetMs: 5000 }, workers: {
    native: async ({ signal }) => new Promise((resolve) => {
      signal.addEventListener('abort', () => resolve({ ok: false, error: 'stopped' }), { once: true });
      setTimeout(() => scheduler.kill('test stop'), 10);
    }),
  } });
  const result = await scheduler.run({ tasks: [{ id: 'a', goal: 'a', worker: 'native', deps: [], retries: 0, timeoutMs: 1000, resources: [] }] });
  assert.strictEqual(result.status, 'cancelled');
  assert.strictEqual(board.readTask('a').status, 'cancelled');
  assert.ok(board.listEvents().some((event) => event.type === 'kill_switch'));
});
