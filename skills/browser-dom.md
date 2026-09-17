# Skill: browser-dom — drive pages by structure, not pixels (Gemini-style)

CDP tabs expose the DOM: query it, click/select/fill by selector, fall back to
coordinates only when the page has no structure (canvas, games).

## Flow (debug browser first: `browser_debug_launch`, own profile, port 9222)
1. `browser_dom {port, tab}` — accessibility snapshot: buttons/links/inputs
   with index, tag, text, x/y/w/h. Add `selector` to narrow (any CSS).
2. `browser_click_sel {port, tab, selector, index?}` — synthetic `.click()`
   (no coordinates, no miss). Reports what it clicked.
3. `browser_fill_sel {port, tab, selector, value, submit?}` — focuses, sets
   value, fires input+change events (React-safe). `submit:true` presses Enter.
4. Verify with `browser_tab_read` / `browser_screenshot`, never assume.

## Rules
- Structure first, pixels last: selector → UIA → coordinates.
- Indexes shift after navigation — re-run `browser_dom` per page.
- Logins/payments: stay present, one step at a time, staging before production.
