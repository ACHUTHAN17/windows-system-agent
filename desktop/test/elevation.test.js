'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { status, requestRelaunch, isAdminOutput, psQuote } = require('../lib/elevation');

test('elevation helpers report Windows status without guessing and quote UAC launch values safely', () => {
  assert.strictEqual(isAdminOutput('True\r\n'), true); assert.strictEqual(isAdminOutput('false'), false);
  assert.deepStrictEqual(status({ platform: 'linux' }), { supported: false, elevated: false, detail: 'Administrator elevation is implemented for Windows only.' });
  assert.strictEqual(status({ platform: 'win32', run: () => 'True\n' }).elevated, true);
  assert.strictEqual(psQuote("C:\\O'Hare\\WinAgent.exe"), "'C:\\O''Hare\\WinAgent.exe'");
  let invoked = null;
  const result = requestRelaunch({ platform: 'win32', executable: 'C:\\WinAgent.exe', args: ['--hidden'], launch: (exe, args) => { invoked = { exe, args }; return { unref() {} }; } });
  assert.strictEqual(result.ok, true); assert.strictEqual(invoked.exe, 'powershell.exe'); assert.match(invoked.args[3], /-Verb RunAs/);
});
