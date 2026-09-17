Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""C:\Users\HP\windows-system-agent\system-overlay-agent.ps1""", 0, False
