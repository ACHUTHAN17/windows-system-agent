// Skill health auditor — the agent THINKS about its own skills and ACTS.
// Zero deps, keyless. For every skill: structure check, tool-name check
// (backticked tokens vs real tools/skills), sampled link check. Writes
// memory/skill-health.md (committed) with verdicts. Never edits skills
// itself — reports precisely so the next refresh cycle can fix.
// Env: MAX_LINKS (default 25), LINK_TIMEOUT_MS (default 8000).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SKILLS = path.join(ROOT, 'skills');
const OUT = path.join(ROOT, 'memory', 'skill-health.md');
const MAX_LINKS = Math.min(Number(process.env.MAX_LINKS || 25), 60);

// In-harness + chat tools that are valid references though not standalone tools.
const HARNESS_TOOLS = new Set(('win_sysinfo win_file_list win_file_read win_file_fetch win_file_write win_file_edit win_app_list win_app_launch win_app_kill win_shell win_sudo win_screenshot win_service_list win_reg_read win_type win_key win_drag win_window win_clipboard win_ui_list win_ui_invoke win_scroll win_mouse_move win_double_click win_wait read_image read place present skill web_search web_fetch').split(' '));

function toolNames() {
  const names = new Set();
  try {
    const t = fs.readFileSync(path.join(ROOT, 'src', 'tools.js'), 'utf8');
    for (const m of t.matchAll(/      name: '([^']+)'/g)) names.add(m[1]);
  } catch {}
  try {
    for (const f of fs.readdirSync(SKILLS)) if (f.endsWith('.md')) names.add(f.replace(/\.md$/, ''));
  } catch {}
  return names;
}

async function checkLink(url, ms) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: c.signal, headers: { 'User-Agent': 'WinAgent-audit/1.0' } });
    clearTimeout(t);
    if (r.status === 405 || r.status === 501) {
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), ms);
      const r2 = await fetch(url, { method: 'GET', redirect: 'follow', signal: c2.signal, headers: { 'User-Agent': 'WinAgent-audit/1.0', Range: 'bytes=0-0' } });
      clearTimeout(t2);
      return r2.status;
    }
    return r.status;
  } catch (e) { return 'ERR:' + (e.cause ? e.cause.code || e.message : e.message); }
}

async function main() {
  const tools = toolNames();
  const files = fs.readdirSync(SKILLS).filter(f => f.endsWith('.md')).sort();
  const rows = [];
  const linkQueue = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(SKILLS, f), 'utf8');
    const issues = [];
    if (!/^# Skill:/m.test(text)) issues.push('missing `# Skill:` title');
    if (text.length < 300) issues.push(`too thin (${text.length} chars)`);
    if (!/^## /m.test(text)) issues.push('no sections at all');
    const unknown = new Set();
    for (const m of text.matchAll(/`([a-z][a-z0-9_-]{2,40})`/g)) {
      const tok = m[1];
      if (tools.has(tok) || HARNESS_TOOLS.has(tok) || tok.startsWith('mcp_')) continue;
      if (!/^(GET|POST|PUT|http|www|com|org|net|io|md|json|url|api|id|ok)$/.test(tok)) unknown.add(tok);
    }
    const talks = [...unknown].filter(t => /^[a-z]+_[a-z_]+$/.test(t) || (tools.size && [...tools].some(x => x.includes(t) || t.includes(x))));
    if (talks.length) issues.push(`unknown tool refs: ${talks.slice(0, 6).join(', ')}`);
    const urls = [...new Set([...text.matchAll(/https?:\/\/[^\s)>"']+/g)].map(m => m[0].replace(/[.,;`]+$/, '')))].slice(0, 3);
    for (const u of urls) {
      if (/^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u)) continue; // local-only URL, not probed
      linkQueue.push({ file: f, url: u });
    }
    rows.push({ file: f, chars: text.length, issues, links: urls });
  }
  const ms = Number(process.env.LINK_TIMEOUT_MS || 8000);
  const checked = linkQueue.slice(0, MAX_LINKS);
  let broken = 0;
  for (const q of checked) {
    q.status = await checkLink(q.url, ms);
    if (!(q.status >= 200 && q.status < 400)) {
      broken++;
      const row = rows.find(r => r.file === q.file);
      if (row) row.issues.push(`dead link (${q.status}): ${q.url.slice(0, 70)}`);
    }
  }
  const bad = rows.filter(r => r.issues.length);
  const date = new Date().toISOString().slice(0, 10);
  const md = `# Skill health — ${date}\n\n${files.length} skills audited, ${checked.length} links probed, ${broken} dead.\n${bad.length ? `${bad.length} need attention:\n` : 'All healthy.\n'}` +
    bad.map(r => `\n## ${r.file} (${r.chars} chars)\n` + r.issues.map(i => `- ${i}`).join('\n')).join('\n') +
    `\n\n_Audited automatically. Fix via refresh cycles or chat-teach._\n`;
  fs.mkdirSync(path.join(ROOT, 'memory'), { recursive: true });
  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`[audit] ${files.length} skills, ${bad.length} need attention, ${broken} dead links -> memory/skill-health.md`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `bad=${bad.length}\nbroken=${broken}\n`);
}

main().catch(e => { console.error('[audit] FATAL: ' + (e.message || e)); process.exit(1); });
