// Optional Android control bridge. It works in two modes:
// 1) inside Termux, using local Android commands;
// 2) on another OS, using a connected device through adb when ANDROID_SERIAL
//    (or ANDROID_DEVICE) is set.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const isTermux = process.platform === 'linux' && (!!process.env.TERMUX_VERSION || !!process.env.ANDROID_ROOT);
const serial = process.env.ANDROID_SERIAL || process.env.ANDROID_DEVICE || '';
const wantsAdb = !!serial || process.env.ANDROID_BRIDGE === 'adb';

function ok(data) { return { ok: true, ...data }; }
function fail(error, hint) { return { ok: false, error: String(error), hint }; }
function unavailable() { return { handled: false }; }

async function adb(args, options = {}) {
  const full = serial ? ['-s', serial, ...args] : args;
  return execFileAsync('adb', full, { timeout: options.timeout || 30000, maxBuffer: options.maxBuffer || 16 * 1024 * 1024, ...options });
}
async function local(bin, args, options = {}) {
  return execFileAsync(bin, args, { timeout: options.timeout || 30000, maxBuffer: options.maxBuffer || 16 * 1024 * 1024, ...options });
}
async function has(bin) {
  try { await execFileAsync(process.platform === 'win32' ? 'where.exe' : 'which', [bin], { timeout: 5000 }); return true; } catch { return false; }
}
async function runAndroid(args, options = {}) { return wantsAdb ? adb(args, options) : local(args[0], args.slice(1), options); }
function q(value) { return "'" + String(value).replace(/'/g, "'\\''") + "'"; }
async function adbShell(command, options = {}) { return adb(['shell', String(command)], options); }
async function adbPipe(args, data) {
  const full = serial ? ['-s', serial, ...args] : args;
  return new Promise((resolve, reject) => {
    const p = spawn('adb', full, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [], err = [];
    p.stdout.on('data', b => out.push(b)); p.stderr.on('data', b => err.push(b));
    p.once('error', reject); p.once('close', code => code ? reject(new Error(Buffer.concat(err).toString() || `adb exited ${code}`)) : resolve({ stdout: Buffer.concat(out), stderr: Buffer.concat(err) }));
    p.stdin.end(data);
  });
}
async function outputAndroid(args, outPath) {
  if (wantsAdb) {
    const r = await adb(args, { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
    await fs.writeFile(outPath, r.stdout);
  } else await local(args[0], args.slice(1));
  return outPath;
}
function keyCode(key) {
  const m = { enter: 'KEYCODE_ENTER', return: 'KEYCODE_ENTER', back: 'KEYCODE_BACK', home: 'KEYCODE_HOME', appswitch: 'KEYCODE_APP_SWITCH', recent: 'KEYCODE_APP_SWITCH', power: 'KEYCODE_POWER', delete: 'KEYCODE_DEL', backspace: 'KEYCODE_DEL', tab: 'KEYCODE_TAB', escape: 'KEYCODE_ESCAPE', volumeup: 'KEYCODE_VOLUME_UP', volumedown: 'KEYCODE_VOLUME_DOWN', volumemute: 'KEYCODE_VOLUME_MUTE', space: 'KEYCODE_SPACE', up: 'KEYCODE_DPAD_UP', down: 'KEYCODE_DPAD_DOWN', left: 'KEYCODE_DPAD_LEFT', right: 'KEYCODE_DPAD_RIGHT' };
  const k = String(key || '').toLowerCase();
  return m[k] || (/^f\d{1,2}$/.test(k) ? 'KEYCODE_' + k.toUpperCase() : null);
}

export async function androidTool(name, a = {}) {
  const bridge = isTermux || wantsAdb;
  if (!bridge) return unavailable();
  try {
    if (name === 'android_status' || name === 'android_device') {
      if (isTermux && !wantsAdb) return { handled: true, result: ok({ available: true, mode: 'termux', platform: 'android', home: process.env.HOME || '' }) };
      const r = await adb(['get-state']);
      return { handled: true, result: ok({ available: true, mode: 'adb', serial: serial || 'default', state: r.stdout.trim() }) };
    }
    if (name === 'app_open') {
      const target = String(a.target || '');
      if (!target) return { handled: true, result: fail('target is required') };
      if (target === 'uri:ms-settings:' || target === 'ms-settings:') {
        const r = await runAndroid(['shell', 'am', 'start', '-a', 'android.settings.SETTINGS']);
        return { handled: true, result: ok({ opened: 'Android Settings', output: (r.stdout || '').trim() }) };
      }
      if (isTermux && !wantsAdb && await has('termux-open')) {
        const r = await local('termux-open', [target]);
        return { handled: true, result: ok({ opened: target, output: (r.stdout || '').trim() }) };
      }
      const r = await runAndroid(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', target]);
      return { handled: true, result: ok({ opened: target, output: (r.stdout || '').trim() }) };
    }
    if (name === 'app_launch') {
      const command = String(a.command || a.package || '').trim();
      if (!command) return { handled: true, result: fail('command or package is required') };
      const args = command.includes('/') ? ['shell', 'am', 'start', '-n', command] : ['shell', 'monkey', '-p', command, '1'];
      const r = await runAndroid(args);
      return { handled: true, result: ok({ launched: command, output: (r.stdout || '').trim() }) };
    }
    if (name === 'app_list') {
      const r = await runAndroid(['shell', 'pm', 'list', 'packages']);
      return { handled: true, result: ok({ packages: String(r.stdout || '').split(/\r?\n/).filter(Boolean).map(x => x.replace(/^package:/, '')).slice(0, 500) }) };
    }
    if (wantsAdb && name === 'shell_exec') {
      const command = String(a.command || '').trim();
      if (!command) return { handled: true, result: fail('command is required') };
      const r = await adbShell(command, { timeout: Math.min(Number(a.timeoutSec || 20), 120) * 1000 });
      return { handled: true, result: ok({ stdout: String(r.stdout || '').slice(0, 12000), stderr: String(r.stderr || '').slice(0, 4000) }) };
    }
    // Remote file operations when the agent is running on a desktop and the
    // target is an adb device. Termux uses the normal local file tools instead.
    if (wantsAdb && name === 'file_list') {
      const target = String(a.path || '/sdcard');
      const r = await adbShell(`ls -la ${q(target)}`);
      const entries = String(r.stdout || '').split(/\r?\n/).filter(Boolean).slice(1).map(line => {
        const m = line.match(/^([d-])[rwx-]+\s+\d+\s+\S+\s+\S+\s+(\d+)\s+\S+\s+\S+\s+(.+)$/);
        return m ? { name: m[3], type: m[1] === 'd' ? 'dir' : 'file', size: Number(m[2]) } : { name: line, type: 'other' };
      });
      return { handled: true, result: ok({ path: target, entries }) };
    }
    if (wantsAdb && name === 'file_read') {
      const target = String(a.path || ''); if (!target) return { handled: true, result: fail('path is required') };
      const r = await adb(['exec-out', 'cat', target], { maxBuffer: 8 * 1024 * 1024 });
      const text = Buffer.isBuffer(r.stdout) ? r.stdout.toString('utf8') : String(r.stdout || '');
      return { handled: true, result: ok({ path: target, content: text.slice(0, Number(a.maxChars || 20000)) }) };
    }
    if (wantsAdb && name === 'file_write') {
      const target = String(a.path || ''); if (!target) return { handled: true, result: fail('path is required') };
      const content = Buffer.from(String(a.content ?? ''), 'utf8');
      await adbShell(`mkdir -p ${q(path.posix.dirname(target))}`);
      await adbPipe(['shell', `base64 -d > ${q(target)}`], content.toString('base64'));
      return { handled: true, result: ok({ path: target, bytes: content.length, device: serial || 'default' }) };
    }
    if (wantsAdb && name === 'file_mkdir') {
      const target = String(a.path || ''); await adbShell(`mkdir -p ${q(target)}`);
      return { handled: true, result: ok({ path: target }) };
    }
    if (wantsAdb && ['file_delete', 'file_move', 'file_copy'].includes(name)) {
      const command = name === 'file_delete' ? `rm -rf ${q(a.path)}` : name === 'file_move' ? `mv ${q(a.from)} ${q(a.to)}` : `cp -r ${q(a.from)} ${q(a.to)}`;
      await adbShell(command);
      return { handled: true, result: ok(name === 'file_delete' ? { deleted: a.path } : { from: a.from, to: a.to }) };
    }
    if (name === 'screen_screenshot' || name === 'browser_screenshot') {
      const out = String(a.outPath || `android-shot-${Date.now()}.png`);
      if (isTermux && !wantsAdb && await has('termux-screenshot')) await local('termux-screenshot', ['-f', out]);
      else await outputAndroid(['exec-out', 'screencap', '-p'], out);
      return { handled: true, result: ok({ path: out, platform: 'android' }) };
    }
    if (name === 'screen_click' || name === 'screen_double_click') {
      const x = Number(a.x), y = Number(a.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { handled: true, result: fail('x and y must be numbers') };
      const count = name === 'screen_double_click' ? 2 : 1;
      for (let i = 0; i < count; i++) { await runAndroid(['shell', 'input', 'tap', String(x), String(y)]); if (count > 1) await new Promise(r => setTimeout(r, 80)); }
      return { handled: true, result: ok({ x, y, clicks: count }) };
    }
    if (name === 'screen_drag') {
      const nums = [a.x1, a.y1, a.x2, a.y2].map(Number);
      if (nums.some(n => !Number.isFinite(n))) return { handled: true, result: fail('x1,y1,x2,y2 must be numbers') };
      await runAndroid(['shell', 'input', 'swipe', ...nums.map(String), String(Math.min(Math.max(Number(a.duration || 400), 100), 5000))]);
      return { handled: true, result: ok({ from: nums.slice(0, 2), to: nums.slice(2) }) };
    }
    if (name === 'screen_scroll') {
      const x = Number(a.x || 500), y = Number(a.y || 500), dir = String(a.direction || 'down');
      const dy = dir === 'up' ? -Math.abs(Number(a.amount || 300)) : Math.abs(Number(a.amount || 300));
      await runAndroid(['shell', 'input', 'swipe', String(x), String(y), String(x), String(y + dy), '350']);
      return { handled: true, result: ok({ x, y, direction: dir }) };
    }
    if (name === 'key_press') {
      const text = String(a.text || '').replace(/ /g, '%s');
      if (text) await runAndroid(['shell', 'input', 'text', text]);
      if (a.enter === true || String(a.enter).toLowerCase() === 'true') await runAndroid(['shell', 'input', 'keyevent', 'KEYCODE_ENTER']);
      return { handled: true, result: ok({ typedChars: String(a.text || '').length }) };
    }
    if (name === 'key_tap') {
      if (String(a.modifiers || '').trim()) return { handled: true, result: fail('Android input does not safely support this modifier shortcut through the current ADB/Termux bridge', 'Use an Android-native action or a connected hardware-keyboard bridge.') };
      const code = keyCode(a.key);
      if (!code) return { handled: true, result: fail('unsupported Android key: ' + a.key) };
      await runAndroid(['shell', 'input', 'keyevent', code]);
      return { handled: true, result: ok({ key: a.key }) };
    }
    if (name === 'clipboard_read' && isTermux && !wantsAdb && await has('termux-clipboard-get')) {
      const r = await local('termux-clipboard-get', []);
      return { handled: true, result: ok({ text: r.stdout || '' }) };
    }
    if (name === 'clipboard_write' && isTermux && !wantsAdb && await has('termux-clipboard-set')) {
      const p = spawn('termux-clipboard-set', [], { stdio: ['pipe', 'ignore', 'ignore'] });
      p.stdin.end(String(a.text || ''));
      await new Promise((resolve, reject) => { p.once('close', code => code ? reject(new Error('termux clipboard failed')) : resolve()); p.once('error', reject); });
      return { handled: true, result: ok({ chars: String(a.text || '').length }) };
    }
    return unavailable();
  } catch (e) {
    return { handled: true, result: fail(e.message, 'Install Termux:API on Android or enable USB debugging and configure ANDROID_SERIAL for adb.') };
  }
}
