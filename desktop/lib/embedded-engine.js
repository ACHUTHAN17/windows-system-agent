'use strict';
// The desktop app's REAL engine integration: imports src/index.js's createEngine() and runs
// the agent IN-PROCESS — no child process, no stdout parsing, no regex. This replaces
// runner.js + parse.js (the old child-process approach) entirely.
//
// Two things make this possible without the engine knowing it's embedded:
//   - cfg.onEvent(ev)        — agentTask()/runTool() call this for {t:'step'|'tool', ...}
//                              in addition to their normal console.log (CLI unaffected).
//   - cfg.approvalHandler(label) — already existed in safety.js (built for the old web
//                              dashboard); resolves true/false for a plain tool approval,
//                              or 'once'/'always'/null for an app-control approval
//                              (labels passed to it are prefixed "APP " for those).
// Routine chatter (skill auto-pick, llm retry/fallback lines, mcp/self-tool loading) is
// printed by the engine via console.log only — it was never wired to onEvent, so it never
// reaches the UI. That's deliberate: it's useful in a terminal, it's noise in a chat window.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { EventEmitter } = require('node:events');

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

class EmbeddedEngine extends EventEmitter {
  constructor(agentDir) {
    super();
    this.agentDir = agentDir;
    this.engine = null;
    this.busy = false;
    this.pending = null; // { id, resolve, timer }
    this.seq = 0;
  }

  async ensureLoaded() {
    if (this.engine) return this.engine;
    const t = '?t=' + Date.now();
    const [indexMod, configMod] = await Promise.all([
      import(pathToFileURL(path.join(this.agentDir, 'src', 'index.js')).href + t),
      import(pathToFileURL(path.join(this.agentDir, 'src', 'config.js')).href + t),
    ]);
    this.engine = await indexMod.createEngine({ _: [] });
    this.printActiveModel = configMod.printActiveModel;
    return this.engine;
  }

  approve(id, decision) {
    const p = this.pending;
    if (!p || p.id !== id) return false;
    clearTimeout(p.timer);
    this.pending = null;
    p.resolve(decision);
    this.emit('event', { t: 'resolved', decision });
    return true;
  }

  stop() {
    if (!this.engine) return false;
    this.engine.cfg._aborted = true;
    if (this.pending) this.approve(this.pending.id, 'deny');
    return true;
  }

  // opts: { env: {MODEL_*, ALLOWED_ROOTS, USE_SCOUTED_MODELS, ...}, fullAuto }
  // Resolves almost immediately (after the busy check, before the task actually runs) —
  // matches the old child-process runner's contract, where the IPC call returning just meant
  // "started OK". All real progress comes through 'event'; await a 'done' event for completion,
  // the same as before.
  async run(text, opts = {}) {
    if (this.busy) return { ok: false, error: 'busy' };
    this.busy = true;
    this.emit('event', { t: 'start' });
    const restoreEnv = this._applyEnv(opts.env || {});
    (async () => {
      try {
        const engine = await this.ensureLoaded();
        const cfg = engine.cfg;
        cfg.autoYes = !!opts.fullAuto || cfg.autoYes;
        cfg.onEvent = (ev) => this.emit('event', ev);
        cfg.approvalHandler = (label) => this._approvalHandler(label);
        this.emit('event', { t: 'banner', text: this.printActiveModel(cfg) });

        let answer = '', error = '';
        try { answer = await engine.agentTask(text); }
        catch (e) { error = e.message; }

        if (answer) this.emit('event', { t: 'answer', text: answer });
        if (error) this.emit('event', { t: 'error', text: error });
        this.emit('event', { t: 'done', code: error ? 1 : 0 });
      } catch (e) {
        this.emit('event', { t: 'error', text: e.message });
        this.emit('event', { t: 'done', code: 1 });
      } finally {
        this.busy = false;
        restoreEnv();
      }
    })();
    return { ok: true };
  }

  async runSelftest() {
    if (this.busy) return { ok: false, error: 'busy' };
    this.busy = true;
    this.emit('event', { t: 'start' });
    try {
      const engine = await this.ensureLoaded();
      const lines = [];
      const orig = console.log;
      console.log = (...a) => lines.push(a.join(' '));
      try { await engine.selftest(); } finally { console.log = orig; }
      this.emit('event', { t: 'answer', text: '```\n' + lines.join('\n') + '\n```' });
      this.emit('event', { t: 'done', code: 0 });
      return { ok: true };
    } catch (e) {
      this.emit('event', { t: 'error', text: e.message });
      this.emit('event', { t: 'done', code: 1 });
      return { ok: true };
    } finally { this.busy = false; }
  }

  _approvalHandler(label) {
    return new Promise((resolve) => {
      const id = ++this.seq;
      const isApp = label.startsWith('APP ');
      const options = isApp ? ['once', 'always', 'deny'] : ['once', 'deny'];
      this.emit('event', { t: 'approval', id, kind: isApp ? 'app' : 'tool', label: isApp ? label.slice(4) : label, options });
      const timer = setTimeout(() => this.approve(id, 'deny'), APPROVAL_TIMEOUT_MS);
      this.pending = {
        id,
        resolve: (decision) => {
          if (isApp) resolve(decision === 'once' ? 'once' : decision === 'always' ? 'always' : null);
          else resolve(decision === 'once');
        },
        timer,
      };
    });
  }

  // Model overrides come in as env-var-shaped strings (same convention config.js already
  // reads) so Settings doesn't need two code paths for "spawn a process" vs "call in-process".
  // Applied to process.env for the duration of one run only, then restored — config.js reads
  // these once at createEngine() time, and a fresh MODEL_* combination means a fresh engine.
  _applyEnv(env) {
    const keys = Object.keys(env);
    const prev = {};
    for (const k of keys) { prev[k] = process.env[k]; process.env[k] = env[k]; }
    const changedModel = ['MODEL_API_URL', 'MODEL_NAME', 'MODEL_PROVIDER', 'MODEL_API_KEY'].some(k => k in env);
    if (changedModel) this.engine = null; // force re-createEngine() so config.js re-reads env
    return () => { for (const k of keys) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } };
  }
}

module.exports = { EmbeddedEngine };
