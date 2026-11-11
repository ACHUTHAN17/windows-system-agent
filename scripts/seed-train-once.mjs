import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendRecords, fetchWikimediaRecords, trainLiveSeed } from '../src/seed-training.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const records = await fetchWikimediaRecords({ count: Number(process.env.SEED_BATCH_SIZE || 5), userAgent: process.env.WIKIMEDIA_USER_AGENT });
const added = appendRecords(root, records);
const result = trainLiveSeed(root, { maxBytes: Number(process.env.SEED_MAX_BYTES || 4_000_000) });
console.log(JSON.stringify({ fetched: records.length, added, corpusBytes: result.corpusBytes, trainedBytes: result.model.trainedBytes, model: result.output }));
