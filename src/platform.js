// Cross-platform backend for WinAgent: Windows (PowerShell + Win32) vs
// Linux/macOS (bash + everyday CLI tools). Zero dependencies.
// Windows branches live next to the existing PowerShell code in tools.js;
// this file owns OS detection, binary probing, and the Unix implementations.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

export const isWin = process.platform === 'win32';
export const isMac = process.platform === 'darwin';
export const isLinux = process.platform === 'linux';
export const platName = process.platform;

const binCache = new Map();

// Resolve a binary via PATH (where/which). Throws with install hint.
export async function needBin(cands, hint) {
  const list = Array.isArray(cands) ? cands : [cands];
  for (const c of list) {
    const key = 'bin:' + c;
    if (binCache.has(key)) {
      const hit = binCache.get(key);
      if (hit) return hit;
      continue;
    }
    try {
      const probe = isWin ? 'where.exe' : 'which';
      const r = await execFileAsync(probe, [c], { windowsHide: true, timeout: 8000 });
      const p = r.stdout.trim().split(/\r?\n/)[0];
      if (p) { binCache.set(key, p); return p; }
    } catch { /* try next */ }
    binCache.set(key, null);
  }
  throw new Error(`needs ${list.join('/')} (${hint})`);
}

// Run a shell command: PowerShell on Windows, bash elsewhere. No visible window.
export async function shRun(command, timeoutMs = 20000) {
  if (isWin) {
    const { stdout, stderr } = await execFileAsync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', String(command)],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  }
  const shell = await needBin(['bash', 'sh'], 'a POSIX shell');
  const { stdout, stderr } = await execFileAsync(shell,
    ['-lc', String(command)], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
  return { stdout: (stdout || '').trim(), stderr: (stderr || '').trim() };
}

// ---------- Linux/macOS screen + input (xdotool X11, wtype Wayland) ----------
async function xdo(args) {
  const xd = await needBin('xdotool', 'sudo apt install xdotool  (X11 session)');
  const { stdout } = await execFileAsync(xd, args, { timeout: 15000 });
  return (stdout || '').trim();
}

export async function shotUnix(outPath) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  if (isMac) {
    await execFileAsync('screencapture', ['-x', outPath], { timeout: 20000 });
    return outPath;
  }
  // Wayland first, then X11 fallbacks.
  try { await needBin('grim', 'sudo apt install grim (Wayland)'); await execFileAsync('grim', [outPath], { timeout: 20000 }); return outPath; }
  catch (e1) {
    try { await needBin(['scrot', 'import', 'gnome-screenshot'], 'sudo apt install scrot (X11)'); } catch (e) { throw new Error('no screenshot tool (grim/scrot/import). ' + e1.message); }
    try { await execFileAsync('scrot', [outPath], { timeout: 20000 }); return outPath; }
    catch {
      try { await execFileAsync('import', ['-window', 'root', outPath], { timeout: 20000 }); return outPath; }
      catch { await execFileAsync('gnome-screenshot', ['-f', outPath], { timeout: 20000 }); return outPath; }
    }
    return outPath;
  }
}

export async function clickUnix(x, y, button = 'left', double = false) {
  const btn = button === 'right' ? 3 : button === 'middle' ? 2 : 1;
  await xdo(['mousemove', String(x), String(y), 'sleep', '0.15']);
  const seq = double ? ['click', '--repeat', '2', '--delay', '80', String(btn)] : ['click', String(btn)];
  await xdo(seq);
  return { x, y, button, double };
}

export async function moveUnix(x, y) {
  await xdo(['mousemove', String(x), String(y)]);
  return { x, y };
}

export async function dragUnix(x1, y1, x2, y2, steps = 10) {
  await xdo(['mousemove', String(x1), String(y1), 'sleep', '0.15', 'mousedown', '1']);
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(x1 + ((x2 - x1) * i) / steps);
    const y = Math.round(y1 + ((y2 - y1) * i) / steps);
    await xdo(['mousemove', String(x), String(y), 'sleep', '0.03']);
  }
  await xdo(['mouseup', '1']);
  return { from: [x1, y1], to: [x2, y2] };
}

