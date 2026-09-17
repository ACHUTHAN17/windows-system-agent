# Skill: typing-editing — type, edit text and drive inputs anywhere on Windows

Text entry without a DOM: keyboard injection + clipboard. Needs an interactive
desktop; the target window must be focused first (`window_focus` / `window_manage`).

## Typing
- `key_press {text, enter}` — types literal text (auto-escapes SendKeys specials).
  Check the active window FIRST via screenshot; a wrong focus sends keystrokes astray.
- `key_tap {key, modifiers}` — special keys: Enter Tab Esc Backspace Delete
  Up Down Left Right Home End PgUp PgDn F1..F12 Space, plus Ctrl/Alt/Shift combos
  (`{key:'S', modifiers:'Ctrl'}` = save, `{key:'Tab'}` = next field).
- Combos: `clipboard_write {text}` + `key_tap {key:'V', modifiers:'Ctrl'}` pastes
  long/Unicode text reliably (typing Tamil or code? prefer paste over keystrokes).

## Editing files (no UI needed — prefer this over Notepad)
- Read first: `file_read`. Small fix: `file_edit {path, oldString, newString}`.
- Rewrite: `file_write {path, content}` (creates parents). Backup first:
  `file_copy {from, to}` with a `.bak` suffix for anything important.

## Editing inside apps (wp-admin, forms, docs)
1. Screenshot → confirm focus + caret position.
2. Select-all only when sure: `key_tap {key:'A', modifiers:'Ctrl'}` (destructive if
   followed by typing — prefer targeted edits).
3. Navigate by keyboard: Tab/Shift+Tab between fields, arrows in text.
4. Verify with a second screenshot or `clipboard_read` (select-all + copy + read
   back text without touching files).

Safety: typing is INPUT-INJECTING (approval unless AUTO_YES). Never type passwords
from chat into fields unless the user explicitly asked; prefer pasting secrets from
`.env`. Always confirm focus with a screenshot before any keystroke run.
