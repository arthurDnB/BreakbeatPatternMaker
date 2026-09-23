# Breakbeat Pattern Maker

A working first implementation of the deterministic TypeScript generator and Renoise Lua **file importer**, with a small local browser workbench. No accounts, server-side generation, or uploaded audio.

## Start here

This workspace already has its development dependencies installed. Double-click **Start Pattern Maker.cmd**, then open **http://127.0.0.1:4173**. Keep the terminal open while using the workbench. Close it to stop the local server.

For a fresh checkout, install Node.js 22 or newer and run:

```powershell
npm install
npm run check
npm start
```

Generate a pattern, audition it with the original synthesized demo kit, inspect a hit, and choose **Export .bbpattern**. Choose Beginner, Hybrid, or Renoise to change the display. Tracker field order is note, instrument, volume, pan, delay. Row numbers are decimal; instrument/volume/pan/delay are hexadecimal.

Changing settings does not silently replace the displayed pattern. Press Generate to apply them. New seed generates a new phrase while preserving your locks. With no locks, the same seed and settings recreate the same generated file. The eighteen profiles include Jungle, DnB Roller, Hip-Hop Swing, Trap, Rap, Drill, Breakcore, IDM, Hardcore, Experimental Breakbeat, Classic Breaks, Big Beat, Nu Skool Breaks, Electro Breaks, Breakbeat Hardcore, Ragga Jungle, Atmospheric Jungle and Footwork Jungle; they use different rhythmic rules, not just different tempos.

## Select and edit a pattern

1. Click a hit to select it and see its explanation. Ctrl/Cmd-click adds or removes individual hits. Click a row number, then Shift-click another row number to select an inclusive range. You can also use **From row / To row → Select rows**.
2. Use **Lock selected hits** for individual events, or the **Lock lanes** checkboxes for all kicks, snares, hats or percussion. Locked hits show a lock marker. Lane locks also prevent new material being added to that drum lane. A selection lock freezes the selected existing hits; it does not lock empty cells. If a lane is locked, unlocking an individual hit does not override that lane lock.
3. **Mutate selection** changes only eligible selected hits; clear the selection to **Mutate pattern**. Each edit changes at most 20% of eligible unlocked ornaments, moving some to neighboring subdivisions or varying their accents. Main downbeat kicks and backbeat snares remain intact even when not explicitly locked.
4. Choose **Select last beat**, or select your own ending, then **Generate Fill**. This replaces unlocked snare ornamentation inside that region with a short snare fill. Existing anchors and locked hits survive; other drum lanes are untouched. A locked snare lane makes this action a no-op.
5. **Undo / Redo** restores pattern data, locks and selection. Generate and lock changes are undoable too. Keyboard shortcuts are Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+Y outside text inputs. History holds up to 100 actions and a new edit clears the redo branch.
6. Play and **Export .bbpattern** use the edited pattern, including the fill, velocities and timing. The importer format is unchanged. Lock metadata and editing history stay in the browser; the file contains the realized notes, so its base seed alone will not reproduce subsequent edits.

Locks also survive Generate and New seed. Unlock all hits/lanes before changing BPM, bars or resolution; this avoids silently changing locked hits' timing. Editor history and locks are session-only and reset on page refresh. Export anything you want to keep before refreshing.

## Get the pattern into Renoise

1. Drag `releases/com.breakbeat.PatternImporter.xrnx` onto Renoise to install it. The archive is already built.
2. Stop Renoise playback. In **Tools → Breakbeat Pattern Maker → Load Original Demo Kit**, append four original demo instruments. You can instead use your own sample instruments.
3. Choose **Tools → Breakbeat Pattern Maker → Import Pattern File...** and open the exported `.bbpattern` file. Ready-made Jungle, DnB, and Hip-Hop files are in `exports/`.
4. Check each instrument and trigger-note mapping. Instrument slots are **hexadecimal and zero based**; the note field uses integer note values, with **C-4 = 48**. Demo kit names are detected automatically. A general instrument-slot suggestion is not an assertion that the expected sound exists there: verify your own mappings by ear.
5. By default, the file's BPM and LPB must match the song and host groove must be off. For a fresh test song, select **Apply file BPM/LPB/TPL and disable groove**. This changes timing for the **entire song**, not just the imported pattern.
6. Import. The tool appends a new pattern and prepends dedicated drum tracks; it never overwrites existing pattern cells. Play the imported pattern. Use Renoise Undo to undo the import.

**Native clipboard compatibility is unverified and not implemented.** Copy JSON in the browser is for inspection/sharing, not Ctrl+V into the Renoise Pattern Editor. The file importer is the implemented transfer path. The tool does not read the clipboard or execute external commands.

**Compatibility status:** the code uses the API 6 documentation shipped with the locally installed Renoise 3.2.1. The Lua parser, validator and import/rollback logic are executed by automated tests against a simulated host. A live Renoise import, audible playback parity, and native Undo grouping have **not** been verified in this environment. Test in a fresh song first. An injected write-failure test verifies rollback in the simulated host; host failures can still require Undo. Rollback can leave an empty unused pattern-pool entry.

