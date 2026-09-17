# Skill: drag-drop — mouse drags, sliders, selections, drag-and-drop on Windows

`screen_drag {x1,y1,x2,y2}` moves with the left button held, in smooth steps.
All coordinates are screen pixels — get them from `screen_size` + screenshots.

## Workflow (every drag)
1. `screen_size` once per session (1536x864 here; re-check after display changes).
2. Screenshot → identify source (grab point) and target (drop point).
3. `window_focus` the right app first so the drag lands in the right window.
4. `screen_drag` with source→target. Re-screenshot to verify the drop.
5. If the drop missed, adjust by the observed offset and retry ONCE, then report.

## Uses
- File drag-and-drop (Explorer → upload zone, app to app).
- Sliders / volume / timeline scrubbing (short horizontal drags).
- Text selection: drag across the text, then `key_tap {key:'C', modifiers:'Ctrl'}`
  or `clipboard_read` to capture it.
- Canvas/diagram editors, map panning, image cropping handles.

## Precision tips
- Grab interactive handles by their CENTER (checkboxes, thumbs, grips).
- Short drags (<100px) for sliders; `steps: 20` for smooth long drags.
- If the page scrolls instead (wheel capture), click the canvas once first
  (`screen_click`) to focus it, then drag.
- DPI: if clicks land offset, the display scale changed — re-run `screen_size`
  and scale coordinates accordingly.

Safety: drags are INPUT-INJECTING (approval unless AUTO_YES). Never drag files
into destructive zones (Recycle Bin, close buttons) without explicit instruction.
