# Data map — every persistent store in WinAgent, what's in it, who touches it

This is the inventory ARCHITECTURE.md's diagrams point at. Three trust zones, left to
right as data gets more sensitive: **public repo** (committed, anyone with repo access
can read it) → **local engine state** (one machine, gitignored) → **desktop per-user
state** (one Windows user profile, outside the repo entirely).

## 1. Public repo (committed to `ACHUTHAN17/windows-system-agent`)

| Path | Format | Written by | Read by | Notes |
|---|---|---|---|---|
| `skills/*.md` | Markdown playbook | `skill-crawler.js`, `agent-learn.js`, `tool_create`-adjacent flows, manual commits | `loadSkills()`/`skill_load` tool (every agent run) | The agent's instruction library. Inert text — safe to auto-import because it can only mislead the model, never execute |
| `skills/index.json` | JSON array `{name,title,description,origin,triggers}` | `build-docs.js`, crawlers | `loadCatalog()`/`autoPick()` every run | Routing index so the model doesn't need every skill's full text in context |
| `skills/sources.json` | JSON map `filename -> {origin,repo,file,at}` | `skill-crawler.js` | humans auditing provenance | Where each imported skill came from |
| `tools-imported/candidates/*.js` | JS (tool-contract shaped) | `tool-crawler.js` (GitHub search), `tool-web-scout.js` (web search) | **nobody automatically** | Staged code from the internet. Never loaded, never executed — `tools-imported/README.md` explains the manual promotion step. This is the one place "found on the internet" and "committed to the repo" overlap; treat accordingly |
| `tools-imported/candidates/sources.json` | JSON map | same two crawlers | humans | `found_via: github-search \| web-search`, plus the query that found it |
| `tools-imported/self-authored/*.js` | JS (tool-contract shaped) | `tool_create` tool (written by the agent itself, mid-task) | `src/index.js` auto-loads at startup (same mechanism as MCP tools) | **This one DOES auto-load.** It's code the agent wrote for *itself*, not fetched from a stranger — see ARCHITECTURE.md for the trust reasoning |
| `memory/MEMORY.md` | Markdown bullets | `memory_write` tool | injected into every system prompt (`loadMemory()`) | Core long-term memory, 6000-char slice per run |
| `memory/SELF.md` | Markdown bullets, capped to last 60 | `src/self-log.js`, called from crawlers/`tool_create`/`model-scout.js` | injected into every prompt, `self_status` tool | The agent's own "what have I learned/built" log |
| `memory/GOALS.md`, `memory/learn-queue.md` | Markdown | manual + `popLearnQueue()` draining `GOALS.md`'s `## Learn queue` section | `learnCycle()` | What the autonomous learning loop works through next |
| `memory/skill-health.md` | Markdown report | `agent-act.yml`'s hourly audit | humans | Structure/link-health check across all skills |
| `memory/<topic>.md` | Markdown | `memory_write` with a topic arg | `loadMemory()` (first 10, 3000 chars each) | Freeform topic notes |
| `docs/index.html` | Generated HTML | `build-docs.js` | GitHub Pages (public website) | Skill/tool counts + browsable list |
| `docs/chat.html` | Static HTML/JS | hand-written | GitHub Pages — the **web chat** entry point | Dispatches `agent-task.yml`/`learn-skill.yml` via the GitHub Actions API using a PAT the visitor supplies and keeps in their own browser's `localStorage` only |
| `docs/models.json` | JSON `{updated,live[],candidates[]}` | `model-scout.js` | `src/config.js`'s `loadScoutedModels()`, desktop's model popover | Free keyless models the scout has verified live, fastest first |
| `runs/<run_id>.md` | Markdown transcript | `agent-task.yml` (one commit per web-chat task) | humans browsing history | Audit trail for every task run via the web chat / Actions |
| `.github/workflows/*.yml` | YAML | hand-written | GitHub Actions | The schedule: `repo-crawl` (daily), `curiosity`/`skill-refresh` (5/30 min), `agent-act` (hourly), `model-scout`, `agent-task`/`learn-skill` (on demand) |

