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

function appCommand(name) {
  const target = ROUTER_APPS[clean(name).toLowerCase()];
  if (!target || target.startsWith('uri:')) return null;
  return target;
}

export function offlinePlan(text, cfg = {}) {
  const t = clean(text);
  if (!t) return null;

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
  return 'Offline mode handles explicit local tasks without an AI model: open/launch apps and folders, list/read/search/create/copy/move/delete files, system info, processes, windows, and screenshots. Configure an optional model for open-ended planning.';
}
