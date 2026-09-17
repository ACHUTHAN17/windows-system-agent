// Windows file + app tools. All functions are async and return JSON-safe values.
// Every entry: { name, description, args, run(args, ctx) }
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import { isPathAllowed } from './safety.js';

const execFileAsync = promisify(execFile);

function ok(data) { return { ok: true, ...data }; }
function fail(error, hint) { return { ok: false, error: String(error), hint }; }

async function ps(command, timeout = 20000) {
  // Single choke point for PowerShell so audit + allowlist stay in one place.
  const { stdout, stderr } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

// ---------- Chrome DevTools Protocol helpers (zero-dep: fetch + WebSocket) ----------
async function cdpTabs(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`).catch(() => null);
  if (!res || !res.ok) throw new Error(`no debug browser on port ${port}`);
  const all = await res.json();
  return all.filter(t => t.type === 'page' && t.webSocketDebuggerUrl);
}

async function cdpFindTab(port, idPrefix) {
  const tabs = await cdpTabs(port);
  const t = tabs.find(t => t.id.startsWith(idPrefix) || t.id === idPrefix);
  if (!t) throw new Error(`tab '${idPrefix}' not found (${tabs.length} tabs open)`);
  return t;
}

function cdpSend(wsUrl, method, params = {}, timeout = 15000) {
  return new Promise((resolve, reject) => {
    let ws;
    try { ws = new WebSocket(wsUrl); } catch (e) { reject(new Error(`WebSocket unavailable: ${e.message}`)); return; }
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error(`CDP timeout: ${method}`)); }, timeout);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
    ws.onerror = () => { clearTimeout(timer); reject(new Error(`CDP socket error: ${method}`)); };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(String(ev.data));
        if (m.id === 1) {
          clearTimeout(timer);
          try { ws.close(); } catch {}
          if (m.error) reject(new Error(m.error.message || JSON.stringify(m.error)));
          else resolve(m.result || {});
        }
      } catch {}
    };
  });
}

export function buildTools() {
  return [
    {
      name: 'sys_info', description: 'OS, CPU, memory, uptime, user, hostname.',
      args: {},
      async run() {
        return ok({ platform: os.platform(), release: os.release(), arch: os.arch(), hostname: os.hostname(), user: os.userInfo().username, cpus: os.cpus().length, totalMemMB: Math.round(os.totalmem() / 1048576), freeMemMB: Math.round(os.freemem() / 1048576), uptimeMin: Math.round(os.uptime() / 60) });
      },
    },
    {
      name: 'file_list', description: 'List directory: name, type, size, mtime. Use absolute path.',
      args: { path: 'absolute dir path' },
      async run(a, ctx) {
        try {
          const chk = isPathAllowed(ctx.cfg, a.path); if (!chk.ok) return fail(chk.reason);
          const entries = await fsp.readdir(a.path, { withFileTypes: true });
          const out = [];
          for (const e of entries.slice(0, 300)) {
            let size = null, mtime = null;
            try { const st = await fsp.stat(path.join(a.path, e.name)); size = st.size; mtime = st.mtime.toISOString(); } catch {}
            out.push({ name: e.name, type: e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other', size, mtime });
          }
          return ok({ path: a.path, count: entries.length, entries: out });
        } catch (e) { return fail(e.message, 'Check the path exists and is a directory.'); }
      },
    },
    {
      name: 'file_read', description: 'Read text file (utf8). Supports offset/limit lines, maxChars.',
      args: { path: 'absolute file path', offset: 'start line (1-based, opt)', limit: 'max lines (opt)', maxChars: 'truncate (opt)' },
      async run(a, ctx) {
        try {
          const chk = isPathAllowed(ctx.cfg, a.path); if (!chk.ok) return fail(chk.reason);
          const text = await fsp.readFile(a.path, 'utf8');
          const lines = text.split(/\r?\n/);
          const off = Math.max(1, Number(a.offset || 1)) - 1;
          const lim = Number(a.limit || 200);
          const slice = lines.slice(off, off + lim).join('\n');
          const max = Number(a.maxChars || 20000);
          return ok({ path: a.path, totalLines: lines.length, showing: `${off + 1}-${off + slice.split('\n').length}`, content: slice.slice(0, max), truncated: text.length > max });
        } catch (e) { return fail(e.message, 'Use file_list on the parent dir first.'); }
      },
    },
    {
      name: 'file_write', description: 'Create/overwrite text file. Creates parent dirs. DESTRUCTIVE.',
      args: { path: 'absolute file path', content: 'full text' },
      async run(a, ctx) {
        try {
          const chk = isPathAllowed(ctx.cfg, a.path); if (!chk.ok) return fail(chk.reason);
          await fsp.mkdir(path.dirname(a.path), { recursive: true });
          await fsp.writeFile(a.path, String(a.content ?? ''), 'utf8');
          return ok({ path: a.path, bytes: Buffer.byteLength(String(a.content ?? '')) });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'file_edit', description: 'Replace first occurrence of oldString with newString. DESTRUCTIVE.',
      args: { path: 'absolute file path', oldString: 'literal to find', newString: 'replacement' },
      async run(a, ctx) {
        try {
          const chk = isPathAllowed(ctx.cfg, a.path); if (!chk.ok) return fail(chk.reason);
          const text = await fsp.readFile(a.path, 'utf8');
          if (!text.includes(a.oldString)) return fail('oldString not found');
          await fsp.writeFile(a.path, text.replace(a.oldString, String(a.newString ?? '')), 'utf8');
          return ok({ path: a.path });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'file_mkdir', description: 'Create directory recursively.',
      args: { path: 'absolute dir path' },
      async run(a, ctx) {
        try {
          const chk = isPathAllowed(ctx.cfg, a.path); if (!chk.ok) return fail(chk.reason);
          await fsp.mkdir(a.path, { recursive: true });
          return ok({ path: a.path });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'file_delete', description: 'Delete file or dir (recursive). DESTRUCTIVE.',
      args: { path: 'absolute path' },
      async run(a, ctx) {
        try {
          const chk = isPathAllowed(ctx.cfg, a.path); if (!chk.ok) return fail(chk.reason);
          await fsp.rm(a.path, { recursive: true, force: false });
          return ok({ deleted: a.path });
        } catch (e) { return fail(e.message, 'Check the path and close apps locking it.'); }
      },
    },
    {
      name: 'file_move', description: 'Move/rename file or dir. DESTRUCTIVE.',
      args: { from: 'source', to: 'dest' },
      async run(a, ctx) {
        try {
          for (const p of [a.from, a.to]) { const chk = isPathAllowed(ctx.cfg, p); if (!chk.ok) return fail(chk.reason); }
          await fsp.mkdir(path.dirname(a.to), { recursive: true });
          await fsp.rename(a.from, a.to);
          return ok({ from: a.from, to: a.to });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'file_copy', description: 'Copy file or dir. DESTRUCTIVE (writes).',
      args: { from: 'source', to: 'dest' },
      async run(a, ctx) {
        try {
          for (const p of [a.from, a.to]) { const chk = isPathAllowed(ctx.cfg, p); if (!chk.ok) return fail(chk.reason); }
          await fsp.cp(a.from, a.to, { recursive: true });
          return ok({ from: a.from, to: a.to });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'file_search', description: 'Search text inside files under dir (recursive, capped).',
      args: { dir: 'root dir', pattern: 'substring or /regex/', ext: 'optional e.g. .txt,.js' },
      async run(a, ctx) {
        try {
          const chk = isPathAllowed(ctx.cfg, a.dir); if (!chk.ok) return fail(chk.reason);
          let rx;
          const p = String(a.pattern || '');
          if (p.startsWith('/') && p.lastIndexOf('/') > 0) {
            const last = p.lastIndexOf('/');
            rx = new RegExp(p.slice(1, last), p.slice(last + 1) || 'i');
          } else rx = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const exts = String(a.ext || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
          const hits = [];
          async function walk(d, depth) {
            if (depth > 6 || hits.length >= 50) return;
            const ents = await fsp.readdir(d, { withFileTypes: true }).catch(() => []);
            for (const e of ents) {
              if (hits.length >= 50) return;
              const full = path.join(d, e.name);
              if (e.isDirectory()) { if (!e.name.startsWith('.')) await walk(full, depth + 1); }
              else if (e.isFile()) {
                if (exts.length && !exts.includes(path.extname(e.name).toLowerCase())) continue;
                let st; try { st = await fsp.stat(full); } catch { continue; }
                if (st.size > 1024 * 1024) continue;
                const text = await fsp.readFile(full, 'utf8').catch(() => null);
                if (text == null) continue;
                const lines = text.split(/\r?\n/);
                lines.forEach((ln, i) => { if (hits.length < 50 && rx.test(ln)) hits.push({ file: full, line: i + 1, text: ln.slice(0, 300) }); });
              }
            }
          }
          await walk(a.dir, 0);
          return ok({ dir: a.dir, pattern: a.pattern, matches: hits });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'app_launch', description: 'Launch app detached: exe path or command + optional args.',
      args: { command: 'exe or command, e.g. C:\\Windows\\notepad.exe or notepad', args: 'array or string (opt)', cwd: 'working dir (opt)' },
      async run(a) {
        try {
          const cmd = String(a.command);
          const args = Array.isArray(a.args) ? a.args : String(a.args || '').split(' ').filter(Boolean);
          const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true, cwd: a.cwd || process.cwd(), shell: false });
          child.unref();
          return ok({ pid: child.pid, command: cmd });
        } catch (e) { return fail(e.message, 'Try absolute exe path or a PATH command like notepad.'); }
      },
    },
    {
      name: 'app_open', description: 'Open file/URL with default Windows handler (like double-click).',
      args: { target: 'file path or https URL' },
      async run(a) {
        try {
          const child = spawn('cmd.exe', ['/c', 'start', '""', a.target], { detached: true, stdio: 'ignore', windowsHide: true, shell: false });
          child.unref();
          return ok({ opened: a.target, pid: child.pid });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'app_list', description: 'List running processes (name, pid, memory MB). Optional name filter.',
      args: { filter: 'substring match on process name (opt)' },
      async run(a) {
        try {
          const f = String(a.filter || '').toLowerCase();
          const { stdout } = await ps(`Get-Process | Select-Object Name, Id, @{n='MB';e={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json -Compress`);
          let arr = JSON.parse(stdout || '[]');
          if (!Array.isArray(arr)) arr = [arr];
          const rows = arr.map(p => ({ name: p.Name, pid: p.Id, memMB: p.MB })).filter(p => !f || p.name.toLowerCase().includes(f)).slice(0, 200);
          return ok({ count: rows.length, processes: rows });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'app_kill', description: 'Kill process by pid or image name. DESTRUCTIVE.',
      args: { pid: 'number (opt)', name: 'e.g. notepad.exe (opt, use with force)' },
      async run(a) {
        try {
          if (a.pid) {
            await execFileAsync('taskkill.exe', ['/PID', String(a.pid), '/F'], { windowsHide: true });
            return ok({ killedPid: Number(a.pid) });
          }
          if (a.name) {
            await execFileAsync('taskkill.exe', ['/IM', String(a.name), '/F'], { windowsHide: true });
            return ok({ killedName: a.name });
          }
          return fail('provide pid or name');
        } catch (e) { return fail(e.message, 'Run app_list first to get exact pid/name.'); }
      },
    },
    {
      name: 'window_list', description: 'Visible windows with titles (app, title, pid).',
      args: {},
      async run() {
        try {
          const { stdout } = await ps(`Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object ProcessName, Id, MainWindowTitle | ConvertTo-Json -Compress`);
          let arr = JSON.parse(stdout || '[]');
          if (!Array.isArray(arr)) arr = [arr];
          return ok({ windows: arr.map(w => ({ app: w.ProcessName, pid: w.Id, title: w.MainWindowTitle })).slice(0, 100) });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'screen_screenshot', description: 'Capture primary screen to PNG file. Returns saved path.',
      args: { outPath: 'absolute png path (opt, default Documents screenshot.png)' },
      async run(a, ctx) {
        try {
          const out = a.outPath || path.join(os.homedir(), 'Documents', `screenshot-${Date.now()}.png`);
          const chk = isPathAllowed(ctx.cfg, out); if (!chk.ok) return fail(chk.reason);
          await fsp.mkdir(path.dirname(out), { recursive: true });
          const psCode = `Add-Type -AssemblyName System.Drawing; $b = New-Object Drawing.Bitmap([System.Windows.Forms.SystemInformation]::PrimaryMonitorSize.Width, [System.Windows.Forms.SystemInformation]::PrimaryMonitorSize.Height); Add-Type -AssemblyName System.Windows.Forms; $g = [Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0,0,0,0,$b.Size); $b.Save('${out.replace(/'/g, "''")}'); $g.Dispose(); $b.Dispose(); 'saved'`;
          // Need WinForms assembly first
          await ps(`Add-Type -AssemblyName System.Windows.Forms; ${psCode.replace('Add-Type -AssemblyName System.Drawing; ', 'Add-Type -AssemblyName System.Drawing; ')}`);
          const st = await fsp.stat(out);
          return ok({ path: out, bytes: st.size });
        } catch (e) { return fail(e.message, 'Screenshot needs an interactive desktop session (not headless service).'); }
      },
    },
    {
      name: 'clipboard_read', description: 'Read current Windows clipboard text.',
      args: {},
      async run() {
        try {
          const { stdout } = await ps(`Get-Clipboard -Raw`);
          return ok({ text: stdout.slice(0, 8000) });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'browser_info', description: 'List installed browsers + running browser processes/windows. For full tab control, start Chrome with --remote-debugging-port.',
      args: {},
      async run() {
        try {
          const { stdout } = await ps(`Get-Process | Where-Object { $_.ProcessName -match '^(chrome|msedge|firefox|brave|opera)$' } | Select-Object ProcessName, Id, MainWindowTitle | ConvertTo-Json -Compress`);
          let arr = [];
          try { arr = JSON.parse(stdout || '[]'); if (!Array.isArray(arr)) arr = [arr]; } catch {}
          const paths = {};
          const browserDefaults = {
            'chrome.exe': ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'],
            'msedge.exe': ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
            'firefox.exe': ['C:/Program Files/Mozilla Firefox/firefox.exe'],
            'brave.exe': ['C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'],
          };
          for (const exe of ['chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe']) {
            try {
              const r = await execFileAsync('where.exe', [exe], { windowsHide: true });
              const w = r.stdout.trim().split(/\\r?\\n/)[0];
              if (w) { paths[exe] = w; continue; }
            } catch { /* fall through to defaults */ }
            for (const c of (browserDefaults[exe] || [])) { try { await fsp.access(c); paths[exe] = c; break; } catch { /* next */ } }
          }
          return ok({
            running: arr.map(b => ({ app: b.ProcessName, pid: b.Id, title: b.MainWindowTitle || '' })),
            installed: paths,
            tabControlNote: 'For tab read/click/fill, run browser_debug_launch first (separate debug profile, safe beside the main browser).',
          });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'reg_read', description: 'Read Windows registry key values (read-only).',
      args: { key: 'e.g. HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer' },
      async run(a) {
        try {
          const { stdout } = await ps(`Get-ItemProperty -Path '${String(a.key).replace(/'/g, "''")}' | ConvertTo-Json -Compress -Depth 3`);
          return ok({ key: a.key, values: JSON.parse(stdout || '{}') });
        } catch (e) { return fail(e.message, 'Use HKCU:/HKLM: prefix, e.g. HKCU:\\Software\\Microsoft.'); }
      },
    },
    {
      name: 'service_list', description: 'List Windows services (name, state). Optional name filter.',
      args: { filter: 'substring (opt)', state: 'Running/Stopped (opt)' },
      async run(a) {
        try {
          const f = String(a.filter || '').toLowerCase();
          const { stdout } = await ps(`Get-Service | Select-Object Name, DisplayName, @{n='Status';e={$_.Status.ToString()}} | ConvertTo-Json -Compress`);
          let arr = JSON.parse(stdout || '[]');
          if (!Array.isArray(arr)) arr = [arr];
          let rows = arr.map(s => ({ name: s.Name, display: s.DisplayName, status: s.Status }));
          if (a.state) rows = rows.filter(r => r.status.toLowerCase() === String(a.state).toLowerCase());
          if (f) rows = rows.filter(r => (r.name + r.display).toLowerCase().includes(f));
          return ok({ count: rows.length, services: rows.slice(0, 200) });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'shell_exec', description: 'Run PowerShell command with timeout. DESTRUCTIVE-GATED: allowlisted binaries only for one-liners; full scripts need approval.',
      args: { command: 'powershell code', timeoutSec: 'opt, default 20' },
      async run(a) {
        try {
          const { stdout, stderr } = await ps(String(a.command), Math.min(Number(a.timeoutSec || 20), 120) * 1000);
          return ok({ stdout: stdout.slice(0, 12000), stderr: stderr.slice(0, 4000) });
        } catch (e) { return fail(e.message || String(e)); }
      },
    },
    // ---------- A. True screen agent ----------
    {
      name: 'screen_size', description: 'Primary monitor size in pixels (needed to compute click coords).',
      args: {},
      async run() {
        try {
          const { stdout } = await ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemInformation]::PrimaryMonitorSize | Select-Object Width, Height | ConvertTo-Json -Compress`);
          return ok(JSON.parse(stdout));
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'screen_click', description: 'Move mouse and click at x,y pixels. Button: left/right/middle. INPUT-INJECTING: needs approval.',
      args: { x: 'number', y: 'number', button: 'left|right|middle (opt)' },
      async run(a) {
        try {
          const x = Number(a.x), y = Number(a.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('x and y must be numbers (use screen_size first)');
          const b = String(a.button || 'left').toLowerCase();
          const flags = b === 'right' ? [8, 16] : b === 'middle' ? [32, 64] : [2, 4];
          const code = `Add-Type -AssemblyName System.Windows.Forms; Add-Type @'\nusing System;\nusing System.Runtime.InteropServices;\npublic class WinMouse {\n [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);\n [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);\n}\n'@; [WinMouse]::SetCursorPos(${x}, ${y}); Start-Sleep -Milliseconds 120; [WinMouse]::mouse_event(${flags[0]},0,0,0,0); Start-Sleep -Milliseconds 60; [WinMouse]::mouse_event(${flags[1]},0,0,0,0); 'clicked'`;
          const { stdout } = await ps(code);
          return ok({ x, y, button: b, result: stdout });
        } catch (e) { return fail(e.message, 'Clicks need an interactive desktop session.'); }
      },
    },
    {
      name: 'key_press', description: 'Type text into the focused window (SendKeys). Use window_focus first. INPUT-INJECTING: needs approval.',
      args: { text: 'text to type', enter: 'true to press Enter after (opt)' },
      async run(a) {
        try {
          const esc = String(a.text ?? '').replace(/([+^%~(){}[\]])/g, '{$1}').replace(/'/g, "''") + (String(a.enter) === 'true' ? '{ENTER}' : '');
          await ps(`(New-Object -ComObject WScript.Shell).SendKeys('${esc}')`);
          return ok({ typedChars: String(a.text ?? '').length, enter: String(a.enter) === 'true' });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'window_focus', description: 'Bring a window to front by pid or title substring so clicks/keys land correctly.',
      args: { pid: 'number (opt)', title: 'substring of window title (opt)' },
      async run(a) {
        try {
          let code;
          if (a.pid) code = `$p = Get-Process -Id ${Number(a.pid)} -ErrorAction Stop`;
          else if (a.title) code = `$p = Get-Process | Where-Object { $_.MainWindowTitle -like '*${String(a.title).replace(/'/g, "''")}*' } | Select-Object -First 1; if (-not $p) { throw 'no window matching title' }`;
          else return fail('provide pid or title');
          const full = `Add-Type @'\nusing System;\nusing System.Runtime.InteropServices;\npublic class WinFocus { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }\n'@; ${code}; [WinFocus]::SetForegroundWindow($p.MainWindowHandle); $p.MainWindowTitle`;
          const { stdout } = await ps(full);
          return ok({ focused: stdout });
        } catch (e) { return fail(e.message, 'Run window_list first to get exact pid/title.'); }
      },
    },
    // ---------- B. Browser autopilot (Chrome/Edge CDP) ----------
    {
      name: 'browser_debug_launch', description: 'Launch Chromium with remote-debugging port (separate profile, safe beside your main browser). Enables browser_tabs/navigate/read/click/fill.',
      args: { port: 'CDP port, default 9222 (opt)', url: 'page to open (opt)', browser: 'chrome|edge (opt)' },
      async run(a) {
        try {
          const port = Number(a.port || 9222);
          const wantEdge = a.browser === 'edge';
          const exes = wantEdge ? ['msedge.exe'] : ['chrome.exe', 'msedge.exe'];
          let bin = null;
          for (const exe of exes) {
            try {
              const w = (await execFileAsync('where.exe', [exe], { windowsHide: true })).stdout.trim().split(/\r?\n/)[0];
              if (w) { bin = w; break; }
            } catch { /* not in PATH */ }
            const cands = exe === 'chrome.exe'
              ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
              : ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'];
            for (const c of cands) { try { await fsp.access(c); bin = c; break; } catch { /* try next */ } }
            if (bin) break;
            try {
              const r = await ps(`(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}' -ErrorAction Stop).'(default)'`);
              if (r.stdout) { bin = r.stdout.trim(); break; }
            } catch { /* try next */ }
          }
          if (!bin) return fail('no Chromium browser found', 'Install Chrome or Edge, or pass browser: edge.');
          const dir = path.join(os.tmpdir(), 'winagent-chrome-debug');
          await fsp.mkdir(dir, { recursive: true });
          const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run'];
          if (a.url) args.push(String(a.url));
          const child = spawn(bin, args, { detached: true, stdio: 'ignore', windowsHide: true });
          child.unref();
          await new Promise(r => setTimeout(r, 2500));
          const ver = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()).catch(() => null);
          if (!ver) return fail(`launched pid ${child.pid} but CDP not answering on ${port}`, 'Port may be in use; try another port.');
          return ok({ pid: child.pid, port, browser: ver.Browser, dataDir: dir });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'browser_tabs', description: 'List open tabs (id, title, url) on the debug port. Needs browser_debug_launch first (or Chrome started with --remote-debugging-port).',
      args: { port: 'CDP port, default 9222 (opt)' },
      async run(a) {
        try {
          const tabs = await cdpTabs(Number(a.port || 9222));
          return ok({ count: tabs.length, tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url })) });
        } catch (e) { return fail(e.message, 'Run browser_debug_launch first.'); }
      },
    },
    {
      name: 'browser_navigate', description: 'Navigate a tab (or open one) to a URL. INPUT-INJECTING: needs approval.',
      args: { url: 'https://...', tabId: 'tab id prefix (opt, else new tab)', port: 'CDP port (opt)' },
      async run(a) {
        try {
          const port = Number(a.port || 9222);
          if (!/^(https?|file):\/\//i.test(String(a.url || ''))) return fail('url must start with http(s):// or file://');
          if (a.tabId) {
            const t = await cdpFindTab(port, String(a.tabId));
            await cdpSend(t.webSocketDebuggerUrl, 'Page.navigate', { url: String(a.url) });
            return ok({ tabId: t.id, url: a.url });
          }
          const created = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(String(a.url))}`, { method: 'PUT' }).then(r => r.json());
          return ok({ tabId: created.id, url: created.url });
        } catch (e) { return fail(e.message, 'Run browser_debug_launch first.'); }
      },
    },
    {
      name: 'browser_tab_read', description: 'Read a tab title + visible text (first ~6000 chars).',
      args: { tabId: 'tab id prefix (opt, else first tab)', port: 'CDP port (opt)' },
      async run(a) {
        try {
          const port = Number(a.port || 9222);
          const t = a.tabId ? await cdpFindTab(port, String(a.tabId)) : (await cdpTabs(port))[0];
          if (!t) return fail('no tabs open');
          const r = await cdpSend(t.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: `document.title + "\\n---\\n" + document.documentElement.innerText`, returnByValue: true });
          const text = String(r?.result?.value ?? '').slice(0, 6000);
          return ok({ tabId: t.id, url: t.url, text });
        } catch (e) { return fail(e.message, 'Run browser_debug_launch first.'); }
      },
    },
    {
      name: 'browser_click', description: 'Click at viewport x,y in a tab. INPUT-INJECTING: needs approval.',
      args: { tabId: 'tab id prefix', x: 'number', y: 'number', port: 'CDP port (opt)' },
      async run(a) {
        try {
          const t = await cdpFindTab(Number(a.port || 9222), String(a.tabId));
          const p = { x: Number(a.x), y: Number(a.y), button: 'left', clickCount: 1 };
          await cdpSend(t.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', { ...p, type: 'mousePressed' });
          await cdpSend(t.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', { ...p, type: 'mouseReleased' });
          return ok({ tabId: t.id, x: p.x, y: p.y });
        } catch (e) { return fail(e.message, 'Use browser_tabs to get tabId; coords are page viewport pixels.'); }
      },
    },
    {
      name: 'browser_fill', description: 'Fill an input (CSS selector) with text, optionally submitting. INPUT-INJECTING: needs approval.',
      args: { tabId: 'tab id prefix', selector: 'CSS selector', text: 'text', submit: 'true to submit form/press Enter (opt)', port: 'CDP port (opt)' },
      async run(a) {
        try {
          const t = await cdpFindTab(Number(a.port || 9222), String(a.tabId));
          const sel = JSON.stringify(String(a.selector));
          const txt = JSON.stringify(String(a.text ?? ''));
          const expr = `(function(){var el=document.querySelector(${sel});if(!el)return 'NOT-FOUND';el.focus();el.value=${txt};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));${String(a.submit) === 'true' ? `if(el.form){el.form.submit()}else{el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true}))}` : ''}return 'OK:'+el.tagName})()`;
          const r = await cdpSend(t.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: expr, returnByValue: true });
          const v = String(r?.result?.value ?? '');
          if (v === 'NOT-FOUND') return fail(`selector not found: ${a.selector}`, 'Read the tab first to learn its structure.');
          return ok({ tabId: t.id, result: v });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'browser_screenshot', description: 'Capture a tab to PNG file.',
      args: { tabId: 'tab id prefix (opt)', outPath: 'absolute png path (opt)', port: 'CDP port (opt)' },
      async run(a, ctx) {
        try {
          const port = Number(a.port || 9222);
          const t = a.tabId ? await cdpFindTab(port, String(a.tabId)) : (await cdpTabs(port))[0];
          if (!t) return fail('no tabs open');
          const r = await cdpSend(t.webSocketDebuggerUrl, 'Page.captureScreenshot', { format: 'png' });
          const out = a.outPath || path.join(os.homedir(), 'Documents', `tab-${Date.now()}.png`);
          const chk = isPathAllowed(ctx.cfg, out); if (!chk.ok) return fail(chk.reason);
          await fsp.mkdir(path.dirname(out), { recursive: true });
          await fsp.writeFile(out, Buffer.from(String(r.data), 'base64'));
          return ok({ tabId: t.id, url: t.url, path: out });
        } catch (e) { return fail(e.message, 'Run browser_debug_launch first.'); }
      },
    },
    // ---------- C. Deep system ----------
    {
      name: 'reg_write', description: 'Write a registry value (creates key). Types: String, DWord, QWord, ExpandString. DESTRUCTIVE: needs approval.',
      args: { key: 'e.g. HKCU:\\Software\\WinAgentTest', name: 'value name', value: 'string|number', type: 'String|DWord|QWord|ExpandString (opt)' },
      async run(a) {
        try {
          if (!a.key || !a.name) return fail('key and name are required');
          const type = String(a.type || 'String');
          const isNum = /^(DWord|QWord)$/i.test(type);
          const val = isNum ? Number(a.value) : `'${String(a.value ?? '').replace(/'/g, "''")}'`;
          await ps(`New-Item -Path '${String(a.key).replace(/'/g, "''")}' -Force | Out-Null; New-ItemProperty -Path '${String(a.key).replace(/'/g, "''")}' -Name '${String(a.name).replace(/'/g, "''")}' -Value ${val} -PropertyType ${type} -Force | Out-Null; 'written'`);
          return ok({ key: a.key, name: a.name, type });
        } catch (e) { return fail(e.message, 'HKCU: is safe to test; HKLM: needs admin.'); }
      },
    },
    {
      name: 'service_control', description: 'Start/stop/restart a Windows service. DESTRUCTIVE: needs approval (may need admin).',
      args: { name: 'service name', action: 'start|stop|restart' },
      async run(a) {
        try {
          const act = { start: 'Start-Service', stop: 'Stop-Service', restart: 'Restart-Service' }[String(a.action).toLowerCase()];
          if (!act) return fail('action must be start|stop|restart');
          await ps(`${act} -Name '${String(a.name).replace(/'/g, "''")}' -ErrorAction Stop; (Get-Service -Name '${String(a.name).replace(/'/g, "''")}').Status.ToString()`);
          const { stdout } = await ps(`(Get-Service -Name '${String(a.name).replace(/'/g, "''")}').Status.ToString()`);
          return ok({ name: a.name, action: a.action, status: stdout });
        } catch (e) { return fail(e.message, 'Some services need admin; run terminal as Administrator.'); }
      },
    },
    {
      name: 'eventlog_recent', description: 'Recent Windows event log entries (time, id, level, provider, message).',
      args: { log: 'System|Application|Security (opt)', max: 'count, default 20 (opt)', level: 'Error|Warning|Information (opt)' },
      async run(a) {
        try {
          const log = String(a.log || 'System'), max = Math.min(Number(a.max || 20), 100);
          const { stdout } = await ps(`Get-WinEvent -LogName '${log}' -MaxEvents ${max} | Select-Object TimeCreated, Id, LevelDisplayName, ProviderName, @{n='Message';e={$_.Message}} | ConvertTo-Json -Compress -Depth 3`);
          let arr = JSON.parse(stdout || '[]');
          if (!Array.isArray(arr)) arr = [arr];
          if (a.level) arr = arr.filter(e => String(e.LevelDisplayName).toLowerCase() === String(a.level).toLowerCase());
          arr.forEach(e => { if (e.Message) e.Message = String(e.Message).slice(0, 500); });
          return ok({ log, entries: arr });
        } catch (e) { return fail(e.message, 'Security log needs admin. Try System or Application.'); }
      },
    },
    {
      name: 'startup_list', description: 'Autorun entries: Run registry keys + Startup folders.',
      args: {},
      async run() {
        try {
          const { stdout } = await ps(`$o=@(); foreach($k in 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'){ $p=Get-ItemProperty -Path $k -ErrorAction SilentlyContinue; if($p){ $p.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { $o+=@{'scope'=$k;'name'=$_.Name;'command'=[string]$_.Value} } } }; $o | ConvertTo-Json -Compress`);
          let reg = [];
          try { reg = JSON.parse(stdout || '[]'); if (!Array.isArray(reg)) reg = [reg]; } catch {}
          const folders = [];
          for (const d of [path.join(os.homedir(), 'AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup'), 'C:/ProgramData/Microsoft/Windows/Start Menu/Programs/Startup']) {
            try { folders.push({ dir: d, files: (await fsp.readdir(d)).slice(0, 50) }); }
            catch { folders.push({ dir: d, files: [] }); }
          }
          return ok({ registry: reg, folders });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'wifi_list', description: 'Visible WiFi networks + saved profiles (names only, no passwords).',
      args: {},
      async run() {
        let nets = '(unavailable)', profiles = '(unavailable)';
        try { nets = (await execFileAsync('netsh.exe', ['wlan', 'show', 'networks'], { windowsHide: true })).stdout.slice(0, 4000); } catch (e) { nets = `scan failed: ${e.message}`; }
        try { profiles = (await execFileAsync('netsh.exe', ['wlan', 'show', 'profiles'], { windowsHide: true })).stdout.slice(0, 4000); } catch (e) { profiles = `profiles failed: ${e.message}`; }
        return ok({ networks: nets, profiles });
      },
    },
    {
      name: 'installed_apps', description: 'Installed programs from registry (name, version, publisher). Optional filter.',
      args: { filter: 'substring (opt)' },
      async run(a) {
        try {
          const { stdout } = await ps(`$ks='HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Get-ItemProperty $ks -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion, Publisher | ConvertTo-Json -Compress -Depth 2`);
          let arr = JSON.parse(stdout || '[]');
          if (!Array.isArray(arr)) arr = [arr];
          const seen = new Set(), out = [];
          for (const x of arr) {
            if (seen.has(x.DisplayName)) continue;
            seen.add(x.DisplayName);
            out.push({ name: x.DisplayName, version: x.DisplayVersion || '', publisher: x.Publisher || '' });
          }
          const f = String(a.filter || '').toLowerCase();
          const rows = (f ? out.filter(x => (x.name + x.publisher).toLowerCase().includes(f)) : out).slice(0, 200);
          return ok({ count: rows.length, apps: rows });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'disk_info', description: 'Drives with total/free space GB.',
      args: {},
      async run() {
        try {
          const { stdout } = await ps(`Get-PSDrive -PSProvider FileSystem | Select-Object Name, Root, @{n='UsedGB';e={[math]::Round($_.Used/1GB,1)}}, @{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}} | ConvertTo-Json -Compress`);
          let arr = JSON.parse(stdout || '[]');
          if (!Array.isArray(arr)) arr = [arr];
          return ok({ drives: arr });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'web_fetch', description: 'GET a URL, return status + text (first ~8000 chars). For downloads use outFile.',
      args: { url: 'https://...', outFile: 'absolute path to save download (opt)', maxChars: 'truncate (opt)' },
      async run(a, ctx) {
        try {
          const res = await fetch(String(a.url));
          if (a.outFile) {
            const chk = isPathAllowed(ctx.cfg, a.outFile); if (!chk.ok) return fail(chk.reason);
            await fsp.mkdir(path.dirname(a.outFile), { recursive: true });
            const buf = Buffer.from(await res.arrayBuffer());
            await fsp.writeFile(a.outFile, buf);
            return ok({ url: a.url, status: res.status, saved: a.outFile, bytes: buf.length });
          }
          const text = (await res.text()).slice(0, Number(a.maxChars || 8000));
          return ok({ url: a.url, status: res.status, content: text });
        } catch (e) { return fail(e.message, 'Check the URL and internet access.'); }
      },
    },
    {
      name: 'web_post', description: 'HTTP POST/PUT/PATCH with JSON body + optional Bearer/Basic auth. For WordPress REST etc. Audited.',
      args: { url: 'https://...', method: 'POST|PUT|PATCH (opt)', body: 'object (opt)', auth: 'Bearer TOKEN or Basic BASE64 (opt)' },
      async run(a) {
        try {
          const headers = { 'Content-Type': 'application/json' };
          if (a.auth) headers.Authorization = String(a.auth).startsWith('Bearer ') || String(a.auth).startsWith('Basic ') ? String(a.auth) : `Bearer ${a.auth}`;
          const res = await fetch(String(a.url), { method: String(a.method || 'POST').toUpperCase(), headers, body: JSON.stringify(a.body ?? {}) });
          const text = (await res.text()).slice(0, 8000);
          let json = null;
          try { json = JSON.parse(text); } catch {}
          return ok({ url: a.url, status: res.status, body: json ?? text });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'screen_drag', description: 'Drag mouse from x1,y1 to x2,y2 (left button). For drag-and-drop, sliders, selections. INPUT-INJECTING.',
      args: { x1: 'number', y1: 'number', x2: 'number', y2: 'number', steps: 'move steps, default 10 (opt)' },
      async run(a) {
        try {
          const nums = [a.x1, a.y1, a.x2, a.y2].map(Number);
          if (nums.some(n => !Number.isFinite(n))) return fail('x1,y1,x2,y2 must be numbers (use screen_size first)');
          const steps = Math.min(Math.max(Number(a.steps || 10), 2), 50);
          const code = `Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WinDrag {
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
 [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
}
'@
[WinDrag]::SetCursorPos(${nums[0]}, ${nums[1]})
Start-Sleep -Milliseconds 150
[WinDrag]::mouse_event(2,0,0,0,0)
$dx = (${nums[2]} - ${nums[0]}) / ${steps}; $dy = (${nums[3]} - ${nums[1]}) / ${steps}
for ($i = 1; $i -le ${steps}; $i++) { [WinDrag]::SetCursorPos([int](${nums[0]} + $dx * $i), [int](${nums[1]} + $dy * $i)); Start-Sleep -Milliseconds 25 }
[WinDrag]::mouse_event(4,0,0,0,0)
'dragged'`;
          const { stdout } = await ps(code);
          return ok({ from: nums.slice(0, 2), to: nums.slice(2), result: stdout });
        } catch (e) { return fail(e.message, 'Drag needs an interactive desktop session.'); }
      },
    },
    {
      name: 'key_tap', description: 'Press a special key with optional modifiers (no text typing; use key_press for text). Examples: Enter, Tab, Esc, F5, Ctrl+S, Alt+Tab. INPUT-INJECTING.',
      args: { key: 'Enter|Tab|Esc|Backspace|Delete|Up|Down|Left|Right|Home|End|PgUp|PgDn|F1..F12|Space|A..Z|0..9', modifiers: 'comma combo e.g. Ctrl,Shift (opt)' },
      async run(a) {
        try {
          const named = { enter: '{ENTER}', tab: '{TAB}', esc: '{ESC}', backspace: '{BACKSPACE}', delete: '{DELETE}', up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}', home: '{HOME}', end: '{END}', pgup: '{PGUP}', pgdn: '{PGDN}', space: ' ' };
          let k = String(a.key || '').trim();
          const low = k.toLowerCase();
          let code;
          if (/^f\d{1,2}$/i.test(k)) code = '{' + k.toUpperCase() + '}';
          else if (named[low]) code = named[low];
          else if (/^[a-z0-9]$/i.test(k)) code = k.toLowerCase();
          else return fail(`unknown key: ${k}`, 'Use Enter/Tab/Esc/F1-F12/Space/single letters.');
          let mod = '';
          for (const m of String(a.modifiers || '').toLowerCase().split(',')) {
            if (m.includes('ctrl')) mod += '^';
            else if (m.includes('alt')) mod += '%';
            else if (m.includes('shift')) mod += '+';
          }
          await ps(`(New-Object -ComObject WScript.Shell).SendKeys('${mod}${code}')`);
          return ok({ key: k, modifiers: a.modifiers || '' });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'window_manage', description: 'Focus/minimize/maximize/restore/close a window by pid or title substring. Close is DESTRUCTIVE.',
      args: { action: 'focus|minimize|maximize|restore|close', pid: 'number (opt)', title: 'substring (opt)' },
      async run(a) {
        try {
          const act = String(a.action || '').toLowerCase();
          if (!['focus', 'minimize', 'maximize', 'restore', 'close'].includes(act)) return fail('action must be focus|minimize|maximize|restore|close');
          if (!a.pid && !a.title) return fail('provide pid or title (see window_list)');
          const find = a.pid ? `Get-Process -Id ${Number(a.pid)} -ErrorAction Stop` : `$x = Get-Process | Where-Object { $_.MainWindowTitle -like '*${String(a.title).replace(/'/g, "''")}*' } | Select-Object -First 1; if (-not $x) { throw 'no window matching title' }; $x`;
          if (act === 'close') {
            await ps(`(${find}).CloseMainWindow() | Out-Null; 'close-sent'`);
            return ok({ action: act, closed: a.pid || a.title });
          }
          const flag = act === 'minimize' ? 6 : act === 'maximize' ? 3 : act === 'restore' ? 9 : null;
          const code = `Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WinMg {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
'@
$p = ${find}
if ($p.MainWindowHandle -eq 0) { throw 'window has no handle (headless process)' }
${flag === null ? '[WinMg]::SetForegroundWindow($p.MainWindowHandle); $p.MainWindowTitle' : `[WinMg]::ShowWindowAsync($p.MainWindowHandle, ${flag}); 'ok'`}`;
          const { stdout } = await ps(code);
          return ok({ action: act, result: stdout.slice(0, 300) });
        } catch (e) { return fail(e.message, 'Run window_list first for exact pid/title.'); }
      },
    },
    {
      name: 'clipboard_write', description: 'Set Windows clipboard text (escaping handled). Pair with key_tap Ctrl+V to paste anywhere.',
      args: { text: 'text to put on clipboard' },
      async run(a) {
        try {
          const t = String(a.text ?? '').slice(0, 20000).replace(/'/g, "''");
          await ps(`Set-Clipboard -Value '${t}'`);
          return ok({ chars: String(a.text ?? '').length });
        } catch (e) { return fail(e.message); }
      },
    },
  ];
}