export async function scrollUnix(x, y, direction = 'down', amount = 3) {
  // X11 buttons: 4=up 5=down 6=left 7=right.
  const btn = direction === 'up' ? 4 : direction === 'down' ? 5 : direction === 'left' ? 6 : direction === 'right' ? 7 : 0;
  if (!btn) throw new Error('direction must be up|down|left|right');
  await xdo(['mousemove', String(x), String(y), 'sleep', '0.1']);
  for (let i = 0; i < Math.min(Math.max(amount, 1), 20); i++) await xdo(['click', String(btn)]);
  return { x, y, direction, amount };
}

export async function typeUnix(text, enter = false) {
  await xdo(['type', '--delay', '12', '--', String(text ?? '')]);
  if (enter) await xdo(['key', 'Return']);
  return { typedChars: String(text ?? '').length, enter: !!enter };
}

const KEYMAP = {
  enter: 'Return', tab: 'Tab', esc: 'Escape', backspace: 'BackSpace', delete: 'Delete',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', home: 'Home', end: 'End',
  pgup: 'Page_Up', pgdn: 'Page_Down', space: 'space',
};

export async function keyUnix(key, modifiers = '') {
  let k = String(key || '').trim();
  const low = k.toLowerCase();
  let code = KEYMAP[low] || null;
  if (/^f[0-9]{1,2}$/i.test(k)) code = 'F' + k.slice(1);
  else if (/^[a-z0-9]$/i.test(k)) code = k.toLowerCase();
  if (!code) throw new Error('unknown key: ' + k);
  const mods = [];
  for (const m of String(modifiers).toLowerCase().split(',')) {
    if (m.includes('ctrl')) mods.push('ctrl');
    else if (m.includes('alt')) mods.push('alt');
    else if (m.includes('shift')) mods.push('shift');
    else if (m.includes('super') || m.includes('win')) mods.push('Super_L');
  }
  await xdo(['key', ...mods.map(m => m + '+').join('') ? [mods.map(m => m + '+').join('') + code] : [code]]);
  return { key: k, modifiers };
}

export async function clipReadUnix() {
  if (isMac) {
    const { stdout } = await execFileAsync('pbpaste', [], { timeout: 10000 });
    return stdout;
  }
  try { const w = await needBin(['wl-paste'], 'wl-clipboard (Wayland)'); const { stdout } = await execFileAsync(w, [], { timeout: 10000 }); return stdout; }
  catch {
    const x = await needBin(['xclip', 'xsel'], 'sudo apt install xclip (X11)');
    const base = x.endsWith('xclip') ? [x, '-selection', 'clipboard', '-o'] : [x, '--clipboard', '--output'];
    const { stdout } = await execFileAsync(base[0], base.slice(1), { timeout: 10000 });
    return stdout;
  }
}

export async function clipWriteUnix(text) {
  if (isMac) {
    const p = execFileAsync('pbcopy', [], { timeout: 10000 });
    p.child.stdin.write(String(text ?? ''));
    p.child.stdin.end();
    await p;
    return String(text ?? '').length;
  }
  try { const w = await needBin(['wl-copy'], 'wl-clipboard (Wayland)'); const p = execFileAsync(w, [], { timeout: 10000 }); p.child.stdin.write(String(text ?? '')); p.child.stdin.end(); await p; return String(text ?? '').length; }
  catch {
    const x = await needBin(['xclip', 'xsel'], 'sudo apt install xclip (X11)');
    if (x.endsWith('xclip')) { const p = execFileAsync(x, ['-selection', 'clipboard'], { timeout: 10000 }); p.child.stdin.write(String(text ?? '')); p.child.stdin.end(); await p; }
    else { const p = execFileAsync(x, ['--clipboard', '--input'], { timeout: 10000 }); p.child.stdin.write(String(text ?? '')); p.child.stdin.end(); await p; }
    return String(text ?? '').length;
  }
}

