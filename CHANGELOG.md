# Changelog

## 1.14.0 — 2026-09-17
- Fixed silent autonomy: GitHub scheduler never fires here, so every push
  now runs the curiosity heartbeat (converges to no-op when nothing is new).
- Verified free models: Pollinations openai + openai-fast live; DDG, KeylessAI,
  mistral/llama/qwen retired as dead; GitHub Models preset in chat (PAT key).

## 1.13.0 � 2026-09-17
- GitHub skill crawler: imports SKILL.md playbooks from other repos (proven
  live from anthropics/skills), provenance in skills/sources.json (daily).
- Library filters + sorting: All / Auto-learned / Imported / Task-built,
  text search, Name A-Z / Z-A / Category sort.
- Rolling refresh every 30 min (2 stalest skills); models now every 3 hours.
- Image learning: IMAGE_URLS keyless-OCR screenshots into skill material.

## 1.12.0 — 2026-09-17
- Self-adding free models: `model-scout` probes + discovers keyless endpoints
  and writes `docs/models.json`; chat dropdown fills itself live (30-min loop).
- Clear framework: `ARCHITECTURE.md` (layers, contracts, conventions, recipes).

## 1.11.0 — 2026-09-17
- Keyless online chat: free cloud models default (Pollinations, verified live),
  paid providers optional; PAT-gated DO buttons with Test + inline diagnostics.
- Teach fixed two ways: PAT dispatch + no-token issue fallback link.
- Curiosity now every 5 min (`*/5 * * * *`); no-op when nothing new qualifies.
- Race-safe bot pushes on all 4 cloud workflows (rebase + docs-regen + retry).

## 1.10.0 — 2026-09-17
- Curiosity engine: agent picks its OWN interests (HN + trending + issues,
  relevance-scored) and self-teaches daily on GitHub (`curiosity.yml`).
- Online chat `docs/chat.html`: full-fledged phone-friendly UI using ONLINE
  models direct from the browser + dispatch/poll cloud runs (teach/task/test).
- Cloud task backend `agent-task.yml`: full agent runs on secrets, honest
  triage note without; results committed to `runs/`.

## 1.9.0 — 2026-09-17 (vs ChatGPT agent + OpenClaw, full comparison)
- Phone chat: `--chat telegram` (owner-locked, per-chat memory, /new /selftest /stop).
- Local cron: `--every <min> "task" [--repeat N]` (ChatGPT-schedules parity).
- Subagents: `task_delegate` (fresh-loop fan-out, depth-capped at 2).
- Verified connector recipes (Notion/GitHub/Google/Playwright/SQLite/files).
- 2 new skills: chat-telegram, schedule. 62 tools, 18 skills.

## 1.8.0 — 2026-09-17
- Office documents: `office_run` (Word/Excel/PowerPoint via COM, live-tested
  with real files) + `doc_pdf` (any CDP tab → PDF); `office-docs` skill with
  COM / python / M365-Graph lanes. 61 tools, 16 skills.
- Daily autonomous sandbox: scheduled Actions run selftest matrix
  (win+ubuntu), refresh the stalest skill, rebuild+push docs, check the live
  page, and file a `sandbox-health` issue on failure. Zero human, zero PC.

## 1.7.0 — 2026-09-17 (vs Manus / Claude / Operator / OpenClaw / Gemini)
- Web dashboard `--ui 8080`: chat, live SSE stream, click-to-approve (loopback).
- MCP bridge: any MCP server becomes `mcp_<server>_<tool>` (Windows .cmd-safe).
- DOM browsing: `browser_dom` / `browser_click_sel` / `browser_fill_sel`.
- Rollback: auto `.bak-TIMESTAMP` on file_write/file_edit (`NO_BACKUP=true` off).
- Plan mode: `--plan` outlines + approves before executing (Cowork-style).
- 3 new skills: dashboard, mcp, browser-dom. 59 standalone tools.

## 1.6.0 — 2026-09-17
- GitHub-first skills: `SKILL_SOURCE=auto` fetches playbooks live from the repo
  every run (local fallback offline); `SKILL_TOKEN` for private repos.
- Live library page: `node src/build-docs.js` generates `docs/index.html`
  (10 skills, auto-learned badges, search filter).
- Copy-paste-proof README + gh-first GITHUB_SETUP (verified by fresh clone).

## 1.5.0 — 2026-09-17
- Idle autonomy: `--idle-learn` (2s quiet trigger), `--learn`, `--daemon`,
  `learn <topic>` REPL command, `memory/GOALS.md` + learn queue, 5-min cooldown.
- Self-upgrade engine: research → distill with own model → install to
  skills//memory only (src/ never touched autonomously).
- Linux/macOS support: `src/platform.js` + `src/tools-linux.js` (shell,
  screenshot, xdotool input, systemctl, journalctl, nmcli, dpkg, df, CDP);
  same 55 tools everywhere; win-only calls SKIP; CI on ubuntu + windows.
- Per-app approvals `[y/a/N]` + `ALLOWED_APPS` (Computer-Use parity).

## 1.3.0 — 2026-09-17
- In-harness plugin `winag-2` v8: **20 tools** — full human skill set
  (buttons/UIA, typing, keys, edit, drag, windows, clipboard, sudo, silent shell).
- Silent runner: every call hides its own console (no PowerShell popups, ever).
- Standalone: 45 tools (`screen_drag`, `window_manage`, `clipboard_write`, `key_tap`,
  `web_fetch`, `web_post` + all previous).
- Skills: wordpress-build, typing-editing, drag-drop, system-control, uia-click.
- Windows app: `WinAgentApp/` (silent VBS launcher + menu + version).
- Repo files: LICENSE, CHANGELOG, CONTRIBUTING, CI, push.bat, GITHUB_SETUP.

## 1.2.0
- Skills system (`--skill`, `SKILLS`, REPL `skills` command) + wordpress-build.
- Web tools for REST automation.

## 1.1.0
- A. screen control, B. CDP browser autopilot, C. deep system tools.

## 1.0.0
- Core agent: files, apps, shell, sysinfo + pluggable API/local/custom LLM.


