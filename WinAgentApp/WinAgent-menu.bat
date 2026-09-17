@echo off
REM WinAgent-menu.bat — interactive Windows app menu for WinAgent.
setlocal
set NODE=C:\Users\ADMIN\.pawwork\dsh\.tools\node.cmd
if not exist "%NODE%" set NODE=node
cd /d %~dp0..
if not exist ".env" if exist ".env.example" copy /y .env.example .env >nul

:menu
cls
echo ============================================
echo  WinAgent v1.3.0 — Windows System Agent
echo  files + apps + screen + browser + system
echo ============================================
echo  1) Interactive agent (type tasks, silent)
echo  2) Self-test (no AI needed)
echo  3) WordPress task
echo  4) System status (quick look)
echo  5) Open README
echo  6) Quit
echo.
set /p CH=Choose [1-6]:
if "%CH%"=="1" "%NODE%" src\index.js & goto menu
if "%CH%"=="2" "%NODE%" src\index.js --selftest & pause & goto menu
if "%CH%"=="3" goto wp
if "%CH%"=="4" "%NODE%" src\index.js "summarize: OS, drives, top memory processes" --once & pause & goto menu
if "%CH%"=="5" start "" "%~dp0..\README.md" & goto menu
if "%CH%"=="6" exit /b 0
goto menu

:wp
set /p TASK=Describe the WordPress task:
"%NODE%" src\index.js --skill wordpress-build "%TASK%"
pause
goto menu
