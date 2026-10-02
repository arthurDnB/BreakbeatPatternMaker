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
6. **Work with Antigravity:**
   * Treat Codex and Antigravity as collaborators on the same project. Check for active handovers and shared edits before starting; communicate scope, findings, and any blockers when coordination tools are available; avoid duplicate or conflicting changes.
   * At handoff, share the commit or working-tree state, verification results, remaining risks, and the next agreed action. Follow Arthur's latest priority, and stop when Arthur asks you to wait.

---

## 📌 Current Project Status

* **Version:** `0.3.0-alpha`
* **Test Status:** 251 unit tests passing (0 skipped, 0 failed); browser smoke tests, including the Groove V5 workflow, passing (`npm.cmd test` and `npm.cmd run test:site`).
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
* [x] **Groove V4 (Complete):** Typed, profile-driven composition for all 38 genres with separate Complexity layers and Spicy gestures; V1–V3 remain selectable for existing projects. See `docs/GROOVE-V4.md` for tuning guidance.
* [x] **Groove V5 Pilot Engine & 8 Genre Profiles (Complete):** Opt-in engine pilot with authentic phrase planning, monotone Complexity layering, distinct anchor motifs, and full UI/browser integration for Jungle, Liquid DnB, Boom Bap, Trap, Two Step Garage, Dubstep, Breakcore, and AmenScience.
* [x] **Arrangement editing history:** Undo/redo for sequence, slot, repeat and song-tempo changes with context-aware shortcuts.
* [x] **Named song sections:** Optional per-step section labels are preserved in project data, shown in the arranger and transport, and included in history.
* [x] **Visual song timeline:** Colored section blocks, playhead following, insertion gaps, drag reorder and pattern selection with arrangement undo/redo.
* [x] **Quick Start guide:** First-run Generate → Preview → Edit → Export orientation, with persistent dismiss/reopen controls.
* [x] **Recent patterns:** Per-slot snapshots of the last 12 generated, varied or mutated beats, with restore, project persistence and Undo recovery.
* [x] **A/B pattern comparison:** Capture current or recent beats as A and B, preview either with the current kit, and keep a winner with Undo support.
* [x] **Vinyl Texture Rack (Complete):** Nine bundled textures have a user-controlled background playback layer, independent of genre, with loop crossfades and WAV/project support.
* [x] **Break Transcription (Preview):** Local automatic slicing, mapped slice instruments, original-timing reconstruction, marker review and project v4. See `docs/BREAK-TRANSCRIPTION.md`.
* [ ] **Break Transcription Production Gate:** One listener verified onset labels for eight two-second excerpts. Longer excerpts, a second independent annotator, additional unrelated breaks and full-loop listening remain before any industry-standard claim.
* [x] **MP3 export:** Pattern and full-song audio can be encoded at 192 kbps from the same render as WAV. MP3 may contain encoder padding at loop boundaries; WAV remains the exact-loop export.
* [ ] **Future Audio Roadmap:** Velocity-layered drum kits.
* [x] **Sound Library Browser:** Shared searchable and filterable audition/selection for lanes and tracker hits, with browser-local Favorites and Recently used sounds.
* [x] **Optional Melody Generation:** Drum, drum + melody, and melody modes with genre-aware bassline/lead synth motifs, key/scale choice, layer preservation, locks and Undo.
* [x] **Configurable drum lanes:** The four built-in sample lanes can be renamed, hidden, and assigned beat-generator roles independently of their sounds; see `docs/DRUM-LANES.md`.
* [x] **Generated uploaded sample tracks:** Additional sample tracks can receive any drum generator part while keeping manual notes, locks, track audio and project history; see `docs/DRUM-LANES.md`.
* [x] **Sample track generation shaping:** Per-track optional hit density and variation chance keep the genre's anchors while controlling uploaded sample layers independently; see `docs/DRUM-LANES.md`.
* [ ] *Note: Renoise integration has been retired in favor of the standalone in-browser instrument.*

---

## 📝 Change Log

### [2026-10-02] - Tracker-First DAW Workstation UI Revamp, Centered Fixed Transport & Right DSP Inspector Dock (Antigravity)

* **Tracker-First Flex Expansion & Zero Dead Space:**
  - Solved tracker squishing by giving `#grid` full flexible vertical space (`flex: 1 1 auto !important; height: 100% !important; min-height: 520px !important;`), allowing standard viewports to comfortably display 16–25+ rows without cramped scrollbars.
  - Resolved the empty gray panel below the Pattern Bank in `#tray-left` by matching heights, removing redundant dead-space containers, and ensuring flush borders.
* **Collapsed Beat Generator Drawer on Startup:**
  - Configured Beat Generator (`#tray-bottom`) to initialize closed on application startup (`setTrayBottom(true)` with `is-collapsed` and `▸ GENERATOR` toggle badge), granting 100% initial stage height to the pattern grid and instrument rack.
  - Can be toggled open on demand as a hardware drawer without displacing or resizing the transport controls.
* **Persistent Bottom Transport Bar with Immobile Centered Play Button:**
  - Relocated `#transport` out of `#tray-bottom` into a persistent fixed dock at the bottom edge of the DAW (`main.daw-chassis`).
  - Anchored the circular `#play` button directly into `#transport` with a 3-column symmetric grid layout (`grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr)`), fixing it perfectly in the horizontal center of the viewport so it never shifts or scrolls away.
* **Collapsible Right Inspector DSP FX Dock:**
  - Extracted the modular stompbox DSP FX chain out of the bottom tray into a dedicated collapsible right inspector dock (`<aside id="dsp-dock">`).
  - Added `#tab-fx-chain` toggle button in the top global header bar and a draggable vertical splitter `#resize-dsp`.
  - Added programmatic toggle controller `setDspDock(open: boolean)` in `src/web.ts`, guaranteeing generator and DSP controls never crowd each other.
* **Quality Gates & Comprehensive Smoke Testing:**
  - Added `scripts/workstation-layout-smoke.mjs` verifying default-collapsed boot, tracker height (>600px), centered play button stability during drawer expansion, DSP inspector dock toggling, and 390px mobile responsiveness.
  - Updated `scripts/site-browser-smoke.mjs`, `scripts/think-break-site-smoke.mjs`, and `scripts/groove-v5-browser-smoke.mjs` for seamless test coverage across all mounts.
  - Verified 253/253 unit tests pass (`npm.cmd test`) and all browser smoke suites pass (`npm.cmd run test:site`).

### [2026-10-02] - Groove V5 Stable Spicy Gestures and Listening Comparison (Codex)

* Fixed `src/core/groove-v5.ts` so each optional hit's Spicy gesture is selected independently of slider position. Raising Spicy now adds or intensifies expressive edits without redrawing an earlier hit's gesture merely because another gesture became eligible. Added a multi-seed, eight-genre regression gate in `tests/groove-v5-genres.test.mjs`.
* Added `scripts/groove-v5-audition.mjs`, a repeatable local comparison using licensed genre kits: V4 baseline, V5 baseline, and separate Complexity/Spicy changes for all eight pilots. It creates 40 WAVs, an HTML listening/score page and a machine-readable report under ignored `test-results/groove-v5-audition/`. Updated `docs/GROOVE-V5-SYSTEM-DESIGN.md` with usage and a note about denser V5 hats/percussion in several fast genres. Corrected profile comments that overstated listening review or existing gestures.
* Stabilized concurrent UI browser QA: `scripts/site-browser-smoke.mjs` now waits for the asynchronously opened DSP control and gives bundled sample decoding a diagnostic 60-second timeout; `scripts/think-break-site-smoke.mjs` explicitly generates a first beat because a blank project is valid.
* Verification: all 40 WAVs were nonempty, valid RIFF/WAVE files with measured peaks between 0.462 and 0.96; after the concurrent UI merge, `npm.cmd test` passed 253/253 and `npm.cmd run test:site` passed Think layer, root/subpath sample loading, sound browser, break transcription and V5 controls. A human reference listening pass is still required before calling the profiles musically validated.

### [2026-10-02] - Compact 2-Column Beat Generator, Tracker Flex Expansion & Strict DSP Tab Isolation (Antigravity)

* **Tracker Flex-Fill Expansion & Zero Black Void:**
  - Resolved tracker squishing where only 3 rows were visible with a ~35% black void below it.
  - Set `.daw-stage-center` and `.workspace` to `flex: 1 1 auto; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden;`.
  - Configured `.workspace #grid` to `flex: 1 1 auto !important; height: 100% !important; min-height: 280px !important; max-height: none !important; overflow: auto !important;`, allowing the tracker grid to flex-expand and comfortably display 16–25+ rows with smooth scrolling and zero unpainted black voids.
* **Compact 2-Column Beat Generator Synth Console:**
  - Redesigned `#controls` into a high-density, low-profile 2-column layout (`.gen-console-grid-2col`) reducing its vertical footprint by more than 50% (down to ~180px–210px):
    - **Column 1 (Rhythm & Engine):** Engine & Kit Core (Genre, Kit, Bars, Engine) + Rhythm Dynamics (Tempo, Complexity, Spicy).
    - **Column 2 (Harmony & Matrix):** Key & Harmony Mapping (Root Key, Musical Scale, Chord Progression Style) + Compact Advanced Groove Matrix Details (Break style, Layer, Resolution, Exact hits, Swing, Humanize, Fill probability, and instrument densities).
    - **Bottom Hardware Strip:** Slim trigger toolbar with tactile illuminated pads (`⚡ BEAT`, `⚡ BASS`, `⚡ MELODY`, `⚡ PIANO`, `⟳ VARIATION`, `↺ RESTORE DEFAULTS`).
* **Strict DSP Tab Isolation (Zero Knobs on Generator):**
  - Resolved user issue where the 5 modular hardware stompbox units (Analog Filter, Stereo Distort, Mod Phaser, Bus Comp, Maximizer) were appearing directly above the generator controls.
  - Enforced `.re-track-dsp-panel { display: none !important; }` unless `.is-active`.
  - Added explicit `switchBottomTab('generator')` call on application startup in `src/web.ts`, guaranteeing the DSP stompbox rack is never displayed when the Beat Generator tab is active.
  - Preserved external placement of `#vinyl-texture-rack` and `#master-dsp-rack` accordions for clean separation and full test compatibility.
* **Verification & Quality Gates:**
  - Unit test suite: 253/253 passing (`npm.cmd test`).
  - Site test suite: All static builds, Playwright browser checks, Think break checks, Sound browser, and Groove V5 smoke tests passing (`npm.cmd run test:site`).

### [2026-10-02] - Cyberpunk Beat Generator Redesign, Header Tidy-Up & Zero-Void Layout Alignment (Antigravity)

* **Eliminated Lateral Scrollbar & Viewport Leak:**
  - Enforced `overflow-x: hidden !important; max-width: 100vw; box-sizing: border-box;` on `html, body, main.daw-chassis`.
  - Resolved flexible wrapping issues in `.re-track-project-bar`, `.re-track-top-bar`, and `.tray-rack-tabs`, ensuring elements never force lateral overflow on any viewport width down to mobile (320px).
* **Tidied Top Global Header:**
  - Restructured `.app-header.tracker-header.re-track-header` into a clean, compact 2-row layout with zero dead space under the logo:
    - **Row 1:** RE-TRACK v4.2 brand logo with animated neon bars, application menu (`FILE EDIT VIEW TRACK SONG OPTIONS HELP`), 5 view tabs, and a compact project action strip with streamlined export controls.
    - **Row 2:** Transport controls (`▶ SONG`, `▷ PAT`, `■`, `● REC`), HUD badges (`BPM`, `LPB`, `TPL`, `OCT`), stereo peak meter, and live telemetry pills.
  - Set `align-items: center; min-height: 28px; max-height: 32px;` on `.re-track-top-bar` to eliminate the vertical stretching and blank black gap previously under the logo.
* **Separated DSP Stompbox Rack from Beat Generator:**
  - Removed `.tray-rack-tabs` suppression in `public/workspace.css` so bottom tray tabs (`Beat Generator` and `DSP FX Chain`) are cleanly exposed.
  - Ensured `#tab-generator` is active on initial load, showing only `#controls` (the Beat Generator) while cleanly hiding `#re-track-dsp-panel` (`display: none;`).
  - Switching to `#tab-fx-chain` displays the modular stompbox rack and conceals the generator, completely isolating the DSP section so knobs never crowd each other.
* **Modernized Beat Generator into Cyberpunk Hardware Synth Console:**
  - Redesigned `#controls` into 5 sleek modular cards with neon color accents matching the RE-TRACK v4.2 aesthetic:
    - **01: Engine & Kit Core:** Genre selection, drum kit selector, bars count, and groove engine picker.
    - **02: Rhythm Dynamics & Tempo:** Tactile BPM input with genre preset pills, glowing cyan Complexity slider, and glowing amber Spicy slider.
    - **03: Key & Harmony Mapping:** Root Key, Musical Scale, and Chord Progression Style with purple neon badges.
    - **04: Advanced Groove Matrix & Densities:** Collapsible groove matrix containing break rhythm, think slices, grid resolution, exact hit targets, seed, and per-instrument density sliders.
    - **05: Hardware Trigger Console:** Backlit illuminated hardware trigger pads (`⚡ BEAT`, `⚡ BASS`, `⚡ MELODY`, `⚡ PIANO CHORDS`, `⟳ VARIATION`, `↺ RESTORE DEFAULTS`).
  - Preserved all 42 functional DOM IDs and event bindings for 100% backward compatibility and test stability.
