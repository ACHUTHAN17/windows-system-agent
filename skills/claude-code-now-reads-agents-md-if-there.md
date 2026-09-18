# Skill: Claude Code now reads AGENTS.md if there is no Claude.md

Auto-learned 2026-09-18 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Claude Code now reads AGENTS.md if there is no Claude.md.

## Steps
1. Download ZIP Does Claude Code read AGENTS.md? No — it reads CLAUDE.md
2. Step 1 — Decide which file is canonical Pick AGENTS.md as your canonical source of truth
3. Step 2 — Wire CLAUDE.md to import AGENTS.md Move the contents of your existing CLAUDE.md into AGENTS.md , then replace CLAUDE.md with a one-line import plus whatever Claude-specific overrides you actually need: Markdo

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Does Claude Code Support AGENTS.md? The Complete 2026 Reference
  https://thepromptshelf.dev/blog/does-claude-code-support-agents-md-2026/
- Does Claude Code read AGENTS.md? No — it reads CLAUDE.md. The official ...
  https://gist.github.com/yurukusa/d36197848911f025add142abefcde685
- AGENTS.md vs CLAUDE.md: Does Claude Code or Codex Read Both?
  https://agyn.io/blog/claude-md-agents-md-compatibility
