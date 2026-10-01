'use strict';
// Handles "open X" style requests directly — no model call, no tool-loop, instant. This is
// deliberately conservative: it only fires for a message that IS the instruction (nothing
// else going on), and only for a small set of things it can resolve with total confidence
// (a known special folder, an explicit path, or a short list of common Windows apps). Anything
// it isn't sure about falls through to the normal AI-driven run — never a silent no-op, and
// never a guess at an app/path it doesn't recognise.
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const VERB = /^(?:please\s+)?(?:can you\s+)?(open|launch|start|show me|show)\s+(.+?)[.!\s]*$/i;
// If any of these show up in the remainder, this is a compound task (e.g. "open the file and
// summarize it") and must go through the agent, not be shortcut.
const COMPOUND = /\b(and|then|so that|so I can|to see|summar|analy[sz]e|read\b|list\b|find\b|search|tell me|what|why|how|check|review|edit|delete|rename|compare|convert)\b/i;

const FOLDERS = {
  downloads: 'downloads', download: 'downloads',
  documents: 'documents', docs: 'documents', 'my documents': 'documents',
  desktop: 'desktop',
  pictures: 'pictures', photos: 'pictures', 'my pictures': 'pictures',
  music: 'music', 'my music': 'music',
  videos: 'videos', 'my videos': 'videos', movies: 'videos',
  home: 'home', 'home folder': 'home', 'user folder': 'home', 'my computer': 'home', 'this pc': 'home',
  temp: 'temp', tmp: 'temp',
  appdata: 'appData',
};

// value: exe/command name resolved via `start`, OR a shell/URI target starting with 'uri:'
const APPS = {
  notepad: 'notepad', 'note pad': 'notepad',
  calculator: 'calc', calc: 'calc',
  paint: 'mspaint', mspaint: 'mspaint',
  'command prompt': 'cmd', cmd: 'cmd', terminal: 'cmd',
  powershell: 'powershell',
  'task manager': 'taskmgr', taskmgr: 'taskmgr',
  'control panel': 'control',
  settings: 'uri:ms-settings:',
  'file explorer': 'explorer', explorer: 'explorer', files: 'explorer',
  'recycle bin': 'uri:shell:RecycleBinFolder',
  chrome: 'chrome', 'google chrome': 'chrome',
  edge: 'msedge', 'microsoft edge': 'msedge',
  firefox: 'firefox',
  word: 'winword', 'microsoft word': 'winword',
  excel: 'excel', 'microsoft excel': 'excel',
  outlook: 'outlook',
  spotify: 'spotify',
  discord: 'discord',
  'vs code': 'code', 'visual studio code': 'code', vscode: 'code',
  whatsapp: 'whatsapp',
};

function specialFolderPath(key) {
  switch (key) {
    case 'downloads': return path.join(os.homedir(), 'Downloads');
    case 'documents': return path.join(os.homedir(), 'Documents');
    case 'desktop': return path.join(os.homedir(), 'Desktop');
    case 'pictures': return path.join(os.homedir(), 'Pictures');
    case 'music': return path.join(os.homedir(), 'Music');
    case 'videos': return path.join(os.homedir(), 'Videos');
    case 'home': return os.homedir();
    case 'temp': return os.tmpdir();
    case 'appData': return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    default: return null;
  }
}

function looksLikePath(s) {
  return /^[A-Za-z]:[\\/]/.test(s) || /^\\\\[^\\]/.test(s) || s.startsWith('~');
}
function expandPath(s) {
  if (s.startsWith('~')) return path.join(os.homedir(), s.slice(1).replace(/^[\\/]/, ''));
  return s;
}

// Returns { handled:false } if this isn't a confident, single-purpose "open X", else
// { handled:true, label, run() } where run() performs the action (kept separate from
// detection so a caller can log/confirm before actually launching something).
function detectLocalAction(text) {
  const t = String(text || '').trim();
  if (t.length > 80) return { handled: false };
  const m = t.match(VERB);
  if (!m) return { handled: false };
  const rest = m[2].trim();
  if (COMPOUND.test(rest)) return { handled: false };
  const bare = rest.replace(/^(the|my|a)\s+/i, '').replace(/\s+folder$/i, '').trim();
  const lower = bare.toLowerCase();

  if (looksLikePath(rest)) {
    const target = expandPath(rest.replace(/^["']|["']$/g, ''));
    return { handled: true, label: `Opened ${target}`, target, kind: 'path' };
  }
  if (FOLDERS[lower]) {
    const target = specialFolderPath(FOLDERS[lower]);
    return { handled: true, label: `Opened your ${bare} folder`, target, kind: 'path' };
  }
  if (APPS[lower]) {
    const cmd = APPS[lower];
    return { handled: true, label: `Opened ${bare}`, target: cmd, kind: cmd.startsWith('uri:') ? 'uri' : 'app' };
  }
  return { handled: false };
}

async function isPathOk(agentDir, allowedRootsCsv, target) {
  try {
    const { isPathAllowed } = await import(pathToFileURL(path.join(agentDir, 'src', 'safety.js')).href);
    const allowedRoots = String(allowedRootsCsv || '').split(',').map(s => s.trim()).filter(Boolean);
    return isPathAllowed({ allowedRoots, blockedPaths: [] }, target);
  } catch { return { ok: true }; } // safety module unavailable (engine not seeded yet) — don't block on that
}

function launch(target) {
  const real = target.startsWith('uri:') ? target.slice(4) : target;
  const child = spawn('cmd.exe', ['/c', 'start', '""', real], { detached: true, stdio: 'ignore', windowsHide: true, shell: false });
  child.unref();
}

// Main entry point. Returns null if not handled (caller should fall through to the AI),
// or { message } / { error } if it was.
async function tryLocalAction({ text, agentDir, allowedRoots }) {
  if (process.platform !== 'win32') return null; // start/explorer/etc. are Windows-specific
  const d = detectLocalAction(text);
  if (!d.handled) return null;
  if (d.kind === 'path') {
    const chk = await isPathOk(agentDir, allowedRoots, d.target);
    if (!chk.ok) return { error: `That's outside what I'm allowed to open right now (${chk.reason}).` };
    const fs = require('node:fs');
    if (!fs.existsSync(d.target)) return { error: `I couldn't find "${d.target}" — ask me to search for it instead and I'll look properly.` };
  }
  try { launch(d.target); return { message: d.label }; }
  catch (e) { return { error: `Could not open it: ${e.message}` }; }
}

module.exports = { tryLocalAction, detectLocalAction, FOLDERS, APPS };
