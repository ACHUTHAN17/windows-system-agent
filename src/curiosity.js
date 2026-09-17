// Curiosity engine: the agent picks its OWN interests on GitHub.
// No human queue — scans Hacker News top stories, trending new repos, and this
// repo's open issues, scores them against what the agent is FOR, and outputs
// 1-2 topics worth learning. Zero dependencies, keyless public APIs.
// Output: TOPICS_JSON=[...] in $GITHUB_OUTPUT + console. Excludes anything
// that already has a skill file (those go through refresh instead).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const REPO = process.env.SKILL_REPO || 'ACHUTHAN17/windows-system-agent';
const MAX = Math.min(Number(process.env.MAX_TOPICS || 2), 3);

// What the agent is FOR — topics matching these are interesting.
const HUNGRY = ['windows', 'automat', 'office', 'document', 'excel', 'word', 'powerpoint', 'pdf', 'browser', 'node', 'cli', 'skill', 'agent', 'mcp', 'github', 'telegram', 'ocr', 'spreadsheet', 'slides', 'notion', 'gmail', 'calendar', 'terminal', 'powershell', 'shortcut', 'clipboard', 'screenshot'];

function score(text) {
  const t = String(text || '').toLowerCase();
  let s = 0;
  for (const k of HUNGRY) if (t.includes(k)) s += 2;
  if (/tutorial|guide|how.to|show hn|launch/i.test(t)) s += 1;
  if (/politic|sport|celebrity|meme|nsfw/i.test(t)) s -= 10;
  return s;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function existingSlugs() {
  try {
    return new Set(fs.readdirSync(path.join(ROOT, 'skills')).map(f => f.replace(/\.md$/, '')));
  } catch { return new Set(); }
}

async function hn() {
  const out = [];
  try {
    const ids = await (await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')).json();
    for (const id of (ids || []).slice(0, 25)) {
      try {
        const it = await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json();
        if (it && it.title) out.push({ src: 'hn', title: it.title, url: it.url || `https://news.ycombinator.com/item?id=${id}`, score: score(it.title) });
      } catch {}
      if (out.length >= 12) break;
    }
  } catch (e) { console.log('[curious] hn unreachable: ' + e.message); }
  return out;
}

async function trending() {
  const out = [];
  try {
    const week = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const r = await fetch(`https://api.github.com/search/repositories?q=created:>${week}&sort=stars&order=desc&per_page=15`, { headers: { 'User-Agent': 'WinAgent-curiosity/1.0' } });
    if (!r.ok) { console.log('[curious] trending HTTP ' + r.status); return out; }
    const j = await r.json();
    for (const repo of j.items || []) {
      const t = `${repo.name} ${repo.description || ''}`;
      out.push({ src: 'trending', title: t.slice(0, 140), url: repo.html_url, score: score(t) + 1 });
    }
  } catch (e) { console.log('[curious] trending unreachable: ' + e.message); }
  return out;
}

async function repoIssues() {
  const out = [];
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/issues?state=open&per_page=20`, { headers: { 'User-Agent': 'WinAgent-curiosity/1.0' } });
    if (!r.ok) return out;
    const j = await r.json();
    for (const is of j || []) {
      if (is.pull_request) continue;
      const t = `${is.title} ${is.body || ''}`.slice(0, 200);
      out.push({ src: 'issue', title: t.slice(0, 140), url: is.html_url, score: score(t) + 3 });
    }
  } catch {}
  return out;
}

async function main() {
  const have = existingSlugs();
  const all = [...await hn(), ...await trending(), ...await repoIssues()];
  const seen = new Set();
  const picks = [];
  for (const c of all.sort((a, b) => b.score - a.score)) {
    if (c.score < 2) continue;
    const slug = slugify(c.title);
    if (!slug || seen.has(slug) || have.has(slug)) continue;
    seen.add(slug);
    picks.push({ topic: c.title, slug, reason: `${c.src} (relevance ${c.score})`, url: c.url });
    if (picks.length >= MAX) break;
  }
  console.log(`[curious] scanned ${all.length} candidates -> ${picks.length} interests`);
  for (const p of picks) console.log(`[curious] INTEREST: ${p.topic} [${p.slug}] (${p.reason})`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `topics=${JSON.stringify(picks)}\n`);
  console.log('TOPICS_JSON=' + JSON.stringify(picks));
}

main().catch(e => { console.error('[curious] FATAL: ' + (e.message || e)); process.exit(1); });
