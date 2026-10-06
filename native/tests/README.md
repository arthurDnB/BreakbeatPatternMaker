# native/tests

Independent verifier for the native N0 offline render path (`native/Source/Main.cpp`).

Build from the repo root with `native\build.cmd` (output: `native\build\BreakbeatNative_artefacts\Release\Breakbeat Pattern Maker.exe` - the file is named after `PRODUCT_NAME`, not after the CMake target), then run `node native\tests\verify-n0-render.mjs`. Options: `--exe <path>` to point at a different build, `--scratch <dir>` to change where the WAVs are written (default `test-results\native-n0\`), `--help` for usage.

It renders the embedded plan twice and asserts the two WAVs are sha256-identical, parses the RIFF/WAVE and the `.txt` sidecar itself (channels, sample rate, bit depth, non-silence, `bytes`/`frames`/`peak`/`rms` against the decoded PCM), and checks the first kick and first snare onsets against `llround(tick * 60 / (bpm * ppq) * sampleRate)` within a +/-2 sample tolerance. A bare `--render` must write `n0-render.wav` into the current working directory. Exit code 0 means every check passed; a missing precondition is reported as a failure, never silently skipped.

**Core self-test (no JUCE, no audio device).** `native\build.cmd` also builds `native\build\bbpm_selftest.exe`, which replays `native\tests\vectors\random-model.txt` against the C++ port in `native/Source/core/`. That vector file is recorded from the *compiled browser engine* by `node native\tests\generate-vectors.mjs` (which prefers `--exe`-free `dist/core/*.js`), so it is the contract between the two implementations rather than a copy of the C++ constants. Run it plainly (it locates the vectors itself) or with an explicit path:

```
native\build\bbpm_selftest.exe
native\build\bbpm_selftest.exe native\tests\vectors\random-model.txt
```

It prints one `checks:`/`failures:` line plus `PASS` or `FAIL`, and exits 0 only when at least one check ran and none failed; a missing file is a failure, never a silent pass. Comparison is exact - doubles go through the same ECMAScript number-to-string conversion the JS side uses, so there is no tolerance to tune. Green here means the ported RNG and model reproduce the shipped generator bit for bit; it says nothing about the parts of the engine that are not ported yet.

**Before you run the app on this machine (Nahimic).** Dell's Alienware Sound Center (A-Volute "Nahimic") injects `NahimicOSD.dll` into freshly launched x64 processes and crashes them with `0xc0000005` at module offset `0x14aa0` (Windows Error Reporting names `Faulting module name: NahimicOSD.dll, version 2.2.25.0`, sometimes a follow-on `ntdll.dll` report). That is an environment fault, not a bug in this app: it killed `juceaide.exe` the same way during the first JUCE build. The service itself needs administrator rights, but the two user-level helpers can be stopped without them. Run this first, and again if the crash returns:

```powershell
Get-Process NahimicSvc32,NahimicSvc64 -ErrorAction SilentlyContinue | Stop-Process -Force
```

If `--render` exits `-1073741819` (or `3221225477`) and writes nothing, check the Application event log for a `NahimicOSD.dll` report before suspecting the code.

**Honest scope:** the N0 voices are placeholders (a sine-droop kick and an xorshift-noise snare in `Main.cpp`), so this verifies plumbing, determinism and timeline math - not musical correctness or voice quality. If the executable cannot be found the script fails loudly, naming the paths it tried.
