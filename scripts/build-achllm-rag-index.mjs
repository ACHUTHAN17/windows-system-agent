import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAndWriteRagIndex } from '../src/achllm-rag.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
console.log(JSON.stringify(buildAndWriteRagIndex(root)));
