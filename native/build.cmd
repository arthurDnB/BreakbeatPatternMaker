@echo off
rem N0 build: configure and build the JUCE app with the Visual Studio 2019
rem Build Tools toolchain already installed on this PC. Neither cmake nor ninja
rem is on PATH, so both come from a local install:
rem
rem   CMake  - JUCE requires CMake >= 3.22 (every JUCE 7/8 tag declares it), and
rem            the Build Tools slice only ships 3.20, so the portable
rem            Kitware build unpacked under the gitignored native\tools\ is
rem            preferred and the 3.20 copy is only a last-resort fallback.
rem   Ninja  - always from the Build Tools installation.
rem   JUCE   - cloned once into native\tools\juce-src (gitignored) and reused
rem            through FETCHCONTENT_SOURCE_DIR_JUCE so a clean build does not
rem            re-download it.
rem   TMP    - cl.exe writes its intermediate files to %TMP%. This machine's
rem            sandbox denies writes under %LOCALAPPDATA%\Temp (c1xx reports
rem            "fatal error C1083 ... Permission denied"), so TMP/TEMP are
rem            redirected into build\tmp for the whole build.
rem   Patch  - juceaide.exe crashes on this machine (NahimicOSD.dll injection,
rem            see native/patch-juce.ps1), so the gitignored JUCE copy is
rem            patched before CMake configures. The patcher itself is tracked.
rem
rem Usage:  native\build.cmd          configure + build
rem         native\build.cmd clean    delete build\ first, then configure + build
setlocal
set "VSROOT=C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools"
set "PORTABLE=%~dp0tools\cmake-3.31.6-windows-x86_64"
set "JUCE_SRC=%~dp0tools\juce-src"
set "CMAKE=%PORTABLE%\bin\cmake.exe"
set "NINJA=%VSROOT%\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe"

if not exist "%CMAKE%" (
  set "CMAKE=%VSROOT%\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
  echo Using the Build Tools CMake 3.20 - JUCE needs 3.22+, configure will fail.
  echo Unpack a portable CMake into "%PORTABLE%".
)
if not exist "%CMAKE%" (
  echo CMake not found at "%CMAKE%"
  exit /b 1
)

if /i "%~1"=="clean" (
  if exist "%~dp0build" rmdir /s /q "%~dp0build"
)

if not exist "%~dp0build\tmp" mkdir "%~dp0build\tmp"
set "TMP=%~dp0build\tmp"
set "TEMP=%~dp0build\tmp"

call "%VSROOT%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 exit /b 1

set JUCE_ARG=
if exist "%JUCE_SRC%\CMakeLists.txt" set JUCE_ARG=-DFETCHCONTENT_SOURCE_DIR_JUCE="%JUCE_SRC%"

call :patchjuce

"%CMAKE%" -S "%~dp0." -B "%~dp0build" -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_MAKE_PROGRAM="%NINJA%" %JUCE_ARG%
if errorlevel 1 exit /b 1

rem With no JUCE clone yet, the configure above is what fetched it - patch now and
rem re-configure once so the patched JUCEUtils.cmake is the one that is used.
call :patchjuce
if "%PATCHED%"=="1" (
  echo Re-configuring with the patched JUCEUtils.cmake ...
  "%CMAKE%" -S "%~dp0." -B "%~dp0build" -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_MAKE_PROGRAM="%NINJA%" %JUCE_ARG%
  if errorlevel 1 exit /b 1
)

"%CMAKE%" --build "%~dp0build"
if errorlevel 1 exit /b 1

echo.
echo Built: %~dp0build\BreakbeatNative_artefacts\Release\Breakbeat Pattern Maker.exe
exit /b 0

:patchjuce
rem patch-juce.ps1 prints "patched=1" (it changed JUCE) or "patched=0".
set "PATCHED=0"
for /f "tokens=2 delims==" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0patch-juce.ps1"') do set "PATCHED=%%a"
exit /b 0
