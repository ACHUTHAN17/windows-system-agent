'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, dialog, shell, nativeImage, Notification, safeStorage, session } = require('electron');
const { ensureAgentDir } = require('./lib/agentdir');
const { Settings } = require('./lib/settings');
const { AgentRunner } = require('./lib/runner');
const { syncFromGitHub } = require('./lib/sync');
const { pushLearned, listCandidates } = require('./lib/github-push');
const { submitPending } = require('./lib/self-improve');
const { tryLocalAction } = require('./lib/local-actions');
const { attachFromPaths, saveBufferIntoUploads } = require('./lib/attachments');

const ICON = path.join(__dirname, 'build', 'icon.png');
let win = null;
let tray = null;
let quitting = false;
let settings = null;
let runner = null;
let agentDir = '';
let syncing = false;

function bundleDir() { return app.isPackaged ? path.join(process.resourcesPath, 'agent') : path.resolve(__dirname, '..'); }
function send(channel, payload) { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); }
function showWindow() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
function toggleWindow() { if (win && win.isVisible() && win.isFocused()) win.hide(); else showWindow(); }
function trusted(e) { return !!(win && e.sender === win.webContents && String(e.senderFrame && e.senderFrame.url).startsWith('file://')); }
function handle(channel, fn) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e)) throw new Error('untrusted sender');
    return fn(...args);
  });
}

function createWindow(startHidden) {
  win = new BrowserWindow({
    width: 1180, height: 780, minWidth: 820, minHeight: 560,
    show: false, backgroundColor: '#0e0f13', title: 'WinAgent', icon: ICON,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0e0f13', symbolColor: '#ececf1', height: 44 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.on('close', (e) => { if (!quitting && settings.data.closeToTray) { e.preventDefault(); win.hide(); } });
}

function createTray() {
  try {
    tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
    tray.setToolTip('WinAgent');
    tray.on('click', showWindow);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open WinAgent', click: showWindow },
      { label: 'Sync from GitHub', click: () => doSync() },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } },
    ]));
  } catch { /* tray is optional */ }
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  const key = String(settings.data.hotkey || '').trim();
  if (!key) return true;
  try { return globalShortcut.register(key, toggleWindow); } catch { return false; }
}

function notify(title, body) {
  if (win && win.isVisible() && win.isFocused()) return;
  try { const n = new Notification({ title, body: String(body).slice(0, 200), icon: ICON }); n.on('click', showWindow); n.show(); } catch { /* ignore */ }
}

