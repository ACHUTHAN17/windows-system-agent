# WinAgent — Windows System Agent (files + apps, any model)

Zero-dependency Node.js agent. It lists/reads/writes files, launches/lists/kills apps,
runs gated PowerShell, and talks to **any model** through one config:

| Model | `MODEL_PROVIDER` | `MODEL_API_URL` | `MODEL_API_KEY` | `MODEL_NAME` |
|---|---|---|---|---|
| OpenAI API | `openai-compatible` | `https://api.openai.com/v1` | `sk-...` | `gpt-4o-mini` |
| DeepSeek API | `openai-compatible` | `https://api.deepseek.com/v1` | `sk-...` | `deepseek-chat` |
| Ollama (local) | `openai-compatible` | `http://localhost:11434/v1` | `ollama` | `llama3.1` |
| LM Studio (local) | `openai-compatible` | `http://localhost:1234/v1` | `lm-studio` | your loaded model |
| Custom gateway | `openai-compatible` | your URL | your key + `MODEL_EXTRA_HEADERS` | your model id |
| Anthropic native | `anthropic` | `https://api.anthropic.com` | `sk-ant-...` | `claude-3-5-sonnet-latest` |

Any endpoint that speaks `POST /chat/completions` works (vLLM, OpenRouter, Azure proxy, corporate gateway…).

## How WinAgent compares (Sept 2026 landscape)

| They have | WinAgent answer |
|---|---|
| Claude Computer Use / Cowork: screenshot loop, permission gates, skills, plan review | Same loop + approvals + `skills/` + `--plan` (approve before run) |
| OpenAI Operator / Codex background sessions: web tasks, human takeover | CDP browser tools + foreground honesty + user-takeover-anytime + web-approval dashboard |
| Manus: cloud execution, parallel work, long-horizon autonomy | Chat-to-skill + learn-skill Actions run fully on GitHub; daemon/idle self-upgrade; batched parallel calls |
| OpenClaw: MIT, any-model, local-first, plugins, voice roadmap | MIT, any-model API/local, fully-offline capable, MCP plugins, skills |
| Gemini/Mariner: DOM-aware browsing (no pixel flake) | `browser_dom` / `browser_click_sel` / `browser_fill_sel` (synthetic DOM events) |
| Everyone's gap: no undo button, silent scope creep | Auto `.bak-TIMESTAMP` on every file write/edit (`NO_BACKUP=true` to skip) |
| Manus/Operator: watchable cloud UI | `--ui 8080` local dashboard: chat, live SSE stream, click-to-approve (loopback only) |
| cc-switch / MCP ecosystem: hundreds of integrations | `MCP_SERVERS`: any MCP server becomes `mcp_<server>_<tool>` |
| ChatGPT agent: scheduled tasks + Gmail/Slack/GitHub event triggers | `--every` local intervals + daily-sandbox cloud cron + issue-event triggers; Gmail/Slack via MCP connectors + poller tasks |
| ChatGPT agent: connectors (Gmail, Drive, GitHub, Notion) | Verified copy-paste MCP recipes in skills/mcp.md (Notion, GitHub, Google Workspace x2, Playwright, SQLite, filesystem) |
| ChatGPT mobile: chat anywhere + done-notifications | `--chat telegram`: owner-locked phone chat, per-chat memory, completion replies are the notification |
| OpenClaw: channels, cron, webchat, subagents, Docker | Telegram channel + `--every` cron + `--ui` webchat + `task_delegate` fan-out (depth-capped); Docker/Tailscale sharing = roadmap |

Honest limits: no voice I/O yet, no isolated background desktop sessions (our
mouse uses YOUR foreground — say the word and it stops), pixel grounding
quality depends on your model, not us. Benchmarks (OSWorld/GAIA) measure their
models; this harness just aims to waste none of it.

## 1. Fresh-machine setup (copy-paste, ~5 min, Windows PowerShell)

```powershell
# 0. Node.js 18+ (skip if `node --version` already prints v18 or higher)
winget install OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
# Close and reopen the terminal, then:
node --version
```

