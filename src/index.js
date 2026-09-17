#!/usr/bin/env node
// WinAgent CLI: `node src/index.js "your task" [--yes] [--selftest] [--once]`
// Zero dependencies. Works with API models, local Ollama/LM Studio, or any custom
// OpenAI-compatible endpoint — set via .env / config.json (see .env.example).
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, printActiveModel } from './config.js';
import { buildTools } from './tools.js';
import { chat, parseAgentJson, systemPrompt, toolPrompt } from './llm.js';
import { needsApproval, askYesNo, audit, needsAppApproval, askAppApproval, requestApproval, requestAppApproval } from './safety.js';

const argv = parseArgs(process.argv.slice(2));
const cfg = loadConfig(argv);
const tools = buildTools();
const byName = Object.fromEntries(tools.map(t => [t.name, t]));
try {
  const { discoverMcp } = await import('./mcp.js');
  for (const t of await discoverMcp(cfg)) { tools.push(t); byName[t.name] = t; }
} catch (e) { console.log(`  [mcp] discovery skipped: ${e.message}`); }

function parseArgs(raw) {
  const o = { _: [] };
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--selftest') o.selftest = true;
    else if (a === '--once') o.once = true;
    else if (a === '--plan') o.plan = true;
    else if (a === '--every') o.everyMin = Number(raw[++i] || 0);
    else if (a === '--repeat') o.repeatN = Number(raw[++i] || 0);
    else if (a === '--learn') o.learnTopic = raw[++i] || '';
    else if (a === '--daemon') { const v = raw[i + 1]; o.daemonSec = (v !== undefined && !String(v).startsWith('--')) ? Number(raw[++i]) : 300; }
    else if (a === '--learn-cycles') o.learnCycles = Number(raw[++i] || 0);
    else if (a === '--idle-learn') o.idleLearn = true;
    else if (a === '--idle-seconds') o.idleSeconds = Number(raw[++i] || 2);
    else if (a === '--learn-cooldown') o.learnCooldown = Number(raw[++i] || 300);
    else if (a === '--model') o.MODEL_NAME = raw[++i];
    else if (a === '--url') o.MODEL_API_URL = raw[++i];
    else if (a === '--provider') o.MODEL_PROVIDER = raw[++i];
    else if (a.startsWith('--')) o[a.slice(2).toUpperCase()] = raw[++i] ?? 'true';
    else o._.push(a);
  }
  return o;
}

async function fetchRemoteSkill(name, cfg) {
  const mode = String(cfg.skillSource || 'auto').toLowerCase();
  if (mode === 'local') return null;
  const repo = cfg.skillRepo || 'ACHUTHAN17/windows-system-agent';
  const branch = cfg.skillBranch || 'main';
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/skills/${name}`;
  try {
    const headers = { 'User-Agent': 'WinAgent/1.6' };
    if (cfg.skillToken) headers.Authorization = `Bearer ${cfg.skillToken}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      if (mode === 'github') console.log(`  [skill] ${name}: remote HTTP ${res.status} (private repo? set SKILL_TOKEN)`);
      return null;
    }
    const text = (await res.text()).slice(0, 12000);
    if (!text.trim()) return null;
    return { name, text, source: 'github' };
  } catch (e) {
    if (mode === 'github') console.log(`  [skill] ${name}: remote unreachable`);
    return null;
  }
}

