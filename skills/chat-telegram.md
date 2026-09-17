# Skill: chat-telegram — the agent in your pocket (ChatGPT-mobile parity)

Talk to the agent from your phone like ChatGPT mobile: message → it works →
it replies + notifies on completion. No GitHub issue needed for quick tasks.

## Setup (2 min, once)
1. Telegram → @BotFather → /newbot → copy the token.
2. `.env`: `TELEGRAM_TOKEN=1234:abc...` (optional: `TELEGRAM_ALLOW_FROM=<your-chat-id>`,
   else the first chat to message becomes the locked owner).
3. Run: `node src/index.js --chat telegram` (keeps running = keeps listening).

## Behavior
- One message = one bounded task (`maxSteps` applies); replies chunked at 4000.
- `/new` fresh context · `/selftest` health check · `/stop` shutdown · `/help`.
- Per-chat memory (`memory/chat-<id>.md`, last 30 lines reloaded) — it
  remembers YOUR thread, strangers get "Not authorized".
- Approvals still fire: without AUTO_YES a destructive step ASKS — answer in
  the terminal, or run `--yes` for full-agent (audit-logged).

## Rules
- Token = password: `.env` only, never chat/logs/repo (gitignored).
- Strangers can't drive it (owner lock); don't forward bot messages with secrets.
- Long jobs: ask for progress ("status?") — or use `--every`/daemon + check back.
