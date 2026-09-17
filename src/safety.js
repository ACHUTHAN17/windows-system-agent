// Safety gate: path allow/block lists, destructive-op approval, audit log.
// Zero dependencies. Windows-aware (case-insensitive prefix match).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const DESTRUCTIVE = new Set(['file_write', 'file_edit', 'file_delete', 'file_move', 'file_copy', 'app_kill', 'shell_exec', 'screen_click', 'screen_drag', 'key_press', 'key_tap', 'window_manage', 'browser_navigate', 'browser_click', 'browser_fill', 'reg_write', 'service_control']);

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
