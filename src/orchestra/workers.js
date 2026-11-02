// Optional worker adapters. The native worker is always present; external
// workers fail closed with a diagnosable "not configured" result.
import { spawn } from 'node:child_process';

function unavailable(worker, setting) {
  return { ok: false, nonRetryable: true, error: `${worker} worker is not configured (${setting})` };
}

function runProcess(command, args, timeoutMs, signal) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = ''; let ended = false;
    const finish = (value) => { if (ended) return; ended = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => { try { child.kill(); } catch {} finish({ ok: false, error: 'worker process timed out' }); }, timeoutMs);
    signal?.addEventListener?.('abort', () => { try { child.kill(); } catch {} finish({ ok: false, error: 'worker cancelled' }); }, { once: true });
    child.stdout.on('data', (x) => { out += String(x); if (out.length > 12000) out = out.slice(-12000); });
    child.stderr.on('data', (x) => { err += String(x); if (err.length > 6000) err = err.slice(-6000); });
    child.on('error', (e) => finish({ ok: false, error: e.message }));
    child.on('exit', (code) => finish({ ok: code === 0, result: out.trim().slice(0, 12000), error: code === 0 ? '' : (err.trim() || `worker exited ${code}`) }));
  });
}

export function createWorkers({ engine, cfg }) {
  return {
    native: async ({ task, signal }) => {
      if (signal?.aborted) return { ok: false, error: 'worker cancelled' };
      const cancel = () => { cfg._aborted = true; };
      signal?.addEventListener?.('abort', cancel, { once: true });
      try {
        const result = await engine.agentTask(task.goal);
        return { ok: true, result: String(result).slice(0, 12000) };
      } finally {
        signal?.removeEventListener?.('abort', cancel);
      }
    },
    hermes: async ({ task, signal }) => {
      const command = String(cfg.hermesCommand || '').trim();
      if (!command) return unavailable('Hermes/WSL2', 'HERMES_COMMAND');
      // Configuration is explicit and owner-controlled. It is passed to WSL as
      // literal argv, never through a host shell or eval.
      const parts = command.split(/\s+/).filter(Boolean);
      return runProcess('wsl.exe', ['--', ...parts, task.goal], task.timeoutMs, signal);
    },
    openclaw: async ({ task, signal }) => {
      const command = String(cfg.openclawCommand || '').trim();
      if (command) {
        const [program, ...args] = command.split(/\s+/).filter(Boolean);
        return runProcess(program, [...args, task.goal], task.timeoutMs, signal);
      }
      const url = String(cfg.openclawUrl || '').replace(/\/+$/, '');
      if (!url) return unavailable('OpenClaw', 'OPENCLAW_COMMAND or OPENCLAW_URL');
      const taskPath = '/' + String(cfg.openclawTaskPath || '/tasks').replace(/^\/+/, '');
      try {
        // A remote OpenClaw worker is intentionally a small owner-operated
        // bridge. Its HTTP contract is documented, configurable, and never
        // pretends that a raw OpenClaw Gateway exposes an unsafe public API.
        const response = await fetch(`${url}${taskPath}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(cfg.openclawToken ? { Authorization: `Bearer ${cfg.openclawToken}` } : {}) },
          body: JSON.stringify({ goal: task.goal, taskId: task.id, runId: task.runId, worker: 'openclaw' }), signal,
        });
        const text = await response.text();
        return response.ok ? { ok: true, result: text.slice(0, 12000) } : { ok: false, error: `OpenClaw HTTP ${response.status}: ${text.slice(0, 500)}` };
      } catch (e) { return { ok: false, error: `OpenClaw request failed: ${e.message}` }; }
    },
    cloud: async ({ task, signal }) => {
      const repo = String(cfg.githubRepo || '').trim(); const token = String(cfg.githubPat || '').trim(); const workflow = String(cfg.cloudWorkflow || '').trim();
      if (!repo || !token || !workflow) return unavailable('GitHub Actions', 'GITHUB_REPO, GITHUB_PAT, CLOUD_WORKFLOW');
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
          method: 'POST', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: cfg.cloudRef || 'main', inputs: { goal: task.goal, run_id: task.runId, task_id: task.id } }), signal,
        });
        return response.ok || response.status === 204 ? { ok: true, result: 'GitHub Actions workflow dispatched.' } : { ok: false, error: `GitHub Actions HTTP ${response.status}: ${(await response.text()).slice(0, 500)}` };
      } catch (e) { return { ok: false, error: `GitHub Actions dispatch failed: ${e.message}` }; }
    },
  };
}
