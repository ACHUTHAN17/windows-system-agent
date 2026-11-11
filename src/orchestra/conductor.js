// Conductor: asks the configured planner for a bounded task DAG, then validates
// every dependency before the scheduler sees it. It always has a native fallback
// so deterministic/offline installations remain usable.
import { chat, hasConfiguredModel } from '../llm.js';
import { suggestUsageWorker } from './usage-model.js';

const WORKERS = new Set(['native', 'hermes', 'openclaw', 'cloud']);
const idOf = (value, n) => String(value || `task-${n + 1}`).toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || `task-${n + 1}`;

function jsonFrom(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('planner returned no JSON object');
  return JSON.parse(m[0]);
}

export function validatePlan(raw, goal) {
  const list = Array.isArray(raw?.tasks) ? raw.tasks.slice(0, 32) : [];
  if (!list.length) return fallbackPlan(goal);
  const ids = new Set();
  const tasks = list.map((item, index) => {
    const id = idOf(item.id, index);
    if (ids.has(id)) throw new Error(`planner DAG has duplicate task id: ${id}`);
    ids.add(id);
    const worker = WORKERS.has(String(item.worker || '').toLowerCase()) ? String(item.worker).toLowerCase() : 'native';
    return {
      id,
      title: String(item.title || item.goal || id).slice(0, 140),
      goal: String(item.goal || '').trim().slice(0, 12000),
      worker,
      deps: Array.isArray(item.deps) ? item.deps.map((d) => idOf(d)).filter((d) => d !== id) : [],
      retries: Math.max(0, Math.min(3, Number(item.retries ?? 1) || 0)),
      timeoutMs: Math.max(5000, Math.min(30 * 60 * 1000, Number(item.timeoutMs ?? 180000) || 180000)),
      resources: Array.isArray(item.resources) ? item.resources.map((x) => String(x).replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 64)).filter(Boolean).slice(0, 8) : [],
    };
  });
  for (const task of tasks) {
    if (!task.goal) throw new Error(`planner task ${task.id} has no goal`);
    for (const dep of task.deps) if (!ids.has(dep)) throw new Error(`planner task ${task.id} depends on missing task ${dep}`);
  }
  // Kahn validation: unknown/cyclic dependencies must never deadlock workers.
  const remaining = new Map(tasks.map((t) => [t.id, new Set(t.deps)]));
  const ready = [...remaining].filter(([, deps]) => !deps.size).map(([id]) => id);
  let seen = 0;
  while (ready.length) {
    const id = ready.shift(); seen++;
    for (const [other, deps] of remaining) if (deps.delete(id) && !deps.size) ready.push(other);
  }
  if (seen !== tasks.length) throw new Error('planner DAG contains a dependency cycle');
  return { version: 1, summary: String(raw.summary || goal).slice(0, 500), tasks };
}

export function fallbackPlan(goal, cfg = {}) {
  const suggestion = suggestUsageWorker(goal, cfg);
  const worker = suggestion.worker || 'native';
  return {
    version: 1,
    summary: worker === 'native' ? 'Native single-task fallback' : `Learned ${worker} worker fallback`,
    tasks: [{ id: `${worker}-1`, title: 'Complete the requested goal', goal: String(goal), worker, deps: [], retries: 0, timeoutMs: 180000, resources: worker === 'native' ? ['desktop'] : [] }],
    learnedRoute: { source: suggestion.source, worker, confidence: suggestion.prediction?.confidence ?? null },
  };
}

function conductorConfig(cfg) {
  // Keep the planner's credentials and endpoint independent from the regular
  // agent loop. This makes Muse Spark a true Conductor instead of an implicit
  // replacement for the user's selected normal model.
  if (!cfg.orchestraPlannerUrl || !cfg.orchestraPlannerModel) return { cfg, source: 'configured-planner' };
  return {
    source: cfg.orchestraPlannerModel === 'muse-spark-1.1' ? 'muse-spark-1.1-conductor' : 'dedicated-conductor',
    cfg: {
      ...cfg,
      provider: cfg.orchestraPlannerProvider || 'openai-compatible',
      apiUrl: cfg.orchestraPlannerUrl,
      model: cfg.orchestraPlannerModel,
      apiKey: cfg.orchestraPlannerKey || cfg.apiKey,
    },
  };
}

export async function planGoal({ goal, cfg }) {
  const selected = conductorConfig(cfg);
  if (!hasConfiguredModel(selected.cfg)) return { plan: fallbackPlan(goal, cfg), source: 'deterministic-fallback' };
  const prompt = `You are the WinAgent Conductor. Convert a user goal into a safe, bounded DAG for a worker scheduler.\n`
    + `Reply ONLY with JSON: {"summary":"...","tasks":[{"id":"short-id","title":"...","goal":"precise worker instruction","worker":"native|hermes|openclaw|cloud","deps":["task-id"],"retries":0,"timeoutMs":180000,"resources":["desktop"]}]}.\n`
    + `Use native unless an optional worker is specifically appropriate. Maximum 12 tasks. Every task must have an observable outcome. Do not use workers that are not needed.`;
  try {
    const raw = jsonFrom(await chat(selected.cfg, [{ role: 'system', content: prompt }, { role: 'user', content: String(goal) }]));
    return { plan: validatePlan(raw, goal), source: selected.source };
  } catch (error) {
    return { plan: fallbackPlan(goal, cfg), source: `${selected.source}-fallback`, warning: error.message };
  }
}
