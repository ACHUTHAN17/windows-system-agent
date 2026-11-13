'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');

test('AchLLM neural pipeline trains and serves the same explicit chat template', () => {
  const trainer = fs.readFileSync(path.join(root, 'neural', 'train.py'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'neural', 'serve.py'), 'utf8');
  assert.match(trainer, /<\|user\|>/);
  assert.match(trainer, /<\|assistant\|>/);
  assert.match(trainer, /def as_chat_document/);
  assert.match(server, /def chat_prompt/);
  assert.match(server, /\/healthz/);
  assert.match(server, /ASSISTANT_MARKER/);
  assert.match(server, /END_MARKER, EOS, TinyDecoder/);
});

test('AchLLM does not auto-promote a neural checkpoint without an evaluation decision', () => {
  const chat = fs.readFileSync(path.join(root, 'src', 'achllm-chat.js'), 'utf8');
  assert.match(chat, /evaluation\?\.promotionEligible === true/);
  const evalScript = fs.readFileSync(path.join(root, 'neural', 'eval_chat.py'), 'utf8');
  assert.match(evalScript, /promotionEligible": False/);
  assert.match(evalScript, /low-lexical-diversity/);
  assert.match(evalScript, /repeated-word-run/);
});
