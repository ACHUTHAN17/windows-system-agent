#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trainUsageModelAtRoot } from '../src/orchestra/usage-model.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { file, model } = trainUsageModelAtRoot(root);
console.log(`Trained ${model.algorithm} from ${model.examples} labelled agent-use examples.`);
console.log(`Model written: ${file}`);
