'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { trainSeedLm, completeSeedLm } = require(path.join('..', '..', 'src', 'seed-lm.js'));

test('Seed trains a clean-room byte language model and decodes a known continuation', () => {
  const model = trainSeedLm('hello\nhello\nhelp\n', { order: 2 });
  assert.strictEqual(model.format, 'achllm');
  assert.ok(model.trainedBytes > 0);
  assert.strictEqual(completeSeedLm(model, 'hell', { maxBytes: 2 }), 'o');
});

test('Seed rejects malformed model state instead of generating from it', () => {
  assert.throws(() => completeSeedLm({}, 'hello'), /invalid AchLLM model/);
});
