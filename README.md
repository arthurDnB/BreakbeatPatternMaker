# Breakbeat Pattern Maker[Vibe Coded]

A standalone single-shot beat generator and tracker. The chopper is hidden, with its code preserved for future use. Renoise integration is retired.

## Run

Node 22+: `npm install`, then `npm start`. Open http://127.0.0.1:4173.

The app opens with a **Quick Start** guide for Generate → Preview → Edit → Export. Hide it with **Hide guide**; use **Quick start** in the header to reopen it later.

## Choose your instruments

Each Kick, Snare, Hi-hat and Percussion card provides:

- **Include in generation:** controls which new notes Generate and Generate variation create. Press Generate to apply. Excluding Snare also excludes ghost snares and fills. An excluded lane with locked notes blocks generation with an explanation; unlock it or include it.
- **Sound:** choose Synthesized, a bundled library recording or My upload. WAV uploads must be mono/stereo, up to 10 seconds / 20 MB. The library loads from local files, not remote services at runtime.
- **Level and tuning:** adjust instrument level from 0–100% and pitch from −24 to +24 semitones. Note pitch and instrument tuning combine, capped at ±48 semitones.
- **Mute:** silences the lane in playback and WAV export without deleting its notes.
- **Preview:** plays the selected sound with its level/tuning. New previews stop previous playback. Mute is bypassed for isolated audition.

Instrument controls are separate from note Undo/Redo. Library playback trims leading silence and uses per-role peak targets (kick .9, snare .8, hat .4, percussion .65), with at most 4× boost. The shipped source WAVs are unchanged. These peak controls do not promise equal perceived loudness; adjust the level to taste. Uploads retain their original level.

## Bundled library and provenance

12 CC0 WAVs: acoustic bass drum, two acoustic snare dynamics, acoustic closed hat, bongo, tambourine, two TR-808 kicks, TR-808 snare, closed/open hats and clap.

- Versilian Community Sample Library: https://github.com/sgossner/VCSL
- Michael Fischer TR-808 set: https://github.com/tidalcycles/sounds-tr808-fischer

`public/samples/credits.html` and `catalog.json` include authors, license links, pinned source revisions and SHA-256 hashes. Copies of both CC0 license texts are included. The library is designed for offline use after the application is running.

These are not original Amen, Think or Apache recordings. Research did not establish redistribution permission for authentic one-shots from those breaks. MusicRadar's royalty-free samples explicitly prohibit redistribution, so none were bundled. The break-inspired generator menu remains an original rhythm interpretation; import your own authorized sounds to supply their audio character.

## Generate and edit

Select instruments, genre, BPM, length and detail. Generate applies pending settings; Generate variation chooses another seed while keeping your kit and instrument choices. Generation can be repeated deterministically with the same seed and settings. Select hits or rows, lock them, mutate, generate fills and Undo/Redo.

Open **Recent patterns** in the left tray to revisit the last 12 generated, varied, mutated, filled or scrambled beats for the active pattern slot. Each entry shows its genre, BPM, length and seed. **Restore** loads that beat into the tracker; Undo returns to the beat you had just before restoring. The list is separate for each slot and survives project save/open and local autosave.

Click a hit or empty cell for direct tracker entry. Change its row, lane, pitch, volume, pan or delay. Enable Keyboard entry and focus the grid: Z S X D C V G B H N J M enter chromatic notes, arrows move the cursor, Delete removes selected unlocked hits, Space plays/stops. Typing into a form field never records notes. Manual insertion can use a lane excluded from generation; exclusion applies to automatic generation, not composition.

## Save and restore

- **Save project + samples:** downloads `.bbproject`, containing note data, locks, settings, recent pattern snapshots, instrument selection, uploaded audio and used library audio. Audio used only by a recent pattern is embedded too, so restoring it after reopening works. Ordinary note Undo/Redo stacks are not included.
- **Open project:** validates the complete file before replacing the workspace. Invalid files leave the current project intact.
- **Local autosave:** saves the latest workspace to IndexedDB after a brief pause in edits. Reload restores it on this browser and origin. Check the status indicator; browser storage can be cleared or fail. Use a project file for a durable backup or another computer.
- **New project:** starts over after a confirmation. Save first to retain the current work.