// ---------- Linux/macOS system data ----------
export async function procsUnix(filter = '') {
  const { stdout } = await execFileAsync('ps', ['-eo', 'comm=,pid=,rss='], { timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
  const f = filter.toLowerCase();
  return stdout.split('\n').map(l => l.trim().split(/\s+/)).filter(p => p.length >= 3)
    .map(p => ({ name: p[0], pid: Number(p[1]), memMB: Math.round(Number(p[2]) / 1024) }))
    .filter(p => !f || p.name.toLowerCase().includes(f)).slice(0, 200);
}

export async function disksUnix() {
  const { stdout } = await execFileAsync('df', ['-kP'], { timeout: 15000 });
  const lines = stdout.trim().split('\n').slice(1);
  return lines.map(l => {
    const p = l.trim().split(/\s+/);
    const total = Number(p[1]) / 1048576, free = Number(p[3]) / 1048576;
    return { name: p[0], root: p[5], UsedGB: Math.round((total - free) * 10) / 10, FreeGB: Math.round(free * 10) / 10 };
  });
}

export async function servicesUnix(filter = '') {
  try {
    await needBin('systemctl', 'systemd');
    const { stdout } = await execFileAsync('systemctl', ['list-units', '--type=service', '--all', '--no-legend', '--no-pager'], { timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
    const f = filter.toLowerCase();
    return stdout.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const p = l.split(/\s+/);
      return { name: (p[0] || '').replace(/\.service$/, ''), display: p.slice(3).join(' ') || p[0], status: /running/i.test(l) ? 'Running' : 'Stopped' };
    }).filter(s => !f || (s.name + s.display).toLowerCase().includes(f)).slice(0, 200);
  } catch (e) {
    throw new Error('systemctl unavailable: ' + e.message);
  }
}

export async function eventlogUnix(max = 20) {
  const j = await needBin('journalctl', 'systemd-journal');
  const { stdout } = await execFileAsync(j, ['--no-pager', '-n', String(Math.min(max, 100)), '-o', 'short-iso'], { timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
  return stdout.split('\n').filter(Boolean).map(l => ({ message: l.slice(0, 500) }));
}

export async function wifiUnix() {
  const nm = await needBin('nmcli', 'sudo apt install network-manager');
  const { stdout } = await execFileAsync(nm, ['-t', '-f', 'SSID,SIGNAL', 'dev', 'wifi', 'list'], { timeout: 30000 });
  return stdout;
}

export async function appsUnix(filter = '') {
  const f = filter.toLowerCase();
  const out = [];
  try {
    const { stdout } = await execFileAsync('dpkg-query', ['-W', '-f=${Package}\t${Version}\n'], { timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
    for (const l of stdout.split('\n')) {
      const [name, version] = l.split('\t');
      if (name && (!f || name.toLowerCase().includes(f))) out.push({ name, version: version || '', publisher: '' });
      if (out.length >= 200) break;
    }
  } catch {
    const { stdout } = await execFileAsync('flatpak', ['list', '--app', '--columns=name,version'], { timeout: 30000 }).catch(() => ({ stdout: '' }));
    for (const l of stdout.split('\n')) {
      const [name, version] = l.split('\t');
      if (name && (!f || name.toLowerCase().includes(f))) out.push({ name, version: version || '', publisher: '' });
    }
  }
  return out;
}

export async function startupUnix() {
  const out = [];
  const dirs = [path.join(os.homedir(), '.config', 'autostart'), '/etc/xdg/autostart'];
  for (const d of dirs) {
    try {
      const files = await fs.readdir(d);
      for (const f of files.filter(x => x.endsWith('.desktop')).slice(0, 50)) out.push({ scope: d, name: f });
    } catch { /* no dir */ }
  }
  return out;
}

export async function windowsUnix() {
  try {
    const x = await needBin(['wmctrl', 'xdotool'], 'sudo apt install wmctrl');
    if (x.endsWith('wmctrl')) {
      const { stdout } = await execFileAsync(x, ['-l'], { timeout: 15000 });
      return stdout.split('\n').filter(Boolean).map(l => {
        const p = l.split(/\s+/);
        return { app: 'x11', pid: 0, title: p.slice(3).join(' ') };
      }).slice(0, 100);
    }
    const { stdout } = await execFileAsync(x, ['search', '--onlyvisible', '--name', ''], { timeout: 15000 });
    return stdout.split('\n').filter(Boolean).map(id => ({ app: 'x11', pid: 0, title: 'window ' + id }));
  } catch (e) {
    throw new Error('no window lister (wmctrl/xdotool). ' + e.message);
  }
}

export function chromeCands(exe) {
  if (exe === 'chrome') {
    if (isWin) return ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'];
    return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
  }
  if (isWin) return ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
  return ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'];
}
