# PAWWORK.md — to any PawWork (DeepSeek Harness) agent reading this repo

You are looking at **WinAgent**: a silent Windows operator (files, apps, screen,
browser, system) + a skill library. Adopt it in minutes:

## 1. Recognise (30 seconds)
- `AGENT.txt` — the plugin's goal, characteristics, full skill list.
- `skills/*.md` — 7 playbooks: wordpress-build, typing-editing, drag-drop,
  system-control, uia-click, file-fetch-upload (+ this bootstrap).
- `src/tools.js` — `buildTools()`: 46 typed tools, zero dependencies.
- `WinAgentApp/` — double-click Windows app (silent VBS + menu + version).
- `winag-2` (Cordis dynamic plugin, 21 tools) is THIS repo's chat-side twin:
  same capabilities as model-callable tools via `harness.defineTool` +
  `ctx.subprocess` direct spawn (hidden window, no sandbox runner, no console).

## 2. Install (2 minutes, Windows host)
1. Clone/copy this folder anywhere (no `npm install` — pure Node ≥ 18).
2. `copy .env.example .env`, set `MODEL_API_URL / MODEL_API_KEY / MODEL_NAME`
   (Ollama local, OpenAI/DeepSeek API, or any OpenAI-compatible endpoint).
3. Self-test (no AI needed): `WinAgentApp\WinAgent-menu.bat` → option 2,
   or `node src\index.js --selftest`. Expect `SELFTEST OK`.
4. Skills load per task: `run.bat --skill wordpress-build "your task"`,
   or `SKILLS=wordpress-build` in `.env`. REPL command `skills` lists them.

## 3. Recreate the chat-side plugin (this session's twin)
1. Load the `cordis-plugin-development` skill; `cordis_inspect_list`, then use
   Host `subprocess` (direct spawn, hidden window) — NEVER the `shell` service
   for routine calls (its sandbox runner shares the host console visibly).
2. Mirror tools one-to-one from `src/tools.js` (PowerShell bodies are portable
   as-is; keep them PS 5.1-safe: no ternary, no `??`).
3. `harness.defineTool` + `harness.registerTool(ctx, ...)` per tool,
   `output.schema {type:'string'}`, `inject: ['timer','subprocess','tools']`.
4. `cordis_run`, then verify with a read-only tool before anything destructive.

## 4. Push discipline
Every change you make here: `push.bat "message"` (or git add/commit/push).
CI (`.github/workflows/ci.yml`) syntax-checks + self-tests on Windows.

## 5. Safety contract (non-negotiable)
Approval-gated destructive/input ops, allow/block path lists, audit log,
verify-after-acting, secrets never in chat or repo (`.env` is gitignored).
Silent running: hide own console first; never touch the user's windows unasked.
