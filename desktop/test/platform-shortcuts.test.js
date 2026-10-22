'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('shortcut profiles use the target OS meaning instead of applying Windows semantics everywhere', async () => {
  const { interpretExplicitInput, offlinePlan } = await import('../../src/offline.js');
  const mac = interpretExplicitInput('please press Command+Space', { platform: 'darwin' });
  assert.deepEqual(mac, {
    key: 'Space', modifiers: 'command', intent: 'open-spotlight',
    impact: 'Opens Spotlight search', label: 'Opened Spotlight', platform: 'darwin',
  });
  const linux = interpretExplicitInput('press Super+Page Up', { platform: 'linux' });
  assert.equal(linux.intent, 'previous-workspace');
  assert.equal(linux.modifiers, 'super');
  const android = offlinePlan('tap Home', { platform: 'android' }).steps[0];
  assert.equal(android.intent, 'go-home');
  assert.equal(android.args.key, 'Home');
  assert.equal(interpretExplicitInput('press Win+L', { platform: 'darwin' }).intent, 'send-shortcut-to-focused-window');
});

test('macOS shortcut script uses native System Events syntax', async () => {
  const { macShortcutScript } = await import('../../src/platform.js');
  assert.equal(macShortcutScript('Space', 'command'), 'tell application "System Events" to key code 49 using {command down}');
  assert.equal(macShortcutScript('S', 'command,shift'), 'tell application "System Events" to keystroke "s" using {command down, shift down}');
});
