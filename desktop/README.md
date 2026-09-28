# WinAgent Desktop

A native Windows app for the WinAgent system-control agent — a ChatGPT / Codex-style window with
chat history, live tool activity, inline approval cards, a tray icon and a global hotkey
(**Ctrl+Alt+Space**). It runs the same engine as the CLI (`../src`), so all 65+ tools, the skills
library and the self-improvement features are available — **no Node.js install needed** (the app
carries its own runtime).

## Get the installer (easiest — nothing to install on your PC)

1. Push this folder to GitHub (or merge the patch), then open **Actions → desktop-build → Run workflow**
   (it also runs automatically when `desktop/**` or `src/**` change on `main`).
2. When it finishes, download the **WinAgent-windows** artifact and run
   `WinAgent-<version>-nsis.exe` (installer, per-user, no admin rights needed) or
   `WinAgent-<version>-portable.exe` (single file).
3. Tag `desktop-v1.0.0` and push it to publish the same files as a GitHub Release.

Builds are **unsigned**: Windows SmartScreen will say "unknown publisher" → *More info → Run anyway*.

## Build it yourself

```powershell
# needs Node.js 20+ from https://nodejs.org
cd desktop
npm install
npm test            # 19 tests: parser, runner, sync, UI, and the REAL engine end-to-end
npm start           # run in development
npm run dist        # -> desktop\dist\WinAgent-1.0.0-nsis.exe and -portable.exe
```

## What you get

| | |
|---|---|
| **Chat** | Sessions saved locally, markdown answers, copy buttons, conversation context is passed to the agent |
| **Live activity** | Every step and tool call the agent makes, streamed while it works; **Stop** kills the whole process tree |
| **Approvals** | The agent asks before risky actions (write/delete/shell/registry/app control). Allow once / Always / Deny, with a Windows notification if the window is hidden. Auto-denies after 5 minutes |
| **Full control** | Optional switch (top-right badge or Settings). Confirmation dialog first. The agent then acts without asking — only use with a model you trust |
| **Models** | Default = free keyless models found by the model scout. Or OpenAI, Anthropic, OpenRouter, Ollama, or any OpenAI-compatible URL. API key is encrypted with Windows DPAPI and is passed to the agent only as a process environment variable — never written to a file |
| **Allowed folders** | Optional allow-list (`ALLOWED_ROOTS`); protected system paths stay blocked either way |
| **GitHub sync** | ↻ button (and on start): pulls the latest **skills**, **docs/models.json** and merges **memory** from `ACHUTHAN17/windows-system-agent`. Memory is *merged* (new notes added, yours never overwritten) |
| **Skills / Memory / Tools** | Browse and search skills, edit memory files, see every tool including ones the agent wrote itself |
| **Tray + hotkey + autostart** | Closes to tray, `Ctrl+Alt+Space` shows/hides, optional start with Windows |

## How it works

```
Electron main ──spawn──▶ WinAgent.exe (ELECTRON_RUN_AS_NODE=1) src/index.js --once "<task>"
      ▲   │                      stdout: [step] [tool] … approval prompt … @@WINAGENT_ANSWER@@
      │   └─ lib/runner.js parses lines → events ─IPC─▶ renderer (sandboxed, no Node access)
      └──── approve/stop/settings via a small validated IPC surface (preload.js)
```

* The engine is copied to `%APPDATA%\WinAgent\agent` on first launch (it writes memory/skills/runs
  next to its source, so it can't live in `Program Files`). Updating the app refreshes `src/` but
  never touches your memory, skills you synced, `runs/`, or `tools-imported/`.
* No local web server is opened (the older `--ui` dashboard listens on 127.0.0.1; it is now protected
  against cross-site requests too, but the desktop app doesn't need it).

## Security notes — read once

* **This app can control your whole PC.** That is the point, and also the risk. Default mode asks
  before risky actions; keep it that way unless you trust the model.
* **Sync never pulls code by default.** It excludes `tools-imported/` (tools the *cloud* agent wrote
  must not auto-run on your PC), `.env`, `config.json`, `runs/`. Engine code (`src/`) is only updated
  if you tick *Also update the agent engine* in Settings.
* **Memory sync is a prompt-injection surface**: synced memory lines are fed to the model on every
  task. Only bullet lines ≤ 300 chars are merged (max 40 per sync), and you can review/edit them in
  the *Memory* tab or turn memory sync off in Settings.
* The renderer runs sandboxed with a strict CSP; model output is HTML-escaped before display.
* Agent-written tools (`tool_create`) are **not sandboxed** — they run with the agent's full privileges.
