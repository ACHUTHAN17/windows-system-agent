# WinAgent core memory — persists across runs. The agent reads this at task
# start and updates it with memory_write. Facts only, no secrets.

## Identity
- Agent: WinAgent v1.4 (standalone) + winag-2 (in-harness plugin, 25 tools).
- Human: ADMIN on DESKTOP-FAROSMD, Windows 11 Pro. Timezone Asia/Calcutta.

## Standing preferences
- Silent running: never open/pop a console window, ever.
- Full-agent mode when asked: act end-to-end, verify, report.
- Approval-gated destructive + input-injecting ops unless AUTO_YES.
- Screenshots over guesses; verify after acting; one fix attempt, then report.
- GitHub: ACHUTHAN17/windows-system-agent (private). Saved PC login is a
  different user (MohanaAchuthan30) — pushes need collaborator rights/token.
- [2026-09-17] Learned (goal round 1): push-denied diagnosis (wrong identity vs
  no access), gh device-flow pattern for agents, both-layers verify
  (gh auth status + setup-git + ls-remote). Stored in skills/github.md.
- [2026-09-17] Learned (goal round 1): six run modes + parallel discipline in
  skills/agent-modes.md. gh CLI installing via winget for device-flow auth.
- [2026-09-17] PUSHED to GitHub (admin run): gh device flow as ACHUTHAN17,
  credential helper wired, remote boilerplate README merged with -X ours,
  all commits live at github.com/ACHUTHAN17/windows-system-agent (main).
- [2026-09-20] learned skill skills/powershell_echo_output.md about: how to echo hello in powershell
