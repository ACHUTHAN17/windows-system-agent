// Small, local, zero-dependency task-routing model.  This is deliberately not
// an LLM: it is a multinomial Naive Bayes classifier trained from the project
// dataset.  It gives an offline installation a learnable, inspectable worker
// preference while the scheduler remains the execution and safety authority.
import fs from 'node:fs';
import path from 'node:path';

const LABELS = new Set(['native', 'hermes', 'openclaw', 'cloud']);
const TRAINING_FILE = path.join('models', 'agent-usage.training.jsonl');
const MODEL_FILE = path.join('models', 'agent-usage.model.json');

export function tokenize(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9_+-]{1,}/g) || [];
}

function readableSamples(samples) {
  return samples.filter((sample) => sample && LABELS.has(sample.label) && tokenize(sample.text).length);
}

export function trainUsageModel(samples) {
  const rows = readableSamples(samples);
  if (rows.length < 8) throw new Error('at least 8 labelled examples are required');
  const labels = {};
  const vocabulary = new Set();
  for (const row of rows) {
    const item = labels[row.label] ||= { docs: 0, tokens: 0, counts: {} };
    item.docs++;
    for (const token of tokenize(row.text)) {
      vocabulary.add(token);
      item.tokens++;
      item.counts[token] = (item.counts[token] || 0) + 1;
    }
  }
  return {
    schema: 'winagent-usage-model/v1', algorithm: 'multinomial-naive-bayes', trainedAt: new Date().toISOString(),
    examples: rows.length, vocabulary: [...vocabulary].sort(), labels,
  };
}

export function predictUsageModel(model, text) {
  if (!model || model.schema !== 'winagent-usage-model/v1' || !model.labels) return null;
  const terms = tokenize(text);
  const labels = Object.entries(model.labels).filter(([label, item]) => LABELS.has(label) && item?.docs > 0);
  if (!terms.length || !labels.length) return null;
  const totalDocs = labels.reduce((n, [, item]) => n + item.docs, 0);
  const vocabSize = Math.max(1, model.vocabulary?.length || 1);
  const scored = labels.map(([label, item]) => {
    let score = Math.log(item.docs / totalDocs);
    for (const term of terms) score += Math.log(((item.counts?.[term] || 0) + 1) / (item.tokens + vocabSize));
    return { label, score };
  }).sort((a, b) => b.score - a.score);
  const normalizer = scored.reduce((sum, item) => sum + Math.exp(item.score - scored[0].score), 0);
  const confidence = 1 / normalizer;
  return { label: scored[0].label, confidence, margin: scored.length > 1 ? scored[0].score - scored[1].score : Infinity, alternatives: scored };
}

export function readUsageTraining(root) {
  const file = path.join(root, TRAINING_FILE);
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    try { rows.push(JSON.parse(line)); } catch { throw new Error(`invalid JSONL in ${TRAINING_FILE}`); }
  }
  return rows;
}

export function trainUsageModelAtRoot(root) {
  const model = trainUsageModel(readUsageTraining(root));
  const file = path.join(root, MODEL_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(model, null, 2) + '\n');
  return { file, model };
}

export function loadUsageModel(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, MODEL_FILE), 'utf8')); } catch { return null; }
}

function configured(label, cfg) {
  if (label === 'hermes') return !!String(cfg.hermesCommand || '').trim();
  if (label === 'openclaw') return !!(String(cfg.openclawCommand || '').trim() || String(cfg.openclawUrl || '').trim());
  if (label === 'cloud') return !!(cfg.githubRepo && cfg.githubPat && cfg.cloudWorkflow);
  return true;
}

// Returns a suggestion only.  The caller retains native fallback when the
// learned preference has no owner-configured worker behind it.
export function suggestUsageWorker(goal, cfg = {}) {
  const prediction = predictUsageModel(loadUsageModel(cfg.root || process.cwd()), goal);
  if (!prediction || prediction.confidence < 0.45 || prediction.margin < 0.2) return { worker: 'native', source: 'usage-model-uncertain', prediction };
  if (!configured(prediction.label, cfg)) return { worker: 'native', source: 'usage-model-worker-unavailable', prediction };
  return { worker: prediction.label, source: 'usage-model', prediction };
}
