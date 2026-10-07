# Native port plan (C++ / JUCE)

Decision record and milestone ladder for a native desktop build of Breakbeat Pattern Maker,
replacing the "Tauri or Electron later, if handoff needs it" position recorded in
`Breakbeat Pattern Maker Project.md:362-363`, `:491`, `:536` and `:541`.

This document is a plan, not a report of finished work. Only N0 exists in code.
The JavaScript build remains the working product (see [Scope and unknowns](#scope-and-unknowns)).

## Decision record

- **Date:** 2026-10-06.
- **Chosen:** C++17 + JUCE 7.0.12, fetched by CMake `FetchContent`, built as a single GUI app
  target with `juce_add_gui_app`.
- **Chosen because:** JUCE supplies a real native audio device and a real native window with no
  JavaScript runtime anywhere in the audio path, and the generator core is already
  dependency-free TypeScript that ports mechanically.
- **Decision owner:** Arthur (repo owner).
- **Supersedes:** the table row at `Breakbeat Pattern Maker Project.md:362` ("Tauri desktop app —
  Version 2 if handoff needs it"), the Electron row at `:363` ("Alternative if consistent
  audio/browser behavior outweighs size"), the re-evaluation note at `:491` ("Evaluate a Tauri
  wrapper only after measuring real transfer friction"), and the packaging row at `:536`
  ("Static web build; optional Tauri later").

### Why not the alternatives

| Alternative | Why it was not chosen |
| --- | --- |
| Zero-dependency chromeless launcher | Still a browser engine. It inherits the browser-only gaps listed in [Browser features and their native mappings](#browser-features-and-their-native-mappings) without giving a native audio device, and it does not remove the JS runtime from playback. |
| Electron | Ships Chromium and Node with the app. That is a large distribution plus the ongoing security and update responsibilities the design already flags at `Breakbeat Pattern Maker Project.md:541`. Audio still runs through the web audio path. |
| Tauri | Reuses the web UI and gives native file access, but the audio path is still a webview, so OS webview differences and the browser-only storage and download gaps remain. It defers rather than removes the problem. |

The mechanical reason the port is tractable: the audit found `src/core/` to be browser-global
free. The M0 report's §1.6 checks are mechanical, not inferred — two independent `dist/cli.js`
runs produced byte-identical output (SHA-256
`EABD6613AAAC86D810B20A5FB99BA6141FDFD0B1AAB22B9D0EFCB2A6465FC9E2` for both runs of
`jungle`, seed `break-042`, engine `groove-v5`, LPB 4, 165 BPM → 44 notes, 32 rows).

Two portability caveats recorded in the same section, which the C++ side must handle rather than
assume away:

- `src/core/` holds **17 `structuredClone` call sites across 8 files** — `arrangement-history.ts:8`,
  `articulation.ts:25`, `bank.ts:29/60/73/145`, `editor.ts:30/424`, `drum-lanes.ts:45`,
  `groove-v51-profiles.ts:7`, `think-break.ts:32` (×2)/`41`, `song-melody.ts:28` (×2)/`35/47`.
  Node ≥ 17 makes this a non-blocker for JS hosts; in C++ each site needs an explicit deep copy.
- `Date.now()` default parameter at `bank.ts:25` and `TextEncoder` at `model.ts:161`.

## Machine toolchain, measured

All values below were measured on this PC, not assumed.

| Item | Value |
| --- | --- |
| Compiler | Visual Studio Build Tools 2019, MSVC toolset **14.29.30133** |
| Install root | `C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools` |
| Bundled CMake | **3.20.21032501-MSVC_2** at `Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe` |
| Bundled Ninja | `Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe` |
| Windows SDK | **10.0.19041.0** |
| Language standard | C++17 (`CMAKE_CXX_STANDARD 17`, `CMAKE_CXX_STANDARD_REQUIRED ON`) |

**Nothing is on `PATH`.** No `cmake`, `ninja`, `clang`, `g++` or `cl` resolves from a plain shell.
That is the entire reason `native/build.cmd` exists: it points at the Build Tools installation
directly instead of relying on a developer shell.

```
rem native/build.cmd
set "VSROOT=C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools"
set "CMAKE=%VSROOT%\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
set "NINJA=%VSROOT%\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe"
call "%VSROOT%\VC\Auxiliary\Build\vcvars64.bat"
"%CMAKE%" -S "%~dp0." -B "%~dp0build" -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_MAKE_PROGRAM="%NINJA%"
"%CMAKE%" --build "%~dp0build"
```

The build prints its artefact path on success:
`native\build\BreakbeatNative_artefacts\Release\BreakbeatNative.exe`.

### Why JUCE is pinned to 7.0.12

`CMakeLists.txt:18` requires `cmake_minimum_required(VERSION 3.20)` and the toolchain in the table
is exactly 3.20. **JUCE 8 requires CMake 3.22 or newer, so this machine cannot configure it.**
7.0.12 is the last JUCE 7 release and builds with CMake 3.20 and MSVC 14.29, which is why the pin
is a hard constraint and not a preference (`native/CMakeLists.txt:27-32`). Moving to JUCE 8 means
installing a newer CMake first — that is the whole unlock, and it is not required for any milestone
below.

`native/CMakeLists.txt:45-50` sets `JUCE_WEB_BROWSER=0`, `JUCE_USE_CURL=0` and
`JUCE_STRICT_REFCOUNTEDPOINTER=1`. The first two keep the browser and network stacks out of the
binary, which is consistent with the decision to have no browser in the audio path.

## Licensing risk (not settled)

**This is a flagged risk, not a resolved question. No binary may be distributed until it is
closed.**

- JUCE 7 is **AGPLv3-or-commercial**. Fetching it under the AGPLv3 option (`native/CMakeLists.txt:13-16`)
  is fine for local development. Distributing a linked binary means either the whole application
  becomes AGPLv3 — including the §13 network source offer — or a commercial JUCE licence is bought.
- **The repository has no root `LICENSE` file.** Verified absent. The application's own outbound
  licence is therefore undecided, and that decision interacts with the JUCE choice above.
- The M0 §4.1 verdict table lists **NEEDS-CLEARANCE: "the application's own missing root
  `LICENSE`; JUCE / Rubber Band if adopted"** (`test-results/m0/M0-AUDIT-REPORT.md:686`). The
  JUCE half of that item is now live, not hypothetical.
- M0 §4.3 **tier 2** is the relevant clearance tier (`:729`): if JUCE is adopted closed-source,
  choose AGPLv3 or buy commercial; resolve Rubber Band's GPLv2+/commercial dual licence before any
  formant-aware stretch ships. Rubber Band is **not currently bundled** — `src/audio/time-stretch.ts`
  is first-party — so it is a future dependency to keep off the list unless it is actually adopted.
- **Sample-catalogue provenance is an unresolved risk that is separate from the framework choice.**
  M0 §4.1 ranks the 188 UDNB WAVs and 111 Lo-Fi Vol. 2 WAVs as the top two risks, with the Think
  asset contradiction third, and states plainly that `scripts/build-site.mjs` is **not** a licence
  gate (it checks the licence string, path shape and sha256, and never reads `author` or `source`).
  A native binary does not change this exposure; it changes the distribution surface.
- The 16 installed packages (8 devDependencies + 8 transitive, MIT / Apache-2.0 / BSD-3-Clause)
  ship nothing today. **lamejs is NEEDS-NOTICE** and M0 warns that a desktop build which
  concatenates or minifies assets into one binary "would destroy the replacement mechanism and
  change the analysis entirely" (`test-results/m0/M0-AUDIT-REPORT.md:717-720`). Treat binary
  packaging as a licensing event, not just a build step.

Owner: Arthur. Blocking milestone: N5.

## N0 — what exists now

N0 is the native skeleton, and this is exactly its scope. Nothing is understated here and nothing
is claimed beyond it.

- A JUCE window (`MainWindow` / `MainComponent`, `native/Source/Main.cpp:356-517`) with Play, Stop
  and "Render to WAV" controls, sized 560×260, opening a real device at 2 output channels via
  `setAudioChannels(0, 2)`.
- It parses a **schema-valid RenderPlanV1 JSON** document (`parsePlan`, `Main.cpp:99-162`) against
  the frozen contract at `schemas/render-plan-v1.schema.json`, checking `planVersion`,
  `timeline.ppq`, `timeline.sampleRate`, `tempoEvents[0].bpm`, `tracks` and `events`.
- It renders through **one deterministic mixing path** — the signature is
  `renderPlan(const Plan& plan, double sampleRate)` (`Main.cpp:237`), called with the plan's own
  rate for fixture renders and with the device rate for playback so both hear the same thing.
- Timeline math: `secondsPerTick()` is `60.0 / (bpm * ppq)` and event start samples are
  `llround(tick * secondsPerTick * sampleRate)` (`Main.cpp:89`, `:258`).
- Voices are **PLACEHOLDER drum voices**: a pitch-swept sine kick and a noise-plus-tone snare, with
  a fixed-seed xorshift noise source (`Main.cpp:167-223`). They are not the real instruments.
- It plays through the device (`getNextAudioBlock`, `Main.cpp:387-408`).
- `--render <path>` writes a WAV plus a `.txt` summary (`runOfflineRender`, `Main.cpp:310-354`)
  containing the plan description, frame count, peak, RMS, file path and byte size.

N0 deliberately does **not** generate a pattern. The generator core is still TypeScript.

## Milestone ladder

### N1 — port the generator core

Port `src/core/` in the M0 §1.7 portability order, most portable first. The order is a queue;
each wave is proven against tracked JS fixtures before the next one starts (see
[Determinism and acceptance](#determinism-and-acceptance)).

1. `src/core/random.ts`, `src/core/model.ts`
2. `src/core/meter.ts`, `articulation.ts`, `drum-lanes.ts`, `slice-instrument.ts`,
   `reverse-probability.ts`
3. `groove*.ts`, `profiles.ts`, `settings.ts`, `melody*.ts`, `harmony.ts`, `piano.ts`,
   `song-melody.ts`
4. `src/core/editor.ts`, `bank.ts`, `generate.ts`, `exact-hits.ts`, `think-break.ts`,
   `arrangement-history.ts`, `compile.ts`
5. `src/cli.ts`
6. `src/audio/wav.ts`, `slices.ts`, `chop.ts`
7. `src/audio/library.ts` — path rewrite only
8. `public/synth.js` — only after the §1.4 data/render split is done

Wave 1 starts at `src/core/random.ts` and `src/core/model.ts` and ends at `src/audio/wav.ts`,
`slices.ts`, `chop.ts`, then the `library.ts` path rewrite, then `public/synth.js`. The
`src/cli.ts` port at position 5 is what makes the native binary drivable headlessly, which is how
waves 1–5 get compared at all.

### N2 — real drum synthesis

Replace the N0 placeholder voices with the real instruments, verified against the golden reference
PCM rather than by ear. This is where the per-quantity tolerances below actually bite, and where
`vinyl-texture.ts:12` must be seeded or excluded before any golden comparison.

### N3 — project files and native dialogs

`.bpmproj` project container files, plus native save and open dialogs wired to the platform, not to
a browser download flow.

### N4 — sample library and asset cache

The asset cache and the sample catalogs, with the catalogs reused verbatim and the
`/public/...` path assumption replaced by a cache-root resolver.

### N5 — packaging, update and security responsibilities

Installer, code signing, the update path, and the licensing decisions above. This milestone is
blocked on the licence question, not on code.

## Browser features and their native mappings

From M0 §1.8 (`test-results/m0/M0-AUDIT-REPORT.md:192-203`). Every row is a browser assumption that
cannot cross the portable boundary as-is.

| Feature | Why it cannot cross as-is | Native handling |
| --- | --- | --- |
| Browser IndexedDB autosave (`src/audio/project.ts:117`) | Origin-scoped storage has no native equivalent | Desktop container (`.bpmproj`) + explicit export path for web autosaves |
| Browser download flow (`src/audio/render.ts:22-23`) | `createObjectURL` + anchor click | Native save dialog |
| Root-absolute `/public/...` asset URLs | 4 `document.baseURI` fetches, ~350 catalog entries | Cache-root asset resolver, catalogs reused verbatim |
| `public/synth.js` reachable from `break-presets.ts:5`, `performance.ts:16`, `render.ts:3` | Pulls a browser asset into a would-be service graph | Split data from rendering (§1.4) before M1 extraction |
| `audio → ui` inversion (`src/audio/drum-kit.ts:10`) | A DSP-adjacent module imports a UI control | Remove the import; keep knob construction in the UI layer |
| Web Storage user data: `sound-browser.ts:22-23`, `web.ts:2994` (`bpm_custom_dsp_presets`) | Holds real user data, not cache | Migrate into the desktop global-preferences store, not the project bundle |
| `vinyl-texture.ts:12` unseeded randomness | Breaks reproducible golden PCM | Seed or exclude from fixtures |
| `.bbpattern` / `Transfer` export (`src/core/compile.ts`) | Renoise-importer JSON, not a render plan | Keep as an export format; do **not** reuse as the IPC plan |

Two further mappings the task asks for explicitly, resolved the same way:

- **Web worker → native thread.** `src/audio/break-analysis-worker.ts` and the worker spawned from
  `src/audio/mp3.ts:5` become native worker threads, with the same message boundary the worker
  already has.
- **Web Storage → desktop preferences store.** The `bpm_custom_dsp_presets` data at `web.ts:2994`
  is user data and belongs in the global-preferences store, per the table row above.

Note the coverage caveat at M0 §1.9: only `public/synth.js` (59 lines),
`src/audio/break-analysis-worker.ts` (7 lines) and `src/cli.ts` were read in full during
classification; `src/web.ts`, `src/audio/library.ts`, `src/audio/modular-synth.ts` and
`src/audio/drum-kit.ts` were grep-verified. Those four should be spot-read before port scoping
locks.

## Determinism and acceptance

Determinism is a hard requirement of the port, not a quality goal.

- `src/core/random.ts:1` states the contract directly: **`Never use Math.random in generation.`**
  The implementation is a versioned FNV-1a hash seeding a Mulberry32 stream keyed by
  `seed` + `stream`, so a port must reproduce the integer arithmetic exactly (`Math.imul` is
  32-bit wrapping multiply; `>>> 0` is unsigned truncation).
- **The pinned `JSON.stringify` member-order contract** (`docs/M1-RENDER-PLAN-CONTRACT.md:60-69`):
  fixture hashes are taken over `JSON.stringify(pattern)` — the text, not the object — so member
  insertion order and **number formatting are part of the contract**. A native path must emit
  JavaScript's shortest round-trip form byte for byte: `1` not `1.0`, `0.5` not `0.50`,
  `0.3333333333333333`, `1e+21` in exponent form, and `-0` collapsing to `0`.
  `tests/fixtures/determinism-matrix.json` freezes **44 whole-pattern digests** of that exact text.
  `reason` is inside the hash on purpose; `src/core/model.ts:116` marks `layerOf` render-only, so
  fixtures assert it is `undefined` after rendering rather than serializing it.
  - **How the shortest form is produced (measured, not assumed).** `bbpm::core::jsNumberToString`
    (`native/Source/core/Model.cpp:208`) uses `std::to_chars(..., std::chars_format::scientific)`
    with no precision, then applies the ECMAScript formatting rules to its digits and exponent.
    The obvious alternative — searching `snprintf("%.*g", precision)` for the first precision that
    `strtod`s back to the same double — is **wrong on MSVC**: probed over 376 868 values it agreed
    with `String(x)` 376 866 times and fell back to 17 digits for `5.960464477539063e-8` (2^-24)
    and `5.684341886080802e-14`, both of which JS prints with 16. Any single such value inside a
    pattern would change its `JSON.stringify` text and break the frozen digests. With `to_chars`
    the same probe reports `mismatches 0`.
- **Tolerance rules for audio comparison** (`docs/M1-RENDER-PLAN-CONTRACT.md:126-138`, executable
  as `scripts/fixture-tolerance.mjs`, enforced by `tests/fixture-tolerance.test.mjs`):

  | Quantity | Tolerance |
  | --- | --- |
  | Max normalized sample error (float/linear) | 1e-5 |
  | PCM16 golden | byte-identical, else float sidecar (PCM16 LSB = 3.0518e-5, which cannot express 1e-5) |
  | Onset position | ±1 frame (≥ 44.1 kHz), ±2 frames (8 kHz) |
  | Peak | 1e-4 |
  | RMS | relative 1e-3 with 1e-4 absolute floor |
  | Per-100 ms window | 2e-3 |
  | DC offset | 1e-5 |
  | Stereo correlation | 1e-3 |
  | Spectral (4096-pt Hann) | 1e-2 per bin, 0.25 dB aggregate |
  | True peak | 1e-3 |
  | Clipped sample count | identical |

  Two policies accompany the table: **gain errors must never be normalized away**, and
  **non-silence is not evidence of parity**. Both are enforced, not described.

The acceptance test for every ported wave: **the C++ path must reproduce the tracked JS fixtures.**
A wave is not "ported" when it compiles or sounds right; it is ported when its digests match the
frozen JS output, or when an audio fixture passes the tolerance table above.

## Scope and unknowns

Known gaps at the time of writing, stated explicitly:

- No installer, and no packaging pipeline beyond the raw build output.
- No code signing.
- No non-Windows testing. The toolchain table above describes one PC, and
  `native/build.cmd` is Windows-only by construction.
- No licence decision. No root `LICENSE` exists, JUCE's AGPLv3-or-commercial choice is open, and
  the sample-catalogue provenance risk is unresolved separately.
- N0 voices are not the real instruments; they are sine and noise placeholders.
- `src/core/` has 17 `structuredClone` sites and `Date.now()` / `TextEncoder` uses that the C++ port
  must replace explicitly.
- `vinyl-texture.ts:12` is unseeded and must be seeded or excluded before golden-PCM comparison.
- Four modules were grep-verified rather than read line by line during the M0 classification pass.

**The JavaScript build remains the working product.** The native app is a parallel track until it
can complete the MVP loop — generate, edit, render, save — which is N1 through N3. Until then,
`npm.cmd test` and the GitHub Pages deployment remain the shipping path.
