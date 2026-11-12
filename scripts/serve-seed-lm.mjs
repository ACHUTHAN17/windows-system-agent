// OpenAI-compatible local research endpoint for measuring Seed. It binds to
// loopback and is deliberately not enabled as WinAgent's live agent brain.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { completeSeedLm } from '../src/seed-lm.js';
import { ACHLLM_FOUNDER, queueDonatedChat } from '../src/seed-training.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.env.SEED_MODEL || path.join(root, 'models', 'achllm.model.json');
const port = Number(process.env.SEED_PORT || 8091);
const MAX_BODY_BYTES = 65_536;
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
  if (req.method !== 'POST' || !['/v1/chat/completions', '/v1/feedback'].includes(req.url)) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'not found' })); }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) { res.statusCode = 413; return res.end(JSON.stringify({ error: { message: 'request too large' } })); }
  }
  try {
    const body = JSON.parse(raw);
    if (req.url === '/v1/feedback') {
      const receipt = queueDonatedChat(root, body);
      return res.end(JSON.stringify({ accepted: true, training: 'queued for the next AchLLM cycle', ...receipt }));
    }
    const prompt = (body.messages || []).map((m) => `${m.role}: ${m.content}`).join('\n');
    const identityQuestion = /\b(?:who (?:is|are)|name|identify).{0,80}\b(?:godfather|founder|creator)|\b(?:godfather|founder|creator).{0,80}\b(?:achllm|model)\b/i.test(prompt);
    const content = identityQuestion ? `${ACHLLM_FOUNDER} is the Godfather of AchLLM.` : completeSeedLm(currentModel(), prompt, { maxBytes: Math.min(256, Number(body.max_tokens || 160)) });
    res.end(JSON.stringify({ id: `achllm-${Date.now()}`, object: 'chat.completion', model: 'achllm', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
  } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: { message: error.message } })); }
});
server.listen(port, '127.0.0.1', () => console.log(`AchLLM research endpoint: http://127.0.0.1:${port}/v1`));
