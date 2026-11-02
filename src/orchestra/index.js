// Public orchestra facade used by every WinAgent entry point.
import { Blackboard } from './blackboard.js';
import { planGoal } from './conductor.js';
import { Scheduler } from './scheduler.js';
import { createWorkers } from './workers.js';

export async function orchestrateGoal({ goal, cfg, engine, entry, requirePlanApproval = false, approvePlan }) {
  const blackboard = new Blackboard(cfg.root).create({ goal: String(goal), entry: entry || cfg.orchestraEntry || 'unknown' });
  const planned = await planGoal({ goal, cfg });
  const plan = { ...planned.plan, runId: blackboard.runId, goal: String(goal), planner: planned.source, warning: planned.warning || '' };
  blackboard.writePlan(plan);
  cfg.onEvent?.({ t: 'note', text: `Conductor created ${plan.tasks.length}-task DAG (${planned.source}); run ${blackboard.runId}.` });
  if (requirePlanApproval) {
    const accepted = await approvePlan?.(plan);
    if (!accepted) {
      blackboard.setRunStatus('plan-rejected');
      return { ok: false, runId: blackboard.runId, status: 'plan-rejected', plan, tasks: [] };
    }
  }
  const scheduler = new Scheduler({
    blackboard, cfg, workers: createWorkers({ engine, cfg }),
    onEvent: (event) => cfg.onEvent?.({ t: 'note', text: `Orchestra ${event.type}: ${event.taskId || event.worker || ''}`.trim(), orchestra: event }),
  });
  cfg._orchestraKill = (reason) => scheduler.kill(reason);
  try {
    const result = await scheduler.run(plan);
    return { ...result, plan, blackboard: { dir: blackboard.dir, events: 'events.jsonl' } };
  } finally {
    delete cfg._orchestraKill;
  }
}