The project file limit is 384 MB, decoded audio is limited to 256 MB. Pending sound loads must complete before a project is saved. Hidden legacy slice references remain supported in existing projects; their assigned audio takes precedence over lane instruments. The chopper UI is not exposed.

## Export

Play pattern and Export pattern WAV share one renderer. WAV is stereo 44.1 kHz / 16-bit PCM and includes at least 0.6 seconds of release tails. Muted lanes are excluded; note volume, lane level and tuning are applied. Overloaded mixes are attenuated to avoid clipping. Pattern playback repeats at the bar boundary with overlapping release tails; WAV exports one phrase with its final tails. Pitch repitches audio; there is no independent time-stretching.

Pattern JSON is an inspection/sharing format, not a complete project save. Use `.bbproject` to retain audio. MP3, additional codecs and velocity-layered kits remain future work.

## Checks

`npm test` runs engine, audio, project and historical importer regressions. `npm run test:browser` checks the active single-shot interface, every bundled sample, generation filters, locks, export, invalid-project recovery and reload restoration. Historical chopper UI scripts are retained but are not part of the active browser suite.

## Effects, reverse and simplified generation

Instrument Audition is now Preview. Preview uses the same renderer as the pattern and WAV export, at full note velocity and with instrument mute bypassed. Each card has Reverse instrument and a collapsible Effects panel: high-pass (0 = off), low-pass (20000 = off), drive, and delay time/feedback/mix. Processing order: reverse/repitch the sample, mix the lane, high-pass, low-pass, drive, delay. Filters are gentle one-pole filters. Bypass effects disables filtering, drive and delay while retaining tuning, level and reverse. Delay feedback is capped at .75, mix at .6, and added tails at 8 seconds; final tails may be tapered. Pattern playback repeats at the bar boundary while letting prior release/delay tails finish; WAV exports one phrase with its final tails.

Reverse hit is available in Tracker entry: select a hit, set Reverse hit, then Apply. It participates in note Undo/Redo and respects locks. Lane reverse forces every hit backward, including hits already marked reverse (it does not double-reverse them). Sample data is unchanged. Reverse and effect settings are saved in projects/autosave; older projects open with neutral effects and forward playback.

Genre, BPM, Complexity and Bars stay visible. Advanced generation holds rhythm preset, resolution, seed and groove detail. The toolbar groups Generate/Variation, a single Play/Stop toggle, and Export WAV. More contains Copy/Download pattern JSON and closes after use, on outside click, or Escape.

## Pattern bank and song arrangement

A, B, C and Fill hold independent patterns and edit histories. Edits automatically update the active slot. Click an empty slot to copy the current rhythm, then use Variation or Generate Fill. Click a populated slot to edit it; during pattern playback it queues a switch at the next full-pattern boundary. Stop cancels the queue. Names are editable. The tracker and arranger have separate undo/redo histories; use the arrangement buttons or focus the arranger before Ctrl/Cmd+Z/Y.

Open Song arrangement, name sections, add slots, set 1–16 repeats, and use the visual timeline or Move up, Move down and Remove. Drag a timeline block into a gap to reorder it; a gap's + button inserts the pattern chosen below the list. Click a block to open its pattern. Play arrangement runs once through the sequence and final effect tails. Export arrangement WAV renders the same continuous instrument buses, including reverse, tuning, mute, filters, drive and delay. The arrangement uses its independent Song tempo for every slot, with a 170-second musical duration limit and up to 64 steps. Instrument choices/effects are shared by the bank. Single-pattern Play and Export WAV remain available.

Save project and local autosave include all slots, names, locks, samples and sequence. Older projects open in slot A. In-memory per-slot undo histories are retained during switching but are not serialized.

## Ratchets and gate length
Select a tracker hit, expand Hit articulation, choose 1–8 ratchets and a gate length, then Apply to selected hit. Preview selected hit plays that saved hit through the same engine as pattern/arrangement playback and WAV export. Insert and keyboard entry use the displayed articulation settings too.

