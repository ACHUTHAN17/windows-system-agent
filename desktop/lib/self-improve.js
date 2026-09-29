'use strict';
// Turns a staged self-improvement proposal (written by the `self_improve_propose` tool as
// agentDir/self-improvements/<id>.json — see src/tools.js) into a GitHub pull request.
// This is the "self-rewrite" pathway: fully automatic on this end, but it NEVER edits the
// running engine and NEVER touches main directly — it opens a branch + PR so a human
// reviews the change to the agent's own code before it takes effect. That review step is
// intentionally not skippable from here; see desktop/README.md for why.
const fs = require('node:fs');
const path = require('node:path');

async function api(fetchImpl, pat, repo, p, opts) {
  const r = await fetchImpl(`https://api.github.com/repos/${repo}${p}`, {
    ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', ...(opts && opts.headers) },
    signal: AbortSignal.timeout(20000),
  });
  if (r.status === 401) throw new Error('GitHub rejected the token (401) — check it has the "repo" scope.');
  return r;
}

function pendingProposals(agentDir) {
  const dir = path.join(agentDir, 'self-improvements');
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch { return []; }
  const out = [];
  for (const f of files) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (p.status === 'pending-review' && p.targetFile && p.newContent) out.push({ file: f, ...p });
    } catch { /* skip unreadable */ }
  }
  return out;
}

function markSubmitted(agentDir, file, patch) {
  const p = path.join(agentDir, 'self-improvements', file);
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    fs.writeFileSync(p, JSON.stringify({ ...j, ...patch }, null, 2), 'utf8');
  } catch { /* best effort */ }
}

// Opens one PR per pending proposal. Returns {opened:[{file,url}], errors:[...]}.
async function submitPending({ agentDir, repo, pat, fetchImpl = fetch }) {
  const res = { opened: [], errors: [] };
  if (!pat || !repo) return res;
  for (const prop of pendingProposals(agentDir)) {
    try {
      const main = await api(fetchImpl, pat, repo, '/git/ref/heads/main');
      if (!main.ok) throw new Error(`could not read main (HTTP ${main.status})`);
      const baseSha = (await main.json()).object.sha;
      const branch = `self-improve/${prop.file.replace(/\.json$/, '')}`;
      const ref = await api(fetchImpl, pat, repo, '/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }) });
      if (!ref.ok && ref.status !== 422) throw new Error(`could not create branch (HTTP ${ref.status})`);

      let sha;
      const existing = await api(fetchImpl, pat, repo, `/contents/${prop.targetFile}?ref=${branch}`);
      if (existing.status === 200) sha = (await existing.json()).sha;
      const put = await api(fetchImpl, pat, repo, `/contents/${prop.targetFile}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `self-improve: ${prop.targetFile}`,
          content: Buffer.from(prop.newContent).toString('base64'),
          branch, ...(sha ? { sha } : {}),
        }),
      });
      if (!put.ok) throw new Error(`could not write ${prop.targetFile} (HTTP ${put.status})`);

      const pr = await api(fetchImpl, pat, repo, '/pulls', {
        method: 'POST',
        body: JSON.stringify({
          title: `Self-improvement proposal: ${prop.targetFile}`,
          head: branch, base: 'main',
          body: `Proposed by the agent itself (\`self_improve_propose\`), on ${prop.createdAt}.\n\n`
            + `**This was NOT applied to the running engine and is not merged.** Review the diff below `
            + `before merging — this file controls the agent's own behavior.\n\n---\n\n${prop.rationale}`,
        }),
      });
      if (!pr.ok) throw new Error(`could not open PR (HTTP ${pr.status})`);
      const url = (await pr.json()).html_url;
      markSubmitted(agentDir, prop.file, { status: 'submitted', prUrl: url, submittedAt: new Date().toISOString() });
      res.opened.push({ file: prop.file, url });
    } catch (e) { res.errors.push(`${prop.targetFile || prop.file}: ${e.message}`); }
  }
  return res;
}

module.exports = { submitPending, pendingProposals };
