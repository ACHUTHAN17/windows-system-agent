// Public-corpus ingestion for WinAgent Seed. Every fetched page records its
// source, revision timestamp and licence so training data remains attributable.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { trainSeedLm } from './seed-lm.js';

export const WIKIMEDIA_LICENSE = 'CC BY-SA 4.0 and GFDL (see source page)';
export const ULTRACHAT_LICENSE = 'MIT';
export const ULTRACHAT_SOURCE = 'https://huggingface.co/datasets/HuggingFaceH4/ultrachat_200k';
export const ACHLLM_FOUNDER = 'Mr. Mohana Achuthan';
export const CHAT_FEEDBACK_LICENSE = 'User-provided conversation donated with explicit consent for AchLLM training';
const clean = (value) => String(value || '').replace(/\[[0-9]+\]/g, '').replace(/\s+/g, ' ').trim();
const CODE_REQUEST = /```|\b(?:code|program|function|script|algorithm|debug|bug|error|exception|compile|syntax|api|sql|regex|python|javascript|typescript|node(?:\.js)?|react|html|css|java|kotlin|swift|rust|golang|c\+\+|c#|bash|powershell|linux|git)\b/i;
const SECRET_PATTERN = /\b(?:api[_ -]?key|access[_ -]?token|secret|password|passwd|private[_ -]?key|authorization)\b\s*(?:=|:|is)\s*\S+/i;

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

// The code lane is deliberately a subset of the same MIT-licensed public
// teacher data.  This avoids mixing in code with unclear per-file licensing
// while giving the model instruction -> implementation examples.
export function recordsFromUltraChatCode(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return rows.map((entry) => {
    const row = entry?.row || entry || {};
    const messages = Array.isArray(row.messages) ? row.messages : [];
    const userText = messages.filter((message) => String(message.role).toLowerCase() === 'user').map((message) => clean(message.content)).join('\n');
    const assistantText = messages.filter((message) => String(message.role).toLowerCase() === 'assistant').map((message) => String(message.content || '').trim()).join('\n');
    if (!CODE_REQUEST.test(userText) || assistantText.length < 80) return null;
    // Preserve line breaks and indentation in code targets.  Collapsing them
    // would turn Python, YAML, and formatted examples into invalid training data.
    const text = messages.map((message) => `${message.role || 'user'}: ${String(message.content || '').trim()}`).filter((line) => !line.endsWith(':')).join('\n');
    if (text.length < 180) return null;
    const key = row.prompt_id || entry.row_idx || crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
    return {
      id: `ultrachat-code-${key}`, source: ULTRACHAT_SOURCE, title: 'UltraChat public code teacher trace',
      teacher: 'UltraChat200k public teacher target', text: text.slice(0, 16_000), license: ULTRACHAT_LICENSE,
      domain: 'code', collectedAt: new Date().toISOString(),
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

export async function fetchUltraChatCodeRecords({ count = 2, offset = 0, fetchImpl = fetch } = {}) {
  // Scan a bounded window because coding prompts are interleaved with chat.
  const scan = Math.max(1, Math.min(10, Math.max(Number(count) || 2, 6)));
  const query = new URLSearchParams({ dataset: 'HuggingFaceH4/ultrachat_200k', config: 'default', split: 'train_sft', offset: String(Math.max(0, Number(offset) || 0)), length: String(scan) });
  const response = await fetchImpl(`https://datasets-server.huggingface.co/rows?${query}`, {
    headers: { 'User-Agent': 'AchLLM-chat-code/1.39 (https://github.com/ACHUTHAN17/windows-system-agent)' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`UltraChat dataset API HTTP ${response.status}`);
  return { scanned: scan, records: recordsFromUltraChatCode(await response.json()).slice(0, Math.max(1, Math.min(10, Number(count) || 2))) };
}

