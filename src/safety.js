// Safety gate: path allow/block lists, destructive-op approval, audit log.
// Zero dependencies. Windows-aware (case-insensitive prefix match).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const DESTRUCTIVE = new Set(['file_write', 'file_edit', 'file_delete', 'file_move', 'file_copy', 'app_kill', 'shell_exec', 'screen_click', 'screen_double_click', 'screen_drag', 'mouse_move', 'screen_scroll', 'key_press', 'key_tap', 'window_manage', 'browser_navigate', 'browser_click', 'browser_fill', 'reg_write', 'service_control']);

function norm(p) {
  try { return path.resolve(p).toLowerCase(); } catch { return String(p).toLowerCase(); }
}

export function isPathAllowed(cfg, p) {
  const n = norm(p);
  for (const b of (cfg.blockedPaths || [])) {
    if (n === norm(b) || n.startsWith(norm(b) + path.sep)) return { ok: false, reason: `blocked path prefix: ${b}` };
  }
  const roots = (cfg.allowedRoots || []).filter(Boolean);
  if (!roots.length) return { ok: true };
  for (const r of roots) {
    if (n === norm(r) || n.startsWith(norm(r) + path.sep)) return { ok: true };
  }
  return { ok: false, reason: `outside ALLOWED_ROOTS (${roots.join(', ')})` };
}

export function needsApproval(cfg, toolName) {
  if (cfg.autoYes) return false;
  if (!cfg.requireApproval) return false;
  return DESTRUCTIVE.has(toolName);
}

export function audit(cfg, entry) {
  try {
    const line = `[${new Date().toISOString()}] ${entry}\n`;
    const logPath = path.isAbsolute(cfg.auditLog) ? cfg.auditLog : path.join(cfg.root, cfg.auditLog);
    fs.appendFileSync(logPath, line, 'utf8');
  } catch { /* audit must never crash the agent */ }
}

export async function askYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = await new Promise((res) => rl.question(`${question} [y/N] `, res));
    return /^y(es)?$/i.test(ans.trim());
  } finally { rl.close(); }
}

// ---- Computer-Use style per-app approvals (always-allow list) ----
export function needsAppApproval(cfg, toolName, args) {
  if (cfg.autoYes) return null;
  const explicit = cfg.requireAppApproval;
  const on = (explicit === undefined || explicit === '' || explicit === null)
    ? !!cfg.requireApproval
    : !(explicit === false || String(explicit) === 'false' || String(explicit) === '0');
  if (!on) return null;
  let app = null;
  if (toolName === 'app_launch') app = String((args && args.command) || '').split(/[/\\]/).pop() || 'unknown app';
  else if (toolName === 'app_open') app = 'default handler for ' + String((args && args.target) || '').slice(0, 80);
  else if (toolName === 'browser_debug_launch') app = ((args && args.browser) === 'edge' ? 'msedge' : 'chrome') + ' (debug profile)';
  else return null;
  const low = app.toLowerCase();
  for (const a of (cfg.allowedApps || [])) {
    if (a && low.includes(String(a).toLowerCase())) return null;
  }
  if (cfg._appGrants && cfg._appGrants.has(app)) return null;
  return app;
}

export async function askAppApproval(app) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = await new Promise((res) => rl.question(`Allow agent to control app "${app}"? [y=once / a=always / N] `, res));
    const t = ans.trim().toLowerCase();
    if (t === 'a' || t === 'always') return 'always';
    if (t === 'y' || t === 'yes' || t === 'once') return 'once';
    return null;
  } finally { rl.close(); }
}

// ---- Web-dashboard approval bridge: when cfg.approvalHandler is set
// (dashboard), approvals resolve there ('once'|'always'|false).
// Otherwise the terminal prompts above are used.
export async function requestApproval(cfg, label) {
  if (cfg && typeof cfg.approvalHandler === 'function') {
    const r = await cfg.approvalHandler(label);
    return r ? 'once' : null;
  }
  return (await askYesNo(label)) ? 'once' : null;
}

export async function requestAppApproval(cfg, app) {
  if (cfg && typeof cfg.approvalHandler === 'function') {
    const r = await cfg.approvalHandler(`APP ${app}`);
    if (r === 'always' || r === 'once') return r;
    return null;
  }
  return askAppApproval(app);
}
