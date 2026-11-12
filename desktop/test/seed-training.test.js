'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { recordsFromWikimedia, recordsFromUltraChat, recordsFromUltraChatCode } = require(path.join('..', '..', 'src', 'seed-training.js'));

test('public training ingestion keeps an attributable source and rejects tiny extracts', () => {
  const records = recordsFromWikimedia({ query: { pages: [
    { pageid: 7, title: 'Example page', extract: 'A'.repeat(400) },
    { pageid: 8, title: 'Tiny page', extract: 'too short' },
  ] } });
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].source, 'https://en.wikipedia.org/wiki/Example_page');
  assert.match(records[0].license, /CC BY-SA/);
});

test('teacher distillation ingestion preserves the public dataset source and MIT licence', () => {
  const records = recordsFromUltraChat({ rows: [{ row_idx: 42, row: { messages: [
    { role: 'user', content: 'Explain the task.' },
    { role: 'assistant', content: 'A'.repeat(360) },
  ] } }] });
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].id, 'ultrachat-42');
  assert.match(records[0].source, /ultrachat_200k/);
  assert.strictEqual(records[0].license, 'MIT');
  assert.match(records[0].teacher, /teacher/);
});

test('code lane keeps only attributable conversational code tasks', () => {
  const records = recordsFromUltraChatCode({ rows: [
    { row_idx: 17, row: { messages: [{ role: 'user', content: 'Write a Python function to reverse a string.' }, { role: 'assistant', content: 'def reverse(value):\n    return value[::-1]\n' + 'A'.repeat(90) }] } },
    { row_idx: 18, row: { messages: [{ role: 'user', content: 'Tell me a short story.' }, { role: 'assistant', content: 'A'.repeat(120) }] } },
  ] });
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].id, 'ultrachat-code-17');
  assert.strictEqual(records[0].domain, 'code');
  assert.strictEqual(records[0].license, 'MIT');
  assert.match(records[0].text, /\n    return/);
});