async function loadSkills(argv, cfg) {
  const wanted = new Set();
  for (const src of [argv.skill, argv.SKILL, process.env.SKILLS]) {
    if (src) String(src).split(',').map(s => s.trim()).filter(Boolean).forEach(s => wanted.add(s));
  }
  try {
    const envText = fs.readFileSync(path.join(cfg.root, '.env'), 'utf8');
    const m = envText.match(/^\s*SKILLS\s*=\s*(.+?)\s*$/m);
    if (m) m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => wanted.add(s));
  } catch { /* no .env */ }
  const loaded = [];
  const remoteOnly = String(cfg.skillSource || 'auto').toLowerCase() === 'github';
  for (let name of wanted) {
    if (!name.endsWith('.md')) name += '.md';
    const safe = path.basename(name);
    const remote = await fetchRemoteSkill(safe, cfg);
    if (remote) { console.log(`  [skill] ${safe} <- github (live)`); loaded.push(remote); continue; }
    if (remoteOnly) { console.log(`  [skill] ${safe}: remote-only mode, skipped (offline or bad token)`); continue; }
    try {
      loaded.push({ name: safe, text: fs.readFileSync(path.join(cfg.root, 'skills', safe), 'utf8').slice(0, 12000), source: 'local' });
      console.log(`  [skill] ${safe} <- local (github unreachable, fallback)`);
    } catch { console.log(`  [skill] not found: skills/${safe} (local missing, remote unreachable)`); }
  }
  return loaded;
}

function skillPrompt(loaded) {
  if (!loaded.length) return '';
  return '\n\nSKILLS (follow these playbooks step by step):\n' + loaded.map(s => `--- ${s.name} ---\n${s.text}`).join('\n');
}

async function runTool(name, args) {
  const tool = byName[name];
  if (!tool) return { ok: false, error: `unknown tool: ${name}`, hint: `Valid: ${Object.keys(byName).join(', ')}` };
  const appNeed = needsAppApproval(cfg, name, args);
  if (appNeed) {
    audit(cfg, `APPROVAL-ASK-APP ${appNeed}`);
    const how = await requestAppApproval(cfg, appNeed);
    if (!how) { audit(cfg, `APPROVAL-DENY-APP ${appNeed}`); return { ok: false, error: 'denied by user', hint: 'User declined app approval. Use an allowed app or stop.' }; }
    if (how === 'always') { cfg._appGrants = cfg._appGrants || new Set(); cfg._appGrants.add(appNeed); }
  }
  if (needsApproval(cfg, name)) {
    audit(cfg, `APPROVAL-ASK ${name} ${JSON.stringify(args).slice(0, 400)}`);
    const how2 = await requestApproval(cfg, `Allow ${name} ${JSON.stringify(args).slice(0, 300)}?`);
    if (!how2) { audit(cfg, `APPROVAL-DENY ${name}`); return { ok: false, error: 'denied by user', hint: 'User declined approval. Explain and stop or propose a read-only alternative.' }; }
  }
  const res = await tool.run(args || {}, { cfg });
  audit(cfg, `TOOL ${name} args=${JSON.stringify(args).slice(0, 300)} -> ${JSON.stringify(res).slice(0, 500)}`);
  return res;
}

function loadMemory(cfg) {
  try {
    const dir = path.join(cfg.root, 'memory');
    if (!fs.existsSync(dir)) return '';
    let out = '';
    const main = path.join(dir, 'MEMORY.md');
    if (fs.existsSync(main)) out += '\n\nCORE MEMORY (persists across runs — read it, use it, keep it fresh with memory_write):\n' + fs.readFileSync(main, 'utf8').slice(0, 6000);
    const others = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md').slice(0, 10);
    for (const f of others) {
      try { out += `\n\n--- memory/${f} ---\n` + fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 3000); } catch {}
    }
    return out;
  } catch { return ''; }
}

// Project rules (OpenCode AGENTS.md convention): repo-local instructions the
// agent must follow, loaded from the project root and the launch directory.
function loadProjectRules(cfg) {
  let out = '';
  for (const dir of [cfg.root, process.cwd()]) {
    try {
      const p = path.join(dir, 'AGENTS.md');
      if (fs.existsSync(p)) out += `\n\nPROJECT RULES (${p} — follow these):\n` + fs.readFileSync(p, 'utf8').slice(0, 4000);
    } catch {}
  }
  return out;
}

