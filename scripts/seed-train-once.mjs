import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendRecords, fetchUltraChatRecords, trainLiveSeed } from '../src/seed-training.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = path.join(root, 'models', 'seed-data', 'ultrachat-chat-cursor.json');
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
let offset = Number(process.env.SEED_CHAT_OFFSET || 0);
try { offset = Number(JSON.parse(fs.readFileSync(stateFile, 'utf8')).offset) || offset; } catch {}
const requested = Math.max(1, Math.min(10, Number(process.env.SEED_CHAT_BATCH_SIZE || 3)));
const records = await fetchUltraChatRecords({ count: requested, offset });
const added = appendRecords(root, records);
fs.writeFileSync(stateFile, JSON.stringify({ offset: (offset + requested) % 207865, updatedAt: new Date().toISOString(), source: 'HuggingFaceH4/ultrachat_200k', license: 'MIT', domain: 'chat' }));
const result = trainLiveSeed(root, { maxBytes: Number(process.env.SEED_MAX_BYTES || 4_000_000) });
console.log(JSON.stringify({ kind: 'chat-teacher-training', fetched: records.length, added, offset, corpusBytes: result.corpusBytes, trainedBytes: result.model.trainedBytes, model: result.output }));