Ratchets retrigger equally within one row, starting at the hit's actual microtiming. Each repeat restarts the sample (including reverse and pitch) and ends at the next repeat. Gate is a fraction of that repeat interval; at 1/16 resolution, ×4 gives 1/64 attacks. Full sample with a single hit keeps natural decay; with multiple repeats it uses the full repeat interval. 50% gate leaves half the interval silent. Tiny edge fades prevent gate clicks. Repeats do not start beyond the pattern boundary; delay/effect tails can continue afterward. Gate does not lengthen a short sample.

Articulation respects lane/hit locks and undo/redo, and travels with patterns into slots, projects, local autosave and full-note JSON. Old projects default to a single natural-length hit. Generator controls remain unchanged.

## Tracker-first workspace (UI phase 1)
Playback, undo/redo and WAV export stay in a sticky transport. The compact generator and A/B/C/Fill bank sit above the tracker. Use the slot ellipsis to rename; clicking an empty slot still copies the current pattern. Select a hit or empty cell to open the side inspector. Apply and Preview keep their existing behavior.

Sounds opens the instrument/effect section; clicking a tracker lane heading opens that instrument. Select rows opens exact range controls; last-beat selection and locks remain beside the grid. Arrangement opens the existing song section. On narrow screens the inspector moves below the tracker, selecting a hit brings its editor into view, and Back to pattern returns to the grid. Audio, project format and generation behavior are unchanged.

## Editing clarity (UI phase 2)
The inspector marks Pending changes and provides Apply and Revert. Preview plays the current inspector values; pattern playback and WAV exports always use committed notes. Typing Enter in a numeric field applies the draft; Escape reverts it.

A selected hit's pitch slider commits on release, with one undo entry for the gesture; Escape during the gesture cancels it. Other pending fields are preserved when pitch commits. Locked controls are disabled; Unlock hit (or Unlock lane and hit) is itself undoable.

Hit drafts stay with their hits across selection and pattern-slot changes in this browser session. The Pending edits selector returns to another pending hit. Drafts are not included in autosave or exports: Apply/Revert before downloading a project backup or generating a replacement pattern. Refreshing/closing with pending drafts triggers the browser's unsaved-work protection. Explicitly deleting a hit also discards its draft. Opening/New project discards drafts after confirmation. Existing projects and audio rendering are unchanged.

## Simpler sound selection (UI phase 3)
Open Sounds or click a tracker lane heading. Sound choices are grouped into Built-in, Sample library and Your sample. Upload WAV becomes Replace WAV when a sample is stored; the chooser displays its filename. Preview and upload are grouped together. Pitch and reverse live under Pitch & playback; level remains directly accessible.

Generate notes controls future generated patterns and does not remove existing hits. Mute audio silences pattern/song playback and WAV export; instrument Preview still works while muted. Every pattern shares this kit. Cards show Dry, FX on, FX bypassed or Muted; the Effects disclosure names active processors. Playback shaping is also summarized when collapsed. Loading disables Preview/Upload, and failed sound loads keep the previous instrument.

## Expanded sound library
32 CC0 WAV one-shots (20 added): 7 kicks, 7 snares, 7 hats and 11 percussion sounds, plus the existing synthesized instruments. New options include acoustic muted/alternate bass drums, acoustic rimshot and marching snare, 808 tone variations, acoustic open/loose/pedal hats, short 808 open hat, cowbell, rim shot, maracas, low/high toms, conga, claves and shaker. Source recordings remain unchanged; existing playback trimming and level matching apply. All original IDs remain valid for older projects. Credits and pinned source hashes are in public/samples/catalog.json and credits.html.

## Genre defaults
Changing genre now loads its complete generation preset, overriding prior manual BPM and swing values along with bars, resolution, complexity, syncopation, humanization, ghosts, fills, break style and seed. Restore defaults repeats this reset for the currently selected genre. These are generator controls: the current pattern changes only when Generate is pressed; instrument/sample/effect choices and locks remain intact. UI genre starting points are defined in genreDefaults(), while the original defaults() stays stable for existing deterministic seeds and CLI usage.

