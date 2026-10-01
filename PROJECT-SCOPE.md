# Active scope — single-shot beat workspace

Implemented: hidden/reversible chopper UI; four single-shot lanes; 18 genre engines; five break-inspired rhythm presets; instrument inclusion independent of mute; generated variations; direct tracker and keyboard entry; locking and history; 12 CC0 acoustic/TR-808 samples; library/upload/synth selection; audition, level and tuning; WAV export; portable project save/open with embedded PCM; IndexedDB autosave and restore.

Excluded instrument conflicts with locked hits must be resolved explicitly. Ghost snares and fills follow Snare inclusion. Manual entry remains possible on any lane. Existing slice-backed projects remain readable. The Import break preview adds automatic slicing and one mapped slice instrument per imported break; see docs/BREAK-TRANSCRIPTION.md.

Authentic commercial-break one-shots were not bundled because redistribution permission was not established. All shipped library files have pinned source URLs, hashes and CC0 notices.

Next candidates: velocity-layered kits and stronger sample-browser filtering. WAV and 192 kbps MP3 export share the pattern/song renderer; WAV remains the exact-loop format because MP3 encoder padding may add a loop gap. Renoise integration is retired. Original long project documents are historical and superseded by this scope and README.md.

Implemented polish: simplified generator toolbar and advanced disclosure; Preview naming; per-lane high/low-pass, drive and delay with bypass; lane/per-hit reverse; shared DSP for preview and WAV; backward-compatible project persistence; OLED black theme and animated round transport control; tracker cell audition, rectangular cell selection, arrow navigation, and editable transport tempo.

Audio quality: per-sample speed now offers Repitch or pitch-preserving Stretch (0.5×–2×), each instrument can add a second catalog/uploaded sound with level, ±10 ms timing offset and polarity control, and a first-100-ms mono-cancellation hint. Groove V4 uses linked master peak protection with a 0.96 ceiling and export trim reporting; V1–V3 PCM behavior remains unchanged. See `docs/AUDIO-QUALITY.md` for controls, verification, and listening limits.

Tracker workspace: Tracker is the default grid view. Each occupied cell exposes note, instrument, volume, pan, and delay fields with direct keyboard entry; hits and selected groups can be dragged to new cells with lock protection and one-step Undo/Redo. Per-track instrument/effects accordions sit over their columns. A hit can choose its lane sound, an upload, or a bundled sample; selected sample audio is embedded into projects. The right instrument tray is hidden. The workspace supports a resizable left tray, adjustable tracker height, and a saved stacked layout. Playback/tempo sit below the tracker, the slicer tab is hidden, Master DSP has its own collapsed row, and the generator uses grouped controls without an internal vertical scrollbar.

Built-in synth tracks extend user-created lanes with absolute pitches, musical note lengths, and up to eight simultaneous voices per track. Bass, Pluck, and Pad presets expose waveform, ADSR, and filter controls in each synth column. The same renderer supplies pattern/song preview and WAV export; project schema v6 retains synth notes and settings. Beat generation preserves these lanes.

Optional melody generation adds Drums only, Drums + Melody, and Melody only modes. A separate deterministic composer uses genre profiles for bassline or lead motifs, with key and 16 scale choices. It creates and reuses a dedicated synth lane for the selected part; locked notes and unrelated drum or synth material remain when a layer is regenerated. Complexity adds rhythmic detail and Spicy introduces bounded pickups or octave accents. The generated notes use the existing tracker, arrangement, playback, project and WAV paths. Chord progression generation and native VST/AU hosting remain future work.

Tracker FX now adds a sixth per-hit field: sample offset (`0S`/`09`), direction (`0B`), pitch slide (`0U`/`01`, `0D`/`02`), timed volume cut (`0C`), and tick retrigger (`0R`). Commands and hex parameters are validated, editable from the keyboard, undoable, and retained in full pattern JSON and portable projects. The legacy strict Lua transfer omits FX with a warning. Shared preview/WAV rendering applies FX at sub-row precision. The desktop tracker header and inspector are compact; mobile layout orders header and tracker first, wraps controls, retains isolated horizontal grid scrolling, and fixes the sidebar rail and floating instrument controls.

Quality-of-life: a dismissible, persistent Quick Start guide explains Generate → Preview → Edit → Export and can be reopened from the header. A per-slot Recent patterns panel holds up to 12 previous generated or mutated beats, restores them through the editor, and persists in project files and local autosave. Temporary A/B choices let users preview two frozen beats with the shared audio renderer and keep either choice with Undo support.

## Active UI/UX Scope — Tracker Streamlining & Layout Polish
- Full-width responsive workspace: removes fixed max-width constraints and black side bars on widescreen/ultrawide displays.
- Expandable in-column Instrument/FX buttons: prominent DAW-style hardware toggle buttons in column headers with expand chevrons and active role-colored state.
- Streamlined hit inspection: clicking hits auditions and updates parameters without auto-expanding a disruptive, template-breaking inspector drawer.
- Clean transport & export reorganization: export controls docked in the upper header/toolbar; bottom transport cleanly centered with round Play control and no overlapping text/footer collisions.
- Simplified beat context: removal of "Learn this beat" and bulky "Listen closer" boxes; dynamic hit explanation relocated to a clean contextual badge in the top-right header area above the grid. Grouped kit preset and auto-load controls.

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


## Implemented: Groove v4 profile-driven generation

- All 38 genres have typed, editable call/answer profiles and style-specific density, cadence and gesture limits. Complexity changes the rhythm's structure, while Spicy changes the articulation of non-anchor accents.
- Named deterministic streams protect the anchor spine across variations. Selected-row Fill, pattern structure modes, Preview, WAV rendering, project save, locks and Undo/Redo use the V4 path. Earlier engines remain available for saved work.
- Profile tuning and research references are in `docs/GROOVE-V4.md`.

## Implemented: Groove v3 phrase development
- Genre-specific support phrases and articulation budgets preserve anchor spines; Jungle/Drumfunk include seed-selected displaced backbeat motifs, and Two-step Garage has its own shuffled supporting pulse.
- Complexity adds call/answer phrases and optional complete Euclidean support layers; Spicy obeys each genre's repeat ceilings and minimum onset spacing, with energy-normalized repeat contours.
- Optional 4/8/16-bar phrase context plus section starting bar controls cadence placement. Patterns remain 1–4 bars; users generate separate sections into bank slots. Repeated arrangement blocks do not regenerate automatically.
- V3 generation revision `0.3.0-groove.2`; stored projects keep their written events. Legacy/v2 generation and audio fingerprints remain unchanged. Existing kick choke behavior retained.
- Research and listening checklist: `docs/GROOVE-V3-RESEARCH.md`.

Break transcription preview: isolated WAV region (1–4 bars), cancellable local onset analysis, editable markers, original/reconstructed A/B, independent slice-note/pitch controls and project v4. Eight continuous break recordings now have first two-second listener-reviewed onset labels and grouped validation (`docs/VERIFIED-BREAK-BENCHMARK.md`). Longer excerpts, a second independent annotator, and full-loop listening remain the production-quality gate.
