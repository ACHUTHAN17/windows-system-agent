// Public-corpus ingestion for WinAgent Seed. Every fetched page records its
// source, revision timestamp and licence so training data remains attributable.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { trainSeedLm } from './seed-lm.js';

export const WIKIMEDIA_LICENSE = 'CC BY-SA 4.0 and GFDL (see source page)';
export const ULTRACHAT_LICENSE = 'MIT';
export const ULTRACHAT_SOURCE = 'https://huggingface.co/datasets/HuggingFaceH4/ultrachat_200k';
const clean = (value) => String(value || '').replace(/\[[0-9]+\]/g, '').replace(/\s+/g, ' ').trim();

export function recordsFromWikimedia(payload) {
  const pages = Array.isArray(payload?.query?.pages) ? payload.query.pages : [];
  return pages.map((page) => {
    const text = clean(page.extract);
    const title = clean(page.title);
    if (!title || text.length < 300) return null;
    return {
      id: `wikipedia-${page.pageid || crypto.createHash('sha256').update(title).digest('hex').slice(0, 16)}`,
      source: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      title, text: text.slice(0, 12_000), license: WIKIMEDIA_LICENSE,
      collectedAt: new Date().toISOString(),
    };
  }).filter(Boolean);
}

export async function fetchWikimediaRecords({ count = 5, fetchImpl = fetch, userAgent } = {}) {
  const query = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', generator: 'random', grnnamespace: '0', grnlimit: String(Math.max(1, Math.min(10, count))), prop: 'extracts', explaintext: '1' });
  const response = await fetchImpl(`https://en.wikipedia.org/w/api.php?${query}`, {
    headers: { 'User-Agent': userAgent || 'WinAgent-Seed/1.37 (https://github.com/ACHUTHAN17/windows-system-agent)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Wikimedia API HTTP ${response.status}`);
  return recordsFromWikimedia(await response.json());
}

// UltraChat is an MIT-licensed public instruction dataset. The assistant turns
// are retained as teacher targets and the user turns as the student context;
// no private prompt, API key, or live provider output is collected.
export function recordsFromUltraChat(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return rows.map((entry) => {
    const row = entry?.row || entry || {};
    const messages = Array.isArray(row.messages) ? row.messages : [];
    const text = messages.map((message) => `${message.role || 'user'}: ${clean(message.content)}`).filter((line) => !line.endsWith(':')).join('\n');
    const hasTeacher = messages.some((message) => String(message.role).toLowerCase() === 'assistant' && clean(message.content).length >= 80);
    if (!hasTeacher || text.length < 300) return null;
    const key = row.prompt_id || entry.row_idx || crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
    return {
      id: `ultrachat-${key}`, source: ULTRACHAT_SOURCE, title: 'UltraChat public teacher trace',
      teacher: 'UltraChat200k public teacher target', text: text.slice(0, 16_000), license: ULTRACHAT_LICENSE,
      collectedAt: new Date().toISOString(),
    };
  }).filter(Boolean);
}

export async function fetchUltraChatRecords({ count = 2, offset = 0, fetchImpl = fetch } = {}) {
  const query = new URLSearchParams({ dataset: 'HuggingFaceH4/ultrachat_200k', config: 'default', split: 'train_sft', offset: String(Math.max(0, Number(offset) || 0)), length: String(Math.max(1, Math.min(10, Number(count) || 2))) });
  const response = await fetchImpl(`https://datasets-server.huggingface.co/rows?${query}`, {
    headers: { 'User-Agent': 'AchLLM-distillation/1.38 (https://github.com/ACHUTHAN17/windows-system-agent)' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`UltraChat dataset API HTTP ${response.status}`);
  return recordsFromUltraChat(await response.json());
}

export function appendRecords(root, records) {
  const dir = path.join(root, 'models', 'seed-data');
  fs.mkdirSync(dir, { recursive: true });
  const manifest = path.join(dir, 'manifest.jsonl');
  const existing = new Set();
  try { for (const line of fs.readFileSync(manifest, 'utf8').split(/\r?\n/)) if (line) existing.add(JSON.parse(line).id); } catch {}
  const accepted = records.filter((record) => !existing.has(record.id));
  if (!accepted.length) return 0;
  const corpus = accepted.map((record) => `${record.title}\n${record.text}\n`).join('\n');
  fs.appendFileSync(path.join(dir, 'public-corpus.txt'), corpus);
  fs.appendFileSync(manifest, accepted.map((record) => JSON.stringify({ ...record, text: undefined })).join('\n') + '\n');
  return accepted.length;
}

export function trainLiveSeed(root, { maxBytes = 4_000_000 } = {}) {
  const base = path.join(root, 'models', 'achllm.corpus.txt');
  const publicCorpus = path.join(root, 'models', 'seed-data', 'public-corpus.txt');
  const legacyWikimediaCorpus = path.join(root, 'models', 'seed-data', 'wikimedia-corpus.txt');
  const chunks = [];
  for (const file of [base, legacyWikimediaCorpus, publicCorpus]) {
    try { chunks.push(fs.readFileSync(file, 'utf8')); } catch {}
  }
  const corpus = chunks.join('\n').slice(-maxBytes);
  if (corpus.length < 300) throw new Error('not enough local Seed corpus to train');
  const model = trainSeedLm(corpus, { order: Number(process.env.SEED_ORDER || 4), maxBytes });
  const output = path.join(root, 'models', 'achllm.live.model.json');
  fs.writeFileSync(output, JSON.stringify(model));
  return { model, output, corpusBytes: Buffer.byteLength(corpus) };
}
