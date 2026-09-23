 > Superseded scope: this is a historical design. See PROJECT-SCOPE.md and README.md for the standalone sample tracker and WAV/MP3 export roadmap. Renoise integration is retired.

# Breakbeat Pattern Maker

## Product and implementation specification

Prepared for the product owner and implementation team • 22 September 2026

Build a local-first browser application with a deterministic TypeScript rhythm engine and a small Renoise Lua import tool. First prove that a generated pattern arrives correctly in Renoise; then build the editing and learning experience around that contract. No generative AI is required for the MVP.

The intended product combines a breakbeat generator, a tracker sequencer, a learning tool, and a Renoise companion. Its central promise is **a usable groove that the producer can understand, vary, and transfer reliably**.

The target interaction is Generate → Copy → Paste into Renoise. For the first release, “Paste” means pasting the application's structured transfer text into its companion tool, followed by Apply. Ordinary Ctrl+V into Renoise's Pattern Editor is a research item, not an established capability. A file importer is the release-critical fallback.

This is an implementation specification, not a claim that the application or importer has already been built. Technical facts are linked to primary documentation. Genre parameters and numerical thresholds are proposed product defaults to refine through listening tests, not universal definitions of musical genres.

## 1 Product overview

The application generates a short rhythmic phrase, exposes its musical structure, and compiles it into a concrete Renoise pattern. A producer chooses genre, tempo, bars, complexity, and break style; listens; locks the parts they like; mutates the rest; then transfers the result.

The engine should make musical decisions in stages: establish the rhythmic anchors, create a recognizable motif, add genre-specific detail, shape a phrase ending, then apply groove. Randomness chooses among musically weighted alternatives. It does not independently roll a dice for every cell.

Three representations share one editable pattern: Beginner, Renoise, and Hybrid. Switching views must preserve selection, timing, locks, history, and playback position. Hybrid is the default for first-time Renoise users.

**Recommended launch promise:** generate and edit Jungle, DnB Roller, and Hip-Hop Swing patterns, including one documented sliced-break workflow. These three exercise distinct generation behavior without requiring ten equally mature engines on launch day.

**Success targets:** after one-time sample mapping, a producer transfers a 2-bar pattern with no manual note repair; a novice can identify its main backbeat and one ghost note; mutation preserves locked material exactly. Target a median of under 30 seconds from Generate to an audible Renoise import after setup. Measure this in usability sessions rather than advertising it before validation.

## 2 Problem being solved

Programming convincing breaks requires several kinds of knowledge at once: rhythmic phrasing, slice choice, tracker notation, instrument mapping, and timing. A random sequencer often produces density without intent. A sample pack can sound good but offers little explanation or editability. A text generator can describe a groove while leaving the producer to reconstruct it manually.

The product closes this gap by keeping musical intent and export data together. A quiet snare is explicitly tagged as a ghost note; a slice repeat retains its source reference; a displaced kick carries its original anchor and timing offset. The same information powers the display, explanations, mutation constraints, and Renoise compiler.

Do not attempt to replace Renoise's mixer, arrangement, instrument editor, or final sound design. The companion should get a strong editable phrase into those existing tools quickly.

## 3 Target users

| User | Primary need | Product response |
| --- | --- | --- |
| New tracker producer | Connect beat names to tracker rows | Hybrid view, beat ruler, audition, explicit instrument mapping |
| Jungle or DnB producer | Fast variations that retain groove | Motif mutation, anchor locks, slice repeats, phrase fills |
| Hip-Hop, Trap or Drill producer | Space, hat phrasing and timing | Separate drum budgets, half-time feel, swing and velocity control |
| Breakcore or IDM producer | Controlled disruption | Local edits, high-resolution bursts, exceptions to anchor rules |
| Experienced Renoise user | Correct data with minimal friction | Hex fields, shortcuts, import at cursor, validated mapping profiles |
| Rhythm learner | Hear why an edit changes a groove | Hit explanations and before/after audition |

The first usability cohort should include both experienced Renoise users and producers who understand beats but have never used a tracker. Their failure modes are different.

## 4 Primary user journey

1. Choose a genre and a compatible kit or slice map. A supplied original demo kit makes the first session playable without setup.
2. Select a suggested BPM or type any supported value. Choose bars, complexity, and a style such as Rolling, Sparse, Chopped, or Fill-heavy.
3. Generate and listen. The first screen shows the backbeat, a beat ruler, and labeled drum lanes.
4. Select an interesting hit to audition and explain it. Lock the main snare beats, then mutate a selected beat or the entire phrase.
5. Open Transfer. Resolve missing samples, instrument slots, timing settings, and destination before applying.
6. Copy transfer text into the Renoise companion or save a transfer file and import it. Listen in Renoise and undo the import if needed.
7. Save the pattern and a variation in the local library with the seed and slice-map reference.

Avoid forcing a tutorial or account creation before the first beat. Provide an optional three-step introduction: listen, select a ghost note, lock and mutate.

## 5 Core features

**Generate and refine.** Generate Pattern uses the current controls and seed. Regenerate allocates a new seed, preserves constraints and locks, and records a history entry. Rebuilding with the same seed, engine version, map, and settings produces the same pattern.

**Mutation actions.** Mutate Pattern changes a bounded subset of eligible events. Mutate Selected Rows limits the same operation to the selection. Generate Fill targets a selected phrase ending. Simplify removes low-priority ornamentation first; Increase Complexity adds ornamentation before altering anchors. Humanize applies bounded velocity and timing variation. Randomize is an explicit high-variation operation but still honors locks and validity checks. Undo/Redo restores both events and relevant settings as one action.

**Locks.** Support whole-row, beat-range, slice-reference, and drum-element locks. In the MVP a lock freezes all matching event fields and protects empty cells in that region from insertion. A slice lock preserves occurrences of that slice; it does not secretly prevent other slices from being added elsewhere. Show the scope in a tooltip. If every eligible location is locked, return “No editable positions” rather than silently changing material.

**Library.** Save patterns, named variations, favorites, genre settings, slicing maps, and BPM presets. Use tags rather than separate incompatible object types for Classic Jungle, Amen Variations, DnB Rollers, Breakcore Chaos, Hip-Hop Swing, Trap Hats, Drum Fills, and Transitions. Search by genre, tempo, length, density, map, and favorite status. A missing sample produces a relink state, not a broken pattern record.

**History.** Keep an undo stack for the current session and named persistent snapshots for meaningful variations. Autosave the working draft. Save complete snapshots initially; compressed patches can wait until storage measurements justify them.

## 6 Pattern generator design

### Musical time and tracker time

Store musical time independently of the visible grid using integer ticks at **960 ticks per quarter note**. Here “tick” is the application's musical unit, not a Renoise effect tick. Use the term PPQ tick in code and UI documentation to distinguish them.

A bar contains numerator × 4 / denominator quarter notes. A 4/4 bar at LPB 4 has 16 rows; at LPB 8 it has 32 rows. Two bars at LPB 4 also have 32 rows. Always show bars, rows, LPB, and the subdivision together so a 32-row phrase is unambiguous.

For straight note grids 1/8, 1/16, 1/32, and 1/64, a convenient export LPB is 2, 4, 8, and 16 respectively. Grid resolution is an editing snap, not the storage precision. A 1/16 grid may still contain a microtimed event. Future triplet grids should use exact rational subdivisions supported by PPQ, with explicit export rounding.