function popLearnQueue() {
  try {
    const p = path.join(cfg.root, 'memory', 'learn-queue.md');
    let lines = [];
    if (fs.existsSync(p)) {
      lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
    } else {
      const g = path.join(cfg.root, 'memory', 'GOALS.md');
      if (!fs.existsSync(g)) return '';
      const text = fs.readFileSync(g, 'utf8');
      const sect = text.split('## Learn queue')[1] || '';
      lines = sect.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
      if (lines.length) fs.writeFileSync(path.join(cfg.root, 'memory', 'learn-queue.md'), lines.join('\n') + '\n', 'utf8');
    }
    if (!lines.length) return '';
    fs.writeFileSync(path.join(cfg.root, 'memory', 'learn-queue.md'), lines.slice(1).join('\n') + '\n', 'utf8');
    return lines[0].replace(/^[-*]\s*/, '');
  } catch { return ''; }
}

// One autonomous self-upgrade cycle: pick a topic, research it, distill with
// the agent's own model, install into skills/ or memory/, verify, report.
// Writes ONLY under skills/ and memory/ — never touches src/ or system.
async function learnCycle(topic) {
  let t = String(topic || '').trim();
  if (!t) t = popLearnQueue();
  if (!t) {
    try {
      const dir = path.join(cfg.root, 'skills');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
        .map(f => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => a.m - b.m);
      if (files.length) t = 'refresh and verify the ' + files[0].f.replace(/\.md$/, '') + ' skill (check steps still current)';
    } catch {}
  }
  if (!t) return 'nothing to learn (no queue, no skills)';
  console.log(`  [learn] topic: ${t}`);
  const S = byName['web_search'], G = byName['web_scrape'];
  if (!S || !G) return 'research tools missing';
  let material = '';
  try {
    const s = await S.run({ query: t, max: 3 }, { cfg });
    const hits = (s.ok && s.results ? s.results : []).slice(0, 2);
    for (const h of hits) {
      try {
        const g = await G.run({ url: h.url, maxPages: 1, maxChars: 4000 }, { cfg });
        if (g.ok) for (const p of g.content) material += `\n## ${p.title} (${p.url})\n${p.text}\n`;
      } catch {}
      if (material.length > 8000) break;
    }
  } catch (e) { return 'research failed: ' + e.message; }
  if (!material.trim()) return 'no material found for: ' + t;
  const prompt = `You maintain WinAgent skills. Topic: ${t}\nResearch material:\n${material.slice(0, 8000)}\nDecide ONE: (a) a new skill file in house style (when/steps/tool names/safety), or (b) a 3-8 line memory note. Reply EXACTLY as JSON, no other text: {"kind":"skill","name":"<file>.md","content":"..."} or {"kind":"memory","topic":"<topic-or-empty>","text":"..."}`;
  let raw;
  try {
    raw = await chat(cfg, [
      { role: 'system', content: 'You write concise agent skills. Reply with exactly one JSON object, no other text.' },
      { role: 'user', content: prompt },
    ]);
  } catch (e) { return 'distill failed (LLM): ' + e.message; }
  let dec;
  try { dec = JSON.parse((raw.match(/\{[\s\S]*\}/) || [''])[0]); } catch { return 'distill returned bad JSON, skipped'; }
  const F = byName['file_write'], M = byName['memory_write'];
  if (dec && dec.kind === 'skill' && dec.name && dec.content) {
    const safe = 'skills/' + String(dec.name).replace(/[^a-z0-9-_.]/gi, '').slice(0, 40);
    if (!safe.endsWith('.md') || safe.includes('..')) return 'unsafe skill name, skipped';
    const full = path.join(cfg.root, safe);
    if (!full.startsWith(cfg.root)) return 'path escape, skipped';
    const w = await F.run({ path: full, content: String(dec.content).slice(0, 12000) }, { cfg });
    if (!w.ok) return 'skill write failed: ' + w.error;
    await M.run({ text: `learned skill ${safe} about: ${t.slice(0, 120)}` }, { cfg });
    return `installed skill ${safe}`;
  }
  if (dec && dec.kind === 'memory' && dec.text) {
    const w = await M.run({ text: String(dec.text).slice(0, 800), topic: dec.topic || undefined }, { cfg });
    if (!w.ok) return 'memory write failed: ' + w.error;
    return 'memory updated';
  }
  return 'nothing actionable distilled';
}

