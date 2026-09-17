# Contributing to windows-system-agent

## Add a tool (standalone)
1. Append an entry in `buildTools()` in `src/tools.js`:
   `{ name, description, args, async run(a, ctx) }` returning `ok({...})`/`fail(...)`.
2. Read-only tools return data; world-changing tools go in `DESTRUCTIVE` in `src/safety.js`.
3. Test: `node src/index.js --selftest` + a live call. Keep zero dependencies.

## Add a skill
1. Write `skills/<name>.md` (playbook: when, steps, tool names, safety).
2. Load with `--skill <name>` or `SKILLS=<name>` in `.env`. Verify in selftest output.

## Add an in-harness tool (winag-2 plugin)
1. Mirror the tool in the plugin source with `reg({...})` using `runPS`.
2. Only these Layer-1 escapes: `\\'` → `'`, `\\\"` → `"` at runtime. No other backslash-quote combos.
3. PowerShell 5.1-safe code (no ternary `?:`, no `??`).
4. `cordis_define` (kind existing, `winag-2`) → `cordis_run update` → test live.

## Release
Update `WinAgentApp/version.txt` + `CHANGELOG.md`, run `push.bat "vX.Y.Z"`.
