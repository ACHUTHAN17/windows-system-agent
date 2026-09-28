'use strict';
const fs = require('node:fs');
const path = require('node:path');

const REPO = 'ACHUTHAN17/windows-system-agent';
const BRANCH = 'main';
const MAX_FILE = 1.5 * 1024 * 1024;
const MAX_MEMORY_LINES = 40;

// What may be pulled. NEVER: tools-imported/ (LLM-authored code from the cloud chat must not
// auto-run on your PC), .env, config.json, runs/. Engine code (src/) only on explicit opt-in.
function wanted(p, { includeEngine, syncMemory }) {
  if (p.includes('..') || /^(tools-imported|runs|\.github|WinAgentApp|desktop)\//.test(p)) return false;
  if (/(^|\/)(\.env|config\.json)$/.test(p)) return false;
  if (p.startsWith('skills/') || p.startsWith('docs/')) return true;
  if (p.startsWith('memory/')) return !!syncMemory;
  if (includeEngine && (p.startsWith('src/') || p === 'package.json')) return true;
  return false;
}

const bullet = (l) => /^\s*[-*]\s+\S/.test(l);

// Memory is merged, never overwritten: local notes always survive a sync.
function mergeMemory(rel, localText, remoteText) {
  const name = path.basename(rel);
  if (name === 'skill-health.md') return { text: remoteText, added: 0 };            // generated report
  if (localText == null) return { text: remoteText, added: remoteText.split('\n').filter(bullet).length };
  if (name === 'SELF.md') {
    const pick = (t) => t.split('\n').filter(l => l.startsWith('- ['));
    const all = [...new Set([...pick(localText), ...pick(remoteText)])].sort();
    const added = all.length - pick(localText).length;
    return { text: '# SELF.md — what I have learned / built for myself (auto-maintained, do not hand-edit)\n\n' + all.slice(-60).join('\n') + '\n', added };
  }
  const have = new Set(localText.split('\n').map(l => l.trim()));
  const fresh = remoteText.split('\n').filter(l => bullet(l) && !have.has(l.trim()) && l.length <= 300).slice(0, MAX_MEMORY_LINES);
  if (!fresh.length) return { text: localText, added: 0 };
  const sep = localText.endsWith('\n') ? '' : '\n';
  return { text: `${localText}${sep}\n<!-- synced from GitHub ${new Date().toISOString().slice(0, 10)} -->\n${fresh.join('\n')}\n`, added: fresh.length };
}

async function getJson(fetchImpl, url) {
  const r = await fetchImpl(url, { headers: { 'User-Agent': 'WinAgent-Desktop', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20000) });
  if (r.status === 403 || r.status === 429) throw new Error('GitHub rate limit reached — try again in a few minutes.');
  if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
  return r.json();
}

async function syncFromGitHub({ agentDir, includeEngine = false, syncMemory = true, fetchImpl = fetch, onProgress = () => {} }) {
  const stateFile = path.join(agentDir, '.sync-state.json');
  let state = { shas: {} };
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* first sync */ }
  state.shas = state.shas || {};

  onProgress('Checking GitHub…');
  const tree = await getJson(fetchImpl, `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`);
  const files = (tree.tree || []).filter(n => n.type === 'blob' && n.size <= MAX_FILE && wanted(n.path, { includeEngine, syncMemory }));
  const todo = files.filter(n => state.shas[n.path] !== n.sha || !fs.existsSync(path.join(agentDir, n.path)));

  const res = { checked: files.length, updated: 0, skills: 0, memoryLinesAdded: 0, engine: 0, errors: [] };
  let done = 0;
  const root = path.resolve(agentDir) + path.sep;

  async function one(n) {
    const dest = path.resolve(agentDir, n.path);
    if (!dest.startsWith(root)) throw new Error('unsafe path ' + n.path);
    const r = await fetchImpl(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${n.path.split('/').map(encodeURIComponent).join('/')}`,
      { headers: { 'User-Agent': 'WinAgent-Desktop' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (n.path.startsWith('memory/') && n.path.endsWith('.md')) {
      let local = null;
      try { local = fs.readFileSync(dest, 'utf8'); } catch { /* new file */ }
      const m = mergeMemory(n.path, local, buf.toString('utf8'));
      if (m.text !== local) fs.writeFileSync(dest, m.text, 'utf8');
      res.memoryLinesAdded += m.added;
    } else {
      fs.writeFileSync(dest, buf);
      if (n.path.startsWith('skills/') && n.path.endsWith('.md')) res.skills++;
      if (n.path.startsWith('src/') || n.path === 'package.json') res.engine++;
    }
    state.shas[n.path] = n.sha;
    res.updated++;
  }

  const queue = todo.slice();
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const n = queue.shift();
      try { await one(n); } catch (e) { res.errors.push(`${n.path}: ${e.message}`); }
      onProgress(`Syncing… ${++done}/${todo.length}`);
    }
  });
  await Promise.all(workers);
  fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8');
  res.at = new Date().toISOString();
  return res;
}

module.exports = { syncFromGitHub, mergeMemory, wanted, REPO };
