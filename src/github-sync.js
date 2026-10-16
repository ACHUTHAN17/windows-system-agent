// Optional automatic sync for skills and self-authored tools.
// It never writes main: learned files go to agent-learned for review.
import fs from 'node:fs';
import path from 'node:path';

export const LEARNED_BRANCH = 'agent-learned';
const ALLOW = [
  /^skills\/[^/]+\.md$/,
  /^tools-imported\/self-authored\/[^/]+\.js$/,
  /^memory\/SELF\.md$/,
];

export function isSyncableLearnedFile(rel) {
  return ALLOW.some((re) => re.test(String(rel || '').replaceAll('\\', '/')));
}

function repoName(value) {
  return String(value || '').replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
}

async function api(fetchImpl, repo, pat, endpoint, options = {}) {
  const response = await fetchImpl(`https://api.github.com/repos/${repo}${endpoint}`, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401) throw new Error('GitHub rejected the token (401)');
  if (response.status === 404 && !options.allow404) throw new Error(`GitHub could not access ${repo}${endpoint}`);
  return response;
}

async function ensureBranch(fetchImpl, repo, pat) {
  const current = await api(fetchImpl, repo, pat, `/git/ref/heads/${LEARNED_BRANCH}`, { allow404: true });
  if (current.status === 200) return;
  const main = await api(fetchImpl, repo, pat, '/git/ref/heads/main');
  const sha = (await main.json()).object.sha;
  const created = await api(fetchImpl, repo, pat, '/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${LEARNED_BRANCH}`, sha }) });
  if (!created.ok && created.status !== 422) throw new Error(`Could not create ${LEARNED_BRANCH} (HTTP ${created.status})`);
}

async function putFile(fetchImpl, repo, pat, rel, content) {
  let sha = '';
  const existing = await api(fetchImpl, repo, pat, `/contents/${rel}?ref=${LEARNED_BRANCH}`, { allow404: true });
  if (existing.status === 200) sha = (await existing.json()).sha || '';
  const response = await api(fetchImpl, repo, pat, `/contents/${rel}`, { method: 'PUT', body: JSON.stringify({ message: `agent: learned ${rel}`, content: Buffer.from(content).toString('base64'), branch: LEARNED_BRANCH, ...(sha ? { sha } : {}) }) });
  if (!response.ok) throw new Error(`Could not write ${rel} (HTTP ${response.status})`);
}

function contentHash(content) { return `${content.length}:${content.slice(0, 40)}`; }

// Establish a baseline for files already shipped with the agent. This keeps
// enabling sync from uploading the whole bundled skill library; only files
// created or changed after startup are uploaded.
export function seedLearnedState({ agentDir, files }) {
  const stateFile = path.join(agentDir, '.push-state.json');
  if (fs.existsSync(stateFile)) return false;
  const state = {};
  for (const rel of [...new Set((files || []).map((f) => String(f).replaceAll('\\', '/')))].filter(isSyncableLearnedFile)) {
    try { state[rel] = contentHash(fs.readFileSync(path.join(agentDir, rel), 'utf8')); } catch {}
  }
  try { fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8'); return true; } catch { return false; }
}

// Sync only files created/changed by the current agent run. A local state file
// makes repeated runs idempotent and prevents re-uploading unchanged content.
export async function pushLearnedFiles({ agentDir, repo, pat, files, fetchImpl = fetch }) {
  const normalizedRepo = repoName(repo);
  if (!normalizedRepo || !pat) return { pushed: [], skipped: 0, errors: [] };
  const stateFile = path.join(agentDir, '.push-state.json');
  let state = {};
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
  const candidates = [...new Set((files || []).map((f) => String(f).replaceAll('\\', '/')))].filter(isSyncableLearnedFile);
  const result = { pushed: [], skipped: 0, errors: [] };
  let branchReady = false;
  for (const rel of candidates) {
    const full = path.join(agentDir, rel);
    let content;
    try { content = fs.readFileSync(full, 'utf8'); } catch { result.skipped++; continue; }
    const hash = contentHash(content);
    if (state[rel] === hash) { result.skipped++; continue; }
    try {
      if (!branchReady) { await ensureBranch(fetchImpl, normalizedRepo, pat); branchReady = true; }
      await putFile(fetchImpl, normalizedRepo, pat, rel, content);
      state[rel] = hash;
      result.pushed.push(rel);
    } catch (error) { result.errors.push(`${rel}: ${error.message}`); }
  }
  try { fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8'); } catch {}
  return result;
}

