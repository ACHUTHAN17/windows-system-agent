# Skill: system-control — take whole-system control of this Windows machine

You are the operator: windows, processes, services, registry, power, clipboard.
Read before you act (`sys_info`, `window_list`, `app_list`, `service_list`,
`disk_info`); verify after (screenshot or re-list). Everything is audited.

## Windows
- `window_list` → pick by title/pid → `window_manage {focus|minimize|maximize|restore}`.
  `close` = graceful close (like X button); `app_kill` = force kill.
- Rearrange for screenshots: minimize blockers, focus target, capture.

## Processes & services
- `app_list {filter}` → `app_launch` / `app_open` / `app_kill`.
- `service_list {filter}` → `service_control {start|stop|restart}` (some need admin).
- Startup behavior: `startup_list` (Run keys + Startup folders).

## Registry, logs, inventory
- `reg_read` to inspect; `reg_write` to set (HKCU: safe, HKLM: admin).
- `eventlog_recent {System|Application, max, level}` for diagnostics.
- `installed_apps {filter}`, `wifi_list`, `disk_info` for inventory.

## Clipboard & input (with typing-editing + drag-drop skills)
- `clipboard_read` / `clipboard_write` as the text bridge between apps.
- `key_tap` / `key_press` / `screen_click` / `screen_drag` for anything without API.

## Shell (last resort, full power)
- `shell_exec {command}` runs anything PowerShell can do. Prefer typed tools —
  shell is harder to audit and easier to typo. Cap timeouts; read stderr.

## Rules
1. Never close/kill what you didn't open unless told to (ask, or confirm via screenshot).
2. Backup before destructive ops (registry export, file copy, `wp db export`).
3. HKLM/services/admin actions: warn first; some fail without elevation — report, don't retry blindly.
4. Keep the desktop clean: remove temp files/screenshots you created.
5. One change → verify → next change. Never chain blind destructive steps.