```powershell
# 1. Get the agent
git clone https://github.com/ACHUTHAN17/windows-system-agent.git
cd windows-system-agent
```

```powershell
# 2. Point it at a model: copy the template, open it, set 3 lines (pick ONE block below)
copy .env.example .env
notepad .env
```

```ini
# Ollama (local, free) — first run: ollama serve  +  ollama pull llama3.1
MODEL_API_URL=http://localhost:11434/v1
MODEL_API_KEY=ollama
MODEL_NAME=llama3.1
```

```ini
# OpenAI API
MODEL_API_URL=https://api.openai.com/v1
MODEL_API_KEY=sk-your-key-here
MODEL_NAME=gpt-4o-mini
```

```powershell
# 3. Prove it works (no model needed — expect SELFTEST OK at the end)
node src\index.js --selftest

# 4. First tasks
node src\index.js "list files in Documents and tell me the 3 largest"
.\run.bat "open notepad" --yes
.\run.bat
```

Notes: `run.bat` reuses these exact commands (double-click works too). `--yes`
means full-agent mode — no prompts, everything audit-logged. REPL commands:
`model tools skills memory goals learn <topic> selftest exit`.

More one-liners (same PowerShell):

```powershell
node src\index.js --selftest
node src\index.js "kill notepad" --yes
node src\index.js --model llama3.1 --url http://localhost:11434/v1 "list windows"
node src\index.js --skill wordpress-build "describe my site plan"
node src\index.js --daemon 300
```

## 2. Local LLM examples

```bat
:: Ollama
ollama serve
ollama pull llama3.1
:: .env: MODEL_API_URL=http://localhost:11434/v1  MODEL_API_KEY=ollama  MODEL_NAME=llama3.1

:: LM Studio: start server on :1234, load a model
:: .env: MODEL_API_URL=http://localhost:1234/v1  MODEL_API_KEY=lm-studio  MODEL_NAME=<shown in LM Studio>
```

## 3. Tools (62)

Files: `file_list, file_read, file_write, file_edit, file_mkdir, file_delete, file_move, file_copy, file_search`
Apps/system: `app_launch, app_open, app_list, app_kill, window_list, shell_exec, sys_info`
Screen/data: `screen_screenshot, clipboard_read, browser_info, reg_read, service_list`
A. Screen control: `screen_size, screen_click, key_press, window_focus`
B. Browser autopilot (CDP): `browser_debug_launch, browser_tabs, browser_navigate, browser_tab_read, browser_click, browser_fill, browser_screenshot`
C. Deep system: `reg_write, service_control, eventlog_recent, startup_list, wifi_list, installed_apps, disk_info`
Human input: `screen_drag, key_tap, clipboard_write`
System control: `window_manage`
Web: `web_fetch, web_post` (downloads, REST APIs e.g. WordPress)
Computer-use actions: `screen_scroll, mouse_move, screen_double_click, wait`
Memory: `memory_read, memory_write, memory_forget` (core memory, auto-loads)
Research: `web_search, web_scrape` (self-learning engine)
Push: `github_push` (commit + push itself, classifies auth errors with fixes)
DOM: `browser_dom, browser_click_sel, browser_fill_sel` (structure-first browsing)
MCP: `mcp_<server>_<tool>` (any MCP server via `MCP_SERVERS` JSON)
Delegate: `task_delegate` (fresh-loop subtasks, depth-capped fan-out)
Documents: `office_run` (Word/Excel/PowerPoint via COM, hidden) + `doc_pdf` (any tab → PDF)
Safety extras: auto `.bak` rollback on file writes · `--plan` approve-before-run · `--ui 8080` web dashboard with click approvals

### A. True screen agent
`screenshot → screen_size → window_focus → screen_click / key_press` operates any app
visually. Clicks/keys need approval (`REQUIRE_APPROVAL=true`) and an interactive desktop.