function buildTask(text, history) {
  const t = String(text || '').slice(0, 8000);
  const h = Array.isArray(history) ? history.slice(-6) : [];
  if (!h.length) return t;
  const ctx = h.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.text || '').slice(0, 700)}`).join('\n').slice(0, 5000);
  return `${t}\n\n[Earlier in this conversation (context only — do not repeat or re-run it):\n${ctx}\n]`;
}

async function doSync() {
  if (syncing) return { ok: false, error: 'already syncing' };
  syncing = true;
  send('sync:status', { state: 'running', text: 'Syncing…' });
  try {
    const r = await syncFromGitHub({
      agentDir, includeEngine: !!settings.data.syncEngine, syncMemory: !!settings.data.syncMemory,
      onProgress: (text) => send('sync:status', { state: 'running', text }),
    });
    const text = r.updated ? `Updated ${r.updated} file(s): ${r.skills} skills, ${r.memoryLinesAdded} memory lines${r.engine ? `, ${r.engine} engine files` : ''}` : 'Already up to date';
    send('sync:status', { state: 'done', text: r.errors.length ? `${text} (${r.errors.length} errors)` : text, result: r });
    return { ok: true, result: r };
  } catch (e) {
    send('sync:status', { state: 'error', text: e.message });
    return { ok: false, error: e.message };
  } finally { syncing = false; }
}

async function afterRun() {
  const repo = settings.data.githubRepo, pat = settings.githubPat();
  if (settings.data.autoPushLearned && repo && pat) {
    try {
      const r = await pushLearned({ agentDir, repo, pat, candidates: listCandidates(agentDir) });
      if (r.pushed.length) { send('learn:pushed', r); notify('WinAgent pushed what it learned', `${r.pushed.length} file(s) on the "agent-learned" branch`); }
      if (r.errors.length) console.log('[push-learned]', r.errors.join(' | '));
    } catch (e) { console.log('[push-learned] failed:', e.message); }
  }
  if (settings.data.autoSelfImprove && repo && pat) {
    try {
      const r = await submitPending({ agentDir, repo, pat });
      if (r.opened.length) { send('learn:pr', r); notify('WinAgent proposed a self-improvement', `Review: ${r.opened[0].url}`); }
      if (r.errors.length) console.log('[self-improve]', r.errors.join(' | '));
    } catch (e) { console.log('[self-improve] failed:', e.message); }
  }
}

function readSkills() {
  const dir = path.join(agentDir, 'skills');
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    return idx.map(s => ({ name: s.name, title: s.title || s.name, description: s.description || '', origin: s.origin || '' }));
  } catch {
    try { return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => ({ name: f.replace(/\.md$/, ''), title: f.replace(/\.md$/, ''), description: '', origin: '' })); } catch { return []; }
  }
}

function readTools() {
  const out = [];
  try {
    const t = fs.readFileSync(path.join(agentDir, 'src', 'tools.js'), 'utf8');
    const re = /^\s{6}name: '([a-z0-9_]+)',\s*description: '((?:[^'\\]|\\.)*)'/gm;
    let m; while ((m = re.exec(t))) out.push({ name: m[1], description: m[2].replace(/\\'/g, "'"), origin: 'built-in' });
    const names = new Set(out.map(x => x.name));
    const re2 = /^\s{6}name: '([a-z0-9_]+)'/gm;
    while ((m = re2.exec(t))) if (!names.has(m[1])) { names.add(m[1]); out.push({ name: m[1], description: '', origin: 'built-in' }); }
  } catch { /* engine missing */ }
  try {
    for (const f of fs.readdirSync(path.join(agentDir, 'tools-imported', 'self-authored')).filter(f => f.endsWith('.js'))) out.push({ name: f.replace(/\.js$/, ''), description: 'written by the agent itself', origin: 'self-authored' });
  } catch { /* none yet */ }
  return out;
}

function registerIpc() {
  handle('app:info', () => ({ version: app.getVersion(), agentDir, packaged: app.isPackaged, platform: process.platform }));
  handle('settings:get', () => settings.publicView());
  handle('settings:set', async (patch) => {
    patch = patch && typeof patch === 'object' ? patch : {};
    if (patch.fullAuto === true && !settings.data.fullAuto) {
      const r = await dialog.showMessageBox(win, {
        type: 'warning', buttons: ['Cancel', 'Enable full control'], defaultId: 0, cancelId: 0, noLink: true,
        title: 'Enable full control?',
        message: 'Full control lets WinAgent act WITHOUT asking you first.',
        detail: 'It can run commands, create/edit/delete files, change the registry, control apps and use the network on your behalf. Only enable this if you trust the model you configured. You can turn it off any time.',
      });
      if (r.response !== 1) patch.fullAuto = false;
    }
    if (patch.autoSelfImprove === true && !settings.data.autoSelfImprove) {
      const r = await dialog.showMessageBox(win, {
        type: 'warning', buttons: ['Cancel', 'Enable'], defaultId: 0, cancelId: 0, noLink: true,
        title: 'Let the agent propose changes to its own code?',
        message: 'The agent will be able to rewrite parts of its own engine and open GitHub pull requests for them automatically.',
        detail: 'It never merges these itself and never changes the code that is currently running — each proposal is a PR on your repo that YOU must review and merge before it takes effect. Requires a GitHub repo + token above.',
      });
      if (r.response !== 1) patch.autoSelfImprove = false;
    }
    if (patch.autoPushLearned === true && !settings.data.autoPushLearned) {
      const r = await dialog.showMessageBox(win, {
        type: 'question', buttons: ['Cancel', 'Enable'], defaultId: 1, cancelId: 0, noLink: true,
        title: 'Auto-push learned skills and tools?',
        message: `New skills the agent picks up and tools it writes for itself will be pushed to the "agent-learned" branch of your repo automatically.`,
        detail: 'Never pushed to main. Requires a GitHub repo + token above.',
      });
      if (r.response !== 1) patch.autoPushLearned = false;
    }
    const view = settings.update(patch);
    let hotkeyOk = true;
    if ('hotkey' in patch) hotkeyOk = registerHotkey();
    if ('startWithWindows' in patch) app.setLoginItemSettings({ openAtLogin: !!patch.startWithWindows, args: ['--hidden'] });
    return { settings: view, hotkeyOk };
  });
  handle('agent:run', async ({ text, history }) => {
    const local = await tryLocalAction({ text, agentDir, allowedRoots: settings.data.allowedRoots });
    if (local) return { ok: true, instant: true, message: local.message, error: local.error };
    const r = runner.run({ text: buildTask(text, history), fullAuto: !!settings.data.fullAuto, env: settings.agentEnv() });
    return r;
  });
  handle('agent:selftest', () => runner.start({ args: ['--selftest'], env: settings.agentEnv() }));
  handle('agent:stop', () => runner.stop());
  handle('agent:approve', ({ id, decision }) => runner.approve(Number(id), ['once', 'always', 'deny'].includes(decision) ? decision : 'deny'));
  handle('sync:run', () => doSync());
  handle('skills:list', () => readSkills());
  handle('skills:read', (name) => {
    const n = String(name || '');
    if (!/^[A-Za-z0-9._-]+$/.test(n)) return '';
    try { return fs.readFileSync(path.join(agentDir, 'skills', n + '.md'), 'utf8').slice(0, 200000); } catch { return ''; }
  });
  handle('tools:list', () => readTools());
  handle('models:scouted', () => {
    try { return JSON.parse(fs.readFileSync(path.join(agentDir, 'docs', 'models.json'), 'utf8')).live || []; } catch { return []; }
  });
  handle('memory:list', () => {
    const dir = path.join(agentDir, 'memory');
    try { return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => ({ name: f, text: fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 200000) })); } catch { return []; }
  });
  handle('memory:save', ({ name, text }) => {
    if (!/^[A-Za-z0-9._-]+\.md$/.test(String(name))) return false;
    fs.mkdirSync(path.join(agentDir, 'memory'), { recursive: true });
    fs.writeFileSync(path.join(agentDir, 'memory', name), String(text).slice(0, 200000), 'utf8');
    return true;
  });
  handle('sessions:load', () => { try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'sessions.json'), 'utf8')); } catch { return []; } });
  handle('sessions:save', (list) => {
    const s = JSON.stringify(Array.isArray(list) ? list.slice(0, 200) : []);
    if (s.length > 20 * 1024 * 1024) return false;
    fs.writeFileSync(path.join(app.getPath('userData'), 'sessions.json'), s, 'utf8');
    return true;
  });
  handle('dialog:folder', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
  handle('dialog:attachFiles', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] });
    return r.canceled ? [] : attachFromPaths(agentDir, r.filePaths);
  });
  handle('attach:fromPaths', (paths) => attachFromPaths(agentDir, Array.isArray(paths) ? paths : []));
  handle('attach:fromBuffer', ({ name, bytes }) => saveBufferIntoUploads(agentDir, name, Buffer.from(bytes)));
  handle('image:read', (relPath) => {
    const rel = String(relPath || '').replace(/\\/g, '/');
    if (!/^(generated|uploads)\/[A-Za-z0-9._-]+$/.test(rel)) return null;
    const full = path.resolve(agentDir, rel);
    if (!full.startsWith(path.resolve(agentDir) + path.sep)) return null;
    try {
      const stat = fs.statSync(full);
      if (stat.size > 15 * 1024 * 1024) return null;
      const ext = path.extname(full).slice(1).toLowerCase();
      const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext] || 'application/octet-stream';
      return `data:${mime};base64,${fs.readFileSync(full).toString('base64')}`;
    } catch { return null; }
  });
  handle('shell:openAgentDir', () => shell.openPath(agentDir));
  handle('shell:openExternal', (url) => { if (/^https:\/\//.test(String(url))) shell.openExternal(String(url)); });
}

function start() {
  app.setAppUserModelId('com.achuthan17.winagent');
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    // Voice input (renderer's SpeechRecognition) needs the OS mic permission granted at the
    // Electron session level, or Chromium silently denies it. Nothing else needs a permission
    // here (no camera/geolocation/etc. use in this app), so this is a narrow allow-list, not
    // a blanket grant.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'media'));
    settings = new Settings(app.getPath('userData'), safeStorage);
    agentDir = path.join(app.getPath('userData'), 'agent');
    const version = app.isPackaged ? app.getVersion() : `${app.getVersion()}-dev-${Date.now()}`;
    try { ensureAgentDir({ bundleDir: bundleDir(), agentDir, version }); }
    catch (e) { dialog.showErrorBox('WinAgent', `Could not prepare the agent folder:\n${e.message}`); app.quit(); return; }

    runner = new AgentRunner({ agentDir, execPath: process.execPath });
    runner.on('event', (ev) => {
      send('agent:event', ev);
      if (ev.t === 'approval') notify('WinAgent needs your approval', ev.label);
      if (ev.t === 'done') { notify('WinAgent finished', 'The task is complete.'); afterRun(); }
    });

    registerIpc();
    createWindow(process.argv.includes('--hidden'));
    createTray();
    registerHotkey();
    if (settings.data.syncOnStart) setTimeout(() => { doSync(); }, 2500);
  });
  app.on('before-quit', () => { quitting = true; if (runner) runner.stop(); });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => { if (!settings || !settings.data.closeToTray) app.quit(); });
}

if (app.requestSingleInstanceLock()) start(); else app.quit();
