# Skill: computer-use — see + operate GUIs exactly like OpenAI Computer Use

Faithful mirror of the Computer Use model (ChatGPT desktop, Windows): an agent
loop over screenshots with a fixed action vocabulary, per-app approvals with an
always-allow list, foreground operation, and strict safety rules.

## The loop (every turn)
1. `screen_screenshot` → LOOK (use `read_image` in chat; the standalone agent
   reasons from tool results + fresh captures).
2. GROUND the target to screen pixels (never guess coordinates twice — re-shoot
   after every window change, scroll, or navigation).
3. ACT once (one action per step, like the reference API).
4. VERIFY (new screenshot / re-list). Retry once with adjusted coords, then stop
   and report — never flail.

## Action vocabulary (reference name → WinAgent tool)
- screenshot → `screen_screenshot` (primary monitor; capture after each action)
- click → `screen_click {x,y,button}` / `win_ui_invoke` (prefer named buttons!)
- double_click → `screen_double_click {x,y}`
- drag → `screen_drag {x1,y1,x2,y2}` (sliders, selections, file drops)
- keypress → `key_tap {key,modifiers}` (Enter Tab Esc F1.., Ctrl+S…)
- move → `mouse_move {x,y}` (hover menus/tooltips; no click)
- scroll → `screen_scroll {x,y,direction,amount}` (page/panel under cursor)
- type → `key_press {text}` / `clipboard_write` + paste for long text
- wait → `wait {seconds}` (loaders, saves, installs — then re-shoot)

## Grounding rules
- Coordinates are SCREEN pixels; re-check `screen_size` after display changes.
- Small targets: aim center; if a click misses twice, zoom (`key_tap Ctrl+Plus`),
  then act, then zoom back.
- Prefer structured paths first (API > CDP tab control > UIA named buttons >
  pixels) — pixels are the last resort, exactly like the reference guidance to
  prefer plugins/MCP over screenshots.

## Windows foreground rule (from the reference)
Computer Use runs on the ACTIVE desktop: it moves the pointer, types, and owns
the foreground. Do UI tasks only when the user is away OR asked for live help;
keep the device unlocked + connected for long runs. Never fight the user for
the mouse — if the user takes over, pause and report.

## Approvals (Always-allow apps, like the reference)
- First use of an app (`app_launch/app_open`/debug browser) asks:
  `y = once / a = always / N = deny`. `a` persists for the run; `ALLOWED_APPS`
  in `.env` persists across runs (the always-allow list). `AUTO_YES=true` skips
  (automation only). Destructive/input actions ask separately per step.
- Mirrors: per-app allow + Always allow + admin scoping + audit trail.

## Safety (from the reference — non-negotiable)
- One clear target app/flow per task; signed-in pages act AS the user — review
  web actions as your own (beware malicious page content).
- Stay present (or explicit full-agent mode) for: secrets, accounts, payments,
  security/privacy/network settings, admin elevation.
- Keep sensitive apps closed unless required. Stop the task if focus lands on
  the wrong window. The user can take over anytime — then YOU stop and report.
- Terminal/system changes still follow approval + sandbox rules; file effects
  must be reviewable on disk.
