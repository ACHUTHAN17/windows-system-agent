# Skill: uia-click — trigger ANY button by name (no coordinates, no focus tricks)

Windows exposes every button to UI Automation. Prefer this over `screen_click`
whenever the target is a real button/link/menu/tab — it cannot miss.

## In-harness plugin tools (winag-2)
- `win_ui_list {window, max}` — list buttons/links/tabs with names, enabled state,
  on-screen rects. Find the exact target name first.
- `win_ui_invoke {window, name, control}` — press it: Invoke for Button/Hyperlink,
  Select for ListItem/TabItem (steppers like Media>Text>Creative generation),
  Toggle for CheckBox. Reports what fired.

## Standalone agent pattern (PowerShell, PS 5.1-safe — no ternary!)
```powershell
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$w = Get-Process <proc> | Where-Object { $_.MainWindowTitle -like '*<part>*' } | Select-Object -First 1
$root = [System.Windows.Automation.AutomationElement]::FromHandle($w.MainWindowHandle)
$all = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.PropertyCondition]::TrueCondition)
foreach ($e in $all) {
  if ($e.Current.Name -like '<name>*' -and $e.Current.ControlType.ProgrammaticName -eq 'ControlType.Button') {
    $e.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
  }
}
```

## Loop until complete (the "no matter what" pattern)
1. List states (names + enabled + rects) → pick target.
2. Invoke → wait 1-2s → re-list: did the target disappear/change? Did the window
   title or step selection change? Screenshot for visual proof.
3. If nothing changed: try the NEXT match (duplicates exist), then SelectItem on
   nearby ListItems, then coordinate click on the reported rect center as fallback.
4. Never Invoke anything destructive-looking (Delete/Remove/Publish/Close) unless
   the task explicitly names it.

Notes: enumeration of big pages (Facebook, Sheets) takes 30-90s — set generous
timeouts. Rects are PHYSICAL pixels; screenshots may be scaled — convert by the
display scale before coordinate clicking. Skip windows with no MainWindowHandle.
