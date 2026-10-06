@echo off
REM ---------------------------------------------------------------------------
REM Launch the native desktop app, working around the Nahimic/A-Volute OSD hook.
REM
REM On machines with Dell Alienware Sound Center, A-Volute's Nahimic injects
REM NahimicOSD.dll into freshly started x64 processes and crashes them with
REM 0xC0000005 (Windows Error Reporting names "Faulting module name:
REM NahimicOSD.dll"). That killed juceaide.exe during the first JUCE build and
REM killed this app on its first run. The Nahimic *service* needs administrator
REM rights to stop, but its two user-level helpers can be stopped without them,
REM which clears the injection. Run this launcher again if the crash returns.
REM ---------------------------------------------------------------------------
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-Process NahimicSvc32,NahimicSvc64 -ErrorAction SilentlyContinue | Stop-Process -Force" >nul 2>&1

set "EXE=%~dp0build\BreakbeatNative_artefacts\Release\Breakbeat Pattern Maker.exe"

if not exist "%EXE%" (
    echo Not built yet: "%EXE%"
    echo Run native\build.cmd first.
    exit /b 1
)

start "" "%EXE%"
exit /b 0