## Static deployment build (GitHub Pages ready)

Run `npm ci`, then `npm run build:site`. Publish the **contents of `site/`** as the website root. The generated folder includes root `index.html`, only browser-reachable JavaScript modules, CSS, the shared synth, help, 32 verified CC0 WAVs, sample provenance and licenses, and `.nojekyll`. Development servers, CLI modules, tests, node_modules, TypeScript declarations and source maps are excluded. `site/` is ignored by Git and replaced on each deployment build; do not store hand-written files there.

The same artifact works at `/` or `/repository-name/` without a hard-coded repository name or hostname. HTML links are relative to the site entry point; sample fetches resolve relative to the browser module. Use an HTTP(S) static host; opening index.html with a file:// URL is not supported. The deployment entry point is site/index.html, not public/index.html. The local server still serves the app at `/` and redirects its legacy public/index.html entry to `/`.

Run `npm run test:site` to rebuild and test the artifact at both root and `/breakbeat-pattern-maker/`. The test checks module/CSS loading, all 32 samples, playback, WAV download, project import/export, autosave and help/license links, and rejects failed resource requests. Node.js is needed only to build/test, not by visitors. Existing localhost autosaves do not transfer automatically to a different website origin; download a project backup and open it on the hosted app.

This prepares the files only. A GitHub Pages deployment workflow and repository Pages configuration are separate steps.


## Song arrangement (Phase 4)

Choose **Pattern** or **Song** beside Play in the transport. Pattern playback loops; Song plays the arranged blocks once and lets effects finish. The tracker follows the playing pattern, row, and repeat. Changing target stops playback.

Open **Arrangement** to set **Song tempo**, append patterns, name sections and set repeats. The horizontal timeline shows each section, pattern, bar span and duration. Click a block to edit its pattern, drag it into a gap to reorder, or use a gap's + button to insert the selected pattern. **Move up / Move down** work with a keyboard or touch. The playing block is highlighted and follows song playback. Song tempo stays fixed when selecting another pattern; each pattern retains its own tempo for Pattern playback/export. TAP changes the selected playback target's tempo.

Beside **Export WAV**, choose **Active pattern** or **Full song arrangement**. Loop/Tail applies to pattern exports; a song always exports once with continuous effects and final tails. Maximum song duration is 170 seconds before tails.

Saved projects use schema version 2 or 3 depending on the audio engine. Version 1 projects and autosaves open automatically, initializing song tempo from the saved active pattern. Section names are optional and older projects remain readable.

Regression check: run `npm.cmd test`, start the local server, then run `node scripts/song-browser-smoke.mjs`. The song test checks timeline selection, insertion, drag reorder, undo/redo, playback following, exact rendered WAV data, persistence and mobile layout.


## Groove v3 musical phrasing

Choose **Advanced generation → Engine → Groove v3**. Complexity develops coordinated hat/ghost/percussion phrases. Spicy adds genre-limited, velocity-shaped doubles, triplets, rolls and pitch accents; only the more disruptive styles use generated micro-chops. Main anchors, locks, undo/redo and Preview/WAV share the existing workflow. Saved patterns keep their events until you generate again.

For longer arrangements, choose **Phrase = 16 bars** and set **Starting bar** for the section you are generating. Four four-bar sections starting at 1, 5, 9 and 13 form a 16-bar phrase with its strongest turnaround at the end. Save each generated section in its own bank slot. Repeating one stored pattern does not automatically generate new fills. **This pattern** retains the simple loop workflow. These controls are available only for v3 and persist in projects/autosaves.

Research notes and genre-by-genre implementation rationale are maintained in `docs/GROOVE-V3-RESEARCH.md` in the source repository. Timing/gain values are adjustable production recipes, not claims of a universal genre formula. Test with `npm.cmd test` and, with the local server running, `node scripts/groove-v3-browser-smoke.mjs`.
