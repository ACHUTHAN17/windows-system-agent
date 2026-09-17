# Skill: schedule — recurring + event-driven tasks (ChatGPT-Schedules parity)

Three schedulers, pick by need. All re-read skills + memory each run.

## 1. Local interval (`--every`, this machine, offline OK)
`node src/index.js --every 30 "summarize new files in Downloads" [--repeat 3] [--yes]`
Runs now, then every N minutes (min 1). `--repeat` caps runs (testing).
Good for: reminders, folder watches, heartbeat checks.

## 2. Cloud daily (GitHub runners, no PC)
`.github/workflows/daily-sandbox.yml` — 03:00 UTC: selftest matrix,
stalest-skill refresh, docs rebuild+push, page check, health issue on failure.
Manual: Actions → daily-sandbox → Run workflow (opt skill name).

## 3. Event triggers (GitHub-native, ChatGPT-webhook parity)
`.github/workflows/learn-skill.yml` — a `skill-request` issue IS the trigger:
request → research → install → reply. Same pattern extends to any repo event
(push/PR/label) with a small workflow. Gmail/Slack events need their MCP
servers + a poller task (see skills/mcp.md connectors + `--every`).

## Rules
- Scheduled = unattended: prefer read-only; destructive needs AUTO_YES +
  audit review after (see agent-audit.log), ChatGPT's approval_policy=never
  equivalent — use sparingly, scope tightly.
- One writer per file; idempotent tasks (re-runs must be safe).
- Durable prompt: each run starts cold — put context in skills/memory, not chat.
