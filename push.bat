@echo off
REM push.bat — commit + push every update to GitHub. Usage: push.bat "message"
setlocal
cd /d %~dp0
where git >nul 2>&1
if errorlevel 1 (
  echo [push] git not found. Install it once:  winget install Git.Git
  echo        or download GitHub Desktop: https://desktop.github.com/
  exit /b 1
)
if not exist ".git" (
  git init
  git branch -M main
)
set MSG=%~1
if "%MSG%"=="" (
  for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd-HHmm"') do set MSG=update %%t
)
git add -A
git commit -m "%MSG%" 2>nul
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo [push] no remote. First time only, run ONE of:
  echo   git remote add origin https://github.com/ACHUTHAN17/windows-system-agent.git
  echo   (create that repo first, see GITHUB_SETUP.md)
  exit /b 1
)
git push -u origin main
