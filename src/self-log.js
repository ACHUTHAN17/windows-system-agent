// Self-awareness log: one line per learning/self-improvement event, written
// by skill-crawler.js, tool-crawler.js, tool-web-scout.js, tools.js's
// tool_create, and model-scout.js. Lands in memory/SELF.md, which
// src/index.js's loadMemory() already injects into every system prompt
// (same mechanism as MEMORY.md and any other memory/*.md file) — so the
// agent sees what it has learned/built for itself on every run, with zero
// extra prompt plumbing. Capped to the most recent 60 entries so it stays
// well under loadMemory()'s 3000-char per-file slice.
import fs from 'node:fs';
import path from 'node:path';

export function logSelf(root, line) {
  try {
    const dir = path.join(root, 'memory');
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, 'SELF.md');
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    let existing = '';
    try { existing = fs.readFileSync(p, 'utf8'); } catch {}
    const lines = existing.split('\n').filter(l => l.startsWith('- ['));
    lines.push(`- [${stamp}] ${String(line).slice(0, 300)}`);
    const trimmed = lines.slice(-60);
    fs.writeFileSync(p,
      '# SELF.md — what I have learned / built for myself (auto-maintained, do not hand-edit)\n\n' +
      trimmed.join('\n') + '\n', 'utf8');
  } catch { /* self-log must never break the caller */ }
}
