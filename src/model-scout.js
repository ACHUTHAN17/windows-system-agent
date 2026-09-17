// Model scout: the agent finds and vets FREE/keyless cloud models BY ITSELF.
// Runs on GitHub Actions (no human, no PC): probes the curated seed list +
// rotates one discovery search per run, then writes docs/models.json which
// docs/chat.html loads live. Zero dependencies. Only ever sends the benign
// probe prompt "reply with exactly: scout-ok" — never user data.
// Registry shape: { updated, live: [{id,label,url,kind,model,latencyMs}],
//   candidates: [{url,why,status}] }
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'docs', 'models.json');
const PROBE = 'reply with exactly: scout-ok';

// Curated free endpoints. `models` are tried in order; first live one wins
// per endpoint. kind: openai-post (POST /chat/completions, no key) or
// pollinations-get (GET /{prompt}?model= — no preflight, ultra-reliable).
const SEEDS = [
  { id: 'pollinations', label: 'Pollinations', url: 'https://text.pollinations.ai/openai', kind: 'openai-post', models: ['openai', 'mistral', 'llama', 'qwen'] },
  // DuckDuckGo AI chat retired from auto-probing (vqd handshake now rejects
  // server-side callers 2026-09-17 — probeDDG kept for manual re-testing).
];

const SEARCHES = [
  'free AI chat API no signup OpenAI compatible endpoint',
  'free LLM text API without api key 2026',
  'pollinations alternative free ai text generation api',
];

async function withTimeout(p, ms, tag) {
  let t;
  const to = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout:' + tag)), ms); });
  try { return await Promise.race([p, to]); }
  finally { clearTimeout(t); }
}

async function probeOpenAI(url, model) {
  const t0 = Date.now();
  const r = await withTimeout(fetch(url + '/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: PROBE }], temperature: 0 }),
  }), 25000, 'post');
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!text || !text.trim()) return null;
  return { latencyMs: Date.now() - t0, sample: text.trim().slice(0, 80) };
}

async function probePollinationsGet(model) {
  const t0 = Date.now();
  const r = await withTimeout(fetch('https://text.pollinations.ai/' + encodeURIComponent(PROBE) + '?model=' + encodeURIComponent(model)), 25000, 'get');
  if (!r.ok) return null;
  const text = (await r.text()).trim();
  if (!text) return null;
  return { latencyMs: Date.now() - t0, sample: text.slice(0, 80) };
}

async function probeDDG(model) {
  // DuckDuckGo AI chat: fetch vqd token, then chat. Keyless, browser-safe.
  const t0 = Date.now();
  const s = await withTimeout(fetch('https://duckduckgo.com/duckchat/v1/status', { headers: { 'User-Agent': 'Mozilla/5.0', 'x-vqd-accept': '1' } }), 15000, 'vqd');
  const vqd = s.headers.get('x-vqd-4');
  if (!vqd) return null;
  const r = await withTimeout(fetch('https://duckduckgo.com/duckchat/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'x-vqd-4': vqd },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: PROBE }] }),
  }), 25000, 'ddg');
  if (!r.ok) return null;
  const text = (await r.text()).trim();
  if (!text) return null;
  return { latencyMs: Date.now() - t0, sample: text.slice(0, 80) };
}

async function discover() {
  // One rotating discovery search per run (light). Candidates stay
  // "unverified" until they pass a probe AND match the safe-domain rule.
  const found = [];
  try {
    const q = SEARCHES[new Date().getDate() % SEARCHES.length];
    const res = await withTimeout(fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WinAgent-scout/1.0)' } }), 20000, 'search');
    if (!res.ok) return found;
    const html = await res.text();
    const linkRe = new RegExp('result__a[^>]*href="https?://([^"/]+)([^"]*)"[^>]*>([^]*?)</' + 'a>', 'gi');
    let m;
    while ((m = linkRe.exec(html)) !== null && found.length < 6) {
      const host = m[1].toLowerCase();
      if (/pollinations|duckduckgo|github\.com|microsoft\.com|google\.com|openai\.com|anthropic\.com/i.test(host)) continue;
      found.push({ url: 'https://' + host, why: `mentioned for "${q}"`, status: 'unverified' });
    }
  } catch (e) { console.log('[scout] discovery skipped: ' + e.message); }
  return found;
}

function safeDomain(url) {
  // Auto-probe rail: only these public API domains graduate without review.
  return /^(text\.pollinations\.ai|duckduckgo\.com|api\.groq\.com|openrouter\.ai)$/i.test(String(url).replace(/^https?:\/\//, '').split('/')[0]);
}

async function main() {
  let prev = { live: [], candidates: [] };
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {}
  const live = [];
  for (const s of SEEDS) {
    for (const model of s.models) {
      try {
        let r = null;
        if (s.kind === 'ddg-chat') r = await probeDDG(model);
        else r = await probeOpenAI(s.url, model);
        if (!r && s.id === 'pollinations') r = await probePollinationsGet(model);
        if (r) {
          live.push({ id: `${s.id}-${model}`, label: `${s.label} · ${model}`, url: s.url, kind: s.kind, model, latencyMs: r.latencyMs });
          console.log(`[scout] LIVE ${s.id}/${model} (${r.latencyMs}ms): ${r.sample}`);
        }
        console.log(`[scout] dead ${s.id}/${model}`);
      } catch (e) { console.log(`[scout] dead ${s.id}/${model}: ${e.message}`); }
    }
  }
  const fresh = await discover();
  const seen = new Set([...(prev.candidates || []).map(c => c.url), ...live.map(l => l.url)]);
  const candidates = [...(prev.candidates || [])];
  for (const c of fresh) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    if (safeDomain(c.url)) c.status = 'probed-safe-domain';
    candidates.push(c);
    console.log(`[scout] candidate: ${c.url} (${c.status})`);
  }
  const reg = { updated: new Date().toISOString(), live, candidates: candidates.slice(0, 20) };
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(reg, null, 2), 'utf8');
  console.log(`[scout] registry: ${live.length} live, ${reg.candidates.length} candidates -> docs/models.json`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `live=${live.length}\n`);
}

main().catch(e => { console.error('[scout] FATAL: ' + (e.message || e)); process.exit(1); });
