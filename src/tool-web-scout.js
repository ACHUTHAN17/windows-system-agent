// Tool web-scout: finds candidate tool repos via general web search (not
// GitHub's search API — a different discovery surface, so it turns up things
// GitHub code/repo search misses: blog posts, "awesome" lists, directories,
// launch posts). Extracts any GitHub repos those pages point to, then reuses
// the exact same staging path as tool-crawler.js (tool-stage.js) — so this
// script ALSO never writes anything runnable. Everything lands in
// tools-imported/candidates/ pending human review.
// Runs on Actions, same schedule as repo-crawl (skill-crawler.js +
// tool-crawler.js). Zero dependencies, keyless DuckDuckGo HTML search.
// Env: MAX_IMPORT (default 10, max 20).
import fs from 'node:fs';
import { candidatesFromRepo, ensureReadme, existingSlugs, loadSources, stageCandidateFromRepo, writeSources } from './tool-stage.js';

const MAX = Math.min(Number(process.env.MAX_IMPORT || 10), 20);

// Rotates by day-of-year so a daily run doesn't repeat the same search twice
// in a row, without needing any state between runs.
const QUERIES = [
  'new open source agentic AI tool node.js github',
  'LLM agent tool function calling example code github',
  'awesome AI agent tools list github',
  'MCP tool server example implementation github',
  'zero dependency node.js automation agent tool github',
];

function todayQuery() {
  const day = Math.floor(Date.now() / 864e5);
  return QUERIES[day % QUERIES.length];
}

async function webSearch(query, max = 8) {
  const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WinAgent-tool-scout/1.0)' },
  });
  if (!res.ok) throw new Error('search HTTP ' + res.status);
  const html = await res.text();
  const linkRe = new RegExp('result__a[^>]*href="([^"]*)"[^>]*>([^]*?)</' + 'a>', 'gi');
  const out = [];
  let m;
  while ((m = linkRe.exec(html)) !== null && out.length < max) {
    let url = m[1];
    const ud = url.match(/[?&]uddg=([^&]+)/);
    if (ud) { try { url = decodeURIComponent(ud[1]); } catch {} }
    if (!/^https?:\/\//.test(url)) continue;
    out.push(url);
  }
  return out;
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WinAgent-tool-scout/1.0)' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return '';
    return await res.text();
  } catch { return ''; }
}

const SKIP_REPO = new Set(['features', 'topics', 'marketplace', 'sponsors', 'about', 'pricing', 'login', 'join', 'orgs', 'settings', 'notifications', 'issues', 'pulls', 'search', 'explore', 'trending', 'collections', 'apps']);

// Pulls owner/repo pairs out of raw HTML (not text-stripped — hrefs live in
// tag attributes, so this has to run before any tag-stripping step).
function extractGithubRepos(html) {
  const out = new Set();
  const re = /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const owner = m[1], repo = m[2].replace(/\.git$/, '');
    if (SKIP_REPO.has(owner.toLowerCase()) || SKIP_REPO.has(repo.toLowerCase())) continue;
    out.add(`${owner}/${repo}`);
  }
  return [...out];
}

async function main() {
  ensureReadme();
  const sources = loadSources();
  const have = existingSlugs();
  const query = todayQuery();
  console.log(`[tool-scout] query: ${query}`);
  let hits = [];
  try { hits = await webSearch(query, 8); } catch (e) { console.log('[tool-scout] search failed: ' + e.message); return; }
  console.log(`[tool-scout] ${hits.length} search hits`);

  const repos = new Set();
  for (const url of hits) extractGithubRepos(url).forEach(r => repos.add(r));
  for (const url of hits.slice(0, 5)) {
    if (repos.size >= 12) break;
    const html = await fetchHtml(url);
    extractGithubRepos(html).forEach(r => repos.add(r));
  }
  console.log(`[tool-scout] ${repos.size} candidate repos found via web`);

  let done = [];
  for (const repo of [...repos].slice(0, 8)) {
    if (done.length >= MAX) break;
    for (const c of await candidatesFromRepo(repo, m => console.log(`[tool-scout] ${m}`))) {
      if (done.length >= MAX) break;
      try {
        const slug = await stageCandidateFromRepo(repo, c.path, sources, have, { foundVia: 'web-search', query });
        if (!slug) continue;
        done.push({ slug, repo });
        console.log(`[tool-scout] STAGED ${slug}.js from ${repo}/${c.path} (pending review)`);
      } catch (e) { console.log(`[tool-scout] skip ${c.path}: ${e.message}`); }
    }
  }
  writeSources(sources);
  console.log(`[tool-scout] done: ${done.length} staged for review`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `staged=${done.map(d => d.slug).join(',')}\n`);
}

main().catch(e => { console.error('[tool-scout] FATAL: ' + (e.message || e)); process.exit(1); });
