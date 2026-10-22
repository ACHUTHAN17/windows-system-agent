// Offline-first planner for common system tasks.
// It intentionally handles only explicit, deterministic requests. Anything
// ambiguous remains available to the optional model-backed agent loop.
import os from 'node:os';
import path from 'node:path';
import { routeText, resolveFolderTarget, ROUTER_APPS, ROUTER_FOLDERS } from './router.js';

function clean(s) {
  return String(s || '').trim().replace(/[.?!]+$/, '').replace(/^['"]|['"]$/g, '').trim();
}

function targetPath(raw, cfg) {
  const value = clean(raw);
  const low = value.toLowerCase();
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const folder = ROUTER_FOLDERS[low];
  if (folder) {
    if (folder === 'temp') return process.env.TEMP || process.env.TMP || os.tmpdir();
    if (folder === 'appData') return process.env.APPDATA || path.join(home, '.config');
    return resolveFolderTarget(folder, home);
  }
  if (/^~(?:[\\/]|$)/.test(value)) return path.join(home, value.slice(2));
  if (/^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value)) return path.normalize(value);
  return path.resolve(cfg?.root || process.cwd(), value);
}

function result(tool, args, label) {
  return { tool, args, label };
}

// A shortcut is not just a string of key names. These OS profiles retain the
// system-level consequence that a person expects. The executor still follows
// the configured approval policy. Sources: Microsoft, Apple, and GNOME's
// official shortcut references; Android has device-specific key events.
const effect = (intent, impact, label) => ({ intent, impact, label });
const SHORTCUT_PROFILES = {
  win32: {
    'win+l': effect('lock-session', 'Locks the current Windows session immediately', 'Locked the current Windows session'),
    'win+i': effect('open-settings', 'Opens Windows Settings', 'Opened Windows Settings'),
    'win+d': effect('show-desktop', 'Shows or restores the desktop', 'Toggled the desktop view'),
    'win+e': effect('open-file-explorer', 'Opens File Explorer', 'Opened File Explorer'),
    'win+r': effect('open-run', 'Opens the Windows Run dialog', 'Opened the Run dialog'),
    'win+s': effect('open-search', 'Opens Windows Search', 'Opened Windows Search'),
    'win+m': effect('minimize-all', 'Minimizes all windows', 'Minimized all windows'),
    'win+tab': effect('task-view', 'Opens Windows Task View', 'Opened Task View'),
    'win+shift+s': effect('screen-snipping', 'Opens Windows screen snipping', 'Opened screen snipping'),
    'alt+tab': effect('switch-app', 'Switches the active application', 'Switched the active application'),
    'alt+f4': effect('close-focused-window', 'Closes the currently focused window', 'Closed the focused window'),
    'ctrl+s': effect('save-focused-document', 'Saves in the currently focused application', 'Sent Save to the focused application'),
    'ctrl+shift+s': effect('save-as-focused-document', 'Opens Save As in the currently focused application', 'Opened Save As in the focused application'),
  },
  darwin: {
    'command+c': effect('copy-selection', 'Copies the current selection on macOS', 'Copied the current selection'),
    'command+v': effect('paste-clipboard', 'Pastes the clipboard into the focused app', 'Pasted the clipboard'),
    'command+x': effect('cut-selection', 'Cuts the current selection on macOS', 'Cut the current selection'),
    'command+z': effect('undo', 'Undoes the last action in the focused app', 'Undid the last action'),
    'shift+command+z': effect('redo', 'Redoes the last action in the focused app', 'Redid the last action'),
    'command+a': effect('select-all', 'Selects all in the focused app', 'Selected all'),
    'command+s': effect('save-focused-document', 'Saves in the focused macOS app', 'Saved the focused document'),
    'command+w': effect('close-focused-window', 'Closes the front window or tab', 'Closed the front window or tab'),
    'command+q': effect('quit-focused-app', 'Quits the front macOS application', 'Quit the front application'),
    'command+space': effect('open-spotlight', 'Opens Spotlight search', 'Opened Spotlight'),
    'command+tab': effect('switch-app', 'Switches between open macOS applications', 'Switched the active application'),
    'option+command+esc': effect('force-quit-dialog', 'Opens the macOS Force Quit dialog', 'Opened Force Quit'),
    'shift+command+3': effect('screenshot-full-screen', 'Captures the full screen on macOS', 'Captured a full-screen screenshot'),
    'shift+command+4': effect('screenshot-selection', 'Starts a macOS selection screenshot', 'Started selection screenshot'),
  },
  linux: {
    'super+l': effect('lock-session', 'Locks the current GNOME session', 'Locked the current GNOME session'),
    'super+a': effect('show-applications', 'Shows the GNOME applications list', 'Opened the applications list'),
    'super+tab': effect('switch-app', 'Switches between applications in GNOME', 'Switched the active application'),
    'super+v': effect('show-notifications', 'Shows GNOME notifications', 'Opened notifications'),
    'super+pageup': effect('previous-workspace', 'Switches to the previous GNOME workspace', 'Switched workspace'),
    'super+pagedown': effect('next-workspace', 'Switches to the next GNOME workspace', 'Switched workspace'),
    'alt+f2': effect('open-run-command', 'Opens the GNOME run command prompt', 'Opened the run command prompt'),
    'alt+f4': effect('close-focused-window', 'Closes the focused window', 'Closed the focused window'),
    'ctrl+alt+delete': effect('power-dialog', 'Opens the GNOME power dialog', 'Opened the power dialog'),
    'printscreen': effect('screenshot-tool', 'Opens the GNOME screenshot tool', 'Opened the screenshot tool'),
  },
  android: {
    home: effect('go-home', 'Returns to the Android home screen', 'Returned to the Android home screen'),
    back: effect('go-back', 'Navigates back on the Android device', 'Navigated back'),
    appswitch: effect('show-recents', 'Opens the Android recent-apps view', 'Opened recent apps'),
    power: effect('power-button', 'Sends the Android power key; device behavior is manufacturer controlled', 'Sent the Android power key'),
  },
};

function platformFor(cfg = {}) {
  const requested = String(cfg.targetPlatform || cfg.platform || '').toLowerCase();
  if (['android', 'termux'].includes(requested) || process.env.ANDROID_ROOT || process.env.TERMUX_VERSION) return 'android';
  if (['mac', 'macos', 'darwin'].includes(requested)) return 'darwin';
  if (['linux', 'gnome'].includes(requested)) return 'linux';
  if (['win', 'windows', 'win32'].includes(requested)) return 'win32';
  return process.platform;
}

function canonicalShortcut(main, modifiers, platform) {
  const order = platform === 'darwin' ? ['ctrl', 'option', 'shift', 'command']
    : platform === 'linux' ? ['ctrl', 'alt', 'shift', 'super'] : ['ctrl', 'alt', 'shift', 'win'];
  const names = String(modifiers || '').toLowerCase().split(',').filter(Boolean).map((value) => {
    if (value.startsWith('ctrl') || value === 'control') return 'ctrl';
    if (platform === 'darwin' && /^(cmd|command|meta|win)$/.test(value)) return 'command';
    if (platform === 'darwin' && /^(alt|option)$/.test(value)) return 'option';
    if (platform === 'linux' && /^(meta|win|super)$/.test(value)) return 'super';
    if (value === 'meta') return 'win';
    return value;
  });
  const unique = [...new Set(names)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return [...unique, String(main || '').trim().toLowerCase().replace(/[\s_-]+/g, '')].filter(Boolean).join('+');
}

// Understand an explicit human request before choosing an input tool.  A
// greeting or agent name is deliberately ignored; a question about shortcuts
// is deliberately not an action.  Unknown but unambiguous shortcuts retain a
// conservative generic meaning rather than being mislabeled.
export function interpretExplicitInput(text, cfg = {}) {
  const request = String(text || '').trim();
  const match = request.match(/(?:^|[.!?]\s*)(?:(?:please|can you|could you)\s+)?(?:press|tap|hit|use)\s+(.+?)\s*[.!?]*$/i);
  if (!match) return null;
  const spokenKeys = clean(match[1]).replace(/page\s+up/ig, 'pageup').replace(/page\s+down/ig, 'pagedown').replace(/print\s+screen/ig, 'printscreen').replace(/app\s+switch/ig, 'appswitch');
  if (!spokenKeys || /\b(?:what|why|how|mean|does)\b/i.test(spokenKeys)) return null;
  const parts = spokenKeys.split(/[+\s]+/).filter(Boolean);
  const key = parts.pop() || spokenKeys;
  const rawModifiers = parts.join(',');
  const platform = platformFor(cfg);
  const canonical = canonicalShortcut(key, rawModifiers, platform);
  const modifierNames = canonical.split('+').slice(0, -1);
  const modifiers = modifierNames.join(',');
  const effect = SHORTCUT_PROFILES[platform]?.[canonical];
  const shortcut = [modifiers, key].filter(Boolean).join('+');
  return {
    key,
    modifiers,
    intent: effect?.intent || 'send-shortcut-to-focused-window',
    impact: effect?.impact || `Sends ${shortcut} to the currently focused window`,
    label: effect?.label || `Pressed ${shortcut}`,
    platform,
  };
}

// The desktop shell appends recent chat messages for model context. Local
// routing must only inspect the newest request, otherwise an old command can
// win the regex match and be executed again on every later turn.
export function latestRequest(text) {
  const raw = String(text || '');
  const marker = '\n\n[Earlier in this conversation (context only';
  const at = raw.indexOf(marker);
  return (at >= 0 ? raw.slice(0, at) : raw).trim();
}

function appCommand(name) {
  const target = ROUTER_APPS[clean(name).toLowerCase()];
  if (!target || target.startsWith('uri:')) return null;
  return target;
}

function loginUrl(raw) {
  const text = clean(raw);
  const explicit = text.match(/https?:\/\/[^\s)]+/i);
  if (explicit) return explicit[0].replace(/[.,!?]+$/, '');
  const sites = {
    netflix: 'https://www.netflix.com/login',
    gmail: 'https://mail.google.com/',
    google: 'https://www.google.com/',
    github: 'https://github.com/login',
    microsoft: 'https://login.live.com/',
    outlook: 'https://outlook.live.com/',
    facebook: 'https://www.facebook.com/login',
    instagram: 'https://www.instagram.com/accounts/login/',
    linkedin: 'https://www.linkedin.com/login',
    amazon: 'https://www.amazon.com/ap/signin',
    spotify: 'https://accounts.spotify.com/login',
    youtube: 'https://www.youtube.com/',
  };
  const hit = Object.keys(sites).find(name => new RegExp(`\\b${name}\\b`, 'i').test(text));
  if (hit) return sites[hit];
  const host = text.match(/\b([a-z0-9-]+\.(?:com|org|net|io|co\.uk))(?:\/[^\s]*)?/i);
  return host ? `https://${host[0]}` : null;
}

function compoundOfflinePlan(text) {
  const t = String(text || '').trim();
  const steps = [];
  const theme = t.match(/\b(?:change|switch|set|turn)\s+(?:the\s+)?(?:system\s+)?(?:theme|mode)\s+(?:to\s+)?(light|dark)\b/i)
    || t.match(/\b(?:light|dark)\s+theme\b/i);
  if (theme) {
    const mode = theme[1] ? theme[1].toLowerCase() : (/\blight\b/i.test(theme[0]) ? 'light' : 'dark');
    steps.push(result('theme_set', { mode }, `Changed to ${mode} theme`));
  }
  const browser = t.match(/\b(?:open|launch|start)\s+(?:a\s+)?new\s+tab\s+(?:on|in)\s+(microsoft\s+edge|edge|google\s+chrome|chrome|firefox)\b/i);
  if (browser) {
    const browserName = /edge/i.test(browser[1]) ? 'edge' : /firefox/i.test(browser[1]) ? 'firefox' : 'chrome';
    const url = loginUrl(t.slice((browser.index || 0) + browser[0].length));
    if (url) steps.push(result('browser_open', { browser: browserName, url }, `Opened ${url} in a new ${browserName} tab`));
  }
  return steps.length ? steps : null;
}

function directInputPlan(text, cfg) {
  const t = String(text || '').trim();
  let m = t.match(/^(?:click|left[- ]click)\s+(?:at\s+)?(\d+)\s*[, ]\s*(\d+)$/i);
  if (m) return result('screen_click', { x: Number(m[1]), y: Number(m[2]), button: 'left' }, `Clicked at ${m[1]},${m[2]}`);
  m = t.match(/^(?:right[- ]click)\s+(?:at\s+)?(\d+)\s*[, ]\s*(\d+)$/i);
  if (m) return result('screen_click', { x: Number(m[1]), y: Number(m[2]), button: 'right' }, `Right-clicked at ${m[1]},${m[2]}`);
  m = t.match(/^(?:double[- ]click)\s+(?:at\s+)?(\d+)\s*[, ]\s*(\d+)$/i);
  if (m) return result('screen_double_click', { x: Number(m[1]), y: Number(m[2]) }, `Double-clicked at ${m[1]},${m[2]}`);
  m = t.match(/^drag(?:\s+and\s+drop)?\s+(?:from\s+)?(\d+)\s*[, ]\s*(\d+)\s+(?:to|toward)\s+(\d+)\s*[, ]\s*(\d+)$/i);
  if (m) return result('screen_drag', { x1: Number(m[1]), y1: Number(m[2]), x2: Number(m[3]), y2: Number(m[4]) }, `Dragged from ${m[1]},${m[2]} to ${m[3]},${m[4]}`);
  m = t.match(/^(?:move|move the mouse)\s+(?:to\s+)?(\d+)\s*[, ]\s*(\d+)$/i);
  if (m) return result('mouse_move', { x: Number(m[1]), y: Number(m[2]) }, `Moved the pointer to ${m[1]},${m[2]}`);
  m = t.match(/^scroll\s+(up|down|left|right)(?:\s+(\d+))?(?:\s+at\s+(\d+)\s*[, ]\s*(\d+))?$/i);
  if (m) return result('screen_scroll', { direction: m[1].toLowerCase(), amount: Number(m[2] || 3), x: Number(m[3] || 0), y: Number(m[4] || 0) }, `Scrolled ${m[1]}`);
  const input = interpretExplicitInput(t, cfg);
  if (input) {
    const step = result('key_tap', { key: input.key, modifiers: input.modifiers }, input.label);
    step.intent = input.intent;
    step.impact = input.impact;
    return step;
  }
  // "write a file" and "write a Python program" are creation goals, not
  // keystrokes. Keep native text injection explicit so it cannot steal those
  // richer requests before the file/artifact planner sees them.
  m = t.match(/^(?:type|enter|input)\s+([\s\S]+)$/i);
  if (m) return result('key_press', { text: m[1] }, 'Typed text');
  m = t.match(/^(?:run|execute)\s+(?:this\s+)?command\s*:\s*([\s\S]+)$/i);
  if (m) return result('shell_exec', { command: m[1].trim() }, 'Ran the command');
  return null;
}

export function offlinePlan(text, cfg = {}) {
  const t = clean(latestRequest(text));
  if (!t) return null;

  const compound = compoundOfflinePlan(t);
  if (compound) return { kind: 'offline', steps: compound, reason: 'known multi-step local task' };

  // Join independently understood local actions. This keeps common sequences
  // model-free while refusing to guess when any clause is ambiguous.
  if (!/drag\s+and\s+drop/i.test(t) && /\b(?:and then|then|and)\b/i.test(t)) {
    const parts = t.split(/\s+(?:and then|then|and)\s+/i).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      const steps = [];
      for (const part of parts) {
        const plan = offlinePlan(part, cfg);
        if (!plan || plan.kind !== 'offline') { steps.length = 0; break; }
        steps.push(...plan.steps);
      }
      if (steps.length > 1) return { kind: 'offline', steps, reason: 'sequence of known local actions' };
    }
  }

  const direct = directInputPlan(t, cfg);
  if (direct) return { kind: 'offline', steps: [direct], reason: 'explicit computer input request' };

  const asksForDiskReport = /\b(?:disk|drive|storage|space)\b/i.test(t)
    && /\b(?:report|chart|interactive|largest|occup(?:y|ies|ied)|usage|free\s+space|clean(?:up)?)\b/i.test(t);
  if (asksForDiskReport) {
    const root = /\b(?:c\s*:?\s*(?:drive)?|system\s+drive)\b/i.test(t) ? `${process.env.SystemDrive || 'C:'}\\` : targetPath('home', cfg);
    const outPath = path.join(targetPath('desktop', cfg), 'WinAgent-disk-space-report.html');
    return {
      kind: 'offline',
      steps: [
        result('disk_space_report', { root, outPath, maxDepth: 3, maxEntries: 40000 }, `Created disk space report at ${outPath}`),
        result('app_open', { target: outPath }, `Opened disk space report`),
      ],
      reason: 'explicit disk-space artifact request',
    };
  }

  if (/^(?:show|give|check|display|what(?: is|'s))\s+(?:my\s+)?(?:system|computer|pc|device)\s+(?:info|information|status)?$/i.test(t)
    || /^(?:system|computer)\s+(?:info|information|status)$/i.test(t)) {
    return { kind: 'offline', steps: [result('sys_info', {}, 'System information')], reason: 'explicit system information request' };
  }

  if (/^(?:show|list|display)\s+(?:running\s+)?(?:apps|applications|processes)$/i.test(t)) {
    return { kind: 'offline', steps: [result('app_list', {}, 'Running applications')], reason: 'explicit process listing request' };
  }
  if (/^(?:show|list|display)\s+(?:open\s+)?windows$/i.test(t)) {
    return { kind: 'offline', steps: [result('window_list', {}, 'Open windows')], reason: 'explicit window listing request' };
  }
  if (/^(?:take|capture)\s+(?:a\s+)?screenshot$/i.test(t)) {
    return { kind: 'offline', steps: [result('screen_screenshot', {}, 'Screenshot captured')], reason: 'explicit screenshot request' };
  }

  const list = t.match(/^(?:please\s+)?(?:list|show|display)\s+(?:all\s+)?(?:the\s+)?files?(?:\s+and\s+folders?)?\s+(?:in|inside|under|from)\s+(.+)$/i)
    || t.match(/^what\s+(?:files|folders)\s+are\s+(?:in|inside|under)\s+(.+)$/i);
  if (list) {
    const dir = targetPath(list[1], cfg);
    return { kind: 'offline', steps: [result('file_list', { path: dir }, `Files in ${dir}`)], reason: 'explicit directory listing request' };
  }

  const search = t.match(/^(?:find|search\s+for)\s+(.+?)\s+(?:in|inside|under)\s+(.+)$/i);
  if (search) {
    const dir = targetPath(search[2], cfg);
    return { kind: 'offline', steps: [result('file_search', { dir, pattern: clean(search[1]) }, `Search results in ${dir}`)], reason: 'explicit file search request' };
  }

  const read = t.match(/^(?:read|view|show|display)\s+(?:the\s+)?(?:contents?\s+of|file)\s+(.+)$/i);
  if (read) {
    const file = targetPath(read[1], cfg);
    return { kind: 'offline', steps: [result('file_read', { path: file }, `Read ${file}`)], reason: 'explicit file read request' };
  }

  const namedFolder = t.match(/^(?:please\s+)?(?:create|make)\s+(?:a\s+)?(?:new\s+)?folder\s+(?:on|in)\s+(.+?)\s+(?:named?|called|with\s+name|name(?:d)?)\s+["']?(.+?)["']?$/i);
  if (namedFolder) {
    const base = targetPath(namedFolder[1], cfg);
    const name = clean(namedFolder[2]);
    const dir = path.join(base, name);
    return { kind: 'offline', steps: [result('file_mkdir', { path: dir }, `Created ${dir}`)], reason: 'natural-language directory creation request' };
  }

  const python = t.match(/^(?:hey\s+)?(?:please\s+)?(?:write|create|make)\s+(?:a\s+)?python\s+program\s+to\s+print\s+([\s\S]+)$/i);
  if (python) {
    const value = clean(python[1]);
    const file = path.join(targetPath('desktop', cfg), 'hello_world.py');
    const content = `print(${JSON.stringify(value)})\n`;
    return { kind: 'offline', steps: [result('file_write', { path: file, content }, `Wrote ${file}`)], reason: 'natural-language Python file creation request' };
  }

  const mkdir = t.match(/^(?:create|make)\s+(?:a\s+)?(?:new\s+)?folder\s+(.+)$/i);
  if (mkdir) {
    const dir = targetPath(mkdir[1], cfg);
    return { kind: 'offline', steps: [result('file_mkdir', { path: dir }, `Created ${dir}`)], reason: 'explicit directory creation request' };
  }

  const write = t.match(/^(?:create|make|write)\s+(?:a\s+)?file\s+(.+?)\s+(?:with|containing)\s+([\s\S]+)$/i);
  if (write) {
    const file = targetPath(write[1], cfg);
    return { kind: 'offline', steps: [result('file_write', { path: file, content: clean(write[2]) }, `Wrote ${file}`)], reason: 'explicit file write request' };
  }

  const copy = t.match(/^copy\s+(.+?)\s+to\s+(.+)$/i);
  if (copy) {
    return { kind: 'offline', steps: [result('file_copy', { from: targetPath(copy[1], cfg), to: targetPath(copy[2], cfg) }, 'Copied file')], reason: 'explicit copy request' };
  }
  const move = t.match(/^(?:move|rename)\s+(.+?)\s+to\s+(.+)$/i);
  if (move) {
    return { kind: 'offline', steps: [result('file_move', { from: targetPath(move[1], cfg), to: targetPath(move[2], cfg) }, 'Moved file')], reason: 'explicit move request' };
  }
  const remove = t.match(/^(?:delete|remove)\s+(?:the\s+)?(?:file|folder|directory)?\s*(.+)$/i);
  if (remove && !/^(?:my\s+)?(?:chat|history|memory)$/i.test(remove[1])) {
    const target = targetPath(remove[1], cfg);
    return { kind: 'offline', steps: [result('file_delete', { path: target }, `Deleted ${target}`)], reason: 'explicit delete request' };
  }

  const close = t.match(/^(?:close|stop|kill|terminate)\s+(.+)$/i);
  if (close) {
    const command = appCommand(close[1]);
    if (command) return { kind: 'offline', steps: [result('app_kill', { name: `${command}.exe` }, `Closed ${clean(close[1])}`)], reason: 'explicit known application close request' };
  }

  const packageTask = t.match(/^(install|uninstall)\s+(?:the\s+)?(?:app|application|package)?\s*(.+)$/i);
  if (packageTask) {
    const action = packageTask[1].toLowerCase() === 'install' ? 'package_install' : 'package_uninstall';
    return { kind: 'offline', steps: [result(action, { name: clean(packageTask[2]), manager: 'auto' }, `${packageTask[1]} ${clean(packageTask[2])}`)], reason: 'explicit package manager request' };
  }

  const routed = routeText(t);
  if (routed.kind === 'local') {
    const call = routed.action?.kind === 'folder'
      ? { tool: 'app_open', args: { target: `__WINAGENT_FOLDER__:${routed.action.folder}` }, label: routed.action.label }
      : routed.action?.kind === 'path'
        ? { tool: 'app_open', args: { target: routed.action.target }, label: routed.action.label }
        : routed.action?.kind === 'uri'
          ? { tool: 'app_open', args: { target: routed.action.target.slice(4) }, label: routed.action.label }
          : routed.action?.kind === 'app'
            ? { tool: 'app_launch', args: { command: routed.action.target }, label: routed.action.label }
            : null;
    if (call) return { kind: 'offline', steps: [call], reason: routed.reason };
  }
  return null;
}

export function offlineHelp() {
  return 'Offline mode handles explicit local tasks without an AI model: open/launch apps and folders, list/read/search/create/copy/move/delete files, system info, processes, windows, screenshots, and package install/uninstall. Configure an optional model for open-ended planning.';
}