### B. Browser autopilot (no extensions, zero dependencies)
1. `browser_debug_launch` starts Chrome/Edge with `--remote-debugging-port=9222` on a
   separate profile in `%TEMP%` — your main browser is untouched.
2. `browser_tabs, browser_navigate, browser_tab_read, browser_click, browser_fill, browser_screenshot`
   drive pages over CDP (plain `fetch` + `WebSocket`). Navigation accepts `http(s)://` and `file://`.

### C. Deep system
Registry write (`HKCU:` safe to test, `HKLM:` needs admin), service start/stop/restart,
event-log reads, autorun inventory, WiFi scan + saved profiles (names only),
installed-programs inventory, disk space.

Examples the agent understands:
- `"read C:\Users\ADMIN\Documents\notes.txt and summarize it"`
- `"find TODO in my Documents .txt files"`
- `"open Chrome to https://example.com"`
- `"launch notepad, then list windows"`
- `"kill process notepad.exe"`

## 4. Skills (playbooks the agent follows)

Drop a markdown playbook in `skills/` and load it per task — no code changes:

```bat
run.bat --skill wordpress-build "set up a bakery site at C:\xampp\htdocs\bakery"
run.bat --skill wordpress-build,seo "migrate my blog to LocalWP"
```

Or set once in `.env`: `SKILLS=wordpress-build`. Type `skills` in the REPL to list them.
Shipped skills (`skills/`, load with `--skill a,b` or `SKILLS=a,b`):
`wordpress-build` (sites), `typing-editing` (type/edit/paste),
`drag-drop` (drags/sliders/selections), `system-control` (whole machine),
`uia-click` (press any button by name — mouse-free),
`file-fetch-upload` (locked files + uploads), `computer-use` (see below),
`self-learn` (research gaps mid-task, install skills, update core memory),
`github` (push itself, device-flow auth, multi-account fixes),
`agent-modes` (six run modes + parallel learning/executing),
`dashboard` (web UI), `mcp` (MCP plugins), `browser-dom` (structure browsing),
`office-docs` (Word/Excel/PowerPoint/PDF locally + M365 cloud),
`chat-telegram` (phone chat UI), `schedule` (interval/cloud/event triggers).
Add your own: any `skills/<name>.md` works the same way.

**Skills load from GitHub first — no local files needed.** `SKILL_SOURCE=auto`
(default) fetches each skill live from this repo on every run, so the agent
always learns the latest version; local `skills/` is only the offline fallback
(`local` = offline only, `github` = remote only). Private repo? Put a classic
PAT with `repo` scope in `.env` as `SKILL_TOKEN` (public repos need nothing).
Browse the live library: [`skills/` on GitHub](./skills) + generated
[`docs/index.html`](./docs/index.html) (auto-rebuilt by `node src/build-docs.js`).

Run anywhere with zero footprint (shallow clone to TEMP, nothing permanent):

```powershell
git clone --depth 1 https://github.com/ACHUTHAN17/windows-system-agent.git $env:TEMP\winagent
cd $env:TEMP\winagent
$env:SKILL_TOKEN="github_pat_..."   # private repo only — skip if public
node src\index.js --skill github "push my latest changes"
```

### Chat-to-skill: teach from your phone, no PC or app needed

The **skill-request issue IS the chat interface** — open one, type what the
agent should learn, GitHub does the rest:

👉 https://github.com/ACHUTHAN17/windows-system-agent/issues/new?template=skill-request.yml&title=teach%3A+

Title it `teach: <topic>`. A GitHub Actions runner researches the web, writes
`skills/<topic>.md`, rebuilds the live library, commits, pushes, and replies
on your issue with links. Only the repo owner can trigger it (strangers get a
polite decline). Backup path: Actions tab → `learn-skill` → Run workflow.
Live library: https://achuthan17.github.io/windows-system-agent/
Smarter distills: repo Settings → Secrets → Actions → add `LLM_API_URL` /
`LLM_API_KEY` / `LLM_MODEL` (any OpenAI-compatible endpoint — free tiers work).
Without keys you get the heuristic pass (official-docs steps, still useful).

