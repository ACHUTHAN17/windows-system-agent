# Skill: agent-modes — run modes and how to work them in parallel

WinAgent is one brain with six bodies. Pick per task; combine for speed.

## Modes
1. **Interactive REPL** (`run.bat`, no args): back-and-forth, approvals inline.
   Commands: `model tools skills memory goals learn <topic> selftest exit`.
2. **One-shot task** (`run.bat "do X" [--yes] [--skill a,b]`): single task, exits.
   `--yes`/`AUTO_YES=true` = full-agent mode (no prompts, audit-logged).
3. **Idle-learn** (`--idle-learn [--idle-seconds 2] [--learn-cooldown 300]`):
   quiet REPL auto-runs self-upgrade cycles. For foreground sessions.
4. **Daemon** (`--daemon 300 [--learn-cycles N]`): headless forever-loop of
   learn cycles (research → distill → install to skills//memory). For nights.
5. **Learn once** (`--learn "topic"` or REPL `learn <topic>`): single guided
   research→install cycle, then exit. For explicit study orders.
6. **Full-agent** (any mode + `--yes`): end-to-end, no prompts. Default for
   automation; never for first contact with destructive targets.

## Parallel learning + executing (the time-saver)
- Same turn, independent calls TOGETHER: research + probes + reads in one batch
  (one round-trip instead of five). Never batch dependents (read-after-write).
- Long + short: start the slow job (installs, scrapes, daemon cycles) FIRST in
  background, do quick tasks meanwhile, collect slow results last.
- Daemon + REPL: daemon learns in background while REPL serves tasks; both
  share `skills/` + `memory/` (files are the bus — re-read before use).
- Learn-while-blocked: when a push/deploy waits on a human (OTP, approval,
  collaborator), spend the wait on queued learning, never idle-spin.
- Cap it: 2-4 concurrent tracks max; one writer per file; verify each track
  separately before reporting.

## Which mode when
- Unknown domain → `--learn` first, then the task.
- User present + chatting → REPL (+`--idle-learn` for free upgrades).
- User away + goals queued → `--daemon`.
- Scripted pipelines → one-shot + `--yes` + audit review after.
- New machine → PAWWORK.md protocol, then selftest, then serve.
