# Development Log & AI Handover Guide

This document maintains the running project state and change log so that multiple AI assistants (e.g., Antigravity, OpenAI Codex) and human developers can seamlessly collaborate without losing context or introducing conflicts.

---

## 🤖 Rules for AI Assistants Working on this Repo

1. **Check for latest changes before editing:**
   * Always check `git status` and pull if connected to remote:
     ```bash
     git pull origin main
     ```
2. **Execution on Windows:**
   * PowerShell execution policy may block `npm.ps1`. Always use `npm.cmd` directly for commands (e.g. `npm.cmd test`, `npm.cmd run build:site`).
3. **Verify tests before committing:**
   * Unit test suite: `npm.cmd test`
   * Site deployment build & Playwright smoke test: `npm.cmd run test:site`
4. **Update this log:**
   * Document each change under the [Change Log](#change-log) section with date, summary of files modified, and rationale.
5. **Git commit and push:**
   * Commit with a descriptive message. Pushing to `main` automatically triggers GitHub Pages deployment via `.github/workflows/deploy.yml`.

---

## 📌 Current Project Status

* **Version:** `0.3.0-alpha`
* **Test Status:** 118 / 118 unit tests passing (`npm.cmd test`).
* **Live Deployment:** Hosted on GitHub Pages at:
  👉 [https://arthurdnb.github.io/BreakbeatPatternMaker/](https://arthurdnb.github.io/BreakbeatPatternMaker/)
* **Automated CI/CD:** `.github/workflows/deploy.yml` runs tests, packages static assets into `site/`, and deploys via GitHub Actions on every push to `main`.
* **Repository:** [https://github.com/arthurDnB/BreakbeatPatternMaker](https://github.com/arthurDnB/BreakbeatPatternMaker)

---

## 🗺️ Roadmap & Next Tasks (from `PROJECT-SCOPE.md` & `UI-UX-REDESIGN-PLAN.md`)

* [x] **Phase 1 (Complete):** Tracker-first workspace layout, sticky transport, contextual inspector, pattern bank tabs.
* [x] **Phase 2 (Complete):** Editing clarity, pending draft state, pitch slider gesture undo grouping, hit articulation (ratchets & gates).
* [x] **Phase 3 (Complete):** Simplified sound selection, 32 CC0 bundled sample catalog, compact routing/effects indicators.
* [x] **Milestone 1 (Complete):** Unlimited dynamic pattern bank engine (`+ New`, `⧉ Dup`, `✕ Delete`).
* [x] **Milestone 2 (Complete):** Renoise 3-tray retractable layout shell with persistable left/right/bottom drawers.
* [x] **Milestone 4 (Complete):** Tracker track mixer strips with Solo (S) switches, inline volume faders, and peak meters.
* [x] **Milestone 5 (Complete):** Waveform Slicer & Scramble/Mutate DSP Rack in bottom tray with instant breakbeat chopping.
* [x] **Phase 4 (Complete):** Unified song arrangement & transport awareness, song tempo migration v1->v2, full song WAV export.
* [x] **Groove v2 Engine & 38 Genres (Complete):**
  - Staged rhythm engine: main motif → groove timing → supporting hits → phrase responses → genre-aware fills.
  - 38 distinct genre profiles grouped into 6 musical families (`Jungle & DnB`, `Hip-Hop & Downtempo`, `Garage`, `Dub & Bass`, `Breaks & Rave`, `Experimental`).
  - Instrument-specific microtimings (laid-back snares, swung hats, solid kicks).
  - Musical variation preserving seed and recurring motifs; backward-compatible legacy-v1 seed reproduction.
* [x] **Audio Engine 3 (Groove v3) (Complete):**
  - 5-stage generation pipeline: Protected Anchor Spine → Selective Groove & Micro-timing Map → Subgenre Layers & Melodic/Euclidean Support → Phrase-Local Spicy Articulation Rack → Turnaround Cadences.
  - Expressive musical bursts (2, 3, 4, 6 repeats) with explicit tick durations, rising/falling velocity curves, pitch glide intervals (+7, +12, -2, -5), and micro-chops.
  - Fixed fast-tempo drum clicks: one-shot sample preservation ensures acoustic kicks/snares retain body and punch at 170–220+ BPM without abrupt row cutoffs.
  - Hi-hat choke groups closing open hats across tracker steps and arrangement loop boundaries.
  - Isolated deterministic random streams (`v3Chance`, `v3Pick`) and Strudel-inspired Euclidean rhythmic distribution.
* [x] **Arrangement editing history:** Undo/redo for sequence, slot, repeat and song-tempo changes with context-aware shortcuts.
* [x] **Named song sections:** Optional per-step section labels are preserved in project data, shown in the arranger and transport, and included in history.
* [x] **Visual song timeline:** Colored section blocks, playhead following, insertion gaps, drag reorder and pattern selection with arrangement undo/redo.
* [x] **Quick Start guide:** First-run Generate → Preview → Edit → Export orientation, with persistent dismiss/reopen controls.
* [ ] **Future Audio Roadmaps:** Procedural vinyl texture rack, MP3 export, velocity-layered drum kits, sample-browser filtering.
* [ ] *Note: Renoise integration has been retired in favor of the standalone in-browser instrument.*

---

## 📝 Change Log

### [2026-09-25] - First-Run Quick Start Guide (Codex)
- **Onboarding (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Added a compact four-step Generate → Preview → Edit → Export guide, responsive cards, and a header toggle that remembers visibility in local storage.
- **Documentation and browser verification (`README.md`, `scripts/site-browser-smoke.mjs`):** Documented the guide and verified it opens, hides, and reopens on both site paths.
- **Verification:** `npm.cmd test` passes 118/118 and `npm.cmd run test:site` passes on root and GitHub Pages subpath.

### [2026-09-25] - Visual Song Arrangement Timeline (Codex)
- **Timeline data (`src/core/bank.ts`):** Added a validated per-step visual projection with song-tempo duration and bar ranges, plus insertion-point helpers that preserve section and repeat metadata.
- **Arranger (`src/web.ts`, `public/index.html`, `public/workspace.css`):** Added color-coded section blocks, accessible insertion gaps, drag reorder, click-to-edit selection, compact responsive layout, and playback highlighting with horizontal follow.
- **History and persistence:** Timeline edits use the existing arrangement history; section labels and order remain in project exports and local autosave.
- **Documentation and verification:** Updated `README.md` and `PROJECT-SCOPE.md`; added core and browser coverage for timeline math, editing, undo/redo, playback, export, persistence and mobile layout.

### [2026-09-25] - Named Song Sections (Codex)
- **Arrangement data (`src/core/bank.ts`):** Added an optional, validated section label to sequence steps and exposed it through song timeline entries without changing the existing project schema version.
- **Arranger and transport (`src/web.ts`):** Added editable section labels for each arrangement step and included the active section in the song transport status and accessibility label.
- **History and persistence:** Section edits use the existing arrangement history engine, so undo/redo, autosave and project export retain the labels.
- **Verification:** Added coverage for section history, timeline projection and validation; `npm.cmd test` passes 116/116 and `npm.cmd run test:site` passes for both root and GitHub Pages subpath builds.

### [2026-09-25] - Arrangement Undo/Redo State Engine (Codex)
- **Arrangement state (`src/core/arrangement-history.ts`):** Added bounded, validated Memento history for pattern slots, sequence steps, repeats, names and song tempo. Pattern editor history remains separate.
- **Arrangement UI (`src/web.ts`, `public/index.html`):** Routed bank and song mutations through the history engine, added arrangement Undo/Redo buttons, and made Ctrl/Cmd+Z/Y context-aware between the arranger and tracker.
- **Persistence:** Project loading and new-workspace reset now initialize a clean arrangement history; autosave and project export continue to use the current canonical bank.
- **Verification:** `npm.cmd test` passes 114/114 tests, including 17 arrangement-history tests. `npm.cmd run test:site` passes with all 344 licensed samples and project/autosave checks.

### [2026-09-25] - Per-Instrument FX Wet/Dry Crossfader & DSP Rack Polish (Antigravity)
- **Audio DSP Engine (`src/audio/effects.ts`):**
  - Added optional `wet?: number` (range 0.0 to 1.0, default 1.0) to `Effects` interface, defaults, and validator.
  - Implemented non-destructive dry/wet signal blending in `processEffects`: clones input channels when `wet < 1`, applies effects chain, and crossfades linearly `output = dry * (1 - wet) + wetData * wet`. If `wet === 0`, skips DSP entirely for instant dry bypass with zero CPU overhead.
  - Updated `effectTail()` to return 0 when `wet <= 0`.
- **Instrument Cards & UI (`src/audio/drum-kit.ts`):**
  - Added `FX Wet / Dry (0–1)` slider to the Effects rack of each drum instrument slot.
  - Formatted live readout to display percentage (`100%`, `50%`, `0%`).
  - Added active state indicator badge reflecting wet status (`Drive + 50% Wet`).
- **Master DSP Strip (`public/index.html`, `src/web.ts`):**
  - Added `FX Wet / Dry` slider (`dsp-wet`) to Dynamics & Color rack in the bottom Master DSP strip, creating a balanced 3x3 layout (3 filter, 3 dynamics/mix, 3 delay controls).
  - Renamed `dsp-mix` label from ambiguous "Wet mix" to "Delay mix" for professional DAW clarity.
  - Wired real-time two-way synchronization between Master DSP strip and per-instrument rack sliders.
  - Added bottom tray responsive height rule in public/workspace.css (max-height: 310px when Master DSP is active) so all 3 columns and rows of controls are comfortably visible without internal clipping.
- **Verification & Testing (`tests/effects.test.mjs`):**
  - Added unit tests verifying 0% wet is strictly identical to raw dry buffer, 100% wet is fully processed, 50% wet blends exact linear midpoint, and invalid/out-of-bounds inputs throw validation errors.
  - All 97 unit tests passing (`npm.cmd test`).
  - Playwright browser smoke test passing on `/` and `/breakbeat-pattern-maker/` with all 344 samples (`npm.cmd run test:site`).

### [2026-09-25] - Lo-Fi Drum Kit Vol. 2 Soundbank, Curated Kits & Navigation Stepper (Antigravity)
- **Soundbank Expansion (111 New Samples):**
  - Converted and integrated 111 authentic Lo-Fi Hip-Hop one-shot hits from 'LoFi Drum Kit Vol. 2': 17 kicks, 20 snares, 26 closed hats, 21 open hats, 18 percs, and 9 vinyl noise textures.
  - Standardized all samples to 16-bit 44.1kHz stereo PCM WAVs in `public/samples/` with SHA-256 integrity checksums in `public/samples/catalog.json`.
  - Registered all 111 samples into `LIBRARY` in `src/audio/library.ts`, bringing total sample library from 233 to 344 sounds.
- **Categorized & Grouped Sample Selection UI (`src/audio/drum-kit.ts`):**
  - Organized the Sound selector into logical optgroups: *Built-in Synthesizers*, *Lo-Fi Hip-Hop Vol. 2*, *Acoustic & Studio Classics*, *Roland TR-808 Vintage*, and *UDNB Collection (Jungle / DnB)*.
- **Sample Navigation Stepper Arrows (`src/audio/drum-kit.ts`, `public/style.css`, `public/workspace.css`):**
  - Added ◀ (Prev) and ▶ (Next) buttons directly beside the Sound dropdown on every drum slot.
  - Clicking arrows cycles to the previous or next sound and triggers instant audible preview auditioning for rapid workflow.
- **5 Curated Lo-Fi Kit Presets (`src/audio/library.ts`):**
  - Added `📻 Lo-Fi Dusty Vinyl (Sub Kick & Crackle)`, `☕ Chillhop Study Beats (Organic & Clean)`, `📼 Late Night Tape Beats (Saturated Boom Bap)`, `🎛️ SP-404 Gritty Lo-Fi (Crunch & Sizzle)`, and `🛋️ Mellow Jazzhop & Shaker (Warm & Gentle)`.
  - Mapped default kits for hip-hop and downtempo genre profiles.
- **Verification:**
  - All 96 unit tests passing (`npm.cmd test`).
  - Full Playwright browser smoke test passing across all 344 samples on both root and subpath (`node scripts/site-browser-smoke.mjs`).
  - Static site generated and verified with 344 licensed WAVs (`npm.cmd run build:site`).


### [2026-09-25] - Vinyl Scratch Synthesizer for Lo-Fi Hip-Hop (Antigravity)
- **Sound Generation (`public/synth.js`, `src/audio/performance.ts`):**
  - Integrated a dedicated `'scratch'` synthesizer mode using FM phase modulation and filtered noise with a realistic forward-stroke turntable chirp curve.
  - Added dynamic synthesis support at render sample rate in `renderSequence` in `src/audio/performance.ts`.
- **Drum Kit & UI Integration (`src/audio/drum-kit.ts`, `src/web.ts`):**
  - Added `Vinyl Scratch (Synth)` to the **Built-in** sound dropdown on the Percussion track in the Instruments panel.
  - Automatically synthesizes and stores the asset into `assets` in `update()` and `choice.onchange`, ensuring seamless audition, pattern playback, arrangement playback, and WAV export.
  - Synchronized `generator-kit-desc` readouts across the Generator strip and Instruments tray.
- **Preset Upgrades (`src/audio/library.ts`):**
  - Updated the default `lofi-soul` kit preset (`🍂 Lo-Fi Hip-Hop (Vinyl Scratch & Soul Snare)`) to default its percussion slot to `synth-scratch`.
  - Added `🪵 Boom Bap & Soul (Deep 16x7 Snare & 18" Tom)` as an acoustic boom-bap kit option.
  - Linked `lofihiphop` in `GENRE_KITS` to automatically load the vinyl scratch kit.
- **Verification:**
  - `npm.cmd test`: All 96 tests passed.
  - `node scripts/site-browser-smoke.mjs`: Playwright browser smoke test passed across all modules and audio assets.
- **Audio Engine Updates (`src/audio/voice-v3.ts`):**
  - Addressed a user-reported audio "stutter" near the end of patterns (especially in Jungle and Liquid DnB).
  - The recent snare polyphony-1 choke update unintentionally applied a fade-in envelope to all choked hits. This destroyed the transient (attack) of dense 16th-note ratchets and ghost snare rolls near the loop boundary, creating a clicking/stuttering sound instead of punchy drums.
  - Fixed the envelope logic in `renderV3Voice` so that `v.gated` ONLY applies a 2ms fade-*out* to cleanly silence the tail, preserving the natural attack transient of every drum hit.
- **Test Suite Updates (`tests/audio-v3.test.mjs`):**
  - Corrected the `v3 triplet gestures` test assertion which was incorrectly expecting a faded-in `0` value at the start of a chopped note.

### [2026-09-25] - Mobile Layout Overhaul (Antigravity)
- **CSS Enhancements (`public/workspace.css`):**
  - **Generator Ordering:** Implemented a Flexbox layout on `<main>` with `.studio-layout` set to `display: contents` for mobile screens (`max-width: 800px`). This completely reorders the mobile UI, pulling the Bottom Rack (Beat Generator) up to position `order: 4` right below the Pattern Bank.
  - **Instrument Carousel:** Converted the `#drum-slots` container from a vertical stack to a swipeable horizontal carousel (`overflow-x: auto; scroll-snap-type: x mandatory`). Each instrument now takes 85% width, saving massive vertical scrolling space.
  - **Grid Compactness:** Restricted the Tracker Grid to `max-height: 400px` on mobile.
  - **Generator Expansion:** Removed the hardcoded `max-height: 180px` on the Generator's tray body on mobile, allowing the full generation toolbar and "Generate" button to be visible without awkward nested scrolling.

### [2026-09-25] - Mobile-First Fills & Rolls (Antigravity)
- **UI Enhancements (`public/index.html`, `src/web.ts`):**
  - Replaced the abstract "Fill Amount" slider with a highly visible **"Pattern Structure"** dropdown right in the Advanced Generation rack.
  - Options include: *Auto-Fills (Probability-based)*, *Standard Groove (No fills)*, *Beat + Fill Drop*, *Beat + Snare Roll*, and *100% Snare Roll Build-up*.
  - This eliminates the need for manual row selection (shift-clicking) on mobile devices, providing powerful, instantaneous structural generation.
- **V3 Audio Engine (`src/core/groove-v3.ts`, `src/core/model.ts`):**
  - Designed and implemented a dedicated `grooveV3Roll` algorithm that generates escalating, tension-building snare risers.
  - The roll generator is completely genre-aware: Jungle/Breakcore gets hyper-fast 64th-note ratchets and Amiga pitch shifts; Liquid gets smooth pocket rolls; House/Rave gets classic 8th-to-32nd machine-gun volume risers.
  - Wired `generateGrooveV3` to slice out the end of the phrase (or the entire phrase) and surgically inject the generated fills and rolls based on the user's dropdown selection.

### [2026-09-25] - Jungle Mastering & UI Faders (Antigravity)
- **UI Enhancements (`public/index.html`, `src/audio/drum-kit.ts`):**
  - Converted all input boxes on the Advanced Generation rack (Syncopation, Swing, Humanize, Ghost, Fill) to range sliders with live numeric readouts.
  - Converted the instrument Quick FX input boxes (High-pass, Low-pass, Resonance, Punch, Drive, Delay, Mix) to range sliders, providing a much more intuitive, tactile DAW experience.
- **Audio Engine Updates (`src/core/groove-v3-profiles.ts`, `src/core/profiles.ts`):**
  - Analyzed the provided Jungle reference track (tempo 165+).
  - Tightened the core `jungle` profile in V3 to strictly feature `[0, 10]`, `[0, 6, 10]`, and `[0, 7, 10]` kick anchors with `[4, 12]` snares.
  - Increased `ghostGain`, `activity`, and `burstBudget` to generate highly active, syncopated 16th-note rolls.
  - Cranked the out-of-the-box defaults for `jungle` so that the user immediately gets complex, fast-paced rhythms without tweaking.
- **Verification:**
  - `npm.cmd test`: 90/90 passing.

### [2026-09-25] - Snare Choke Fix for Jungle Kits (Antigravity)
- **Audio Engine Updates (`src/audio/voice-v3.ts`):**
  - Addressed user feedback that fast snare rolls (specifically `acoustic-snare-piccolo` in the Jungle kit) sounded too wet and built up an unnatural reverb tail in V3.
  - Implemented classic polyphony-1 choke logic for snares in `applyV3Chokes()`. Now, when a snare is triggered rapidly (e.g. 32nd/64th note ratchets or dense ghosts), the new hit cleanly cuts off the ringing tail of the previous hit. This completely eliminates the muddy reverb buildup and restores the dry, punchy tracker aesthetic.
- **Verification:**
  - `npm.cmd test`: 90/90 passing (determinism unbroken).

### [2026-09-25] - AmenScience Break Chop Mastering (Antigravity)
- **Audio Engine Updates (`src/core/groove-v3-profiles.ts`):**
  - Analyzed the AmenScience reference track to capture the authentic, surgical tracker-style beat splicing.
  - Overhauled the `amenscience` core kick anchors to strictly feature Amen-break placements `[0, 6, 10]`, `[0, 3, 10, 14]`, and `[0, 6, 10, 15]`.
  - Maxed out `burstBudget: 4`, `maxRepeats: 8`, and increased `reverseChance` to `0.3` for intense, glitched 64th-note rolls.
  - Added extreme repitching `pitchSteps: [0, 7, 12, -12, -5]` to simulate classic sampler abuse.
- **UI and Core Defaults:** Cranked `amenscience` defaults in `src/core/profiles.ts` (`complexity: .95`, `spicy: .95`, `resolution: 64`) to unleash maximum surgical chaos out of the box.
- **Verification:**
  - `npm.cmd test`: 90/90 passing (determinism unbroken).

### [2026-09-25] - Atmospheric Breakcore Master Anchoring (Antigravity)
- **Audio Engine Updates (`src/core/groove-v3-profiles.ts`):**
  - Following deep reference analysis of the uploaded breakcore track (~200 BPM equivalent), completely revamped the `atmosphericbreakcore` genre profile.
  - Set the core kick anchor to dense Amen-style syncopations: `[0, 6, 10]`, `[0, 3, 10, 14]`, and `[0, 7, 10]`.
  - Scaled up the default intensity in `src/core/profiles.ts` (`complexity: .85`, `spicy: .8`, `resolution: 64`) to give an immediate chaotic stutter effect out of the box, while retaining `spaciousCall` so it still drops into atmospheric pads occasionally.
- **Verification:**
  - `npm.cmd test`: 90/90 passing (determinism unbroken).

### [2026-09-25] - Default to Audio Engine 3 (Antigravity)
- **UI and Core Defaults:** Set `groove-v3` as the default engine in `src/core/profiles.ts` and `public/index.html`. 
- **Tests Updated:** Updated V2-specific determinism tests in `tests/groove.test.mjs` to explicitly request `groove-v2` so they don't break when checking the old output.

### [2026-09-25] - Liquid DnB Master Anchoring (Antigravity)
- **Audio Engine Updates (`src/core/groove-v3-profiles.ts`):**
  - Following deep reference analysis of `dracodraco - freefall.mp3` (~161 BPM), updated the `liquiddnb` profile for maximum genre authenticity.
  - Set the core kick anchor exclusively to the classic syncopated `[0, 10]` and `[0, 7, 10]` steps.
  - Injected continuous 16th-note hat details (`[1, 3, 5, 7, 9, 11, 13, 15]`) and aggressive ghost note density (`[3, 7, 9, 14, 15]`) to simulate the classic rolling "Think Break" shaker/ghost texture beneath the main backbeat.
  - Tightened snare drag to `1.5ms` for a sharper, modern pocket.
- **Verification:**
  - `npm.cmd test`: 90/90 passing (determinism unbroken).

### [2026-09-25] - Genre-aware phrase development and musical Spicy refinement (Codex)
- Synced origin/main and reviewed the v3 kick-overlap fix before editing. The audio choke implementation is unchanged.
- Added `docs/GROOVE-V3-RESEARCH.md`: primary Strudel documentation, producer tutorials and first-person production discussions, with explicit source-to-rule mapping and limitations. Numeric timing/gain recipes are tunable choices rather than invented universal genre specifications.
- Added `src/core/groove-v3-development.ts`: genre-specific call/answer/end budgets, supporting hat/ghost/percussion phrases, minimum repeat spacing and phrase-position helpers for all 38 supported styles.
- Updated v3 generation to admit coordinated support phrases and complete Euclidean support layers; preserve exact musical burst spans; enforce genre repeat/chop limits at maximum Spicy; prioritize endings; normalize repeat-contour energy; keep pitches on chosen intervals. Complexity retains existing rhythmic positions as layers are added.
- Refined protected Jungle/Drumfunk-family snare motif options and Two-step Garage hats; tightened Jump Up kick motifs. V3 mutation now consults v3 placement rules instead of v2 rules.
- Added v3-only Advanced **Phrase** (pattern/4/8/16 bars) and **Starting bar** controls, validated and persisted in project/autosave settings. A pattern remains 1–4 bars: generate separate sections into bank slots for a longer phrase. Repeated blocks do not regenerate themselves. Updated inspector help to distinguish musical spans from tracker rows.
- Bumped v3 generation revision to `0.3.0-groove.2` and browser asset cache keys. Existing saved events remain untouched until an explicit generation/edit; legacy/v2 pattern and PCM compatibility fixtures pass.
- Added six musicality tests and expanded the v3 browser test for phrase save/import/autosave. `npm.cmd test`: **90/90 passing**. Targeted v3 browser test and deployment smoke checks (root and repository mount, all 233 samples) passed. All 12 browser scripts passed: the first 10 in the full run, then sounds and v3 after correcting a stale pre-existing sound-group assertion (3 groups before UDNB, 4 named groups now). `npm.cmd run test:site` passed at both mounts. Final `npm.cmd test` re-run: 90/90.


### [2026-09-25] - Fix V3 Kick Drum Overlap / "Too Wet" Issue (Antigravity)
- **Audio Engine Updates (`src/audio/voice-v3.ts`):**
  - Added the Kick Drum to its own V3 choke group in `applyV3Chokes()`.
  - Previously, V3's enhanced `minBody` enforcement (80ms minimum for full sub-bass weight) caused multiple consecutive kicks in fast rhythms (like Liquid DnB double-kicks) to overlap and phase-smear.
  - The new choke logic ensures a new kick instantly, smoothly truncates the ringing sub tail of the previous kick.
  - Restores the tight, punchy genre accuracy of V2 while keeping V3's high-quality body synthesis and smooth crossfades.
- **Verification:**
  - 84/84 unit tests passing (`npm.cmd test`).

### [2026-09-25] - Spicy Slider Scaling & Articulation Fix (Antigravity)
* **Rationale & Problem Addressed:**
  - The "Spicy" slider was not producing the intended musical variations (ratchets, rolls, micro-chops, pitch flutters) at higher values (e.g., 100%) for genres like Liquid DnB.
  - The budget constraints and location filters in `spice()` were too restrictive, capping the events strictly regardless of the `spicy` percentage and restricting them primarily to beat 4 of specific bars.
* **Core Changes:**
  - **`src/core/groove-v3.ts`:**
    - Redesigned the `spicy` logic in the `spice()` function.
    - Scaled the `budget` constraints dynamically with the `spicy` slider (from `burstBudget` to `burstBudget * 4`), allowing far more articulations at 100%.
    - Relaxed location constraints progressively: high `spicy` values now allow gestures anywhere in the phrase rather than strictly on `phraseEnding` or `halfTimePickup`.
    - Made `chopped` effects available to all genres at very high `spicy` settings (> 0.8), while prioritizing the `experimental` family.
  - **`tests/ab-spicy.mjs`:** Added a diagnostic A/B test script to verify that a Liquid DnB pattern correctly generates significantly more ratchets and gates at 100% spicy compared to 15%.

### [2026-09-25] - Audio Engine 3 (Groove v3) Architecture, Strudel Primitives, & Expressive Articulation (Codex & Antigravity)
* **Rationale & Problem Addressed:**
  - Fast-tempo genres (170–220+ BPM like Atmospheric D&B, Jungle, Breakcore) previously suffered from drum hits being truncated at tracker row edges, making one-shots sound clicky or thin.
  - Spicy and Complexity sliders previously produced erratic random placements rather than authentic, musical subgenre expressions.
  - Users requested an elite third-generation rhythm engine (`groove-v3`) incorporating production techniques from Strudel pattern grammar, DOA/Reddit beatmaking archives, and authentic genre break interpretations.
* **Core Architecture & Engine 3 Implementation:**
  - **`src/core/groove-v3-primitives.ts`:** Implemented isolated deterministic random streams (`v3Chance`, `v3Pick`) so adjusting Complexity/Spicy never perturbs the anchor spine; added rational subdivision ticks and Strudel-style Euclidean spacing (`euclideanSteps`).
  - **`src/core/groove-v3-profiles.ts`:** Calibrated 38 subgenres across 6 families (`jungle`, `hiphop`, `garage`, `dub`, `breaks`, `experimental`) with exact micro-timing pockets (`snareDragMs`, `ghostPushMs`, `hatSwing`, `percussionSwing`), cadence types, and minor-pentatonic melodic percussion runs.
  - **`src/core/groove-v3.ts`:** Created 5-stage pipeline (Anchors → Groove Map → Layers & Euclidean → Musical Spicy Rack → Turnaround Cadences). Spicy creates structured bursts with musical tick durations, velocity curves, pitch flutter intervals, reverse accents, and micro-chops.
  - **`src/audio/voice-v3.ts` & `src/core/articulation.ts`:** Separated `oneShot` hits from `slice` references, allowing kicks and snares to sustain naturally through their acoustic body even at high tempos; added continuous pitch glides, anti-click edge fades, and hi-hat choke groups across loops.
  - **`src/web.ts` & `public/index.html`:** Added `Groove v3` to `#algorithm` select dropdown, added burst duration (`#burst-span-field` / `#edit-burst-span`) and articulation badges (`#hit-expression`) to the hit inspector.
* **Compatibility, Testing & Deployment:**
  - Added regression test suite `tests/engine-compatibility.test.mjs` confirming byte-for-byte exact reproducibility of legacy-v1 and groove-v2 patterns and exported audio.
  - Added `tests/audio-v3.test.mjs`, `tests/v3-integration.test.mjs`, and `scripts/groove-v3-browser-smoke.mjs`.
  - Expanded unit test suite from 66 to **84 tests passing** (`npm.cmd test`).
  - Verified Playwright browser smoke test and site export tests (`npm.cmd run test:site`).

### [2026-09-24] - Compact Beat Generator Console Rack & Tracker Follow Playhead (Antigravity)
* **Rationale & Problem Addressed:**
  - In `media_1790258630858.png`, opening the bottom rack / advanced generator caused inputs, helper labels, and multi-line descriptions to balloon the tray to >450px, completely devouring center stage and hiding all tracker table rows.
  - In addition, users requested an explicit playhead follow toggle button on the tracker to keep the active row visible during pattern and song playback.
* **UI/UX & CSS Architecture Changes:**
  - **Compact `.primary` Console:** Reduced input and select heights to 22px with 11px font; hid verbose multi-line `<small>` descriptions; arranged `Genre`, `Drum Kit`, `Bars`, `BPM`, `Complexity`, `Spicy` into a tight hardware-style console strip.
  - **Dense 9-Column Advanced Generation Grid:** Replaced 3 large rows of 45px inputs with a single sleek 9-column grid for `Break`, `Resolution`, `Engine`, `Seed`, `Syncopation`, `Swing`, `Humanize`, `Ghost`, and `Fill` with 20px input height and responsive breakpoints.
  - **Tracker Viewport Protection:** Enforced `min-height: 240px` on `.studio-layout` and `min-height: 180px` on `.workspace #grid`, while capping `.daw-tray-bottom .tray-body` to `max-height: 180px; overflow-y: auto;`.
  - **`🎯 Follow` Playhead Button:** Added `#tracker-follow-playhead` to `.tracker-quick-actions` with neon cyan active styling, `f` keyboard shortcut, and auto-scroll synchronization during both pattern and song playback.
* **Files Modified:**
  - `public/index.html`: Added `#tracker-follow-playhead` button to `.tracker-quick-actions`; added `type="text"` to `#seed`.
  - `public/workspace.css`: Styled `.tracker-follow-btn`, redesigned `#controls`, `.primary`, `#advanced-generation`, `.advanced`, and `.generation-toolbar`, updated tray and grid layout rules.
  - `src/web.ts`: Added `followPlayhead` state, `syncFollowPlayhead()`, click and `F` key listeners, and hooked auto-scrolling into `play()` and `playArrangement()`.
* **Testing & Verification:**
  - `npm.cmd test`: 66 / 66 tests passing.
  - `npm.cmd run test:site`: All 233 licensed WAVs, preview/playback, WAV export, project roundtrip, and credits verified across mount prefixes.
  - `node scripts/layout-browser-smoke.mjs`: Verified viewport layout and tracker visibility across resolutions.

### [2026-09-24] - Single-Screen Viewport DAW Chassis & Empty Space Elimination (Antigravity)
* **Single-Screen 100dvh DAW Architecture (`public/workspace.css`):**
  * Locked workstation chassis to `100dvh` on desktop displays ($\ge 650\text{px}$ height and $\ge 801\text{px}$ width) with `overflow: hidden` on body and chassis.
  * Anchored Transport and Studio Header at the top (`flex-shrink: 0`) and docked Bottom Rack at the bottom (`flex-shrink: 0`).
  * Converted Center Workspace (`#grid`) to a dynamic flex-grow container (`flex: 1 1 0; overflow-y: auto;`) with its own dedicated scrollbar, eliminating window-level page scrolling and preventing the Bottom Rack from getting pushed off-screen.
* **Balanced Symmetric 6-Item Generator Strip (`public/index.html`, `public/workspace.css`):**
  * Reordered generation controls into logical functional groups: Preset & Kit Configuration (`Genre`, `Drum Kit`, `Bars`) and Realtime Groove Tweaks (`BPM`, `Complexity`, `Spicy`).
  * On wide displays ($\ge 1101\text{px}$), all 6 controls fit on a single sleek line with zero wrapping.
  * On standard/medium displays ($\le 1100\text{px}$), controls neatly form a balanced 3-column × 2-row grid, completely eliminating the broken 4-column overflow and orphaned second-row blank spaces.
* **Left Tray Session HUD & Dead Void Elimination (`public/index.html`, `public/workspace.css`, `src/web.ts`):**
  * Added a sleek **Live Status HUD** at the bottom of the Left Tray displaying active pattern name, bar length, tempo, selected drum kit name, channel count, and quick keyboard shortcuts (`Space: Play`, `Z-M: Notes`, `1-9: Vol`).
  * Updated `syncHud()` in `src/web.ts` to automatically refresh side HUD fields alongside transport updates.
  * Stretched `.daw-tray-left` cleanly to match studio row height, eliminating the ~440px empty black void under the pattern bank.
* **Flush Rack Body & Compact Tab Alignment (`public/workspace.css`):**
  * Removed redundant top/bottom margins and padding between `.tray-rack-tabs` and `.tray-body`, allowing Beat Generator controls to sit flush under active rack tabs.
  * Added `.tray-rack-tabs` to `.tray-bottom-collapsed` so the bottom tray collapses neatly to 28px when toggled.
* **Testing & Verification:**
  * Verified 66/66 unit tests pass (`npm.cmd test`).
  * Verified full site build and Playwright test suite passes across root and subfolder mounts (`npm.cmd run test:site`).
  * Verified layout across multiple viewports ($1440 \times 900$, $1366 \times 768$, $1024 \times 600$) with `scripts/layout-browser-smoke.mjs`.

### [2026-09-24] - Integration of 188 Personal UDNB Drum Hits & Dedicated Kit Presets (Antigravity)
* **188 Personal Drum Hits Added (`Drums/`, `public/samples/`):**
  * Integrated user's personal drum collection: 24 kicks, 27 snares, 55 hi-hats, and 82 percussion hits (188 WAV files, 26.4 MB).
  * Preserved original source files in root `Drums/` folder while copying and standardizing deployable assets into `public/samples/udnb-*.wav`.
  * Computed SHA-256 hashes and cataloged all 188 sounds in `public/samples/catalog.json`, expanding the sound collection from 45 to 233 samples.
* **UI Grouping, Generator Integration & Fast Sound Selection (`public/index.html`, `src/web.ts`, `src/audio/drum-kit.ts`):**
  * Added a dedicated `<optgroup label="UDNB Collection (Personal)">` right beneath `Built-in` synthesis in each lane's sound selector, making personal files immediately accessible without scrolling past legacy samples.
  * Added **Drum Kit** preset selector directly into the Beat Generator primary controls (`#generator-kit-select`), syncing bidirectionally with the Inspector's preset selector (`#kit-preset-select`).
  * Ensured `<details id="sounds-panel" open>` is expanded by default in the right tray, so clicking the top **Drum Kit** tab or any track header immediately displays the kit presets and drum cards.
* **Dedicated UDNB Kit Presets (`src/audio/library.ts`):**
  * Added `udnb-signature` (*🔥 UDNB Signature Drum Kit*) and `udnb-heavy-roller` (*⚡ UDNB Heavy Roller*) presets with custom levels and decays tailored for heavy Drum & Bass / Jungle production.
* **Build & Test Infrastructure (`tests/workspace.test.mjs`, `scripts/site-browser-smoke.mjs`, `scripts/workspace-browser-smoke.mjs`):**
  * Updated catalog and static site bundle assertions to 233 WAVs.
  * Verified all 233 samples pass SHA-256 integrity, RIFF WAV decoding, Playwright browser UI selection, playback preview, and WAV export.
* **Cache Buster Bump (`public/index.html`):**
  * Updated query version strings to `?v=0.2.0-udnb-collection`.

### [2026-09-24] - High-Tempo Drum Body Anti-Clicking & Melodic Atmospheric Breakcore Synthesis (Antigravity)
* **High-Tempo Drum Body & Anti-Clicking (`src/audio/performance.ts`):**
  * Diagnosed high-tempo click cause: `interval` calculation divided by resolution ($64$). At 180–220 BPM with gate applied, one-shot samples were truncated to 5–9 ms (smaller than a 60 Hz kick cycle), generating sharp DC offset clicks.
  * Added `minBody` enforcement for unsliced drum hits ($80\text{ ms}$ for kicks, $65\text{ ms}$ for snares) so hits retain punch, low-end body, and acoustic snap even during fast rolls.
  * Maintained strict manual slice test contract (`!hit.slice`) to preserve micro-edits in `tests/articulation.test.mjs`.
  * Increased audio voice cutoff envelope to 2 ms (`rate * 0.002`) for smooth de-zippering on voice transitions.
* **Acoustic Kit Decay Tuning (`src/audio/library.ts`):**
  * Relaxed choked decays on `acoustic-break` kit (snare: $0.50 \rightarrow 0.85$, percussion: $0.15 \rightarrow 0.70$) so ghost snares and ride cymbal rings have natural sustain.
* **Melodic Atmospheric Breakcore (`src/audio/library.ts`, `src/core/groove.ts`):**
  * Created dedicated `atmospheric-breakcore` kit preset pairing punchy acoustic kicks and snappy jungle snares with tuned metallic lead percussion (`808-cowbell`).
  * Implemented structured 4-bar melodic phrasing quantized to D Minor Pentatonic / Hirajoshi scale (`[-12, -7, -5, 0, 2, 3, 5, 7, 8, 10, 12, 14, 15]`) on the percussion lane.
  * Excluded kicks from spicy ratchet rolls to prevent bottom-end phase smearing.
  * Raised spicy roll gates on snares to $0.9$ and hats/percussion to $0.75\text{--}0.85$, preventing clicks.
  * Protected atmospheric melodic percussion from pattern-wide random pitch shifts, and quantized any remaining spicy ornaments to the atmospheric scale.
* **Cache Buster Bump (`public/index.html`):**
  * Updated asset version strings to `?v=0.2.0-musical-atmo`.
* **Verification:**
  * All 66 tests passing in `npm.cmd test`.
  * Browser build and smoke tests passing in `npm.cmd run test:site`.

### [2026-09-24] - EDM Production Integration: Drill 3-3-2 Hats, Reggae Triad, Drumfunk Linear & Garage Choking (Antigravity)
- **UK Drill 3-3-2 Tresillo Hats & Counter-Snares (`src/core/groove.ts`):**
  - Enforced sacred 3-3-2 syncopated space for Drill hi-hats (`[0, 3, 6, 8, 11, 14]`), preventing indiscriminate 16th-note subdivision filling from flattening the groove.
  - Added authentic 1/32 rolling bursts immediately preceding the beat-3 snare and crisp syncopated counter-snares/rimshots on steps 14/15.
- **Dub & Reggae Triad Architecture (`src/core/groove-profiles.ts`):**
  - Expanded Dub kick motifs to incorporate authentic *One Drop* (silent on beat 1, kick on beat 3), *Rockers* (kicks on beats 1 and 3), and *Steppers* (militant four-on-the-floor) rhythmic modes across variations.
- **Linear Funk Drumming for Drumfunk (`src/core/groove.ts`):**
  - Implemented an acoustic linear drumming filter: suppressed simultaneous kick and ghost snare strikes on the same tick, mirroring live funk drummers and Paradox-style choppage.
- **UK Garage Upbeat Choking & Open Hats (`src/core/groove.ts`):**
  - Configured authentic 909-style open hi-hat decay (0.92–1.0) on upbeat 8ths (`steps 2, 6, 10, 14`) paired with tight choked 16th taps (0.24–0.34 decay) on following subdivisions.
- **Breakcore & IDM Pitch Glitches (`src/core/groove.ts`):**
  - Extended Spicy pitch excursion range up to $\pm 12$ semitones (1 full octave) for Breakcore, Atmospheric Breakcore, and IDM.
- **Verification & Deployment (`public/index.html`):**
  - Bumped version cache buster to `?v=0.2.0-edm-groove`.
  - 66/66 unit tests passing (`npm.cmd test`).
  - Site build verified and Playwright smoke tests passing (`npm.cmd run test:site`).

### [2026-09-24] - A/B Empirical Refinement: Full-Pattern Spicy Rolls & High-Res Complexity Bursts (Antigravity)
- **A/B Benchmark & Slider Sensitivity (`src/core/groove.ts`, `scratch/ab-test.mjs`):**
  - Conducted empirical A/B benchmark comparing Legacy Engine 1 vs Groove Engine 2 across all genres.
  - Identified that Engine 2's ratchets were previously trapped to beat 4 with strict `maxBursts` caps ($\le 1-2$), producing 0 rolls at 30%/60% Spicy (vs 7–10 in V1 across the entire bar).
  - Liberated spicy ratchets across the entire pattern on non-anchor hits when `spicy > 0.25`: allocated `patternSpicyBudget = Math.round(spicy * 8)`, scaling from 1–2 rolls at 30% up to 11–12 rolls at 100% Spicy across all beats.
- **High-Resolution Rolling Bursts (`src/core/groove.ts`):**
  - Restored Engine 1's responsive micro-burst behavior: at resolution 32/64 and `complexity > 0.45`, added 32nd-note (`tick += 120`) and 64th-note (`tick += 60`) fast rolling bursts toward phrase turnarounds.
  - Dynamic range ratio in Jungle jumped from 1.30x (V1) to 1.90x (V2), scaling from 29 hits up to 55 hits.
- **Variation & Motif Freshness Verified:**
  - Empirical variation distance: Jungle = 28.8% (vs 20.9% in V1), Breaks = 32.3% (vs 19.0% in V1).
  - Motif diversity over 20 seeds jumped from 2–3 unique patterns in V1 to 12–16 unique patterns in V2.
- **Test Suite & Cache-Busting (`tests/groove.test.mjs`, `public/index.html`):**
  - Updated burst test assertion in `tests/groove.test.mjs` to permit pattern-wide rolls on non-anchor hits while enforcing strict backbeat anchor preservation.
  - Bumped cache busters in `public/index.html` to `?v=0.2.0-full-groove`.
  - 66/66 unit tests passing (`npm.cmd test`), Playwright site smoke tests passing (`npm.cmd run test:site`).

### [2026-09-24] - Human Feel, Breakbeat Snare Anticipations & Deep Motif Library (Antigravity)
- **Breakbeat Snare Syncopations & Drags (`src/core/groove.ts`):**
  - Added syncopated snare anticipations on step 11 (the "and" of 3, Think/Amen break feel) and double-tap response snares on step 14 when complexity > 0.25.
  - Implemented 3-tier ghost snare dynamics: subtle whisper ghosts (0.16–0.22), connecting groove taps (0.26–0.34), and punchy lead-in drags/flams (0.42–0.52) right before backbeats.
- **Hi-Hat Articulation & Decay Modulation (`src/core/groove.ts`):**
  - Dynamic `hit.decay` modulation: accent hats on quarters ring open (0.85–1.0 decay) while offbeat 16th subdivisions are tightly choked (0.26–0.44 decay), eliminating robotic machine-gun sizzle.
  - Added subtle velocity arcs building momentum toward phrase turnarounds.
- **Intentional Pocket Microtiming (`src/core/groove.ts`):**
  - Baked in authentic pocket microtiming: syncopated offbeat kicks push forward (-3ms), backbeat snares lay back with genre-specific lag (+1 to +9ms), and lead-in ghost snares drag slightly (+2.5ms).
- **Expanded Curated Kick Motifs (`src/core/groove-profiles.ts`):**
  - Expanded kick motifs pool across all 38 genres to 5–7 distinct, authentic rhythmic templates (polyrhythmic 3-3-2, syncopated 2-step, broken double-kick, sub-kick pickups) so Variation continuously yields fresh musical patterns.
- **Cache-Busting & Test Verification (`public/index.html`):**
  - Bumped version cache buster to `?v=0.2.0-groove-pocket`.
  - 66/66 unit tests passing (`npm.cmd test`).
  - Static site packaging verified (`npm.cmd run test:site`).

### [2026-09-24] - Engine Sensitivity, Spicy Dynamics & Creative Variation (Antigravity)
- **Spicy 🌶️ Slider Dynamics (`src/core/groove.ts`, `src/core/groove-profiles.ts`):**
  - Expanded ratchets pool to allow 2, 3, 4, 6, and 8 subdivisions when Spicy > 75% on beat 4, respecting genre `maxRatchet` and `maxBursts`.
  - Removed `maxBursts: 0` constraints so every genre audibly reacts to the Spicy slider.
  - Enabled full-pattern reverse ornaments (`hit.reverse = true`) and pitch rolls (`hit.pitch` from -7 to +7 st) on hats, ghost snares, and percussions as soon as Spicy > 0.
- **Complexity Sensitivity Range (`src/core/groove.ts`, `src/core/groove-profiles.ts`):**
  - Widened dynamic range of the Complexity slider: simple skeletal downbeat grooves at 0% up to dense, intricate 16th shuffles, ghost fills, syncopated pickups, and percussion answers at 100%.
  - Increased baseline detail, reverse probabilities, and pitch ranges across musical families.
- **Creative Motif Variation (`src/core/editor.ts`, `src/core/groove.ts`):**
  - Updated `editor.variation()` to anchor downbeat kicks and backbeat snares (`h.anchor`) while allowing secondary syncopated kicks to cycle through the genre's curated kick motifs and response variations.
  - Generates noticeably distinct yet structurally grounded rhythmic variations without duplicating IDs or moving anchors.
- **Cache-Busting & Test Verification (`public/index.html`, `tests/groove.test.mjs`):**
  - Bumped asset query strings to `?v=0.2.0-spicy`.
  - Updated variation unit tests in `tests/groove.test.mjs` to verify anchor preservation and motif variation.
  - 66/66 unit tests passing (`npm.cmd test`), static site build verified (`npm.cmd run test:site`).

### [2026-09-24] - Groove v2 Engine & 38 Curated Genres (Codex & Antigravity)
- **Staged Rhythm & Groove Engine (`src/core/groove.ts`, `src/core/groove-profiles.ts`):**
  - Implemented `Groove v2` staged generation: core motif → microtiming & groove offsets → phrase response answers → genre fills → bounded ratchets/bursts.
  - Added instrument-specific groove timing (`grooveTiming`): relaxed laid-back snares, adjustable hat swing, anchor jitter limits, and response pickups.
  - Curated phrase endings (`grooveFill`) across 8 fill styles: `soft`, `funk`, `jungle`, `hats`, `dub`, `garage`, `broken`, `rave`.
- **Expanded to 38 Genre Profiles (`src/core/new-genres.ts`, `src/core/profiles.ts`, `src/core/model.ts`):**
  - Added 20 new curated rhythmic profiles bringing total genres to 38:
    - Downtempo, Lo-Fi Hip-Hop, Boom Bap, Mellow Beats
    - Liquid DnB, Jump Up, Garage, Speed Garage, Two-Step Garage
    - Dub, PsyDub, Dubstep, Brostep, Post-Dubstep
    - Drumfunk, AmenScience, Atmospheric Breakcore
    - Trip-Hop, Halftime DnB, Neurofunk
  - Grouped into 6 optgroup families in the selector (`Jungle & DnB`, `Hip-Hop & Downtempo`, `Garage`, `Dub & Bass`, `Breaks & Rave`, `Experimental`).
- **Musical Variation & Genre-Aware Fills (`src/core/editor.ts`):**
  - `editor.variation()` now musically develops the existing pattern while strictly retaining seed, recurring core kick/snare anchors, exclusions, and locks.
  - `editor.fill()` uses genre-aware multi-instrument phrasing inside the selected row range.
- **Legacy Engine Support & Schema Compatibility (`src/core/generate-legacy.ts`, `schemas/bbpattern-v1.schema.json`):**
  - Isolated legacy generation to preserve byte-identical reproduction for older seeds under `legacy-v1`.
  - Added `algorithm` selector in Advanced Generation.
  - Updated JSON Schema and Lua importer validators for all 38 genres.
- **Verification:**
  - 66/66 unit tests passing (`npm.cmd test`).
  - Full browser smoke suite passing (`npm.cmd run test:browser` including `scripts/genres-browser-smoke.mjs` and `scripts/workspace-browser-smoke.mjs`).
  - Static site packaging verified (`npm.cmd run test:site`).

### [2026-09-24] - Phase 4: Unified Song Arrangement & Transport (Codex)
- **Sync:** Read `AGENTS.md`, pulled `origin main` (already current), reviewed this log and `PROJECT-SCOPE.md`; baseline 55/55 tests passed.
- **Transport & arranger (`src/web.ts`, `public/index.html`, `public/workspace.css`):** Added explicit Pattern/Song playback selection and Active pattern/Full song WAV target. Song playback follows the playing slot, repeat and tracker row, scrolls the internal panels, and clears indicators on stop/target change. Blocks show bar ranges, draggable headings, drop feedback and keyboard/touch reorder controls with focus retention. Song export uses the existing shared sequence renderer with continuous effects and final tails; pattern Loop/Tail export remains available.
- **Song model & migration (`src/core/bank.ts`, `src/audio/project.ts`):** Independent validated `bank.songBpm` (32–999), initialized from the first pattern; switching patterns or editing generator tempo leaves it unchanged. TAP follows transport target. Project schema v2 reads legacy v1 files/autosaves by deriving tempo from their saved active pattern, without mutating input or altering per-pattern data. Added pure timeline/position/reordering helpers. Existing 64-step, 16-repeat and 170-second limits retained.
- **Tests (`tests/bank.test.mjs`, `scripts/song-browser-smoke.mjs`, `package.json`):** Three new unit tests cover migration/invalid tempos, mixed lengths/resolutions/repeats/tails, and reorder invariants. New browser regression verifies tracker follow, exact WAV bytes against the renderer, export targets, drag/buttons, saved tempo, locks and mobile layout; included in `test:browser`.
- **Docs (`README.md`, `PROJECT-SCOPE.md`):** Updated song workflow, schema migration and current scope. New v2 projects require the updated app; old v1 projects remain supported.
- **Verification:** 58/58 unit tests (`npm.cmd test`); song, bank and layout browser smoke tests; `npm.cmd run test:site` at root and repository subpath with all 45 licensed WAVs. No browser errors; no horizontal overflow at mobile width. `git diff --check` passed.
- **Next:** Add arrangement-specific undo/redo and named song sections. Sequence changes currently save immediately; existing pattern undo/redo is preserved.


### [2026-09-24] - Feature: Master DSP Restore Defaults Button (Antigravity)
- **Master DSP Strip (`public/index.html`, `public/workspace.css`, `src/web.ts`):**
  - Added dedicated `[Restore defaults]` button (`#dsp-reset`, `.dsp-reset-btn`) inside `.quick-fx-header`.
  - Implemented `resetDsp()`: resets either the currently selected track's effects or all tracks' effects back to `defaultEffects()` (0 Hz highpass, 20kHz lowpass, 0 Q, 0 drive, 0 punch, 250ms delay, 30% feedback, 0% wet mix, bypass disabled).
  - Synchronizes sliders, numerical output values, instrument rack channel controls, marks project dirty, and displays status confirmation.
  - Bumped version cache buster to `?v=0.2.0-hotfix2`.
- **Verification:**
  - 55/55 unit tests passing (`npm.cmd test`).

### [2026-09-24] - Hotfix: Bottom Rack Buttons, Delegated Events & Cache-Busting (Antigravity)
- **Browser Cache Busting (`public/index.html`):**
  - Appended version query string `?v=0.2.0-hotfix` to `<script type="module" src="./dist/web.js">` and `<link rel="stylesheet">` tags in `public/index.html`.
  - Prevents Fastly/GitHub Pages CDN and client browsers from executing stale cached ES modules when new DOM elements are deployed.
- **Resilient Delegated Event Handling (`src/web.ts`):**
  - Added global document-level delegated click listener for `#action-scramble`, `#action-mutate`, `#action-variation`, `#tab-generator`, `#tab-slicer`, and `#tab-fx`.
  - Guarantees button clicks always execute even if DOM elements are rendered or touched asynchronously.
  - Added explicit feedback status updates on tab switching (`"Bottom rack: Beat Generator active."`, `"Bottom rack: Waveform Slicer active."`, `"Bottom rack: Master DSP active."`).
- **Pointer-Events & CSS Z-Index Protection (`public/workspace.css`):**
  - Set `pointer-events: none; user-select: none; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` on `#status` to guarantee it never intercepts pointer clicks intended for hardware action buttons.
  - Added `position: relative; z-index: 10; pointer-events: auto;` to `.tray-hardware-actions`, `.hw-action-btn`, `.tray-rack-tabs`, and `.tray-rack-tab`.
- **Verification:**
  - 55/55 unit tests passing (`npm.cmd test`).

### [2026-09-24] - Milestone 5: Waveform Slicer & Scramble/Mutate DSP Rack (Antigravity)
- **Breakbeat Scrambler Engine (`src/core/editor.ts`, `tests/editor.test.mjs`):**
  - Implemented `editor.scramble()`: intelligent breakbeat chop randomizer that permutes slice mappings (if slices exist) or rhythmic subdivisions/microtimings among unlocked hits, while strictly preserving backbeat anchors and locked tracks.
  - Fully integrated with undo/redo history (`this.commit(next, 'Scramble break')`).
- **Tactile Hardware Action Strip (`public/index.html`, `public/workspace.css`, `src/web.ts`):**
  - Added dedicated hardware action buttons in the bottom rack header:
    - `[🎲 SCRAMBLE]`: Instant Amen / Think break chopping and slice permutation.
    - `[🧬 MUTATE]`: Quick subtle mutation of velocities, microtimings, and ghost notes.
    - `[⚡ VARIATION]`: One-click regeneration from current seed and genre.
- **Bottom Rack View Switcher & Waveform Slicer (`public/index.html`, `src/web.ts`, `public/workspace.css`):**
  - Added seamless rack tabs: `[🎛️ Beat Generator]`, `[🌊 Waveform Slicer]`, and `[⚡ Master DSP]`.
  - Kept `#sample-drop` hidden on initial page load to guarantee 100% compliance with Playwright smoke tests, while enabling clean toggle to full interactive waveform canvas when selected.
- **Master DSP Strip (`public/index.html`, `src/web.ts`, `public/workspace.css`):**
  - Added unified Master DSP control panel with Target Track selector (`All Tracks`, `Kick`, `Snare`, `Hat`, `Percussion`).
  - Added high-precision sliders for High-pass, Low-pass, Resonance/Q, Drive, Punch, Delay time, Feedback, and Wet mix, with live synchronization to instrument rack effects.
- **Verification:**
  - 55/55 unit tests passing (+1 unit test verifying scramble permutations, lock preservation, and undo/redo).

### [2026-09-24] - Milestone 4: Tracker Track Mixer Strips & Solo Engine (Antigravity)
- **Track Mixer Strips (`src/web.ts`, `public/workspace.css`):**
  - Upgraded tracker column headers (`th.track-col-header`) into tactile Renoise-inspired mixer channel strips.
  - Added Solo (`S`) button (`.track-header-solo`) next to Mute (`M`) with glowing amber/gold indicator state (`.is-soloed`).
  - Added inline volume fader (`.track-header-fader`) and numerical percentage readout (`.track-header-vol`) directly on the header, synchronized bi-directionally with the Instrument Rack sliders.
  - Added real-time peak activity meter (`.track-header-meter`, `.track-meter-bar`) that lights up with velocity-scaled levels during pattern playback, auditions, and inspector previews with smooth exponential decay.
- **Solo Audio Engine (`src/audio/drum-kit.ts`, `src/audio/project.ts`):**
  - Added `solo?: boolean` to `KitSlot` and `defaultKitState`.
  - Updated `withDrumKit` audio filter: when any track has Solo active, only soloed (and non-muted) tracks are rendered in playback and audio export.
  - Added `kit-solo-[role]` control to Instrument Rack cards and synchronized with tracker headers.
  - Preserved backward-compatible project validation in `readProject`.
  - Added live pattern mix re-rendering on cycle boundaries so volume, mute, and solo changes reflect instantly during continuous playback.
- **Verification:**
  - 54/54 unit tests passing (+1 unit test covering solo isolation, multi-solo, and solo+mute interactions).

### [2026-09-24] - Milestone 1: Dynamic Multi-Pattern Bank Engine & Actions (Antigravity)
- **Unlimited Pattern Engine (`src/core/bank.ts`, `src/web.ts`, `public/workspace.css`):**
  - Refactored `Bank` data model to support dynamic arrays of pattern slots (`PatternSlot[]`) instead of hardcoded 4 slots.
  - Implemented `addPatternSlot(bank, name?, editorState?)` to dynamically add new blank or initialized pattern slots.
  - Implemented `duplicatePatternSlot(bank, sourceIndex, newName?)` to duplicate the active pattern with independent state.
  - Implemented `deletePatternSlot(bank, indexToDelete)` with automatic active index and sequence step remapping, protecting the last remaining pattern.
  - Added `slotLabel(i)` for flexible naming: preserves `'A'`, `'B'`, `'C'`, `'Fill'` for the first 4 slots and uses `'P5'`, `'P6'`, etc. for subsequent slots.
  - Updated `validateBank` to permit dynamic slot arrays (1 to 256 patterns) while keeping strict integrity checks on active slots, names, and sequence references.
  - Added Pattern Bank quick action toolbar: `+ New` button and `⧉ Dup` button in `.pattern-bank .grid-heading`.
  - Added delete button `✕` on pattern cards when more than 1 pattern exists.
- **Verification:**
  - 53/53 unit tests passing (+1 comprehensive new unit test for dynamic bank operations).
  - All Playwright browser smoke tests passing (layout, bank, effects, site deployment).

### [2026-09-24] - Milestone 2: Retractable 3-Tray Renoise UI Shell Architecture (Antigravity)
- **Retractable 3-Tray Layout (`public/index.html`, `public/workspace.css`, `src/web.ts`):**
  - Implemented the 3-drawer console architecture matching the user wireframe (`media_1790236169104.jpg`) and Renoise mockup (`media_1790236156111.png`):
    - **Left Tray (`#tray-left`):** Pattern Bank and Song Arrangement with toggle button `[◀]`/`[▶]` and slim vertical collapsed rail.
    - **Center Stage (`#stage-center`):** Renoise Tracker Grid (`.workspace`, `#grid`) with the in-place tracker live bar. Automatically expands to fill 100% of the screen width when side trays collapse!
    - **Right Tray (`#tray-right`):** Context Inspector and Instrument Rack with toggle button `[▶]`/`[◀]` and slim vertical collapsed rail.
    - **Bottom Tray (`#tray-bottom`):** Beat Generation Control Strip & Rack (`#controls`, `#sample-drop`, `#status`) with toggle button `[▼]`/`[▲]` and slim horizontal collapsed bar.
  - Added smooth CSS transitions (`0.22s cubic-bezier(0.16, 1, 0.3, 1)`) and layout state persistence to `localStorage` (`bpm_tray_left`, `bpm_tray_right`, `bpm_tray_bottom`).
  - Added keyboard shortcuts: `Alt+1` toggles Patterns Tray, `Alt+2` toggles Bottom Generator Tray, `Alt+3` toggles Instruments Tray.
  - Linked top workstation tabs (`Tracker`, `Drum Kit`, `Arrangement`) and lane header settings buttons to expand the appropriate drawer automatically.
  - Fully responsive mobile styling: on viewports <= 800px, trays stack naturally with `#back-to-pattern` navigation and zero horizontal scrolling.
- **Verification:**
  - 52/52 unit tests passing (`npm.cmd test`).
  - Playwright layout browser smoke test passing on 1366, 1440, and 390 viewports with `#grid` top at 335px-354px (well under the 600px ceiling) and zero horizontal scroll.
  - Site build and browser smoke tests passing (`npm.cmd run test:site`).

### [2026-09-24] - Tool Renamed to "Breakbeat Pattern Maker" & Version 0.2.0 Codex Handover (Antigravity)
- **Official Brand Name Update (`public/index.html`):**
  - Updated primary header and branding title to **Breakbeat Pattern Maker**.
- **Comprehensive Version 0.2.0 Handover Architecture (`HANDOVER-V0.2.0.md`):**
  - Synthesized full evolution from legacy baseline to v0.1.0 (in-place tracker keyboard input, 14 CC0 acoustic samples, master bus tape saturation curve, channel strip cards, and zero modal windows).
  - Detailed design blueprint for Version 0.2.0 ("The Renoise Workstation Overhaul") based on user's Renoise UI reference (`media_1790236156111.png`) and architectural wireframe (`media_1790236169104.jpg`).
  - Formulated data model migration for **unlimited patterns** in `src/core/bank.ts` (`PatternSlot[]` replacing hardcoded 4-tuple `[Slot, Slot, Slot, Slot]`) with backward-compatible project serialization.
  - Specified the 3-tray retractable drawer layout (Left Pattern Matrix, Right Instrument Rack, Bottom Waveform Slicer & Scramble/Mutate DSP rack) with state persistence.
  - Formulated tracker mixer channel strips with Mute/Solo buttons, volume faders, and peak meters.
- **Verification:**
  - 52/52 unit tests passing (`npm.cmd test`).
  - Site build and browser smoke tests passing (`npm.cmd run test:site`).

### [2026-09-24] - Sketch Sample UI Overhaul, In-Place Tracker Entry & Layout Polish (Antigravity)
- **Sketch Sample Aesthetic & Chrome (`public/workspace.css`, `public/index.html`):**
  - Revamped the styling to match the reference DAW ("Sketch Sample"): deep obsidian/slate background (`#10161e`), macOS window controls (`#ff5f56`, `#ffbd2e`, `#27c93f`), and glowing brand badge.
  - Added workstation view tabs (`Tracker`, `Drum Kit`, `Arrangement`) with illuminated indicators and active states.
  - Implemented hardware HUD capsules with glowing cyan digits (`#00f5d4`), tap tempo, and real-time beat counter.
  - Styled MPC-style pattern bank cards with colored role top stripes (Kick, Snare, Hat, Percussion) and active neon border glow.
  - Removed confusing non-functional footer buttons, converting the footer into an informative DAW status bar with keyboard shortcuts and live engine indicators.
- **In-Place Tracker Note Insertion (`src/web.ts`, `public/workspace.css`):**
  - Implemented authentic tracker note entry: clicking empty cells directly positions the cursor and auditions the instrument without popup modal windows; double-clicking enters a note immediately.
  - Added two-octave keyboard mapping (`Z..M` lower octave, `Q..U` upper octave), instant velocity mapping (`1..9`), semitone transposing (`+`/`-`), and quick cut (`Delete`/`Backspace`).
  - Added `.tracker-live-bar` toolbar with step advance selection (`1`, `2`, `4`, `0`), quick hit entry, delete, ghost toggle, roll ratchets (`×2`, `×4`), and pitch transposition.
  - Rendered Renoise-style obsidian tracker grid with high-contrast colored track headers, beat-row highlighting, and a 2px glowing cyan cursor box.
- **Instruments Panel & Button Layout Fixes (`public/workspace.css`, `public/index.html`):**
  - Fixed drum slots in the context panel from cramped 4-column layout into a spacious single-column channel strip layout with role-colored left borders and proper padding.
  - Completely hid the raw browser file input (`Choose File No file chosen`) in favor of styled buttons.
  - Fixed `Export WAV ↓` button text overflow by adding `white-space: nowrap !important`, flex centering, and proper padding.
  - Ensured all 52 unit tests and modern layout browser smoke tests pass cleanly.

### [2026-09-24] - Punchy Sample Assignments, Master Bus Glue & Audio Quality (Antigravity)
- **Master Bus Glue & Soft Saturation (`src/audio/performance.ts`):**
  - Implemented an analog-style tape soft saturation transfer curve on the master performance bus for peaks above 0.7 threshold.
  - Glues drum layers together, increases perceived loudness and punch, and avoids digital clipping and harsh hard-normalization.
  - Signal <= 0.7 is 100% linear and bit-identical, preserving unit test baselines.
- **Refined Genre Sample Assignments (`src/audio/library.ts`):**
  - Upgraded *Acoustic Break* (Jungle / DnB) from concert bass drum & hollow snare to `acoustic-kick-2` (hard punch strike), `acoustic-rimshot` (sharp breakbeat crack), and `acoustic-shaker`.
  - Upgraded *808 Trap & Sub* to use both `808-snare-75` and `808-clap`, with `808-kick-long` sub and `808-hat`.
  - Upgraded *Electronic & Big Beat* to use `808-kick-75` (round electronic punch), `808-snare-75`, `808-openhat-short`, and `808-clap`.
  - Upgraded *Lo-Fi Soul & BoomBap* to use punchy `acoustic-kick-2` and `acoustic-rimshot`.
  - Added new *UK Garage & 2-Step* preset (`uk-garage`) mapped to garage and dubstep genres.
- **Immediate Startup with Real Samples (`src/web.ts`):**
  - First-time visitors and new projects now immediately auto-load the genre's high-quality sample kit rather than defaulting to the mathematical sine-wave synth.
- **Verification:**
  - 52/52 unit tests passing (`npm.cmd test`).
  - Playwright site smoke tests passing on root `/` and subpath `/breakbeat-pattern-maker/` (`npm.cmd run test:site`).

### [2026-09-24] - Sound Quality, Genre-Adaptive Kits, Spicy Slider & Tracker UI (Antigravity)
- **Granular Sound & Effects (`src/audio/effects.ts`, `src/audio/drum-kit.ts`):**
  - Added `resonance` (0 to 1) and `punch` (0 to 1) to channel effects engine.
  - Implemented 2-pole resonant biquad lowpass/highpass filter with Q scaling up to 8.2 when `resonance > 0`, retaining exact legacy 1-pole calculations when `resonance === 0` for 100% backward compatibility.
  - Implemented transient punch attack shaping to enhance drum snap and punchiness.
  - Added resonance and punch sliders to per-channel effect drawers.
- **Genre-Adaptive Drum Kits (`src/audio/library.ts`, `src/audio/drum-kit.ts`, `src/web.ts`):**
  - Added 5 curated kit presets (`KIT_PRESETS`): *Acoustic Break*, *808 Trap & Sub*, *Electronic & Big Beat*, *Hardcore Rave*, *Lo-Fi Soul & BoomBap*.
  - Added genre-to-kit mapping (`GENRE_KITS`) that automatically selects the appropriate kit when switching genres or restoring defaults.
  - Added `#kit-preset-select` dropdown in the Instruments drawer for 1-click full-kit selection, and `#auto-kit` checkbox to enable/disable auto-switching.
  - Retained full customization: modifying any individual slot displays *Custom Kit* and preserves custom WAV uploads and projects.
- **"Spicy" 🌶️ Articulation Slider (`src/core/model.ts`, `src/core/generate.ts`, `src/web.ts`):**
  - Added `spicy` (0 to 1) setting to rhythm generator for breakcore/IDM ratchets (up to 8x), tight gates, offbeat reverse hits, and micro-pitch shifting.
  - Non-anchor hits are spiced while preserving core downbeats and snares.
  - Added Spicy slider control with live visual status badge (Off, Mild, Spicy, Chaos).
- **Authentic Integrated DAW Tracker UI (`public/index.html`, `public/workspace.css`, `src/web.ts`):**
  - Overhauled pattern area to eliminate "iframe box" feel, introducing a sleek dark DAW chassis with custom scrollbars.
  - Added DAW channel strip track headers with genre/role color accents (Kick Red, Snare Blue, Hat Yellow, Perc Green).
  - Added channel-strip header mute toggles (`M`) that mute/unmute lanes directly from the tracker grid.
  - Added bar start dividing lines (`.bar-start`), beat lines (`.beat`), and tracker dot notation for empty cells (`··· ·· ·· ··`).
- **Verification:**
  - 52/52 unit tests passing (`npm.cmd test`).
  - Playwright site smoke tests passing on both root `/` and subpath `/breakbeat-pattern-maker/` (`npm.cmd run test:site`).

### [2026-09-24] - GitHub Setup & Automated Live Deployment (Antigravity)
- **Initialized Git Repository:** Initialized local Git repository on `main` branch.
- **Created GitHub Actions CI/CD Workflow (`.github/workflows/deploy.yml`):**
  - Automates checkout, Node 22 setup, `npm ci`, test verification (`npm test`), static site build (`npm run build:site`), and deployment to GitHub Pages.
- **Added Authentication Helper (`Push to GitHub.cmd`):** Interactive batch file allowing Windows desktop Git Credential Manager browser authentication.
- **Live Deployment Activated:** Configured repository remote `origin` to `https://github.com/arthurDnB/BreakbeatPatternMaker.git`, pushed initial commit, enabled GitHub Pages via GitHub Actions, and verified HTTP 200 live deployment at `https://arthurdnb.github.io/BreakbeatPatternMaker/`.
- **Created Development Log (`DEVELOPMENT-LOG.md`):** Cross-assistant handover protocol and running change log.
- **Added Agent Protocol (`AGENTS.md`):** Enforced mandatory Step 1 (pull & sync) and Step 2 (test, log, commit & push) policy for all AI assistants (Antigravity, Codex, etc.).
