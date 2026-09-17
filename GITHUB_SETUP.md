# GitHub setup — push every update to @ACHUTHAN17

## One-time setup (5 min, in your Edge browser + one install)

1. **Create the repo** (no CLI needed):
   - Open https://github.com/new — name: `windows-system-agent`,
     visibility: your choice, **don't** add README/license (we have them).
2. **Install git** (once): `winget install Git.Git` in a terminal,
   or GitHub Desktop from https://desktop.github.com/
3. **First push**: open this folder in a terminal and run:
   ```bat
   git remote add origin https://github.com/ACHUTHAN17/windows-system-agent.git
   push.bat "v1.3.0 initial"
   ```
   Sign in with GitHub when asked (use a **Personal Access Token** as password:
   GitHub → Settings → Developer settings → Tokens (classic) → `repo` scope).

## Every update after that
```bat
push.bat "describe the change"
```
That's it — add/commit/push in one step. CI runs syntax + selftest on Windows.

## Let the agent do it (recommended)
Give the agent your token once and it pushes after every change it makes —
no terminal needed. Tokens live only in your local Windows Credential Manager,
never in the repo (`.gitignore` blocks `.env`/`config.json`/logs).
