// Windows file + app tools. All functions are async and return JSON-safe values.
// Every entry: { name, description, args, run(args, ctx) }
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import { isPathAllowed } from './safety.js';
import { linuxTool } from './tools-linux.js';

const execFileAsync = promisify(execFile);

function ok(data) { return { ok: true, ...data }; }
function fail(error, hint) { return { ok: false, error: String(error), hint }; }

async function ps(command, timeout = 20000) {
  // Single choke point for PowerShell so audit + allowlist stay in one place.
  const { stdout, stderr } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

// ---------- HTML -> readable text (zero-dep) ----------
function textOf(html) {
  let t = String(html || '');
  t = t.replace(new RegExp('<script' + '[^]*?</' + 'script>', 'gi'), ' ');
  t = t.replace(new RegExp('<style' + '[^]*?</' + 'style>', 'gi'), ' ');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/&(nbsp|amp|quot|lt|gt|#39);/g, (m, e) => ({ nbsp: ' ', amp: '&', quot: '"', lt: '<', gt: '>', '#39': "'" }[e] || ' '));
  t = t.replace(/&#([0-9]+);/g, (m, d) => { try { return String.fromCharCode(Number(d)); } catch { return ' '; } });
  return t.replace(/\s+/g, ' ').trim();
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

// Rollback safety: snapshot a file before overwriting (Manus/Cowork gap:
// "none of them ship a real undo button" — we ship one). Opt out with
// NO_BACKUP=true. Backups live next to the file: <name>.bak-YYYYMMDD-HHMMSS
async function backupIfExists(p) {
  try {
    if (String(process.env.NO_BACKUP || '') === 'true') return null;
    await fsp.access(p);
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const bak = p + '.bak-' + stamp;
    await fsp.copyFile(p, bak);
    return bak;
  } catch { return null; }
}

export function buildTools() {
  const tools = [
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
      name: 'file_write', description: 'Create/overwrite text file. Creates parent dirs. Auto-backs-up existing file (.bak-TIMESTAMP). DESTRUCTIVE.',
      args: { path: 'absolute file path', content: 'full text' },
      async run(a, ctx) {
        try {
          const chk = isPathAllowed(ctx.cfg, a.path); if (!chk.ok) return fail(chk.reason);
          await fsp.mkdir(path.dirname(a.path), { recursive: true });
          const bak = await backupIfExists(a.path);
          await fsp.writeFile(a.path, String(a.content ?? ''), 'utf8');
          return ok({ path: a.path, bytes: Buffer.byteLength(String(a.content ?? '')), backup: bak });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'file_edit', description: 'Replace first occurrence of oldString with newString. Auto-backs-up (.bak-TIMESTAMP). DESTRUCTIVE.',
      args: { path: 'absolute file path', oldString: 'literal to find', newString: 'replacement' },
      async run(a, ctx) {
        try {
          const chk = isPathAllowed(ctx.cfg, a.path); if (!chk.ok) return fail(chk.reason);
          const text = await fsp.readFile(a.path, 'utf8');
          if (!text.includes(a.oldString)) return fail('oldString not found');
          const bak = await backupIfExists(a.path);
          await fsp.writeFile(a.path, text.replace(a.oldString, String(a.newString ?? '')), 'utf8');
          return ok({ path: a.path, backup: bak });
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
    {
      name: 'file_fetch', description: 'Fetch ANY file into a temp copy — even locked/in-use files (robocopy backup mode). Returns temp path. For live DBs, browser stores, open docs.',
      args: { path: 'absolute source path', outName: 'temp filename (opt)' },
      async run(a, ctx) {
        try {
          const src = String(a.path || '');
          const chk = isPathAllowed(ctx.cfg, src); if (!chk.ok) return fail(chk.reason);
          const base = src.split(/[/\\]/).pop() || 'file';
          const out = path.join(os.tmpdir(), String(a.outName || `fetch-${Date.now()}-${base}`));
          try { await fsp.copyFile(src, out); return ok({ path: src, fetched: out, method: 'copy' }); }
          catch (e1) {
            try { await execFileAsync('robocopy.exe', [path.dirname(src), os.tmpdir(), base, '/B', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS'], { windowsHide: true }); } catch {}
            try { await fsp.rename(path.join(os.tmpdir(), base), out); return ok({ path: src, fetched: out, method: 'robocopy-backup' }); }
            catch (e2) { return fail(`locked and backup-copy failed: ${e1.message}`, 'Close the app holding the file, or run elevated for VSS fallback.'); }
          }
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'screen_scroll', description: 'Scroll wheel at x,y pixels. Direction up|down|left|right, amount in notches (default 3). INPUT-INJECTING.',
      args: { x: 'number', y: 'number', direction: 'up|down|left|right (opt)', amount: 'notches, default 3 (opt)' },
      async run(a) {
        try {
          const x = Number(a.x), y = Number(a.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('x and y must be numbers');
          const dir = String(a.direction || 'down').toLowerCase();
          const n = Math.min(Math.max(Number(a.amount || 3), 1), 20);
          const vert = dir === 'up' ? 120 : dir === 'down' ? -120 : 0;
          const horiz = dir === 'right' ? 120 : dir === 'left' ? -120 : 0;
          if (!vert && !horiz) return fail('direction must be up|down|left|right');
          const code = `Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WinWheel {
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
 [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
}
'@
[WinWheel]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 200
for ($i = 0; $i -lt ${n}; $i++) {
  [WinWheel]::mouse_event(2048, 0, 0, ${vert}, 0)
  [WinWheel]::mouse_event(4096, 0, 0, ${horiz}, 0)
  Start-Sleep -Milliseconds 120
}
'scrolled'`;
          const { stdout } = await ps(code);
          return ok({ x, y, direction: dir, amount: n, result: stdout });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'mouse_move', description: 'Move cursor to x,y pixels WITHOUT clicking (hover menus, tooltips). INPUT-INJECTING.',
      args: { x: 'number', y: 'number' },
      async run(a) {
        try {
          const x = Number(a.x), y = Number(a.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('x and y must be numbers');
          await ps(`Add-Type -AssemblyName System.Windows.Forms; Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WinMove { [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); }
'@; [WinMove]::SetCursorPos(${x}, ${y}); 'moved'`);
          return ok({ x, y });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'screen_double_click', description: 'Double-click at x,y pixels. INPUT-INJECTING.',
      args: { x: 'number', y: 'number' },
      async run(a) {
        try {
          const x = Number(a.x), y = Number(a.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('x and y must be numbers');
          await ps(`Add-Type -AssemblyName System.Windows.Forms; Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WinDbl { [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo); }
'@; [WinDbl]::SetCursorPos(${x}, ${y}); Start-Sleep -Milliseconds 150; [WinDbl]::mouse_event(2,0,0,0,0); Start-Sleep -Milliseconds 60; [WinDbl]::mouse_event(4,0,0,0,0); Start-Sleep -Milliseconds 80; [WinDbl]::mouse_event(2,0,0,0,0); Start-Sleep -Milliseconds 60; [WinDbl]::mouse_event(4,0,0,0,0); 'double-clicked'`);
          return ok({ x, y });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'wait', description: 'Wait N seconds (loaders, saves, installs), then continue. Max 120s. Always re-screenshot after waiting.',
      args: { seconds: 'number, default 3' },
      async run(a) {
        const s = Math.min(Math.max(Number(a.seconds || 3), 1), 120);
        await new Promise(r => setTimeout(r, s * 1000));
        return ok({ waitedSec: s });
      },
    },
    {
      name: 'memory_read', description: 'Read core memory (MEMORY.md + topic notes). Use at task start and before answering about past work.',
      args: { topic: 'topic file without .md (opt, else everything)' },
      async run(a, ctx) {
        try {
          const dir = path.join(ctx.cfg.root, 'memory');
          if (a.topic) {
            const key = String(a.topic).replace(/[^a-z0-9-_]/gi, '').slice(0, 40);
            const text = await fsp.readFile(path.join(dir, key + '.md'), 'utf8').catch(() => null);
            if (text === null) return fail(`no memory topic: ${key}`);
            return ok({ topic: key, content: text.slice(0, 6000) });
          }
          let out = '';
          try { out += await fsp.readFile(path.join(dir, 'MEMORY.md'), 'utf8'); } catch { out += '(no MEMORY.md yet)'; }
          let files = [];
          try { files = (await fsp.readdir(dir)).filter(f => f.endsWith('.md') && f !== 'MEMORY.md'); } catch {}
          return ok({ memory: out.slice(0, 8000), topics: files });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'memory_write', description: 'Write to core memory (persists across runs). Ongoing facts -> MEMORY.md; bigger subjects -> topic file.',
      args: { text: 'fact/note to remember (required)', topic: 'topic name for a separate note (opt)' },
      async run(a, ctx) {
        try {
          if (!String(a.text || '').trim()) return fail('text is required');
          const dir = path.join(ctx.cfg.root, 'memory');
          await fsp.mkdir(dir, { recursive: true });
          const line = `- [${new Date().toISOString().slice(0, 10)}] ${String(a.text).trim().slice(0, 1000)}\n`;
          if (a.topic) {
            const key = String(a.topic).replace(/[^a-z0-9-_]/gi, '').slice(0, 40) || 'note';
            await fsp.appendFile(path.join(dir, key + '.md'), `\n## ${key}\n${line}`, 'utf8');
            return ok({ saved: `memory/${key}.md` });
          }
          await fsp.appendFile(path.join(dir, 'MEMORY.md'), line, 'utf8');
          return ok({ saved: 'memory/MEMORY.md' });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'memory_forget', description: 'Delete one memory topic file, or one MEMORY.md line by number.',
      args: { topic: 'topic file without .md (opt)', line: '1-based line number in MEMORY.md (opt)' },
      async run(a, ctx) {
        try {
          const dir = path.join(ctx.cfg.root, 'memory');
          if (a.topic) {
            const key = String(a.topic).replace(/[^a-z0-9-_]/gi, '').slice(0, 40);
            await fsp.rm(path.join(dir, key + '.md'));
            return ok({ forgot: `memory/${key}.md` });
          }
          if (a.line) {
            const p = path.join(dir, 'MEMORY.md');
            const lines = (await fsp.readFile(p, 'utf8')).split('\n');
            const i = Number(a.line) - 1;
            if (i < 0 || i >= lines.length) return fail('line out of range');
            lines.splice(i, 1);
            await fsp.writeFile(p, lines.join('\n'), 'utf8');
            return ok({ forgotLine: Number(a.line) });
          }
          return fail('provide topic or line');
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'web_search', description: 'Search the web (no API key). Returns titles/urls/snippets for research before scraping.',
      args: { query: 'search terms (required)', max: 'results, default 6 (opt)' },
      async run(a) {
        try {
          if (!String(a.query || '').trim()) return fail('query is required');
          const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(String(a.query)), {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WinAgent/1.4' },
          });
          if (!res.ok) return fail(`search HTTP ${res.status}`, 'Retry once, then ask the user.');
          const html = await res.text();
          const linkRe = new RegExp('result__a[^>]*href="([^"]*)"[^>]*>([^]*?)</' + 'a>', 'gi');
          const snipRe = new RegExp('result__snippet[^>]*>([^]*?)</' + 'div>', 'gi');
          const out = [];
          let m;
          while ((m = linkRe.exec(html)) !== null && out.length < Number(a.max || 6)) {
            let url = m[1];
            const ud = url.match(/[?&]uddg=([^&]+)/);
            if (ud) { try { url = decodeURIComponent(ud[1]); } catch {} }
            const title = textOf(m[2]).slice(0, 150);
            out.push({ title, url });
          }
          const snips = [];
          while ((m = snipRe.exec(html)) !== null && snips.length < out.length) snips.push(textOf(m[1]).slice(0, 250));
          out.forEach((r, i) => { if (snips[i]) r.snippet = snips[i]; });
          return ok({ query: a.query, results: out });
        } catch (e) { return fail(e.message, 'Check internet access and retry.'); }
      },
    },
    {
      name: 'web_scrape', description: 'Fetch pages as clean text (scripts/menus stripped). Follows same-site links up to maxPages. The research engine behind self-learning.',
      args: { url: 'start URL (required)', maxPages: 'same-site pages, default 1, max 5 (opt)', maxChars: 'total chars, default 15000 (opt)' },
      async run(a) {
        try {
          if (!String(a.url || '').trim()) return fail('url is required');
          const maxP = Math.min(Math.max(Number(a.maxPages || 1), 1), 5);
          const maxC = Math.min(Number(a.maxChars || 15000), 60000);
          const seen = new Set();
          const queue = [String(a.url)];
          const pages = [];
          let total = 0;
          const linkRe = new RegExp('<a[^>]*href="([^"#]+)"[^>]*>([^]*?)</' + 'a>', 'gi');
          while (queue.length && pages.length < maxP && total < maxC) {
            const u = queue.shift();
            if (seen.has(u)) continue;
            seen.add(u);
            let html;
            try {
              const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WinAgent/1.4' } });
              if (!res.ok) continue;
              html = await res.text();
            } catch { continue; }
            const title = textOf((html.match(new RegExp('<title[^>]*>([^]*?)</' + 'title>', 'i')) || ['', ''])[1]).slice(0, 150);
            const text = textOf(html).slice(0, maxC - total);
            total += text.length;
            pages.push({ url: u, title, text });
            if (pages.length < maxP) {
              let m;
              const base = new URL(u);
              while ((m = linkRe.exec(html)) !== null && queue.length < maxP + 2) {
                try {
                  const abs = new URL(m[1], base);
                  if (abs.hostname === base.hostname && (abs.protocol === 'http:' || abs.protocol === 'https:') && !seen.has(abs.href)) queue.push(abs.href);
                } catch {}
              }
            }
          }
          if (!pages.length) return fail('nothing fetchable at ' + a.url);
          return ok({ pages: pages.length, totalChars: total, content: pages });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'github_push', description: 'Commit + push the project to GitHub (the push-itself routine). Classifies auth failures with fixes.',
      args: { message: 'commit message (required)', branch: 'default main (opt)', remote: 'default origin (opt)' },
      async run(a, ctx) {
        try {
          const msg = String(a.message || '').trim();
          if (!msg) return fail('message is required');
          let git = null;
          try {
            const probe = process.platform === 'win32' ? 'where.exe' : 'which';
            git = (await execFileAsync(probe, ['git'], { windowsHide: true })).stdout.trim().split('\n')[0].trim();
          } catch {}
          if (!git && process.platform === 'win32') {
            for (const c of ['C:/Program Files/Git/cmd/git.exe', 'C:/Program Files (x86)/Git/cmd/git.exe']) {
              try { await fsp.access(c); git = c; break; } catch {}
            }
          }
          if (!git) return fail('git not found', 'Install git (winget install Git.Git), then retry.');
          const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
          const run = (args) => execFileAsync(git, args, { cwd: ctx.cfg.root, env, windowsHide: true, timeout: 120000 });
          await run(['add', '-A']);
          const st = await run(['status', '--porcelain']);
          let committed = false, hash = '';
          if (st.stdout.trim()) {
            await run(['commit', '-m', msg]);
            hash = (await run(['rev-parse', '--short', 'HEAD'])).stdout.trim();
            committed = true;
          } else {
            hash = (await run(['rev-parse', '--short', 'HEAD'])).stdout.trim();
          }
          const branch = a.branch || 'main', remote = a.remote || 'origin';
          try {
            const out = await run(['push', '-u', remote, branch]);
            return ok({ pushed: true, committed, hash, output: (out.stdout + out.stderr).slice(0, 500) });
          } catch (e) {
            const m2 = e.message || String(e);
            if (/not found|404/i.test(m2)) return fail('remote repo not found (missing or no access)', 'Owner adds you as collaborator, or check the URL. See skills/github.md.');
            if (/denied|403|permission/i.test(m2)) return fail('push denied: wrong identity or no write access', 'Check git credential fill; fix per skills/github.md.');
            return fail(m2.slice(0, 400));
          }
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'browser_dom', description: 'DOM snapshot of a CDP tab: buttons/links/inputs with index, tag, text, x/y/w/h. Default selector covers interactive elements; pass any CSS to narrow.',
      args: { port: 'debug port, default 9222 (opt)', tab: 'tab id prefix (required)', selector: 'CSS selector (opt)' },
      async run(a) {
        try {
          const t = await cdpFindTab(Number(a.port || 9222), String(a.tab));
          const q = String(a.selector || 'button,a,input,select,textarea,[role=button],[role=link]');
          const expr = `(function(){var els=[...document.querySelectorAll(${JSON.stringify(q)})].slice(0,50);return els.map(function(e,i){var r=e.getBoundingClientRect();return {i:i,tag:(e.tagName||'').toLowerCase(),text:((e.innerText||e.value||e.getAttribute('aria-label')||'')).replace(/\\s+/g,' ').slice(0,120),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};});})()`;
          const r = await cdpSend(t.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: expr, returnByValue: true });
          const els = (((r || {}).result || {}).value) || [];
          return ok({ tab: t.title, count: els.length, elements: els });
        } catch (e) { return fail(e.message, 'Launch a debug browser first (browser_debug_launch).'); }
      },
    },
    {
      name: 'browser_click_sel', description: 'Click a DOM element by CSS selector (synthetic click — no coordinates, cannot miss). INPUT-INJECTING.',
      args: { port: 'debug port, default 9222 (opt)', tab: 'tab id prefix (required)', selector: 'CSS selector (required)', index: 'match number, default 0 (opt)' },
      async run(a) {
        try {
          if (!String(a.selector || '').trim()) return fail('selector is required');
          const t = await cdpFindTab(Number(a.port || 9222), String(a.tab));
          const expr = `(function(){var els=[...document.querySelectorAll(${JSON.stringify(String(a.selector))})];var e=els[${Number(a.index || 0)}];if(!e)return 'not-found:'+els.length;try{e.scrollIntoView({block:'center'})}catch(_){};e.click();return 'clicked:'+(((e.innerText||e.value||e.tagName)||'').toString().slice(0,120));})()`;
          const r = await cdpSend(t.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: expr, returnByValue: true });
          const v = String((((r || {}).result || {}).value) ?? '');
          if (v.startsWith('not-found')) return fail(v, 'Run browser_dom first to get exact selectors.');
          return ok({ result: v });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'browser_fill_sel', description: 'Fill a form field by CSS selector (focus + value + input/change events, React-safe). INPUT-INJECTING.',
      args: { port: 'debug port, default 9222 (opt)', tab: 'tab id prefix (required)', selector: 'CSS selector (required)', value: 'text to enter (required)', submit: 'press Enter after (opt)' },
      async run(a) {
        try {
          if (!String(a.selector || '').trim()) return fail('selector is required');
          const t = await cdpFindTab(Number(a.port || 9222), String(a.tab));
          const expr = `(function(){var e=document.querySelectorAll(${JSON.stringify(String(a.selector))})[${Number(a.index || 0)}];if(!e)return 'not-found';e.focus();e.value=${JSON.stringify(String(a.value ?? ''))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return 'filled';})()`;
          const r = await cdpSend(t.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: expr, returnByValue: true });
          const v = String((((r || {}).result || {}).value) ?? '');
          if (v.startsWith('not-found')) return fail(v, 'Run browser_dom first to get exact selectors.');
          if (a.submit) {
            await cdpSend(t.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: `document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`, returnByValue: true });
          }
          return ok({ result: v, submit: !!a.submit });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'doc_pdf', description: 'Render a CDP tab to PDF (Page.printToPDF — zero dependencies). For reports, invoices, web receipts.',
      args: { port: 'debug port, default 9222 (opt)', tab: 'tab id prefix (required)', out: 'absolute .pdf path (required)', landscape: 'true/false (opt)' },
      async run(a) {
        try {
          if (!String(a.out || '').trim()) return fail('out path is required');
          const t = await cdpFindTab(Number(a.port || 9222), String(a.tab));
          const r = await cdpSend(t.webSocketDebuggerUrl, 'Page.printToPDF', {
            landscape: !!a.landscape, printBackground: true,
            paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.4, marginBottom: 0.4, marginLeft: 0.4, marginRight: 0.4,
          }, 60000);
          const b64 = (r && r.data) || '';
          if (!b64) return fail('empty PDF from browser', 'Reload the tab and retry.');
          await fsp.mkdir(path.dirname(a.out), { recursive: true });
          await fsp.writeFile(a.out, Buffer.from(b64, 'base64'));
          return ok({ path: a.out, bytes: Buffer.byteLength(b64, 'base64') });
        } catch (e) { return fail(e.message, 'Launch a debug browser first (browser_debug_launch).'); }
      },
    },
    {
      name: 'office_run', description: 'Drive installed MS Office via COM (Word/Excel/PowerPoint): create, fill, save, export PDF. Runs hidden. DESTRUCTIVE — needs approval.',
      args: { app: 'word|excel|powerpoint (required)', script: 'PowerShell using $app, e.g. $d=$app.Documents.Add(); ...; $d.SaveAs("C:/x.docx") (required)', task: 'one-line description for audit (opt)' },
      async run(a, ctx) {
        try {
          const app = String(a.app || '').toLowerCase();
          const prog = { word: 'Word.Application', excel: 'Excel.Application', powerpoint: 'PowerPoint.Application' }[app];
          if (!prog) return fail('app must be word|excel|powerpoint');
          if (!String(a.script || '').trim()) return fail('script is required (see skills/office-docs.md for patterns)');
          const code = `$ErrorActionPreference='Stop'; $prog='${prog}'; try { $app=New-Object -ComObject $prog } catch { throw 'Office ${app} not available ('+$_.Exception.Message+'). Install Microsoft 365/Office, or use the python stack (see skills/office-docs.md).' }; try { try { $app.Visible=$false } catch {}; try { $app.DisplayAlerts=0 } catch {}; ${String(a.script)}; 'office-ok' } finally { try { $app.Quit() } catch {}; try { [Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null } catch {}; [GC]::Collect(); [GC]::WaitForPendingFinalizers() }`;
          const { stdout } = await ps(code, 120000);
          return ok({ app, result: stdout.slice(0, 4000) });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'task_delegate', description: 'Run a subtask in a FRESH agent loop (own history, capped steps) and return its final answer. Fan out complex goals piece by piece. Max depth 2.',
      args: { task: 'subtask text (required)', maxSteps: 'step cap, default 5, max 10 (opt)' },
      async run(a, ctx) {
        try {
          const sub = (ctx.cfg || {}).runSubtask;
          if (typeof sub !== 'function') return fail('delegation unavailable in this runtime');
          if (!String(a.task || '').trim()) return fail('task is required');
          const ans = await sub(String(a.task), Math.min(Number(a.maxSteps || 5), 10));
          return ok({ answer: String(ans).slice(0, 6000) });
        } catch (e) { return fail(e.message); }
      },
    },
    {
      name: 'skill_load', description: 'Load a skill playbook into context mid-task by name (no .md needed). Call the moment the catalog says one fits — no need to guess contents.',
      args: { name: 'skill name, e.g. computer-use (required)' },
      async run(a, ctx) {
        try {
          const safe = path.basename(String(a.name || '').trim().replace(/\.md$/, ''));
          if (!safe) return fail('name is required');
          const cfg = (ctx && ctx.cfg) || {};
          const mode = String(cfg.skillSource || 'auto').toLowerCase();
          if (mode !== 'local') {
            try {
              const repo = cfg.skillRepo || 'ACHUTHAN17/windows-system-agent';
              const branch = cfg.skillBranch || 'main';
              const headers = { 'User-Agent': 'WinAgent/1.6' };
              if (cfg.skillToken) headers.Authorization = `Bearer ${cfg.skillToken}`;
              const res = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/skills/${safe}.md`, { headers, signal: AbortSignal.timeout(10000) });
              if (res.ok) {
                const text = (await res.text()).slice(0, 8000);
                if (text.trim()) return ok({ name: safe, source: 'github', content: text });
              }
            } catch {}
            if (mode === 'github') return fail('remote unreachable (offline or bad token?)');
          }
          const text = await fsp.readFile(path.join(cfg.root || '.', 'skills', safe + '.md'), 'utf8').catch(() => null);
          if (text === null) return fail(`no such skill: ${safe}`);
          return ok({ name: safe, source: 'local', content: text.slice(0, 8000) });
        } catch (e) { return fail(e.message); }
      },
    },
  ];
  // Linux/macOS override layer: routes each call through tools-linux.js first.
  // On Windows it always falls through, so Windows behavior is unchanged.
  return tools.map(t => ({
    ...t,
    run: async (a, c) => {
      try {
        const ov = await linuxTool(t.name, a, c);
        if (ov && ov.handled) return ov.result;
      } catch (e) {
        return { ok: false, error: 'linux layer: ' + (e.message || String(e)) };
      }
      return t.run(a, c);
    },
  }));
}
