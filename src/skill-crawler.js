// Skill crawler: learns ALREADY-AVAILABLE skills from OTHER GitHub repos.
// Bulk mode: imports EVERYTHING new it finds (up to MAX), then scans AGAIN
// with a fresh discovery query (rescan rounds) until nothing new appears.
// Runs on Actions (no human). Provenance in skills/sources.json.
// Env: MAX_IMPORT (default 10), SEED_REPOS (comma, opt).
import fs from 'node:fs';
import path from 'node:path';
import { logSelf } from './self-log.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SKILLS = path.join(ROOT, 'skills');
const SOURCES = path.join(SKILLS, 'sources.json');
const MAX = Math.min(Number(process.env.MAX_IMPORT || 10), 20);

const SEEDS = (process.env.SEED_REPOS || 'anthropics/skills,obra/superpowers,travisvn/awesome-claude-skills').split(',').map(s => s.trim()).filter(Boolean);
const OWNER = process.env.CRAWL_OWNER || 'ACHUTHAN17';

// Owner's own repos FIRST — the user's `skills` repo is a curated Agent Skills
// collection, so it outranks every seed. Skips archived and the agent repo itself.
async function ownerRepos() {
  const out = [];
  try {
    const repos = await gh(`/users/${OWNER}/repos?per_page=30&sort=updated`);
    for (const r of repos || []) {
      if (r.archived || r.full_name === 'ACHUTHAN17/windows-system-agent') continue;
      out.push(r.full_name);
    }
  } catch (e) { console.log('[crawl] owner repos skipped: ' + e.message); }
  return out;
}

const gh = async (p) => {
  const r = await fetch(`https://api.github.com${p}`, { headers: { 'User-Agent': 'WinAgent-crawler/1.0' } });
  if (r.status === 403) throw new Error('github api rate-limited (60/h keyless) — try later');
  if (!r.ok) throw new Error(`github HTTP ${r.status}: ${p.slice(0, 80)}`);
  return r.json();
};

function loadSources() {
  try { return JSON.parse(fs.readFileSync(SOURCES, 'utf8')); } catch { return {}; }
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'skill';
}

function adapt(name, md, repo, filePath) {
  let text = String(md || '');
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  let desc = '';
  if (fm) {
    const d = fm[1].match(/description:\s*(.+)/);
    if (d) desc = d[1].trim().slice(0, 200);
    text = text.slice(fm[0].length);
  }
  text = text.slice(0, 8000).trim();
  if (text.length < 300) return null;
  return `# Skill: ${name}\n\nImported from [${repo}](https://github.com/${repo}/blob/HEAD/${filePath})${desc ? ` — ${desc}` : ''}.\nAdapted to WinAgent tools where possible; verify tool names before use.\n\n${text}\n`;
}

async function candidatesFromRepo(repo) {
  const out = [];
  try {
    const tree = await gh(`/repos/${repo}/git/trees/HEAD?recursive=1`);
    const blobs = (tree.tree || []).filter(n => n.type === 'blob' && /(^|\/)(SKILL\.md|skill\.md)$/.test(n.path));
    for (const b of blobs.slice(0, 8)) out.push({ repo, path: b.path });
  } catch (e) { console.log(`[crawl] skip ${repo}: ${e.message}`); }
  return out;
}

const DISCOVERY_QUERIES = [
  'claude+skills+awesome+in:name',
  'ai+agent+skills+playbooks+in:name',
  'mcp+awesome+servers+in:name',
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
  } catch (e) { console.log('[crawl] discovery skipped: ' + e.message); }
  return found;
}

async function main() {
  const sources = loadSources();
  const have = new Set(fs.readdirSync(SKILLS).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')));
  let done = [];
  // Rescan rounds: fresh discovery query each round until nothing new or cap.
  for (let round = 0; round < 3 && done.length < MAX; round++) {
    const repos = round === 0 ? [...await ownerRepos(), ...SEEDS, ...await discoverRepos(0)] : await discoverRepos(round);
    console.log(`[crawl] round ${round + 1}: scanning ${repos.length} repos`);
    let roundNew = 0;
    for (const repo of repos.slice(0, 5)) {
      for (const c of await candidatesFromRepo(repo)) {
        if (done.length >= MAX) break;
        const dir = c.path.split('/').slice(-2, -1)[0] || c.path;
        const slug = slugify(dir.replace(/\.md$/, ''));
        if (!slug || have.has(slug) || done.find(d => d.slug === slug)) continue;
        try {
          const blob = await gh(`/repos/${repo}/git/blobs/${(await gh(`/repos/${repo}/contents/${c.path}`)).sha}`);
          const md = Buffer.from(blob.content, 'base64').toString('utf8');
          const adapted = adapt(slug, md, repo, c.path);
          if (!adapted) continue;
          fs.writeFileSync(path.join(SKILLS, slug + '.md'), adapted, 'utf8');
          sources[slug + '.md'] = { origin: 'imported', repo: `https://github.com/${repo}`, file: c.path, at: new Date().toISOString().slice(0, 10) };
          have.add(slug);
          done.push({ slug, repo });
          roundNew++;
          console.log(`[crawl] IMPORTED ${slug}.md from ${repo}/${c.path}`);
          logSelf(ROOT, `learned skill "${slug}" from ${repo}/${c.path}`);
        } catch (e) { console.log(`[crawl] skip ${c.path}: ${e.message}`); }
      }
      if (done.length >= MAX) break;
    }
    if (roundNew === 0) { console.log('[crawl] round found nothing new — stopping'); break; }
  }
  fs.writeFileSync(SOURCES, JSON.stringify(sources, null, 2), 'utf8');
  console.log(`[crawl] done: ${done.length} imported`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `imported=${done.map(d => d.slug).join(',')}\n`);
}

main().catch(e => { console.error('[crawl] FATAL: ' + (e.message || e)); process.exit(1); });
