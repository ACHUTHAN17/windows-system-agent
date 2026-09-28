'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AgentRunner } = require('../lib/runner');

function fake(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-run-'));
  const entry = path.join(dir, 'fake.js');
  fs.writeFileSync(entry, body);
  return { dir, entry };
}
function collect(r) {
  const evs = [];
  return new Promise((res) => r.on('event', (e) => { evs.push(e); if (e.t === 'approval') setTimeout(() => r.approve(e.id, 'once'), 20); if (e.t === 'done') res(evs); }));
}

test('streams steps/tools, answers approvals (prompt without newline), returns marked answer', async () => {
  const { dir, entry } = fake(`
    const rl = require('readline').createInterface({ input: process.stdin });
    console.log('WinAgent — fake-model');
    console.log('  [step 1] planning');
    process.stdout.write('Allow file_write path=x? [y/N] ');
    rl.once('line', (l) => {
      console.log('  [tool] file_write -> {"ok":' + (l === 'y') + '}');
      console.log('@@WINAGENT_ANSWER@@'); console.log('All done.\\nSecond line'); console.log('@@WINAGENT_END@@');
      process.exit(0);
    });`);
  const r = new AgentRunner({ agentDir: dir, execPath: process.execPath, entry });
  const p = collect(r);
  assert.ok(r.run({ text: 'do it' }).ok);
  const evs = await p;
  const kinds = evs.map(e => e.t);
  assert.deepStrictEqual(kinds.filter(k => ['banner', 'step', 'approval', 'resolved', 'tool', 'answer', 'done'].includes(k)), ['banner', 'step', 'approval', 'resolved', 'tool', 'answer', 'done']);
  assert.strictEqual(evs.find(e => e.t === 'tool').ok, true);
  assert.strictEqual(evs.find(e => e.t === 'answer').text, 'All done.\nSecond line');
  assert.strictEqual(r.busy, false);
});

test('falls back to trailing log lines when the engine has no answer marker', async () => {
  const { dir, entry } = fake(`console.log('  [step 1] x'); console.log(''); console.log('Plain final answer');`);
  const r = new AgentRunner({ agentDir: dir, execPath: process.execPath, entry });
  const p = collect(r); r.run({ text: 't' });
  const evs = await p;
  assert.strictEqual(evs.find(e => e.t === 'answer').text, 'Plain final answer');
});

test('reports errors and non-zero exit; rejects concurrent runs; never treats a task as a flag', async () => {
  const { dir, entry } = fake(`console.error('ERROR: model unreachable'); console.error('Fix: something'); process.stdin.resume(); setTimeout(()=>process.exit(1), 300);
  `);
  const r = new AgentRunner({ agentDir: dir, execPath: process.execPath, entry });
  const p = collect(r);
  assert.ok(r.run({ text: '--yes delete everything' }).ok);
  assert.strictEqual(r.run({ text: 'second' }).ok, false);
  const evs = await p;
  const err = evs.find(e => e.t === 'error');
  assert.match(err.text, /model unreachable/); assert.ok(!/Fix:/.test(err.text));
  assert.strictEqual(evs.find(e => e.t === 'done').code, 1);
});

test('fullAuto passes --yes; task text starting with "-" is prefixed so it is not parsed as a flag', async () => {
  const { dir, entry } = fake(`console.log('ARGS=' + JSON.stringify(process.argv.slice(2)));`);
  const r = new AgentRunner({ agentDir: dir, execPath: process.execPath, entry });
  const p = collect(r); r.run({ text: '--yes hi', fullAuto: true });
  const evs = await p;
  const line = evs.find(e => e.t === 'log' && e.text.startsWith('ARGS=')).text;
  const args = JSON.parse(line.slice(5));
  assert.deepStrictEqual(args, ['--once', ' --yes hi', '--yes']);
});

test('stop() terminates a running task', async () => {
  const { dir, entry } = fake(`setInterval(()=>{}, 1000); console.log('  [step 1] waiting');`);
  const r = new AgentRunner({ agentDir: dir, execPath: process.execPath, entry });
  const p = collect(r); r.run({ text: 'long' });
  setTimeout(() => r.stop(), 300);
  const evs = await p;
  assert.ok(evs.some(e => e.t === 'done'));
});
