@echo off
cd /d "%~dp0"
if not exist node_modules\typescript\bin\tsc (
  echo Run npm install in this folder once, then try again.
  pause
  exit /b 1
)
call npm.cmd start
if errorlevel 1 pause
