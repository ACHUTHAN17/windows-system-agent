# Skill: github — push itself, multi-account auth, device flow (researched live)

Self-learned from GitHub docs + DevErrors + cli/cli (see memory note). This is
how the agent pushes ITSELF to GitHub and survives multi-account machines.

## Identities first (multi-account machines lie)
- `git credential fill` (protocol=https host=github.com, username line only)
  shows WHO pushes actually authenticate as. Committer name/email prove nothing.
- HTTPS + wrong cached account → `Permission to o/r denied to other-user`
  (or 404 on private repos you can't see). Fix = right identity, not retries.

## Push itself (the routine, every time)
1. `git add -A` → `git commit -m "vX.Y.Z ..."` (skip if tree clean).
2. `git push -u origin main` with prompts disabled (`GIT_TERMINAL_PROMPT=0`).
3. Classify failure, don't retry blind:
   - `Repository not found` → missing repo OR no access (private hides both).
     Ask owner for collaborator (Settings → Collaborators) or check the name.
   - `Permission denied to <user>` → cached wrong account: collaborator invite,
     or switch identity (credential erase + re-login, or `gh auth login`).
   - prompts/hangs → auth missing: device flow below.

## Device flow (headless/agent login — the OTP pattern)
1. Background it, log to file: start `gh auth login --web` detached (or with
   `GH_BROWSER=false`), log stdout to a temp file.
2. Read the log → one-time code + `https://github.com/login/device`.
3. Human enters the code in THEIR browser (already logged in = 20 seconds).
4. Poller detects authorization, saves token automatically. Verify:
   `gh auth status` AND wire git: `gh auth setup-git --hostname github.com`,
   then `git ls-remote <private-url> HEAD` must print a hash (both layers!).
5. Token stays in OS credential store, never in chat/logs/repo.

## Rules
- Secrets never touch logs, skills, memory, or the repo (gitignored).
- Prefer `gh` for repo ops (create/view/pr), raw git for push/pull.
- After ANY auth change: re-verify both layers before pushing.
- Push discipline: meaningful messages (`vX.Y.Z what+why`), push after every
  completed change set, confirm remote SHA moved.
