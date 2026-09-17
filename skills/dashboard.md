# Skill: dashboard — the web UI (chat, live stream, click-to-approve)

`node src/index.js --ui 8080` → open http://127.0.0.1:8080 (loopback only).
The page drives the agent as a child process and answers its approval prompts
from the browser — the agent core is untouched.

## What you get
- **Chat box**: type any task, Send runs it `--once` (one task at a time).
- **Live stream**: every stdout line, color-coded (approvals amber, errors red,
  passes green). Auto-scrolls; ring buffer keeps the last 200 events per load.
- **Approval card**: pops up on `[y/N]` / `[y=once/a=always/N]` prompts with
  real buttons (once / always / deny). 120s timeout = deny. No terminal needed.
- **Selftest + Stop buttons**, skills grid, model pill, MCP status pill.

## Rules
- Loopback only: same-machine browsers. To reach it from your phone, use an
  SSH tunnel (`ssh -L 8080:127.0.0.1:8080 <this-pc>`) — never expose it raw.
- Approvals still default-deny on timeout; AUTO_YES tasks skip prompts entirely.
- One task at a time (409 busy otherwise). Daemon/idle modes stay in terminal.
