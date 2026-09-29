'use strict';
// Pushes things the agent has learned/built for itself — new skills, new self-authored
// tools, the SELF.md learning log — to a dedicated `agent-learned` branch on GitHub.
// NEVER touches main directly: a human still reviews/merges. Uses the Contents API
// (one file per commit) rather than shelling out to git, so it works with only a PAT,
// no local git config, and no risk of touching files outside the allow-list below.
const fs = require('node:fs');
const path = require('node:path');

const BRANCH = 'agent-learned';
const ALLOW = [/^skills\/[^/]+\.md$/, /^tools-imported\/self-authored\/[^/]+\.js$/, /^memory\/SELF\.md$/];
function isAllowed(rel) { return ALLOW.some(re => re.test(rel)); }

async function api(fetchImpl, pat, repo, p, opts) {
  const r = await fetchImpl(`https://api.github.com/repos/${repo}${p}`, {
    ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', ...(opts && opts.headers) },
    signal: AbortSignal.timeout(20000),
  });
  if (r.status === 401) throw new Error('GitHub rejected the token (401) — check it has the "repo" scope and hasn\'t expired.');
  if (r.status === 404 && !(opts && opts.allow404)) throw new Error(`GitHub 404 for ${repo}${p} — check the repo name and that the token can access it.`);
  return r;
}

async function ensureBranch(fetchImpl, pat, repo) {
  let r = await api(fetchImpl, pat, repo, `/git/ref/heads/${BRANCH}`, { allow404: true });
  if (r.status === 200) return;
  const main = await api(fetchImpl, pat, repo, '/git/ref/heads/main');
  const sha = (await main.json()).object.sha;
  const created = await api(fetchImpl, pat, repo, '/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha }) });
  if (!created.ok && created.status !== 422) throw new Error(`Could not create the ${BRANCH} branch (HTTP ${created.status}).`);
}

async function putFile(fetchImpl, pat, repo, rel, content, message) {
  const enc = Buffer.from(content).toString('base64');
  let sha;
  const existing = await api(fetchImpl, pat, repo, `/contents/${rel}?ref=${BRANCH}`, { allow404: true });
  if (existing.status === 200) sha = (await existing.json()).sha;
  const r = await api(fetchImpl, pat, repo, `/contents/${rel}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: enc, branch: BRANCH, ...(sha ? { sha } : {}) }),
  });
  if (!r.ok) throw new Error(`Could not write ${rel} (HTTP ${r.status}).`);
}

// Pushes any allow-listed file that changed since the last push (tracked in
// .push-state.json inside agentDir). Returns {pushed:[...], skipped, errors:[...]}.
async function pushLearned({ agentDir, repo, pat, fetchImpl = fetch, candidates }) {
  if (!pat || !repo) return { pushed: [], skipped: 0, errors: ['GitHub token or repo not configured'] };
  const stateFile = path.join(agentDir, '.push-state.json');
  let state = {};
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* first push */ }

  const files = (candidates || []).filter(isAllowed);
  const res = { pushed: [], skipped: 0, errors: [] };
  if (!files.length) return res;

  let branchReady = false;
  for (const rel of files) {
    const full = path.join(agentDir, rel);
    let content;
    try { content = fs.readFileSync(full, 'utf8'); } catch { res.skipped++; continue; }
    const hash = String(content.length) + ':' + content.slice(0, 40);
    if (state[rel] === hash) { res.skipped++; continue; }
    try {
      if (!branchReady) { await ensureBranch(fetchImpl, pat, repo); branchReady = true; }
      await putFile(fetchImpl, pat, repo, rel, content, `agent: learned ${rel}`);
      state[rel] = hash;
      res.pushed.push(rel);
    } catch (e) { res.errors.push(`${rel}: ${e.message}`); }
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
  return res;
}

// Lists files under agentDir that pushLearned is allowed to push (skills/*.md,
// tools-imported/self-authored/*.js, memory/SELF.md), as repo-relative paths.
function listCandidates(agentDir) {
  const out = [];
  try { for (const f of fs.readdirSync(path.join(agentDir, 'skills'))) if (f.endsWith('.md')) out.push(`skills/${f}`); } catch { /* none */ }
  try { for (const f of fs.readdirSync(path.join(agentDir, 'tools-imported', 'self-authored'))) if (f.endsWith('.js')) out.push(`tools-imported/self-authored/${f}`); } catch { /* none */ }
  if (fs.existsSync(path.join(agentDir, 'memory', 'SELF.md'))) out.push('memory/SELF.md');
  return out;
}

module.exports = { pushLearned, listCandidates, isAllowed, BRANCH };
