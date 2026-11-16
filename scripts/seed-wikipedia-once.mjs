// The first network training pass after each trainer start is Wikimedia only.
// This is bounded, licensed, and recorded before later chat/code batches run.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendRecords, fetchWikimediaRecords, trainLiveSeed } from '../src/seed-training.js';
import { buildAndWriteRagIndex } from '../src/achllm-rag.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requested = Math.max(1, Math.min(10, Number(process.env.SEED_WIKIMEDIA_BATCH_SIZE || 5)));
const records = await fetchWikimediaRecords({ count: requested });
const added = appendRecords(root, records);
const trained = trainLiveSeed(root, { maxBytes: Number(process.env.SEED_MAX_BYTES || 4_000_000) });
const rag = buildAndWriteRagIndex(root);
console.log(JSON.stringify({ kind: 'wikipedia-first-training', fetched: records.length, added, corpusBytes: trained.corpusBytes, trainedBytes: trained.model.trainedBytes, rag }));
