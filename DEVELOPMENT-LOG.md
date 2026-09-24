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
   * Unit test suite (52 tests): `npm.cmd test`
   * Site deployment build & Playwright smoke test: `npm.cmd run test:site`
4. **Update this log:**
   * Document each change under the [Change Log](#change-log) section with date, summary of files modified, and rationale.
5. **Git commit and push:**
   * Commit with a descriptive message. Pushing to `main` automatically triggers GitHub Pages deployment via `.github/workflows/deploy.yml`.

---

## 📌 Current Project Status

* **Version:** `0.2.0-alpha`
* **Test Status:** 55 / 55 unit tests passing (`npm test`).
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
* [ ] **Phase 4 (Next Priority):** 
  - Unified song arrangement & export presentation.
  - Make transport explicitly aware of playback target (Pattern vs. Song).
  - Explicit song tempo with backward-compatible project migration.
* [ ] **Future Audio Roadmaps:** MP3 export, velocity-layered drum kits, sample-browser filtering.
* [ ] *Note: Renoise integration has been retired in favor of the standalone in-browser instrument.*

---

## 📝 Change Log

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
