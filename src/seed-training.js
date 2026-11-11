// Public-corpus ingestion for WinAgent Seed. Every fetched page records its
// source, revision timestamp and licence so training data remains attributable.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { trainSeedLm } from './seed-lm.js';

export const WIKIMEDIA_LICENSE = 'CC BY-SA 4.0 and GFDL (see source page)';
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
  const query = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', generator: 'random', grnnamespace: '0', grnlimit: String(Math.max(1, Math.min(10, count))), prop: 'extracts', explaintext: '1', explaintext: '1' });
  const response = await fetchImpl(`https://en.wikipedia.org/w/api.php?${query}`, {
    headers: { 'User-Agent': userAgent || 'WinAgent-Seed/1.37 (https://github.com/ACHUTHAN17/windows-system-agent)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Wikimedia API HTTP ${response.status}`);
  return recordsFromWikimedia(await response.json());
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
  fs.appendFileSync(path.join(dir, 'wikimedia-corpus.txt'), corpus);
  fs.appendFileSync(manifest, accepted.map((record) => JSON.stringify({ ...record, text: undefined })).join('\n') + '\n');
  return accepted.length;
}

export function trainLiveSeed(root, { maxBytes = 4_000_000 } = {}) {
  const base = path.join(root, 'models', 'achllm.corpus.txt');
  const publicCorpus = path.join(root, 'models', 'seed-data', 'wikimedia-corpus.txt');
  const chunks = [];
  for (const file of [base, publicCorpus]) {
    try { chunks.push(fs.readFileSync(file, 'utf8')); } catch {}
  }
  const corpus = chunks.join('\n').slice(-maxBytes);
  if (corpus.length < 300) throw new Error('not enough local Seed corpus to train');
  const model = trainSeedLm(corpus, { order: Number(process.env.SEED_ORDER || 4), maxBytes });
  const output = path.join(root, 'models', 'achllm.live.model.json');
  fs.writeFileSync(output, JSON.stringify(model));
  return { model, output, corpusBytes: Buffer.byteLength(corpus) };
}
