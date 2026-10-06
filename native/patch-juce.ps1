# Patch the local (gitignored) JUCE copy so the build never invokes juceaide.
#
# Why: on this machine juceaide.exe dies with an access violation (0xC0000005) on
# every invocation, including `juceaide.exe --help`, because an MSI/Sonic-Studio
# audio overlay injects NahimicOSD.dll into processes that load dxgi/user32.
# Windows Error Reporting names it: "Faulting module name: NahimicOSD.dll,
# version 2.2.25.0".
#
# Juceaide is called from two places; the header one is avoided by not calling
# juce_generate_juce_header() in native/CMakeLists.txt (Source/Main.cpp includes
# <juce_audio_utils/juce_audio_utils.h> directly). The resource one cannot be
# switched off for a GUI app, and it cannot be pre-placed either: ninja re-runs a
# custom command that has never produced a build-log entry, so an existing output
# is not enough. This script therefore replaces the juceaide invocation inside
# JUCE's own _juce_add_resources_rc() with a configure-time file(WRITE) stub;
# native/CMakeLists.txt then overwrites that stub with the real version resource
# (native/resources/BreakbeatNative_resources.rc) via configure_file(COPYONLY).
#
# native/tools/ is gitignored, so the patch is applied by this tracked, idempotent
# script; native/build.cmd runs it automatically, and a fresh JUCE clone is
# repaired on the next build. Prints "patched=1" / "patched=0" as its last line.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utils = Join-Path $root 'tools\juce-src\extras\Build\CMake\JUCEUtils.cmake'

if (-not (Test-Path -LiteralPath $utils)) {
    Write-Host "patch-juce: JUCE source not present at $utils (first configure clones it; re-run the build)."
    Write-Host 'patched=0'
    exit 0
}

$text = [System.IO.File]::ReadAllText($utils)
$lf = $text -replace "`r`n", "`n"

if ($lf.Contains('BBPM local patch (native/patch-juce.ps1)')) {
    Write-Host 'patch-juce: already patched.'
    Write-Host 'patched=0'
    exit 0
}

$pattern = '(?m)^[ \t]*add_custom_command\(OUTPUT "\$\{resource_rc_file\}"\n[ \t]*COMMAND juce::juceaide rcfile[^\n]*\n[ \t]*\$\{dependency\}\n[ \t]*VERBATIM\)\n'

$replacement = @'
        # BBPM local patch (native/patch-juce.ps1): never shell out to juceaide.
        # juceaide.exe is broken on this machine, and ninja re-runs a custom
        # command that has no build-log entry, so the file must be produced
        # without a custom command. native/CMakeLists.txt overwrites this stub
        # with native/resources/BreakbeatNative_resources.rc at configure time.
        file(WRITE "${resource_rc_file}" "#include <windows.h>\n")
'@ -replace "`r`n", "`n"

$patched = [regex]::Replace($lf, $pattern, { param($m) $replacement })

if ($patched -eq $lf) {
    Write-Host 'patch-juce: ERROR - the juceaide block was not found in JUCEUtils.cmake;'
    Write-Host '            JUCE changed. Fix the pattern in native/patch-juce.ps1.'
    exit 1
}

[System.IO.File]::WriteAllText($utils, $patched, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "patch-juce: replaced the juceaide rcfile command in $utils"
Write-Host 'patched=1'
