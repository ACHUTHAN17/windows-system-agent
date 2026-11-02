// Dependency-aware worker pool with bounded retries, resource locks, durable
// task state, and a cooperative kill switch.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Scheduler {
  constructor({ blackboard, workers, cfg, onEvent }) {
    this.blackboard = blackboard; this.workers = workers; this.cfg = cfg; this.onEvent = onEvent || (() => {});
    this.killed = false; this.locks = new Set(); this.controllers = new Map();
  }
  kill(reason = 'cancelled by owner') {
    this.killed = true;
    for (const controller of this.controllers.values()) controller.abort(reason);
    this.blackboard.appendEvent('kill_switch', { reason });
  }
  emit(type, detail) { this.blackboard.appendEvent(type, detail); this.onEvent({ type, ...detail }); }

  async run(plan) {
    const started = Date.now();
    const budgetMs = Math.max(10000, Number(this.cfg.orchestraBudgetMs || 20 * 60 * 1000));
    const concurrency = Math.max(1, Math.min(8, Number(this.cfg.orchestraConcurrency || 2)));
    const states = new Map(plan.tasks.map((task) => [task.id, { ...task, runId: this.blackboard.runId, status: 'pending', attempts: 0 }]));
    for (const task of states.values()) this.blackboard.writeTask(task);
    this.blackboard.setRunStatus('running', { startedAt: new Date(started).toISOString() });
    const active = new Set();
    const terminal = () => [...states.values()].every((task) => ['completed', 'failed', 'blocked', 'cancelled'].includes(task.status));
    const lockable = (task) => task.resources.every((resource) => !this.locks.has(resource));
    const acquire = (task) => task.resources.forEach((resource) => this.locks.add(resource));
    const release = (task) => task.resources.forEach((resource) => this.locks.delete(resource));

    const runOne = async (task) => {
      acquire(task); active.add(task.id); task.status = 'running'; task.attempts++; task.startedAt = new Date().toISOString(); this.blackboard.writeTask(task);
      this.emit('task_started', { taskId: task.id, worker: task.worker, attempt: task.attempts, goal: task.goal });
      const controller = new AbortController(); this.controllers.set(task.id, controller);
      let result;
      try {
        const worker = this.workers[task.worker];
        if (!worker) result = { ok: false, nonRetryable: true, error: `unknown worker: ${task.worker}` };
        else {
          let timer;
          result = await Promise.race([
            worker({ task, signal: controller.signal }),
            new Promise((resolve) => { timer = setTimeout(() => { controller.abort('task timeout'); resolve({ ok: false, error: 'task timed out' }); }, task.timeoutMs); }),
          ]).finally?.(() => clearTimeout(timer));
        }
      } catch (error) { result = { ok: false, error: error.message }; }
      finally { this.controllers.delete(task.id); release(task); active.delete(task.id); }
      task.finishedAt = new Date().toISOString(); task.result = result?.result || ''; task.error = result?.error || '';
      if (result?.ok) task.status = 'completed';
      else if (this.killed || controller.signal.aborted) task.status = 'cancelled';
      else if (!result?.nonRetryable && task.attempts <= task.retries) task.status = 'pending';
      else task.status = 'failed';
      this.blackboard.writeTask(task);
      this.emit(task.status === 'completed' ? 'task_completed' : task.status === 'pending' ? 'task_retry' : 'task_failed', { taskId: task.id, worker: task.worker, attempt: task.attempts, error: task.error, result: task.result });
    };

    while (!terminal()) {
      if (this.killed || Date.now() - started > budgetMs) {
        this.killed = true;
        for (const task of states.values()) if (task.status === 'pending') { task.status = 'cancelled'; task.error = this.killed ? 'run cancelled or budget exhausted' : ''; this.blackboard.writeTask(task); }
      }
      for (const task of states.values()) {
        if (task.status !== 'pending') continue;
        const deps = task.deps.map((id) => states.get(id));
        if (deps.some((dep) => ['failed', 'blocked', 'cancelled'].includes(dep?.status))) { task.status = 'blocked'; task.error = 'dependency did not complete'; this.blackboard.writeTask(task); this.emit('task_blocked', { taskId: task.id, error: task.error }); }
      }
      const ready = [...states.values()].filter((task) => task.status === 'pending' && task.deps.every((id) => states.get(id)?.status === 'completed') && lockable(task));
      while (!this.killed && active.size < concurrency && ready.length) void runOne(ready.shift());
      if (!terminal()) await sleep(20);
    }
    while (active.size) await sleep(20);
    const tasks = [...states.values()]; const failed = tasks.filter((task) => task.status !== 'completed');
    const status = failed.length ? (this.killed ? 'cancelled' : 'failed') : 'completed';
    this.blackboard.setRunStatus(status, { finishedAt: new Date().toISOString(), durationMs: Date.now() - started });
    return { ok: status === 'completed', runId: this.blackboard.runId, status, tasks: tasks.map((task) => ({ id: task.id, status: task.status, attempts: task.attempts, error: task.error, result: task.result })) };
  }
}