Compile each realized event time t as q = t × LPB / 960, then quantize q × 256 to the nearest integer. Row is floor of that integer / 256; delay is its remainder modulo 256. Carry delay overflow into the following row. Convert zero-based application rows to one-based Lua line indices at the adapter boundary. The Renoise delay column divides a row into 256 positions, separately from effect ticks. [Renoise effect reference](https://tutorials.renoise.com/wiki/Effect_Commands)

Early notes move into the preceding row with a positive delay. An event before the start of a pattern is clamped with a visible diagnostic in the MVP; do not wrap it to the final row, which changes first-play behavior. Default groove protects the initial downbeat. Future pre-roll can support true anticipations.

### Generation pipeline

1. **Validate the request.** Resolve genre version, seed, meter, event budgets, source map, available roles, and locks.
2. **Choose a skeleton.** Select a weighted 1- or 2-bar template with kick and backbeat anchors. Template identifiers are part of provenance.
3. **Develop a motif.** Repeat a recognizable cell, then choose an allowed alteration for the response bar. Establish a rest budget as well as a hit budget.
4. **Fill role budgets.** Add hats, ghost snares, and percussion according to metrical weights and minimum spacing. Sample without replacement from eligible positions.
5. **Realize slices.** Map each intended role to a compatible sample or break slice. Avoid layering a separate snare over a slice that already contains a strong snare unless layering is deliberate.
6. **Shape the ending.** Add a fill in the last beat or half-bar when requested; preserve a clear loop return.
7. **Apply groove.** Apply swing first, then a role-specific timing offset, then seeded humanization. Keep velocity accents correlated across a motif.
8. **Validate and repair.** Resolve collisions, missing mappings, tail overlaps, illegal values, excess density, and lock conflicts. Repair only unlocked material.
9. **Explain and compile.** Generate explanations from final events, then create preview and Renoise outputs from the same realized pattern.

Use independent pseudo-random streams for skeleton, hats, fills, slice choices, and humanization. A change to hat density should not unexpectedly reroll the kick. Pin the PRNG algorithm and engine version, not just the seed string.

### Controls and exact meanings

| Control | Proposed behavior | MVP exposure |
| --- | --- | --- |
| Genre | Selects skeletons, role budgets, accents and allowed operations | Main panel |
| BPM | Numeric quarter-note BPM plus genre buttons; keep manual override | Main panel |
| Pattern length | 1, 2 or 4 bars; derived row count shown | Main panel |
| Time signature | MVP 4/4; later numerator and denominator | Display then advanced |
| Resolution | 1/8 through 1/64 snap; controls grid and preferred LPB | Main panel |
| Complexity | Macro for optional-hit budget and operation variety | Main panel |
| Syncopation | Weight weak positions and anticipations relative to anchors | Advanced |
| Swing | Delay alternate units of a chosen 1/8 or 1/16 pair | Advanced |
| Humanization | Correlated velocity variation plus bounded timing jitter | Advanced |
| Ghost amount | Quiet snare budget near backbeats and transitions | Advanced |
| Fill amount | Probability and event budget of phrase-ending fills | Advanced |
| Chop intensity | Allowed changes to source order and slice duration | Advanced |
| Randomness | Flatten weights within the permitted grammar | Advanced |
| Microtiming | Maximum deviation in milliseconds; role offsets editable later | Advanced |
| Repeat probability | Chance of reusing a slice or motif at the next eligible position | Version 2 separate control |
| Reverse probability | Chance of a supported slice reversal in eligible regions | Version 2 |
| Stutter probability | Chance of a short repeated-onset burst | Version 2 |
| Slice density | Maximum slice onsets per beat, separate from hat density | Version 2 separate control |

Basic complexity sets defaults until the user adjusts an advanced parameter; show that parameter as overridden. Reset to genre defaults is explicit. Describe whether a value is a probability, intensity, or timing amount; do not present everything as an unexplained percentage.

For swing, 50% means even pairs and 60% places the second onset 60% through the pair. Clamp the MVP range to 50–67%; advanced negative or extreme swing can follow later. Humanization defaults to restrained timing, for example ±3 ms on hats and ±1 ms on main backbeats, with ±5% gain variation. Microtiming is the cap, not a second randomizer. Reapplying Humanize starts from stored base timing, so offsets do not accumulate accidentally.

### Mutation identity

Use a default mutation budget of 20% of unlocked events, rounded up when anything is editable. Operators include move to a nearby permitted subdivision, substitute the same role, lower velocity into a ghost, repeat a motif fragment, and replace an ending. Main anchors are protected by genre policy unless the user explicitly enables structural mutation.

Measure similarity with weighted anchor preservation and event overlap within a small timing tolerance. For ordinary mutation, target at least 75% weighted similarity; this is a proposed acceptance threshold to tune by ear. Do not reject an explicitly requested fill merely because its selected region changes substantially. If a mutation is infeasible, explain why and leave the original intact.

## 7 Genre generation system

These are curated starting profiles, intended to cover recognizable production approaches without claiming that each genre has one correct rhythm. BPM ranges are indicative production envelopes; half-time notation can double the displayed number. All genre presets permit manual tempo overrides within the validated host range. A genre change updates suggestions but preserves a user-pinned tempo.

### Tempo and phrase defaults

| Profile | Indicative BPM | Preset buttons | Default phrase and density |
| --- | --- | --- | --- |
| Jungle | 150–180 | 160, 165, 170 | 2 bars; 20–36 total onsets |
| Drum & Bass | 165–180 | 170, 174, 176 | 2 bars; 22–38 onsets |
| Breakcore | 170–240+ | 180, 200, 220 | 2 bars; 30–64 onsets with rests |
| Trap | 120–160 or 60–80 half-time | 130, 140, 150 | 2 bars; 18–36 onsets |
| Hip-Hop | 75–105 | 80, 90, 95 | 2 bars; 16–28 onsets |
| Rap | 70–110 for the proposed spacious preset | 75, 85, 100 | 2 bars; 12–24 onsets |
| Drill | 130–150 | 138, 142, 146 | 2 bars; 16–32 onsets |
| IDM | 80–170 | 100, 130, 160 | 2 bars; 16–44 onsets |
| Hardcore | 160–200 | 165, 180, 195 | 2 bars; 24–40 onsets |
| Experimental breakbeat | 60–220+ | 90, 140, 190 | 2 bars; 8–56 onsets |

Onset budgets count simultaneous drum voices separately. They are proposed ranges at medium complexity in 4/4, not measurements of an entire genre. A long break slice can contain multiple audible transients, so also estimate audible density from the slice metadata.

### Jungle

**Kick and snare:** begin with a kick on beat 1; allow anticipations before 3 and late-bar pickups. Keep recognizable snares around 2 and 4, then allow a response-bar displacement or an extra snare. **Hats:** favor the break's internal ride/hat texture, adding an external hat only where space remains. **Groove:** medium-to-high syncopation; source-loop feel or slight swing rather than mandatory heavy shuffle. **Chops:** reuse short kick/snare fragments and occasional longer connective slices. **Fills:** 1/32 snare/slice bursts in the final beat. **Density/subdivision/randomness:** medium-high, primarily 1/16 with short 1/32 runs; moderate variation constrained by motif and backbeat.

### Drum and Bass

**Kick and snare:** the first Roller profile uses a two-step skeleton, often a downbeat kick plus a pickup later in the bar, with stable 2 and 4 snares. **Hats:** steady eighths or sixteenths with alternating accents. **Groove:** medium syncopation, restrained swing; strong low-end spacing. **Chops:** subtle fills and small variations under a repeated two-bar identity. **Fills:** brief changes at phrase boundaries. **Density/subdivision/randomness:** medium-high but regular, 1/16 base and occasional 1/32 detail; low randomness. Later add separate halftime, liquid, and jungle-influenced DnB profiles instead of averaging them into one rule set.

### Breakcore

**Kick and snare:** retain an identifiable opening or recurring anchor, then allow local displacement, doubled snares, and interruptions. **Hats:** irregular rapid bursts interspersed with silence. **Groove:** high syncopation; straight, shuffled, or intentionally interrupted cells. **Chops:** short slices, bounded reversals, pitch shifts, and abrupt source-order changes. **Fills:** more frequent and longer than Jungle, but followed by a recognizable return. **Density/subdivision/randomness:** high with explicit rest windows, 1/16 through 1/64; high local randomness and lower phrase-level randomness. A maximum burst duration and a quiet-space budget prevent constant undifferentiated noise.

### Trap

**Kick and snare:** sparse kick phrases leave space for bass; a default half-time clap/snare on beat 3 when counted at 140 BPM. **Hats:** sixteenth or eighth foundations with localized rolls, triplets in Version 2, and velocity/pitch shaping. **Groove:** syncopated kick and hats against a stable clap; straight or mild swing. **Chops:** usually optional one-shots or short textures, not mandatory Amen slicing. **Fills:** hat rolls and pickups near endings. **Density/subdivision/randomness:** sparse core with dense hat bursts, 1/16 and 1/32 plus later triplets; moderate hat variation, low clap randomness.

### Hip Hop

**Kick and snare:** kick on 1 plus a small number of conversational pickups; snare near 2 and 4. **Hats:** restrained eighths or sixteenths with alternating strength. **Groove:** medium syncopation, configurable swing, and slightly late snares. **Chops:** retain longer source fragments and their room sound. **Fills:** understated final-beat variations rather than continual rolls. **Density/subdivision/randomness:** low-medium, eighths and sixteenths; low randomness with intentional repetition.

### Rap

Rap is a vocal practice spanning many beat styles, not a mutually exclusive drum grammar. Present this as **Rap Space**, a vocal-friendly preset derived from the Hip-Hop engine, with Trap and Drill selectable underneath when appropriate. **Kick/snare:** fewer kick pickups, stable 2 and 4 backbeats in the initial preset. **Hats:** sparse eighths with occasional gaps. **Groove:** low-medium syncopation and optional swing. **Chops/fills:** longer fragments, limited fills, predictable phrase transitions. **Density/subdivision/randomness:** low, 1/8–1/16, very low randomness. The change is a concrete space budget and reduced ornamentation, not a new genre claim.

### Drill

Start with a clearly named **UK-inspired Drill** preset; other regional approaches should be separate profiles. **Kick and snare:** syncopated sparse kicks, a half-time snare anchor, and a response-bar snare variation chosen from curated templates. **Hats:** asymmetric short phrases and selective rolls rather than uninterrupted sixteenths. **Groove:** high local syncopation, mild adjustable swing. **Chops:** short percussion accents and selective breaks; protect bass space. **Fills:** small hat/snare pickups. **Density/subdivision/randomness:** medium, 1/16 and 1/32 plus later triplets; moderate hats, low anchor randomness. Optional bass triggers are separate from drum generation and do not imply automatic 808 pitch slides.

### IDM

**Kick/snare:** maintain a recurring cell, with weighted omissions and controlled displacement. **Hats:** evolving accent patterns and independent phrase lengths. **Groove:** high syncopation; straight or custom groove templates. **Chops:** short and long slices combined, selective timbral substitutions. **Fills:** transformations of the motif rather than generic snare rolls. **Density/subdivision/randomness:** medium-variable, 1/16–1/64; moderate randomness with repeatable structural rules. Polymeter and polyrhythm arrive later, since export must make their finite loop length explicit.

### Hardcore

Use a **four-on-the-floor Hardcore with break fills** profile initially. **Kick/snare:** kick every quarter note; optional snare/clap layers on 2 and 4. **Hats:** offbeat open hats or driving sixteenths. **Groove:** low syncopation in the kick, more in break overlays, usually limited swing. **Chops:** energetic fills around a stable kick spine. **Fills:** final-beat stutters and snare bursts. **Density/subdivision/randomness:** high, 1/16 with 1/32 fills; low structural randomness. Breakbeat-hardcore should be a separate future subprofile with a broken kick skeleton.

### Experimental breakbeat

**Kick/snare:** user-selected anchor requirements, including deliberate absence. **Hats:** sparse textures through dense bursts. **Groove:** broad syncopation and swing ranges with explicit controls. **Chops:** source-order permutations, silence, offset, and timbral changes. **Fills:** user-defined transformation windows. **Density/subdivision/randomness:** wide range, 1/8–1/64; high optional randomness bounded by voice count, duration, and lock invariants. Even this profile respects data validity and offers a recurring motif by default.

Each profile implements the same contract: skeleton templates, position weights per role, anchor policies, velocity accents, density curves, permitted transformations, fill grammar, and groove defaults. Store profile data separately from executable operators so users can eventually author presets without writing code.

## 8 Break slicing system

### Representation and preparation

A slice is a time range in an identified audio asset, with an editable role tag, transient position, original order, and optional confidence. It may contain several drums. “Break slice” is a source type; “snare” is a musical role. Preserve both rather than forcing a choice between them.

For the MVP, use a user-owned break already sliced in Renoise, or an original supplied break with a published slice map. The companion exports a small mapping manifest listing available slices and their trigger notes. The user assigns role tags where necessary. This avoids making automatic drum classification a prerequisite for good generation.

In Version 2, drag a WAV into the browser, decode it, display the waveform, and propose transient markers. Use short-window energy change and spectral flux, adaptive thresholding, and a minimum spacing constraint. The user merges, splits, moves, auditions, and labels slices. Zero-crossing adjustment should be small enough to preserve the attack; short edge fades reduce clicks. Store boundaries in integer frames with the source sample rate and file hash. If decoding resamples audio, convert times back to original frames and verify the count before exporting markers.

Renoise supports non-destructive slice markers and maps slices to trigger notes. Its stop-at-next-slice behavior matters: a slice can act as an isolated hit or continue through the source. Preserve this choice in the mapping contract. [Renoise waveform and slicing manual](https://tutorials.renoise.com/wiki/Waveform)

### Example source rearrangement

A hypothetical original break is tagged A kick, B hat texture, C snare, D kick pickup, E ghost snare, F snare with cymbal tail. A conservative variation might use A–B–C–B / D–E–F–B. A more chopped response might use A–rest–C–E / D–C–C–B. These are role sequences, not a claim about the exact contents or ownership of the historical Amen recording.

Preserve some neighboring source slices to retain room tone and momentum. Allow same-role substitutions before arbitrary substitutions. Protect strong snares from accidental replacement by quiet texture. Account for the internal onset offset: a slice whose transient occurs 8 ms after its boundary sounds late unless the engine compensates or intentionally preserves it.

### Operations and compiler policy

| Operation | Musical implementation | Export policy |
| --- | --- | --- |
| Normal playback | Trigger source slice and allow chosen tail | Mapped note, known instrument |
| Slice repeat | Reuse the same slice at later grid positions | Explicit notes preferred |
| Reverse | Reverse one slice or a chosen portion | Version 2: dedicated reversed sample preferred for preview parity |
| Stutter | Repeat a short onset over a bounded window | Explicit sub-grid events and tail control |
| Retrigger | Restart a playing source at tick intervals | Optional native effect only with validated TPL |
| Skip | Omit an onset | Empty trigger position; not automatically silence |
| Offset | Start within a slice or source | Distinguish sliced source from unsliced offset mode |
| Pitch change | Change playback rate or pitch intentionally | Never transpose a keymapped slice note blindly; it may select another slice |
| Half-time | Stretch rhythmic spacing within a defined phrase | Rebuild events, with explicit phrase-length policy |
| Double-time | Compress spacing or develop twice as many cells | Rebuild events and validate density |
| Ghost hits | Lower gain of a snare or snare slice | Explicit volume per onset |
| Snare fills | Insert bounded repeated or varied snare events | Dedicated lane when effects conflict |
| Kick substitutions | Replace a kick-role slice with a compatible kick | Resolve sample mapping before export |
| Microtiming | Shift realized onset without changing role | Compile to row plus delay |

An empty row means no new trigger, not a guaranteed silent audio interval. True silence needs sample-tail control, a suitable cut operation, or a pre-rendered gated sample. Define choke groups for closed/open hats and monophonic break playback; do not assume every note automatically chokes every other note.

For native effects, S selects a slice or an unsliced offset, B selects playback direction, and R retrigger timing depends on Renoise ticks per line. The retrigger in a volume/pan column is not identical to the effect-column form. Keep a tested capability table per compiler target. [Renoise effect semantics](https://tutorials.renoise.com/wiki/Effect_Commands)

Avoid time stretching in the first release. Play one-shots and short slices at their intended rate, allowing gaps or controlled overlap. A full-break tempo change with independent pitch preservation is a separate DSP feature with audible tradeoffs.

## 9 Visual and color system

Use drum-role color consistently across cells, waveform markers, labels, legends, and explanations. Use a separate outline or small S badge for sliced audio, a G badge for ghost notes, and a padlock icon for locked events. Color is never the only identifier.

| Element | Color token | Secondary identification |
| --- | --- | --- |
| Kick | Coral red #F07178 | K label, filled square |
| Snare or clap | Blue #5DA9F6 | SN label, diamond |
| Hi-hat | Gold #E5C453 | HH label, short tick |
| Ride | Amber #DFA36D | RD label, ring |
| Cymbal or crash | Violet #B995E8 | CY label, burst icon |
| Ghost snare | Light blue #A8D5F5 | G label, outlined diamond |
| Percussion | Teal green #64C4A0 | P label, triangle |
| Unclassified break slice | Lavender #B5A1E8 | S label and slice number |
| Rest or no trigger | Gray #82909F | Dot; distinguish an explicit cut |
| Optional bass hit | Rose #E394BC | B label, long rectangle |

Suggested dark canvas: #111820 with primary text #EDF2F7. Colored fills use dark text and must be contrast-tested; colored text on arbitrary backgrounds is not automatically accessible. Provide a high-contrast theme and a monochrome label mode. Ghost notes remain readable rather than becoming nearly transparent.

Beat boundaries have stronger horizontal rules, bar starts have a distinct ruler marker, and subdivisions use faint guides. Row numbers can switch between decimal and hexadecimal, but the selected mode is explicit. Selection uses an outline; playback uses a row marker; neither replaces role color. Volume is represented by a small level bar in Beginner view and a numeric field in Renoise view.

## 10 Renoise integration strategy

### Verified foundation and research boundary

The official downloads page currently lists Renoise 3.5.4. Use that as the initial Windows test target, record the installed build and API version, and claim additional operating-system/version support only after testing. [Renoise downloads](https://www.renoise.com/download)

The Lua API exposes editable pattern and note-column objects. This is the reliable architectural foundation for importing structured events. The public Application API lists a clipboard-slot selector, but that alone does not document an operating-system clipboard payload or a text clipboard reader. Do not invent `get_clipboard_text`, a native MIME type, or an XML clipboard schema. [Application API](https://renoise.github.io/xrnx/API/renoise/renoise.Application.html), [Pattern API](https://renoise.github.io/xrnx/API/renoise/renoise.Pattern.html), [NoteColumn API](https://renoise.github.io/xrnx/API/renoise/renoise.NoteColumn.html)

### Transfer options

| Route | What it can preserve | Reality and release decision |
| --- | --- | --- |
| Plain tracker text → Pattern Editor | Human-readable notes and fields | Not verified as native paste input; never label as compatible export |
| Native clipboard adapter | Potentially native pattern cells | Research only; requires real payload capture and cross-version tests |
| App JSON text → Lua tool dialog | Events, mapping references, timing and metadata | Proposed copy/paste route; prototype long-text paste and UI limits first |
| .bbpattern file → Lua tool | Same structured payload as text route | Required MVP fallback using a normal file-open dialog |
| .mid export | Notes, timing, velocities, tempo metadata | Version 2 interoperability route; loses sample identities and tracker effects |
| Generated .xrns song | Potential full song and sample context | Later; use verified fixtures and schemas, avoid hand-invented archives |
| .xrni instrument | Sample and mapping companion | Useful for a licensed demo kit; not the pattern itself |
| File drag and drop | Depends on file type and target | Custom files need tool import hooks and tested drop locations |
| Desktop bridge | Native file access and possible clipboard support | Later, if browser handoff friction justifies packaging |

Renoise documents MIDI as a song import format; this is not equivalent to pasting a drum clip into the current selection. Test its load options and timing behavior before offering it as an alternative. [Renoise Disk Browser](https://tutorials.renoise.com/wiki/Disk_Browser)

### MVP companion tool

Distribute a normal `.xrnx` Lua tool, not a VST. Package `manifest.xml`, `main.lua`, a JSON parser, validation, import planning, and mapping modules. The official tool system supports menu entries, keybindings, and file-import hooks. [Tool packaging](https://renoise.github.io/xrnx/start/tool.html), [ScriptingTool API](https://renoise.github.io/xrnx/API/renoise/renoise.ScriptingTool.html)

The default command is **Import Breakbeat Pattern**. It opens a transfer dialog with Paste Text and Open File routes. After pasting, the user chooses Apply. Do not imply that Lua can read the clipboard automatically. If text-widget paste, payload size, or platform behavior is unreliable, keep Open File as the primary route and label copy/paste experimental until it passes.

Use a versioned application format, proposed as `.bbpattern`, containing UTF-8 JSON. This is explicitly our format, not a Renoise file type. Downloading it from a browser and opening it in the tool is sufficient for the MVP. A future import hook can add drag and drop; a generated browser object is not automatically an operating-system draggable file.

The importer resolves abstract IDs such as `kit.kick` and `break.snareA` to actual song instrument slots and trigger notes. An instrument number is not a sample number. The same note may select different samples in different mappings. Cache mappings per song/profile, verify that referenced samples still exist, and show a concise mismatch report.

### Preflight and application

1. Parse with a non-executing JSON decoder. Enforce schema version, byte size, nesting, event count, numeric ranges, and known operation types. Never evaluate Lua or JavaScript from a payload.
2. Build an import plan without editing the song. Resolve the destination pattern, start row, sequencer tracks, note columns, effect columns, and instrument mapping.
3. Default to a new pattern with dedicated destination tracks. Import-at-cursor is an explicit option. Warn about nonempty cells; do not overwrite unrelated tracks or shared pattern aliases silently.
4. Check BPM, LPB, TPL, and existing song groove. BPM and LPB changes affect the song, not only this pattern. Offer Keep song timing with recompilation or Apply pattern timing with a clear impact summary. Never apply both baked swing and host groove unintentionally.
5. Allocate columns for simultaneous hits. MVP uses separate kick, snare, hat, percussion, and break lanes. Detect collisions after delay quantization, not only before it. Query host limits rather than assuming unlimited tracks or columns.
6. Validate the entire plan, snapshot affected cells and settings, apply synchronously in one import action where feasible, and verify read-back. Use Renoise's undo description support and test the actual undo grouping. Retain a restore snapshot if a write fails partway through. [Song API](https://renoise.github.io/xrnx/API/renoise/renoise.Song.html)
7. Report imported bars, destination, and any rounding or unsupported operation. A failed preflight makes no edits. Unsupported effects are rejected or replaced through an explicit previewed fallback, never discarded silently.

At the API boundary, `song.instruments[1]` refers to the first instrument, while its pattern instrument field is `00`. Use explicit `note_string`, `instrument_value`, `volume_string`, `panning_string`, and `delay_value` assignments in the adapter. Keep note off and empty cells distinct. The API exposes both numeric and tracker-style representations. [NoteColumn API](https://renoise.github.io/xrnx/API/renoise/renoise.NoteColumn.html)

### Clipboard abstraction

Define `TransferAdapter.inspect(pattern, target)`, `compile(pattern, mapping, timing)`, and `deliver(compiled)`. Return diagnostics and a capability descriptor including textPaste, fileImport, nativeClipboard, effects, and sampleAssets. Implement `JsonFileAdapter` first, `ToolTextAdapter` second, and reserve `NativeRenoiseClipboardAdapter` behind a disabled capability flag.

Phase 1 native-clipboard research must copy known selections from Renoise and inspect actual available formats on each target OS. Test multi-track data, empty rows, delay fields, effect columns, and round trips. Browser text clipboard access does not guarantee the ability to write an application-specific native clipboard format. Browser copy should use an explicit user gesture and a selectable-text/download fallback. [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard)

## 11 Educational features

Generate explanations from the final event graph and musical context. Keep rule IDs and transformation provenance, but re-analyze after manual edits so the explanation describes what is currently audible. Use deterministic templates in the MVP; an LLM adds cost and uncertainty without solving a necessary problem.

The hit inspector shows role, beat position, loudness, source slice, timing offset, and reason for inclusion. A “Hear without this hit” action compares the loop with that event muted. Explain only effects that actually exist in the compiled pattern.

Example explanations:

- “This kick falls on the final sixteenth before beat 3, creating an anticipation of the next strong beat.”
- “This ghost snare is quieter than the main backbeat. It connects the surrounding hits without replacing the accent on beat 4.”
- “This snare slice repeats at 1/32-note spacing across the final half-beat, making a short, rapid fill.”
- “This hi-hat is delayed by 4 ms. Its position is slightly behind the grid, while the main snare stays on time.”

Correct a common teaching error: an offbeat sixteenth can be exactly on the grid. Syncopation concerns metrical emphasis and expectation; microtiming concerns deviation from the nominal grid. Neither should be described as the other.

**Explain this beat** highlights anchors first, then weak-position accents, ghost notes, fills, and source-slice reuse. Provide a short paragraph and clickable examples. Show “likely syncopation” for ambiguous patterns rather than treating every weak-position hat as syncopation. A later tutorial can ask the learner to remove ghosts, move a kick, or straighten swing and compare the result.

## 12 User interface structure

The desktop layout has a compact transport and preset strip above a large tracker grid. A left panel holds generation controls; a right inspector explains the selection. A collapsible bottom panel holds waveform/slice mapping and library/history tabs. On smaller displays, the inspector becomes a drawer; keep the grid usable before squeezing every panel onto screen.

```text
Genre  Style  BPM [160][165][170][numeric]  Bars  Play  Generate
Controls        Beginner | Hybrid | Renoise        Transfer
Complexity      Row  Beat   Kick   Snare   Hat   Break   Inspector
Groove          00   1.1    K      .       HH    .       Role
Ghosts          01   1.e    .      .       .     .       Position
Fills           02   1.&    .      .       HH    S       Why it works
Advanced        ...                                      Audition
                Lock  Mutate selection  Fill  Undo  Redo
Library | Variations | History | Slice map               Seed
```

**Beginner:** cells show Kick, Snare, HH, and slice labels, with gain bars and audible beat counting. Hide hex commands until the user opens an explanation. **Renoise:** vertical row progression, fixed-width notes, instrument, volume, pan, delay, and effects; provide decimal/hex row switching. **Hybrid:** tracker fields remain visible and compact labels explain each hit.

Every event can expose row number, bar/beat/subdivision, sample or slice name, role, note, instrument slot, sample reference, volume, pan, delay, and effects. Sample reference is explanatory metadata; it must not masquerade as an extra native Renoise pattern column. Simultaneous hits occupy separate columns/lanes, not a text string jammed into one cell.

Keyboard operation: arrows navigate, Shift+arrows select, Space plays/stops when outside a text field, L toggles a lock, Delete removes selected unlocked events, and standard Undo/Redo works. Expose Generate and Mutate through discoverable shortcuts that do not override text editing. Native numeric fields commit on Enter and cancel on Escape. Audition never steals selection.

**Key UI states:** no map loaded; generated and valid; dirty manual edits; generating; incompatible source map; unsupported export operation; successful import payload; clipboard failure with fallback. Control changes do not silently destroy manual edits: show “Settings changed” and require Generate or Mutate to apply them.

## 13 Technical architecture

### Application options

| Option | Advantages | Costs and limitations | Recommendation |
| --- | --- | --- | --- |
| Browser app | Fast distribution, rich visual teaching, local processing | Clipboard permissions, file handoff, background audio limits | MVP UI and engine |
| Tauri desktop app | Reuses web UI, native file access, potential bridge | Packaging, permissions, OS webview differences, signing | Version 2 if handoff needs it |
| Electron desktop app | Consistent Chromium, broad Node ecosystem | Larger distribution and ongoing security updates | Alternative if consistent audio/browser behavior outweighs size |
| Renoise-only Lua tool | Direct song access and host audio | More constrained UI and harder standalone learning experience | Thin importer first; optional compact generator later |

Use a browser plus a Lua tool, with no server, account system, or cloud sample upload. A pure Lua MVP would shorten native import work, but would sacrifice much of the intended visual learning experience. The two components should share a data contract, not duplicated musical engines.

### Module boundaries

```text
React UI → command/history layer → canonical Pattern
                              ↗ generation core + genre profiles
Pattern → groove realization → validation → analysis/education
                                      ↘ audio preview scheduler
                                      ↘ Renoise compiler → JSON transfer
JSON transfer → Lua validation → import plan → Renoise song API
Pattern + assets + presets ↔ local IndexedDB repository
```

Keep `core` as pure TypeScript with no DOM, Web Audio, React, or Renoise dependencies. Expose `generate(request)`, `mutate(pattern, request)`, `analyze(pattern)`, and `validate(pattern)`. The compiler turns semantic operations into supported host fields; the generator never emits raw tracker text.

Suggested workspace layout: `apps/web`, `packages/core`, `packages/genre-profiles`, `packages/schema`, `packages/audio`, `packages/renoise-export`, `tools/renoise-importer`, and `fixtures`. Use JSON Schema as the cross-language contract with TypeScript types generated from it. The Lua validator supports the same restricted schema and shares accepted/rejected fixtures.

Use a Web Worker for generation or analysis once profiling shows perceptible blocking. A generation request has an ID; stale worker results are discarded. Small deterministic patterns can initially run synchronously if measured response time is acceptable.

### Audio and storage

Use Web Audio `AudioBufferSourceNode` scheduling against `AudioContext.currentTime`, with a short lookahead scheduler, per-event gain, panning, and explicit choke behavior. Start audio only after a user gesture. UI animation follows the audio clock; it does not drive note timing. Web Audio provides decoded sample buffers and scheduled sources. [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

Proposed starting scheduler settings are a 25 ms wake interval and 100 ms lookahead, to be tuned under load. Stop cancels queued sources and resets voices. Recompiling a playing phrase takes effect at the next loop boundary. Handle suspended contexts and background tabs explicitly. Do not promise that browser playback emulates every Renoise effect or sampler envelope.

Store pattern snapshots, presets, mapping profiles, and favorite seeds in IndexedDB through Dexie. Store optional audio blobs separately, keyed by asset hash; patterns reference them. Include schema migrations, storage-quota handling, and a downloadable backup. Browser storage can be cleared or evicted, so local persistence alone is not a backup. [Dexie documentation](https://dexie.org/)

For Version 2 waveform editing, use wavesurfer.js Regions for interaction, backed by the application's frame-accurate slice model. Its waveform display is not the authoritative multi-voice sequencer clock. Keep clip sizes bounded because browser decoding consumes memory. [wavesurfer.js](https://wavesurfer.xyz/)

## 14 Proposed internal data model

Store semantic intent, realized timing, provenance, and mapping separately. Empty grid cells are implicit; explicit rests/cuts require their own event type. The following valid JSON is a deliberately small two-event pattern, not the complete example in section 22.

```json
{
  "schemaVersion": 1,
  "id": "pattern-jungle-001",
  "name": "Jungle starting phrase",
  "engine": { "version": "0.1.0", "seed": "amen-study-042" },
  "genre": { "id": "jungle", "version": 1 },
  "tempo": { "bpm": 165, "beatUnit": "quarter" },
  "meter": { "numerator": 4, "denominator": 4 },
  "lengthBars": 2,
  "ppq": 960,
  "grid": { "division": 16 },
  "generation": {
    "complexity": 0.45, "syncopation": 0.4,
    "ghostAmount": 0.3, "fillAmount": 0.25,
    "chopIntensity": 0.3, "randomness": 0.2
  },
  "groove": { "swingRatio": 0.5, "swingUnit": 16,
              "humanizeMs": 0, "microtimingLimitMs": 6 },
  "lanes": [
    { "id": "kick", "role": "kick", "chokeGroup": "kick" },
    { "id": "break", "role": "mixed", "chokeGroup": "break" }
  ],
  "assets": [
    { "id": "demo-break", "sampleRate": 48000,
      "frameCount": 144000, "contentHash": null }
  ],
  "sliceMaps": [
    { "id": "demo-map-v1", "assetId": "demo-break", "slices": [
      { "id": "snare-a", "startFrame": 36000, "endFrame": 48000,
        "transientFrame": 36000, "roles": ["snare"],
        "stopAtEnd": true }
    ] }
  ],
  "events": [
    { "id": "e1", "type": "hit", "laneId": "kick",
      "role": "kick", "source": { "kind": "oneShot", "id": "kit.kick" },
      "baseTick": 0, "offsetTick": 0, "durationTick": 120,
      "gain": 0.875, "pan": 0, "probability": 1,
      "operations": [], "tags": ["anchor"],
      "provenance": { "rule": "jungle.downbeat", "parentEventId": null } },
    { "id": "e2", "type": "hit", "laneId": "break",
      "role": "snare", "source": { "kind": "slice",
        "mapId": "demo-map-v1", "sliceId": "snare-a" },
      "baseTick": 1680, "offsetTick": 0, "durationTick": 120,
      "gain": 0.25, "pan": 0, "probability": 1,
      "operations": [], "tags": ["ghost"],
      "provenance": { "rule": "jungle.snarePickup", "parentEventId": null } }
  ],
  "locks": [ { "kind": "event", "eventId": "e1", "fields": ["*"] } ],
  "exportIntent": { "target": "renoise", "lpb": 4,
    "tpl": 12, "mappingProfileId": "user-map-1",
    "timingPolicy": "preflight", "probabilityPolicy": "bake" }
}
```

Here baseTick 1680 is row 7 at LPB 4. A ghost is an articulation tag on a snare, not a separate incompatible instrument type. Gain is normalized 0–1; pan is −1 to +1. `durationTick` is the desired gate window; the compiler must report when an existing instrument cannot honor it. Source audio and envelope behavior determine the actual tail.

A mapping profile might bind `kit.kick` to instrument field `00`, note `C-4`, and `demo-map-v1/snare-a` to instrument `03`, note `D-4`. Those values belong to the profile, not the genre rule. The export compiler emits numeric row/column locations and validated tracker fields into a derived transfer payload.

Production assets require a non-null hash and verified frame count; null in the example marks an unresolved asset. Do not export unresolved source identities without a deliberate “use my mapped instrument” binding. Separate musical pitch from slice trigger note so a transpose operation cannot accidentally change the source slice.

Future probabilistic playback needs an explicit choice: bake one seeded realization for consistent preview/import, or preserve host probability with a warning that repeats may differ. MVP always bakes events. Save parent pattern IDs, mutation seed, and engine version with library variations.

## 15 MVP scope

Ship a browser app and Windows-tested Lua importer with these bounded capabilities:

- Jungle, DnB Roller, and Hip-Hop Swing profiles; an original demo kit and one curated break map.
- Deterministic generation in 4/4, 1–4 bars, 1/8–1/64 straight editing grids, explicit BPM presets and numeric override.
- Beginner, Hybrid, and Renoise views, shared selection, role colors, editable hits, volume and timing.
- Complexity plus advanced syncopation, swing, ghosts, fills, chopping, randomness, and bounded humanization.
- Generate, Regenerate, scoped mutation, Generate Fill, Simplify, Increase Complexity, Humanize, constrained Randomize, locks, and Undo/Redo implemented through a common command layer.
- Slice selection and explicit repeats using pre-existing maps; supported tails/chokes documented per kit.
- Local pattern/variation/preset library, favorite seeds, draft autosave, and JSON backup.
- Per-hit explanations and a concise whole-pattern analysis.
- Basic sample preview with mute/solo and looping.
- Validated `.bbpattern` import; tool text paste enabled only after its prototype passes. Preflight, mapping, read-back, and undo are mandatory.

Exclude automatic transient detection, advanced native effects, separate per-operation probability controls, cloud accounts, browser-to-Renoise live sync, AI generation, time stretching, MIDI export, and a full sample editor. The grid should not become a second DAW.

**Release gate:** a user can generate, hear, mutate, transfer, and undo a supported pattern without repairing rows by hand. Every advertised operation must have a verified mapping and preview policy. A file-based first release is acceptable if tool paste is unreliable; falsely labeling text as native Renoise clipboard data is not.

## 16 Version 2 scope

Add Trap, Rap Space, UK-inspired Drill, Breakcore, IDM, Hardcore, and Experimental profiles in listening-tested batches. Expand existing genres with named substyles. Introduce editable time signatures and triplet grids with compiler fixtures.

Add WAV import, waveform slicing, transient proposals with manual correction, source-map export/import, and sample audition. Add separate repeat, reverse, stutter, and slice-density controls, per-lane variation amounts, supported pitch operations, and a tested native effect subset.

Add A/B comparison with matched playback start, groove and swing templates, richer library filtering, favorite BPM sets, downloadable MIDI plus a mapping report, and interactive lessons. A share code can include a compact pattern, profile versions, and seed without redistributing the user's samples.

Evaluate a Tauri wrapper only after measuring real transfer friction. Native file/clipboard access can help, but does not remove the need to validate Renoise compatibility. Tauri supports web frontends within a native application architecture. [Tauri architecture introduction](https://v2.tauri.app/start/)

## 17 Future ideas

Consider MIDI input for tapping rhythm, Euclidean rhythm overlays, per-lane polymeter, finite polyrhythm export, user-created genre profiles, difficulty levels, multi-pattern song phrases, and probability scenes. These should use the existing event model and validation layer.

Explore audio-to-groove extraction, automatic role classification with confidence, source-aware transient alignment, time stretching, and live host synchronization. Each needs separate audio and UX evaluation. A future AI assistant could explain an edit or propose a profile, but generated claims must be grounded in actual events and the deterministic engine remains authoritative.

Shared URLs should store a versioned compact pattern or a seed plus all required versions and settings. A seed alone is insufficient when the engine or source map changes. Share audio only when the user supplies redistributable material. Collaboration and cloud libraries should follow proven demand, not precede reliable export.

## 18 Risks and technical challenges

| Risk | Impact | Mitigation and evidence required |
| --- | --- | --- |
| Native clipboard assumptions | Core promise fails | Treat native adapter as research; retain validated file import |
| Wrong instrument or slice mapping | Correct rhythm plays wrong sounds | Stable IDs, map fingerprints, audition and preflight |
| Host LPB or groove mismatch | Timing changes after import | Compile for actual LPB; inspect groove; explicit timing policy |
| Simultaneous events exceed columns | Lost notes or wrong effects | Allocation planner and hard failure before editing |
| Sample tails and choking differ | Preview sounds unlike Renoise | Supported-kit envelope contract and audible parity fixtures |
| Slice-note pitch confusion | Transposition triggers wrong slice | Separate musical pitch from trigger note |
| Over-randomized genre rules | Unconvincing results | Anchors, motifs, density/rest budgets and blind listening tests |
| Existing song edits are damaged | Loss of user work | New destination default, collision report, undo and restore snapshot |
| Sample redistribution | Shipping unauthorized recordings | Original or licensed demo audio; user assets stay local |
| Browser timing and memory | Stutters, UI pauses or decode failures | Audio-clock scheduling, bounded clips, stress tests |
| Source-map changes | Saved patterns refer to different audio | Versioned maps, content hashes and explicit relinking |
| Storage eviction | Lost presets or patterns | Downloadable backups and quota/error handling |
| Technical controls overwhelm beginners | Poor learnability | Five primary choices, progressive advanced controls |

The most important uncertainty is the transfer experience on an actual installed Renoise build. Documentation establishes the API route; it does not prove an end-to-end implementation. Phase 1 must turn this uncertainty into a tested fixture before substantial UI investment.

## 19 Recommended development stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | Shared types and a fast static-app development loop |
| UI state | Reducer/command store plus immutable snapshots | Predictable undo, regeneration and selection behavior |
| Grid | Semantic DOM/CSS grid with row virtualization if measured necessary | Keyboard accessibility and inspectable cells |
| Core engine | Pure TypeScript modules and a pinned seeded PRNG | Determinism, portability and straightforward testing |
| Validation | JSON Schema with Ajv in browser/build; matching Lua checks | Cross-language transfer contract |
| Preview | Direct Web Audio scheduler | Explicit timing, gain, pan and choke control |
| Waveform | wavesurfer.js Regions in Version 2 | Established waveform interactions; custom slice model remains authoritative |
| Slicing | Worker-based transient analysis plus manual markers | Responsive UI and editable results |
| Persistence | Dexie/IndexedDB with JSON backup | Local-first patterns and optional audio blobs |
| Transfer | JSON text/download; Lua `.xrnx` importer | Avoids undocumented native clipboard dependencies |
| Testing | Vitest, property tests, Playwright, Lua fixture harness | Covers engine, UI, compiler and real host behavior |
| Packaging | Static web build; optional Tauri later | Minimum initial operational burden |
| Server | None for MVP | No account, upload or infrastructure dependency |

Vite supplies a React/TypeScript starting point; pin the supported Node runtime and dependency versions at project setup rather than copying stale version numbers into the plan. Commit the lockfile and test dependency updates against export fixtures. [Vite guide](https://vite.dev/guide/)

Use [Ajv](https://ajv.js.org/) for schema validation, [Vitest](https://vitest.dev/) for core tests, and [Playwright](https://playwright.dev/) for browser flows. If choosing Electron later, budget for its documented security and update responsibilities. [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)

## 20 Development roadmap

Use gated outputs rather than calendar promises. Each phase ends with an inspectable artifact and a clear exit criterion. The sequence below matches the product's component structure; the final implementation order brings the transfer prototype and minimal audio forward.

### Phase 1 Research Renoise pattern and export requirements

**Goal:** prove a reliable transfer path before committing to UI assumptions.

**Tasks:** record host/API versions; make a fixture with simultaneous kick/hat, a ghost, a delayed hit, and a mapped slice; write/read it through Lua; test long-text paste in a tool dialog, file import, undo, and destination collisions. Inspect native clipboard formats as a separate bounded spike. Audit BPM/LPB/TPL and note/column limits.

**Expected output:** compatibility matrix, minimal importer proof, mapping manifest, round-trip fixture, and a go/no-go decision for tool paste. **Dependencies:** installed target Renoise, original test samples, API documentation. **Main risks:** clipboard assumptions, version differences, unclear effect scope. **Exit:** file import reproduces fixture fields and sound; unsupported routes are labeled.

### Phase 2 Define pattern data model

**Goal:** establish one contract for UI, preview and export.

**Tasks:** formalize musical ticks, meter, source IDs, gain/pan, operations, provenance, locks, realized events, mapping profiles, and transfer payload; define migrations and size limits.

**Expected output:** JSON Schema, TypeScript types, Lua validation fixtures, and sample files. **Dependencies:** Phase 1 findings. **Main risks:** mixed index bases, timing drift, confusing a slice key with musical pitch. **Exit:** valid fixtures round-trip without semantic change and malformed ones fail cleanly.

### Phase 3 Build deterministic drum pattern generator

**Goal:** generate a musically useful phrase without a UI.

**Tasks:** implement PRNG streams, skeleton selection, role budgets, accents, rests, validation and text diagnostics; start with kick/snare/hat and one fixed mapping.

**Expected output:** core package and a development command that writes a fixture payload. **Dependencies:** Phase 2. **Main risks:** random streams coupling and weak musical phrasing. **Exit:** repeated seed/config produces identical events and the phrase imports through the Phase 1 tool.

### Phase 4 Add genre rules

**Goal:** make genre affect rhythm and development.

**Tasks:** implement Jungle, DnB Roller and Hip-Hop Swing profiles; add weighted templates, phrase responses and role-specific groove defaults; conduct first listening review.

**Expected output:** versioned profile files and a small accepted seed library. **Dependencies:** Phase 3. **Main risks:** stereotyped rules, genres differing only in tempo. **Exit:** patterns remain distinguishable at matched BPM in listener comparisons.

### Phase 5 Create tracker and grid interface

**Goal:** make the pattern editable and intelligible.

**Tasks:** build row/beat ruler, lanes, Beginner/Hybrid/Renoise projections, selection, field editing, labels, colors, focus navigation, and the command/history foundation.

**Expected output:** accessible editor using fixed fixtures and generated patterns. **Dependencies:** Phase 2; Phase 3 for real generation. **Main risks:** selection inconsistencies, dense unreadable fields, poor keyboard access. **Exit:** editing the same event in any view updates the others with no data loss.

### Phase 6 Add BPM and generation controls

**Goal:** provide predictable control over generation.

**Tasks:** add genre buttons and numeric BPM, bars, resolution, complexity, progressive advanced controls, overrides, seed entry, and dirty-settings state.

**Expected output:** complete main generation flow. **Dependencies:** Phases 4 and 5. **Main risks:** misleading control meanings, automatic overwrite of manual edits. **Exit:** each control has a documented, testable effect and manual tempo survives genre changes.

### Phase 7 Add break slice engine

**Goal:** produce mapped, convincing slice phrases.

**Tasks:** load a slice manifest, assign roles, resolve slice selection, implement source-neighbor continuity, repeats, and tail/choke policy. Keep waveform auto-slicing outside MVP.

**Expected output:** one original demo break and one user-mapped break working end to end. **Dependencies:** Phases 1–4; basic audio for listening. **Main risks:** wrong sample mapping, late transients and doubled drums. **Exit:** slices import accurately and preserve a recognizable rhythmic motif.

### Phase 8 Add pattern mutation

**Goal:** create variations while preserving identity.

**Tasks:** implement mutation budgets, selection scopes, all lock types, simplify/complexify, fills, humanization and constrained randomize through the command layer.

**Expected output:** reversible mutations and regression fixtures. **Dependencies:** Phases 5 and 7. **Main risks:** locks leaking, undo missing settings, excessive changes. **Exit:** locks are invariant across repeated actions; ordinary mutations pass identity and listening checks.

### Phase 9 Implement Renoise export and copy workflow

**Goal:** turn the early import proof into a dependable user workflow.

**Tasks:** finalize compiler, mapping UI, preflight, target selection, collision handling, timing policy, file export, optional tool-text paste, read-back diagnostics and undo recovery.

**Expected output:** installable `.xrnx`, versioned transfer contract and compatibility guide. **Dependencies:** Phase 1 proof, Phase 2 schema, Phase 7 mappings. **Main risks:** host-state changes, partial writes, unsupported effects. **Exit:** representative supported patterns import without manual note repair; failures preserve the song.

### Phase 10 Add educational mode

**Goal:** teach from the pattern actually on screen.

**Tasks:** implement metrical analysis, ghost/fill tagging, slice-reuse summaries, contextual wording, and compare-without-hit audition.

**Expected output:** hit inspector and Explain this beat. **Dependencies:** Phases 5 and 8 plus preview. **Main risks:** stale provenance or misleading syncopation language. **Exit:** explanations remain accurate after manual edits and mutation.

### Phase 11 Add audio preview

**Goal:** make generation and learning immediately audible.

**Tasks:** finish audio-clock scheduling, loop boundaries, mute/solo, sample audition, stop/cancel behavior, gain staging, source-rate handling and playback-state UI. Build a minimal audition harness much earlier for Phases 3 and 4.

**Expected output:** stable browser preview and documented host parity limits. **Dependencies:** Phase 2 timing and Phase 7 sources. **Main risks:** jitter, clipping, suspended audio, different sampler tails. **Exit:** long-loop and CPU-load checks pass and supported-kit timing agrees with Renoise fixtures.

### Phase 12 Testing and refinement

**Goal:** release the smallest trustworthy product.

**Tasks:** run property, fixture, integration, accessibility, persistence and audio tests; observe first-session users; refine profiles; package samples, docs and importer; record support boundaries.

**Expected output:** release candidate, regression library, onboarding and known limitations. **Dependencies:** all MVP paths. **Main risks:** broad scope, undocumented import edge cases, musical quality judged only by the implementer. **Exit:** section 21 acceptance criteria pass and unsupported features remain out of the advertised scope.

## 21 Testing strategy

### Engine and timing

Run property tests across many seeds and settings: events remain in bounds; locked events and protected empty positions remain unchanged; generation is deterministic; budgets and source references are valid; normalization never loses simultaneous notes. Test each operator's invariant rather than snapshotting every possible output.

Verify conversion at row boundaries, delay FF, early notes, end-of-pattern carry, multiple LPBs, and compound meters when introduced. At 165 BPM and LPB 4, one row is about 90.909 ms; one delay unit is about 0.355 ms. A nearest-unit conversion should differ by at most half a unit away from explicitly clamped boundaries. Test mathematical timing separately from audible device latency.

### Renoise integration

Keep accepted fixture songs and source samples. Import and read back every written field, including note, instrument, volume, pan, delay and effects. Test first and last rows, offsets into existing patterns, missing instruments, wrong slice maps, column exhaustion, aliasing, pre-existing groove, and a destination that changes while the transfer dialog is open. Revalidate immediately before Apply.

Test malformed, oversized and newer-schema payloads. Simulate a mid-import failure and verify restore behavior. A single Undo should restore the documented affected state; if the host cannot guarantee grouping, provide and test a tool Restore Last Import action before release. No manual clipboard inspection result substitutes for testing the advertised transfer workflow.

### Audio and musical quality

Use fixed fixtures and the same original samples to compare browser onsets with Renoise playback. A licensed host build is needed for automated render-based comparisons where demo rendering is restricted. [Renoise demo restrictions](https://www.renoise.com/download)

Evaluate perceived groove, genre fit, fill resolution, repetition, and mutation identity in blinded listening sessions with producers. Compare profiles at matched BPM to expose cosmetic genre changes. Include low, medium and high complexity plus sparse patterns; density alone must not drive perceived quality.

Suggested release targets: 100% locked-event preservation; no silent event loss in compiler fixtures; zero song modifications on failed preflight; generation p95 below 100 ms for the MVP's largest supported phrase on the agreed test machine; no missing or duplicated scheduled hits over 100 loop cycles under the documented load. These are product acceptance targets, not measured results.

### UX and durability

Run keyboard-only and screen-reader checks on navigation, selection and explanations. Test role recognition without color, zoom to 200%, and narrow windows. Watch users map a sample, distinguish row count from bars, and complete a transfer without assistance. Check Undo after every mutation type and confirm redo branches are cleared after a new edit.

Test autosave, reload, schema migration, missing audio, storage quota, backup/restore and stale worker responses. An exported backup must restore names, events, locks, seed, mapping references and settings. Test clipboard denial as a normal supported case with a visible file fallback.

## 22 Example generated pattern

### Two bar Jungle study

Illustrative target: **165 BPM, 4/4, LPB 4, TPL 12, 32 rows, 1/16 row spacing**. This is a designed fixture for the proposed generator, not a claim of an executed generator run. Row numbers below are decimal; instrument, volume, pan and delay fields are hexadecimal.

Mapping contract: instrument `00` has kick at `C-4`; `01` has snare at `C-4`; `02` has closed hat at `C-4`. Instrument `03` is an explicitly prepared break kit with slice A kick at `C-4`, B hat texture at `C#4`, C snare at `D-4`, and D percussion at `D#4`. These mappings are examples to create and verify, not assumptions about Renoise's automatic slice-note layout.

One-shot lanes use a fixed note and instrument. In the table K, S and H cells show volume only; `--` means no new note. The break lane shows note and volume. All triggered notes use pan `40`; delay is `00` except where listed. The compiler expands these compact columns into full native note columns. The table itself is explanatory and is not a native clipboard payload.

| Row | Bar and beat | K 00 | S 01 | H 02 | Break 03 | Delay or FX | Annotation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 00 | 1 · 1 | 70 | -- | 40 | -- | -- | Kick anchor and hat |
| 01 | 1 · 1 e | -- | -- | -- | -- | -- | No new trigger |
| 02 | 1 · 1 & | -- | -- | 30 | -- | -- | Quieter hat |
| 03 | 1 · 1 a | -- | -- | -- | D#4 28 | -- | Percussion slice pickup |
| 04 | 1 · 2 | -- | 70 | 40 | -- | -- | Main backbeat |
| 05 | 1 · 2 e | -- | -- | -- | -- | -- | No new trigger |
| 06 | 1 · 2 & | -- | -- | 30 | -- | H delay 10 | Hat about 5.68 ms late |
| 07 | 1 · 2 a | -- | 20 | -- | -- | -- | Quiet ghost snare |
| 08 | 1 · 3 | 64 | -- | 40 | -- | -- | Kick reasserts pulse |
| 09 | 1 · 3 e | -- | -- | -- | -- | -- | Space for tails |
| 10 | 1 · 3 & | -- | -- | -- | C#4 38 | -- | Hat texture slice |
| 11 | 1 · 3 a | 48 | -- | -- | -- | -- | Kick anticipates beat 4 |
| 12 | 1 · 4 | -- | 70 | 40 | -- | -- | Main backbeat |
| 13 | 1 · 4 e | -- | -- | -- | -- | -- | No new trigger |
| 14 | 1 · 4 & | -- | -- | 30 | -- | -- | Hat maintains motion |
| 15 | 1 · 4 a | -- | -- | -- | D-4 20 | -- | Ghost snare slice |
| 16 | 2 · 1 | -- | -- | 40 | C-4 70 | -- | Kick slice substitutes kick |
| 17 | 2 · 1 e | -- | -- | -- | -- | -- | No new trigger |
| 18 | 2 · 1 & | -- | -- | 30 | -- | -- | Hat |
| 19 | 2 · 1 a | 50 | -- | -- | -- | -- | Kick pickup into backbeat |
| 20 | 2 · 2 | -- | 70 | 40 | -- | -- | Stable snare anchor |
| 21 | 2 · 2 e | -- | -- | -- | -- | -- | Space |
| 22 | 2 · 2 & | -- | -- | 30 | -- | H delay 10 | Repeated late-hat feel |
| 23 | 2 · 2 a | -- | 24 | -- | -- | -- | Ghost snare response |
| 24 | 2 · 3 | 64 | -- | 40 | -- | -- | Kick anchor |
| 25 | 2 · 3 e | -- | -- | -- | -- | -- | Space |
| 26 | 2 · 3 & | -- | -- | -- | C#4 38 | -- | Reuse texture motif |
| 27 | 2 · 3 a | 48 | -- | -- | -- | -- | Kick anticipation |
| 28 | 2 · 4 | -- | -- | 40 | D-4 70 | -- | Snare slice replaces snare |
| 29 | 2 · 4 e | -- | -- | -- | -- | -- | Gap before fill |
| 30 | 2 · 4 & | -- | -- | -- | D-4 38 | 0R06 optional | Snare fill onset |
| 31 | 2 · 4 a | -- | -- | -- | D-4 48 | 0R06 optional | Fill resolves into loop |

### Expanded representative rows

```text
Field order: NOTE INS VOL PAN DLY | TRACK FX
Row 00 Kick    C-4 00 70 40 00   | ....
Row 00 Hat     C-4 02 40 40 00   | ....
Row 06 Hat     C-4 02 30 40 10   | ....
Row 07 Snare   C-4 01 20 40 00   | ....
Row 16 Break   C-4 03 70 40 00   | ....
Row 28 Break   D-4 03 70 40 00   | ....
Row 30 Break   D-4 03 38 40 00   | 0R06
Row 31 Break   D-4 03 48 40 00   | 0R06
```

The optional native variant uses `0R06` at TPL 12 to request retriggering every six ticks, corresponding to half a row here. Its isolated break track and slice restart behavior must be verified with the target kit. [Renoise retrigger reference](https://tutorials.renoise.com/wiki/Effect_Commands)

For the MVP, compile the fill as explicit onsets at rows 30 and 31 with delay `00`, plus an additional mapped snare onset on each row with delay `80` in another note column. Configure and verify the demo kit's shared choke behavior so repeats restart cleanly. These four evenly spaced attacks form the 1/32 burst without depending on tick-based retrigger semantics. Do not export both variants at once.

This phrase works by repeating a stable snare framework and an identifiable hat pattern, then changing source slices in bar 2. Rows 11 and 27 anticipate the backbeat. Rows 7, 15 and 23 add quieter connective material. Row 28 replaces the main snare with a snare slice rather than doubling it. The final burst is localized, leaving the rest of the phrase readable. Moving row 11 to row 10 makes the kick less anticipatory; raising row 7 to the main-snare volume creates an additional accent and changes the groove.

## 23 Example user workflow

Maya opens the app, chooses Jungle, and selects the supplied original break map. She presses the 165 BPM button, chooses two bars, and leaves complexity at 45%. Generate creates a phrase; Play auditions it immediately.

In Hybrid view she selects row 7. The inspector identifies a ghost snare and offers a comparison without it. She locks the main snare beats and the opening kick, selects the last four rows, and chooses Generate Fill. She tries one mutation, uses Undo, then saves the preferred result as “Jungle study B”.

For first-time Renoise setup, she installs the companion tool and loads the demo kit. The tool's mapping profile associates logical drum and slice IDs with the actual instrument slots. She verifies a kick and a snare through audition. Later transfers reuse this mapping unless the song changes.

She presses Copy for Renoise Tool, switches to Renoise, opens Import Breakbeat Pattern, pastes into its text field, and chooses Apply. The preflight shows 2 bars, 32 rows, LPB 4, four destination lanes, and the mapped instruments. She chooses a new pattern and confirms the timing policy. The tool writes the pattern and reports success after read-back. If text paste is unavailable on her supported configuration, she uses Export .bbpattern and Open File in the same tool.

She listens in Renoise, edits the sound, and continues arranging. No tracker text needs retyping. If she dislikes the import, the documented Undo or Restore action returns the affected song state.

## Recommended order for building the MVP

1. **Prove one transfer.** Build the Phase 1 Lua file importer and a hand-authored 16-row fixture with one simultaneous hit and one delayed hit. Do not begin with a large frontend.
2. **Freeze the smallest data contract.** Implement the schema, mapping profile and timing compiler; verify read-back in Renoise.
3. **Build one deterministic generator.** Start with a two-bar Jungle skeleton and original one-shot kit. Add a minimal audio audition harness now so musical decisions can be heard.
4. **Add two contrasting profiles.** DnB Roller and Hip-Hop Swing validate that the engine supports different structures rather than tempo labels.
5. **Build the shared editor.** Implement Hybrid first, then derive Beginner and Renoise views from the same events; include the command/history foundation.
6. **Add the controls.** BPM, bars, resolution, complexity and progressive advanced settings should drive tested engine parameters.
7. **Add mapped break slices and constrained mutation.** Prove source identity, choking, locks and phrase continuity before adding dramatic effects.
8. **Complete the handoff.** Add preflight, mapping persistence, collision handling, undo recovery and tool text paste if it passes. Keep file import always available.
9. **Finish preview, explanations and persistence.** Use the same realized events for sound, teaching, saving and export; add the local library and backup.
10. **Validate with producers and release.** Fix transfer errors and musical weaknesses before expanding genres or adding AI. The first finished component should be the reliable Renoise import path, and every later component should keep that path working.
