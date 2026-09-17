@echo off
REM WinAgent launcher — double-click or run from cmd.
REM Uses the Node bundled with PawWork so no install is needed.
set NODE=C:\Users\ADMIN\.pawwork\dsh\.tools\node.cmd
if not exist "%NODE%" set NODE=node
cd /d %~dp0
if not exist ".env" if exist ".env.example" (
  echo [WinAgent] No .env found — copying .env.example (Ollama defaults^).
  copy /y .env.example .env >nul
)
if "%~1"=="" (
  "%NODE%" src\index.js
) else (
  "%NODE%" src\index.js %*
)