export function appendRecords(root, records, { corpusName = 'chat-code-corpus.txt' } = {}) {
  const dir = path.join(root, 'models', 'seed-data');
  fs.mkdirSync(dir, { recursive: true });
  const manifest = path.join(dir, 'manifest.jsonl');
  const existing = new Set();
  try { for (const line of fs.readFileSync(manifest, 'utf8').split(/\r?\n/)) if (line) existing.add(JSON.parse(line).id); } catch {}
  const accepted = records.filter((record) => !existing.has(record.id));
  if (!accepted.length) return 0;
  const corpus = accepted.map((record) => `${record.title}\n${record.text}\n`).join('\n');
  fs.appendFileSync(path.join(dir, corpusName), corpus);
  fs.appendFileSync(manifest, accepted.map((record) => JSON.stringify({ ...record, text: undefined })).join('\n') + '\n');
  return accepted.length;
}

// Chat learning is opt-in. A conversation is queued locally first, then the
// trainer promotes it into the attributable corpus on its next cycle. This
// deliberately rejects likely credentials and never reads a user's chat
// history without an explicit consent flag from the chat UI.
export function recordFromDonatedChat(payload) {
  if (payload?.consent !== true) throw new Error('explicit training consent is required');
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  if (messages.length < 2 || messages.length > 12) throw new Error('feedback must contain 2 to 12 messages');
  const normalized = messages.map((message) => {
    const role = String(message?.role || '').toLowerCase();
    if (!['user', 'assistant'].includes(role)) throw new Error('feedback messages must be user or assistant turns');
    const content = String(message?.content || '').trim();
    if (!content) throw new Error('feedback messages cannot be empty');
    return { role, content: content.slice(0, 6_000) };
  });
  const text = normalized.map((message) => `${message.role}: ${message.content}`).join('\n');
  if (text.length < 20) throw new Error('feedback is too short to train');
  if (SECRET_PATTERN.test(text)) throw new Error('feedback appears to contain a credential and was not stored');
  const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 24);
  return {
    id: `donated-chat-${hash}`,
    source: 'AchLLM opt-in chat donation',
    title: 'User-donated AchLLM chat feedback',
    text,
    license: CHAT_FEEDBACK_LICENSE,
    domain: CODE_REQUEST.test(text) ? 'code' : 'chat',
    collectedAt: new Date().toISOString(),
  };
}

export function queueDonatedChat(root, payload) {
  const record = recordFromDonatedChat(payload);
  const dir = path.join(root, 'models', 'seed-data');
  fs.mkdirSync(dir, { recursive: true });
  const pending = path.join(dir, 'donated-chat.pending.jsonl');
  const existing = new Set(safeJsonLines(pending).map((row) => row.id));
  if (!existing.has(record.id)) fs.appendFileSync(pending, `${JSON.stringify(record)}\n`);
  return { id: record.id, queued: !existing.has(record.id), domain: record.domain };
}

function safeJsonLines(file) {
  try { return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); } catch { return []; }
}

export function promoteDonatedChats(root) {
  const pending = path.join(root, 'models', 'seed-data', 'donated-chat.pending.jsonl');
  const records = safeJsonLines(pending);
  if (!records.length) return { promoted: 0, queued: 0 };
  const promoted = appendRecords(root, records);
  fs.writeFileSync(pending, '');
  return { promoted, queued: records.length };
}

export function trainLiveSeed(root, { maxBytes = 4_000_000 } = {}) {
  const base = path.join(root, 'models', 'achllm.corpus.txt');
  const chatCodeCorpus = path.join(root, 'models', 'seed-data', 'chat-code-corpus.txt');
  const chunks = [];
  // Do not reuse legacy general-web or mixed public corpora in the live
  // checkpoint.  The new model scope is conversational and code-oriented.
  const foundation = path.join(root, 'models', 'achllm.foundation.txt');
  for (const file of [foundation, base, chatCodeCorpus]) {
    try { chunks.push(fs.readFileSync(file, 'utf8')); } catch {}
  }
  const corpus = chunks.join('\n').slice(-maxBytes);
  if (corpus.length < 300) throw new Error('not enough local Seed corpus to train');
  const model = trainSeedLm(corpus, { order: Number(process.env.SEED_ORDER || 4), maxBytes });
  const output = path.join(root, 'models', 'achllm.live.model.json');
  fs.writeFileSync(output, JSON.stringify(model));
  return { model, output, corpusBytes: Buffer.byteLength(corpus) };
}
