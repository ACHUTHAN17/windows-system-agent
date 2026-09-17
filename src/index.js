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
import { needsApproval, askYesNo, audit } from './safety.js';

const argv = parseArgs(process.argv.slice(2));
const cfg = loadConfig(argv);
const tools = buildTools();
const byName = Object.fromEntries(tools.map(t => [t.name, t]));

function parseArgs(raw) {
  const o = { _: [] };
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--selftest') o.selftest = true;
    else if (a === '--once') o.once = true;
    else if (a === '--model') o.MODEL_NAME = raw[++i];
    else if (a === '--url') o.MODEL_API_URL = raw[++i];
    else if (a === '--provider') o.MODEL_PROVIDER = raw[++i];
    else if (a.startsWith('--')) o[a.slice(2).toUpperCase()] = raw[++i] ?? 'true';
    else o._.push(a);
  }
  return o;
}

function loadSkills(argv, cfg) {
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
  for (let name of wanted) {
    if (!name.endsWith('.md')) name += '.md';
    try { loaded.push({ name, text: fs.readFileSync(path.join(cfg.root, 'skills', path.basename(name)), 'utf8').slice(0, 12000) }); }
    catch { console.log(`  [skill] not found: skills/${name}`); }
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
  if (needsApproval(cfg, name)) {
    audit(cfg, `APPROVAL-ASK ${name} ${JSON.stringify(args).slice(0, 400)}`);
    const yes = await askYesNo(`Allow ${name} ${JSON.stringify(args).slice(0, 300)}?`);
    if (!yes) { audit(cfg, `APPROVAL-DENY ${name}`); return { ok: false, error: 'denied by user', hint: 'User declined approval. Explain and stop or propose a read-only alternative.' }; }
  }
  const res = await tool.run(args || {}, { cfg });
  audit(cfg, `TOOL ${name} args=${JSON.stringify(args).slice(0, 300)} -> ${JSON.stringify(res).slice(0, 500)}`);
  return res;
}

async function agentTask(task) {
  const skills = loadSkills(argv, cfg);
  if (skills.length) console.log(`  [skills] ${skills.map(s => s.name).join(', ')}`);
  const history = [
    { role: 'system', content: systemPrompt(toolPrompt(tools)) + skillPrompt(skills) },
    { role: 'user', content: task },
  ];
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
  const sk = loadSkills(argv, cfg);
  console.log(` skills: ${sk.length ? sk.map(s => s.name + ' (' + s.text.length + ' chars)').join(', ') : '(none loaded — try --skill wordpress-build)'}`);
  const checks = [];
  for (const [name, args] of [['sys_info', {}], ['file_list', { path: cfg.root }], ['app_list', {}], ['window_list', {}]]) {
    try {
      const r = await byName[name].run(args, { cfg });
      checks.push(`${r.ok ? 'PASS' : 'FAIL'} ${name}`);
      console.log(` ${r.ok ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(r).slice(0, 300)}`);
    } catch (e) { checks.push(`FAIL ${name}: ${e.message}`); console.log(` FAIL ${name}: ${e.message}`); }
  }
  console.log(checks.every(c => c.startsWith('PASS')) ? 'SELFTEST OK' : 'SELFTEST HAD FAILURES (see above)');
}

async function repl() {
  console.log(`WinAgent ready — ${printActiveModel(cfg)}`);
  console.log('Type a task, or: exit | model | tools | selftest\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = (s) => new Promise((res) => rl.question(s, res));
  for (;;) {
    const line = (await q('win-agent> ')).trim();
    if (!line) continue;
    if (/^(exit|quit)$/i.test(line)) break;
    if (line === 'model') { console.log(' ' + printActiveModel(cfg)); continue; }
    if (line === 'tools') { console.log(' ' + Object.keys(byName).join(', ')); continue; }
    if (line === 'skills') { try { console.log(' ' + fs.readdirSync(path.join(cfg.root, 'skills')).filter(f => f.endsWith('.md')).join(', ')); } catch { console.log(' (no skills dir)'); } continue; }
    if (line === 'selftest') { await selftest(); continue; }
    try { console.log('\n' + await agentTask(line) + '\n'); }
    catch (e) { console.log('\nERROR: ' + e.message + '\n'); }
  }
  rl.close();
}

async function main() {
  if (argv.selftest) return selftest();
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

main();
