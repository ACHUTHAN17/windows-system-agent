import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trainSeedLm } from '../src/seed-lm.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusFile = process.env.SEED_CORPUS || path.join(root, 'models', 'winagent-seed.corpus.txt');
const outputFile = process.env.SEED_MODEL || path.join(root, 'models', 'winagent-seed.model.json');
const corpus = fs.readFileSync(corpusFile, 'utf8');
const model = trainSeedLm(corpus, { order: Number(process.env.SEED_ORDER || 4) });
fs.writeFileSync(outputFile, JSON.stringify(model));
console.log(`Trained WinAgent Seed from ${model.trainedBytes} bytes; wrote ${outputFile}`);
