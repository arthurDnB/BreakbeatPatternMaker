# Active scope — single-shot beat workspace

Implemented: hidden/reversible chopper UI; four single-shot lanes; 18 genre engines; five break-inspired rhythm presets; instrument inclusion independent of mute; generated variations; direct tracker and keyboard entry; locking and history; 12 CC0 acoustic/TR-808 samples; library/upload/synth selection; audition, level and tuning; WAV export; portable project save/open with embedded PCM; IndexedDB autosave and restore.

Excluded instrument conflicts with locked hits must be resolved explicitly. Ghost snares and fills follow Snare inclusion. Manual entry remains possible on any lane. Existing slice-backed projects remain readable but no new slice operations are exposed.

Authentic commercial-break one-shots were not bundled because redistribution permission was not established. All shipped library files have pinned source URLs, hashes and CC0 notices.

Next candidates: MP3 export, velocity-layered kits and stronger sample-browser filtering. Renoise integration is retired. Original long project documents are historical and superseded by this scope and README.md.

Implemented polish: simplified generator toolbar and advanced disclosure; Preview naming; per-lane high/low-pass, drive and delay with bypass; lane/per-hit reverse; shared DSP for preview and WAV; backward-compatible project persistence.

Quality-of-life: a dismissible, persistent Quick Start guide explains Generate → Preview → Edit → Export and can be reopened from the header. A per-slot Recent patterns panel holds up to 12 previous generated or mutated beats, restores them through the editor, and persists in project files and local autosave.

## Implemented: pattern bank and arrangement
- Dynamic bank of 1–256 named slots (starting with A, B, C, Fill), copy into empty slots, automatic edit retention, and per-slot in-memory undo history.
- Queued pattern switching at full-pattern boundaries; stop cancels pending switches.
- Collapsible arrangement with append, repeats, reorder, remove, playback progress and one-pass playback.
- Full-arrangement WAV export with continuous lane effects and release tails.
- Shared kit/effects; independent song tempo, initialized from the first pattern. Maximum 64 steps, 16 repeats per step, 170 seconds before final tails.
- Bank and sequence saved in local autosave and portable projects; older projects start in A.

## Implemented: per-hit ratchets and gate
Collapsed tracker articulation controls provide 1–8 repeats per row and a gate fraction for each repeat. A selected-hit Preview uses the common performance renderer. Tracker badges identify repeats and gate length. Gated attacks have short edge fades; repeats stay inside pattern boundaries while lane effects retain their tails. Locks, undo/redo, pattern banks, projects, autosave and full-note JSON preserve articulation. Existing hits default to natural decay and one attack.

## Implemented: Phase 4 — song arrangement and transport
- Sticky transport target: Pattern loops the active pattern; Song plays the full arrangement once, then its effect tails.
- Song playback follows the current slot and tracker row; arrangement blocks show bar ranges and the current repeat. Stop/target changes clear playback indicators.
- A horizontal timeline shows named sections, pattern names, repeats, bars and duration; the current block follows playback. Click a block to edit its pattern, drag it into an insertion gap, or use + to insert the selected pattern at that position.
- Timeline edits, section names and song tempo participate in arrangement undo/redo and persist in projects and autosave.
- Drag a block heading to reorder, or use Move up/down buttons (keyboard and touch accessible). Add pattern appends a block; repeats and remove remain available.
- Song BPM is stored independently of per-pattern BPM; switching slots or genres cannot change it. Tap tempo follows the transport target.
- Export target explicitly selects Active pattern or Full song arrangement. Pattern export retains Loop/Tail options; full songs retain continuous effects and final tails.
- Project schema v2 adds bank.songBpm. Version 1 files/autosaves migrate using their saved active pattern BPM without modifying pattern data, samples or locks.
- Verification: npm.cmd test; with the dev server running, node scripts/song-browser-smoke.mjs; npm.cmd run test:site.


## Implemented: Groove v3 phrase development
- Genre-specific support phrases and articulation budgets preserve anchor spines; Jungle/Drumfunk include seed-selected displaced backbeat motifs, and Two-step Garage has its own shuffled supporting pulse.
- Complexity adds call/answer phrases and optional complete Euclidean support layers; Spicy obeys each genre's repeat ceilings and minimum onset spacing, with energy-normalized repeat contours.
- Optional 4/8/16-bar phrase context plus section starting bar controls cadence placement. Patterns remain 1–4 bars; users generate separate sections into bank slots. Repeated arrangement blocks do not regenerate automatically.
- V3 generation revision `0.3.0-groove.2`; stored projects keep their written events. Legacy/v2 generation and audio fingerprints remain unchanged. Existing kick choke behavior retained.
- Research and listening checklist: `docs/GROOVE-V3-RESEARCH.md`.