### Daily autonomous sandbox (no human, no PC)
`.github/workflows/daily-sandbox.yml` runs **03:00 UTC every day** on GitHub's
own runners: full selftest on Windows + Ubuntu, refresh of the stalest skill
(web research → field update → docs rebuild → push), live-page HTTP check.
Failures open/comment a `sandbox-health` issue with the run link. Trigger
anytime: Actions tab → daily-sandbox → Run workflow. The agent tests and
updates its own skills daily while you sleep.

### Curiosity: it learns on its OWN interest (no queue, no human)
Every push fires the **autonomy heartbeat** (ci `autonomy` job — GitHub's
`scheduler` proved unreliable here: registered `active` yet never fired, so
pushes are the heartbeat now): scans Hacker News top stories + trending repos
+ open issues, learns the top new interest, pushes. Dedup guards make quiet
periods converge to no-ops instead of loops. Schedules remain as backup.

### Crawl: learns other repos' skills freely (daily 06:00 UTC)
`skill-crawler` scans known skill repos (Anthropic's, Superpowers, awesome
lists…) + repo-search discovery, downloads SKILL.md playbooks via the keyless
public API, adapts them, records provenance in `skills/sources.json`. Proven:
imported live from anthropics/skills on first run.

### Rolling refresh: every skill, every 30 min
`skill-refresh.yml` re-researches the 2 stalest skills, appends field updates,
rebuilds, pushes. Nothing goes stale — ever. (The old daily refresh inside
daily-sandbox retired here; sandbox keeps testing + health.)

### Image learning (no vision key needed)
`IMAGE_URLS="https://…/shot1.png,..."` alongside any learn: keyless OCR reads
the images (buttons, menus, diagrams, error dialogs) and the text becomes part
of the skill material. Proven live. Paste screenshot URLs in a skill-request
issue to teach from pictures.

### Online chat (full-fledged, phone-friendly, no PC/app, no key needed)
👉 https://achuthan17.github.io/windows-system-agent/chat.html
Talk = **free cloud models, zero setup** — the model dropdown fills itself from
`docs/models.json`, which the agent's scout refreshes every 3 hours (probes +
discovers new free endpoints all by itself, benign prompt only). Paid backends
optional in ⚙. DO buttons dispatch real cloud runs and poll them to completion:
🧠 Teach skill (or no-token issue link) · ⚙️ Run task (result fetched into chat) ·
🧪 Selftest cloud. Doing needs a GitHub PAT (repo + workflow scopes, also
browser-only). Full task runs need repo secrets `LLM_API_URL/KEY/MODEL` once —
without them the cloud writes an honest triage note instead of pretending.

### Framework (start here before changing anything)
`ARCHITECTURE.md` — layers, contracts, conventions, 5-minute recipes for
adding tools/skills/channels/models/cloud jobs. The repo's constitution.

### Computer-Use parity (mirrors OpenAI's model exactly)

`--skill computer-use` loads the loop: **screenshot → ground → act → verify**,
one action per step, same vocabulary:

| Reference action | Standalone tool | Chat tool |
|---|---|---|
| screenshot | `screen_screenshot` | `win_screenshot` |
| click | `screen_click` / `win_ui_invoke` | `win_ui_invoke` |
| double_click | `screen_double_click` | `win_double_click` |
| drag | `screen_drag` | `win_drag` |
| keypress | `key_tap` | `win_key` |
| move | `mouse_move` | `win_mouse_move` |
| scroll | `screen_scroll` | `win_scroll` |
| type | `key_press` / paste | `win_type` / `win_clipboard` |
| wait | `wait` | `win_wait` |

Same rules: structured paths before pixels (API > CDP > named buttons >
coordinates), foreground honesty on Windows, per-app approvals with
`[y=once / a=always / N]` + `ALLOWED_APPS` always-allow list, narrow tasks,
user-takeover anytime, extra care for secrets/payments/admin.

