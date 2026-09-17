# Changelog

## 1.6.0 — 2026-09-17
- GitHub-first skills: `SKILL_SOURCE=auto` fetches playbooks live from the repo
  every run (local fallback offline); `SKILL_TOKEN` for private repos.
- Live library page: `node src/build-docs.js` generates `docs/index.html`
  (10 skills, auto-learned badges, search filter).
- Copy-paste-proof README + gh-first GITHUB_SETUP (verified by fresh clone).

## 1.5.0 — 2026-09-17
- Idle autonomy: `--idle-learn` (2s quiet trigger), `--learn`, `--daemon`,
  `learn <topic>` REPL command, `memory/GOALS.md` + learn queue, 5-min cooldown.
- Self-upgrade engine: research → distill with own model → install to
  skills//memory only (src/ never touched autonomously).
- Linux/macOS support: `src/platform.js` + `src/tools-linux.js` (shell,
  screenshot, xdotool input, systemctl, journalctl, nmcli, dpkg, df, CDP);
  same 55 tools everywhere; win-only calls SKIP; CI on ubuntu + windows.
- Per-app approvals `[y/a/N]` + `ALLOWED_APPS` (Computer-Use parity).

## 1.3.0 — 2026-09-17
- In-harness plugin `winag-2` v8: **20 tools** — full human skill set
  (buttons/UIA, typing, keys, edit, drag, windows, clipboard, sudo, silent shell).
- Silent runner: every call hides its own console (no PowerShell popups, ever).
- Standalone: 45 tools (`screen_drag`, `window_manage`, `clipboard_write`, `key_tap`,
  `web_fetch`, `web_post` + all previous).
- Skills: wordpress-build, typing-editing, drag-drop, system-control, uia-click.
- Windows app: `WinAgentApp/` (silent VBS launcher + menu + version).
- Repo files: LICENSE, CHANGELOG, CONTRIBUTING, CI, push.bat, GITHUB_SETUP.

## 1.2.0
- Skills system (`--skill`, `SKILLS`, REPL `skills` command) + wordpress-build.
- Web tools for REST automation.

## 1.1.0
- A. screen control, B. CDP browser autopilot, C. deep system tools.

## 1.0.0
- Core agent: files, apps, shell, sysinfo + pluggable API/local/custom LLM.
