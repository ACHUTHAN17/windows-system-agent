'use strict';
// UI smoke test in jsdom: loads the real index.html + app.js with a fake window.winagent
// bridge and drives a full turn (steps, tool, approval, answer) through the event stream.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function boot() {
  const calls = { run: [], approve: [], stop: 0, settings: [] };
  let listener = () => {}; let syncListener = () => {}; let learnedListener = () => {}; let prListener = () => {};
  const settings = { preset: 'free', provider: 'openai-compatible', apiUrl: '', model: '', allowedRoots: '', fullAuto: false, hotkey: 'Control+Alt+Space', startWithWindows: false, closeToTray: true, syncOnStart: true, syncMemory: true, syncEngine: false, hasKey: false, keyEncrypted: false, githubRepo: '', autoPushLearned: false, autoSelfImprove: false, hasGithubPat: false };
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
    attachFiles: async () => calls.attachFiles || [],
    readImage: async (p) => calls.images && calls.images[p] || null,
    onLearned: (cb) => { learnedListener = cb; return () => {}; }, onSelfImprove: (cb) => { prListener = cb; return () => {}; },
  };
  const dom = new JSDOM('', { url: 'file:///x' });
  return { fake, calls, emit: (e) => listener(e), sync: (s) => syncListener(s), settings, learned: (r) => learnedListener(r), pr: (r) => prListener(r) };
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

test('attachments: pick, chip renders, removable, sent with the task and shown on the user bubble', async () => {
  const b = boot(); const dom = await load(b); const d = dom.window.document;
  b.calls.attachFiles = [
    { name: 'notes.txt', path: 'uploads/1-notes.txt', isImage: false, preview: 'hello world', bytes: 11 },
    { name: 'photo.png', path: 'uploads/2-photo.png', isImage: true, bytes: 5000 },
    { name: 'huge.bin', error: 'too large (25 MB max)' },
  ];
  d.getElementById('attachBtn').click(); await tick();
  const chips = d.querySelectorAll('#attachRow .attachchip');
  assert.strictEqual(chips.length, 3);
  assert.ok(chips[2].classList.contains('err'));
  assert.strictEqual(d.getElementById('attachRow').hidden, false);

  chips[2].querySelector('button').click(); await tick(); // remove the errored one
  assert.strictEqual(d.querySelectorAll('#attachRow .attachchip').length, 2);

  d.getElementById('input').value = 'look at these';
  d.getElementById('send').click(); await tick();

  const sentText = b.calls.run[0].text;
  assert.ok(sentText.startsWith('look at these'));
  assert.ok(sentText.includes('uploads/1-notes.txt') && sentText.includes('hello world'));
  assert.ok(sentText.includes('uploads/2-photo.png') && sentText.includes('image'));
  assert.ok(!sentText.includes('huge.bin'), 'errored attachment excluded from the task text');

  assert.ok(d.querySelector('.msg.user .chips').textContent.includes('notes.txt'));
  assert.ok(d.querySelector('.msg.user .chips').textContent.includes('photo.png'));
  assert.strictEqual(d.getElementById('attachRow').hidden, true, 'attach row clears after sending');
});

test('inline generated images: marker becomes an <img>, loads via IPC, missing image shows a fallback', async () => {
  const b = boot(); const dom = await load(b); const d = dom.window.document;
  b.fake.readImage = async (p) => (p === 'generated/ok.png' ? 'data:image/png;base64,AAAA' : null);
  d.getElementById('input').value = 'draw something'; d.getElementById('send').click(); await tick();
  b.emit({ t: 'answer', text: 'Here you go:\n[[image:generated/ok.png]]\nand a broken one:\n[[image:generated/missing.png]]' });
  b.emit({ t: 'done', code: 0 }); await tick(); await tick();
  const imgs = d.querySelectorAll('.answer img.gen-img');
  assert.strictEqual(imgs.length, 1, 'the loaded image remains an <img>');
  assert.strictEqual(imgs[0].getAttribute('src'), 'data:image/png;base64,AAAA');
  assert.ok(!imgs[0].classList.contains('loading'));
  assert.ok(d.querySelector('.answer').textContent.includes('image unavailable'), 'missing image degrades to text, not a broken <img>');
});

test('settings: GitHub repo/token/toggles round-trip, and enabling self-improve is a distinct patch', async () => {
  const b = boot(); const dom = await load(b); const d = dom.window.document;
  d.querySelector('[data-view=settings]').click(); await tick();
  d.getElementById('sRepo').value = 'me/fork';
  d.getElementById('sPat').value = 'ghp_abc';
  d.getElementById('sAutoPush').checked = true;
  d.getElementById('sSelfImprove').checked = true;
  d.getElementById('sSave').click(); await tick();
  const patch = b.calls.settings.pop();
  assert.strictEqual(patch.githubRepo, 'me/fork');
  assert.strictEqual(patch.githubPat, 'ghp_abc');
  assert.strictEqual(patch.autoPushLearned, true);
  assert.strictEqual(patch.autoSelfImprove, true);

  b.learned({ pushed: ['skills/a.md'], errors: [] });
  assert.ok(d.getElementById('learnState').textContent.includes('Pushed 1'));
  b.pr({ opened: [{ file: 'a.json', url: 'https://github.com/me/fork/pull/3' }], errors: [] });
  assert.ok(d.getElementById('learnState').textContent.includes('pull/3'));
});