* **Eliminated Blank Spaces on Left (#tray-left) and Bottom (#grid):**
  - Updated responsive rules to enforce single-screen viewport lock: `.studio-layout` expands flexibly (`flex: 1 1 auto`), `#tray-left .tray-body` fills height without dead space, and `#grid` expands to 100% height (`flex: 1 1 auto; height: 100% !important;`), eliminating the large black void previously clamped below the Renoise tracker.
* **Verification & Quality Gates:**
  - All 253 unit tests passed (`npm.cmd test`).
  - Full site build and Playwright smoke tests passed on root and subpath mounts (`npm.cmd run test:site`).

### [2026-10-02] - Modular DSP FX Chain Presets & True Audio Processing (Antigravity)

* **Curated DSP FX Chain Presets:**
  - Exported typed `EffectPreset` interface and `EFFECT_PRESETS` catalog with 8 curated sound design presets (`Amen Slammer`, `Reese Saturator`, `Liquid Air & Space`, `Lo-Fi Tape Crunch`, `Dub Space Echo`, `Crisp VCA Bus Glue`, `Sub-Bass Cleaner`, `Clean Bypass`) in `src/audio/effects.ts`.
  - Added `getEffectPreset(id)` lookup helper with full unit test coverage in `tests/effects.test.mjs`.
* **Interactive Presets UI Modal:**
  - Added `#dsp-presets-dialog` modal dialog in `public/index.html` opened via the `≡ PRESETS` button.
  - Features real-time category filtering (`All`, `DnB & Jungle`, `Distortion & Dirt`, `Spatial & Space`, `Dynamics & Polish`, `Utility`, `Custom`).
  - Added custom preset persistence allowing users to save their current stompbox settings to `localStorage` under `bpm_custom_dsp_presets`, load, and delete them on demand.
* **DSP Routing Selector:**
  - Added `#dsp-chain-route-select` in the DSP chain header, allowing live switching between `MASTER BUS` and individual drum lanes (`TRK 01: KICK`, `TRK 02: SNARE`, `TRK 03: HI-HAT`, `TRK 04: PERCUSSION`).
  - Synchronized with `kitPanel.mix` and `#dsp-role-select`, automatically updating all stompbox knobs and header telemetry when routing changes.
* **Authentic Hardware Stompbox Bypass & Parameter Caching:**
  - Updated all 5 stompbox `BYP` buttons (`filter`, `distort`, `phaser`, `comp`, `maximizer`) to cache previous knob positions, visually dim the unit (`.is-bypassed`), turn off status badges, and zero out or bypass the corresponding DSP module.
  - Toggling back to active restores the previous cached parameters immediately into the audio engine and updates the rotary dials.
* **Dynamic Gain Reduction (GR) Meter Animation:**
  - Hooked the `04: BUS COMP` GR meter (`#comp-gr-fill`, `#comp-gr-val`) into the real-time audio playback animation loop, dynamically pulsing and displaying decibel reduction based on compressor punch during playback.
* **Verification & Quality Gates:**
  - All 253 unit tests passed (`npm.cmd test`).
  - Full site build and Playwright browser smoke test suite passed on both root and subpath mounts (`npm.cmd run test:site`).

### [2026-10-02] - "RE-TRACK v4.2" Cyberpunk Tracker DAW Layout Overhaul (Antigravity)

* **Workstation Studio Layout Overhaul:**
  - Upgraded global application layout to match the professional cyberpunk tracker DAW aesthetic of **RE-TRACK v4.2**:
    - **Header & Hardware Transport:** Added `RE-TRACK v4.2` logo, DAW menu bar (`FILE EDIT VIEW TRACK SONG OPTIONS HELP`), real-time telemetry pills (`● DSP: 14%`, `48.0 kHz / 64 spl`, `RAM: 1.8 GB`), hardware mode buttons (`▶ SONG`, `▷ PAT`, `■`, `● REC`), glowing HUD badges (`BPM 174.00`, `LPB 04`, `TPL 12`, `OCT 04`), and animated stereo peak meter with numerical readout.
    - **Three-Column Grid Architecture:**
      - **Left Column:** Matrix Sequencer displaying pattern bank and arrangement sequences with high-contrast active block highlighting and controls.
      - **Center Column:** Renoise-style cyber-tracker grid with hex row numbering (`00`..`1F`), glowing cyan cursor line, and responsive inspector tools.
      - **Right Column (Sample Rack & Wave Preview):** Added `#tray-right` containing interactive sample slot cards (`#sample-rack-list`) with metadata badges (`[ONE-SHOT]`, `[BEAT-SYNC]`, `[ACTIVE]`, memory sizes), and real-time oscilloscope canvas (`#re-track-wave-canvas`).
    - **Bottom Modular Rack (Tabbed):**
      - Created `#re-track-dsp-panel` housing 5 hardware stompbox units: `01: ANALOG FILTER` (Moog Ladder), `02: STEREO DISTORT` (Tube), `03: MOD PHASER` (8-Pole), `04: BUS COMP` (VCA with Gain Reduction meter), `05: MAXIMIZER` (Peak).
      - Added interactive SVG Rotary Dials (`.rotary-dial`) with 270° radial LED arcs, numeric readouts, and pointer drag/wheel interaction two-way bound to the master audio DSP engine (`#dsp-hp`, `#dsp-res`, `#dsp-drive`, `#dsp-lp`, `#dsp-wet`, `#dsp-delay`, `#dsp-feedback`, `#dsp-mix`, `#dsp-punch`).
      - Added tab switcher between `[DSP FX CHAIN]` and `[BEAT GENERATOR]`.
    - **Footer Status Strip:** Added hardware status telemetry (`● AUDIO ENGINE: ONLINE`, CoreMIDI status, song position counter, active instrument badge, and hex cursor coordinate `0x00`).
* **Non-Regression & Quality Assurance:**
  - Preserved all existing functional element IDs (`#play`, `#bpm`, `#grid`, `#arranger`, `#quick-fx-panel`, `#undo`, `#redo`, `#master-dsp-rack`, etc.) and CSS contracts (`body` black background, `#play` border-radius 50%, `.workspace > .grid-heading .legend` presence).
  - All 252 unit tests passed (`npm.cmd test`).
  - All 19 Groove V5 genre pilot tests passed (`node tests/groove-v5-genres.test.mjs`).
  - Full static site build and Playwright browser smoke test suite passed on both root and subpath mounts (`npm.cmd run test:site`).

### [2026-10-02] - Groove V5 Upper-Complexity Profile Refinement (Codex)

* Added quiet, phrase-specific upper-Complexity layers to the Liquid DnB, Boom Bap, Trap, Two Step Garage, Dubstep, Breakcore, and AmenScience pilot profiles in `src/core/groove-v5-profiles.ts`. Jungle already had layers in that range. This removes the observed medium-to-maximum plateau without changing protected kick/snare anchors or V4's default behavior.
* Strengthened `tests/groove-v5-genres.test.mjs` so every pilot must add non-anchor detail above medium Complexity for two seeds. Updated the Dubstep Exact Hits capacity expectation in `tests/exact-hits.test.mjs` and `scripts/groove-v5-browser-smoke.mjs` from 20 to 22 to match the expanded profile vocabulary.
* Verification: `npm.cmd test` passed 251/251; `npm.cmd run test:site` passed root/subpath, sound browser, break transcription and Groove V5 browser checks. Listening-based authenticity and cross-seed quality evaluation remain open; these structural checks do not establish a release-quality musical result.

### [2026-10-02] - Beat Generator 4-Card Hardware Rack, Void Elimination, & DSP Consolidation (Antigravity)

* **Beat Generator Hardware Rack Redesign (`#controls`):**
  - Restructured `#controls` and `.re-track-generator-console` in `public/index.html` and `public/workspace.css` into a high-density 4-card horizontal hardware rack (`.gen-console-grid-4col`) featuring:
    - **Card 01 (Engine & Kit):** Engine selector, Drum Kit picker, and primary instrument controls.
    - **Card 02 (Rhythm & Tempo):** Genre selector, Tempo BPM/tap controls, and Bars dropdown.
    - **Card 03 (Key & Harmony):** Musical scale, root key, and melodic baseline parameters.
    - **Card 04 (Groove Matrix):** Retractable Groove Matrix details rack (`<details id="advanced-generation">`) with complexity, swing, and micro-timing options.
  - Slashed generator vertical footprint by ~300px (from ~450px down to ~140px–160px), freeing substantial vertical space for the tracker grid to display 16–25+ rows in standard viewports without vertical starvation.
* **Elimination of Generator Black Void & Trigger Bar Strip:**
  - Enforced `flex-direction: column !important;` on `#controls` and `.re-track-generator-console`. Previously, `pnlGen.style.display = 'flex'` split `#controls` into a 2-column flex row that forced trigger buttons (`⚡ BEAT`, `⚡ BASS`, etc.) into an isolated right-hand column with a massive black void underneath.
  - Relocated trigger buttons into a dedicated full-width hardware strip (`.gen-trigger-toolbar`) anchored along the bottom of the generator console with grouped generation triggers on the left (`⚡ BEAT`, `⚡ BASS`, `⚡ MELODY`, `⚡ PIANO CHORDS`) and secondary workflow controls on the right (`⟳ VARIATION`, `↺ RESTORE DEFAULTS`).
* **Relocation & Consolidation of Master DSP & Vinyl Texture:**
  - Consolidated loose `<details id="master-dsp-rack">` and `<details id="vinyl-texture-rack">` out of general page flow and neatly integrated them inside the dedicated `🎛 DSP FX Chain` tab (`#re-track-dsp-panel`) under `.dsp-aux-racks`.
  - The Generator tab (`#tab-generator`) now contains 0 DSP controls, eliminating UI clutter and properly categorizing audio effects into the DSP chain tab.
  - Adjusted bottom drawer max-height to 200px for the generator and 380px for the DSP chain panel.
* **100% Backward Compatibility & Smoke Test Modernization:**
  - Preserved all 42 DOM element IDs, name attributes, inputs, and button listeners.
  - Updated `scripts/site-browser-smoke.mjs` to switch to `#tab-fx-chain` when inspecting master DSP and vinyl texture racks, returning to `#tab-generator` for beat/genre workflows.
* **Verification:** `npm.cmd test` passed all 253 unit tests with 0 failures; `npm.cmd run test:site` passed all full static site browser smoke tests across root `/` and `/breakbeat-pattern-maker/` mounts.

### [2026-10-02] - Groove V5 Exact-Hit Capacity and Required Browser QA (Codex)

* Added a reusable V5 capacity calculation in `src/core/exact-hits.ts` using the same dense genre vocabulary as Exact Hits. The generator's maximum and the UI's offered range now agree; the default two-bar Dubstep target changes from impossible 32 to feasible 20 when Exact is selected, without adding generic V4 notes or altering Auto mode.
* Updated `src/web.ts` to recompute the feasible range when relevant generation settings or enabled lanes change, and show the current profile limit. The optional Think layer retains its existing final-stage budgeting because its slice count depends on the merged tracker state.
* Added 41 focused capacity checks in `tests/exact-hits.test.mjs` and a Dubstep clamp/generation check in `scripts/groove-v5-browser-smoke.mjs`. Added that browser smoke to the required `test:site` command in `package.json` so CI exercises V5 controls on every push.
* Verification: `npm.cmd test` passed 251/251; `npm.cmd run test:site` passed root/subpath, sound browser, break transcription, and Groove V5 smoke checks.

### [2026-10-02] - Groove V5 Pilot Milestone & Autonomous AI Office QA (Office: DeepSeek, Antigravity, Codex)

* **DeepSeek Harness:** Authored all 8 pilot genre profiles in `src/core/groove-v5-profiles.ts` (Jungle, Liquid DnB, Boom Bap, Trap, Two Step Garage, Dubstep, Breakcore, AmenScience) satisfying the typed contract (`src/core/groove-v5-contract.ts`) with distinct kick/snare anchor motifs, monotonic complexity steps, and genre-specific fills and cadences.
* **Antigravity (Integration & UI):** Wired Groove V5 into `src/web.ts` and `public/index.html` as an opt-in preview engine while keeping Groove V4 as default. Connected V5 to phrase length/offset, exact hits budgeting, lane densities, and burst span articulation. Created Playwright browser smoke test `scripts/groove-v5-browser-smoke.mjs`.
* **Codex (Automated QA & Review):** Conducted full headless code review (`codex review --uncommitted`). Flagged and resolved control availability guards in `src/web.ts` (enabling Pattern Structure, lane density sliders, and phrase controls under Groove V5), fixed multiline command passing without shell truncation in `scripts/office-dispatch.mjs`, and established nonzero failure exit codes for `office verify`.
* **Verification:** `npm.cmd test` passed all 249 unit tests (including all 18 pilot genre tests un-skipped and passing). `scripts/groove-v5-browser-smoke.mjs` passed engine switching, generation, variation, 28-hit Exact Target, undo, and control visibility. `npm.cmd run test:site` passed root and subpath browser smoke tests.

### [2026-10-02] - Groove V5 Pilot Genre Quality Gate (Codex)

* Added `tests/groove-v5-genres.test.mjs` for Jungle, Liquid DnB, Boom Bap, Trap, Two Step Garage, Dubstep, Breakcore and AmenScience. Each registered profile must pass runtime contract validation, generate its declared kick/snare anchors deterministically through both the direct and public V5 paths, and admit Complexity layers without removing earlier notes.
* Once any V5 override is registered, the suite requires all eight pilots. When all are present it also requires distinct combined kick/snare rhythms at matched tempo for two seeds. Canonical individual snare placements may be shared; the combined groove must differ. The checks skip while the registry is empty so this test-only handoff can land before DeepSeek's profile work.
* Verification: `npm.cmd test` passed 231 existing tests with 18 pilot gates skipped; `npm.cmd run test:site` passed root/subpath, sound-browser and break-browser checks. Unrelated UI and local tooling edits were left untouched.

### [2026-10-02] - Groove V5 Core Contract and Deterministic Pipeline (Codex)

* Added the typed V5 profile/phrase contract, a guarded eight-pilot override registry, and a documented handoff in `docs/GROOVE-V5-SYSTEM-DESIGN.md`. The current inherited V3/V4 baseline is an engineering fixture; DeepSeek's pilot profiles and listening review are still pending.
* Implemented a seed-stable motif spine, explicit phrase plan, monotone Complexity layers, profile cadences, bounded Spicy gestures and V5-selected fills. Named random streams keep anchors unchanged across variation. V5 remains opt-in at the API level; Groove V4 stays the UI default.
* Routed V5 through settings validation, editor variation/locks, Exact Hits after optional Think-layer merging, project persistence, and the shared V3+ audio voice/master path used for Preview and WAV. V5 Exact Hits draws from V5 profile vocabulary and reports its feasible maximum instead of inserting V4 notes.
* Added six focused tests covering all 38 inherited profile baselines, determinism, phrase endings, Complexity/Spicy effects, locks, Undo/Redo, project roundtrip, audio output and Think-layer hit budgeting. Preserved unrelated local changes to `AGENTS.md`, `package.json`, `scripts/office-dispatch.mjs` and `scripts/sync-chat-to-codex.mjs`.
* Verification: `npm.cmd test` passed 231/231; `npm.cmd run test:site` passed root/subpath, sound-browser and break-browser checks.

### [2026-10-02] - Persistent Codex and Antigravity Collaboration Guidance (Codex)

* Added a durable collaboration rule to this shared development guide: coordinate work with Antigravity, check handovers and shared changes, avoid overlapping edits, and provide actionable status at handoff. This records Arthur's request that both assistants communicate and work together.

### [2026-10-02] - Browser MP3 Export (Codex)

* Added **Export MP3** for the active pattern and full song arrangement. It uses the existing 44.1 kHz stereo performance renderer, selected loop/tail option, sample assets, synths, vinyl ambience and master processing, then encodes at 192 kbps in a Web Worker so the tracker stays responsive.
* Shipped the unmodified `@breezystack/lamejs` 1.2.7 ESM encoder as a separate browser file with its LGPL-3.0 license and source attribution. The static-site build packages the worker and encoder for both root and repository-subpath hosting. WAV remains the recommended format for exact seamless loops because MP3 encoder padding can introduce a boundary gap.
* Added a browser check covering pattern and song downloads, browser-decoded audible stereo output, and WAV coexistence. Preserved the unrelated local `package.json` and chat-sync script changes.
* Verification: `npm.cmd test` passed 225/225; `node scripts/mp3-browser-smoke.mjs` passed; `npm.cmd run test:site` passed root/subpath, sound-browser and break-browser checks.

### [2026-10-01] - Exact Tracker Hit Target for Groove V4 (Codex)

* Added an optional **Hits → Auto / Exact** slider and number field in Advanced Generation. Exact sets the total drum/sample tracker-note count across kit lanes, generated sample tracks and the chopped Think layer; ratchets count as one tracker note and synth notes are outside this budget. Auto preserves previous V4 generation.
* Added a deterministic note-budget stage after routing and lock/manual-note preservation. It selects genre-based candidates while balancing instrument roles and bars, retains protected anchors, and gives a clear error when the target is impossible. Generate and Variation remain single Undo steps; older projects default to Auto.
* Added focused unit and browser checks for 38 genres, pattern structures, Think slices, locks, manually authored hits, sample/synth tracks, project roundtrip and the control workflow. Kept the unrelated local `package.json` edit and `scripts/sync-chat-to-codex.mjs` outside this change.
* Verification: `npm.cmd test` passed 225/225; `npm.cmd run test:site` passed root/subpath browser checks; `node scripts/exact-hits-browser-smoke.mjs` passed Generate, Variation and Undo.

### [2026-10-01] - Opt-In Chopped Think Passage Generator Layer (Codex)

* Added **Break Layer → Think Passage 2 · chopped** independently of the existing rhythm preset. Generation places deterministic, genre-guided mapped slices on a dedicated Think Break sample track alongside the current kit; Variation, locked and manual hits, Undo/Redo, save/reopen and the shared Preview/WAV path retain the layer.
* Added a native-rate loader for the bundled unmodified WAV, a ten-slice onset map plus the user-identified intact “uh” phrase, and a direct **Edit Think slices** track control. Slice-map edits survive toggling the layer off and on. The older full-clip kit is clearly labeled as a legacy full-passage retrigger.
* Added focused engine/audio/project tests and browser smoke coverage for root and GitHub Pages subpath, including keyboard and + Note entry on the Think track and graceful handling of a failed sample load. The provisional slice-role labels are based on onset and waveform analysis and still require independent listening review; see `docs/THINK-BREAK-LAYER.md`.
* Verification: `npm.cmd test` passed 221/221; `npm.cmd run test:site` passed root/subpath browser checks, WAV/project roundtrip, sound library and break transcription checks.

### [2026-10-01] - Edit Pattern Bar Count in Tracker (Codex)

* Added a Bars selector beside tracker Resolution and LPB, synchronized with the generator and active pattern. Extending leaves current notes in place; shortening removes out-of-range notes but is blocked if any removed hit is locked. Pattern length edits participate in the existing Undo/Redo history.
* Validation: tests and site checks were not run in this turn.

### [2026-10-01] - Add Think Passage 2 to Snare Choices (Codex)

* Added a snare-role library alias for the existing Think Passage 2 sample. The snare picker can now use the same bundled WAV as the percussion picker, without duplicating audio or changing the default Think kit mapping.
* Validation: tests and site checks were not run in this turn.

### [2026-10-01] - Clarify Tracker Bar Boundaries (Codex)

* Added a compact `BAR n` marker to the beat column at the first row of each bar, while retaining the row index and beat position. Strengthened bar-start separators with a teal top rule, subtle row tint, and left-edge accent for faster visual scanning across the grid.
* Validation: tests and site checks were not run in this turn.

### [2026-10-01] - Match Think Audition Passage Speed (Codex)

* Matched the Fine adjustment screenshot: complete 2.23 s Passage 2 audio player at 1.42x speed (+6.1 semitones), rendered as a 1.570 s sample. Used a fresh asset path and updated the catalog, kit label, credits and sample guidance.
* Verification: `npm.cmd test` passed 215/215, including a duration/hash check for the 1.42x render; `npm.cmd run test:site` built all 345 licensed WAVs, but the browser smoke phase stalled without output and was interrupted.

### [2026-10-01] - Use Full Think Passage 2 Sample (Codex)

* Corrected the target to the complete 2.23-second Passage 2 clip from the Fine adjustment audition, rendered at the user-confirmed +6 semitones (1.577 seconds). Replaced the unrelated provisional single-hit crop and renamed the asset so it cannot be confused with that extraction or served from its old URL.
* Updated the catalog, kit label/description, credits and sample-quality documentation.
* Verification: `npm.cmd test` passed 215/215; `npm.cmd run test:site` built the package with 345 licensed WAVs, but the Edge browser smoke phase again stalled without output and was interrupted.

### [2026-10-01] - Restore Think Vocal Chop Onset (Codex)

* Replaced the provisional same-position crop from passage 2 with the full 0.758 s single hit source-matched against the user’s supplied vocal sample. Repitched the complete hit by +6 semitones, retaining its vocal onset rather than using an estimated cut point.
* Updated the sample catalog hash and source/change notes, plus sample-quality documentation. Renamed the public WAV to `/public/samples/think-uh-plus6-full-vocal.wav` and updated the library path so browsers/CDNs cannot keep serving the earlier provisional crop.
* Verification: `npm.cmd test` passed 215/215; `npm.cmd run test:site` built the deployment package successfully (436 files, 345 WAVs), but the Edge browser smoke phase stalled without output and was interrupted. Follow-up unit tests passed 215/215 and `npm.cmd run build:site` packaged the cache-busted asset successfully; live Pages could not be reached from this session.

### [2026-10-01] - Bundle Think Vocal Chop Instrument (Codex)

* Added the passage 2 Think-style vocal chop repitched exactly +6 semitones as a bundled percussion sample. The user identified it as their original re-performance and asked for attribution under their name; catalog and sample credits list Arthur DnB under CC BY 4.0.
* Added **Think Vocal Chop · +6 st** as a selectable kit preset, so Groove V4 can generate it through its existing percussion rhythm lane. Extended the deployment allowlist to accept attributed CC BY 4.0 records while keeping SHA-256 validation; updated counts and license checks to 345 samples.
* Verification: `npm.cmd test` passed 215/215; `npm.cmd run test:site` passed root and Pages subpath, sound browser, and break transcription smoke checks.

### [2026-10-01] - Passage 2 Think Speed Audition (Codex)

* Based on the user's listening identification of provisional Think passage 2 (2.23–4.46 s), added a local, ignored `test-results/think-uh-ab/passage-2-speed.html` A/B sheet. Its 0.75–2.25× speed control repitches the full passage or an adjustable cut; 14 matched-level WAV candidates cover seven fixed rates for both the passage and the provisional same-position window. Linked it from the existing source-study page. No source audio is distributed.
* Updated `docs/THINK-BREAK-SHAPING.md` with the passage selection, the provisional nature of the cut boundaries, and the distinction between browser playback and offline audition renders. The Ciel mix does not establish an exact source or speed.
* Verification: generated 14 WAVs and checked duration, peak limits and page link; local page JavaScript parses; `npm.cmd test` passed 214/214; `npm.cmd run test:site` passed root and Pages subpath plus sound-browser and break-transcription checks. Preserved unrelated `package.json` and chat-sync script changes.

### [2026-10-01] - Ciel Beat-Onset Focus for Think Audition (Codex)

* Incorporated the user's screenshot mark near 23.9 s into the local Think audition. Added a focused 23.7–24.75 s Ciel excerpt and passage 2/3 repitch comparisons at 1.12× and 1.80×; all 30 audio players loaded in a browser check.
* A constrained correlation search near the marked beat remained weak (maximum absolute value 0.273 in tested candidates), so neither the earlier 27.59 s result nor the dark waveform region establishes the vocal's source or exact onset. Updated `docs/THINK-BREAK-SHAPING.md` with this distinction and the user-supplied Human Synthetics Think-break tutorial as a workflow reference. Exact video processing settings were not independently verified.
* Verification: `npm.cmd test` passed 214/214; `npm.cmd run test:site` passed root and Pages subpath plus sound-browser and break-transcription checks; the local audition page loaded all 30 audio players without browser errors.
* The local audition audio remains ignored, and the unrelated `package.json` and chat-sync changes remain untouched.

### [2026-10-01] - Think Vocal Source-Matching and Shaping Study (Codex)

* Matched the supplied 0.758-second `thinkbreak_uh.mp3` to `think--all5.wav` at 0.68875 s with 0.9950 native-rate normalized correlation. The exact WAV passage gives a source-preserving starting point for further chops.
* Built a local, ignored `test-results/think-uh-ab/source-study.html` audition sheet with 24 A/B candidates plus the Ciel reference: five provisional Think passages, matched-position windows, lossless-source cuts, repitch, coloration and exploratory granular renders. A browser check loaded all 25 audio players without page errors.
* Full-mix correlation weakly prioritized passages 2 and 3 at 1.42× around 27.59 s in Ciel; documented that this does not identify the recording or its production chain. Added `docs/THINK-BREAK-SHAPING.md` with the findings, listening sequence, sources and a conditional DSP integration path. Original audio remains outside Git; no unverified processor was added to the app.
* Verification: `npm.cmd test` passed 214/214; `npm.cmd run test:site` passed root and Pages subpath plus sound-browser and break-transcription browser checks. The local audition sheet loaded all 25 audio players without page errors.
* Preserved unrelated local `package.json` and `scripts/sync-chat-to-codex.mjs` changes.

### [2026-10-01] - Per-Hit Waveform Cut and Independent Speed/Pitch Shaping (Codex)

* Added a non-destructive sample cut to the hit inspector: waveform markers plus exact millisecond start/end inputs, pending Preview, Apply, Undo/Redo, and project persistence. The shared audio renderer applies the cut before stretching and fades both new edges for 2 ms, so saved pattern/song playback and WAV use the same region.
* Added a per-hit Repitch/Stretch mode override. Stretch now compensates the duration change from a later pitch shift when the internal stretch ratio is within its 0.5×–2× range. Extreme pitch/speed combinations still clamp to that range. The main hit cut does not alter a separate drum layer.
* Fixed the duplicate `edit-target` DOM ID that could overwrite the Edit track selector, and made choosing the lane sound clear an old explicit sample assignment. Documented use and DSP limits in `docs/SAMPLE-SHAPER.md`.
* Extended the local Think vocal A/B page with trimmed pitch-preserving candidates K–M. They are audition hypotheses; no match to the Ciel reference is claimed. The local WAVs remain ignored under `test-results/`.
* Verification: `npm.cmd test` passed 214/214, `npm.cmd run test:site` passed root and Pages subpath plus sound-browser and break-transcription browser checks. A focused browser check confirmed trim draft, Preview, Apply and Undo. Pre-existing changes in `package.json` and `scripts/sync-chat-to-codex.mjs` were left untouched.

### [2026-09-30] - Track-Targeted Beat Editing (Codex)

* Added an **Edit track** control under **Selection & locks**, with All drum tracks or an individual built-in/uploaded sample lane. The target combines with selected cells or rows, and fills can now be aimed at a specific ending on one track.
* Passed the selected track through Mutate, Simplify, Increase complexity, Generate Fill and the rack Mutate action. Manual sample hits, locked notes, main anchors, other tracks and Undo/Redo keep their existing protections.
* Updated `docs/DRUM-LANES.md` and added a two-uploaded-track regression check verifying each editor action changes only its target. Verification: `npm.cmd test` passed 213/213; `npm.cmd run test:site` passed root and Pages subpath browser checks.

### [2026-09-30] - Editing Generated Uploaded Sample-Track Beats (Codex)

* Extended Mutate and genre fills to generated hits on uploaded sample tracks. Their assigned beat part determines mutation phrasing, while collision and gesture protection stays within each physical track. Manually entered or edited sample hits, anchors and individually locked hits remain untouched.
* Added Simplify and Increase complexity tracker actions. Simplify removes a controlled share of softer optional hits; Increase complexity draws genre-aware detail from a richer seeded candidate and distributes additions across eligible lanes. Both use one Undo/Redo step and work on selected rows or cells.
* Documented the actions in `docs/DRUM-LANES.md` and added editor tests for custom-track mutations, fills, locks, manual-note preservation and history. Verification: `npm.cmd test` passed 212/212; `npm.cmd run test:site` passed root and Pages subpath browser checks.

### [2026-09-30] - Per-Track Generation Density and Variation Chance (Codex)

* Added a compact **Shape** section to uploaded sample tracks with optional-hit density and variation chance controls. Both are per-pattern track settings and default to 100% for existing projects.
* Density keeps an exact, deterministic share of stronger optional notes; variation chance changes the admitted optional notes across variations. Main anchors, hand edits and locks remain in place. Added validation, Undo/Redo and project roundtrip coverage in the routing tests and updated the site browser check.
* Documented how the two controls differ in `docs/DRUM-LANES.md`. Verification: `npm.cmd test` passed 210/210; `npm.cmd run test:site` passed root and Pages subpath checks.

### [2026-09-30] - Beat Generation on Uploaded Sample Tracks (Codex)

* Added a compact **Beat part** selector to each uploaded sample track. Any number of tracks can receive Kick, Snare, Hi-hat or Percussion notes; built-in lanes can be left in Manual only mode for a fully custom sample beat.
* Marked generated sample-track notes so regeneration replaces only those notes. Individually locked notes, hand-entered notes and notes manually edited in the tracker remain, with one Undo/Redo step per generation. Melody-only generation keeps custom drum tracks intact.
* Corrected the shared drum-kit renderer to use each uploaded track's own sample for generated hits in Preview, song playback and WAV export. Added validation, project roundtrip, audio and browser tests; updated `docs/DRUM-LANES.md`.
* Verification: `npm.cmd test` passed 208/208; `npm.cmd run test:site` passed root and Pages subpath browser checks.

### [2026-09-29] - Configurable Drum Lanes and Generator Routing (Codex)

* Added per-pattern names, visibility, and generator-role assignments for the four built-in sample lanes. The tracker configuration lets a user put, for example, Snare rhythm into a renamed Kick sound lane, layer one beat part across multiple lanes, or omit a lane from generation. Hidden lanes keep existing notes/audio but receive no newly generated hits.
* Kept audio lane identities stable while routing new generated hits before editor lock/Undo handling. Settings persist through project and pattern history; older projects retain the original four visible lanes and matching roles. Added validation for malformed layouts, tests for sound routing, locks, deterministic layering, Undo, and project save/reopen, plus `docs/DRUM-LANES.md`.
* Verification: `npm.cmd test` passed 205/205. `npm.cmd run test:site` passed root and Pages subpath browser checks, including the new lane controls, all 344 samples, sound browser, and break transcription. A final validation-only change was followed by another passing full unit run.

### [2026-09-29] - Blank Tracker First-Run Guide (Codex)

* Added a compact guide inside an empty tracker with direct actions for sample track upload, synth track creation, break import, and beat generation. It uses the existing controls and disappears as soon as the active pattern contains a note; an empty project or pattern shows it again.
* Added browser coverage for the blank state, synth track creation, and generation handoff. The browser test resets its project before unrelated clipboard checks so its original lane layout stays stable. Verification: `npm.cmd test` passed 202/202; `npm.cmd run test:site` passed root and Pages subpath builds, all 344 samples, sound browser, and break transcription checks.

### [2026-09-29] - Blank Tracker Project Option (Codex)

* Changed **New project** to open a choice between **Blank tracker** and **Starter beat**. Blank projects retain the default four drum lanes and settings but clear all generated hits; Starter beat keeps the generated Jungle pattern. Added a reminder that starting a project replaces the current workspace.
* Added responsive styling and site browser coverage for both choices at the root and Pages subpath. Verification: `npm.cmd test` passed 202/202; `npm.cmd run test:site` passed build, both app mounts, all 344 bundled samples, and sound/transcription browser checks.

### [2026-09-29] - Expressive Piano Comping (Codex)

* Updated `src/core/piano.ts` so each generated chord can have a softer, thinner guide-tone response instead of only one uniform block attack. Genre feel sets response placement; Complexity raises comping activity, while high Spicy can add a brief upper-voice pickup. Gestures remain seeded, bounded by their harmony change, and use varied velocity and note lengths.
* Added `tests/piano-generation.test.mjs` coverage for deterministic comping, sparse versus complex output, softer responses, and chord-boundary safety. Documented the behavior in `docs/PIANO-HARMONY.md` and refreshed the local piano audition with the user's preferred one-shot. Verification: `npm.cmd test` passed 202/202 and `npm.cmd run test:site` passed root/subpath, sound browser, and break transcription browser checks.

### [2026-09-29] - Functional Jazz Harmony Styles (Codex)

* Added the persisted Harmony selector with Jazz, Neo-Soul, Modal / Quartal, and Genre diatonic styles. Jazz is the default for new generation settings; existing saved patterns remain unchanged until generated again.
* Replaced degree-only harmony selection with functional major/minor progression templates. Jazz progressions include iiø7–V7♭9–i9, ii–V–I movement, extended dominants, and turnarounds; Neo-Soul uses extended smooth changes and Modal uses quartal voicings. Shared bass and lead harmony follows the same root changes.
* Added automated checks for functional resolution, chromatic tension, deterministic style differences, and browser/project persistence. Updated the local audition generator to compare the jazzy phrase using the procedural tone and the user's uploaded WAV. Stabilized the site smoke workflow by closing overlapping instrument popovers before auditioning Kick. Research reference: [Berklee piano voicings](https://online.berklee.edu/takenote/basic-piano-voicing-techniques/), [reharmonization and chord function](https://online.berklee.edu/takenote/reharmonization-simple-substitution/), and [modal quartal harmony](https://online.berklee.edu/takenote/harmonic-considerations-modal-harmony/). Verification: `npm.cmd test` passed 201/201; `npm.cmd run test:site` passed both URL mounts plus sound-library and break-transcription checks; `node scripts/melody-browser-smoke.mjs` passed.

### [2026-09-29] - Shared Lush Piano Harmony and CC0 Upright Bank (Codex)

* Added `src/core/harmony.ts` and rebuilt `src/core/piano.ts` around changing, seeded genre progressions, scale-aware seventh/ninth voicings, smooth inversions, bass-aware low notes, and distinct chord rhythms. `src/core/melody.ts` now follows the same harmony changes so independently generated bass and lead parts align.
* Added a curated 26-recording CC0 FreePats upright piano bank under `public/piano/`, with provenance/hash catalog, site packaging checks, and lazy decoding in `src/audio/piano-bank.ts`. The default generated piano uses soft/strong recordings; the existing procedural tone remains selectable.
* Added uploadable single-note piano WAV support with an editable MIDI root, stereo repitching, project v8 persistence, and a shared rendering path for live Preview, song playback and WAV export (`src/audio/synth-instrument.ts`, `src/audio/performance.ts`, `src/audio/project.ts`, `src/web.ts`). The user's one-shot stays local and is not redistributed.
* Expanded unit and browser checks for harmony, velocity layers, sample hashes, upload/project roundtrip and static-site loading (`tests/piano-generation.test.mjs`, `scripts/melody-browser-smoke.mjs`). Added `docs/PIANO-HARMONY.md` and a local audition generator. Verification: 199/199 unit tests, `npm.cmd run test:site` on root and subpath, and the melody/piano browser smoke test passed.

### [2026-09-29] - Independent Beat, Bass, Melody & Piano Generators (Codex)
- **Layer controls (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Replaced the mode/part dropdown workflow with separate **Beat**, **Bass**, **Melody**, and **Piano chords** actions. Key and scale stay available; each button regenerates only its own lane and retains unrelated generated/user material. Each action keeps one-step editor Undo and locked-note behavior.
- **Chord composer (`src/core/piano.ts`, `src/core/editor.ts`, `src/core/model.ts`, `src/core/settings.ts`, `src/core/compile.ts`):** Added a deterministic, genre-profiled piano progression/voicing generator, using genre-specific sparse, swung/offbeat, active and dense chord rhythms; chord extensions scale with Complexity and follow the selected key/scale. Generated chords occupy their own reusable **Generated Piano** synth track.
- **Piano sound (`src/audio/synth-instrument.ts`):** Added a struck-string piano-style procedural voice with inharmonic partials and natural decay, shared by live playback and WAV export. This is a lightweight synthesized piano timbre, not a bundled sampled grand piano; a properly licensed multisample bank remains a sound-quality follow-up.
- **Project and QA (`src/audio/project.ts`, `tests/piano-generation.test.mjs`, `scripts/melody-browser-smoke.mjs`, `public/index.html`):** Piano instrument tracks save as project version 7 while versions 2–6 continue loading. Added scale-safety, deterministic output, genre rhythm, layer preservation, locks, Undo, project roundtrip and render checks; expanded browser smoke to exercise the four layer buttons. Bumped deployment cache keys.
- **Verification:** `npm.cmd test` passed 195/195; `npm.cmd run test:site` passed at root and GitHub Pages subpath, including site, sound-library and break-transcription browser checks. `node scripts/melody-browser-smoke.mjs` passed Beat/Bass/Melody/Piano actions, preservation, Undo/Redo, project roundtrip and WAV export.

### [2026-09-29] - Refresh Melody Engine Browser Cache (Codex)
- **Deployment entrypoint (`public/index.html`):** Bumped the `dist/web.js` cache key so deployments after melody-engine changes request the new browser module instead of reusing the earlier app bundle.
- **Melody browser check (`scripts/melody-browser-smoke.mjs`):** Asserted the generated lane is clearly named `Generated Lead`, notes follow the selected D Blues scale, and the phrase avoids four-note ascending scale runs. User-created `Synth 1` / `Synth 2` lanes remain separate from the generated lane by design.
- **Verification:** `npm.cmd test` passed 191/191; `npm.cmd run test:site` passed root and Pages subpath browser checks; `node scripts/melody-browser-smoke.mjs` passed with key/scale and ascending-run assertions.

### [2026-09-29] - Genre-Aware Melody Phrases (Codex)
- **Composer (`src/core/melody.ts`, `src/core/melody-profiles.ts`):** Replaced fixed scale-degree cycling with seeded chord-root movement, recurring pitch contours, voice leading, short-scale functional tones, phrase responses and a guard against sustained ascending scale runs. All 38 genres now have explicit harmony/contour rules and selected rhythm differences; Complexity adds connecting notes and Spicy adds a phrase-ending pickup and restrained octave accent. A duplicated optional step found in the full audition run was removed before note creation.
- **Review and guidance (`scripts/melody-audition.mjs`, `docs/MELODY-COMPOSER.md`):** Added a repeatable 76-example local WAV listening set covering Bassline and Lead for every genre, plus tuning guidance and source references. Independent producer listening is still needed before any industry-standard quality claim.
- **Verification (`tests/melody-generation.test.mjs`):** Added checks for distinct output at matched tempo, no four-note ascending scale runs, pentatonic harmony movement, and valid editor commits across every genre/part. `npm.cmd test` passed 191/191; `npm.cmd run test:site` passed root and Pages subpath browser checks. The pre-existing local `package.json` and chat-sync changes were preserved.

### [2026-09-29] - Optional Melody Generation (Codex)
- **Composer (`src/core/melody.ts`, `src/core/melody-profiles.ts`):** Added a seeded melodic engine with explicit profiles for all 38 genres, bassline/lead motifs, scale-aware notes, Complexity details, and restrained Spicy pickups and octave accents. It works independently of the selected drum engine.
- **Editor and project model (`src/core/model.ts`, `src/core/settings.ts`, `src/core/compile.ts`, `src/core/editor.ts`):** Added generation mode, melody role, key, and 16 scales as optional compatible settings. Dedicated generated synth lanes are reused; selected unlocked notes regenerate while locked notes and unrelated layers remain. Each generation is one Undo/Redo step. Existing project versions still load.
- **Generator UI (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Exposed Drums only, Drums + Melody, and Melody only plus part/key/scale selectors. Restoring defaults resets the composition controls; changing genre keeps user-selected composition controls. Project save/open and local autosave retain the settings, and all generated notes use existing Preview/song/WAV rendering.
- **Verification (`tests/melody-generation.test.mjs`, `scripts/melody-browser-smoke.mjs`):** Covered every genre and scale, deterministic output, mode isolation, locked notes, custom tracks, Undo/Redo, project roundtrip, audible synth render, WAV, and browser controls. `npm.cmd test` passed 188/188, `npm.cmd run test:site` passed at root and Pages subpath, and the focused melody browser smoke passed. Unrelated local `package.json` and chat-sync script changes were preserved.

### [2026-09-29] - Built-in Synth Tracks (Codex)
- **Track and note model (`src/core/model.ts`, `src/core/compile.ts`, `src/core/editor.ts`):** Added synth tracks alongside existing WAV sample tracks. Pitched notes carry absolute MIDI pitch and musical duration, while tracker selection, copy/move, locks, Undo/Redo, and beat regeneration preserve them. The compiler rejects sample-only commands on synth notes and incompatible cross-type moves.
- **Shared audio (`src/audio/synth-instrument.ts`, `src/audio/performance.ts`, `src/audio/drum-kit.ts`):** Added Bass, Pluck, and Pad presets with editable waveform, ADSR envelope, and low-pass filter. Preview, song playback, and WAV export render the same deterministic polyphonic voices. Voices are capped at eight per track, repeated timbres are cached, and synth render memory is bounded.
- **Tracker and projects (`src/web.ts`, `public/index.html`, `public/workspace.css`, `src/audio/project.ts`):** Added **+ Synth Track**, a compact track-header instrument panel, octave-based keyboard note entry, note pitch/length inspector controls, and same-row chord entry. Project schema v6 saves synth tracks without embedding audio, while v2–v5 files retain their existing behavior. Updated cache keys for deployment.
- **Verification (`tests/synth-tracks.test.mjs`, `scripts/synth-browser-smoke.mjs`, `tests/v3-integration.test.mjs`):** Covers synth editing/history, pitch, deterministic output, mute, song arrangements, project roundtrip, browser note/chord entry, regeneration, and WAV export. `npm.cmd test` passed 183/183; `npm.cmd run test:site` passed at root and GitHub Pages subpath; focused synth browser smoke passed. The unrelated `package.json` and chat-sync script changes remain untouched.

### [2026-09-29] - User-Managed Sample Tracks (Codex)
- **Custom tracker lanes (`src/core/model.ts`, `src/core/compile.ts`, `src/core/editor.ts`, `src/core/bank.ts`):** Added arbitrary WAV-backed user tracks alongside the four existing generator roles. Each lane receives a stable track ID, supports tracker note entry, cell selection/copy/paste/move, rename/reorder, mixer level/mute/solo, and stays intact when the four-role beat generator regenerates its pattern. Arrangement validation now accepts custom lane selections.
- **Playback and projects (`src/audio/drum-kit.ts`, `src/audio/project.ts`):** Route sample-track hits through the shared Preview/WAV renderer and per-track mixer. Project schema v5 embeds referenced PCM and restores track data on reopen; older project formats remain supported.
- **Tracker workflow (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Added **+ Sample Track** to upload a WAV as a new independently editable tracker lane. Added dynamic lane keyboard navigation, preview and note entry; the existing Kick/Snare/Hi-hat/Percussion generator lanes remain available and generator-owned.
- **Regression coverage (`tests/user-tracks.test.mjs`, `tests/v3-integration.test.mjs`, `scripts/user-tracks-browser-smoke.mjs`):** Cover compilation, generation preservation, undo/redo, save/reopen audio, mute/solo rendering, upload, tracker keyboard navigation, transfer lanes, and sample embedding. The historical unsupported-project-version check now uses version 6 because v5 is supported.
- **Verification:** `npm.cmd test` passed 179/179; `npm.cmd run test:site` passed at `/` and `/breakbeat-pattern-maker/`; focused user-track browser smoke passed. User-provided `package.json` sync script change and `scripts/sync-chat-to-codex.mjs` were preserved.

### [2026-09-29] - Tracker Cursor and Step Persistence (Codex)
- **Editing preferences (`src/web.ts`):** Extend browser-local workspace state to remember tracker cursor row, lane, inner field (note/instrument/volume/pan/delay/effect), and step advance. Restore the cursor within the active pattern's valid row range; retain compatible defaults for older preference records.
- **Browser regression (`scripts/workspace-state-browser-smoke.mjs`):** Verify selected volume field, Kick lane, row, and four-row advance survive reload alongside existing workspace state.
- **Cache keys (`public/index.html`):** Bumped app stylesheet and module cache identifiers.
- **Verification:** Focused workspace state browser smoke passed; `npm.cmd test` passed 177/177; `npm.cmd run test:site` passed at root and GitHub Pages subpath.

### [2026-09-29] - Workspace State Restoration (Codex)
- **Workspace preferences (`src/web.ts`):** Persist the selected tracker view, open workspace panels, expanded instrument accordions, and grid/timeline/page scroll positions in browser-local preferences. Restore these after project startup without racing the initial render or overwriting saved preferences with default state.
- **Browser regression (`scripts/workspace-state-browser-smoke.mjs`):** Added reload coverage for view, panels, instrument accordion, and scroll positions.
- **Cache keys (`public/index.html`):** Bumped app stylesheet and module cache identifiers for the update.
- **Verification:** Focused workspace state browser smoke passed; `npm.cmd test` passed 177/177; `npm.cmd run test:site` passed at root and GitHub Pages subpath.

### [2026-09-29] - Empty States and Recovery Guidance (Codex)
- **Empty states (`public/index.html`, `src/web.ts`, `src/audio/sound-browser.ts`, `public/workspace.css`):** An empty song arrangement now explains how to start one and reports that playback/export are disabled until a pattern is added. A no-results sound search offers a one-click clear-filters action and returns focus to search.
- **Actionable errors (`src/web.ts`):** WAV export failures suggest shorter renders or freeing browser memory while preserving error details. Project-open failures explain which project file formats to choose.
- **Browser coverage (`scripts/sound-browser-site-smoke.mjs`, `scripts/song-browser-smoke.mjs`):** Verified search recovery and empty-arrangement recovery back to a populated sequence. Updated script/style cache keys.
- **Verification:** `npm.cmd test` passed 177/177; `npm.cmd run test:site` passed at the root and GitHub Pages subpath; focused song-arrangement browser smoke passed.

### [2026-09-29] - Accessible Slider Labels and Focus (Codex)
- **Accessible controls (`public/index.html`, `src/audio/drum-kit.ts`, `src/web.ts`):** Added explicit names to generation, hit-shaping, master-DSP and dynamically built kit/effect sliders. Generation and vinyl controls now expose spoken values with meaningful units; tracker lane faders announce percentages as they change.
- **Keyboard focus (`public/workspace.css`):** Replaced reliance on browser-default focus styling with a consistent 2px OLED-theme focus outline and offset.
- **Browser check (`scripts/accessibility-browser-smoke.mjs`):** Verifies slider names, updated spoken values, visible keyboard focus and lane-specific kit/DSP control names. Updated script/style cache keys.
- **Verification:** Focused accessibility Playwright smoke passed.

### [2026-09-29] - Responsive Layout Coverage (Codex)
- **Responsive smoke test (`scripts/layout-browser-smoke.mjs`):** Expanded layout checks from two desktop widths to eight viewport sizes spanning 320–1920 px. Checks now verify the application shell stays within the viewport without page-level horizontal scrolling, tracker visibility, desktop transport behavior, and mobile hit editing. Tracker channel scrolling remains an intentional internal scroller.
- **Test maintenance:** Removed obsolete first-180-pixel transport-position expectation and selectors for retired inspector UI; the sticky transport check now tests its visible position after page scrolling.
- **Verification:** Focused Playwright layout smoke passed at all eight viewport widths.

### [2026-09-29] - Undo and Redo Action Feedback (Codex)
- **History controls (`src/web.ts`, `public/index.html`):** Pattern and arrangement Undo/Redo buttons retain disabled states when their stacks are empty and expose the pending action in accessible labels/tooltips. Undo/Redo status messages now announce the action label, including keyboard-triggered arrangement history. Updated the asset cache key.
- **Browser checks (`scripts/site-browser-smoke.mjs`):** Verified initially unavailable buttons are disabled and labeled, and that pattern and arrangement actions update the labels and announce the actual action after undo/redo.
- **Verification:** `npm.cmd test` passed 177/177; `npm.cmd run test:site` passed at root and GitHub Pages subpath, including sound browser and break transcription checks.

### [2026-09-29] - Tracker Boundary and Bar Navigation (Codex)
- **Tracker keys (`src/web.ts`, `public/index.html`):** Added Home/End jumps to the first/last row and PageUp/PageDown jumps by one bar, retaining the current lane and tracker field. Shift extends the selected cell range. Added these key bindings to the shortcut dialog and bumped the app cache key.
- **Browser coverage (`scripts/tracker-navigation-smoke.mjs`):** Checks both ends, one-bar moves, and return navigation alongside existing arrow wrapping, LPB/resolution remapping, and Undo.
- **Verification:** `npm.cmd test` passed 177/177; tracker navigation browser smoke passed; `npm.cmd run test:site` passed at root and GitHub Pages subpath with sound browser and break transcription checks.

### [2026-09-29] - Clear Save and Export Feedback (Codex)
- **Project and WAV downloads (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Renamed the manual project action to **Download project + samples** to distinguish portable backups from local autosave. Added a persistent accessible file-action message naming the downloaded file, embedded content, active pattern/song target, bar count, BPM, duration, loop/tail behavior, master trim when applied, and that the browser controls download location. Errors appear in the same feedback area with error styling.
- **Browser checks (`scripts/site-browser-smoke.mjs`, `scripts/song-browser-smoke.mjs`):** Verified active-pattern WAV and project-backup messaging plus full-song and active-pattern target summaries. Corrected the song smoke test to read the editable HUD tempo input's value rather than its empty `textContent`, allowing the song export assertions to run.
- **Verification:** `npm.cmd test` passed 177/177; `npm.cmd run test:site` passed at root and GitHub Pages subpath; `node scripts/song-browser-smoke.mjs` passed transport, arrangement export, tempo, lock, and responsive checks.

### [2026-09-29] - Keyboard Shortcut Reference (Codex)
- **Shortcut overlay (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Added a compact, responsive keyboard reference organized by tracker editing, playback/history and workspace navigation. It opens from the header Shortcuts button or `?`, and closes with Escape, Done, the close control or backdrop; native dialog focus handling returns to the opener.
- **Coverage (`scripts/site-browser-smoke.mjs`):** Added browser checks for displayed shortcut sections, button and `?` opening, and Escape/Done closing. Existing bindings are documented from their current handlers; no tracker shortcut semantics changed.
- **Cache and verification:** Updated page asset cache keys. `npm.cmd test` passed 177/177; `npm.cmd run test:site` passed at root and the GitHub Pages subpath, including shortcut-dialog button/`?` open and Escape/Done close checks, sound browser and break transcription smoke tests.

### [2026-09-29] - Pitch-Preserving Playback, Sound Layers, and Audio Quality Checks (Codex)
- **Sample speed (`src/audio/time-stretch.ts`, `src/audio/drum-kit.ts`, `src/audio/performance.ts`, `src/core/model.ts`, `src/core/compile.ts`):** Added a per-sample Repitch/Preserve pitch choice. The latter uses bounded, deterministic waveform-similarity overlap/add for 0.5×–2× speed, shares the same renderer for Preview and WAV, and leaves source PCM intact. The default remains Repitch; saved projects and sample profiles retain the chosen mode.
- **Layering and mono checks (`src/audio/drum-kit.ts`, `src/audio/audio-quality.ts`, `src/audio/voice-v3.ts`, `src/audio/project.ts`):** Added an optional second catalog/uploaded sound per lane with relative level, ±10 ms offset, polarity inversion, and a first-100-ms mono-cancellation warning. Layer voices share a trigger for kick/snare/hat choking; projects embed the layer audio and validate its mapping.
- **Master output (`src/audio/audio-quality.ts`, `src/audio/performance.ts`, `src/web.ts`):** Groove V4 uses linked, linear peak trim against a conservative 0.96 ceiling informed by a 4× interpolated estimate, with the applied trim shown after WAV export. V1–V3 retain their published PCM/master behavior. This is not a certified true-peak or loudness mastering stage.
- **Verification and limits (`tests/audio-quality.test.mjs`, `scripts/audio-quality-browser-smoke.mjs`, `docs/AUDIO-QUALITY.md`, `PROJECT-SCOPE.md`):** Added tests for duration/pitch, stereo alignment, headroom, mono cancellation, layer timing/choke, save/reopen, deterministic WAV data, and a packaged browser workflow including upload replacement/removal. `npm.cmd test` passed 177/177; `npm.cmd run test:site` passed at root and subpath; the focused audio-quality browser smoke passed. Stretch artifacts on complex percussion remain a listening-review risk.

### [2026-09-28] - Blind Second-Listener Break Review (Codex)
- **Independent review path (`scripts/break-review-server.mjs`, `scripts/break-review-state.mjs`, `tools/break-review/`):** Added a separate `--blind` mode on localhost port 4175 with a blank marker draft, no first-review onset values in the state response, reviewer-mode validation, and a distinct second-review export. The original reviewer draft/export remain separate.
- **Agreement analysis (`scripts/break-review-agreement.mjs`, `scripts/compare-break-reviews.mjs`):** Added source-identity validation and per-recording comparisons at ±5/10/20 ms, including matched, missed and extra onsets, timing error, precision/recall/F1, micro summaries, and family-macro F1. The output labels these as human agreement rather than detector accuracy.
- **Documentation and verification (`docs/VERIFIED-BREAK-BENCHMARK.md`, `tests/break-review.test.mjs`, `scripts/break-review-smoke.mjs`):** Added launch/use/compare steps and tests for empty blind starts, isolated export, report metrics, mismatched sources, autosave, and UI blank state. `npm.cmd test` passed 171/171, local break review browser smoke passed for normal and blind modes, and `npm.cmd run test:site` passed at root and project subpath.

### [2026-09-28] - Tracker Resolution and LPB Controls (Codex)
- **In-tracker grid controls (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Added Resolution and Lines Per Beat selectors to the tracker toolbar so users can reduce the visible row density directly after importing a chopped break. Resolution selects 1/8–1/64 and sets a matching LPB; LPB can then be tuned independently from 1 to 32.
- **Timing and persistence (`src/core/model.ts`, `src/core/compile.ts`, `src/core/settings.ts`, `src/core/editor.ts`, `src/core/bank.ts`, `src/audio/project.ts`):** Persist per-pattern LPB, keep absolute hit ticks intact when changing the grid, and make tracker row-based entry, copy/move, delay, fills and selection validation follow the active LPB. Resolution and LPB edits use normal pattern Undo/Redo. Clipboard paste now checks both settings.
- **Verification (`tests/editor.test.mjs`, `scripts/tracker-navigation-smoke.mjs`):** Added coverage for undoable row remapping and browser interaction. `npm.cmd test` passed 168/168; tracker navigation browser smoke passed; `npm.cmd run test:site` passed for both root and project subpath, including audio/sample and break-review checks.

### [2026-09-28] - Listener-Verified Break Benchmark (Codex)
- **Verified references (`benchmarks/verified-real-breaks.json`, `docs/VERIFIED-BREAK-BENCHMARK.md`):** Validated the user's completed review export against the eight source identities and SHA hashes, then recorded 101 accepted labels (94 interior onsets and seven fixed-start hits) without committing source WAVs or local paths. Reran the provisional and verified reports on the same recordings and detector build.
- **Scoring correction (`scripts/real-break-metrics.mjs`, `scripts/real-break-benchmark.mjs`, `tests/real-break-benchmark.test.mjs`):** Excluded reference hits within 1 ms of the region start from onset-detector scoring because both slicers create that boundary without detection. Reports now show scored and fixed-start counts separately; the detector and its shipped defaults were not changed.
- **Result and decision:** The verified references yield family-macro F1 of 0.613 at ±10 ms for the current defaults, versus 0.360 for the previous detector. Provisional F1 was 0.670; the label set changed while the detector did not. Grouped cross-validation yields 0.625, only 0.013 above the fixed defaults and worse on the Funky Drummer holdout. Keep current detector settings; inspect onset timing and extra cuts in Think and Apache before proposing production changes. Updated `docs/REAL-BREAK-BENCHMARK.md`, `docs/BREAK-TRANSCRIPTION.md`, and `PROJECT-SCOPE.md` to distinguish historical provisional results from the listener-reviewed audit.
- **Verification:** The repository copy of the verified labels matches the user's export byte-for-byte. `npm.cmd test` passed 167/167 and `npm.cmd run test:site` passed at root and project subpath, including sound-browser and break-transcription smoke checks.

### [2026-09-28] - Extend Waveform Zoom to 128× (Codex)
- **Waveform zoom (`tools/break-review/app.js`):** Raised the maximum magnification from 32× to 128×.
- **Verification (`scripts/break-review-smoke.mjs`, `docs/REAL-BREAK-BENCHMARK.md`):** Updated the browser check to zoom to 128×, confirm the control stops at its maximum, and reset to Fit.

### [2026-09-28] - Zoomable Break Review Waveform (Codex)
- **Waveform inspection (`tools/break-review/index.html`, `tools/break-review/app.js`, `tools/break-review/style.css`):** Added 1×–32× zoom by mouse wheel or buttons, pointer-anchored zoom, Fit reset, and a navigator slider for moving through the zoomed view. Waveform samples, marker hit targets, timing grid, cursor, and playhead now use the visible time range; selecting an onset in the list brings it into view.
- **Verification (`scripts/break-review-smoke.mjs`, `docs/REAL-BREAK-BENCHMARK.md`):** Browser smoke covers button and wheel zoom, navigator movement, Fit reset, playback windows, autosave, reload, and mobile layout.

### [2026-09-28] - Separate Hit and Context Audition (Codex)
- **Review player (`tools/break-review/index.html`, `tools/break-review/app.js`):** Replaced the single broad audition action with **Hit only** and **Hit + context**. Hit only begins 6 ms before the selected onset and ends before the next non-rejected candidate, capped at a 350 ms tail; context playback retains a short lead-in and tail. Space now plays Hit only.
- **Verification (`scripts/break-review-smoke.mjs`, `docs/REAL-BREAK-BENCHMARK.md`):** Browser smoke checks confirm isolated playback uses a later start and shorter window than context playback; local playback, save/reload, and mobile layout remain covered.

### [2026-09-28] - Local Break Onset Listening Review (Codex)
- **Review tool (`tools/break-review/`, `scripts/break-review-server.mjs`):** Added a loopback-only waveform and audio review screen for all eight source recordings. A reviewer can play each complete passage or a hit context, keep/reject/adjust onset markers, add missed hits, and resume from an autosaved local draft. The server checks each WAV against its benchmark SHA-256 and serves only whitelisted recordings; neither audio nor draft is committed.
- **Verified-label gate (`scripts/break-review-state.mjs`, `scripts/real-break-benchmark.mjs`):** Export remains disabled until every passage has been played in full and all markers have decisions. Accepted onset times export to a separate ignored verified-label file, and the benchmark accepts that file as an explicit third argument; the provisional tracked annotations remain intact. This tool enables listening verification but does not itself make the detector industry-standard.
- **Verification (`tests/break-review.test.mjs`, `scripts/break-review-smoke.mjs`, `docs/REAL-BREAK-BENCHMARK.md`):** Added state/export tests and a local browser check of audio playback, decisions, autosave, reload, and mobile layout. `npm.cmd test` passed 166/166; `npm.cmd run test:site` passed; local review smoke passed.

### [2026-09-28] - Continuous Break Benchmark and Detector Tuning Audit (Codex)
- **Real recording references (`benchmarks/real-breaks.json`, `docs/REAL-BREAK-BENCHMARK.md`):** Reviewed onset proposals against waveform/novelty plots for the first two seconds of all eight user-supplied WAVs, covering 152 candidate attacks across Amen, Apache, Funky Drummer and Think families. Stored SHA-256 hashes and onset times without adding the recordings or private local paths to Git. Labels are visually reviewed but still require independent listening confirmation.
- **Reproducible harness (`scripts/real-break-benchmark.mjs`, `real-break-metrics.mjs`, `real-break-wav.mjs`):** Added PCM16/PCM24 mono/stereo decoding, one-to-one precision/recall/F1 at ±5/10/20 ms, timing errors and missed/false marker times. A 12-setting sweep uses leave-one-break-family-out validation so Apache and Funky variants cannot leak between tuning and evaluation. Four focused unit tests verify 24-bit decoding, matching, family weighting and reference integrity.
- **Result and decision:** The current 0.35 sensitivity / 35 ms spacing scores 0.670 family-macro F1 at ±10 ms; the previous detector scores 0.446, and cross-validated parameter choices score 0.650. The current defaults are the best overall setting in the sweep, so no detector or UI default change was justified. Funky Drummer soft accents and overlapping Apache part 2 attacks remain difficult. Synthetic assembled fixtures remain at 0.933 F1; these figures must not be combined or presented as industry-standard accuracy.
- **Verification and scope:** `npm.cmd test` passed 163/163; `npm.cmd run test:site` passed root/subpath and sound/browser checks; `npm.cmd run audit:breaks` passed. Updated `docs/BREAK-TRANSCRIPTION.md` and `PROJECT-SCOPE.md` to link the real-break report and retain the listening/full-loop quality gate.

### [2026-09-28] - Automatic Break Transcription Preview (Codex)
- **Analysis and review (src/audio/break-analysis.ts, break-analysis-worker.ts, break-panel.ts):** Added cancellable local multiband/spectral onset detection and an Import break dialog. Users can select a region/bar count, zoom, edit/pin markers, undo/redo, audition slices and compare dry Original/Reconstructed playback. Imports create a new bank slot without overwriting the active pattern or song tempo. Explicit 120-slice overflow handling keeps existing cuts.
- **Mapped instruments (src/core/model.ts, slice-instrument.ts, compile.ts, editor.ts, src/audio/slices.ts, src/web.ts):** Pattern-owned stable slice maps with independent mapped notes and pitch. Added keyboard octave selection, individual editing for multiple hits in one row, mapping-aware clipboard/history/locks, and an Edit slices workflow. Notes retain exact measured timing.
- **Audio and persistence (src/audio/performance.ts, voice-v3.ts, drum-kit.ts, project.ts):** Shared resolution for Preview/song/WAV, source-frame reconstruction, optional loop-edge smoothing, and no automatic drum chokes on mapped slices. Mapped-only playback bypasses automatic master saturation for source fidelity. Version 4 saves all referenced PCM and mapping history while retaining older project support; independent instrument settings survive arrangement playback.
- **Packaging and verification:** Worker dependencies included explicitly in the static site. Added 9 unit tests and root/subpath browser checks for imports, cancellation, same-row editing, Undo/Redo, save/reopen, WAV and mobile layout. Required suites: `npm.cmd test` (159/159), `npm.cmd run test:site`. Added `npm.cmd run audit:breaks` and `docs/BREAK-TRANSCRIPTION.md`.
- **Measured quality and limitation:** Dry stereo reconstruction meets <=1e-5 sample-error checks at 22.05/44.1/48 kHz. Assembled licensed one-shot fixtures score mean onset F1 0.933 (0.947 on two held-out fixtures) at ±10 ms. These are trigger-annotated assembled fixtures; independent human-annotated continuous recordings/listening validation are still required. UI and docs label this a preview, not perfect or industry-standard transcription.

### [2026-09-28] - Collapsible, Genre-Independent Vinyl Texture Controls (Codex)
- **Compact control row (public/index.html, public/workspace.css):** Replaced the always-visible full-width controls with a small collapsed “Vinyl Texture” disclosure. Click the label to show the On/Off, recording, Preview and level controls.
- **Genre behavior (src/web.ts):** Kept the control available for every genre and removed genre-driven activation, deactivation and sound randomization. The ambience setting and selected recording now remain under user control when the genre changes.
- **Verification (scripts/site-browser-smoke.mjs):** Browser smoke covers collapsed state, all nine recordings, availability in Breakcore and Lo-Fi Hip-Hop, Off-by-default behavior, manual enable and project roundtrip. `npm.cmd test` passed 150/150; `npm.cmd run test:site` passed at root and GitHub Pages subpath.

### [2026-09-28] - Tracker Header and Hit Inspector Polish (Codex)
- **Tracker layout (`src/web.ts`, `public/workspace.css`):** Docked the drum legend in the tracker heading rather than the pattern-bank heading. Added subtle separators between quick-action groups and clear keyboard focus rings.
- **Hit inspector (`public/index.html`, `public/workspace.css`):** Grouped pitch, mix, articulation, and action controls visually; emphasized Apply, retained every existing control, and let the inspector wrap at narrower desktop widths instead of clipping its controls. Updated asset cache keys.
- **Verification (`scripts/site-browser-smoke.mjs`):** Added checks for legend placement and no mobile page overflow while the inspector is open. `npm.cmd test` passed 150/150; `npm.cmd run test:site` passed at root and GitHub Pages subpath.

### [2026-09-28] - Sleek Compact Vinyl Texture Rack, Lo-Fi Auto-Activation & Randomizer (Antigravity)
- **Compact & Sleek Single-Row Layout (`public/workspace.css`, `public/index.html`):** Overhauled `#vinyl-texture-rack` from a bulky panel into a slim 28px single-row strip with subtle warm amber accents (`#9c825a`), compact dropdown, tactile Preview button, concise inline label (`Continuous ambience`), and responsive wrap on mobile devices.
- **Lo-Fi Exclusivity & Auto-Activation (`src/web.ts`, `public/index.html`):** Configured `#vinyl-texture-rack` to be hidden by default across other genres and visible strictly when Lo-Fi Hip-Hop (`lofihiphop`) is selected. Switching to Lo-Fi Hip-Hop automatically enables vinyl ambience and selects a texture; switching away from Lo-Fi disables and hides it.
- **Standard Volume Default of -10 dB (`src/audio/vinyl-texture.ts`, `src/audio/project.ts`, `public/index.html`, `tests/vinyl-texture.test.mjs`, `tests/workspace.test.mjs`):** Adjusted the default vinyl texture volume from -30 dB to -10 dB so ambient crackle and warmth is clearly audible out-of-the-box.
- **Dynamic Vinyl Texture Randomization (`src/audio/vinyl-texture.ts`, `src/web.ts`):** Added `getRandomVinylTextureId()` to select random vinyl textures (`lofi2-vinyl-01` through `09`), automatically rotating to a fresh texture on each pattern Generate (`build`) and Variation (`regenerate` / `action-variation`).
- **Test Suite & Verification (`scripts/site-browser-smoke.mjs`, `tests/vinyl-texture.test.mjs`, `tests/workspace.test.mjs`):** Verified 150/150 unit tests pass (`npm.cmd test`), and full Playwright browser smoke test (`npm.cmd run test:site`) passes across root and GitHub Pages subpath.


### [2026-09-28] - Continuous Vinyl Ambience Layer & Scratch Synth Retirement (Codex)
- **Continuous Vinyl Texture (`src/audio/vinyl-texture.ts`, `src/audio/performance.ts`, `src/audio/project.ts`):** Removed the scratch synthesizer instrument and moved the nine bundled vinyl surface recordings out of the percussion one-shot lists into a dedicated background ambience engine. Vinyl texture runs as an optional continuous layer across pattern preview, song playback, and WAV export with smooth crossfades at loop points and bar boundaries.
- **Controls & Interface (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Added a dedicated Vinyl Texture control strip with an On/Off toggle, selection among the 9 bundled textures (`lofi2-vinyl-01` through `09`), independent volume slider (defaulting to a subtle -30 dB), and an audition Preview button.
- **Project Migration & Kit Curation (`src/audio/library.ts`, `src/audio/project.ts`, `src/audio/sound-browser.ts`):** Migrated older projects referencing `synth-scratch` or vinyl textures as percussion hits to `lofi2-percussion-02`, moving identified vinyl textures to the background ambience setting. Updated Dusty Vinyl and Lo-Fi kit presets.
- **Verification (`tests/vinyl-texture.test.mjs`, `scripts/site-browser-smoke.mjs`):** Added unit coverage for texture loop rendering, level scaling, and project migration. Verified 150/150 unit tests pass (`npm.cmd test`) and all site smoke tests pass (`npm.cmd run test:site`).

### [2026-09-28] - Groove V4 Instrument Density (Codex)
- **Generator (`src/core/model.ts`, `src/core/settings.ts`, `src/core/groove-v4.ts`):** Added optional per-lane density from 0% to 200%. Neutral 100% reproduces prior V4 events; lower values thin optional hits, while higher values unlock more genre-defined details and fills. Protected kick/snare anchors remain, and missing settings in older projects default to 100%.
- **Controls (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Added compact Kick, Snare, Hi-hat and Percussion sliders in Advanced Generation, enabled only for V4. Genre defaults reset them; drafts and generated patterns retain values through save/reopen.
- **Guidance and verification (`docs/GROOVE-V4.md`, `tests/groove-v4.test.mjs`, `scripts/groove-v4-browser-smoke.mjs`):** Documented the controls and checked all 38 genres for deterministic density, protected anchors, fills, locks, validation, project roundtrip and browser export. `npm.cmd test` passed 147/147, `npm.cmd run test:site` and the focused V4 browser smoke passed.

### [2026-09-28] - Sound Library Browser (Codex)
- **Shared sound browser (`src/audio/sound-browser.ts`, `public/index.html`, `public/workspace.css`):** Added one searchable dialog for track lanes and individual tracker hits, collection/featured filters, Favorites, Recently used, separate Preview and Use actions, keyboard navigation and responsive layout. Favorites and recent bundled sound IDs persist in browser storage.
- **Consistent audio (`src/audio/library-audio.ts`, `src/audio/drum-kit.ts`, `src/web.ts`, `src/audio/project.ts`):** Consolidated bundled WAV loading and preparation so lane and per-hit choices use identical PCM. Preview renders a temporary candidate through the shared playback engine without changing the beat. Hit assignment remains one Undo/Redo action. Failed loads retain the previous sound and show an error. Portable projects now accept the existing built-in vinyl scratch sound.
- **Guidance and verification (`README.md`, `scripts/sound-browser-site-smoke.mjs`, `tests/workspace.test.mjs`):** Documented the workflow and added a deployed-subpath browser check for search, persistence, preview isolation, load failure, lane and hit selection, Undo/Redo, project roundtrip, WAV export and mobile width, plus a vinyl scratch project regression. `npm.cmd test` passed 145/145; `npm.cmd run test:site` passed.

### [2026-09-28] - Bundled Sample Quality and Curated Kits (Codex)
- **Sample preparation (`src/audio/sample-prep.ts`, `src/audio/drum-kit.ts`):** Replace peak-only normalization with transient RMS balancing under role-specific peak ceilings, trim dead air with pre-roll and apply short edge fades to bundled samples. Preserve uploaded PCM and use the same prepared assets in Preview and WAV export.
- **Kit curation (`src/audio/library.ts`, `src/audio/drum-kit.ts`):** Add focused UDNB jungle, liquid and roller kits; route related genres to them and promote kit sounds in a Featured menu group. Correct a pre-existing Boom Bap preset that assigned a hi-hat sample to the percussion lane.
- **Audit and verification (`scripts/audit-samples.mjs`, `docs/SAMPLE-QUALITY.md`, `tests/sample-prep.test.mjs`):** Verify all 344 catalog hashes and report signal/provenance metrics. Owner confirmed redistribution clearance for UDNB and Lo-Fi Vol. 2; source metadata gaps remain documented. Added preparation and kit-validity tests. `npm.cmd test` passed 144/144; `npm.cmd run test:site` passed.

### [2026-09-28] - Live Sample BPM Follow (Codex)
- **Sample speed (`src/audio/drum-kit.ts`, `src/web.ts`):** Added per-sound Follow BPM with effective Repitch calculated from playback BPM / original break BPM at render time. Pattern and song tempos drive their respective playback and WAV exports; per-hit speed overrides still take priority. The instrument panel shows the current effective rate, warns outside 0.5×–2×, and uses the saved manual speed there. Moving the manual Speed slider or pressing Match BPM once exits follow mode; editing original BPM stops already rendered playback so the next Preview uses the new rate.
- **Persistence and interface (`src/audio/project.ts`, `public/workspace.css`, `public/index.html`, `README.md`):** Saved Follow BPM in each sound profile, validated imported settings, refreshed the visible rate when tempo or transport target changes, and documented the workflow. Existing projects without this setting remain manual.
- **Verification (`tests/sample-shaping.test.mjs`, `scripts/sample-shaping-browser-smoke.mjs`):** Added pattern/song tempo, override, range fallback, project roundtrip, and browser interaction checks. `npm.cmd test` passed 141/141; focused browser smoke passed; `npm.cmd run test:site` passed at root and GitHub Pages subpath.

### [2026-09-27] - Per-Sample Repitch and Tone Shaping (Codex)
- **Sample controls (`src/audio/drum-kit.ts`, `src/web.ts`, `public/index.html`, `public/workspace.css`):** Added remembered speed, original break BPM, pattern-BPM matching, low-pass tone, attack and decay defaults for each selected sound. Added optional per-hit overrides in the tracker inspector, with Preview and one-step Undo/Redo. The hidden waveform slicer can now be opened from an instrument's “Chop a break” action.
- **Shared audio and persistence (`src/audio/sample-shaping.ts`, `src/audio/performance.ts`, `src/audio/voice-v3.ts`, `src/audio/project.ts`, `src/core/model.ts`, `src/core/compile.ts`):** Repitch changes playback duration and pitch, while per-voice filtering and envelopes shape both Preview and WAV export. Validated the new fields and kept older projects compatible.
- **Guidance and tests (`README.md`, `tests/sample-shaping.test.mjs`, `scripts/sample-shaping-browser-smoke.mjs`):** Documented the Think-style chop workflow and added render, project, Undo/Redo and browser checks for the new controls.
- **Verification:** `npm.cmd test` passed 139/139; `npm.cmd run test:site` passed at root and GitHub Pages subpath; focused sample-shaping browser smoke passed.

### [2026-09-27] - Profile-Driven Groove V4 Engine (Codex)
- **Generator (`src/core/groove-v4.ts`, `src/core/groove-v4-profiles.ts`):** Added a deterministic five-stage composition pipeline and typed, editable profiles for all 38 genres. Complexity adds genre-specific call/response and counter-rhythms; Spicy articulates secondary hits with bounded timing, pitch, reverse, rolls and source-offset chops while protecting the kick/snare spine.
- **Integration (`src/core`, `src/audio`, `src/web.ts`, `public/index.html`):** Made V4 the new-generation default and routed variations, selected fills, locks, project persistence, Preview and WAV through the existing editor and audio path. V1, V2 and V3 remain selectable and previously saved projects keep their engine.
- **Guidance and regression coverage (`docs/GROOVE-V4.md`, `README.md`, `PROJECT-SCOPE.md`, `tests/groove-v4.test.mjs`, `scripts/groove-v4-browser-smoke.mjs`):** Documented profile tuning and added 38-genre determinism, slider, anchor, fast-tempo, chop, editor and browser export checks. Kept the loop audit pinned to V3 and closed instrument panels in the existing site smoke before its transport/export checks.
- **Verification:** `npm.cmd test` passed 135/135; `npm.cmd run test:site` passed at root and GitHub Pages subpath; focused V4 browser smoke passed generation, project save and WAV export.

### [2026-09-26] - Stable Play Control Layout (Codex)
- **Transport (`public/index.html`, `public/workspace.css`):** Removed the visible stopped/playing status text from the transport so changes in playback state cannot resize or shift the play control. The button retains its accessible Play/Stop label; bumped the workspace stylesheet cache key.
- **Verification (`scripts/transport-layout-smoke.mjs`):** All 128 unit tests pass; browser check confirms the status stays hidden and the play button keeps its position through state changes.

### [2026-09-26] - Scrollable Tracker Instrument Overlay (Codex)
- **Track instrument menu (`src/web.ts`, `public/workspace.css`):** Replaced the table-clipped dropdown with a viewport-positioned panel anchored to its track control. It chooses the side with more space, stays inside the viewport, and limits its height so the panel can scroll through all sound and playback settings.
- **Responsive behavior:** Repositions the panel on tracker/window scrolling and resizing, including on narrow layouts.
- **Verification (`scripts/instrument-panel-smoke.mjs`):** All 128 unit tests pass; a browser smoke test at a short viewport confirms the panel stays on-screen and its contents scroll.

### [2026-09-26] - Tracker Cursor Highlight and Boundary Navigation (Codex)
- **Tracker cursor (`src/web.ts`, `public/workspace.css`):** Added a persistent, high contrast outline and accessible current-location marker for the active tracker value, so the selected subfield is easy to find while editing.
- **Keyboard movement:** Arrow keys now move continuously through tracker fields and lanes, wrapping cleanly from the first to last row (and back) within the active pattern. Numeric field auto-advance follows the configured step and wraps at the pattern edge.
- **Verification (`scripts/tracker-navigation-smoke.mjs`):** TypeScript build and all 128 unit tests pass; a focused Playwright smoke test verifies the cursor indicator and row/lane wrapping.

### [2026-09-26] - Tracker FX Commands and Mobile Workspace Repair (Codex)
- **Tracker model and editing (`src/core/model.ts`, `src/core/compile.ts`, `src/core/editor.ts`, `src/web.ts`):** Added an optional validated per-hit FX command, sixth tracker value, keyboard entry of command plus two hex digits, field-only clearing, and one-step Undo/Redo. Full pattern JSON and portable projects preserve FX; the older strict Lua transfer stays unchanged and warns when it cannot represent FX. Older v1/v2/v3 projects still load.
- **Shared audio renderer (`src/audio/performance.ts`, `src/audio/voice-v3.ts`, `src/audio/project.ts`):** Added sub-row sample offset, forward/reverse direction, pitch slide, note cut, and retrigger playback for all generator engines. Preview, pattern/song playback, and WAV export use this same renderer. The old `09`, `01`, and `02` spellings are accepted as aliases for the current Renoise `0S`, `0U`, and `0D` commands; `0B` retains its current reverse meaning.
- **Workspace (`public/workspace.css`, `public/index.html`, `src/web.ts`):** Repaired the collapsed pattern rail despite a saved inline width, combined summary and legend, moved selection/lock tools into a compact menu, and reduced the open hit inspector to a single desktop strip. On mobile, restored header-first ordering, contained horizontal tracker scrolling, fixed offscreen instrument panels, wrapped transport and kit controls, and kept the page within the viewport.
- **Verification (`tests/tracker-fx.test.mjs`, `scripts/site-browser-smoke.mjs`, `README.md`):** Added rendered-audio and persistence checks for FX, plus root/subpath browser checks for FX typing, sidebar collapse, and phone layout. See README for the supported command subset and keyboard syntax.

### [2026-09-26] - Beat Generator Vertical Narrowing & Consolidation (Antigravity)
- **Engine selector moved to primary row (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Relocated the generation engine selector (`#algorithm`: Groove v3, Groove v2, Legacy v1) from the nested `Advanced Generation` drawer up into the primary controls bar (`.primary`), sitting directly in the open slot next to `Bars` (`#bars`). Formatted with dedicated `.control-engine` styles matching the other primary DAW controls.
- **Phrase and Resolution consolidation in Pattern group (`src/web.ts`, `public/workspace.css`):** Consolidated the `Pattern` fieldset into 2 rows: Break style spans Row 1 full-width, while Resolution (`#resolution`) and Phrase (`#phraseLength`) sit side-by-side in Row 2, occupying the slot previously held by Engine. Starting bar offset (`#phraseOffset`) neatly spans below them when phrase expansion is enabled.
- **Seed relocated into Structure group (`src/web.ts`, `public/workspace.css`):** Moved Seed (`#seed`) into the `Structure` fieldset beneath Pattern Structure and Fill Amount, filling previously unused empty space. All three fieldsets (`Pattern`, `Groove`, `Structure`) now align to an identical, compact 2-row height across 3 equal columns, cutting the vertical footprint of `Advanced Generation` by ~45%.
- **Generation summary relocated to tray header (`public/index.html`, `public/workspace.css`):** Moved the generation readout badge (`#generation-summary`) from the bottom generation toolbar up to the right side of `.tray-header` next to `#status`, freeing toolbar space and consolidating status telemetry into the header row.
- **Verification:** Verified 100% green test suite: 126/126 unit tests (`npm.cmd test`) and all 344 samples, WAV export, A/B comparison, project roundtrip, and autosave pass on both root (`/`) and GitHub Pages subpath (`/breakbeat-pattern-maker/`) via `npm.cmd run test:site`.

### [2026-09-26] - Single-Row Transport & No-Scroll Beat Generator Viewport (Antigravity)
- **Single-row hardware transport (`public/workspace.css`, `public/index.html`):** Reorganized `#transport` into a single, compact ~44px horizontal row instead of stacked vertical rows. Grouped `Play [Pattern v] [▶] Stopped` alongside `[TEMPO 165.0 BPM TAP]` and `[BAR & BEAT 01.1 2 BARS]` horizontally in `.transport-center`. Restyled `#play` to a sleek 38px circular button. Positioned `#transport` natively inside `#tray-bottom` in HTML without runtime DOM shifts.
- **Beat Generator viewport visibility without scrolling (`public/workspace.css`):** Removed the redundant `.tray-rack-tabs` strip. Adjusted `.workspace #grid` height to `clamp(260px, 34dvh, 380px)` with `min-height: 260px` so the entire Beat Generator (genre, kit, bars, bpm, complexity, spicy sliders, and `Generate` button) fits 100% on-screen simultaneously with the tracker grid on standard laptop and desktop displays without window scrolling ("rolling").
- **Session HUD legibility (`public/workspace.css`):** Refined `#tray-session-hud` items with crisp vertical alignment and dedicated labels/values for Pattern, Tempo, Kit, and Channels.
- **Verification:** Verified 100% green test pass across unit tests (126/126) and browser smoke tests (`npm.cmd run test:site` passing all 344 samples on both `/` and `/breakbeat-pattern-maker/`).

### [2026-09-26] - Tracker Workspace Streamlining, In-Column Hardware Buttons & Responsive Layout (Antigravity)
- **Responsive chassis & full-width layout (`public/workspace.css`):** Removed rigid `max-width: 1720px;` and centered margin constraints on `main.daw-chassis`, enabling the DAW workspace to fluidly utilize the full width of ultrawide, 1440p, and 1080p displays without empty black side bars.
- **In-column instrument buttons (`public/workspace.css`):** Styled the per-track `▾ Instrument / FX` summary in column headers into prominent, tactile hardware-style toggle buttons with dynamic role-colored glow (Kick: coral, Snare: amber, Hat: teal, Percussion: periwinkle), distinct chevron indicators, and clear open/closed state.
- **Streamlined non-intrusive hit editing (`src/web.ts`, `public/index.html`, `public/workspace.css`):** Decoupled cell clicks from auto-expanding the massive `#hit-editor` drawer, preventing disruptive viewport jumping while retaining instant audio auditioning and direct parameter editing. Compacted the inspector into a streamlined drawer with contextual summary badges.
- **Top header & transport reorganization (`public/index.html`, `public/workspace.css`):** Relocated export controls (`Active pattern`, `Export WAV`, export format) up into the top project header bar where export actions logically belong. Reorganized the bottom transport into a balanced 3-part layout (nav shortcuts, centered 52px round play button & tempo display, and clean live status HUD). Fixed the green box overflow collision between arrangement items and the footer status bar.
- **Beat rationale & kit grouping (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Grouped `Drum Kit Preset` and `[x] Auto-load kit with genre` together above the grid on the top-left. Completely removed the bulky `Learn this beat` panel and "Listen closer" box from beneath the grid. Repositioned the live beat explanation badge (`#explanation`) to the top-right above the grid as a clean contextual readout.
- **Verification & HTML structure fixes (`public/index.html`, `scripts/site-browser-smoke.mjs`):** Corrected nested tag closing structure for `#stage-center` and `.studio-layout`. Updated Playwright browser smoke test to ensure instrument accordions are opened during sound scans. Verified 100% green test suite: 126/126 unit tests pass (`npm.cmd test`) and all 344 samples, WAV export, A/B comparison, project roundtrip, and autosave pass on both root (`/`) and GitHub Pages subpath (`/breakbeat-pattern-maker/`) via `npm.cmd run test:site`.

### [2026-09-25] - Tracker Field Editing and Flexible Workspace (Codex)
- **Tracker editing (`src/core/editor.ts`, `src/web.ts`):** Added atomic drag-to-move for single hits or selected cells, lock and bounds protection, and direct note, instrument, volume, pan, and delay editing. Numeric fields accept two-digit tracker-style hex entry; field and cell keyboard navigation preserve the current selection. Moves and value changes each create one Undo/Redo step.
- **Sound workflow (`src/web.ts`, `public/index.html`):** Added a per-hit instrument picker for lane sound, uploaded sample, or bundled library sample. Library choices become embedded audio assets, so hit-specific assignments survive project save and use the same playback/export engine. Moved instrument and effect controls into each track's expandable header, and kept hit editing beneath the tracker.
- **Workspace (`public/index.html`, `public/workspace.css`):** Made Tracker the default view, replaced emoji controls with simple tracker-style symbols, moved the round transport beneath the tracker, hid the slicer tab, added a separate collapsed Master DSP row, and grouped generator controls. The left tray and tracker height can be resized; the left tray and tracker can be stacked, with layout saved locally.
- **Verification (`tests/editor.test.mjs`, `scripts/site-browser-smoke.mjs`):** Added core coverage for move/edit history and browser coverage for tracker fields, drag, stacking, instrument accordion, DSP row, and contextual starting-bar control. Updated `README.md` and `PROJECT-SCOPE.md`.

### [2026-09-25] - Tracker Cell Clipboard and Keyboard Flow (Codex)
- **Editing engine (`src/core/editor.ts`):** Added cell/row copy and atomic paste that includes empty cells, preserves timing and sound choices, assigns unique hit IDs, respects destination locks and pattern bounds, and records a single Undo step. Clipboard pastes require the same resolution.
- **Tracker UI (`src/web.ts`, `public/index.html`):** Added Copy, Paste, and Duplicate controls with Ctrl/Cmd+C/V/D while the grid has focus. Tab now moves the selected cell and keyboard focus to the next lane. Project load/reset clears the transient clipboard.
- **Documentation and verification (`README.md`, `tests/editor.test.mjs`):** Documented the keyboard flow and tested copy/paste, empty cells, locks, and Undo/Redo. `npm.cmd test` passes 124/124; site smoke verified on root and GitHub Pages paths.

### [2026-09-25] - Tracker Cell Navigation, Audition and Editable Tempo (Codex)
- **Tracker editing (`src/core/editor.ts`, `src/core/bank.ts`, `src/web.ts`):** Added validated cell-coordinate selection across populated and empty cells, precise selected-hit targeting for delete/lock/mutate/scramble, arrow movement, Shift range extension and Ctrl/Cmd cell toggles. Populated-cell clicks audition the selected hit through the active kit/effects; empty cells continue auditioning their lane sound.
- **Transport tempo (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Made the top BPM display editable. Pattern target changes use editor history; Song target changes use arrangement history. Tap tempo now follows the same undoable song tempo path.
- **Documentation and verification (`README.md`, `PROJECT-SCOPE.md`, `scripts/site-browser-smoke.mjs`, `tests/editor.test.mjs`):** `npm.cmd test` passes 123/123. `npm.cmd run test:site` covers mixed cell selection, audition, arrow navigation, pattern/song tempo edits and Undo/Redo on both root and GitHub Pages paths.

### [2026-09-25] - OLED Black Theme and Animated Play Control (Codex)
- **Theme (`public/style.css`, `public/workspace.css`):** Changed the canvas to pure black and recolored major panels, fields, and tracker surfaces to near-black layers with neutral borders.
- **Transport (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Replaced the text Play button with a round icon control, animated its halo during playback, changed it to a stop glyph while playing, and kept accessible labels in sync. Respects reduced-motion preferences.
- **Cache and verification:** Bumped static asset versions; `npm.cmd test` passes 121/121 and `npm.cmd run test:site` passes on root and GitHub Pages paths. Browser checks cover black canvas, round button geometry, and Play/Stop accessibility states.

### [2026-09-25] - A/B Pattern Comparison (Codex)
- **Comparison UI (`public/index.html`, `public/workspace.css`, `src/web.ts`):** Added Set A/B to each current or recent beat, compact preview/keep/clear controls, and metadata showing both choices. Captures are frozen for the active slot and clear on slot or project changes.
- **Playback and editing (`src/web.ts`):** Both previews use the existing pattern renderer, kit, samples and effects without changing the tracker; Keep restores a choice through the editor so Undo/Redo and recent history remain available.
- **Verification (`scripts/site-browser-smoke.mjs`):** `npm.cmd test` passes 121/121. The static site build and browser smoke pass on both root and GitHub Pages subpaths, covering A/B selection, audio preview switching, Keep B, Undo/Redo, project save/open and autosave.

### [2026-09-25] - Recent Pattern History (Codex)
- **History engine (`src/core/bank.ts`, `src/core/editor.ts`):** Added bounded, validated per-slot pattern snapshots and a restore operation that participates in ordinary editor Undo/Redo.
- **Workspace (`src/web.ts`, `public/index.html`, `public/workspace.css`):** Added a collapsible left-tray history with current-beat context, genre/BPM/seed metadata, and Restore controls; Generate, Variation, Mutate, Fill and Scramble capture the previous beat when they change it.
- **Persistence (`src/audio/project.ts`):** Project files and autosave retain recent patterns and include audio referenced only by historical slices, so restored beats remain playable after reopening.
- **Verification (`tests/pattern-history.test.mjs`, `scripts/site-browser-smoke.mjs`):** `npm.cmd test` passes 121/121; `npm.cmd run test:site` passes history restore, project roundtrip and autosave on both root and GitHub Pages subpath builds.

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
