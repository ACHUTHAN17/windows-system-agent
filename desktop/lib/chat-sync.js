'use strict';
// Background chat checkpointing. It batches events for one second and writes
// them to an agent-chats branch, never to main.
const path = require('node:path');

const BRANCH = 'agent-chats';

function repoName(value) {
  return String(value || '').replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
}

async function api(fetchImpl, repo, pat, endpoint, options = {}) {
  const response = await fetchImpl(`https://api.github.com/repos/${repo}${endpoint}`, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401) throw new Error('GitHub rejected the token');
  if (response.status === 404 && !options.allow404) throw new Error(`GitHub could not access ${repo}${endpoint}`);
  return response;
}

async function ensureBranch(fetchImpl, repo, pat) {
  const ref = await api(fetchImpl, repo, pat, `/git/ref/heads/${BRANCH}`, { allow404: true });
  if (ref.status === 200) return;
  const main = await api(fetchImpl, repo, pat, '/git/ref/heads/main');
  const sha = (await main.json()).object.sha;
  const created = await api(fetchImpl, repo, pat, '/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha }) });
  if (!created.ok && created.status !== 422) throw new Error(`Could not create ${BRANCH} (HTTP ${created.status})`);
}

class ChatSync {
  constructor({ repo, pat, enabled = true, fetchImpl = fetch, onStatus = () => {} } = {}) {
    this.repo = repoName(repo);
    this.pat = String(pat || '');
    this.enabled = !!enabled && !!this.repo && !!this.pat;
    this.fetchImpl = fetchImpl;
    this.onStatus = onStatus;
    this.chatId = '';
    this.file = '';
    this.buffer = [];
    this.timer = null;
    this.flushing = false;
    this.branchReady = false;
  }

  start(chatId, task, history = []) {
    if (!this.enabled) return false;
    this.chatId = String(chatId || Date.now()).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
    this.file = `runs/chat-${this.chatId}.jsonl`;
    this.buffer.push({ t: 'chat_start', at: new Date().toISOString(), task: String(task || '').slice(0, 12000), history: Array.isArray(history) ? history.slice(-10) : [] });
    this.flush();
    this.timer = setInterval(() => this.flush(), 1000);
    return true;
  }

  record(event) {
    if (!this.enabled || !this.chatId) return;
    this.buffer.push({ at: new Date().toISOString(), ...event });
  }

  finish(event = {}) {
    if (!this.enabled || !this.chatId) return Promise.resolve();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.record({ t: 'chat_finish', ...event });
    return this.flush();
  }

  async flush() {
    if (!this.enabled || !this.buffer.length) return;
    if (this.flushing) { await new Promise((resolve) => setTimeout(resolve, 25)); return this.flush(); }
    this.flushing = true;
    const batch = this.buffer.splice(0);
    try {
      if (!this.branchReady) { await ensureBranch(this.fetchImpl, this.repo, this.pat); this.branchReady = true; }
      const existing = await api(this.fetchImpl, this.repo, this.pat, `/contents/${this.file}?ref=${BRANCH}`, { allow404: true });
      let content = '';
      let sha = '';
      if (existing.status === 200) {
        const json = await existing.json();
        sha = json.sha || '';
        content = Buffer.from(String(json.content || '').replace(/\s/g, ''), 'base64').toString('utf8');
      }
      content += batch.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
      const written = await api(this.fetchImpl, this.repo, this.pat, `/contents/${this.file}`, {
        method: 'PUT',
        body: JSON.stringify({ message: `agent: chat checkpoint ${this.chatId}`, content: Buffer.from(content).toString('base64'), branch: BRANCH, ...(sha ? { sha } : {}) }),
      });
      if (!written.ok) throw new Error(`chat checkpoint failed (HTTP ${written.status})`);
      this.onStatus({ ok: true, branch: BRANCH, file: this.file, entries: batch.length });
    } catch (error) {
      this.buffer.unshift(...batch);
      this.onStatus({ ok: false, error: error.message });
    } finally {
      this.flushing = false;
    }
  }
}

module.exports = { ChatSync, BRANCH };

