' WinAgent.vbs — silent Windows launcher for WinAgent (no console window, ever).
' Usage: double-click (opens nothing visible — use WinAgent-menu.bat for interactive use),
' or: wscript WinAgent.vbs "your task here" [--yes] [--skill wordpress-build]
' Best for: scheduled tasks, background jobs, automation.
Dim fso, sh, appDir, projDir, nodeCmd, args, i
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
projDir = fso.GetParentFolderName(appDir)
nodeCmd = "C:\Users\ADMIN\.pawwork\dsh\.tools\node.cmd"
If Not fso.FileExists(nodeCmd) Then nodeCmd = "node"
args = ""
For i = 0 To WScript.Arguments.Count - 1
  args = args & " """ & WScript.Arguments(i) & """"
Next
If Trim(args) = "" Then
  ' No task given: open the interactive menu instead (visible).
  sh.Run """" & fso.BuildPath(appDir, "WinAgent-menu.bat") & """", 1, False
Else
  ' Run the task fully hidden and wait.
  sh.Run """" & nodeCmd & """ """ & fso.BuildPath(projDir, "src\index.js") & """" & args, 0, True
End If
