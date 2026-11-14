'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

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

test('AchLLM continuous trainer uses serial micro-cycles with CPU limits', () => {
  const daemon = fs.readFileSync(path.join(root, 'neural', 'daemon.py'), 'utf8');
  const service = fs.readFileSync(path.join(root, 'deploy', 'seed-lm', 'winagent-neural-trainer.service'), 'utf8');
  const telemetry = fs.readFileSync(path.join(root, 'deploy', 'seed-lm', 'winagent-achllm-telemetry.service'), 'utf8');
  assert.match(daemon, /ACHLLM_NEURAL_CYCLE_SECONDS/);
  assert.match(daemon, /ACHLLM_NEURAL_MICRO_STEPS/);
  assert.match(daemon, /cycle_number % EVALUATE_EVERY/);
  assert.match(daemon, /"continuous"/);
  assert.match(service, /CPUQuota=90%/);
  assert.match(service, /MemoryMax=90%/);
  assert.match(telemetry, /write-achllm-status\.mjs/);
  assert.match(telemetry, /sleep 3/);
  assert.match(service, /Nice=10/);
});

test('AchLLM teacher curriculum is attributable, small, and chat shaped', async () => {
  const curriculum = await import(pathToFileURL(path.join(root, 'src', 'teacher-curriculum.js')).href);
  const lessons = curriculum.teacherCurriculumRecords();
  assert.ok(lessons.length >= 12);
  assert.ok(lessons.every((lesson) => /^achllm-teacher-v[12]-/.test(lesson.id) && lesson.license === curriculum.TEACHER_CURRICULUM_LICENSE));
  assert.ok(lessons.some((lesson) => lesson.id.startsWith('achllm-teacher-v2-')));
  assert.ok(lessons.every((lesson) => /^user: .+\nassistant: /s.test(lesson.text)));
  const guide = fs.readFileSync(path.join(root, 'docs', 'ACHLLM_TRAINING_DATA.md'), 'utf8');
  assert.match(guide, /UltraChat 200k/);
  assert.match(guide, /OpenAssistant OASST1/);
  assert.match(guide, /Do not ingest/);
  const languages = await import(pathToFileURL(path.join(root, 'src', 'language-profile.js')).href);
  assert.equal(languages.languageProfile('வணக்கம்').code, 'ta');
  assert.equal(languages.languageProfile('مرحبا').code, 'ar');
  assert.equal(languages.languageProfile('Hello').code, 'latin');
});