## Command line

```powershell
npm run generate -- --genre jungle --seed break-042 --bpm 165 --bars 2 --out exports/my-jungle.bbpattern
npm run generate -- --genre hiphop --bpm 92 --swing 0.60 --humanize 3 --out exports/my-hiphop.bbpattern
node dist/cli.js --help
```

Controls: `--genre jungle|dnb|hiphop|trap|rap|drill|breakcore|idm|hardcore|experimental|breaks|bigbeat|nuskoolbreaks|electrobreaks|breakbeathardcore|raggajungle|atmosphericjungle|footworkjungle`, `--seed`, `--bpm 32..999`, `--bars 1..4`, `--resolution 8|16|32|64`, `--complexity 0..1`, `--syncopation 0..1`, `--ghosts 0..1`, `--fill 0..1`, `--swing .50..67`, `--humanize 0..10` milliseconds. `--lpb 1..32` changes the export resolution while preserving musical positions. Files above 512 rows are refused.

The engine stores time at 960 PPQ. Export rounds to the nearest 1/256 Renoise row, carries row boundaries correctly, and puts multiple hits in separate note columns. Out-of-bound microtiming is clamped with a warning. No hit is silently dropped. All source references and numeric ranges are checked before export.

## Use existing sliced breaks

Version 0.1 triggers already mapped slices; it does not create slice markers or analyze WAV transients. Slice and label your break in Renoise, and identify the note that triggers each intended kick/snare/hat/percussion slice.

Copy `exports/example-source-map.json`, then edit the source `kind` to `slice`, the `instrument` to the desired **decimal zero-based** slot, and the `note` to its trigger key. Keep logical IDs such as `kit.snare` and their matching role. A slice key selects a sample; it must not be treated as a musical pitch to transpose.

```json
{
  "id": "kit.snare",
  "role": "snare",
  "kind": "slice",
  "label": "My break snare",
  "note": 50,
  "instrument": 3
}
```

That is one entry in the source-map array. Provide mappings for every role used by the generated pattern:

```powershell
node dist/cli.js --sources exports/my-source-map.json --genre jungle --out exports/chopped.bbpattern
```

You can also change instrument/note bindings in the import dialog. Sources must have loaded samples covering the selected note and velocity. Phrase playback must be off. Sample tails, looping, envelopes, mute groups and slice end behavior remain under Renoise's control. An empty row is not guaranteed silence. Browser playback uses the demo voices, not your external break audio.

## Scope

Implemented: deterministic independent PRNG streams, eighteen profiles, backbeat anchors, motif responses, ghost notes, bounded fills, swing, humanization, typed event model, row/delay compiler, collision-free column allocation, CLI, browser generation/preview/export, source mapping, strict JSON Lua parsing and validation, preflight, native note writes, read-back, rollback on failure, and original demo WAVs inside the packaged tool.

The browser also implements individual hit and row-range selection, hit/lane locks, constrained mutation, selected-region fills, and snapshot-based Undo/Redo. Edited notes export through the same validated compiler and importer.

Not implemented yet: native clipboard adapter or tool text-paste route, waveform slicing, native retrigger/reverse/pitch effects, sample asset transfer, persistent library, non-4/4 meters, MIDI export, the other planned genre profiles, and exact emulation of Renoise's sampler. This is the generator/importer and editing foundation, not every feature in the full project specification.

No gate duration is promised in the transfer format. It transfers sample triggers; tails depend on the target instrument. Version 1 imports note, instrument, volume, pan and delay only. Unsupported fields and versions are rejected rather than ignored.

## Structure and development

| Location | Responsibility |
| --- | --- |
| `src/core/model.ts` | Types, constants and field constraints |
| `src/core/random.ts` | Pinned FNV-1a/Mulberry32 seed streams |
| `src/core/profiles.ts` | Genre skeletons and defaults |
| `src/core/generate.ts` | Deterministic musical-event generation |
| `src/core/compile.ts` | Renoise row/delay and column allocation |
| `src/core/editor.ts` | Selection, locks, mutation, fills and history |
| `src/cli.ts` | File generation command |
| `src/web.ts`, `public/` | Local workbench and demo preview |
| `tools/renoise/` | Lua parser, validator, importer and dialog |
| `schemas/` | Versioned transfer-format definition |
| `tests/` | Engine invariants and real Lua execution against mock host |
| `scripts/` | Local server, fixture generation and tool packaging |
| `exports/`, `releases/` | Usable example files and packaged `.xrnx` |

```powershell
npm test             # Type-check, build, core tests, Lua tests
npm run fixtures     # Rebuild eighteen sample patterns and source map
npm run package:tool # Package tool with generated original demo audio
npm run check        # All of the above
npm run test:browser # With the local server running; defaults to installed Edge
```

The runtime generator has no external dependencies. Development dependencies and exact versions are in package-lock.json. Fengari runs the real Lua code for tests; it is not embedded in the Renoise tool. Every shipped Lua module is also syntax-checked against Lua 5.1. No generative AI or nondeterministic model calls are involved. Set BROWSER_CHANNEL to `chrome` if running browser tests with installed Chrome instead of Edge.

