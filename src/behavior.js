import fs from 'node:fs';
import path from 'node:path';

// The behavior contract is deliberately data-driven. Owners can refine the
// personality in memory/BEHAVIOR.md without changing the engine code.
export const DEFAULT_BEHAVIOR = `
WINAGENT OPERATING BEHAVIOR
- Be a calm, concise, proactive Windows chief-of-staff: understand the goal, act, verify, and report.
- Treat the user's computer as the working environment. Use local tools for local work; use the model for ambiguity, planning, explanation, and knowledge.
- Remember durable preferences, successful fixes, and important environment facts. Never store credentials, tokens, or full sensitive file contents in memory.
- Prefer the smallest reliable action. For multi-step work, make a short internal plan, execute it end to end, and verify each important result.
- Be context-aware: inspect existing files, previous memory, and available skills/tools before inventing a solution.
- Speak like a trusted assistant: confident but honest, no fake completion, no unnecessary narration, and report exact paths/results.
- If a tool fails, diagnose it, make one sensible correction, retry once, then explain the blocker.
- Use the configured autonomy mode. In full-control mode, do not ask for routine approval; still obey protected-path and harness boundaries.
- Learn from completed work by recording a short, redacted experience note that can improve future decisions.
`;

function safeRead(file, max = 12000) {
  try { return fs.readFileSync(file, 'utf8').slice(0, max); } catch { return ''; }
}

export function loadBehavior(root) {
  const file = path.join(root, 'memory', 'BEHAVIOR.md');
  const configured = safeRead(file, 16000).trim();
  return `\n\nOPERATING BEHAVIOR (follow as the agent's standing identity):\n${configured || DEFAULT_BEHAVIOR.trim()}`;
}

function redact(value) {
  return String(value || '')
    .replace(/(api[_-]?key|token|password|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

// Keep a small rolling episodic memory. It is intentionally plain Markdown so
// it is reviewable, syncable, and easy to remove. It never stores model output
// verbatim or credentials.
export function recordExperience(root, { task, outcome, tools = [], status = 'completed' }) {
  try {
    const dir = path.join(root, 'memory');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'EPISODES.md');
    const old = safeRead(file, 50000);
    const date = new Date().toISOString().slice(0, 10);
    const toolNames = [...new Set(tools.map(t => String(t).replace(/[^a-z0-9_.:-]/gi, '').slice(0, 50)).filter(Boolean))].slice(0, 12);
    const line = `- [${date}] status=${status}; request="${redact(task)}"; tools=${toolNames.join(',') || 'none'}; result="${redact(outcome)}"\n`;
    const header = old.startsWith('#') ? old.split(/\r?\n/).slice(0, 2).join('\n') + '\n' : '# WinAgent episodic memory\n\n';
    const entries = old.replace(/^# WinAgent episodic memory\s*\r?\n\s*/i, '').split(/\r?\n/).filter(Boolean);
    fs.writeFileSync(file, header + [...entries, line.trimEnd()].slice(-60).join('\n') + '\n', 'utf8');
  } catch { /* memory must never break the user's task */ }
}
