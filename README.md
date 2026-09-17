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

## 1. Run (2 min)

```bat
cd C:\Users\ADMIN\Documents\windows-system-agent
copy .env.example .env
notepad .env        :: set MODEL_API_URL / KEY / NAME for your provider
run.bat "list files in Documents and tell me the 3 largest"
```

Other modes:

```bat
run.bat                                  :: interactive REPL (model, tools, selftest, exit)
run.bat --selftest                       :: hardware check, no LLM needed
C:\Users\ADMIN\.pawwork\dsh\.tools\node.cmd src\index.js "open notepad" --yes
C:\Users\ADMIN\.pawwork\dsh\.tools\node.cmd src\index.js --model llama3.1 --url http://localhost:11434/v1 "kill notepad"
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

## 3. Tools (50)

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
`file-fetch-upload` (locked files + uploads), `computer-use` (see below).
Add your own: any `skills/<name>.md` works the same way.

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
- `ALLOWED_ROOTS`: optionally jail files, e.g. `C:\Users\ADMIN\Documents`. Empty = whole machine.
- `BLOCKED_PATHS`: default blocks `System32/SysWOW64`; extend as needed.
- Every task + tool call appends to `agent-audit.log`.

## 5. Files

```
package.json  config.example.json  .env.example  run.bat
src/config.js  src/llm.js  src/tools.js  src/safety.js  src/index.js
```

No `npm install` — pure Node ≥ 18 (`fetch` built in). Tested on Node v24.
