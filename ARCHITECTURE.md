# WinAgent framework — how the whole system fits together

One brain, many bodies. Everything below is zero-dependency Node 18+ unless noted.

```
ENTRY (src/index.js --flags)          REPL · --once · --yes · --plan · --ui · --chat telegram
   │                                   --every · --daemon · --idle-learn · --learn · --selftest
LOOP (agentTask)                      system prompt + tools + skills + memory → LLM → tool → repeat (maxSteps)
   ├── TOOLS (src/tools.js, 60+)      files · apps · screen · CDP browser · DOM · Office · web · memory · research · delegate
   ├── BACKENDS (platform.js, tools-linux.js)   win32 PowerShell/Win32 vs linux/mac bash+xdotool — same tool names
   ├── PLUGINS (src/mcp.js)           any MCP server → mcp_<server>_<tool> (MCP_SERVERS JSON)
   └── GUARD (src/safety.js)          ALLOWED_ROOTS/BLOCKED_PATHS · destructive approvals (terminal/dashboard)
                                      per-app always-allow · audit.log · auto .bak rollback
MEMORY (memory/, skills/)             MEMORY.md + topics + GOALS.md + learn-queue — auto-loaded every run,
                                      updated by memory_* tools. skills/ loads GITHUB-FIRST (SKILL_SOURCE).
LEARN (no human needed)               self-learn skill → learnCycle → daemon/idle →
                                      agent-learn.js (chat/research/install) → curiosity.js (own interests) →
                                      model-scout.js (free-model registry) — all runnable on Actions
CLOUD (.github/workflows/, docs/)     learn-skill (issue/chat teach) · daily-sandbox (test+refresh) ·
                                      curiosity (5-min interests) · model-scout (30-min models) · agent-task (chat backend) ·
                                      ci (win+ubuntu) — Pages serves docs/index.html + chat.html + models.json
CHANNELS                              terminal REPL · dashboard :8080 (chat+approvals) · Telegram · GitHub-issue chat · web chat
```

## Contracts (follow these and nothing breaks)

- **Tool**: `{ name, description, args, run(args, {cfg}) }` → `{ok, ...data}` or `{ok:false, error, hint}`. Never throw. No deps. Windows-first, Linux via tools-linux.js override (return `{handled:false}` to fall through).
- **Skill**: `skills/<name>.md` — when / steps / verify. Instruction text only, no executable code. Auto-learned ones carry their source.
- **Workflow**: checkout → setup-node → run → commit (rebase+retry push pattern!) → report. Owner-gate anything that spends quota. Concurrency groups on.
- **Channel**: drives agentTask or child-process CLI; approvals resolve through `cfg.approvalHandler` ('once'|'always'|false, 120s default-deny).
- **Model registry**: `docs/models.json` `{live:[{id,label,url,kind,model,latencyMs}], candidates:[]}` — chat.html renders it; scout refreshes it.

## Conventions (non-negotiable)

1. Zero `npm install` — pure Node + OS tools. If a feature needs a binary, degrade with a helpful error.
2. Approval-first: destructive/input actions ask; `--yes` only for explicit automation; audit everything.
3. Verify by artifact: file exists + re-read, screenshot after click, SHA after push, HTTP 200 after deploy.
4. GitHub-first: skills/models/docs load live from the repo; local files are offline fallback.
5. Secrets never touch chat, logs, skills, memory, or git (`.env`/keyring/Actions secrets only).
6. Silent on Windows: hidden shells, no console popups — ever.

## Adding things (5-minute recipes)

- **Tool**: append a block in `tools.js` (+ Linux branch if OS-specific) → selftest entry → README line → push.
- **Skill**: write `skills/<n>.md` (or `--learn "<topic>"`, or chat-teach) → `node src/build-docs.js` → push.
- **Channel**: new file driving `agentTask` (import-safe: keep `main()` unimported) + `--flag` + skill doc.
- **Free model**: add seed in `model-scout.js` → scout validates → registry → chat dropdown, all automatic.
- **Cloud job**: new workflow from the rebase-push template + dispatch trigger for manual runs.
