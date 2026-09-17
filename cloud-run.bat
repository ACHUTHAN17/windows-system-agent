@echo off
REM WinAgent cloud launcher — GitHub is the system, nothing lives here.
REM Usage: cloud-run.bat [--selftest] ["your task"] [--yes] [--skill a,b] ...
REM Model keys: copy .env.example to winagent.env next to this file (once).
setlocal
set REPO=https://github.com/ACHUTHAN17/windows-system-agent.git
set DIR=%TEMP%\winagent-live
set GIT=git
where git >nul 2>&1 || set GIT=C:\Program Files\Git\cmd\git.exe
where node >nul 2>&1
if errorlevel 1 (
  echo [winagent] node not found. Install Node 18+ once:
  echo   winget install OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
  echo then close/reopen this terminal and retry.
  exit /b 1
)
if not exist "%DIR%\.git" (
  echo [winagent] first run - fetching system from GitHub...
  rmdir /s /q "%DIR%" 2>nul
  "%GIT%" clone --depth 1 %REPO% "%DIR%" || exit /b 1
) else (
  "%GIT%" -C "%DIR%" pull --ff-only --quiet || (
    echo [winagent] update failed - refetching fresh...
    rmdir /s /q "%DIR%" 2>nul
    "%GIT%" clone --depth 1 %REPO% "%DIR%" || exit /b 1
  )
)
if exist "%~dp0winagent.env" copy /y "%~dp0winagent.env" "%DIR%\.env" >nul
node "%DIR%\src\index.js" %*
