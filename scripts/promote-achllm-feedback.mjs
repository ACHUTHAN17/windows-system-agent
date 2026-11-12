// Moves explicitly donated local feedback into the attributable training corpus.
// This process is deliberately separate from the public chat endpoint so that
// non-consenting chats never become training data.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promoteDonatedChats } from '../src/seed-training.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
console.log(JSON.stringify(promoteDonatedChats(root)));
