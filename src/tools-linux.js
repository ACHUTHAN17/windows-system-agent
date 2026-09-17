// Linux/macOS overrides for WinAgent tools. Called FIRST for every tool call:
// returns { handled:true, result } when this platform has its own
// implementation, { handled:false } to fall through to the built-in
// (Windows) implementation. On win32 this module never handles anything,
// so Windows behavior is byte-for-byte unchanged.
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import * as plat from './platform.js';

function ok(data) { return { ok: true, ...data }; }
function fail(error, hint) { return { ok: false, error: String(error), hint }; }
function winOnly(name) { return fail(`${name} is Windows-only on this host`, 'Run this tool on Windows, or ask for a Linux equivalent task.'); }

export async function linuxTool(name, a, ctx) {
  if (plat.isWin) return { handled: false };
  const cfg = (ctx && ctx.cfg) || {};
  try {
    switch (name) {
      case 'shell_exec': {
        const max = Math.min(Number((a && a.timeoutSec) || 20), 120);
        const { stdout, stderr } = await plat.shRun(String((a && a.command) || ''), max * 1000);
        return { handled: true, result: ok({ stdout: stdout.slice(0, 12000), stderr: stderr.slice(0, 4000) }) };
      }
      case 'app_launch': {
        const cmd = String((a && a.command) || '');
        if (!cmd) return { handled: true, result: fail('command is required') };
        const args = Array.isArray(a.args) ? a.args : String(a.args || '').split(' ').filter(Boolean);
        const child = spawn(cmd, args, { detached: true, stdio: 'ignore', cwd: (a && a.cwd) || process.cwd() });
        child.unref();
        return { handled: true, result: ok({ pid: child.pid, command: cmd }) };
      }
      case 'app_open': {
        const target = String((a && a.target) || '');
        const opener = plat.isMac ? 'open' : 'xdg-open';
        try { await plat.needBin(opener, 'desktop opener'); } catch (e) { return { handled: true, result: fail(e.message) }; }
        const child = spawn(opener, [target], { detached: true, stdio: 'ignore' });
        child.unref();
        return { handled: true, result: ok({ opened: target, pid: child.pid }) };
      }
      case 'app_list':
        return { handled: true, result: ok({ processes: await plat.procsUnix(String((a && a.filter) || '')) }) };
      case 'app_kill': {
        try {
          if (a && a.pid) { process.kill(Number(a.pid)); return { handled: true, result: ok({ killedPid: Number(a.pid) }) }; }
          if (a && a.name) {
            const all = await plat.procsUnix();
            const hit = all.find(p => p.name === String(a.name) || p.name.toLowerCase() === String(a.name).toLowerCase());
            if (!hit) return { handled: true, result: fail('no such process: ' + a.name) };
            process.kill(hit.pid);
            return { handled: true, result: ok({ killedPid: hit.pid, name: hit.name }) };
          }
          return { handled: true, result: fail('provide pid or name') };
        } catch (e) { return { handled: true, result: fail(e.message, 'You may need to run the agent with rights over that process.') }; }
      }
      case 'window_list':
        try { return { handled: true, result: ok({ windows: await plat.windowsUnix() }) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'window_manage':
        return { handled: true, result: fail('window_manage needs xdotool on Linux (sudo apt install xdotool); macOS window control is not scriptable here', 'Use app_kill/app_launch instead.') };
      case 'screen_screenshot':
      case 'browser_screenshot': {
        const out = (a && a.outPath) || path.join(os.homedir(), `shot-${Date.now()}.png`);
        try { await plat.shotUnix(out); return { handled: true, result: ok({ path: out }) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      }
      case 'screen_size': {
        try {
          const { stdout } = await plat.shRun(`xdotool getdisplaygeometry 2>/dev/null || xrandr 2>/dev/null | grep '*' | head -1 | awk '{print $1}' || echo 1920x1080`);
          const m = String(stdout).match(/([0-9]+)x([0-9]+)/);
          if (m) return { handled: true, result: ok({ Width: Number(m[1]), Height: Number(m[2]) }) };
          return { handled: true, result: fail('cannot detect display size') };
        } catch (e) { return { handled: true, result: fail(e.message) }; }
      }
      case 'screen_click': {
        const x = Number(a && a.x), y = Number(a && a.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return { handled: true, result: fail('x and y must be numbers') };
        try { return { handled: true, result: ok(await plat.clickUnix(x, y, (a && a.button) || 'left', false)) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      }
      case 'screen_double_click': {
        const x = Number(a && a.x), y = Number(a && a.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return { handled: true, result: fail('x and y must be numbers') };
        try { return { handled: true, result: ok(await plat.clickUnix(x, y, 'left', true)) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      }
      case 'mouse_move': {
        const x = Number(a && a.x), y = Number(a && a.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return { handled: true, result: fail('x and y must be numbers') };
        try { return { handled: true, result: ok(await plat.moveUnix(x, y)) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      }
      case 'screen_drag': {
        const nums = [a && a.x1, a && a.y1, a && a.x2, a && a.y2].map(Number);
        if (nums.some(n => !Number.isFinite(n))) return { handled: true, result: fail('x1,y1,x2,y2 must be numbers') };
        try { return { handled: true, result: ok(await plat.dragUnix(nums[0], nums[1], nums[2], nums[3])) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      }
      case 'screen_scroll': {
        const x = Number(a && a.x), y = Number(a && a.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return { handled: true, result: fail('x and y must be numbers') };
        try { return { handled: true, result: ok(await plat.scrollUnix(x, y, String((a && a.direction) || 'down'), Number((a && a.amount) || 3))) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      }
      case 'key_press':
        try { return { handled: true, result: ok(await plat.typeUnix(String((a && a.text) ?? ''), String((a && a.enter)) === 'true' || (a && a.enter) === true)) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'key_tap':
        try { return { handled: true, result: ok(await plat.keyUnix(String((a && a.key) || ''), String((a && a.modifiers) || ''))) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'clipboard_read':
        try { return { handled: true, result: ok({ text: (await plat.clipReadUnix()).slice(0, 8000) }) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'clipboard_write':
        try { return { handled: true, result: ok({ chars: await plat.clipWriteUnix(String((a && a.text) ?? '').slice(0, 20000)) }) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'service_list':
        try { return { handled: true, result: ok({ services: await plat.servicesUnix(String((a && a.filter) || '')) }) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'service_control': {
        const act = { start: 'start', stop: 'stop', restart: 'restart' }[String((a && a.action) || '').toLowerCase()];
        if (!act) return { handled: true, result: fail('action must be start|stop|restart') };
        try {
          await plat.needBin('systemctl', 'systemd');
          await plat.shRun(`systemctl ${act} '${String(a.name).replace(/'/g, '')}'`, 30000);
          return { handled: true, result: ok({ name: a.name, action: a.action }) };
        } catch (e) { return { handled: true, result: fail(e.message, 'May need sudo; run the agent elevated.') }; }
      }
      case 'eventlog_recent':
        try { return { handled: true, result: ok({ log: 'journal', entries: await plat.eventlogUnix(Number((a && a.max) || 20)) }) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'startup_list':
        try { return { handled: true, result: ok({ autostart: await plat.startupUnix() }) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'wifi_list':
        try { return { handled: true, result: ok({ networks: await plat.wifiUnix() }) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'installed_apps':
        try { return { handled: true, result: ok({ apps: await plat.appsUnix(String((a && a.filter) || '')) }) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'disk_info':
        try { return { handled: true, result: ok({ drives: await plat.disksUnix() }) }; }
        catch (e) { return { handled: true, result: fail(e.message) }; }
      case 'browser_info': {
        const found = {};
        for (const exe of ['google-chrome', 'chromium', 'firefox', 'microsoft-edge']) {
          try { found[exe] = await plat.needBin(exe, ''); } catch {}
        }
        return { handled: true, result: ok({ running: (await plat.procsUnix('')).filter(p => /chrom|firefox|edge/.test(p.name)).slice(0, 40), installed: found }) };
      }
      case 'browser_debug_launch': {
        const port = Number((a && a.port) || 9222);
        const wantEdge = (a && a.browser) === 'edge';
        const cands = wantEdge ? plat.chromeCands('edge') : [...plat.chromeCands('chrome'), ...plat.chromeCands('edge')];
        let bin = null;
        for (const c of cands) { try { await fsp.access(c); bin = c; break; } catch {} }
        if (!bin) {
          try { bin = await plat.needBin(wantEdge ? 'microsoft-edge' : 'google-chrome', 'a Chromium browser'); }
          catch (e) { return { handled: true, result: fail('no Chromium browser found', 'Install Chrome/Chromium or Edge.') }; }
        }
        const dir = path.join(os.tmpdir(), 'winagent-chrome-debug');
        await fsp.mkdir(dir, { recursive: true });
        const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run'];
        if (a && a.url) args.push(String(a.url));
        const child = spawn(bin, args, { detached: true, stdio: 'ignore' });
        child.unref();
        await new Promise(r => setTimeout(r, 2500));
        try {
          const ver = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json());
          return { handled: true, result: ok({ pid: child.pid, port, browser: ver.Browser, dataDir: dir }) };
        } catch { return { handled: true, result: fail(`launched pid ${child.pid} but CDP not answering on ${port}`) }; }
      }
      case 'reg_read':
      case 'reg_write':
      case 'window_focus':
        return { handled: true, result: winOnly(name) };
      default:
        return { handled: false };
    }
  } catch (e) {
    return { handled: true, result: fail('linux: ' + (e.message || String(e))) };
  }
}
