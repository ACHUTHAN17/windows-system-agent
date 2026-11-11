// OpenAI-compatible local research endpoint for measuring Seed. It binds to
// loopback and is deliberately not enabled as WinAgent's live agent brain.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { completeSeedLm } from '../src/seed-lm.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.env.SEED_MODEL || path.join(root, 'models', 'achllm.model.json');
const port = Number(process.env.SEED_PORT || 8091);
let model = JSON.parse(fs.readFileSync(file, 'utf8'));
let mtime = fs.statSync(file).mtimeMs;
function currentModel() {
  const next = fs.statSync(file).mtimeMs;
  if (next !== mtime) { model = JSON.parse(fs.readFileSync(file, 'utf8')); mtime = next; }
  return model;
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET' && req.url === '/v1/models') return res.end(JSON.stringify({ object: 'list', data: [{ id: 'achllm', object: 'model' }] }));
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') { res.statusCode = 404; return res.end(JSON.stringify({ error: 'not found' })); }
  let raw = ''; for await (const chunk of req) raw += chunk;
  try {
    const body = JSON.parse(raw); const prompt = (body.messages || []).map((m) => `${m.role}: ${m.content}`).join('\n');
    const content = completeSeedLm(currentModel(), prompt, { maxBytes: Math.min(256, Number(body.max_tokens || 160)) });
    res.end(JSON.stringify({ id: `achllm-${Date.now()}`, object: 'chat.completion', model: 'achllm', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
  } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: { message: error.message } })); }
});
server.listen(port, '127.0.0.1', () => console.log(`AchLLM research endpoint: http://127.0.0.1:${port}/v1`));
