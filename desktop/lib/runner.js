'use strict';
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { detectPrompt, parseLine, ANSWER_BEGIN, ANSWER_END } = require('./parse');

const PROMPT_TAIL = /(\[y\/N\]|\[y=once \/ a=always \/ N\])\s*$/;
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

// Runs one agent task at a time as a child process (same engine as the CLI) and
// emits structured events. `execPath` is Electron's own binary with
// ELECTRON_RUN_AS_NODE=1, so users do NOT need Node.js installed.
class AgentRunner extends EventEmitter {
  constructor({ agentDir, execPath, baseEnv, entry }) {
    super();
    this.agentDir = agentDir;
    this.execPath = execPath;
    this.baseEnv = baseEnv || {};
    this.entry = entry || path.join(agentDir, 'src', 'index.js');
    this.child = null;
    this.pending = null;
    this.seq = 0;
  }
  get busy() { return !!this.child; }

  // opts: { args: [...], env: {...}, fullAuto }
  start(opts) {
    if (this.child) return { ok: false, error: 'busy' };
    const args = [this.entry, ...opts.args];
    if (opts.fullAuto) args.push('--yes');
    const env = { ...process.env, ...this.baseEnv, ...(opts.env || {}), ELECTRON_RUN_AS_NODE: '1', WINAGENT_EVENTS: '1' };
    let child;
    try {
      child = spawn(this.execPath, args, { cwd: this.agentDir, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) { return { ok: false, error: e.message }; }
    this.child = child;
    this.emit('event', { t: 'start' });

    let buf = '';
    let inAnswer = false;
    let sawAnswerMarker = false;
    const answer = [];
    let tail = [];
    const errLines = [];

    const handleLine = (l) => {
      if (l.includes(ANSWER_BEGIN)) { inAnswer = true; sawAnswerMarker = true; return; }
      if (l.includes(ANSWER_END)) { inAnswer = false; return; }
      if (inAnswer) { answer.push(l); return; }
      if (!l.trim()) return;
      const p = parseLine(l);
      if (p.kind === 'step') { tail = []; this.emit('event', { t: 'step', n: p.n, text: p.text }); }
      else if (p.kind === 'tool') { tail = []; this.emit('event', { t: 'tool', name: p.name, ok: p.ok, summary: p.summary }); }
      else if (p.kind === 'note') this.emit('event', { t: 'note', text: p.text });
      else if (p.kind === 'banner') this.emit('event', { t: 'banner', text: p.text });
      else { tail.push(p.text); this.emit('event', { t: 'log', text: p.text.slice(0, 2000) }); }
    };

    const maybePrompt = () => {
      if (this.pending || !buf || !PROMPT_TAIL.test(buf)) return;
      const pr = detectPrompt(buf);
      if (!pr) return;
      buf = '';
      const id = ++this.seq;
      this.emit('event', { t: 'approval', id, kind: pr.kind, label: pr.label, options: pr.options });
      this.pending = {
        id,
        timer: setTimeout(() => this.approve(id, 'deny', true), APPROVAL_TIMEOUT_MS),
      };
    };

    child.stdout.on('data', (chunk) => {
      buf += String(chunk);
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) handleLine(l);
      maybePrompt();
    });
    child.stderr.on('data', (chunk) => {
      for (const l of String(chunk).split(/\r?\n/)) if (l.trim()) errLines.push(l.trim());
    });
    child.on('error', (e) => { errLines.push(e.message); });
    child.on('exit', (code) => {
      if (buf.trim()) handleLine(buf);
      buf = '';
      if (this.pending) { clearTimeout(this.pending.timer); this.pending = null; }
      let text = answer.join('\n').trim();
      if (!sawAnswerMarker && code === 0) text = tail.join('\n').trim(); // older engine without the marker
      if (text) this.emit('event', { t: 'answer', text });
      if (code !== 0 && code !== null) {
        const msg = errLines.filter(x => !/^Fix:/.test(x)).join('\n') || `The agent exited with code ${code}.`;
        this.emit('event', { t: 'error', text: msg.slice(0, 2000) });
      }
      this.child = null;
      this.emit('event', { t: 'done', code: code === null ? -1 : code });
    });
    return { ok: true };
  }

  run({ text, fullAuto, env }) {
    let t = String(text || '').trim();
    if (!t) return { ok: false, error: 'empty task' };
    if (t.startsWith('-')) t = ' ' + t; // never let a task be parsed as a CLI flag
    return this.start({ args: ['--once', t], fullAuto, env });
  }

  approve(id, decision, auto) {
    const p = this.pending;
    if (!p || p.id !== id || !this.child) return false;
    clearTimeout(p.timer);
    this.pending = null;
    const map = { once: 'y', always: 'a', deny: 'n' };
    try { this.child.stdin.write((map[decision] || 'n') + '\n'); } catch { /* child already gone */ }
    this.emit('event', { t: 'resolved', decision: auto ? 'deny (timed out)' : decision });
    return true;
  }

  stop() {
    const c = this.child;
    if (!c) return false;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending = null; }
    try {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(c.pid), '/T', '/F'], { windowsHide: true });
      else c.kill('SIGTERM');
    } catch { /* ignore */ }
    return true;
  }
}

module.exports = { AgentRunner };
