'use strict';
// UI smoke test in jsdom: loads the real index.html + app.js with a fake window.winagent
// bridge and drives a full turn (steps, tool, approval, answer) through the event stream.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function boot() {
  const calls = { run: [], approve: [], stop: 0, settings: [] };
  let listener = () => {}; let syncListener = () => {};
  const settings = { preset: 'free', provider: 'openai-compatible', apiUrl: '', model: '', allowedRoots: '', fullAuto: false, hotkey: 'Control+Alt+Space', startWithWindows: false, closeToTray: true, syncOnStart: true, syncMemory: true, syncEngine: false, hasKey: false, keyEncrypted: false };
  const fake = {
    info: async () => ({ version: '1.0.0', agentDir: 'C:\\agent' }),
    getSettings: async () => ({ ...settings }),
    setSettings: async (p) => { calls.settings.push(p); Object.assign(settings, p); return { settings: { ...settings }, hotkeyOk: true }; },
    run: async (text, history) => { calls.run.push({ text, history }); return { ok: true }; },
    selftest: async () => ({ ok: true }), stop: async () => { calls.stop++; return true; },
    approve: async (id, d) => { calls.approve.push([id, d]); return true; },
    onEvent: (cb) => { listener = cb; return () => {}; }, onSync: (cb) => { syncListener = cb; return () => {}; },
    sync: async () => ({ ok: true }),
    skills: async () => [{ name: 'docx', title: 'docx', description: 'Word files', origin: 'imported' }, { name: 'pdf', title: 'pdf', description: 'PDF files', origin: '' }],
    skillRead: async (n) => `# ${n}\nsome **skill** text`,
    tools: async () => [{ name: 'file_list', description: 'List a folder', origin: 'built-in' }],
    memoryList: async () => [{ name: 'MEMORY.md', text: '- a note' }], memorySave: async () => true,
    sessionsLoad: async () => [], sessionsSave: async () => true,
    pickFolder: async () => 'C:\\Docs', openAgentDir: async () => '', openExternal: async () => {},
  };
  const dom = new JSDOM('', { url: 'file:///x' });
  return { fake, calls, emit: (e) => listener(e), sync: (s) => syncListener(s), settings };
}

async function load(fakeBundle) {
  const file = path.join(__dirname, '..', 'renderer', 'index.html');
  const { JSDOM: J } = require('jsdom');
  const dom = await J.fromFile(file, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) { w.winagent = fakeBundle.fake; } });
  for (let i = 0; i < 100 && !dom.window.__winagentReady; i++) await new Promise(r => setTimeout(r, 20));
  assert.ok(dom.window.__winagentReady, 'app.js initialised');
  return dom;
}
const tick = () => new Promise(r => setTimeout(r, 30));

test('renders welcome cards, sends a task, streams activity, approvals and the markdown answer', async () => {
  const b = boot(); const dom = await load(b); const d = dom.window.document;
  assert.ok(d.querySelector('.welcome'), 'welcome screen');
  assert.strictEqual(d.querySelectorAll('.card').length, 4);
  assert.strictEqual(d.getElementById('modeBadge').textContent, 'Ask before acting');

  d.getElementById('input').value = 'clean my downloads';
  d.getElementById('send').click(); await tick();
  assert.strictEqual(JSON.stringify(b.calls.run[0]), JSON.stringify({ text: 'clean my downloads', history: [] }));
  assert.ok(d.querySelector('.msg.user .bubble').textContent.includes('clean my downloads'));
  assert.ok(d.querySelector('.spinner'), 'working indicator');
  assert.strictEqual(d.getElementById('stop').hidden, false);

  b.emit({ t: 'step', n: 1, text: 'list the folder' });
  b.emit({ t: 'tool', name: 'file_list', ok: true, summary: '{"ok":true}' });
  b.emit({ t: 'approval', id: 7, kind: 'tool', label: 'Allow file_delete path=C:\\x?', options: ['once', 'deny'] });
  await tick();
  assert.ok(d.querySelector('.approval .lbl').textContent.includes('file_delete'));
  d.querySelector('.approval .allow').click(); await tick();
  assert.strictEqual(JSON.stringify(b.calls.approve[0]), JSON.stringify([7, 'once']));
  b.emit({ t: 'resolved', decision: 'once' });
  b.emit({ t: 'answer', text: 'Freed **2 GB**\n\n```powershell\nRemove-Item x\n```<img src=x onerror=1>' });
  b.emit({ t: 'done', code: 0 }); await tick();

  assert.ok(!d.querySelector('.spinner'), 'spinner gone');
  assert.strictEqual(d.getElementById('stop').hidden, true);
  const ans = d.querySelector('.answer');
  assert.ok(ans.querySelector('strong').textContent === '2 GB'); assert.ok(ans.querySelector('.codeblock pre code').textContent.includes('Remove-Item'));
  assert.ok(!ans.querySelector('img'), 'HTML in model output is escaped');
  assert.ok(d.querySelector('.activity').textContent.includes('file_list'));
  assert.strictEqual(d.querySelector('.chatitem.active .t').textContent, 'clean my downloads');

  // second message includes conversation history for context
  d.getElementById('input').value = 'and now the desktop'; d.getElementById('send').click(); await tick();
  assert.strictEqual(b.calls.run[1].history.length, 2);
});

test('errors are shown, settings save incl. key, views open', async () => {
  const b = boot(); const dom = await load(b); const d = dom.window.document;
  d.getElementById('input').value = 'x'; d.getElementById('send').click(); await tick();
  b.emit({ t: 'error', text: 'model unreachable' }); b.emit({ t: 'done', code: 1 }); await tick();
  assert.ok(d.querySelector('.err').textContent.includes('model unreachable'));

  d.querySelector('[data-view=settings]').click(); await tick();
  assert.strictEqual(d.getElementById('view-settings').hidden, false);
  const sel = d.getElementById('sPreset'); sel.value = 'openai'; sel.dispatchEvent(new dom.window.Event('change'));
  assert.strictEqual(d.getElementById('sUrl').value, 'https://api.openai.com/v1');
  d.getElementById('sKey').value = 'sk-test'; d.getElementById('sFull').checked = true;
  d.getElementById('sSave').click(); await tick();
  const patch = b.calls.settings.pop();
  assert.strictEqual(patch.preset, 'openai'); assert.strictEqual(patch.apiKey, 'sk-test'); assert.strictEqual(patch.fullAuto, true);
  assert.strictEqual(d.getElementById('modeBadge').textContent, 'Full control');

  d.querySelector('[data-view=skills]').click(); await tick();
  assert.strictEqual(d.querySelectorAll('#skillList .item').length, 2);
  d.querySelector('#skillList .item').click(); await tick();
  assert.ok(d.getElementById('skillDetail').textContent.includes('skill text'));
  d.querySelector('[data-view=memory]').click(); await tick();
  assert.ok(d.querySelector('#memList .item')); d.querySelector('[data-view=tools]').click(); await tick();
  assert.ok(d.getElementById('toolList').textContent.includes('file_list'));
  b.sync({ state: 'done', text: 'Updated 3 file(s)' }); assert.ok(d.getElementById('syncState').textContent.includes('Updated 3'));
});
