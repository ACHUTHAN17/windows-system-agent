// Builds docs/index.html — the LIVE skills page — from skills/*.md. Zero deps.
// Usage: node src/build-docs.js   (run before every push that touches skills/)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SKILLS = path.join(ROOT, 'skills');
const OUT = path.join(ROOT, 'docs', 'index.html');

// Where each skill came from (shown as badges on the live page).
const LEARNED = {
  'computer-use.md': 'auto-learned from OpenAI Computer Use docs (live web research)',
  'github.md': 'auto-learned from GitHub docs + real push failures',
  'agent-modes.md': 'auto-learned from its own run modes + parallel discipline',
  'self-learn.md': 'auto-learned — the research-install-verify loop itself',
  'file-fetch-upload.md': 'auto-learned from locked-file + upload research',
  'windows-clipboard-history.md': 'auto-learned from Microsoft docs (chat request)',
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function miniMd(src) {
  const out = [];
  for (let line of String(src).split(/\r?\n/)) {
    if (/^# /.test(line)) { out.push(`<h2>${esc(line.slice(2))}</h2>`); continue; }
    if (/^##+ /.test(line)) { out.push(`<h3>${esc(line.replace(/^#+ /, ''))}</h3>`); continue; }
    if (!line.trim()) { out.push(''); continue; }
    let h = esc(line);
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    if (/^[-*] /.test(line.trim())) out.push(`<div class="li">${h}</div>`);
    else out.push(`<p>${h}</p>`);
  }
  return out.join('\n');
}

// True per-skill dates from git history (added = first appearance, updated =
// last touch). Deepens shallow clones first so CI dates are real; falls back
// to file mtime when git is unavailable.
function gitDates(f) {
  try {
    const added = spawnSync('git', ['log', '--diff-filter=A', '--format=%ci', '-1', '--', 'skills/' + f], { cwd: ROOT, encoding: 'utf8' }).stdout.trim().slice(0, 10);
    const updated = spawnSync('git', ['log', '--format=%ct', '-1', '--', 'skills/' + f], { cwd: ROOT, encoding: 'utf8' });
    const upd = updated.stdout ? new Date(Number(updated.stdout.trim()) * 1000).toISOString() : '';
    if (/^\d{4}-\d\d-\d\d$/.test(added) && /^\d{4}-\d\d-\d\dT/.test(upd)) return { added, updated: upd };
  } catch {}
  try {
    const d = fs.statSync(path.join(SKILLS, f)).mtime.toISOString().slice(0, 10);
    return { added: d, updated: d };
  } catch {}
  return { added: '', updated: '' };
}

function main() {
  try { spawnSync('git', ['fetch', 'origin', '--deepen=200', '--quiet'], { cwd: ROOT, timeout: 60000 }); } catch {}
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const files = fs.readdirSync(SKILLS).filter(f => f.endsWith('.md')).sort();
  let toolCount = 0;
  try {
    const t = fs.readFileSync(path.join(ROOT, 'src', 'tools.js'), 'utf8');
    toolCount = (t.match(/      name: '/g) || []).length;
  } catch {}
  let imported = {};
  try { imported = JSON.parse(fs.readFileSync(path.join(SKILLS, 'sources.json'), 'utf8')); } catch {}
  const originOf = (f) => imported[f] ? 'imported' : (LEARNED[f] ? 'auto' : 'task');
  // Skill router index: powers automatic selection (name/description/triggers).
  // Rebuilt on every docs build; fetched live by agents (SKILL_SOURCE=auto).
  const STOP = new Set('the,and,for,with,you,your,from,that,this,these,those,into,over,under,via,per,was,were,has,have,had,will,would,can,all,any,our,out,about,using,use,used,when,then,than,them,they,their,there,here,what,which,while,also,such,more,most,some,only,just,like,get,see,let,many,much,must,shall,should,could,does,did,done,each,other,same,too,very,own,both,how,now,off,once,its,not,but,are'.split(','));
  const MANUAL_TRIGGERS = {
    'computer-use': ['screenshot', 'click', 'pixel', 'gui', 'mouse', 'keyboard', 'screen', 'foreground', 'coordinate', 'ground'],
    'github': ['github', 'push', 'repo', 'commit', 'clone', 'pull', 'branch'],
    'agent-modes': ['mode', 'daemon', 'idle', 'repl', 'autonomous'],
    'self-learn': ['learn', 'research', 'teach', 'unknown', 'stuck'],
    'file-fetch-upload': ['fetch', 'locked', 'upload', 'cookie', 'sqlite'],
    'system-control': ['process', 'service', 'registry', 'startup', 'wifi'],
    'typing-editing': ['type', 'typing', 'paste', 'keystroke', 'edit'],
    'drag-drop': ['drag', 'slider', 'drop'],
    'uia-click': ['button', 'uia', 'press'],
    'wordpress-build': ['wordpress', 'blog', 'site', 'cms'],
    'office-docs': ['word', 'excel', 'powerpoint', 'pdf', 'document', 'sheet', 'slide'],
    'dashboard': ['dashboard', 'approve'],
    'mcp': ['mcp', 'gmail', 'notion', 'slack', 'connector', 'plugin'],
    'browser-dom': ['dom', 'selector', 'css', 'form', 'webpage'],
    'schedule': ['schedule', 'cron', 'recurring', 'daily', 'reminder'],
    'chat-telegram': ['telegram', 'phone', 'mobile'],
  };
  const index = files.filter(f => f.endsWith('.md')).map(f => {
    const name = f.replace(/\.md$/, '');
    let text = '';
    try { text = fs.readFileSync(path.join(SKILLS, f), 'utf8'); } catch {}
    const title = ((text.match(/^# Skill:\s*(.+)/m) || [])[1] || name).slice(0, 80);
    const desc = (text.split(/\r?\n/).find(l => l.trim() && !l.startsWith('#')) || '').slice(0, 140);
    const auto = (title + ' ' + desc).toLowerCase().split(/[^a-z0-9+#]+/).filter(w => w.length > 2 && !STOP.has(w));
    const triggers = Array.from(new Set([...(MANUAL_TRIGGERS[name] || []), ...auto])).slice(0, 40);
    const dt = gitDates(f);
    return { name, title, description: desc, origin: originOf(f), added: dt.added, updated: dt.updated, triggers };
  });
  fs.writeFileSync(path.join(SKILLS, 'index.json'), JSON.stringify(index, null, 1), 'utf8');
  const cards = files.map(f => {
    const text = fs.readFileSync(path.join(SKILLS, f), 'utf8');
    const title = f.replace(/\.md$/, '');
    const first = (text.split(/\r?\n/).find(l => l.trim() && !l.startsWith('#')) || '').slice(0, 140);
    const origin = originOf(f);
    const badge = origin === 'imported'
      ? `<span class="badge imp">imported</span><div class="src">from <a style="color:#58a6ff" href="${esc((imported[f] || {}).repo || '#')}">${esc(((imported[f] || {}).repo || '').replace('https://github.com/', ''))}</a> · crawled free from GitHub</div>`
      : LEARNED[f]
        ? `<span class="badge auto">auto-learned</span><div class="src">${esc(LEARNED[f])}</div>`
        : `<span class="badge task">task-built playbook</span>`;
    const raw = `https://github.com/ACHUTHAN17/windows-system-agent/blob/main/skills/${f}`;
    const dt = gitDates(f);
    return `<article class="card" data-origin="${origin}" data-updated="${dt.updated}" data-name="${esc(title)} ${esc(first.toLowerCase())}">
  <h2>${esc(title)}</h2>${badge}<p class="desc">${esc(first)}</p>
  <div class="dates">added ${dt.added || '?'} · updated ${String(dt.updated || '?').slice(0, 10)}</div>
  <details><summary>read full skill</summary><div class="body">${miniMd(text)}</div></details>
  <a class="raw" href="${raw}">view source on GitHub</a></article>`;
  }).join('\n');
  const auto = files.filter(f => LEARNED[f]).length;
  const imp = files.filter(f => imported[f]).length;
  const task = files.length - auto - imp;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WinAgent learned skills (live)</title>
<style>body{background:#0d1117;color:#e6edf3;font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;padding:24px}
.wrap{max-width:1000px;margin:auto}h1{margin:0 0 4px}.sub{color:#8b949e;margin:0 0 16px}
.meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.pill{background:#161b22;border:1px solid #30363d;border-radius:20px;padding:4px 12px;font-size:13px}
#q{width:100%;padding:10px 14px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:15px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:16px}
.card h2{margin:0 0 8px;font-size:19px}.desc{color:#8b949e;font-size:14px;min-height:38px}
.badge{font-size:11px;border-radius:12px;padding:2px 10px;font-weight:700}.auto{background:#1f6feb}.task{background:#30363d}.imp{background:#8250df}
.filters{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}.filters button{background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:16px;padding:4px 14px;font-size:13px;cursor:pointer}.filters button.on{background:#1f6feb;border-color:#1f6feb}.filters select{background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:16px;padding:4px 10px;font-size:13px}
.src{font-size:12px;color:#8b949e;margin:6px 0}.body{font-size:13.5px;line-height:1.55}.body h2{font-size:16px}.body h3{font-size:14px}
code{background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:0 5px;font-size:12.5px}
.li{margin-left:14px}.li:before{content:"• "}details{margin:10px 0}summary{cursor:pointer;color:#58a6ff}
.raw{font-size:12px;color:#58a6ff}.dates{font-size:11.5px;color:#8b949e;margin:2px 0 6px}footer{color:#8b949e;font-size:12px;margin-top:22px}</style></head>
<body><div class="wrap">
<h1>WinAgent learned skills — live</h1>
<p class="sub">The agent loads these straight from GitHub on every run (no local copies needed). Updated on every push. <a style="color:#58a6ff" href="./chat.html">💬 chat with the agent online</a></p>
<div class="meta"><span class="pill">v${esc(pkg.version || '')}</span><span class="pill">${toolCount} tools</span><span class="pill">${files.length} skills (${auto} auto · ${imp} imported · ${task} built)</span><span class="pill">generated ${new Date().toISOString().slice(0, 10)}</span></div>
<div class="filters"><button data-f="all" class="on">All</button><button data-f="auto">Auto-learned</button><button data-f="imported">Imported</button><button data-f="task">Task-built</button><select id="sort" onchange="applyFilter()"><option value="az">Name A–Z</option><option value="za">Name Z–A</option><option value="cat">Category</option><option value="new">Newest first</option><option value="old">Oldest first</option></select></div>
<input id="q" placeholder="filter skills…" oninput="applyFilter()">
<script>let CF='all';document.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{CF=b.dataset.f;document.querySelectorAll('.filters button').forEach(x=>x.classList.toggle('on',x===b));applyFilter();});function applyFilter(){const q=document.getElementById('q').value.toLowerCase();const s=document.getElementById('sort').value;const grid=document.getElementById('grid');const cards=[...grid.children];cards.sort((a,b)=>s==='za'?b.dataset.name.localeCompare(a.dataset.name):s==='cat'?(a.dataset.origin+a.dataset.name).localeCompare(b.dataset.origin+a.dataset.name):s==='new'?(b.dataset.updated||'0000').localeCompare(a.dataset.updated||'0000'):s==='old'?(a.dataset.updated||'9999').localeCompare(b.dataset.updated||'9999'):a.dataset.name.localeCompare(b.dataset.name));cards.forEach(c=>grid.appendChild(c));document.querySelectorAll('.card').forEach(c=>{c.style.display=(CF==='all'||c.dataset.origin===CF)&&c.dataset.name.includes(q)?'':'none';});}</script>
<div class="grid" id="grid">${cards}</div>
<footer>Source: <a style="color:#58a6ff" href="https://github.com/ACHUTHAN17/windows-system-agent/tree/main/skills">github.com/ACHUTHAN17/windows-system-agent/tree/main/skills</a></footer>
</div></body></html>`;
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`docs written: ${files.length} skills (${auto} auto-learned), ${toolCount} tools -> docs/index.html`);
}
main();
