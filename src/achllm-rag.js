// CPU-first vector RAG for attributable AchLLM records. The sparse feature
// hashing index is deliberately dependency-free: it is fast enough for the
// small server and avoids pretending a local embedding model is available.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const RAG_FORMAT = 'achllm-hash-vector-rag-v1';
export const RAG_DIMENSIONS = 2048;
const CACHE = new Map();

export function canonicalUtf8Text(value) {
  const text = String(value ?? '');
  const bytes = Buffer.from(text, 'utf8');
  // JavaScript permits unpaired surrogates but UTF-8 does not. Refuse them
  // instead of silently replacing a character during corpus ingestion.
  if (bytes.toString('utf8') !== text) throw new Error('text is not losslessly encodable as UTF-8');
  return { text, bytes, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

function utf8FileText(file) {
  return new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
}

function indexPayload(index) {
  return JSON.stringify({ format: index.format, tokenizer: index.tokenizer, sourcePolicy: index.sourcePolicy, records: index.records, chunks: index.chunks, entries: index.entries });
}

export function ragIndexSha256(index) {
  return canonicalUtf8Text(indexPayload(index)).sha256;
}

export function verifyRagIndex(index) {
  const expected = String(index?.integrity?.contentSha256 || '');
  if (index?.format !== RAG_FORMAT || !/^[a-f0-9]{64}$/i.test(expected) || !Array.isArray(index?.entries)) return false;
  const actual = ragIndexSha256(index);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}

export function tokenizeNlp(value, { limit = 4096 } = {}) {
  // Combining marks are part of a word in scripts such as Tamil, Arabic, and
  // Devanagari; splitting them would corrupt multilingual retrieval tokens.
  const words = String(value || '').normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]*/gu) || [];
  return words.filter((word) => word.length > 1).slice(0, limit);
}

function hash(value) {
  let out = 2166136261;
  for (let i = 0; i < value.length; i++) { out ^= value.charCodeAt(i); out = Math.imul(out, 16777619); }
  return out >>> 0;
}

function sparseVector(tokens, dimensions = RAG_DIMENSIONS) {
  const counts = new Map();
  for (const token of tokens) {
    const value = hash(token);
    const slot = value % dimensions;
    counts.set(slot, (counts.get(slot) || 0) + (value & 1 ? 1 : -1));
  }
  const norm = Math.sqrt([...counts.values()].reduce((sum, value) => sum + value * value, 0)) || 1;
  return [...counts.entries()].map(([slot, value]) => [slot, value / norm]);
}

function sentences(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?。！？])\s+/u).filter(Boolean);
}

function chunksFor(record, maxChars = 800) {
  const out = [];
  let current = '';
  for (const sentence of sentences(record.text)) {
    if (current && current.length + sentence.length + 1 > maxChars) { out.push(current); current = ''; }
    current = `${current}${current ? ' ' : ''}${sentence}`;
  }
  if (current) out.push(current);
  return out.slice(0, 20);
}

function readJsonl(file) {
  try { return utf8FileText(file).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
  catch (error) { if (error?.code === 'ENOENT') return []; throw new Error(`RAG source is not valid UTF-8 JSONL: ${error.message}`); }
}

function isWikipedia(record) {
  // Both the location and attribution must match. A record which merely
  // claims a permissive licence does not enter the Wikipedia-first index.
  return /(^|\.)wikipedia\.org\//i.test(String(record?.source || '')) && /CC BY-SA.*GFDL/i.test(String(record?.license || ''));
}

export function buildRagIndex(records, { dimensions = RAG_DIMENSIONS } = {}) {
  const declared = records.filter((record) => record && record.id && record.text && record.source && record.license);
  const wikipedia = declared.filter(isWikipedia);
  // Wikipedia gets priority as the first RAG knowledge lane. When no such
  // record exists yet, leave the index empty rather than silently substituting
  // unknown material.
  const selected = wikipedia;
  const entries = [];
  const vocabulary = new Set();
  for (const record of selected) {
    const sourceText = canonicalUtf8Text(record.text);
    if (record.contentSha256 && record.contentSha256 !== sourceText.sha256) throw new Error(`RAG source hash mismatch for ${record.id}`);
    for (const text of chunksFor({ ...record, text: sourceText.text })) {
      const chunk = canonicalUtf8Text(text);
      const tokens = tokenizeNlp(text);
      if (tokens.length < 4) continue;
      tokens.forEach((token) => vocabulary.add(token));
      entries.push({ id: record.id, title: String(record.title || '').slice(0, 180), source: record.source, license: record.license, text: chunk.text.slice(0, 1000), contentSha256: chunk.sha256, tokens: tokens.length, vector: sparseVector(tokens, dimensions) });
    }
  }
  const index = { format: RAG_FORMAT, createdAt: new Date().toISOString(), tokenizer: { kind: 'unicode-word-feature-hash', normalization: 'NFKC', encoding: 'UTF-8', dimensions, vocabularyEntries: vocabulary.size }, sourcePolicy: 'Wikipedia records with explicit CC BY-SA 4.0/GFDL provenance only', records: selected.length, chunks: entries.length, entries };
  index.integrity = { algorithm: 'SHA-256', encoding: 'UTF-8', contentSha256: ragIndexSha256(index) };
  return index;
}

export function buildAndWriteRagIndex(root) {
  const source = path.join(root, 'models', 'seed-data', 'rag-records.jsonl');
  const target = path.join(root, 'models', 'achllm-rag', 'wikipedia-index.json');
  const index = buildRagIndex(readJsonl(source));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(index)}\n`);
  fs.renameSync(temporary, target);
  CACHE.delete(target);
  return { target, records: index.records, chunks: index.chunks, tokenizer: index.tokenizer };
}

function currentIndex(root) {
  const file = path.join(root, 'models', 'achllm-rag', 'wikipedia-index.json');
  try {
    const mtime = fs.statSync(file).mtimeMs;
    const prior = CACHE.get(file);
    if (prior?.mtime === mtime) return prior.index;
    const index = JSON.parse(utf8FileText(file));
    if (!verifyRagIndex(index)) throw new Error('RAG index integrity check failed');
    CACHE.set(file, { mtime, index });
    return index;
  } catch { return null; }
}

export function searchRag(root, query, { limit = 3, minScore = 0.12 } = {}) {
  const index = currentIndex(root);
  const tokens = tokenizeNlp(query);
  if (!index || !tokens.length || !Array.isArray(index.entries)) return { index: index ? { records: index.records, chunks: index.chunks } : null, queryTokens: tokens.length, results: [] };
  const queryVector = new Map(sparseVector(tokens, Number(index?.tokenizer?.dimensions) || RAG_DIMENSIONS));
  const results = [];
  for (const entry of index.entries) {
    let score = 0;
    for (const [slot, weight] of entry.vector || []) score += (queryVector.get(slot) || 0) * weight;
    if (score >= minScore) results.push({ id: entry.id, title: entry.title, source: entry.source, license: entry.license, text: entry.text, score: Number(score.toFixed(4)) });
  }
  results.sort((a, b) => b.score - a.score);
  return { index: { records: index.records, chunks: index.chunks, tokenizer: index.tokenizer }, queryTokens: tokens.length, results: results.slice(0, Math.max(1, Math.min(5, limit))) };
}
