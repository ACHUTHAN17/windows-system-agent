'use strict';
// Turns the agent's stdout into structured events. Pure functions, no Electron,
// so they are unit-tested with plain `node --test`.

const ANSWER_BEGIN = '@@WINAGENT_ANSWER@@';
const ANSWER_END = '@@WINAGENT_END@@';

// Approval prompts printed by src/safety.js (readline.question => no trailing newline).
function detectPrompt(line) {
  const s = String(line || '');
  let m = s.match(/Allow agent to control app "([^"]+)"\?\s*\[y=once \/ a=always \/ N\]\s*$/);
  if (m) return { kind: 'app', label: `Control the app "${m[1]}"`, options: ['once', 'always', 'deny'] };
  m = s.match(/^\s*(.*?)\s*\[y\/N\]\s*$/);
  if (m) return { kind: 'tool', label: m[1].slice(0, 400) || 'Approve this action?', options: ['once', 'deny'] };
  return null;
}

function parseLine(raw) {
  const s = String(raw || '').replace(/\s+$/, '');
  let m;
  if ((m = s.match(/^\s*\[step (\d+)\]\s*(.*)$/))) return { kind: 'step', n: Number(m[1]), text: m[2] };
  if ((m = s.match(/^\s*\[tool\]\s+([A-Za-z0-9_\-]+)\s+->\s+(.*)$/))) {
    const body = m[2];
    const ok = /"ok"\s*:\s*true/.test(body) ? true : /"ok"\s*:\s*false/.test(body) ? false : null;
    return { kind: 'tool', name: m[1], ok, summary: body.slice(0, 400) };
  }
  if (/^\s*\[(skill|skills|skills:auto|llm|mcp|self-tool|learn|idle)[\]:\s]/.test(s)) return { kind: 'note', text: s.trim() };
  if (/^WinAgent — /.test(s)) return { kind: 'banner', text: s.replace(/^WinAgent — /, '') };
  return { kind: 'log', text: s };
}

module.exports = { detectPrompt, parseLine, ANSWER_BEGIN, ANSWER_END };