## 2. Local engine state (one machine, never committed — see `.gitignore`)

| Path | Format | Written by | Read by | Notes |
|---|---|---|---|---|
| `.env` / `config.json` | dotenv / JSON | human | `src/config.js` at `createEngine()` time | Model keys, `ALLOWED_ROOTS`, `BLOCKED_PATHS`, GitHub token for skill-source, etc. |
| `agent-audit.log` | newline log | `audit()` in `safety.js`, every tool call and approval decision | humans | The forensic trail — "what did the agent actually do" |
| `self-improvements/*.json` | JSON `{targetFile,rationale,newContent,status}` | `self_improve_propose` tool | `desktop/lib/self-improve.js` (if enabled) | Proposed rewrites of the engine's **own** source. Never applied to the running engine — see §3 |
| `generated/*.png` | PNG | `image_generate` tool | chat UI (via `[[image:path]]` marker) | Not gitignored by name but typically local-only; the desktop app never syncs it anywhere |

## 3. Desktop app per-user state (`%APPDATA%\WinAgent\`) — outside the repo entirely

```
%APPDATA%\WinAgent\
├─ settings.json          — model config, GitHub token (DPAPI-encrypted), all toggles
├─ sessions.json          — chat history (client-side only, never leaves the machine)
└─ agent\                 — the SEEDED, WRITABLE engine copy (ensureAgentDir in lib/agentdir.js)
   ├─ src\, package.json  — refreshed on every app version bump, never hand-edited
   ├─ skills\, docs\, memory\  — seeded once, then ONLY ADDED TO by lib/sync.js (merge,
   │                              never overwrite — your own memory notes always survive)
   ├─ uploads\            — 📎/drag-drop/paste attachments, PER-USER, never synced anywhere
   ├─ generated\          — images from image_generate, same as above
   ├─ tools-imported\self-authored\  — tools created via tool_create in this app; can be
   │                                    pushed to the repo's `agent-learned` branch if enabled
   ├─ self-improvements\  — same as §2, staged here; can become a GitHub PR if enabled
   ├─ .bundle-version     — last-seeded engine version (triggers a refresh on app update)
   ├─ .sync-state.json    — last-synced GitHub blob SHA per file (lib/sync.js)
   └─ .push-state.json    — last-pushed content hash per file (lib/github-push.js)
```

`settings.json`'s shape (`lib/settings.js`): model preset/provider/URL/model name, the API
key (`apiKeyEnc`, DPAPI via Electron's `safeStorage`, falls back to plaintext only if DPAPI
is unavailable), `allowedRoots`, `fullAuto`, hotkey, tray/startup flags, sync toggles,
`githubRepo`/`githubPatEnc`/`autoPushLearned`/`autoSelfImprove`, `useScoutedModels`,
`readAloud`. **Never** written to a `.env` file — injected into the embedded engine as
process-env-shaped values only for the duration of one run (`Settings.agentEnv()`).

## What never gets written anywhere (by design)

- A GitHub token typed into the web chat (`docs/chat.html`) lives only in that browser
  tab's `localStorage` — never sent anywhere except directly to `api.github.com` from the
  visitor's own browser.
- Nothing from `tools-imported/candidates/` is ever copied into `tools-imported/self-authored/`
  automatically — promotion is a human reading the code first (`tools-imported/README.md`).
- The desktop app's `lib/sync.js` explicitly refuses to pull `tools-imported/`, `.env`, or
  `config.json` from GitHub under any setting — code from the cloud side must never
  auto-arrive and auto-run on a user's PC.
- Nothing is ever merged into `main` by automation except the daily crawlers' own findings
  (skills, staged candidates, the model registry) and the desktop's `agent-learned` branch
  (which is a branch, not `main`). A self-improvement proposal becomes a **pull request**,
  never a direct commit to `main` — see ARCHITECTURE.md's "Self-awareness & self-improvement"
  section for why that line doesn't move.
