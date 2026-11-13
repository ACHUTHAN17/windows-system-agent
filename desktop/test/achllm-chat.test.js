'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { answerAchllmChat, neuralGenerationReady } = require(path.join('..', '..', 'src', 'achllm-chat.js'));

test('AchLLM chat returns attributable retrieval instead of unstable generation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'achllm-chat-'));
  const dir = path.join(root, 'models', 'seed-data');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'chat-code-corpus.txt'), 'Algorithms are step-by-step procedures that transform input into an expected output. A clear algorithm has defined inputs and finite steps.\n\nNetwork protocols define rules that allow computers to exchange messages safely.');
  const answer = answerAchllmChat(root, 'What is an algorithm and what does it do?');
  assert.equal(answer.mode, 'retrieval');
  assert.match(answer.content, /step-by-step procedures/i);
  assert.equal(neuralGenerationReady(root), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('AchLLM chat declines unknown topics instead of hallucinating', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'achllm-chat-'));
  const answer = answerAchllmChat(root, 'What is the current weather in Chennai?');
  assert.equal(answer.mode, 'guarded');
  assert.match(answer.content, /do not have enough verified/i);
  fs.rmSync(root, { recursive: true, force: true });
});
