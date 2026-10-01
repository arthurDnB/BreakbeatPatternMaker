# Groove V4: profile-driven breakbeat generation

Groove V4 is the default for new UI generation. Saved V1, V2, and V3 patterns keep their engine and events. A V4 pattern is fully determined by its settings and seed; playback never invents new notes.

## Where to tune it

| Change | File | Field or function |
| --- | --- | --- |
| Genre-specific call and response | `src/core/groove-v4-profiles.ts` | `V4_PROFILES[genre].call` and `.answer` |
| Genre hat density, fills and allowed gestures | `src/core/groove-v4-profiles.ts` | `pulseDensity`, `fillRole`, `fillSteps`, `gestures`, `gestureBudget` |
| Shared family starting points | `src/core/groove-v4-profiles.ts` | `FAMILY` |
| Kick/snare spine and basic timing vocabulary | `src/core/groove-v3-profiles.ts` | `V3_RULES[genre]` (shared data; do not edit V3 behavior lightly) |
| Generation stage behavior | `src/core/groove-v4.ts` | `spine`, `layers`, `cadence`, `gestures` |
| Genre control defaults | `src/core/profiles.ts` | `genreDefaults()` |

`V4_PROFILES` has a typed entry for each of the 38 genres. Every `V4Note` gives a role, position in sixteenths, gain, minimum Complexity depth, and optional ghost flag. Half positions are 32nds. For example, `n('snare',13.5,.3,.6,true)` adds a quiet snare on the second half of sixteenth 13 when Complexity reaches 60%, subject to Ghost Amount. Profiles are production starting points, so the user can still override swing, syncopation, density, samples, and tempo.

## Generation stages

1. **Spine:** Select a kick and snare motif with an RNG stream that ignores `variation`. These are protected anchor hits. A named break style can substitute its rhythmic motif.
2. **Layers:** Add the genre's hat pulse, then detail, call/answer notes, pickups, ghost snares, percussion, and optional Euclidean cross-rhythm as Complexity rises. Each decision has its own named seed stream.
3. **Cadence:** Add a profile-specific turnaround only where `phraseLength`, `phraseOffset`, and Fill Amount call for one. `Groove`, `Fill`, `Roll`, and `Build` structure modes have explicit behavior.
4. **Gestures:** Spicy selects a bounded number of non-anchor accents in each bar. The profile lists allowed gestures. Rolls and chops have velocity curves, an onset-spacing limit, and a duration bounded by the next hit and the pattern edge.

Complexity changes note structure; Spicy changes performance. This separation lets a producer make a simple beat expressive or a detailed beat restrained. Genre profiles limit both controls. Variation changes supporting events while retaining the exact anchor spine. Editor locks, Undo/Redo, project saves, Preview, and WAV export use the normal application path.

Advanced Generation also has Kick, Snare, Hi-hat and Percussion density controls for V4. Each defaults to 100%, which retains the genre profile's current behavior. Lower values remove optional hits from that lane; 0% leaves only protected kick/snare anchors. Higher values, up to 200%, bring in more profile-defined detail and fills. Use the instrument's Generate notes switch to silence a lane entirely. Density changes take effect on the next Generate or Variation and are saved with the pattern and project draft. Older saved patterns without density settings behave as 100% on every lane.

### Exact Hits

Advanced Generation offers **Hits → Auto / Exact**. Auto retains the earlier V4 result. Exact accepts an integer target up to 64 tracker notes per bar and applies it after kit routing, optional generated sample tracks, the Think slice layer, locks and manual notes have been merged. It counts drum and sample tracker notes, including Think slices; a ratchet remains one tracker note, and synth notes are excluded. Complexity still changes the available rhythmic detail, while Spicy changes note articulation.

The budget keeps protected anchors, locked hits, manually entered notes and the Think layer's signature vocal phrase, then favors a genre-appropriate balance of roles and bars. A low target below the protected count or a high target beyond the enabled lanes' available positions reports the feasible bound without changing the pattern. Generate and Variation use the same saved target; editing notes afterwards can change the displayed count until the next generation. The target lives in generator settings, so older projects with no target retain Auto behavior.

## Editing a genre safely

1. Change one profile entry in `groove-v4-profiles.ts`. Keep its `call` and `answer` notes within steps 0–15.5, gains within 0–1, and depths within 0–1. `fillSteps` should lie in the last part of the bar (10–15.5); selected-row fills scale that phrase into the chosen ending.
2. Compare the same seed at Complexity 0, 0.5, and 1 while Spicy stays at 0. Then compare Spicy 0, 0.5, and 1 at fixed Complexity. Listen to Preview and a loop WAV with the same kit.
3. Run `npm.cmd test` and `npm.cmd run test:site`. `tests/groove-v4.test.mjs` checks coverage, determinism, protected anchors, slider effects, fast structures, editing and audio rendering. Use additional listening tests for authenticity; structural assertions alone cannot prove that a groove sounds right.

## Research references

- [Strudel mini-notation](https://strudel.cc/learn/mini-notation/), [time modifiers](https://strudel.cc/learn/time-modifiers/), and [sample operations](https://strudel.cc/learn/samples/) informed the use of nested subdivisions, named rhythmic layers, swing, and chopping as composable ideas.
- [Stranjah's DnB subgenre tutorial](https://www.youtube.com/watch?v=sNgF8SPRYps) and [Ableton's feature on his workflow](https://www.ableton.com/en/blog/made-in-ableton-live-stranjah/) are practical references for differing groove density, break layers and call/response.
- [Groovin' in G's Renoise break-chopping tutorial](https://youtu.be/cEWxDC9Dam4), the [Groovin' in G tutorial thread](https://www.dogsonacid.com/threads/groovin-in-g-youtube-tutorials.820391/), and [Sonicstate's account of his resampling method](https://sonicstate.com/news/2024/02/08/innovative-technique-for-chopping-audio-in-renoise/) are references for slice offsets, 16-bar phrases, and pattern-based rearrangement. V4 can retrigger successive offsets within a one-shot; mapping those gestures to detected break slices is a separate future improvement.

These references describe techniques, not rigid definitions of whole genres. Profile edits should be judged against multiple tracks and producer examples, including the user's own references.