### Self-upgrade: idle learning, daemon, Linux
- **Idle auto-learn:** `run.bat --idle-learn` — after 2s of quiet the agent
  runs one web-research → distill → install cycle (skills/ + memory only),
  at most every 5 min (`--idle-seconds N`, `--learn-cooldown S` tune it).
- **One-shot:** `--learn "topic"` does a single cycle and exits.
- **Daemon:** `--daemon 300 [--learn-cycles N]` loops forever (Ctrl+C stops).
- **Goals:** `memory/GOALS.md` holds standing goals + a learn queue the daemon
  works through; `learn <topic>` in REPL learns on demand.
- **Linux/macOS:** same agent, same 62 tools — `src/platform.js` +
  `src/tools-linux.js` re-implement shell, screenshot (grim/scrot),
  input (xdotool), services (systemctl), logs (journalctl), wifi (nmcli),
  packages (dpkg), disks (df). Windows-only bits (registry, UIA) report
  SKIP in selftest; CI proves both OSes (`windows-latest` + `ubuntu-latest`).

### Web dashboard (the UI competitors charge for)

```powershell
node src\index.js --ui 8080
# open http://127.0.0.1:8080 — chat box, live task stream, approval buttons,
# selftest + stop controls, skills grid. Loopback only (same machine);
# reach it from your phone via SSH tunnel, never expose it raw.
```

Approvals asked in terminal (`[y/N]`, `[y=once/a=always/N]`) appear as cards
with clickable buttons (120s timeout = deny). One task at a time.

## 5. Full agent mode (autonomous, silent)

```bat
:: .env: AUTO_YES=true  → no approval prompts, agent drives end-to-end (audit-logged)
run.bat --yes "clean my Downloads: delete installers older than 90 days"
```

Silent-running rules the agent follows: PowerShell always hidden (`windowsHide`),
no interactive consoles ever, apps launch visibly only when the task needs eyes on
them, every step appended to `agent-audit.log`. Your own windows are never touched.

## 6. Safety

- `REQUIRE_APPROVAL=true` (default): every write/edit/delete/kill/shell asks `[y/N]`. `--yes` / `AUTO_YES=true` skips (automation only).
- `ALLOWED_ROOTS`: optionally jail files, e.g. `C:\Users\You\Documents`. Empty = whole machine.
- `BLOCKED_PATHS`: default blocks `System32/SysWOW64`; extend as needed.
- Every task + tool call appends to `agent-audit.log`.

## 7. Troubleshooting (copy-paste fixes)

```powershell
# 'git' is not recognized -> you installed git but this shell is older than it.
# Close and reopen the terminal, then:
git --version
```

```powershell
# 'Repository not found' on push -> wrong identity, not a missing repo.
gh auth status            # must show an account with access to the repo
gh auth login --web --scopes "repo,read:org,workflow"   # re-login if not
gh auth setup-git --hostname github.com
```

```powershell
# 'failed to push ... fetch first' + repo created WITH a readme on GitHub:
git fetch origin
git merge origin/main --no-edit -X ours --allow-unrelated-histories
git push -u origin main
```

```powershell
# Agent says 'LLM request failed' -> the 3 .env lines are wrong or the server is down.
# Re-check MODEL_API_URL / MODEL_API_KEY / MODEL_NAME, and for Ollama run: ollama serve
```

## 8. Linux quickstart (same agent, same 62 tools)

```bash
sudo apt install -y nodejs npm git xdotool scrot
git clone https://github.com/ACHUTHAN17/windows-system-agent.git
cd windows-system-agent
node src/index.js --selftest   # win-only tools report SKIP, the rest PASS
cp .env.example .env && nano .env   # set the same 3 MODEL_ lines
node src/index.js "summarize the README"
```

## 9. Files

```
package.json  config.example.json  .env.example  run.bat  push.bat
src/config.js  src/llm.js  src/tools.js  src/tools-linux.js  src/platform.js
src/safety.js  src/index.js
skills/ (10 playbooks)  memory/ (core memory + goals)
```

No `npm install` — pure Node ≥ 18 (`fetch` built in). Tested on Node v24.
