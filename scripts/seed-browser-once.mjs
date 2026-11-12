// One low-resource, browser-rendered public reference batch. Chromium runs in
// a temporary blank profile and is restricted to the versioned Wikimedia list.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendRecords, trainLiveSeed } from '../src/seed-training.js';
import { collectBrowserWikimediaRecords } from '../src/browser-learning.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = path.join(root, 'models', 'seed-data', 'browser-wikimedia-cursor.json');
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
let offset = Number(process.env.SEED_BROWSER_OFFSET || 0);
try { offset = Number(JSON.parse(fs.readFileSync(stateFile, 'utf8')).offset) || offset; } catch {}
const requested = Math.max(1, Math.min(2, Number(process.env.SEED_BROWSER_BATCH_SIZE || 1)));
const records = collectBrowserWikimediaRecords({ count: requested, offset });
const added = appendRecords(root, records);
fs.writeFileSync(stateFile, JSON.stringify({ offset: offset + requested, updatedAt: new Date().toISOString(), source: 'en.wikipedia.org allow-list via isolated headless Chromium', license: 'CC BY-SA 4.0 and GFDL', domain: 'browser' }));
const result = trainLiveSeed(root, { maxBytes: Number(process.env.SEED_MAX_BYTES || 4_000_000) });
console.log(JSON.stringify({ kind: 'browser-research-training', fetched: records.length, added, offset, corpusBytes: result.corpusBytes, trainedBytes: result.model.trainedBytes, model: result.output }));
