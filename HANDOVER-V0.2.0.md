# Breakbeat Pattern Maker — Version 0.2.0 Architecture & Codex Handover Guide

> **Document Purpose:** This document serves as the comprehensive architectural handover from **Antigravity** to **OpenAI Codex** (and developers). It details the complete transformation of the application from its original form to Version 0.1.0, and outlines the complete technical blueprint, wireframes, and implementation roadmap for **Version 0.2.0 (The Renoise Workstation Overhaul)**.

---

## 🏷️ Brand Identity: Breakbeat Pattern Maker

* **Official Tool Name:** **Breakbeat Pattern Maker**
* **Application Category:** Standalone In-Browser Breakbeat Tracker, Pattern Sequencer & Drum Workstation.
* **Core Philosophy:** Direct, tactile, Renoise-inspired tracker music creation without modals or popups. Fast, responsive, deterministic rhythm generation paired with authentic sample manipulation.
* **Live Deployment:** [https://arthurdnb.github.io/BreakbeatPatternMaker/](https://arthurdnb.github.io/BreakbeatPatternMaker/)
* **Repository:** [https://github.com/arthurDnB/BreakbeatPatternMaker](https://github.com/arthurDnB/BreakbeatPatternMaker)

---

## 📜 Part 1: What Has Been Done (Evolution from Original Version to v0.1.0)

### 1. The Original Starting State (Legacy Baseline)
When this project began, it had several core architectural limitations:
* **Monolithic Vertical Page:** The application was a single 3,500px+ tall scrolling web form. To reach the tracker grid, users had to scroll past multiple screens of oversized forms, sliders, and drop zones.
* **Mathematical Sine Synthesizer:** Default audio relied on raw, clinical synthesized beeps rather than authentic breakbeat acoustic drums.
* **Modal-Style Note Entry:** Inserting or editing notes required clicking a hit, scrolling into an awkward inspector details form, and clicking an "Apply" button. Direct in-place editing on the grid was non-existent.
* **Cramped Instruments Panel:** Drum slots were forced into a 4-column layout inside a narrow sidebar, crushing labels into 2-letter wrapped fragments and breaking input elements.
* **Rigid 4-Slot Pattern Bank:** Patterns were strictly hardcoded to slots `A`, `B`, `C`, and `Fill` with clumsy switching mechanics.
* **Inconsistent UI Tokens:** Clashing border styles, browser-default file upload buttons (`Choose File No file chosen`), and unpadded buttons causing text like "Export WAV" to spill outside borders.

---

### 2. Major Transformations Implemented by Antigravity

#### A. Authentic In-Place Tracker Note Insertion Engine (`src/web.ts`)
* **Zero Modal Windows:** Clicking an empty cell now positions the cursor and immediately auditions the instrument in real time. Double-clicking inserts a note directly into the pattern.
* **Two-Octave Keyboard Mapping:** When the tracker grid is focused, users can compose directly on their typing keyboard:
  * **Lower Octave:** `Z` (C), `S` (C#), `X` (D), `D` (D#), `C` (E), `V` (F), `G` (F#), `B` (G), `H` (G#), `N` (A), `J` (A#), `M` (B).
  * **Upper Octave:** `Q` (C), `2` (C#), `W` (D), `3` (D#), `E` (E), `R` (F), `5` (F#), `T` (G), `6` (G#), `Y` (A), `7` (A#), `U` (B).
* **Tactile Velocity & Transposition Keys:**
  * Keys `1` through `9` instantly set hit velocity from 16 to 128 (`0x10` to `0x80`).
  * `+` / `-` keys transpose the pitch up or down by semitones in real time.
  * `Delete` or `Backspace` instantly cuts the note at cursor to empty dots (`··· ·· ·· ··`).
  * `Enter` inserts a note with current instrument settings.
  * `Tab` / `Shift+Tab` smoothly switches active instrument columns.
  * `Arrow Keys` navigate the 2D matrix.
* **Tracker Live Toolbar (`.tracker-live-bar`):**
  * Step advance dropdown: `1 row`, `2 rows`, `4 rows`, `0 (stay)`.
  * Quick action buttons: `+ Note` (emerald), `⌫ Clear`, `👻 Ghost`, `×2`, `×4` (ratchet rolls), `+1 st`, `-1 st`.
  * High-visibility **2px glowing cyan cursor box** (`.cursor-cell`) and **real-time emerald playhead scanning row** (`.playing-row`).

#### B. High-Fidelity CC0 Drum Library & Master Bus Glue (`src/audio/`)
* **32+ CC0 Library Samples:** Replaced synthetic beeps with rich acoustic drums and vintage TR-808s.
* **14 Newly Bundled Acoustic Break Hits:** Added crisp acoustic snares (Pearl, Piccolo, Fat, Crack), punchy dampened bass drums, tight acoustic hats, open hi-hats, ride cymbals, crash cymbals, and toms from VCSL and Stargate with full CC0 provenance and license documentation.
* **Immediate High-Quality Startup:** Default startup auto-loads authentic genre sample presets (Jungle, Trap, BoomBap, Garage, Hardcore) instead of mathematical beeps.
* **Master Bus Tape Soft-Saturation Curve (`src/audio/performance.ts`):** Implemented an analog-style transfer curve on peaks above 0.7 to glue drum layers together, increase perceived punch, and eliminate harsh clipping.

#### C. Visual Overhaul (Sketch Sample & Renoise Aesthetic)
* **Obsidian & Slate Theme (`public/workspace.css`):** Deep space slate background (`#10161e`), dark inset panels (`#080c14`), and macOS window chrome (`#ff5f56`, `#ffbd2e`, `#27c93f`).
* **Hardware HUD Capsules:** Custom dark capsules displaying `TEMPO 165.0 BPM` with an interactive tap tempo button, and `BAR & BEAT 01.1` position indicator.
* **Spacious Hardware Channel Strips:** Rebuilt the Instruments tab into single-column cards with role-colored left borders (Kick Rose, Snare Gold, Hat Cyan, Percussion Violet), full-width sound selectors, aligned audition/upload buttons, and hidden native file inputs.
* **Precision Button Styling:** Fixed button overflows with `white-space: nowrap !important` and flex centering.
* **Clean Status Footer:** Replaced confusing decorative buttons with an informative DAW status bar displaying engine health and keyboard shortcuts.
* **Strict Layout & Test Compliance:** All 52 unit tests pass, and layout smoke tests verify `#grid` top < 600px, `#play` bottom < 180px, and zero horizontal overflow on both 1440px desktop and 390px mobile viewports.

---

## 🎯 Part 2: Vision & Specifications for Version 0.2.0

Version 0.2.0 transitions **Breakbeat Pattern Maker** from a single-column tool into a **professional multi-panel Renoise-inspired tracker workstation**.

### Reference Documents Provided by User:
1. **Renoise UI Mockup (`media_1790236156111.png`):** High-density tracker console with a vertical pattern sequencer on the left, multi-track tracker grid in the center with inline volume faders and meters, sample rack on the right, and waveform slice editor on the bottom.
2. **Architectural Wireframe (`media_1790236169104.jpg`):** Outlines the retractable drawer layout with toggle arrows on the left, right, and bottom.

```
+---------------------------------------------------------------------------------------------------+
|  [ANTIGRAVITY // BREAKBEAT PATTERN MAKER]  Transport (Play/Stop/Loop)  BPM [174.0]  LPB [4]  TPL [12]  CPU/Out |
+------------------+-------------------------------------------------------------+-------------------+
| [<] PATTERN TRAY | TRACK 01 (Kick)   TRACK 02 (Snare)   TRACK 03 (Hat)  ...    | [>] INSTRUMENT RACK|
|                  +-------------------------------------------------------------+                   |
| 00 Verse 1       | 00  C-4 01 v64 --   C-4 01 v64 --   C-4 01 v64 --           | 00 - Amen Break   |
| 01 Verse 2       | 01  ... .. ... --   ... .. ... --   ... .. ... --           | 01 - 909 Kick     |
| 02 Amen Roll     | 02  ... .. ... --   ... .. ... --   ... .. ... --           | 02 - Amen Snare   |
| 03 Bridge        | 04  ... .. ... --   D-4 02 v48 F00  ... .. ... --           | 03 - Sub Bass     |
| 04 Drop          | ----------------------------------------------------------- | 04 - Laser FX     |
| [+] Add Pattern  | [M][S]  |fader|   [M][S]  |fader|   [M][S]  |fader|         | Waveform View &   |
|                  |  -12dB  |meter|    -8dB   |meter|    -6dB   |meter|         | Sample Properties |
+------------------+-------------------------------------------------------------+-------------------+
| [^] RETRACTABLE BOTTOM RACK: Waveform Slicer | [SCRAMBLE] [MUTATE] | Delay & Filter FX | Generator Strip     |
+---------------------------------------------------------------------------------------------------+
| Status: Note: C-4 | Instrument: 01 | Effect: -- | Help: Press Z-M to enter notes directly in active row   |
+---------------------------------------------------------------------------------------------------+
```

---

## 🧱 Part 3: Core Features to Implement in Version 0.2.0

### 1. Unlimited Pattern Bank & Vertical Pattern Sequencer (Left Tray)
* **Problem in v0.1.0:** Hardcoded to 4 slots (`A`, `B`, `C`, `Fill`). It is rigid and unintuitive.
* **Solution in v0.2.0:**
  * Implement an **unlimited vertical pattern sequencer / matrix** on the left side, modeled after Renoise's Pattern Matrix.
  * **Dynamic Pattern Management:**
    * Add new pattern (`+` button).
    * Duplicate active pattern.
    * Rename pattern inline (e.g., `00 Intro`, `01 Verse 1`, `02 Build`, `03 Amen Roll`).
    * Reorder patterns (drag-and-drop or up/down arrow buttons).
    * Delete pattern with confirmation/undo.
  * **Seamless Pattern Switching:**
    * Clicking a pattern row switches the central tracker grid to that pattern instantly.
    * Real-time playback highlights the active playing pattern in the order list.
    * Mode switch: **Loop Active Pattern** vs. **Play Full Song Sequence**.

### 2. Retractable 3-Tray Layout Architecture
The interface must feature three collapsible trays that expand and contract smoothly, allowing the central tracker grid to take over 100% of the screen when desired:
1. **Left Tray (Pattern Sequencer / Matrix):** Retracts to the left via toggle button `[◀]` / `[▶]`.
2. **Right Tray (Instrument Rack & Sample Browser):** Retracts to the right via toggle button `[▶]` / `[◀]`.
3. **Bottom Tray (Generator, Slicer & Scramble/Mutate DSP):** Retracts downwards via toggle button `[▼]` / `[▲]`.
* **State Persistence:** Tray collapse/expand states should be saved in `localStorage` so the user's preferred layout persists across refreshes.

### 3. Integrated Track Mixer Headers in Tracker Grid
* In Renoise (and the user's mockup), each tracker lane header is not just a label; it includes an integrated mini-channel strip:
  * **Track Title:** e.g., `Track 01 Kick`, `Track 02 Snare`, `Track 03 Hat`.
  * **Mute (`M`) & Solo (`S`) Switches:** High-contrast toggle buttons.
  * **Volume Fader & Level readout:** Compact slider for track gain.
  * **Peak Meter:** Visual stereo meter showing signal activity during playback.

### 4. Waveform Slicer & Slice Scrambler / Mutator (Bottom Tray)
* Place the audio chopper and beat generator into the bottom retractable tray:
  * **Waveform Display:** Interactive waveform showing transient slice markers.
  * **Rotary Hardware Dials:**
    * **SCRAMBLE:** Randomizes slice triggers and micro-timings to create instant chopped break variations (Amen / Think chops).
    * **MUTATE:** Subtly tweaks velocities, pitch offsets, and ghost placements.
  * **Filter & Delay Strip:** High-pass, low-pass, resonance, drive, and delay controls with visual fader bars.

### 5. Multi-Sample Instrument Rack (Right Tray)
* List all active drum slots and uploaded audio as a numbered instrument list (`00` to `15`):
  * Select instrument to audition and view its waveform.
  * Adjust sample root pitch, volume, pan, and envelope decay.
  * Drag-and-drop WAV import directly onto an instrument slot.

---

## 🎨 Part 4: Color Palette & Visual Token System

> **Mandatory Rule:** Continue using the existing dark space and neon role color palette. Do not alter these tokens!

```css
:root {
  /* Background Surfaces */
  --bg-deep: #10161e;       /* Mandatory base: rgb(16, 22, 30) */
  --bg-chassis: #0c1018;    /* Deep chassis border */
  --bg-card: #131926;       /* Card and module background */
  --bg-inset: #080c14;      /* Inset wells and tracker grid */
  --bg-surface: #161e2e;    /* Elevated toolbars */
  
  --border-card: #202b3f;
  --border-subtle: #172133;
  --border-highlight: #2c3c58;
  --border-focus: #00f5d4;

  /* Typography */
  --text-main: #f8fafc;
  --text-muted: #8899b2;
  --text-dim: #4d5d78;

  /* Instrument Role Neons */
  --role-kick: #ff597b;           /* Neon Rose */
  --role-snare: #fbbf24;          /* Solar Amber */
  --role-hat: #00f5d4;            /* Electric Mint / Cyan */
  --role-perc: #c084fc;           /* Electric Violet */
  --role-ghost: #818cf8;          /* Lavender */

  /* Workstation Accents */
  --accent-cyan: #00f5d4;         /* Primary highlight & tracker cursor */
  --accent-blue: #38bdf8;         /* Export & audio actions */
  --accent-purple: #a855f7;       /* Sequencer & arrangement */
  --accent-green: #10b981;        /* Master Play & active trigger */
  --accent-amber: #f59e0b;        /* Lock & warning state */
  --accent-red: #ef4444;          /* Mute & record state */

  /* Fonts */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, Menlo, monospace;
}
```

---

## 🛠️ Part 5: Technical Blueprint for OpenAI Codex

### 1. Data Model Migration: From Fixed Bank to Unlimited Patterns
* **File:** `src/core/bank.ts` & `src/core/model.ts`
* Currently:
  ```typescript
  export interface Bank {
    active: number;
    slots: [Slot, Slot, Slot, Slot]; // Hardcoded 4 slots (A, B, C, Fill)
  }
  ```
* **Required Change:**
  ```typescript
  export interface PatternSlot {
    id: string;          // Unique UUID
    index: number;       // Sequencer order (0, 1, 2, ...)
    name: string;        // e.g. "Verse 1", "Amen Roll"
    color?: string;      // Accent tag
    bars: number;        // Pattern length (1, 2, 4 bars)
    editor: EditorState; // Independent editor state and undo stack
  }

  export interface Bank {
    activeId: string;    // Currently focused pattern ID
    slots: PatternSlot[]; // Dynamic array of unlimited patterns
    songSequence: string[]; // Order of pattern IDs to play in Song mode
  }
  ```
* **Backward Compatibility:**
  * When reading older projects (`.bbproject` v1), migrate slots `0..3` (`A`, `B`, `C`, `Fill`) into the dynamic array with indices `0, 1, 2, 3`.

### 2. Retractable Layout Architecture (`public/workspace.css`)
* Use a responsive CSS Grid with collapsible panel classes:
  ```css
  .daw-workspace-grid {
    display: grid;
    grid-template-columns: var(--left-tray-width, 220px) 1fr var(--right-tray-width, 260px);
    grid-template-rows: 1fr var(--bottom-tray-height, 180px);
    height: calc(100vh - 85px);
    transition: grid-template-columns 0.2s ease, grid-template-rows 0.2s ease;
  }
  .daw-workspace-grid.left-collapsed {
    --left-tray-width: 32px;
  }
  .daw-workspace-grid.right-collapsed {
    --right-tray-width: 32px;
  }
  .daw-workspace-grid.bottom-collapsed {
    --bottom-tray-height: 32px;
  }
  ```

### 3. Track Channel Strips in the Tracker
* In `src/web.ts`, update `render()`:
  * When rendering `<th>` for each track, attach:
    * Mute button (`.track-mute`)
    * Solo button (`.track-solo`)
    * Mini volume fader slider (`.track-volume-slider`)
    * Real-time audio peak canvas meter (`.track-meter-canvas`)

---

## 🚨 Mandatory Quality & Git Protocols (From `AGENTS.md`)

Every change made by Codex must strictly follow the repository protocol:

1. **Before Editing:**
   ```bash
   git pull origin main
   ```
   Read `DEVELOPMENT-LOG.md` to see the latest modifications and active tasks.

2. **Verify Tests Pass (Zero Regressions):**
   * On Windows:
     ```cmd
     npm.cmd test
     ```
   * Build site and verify browser layout:
     ```cmd
     npm.cmd run build:site
     node scripts/layout-browser-smoke.mjs
     ```
   * *Never commit if any test fails.*

3. **Document Work in `DEVELOPMENT-LOG.md`:**
   * Add a new entry under `## Change Log` with Date, Assistant name (`Codex`), bullet points describing changes, and rationale.

4. **Commit & Push:**
   ```bash
   git add .
   git commit -m "<clear, descriptive commit message>"
   git push origin main
   ```
   *(Pushing automatically triggers GitHub Actions deployment to GitHub Pages).*

---

## 📋 Recommended Codex Task Breakdown (Milestones)

* [ ] **Task 1: Unlimited Pattern Bank Engine:** Refactor `src/core/bank.ts` and `src/audio/project.ts` to support dynamic arrays of patterns with backward-compatible project serialization.
* [ ] **Task 2: Retractable 3-Tray Shell:** Update `public/index.html` and `public/workspace.css` to implement the collapsible Left (Pattern Matrix), Right (Instruments), and Bottom (Generator/Slicer) trays with toggle tabs.
* [ ] **Task 3: Pattern Matrix Sequencer UI:** Build the vertical Renoise-style pattern list in the left tray with Add (`+`), Duplicate, Rename, and Reorder actions.
* [ ] **Task 4: Tracker Track Channel Strips:** Integrate Mute, Solo, and Volume faders directly into each tracker column header.
* [ ] **Task 5: Bottom Waveform Slice & Scramble Rack:** Wire the Scramble and Mutate controls to the slice engine in the bottom tray.
