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
