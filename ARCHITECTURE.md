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
                                      memory/SELF.md is the self-awareness log (src/self-log.js) — one line per
                                      skill learned / tool staged or created / model self-integrated, written by
                                      skill-crawler.js, tool-crawler.js, tool-web-scout.js, tool_create and
                                      model-scout.js — auto-injected into every prompt by the same loadMemory().
STAGING (tools-imported/)            candidate tool modules found by src/tool-crawler.js (GitHub search) and
                                      src/tool-web-scout.js (web search) — NEVER auto-loaded; both funnel
                                      through src/tool-stage.js; see tools-imported/README.md for the manual
                                      promotion step. self-authored/ holds tools the agent wrote itself via the
                                      tool_create tool — these ARE auto-loaded, at startup and immediately on
                                      creation (see "self-improvement" below).
LEARN (no human needed)               self-learn skill → learnCycle → daemon/idle →
                                      agent-learn.js (chat/research/install) → curiosity.js (own interests) →
                                      model-scout.js (free-model registry) — all runnable on Actions
CLOUD (.github/workflows/, docs/)     learn-skill (issue/chat teach) · daily-sandbox (test+refresh) ·
                                      curiosity (5-min interests) · model-scout (30-min models) · agent-task (chat backend) ·
                                      repo-crawl (daily: skill-crawler.js + tool-crawler.js + tool-web-scout.js) ·
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

## Self-awareness & self-improvement

The agent is designed to know what it has learned and to act on gaps live,
not just accumulate skills passively in the background:

- **memory/SELF.md** (`src/self-log.js`) is a running log — one line per
  skill imported, tool staged, tool self-authored, or free model
  integrated — written by `skill-crawler.js`, `tool-crawler.js`,
  `tool-web-scout.js`, `tool_create`, and `model-scout.js`. It's just
  another file under `memory/`, so `loadMemory()` in `index.js` injects it
  into every system prompt automatically — the agent sees its own recent
  growth on every run with zero extra plumbing.
- **`self_status` tool** — on-demand introspection: built-in tool count,
  self-authored tools, tool candidates still awaiting review, skills
  available, current model + scouted fallback chain, and the last 8
  self-log lines. The agent is told (in `tool_create`'s description) to
  check this — and the skill catalog — before inventing something it
  might already have.
- **Live gap-filling mid-task**: the `self-learn` skill (auto-picked when
  triggers match) already covers "research → distill → install" for
  *skills* live, mid-task, via `web_search`/`web_scrape`/`skill_load`.
  `tool_create` is the equivalent for *tools*: when nothing in the tool
  list or skill catalog covers what's needed, the agent can write one on
  the spot. It is **not a sandbox** — the generated code runs with the
  same full process privileges as every built-in tool — so the tradeoff is
  the same one the whole project already makes with `AUTO_YES`: full
  autonomy, safety net is the audit trail (the file itself, git history),
  not confinement.
- **Model self-improvement**: `model-scout.js` doesn't just log free
  models it verifies — `src/config.js` reads `docs/models.json` at
  startup and `src/llm.js`'s `chat()` tries them, fastest first, after the
  configured primary and any explicit `LLM_FALLBACK_*`, before giving up.
  A model the agent discovers on its own becomes something it can actually
  fall back on the same run it was found, with no human touching `.env`.
  `USE_SCOUTED_MODELS=false` opts out.



- **tool-stage.js**: shared staging path used by both tool discovery scripts below.
  A tool runs with the agent's full privileges (files/shell/registry/browser),
  unlike a skill (inert markdown), so nothing it discovers is ever loaded or
  executed — it's written under `tools-imported/candidates/` with provenance,
  pending a human's manual promotion into `tools.js` (see `tools-imported/README.md`).
- **Tool candidates from GitHub**: append a block in `tools.js` (+ Linux branch if OS-specific) → selftest entry → README line → push.
  Candidates found on GitHub by `tool-crawler.js` land in `tools-imported/candidates/` for review first —
  never copy one into `tools.js` without reading it; see `tools-imported/README.md`.
- **Tool candidates from the web**: `tool-web-scout.js` runs the same daily
  job, but discovers via general web search (DuckDuckGo HTML, like
  `agent-learn.js`) instead of GitHub's search API — different discovery
  surface, same staging path, same manual-review requirement.
- **Skill**: write `skills/<n>.md` (or `--learn "<topic>"`, or chat-teach) → `node src/build-docs.js` → push.
- **Channel**: new file driving `agentTask` (import-safe: keep `main()` unimported) + `--flag` + skill doc.
- **Free model**: add seed in `model-scout.js` → scout validates → registry (`docs/models.json`) →
  chat dropdown AND the live agent's own `chat()` fallback chain (`src/config.js` + `src/llm.js`), all automatic.
- **Cloud job**: new workflow from the rebase-push template + dispatch trigger for manual runs.