The `.bbpattern` format is this application's JSON format, **not an official Renoise format**. See `schemas/bbpattern-v1.schema.json` and `docs/TRANSFER.md`. The original project documents remain the longer-term design reference.

## Live host verification checklist

- Install the tool; load the demo kit; import each bundled fixture into a fresh song.
- Confirm bar length, BPM/LPB, instrument slots, simultaneous kick/hats, quieter ghosts and delayed hits.
- Generate a high-complexity Jungle phrase with fill amount 1 and inspect same-row multi-column hits.
- Try a missing sample, mismatched LPB, active groove and playing transport: preflight must refuse without edits.
- Confirm one Undo restores timing, sequence and added tracks, while existing material stays intact.
- Audition your slice mappings, overlapping tails and stop-at-next-slice settings separately.

Primary API references: [Renoise Song API](https://renoise.github.io/xrnx/API/renoise/renoise.Song.html), [NoteColumn API](https://renoise.github.io/xrnx/API/renoise/renoise.NoteColumn.html), [Tool packaging](https://renoise.github.io/xrnx/start/tool.html).

### Genre and slider update

BPM has a slider (normally 32–300) plus exact numeric entry up to 999; typing a higher tempo expands the slider. Genre presets and undo/redo keep both controls synchronized. A manually chosen tempo remains when switching genres. Complexity is a visible 0–100% slider: increase it for extra hats, response kicks, percussion, and finer ending fills. Choose 1/32 or 1/64 to hear the new genres’ hat rolls. Press Generate to apply settings; export still uses the displayed pattern. Main anchors remain protected.

Profiles are starting points, not exhaustive definitions of a genre. Trap uses a half-time backbeat; Drill adds asymmetric hats and a second-bar snare response; Rap leaves more space; Breakcore adds denser bursts; IDM and Experimental use irregular recurring motifs; Hardcore anchors quarter-note kicks. Existing three-genre seeds keep their output.

**Reinstall the updated Download importer .xrnx before importing new genres.** Its validator now accepts all eighteen names; the file format remains version 1. Native Renoise verification is still pending; automated tests use a Lua host simulator.

### Additional breakbeat profiles

- **Classic Breaks** (`breaks`): A repeating broken kick motif, steady backbeat and light percussion pickups. Presets: 120, 130, 140 BPM.
- **Big Beat** (`bigbeat`): Weighty doubled kicks and a firm backbeat with spacious hat accents. Presets: 100, 110, 125 BPM.
- **Nu Skool Breaks** (`nuskoolbreaks`): Syncopated kick responses, displaced hats and short precision rolls. Presets: 130, 135, 140 BPM.
- **Electro Breaks** (`electrobreaks`): A straight machine-like hat pulse with broken kicks and a percussion counter-rhythm. Presets: 120, 130, 140 BPM.
- **Breakbeat Hardcore** (`breakbeathardcore`): Driving kicks combined with broken pickups, offbeat hats and energetic fills. Presets: 140, 150, 160 BPM.
- **Ragga Jungle** (`raggajungle`): Rolling ghost snares and percussion responses around a syncopated jungle skeleton. Presets: 160, 165, 175 BPM.
- **Atmospheric Jungle** (`atmosphericjungle`): Spacious kicks, restrained hats and quiet snare connections leave room around the groove. Presets: 155, 160, 170 BPM.
- **Footwork Jungle** (`footworkjungle`): Grouped kick bursts cross a half-time accent and a late snare response. A straight-grid hybrid starting point. Presets: 155, 160, 165 BPM.

These are rhythm starting points using the existing demo kit; they do not add sampled breaks or genre-specific sound design. All previous seed outputs are preserved. Importer version 0.3 accepts the added genre identifiers; reinstall it before using these files in Renoise.

### Improved original drum kit (importer 0.4)

Browser playback and packaged WAVs now share a layered drum renderer: a rounded kick with a short beater transient, a snare with pitched shell and filtered wires, metallic closed hats, and a pitched skin/rim percussion hit. Sounds have controlled peaks, DC filtering and tapered endings. They remain synthesized drums, not acoustic break recordings. Pattern generation and export notes are unchanged.

To hear them in the browser, export unsaved edits and refresh. In Renoise, reinstall importer 0.4 and run Tools > Breakbeat Pattern Maker > Load Original Demo Kit again. This appends the new kit; existing instruments are not overwritten. The importer maps matching names to the newest appended kit. Existing song patterns keep their current instruments until remapped.

### Break menu

Choose Genre default, Amen-inspired, Think-inspired, Apache-inspired, Funky Drummer-inspired or Hot Pants-inspired, then press Generate. These are original rhythm interpretations using the synthesized kit, not recordings or exact transcriptions. Break choice replaces the base kick/snare/hat/percussion motif; genre retains its detail/fill settings and tempo suggestions. Locks still preserve protected hits. Undo/Redo restores break choice. The exported pattern name includes the selected break and the existing importer accepts its notes without an update. CLI example: `node dist/cli.js --genre jungle --break amen --out exports/amen.bbpattern`. Authentic audio slicing/loading is not implemented.