const STOPWORDS = new Set('the,and,for,with,you,your,from,that,this,these,those,into,over,under,via,per,was,were,has,have,had,will,would,can,all,any,our,out,about,using,use,used,when,then,than,them,they,their,there,here,what,which,while,also,such,more,most,some,only,just,like,get,see,let,many,much,must,shall,should,could,does,did,done,each,other,same,too,very,own,both,how,now,off,once,its,not,but,are'.split(','));

// Skill router: the catalog lists every skill (name/description/triggers).
// GitHub-first like skills themselves; local index.json, extracted dir, else none.
async function loadCatalog(cfg) {
  const mode = String(cfg.skillSource || 'auto').toLowerCase();
  if (mode !== 'local') {
    try {
      const repo = cfg.skillRepo || 'ACHUTHAN17/windows-system-agent';
      const branch = cfg.skillBranch || 'main';
      const headers = { 'User-Agent': 'WinAgent/1.6' };
      if (cfg.skillToken) headers.Authorization = `Bearer ${cfg.skillToken}`;
      const res = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/skills/index.json`, { headers, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j) && j.length) return { list: j, source: 'github' };
      }
    } catch {}
    if (mode === 'github') return { list: [], source: 'github-unreachable' };
  }
  try {
    const j = JSON.parse(fs.readFileSync(path.join(cfg.root, 'skills', 'index.json'), 'utf8'));
    if (Array.isArray(j) && j.length) return { list: j, source: 'local-index' };
  } catch {}
  try {
    const dir = path.join(cfg.root, 'skills');
    const list = fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
      const name = f.replace(/\.md$/, '');
      let text = '';
      try { text = fs.readFileSync(path.join(dir, f), 'utf8'); } catch {}
      const title = ((text.match(/^# Skill:\s*(.+)/m) || [])[1] || name).slice(0, 80);
      const desc = (text.split(/\r?\n/).find(l => l.trim() && !l.startsWith('#')) || '').slice(0, 140);
      const triggers = Array.from(new Set((title + ' ' + desc).toLowerCase().split(/[^a-z0-9+#]+/).filter(w => w.length > 2 && !STOPWORDS.has(w)))).slice(0, 40);
      return { name, title, description: desc, origin: 'local', triggers };
    });
    return { list, source: 'local-extract' };
  } catch { return { list: [], source: 'none' }; }
}

function catalogPrompt(catalog) {
  if (!catalog.list.length) return '';
  return '\n\nSKILL CATALOG — call skill_load {"name"} the moment one fits the task (preloaded skills above are already active, never reload them):\n' +
    catalog.list.slice(0, 40).map(s => `- ${s.name}: ${(s.description || '').slice(0, 120)}`).join('\n');
}

// Keyword preloading: task words vs triggers, threshold >= 2, max 3, deduped.
function autoPick(task, list, explicit) {
  const have = new Set((explicit || []).map(s => String(s.name || '').replace(/\.md$/, '')));
  const words = new Set(String(task).toLowerCase().split(/[^a-z0-9+#]+/).filter(w => w.length > 2));
  return list
    .filter(s => s && s.name && !have.has(s.name))
    .map(s => ({ s, score: ((s.triggers || []).map(String)).reduce((a, t) => a + (words.has(t.toLowerCase()) ? (t.length > 5 ? 2 : 1) : 0), 0) }))
    .filter(x => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.s.name);
}

async function agentTask(task) {
  const skills = await loadSkills(argv, cfg);
  if (skills.length) console.log(`  [skills] ${skills.map(s => s.name).join(', ')}`);
  const catalog = await loadCatalog(cfg);
  for (const an of autoPick(task, catalog.list, skills)) {
    try {
      const loader = byName['skill_load'];
      if (!loader) break;
      const r = await loader.run({ name: an }, { cfg });
      if (r.ok) { skills.push({ name: an + '.md', text: r.content }); console.log(`  [skills:auto] ${an} <- ${r.source}`); }
    } catch {}
  }
  const history = [
    { role: 'system', content: systemPrompt(toolPrompt(tools)) + skillPrompt(skills) + catalogPrompt(catalog) + loadMemory(cfg) + loadProjectRules(cfg) },
    { role: 'user', content: task },
  ];
  if (argv.plan) {
    const planRaw = await chat(cfg, [
      { role: 'system', content: 'Outline a short numbered plan (max 8 steps) using the available tools. Reply as JSON: {"plan": ["step 1", "..."]}. No other text.' },
      { role: 'user', content: task },
    ]);
    let planText = planRaw;
    try {
      const pj = JSON.parse((planRaw.match(/\{[\s\S]*\}/) || [''])[0]);
      if (pj && Array.isArray(pj.plan)) planText = pj.plan.map((s, i) => `${i + 1}. ${s}`).join('\n');
    } catch {}
    console.log('\nProposed plan:\n' + planText + '\n');
    const okp = await requestApproval(cfg, 'Execute this plan?');
    if (!okp) return 'Plan rejected — nothing was executed.';
    history.push({ role: 'user', content: 'Approved plan to follow:\n' + planText });
  }
  for (let step = 1; step <= cfg.maxSteps; step++) {
    const raw = await chat(cfg, history);
    const parsed = parseAgentJson(raw);
    if (parsed.action === 'final') return parsed.answer;
    const result = await runTool(parsed.tool, parsed.args);
    if (parsed.thought) console.log(`  [step ${step}] ${parsed.thought}`);
    console.log(`  [tool] ${parsed.tool} -> ${JSON.stringify(result).slice(0, 400)}`);
    history.push({ role: 'assistant', content: raw });
    history.push({ role: 'user', content: `Tool ${parsed.tool} returned:\n${JSON.stringify(result).slice(0, 6000)}\nContinue with the next single JSON object.` });
  }
  return `Stopped after ${cfg.maxSteps} steps without a final answer. Try a smaller task or raise maxSteps.`;
}

async function selftest() {
  console.log('WinAgent selftest (no LLM needed)');
  const sk = await loadSkills(argv, cfg);
  console.log(` skills: ${sk.length ? sk.map(s => s.name + ' (' + s.text.length + ' chars)').join(', ') : '(none loaded — try --skill wordpress-build)'}`);
  const checks = [];
  const winOnlyTools = new Set(['window_focus', 'window_manage', 'reg_read', 'reg_write', 'browser_info']);
  for (const [name, args] of [['sys_info', {}], ['file_list', { path: cfg.root }], ['app_list', {}], ['window_list', {}], ['file_fetch', { path: cfg.root + '/package.json', outName: 'selftest-fetch.json' }], ['wait', { seconds: 1 }], ['memory_write', { text: 'selftest probe', topic: 'selftest' }], ['memory_read', { topic: 'selftest' }], ['memory_forget', { topic: 'selftest' }], ['skill_load', { name: 'self-learn' }]]) {
    try {
      const r = await byName[name].run(args, { cfg });
      const skip = !r.ok && process.platform !== 'win32' && winOnlyTools.has(name);
      checks.push(`${r.ok ? 'PASS' : skip ? 'SKIP' : 'FAIL'} ${name}`);
      console.log(` ${r.ok ? 'PASS' : skip ? 'SKIP' : 'FAIL'} ${name}: ${JSON.stringify(r).slice(0, 300)}`);
    } catch (e) { checks.push(`FAIL ${name}: ${e.message}`); console.log(` FAIL ${name}: ${e.message}`); }
  }
  console.log(checks.every(c => c.startsWith('PASS') || c.startsWith('SKIP')) ? 'SELFTEST OK' : 'SELFTEST HAD FAILURES (see above)');
}

async function handleLine(line, rl) {
  line = line.trim();
  if (!line) return;
  if (/^(exit|quit)$/i.test(line)) { rl.close(); process.exit(0); }
  if (line === 'model') { console.log(' ' + printActiveModel(cfg)); return; }
  if (line === 'tools') { console.log(' ' + Object.keys(byName).join(', ')); return; }
  if (line === 'skills') { try { console.log(' ' + fs.readdirSync(path.join(cfg.root, 'skills')).filter(f => f.endsWith('.md')).join(', ')); } catch { console.log(' (no local skills dir)'); } console.log(`  [source: ${cfg.skillSource || 'auto'} -> ${cfg.skillRepo || ''}/skills]`); return; }
  if (line === 'memory') { try { console.log(fs.readFileSync(path.join(cfg.root, 'memory', 'MEMORY.md'), 'utf8').slice(0, 2000)); } catch { console.log(' (no memory yet)'); } return; }
  if (line === 'goals') { try { console.log(fs.readFileSync(path.join(cfg.root, 'memory', 'GOALS.md'), 'utf8').slice(0, 2000)); } catch { console.log(' (no goals yet)'); } return; }
  if (line === 'selftest') { await selftest(); return; }
  if (line.startsWith('learn ')) { console.log(await learnCycle(line.slice(6).trim())); return; }
  try { console.log('\n' + await agentTask(line) + '\n'); }
  catch (e) { console.log('\nERROR: ' + e.message + '\n'); }
}

async function repl() {
  console.log(`WinAgent ready — ${printActiveModel(cfg)}`);
  console.log('Type a task, or: exit | model | tools | skills | memory | goals | learn <topic> | selftest\n');
  const idleLearn = !!argv.idleLearn;
  const idleMs = Math.max(2, Number(argv.idleSeconds || process.env.IDLE_SECONDS || 2)) * 1000;
  const coolMs = Math.max(30, Number(argv.learnCooldown || process.env.LEARN_COOLDOWN || 300)) * 1000;
  if (idleLearn) console.log(`  [idle-learn ON: self-upgrade after ${Math.round(idleMs / 1000)}s idle, at most every ${Math.round(coolMs / 1000)}s]\n`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let busy = false;
  let queued = [];
  let lastCycle = 0;
  let idleTimer = null;
  function armIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    if (!idleLearn) return;
    idleTimer = setTimeout(async () => {
      idleTimer = null;
      if (busy) { armIdle(); return; }
      if (Date.now() - lastCycle < coolMs) { armIdle(); return; }
      busy = true;
      try {
        console.log('\n[idle] quiet — running one self-upgrade cycle…');
        lastCycle = Date.now();
        console.log(await learnCycle());
      } catch (e) { console.log('[idle] cycle skipped: ' + e.message); }
      busy = false;
      drain();
      armIdle();
      rl.prompt();
    }, idleMs);
    if (idleTimer.unref) idleTimer.unref();
  }
  async function drain() {
    while (queued.length && !busy) {
      busy = true;
      const next = queued.shift();
      try { await handleLine(next, rl); } finally { busy = false; }
    }
  }
  rl.on('line', async (line) => {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (busy) { queued.push(line); return; }
    busy = true;
    try { await handleLine(line, rl); } finally { busy = false; }
    await drain();
    armIdle();
  });
  rl.setPrompt('win-agent> ');
  rl.prompt();
  armIdle();
  await new Promise(res => rl.on('close', res));
}

async function main() {
  if (argv.UI !== undefined) {
    const { startDashboard } = await import('./dashboard.js');
    await startDashboard(Number(argv.UI) || 8080);
    return;
  }
  if ((argv.CHAT || argv.chat) === 'telegram') {
    const token = cfg.telegramToken || process.env.TELEGRAM_TOKEN;
    if (!token) { console.log('TELEGRAM_TOKEN missing. Talk to @BotFather, set TELEGRAM_TOKEN in .env, retry.'); return; }
    const { runTelegram } = await import('./channel-telegram.js');
    const origLog = console.log;
    let cap = [];
    await runTelegram({
      root: cfg.root, token, allowFrom: cfg.telegramAllow || process.env.TELEGRAM_ALLOW_FROM || '',
      runTask: (t) => agentTask(t),
      runSelftest: async () => {
        cap = []; console.log = (...a) => cap.push(a.join(' '));
        try { await selftest(); } finally { console.log = origLog; }
        return cap.join('\n');
      },
    });
    return;
  }
  if (argv.everyMin) {
    const mins = Math.max(1, Number(argv.everyMin) || 60);
    const stask = argv._.join(' ').trim() || 'memory maintenance: append one status line to MEMORY.md';
    const maxR = Number(argv.repeatN || 0);
    console.log(`WinAgent schedule — every ${mins} min${maxR ? `, ${maxR} run(s)` : ''}: ${stask.slice(0, 120)}`);
    let n = 0;
    for (;;) {
      n++;
      try { console.log(`[run ${n}] ${await agentTask(stask)}`); }
      catch (e) { console.log(`[run ${n}] error: ${e.message}`); }
      if (maxR && n >= maxR) break;
      await new Promise(r => setTimeout(r, mins * 60000));
    }
    return;
  }
  if (argv.selftest) return selftest();
  if (argv.learnTopic !== undefined) {
    try { console.log(await learnCycle(argv.learnTopic)); }
    catch (e) { console.log('LEARN ERROR: ' + e.message); }
    return;
  }
  if (argv.daemonSec) {
    const every = Math.max(60, Number(argv.daemonSec) || 300) * 1000;
    const maxC = Number(argv.learnCycles || 0);
    console.log(`WinAgent daemon — self-upgrade cycle every ${Math.round(every / 1000)}s${maxC ? `, ${maxC} cycle(s)` : ''} (Ctrl+C to stop)`);
    let n = 0;
    for (;;) {
      n++;
      try { console.log(`[cycle ${n}] ${await learnCycle()}`); }
      catch (e) { console.log(`[cycle ${n}] error: ${e.message}`); }
      if (maxC && n >= maxC) break;
      await new Promise(r => setTimeout(r, every));
    }
    return;
  }
  const task = argv._.join(' ').trim();
  console.log(`WinAgent — ${printActiveModel(cfg)}`);
  if (!task) return repl();
  if (argv.once) audit(cfg, `TASK: ${task}`);
  try {
    const answer = await agentTask(task);
    console.log('\n' + answer);
  } catch (e) {
    console.error('\nERROR: ' + e.message);
    console.error('Fix: copy .env.example -> .env (Ollama default) or set MODEL_API_URL/KEY/NAME for your provider.');
    process.exitCode = 1;
  }
}

// Subtask fan-out (Manus-style delegation): tools call cfg.runSubtask.
// Depth-capped at 2 so delegates can't recurse forever.
let delegateDepth = 0;
cfg.runSubtask = async (task, max) => {
  if (delegateDepth >= 2) throw new Error('delegate depth limit (2) reached');
  const keep = cfg.maxSteps;
  if (max) cfg.maxSteps = Math.min(Number(max) || 5, 10);
  delegateDepth++;
  try { return await agentTask(String(task)); }
  finally { delegateDepth--; cfg.maxSteps = keep; }
};

main();
