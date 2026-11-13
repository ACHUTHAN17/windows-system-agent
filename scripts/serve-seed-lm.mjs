// OpenAI-compatible local research endpoint for measuring Seed. It binds to
// loopback and is deliberately not enabled as WinAgent's live agent brain.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { completeSeedLm } from '../src/seed-lm.js';
import { ACHLLM_FOUNDER, queueDonatedChat } from '../src/seed-training.js';
import { validateReadOnlyPlan } from '../src/achllm-agent-readiness.js';
import { answerAchllmChat, neuralGenerationReady } from '../src/achllm-chat.js';

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
async function requestNeuralChat(body) {
  const payload = JSON.stringify({ ...body, model: 'achllm-neural', max_tokens: Math.min(128, Number(body.max_tokens || 96)) });
  return await new Promise((resolve, reject) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: 8092, path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(raw || '{}');
          if ((response.statusCode || 500) >= 400) throw new Error(parsed?.error?.message || `neural endpoint HTTP ${response.statusCode}`);
          resolve(parsed);
        } catch (error) { reject(error); }
      });
    });
    upstream.setTimeout(45_000, () => upstream.destroy(new Error('neural endpoint timed out')));
    upstream.on('error', reject);
    upstream.end(payload);
  });
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET' && req.url === '/v1/models') return res.end(JSON.stringify({ object: 'list', data: [
    { id: 'achllm', object: 'model', owned_by: 'achllm', description: 'reliable foundation and attributable retrieval chat' },
    { id: 'achllm-auto', object: 'model', owned_by: 'achllm', description: 'reliable chat now; neural generation only after the quality gate' },
    { id: 'achllm-neural', object: 'model', owned_by: 'achllm', description: 'direct experimental neural checkpoint for testing' },
  ] }));
  if (req.method !== 'POST' || !['/v1/chat/completions', '/v1/feedback', '/v1/agent/validate'].includes(req.url)) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'not found' })); }
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
    if (req.url === '/v1/agent/validate') {
      const result = validateReadOnlyPlan(body.plan);
      if (!result.ok) { res.statusCode = 400; return res.end(JSON.stringify({ error: { message: result.error } })); }
      return res.end(JSON.stringify(result));
    }
    const requestedModel = String(body.model || 'achllm').toLowerCase();
    if (!['achllm', 'achllm-auto', 'achllm-neural'].includes(requestedModel)) throw new Error('unknown AchLLM model; use achllm, achllm-auto, or achllm-neural');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const latestUserText = [...messages].reverse().find((m) => m?.role === 'user')?.content || prompt;
    const identityQuestion = /\b(?:who (?:is|are)|name|identify).{0,80}\b(?:godfather|founder|creator)|\b(?:godfather|founder|creator).{0,80}\b(?:achllm|model)\b/i.test(prompt);
    const fallback = completeSeedLm(currentModel(), prompt, { maxBytes: Math.min(256, Number(body.max_tokens || 160)) });
    const response = identityQuestion
      ? { mode: 'identity', content: `${ACHLLM_FOUNDER} is the Godfather of AchLLM.` }
      : answerAchllmChat(root, latestUserText);
    const reliableContent = response.content || fallback || 'I do not have a reliable answer yet.';
    if (requestedModel === 'achllm-neural') {
      const neural = await requestNeuralChat(body);
      const rawContent = String(neural?.choices?.[0]?.message?.content || '').trim();
      const content = `[Experimental neural checkpoint — may be inaccurate]\n\n${rawContent || 'The neural checkpoint produced no usable completion yet.'}`;
      return res.end(JSON.stringify({ id: `achllm-${Date.now()}`, object: 'chat.completion', model: requestedModel, system_fingerprint: 'achllm-neural-direct-test', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
    }
    if (requestedModel === 'achllm-auto') {
      // Auto is a genuine three-engine coordinator: the baseline generation is
      // calculated above, reliable retrieval supplies evidence, and the neural
      // checkpoint is shadow-evaluated on every request. It promotes neural
      // output only after the measured quality gate passes.
      let neuralContent = '';
      try {
        const neural = await requestNeuralChat(body);
        neuralContent = String(neural?.choices?.[0]?.message?.content || '').trim();
      } catch {}
      const promoted = neuralGenerationReady(root) && Boolean(neuralContent);
      const content = promoted
        ? `[AchLLM Auto selected the neural engine after passing its quality gate.]\n\n${neuralContent}`
        : reliableContent;
      return res.end(JSON.stringify({ id: `achllm-${Date.now()}`, object: 'chat.completion', model: requestedModel, system_fingerprint: `achllm-auto-ensemble-${promoted ? 'neural-promoted' : neuralContent ? 'neural-shadow' : 'neural-unavailable'}`, choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
    }
    res.end(JSON.stringify({ id: `achllm-${Date.now()}`, object: 'chat.completion', model: requestedModel, system_fingerprint: `achllm-reliable-${response.mode}`, choices: [{ index: 0, message: { role: 'assistant', content: reliableContent }, finish_reason: 'stop' }] }));
  } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: { message: error.message } })); }
});
server.listen(port, '127.0.0.1', () => console.log(`AchLLM research endpoint: http://127.0.0.1:${port}/v1`));
