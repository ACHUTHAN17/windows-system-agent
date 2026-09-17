// Chat-to-skill worker: learns a topic from the web and installs it as a
// skill — runs on GitHub Actions (no PC needed) or locally. Zero dependencies.
// Env: TOPIC (required, "teach:" prefix stripped), FILENAME_HINT (opt),
//   LLM_API_URL + LLM_API_KEY + LLM_MODEL (opt — real distill; else heuristic).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function textOf(html) {
  let t = String(html || '');
  t = t.replace(new RegExp('<script' + '[^]*?</' + 'script>', 'gi'), ' ');
  t = t.replace(new RegExp('<style' + '[^]*?</' + 'style>', 'gi'), ' ');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/&(nbsp|amp|quot|lt|gt|#39);/g, (m, e) => ({ nbsp: ' ', amp: '&', quot: '"', lt: '<', gt: '>', '#39': "'" }[e] || ' '));
  t = t.replace(/&#([0-9]+);/g, (m, d) => { try { return String.fromCharCode(Number(d)); } catch { return ' '; } });
  return t.replace(/\s+/g, ' ').trim();
}

async function webSearch(query, max = 5) {
  const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WinAgent-learn/1.0)' },
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
    out.push({ title: textOf(m[2]).slice(0, 150), url });
  }
  return out;
}

async function scrape(url, maxChars = 5000) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WinAgent-learn/1.0)' } });
  if (!res.ok) return null;
  const html = await res.text();
  const title = textOf((html.match(new RegExp('<title[^>]*>([^]*?)</' + 'title>', 'i')) || ['', ''])[1]).slice(0, 150);
  return { title, text: textOf(html).slice(0, maxChars) };
}

async function distillLLM(topic, material) {
  const base = String(process.env.LLM_API_URL || '').replace(/\/+$/, '');
  const key = process.env.LLM_API_KEY || '';
  const model = process.env.LLM_MODEL || '';
  if (!base || !key || !model) return null;
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Write a concise agent skill in markdown: title, when-to-use, numbered steps naming exact tools where possible, safety notes. No code fences around the whole reply.' },
        { role: 'user', content: `Topic: ${topic}\nResearch:\n${material.slice(0, 9000)}` },
      ],
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  let text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  text = text.replace(/^```[a-z]*\n/i, '').replace(/\n```\s*$/, '').trim();
  return text.length > 200 ? text.slice(0, 12000) : null;
}

function heuristicSkill(topic, sources) {
  const date = new Date().toISOString().slice(0, 10);
  const steps = [];
  for (const s of sources) {
    for (const line of s.text.split(/\. /).slice(0, 60)) {
      const t = line.trim();
      if (/^(step|tip|note|how|to |use |open |click |press |run |type |first|then|finally|\d+[.)])/i.test(t) && t.length > 30 && t.length < 300) {
        steps.push(t);
        if (steps.length >= 12) break;
      }
    }
    if (steps.length >= 12) break;
  }
  const links = sources.map(s => `- ${s.title || s.url}\n  ${s.url}`).join('\n');
  return `# Skill: ${topic}\n\nAuto-learned ${date} from the web (heuristic pass — ask for a refresh once an LLM key is configured).\n\n## When to use\nWhen the task mentions ${topic}.\n\n## Steps\n${steps.length ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : '1. See sources below and follow the official docs.'}\n\n## Verify\n- Re-check one fact against a second source before acting on it.\n- Never run destructive commands from a single source.\n\n## Sources\n${links}\n`;
}

async function main() {
  let topic = String(process.env.TOPIC || '').trim().replace(/^(teach|learn|skill)\s*:\s*/i, '').trim();
  if (!topic) throw new Error('TOPIC env is required');
  topic = topic.slice(0, 120);
  let hint = String(process.env.FILENAME_HINT || '').replace(/[^a-z0-9-_]/gi, '').slice(0, 40);
  const rm = topic.match(/refresh(?: and verify)?(?: the)? ([a-z0-9][a-z0-9-_ ]{1,40}?) skill/i);
  if (!hint && rm) hint = rm[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const slug = hint || topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'skill';
  console.log(`[learn] topic: ${topic} -> skills/${slug}.md`);
  const hits = await webSearch(topic + ' guide documentation', 5);
  console.log(`[learn] ${hits.length} search hits`);
  const sources = [];
  for (const h of hits.slice(0, 3)) {
    try {
      const p = await scrape(h.url);
      if (p && p.text.length > 300) { sources.push({ ...h, text: p.text }); console.log(`[learn] scraped ${h.url.slice(0, 70)} (${p.text.length} chars)`); }
    } catch (e) { console.log(`[learn] skip ${h.url.slice(0, 60)}: ${e.message}`); }
    if (sources.map(s => s.text.length).reduce((a, b) => a + b, 0) > 12000) break;
  }
  if (!sources.length) throw new Error('no material found — try a more specific topic');
  const material = sources.map(s => `## ${s.title} (${s.url})\n${s.text}`).join('\n');
  let content = await distillLLM(topic, material).catch(() => null);
  let mode = 'llm';
  if (!content) { content = heuristicSkill(topic, sources); mode = 'heuristic'; }
  const rel = `skills/${slug}.md`;
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) {
    const add = `\n\n---\n## Field update ${new Date().toISOString().slice(0, 10)}\n${content.slice(0, 4000)}\n`;
    fs.appendFileSync(full, add, 'utf8');
    console.log(`[learn] updated existing ${rel} (${mode})`);
  } else {
    fs.writeFileSync(full, content, 'utf8');
    console.log(`[learn] installed ${rel} (${mode})`);
  }
  spawnSync(process.execPath, [path.join(ROOT, 'src', 'build-docs.js')], { stdio: 'inherit' });
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `skill_file=${rel}\nmode=${mode}\n`);
  console.log(`[learn] done: ${rel} [${mode}]`);
}

main().catch(e => { console.error('[learn] FATAL: ' + (e.message || e)); process.exit(1); });
