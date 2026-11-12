// One teacher-student distillation cycle using a small public, MIT-licensed
// UltraChat sample. The cursor advances so every cycle sees fresh examples.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendRecords, fetchUltraChatCodeRecords, trainLiveSeed } from '../src/seed-training.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = path.join(root, 'models', 'seed-data', 'ultrachat-code-cursor.json');
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
let offset = 0;
try { offset = Number(JSON.parse(fs.readFileSync(stateFile, 'utf8')).offset) || 0; } catch {}
const requested = Math.max(1, Math.min(10, Number(process.env.SEED_DISTILL_BATCH_SIZE || 2)));
const batch = await fetchUltraChatCodeRecords({ count: requested, offset });
const added = appendRecords(root, batch.records);
fs.writeFileSync(stateFile, JSON.stringify({ offset: (offset + batch.scanned) % 207865, updatedAt: new Date().toISOString(), source: 'HuggingFaceH4/ultrachat_200k', license: 'MIT', domain: 'code' }));
const result = trainLiveSeed(root, { maxBytes: Number(process.env.SEED_MAX_BYTES || 4_000_000) });
console.log(JSON.stringify({ kind: 'code-teacher-distillation', scanned: batch.scanned, fetched: batch.records.length, added, offset, corpusBytes: result.corpusBytes, trainedBytes: result.model.trainedBytes, model: result.output }));
