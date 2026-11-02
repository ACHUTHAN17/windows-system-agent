// Durable run state for the orchestration layer. Every write stays under
// runs/<runId>/ so workers can resume/inspect a job without sharing memory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const safeId = (value) => String(value || '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 96);
const stamp = () => new Date().toISOString();

export class Blackboard {
  constructor(root, runId) {
    this.root = path.resolve(root);
    this.runId = safeId(runId || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
    this.dir = path.join(this.root, 'runs', this.runId);
    this.tasksDir = path.join(this.dir, 'tasks');
  }

  create(meta = {}) {
    fs.mkdirSync(this.tasksDir, { recursive: true });
    this.writeJson('run.json', { runId: this.runId, createdAt: stamp(), status: 'planning', ...meta });
    this.appendEvent('run_created', { goal: meta.goal || '' });
    return this;
  }

  path(rel) {
    const target = path.resolve(this.dir, rel);
    if (!target.startsWith(this.dir + path.sep) && target !== this.dir) throw new Error('blackboard path escapes run directory');
    return target;
  }

  writeJson(rel, value) {
    const target = this.path(rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, target);
  }

  readJson(rel, fallback = null) {
    try { return JSON.parse(fs.readFileSync(this.path(rel), 'utf8')); } catch { return fallback; }
  }

  writePlan(plan) { this.writeJson('plan.json', plan); this.appendEvent('plan_written', { taskCount: plan.tasks?.length || 0 }); }
  taskPath(id) { return `tasks/${safeId(id)}.json`; }
  writeTask(task) { this.writeJson(this.taskPath(task.id), task); }
  readTask(id) { return this.readJson(this.taskPath(id)); }

  appendEvent(type, detail = {}) {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.appendFileSync(this.path('events.jsonl'), JSON.stringify({ at: stamp(), type, ...detail }) + '\n', 'utf8');
  }

  setRunStatus(status, extra = {}) {
    const run = this.readJson('run.json', { runId: this.runId, createdAt: stamp() });
    this.writeJson('run.json', { ...run, status, updatedAt: stamp(), ...extra });
    this.appendEvent('run_status', { status, ...extra });
  }

  listEvents(limit = 200) {
    try { return fs.readFileSync(this.path('events.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).slice(-limit).map((x) => JSON.parse(x)); }
    catch { return []; }
  }
}
