// Tool crawler: finds CANDIDATE tool modules in other GitHub repos (via
// GitHub's repo/code search) and stages them for human review. Discovery
// logic mirrors skill-crawler.js; the actual staging (write + provenance +
// safety README) lives in tool-stage.js and is shared with tool-web-scout.js
// so there is exactly one place that ever writes a discovered tool to disk.
// Runs on Actions (no human needed for the crawl itself). Zero dependencies.
// Env: MAX_IMPORT (default 10, max 20), SEED_REPOS (comma, opt), CRAWL_OWNER (opt).
import fs from 'node:fs';
import { gh, loadSources, existingSlugs, candidatesFromRepo, ensureReadme, stageCandidateFromRepo, writeSources } from './tool-stage.js';

const MAX = Math.min(Number(process.env.MAX_IMPORT || 10), 20);
const SEEDS = (process.env.SEED_REPOS || 'ACHUTHAN17/windows-system-agent-tools').split(',').map(s => s.trim()).filter(Boolean);
const OWNER = process.env.CRAWL_OWNER || 'ACHUTHAN17';

// Owner's own repos first — same priority order as skill-crawler.js.
async function ownerRepos() {
  const out = [];
  try {
    const repos = await gh(`/users/${OWNER}/repos?per_page=30&sort=updated`);
    for (const r of repos || []) {
      if (r.archived || r.full_name === 'ACHUTHAN17/windows-system-agent') continue;
      out.push(r.full_name);
    }
  } catch (e) { console.log('[tool-crawl] owner repos skipped: ' + e.message); }
  return out;
}

const DISCOVERY_QUERIES = [
  'winagent+tool+in:path',
  'agent+tool+zero-dependency+node+in:readme',
  'llm+agent+tools+cli+node+in:name',
];

async function discoverRepos(round) {
  const found = [];
  try {
    const q = DISCOVERY_QUERIES[round % DISCOVERY_QUERIES.length];
    const j = await gh(`/search/repositories?q=${q}&sort=stars&order=desc&per_page=8`);
    for (const r of j.items || []) {
      if (!SEEDS.includes(r.full_name)) found.push(r.full_name);
      if (found.length >= 3) break;
    }
  } catch (e) { console.log('[tool-crawl] discovery skipped: ' + e.message); }
  return found;
}

export async function main() {
  ensureReadme();
  const sources = loadSources();
  const have = existingSlugs();
  let done = [];
  for (let round = 0; round < 3 && done.length < MAX; round++) {
    const repos = round === 0 ? [...await ownerRepos(), ...SEEDS, ...await discoverRepos(0)] : await discoverRepos(round);
    console.log(`[tool-crawl] round ${round + 1}: scanning ${repos.length} repos`);
    let roundNew = 0;
    for (const repo of repos.slice(0, 5)) {
      for (const c of await candidatesFromRepo(repo, m => console.log(`[tool-crawl] ${m}`))) {
        if (done.length >= MAX) break;
        try {
          const slug = await stageCandidateFromRepo(repo, c.path, sources, have, { foundVia: 'github-search' });
          if (!slug) continue;
          done.push({ slug, repo });
          roundNew++;
          console.log(`[tool-crawl] STAGED ${slug}.js from ${repo}/${c.path} (pending review)`);
        } catch (e) { console.log(`[tool-crawl] skip ${c.path}: ${e.message}`); }
      }
      if (done.length >= MAX) break;
    }
    if (roundNew === 0) { console.log('[tool-crawl] round found nothing new — stopping'); break; }
  }
  writeSources(sources);
  console.log(`[tool-crawl] done: ${done.length} staged for review`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `staged=${done.map(d => d.slug).join(',')}\n`);
}

// Import-safe: only auto-runs when this file is the process entry point, so
// tool-web-scout.js (and anything else) can import candidatesFromRepo-style
// helpers from tool-stage.js without triggering a second crawl.
if (process.argv[1] && process.argv[1].endsWith('tool-crawler.js')) {
  main().catch(e => { console.error('[tool-crawl] FATAL: ' + (e.message || e)); process.exit(1); });
}
