// Builds docs/index.html — the LIVE skills page — from skills/*.md. Zero deps.
// Usage: node src/build-docs.js   (run before every push that touches skills/)
import fs from 'node:fs';
import path from 'node:path';

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

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const files = fs.readdirSync(SKILLS).filter(f => f.endsWith('.md')).sort();
  let toolCount = 0;
  try {
    const t = fs.readFileSync(path.join(ROOT, 'src', 'tools.js'), 'utf8');
    toolCount = (t.match(/      name: '/g) || []).length;
  } catch {}
  const cards = files.map(f => {
    const text = fs.readFileSync(path.join(SKILLS, f), 'utf8');
    const title = f.replace(/\.md$/, '');
    const first = (text.split(/\r?\n/).find(l => l.trim() && !l.startsWith('#')) || '').slice(0, 140);
    const badge = LEARNED[f]
      ? `<span class="badge auto">auto-learned</span><div class="src">${esc(LEARNED[f])}</div>`
      : `<span class="badge task">task-built playbook</span>`;
    const raw = `https://github.com/ACHUTHAN17/windows-system-agent/blob/main/skills/${f}`;
    return `<article class="card" data-name="${esc(title)} ${esc(first.toLowerCase())}">
  <h2>${esc(title)}</h2>${badge}<p class="desc">${esc(first)}</p>
  <details><summary>read full skill</summary><div class="body">${miniMd(text)}</div></details>
  <a class="raw" href="${raw}">view source on GitHub</a></article>`;
  }).join('\n');
  const auto = files.filter(f => LEARNED[f]).length;
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
.badge{font-size:11px;border-radius:12px;padding:2px 10px;font-weight:700}.auto{background:#1f6feb}.task{background:#30363d}
.src{font-size:12px;color:#8b949e;margin:6px 0}.body{font-size:13.5px;line-height:1.55}.body h2{font-size:16px}.body h3{font-size:14px}
code{background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:0 5px;font-size:12.5px}
.li{margin-left:14px}.li:before{content:"• "}details{margin:10px 0}summary{cursor:pointer;color:#58a6ff}
.raw{font-size:12px;color:#58a6ff}footer{color:#8b949e;font-size:12px;margin-top:22px}</style></head>
<body><div class="wrap">
<h1>WinAgent learned skills — live</h1>
<p class="sub">The agent loads these straight from GitHub on every run (no local copies needed). Updated on every push. <a style="color:#58a6ff" href="./chat.html">💬 chat with the agent online</a></p>
<div class="meta"><span class="pill">v${esc(pkg.version || '')}</span><span class="pill">${toolCount} tools</span><span class="pill">${files.length} skills (${auto} auto-learned)</span><span class="pill">generated ${new Date().toISOString().slice(0, 10)}</span></div>
<input id="q" placeholder="filter skills…" oninput="document.querySelectorAll('.card').forEach(c=>c.style.display=c.dataset.name.includes(this.value.toLowerCase())?'':'none')">
<div class="grid">${cards}</div>
<footer>Source: <a style="color:#58a6ff" href="https://github.com/ACHUTHAN17/windows-system-agent/tree/main/skills">github.com/ACHUTHAN17/windows-system-agent/tree/main/skills</a></footer>
</div></body></html>`;
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`docs written: ${files.length} skills (${auto} auto-learned), ${toolCount} tools -> docs/index.html`);
}
main();
