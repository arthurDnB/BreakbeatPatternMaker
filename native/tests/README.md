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

`random-model.txt` is a tracked artefact, so regenerate it deliberately (`node native\tests\generate-vectors.mjs`, or `--skip-build` when `dist\` is already current) and commit it together with the code that changed - then rebuild and re-run `bbpm_selftest.exe`, because a vector file that no build has replayed proves nothing. Six of the `jsnum` rows are regression cases rather than examples: 2^-24 and 2^-44 are values where MSVC's `snprintf("%.*g")` needs 17 digits while `String(x)` and `std::to_chars` print 16, which would have changed a pattern's `JSON.stringify` text and broken the frozen digests. See "How the shortest form is produced" in `docs\NATIVE-PORT-PLAN.md`.

**Wave-2 self-test (also no JUCE).** The same build produces `native\build\bbpm_wave2_selftest.exe`, which replays `native\tests\vectors\wave2.txt` against the ported meter, articulation, drum-lane, slice-instrument and reverse-probability modules (`native/Source/core/{Meter,Articulation,DrumLanes,SliceInstrument,ReverseProbability}.cpp`). It has its own runner and its own CLI because a failure should name one file:

```
native\build\bbpm_wave2_selftest.exe
native\build\bbpm_wave2_selftest.exe native\tests\vectors\wave2.txt
```

Vectors come from the compiled browser engine via `node native\tests\generate-wave2-vectors.mjs`, which reads `dist/core/*.js` and writes flat `recordKind<TAB>k=v;...` records whose outputs are canonical scalars only - no nested JSON comparison, so the native side needs no second JSON parser. A record's observable contract is often a *thrown message*, so the C++ side throws `JsError` where the TypeScript throws and the fixture pins the exact text; non-ASCII dashes and middle dots are composed as hex escapes in the C++ sources to stay independent of the compiler's source charset. `wave2.txt` is tracked and subject to the same deliberate-regeneration rule as the other two vector files.

**Before you run the app on this machine (Nahimic).** Dell's Alienware Sound Center (A-Volute "Nahimic") injects `NahimicOSD.dll` into freshly launched x64 processes and crashes them with `0xc0000005` at module offset `0x14aa0` (Windows Error Reporting names `Faulting module name: NahimicOSD.dll, version 2.2.25.0`, sometimes a follow-on `ntdll.dll` report). That is an environment fault, not a bug in this app: it killed `juceaide.exe` the same way during the first JUCE build. The service itself needs administrator rights, but the two user-level helpers can be stopped without them. Run this first, and again if the crash returns:

```powershell
Get-Process NahimicSvc32,NahimicSvc64,NahimicOSD -ErrorAction SilentlyContinue | Stop-Process -Force
```

If `--render` exits `-1073741819` (or `3221225477`) and writes nothing, check the Application event log for a `NahimicOSD.dll` report before suspecting the code. This has already produced one false alarm: `verify-n0-render.mjs` reported `2/20 checks passed` with exit `3221225477` after a fresh `native\build.cmd`, and the very same executable scored 20/20 once the helpers were stopped. `native\run.cmd` performs the kill itself, but the verifier launches the executable directly, so stop them before a verification run too.

**Honest scope:** the N0 voices are placeholders (a sine-droop kick and an xorshift-noise snare in `Main.cpp`), so this verifies plumbing, determinism and timeline math - not musical correctness or voice quality. If the executable cannot be found the script fails loudly, naming the paths it tried.
