# Skill: agent-overlay — system-wide glowing corners + agent mouse (Astra/Perplexity style)

System-wide overlay that only appears when the agent is actually working (file/system access), not when idle or human is using the PC. No human mouse is shown — only the agent's pointer.

## What it is
- **Native WPF overlay** (`system-overlay-agent.ps1`): fullscreen transparent `Topmost + WS_EX_TRANSPARENT` (click-through) window covering the primary screen. Shows 4 glowing corners + top pill + agent dot, system-wide (over Explorer, Edge, desktop — not just PawWork).
- **PawWork pill** (`astra` Cordis plugin `shell.overlay`): same 4 corners + pill inside PawWork, auto-hides when `overlay-agent.json` `active:false`. Polls the same JSON every 350ms.

Both read `overlay-agent.json`:
```json
{ "active": true, "x": 960, "y": 540, "action": "click|drag|type|file", "target": "File Explorer", "text": "WinAgent is working", "sub": " • file access", "ripple": true }
```
`active:false` → completely hidden (no glow, no dot) — idle/human mode.

## Files
- `system-overlay-agent.ps1` — WPF window, polls `overlay-agent.json` every 120ms, pulsing corners, agent dot + ripple + label
- `launch-overlay.vbs` — hidden launcher (`wscript //nologo launch-overlay.vbs`) — use this, not direct `powershell -WindowStyle Hidden` (WPF needs hidden console via VBS like `WinAgent.vbs`)
- `overlay-agent.json` — flag file (auto-created). `active` controls visibility.
- `overlay-control.js` — helper: `node overlay-control.js show|hide|click x y [label]|drag x y|type x y`
- `overlay-state.json` — legacy (kept for compat)
- `system-overlay.ps1` — older full-border version (kept, fixed `xmlns:x`)

## Usage
```powershell
# Start system-wide overlay once (double-click also works):
wscript "C:\Users\HP\windows-system-agent\launch-overlay.vbs"
# or:
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\HP\windows-system-agent\system-overlay-agent.ps1"

# Control (both native + PawWork pill sync):
node overlay-control.js show "WinAgent is working" " • opening File Manager"
node overlay-control.js click 960 540 "File Explorer"   # agent click with ripple
node overlay-control.js drag 800 500
node overlay-control.js type 400 300
node overlay-control.js hide   # idle → hides everywhere

# File Manager demo:
node overlay-control.js show "WinAgent is working" " • opening File Manager"
Start-Process explorer.exe
node overlay-control.js click 960 540 "File Explorer"
# ... do work ...
node overlay-control.js hide
```

## Wire to WinAgent (auto)
Patch `src/tools.js` / `src/index.js` to wrap file/app/shell tools:
```js
import fs from 'node:fs';
function overlayShow(action,x,y,target){
  try{ fs.writeFileSync('C:/Users/HP/windows-system-agent/overlay-agent.json', JSON.stringify({active:true,x,y,action,target,text:'WinAgent is working',sub:' • '+action,ripple:action==='click'})); }catch{}
}
function overlayHide(){ try{ fs.writeFileSync('C:/Users/HP/windows-system-agent/overlay-agent.json', JSON.stringify({active:false,x:0,y:0,action:'',target:'',text:'WinAgent is working',sub:' • idle',ripple:false})); }catch{} }
```
Call `overlayShow` before each `file_*`/`app_*`/`shell_exec`/`screen_click` and `overlayHide` after. Or run `WinAgentApp/WinAgent.vbs` with auto-start of `launch-overlay.vbs`.

## Behavior (as requested)
- Only `active:true` → corners + pill + agent dot visible system-wide
- `active:false` → fully hidden (human working / idle)
- No human mouse tracking — only agent `x,y,action` from JSON
- 4 corners (not full border): TL purple, TR cyan, BL emerald, BR purple, pulsing 0.82↔1.0
- Agent dot: green `click`, purple-dashed `drag`, amber `type`, cyan `file`
