// Shared staging helpers for tool discovery. Both src/tool-crawler.js
// (GitHub repo search) and src/tool-web-scout.js (general web search) funnel
// everything they find through THIS module, so there is exactly one place
// that ever writes a discovered tool to disk — and it only ever writes under
// tools-imported/candidates/, never src/tools.js. See tools-imported/README.md
// for why tools (executable code) are treated differently from skills (inert
// markdown) and require a manual, read-it-first promotion step.
import fs from 'node:fs';
import path from 'node:path';
import { logSelf } from './self-log.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
export const STAGE = path.join(ROOT, 'tools-imported', 'candidates');
export const SOURCES = path.join(STAGE, 'sources.json');

export const gh = async (p) => {
  const r = await fetch(`https://api.github.com${p}`, { headers: { 'User-Agent': 'WinAgent-tool-discovery/1.0' } });
  if (r.status === 403) throw new Error('github api rate-limited (60/h keyless) — try later');
  if (!r.ok) throw new Error(`github HTTP ${r.status}: ${p.slice(0, 80)}`);
  return r.json();
};

export function loadSources() {
  try { return JSON.parse(fs.readFileSync(SOURCES, 'utf8')); } catch { return {}; }
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tool';
}

export function existingSlugs() {
  try { fs.mkdirSync(STAGE, { recursive: true }); return new Set(fs.readdirSync(STAGE).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, ''))); }
  catch { return new Set(); }
}

// A "candidate" is any .js file whose contents look like they follow the
// WinAgent tool contract: { name, description, args, run(args, ctx) }.
// This is a heuristic filter, not a security check — everything staged here
// still needs a human read before it ever runs.
export function looksLikeTool(text) {
  if (!text || text.length > 20000) return false;
  return /description\s*:/.test(text) && /run\s*\(\s*[a-zA-Z_$]/.test(text) && /name\s*:/.test(text);
}

export async function candidatesFromRepo(repo, log) {
  const out = [];
  try {
    const tree = await gh(`/repos/${repo}/git/trees/HEAD?recursive=1`);
    const blobs = (tree.tree || []).filter(n => n.type === 'blob' && /\.js$/.test(n.path) && !/node_modules\//.test(n.path) && n.size && n.size < 20000);
    for (const b of blobs.slice(0, 20)) out.push({ repo, path: b.path });
  } catch (e) { (log || console.log)(`skip ${repo}: ${e.message}`); }
  return out;
}

export function ensureReadme() {
  const p = path.join(ROOT, 'tools-imported', 'README.md');
  if (fs.existsSync(p)) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `# Imported tool candidates — REVIEW BEFORE USE\n\n` +
    `Everything under `+'`candidates/`'+` was found automatically — by `+'`src/tool-crawler.js`'+` (GitHub\n` +
    `repo search) or `+'`src/tool-web-scout.js`'+` (general web search) — and is **staged only**:\n` +
    `none of it is loaded by the agent and none of it runs.\n\n` +
    `A tool is executable code that runs with the agent's full privileges (files, shell,\n` +
    `registry, browser). Unlike skills (inert markdown), a tool candidate must be read and\n` +
    `understood by a person before it is trusted.\n\n` +
    `## Promoting a candidate to a real tool\n` +
    `1. Open the file under `+'`candidates/`'+` and read every line — treat it as untrusted input.\n` +
    `2. Check `+'`candidates/sources.json`'+` for provenance (source repo/URL + \`found_via\`: github-search or web-search).\n` +
    `3. If it's genuinely useful, hand-port the logic into a tool block in `+'`src/tools.js`'+`\n` +
    `   following the contract in ARCHITECTURE.md (` + '`{ name, description, args, run(args, {cfg}) }`' + `),\n` +
    `   adjusting paths/approvals/safety checks to match this repo's conventions.\n` +
    `4. Add a selftest entry, run ` + '`node src/index.js --selftest`' + `, then delete the staged file.\n` +
    `5. Never copy-paste a candidate straight into tools.js unread — that reintroduces the\n` +
    `   exact risk this staging step exists to avoid.\n`, 'utf8');
}

// Fetches one file from `repo` at `filePath`, checks it against looksLikeTool,
// and if it matches, writes it under STAGE with a provenance header + a
// sources.json entry. Returns the staged slug, or null if skipped.
// `sources`/`have` are mutated in place so callers can batch many calls
// before doing a single writeSources() at the end.
export async function stageCandidateFromRepo(repo, filePath, sources, have, meta = {}) {
  const base = filePath.split('/').pop().replace(/\.js$/, '');
  const slug = slugify(base);
  if (!slug || have.has(slug)) return null;
  const fileMeta = await gh(`/repos/${repo}/contents/${filePath}`);
  const blob = await gh(`/repos/${repo}/git/blobs/${fileMeta.sha}`);
  const text = Buffer.from(blob.content, 'base64').toString('utf8');
  if (!looksLikeTool(text)) return null;
  const header = `// CANDIDATE TOOL — staged automatically, NOT loaded by the agent.\n` +
    `// Source: https://github.com/${repo}/blob/HEAD/${filePath}\n` +
    (meta.foundVia === 'web-search' ? `// Found via web search: ${meta.query || ''}\n` : '') +
    `// Read tools-imported/README.md before touching this file.\n\n`;
  fs.mkdirSync(STAGE, { recursive: true });
  fs.writeFileSync(path.join(STAGE, slug + '.js'), header + text, 'utf8');
  sources[slug + '.js'] = {
    origin: 'imported',
    repo: `https://github.com/${repo}`,
    file: filePath,
    found_via: meta.foundVia || 'github-search',
    query: meta.query || undefined,
    at: new Date().toISOString().slice(0, 10),
    status: 'pending-review',
  };
  have.add(slug);
  logSelf(ROOT, `found candidate tool "${slug}" via ${meta.foundVia || 'github-search'} (${repo}) — staged, pending human review`);
  return slug;
}

export function writeSources(sources) {
  fs.mkdirSync(STAGE, { recursive: true });
  fs.writeFileSync(SOURCES, JSON.stringify(sources, null, 2), 'utf8');
}
