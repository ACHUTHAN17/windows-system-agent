'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('CPU vector RAG indexes only attributable Wikipedia records with Unicode tokens', async () => {
  const rag = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'achllm-rag.js')).href);
  assert.deepEqual(rag.tokenizeNlp('தமிழ் NLP — Operating systems 101'), ['தமிழ்', 'nlp', 'operating', 'systems', '101']);
  const index = rag.buildRagIndex([
    { id: 'wiki-1', source: 'https://en.wikipedia.org/wiki/Operating_system', title: 'Operating system', license: 'CC BY-SA 4.0 and GFDL', text: 'An operating system manages computer hardware resources and provides services for applications. It schedules tasks and manages memory.' },
    { id: 'other-1', source: 'https://example.com/private', title: 'Excluded', license: 'unknown', text: 'This must not be placed in the Wikimedia RAG index despite having many enough words for a chunk.' },
  ]);
  assert.equal(index.records, 1);
  assert.ok(index.chunks >= 1);
  assert.equal(index.tokenizer.kind, 'unicode-word-feature-hash');
  assert.equal(index.tokenizer.encoding, 'UTF-8');
  assert.equal(rag.verifyRagIndex(index), true);
  assert.match(index.entries[0].source, /wikipedia/);
});

test('RAG search reads only the persisted Wikipedia index', async () => {
  const rag = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'achllm-rag.js')).href);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'achllm-rag-'));
  try {
    const sourceDir = path.join(root, 'models', 'seed-data');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'rag-records.jsonl'), `${JSON.stringify({ id: 'wiki-os', source: 'https://en.wikipedia.org/wiki/Operating_system', title: 'Operating system', license: 'CC BY-SA 4.0 and GFDL', text: 'An operating system manages hardware resources, memory, processes, and application services.' })}\n`);
    const result = rag.buildAndWriteRagIndex(root);
    assert.equal(result.records, 1);
    const search = rag.searchRag(root, 'Which software manages processes and memory?');
    assert.equal(search.results.length, 1);
    assert.match(search.results[0].title, /Operating system/);
    const corrupted = { ...rag.buildRagIndex([{ id: 'wiki-2', source: 'https://en.wikipedia.org/wiki/Memory', title: 'Memory', license: 'CC BY-SA 4.0 and GFDL', text: 'Computer memory stores data and program instructions while a system executes tasks.' }]) };
    corrupted.entries[0].text = 'tampered text';
    assert.equal(rag.verifyRagIndex(corrupted), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
