// AchLLM: a clean-room, byte-level language-model baseline.
//
// It intentionally imports no model weights, SDKs, or tokenizers.  Training
// learns conditional next-byte distributions directly from a local corpus.
// This is a genuine language model, but deliberately small enough to audit and
// train on a CPU; it is a research baseline, not a frontier-model substitute.

const START = '\u0002';
const END = '\u0003';
const VERSION = 1;

function bytes(text) { return Array.from(Buffer.from(String(text || ''), 'utf8')).map((n) => String.fromCharCode(n)); }
function fromBytes(chars) { return Buffer.from(chars.map((c) => c.charCodeAt(0))).toString('utf8'); }
function keyFor(chars) { return chars.map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''); }

function count(table, key, next) {
  let row = table.get(key);
  if (!row) { row = new Map(); table.set(key, row); }
  row.set(next, (row.get(next) || 0) + 1);
}

export function trainSeedLm(corpus, { order = 4, maxBytes = 4_000_000 } = {}) {
  if (!Number.isInteger(order) || order < 1 || order > 8) throw new Error('order must be an integer from 1 to 8');
  const table = new Map();
  const vocabulary = new Set();
  const rows = String(corpus || '').split(/\r?\n/).filter(Boolean);
  let seen = 0;
  for (const row of rows) {
    const sequence = [...Array(order).fill(START), ...bytes(row).slice(0, Math.max(0, maxBytes - seen)), END];
    seen += sequence.length;
    for (let i = order; i < sequence.length; i++) {
      const next = sequence[i];
      vocabulary.add(next);
      // Store every backoff order, so a new prompt always has a valid route.
      for (let n = 1; n <= order; n++) count(table, keyFor(sequence.slice(i - n, i)), next);
    }
    if (seen >= maxBytes) break;
  }
  const transitions = {};
  for (const [context, row] of table) transitions[context] = [...row.entries()].map(([token, n]) => [token.charCodeAt(0), n]);
  return {
    format: 'achllm', version: VERSION, order, trainedBytes: seen,
    vocabulary: [...vocabulary].map((c) => c.charCodeAt(0)).sort((a, b) => a - b), transitions,
  };
}

function rowFor(model, context) {
  const order = Math.min(Number(model?.order) || 0, context.length);
  for (let n = order; n >= 1; n--) {
    const row = model.transitions?.[keyFor(context.slice(-n))];
    if (row?.length) return row;
  }
  return [];
}

// Greedy decoding is deterministic, making responses reproducible for tests
// and making the baseline safe to evaluate. Sampling can be added only after a
// measured quality gate exists.
export function completeSeedLm(model, prompt, { maxBytes = 160 } = {}) {
  if (!model || model.format !== 'achllm') throw new Error('invalid AchLLM model');
  const context = [...Array(model.order).fill(START), ...bytes(prompt).slice(-model.order)];
  const out = [];
  for (let i = 0; i < maxBytes; i++) {
    const row = rowFor(model, context);
    if (!row.length) break;
    const [code] = row.slice().sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    const token = String.fromCharCode(code);
    if (token === END) break;
    out.push(token); context.push(token);
    while (context.length > model.order) context.shift();
  }
  return fromBytes(out);
}
