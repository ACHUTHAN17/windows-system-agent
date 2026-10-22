'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('Windows SendInput declaration keeps the full x64 INPUT union', async () => {
  const { nativeInputDefinition } = await import('../../src/tools.js');
  const definition = nativeInputDefinition();
  assert.match(definition, /public struct MOUSEINPUT/);
  assert.match(definition, /public struct HARDWAREINPUT/);
  assert.match(definition, /\[FieldOffset\(0\)\] public MOUSEINPUT mi/);
  assert.match(definition, /Marshal\.SizeOf\(typeof\(INPUT\)\)/);
});
