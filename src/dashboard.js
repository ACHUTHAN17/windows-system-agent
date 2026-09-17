// WinAgent web dashboard: chat UI, live task stream (SSE), web approvals.
// Started via:  node src/index.js --ui 8080   (loopback only — same machine)
// Zero dependencies. Drives the agent as a child process and answers its
// approval prompts from the browser, so NOTHING in the agent core changed.
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, printActiveModel } from './config.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const INDEX = path.join(ROOT, 'src', 'index.js');

// Recognize the agent's approval prompts in child stdout.
export function detectPrompt(line) {
  const s = String(line || '');
  let m = s.match(/Allow agent to control app "([^"]+)"\?\s*\[y=once \/ a=always \/ N\]/);
  if (m) return { kind: 'app', label: m[1], options: ['once', 'always', 'deny'] };
  m = s.match(/Allow (\S+)\s+(.*?)\?\s*\[y\/N\]\s*$/);
  if (m) return { kind: 'tool', label: `${m[1]} ${m[2] || ''}`.slice(0, 300), options: ['once', 'deny'] };
  return null;
}

function toolCount() {
  try {
    const t = fs.readFileSync(path.join(ROOT, 'src', 'tools.js'), 'utf8');
    return (t.match(/      name: '/g) || []).length;
  } catch { return 0; }
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WinAgent dashboard</title>
<style>body{background:#0d1117;color:#e6edf3;font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;padding:20px}
.wrap{max-width:900px;margin:auto}h1{margin:0 0 4px;font-size:22px}.sub{color:#8b949e;margin:0 0 14px;font-size:13px}
.pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.pill{background:#161b22;border:1px solid #30363d;border-radius:20px;padding:3px 12px;font-size:12.5px}
#stream{background:#010409;border:1px solid #30363d;border-radius:10px;padding:12px;height:340px;overflow-y:auto;font-family:Consolas,monospace;font-size:12.5px;white-space:pre-wrap}
#stream .appr{color:#f0b429}#stream .err{color:#f85149}#stream .ok{color:#3fb950}
form{display:flex;gap:8px;margin:12px 0}input[type=text]{flex:1;padding:10px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px}
button{padding:10px 16px;border-radius:8px;border:1px solid #30363d;background:#1f6feb;color:#fff;font-weight:700;cursor:pointer}
button.ghost{background:#161b22}button:disabled{opacity:.4;cursor:default}
#approval{display:none;background:#161b22;border:2px solid #f0b429;border-radius:10px;padding:14px;margin:12px 0}
#approval .btns{display:flex;gap:8px;margin-top:10px}h3{margin:18px 0 8px;font-size:15px}
#skills{display:flex;gap:6px;flex-wrap:wrap}.sk{background:#161b22;border:1px solid #30363d;border-radius:14px;padding:2px 10px;font-size:12px}</style></head>
<body><div class="wrap">
<h1>WinAgent dashboard</h1><p class="sub">chat, watch, approve — the agent runs as a child process below</p>
<div class="pills" id="pills"><span class="pill">connecting…</span></div>
<div id="approval"><b>Approval needed</b><div id="applabel"></div><div class="btns" id="appbtns"></div></div>
<div id="stream"></div>
<form id="f"><input type="text" id="task" placeholder="type a task, e.g. list the 3 largest files in Documents" autocomplete="off"><button type="submit" id="send">Send</button><button type="button" class="ghost" id="st">Selftest</button><button type="button" class="ghost" id="stop">Stop</button></form>
<h3>Skills (live from GitHub)</h3><div id="skills"></div>
<script>
const stream=document.getElementById('stream'),task=document.getElementById('task');
function line(t,cls){const d=document.createElement('div');if(cls)d.className=cls;d.textContent=t;stream.appendChild(d);stream.scrollTop=stream.scrollHeight;}
fetch('/api/status').then(r=>r.json()).then(s=>{document.getElementById('pills').innerHTML='<span class="pill">'+s.model+'</span><span class="pill">'+s.tools+' tools</span><span class="pill">'+s.skills+' skills</span><span class="pill">mcp: '+s.mcp+'</span>';});
fetch('/api/skills').then(r=>r.json()).then(sk=>{document.getElementById('skills').innerHTML=sk.map(s=>'<span class="sk">'+s+'</span>').join('');});
const es=new EventSource('/api/events');
es.onmessage=e=>{const m=JSON.parse(e.data);
if(m.t==='line')line(m.text,m.cls);
if(m.t==='approval'){document.getElementById('approval').style.display='block';document.getElementById('applabel').textContent=m.label;
document.getElementById('appbtns').innerHTML=m.options.map(o=>'<button data-d="'+o+'">'+o+'</button>').join('');
document.querySelectorAll('#appbtns button').forEach(b=>b.onclick=()=>{fetch('/api/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:m.id,decision:b.dataset.d})});document.getElementById('approval').style.display='none';});}
if(m.t==='resolved')line('[approval: '+m.decision+']','appr');
if(m.t==='done')line('[task exited code '+m.code+']','ok');};
document.getElementById('f').onsubmit=e=>{e.preventDefault();if(!task.value.trim())return;
fetch('/api/task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:task.value})});task.value='';};
document.getElementById('st').onclick=()=>fetch('/api/selftest',{method:'POST'});
document.getElementById('stop').onclick=()=>fetch('/api/stop',{method:'POST'});
</script></div></body></html>`;

export async function startDashboard(port) {
  const cfg = loadConfig({});
  const state = { child: null, pending: null, seq: 0, ring: [], clients: new Set() };
  function send(ev) {
    state.ring.push(ev);
    if (state.ring.length > 200) state.ring.shift();
    const data = `data: ${JSON.stringify(ev)}\n\n`;
    for (const c of state.clients) { try { c.write(data); } catch {} }
  }
  function clsFor(text) {
    if (/FAIL|ERROR|denied/i.test(text)) return 'err';
    if (/PASS|SELFTEST OK|pushed|installed/i.test(text)) return 'ok';
    if (/APPROVAL|Allow /i.test(text)) return 'appr';
    return '';
  }
  function answerPending(decision) {
    const p = state.pending;
    if (!p) return false;
    state.pending = null;
    clearTimeout(p.timer);
    const map = { once: 'y', always: 'a', deny: 'n' };
    try { if (state.child) state.child.stdin.write((map[decision] || 'n') + '\n'); } catch {}
    send({ t: 'resolved', decision });
    return true;
  }
  function runChild(args, withApprovals) {
    if (state.child) return false;
    const child = spawn(process.execPath, [INDEX, ...args], { cwd: ROOT, windowsHide: true });
    state.child = child;
    send({ t: 'line', text: `$ node src/index.js ${args.join(' ')}` });
    let buf = '';
    const onData = (chunk, scan) => {
      buf += String(chunk);
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) {
        if (!l.trim()) continue;
        if (scan) {
          const pr = detectPrompt(l);
          if (pr && !state.pending) {
            const id = ++state.seq;
            send({ t: 'approval', id, kind: pr.kind, label: pr.label, options: pr.options });
            state.pending = {
              id,
              timer: setTimeout(() => {
                if (state.pending && state.pending.id === id) {
                  state.pending = null;
                  try { child.stdin.write('n\n'); } catch {}
                  send({ t: 'resolved', decision: 'deny (120s timeout)' });
                }
              }, 120000),
            };
            continue;
          }
        }
        send({ t: 'line', text: l.slice(0, 2000), cls: clsFor(l) });
      }
    };
    child.stdout.on('data', d => onData(d, withApprovals));
    child.stderr.on('data', d => onData(d, false));
    child.on('exit', code => {
      if (buf.trim()) send({ t: 'line', text: buf.trim().slice(0, 2000), cls: clsFor(buf) });
      buf = '';
      send({ t: 'done', code: code ?? -1 });
      state.child = null;
      state.pending = null;
    });
    return true;
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      for (const ev of state.ring) res.write(`data: ${JSON.stringify(ev)}\n\n`);
      state.clients.add(res);
      req.on('close', () => state.clients.delete(res));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      let skills = 0;
      try { skills = fs.readdirSync(path.join(ROOT, 'skills')).filter(f => f.endsWith('.md')).length; } catch {}
      const mcp = (process.env.MCP_SERVERS || cfg.mcpServers) ? 'configured' : 'off';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: printActiveModel(cfg), tools: toolCount(), skills, mcp, busy: !!state.child, pending: !!state.pending }));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/skills') {
      let out = [];
      try { out = fs.readdirSync(path.join(ROOT, 'skills')).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
      return;
    }
    if (req.method === 'POST' && (url.pathname === '/api/task' || url.pathname === '/api/selftest' || url.pathname === '/api/stop' || url.pathname === '/api/approve')) {
      let body = '';
      req.on('data', d => { body += d; if (body.length > 20000) req.destroy(); });
      req.on('end', () => {
        let j = {};
        try { j = JSON.parse(body || '{}'); } catch {}
        if (url.pathname === '/api/stop') {
          try { if (state.child) state.child.kill(); } catch {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          return;
        }
        if (url.pathname === '/api/approve') {
          const ok = state.pending && j.id === state.pending.id ? answerPending(j.decision) : false;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok }));
          return;
        }
        if (url.pathname === '/api/selftest') {
          if (!runChild(['--selftest'], false)) { res.writeHead(409); res.end('{"error":"busy"}'); return; }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"started":true}');
          return;
        }
        if (!j.text || !String(j.text).trim()) { res.writeHead(400); res.end('{"error":"text required"}'); return; }
        if (!runChild(['--once', String(j.text)], true)) { res.writeHead(409); res.end('{"error":"busy"}'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"started":true}');
      });
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  await new Promise(res => server.listen(port, '127.0.0.1', res));
  console.log(`WinAgent dashboard: http://127.0.0.1:${port}  (loopback only — open in your browser)`);
}
